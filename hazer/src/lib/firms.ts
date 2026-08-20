/** NASA FIRMS fetching: CSV → GeoJSON (in-browser). */

import { useEffect } from "react";
import type { FeatureCollection, Feature } from "geojson";
import {
  FIRMS_API_KEY,
  FIRMS_DAYS,
  FIRMS_SOURCE,
  KALIMANTAN_BBOX,
} from "./config";
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

export async function fetchFires(): Promise<FeatureCollection> {
  const res = await fetch(firmsUrl());
  if (!res.ok) throw new Error(`FIRMS ${res.status}`);
  const text = await res.text();
  if (text.toLowerCase().includes("invalid"))
    throw new Error("FIRMS: invalid API response");
  return parseFirmsCsv(text);
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
        console.warn("[hazer] FIRMS fetch failed", err);
        if (!cancelled) setFires(null, "error");
      });
    return () => {
      cancelled = true;
    };
  }, [setFires]);
}
