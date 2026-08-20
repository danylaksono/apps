/** Central configuration: endpoints, keys, area of interest. */

// NASA FIRMS (see AGENTS.md — key valid for FIRMS Global, 5000 req / 10 min)
export const FIRMS_API_KEY = "eda46120c69739d3b51b05ae8dd3584a";
export const FIRMS_SOURCE = "VIIRS_SNPP_NRT";
// The NRT area endpoint accepts 1..5 days and rejects anything more (verified:
// "Invalid day range. Expects [1..5]"). 5 is the whole window it will give us,
// which is what the trend chart plots; the map and KPIs filter it down from
// there. Nationally that is ~27,000 detections, 2.2 MB, ~1.8 s.
export const FIRMS_DAYS = 5;

// Indonesia bbox (west,south,east,north), used as the FIRMS request envelope
// and the BIG spatial filter. Sabang to Merauke, plus a small margin.
//
// This is a request envelope, not the area of interest. No rectangle around
// Indonesia excludes its neighbours — this one also contains Malaysia, Brunei,
// Singapore, Timor-Leste, Papua New Guinea and the southern Philippines — so
// fires are clipped to the country's own outline afterwards. See
// clipToIndonesia() in firms.ts.
export const INDONESIA_BBOX = "94.9,-11.2,141.1,6.2";

// CAMS (Copernicus Atmosphere Monitoring Service) via ECMWF's public WMS.
// Keyless with `token=public`; CORS echoes the request Origin. Render-on-
// demand + a 3-hourly time dimension — see src/lib/cams.ts.
export const CAMS_WMS = "https://eccharts.ecmwf.int/wms/";

/** CAMS WMS layers worth showing, with a style from their capabilities.
 *
 *  Style choice matters more here than anywhere else in the app. ECMWF's
 *  default `sh_all_aod` is a rainbow (blue → cyan → green → yellow → red):
 *  non-monotonic in lightness, so thin smoke reads as a cool "safe" blue and
 *  rank is impossible to judge without the legend. The styles below are the
 *  sequential, alpha-ramped ones — density maps to both darkness and opacity,
 *  the way https://apps.atmosphere.copernicus.eu/fire-emissions-watch/ renders
 *  its plume, and clean air draws nothing at all instead of a flat wash.
 *
 *  Styles are per-layer in the capabilities but the server resolves them
 *  globally, which is why `pm25` can borrow a `surface_concentration` style. */
export const CAMS_LAYERS = {
  /** smoke: AOD from biomass burning only — the haze plume itself.
   *  20 levels, 0.1 → ~1, alpha 0.05 → 1.
   *
   *  Spun from orange to magenta for the same reason Fire Emissions Watch
   *  renders its plume pink: the fire detections on top of it are orange, and
   *  an orange plume swallows them at exactly the densities that matter. */
  bbaod: {
    layer: "composition_bbaod550",
    style: "sh_Oranges_aod",
    hueRotate: 300,
  },
  /** what people actually breathe, at the surface. 8 levels of 30 µg/m³.
   *
   *  The only alpha-ramped style the global PM2.5 layer will serve is the
   *  orange one — every palette of its own (DEFRA DAQI, MeteoSwiss) is fully
   *  opaque and buries the basemap under a solid green field. So take the
   *  orange ramp and spin its hue to violet at render time (`hueRotate`),
   *  which is the hue ECMWF itself uses for PM2.5 on the European layers and
   *  keeps this layer distinct from both the smoke plume and the fire points. */
  pm25: {
    layer: "composition_pm2p5",
    style: "sh_OrangesTransparent240_surface_concentration",
    hueRotate: 260,
  },
} as const;

// NASA GIBS keyless WMTS (RESTful). Dates are resolved rather than left to the
// server's `default` — see src/lib/gibs.ts for why.
export const GIBS_WMTS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";

/** GIBS raster layers, with the tile matrix set that fixes their max zoom. */
export const GIBS_LAYERS = {
  aod: {
    layer: "MODIS_Aqua_Aerosol",
    matrixSet: "GoogleMapsCompatible_Level6",
    maxzoom: 6,
    ext: "png",
  },
  /** Black Marble: a pre-rendered static composite, so no date resolution and
   *  no decoding — settlements, roads and gas flares as points of light. */
  nightLights: {
    layer: "VIIRS_Black_Marble",
    matrixSet: "GoogleMapsCompatible_Level8",
    maxzoom: 8,
    ext: "png",
    /** static 2016 composite; GIBS still wants a date in the path */
    fixedDate: "2016-01-01",
  },
  trueColor: {
    layer: "MODIS_Terra_CorrectedReflectance_TrueColor",
    matrixSet: "GoogleMapsCompatible_Level9",
    maxzoom: 9,
    // GIBS declares image/jpeg for this one, but JPEG has no alpha and renders
    // gaps between granules as black over the map. PNG is transcoded and a
    // little larger; that is the right trade for an overlay.
    ext: "png",
  },
} as const;

// BIG SatuPeta (Badan Informasi Geospasial) — the official Indonesian
// geoportal, and the one .go.id host that actually resolves and serves CORS.
// Keyless. Dynamic MapServer (no tile cache) — query it as GeoJSON, see
// src/lib/big.ts. Browse layers: append `?f=json`.
export const BIG_MAPSERVER =
  "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer";

/** Layer ids within BIG_MAPSERVER, with the fields worth keeping.
 *
 *  Coverage is the thing to watch here. BIG's peat layers stop at Kalimantan:
 *  layer 6 returns 146 polygons nationally and every one of them is on Borneo,
 *  so the peat KPI is scoped to Kalimantan and labelled as such. Sumatra and
 *  Papua hold most of the country's remaining peat and are simply absent.
 *
 *  Coverage also differs between the three peat layers, which matters if you
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
// but from "/apps/agni/" on GitHub Pages, and hardcoding "/data/..." would
// resolve against the domain root in production.
const BASE = import.meta.env.BASE_URL; // always has a trailing slash

export const BOUNDARIES_PMTILES_URL = `pmtiles://${location.origin}${BASE}data/boundaries.pmtiles`;
/** Kab/kota polygons: the fire clip and the "kabupaten affected" KPI. */
export const KABKOTA_GEOJSON_URL = `${BASE}data/kabkota_indonesia.geojson`;
/** Kontur H3 population, queried through DuckDB — see lib/population.ts. */
export const POPULATION_PARQUET_URL = `${BASE}data/population_h3.parquet`;

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

/** UMD/Hansen tree cover loss, served by GFW as an *encoded* raster rather than
 *  a styled one — see src/lib/gfwRaster.ts for the decode. Pinned rather than
 *  `latest`, which 307-redirects and moves when UMD publishes a new year. */
export const GFW_TREE_COVER_LOSS_VERSION = "v1.13";

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
