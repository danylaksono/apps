"use strict";
/* Data model: load CSV/GeoJSON, per-station weekly series, anomalies, trends, region aggregation. */

const DATA_DIR = "sitmat_out/processed/";
const GEO_DIR = "assets/geo/";
const THRESH = -40;          // cm; concession status classes break at -40 and -80 cm
const FLAGS = ["", "range", "spike"];
const STATUS = ["HIJAU", "KUNING", "ORANYE", "MERAH", "HITAM", "BIRU"];
const MIN_WEEK_DAYS = 3;     // valid daily readings needed for a weekly median
const BASE_WEEKS = 4;        // baseline = median of the first N valid weeks of the range
const LEVELS = { adm1: "Province", adm2: "Regency", khg: "KHG", company: "Concession" };
const PLURAL = { adm1: "provinces", adm2: "regencies", khg: "KHGs", company: "concessions" };

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? "–" : v.toFixed(d));
const sgn = (v, d = 1) => (v == null || Number.isNaN(v) ? "–" : (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d));
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

const S = {
  stations: [], dates: [], nd: 0, nw: 0, wkOf: null, weeks: [], weekOK: null, weekStart: [],
  geo: { khg: null, adm1: null, adm2: null },
  info: { khg: new Map(), adm2: new Map(), adm1: new Map(), company: new Map() },
  f: { kind: "concession", adm1: "", adm2: "", khg: "", noFlag: true, i0: 0, i1: 0, minCov: 0.6, minN: 2 },
  pop: [], panel: [], tab: "overview", sel: null, ver: 0, qcText: "", charts: {}, cache: {},
};

/* ---------- loading ---------- */

function parseCsv(src, onProgress) {
  return new Promise((resolve, reject) => {
    const rows = [];
    Papa.parse(typeof src === "string" ? `${src}?_=${Date.now()}` : src, {   // cache-bust: a fresh update shows without a hard reload
      header: true, skipEmptyLines: true, download: typeof src === "string",
      chunk: (r) => { for (const x of r.data) rows.push(x); onProgress && onProgress(r.meta.cursor); },
      complete: () => resolve(rows), error: reject,
    });
  });
}

const getJson = (url) => fetch(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);

async function loadAll(longSrc, stSrc, geoSrc) {
  const bar = $("loadBar");
  $("loadMsg").textContent = "Loading stations…";
  const st = await parseCsv(stSrc);
  const geo = await (geoSrc ? parseCsv(geoSrc) : parseCsv(DATA_DIR + "stations_geo.csv").catch(() => []));
  $("loadMsg").textContent = "Loading daily readings…";
  const long = await parseCsv(longSrc, (c) => { bar.style.width = Math.min(90, c / 120000) + "%"; });
  $("loadMsg").textContent = "Loading boundaries…";
  const [khg, a1, a2, qc] = await Promise.all([
    getJson(GEO_DIR + "khg.geojson"), getJson(GEO_DIR + "adm1.geojson"), getJson(GEO_DIR + "adm2.geojson"),
    fetch(DATA_DIR + "qc_report.txt", { cache: "no-cache" }).then((r) => (r.ok ? r.text() : "")).catch(() => ""),
  ]);
  S.geo = { khg, adm1: a1, adm2: a2 }; S.qcText = qc;
  bar.style.width = "100%";
  build(st, long, geo);
}

function build(stRows, long, geoRows) {
  S.dates = [...new Set(long.map((r) => r.date))].sort();
  S.nd = S.dates.length;
  S.wkOf = new Int16Array(S.nd).map((_, i) => Math.floor(i / 7));
  S.nw = S.wkOf[S.nd - 1] + 1;
  const dIdx = new Map(S.dates.map((d, i) => [d, i]));
  const geoBy = new Map(geoRows.map((g) => [g.kind + "|" + g.station_id, g]));
  const byKey = new Map();
  const mk = (kind, id) => {
    const o = { kind, id, name: id, lon: NaN, lat: NaN, hasLoc: false, khg: -1, khgName: "", khgDist: 0, adm1: "", adm2: "", adm2id: -1, provText: "", kabText: "", company: "",
      wl: new Float32Array(S.nd).fill(NaN), flag: new Uint8Array(S.nd), status: new Int8Array(S.nd).fill(-1) };
    byKey.set(kind + "|" + id, o); S.stations.push(o); return o;
  };
  for (const r of stRows) {
    const o = mk(r.kind, r.station_id);
    o.name = r.name || r.station_id; o.provText = r.provinsi || ""; o.kabText = r.kabupaten || ""; o.company = r.company_name || r.company_code || "";   // company_name is empty on the portal; the code is the key
    o.lon = parseFloat(r.lon); o.lat = parseFloat(r.lat);
    o.hasLoc = o.lon >= 94 && o.lon <= 142 && o.lat >= -12.5 && o.lat <= 7;   // inside Indonesia; (0,0) and lat==lon placeholders fail
    const g = geoBy.get(r.kind + "|" + r.station_id);
    if (g && o.hasLoc) {
      o.khg = g.khg_id === "" ? -1 : +g.khg_id; o.khgName = g.khg_name || ""; o.khgDist = +g.khg_dist_km || 0;
      o.adm1 = g.adm1 || ""; o.adm2 = g.adm2 || ""; o.adm2id = g.adm2_id === "" ? -1 : +g.adm2_id;
    }
  }
  for (const r of long) {
    const o = byKey.get(r.kind + "|" + r.station_id) || mk(r.kind, r.station_id);
    const i = dIdx.get(r.date);
    o.wl[i] = r.water_level_cm === "" ? NaN : +r.water_level_cm;
    o.flag[i] = FLAGS.indexOf(r.flag || "");
    o.status[i] = STATUS.indexOf(r.status);
  }
  // region metadata: names/parents from the stations, overlaid with the polygon properties
  for (const s of S.stations) {
    if (s.khg >= 0 && !S.info.khg.has(s.khg)) S.info.khg.set(s.khg, { name: s.khgName || "KHG " + s.khg, parent: s.adm1 });
    if (s.adm2id >= 0 && !S.info.adm2.has(s.adm2id)) S.info.adm2.set(s.adm2id, { name: s.adm2, parent: s.adm1 });
    if (s.company && !S.info.company.has(s.company)) S.info.company.set(s.company, { name: s.company, parent: s.adm1 });
    if (s.adm1 && !S.info.adm1.has(s.adm1)) S.info.adm1.set(s.adm1, { name: s.adm1, parent: "" });
  }
  S.geo.khg && S.geo.khg.features.forEach((f) => { const p = f.properties, i = S.info.khg.get(p.khg_id); if (i) i.parent = p.prov || i.parent; else S.info.khg.set(p.khg_id, { name: p.name, parent: p.prov, noStations: true }); });
  S.geo.adm2 && S.geo.adm2.features.forEach((f) => { const p = f.properties; if (!S.info.adm2.has(p.adm2_id)) S.info.adm2.set(p.adm2_id, { name: p.kab, parent: p.prov, noStations: true }); });
  S.f.i0 = 0; S.f.i1 = S.nd - 1;
}

/* ---------- small stats ---------- */

function quant(sorted, p) {
  if (!sorted.length) return NaN;
  const x = (sorted.length - 1) * p, i = Math.floor(x), f = x - i;
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i];
}
function median(a) { const b = Array.from(a).sort((x, y) => x - y); return quant(b, 0.5); }

/** Theil-Sen slope and Mann-Kendall z (tie-corrected) for points (xs, ys). */
function theilSen(xs, ys) {
  const n = xs.length, sl = [];
  let s = 0;
  for (let i = 0; i < n - 1; i++) for (let j = i + 1; j < n; j++) {
    const dy = ys[j] - ys[i];
    sl.push(dy / (xs[j] - xs[i])); s += dy > 0 ? 1 : dy < 0 ? -1 : 0;
  }
  const slope = median(sl);
  const ties = new Map(); for (const y of ys) ties.set(y, (ties.get(y) || 0) + 1);
  let v = n * (n - 1) * (2 * n + 5);
  for (const t of ties.values()) if (t > 1) v -= t * (t - 1) * (2 * t + 5);
  v /= 18;
  const z = v > 0 ? (s - Math.sign(s)) / Math.sqrt(v) : 0;
  const mid = median(ys), xm = median(xs);
  return { slope, z, intercept: mid - slope * xm, sig: Math.abs(z) >= 1.96 };
}

/** Theil-Sen on a weekly series (typed array indexed by week). */
function trendOf(series, minPts = 8) {
  const xs = [], ys = [];
  for (const w of S.weeks) if (series[w] === series[w]) { xs.push(w); ys.push(series[w]); }
  return xs.length >= minPts ? theilSen(xs, ys) : { slope: NaN, z: NaN, intercept: NaN, sig: false };
}

function edgeMean(series, k, fromEnd) {
  const ws = fromEnd ? S.weeks.slice().reverse() : S.weeks, out = [];
  for (const w of ws) { if (series[w] === series[w]) out.push(series[w]); if (out.length === k) break; }
  return out.length ? out.reduce((a, b) => a + b, 0) / out.length : NaN;
}
const lastMean = (s, k = 4) => edgeMean(s, k, true);
const firstMean = (s, k = 4) => edgeMean(s, k, false);

/* ---------- per-station derived series (depends on QC toggle + date range) ---------- */

// reading of station s on day i, honouring the QC toggle
const val = (s, i) => (S.f.noFlag && s.flag[i] ? NaN : s.wl[i]);

function deriveStations() {
  const { i0, i1, noFlag } = S.f, key = `${noFlag}|${i0}|${i1}`;
  if (S.dkey === key) return;
  S.dkey = key; S.ver++; S.cache = {};
  const binDays = new Int16Array(S.nw);
  for (let i = i0; i <= i1; i++) binDays[S.wkOf[i]]++;
  S.weeks = []; S.weekStart = [];
  for (let w = 0; w < S.nw; w++) if (binDays[w] >= MIN_WEEK_DAYS) S.weeks.push(w);
  S.weekStart = Array.from({ length: S.nw }, (_, w) => S.dates[Math.min(S.nd - 1, w * 7)]);
  const nW = S.weeks.length, buf = [];
  for (const s of S.stations) {
    s.wk = new Float32Array(S.nw).fill(NaN); s.anom = new Float32Array(S.nw).fill(NaN);
    let nv = 0, sum = 0, nd = 0, flags = 0;
    for (let i = i0; i <= i1; i++) { if (s.flag[i]) flags++; const v = val(s, i); if (v === v) { sum += v; nd++; } }
    for (const w of S.weeks) {
      buf.length = 0;
      for (let i = Math.max(i0, w * 7); i <= Math.min(i1, w * 7 + 6); i++) { const v = val(s, i); if (v === v) buf.push(v); }
      if (buf.length >= MIN_WEEK_DAYS) { s.wk[w] = median(buf); nv++; }
    }
    s.nv = nv; s.cov = nW ? nv / nW : 0; s.nDays = nd; s.mean = nd ? sum / nd : NaN; s.flags = flags;
    const first = []; for (const w of S.weeks.slice(0, BASE_WEEKS)) if (s.wk[w] === s.wk[w]) first.push(s.wk[w]);
    s.base = first.length >= 2 ? median(first) : NaN;
    if (s.base === s.base) for (const w of S.weeks) s.anom[w] = s.wk[w] - s.base;
    const xs = [], ys = []; for (const w of S.weeks) if (s.wk[w] === s.wk[w]) { xs.push(w); ys.push(s.wk[w]); }
    const t = xs.length >= 8 ? theilSen(xs, ys) : { slope: NaN, z: NaN, sig: false, intercept: NaN };
    s.slope = t.slope; s.z = t.z; s.sig = t.sig; s.icpt = t.intercept;
    s.now = lastMean(s.wk, 2); s.change = s.base === s.base ? s.now - s.base : NaN;
  }
}

/** Stations matching the filters (pop) and the fixed panel inside it (enough weeks + a baseline). */
function selectPop() {
  const f = S.f;
  S.pop = S.stations.filter((s) => (f.kind === "all" || s.kind === f.kind) && (!f.adm1 || s.adm1 === f.adm1) && (!f.adm2 || String(s.adm2id) === f.adm2) && (!f.khg || String(s.khg) === f.khg));
  S.panel = S.pop.filter(isPanel);
}
const isPanel = (s) => s.cov >= S.f.minCov && s.base === s.base;

/* ---------- weekly aggregation over a list of stations ---------- */

/** Median and quartiles across stations per week; NaN where fewer than minN stations report. */
function weeklySeries(list, field, minN = S.f.minN) {
  const nw = S.nw, mk = () => new Float32Array(nw).fill(NaN), out = { med: mk(), q1: mk(), q3: mk(), n: new Int16Array(nw) };
  for (const w of S.weeks) {
    const v = [];
    for (const s of list) { const x = s[field][w]; if (x === x) v.push(x); }
    out.n[w] = v.length;
    if (v.length < minN) continue;
    v.sort((a, b) => a - b);
    out.med[w] = quant(v, 0.5); out.q1[w] = quant(v, 0.25); out.q3[w] = quant(v, 0.75);
  }
  return out;
}

/** Share of reporting stations in each level class per week (percent). */
function classShares(list, minN = S.f.minN) {
  const nw = S.nw, mk = () => new Float32Array(nw).fill(NaN), o = { ok: mk(), mid: mk(), bad: mk(), below: mk(), n: new Int16Array(nw) };
  for (const w of S.weeks) {
    let n = 0, a = 0, b = 0, c = 0;
    for (const s of list) { const x = s.wk[w]; if (x !== x) continue; n++; if (x >= THRESH) a++; else if (x >= -80) b++; else c++; }
    o.n[w] = n;
    if (n < minN) continue;
    o.ok[w] = a / n * 100; o.mid[w] = b / n * 100; o.bad[w] = c / n * 100; o.below[w] = (b + c) / n * 100;
  }
  return o;
}

/* ---------- regions ---------- */

function regionKey(s, level) {
  if (level === "khg") return s.khg >= 0 ? s.khg : null;
  if (level === "adm2") return s.adm2id >= 0 ? s.adm2id : null;
  if (level === "company") return s.company || null;
  return s.adm1 || null;
}

/** Aggregates for every region at `level`, built from the stations in the current filter (cached per filter state). */
function regionStats(level) {
  const ck = `${level}|${S.ver}|${S.f.kind}|${S.f.adm1}|${S.f.adm2}|${S.f.khg}|${S.f.minCov}|${S.f.minN}`;
  if (S.cache[ck]) return S.cache[ck];
  const groups = new Map();
  for (const s of S.pop) { const k = regionKey(s, level); if (k == null) continue; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); }
  const out = [];
  for (const [key, members] of groups) {
    const panel = members.filter(isPanel), info = S.info[level].get(key) || { name: String(key), parent: "" };
    const r = { level, key, name: info.name, parent: info.parent, members, panel, n: members.filter((s) => s.nv > 0).length, nP: panel.length };
    r.lev = weeklySeries(members, "wk"); r.an = weeklySeries(panel, "anom"); r.sh = classShares(members);
    const t = panel.length >= S.f.minN ? trendOf(r.an.med) : { slope: NaN, z: NaN, sig: false };
    r.slope = t.slope; r.z = t.z; r.sig = t.sig;
    r.curLevel = lastMean(r.lev.med); r.curChange = lastMean(r.an.med); r.curBelow = lastMean(r.sh.below, 2); r.startBelow = firstMean(r.sh.below, 2);
    const sl = panel.filter((s) => s.slope === s.slope);
    r.dry = sl.length ? sl.filter((s) => s.sig && s.slope < 0).length / sl.length * 100 : NaN;
    r.wet = sl.length ? sl.filter((s) => s.sig && s.slope > 0).length / sl.length * 100 : NaN;
    out.push(r);
  }
  return (S.cache[ck] = out);
}
const regionByKey = (level, key) => regionStats(level).find((r) => String(r.key) === String(key));

/* ---------- assorted ---------- */

const weekLabel = (w) => {
  const a = S.dates[Math.max(0, w * 7)], b = S.dates[Math.min(S.nd - 1, w * 7 + 6)];
  return a === b ? a : `${a} → ${b.slice(5)}`;
};
const dayRange = () => { const a = []; for (let i = S.f.i0; i <= S.f.i1; i++) a.push(i); return a; };
