# METHODOLOGY.md — Hazer

How Hazer sources, processes, and visualizes data. Read this before adding or modifying layers.

## 1. Scope

- **Geography:** Kalimantan (provinces `61` Kalimantan Barat, `62` Kalimantan Tengah, `63` Kalimantan Selatan, `64` Kalimantan Timur, `65` Kalimantan Utara).
- **Theme:** immediate impact of forest/peatland fires — active fire detections, haze (aerosol) extent, and exposed population.
- **Administrative depth:** down to **kecamatan** (`kel_desa` intentionally dropped for size/performance).

## 2. Design principles

1. **Static-first, keyless-first.** Core layers (boundaries, population) are pre-baked into PMTiles and served from `public/data/` — no tile server, no API key, always render.
2. **Live layers degrade gracefully.** FIRMS (API key), GIBS (keyless), KHG (token-gated) are optional. If a source fails, the layer is marked unavailable in the UI; the rest of the map keeps working.
3. **Config-driven layers.** Every layer is a typed descriptor in `src/layers/registry.ts`. Adding a layer = appending a descriptor; the store, panel, legend, and map sync pick it up automatically.
4. **Client-side analytics.** KPIs are computed in the browser with turf.js from already-loaded data. No backend.

## 3. Data pipeline (`pipeline/build_tiles.py`)

Local source data lives outside this repo (`D:\personal\github\reach-ops\local-data`):

| Input                                            | CRS           | Notes                                           |
| ------------------------------------------------ | ------------- | ----------------------------------------------- |
| `geo/provinsi.geojson`                           | EPSG:4326     | 38 features                                     |
| `geo/kab_kota.geojson`                           | EPSG:4326     | 514 features                                    |
| `geo/kecamatan.geojson`                          | EPSG:4326     | 7,275 features                                  |
| `kontur_population_ID.gpkg` (layer `population`) | **EPSG:3857** | 874,919 H3 hexagons, columns `h3`, `population` |

Steps:

1. **Filter to Kalimantan** by `provinsi_code ∈ {61..65}` (boundaries) or by bbox `108.8,-4.8 → 119.6,7.6` (population, filtered in EPSG:3857 then reprojected to EPSG:4326).
2. **Stage** a GeoPackage with three boundary layers (`provinsi`, `kab_kota`, `kecamatan`) + a population GeoJSON.
3. **Tile to PMTiles** with GDAL's MVT driver (GDAL ≥ 3.8 writes `.pmtiles` directly), run via WSL `ogr2ogr`:
   - `public/data/boundaries.pmtiles` — 3 vector layers, z4–z12
   - `public/data/population.pmtiles` — 1 vector layer (`population`), z5–z12
4. **Emit analysis copy:** `public/data/kecamatan_kalimantan.geojson` (simplified, ~500 m tolerance) for client-side KPI spatial joins.

PMTiles are consumed in the browser via the `pmtiles` JS protocol (`pmtiles://` URLs registered on the MapLibre map). Fully static deploy.

## 4. Live / remote sources

| Source                    | Access                           | Method                                                                                                                                                                                                                                                                                                           |
| ------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NASA FIRMS**            | API key (in `src/lib/config.ts`) | `GET /api/area/csv/{KEY}/{SOURCE}/{bbox}/{days}` → CSV parsed to GeoJSON in-browser. Default source `VIIRS_SNPP_NRT`, **2 days**, Kalimantan bbox. Note: source IDs use **underscores**; the `/api/country` path is invalid — always use `/api/area`. `days=1` means "today so far (UTC)" and returns a header-only CSV for the first hours of each UTC day, which reads as "no fires" rather than "no data yet" — hence 2.                                                                 |
| **NASA GIBS**             | keyless                          | RESTful WMTS tiles: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LAYER}/default/{TIME}/{TILEMATRIXSET}/{z}/{y}/{x}.png`. Used as MapLibre raster sources. AOD: `MODIS_Aqua_Aerosol` (max z6). Smoke: `MODIS_Terra_CorrectedReflectance_TrueColor` (max z9). Time dimension `default` = latest available. |
| **BIG SatuPeta**          | keyless, CORS-open               | Official Indonesian layers (peat, KHG, fire hazard) as GeoJSON — see §4.3. Replaces the token-gated `services8.arcgis.com` KHG service, which is gone from the app.
| **CAMS (ECMWF WMS)**      | keyless (`token=public`)         | Animated haze — biomass-burning AOD and surface PM2.5, 3-hourly with forecast. See §4.4.
| **Global Forest Watch**   | keyless, CORS-open               | Peat, concession and protection context. Static vector tiles `https://tiles.globalforestwatch.org/{dataset}/{version}/default/{z}/{x}/{y}.pbf` (the MVT `source-layer` equals the dataset name); peat is a raster cache at the same path with `.png`. Versions are pinned in `GFW_DATASETS` — see §4.1.                                                                                                                                 |
| **Basemaps**              | keyless                          | CARTO Dark Matter, Esri World Imagery, OpenStreetMap standard, CARTO Voyager — all raster. Pre-registered as raster layers; switching toggles visibility (no `setStyle` churn). OSM is capped at z19 per the OSMF tile policy.                                                                                    |

### 4.1 Global Forest Watch context layers

GFW's public data API is the practical replacement for the dead Indonesian
government geoportals: no key, `Access-Control-Allow-Origin: *`, and it carries
the exact datasets this map needs.

| Layer               | Dataset                  | Pinned version | Source maxzoom |
| ------------------- | ------------------------ | -------------- | -------------- |
| Peatland (gambut)   | `gfw_peatlands`          | `v20230315`    | 11 (raster)    |
| Oil palm            | `gfw_oil_palm`           | `v2025`        | 10             |
| RSPO oil palm       | `rspo_oil_palm`          | `v2025`        | 10             |
| Pulpwood (HTI)      | `gfw_wood_fiber`         | `v2025`        | 10             |
| Logging (HPH)       | `gfw_logging`            | `v202106`      | 10             |
| Mining              | `gfw_mining_concessions` | `v2025`        | 10             |
| Moratorium (PIPPIB) | `idn_forest_moratorium`  | `v20200923`    | 9              |
| Kawasan hutan       | `idn_forest_area`        | `v201709`      | 10             |
| Protected areas     | `wdpa_protected_areas`   | `v202512`      | 10             |

Rules of engagement, learned the hard way:

- **Versions move.** `gfw_oil_palm` went `v20191031` → `v2025`. Before changing
  a pin, list versions at `https://data-api.globalforestwatch.org/dataset/{ds}`.
- **Read the zoom limits, don't guess them.**
  `…/dataset/{ds}/{version}/assets` reports `min_zoom`/`max_zoom` per tile
  cache. The static cache 404s both past its max zoom *and* on genuinely empty
  tiles, so probing a single tile cannot tell you which you hit. Setting the
  source `maxzoom` correctly makes MapLibre overzoom the last level instead of
  requesting tiles that will never exist.
- A `dynamic` tile cache also exists (max zoom 14–22) and returns `200` with a
  zero-byte body for empty tiles. It is generated per request, so it is slower;
  the static cache is preferred, with overzoom covering high zooms.
- Peat is only published as a **colour-baked RGBA raster** (indigo `#6872b5`,
  alpha carrying the mask). It cannot be recoloured or queried by feature, and
  at low zoom the downsampled alpha makes it faint. This is why the "peatland
  fires" KPI stays unimplemented — there is no polygon to intersect.

Known-dead endpoints (BIG, BNPB, Kemenhut, BRGM, Dukcapil, ECMWF WMS) are documented in `AGENTS.md` — do not retry without new information.

### 4.2 Basemaps

All four basemaps are plain raster tiles. An earlier iteration streamed a
Protomaps OSM vector basemap extracted from source.coop; it was dropped because
nothing in this app needs vector basemap features — no building-level analysis,
and population impact is handled by the Kontur layer — so a 100 MB+ build
artifact and a hand-maintained style bought nothing over OSM's raster tiles.
(If building footprints ever become interesting, `data.source.coop` serves
`vida/google-microsoft-open-buildings` as per-country FlatGeobuf, and its
objects honour CORS and HTTP Range.)

### 4.3 BIG SatuPeta — official Indonesian layers

`https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer`

The one `.go.id` geoportal that works from a browser: keyless, and it echoes the
request Origin in `Access-Control-Allow-Origin`. It is a dynamic MapServer with
no tile cache, so it is queried as GeoJSON (`src/lib/big.ts`):

- `maxAllowableOffset=0.002` (~220 m) simplifies server-side — KHG over
  Kalimantan drops from 5 MB to 115 kB with all 101 features intact.
- `resultOffset`/`resultRecordCount` page around the 1000-feature cap.
- Layers load lazily on first toggle, and are cached for the session.

Layers used: **6** Lahan Gambut, **37** KHG, **47** Rawan Kebakaran Hutan dan
Lahan, **48** Fungsi Ekosistem Gambut. Others worth a look: 0 penutup lahan,
7 DAS, 17 curah hujan, 49 lahan kritis, 57 mangrove, 58 rawan banjir.

**Coverage differs sharply between the peat layers, and it changes the answer.**
Measured over Kalimantan against 3,895 detections:

| Layer                        | Area       | Fires on it |
| ---------------------------- | ---------- | ----------- |
| 6 — Lahan Gambut             | 45,486 km² | **30.7%**   |
| 37 — KHG                     | 8,758 km²  | 1.6%        |
| 48 — Fungsi Ekosistem Gambut | 8,712 km²  | 1.6%        |

Layer 6 matches Kalimantan's known ~50,000 km² of peat. Layers 37 and 48 are a
partial publication — 78 of the 101 KHG units are in Kalimantan Barat, and
Kalimantan Tengah is barely represented. A "fires on peat" figure built on KHG
reads 1.6% instead of ~31%: precise-looking and wrong. The KPI uses layer 6;
37 and 48 are for inspecting a place, not for totalling one.

Verify before trusting any of these: total a layer's area and compare it to the
known real-world figure.

### 4.4 CAMS haze animation (ECMWF public WMS)

`https://eccharts.ecmwf.int/wms/?token=public` — the service behind
[Fire Emissions Watch](https://apps.atmosphere.copernicus.eu/fire-emissions-watch/).
Keyless, CORS echoes the Origin, EPSG:3857 supported.

- `composition_bbaod550` — aerosol optical depth from **biomass burning only**,
  i.e. the smoke plume separated from dust and sea salt. This is the haze layer.
- `composition_pm2p5` — surface concentration, what people actually breathe.
- Also available: `composition_aod550`, `composition_duaod550` (dust),
  `composition_pm10`, `composition_fire`.

Two properties drive the implementation (`src/lib/cams.ts`, `src/layers/cams.ts`):

1. **Render-on-demand.** Every GetMap spawns a plot worker and 302s to a
   `/streaming/….png`. A tile pyramid would mean dozens of renders per pan, so
   each layer is a single MapLibre `image` source over a bbox wider than the
   AOI (so its straight edge stays off-screen), swapped via `updateImage`.
2. **Time dimension.** GetCapabilities reports
   `…/PT3H` — 72 three-hourly steps, ~5 days of analysis plus ~4 of forecast.
   That is the animation. Capabilities is ~600 kB raw but ~22 kB gzipped, and is
   fetched once, lazily, on first toggle. The timeline opens on the step nearest
   now and badges later steps as *forecast*.

The WMS styles are designed as standalone charts, not overlays — they paint a
colour at every value (only 22–29 % of pixels are transparent), so the layers
ship at 0.5 opacity.

## 5. Layer rendering model

- The map owns a **single inline style** (background + 3 basemap raster layers). Everything else is added/removed imperatively by `MapView` effects that subscribe to the Zustand store.
- Each registry descriptor implements `add(map)`, `remove(map)`, `setOpacity(map, v)`. The sync effect diffs desired vs. applied state on every store change.
- Overlay ordering is controlled by inserting layers above the basemap stack in registry order.
- FIRMS data flows: `useFirms` hook → store (`firesGeojson`, status) → `setData` on the fire GeoJSON source → circle + heatmap layers re-render.

## 6. KPI methodology (scaffold)

Computed client-side, recomputed when fire data refreshes:

| KPI                | Method                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Active fires       | count of FIRMS points                                                                                                    |
| Total FRP          | sum of `frp` (MW)                                                                                                        |
| Affected kecamatan | turf point-in-polygon of fire points against `kecamatan_kalimantan.geojson` (bbox pre-filter), count of unique kecamatan |
| Fires on peat      | turf point-in-polygon of fire points against BIG layer 6 (Lahan Gambut), shown as a count and a share of all detections   |

Cards are removed rather than left as a permanent "—": an empty card reads as
"zero", not as "not measured". A "population exposed" card was dropped for that
reason — a fire-buffer sum over the Kontur H3 hexes is worth doing, but it needs
the hexes as data rather than as vector tiles (which only cover the viewport),
so it belongs in the pipeline, not the browser.

## 7. Caveats

- FIRMS NRT detections are **not** confirmed fires; confidence/filtering is exposed via point styling but no ground-truthing is applied.
- GIBS `default` time may lag real time by hours; AOD is a column-integrated measure, not ground-level PM2.5.
- Kontur population is a modeled H3 grid (2022 vintage), not census counts.
- "Fires on peat" counts detections whose centroid falls on mapped peat soil. VIIRS pixels are ~375 m, so a detection near a peat edge may be attributed either way; and peat maps are themselves generalised.
- CAMS is a model reanalysis/forecast at ~40 km resolution, not measurement. It shows where smoke is *modelled* to be, which is the right tool for plume direction and the wrong one for a specific address.
- Concession boundaries are **where** a permit applies, not proof of who lit a fire. A detection inside a concession is a question worth asking, not an attribution. Coverage is also uneven — `gfw_oil_palm` includes plenty of "Unknown Concession" polygons, and Malaysian Borneo is mapped alongside Kalimantan.
- `idn_forest_area` (2017) and `idn_forest_moratorium` (2020) are the newest versions GFW publishes; both are older than the fire data they are shown against.
- Indonesian government (`.go.id`) endpoints are unreliable from most networks; KHG requires a token we do not have.
