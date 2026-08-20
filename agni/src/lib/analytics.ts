/** Derived series for the dashboard charts.
 *
 *  Everything here is computed from data already in the browser, and every
 *  number a chart shows has to be defensible — see the exposure note below for
 *  the one that needs its definition printed on the chart.
 *
 *  Province and kabupaten attribution comes from the kab/kota polygon join,
 *  *not* from the population Parquet. Kontur only stores populated hexagons, so
 *  joining detections to it by H3 leaves ~70% of them unattributed — forest and
 *  peat fires are by definition where nobody lives — and ranks Java top because
 *  that is where the populated cells are. The polygon join attributes 97.7%. */

import type { Feature, FeatureCollection, Point } from "geojson";
import { indexPolygons, polygonAt, type PolyFC, type PolyIndex } from "./geo";

export interface DayCount {
  /** UTC day, "YYYY-MM-DD" */
  date: string;
  detections: number;
  frpMw: number;
}

export interface AreaCount {
  name: string;
  province: string;
  detections: number;
  frpMw: number;
}

function firePoints(fires: FeatureCollection): Feature<Point>[] {
  return fires.features.filter(
    (f): f is Feature<Point> => f.geometry?.type === "Point",
  );
}

/** Detections and total FRP per UTC day, oldest first. */
export function dailyTrend(fires: FeatureCollection): DayCount[] {
  const byDay = new Map<string, DayCount>();
  for (const f of fires.features) {
    const date = String(f.properties?.acq_date ?? "");
    if (!date) continue;
    const row = byDay.get(date) ?? { date, detections: 0, frpMw: 0 };
    row.detections += 1;
    row.frpMw += Number(f.properties?.frp) || 0;
    byDay.set(date, row);
  }
  return [...byDay.values()]
    .map((d) => ({ ...d, frpMw: Math.round(d.frpMw) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface AreaRollup {
  provinces: AreaCount[];
  kabkota: AreaCount[];
  /** detections that fell outside every polygon (offshore, or just past the
   *  simplified coastline) — reported so the chart can admit what it omits */
  unattributed: number;
}

/** Rank provinces and kabupaten by detections. One pass over the same spatial
 *  join the KPI bar already needs, so this is not a second traversal. */
export function rollupByArea(
  fires: FeatureCollection,
  kab: PolyFC,
  index?: PolyIndex,
): AreaRollup {
  const idx = index ?? indexPolygons(kab);
  const prov = new Map<string, AreaCount>();
  const kk = new Map<string, AreaCount>();
  let unattributed = 0;

  for (const pt of firePoints(fires)) {
    const hit = polygonAt(pt, idx);
    if (!hit) {
      unattributed += 1;
      continue;
    }
    const props = hit.properties as {
      name?: string;
      provinsi_name?: string;
    } | null;
    const province = String(props?.provinsi_name ?? "—");
    const name = String(props?.name ?? "—");
    const frp = Number(pt.properties?.frp) || 0;

    const p = prov.get(province) ?? {
      name: province,
      province,
      detections: 0,
      frpMw: 0,
    };
    p.detections += 1;
    p.frpMw += frp;
    prov.set(province, p);

    const key = `${province}/${name}`;
    const k = kk.get(key) ?? { name, province, detections: 0, frpMw: 0 };
    k.detections += 1;
    k.frpMw += frp;
    kk.set(key, k);
  }

  const finish = (m: Map<string, AreaCount>) =>
    [...m.values()]
      .map((a) => ({ ...a, frpMw: Math.round(a.frpMw) }))
      .sort((a, b) => b.detections - a.detections);

  return { provinces: finish(prov), kabkota: finish(kk), unattributed };
}

/** Filters applied to the fire set before anything is drawn or counted. */
export interface FireFilters {
  /** hours back from the newest detection */
  hours: number;
  /** FIRMS confidence classes to keep: l | n | h */
  confidence: string[];
  /** D, N, or both */
  daynight: string[];
  /** minimum fire radiative power, MW */
  minFrp: number;
}

export const DEFAULT_FILTERS: FireFilters = {
  hours: 24,
  confidence: ["l", "n", "h"],
  daynight: ["D", "N"],
  minFrp: 0,
};

/** The newest detection timestamp, which anchors the time filter.
 *
 *  Anchored to the data rather than to `Date.now()`: FIRMS lags by a few hours,
 *  so "last 24 h" measured from now would silently drop most of a pass. */
export function latestTimestamp(fires: FeatureCollection): number {
  let max = 0;
  for (const f of fires.features) {
    const ts = Number(f.properties?.ts) || 0;
    if (ts > max) max = ts;
  }
  return max;
}

/** MapLibre filter expression matching `applyFireFilters`, so the map and the
 *  charts can never disagree about which detections are in scope. */
export function fireFilterExpression(
  f: FireFilters,
  latest: number,
): unknown[] {
  return [
    "all",
    [">=", ["get", "ts"], latest - f.hours * 3600_000],
    [">=", ["get", "frp"], f.minFrp],
    ["in", ["get", "confidence"], ["literal", f.confidence]],
    ["in", ["get", "daynight"], ["literal", f.daynight]],
  ];
}

export function applyFireFilters(
  fires: FeatureCollection,
  f: FireFilters,
  latest: number,
): FeatureCollection {
  const since = latest - f.hours * 3600_000;
  return {
    type: "FeatureCollection",
    features: fires.features.filter((x) => {
      const p = x.properties ?? {};
      return (
        (Number(p.ts) || 0) >= since &&
        (Number(p.frp) || 0) >= f.minFrp &&
        f.confidence.includes(String(p.confidence)) &&
        f.daynight.includes(String(p.daynight))
      );
    }),
  };
}
