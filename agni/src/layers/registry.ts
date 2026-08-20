/** Config-driven layer registry. Every overlay layer is a descriptor here;
 *  the Zustand store keys state by descriptor id, and MapView syncs
 *  sources/layers imperatively. Adding a layer = appending a descriptor. */

import type { Map as MaplibreMap } from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import {
  BOUNDARIES_PMTILES_URL,
  CAMS_LAYERS,
  GFW_DATASETS,
  GIBS_LAYERS,
  POPULATION_PMTILES_URL,
} from "../lib/config";
import { gibsDate, gibsTiles } from "../lib/gibs";
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
    description:
      "VIIRS SNPP near real-time detections from the last 48 hours, clipped to Kalimantan. Source: NASA FIRMS.",
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
    description:
      "FRP-weighted density surface derived from FIRMS detection points.",
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
      "Official forest and land fire hazard classes from BIG SatuPeta, showing where fire is expected under baseline conditions. Large layer; loads on demand.",
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
    description:
      "MODIS Aqua aerosol optical depth for the most recent day with imagery. Satellite-observed total column, so it includes dust and sea salt as well as smoke. Source: NASA GIBS (keyless WMTS).",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.7,
    // Sampled from GIBS' own colormap (colormaps/v1.3/MODIS_VIIRS_AOD.xml) at
    // the AOD values the stops sit on, so the bar is the palette the tiles are
    // actually drawn with rather than an invented blue-to-red ramp. Its fine
    // steps stop around 0.75; everything above that is the same dark red.
    gradientLegend: {
      css: "linear-gradient(90deg, #fffcc7 0%, #ffde6a 17%, #ffad35 33%, #ff701e 50%, #f52810 67%, #c7030d 83%, #9b000e 100%)",
      min: "AOD 0",
      max: "0.75+",
    },
    add(map) {
      // No date resolved yet: MapView's sync pass starts the probe, and the
      // store change it settles with brings the applier back here to finish.
      const date = gibsDate(GIBS_LAYERS.aod);
      if (!date) return;
      addSourceSafe(map, "gibs-aod", {
        type: "raster",
        tiles: [gibsTiles(GIBS_LAYERS.aod, date)],
        tileSize: 256,
        maxzoom: GIBS_LAYERS.aod.maxzoom,
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
    description:
      "MODIS Terra corrected reflectance for the most recent day with imagery — smoke as the eye would see it. Source: NASA GIBS.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.65,
    add(map) {
      const date = gibsDate(GIBS_LAYERS.trueColor);
      if (!date) return;
      addSourceSafe(map, "gibs-smoke", {
        type: "raster",
        tiles: [gibsTiles(GIBS_LAYERS.trueColor, date)],
        tileSize: 256,
        maxzoom: GIBS_LAYERS.trueColor.maxzoom,
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

  // The two gradients below are the WMS styles' own band colours and alphas
  // (PM2.5's already spun through `hueRotate`), so the legend swatch matches
  // what the map actually draws rather than approximating it.
  camsImageLayer({
    id: "haze-cams-smoke",
    label: "CAMS smoke (biomass burning AOD)",
    description:
      "Biomass-burning aerosol optical depth, isolating the haze plume from dust and sea salt. 3-hourly, with forecast. Use the timeline to animate.",
    entry: CAMS_LAYERS.bbaod,
    defaultVisible: false,
    gradientLegend: {
      css: "linear-gradient(90deg, rgba(255,236,246,0.05), rgba(254,206,230,0.15), rgba(252,161,206,0.4), rgba(224,2,138,0.65), rgba(109,0,74,1))",
      min: "AOD 0.1",
      max: "1+",
    },
  }),
  camsImageLayer({
    id: "haze-cams-pm25",
    label: "CAMS surface PM2.5",
    description:
      "Ground-level fine particulate matter (PM2.5), on the same 3-hourly timeline and forecast. The WHO 24-hour guideline is 15 µg/m³; Indonesia's ISPU “berbahaya” band starts around 250.",
    entry: CAMS_LAYERS.pm25,
    defaultVisible: false,
    gradientLegend: {
      css: "linear-gradient(90deg, rgba(238,194,248,0.14), rgba(218,135,238,0.29), rgba(192,73,234,0.43), rgba(162,16,223,0.57), rgba(125,0,202,0.71), rgba(91,0,156,0.86), rgba(64,0,116,1))",
      min: "30 µg/m³",
      max: "240+",
    },
  }),

  // -------------------------------------------------------- population ---
  {
    id: "population",
    group: "population",
    label: "Population (Kontur H3)",
    description:
      "Modeled population per H3 hexagon. Source: Kontur, served as PMTiles.",
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
      "Official peat soil extent from BIG SatuPeta, covering 45,000 km² across Kalimantan. Peat fires burn below the surface, resist rainfall, and account for most haze emissions.",
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
      "Peat hydrological units (KHG), the unit in which Indonesian peat policy is written. BIG publishes only part of the national set (78 of 101 Kalimantan units fall in Kalbar), so extent should not be read from this layer.",
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
      "Peat depth and legal function: lindung (>3 m) may not be cleared, budidaya (<3 m) may. Deeper peat burns longer. Coverage is partial, as with KHG, so use the layer to inspect individual sites rather than to compute totals.",
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
      "Mapped oil palm concession boundaries (batas perkebunan sawit) from GFW. Fires clustered inside a concession indicate land clearing rather than wildfire.",
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
      "RSPO-certified oil palm concessions. Burning inside a certified area carries compliance implications in addition to environmental ones.",
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
      "Wood fiber and industrial timber plantation concessions, frequently sited on drained peat.",
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
    description: "Mining concession boundaries. Source: GFW.",
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
      "Indonesia's primary forest and peatland moratorium areas. New concessions are barred here, so fires inside them warrant scrutiny.",
    entry: GFW_DATASETS.moratorium,
    color: "#22d3ee",
    nameField: "pippib_en",
  }),
  gfwPolygonLayer({
    id: "prot-forest-area",
    group: "protection",
    label: "Kawasan hutan",
    description:
      "Official forest estate classes (produksi, lindung, konservasi), giving the legal land status underlying each fire.",
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
      "National parks and reserves. Fire inside a protected area carries the greatest biodiversity impact.",
    entry: GFW_DATASETS.protectedAreas,
    color: "#4ade80",
    nameField: "name",
    subField: "desig_eng",
  }),
];
