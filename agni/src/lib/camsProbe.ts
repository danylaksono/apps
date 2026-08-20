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

/** Probe requests in flight at once. Enough to make a full series feel
 *  immediate without hammering a free public service. */
const CONCURRENCY = 8;

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

/** Probe every step, `CONCURRENCY` at a time, preserving order.
 *  `onProgress` fires as results land so the chart can draw while it fills. */
export async function probeCamsSeries(
  layer: string,
  lon: number,
  lat: number,
  times: string[],
  onProgress?: (points: ProbePoint[]) => void,
): Promise<ProbePoint[]> {
  const out: ProbePoint[] = times.map((time) => ({ time, value: null }));
  let next = 0;
  let done = 0;

  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= times.length) return;
      out[i] = { time: times[i], value: await probeCams(layer, lon, lat, times[i]) };
      done += 1;
      // Repaint every few results rather than every one — the chart is a whole
      // re-render and 70 of them is wasted work.
      if (onProgress && (done % 6 === 0 || done === times.length)) {
        onProgress([...out]);
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, times.length) }, worker),
  );
  return out;
}
