/** Derived series for the dashboard charts.
 *
 *  Everything here is computed from data already in the browser, and every
 *  number a chart shows has to be defensible — see the exposure note below for
 *  the one that needs its definition printed on the chart.
 *
 *  Province and kabupaten attribution comes from the kab/kota polygon join that
 *  clipToIndonesia performs once, *not* from the population Parquet. Kontur only
 *  stores populated hexagons, so joining detections to it by H3 leaves ~70%
 *  unattributed — forest and peat fires are by definition where nobody lives —
 *  and ranks Java top because that is where the populated cells are. The
 *  polygon join attributes 97.7%. */

import type { FeatureCollection } from "geojson";

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

/** Rank provinces and kabupaten by detections.
 *
 *  Reads the `provinsi` / `kabkota` tags that clipToIndonesia already wrote, so
 *  this is a counting pass rather than a spatial join — it runs on every filter
 *  change and must not touch geometry. */
export function rollupByArea(fires: FeatureCollection): AreaRollup {
  const prov = new Map<string, AreaCount>();
  const kk = new Map<string, AreaCount>();
  let unattributed = 0;

  for (const f of fires.features) {
    const province = String(f.properties?.provinsi ?? "");
    const name = String(f.properties?.kabkota ?? "");
    if (!province || !name) {
      unattributed += 1;
      continue;
    }
    const frp = Number(f.properties?.frp) || 0;

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
  /** clicking a ranked bar scopes everything to that area */
  area: { level: "provinsi" | "kabkota"; name: string } | null;
  /** clicking a column in the trend pins that UTC day, replacing `hours` */
  day: string | null;
  /** clicking a forest-status bar scopes to that class. "" is a real value —
   *  outside the gazetted estate — so null, not "", means "no scope".
   *  Only settable once the fires carry a `kawasan` tag; see lib/forest.ts. */
  forest: string | null;
  /** FIRMS confidence classes to keep: l | n | h */
  confidence: string[];
  /** D, N, or both */
  daynight: string[];
  /** minimum fire radiative power, MW */
  minFrp: number;
}

export const DEFAULT_FILTERS: FireFilters = {
  hours: 24,
  area: null,
  day: null,
  forest: null,
  confidence: ["n", "h"],
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
  const expr: unknown[] = [
    "all",
    [">=", ["get", "frp"], f.minFrp],
    ["in", ["get", "confidence"], ["literal", f.confidence]],
    ["in", ["get", "daynight"], ["literal", f.daynight]],
  ];
  // A pinned day and a rolling window answer the same question two ways, so
  // only one is ever in force.
  if (f.day) expr.push(["==", ["get", "acq_date"], f.day]);
  else expr.push([">=", ["get", "ts"], latest - f.hours * 3600_000]);
  if (f.area) expr.push(["==", ["get", f.area.level], f.area.name]);
  // `["get"]` on an untagged feature yields null, not "", so an unmatched
  // detection is excluded rather than counted as outside the estate.
  if (f.forest !== null) {
    expr.push(["==", ["coalesce", ["get", "kawasan"], "?"], f.forest]);
  }
  return expr;
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
      const inWindow = f.day
        ? String(p.acq_date) === f.day
        : (Number(p.ts) || 0) >= since;
      return (
        inWindow &&
        (Number(p.frp) || 0) >= f.minFrp &&
        f.confidence.includes(String(p.confidence)) &&
        f.daynight.includes(String(p.daynight)) &&
        (!f.area || String(p[f.area.level] ?? "") === f.area.name) &&
        (f.forest === null || String(p.kawasan ?? "?") === f.forest)
      );
    }),
  };
}
