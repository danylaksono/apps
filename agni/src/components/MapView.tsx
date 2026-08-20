import { useEffect, useRef } from "react";
import {
  Map as MaplibreMap,
  NavigationControl,
  Popup,
  addProtocol,
  config as maplibreConfig,
  removeProtocol,
} from "maplibre-gl";
// maplibre builds its worker URL from a runtime string
// (`maplibre-gl-worker${dev ? "-dev" : ""}.mjs`), which no bundler can analyse
// statically — so the chunk is never emitted and it 404s next to the bundle.
// `?worker&url` makes Vite bundle the worker *and* its own sibling imports
// (maplibre-gl-shared.mjs) into one emitted file and hand back the hashed URL.
// WORKER_URL is maplibre's supported override for exactly this situation.
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import type { MapMouseEvent, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import "maplibre-gl/dist/maplibre-gl.css";
import { BASEMAPS, DEFAULT_BASEMAP, basemapSourceId } from "../layers/basemaps";
import { buildInspectHtml } from "../lib/inspect";
import { applyMapState, currentFilteredFires } from "../layers/apply";
import { GLYPH_SOURCE, updateGlyphs, type GlyphMode } from "../layers/glyphs";
import { BIG_BACKED, applyBigData, ensureBigLayer } from "../lib/peat";
import { GIBS_BACKED, ensureGibsDate } from "../lib/gibs";
import { refreshPopulation } from "../lib/population";
import { setMapRef } from "../lib/mapRef";
import { GFW_LOSS_PROTOCOL, gfwLossProtocol } from "../lib/gfwRaster";
import { CLMS_BA_PROTOCOL, clmsBurntAreaProtocol } from "../lib/clms";
import { setRasterDate } from "../lib/gibs";
import { setRasterDayOffset } from "../lib/rasterDate";
import { burntAreaDate } from "../layers/registry";
import { clmsBurntAreaTiles } from "../lib/clms";
import { setCamsTime } from "../layers/cams";
import { useLayersStore } from "../store/layers";

maplibreConfig.WORKER_URL = maplibreWorkerUrl;

function buildBaseStyle(): StyleSpecification {
  const sources: StyleSpecification["sources"] = {};
  const layers: StyleSpecification["layers"] = [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#07090d" },
    },
  ];
  for (const b of BASEMAPS) {
    const id = basemapSourceId(b.id);
    sources[id] = {
      type: "raster",
      tiles: b.tiles,
      tileSize: 256,
      attribution: b.attribution,
      ...(b.maxzoom ? { maxzoom: b.maxzoom } : {}),
    };
    layers.push({
      id,
      type: "raster",
      source: id,
      layout: { visibility: b.id === DEFAULT_BASEMAP ? "visible" : "none" },
    });
  }
  return { version: 8, sources, layers };
}

/** Minimal subset of the store the map needs to apply. */
function pickState(s: ReturnType<typeof useLayersStore.getState>) {
  return {
    basemap: s.basemap,
    visibility: s.visibility,
    opacity: s.opacity,
    firesGeojson: s.firesGeojson,
    fireFilters: s.fireFilters,
  };
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);
    // GFW ships tree cover loss as data-in-pixels; this decodes each tile to a
    // styled PNG before MapLibre ever sees it. See lib/gfwRaster.ts.
    addProtocol(GFW_LOSS_PROTOCOL, gfwLossProtocol);
    // CLMS burnt area paints "nothing burned" as an opaque pale fill; this
    // drops it so the layer is burns only. See lib/clms.ts.
    addProtocol(CLMS_BA_PROTOCOL, clmsBurntAreaProtocol);

    const map = new MaplibreMap({
      container: containerRef.current!,
      style: buildBaseStyle(),
      // Sabang to Merauke: 46 degrees of longitude, offset east of centre so
      // the layer panel does not cover Sumatra.
      center: [119.5, -2.2],
      zoom: 4.5,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl(), "bottom-right");
    setMapRef(map);

    // dev-only handle for poking at sources/layers from the console
    if (import.meta.env.DEV) {
      (globalThis as unknown as { agniMap?: MaplibreMap }).agniMap = map;
    }

    // The style can still be loading when a store change lands (e.g. the user
    // toggles a layer while tiles are in flight). Retry on the next idle
    // rather than dropping the change.
    let retryQueued = false;
    const applyAll = () => {
      const applied = applyMapState(map, pickState(useLayersStore.getState()));
      if (applied) applyBigData(map);
      if (applied || retryQueued) return;
      retryQueued = true;
      map.once("idle", () => {
        retryQueued = false;
        applyAll();
      });
    };
    map.on("load", () => {
      applyAll();
    });
    // BIG layers are fetched the first time they are switched on, not upfront;
    // GIBS layers resolve their date the same way. Both report through
    // setAvailability, which re-triggers applyAll once they settle.
    const syncBigLayers = () => {
      const { visibility, setAvailability } = useLayersStore.getState();
      for (const b of BIG_BACKED) {
        if (visibility[b.id]) ensureBigLayer(map, b.id);
      }
      for (const g of GIBS_BACKED) {
        if (!visibility[g.id]) continue;
        ensureGibsDate(g.spec, (status, reason) =>
          setAvailability(g.id, status, reason),
        );
      }
    };
    // repoint the CAMS image sources; setCamsTime skips sources already there
    const syncCamsTime = () => {
      const { camsSteps, camsIndex } = useLayersStore.getState();
      setCamsTime(map, camsSteps[camsIndex] ?? "");
    };
    // Dated rasters (GIBS daily products, CLMS burnt area) all read one shared
    // offset, so the slider moves them together.
    let lastOffset = -1;
    const syncRasterDate = () => {
      const { rasterDayOffset: offset } = useLayersStore.getState();
      setRasterDayOffset(offset);
      if (offset === lastOffset) return;
      lastOffset = offset;
      setRasterDate(map, offset);
      const ba = map.getSource("burnt-area") as
        | { setTiles?: (t: string[]) => void }
        | undefined;
      ba?.setTiles?.([clmsBurntAreaTiles(burntAreaDate(offset))]);
    };

    const unsubscribe = useLayersStore.subscribe(() => {
      syncRasterDate();
      applyAll();
      syncBigLayers();
      syncCamsTime();
      refreshPopulation(map);
      syncGlyphsWhenSettled();
    });
    map.on("load", syncBigLayers);

    // Population is aggregated per viewport in DuckDB rather than tiled, so it
    // is re-queried when the view settles. refreshPopulation no-ops unless the
    // layer is on and the viewport moved far enough to change the answer.
    // Glyphs are DOM markers, so they are rebuilt from what is on screen —
    // cluster glyphs follow the viewport, province glyphs only the data.
    const syncGlyphs = () => {
      const { visibility, layerMode } = useLayersStore.getState();
      updateGlyphs(map, {
        visible: Boolean(visibility["fire-glyphs"]),
        mode: (layerMode["fire-glyphs"] ?? "cluster") as GlyphMode,
        fires: currentFilteredFires(),
      });
    };

    const onMoveEnd = () => {
      refreshPopulation(map);
      syncGlyphs();
    };
    map.on("moveend", onMoveEnd);
    // Cluster glyphs follow the viewport; province glyphs do not move, so a
    // pan only needs the cluster pass.
    map.on("move", () => {
      const { visibility, layerMode } = useLayersStore.getState();
      if (visibility["fire-glyphs"] && layerMode["fire-glyphs"] !== "province") {
        syncGlyphs();
      }
    });
    // Clustering finishes asynchronously; without this the first draw after a
    // filter change would show the previous tally.
    map.on("sourcedata", (e) => {
      if (e.sourceId === GLYPH_SOURCE && e.isSourceLoaded) syncGlyphs();
    });
    /** Clustering finishes after the store change that switched the layer on,
     *  so drawing immediately finds no clusters and the glyphs only appear on
     *  the next pan. `idle` is the point at which everything has settled;
     *  `once` keeps it to a single extra pass rather than one per frame. */
    const syncGlyphsWhenSettled = () => {
      syncGlyphs();
      map.once("idle", syncGlyphs);
    };

    // click-to-inspect: report the whole land-context stack under the cursor
    // closeOnClick would race our own click handler — MapLibre removes the
    // popup on the same event that adds the new one. We close it ourselves
    // when a click hits nothing.
    const popup = new Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: "280px",
      className: "agni-popup",
    });
    const onClick = (e: MapMouseEvent) => {
      // Every click is a CAMS probe point — the forecast charts in the rail
      // read the numbers behind the pixels the haze layers are drawing.
      useLayersStore
        .getState()
        .setProbePoint({ lon: e.lngLat.lng, lat: e.lngLat.lat });
      const html = buildInspectHtml(map, map.queryRenderedFeatures(e.point));
      if (!html) {
        popup.remove();
        return;
      }
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    map.on("click", onClick);

    return () => {
      map.off("moveend", onMoveEnd);
      map.off("click", onClick);
      popup.remove();
      unsubscribe();
      setMapRef(null);
      map.remove();
      removeProtocol("pmtiles");
      removeProtocol(GFW_LOSS_PROTOCOL);
      removeProtocol(CLMS_BA_PROTOCOL);
    };
  }, []);

  // Size with h/w rather than `absolute inset-0`: maplibre-gl.css sets
  // `.maplibregl-map { position: relative }` on this same element and, being
  // loaded after Tailwind at equal specificity, wins — which would collapse
  // the container to zero height.
  return <div ref={containerRef} className="h-full w-full" />;
}
