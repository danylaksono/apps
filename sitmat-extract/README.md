# SiTMAT extract

Download and explore peatland water-table (TMAT) data from the SiTMAT portal (Indonesia).
The extractor produces tidy CSVs; `index.html` is a browser dashboard for checking them.

The endpoints are undocumented and may change. Keep the request rate polite.

## Layout

```
sitmat_tmat_extract.py   downloader + post-processor
update.py                one-command update to today (download, process, geo)
check_output.py          quick pandas sanity checks on daily_long.csv
prepare_geo.py           spatial join + web-sized boundary layers (needs geopandas)
index.html               dashboard (reads sitmat_out/processed/*.csv)
assets/app.js, js/*.js   dashboard code (data, theme, overview, insights, map, regions, tables)
assets/style.css         styles
assets/geo/              khg/adm1/adm2 .geojson for the web (generated); src/ = geoBoundaries inputs
assets/batas-khg-indonesia.geojson   KHG polygons (88 MB source, not read by the browser)
sitmat_out/
  raw/                   gzip'd JSON as downloaded (resumable)
  processed/             CSVs used by the dashboard
  download.log
```

## Data sources

| Kind | Portal name | Source | Stations | How it is fetched |
|---|---|---|---|---|
| `community` | Masyarakat | simatag | ~124 | one request per station returns the whole period |
| `concession` | Konsesi | gambutindonesia | ~1150 | one snapshot request per calendar day |

Concession snapshots return a different set of points each day, so the union is kept.
Each point's `history` block always covers the last 30 days and ignores the requested date,
so only the `detail` block is used for the requested day.

## Update to today

```bash
python update.py            # download what is new, rebuild the CSVs, assign regions to new stations
python update.py --check    # how far behind is the data (no requests)
```

It fetches every missing concession day plus the last two (they may have been partial), refreshes the community stations (their history is merged with what is on disk, since the API only reaches back 90 days), rebuilds `sitmat_out/processed/`, and runs `prepare_geo.py` when new stations have no KHG or province yet (needs geopandas; otherwise it prints the command). A full community refresh is about 125 requests, so allow a few minutes. If it stops on a rate limit, run it again. Extra options go to the extractor, e.g. `python update.py --delay 2.5`. Then reload the dashboard.

## Extract

```bash
pip install requests
python sitmat_tmat_extract.py all --start 2026-04-01 --end 2026-10-14
python sitmat_tmat_extract.py download --start ... --end ... --only concession
python sitmat_tmat_extract.py process  --start ... --end ...     # no network
```

Rate-limit guard: minimum delay plus jitter (`--delay`, `--jitter`), a per-minute cap
(`--max-per-min`), optional total budget (`--max-requests`). On HTTP 429/503 it backs off and slows
down, and after repeated failures it stops cleanly. On 401/403 it stops immediately. Finished files
are kept, so re-running resumes. `--limit N` runs a small test.

QC thresholds (cm): `--min-wl` (default -500) and `--max-wl` (default 100) set the `range` flag,
and `--spike-cm` (default 60) sets the `spike` flag.

## Outputs (`sitmat_out/processed/`)

- `daily_long.csv`: one row per station and day.
  Columns: `kind, station_id, date, water_level_cm, water_level_min_cm, water_level_max_cm, soil_moisture_pct, rain_fall_mm, status, source, flag`.
  `status` is the portal colour class (`HIJAU`, `KUNING`, `ORANYE`, `MERAH`, `HITAM`, `BIRU`).
  `source` is `snapshot` (concession) or `community_history`.
  `flag` is empty, `range` or `spike`.
- `water_level_wide.csv`: stations × dates matrix of `water_level_cm`.
- `stations.csv`: `kind, station_id, name, company_code, company_name, lon, lat, provinsi, kabupaten, kecamatan`. Most community stations have no province.
- `stations_geo.csv`: from `prepare_geo.py`. `kind, station_id, has_loc, khg_id, khg_name, khg_dist_km, adm1, adm2, adm2_id`.
- `qc_report.txt`: coverage per kind and flag counts.

Flagged values are kept in the CSVs, not removed.

## Spatial layers (`prepare_geo.py`)

The dashboard assigns every station to a KHG, regency and province from its coordinates. The portal's
own `provinsi` text is not used: for concession points it often holds the company head office
(DKI Jakarta for stations in Riau or Kalbar).

```bash
pip install geopandas          # the project venv does not include it
python prepare_geo.py --fetch-adm
```

- KHG: `assets/batas-khg-indonesia.geojson`, simplified to about 110 m (88 MB to 2 MB).
- Provinces and regencies: geoBoundaries IDN ADM1/ADM2 (BPS / OCHA ROAP, CC BY 3.0 IGO), simplified. The ADM1 layer is the 2020 version and predates the 2022 Papua province splits.
- A station outside every KHG but within 5 km (`--max-km`) is assigned to the nearest one, with the distance recorded in `khg_dist_km`.
- Stations whose coordinates fall outside Indonesia, are (0,0) or have lat equal to lon get `has_loc = 0` and are left out of all spatial views. They are listed in the Data quality tab.

`assets/geo/src/` (14 MB) and the 88 MB KHG file are large for git (GitHub warns at 50 MB); consider Git LFS or `.gitignore`.

## Dashboard

The page loads the CSVs and boundaries with `fetch`, so serve the folder over HTTP:

```bash
python -m http.server 8000
# open http://localhost:8000/   (append #patterns, #map, #compare, #heat, #table or #qc to open a tab)
```

Opening `index.html` from disk (`file://`) blocks the fetch. The page then offers file pickers for
the CSVs, but boundaries stay off. Leaflet, Chart.js and PapaParse come from cdnjs and the map uses
OpenStreetMap tiles, so it needs internet access.

### How the numbers are made

- **Weekly median** per station (weeks are fixed 7-day blocks from the first date; at least 3 daily readings; blocks with fewer than 3 days in range are dropped).
- **Panel**: stations with data in at least 40/60/80% of weeks (default 60%) and a baseline. The baseline is the median of the station's first four weeks in range.
- **Change since start** = weekly median minus the station's own baseline. Regional lines are the median over panel stations, so stations that start or stop reporting cannot move them.
- **Trend** = Theil–Sen slope (cm/week) on weekly values, at least 8 weeks, with a Mann–Kendall z (tie-corrected). "Significant" means |z| ≥ 1.96 and ignores autocorrelation, so it is indicative.
- **−40 cm and −80 cm** are the concession status breaks (HIJAU ≥ −40, ORANYE −40 to −80, MERAH < −80) and are used as reference throughout.
- Regions with fewer than "Min stations/region" stations (default 2) are greyed out.
- Concession points are the default source. Community stations are opt-in (low coverage, inconsistent values).

| Tab | Shows |
|---|---|
| Trend | Plain-language summary, KPIs, change since start with station spread, level-class shares, level vs −40 cm limit, class-transition flow (first 4 weeks → mid → last 4 weeks), start-vs-now distribution, station trend histogram, trend by province |
| Patterns | Duration curves (early vs late third, and per province), longest dry spell per station, breadth (% stations rising minus falling per day, and by province × week), time below −40 cm per concession |
| Map | A Layers panel: one surface (none, **contour**, **hexbin**, KHG, regencies, provinces or **concession footprints**) plus independent overlays (stations, **Getis-Ord Gi\* hotspots**, province lines, KHG outlines), coloured by level, change since start, share below −40 cm, or trend. Week slider with play. Click a region for its series and most-drying stations, or filter to it. |
| Regions | Ranking table (KHG / regencies / provinces / concessions) (level, change, trend, share below −40 cm, % stations drying, sparkline) ; community-vs-concession scatter per KHG |
| Region × week | Heatmap of regions by week: change, level, or % below −40 cm |
| Stations | Searchable, sortable table with per-station trend and a weekly-level sparkline; CSV export |
| Data | Daily readings or weekly medians as a table: free-text search, QC flag, status and level-range filters, sortable columns, paging, CSV export of the filtered rows, sparkline per row |
| Data quality | QC report, flags, coverage, thin days, location warnings, flagged readings |

Filters (sticky bar): where (source, province, regency, KHG), when (dates), and under Method the panel coverage, min stations per region and whether
QC-flagged values are excluded (default on). Clicking a station opens a side drawer (Esc closes) with its daily and weekly series,
trend line and the −40 cm limit.

**Patterns.** All views use the QC toggle and either the fixed panel or within-station day-to-day differences, so the drop in reporting stations cannot create a signal. Dry spells allow gaps of up to 2 missing days and open runs are lower bounds. Breadth counts a station only on days where it also reported the day before (change > 1 cm). Concessions are keyed on the portal `company_code` (`company_name` is empty); the dot plot describes readings, not compliance.

**Hotspots (Gi\*).** Binary 25 km weights, self included, on the selected metric for the selected week; stations with fewer than 4 valid neighbours are left grey. z is relative to the stations currently selected, there is no multiple-testing correction, and clusters largely follow concession boundaries. **Concession footprints** are convex hulls of each company's stations, split into clusters more than 40 km apart.

**Hexbin.** Stations are binned on a hexagonal grid (equal-area cells in projected km); the cell size follows the zoom level (Fine / Medium / Coarse set the pixel size) so bins stay put while panning. Each cell shows the median of its stations, or the share below −40 cm; cells with fewer than "Min stations/region" stations are left out. Cells count stations, not area, so dense concession clusters dominate.

**Contour surface.** Station values for the selected week are interpolated over the visible map
(inverse-distance weighting, power 2, radius about 25 km or two cells, 90 columns) and turned into bands
with Turf.js `isobands` (loaded from jsDelivr). It is recomputed on every week, filter, metric and
pan/zoom. It is a visual aid for patterns, not a hydrological model: values are only drawn near
stations and clustered stations dominate their surroundings.

Colours: red to blue diverging ramp with a grey midpoint (red = drier), a sequential red ramp for
shares, and the status colours (green / orange / red) for level classes. The source colours were
checked with the dataviz palette validator in light and dark mode.

## Known data caveats

- **Short record.** About six months covers one dry-season drawdown and the start of the wet season. Trends cannot be separated from seasonality, so read them as drawdown and recession rate.
- **Station dropout.** Concession points reporting per day fall from about 740 in April to about 400 in October, with some near-empty days. The dashboard compares stations with themselves for this reason.
- **No rain or soil moisture.** `rain_fall_mm` and `soil_moisture_pct` are 0 in every concession row (not returned by the portal), and `water_level_min/max_cm` equal `water_level_cm`. The dashboard ignores them. A water balance (neraca air) needs external rainfall, e.g. CHIRPS or GPM IMERG joined by KHG.
- Community stations: mean coverage about 12%, most carry a `range` or `spike` flag, and their status classes do not follow the −40/−80 cm breaks.
- Some stations have bad coordinates (see Data quality); station IDs for concession points may not be stable across days (`check_output.py`).
