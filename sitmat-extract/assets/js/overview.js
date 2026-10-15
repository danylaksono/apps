"use strict";
/* Overview tab: is the water table going down, how fast, and where. */

const wkLabels = () => S.weeks.map((w) => S.dates[Math.max(0, w * 7)]);
const wkData = (arr) => S.weeks.map((w) => (arr[w] === arr[w] ? arr[w] : null));

function renderOverview() {
  const pop = S.pop, panel = S.panel, minN = S.f.minN;
  const an = weeklySeries(panel, "anom", 5), lev = weeklySeries(panel, "wk", 5), all = weeklySeries(pop, "wk", 5), sh = classShares(panel, 5);
  const tr = trendOf(an.med), withData = pop.filter((s) => s.nv > 0).length;
  const change = lastMean(an.med), startBelow = firstMean(sh.below, 2), endBelow = lastMean(sh.below, 2);
  const sl = panel.filter((s) => s.slope === s.slope), dry = sl.filter((s) => s.sig && s.slope < 0).length, wet = sl.filter((s) => s.sig && s.slope > 0).length;

  $("kpis").innerHTML = [
    [`${panel.length}`, `panel stations <small>of ${withData} with data</small>`, `reporting ≥ ${Math.round(S.f.minCov * 100)}% of weeks`],
    [`${sgn(change)} cm`, "change since start", `last 4 wk vs first 4 wk, median of panel`],
    [`${sgn(tr.slope, 2)} cm/wk`, "trend (Theil–Sen)", tr.slope !== tr.slope ? "range too short" : tr.sig ? "significant at 95%" : "not significant at 95%"],
    [`${fmt(startBelow, 0)}% → ${fmt(endBelow, 0)}%`, "panel below −40 cm", "first 2 weeks → last 2 weeks"],
    [`${sl.length ? fmt(dry / sl.length * 100, 0) : "–"}%`, "stations clearly drying", `${sl.length ? fmt(wet / sl.length * 100, 0) : "–"}% clearly wetting`],
  ].map(([b, t, n]) => `<div class="kpi"><b>${b}</b><span>${t}</span><em>${n}</em></div>`).join("");

  $("story").innerHTML = panel.length < 5
    ? "Too few panel stations for this selection. Widen the filters or lower the minimum coverage."
    : `In the <b>${panel.length}</b> panel stations the median water table is <b>${sgn(change)} cm</b> relative to the start of the period ` +
      `(${tr.sig ? "" : "not "}a significant monotonic trend, ${sgn(tr.slope, 2)} cm/week). The share of panel stations below −40 cm went from <b>${fmt(startBelow, 0)}%</b> to <b>${fmt(endBelow, 0)}%</b>. ` +
      `Stations are compared with their own first weeks, so changes in which stations report do not drive this number.`;

  const labels = wkLabels();
  chart("cAnom", { type: "line", data: { labels, datasets: [
    line("_q1", wkData(an.q1), "transparent", { borderWidth: 0 }),
    line("Middle 50% of stations", wkData(an.q3), "transparent", { borderWidth: 0, fill: "-1", backgroundColor: css("--band") }),
    line("Panel median", wkData(an.med), css("--kind-conc"), { borderWidth: 2.5 }),
  ] }, options: { interaction: { mode: "index", intersect: false }, plugins: { legend: legendOpts }, scales: { x: xTicks, y: { title: { display: true, text: "cm vs station's own start" } } } }, plugins: [refLine(0, "start")] });

  chart("cLevel", { type: "line", data: { labels, datasets: [
    line("Panel median level", wkData(lev.med), css("--kind-conc"), { borderWidth: 2.5 }),
    line("All reporting stations", wkData(all.med), css("--text-muted"), { borderWidth: 1.6, borderDash: [5, 3] }),
  ] }, options: { interaction: { mode: "index", intersect: false }, plugins: { legend: legendOpts }, scales: { x: xTicks, y: { title: { display: true, text: "water level, cm" } } } }, plugins: [refLine(THRESH, "−40 cm")] });

  chart("cShare", { type: "bar", data: { labels, datasets: CLASSES.map((c) => ({ label: c.label, data: wkData(sh[c.k]), backgroundColor: css(c.tok), borderColor: css("--surface"), borderWidth: { top: 2 }, barPercentage: 1, categoryPercentage: 0.9 })).reverse() },
    options: { interaction: { mode: "index", intersect: false }, plugins: { legend: legendOpts }, scales: { x: Object.assign({ stacked: true }, xTicks), y: { stacked: true, max: 100, title: { display: true, text: "% of panel stations" } } } } });

  // slope histogram
  const sw = 0.25, lo = -3, hi = 3, nb = (hi - lo) / sw, bins = new Array(nb).fill(0);
  for (const s of sl) bins[Math.max(0, Math.min(nb - 1, Math.floor((s.slope - lo) / sw)))]++;
  chart("cSlopes", { type: "bar", data: { labels: bins.map((_, i) => sgn(lo + i * sw, 1)), datasets: [{ label: "stations", data: bins, backgroundColor: bins.map((_, i) => divColor(lo + (i + 0.5) * sw, 0, 1.2)), borderWidth: 0, barPercentage: 1, categoryPercentage: 0.92 }] },
    options: { plugins: { legend: { display: false }, tooltip: { callbacks: { title: (c) => `from ${c[0].label} cm/week` } } }, scales: { x: { title: { display: true, text: "station trend, cm/week (outer bins include anything beyond ±3)" }, ticks: { maxTicksLimit: 9 } }, y: { title: { display: true, text: "stations" } } } } });

  // distribution of levels: first vs last weeks
  const d0 = new Map(), d1 = new Map(); let bmin = -Infinity, bmax = Infinity;
  const put = (m, v) => { const b = Math.floor(Math.max(-200, Math.min(40, v)) / 10) * 10; m.set(b, (m.get(b) || 0) + 1); bmin = Math.max(bmin, b); bmax = Math.min(bmax, b); };
  for (const s of panel) { put(d0, s.base); const e = lastMean(s.wk, 4); if (e === e) put(d1, e); }
  const bl = []; for (let b = bmax; b <= bmin; b += 10) bl.push(b);
  chart("cDist", { type: "bar", data: { labels: bl.map(String), datasets: [
    { label: "first 4 weeks", data: bl.map((b) => d0.get(b) || 0), backgroundColor: css("--text-muted"), borderColor: css("--surface"), borderWidth: 1 },
    { label: "last 4 weeks", data: bl.map((b) => d1.get(b) || 0), backgroundColor: css("--kind-conc"), borderColor: css("--surface"), borderWidth: 1 },
  ] }, options: { plugins: { legend: legendOpts }, scales: { x: { title: { display: true, text: "station median level, cm (10 cm bins, start of bin)" }, ticks: { maxTicksLimit: 12 } }, y: { title: { display: true, text: "stations" } } } } });

  // province bars
  const pr = regionStats("adm1").filter((r) => r.nP >= minN && r.slope === r.slope).sort((a, b) => a.slope - b.slope);
  chart("cProv", { type: "bar", data: { labels: pr.map((r) => r.name), datasets: [{ label: "cm/week", data: pr.map((r) => r.slope), backgroundColor: pr.map((r) => divColor(r.slope, 0, 1.5)), borderWidth: 0 }] },
    options: { indexAxis: "y", plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${sgn(c.raw, 2)} cm/week`, afterLabel: (c) => `${pr[c.dataIndex].nP} panel stations, change ${sgn(pr[c.dataIndex].curChange)} cm` } } }, scales: { x: { title: { display: true, text: "trend of regional median, cm/week" } } } } });

  renderTransitions(panel);
}
