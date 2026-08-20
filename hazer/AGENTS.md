# AGENTS.md — Hazer

Project context and knowledge base for AI agents working on this repository.

## Project Overview

**Hazer** is a map-focused analysis web app (MapLibre GL) to visualize and overlay the immediate impact of forest/peatland fires in Indonesia, with a focus on **Kalimantan**. It layers active fire points, haze/aerosol data, Kontur population hexagons (choropleth), administrative boundaries, and peatland (KHG) boundaries. The interface is a dark, "situational room" style map with toggleable layers, multiple basemaps, and KPI cards (to be added).

## Tech Stack (decided)

- **Vite + React + TypeScript**
- **MapLibre GL JS** (`maplibre-gl`) — chosen because the user wants to draw overlay chart layers later
- **Zustand** for state (layer visibility/opacity, basemap, KPIs)
- **Tailwind CSS v4** (via `@tailwindcss/vite` plugin)
- **@turf/turf** for spatial analysis (KPI computation)
- **@phosphor-icons/react** for icons — **NOT Lucide**
- **Fonts:** Space Grotesk (display) + Inter (UI) — **NOT IBM Plex**
- **pmtiles** protocol for static vector tiles (no tile server needed)

## Scope (confirmed with user)

- Focus: **Kalimantan** (recent haze season)
- Boundaries: down to **kecamatan** level (drop `kel_desa`)
- Framework: React + TS (confirmed)
- Config-driven layer system so more layers can be added later (Zustand)

## API Keys (provided by user)

| Service        | Key                                    | Notes                                                                 |
| -------------- | -------------------------------------- | --------------------------------------------------------------------- |
| NASA FIRMS     | `eda46120c69739d3b51b05ae8dd3584a`     | Valid for FIRMS Global + US/Canada. Limit: 5000 transactions / 10 min |
| Copernicus CDS | `a556c3b5-8532-4e33-abeb-a91f256acb7d` | URL: `https://cds.climate.copernicus.eu/api`                          |

## Data Sources — Research Findings

### ✅ WORKING / VALIDATED

| Source               | Endpoint / Path                                                                                              | Notes                                                                                                                                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Local boundaries** | `D:\personal\github\reach-ops\local-data\geo\*.geojson`                                                      | `provinsi`, `kab_kota`, `kecamatan`, `kel_desa`. EPSG:4326. Columns: `code`, `name`, `name_norm`, `provinsi_code/name/norm`, `kab_kota_code/name/norm`, `kecamatan_code/name/norm` (nested hierarchy).                                                                       |
| **Local population** | `D:\personal\github\reach-ops\local-data\kontur_population_ID.gpkg`                                          | Layer `population`. Columns: `h3`, `population`, `geometry` (H3 hexagons, **EPSG:3857** — must reproject to 4326).                                                                                                                                                           |
| **NASA FIRMS**       | `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/{bbox}/{days}`                             | **Key confirmed working.** Source IDs use **underscores**: `VIIRS_NOAA21_NRT`, `VIIRS_SNPP_NRT`, `VIIRS_NOAA20_NRT`, `MODIS_NRT`. CSV columns: `latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight`. |
| **Copernicus CAMS**  | `https://apps.atmosphere.copernicus.eu/fire-emissions-watch/`                                                | Page loads (SPA). Underlying data via CDS API (key provided).                                                                                                                                                                                                                |
| **BIG SatuPeta**     | `https://kspservices.big.go.id/satupeta/rest/services/PUBLIK/SUMBER_DAYA_ALAM_DAN_LINGKUNGAN/MapServer`      | **Keyless, CORS echoes Origin, verified Aug 2026.** The one `.go.id` host that works. 60+ official layers; dynamic MapServer (no tile cache) so query `f=geojson` with `maxAllowableOffset`. Used: 6 lahan gambut, 37 KHG, 47 rawan karhutla, 48 fungsi ekosistem gambut. **Peat coverage differs 5x between layers — see METHODOLOGY §4.3 before computing anything.** |
| **CAMS / ECMWF WMS** | `https://eccharts.ecmwf.int/wms/?token=public`                                                              | **Keyless.** Powers the Fire Emissions Watch animation. `composition_bbaod550` (smoke), `composition_pm2p5`. 3-hourly time dimension, ~5 d analysis + ~4 d forecast. Renders on demand → use one `image` source, not tiles.                                                   |
| **Global Forest Watch** | `https://data-api.globalforestwatch.org` + `https://tiles.globalforestwatch.org`                          | **Keyless, CORS `*`, verified Aug 2026.** The working substitute for every dead `.go.id` geoportal. Carries peat, oil palm / pulpwood / logging / mining concessions, PIPPIB moratorium, kawasan hutan, WDPA. Versions + zoom limits must be read from the API, not guessed — see METHODOLOGY §4.1. |
| **source.coop**      | `https://data.source.coop/{account}/?list-type=2&prefix={repo}/`                                            | S3-style listing works and objects honour Range + CORS `*`. The `/api/v1/...` REST paths return the site's HTML shell — don't bother. Protomaps OSM basemap lives at `protomaps/openstreetmap/v4.pmtiles`; their README asks not to hotlink, so extract a subset instead.     |

### ❌ FAILED / UNRELIABLE (do NOT retry without new info)

| Source                 | Endpoint                                                                    | Failure                                                |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------ |
| **BIG**                | `https://geoservices.big.go.id/arcgis/rest/services`                        | 404                                                    |
| **BIG**                | `https://geoservices.big.go.id/server/rest/services`                        | 404                                                    |
| **BIG**                | `https://tanahair.indonesia.go.id/arcgis/rest/services`                     | 404                                                    |
| **BNPB InaRISK**       | `https://inarisk.bnpb.go.id/arcgis/rest/services`                           | 404                                                    |
| **BNPB**               | `https://gis.bnpb.go.id/arcgis/rest/services`                               | 500                                                    |
| **Kemenhut**           | `https://geoportal.menlhk.go.id/arcgis/rest/services`                       | DNS fail (getaddrinfo)                                 |
| **Kemenhut**           | `https://sipongi.menlhk.go.id`                                              | DNS fail (getaddrinfo)                                 |
| **BRGM**               | `https://webgis.brgm.go.id/arcgis/rest/services`                            | DNS fail                                               |
| **BRGM**               | `https://brgm.go.id/arcgis/rest/services`                                   | 404                                                    |
| **Dukcapil**           | `https://gis.dukcapil.kemendagri.go.id/arcgis/rest/services`                | SSL handshake timeout                                  |
| **NASA GIBS**          | `https://gibs.earthdata.nasa.gov/wms/eps4326/best/wms.cgi`                  | 404 (endpoint may have changed; needs re-verification) |
| **ECMWF WMS**          | `https://wms.ecmwf.int`                                                     | DNS fail — use `eccharts.ecmwf.int/wms` instead        |
| **KHG (ArcGIS)**       | `https://services8.arcgis.com/TWq7UjmDRPE14lEV/.../FeatureServer`           | Token required (499) — replaced by BIG SatuPeta        |
| **FIRMS country path** | `https://firms.modaps.eosdis.nasa.gov/api/country/csv/{KEY}/{SOURCE}/IDN/1` | "Invalid API call" — use **area/bbox** path instead    |

## Layer Catalog (planned)

| Group      | Layer                                  | Source                                                    |
| ---------- | -------------------------------------- | --------------------------------------------------------- |
| Basemap    | Satellite / Dark / Light               | Esri World Imagery, CARTO Dark Matter, CARTO Voyager      |
| Fire       | Active fire points (NOAA21/SNPP/MODIS) | FIRMS `/api/area/csv` with Kalimantan bbox                |
| Fire       | Fire heatmap + glow                    | derived from FIRMS points                                 |
| Haze       | Aerosol Optical Depth                  | NASA GIBS (keyless WMTS) — needs endpoint re-verification |
| Haze       | True-color smoke                       | NASA GIBS Corrected Reflectance                           |
| Haze       | CAMS PM2.5 / fire emissions            | Copernicus CDS (key provided) — optional                  |
| Population | Kontur H3 choropleth                   | PMTiles (from local gpkg)                                 |
| Boundaries | Provinsi / Kabupaten / Kecamatan       | PMTiles (from local geojson)                              |
| Peatland   | Lahan gambut (peat soil)               | BIG SatuPeta layer 6 — **on by default**, backs the KPI   |
| Peatland   | KHG / fungsi ekosistem gambut          | BIG SatuPeta layers 37 / 48 — partial coverage, context   |
| Fire       | Rawan karhutla (fire hazard)           | BIG SatuPeta layer 47                                     |
| Haze       | CAMS smoke + surface PM2.5             | ECMWF public WMS, animated over 72 3-hourly steps         |
| Concessions| Oil palm / RSPO / pulpwood / logging / mining | GFW vector tiles                                   |
| Protection | PIPPIB moratorium / kawasan hutan / WDPA | GFW vector tiles                                        |

## Architecture Decisions

- **Static-first, keyless-first**: core layers always render (pre-baked PMTiles + keyless sources); live/token-gated sources are optional, config-driven, and degrade gracefully.
- **Config-driven layer registry** (`src/layers/registry.ts`): each layer is a typed descriptor (id, group, label, icon, type, source spec, paint/layout, opacity, legend, enabled default). Adding a layer = appending a descriptor.
- **Zustand store** (`src/store/layers.ts`): per-layer visibility/opacity, active basemap, hovered feature, KPI results. Map effects subscribe and add/remove sources+layers reactively.
- **Data pipeline** (`pipeline/`, Python): converts local gpkg/geojson → PMTiles in `public/data/`. No tile server; fully static deploy.
- **KPI scaffold** (later): exposed population (H3 hexes in fire-buffer), active fire count, affected kabupaten/kecamatan count, peat area in buffer, max AOD — via turf.js.

## Current Project State

Everything below is built and verified running in a browser (18 overlay layers,
3,842 live FIRMS detections at time of writing).

- ✅ Vite + React + TS + Tailwind v4 + fonts
- ✅ Python pipeline → `boundaries.pmtiles`, `population.pmtiles`, `kecamatan_kalimantan.geojson`
- ✅ Zustand store + config-driven layer registry + diff-applier (`layers/apply.ts`)
- ✅ MapLibre map, basemap switcher, layer panel with opacity + legends
- ✅ Boundaries + Kontur H3 choropleth from PMTiles
- ✅ GIBS haze (AOD) + true-colour smoke
- ✅ FIRMS fire points + heatmap; KPI cards
- ✅ KHG best-effort layer (still token-gated → shows as unavailable)
- ✅ **GFW context layers** — peat (gambut), oil palm / RSPO / pulpwood / logging / mining concessions, PIPPIB moratorium, kawasan hutan, WDPA
- ✅ **Explicit render order** (`GROUP_RANK`) so context polygons stay under the fires
- ✅ **Click-to-inspect** popup reporting the full land-context stack under the cursor
- ✅ **BIG SatuPeta layers** — official lahan gambut (vector!), KHG, fungsi ekosistem gambut, rawan karhutla; lazily fetched as GeoJSON
- ✅ **"Fires on peat" KPI** — turf point-in-polygon against BIG layer 6, ~31 % in the current event
- ✅ **CAMS haze animation** — biomass-burning AOD + surface PM2.5, 72 three-hourly steps with forecast, play/scrub timeline
- ✅ OSM added as a plain raster basemap (the source.coop vector basemap was dropped — nothing here needed vector)
- ⬜ "Population exposed" KPI — needs the Kontur hexes as data, not vector tiles; belongs in the pipeline
- ⬜ Fires ∩ concessions KPI — blocked: GFW concessions arrive as vector tiles, so a count would only reflect the viewport

## Bugs fixed while resuming (don't reintroduce)

1. **Map never rendered.** The container used `absolute inset-0`, but
   `maplibre-gl.css` sets `.maplibregl-map { position: relative }` on that same
   element — equal specificity, loaded later, so it won. The container
   collapsed to height 0. Size it with `h-full w-full` instead.
2. **MapLibre worker 404 in dev.** Vite's dep optimizer rewrote the maplibre
   entry without emitting `maplibre-gl-worker.mjs`, so nothing painted.
   Fixed with `optimizeDeps: { exclude: ["maplibre-gl"] }`.
3. **FIRMS `days=1` returns an empty CSV** for the first hours of each UTC day.
   Default is now 2 days.
4. **Popup `closeOnClick: true`** races a click handler that opens a popup —
   MapLibre removes it on the same event. We close it ourselves instead.
5. **Store changes dropped during style load.** `applyMapState` returned early
   when `isStyleLoaded()` was false, and the store only notifies on change — so
   toggles made while tiles were in flight were lost for good. It now returns a
   boolean and `MapView` retries on the next `idle`.
6. **`source.setData()` on a source that does not exist yet** silently no-ops.
   An async fetch that resolves before its layer is added would lose its data
   permanently. `applyBigData` keeps loaded FeatureCollections in module state
   and re-pushes them on every sync until they land.
7. **CAMS image sources need a real placeholder.** Requesting a made-up
   timestamp returns an error body that fails to decode; use a 1x1 transparent
   data URI until the time dimension has loaded.

## Next steps

1. "Population exposed" KPI — bake population per kecamatan into
   `kecamatan_kalimantan.geojson` in the pipeline, then it is a lookup rather
   than a client-side spatial join over 875k hexes.
2. Fires ∩ concessions — needs the GFW concession polygons as data. Either bake
   a Kalimantan subset into the pipeline, or accept a viewport-scoped number
   and label it as such.
3. More BIG layers worth a look: 0 penutup lahan, 7 DAS, 17 curah hujan,
   49 lahan kritis, 58 rawan banjir.

## On DuckDB (asked, answered)

Not worth it here. The KPI workload is ~3,900 points against 146–7,000 polygons
— turf does that in a few ms, and the bottleneck is network fetches, not
compute. DuckDB-wasm would add ~3 MB of payload plus the spatial extension to
speed up the part that is already fast. It would start to pay off if we wanted
ad-hoc SQL across the full 875k-hex Kontur grid in the browser, or joins over
several large layers at once. Today the cheaper answer to the same questions is
to precompute in the Python pipeline, where geopandas already has the data.

## Environment Notes

- OS: Windows 11, PowerShell 7
- Python available (geopandas + pyogrio confirmed working)
- Indonesian government domains (`.go.id`) mostly fail to resolve from this machine — treat as unreliable but offer to retry if user has a better connection
- `npm create vite` requires `--no-interactive` flag to avoid interactive prompts
