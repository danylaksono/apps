import React from 'react';
import { Table as TableIcon, ChevronLeft, ChevronRight } from 'lucide-react';

export default function DataTable({ 
  tableData, 
  columns, 
  activeColumn, 
  page, 
  setPage, 
  totalRows, 
  rowsPerPage 
}) {
  const totalPages = Math.ceil(totalRows / rowsPerPage);

  return (
    <div className="w-1/3 bg-white flex flex-col">
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
        <div className="flex items-center gap-2 text-slate-700 font-semibold">
          <TableIcon className="w-5 h-5" />
          <h2>Data Inspector</h2>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-200 px-2 py-1 rounded-full">
          {totalRows.toLocaleString()} rows
        </span>
      </div>

      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="text-xs text-slate-500 bg-white sticky top-0 shadow-sm z-10">
            <tr>
              <th className="px-4 py-3 font-semibold border-b">H3 Index</th>
              {columns.map(col => (
                <th key={col} className={`px-4 py-3 font-semibold border-b ${col === activeColumn ? 'text-blue-600 bg-blue-50/50' : ''}`}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tableData.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-2 font-mono text-xs text-slate-400">{row.h3_cell}</td>
                {columns.map(col => (
                  <td key={col} className={`px-4 py-2 ${col === activeColumn ? 'bg-blue-50/30 font-medium text-slate-900' : 'text-slate-600'}`}>
                    {typeof row[col] === 'number' ? row[col].toFixed(4) : row[col]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-3 border-t border-slate-200 bg-white flex items-center justify-between text-sm">
        <span className="text-slate-500">
          Showing {page * rowsPerPage + (totalRows > 0 ? 1 : 0)} to {Math.min((page + 1) * rowsPerPage, totalRows)}
        </span>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="font-medium px-2 text-slate-700">
            {totalPages > 0 ? page + 1 : 0} / {totalPages}
          </span>
          <button 
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || totalPages === 0}
            className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
