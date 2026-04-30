import React, { useMemo } from 'react';
import { Map } from 'react-map-gl';
import DeckGL from '@deck.gl/react';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Info } from 'lucide-react';
import { COLOR_SCALE, interpolateColor } from '../lib/colors';

export default function MapViewer({ 
  mapData, 
  activeColumn, 
  min, 
  max, 
  viewState, 
  setViewState, 
  columns, 
  hoverInfo, 
  setHoverInfo 
}) {
  
  const layers = useMemo(() => [
    new H3HexagonLayer({
      id: 'h3-layer',
      data: mapData,
      pickable: true,
      wireframe: false,
      filled: true,
      extruded: false,
      elevationScale: 20,
      getHexagon: d => d.h3_cell,
      getFillColor: d => {
        const val = d[activeColumn];
        if (typeof val !== 'number') return [150, 150, 150, 100];
        const normalized = max === min ? 0 : (val - min) / (max - min);
        return interpolateColor(normalized);
      },
      getElevation: d => {
        const val = d[activeColumn];
        if (typeof val !== 'number') return 0;
        return max === min ? 0 : (val - min) / (max - min) * 100;
      },
      onHover: info => setHoverInfo(info),
      updateTriggers: {
        getFillColor: [activeColumn, min, max],
        getElevation: [activeColumn, min, max]
      }
    })
  ], [mapData, activeColumn, min, max, setHoverInfo]);

  return (
    <div className="relative w-2/3 border-r border-slate-200 bg-slate-900">
      <DeckGL
        layers={layers}
        viewState={viewState}
        onViewStateChange={e => setViewState(e.viewState)}
        controller={true}
      >
        <Map 
          mapStyle="https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
          mapLib={maplibregl}
        />
      </DeckGL>

      {/* Map Legend */}
      <div className="absolute bottom-6 left-6 bg-white/90 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-white/20">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">{activeColumn}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium">{min.toFixed(2)}</span>
          <div className="w-32 h-2 rounded-full" style={{
            background: `linear-gradient(to right, rgb(${COLOR_SCALE[0].join(',')}), rgb(${COLOR_SCALE[1].join(',')}), rgb(${COLOR_SCALE[2].join(',')}))`
          }}></div>
          <span className="text-xs font-medium">{max.toFixed(2)}</span>
        </div>
      </div>

      {/* Tooltip */}
      {hoverInfo && hoverInfo.object && (
        <div 
          className="absolute pointer-events-none bg-slate-900 text-white p-3 rounded-lg shadow-xl text-sm border border-slate-700 z-50 transform -translate-x-1/2 -translate-y-[calc(100%+15px)]"
          style={{ left: hoverInfo.x, top: hoverInfo.y }}
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-slate-700">
            <Info className="w-4 h-4 text-blue-400" />
            <span className="font-mono text-xs text-slate-300">{hoverInfo.object.h3_cell}</span>
          </div>
          <div className="flex flex-col gap-1">
            {columns.map(col => (
              <div key={col} className="flex justify-between gap-4">
                <span className="text-slate-400">{col}:</span>
                <span className={`font-semibold ${col === activeColumn ? 'text-blue-400' : 'text-slate-100'}`}>
                  {typeof hoverInfo.object[col] === 'number' 
                    ? hoverInfo.object[col].toFixed(4) 
                    : hoverInfo.object[col]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
