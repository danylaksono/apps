/** Global Forest Watch context layers.
 *
 *  These answer "why is it burning *here*?" — peat depth, plantation and
 *  logging concessions, moratorium and protected areas. All are keyless and
 *  CORS-open, so they need no pipeline step and no API key.
 *
 *  GFW's static tile caches stop at ~z10 and return 404 for empty tiles; the
 *  source `maxzoom` below keeps MapLibre from requesting past the cache (it
 *  overzooms the last level instead, which keeps vector edges sharp). */

import type { Map as MaplibreMap } from "maplibre-gl";
import type {
  LayerDescriptor,
  LayerGroup,
  LayerInfo,
  LegendItem,
} from "./registry";
import { gfwVectorTiles } from "../lib/config";

type GfwEntry = { dataset: string; version: string; maxzoom: number };

interface GfwPolygonOptions {
  id: string;
  group: LayerGroup;
  label: string;
  description: string;
  entry: GfwEntry;
  color: string;
  /** fill alpha at slider = 1 (outlines carry most of the read on a dark map) */
  fillAlpha?: number;
  defaultVisible?: boolean;
  defaultOpacity?: number;
  legend?: LegendItem[];
  /** data-driven fill, e.g. a `match` on a class attribute */
  fillColor?: unknown;
  /** attribute used for the click popup title */
  nameField?: string;
  /** secondary attribute shown under the title */
  subField?: string;
  /** Overrides for the generated provenance card. The dataset, version, tile
   *  URL and API line are all derived from `entry`, so what is worth stating
   *  by hand is only what GFW's catalogue does not say: who compiled the
   *  polygons, how old they are, and what not to conclude from them. */
  info?: Partial<LayerInfo>;
}

/** Attributes each GFW layer exposes for popups, keyed by layer id. */
export const GFW_POPUP_FIELDS: Record<
  string,
  { name?: string; sub?: string; area?: string }
> = {};

/** Build a fill+outline descriptor for a GFW vector-tile polygon dataset. */
export function gfwPolygonLayer(o: GfwPolygonOptions): LayerDescriptor {
  const srcId = `gfw-${o.id}`;
  const lineId = `${o.id}-line`;
  const fillAlpha = o.fillAlpha ?? 0.18;

  GFW_POPUP_FIELDS[o.id] = {
    name: o.nameField,
    sub: o.subField,
    area: "gfw_area__ha",
  };

  return {
    id: o.id,
    group: o.group,
    label: o.label,
    description: o.description,
    // Derived from the same pinned entry that builds the tile URL, so a
    // version bump cannot leave the panel describing the previous one.
    info: {
      source: `Global Forest Watch open data. Dataset ${o.entry.dataset}, version ${o.entry.version}.`,
      resolution: `The tiles stop at zoom ${o.entry.maxzoom}. Above that the map stretches the last level, so the edges stay sharp but no new detail appears.`,
      api: "Static XYZ vector tiles. Keyless, and they accept requests from other origins. The app pins a version instead of `latest`.",
      endpoint: gfwVectorTiles(o.entry.dataset, o.entry.version),
      format:
        "Mapbox Vector Tiles. The source-layer name is the same as the dataset name.",
      link: `https://data-api.globalforestwatch.org/dataset/${o.entry.dataset}`,
      ...o.info,
    },
    layerType: "fill",
    mapLayerIds: [o.id, lineId],
    defaultVisible: o.defaultVisible ?? false,
    defaultOpacity: o.defaultOpacity ?? 0.85,
    legend: o.legend ?? [{ color: o.color, label: o.label }],
    add(map: MaplibreMap) {
      if (!map.getSource(srcId)) {
        map.addSource(srcId, {
          type: "vector",
          tiles: [gfwVectorTiles(o.entry.dataset, o.entry.version)],
          minzoom: 0,
          maxzoom: o.entry.maxzoom,
          attribution:
            '<a href="https://www.globalforestwatch.org/">Global Forest Watch</a>',
        });
      }
      if (!map.getLayer(o.id)) {
        map.addLayer({
          id: o.id,
          type: "fill",
          source: srcId,
          "source-layer": o.entry.dataset,
          paint: {
            "fill-color": (o.fillColor ?? o.color) as string,
            "fill-opacity": fillAlpha,
          },
        });
      }
      if (!map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: srcId,
          "source-layer": o.entry.dataset,
          paint: {
            "line-color": o.color,
            "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.4, 10, 1.2],
            "line-opacity": 0.9,
          },
        });
      }
    },
    remove(map: MaplibreMap) {
      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getLayer(o.id)) map.removeLayer(o.id);
      if (map.getSource(srcId)) map.removeSource(srcId);
    },
    setOpacity(map: MaplibreMap, slider: number) {
      if (map.getLayer(o.id)) {
        map.setPaintProperty(o.id, "fill-opacity", fillAlpha * slider);
      }
      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, "line-opacity", Math.min(1, 0.9 * slider));
      }
    },
  };
}
