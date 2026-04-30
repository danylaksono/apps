import React from 'react';
import { Upload, Map as MapIcon } from 'lucide-react';
import * as duckdb from '@duckdb/duckdb-wasm';

export default function TopBar({ db, conn, columns, activeColumn, setActiveColumn, reloadTableMetadata }) {
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !db || !conn) return;

    try {
      await db.registerFileHandle(file.name, file, duckdb.DuckDBDataProtocol.BROWSER_FILEREADER, true);
      const ext = file.name.split('.').pop().toLowerCase();
      
      if (ext === 'csv') {
        await conn.query(`CREATE OR REPLACE TABLE current_data AS SELECT * FROM read_csv_auto('${file.name}')`);
      } else if (ext === 'parquet') {
        await conn.query(`CREATE OR REPLACE TABLE current_data AS SELECT * FROM read_parquet('${file.name}')`);
      } else {
        alert('Unsupported file format. Please upload CSV or Parquet.');
        return;
      }
      await reloadTableMetadata();
    } catch (err) {
      alert("Failed to load file into DuckDB: " + err.message);
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shadow-sm z-10">
      <div className="flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg">
          <MapIcon className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">H3 Data Explorer</h1>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-slate-500">Visualizing:</span>
          <select 
            className="bg-slate-100 border-none text-slate-800 rounded-md py-1.5 pl-3 pr-8 focus:ring-2 focus:ring-blue-500 font-semibold cursor-pointer"
            value={activeColumn}
            onChange={(e) => setActiveColumn(e.target.value)}
          >
            {columns.map(col => (
              <option key={col} value={col}>{col}</option>
            ))}
          </select>
        </div>

        <div className="h-6 w-px bg-slate-300 mx-2"></div>

        <label className="cursor-pointer bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <Upload className="w-4 h-4" />
          Upload Data
          <input 
            type="file" 
            accept=".csv,.parquet" 
            className="hidden" 
            onChange={handleFileUpload} 
          />
        </label>
      </div>
    </div>
  );
}
