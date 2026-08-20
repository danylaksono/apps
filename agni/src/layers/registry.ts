/** Config-driven layer registry. Every overlay layer is a descriptor here;
 *  the Zustand store keys state by descriptor id, and MapView syncs
 *  sources/layers imperatively. Adding a layer = appending a descriptor. */

import type {
  ExpressionSpecification,
  Map as MaplibreMap,
} from "maplibre-gl";
import type { FeatureCollection } from "geojson";
import { rasterDayOffset } from "../lib/rasterDate";
import {
  BOUNDARIES_PMTILES_URL,
  CAMS_LAYERS,
  GFW_DATASETS,
  GFW_TREE_COVER_LOSS_VERSION,
  GIBS_LAYERS,
} from "../lib/config";
import { gfwLossTileUrl } from "../lib/gfwRaster";
import { gibsDateAt, gibsTiles } from "../lib/gibs";
import { clmsBurntAreaTiles } from "../lib/clms";
import { FRP_COLORS, FRP_LABELS } from "../lib/fireGlyph";
import {
  GLYPH_LAYER,
  GLYPH_SOURCE,
  clusterProperties,
  setGlyphScale,
} from "./glyphs";
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
  layerType: "circle" | "raster" | "fill" | "line";
  defaultVisible: boolean;
  defaultOpacity: number;
  /** base paint opacity multiplied by the slider value (default 1) */
  baseOpacity?: number;
  /** What the layer's single slider actually controls. Defaults to opacity;
   *  set it where the slider drives something else, so the panel can say so. */
  sliderLabel?: string;
  legend?: LegendItem[];
  gradientLegend?: { css: string; min: string; max: string };
  /** Alternative ways of drawing the same layer, offered as a small segmented
   *  control in the panel. The first is the default. */
  modes?: { value: string; label: string }[];
  /** every map layer this descriptor creates, bottom-first; defaults to [id].
   *  Used to enforce render order independently of toggle order. */
  mapLayerIds?: string[];
  /** higher = drawn on top. Defaults to GROUP_RANK[group]. */
  renderRank?: number;
  add(map: MaplibreMap): void;
  remove(map: MaplibreMap): void;
  /** override for multi-layer descriptors; default uses layerType mapping */
  setOpacity?(map: MaplibreMap, slider: number): void;
  /** called whenever the selected `modes` value changes, for layers that
   *  switch appearance rather than data */
  applyMode?(map: MaplibreMap, mode: string): void;
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

/** CLMS publishes to today with a short processing lag, and unlike GIBS it
 *  offers nothing to probe for the newest populated day — so this counts back
 *  from today and lets the slider find the imagery. */
export function burntAreaDate(daysBack: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
}

/** Confidence colour, shared by the dot and by the glow beneath it. */
const FIRE_COLOR = [
  "match",
  ["get", "confidence"],
  "h",
  "#f04438",
  "n",
  "#ff9e2c",
  "l",
  "#ffc24b",
  "#ff9e2c",
] as unknown as ExpressionSpecification;

/** Detection radius from FRP, scaled. The glow passes reuse it so a fiercer
 *  fire glows wider rather than every detection blooming the same amount —
 *  which is what separates this from a decorative wash. */
function fireRadius(scale: number): ExpressionSpecification {
  return [
    "interpolate",
    ["linear"],
    ["get", "frp"],
    0,
    2 * scale,
    20,
    4 * scale,
    100,
    7 * scale,
    400,
    11 * scale,
  ] as unknown as ExpressionSpecification;
}

/** The two blurred passes under the core, outermost first. */
const FIRE_GLOW = [
  { id: "fires-glow-outer", scale: 4.5, opacity: 0.22 },
  { id: "fires-glow-inner", scale: 2.2, opacity: 0.34 },
];

export const LAYERS: LayerDescriptor[] = [
  // -------------------------------------------------------------- fire ---
  {
    id: "fires",
    group: "fire",
    label: "Active fires",
    description:
      "VIIRS SNPP near real-time detections, clipped to Indonesia. Five days are loaded; the Fire filters below decide how much of that is drawn. Source: NASA FIRMS.",
    layerType: "circle",
    defaultVisible: true,
    defaultOpacity: 0.9,
    modes: [
      { value: "dots", label: "Dots" },
      { value: "firefly", label: "Firefly" },
    ],
    legend: [
      { color: "#ffc24b", label: "low confidence" },
      { color: "#ff9e2c", label: "nominal" },
      { color: "#f04438", label: "high confidence" },
    ],
    // bottom-first, so the two glow passes stay under the core
    mapLayerIds: ["fires-glow-outer", "fires-glow-inner", "fires"],
    add(map) {
      addSourceSafe(map, "fires", { type: "geojson", data: EMPTY_FC });
      // Two blurred passes beneath a hard core — the firefly stack. They are
      // always present and switched by `visibility`, because adding and
      // removing three layers on every mode change would re-trigger the whole
      // filter and ordering pass for a purely visual switch.
      for (const g of FIRE_GLOW) {
        if (map.getLayer(g.id)) continue;
        map.addLayer({
          id: g.id,
          type: "circle",
          source: "fires",
          layout: { visibility: "none" },
          paint: {
            "circle-color": FIRE_COLOR,
            "circle-radius": fireRadius(g.scale),
            "circle-blur": 3,
            "circle-opacity": g.opacity,
          },
        });
      }
      if (!map.getLayer("fires")) {
        map.addLayer({
          id: "fires",
          type: "circle",
          source: "fires",
          paint: {
            "circle-color": FIRE_COLOR,
            "circle-radius": fireRadius(1),
            "circle-stroke-color": "rgba(255,255,255,0.35)",
            "circle-stroke-width": 0.8,
          },
        });
      }
    },
    applyMode(map, mode) {
      const firefly = mode === "firefly";
      for (const g of FIRE_GLOW) {
        if (map.getLayer(g.id)) {
          map.setLayoutProperty(
            g.id,
            "visibility",
            firefly ? "visible" : "none",
          );
        }
      }
      if (!map.getLayer("fires")) return;
      // In firefly the core is the white-hot centre of the glow; the halo
      // beneath it carries the confidence colour, so the encoding survives.
      map.setPaintProperty(
        "fires",
        "circle-color",
        firefly ? "#ffffff" : FIRE_COLOR,
      );
      map.setPaintProperty("fires", "circle-radius", fireRadius(firefly ? 0.45 : 1));
      map.setPaintProperty("fires", "circle-stroke-width", firefly ? 0 : 0.8);
    },
    setOpacity(map, slider) {
      if (map.getLayer("fires")) {
        map.setPaintProperty("fires", "circle-opacity", slider);
      }
      for (const g of FIRE_GLOW) {
        if (map.getLayer(g.id)) {
          map.setPaintProperty(g.id, "circle-opacity", g.opacity * slider);
        }
      }
    },
    remove(map) {
      for (const g of FIRE_GLOW) removeLayerSafe(map, g.id);
      removeLayerSafe(map, "fires");
      removeSourceIfUnused(map, "fires");
    },
  },
  {
    id: "fire-glyphs",
    group: "fire",
    label: "Fire glyphs",
    description:
      "Detections aggregated into donut glyphs: the ring splits each group by fire radiative power, the inner arc is the share seen on the night overpass, and the number is how many. Click one for its breakdown and timing.",
    layerType: "circle",
    defaultVisible: false,
    // mid-slider is 1:1 — the slider is size for this layer, see setOpacity
    defaultOpacity: 0.25,
    sliderLabel: "Size",
    modes: [
      { value: "cluster", label: "Clusters" },
      { value: "province", label: "Provinces" },
    ],
    legend: FRP_COLORS.map((color, i) => ({ color, label: FRP_LABELS[i] })),
    add(map) {
      // The source carries pre-filtered data — clustering happens below the
      // style, so a layer filter would not reach it. See applyMapState.
      addSourceSafe(map, GLYPH_SOURCE, {
        type: "geojson",
        data: EMPTY_FC,
        cluster: true,
        clusterRadius: 70,
        clusterMaxZoom: 14,
        clusterProperties: clusterProperties(),
      });
      // An invisible anchor layer: the glyphs themselves are DOM markers, but
      // MapLibre only keeps a source loaded while some layer references it,
      // and querySourceFeatures needs it loaded.
      if (!map.getLayer(GLYPH_LAYER)) {
        map.addLayer({
          id: GLYPH_LAYER,
          type: "circle",
          source: GLYPH_SOURCE,
          filter: ["==", ["get", "cluster"], true],
          paint: { "circle-radius": 1, "circle-opacity": 0 },
        });
      }
    },
    setOpacity(map, slider) {
      // The slider is size here, not opacity: 0 -> 0.6x, 1 -> 2.2x.
      setGlyphScale(0.6 + slider * 1.6);
      // And the anchor layer stays invisible. The default opacity path would
      // write circle-opacity onto it — it is a 1 px circle that exists only to
      // keep the source loaded, and was being turned on at full opacity,
      // drawing a stray dot at every cluster.
      if (map.getLayer(GLYPH_LAYER)) {
        map.setPaintProperty(GLYPH_LAYER, "circle-opacity", 0);
      }
    },
    remove(map) {
      removeLayerSafe(map, GLYPH_LAYER);
      removeSourceIfUnused(map, GLYPH_SOURCE);
    },
  },
  {
    id: "burnt-area",
    group: "fire",
    label: "Burnt area (Copernicus 300 m)",
    description:
      "Burned fraction for a single day, from Sentinel-3 and VIIRS. Source: Copernicus Land Monitoring Service.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.9,
    gradientLegend: {
      css: "linear-gradient(90deg, #fecf92, #f7705c, #b63679, #641a80, #241257)",
      min: "low burned fraction",
      max: "high",
    },
    add(map) {
      const date = burntAreaDate(rasterDayOffset());
      addSourceSafe(map, "burnt-area", {
        type: "raster",
        tiles: [clmsBurntAreaTiles(date)],
        tileSize: 256,
        maxzoom: 12,
        attribution: "Copernicus Land Monitoring Service",
      });
      if (!map.getLayer("burnt-area")) {
        map.addLayer({
          id: "burnt-area",
          type: "raster",
          source: "burnt-area",
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "burnt-area");
      removeSourceIfUnused(map, "burnt-area");
    },
  },

  // -------------------------------------------------------------- haze ---
  {
    id: "haze-aod",
    group: "haze",
    label: "Aerosol Optical Depth",
    description:
      "MODIS Aqua aerosol optical depth for the most recent day with imagery. Satellite-observed total column, so it includes dust and sea salt as well as smoke. Source: NASA GIBS.",
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
      const date = gibsDateAt(GIBS_LAYERS.aod, rasterDayOffset());
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
      "MODIS Terra corrected reflectance for the most recent day with imagery, i.e. smoke as the eye would see it. Source: NASA GIBS.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.65,
    add(map) {
      const date = gibsDateAt(GIBS_LAYERS.trueColor, rasterDayOffset());
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

  {
    id: "night-lights",
    group: "haze",
    label: "Night lights (Black Marble)",
    description:
      "VIIRS Black Marble 2016 composite: settlements, roads and gas flares as points of light. Context for who is downwind, and a check on whether a hotspot sits near infrastructure. Source: NASA GIBS.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.55,
    add(map) {
      const date = gibsDateAt(GIBS_LAYERS.nightLights, 0);
      if (!date) return;
      addSourceSafe(map, "gibs-night", {
        type: "raster",
        tiles: [gibsTiles(GIBS_LAYERS.nightLights, date)],
        tileSize: 256,
        maxzoom: GIBS_LAYERS.nightLights.maxzoom,
        attribution: "NASA GIBS / VIIRS Black Marble",
      });
      if (!map.getLayer("night-lights")) {
        map.addLayer({
          id: "night-lights",
          type: "raster",
          source: "gibs-night",
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "night-lights");
      removeSourceIfUnused(map, "gibs-night");
    },
  },

  // -------------------------------------------------------- population ---
  {
    id: "population",
    group: "population",
    label: "Population (Kontur H3)",
    description:
      "Modelled population density per H3 hexagon, aggregated to a resolution that suits the zoom. Source: Kontur / Facebook Data for Good.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.75,
    // Density rather than headcount, so the ramp means the same thing at every
    // zoom — an aggregated res-5 cell holds ~343x the people of a res-8 one.
    // One hue, dark to light. The old ramp ran purple → magenta → yellow, which
    // is a rainbow on a magnitude scale, and its violet was indistinguishable
    // from the peat layer sitting under it. Teal is unused elsewhere on the map.
    gradientLegend: {
      css: "linear-gradient(90deg, #134e4a, #0f766e, #14b8a6, #5eead4, #ccfbf1)",
      min: "10 /km²",
      max: "5,000+",
    },
    add(map) {
      // Fed by lib/population.ts on every moveend rather than by a tile
      // source: nationally this is 874,919 hexagons, which is ~113 MB tiled
      // but 3.9 MB as a geometry-free Parquet.
      addSourceSafe(map, "population", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("population")) {
        map.addLayer({
          id: "population",
          type: "fill",
          source: "population",
          paint: {
            "fill-color": [
              "step",
              ["get", "density"],
              "rgba(0,0,0,0)",
              10,
              "#134e4a",
              100,
              "#0f766e",
              500,
              "#14b8a6",
              2000,
              "#5eead4",
              5000,
              "#ccfbf1",
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

  {
    id: "tree-cover-loss",
    group: "concessions",
    label: "Tree cover loss (2001–2025)",
    description:
      "Annual forest loss from UMD/Hansen, brightest for the most recent seasons. Cleared land is where burning tends to follow, so this is the backstory to a hotspot rather than a snapshot of it. Source: GFW, decoded in the browser.",
    layerType: "raster",
    defaultVisible: false,
    defaultOpacity: 0.7,
    gradientLegend: {
      css: "linear-gradient(90deg, #365314, #4d7c0f, #84cc16, #bef264)",
      min: "2001",
      max: "2022+",
    },
    add(map) {
      addSourceSafe(map, "tree-cover-loss", {
        type: "raster",
        tiles: [gfwLossTileUrl(GFW_TREE_COVER_LOSS_VERSION)],
        tileSize: 256,
        maxzoom: 12,
        attribution: "Hansen/UMD/Google/USGS/NASA via GFW",
      });
      if (!map.getLayer("tree-cover-loss")) {
        map.addLayer({
          id: "tree-cover-loss",
          type: "raster",
          source: "tree-cover-loss",
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "tree-cover-loss");
      removeSourceIfUnused(map, "tree-cover-loss");
    },
  },

  // -------------------------------------------------------- boundaries ---
  {
    id: "boundaries-kecamatan",
    group: "boundaries",
    label: "Kecamatan",
    description: "Sub-district boundaries (7,275 nationally).",
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
    description: "Regency/city boundaries (514 nationally).",
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
    description: "Provincial boundaries (38 provinces).",
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
      "Official peat soil extent from BIG SatuPeta. Peat fires burn below the surface, resist rainfall, and account for most haze emissions. Only Kalimantan on this service (146 polygons, 45,000 km²)is available.",
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
      "Peat hydrological units (KHG), the unit in which Indonesian peat policy is written. Only part of the national set (mostly in Kalbar) is published, so extent should not be read from this layer.",
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
