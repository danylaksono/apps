/** Config-driven layer registry. Every overlay layer is a descriptor here;
 *  the Zustand store keys state by descriptor id, and MapView syncs
 *  sources/layers imperatively. Adding a layer = appending a descriptor. */

import type { Map as MaplibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import {
  BOUNDARIES_PMTILES_URL,
  CAMS_LAYERS,
  GFW_DATASETS,
  GIBS_WMTS,
  POPULATION_PMTILES_URL,
} from "../lib/config";
import { gfwPolygonLayer } from "./gfw";
import { camsImageLayer } from "./cams";

export type LayerGroup =
  | "fire"
  | "haze"
  | "population"
  | "boundaries"
  | "peatland"
  | "concessions"
  | "protection";

export interface LegendItem {
  color: string;
  label: string;
}

export interface LayerDescriptor {
  id: string;
  group: LayerGroup;
  label: string;
  description: string;
  /** primary map layer type, drives default opacity mapping */
  layerType: "circle" | "heatmap" | "raster" | "fill" | "line";
  defaultVisible: boolean;
  defaultOpacity: number;
  /** base paint opacity multiplied by the slider value (default 1) */
  baseOpacity?: number;
  legend?: LegendItem[];
  gradientLegend?: { css: string; min: string; max: string };
  /** every map layer this descriptor creates, bottom-first; defaults to [id].
   *  Used to enforce render order independently of toggle order. */
  mapLayerIds?: string[];
  /** higher = drawn on top. Defaults to GROUP_RANK[group]. */
  renderRank?: number;
  add(map: MaplibreMap): void;
  remove(map: MaplibreMap): void;
  /** override for multi-layer descriptors; default uses layerType mapping */
  setOpacity?(map: MaplibreMap, slider: number): void;
}

/** Bottom-to-top draw order. Context polygons sit under the fire points they
 *  explain; fires always stay readable on top. */
export const GROUP_RANK: Record<LayerGroup, number> = {
  peatland: 10,
  concessions: 20,
  protection: 30,
  population: 40,
  haze: 50,
  boundaries: 60,
  fire: 70,
};

export const OPACITY_PROPS = {
  circle: "circle-opacity",
  heatmap: "heatmap-opacity",
  raster: "raster-opacity",
  fill: "fill-opacity",
  line: "line-opacity",
} as const;

export const EMPTY_FC: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function addSourceSafe(
  map: MaplibreMap,
  id: string,
  spec: Parameters<MaplibreMap["addSource"]>[1],
): void {
  if (!map.getSource(id)) map.addSource(id, spec);
}

function removeLayerSafe(map: MaplibreMap, id: string): void {
  if (map.getLayer(id)) map.removeLayer(id);
}

/** Remove a source only if no remaining layer references it (shared sources). */
function removeSourceIfUnused(map: MaplibreMap, id: string): void {
  if (!map.getSource(id)) return;
  const layers = map.getStyle()?.layers ?? [];
  const stillUsed = layers.some(
    (l) => (l as { source?: string }).source === id,
  );
  if (!stillUsed) map.removeSource(id);
}

export const LAYERS: LayerDescriptor[] = [
  // -------------------------------------------------------------- fire ---
  {
    id: "fires",
    group: "fire",
    label: "Active fires",
    description: "VIIRS SNPP NRT detections, last 48 h — NASA FIRMS.",
    layerType: "circle",
    defaultVisible: true,
    defaultOpacity: 0.9,
    legend: [
      { color: "#ffc24b", label: "low confidence" },
      { color: "#ff9e2c", label: "nominal" },
      { color: "#f04438", label: "high confidence" },
    ],
    add(map) {
      addSourceSafe(map, "fires", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("fires")) {
        map.addLayer({
          id: "fires",
          type: "circle",
          source: "fires",
          paint: {
            "circle-color": [
              "match",
              ["get", "confidence"],
              "h",
              "#f04438",
              "n",
              "#ff9e2c",
              "l",
              "#ffc24b",
              "#ff9e2c",
            ],
            "circle-radius": [
              "interpolate",
              ["linear"],
              ["get", "frp"],
              0,
              2,
              20,
              4,
              100,
              7,
              400,
              11,
            ],
            "circle-stroke-color": "rgba(255,255,255,0.35)",
            "circle-stroke-width": 0.8,
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "fires");
      removeSourceIfUnused(map, "fires");
    },
  },
  {
    id: "fires-heat",
    group: "fire",
    label: "Fire heatmap",
    description: "FRP-weighted density glow derived from FIRMS points.",
    layerType: "heatmap",
    defaultVisible: false,
    defaultOpacity: 0.85,
    gradientLegend: {
      css: "linear-gradient(90deg, rgba(255,194,75,0.3), #ff9e2c, #f04438)",
      min: "low",
      max: "high",
    },
    add(map) {
      addSourceSafe(map, "fires", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("fires-heat")) {
        map.addLayer({
          id: "fires-heat",
          type: "heatmap",
          source: "fires",
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "frp"],
              0,
              0,
              100,
              1,
            ],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              0.6,
              9,
              2.2,
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              3,
              2,
              7,
              10,
              10,
              22,
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,0,0)",
              0.2,
              "rgba(255,194,75,0.25)",
              0.45,
              "rgba(255,158,44,0.5)",
              0.7,
              "rgba(255,107,26,0.75)",
              1,
              "rgba(240,68,56,0.95)",
            ],
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "fires-heat");
      removeSourceIfUnused(map, "fires");
    },
  },

  {
    id: "fire-hazard",
    group: "fire",
    mapLayerIds: ["fire-hazard"],
    label: "Fire hazard (rawan karhutla)",
    description:
      "Official forest & land fire hazard classes — BIG SatuPeta. Where fire was already expected, versus where it is a surprise. Large layer; loads on demand.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.6,
    legend: [
      { color: "#fca5a5", label: "rendah" },
      { color: "#f87171", label: "sedang" },
      { color: "#dc2626", label: "tinggi" },
    ],
    add(map) {
      addSourceSafe(map, "fire-hazard", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("fire-hazard")) {
        map.addLayer({
          id: "fire-hazard",
          type: "fill",
          source: "fire-hazard",
          paint: {
            "fill-color": [
              "match",
              ["downcase", ["coalesce", ["get", "kelas"], ""]],
              "tinggi",
              "#dc2626",
              "sangat tinggi",
              "#991b1b",
              "sedang",
              "#f87171",
              "rendah",
              "#fca5a5",
              "#94a3b8",
            ],
            "fill-opacity": 0.35,
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "fire-hazard");
      removeSourceIfUnused(map, "fire-hazard");
    },
  },

  // -------------------------------------------------------------- haze ---
  {
    id: "haze-aod",
    group: "haze",
    label: "Aerosol Optical Depth",
    description: "MODIS Aqua AOD — NASA GIBS (keyless WMTS), latest.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.7,
    gradientLegend: {
      css: "linear-gradient(90deg, #2c7fb8, #f0c419, #d73a2e)",
      min: "AOD 0",
      max: "AOD 1+",
    },
    add(map) {
      addSourceSafe(map, "gibs-aod", {
        type: "raster",
        tiles: [
          `${GIBS_WMTS}/MODIS_Aqua_Aerosol/default/default/GoogleMapsCompatible_Level6/{z}/{y}/{x}.png`,
        ],
        tileSize: 256,
        maxzoom: 6,
        attribution: "NASA GIBS / MODIS Aqua",
      });
      if (!map.getLayer("haze-aod")) {
        map.addLayer({
          id: "haze-aod",
          type: "raster",
          source: "gibs-aod",
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "haze-aod");
      removeSourceIfUnused(map, "gibs-aod");
    },
  },
  {
    id: "haze-smoke",
    group: "haze",
    label: "True-color smoke",
    description: "MODIS Terra corrected reflectance — NASA GIBS, latest.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.65,
    add(map) {
      addSourceSafe(map, "gibs-smoke", {
        type: "raster",
        tiles: [
          `${GIBS_WMTS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/default/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png`,
        ],
        tileSize: 256,
        maxzoom: 9,
        attribution: "NASA GIBS / MODIS Terra",
      });
      if (!map.getLayer("haze-smoke")) {
        map.addLayer({
          id: "haze-smoke",
          type: "raster",
          source: "gibs-smoke",
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "haze-smoke");
      removeSourceIfUnused(map, "gibs-smoke");
    },
  },

  camsImageLayer({
    id: "haze-cams-smoke",
    label: "CAMS smoke (biomass burning AOD)",
    description:
      "Aerosol from burning vegetation only — the haze plume itself, separated from dust and sea salt. 3-hourly, with forecast. Scrub the timeline to animate.",
    entry: CAMS_LAYERS.bbaod,
    defaultVisible: false,
    gradientLegend: {
      css: "linear-gradient(90deg, rgba(255,255,255,0), #ffe08a, #f59e0b, #b91c1c, #6b21a8)",
      min: "clear",
      max: "dense smoke",
    },
  }),
  camsImageLayer({
    id: "haze-cams-pm25",
    label: "CAMS surface PM2.5",
    description:
      "Ground-level fine particulate — what people actually breathe. Same 3-hourly timeline and forecast.",
    entry: CAMS_LAYERS.pm25,
    defaultVisible: false,
    gradientLegend: {
      css: "linear-gradient(90deg, #4ade80, #facc15, #f97316, #dc2626, #7f1d1d)",
      min: "good",
      max: "hazardous",
    },
  }),

  // -------------------------------------------------------- population ---
  {
    id: "population",
    group: "population",
    label: "Population (Kontur H3)",
    description: "Modeled population per H3 hexagon — Kontur, PMTiles.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.75,
    gradientLegend: {
      css: "linear-gradient(90deg, #3a2568, #6d28d9, #a855f7, #e879f9, #fbbf24)",
      min: "sparse",
      max: "dense",
    },
    add(map) {
      addSourceSafe(map, "population", {
        type: "vector",
        url: POPULATION_PMTILES_URL,
      });
      if (!map.getLayer("population")) {
        map.addLayer({
          id: "population",
          type: "fill",
          source: "population",
          "source-layer": "population",
          paint: {
            "fill-color": [
              "step",
              ["get", "population"],
              "rgba(0,0,0,0)",
              1,
              "#3a2568",
              50,
              "#6d28d9",
              200,
              "#a855f7",
              1000,
              "#e879f9",
              5000,
              "#fbbf24",
            ],
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "population");
      removeSourceIfUnused(map, "population");
    },
  },

  // -------------------------------------------------------- boundaries ---
  {
    id: "boundaries-kecamatan",
    group: "boundaries",
    label: "Kecamatan",
    description: "Sub-district boundaries (628 in Kalimantan).",
    layerType: "line",
    defaultVisible: false,
    defaultOpacity: 0.5,
    add(map) {
      addSourceSafe(map, "boundaries", {
        type: "vector",
        url: BOUNDARIES_PMTILES_URL,
      });
      if (!map.getLayer("boundaries-kecamatan")) {
        map.addLayer({
          id: "boundaries-kecamatan",
          type: "line",
          source: "boundaries",
          "source-layer": "boundaries",
          filter: ["==", ["get", "level"], "kecamatan"],
          minzoom: 7,
          paint: {
            "line-color": "#6d8296",
            "line-width": 0.6,
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "boundaries-kecamatan");
      removeSourceIfUnused(map, "boundaries");
    },
  },
  {
    id: "boundaries-kabkota",
    group: "boundaries",
    label: "Kabupaten/Kota",
    description: "Regency/city boundaries (56 in Kalimantan).",
    layerType: "line",
    defaultVisible: true,
    defaultOpacity: 0.65,
    add(map) {
      addSourceSafe(map, "boundaries", {
        type: "vector",
        url: BOUNDARIES_PMTILES_URL,
      });
      if (!map.getLayer("boundaries-kabkota")) {
        map.addLayer({
          id: "boundaries-kabkota",
          type: "line",
          source: "boundaries",
          "source-layer": "boundaries",
          filter: ["==", ["get", "level"], "kab_kota"],
          paint: {
            "line-color": "#9fb2c4",
            "line-width": 1.1,
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "boundaries-kabkota");
      removeSourceIfUnused(map, "boundaries");
    },
  },
  {
    id: "boundaries-provinsi",
    group: "boundaries",
    label: "Provinsi",
    description: "Provincial boundaries (5 Kalimantan provinces).",
    layerType: "line",
    defaultVisible: true,
    defaultOpacity: 0.9,
    add(map) {
      addSourceSafe(map, "boundaries", {
        type: "vector",
        url: BOUNDARIES_PMTILES_URL,
      });
      if (!map.getLayer("boundaries-provinsi")) {
        map.addLayer({
          id: "boundaries-provinsi",
          type: "line",
          source: "boundaries",
          "source-layer": "boundaries",
          filter: ["==", ["get", "level"], "provinsi"],
          paint: {
            "line-color": "#e8edf2",
            "line-width": 1.6,
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "boundaries-provinsi");
      removeSourceIfUnused(map, "boundaries");
    },
  },

  // ---------------------------------------------------------- peatland ---
  {
    id: "peat-extent",
    group: "peatland",
    mapLayerIds: ["peat-extent", "peat-extent-line"],
    label: "Lahan gambut (peat soil)",
    description:
      "Official peat soil extent — BIG SatuPeta. 45,000 km² across Kalimantan. Peat fires burn underground, resist rain, and produce most of the haze.",
    layerType: "fill",
    defaultVisible: true,
    defaultOpacity: 0.9,
    legend: [{ color: "#8b5cf6", label: "peat soil" }],
    add(map) {
      addSourceSafe(map, "peat-extent", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("peat-extent")) {
        map.addLayer({
          id: "peat-extent",
          type: "fill",
          source: "peat-extent",
          paint: { "fill-color": "#8b5cf6", "fill-opacity": 0.25 },
        });
      }
      if (!map.getLayer("peat-extent-line")) {
        map.addLayer({
          id: "peat-extent-line",
          type: "line",
          source: "peat-extent",
          paint: { "line-color": "#a78bfa", "line-width": 0.6 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "peat-extent-line");
      removeLayerSafe(map, "peat-extent");
      removeSourceIfUnused(map, "peat-extent");
    },
    setOpacity(map, slider) {
      if (map.getLayer("peat-extent")) {
        map.setPaintProperty("peat-extent", "fill-opacity", 0.25 * slider);
      }
      if (map.getLayer("peat-extent-line")) {
        map.setPaintProperty(
          "peat-extent-line",
          "line-opacity",
          Math.min(1, 0.7 * slider),
        );
      }
    },
  },
  {
    id: "peat-khg",
    group: "peatland",
    mapLayerIds: ["peat-khg", "peat-khg-line"],
    label: "KHG (kesatuan hidrologis gambut)",
    description:
      "Peat hydrological units — the unit Indonesian peat policy is written in. Note: BIG publishes only part of the national set (78 of 101 Kalimantan units are in Kalbar), so do not read extent from it.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.9,
    legend: [{ color: "#3ddc97", label: "KHG unit" }],
    add(map) {
      addSourceSafe(map, "khg", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("peat-khg")) {
        map.addLayer({
          id: "peat-khg",
          type: "fill",
          source: "khg",
          paint: { "fill-color": "#3ddc97", "fill-opacity": 0.14 },
        });
      }
      if (!map.getLayer("peat-khg-line")) {
        map.addLayer({
          id: "peat-khg-line",
          type: "line",
          source: "khg",
          paint: { "line-color": "#3ddc97", "line-width": 0.9 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "peat-khg-line");
      removeLayerSafe(map, "peat-khg");
      removeSourceIfUnused(map, "khg");
    },
    setOpacity(map, slider) {
      if (map.getLayer("peat-khg")) {
        map.setPaintProperty("peat-khg", "fill-opacity", 0.14 * slider);
      }
      if (map.getLayer("peat-khg-line")) {
        map.setPaintProperty(
          "peat-khg-line",
          "line-opacity",
          Math.min(1, 0.9 * slider),
        );
      }
    },
  },
  {
    id: "peat-function",
    group: "peatland",
    mapLayerIds: ["peat-function", "peat-function-line"],
    label: "Fungsi ekosistem gambut",
    description:
      "Peat depth and legal function — lindung (>3 m) may not be cleared, budidaya (<3 m) may. Deeper peat burns longer. Same partial coverage as KHG, so use it to inspect places, not to total them.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.9,
    legend: [
      { color: "#0ea5e9", label: "lindung (>3 m)" },
      { color: "#7dd3fc", label: "budidaya (<3 m)" },
    ],
    add(map) {
      addSourceSafe(map, "peat-function", { type: "geojson", data: EMPTY_FC });
      const byFunction: [string, string, string] = [
        "#0ea5e9",
        "#7dd3fc",
        "#64748b",
      ];
      if (!map.getLayer("peat-function")) {
        map.addLayer({
          id: "peat-function",
          type: "fill",
          source: "peat-function",
          paint: {
            "fill-color": [
              "case",
              ["==", ["index-of", "Lindung", ["get", "feg_peat"]], -1],
              byFunction[1],
              byFunction[0],
            ],
            "fill-opacity": 0.3,
          },
        });
      }
      if (!map.getLayer("peat-function-line")) {
        map.addLayer({
          id: "peat-function-line",
          type: "line",
          source: "peat-function",
          minzoom: 8,
          paint: { "line-color": "#38bdf8", "line-width": 0.4 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "peat-function-line");
      removeLayerSafe(map, "peat-function");
      removeSourceIfUnused(map, "peat-function");
    },
    setOpacity(map, slider) {
      if (map.getLayer("peat-function")) {
        map.setPaintProperty("peat-function", "fill-opacity", 0.3 * slider);
      }
      if (map.getLayer("peat-function-line")) {
        map.setPaintProperty(
          "peat-function-line",
          "line-opacity",
          Math.min(1, 0.6 * slider),
        );
      }
    },
  },

  // ------------------------------------------------------- concessions ---
  gfwPolygonLayer({
    id: "conc-oil-palm",
    group: "concessions",
    label: "Oil palm concessions",
    description:
      "Mapped oil palm concession boundaries (batas perkebunan sawit) — GFW. Fires clustered inside a concession point to land clearing rather than wildfire.",
    entry: GFW_DATASETS.oilPalm,
    color: "#f472b6",
    nameField: "conc_name",
    subField: "company",
  }),
  gfwPolygonLayer({
    id: "conc-rspo",
    group: "concessions",
    label: "RSPO oil palm mills",
    description:
      "RSPO-certified oil palm concessions. Burning inside a certified area is a compliance signal, not just an environmental one.",
    entry: GFW_DATASETS.rspoOilPalm,
    color: "#fb7185",
    nameField: "company",
    subField: "comp_group",
  }),
  gfwPolygonLayer({
    id: "conc-wood-fiber",
    group: "concessions",
    label: "Pulpwood (HTI)",
    description:
      "Wood fiber / industrial timber plantation concessions — often drained peat, which is exactly what burns.",
    entry: GFW_DATASETS.woodFiber,
    color: "#a78bfa",
    nameField: "conc_name",
    subField: "company",
  }),
  gfwPolygonLayer({
    id: "conc-logging",
    group: "concessions",
    label: "Logging (HPH)",
    description:
      "Selective logging concessions. Drainage canals and skid trails dry the forest floor and carry fire inland.",
    entry: GFW_DATASETS.logging,
    color: "#60a5fa",
    nameField: "name",
    subField: "company",
  }),
  gfwPolygonLayer({
    id: "conc-mining",
    group: "concessions",
    label: "Mining concessions",
    description: "Mining concession boundaries — GFW.",
    entry: GFW_DATASETS.mining,
    color: "#94a3b8",
    nameField: "conc_name",
    subField: "mineral",
  }),

  // -------------------------------------------------------- protection ---
  gfwPolygonLayer({
    id: "prot-moratorium",
    group: "protection",
    label: "Moratorium (PIPPIB)",
    description:
      "Indonesia's primary forest & peatland moratorium areas. New concessions are barred here, so fires inside are a governance red flag.",
    entry: GFW_DATASETS.moratorium,
    color: "#22d3ee",
    nameField: "pippib_en",
  }),
  gfwPolygonLayer({
    id: "prot-forest-area",
    group: "protection",
    label: "Kawasan hutan",
    description:
      "Official forest estate classes (produksi / lindung / konservasi) — legal land status behind each fire.",
    entry: GFW_DATASETS.forestArea,
    color: "#34d399",
    fillAlpha: 0.14,
    fillColor: [
      "match",
      ["get", "class"],
      "Protected Forest",
      "#2dd4bf",
      "Limited Production Forest",
      "#84cc16",
      "Permanent Production Forest",
      "#a3e635",
      "Convertible Production Forest",
      "#facc15",
      "Nature Reserve and Nature Conservation Area",
      "#34d399",
      "#64748b",
    ],
    legend: [
      { color: "#2dd4bf", label: "lindung" },
      { color: "#34d399", label: "konservasi" },
      { color: "#a3e635", label: "produksi" },
      { color: "#facc15", label: "konversi" },
    ],
    nameField: "namobj",
    subField: "desc_en",
  }),
  gfwPolygonLayer({
    id: "prot-wdpa",
    group: "protection",
    label: "Protected areas (WDPA)",
    description:
      "National parks and reserves. Fire inside a protected area is the highest-severity case for biodiversity.",
    entry: GFW_DATASETS.protectedAreas,
    color: "#4ade80",
    nameField: "name",
    subField: "desig_eng",
  }),
];
