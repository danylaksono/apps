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
import { FOREST_CLASSES, forestFillColor } from "../lib/forest";
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
  | "forest"
  | "concessions"
  | "protection"
  | "custom";

export interface LegendItem {
  /** solid colour swatch; omitted when `swatch` carries an image instead */
  color?: string;
  /** data: URI for a server-supplied swatch — see lib/arcgis.ts */
  swatch?: string;
  label: string;
}

/** Provenance for one layer, shown behind the (i) in the panel.
 *
 *  Only `source` and `api` are required — every layer can say who published it
 *  and how the app reaches it. The rest are filled where there is something
 *  true to say; a field left out simply does not render, which is better than a
 *  row reading "unknown". The data lives in layers/datasetInfo.ts rather than
 *  inline here, so provenance can be read and audited as one table instead of
 *  being scattered through 1,200 lines of map plumbing. */
export interface LayerInfo {
  /** Publisher and dataset, named the way the publisher names it. */
  source: string;
  /** Native spatial resolution, or the unit the data is actually mapped in. */
  resolution?: string;
  /** Refresh cadence, or the vintage if it is a fixed snapshot. */
  updated?: string;
  /** Spatial extent — worth stating wherever it is not the whole country. */
  coverage?: string;
  /** How the app fetches it, in prose: protocol, keying, paging, caps. */
  api: string;
  /** The request the app actually makes, with the parts that vary left as
   *  `{placeholders}`. Rendered verbatim and monospaced so it can be copied
   *  and run — which is the point, and also why it is never a link: several of
   *  these are tile templates, one downloads 3.9 MB, and the FIRMS key is
   *  redacted out of it. Use `link` for something a human should open. */
  endpoint?: string;
  /** What arrives on the wire, and anything done to it in the browser. */
  format?: string;
  /** What to know before drawing a conclusion from this layer. */
  caveat?: string;
  /** The authoritative page for the dataset. */
  link?: string;
}

export interface LayerDescriptor {
  id: string;
  group: LayerGroup;
  label: string;
  description: string;
  /** Provenance for the panel's (i). Built-in layers leave this unset and are
   *  looked up in datasetInfo.ts; runtime layers carry their own, since
   *  nothing can be known about a pasted URL until it is pasted. */
  info?: LayerInfo;
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
  /** Legend that has to be fetched. Used by server-rendered layers, which
   *  arrive already symbolised and would otherwise be colours with no stated
   *  meaning. Resolved by the panel the first time the layer is expanded. */
  asyncLegend?(): Promise<LegendItem[]>;
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
  forest: 15,
  concessions: 20,
  protection: 30,
  population: 40,
  haze: 50,
  boundaries: 60,
  fire: 70,
  // Above the built-in context stack: someone who just pasted a URL wants to
  // see what they added, not hunt for it under nine other polygon layers.
  custom: 65,
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

export function addSourceSafe(
  map: MaplibreMap,
  id: string,
  spec: Parameters<MaplibreMap["addSource"]>[1],
): void {
  if (!map.getSource(id)) map.addSource(id, spec);
}

export function removeLayerSafe(map: MaplibreMap, id: string): void {
  if (map.getLayer(id)) map.removeLayer(id);
}

/** Remove a source only if no remaining layer references it (shared sources). */
export function removeSourceIfUnused(map: MaplibreMap, id: string): void {
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
    defaultVisible: false,
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

  // ------------------------------------------------------------ forest ---
  {
    id: "forest-estate",
    group: "forest",
    mapLayerIds: ["forest-estate", "forest-estate-line"],
    label: "Kawasan hutan (penetapan, KLHK)",
    description:
      "The gazetted forest estate as KLHK publishes it through BIG: 4,487 polygons, 97.5 M ha, classed lindung / konservasi / produksi / konversi. This is the layer that decides whether a fire is KLHK's problem or the regency's, and it is data rather than tiles, so the forest-status chart counts against it nationally. Penetapan is the final gazettement step, so land designated but not yet gazetted reads here as outside the estate. 12.9 MB on first switch-on.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.9,
    legend: FOREST_CLASSES.map((c) => ({ color: c.color, label: c.short })),
    add(map) {
      addSourceSafe(map, "forest-estate", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("forest-estate")) {
        map.addLayer({
          id: "forest-estate",
          type: "fill",
          source: "forest-estate",
          paint: {
            "fill-color": forestFillColor() as unknown as ExpressionSpecification,
            "fill-opacity": 0.18,
          },
        });
      }
      if (!map.getLayer("forest-estate-line")) {
        map.addLayer({
          id: "forest-estate-line",
          type: "line",
          source: "forest-estate",
          minzoom: 7,
          paint: {
            "line-color": forestFillColor() as unknown as ExpressionSpecification,
            "line-width": 0.5,
          },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "forest-estate-line");
      removeLayerSafe(map, "forest-estate");
      removeSourceIfUnused(map, "forest-estate");
    },
    setOpacity(map, slider) {
      if (map.getLayer("forest-estate")) {
        map.setPaintProperty("forest-estate", "fill-opacity", 0.18 * slider);
      }
      if (map.getLayer("forest-estate-line")) {
        map.setPaintProperty(
          "forest-estate-line",
          "line-opacity",
          Math.min(1, 0.7 * slider),
        );
      }
    },
  },
  {
    id: "forest-release",
    group: "forest",
    mapLayerIds: ["forest-release", "forest-release-line"],
    label: "Pelepasan kawasan hutan",
    description:
      "Forest estate legally released out of KLHK's hands, in practice mostly for oil palm and transmigration. Fires here are on land cleared with a permit — the converse of the concession layers, which sit inside the estate. 2,396 polygons; BIG publishes no attributes beyond the province.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.9,
    legend: [{ color: "#fb923c", label: "released" }],
    add(map) {
      addSourceSafe(map, "forest-release", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("forest-release")) {
        map.addLayer({
          id: "forest-release",
          type: "fill",
          source: "forest-release",
          paint: { "fill-color": "#fb923c", "fill-opacity": 0.22 },
        });
      }
      if (!map.getLayer("forest-release-line")) {
        map.addLayer({
          id: "forest-release-line",
          type: "line",
          source: "forest-release",
          paint: { "line-color": "#fdba74", "line-width": 0.6 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "forest-release-line");
      removeLayerSafe(map, "forest-release");
      removeSourceIfUnused(map, "forest-release");
    },
    setOpacity(map, slider) {
      if (map.getLayer("forest-release")) {
        map.setPaintProperty("forest-release", "fill-opacity", 0.22 * slider);
      }
      if (map.getLayer("forest-release-line")) {
        map.setPaintProperty(
          "forest-release-line",
          "line-opacity",
          Math.min(1, 0.7 * slider),
        );
      }
    },
  },
  {
    id: "forest-village",
    group: "forest",
    mapLayerIds: ["forest-village", "forest-village-line"],
    label: "Hutan desa (PPHD)",
    description:
      "Social forestry granted to village institutions — 1,351 approvals. Community-managed forest burns for different reasons than concession land, and the permit holder is named, so a detection inside one has an address.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.9,
    legend: [{ color: "#22d3ee", label: "hutan desa" }],
    add(map) {
      addSourceSafe(map, "forest-village", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("forest-village")) {
        map.addLayer({
          id: "forest-village",
          type: "fill",
          source: "forest-village",
          paint: { "fill-color": "#22d3ee", "fill-opacity": 0.22 },
        });
      }
      if (!map.getLayer("forest-village-line")) {
        map.addLayer({
          id: "forest-village-line",
          type: "line",
          source: "forest-village",
          paint: { "line-color": "#67e8f9", "line-width": 0.7 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "forest-village-line");
      removeLayerSafe(map, "forest-village");
      removeSourceIfUnused(map, "forest-village");
    },
    setOpacity(map, slider) {
      if (map.getLayer("forest-village")) {
        map.setPaintProperty("forest-village", "fill-opacity", 0.22 * slider);
      }
      if (map.getLayer("forest-village-line")) {
        map.setPaintProperty(
          "forest-village-line",
          "line-opacity",
          Math.min(1, 0.8 * slider),
        );
      }
    },
  },
  {
    id: "forest-htr",
    group: "forest",
    mapLayerIds: ["forest-htr", "forest-htr-line"],
    label: "Hutan tanaman rakyat (HTR)",
    description:
      "Smallholder timber plantation permits inside production forest — 471 areas. The small-scale counterpart to the pulpwood concessions, and often the tenure behind a cluster of small fires.",
    layerType: "fill",
    defaultVisible: false,
    defaultOpacity: 0.9,
    legend: [{ color: "#c084fc", label: "HTR" }],
    add(map) {
      addSourceSafe(map, "forest-htr", { type: "geojson", data: EMPTY_FC });
      if (!map.getLayer("forest-htr")) {
        map.addLayer({
          id: "forest-htr",
          type: "fill",
          source: "forest-htr",
          paint: { "fill-color": "#c084fc", "fill-opacity": 0.22 },
        });
      }
      if (!map.getLayer("forest-htr-line")) {
        map.addLayer({
          id: "forest-htr-line",
          type: "line",
          source: "forest-htr",
          paint: { "line-color": "#d8b4fe", "line-width": 0.7 },
        });
      }
    },
    remove(map) {
      removeLayerSafe(map, "forest-htr-line");
      removeLayerSafe(map, "forest-htr");
      removeSourceIfUnused(map, "forest-htr");
    },
    setOpacity(map, slider) {
      if (map.getLayer("forest-htr")) {
        map.setPaintProperty("forest-htr", "fill-opacity", 0.22 * slider);
      }
      if (map.getLayer("forest-htr-line")) {
        map.setPaintProperty(
          "forest-htr-line",
          "line-opacity",
          Math.min(1, 0.8 * slider),
        );
      }
    },
  },

  gfwPolygonLayer({
    id: "prot-forest-area",
    group: "forest",
    label: "Kawasan hutan (GFW tiles)",
    description:
      "The same forest estate classes as vector tiles, drawn instantly and at any zoom. GFW's copy is a 2017 vintage and arrives tiled, so it cannot be counted against — use it to read the map, and the KLHK penetapan layer above for the numbers.",
    entry: GFW_DATASETS.forestArea,
    info: {
      updated:
        "The GFW copy is from 2017. The KLHK penetapan layer above it is seven years newer.",
      caveat:
        "These are tiles, so the map draws them at once and at any zoom, but the app cannot count them. Read the map with this layer. Take numbers from the KLHK penetapan layer.",
    },
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
  // ------------------------------------------------------- concessions ---
  gfwPolygonLayer({
    id: "conc-oil-palm",
    group: "concessions",
    label: "Oil palm concessions",
    description:
      "Mapped oil palm concession boundaries (batas perkebunan sawit) from GFW. Fires clustered inside a concession indicate land clearing rather than wildfire.",
    entry: GFW_DATASETS.oilPalm,
    info: {
      coverage:
        "Mapped concessions only. No polygon means no mapped boundary. It does not mean no plantation.",
      caveat:
        "A concession boundary shows where a permit applies. It does not show who started a fire inside it. The boundaries come from government and company sources of different ages.",
    },
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
    info: {
      source:
        "Roundtable on Sustainable Palm Oil, through Global Forest Watch open data. Dataset rspo_oil_palm, version v2025.",
      caveat:
        "Certification covers the area the member mapped at the time of the assessment. A fire inside one can affect that certification. Check the record before you make a claim about it.",
    },
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
    info: {
      caveat:
        "Companies often put these plantations on drained peat. Read this layer together with the peat layers. Drainage is what lets peat burn.",
    },
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
    info: {
      updated:
        "Version v202106. This is the oldest concession layer, so a boundary can have a new holder by now.",
      caveat:
        "Selective logging leaves canals and skid trails. These dry the forest floor and carry fire inland, so the effect lasts longer than the felling.",
    },
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
    info: {
      caveat:
        "These are permit boundaries, not open pits. Much of a permit area can be untouched.",
    },
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
    info: {
      source:
        "PIPPIB, the Indonesian moratorium on primary forest and peatland, through Global Forest Watch open data. Dataset idn_forest_moratorium, version v20200923.",
      updated:
        "The revision of September 2020. PIPPIB changes from time to time, so a current boundary can differ.",
      caveat:
        "New concessions are not permitted inside these areas. Check the record first if a fire starts here. The moratorium controls permits, not people.",
    },
    color: "#22d3ee",
    nameField: "pippib_en",
  }),
  gfwPolygonLayer({
    id: "prot-wdpa",
    group: "protection",
    label: "Protected areas (WDPA)",
    description:
      "National parks and reserves. Fire inside a protected area carries the greatest biodiversity impact.",
    entry: GFW_DATASETS.protectedAreas,
    info: {
      source:
        "World Database on Protected Areas (UNEP-WCMC and IUCN), through Global Forest Watch open data. Dataset wdpa_protected_areas, version v202512.",
      caveat:
        "WDPA holds designations of very different strength, from strict nature reserves to managed-resource areas. Click a polygon and read `desig_eng` to tell them apart.",
      link: "https://www.protectedplanet.net/",
    },
    color: "#4ade80",
    nameField: "name",
    subField: "desig_eng",
  }),
];
