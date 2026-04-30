import React, { useState, useEffect } from 'react';
import * as h3 from 'h3-js';
import { initDuckDB, getDb } from './services/db';

import TopBar from './components/TopBar';
import MapViewer from './components/MapViewer';
import DataTable from './components/DataTable';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  
  const [mapData, setMapData] = useState([]);
  const [tableData, setTableData] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [columns, setColumns] = useState([]);
  const [activeColumn, setActiveColumn] = useState('');
  const [hoverInfo, setHoverInfo] = useState(null);
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(1);
  
  const [page, setPage] = useState(0);
  const rowsPerPage = 50;

  const [viewState, setViewState] = useState({
    longitude: -0.1276, // London
    latitude: 51.5072,
    zoom: 11,
    pitch: 0,
    bearing: 0
  });

  // Initialize DuckDB
  useEffect(() => {
    initDuckDB().then(() => {
      setDbReady(true);
    }).catch(console.error);
  }, []);

  // Generate Mock Data once DB is ready
  useEffect(() => {
    if (!dbReady) return;
    const { db, conn } = getDb();
    
    const generateMockData = async () => {
      const centerCell = h3.latLngToCell(51.5072, -0.1276, 10);
      const cells = h3.gridDisk(centerCell, 25); 
      
      const mockData = cells.map((cell) => {
        const [lat, lng] = h3.cellToLatLng(cell);
        const distFromCenter = Math.sqrt(Math.pow(lat - 51.5072, 2) + Math.pow(lng - -0.1276, 2));
        return {
          h3_cell: cell,
          pop_density: Math.max(0, 100 - (distFromCenter * 500)) + (Math.random() * 20),
          ev_chargers: Math.floor(Math.max(0, 10 - (distFromCenter * 100)) + (Math.random() * 5)),
          traffic_incidents: Math.floor(Math.random() * 50)
        };
      });

      await db.registerFileText('mock.json', JSON.stringify(mockData));
      await conn.query(`CREATE OR REPLACE TABLE current_data AS SELECT * FROM read_json_auto('mock.json')`);
      await reloadTableMetadata();
    };
    generateMockData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbReady]);

  const reloadTableMetadata = async () => {
    const { conn } = getDb();
    if (!conn) return;
    
    const descResult = await conn.query(`DESCRIBE current_data`);
    const cols = descResult.toArray().map(r => r.toJSON().column_name).filter(c => c !== 'h3_cell');
    setColumns(cols);
    if (cols.length > 0) setActiveColumn(cols[0]);
    
    const countResult = await conn.query(`SELECT count(*) as count FROM current_data`);
    setTotalRows(Number(countResult.toArray()[0].toJSON().count));
    setPage(0);
    
    // Load full array representation for DeckGL map rendering
    const mapRes = await conn.query(`SELECT * FROM current_data`);
    const mapArr = mapRes.toArray().map(r => r.toJSON());
    setMapData(mapArr);
    
    const firstCell = mapArr.find(d => d.h3_cell)?.h3_cell;
    if (firstCell && h3.isValidCell(firstCell)) {
      const [lat, lng] = h3.cellToLatLng(firstCell);
      setViewState(prev => ({ ...prev, longitude: lng, latitude: lat, zoom: 11 }));
    }
  };

  // Compute Min/Max via DuckDB whenever active column changes
  useEffect(() => {
    const computeMinMax = async () => {
      const { conn } = getDb();
      if (!conn || !activeColumn) return;
      try {
        const res = await conn.query(`SELECT MIN("${activeColumn}") as min, MAX("${activeColumn}") as max FROM current_data`);
        const row = res.toArray()[0].toJSON();
        setMin(Number(row.min) || 0);
        setMax(Number(row.max) || 1);
      } catch (e) {
        console.error("Error computing min/max:", e);
      }
    };
    if (dbReady) computeMinMax();
  }, [activeColumn, dbReady]);

  // Pagination bounds via DuckDB
  useEffect(() => {
    const loadTablePage = async () => {
      const { conn } = getDb();
      if (!conn) return;
      try {
        const offset = page * rowsPerPage;
        const res = await conn.query(`SELECT * FROM current_data LIMIT ${rowsPerPage} OFFSET ${offset}`);
        setTableData(res.toArray().map(r => r.toJSON()));
      } catch (e) {
        console.error("Error fetching page:", e);
      }
    };
    if (dbReady) loadTablePage();
  }, [page, totalRows, dbReady]);

  if (!dbReady) {
    return (
      <div className="flex flex-col h-screen bg-slate-50 items-center justify-center font-sans">
         <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
         <h2 className="text-xl font-semibold text-slate-800">Initializing DuckDB WASM...</h2>
         <p className="text-slate-500 mt-2">Loading analytical engine in the browser</p>
      </div>
    );
  }

  const { db, conn } = getDb();

  return (
    <div className="flex flex-col h-screen bg-slate-50 font-sans text-slate-800">
      <TopBar 
        db={db} 
        conn={conn} 
        columns={columns} 
        activeColumn={activeColumn} 
        setActiveColumn={setActiveColumn} 
        reloadTableMetadata={reloadTableMetadata} 
      />

      <div className="flex flex-1 overflow-hidden">
        <MapViewer 
          mapData={mapData}
          activeColumn={activeColumn}
          min={min}
          max={max}
          viewState={viewState}
          setViewState={setViewState}
          columns={columns}
          hoverInfo={hoverInfo}
          setHoverInfo={setHoverInfo}
        />
        
        <DataTable 
          tableData={tableData}
          columns={columns}
          activeColumn={activeColumn}
          page={page}
          setPage={setPage}
          totalRows={totalRows}
          rowsPerPage={rowsPerPage}
        />
      </div>
    </div>
  );
}
