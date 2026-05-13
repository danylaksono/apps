import React from 'react';
import useStore from '../store/useStore';

export default function Header() {
  const theme = useStore(s => s.theme);
  const toggleTheme = useStore(s => s.toggleTheme);

  return (
    <header className="sticky-header">
      <div className="logo">
        <div className="logo-icon">⬡</div>
        GEOPARQUET QA
      </div>
      <div className="header-right">
        <button className="theme-btn" onClick={toggleTheme} aria-pressed={theme === 'dark'}>
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
        <a
          className="github-link"
          href="https://github.com/danylaksono/apps/tree/main/dataqa"
          target="_blank"
          rel="noopener noreferrer"
        >
          <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
          </svg>
          GitHub
        </a>
      </div>

      <style>{`
        .sticky-header {
          border-bottom: 1px solid var(--border);
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 56px;
          position: sticky;
          top: 0;
          background: rgba(11, 14, 19, 0.95);
          backdrop-filter: blur(8px);
          z-index: 100;
          flex-shrink: 0;
        }
        .logo {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'Source Code Pro', monospace;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.05em;
          color: var(--amber);
        }
        .logo-icon {
          width: 28px;
          height: 28px;
          background: var(--amber);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--bg);
          font-size: 14px;
          font-weight: 700;
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .theme-btn {
          background: transparent;
          border: 1px solid var(--border2);
          color: var(--text);
          padding: 6px 12px;
          border-radius: 5px;
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.15s;
        }
        .theme-btn:hover {
          border-color: var(--amber);
          color: var(--amber);
        }
        .github-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: #24292e;
          color: #fff;
          text-decoration: none;
          border-radius: 6px;
          font-size: 13px;
          font-family: 'Source Code Pro', monospace;
        }
      `}</style>
    </header>
  );
}
