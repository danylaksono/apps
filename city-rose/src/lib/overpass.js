import { OVERPASS_ENDPOINTS } from './constants';

const HIGHWAY_PATTERN =
  '^(motorway|trunk|primary|secondary|tertiary|residential|unclassified)$';

const cityCache = new Map();
const mapDataCache = new Map();

function buildAreaId(osmType, osmId) {
  const id = Number.parseInt(osmId, 10);

  if (Number.isNaN(id)) {
    throw new Error('Received an invalid OSM identifier from geocoding response.');
  }

  if (osmType === 'relation') {
    return id + 3600000000;
  }

  if (osmType === 'way') {
    return id + 2400000000;
  }

  throw new Error(`Unsupported OSM type: ${osmType}`);
}

async function fetchOverpassData(areaId, attempt = 0) {
  const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
  const query = `[out:json][timeout:90];area(${areaId})->.a;(way["highway"~"${HIGHWAY_PATTERN}"](area.a););out geom;`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!response.ok) {
      throw new Error(`Overpass endpoint responded with ${response.status}.`);
    }

    return await response.json();
  } catch (error) {
    if (attempt < 3) {
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
      return fetchOverpassData(areaId, attempt + 1);
    }

    throw error;
  }
}

export async function fetchCity(searchQuery) {
  const queryKey = searchQuery.trim().toLowerCase();
  if (cityCache.has(queryKey)) {
    return cityCache.get(queryKey);
  }

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&addressdetails=1`
  );

  if (!response.ok) {
    throw new Error('Geocoding service is unavailable. Try again in a moment.');
  }

  const data = await response.json();

  if (!data.length) {
    throw new Error('City not found. Try using city and country in your query.');
  }

  const city = data[0];

  const result = {
    areaId: buildAreaId(city.osm_type, city.osm_id),
    bbox: city.boundingbox.map(Number),
    cityName: city.display_name.split(',')[0].trim(),
    coords: {
      lat: Number.parseFloat(city.lat),
      lon: Number.parseFloat(city.lon),
    },
  };

  cityCache.set(queryKey, result);
  return result;
}

export async function fetchStreetWays(areaId) {
  if (mapDataCache.has(areaId)) {
    return mapDataCache.get(areaId);
  }

  const overpassData = await fetchOverpassData(areaId);

  if (!overpassData.elements || overpassData.elements.length === 0) {
    throw new Error('No street network found inside this boundary.');
  }

  mapDataCache.set(areaId, overpassData.elements);
  return overpassData.elements;
}
