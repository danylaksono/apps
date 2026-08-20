/** Shared polygon lookups over point sets.
 *
 *  The polygon sets here are small (100–20,000 features) and the point sets a
 *  few thousand, so a bbox reject in front of the exact point-in-polygon test
 *  is enough to keep a full pass well under a frame. */

import bbox from "@turf/bbox";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import type {
  Feature,
  FeatureCollection,
  MultiPolygon,
  Point,
  Polygon,
  Position,
} from "geojson";
import { KABKOTA_GEOJSON_URL } from "./config";

export type PolyFC = FeatureCollection<Polygon | MultiPolygon>;
export type PolyFeature = Feature<
  Polygon | MultiPolygon,
  { code?: string; provinsi_code?: string }
>;

interface Indexed {
  f: PolyFeature;
  /** [west, south, east, north] */
  b: [number, number, number, number];
}

export type PolyIndex = Indexed[];

export function indexPolygons(polys: PolyFC): PolyIndex {
  return polys.features.map((f) => {
    const [w, s, e, n] = bbox(f);
    return { f: f as PolyFeature, b: [w, s, e, n] as Indexed["b"] };
  });
}

/** The first polygon containing the point, or null. */
export function polygonAt(pt: Feature<Point>, index: PolyIndex): PolyFeature | null {
  const [lon, lat] = pt.geometry.coordinates;
  for (const { f, b } of index) {
    if (lon < b[0] || lat < b[1] || lon > b[2] || lat > b[3]) continue;
    if (booleanPointInPolygon(pt, f)) return f;
  }
  return null;
}

const EARTH_RADIUS_M = 6_371_008.8;
const DEG_TO_M = (Math.PI / 180) * EARTH_RADIUS_M;

function ringsOf(f: PolyFeature): Position[][] {
  const g = f.geometry;
  return g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
}

/** Metres from a point to a segment, on a local equirectangular projection.
 *  Exact enough at the few-kilometre scale this is used at. */
function segmentDistanceM(
  lon: number,
  lat: number,
  a: Position,
  b: Position,
  cosLat: number,
): number {
  const ax = (a[0] - lon) * cosLat;
  const ay = a[1] - lat;
  const bx = (b[0] - lon) * cosLat;
  const by = b[1] - lat;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy) * DEG_TO_M;
}

/** True if the point lies within `meters` of any polygon edge in the index.
 *  Only meant for the handful of points that failed `polygonAt` — it walks
 *  every vertex of every nearby polygon. */
export function nearPolygon(
  lon: number,
  lat: number,
  index: PolyIndex,
  meters: number,
): boolean {
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1e-6;
  const padDeg = meters / DEG_TO_M / cosLat;
  for (const { f, b } of index) {
    if (
      lon < b[0] - padDeg ||
      lat < b[1] - padDeg ||
      lon > b[2] + padDeg ||
      lat > b[3] + padDeg
    ) {
      continue;
    }
    for (const ring of ringsOf(f)) {
      for (let i = 1; i < ring.length; i++) {
        if (segmentDistanceM(lon, lat, ring[i - 1], ring[i], cosLat) <= meters) {
          return true;
        }
      }
    }
  }
  return false;
}

let kabCache: Promise<PolyFC> | null = null;

/** Indonesian regency/city polygons (514), shipped with the app. Used both as
 *  the KPI's spatial join and as the clip that keeps neighbouring countries out
 *  of the fire layer — see `clipToIndonesia` in firms.ts.
 *
 *  Kab/kota rather than kecamatan: the 7,275 sub-districts are a 13 MB
 *  download and 14x the point-in-polygon work, for a national count too fine
 *  to read. */
export function loadKabKota(): Promise<PolyFC> {
  if (!kabCache) {
    kabCache = fetch(KABKOTA_GEOJSON_URL).then((r) => {
      if (!r.ok) throw new Error(`kab/kota ${r.status}`);
      return r.json();
    });
    kabCache.catch(() => {
      kabCache = null; // let a failed load be retried
    });
  }
  return kabCache;
}
