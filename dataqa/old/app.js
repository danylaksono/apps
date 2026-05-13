import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';
import { MapViewer } from './map.js';
import { AttributeTable } from './table.js';

let db = null;
let allResults = [];   // [{laCode, rows, columns}]
let files = new Map(); // name → File

let mapViewer = null;
let tableViewer = null;

// DOM refs
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListEl = document.getElementById('file-list');
const runBtn = document.getElementById('run-btn');
const clearBtn = document.getElementById('clear-btn');
const csvBtn = document.getElementById('csv-btn');
const themeBtn = document.getElementById('theme-btn');
const sentinelEl = document.getElementById('sentinel-input');
const logEl = document.getElementById('log');
const progressW = document.getElementById('progress-wrap');
const progressFill = document.getElementById('progress-fill');
const resultsSection = document.getElementById('results-section');
const laBlocksEl = document.getElementById('la-blocks');
const resultsCount = document.getElementById('results-count');
const emptyState = document.getElementById('empty-state');
const viewTabs = document.getElementById('view-tabs');
const mapLayerSelect = document.getElementById('map-layer-select');

// Tab logic
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.remove('active');
      c.style.display = 'none';
    });
    
    e.target.classList.add('active');
    const targetId = e.target.getAttribute('data-tab');
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      targetEl.classList.add('active');
      targetEl.style.display = 'block';
    }
    
    // resize maplibre if hidden
    if (targetId === 'map-tab' && mapViewer) {
      setTimeout(() => mapViewer.resize(), 50);
    }
  });
});

async function initDuckDB() {
  const JSDELIVR_BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(JSDELIVR_BUNDLES);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}")`], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.VoidLogger();
  db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  log('DuckDB WASM initialised', 'info');
}

// ── File handling ───────────────────────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', e => addFiles([...e.target.files]));
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  addFiles([...e.dataTransfer.files].filter(f => f.name.endsWith('.parquet')));
});

function addFiles(newFiles) {
  newFiles.forEach(f => files.set(f.name, f));
  renderFilePills();
}

function renderFilePills() {
  fileListEl.innerHTML = '';
  files.forEach((f, name) => {
    const pill = document.createElement('div');
    pill.className = 'file-pill';
    pill.innerHTML = `<span class="badge">parquet</span>${name} <span class="remove" data-name="${name}">✕</span>`;
    fileListEl.appendChild(pill);
  });
  fileListEl.querySelectorAll('.remove').forEach(el =>
    el.addEventListener('click', () => { files.delete(el.dataset.name); renderFilePills(); updateButtons(); })
  );
  updateButtons();
}

function updateButtons() {
  const hasFiles = files.size > 0;
  runBtn.disabled = !hasFiles;
  clearBtn.disabled = !hasFiles && allResults.length === 0;
}

clearBtn.addEventListener('click', () => {
  files.clear();
  allResults = [];
  renderFilePills();
  laBlocksEl.innerHTML = '';
  document.getElementById('stats-tab').style.display = 'none';
  viewTabs.style.display = 'none';
  emptyState.classList.remove('visible');
  csvBtn.disabled = true;
  if (mapViewer) mapViewer.updateData({type: 'FeatureCollection', features: []}, null);
  if (tableViewer) tableViewer.render([], [], null);
  // switch back to stats tab
  document.querySelector('[data-tab="stats-tab"]').click();
  updateButtons();
});

themeBtn.addEventListener('click', toggleTheme);

// ── Theme ───────────────────────────────────────────────────────────────────
function currentTheme() {
  return document.body.classList.contains('light') ? 'light' : 'dark';
}

function applyTheme(theme) {
  const light = theme === 'light';
  document.body.classList.toggle('light', light);
  themeBtn.textContent = light ? 'Dark theme' : 'Light theme';
  themeBtn.setAttribute('aria-pressed', light);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  applyTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

const savedTheme = localStorage.getItem('theme');
applyTheme(savedTheme === 'dark' ? 'dark' : 'light');

// ── Analysis ────────────────────────────────────────────────────────────────
runBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (!db) {
    log('Initialising DuckDB…', 'info');
    try { await initDuckDB(); } catch (e) { log('DuckDB init failed: ' + e.message, 'err'); return; }
  }

  const sentinel = sentinelEl.value.trim();
  allResults = [];
  laBlocksEl.innerHTML = '';
  logEl.classList.add('visible');
  runBtn.disabled = true;
  csvBtn.disabled = true;
  progressW.classList.add('visible');

  const fileArr = [...files.values()];
  for (let i = 0; i < fileArr.length; i++) {
    const f = fileArr[i];
    const pct = Math.round((i / fileArr.length) * 100);
    progressFill.style.width = pct + '%';
    log(`[${i + 1}/${fileArr.length}] Processing: ${f.name}`, 'info');
    try {
      const result = await processFile(f, sentinel);
      allResults.push(result);
      renderLaBlock(result);
      log(`    ✓ ${result.rows.length} columns summarised`, 'ok');
    } catch (e) {
      log(`    ✗ ${e.message}`, 'err');
    }
  }

  progressFill.style.width = '100%';
  setTimeout(() => progressW.classList.remove('visible'), 600);

  if (allResults.length) {
    document.getElementById('stats-tab').style.display = 'block';
    viewTabs.style.display = 'flex';
    resultsCount.textContent = `${allResults.length} file${allResults.length > 1 ? 's' : ''} · ${allResults.reduce((s, r) => s + r.rows.length, 0)} columns`;
    csvBtn.disabled = false;
    populateMapSelect();
    toast('Analysis complete ✓');
  } else {
    emptyState.classList.add('visible');
    toast('No results produced', true);
  }
  runBtn.disabled = false;
}

async function processFile(file, sentinel) {
  const buf = await file.arrayBuffer();
  await db.registerFileBuffer(file.name, new Uint8Array(buf));
  const conn = await db.connect();

  const safeName = file.name.replace(/'/g, "''");

  try {
    const schemaResult = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${safeName}')`);
    const schema = schemaResult.toArray().map(r => ({
      col: r.column_name,
      dtype: r.column_type
    }));

    const geomCols = new Set(
      schema.filter(s => /geometry|wkb_geometry|geom/i.test(s.col) || /^(WKB|BLOB|BIT)$/i.test(s.dtype))
        .map(s => s.col)
    );

    const totalResult = await conn.query(`SELECT COUNT(*) AS n FROM read_parquet('${safeName}')`);
    const totalRows = Number(totalResult.toArray()[0].n);

    const statCols = schema.filter(s => !geomCols.has(s.col));
    if (!statCols.length) throw new Error('No non-geometry columns found');

    const rows = [];
    for (const { col, dtype } of statCols) {
      const q = `"${col.replace(/"/g, '""')}"`;
      const isNum = /INT|FLOAT|DOUBLE|DECIMAL|NUMERIC|REAL|HUGEINT|BIGINT|SMALLINT|TINYINT/i.test(dtype);
      const isBool = /BOOL/i.test(dtype);
      const sentNum = sentinel !== '' && !isNaN(Number(sentinel)) ? Number(sentinel) : null;

      let sentinelPred = '';
      if (sentinel !== '') {
        if (isNum && sentNum !== null) {
          sentinelPred = `AND ${q} <> ${sentNum}`;
        } else {
          sentinelPred = `AND TRY_CAST(${q} AS VARCHAR) <> '${sentinel.replace(/'/g, "''")}'`;
        }
      }

      let nullCount = 0;
      try {
        const nullRes = await conn.query(`
          SELECT COUNT(*) AS valid
          FROM read_parquet('${safeName}')
          WHERE ${q} IS NOT NULL
          ${sentinelPred}
        `);
        const valid = Number(nullRes.toArray()[0].valid);
        nullCount = totalRows - valid;
      } catch (_) {
        nullCount = totalRows;
      }

      let count = 0, mean = null, std = null, min = null, q25 = null, q50 = null, q75 = null, max = null;
      let unique = null, top = null, freq = null;

      if (isNum || isBool) {
        try {
          const r = await conn.query(`
            SELECT
              COUNT(${q})                                                          AS cnt,
              AVG(${q}::DOUBLE)                                                   AS avg,
              STDDEV(${q}::DOUBLE)                                                AS std,
              MIN(${q})                                                            AS mn,
              MAX(${q})                                                            AS mx,
              PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${q}::DOUBLE)          AS p25,
              PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY ${q}::DOUBLE)          AS p50,
              PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${q}::DOUBLE)          AS p75
            FROM read_parquet('${safeName}')
            WHERE ${q} IS NOT NULL
            ${sentinelPred}
          `);
          const row = r.toArray()[0];
          count = Number(row?.cnt ?? 0);
          mean = fmt(row?.avg);
          std = fmt(row?.std);
          min = fmt(row?.mn);
          max = fmt(row?.mx);
          q25 = fmt(row?.p25);
          q50 = fmt(row?.p50);
          q75 = fmt(row?.p75);
        } catch (e) {
          console.warn(`numeric stats failed for ${col}:`, e.message);
        }

      } else {
        try {
          const r = await conn.query(`
            SELECT
              COUNT(${q})          AS cnt,
              COUNT(DISTINCT ${q}) AS uniq
            FROM read_parquet('${safeName}')
            WHERE ${q} IS NOT NULL
            ${sentinelPred}
          `);
          const row = r.toArray()[0];
          count = Number(row?.cnt ?? 0);
          unique = Number(row?.uniq ?? 0);
        } catch (e) {
          console.warn(`count failed for ${col}:`, e.message);
        }

        try {
          const topRes = await conn.query(`
            SELECT ${q}::VARCHAR AS val, COUNT(*) AS n
            FROM read_parquet('${safeName}')
            WHERE ${q} IS NOT NULL
            ${sentinelPred}
            GROUP BY val
            ORDER BY n DESC
            LIMIT 1
          `);
          const topRow = topRes.toArray()[0];
          if (topRow) { top = String(topRow.val ?? ''); freq = Number(topRow.n ?? 0); }
        } catch (_) { }
      }

      rows.push({ col, dtype, nullCount, count, mean, std, min, q25, q50, q75, max, unique, top, freq });
    }

    await conn.close();

    return {
      laCode: file.name.replace(/\.parquet$/i, ''),
      totalRows,
      rows,
      columns: statCols.map(s => s.col)
    };
  } catch (e) {
    await conn.close();
    throw e;
  }
}

function fmt(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  if (isNaN(n)) return String(v);
  if (Math.abs(n) >= 1e6) return n.toExponential(3);
  if (Number.isInteger(n)) return n.toString();
  return n.toPrecision(6).replace(/\.?0+$/, '');
}

function renderLaBlock(result) {
  const block = document.createElement('div');
  block.className = 'la-block';
  block.innerHTML = `
    <div class="la-header">
      <span class="la-code">${escHtml(result.laCode)}</span>
      <span class="la-meta">${result.totalRows.toLocaleString()} rows · ${result.rows.length} columns</span>
      <span class="la-chevron">▶</span>
    </div>
    <div class="la-body">
      ${buildTable(result)}
      <div class="vis-section">
        <div class="vis-grid">${buildVis(result)}</div>
      </div>
    </div>
  `;
  block.querySelector('.la-header').addEventListener('click', () => block.classList.toggle('open'));
  laBlocksEl.appendChild(block);
  if (laBlocksEl.children.length === 1) block.classList.add('open');
}

const COL_HEADERS = ['Column', 'Dtype', 'NULLs', 'count', 'mean', 'std', 'min', '25%', '50%', '75%', 'max', 'unique', 'top', 'freq'];

function buildTable(result) {
  const ths = COL_HEADERS.map(h => `<th>${h}</th>`).join('');
  const trs = result.rows.map(r => {
    const nullPct = result.totalRows ? r.nullCount / result.totalRows : 0;
    const nullClass = nullPct > 0.3 ? 'null-high' : nullPct > 0.05 ? 'null-mid' : 'null-low';
    const cells = [
      `<td class="col-name">${escHtml(r.col)}</td>`,
      `<td><span class="col-dtype">${escHtml(r.dtype)}</span></td>`,
      `<td class="null-cell ${nullClass}">${r.nullCount.toLocaleString()}</td>`,
      ...['count', 'mean', 'std', 'min', 'q25', 'q50', 'q75', 'max', 'unique', 'top', 'freq'].map(k => {
        const v = r[k];
        return v === null || v === undefined
          ? `<td class="val-na">—</td>`
          : `<td class="val-num">${escHtml(String(v))}</td>`;
      })
    ];
    return `<tr>${cells.join('')}</tr>`;
  }).join('');

  return `<div class="table-wrap"><table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`;
}

function buildVis(result) {
  let html = '';

  const sortedByNull = [...result.rows].sort((a, b) => b.nullCount - a.nullCount).slice(0, 10);
  if (sortedByNull.length) {
    const bars = sortedByNull.map(r => {
      const pct = result.totalRows ? Math.round(r.nullCount / result.totalRows * 100) : 0;
      const color = pct > 30 ? 'var(--red)' : pct > 5 ? 'var(--amber)' : 'var(--green)';
      return `<div class="null-bar-row">
        <div class="null-bar-label" title="${escHtml(r.col)}">${escHtml(r.col)}</div>
        <div class="null-bar-track"><div class="null-bar-fill" style="width:${pct}%;background:${color}"></div></div>
        <div class="null-bar-pct">${pct}%</div>
      </div>`;
    }).join('');
    html += `<div class="vis-card">
      <div class="vis-card-title">NULL % BY COLUMN (top 10)</div>
      <div class="null-bar-list">${bars}</div>
    </div>`;
  }

  const numRows = result.rows.filter(r => r.mean !== null && r.min !== null && r.max !== null);
  numRows.slice(0, 8).forEach(r => {
    const minV = parseFloat(r.min), maxV = parseFloat(r.max);
    const p25 = parseFloat(r.q25), p50 = parseFloat(r.q50), p75 = parseFloat(r.q75);
    if (isNaN(minV) || isNaN(maxV) || minV === maxV) return;

    const buckets = [
      { from: minV, to: p25, h: 0.45 },
      { from: p25, to: p50, h: 0.85 },
      { from: p50, to: p75, h: 1.00 },
      { from: p75, to: maxV, h: 0.55 },
    ].filter(b => !isNaN(b.from) && !isNaN(b.to));

    const bars = buckets.map(b =>
      `<div class="hist-bar" style="height:${Math.round(b.h * 60)}px" title="${fmtN(b.from)} – ${fmtN(b.to)}"></div>`
    ).join('');

    html += `<div class="vis-card">
      <div class="vis-card-title">${escHtml(r.col)} · <span style="color:var(--amber)">${escHtml(r.dtype)}</span></div>
      <div class="hist-bars">${bars}</div>
      <div class="hist-range"><span>${fmtN(minV)}</span><span>med ${fmtN(p50)}</span><span>${fmtN(maxV)}</span></div>
    </div>`;
  });

  return html || '<div style="font-family:\'IBM Plex Mono\',monospace;font-size:11px;color:var(--muted);padding:4px">No visualisations available</div>';
}

function fmtN(v) {
  if (isNaN(v)) return '?';
  if (Math.abs(v) >= 1e6) return v.toExponential(2);
  return parseFloat(v.toPrecision(4)).toString();
}

csvBtn.addEventListener('click', () => {
  if (!allResults.length) return;
  const headers = ['LA', ...COL_HEADERS];
  const rowData = allResults.flatMap(r =>
    r.rows.map(row => [
      r.laCode, row.col, row.dtype, row.nullCount,
      row.count ?? '', row.mean ?? '', row.std ?? '',
      row.min ?? '', row.q25 ?? '', row.q50 ?? '', row.q75 ?? '', row.max ?? '',
      row.unique ?? '', row.top ?? '', row.freq ?? ''
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
  );
  const csv = [headers.join(','), ...rowData].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'geoparquet_qa_summary.csv';
  a.click();
  toast('CSV exported ✓');
});

function log(msg, type = '') {
  const line = document.createElement('div');
  line.className = 'log-line ' + type;
  line.textContent = msg;
  logEl.appendChild(line);
  logEl.scrollTop = logEl.scrollHeight;
}

function escHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

let toastTimer;
function toast(msg, err = false) {
  const t = document.getElementById('toast');
  const dot = document.getElementById('toast-dot');
  document.getElementById('toast-msg').textContent = msg;
  dot.className = 'toast-dot' + (err ? ' err' : '');
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

(async () => {
  try {
    log('Loading DuckDB WASM…', 'info');
    await initDuckDB();
    log('Ready · drop .parquet files to begin', 'ok');
  } catch (e) {
    log('Failed to initialise DuckDB: ' + e.message, 'err');
  }
})();

// Extract the first [lon, lat] coordinate from any GeoJSON geometry for CRS sniffing
function getFirstCoord(geom) {
  if (!geom || !geom.coordinates) return null;
  let c = geom.coordinates;
  while (Array.isArray(c[0])) c = c[0];
  return c;
}

// Pure-JS WKB → GeoJSON decoder (no external library needed)
// Supports: Point, LineString, Polygon, Multi* in LE/BE byte order
function wkbToGeoJSON(raw) {
  // raw may be Uint8Array, ArrayBuffer, or hex string
  let bytes;
  if (typeof raw === 'string') {
    // hex string
    const hex = raw.startsWith('\\x') ? raw.slice(2) : raw;
    bytes = new Uint8Array(hex.match(/.{1,2}/g).map(b => parseInt(b, 16)));
  } else if (raw instanceof Uint8Array) {
    bytes = raw;
  } else {
    bytes = new Uint8Array(raw);
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset);
  let pos = 0;

  function readUint8() { return view.getUint8(pos++); }
  function readUint32(le) { const v = view.getUint32(pos, le); pos += 4; return v; }
  function readFloat64(le) { const v = view.getFloat64(pos, le); pos += 8; return v; }

  function readGeom() {
    const le = readUint8() === 1; // byte order: 1=LE, 0=BE
    const type = readUint32(le) & 0xFFFF; // mask off EWKB flags
    switch (type) {
      case 1: return { type: 'Point', coordinates: readPoint(le) };
      case 2: return { type: 'LineString', coordinates: readPoints(le) };
      case 3: return { type: 'Polygon', coordinates: readRings(le) };
      case 4: return { type: 'MultiPoint', coordinates: readGeoms(le).map(g => g.coordinates) };
      case 5: return { type: 'MultiLineString', coordinates: readGeoms(le).map(g => g.coordinates) };
      case 6: return { type: 'MultiPolygon', coordinates: readGeoms(le).map(g => g.coordinates) };
      default: throw new Error(`Unsupported WKB type: ${type}`);
    }
  }

  function readPoint(le) { return [readFloat64(le), readFloat64(le)]; }
  function readPoints(le) { const n = readUint32(le); return Array.from({length: n}, () => readPoint(le)); }
  function readRings(le) { const n = readUint32(le); return Array.from({length: n}, () => readPoints(le)); }
  function readGeoms(le) { const n = readUint32(le); return Array.from({length: n}, () => readGeom()); }

  return readGeom();
}


function populateMapSelect() {
  mapLayerSelect.innerHTML = allResults.map(r => `<option value="${r.laCode}">${r.laCode}</option>`).join('');
  mapLayerSelect.onchange = (e) => loadMapData(e.target.value);
  
  if (allResults.length > 0) {
    loadMapData(allResults[0].laCode);
  }
}

async function loadMapData(laCode) {
  if (!mapViewer) {
    mapViewer = new MapViewer('map-container', 'map-tooltip');
    tableViewer = new AttributeTable('tanstack-table-container', 'table-toolbar', 'table-pagination');
    initSplitHandle();
  }

  const result = allResults.find(r => r.laCode === laCode);
  const file = [...files.values()].find(f => f.name.replace(/\.parquet$/i, '') === laCode);
  if (!file || !result) return;

  log(`Loading spatial data for ${laCode}...`, 'info');
  const safeName = file.name.replace(/'/g, "''");
  
  const conn = await db.connect();
  try {
    // Register EPSG:27700 with proj4 for client-side fallback
    if (window.proj4 && !window.proj4.defs('EPSG:27700')) {
      window.proj4.defs('EPSG:27700', '+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs');
    }

    // Load spatial extension
    let useSpatial = false;
    try {
      await conn.query('INSTALL spatial; LOAD spatial;');
      useSpatial = true;
    } catch(e) {
      console.warn('Spatial extension failed, using wkx fallback');
    }

    const schemaRes = await conn.query(`DESCRIBE SELECT * FROM read_parquet('${safeName}')`);
    const schema = schemaRes.toArray();

    // Detect geometry column by name or type
    const geomField = schema.find(s =>
      /geometry|wkb_geometry|geom/i.test(s.column_name) ||
      /^(WKB|BLOB|GEOMETRY)$/i.test(s.column_type)
    );
    const geomCol = geomField ? geomField.column_name : 'geometry';
    const geomQ = `"${geomCol}"`;

    // ── Coordinate transformer (client-side proj4 fallback) ────────────────
    const transformCoords = (coords) => {
      if (typeof coords[0] === 'number') {
        if (coords[0] > 180 || coords[1] > 90 || coords[0] < -180 || coords[1] < -90) {
          if (window.proj4) {
            const p = window.proj4('EPSG:27700', 'EPSG:4326', [coords[0], coords[1]]);
            return [p[0], p[1]];
          }
        }
        return coords;
      }
      return coords.map(transformCoords);
    };

    // ── Build query ─────────────────────────────────────────────────────────
    // When spatial extension is loaded, DuckDB auto-promotes GeoParquet geometry
    // columns to GEOMETRY type. ST_GeomFromWKB only works on BLOB/WKB_BLOB.
    // We must detect the actual type and wrap accordingly.
    const geomType = (geomField?.column_type || '').toUpperCase();
    const isBlob = /^(BLOB|WKB_BLOB|WKB)$/.test(geomType);
    // geomExpr: how to reference the geometry in spatial function calls
    const geomExpr = (useSpatial && isBlob) ? `ST_GeomFromWKB(${geomQ})` : geomQ;

    let q;
    let usedTransform = false;

    if (useSpatial) {
      // 1. Probe one row to detect CRS by sniffing coordinate range
      let needs27700 = false;
      try {
        const probeQ = `SELECT ST_AsGeoJSON(${geomExpr}) AS _g
                        FROM read_parquet('${safeName}')
                        WHERE ${geomQ} IS NOT NULL LIMIT 1`;
        const probeRes = await conn.query(probeQ);
        const probeRow = probeRes.toArray()[0];
        if (probeRow && probeRow._g) {
          const probeGeom = JSON.parse(probeRow._g);
          const fc = getFirstCoord(probeGeom);
          // Coords outside WGS84 bounds → projected CRS (e.g. EPSG:27700)
          if (fc && (Math.abs(fc[0]) > 180 || Math.abs(fc[1]) > 90)) {
            needs27700 = true;
          }
        }
      } catch(e) {
        console.warn('Geometry probe failed:', e.message);
      }

      if (needs27700) {
        try {
          q = `SELECT ST_AsGeoJSON(ST_Transform(${geomExpr}, 'EPSG:27700', 'EPSG:4326', always_xy => true)) AS _geojson,
                      * EXCLUDE (${geomQ})
               FROM read_parquet('${safeName}')`;
          await conn.query(q + ' LIMIT 1'); // validate
          usedTransform = true;
          log('Detected EPSG:27700 — reprojecting to WGS84 via ST_Transform', 'info');
        } catch(e) {
          console.warn('ST_Transform failed, falling back to client-side proj4:', e.message);
          q = null;
        }
      }

      if (!q) {
        q = `SELECT ST_AsGeoJSON(${geomExpr}) AS _geojson,
                    * EXCLUDE (${geomQ})
             FROM read_parquet('${safeName}')`;
      }
    } else {
      // No spatial extension — fetch raw bytes, decode WKB in JS
      q = `SELECT * FROM read_parquet('${safeName}')`;
    }


    // ── Execute & build features ────────────────────────────────────────────
    const res = await conn.query(q);
    const arrowRows = res.toArray();

    const features = [];
    const propsList = [];

    for (const r of arrowRows) {
      const obj = r.toJSON();
      let geom = null;

      if (useSpatial && obj._geojson) {
        try {
          geom = JSON.parse(obj._geojson);
        } catch(_) {}
        delete obj._geojson;
        // Apply client-side reproject only when ST_Transform wasn't used
        if (!usedTransform && geom && geom.coordinates && window.proj4) {
          try { geom.coordinates = transformCoords(geom.coordinates); } catch(_) {}
        }
      } else if (!useSpatial && obj[geomCol]) {
        // Decode raw WKB bytes → GeoJSON using pure JS (no wkx needed)
        try {
          geom = wkbToGeoJSON(obj[geomCol]);
          if (geom && geom.coordinates && window.proj4) {
            try { geom.coordinates = transformCoords(geom.coordinates); } catch(_) {}
          }
        } catch(e) { console.warn('WKB decode failed:', e.message); }
        delete obj[geomCol];
      }

      if (!geom || !geom.coordinates) continue;

      features.push({ type: 'Feature', geometry: geom, properties: obj });
      propsList.push(obj);
    }

    const geojson = { type: 'FeatureCollection', features };
    const columns = Object.keys(propsList[0] || {}).filter(c => c !== geomCol && c !== '_geojson');

    if (features.length === 0) {
      log('Warning: 0 valid geometries found — check geometry column / CRS', 'err');
    } else {
      log(`Loaded ${features.length} features for ${laCode}`, 'ok');
    }

    mapViewer.updateData(geojson, (hoveredProps) => {
      tableViewer.highlightRow(hoveredProps);
    });

    tableViewer.render(propsList, columns, (hoveredProps) => {
      mapViewer.highlightFeature(hoveredProps);
    });

    log(`Spatial data loaded for ${laCode}`, 'ok');
  } catch(e) {
    log(`Failed to load spatial data: ${e.message}`, 'err');
    console.error('loadMapData error:', e);
  } finally {
    await conn.close();
  }
}

// ── Resizable split handle ──────────────────────────────────────────────────
function initSplitHandle() {
  const layout = document.getElementById('map-table-layout');
  const handle = document.getElementById('split-handle');
  const mapPane = document.getElementById('map-pane');
  const tablePane = document.getElementById('table-pane');
  if (!layout || !handle || !mapPane || !tablePane) return;

  let dragging = false;
  let startY = 0;
  let startMapH = 0;
  let startTableH = 0;

  handle.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragging = true;
    startY = e.clientY;
    startMapH = mapPane.getBoundingClientRect().height;
    startTableH = tablePane.getBoundingClientRect().height;
    handle.classList.add('active');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  });

  document.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    const total = startMapH + startTableH;
    const minH = 100;
    let newMapH = Math.max(minH, Math.min(total - minH, startMapH + dy));
    let newTableH = total - newMapH;

    mapPane.style.flex = `0 0 ${newMapH}px`;
    tablePane.style.flex = `0 0 ${newTableH}px`;

    if (mapViewer) mapViewer.resize();
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    if (mapViewer) mapViewer.resize();
  });

  // Touch support
  handle.addEventListener('touchstart', (e) => {
    const t = e.touches[0];
    dragging = true;
    startY = t.clientY;
    startMapH = mapPane.getBoundingClientRect().height;
    startTableH = tablePane.getBoundingClientRect().height;
    handle.classList.add('active');
  }, { passive: true });

  document.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const t = e.touches[0];
    const dy = t.clientY - startY;
    const total = startMapH + startTableH;
    const minH = 100;
    let newMapH = Math.max(minH, Math.min(total - minH, startMapH + dy));
    let newTableH = total - newMapH;

    mapPane.style.flex = `0 0 ${newMapH}px`;
    tablePane.style.flex = `0 0 ${newTableH}px`;

    if (mapViewer) mapViewer.resize();
  }, { passive: true });

  document.addEventListener('touchend', () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('active');
    if (mapViewer) mapViewer.resize();
  });
}
