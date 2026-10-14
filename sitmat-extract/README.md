# SiTMAT extract

Download and explore peatland water-table (TMAT) data from the SiTMAT portal (Indonesia).
The extractor produces tidy CSVs; `index.html` is a browser dashboard for checking them.

The endpoints are undocumented and may change. Keep the request rate polite.

## Layout

```
sitmat_tmat_extract.py   downloader + post-processor
check_output.py          quick pandas sanity checks on daily_long.csv
index.html               dashboard (reads sitmat_out/processed/*.csv)
assets/app.js, style.css dashboard code and styles
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
- `qc_report.txt`: coverage per kind and flag counts.

Flagged values are kept in the CSVs, not removed.

## Dashboard

The page loads the CSVs with `fetch`, so serve the folder over HTTP:

```bash
python -m http.server 8000
# open http://localhost:8000/
```

Opening `index.html` directly from disk (`file://`) blocks the fetch. The page then shows file
pickers for `daily_long.csv` and `stations.csv`.

Leaflet, Chart.js and PapaParse come from cdnjs and the map uses OpenStreetMap tiles, so it needs internet access.

Global filters (top bar): source, province, date range, and whether QC-flagged values are excluded
(on by default).

| Tab | Shows |
|---|---|
| Overview | KPIs; mean level per day by source; stations reporting per day; status mix; level histogram; mean by province; mean rain and soil moisture |
| Map | Stations coloured by water level, 7-day change, status, rain or soil moisture. A date slider and play button step through time. Click a station for its series. |
| Heatmap | Station × day matrix of water level, sortable by province, mean, coverage or name |
| Stations | Sortable, searchable table with per-station stats over the selected dates; CSV export |
| Data quality | The QC report, flags by source, station coverage histogram, missing data per day, list of flagged readings |

Clicking a station anywhere opens a detail chart (level with min/max, soil moisture, rain; flagged days marked red).

Map and heatmap colours use a brown–teal ramp whose range is the 2nd to 98th percentile of unflagged
water levels. Higher (less negative) levels are wetter.

## Known data caveats

- Community stations have low coverage (mean ~12% in the current extract).
- Some community readings are positive and above 100 cm. They are flagged `range`.
- Community stations have almost no province, regency or company metadata, so the province filter mostly affects concession points.
- Station IDs for concession points may not be stable across days; check with `check_output.py`.
