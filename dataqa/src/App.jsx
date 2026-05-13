import React, { useEffect } from 'react';
import useStore from './store/useStore';
import { getDB } from './lib/duckdb';
import Header from './components/Header';
import DropZone from './components/DropZone';
import FilePills from './components/FilePills';
import Controls from './components/Controls';
import ProgressBar from './components/ProgressBar';
import LogPanel from './components/LogPanel';
import TabBar from './components/TabBar';
import AnalysisResults from './components/AnalysisResults';
import SplitLayout from './components/SplitLayout';
import Toast from './components/Toast';

export default function App() {
  const theme = useStore(s => s.theme);
  const results = useStore(s => s.results);
  const activeTab = useStore(s => s.activeTab);
  const addLog = useStore(s => s.addLog);
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    addLog('Loading DuckDB WASM…', 'info');
    getDB()
      .then(() => addLog('Ready · drop .parquet files to begin', 'ok'))
      .catch(e => addLog(`Failed to initialise DuckDB: ${e.message}`, 'err'));
  }, []);

  const hasResults = results.length > 0;

  return (
    <>
      <Header />

      <main className={`app-main${activeTab === 'map' ? ' app-main--map' : ''}`}>
        <div className="app-content">
          <DropZone />
          <FilePills />
          <Controls />
          <ProgressBar />
          <LogPanel />

          {hasResults && (
            <>
              <TabBar compact={activeTab === 'map'} />

              {activeTab === 'stats' && <AnalysisResults />}

              {activeTab === 'map' && <SplitLayout />}
            </>
          )}

          {!hasResults && (
            <div className="empty">
              <div className="empty-icon">◈</div>
              No data yet — upload .parquet files and run analysis
            </div>
          )}
        </div>
      </main>

      <Toast />

      <style>{`
        .app-main {
          flex: 1;
          display: flex;
          flex-direction: column;
        }
        .app-main--map {
          overflow: hidden;
        }
        .app-content {
          flex: 1;
          padding: 32px;
          max-width: 1600px;
          margin: 0 auto;
          width: 100%;
        }
        .app-main--map .app-content {
          max-width: none;
          padding: 24px 24px 0 24px;
          display: flex;
          flex-direction: column;
        }
        .empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--muted);
          font-family: 'Source Code Pro', monospace;
          font-size: 12px;
        }
        .empty-icon {
          font-size: 32px;
          margin-bottom: 12px;
          opacity: 0.4;
        }
        .map-popup .maplibregl-popup-content {
          background: rgba(11, 14, 19, 0.92);
          border: 1px solid var(--border2);
          border-radius: 6px;
          padding: 10px 14px;
          color: var(--text);
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
        }
        [data-theme='light'] .map-popup .maplibregl-popup-content {
          background: rgba(255, 255, 255, 0.96);
          border: 1px solid var(--border2);
        }
        .map-popup .maplibregl-popup-tip { display: none; }
        .map-popup-content div { margin-bottom: 2px; }
        .map-popup-content strong { color: var(--amber); }
      `}</style>
    </>
  );
}
