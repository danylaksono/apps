/** NASA FIRMS fetching: CSV → GeoJSON (in-browser), clipped to Kalimantan. */

import { useEffect } from "react";
import type { FeatureCollection, Feature, Point } from "geojson";
import {
  FIRMS_API_KEY,
  FIRMS_DAYS,
  FIRMS_SOURCE,
  KALIMANTAN_BBOX,
} from "./config";
import {
  indexPolygons,
  loadKecamatan,
  nearPolygon,
  polygonAt,
  type PolyFC,
} from "./geo";
import { useLayersStore } from "../store/layers";

export function firmsUrl(): string {
  return `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_API_KEY}/${FIRMS_SOURCE}/${KALIMANTAN_BBOX}/${FIRMS_DAYS}`;
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

/** How far outside a sub-district polygon a detection may still be kept.
 *
 *  The shipped kecamatan outlines are simplified to ~28k vertices for the whole
 *  island, so the coastline sits tens to hundreds of metres off the true shore.
 *  Without this slack every fire within a pixel or two of the coast — which in
 *  Kalimantan is where the peat and the people are — would be clipped away.
 *  Sulawesi is >100 km across the Makassar Strait, so nothing there survives. */
const COAST_TOLERANCE_M = 5000;

/** Drop detections that are not in Kalimantan.
 *
 *  FIRMS only accepts a rectangle, and no rectangle around Kalimantan can
 *  exclude west Sulawesi — the two overlap in longitude. So the raw response
 *  arrives with a strip of Sulawesi, Sabah and Natuna fires that stops dead at
 *  the bbox edge, which reads as a data artefact on the map and quietly
 *  inflates every KPI. Clip against the island's own outline instead. */
export function clipToKalimantan(
  fires: FeatureCollection,
  kec: PolyFC,
): FeatureCollection {
  const index = indexPolygons(kec);
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
  // Both in flight together: the clip needs the kecamatan polygons, so serial
  // fetches would add their latencies rather than overlap them.
  const [res, kec] = await Promise.all([
    fetch(firmsUrl()),
    // A missing clip is better than no fires at all — fall back to the raw
    // (bbox-cropped) set and say so, rather than failing the whole layer.
    loadKecamatan().catch((err) => {
      console.warn("[agni] kecamatan load failed; fires left unclipped", err);
      return null;
    }),
  ]);
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const text = await res.text();
  if (text.toLowerCase().includes("invalid"))
    throw new Error("FIRMS: invalid API response");
  const fc = parseFirmsCsv(text);
  return kec ? clipToKalimantan(fc, kec) : fc;
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
