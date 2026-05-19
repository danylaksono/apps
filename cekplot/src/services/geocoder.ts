import type { GeocodeResult } from '../types';

const NOMINATIM_ENDPOINT =
  (import.meta.env.VITE_NOMINATIM_ENDPOINT as string | undefined)?.replace(/\/$/, '') ??
  'https://nominatim.openstreetmap.org';

const CACHE_KEY = 'cekplot.geocoder.cache';
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAKASSAR_VIEWBOX = '119.32,-5.03,119.58,-5.28';

let lastRequestAt = 0;

type GeocoderCache = Record<string, GeocodeResult[]>;

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  type?: string;
  class?: string;
}

function readCache(): GeocoderCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as GeocoderCache;
  } catch {
    return {};
  }
}

function writeCache(cache: GeocoderCache): void {
  localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
}

function normaliseQuery(query: string): string {
  return query.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function waitForRateLimit(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed >= MIN_REQUEST_INTERVAL_MS) return;

  await new Promise((resolve) => {
    window.setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed);
  });
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const normalised = normaliseQuery(query);

  if (normalised.length < 3) {
    throw new Error('Enter at least 3 characters to search for an address.');
  }

  const cache = readCache();
  if (cache[normalised]) {
    return cache[normalised];
  }

  await waitForRateLimit();
  lastRequestAt = Date.now();

  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'id',
    viewbox: MAKASSAR_VIEWBOX,
    bounded: '1',
    addressdetails: '0',
    extratags: '0',
    namedetails: '0',
    'accept-language': 'id,en',
  });

  const response = await fetch(`${NOMINATIM_ENDPOINT}/search?${params.toString()}`, {
    method: 'GET',
    signal,
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Nominatim search failed with status ${response.status}.`);
  }

  const data = (await response.json()) as NominatimResult[];
  const results = data
    .map((item) => {
      const lat = Number(item.lat);
      const lng = Number(item.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      return {
        id: String(item.place_id),
        label: item.display_name,
        lat,
        lng,
        category: [item.class, item.type].filter(Boolean).join(' / ') || undefined,
      } as GeocodeResult;
    })
    .filter((item): item is GeocodeResult => Boolean(item));

  writeCache({ ...cache, [normalised]: results });
  return results;
}
