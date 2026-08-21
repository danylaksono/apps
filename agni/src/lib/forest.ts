/** Forest estate status: decoding KLHK's `fungsitap`, and tagging fires with it.
 *
 *  "Di dalam atau di luar kawasan hutan?" is the first question asked of any
 *  Indonesian fire season, because it decides who is answerable — KLHK inside
 *  the forest estate, the regency outside it. This module is what lets the app
 *  answer it: the gazetted estate arrives as polygons (BIG SatuPeta, KEHUTANAN
 *  layer 0), every detection is tagged with the class it falls in, and the
 *  charts then count tags rather than re-running a spatial join.
 *
 *  ## The `fungsitap` codes
 *
 *  BIG publishes the class as a bare KUGI code with no lookup table on the
 *  service — the layer's renderer is a single flat symbol and `namobj` is "-"
 *  on all 4,487 rows. The mapping below was derived from the data instead, by
 *  reading the `nkws` (kawasan name) prefixes each code carries and checking
 *  the resulting areas against KLHK's published statistics. Measured Aug 2026:
 *
 *    100100  24.9 M ha  "HL ...", "KELOMPOK HUTAN ..."   hutan lindung
 *    100300  21.5 M ha  "HP ..."                         produksi tetap
 *    100400  20.9 M ha  "HPT ..."                        produksi terbatas
 *    100240  11.5 M ha  "TN ..."                         taman nasional
 *    100500   5.1 M ha  "HPK ..."                        produksi konversi
 *    100220   4.6 M ha  "SM ...", "SA ..."               suaka margasatwa
 *    100210   3.8 M ha  "CA ..."                         cagar alam
 *    100241   3.6 M ha  "TNL ...", "TN/TNL ..."          taman nasional laut
 *    100250 / 100251    "TWA ...", "TWAL ..."            taman wisata alam
 *    100230             "TB ...", "TAMAN BURU ..."       taman buru
 *    100260             "TAHURA ..."                     taman hutan raya
 *    100200             mixed CA/SM/TWA                  KSA/KPA, unsplit
 *
 *  Totals line up with the ministry's own figures (HL ~29.6, HPT ~26, HP ~29,
 *  TN ~16 M ha designated) at the gap you would expect between designated and
 *  gazetted land, which is the check that makes the mapping trustworthy.
 *
 *  Codes outside that set — 100000, 1007300 and the 5xxxxx pair — are 0.34 M ha
 *  across 170 polygons in total, so they go to `lainnya` rather than being
 *  guessed at.
 *
 *  ## What the layer is not
 *
 *  Penetapan is gazettement, the final step of forest-estate demarcation, so
 *  this is the *settled* estate: 97.5 M ha against the ~125 M ha designated.
 *  Land that is designated but not yet gazetted therefore counts as "di luar
 *  kawasan" here when it is not. Read the outside-the-estate bar as an upper
 *  bound, and see Docs/METHODOLOGY.md. */

import type { FeatureCollection, Feature, Point } from "geojson";
import {
  gridIndexPolygons,
  polygonAtGrid,
  type PolyFC,
  type PolyGrid,
} from "./geo";

export type ForestClass =
  | "konservasi"
  | "lindung"
  | "hpt"
  | "hp"
  | "hpk"
  | "lainnya";

/** Feature property written onto each detection. Empty string = outside the
 *  gazetted estate, which is a finding rather than a missing value. */
export const FOREST_PROP = "kawasan";

export interface ForestClassMeta {
  key: ForestClass;
  /** Indonesian, because these are legal categories with no English equivalent
   *  that anyone working on this would recognise. */
  label: string;
  short: string;
  color: string;
}

/** Fixed order: the legal hierarchy, strictest protection first. Deliberately
 *  not re-ranked by count the way the province chart is — there are only seven
 *  categories and a stable order is what makes two filter states comparable. */
export const FOREST_CLASSES: ForestClassMeta[] = [
  {
    key: "konservasi",
    label: "Konservasi",
    short: "KSA/KPA",
    color: "#34d399",
  },
  { key: "lindung", label: "Hutan lindung", short: "HL", color: "#2dd4bf" },
  {
    key: "hpt",
    label: "Produksi terbatas",
    short: "HPT",
    color: "#84cc16",
  },
  { key: "hp", label: "Produksi tetap", short: "HP", color: "#a3e635" },
  { key: "hpk", label: "Produksi konversi", short: "HPK", color: "#facc15" },
  { key: "lainnya", label: "Kawasan hutan lain", short: "lain", color: "#64748b" },
];

const CLASS_BY_CODE = new Map<string, ForestClass>([
  ["100100", "lindung"],
  ["100200", "konservasi"],
  ["100210", "konservasi"],
  ["100211", "konservasi"],
  ["100220", "konservasi"],
  ["100221", "konservasi"],
  ["100230", "konservasi"],
  ["100240", "konservasi"],
  ["100241", "konservasi"],
  ["100250", "konservasi"],
  ["100251", "konservasi"],
  ["100260", "konservasi"],
  ["100300", "hp"],
  ["100400", "hpt"],
  ["100500", "hpk"],
]);

export function forestClassOf(fungsitap: unknown): ForestClass {
  return CLASS_BY_CODE.get(String(fungsitap ?? "")) ?? "lainnya";
}

const META_BY_KEY = new Map(FOREST_CLASSES.map((c) => [c.key, c]));

export function forestClassMeta(key: string): ForestClassMeta | null {
  return META_BY_KEY.get(key as ForestClass) ?? null;
}

/** MapLibre `match` expression colouring the estate by its class. Built from
 *  the same table the chart reads, so legend, map and bars cannot drift. */
export function forestFillColor(): unknown[] {
  const expr: unknown[] = ["match", ["get", "fungsitap"]];
  for (const [code, key] of CLASS_BY_CODE) {
    expr.push(code, META_BY_KEY.get(key)!.color);
  }
  expr.push(META_BY_KEY.get("lainnya")!.color);
  return expr;
}

// --------------------------------------------------------------- tagging ---

/** Fire sets already tagged, so re-running is free and cannot loop.
 *
 *  Keyed on the `features` array rather than the FeatureCollection: tagging
 *  writes into the existing feature objects and then republishes them under a
 *  new wrapper object, which is what makes the map re-push the source and every
 *  memo recompute. The array survives that, the wrapper does not. */
const tagged = new WeakSet<object>();

/** Write the forest class of each detection onto its properties.
 *
 *  Returns false when there was nothing to do. Mutating in place matches how
 *  `clipToIndonesia` already attaches `provinsi`/`kabkota`, and for the same
 *  reason: it turns every later question into a counting pass instead of a
 *  spatial join re-run on every filter change. */
export function tagFiresWithForest(
  fires: FeatureCollection,
  estate: PolyFC,
): boolean {
  if (tagged.has(fires.features)) return false;
  const grid: PolyGrid = gridIndexPolygons(estate);
  for (const f of fires.features) {
    if (f.geometry?.type !== "Point") continue;
    const hit = polygonAtGrid(f as Feature<Point>, grid);
    f.properties ??= {};
    f.properties[FOREST_PROP] = hit ? forestClassOf(hit.properties?.fungsitap) : "";
  }
  tagged.add(fires.features);
  return true;
}

export function firesAreTagged(fires: FeatureCollection | null): boolean {
  return Boolean(fires && tagged.has(fires.features));
}

// -------------------------------------------------------------- rollups ---

export interface ForestCount {
  /** class key, or "" for outside the gazetted estate */
  key: string;
  label: string;
  color: string;
  detections: number;
  frpMw: number;
}

export interface ForestRollup {
  rows: ForestCount[];
  inside: number;
  outside: number;
}

/** Detections per forest class, in the fixed order above with "di luar" last.
 *  A counting pass over already-tagged features — no geometry is touched. */
export function rollupByForest(fires: FeatureCollection): ForestRollup {
  const counts = new Map<string, { n: number; frp: number }>();
  for (const f of fires.features) {
    const key = String(f.properties?.[FOREST_PROP] ?? "");
    const row = counts.get(key) ?? { n: 0, frp: 0 };
    row.n += 1;
    row.frp += Number(f.properties?.frp) || 0;
    counts.set(key, row);
  }

  const rows: ForestCount[] = [];
  let inside = 0;
  for (const c of FOREST_CLASSES) {
    const hit = counts.get(c.key);
    if (!hit) continue;
    inside += hit.n;
    rows.push({
      key: c.key,
      label: c.label,
      color: c.color,
      detections: hit.n,
      frpMw: Math.round(hit.frp),
    });
  }
  const out = counts.get("");
  if (out) {
    rows.push({
      key: "",
      label: "Di luar kawasan",
      color: "#94a3b8",
      detections: out.n,
      frpMw: Math.round(out.frp),
    });
  }
  return { rows, inside, outside: out?.n ?? 0 };
}
