import type { GeoJsonFeatureCollection, LocationPoint, OptimiseResult, RouteSegment, RoutingProfile } from '../types';

const ORS_OPTIMIZATION_URL = 'https://api.heigit.org/vroom/v0';
const ORS_DIRECTIONS_BASE_URL = 'https://api.heigit.org/openrouteservice/v2/directions';

interface OptimiseStopsInput {
  origin: LocationPoint;
  targets: LocationPoint[];
  apiKey: string;
  profile: RoutingProfile;
}

interface DirectionsInput {
  coordinates: Array<[number, number]>;
  apiKey: string;
  profile: RoutingProfile;
}

interface DirectionsResult {
  geoJson: GeoJsonFeatureCollection;
  distanceMeters: number;
  durationSeconds: number;
  segments: RouteSegment[];
}

function ensureApiKey(apiKey: string): void {
  if (!apiKey.trim()) {
    throw new Error('Add an OpenRouteService API key before requesting optimisation or directions.');
  }
}

async function parseOrsResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'error' in payload
        ? typeof (payload as any).error === 'string'
          ? (payload as any).error
          : typeof (payload as any).error?.message === 'string'
            ? (payload as any).error.message
            : `OpenRouteService request failed with status ${response.status}.`
        : `OpenRouteService request failed with status ${response.status}.`;
    throw new Error(message);
  }

  return payload;
}

export async function optimiseStops({
  origin,
  targets,
  apiKey,
  profile,
}: OptimiseStopsInput): Promise<OptimiseResult> {
  ensureApiKey(apiKey);

  if (targets.length === 0) {
    throw new Error('Add at least one target stop before optimising.');
  }

  const response = await fetch(ORS_OPTIMIZATION_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jobs: targets.map((target, index) => ({
        id: index + 1,
        location: [target.lng, target.lat],
      })),
      vehicles: [
        {
          id: 1,
          profile,
          start: [origin.lng, origin.lat],
        },
      ],
    }),
  });

  const data = (await parseOrsResponse(response)) as {
    routes?: Array<{
      steps?: Array<{ type?: string; job?: number }>;
      distance?: number;
      duration?: number;
    }>;
  };

  const route = data.routes?.[0];
  if (!route?.steps?.length) {
    throw new Error('ORS did not return an optimised route for these stops.');
  }

  const orderedIds = route.steps
    .filter((step) => step.type === 'job' && typeof step.job === 'number')
    .map((step) => targets[Number(step.job) - 1]?.id)
    .filter(Boolean);

  if (orderedIds.length !== targets.length) {
    throw new Error('ORS returned an incomplete stop order. Check the coordinates and try again.');
  }

  return {
    orderedIds,
    summary:
      typeof route.distance === 'number' && typeof route.duration === 'number'
        ? { distanceMeters: route.distance, durationSeconds: route.duration }
        : undefined,
  };
}

export async function fetchDirections({
  coordinates,
  apiKey,
  profile,
}: DirectionsInput): Promise<DirectionsResult> {
  ensureApiKey(apiKey);

  if (coordinates.length < 2) {
    throw new Error('A route needs an origin and at least one target stop.');
  }

  const response = await fetch(`${ORS_DIRECTIONS_BASE_URL}/${profile}/geojson`, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      coordinates,
      instructions: true,
      elevation: false,
      geometry_simplify: false,
    }),
  });

  const geoJson = (await parseOrsResponse(response)) as GeoJsonFeatureCollection & {
    features: Array<{
      properties?: {
        summary?: {
          distance?: number;
          duration?: number;
        };
        segments?: Array<{
          distance?: number;
          duration?: number;
          steps?: Array<{
            instruction?: string;
            name?: string;
            distance?: number;
            duration?: number;
            type?: number;
          }>;
        }>;
      };
    }>;
  };

  const properties = geoJson.features?.[0]?.properties;
  const summary = properties?.summary;
  const segments = (properties?.segments ?? []).map((segment, segmentIndex) => ({
    id: `segment-${segmentIndex}`,
    label: `Leg ${segmentIndex + 1}`,
    distanceMeters: segment.distance ?? 0,
    durationSeconds: segment.duration ?? 0,
    steps: (segment.steps ?? []).map((step, stepIndex) => ({
      id: `segment-${segmentIndex}-step-${stepIndex}`,
      instruction: step.instruction || 'Continue',
      name: step.name,
      distanceMeters: step.distance ?? 0,
      durationSeconds: step.duration ?? 0,
      type: step.type,
      segmentIndex,
      stepIndex,
    })),
  }));

  return {
    geoJson,
    distanceMeters: summary?.distance ?? 0,
    durationSeconds: summary?.duration ?? 0,
    segments,
  };
}
