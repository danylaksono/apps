import React, { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import useStore from '../store/useStore';
import { loadSpatialData } from '../lib/analysis';

const MAX_MAP_FEATURES = 500_000;

function simplifyGeom(geom) {
  if (!geom) return geom;
  const round6 = (n) => Math.round(n * 1e6) / 1e6;
  const simplifyCoord = (c) => [round6(c[0]), round6(c[1])];
  const simplifyRing = (ring) => ring.map(simplifyCoord);
  const simplifyRings = (rings) => rings.map(simplifyRing);

  switch (geom.type) {
    case 'Point': return { type: 'Point', coordinates: simplifyCoord(geom.coordinates) };
    case 'LineString': return { type: 'LineString', coordinates: simplifyRing(geom.coordinates) };
    case 'Polygon': return { type: 'Polygon', coordinates: simplifyRings(geom.coordinates) };
    case 'MultiPoint': return { type: 'MultiPoint', coordinates: geom.coordinates.map(simplifyCoord) };
    case 'MultiLineString': return { type: 'MultiLineString', coordinates: geom.coordinates.map(simplifyRing) };
    case 'MultiPolygon': return { type: 'MultiPolygon', coordinates: geom.coordinates.map(simplifyRings) };
    default: return geom;
  }
}

function expandBounds(bounds, coords) {
  if (typeof coords[0] === 'number') {
    bounds.extend([coords[0], coords[1]]);
  } else {
    for (const c of coords) expandBounds(bounds, c);
  }
}

export default function MapPanel({ onHoverFeature, onHighlightReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  const sourceAddedRef = useRef(false);
  const layersAddedRef = useRef(false);
  const hoveredIdRef = useRef(null);
  const mapFeatureCountRef = useRef(0);
  const currentGeojsonRef = useRef(null);
  const onHoverRef = useRef(null);

  const files = useStore(s => s.files);
  const activeLayer = useStore(s => s.activeLayer);
  const addLog = useStore(s => s.addLog);
  const spatialData = useStore(s => s.spatialData);

  onHoverRef.current = onHoverFeature;

  const setSpatialData = useCallback((data) => {
    useStore.setState({ spatialData: data });
  }, []);

  // Init map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const map = new maplibregl.Map({
      container: el,
      style: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
            ],
            tileSize: 256,
            attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [{
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark',
          minzoom: 0,
          maxzoom: 20,
        }],
      },
      center: [-2.0, 53.0],
      zoom: 5,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    const popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '360px',
      className: 'map-popup',
    });

    const onLoad = () => {
      map.addSource('geojson-data', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      sourceAddedRef.current = true;

      const hoverColor = '#f5a623';
      const defaultColor = '#5b8dee';

      map.addLayer({
        id: 'geojson-fill',
        type: 'fill',
        source: 'geojson-data',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        paint: {
          'fill-color': ['case', ['boolean', ['feature-state', 'hover'], false], hoverColor, defaultColor],
          'fill-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.55, 0.24],
        },
      });
      map.addLayer({
        id: 'geojson-outline',
        type: 'line',
        source: 'geojson-data',
        filter: ['any', ['==', ['geometry-type'], 'Polygon'], ['==', ['geometry-type'], 'MultiPolygon']],
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], hoverColor, 'rgba(255,255,255,0.4)'],
          'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 2.5, 0.7],
        },
      });
      map.addLayer({
        id: 'geojson-line',
        type: 'line',
        source: 'geojson-data',
        filter: ['any', ['==', ['geometry-type'], 'LineString'], ['==', ['geometry-type'], 'MultiLineString']],
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'hover'], false], hoverColor, defaultColor],
          'line-width': 2,
        },
      });
      map.addLayer({
        id: 'geojson-point',
        type: 'circle',
        source: 'geojson-data',
        filter: ['any', ['==', ['geometry-type'], 'Point'], ['==', ['geometry-type'], 'MultiPoint']],
        paint: {
          'circle-radius': ['case', ['boolean', ['feature-state', 'hover'], false], 7, 4],
          'circle-color': ['case', ['boolean', ['feature-state', 'hover'], false], hoverColor, defaultColor],
          'circle-stroke-color': '#fff',
          'circle-stroke-width': 1,
        },
      });
      layersAddedRef.current = true;

      const interactiveLayers = ['geojson-fill', 'geojson-line', 'geojson-point'];

      map.on('mousemove', interactiveLayers, (e) => {
        if (!e.features?.length) return;
        const f = e.features[0];

        if (hoveredIdRef.current !== null) {
          map.setFeatureState({ source: 'geojson-data', id: hoveredIdRef.current }, { hover: false });
        }
        hoveredIdRef.current = f.id;
        map.setFeatureState({ source: 'geojson-data', id: f.id }, { hover: true });
        map.getCanvas().style.cursor = 'pointer';

        const props = f.properties;
        const keys = Object.keys(props);
        let html = '<div class="map-popup-content">';
        const limit = Math.min(keys.length, 8);
        for (let i = 0; i < limit; i++) {
          html += `<div><strong>${esc(keys[i])}:</strong> ${esc(String(props[keys[i]]))}</div>`;
        }
        if (keys.length > 8) html += '<div style="color:var(--muted)">…</div>';
        html += '</div>';

        popup.setLngLat(e.lngLat).setHTML(html).addTo(map);
        if (onHoverRef.current) onHoverRef.current(props);
      });

      map.on('mouseleave', interactiveLayers, () => {
        if (hoveredIdRef.current !== null) {
          map.setFeatureState({ source: 'geojson-data', id: hoveredIdRef.current }, { hover: false });
        }
        hoveredIdRef.current = null;
        map.getCanvas().style.cursor = '';
        popup.remove();
        if (onHoverRef.current) onHoverRef.current(null);
      });
    };

    if (map.loaded()) {
      onLoad();
    } else {
      map.once('load', onLoad);
    }

    mapRef.current = map;
    popupRef.current = popup;

    return () => { map.remove(); };
  }, []);

  // Load spatial data
  useEffect(() => {
    if (!activeLayer || !mapRef.current) return;

    const file = Object.values(files).find(
      f => f.name.replace(/\.parquet$/i, '') === activeLayer
    );
    if (!file) return;

    let cancelled = false;

    loadSpatialData(file, activeLayer, addLog).then(data => {
      if (cancelled || !mapRef.current || !data) return;

      const { geojson, columns, propsList, featureCount } = data;
      currentGeojsonRef.current = geojson;

      let features = geojson.features || [];
      let capped = false;
      let shownCount = features.length;

      if (features.length > MAX_MAP_FEATURES) {
        features = features.slice(0, MAX_MAP_FEATURES);
        capped = true;
        shownCount = features.length;
      }

      features = features.map((f, i) => ({
        ...f,
        id: i,
        geometry: simplifyGeom(f.geometry),
      }));

      mapFeatureCountRef.current = features.length;

      if (sourceAddedRef.current) {
        mapRef.current.getSource('geojson-data').setData({
          type: 'FeatureCollection',
          features,
        });
      }

      setSpatialData({ geojson, columns, propsList, featureCount, shownCount, capped });

      if (features.length > 0) {
        const bounds = new maplibregl.LngLatBounds();
        let valid = false;
        const step = Math.max(1, Math.floor(features.length / 1000));
        for (let i = 0; i < features.length; i += step) {
          try {
            if (features[i].geometry?.coordinates) {
              expandBounds(bounds, features[i].geometry.coordinates);
              valid = true;
            }
          } catch { /* skip */ }
        }
        if (valid) {
          mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 16, duration: 800 });
        }
      }
    }).catch(e => {
      addLog(`  ✗ Spatial load failed: ${e.message}`, 'err');
    });

    return () => { cancelled = true; };
  }, [activeLayer, files, addLog, setSpatialData]);

  const highlightFeature = useCallback((props) => {
    const map = mapRef.current;
    if (!map) return;

    const count = mapFeatureCountRef.current || 0;
    for (let i = 0; i < count; i++) {
      map.setFeatureState({ source: 'geojson-data', id: i }, { hover: false });
    }
    if (!props) return;
    const geojson = currentGeojsonRef.current;
    if (!geojson?.features) return;
    const idx = geojson.features.findIndex(f => f.properties === props);
    if (idx !== -1 && idx < count) {
      map.setFeatureState({ source: 'geojson-data', id: idx }, { hover: true });
    }
  }, []);

  useEffect(() => {
    if (onHighlightReady) onHighlightReady(highlightFeature);
  }, [highlightFeature, onHighlightReady]);

  const capNotice = spatialData?.capped
    ? `⚠ Map shows ${spatialData.shownCount?.toLocaleString()} of ${spatialData.featureCount?.toLocaleString()} features — full data in table`
    : null;

  return (
    <>
      <div className="map-pane">
        <div ref={containerRef} className="map-container" />
        {capNotice && <div className="map-cap-notice mono">{capNotice}</div>}
      </div>

      <style>{`
        .map-pane {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
          min-height: 120px;
        }
        .map-container {
          width: 100%;
          height: 100%;
        }
        .map-cap-notice {
          position: absolute;
          bottom: 36px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(11,14,19,0.88);
          border: 1px solid #f5a623;
          color: #f5a623;
          font-size: 11px;
          padding: 6px 16px;
          border-radius: 5px;
          z-index: 10;
          pointer-events: none;
          white-space: nowrap;
        }
        [data-theme='light'] .map-cap-notice {
          background: rgba(255,255,255,0.94);
        }
        :global(.map-popup .maplibregl-popup-content) {
          background: rgba(11,14,19,0.95);
          border: 1px solid var(--border2);
          border-radius: 6px;
          padding: 10px 14px;
          color: var(--text);
          font-family: 'Source Code Pro', monospace;
          font-size: 11px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        :global([data-theme='light'] .map-popup .maplibregl-popup-content) {
          background: rgba(255,255,255,0.97);
        }
        :global(.map-popup .maplibregl-popup-tip) { display: none; }
        :global(.map-popup-content div) { margin-bottom: 3px; line-height: 1.45; }
        :global(.map-popup-content strong) { color: var(--amber); margin-right: 6px; }
      `}</style>
    </>
  );
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
