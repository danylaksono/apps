"use strict";
/* Stations table, data-quality tab and the station detail panel. */

const TBL = { sort: "slope", dir: 1, page: 0, size: 50, q: "", rows: [] };
const TBL_COLS = [
  ["name", "Name"], ["kind", "Source"], ["khgName", "KHG"], ["adm2", "Regency"], ["adm1", "Province"], ["cov", "Weeks %", 1], ["now", "Level now", 1],
  ["change", "Change", 1], ["slope", "Trend cm/wk", 1], ["flags", "QC flags", 1], ["spark", "Weekly level"],
];

function initTable() {
  $("tHead").innerHTML = "<tr>" + TBL_COLS.map(([k, t, n]) => `<th data-k="${k}" class="${n ? "num" : ""}">${t}</th>`).join("") + "</tr>";
  $("tHead").addEventListener("click", (e) => { const k = e.target.dataset.k; if (!k || k === "spark") return; TBL.dir = TBL.sort === k ? -TBL.dir : 1; TBL.sort = k; TBL.page = 0; renderTable(); });
  $("tSearch").addEventListener("input", (e) => { TBL.q = e.target.value.toLowerCase(); TBL.page = 0; renderTable(); });
  $("tPrev").onclick = () => { TBL.page = Math.max(0, TBL.page - 1); renderTable(); };
  $("tNext").onclick = () => { TBL.page++; renderTable(); };
  $("tCsv").onclick = exportCsv;
  $("tBody").addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) selectStation(TBL.rows[TBL.page * TBL.size + +tr.dataset.i]); });
}

function renderTable() {
  let rows = S.pop.slice();
  if (TBL.q) rows = rows.filter((s) => [s.name, s.id, s.khgName, s.adm2, s.adm1, s.company].some((x) => (x || "").toLowerCase().includes(TBL.q)));
  const { sort, dir } = TBL, k = sort === "cov" ? (s) => s.cov * 100 : (s) => s[sort];
  rows.sort((a, b) => {
    const x = k(a), y = k(b);
    if (typeof x === "string") return String(x).localeCompare(String(y)) * dir;
    return (x !== x) - (y !== y) || (x - y) * dir;
  });
  TBL.rows = rows;
  const pages = Math.max(1, Math.ceil(rows.length / TBL.size)); TBL.page = Math.min(TBL.page, pages - 1);
  const span = 1.5;
  $("tBody").innerHTML = rows.slice(TBL.page * TBL.size, (TBL.page + 1) * TBL.size).map((s, i) =>
    `<tr data-i="${i}"><td>${esc(s.name)}</td><td>${s.kind}</td><td>${esc(s.khgName)}</td><td>${esc(s.adm2)}</td><td>${esc(s.adm1)}</td>` +
    `<td class="num">${fmt(s.cov * 100, 0)}</td><td class="num">${fmt(s.now, 0)}</td><td class="num">${sgn(s.change)}</td>` +
    `<td class="num"><span class="dot" style="background:${divColor(s.slope, 0, span)}"></span>${sgn(s.slope, 2)}${s.sig ? " ●" : ""}</td><td class="num">${s.flags || ""}</td><td>${sparkline(s.wk, sparkColor(s), 90, 22, THRESH)}</td></tr>`).join("");
  document.querySelectorAll("#tHead th").forEach((th) => th.classList.toggle("sorted", th.dataset.k === sort));
  $("tInfo").textContent = `${rows.length} stations · ● = significant trend`;
  $("tPage").textContent = `page ${TBL.page + 1} / ${pages}`;
}

function exportCsv() {
  const cols = ["name", "kind", "id", "khgName", "adm2", "adm1", "cov", "now", "base", "change", "slope", "z", "flags", "hasLoc"];
  const q = (v) => (typeof v === "number" ? (v === v ? +v.toFixed(3) : "") : JSON.stringify(v ?? ""));
  const out = [cols.join(",")].concat(TBL.rows.map((s) => cols.map((c) => q(s[c])).join(",")));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([out.join("\n")], { type: "text/csv" }));
  a.download = "stations_trends.csv"; a.click();
}

/* ---------- data quality ---------- */

function renderQc() {
  const pop = S.pop, days = dayRange();
  const fl = {}, cov = new Array(10).fill(0), flagged = [];
  for (const s of pop) {
    fl[s.kind] = fl[s.kind] || [0, 0];
    for (const i of days) if (s.flag[i]) { fl[s.kind][s.flag[i] - 1]++; flagged.push([s, i]); }
    cov[Math.min(9, Math.floor(s.cov * 10))]++;
  }
  const kinds = Object.keys(fl);
  chart("cFlags", { type: "bar", data: { labels: kinds, datasets: ["range", "spike"].map((f, k) => ({ label: f, data: kinds.map((x) => fl[x][k]), backgroundColor: css(k ? "--serious" : "--critical"), borderColor: css("--surface"), borderWidth: 1 })) },
    options: { plugins: { legend: legendOpts }, scales: { x: { stacked: true }, y: { stacked: true, title: { display: true, text: "daily readings flagged" } } } } });
  chart("cCov", { type: "bar", data: { labels: cov.map((_, i) => `${i * 10}–${i * 10 + 10}`), datasets: [{ label: "stations", data: cov, backgroundColor: css("--kind-conc"), borderWidth: 0 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { title: { display: true, text: "% of weeks with a weekly median" } }, y: { title: { display: true, text: "stations" } } } } });

  const n = days.map((i) => { let c = 0; for (const s of pop) if (val(s, i) === val(s, i)) c++; return c; });
  const med = median(n), thin = n.map((v) => v < med * 0.5);
  chart("cMiss", { type: "bar", data: { labels: days.map((i) => S.dates[i]), datasets: [{ label: "stations reporting", data: n, backgroundColor: n.map((v, k) => (thin[k] ? css("--critical") : css("--kind-conc"))), borderWidth: 0, barPercentage: 1, categoryPercentage: 1 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: xTicks, y: { title: { display: true, text: "stations with a reading" } } } } });
  $("thinInfo").textContent = `${thin.filter(Boolean).length} thin days (< 50% of the median ${Math.round(med)} stations) shown in red. Weekly medians need ≥ ${MIN_WEEK_DAYS} readings, so isolated gaps are absorbed.`;

  flagged.sort((a, b) => Math.abs(b[0].wl[b[1]]) - Math.abs(a[0].wl[a[1]]));
  $("flagTbl").innerHTML = "<tr><th>Source</th><th>Name</th><th>Date</th><th class='num'>Level cm</th><th>Flag</th></tr>" +
    flagged.slice(0, 200).map(([s, i]) => `<tr><td>${s.kind}</td><td>${esc(s.name)}</td><td>${S.dates[i]}</td><td class="num">${fmt(s.wl[i])}</td><td>${FLAGS[s.flag[i]]}</td></tr>`).join("");

  // location checks (all stations): the join to KHG / province can only be as good as the coordinates
  const odd = new Set(["DI Yogyakarta", "DKI Jakarta", "Sulawesi Barat", "Sulawesi Tengah", "Papua", "Papua Barat", "Lampung"]);
  const issues = [];
  let mismatch = 0;
  for (const s of S.stations) {
    const why = [];
    if (!s.hasLoc) why.push("no usable coordinates");
    else {
      if (s.khg < 0) why.push("outside any KHG (> 5 km)"); else if (s.khgDist > 0) why.push(`${s.khgDist} km outside its KHG`);
      if (!s.adm1) why.push("not inside any province polygon");
      else if (odd.has(s.adm1)) why.push(`unexpected province ${s.adm1}`);
    }
    if (s.provText && s.adm1 && s.provText.toLowerCase() !== s.adm1.toLowerCase()) mismatch++;
    if (why.length) issues.push([s, why.join("; ")]);
  }
  $("locInfo").textContent = `${issues.length} of ${S.stations.length} stations have a location warning. For ${mismatch} stations the portal's provinsi text differs from the province their coordinates fall in (often the company head office); the dashboard uses the coordinates.`;
  $("locTbl").innerHTML = "<tr><th>Source</th><th>Name</th><th>lon, lat</th><th>Portal province</th><th>Warning</th></tr>" +
    issues.map(([s, w]) => `<tr><td>${s.kind}</td><td>${esc(s.name)}</td><td>${fmt(s.lon, 3)}, ${fmt(s.lat, 3)}</td><td>${esc(s.provText)}</td><td>${esc(w)}</td></tr>`).join("");
}

/* ---------- station detail ---------- */

function selectStation(s) {
  S.sel = s; $("detail").classList.remove("hidden"); renderDetail();
}
function closeDetail() { S.sel = null; $("detail").classList.add("hidden"); }

function renderDetail() {
  const s = S.sel; if (!s) return;
  const days = dayRange();
  $("dTitle").textContent = s.name;
  $("dMeta").textContent = [s.kind, s.id, s.khgName && "KHG " + s.khgName, s.adm2, s.adm1, s.company, `now ${fmt(s.now, 0)} cm`, `trend ${sgn(s.slope, 2)} cm/wk${s.sig ? " (significant)" : ""}`, s.flags && `${s.flags} flagged`].filter(Boolean).join(" · ");
  const daily = days.map((i) => { const v = val(s, i); return v === v ? v : null; });
  const wkv = days.map(() => null), tr = days.map(() => null);
  const have = S.weeks.filter((w) => s.wk[w] === s.wk[w]), w0 = have[0], w1 = have[have.length - 1];   // draw the trend only where the station has data
  for (const w of S.weeks) {
    const c = w * 7 + 3 - S.f.i0; if (c < 0 || c >= days.length) continue;
    if (s.wk[w] === s.wk[w]) wkv[c] = s.wk[w];
    if (s.slope === s.slope && w >= w0 && w <= w1) tr[c] = s.icpt + s.slope * w;
  }
  const flagPts = days.map((i) => (s.flag[i] ? s.wl[i] : null));
  chart("cDetail", { type: "line", data: { labels: days.map((i) => S.dates[i]), datasets: [
    line("Daily reading", daily, css("--text-muted"), { borderWidth: 1, pointRadius: 0 }),
    line("Weekly median", wkv, css("--kind-conc"), { borderWidth: 2.5, spanGaps: true, pointRadius: 3 }),
    line("Trend (Theil–Sen)", tr, css("--kind-comm"), { borderWidth: 2, borderDash: [6, 4], spanGaps: true }),
    S.f.noFlag ? null : line("Flagged", flagPts, css("--critical"), { showLine: false, pointRadius: 4 }),
  ].filter(Boolean) }, options: { interaction: { mode: "index", intersect: false }, plugins: { legend: legendOpts }, scales: { x: xTicks, y: { title: { display: true, text: "water level, cm" } } } }, plugins: [refLine(THRESH, "−40 cm")] });
}

// sparkline colour: red when clearly drying, blue when clearly wetting, neutral otherwise
const sparkColor = (s) => (s.sig && s.slope < 0 ? css("--critical") : s.sig && s.slope > 0 ? css("--kind-conc") : css("--text-secondary"));
