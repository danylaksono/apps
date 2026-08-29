/** OpenFreeMap vector basemaps, spliced into the running style on first use.
 *
 *  A vector basemap is not a tile URL, it is a whole style JSON — 47 layers for
 *  Dark, 55 for Positron, all drawn from one `openmaptiles` vector source.
 *  Handing that to map.setStyle would throw away every overlay, source and
 *  protocol the app has built up and force the whole registry to be re-applied,
 *  which is exactly the churn the raster basemaps were arranged to avoid. So
 *  instead the style is fetched once, its layer ids are prefixed (both styles
 *  own a layer called `water`), and the layers are inserted underneath the
 *  overlays. Switching basemap then stays what it always was: a visibility
 *  toggle.
 *
 *  Every OFM style declares the same two sources at the same URLs — the planet
 *  vector tiles and the Natural Earth shaded relief raster — so they are added
 *  once under `ofm-*` ids and shared. One tile cache serves every style, and
 *  switching between two vector basemaps costs no network at all. */

import type {
  LayerSpecification,
  Map as MaplibreMap,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import {
  basemapSourceId,
  isBasemapLayer,
  type VectorBasemapDef,
} from "./basemaps";

const SOURCE_PREFIX = "ofm-";

interface MapBasemaps {
  /** Injected layer ids per basemap id, in draw order. */
  injected: Map<string, string[]>;
  loading: Set<string>;
  /** Set once the map is on its way out. A fetch in flight outlives the map
   *  that started it — StrictMode alone mounts, tears down and remounts — and
   *  every MapLibre getter on a removed map warns. */
  cancelled: boolean;
}

/** Per map instance, so a remount (React StrictMode, or a hot reload) starts
 *  from a clean slate rather than believing it already injected into a style
 *  that no longer exists. */
const perMap = new WeakMap<MaplibreMap, MapBasemaps>();

function stateFor(map: MaplibreMap): MapBasemaps {
  let s = perMap.get(map);
  if (!s) {
    s = { injected: new Map(), loading: new Set(), cancelled: false };
    perMap.set(map, s);
  }
  return s;
}

/** Bumped whenever a basemap's layers land. The applier folds this into its
 *  "already applied" key, so a basemap that finished loading after the store
 *  last changed still gets its visibility set. */
let revision = 0;

export function vectorBasemapRevision(): number {
  return revision;
}

/** The layers a vector basemap owns, or empty if it has not loaded yet. */
export function vectorBasemapLayerIds(
  map: MaplibreMap,
  id: string,
): string[] {
  return perMap.get(map)?.injected.get(id) ?? [];
}

/** apply.ts reorders the overlays by moving them to the top of the stack, but
 *  only when the set of present overlays changes — a basemap that loads in
 *  between would otherwise land on top of them and stay there. Anchor the
 *  splice to the lowest non-basemap layer instead. */
function firstOverlayId(map: MaplibreMap): string | undefined {
  for (const layer of map.getStyle().layers) {
    if (!isBasemapLayer(layer.id)) return layer.id;
  }
  return undefined;
}

function styleReady(map: MaplibreMap): Promise<void> {
  if (map.isStyleLoaded()) return Promise.resolve();
  return new Promise((resolve) => map.once("load", () => resolve()));
}

async function inject(map: MaplibreMap, def: VectorBasemapDef): Promise<void> {
  const state = stateFor(map);
  const res = await fetch(def.styleUrl);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const style = (await res.json()) as StyleSpecification;
  if (state.cancelled) return;
  await styleReady(map);
  // A style that never finished loading resolves nothing; the map going away
  // is the other way out of that wait.
  if (state.cancelled || state.injected.has(def.id)) return;

  for (const [name, spec] of Object.entries(style.sources ?? {})) {
    const sourceId = SOURCE_PREFIX + name;
    if (map.getSource(sourceId)) continue;
    // The style JSON carries no attribution of its own; OFM's terms want the
    // credit, and hanging it on the source means the control shows it exactly
    // while a layer using the source is on screen.
    map.addSource(sourceId, {
      ...spec,
      attribution: def.attribution,
    } as SourceSpecification);
  }

  const before = firstOverlayId(map);
  const ids: string[] = [];
  for (const layer of style.layers ?? []) {
    const spec = {
      ...layer,
      id: `${basemapSourceId(def.id)}--${layer.id}`,
      // Hidden on arrival; the applier turns on whichever basemap is selected
      // by then, which is not necessarily this one.
      layout: { ...("layout" in layer ? layer.layout : {}), visibility: "none" },
    } as LayerSpecification;
    if ("source" in spec && spec.source) spec.source = SOURCE_PREFIX + spec.source;
    map.addLayer(spec, before);
    ids.push(spec.id);
  }

  state.injected.set(def.id, ids);
  revision += 1;
}

/** Load a vector basemap into the style if it is not there yet. Fire and
 *  forget: `onReady` is called once its layers are in, so the caller can run
 *  the applier again and light up the one the user actually asked for. */
export function ensureVectorBasemap(
  map: MaplibreMap,
  def: VectorBasemapDef,
  onReady: () => void,
): void {
  const state = stateFor(map);
  if (state.injected.has(def.id) || state.loading.has(def.id)) return;
  state.loading.add(def.id);
  inject(map, def)
    .then(() => {
      if (!state.cancelled) onReady();
    })
    .catch((err) => {
      console.warn(`[agni] basemap ${def.id} failed to load`, err);
    })
    // Cleared either way: a failed fetch should be retried the next time the
    // user picks this basemap, not remembered as permanently broken.
    .finally(() => state.loading.delete(def.id));
}

/** Called when the map is being torn down: anything still in flight stops
 *  before it touches a map that no longer has a style. */
export function cancelVectorBasemaps(map: MaplibreMap): void {
  const state = perMap.get(map);
  if (state) state.cancelled = true;
}
