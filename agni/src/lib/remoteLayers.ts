/** Lazy loading for every vector layer whose data is fetched rather than tiled:
 *  the BIG peat set, fire hazard, the KLHK forestry set, and any layer the user
 *  added themselves (see layers/custom.ts).
 *
 *  These are fetched on first toggle rather than at startup: KHG is quick
 *  (101 features, ~115 kB) but Fungsi Ekosistem Gambut pages through ~4,400,
 *  fire hazard through ~20,000, and the gazetted forest estate is 12.9 MB over
 *  five pages because the service does not gzip. Each reports
 *  `checking -> ok | unavailable` so the panel can show progress and degrade
 *  without breaking the map. */

import type { GeoJSONSource, Map as MaplibreMap } from "maplibre-gl";
import { BIG_LAYERS, INDONESIA_BBOX, KLHK_LAYERS } from "./config";
import { loadBigLayer, type BigLayerResult, type PeatFC } from "./big";
import { customSpecs, type CustomLayerSpec } from "../layers/custom";
import { useLayersStore } from "../store/layers";

interface LazyLayer {
  /** registry layer id */
  id: string;
  /** map source id to push the GeoJSON into */
  sourceId: string;
  load(): Promise<BigLayerResult>;
}

/** A thunk rather than a spec, so a user-added layer — which may not be an
 *  ArcGIS service at all — can join the same machinery. */
const BUILTIN: LazyLayer[] = [
  { id: "peat-extent", sourceId: "peat-extent", load: () => loadBigLayer(BIG_LAYERS.peatland) },
  { id: "peat-khg", sourceId: "khg", load: () => loadBigLayer(BIG_LAYERS.khg) },
  {
    id: "peat-function",
    sourceId: "peat-function",
    load: () => loadBigLayer(BIG_LAYERS.peatFunction),
  },
  {
    id: "fire-hazard",
    sourceId: "fire-hazard",
    load: () => loadBigLayer(BIG_LAYERS.fireHazard),
  },
  {
    id: "forest-estate",
    sourceId: "forest-estate",
    load: () => loadBigLayer(KLHK_LAYERS.forestEstate),
  },
  {
    id: "forest-release",
    sourceId: "forest-release",
    load: () => loadBigLayer(KLHK_LAYERS.forestRelease),
  },
  {
    id: "forest-village",
    sourceId: "forest-village",
    load: () => loadBigLayer(KLHK_LAYERS.villageForest),
  },
  {
    id: "forest-htr",
    sourceId: "forest-htr",
    load: () => loadBigLayer(KLHK_LAYERS.communityForest),
  },
];

/** Cap on a user-added ArcGIS layer. Nothing here knows how big the layer is
 *  before it starts — a count query on a large service can itself take a
 *  minute — so the cap bounds the damage and the existing "partial coverage"
 *  note tells the truth when it bites. Image mode is the answer for anything
 *  bigger, and it is what the add dialog offers first. */
const CUSTOM_MAX_FEATURES = 20000;

/** A plain GeoJSON URL. No paging and no bbox filter: whatever is at the URL is
 *  what the layer is. */
async function loadGeojsonUrl(url: string): Promise<BigLayerResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const fc = (await res.json()) as PeatFC;
  if (!Array.isArray(fc?.features)) throw new Error("not a FeatureCollection");
  return { fc, truncated: false };
}

function customLoader(spec: CustomLayerSpec): () => Promise<BigLayerResult> {
  if (spec.kind === "geojson") return () => loadGeojsonUrl(spec.url);
  return () =>
    loadBigLayer({
      service: spec.url,
      layerId: spec.layerId ?? 0,
      // A custom layer has no curated field list and its popup is generic, so
      // take everything the service will give.
      outFields: ["*"],
      pageSize: spec.pageSize,
      maxFeatures: CUSTOM_MAX_FEATURES,
      // Custom services are queried over the same national envelope as the
      // built-ins; a world-wide layer would otherwise page forever.
      bbox: INDONESIA_BBOX,
    });
}

/** Built-in lazy layers plus the user's own. Rebuilt per call because the
 *  custom set changes at runtime; it is a handful of objects. */
export function lazyLayers(): LazyLayer[] {
  const custom = customSpecs()
    .filter((s) => s.kind === "arcgis-vector" || s.kind === "geojson")
    .map((s) => ({ id: s.id, sourceId: s.id, load: customLoader(s) }));
  return custom.length ? [...BUILTIN, ...custom] : BUILTIN;
}

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

/** Gazetted forest estate (KEHUTANAN layer 0) once loaded — backs the forest
 *  status chart and the fires-inside-the-estate tile. See lib/forest.ts. */
export function getForestEstate(): PeatFC | null {
  return loaded.get("forest-estate") ?? null;
}

/** Push any loaded data into sources that don't have it yet. Idempotent and
 *  cheap: it only calls setData when the source exists and is stale. */
export function applyRemoteData(map: MaplibreMap): void {
  for (const entry of lazyLayers()) {
    const fc = loaded.get(entry.id);
    if (!fc) continue;
    const src = map.getSource(entry.sourceId) as GeoJSONSource | undefined;
    if (!src || appliedTo.get(src) === fc) continue;
    src.setData(fc);
    appliedTo.set(src, fc);
  }
}

/** Fetch a lazy layer's data and push it into its map source. Idempotent. */
export function ensureLayerData(map: MaplibreMap, id: string): void {
  const entry = lazyLayers().find((b) => b.id === id);
  if (!entry || started.has(id)) return;
  started.add(id);

  const { setAvailability, setPeatLoaded, setForestLoaded } =
    useLayersStore.getState();
  setAvailability(id, "checking", "loading…");

  entry
    .load()
    .then(({ fc, truncated }) => {
      loaded.set(id, fc);
      applyRemoteData(map);
      // Still usable when truncated, so it stays "ok" — but the panel says the
      // coverage is partial rather than implying the whole country is drawn.
      setAvailability(id, "ok", truncated ? "partial coverage" : undefined);
      if (id === "peat-extent") setPeatLoaded(fc.features.length);
      if (id === "forest-estate") setForestLoaded(fc.features.length);
    })
    .catch((err) => {
      console.warn(`[agni] layer ${id} data failed`, err);
      setAvailability(
        id,
        "unavailable",
        err instanceof Error && err.message.length < 40
          ? err.message
          : "source unreachable",
      );
      started.delete(id); // allow a retry on the next toggle
    });
}
