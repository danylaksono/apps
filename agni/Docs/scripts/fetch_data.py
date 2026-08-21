"""Download everything the concession analysis needs, into a local cache.

    python fetch_data.py permits --cache .cache
    python fetch_data.py firms   --cache .cache --bbox 116.20,0.20,117.80,1.60 \
                                 --from 2013 --to 2026
    python fetch_data.py hansen  --cache .cache --bbox 116.20,0.20,117.80,1.60

Every step is resumable: already-cached files are skipped, so a interrupted run
costs nothing to restart.

Sources, all the same ones the app itself uses (`src/lib/config.ts`):

  * BIG SatuPeta ArcGIS MapServer — KLHK's permit and forest-estate polygons.
    Keyless, CORS-open, and the only `.go.id` host that reliably resolves.
  * NASA FIRMS — VIIRS S-NPP active fire detections. Needs a free MAP_KEY from
    https://firms.modaps.eosdis.nasa.gov/api/map_key/ . Set FIRMS_MAP_KEY, or it
    falls back to the key already committed in `src/lib/config.ts`.
  * GFW tile server — Hansen loss (handled by agni_spatial.LossGrid).
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

BIG = "https://kspservices.big.go.id/satupeta/rest/services/PUBLIK"
PERIZINAN = f"{BIG}/PERIZINAN_DAN_PERTANAHAN/MapServer"
KEHUTANAN = f"{BIG}/KEHUTANAN/MapServer"

# Permit layers. `namobj` is the company name, `lssk` the area per decree (ha),
# `no_sk`/`tgl_sk` the decree that granted it. There is no shareholder, parent
# company or permit-status field anywhere in this service — see INVESTIGATION.md.
PERMIT_LAYERS = {
    "ha": (1, "IUPHHK-HA — natural forest logging (ex-HPH)"),
    "hti": (2, "IUPHHK-HTI — industrial timber plantation (pulpwood)"),
    "re": (3, "IUPHHK-RE — ecosystem restoration"),
}
PERMIT_FIELDS = "objectid,namobj,kdprv,lssk,no_sk,tgl_sk,remark,metadata"

# KLHK gazetted forest estate. `fungsitap` is a bare KUGI code; the decode lives
# in src/lib/forest.ts (100300 = HP, 100400 = HPT, 100100 = HL, ...).
FOREST_ESTATE_LAYER = 0

FIRMS_KEY = os.environ.get("FIRMS_MAP_KEY", "eda46120c69739d3b51b05ae8dd3584a")

# FIRMS caps a single request at 5 days. The SP (standard, quality-controlled)
# archive lags real time by several months; NRT covers the recent window only.
FIRMS_WINDOW_DAYS = 5
FIRMS_NRT_HORIZON_DAYS = 200


def _get(url: str, timeout: int = 300) -> bytes:
    with urllib.request.urlopen(url, timeout=timeout) as res:
        return res.read()


# ----------------------------------------------------------------- permits ---


def fetch_permits(cache: str, province: str | None, simplify: float) -> None:
    """Pull permit polygons, one JSON file per layer.

    `maxAllowableOffset` simplifies geometry server-side — essential, because
    these polygons are unusably large at full precision. 0.0005 deg is ~55 m,
    fine enough that measured area lands within 0.1% of the decree area.
    """
    out_dir = os.path.join(cache, "permits")
    os.makedirs(out_dir, exist_ok=True)

    where = f"kdprv='{province}'" if province else "1=1"
    for name, (layer_id, label) in PERMIT_LAYERS.items():
        path = os.path.join(out_dir, f"{name}.json")
        if os.path.exists(path):
            print(f"  {name}: cached")
            continue
        query = urllib.parse.urlencode(
            {
                "where": where,
                "outFields": PERMIT_FIELDS,
                "returnGeometry": "true",
                "outSR": "4326",
                "maxAllowableOffset": str(simplify),
                "geometryPrecision": "6",
                "f": "json",
            }
        )
        print(f"  {name}: {label} ...", end="", flush=True)
        body = _get(f"{PERIZINAN}/{layer_id}/query?{query}")
        data = json.loads(body)
        n = len(data.get("features", []))
        with open(path, "wb") as fh:
            fh.write(body)
        print(f" {n} features")


def fetch_forest_estate(cache: str, bbox: str, simplify: float) -> None:
    """Gazetted forest estate (penetapan kawasan hutan) over a bbox."""
    path = os.path.join(cache, "permits", "forest_estate.json")
    if os.path.exists(path):
        print("  forest estate: cached")
        return
    query = urllib.parse.urlencode(
        {
            "where": "1=1",
            "geometry": bbox,
            "geometryType": "esriGeometryEnvelope",
            "inSR": "4326",
            "outSR": "4326",
            "spatialRel": "esriSpatialRelIntersects",
            "outFields": "fungsitap,nkws,nosktap",
            "returnGeometry": "true",
            "maxAllowableOffset": str(simplify),
            "geometryPrecision": "6",
            "f": "json",
        }
    )
    print("  forest estate ...", end="", flush=True)
    body = _get(f"{KEHUTANAN}/{FOREST_ESTATE_LAYER}/query?{query}")
    with open(path, "wb") as fh:
        fh.write(body)
    print(f" {len(json.loads(body).get('features', []))} features")


def search_permits(term: str) -> None:
    """Attribute-only search across the three permit layers. No download."""
    for name, (layer_id, label) in PERMIT_LAYERS.items():
        query = urllib.parse.urlencode(
            {
                "where": f"UPPER(namobj) LIKE '%{term.upper()}%'",
                "outFields": PERMIT_FIELDS,
                "returnGeometry": "false",
                "f": "json",
            }
        )
        data = json.loads(_get(f"{PERIZINAN}/{layer_id}/query?{query}"))
        feats = data.get("features", [])
        print(f"\n{label}: {len(feats)} match(es)")
        for f in feats:
            a = dict(f["attributes"])
            if a.get("tgl_sk"):  # ArcGIS dates are epoch milliseconds
                a["tgl_sk"] = dt.datetime.fromtimestamp(
                    a["tgl_sk"] / 1000, dt.timezone.utc
                ).strftime("%Y-%m-%d")
            print(
                f"  {a['namobj']:<45} prov={a['kdprv']} "
                f"{a['lssk']:>10,.0f} ha  {a['no_sk']}  {a.get('tgl_sk')}"
            )


# ------------------------------------------------------------------- FIRMS ---


def firms_windows(year_from: int, year_to: int, season: tuple[str, str]):
    """Five-day request windows covering the fire season of each year.

    Default season is Jun 1 - Nov 30, which carried 94% of all detections in the
    Kutai Timur study area. Widen it if you are working on a different regime.
    """
    today = dt.date.today()
    for year in range(year_from, year_to + 1):
        start = dt.date(year, *map(int, season[0].split("-")))
        end = min(dt.date(year, *map(int, season[1].split("-"))), today)
        day = start
        while day <= end:
            yield day
            day += dt.timedelta(days=FIRMS_WINDOW_DAYS)


def fetch_firms(cache: str, bbox: str, year_from: int, year_to: int, season, workers=8):
    """Download FIRMS CSV per window. Empty file == no detections, not a failure.

    Product choice matters. VIIRS_SNPP_SP is the quality-controlled archive but
    lags several months; VIIRS_SNPP_NRT covers the recent window with coarser
    geolocation. We try whichever is likelier to hold the date first, then fall
    back, so a run spanning the boundary gets full coverage.
    """
    out_dir = os.path.join(cache, "firms")
    os.makedirs(out_dir, exist_ok=True)
    recent_cutoff = dt.date.today() - dt.timedelta(days=FIRMS_NRT_HORIZON_DAYS)

    def one(day: dt.date) -> None:
        path = os.path.join(out_dir, f"{day}.csv")
        if os.path.exists(path):
            return
        products = (
            ("VIIRS_SNPP_NRT", "VIIRS_SNPP_SP")
            if day >= recent_cutoff
            else ("VIIRS_SNPP_SP", "VIIRS_SNPP_NRT")
        )
        for product in products:
            url = (
                f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/"
                f"{FIRMS_KEY}/{product}/{bbox}/{FIRMS_WINDOW_DAYS}/{day}"
            )
            try:
                body = _get(url, timeout=120)
            except Exception:
                continue
            # An error comes back as prose or HTML, not CSV.
            if body.startswith(b"Invalid") or body.startswith(b"<"):
                continue
            if len(body.strip().splitlines()) > 1:
                with open(path, "wb") as fh:
                    fh.write(body)
                return
        # Nothing found in either product: record the miss so we do not retry.
        with open(path, "wb") as fh:
            fh.write(b"")

    days = list(firms_windows(year_from, year_to, season))
    print(f"  {len(days)} windows over {bbox}")
    with ThreadPoolExecutor(workers) as pool:
        list(pool.map(one, days))

    rows = 0
    for name in os.listdir(out_dir):
        p = os.path.join(out_dir, name)
        if os.path.getsize(p) > 0:
            with open(p) as fh:
                rows += max(0, len(fh.read().strip().splitlines()) - 1)
    print(f"  cached {len(os.listdir(out_dir))} files, {rows:,} detection rows")


# -------------------------------------------------------------------- main ---


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("step", choices=["permits", "firms", "hansen", "search", "all"])
    ap.add_argument("--cache", default=".cache", help="cache directory")
    ap.add_argument(
        "--bbox",
        default="116.20,0.20,117.80,1.60",
        help="west,south,east,north — default is the Kutai Timur study area",
    )
    ap.add_argument("--province", default="64", help="kdprv code; 64 = Kalimantan Timur")
    ap.add_argument("--from", dest="year_from", type=int, default=2013)
    ap.add_argument("--to", dest="year_to", type=int, default=dt.date.today().year)
    ap.add_argument("--season", default="06-01,11-30", help="MM-DD,MM-DD")
    ap.add_argument("--simplify", type=float, default=0.0005, help="degrees")
    ap.add_argument("--term", default="KIANI", help="for `search`")
    args = ap.parse_args()

    os.makedirs(args.cache, exist_ok=True)
    season = tuple(args.season.split(","))

    if args.step == "search":
        search_permits(args.term)
        return 0

    if args.step in ("permits", "all"):
        print("permits:")
        fetch_permits(args.cache, args.province, args.simplify)
        fetch_forest_estate(args.cache, args.bbox, 0.001)

    if args.step in ("firms", "all"):
        print("firms:")
        fetch_firms(args.cache, args.bbox, args.year_from, args.year_to, season)

    if args.step in ("hansen", "all"):
        print("hansen:")
        from agni_spatial import LossGrid

        w, s, e, n = map(float, args.bbox.split(","))
        grid = LossGrid(args.cache, w, s, e, n)
        print(f"  {grid.n_tiles} tiles cached at z12")

    return 0


if __name__ == "__main__":
    sys.exit(main())
