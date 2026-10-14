"use strict";
/* Data tab: searchable, filterable table of the daily readings or the weekly medians. */

const D = { rows: new Uint32Array(0), view: "daily", sort: { k: "date", dir: -1 }, page: 0 };
const D_COLS = {
  daily: [["date", "Date"], ["kind", "Source"], ["name", "Station"], ["khgName", "KHG"], ["adm2", "Regency"], ["adm1", "Province"], ["level", "Level cm", 1], ["status", "Status"], ["flag", "QC flag"], ["spark", "Weekly level"]],
  weekly: [["date", "Week start"], ["kind", "Source"], ["name", "Station"], ["khgName", "KHG"], ["adm2", "Regency"], ["adm1", "Province"], ["level", "Weekly median cm", 1], ["base", "Baseline cm", 1], ["change", "Change cm", 1], ["spark", "Weekly level"]],
};

function initData() {
  S.stations.forEach((s, i) => { s._i = i; s._q = [s.name, s.id, s.khgName, s.adm2, s.adm1, s.company].join(" ").toLowerCase(); });
  $("dStatus").innerHTML += STATUS.map((x) => `<option>${x}</option>`).join("");
  ["dView", "dFlag", "dStatus", "dMin", "dMax", "dSize"].forEach((id) => $(id).addEventListener("change", () => { D.page = 0; if (id === "dView") D.sort = { k: "date", dir: -1 }; renderData(); }));
  $("dSearch").addEventListener("input", () => { D.page = 0; renderData(); });
  $("dHead").addEventListener("click", (e) => {
    const k = e.target.closest("th")?.dataset.k; if (!k || k === "spark") return;
    D.sort = { k, dir: D.sort.k === k ? -D.sort.dir : 1 }; D.page = 0; sortRows(); drawDataPage();
  });
  $("dPrev").onclick = () => { D.page = Math.max(0, D.page - 1); drawDataPage(); };
  $("dNext").onclick = () => { D.page++; drawDataPage(); };
  $("dCsv").onclick = exportData;
  $("dBody").addEventListener("click", (e) => { const tr = e.target.closest("tr"); if (tr) selectStation(S.stations[+tr.dataset.s]); });
}

// station and period of a row index
const dRow = (idx) => (D.view === "daily" ? [S.stations[Math.floor(idx / S.nd)], idx % S.nd] : [S.stations[Math.floor(idx / S.nw)], idx % S.nw]);

function renderData() {
  D.view = $("dView").value;
  document.querySelectorAll(".dailyOnly").forEach((el) => el.classList.toggle("hidden", D.view !== "daily"));
  const q = $("dSearch").value.toLowerCase().trim(), flag = $("dFlag").value, st = $("dStatus").value ? STATUS.indexOf($("dStatus").value) : -2;
  const lo = $("dMin").value === "" ? -Infinity : +$("dMin").value, hi = $("dMax").value === "" ? Infinity : +$("dMax").value;
  const terms = q ? q.split(/\s+/) : [];
  const out = [], { i0, i1 } = S.f;
  for (const s of S.pop) {
    if (terms.length && !terms.every((t) => s._q.includes(t))) continue;
    if (D.view === "daily") {
      for (let i = i0; i <= i1; i++) {
        const v = s.wl[i]; if (v !== v || v < lo || v > hi) continue;
        const f = s.flag[i];
        if (flag === "clean" ? f : flag === "flagged" ? !f : flag ? FLAGS[f] !== flag : false) continue;
        if (st !== -2 && s.status[i] !== st) continue;
        out.push(s._i * S.nd + i);
      }
    } else {
      for (const w of S.weeks) { const v = s.wk[w]; if (v === v && v >= lo && v <= hi) out.push(s._i * S.nw + w); }
    }
  }
  D.rows = Uint32Array.from(out);
  sortRows(); drawDataPage();
}

function sortKey(k) {
  const daily = D.view === "daily";
  return (idx) => {
    const [s, p] = dRow(idx);
    switch (k) {
      case "date": return p;
      case "level": return daily ? s.wl[p] : s.wk[p];
      case "base": return s.base;
      case "change": return s.anom[p];
      case "status": return s.status[p];
      case "flag": return s.flag[p];
      default: return s[k] || "";
    }
  };
}

function sortRows() {
  const key = sortKey(D.sort.k), dir = D.sort.dir, arr = Array.from(D.rows), cache = new Map(arr.map((i) => [i, key(i)]));
  arr.sort((a, b) => {
    const x = cache.get(a), y = cache.get(b);
    if (typeof x === "string") return x.localeCompare(y) * dir || a - b;
    return ((x !== x) - (y !== y)) || (x - y) * dir || a - b;
  });
  D.rows = Uint32Array.from(arr);
}

function drawDataPage() {
  const cols = D_COLS[D.view], n = D.rows.length, size = +$("dSize").value, pages = Math.max(1, Math.ceil(n / size));
  D.page = Math.min(D.page, pages - 1);
  $("dHead").innerHTML = "<tr>" + cols.map(([k, t, num]) => {
    const on = D.sort.k === k;
    return `<th data-k="${k}" class="${num ? "num" : ""}${on ? " sorted" : ""}">${t}${on ? (D.sort.dir > 0 ? " ↑" : " ↓") : ""}</th>`;
  }).join("") + "</tr>";
  let html = "";
  for (let r = D.page * size; r < Math.min(n, (D.page + 1) * size); r++) {
    const [s, p] = dRow(D.rows[r]), daily = D.view === "daily";
    const lead = daily ? S.dates[p] : S.dates[Math.max(0, p * 7)];
    const cells = daily
      ? [`<td class="num">${fmt(s.wl[p], 1)}</td>`, `<td>${STATUS[s.status[p]] || ""}</td>`, `<td>${FLAGS[s.flag[p]]}</td>`]
      : [`<td class="num">${fmt(s.wk[p], 1)}</td>`, `<td class="num">${fmt(s.base, 1)}</td>`, `<td class="num">${sgn(s.anom[p])}</td>`];
    html += `<tr data-s="${s._i}"><td>${lead}</td><td>${s.kind}</td><td>${esc(s.name)}</td><td>${esc(s.khgName)}</td><td>${esc(s.adm2)}</td><td>${esc(s.adm1)}</td>${cells.join("")}<td>${sparkline(s.wk, sparkColor(s), 90, 22, THRESH)}</td></tr>`;
  }
  $("dBody").innerHTML = html || `<tr><td colspan="${cols.length}" class="muted">No rows match.</td></tr>`;
  $("dInfo").textContent = `${n.toLocaleString()} rows · ${S.pop.length} stations in the filters above`;
  $("dPage").textContent = `page ${D.page + 1} / ${pages}`;
}

function exportData() {
  const daily = D.view === "daily", head = D_COLS[D.view].filter((c) => c[0] !== "spark").map((c) => c[1]);
  const q = (v) => (typeof v === "number" ? (v === v ? +v.toFixed(2) : "") : JSON.stringify(v ?? ""));
  const lines = [head.join(",")];
  for (const idx of D.rows) {
    const [s, p] = dRow(idx);
    const row = [daily ? S.dates[p] : S.dates[Math.max(0, p * 7)], s.kind, s.name, s.khgName, s.adm2, s.adm1,
      ...(daily ? [s.wl[p], STATUS[s.status[p]] || "", FLAGS[s.flag[p]]] : [s.wk[p], s.base, s.anom[p]])];
    lines.push(row.map(q).join(","));
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
  a.download = `sitmat_${D.view}.csv`; a.click();
}
