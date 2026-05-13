import React from 'react';
import { escHtml } from '../lib/format';

const COL_HEADERS = [
  'Column', 'Dtype', 'NULLs', 'count', 'mean', 'std',
  'min', '25%', '50%', '75%', 'max', 'unique', 'top', 'freq'
];

const STAT_KEYS = [
  'count', 'mean', 'std', 'min', 'q25', 'q50', 'q75', 'max', 'unique', 'top', 'freq'
];

export default function StatsTable({ result }) {
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COL_HEADERS.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {result.rows.map(r => {
              const nullPct = result.totalRows ? r.nullCount / result.totalRows : 0;
              const nullClass = nullPct > 0.3 ? 'null-high' : nullPct > 0.05 ? 'null-mid' : 'null-low';
              return (
                <tr key={r.col}>
                  <td className="col-name">{escHtml(r.col)}</td>
                  <td><span className="col-dtype">{escHtml(r.dtype)}</span></td>
                  <td className={`null-cell ${nullClass}`}>{r.nullCount.toLocaleString()}</td>
                  {STAT_KEYS.map(k => {
                    const v = r[k];
                    return v === null || v === undefined
                      ? <td key={k} className="val-na">—</td>
                      : <td key={k} className="val-num">{escHtml(String(v))}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <style>{`
        .table-wrap {
          overflow: auto;
          max-height: 80vh;
          border-top: 1px solid var(--border);
        }
        table {
          width: 100%;
          border-collapse: collapse;
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
        }
        th {
          background: var(--surface);
          color: var(--muted);
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          font-size: 10px;
          padding: 8px 12px;
          text-align: right;
          border-bottom: 1px solid var(--border2);
          white-space: nowrap;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        th:first-child, th:nth-child(2), th:nth-child(3) { text-align: left; }
        td {
          padding: 7px 12px;
          border-bottom: 1px solid var(--border2);
          text-align: right;
          color: var(--text);
          white-space: nowrap;
        }
        td:first-child, td:nth-child(2), td:nth-child(3) { text-align: left; }
        tr:last-child td { border-bottom: none; }
        tr:hover td { background: var(--highlight); }
        .col-name { color: var(--text); font-weight: 500; }
        .col-dtype {
          color: var(--blue);
          font-size: 10px;
          background: var(--blue-dim);
          padding: 2px 6px;
          border-radius: 3px;
          display: inline-block;
        }
        .null-cell { font-weight: 600; }
        .null-high { color: var(--red); }
        .null-mid { color: var(--amber); }
        .null-low { color: var(--green); }
        .val-num { color: var(--blue); }
        .val-na { color: var(--border2); }
      `}</style>
    </>
  );
}
