import fs from 'node:fs/promises';
import path from 'node:path';
import duckdb from 'duckdb';
import * as h3 from 'h3-js';

const featuredCities = [
  'Jakarta',
  'Surabaya',
  'Bandung',
  'Madiun',
  'Medan',
  'Gresik',
  'Denpasar',
  'Solo',
  'Semarang',
  'Yogyakarta',
  'Manokwari',
  'Makassar',
  'Bekasi',
];

const OUTPUT_FILE = path.join(process.cwd(), 'public', 'data_source', 'joyplot-carousel-cache.json');
const PARQUET_FILE = path.join(process.cwd(), 'public', 'data_source', 'indonesia_population_h3.parquet');
const RESOLUTION = 80;

function slugifyCityName(cityName) {
  return cityName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeGeojson(rawGeojson) {
  if (!rawGeojson || typeof rawGeojson !== 'object') {
    throw new Error('Invalid GeoJSON');
  }

  if (rawGeojson.type === 'Feature') {
    return rawGeojson.geometry;
  }

  if (rawGeojson.type === 'FeatureCollection') {
    const features = rawGeojson.features || [];
    if (features.length === 0) {
      throw new Error('Empty FeatureCollection');
    }
    if (features.length === 1) {
      return normalizeGeojson(features[0]);
    }
    return {
      type: 'FeatureCollection',
      features,
    };
  }

  return rawGeojson;
}

function collectCoordinates(geometry, acc) {
  if (!geometry || typeof geometry !== 'object') return;

  if (geometry.type === 'Polygon') {
    for (const ring of geometry.coordinates || []) {
      for (const coord of ring) {
        if (Array.isArray(coord) && coord.length >= 2) {
          acc.push([coord[0], coord[1]]);
        }
      }
    }
    return;
  }

  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates || []) {
      for (const ring of polygon) {
        for (const coord of ring) {
          if (Array.isArray(coord) && coord.length >= 2) {
            acc.push([coord[0], coord[1]]);
          }
        }
      }
    }
    return;
  }

  if (geometry.type === 'GeometryCollection') {
    for (const item of geometry.geometries || []) {
      collectCoordinates(item, acc);
    }
    return;
  }

  if (geometry.type === 'Feature') {
    collectCoordinates(geometry.geometry, acc);
    return;
  }

  if (geometry.type === 'FeatureCollection') {
    for (const feature of geometry.features || []) {
      collectCoordinates(feature, acc);
    }
  }
}

function bboxFromCoordinates(coords) {
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

function getBboxFromGeojson(geojson) {
  const coords = [];
  collectCoordinates(geojson, coords);
  if (coords.length === 0) {
    throw new Error('GeoJSON contains no coordinates');
  }
  return bboxFromCoordinates(coords);
}

function serializeSlices(slices) {
  return slices.map((slice) => ({
    index: slice.index,
    baseLat: slice.baseLat,
    points: slice.points.map((point) => [point.lon, point.lat, point.pop]),
  }));
}

function deserializeSlices(serialized) {
  return serialized.map((slice) => ({
    index: slice.index,
    baseLat: slice.baseLat,
    points: slice.points.map(([lon, lat, pop]) => ({ lon, lat, pop })),
  }));
}

function createJoyplot(bbox, resolution, populationData) {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  const numSlices = resolution;
  const pointsPerSlice = Math.floor(resolution * 1.5);
  const latStep = (maxLat - minLat) / numSlices;
  const lonStep = (maxLon - minLon) / pointsPerSlice;
  const slices = [];

  for (let i = 0; i <= numSlices; i += 1) {
    const baseLat = maxLat - i * latStep;
    const points = [];

    for (let j = 0; j <= pointsPerSlice; j += 1) {
      const lon = minLon + j * lonStep;
      const lat = baseLat;
      const h3Index = h3.latLngToCell(lat, lon, 8);
      const pop = populationData.get(h3Index) || 0;
      points.push({ lon, lat, pop });
    }

    const smoothedPoints = points.map((p, idx) => {
      const window = 2;
      let sum = 0;
      let count = 0;
      for (let k = -window; k <= window; k += 1) {
        const neighbor = points[idx + k];
        if (neighbor) {
          sum += neighbor.pop;
          count += 1;
        }
      }
      return { ...p, pop: sum / count };
    });

    slices.push({ index: i, baseLat, points: smoothedPoints });
  }

  return slices;
}

function runSql(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function allSql(conn, sql) {
  return new Promise((resolve, reject) => {
    conn.all(sql, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function main() {
  const db = new duckdb.Database(':memory:');
  const conn = db.connect();

  console.log('Loading population parquet into DuckDB...');
  const parquetPath = PARQUET_FILE.replace(/\\/g, '\\\\');
  await runSql(conn, `CREATE TABLE population AS SELECT * FROM read_parquet('${parquetPath}')`);

  const records = {};

  for (const city of featuredCities) {
    const slug = slugifyCityName(city);
    const boundaryPath = path.join(process.cwd(), 'public', 'data_source', 'boundaries', `${slug}.geojson`);
    console.log(`Processing ${city} (${boundaryPath})`);
    const raw = JSON.parse(await fs.readFile(boundaryPath, 'utf8'));
    const geojson = normalizeGeojson(raw);
    const bbox = getBboxFromGeojson(geojson);
    const cityCenter = [(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2];

    const numSlices = RESOLUTION;
    const pointsPerSlice = Math.floor(RESOLUTION * 1.5);
    const latStep = (bbox[3] - bbox[1]) / numSlices;
    const lonStep = (bbox[2] - bbox[0]) / pointsPerSlice;
    const h3Set = new Set();

    for (let i = 0; i <= numSlices; i += 1) {
      const lat = bbox[3] - i * latStep;
      for (let j = 0; j <= pointsPerSlice; j += 1) {
        const lon = bbox[0] + j * lonStep;
        h3Set.add(h3.latLngToCell(lat, lon, 8));
      }
    }

    const values = Array.from(h3Set)
      .map((value) => `'${value.replace(/'/g, "''")}'`)
      .join(',');
    const rows = values.length > 0
      ? await allSql(conn, `SELECT h3, population FROM population WHERE h3 IN (${values})`)
      : [];

    const populationData = new Map(rows.map((row) => [row.h3, Number(row.population) || 0]));
    const slices = createJoyplot(bbox, RESOLUTION, populationData);

    let maxPop = 0;
    slices.forEach((slice) => {
      slice.points.forEach((point) => {
        if (point.pop > maxPop) maxPop = point.pop;
      });
    });

    records[city.trim().toLowerCase()] = {
      city,
      bbox,
      cityCenter,
      maxPop,
      slices: serializeSlices(slices),
    };
  }

  const output = {
    version: 1,
    resolution: RESOLUTION,
    cities: records,
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(output));
  console.log(`Wrote carousel cache to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
