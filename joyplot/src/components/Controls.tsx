import React, { useRef, useState } from 'react';
import { MapPin, Layers, SlidersHorizontal, Activity, Crop, Download, Type, AlignLeft, Upload, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { parseBoundaryGeojson } from '../services/dataService';

const Controls: React.FC = () => {
  const {
    city,
    setCity,
    resolution,
    setResolution,
    heightScale,
    setHeightScale,
    pitch,
    setPitch,
    padding,
    setPadding,
    projectionScale,
    setProjectionScale,
    offsetX,
    setOffsetX,
    offsetY,
    setOffsetY,
    rotation,
    setRotation,
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
    boundaryOverride,
    boundaryLabel,
    setBoundaryOverride,
    isLoading,
  } = useAppStore();
  const [cityInput, setCityInput] = useState(city);
  const [boundaryMessage, setBoundaryMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleBoundaryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const rawText = await file.text();
      const parsed = JSON.parse(rawText);
      const label = file.name.replace(/\.[^.]+$/, '') || 'Custom boundary';
      const boundary = parseBoundaryGeojson(parsed, label);
      setBoundaryOverride(boundary, label);
      setBoundaryMessage(`Loaded ${label}`);
    } catch (error) {
      setBoundaryMessage(error instanceof Error ? error.message : 'Failed to load GeoJSON boundary');
    } finally {
      event.target.value = '';
    }
  };

  const handleCitySearch = () => {
    if (!cityInput.trim() || isLoading) return;

    setBoundaryOverride(null);
    setBoundaryMessage('Using city boundary again');
    setCity(cityInput.trim());
  };

  return (
    <div className="controls-panel">
      <div className="header">
        <Activity size={24} color="#22d3ee" />
        <div>
          <h1>Indonesia Joyplot Map</h1>
          <p>{panelMode === 'print' ? 'Print and Export Customisation' : 'Exploration Controls'}</p>
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
                handleCitySearch();
              }
            }}
            placeholder="Search city, e.g. Kota Bandung"
            disabled={isLoading}
            className="city-input"
          />
          <button
            onClick={handleCitySearch}
            disabled={!cityInput.trim() || isLoading}
            className="btn-search"
          >
            Search
          </button>
        </div>
        <div className="boundary-upload-row">
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,application/geo+json,application/json"
            onChange={handleBoundaryUpload}
            className="boundary-file-input"
          />
          <button
            type="button"
            className="btn-upload"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading}
          >
            <Upload size={14} /> Upload GeoJSON
          </button>
          {boundaryOverride && (
            <button
              type="button"
              className="btn-clear"
              onClick={() => {
                setBoundaryOverride(null);
                setBoundaryMessage('Using city boundary again');
              }}
              disabled={isLoading}
            >
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>
        <span className="boundary-status">
          {boundaryOverride ? `Active: ${boundaryLabel || boundaryOverride.name || 'Custom boundary'}` : 'Search a boundary from available APIs, or upload a Polygon or MultiPolygon GeoJSON file.'}
        </span>
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
            {boundaryMessage && <span className="boundary-status boundary-status-muted">{boundaryMessage}</span>}
          </div>

          <details className="advanced-panel">
            <summary className="advanced-summary">Advanced customisation</summary>
            <div className="advanced-content">
              <div className="control-group">
                <div className="slider-header">
                  <label className="control-label">Pitch</label>
                  <span className="slider-value value-cyan">{pitch.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="1"
                  step="0.05"
                  value={pitch}
                  onChange={e => setPitch(Number(e.target.value))}
                  className="range-input"
                  style={{ color: '#22d3ee' }}
                />
              </div>

              <div className="control-group">
                <div className="slider-header">
                  <label className="control-label">Canvas padding</label>
                  <span className="slider-value value-pink">{padding}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="200"
                  step="10"
                  value={padding}
                  onChange={e => setPadding(Number(e.target.value))}
                  className="range-input"
                  style={{ color: '#f472b6' }}
                />
              </div>

              <div className="control-group">
                <div className="slider-header">
                  <label className="control-label">Canvas scale</label>
                  <span className="slider-value value-cyan">{projectionScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.4"
                  max="1.6"
                  step="0.05"
                  value={projectionScale}
                  onChange={e => setProjectionScale(Number(e.target.value))}
                  className="range-input"
                  style={{ color: '#22d3ee' }}
                />
                {/* <span className="boundary-status boundary-status-muted">Separate from peak multiplier: this zooms the rendered map, while Peak Multiplier adjusts vertical ridge height.</span> */}
              </div>

              <div className="control-group">
                <div className="slider-header">
                  <label className="control-label">Offset X</label>
                  <span className="slider-value value-cyan">{offsetX}px</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={offsetX}
                  onChange={e => setOffsetX(Number(e.target.value))}
                  className="range-input"
                  style={{ color: '#22d3ee' }}
                />
              </div>

              <div className="control-group">
                <div className="slider-header">
                  <label className="control-label">Offset Y</label>
                  <span className="slider-value value-cyan">{offsetY}px</span>
                </div>
                <input
                  type="range"
                  min="-200"
                  max="200"
                  step="5"
                  value={offsetY}
                  onChange={e => setOffsetY(Number(e.target.value))}
                  className="range-input"
                  style={{ color: '#22d3ee' }}
                />
              </div>

              <div className="control-group">
                <div className="slider-header">
                  <label className="control-label">Rotation</label>
                  <span className="slider-value value-pink">{rotation}°</span>
                </div>
                <input
                  type="range"
                  min="-45"
                  max="45"
                  step="1"
                  value={rotation}
                  onChange={e => setRotation(Number(e.target.value))}
                  className="range-input"
                  style={{ color: '#f472b6' }}
                />
              </div>
            </div>
          </details>
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
