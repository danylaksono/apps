/** KPI computation (turf.js).
 *
 *  Everything here is computed from data already in the browser. Anything we
 *  cannot compute honestly is not shown at all — a permanent "—" card is worse
 *  than no card, because it reads as "zero" rather than "not measured".
 *
 *  The fire set reaching this module is already clipped to Kalimantan (see
 *  firms.ts), so these counts describe Kalimantan rather than a bounding box. */

import type { Feature, FeatureCollection, Point } from "geojson";
import { indexPolygons, polygonAt, type PolyFC, type PolyIndex } from "./geo";

export interface Kpi {
  fires: number | null;
  frpMw: number | null;
  affectedKecamatan: number | null;
  /** fire detections falling on mapped peat soil (BIG layer 6) */
  peatFires: number | null;
}

function firePoints(fires: FeatureCollection): Feature<Point>[] {
  return fires.features.filter(
    (f): f is Feature<Point> => f.geometry?.type === "Point",
  );
}

function countHits(fires: FeatureCollection, index: PolyIndex): number {
  let n = 0;
  for (const pt of firePoints(fires)) {
    if (polygonAt(pt, index)) n += 1;
  }
  return n;
}

export function countAffectedKecamatan(
  fires: FeatureCollection,
  kec: PolyFC,
): number {
  const index = indexPolygons(kec);
  const found = new Set<string>();
  for (const pt of firePoints(fires)) {
    const hit = polygonAt(pt, index);
    if (hit) found.add(String(hit.properties?.code ?? ""));
  }
  return found.size;
}

/** Fire detections falling on mapped peat soil. */
export function countPeatFires(fires: FeatureCollection, peat: PolyFC): number {
  return countHits(fires, indexPolygons(peat));
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
