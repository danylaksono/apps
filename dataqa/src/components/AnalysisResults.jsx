import React from 'react';
import useStore from '../store/useStore';
import StatsTable from './StatsTable';
import NullBarChart from './NullBarChart';
import MiniHistogram from './MiniHistogram';

export default function AnalysisResults() {
  const results = useStore(s => s.results);
  if (!results.length) return null;

  return (
    <>
      <div className="section-header">
        <span className="section-title">Statistical Summary</span>
        <span className="section-count mono">
          {results.length} file{results.length > 1 ? 's' : ''} ·{' '}
          {results.reduce((s, r) => s + r.rows.length, 0)} columns
        </span>
      </div>

      <div className="la-blocks">
        {results.map((result, i) => (
          <AccordionBlock key={result.laCode} result={result} defaultOpen={i === 0} />
        ))}
      </div>

      <style>{`
        .section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 36px 0 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--border);
        }
        .section-title {
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--amber);
        }
        .section-count { font-size: 11px; color: var(--muted); }
        .la-blocks { display: flex; flex-direction: column; gap: 4px; }
      `}</style>
    </>
  );
}

function AccordionBlock({ result, defaultOpen }) {
  const [open, setOpen] = React.useState(defaultOpen);

  return (
    <>
      <div className={`la-block${open ? ' open' : ''}`}>
        <div className="la-header" onClick={() => setOpen(!open)}>
          <span className="la-code mono">{result.laCode}</span>
          <span className="la-meta mono">
            {result.totalRows.toLocaleString()} rows · {result.rows.length} columns
          </span>
          <span className="la-chevron">▶</span>
        </div>
        <div className="la-body">
          <StatsTable result={result} />
          <div className="vis-section">
            <div className="vis-grid">
              <NullBarChart result={result} />
              {result.rows
                .filter(r => r.mean !== null && r.min !== null && r.max !== null)
                .slice(0, 8)
                .map(r => (
                  <MiniHistogram key={r.col} row={r} />
                ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .la-block {
          border: 1px solid var(--border);
          border-radius: 6px;
          overflow: hidden;
        }
        .la-header {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 11px 16px;
          background: var(--surface);
          cursor: pointer;
          user-select: none;
          transition: background 0.15s;
        }
        .la-header:hover { background: var(--highlight); }
        .la-code {
          font-size: 12px;
          font-weight: 600;
          color: var(--amber);
        }
        .la-meta { font-size: 11px; color: var(--muted); flex: 1; }
        .la-chevron {
          color: var(--muted);
          font-size: 12px;
          transition: transform 0.2s;
        }
        .la-block.open .la-chevron { transform: rotate(90deg); }
        .la-body { display: none; }
        .la-block.open .la-body { display: block; }
        .vis-section {
          padding: 16px;
          border-top: 1px solid var(--border);
        }
        .vis-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 12px;
        }
      `}</style>
    </>
  );
}
