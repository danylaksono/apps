import React, { useState } from 'react';
import { MapPin, Layers, SlidersHorizontal, Activity } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const Controls: React.FC = () => {
  const { city, setCity, resolution, setResolution, heightScale, setHeightScale, isLoading } = useAppStore();
  const [cityInput, setCityInput] = useState(city);

  return (
    <div className="controls-panel">
      <div className="header">
        <Activity size={24} color="#22d3ee" />
        <div>
          <h1>Joyplot Map</h1>
          <p>DuckDB + H3 Engine</p>
        </div>
      </div>

      <div className="control-group">
        <label className="control-label">
          <MapPin size={14} /> Administrative Boundary
        </label>
        <div className="city-search-row">
          <input
            type="text"
            value={cityInput}
            onChange={(e) => setCityInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cityInput.trim() && !isLoading) {
                setCity(cityInput.trim());
              }
            }}
            placeholder="Search city, e.g. Kota Bandung"
            disabled={isLoading}
            className="city-input"
          />
          <button
            onClick={() => setCity(cityInput.trim())}
            disabled={!cityInput.trim() || isLoading}
            className="btn-search"
          >
            Search
          </button>
        </div>
      </div>

      <div className="control-group">
        <div className="slider-header">
          <label className="control-label">
            <Layers size={14} /> Transects (Resolution)
          </label>
          <span className="slider-value value-cyan">{resolution}</span>
        </div>
        <input 
          type="range" 
          min="30" max="150" 
          value={resolution} 
          onChange={e => setResolution(Number(e.target.value))}
          disabled={isLoading}
          className="range-input"
          style={{ color: '#22d3ee' }}
        />
      </div>

      <div className="control-group">
        <div className="slider-header">
          <label className="control-label">
            <SlidersHorizontal size={14} /> Peak Multiplier
          </label>
          <span className="slider-value value-pink">{heightScale}x</span>
        </div>
        <input 
          type="range" 
          min="1" max="15" step="0.5"
          value={heightScale} 
          onChange={e => setHeightScale(Number(e.target.value))}
          className="range-input"
          style={{ color: '#f472b6' }}
        />
      </div>
    </div>
  );
};

export default Controls;
