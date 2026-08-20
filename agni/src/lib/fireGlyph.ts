/** The fire glyph: one donut, drawn the same way wherever it appears.
 *
 *  Ported from https://observablehq.com/@danylaksono/custom-glyph-maps-for-maplibre
 *  — a canvas donut attached as a MapLibre Marker, sized by total and split by
 *  class. The notebook splits earthquakes by magnitude; this splits detections
 *  by fire radiative power, which is the same idea and the more decision-useful
 *  variable here.
 *
 *  One function serves both the cluster glyphs and the province glyphs, so the
 *  two are readable against each other: a ring is a ring at any aggregation.
 *  Only the anchor differs — a cluster sits where the cluster is, a province
 *  glyph at the mean position of its own detections.
 *
 *  What is encoded, kept to what survives at 30–68 px:
 *    - radius and the centre number: how many detections
 *    - ring composition: how that total splits across FRP classes
 *    - inner arc: the share detected on the night overpass, and only on glyphs
 *      big enough to carry a second ring
 *  Everything else — total FRP, the leading kabupaten, when the detections
 *  actually happened — goes in the popup, where there is room to read it. */

/** FRP class breaks in MW. Chosen off the national distribution — median 4.9,
 *  p95 26.1, max 538 — so the classes actually divide the data rather than
 *  putting 95% of detections in one bucket. */
export const FRP_BREAKS = [1, 5, 20, 50] as const;

/** The notebook's YlOrRd. Semantic heat: monotone in lightness, and the one
 *  multi-hue sequential ramp that is conventional for fire intensity. Ships
 *  with a scale legend, which is the condition for using it. */
export const FRP_COLORS = [
  "#fed976",
  "#feb24c",
  "#fd8d3c",
  "#fc4e2a",
  "#e31a1c",
] as const;

export const FRP_LABELS = [
  "< 1 MW",
  "1–5",
  "5–20",
  "20–50",
  "≥ 50",
] as const;

/** Index of the FRP class a detection falls in. */
export function frpClass(frp: number): number {
  for (let i = 0; i < FRP_BREAKS.length; i++) {
    if (frp < FRP_BREAKS[i]) return i;
  }
  return FRP_BREAKS.length;
}

export interface GlyphData {
  /** detections per FRP class, low to high */
  counts: number[];
  total: number;
  /** share of detections from the night overpass, 0–1. Night burning is the
   *  smouldering-peat signature rather than the daytime clearing one, so it is
   *  worth a channel of its own. */
  nightShare?: number;
}

/** Radius by total, in CSS pixels. Stepped rather than continuous, as in the
 *  notebook: a handful of sizes stays legible where a smooth scale turns every
 *  glyph into a slightly different blob. */
function radiusFor(total: number): number {
  if (total >= 1000) return 34;
  if (total >= 100) return 26;
  if (total >= 10) return 20;
  return 15;
}

/** Colour of the night-share arc. Deliberately outside the FRP ramp — it is a
 *  different variable and must not read as another intensity class. */
const NIGHT_ARC = "#8ab4f8";

function segment(
  ctx: CanvasRenderingContext2D,
  start: number,
  end: number,
  r: number,
  r0: number,
  color: string,
): void {
  if (end - start === 1) end -= 0.00001;
  const a0 = 2 * Math.PI * (start - 0.25);
  const a1 = 2 * Math.PI * (end - 0.25);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r, r);
  ctx.arc(r, r, r, a0, a1);
  ctx.lineTo(r + r0 * Math.cos(a1), r + r0 * Math.sin(a1));
  ctx.arc(r, r, r0, a1, a0, true);
  ctx.closePath();
  ctx.fill();
}

const SURFACE = "#0b0f14";
const INK = "#d5dce4";

/** Draw the glyph. Rendered at devicePixelRatio so it stays crisp, then sized
 *  back down in CSS — a canvas marker is otherwise soft on a retina screen. */
export function drawFireGlyph(data: GlyphData): HTMLCanvasElement {
  const { counts, total } = data;
  const r = radiusFor(total);
  const r0 = Math.round(r * 0.62);
  const w = r * 2;
  const dpr = Math.min(3, globalThis.devicePixelRatio || 1);

  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = w * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${w}px`;
  canvas.style.cursor = "pointer";
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.scale(dpr, dpr);

  const sum = counts.reduce((a, b) => a + b, 0) || 1;
  let offset = 0;
  for (let i = 0; i < counts.length; i++) {
    if (counts[i] > 0) {
      segment(ctx, offset / sum, (offset + counts[i]) / sum, r, r0, FRP_COLORS[i]);
    }
    offset += counts[i];
  }

  // Centre disc in the map's own ground colour rather than white: the ring is
  // the only thing that should carry colour, and a white puck punches a hole
  // in a dark basemap.
  ctx.fillStyle = SURFACE;
  ctx.beginPath();
  ctx.arc(r, r, r0, 0, 2 * Math.PI);
  ctx.fill();

  // Night share as a thin arc just inside the ring, and only where there is
  // room for it — on the smallest glyphs a second ring is noise, so those stay
  // single-channel rather than illegible.
  const night = data.nightShare ?? 0;
  if (r >= 20 && night > 0) {
    const ri = r0 - 3.5;
    ctx.strokeStyle = NIGHT_ARC;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "butt";
    ctx.beginPath();
    ctx.arc(r, r, ri, -Math.PI / 2, -Math.PI / 2 + night * 2 * Math.PI);
    ctx.stroke();
  }

  // Smaller than the notebook's: the count is a label on the glyph, not the
  // glyph itself, and an oversized number fights the ring it sits inside.
  const label =
    total >= 10000
      ? `${Math.round(total / 1000)}k`
      : total >= 1000
        ? `${(total / 1000).toFixed(1)}k`
        : String(total);
  ctx.fillStyle = INK;
  ctx.font = `600 ${r >= 34 ? 11 : r >= 26 ? 10 : r >= 20 ? 9 : 8}px Inter, ui-sans-serif, system-ui, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, r, r);

  return canvas;
}

/** Tally a set of detections into glyph counts. */
export function tally(
  features: { properties?: Record<string, unknown> | null }[],
): GlyphData & { frpMw: number; day: number; night: number } {
  const counts = new Array(FRP_COLORS.length).fill(0);
  let frpMw = 0;
  let day = 0;
  let night = 0;
  for (const f of features) {
    const frp = Number(f.properties?.frp) || 0;
    counts[frpClass(frp)] += 1;
    frpMw += frp;
    if (String(f.properties?.daynight) === "N") night += 1;
    else day += 1;
  }
  return {
    counts,
    total: features.length,
    nightShare: features.length ? night / features.length : 0,
    frpMw: Math.round(frpMw),
    day,
    night,
  };
}

/** Detection times as a small area sparkline.
 *
 *  The user asked when the detections in an aggregate actually happened, and a
 *  count alone cannot say whether 400 detections were one afternoon's clearing
 *  or five days of steady smouldering. Bins span the data's own range, so it
 *  reads the same whatever the filter window is set to. */
export function sparklineSvg(
  times: number[],
  color: string,
  width = 220,
  height = 34,
): string {
  if (times.length < 2) return "";
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  if (!(hi > lo)) return "";
  const BINS = 14;
  const bins = new Array(BINS).fill(0);
  for (const t of times) {
    const i = Math.min(BINS - 1, Math.floor(((t - lo) / (hi - lo)) * BINS));
    bins[i] += 1;
  }
  const max = Math.max(...bins);
  const padY = 3;
  const x = (i: number) => (i / (BINS - 1)) * width;
  const y = (v: number) => height - padY - (v / max) * (height - padY * 2);
  const pts = bins.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const area = `M0,${height} L${pts.join(" L")} L${width},${height} Z`;
  return (
    `<svg width="100%" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="display:block">` +
    `<path d="${area}" fill="${color}" opacity="0.18"/>` +
    `<path d="M${pts.join(" L")}" fill="none" stroke="${color}" stroke-width="1.5" ` +
    `stroke-linejoin="round" stroke-linecap="round"/></svg>`
  );
}

const HOUR = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  timeZone: "Asia/Jakarta",
});

/** Endpoint labels for the sparkline, in the app's reference clock. */
export function sparklineRange(times: number[]): [string, string] | null {
  if (times.length < 2) return null;
  const lo = Math.min(...times);
  const hi = Math.max(...times);
  return [HOUR.format(new Date(lo)), HOUR.format(new Date(hi))];
}
