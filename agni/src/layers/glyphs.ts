/** Glyph markers: clusters and province summaries.
 *
 *  Both are DOM markers rather than map layers, because a canvas donut is not
 *  something MapLibre's style spec can draw. The bookkeeping follows the
 *  notebook this is ported from: cache markers by id, add the ones that came on
 *  screen, remove the ones that left, and rebuild on move.
 *
 *  Filter compliance is the part that needed care. MapLibre clusters at the
 *  *source*, and a layer `filter` does not reach that — a cluster would happily
 *  count detections the filters had already excluded. So the glyph source is
 *  fed data that is already filtered (see applyMapState), and re-clusters
 *  whenever the filters move. The province glyphs aggregate the same filtered
 *  set, so the two can never disagree with each other or with the dots. */

import {
  Marker,
  Popup,
  type GeoJSONSource,
  type Map as MaplibreMap,
} from "maplibre-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import {
  FRP_COLORS,
  FRP_LABELS,
  drawFireGlyph,
  frpClass,
  sparklineRange,
  sparklineSvg,
  tally,
  type GlyphData,
} from "../lib/fireGlyph";

export const GLYPH_SOURCE = "fire-glyphs";
export const GLYPH_LAYER = "fire-glyphs";

/** How the glyphs aggregate. One at a time: the two are different summaries of
 *  the same detections, and drawn together they overlap and invite the reader
 *  to add them up. */
export type GlyphMode = "cluster" | "province";

/** Per-class counters MapLibre accumulates while clustering, mirroring the
 *  notebook's mag1..mag5. Built from the same breaks the glyph draws with, so
 *  the ring can never drift from the classification. */
export function clusterProperties(): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  FRP_COLORS.forEach((_, i) => {
    const frp = ["coalesce", ["get", "frp"], 0];
    const lo = i === 0 ? null : breakAt(i - 1);
    const hi = i === FRP_COLORS.length - 1 ? null : breakAt(i);
    const conditions: unknown[] = ["all"];
    if (lo !== null) conditions.push([">=", frp, lo]);
    if (hi !== null) conditions.push(["<", frp, hi]);
    props[`frp${i}`] = ["+", ["case", conditions, 1, 0]];
  });
  return props;
}

function breakAt(i: number): number {
  return [1, 5, 20, 50][i];
}

function glyphFromCluster(props: Record<string, unknown>): GlyphData {
  const counts = FRP_COLORS.map((_, i) => Number(props[`frp${i}`]) || 0);
  return { counts, total: counts.reduce((a, b) => a + b, 0) };
}

function row(label: string, value: string): string {
  return `<div class="hz-row"><p class="hz-label">${label}</p><p class="hz-value">${value}</p></div>`;
}

/** The class breakdown, identical in both popups — the ring in words. */
function barsHtml(counts: number[]): string {
  const bars = counts
    .map((n, i) =>
      n
        ? `<div style="display:flex;align-items:center;gap:6px">
             <span style="width:8px;height:8px;border-radius:2px;background:${FRP_COLORS[i]}"></span>
             <span class="hz-sub" style="flex:1">${FRP_LABELS[i]}</span>
             <span class="hz-sub">${n.toLocaleString()}</span>
           </div>`
        : "",
    )
    .join("");
  return `<div class="hz-row"><p class="hz-label">By fire radiative power</p>${bars}</div>`;
}

const LOADING = `<div class="hz-row"><p class="hz-sub">reading detections…</p></div>`;

/** The full popup body: figures, when they happened, then the class split.
 *  Identical for a cluster and a province — the aggregation differs, what you
 *  can ask of it does not. */
function detailHtml(
  title: string,
  t: ReturnType<typeof tally>,
  features: Feature[],
  extra?: string,
): string {
  const times = features
    .map((f) => Number(f.properties?.ts) || 0)
    .filter(Boolean);
  const spark = sparklineSvg(times, FRP_COLORS[3]);
  const range = sparklineRange(times);
  const timing = spark
    ? `<div class="hz-row"><p class="hz-label">Detections over time</p>${spark}` +
      (range
        ? `<div style="display:flex;justify-content:space-between"><span class="hz-sub">${range[0]}</span><span class="hz-sub">${range[1]}</span></div>`
        : "") +
      `</div>`
    : "";
  return (
    headHtml(title, t.total) +
    row("Total FRP", `${t.frpMw.toLocaleString()} MW`) +
    row(
      "Day / night",
      `${t.day.toLocaleString()} / ${t.night.toLocaleString()}`,
    ) +
    (extra ?? "") +
    timing +
    barsHtml(t.counts)
  );
}

function headHtml(title: string, total: number): string {
  return (
    `<div class="hz-row"><p class="hz-label">${title}</p>` +
    `<p class="hz-value">${total.toLocaleString()} detections</p></div>`
  );
}

interface MarkerSet {
  markers: Record<string, Marker>;
  onScreen: Record<string, Marker>;
}

const clusters: MarkerSet = { markers: {}, onScreen: {} };
const provinces: MarkerSet = { markers: {}, onScreen: {} };

function clearSet(set: MarkerSet): void {
  for (const id in set.onScreen) set.onScreen[id].remove();
  set.markers = {};
  set.onScreen = {};
}

function swap(set: MarkerSet, next: Record<string, Marker>, map: MaplibreMap) {
  for (const id in next) if (!set.onScreen[id]) next[id].addTo(map);
  for (const id in set.onScreen) if (!next[id]) set.onScreen[id].remove();
  set.onScreen = next;
}

/** Size multiplier for the glyphs.
 *
 *  The panel's slider drives this rather than opacity: these are DOM markers,
 *  so MapLibre paint properties never reach them, and a canvas donut is opaque
 *  by construction — size is the dimension actually worth a control. A glyph
 *  that reads at street zoom is a speck across the archipelago.
 *
 *  Changing it has to rebuild the markers, because the size is baked into the
 *  canvas at draw time. Dropping the cache is enough: the sync pass that runs
 *  straight after redraws whatever is on screen. */
let glyphScale = 1;

export function setGlyphScale(value: number): boolean {
  if (value === glyphScale) return false;
  glyphScale = value;
  clearSet(clusters);
  clearSet(provinces);
  return true;
}

let popup: Popup | null = null;

function showPopup(map: MaplibreMap, lngLat: [number, number], html: string) {
  popup ??= new Popup({
    closeButton: true,
    closeOnClick: true,
    maxWidth: "260px",
    className: "agni-popup",
  });
  popup.setLngLat(lngLat).setHTML(html).addTo(map);
}

/** Draw the glyphs for the selected mode, and clear the other one.
 *
 *  Single entry point so the two can never both be on screen: they are
 *  different summaries of the same detections, and side by side they overlap
 *  and invite the reader to add them together. */
export function updateGlyphs(
  map: MaplibreMap,
  opts: { visible: boolean; mode: GlyphMode; fires: FeatureCollection | null },
): void {
  const cluster = opts.visible && opts.mode === "cluster";
  const province = opts.visible && opts.mode === "province";
  updateClusterGlyphs(map, cluster);
  updateProvinceGlyphs(map, opts.fires, province);
}

/** Rebuild the cluster glyphs for what is currently on screen. */
function updateClusterGlyphs(map: MaplibreMap, visible: boolean): void {
  if (!visible || !map.getSource(GLYPH_SOURCE)) {
    clearSet(clusters);
    return;
  }
  const next: Record<string, Marker> = {};
  const features = map.querySourceFeatures(GLYPH_SOURCE);
  for (const f of features) {
    const props = f.properties as Record<string, unknown>;
    if (!props?.cluster) continue;
    const id = String(props.cluster_id);
    const coords = (f.geometry as Point).coordinates as [number, number];
    let marker = clusters.markers[id];
    if (!marker) {
      const data = glyphFromCluster(props);
      const el = drawFireGlyph(data, glyphScale);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        // Pull the cluster's actual member detections rather than reporting
        // only what clusterProperties happened to accumulate. That is what
        // lets a cluster popup carry the same figures — and the same
        // sparkline — as a province one.
        const src = map.getSource(GLYPH_SOURCE) as GeoJSONSource;
        showPopup(map, coords, headHtml("Cluster", data.total) + LOADING);
        void src
          .getClusterLeaves(Number(props.cluster_id), data.total, 0)
          .then((leaves) => {
            const t = tally(leaves);
            showPopup(map, coords, detailHtml("Cluster", t, leaves));
          })
          .catch(() => {
            showPopup(
              map,
              coords,
              headHtml("Cluster", data.total) + barsHtml(data.counts),
            );
          });
      });
      marker = clusters.markers[id] = new Marker({ element: el }).setLngLat(
        coords,
      );
    }
    next[id] = marker;
  }
  swap(clusters, next, map);
}

/** One glyph per province, anchored at the mean position of its own
 *  detections. Deliberately not a polygon centroid: the glyph belongs where the
 *  fires are, and for a province like Sulawesi Tengah a centroid can land in
 *  the sea nowhere near them. */
function updateProvinceGlyphs(
  map: MaplibreMap,
  fires: FeatureCollection | null,
  visible: boolean,
): void {
  if (!visible || !fires) {
    clearSet(provinces);
    return;
  }
  const byProvince = new Map<string, Feature[]>();
  for (const f of fires.features) {
    const name = String(f.properties?.provinsi ?? "");
    if (!name) continue;
    const list = byProvince.get(name);
    if (list) list.push(f);
    else byProvince.set(name, [f]);
  }

  const next: Record<string, Marker> = {};
  for (const [name, list] of byProvince) {
    const t = tally(list);
    let lon = 0;
    let lat = 0;
    for (const f of list) {
      const c = (f.geometry as Point).coordinates;
      lon += c[0];
      lat += c[1];
    }
    const at: [number, number] = [lon / list.length, lat / list.length];

    // Rebuilt whenever the tally changes, which is what makes these follow the
    // filters; the key carries the total so a stale glyph cannot survive.
    const id = `${name}|${t.total}`;
    let marker = provinces.markers[id];
    if (!marker) {
      const el = drawFireGlyph(t, glyphScale);
      const top = topKabupaten(list);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        showPopup(
          map,
          at,
          detailHtml(
            name,
            t,
            list,
            top ? row("Most affected kabupaten", top) : undefined,
          ),
        );
      });
      marker = provinces.markers[id] = new Marker({ element: el }).setLngLat(at);
    }
    next[id] = marker;
  }
  // Drop cached markers for tallies that no longer exist, or the cache grows
  // by one entry per filter change for the whole session.
  for (const id in provinces.markers) {
    if (!next[id]) delete provinces.markers[id];
  }
  swap(provinces, next, map);
}

function topKabupaten(list: Feature[]): string | null {
  const counts = new Map<string, number>();
  for (const f of list) {
    const k = String(f.properties?.kabkota ?? "");
    if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of counts) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best ? `${best[0]} · ${best[1].toLocaleString()}` : null;
}

/** Class index for a raw FRP value — re-exported so the registry legend and
 *  the cluster expressions cannot drift apart. */
export { frpClass };
