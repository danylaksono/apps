import React from 'react';
import { escHtml, fmtN } from '../lib/format';

export default function MiniHistogram({ row }) {
  const minV = parseFloat(row.min), maxV = parseFloat(row.max);
  const p25 = parseFloat(row.q25), p50 = parseFloat(row.q50), p75 = parseFloat(row.q75);

  if (isNaN(minV) || isNaN(maxV) || minV === maxV) return null;

  const buckets = [
    { from: minV, to: p25, h: 0.45 },
    { from: p25, to: p50, h: 0.85 },
    { from: p50, to: p75, h: 1.00 },
    { from: p75, to: maxV, h: 0.55 },
  ].filter(b => !isNaN(b.from) && !isNaN(b.to));

  return (
    <>
      <div className="vis-card">
        <div className="vis-card-title">
          {escHtml(row.col)} · <span style={{ color: 'var(--amber)' }}>{escHtml(row.dtype)}</span>
        </div>
        <div className="hist-bars">
          {buckets.map((b, i) => (
            <div key={i} className="hist-bar" style={{ height: `${Math.round(b.h * 60)}px` }} title={`${fmtN(b.from)} – ${fmtN(b.to)}`} />
          ))}
        </div>
        <div className="hist-range">
          <span>{fmtN(minV)}</span>
          <span>med {fmtN(p50)}</span>
          <span>{fmtN(maxV)}</span>
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
        .hist-bars {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 60px;
        }
        .hist-bar {
          flex: 1;
          background: var(--amber);
          opacity: 0.7;
          border-radius: 2px 2px 0 0;
          min-height: 1px;
          transition: opacity 0.15s;
        }
        .hist-bar:hover { opacity: 1; }
        .hist-range {
          display: flex;
          justify-content: space-between;
          margin-top: 4px;
          font-family: 'Source Code Pro', monospace;
          font-size: 9px;
          color: var(--muted);
        }
      `}</style>
    </>
  );
}
