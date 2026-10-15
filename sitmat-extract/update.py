#!/usr/bin/env python3
"""
Bring the dashboard data up to today with one command:

    python update.py                 # download what is new, rebuild the CSVs, refresh station regions
    python update.py --check         # only say how far behind the data is, no requests
    python update.py --no-geo        # skip the spatial join even if new stations appeared
    python update.py --delay 2.5     # any other option is passed to sitmat_tmat_extract.py

Steps
    1. download: concession snapshots for every missing day (plus the last two, which may have been partial),
       and the community stations (their history is merged, because the API only reaches back 90 days)
    2. process: rebuild sitmat_out/processed/*.csv for first day .. today
    3. geo: if stations appeared that have no KHG / province yet, run prepare_geo.py (needs geopandas)

Downloads are resumable: if it stops on a rate limit, run it again.
"""
import csv
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "sitmat_out"
PROC = OUT / "processed"
FIRST_DAY = date(2026, 4, 1)          # first day the concession API has data for


def last_day():
    """Latest date in daily_long.csv, or None when there is no data yet."""
    f = PROC / "daily_long.csv"
    if not f.exists():
        return None
    with open(f, encoding="utf-8", newline="") as fh:
        days = {r["date"] for r in csv.DictReader(fh)}
    return date.fromisoformat(max(days)) if days else None


def first_day():
    f = PROC / "daily_long.csv"
    if not f.exists():
        return FIRST_DAY
    with open(f, encoding="utf-8", newline="") as fh:
        return date.fromisoformat(min(r["date"] for r in csv.DictReader(fh)))


def missing_geo():
    """Stations in stations.csv that stations_geo.csv does not know yet."""
    st, geo = PROC / "stations.csv", PROC / "stations_geo.csv"
    if not st.exists():
        return 0
    known = set()
    if geo.exists():
        with open(geo, encoding="utf-8", newline="") as fh:
            known = {(r["kind"], r["station_id"]) for r in csv.DictReader(fh)}
    with open(st, encoding="utf-8", newline="") as fh:
        return sum((r["kind"], r["station_id"]) not in known for r in csv.DictReader(fh))


def main():
    args = sys.argv[1:]
    check, no_geo = "--check" in args, "--no-geo" in args
    passthru = [a for a in args if a not in ("--check", "--no-geo")]
    today, last = date.today(), last_day()
    start = first_day()
    print(f"data: {start} .. {last or 'none'}   today: {today}   behind: {(today - last).days if last else 'n/a'} day(s)")
    if check:
        return 0
    cmd = [sys.executable, str(ROOT / "sitmat_tmat_extract.py"), "all", "--out", str(OUT),
           "--start", start.isoformat(), "--end", today.isoformat(), *passthru]
    print("\n>", " ".join(cmd[1:]), "\n")
    code = subprocess.call(cmd, cwd=ROOT)
    if code:
        print("\nStopped before finishing. Run `python update.py` again to resume.")
        return code
    new_last = last_day()
    n = missing_geo()
    if n and not no_geo:
        try:
            import geopandas  # noqa: F401
        except ImportError:
            print(f"\n{n} station(s) have no KHG / province yet. To assign them: pip install geopandas && python prepare_geo.py")
        else:
            print(f"\n{n} new station(s): running prepare_geo.py")
            code = subprocess.call([sys.executable, str(ROOT / "prepare_geo.py")], cwd=ROOT)
            if code:
                return code
    elif n:
        print(f"\n{n} station(s) have no KHG / province yet (skipped).")
    print(f"\nDone. Data now runs to {new_last}. Reload the dashboard (Ctrl+F5).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
