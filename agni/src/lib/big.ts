/** BIG SatuPeta (Badan Informasi Geospasial) ArcGIS MapServer.
 *
 *  This is the *official* Indonesian source, and unlike every other `.go.id`
 *  endpoint in AGENTS.md it actually works: keyless, and it echoes the request
 *  Origin in `Access-Control-Allow-Origin`, so it is usable straight from the
 *  browser. It supersedes the token-gated `services8.arcgis.com` KHG service.
 *
 *  Two things make it practical despite being a dynamic MapServer with no tile
 *  cache:
 *    - `maxAllowableOffset` simplifies geometry server-side. For KHG over
 *      Kalimantan that is 5 MB -> 115 kB with all 101 features intact.
 *    - `resultOffset`/`resultRecordCount` page around the 1000-feature cap.
 *
 *  Layers are fetched lazily (on first toggle) and cached for the session. */

import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";
import { BIG_MAPSERVER, KALIMANTAN_BBOX } from "./config";

export type PeatFC = FeatureCollection<Polygon | MultiPolygon>;

/** Max features per request the service will return. */
const PAGE = 1000;

/** ~220 m at the equator. Enough for a national-scale map, ~40x smaller. */
const SIMPLIFY_DEG = 0.002;

export interface BigLayerSpec {
  /** numeric layer id in the MapServer */
  layerId: number;
  /** attributes to keep */
  outFields: readonly string[];
  /** stop after this many features (guards against a runaway fetch) */
  maxFeatures?: number;
}

function queryUrl(spec: BigLayerSpec, offset: number): string {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: spec.outFields.join(","),
    geometry: KALIMANTAN_BBOX,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnGeometry: "true",
    maxAllowableOffset: String(SIMPLIFY_DEG),
    geometryPrecision: "5",
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: "geojson",
  });
  return `${BIG_MAPSERVER}/${spec.layerId}/query?${params}`;
}

async function fetchPage(spec: BigLayerSpec, offset: number): Promise<PeatFC> {
  const res = await fetch(queryUrl(spec, offset));
  if (!res.ok) throw new Error(`BIG layer ${spec.layerId}: HTTP ${res.status}`);
  const json = (await res.json()) as PeatFC & { error?: { message?: string } };
  if (json.error) {
    throw new Error(json.error.message ?? `BIG layer ${spec.layerId} error`);
  }
  if (!Array.isArray(json.features)) {
    throw new Error(`BIG layer ${spec.layerId}: no features array`);
  }
  return json;
}

const cache = new Map<number, Promise<PeatFC>>();

/** Fetch a BIG layer clipped to Kalimantan, paging until exhausted. */
export function loadBigLayer(spec: BigLayerSpec): Promise<PeatFC> {
  const hit = cache.get(spec.layerId);
  if (hit) return hit;

  const task = (async () => {
    const features: PeatFC["features"] = [];
    const cap = spec.maxFeatures ?? 20000;
    for (let offset = 0; offset < cap; offset += PAGE) {
      const page = await fetchPage(spec, offset);
      features.push(...page.features);
      // A short page means we've reached the end.
      if (page.features.length < PAGE) break;
    }
    return { type: "FeatureCollection", features } as PeatFC;
  })();

  cache.set(spec.layerId, task);
  task.catch(() => cache.delete(spec.layerId)); // let a failed load be retried
  return task;
}
