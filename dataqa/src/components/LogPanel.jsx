import React, { useEffect, useRef } from 'react';
import useStore from '../store/useStore';

export default function LogPanel() {
  const logs = useStore(s => s.logs);
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [logs]);

  if (!logs.length) return null;

  return (
    <>
      <div className="log visible" ref={ref}>
        {logs.map(l => (
          <div key={l.id} className={`log-line ${l.type}`}>{l.msg}</div>
        ))}
      </div>

      <style>{`
        .log {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 12px 16px;
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          color: var(--muted);
          margin-top: 20px;
          max-height: 140px;
          overflow-y: auto;
          display: none;
        }
        .log.visible { display: block; }
        .log-line { margin-bottom: 2px; }
        .log-line.ok { color: var(--green); }
        .log-line.err { color: var(--red); }
        .log-line.info { color: var(--amber); }
        .log-line.warn { color: var(--amber-dim); }
      `}</style>
    </>
  );
}
