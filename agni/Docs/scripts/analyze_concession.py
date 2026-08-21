"""Is the fire inside a concession wildfire, or is it land clearing?

Reproduces every table in Docs/INVESTIGATION.md section 1.

    python fetch_data.py all --cache .cache
    python analyze_concession.py --cache .cache --name "KIANI LESTARI" \
           --ring-bbox 116.60,0.45,117.45,1.32

Five tests, chosen because each fails for a different reason if the fire is
genuinely wild:

  1. PEERS      Fire density and canopy loss against other concessions holding
                the *same permit class* in the same landscape. Controls for
                climate, terrain, and what the licence actually permits.
  2. BOUNDARY   Fire density in bands either side of the permit line. Wildfire
                does not know where the cadastre is; management does.
  3. COINCIDENCE  Do detections sit on ground that lost its canopy that same
                year? Clearing burns fresh slash; wildfire burns standing forest.
  4. BURSTS     Many simultaneous ignitions on one day, or a spreading front?
  5. OVERLAP    Could another permit holder be responsible for the clearing?

None of these identify who lit anything. See INVESTIGATION.md section 1.8.
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import sys
from collections import Counter, defaultdict

import numpy as np
from shapely.geometry import Point, box
from shapely.ops import transform
from shapely.strtree import STRtree

from agni_spatial import (
    LossGrid,
    area_ha,
    equal_area,
    esri_to_shapely,
    shapely_to_rings,
)

# A VIIRS pixel is ~375 m at nadir. At z12/512px a raster pixel is ~19 m, so 10
# px is about half a VIIRS pixel — tight enough that the window describes the
# ground the sensor actually saw.
WINDOW_RADIUS_PX = 10

# A detection counts as sitting on same-year clearing when that year's loss
# makes up at least this share of all loss pixels in its window. A bare
# "any same-year pixel present" test is far too loose in a landscape that has
# been cut over for 25 years.
SAME_YEAR_SHARE = 0.25

FOREST_CLASS = {  # KUGI codes, decoded in src/lib/forest.ts
    "100100": "Hutan lindung (HL)",
    "100200": "KSA/KPA",
    "100210": "Cagar alam (CA)",
    "100220": "Suaka margasatwa (SM)",
    "100240": "Taman nasional (TN)",
    "100300": "Produksi tetap (HP)",
    "100400": "Produksi terbatas (HPT)",
    "100500": "Produksi konversi (HPK)",
}


# ------------------------------------------------------------------ loading ---


def load_permits(cache: str) -> list[dict]:
    """All cached permit polygons, tagged with their class."""
    out = []
    for kind, label in (("ha", "HA"), ("hti", "HTI"), ("re", "RE")):
        path = os.path.join(cache, "permits", f"{kind}.json")
        if not os.path.exists(path):
            continue
        with open(path) as fh:
            data = json.load(fh)
        for f in data.get("features", []):
            out.append(
                {
                    "name": f["attributes"]["namobj"],
                    "type": label,
                    "lssk": f["attributes"].get("lssk") or 0,
                    "no_sk": f["attributes"].get("no_sk"),
                    "rings": f["geometry"]["rings"],
                    "geom": esri_to_shapely(f["geometry"]),
                }
            )
    return out


def load_firms(cache: str, season: tuple[str, str]) -> list[tuple]:
    """Every cached detection, de-duplicated, filtered to the fire season.

    De-duplication matters: consecutive five-day windows overlap at the seams,
    and SP/NRT both cover the changeover period, so the raw file union
    double-counts. The key is (lat, lon, date, time) exactly as FIRMS prints it.
    """
    seen: set[tuple] = set()
    rows: list[tuple] = []
    for path in sorted(glob.glob(os.path.join(cache, "firms", "*.csv"))):
        if os.path.getsize(path) == 0:
            continue
        with open(path, newline="") as fh:
            for r in csv.DictReader(fh):
                key = (r["latitude"], r["longitude"], r["acq_date"], r["acq_time"])
                if key in seen:
                    continue
                seen.add(key)
                date = r["acq_date"]
                if not (season[0] <= date[5:] <= season[1]):
                    continue
                rows.append(
                    (
                        float(r["longitude"]),
                        float(r["latitude"]),
                        date,
                        float(r.get("frp") or 0),
                        r.get("confidence", ""),
                    )
                )
    return rows


# -------------------------------------------------------------------- tests ---


def test_peers(target, permits, firms, grid, to_m, peer_box, min_coverage=0.60):
    """TEST 1 — the same permit class, the same landscape.

    Only concessions at least `min_coverage` inside the analysis box are
    included: a permit clipped to a sliver would carry a meaningless density.
    Each survivor is clipped to the box anyway, and its loss is measured on the
    *clipped* rings so it never reaches for a Hansen tile the grid never fetched.
    """
    inside = [
        p for p in permits
        if p["geom"].intersects(peer_box)
        and p["geom"].intersection(peer_box).area / p["geom"].area >= min_coverage
    ]
    tree = STRtree([p["geom"] for p in inside])

    for p in inside:
        clipped = p["geom"].intersection(peer_box).buffer(0)
        p["clipped"] = clipped
        p["clipped_rings"] = shapely_to_rings(clipped)
        p["ha"] = area_ha(clipped, to_m)
        p["det"] = Counter()

    for lon, lat, date, frp, _conf in firms:
        pt = Point(lon, lat)
        for i in tree.query(pt):
            if inside[int(i)]["geom"].contains(pt):
                inside[int(i)]["det"][int(date[:4])] += 1
                break

    print("\n" + "=" * 78)
    print("TEST 1 — against concessions of the same permit class")
    print("=" * 78)

    for p in inside:
        p["loss"], p["mask_ha"] = grid.loss_by_year(p["clipped_rings"])

    for cls in ("HA", "HTI"):
        rows = [p for p in inside if p["type"] == cls and (p["mask_ha"] or 0) > 5000]
        if not rows:
            continue
        print(f"\nIUPHHK-{cls}")
        print(f"{'concession':<44}{'ha':>9}{'fire/100k':>11}{'recent':>9}{'loss01-25':>11}{'loss23-25':>11}")
        agg = defaultdict(float)
        for p in sorted(rows, key=lambda p: -sum(p["det"].values()) / max(p["mask_ha"], 1)):
            ha = p["mask_ha"]
            n = sum(p["det"].values())
            nr = sum(v for k, v in p["det"].items() if k >= 2023)
            la, lr = sum(p["loss"][1:26]), sum(p["loss"][23:26])
            star = " *" if p is target else ""
            print(
                f"{(p['name'][:42] + star):<44}{ha:>9,.0f}{n / ha * 1e5:>11,.0f}"
                f"{nr / ha * 1e5:>9,.0f}{la / ha * 100:>10.1f}%{lr / ha * 100:>10.1f}%"
            )
            if p is not target:
                agg["ha"] += ha; agg["n"] += n; agg["nr"] += nr
                agg["la"] += la; agg["lr"] += lr
        if cls == target["type"] and agg["ha"]:
            print(
                f"{'ALL OTHERS COMBINED':<44}{agg['ha']:>9,.0f}"
                f"{agg['n'] / agg['ha'] * 1e5:>11,.0f}{agg['nr'] / agg['ha'] * 1e5:>9,.0f}"
                f"{agg['la'] / agg['ha'] * 100:>10.1f}%{agg['lr'] / agg['ha'] * 100:>10.1f}%"
            )
            tha = target["mask_ha"]
            tn = sum(target["det"].values())
            tnr = sum(v for k, v in target["det"].items() if k >= 2023)
            print(f"\n  ratio, all seasons : {(tn / tha) / (agg['n'] / agg['ha']):.0f}x")
            print(f"  ratio, 2023 onward : {(tnr / tha) / (agg['nr'] / agg['ha']):.0f}x")
    print("\n  * = target concession")
    return inside


def test_boundary(target, firms, to_m, from_m):
    """TEST 2 — does the fire respect the permit line?

    Buffers are taken in projected metres, then points are tested in the same
    space. Buffering in degrees would skew the bands with latitude.
    """
    proj = transform(to_m, target["geom"])
    bands = [
        ("inside core >3 km", proj.buffer(-3000)),
        ("inside 1-3 km", proj.buffer(-1000).difference(proj.buffer(-3000))),
        ("inside 0-1 km", proj.difference(proj.buffer(-1000))),
        ("outside 0-1 km", proj.buffer(1000).difference(proj)),
        ("outside 1-3 km", proj.buffer(3000).difference(proj.buffer(1000))),
        ("outside 3-6 km", proj.buffer(6000).difference(proj.buffer(3000))),
    ]
    pts = [(transform(to_m, Point(lon, lat)), int(d[:4])) for lon, lat, d, _f, _c in firms]

    print("\n" + "=" * 78)
    print("TEST 2 — fire density by distance from the permit boundary")
    print("=" * 78)
    print(f"{'band':>20}{'area ha':>10}{'all':>8}{'/100k ha':>10}{'2023+':>8}{'/100k ha':>10}")
    for label, geom in bands:
        ha = geom.area / 1e4
        if ha <= 0:
            continue
        n = sum(1 for p, _y in pts if geom.contains(p))
        nr = sum(1 for p, y in pts if y >= 2023 and geom.contains(p))
        print(f"{label:>20}{ha:>10,.0f}{n:>8}{n / ha * 1e5:>10,.0f}{nr:>8}{nr / ha * 1e5:>10,.0f}")


def _same_year_share(grid, lon, lat, year) -> float | None:
    """Share of nearby canopy loss that is dated to `year`. None if no loss."""
    win = grid.window(lon, lat, WINDOW_RADIUS_PX)
    vals = win[win > 0]
    if vals.size == 0:
        return None
    return float((vals.astype(int) + 2000 == year).sum()) / vals.size


def test_coincidence(target, firms, grid, ring_geom, max_year):
    """TEST 3 — do the fires sit on that year's fresh clearing?"""
    inside_c: dict[int, Counter] = defaultdict(Counter)
    ring_c: dict[int, Counter] = defaultdict(Counter)

    for lon, lat, date, _frp, _conf in firms:
        year = int(date[:4])
        if year > max_year:  # Hansen has no loss year for the current season yet
            continue
        pt = Point(lon, lat)
        if target["geom"].contains(pt):
            bucket = inside_c
        elif ring_geom.contains(pt):
            bucket = ring_c
        else:
            continue
        share = _same_year_share(grid, lon, lat, year)
        if share is None:
            bucket[year]["no_loss"] += 1
        else:
            bucket[year]["same" if share >= SAME_YEAR_SHARE else "other"] += 1

    print("\n" + "=" * 78)
    print("TEST 3 — share of detections sitting on same-year canopy loss")
    print("=" * 78)
    print(f"{'season':>8}{'n inside':>10}{'same-year':>11}{'n ring':>9}{'same-year':>11}")
    ti = Counter(); tr = Counter()
    for year in sorted(set(inside_c) | set(ring_c)):
        a, b = inside_c[year], ring_c[year]
        ti += a; tr += b
        na, nb = sum(a.values()), sum(b.values())
        fa = f"{a['same'] / na * 100:.0f}%" if na else "-"
        fb = f"{b['same'] / nb * 100:.0f}%" if nb else "-"
        print(f"{year:>8}{na:>10}{fa:>11}{nb:>9}{fb:>11}")
    na, nb = sum(ti.values()), sum(tr.values())
    print(
        f"{'ALL':>8}{na:>10}{ti['same'] / na * 100:>10.0f}%"
        f"{nb:>9}{tr['same'] / nb * 100:>10.0f}%"
    )


def test_cleared_and_burned(target, firms, grid, max_year):
    """TEST 3b — of the area cleared each year, how much burned that year?

    The inverse framing of test 3, and the one that yields hectares. Fire
    proximity is painted into a boolean raster rather than measured per pixel,
    which is what makes this tractable over 130,000 ha.
    """
    from agni_spatial import TILE_PX, lat_to_px, lon_to_px, row_pixel_area_m2

    by_year = defaultdict(list)
    for lon, lat, date, _frp, _conf in firms:
        if target["geom"].contains(Point(lon, lat)):
            by_year[int(date[:4])].append((lon_to_px(lon), lat_to_px(lat)))

    xs = [p[0] for r in target["rings"] for p in r]
    ys = [p[1] for r in target["rings"] for p in r]
    tiles = [
        (x, y)
        for x in range(int(lon_to_px(min(xs)) // TILE_PX), int(lon_to_px(max(xs)) // TILE_PX) + 1)
        for y in range(int(lat_to_px(max(ys)) // TILE_PX), int(lat_to_px(min(ys)) // TILE_PX) + 1)
    ]
    radius = WINDOW_RADIUS_PX * 2 + 1  # ~400 m box around each detection

    print("\n" + "=" * 78)
    print("TEST 3b — of each year's clearing, how much burned that same year")
    print("=" * 78)
    print(f"{'year':>6}{'cleared ha':>12}{'with fire':>12}{'share':>8}")
    tot_c = tot_b = 0.0
    for year in range(2013, max_year + 1):
        pts = by_year.get(year, [])
        cleared = burned = 0.0
        for x, y in tiles:
            arr = grid.tile(x, y)
            sel = (arr == year - 2000) & grid.rasterise(target["rings"], x, y)
            if not sel.any():
                continue
            px_area = row_pixel_area_m2(y)
            cleared += px_area[sel].sum() / 1e4
            fire = np.zeros((TILE_PX, TILE_PX), bool)
            for gx, gy in pts:
                lx, ly = int(gx) - x * TILE_PX, int(gy) - y * TILE_PX
                if -radius <= lx < TILE_PX + radius and -radius <= ly < TILE_PX + radius:
                    fire[
                        max(0, ly - radius) : min(TILE_PX, ly + radius + 1),
                        max(0, lx - radius) : min(TILE_PX, lx + radius + 1),
                    ] = True
            both = sel & fire
            if both.any():
                burned += px_area[both].sum() / 1e4
        if cleared < 1:
            continue
        tot_c += cleared; tot_b += burned
        print(f"{year:>6}{cleared:>12,.0f}{burned:>12,.0f}{burned / cleared * 100:>7.0f}%")
    if tot_c:
        print(f"{'TOTAL':>6}{tot_c:>12,.0f}{tot_b:>12,.0f}{tot_b / tot_c * 100:>7.0f}%")


def test_bursts(target, firms):
    """TEST 4 — simultaneous ignitions, or one fire spreading?"""
    by_day = Counter()
    for lon, lat, date, _frp, _conf in firms:
        if target["geom"].contains(Point(lon, lat)):
            by_day[date] += 1

    def bucket(n: int) -> str:
        return "1" if n == 1 else "2-4" if n < 5 else "5-9" if n < 10 else "10-19" if n < 20 else "20+"

    days, dets = Counter(), Counter()
    for date, n in by_day.items():
        days[bucket(n)] += 1
        dets[bucket(n)] += n
    total = sum(dets.values())

    print("\n" + "=" * 78)
    print(f"TEST 4 — burst structure: {total} detections on {len(by_day)} days")
    print("=" * 78)
    print(f"{'detections/day':>16}{'days':>7}{'detections':>12}{'share':>8}")
    for b in ("1", "2-4", "5-9", "10-19", "20+"):
        print(f"{b:>16}{days[b]:>7}{dets[b]:>12}{dets[b] / total * 100:>7.0f}%")
    print("\n  largest single days:")
    for date, n in by_day.most_common(8):
        print(f"    {date}  {n}")


def test_overlap(target, permits, to_m):
    """TEST 5 — can the clearing be attributed to a different permit holder?"""
    print("\n" + "=" * 78)
    print("TEST 5 — overlap with any other permit")
    print("=" * 78)
    total = 0.0
    for p in permits:
        if p is target or p["name"] == target["name"]:
            continue
        if not p["geom"].intersects(target["geom"]):
            continue
        inter = p["geom"].intersection(target["geom"])
        ha = area_ha(inter, to_m) if not inter.is_empty else 0
        if ha < 50:  # sliver from independent digitising of a shared edge
            continue
        total += ha
        print(f"  {p['type']:>3} {p['name']:<48}{ha:>10,.0f} ha")
    if not total:
        print("  none — the clearing cannot be attributed to another permit holder")


# --------------------------------------------------------------- reporting ---


def report_identity(target, cache, to_m):
    print("=" * 78)
    print(f"{target['name']}  —  IUPHHK-{target['type']}")
    print("=" * 78)
    measured = area_ha(target["geom"], to_m)
    print(f"  decree     {target['no_sk']}")
    print(f"  area       {target['lssk']:,.0f} ha (decree) / {measured:,.0f} ha (measured)"
          f"  — {abs(measured - target['lssk']) / target['lssk'] * 100:.2f}% apart")
    w, s, e, n = target["geom"].bounds
    print(f"  bbox       {w:.4f},{s:.4f},{e:.4f},{n:.4f}")

    estate_path = os.path.join(cache, "permits", "forest_estate.json")
    if os.path.exists(estate_path):
        with open(estate_path) as fh:
            feats = json.load(fh).get("features", [])
        agg = defaultdict(float)
        for f in feats:
            g = esri_to_shapely(f["geometry"])
            if not g.intersects(target["geom"]):
                continue
            inter = target["geom"].intersection(g)
            if inter.is_empty:
                continue
            agg[str(f["attributes"].get("fungsitap"))] += area_ha(inter, to_m)
        if agg:
            print("  forest estate (KLHK penetapan):")
            covered = 0.0
            for code, ha in sorted(agg.items(), key=lambda kv: -kv[1]):
                if ha < 1:
                    continue
                covered += ha
                print(f"    {ha:>9,.0f} ha ({ha / measured * 100:5.1f}%)  {FOREST_CLASS.get(code, code)}")
            print(f"    {measured - covered:>9,.0f} ha ({(measured - covered) / measured * 100:5.1f}%)  outside gazetted estate")


def report_loss(target, grid):
    loss, mask_ha = grid.loss_by_year(target["rings"])
    target["loss"], target["mask_ha"] = loss, mask_ha
    print("\n" + "=" * 78)
    print("Canopy loss inside the concession (UMD/Hansen v1.13)")
    print("=" * 78)
    print(f"  raster mask area {mask_ha:,.0f} ha")
    running = 0.0
    print(f"{'year':>6}{'loss ha':>11}{'cumulative':>12}")
    for i in range(1, 26):
        if loss[i] <= 0:
            continue
        running += loss[i]
        print(f"{2000 + i:>6}{loss[i]:>11,.0f}{running / mask_ha * 100:>11.1f}%")
    print(f"{'TOTAL':>6}{running:>11,.0f}{running / mask_ha * 100:>11.1f}% of the concession")


def report_recent(target, cache, days=5):
    """Most recent NRT window, if one was fetched. Answers 'is it burning now?'"""
    import datetime as dt

    cutoff = (dt.date.today() - dt.timedelta(days=days)).isoformat()
    seen, by_date, frp = set(), Counter(), 0.0
    for path in sorted(glob.glob(os.path.join(cache, "firms", "*.csv"))):
        if os.path.getsize(path) == 0:
            continue
        with open(path, newline="") as fh:
            for r in csv.DictReader(fh):
                if r["acq_date"] < cutoff:
                    continue
                key = (r["latitude"], r["longitude"], r["acq_date"], r["acq_time"])
                if key in seen:
                    continue
                seen.add(key)
                if target["geom"].contains(Point(float(r["longitude"]), float(r["latitude"]))):
                    by_date[r["acq_date"]] += 1
                    frp += float(r.get("frp") or 0)
    if not by_date:
        return
    print("\n" + "=" * 78)
    print(f"Recent activity — detections inside the concession since {cutoff}")
    print("=" * 78)
    for date in sorted(by_date):
        print(f"  {date}  {by_date[date]:>4}")
    print(f"  total {sum(by_date.values())} detections, {frp:,.0f} MW cumulative FRP")


# -------------------------------------------------------------------- main ---


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cache", default=".cache")
    ap.add_argument("--name", default="KIANI LESTARI", help="substring of namobj")
    ap.add_argument("--season", default="06-01,11-30")
    # Two extents, deliberately different sizes:
    #   ring  — tight collar around the target, the control for test 3.
    #   peers — wide enough to capture comparable concessions, for test 1.
    # Both default to the target polygon padded outward. INVESTIGATION.md used
    # explicit values; pass them to reproduce those tables exactly.
    ap.add_argument(
        "--ring-bbox", default=None,
        help="control ring extent; INVESTIGATION.md used 116.60,0.45,117.45,1.32",
    )
    ap.add_argument("--ring-margin", type=float, default=0.09, help="degrees (~10 km)")
    ap.add_argument(
        "--peer-bbox", default=None,
        help="peer-comparison extent; INVESTIGATION.md used 116.20,0.20,117.80,1.60",
    )
    ap.add_argument("--peer-margin", type=float, default=0.35, help="degrees (~39 km)")
    ap.add_argument("--max-loss-year", type=int, default=2025,
                    help="last year present in the Hansen release")
    args = ap.parse_args()

    season = tuple(args.season.split(","))
    permits = load_permits(args.cache)
    if not permits:
        print("no permits cached — run: python fetch_data.py permits", file=sys.stderr)
        return 1

    matches = [p for p in permits if args.name.upper() in p["name"].upper()]
    if len(matches) != 1:
        print(f"{len(matches)} permits match {args.name!r}:", file=sys.stderr)
        for p in matches:
            print(f"  {p['type']:>3} {p['name']}", file=sys.stderr)
        return 1
    target = matches[0]

    lon0, lat0 = target["geom"].centroid.x, target["geom"].centroid.y
    to_m, from_m = equal_area(lon0, lat0)

    def extent(explicit: str | None, margin: float):
        if explicit:
            return tuple(map(float, explicit.split(",")))
        bw, bs, be, bn = target["geom"].bounds
        return bw - margin, bs - margin, be + margin, bn + margin

    rw, rs, re_, rn = extent(args.ring_bbox, args.ring_margin)
    pw, ps, pe, pn = extent(args.peer_bbox, args.peer_margin)
    ring_box = box(rw, rs, re_, rn)
    peer_box = box(pw, ps, pe, pn)
    ring_geom = ring_box.difference(target["geom"])

    firms = load_firms(args.cache, season)
    # The grid must cover the *peer* extent — the wider of the two — or peer
    # concessions would be scored against Hansen tiles that were never fetched.
    grid = LossGrid(args.cache, pw, ps, pe, pn)

    report_identity(target, args.cache, to_m)
    print(f"\n  control ring: {rw:.2f},{rs:.2f},{re_:.2f},{rn:.2f} minus the concession "
          f"({area_ha(ring_geom, to_m):,.0f} ha)")
    print(f"  peer extent : {pw:.2f},{ps:.2f},{pe:.2f},{pn:.2f}")
    print(f"  detections loaded: {len(firms):,} (season {season[0]}..{season[1]})")
    print(f"  hansen tiles: {grid.n_tiles}")

    report_loss(target, grid)
    test_peers(target, permits, firms, grid, to_m, peer_box)
    test_boundary(target, firms, to_m, from_m)
    test_coincidence(target, firms, grid, ring_geom, args.max_loss_year)
    test_cleared_and_burned(target, firms, grid, args.max_loss_year)
    test_bursts(target, firms)
    test_overlap(target, permits, to_m)
    report_recent(target, args.cache)

    print("\nSee Docs/INVESTIGATION.md section 1.8 for what these numbers do NOT show.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
