import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
} from '@tanstack/react-table';
import useStore from '../store/useStore';

export default function TablePanel({ onHoverRow, onHighlightReady }) {
  const spatialData = useStore(s => s.spatialData);
  const { propsList = [], columns = [] } = spatialData || {};

  const [sorting, setSorting] = useState([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilter, setColumnFilter] = useState('');
  const [columnFilterValue, setColumnFilterValue] = useState('');
  const [visibleColumns, setVisibleColumns] = useState(() => new Set(columns));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const prevColumnsRef = useRef(columns);

  // Reset visible columns only when columns content actually changes
  if (columns !== prevColumnsRef.current) {
    const prev = prevColumnsRef.current;
    if (prev.length !== columns.length || columns.some((c, i) => c !== prev[i])) {
      prevColumnsRef.current = columns;
      if (visibleColumns.size === 0 || prev.length === 0) {
        setVisibleColumns(new Set(columns));
      }
    } else {
      prevColumnsRef.current = columns;
    }
  }

  // Close picker on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const columnDefs = useMemo(() =>
    [...visibleColumns].map(c => ({
      id: String(c),
      accessorKey: String(c),
      header: String(c),
    })),
    [visibleColumns]
  );

  const filteredData = useMemo(() => {
    let data = propsList;
    if (columnFilter && columnFilterValue) {
      const q = columnFilterValue.toLowerCase();
      data = data.filter(row => {
        const v = row[columnFilter];
        return v != null && String(v).toLowerCase().includes(q);
      });
    }
    return data;
  }, [propsList, columnFilter, columnFilterValue]);

  const table = useReactTable({
    data: filteredData,
    columns: columnDefs,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: 100 } },
  });

  const toggleColumn = useCallback((col) => {
    setVisibleColumns(prev => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  }, []);

  const showAll = useCallback(() => setVisibleColumns(new Set(columns)), [columns]);
  const hideAll = useCallback(() => setVisibleColumns(new Set()), []);

  const highlightRow = useCallback((dataItem) => {
    document.querySelectorAll('.table-row.selected').forEach(el => el.classList.remove('selected'));
    if (!dataItem) return;
    const idx = propsList.indexOf(dataItem);
    if (idx !== -1) {
      const rowEl = document.querySelector(`.table-row[data-idx="${idx}"]`);
      if (rowEl) {
        rowEl.classList.add('selected');
        rowEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [propsList]);

  useEffect(() => {
    if (onHighlightReady) onHighlightReady(highlightRow);
  }, [highlightRow, onHighlightReady]);

  if (!columns.length) {
    return <div className="table-empty mono">No columns to display</div>;
  }

  const visibleColsArr = [...visibleColumns];

  return (
    <>
      <div className="table-toolbar">
        <div className="toolbar-left">
          <div className="toolbar-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="toolbar-input"
              placeholder="Search all columns…"
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
            />
          </div>
          <div className="toolbar-filter">
            <select
              className="toolbar-select"
              value={columnFilter}
              onChange={e => setColumnFilter(e.target.value)}
            >
              <option value="">Filter column…</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input
              className="toolbar-input toolbar-filter-val"
              placeholder="Contains…"
              disabled={!columnFilter}
              value={columnFilterValue}
              onChange={e => setColumnFilterValue(e.target.value)}
            />
          </div>
        </div>
        <div className="toolbar-right">
          <div className="column-picker-wrap" ref={pickerRef}>
            <button className="btn-toolbar" onClick={() => setPickerOpen(!pickerOpen)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
              </svg>
              Columns <span className="col-count mono">{visibleColumns.size}/{columns.length}</span>
            </button>
            {pickerOpen && (
              <div className="column-picker-dropdown">
                <div className="col-picker-actions">
                  <button className="col-picker-action" onClick={showAll}>Show all</button>
                  <button className="col-picker-action" onClick={hideAll}>Hide all</button>
                </div>
                <div className="col-picker-list">
                  {columns.map(c => (
                    <label key={c} className="col-picker-item">
                      <input
                        type="checkbox"
                        checked={visibleColumns.has(c)}
                        onChange={() => toggleColumn(c)}
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <span className="toolbar-count mono">{filteredData.length.toLocaleString()} rows</span>
        </div>
      </div>

      <div className="table-scroll-area">
        <table className="tanstack-table">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
                  const sortDir = h.column.getIsSorted();
                  const arrow = sortDir === 'asc' ? ' ↑' : sortDir === 'desc' ? ' ↓' : '';
                  return (
                    <th
                      key={h.id}
                      className="sortable-th"
                      onClick={h.column.getToggleSortingHandler()}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}{arrow}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColsArr.length || 1} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>
                  No matching rows
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const originalIdx = propsList.indexOf(row.original);
                return (
                  <tr
                    key={row.id}
                    className="table-row"
                    data-idx={originalIdx}
                    onMouseEnter={() => { if (onHoverRow) onHoverRow(row.original); }}
                    onMouseLeave={() => { if (onHoverRow) onHoverRow(null); }}
                  >
                    {row.getVisibleCells().map(cell => {
                      let val = cell.getValue();
                      if (val === null || val === undefined) val = '';
                      else if (typeof val === 'object') val = JSON.stringify(val);
                      return <td key={cell.id}>{String(val)}</td>;
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="table-pagination">
        <span className="mono">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1}
        </span>
        <div className="page-btns">
          <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()}>«</button>
          <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>‹</button>
          <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>›</button>
          <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()}>»</button>
        </div>
      </div>

      <style>{`
        .table-toolbar {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; padding: 8px 12px; flex-wrap: wrap;
          border-bottom: 1px solid var(--border); flex-shrink: 0;
        }
        .toolbar-left, .toolbar-right {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .toolbar-search {
          display: flex; align-items: center; gap: 6px;
          background: var(--bg); border: 1px solid var(--border2);
          border-radius: 5px; padding: 0 10px; color: var(--muted);
        }
        .toolbar-search:focus-within { border-color: var(--amber); }
        .toolbar-input {
          background: transparent; border: none; color: var(--text);
          font-family: 'Source Code Pro', monospace; font-size: 11px;
          padding: 6px 0; outline: none; width: 160px;
        }
        .toolbar-input::placeholder { color: var(--muted); }
        .toolbar-filter { display: flex; align-items: center; gap: 6px; }
        .toolbar-filter-val {
          width: 120px; background: var(--bg); border: 1px solid var(--border2);
          border-radius: 5px; padding: 6px 8px;
        }
        .toolbar-filter-val:disabled { opacity: 0.4; cursor: not-allowed; }
        .toolbar-select {
          background: var(--bg); border: 1px solid var(--border2); border-radius: 5px;
          color: var(--text); font-family: 'Source Code Pro', monospace;
          font-size: 11px; padding: 6px 8px; outline: none; max-width: 140px;
        }
        .toolbar-select:focus { border-color: var(--amber); }
        .toolbar-count { font-size: 11px; color: var(--muted); white-space: nowrap; }
        .btn-toolbar {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
          background: var(--bg); border: 1px solid var(--border2); border-radius: 5px;
          color: var(--text); font-family: 'Source Code Pro', monospace;
          font-size: 11px; cursor: pointer; transition: border-color 0.15s; white-space: nowrap;
        }
        .btn-toolbar:hover { border-color: var(--amber); }
        .col-count { color: var(--muted); font-size: 10px; }
        .column-picker-wrap { position: relative; }
        .column-picker-dropdown {
          position: absolute; right: 0; top: calc(100% + 4px); background: var(--surface);
          border: 1px solid var(--border2); border-radius: 6px; padding: 8px;
          width: 220px; max-height: 320px; overflow-y: auto; z-index: 50;
          box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        }
        .col-picker-actions {
          display: flex; gap: 8px; margin-bottom: 8px;
          padding-bottom: 6px; border-bottom: 1px solid var(--border);
        }
        .col-picker-action {
          background: none; border: none; color: var(--blue);
          font-family: 'Source Code Pro', monospace; font-size: 10px;
          cursor: pointer; padding: 2px 0;
        }
        .col-picker-action:hover { text-decoration: underline; }
        .col-picker-list { display: flex; flex-direction: column; gap: 2px; }
        .col-picker-item {
          display: flex; align-items: center; gap: 6px; padding: 3px 4px;
          border-radius: 3px; cursor: pointer; font-family: 'Source Code Pro', monospace;
          font-size: 11px; color: var(--text); transition: background 0.1s;
        }
        .col-picker-item:hover { background: var(--highlight); }
        .col-picker-item input[type="checkbox"] { accent-color: var(--amber); }
        .table-scroll-area { flex: 1; overflow: auto; }
        .tanstack-table { width: 100%; border-collapse: collapse; }
        .tanstack-table th, .tanstack-table td {
          padding: 6px 10px; border-bottom: 1px solid var(--border2);
          text-align: left; font-family: 'Source Code Pro', monospace;
          font-size: 11px; white-space: nowrap;
        }
        .tanstack-table th.sortable-th {
          cursor: pointer; user-select: none; position: sticky; top: 0;
          background: var(--surface); z-index: 2; color: var(--muted);
          font-weight: 600; font-size: 10px; letter-spacing: 0.04em;
          text-transform: uppercase; transition: color 0.15s;
        }
        .tanstack-table th.sortable-th:hover { color: var(--amber); }
        .tanstack-table tr.table-row { transition: background 0.1s; }
        .tanstack-table tr.table-row:hover td { background: var(--highlight); }
        .tanstack-table tr.table-row.selected td { background: rgba(245, 166, 35, 0.15) !important; }
        .table-pagination {
          padding: 8px 12px; border-top: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
          font-size: 11px; color: var(--muted); background: var(--surface); flex-shrink: 0;
        }
        .table-pagination button {
          background: var(--highlight); border: 1px solid var(--border2);
          color: var(--text); padding: 4px 8px; border-radius: 4px;
          cursor: pointer; font-size: 13px; transition: border-color 0.15s;
        }
        .table-pagination button:hover:not(:disabled) { border-color: var(--amber); }
        .table-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
        .page-btns { display: flex; gap: 4px; }
        .table-empty { padding: 1rem; color: var(--muted); }
      `}</style>
    </>
  );
}
