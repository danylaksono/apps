import React, { useState } from 'react';
import { MapPin, Layers, SlidersHorizontal, Activity, Crop, Download, Type, AlignLeft } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

const Controls: React.FC = () => {
  const {
    city,
    setCity,
    resolution,
    setResolution,
    heightScale,
    setHeightScale,
    clipToBoundary,
    setClipToBoundary,
    panelMode,
    setPanelMode,
    customTitle,
    setCustomTitle,
    customSubtitle,
    setCustomSubtitle,
    titlePosition,
    setTitlePosition,
    mapScalePosition,
    setMapScalePosition,
    isLoading,
  } = useAppStore();
  const [cityInput, setCityInput] = useState(city);

  const handleExport = () => {
    const canvas = document.querySelector<HTMLCanvasElement>('.joyplot-canvas');
    if (!canvas) return;

    const safeCity = city.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'city';
    const dateStamp = new Date().toISOString().slice(0, 10);

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = `${safeCity}-joyplot-${dateStamp}.png`;
    link.click();
  };

  return (
    <div className="controls-panel">
      <div className="header">
        <Activity size={24} color="#22d3ee" />
        <div>
          <h1>Joyplot Map</h1>
          <p>{panelMode === 'print' ? 'Print and Export Customization' : 'Exploration Controls'}</p>
        </div>
      </div>

      <div className="mode-switch-row">
        <button
          type="button"
          className={`btn-mode ${panelMode === 'explore' ? 'is-active' : ''}`}
          onClick={() => setPanelMode('explore')}
        >
          Explore Mode
        </button>
        <button
          type="button"
          className={`btn-mode ${panelMode === 'print' ? 'is-active' : ''}`}
          onClick={() => setPanelMode('print')}
        >
          Print Mode
        </button>
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

      {panelMode === 'explore' && (
        <>
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

          <div className="control-group">
            <label className="control-label">
              <Crop size={14} /> Boundary Clipping
            </label>
            <button
              type="button"
              className={`btn-toggle ${clipToBoundary ? 'is-active' : ''}`}
              onClick={() => setClipToBoundary(!clipToBoundary)}
            >
              {clipToBoundary ? 'Clipping: ON' : 'Clipping: OFF'}
            </button>
          </div>
        </>
      )}

      {panelMode === 'print' && (
        <>
          <div className="control-group">
            <label className="control-label">
              <Type size={14} /> Map Title
            </label>
            <input
              type="text"
              className="city-input"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="City title"
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              <Type size={14} /> Subtitle
            </label>
            <input
              type="text"
              className="city-input"
              value={customSubtitle}
              onChange={(e) => setCustomSubtitle(e.target.value)}
              placeholder="Population ridgeline map"
            />
          </div>

          <div className="control-group">
            <label className="control-label">
              <AlignLeft size={14} /> Title Position
            </label>
            <select
              className="city-select"
              value={titlePosition}
              onChange={(e) => setTitlePosition(e.target.value as 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'center')}
            >
              <option value="top-left">Top Left</option>
              <option value="top-center">Top Center</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-right">Bottom Right</option>
              <option value="center">Center</option>
            </select>
          </div>

          <div className="control-group">
            <label className="control-label">
              <AlignLeft size={14} /> Map Scale Position
            </label>
            <select
              className="city-select"
              value={mapScalePosition}
              onChange={(e) => setMapScalePosition(e.target.value as 'off' | 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right')}
            >
              <option value="off">Off</option>
              <option value="top-left">Top Left</option>
              <option value="top-center">Top Center</option>
              <option value="top-right">Top Right</option>
              <option value="bottom-left">Bottom Left</option>
              <option value="bottom-center">Bottom Center</option>
              <option value="bottom-right">Bottom Right</option>
            </select>
          </div>

          <div className="control-group">
            <button
              type="button"
              className="btn-export"
              onClick={handleExport}
              disabled={isLoading}
            >
              <Download size={14} /> Export View (PNG)
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default Controls;
