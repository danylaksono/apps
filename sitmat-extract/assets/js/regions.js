"use strict";
/* Compare tab (ranking, community vs concession) and Heatmap tab (region x week). */

const CMP = { sort: "slope", dir: 1 };
const CMP_COLS = [
  ["name", "Name"], ["parent", "Province"], ["n", "Stations", 1], ["nP", "Panel", 1], ["curLevel", "Level now", 1], ["curChange", "Change", 1],
  ["slope", "Trend cm/wk", 1], ["curBelow", "Below −40", 1], ["dry", "Drying %", 1], ["spark", "Change over time"],
];

function renderCompare() {
  const level = $("cmpLevel").value;
  let rows = regionStats(level).filter((r) => r.n >= S.f.minN);
  const q = ($("cmpSearch").value || "").toLowerCase();
  if (q) rows = rows.filter((r) => (r.name + " " + r.parent).toLowerCase().includes(q));
  const k = CMP.sort;
  rows.sort((a, b) => {
    const x = a[k], y = b[k];
    if (typeof x === "string") return x.localeCompare(y) * CMP.dir;
    return (x !== x) - (y !== y) || (x - y) * CMP.dir;
  });
  $("cmpHead").innerHTML = "<tr>" + CMP_COLS.map(([key, t, n]) => `<th data-k="${key}" class="${n ? "num" : ""}${key === k ? " sorted" : ""}">${t}${key === k ? (CMP.dir > 0 ? " ↑" : " ↓") : ""}</th>`).join("") + "</tr>";
  const span = Math.max(8, quant(rows.map((r) => Math.abs(r.curChange)).filter((v) => v === v).sort((a, b) => a - b), 0.95) || 8);
  $("cmpBody").innerHTML = rows.map((r) => {
    const col = (v, s) => `<span class="dot" style="background:${divColor(v, 0, s)}"></span>`;
    return `<tr data-k="${r.key}"${S.regSel && S.regSel.level === level && String(S.regSel.key) === String(r.key) ? ' class="sel"' : ""}>` +
      `<td>${esc(r.name)}</td><td>${esc(r.parent)}</td><td class="num">${r.n}</td><td class="num">${r.nP}</td><td class="num">${fmt(r.curLevel, 0)}</td>` +
      `<td class="num">${col(r.curChange, span)}${sgn(r.curChange)}</td><td class="num">${col(r.slope, 1.5)}${sgn(r.slope, 2)}${r.sig ? " ●" : ""}</td>` +
      `<td class="num">${fmt(r.startBelow, 0)}→${fmt(r.curBelow, 0)}%</td><td class="num">${fmt(r.dry, 0)}</td><td>${sparkline(r.an.med, css("--kind-conc"))}</td></tr>`;
  }).join("") || `<tr><td colspan="10" class="muted">No ${PLURAL[level]} with at least ${S.f.minN} stations in this selection.</td></tr>`;
  $("cmpInfo").textContent = `${rows.length} ${PLURAL[level]} · ● = significant trend (Mann–Kendall, 95%)`;
  if (S.regSel && S.regSel.level === level) regionCard(level, S.regSel.key, "cReg", "cCmpReg");
  else $("cReg").innerHTML = '<p class="muted">Click a row to see the regional series and its most-drying stations.</p>';
  renderSharing();
}

function initCompare() {
  $("cmpLevel").addEventListener("change", () => { S.regSel = null; renderCompare(); });
  $("cmpSearch").addEventListener("input", renderCompare);
  $("cmpHead").addEventListener("click", (e) => {
    const k = e.target.closest("th")?.dataset.k; if (!k || k === "spark") return;
    CMP.dir = CMP.sort === k ? -CMP.dir : 1; CMP.sort = k; renderCompare();
  });
  $("cmpBody").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-k]"); if (!tr) return; const level = $("cmpLevel").value; selectRegion(level, level === "adm1" ? tr.dataset.k : +tr.dataset.k); });
  $("cReg").addEventListener("click", (e) => { const tr = e.target.closest("tr[data-st]"); if (tr) selectStation(S.stations[+tr.dataset.st]); });
}

/** Concession vs community water level inside the same KHG (the 'water sharing' comparison). */
function renderSharing() {
  const f = S.f, by = new Map();
  for (const s of S.stations) {
    if (s.khg < 0 || s.mean !== s.mean || (f.adm1 && s.adm1 !== f.adm1) || (f.adm2 && String(s.adm2id) !== f.adm2) || (f.khg && String(s.khg) !== f.khg)) continue;
    if (!by.has(s.khg)) by.set(s.khg, { conc: [], comm: [] });
    by.get(s.khg)[s.kind === "community" ? "comm" : "conc"].push(s.mean);
  }
  const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const pts = [...by].filter(([, g]) => g.conc.length && g.comm.length).map(([id, g]) => ({ x: avg(g.conc), y: avg(g.comm), id, nc: g.conc.length, nm: g.comm.length, name: (S.info.khg.get(id) || {}).name }));
  $("shareInfo").textContent = `${pts.length} KHG have both kinds of station with data in the selected dates.`;
  const lim = pts.length ? [Math.min(-120, ...pts.map((p) => Math.min(p.x, p.y))), Math.max(20, ...pts.map((p) => Math.max(p.x, p.y)))] : [-120, 20];
  chart("cShare2", { type: "scatter", data: { datasets: [
    { label: "KHG", data: pts, backgroundColor: css("--kind-comm"), borderColor: css("--surface"), borderWidth: 1.5, pointRadius: 6, pointHoverRadius: 8 },
    { label: "1:1", type: "line", data: [{ x: lim[0], y: lim[0] }, { x: lim[1], y: lim[1] }], borderColor: css("--text-muted"), borderDash: [5, 4], borderWidth: 1, pointRadius: 0 }] },
    options: { plugins: { legend: { display: false }, tooltip: { filter: (i) => i.datasetIndex === 0, callbacks: { label: (c) => { const p = c.raw; return [`${p.name}`, `concession ${fmt(p.x, 0)} cm (${p.nc} stn)`, `community ${fmt(p.y, 0)} cm (${p.nm} stn)`]; } } } },
      scales: { x: { min: lim[0], max: lim[1], title: { display: true, text: "concession points, mean level (cm)" } }, y: { min: lim[0], max: lim[1], title: { display: true, text: "community stations, mean level (cm)" } } } } });
}

/* ---------- heatmap: region x week ---------- */

function initHeat() {
  ["hLevel", "hMetric", "hSort"].forEach((id) => $(id).addEventListener("change", renderHeat));
  const g = $("hGrid");
  g.addEventListener("mousemove", (e) => { const c = e.target.closest("[data-t]"); tip(c ? e : null, c ? c.dataset.t : ""); });
  g.addEventListener("mouseleave", () => tip(null));
}

function renderHeat() {
  const level = $("hLevel").value, metric = $("hMetric").value, sort = $("hSort").value;
  const needPanel = metric === "change";
  let rows = regionStats(level).filter((r) => (needPanel ? r.nP : r.n) >= S.f.minN);
  const keyOf = { slope: (r) => r.slope, now: (r) => r[metric === "change" ? "curChange" : metric === "share" ? "curBelow" : "curLevel"], n: (r) => -r.n, name: null };
  rows.sort(sort === "name" ? (a, b) => (a.parent + a.name).localeCompare(b.parent + b.name) : (a, b) => ((keyOf[sort](a) !== keyOf[sort](a)) - (keyOf[sort](b) !== keyOf[sort](b))) || (keyOf[sort](a) - keyOf[sort](b)));
  const ser = (r) => (metric === "change" ? r.an.med : metric === "share" ? r.sh.below : r.lev.med);
  let span = 8;
  if (metric === "change") { const a = []; for (const r of rows) for (const w of S.weeks) a.push(Math.abs(ser(r)[w])); span = Math.max(8, quant(a.filter((v) => v === v).sort((x, y) => x - y), 0.95) || 8); }
  const color = (v) => (metric === "change" ? divColor(v, 0, span) : metric === "share" ? seqColor(v, 0, 100) : divColor(v, THRESH, 40));
  const unit = metric === "share" ? "% below −40 cm" : "cm";
  const nW = S.weeks.length, g = $("hGrid");
  g.style.gridTemplateColumns = `minmax(150px, 230px) repeat(${nW}, minmax(14px, 1fr))`;
  let html = '<div class="hh"></div>';
  let lastM = "";
  for (const w of S.weeks) { const d = S.dates[Math.max(0, w * 7)], m = d.slice(0, 7); html += `<div class="hh">${m !== lastM ? new Date(d).toLocaleString("en", { month: "short" }) : ""}</div>`; lastM = m; }
  for (const r of rows) {
    html += `<div class="hl" title="${esc(r.parent)}">${esc(r.name)}<small>${r.parent && level !== "adm1" ? esc(r.parent) : ""} · ${needPanel ? r.nP : r.n}</small></div>`;
    for (const w of S.weeks) {
      const v = ser(r)[w];
      html += `<div class="hc" style="background:${color(v)}" data-t="${esc(r.name)}<br>${weekLabel(w)}<br><b>${v === v ? (metric === "change" ? sgn(v) : fmt(v, 0)) : "no data"}</b> ${v === v ? unit : ""}"></div>`;
    }
  }
  g.innerHTML = rows.length ? html : `<p class="muted" style="grid-column:1/-1">No ${PLURAL[level]} with enough stations (minimum ${S.f.minN}).</p>`;
  const lo = metric === "share" ? "0%" : metric === "change" ? sgn(-span, 0) : "−80", hi = metric === "share" ? "100%" : metric === "change" ? sgn(span, 0) : "0";
  $("hLegend").innerHTML = `<div class="ramp" style="background:${gradient(metric === "share" ? "seq" : "div")}"></div><div class="row"><span>${lo}</span><span>${metric === "change" ? "0 = start" : metric === "level" ? "−40 limit" : ""}</span><span>${hi}</span></div>`;
}
