import { create } from 'zustand';
import type {
  BasemapId,
  GeoJsonFeatureCollection,
  LocationPoint,
  PlacementMode,
  RouteSegment,
  RouteSummary,
  RoutingProfile,
} from '../types';

const STORAGE_KEY = 'cekplot.settings';
const FALLBACK_API_KEY = import.meta.env.VITE_ORS_API_KEY as string | undefined;

interface PersistedSettings {
  apiKey?: string;
  selectedBasemap?: BasemapId;
  profile?: RoutingProfile;
}

function readSettings(): PersistedSettings {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as PersistedSettings;
  } catch {
    return {};
  }
}

function saveSettings(settings: PersistedSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const seedTargets: LocationPoint[] = [
  { id: createId(), name: 'Fort Rotterdam', lat: -5.13439, lng: 119.40574 },
  { id: createId(), name: 'Pantai Losari', lat: -5.14361, lng: 119.40708 },
  { id: createId(), name: 'Masjid 99 Kubah', lat: -5.15661, lng: 119.39921 },
];

interface PlannerState {
  origin: LocationPoint | null;
  targets: LocationPoint[];
  orderedStops: string[];
  routeGeoJson: GeoJsonFeatureCollection | null;
  routeSummary: RouteSummary | null;
  routeSegments: RouteSegment[];
  focusPoint: LocationPoint | null;
  selectedBasemap: BasemapId;
  placementMode: PlacementMode;
  apiKey: string;
  hasFallbackApiKey: boolean;
  profile: RoutingProfile;
  status: 'idle' | 'optimising' | 'routing';
  error: string | null;
  setOrigin: (point: Omit<LocationPoint, 'id'>) => void;
  addTarget: (point: Omit<LocationPoint, 'id'>) => void;
  addTargets: (points: Array<Omit<LocationPoint, 'id'>>) => void;
  updateTarget: (id: string, point: Partial<Omit<LocationPoint, 'id'>>) => void;
  removeTarget: (id: string) => void;
  reorderStop: (fromIndex: number, toIndex: number) => void;
  setOrderedStops: (ids: string[]) => void;
  clearRoute: () => void;
  clearTargets: () => void;
  setRoute: (geoJson: GeoJsonFeatureCollection, summary: RouteSummary, segments: RouteSegment[]) => void;
  focusLocation: (point: LocationPoint) => void;
  setSelectedBasemap: (id: BasemapId) => void;
  setPlacementMode: (mode: PlacementMode) => void;
  setApiKey: (key: string) => void;
  setProfile: (profile: RoutingProfile) => void;
  setStatus: (status: PlannerState['status']) => void;
  setError: (error: string | null) => void;
  getEffectiveApiKey: () => string;
}

const persisted = readSettings();

export const usePlannerStore = create<PlannerState>((set, get) => ({
  origin: { id: createId(), name: 'Origin', lat: -5.14767, lng: 119.43273 },
  targets: seedTargets,
  orderedStops: seedTargets.map((target) => target.id),
  routeGeoJson: null,
  routeSummary: null,
  routeSegments: [],
  focusPoint: null,
  selectedBasemap: persisted.selectedBasemap ?? 'light',
  placementMode: 'target',
  apiKey: persisted.apiKey ?? '',
  hasFallbackApiKey: Boolean(FALLBACK_API_KEY),
  profile: persisted.profile ?? 'driving-car',
  status: 'idle',
  error: null,
  setOrigin: (point) =>
    set({
      origin: { id: createId(), ...point },
      routeGeoJson: null,
      routeSummary: null,
      routeSegments: [],
      error: null,
    }),
  addTarget: (point) =>
    set((state) => {
      const target = { id: createId(), ...point };
      return {
        targets: [...state.targets, target],
        orderedStops: [...state.orderedStops, target.id],
        routeGeoJson: null,
        routeSummary: null,
        routeSegments: [],
        error: null,
      };
    }),
  addTargets: (points) =>
    set((state) => {
      const targets = points.map((point) => ({ id: createId(), ...point }));
      return {
        targets: [...state.targets, ...targets],
        orderedStops: [...state.orderedStops, ...targets.map((target) => target.id)],
        routeGeoJson: null,
        routeSummary: null,
        routeSegments: [],
        error: null,
      };
    }),
  updateTarget: (id, point) =>
    set((state) => ({
      targets: state.targets.map((target) => (target.id === id ? { ...target, ...point } : target)),
      routeGeoJson: null,
      routeSummary: null,
      routeSegments: [],
    })),
  removeTarget: (id) =>
    set((state) => ({
      targets: state.targets.filter((target) => target.id !== id),
      orderedStops: state.orderedStops.filter((targetId) => targetId !== id),
      routeGeoJson: null,
      routeSummary: null,
      routeSegments: [],
    })),
  reorderStop: (fromIndex, toIndex) =>
    set((state) => {
      const orderedStops = [...state.orderedStops];
      const [moved] = orderedStops.splice(fromIndex, 1);
      orderedStops.splice(toIndex, 0, moved);
      return { orderedStops, routeGeoJson: null, routeSummary: null, routeSegments: [] };
    }),
  setOrderedStops: (ids) => set({ orderedStops: ids, routeGeoJson: null, routeSummary: null, routeSegments: [] }),
  clearRoute: () => set({ routeGeoJson: null, routeSummary: null, routeSegments: [] }),
  clearTargets: () => set({ targets: [], orderedStops: [], routeGeoJson: null, routeSummary: null, routeSegments: [] }),
  setRoute: (geoJson, summary, segments) => set({ routeGeoJson: geoJson, routeSummary: summary, routeSegments: segments }),
  focusLocation: (point) => set({ focusPoint: point }),
  setSelectedBasemap: (id) => {
    const next = { ...readSettings(), selectedBasemap: id };
    saveSettings(next);
    set({ selectedBasemap: id });
  },
  setPlacementMode: (mode) => set({ placementMode: mode }),
  setApiKey: (key) => {
    const next = { ...readSettings(), apiKey: key };
    saveSettings(next);
    set({ apiKey: key });
  },
  setProfile: (profile) => {
    const next = { ...readSettings(), profile };
    saveSettings(next);
    set({ profile, routeGeoJson: null, routeSummary: null, routeSegments: [] });
  },
  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),
  getEffectiveApiKey: () => get().apiKey.trim() || FALLBACK_API_KEY?.trim() || '',
}));
