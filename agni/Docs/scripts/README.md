# Docs/scripts — offline analysis

Standalone Python that reproduces the case studies in
[INVESTIGATION.md](../INVESTIGATION.md). Nothing here is imported by the app;
the app stays a static site with no Python at runtime. These scripts exist so
the numbers in that document can be re-derived from scratch by anyone.

## Files

| file | what it does |
| --- | --- |
| `agni_spatial.py` | Shared helpers: Esri JSON → shapely, equal-area measurement, and the Hansen loss-year tile decoder (`LossGrid`) — the Python twin of `src/lib/gfwRaster.ts` |
| `fetch_data.py` | Downloads permits, FIRMS detections and Hansen tiles into a local cache. Resumable |
| `screen_region.py` | Ranks every concession in a region by fire intensity and by how fast it is getting worse (INVESTIGATION.md §1) |
| `analyze_concession.py` | The five deep-dive tests for one concession (INVESTIGATION.md §2) |

The two analysis scripts answer different questions and are meant to be used in
that order. `screen_region.py` sweeps hundreds of permits cheaply and tells you
which ones are worth attention; `analyze_concession.py` is slow, thorough, and
worth pointing at one permit at a time.

## Setup

```sh
pip install shapely pyproj numpy pillow
```

FIRMS needs a free MAP_KEY from
<https://firms.modaps.eosdis.nasa.gov/api/map_key/>:

```sh
export FIRMS_MAP_KEY=your_key      # falls back to the key in src/lib/config.ts
```

Everything else — BIG SatuPeta and the GFW tile server — is keyless.

Data lands in `Docs/data/`, which is gitignored. A full Kalimantan cache is
~90 MB of FIRMS CSVs plus a few hundred Hansen tiles.

## Reproducing section 1 — the Kalimantan screen

```sh
cd Docs/scripts

python fetch_data.py permits --cache ../data
python fetch_data.py firms   --cache ../data --bbox 108.60,-4.94,119.04,4.41

python screen_region.py --cache ../data --top 25 --loss \
    --csv ../data/kalimantan_concessions.csv
```

The FIRMS pull is 498 five-day windows and takes 20–40 minutes cold. It is
resumable, so an interrupted run costs nothing to restart. The screen itself is
a couple of minutes; `--loss` adds a few more while it fetches Hansen tiles for
the leaders. The CSV carries every permit, not just the printed top rows.

## Reproducing section 2 — one concession in depth

```sh
python analyze_concession.py --cache ../data --name "KIANI LESTARI" \
    --ring-bbox 116.60,0.45,117.45,1.32 --peer-bbox 116.20,0.20,117.80,1.60
```

Reuses the same cache, so no extra download.

**Pass both bboxes explicitly to reproduce the published tables.** Without them
the extents are derived from the target polygon plus a margin, which selects a
slightly different peer set. The two are deliberately different sizes:
`--ring-bbox` is a tight collar used as the control in test 3, `--peer-bbox` is
wide enough to capture comparable concessions for test 1.

## Other things it can do

Search the permit registry by company name, no download:

```sh
python fetch_data.py search --term "KIANI"
```

Screen a different region — `--province` takes `kdprv` codes (61 Kalbar,
62 Kalteng, 63 Kalsel, 64 Kaltim, 65 Kaltara, 14 Riau, 15 Jambi, 94 Papua …).
Sumatra, for instance:

```sh
python fetch_data.py permits --cache ../data-sumatra --province 11,12,13,14,15,16,17,18,19,21
python fetch_data.py firms   --cache ../data-sumatra --bbox 95.0,-6.1,106.5,6.1
python screen_region.py --cache ../data-sumatra --provinces 11,12,13,14,15,16,17,18,19,21 \
    --kabkota ../../public/data/kabkota_indonesia.geojson
```

Analyse any concession whose `namobj` substring matches exactly one permit —
take a name from the screen's top rows:

```sh
python analyze_concession.py --cache ../data --name "DWIMA INTIGA"
```

A different fire season: `--season 01-01,12-31`.

## Numbers that will drift

- **FIRMS NRT is reprocessed into SP** several months later, with corrected
  geolocation. Recent seasons shift slightly as that happens. Delete the
  affected `Docs/data/firms/*.csv` to re-pull. Re-running on a later date also
  extends the current season, which is why every table carries a run date.
- **Hansen publishes a new loss year annually.** Bump `LOSS_VERSION` in
  `agni_spatial.py` and raise `--max-loss-year` when v1.14 lands. Clear
  `Docs/data/hansen/` after a version change — tiles are cached by z/x/y only.
- **BIG republishes permit layers** without notice and carries no permit-status
  field, so a polygon here is not evidence of a valid permit. See
  INVESTIGATION.md §2.3.
- Rasterisation at z12 (~19 m/px) puts measured areas within ~1% of the vector
  area. `analyze_concession.py` prints both so the gap stays visible.

## Reading the output

Read INVESTIGATION.md §1.9 and §2.8 first. In short: these scripts measure where
fire and canopy loss occurred relative to a permit boundary. They do not
identify who lit a fire, do not establish illegality, and carry no ownership
information — no public spatial dataset does.
