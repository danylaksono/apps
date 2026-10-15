#!/usr/bin/env python3
"""
Prepare the spatial layers used by index.html.

Inputs
    assets/batas-khg-indonesia.geojson     KHG (peat hydrological unit) polygons, ~88 MB, too big for a browser
    assets/geo/src/ADM1.geojson, ADM2.geojson   geoBoundaries IDN provinces / regencies (simplified),
                                           fetched with --fetch-adm from geoBoundaries (CC BY 3.0 IGO)
    sitmat_out/processed/stations.csv

Outputs
    assets/geo/khg.geojson, adm1.geojson, adm2.geojson     simplified for the web
    sitmat_out/processed/stations_geo.csv                  station -> KHG / province / regency (spatial join)

Needs geopandas + shapely:  pip install geopandas
    python prepare_geo.py --fetch-adm
"""
import argparse
import json
import sys
import urllib.request
from pathlib import Path

import geopandas as gpd
import pandas as pd

ROOT = Path(__file__).parent
GEO = ROOT / "assets" / "geo"
SRC = GEO / "src"
KHG_SRC = ROOT / "assets" / "batas-khg-indonesia.geojson"
STATIONS = ROOT / "sitmat_out" / "processed" / "stations.csv"
API = "https://www.geoboundaries.org/api/current/gbOpen/IDN/{}/"

# geoBoundaries (2020) province names -> Indonesian, as used by SiTMAT
PROV_ID = {
    "Aceh": "Aceh", "Bali": "Bali", "Bangka-Belitung Islands": "Kepulauan Bangka Belitung", "Banten": "Banten",
    "Bengkulu": "Bengkulu", "Central Java": "Jawa Tengah", "Central Kalimantan": "Kalimantan Tengah",
    "Central Sulawesi": "Sulawesi Tengah", "East Java": "Jawa Timur", "East Kalimantan": "Kalimantan Timur",
    "East Nusa Tenggara": "Nusa Tenggara Timur", "Gorontalo": "Gorontalo", "Jakarta Special Capital Region": "DKI Jakarta",
    "Jambi": "Jambi", "Lampung": "Lampung", "Maluku": "Maluku", "North Kalimantan": "Kalimantan Utara",
    "North Maluku": "Maluku Utara", "North Sulawesi": "Sulawesi Utara", "North Sumatra": "Sumatera Utara", "Papua": "Papua",
    "Riau": "Riau", "Riau Islands": "Kepulauan Riau", "South Kalimantan": "Kalimantan Selatan", "South Sulawesi": "Sulawesi Selatan",
    "South Sumatra": "Sumatera Selatan", "Southeast Sulawesi": "Sulawesi Tenggara", "Special Region of Yogyakarta": "DI Yogyakarta",
    "West Java": "Jawa Barat", "West Kalimantan": "Kalimantan Barat", "West Nusa Tenggara": "Nusa Tenggara Barat",
    "West Papua": "Papua Barat", "West Sulawesi": "Sulawesi Barat", "West Sumatra": "Sumatera Barat",
}


def fetch_adm():
    SRC.mkdir(parents=True, exist_ok=True)
    for level in ("ADM1", "ADM2"):
        meta = json.load(urllib.request.urlopen(API.format(level)))
        print("fetching", level, meta["simplifiedGeometryGeoJSON"])
        urllib.request.urlretrieve(meta["simplifiedGeometryGeoJSON"], SRC / f"{level}.geojson")


def write(gdf, path, tol, prec=3):
    g = gdf.copy()
    g["geometry"] = g.geometry.simplify(tol, preserve_topology=True)
    g = g[~g.geometry.is_empty]
    g.to_file(path, driver="GeoJSON", COORDINATE_PRECISION=prec)
    print(f"{path.name}: {len(g)} features, {path.stat().st_size / 1e6:.2f} MB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch-adm", action="store_true", help="download geoBoundaries ADM1/ADM2 first")
    ap.add_argument("--khg-tol", type=float, default=0.001, help="KHG simplify tolerance, degrees (~110 m)")
    ap.add_argument("--max-km", type=float, default=5, help="station not inside any KHG: nearest KHG within this distance")
    args = ap.parse_args()
    if args.fetch_adm:
        fetch_adm()
    if not (SRC / "ADM1.geojson").exists():
        sys.exit("missing assets/geo/src/ADM1.geojson - run with --fetch-adm")

    GEO.mkdir(parents=True, exist_ok=True)
    a1 = gpd.read_file(SRC / "ADM1.geojson")[["shapeName", "geometry"]].rename(columns={"shapeName": "prov"})
    a1["prov"] = a1.prov.map(PROV_ID).fillna(a1.prov)
    a2 = gpd.read_file(SRC / "ADM2.geojson")[["shapeName", "geometry"]].rename(columns={"shapeName": "kab"})
    a2.insert(0, "adm2_id", range(len(a2)))
    a2["prov"] = gpd.sjoin(a2.assign(geometry=a2.geometry.representative_point()), a1, how="left", predicate="within")         .drop_duplicates("adm2_id").set_index("adm2_id").prov.reindex(a2.adm2_id).fillna("").values

    print("reading KHG (large)...")
    khg = gpd.read_file(KHG_SRC).rename(columns={"NAMA_KHG": "name", "Luas__HA": "area_ha"})
    khg["geometry"] = khg.geometry.make_valid()
    khg["name"] = khg.name.str.replace(r"^KHG\s+", "", regex=True)
    khg.insert(0, "khg_id", range(len(khg)))
    # main province / regency of each KHG = the one containing its representative point
    pts = khg.copy()
    pts["geometry"] = khg.geometry.representative_point()
    j1 = gpd.sjoin(pts, a1, how="left", predicate="within").drop_duplicates("khg_id")
    j2 = gpd.sjoin(pts, a2, how="left", predicate="within").drop_duplicates("khg_id")
    khg["prov"] = j1.set_index("khg_id").prov.reindex(khg.khg_id).fillna("").values
    khg["kab"] = j2.set_index("khg_id").kab.reindex(khg.khg_id).fillna("").values

    # stations -> KHG / province / regency
    st = pd.read_csv(STATIONS)
    ok = st.lon.between(94, 142) & st.lat.between(-12.5, 7) & ~((st.lon == 0) & (st.lat == 0))  # (0,0), lat==lon etc. are bad coordinates
    sg = gpd.GeoDataFrame(st[ok].copy(), geometry=gpd.points_from_xy(st[ok].lon, st[ok].lat), crs=4326)
    sg = sg.reset_index(names="_i")
    k = gpd.sjoin(sg, khg[["khg_id", "name", "geometry"]], how="left", predicate="within").drop_duplicates("_i")
    k = k.rename(columns={"name_right": "khg_name"}) if "name_right" in k else k.rename(columns={"name": "khg_name"})
    sg = sg.set_index("_i")
    sg["khg_id"] = k.set_index("_i").khg_id
    sg["khg_dist_km"] = 0.0
    miss = sg[sg.khg_id.isna()]
    if len(miss):
        # nearest KHG, measured in a metric CRS (UTM-ish equal-distance for Indonesia)
        m = miss.to_crs(3857)[["geometry"]]
        near = gpd.sjoin_nearest(m, khg.to_crs(3857)[["khg_id", "geometry"]], how="left", distance_col="d")
        near = near[~near.index.duplicated()]
        close = near[near.d / 1000 <= args.max_km]
        sg.loc[close.index, "khg_id"] = close.khg_id
        sg.loc[close.index, "khg_dist_km"] = (close.d / 1000).round(2)
    j1 = gpd.sjoin(sg[["geometry"]], a1, how="left", predicate="within")
    j2 = gpd.sjoin(sg[["geometry"]], a2[["adm2_id", "kab", "geometry"]], how="left", predicate="within")
    sg["adm1"] = j1[~j1.index.duplicated()].prov
    j2 = j2[~j2.index.duplicated()]
    sg["adm2"], sg["adm2_id"] = j2.kab, j2.adm2_id
    sg["khg_name"] = sg.khg_id.map(khg.set_index("khg_id").name)
    out = st[["kind", "station_id"]].copy()
    out["has_loc"] = ok.astype(int)
    out["khg_id"] = sg.khg_id.reindex(st.index).astype("Int64")
    out["khg_dist_km"] = sg.khg_dist_km.reindex(st.index)
    out["adm1"] = sg.adm1.reindex(st.index)
    out["khg_name"] = sg.khg_name.reindex(st.index)
    out["adm2"] = sg.adm2.reindex(st.index)
    out["adm2_id"] = sg.adm2_id.reindex(st.index).astype("Int64")
    out.to_csv(ROOT / "sitmat_out" / "processed" / "stations_geo.csv", index=False)
    print(f"stations_geo.csv: {len(out)} rows; with KHG {out.khg_id.notna().sum()}, "
          f"outside KHG but within {args.max_km} km: {(out.khg_dist_km > 0).sum()}, with province {out.adm1.notna().sum()}")

    write(khg[["khg_id", "name", "area_ha", "prov", "kab", "geometry"]], GEO / "khg.geojson", args.khg_tol)
    write(a1, GEO / "adm1.geojson", 0.01)
    write(a2[["adm2_id", "kab", "prov", "geometry"]], GEO / "adm2.geojson", 0.01)


if __name__ == "__main__":
    main()
