/** User-added remote layers.
 *
 *  The registry is a compile-time list, which is right for the layers the app
 *  is *about* — they need bespoke styling, decode protocols, legends and
 *  caveats. It is wrong for the long tail: BIG publishes seven public
 *  MapServers and the app hard-codes layers from two, and every one of those
 *  services is keyless and CORS-open. So this module lets a pasted URL become a
 *  descriptor at runtime, with the same toggle, opacity, legend, render order
 *  and click-to-inspect as everything else.
 *
 *  ## Why the specs and the descriptors are separate
 *
 *  A `CustomLayerSpec` is plain data: it survives `JSON.stringify`, so it can
 *  live in localStorage and be rebuilt on the next visit. A `LayerDescriptor`
 *  closes over `map` calls and cannot. `setCustomSpecs` is the one place they
 *  are joined, and it is called by the store.
 *
 *  ## Import direction
 *
 *  This module imports the registry; the registry must never import this one.
 *  The store imports both. Keeping the arrow one-way is what stops
 *  `LAYERS` — which is evaluated at module scope — from reading a half-built
 *  module. `allLayers()` therefore lives here rather than in the registry. */

import type { Map as MaplibreMap } from "maplibre-gl";
import { arcgisExportTiles, arcgisLegend } from "../lib/arcgis";
import {
  EMPTY_FC,
  LAYERS,
  addSourceSafe,
  removeLayerSafe,
  removeSourceIfUnused,
  type LayerDescriptor,
  type LayerInfo,
} from "./registry";

/** How a custom layer draws itself.
 *
 *  `arcgis-image` is the default for a reason: MapServer renders it on demand,
 *  so it works at any size — BIG's rawan erosi is 306,265 features and can only
 *  be seen this way — and it costs nothing until the tiles are requested. The
 *  trade is that it is pixels, so it cannot be clicked or counted.
 *  `arcgis-vector` pages the same layer as GeoJSON: slower, capped, but real
 *  features that the popup can read. */
export type CustomKind = "arcgis-image" | "arcgis-vector" | "xyz" | "geojson";

export type CustomGeometry = "point" | "line" | "polygon";

export interface CustomLayerSpec {
  id: string;
  label: string;
  kind: CustomKind;
  /** ArcGIS service URL, XYZ template, or GeoJSON URL */
  url: string;
  /** ArcGIS sublayer index */
  layerId?: number;
  geometry?: CustomGeometry;
  /** the service's paging cap, so `arcgis-vector` does not mistake a short
   *  page for the end of the data */
  pageSize?: number;
  color: string;
  description: string;
}

/** Palette for new layers, walked in order so two additions never collide.
 *  Deliberately outside the fire ramp and away from the peat violet and the
 *  forest greens — a custom layer should not look like one of the built-ins. */
const PALETTE = [
  "#38bdf8",
  "#f472b6",
  "#facc15",
  "#a3e635",
  "#fb923c",
  "#c084fc",
  "#2dd4bf",
  "#f87171",
];

export function nextCustomColor(existing: CustomLayerSpec[]): string {
  const used = new Set(existing.map((s) => s.color));
  return PALETTE.find((c) => !used.has(c)) ?? PALETTE[existing.length % PALETTE.length];
}

/** Ids must be stable across reloads — the store keys visibility, opacity and
 *  the map's own layer ids by them — and must never be reused.
 *
 *  Hence the timestamp suffix rather than a "-2" that counts current specs.
 *  Removing a layer and adding a different one that slugs the same way would
 *  otherwise inherit the old id, and with it the session-cached
 *  FeatureCollection that `remoteLayers.ts` still holds against it. */
export function customLayerId(label: string): string {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32) || "layer";
  return `custom-${slug}-${Date.now().toString(36).slice(-5)}`;
}

/** Provenance for a layer the user added themselves.
 *
 *  The built-ins have a hand-checked entry in datasetInfo.ts; a pasted URL has
 *  nothing but the spec, so this reports exactly what the app knows and does
 *  not dress it up. Whoever pasted the URL is the authority on what is behind
 *  it, which is what the caveat says. */
function customInfo(spec: CustomLayerSpec, tiles?: string): LayerInfo {
  const detail: Record<
    CustomKind,
    Pick<LayerInfo, "api" | "endpoint" | "format">
  > = {
    "arcgis-image": {
      api: `ArcGIS MapServer export, sublayer ${spec.layerId ?? 0}. The server draws each tile when the app asks for it.`,
      endpoint: tiles ?? spec.url,
      format:
        "PNG drawn by the server. These are pixels, so the layer works at any feature count, but you cannot click it or count it.",
    },
    "arcgis-vector": {
      api: "ArcGIS REST query. The app reads the features page by page.",
      endpoint: `${spec.url}/${spec.layerId ?? 0}/query?f=geojson`,
      format:
        "GeoJSON with real features, so the click popup can read them. The paging limit of the service caps how many arrive.",
    },
    xyz: {
      api: "XYZ raster template. The app requests the tiles without change.",
      endpoint: spec.url,
      format:
        "Raster tiles as the server sends them. The app does not decode or restyle them.",
    },
    geojson: {
      api: "The app downloads the whole file once, when you add the layer.",
      endpoint: spec.url,
      format: "GeoJSON, drawn in the colour the app gave the layer.",
    },
  };
  return {
    source: "Added at run time. This layer is not part of the app catalogue.",
    ...detail[spec.kind],
    caveat:
      "Nobody has checked this source against the publisher. The resolution, the age and the licence are whatever the endpoint sends. The app knows only the URL you gave it.",
    link: spec.url,
  };
}

// ----------------------------------------------------------- descriptors ---

function rasterDescriptor(
  spec: CustomLayerSpec,
  tiles: string,
): LayerDescriptor {
  return {
    id: spec.id,
    group: "custom",
    label: spec.label,
    description: spec.description,
    info: customInfo(spec, tiles),
    layerType: "raster",
    defaultVisible: true,
    defaultOpacity: 0.85,
    // Only ArcGIS can tell us what its own colours mean. A plain XYZ template
    // has no such endpoint, so those stay legend-less rather than inventing one.
    ...(spec.kind === "arcgis-image"
      ? { asyncLegend: () => arcgisLegend(spec.url, spec.layerId ?? 0) }
      : {}),
    add(map) {
      addSourceSafe(map, spec.id, {
        type: "raster",
        tiles: [tiles],
        tileSize: 256,
      });
      if (!map.getLayer(spec.id)) {
        map.addLayer({ id: spec.id, type: "raster", source: spec.id });
      }
    },
    remove(map) {
      removeLayerSafe(map, spec.id);
      removeSourceIfUnused(map, spec.id);
    },
  };
}

function vectorDescriptor(spec: CustomLayerSpec): LayerDescriptor {
  const geometry = spec.geometry ?? "polygon";
  const lineId = `${spec.id}-line`;
  const multi = geometry === "polygon";
  return {
    id: spec.id,
    group: "custom",
    mapLayerIds: multi ? [spec.id, lineId] : [spec.id],
    label: spec.label,
    description: spec.description,
    info: customInfo(spec),
    layerType: geometry === "point" ? "circle" : geometry === "line" ? "line" : "fill",
    defaultVisible: true,
    defaultOpacity: 0.9,
    legend: [{ color: spec.color, label: spec.label.toLowerCase() }],
    add(map) {
      addSourceSafe(map, spec.id, { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer(spec.id)) {
        if (geometry === "point") {
          map.addLayer({
            id: spec.id,
            type: "circle",
            source: spec.id,
            paint: {
              "circle-radius": 3.5,
              "circle-color": spec.color,
              "circle-opacity": 0.85,
              "circle-stroke-width": 0.5,
              "circle-stroke-color": "#0b0f14",
            },
          });
        } else if (geometry === "line") {
          map.addLayer({
            id: spec.id,
            type: "line",
            source: spec.id,
            paint: { "line-color": spec.color, "line-width": 1.2 },
          });
        } else {
          map.addLayer({
            id: spec.id,
            type: "fill",
            source: spec.id,
            paint: { "fill-color": spec.color, "fill-opacity": 0.22 },
          });
        }
      }
      if (multi && !map.getLayer(lineId)) {
        map.addLayer({
          id: lineId,
          type: "line",
          source: spec.id,
          paint: { "line-color": spec.color, "line-width": 0.7 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, lineId);
      removeLayerSafe(map, spec.id);
      removeSourceIfUnused(map, spec.id);
    },
    setOpacity(map: MaplibreMap, slider: number) {
      if (map.getLayer(spec.id)) {
        const prop =
          geometry === "point"
            ? "circle-opacity"
            : geometry === "line"
              ? "line-opacity"
              : "fill-opacity";
        const base = geometry === "polygon" ? 0.22 : 0.85;
        map.setPaintProperty(spec.id, prop, Math.min(1, base * slider));
      }
      if (map.getLayer(lineId)) {
        map.setPaintProperty(lineId, "line-opacity", Math.min(1, 0.8 * slider));
      }
    },
  };
}

export function buildCustomLayer(spec: CustomLayerSpec): LayerDescriptor {
  switch (spec.kind) {
    case "arcgis-image":
      return rasterDescriptor(spec, arcgisExportTiles(spec.url, spec.layerId ?? 0));
    case "xyz":
      return rasterDescriptor(spec, spec.url);
    default:
      return vectorDescriptor(spec);
  }
}

// -------------------------------------------------------------- registry ---

const STORAGE_KEY = "agni.customLayers";

function readStored(): CustomLayerSpec[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Validated rather than trusted: this is the one input to the layer system
    // that survives a deploy, so a spec written by an older build (or edited by
    // hand) must not be able to crash the map on load.
    return parsed.filter(
      (s): s is CustomLayerSpec =>
        Boolean(s) &&
        typeof (s as CustomLayerSpec).id === "string" &&
        typeof (s as CustomLayerSpec).url === "string" &&
        typeof (s as CustomLayerSpec).label === "string",
    );
  } catch {
    return [];
  }
}

let specs: CustomLayerSpec[] = readStored();
let descriptors: LayerDescriptor[] = specs.map(buildCustomLayer);

export function customSpecs(): CustomLayerSpec[] {
  return specs;
}

export function customLayerDescriptors(): LayerDescriptor[] {
  return descriptors;
}

/** Replace the custom set and persist it. Called by the store, which owns the
 *  React-visible copy; everything outside React reads `allLayers()`. */
export function setCustomSpecs(next: CustomLayerSpec[]): void {
  specs = next;
  descriptors = next.map(buildCustomLayer);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // private mode, quota, or no storage at all — the layers still work for
    // this session, they just will not come back.
  }
}

/** Built-ins plus whatever the user added, in render-rank-agnostic order.
 *
 *  Every consumer that walks the layer set — the applier, the panel, the
 *  popup — must use this rather than `LAYERS`, or custom layers will be added
 *  to the map and then never synced, ordered or queried. */
export function allLayers(): LayerDescriptor[] {
  return descriptors.length ? [...LAYERS, ...descriptors] : LAYERS;
}
