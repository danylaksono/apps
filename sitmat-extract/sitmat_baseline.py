#!/usr/bin/env python3
"""
SiTMAT baseline builder
=======================

Takes the output of sitmat_tmat_extract.py (the `processed/` folder) and builds
an analysis-ready baseline of water level (TMAT, cm relative to the ground surface):

    1. clean      drop rows with no water level, drop 'range' outliers
                  (optionally 'spike' too)
    2. select     keep only stations with enough data (min valid days and
                  min coverage of the analysis window), so the baseline is
                  not distorted by stations that appear or vanish part-way
    3. summarise  per-station statistics, per-station-per-month statistics,
                  and a per-month overview of each source

Water-level classes follow the SiTMAT map legend (cm):
    Tergenang      > 0
    Normal         -40 < x <= 0
    Rawan          -80 < x <= -40
    Sangat Rawan   <= -80

Needs: pandas  (pip install pandas)

Usage
-----
    python sitmat_baseline.py
    python sitmat_baseline.py --in sitmat_out/processed --out baseline_out
    python sitmat_baseline.py --start 2026-04-01 --end 2026-10-13 \
        --min-days-community 30 --min-coverage-concession 0.8 --drop-spikes
"""

import argparse
from pathlib import Path

import pandas as pd

# Water-level classes from the SiTMAT legend: (column name, lower bound exclusive, upper inclusive)
CLASSES = [
    ("pct_tergenang", 0, float("inf")),
    ("pct_normal", -40, 0),
    ("pct_rawan", -80, -40),
    ("pct_sangat_rawan", float("-inf"), -80),
]


# --------------------------------------------------------------------------
# 1. Load + clean
# --------------------------------------------------------------------------
def load_clean(in_dir, start, end, drop_spikes):
    """Read daily_long.csv and return (clean_rows, cleaning_counts)."""
    df = pd.read_csv(in_dir / "daily_long.csv", parse_dates=["date"])
    df["flag"] = df["flag"].fillna("")
    counts = {"rows_in_file": len(df)}

    df = df[(df["date"] >= start) & (df["date"] <= end)]
    counts["rows_in_date_range"] = len(df)

    df = df[df["water_level_cm"].notna()]              # no value = nothing to analyse
    counts["rows_with_water_level"] = len(df)

    is_range = df["flag"].str.contains("range")        # impossible values (e.g. 814572 cm)
    counts["dropped_range"] = int(is_range.sum())
    df = df[~is_range]

    if drop_spikes:                                    # optional: sudden jumps vs neighbours
        is_spike = df["flag"].str.contains("spike")
        counts["dropped_spike"] = int(is_spike.sum())
        df = df[~is_spike]
    else:
        counts["dropped_spike"] = 0                    # spikes kept (still flagged in the file)

    counts["rows_clean"] = len(df)
    return df, counts


# --------------------------------------------------------------------------
# 2. Station selection
# --------------------------------------------------------------------------
def select_stations(df, start, end, args):
    """
    Decide which stations are good enough for the baseline.
    Returns (kept_station_table, dropped_station_table_with_reason).

    Coverage is measured against the days the source can actually provide:
      * community   : history is capped at 90 days -> window starts later
      * concession  : snapshots only exist from 2026-04-01
    """
    avail_from = {
        "community": max(start, pd.Timestamp.today().normalize() - pd.Timedelta(days=90)),
        "concession": max(start, pd.Timestamp("2026-04-01")),
    }
    stats = (df.groupby(["kind", "station_id"])
               .agg(n_days=("date", "nunique"), first=("date", "min"), last=("date", "max"))
               .reset_index())

    def window_days(kind):
        return max(1, (end - avail_from[kind]).days + 1)

    stats["window_days"] = stats["kind"].map(window_days)
    stats["coverage"] = (stats["n_days"] / stats["window_days"]).clip(upper=1.0)

    min_days = {"community": args.min_days_community, "concession": args.min_days_concession}
    min_cov = {"community": args.min_coverage_community, "concession": args.min_coverage_concession}

    def reason(row):
        r = []
        if row["n_days"] < min_days[row["kind"]]:
            r.append(f"fewer than {min_days[row['kind']]} valid days")
        if row["coverage"] < min_cov[row["kind"]]:
            r.append(f"coverage below {min_cov[row['kind']]:.0%}")
        return "; ".join(r)

    stats["drop_reason"] = stats.apply(reason, axis=1)
    kept = stats[stats["drop_reason"] == ""].drop(columns="drop_reason")
    dropped = stats[stats["drop_reason"] != ""]
    return kept, dropped


# --------------------------------------------------------------------------
# 3. Summaries
# --------------------------------------------------------------------------
def class_shares(s):
    """Share of days (0-1) in each legend class for a Series of water levels."""
    out = {}
    for name, lo, hi in CLASSES:
        out[name] = ((s > lo) & (s <= hi)).mean()
    return pd.Series(out)


def station_summary(df, kept, stations_csv):
    """One row per station: location, coverage, and distribution of water level."""
    g = df.groupby(["kind", "station_id"])["water_level_cm"]
    s = g.agg(mean="mean", median="median", std="std", min="min", max="max",
              p10=lambda x: x.quantile(.10), p25=lambda x: x.quantile(.25),
              p75=lambda x: x.quantile(.75), p90=lambda x: x.quantile(.90)).reset_index()
    shares = g.apply(class_shares).unstack().reset_index()
    out = kept.merge(s, on=["kind", "station_id"]).merge(shares, on=["kind", "station_id"])
    if stations_csv.exists():                          # add name / company / coordinates
        meta = pd.read_csv(stations_csv)
        out = out.merge(meta, on=["kind", "station_id"], how="left")
    num_cols = out.select_dtypes("number").columns     # round numbers only (not dates)
    out[num_cols] = out[num_cols].round(3)
    return out


def station_monthly(df):
    """Per station, per calendar month: n days, mean, median, min, max."""
    d = df.assign(month=df["date"].dt.to_period("M").astype(str))
    return (d.groupby(["kind", "station_id", "month"])["water_level_cm"]
              .agg(n_days="count", mean="mean", median="median", min="min", max="max")
              .reset_index().round(3))


def monthly_overview(monthly):
    """
    Per source and month: how many stations contributed, and the spread of
    their monthly medians. Because the baseline only uses stations selected in
    step 2, the number of stations should be about constant across months.
    """
    return (monthly.groupby(["kind", "month"])["median"]
                   .agg(n_stations="count", median_of_medians="median",
                        p10=lambda x: x.quantile(.10), p90=lambda x: x.quantile(.90))
                   .reset_index().round(2))


# --------------------------------------------------------------------------
# 4. Main
# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="Build a water-level baseline from SiTMAT extract output")
    ap.add_argument("--in", dest="in_dir", default="sitmat_out/processed",
                    help="folder holding daily_long.csv (output of the extractor)")
    ap.add_argument("--out", default="baseline_out", help="output folder")
    ap.add_argument("--start", default="2026-04-01", help="analysis window start YYYY-MM-DD")
    ap.add_argument("--end", default=None, help="analysis window end (default: last date in file)")
    ap.add_argument("--drop-spikes", action="store_true",
                    help="also drop rows flagged 'spike' (default: keep them)")
    # selection thresholds: a station must pass BOTH its days and coverage rule
    ap.add_argument("--min-days-community", type=int, default=30)
    ap.add_argument("--min-days-concession", type=int, default=60)
    ap.add_argument("--min-coverage-community", type=float, default=0.5,
                    help="fraction of the 90-day window that must have data")
    ap.add_argument("--min-coverage-concession", type=float, default=0.8,
                    help="fraction of the window since 2026-04-01 that must have data")
    args = ap.parse_args()

    in_dir, out = Path(args.in_dir), Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    start = pd.Timestamp(args.start)

    # peek at the last date if --end not given
    raw_dates = pd.read_csv(in_dir / "daily_long.csv", usecols=["date"], parse_dates=["date"])["date"]
    end = pd.Timestamp(args.end) if args.end else raw_dates.max()

    df, counts = load_clean(in_dir, start, end, args.drop_spikes)
    kept, dropped = select_stations(df, start, end, args)

    # keep only the rows of selected stations
    key = ["kind", "station_id"]
    base = df.merge(kept[key], on=key, how="inner").sort_values(key + ["date"])

    summ = station_summary(base, kept, in_dir / "stations.csv")
    monthly = station_monthly(base)
    overview = monthly_overview(monthly)

    base.drop(columns=["flag"]).to_csv(out / "baseline_daily.csv", index=False, date_format="%Y-%m-%d")
    summ.to_csv(out / "station_summary.csv", index=False, date_format="%Y-%m-%d")
    monthly.to_csv(out / "station_monthly.csv", index=False)
    overview.to_csv(out / "monthly_overview.csv", index=False)
    dropped.to_csv(out / "dropped_stations.csv", index=False, date_format="%Y-%m-%d")

    # ---- plain-text report ----
    lines = [f"Window: {start.date()} .. {end.date()}",
             "", "Row cleaning:"] + [f"  {k}: {v}" for k, v in counts.items()]
    for kind in ("community", "concession"):
        k_all = pd.concat([kept, dropped]).query("kind == @kind")
        if k_all.empty:
            continue
        lines += ["", f"[{kind}] stations with any valid data: {len(k_all)}",
                  f"  kept: {int((kept.kind == kind).sum())}   dropped: {int((dropped.kind == kind).sum())}"]
        reasons = dropped[dropped.kind == kind]["drop_reason"].value_counts()
        for r, n in reasons.items():
            lines.append(f"    dropped ({r}): {n}")
        s = summ[summ.kind == kind]
        if len(s):
            lines.append(f"  median of station medians: {s['median'].median():.1f} cm; "
                         f"share of station-days in Sangat Rawan: {s['pct_sangat_rawan'].mean():.0%}")
    lines += ["", "Files: baseline_daily.csv, station_summary.csv, station_monthly.csv, "
                  "monthly_overview.csv, dropped_stations.csv"]
    (out / "baseline_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
