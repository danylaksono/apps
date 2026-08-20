/** CAMS haze layers via ECMWF's public WMS.
 *
 *  This is what powers the animation on
 *  https://apps.atmosphere.copernicus.eu/fire-emissions-watch/ — CAMS global
 *  atmospheric composition, served from `eccharts.ecmwf.int/wms` with
 *  `token=public`. No key, and CORS echoes the request Origin.
 *
 *  Two properties shape how we consume it:
 *
 *  1. It is a **render-on-demand** service — every GetMap spawns a plot worker
 *     and 302s to a streaming PNG. Requesting an XYZ pyramid would mean dozens
 *     of renders per pan. So each layer is a single MapLibre `image` source
 *     covering the Kalimantan bbox: one render per time step, and the image
 *     swaps in place as you scrub.
 *  2. It has a **time dimension** — 3-hourly, roughly 5 days of analysis plus
 *     4 days of forecast. That is the animation. The available steps are read
 *     from GetCapabilities (~22 kB gzipped) the first time a CAMS layer is
 *     switched on. */

import { CAMS_WMS } from "./config";

/** Deliberately wider than KALIMANTAN_BBOX: this is one flat image, so its
 *  edge is a visible straight line. Pushing the edge well outside the area of
 *  interest keeps it off-screen at the zoom levels people actually use. */
const CAMS_BBOX: [number, number, number, number] = [101, -11, 128, 14];

/** CAMS image extent as MapLibre corners (clockwise from top-left). */
export function kalimantanCorners(): [
  [number, number],
  [number, number],
  [number, number],
  [number, number],
] {
  const [w, s, e, n] = CAMS_BBOX;
  return [
    [w, n],
    [e, n],
    [e, s],
    [w, s],
  ];
}

function toMercator(lon: number, lat: number): [number, number] {
  const x = (lon * 20037508.34) / 180;
  const y =
    (Math.log(Math.tan(((90 + lat) * Math.PI) / 360)) / (Math.PI / 180)) *
    (20037508.34 / 180);
  return [x, y];
}

/** GetMap URL for one CAMS layer at one time step. */
export function camsImageUrl(
  layer: string,
  style: string,
  time: string,
  size = 1024,
): string {
  const [w, s, e, n] = CAMS_BBOX;
  const [minX, minY] = toMercator(w, s);
  const [maxX, maxY] = toMercator(e, n);
  // keep the aspect ratio of the mercator bbox so the image is not stretched
  const ratio = (maxY - minY) / (maxX - minX);
  const params = new URLSearchParams({
    token: "public",
    service: "WMS",
    version: "1.3.0",
    request: "GetMap",
    layers: layer,
    styles: style,
    format: "image/png",
    transparent: "true",
    crs: "EPSG:3857",
    width: String(size),
    height: String(Math.round(size * ratio)),
    bbox: `${minX},${minY},${maxX},${maxY}`,
    time,
  });
  return `${CAMS_WMS}?${params}`;
}

/** Expand an ISO 8601 `start/end/PT3H`-style extent into discrete steps. */
function expandExtent(raw: string): string[] {
  const steps: string[] = [];
  for (const part of raw.split(",")) {
    const chunk = part.trim();
    if (!chunk) continue;
    if (!chunk.includes("/")) {
      steps.push(chunk);
      continue;
    }
    const [startS, endS, periodS] = chunk.split("/");
    const start = Date.parse(startS);
    const end = Date.parse(endS);
    const hours = /^PT(\d+)H$/.exec(periodS ?? "")?.[1];
    if (!Number.isFinite(start) || !Number.isFinite(end) || !hours) continue;
    const stepMs = Number(hours) * 3600_000;
    for (let t = start; t <= end; t += stepMs) {
      steps.push(new Date(t).toISOString().replace(/\.\d{3}Z$/, "Z"));
    }
  }
  return steps;
}

let capsCache: Promise<Map<string, string[]>> | null = null;

/** Time steps per layer, parsed once from GetCapabilities. */
function loadCapabilities(): Promise<Map<string, string[]>> {
  if (capsCache) return capsCache;
  const url = `${CAMS_WMS}?token=public&service=WMS&version=1.3.0&request=GetCapabilities`;
  capsCache = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`CAMS capabilities ${r.status}`);
      return r.text();
    })
    .then((xml) => {
      const out = new Map<string, string[]>();
      const doc = new DOMParser().parseFromString(xml, "text/xml");
      for (const layerEl of Array.from(doc.getElementsByTagName("Layer"))) {
        const name = layerEl.getElementsByTagName("Name")[0]?.textContent;
        if (!name) continue;
        for (const dim of Array.from(
          layerEl.getElementsByTagName("Dimension"),
        )) {
          if (dim.getAttribute("name") !== "time") continue;
          const steps = expandExtent(dim.textContent ?? "");
          if (steps.length) out.set(name, steps);
        }
      }
      return out;
    });
  capsCache.catch(() => {
    capsCache = null;
  });
  return capsCache;
}

export async function camsTimeSteps(layer: string): Promise<string[]> {
  const caps = await loadCapabilities();
  return caps.get(layer) ?? [];
}
