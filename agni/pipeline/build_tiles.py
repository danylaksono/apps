"""Agni data pipeline — stage national (Indonesia) data for the app.

Reads local source data (outside this repo), reprojects where needed, and
writes staging files to pipeline/out/ plus two analysis-ready artefacts into
public/data/:

  - kabkota_indonesia.geojson  the clip + KPI polygons (514 kab/kota)
  - population_h3.parquet      Kontur H3 population, geometry-free

Population is deliberately *not* tiled. Nationally it is 874,919 hexagons,
which comes to ~113 MB as PMTiles — over GitHub's 100 MB per-file limit. As a
geometry-free Parquet queried through DuckDB-WASM it is an order of magnitude
smaller, and it gives the dashboard a real query engine to build KPIs on. The
hexagons are rebuilt in the browser from their H3 index (see src/lib/population.ts).

Tiling of the boundaries is done by pipeline/tile.py. See METHODOLOGY.md.

Usage:  python pipeline/build_tiles.py
"""

from pathlib import Path

import duckdb
import geopandas as gpd
import pandas as pd
import pyogrio

SRC = Path(r"D:\personal\github\reach-ops\local-data")
OUT = Path(__file__).parent / "out"
PUBLIC = Path(__file__).parent.parent / "public" / "data"

# H3 resolutions precomputed as parent columns. The map picks one from the zoom
# level; res 8 is what Kontur publishes, so it is the `h3` column itself.
PARENT_RES = (7, 6, 5)

# Enough to keep the clip honest at the coastline (a VIIRS pixel is 375 m)
# while cutting the file to a size worth shipping.
SIMPLIFY_DEG = 0.008
COORD_PRECISION = 5  # ~1 m; the default writes full float noise


def load_boundaries() -> gpd.GeoDataFrame:
    """Stack provinsi/kab_kota/kecamatan into one GDF with a `level` column."""
    frames = []
    for level in ("provinsi", "kab_kota", "kecamatan"):
        gdf = gpd.read_file(SRC / "geo" / f"{level}.geojson")
        gdf["level"] = level
        frames.append(gdf)
    return gpd.GeoDataFrame(pd.concat(frames, ignore_index=True), crs="EPSG:4326")


def stage_boundaries() -> gpd.GeoDataFrame:
    """Write the MVT staging file and the shipped kab/kota GeoJSON.

    Returns the *unsimplified* kab/kota frame, which the population join uses —
    the simplification below is only for what the browser downloads.
    """
    allb = load_boundaries()
    print(f"boundaries: {len(allb)} features (Indonesia)")

    # one combined staging GeoJSON; MVT gets 1 tile layer ("boundaries")
    # with a `level` property that map styles filter on
    allb.to_file(OUT / "boundaries.geojson", driver="GeoJSON")
    for level, n in allb["level"].value_counts().items():
        print(f"  staged {level}: {n} features")

    kab = allb[allb["level"] == "kab_kota"].drop(columns=["level"]).copy()

    # Shipped copy: clips the fire layer to Indonesian land and backs the
    # "kabupaten affected" KPI. Kab/kota rather than kecamatan because 514
    # polygons keep the point-in-polygon pass over ~10k detections cheap, and
    # the file a tenth the size of the 7,275 kecamatan.
    small = kab.copy()
    small["geometry"] = small.geometry.simplify(SIMPLIFY_DEG, preserve_topology=True)
    dest = PUBLIC / "kabkota_indonesia.geojson"
    if dest.exists():
        dest.unlink()
    pyogrio.write_dataframe(
        small, str(dest), driver="GeoJSON", COORDINATE_PRECISION=COORD_PRECISION
    )
    size = dest.stat().st_size / (1024 * 1024)
    print(f"  wrote public/data/kabkota_indonesia.geojson ({len(small)} features, {size:.1f} MB)")

    return kab


def build_population_parquet(kab: gpd.GeoDataFrame) -> None:
    """Kontur H3 population -> Parquet with parent cells and admin codes.

    Geometry never reaches the output: the browser rebuilds each hexagon from
    its H3 index with h3-js. The parent columns are precomputed here because
    DuckDB's h3 extension is not available in duckdb-wasm, and the admin codes
    are precomputed so that population per province or per fire-affected
    kabupaten is a single GROUP BY rather than a spatial join at runtime.
    """
    src = SRC / "kontur_population_ID.gpkg"
    # Arrow rather than a DataFrame: pandas 3 types the h3 column with its new
    # `str` dtype, which DuckDB's register() rejects outright.
    _, table = pyogrio.read_arrow(src, layer="population", read_geometry=False)
    print(f"population: {table.num_rows} hexagons (Indonesia)")

    con = duckdb.connect()
    con.execute("INSTALL h3 FROM community")
    con.execute("LOAD h3")
    con.register("kontur", table)

    parents = ",\n           ".join(
        f"h3_h3_to_string(h3_cell_to_parent(h3_string_to_h3(h3), {r})) AS h3_r{r}"
        for r in PARENT_RES
    )
    cells = con.execute(
        f"""
        SELECT h3,
               population,
               {parents},
               h3_cell_to_lat(h3_string_to_h3(h3)) AS lat,
               h3_cell_to_lng(h3_string_to_h3(h3)) AS lon
        FROM kontur
        """
    ).df()
    print(f"  derived parent cells for res {PARENT_RES}")

    # admin join on hexagon centroids, against the full-resolution polygons
    pts = gpd.GeoDataFrame(
        cells,
        geometry=gpd.points_from_xy(cells["lon"], cells["lat"]),
        crs="EPSG:4326",
    )
    joined = pts.sjoin(
        kab[["code", "provinsi_code", "geometry"]], how="left", predicate="within"
    )
    joined = joined.rename(columns={"code": "kab_kota_code"})
    matched = joined["kab_kota_code"].notna().sum()
    print(f"  admin join: {matched}/{len(joined)} hexagons inside a kab/kota")

    out = pd.DataFrame(
        {
            "h3": joined["h3"],
            "population": joined["population"].astype("float64"),
            # No centroid columns: they cost 6.5 MB (float32 coordinates are
            # near-incompressible) to answer a question the H3 hierarchy
            # already answers. The map filters a viewport by listing its res-5
            # cells and matching h3_r5 — see queryPopulation in
            # src/lib/population.ts.
            **{f"h3_r{r}": joined[f"h3_r{r}"] for r in PARENT_RES},
            "kab_kota_code": joined["kab_kota_code"].astype("string"),
            "provinsi_code": joined["provinsi_code"].astype("string"),
        }
    ).drop_duplicates(subset="h3")

    dest = PUBLIC / "population_h3.parquet"
    if dest.exists():
        dest.unlink()
    out.to_parquet(dest, compression="zstd", index=False)
    size = dest.stat().st_size / (1024 * 1024)
    print(
        f"  wrote public/data/population_h3.parquet "
        f"({len(out)} rows, {size:.1f} MB, total pop {out['population'].sum():,.0f})"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    kab = stage_boundaries()
    build_population_parquet(kab)

    print("\nNext: python pipeline/tile.py to produce PMTiles in public/data/")


if __name__ == "__main__":
    main()
