"""Hazer data pipeline — stage Kalimantan subsets for PMTiles tiling.

Reads local source data (outside this repo), filters to Kalimantan,
reprojects where needed, and writes staging files to pipeline/out/ plus
an analysis-ready kecamatan GeoJSON into public/data/.

Tiling to PMTiles is done by pipeline/tile.py (pyogrio -> MBTiles ->
pmtiles.convert). See METHODOLOGY.md.

Usage:  python pipeline/build_tiles.py
"""

from pathlib import Path

import geopandas as gpd
import pyogrio
from pyproj import Transformer

SRC = Path(r"D:\personal\github\reach-ops\local-data")
OUT = Path(__file__).parent / "out"
PUBLIC = Path(__file__).parent.parent / "public" / "data"

KALIMANTAN_PROV_CODES = {"61", "62", "63", "64", "65"}
# generous Kalimantan bbox in EPSG:4326
BBOX_4326 = (108.8, -4.8, 119.6, 7.6)


def prov_code_norm(value) -> str:
    """'61' / 61 / '61.0' -> '61'"""
    return str(value).split(".")[0].strip().zfill(2)


def load_boundaries() -> gpd.GeoDataFrame:
    """Stack provinsi/kab_kota/kecamatan into one GDF with a `level` column."""
    frames = []
    for level in ("provinsi", "kab_kota", "kecamatan"):
        gdf = gpd.read_file(SRC / "geo" / f"{level}.geojson")
        gdf["level"] = level
        frames.append(gdf)
    return gpd.GeoDataFrame(
        __import__("pandas").concat(frames, ignore_index=True), crs="EPSG:4326"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    # --- boundaries -------------------------------------------------------
    allb = load_boundaries()
    mask = allb.apply(
        lambda r: prov_code_norm(r["provinsi_code"] if r["level"] != "provinsi" else r["code"])
        in KALIMANTAN_PROV_CODES,
        axis=1,
    )
    kal = allb[mask].copy()
    print(f"boundaries: {len(allb)} -> {len(kal)} (Kalimantan)")

    # one combined staging GeoJSON; MVT gets 1 tile layer ("boundaries")
    # with a `level` property that map styles filter on
    kal.to_file(OUT / "boundaries.geojson", driver="GeoJSON")
    for level, n in kal["level"].value_counts().items():
        print(f"  staged {level}: {n} features")

    # simplified kecamatan copy for client-side KPI spatial joins
    kec = kal[kal["level"] == "kecamatan"].drop(columns=["level"]).copy()
    kec["geometry"] = kec.geometry.simplify(0.005, preserve_topology=True)
    kec.to_file(PUBLIC / "kecamatan_kalimantan.geojson", driver="GeoJSON")
    print(f"  wrote public/data/kecamatan_kalimantan.geojson ({len(kec)} features)")

    # --- population (Kontur H3, EPSG:3857 -> 4326) -------------------------
    transformer = Transformer.from_crs("EPSG:4326", "EPSG:3857", always_xy=True)
    minx, miny = transformer.transform(BBOX_4326[0], BBOX_4326[1])
    maxx, maxy = transformer.transform(BBOX_4326[2], BBOX_4326[3])
    pop = pyogrio.read_dataframe(
        SRC / "kontur_population_ID.gpkg",
        layer="population",
        bbox=(minx, miny, maxx, maxy),
    )
    print(f"population: {len(pop)} hexagons in Kalimantan bbox")
    pop = pop.to_crs("EPSG:4326")
    pop["population"] = pop["population"].round().astype("int64")
    # NOTE: file named population.geojson so the MVT tile layer is "population"
    pop.to_file(OUT / "population.geojson", driver="GeoJSON")
    print("  wrote pipeline/out/population.geojson")

    print("\nNext: run pipeline/tile.sh via WSL to produce PMTiles in public/data/")


if __name__ == "__main__":
    main()
