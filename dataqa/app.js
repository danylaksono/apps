import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.29.0/+esm';

let db = null;
let allResults = [];   // [{laCode, rows, columns}]
let files = new Map(); // name → File

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
  resultsSection.style.display = 'none';
  emptyState.classList.remove('visible');
  csvBtn.disabled = true;
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
    resultsSection.style.display = 'block';
    resultsCount.textContent = `${allResults.length} file${allResults.length > 1 ? 's' : ''} · ${allResults.reduce((s, r) => s + r.rows.length, 0)} columns`;
    csvBtn.disabled = false;
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
