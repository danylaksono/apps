"use strict";
/* Colour tokens, scales and Chart.js helpers. Values mirror the CSS custom properties in style.css. */

const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
};

// Diverging (dry/red <- neutral -> wet/blue) and sequential-red (share below -40 cm), selected per theme.
const RAMPS = {
  div: {
    light: ["#8f1d1d", "#d03b3b", "#f1a79f", "#f0efec", "#9ec5f4", "#2a78d6", "#104281"],
    dark: ["#ffb4ad", "#e66767", "#8a3a3a", "#383835", "#27578f", "#3987e5", "#9ec5f4"],
  },
  seq: {
    light: ["#f0efec", "#f6cdc7", "#e66767", "#d03b3b", "#7d1f1f"],
    dark: ["#2c2c2a", "#5e2f2f", "#a94444", "#e66767", "#ffb4ad"],
  },
  blue: {
    light: ["#cde2fb", "#6da7ec", "#2a78d6", "#104281"],
    dark: ["#184f95", "#2a78d6", "#6da7ec", "#cde2fb"],
  },
};

const hexCache = {};
const hex = (h) => hexCache[h] || (hexCache[h] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16)));
function lerpColor(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i, a = hex(stops[i]), b = hex(stops[i + 1]);
  return `rgb(${[0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)).join(",")})`;
}
const stops = (name) => RAMPS[name][isDark() ? "dark" : "light"];

/** Diverging colour around `center` with half-range `span`; higher = wetter = blue. */
function divColor(v, center, span) {
  if (v !== v) return css("--empty");
  return lerpColor(stops("div"), 0.5 + (v - center) / (2 * span));
}
function seqColor(v, lo, hi, ramp = "seq") {
  if (v !== v) return css("--empty");
  return lerpColor(stops(ramp), (v - lo) / (hi - lo));
}
const gradient = (name) => `linear-gradient(90deg,${stops(name).join(",")})`;

// status-like level classes (concession statuses break at -40 and -80 cm)
const CLASSES = [
  { k: "ok", label: "≥ −40 cm", tok: "--good" },
  { k: "mid", label: "−40 to −80 cm", tok: "--serious" },
  { k: "bad", label: "< −80 cm", tok: "--critical" },
];
const classColor = (v) => (v !== v ? css("--empty") : css(CLASSES[v >= THRESH ? 0 : v >= -80 ? 1 : 2].tok));
const kindColor = (k) => css(k === "community" ? "--kind-comm" : "--kind-conc");

/* ---------- Chart.js ---------- */

// dashed horizontal reference line, e.g. the -40 cm limit or the zero line
const refLine = (y, label) => ({
  id: "ref" + y,
  afterDatasetsDraw(c) {
    const sc = c.scales.y; if (!sc || y < sc.min || y > sc.max) return;
    const g = c.ctx, py = sc.getPixelForValue(y), { left, right } = c.chartArea;
    g.save(); g.strokeStyle = css("--text-secondary"); g.fillStyle = css("--text-secondary"); g.setLineDash([5, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(left, py); g.lineTo(right, py); g.stroke(); g.setLineDash([]); g.font = "11px system-ui"; g.textAlign = "right";
    if (label) g.fillText(label, right - 4, py - 4);
    g.restore();
  },
});
// vertical cursor at a given x index (used on the map's time series)
const cursorLine = (getIdx) => ({
  id: "cursor",
  afterDatasetsDraw(c) {
    const i = getIdx(); if (i == null || i < 0) return;
    const x = c.scales.x.getPixelForValue(i), { top, bottom } = c.chartArea, g = c.ctx;
    g.save(); g.strokeStyle = css("--text-primary"); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke(); g.restore();
  },
});

function chart(id, cfg) {
  if (S.charts[id]) S.charts[id].destroy();
  Chart.defaults.color = css("--text-muted"); Chart.defaults.borderColor = css("--grid");
  Chart.defaults.font.family = "system-ui, 'Segoe UI', sans-serif";
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, cfg.options);
  const sc = cfg.options.scales = cfg.options.scales || {};
  for (const k of Object.keys(sc)) sc[k].grid = Object.assign({ color: css("--grid") }, sc[k].grid);
  S.charts[id] = new Chart($(id), cfg);
  return S.charts[id];
}
const xTicks = { ticks: { maxTicksLimit: 8, autoSkip: true, maxRotation: 0 } };
const legendOpts = { position: "bottom", labels: { boxWidth: 12, boxHeight: 12, usePointStyle: false, filter: (it) => !it.text.startsWith("_") } };
const line = (label, data, color, extra) => Object.assign({ type: "line", label, data, borderColor: color, backgroundColor: color, pointRadius: 0, borderWidth: 2, tension: 0, spanGaps: false }, extra);

/* ---------- hover tip ---------- */

function tip(e, html) {
  let t = $("tip");
  if (!t) { t = document.createElement("div"); t.id = "tip"; t.className = "tip"; document.body.appendChild(t); }
  if (!e) { t.style.display = "none"; return; }
  t.style.display = "block"; t.innerHTML = html;
  t.style.left = Math.min(e.clientX + 14, innerWidth - t.offsetWidth - 8) + "px"; t.style.top = e.clientY + 14 + "px";
}

/** inline SVG sparkline for a weekly series */
function sparkline(series, color, w = 90, h = 22, ref = 0) {
  const ys = S.weeks.map((k) => series[k]).filter((v) => v === v);
  if (ys.length < 2) return "";
  const lo = Math.min(...ys, ref), hi = Math.max(...ys, ref), sy = (v) => h - 2 - (v - lo) / (hi - lo || 1) * (h - 4);
  let d = "", pen = false;
  S.weeks.forEach((k, i) => { const v = series[k]; if (v !== v) { pen = false; return; } d += `${pen ? "L" : "M"}${(i / (S.weeks.length - 1) * (w - 2) + 1).toFixed(1)},${sy(v).toFixed(1)}`; pen = true; });
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><line x1="0" x2="${w}" y1="${sy(ref)}" y2="${sy(ref)}" stroke="${css("--text-muted")}" stroke-dasharray="1 2"/><path d="${d}" fill="none" stroke="${color}" stroke-width="1.6"/></svg>`;
}
