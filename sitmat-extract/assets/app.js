"use strict";
/* SiTMAT Explorer: reads sitmat_out/processed/*.csv and renders tables, charts, a spatio-temporal map and a heatmap. */

const DATA_DIR = "sitmat_out/processed/";
const STATUS = ["HIJAU", "KUNING", "ORANYE", "MERAH", "HITAM", "BIRU"];
const FLAGS = ["", "range", "spike"];
const BRBG = ["#8c510a", "#d8b365", "#f6e8c3", "#c7eae5", "#5ab4ac", "#01665e"];
const $ = (id) => document.getElementById(id);
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? "–" : v.toFixed(d));

const S = {
  stations: [], dates: [], nd: 0, qcText: "",
  f: { kind: "all", prov: "all", noFlag: true, i0: 0, i1: 0 },
  range: { wl: [-100, 0], delta: [-30, 30] },
  charts: {}, tab: "overview", sel: null,
  table: { sort: "name", dir: 1, page: 0, q: "", size: 50 },
};

/* ---------- loading ---------- */

function parseCsv(src, onProgress) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Papa.parse(src, {
      header: true, skipEmptyLines: true, download: typeof src === "string",
      chunk: (r) => { for (const x of r.data) rows.push(x); onProgress && onProgress(r.meta.cursor); },
      complete: () => resolve(rows), error: reject,
    });
  });
}

async function load(longSrc, stSrc) {
  const bar = $("loadBar");
  $("loadMsg").textContent = "Loading stations…";
  const st = await parseCsv(stSrc);
  $("loadMsg").textContent = "Loading daily readings…";
  const long = await parseCsv(longSrc, (c) => { bar.style.width = Math.min(95, c / 120000) + "%"; });
  bar.style.width = "100%";
  build(st, long);
  fetch(DATA_DIR + "qc_report.txt").then((r) => (r.ok ? r.text() : "")).then((t) => { S.qcText = t; $("qcText").textContent = t || "Not available."; }).catch(() => {});
  $("loading").classList.add("hidden");
  $("app").classList.remove("hidden");
  initUi();
}

function build(stRows, long) {
  const dset = new Set();
  for (const r of long) dset.add(r.date);
  S.dates = [...dset].sort();
  S.nd = S.dates.length;
  const dIdx = new Map(S.dates.map((d, i) => [d, i]));
  const byKey = new Map();
  const mk = (kind, id) => {
    const nd = S.nd, nan = () => new Float32Array(nd).fill(NaN);
    const o = { kind, id, name: id, lon: NaN, lat: NaN, prov: "", kab: "", company: "",
      wl: nan(), wmin: nan(), wmax: nan(), sm: nan(), rain: nan(),
      status: new Int8Array(nd).fill(-1), flag: new Uint8Array(nd) };
    byKey.set(kind + "|" + id, o);
    S.stations.push(o);
    return o;
  };
  for (const r of stRows) {
    const o = mk(r.kind, r.station_id);
    o.name = r.name || r.station_id;
    o.lon = parseFloat(r.lon); o.lat = parseFloat(r.lat);
    o.prov = r.provinsi || ""; o.kab = r.kabupaten || ""; o.company = r.company_name || r.company_code || "";
  }
  const num = (v) => (v === "" || v == null ? NaN : +v);
  for (const r of long) {
    const o = byKey.get(r.kind + "|" + r.station_id) || mk(r.kind, r.station_id);
    const i = dIdx.get(r.date);
    o.wl[i] = num(r.water_level_cm); o.wmin[i] = num(r.water_level_min_cm); o.wmax[i] = num(r.water_level_max_cm);
    o.sm[i] = num(r.soil_moisture_pct); o.rain[i] = num(r.rain_fall_mm);
    o.status[i] = STATUS.indexOf(r.status);
    o.flag[i] = FLAGS.indexOf(r.flag || "");
  }
  // global colour ranges from unflagged water levels (2nd..98th percentile)
  const all = [];
  for (const s of S.stations) for (let i = 0; i < S.nd; i++) if (s.flag[i] === 0 && !Number.isNaN(s.wl[i])) all.push(s.wl[i]);
  all.sort((a, b) => a - b);
  if (all.length) S.range.wl = [all[Math.floor(all.length * 0.02)], all[Math.floor(all.length * 0.98)]];
  const dl = [];
  for (const s of S.stations) for (let i = 7; i < S.nd; i++) if (s.flag[i] === 0 && s.flag[i - 7] === 0) { const d = s.wl[i] - s.wl[i - 7]; if (!Number.isNaN(d)) dl.push(Math.abs(d)); }
  dl.sort((a, b) => a - b);
  if (dl.length) { const m = Math.max(5, dl[Math.floor(dl.length * 0.95)]); S.range.delta = [-m, m]; }
  S.f.i1 = S.nd - 1;
}

/* ---------- helpers ---------- */

function lerpColor(stops, t) {
  t = Math.max(0, Math.min(1, t));
  const x = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return [0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f));
}
const hexCache = {};
function hex(h) { return hexCache[h] || (hexCache[h] = [1, 3, 5].map((k) => parseInt(h.slice(k, k + 2), 16))); }
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
const scale = (v, [lo, hi]) => lerpColor(BRBG, (v - lo) / (hi - lo));

// value of a station's water level on day i, honouring the QC toggle
function wlv(s, i) { return S.f.noFlag && s.flag[i] ? NaN : s.wl[i]; }

function filtered() {
  const { kind, prov } = S.f;
  return S.stations.filter((s) => (kind === "all" || s.kind === kind) && (prov === "all" || s.prov === prov));
}

function stationStats(s) {
  const { i0, i1 } = S.f;
  let n = 0, sum = 0, min = Infinity, max = -Infinity, last = NaN, lastI = -1, flags = 0;
  for (let i = i0; i <= i1; i++) {
    if (s.flag[i]) flags++;
    const v = wlv(s, i);
    if (Number.isNaN(v)) continue;
    n++; sum += v; if (v < min) min = v; if (v > max) max = v; last = v; lastI = i;
  }
  const days = i1 - i0 + 1;
  return { n, mean: n ? sum / n : NaN, min: n ? min : NaN, max: n ? max : NaN, last, lastDate: lastI >= 0 ? S.dates[lastI] : "", cov: n / days * 100, flags };
}

function chart(id, cfg) {
  if (S.charts[id]) S.charts[id].destroy();
  const ink = css("--muted"), line = css("--line");
  Chart.defaults.color = ink; Chart.defaults.borderColor = line;
  cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, cfg.options);
  S.charts[id] = new Chart($(id), cfg);
  return S.charts[id];
}
const kindColor = { community: () => css("--s-BIRU"), concession: () => css("--accent") };
const statusColor = (i) => css("--s-" + STATUS[i]);
const xTicks = { ticks: { maxTicksLimit: 10, autoSkip: true } };

function dayRange() { const a = []; for (let i = S.f.i0; i <= S.f.i1; i++) a.push(i); return a; }

/* ---------- filters / tabs ---------- */

function initUi() {
  const provs = [...new Set(S.stations.map((s) => s.prov).filter(Boolean))].sort();
  $("fProv").innerHTML = '<option value="all">All</option>' + provs.map((p) => `<option>${p}</option>`).join("");
  $("fFrom").min = $("fTo").min = S.dates[0]; $("fFrom").max = $("fTo").max = S.dates[S.nd - 1];
  $("fFrom").value = S.dates[0]; $("fTo").value = S.dates[S.nd - 1];
  $("subtitle").textContent = `${S.stations.length} stations · ${S.dates[0]} → ${S.dates[S.nd - 1]} (${S.nd} days)`;

  const onFilter = () => {
    S.f.kind = $("fKind").value; S.f.prov = $("fProv").value; S.f.noFlag = $("fNoFlag").checked;
    let a = S.dates.indexOf($("fFrom").value), b = S.dates.indexOf($("fTo").value);
    if (a < 0) a = 0; if (b < 0) b = S.nd - 1; if (a > b) [a, b] = [b, a];
    S.f.i0 = a; S.f.i1 = b;
    refresh();
  };
  ["fKind", "fProv", "fFrom", "fTo", "fNoFlag"].forEach((id) => $(id).addEventListener("change", onFilter));
  $("tabs").addEventListener("click", (e) => { const t = e.target.dataset.tab; if (t) showTab(t); });
  $("themeBtn").onclick = () => {
    const el = document.documentElement, dark = css("--bg") === "#121614";
    el.dataset.theme = dark ? "light" : "dark"; refresh(); mapRestyle();
  };
  $("dClose").onclick = () => { S.sel = null; $("detail").classList.add("hidden"); };
  initMap(); initTable(); initHeat();
  refresh();
}

function showTab(t) {
  S.tab = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  document.querySelectorAll("main > section[id^=tab-]").forEach((s) => s.classList.toggle("hidden", s.id !== "tab-" + t));
  if (t === "map") { S.map.invalidateSize(); mapSetRange(); }
  refresh();
}

function refresh() {
  const list = filtered();
  $("fCount").textContent = `${list.length} stations · ${S.f.i1 - S.f.i0 + 1} days`;
  ({ overview: renderOverview, map: renderMap, heat: renderHeat, table: renderTable, qc: renderQc }[S.tab])(list);
  if (S.sel) renderDetail();
}

/* ---------- overview ---------- */

function renderOverview(list) {
  const days = dayRange(), kinds = ["community", "concession"].filter((k) => S.f.kind === "all" || S.f.kind === k);
  const labels = days.map((i) => S.dates[i]);
  const sum = {}, cnt = {}, st = Array.from({ length: 6 }, () => new Float64Array(S.nd)), stTot = new Float64Array(S.nd);
  const rain = new Float64Array(S.nd), rainN = new Float64Array(S.nd), sm = new Float64Array(S.nd), smN = new Float64Array(S.nd);
  for (const k of kinds) { sum[k] = new Float64Array(S.nd); cnt[k] = new Float64Array(S.nd); }
  const hist = {}, prov = {}; let nVals = 0, total = 0, withData = 0;
  for (const s of list) {
    let any = false;
    for (const i of days) {
      const v = wlv(s, i);
      if (!Number.isNaN(v)) {
        sum[s.kind][i] += v; cnt[s.kind][i]++; nVals++; any = true;
        const b = Math.floor(v / 10) * 10; hist[b] = hist[b] || { community: 0, concession: 0 }; hist[b][s.kind]++;
        const p = s.prov || "(unknown)"; prov[p] = prov[p] || [0, 0]; prov[p][0] += v; prov[p][1]++;
      }
      if (s.status[i] >= 0) { st[s.status[i]][i]++; stTot[i]++; }
      if (!Number.isNaN(s.rain[i])) { rain[i] += s.rain[i]; rainN[i]++; }
      if (!Number.isNaN(s.sm[i])) { sm[i] += s.sm[i]; smN[i]++; }
    }
    total += days.length; if (any) withData++;
  }
  const allSum = days.reduce((a, i) => a + kinds.reduce((b, k) => b + sum[k][i], 0), 0);
  $("kpis").innerHTML = [
    [list.length, "stations in filter"], [withData, "with ≥1 water-level reading"],
    [nVals.toLocaleString(), "water-level readings"], [fmt(nVals ? allSum / nVals : NaN), "mean level (cm)"],
    [fmt(total ? nVals / total * 100 : NaN, 0) + "%", "overall coverage"],
    [new Set(list.map((s) => s.prov).filter(Boolean)).size, "provinces"],
  ].map(([b, t]) => `<div class="kpi"><b>${b}</b><span>${t}</span></div>`).join("");

  const ds = (k, arr, extra) => Object.assign({ label: k, data: days.map((i) => arr(i)), borderColor: kindColor[k](), backgroundColor: kindColor[k](), pointRadius: 0, borderWidth: 1.6, spanGaps: false }, extra);
  chart("cMean", { type: "line", data: { labels, datasets: kinds.map((k) => ds(k, (i) => (cnt[k][i] ? sum[k][i] / cnt[k][i] : null))) }, options: { scales: { x: xTicks, y: { title: { display: true, text: "cm" } } }, interaction: { mode: "index", intersect: false } } });
  chart("cCount", { type: "bar", data: { labels, datasets: kinds.map((k) => ds(k, (i) => cnt[k][i], { borderWidth: 0, stack: "s" })) }, options: { scales: { x: Object.assign({ stacked: true }, xTicks), y: { stacked: true } } } });
  chart("cStatus", { type: "bar", data: { labels, datasets: STATUS.map((n, k) => ({ label: n, data: days.map((i) => (stTot[i] ? st[k][i] / stTot[i] * 100 : 0)), backgroundColor: statusColor(k), borderWidth: 0, barPercentage: 1, categoryPercentage: 1 })) }, options: { scales: { x: Object.assign({ stacked: true }, xTicks), y: { stacked: true, max: 100, title: { display: true, text: "%" } } } } });
  const bins = Object.keys(hist).map(Number).sort((a, b) => a - b);
  chart("cHist", { type: "bar", data: { labels: bins.map((b) => b + ""), datasets: kinds.map((k) => ({ label: k, data: bins.map((b) => hist[b][k]), backgroundColor: kindColor[k](), stack: "s", borderWidth: 0 })) }, options: { scales: { x: { stacked: true, title: { display: true, text: "bin start (cm), 10 cm wide" } }, y: { stacked: true } } } });
  const pr = Object.entries(prov).map(([p, [a, n]]) => [p, a / n, n]).sort((a, b) => b[1] - a[1]);
  chart("cProv", { type: "bar", data: { labels: pr.map((r) => r[0]), datasets: [{ label: "mean cm", data: pr.map((r) => r[1]), backgroundColor: pr.map((r) => rgb(scale(r[1], S.range.wl))) }] }, options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { afterLabel: (c) => `${pr[c.dataIndex][2]} readings` } } } } });
  chart("cRain", { type: "bar", data: { labels, datasets: [
    { type: "bar", label: "rain mm (mean)", data: days.map((i) => (rainN[i] ? rain[i] / rainN[i] : null)), backgroundColor: css("--s-BIRU"), yAxisID: "y", borderWidth: 0 },
    { type: "line", label: "soil moisture % (mean)", data: days.map((i) => (smN[i] ? sm[i] / smN[i] : null)), borderColor: css("--s-ORANYE"), pointRadius: 0, borderWidth: 1.6, yAxisID: "y1" }] },
    options: { scales: { x: xTicks, y: { title: { display: true, text: "mm" } }, y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "%" } } } } });
}

/* ---------- map ---------- */

function initMap() {
  S.map = L.map("map", { preferCanvas: true, worldCopyJump: false }).setView([-1.5, 112], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap contributors" }).addTo(S.map);
  S.layer = L.layerGroup().addTo(S.map);
  S.markers = [];
  for (const s of S.stations) {
    if (Number.isNaN(s.lat) || Number.isNaN(s.lon)) continue;
    const m = L.circleMarker([s.lat, s.lon], { radius: s.kind === "community" ? 6 : 4, weight: 1, color: "#000", opacity: 0.5, fillOpacity: 0.9 });
    m.on("click", () => selectStation(s));
    m.bindTooltip(() => `${s.name}<br>${markerText(s)}`);
    m._s = s; S.markers.push(m);
  }
  S.legend = L.control({ position: "bottomleft" });
  S.legend.onAdd = () => { const d = L.DomUtil.create("div", "legend"); d.id = "mLegend"; return d; };
  S.legend.addTo(S.map);
  $("mSlider").addEventListener("input", renderMap);
  $("mMode").addEventListener("change", renderMap);
  $("mHide").addEventListener("change", renderMap);
  $("mPlay").onclick = () => {
    if (S.timer) { clearInterval(S.timer); S.timer = null; $("mPlay").innerHTML = "&#9654; Play"; return; }
    $("mPlay").innerHTML = "&#10074;&#10074; Pause";
    S.timer = setInterval(() => {
      const sl = $("mSlider");
      sl.value = +sl.value >= +sl.max ? sl.min : +sl.value + 1;
      renderMap();
    }, 250);
  };
}

function mapSetRange() {
  const sl = $("mSlider"), cur = +sl.value;
  sl.min = S.f.i0; sl.max = S.f.i1;
  sl.value = Math.min(S.f.i1, Math.max(S.f.i0, cur || S.f.i1));
}

function mapValue(s, i, mode) {
  switch (mode) {
    case "wl": return wlv(s, i);
    case "delta": { if (i < 7) return NaN; const a = wlv(s, i), b = wlv(s, i - 7); return a - b; }
    case "rain": return s.rain[i];
    case "soil": return s.sm[i];
    case "status": return s.status[i] < 0 ? NaN : s.status[i];
  }
}
function markerText(s) {
  const i = +$("mSlider").value, mode = $("mMode").value, v = mapValue(s, i, mode);
  return mode === "status" ? (Number.isNaN(v) ? "no data" : STATUS[v]) : `${mode}: ${fmt(v)}`;
}
function mapColor(v, mode) {
  if (Number.isNaN(v)) return css("--empty");
  if (mode === "status") return statusColor(v);
  if (mode === "wl") return rgb(scale(v, S.range.wl));
  if (mode === "delta") return rgb(scale(v, S.range.delta));
  return rgb(lerpColor(["#f7fbff", "#9ecae1", "#2171b5", "#08306b"], v / (mode === "rain" ? 50 : 100)));
}

function mapRestyle() { if (S.tab === "map") renderMap(); }

function renderMap(list) {
  if (!Array.isArray(list)) list = filtered();
  mapSetRange();
  const i = +$("mSlider").value, mode = $("mMode").value, hide = $("mHide").checked;
  $("mDate").textContent = S.dates[i];
  const ok = new Set(list);
  S.layer.clearLayers();
  let n = 0, sum = 0; const byStatus = new Array(6).fill(0);
  for (const m of S.markers) {
    const s = m._s;
    if (!ok.has(s)) continue;
    const v = mapValue(s, i, mode);
    if (!Number.isNaN(v)) { n++; sum += v; }
    if (s.status[i] >= 0) byStatus[s.status[i]]++;
    if (hide && Number.isNaN(v)) continue;
    m.setStyle({ fillColor: mapColor(v, mode) });
    S.layer.addLayer(m);
  }
  $("mStats").innerHTML = `<dt>Stations in filter</dt><dd>${list.length}</dd><dt>With data (this layer)</dt><dd>${n}</dd><dt>Mean</dt><dd>${mode === "status" ? "–" : fmt(n ? sum / n : NaN)}</dd>` +
    STATUS.map((x, k) => `<dt><span class="dot" style="background:${statusColor(k)}"></span>${x}</dt><dd>${byStatus[k]}</dd>`).join("");
  mapLegend(mode);
  mapSeries(list, i);
}

function mapLegend(mode) {
  const el = $("mLegend"); if (!el) return;
  if (mode === "status") { el.innerHTML = STATUS.map((x, k) => `<div><i style="background:${statusColor(k)}"></i>${x}</div>`).join("") + `<div><i style="background:${css("--empty")}"></i>no data</div>`; return; }
  const [lo, hi] = mode === "wl" ? S.range.wl : mode === "delta" ? S.range.delta : [0, mode === "rain" ? 50 : 100];
  const stops = mode === "wl" || mode === "delta" ? BRBG : ["#f7fbff", "#9ecae1", "#2171b5", "#08306b"];
  const unit = { wl: "cm", delta: "cm / 7d", rain: "mm", soil: "%" }[mode];
  el.innerHTML = `<div class="ramp" style="background:linear-gradient(90deg,${stops.join(",")})"></div><div class="row"><span>${fmt(lo, 0)}</span><span>${unit}</span><span>${fmt(hi, 0)}</span></div><div><i style="background:${css("--empty")}"></i>no data</div>`;
}

function mapSeries(list, cur) {
  const days = dayRange(), data = days.map((d) => { let n = 0, a = 0; for (const s of list) { const v = wlv(s, d); if (!Number.isNaN(v)) { a += v; n++; } } return n ? a / n : null; });
  const ch = chart("cMapTs", { type: "line", data: { labels: days.map((d) => S.dates[d]), datasets: [{ data, borderColor: css("--accent"), pointRadius: 0, borderWidth: 1.5 }] },
    options: { plugins: { legend: { display: false }, tooltip: { enabled: false } }, scales: { x: { display: false } },
      events: [] }, plugins: [{ id: "cursor", afterDraw(c) { const x = c.scales.x.getPixelForValue(cur - S.f.i0); const { top, bottom } = c.chartArea; const g = c.ctx; g.save(); g.strokeStyle = css("--warn"); g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom); g.stroke(); g.restore(); } }] });
  return ch;
}

/* ---------- heatmap ---------- */

function initHeat() {
  $("hSort").addEventListener("change", renderHeat);
  const cv = $("heat");
  cv.addEventListener("mousemove", (e) => {
    const r = cv.getBoundingClientRect(), H = S.heat; if (!H) return;
    const x = Math.floor((e.clientX - r.left) / r.width * H.cols), y = Math.floor((e.clientY - r.top) / r.height * H.rows);
    const s = H.list[y]; if (!s || x < 0 || x >= H.cols) return tip(null);
    const i = H.days[x];
    tip(e, `${s.name} (${s.kind})<br>${S.dates[i]}: ${fmt(wlv(s, i))} cm`);
  });
  cv.addEventListener("mouseleave", () => tip(null));
  cv.addEventListener("click", (e) => {
    const r = cv.getBoundingClientRect(), H = S.heat;
    const s = H && H.list[Math.floor((e.clientY - r.top) / r.height * H.rows)]; if (s) selectStation(s);
  });
}

function tip(e, html) {
  let t = $("heatTip");
  if (!t) { t = document.createElement("div"); t.id = "heatTip"; document.body.appendChild(t); }
  if (!e) { t.style.display = "none"; return; }
  t.style.display = "block"; t.innerHTML = html; t.style.left = e.clientX + 12 + "px"; t.style.top = e.clientY + 12 + "px";
}

function renderHeat(list) {
  if (!Array.isArray(list)) list = filtered();
  const days = dayRange(), sort = $("hSort").value;
  const stat = new Map(list.map((s) => [s, stationStats(s)]));
  list = list.filter((s) => stat.get(s).n > 0);
  const cmp = { prov: (a, b) => a.prov.localeCompare(b.prov) || stat.get(b).mean - stat.get(a).mean, mean: (a, b) => stat.get(b).mean - stat.get(a).mean, cov: (a, b) => stat.get(b).cov - stat.get(a).cov, name: (a, b) => a.name.localeCompare(b.name) }[sort];
  list.sort(cmp);
  const cols = days.length, rows = list.length, cv = $("heat");
  S.heat = { list, days, cols, rows };
  cv.width = cols; cv.height = Math.max(1, rows);
  cv.style.height = Math.max(40, Math.min(rows * 3, 900)) + "px";
  const ctx = cv.getContext("2d"), img = ctx.createImageData(cols, Math.max(1, rows)), empty = hexOrRgb(css("--empty"));
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    const v = wlv(list[y], days[x]), c = Number.isNaN(v) ? empty : scale(v, S.range.wl), o = (y * cols + x) * 4;
    img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  let ax = "";
  days.forEach((d, x) => { if (S.dates[d].endsWith("-01")) ax += `<span style="left:${(x + 0.5) / cols * 100}%">${S.dates[d].slice(0, 7)}</span>`; });
  $("heatAxis").innerHTML = ax;
  $("heatLegend").innerHTML = `<div class="ramp" style="background:linear-gradient(90deg,${BRBG.join(",")});width:220px;height:10px"></div><div class="row"><span>${fmt(S.range.wl[0], 0)} cm</span><span>${fmt(S.range.wl[1], 0)} cm</span></div>`;
}
function hexOrRgb(c) { return c.startsWith("#") ? [1, 3, 5].map((k) => parseInt(c.slice(k, k + 2), 16)) : c.match(/\d+/g).map(Number); }

/* ---------- table ---------- */

const COLS = [
  ["kind", "Source"], ["name", "Name"], ["id", "ID"], ["prov", "Province"], ["kab", "Regency"], ["company", "Company"],
  ["n", "Days", 1], ["cov", "Cov %", 1], ["mean", "Mean cm", 1], ["min", "Min", 1], ["max", "Max", 1], ["last", "Last cm", 1], ["lastDate", "Last date"], ["flags", "Flags", 1],
];

function initTable() {
  $("tbl").querySelector("thead").innerHTML = "<tr>" + COLS.map(([k, t, n]) => `<th data-k="${k}" class="${n ? "num" : ""}">${t}</th>`).join("") + "</tr>";
  $("tbl").querySelector("thead").addEventListener("click", (e) => {
    const k = e.target.dataset.k; if (!k) return;
    S.table.dir = S.table.sort === k ? -S.table.dir : 1; S.table.sort = k; S.table.page = 0; renderTable();
  });
  $("tSearch").addEventListener("input", (e) => { S.table.q = e.target.value.toLowerCase(); S.table.page = 0; renderTable(); });
  $("tPrev").onclick = () => { S.table.page = Math.max(0, S.table.page - 1); renderTable(); };
  $("tNext").onclick = () => { S.table.page++; renderTable(); };
  $("tCsv").onclick = exportCsv;
  $("tbl").querySelector("tbody").addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) selectStation(S.tableRows[+tr.dataset.i]); });
}

function tableData(list) {
  const q = S.table.q;
  let rows = list.map((s) => Object.assign({ s }, s, stationStats(s)));
  if (q) rows = rows.filter((r) => [r.name, r.id, r.prov, r.kab, r.company].some((x) => (x || "").toLowerCase().includes(q)));
  const { sort, dir } = S.table;
  rows.sort((a, b) => {
    const x = a[sort], y = b[sort], nx = typeof x === "number" && Number.isNaN(x), ny = typeof y === "number" && Number.isNaN(y);
    if (nx || ny) return nx - ny;
    return (typeof x === "number" ? x - y : String(x).localeCompare(String(y))) * dir;
  });
  return rows;
}

function renderTable(list) {
  if (!Array.isArray(list)) list = filtered();
  const rows = tableData(list), t = S.table, pages = Math.max(1, Math.ceil(rows.length / t.size));
  t.page = Math.min(t.page, pages - 1);
  const slice = rows.slice(t.page * t.size, (t.page + 1) * t.size);
  S.tableRows = slice.map((r) => r.s);
  $("tbl").querySelector("tbody").innerHTML = slice.map((r, i) => `<tr data-i="${i}">` + COLS.map(([k, , n]) => {
    const v = r[k];
    return `<td class="${n ? "num" : ""}">${typeof v === "number" ? fmt(v, k === "n" || k === "flags" ? 0 : 1) : v || ""}</td>`;
  }).join("") + "</tr>").join("");
  $("tbl").querySelectorAll("th").forEach((th) => th.classList.toggle("sorted", th.dataset.k === t.sort));
  $("tInfo").textContent = `${rows.length} stations`;
  $("tPage").textContent = `page ${t.page + 1} / ${pages}`;
  S.tableAll = rows;
}

function exportCsv() {
  const rows = S.tableAll || [];
  const out = [COLS.map((c) => c[1]).join(",")].concat(rows.map((r) => COLS.map(([k]) => JSON.stringify(typeof r[k] === "number" ? (Number.isNaN(r[k]) ? "" : +r[k].toFixed(2)) : r[k] ?? "")).join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/csv" }));
  a.download = "stations_summary.csv"; a.click();
}

/* ---------- QC ---------- */

function renderQc(list) {
  const days = dayRange(), kinds = ["community", "concession"];
  const fl = { community: [0, 0], concession: [0, 0] }, cov = [], miss = new Float64Array(S.nd), flagged = [];
  for (const s of list) {
    let n = 0;
    for (const i of days) {
      if (s.flag[i]) { fl[s.kind][s.flag[i] - 1]++; flagged.push([s, i]); }
      if (Number.isNaN(wlv(s, i))) miss[i]++; else n++;
    }
    cov.push(n / days.length * 100);
  }
  chart("cFlags", { type: "bar", data: { labels: kinds, datasets: ["range", "spike"].map((f, k) => ({ label: f, data: kinds.map((x) => fl[x][k]), backgroundColor: css(k ? "--s-ORANYE" : "--s-MERAH"), borderWidth: 0 })) }, options: { scales: { x: { stacked: true }, y: { stacked: true } } } });
  const bins = new Array(10).fill(0); cov.forEach((c) => bins[Math.min(9, Math.floor(c / 10))]++);
  chart("cCov", { type: "bar", data: { labels: bins.map((_, i) => `${i * 10}–${i * 10 + 10}`), datasets: [{ label: "stations", data: bins, backgroundColor: css("--accent"), borderWidth: 0 }] }, options: { plugins: { legend: { display: false } } } });
  chart("cMiss", { type: "line", data: { labels: days.map((i) => S.dates[i]), datasets: [{ data: days.map((i) => miss[i] / (list.length || 1) * 100), borderColor: css("--warn"), pointRadius: 0, borderWidth: 1.5 }] }, options: { plugins: { legend: { display: false } }, scales: { x: xTicks, y: { max: 100 } } } });
  flagged.sort((a, b) => Math.abs(b[0].wl[b[1]]) - Math.abs(a[0].wl[a[1]]));
  $("flagTbl").innerHTML = "<tr><th>Source</th><th>Name</th><th>Date</th><th class='num'>Level cm</th><th>Flag</th><th>Status</th></tr>" +
    flagged.slice(0, 300).map(([s, i]) => `<tr><td>${s.kind}</td><td>${s.name}</td><td>${S.dates[i]}</td><td class="num">${fmt(s.wl[i])}</td><td>${FLAGS[s.flag[i]]}</td><td>${STATUS[s.status[i]] || ""}</td></tr>`).join("");
}

/* ---------- station detail ---------- */

function selectStation(s) { S.sel = s; $("detail").classList.remove("hidden"); renderDetail(); $("detail").scrollIntoView({ behavior: "smooth", block: "nearest" }); }

function renderDetail() {
  const s = S.sel, st = stationStats(s), days = dayRange();
  $("dTitle").textContent = s.name;
  $("dMeta").textContent = [s.kind, s.id, s.prov, s.kab, s.company, `mean ${fmt(st.mean)} cm`, `coverage ${fmt(st.cov, 0)}%`, `${st.flags} flagged`].filter(Boolean).join(" · ");
  const line = (label, key, color, extra) => Object.assign({ type: "line", label, data: days.map((i) => (Number.isNaN(s[key][i]) ? null : s[key][i])), borderColor: color, backgroundColor: color, pointRadius: 0, borderWidth: 1.6, yAxisID: "y" }, extra);
  const wl = line("water level cm", "wl", css("--accent"), {
    pointRadius: days.map((i) => (s.flag[i] ? 4 : 0)), pointBackgroundColor: days.map((i) => (s.flag[i] ? css("--s-MERAH") : css("--accent"))),
  });
  chart("cDetail", { type: "bar", data: { labels: days.map((i) => S.dates[i]), datasets: [
    wl, line("min", "wmin", css("--muted"), { borderDash: [4, 3], borderWidth: 1 }), line("max", "wmax", css("--muted"), { borderDash: [4, 3], borderWidth: 1 }),
    line("soil moisture %", "sm", css("--s-ORANYE"), { yAxisID: "y1" }),
    { type: "bar", label: "rain mm", data: days.map((i) => (Number.isNaN(s.rain[i]) ? null : s.rain[i])), backgroundColor: css("--s-BIRU"), yAxisID: "y1", borderWidth: 0 }] },
    options: { interaction: { mode: "index", intersect: false }, scales: { x: xTicks, y: { title: { display: true, text: "cm" } }, y1: { position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "mm / %" } } } } });
}

/* ---------- bootstrap ---------- */

(async function start() {
  try {
    await load(DATA_DIR + "daily_long.csv", DATA_DIR + "stations.csv");
  } catch (err) {
    console.error(err);
    $("loadMsg").textContent = "Could not load " + DATA_DIR + " (" + (err && err.message ? err.message : "fetch failed") + ")";
    $("picker").classList.remove("hidden");
    $("fGo").onclick = async () => {
      const a = $("fLong").files[0], b = $("fSt").files[0];
      if (!a || !b) return;
      try { await load(a, b); } catch (e) { $("loadMsg").textContent = "Failed to parse files: " + e.message; }
    };
  }
})();
