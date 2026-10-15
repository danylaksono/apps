"use strict";
/* Map tab. One surface at a time (contour, hexbin, KHG / regency / province / concession polygons) plus
   independent overlays (stations, Gi* hotspots, province lines, KHG outlines), all coloured by a weekly metric. */

const M = { map: null, groups: {}, poly: {}, polyIdx: {}, markers: [], ctxKey: "", ctx: null, timer: null, fitPending: true, notes: {} };
const METRICS = {
  level: { label: "Water level (cm)", unit: "cm" },
  change: { label: "Change since start (cm)", unit: "cm" },
  share: { label: "Below −40 cm", unit: "%" },
  trend: { label: "Trend (cm/week)", unit: "cm/wk", static: true },
};
const POLY_FILLS = ["khg", "adm2", "adm1", "company"];
const mFill = () => (document.querySelector("input[name=mFill]:checked") || {}).value || "none";
const isStn = (agg) => agg === "station";
const metricLabel = (c) => METRICS[c.metric].label;
const attribution = '&copy; OpenStreetMap contributors · KHG: KLHK · Admin boundaries: geoBoundaries (BPS/OCHA), CC BY 3.0 IGO';

/** Notes from the active layers, keyed so each layer can refresh its own line. */
function note(k, t) { M.notes[k] = t; $("mNote").textContent = Object.values(M.notes).filter(Boolean).join(" "); }

function initMap() {
  M.map = L.map("map", { preferCanvas: true, zoomSnap: 0.5 }).setView([-1, 111], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution, opacity: 0.55 }).addTo(M.map);
  for (const [n, z] of [["regions", 420], ["lines", 440], ["stations", 460]]) { M.map.createPane(n).style.zIndex = z; }
  M.map.getPane("lines").style.pointerEvents = "none";
  M.regionRenderer = L.canvas({ pane: "regions", padding: 0.5 });
  M.stationRenderer = M.regionRenderer;   // one canvas for polygons and stations: a separate top canvas would swallow clicks meant for the regions below
  M.stationLayer = L.layerGroup().addTo(M.map);

  // static overlays: province lines and KHG outlines
  const outline = (data, w, op) => L.geoJSON(data, { pane: "lines", renderer: L.canvas({ pane: "lines" }), interactive: false, style: () => ({ color: css("--outline"), weight: w, opacity: op, fill: false }) });
  M.outlineFn = outline;

  for (const s of S.stations) {
    if (!s.hasLoc) continue;
    const m = L.circleMarker([s.lat, s.lon], { pane: "stations", renderer: M.stationRenderer, radius: 4.5, weight: 1, color: css("--surface"), opacity: 1, fillOpacity: 1 });
    m._s = s;
    m.on("click", () => selectStation(s));
    m.bindTooltip(() => stationTip(s), { sticky: true });
    M.markers.push(m);
  }
  M.legend = L.control({ position: "bottomleft" });
  M.legend.onAdd = () => { const d = L.DomUtil.create("div", "legend"); d.id = "mLegend"; return d; };
  M.legend.addTo(M.map);
  let moveT; M.map.on("moveend", () => { clearTimeout(moveT); moveT = setTimeout(() => {
    if (S.tab !== "map") return;
    const f = mFill(); if (f === "contour") drawContour(mapCtx(), weekIdx()); else if (f === "hexbin") drawHex(mapCtx(), weekIdx());
  }, 250); });

  ["mMetric", "mStations", "mHot", "mLines", "mKhgLines", "mHexSize"].forEach((id) => $(id).addEventListener("change", () => { M.layersKey = ""; renderMap(); }));
  document.querySelectorAll("input[name=mFill]").forEach((r) => r.addEventListener("change", () => { M.layersKey = ""; renderMap(); }));
  $("mSlider").addEventListener("input", renderMap);
  $("mPlay").onclick = () => {
    if (M.timer) { clearInterval(M.timer); M.timer = null; $("mPlay").innerHTML = "&#9654; Play"; return; }
    $("mPlay").innerHTML = "&#10074;&#10074; Pause";
    M.timer = setInterval(() => { const sl = $("mSlider"); sl.value = +sl.value >= +sl.max ? 0 : +sl.value + 1; renderMap(); }, 450);
  };
}

/* ---- metric context: entities, value lookup, colour scale (cached per filter state) ---- */

function mapCtx() {
  const fill = mFill(), hot = $("mHot").checked, metric = $("mMetric").value, f = S.f;
  const key = [S.ver, fill, hot, metric, f.kind, f.adm1, f.adm2, f.khg, f.minCov, f.minN, isDark()].join("|");
  if (M.ctxKey === key) return M.ctx;
  const agg = POLY_FILLS.includes(fill) ? fill : "station", stn = agg === "station";
  const ents = stn ? S.pop : regionStats(agg);
  const stAt = { level: (e, w) => e.wk[w], change: (e, w) => e.anom[w], share: (e, w) => e.wk[w], trend: (e) => e.slope };   // per station
  const at = stn ? stAt : { level: (e, w) => e.lev.med[w], change: (e, w) => e.an.med[w], share: (e, w) => e.sh.below[w], trend: (e) => e.slope };
  // for the contour surface "share" is interpolated as 0/100 (below the limit or not)
  const valueAt = fill === "contour" && metric === "share" ? (e, w) => (e.wk[w] === e.wk[w] ? (e.wk[w] < THRESH ? 100 : 0) : NaN) : at[metric];
  // Gi* z of the station metric, per week (cached); NaN when the overlay is off
  let zOf = () => NaN;
  if (hot) {
    const g = giSetup(S.pop.filter((s) => s.hasLoc)), zc = new Map();
    zOf = (s, w) => { const k = METRICS[metric].static ? -1 : w; if (!zc.has(k)) zc.set(k, giStar(g, (x) => stAt[metric](x, w))); return zc.get(k).get(s) ?? NaN; };
  }
  // robust colour range for change / trend: 95th percentile of |value|
  let span = 1;
  if (metric === "change" || metric === "trend") {
    const a = [];
    for (const e of ents) { if (metric === "trend") a.push(Math.abs(valueAt(e))); else for (const w of S.weeks) a.push(Math.abs(valueAt(e, w))); }
    const v = a.filter((x) => x === x).sort((x, y) => x - y);
    span = Math.max(metric === "trend" ? 0.5 : 8, quant(v, 0.95) || 1);
  }
  const plain = fill === "none";   // bare stations get the status classes; every other surface uses the continuous ramps
  const color = (v) => {
    if (v !== v) return css("--empty");
    if (metric === "level") return plain ? classColor(v) : divColor(v, THRESH, 40);
    if (metric === "share") return plain ? classColor(v) : seqColor(v, 0, 100);
    return divColor(v, 0, span);
  };
  // stations keep their own scheme on every surface: status classes for level, the ramps for change / trend
  let stSpan = span;
  if (!stn && (metric === "change" || metric === "trend")) {
    const a = []; for (const s of S.pop) { if (metric === "trend") a.push(Math.abs(s.slope)); else for (const w of S.weeks) a.push(Math.abs(s.anom[w])); }
    stSpan = Math.max(metric === "trend" ? 0.5 : 8, quant(a.filter((x) => x === x).sort((x, y) => x - y), 0.95) || 1);
  }
  const stColor = (v) => (v !== v ? css("--empty") : metric === "level" || metric === "share" ? classColor(v) : divColor(v, 0, stSpan));
  M.ctxKey = key;
  return (M.ctx = { fill, agg, hot, metric, ents, valueAt, stAt, zOf, color, stColor, span, stSpan });
}

function weekIdx() { return S.weeks[+$("mSlider").value] ?? S.weeks[S.weeks.length - 1]; }

function mapValue(c, e, w) { return METRICS[c.metric].static ? c.valueAt(e) : c.valueAt(e, w); }

/* ---- polygons ---- */

function featureKey(level, p) { return level === "khg" ? p.khg_id : level === "adm2" ? p.adm2_id : level === "company" ? p.company : p.prov; }

function polyLayer(level) {
  if (M.poly[level]) return M.poly[level];
  const data = level === "company" ? companyGeo() : S.geo[level];
  if (!data) return null;
  M.polyIdx[level] = new Map();
  M.poly[level] = L.geoJSON(data, {
    pane: "regions", renderer: M.regionRenderer,
    style: () => ({ weight: 0.5, color: css("--outline"), opacity: 0.6, fillOpacity: 0.85 }),
    onEachFeature(f, layer) {
      const key = featureKey(level, f.properties);
      layer._key = key; if (!M.polyIdx[level].has(key)) M.polyIdx[level].set(key, []); M.polyIdx[level].get(key).push(layer);
      layer.on("click", () => selectRegion(level, key));
      layer.bindTooltip(() => regionTip(level, key), { sticky: true });
    },
  });
  return M.poly[level];
}

function regionTip(level, key) {
  const c = M.ctx, r = c && c.agg === level ? c.ents.find((x) => String(x.key) === String(key)) : null, info = S.info[level].get(key) || { name: String(key), parent: "" };
  if (!r) return `<b>${esc(info.name)}</b>${info.parent ? "<br>" + esc(info.parent) : ""}<br>no stations in selection`;
  const w = weekIdx(), v = mapValue(c, r, w);
  return `<b>${esc(r.name)}</b>${r.parent ? "<br>" + esc(r.parent) : ""}<br>${METRICS[c.metric].label}: <b>${fmt(v, c.metric === "trend" ? 2 : 0)}</b> ${METRICS[c.metric].unit}` +
    `<br>${r.n} stations${r.n < S.f.minN ? " (too few to show)" : ""}${c.metric === "change" || c.metric === "trend" ? `, ${r.nP} in panel` : ""}`;
}

function stationTip(s) {
  const c = M.ctx, w = weekIdx();
  const v = c ? c.stAt[c.metric](s, w) : NaN, z = c && c.hot ? c.zOf(s, w) : NaN;
  return `<b>${esc(s.name)}</b><br>${esc(s.khgName || "no KHG")} · ${esc(s.adm2 || "")}${s.company ? " · " + esc(s.company) : ""}<br>${c ? metricLabel(c) : ""}: <b>${fmt(v, c && c.metric === "trend" ? 2 : 0)}</b>` +
    (z === z ? `<br>Gi* z <b>${fmt(z, 1)}</b>${Math.abs(z) >= 1.96 ? " (significant)" : ""}` : "") +
    `<br>level now ${fmt(s.now, 0)} cm · trend ${sgn(s.slope, 2)} cm/wk`;
}

/* ---- render ---- */

function renderMap() {
  const sl = $("mSlider"), nW = S.weeks.length;
  sl.max = Math.max(0, nW - 1); if (+sl.value > +sl.max) sl.value = sl.max;
  M.map.invalidateSize();
  const c = mapCtx(), w = weekIdx(), st = METRICS[c.metric].static;
  $("mDate").textContent = st ? "whole period" : weekLabel(w);
  sl.disabled = !!st; $("mPlay").disabled = !!st;
  M.notes = {}; $("mNote").textContent = "";
  const poly = !isStn(c.agg), hot = c.hot, showSt = $("mStations").checked || hot;
  $("mHexWrap").classList.toggle("hidden", c.fill !== "hexbin");

  // layer set: rebuilt only when the surface or an overlay changes
  const lk = [c.fill, $("mLines").checked, $("mKhgLines").checked, showSt, isDark()].join("|");
  if (M.layersKey !== lk) {
    M.layersKey = lk;
    for (const k of Object.keys(M.poly)) M.map.removeLayer(M.poly[k]);
    for (const k of Object.keys(M.groups)) M.map.removeLayer(M.groups[k]);
    M.groups = {};
    if (poly) { const p = polyLayer(c.agg); p && p.addTo(M.map); }
    if ($("mKhgLines").checked && c.fill !== "khg" && S.geo.khg) M.groups.khg = M.outlineFn(S.geo.khg, 0.5, 0.45).addTo(M.map);
    if ($("mLines").checked && S.geo.adm1) M.groups.adm1 = M.outlineFn(S.geo.adm1, 0.8, 0.7).addTo(M.map);
    if (showSt) M.stationLayer.addTo(M.map); else M.map.removeLayer(M.stationLayer);
    M.stationLayer.clearLayers();
  }
  if (poly && !S.geo[c.agg]) note("geo", `Boundary file assets/geo/${c.agg}.geojson not found; run prepare_geo.py.`);
  if (poly && M.polyIdx[c.agg]) {
    const sel = S.regSel && S.regSel.level === c.agg ? String(S.regSel.key) : null;
    const byKey = new Map(c.ents.map((e) => [String(e.key), e]));
    for (const [key, layers] of M.polyIdx[c.agg]) for (const layer of layers) {
      const e = byKey.get(String(key)), v = e && e.n >= S.f.minN ? mapValue(c, e, w) : NaN, isSel = String(key) === sel;
      // polygons with data get a stroke in their own colour so small units stay visible at national zoom
      layer.setStyle(v === v
        ? { fillColor: c.color(v), fillOpacity: 0.85, weight: isSel ? 3 : 2.5, color: isSel ? css("--text-primary") : c.color(v), opacity: 1 }
        : { fillColor: css("--empty"), fillOpacity: 0.5, weight: isSel ? 3 : 0.5, color: isSel ? css("--text-primary") : css("--text-muted"), opacity: isSel ? 1 : 0.7 });
      if (isSel) layer.bringToFront();
    }
  }
  if (showSt) {
    const inPop = new Set(S.pop);
    M.stationLayer.clearLayers();
    for (const m of M.markers) {
      if (!inPop.has(m._s)) continue;
      const v = hot ? c.zOf(m._s, w) : c.stAt[c.metric](m._s, w);
      if (v !== v) continue;
      const ring = c.fill === "none" ? { color: css("--surface"), weight: 1 } : { color: css("--surface"), weight: 1.5 };   // a lighter ring keeps dots legible over a surface
      m.setStyle(hot ? { fillColor: divColor(v, 0, 3), radius: Math.abs(v) >= 1.96 ? 7 : 4.5, ...ring }
        : { fillColor: c.stColor(v), radius: c.fill === "none" ? 4.5 : 4, ...ring });
      M.stationLayer.addLayer(m);
    }
  }
  if (M.fitPending) fitMap();
  drawContour(c, w);
  drawHex(c, w);
  if (showSt) for (const m of M.markers) if (M.stationLayer.hasLayer(m)) m.bringToFront();   // keep stations above surfaces drawn after them
  if (hot) note("hot", hotNote(c, w));
  mapLegend(c, showSt);
  mapSummary(c, w);
}

function fitMap() {
  const P = S.pop.filter((s) => s.hasLoc);
  if (!P.length) return;
  M.fitPending = false;
  // 3rd..97th percentile of coordinates, so a few remote stations do not zoom the map out
  const q = (a, p) => quant(a.slice().sort((x, y) => x - y), p), lat = P.map((s) => s.lat), lon = P.map((s) => s.lon);
  const [a, b] = P.length > 30 ? [0.03, 0.97] : [0, 1];
  M.map.fitBounds([[q(lat, a), q(lon, a)], [q(lat, b), q(lon, b)]], { padding: [30, 30], maxZoom: 9, animate: false });
}

function mapLegend(c, showSt) {
  const el = $("mLegend"); if (!el) return;
  const m = METRICS[c.metric], blocks = [];
  const ramp = (grey) => {
    let lo, hi, rp, mid = "";
    if (c.metric === "level") { lo = -80; hi = 0; rp = "div"; mid = `<span>−40 (limit)</span>`; }
    else if (c.metric === "share") { lo = 0; hi = 100; rp = "seq"; }
    else { lo = -c.span; hi = c.span; rp = "div"; mid = `<span>0</span>`; }
    return `<b>${m.label}</b><div class="ramp" style="background:${gradient(rp)}"></div><div class="row"><span>${sgn(lo, 0)}${c.metric === "share" ? "%" : ""}</span>${mid}<span>${c.metric === "share" ? hi + "%" : sgn(hi, c.metric === "trend" ? 1 : 0)}</span></div>` +
      (grey ? `<div class="muted">grey = no data or < ${S.f.minN} stations</div>` : "");
  };
  if (c.fill !== "none") blocks.push(ramp(c.fill !== "contour"));
  if (showSt && !c.hot && (c.fill === "none" || c.metric === "level" || c.metric === "share")) blocks.push(c.metric === "level" || c.metric === "share"
    ? `<b>Station level class</b>` + CLASSES.map((k) => `<div><i style="background:${css(k.tok)}"></i>${k.label}</div>`).join("") + `<div class="muted">grey = no data</div>`
    : ramp(false));
  if (c.hot) blocks.push(`<b>Gi* z-score of ${c.metric === "share" ? "water level" : esc(m.label.toLowerCase())}</b><div class="ramp" style="background:${gradient("div")}"></div><div class="row"><span>−3 low cluster</span><span>±1.96 = 95%</span><span>high cluster +3</span></div><div class="muted">large dot = significant · red = low values (drier, drying)</div>`);
  el.innerHTML = blocks.join('<hr class="lsep">');
  el.style.display = blocks.length ? "" : "none";
}

function mapSummary(c, w) {
  const vals = c.ents.filter((e) => (isStn(c.agg) || e.n >= S.f.minN)).map((e) => mapValue(c, e, w)).filter((v) => v === v).sort((a, b) => a - b);
  const m = METRICS[c.metric];
  const lvl = S.pop.map((s) => s.wk[w]).filter((v) => v === v);
  const below = lvl.length ? lvl.filter((v) => v < THRESH).length / lvl.length * 100 : NaN;
  $("mStats").innerHTML =
    `<dt>Stations in selection</dt><dd>${S.pop.length}</dd><dt>Reporting this week</dt><dd>${lvl.length}</dd>` +
    `<dt>Below −40 cm</dt><dd>${fmt(below, 0)}%</dd>` +
    `<dt>${isStn(c.agg) ? "Stations" : PLURAL[c.agg][0].toUpperCase() + PLURAL[c.agg].slice(1)} shown</dt><dd>${vals.length}</dd>` +
    `<dt>Median ${c.metric === "share" && isStn(c.agg) && c.fill !== "contour" ? "level, cm" : m.unit}</dt><dd>${fmt(quant(vals, 0.5), c.metric === "trend" ? 2 : 1)}</dd>` +
    `<dt>Range</dt><dd>${fmt(vals[0], 1)} … ${fmt(vals[vals.length - 1], 1)}</dd>`;
  const an = weeklySeries(S.panel, "anom", 5);
  chart("cMapTs", { type: "line", data: { labels: wkLabels(), datasets: [line("Panel median change", wkData(an.med), css("--kind-conc"), { borderWidth: 2 })] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, events: [], scales: { x: { display: false }, y: { title: { display: true, text: "cm vs start" } } } },
    plugins: [refLine(0), cursorLine(() => (METRICS[c.metric].static ? null : S.weeks.indexOf(w)))] });
}

/* ---- hexbin: stations binned on a hexagonal grid whose cell size follows the zoom level ---- */

function drawHex(c, w) {
  if (M.hex) { M.map.removeLayer(M.hex); M.hex = null; }
  if (c.fill !== "hexbin") return;
  const kx = 111.32, ky = 110.57, q3 = Math.sqrt(3);
  // circumradius in km: the chosen pixel size at the current whole zoom level, so bins stay put while panning
  const s = Math.max(2, +$("mHexSize").value * 156.543 / 2 ** Math.floor(M.map.getZoom())), bins = new Map();
  for (const st of S.pop) {
    if (!st.hasLoc) continue;
    const v0 = c.stAt[c.metric](st, w); if (v0 !== v0) continue;
    const x = st.lon * kx, y = st.lat * ky, qf = (q3 / 3 * x - y / 3) / s, rf = 2 / 3 * y / s, sf = -qf - rf;
    let rx = Math.round(qf), rz = Math.round(rf), ry = Math.round(sf);
    const dx = Math.abs(rx - qf), dy = Math.abs(ry - sf), dz = Math.abs(rz - rf);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    const k = rx + "," + rz; let b = bins.get(k); if (!b) { b = { q: rx, r: rz, v: [] }; bins.set(k, b); }
    b.v.push(c.metric === "share" ? (v0 < THRESH ? 100 : 0) : v0);
  }
  const feats = [];
  for (const b of bins.values()) {
    const n = b.v.length; if (n < S.f.minN) continue;
    const v = c.metric === "share" ? b.v.reduce((a, x) => a + x, 0) / n : median(b.v), cx = s * q3 * (b.q + b.r / 2), cy = s * 1.5 * b.r, ring = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI / 180 * (60 * (i % 6) - 30); ring.push([(cx + s * Math.cos(a)) / kx, (cy + s * Math.sin(a)) / ky]); }
    feats.push({ type: "Feature", properties: { n, v }, geometry: { type: "Polygon", coordinates: [ring] } });
  }
  M.hex = L.geoJSON({ type: "FeatureCollection", features: feats }, {
    pane: "regions", renderer: M.regionRenderer,
    style: (f) => ({ fillColor: c.color(f.properties.v), fillOpacity: 0.85, color: css("--surface"), weight: 1, opacity: 1 }),
    onEachFeature: (f, l) => l.bindTooltip(() => `<b>${f.properties.n} stations</b><br>${c.metric === "share" ? "below −40 cm" : "median " + METRICS[c.metric].label}: <b>${fmt(f.properties.v, c.metric === "trend" ? 2 : c.metric === "share" ? 0 : 1)}${c.metric === "share" ? "%" : ""}</b>`, { sticky: true }),
  }).addTo(M.map);
  note("hex", `Hexbin: ${feats.length} cells about ${Math.round(s * q3)} km across; each shows the ${c.metric === "share" ? "share of its stations below −40 cm" : "median of its stations"}. Cells with fewer than ${S.f.minN} stations are left out, and cell size follows the zoom level. Cells count stations, not area, so dense concession clusters dominate.`);
}

/* ---- selection ---- */

function selectRegion(level, key) {
  S.regSel = { level, key };
  regionCard(level, key, "mReg", "cMapReg");
  if (S.tab === "map") renderMap();
  if (S.tab === "compare") renderCompare();
}

/** Region summary card: key numbers, regional series and its most-drying stations. */
function regionCard(level, key, boxId, canvasId, withMap) {
  if (M.mini && M.mini[boxId]) { M.mini[boxId].remove(); delete M.mini[boxId]; }
  const box = $(boxId), info = S.info[level].get(key) || { name: String(key), parent: "" };
  const r = regionByKey(level, key);
  if (!r) { box.innerHTML = `<h2>${esc(info.name)}</h2><p class="muted">No stations from the current selection fall in this ${LEVELS[level].toLowerCase()}.</p>`; return; }
  const top = r.members.filter((s) => s.slope === s.slope).sort((a, b) => a.slope - b.slope).slice(0, 6);
  box.innerHTML = `<div class="reghead"><h2>${esc(r.name)}</h2><span class="muted">${LEVELS[level]}${r.parent ? " · " + esc(r.parent) : ""}</span>` +
    `${level === "company" ? "" : '<button data-act="filter">Filter to this</button>'}</div>` +
    `<dl class="kv"><dt>Stations (panel)</dt><dd>${r.n} (${r.nP})</dd><dt>Level now</dt><dd>${fmt(r.curLevel, 0)} cm</dd>` +
    `<dt>Change since start</dt><dd>${sgn(r.curChange)} cm</dd><dt>Trend</dt><dd>${sgn(r.slope, 2)} cm/wk${r.sig ? " ●" : ""}</dd>` +
    `<dt>Below −40 cm</dt><dd>${fmt(r.startBelow, 0)}% → ${fmt(r.curBelow, 0)}%</dd><dt>Stations clearly drying</dt><dd>${fmt(r.dry, 0)}%</dd></dl>` +
    (withMap ? `<div class="minimap" id="${canvasId}Map"></div><p class="muted small" style="margin:2px 0 8px">Stations in this ${LEVELS[level].toLowerCase()}, coloured by their latest level class. Click one for its detail.</p>` : "") +
    `<div class="chart" style="height:170px"><canvas id="${canvasId}"></canvas></div>` +
    `<div class="tablewrap"><table class="mini"><tr><th>Most drying stations</th><th class="num">cm/wk</th><th class="num">now</th></tr>` +
    top.map((s) => `<tr data-st="${S.stations.indexOf(s)}"><td>${esc(s.name)}</td><td class="num">${sgn(s.slope, 2)}</td><td class="num">${fmt(s.now, 0)}</td></tr>`).join("") + `</table></div>`;
  const fb = box.querySelector("[data-act=filter]"); if (fb) fb.onclick = () => applyRegionFilter(level, key);
  box.querySelectorAll("tr[data-st]").forEach((tr) => (tr.onclick = () => selectStation(S.stations[+tr.dataset.st])));
  if (withMap) regionMiniMap(level, key, r, canvasId + "Map", boxId);
  chart(canvasId, { type: "line", data: { labels: wkLabels(), datasets: [
    line("_q1", wkData(r.an.q1), "transparent", { borderWidth: 0 }),
    line("Middle 50%", wkData(r.an.q3), "transparent", { borderWidth: 0, fill: "-1", backgroundColor: css("--band") }),
    line("Median change", wkData(r.an.med), css("--kind-conc"), { borderWidth: 2 })] },
    options: { plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { title: { display: true, text: "cm vs start" } } } }, plugins: [refLine(0)] });
}

/* ---- dynamic contour surface: IDW of station values over the current view, bands via Turf.js isobands ---- */

function contourEdges(c) {
  if (c.metric === "level") return { edges: [-500, -120, -100, -80, -60, -50, -40, -30, -20, -10, 0, 10, 500], step: 10 };
  if (c.metric === "share") return { edges: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100.001], step: 10 };
  const e = []; for (let k = -4; k <= 4; k++) e.push(k * c.span / 4);
  return { edges: [-500, ...e, 500], step: c.span / 4 };
}

function drawContour(c, w) {
  if (M.contour) { M.map.removeLayer(M.contour); M.contour = null; }
  if (c.fill !== "contour") return;
  if (typeof turf === "undefined") { note("contour", "Turf.js did not load (offline?); contours unavailable."); return; }
  const t0 = performance.now(), b = M.map.getBounds().pad(0.05);
  const W = b.getWest(), E = b.getEast(), Sth = b.getSouth(), N = b.getNorth();
  const cols = 90, dx = (E - W) / (cols - 1), rows = Math.min(140, Math.max(2, Math.ceil((N - Sth) / dx) + 1));
  const R = Math.max(25, dx * 111 * 2) / 111, R2 = R * R;           // search radius in degrees (about 25 km or 2 cells)
  const px = [], py = [], pv = [];
  for (const s of S.pop) {
    if (!s.hasLoc || s.lon < W - R || s.lon > E + R || s.lat < Sth - R || s.lat > N + R) continue;
    const v = mapValue(c, s, w); if (v === v) { px.push(s.lon); py.push(s.lat); pv.push(v); }
  }
  if (px.length < 3) { note("contour", "Fewer than 3 stations with data in view."); return; }
  const feats = [], SENT = -99999;
  for (let r = 0; r < rows; r++) {
    const y = Sth + r * dx;
    for (let k = 0; k < cols; k++) {
      const x = W + k * dx; let sw = 0, sv = 0;
      for (let i = 0; i < px.length; i++) {
        const ddx = x - px[i], ddy = y - py[i], d2 = ddx * ddx + ddy * ddy;
        if (d2 > R2) continue;
        const wt = 1 / (d2 + 1e-8); sw += wt; sv += wt * pv[i];
      }
      feats.push(turf.point([x, y], { v: sw ? sv / sw : SENT }));
    }
  }
  const { edges, step } = contourEdges(c);
  const props = edges.slice(1).map((hi, i) => {
    const lo = edges[i], mid = lo <= -400 ? hi - step / 2 : hi >= 400 ? lo + step / 2 : (lo + hi) / 2;
    return { lo, hi, mid };
  });
  let out;
  try { out = turf.isobands(turf.featureCollection(feats), edges, { zProperty: "v", breaksProperties: props }); }
  catch (e) { note("contour", "Contour failed: " + e.message); return; }
  M.contour = L.geoJSON(out, {
    pane: "regions", renderer: M.regionRenderer, interactive: false,
    style: (f) => { const col = c.color(f.properties.mid); return { fillColor: col, fillOpacity: 0.72, color: col, weight: 0.6, opacity: 0.9 }; },
  }).addTo(M.map);
  note("contour", `Contour: inverse-distance weighting (power 2, radius ${Math.round(R * 111)} km) of ${px.length} stations over the visible map, ${cols}×${rows} cells, ${Math.round(performance.now() - t0)} ms. Recomputed on week, filter or pan/zoom; indicative, not a hydrological model.`);
}

/** Single-linkage clusters of [lon, lat] points: points closer than `km` end up together (a company can own sites on several islands). */
function clusterXY(xy, km) {
  const lab = xy.map((_, i) => i), find = (i) => { while (lab[i] !== i) i = lab[i] = lab[lab[i]]; return i; };
  for (let i = 0; i < xy.length; i++) for (let j = i + 1; j < xy.length; j++) {
    const dx = (xy[i][0] - xy[j][0]) * 111.32 * Math.cos(xy[i][1] * Math.PI / 180), dy = (xy[i][1] - xy[j][1]) * 110.57;
    if (dx * dx + dy * dy <= km * km) lab[find(i)] = find(j);
  }
  const g = new Map(); xy.forEach((c, i) => { const r = find(i); if (!g.has(r)) g.set(r, []); g.get(r).push(c); });
  return [...g.values()];
}

/* ---- concession footprints: convex hull of each company's stations (buffered point or line when fewer than 3) ---- */

function companyGeo() {
  if (S.geo.company) return S.geo.company;
  if (typeof turf === "undefined") return null;
  const by = new Map();
  for (const s of S.stations) if (s.company && s.hasLoc) { if (!by.has(s.company)) by.set(s.company, []); by.get(s.company).push([s.lon, s.lat]); }
  const feats = [];
  for (const [code, xy] of by) for (const grp of clusterXY(xy, 40)) {
    let g = null;
    try { if (grp.length >= 3) g = turf.convex(turf.featureCollection(grp.map((c) => turf.point(c)))); } catch (e) { /* collinear */ }
    if (!g) { try { g = turf.buffer(grp.length === 1 ? turf.point(grp[0]) : turf.lineString(grp), 1.5, { units: "kilometers" }); } catch (e) { continue; } }
    if (g) { g.properties = { company: code, area: turf.area(g) }; feats.push(g); }
  }
  feats.sort((a, b) => b.properties.area - a.properties.area);   // big footprints first so small ones stay clickable on top
  return (S.geo.company = turf.featureCollection(feats));
}

/* ---- Getis-Ord Gi*: is a station's neighbourhood (25 km, binary weights, self included) unusually high or low? ---- */

const GI_KM = 25;

function giSetup(list) {
  const kx = 111.32, ky = 110.57, nb = list.map(() => []);
  list.forEach((s, i) => { s._pi = i; });
  for (let i = 0; i < list.length; i++) {
    const a = list[i], cx = kx * Math.cos(a.lat * Math.PI / 180);
    for (let j = i; j < list.length; j++) {
      const b = list[j], dx = (a.lon - b.lon) * cx, dy = (a.lat - b.lat) * ky;
      if (dx * dx + dy * dy <= GI_KM * GI_KM) { nb[i].push(j); if (j !== i) nb[j].push(i); }
    }
  }
  return { list, nb };
}

/** Gi* z per station; NaN for stations without a value or with fewer than 4 valid stations (self included) within the radius. */
function giStar(g, valueOf) {
  const x = g.list.map((s) => valueOf(s)), ok = x.filter((v) => v === v), n = ok.length, out = new Map();
  if (n < 8) return out;
  const mean = ok.reduce((a, b) => a + b, 0) / n, sd = Math.sqrt(ok.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
  if (!sd) return out;
  g.list.forEach((s, i) => {
    if (x[i] !== x[i]) return;
    let W = 0, sum = 0;
    for (const j of g.nb[i]) if (x[j] === x[j]) { W++; sum += x[j]; }
    if (W < 4) return;
    out.set(s, (sum - mean * W) / (sd * Math.sqrt((n * W - W * W) / (n - 1))));
  });
  return out;
}

function hotNote(c, w) {
  let lo = 0, hi = 0, n = 0;
  for (const s of S.pop) { const v = c.zOf(s, w); if (v !== v) continue; n++; if (v <= -1.96) lo++; else if (v >= 1.96) hi++; }
  return `Gi* with ${GI_KM} km binary weights on ${n} stations: ${lo} low-value and ${hi} high-value clusters at |z| ≥ 1.96. No multiple-testing correction, z is relative to the stations currently selected, and clusters largely follow concession boundaries (one operator, one drainage regime). Indicative.`;
}

/* ---- small map of a region's stations (Regions tab) ---- */

function regionMiniMap(level, key, r, elId, boxId) {
  const el = $(elId); if (!el) return;
  const map = L.map(el, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
  (M.mini = M.mini || {})[boxId] = map;
  map.setView([-1, 111], 5);   // vector layers need a view before they are added
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, opacity: 0.55 }).addTo(map);
  const bounds = [];
  const data = level === "company" ? companyGeo() : S.geo[level];
  if (data) {
    const feats = data.features.filter((f) => String(featureKey(level, f.properties)) === String(key));
    if (feats.length) {
      const g = L.geoJSON({ type: "FeatureCollection", features: feats }, { style: () => ({ color: css("--text-primary"), weight: 1.5, fillColor: css("--kind-conc"), fillOpacity: 0.08, dashArray: level === "company" ? "4 3" : null }), interactive: false }).addTo(map);
      bounds.push(g.getBounds());
    }
  }
  for (const s of r.members) {
    if (!s.hasLoc) continue;
    const v = s.now, m = L.circleMarker([s.lat, s.lon], { radius: 5, weight: 1.2, color: css("--surface"), fillColor: v === v ? classColor(v) : css("--empty"), fillOpacity: 1 }).addTo(map);
    m.bindTooltip(`<b>${esc(s.name)}</b><br>level now ${fmt(v, 0)} cm · trend ${sgn(s.slope, 2)} cm/wk`, { sticky: true });
    m.on("click", () => selectStation(s));
    bounds.push(L.latLngBounds([[s.lat, s.lon], [s.lat, s.lon]]));
  }
  if (bounds.length) map.fitBounds(bounds.reduce((a, b) => a.extend(b)), { padding: [18, 18], maxZoom: 12 }); else map.setView([-1, 111], 5);
  setTimeout(() => map.invalidateSize(), 0);
}
