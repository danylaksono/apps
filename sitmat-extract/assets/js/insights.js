"use strict";
/* Trend tab: class-transition flow. Patterns tab: duration curves, dry spells, breadth, concessions.
   Every view reads daily values through val() (QC toggle) and uses the fixed panel or within-station
   differences, so stations that start or stop reporting cannot create a signal. */

const CLASS_OF = (v) => (v >= THRESH ? 0 : v >= -80 ? 1 : 2);
const CLASS_TOK = ["--good", "--serious", "--critical"];
const CLASS_TXT = ["≥ −40 cm", "−40 to −80 cm", "< −80 cm"];
const DRY_GAP = 2;          // days with no reading that do not break a dry spell
const BREADTH_CM = 1;       // day-to-day change that counts as rising / falling

const memo = (name, fn) => {
  const k = `${name}|${S.ver}|${S.f.kind}|${S.f.adm1}|${S.f.adm2}|${S.f.khg}|${S.f.minCov}|${S.f.minN}`;
  return S.cache[k] || (S.cache[k] = fn());
};

/* ---------- Trend tab: start -> mid -> end class transitions ---------- */

/** Level around the middle of the period: median of the three valid weeks nearest the centre. */
function midLevel(s) {
  const c = S.weeks[Math.floor(S.weeks.length / 2)], near = S.weeks.filter((w) => s.wk[w] === s.wk[w]).sort((a, b) => Math.abs(a - c) - Math.abs(b - c)).slice(0, 3);
  return near.length ? median(near.map((w) => s.wk[w])) : NaN;
}

function transitions(panel) {
  const nodes = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], flows = [0, 1].map(() => [[0, 0, 0], [0, 0, 0], [0, 0, 0]]);
  let n = 0;
  for (const s of panel) {
    const v = [s.base, midLevel(s), lastMean(s.wk, 4)];
    if (v.some((x) => x !== x)) continue;
    const c = v.map(CLASS_OF); n++;
    c.forEach((k, i) => nodes[i][k]++);
    flows[0][c[0]][c[1]]++; flows[1][c[1]][c[2]]++;
  }
  return { nodes, flows, n };
}

function renderTransitions(panel) {
  const T = memo("trans", () => transitions(panel)), box = $("flow");
  if (T.n < 5) { box.innerHTML = '<p class="muted">Too few panel stations for this selection.</p>'; $("flowNote").textContent = ""; return; }
  const W = 500, H = 350, top = 44, bot = 8, gap = 16, nw = 14, xs = [112, W / 2 - nw / 2, W - 112 - nw];
  const k = (H - top - bot - 2 * gap) / T.n;
  // node y positions per column, in class order (wet at the top)
  const ny = T.nodes.map((col) => { let y = top; return col.map((c) => { const o = { y, h: c * k }; y += c * k + gap; return o; }); });
  const cur = ny.map((col) => col.map(() => ({ out: 0, in: 0 })));
  let svg = `<svg class="flowsvg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stations moving between level classes from the first weeks to the last weeks">`;
  ["First 4 weeks", "Mid-period", "Last 4 weeks"].forEach((t, i) => { svg += `<text class="ax" x="${xs[i] + nw / 2}" y="14" text-anchor="middle">${t}</text>`; });
  for (let step = 0; step < 2; step++) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
    const f = T.flows[step][a][b]; if (!f) continue;
    const h = f * k, y0 = ny[step][a].y + cur[step][a].out, y1 = ny[step + 1][b].y + cur[step + 1][b].in;
    cur[step][a].out += h; cur[step + 1][b].in += h;
    const x0 = xs[step] + nw, x1 = xs[step + 1], xm = (x0 + x1) / 2;
    svg += `<path class="rib" d="M${x0},${y0}C${xm},${y0} ${xm},${y1} ${x1},${y1}L${x1},${y1 + h}C${xm},${y1 + h} ${xm},${y0 + h} ${x0},${y0 + h}Z" fill="var(${CLASS_TOK[a]})" fill-opacity="${a === b ? 0.2 : 0.6}" stroke="var(--surface)" stroke-width="1" ` +
      `data-t="<b>${f}</b> station${f > 1 ? "s" : ""}<br>${CLASS_TXT[a]} → ${CLASS_TXT[b]}<br>${["first → mid-period", "mid-period → last"][step]}"/>`;
  }
  T.nodes.forEach((col, i) => col.forEach((c, j) => {
    const o = ny[i][j]; if (!c) return;
    svg += `<rect x="${xs[i]}" y="${o.y}" width="${nw}" height="${Math.max(2, o.h)}" rx="3" fill="var(${CLASS_TOK[j]})"/>`;
    const lx = i === 0 ? xs[i] - 8 : i === 2 ? xs[i] + nw + 8 : xs[i] + nw / 2, anchor = i === 0 ? "end" : i === 2 ? "start" : "middle", ly = o.y + o.h / 2 + 4;
    svg += i === 1 ? `<text class="num halo" x="${lx}" y="${o.y - 5}" text-anchor="middle">${c}</text>`
      : `<text class="lab" x="${lx}" y="${ly}" text-anchor="${anchor}">${CLASS_TXT[j]} <tspan class="num">${c}</tspan></text>`;
  }));
  box.innerHTML = svg + "</svg>";

  const f0 = T.flows[0], f1 = T.flows[1], worse = (m) => m[0][1] + m[0][2] + m[1][2], better = (m) => m[1][0] + m[2][0] + m[2][1];
  const W2 = T.n ? [worse(f0) + worse(f1), better(f0) + better(f1)] : [0, 0];
  const net = T.nodes[2][1] + T.nodes[2][2] - (T.nodes[0][1] + T.nodes[0][2]);
  $("flowNote").innerHTML = `${T.n} panel stations, first 4 weeks → last 4 weeks. <b>${W2[0]}</b> class-steps down and <b>${W2[1]}</b> up across the two periods. ` +
    `Net change in stations below −40 cm: <b>${net > 0 ? "+" : net < 0 ? "−" : ""}${Math.abs(net)}</b>. Churn is larger than the net: stations cross the limit both ways. Hover a flow for its size.`;
}

/* ---------- Patterns tab ---------- */

const PAT = { sort: "share", min: 3 };

function initPatterns() {
  $("pSort").addEventListener("change", () => { PAT.sort = $("pSort").value; renderConcessions(); });
  $("pMin").addEventListener("change", () => { PAT.min = Math.max(2, +$("pMin").value || 3); renderConcessions(); });
  for (const id of ["flow", "bGrid", "durMain", "durSmalls", "dpl"]) {
    const g = $(id);
    g.addEventListener("mousemove", (e) => { const c = e.target.closest("[data-t]"); tip(c ? e : null, c ? c.dataset.t : ""); });
    g.addEventListener("mouseleave", () => tip(null));
  }
}

function renderPatterns() {
  const panel = S.panel;
  if (panel.length < 5) {
    $("patStory").textContent = "Too few panel stations for this selection. Widen the filters or lower the minimum coverage.";
  }
  renderDuration(panel);
  renderSpells(panel);
  renderBreadth();
  renderConcessions();
}

/* -- duration curves -- */

/** Sorted (ascending) daily readings of `list` over days [a, b]. */
function pooled(list, a, b) {
  const out = [];
  for (const s of list) for (let i = a; i <= b; i++) { const v = val(s, i); if (v === v) out.push(v); }
  return out.sort((x, y) => x - y);
}
const shareBelow = (sorted, lim) => { if (!sorted.length) return NaN; let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < lim) lo = m + 1; else hi = m; } return lo / sorted.length * 100; };

/** Duration curve as SVG: x = % of time a level is reached or exceeded, y = level. */
function durationSvg(curves, { w = 520, h = 330, small = false } = {}) {
  const used = curves.filter((c) => c.v.length);
  if (!used.length) return '<p class="muted">No data.</p>';
  const ml = small ? 30 : 46, mb = small ? 18 : 34, mt = 8, mr = 8;
  const lo = Math.max(-200, Math.floor(Math.min(...used.map((c) => quant(c.v, 0.005))) / 20) * 20), hi = Math.min(60, Math.ceil(Math.max(...used.map((c) => quant(c.v, 0.995))) / 20) * 20);
  const sx = (p) => ml + p / 100 * (w - ml - mr), sy = (v) => mt + (hi - v) / (hi - lo) * (h - mt - mb);
  let g = `<svg class="dursvg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Duration curve">`;
  const ticks = [];
  for (let v = Math.ceil(lo / 40) * 40; v <= hi; v += 40) ticks.push(v);
  for (const v of ticks) g += `<line x1="${ml}" x2="${w - mr}" y1="${sy(v)}" y2="${sy(v)}" class="gl"/><text class="ax" x="${ml - 5}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`;
  for (const p of small ? [0, 50, 100] : [0, 25, 50, 75, 100]) g += `<text class="ax" x="${sx(p)}" y="${h - (small ? 4 : 14)}" text-anchor="${p === 0 ? "start" : p === 100 ? "end" : "middle"}">${p}${small ? "" : "%"}</text>`;
  if (!small) g += `<text class="ax" x="${(ml + w - mr) / 2}" y="${h - 1}" text-anchor="middle">% of time the level is at or above the line (wet ← → dry)</text>`;
  for (const lim of [THRESH, -80]) if (lim > lo && lim < hi) g += `<line x1="${ml}" x2="${w - mr}" y1="${sy(lim)}" y2="${sy(lim)}" class="lim"/>${small ? "" : `<text class="ax" x="${w - mr - 2}" y="${sy(lim) - 4}" text-anchor="end">${lim} cm</text>`}`;
  for (const c of curves) {
    if (!c.v.length) continue;
    let d = "";
    for (let p = 0; p <= 100; p += 1) d += `${p ? "L" : "M"}${sx(p).toFixed(1)},${sy(quant(c.v, 1 - p / 100)).toFixed(1)}`;
    g += `<path d="${d}" fill="none" stroke="${c.color}" stroke-width="${c.width || 2.2}" ${c.dash ? 'stroke-dasharray="5 3"' : ""} stroke-linejoin="round"/>`;
  }
  return g + "</svg>";
}

function renderDuration(panel) {
  const n = S.f.i1 - S.f.i0 + 1, third = Math.max(7, Math.floor(n / 3));
  const early = pooled(panel, S.f.i0, S.f.i0 + third - 1), late = pooled(panel, S.f.i1 - third + 1, S.f.i1);
  const bE = shareBelow(early, THRESH), bL = shareBelow(late, THRESH), dE = shareBelow(early, -80), dL = shareBelow(late, -80);
  $("durLegend").innerHTML = `<span><i style="background:var(--text-muted)"></i>First ${third} days: <b>${fmt(bE, 0)}%</b> of readings below −40 cm, ${fmt(dE, 0)}% below −80</span>` +
    `<span><i style="background:var(--kind-conc)"></i>Last ${third} days: <b>${fmt(bL, 0)}%</b> below −40 cm, ${fmt(dL, 0)}% below −80</span>`;
  $("durMain").innerHTML = durationSvg([{ v: early, color: css("--text-muted") }, { v: late, color: css("--kind-conc"), width: 2.8 }]);

  // small multiples per province against all panel stations
  const by = new Map();
  for (const s of panel) if (s.adm1) { if (!by.has(s.adm1)) by.set(s.adm1, []); by.get(s.adm1).push(s); }
  const prov = [...by].filter(([, l]) => l.length >= Math.max(5, S.f.minN)).sort((a, b) => b[1].length - a[1].length).slice(0, 12);
  const all = pooled(panel, S.f.i0, S.f.i1);
  $("durSmalls").innerHTML = prov.map(([name, l]) => {
    const v = pooled(l, S.f.i0, S.f.i1), b = shareBelow(v, THRESH);
    return `<figure><figcaption><b>${esc(name)}</b><span class="muted"> ${l.length} stn · <b style="color:var(--text-primary)">${fmt(b, 0)}%</b> below −40</span></figcaption>` +
      durationSvg([{ v: all, color: css("--grid"), width: 3 }, { v, color: css("--kind-conc") }], { w: 260, h: 150, small: true }) + "</figure>";
  }).join("") || '<p class="muted">No province has enough panel stations.</p>';
  $("patStory").innerHTML = panel.length < 5 ? $("patStory").innerHTML
    : `Panel stations spent <b>${fmt(bE, 0)}%</b> of readings below −40 cm in the first ${third} days and <b>${fmt(bL, 0)}%</b> in the last ${third}. ` +
      `The patterns below look past the median: how long stations stay deep, when they move together, and which concessions spend most of the time below the limit.`;
}

/* -- dry spells -- */

/** Longest run of days below `lim`; up to DRY_GAP missing days inside a run do not break it. */
function longestSpell(s, a, b, lim = THRESH) {
  let best = 0, start = -1, last = -1;
  for (let i = a; i <= b; i++) {
    const v = val(s, i);
    if (v !== v) continue;
    if (v < lim) { if (start < 0 || i - last > DRY_GAP + 1) start = i; last = i; best = Math.max(best, last - start + 1); }
    else start = -1;
  }
  return best;
}

const SPELL_BINS = [[0, 0, "never"], [1, 7, "1–7"], [8, 14, "8–14"], [15, 30, "15–30"], [31, 60, "31–60"], [61, 90, "61–90"], [91, 120, "91–120"], [121, 1e9, "> 120"]];

function renderSpells(panel) {
  const sp = memo("spell", () => panel.map((s) => longestSpell(s, S.f.i0, S.f.i1))), bins = SPELL_BINS.map(([lo, hi]) => sp.filter((x) => x >= lo && x <= hi).length);
  const dipped = sp.filter((x) => x > 0), n = sp.length;
  const col = ["--good", "--warning", "--serious", "--serious", "--critical", "--critical", "--critical", "--critical"].map(css);
  chart("cSpell", { type: "bar", data: { labels: SPELL_BINS.map((b) => b[2]), datasets: [{ label: "stations", data: bins, backgroundColor: col, borderWidth: 0, borderRadius: { topLeft: 4, topRight: 4 } }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => `${c[0].label} days`, label: (c) => `${c.raw} stations (${fmt(c.raw / (n || 1) * 100, 0)}%)` } } },
      scales: { x: { title: { display: true, text: "longest consecutive days below −40 cm" } }, y: { title: { display: true, text: "stations" } } } } });
  const long = sp.filter((x) => x > 60).length;
  $("cSpell").closest(".card").querySelector(".note").innerHTML = `Longest run of consecutive days below −40 cm (gaps of up to ${DRY_GAP} days do not break a run). Runs still open at the end of the period count as they stand, so they are lower bounds. ` +
    `<b>${dipped.length}</b> of ${n} panel stations went below the limit; the median longest spell is <b>${fmt(median(dipped), 0)}</b> days and <b>${long}</b> stations stayed below for more than 60 days.`;
}

/* -- breadth -- */

/** Per-day counts of rising / falling stations among those with readings on both of two consecutive days. */
function breadthDays(list) {
  const nd = S.nd, up = new Int32Array(nd), dn = new Int32Array(nd), np = new Int32Array(nd);
  for (const s of list) for (let i = S.f.i0 + 1; i <= S.f.i1; i++) {
    const a = val(s, i - 1), b = val(s, i);
    if (a !== a || b !== b) continue;
    np[i]++; const d = b - a; if (d > BREADTH_CM) up[i]++; else if (d < -BREADTH_CM) dn[i]++;
  }
  return { up, dn, np };
}

function renderBreadth() {
  const B = memo("breadth", () => breadthDays(S.pop)), days = dayRange().slice(1);
  const medN = median(days.map((i) => B.np[i]).filter((x) => x > 0)), minPairs = Math.max(10, medN * 0.3);
  const v = days.map((i) => (B.np[i] >= minPairs ? (B.up[i] - B.dn[i]) / B.np[i] * 100 : null));
  const ma = v.map((_, k) => { const w = v.slice(Math.max(0, k - 3), k + 4).filter((x) => x != null); return w.length >= 4 ? w.reduce((a, b) => a + b, 0) / w.length : null; });
  const span = 25;
  chart("cBreadth", { type: "bar", data: { labels: days.map((i) => S.dates[i]), datasets: [
    { type: "bar", label: "Rising minus falling (% of stations)", data: v, backgroundColor: v.map((x) => (x == null ? "transparent" : divColor(x, 0, span))), borderWidth: 0, barPercentage: 1, categoryPercentage: 1 },
    line("7-day mean", ma, css("--text-primary"), { borderWidth: 1.6, spanGaps: false }),
  ] }, options: { interaction: { mode: "index", intersect: false }, plugins: { legend: legendOpts, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${sgn(c.raw, 0)}%` , afterBody: (it) => { const i = days[it[0].dataIndex]; return `${B.up[i]} rising, ${B.dn[i]} falling of ${B.np[i]} stations`; } } } },
    scales: { x: xTicks, y: { title: { display: true, text: "% rising − % falling" } } } }, plugins: [refLine(0)] });
  const ranked = days.map((i, k) => [S.dates[i], v[k]]).filter((x) => x[1] != null).sort((a, b) => b[1] - a[1]);
  const f = (a) => a.map(([d, x]) => `${d.slice(5)} (${sgn(x, 0)}%)`).join(", ");
  $("breadthNote").innerHTML = ranked.length >= 6 ? `Strongest wetting days: ${f(ranked.slice(0, 3))}. Strongest drying days: ${f(ranked.slice(-3).reverse())}. Days with fewer than ${Math.round(minPairs)} station pairs are left blank.` : "Not enough consecutive readings in this selection.";

  // province x week strip
  const by = new Map();
  for (const s of S.pop) if (s.adm1) { if (!by.has(s.adm1)) by.set(s.adm1, []); by.get(s.adm1).push(s); }
  const rows = [...by].filter(([, l]) => l.length >= Math.max(5, S.f.minN)).sort((a, b) => b[1].length - a[1].length).slice(0, 14).map(([name, l]) => {
    const d = memo("breadth|" + name, () => breadthDays(l)), wk = new Float32Array(S.nw).fill(NaN);
    for (const w of S.weeks) { let u = 0, dd = 0, p = 0; for (let i = Math.max(S.f.i0 + 1, w * 7); i <= Math.min(S.f.i1, w * 7 + 6); i++) { u += d.up[i]; dd += d.dn[i]; p += d.np[i]; } if (p >= 20) wk[w] = (u - dd) / p * 100; }
    return { name, n: l.length, wk };
  });
  const g = $("bGrid"), nW = S.weeks.length;
  g.style.gridTemplateColumns = `minmax(150px, 230px) repeat(${nW}, minmax(14px, 1fr))`;
  let html = '<div class="hh"></div>', lastM = "";
  for (const w of S.weeks) { const d = S.dates[Math.max(0, w * 7)], m = d.slice(0, 7); html += `<div class="hh">${m !== lastM ? new Date(d).toLocaleString("en", { month: "short" }) : ""}</div>`; lastM = m; }
  for (const r of rows) {
    html += `<div class="hl">${esc(r.name)}<small>${r.n} stations</small></div>`;
    for (const w of S.weeks) { const x = r.wk[w]; html += `<div class="hc" style="background:${divColor(x, 0, span)}" data-t="${esc(r.name)}<br>${weekLabel(w)}<br><b>${x === x ? sgn(x, 0) + "%" : "no data"}</b> ${x === x ? "rising − falling" : ""}"></div>`; }
  }
  g.innerHTML = rows.length ? html : '<p class="muted" style="grid-column:1/-1">No province has enough stations.</p>';
  $("bLegend").innerHTML = `<div class="ramp" style="background:${gradient("div")}"></div><div class="row"><span>−${span}% falling</span><span>0</span><span>+${span}% rising</span></div>`;
}

/* -- concessions -- */

function concessionStats() {
  return memo("conc", () => {
    const by = new Map();
    for (const s of S.pop) {
      if (!s.company) continue;
      let below = 0, n = 0;
      for (let i = S.f.i0; i <= S.f.i1; i++) { const v = val(s, i); if (v === v) { n++; if (v < THRESH) below++; } }
      if (n < 20) continue;
      if (!by.has(s.company)) by.set(s.company, { code: s.company, prov: new Map(), st: [] });
      const o = by.get(s.company); o.st.push(below / n * 100); o.prov.set(s.adm1, (o.prov.get(s.adm1) || 0) + 1);
    }
    return [...by.values()].map((o) => {
      const a = o.st.slice().sort((x, y) => x - y);
      return { code: o.code, n: a.length, share: a.reduce((x, y) => x + y, 0) / a.length, p10: quant(a, 0.1), p90: quant(a, 0.9), prov: [...o.prov].sort((x, y) => y[1] - x[1])[0][0] };
    });
  });
}

function renderConcessions() {
  const all = concessionStats(), rows = all.filter((r) => r.n >= PAT.min);
  rows.sort(PAT.sort === "n" ? (a, b) => b.n - a.n || b.share - a.share : PAT.sort === "name" ? (a, b) => a.code.localeCompare(b.code, "en", { numeric: true }) : (a, b) => b.share - a.share);
  $("pInfo").textContent = `${rows.length} of ${all.length} concessions have ≥ ${PAT.min} stations`;
  const pos = (v) => `${Math.max(0, Math.min(100, v))}%`;
  $("dpl").innerHTML = '<div class="dprow head"><span>Concession</span><span>Province</span><span class="num">Stations</span><span class="track"><b style="left:0">0%</b><b style="left:50%">50%</b><b style="right:0">100% of days below −40 cm</b></span><span class="num">Mean</span></div>' +
    rows.map((r) => `<div class="dprow" data-t="<b>${esc(r.code)}</b><br>${r.n} stations<br>mean ${fmt(r.share, 0)}% of days below −40 cm<br>stations 10–90%: ${fmt(r.p10, 0)}–${fmt(r.p90, 0)}%">` +
      `<span>${esc(r.code)}</span><span class="muted">${esc(r.prov)}</span><span class="num">${r.n}</span>` +
      `<span class="track"><i class="rng" style="left:${pos(r.p10)};width:${Math.max(0.6, r.p90 - r.p10)}%"></i><i class="dotm" style="left:${pos(r.share)}"></i></span><span class="num">${fmt(r.share, 0)}%</span></div>`).join("") ||
    '<p class="muted">No concession has enough stations in this selection. Lower the minimum or switch the source to concession points.</p>';
}
