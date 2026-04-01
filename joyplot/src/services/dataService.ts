import { getDuckDB } from '../lib/duckdb';
import * as h3 from 'h3-js';

export interface JoyPoint {
  lon: number;
  lat: number;
  pop: number;
}

export interface JoySlice {
  index: number;
  baseLat: number;
  points: JoyPoint[];
}

interface BoundaryResult {
  geojson: any;
  bbox: number[];
}

interface BoundaryProviderError {
  provider: string;
  message: string;
}

let initPromise: Promise<void> | null = null;
const boundaryCache = new Map<string, BoundaryResult>();
const boundaryInFlight = new Map<string, Promise<BoundaryResult>>();
const overpassEndpoints = [
  '/api/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

export async function initializeDuckDB(onProgress: (msg: string) => void) {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    onProgress('Initializing DuckDB...');
    const db = await getDuckDB();
    const conn = await db.connect();
    
    // Check if table already exists
    const tables = await conn.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'population'");
    if (tables.toArray().length > 0) {
      await conn.close();
      onProgress('DuckDB ready (cached)!');
      return;
    }

    onProgress('Loading population data...');
    const res = await fetch(`${import.meta.env.BASE_URL}data_source/indonesia_population_h3.parquet`);
    if (!res.ok) throw new Error('Failed to fetch population data file');
    
    const buffer = await res.arrayBuffer();
    await db.registerFileBuffer('population.parquet', new Uint8Array(buffer));
    
    await conn.query(`
      CREATE TABLE population AS SELECT * FROM read_parquet('population.parquet');
      CREATE INDEX idx_h3 ON population (h3);
    `);
    
    await conn.close();
    onProgress('DuckDB ready!');
  })();

  return initPromise;
}

function normalizeCityKey(cityName: string) {
  return cityName.trim().toLowerCase();
}

function closeRing(ring: number[][]) {
  if (ring.length < 3) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }
  return ring;
}

function toBboxFromCoords(coords: number[][]) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;

  for (const [lon, lat] of coords) {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }

  return [minLon, minLat, maxLon, maxLat];
}

function buildPolygonFromBbox(bbox: number[]) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon, minLat],
      [maxLon, minLat],
      [maxLon, maxLat],
      [minLon, maxLat],
      [minLon, minLat],
    ]],
  };
}

function extractCoordsFromGeojson(geometry: any, acc: number[][]) {
  if (!geometry?.type || !geometry?.coordinates) return;

  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates) {
      for (const coord of ring) {
        if (Array.isArray(coord) && coord.length >= 2) {
          acc.push([coord[0], coord[1]]);
        }
      }
    }
    return;
  }

  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates) {
      for (const ring of polygon) {
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            acc.push([coord[0], coord[1]]);
          }
        }
      }
    }
  }
}

function normalizeGeojsonBoundary(geometry: any): BoundaryResult {
  const geojson = geometry.type === 'Feature' ? geometry.geometry : geometry;
  const allCoords: number[][] = [];
  extractCoordsFromGeojson(geojson, allCoords);
  if (allCoords.length === 0) {
    throw new Error('Geometry has no usable coordinates');
  }

  return {
    geojson,
    bbox: toBboxFromCoords(allCoords),
  };
}

function normalizeNameForMatch(value: string) {
  return value
    .toUpperCase()
    .replace(/\bKOTA\b/g, '')
    .replace(/\bKABUPATEN\b/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNominatimBoundary(data: any[]): BoundaryResult {
  if (!data || data.length === 0) {
    throw new Error('City boundary not found');
  }

  const cityData = data[0];
  if (!cityData?.geojson || !cityData?.boundingbox) {
    throw new Error('Boundary data is incomplete');
  }

  const bbox = cityData.boundingbox.map(Number); // [minLat, maxLat, minLon, maxLon]

  return {
    geojson: cityData.geojson,
    bbox: [bbox[2], bbox[0], bbox[3], bbox[1]] // [minLon, minLat, maxLon, maxLat]
  };
}

async function fetchNominatimBoundary(cityName: string): Promise<BoundaryResult> {
  const base = import.meta.env.DEV
    ? '/api/nominatim/search'
    : 'https://nominatim.openstreetmap.org/search';
  const url = `${base}?q=${encodeURIComponent(cityName)},+Indonesia&polygon_geojson=1&format=json&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en'
    }
  });

  if (res.status === 429) {
    throw new Error('NOMINATIM_RATE_LIMITED');
  }

  if (!res.ok) {
    throw new Error(`Nominatim request failed with ${res.status}`);
  }

  const data = await res.json();
  return parseNominatimBoundary(data);
}

async function fetchOverpassBoundary(cityName: string): Promise<BoundaryResult> {
  const safeCityName = cityName.replace(/"/g, '\\"');
  const query = `
[out:json][timeout:25];
area["name"="Indonesia"]["boundary"="administrative"]->.searchArea;
(
  relation["name"="${safeCityName}"]["boundary"="administrative"](area.searchArea);
  relation["name:en"="${safeCityName}"]["boundary"="administrative"](area.searchArea);
);
out geom;
`;

  const endpoints = import.meta.env.DEV
    ? overpassEndpoints
    : overpassEndpoints.filter((url) => !url.startsWith('/api/'));

  let lastError = 'Unknown Overpass failure';

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: new URLSearchParams({ data: query })
      });

      if (!res.ok) {
        lastError = `Overpass request failed with ${res.status}`;
        continue;
      }

      const data = await res.json();
      const relations = (data?.elements || []).filter((el: any) => el.type === 'relation');
      if (relations.length === 0) {
        lastError = 'City boundary not found in Overpass';
        continue;
      }

      const bestRelation = relations.sort((a: any, b: any) => {
        const adminA = Number(a.tags?.admin_level || 99);
        const adminB = Number(b.tags?.admin_level || 99);
        return adminA - adminB;
      })[0];

      const outerRings: number[][][] = [];
      const members = bestRelation.members || [];
      for (const member of members) {
        const isOuter = member.role === 'outer' || member.role === '';
        if (member.type === 'way' && isOuter && Array.isArray(member.geometry)) {
          const ring = member.geometry.map((pt: any) => [pt.lon, pt.lat]);
          if (ring.length >= 3) {
            outerRings.push(closeRing(ring));
          }
        }
      }

      if (outerRings.length === 0) {
        lastError = 'Overpass returned relation without usable geometry';
        continue;
      }

      const allCoords = outerRings.flat();
      const bbox = toBboxFromCoords(allCoords);

      const geojson = outerRings.length === 1
        ? { type: 'Polygon', coordinates: [outerRings[0]] }
        : { type: 'MultiPolygon', coordinates: outerRings.map((ring) => [ring]) };

      return { geojson, bbox };
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Overpass fetch failed';
    }
  }

  throw new Error(lastError);
}

async function fetchPhotonBboxBoundary(cityName: string): Promise<BoundaryResult> {
  const base = import.meta.env.DEV
    ? '/api/photon/api'
    : 'https://photon.komoot.io/api';
  const url = `${base}?q=${encodeURIComponent(`${cityName}, Indonesia`)}&lang=en&limit=1`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
    }
  });

  if (!res.ok) {
    throw new Error(`Photon request failed with ${res.status}`);
  }

  const data = await res.json();
  const feature = data?.features?.[0];
  if (!feature) {
    throw new Error('City not found in Photon');
  }

  const extent = feature?.properties?.extent as number[] | undefined;
  let bbox: number[];

  if (Array.isArray(extent) && extent.length === 4) {
    bbox = [extent[0], extent[1], extent[2], extent[3]];
  } else {
    const [lon, lat] = feature.geometry?.coordinates || [];
    if (typeof lon !== 'number' || typeof lat !== 'number') {
      throw new Error('Photon returned invalid geometry');
    }
    const delta = 0.2;
    bbox = [lon - delta, lat - delta, lon + delta, lat + delta];
  }

  return {
    bbox,
    geojson: buildPolygonFromBbox(bbox),
  };
}

async function fetchBigArcGisBoundary(cityName: string): Promise<BoundaryResult> {
  const base = import.meta.env.DEV
    ? '/api/big/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KabKota_50K/MapServer/0/query'
    : 'https://geoservices.big.go.id/rbi/rest/services/BATASWILAYAH/Administrasi_AR_KabKota_50K/MapServer/0/query';

  const normalized = normalizeNameForMatch(cityName);
  const escaped = normalized.replace(/'/g, "''");
  const where = `(UPPER(WADMKK) LIKE '%${escaped}%' OR UPPER(NAMOBJ) LIKE '%${escaped}%')`;

  // First attempt: request GeoJSON directly.
  const geojsonUrl = `${base}?where=${encodeURIComponent(where)}&outFields=OBJECTID,NAMOBJ,WADMKK,WADMPR&returnGeometry=true&outSR=4326&f=geojson`;
  const geoRes = await fetch(geojsonUrl, {
    headers: {
      Accept: 'application/geo+json, application/json',
    }
  });

  if (geoRes.ok) {
    const geoData = await geoRes.json();
    const features = geoData?.features || [];
    if (features.length > 0) {
      const best = features.sort((a: any, b: any) => {
        const aName = normalizeNameForMatch(String(a?.properties?.WADMKK || a?.properties?.NAMOBJ || ''));
        const bName = normalizeNameForMatch(String(b?.properties?.WADMKK || b?.properties?.NAMOBJ || ''));
        const aExact = aName.includes(normalized) ? 1 : 0;
        const bExact = bName.includes(normalized) ? 1 : 0;
        return bExact - aExact;
      })[0];
      return normalizeGeojsonBoundary(best);
    }
  }

  // Second attempt: parse standard ArcGIS JSON geometry rings.
  const jsonUrl = `${base}?where=${encodeURIComponent(where)}&outFields=OBJECTID,NAMOBJ,WADMKK,WADMPR&returnGeometry=true&outSR=4326&f=json`;
  const jsonRes = await fetch(jsonUrl, {
    headers: {
      Accept: 'application/json',
    }
  });

  if (!jsonRes.ok) {
    throw new Error(`BIG ArcGIS request failed with ${jsonRes.status}`);
  }

  const data = await jsonRes.json();
  const features = data?.features || [];
  if (features.length === 0) {
    throw new Error('City boundary not found in BIG ArcGIS');
  }

  const best = features.sort((a: any, b: any) => {
    const aName = normalizeNameForMatch(String(a?.attributes?.WADMKK || a?.attributes?.NAMOBJ || ''));
    const bName = normalizeNameForMatch(String(b?.attributes?.WADMKK || b?.attributes?.NAMOBJ || ''));
    const aExact = aName.includes(normalized) ? 1 : 0;
    const bExact = bName.includes(normalized) ? 1 : 0;
    return bExact - aExact;
  })[0];

  const rings = best?.geometry?.rings;
  if (!Array.isArray(rings) || rings.length === 0) {
    throw new Error('BIG ArcGIS returned feature without rings');
  }

  const polygonRings: number[][][] = rings.reduce((acc: number[][][], ring: any) => {
    if (!Array.isArray(ring) || ring.length < 3) {
      return acc;
    }

    const parsed = ring
      .map((coord: any) => (Array.isArray(coord) && coord.length >= 2 ? [coord[0], coord[1]] : null))
      .filter((coord: number[] | null): coord is number[] => coord !== null);

    const closed = closeRing(parsed);
    if (closed.length >= 4) {
      acc.push(closed);
    }

    return acc;
  }, []);

  if (polygonRings.length === 0) {
    throw new Error('BIG ArcGIS rings could not be parsed');
  }

  const allCoords = polygonRings.flat();
  return {
    geojson: { type: 'Polygon', coordinates: polygonRings },
    bbox: toBboxFromCoords(allCoords),
  };
}

export async function fetchBoundary(cityName: string) {
  const cacheKey = normalizeCityKey(cityName);
  const cached = boundaryCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = boundaryInFlight.get(cacheKey);
  if (pending) {
    return pending;
  }

  const run = (async () => {
    const providerErrors: BoundaryProviderError[] = [];

    try {
      const result = await fetchNominatimBoundary(cityName);
      boundaryCache.set(cacheKey, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown boundary fetch error';
      providerErrors.push({ provider: 'Nominatim', message });
    }

    try {
      const fallbackResult = await fetchOverpassBoundary(cityName);
      boundaryCache.set(cacheKey, fallbackResult);
      return fallbackResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Overpass fetch error';
      providerErrors.push({ provider: 'Overpass', message });
    }

    try {
      const bigResult = await fetchBigArcGisBoundary(cityName);
      boundaryCache.set(cacheKey, bigResult);
      return bigResult;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown BIG ArcGIS fetch error';
      providerErrors.push({ provider: 'BIG ArcGIS', message });
    }

    try {
      const bboxFallback = await fetchPhotonBboxBoundary(cityName);
      boundaryCache.set(cacheKey, bboxFallback);
      return bboxFallback;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown Photon fetch error';
      providerErrors.push({ provider: 'Photon', message });
    }

    const providerDetails = providerErrors
      .map((entry) => `${entry.provider}: ${entry.message}`)
      .join(' | ');
    throw new Error(`All boundary providers failed. ${providerDetails}`);
  })();

  boundaryInFlight.set(cacheKey, run);
  try {
    return await run;
  } finally {
    boundaryInFlight.delete(cacheKey);
  }
}

export async function queryPopulation(h3Indices: string[]) {
  // Ensure DB is initialized before querying
  if (initPromise) await initPromise;
  
  const db = await getDuckDB();
  const conn = await db.connect();
  
  await conn.query('CREATE TEMPORARY TABLE search_h3 (h3 VARCHAR)');
  
  if (h3Indices.length > 0) {
    const values = h3Indices.map(idx => `('${idx}')`).join(',');
    await conn.query(`INSERT INTO search_h3 VALUES ${values}`);
  }
  
  const result = await conn.query(`
    SELECT s.h3, p.population 
    FROM search_h3 s
    LEFT JOIN population p ON s.h3 = p.h3
  `);
  
  const dataMap = new Map<string, number>();
  for (const row of result.toArray()) {
    dataMap.set(row.h3, row.population || 0);
  }
  
  await conn.query('DROP TABLE search_h3');
  await conn.close();
  return dataMap;
}

export function generateJoyplot(
  _geojson: any,
  bbox: number[],
  resolution: number,
  populationData: Map<string, number>
): JoySlice[] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const numSlices = resolution;
  const pointsPerSlice = Math.floor(resolution * 1.5);
  
  const latStep = (maxLat - minLat) / numSlices;
  const lonStep = (maxLon - minLon) / pointsPerSlice;
  
  const slices: JoySlice[] = [];
  
  for (let i = 0; i <= numSlices; i++) {
    const baseLat = maxLat - i * latStep;
    const points: JoyPoint[] = [];
    
    for (let j = 0; j <= pointsPerSlice; j++) {
      const lon = minLon + j * lonStep;
      const lat = baseLat;
      
      const h3Index = h3.latLngToCell(lat, lon, 8);
      let pop = populationData.get(h3Index) || 0;
      
      points.push({ lon, lat, pop });
    }
    
    const smoothedPoints = points.map((p, idx) => {
      const window = 2;
      let sum = 0;
      let count = 0;
      for (let k = -window; k <= window; k++) {
        if (points[idx + k]) {
          sum += points[idx + k].pop;
          count++;
        }
      }
      return { ...p, pop: sum / count };
    });
    
    slices.push({ index: i, baseLat, points: smoothedPoints });
  }
  
  return slices;
}
