"use strict";
/* SiTMAT Explorer bootstrap: filters, tabs, refresh loop. Modules live in assets/js/. */

const RENDER = {
  overview: () => renderOverview(), patterns: () => renderPatterns(), map: () => renderMap(), compare: () => renderCompare(),
  heat: () => renderHeat(), table: () => renderTable(), data: () => renderData(), qc: () => renderQc(),
};

function fillSelect(id, items, allLabel, keep) {
  const el = $(id), cur = keep ? el.value : "";
  el.innerHTML = `<option value="">${allLabel}</option>` + items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
  el.value = items.some(([v]) => String(v) === cur) ? cur : "";
}

// province -> regency -> KHG option lists: only places with at least one station that has readings, for the chosen source
const hasReadings = (s) => s._any ?? (s._any = s.wl.some((v) => v === v));

function fillGeoSelects() {
  const kind = $("fKind").value;
  const live = S.stations.filter((s) => s.hasLoc && hasReadings(s) && (kind === "all" || s.kind === kind));
  const count = (list, key, label) => { const m = new Map(); for (const s of list) { const k = key(s); if (k === "" || k === -1) continue; const o = m.get(k) || { label: label(s), n: 0 }; o.n++; m.set(k, o); } return [...m].map(([k, o]) => [k, `${o.label} (${o.n})`, o.label]).sort((a, b) => a[2].localeCompare(b[2])); };
  fillSelect("fProv", count(live, (s) => s.adm1, (s) => s.adm1).map(([k, t]) => [k, t]), "All provinces", true);
  const prov2 = $("fProv").value, inP = live.filter((s) => !prov2 || s.adm1 === prov2);
  fillSelect("fReg", count(inP, (s) => s.adm2id, (s) => s.adm2).map(([k, t]) => [k, t]), "All regencies", true);
  const reg2 = $("fReg").value, inR = inP.filter((s) => !reg2 || String(s.adm2id) === reg2);
  fillSelect("fKhg", count(inR, (s) => s.khg, (s) => s.khgName).map(([k, t]) => [k, t]), "All KHG", true);
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
  if (e && ["fKind", "fProv", "fReg"].includes(e.target.id)) fillGeoSelects();
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
  $("dClose").onclick = closeDetail;
  addEventListener("keydown", (e) => { if (e.key === "Escape" && S.sel) closeDetail(); });
  initMap(); initCompare(); initHeat(); initTable(); initData(); initPatterns();
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
