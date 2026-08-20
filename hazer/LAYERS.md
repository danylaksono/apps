# LAYERS.md — Hazer layer catalog

Every layer is a descriptor in `src/layers/registry.ts`. IDs are stable — the Zustand store keys visibility/opacity by them.

## Basemaps (mutually exclusive)

| ID          | Source                         | Type   | Notes                          |
| ----------- | ------------------------------ | ------ | ------------------------------ |
| `dark`      | CARTO Dark Matter              | raster | default                        |
| `satellite` | Esri World Imagery             | raster |                                |
| `osm`       | OpenStreetMap standard tiles   | raster | capped at z19 per OSMF policy  |
| `light`     | CARTO Voyager                  | raster |                                |

## Overlay layers

| ID                     | Group      | Label                           | Source                                                      | Type                                    | Default |
| ---------------------- | ---------- | ------------------------------- | ----------------------------------------------------------- | --------------------------------------- | ------- |
| `fires`                | Fire       | Active fires (VIIRS SNPP NRT)   | FIRMS `/api/area/csv`, 2 days, Kalimantan bbox               | circle (FRP-scaled, confidence-colored) | on      |
| `fires-heat`           | Fire       | Fire heatmap                    | derived from FIRMS points                                   | heatmap                                 | off     |
| `haze-aod`             | Haze       | Aerosol Optical Depth (Aqua)    | NASA GIBS `MODIS_Aqua_Aerosol` WMTS                         | raster                                  | off     |
| `haze-cams-smoke`      | Haze       | CAMS smoke (biomass burning AOD)| CAMS via ECMWF WMS, 3-hourly + forecast                     | image (time-animated)                   | off     |
| `haze-cams-pm25`       | Haze       | CAMS surface PM2.5              | CAMS via ECMWF WMS, 3-hourly + forecast                     | image (time-animated)                   | off     |
| `haze-smoke`           | Haze       | True-color smoke (Terra)        | NASA GIBS `MODIS_Terra_CorrectedReflectance_TrueColor` WMTS | raster                                  | off     |
| `population`           | Population | Kontur H3 population            | `public/data/population.pmtiles`                            | fill choropleth (log-ish step scale)    | off     |
| `boundaries-kecamatan` | Boundaries | Kecamatan                       | `public/data/boundaries.pmtiles` / `kecamatan`              | line                                    | off     |
| `boundaries-kabkota`   | Boundaries | Kabupaten/Kota                  | `public/data/boundaries.pmtiles` / `kab_kota`               | line                                    | on      |
| `boundaries-provinsi`  | Boundaries | Provinsi                        | `public/data/boundaries.pmtiles` / `provinsi`               | line                                    | on      |
| `peat-extent`          | Peatland   | Lahan gambut (peat soil)        | BIG SatuPeta layer 6 — full peat extent, 45,486 km²         | fill + line                             | **on**  |
| `peat-khg`             | Peatland   | KHG                             | BIG SatuPeta layer 37 — **partial coverage**                | fill + line                             | off     |
| `peat-function`        | Peatland   | Fungsi ekosistem gambut         | BIG SatuPeta layer 48 — depth + lindung/budidaya, **partial**| fill + line                            | off     |
| `fire-hazard`          | Fire       | Fire hazard (rawan karhutla)    | BIG SatuPeta layer 47 — official hazard class               | fill                                    | off     |
| `conc-oil-palm`        | Concessions| Oil palm concessions            | GFW `gfw_oil_palm`                                          | fill + line                             | off     |
| `conc-rspo`            | Concessions| RSPO oil palm                   | GFW `rspo_oil_palm`                                         | fill + line                             | off     |
| `conc-wood-fiber`      | Concessions| Pulpwood (HTI)                  | GFW `gfw_wood_fiber`                                        | fill + line                             | off     |
| `conc-logging`         | Concessions| Logging (HPH)                   | GFW `gfw_logging`                                           | fill + line                             | off     |
| `conc-mining`          | Concessions| Mining concessions              | GFW `gfw_mining_concessions`                                | fill + line                             | off     |
| `prot-moratorium`      | Protection | Moratorium (PIPPIB)             | GFW `idn_forest_moratorium`                                 | fill + line                             | off     |
| `prot-forest-area`     | Protection | Kawasan hutan                   | GFW `idn_forest_area`                                       | fill (by class) + line                  | off     |
| `prot-wdpa`            | Protection | Protected areas (WDPA)          | GFW `wdpa_protected_areas`                                  | fill + line                             | off     |

## Styling conventions

- **Fires:** circle radius scales with `frp`; color by `confidence` (low = amber, nominal = orange, high = red); white halo stroke for separation on dark basemaps.
- **Heatmap:** weight from `frp`, density ramp transparent → yellow → orange → red.
- **Population choropleth:** stepped fill (`population` property), transparent → purple → magenta → yellow; intended for dark basemap.
- **Boundaries:** provinsi = brightest/thickest, kab_kota = medium, kecamatan = faint, thin, visible at higher zoom.
- **Peat:** violet `#8b5cf6` fill + lighter outline; KHG teal `#3ddc97`; fungsi ekosistem gambut blue, split lindung `#0ea5e9` / budidaya `#7dd3fc`.
- **CAMS haze:** the WMS bakes its own palette and paints a colour at every value (only ~22-29% of pixels are transparent), so it ships at 0.5 opacity to keep the basemap and fire points readable.
- **Context polygons:** faint fill (`fill-opacity` ~0.18) + a brighter 0.4–1.2 px outline; the outline does the work on a dark basemap. Hues are deliberately cool so nothing competes with the fire palette — palm pink `#f472b6`, RSPO rose `#fb7185`, pulpwood violet `#a78bfa`, logging blue `#60a5fa`, mining slate `#94a3b8`, moratorium cyan `#22d3ee`, kawasan hutan greens, WDPA green `#4ade80`.

## Render order

Toggling a layer adds it to the map, so stacking would otherwise follow click
order. `GROUP_RANK` in `src/layers/registry.ts` fixes the bottom-to-top order
(peatland → concessions → protection → population → haze → boundaries → fire)
and `apply.ts` re-asserts it whenever the set of present layers changes. A
descriptor that creates more than one map layer must list them all in
`mapLayerIds` or they will not be reordered.

## Peat layers: which one to compute from

The three BIG peat layers cover very different areas, and only one is safe for
statistics (measured over Kalimantan, Aug 2026, against 3,895 detections):

| Layer                             | Area       | Fires on it |
| --------------------------------- | ---------- | ----------- |
| 6 — Lahan gambut (`peat-extent`)  | 45,486 km² | **30.7%**   |
| 37 — KHG (`peat-khg`)             | 8,758 km²  | 1.6%        |
| 48 — Fungsi ekosistem (`peat-function`) | 8,712 km² | 1.6%    |

Layer 6 matches Kalimantan's known ~50,000 km² of peat. 37 and 48 are a partial
publication skewed to Kalimantan Barat (78 of 101 KHG units) and nearly absent
in Kalimantan Tengah. The KPI therefore uses layer 6; the other two are for
inspecting a place (48 carries peat thickness and legal function), never for
totals, and their panel descriptions say so.

## CAMS timeline

`haze-cams-*` are single MapLibre `image` sources rather than tiled rasters:
ECMWF renders each GetMap on demand, so a tile pyramid would mean dozens of
renders per pan. `CamsTimeline` reads the WMS time dimension (72 3-hourly steps,
~5 days analysis + ~4 days forecast), opens on the step nearest now, and
`setCamsTime` swaps the image per step. Steps past now are badged *forecast*.

## Click-to-inspect

Clicking the map runs `queryRenderedFeatures` and reports every layer under the
cursor in render order (`src/lib/inspect.ts`): the fire detection, then whose
concession it sits in, its protection status, and the admin unit. Raster layers
(peat, haze) cannot be queried this way — they only answer visually.

## Availability states

Layers that depend on live/token-gated sources report `checking → ok | unavailable` to the store. Unavailable layers render disabled in the panel with the reason (e.g. "token required"). Static PMTiles layers are always available.

## Adding a layer

1. Append a `LayerDescriptor` to `src/layers/registry.ts` (id, group, label, defaults, `add`/`remove`/`setOpacity`). For a GFW polygon dataset use the `gfwPolygonLayer()` factory in `src/layers/gfw.ts` instead — pass the dataset entry from `GFW_DATASETS` and it wires source, fill, outline, opacity and popup fields for you.
2. If it needs fetched data, add a hook in `src/lib/` and wire it in `MapView`.
3. Update this file and `METHODOLOGY.md`.
