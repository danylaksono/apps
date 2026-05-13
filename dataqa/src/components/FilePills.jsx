import React from 'react';
import useStore from '../store/useStore';

export default function FilePills() {
  const files = useStore(s => s.files);
  const removeFile = useStore(s => s.removeFile);
  const entries = Object.entries(files);

  if (!entries.length) return null;

  return (
    <>
      <div className="file-list">
        {entries.map(([name]) => (
          <div key={name} className="file-pill">
            <span className="badge">parquet</span>
            {name}
            <span className="remove" onClick={() => removeFile(name)}>✕</span>
          </div>
        ))}
      </div>

      <style>{`
        .file-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 20px;
        }
        .file-pill {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: 4px;
          padding: 5px 10px;
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          color: var(--text);
        }
        .file-pill .badge {
          background: var(--amber-dim);
          color: var(--amber);
          border-radius: 3px;
          padding: 1px 5px;
          font-size: 10px;
          font-weight: 600;
        }
        .file-pill .remove {
          cursor: pointer;
          color: var(--muted);
          font-size: 13px;
          line-height: 1;
          padding: 0 2px;
          transition: color 0.15s;
        }
        .file-pill .remove:hover { color: var(--red); }
      `}</style>
    </>
  );
}
