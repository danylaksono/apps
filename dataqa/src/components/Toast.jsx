import React from 'react';
import useStore from '../store/useStore';

export default function Toast() {
  const toast = useStore(s => s.toast);
  if (!toast) return null;

  return (
    <>
      <div className={`toast show`}>
        <div className={`toast-dot${toast.error ? ' err' : ''}`} />
        <span>{toast.msg}</span>
      </div>

      <style>{`
        .toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: 6px;
          padding: 12px 18px;
          font-family: 'Source Code Pro', monospace;
          font-size: 12px;
          color: var(--text);
          display: flex;
          align-items: center;
          gap: 10px;
          transform: translateY(80px);
          opacity: 0;
          transition: all 0.25s ease;
          z-index: 999;
          pointer-events: none;
        }
        .toast.show {
          transform: translateY(0);
          opacity: 1;
        }
        .toast-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--green);
          flex-shrink: 0;
        }
        .toast-dot.err { background: var(--red); }
      `}</style>
    </>
  );
}
