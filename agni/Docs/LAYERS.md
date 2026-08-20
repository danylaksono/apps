# LAYERS.md — Agni layer catalog

Every layer is a descriptor in `src/layers/registry.ts`. IDs are stable — the Zustand store keys visibility, opacity and mode by them.

## Basemaps (mutually exclusive)

| ID          | Source                       | Type   | Notes                         |
| ----------- | ---------------------------- | ------ | ----------------------------- |
| `dark`      | CARTO Dark Matter            | raster | default                       |
| `satellite` | Esri World Imagery           | raster |                               |
| `osm`       | OpenStreetMap standard tiles | raster | capped at z19 per OSMF policy |
| `light`     | CARTO Voyager                | raster |                               |

## Overlay layers

Scope is **national** (Indonesia). FIRMS is requested over the national bbox and clipped to the kab/kota outline; see METHODOLOGY.md.

| ID | Group | Label | Source | Type | Default |
| --- | --- | --- | --- | --- | --- |
| `fires` | Fire | Active fires | FIRMS `/api/area/csv`, **5 days**, national bbox | circle (FRP-scaled, confidence-coloured) | **on** |
| `fires-heat` | Fire | Fire heatmap | derived from FIRMS points | heatmap | off |
| `fire-glyphs` | Fire | Fire glyphs | derived from the filtered FIRMS set | canvas donut DOM markers | off |
| `burnt-area` | Fire | Burnt area (Copernicus 300 m) | CLMS `ba_global_300m_daily_v4` WMTS, decoded | raster (protocol) | off |
| `fire-hazard` | Fire | Fire hazard (rawan karhutla) | BIG SatuPeta layer 47 | fill | off |
| `haze-aod` | Haze | Aerosol Optical Depth | GIBS `MODIS_Aqua_Aerosol` WMTS, dated | raster | off |
| `haze-smoke` | Haze | True-color smoke | GIBS `MODIS_Terra_CorrectedReflectance_TrueColor`, dated | raster | off |
| `night-lights` | Haze | Night lights (Black Marble) | GIBS `VIIRS_Black_Marble` (static 2016) | raster | off |
| `haze-cams-smoke` | Haze | CAMS smoke (biomass burning AOD) | CAMS via ECMWF WMS, 3-hourly + forecast | image (time-animated) | off |
| `haze-cams-pm25` | Haze | CAMS surface PM2.5 | CAMS via ECMWF WMS, 3-hourly + forecast | image (time-animated) | off |
| `population` | Population | Population (Kontur H3) | `population_h3.parquet` via DuckDB-WASM | fill (per-viewport GeoJSON) | off |
| `tree-cover-loss` | Concessions | Tree cover loss (2001–2025) | GFW `umd_tree_cover_loss` v1.13, decoded | raster (protocol) | off |
| `boundaries-kecamatan` | Boundaries | Kecamatan | `boundaries.pmtiles` / `kecamatan` | line | off |
| `boundaries-kabkota` | Boundaries | Kabupaten/Kota | `boundaries.pmtiles` / `kab_kota` | line | **on** |
| `boundaries-provinsi` | Boundaries | Provinsi | `boundaries.pmtiles` / `provinsi` | line | **on** |
| `peat-extent` | Peatland | Lahan gambut (peat soil) | BIG SatuPeta layer 6 — **Kalimantan only** | fill + line | **on** |
| `peat-khg` | Peatland | KHG | BIG SatuPeta layer 37 — partial coverage | fill + line | off |
| `peat-function` | Peatland | Fungsi ekosistem gambut | BIG SatuPeta layer 48 — partial coverage | fill + line | off |
| `conc-oil-palm` | Concessions | Oil palm concessions | GFW `gfw_oil_palm` | fill + line | off |
| `conc-rspo` | Concessions | RSPO oil palm mills | GFW `rspo_oil_palm` | fill + line | off |
| `conc-wood-fiber` | Concessions | Pulpwood (HTI) | GFW `gfw_wood_fiber` | fill + line | off |
| `conc-logging` | Concessions | Logging (HPH) | GFW `gfw_logging` | fill + line | off |
| `conc-mining` | Concessions | Mining concessions | GFW `gfw_mining_concessions` | fill + line | off |
| `prot-moratorium` | Protection | Moratorium (PIPPIB) | GFW `idn_forest_moratorium` | fill + line | off |
| `prot-forest-area` | Protection | Kawasan hutan | GFW `idn_forest_area` | fill (by class) + line | off |
| `prot-wdpa` | Protection | Protected areas (WDPA) | GFW `wdpa_protected_areas` | fill + line | off |

## The filter row

`FireFilters` writes one `FireFilters` object to the store — time window (or a pinned day), confidence classes, day/night, minimum FRP, and an optional area scope set by clicking a chart bar. It scopes **the map layers, the KPI cards and every chart at once**, so the three cannot disagree.

The map applies it as a MapLibre `filter` expression (`fireFilterExpression`) rather than re-slicing the source: the whole five-day set stays loaded and a filter change is a repaint, not a refetch. `applyFireFilters` is the same predicate in JS, used where an expression cannot reach.

**Clustering is the exception.** MapLibre clusters at the *source*, below where a layer filter reaches, so `fire-glyphs` is fed data that is already filtered (`currentFilteredFires()` in `apply.ts`).

## Styling conventions

- **Fires:** circle radius scales with `frp`; colour by `confidence` (low amber, nominal orange, high red).
- **Fire glyphs:** canvas donuts as DOM markers. Ring splits by **FRP class** (YlOrRd, semantic heat, with a scale legend); inner arc is the night-overpass share in a blue deliberately outside the FRP ramp; radius and centre number are the count. Two modes — `cluster` and `province` — one at a time, drawn by the same function so they read against each other.
- **Population:** single-hue teal ramp, dark→light, coloured by **density (people/km²)** not headcount — an aggregated res-5 cell holds ~343× the people of a res-8 one, so a ramp on the raw sum would change meaning at every zoom.
- **Peat:** violet `#8b5cf6` fill + lighter outline; KHG `#3ddc97`; fungsi ekosistem blue.
- **CAMS haze:** sequential, alpha-ramped WMS styles — smoke `sh_Oranges_aod` spun to magenta, PM2.5 `sh_OrangesTransparent240` spun to violet, both via `raster-hue-rotate`. The defaults are rainbows and were replaced; see METHODOLOGY.md.
- **Tree cover loss:** lime ordinal ramp, brightest for recent years.
- **Context polygons:** faint fill + brighter outline, cool hues so nothing competes with the fire palette.

Chart colours live in `src/lib/chartTokens.ts` and are **not** the map tokens reused: dark-mode marks want OKLCH lightness 0.48–0.67, and the map's fire/haze tokens sit above that band.

## Render order

`GROUP_RANK` fixes bottom-to-top order (peatland → concessions → protection → population → haze → boundaries → fire) and `apply.ts` re-asserts it whenever the set of present layers changes. A descriptor creating more than one map layer must list them all in `mapLayerIds` or they will not be reordered.

## Dated rasters

`haze-aod`, `haze-smoke` and `burnt-area` all carry a date in their tile URL and share **one** offset (`rasterDayOffset`), driven by `RasterTimeline`. `setTiles` repoints an existing source rather than rebuilding it, so stepping a day does not flash the layer away. `night-lights` is a static 2016 composite and deliberately ignores the slider.

GIBS' `default` time resolves to *today*, which 404s until the day's granules are processed — `lib/gibs.ts` probes backwards over the area of interest instead. Probing must be at the AOI, not globally: a day whose only swath clipped the Pacific answers "yes" to a global probe and then renders nothing here.

## Encoded rasters

Two sources ship data in pixels rather than colour, and MapLibre 6 has no `raster-color`. Both decode through `addProtocol`, alongside PMTiles:

| Layer | Encoding | Module |
| --- | --- | --- |
| `tree-cover-loss` | B = year − 2000, R = intensity, A = loss mask | `lib/gfwRaster.ts` |
| `burnt-area` | pre-styled, but "no burn" is an **opaque** `#fcfdbf` over all land | `lib/clms.ts` |

## Click-to-inspect

Clicking the map reports every layer under the cursor in render order (`src/lib/inspect.ts`), **and** sets the CAMS probe point for the forecast charts in the rail. Glyph markers have their own popups. Raster layers cannot be queried this way — they answer visually only.

## Availability states

Layers depending on live sources report `checking → ok | unavailable` to the store. Unavailable layers render disabled with the reason; a layer that loaded but hit its `maxFeatures` cap stays `ok` with a "partial coverage" note rather than implying it drew everything.

## Adding a layer

1. Append a `LayerDescriptor` to `src/layers/registry.ts`. For a GFW polygon dataset use the `gfwPolygonLayer()` factory in `src/layers/gfw.ts`; for a CAMS WMS layer use `camsImageLayer()` in `src/layers/cams.ts`.
2. If it needs fetched data, add a module in `src/lib/` and wire the sync in `MapView`. Note that the store imports the registry, so **the registry must not import the store** — pass values in through a small module the way `lib/rasterDate.ts` does.
3. Update this file and `METHODOLOGY.md`.
