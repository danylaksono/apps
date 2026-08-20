/** Place search: the app's own administrative areas first, then a geocoder.
 *
 *  Two sources, in that order, because they answer different questions.
 *
 *  The 514 kab/kota are already in memory — they are fetched to clip the fire
 *  layer — so matching them costs nothing, needs no network, and returns the
 *  exact polygon the rest of the app reasons about. Searching "Ketapang" and
 *  landing on the same boundary the charts count is worth more than a pin from
 *  a global gazetteer.
 *
 *  Photon covers everything else: villages, rivers, landmarks. Keyless,
 *  CORS-open, and built for type-ahead, unlike Nominatim whose usage policy
 *  caps at roughly one request a second — not a rate you can type at. */

import { INDONESIA_BBOX } from "./config";
import { boundsOf, type PolyFC } from "./geo";

export interface PlaceHit {
  id: string;
  name: string;
  /** province, region, or feature type — whatever tells two hits apart */
  context: string;
  /** flown to when there is no extent to fit */
  center: [number, number];
  /** [w, s, e, n] when the place has a known extent */
  bounds?: [number, number, number, number];
  source: "admin" | "geocoder";
}

const PHOTON = "https://photon.komoot.io/api";

/** Kab/kota and provinces matching `query`, from data already loaded.
 *
 *  Provinces are derived from the kab/kota rather than shipped separately —
 *  every feature carries `provinsi_name`, so the set is free. */
export function searchAdmin(query: string, kab: PolyFC | null): PlaceHit[] {
  const q = query.trim().toLowerCase();
  if (!q || !kab) return [];

  const kabHits: PlaceHit[] = [];
  const provinces = new Map<string, boolean>();

  for (const f of kab.features) {
    const props = f.properties as {
      name?: string;
      provinsi_name?: string;
    } | null;
    const name = String(props?.name ?? "");
    const prov = String(props?.provinsi_name ?? "");
    if (prov) provinces.set(prov, provinces.get(prov) || prov.toLowerCase().includes(q));
    if (!name.toLowerCase().includes(q)) continue;
    if (kabHits.some((h) => h.name === name && h.context === prov)) continue;
    const b = boundsOf(kab, "name", name);
    if (!b) continue;
    kabHits.push({
      id: `kab:${prov}/${name}`,
      name,
      context: prov,
      center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
      bounds: b,
      source: "admin",
    });
  }

  const provHits: PlaceHit[] = [];
  for (const [prov, matched] of provinces) {
    if (!matched) continue;
    const b = boundsOf(kab, "provinsi_name", prov);
    if (!b) continue;
    provHits.push({
      id: `prov:${prov}`,
      name: prov,
      context: "Province",
      center: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2],
      bounds: b,
      source: "admin",
    });
  }

  // Provinces first: a one-word query like "Riau" almost always means the
  // province rather than a kabupaten that happens to contain the word.
  return [...provHits, ...kabHits].slice(0, 6);
}

interface PhotonFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    countrycode?: string;
    state?: string;
    county?: string;
    city?: string;
    osm_key?: string;
    osm_value?: string;
    /** [minLon, maxLat, maxLon, minLat] — note the order */
    extent?: [number, number, number, number];
  };
}

/** Everything the admin list cannot answer. Aborts with the caller's signal so
 *  a keystroke supersedes the request it interrupted. */
export async function searchGeocoder(
  query: string,
  signal: AbortSignal,
): Promise<PlaceHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    lang: "en",
    limit: "8",
    // The bbox narrows to the region; countrycode below makes it exact, since
    // any box around Indonesia also contains slices of its neighbours.
    bbox: INDONESIA_BBOX,
  });
  const res = await fetch(`${PHOTON}?${params}`, { signal });
  if (!res.ok) throw new Error(`geocoder ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };

  const out: PlaceHit[] = [];
  for (const f of json.features ?? []) {
    const p = f.properties ?? {};
    const c = f.geometry?.coordinates;
    if (!c || p.countrycode !== "ID" || !p.name) continue;
    const context =
      [p.city, p.county, p.state].filter(Boolean).join(", ") ||
      p.osm_value ||
      "Indonesia";
    const id = `geo:${p.name}|${context}|${c[0].toFixed(3)}`;
    if (out.some((h) => h.id === id)) continue;
    const e = p.extent;
    out.push({
      id,
      name: p.name,
      context,
      center: [c[0], c[1]],
      // Photon's extent is [minLon, maxLat, maxLon, minLat]; ours is w,s,e,n
      bounds: e ? [e[0], e[3], e[2], e[1]] : undefined,
      source: "geocoder",
    });
    if (out.length >= 5) break;
  }
  return out;
}
