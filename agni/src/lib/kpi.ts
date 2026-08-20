/** KPI computation (turf.js).
 *
 *  Everything here is computed from data already in the browser. Anything we
 *  cannot compute honestly is not shown at all — a permanent "—" card is worse
 *  than no card, because it reads as "zero" rather than "not measured".
 *
 *  The fire set reaching this module is already clipped to Indonesia (see
 *  firms.ts), so these counts describe the country rather than a bounding box. */

import type { Feature, FeatureCollection, Point } from "geojson";
import { indexPolygons, polygonAt, type PolyFC } from "./geo";

/** BPS province codes for the five Kalimantan provinces. The peat KPI is
 *  scoped to these — see `peatFires` below. */
const KALIMANTAN_PROV = new Set(["61", "62", "63", "64", "65"]);

export interface Kpi {
  fires: number | null;
  frpMw: number | null;
  affectedKabKota: number | null;
  /** fire detections falling on mapped peat soil (BIG layer 6) */
  peatFires: number | null;
  /** detections inside Kalimantan — the honest denominator for `peatFires`,
   *  because BIG publishes no peat outside it */
  kalimantanFires: number | null;
}

function firePoints(fires: FeatureCollection): Feature<Point>[] {
  return fires.features.filter(
    (f): f is Feature<Point> => f.geometry?.type === "Point",
  );
}

/** Distinct kab/kota with at least one detection, and how many of those
 *  detections fall in Kalimantan. Both come from the same spatial join, which
 *  is the expensive part — ~10k points against 514 polygons. */
export function summariseByKabKota(
  fires: FeatureCollection,
  kab: PolyFC,
): { affected: number; kalimantan: number } {
  const index = indexPolygons(kab);
  const found = new Set<string>();
  let kalimantan = 0;
  for (const pt of firePoints(fires)) {
    const hit = polygonAt(pt, index);
    if (!hit) continue;
    found.add(String(hit.properties?.code ?? ""));
    const prov = String(hit.properties?.provinsi_code ?? "").padStart(2, "0");
    if (KALIMANTAN_PROV.has(prov)) kalimantan += 1;
  }
  return { affected: found.size, kalimantan };
}

/** Fire detections falling on mapped peat soil. */
export function countPeatFires(fires: FeatureCollection, peat: PolyFC): number {
  const index = indexPolygons(peat);
  let n = 0;
  for (const pt of firePoints(fires)) {
    if (polygonAt(pt, index)) n += 1;
  }
  return n;
}

export function computeKpi(
  fires: FeatureCollection | null,
  kab: PolyFC | null,
  peat: PolyFC | null,
): Kpi {
  if (!fires) {
    return {
      fires: null,
      frpMw: null,
      affectedKabKota: null,
      peatFires: null,
      kalimantanFires: null,
    };
  }
  const frp = fires.features.reduce(
    (sum, f) => sum + (Number(f.properties?.frp) || 0),
    0,
  );
  const admin = kab ? summariseByKabKota(fires, kab) : null;
  return {
    fires: fires.features.length,
    frpMw: Math.round(frp),
    affectedKabKota: admin ? admin.affected : null,
    peatFires: peat ? countPeatFires(fires, peat) : null,
    kalimantanFires: admin ? admin.kalimantan : null,
  };
}
