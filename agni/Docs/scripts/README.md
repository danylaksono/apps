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
| `analyze_concession.py` | Runs the five tests and prints every table in INVESTIGATION.md §1 |

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

## Reproducing section 1

```sh
cd Docs/scripts

python fetch_data.py all --cache .cache --bbox 116.20,0.20,117.80,1.60

python analyze_concession.py --cache .cache --name "KIANI LESTARI" \
    --ring-bbox 116.60,0.45,117.45,1.32 \
    --peer-bbox 116.20,0.20,117.80,1.60
```

The first command takes roughly 15–30 minutes on a cold cache — 518 FIRMS
windows and ~320 Hansen tiles — and lands about 60 MB on disk. It is resumable,
so an interrupted run costs nothing. The second takes a couple of minutes and is
pure local computation.

**Pass both bboxes explicitly to reproduce the published tables.** Without them
the extents are derived from the target polygon plus a margin, which selects a
slightly different peer set. The two extents are deliberately different sizes:
`--ring-bbox` is a tight collar used as the control in test 3, `--peer-bbox` is
wide enough to capture comparable concessions for test 1.

## Other things it can do

Search the permit registry by company name, no download:

```sh
python fetch_data.py search --term "KIANI"
python fetch_data.py search --term "NUSANTARA"
```

Analyse a different concession — any `namobj` substring that matches exactly one
permit:

```sh
python fetch_data.py all --cache .cache-berau --bbox 116.80,1.30,118.20,2.60
python analyze_concession.py --cache .cache-berau --name "TANJUNG REDEB"
```

A different province: `--province` takes a `kdprv` code (64 = Kalimantan Timur,
62 = Kalimantan Tengah, 14 = Riau, 15 = Jambi …). A different fire season:
`--season 01-01,12-31`.

## Numbers that will drift

- **FIRMS NRT is reprocessed into SP** several months later, with corrected
  geolocation. Recent seasons will shift slightly as that happens. Delete the
  affected `.cache/firms/*.csv` to re-pull.
- **Hansen publishes a new loss year annually.** Bump `LOSS_VERSION` in
  `agni_spatial.py` and raise `--max-loss-year` when v1.14 lands. Clear
  `.cache/hansen/` after a version change — tiles are cached by z/x/y only.
- **BIG republishes permit layers** without notice and carries no permit-status
  field, so a polygon here is not evidence of a valid permit. See
  INVESTIGATION.md §1.3.
- Rasterisation at z12 (~19 m/px) puts measured areas within ~1% of the vector
  area. `analyze_concession.py` prints both so the gap stays visible.

## Reading the output

Read INVESTIGATION.md §1.8 first. In short: these scripts measure where fire and
canopy loss occurred relative to a permit boundary. They do not identify who lit
a fire, do not establish illegality, and carry no ownership information —
no public spatial dataset does.
