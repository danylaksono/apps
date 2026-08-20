/** Diff-applier: syncs the Zustand store onto the MapLibre map.
 *  Cheap enough to run on every store change. */

import type { Map as MaplibreMap } from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { GROUP_RANK, LAYERS, OPACITY_PROPS } from "./registry";
import type { LayerDescriptor } from "./registry";
import { BASEMAPS, basemapSourceId } from "./basemaps";
import {
  applyFireFilters,
  fireFilterExpression,
  latestTimestamp,
  type FireFilters,
} from "../lib/analytics";
import { GLYPH_SOURCE } from "./glyphs";
import type { FilterSpecification } from "maplibre-gl";

function rankOf(d: LayerDescriptor): number {
  return d.renderRank ?? GROUP_RANK[d.group];
}

/** Layers are added whenever the user toggles them, so stacking would
 *  otherwise follow click order. Re-assert the registry's render ranks by
 *  moving each present layer to the top in ascending rank — cheap, and only
 *  run when the set of present layers actually changed. */
let lastPresentKey = "";

function enforceOrder(map: MaplibreMap): void {
  const present: { id: string; rank: number }[] = [];
  for (const d of LAYERS) {
    const ids = d.mapLayerIds ?? [d.id];
    for (const id of ids) {
      if (map.getLayer(id)) present.push({ id, rank: rankOf(d) });
    }
  }
  const key = present.map((p) => p.id).join("|");
  if (key === lastPresentKey) return;
  lastPresentKey = key;

  present.sort((a, b) => a.rank - b.rank);
  for (const p of present) {
    // no beforeId => move to the very top of the stack
    map.moveLayer(p.id);
  }
}

export interface MapSyncState {
  basemap: string;
  visibility: Record<string, boolean>;
  opacity: Record<string, number>;
  layerMode: Record<string, string>;
  layerParams: Record<string, Record<string, number>>;
  firesGeojson: FeatureCollection | null;
  fireFilters: FireFilters;
}

/** What has been pushed into each *source instance*.
 *
 *  Keyed on the source object rather than on the FeatureCollection, because
 *  toggling a layer off removes its source and toggling it back on creates a
 *  new, empty one — while the store still holds the very same data object. A
 *  guard that only compared the data would conclude "already applied" and leave
 *  the rebuilt source empty, which is exactly what it used to do: the layer came
 *  back with no fires in it. A new source has no entry here, so it gets filled.
 *  Weak, so removed sources are not retained. */
const appliedData = new WeakMap<object, FeatureCollection>();
/** Filter last set on each *layer instance*, for the same reason — a re-added
 *  layer starts with no filter and must have it re-applied. */
const appliedFilter = new WeakMap<object, string>();

/** Latest detection time in the current set — the anchor the time filter is
 *  measured back from. Recomputed only when the data itself changes. */
let firesLatest = 0;
let lastFiresData: FeatureCollection | null = null;

/** Map layers driven by the fire filter. The charts apply the same predicate
 *  through applyFireFilters, so the two views cannot drift apart. */
const FIRE_FILTERED = [
  "fires",
  "fires-glow-outer",
  "fires-glow-inner",
  "fires-heat",
];

/** The filtered slice, shared by the glyph source and the glyph markers.
 *
 *  Recomputed only when the data or the filters actually change: it is a pass
 *  over ~27,000 features, and the applier runs on every store change. */
let filteredFires: FeatureCollection | null = null;
let filteredKey = "";

/** What the glyph layers should summarise — already filtered, so clustering
 *  cannot count anything the dots are hiding. */
export function currentFilteredFires(): FeatureCollection | null {
  return filteredFires;
}

/** Returns false if the style was not ready and nothing was applied — the
 *  caller must retry, or the store change is lost for good (the store only
 *  notifies on change, so there is no second chance otherwise). */
export function applyMapState(map: MaplibreMap, state: MapSyncState): boolean {
  if (!map.isStyleLoaded()) return false;

  // basemaps: toggle visibility (all pre-registered in the base style)
  for (const b of BASEMAPS) {
    const layerId = basemapSourceId(b.id);
    if (map.getLayer(layerId)) {
      map.setLayoutProperty(
        layerId,
        "visibility",
        b.id === state.basemap ? "visible" : "none",
      );
    }
  }

  // overlay layers
  for (const d of LAYERS) {
    const visible = Boolean(state.visibility[d.id]);
    const present = Boolean(map.getLayer(d.id));
    try {
      if (visible && !present) d.add(map);
      else if (!visible && present) d.remove(map);
    } catch (err) {
      console.warn(`[agni] layer ${d.id} sync failed`, err);
      continue;
    }
    if (map.getLayer(d.id)) {
      if (d.applyMode && d.modes?.length) {
        d.applyMode(map, state.layerMode[d.id] ?? d.modes[0].value);
      }
      if (d.applyParams && d.params?.length) {
        d.applyParams(map, state.layerParams[d.id] ?? {});
      }
      if (d.setOpacity) {
        d.setOpacity(map, state.opacity[d.id] ?? d.defaultOpacity);
      } else {
        const base = d.baseOpacity ?? 1;
        const slider = state.opacity[d.id] ?? d.defaultOpacity;
        map.setPaintProperty(
          d.id,
          OPACITY_PROPS[d.layerType],
          Math.min(1, base * slider),
        );
      }
    }
  }

  enforceOrder(map);

  // push fire data whenever this source instance has not had it
  const src = map.getSource("fires") as GeoJSONSource | undefined;
  if (src && state.firesGeojson && appliedData.get(src) !== state.firesGeojson) {
    src.setData(state.firesGeojson);
    appliedData.set(src, state.firesGeojson);
    if (state.firesGeojson !== lastFiresData) {
      lastFiresData = state.firesGeojson;
      firesLatest = latestTimestamp(state.firesGeojson);
    }
  }

  // Filtering happens in the style, not by re-slicing the source: the whole
  // 5-day set stays loaded and a filter change is a repaint, not a refetch.
  if (firesLatest) {
    const filterKey = `${firesLatest}|${JSON.stringify(state.fireFilters)}`;

    // The glyphs are the exception: MapLibre clusters at the source, below
    // where a style filter reaches, so they need the sliced data itself.
    if (state.firesGeojson && filterKey !== filteredKey) {
      filteredKey = filterKey;
      filteredFires = applyFireFilters(
        state.firesGeojson,
        state.fireFilters,
        firesLatest,
      );
    }
    const glyphSrc = map.getSource(GLYPH_SOURCE) as GeoJSONSource | undefined;
    if (glyphSrc && filteredFires && appliedData.get(glyphSrc) !== filteredFires) {
      glyphSrc.setData(filteredFires);
      appliedData.set(glyphSrc, filteredFires);
    }
    let expr: FilterSpecification | null = null;
    for (const id of FIRE_FILTERED) {
      const layer = map.getLayer(id);
      if (!layer) continue;
      if (appliedFilter.get(layer) === filterKey) continue;
      expr ??= fireFilterExpression(
        state.fireFilters,
        firesLatest,
      ) as unknown as FilterSpecification;
      map.setFilter(id, expr);
      appliedFilter.set(layer, filterKey);
    }
  }

  return true;
}
