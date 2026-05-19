import type { ParsedLocation } from '../types';

function splitLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values.map((value) => value.replace(/^"|"$/g, '').trim());
}

function parseCoordinate(value: string): number | null {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function parseLocationsCsv(input: string): ParsedLocation[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return [];
  }

  const first = splitLine(lines[0]).map((value) => value.toLowerCase());
  const hasHeader = first.includes('lat') || first.includes('latitude') || first.includes('lng') || first.includes('lon');
  const dataLines = hasHeader ? lines.slice(1) : lines;
  const latIndex = hasHeader ? first.findIndex((value) => value === 'lat' || value === 'latitude') : -1;
  const lngIndex = hasHeader ? first.findIndex((value) => value === 'lng' || value === 'lon' || value === 'longitude') : -1;
  const nameIndex = hasHeader ? first.findIndex((value) => value === 'name' || value === 'label' || value === 'location') : -1;

  return dataLines.flatMap((line, index) => {
    const cells = splitLine(line);
    const lat = parseCoordinate(cells[latIndex >= 0 ? latIndex : cells.length >= 3 ? 1 : 0] ?? '');
    const lng = parseCoordinate(cells[lngIndex >= 0 ? lngIndex : cells.length >= 3 ? 2 : 1] ?? '');

    if (lat === null || lng === null || !isValidLatLng(lat, lng)) {
      return [];
    }

    return [
      {
        name: nameIndex >= 0 ? cells[nameIndex] : cells.length >= 3 ? cells[0] : `Stop ${index + 1}`,
        lat,
        lng,
      },
    ];
  });
}

export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder > 0 ? `${hours} h ${remainder} min` : `${hours} h`;
}
