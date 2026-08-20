/** NASA GIBS: resolving which day actually has imagery.
 *
 *  GIBS' RESTful WMTS accepts `default` in the time slot of the tile path, but
 *  for a daily product that resolves to *today* — and today's tiles do not
 *  exist until the day's granules have been processed. For the first hours of
 *  each UTC day the whole layer 404s:
 *
 *    GET .../MODIS_Aqua_Aerosol/default/default/.../4/8/13.png     404
 *    GET .../MODIS_Aqua_Aerosol/default/2026-08-19/.../4/8/13.png  200
 *
 *  So pin an explicit date rather than trusting `default`: probe backwards from
 *  today over the area of interest until a day answers, and use that day. One
 *  round of HEADs in the common case, and the layer degrades to "unavailable"
 *  rather than to a silent field of 404s if the product is genuinely down.
 *
 *  Deliberately store-free — the registry imports this module, and the store
 *  imports the registry. Status is reported through a callback that MapView
 *  wires to the store, the same way the BIG-backed layers work. */

import { GIBS_LAYERS, GIBS_WMTS } from "./config";

export interface GibsSpec {
  /** GIBS layer identifier, e.g. "MODIS_Aqua_Aerosol" */
  layer: string;
  /** tile matrix set, which also fixes the layer's maximum zoom */
  matrixSet: string;
  maxzoom: number;
  /** tile extension; GIBS serves png for the science products */
  ext: string;
}

/** Registry layers whose tiles are dated, for MapView's sync pass. */
export const GIBS_BACKED: { id: string; spec: GibsSpec }[] = [
  { id: "haze-aod", spec: GIBS_LAYERS.aod },
  { id: "haze-smoke", spec: GIBS_LAYERS.trueColor },
];

export function gibsTiles(spec: GibsSpec, date: string): string {
  return `${GIBS_WMTS}/${spec.layer}/default/${date}/${spec.matrixSet}/{z}/{y}/{x}.${spec.ext}`;
}

/** How many days back to look before calling the product unavailable. */
const MAX_LOOKBACK = 4;

function utcDay(offsetDays: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

/** The four z5 tiles that cover KALIMANTAN_BBOX, as [z, x, y].
 *
 *  Probing the area of interest rather than the globe is the whole point. GIBS
 *  404s per tile as well as per day, so a day whose only swath so far clipped
 *  the Philippines answers "yes" to a global probe and then renders nothing
 *  here — measured on 2026-08-20, when MODIS Aqua AOD had a global z0 tile but
 *  0 of 24 z6 tiles over Kalimantan. */
const PROBE_TILES: readonly (readonly [number, number, number])[] = [
  [5, 25, 15],
  [5, 26, 15],
  [5, 25, 16],
  [5, 26, 16],
];

/** True if any probe tile for `date` carries data. */
async function hasImagery(spec: GibsSpec, date: string): Promise<boolean> {
  const probes = PROBE_TILES.map(async ([z, x, y]) => {
    const url = `${GIBS_WMTS}/${spec.layer}/default/${date}/${spec.matrixSet}/${z}/${y}/${x}.${spec.ext}`;
    const res = await fetch(url, { method: "HEAD" });
    if (!res.ok) throw new Error(`${spec.layer} ${date} ${z}/${y}/${x}`);
    return true;
  });
  try {
    return await Promise.any(probes);
  } catch {
    return false; // every probe rejected: no data over Kalimantan that day
  }
}

const resolved = new Map<string, string>();
const started = new Set<string>();

/** The newest day with imagery, or null while that is still being resolved. */
export function gibsDate(spec: GibsSpec): string | null {
  return resolved.get(spec.layer) ?? null;
}

export type GibsStatus = (
  status: "checking" | "ok" | "unavailable",
  reason?: string,
) => void;

/** Start resolving `spec`'s newest day, once. `onStatus` fires on start and on
 *  settle; the settle call is also what re-runs the layer's `add()`, because it
 *  lands in the store and MapView re-applies on every store change. */
export function ensureGibsDate(spec: GibsSpec, onStatus: GibsStatus): void {
  if (started.has(spec.layer)) return;
  started.add(spec.layer);

  onStatus("checking", "finding latest imagery…");

  void (async () => {
    for (let back = 0; back < MAX_LOOKBACK; back++) {
      const date = utcDay(back);
      if (await hasImagery(spec, date)) {
        resolved.set(spec.layer, date);
        onStatus("ok");
        return;
      }
    }
    console.warn(
      `[agni] GIBS ${spec.layer}: no imagery in the last ${MAX_LOOKBACK} days`,
    );
    onStatus("unavailable", "no recent imagery");
    started.delete(spec.layer); // allow a retry on the next toggle
  })();
}
