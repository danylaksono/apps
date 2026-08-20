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
 *    - radius and the centre number: how many detections, times the size the
 *      reader has chosen — the ladder of sizes is preserved, just scaled
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
export function drawFireGlyph(data: GlyphData, scale = 1): HTMLCanvasElement {
  const { counts, total } = data;
  const r = Math.round(radiusFor(total) * scale);
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

/** One mark per satellite overpass, on a real time axis.
 *
 *  This was an area sparkline over 14 even bins, and that was misleading twice
 *  over.
 *
 *  VIIRS SNPP is one satellite in a 13:30 sun-synchronous orbit, so it sees a
 *  given place about **twice a day** — measured over Indonesia, roughly 03–07
 *  and 15–19 UTC, with 8–9 hour voids between. A typical aggregate is built
 *  from 6–10 observations across five days, not a continuous record. Filling
 *  an area across those voids says "we looked and saw nothing" when the truth
 *  is "nobody looked". Discrete observations get discrete marks.
 *
 *  The old bins also spanned the data's own min→max, which pins the first and
 *  last bin non-empty *by construction* and manufactures a flat middle out of
 *  any sparse interior. The domain here is whole days instead, so a gap is a
 *  gap and the ends are honest.
 *
 *  Day and night passes are split because they answer different questions: a
 *  night detection is a fire still burning after the day's work stopped. */
export function overpassChartSvg(
  times: number[],
  night: boolean[],
  width = 220,
  height = 40,
): string {
  if (!times.length) return "";

  // Overpasses, not clock hours: consecutive detections more than 90 minutes
  // apart belong to different passes. Well inside the 8-hour void, and well
  // outside the couple of minutes a single swath takes to cross a cluster.
  const GAP_MS = 90 * 60 * 1000;
  const order = times.map((_, i) => i).sort((a, b) => times[a] - times[b]);
  const passes: { t: number; n: number; total: number }[] = [];
  for (const i of order) {
    const last = passes[passes.length - 1];
    if (last && times[i] - last.t < GAP_MS) {
      last.total += 1;
      if (night[i]) last.n += 1;
    } else {
      passes.push({ t: times[i], n: night[i] ? 1 : 0, total: 1 });
    }
  }

  // Snap the domain to whole days in the app's reference clock (WIB), so the
  // axis is calendar days rather than wherever the data happens to begin.
  const DAY = 86_400_000;
  const WIB = 7 * 3_600_000;
  const dayFloor = (t: number) => Math.floor((t + WIB) / DAY) * DAY - WIB;
  const lo = dayFloor(Math.min(...times));
  const hi = dayFloor(Math.max(...times)) + DAY;
  const span = hi - lo;
  if (!(span > 0)) return "";

  const padY = 4;
  const axisY = height - 4;
  const max = Math.max(...passes.map((p) => p.total));
  const x = (t: number) => ((t - lo) / span) * width;
  const bar = (v: number) => Math.max(1.5, (v / max) * (axisY - padY));

  // Day separators, so the twice-daily rhythm is countable.
  let rules = "";
  for (let d = lo + DAY; d < hi - 1; d += DAY) {
    const dx = x(d).toFixed(1);
    rules += `<line x1="${dx}" y1="0" x2="${dx}" y2="${axisY}" stroke="var(--color-ink-700)" stroke-width="1"/>`;
  }

  const W = 5;
  const marks = passes
    .map((p) => {
      const bh = bar(p.total);
      const cx = Math.min(width - W / 2, Math.max(W / 2, x(p.t)));
      const left = (cx - W / 2).toFixed(1);
      // The night share stacks on top in the glyph's night blue, with a 1px
      // gap so the two segments read as separate marks.
      const nh = p.total ? (p.n / p.total) * bh : 0;
      const dh = bh - nh;
      return (
        `<rect x="${left}" y="${(axisY - dh).toFixed(1)}" width="${W}" height="${dh.toFixed(1)}" fill="${FRP_COLORS[3]}" rx="1"/>` +
        (nh > 1.5
          ? `<rect x="${left}" y="${(axisY - bh).toFixed(1)}" width="${W}" height="${(nh - 1).toFixed(1)}" fill="${NIGHT_ARC}" rx="1"/>`
          : "")
      );
    })
    .join("");

  return (
    `<svg width="100%" viewBox="0 0 ${width} ${height}" style="display:block">` +
    rules +
    `<line x1="0" y1="${axisY}" x2="${width}" y2="${axisY}" stroke="var(--color-ink-700)" stroke-width="1"/>` +
    marks +
    `</svg>`
  );
}

/** Detections per pass, in time order. Same 90-minute rule the chart uses. */
function passSizes(times: number[]): number[] {
  if (!times.length) return [];
  const GAP_MS = 90 * 60 * 1000;
  const sorted = [...times].sort((a, b) => a - b);
  const sizes = [1];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] >= GAP_MS) sizes.push(1);
    else sizes[sizes.length - 1] += 1;
  }
  return sizes;
}

/** How many passes the chart drew — the caption that stops a gap being read as
 *  "the fire stopped". */
export function overpassCount(times: number[]): number {
  return passSizes(times).length;
}

/** The tallest bar's value. The chart is a sparkline with no y-axis, so
 *  without this the heights are shape only and carry no magnitude. */
export function peakPerOverpass(times: number[]): number {
  const sizes = passSizes(times);
  return sizes.length ? Math.max(...sizes) : 0;
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "Asia/Jakarta",
});

/** Axis end labels, in the app's reference clock. These name the **days the
 *  axis spans**, not the first and last detection — the chart's domain is
 *  whole days, and labelling it with the data's extent is what made the old
 *  sparkline look like it always started and ended on a peak. */
export function overpassRange(times: number[]): [string, string] | null {
  if (!times.length) return null;
  const DAY = 86_400_000;
  const WIB = 7 * 3_600_000;
  const floor = (t: number) => Math.floor((t + WIB) / DAY) * DAY - WIB;
  const lo = floor(Math.min(...times));
  const hi = floor(Math.max(...times));
  return [DAY_LABEL.format(new Date(lo)), DAY_LABEL.format(new Date(hi))];
}
