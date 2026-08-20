import { create } from "zustand";
import type { FeatureCollection } from "geojson";
import { LAYERS } from "../layers/registry";
import { DEFAULT_BASEMAP } from "../layers/basemaps";

export type Availability = "checking" | "ok" | "unavailable";
export type FiresStatus = "idle" | "loading" | "ok" | "error";

export interface LayersState {
  basemap: string;
  visibility: Record<string, boolean>;
  opacity: Record<string, number>;
  availability: Record<string, Availability>;
  availabilityReason: Record<string, string | undefined>;
  firesGeojson: FeatureCollection | null;
  firesStatus: FiresStatus;
  /** set when the peat-extent polygons load, so the KPI recomputes */
  peatFeatureCount: number;
  /** CAMS 3-hourly time steps (ISO), and the index currently displayed */
  camsSteps: string[];
  camsIndex: number;
  camsPlaying: boolean;
  setBasemap(id: string): void;
  toggleLayer(id: string): void;
  setOpacity(id: string, value: number): void;
  setAvailability(id: string, status: Availability, reason?: string): void;
  setFires(fc: FeatureCollection | null, status: FiresStatus): void;
  setPeatLoaded(count: number): void;
  setCamsSteps(steps: string[]): void;
  setCamsIndex(i: number): void;
  setCamsPlaying(playing: boolean): void;
}

/** Index of the step closest to now — the boundary between analysis and
 *  forecast, which is where you want to land when the layer opens. */
function nowIndex(steps: string[]): number {
  if (!steps.length) return 0;
  const now = Date.now();
  let best = 0;
  let bestDiff = Infinity;
  steps.forEach((s, i) => {
    const diff = Math.abs(Date.parse(s) - now);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = i;
    }
  });
  return best;
}

const initialVisibility = Object.fromEntries(
  LAYERS.map((l) => [l.id, l.defaultVisible]),
);
const initialOpacity = Object.fromEntries(
  LAYERS.map((l) => [l.id, l.defaultOpacity]),
);

export const useLayersStore = create<LayersState>((set) => ({
  basemap: DEFAULT_BASEMAP,
  visibility: initialVisibility,
  opacity: initialOpacity,
  availability: {},
  availabilityReason: {},
  firesGeojson: null,
  firesStatus: "idle",
  peatFeatureCount: 0,
  camsSteps: [],
  camsIndex: 0,
  camsPlaying: false,
  setBasemap: (id) => set({ basemap: id }),
  toggleLayer: (id) =>
    set((s) => ({ visibility: { ...s.visibility, [id]: !s.visibility[id] } })),
  setOpacity: (id, value) =>
    set((s) => ({ opacity: { ...s.opacity, [id]: value } })),
  setAvailability: (id, status, reason) =>
    set((s) => ({
      availability: { ...s.availability, [id]: status },
      availabilityReason: { ...s.availabilityReason, [id]: reason },
    })),
  setFires: (fc, status) => set({ firesGeojson: fc, firesStatus: status }),
  setPeatLoaded: (count) => set({ peatFeatureCount: count }),
  setCamsSteps: (steps) =>
    set((s) => ({
      camsSteps: steps,
      // default to the most recent analysis step rather than the forecast tail
      camsIndex: s.camsSteps.length ? s.camsIndex : nowIndex(steps),
    })),
  setCamsIndex: (i) => set({ camsIndex: i }),
  setCamsPlaying: (playing) => set({ camsPlaying: playing }),
}));
