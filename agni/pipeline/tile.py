"""Tile staged GeoJSON (pipeline/out) into PMTiles (public/data).

GDAL's MVT driver can't write PMTiles directly, so we go via MBTiles
(pyogrio/GDAL) and convert with the `pmtiles` Python package.

Usage:  python pipeline/tile.py
"""

from pathlib import Path

import geopandas as gpd
import pyogrio
from pmtiles.convert import mbtiles_to_pmtiles

OUT = Path(__file__).parent / "out"
PUBLIC = Path(__file__).parent.parent / "public" / "data"

# (staging file, pmtiles name, minzoom, maxzoom)
#
# Population is no longer tiled — nationally it is ~113 MB as PMTiles, past
# GitHub's per-file limit. It ships as public/data/population_h3.parquet and is
# queried through DuckDB-WASM instead; see pipeline/build_tiles.py.
JOBS = [
    ("boundaries.geojson", "boundaries", 2, 12),
]


def tile(src: str, name: str, minzoom: int, maxzoom: int) -> None:
    mbt = OUT / f"{name}.mbtiles"
    pmt = PUBLIC / f"{name}.pmtiles"
    for p in (mbt, pmt):
        if p.exists():
            p.unlink()
    gdf = gpd.read_file(OUT / src)
    pyogrio.write_dataframe(
        gdf,
        str(mbt),
        driver="MVT",
        FORMAT="MBTILES",
        MINZOOM=minzoom,
        MAXZOOM=maxzoom,
    )
    mbtiles_to_pmtiles(str(mbt), str(pmt), maxzoom)
    size = pmt.stat().st_size / (1024 * 1024)
    print(f"{name}.pmtiles: {size:.1f} MB")


def main() -> None:
    for src, name, minz, maxz in JOBS:
        tile(src, name, minz, maxz)


if __name__ == "__main__":
    main()
