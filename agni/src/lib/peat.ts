/** Lazy loading for the BIG-backed vector layers.
 *
 *  These are fetched on first toggle rather than at startup: KHG is quick
 *  (101 features, ~115 kB) but Fungsi Ekosistem Gambut pages through ~4,400
 *  and fire hazard through ~20,000. Each reports `checking -> ok | unavailable`
 *  so the panel can show progress and degrade without breaking the map. */

import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { BIG_LAYERS } from "./config";
import { loadBigLayer, type BigLayerSpec, type PeatFC } from "./big";
import { useLayersStore } from "../store/layers";

interface BigBackedLayer {
  /** registry layer id */
  id: string;
  /** map source id to push the GeoJSON into */
  sourceId: string;
  spec: BigLayerSpec;
}

export const BIG_BACKED: BigBackedLayer[] = [
  { id: "peat-extent", sourceId: "peat-extent", spec: BIG_LAYERS.peatland },
  { id: "peat-khg", sourceId: "khg", spec: BIG_LAYERS.khg },
  {
    id: "peat-function",
    sourceId: "peat-function",
    spec: BIG_LAYERS.peatFunction,
  },
  { id: "fire-hazard", sourceId: "fire-hazard", spec: BIG_LAYERS.fireHazard },
];

const started = new Set<string>();

/** Loaded data, kept here rather than pushed once: the fetch can finish before
 *  the map source exists (or the layer may be removed and re-added later), and
 *  a `setData` aimed at a missing source is silently lost. `applyBigData` is
 *  re-run on every map sync and repairs any source that is empty. */
const loaded = new Map<string, PeatFC>();
/** What each *source instance* holds. Keyed on the source object, not its id:
 *  toggling a layer off removes the source and toggling it on creates a new
 *  empty one, so an id-keyed guard would decide the data was already there and
 *  the layer would come back blank. */
const appliedTo = new WeakMap<object, PeatFC>();

/** Full peat extent (BIG layer 6) once loaded — backs the peat-fires KPI.
 *  Deliberately not KHG: see the coverage note in config.ts. */
export function getPeatExtent(): PeatFC | null {
  return loaded.get("peat-extent") ?? null;
}

/** Push any loaded BIG data into sources that don't have it yet. Idempotent
 *  and cheap: it only calls setData when the source exists and is stale. */
export function applyBigData(map: MaplibreMap): void {
  for (const entry of BIG_BACKED) {
    const fc = loaded.get(entry.id);
    if (!fc) continue;
    const src = map.getSource(entry.sourceId) as GeoJSONSource | undefined;
    if (!src || appliedTo.get(src) === fc) continue;
    src.setData(fc);
    appliedTo.set(src, fc);
  }
}

/** Fetch a BIG layer and push it into its map source. Idempotent. */
export function ensureBigLayer(map: MaplibreMap, id: string): void {
  const entry = BIG_BACKED.find((b) => b.id === id);
  if (!entry || started.has(id)) return;
  started.add(id);

  const { setAvailability, setPeatLoaded } = useLayersStore.getState();
  setAvailability(id, "checking", "loading…");

  loadBigLayer(entry.spec)
    .then(({ fc, truncated }) => {
      loaded.set(id, fc);
      applyBigData(map);
      // Still usable when truncated, so it stays "ok" — but the panel says the
      // coverage is partial rather than implying the whole country is drawn.
      setAvailability(id, "ok", truncated ? "partial coverage" : undefined);
      if (id === "peat-extent") setPeatLoaded(fc.features.length);
    })
    .catch((err) => {
      console.warn(`[agni] BIG layer ${id} failed`, err);
      setAvailability(id, "unavailable", "source unreachable");
      started.delete(id); // allow a retry on the next toggle
    });
}
