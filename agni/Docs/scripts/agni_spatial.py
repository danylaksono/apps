"""Shared spatial helpers for Agni's offline investigations.

Three things live here, because every analysis script needs all three:

  1. Esri ArcGIS JSON geometry  ->  shapely            (`esri_to_shapely`)
  2. Equal-area measurement of lat/lon polygons        (`equal_area`)
  3. Hansen/UMD tree-cover-loss year raster sampling   (`LossGrid`)

Why not GeoJSON for (1): BIG SatuPeta's `f=geojson` output emits malformed
MultiPolygon coordinate arrays (nulls inside rings) that shapely refuses. The
Esri `f=json` `rings` format is well-formed, so we ask for that and convert it
ourselves. Esri encodes ring winding as orientation: clockwise (negative signed
area in x/y order) is an outer ring, counter-clockwise is a hole.

Why not a proper raster library for (3): the Hansen loss layer is not published
as a GeoTIFF you can window-read. GFW serves it as *encoded PNG tiles* — the
loss year is packed into the blue channel — and the browser app decodes them in
`src/lib/gfwRaster.ts`. This module does the same decode in Python so the map
and the analysis agree by construction.

Dependencies: shapely>=2, pyproj, numpy, pillow.
"""

from __future__ import annotations

import math
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Iterable, Sequence

import numpy as np
import pyproj
from PIL import Image, ImageDraw
from shapely.geometry import Polygon
from shapely.ops import transform, unary_union

# --------------------------------------------------------------- geometry ---


def _signed_area(ring: Sequence[Sequence[float]]) -> float:
    """Shoelace area. Negative == clockwise == Esri outer ring."""
    total = 0.0
    for i in range(len(ring) - 1):
        total += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    return total / 2


def esri_to_shapely(geometry: dict):
    """Convert an Esri `{"rings": [...]}` geometry to a shapely (Multi)Polygon.

    Holes are matched to whichever outer ring contains them, rather than assumed
    to follow their parent in the ring list — BIG does not guarantee that order.
    `.buffer(0)` repairs the self-intersections that survive server-side
    simplification (`maxAllowableOffset`).
    """
    rings = geometry["rings"]
    outers = [r for r in rings if _signed_area(r) <= 0]
    holes = [r for r in rings if _signed_area(r) > 0]

    polys = []
    for outer in outers:
        shell = Polygon(outer).buffer(0)
        mine = [
            h
            for h in holes
            if Polygon(h).buffer(0).representative_point().within(shell)
        ]
        polys.append(Polygon(outer, mine).buffer(0))
    return unary_union(polys)


def shapely_to_rings(geom) -> list[list[list[float]]]:
    """Convert a shapely (Multi)Polygon back to Esri ring lists.

    Needed whenever a polygon has been clipped or buffered and then has to go
    back through `LossGrid.rasterise`, which reads Esri's orientation convention.
    Shapely does not guarantee winding, so each ring is reoriented explicitly:
    outer rings clockwise (negative signed area), holes counter-clockwise.
    """
    polys = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    rings: list[list[list[float]]] = []
    for poly in polys:
        if poly.is_empty:
            continue
        for ring, want_outer in [(poly.exterior, True)] + [(r, False) for r in poly.interiors]:
            coords = [list(c[:2]) for c in ring.coords]
            is_outer = _signed_area(coords) <= 0
            if is_outer != want_outer:
                coords.reverse()
            rings.append(coords)
    return rings


def equal_area(lon0: float, lat0: float):
    """Return (to_metres, from_metres) transformer functions.

    Lambert azimuthal equal-area centred on the area of interest. Areas computed
    in this projection are accurate to well under 1% over a few hundred km, which
    is the scale of a single concession or a cluster of neighbours. Web Mercator
    would inflate area by ~cos(lat)^-2 and is unusable for hectares.
    """
    crs = f"+proj=laea +lat_0={lat0} +lon_0={lon0} +units=m +datum=WGS84"
    fwd = pyproj.Transformer.from_crs("EPSG:4326", crs, always_xy=True)
    rev = pyproj.Transformer.from_crs(crs, "EPSG:4326", always_xy=True)
    return fwd.transform, rev.transform


def area_ha(geom, to_metres) -> float:
    """Area of a lat/lon geometry in hectares, via an equal-area projection."""
    return transform(to_metres, geom).area / 1e4


# ------------------------------------------------------------ tile mathmatics ---
# Standard slippy-map (Web Mercator) tile grid. GFW serves 512 px tiles.

ZOOM = 12
TILE_PX = 512
N_TILES = 2**ZOOM
WORLD_PX = N_TILES * TILE_PX
EARTH_CIRCUMFERENCE = 2 * math.pi * 6378137.0


def lon_to_px(lon: float) -> float:
    return (lon + 180) / 360 * WORLD_PX


def lat_to_px(lat: float) -> float:
    s = min(max(math.sin(math.radians(lat)), -0.9999), 0.9999)
    return (0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)) * WORLD_PX


def px_to_lon(px: float) -> float:
    return px / WORLD_PX * 360 - 180


def px_to_lat(py: float) -> float:
    n = math.pi - 2 * math.pi * py / WORLD_PX
    return math.degrees(math.atan(math.sinh(n)))


def row_pixel_area_m2(tile_y: int) -> np.ndarray:
    """Ground area of one pixel, per raster row, for the tile at `tile_y`.

    Mercator pixels shrink away from the equator by cos(latitude), so a single
    scalar pixel area would bias hectare totals. Returned as a (TILE_PX, TILE_PX)
    array so it can be masked alongside the data.
    """
    lats = np.array(
        [px_to_lat(tile_y * TILE_PX + i + 0.5) for i in range(TILE_PX)]
    )
    metres_per_px = (EARTH_CIRCUMFERENCE / WORLD_PX) * np.cos(np.radians(lats))
    return (metres_per_px**2)[:, None] * np.ones((1, TILE_PX))


# ------------------------------------------------------ Hansen loss raster ---

LOSS_VERSION = "v1.13"
LOSS_TILE_URL = (
    "https://tiles.globalforestwatch.org/umd_tree_cover_loss/"
    "{version}/tcd_30/{z}/{x}/{y}.png"
)


class LossGrid:
    """UMD/Hansen tree-cover-loss year, decoded from GFW's encoded PNG tiles.

    Encoding (same as `src/lib/gfwRaster.ts`):
        R = tree cover density at time of loss   G = unused
        B = loss year - 2000 (1..25)             A = 255 where loss, else 0

    Tiles are cached to disk; an empty file marks a 404 (GFW returns 404 for
    tiles with no data, which is most of them at this zoom). At z12 with 512 px
    tiles a pixel is ~19 m at the equator — finer than Hansen's native 30 m, so
    we oversample rather than drop small clearings.
    """

    def __init__(self, cache_dir: str, west, south, east, north, workers=8):
        self.dir = os.path.join(cache_dir, "hansen")
        os.makedirs(self.dir, exist_ok=True)
        self.x0, self.x1 = int(lon_to_px(west) // TILE_PX), int(lon_to_px(east) // TILE_PX)
        self.y0, self.y1 = int(lat_to_px(north) // TILE_PX), int(lat_to_px(south) // TILE_PX)
        self._cache: dict[tuple[int, int], np.ndarray] = {}

        coords = list(self.tiles())
        with ThreadPoolExecutor(workers) as pool:
            list(pool.map(self._download, coords))
        self.n_tiles = len(coords)

    def tiles(self) -> Iterable[tuple[int, int]]:
        for x in range(self.x0, self.x1 + 1):
            for y in range(self.y0, self.y1 + 1):
                yield x, y

    def _path(self, x: int, y: int) -> str:
        return os.path.join(self.dir, f"{ZOOM}_{x}_{y}.png")

    def _download(self, xy: tuple[int, int]) -> None:
        x, y = xy
        path = self._path(x, y)
        if os.path.exists(path):
            return
        url = LOSS_TILE_URL.format(version=LOSS_VERSION, z=ZOOM, x=x, y=y)
        try:
            with urllib.request.urlopen(url, timeout=90) as res:
                body = res.read()
        except Exception:
            body = b""  # 404 or transient failure -> empty tile, no loss data
        with open(path, "wb") as fh:
            fh.write(body)

    def tile(self, x: int, y: int) -> np.ndarray:
        """Loss-year array for one tile: 0 = no loss, 1..25 = 2001..2025."""
        key = (x, y)
        if key in self._cache:
            return self._cache[key]

        arr = np.zeros((TILE_PX, TILE_PX), np.uint8)
        path = self._path(x, y)
        if os.path.exists(path) and os.path.getsize(path) > 0:
            try:
                img = np.array(Image.open(path).convert("RGBA"))
                years = img[:, :, 2].astype(np.uint8)
                # Drop transparent pixels and any out-of-range blue value.
                years[(img[:, :, 3] == 0) | (years >= 30)] = 0
                arr = years
            except Exception:
                pass
        self._cache[key] = arr
        return arr

    def tile_bounds(self, x: int, y: int) -> tuple[float, float, float, float]:
        return (
            px_to_lon(x * TILE_PX),
            px_to_lat((y + 1) * TILE_PX),
            px_to_lon((x + 1) * TILE_PX),
            px_to_lat(y * TILE_PX),
        )

    def window(self, lon: float, lat: float, radius_px: int) -> np.ndarray:
        """Loss-year values in a square window around a point.

        Used to ask "what happened to the canopy near this fire detection?".
        radius_px=10 is roughly +-190 m, i.e. about half a VIIRS pixel.
        """
        gx, gy = lon_to_px(lon), lat_to_px(lat)
        xs = (int(gx - radius_px), int(gx + radius_px))
        ys = (int(gy - radius_px), int(gy + radius_px))

        chunks = []
        for tx in range(xs[0] // TILE_PX, xs[1] // TILE_PX + 1):
            for ty in range(ys[0] // TILE_PX, ys[1] // TILE_PX + 1):
                arr = self.tile(tx, ty)
                lx0 = max(0, xs[0] - tx * TILE_PX)
                lx1 = min(TILE_PX, xs[1] + 1 - tx * TILE_PX)
                ly0 = max(0, ys[0] - ty * TILE_PX)
                ly1 = min(TILE_PX, ys[1] + 1 - ty * TILE_PX)
                if lx1 <= lx0 or ly1 <= ly0:
                    continue
                chunks.append(arr[ly0:ly1, lx0:lx1].ravel())
        return np.concatenate(chunks) if chunks else np.zeros(0, np.uint8)

    def rasterise(self, rings: Sequence, x: int, y: int) -> np.ndarray:
        """Boolean mask of an Esri ring set over one tile.

        PIL's polygon fill is used rather than a point-in-polygon test per pixel:
        262,144 shapely `contains` calls per tile would take minutes, this takes
        milliseconds. Holes are drawn back to 0 after the outers are filled.
        """
        img = Image.new("L", (TILE_PX, TILE_PX), 0)
        draw = ImageDraw.Draw(img)
        for ring in rings:
            fill = 0 if _signed_area(ring) > 0 else 1
            draw.polygon(
                [
                    (lon_to_px(p[0]) - x * TILE_PX, lat_to_px(p[1]) - y * TILE_PX)
                    for p in ring
                ],
                fill=fill,
            )
        return np.array(img).astype(bool)

    def loss_by_year(self, rings: Sequence) -> tuple[np.ndarray, float]:
        """Hectares of canopy loss per year inside an Esri ring set.

        Returns (loss[0..29] in ha indexed by year-2000, total polygon ha).
        The total is measured from the same raster mask, so it can be compared
        against the vector area as a sanity check — they agree to ~1%, which is
        the rasterisation error at 19 m.
        """
        loss = np.zeros(30)
        total_ha = 0.0
        xs = [p[0] for r in rings for p in r]
        ys = [p[1] for r in rings for p in r]
        x0, x1 = int(lon_to_px(min(xs)) // TILE_PX), int(lon_to_px(max(xs)) // TILE_PX)
        y0, y1 = int(lat_to_px(max(ys)) // TILE_PX), int(lat_to_px(min(ys)) // TILE_PX)

        for x in range(x0, x1 + 1):
            for y in range(y0, y1 + 1):
                mask = self.rasterise(rings, x, y)
                if not mask.any():
                    continue
                px_area = row_pixel_area_m2(y)
                total_ha += px_area[mask].sum() / 1e4
                arr = self.tile(x, y)
                sel = mask & (arr > 0)
                if not sel.any():
                    continue
                years, areas = arr[sel], px_area[sel]
                for yr in np.unique(years):
                    loss[int(yr)] += areas[years == yr].sum() / 1e4
        return loss, total_ha
