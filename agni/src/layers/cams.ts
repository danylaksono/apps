/** CAMS haze layers as time-animated MapLibre image sources.
 *
 *  ECMWF's WMS renders on demand, so an XYZ pyramid would trigger dozens of
 *  renders per pan. One image over the Kalimantan bbox instead: a single
 *  render per time step, swapped in place via `updateImage` as you scrub. */

import type { ImageSource, Map as MaplibreMap } from "maplibre-gl";
import type { LayerDescriptor } from "./registry";
import { camsImageUrl, kalimantanCorners } from "../lib/cams";

export const CAMS_LAYER_IDS = ["haze-cams-smoke", "haze-cams-pm25"] as const;

/** 1x1 transparent PNG. Used as the initial image so the layer can be added
 *  before the time dimension is known — requesting a made-up timestamp would
 *  make the WMS return an error body that fails to decode. */
const BLANK_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** Time currently applied per source, so a layer switched on later still gets
 *  the scrubbed time rather than staying blank. */
const appliedTime = new Map<string, string>();

interface CamsOptions {
  id: string;
  label: string;
  description: string;
  entry: { layer: string; style: string };
  defaultVisible?: boolean;
  gradientLegend?: { css: string; min: string; max: string };
}

/** WMS layer/style behind each registry id, for the time-step sync. */
export const CAMS_SOURCES: Record<
  string,
  { sourceId: string; layer: string; style: string }
> = {};

export function camsImageLayer(o: CamsOptions): LayerDescriptor {
  const sourceId = `cams-${o.id}`;
  CAMS_SOURCES[o.id] = { sourceId, ...o.entry };

  return {
    id: o.id,
    group: "haze",
    label: o.label,
    description: o.description,
    layerType: "raster",
    defaultVisible: o.defaultVisible ?? false,
    defaultOpacity: 0.5,
    gradientLegend: o.gradientLegend,
    add(map: MaplibreMap) {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          type: "image",
          url: BLANK_PNG,
          coordinates: kalimantanCorners(),
        });
        appliedTime.delete(sourceId);
      }
      if (!map.getLayer(o.id)) {
        map.addLayer({
          id: o.id,
          type: "raster",
          source: sourceId,
          paint: { "raster-opacity": 0.5, "raster-fade-duration": 0 },
        });
      }
    },
    remove(map: MaplibreMap) {
      if (map.getLayer(o.id)) map.removeLayer(o.id);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
      appliedTime.delete(sourceId);
    },
  };
}

/** Point every visible CAMS layer at a given time step. Safe to call on every
 *  map sync: it only issues a render request for sources that are stale. */
export function setCamsTime(map: MaplibreMap, time: string): void {
  if (!time) return;
  for (const id of CAMS_LAYER_IDS) {
    const cfg = CAMS_SOURCES[id];
    if (!cfg || !map.getLayer(id)) continue;
    if (appliedTime.get(cfg.sourceId) === time) continue;
    const src = map.getSource(cfg.sourceId) as ImageSource | undefined;
    if (!src) continue;
    appliedTime.set(cfg.sourceId, time);
    src.updateImage({
      url: camsImageUrl(cfg.layer, cfg.style, time),
      coordinates: kalimantanCorners(),
    });
  }
}
