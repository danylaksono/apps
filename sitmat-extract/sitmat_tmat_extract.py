#!/usr/bin/env python3
"""
SiTMAT TMAT extractor  (v2: date range, throttling, resume, post-processing)
===========================================================================

Download TMA data from https://sitmat.kemenlh.go.id/. The API contains two kinds of points:
---------------------------------------------------------------------
COMMUNITY stations ("Masyarakat", source simatag, ~124 stations)
    GET /api/air-gambut                                 -> list of stations
    GET /api/air-gambut/masyarakat/station-detail
            ?station_id=..&days=N&source=simatag        -> N+1 daily records
    => ONE request per station covers the whole period (days is counted back
       from today, so we ask for enough days and cut to your dates later).

CONCESSION points ("Konsesi", source gambutindonesia, several hundred)
    GET /api/konsensi?tanggal=YYYY-MM-DD                -> one snapshot per date
    * The set of points DIFFERS from date to date (e.g. 239 .. 685), so we keep
      the union of all dates.
    * Each point's "history" block is ALWAYS the last 30 days up to today and
      ignores `tanggal`. The `detail` block IS for the requested date.
    => To get two months we make ONE request per calendar day (a few MB each).

Pipeline
--------
    download  -> raw gzip'd JSON under <out>/raw/   (resumable)
    process   -> tidy CSVs under <out>/processed/    (no network needed)

Rate-limit guard (see the Throttle class)
-----------------------------------------
    * minimum gap between requests (+ random jitter)
    * cap on requests per minute and an optional total budget
    * HTTP 429/503: honour Retry-After, back off, slow down for the rest of
      the run; after several in a row the script STOPS cleanly
    * HTTP 401/403: stop immediately (we may have been blocked)
    * every finished file is kept, so just re-run to resume

Usage
-----
    pip install requests
    python sitmat_tmat_extract.py all --start 2026-08-14 --end 2026-10-13
    python sitmat_tmat_extract.py download --start 2026-08-14 --end 2026-10-13 --only concession
    python sitmat_tmat_extract.py process  --start 2026-08-14 --end 2026-10-13
    python sitmat_tmat_extract.py download --end 2026-10-13 --limit 3 --delay 2   # dry-ish test

NOTE: the endpoints are undocumented and may change. Be polite with the rate.
"""

import argparse
import csv
import gzip
import json
import random
import re
import statistics
import sys
import time
from collections import defaultdict, deque
from datetime import date, datetime, timedelta
from pathlib import Path

import requests

BASE = "https://sitmat.kemenlh.go.id"
HEADERS = {"User-Agent": "tmat-research-script/2.0", "Accept": "application/json"}

# Limits found by testing the live site on 2026-10-14 (they may change):
COMMUNITY_MAX_DAYS = 90                  # station-detail clamps `days` to 90
CONCESSION_EARLIEST = date(2026, 4, 1)   # first date /api/konsensi returns data for


# ==========================================================================
# 1. Throttling / rate-limit guard
# ==========================================================================
class Abort(Exception):
    """Raised when we should stop the run (blocked, too many rate-limit hits...)."""


class Throttle:
    """
    Decides how long to wait before each request and slows down when the
    server pushes back.

    delay        base gap between requests in seconds
    jitter       extra random 0..jitter seconds, so requests are not clockwork
    max_per_min  hard cap on requests in any rolling 60 s window
    max_requests optional total budget for this run (0 = unlimited)
    """

    def __init__(self, delay=1.5, jitter=0.5, max_per_min=30, max_requests=0):
        self.base_delay = delay
        self.delay = delay            # current delay; grows after rate limiting
        self.jitter = jitter
        self.max_per_min = max_per_min
        self.max_requests = max_requests
        self.sent = 0
        self.stamps = deque()         # send times of the last minute
        self.last = 0.0               # time of the previous request

    def wait(self):
        """Block until it is OK to send the next request."""
        if self.max_requests and self.sent >= self.max_requests:
            raise Abort(f"request budget of {self.max_requests} reached "
                        "(re-run to continue where you left off)")
        # (a) minimum gap since the previous request
        gap = self.delay + random.uniform(0, self.jitter)
        time.sleep(max(0.0, self.last + gap - time.monotonic()))
        # (b) rolling per-minute cap
        now = time.monotonic()
        while self.stamps and now - self.stamps[0] > 60:
            self.stamps.popleft()
        if len(self.stamps) >= self.max_per_min:
            time.sleep(max(0.0, 60 - (now - self.stamps[0])) + 0.1)
        self.last = time.monotonic()
        self.stamps.append(self.last)
        self.sent += 1

    def ok(self):
        """Request succeeded: slowly relax back towards the base delay."""
        self.delay = max(self.base_delay, self.delay * 0.9)

    def slow_down(self):
        """Server pushed back: double the delay (max 60 s) for the rest of the run."""
        self.delay = min(60.0, self.delay * 2)


class Client:
    """requests wrapper that applies the Throttle and handles errors."""

    def __init__(self, throttle, max_retries=4, max_blocks=3, log=None):
        self.s = requests.Session()
        self.s.headers.update(HEADERS)
        self.t = throttle
        self.max_retries = max_retries
        self.max_blocks = max_blocks      # consecutive 429/503 before we give up
        self.blocks = 0
        self.log = log or (lambda m: None)

    def get_json(self, path, params=None):
        """GET and parse JSON. Returns None for 404; raises Abort when we should stop."""
        for attempt in range(1, self.max_retries + 1):
            self.t.wait()
            try:
                r = self.s.get(BASE + path, params=params, timeout=90)
            except requests.RequestException as exc:      # network hiccup
                self.log(f"network error {exc} (attempt {attempt})")
                time.sleep(5 * attempt)
                continue

            if r.status_code == 200:
                try:
                    data = r.json()
                except ValueError:
                    self.log("200 but body is not JSON; retrying")
                    time.sleep(3 * attempt)
                    continue
                self.blocks = 0
                self.t.ok()
                return data

            if r.status_code == 404:
                return None

            if r.status_code in (401, 403):
                raise Abort(f"HTTP {r.status_code}: access refused - we may be "
                            "blocked. Stopping; wait before trying again.")

            if r.status_code in (429, 503):               # rate limited / overloaded
                self.blocks += 1
                self.t.slow_down()
                retry_after = r.headers.get("Retry-After", "")
                wait = int(retry_after) if retry_after.isdigit() else 30 * 2 ** (attempt - 1)
                wait = min(wait, 900)
                self.log(f"HTTP {r.status_code}; waiting {wait}s, delay now {self.t.delay:.1f}s")
                if self.blocks >= self.max_blocks:
                    raise Abort(f"{self.blocks} rate-limit responses in a row; "
                                "stopping. Re-run later to resume.")
                time.sleep(wait)
                continue

            # The concession endpoint answers 502 + {"error": "Failed to load ..."} for
            # dates it has no data for (anything before ~2026-04-01). That is "no data",
            # not an outage: try once more, then give up on this date quietly.
            if r.status_code == 502 and '"error"' in r.text[:300]:
                if attempt >= 2:
                    return None
                time.sleep(3)
                continue

            # other 5xx etc: short backoff and retry
            self.log(f"HTTP {r.status_code}; retrying")
            time.sleep(5 * attempt)
        return "FAILED"            # exhausted retries for this one request


# ==========================================================================
# 2. Small helpers
# ==========================================================================
def daterange(start, end):
    """Every date from start to end inclusive."""
    for i in range((end - start).days + 1):
        yield start + timedelta(days=i)


def safe_name(text):
    """'130_CNP:22' -> '130_CNP_22' (safe as a filename)."""
    return re.sub(r"[^A-Za-z0-9._-]+", "_", str(text))


def save_gz(path, obj):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")      # write then rename: no half files
    with gzip.open(tmp, "wt", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False)
    tmp.replace(path)


def load_gz(path):
    with gzip.open(path, "rt", encoding="utf-8") as fh:
        return json.load(fh)


def num(x):
    """Convert to float. Treats None, '', 'NaN', 'null' as missing (None)."""
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return None if x != x else float(x)           # x != x  is True only for NaN
    x = str(x).strip()
    if x == "" or x.lower() in ("nan", "null", "none", "-"):
        return None
    try:
        return float(x)
    except ValueError:
        return None


def parse_date(x):
    """Accept '2026-10-13' or '13-Oct-2026' or '13-10-2026'; return a date or None."""
    if not x:
        return None
    for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(str(x)[:11].strip(), fmt).date()
        except ValueError:
            pass
    return None


# ==========================================================================
# 3. DOWNLOAD
# ==========================================================================
def download_community(client, out, start, end, limit, log):
    raw = out / "raw" / "community_detail"
    # The server counts days back from *today*, so ask for enough days to reach `start`.
    # It silently clamps `days` to 90, so anything older is NOT available this way.
    wanted = max(1, (date.today() - start).days + 1)
    days = min(wanted, COMMUNITY_MAX_DAYS)
    if wanted > days:
        print(f"WARNING: community history is limited to {COMMUNITY_MAX_DAYS} days "
              f"(back to {date.today() - timedelta(days=days)}); "
              f"earlier dates in your range will be empty for community stations.")

    # 3a. station list (always refreshed - it's one cheap request)
    lst = client.get_json("/api/air-gambut")
    if not lst or lst == "FAILED":
        raise Abort("could not fetch the community station list")
    save_gz(out / "raw" / "community_list.json.gz", lst)
    feats = lst["features"]
    print(f"community: {len(feats)} stations, asking for days={days}")

    # 3b. one request per station
    todo = feats[:limit] if limit else feats
    for i, f in enumerate(todo, 1):
        sid = f["properties"].get("station_id") or f["properties"].get("code")
        target = raw / f"{safe_name(sid)}.json.gz"
        # skip if already downloaded for (at least) this many days
        if target.exists():
            try:
                if load_gz(target).get("_days", 0) >= days:
                    continue
            except Exception:
                pass                                   # corrupt file -> download again
        data = client.get_json(
            "/api/air-gambut/masyarakat/station-detail",
            {"station_id": sid, "days": days, "source": "simatag"},
        )
        if data in (None, "FAILED"):
            log(f"community {sid}: no data ({data})")
            continue
        data["_days"] = days                           # remember what we asked for
        save_gz(target, data)
        print(f"  [{i}/{len(todo)}] community {sid}")


def download_concession(client, out, start, end, limit, log):
    raw = out / "raw" / "concession"
    # Dates before CONCESSION_EARLIEST return "502 Failed to load" (no data), so skip
    # them up front instead of spending hundreds of slow requests on them.
    first = max(start, CONCESSION_EARLIEST)
    if first > start:
        print(f"NOTE: concession snapshots only exist from {CONCESSION_EARLIEST}; "
              f"skipping {start} .. {first - timedelta(days=1)}")
    dates = list(daterange(first, end))
    if limit:
        dates = dates[-limit:]
    today = date.today()
    for i, d in enumerate(dates, 1):
        target = raw / f"{d.isoformat()}.json.gz"
        # keep finished days; always refresh today (still changing)
        if target.exists() and d < today:
            continue
        data = client.get_json("/api/konsensi", {"tanggal": d.isoformat()})
        if data in (None, "FAILED"):
            log(f"concession {d}: no data ({data})")
            continue
        save_gz(target, data)
        print(f"  [{i}/{len(dates)}] concession {d}: {len(data.get('features', []))} points")


def run_download(args, out):
    out.mkdir(parents=True, exist_ok=True)
    logfile = open(out / "download.log", "a", encoding="utf-8")

    def log(msg):
        line = f"{datetime.now():%Y-%m-%d %H:%M:%S} {msg}"
        print("  !", msg)
        logfile.write(line + "\n")
        logfile.flush()

    throttle = Throttle(args.delay, args.jitter, args.max_per_min, args.max_requests)
    client = Client(throttle, log=log)
    try:
        if args.only in ("both", "community"):
            download_community(client, out, args.start_d, args.end_d, args.limit, log)
        if args.only in ("both", "concession"):
            download_concession(client, out, args.start_d, args.end_d, args.limit, log)
    except Abort as exc:
        log(f"STOPPED: {exc}")
        print(f"\nStopped early: {exc}\nEverything downloaded so far is kept - re-run the "
              "same command to resume.")
        return 2
    print(f"\nDownload finished ({throttle.sent} requests).")
    return 0


# ==========================================================================
# 4. PROCESS (raw JSON -> tidy CSV)
# ==========================================================================
ROW_FIELDS = ["kind", "station_id", "date", "water_level_cm", "water_level_min_cm",
              "water_level_max_cm", "soil_moisture_pct", "rain_fall_mm",
              "status", "source", "flag"]


def community_rows(out):
    """Daily rows for community stations + a station-info dict."""
    info, rows = {}, []
    lst = out / "raw" / "community_list.json.gz"
    if lst.exists():
        for f in load_gz(lst)["features"]:
            p, c = f["properties"], (f.get("geometry") or {}).get("coordinates") or [None, None]
            sid = p.get("station_id") or p.get("code")
            info[("community", sid)] = {
                "kind": "community", "station_id": sid,
                "name": p.get("nama") or p.get("lokasi"), "company_code": "", "company_name": "",
                "lon": c[0], "lat": c[1], "provinsi": p.get("provinsi", ""),
                "kabupaten": p.get("kabupaten", ""), "kecamatan": p.get("kecamatan", ""),
            }
    for fp in sorted((out / "raw" / "community_detail").glob("*.json.gz")):
        d = load_gz(fp)
        p = (d.get("properties") or {}).get("properties") or {}
        sid = p.get("station_id") or p.get("code")
        for h in p.get("history") or []:
            day = parse_date(h.get("date") or h.get("tanggal"))
            if not day:
                continue
            rows.append({
                "kind": "community", "station_id": sid, "date": day,
                # history gives ONE value per day (the latest reading, 'jam' = its hour)
                "water_level_cm": num(h.get("water_level")),
                "water_level_min_cm": None, "water_level_max_cm": None,
                "soil_moisture_pct": num(h.get("soil_moisture")),
                "rain_fall_mm": num(h.get("rain_fall")),
                "status": h.get("status_label", ""), "source": "community_history", "flag": "",
            })
    return rows, info


def concession_rows(out):
    """
    Daily rows for concession points.
    * one row per (point, requested date) from the `detail` block  -> 'snapshot'
    * plus the 30-day `history` of the NEWEST file, only for dates
      with no snapshot (fills gaps)                                -> 'history'
    """
    info, rows = {}, []
    files = sorted((out / "raw" / "concession").glob("*.json.gz"))
    for fp in files:
        req_day = parse_date(fp.name[:10])
        for f in load_gz(fp).get("features", []):
            p = f["properties"]
            sid = p.get("id")
            c = (f.get("geometry") or {}).get("coordinates") or [None, None]
            info[("concession", sid)] = {            # later files overwrite earlier ones
                "kind": "concession", "station_id": sid, "name": p.get("name"),
                "company_code": p.get("kode_perusahaan", ""),
                "company_name": p.get("nama_perusahaan", ""),
                "lon": c[0], "lat": c[1], "provinsi": p.get("Provinsi", ""),
                "kabupaten": p.get("Kabupaten", ""), "kecamatan": p.get("Kecamatan", ""),
            }
            det = p.get("detail") or {}
            line = (det.get("ListTableLineData") or [{}])[0]
            day = parse_date(det.get("Tanggal")) or req_day
            wl = num(line.get("WaterLevelAvg"))
            rows.append({
                "kind": "concession", "station_id": sid, "date": day,
                "water_level_cm": wl if wl is not None else num(det.get("WaterLevel")),
                "water_level_min_cm": num(line.get("WaterLevelMin")),
                "water_level_max_cm": num(line.get("WaterLevelMax")),
                "soil_moisture_pct": num(det.get("SoilMoisture")),
                "rain_fall_mm": num(det.get("RainFall")),
                "status": p.get("Status", ""), "source": "snapshot",
                "flag": "" if day == req_day else "date_mismatch",
            })
    if files:                                          # gap-fill from newest file's history
        for f in load_gz(files[-1]).get("features", []):
            p = f["properties"]
            for h in p.get("history") or []:
                day = parse_date(h.get("tanggal"))
                if day:
                    rows.append({
                        "kind": "concession", "station_id": p.get("id"), "date": day,
                        "water_level_cm": num(h.get("water_level")),
                        "water_level_min_cm": None, "water_level_max_cm": None,
                        "soil_moisture_pct": num(h.get("soil_moisture")),
                        "rain_fall_mm": num(h.get("rain_fall")),
                        "status": "", "source": "history", "flag": "",
                    })
    return rows, info


def flag_outliers(rows, min_wl, max_wl, spike_cm):
    """
    Add QC flags to each row (we FLAG, we never delete):
      range  water level outside [min_wl, max_wl]
      spike  differs from the median of its 4 nearest neighbours by > spike_cm
    """
    series = defaultdict(list)
    for r in rows:
        series[(r["kind"], r["station_id"])].append(r)
    for rs in series.values():
        rs.sort(key=lambda r: r["date"])
        vals = [r["water_level_cm"] for r in rs]
        for i, r in enumerate(rs):
            v, flags = r["water_level_cm"], []
            if r["flag"]:
                flags.append(r["flag"])
            if v is not None:
                if v < min_wl or v > max_wl:
                    flags.append("range")
                nb = [x for x in vals[max(0, i - 2):i] + vals[i + 1:i + 3] if x is not None]
                if len(nb) >= 3 and abs(v - statistics.median(nb)) > spike_cm:
                    flags.append("spike")
            r["flag"] = ";".join(flags)


def run_process(args, out):
    start, end = args.start_d, args.end_d
    pdir = out / "processed"
    pdir.mkdir(parents=True, exist_ok=True)

    c_rows, c_info = community_rows(out) if (out / "raw" / "community_detail").exists() else ([], {})
    k_rows, k_info = concession_rows(out) if (out / "raw" / "concession").exists() else ([], {})
    info = {**c_info, **k_info}

    # keep one row per (kind, station, date); snapshot beats history
    best = {}
    for r in c_rows + k_rows:
        if not (start <= r["date"] <= end):
            continue
        key = (r["kind"], r["station_id"], r["date"])
        if key not in best or (r["source"] == "snapshot" and best[key]["source"] != "snapshot"):
            best[key] = r
    rows = sorted(best.values(), key=lambda r: (r["kind"], str(r["station_id"]), r["date"]))
    if not rows:
        print("No rows in that date range - run the download step first.")
        return 1

    flag_outliers(rows, args.min_wl, args.max_wl, args.spike_cm)

    # ---- long table ----
    with open(pdir / "daily_long.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=ROW_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({**r, "date": r["date"].isoformat()})

    # ---- station table (only stations that have rows in range) ----
    used = {(r["kind"], r["station_id"]) for r in rows}
    st_fields = ["kind", "station_id", "name", "company_code", "company_name",
                 "lon", "lat", "provinsi", "kabupaten", "kecamatan"]
    with open(pdir / "stations.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=st_fields)
        w.writeheader()
        for key in sorted(used, key=lambda k: (k[0], str(k[1]))):
            w.writerow({k: info.get(key, {}).get(k, "") for k in st_fields} |
                       {"kind": key[0], "station_id": key[1]})

    # ---- wide table: one row per station, one column per date (water level) ----
    all_days = list(daterange(start, end))
    wide = defaultdict(dict)
    for r in rows:
        if "range" not in r["flag"]:                   # leave range-flagged values out of the grid
            wide[(r["kind"], r["station_id"])][r["date"]] = r["water_level_cm"]
    with open(pdir / "water_level_wide.csv", "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow(["kind", "station_id"] + [d.isoformat() for d in all_days])
        for key in sorted(wide, key=lambda k: (k[0], str(k[1]))):
            w.writerow([key[0], key[1]] + ["" if wide[key].get(d) is None else wide[key][d]
                                           for d in all_days])

    # ---- QC report ----
    n_days = len(all_days)
    lines = [f"Range {start} .. {end}  ({n_days} days)", f"Rows: {len(rows)}"]
    for kind in ("community", "concession"):
        ks = [k for k in wide if k[0] == kind]
        if not ks:
            continue
        # Judge coverage only against days the source can actually provide:
        # community history is capped at 90 days, concession starts 2026-04-01.
        avail_from = (max(start, date.today() - timedelta(days=COMMUNITY_MAX_DAYS))
                      if kind == "community" else max(start, CONCESSION_EARLIEST))
        n_avail = max(1, (end - avail_from).days + 1)
        cover = [sum(v is not None for d, v in wide[k].items() if d >= avail_from) / n_avail
                 for k in ks]
        flags = defaultdict(int)
        for r in rows:
            if r["kind"] == kind:
                for fl in filter(None, r["flag"].split(";")):
                    flags[fl] += 1
        lines += [f"\n[{kind}] stations with data: {len(ks)} "
                  f"(coverage measured from {avail_from}, {n_avail} days)",
                  f"  mean coverage: {statistics.mean(cover):.0%}; "
                  f"stations under 50% coverage: {sum(c < .5 for c in cover)}",
                  f"  flags: {dict(flags) or 'none'}"]
    # dates with no concession file / no rows
    missing = [d.isoformat() for d in all_days if not (out / "raw" / "concession" / f"{d}.json.gz").exists()]
    if (out / "raw" / "concession").exists() and missing:
        lines.append(f"\nConcession days with no downloaded file ({len(missing)}): "
                     + ", ".join(missing[:10]) + (" ..." if len(missing) > 10 else ""))
    (pdir / "qc_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    print(f"\nWrote daily_long.csv, water_level_wide.csv, stations.csv, qc_report.txt in {pdir}")
    return 0


# ==========================================================================
# 5. CLI
# ==========================================================================
def main():
    ap = argparse.ArgumentParser(description="Extract SiTMAT TMAT data for a date range")
    ap.add_argument("command", choices=["download", "process", "all"])
    ap.add_argument("--out", default="sitmat_out")
    ap.add_argument("--start", help="first day YYYY-MM-DD (default: end - 60 days)")
    ap.add_argument("--end", help="last day YYYY-MM-DD (default: today)")
    ap.add_argument("--only", choices=["both", "community", "concession"], default="both")
    # throttling
    ap.add_argument("--delay", type=float, default=1.5, help="seconds between requests")
    ap.add_argument("--jitter", type=float, default=0.5, help="extra random 0..N seconds")
    ap.add_argument("--max-per-min", type=int, default=30, help="hard cap per minute")
    ap.add_argument("--max-requests", type=int, default=0, help="stop after N requests (0=no cap)")
    ap.add_argument("--limit", type=int, default=0, help="testing: only first N stations / last N days")
    # QC thresholds (cm)
    ap.add_argument("--min-wl", type=float, default=-500, help="water level below this = 'range' flag")
    ap.add_argument("--max-wl", type=float, default=100, help="water level above this = 'range' flag")
    ap.add_argument("--spike-cm", type=float, default=60, help="jump vs neighbours = 'spike' flag")
    args = ap.parse_args()

    args.end_d = date.fromisoformat(args.end) if args.end else date.today()
    args.start_d = date.fromisoformat(args.start) if args.start else args.end_d - timedelta(days=60)
    if args.start_d > args.end_d:
        sys.exit("--start must not be after --end")
    out = Path(args.out)

    code = 0
    if args.command in ("download", "all"):
        code = run_download(args, out)
    if args.command in ("process", "all") and code == 0:
        code = run_process(args, out)
    sys.exit(code)


if __name__ == "__main__":
    main()