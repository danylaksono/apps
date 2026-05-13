import React from 'react';
import useStore from '../store/useStore';

export default function TabBar({ compact }) {
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const results = useStore(s => s.results);

  if (!results.length) return null;

  return (
    <>
      <div className={`tabs${compact ? ' tabs--compact' : ''}`}>
        <button
          className={`tab-btn${activeTab === 'stats' ? ' active' : ''}`}
          onClick={() => setActiveTab('stats')}
        >
          Statistical Summary
        </button>
        <button
          className={`tab-btn${activeTab === 'map' ? ' active' : ''}`}
          onClick={() => setActiveTab('map')}
        >
          Map & Data
        </button>
      </div>

      <style>{`
        .tabs {
          display: flex;
          gap: 16px;
          margin-top: 24px;
          border-bottom: 1px solid var(--border);
        }
        .tabs--compact {
          margin-top: 12px;
        }
        .tab-btn {
          background: none;
          border: none;
          color: var(--muted);
          font-family: 'Source Code Pro', monospace;
          font-size: 12px;
          font-weight: 600;
          padding: 8px 12px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }
        .tab-btn:hover { color: var(--text); }
        .tab-btn.active {
          color: var(--amber);
          border-bottom-color: var(--amber);
        }
      `}</style>
    </>
  );
}
