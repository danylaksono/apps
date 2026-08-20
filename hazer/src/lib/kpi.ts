/** KPI computation (turf.js).
 *
 *  Everything here is computed from data already in the browser. Anything we
 *  cannot compute honestly is not shown at all — a permanent "—" card is worse
 *  than no card, because it reads as "zero" rather than "not measured". */

import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import bbox from "@turf/bbox";
import type {
  Feature,
  FeatureCollection,
  Point,
  Polygon,
  MultiPolygon,
} from "geojson";
import { KECAMATAN_GEOJSON_URL } from "./config";

export interface Kpi {
  fires: number | null;
  frpMw: number | null;
  affectedKecamatan: number | null;
  /** fire detections falling on mapped peat soil (BIG layer 6) */
  peatFires: number | null;
}

type PolyFC = FeatureCollection<Polygon | MultiPolygon>;
type PolyFeature = Feature<Polygon | MultiPolygon, { code?: string }>;

let kecCache: Promise<PolyFC> | null = null;

export function loadKecamatan(): Promise<PolyFC> {
  if (!kecCache) {
    kecCache = fetch(KECAMATAN_GEOJSON_URL).then((r) => {
      if (!r.ok) throw new Error(`kecamatan ${r.status}`);
      return r.json();
    });
  }
  return kecCache;
}

/** Pre-computed bbox index — the polygon sets here are small (101–7k) and the
 *  fire sets are a few thousand points, so a bbox reject before the exact
 *  point-in-polygon test is enough to keep this well under a frame. */
function indexed(polys: PolyFC) {
  return polys.features.map((f) => ({ f, b: bbox(f) }));
}

function hitsAny(
  pt: Feature<Point>,
  index: ReturnType<typeof indexed>,
): PolyFeature | null {
  const [lon, lat] = pt.geometry.coordinates;
  for (const { f, b } of index) {
    if (lon < b[0] || lat < b[1] || lon > b[2] || lat > b[3]) continue;
    if (booleanPointInPolygon(pt, f as PolyFeature)) return f as PolyFeature;
  }
  return null;
}

function firePoints(fires: FeatureCollection): Feature<Point>[] {
  return fires.features.filter(
    (f): f is Feature<Point> => f.geometry?.type === "Point",
  );
}

export function countAffectedKecamatan(
  fires: FeatureCollection,
  kec: PolyFC,
): number {
  const index = indexed(kec);
  const found = new Set<string>();
  for (const pt of firePoints(fires)) {
    const hit = hitsAny(pt, index);
    if (hit) found.add(String(hit.properties?.code ?? ""));
  }
  return found.size;
}

/** Fire detections falling on mapped peat soil. */
export function countPeatFires(fires: FeatureCollection, peat: PolyFC): number {
  const index = indexed(peat);
  let n = 0;
  for (const pt of firePoints(fires)) {
    if (hitsAny(pt, index)) n += 1;
  }
  return n;
}

export function computeKpi(
  fires: FeatureCollection | null,
  kec: PolyFC | null,
  peat: PolyFC | null,
): Kpi {
  if (!fires) {
    return {
      fires: null,
      frpMw: null,
      affectedKecamatan: null,
      peatFires: null,
    };
  }
  const frp = fires.features.reduce(
    (sum, f) => sum + (Number(f.properties?.frp) || 0),
    0,
  );
  return {
    fires: fires.features.length,
    frpMw: Math.round(frp),
    affectedKecamatan: kec ? countAffectedKecamatan(fires, kec) : null,
    peatFires: peat ? countPeatFires(fires, peat) : null,
  };
}
