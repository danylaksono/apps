"use strict";
/* Map tab: stations or KHG / regency / province polygons, coloured by a weekly metric, with a time slider. */

const M = { map: null, groups: {}, poly: {}, polyIdx: {}, markers: [], ctxKey: "", ctx: null, timer: null, fitPending: true };
const METRICS = {
  level: { label: "Water level (cm)", unit: "cm" },
  change: { label: "Change since start (cm)", unit: "cm" },
  share: { label: "Below −40 cm", unit: "%" },
  trend: { label: "Trend (cm/week)", unit: "cm/wk", static: true },
};
const attribution = '&copy; OpenStreetMap contributors · KHG: KLHK · Admin boundaries: geoBoundaries (BPS/OCHA), CC BY 3.0 IGO';

function initMap() {
  M.map = L.map("map", { preferCanvas: true, zoomSnap: 0.5 }).setView([-1, 111], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution, opacity: 0.55 }).addTo(M.map);
  for (const [n, z] of [["regions", 420], ["lines", 440], ["stations", 460]]) { M.map.createPane(n).style.zIndex = z; }
  M.map.getPane("lines").style.pointerEvents = "none";
  M.regionRenderer = L.canvas({ pane: "regions", padding: 0.5 });
  M.stationRenderer = L.canvas({ pane: "stations", padding: 0.5 });
  M.stationLayer = L.layerGroup().addTo(M.map);

  // static overlays: province lines, and KHG outlines when showing stations
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
  let moveT; M.map.on("moveend", () => { clearTimeout(moveT); moveT = setTimeout(() => { if (S.tab === "map" && $("mAgg").value === "contour") { drawContour(mapCtx(), weekIdx()); } }, 250); });

  ["mAgg", "mMetric", "mStations", "mLines"].forEach((id) => $(id).addEventListener("change", () => { M.layersKey = ""; renderMap(); }));
  $("mSlider").addEventListener("input", renderMap);
  $("mPlay").onclick = () => {
    if (M.timer) { clearInterval(M.timer); M.timer = null; $("mPlay").innerHTML = "&#9654; Play"; return; }
    $("mPlay").innerHTML = "&#10074;&#10074; Pause";
    M.timer = setInterval(() => { const sl = $("mSlider"); sl.value = +sl.value >= +sl.max ? 0 : +sl.value + 1; renderMap(); }, 450);
  };
}

/* ---- metric context: entities, value lookup, colour scale (cached per filter state) ---- */

function mapCtx() {
  const agg = $("mAgg").value, metric = $("mMetric").value, f = S.f;
  const key = [S.ver, agg, metric, f.kind, f.adm1, f.adm2, f.khg, f.minCov, f.minN, isDark()].join("|");
  if (M.ctxKey === key) return M.ctx;
  const stn = agg === "station" || agg === "contour";
  const ents = stn ? S.pop : regionStats(agg);
  const at = stn
    ? { level: (e, w) => e.wk[w], change: (e, w) => e.anom[w], share: (e, w) => e.wk[w], trend: (e) => e.slope }
    : { level: (e, w) => e.lev.med[w], change: (e, w) => e.an.med[w], share: (e, w) => e.sh.below[w], trend: (e) => e.slope };
  // for the contour surface "share" is interpolated as 0/100 (below the limit or not)
  const valueAt = agg === "contour" && metric === "share" ? (e, w) => (e.wk[w] === e.wk[w] ? (e.wk[w] < THRESH ? 100 : 0) : NaN) : at[metric];
  // robust colour range for change / trend: 95th percentile of |value|
  let span = 1;
  if (metric === "change" || metric === "trend") {
    const a = [];
    for (const e of ents) { if (metric === "trend") a.push(Math.abs(valueAt(e))); else for (const w of S.weeks) a.push(Math.abs(valueAt(e, w))); }
    const v = a.filter((x) => x === x).sort((x, y) => x - y);
    span = Math.max(metric === "trend" ? 0.5 : 8, quant(v, 0.95) || 1);
  }
  const color = (v) => {
    if (v !== v) return css("--empty");
    if (metric === "level") return agg === "station" ? classColor(v) : divColor(v, THRESH, 40);
    if (metric === "share") return agg === "station" ? classColor(v) : seqColor(v, 0, 100);
    return divColor(v, 0, span);
  };
  M.ctxKey = key;
  return (M.ctx = { agg, metric, ents, valueAt, color, span });
}

function weekIdx() { return S.weeks[+$("mSlider").value] ?? S.weeks[S.weeks.length - 1]; }

function mapValue(c, e, w) { return METRICS[c.metric].static ? c.valueAt(e) : c.valueAt(e, w); }

/* ---- polygons ---- */

function featureKey(level, p) { return level === "khg" ? p.khg_id : level === "adm2" ? p.adm2_id : p.prov; }

function polyLayer(level) {
  if (M.poly[level]) return M.poly[level];
  const data = S.geo[level];
  if (!data) return null;
  M.polyIdx[level] = new Map();
  M.poly[level] = L.geoJSON(data, {
    pane: "regions", renderer: M.regionRenderer,
    style: () => ({ weight: 0.5, color: css("--outline"), opacity: 0.6, fillOpacity: 0.85 }),
    onEachFeature(f, layer) {
      const key = featureKey(level, f.properties);
      layer._key = key; M.polyIdx[level].set(key, layer);
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
  const v = c ? mapValue(c, s, w) : NaN;
  return `<b>${esc(s.name)}</b><br>${esc(s.khgName || "no KHG")} · ${esc(s.adm2 || "")}<br>${c ? METRICS[c.metric].label : ""}: <b>${fmt(v, c && c.metric === "trend" ? 2 : 0)}</b>` +
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
  const stn = c.agg === "station" || c.agg === "contour";
  const showSt = stn || $("mStations").checked;

  // layer set: rebuilt only when aggregation / overlays change
  const lk = [c.agg, $("mLines").checked, showSt, isDark()].join("|");
  if (M.layersKey !== lk) {
    M.layersKey = lk;
    for (const k of Object.keys(M.poly)) M.map.removeLayer(M.poly[k]);
    for (const k of Object.keys(M.groups)) M.map.removeLayer(M.groups[k]);
    M.groups = {};
    if (!stn) { const p = polyLayer(c.agg); p && p.addTo(M.map); }
    else if (S.geo.khg) { M.groups.khg = M.outlineFn(S.geo.khg, 0.5, 0.45).addTo(M.map); }
    if ($("mLines").checked && S.geo.adm1) M.groups.adm1 = M.outlineFn(S.geo.adm1, 0.8, 0.7).addTo(M.map);
    if (showSt) M.stationLayer.addTo(M.map); else M.map.removeLayer(M.stationLayer);
    M.stationLayer.clearLayers();
    // polygons that have no mapped class (no geometry) get an explanatory note
    $("mNote").textContent = !stn && !S.geo[c.agg] ? `Boundary file assets/geo/${c.agg}.geojson not found; run prepare_geo.py.` : "";
  }
  if (!stn && M.polyIdx[c.agg]) {
    const sel = S.regSel && S.regSel.level === c.agg ? String(S.regSel.key) : null;
    const byKey = new Map(c.ents.map((e) => [String(e.key), e]));
    for (const [key, layer] of M.polyIdx[c.agg]) {
      const e = byKey.get(String(key)), v = e && e.n >= S.f.minN ? mapValue(c, e, w) : NaN, isSel = String(key) === sel;
      // polygons with data get a stroke in their own colour so small units stay visible at national zoom
      layer.setStyle(v === v
        ? { fillColor: c.color(v), fillOpacity: 0.85, weight: isSel ? 3 : 2.5, color: isSel ? css("--text-primary") : c.color(v), opacity: 1 }
        : { fillColor: css("--empty"), fillOpacity: 0.5, weight: isSel ? 3 : 0.5, color: isSel ? css("--text-primary") : css("--text-muted"), opacity: isSel ? 1 : 0.7 });
      if (isSel) layer.bringToFront();
    }
  }
  if (showSt) {
    const inPop = new Set(S.pop), hideNo = stn;
    M.stationLayer.clearLayers();
    for (const m of M.markers) {
      if (!inPop.has(m._s)) continue;
      const v = mapValue(c, m._s, w);
      if (hideNo && v !== v) continue;
      const dot = c.agg === "contour";   // small dots on top of the contour surface
      m.setStyle({ fillColor: stn ? c.color(v) : css("--text-primary"), radius: dot ? 3 : stn ? 4.5 : 2, color: dot ? css("--text-primary") : css("--surface"), weight: dot ? 0.6 : stn ? 1 : 0 });
      M.stationLayer.addLayer(m);
    }
  }
  if (M.fitPending) fitMap();
  drawContour(c, w);
  mapLegend(c);
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

function mapLegend(c) {
  const el = $("mLegend"); if (!el) return;
  const m = METRICS[c.metric], note = `<div class="muted">grey = no data${c.agg !== "station" && c.agg !== "contour" ? ` or < ${S.f.minN} stations` : ""}</div>`;
  if (c.agg === "station" && (c.metric === "level" || c.metric === "share")) {
    el.innerHTML = `<b>Station level class</b>` + CLASSES.map((k) => `<div><i style="background:${css(k.tok)}"></i>${k.label}</div>`).join("") + note; return;
  }
  let lo, hi, ramp, mid = "";
  if (c.metric === "level") { lo = -80; hi = 0; ramp = "div"; mid = `<span>−40 (limit)</span>`; }
  else if (c.metric === "share") { lo = 0; hi = 100; ramp = "seq"; }
  else { lo = -c.span; hi = c.span; ramp = "div"; mid = `<span>0</span>`; }
  el.innerHTML = `<b>${m.label}</b><div class="ramp" style="background:${gradient(ramp)}"></div><div class="row"><span>${sgn(lo, 0)}${c.metric === "share" ? "%" : ""}</span>${mid}<span>${c.metric === "share" ? hi + "%" : sgn(hi, c.metric === "trend" ? 1 : 0)}</span></div>${note}`;
}

function mapSummary(c, w) {
  const vals = c.ents.filter((e) => (c.agg === "station" || c.agg === "contour" || e.n >= S.f.minN)).map((e) => mapValue(c, e, w)).filter((v) => v === v).sort((a, b) => a - b);
  const m = METRICS[c.metric];
  const lvl = S.pop.map((s) => s.wk[w]).filter((v) => v === v);
  const below = lvl.length ? lvl.filter((v) => v < THRESH).length / lvl.length * 100 : NaN;
  $("mStats").innerHTML =
    `<dt>Stations in selection</dt><dd>${S.pop.length}</dd><dt>Reporting this week</dt><dd>${lvl.length}</dd>` +
    `<dt>Below −40 cm</dt><dd>${fmt(below, 0)}%</dd>` +
    `<dt>${c.agg === "station" || c.agg === "contour" ? "Stations" : PLURAL[c.agg][0].toUpperCase() + PLURAL[c.agg].slice(1)} shown</dt><dd>${vals.length}</dd>` +
    `<dt>Median ${m.unit}</dt><dd>${fmt(quant(vals, 0.5), c.metric === "trend" ? 2 : 1)}</dd>` +
    `<dt>Range</dt><dd>${fmt(vals[0], 1)} … ${fmt(vals[vals.length - 1], 1)}</dd>`;
  const an = weeklySeries(S.panel, "anom", 5);
  chart("cMapTs", { type: "line", data: { labels: wkLabels(), datasets: [line("Panel median change", wkData(an.med), css("--kind-conc"), { borderWidth: 2 })] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, events: [], scales: { x: { display: false }, y: { title: { display: true, text: "cm vs start" } } } },
    plugins: [refLine(0), cursorLine(() => (METRICS[c.metric].static ? null : S.weeks.indexOf(w)))] });
}

/* ---- selection ---- */

function selectRegion(level, key) {
  S.regSel = { level, key };
  regionCard(level, key, "mReg", "cMapReg");
  if (S.tab === "map") renderMap();
  if (S.tab === "compare") renderCompare();
}

/** Region summary card: key numbers, regional series and its most-drying stations. */
function regionCard(level, key, boxId, canvasId) {
  const box = $(boxId), info = S.info[level].get(key) || { name: String(key), parent: "" };
  const r = regionByKey(level, key);
  if (!r) { box.innerHTML = `<h2>${esc(info.name)}</h2><p class="muted">No stations from the current selection fall in this ${LEVELS[level].toLowerCase()}.</p>`; return; }
  const top = r.members.filter((s) => s.slope === s.slope).sort((a, b) => a.slope - b.slope).slice(0, 6);
  box.innerHTML = `<div class="reghead"><h2>${esc(r.name)}</h2><span class="muted">${LEVELS[level]}${r.parent ? " · " + esc(r.parent) : ""}</span>` +
    `<button data-act="filter">Filter to this</button></div>` +
    `<dl class="kv"><dt>Stations (panel)</dt><dd>${r.n} (${r.nP})</dd><dt>Level now</dt><dd>${fmt(r.curLevel, 0)} cm</dd>` +
    `<dt>Change since start</dt><dd>${sgn(r.curChange)} cm</dd><dt>Trend</dt><dd>${sgn(r.slope, 2)} cm/wk${r.sig ? " ●" : ""}</dd>` +
    `<dt>Below −40 cm</dt><dd>${fmt(r.startBelow, 0)}% → ${fmt(r.curBelow, 0)}%</dd><dt>Stations clearly drying</dt><dd>${fmt(r.dry, 0)}%</dd></dl>` +
    `<div class="chart" style="height:170px"><canvas id="${canvasId}"></canvas></div>` +
    `<div class="tablewrap"><table class="mini"><tr><th>Most drying stations</th><th class="num">cm/wk</th><th class="num">now</th></tr>` +
    top.map((s) => `<tr data-st="${S.stations.indexOf(s)}"><td>${esc(s.name)}</td><td class="num">${sgn(s.slope, 2)}</td><td class="num">${fmt(s.now, 0)}</td></tr>`).join("") + `</table></div>`;
  box.querySelector("[data-act=filter]").onclick = () => applyRegionFilter(level, key);
  box.querySelectorAll("tr[data-st]").forEach((tr) => (tr.onclick = () => selectStation(S.stations[+tr.dataset.st])));
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
  if (c.agg !== "contour") return;
  if (typeof turf === "undefined") { $("mNote").textContent = "Turf.js did not load (offline?); contours unavailable."; return; }
  const t0 = performance.now(), b = M.map.getBounds().pad(0.05);
  const W = b.getWest(), E = b.getEast(), Sth = b.getSouth(), N = b.getNorth();
  const cols = 90, dx = (E - W) / (cols - 1), rows = Math.min(140, Math.max(2, Math.ceil((N - Sth) / dx) + 1));
  const R = Math.max(25, dx * 111 * 2) / 111, R2 = R * R;           // search radius in degrees (about 25 km or 2 cells)
  const px = [], py = [], pv = [];
  for (const s of S.pop) {
    if (!s.hasLoc || s.lon < W - R || s.lon > E + R || s.lat < Sth - R || s.lat > N + R) continue;
    const v = mapValue(c, s, w); if (v === v) { px.push(s.lon); py.push(s.lat); pv.push(v); }
  }
  if (px.length < 3) { $("mNote").textContent = "Fewer than 3 stations with data in view."; return; }
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
  catch (e) { $("mNote").textContent = "Contour failed: " + e.message; return; }
  M.contour = L.geoJSON(out, {
    pane: "regions", renderer: M.regionRenderer, interactive: false,
    style: (f) => { const col = c.color(f.properties.mid); return { fillColor: col, fillOpacity: 0.72, color: col, weight: 0.6, opacity: 0.9 }; },
  }).addTo(M.map);
  $("mNote").textContent = `Contour: inverse-distance weighting (power 2, radius ${Math.round(R * 111)} km) of ${px.length} stations over the visible map, ${cols}×${rows} cells, ${Math.round(performance.now() - t0)} ms. Recomputed on week, filter or pan/zoom; indicative, not a hydrological model.`;
}
