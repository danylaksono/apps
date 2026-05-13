import React, { useRef, useCallback } from 'react';
import useStore from '../store/useStore';
import MapPanel from './MapPanel';
import TablePanel from './TablePanel';

export default function SplitLayout() {
  const results = useStore(s => s.results);
  const activeLayer = useStore(s => s.activeLayer);
  const setActiveLayer = useStore(s => s.setActiveLayer);

  const layoutRef = useRef(null);
  const mapPaneRef = useRef(null);
  const tablePaneRef = useRef(null);
  const tableHoverFnRef = useRef(null);
  const mapHighlightFnRef = useRef(null);
  const draggingRef = useRef(false);
  const startRef = useRef({ y: 0, mapH: 0, tableH: 0 });

  const onMapHighlightRef = useCallback((fn) => {
    mapHighlightFnRef.current = fn;
  }, []);

  const onTableHoverFnRef = useCallback((fn) => {
    tableHoverFnRef.current = fn;
  }, []);

  const handleMapHover = useCallback((props) => {
    tableHoverFnRef.current?.(props);
  }, []);

  const handleTableHover = useCallback((props) => {
    mapHighlightFnRef.current?.(props);
  }, []);

  // Resizable split handle
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    draggingRef.current = true;
    const mapPane = mapPaneRef.current;
    const tablePane = tablePaneRef.current;
    if (!mapPane || !tablePane) return;
    startRef.current = {
      y: e.clientY,
      mapH: mapPane.getBoundingClientRect().height,
      tableH: tablePane.getBoundingClientRect().height,
    };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  React.useEffect(() => {
    const handleMouseMove = (e) => {
      if (!draggingRef.current) return;
      const mapPane = mapPaneRef.current;
      const tablePane = tablePaneRef.current;
      if (!mapPane || !tablePane) return;
      const dy = e.clientY - startRef.current.y;
      const total = startRef.current.mapH + startRef.current.tableH;
      const minH = 100;
      const newMapH = Math.max(minH, Math.min(total - minH, startRef.current.mapH + dy));
      mapPane.style.flex = `0 0 ${newMapH}px`;
      tablePane.style.flex = `0 0 ${total - newMapH}px`;
    };

    const handleMouseUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!results.length) return null;

  return (
    <>
      <div className="section-header section-header--map">
        <span className="section-title">Spatial Inspection</span>
        <select
          className="layer-select mono"
          value={activeLayer || ''}
          onChange={e => setActiveLayer(e.target.value)}
        >
          {results.map(r => (
            <option key={r.laCode} value={r.laCode}>{r.laCode}</option>
          ))}
        </select>
      </div>

      <div className="map-table-layout" ref={layoutRef}>
        <div className="map-pane-split" ref={mapPaneRef}>
          <MapPanel onHoverFeature={handleMapHover} onHighlightReady={onMapHighlightRef} />
        </div>
        <div className="split-handle" onMouseDown={handleMouseDown}>
          <div className="split-handle-grip" />
        </div>
        <div className="table-pane-split" ref={tablePaneRef}>
          <TablePanel onHoverRow={handleTableHover} onHighlightReady={onTableHoverFnRef} />
        </div>
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
        .section-header--map {
          margin: 0 0 12px;
          flex-shrink: 0;
        }
        .section-title {
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--amber);
        }
        .layer-select {
          background: var(--surface);
          color: var(--text);
          border: 1px solid var(--border2);
          padding: 4px 8px;
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          border-radius: 4px;
          outline: none;
        }
        .layer-select:focus { border-color: var(--amber); }
        .map-table-layout {
          display: flex;
          flex-direction: column;
          flex: 1;
          min-height: 500px;
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden;
          background: var(--surface);
        }
        .map-pane-split {
          position: relative;
          flex: 1 1 55%;
          min-height: 120px;
          overflow: hidden;
        }
        .table-pane-split {
          flex: 1 1 45%;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .split-handle {
          height: 8px;
          flex-shrink: 0;
          background: var(--border);
          cursor: row-resize;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
          user-select: none;
          z-index: 5;
        }
        .split-handle:hover, .split-handle.active { background: var(--amber); }
        .split-handle-grip {
          width: 40px;
          height: 3px;
          border-radius: 2px;
          background: var(--muted);
          opacity: 0.5;
        }
        .split-handle:hover .split-handle-grip { background: var(--bg); opacity: 0.8; }
      `}</style>
    </>
  );
}
