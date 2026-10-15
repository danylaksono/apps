"""Quick sanity checks on sitmat_out/processed/daily_long.csv (needs pandas)."""
import sys, pandas as pd
p = sys.argv[1] if len(sys.argv) > 1 else "sitmat_out/processed/daily_long.csv"
df = pd.read_csv(p, parse_dates=["date"])

# 1. Rows with a usable water level, per source type
print("rows with water level:\n", df.groupby("kind")["water_level_cm"].apply(lambda s: s.notna().mean()).round(2), "\n")

# 2. Community: how many valid days does each station have? (max possible ~90)
c = df[(df.kind == "community") & df.water_level_cm.notna()]
print("community valid days per station:\n", c.groupby("station_id").size().describe().round(1), "\n")

# 3. Concession: number of points present per date (should be fairly stable)
k = df[(df.kind == "concession") & (df.source == "snapshot")]
per_day = k.groupby("date").station_id.nunique()
print("concession points per date: min", per_day.min(), "median", int(per_day.median()), "max", per_day.max())
print(per_day.resample("MS").median().astype(int).to_string(), "\n")

# 4. Are IDs stable? Points seen on only a few days may be re-keyed duplicates.
days = k.groupby("station_id").date.nunique()
print("concession points seen on <=3 days:", int((days <= 3).sum()), "of", len(days))

# 5. Value ranges and flags
print(df.groupby("kind").water_level_cm.describe().round(1))
print(df[df.flag.notna()].groupby(["kind", "flag"]).size())
