import React from 'react';
import { escHtml } from '../lib/format';

export default function NullBarChart({ result }) {
  const sorted = [...result.rows]
    .sort((a, b) => b.nullCount - a.nullCount)
    .slice(0, 10);

  if (!sorted.length) return null;

  return (
    <>
      <div className="vis-card">
        <div className="vis-card-title">NULL % BY COLUMN (top 10)</div>
        <div className="null-bar-list">
          {sorted.map(r => {
            const pct = result.totalRows ? Math.round(r.nullCount / result.totalRows * 100) : 0;
            const color = pct > 30 ? 'var(--red)' : pct > 5 ? 'var(--amber)' : 'var(--green)';
            return (
              <div key={r.col} className="null-bar-row">
                <div className="null-bar-label" title={escHtml(r.col)}>{escHtml(r.col)}</div>
                <div className="null-bar-track">
                  <div className="null-bar-fill" style={{ width: `${pct}%`, background: color }} />
                </div>
                <div className="null-bar-pct">{pct}%</div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        .vis-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px 14px;
        }
        .vis-card-title {
          font-family: 'Source Code Pro', monospace;
          font-size: 10px;
          color: var(--muted);
          margin-bottom: 10px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .null-bar-list {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .null-bar-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'Source Code Pro', monospace;
          font-size: 10px;
        }
        .null-bar-label {
          color: var(--muted);
          width: 110px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          text-align: right;
          flex-shrink: 0;
        }
        .null-bar-track {
          flex: 1;
          background: var(--bg);
          border-radius: 2px;
          height: 10px;
          overflow: hidden;
        }
        .null-bar-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 0.4s ease;
        }
        .null-bar-pct {
          color: var(--text);
          width: 36px;
          text-align: right;
          flex-shrink: 0;
        }
      `}</style>
    </>
  );
}
