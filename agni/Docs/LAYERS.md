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
| `forest-estate` | Forest estate (KLHK) | Kawasan hutan (penetapan, KLHK) | BIG SatuPeta **KEHUTANAN** layer 0 — 4,487 polygons, 97.5 M ha | fill (by class) + line | off |
| `forest-release` | Forest estate (KLHK) | Pelepasan kawasan hutan | BIG SatuPeta KEHUTANAN layer 7 — 2,396 polygons | fill + line | off |
| `forest-village` | Forest estate (KLHK) | Hutan desa (PPHD) | BIG SatuPeta KEHUTANAN layer 13 — 1,351 approvals | fill + line | off |
| `forest-htr` | Forest estate (KLHK) | Hutan tanaman rakyat (HTR) | BIG SatuPeta KEHUTANAN layer 2 — 471 areas | fill + line | off |
| `prot-forest-area` | Forest estate (KLHK) | Kawasan hutan (GFW tiles) | GFW `idn_forest_area` (2017 vintage) | fill (by class) + line | off |
| `conc-oil-palm` | Concessions | Oil palm concessions | GFW `gfw_oil_palm` | fill + line | off |
| `conc-rspo` | Concessions | RSPO oil palm mills | GFW `rspo_oil_palm` | fill + line | off |
| `conc-wood-fiber` | Concessions | Pulpwood (HTI) | GFW `gfw_wood_fiber` | fill + line | off |
| `conc-logging` | Concessions | Logging (HPH) | GFW `gfw_logging` | fill + line | off |
| `conc-mining` | Concessions | Mining concessions | GFW `gfw_mining_concessions` | fill + line | off |
| `prot-moratorium` | Protection | Moratorium (PIPPIB) | GFW `idn_forest_moratorium` | fill + line | off |
| `prot-wdpa` | Protection | Protected areas (WDPA) | GFW `wdpa_protected_areas` | fill + line | off |

## The filter row

`FireFilters` writes one `FireFilters` object to the store — time window (or a pinned day), confidence classes, day/night, minimum FRP, an optional area scope set by clicking a chart bar, and an optional **forest-status** scope set the same way. It scopes **the map layers, the KPI cards and every chart at once**, so the three cannot disagree.

The map applies it as a MapLibre `filter` expression (`fireFilterExpression`) rather than re-slicing the source: the whole five-day set stays loaded and a filter change is a repaint, not a refetch. `applyFireFilters` is the same predicate in JS, used where an expression cannot reach.

**Clustering is the exception.** MapLibre clusters at the *source*, below where a layer filter reaches, so `fire-glyphs` is fed data that is already filtered (`currentFilteredFires()` in `apply.ts`).

## Styling conventions

- **Fires:** circle radius scales with `frp`; colour by `confidence` (low amber, nominal orange, high red).
- **Fire glyphs:** canvas donuts as DOM markers. Ring splits by **FRP class** (YlOrRd, semantic heat, with a scale legend); inner arc is the night-overpass share in a blue deliberately outside the FRP ramp; radius and centre number are the count. Two modes — `cluster` and `province` — one at a time, drawn by the same function so they read against each other. The layer's slider is **size**, not opacity (`sliderLabel`): these are DOM markers, so paint properties never reach them, and a size that reads at street zoom is a speck across the archipelago.
- **Population:** single-hue teal ramp, dark→light, coloured by **density (people/km²)** not headcount — an aggregated res-5 cell holds ~343× the people of a res-8 one, so a ramp on the raw sum would change meaning at every zoom.
- **Peat:** violet `#8b5cf6` fill + lighter outline; KHG `#3ddc97`; fungsi ekosistem blue.
- **Forest estate:** one colour per legal class, greenest for strictest — konservasi `#34d399`, lindung `#2dd4bf`, HPT `#84cc16`, HP `#a3e635`, HPK `#facc15`. The table lives in `src/lib/forest.ts` and feeds the map paint expression, the panel legend *and* the forest-status chart, so the three cannot drift. Pelepasan is orange `#fb923c` because it is the one class in this group that means land has left the estate.
- **CAMS haze:** sequential, alpha-ramped WMS styles — smoke `sh_Oranges_aod` spun to magenta, PM2.5 `sh_OrangesTransparent240` spun to violet, both via `raster-hue-rotate`. The defaults are rainbows and were replaced; see METHODOLOGY.md.
- **Tree cover loss:** lime ordinal ramp, brightest for recent years.
- **Context polygons:** faint fill + brighter outline, cool hues so nothing competes with the fire palette.

Chart colours live in `src/lib/chartTokens.ts` and are **not** the map tokens reused: dark-mode marks want OKLCH lightness 0.48–0.67, and the map's fire/haze tokens sit above that band.

## Render order

`GROUP_RANK` fixes bottom-to-top order (peatland → forest → concessions → protection → population → haze → boundaries → custom → fire; user-added layers sit high, just under the fires, because someone who just pasted a URL wants to see what they added) and `apply.ts` re-asserts it whenever the set of present layers changes. A descriptor creating more than one map layer must list them all in `mapLayerIds` or they will not be reordered.

## Dated rasters

`haze-aod`, `haze-smoke` and `burnt-area` all carry a date in their tile URL and share **one** offset (`rasterDayOffset`), driven by `RasterTimeline`. `setTiles` repoints an existing source rather than rebuilding it, so stepping a day does not flash the layer away. `night-lights` is a static 2016 composite and deliberately ignores the slider.

GIBS' `default` time resolves to *today*, which 404s until the day's granules are processed — `lib/gibs.ts` probes backwards over the area of interest instead. Probing must be at the AOI, not globally: a day whose only swath clipped the Pacific answers "yes" to a global probe and then renders nothing here.

## Encoded rasters

Two sources ship data in pixels rather than colour, and MapLibre 6 has no `raster-color`. Both decode through `addProtocol`, alongside PMTiles:

| Layer | Encoding | Module |
| --- | --- | --- |
| `tree-cover-loss` | B = year − 2000, R = intensity, A = loss mask | `lib/gfwRaster.ts` |
| `burnt-area` | pre-styled, but "no burn" is an **opaque** `#fcfdbf` over all land | `lib/clms.ts` |

## Observation cadence

VIIRS SNPP is **one** satellite in a 13:30 sun-synchronous orbit, so it sees a given place about **twice a day**. Measured over Indonesia, detections land in two windows — roughly 03–07 and 15–19 UTC — with **8–9 hour voids** between them. Over the full five-day load a cluster is built from 6–10 observations; at the default 24 h filter it is built from **two**.

This is the single most important thing to know when reading anything time-shaped in this app, and it is why the glyph popup draws **one mark per overpass** (`overpassChartSvg` in `lib/fireGlyph.ts`) rather than a continuous line or area. A filled area across those voids asserts "we looked and saw nothing"; the truth is that nobody looked. Marks alternate day/night colour because a pass is almost always entirely one or the other, which makes the twice-daily rhythm countable.

Two traps this replaced, worth not walking back into:

- **Binning to the data's own min→max** pins the first and last bin non-empty *by construction*. With two overpasses in the default window that yields a spike, a long flat middle, and another spike — every single time, regardless of the fire. The domain is now whole days in WIB.
- **More history is not available.** The FIRMS area API hard-caps `day_range` at 5 (`Invalid day range. Expects [1..5]`). Adding VIIRS NOAA-20/21 would triple the detection count but not fill the voids — they share the same 13:30 orbital plane and land in the same two windows. Only MODIS (Terra 10:30/22:30, Aqua 13:30/01:30) samples different hours, at 1 km instead of 375 m.

## Search

The panel's search box is both a layer filter and a place search (`src/lib/geocode.ts`). It answers from two sources, in this order:

1. **The app's own boundaries** — the 514 kab/kota already in memory for the fire clip, plus the 38 provinces derived from their `provinsi_name`. Free, offline, and it returns the *exact* polygon the KPIs and charts count, so searching "Ketapang" lands on the boundary the numbers refer to. Provinces are listed first: a bare "Riau" almost always means the province.
2. **Photon** (`photon.komoot.io`) for everything else — villages, rivers, landmarks. Keyless, CORS-open, and built for type-ahead, unlike Nominatim whose usage policy caps at ~1 req/s. Requests are bbox-scoped to Indonesia and then filtered on `countrycode === "ID"`, because any box around the archipelago also contains Malaysia, Brunei, Timor-Leste and PNG.

Results are deduped **positionally, not by name** — a remote hit is a duplicate only if it falls inside the admin polygon of the same name. Indonesia reuses place names heavily (there is a Ketapang in West Kalimantan and three more elsewhere), so name-matching would hide the very places the geocoder exists to find.

Picking a result fits its bounds, or flies to `zoom: 11` when it has none. A filled pin marks a local boundary, an outline pin a geocoder hit.

## User-added layers

The registry is a compile-time list, which is right for the layers the app is
*about* — they need bespoke styling, decode protocols, legends and caveats. It is
wrong for the long tail. **"Add a remote layer"** at the foot of the panel takes
a URL and builds a descriptor at runtime, with the same toggle, opacity, legend,
render order and click-to-inspect as everything else.

| Paste | What happens |
| --- | --- |
| An ArcGIS **folder** (`…/rest/services/PUBLIK`) | Lists its services and sub-folders; drill down |
| An ArcGIS **service** (`…/MapServer`) | Lists its layers with geometry type; pick one |
| An ArcGIS **layer** (`…/MapServer/6`) | Same, with that layer floated to the top |
| An **XYZ template** (`…/{z}/{x}/{y}.png`) | Added as a raster layer |
| A **GeoJSON URL** | Fetched and drawn as polygons |

BIG's other public MapServers are offered as one-click suggestions: the app
hard-codes layers from two of the seven, and `PERIZINAN_DAN_PERTANAHAN` alone
carries IUPHHK-HA/HTI/RE, mining WIUP, oil and gas working areas and IPHPS.

### Image or data

An ArcGIS layer can be added either way, and the distinction is the whole point
of the dialog:

- **Image** builds a raster source pointed at MapServer's `export`, using
  MapLibre's `{bbox-epsg-3857}` token — the same WMS-shaped request. The server
  draws it on demand, so **size does not matter**: BIG's rawan erosi is 306,265
  features and can only be seen this way. The cost is that it is pixels, so the
  popup cannot read it and nothing can be counted from it. This is the default.
- **Data** pages the layer as GeoJSON through the same loader the built-ins use,
  clipped to the Indonesia envelope and capped at 20,000 features. Slower, but
  the features are real and clickable.

Two details keep the data path honest. The service's advertised
`maxRecordCount` is passed as the page size — assuming 1000 against a service
that caps lower makes a short page look like the end of the data — and hitting
the cap reports "partial coverage" rather than implying the layer is complete.

### Legends for server-rendered layers

An `export` layer arrives already symbolised, so its colours would otherwise
mean nothing. `asyncLegend` on the descriptor fetches ArcGIS's `/legend`, which
returns each class as a base64 PNG plus its label; the panel resolves it the
first time the layer is switched on. Deliberately not persisted — the swatches
are images and would bloat localStorage.

### Where the state lives

`CustomLayerSpec` is plain data and lives in `localStorage` under
`agni.customLayers`; `LayerDescriptor` closes over map calls and cannot be
serialised. `layers/custom.ts` is the one place they are joined, and it is what
non-React modules read through `allLayers()`. **Every consumer that walks the
layer set — the applier, the panel, the popup — must use `allLayers()` rather
than `LAYERS`**, or a custom layer is added to the map and then never synced,
ordered or queried.

The import arrow is one-way: `custom.ts` imports the registry, the registry
never imports `custom.ts`, and the store imports both. That is why `allLayers()`
lives in `custom.ts` — `LAYERS` is evaluated at module scope and must not be
read out of a half-built module.

Ids carry a timestamp suffix rather than a `-2` counter. Removing a layer and
adding a different one that slugs the same way would otherwise inherit the old
id, and with it the session-cached FeatureCollection still held against it.

## The forest-status facet

`forest-estate` is the only context layer whose polygons are *data* nationally, so it is the only one that can carry a national statistic. When it loads, `lib/forestTag.ts` writes the class of the containing polygon onto every detection as `kawasan` (empty string = outside the gazetted estate), then republishes the fire set under a fresh wrapper so the map re-pushes its source and every chart memo recomputes. After that, "fires by forest status" is a counting pass, exactly like the province ranking — no geometry is touched on a filter change.

Three details are load-bearing:

- **The tag guard is keyed on `fires.features`, not the FeatureCollection.** Republishing swaps the wrapper and keeps the array; a guard on the wrapper would re-run the join forever.
- **The join uses a grid index** (`gridIndexPolygons` in `lib/geo.ts`), not the linear `polygonAt` the peat KPI uses. 27,000 detections against 4,487 polygons is a second of blocked main thread linearly; bucketed by 1°, it is a handful of candidates per point.
- **The chart is a self-excluding facet.** It is computed from the slice scoped by everything *except* `filters.forest` — the same reason the trend chart ignores the time window. A facet that filtered itself would collapse to the one bar just clicked, leaving no way to move to another class and no denominator for the percentage above it.

## Click-to-inspect

Clicking the map reports every layer under the cursor in render order (`src/lib/inspect.ts`), **and** sets the CAMS probe point for the forecast charts in the rail. Glyph markers have their own popups. Raster layers cannot be queried this way — they answer visually only.

## Availability states

Layers depending on live sources report `checking → ok | unavailable` to the store. Unavailable layers render disabled with the reason; a layer that loaded but hit its `maxFeatures` cap stays `ok` with a "partial coverage" note rather than implying it drew everything.

## Adding a layer

1. Append a `LayerDescriptor` to `src/layers/registry.ts`. For a GFW polygon dataset use the `gfwPolygonLayer()` factory in `src/layers/gfw.ts`; for a CAMS WMS layer use `camsImageLayer()` in `src/layers/cams.ts`.
2. If it needs fetched data, add a module in `src/lib/` and wire the sync in `MapView`. Note that the store imports the registry, so **the registry must not import the store** — pass values in through a small module the way `lib/rasterDate.ts` does.
3. Update this file and `METHODOLOGY.md`.

If the layer is a one-off you want on the map rather than something the app is
about, do not add a descriptor at all — paste its URL into "Add a remote layer".
