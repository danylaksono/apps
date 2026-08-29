# METHODOLOGY.md — Agni

How Agni sources, processes, and visualises data. Read this before adding or modifying layers.

## 1. Scope

- **Geography:** Indonesia, nationally. FIRMS is requested over the bbox `94.9,-11.2 → 141.1,6.2` and clipped to the kab/kota outline afterwards — no rectangle around Indonesia excludes its neighbours, so the raw response arrives with strips of Malaysia, Brunei, Timor-Leste, PNG and the southern Philippines that stop dead at the bbox edge.
- **Theme:** immediate impact of forest/peatland fires — active detections, haze and its forecast, burnt area, deforestation history, and exposed population.
- **Administrative depth:** **kab/kota** for analysis (514 polygons; the clip and the "kabupaten affected" KPI), kecamatan for display only (`kel_desa` dropped for size).

## 2. Design principles

1. **Static-first, keyless-first.** Boundaries are pre-baked into PMTiles and population into Parquet, served from `public/data/` — no tile server, no API key. Every live source but FIRMS is keyless.
2. **Live layers degrade gracefully.** FIRMS (API key), GIBS (keyless), KHG (token-gated) are optional. If a source fails, the layer is marked unavailable in the UI; the rest of the map keeps working.
3. **Config-driven layers.** Every layer is a typed descriptor in `src/layers/registry.ts`. Adding a layer = appending a descriptor; the store, panel, legend, and map sync pick it up automatically.
4. **Client-side analytics.** KPIs and charts are computed in the browser — turf.js for spatial joins, DuckDB-WASM for the population aggregates. No backend.
5. **One filter, one truth.** The filter row scopes the map, the KPI cards and every chart from a single `FireFilters` object, so the three cannot disagree.

## 3. Data pipeline (`pipeline/build_tiles.py`)

Local source data lives outside this repo. The pipeline reads it, processes it, and writes the app's `public/data/`:

| Input                                            | CRS           | Notes                                           |
| ------------------------------------------------ | ------------- | ----------------------------------------------- |
| `geo/provinsi.geojson`                           | EPSG:4326     | 38 features                                     |
| `geo/kab_kota.geojson`                           | EPSG:4326     | 514 features                                    |
| `geo/kecamatan.geojson`                          | EPSG:4326     | 7,275 features                                  |
| `kontur_population_ID.gpkg` (layer `population`) | **EPSG:3857** | 874,919 H3 hexagons, columns `h3`, `population` |

Steps:

1. **Stage** all three boundary levels nationally into one GeoJSON with a `level` property.
2. **Tile to PMTiles** via pyogrio's MVT driver → MBTiles → `pmtiles.convert` (`pipeline/tile.py`; no tippecanoe):
   - `public/data/boundaries.pmtiles` — one `boundaries` layer filtered by `level`, z2–z12, 37 MB
3. **Emit the analysis copy:** `public/data/kabkota_indonesia.geojson` — 514 polygons, simplified 0.008°, written at `COORDINATE_PRECISION=5`. Backs both the fire clip and the "kabupaten affected" KPI.
4. **Emit population as Parquet**, not tiles: `public/data/population_h3.parquet` — 874,919 rows of `h3` (res 8) with res-7/6/5 parents and `kab_kota_code`/`provinsi_code` precomputed, 3.9 MB.

Population is not tiled since it's served as kontur H3 hexagons, which are geometry-free and queried in the browser by DuckDB-WASM. The full PMTile would be 113 MB, past GitHub's 100 MB per-file limit.

PMTiles are consumed via the `pmtiles` JS protocol. Fully static deploy.

## 4. Live / remote sources

| Source                  | Access                           | Method                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ----------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **NASA FIRMS**          | API key (in `src/lib/config.ts`) | `GET /api/area/csv/{KEY}/{SOURCE}/{bbox}/{days}` → CSV parsed to GeoJSON in-browser. Default source `VIIRS_SNPP_NRT`, **5 days** (the NRT endpoint rejects more — "Invalid day range. Expects [1..5]"), national bbox, then clipped to the kab/kota outline. Note: source IDs use **underscores**; the `/api/country` path is invalid — always use `/api/area`. `days=1` means "today so far (UTC)" and returns a header-only CSV for the first hours of each UTC day, which reads as "no fires" rather than "no data yet" — hence 2. |
| **NASA GIBS**           | keyless                          | RESTful WMTS tiles: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/{LAYER}/default/{TIME}/{TILEMATRIXSET}/{z}/{y}/{x}.png`. Used as MapLibre raster sources. AOD: `MODIS_Aqua_Aerosol` (max z6). Smoke: `MODIS_Terra_CorrectedReflectance_TrueColor` (max z9). Time dimension `default` = latest available.                                                                                                                                                                                                                      |
| **BIG SatuPeta**        | keyless, CORS-open               | Official Indonesian layers as GeoJSON: peat, KHG and fire hazard (§4.3), plus KLHK's forest estate, pelepasan and social forestry (§4.4). Replaces the token-gated `services8.arcgis.com` KHG service, which is gone from the app.                                                                                                                                                                                                                                                                                                                                                                   |
| **CAMS (ECMWF WMS)**    | keyless (`token=public`)         | Animated haze — biomass-burning AOD and surface PM2.5, 3-hourly with forecast. See §4.6.                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| **Global Forest Watch** | keyless, CORS-open               | Peat, concession and protection context. Static vector tiles `https://tiles.globalforestwatch.org/{dataset}/{version}/default/{z}/{x}/{y}.pbf` (the MVT `source-layer` equals the dataset name); peat is a raster cache at the same path with `.png`. Versions are pinned in `GFW_DATASETS` — see §4.1.                                                                                                                                                                                                                               |
| **Basemaps**            | keyless                          | OpenFreeMap Dark and Positron (vector), Esri World Imagery and OpenStreetMap standard (raster). CARTO's Dark Matter and Voyager filled the dark and light slots until CARTO put basemap tiles behind an API key; OpenFreeMap serves the same OpenMapTiles schema with no key and no rate limit, but vector only. The rasters are pre-registered in the base style; each vector style is fetched on first use, its layer ids prefixed, and spliced in below the overlays — so switching stays a visibility toggle either way, with no `setStyle` churn. All OFM styles share one `openmaptiles` source, so a second vector basemap costs no tiles. OSM is capped at z19 per the OSMF tile policy.                                                                                                                                                                                                                                                                                                        |

### 4.1 Global Forest Watch context layers

GFW's public data API is the practical replacement for the dead Indonesian
government geoportals (sorry): no key, `Access-Control-Allow-Origin: *`, and it carries
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
  cache. The static cache 404s both past its max zoom _and_ on genuinely empty
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

Known-dead endpoints: BIG, BNPB, Kemenhut, BRGM, Dukcapil, ECMWF WMS (most are token-gated ArcGIS services). GFW is the only one that works from a browser.

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
- **Pages are fetched four at a time.** The service takes 15–45 s per page from
  a browser — measured Aug 2026, several times slower than the same query from
  Node — so strictly sequential paging put the forest estate's five pages at
  over two minutes. A wave of four brought the same load to ~14 s.
- Layers load lazily on first toggle, and are cached for the session.

Layers used: **6** Lahan Gambut, **37** KHG, **47** Rawan Kebakaran Hutan dan
Lahan, **48** Fungsi Ekosistem Gambut. Others worth a look: 0 penutup lahan,
7 DAS, 17 curah hujan, 49 lahan kritis, 57 mangrove, 58 rawan banjir.

**Coverage differs between the available peat layers, and it changes the answer.**
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

### 4.4 BIG SatuPeta — KLHK forestry layers

`https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/KEHUTANAN/MapServer`

The forestry folder of the same service, republishing KLHK's own maps
(`serviceDescription: "KEHUTANAN 08-08-2024"`). This is as close to a working
ministry endpoint as exists from here — every `menlhk.go.id` host fails to
resolve — and it matters more than the other context layers because
`Penetapan Kawasan Hutan` is **national and small enough to hold in memory**,
which none of the peat layers are.

| Layer | Name | Features | Payload | Used |
| --- | --- | --- | --- | --- |
| 0 | Penetapan Kawasan Hutan | 4,487 | 12.9 MB | yes |
| 2 | Hutan Tanaman Rakyat | 471 | 0.3 MB | yes |
| 7 | Peta Pelepasan Kawasan Hutan | 2,396 | 1.2 MB | yes |
| 13 | Hutan Desa (PPHD) | 1,351 | 0.8 MB | yes |
| 3 | Hutan Adat | 0 | — | published but empty |
| 5 | NSDH Fungsi Kawasan Hutan | — | — | HTTP 400 on any query |
| 12 | Hutan Kemasyarakatan (HKm) | — | — | HTTP 400 on any query |
| 11 | PPTPKH | 2,725 | ~25 MB | too heavy (9 MB per 1,000) |
| 6 | NSDH Penutup Lahan | — | — | too large to count, let alone page |
| 14 | Peta Rawan Erosi | 306,265 | — | too large; 50 s just to count |

The service does not gzip, so those are wire bytes.

**Decoding `fungsitap`.** Layer 0 carries its legal class as a bare KUGI code,
with no lookup on the service: the renderer is one flat symbol and `namobj` is
`"-"` on all 4,487 rows. The mapping in `src/lib/forest.ts` was derived from the
data — grouping the `nkws` (kawasan name) prefixes each code carries, then
checking the resulting areas against KLHK's published statistics:

| Code | Class | Area | Cross-check |
| --- | --- | --- | --- |
| `100100` | Hutan lindung | 24.9 M ha | HL ~29.6 M ha designated |
| `100300` | Produksi tetap (HP) | 21.5 M ha | HP ~29 M ha designated |
| `100400` | Produksi terbatas (HPT) | 20.9 M ha | HPT ~26 M ha designated |
| `100240` / `100241` | Taman nasional (+ laut) | 15.1 M ha | TN ~16 M ha |
| `100500` | Produksi konversi (HPK) | 5.1 M ha | HPK ~12 M ha designated |
| `1002xx` (rest) | CA / SM / TWA / TB / Tahura | 9.4 M ha | |
| `100000`, `1007300`, `5001xx`, `5003xx` | unclassified | 0.34 M ha | folded into "lain" |

Every class lands below its designated figure by roughly the gap you would
expect between designated and gazetted land, which is the check that makes the
mapping trustworthy rather than plausible. Total: **97.5 M ha over 34
provinces**, against ~125 M ha designated.

**Penetapan is gazettement, not designation.** This is the settled estate, so
land that is designated but not yet gazetted falls in the "di luar kawasan"
bucket when legally it is inside. Read that bar as an upper bound.

### 4.5 Anything else the user pastes

Everything above is hard-coded because the app has an opinion about it. Layers
the app has no opinion about are added at runtime instead — see
[LAYERS.md](LAYERS.md#user-added-layers). Two things about that are
methodological rather than cosmetic:

**BIG's public folder holds seven MapServers and this app wires up two.** The
rest are listed as one-click suggestions in the add dialog, and
`PERIZINAN_DAN_PERTANAHAN` is the one worth knowing about: IUPHHK-HA, -HTI and
-RE, mining WIUP, oil and gas working areas, PIPPIB and IPHPS — the same
concession classes GFW publishes, from the Indonesian licensing authority rather
than a third party, and as queryable features rather than tiles.

**`export` is the escape hatch for layers too large to page.** MapServer will
render any layer to an image for a bbox, which is the request MapLibre's
`{bbox-epsg-3857}` token exists for. Verified against BIG Aug 2026: 200,
`image/png`, CORS echoing the Origin, ~1.5 s for a 256 px tile. That is how a
306,265-feature layer like rawan erosi becomes visible at all. It is pixels, so
nothing can be counted from it and the popup cannot read it — which is exactly
why the built-in layers that back statistics are fetched as features instead.

### 4.6 CAMS haze animation (ECMWF public WMS)

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
   now and badges later steps as _forecast_.

The WMS styles are designed as standalone charts, not overlays — they paint a
colour at every value (only 22–29 % of pixels are transparent), so the layers
ship at 0.5 opacity.

## 5. Layer rendering model

- The map owns a **single inline style** (background + 3 basemap raster layers). Everything else is added/removed imperatively by `MapView` effects that subscribe to the Zustand store.
- Each registry descriptor implements `add(map)`, `remove(map)`, `setOpacity(map, v)`. The sync effect diffs desired vs. applied state on every store change.
- Overlay ordering is controlled by inserting layers above the basemap stack in registry order.
- FIRMS data flows: `useFirms` hook → store (`firesGeojson`, status) → `setData` on the fire GeoJSON source → the circle layers re-render.

## 6. KPI methodology

Computed client-side against **the filtered slice**, not the whole download — the
cards, the charts and the map all read the same `FireFilters`.

| KPI                     | Method                                                                                               |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Active fires            | count of filtered FIRMS points                                                                       |
| Total FRP               | sum of `frp` (MW)                                                                                    |
| Kabupaten affected      | turf point-in-polygon against `kabkota_indonesia.geojson` (bbox pre-filter), unique kab/kota, of 514 |
| Fires on peat           | point-in-polygon against BIG layer 6, as a count and a share **of Kalimantan detections**            |
| People near active fire | Kontur population in res-7 H3 cells containing or adjacent to a detection (~2 km), summed in DuckDB  |
| Inside the forest estate | point-in-polygon against BIG KEHUTANAN layer 0, as a count and a **national** share |
| Fires by forest status  | the same tag, counted per legal class with "di luar kawasan" as the residual                        |

Three of those need their reasoning stated, because the number is meaningless without it:

**Fires on peat is scoped to Kalimantan.** BIG layer 6 returns 146 polygons
nationally and every one is on Borneo — Sumatra and Papua peat is simply absent
from the service. The share is therefore taken over Kalimantan detections, not
national ones, or it would shrink for no reason as the rest of the country burns.

**"Inside the forest estate" is national, unlike the peat figure, and its
denominator is every filtered detection.** The layer covers 34 provinces, so
there is no scoping to explain away — but it counts *gazetted* land only, so the
outside-the-estate residual is an upper bound on fires outside kawasan hutan.
The forest chart is computed from the slice scoped by everything except the
forest filter itself, so the class shares stay comparable as you click between
them and the percentage keeps its denominator.

**Exposure is only as meaningful as its radius and window.** The same detections
give 2.1 M at ~1 km over 24 h and 84 M at ~5 km over 5 days — a 40× spread, and
the wide figure covers 22% of the country and mostly describes Java's density.
The tile prints its radius and window on its face for that reason.

Attribution comes from the **kab/kota polygon join**, never from the population
Parquet: Kontur only stores populated hexagons, so joining detections to it by
H3 leaves ~70% unattributed — forest and peat fires are by definition where
nobody lives — and ranks Java top. The polygon join attributes 97.7%. That join
runs once, in `clipToIndonesia`, which tags every detection with its `provinsi`
and `kabkota`; everything downstream counts tags rather than repeating it.

Cards are removed rather than left as a permanent "—": an empty card reads as
"zero", not as "not measured".

## 7. Caveats

- FIRMS NRT detections are **not** confirmed fires; confidence/filtering is exposed via point styling but no ground-truthing is applied.
- GIBS `default` time resolves to _today_, which 404s until the day's granules are processed; dates are probed over the area of interest instead. AOD is a column-integrated measure, not ground-level PM2.5.
- Copernicus burnt area is daily at 300 m and genuinely sparse day to day — burn scars accumulate, so a single date shows very little. Its "no burn" class is opaque and is stripped in the browser.
- Tree cover loss is annual (UMD/Hansen, pinned to v1.13) and is history, not a current-season signal.
- Kontur population is a modeled H3 grid (2022 vintage), not census counts.
- "Fires on peat" counts detections whose centroid falls on mapped peat soil. VIIRS pixels are ~375 m, so a detection near a peat edge may be attributed either way; and peat maps are themselves generalised.
- CAMS is a model reanalysis/forecast at ~40 km resolution, not measurement. It shows where smoke is _modelled_ to be, which is the right tool for plume direction and the wrong one for a specific address.
- Concession boundaries are **where** a permit applies, not proof of who lit a fire. A detection inside a concession is a question worth asking, not an attribution. Coverage is also uneven — `gfw_oil_palm` includes plenty of "Unknown Concession" polygons, and Malaysian Borneo is mapped alongside Kalimantan.
- `idn_forest_area` (2017) and `idn_forest_moratorium` (2020) are the newest versions GFW publishes; both are older than the fire data they are shown against. The KLHK penetapan layer (2024) is the one to count against; the GFW copy is kept only because it is tiled and therefore instant.
- **A fire inside kawasan hutan is a jurisdiction, not a verdict.** The forest-status breakdown says which agency owns the land, not who lit it — HPK in particular is *meant* to be converted, so fires there are frequently permitted clearing rather than wildfire.
- `Pelepasan kawasan hutan` is published by BIG with no attributes at all beyond the province code, so the layer can be seen but its permits cannot be named.
- A layer added through "Add a remote layer" carries **no caveat of ours**. The built-in layers are described with their coverage, vintage and known gaps because someone checked; a pasted URL has been checked by nobody. Treat what it draws with the same suspicion you would treat the service it came from.
- Indonesian government (`.go.id`) endpoints are unreliable from most networks; BIG SatuPeta in particular goes down for stretches, and layers that hit their `maxFeatures` cap report "partial coverage" rather than implying they drew everything.
