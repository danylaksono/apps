/** NASA FIRMS fetching: CSV → GeoJSON (in-browser), clipped to Indonesia. */

import { useEffect } from "react";
import type { FeatureCollection, Feature, Point } from "geojson";
import {
  FIRMS_API_KEY,
  FIRMS_DAYS,
  FIRMS_SOURCE,
  INDONESIA_BBOX,
} from "./config";
import {
  indexPolygons,
  loadKabKota,
  nearPolygon,
  polygonAt,
  type PolyFC,
} from "./geo";
import { useLayersStore } from "../store/layers";

export function firmsUrl(): string {
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_API_KEY}/${FIRMS_SOURCE}/${INDONESIA_BBOX}/${FIRMS_DAYS}`;
}

/** Parse FIRMS CSV (columns: latitude,longitude,bright_ti4,scan,track,
 *  acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight). */
export function parseFirmsCsv(csv: string): FeatureCollection {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return { type: "FeatureCollection", features: [] };
  const header = lines[0].split(",");
  const idx = (name: string) => header.indexOf(name);

  const features: Feature[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const lat = Number(cols[idx("latitude")]);
    const lon = Number(cols[idx("longitude")]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [lon, lat] },
      properties: {
        confidence: cols[idx("confidence")] ?? "",
        frp: Number(cols[idx("frp")]) || 0,
        daynight: cols[idx("daynight")] ?? "",
        acq_date: cols[idx("acq_date")] ?? "",
        acq_time: cols[idx("acq_time")] ?? "",
        satellite: cols[idx("satellite")] ?? "",
      },
    });
  }
  return { type: "FeatureCollection", features };
}

/** How far outside a kab/kota polygon a detection may still be kept.
 *
 *  The shipped outlines are simplified to ~0.008 degrees, so the coastline sits
 *  up to ~900 m off the true shore. Without some slack, fires within a pixel or
 *  two of the coast — which in the peat provinces is where the people are —
 *  would be clipped away.
 *
 *  Kept deliberately tight because Indonesia, unlike Kalimantan alone, has
 *  three long *land* borders. Slack that only ever met coastline now also meets
 *  Malaysia, Papua New Guinea and Timor-Leste, and there it admits foreign
 *  fires rather than recovering Indonesian ones. Measured over 10,236
 *  detections: at 5 km the tolerance readmitted 94 points of which 55 were
 *  across a land border; at 1.5 km it recovers most of the genuine coastal
 *  detections while roughly halving that leak. A detection within ~1 km of the
 *  border is ambiguous at this resolution either way. */
const COAST_TOLERANCE_M = 1500;

/** Drop detections that are not in Indonesia.
 *
 *  FIRMS only accepts a rectangle, and no rectangle around Indonesia excludes
 *  its neighbours. So the raw response arrives with strips of Malaysia, Brunei,
 *  Timor-Leste, Papua New Guinea and the southern Philippines that stop dead at
 *  the bbox edge, which reads as a data artefact on the map and quietly
 *  inflates every KPI. Clip against the country's own outline instead. */
export function clipToIndonesia(
  fires: FeatureCollection,
  kab: PolyFC,
): FeatureCollection {
  const index = indexPolygons(kab);
  const features = fires.features.filter((f) => {
    if (f.geometry?.type !== "Point") return false;
    const pt = f as Feature<Point>;
    if (polygonAt(pt, index)) return true;
    const [lon, lat] = pt.geometry.coordinates;
    return nearPolygon(lon, lat, index, COAST_TOLERANCE_M);
  });
  return { type: "FeatureCollection", features };
}

export async function fetchFires(): Promise<FeatureCollection> {
  // Both in flight together: the clip needs the kab/kota polygons, so serial
  // fetches would add their latencies rather than overlap them.
  const [res, kab] = await Promise.all([
    fetch(firmsUrl()),
    // A missing clip is better than no fires at all — fall back to the raw
    // (bbox-cropped) set and say so, rather than failing the whole layer.
    loadKabKota().catch((err) => {
      console.warn("[agni] kab/kota load failed; fires left unclipped", err);
      return null;
    }),
  ]);
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const text = await res.text();
  if (text.toLowerCase().includes("invalid"))
    throw new Error("FIRMS: invalid API response");
  const fc = parseFirmsCsv(text);
  return kab ? clipToIndonesia(fc, kab) : fc;
}

/** Kick off a FIRMS fetch on mount; result lands in the store. */
export function useFirms(): void {
  const setFires = useLayersStore((s) => s.setFires);
  useEffect(() => {
    let cancelled = false;
    setFires(null, "loading");
    fetchFires()
      .then((fc) => {
        if (!cancelled) setFires(fc, "ok");
      })
      .catch((err) => {
        console.warn("[agni] FIRMS fetch failed", err);
        if (!cancelled) setFires(null, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [setFires]);
}
