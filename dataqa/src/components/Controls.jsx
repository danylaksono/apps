import React, { useCallback } from 'react';
import useStore from '../store/useStore';
import { analyzeFile } from '../lib/analysis';
import { generateCSV } from '../lib/csv';
import { getDB } from '../lib/duckdb';

export default function Controls() {
  const files = useStore(s => s.files);
  const sentinel = useStore(s => s.sentinel);
  const setSentinel = useStore(s => s.setSentinel);
  const isAnalyzing = useStore(s => s.isAnalyzing);
  const results = useStore(s => s.results);
  const addLog = useStore(s => s.addLog);
  const clearAll = useStore(s => s.clearAll);
  const setActiveTab = useStore(s => s.setActiveTab);

  const hasFiles = Object.keys(files).length > 0;
  const hasResults = results.length > 0;

  const runAnalysis = useCallback(async () => {
    if (!hasFiles) return;

    try {
      await getDB();
    } catch (e) {
      addLog(`DuckDB init failed: ${e.message}`, 'err');
      return;
    }

    useStore.setState({ isAnalyzing: true, progress: 0 });
    addLog('Starting analysis…', 'info');

    const fileArr = Object.values(files);
    const newResults = [];

    for (let i = 0; i < fileArr.length; i++) {
      const f = fileArr[i];
      const pct = Math.round((i / fileArr.length) * 100);
      useStore.setState({ progress: pct });
      addLog(`[${i + 1}/${fileArr.length}] Processing: ${f.name}`, 'info');

      try {
        const result = await analyzeFile(f, sentinel, addLog);
        newResults.push(result);
        addLog(`  ✓ ${result.rows.length} columns summarised`, 'ok');
      } catch (e) {
        addLog(`  ✗ ${e.message}`, 'err');
      }
    }

    useStore.setState({
      isAnalyzing: false,
      progress: 100,
      results: newResults,
    });

    if (newResults.length) {
      const layer = newResults[0].laCode;
      useStore.setState({ activeLayer: layer });
      addLog('Analysis complete ✓', 'ok');
    } else {
      addLog('No results produced', 'err');
    }
  }, [hasFiles, sentinel, files, addLog]);

  const handleClear = () => {
    clearAll();
    setActiveTab('stats');
  };

  const handleExportCSV = () => generateCSV(results);

  return (
    <>
      <div className="controls">
        <button
          className="btn btn-primary"
          disabled={!hasFiles || isAnalyzing}
          onClick={runAnalysis}
        >
          ▶ Run Analysis
        </button>
        <button
          className="btn btn-ghost"
          disabled={!hasFiles && !hasResults}
          onClick={handleClear}
        >
          ✕ Clear All
        </button>
        <button
          className="btn btn-ghost"
          disabled={!hasResults}
          onClick={handleExportCSV}
        >
          ↓ Export CSV
        </button>
        <label className="sentinel-label">
          Sentinel value
          <input
            className="sentinel-input"
            type="text"
            value={sentinel}
            onChange={e => setSentinel(e.target.value)}
          />
        </label>
      </div>

      <style>{`
        .controls {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 20px;
          flex-wrap: wrap;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 18px;
          border-radius: 5px;
          font-family: 'Source Code Pro', monospace;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.03em;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
        }
        .btn-primary {
          background: var(--blue);
          color: #fff;
        }
        .btn-primary:hover { filter: brightness(1.1); }
        .btn-primary:disabled {
          background: var(--border2);
          color: var(--muted);
          cursor: not-allowed;
          filter: none;
        }
        .btn-ghost {
          background: transparent;
          color: var(--text);
          border: 1px solid var(--border2);
        }
        .btn-ghost:hover {
          color: var(--blue);
          border-color: var(--blue);
          background: var(--blue-dim);
        }
        .btn-ghost:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        .sentinel-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: var(--muted);
          font-family: 'Source Code Pro', monospace;
          margin-left: auto;
        }
        .sentinel-input {
          background: var(--surface);
          border: 1px solid var(--border2);
          border-radius: 4px;
          color: var(--text);
          font-family: 'Source Code Pro', monospace;
          font-size: 12px;
          padding: 5px 10px;
          width: 100px;
          outline: none;
        }
        .sentinel-input:focus { border-color: var(--amber); }
      `}</style>
    </>
  );
}
