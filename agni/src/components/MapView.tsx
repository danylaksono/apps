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
import { applyMapState } from "../layers/apply";
import { BIG_BACKED, applyBigData, ensureBigLayer } from "../lib/peat";
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
  };
}

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const protocol = new Protocol();
    addProtocol("pmtiles", protocol.tile);

    const map = new MaplibreMap({
      container: containerRef.current!,
      style: buildBaseStyle(),
      center: [113.2, 0.4],
      zoom: 5.4,
      attributionControl: { compact: true },
    });
    map.addControl(new NavigationControl(), "bottom-right");

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
    // BIG layers are fetched the first time they are switched on, not upfront
    const syncBigLayers = () => {
      const { visibility } = useLayersStore.getState();
      for (const b of BIG_BACKED) {
        if (visibility[b.id]) ensureBigLayer(map, b.id);
      }
    };
    // repoint the CAMS image sources; setCamsTime skips sources already there
    const syncCamsTime = () => {
      const { camsSteps, camsIndex } = useLayersStore.getState();
      setCamsTime(map, camsSteps[camsIndex] ?? "");
    };
    const unsubscribe = useLayersStore.subscribe(() => {
      applyAll();
      syncBigLayers();
      syncCamsTime();
    });
    map.on("load", syncBigLayers);

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
      const html = buildInspectHtml(map, map.queryRenderedFeatures(e.point));
      if (!html) {
        popup.remove();
        return;
      }
      popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
    };
    map.on("click", onClick);

    return () => {
      map.off("click", onClick);
      popup.remove();
      unsubscribe();
      map.remove();
      removeProtocol("pmtiles");
    };
  }, []);

  // Size with h/w rather than `absolute inset-0`: maplibre-gl.css sets
  // `.maplibregl-map { position: relative }` on this same element and, being
  // loaded after Tailwind at equal specificity, wins — which would collapse
  // the container to zero height.
  return <div ref={containerRef} className="h-full w-full" />;
}
