import type { FeatureCollection, Geometry } from 'geojson';

export type RoutingProfile =
  | 'driving-car'
  | 'driving-hgv'
  | 'cycling-regular'
  | 'cycling-road'
  | 'foot-walking';

export type BasemapId = 'light' | 'dark' | 'osm' | 'satellite';

export type PlacementMode = 'origin' | 'target';

export interface LocationPoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

export interface RouteSummary {
  distanceMeters: number;
  durationSeconds: number;
}

export interface RouteStep {
  id: string;
  instruction: string;
  name?: string;
  distanceMeters: number;
  durationSeconds: number;
  type?: number;
  segmentIndex: number;
  stepIndex: number;
}

export interface RouteSegment {
  id: string;
  label: string;
  distanceMeters: number;
  durationSeconds: number;
  steps: RouteStep[];
}

export type GeoJsonFeatureCollection = FeatureCollection<Geometry, Record<string, unknown>>;

export interface OptimiseResult {
  orderedIds: string[];
  summary?: RouteSummary;
}

export interface ParsedLocation {
  name?: string;
  lat: number;
  lng: number;
}

export interface GeocodeResult {
  id: string;
  label: string;
  lat: number;
  lng: number;
  category?: string;
}
