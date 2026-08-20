/** CAMS values at a point, via WMS GetFeatureInfo.
 *
 *  The haze layers are rendered images, but the same WMS will also *report* the
 *  number behind a pixel. That turns the map's smoke plume into a chart: click
 *  anywhere and read the PM2.5 and smoke-AOD forecast for that spot.
 *
 *    GET .../wms?request=GetFeatureInfo&info_format=application/json&...
 *    -> { "Probes": [ { "Value": { "Unit": "µg / m3", "Data": 651.079 } } ] }
 *
 *  One request per time step — the server rejects an ISO interval in `time`,
 *  and a comma-separated list silently returns only the first step. At eight in
 *  flight a 24-step series comes back in ~2 s, so a full forecast is a few
 *  seconds. Results are cached per (layer, lon, lat, time) because scrubbing
 *  the timeline asks for the same points repeatedly. */

import { CAMS_WMS } from "./config";

/** Probe requests in flight at once, across *all* layers being probed.
 *
 *  Browsers cap concurrent connections to one host at around six, so running
 *  eight per layer just queues them inside the browser while looking like
 *  sixteen here. One shared queue at the real limit keeps the ordering below
 *  meaningful — otherwise the near-term steps we want first sit behind a
 *  backlog the queue no longer controls. */
const CONCURRENCY = 6;

/** Half-width of the tiny bbox built around the point. CAMS is a ~0.4 degree
 *  grid and the server snaps to the nearest grid point regardless, so this only
 *  has to be big enough to be a valid request. */
const PROBE_HALF_DEG = 0.5;

function toMercator(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (20037508.34 / 180);
  return [x, y];
}

function probeUrl(
  layer: string,
  lon: number,
  lat: number,
  time: string,
): string {
  const [minX, minY] = toMercator(lon - PROBE_HALF_DEG, lat - PROBE_HALF_DEG);
  const [maxX, maxY] = toMercator(lon + PROBE_HALF_DEG, lat + PROBE_HALF_DEG);
  const size = 101; // odd, so the centre pixel is exactly the point
  const params = new URLSearchParams({
    token: "public",
    service: "WMS",
    version: "1.3.0",
    request: "GetFeatureInfo",
    layers: layer,
    query_layers: layer,
    styles: "",
    crs: "EPSG:3857",
    bbox: `${minX},${minY},${maxX},${maxY}`,
    width: String(size),
    height: String(size),
    i: String((size - 1) / 2),
    j: String((size - 1) / 2),
    info_format: "application/json",
    time,
  });
  return `${CAMS_WMS}?${params}`;
}

const cache = new Map<string, Promise<number | null>>();

/** One value, or null if the server had nothing for that step. */
export function probeCams(
  layer: string,
  lon: number,
  lat: number,
  time: string,
): Promise<number | null> {
  const key = `${layer}|${lon.toFixed(3)}|${lat.toFixed(3)}|${time}`;
  let task = cache.get(key);
  if (!task) {
    task = fetch(probeUrl(layer, lon, lat, time))
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${r.status}`))))
      .then((text) => {
        // The response is JSON but not always well-formed enough to trust
        // JSON.parse on — pull the numeric payload out directly.
        const m = /"Data"\s*:\s*([-\d.eE]+)/.exec(text);
        return m ? Number(m[1]) : null;
      })
      .catch(() => null);
    cache.set(key, task);
  }
  return task;
}

export interface ProbePoint {
  time: string;
  value: number | null;
}

export type ProbeSeries = Record<string, ProbePoint[]>;

/** Visit order: nearest `anchor` first, spreading outwards.
 *
 *  A full CAMS run is ~72 steps and the chart needs two layers, so a click is
 *  ~144 requests and several seconds end to end. Filling left-to-right leaves
 *  the part people actually look at — right now, and the next day or two —
 *  until last. Working outwards from the current step means the useful middle
 *  of the chart is drawn within about a second and the tails fill in after. */
function outwardOrder(count: number, anchor: number): number[] {
  const order: number[] = [];
  const start = Math.max(0, Math.min(count - 1, anchor));
  for (let d = 0; d < count; d++) {
    if (d === 0) order.push(start);
    else {
      if (start - d >= 0) order.push(start - d);
      if (start + d < count) order.push(start + d);
    }
    if (order.length >= count) break;
  }
  return order;
}

/** Probe every step of every layer through one queue, nearest `anchor` first.
 *  `onProgress` fires as results land so the chart draws while it fills. */
export async function probeCamsSeries(
  layers: string[],
  lon: number,
  lat: number,
  times: string[],
  anchor: number,
  onProgress?: (series: ProbeSeries) => void,
): Promise<ProbeSeries> {
  const out: ProbeSeries = {};
  for (const layer of layers) {
    out[layer] = times.map((time) => ({ time, value: null }));
  }

  const jobs: { layer: string; i: number }[] = [];
  for (const i of outwardOrder(times.length, anchor)) {
    for (const layer of layers) jobs.push({ layer, i });
  }

  let next = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const job = jobs[next++];
      if (!job) return;
      const value = await probeCams(job.layer, lon, lat, times[job.i]);
      out[job.layer][job.i] = { time: times[job.i], value };
      done += 1;
      // Repaint every few results rather than every one — each is a full
      // re-render and 144 of them is wasted work.
      if (onProgress && (done % 4 === 0 || done === jobs.length)) {
        onProgress(
          Object.fromEntries(layers.map((l) => [l, [...out[l]]])) as ProbeSeries,
        );
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, jobs.length) }, worker),
  );
  return out;
}
