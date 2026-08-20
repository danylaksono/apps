/** Central configuration: endpoints, keys, area of interest. */

// NASA FIRMS (see AGENTS.md — key valid for FIRMS Global, 5000 req / 10 min)
export const FIRMS_API_KEY = "eda46120c69739d3b51b05ae8dd3584a";
export const FIRMS_SOURCE = "VIIRS_SNPP_NRT";
// 1 day means "today so far, UTC" — empty for the first hours of each UTC
// day, which reads as "no fires" rather than "no data yet". 2 always has data.
export const FIRMS_DAYS = 2;

// generous Kalimantan bbox: west,south,east,north
export const KALIMANTAN_BBOX = "108.8,-4.8,119.6,7.6";

// CAMS (Copernicus Atmosphere Monitoring Service) via ECMWF's public WMS.
// Keyless with `token=public`; CORS echoes the request Origin. Render-on-
// demand + a 3-hourly time dimension — see src/lib/cams.ts.
export const CAMS_WMS = "https://eccharts.ecmwf.int/wms/";

/** CAMS WMS layers worth showing, with a style from their capabilities. */
export const CAMS_LAYERS = {
  /** smoke: AOD from biomass burning only — the haze plume itself */
  bbaod: { layer: "composition_bbaod550", style: "sh_all_aod" },
  /** what people actually breathe, at the surface */
  pm25: { layer: "composition_pm2p5", style: "sh_all_pm2p5_defra_daqi" },
} as const;

// NASA GIBS keyless WMTS (RESTful)
export const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

// BIG SatuPeta (Badan Informasi Geospasial) — the official Indonesian
// geoportal, and the one .go.id host that actually resolves and serves CORS.
// Keyless. Dynamic MapServer (no tile cache) — query it as GeoJSON, see
// src/lib/big.ts. Browse layers: append `?f=json`.
export const BIG_MAPSERVER =
  "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer";

/** Layer ids within BIG_MAPSERVER, with the fields worth keeping.
 *
 *  Coverage differs a lot between the three peat layers, which matters if you
 *  compute anything from them. Measured over Kalimantan (Aug 2026):
 *    - `peatland` (6):     45,486 km2 — matches the ~50,000 km2 of peat that
 *                          Kalimantan is known to have. Use this one for stats.
 *    - `khg` (37):          8,758 km2, and 78 of its 101 units are in Kalbar.
 *    - `peatFunction` (48): 8,712 km2 — the same partial extent as KHG.
 *  Fire counts bear that out: 31% of detections fall on layer 6 peat, but only
 *  1.6% on KHG. The KPI therefore uses layer 6; 37 and 48 are context only. */
export const BIG_LAYERS = {
  /** Peta Lahan Gambut — full peat soil extent (146 polygons in Kalimantan) */
  peatland: { layerId: 6, outFields: ["wadmpu"] },
  /** Kesatuan Hidrologis Gambut — the regulatory peat unit (partial coverage) */
  khg: { layerId: 37, outFields: ["kode_khg"] },
  /** Fungsi Ekosistem Gambut — peat thickness + lindung/budidaya (4,359) */
  peatFunction: {
    layerId: 48,
    outFields: ["kode_khg", "peat_thick", "feg_peat"],
  },
  /** Rawan Kebakaran Hutan dan Lahan — fire hazard class (19,955) */
  fireHazard: {
    layerId: 47,
    outFields: ["kelas", "provinsi", "namobj"],
    maxFeatures: 25000,
  },
} as const;

// Static data (pipeline output) served from public/.
// Everything here must go through BASE_URL: the app is served from "/" in dev
// but from "/apps/hazer/" on GitHub Pages, and hardcoding "/data/..." would
// resolve against the domain root in production.
const BASE = import.meta.env.BASE_URL; // always has a trailing slash

export const BOUNDARIES_PMTILES_URL = `pmtiles://${location.origin}${BASE}data/boundaries.pmtiles`;
export const POPULATION_PMTILES_URL = `pmtiles://${location.origin}${BASE}data/population.pmtiles`;
export const KECAMATAN_GEOJSON_URL = `${BASE}data/kecamatan_kalimantan.geojson`;

// ---------------------------------------------------------------- context ---
// Global Forest Watch open data API. Keyless, CORS-open (verified Aug 2026).
// Static tile caches are CDN-backed and cap out around z10; MapLibre overzooms
// above the source `maxzoom`, so polygons stay sharp when zoomed further in.
// Dataset versions move (gfw_oil_palm went v20191031 -> v2025) — re-check with
//   https://data-api.globalforestwatch.org/dataset/{dataset}
// and read min/max zoom from .../{dataset}/{version}/assets before changing.
export const GFW_TILES = "https://tiles.globalforestwatch.org";

export function gfwVectorTiles(dataset: string, version: string): string {
  return `${GFW_TILES}/${dataset}/${version}/default/{z}/{x}/{y}.pbf`;
}

export function gfwRasterTiles(dataset: string, version: string): string {
  return `${GFW_TILES}/${dataset}/${version}/default/{z}/{x}/{y}.png`;
}

/** Pinned GFW dataset versions. The MVT `source-layer` equals the dataset name. */
export const GFW_DATASETS = {
  peatlands: { dataset: "gfw_peatlands", version: "v20230315", maxzoom: 11 },
  oilPalm: { dataset: "gfw_oil_palm", version: "v2025", maxzoom: 10 },
  rspoOilPalm: { dataset: "rspo_oil_palm", version: "v2025", maxzoom: 10 },
  woodFiber: { dataset: "gfw_wood_fiber", version: "v2025", maxzoom: 10 },
  logging: { dataset: "gfw_logging", version: "v202106", maxzoom: 10 },
  mining: { dataset: "gfw_mining_concessions", version: "v2025", maxzoom: 10 },
  moratorium: {
    dataset: "idn_forest_moratorium",
    version: "v20200923",
    maxzoom: 9,
  },
  forestArea: { dataset: "idn_forest_area", version: "v201709", maxzoom: 10 },
  protectedAreas: {
    dataset: "wdpa_protected_areas",
    version: "v202512",
    maxzoom: 10,
  },
} as const;
