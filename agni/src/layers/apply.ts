/** Diff-applier: syncs the Zustand store onto the MapLibre map.
 *  Cheap enough to run on every store change. */

import type { Map as MaplibreMap } from "maplibre-gl";
import type { GeoJSONSource } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { GROUP_RANK, LAYERS, OPACITY_PROPS } from "./registry";
import type { LayerDescriptor } from "./registry";
import { BASEMAPS, basemapSourceId } from "./basemaps";

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
  firesGeojson: FeatureCollection | null;
}

let lastFires: FeatureCollection | null = null;

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

  // push fire data when it (or its source) changes
  const src = map.getSource("fires") as GeoJSONSource | undefined;
  if (src && state.firesGeojson && state.firesGeojson !== lastFires) {
    src.setData(state.firesGeojson);
    lastFires = state.firesGeojson;
  }

  return true;
}
