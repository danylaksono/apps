"use strict";
/* SiTMAT Explorer bootstrap: filters, tabs, refresh loop. Modules live in assets/js/. */

const RENDER = {
  overview: () => renderOverview(), map: () => renderMap(), compare: () => renderCompare(),
  heat: () => renderHeat(), table: () => renderTable(), data: () => renderData(), qc: () => renderQc(),
};

function fillSelect(id, items, allLabel, keep) {
  const el = $(id), cur = keep ? el.value : "";
  el.innerHTML = `<option value="">${allLabel}</option>` + items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  el.value = items.some(([v]) => String(v) === cur) ? cur : "";
}

// province -> regency -> KHG option lists depend on the selections above them
function fillGeoSelects() {
  const prov = $("fProv").value, reg = $("fReg").value;
  const inProv = (s) => !prov || s.adm1 === prov;
  fillSelect("fReg", uniq(S.stations.filter((s) => s.adm2id >= 0 && inProv(s)).map((s) => [s.adm2id, s.adm2])), "All regencies", true);
  const reg2 = $("fReg").value;
  fillSelect("fKhg", uniq(S.stations.filter((s) => s.khg >= 0 && inProv(s) && (!reg2 || String(s.adm2id) === reg2)).map((s) => [s.khg, s.khgName])), "All KHG", true);
}
function uniq(pairs) {
  const m = new Map(pairs.map(([k, v]) => [k, v]));
  return [...m].sort((a, b) => String(a[1]).localeCompare(String(b[1])));
}

function readFilters() {
  const f = S.f, before = [f.adm1, f.adm2, f.khg, f.kind].join("|");
  f.kind = $("fKind").value; f.adm1 = $("fProv").value; f.adm2 = $("fReg").value; f.khg = $("fKhg").value;
  f.noFlag = $("fNoFlag").checked; f.minCov = +$("fCov").value; f.minN = Math.max(1, +$("fMinN").value || 2);
  let a = S.dates.indexOf($("fFrom").value), b = S.dates.indexOf($("fTo").value);
  if (a < 0) a = 0; if (b < 0) b = S.nd - 1; if (a > b) [a, b] = [b, a];
  f.i0 = a; f.i1 = b;
  if (before !== [f.adm1, f.adm2, f.khg, f.kind].join("|")) M.fitPending = true;
}

function onFilter(e) {
  if (e && (e.target.id === "fProv" || e.target.id === "fReg")) fillGeoSelects();
  readFilters(); S.regSel = null; refresh();
}

function applyRegionFilter(level, key) {
  const info = S.info[level].get(key) || {};
  $("fProv").value = level === "adm1" ? key : level === "adm2" ? info.parent || "" : "";
  fillGeoSelects();
  $("fReg").value = level === "adm2" ? String(key) : "";
  fillGeoSelects();
  $("fKhg").value = level === "khg" ? String(key) : "";
  onFilter();
}

function showTab(t) {
  S.tab = t;
  document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  document.querySelectorAll("main > section[id^=tab-]").forEach((s) => s.classList.toggle("hidden", s.id !== "tab-" + t));
  if (t === "map") M.map.invalidateSize();
  refresh();
}

function refresh() {
  deriveStations(); selectPop();
  $("fCount").textContent = `${S.pop.length} stations in view · ${S.panel.length} in panel · ${S.f.i1 - S.f.i0 + 1} days`;
  RENDER[S.tab]();
  if (S.sel) renderDetail();
  if (S.tab === "map" && S.regSel) regionCard(S.regSel.level, S.regSel.key, "mReg", "cMapReg");
}

function initUi() {
  fillSelect("fProv", [...new Set(S.stations.map((s) => s.adm1).filter(Boolean))].sort().map((p) => [p, p]), "All provinces");
  fillGeoSelects();
  $("fFrom").min = $("fTo").min = S.dates[0]; $("fFrom").max = $("fTo").max = S.dates[S.nd - 1];
  $("fFrom").value = S.dates[0]; $("fTo").value = S.dates[S.nd - 1];
  $("subtitle").textContent = `${S.stations.length} stations · ${S.dates[0]} → ${S.dates[S.nd - 1]} · weekly medians, per-station change and trends`;
  $("qcText").textContent = S.qcText || "Not available.";
  ["fKind", "fProv", "fReg", "fKhg", "fFrom", "fTo", "fNoFlag", "fCov", "fMinN"].forEach((id) => $(id).addEventListener("change", onFilter));
  $("tabs").addEventListener("click", (e) => { const t = e.target.dataset.tab; if (t) showTab(t); });
  $("themeBtn").onclick = () => {
    const el = document.documentElement; el.dataset.theme = isDark() ? "light" : "dark";
    M.layersKey = ""; M.ctxKey = ""; refresh();
  };
  $("dClose").onclick = () => { S.sel = null; $("detail").classList.add("hidden"); };
  initMap(); initCompare(); initHeat(); initTable(); initData();
  if (!S.geo.khg) $("geoWarn").classList.remove("hidden");
  readFilters();
  const h = location.hash.slice(1);
  if (document.querySelector(`[data-tab="${h}"]`)) showTab(h); else refresh();
}

(async function start() {
  try {
    await loadAll(DATA_DIR + "daily_long.csv", DATA_DIR + "stations.csv");
  } catch (err) {
    console.error(err);
    $("loadMsg").textContent = "Could not load " + DATA_DIR + " (" + (err && err.message ? err.message : "fetch failed") + ")";
    $("picker").classList.remove("hidden");
    $("fGo").onclick = async () => {
      const a = $("fLong").files[0], b = $("fSt").files[0], c = $("fGeo").files[0];
      if (!a || !b) return;
      try { await loadAll(a, b, c); } catch (e) { $("loadMsg").textContent = "Failed to parse files: " + e.message; return; }
      $("loading").classList.add("hidden"); $("app").classList.remove("hidden"); initUi();
    };
    return;
  }
  $("loading").classList.add("hidden"); $("app").classList.remove("hidden");
  initUi();
})();
