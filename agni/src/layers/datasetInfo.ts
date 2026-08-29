/** Where every layer's data actually comes from — the table behind the (i).
 *
 *  Kept apart from registry.ts on purpose. The registry is about drawing:
 *  sources, paint, ordering, opacity. This is about provenance, and provenance
 *  is worth reading end to end — resolutions next to each other, coverage gaps
 *  next to each other — which is impossible when it is spread across 1,200
 *  lines of `addLayer` calls. Keyed by descriptor id.
 *
 *  Three rules for what goes in here:
 *
 *  1. Only what can be checked. Every resolution, count and endpoint below is
 *     either measured by this repo (see METHODOLOGY.md), read off config.ts, or
 *     documented by the publisher. A field with nothing verifiable behind it is
 *     left out rather than guessed at — this panel is the part of the UI that
 *     claims to be authoritative, so it is the worst place to approximate.
 *  2. Caveats belong here, not only in the description. The description sells
 *     the layer; the caveat is what stops someone quoting a number the data
 *     cannot support.
 *  3. Simplified Technical English in the strings: short sentences, one idea
 *     each, active voice, plain words, no rhetorical flourish. Plenty of people
 *     reading an Indonesian fire map do not read English first, and a caveat
 *     that has to be parsed twice is worse than no caveat. The rule covers the
 *     strings only — these comments keep the house style of the codebase.
 *  4. Nothing about this codebase in the strings. No file paths, no internal
 *     protocol names, no library names. The reader is looking at a map, not at
 *     the source, and anyone who wants the source can go and read it. Say what
 *     the data is and where it comes from; say "the browser" or "the app" for
 *     whatever happens here.
 *
 *  GFW layers are absent by design: gfwPolygonLayer() generates their info from
 *  the same pinned GFW_DATASETS entry that builds their tile URL, so a version
 *  bump cannot leave the panel describing the previous one. */

import type { LayerDescriptor, LayerInfo } from "./registry";
import {
  BOUNDARIES_PMTILES_URL,
  CAMS_LAYERS,
  CAMS_WMS,
  FIRMS_DAYS,
  FIRMS_SOURCE,
  GFW_TILES,
  GFW_TREE_COVER_LOSS_VERSION,
  GIBS_LAYERS,
  GIBS_WMTS,
  INDONESIA_BBOX,
  POPULATION_PARQUET_URL,
} from "../lib/config";

/** Root of the BIG SatuPeta service both folders hang off. */
const BIG_ROOT = "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK";

const FIRMS: LayerInfo = {
  source:
    "NASA FIRMS. The VIIRS instrument on the Suomi-NPP satellite, near real-time (VIIRS_SNPP_NRT).",
  resolution:
    "375 m pixels. Each point is the centre of a pixel, not the position of the fire.",
  updated:
    "Near real-time. The app loads the last 5 days. The endpoint gives no more than that.",
  coverage:
    "The app asks for the box 94.9,-11.2 to 141.1,6.2, then clips the result to the kab/kota outline. This is why the neighbour countries are empty.",
  api: "REST. This is the only source that needs a key. The URL below hides the key.",
  endpoint: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/${FIRMS_SOURCE}/${INDONESIA_BBOX}/${FIRMS_DAYS}`,
  format: "CSV. The browser converts it to GeoJSON.",
  caveat:
    "These points are hot spots, not confirmed fires. Gas flares, furnaces and hot bare ground also make hot spots. Confidence is a class from the algorithm. It is not a probability that something burns.",
  link: "https://firms.modaps.eosdis.nasa.gov/",
};

/** GIBS layers differ only in the product; the access story is identical. */
function gibs(o: {
  source: string;
  resolution: string;
  updated: string;
  spec: { layer: string; matrixSet: string; maxzoom: number; ext: string };
  /** Only where the server does something other than honour the extension. */
  format?: string;
  caveat: string;
}): LayerInfo {
  return {
    source: o.source,
    resolution: o.resolution,
    updated: o.updated,
    api: `Keyless WMTS. NASA serves this layer up to zoom ${o.spec.maxzoom}.`,
    endpoint: `${GIBS_WMTS}/${o.spec.layer}/default/{date}/${o.spec.matrixSet}/{z}/{y}/{x}.${o.spec.ext}`,
    format:
      o.format ??
      "PNG tiles. The app steps back one day at a time to find the most recent day with images. It does not use the default date of the server.",
    caveat: o.caveat,
    link: "https://nasa-gibs.github.io/gibs-api-docs/",
  };
}

/** Both CAMS layers ride the same WMS; only the product and style differ. */
function cams(o: {
  source: string;
  entry: { layer: string; style: string };
  caveat: string;
}): LayerInfo {
  return {
    source: o.source,
    resolution:
      "About 40 km. This is model output, not measurement. Use it for the direction of the plume. Do not use it for one address.",
    updated:
      "Every 3 hours, with analysis and forecast. The timeline below the map moves through the run.",
    api: "Keyless WMS 1.3.0 GetMap with token=public. ECMWF draws each frame when the app asks for it. The app puts each frame in the browser cache before the map shows it.",
    endpoint: `${CAMS_WMS}?token=public&service=WMS&version=1.3.0&request=GetMap&layers=${o.entry.layer}&styles=${o.entry.style}&format=image/png&transparent=true&crs=EPSG:3857&bbox={mercator bbox}&width={w}&height={h}&time={time}`,
    format: "PNG. The app adds it as one image, held to the corners of the area.",
    caveat: o.caveat,
    link: "https://atmosphere.copernicus.eu/",
  };
}

/** The BIG SatuPeta MapServers, queried as GeoJSON rather than tiled. */
function big(o: {
  source: string;
  folder: "SUMBER_DAYA_ALAM_DAN_LINGKUNGAN" | "KEHUTANAN";
  layerId: number;
  resolution: string;
  coverage: string;
  updated?: string;
  caveat: string;
}): LayerInfo {
  return {
    source: o.source,
    resolution: o.resolution,
    updated: o.updated,
    coverage: o.coverage,
    api: "ArcGIS REST. Keyless, and it accepts requests from other origins. The app reads 1,000 features per page, with 4 pages at the same time. The server simplifies the shapes with maxAllowableOffset.",
    endpoint: `${BIG_ROOT}/${o.folder}/MapServer/${o.layerId}/query?f=geojson&where=1=1&outFields={fields}&geometry=${INDONESIA_BBOX}&geometryType=esriGeometryEnvelope&inSR=4326&outSR=4326&spatialRel=esriSpatialRelIntersects&returnGeometry=true&maxAllowableOffset=0.002&geometryPrecision=5&resultOffset={n}&resultRecordCount=1000`,
    format:
      "GeoJSON. The app downloads it when you switch the layer on, then keeps it for the session.",
    caveat: o.caveat,
    // The layer itself rather than the service root: ArcGIS renders it as a
    // browsable page listing the fields, extent and record count.
    link: `${BIG_ROOT}/${o.folder}/MapServer/${o.layerId}`,
  };
}

/** Everything the pipeline bakes into public/data/ and serves statically. */
function baked(o: Omit<LayerInfo, "updated">): LayerInfo {
  return { ...o, updated: "Static. It changes only when the pipeline runs." };
}

export const LAYER_INFO: Record<string, LayerInfo> = {
  // ---------------------------------------------------------------- fire ---
  fires: FIRMS,
  "fire-glyphs": {
    source:
      "Made in the browser, from the same FIRMS points as the Active fires layer.",
    resolution:
      "Cluster mode groups points within 70 pixels at the current zoom. Province mode groups by provinsi polygon, so the glyphs stay still when you pan.",
    api: "None. The app builds these from data it already has.",
    caveat:
      "The glyphs use the filtered set, so they always agree with the dots, the KPI cards and the charts.",
    link: "https://firms.modaps.eosdis.nasa.gov/",
  },
  "burnt-area": {
    source:
      "Copernicus Land Monitoring Service. Burnt Area 300 m daily v4, from Sentinel-3 and VIIRS.",
    resolution: "300 m.",
    updated: "Daily. The date slider selects the day.",
    api: "Keyless WMTS GetTile. Layer BF, the burned fraction.",
    endpoint:
      "https://land.copernicus.eu/cdse/ba_global_300m_daily_v4?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=BF&STYLE=default&FORMAT=image/png&TILEMATRIXSET=PopularWebMercator256&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&TIME={date}",
    format:
      "PNG with the colours already applied. The browser decodes each tile again before it draws it.",
    caveat:
      "One day shows very little. Burn scars build up across a season. This is correct behaviour, not a fault. The service paints its no-burn class as solid pale yellow across all land. The app removes that one colour, or it would hide the real burns.",
    link: "https://land.copernicus.eu/global/products/ba",
  },

  // ---------------------------------------------------------------- haze ---
  "haze-aod": gibs({
    source: "NASA GIBS. MODIS Aqua aerosol optical depth (MODIS_Aqua_Aerosol).",
    resolution: "10 km at nadir. This is the native MODIS aerosol grid.",
    updated: "Daily. One image for each overpass day.",
    spec: GIBS_LAYERS.aod,
    caveat:
      "This is the whole column of aerosol, seen from orbit. It holds dust and sea salt as well as smoke, and it says nothing about the air at ground level. Cloud stops the measurement, so a gap is missing data, not clean air.",
  }),
  "haze-smoke": gibs({
    source:
      "NASA GIBS. MODIS Terra corrected reflectance, true colour (MODIS_Terra_CorrectedReflectance_TrueColor).",
    resolution: "250 m.",
    updated: "Daily. One image for each overpass day.",
    spec: GIBS_LAYERS.trueColor,
    format:
      "JPEG, whatever the request asks for. The app asks for .png, but GIBS answers with image/jpeg for every extension. This was measured in August 2026. JPEG has no transparency, so the gaps between granules are black. The app steps back one day at a time to find the most recent day with images.",
    caveat: "This shows smoke as the eye sees it. Cloud looks almost the same.",
  }),
  "haze-cams-smoke": cams({
    source:
      "Copernicus Atmosphere Monitoring Service (ECMWF). Aerosol optical depth from biomass burning (composition_bbaod550).",
    entry: CAMS_LAYERS.bbaod,
    caveat:
      "This product separates smoke from dust and sea salt, but it is still a model. It shows where the model puts the smoke. The app turns the ECMWF orange palette to magenta, because an orange plume hides the orange fire dots above it.",
  }),
  "haze-cams-pm25": cams({
    source:
      "Copernicus Atmosphere Monitoring Service (ECMWF). Surface PM2.5 (composition_pm2p5).",
    entry: CAMS_LAYERS.pm25,
    caveat:
      "This is a modelled concentration at ground level. It is not a reading from a monitoring station. For scale: the WHO 24-hour guideline is 15 µg/m³, and the Indonesian ISPU “berbahaya” band starts near 250.",
  }),
  "night-lights": gibs({
    source: "NASA GIBS. VIIRS Black Marble (VIIRS_Black_Marble).",
    resolution: "500 m images, from a 750 m sensor footprint.",
    updated: "A fixed composite from 2016. The date slider does not move it.",
    spec: GIBS_LAYERS.nightLights,
    format:
      "PNG tiles. The date in the URL is always 2016-01-01. GIBS needs a date, but this product has only one.",
    caveat:
      "This is a 2016 baseline used as context today. Towns have grown since then. Gas flares show as bright points and can look like towns.",
  }),

  // ---------------------------------------------------------- population ---
  population: baked({
    source: "Kontur Population Dataset.",
    resolution:
      "H3 resolution 8, about 0.74 km² per hexagon. The app also holds resolutions 7, 6 and 5, and picks one from the zoom. A full screen then holds 10,000 to 15,000 cells at every step.",
    coverage: "874,919 hexagons across Indonesia.",
    api: "No network request. The app ships a 3.9 MB Parquet file and queries it in the browser after each map move.",
    endpoint: POPULATION_PARQUET_URL,
    format:
      "Parquet with no geometry. The browser builds each hexagon from its H3 index. As vector tiles the same data is 113 MB, too large to ship.",
    caveat:
      "This is modelled density, not a census count. The map draws density, not headcount, so the colour scale means the same thing at every zoom. One resolution-5 cell holds about 343 times the people of a resolution-8 cell.",
    link: "https://www.kontur.io/portfolio/population-dataset/",
  }),

  // ------------------------------------------------------------- history ---
  "tree-cover-loss": {
    source:
      "Hansen, UMD, Google, USGS and NASA. Global Forest Watch serves it as umd_tree_cover_loss v1.13, tcd_30.",
    resolution: "30 m, from Landsat.",
    updated:
      "Once a year. It covers the loss years 2001 to 2025. Years from 2022 share the brightest step of the ramp.",
    api: "Static XYZ raster tiles. The app pins a version. The `latest` path redirects, and it moves when UMD publishes a new year.",
    endpoint: `${GFW_TILES}/umd_tree_cover_loss/${GFW_TREE_COVER_LOSS_VERSION}/tcd_30/{z}/{x}/{y}.png`,
    format:
      "PNG that holds data, not colour. R is the intensity, B is the loss year minus 2000, and A marks loss. The browser adds the colours. Without that step the layer is almost black.",
    caveat:
      "Tree cover loss is not deforestation. It counts harvest, fire and storm damage, and it does not say what replaced the canopy.",
    link: "https://data-api.globalforestwatch.org/dataset/umd_tree_cover_loss",
  },

  // ---------------------------------------------------------- boundaries ---
  "boundaries-kecamatan": baked({
    source: "Batas indikatif, Badan Informasi Geospasial (BIG).",
    resolution:
      "7,275 sub-districts. The map draws them from zoom 7. Below that they are too dense to read.",
    coverage: "All of Indonesia.",
    api: "No network request. The app ships a PMTiles archive and reads the parts it needs with HTTP range requests.",
    endpoint: BOUNDARIES_PMTILES_URL,
    format:
      "Vector tiles, zoom 2 to 12. All three levels sit in one layer of 37 MB and are filtered by `level`.",
    caveat:
      "These boundaries are for display. The tileset leaves out kelurahan and desa, to keep the file small.",
  }),
  "boundaries-kabkota": baked({
    source: "Batas indikatif, Badan Informasi Geospasial (BIG).",
    resolution:
      "514 regencies and cities. All analysis in the app runs at this level.",
    coverage: "All of Indonesia.",
    api: "No network request. The app ships a PMTiles archive and reads the parts it needs with HTTP range requests.",
    endpoint: BOUNDARIES_PMTILES_URL,
    format:
      "Vector tiles for display. A second copy of the same 514 polygons, as GeoJSON simplified to 0.008°, clips the fires and feeds the “kabupaten affected” KPI.",
    caveat:
      "These boundaries are for display. The simplified copy decides whether a detection falls inside Indonesia, so that decision is rough within a few hundred metres of the coast.",
  }),
  "boundaries-provinsi": baked({
    source: "Batas indikatif, Badan Informasi Geospasial (BIG).",
    resolution: "38 provinces.",
    coverage: "All of Indonesia.",
    api: "No network request. The app ships a PMTiles archive and reads the parts it needs with HTTP range requests.",
    endpoint: BOUNDARIES_PMTILES_URL,
    format: "Vector tiles, zoom 2 to 12.",
    caveat:
      "These boundaries are for display. Do not use them to settle a border.",
  }),

  // ------------------------------------------------------------ peatland ---
  "peat-extent": big({
    source: "BIG SatuPeta. Peta Lahan Gambut, the extent of peat soil.",
    folder: "SUMBER_DAYA_ALAM_DAN_LINGKUNGAN",
    layerId: 6,
    resolution:
      "146 polygons, 45,486 km². Kalimantan holds about 50,000 km² of peat, so this figure is the correct size.",
    coverage:
      "Kalimantan only. Every polygon from this service is on Borneo. Sumatra and Papua hold most of the peat that is left, and they are absent here.",
    caveat:
      "The “fires on peat” KPI counts against this layer, and says Kalimantan for that reason. VIIRS pixels are about 375 m, so a detection near the edge of the peat can fall on either side.",
  }),
  "peat-khg": big({
    source:
      "BIG SatuPeta. Kesatuan Hidrologis Gambut, the unit that Indonesian peat policy uses.",
    folder: "SUMBER_DAYA_ALAM_DAN_LINGKUNGAN",
    layerId: 37,
    resolution: "101 units, 8,758 km².",
    coverage: "Partial. 78 of the 101 units published are in Kalimantan Barat.",
    caveat:
      "Do not read extent from this layer. It holds about a fifth of the peat that the soil layer maps. 31% of detections fall on mapped peat soil. Only 1.6% fall inside a KHG. Use this layer to look at one site, not to make a total.",
  }),
  "peat-function": big({
    source:
      "BIG SatuPeta. Fungsi Ekosistem Gambut, the depth and the legal function of the peat.",
    folder: "SUMBER_DAYA_ALAM_DAN_LINGKUNGAN",
    layerId: 48,
    resolution:
      "4,359 polygons, 8,712 km². Each one carries the peat thickness and the lindung or budidaya status.",
    coverage: "Partial. The same reduced extent as KHG.",
    caveat:
      "The class has legal weight. Lindung peat is deeper than 3 m and you may not clear it. Budidaya peat is less than 3 m and you may clear it. Coverage is partial, so use this layer to look at one site, not to make a total.",
  }),

  // -------------------------------------------------------------- forest ---
  "forest-estate": big({
    source:
      "KLHK. Penetapan Kawasan Hutan, the gazetted forest estate, published through BIG SatuPeta.",
    folder: "KEHUTANAN",
    layerId: 0,
    resolution:
      "4,487 polygons, 97.5 M ha. The KUGI code in `fungsitap` gives the class: lindung, konservasi, produksi or konversi.",
    coverage:
      "All of Indonesia, 34 provinces. The service metadata reads “KEHUTANAN 08-08-2024”.",
    updated:
      "BIG publishes this copy. The app does not read KLHK directly, because no menlhk.go.id host resolves.",
    caveat:
      "The first time you switch this on, it downloads 12.9 MB across five pages. It is the one slow layer in the app. Penetapan is the last step of gazettement, so land that is designated but not yet gazetted reads here as outside the estate. The designated estate is about 125 M ha against the 97.5 M ha mapped.",
  }),
  "forest-release": big({
    source:
      "KLHK. Peta Pelepasan Kawasan Hutan, published through BIG SatuPeta.",
    folder: "KEHUTANAN",
    layerId: 7,
    resolution: "2,396 polygons.",
    coverage: "All of Indonesia.",
    caveat:
      "This is forest estate released by law, mostly to oil palm and to transmigration. BIG publishes no attribute except the province code, so a polygon cannot tell you who holds it.",
  }),
  "forest-village": big({
    source:
      "KLHK. Persetujuan Pengelolaan Hutan Desa (PPHD), the social forestry approvals, published through BIG SatuPeta.",
    folder: "KEHUTANAN",
    layerId: 13,
    resolution: "1,351 approvals. Each one names the village institution.",
    coverage: "All of Indonesia.",
    caveat:
      "This layer names the permit holder, so a detection inside one of these areas has an address. Check the record before you make a claim about it.",
  }),
  "forest-htr": big({
    source:
      "KLHK. Hutan Tanaman Rakyat permits, the smallholder timber plantations, published through BIG SatuPeta.",
    folder: "KEHUTANAN",
    layerId: 2,
    resolution: "471 areas. Each one names the farmer group.",
    coverage: "All of Indonesia, inside production forest.",
    caveat:
      "HTR is the small-scale form of a pulpwood concession. A group of small fires often sits on this tenure. That is not the same event as a concession-scale burn.",
  }),
};

/** Provenance for a layer, or nothing if none is recorded — a runtime layer
 *  carries its own, a built-in is looked up here. The panel hides the (i)
 *  rather than showing an empty card when this returns undefined. */
export function layerInfo(d: LayerDescriptor): LayerInfo | undefined {
  return d.info ?? LAYER_INFO[d.id];
}
