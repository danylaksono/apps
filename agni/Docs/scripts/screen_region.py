"""Screen every forestry concession in a region for fire that is getting worse.

    python screen_region.py --cache ../data --top 25

`analyze_concession.py` interrogates one concession in depth. This does the
opposite: it sweeps all of them cheaply, so the deep dive can be aimed at the
ones that deserve it rather than at the one that happened to be in the news.

Only FIRMS and the permit polygons are needed, so a whole island screens in a
couple of minutes with no raster work at all. Feed `--top` names back into
`analyze_concession.py`, or use `--loss` to add canopy loss for the leaders.

## The metric

Raw fire counts cannot be compared across years. 2015, 2019 and 2023 were El
Nino years when *everything* burned more, so a concession whose detections
tripled between 2014 and 2023 may simply have had the same weather as its
neighbours. Every figure here is therefore normalised against the region's own
land in the same season:

    excess(c, era) = detections/ha inside concession c
                     -------------------------------------
                     detections/ha across the region's land

An excess of 1.0 means the concession burned exactly like the landscape around
it. 5.0 means five times as intensely. `acceleration` is the ratio of a
concession's late-era excess to its early-era excess: how much *worse* it has
got relative to its own surroundings, with climate divided out.

The regional denominator uses the kab/kota outline from `public/data/`, so sea,
Sarawak, Sabah and Brunei inside the request bbox are excluded.
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import os
import sys
from collections import Counter, defaultdict
from typing import Iterable

import numpy as np
import shapely
from shapely.geometry import shape
from shapely.ops import transform, unary_union
from shapely.strtree import STRtree

from agni_spatial import LossGrid, equal_area, esri_to_shapely, shapely_to_rings

PROVINCES = {
    "61": "Kalimantan Barat",
    "62": "Kalimantan Tengah",
    "63": "Kalimantan Selatan",
    "64": "Kalimantan Timur",
    "65": "Kalimantan Utara",
}

# Two five-season windows with a four-year gap, so no single freak year drives
# the comparison and the eras cannot overlap. The late window's final season is
# partial (the current year), which does not bias `excess` — the regional
# denominator is short by the same amount — but does deflate the raw
# `fire/100k ha` column slightly.
EARLY_ERA = (2013, 2017)
LATE_ERA = (2022, 2026)

# Below this many late-era detections the excess ratio is noise, not signal.
MIN_LATE_DETECTIONS = 30
# Below this size a permit's density swings wildly on a handful of detections.
MIN_AREA_HA = 5_000
# The acceleration table additionally requires the concession to have reached at
# least the regional rate. Without this it fills up with permits that went from
# almost no fire to slightly-less-than-average fire — a large ratio describing
# nothing anyone would call a fire problem.
MIN_LATE_EXCESS_FOR_ACCEL = 1.0


# ------------------------------------------------------------------ loading ---


def load_permits(cache: str) -> list[dict]:
    out = []
    for kind, label in (("ha", "HA"), ("hti", "HTI"), ("re", "RE")):
        path = os.path.join(cache, "permits", f"{kind}.json")
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
        for f in data.get("features", []):
            a = f["attributes"]
            geom = esri_to_shapely(f["geometry"])
            if geom.is_empty:
                continue
            out.append(
                {
                    "name": a["namobj"],
                    "type": label,
                    "prov": a.get("kdprv"),
                    "lssk": a.get("lssk") or 0,
                    "no_sk": a.get("no_sk"),
                    "geom": geom,
                    "rings": f["geometry"]["rings"],
                }
            )
    return out


def load_land(provinces: Iterable[str], kabkota: str):
    """Union of kab/kota polygons for the provinces in scope.

    This is the denominator. Without it the regional rate would be computed over
    a bounding box that is mostly sea and Malaysian Borneo, deflating it by a
    factor of two and inflating every concession's excess to match.
    """
    with open(kabkota, encoding="utf-8") as fh:
        fc = json.load(fh)
    wanted = set(provinces)
    geoms = [
        shape(f["geometry"]).buffer(0)
        for f in fc["features"]
        if f["properties"].get("provinsi_code") in wanted
    ]
    if not geoms:
        raise SystemExit("no kab/kota matched those province codes")
    return unary_union(geoms)


def load_firms(cache: str, season: tuple[str, str]):
    """De-duplicated detections as parallel numpy arrays.

    A million-plus rows makes the representation matter: tuples-of-python-floats
    would run to gigabytes. Coordinates are float32 (~1 m precision at this
    latitude, far finer than VIIRS geolocation) and the year is int16.
    """
    seen: set[str] = set()
    lons: list[float] = []
    lats: list[float] = []
    years: list[int] = []
    frps: list[float] = []

    files = sorted(glob.glob(os.path.join(cache, "firms", "*.csv")))
    for i, path in enumerate(files):
        if os.path.getsize(path) == 0:
            continue
        with open(path, newline="", encoding="utf-8") as fh:
            for r in csv.DictReader(fh):
                date = r["acq_date"]
                if not (season[0] <= date[5:] <= season[1]):
                    continue
                key = f"{r['latitude']}|{r['longitude']}|{date}|{r['acq_time']}"
                if key in seen:
                    continue
                seen.add(key)
                lons.append(float(r["longitude"]))
                lats.append(float(r["latitude"]))
                years.append(int(date[:4]))
                frps.append(float(r.get("frp") or 0))
        if i % 100 == 0:
            print(f"    {i}/{len(files)} files, {len(lons):,} detections", file=sys.stderr)

    return (
        np.array(lons, np.float32),
        np.array(lats, np.float32),
        np.array(years, np.int16),
        np.array(frps, np.float32),
    )


# ------------------------------------------------------------------ scoring ---


def assign(points, geoms) -> dict[int, np.ndarray]:
    """Map each polygon index to the indices of the points inside it.

    Vectorised: shapely 2's STRtree takes the whole point array at once and
    returns index pairs. Looping a million `contains` calls in Python would take
    hours; this takes seconds.
    """
    tree = STRtree(geoms)
    pairs = tree.query(points, predicate="intersects")
    out: dict[int, list[int]] = defaultdict(list)
    for point_idx, geom_idx in zip(pairs[0], pairs[1]):
        out[int(geom_idx)].append(int(point_idx))
    return {k: np.array(v) for k, v in out.items()}


def main() -> int:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--cache", default="../data")
    ap.add_argument("--kabkota", default="../../public/data/kabkota_indonesia.geojson")
    ap.add_argument("--provinces", default="61,62,63,64,65")
    ap.add_argument("--season", default="06-01,11-30")
    ap.add_argument("--top", type=int, default=25, help="rows in the ranked tables")
    ap.add_argument("--loss", action="store_true",
                    help="also measure Hansen canopy loss for the top rows (slow)")
    ap.add_argument("--csv", default=None, help="write the full per-concession table here")
    args = ap.parse_args()

    provinces = [p.strip() for p in args.provinces.split(",")]
    season = tuple(args.season.split(","))

    print("loading permits ...", file=sys.stderr)
    permits = load_permits(args.cache)
    permits = [p for p in permits if p["prov"] in provinces]
    print("loading land outline ...", file=sys.stderr)
    land = load_land(provinces, args.kabkota)
    print("loading firms ...", file=sys.stderr)
    lons, lats, years, frps = load_firms(args.cache, season)

    lon0, lat0 = land.centroid.x, land.centroid.y
    to_m, _ = equal_area(lon0, lat0)
    land_ha = transform(to_m, land).area / 1e4

    points = shapely.points(lons.astype(float), lats.astype(float))

    # --- regional baseline: detections on land, per year -------------------
    print("indexing land ...", file=sys.stderr)
    land_parts = list(land.geoms) if land.geom_type == "MultiPolygon" else [land]
    on_land = np.zeros(len(points), bool)
    for idxs in assign(points, land_parts).values():
        on_land[idxs] = True

    all_years = sorted(set(years.tolist()))
    land_by_year = Counter(years[on_land].tolist())

    print("\n" + "=" * 78)
    print(f"REGIONAL BASELINE — {', '.join(PROVINCES.get(p, p) for p in provinces)}")
    print("=" * 78)
    print(f"land area {land_ha:,.0f} ha; {int(on_land.sum()):,} of {len(points):,} "
          f"detections fall on it (rest is sea, Sarawak, Sabah, Brunei)")
    print(f"\n{'season':>8}{'detections':>12}{'/100k ha':>11}")
    for y in all_years:
        n = land_by_year[y]
        print(f"{y:>8}{n:>12,}{n / land_ha * 1e5:>11.1f}")

    # --- per-concession ----------------------------------------------------
    print("indexing concessions ...", file=sys.stderr)
    for p in permits:
        p["ha"] = transform(to_m, p["geom"]).area / 1e4
    hits = assign(points, [p["geom"] for p in permits])

    inside_any = np.zeros(len(points), bool)
    for i, idxs in hits.items():
        inside_any[idxs] = True
        p = permits[i]
        p["idx"] = idxs
        p["by_year"] = Counter(years[idxs].tolist())
        p["frp"] = float(frps[idxs].sum())
    for p in permits:
        p.setdefault("idx", np.array([], int))
        p.setdefault("by_year", Counter())
        p.setdefault("frp", 0.0)

    conc_ha = sum(p["ha"] for p in permits)
    in_conc = int((inside_any & on_land).sum())
    print(f"\nIUPHHK concessions: {len(permits)} permits, {conc_ha:,.0f} ha "
          f"({conc_ha / land_ha * 100:.1f}% of land)")
    print(f"detections inside a concession: {in_conc:,} "
          f"({in_conc / max(1, int(on_land.sum())) * 100:.1f}% of all land detections)")

    # Excess per era, normalised against the region's own rate in those years.
    def era_rate(era):
        n = sum(land_by_year[y] for y in range(era[0], era[1] + 1))
        return n / land_ha

    early_rate, late_rate = era_rate(EARLY_ERA), era_rate(LATE_ERA)
    for p in permits:
        e = sum(p["by_year"][y] for y in range(EARLY_ERA[0], EARLY_ERA[1] + 1))
        l = sum(p["by_year"][y] for y in range(LATE_ERA[0], LATE_ERA[1] + 1))
        p["n_early"], p["n_late"] = e, l
        p["excess_early"] = (e / p["ha"]) / early_rate if p["ha"] and early_rate else 0.0
        p["excess_late"] = (l / p["ha"]) / late_rate if p["ha"] and late_rate else 0.0
        # A concession with no early fire has an undefined ratio; floor the
        # denominator at the level one detection would have produced, so it
        # ranks high without dividing by zero.
        floor = (1 / p["ha"]) / early_rate if p["ha"] and early_rate else 1.0
        p["acceleration"] = p["excess_late"] / max(p["excess_early"], floor)
        p["density_late"] = l / p["ha"] * 1e5 if p["ha"] else 0.0

    ranked = [
        p for p in permits
        if p["ha"] >= MIN_AREA_HA and p["n_late"] >= MIN_LATE_DETECTIONS
    ]

    def table(rows, title, note):
        print("\n" + "=" * 78)
        print(title)
        print("=" * 78)
        print(note)
        print(f"\n{'concession':<40}{'prov':>5}{'cls':>4}{'ha':>9}"
              f"{'fire/100k':>10}{'excess':>8}{'was':>7}{'accel':>7}")
        for p in rows:
            print(
                f"{p['name'][:38]:<40}{p['prov']:>5}{p['type']:>4}{p['ha']:>9,.0f}"
                f"{p['density_late']:>10,.0f}{p['excess_late']:>8.1f}"
                f"{p['excess_early']:>7.1f}{p['acceleration']:>7.1f}"
            )

    table(
        sorted(ranked, key=lambda p: -p["excess_late"])[: args.top],
        f"MOST FIRE-INTENSE CONCESSIONS, {LATE_ERA[0]}-{LATE_ERA[1]}",
        "excess = times the regional per-hectare rate. was = the same figure for "
        f"{EARLY_ERA[0]}-{EARLY_ERA[1]}.",
    )
    accelerating = [p for p in ranked if p["excess_late"] >= MIN_LATE_EXCESS_FOR_ACCEL]
    table(
        sorted(accelerating, key=lambda p: -p["acceleration"])[: args.top],
        f"FASTEST-ACCELERATING CONCESSIONS ({EARLY_ERA[0]}-{EARLY_ERA[1]} "
        f"vs {LATE_ERA[0]}-{LATE_ERA[1]})",
        "accel = how many times worse the concession got relative to its region, "
        "with climate divided out.\n"
        f"Restricted to concessions now at or above the regional rate "
        f"(excess >= {MIN_LATE_EXCESS_FOR_ACCEL}); {len(accelerating)} of "
        f"{len(ranked)} qualify.",
    )

    # --- by class and province --------------------------------------------
    print("\n" + "=" * 78)
    print("BY PERMIT CLASS AND PROVINCE")
    print("=" * 78)
    print(f"{'group':<28}{'permits':>9}{'ha':>12}{'early':>9}{'late':>9}{'accel':>7}")
    groups: dict[str, list] = defaultdict(list)
    for p in permits:
        groups[f"IUPHHK-{p['type']}"].append(p)
        groups[PROVINCES.get(p["prov"], p["prov"])].append(p)
    for key in sorted(groups, key=lambda k: (not k.startswith("IUPHHK"), k)):
        rows = groups[key]
        ha = sum(p["ha"] for p in rows)
        e = sum(p["n_early"] for p in rows)
        l = sum(p["n_late"] for p in rows)
        xe = (e / ha) / early_rate if ha else 0
        xl = (l / ha) / late_rate if ha else 0
        print(f"{key:<28}{len(rows):>9}{ha:>12,.0f}{xe:>9.2f}{xl:>9.2f}"
              f"{(xl / xe if xe else 0):>7.1f}")

    # --- optional canopy loss for the leaders ------------------------------
    if args.loss:
        leaders = sorted(ranked, key=lambda p: -p["excess_late"])[: args.top]
        print("\n" + "=" * 78)
        print(f"CANOPY LOSS FOR THE TOP {len(leaders)} (UMD/Hansen v1.13)")
        print("=" * 78)
        print(f"{'concession':<40}{'ha':>9}{'loss01-25':>11}{'loss23-25':>11}")
        for p in leaders:
            w, s, e_, n_ = p["geom"].bounds
            grid = LossGrid(args.cache, w, s, e_, n_)
            loss, mask_ha = grid.loss_by_year(shapely_to_rings(p["geom"]))
            p["loss_all"] = sum(loss[1:26]) / mask_ha * 100 if mask_ha else 0
            p["loss_recent"] = sum(loss[23:26]) / mask_ha * 100 if mask_ha else 0
            print(f"{p['name'][:38]:<40}{mask_ha:>9,.0f}"
                  f"{p['loss_all']:>10.1f}%{p['loss_recent']:>10.1f}%")

    if args.csv:
        with open(args.csv, "w", newline="", encoding="utf-8") as fh:
            w = csv.writer(fh)
            w.writerow(["name", "type", "province", "ha", "lssk", "no_sk",
                        "n_early", "n_late", "density_late_per_100k",
                        "excess_early", "excess_late", "acceleration", "frp_total"])
            for p in sorted(permits, key=lambda p: -p["excess_late"]):
                w.writerow([p["name"], p["type"], PROVINCES.get(p["prov"], p["prov"]),
                            round(p["ha"]), p["lssk"], p["no_sk"],
                            p["n_early"], p["n_late"], round(p["density_late"]),
                            round(p["excess_early"], 2), round(p["excess_late"], 2),
                            round(p["acceleration"], 2), round(p["frp"])])
        print(f"\nwrote {args.csv}")

    print("\nSee Docs/INVESTIGATION.md for what these numbers do NOT show.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
