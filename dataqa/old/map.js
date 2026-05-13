import maplibregl from 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.0.0/+esm';

export class MapViewer {
  constructor(containerId, tooltipId) {
    this.container = document.getElementById(containerId);
    this.tooltipEl = document.getElementById(tooltipId);
    this.onHoverCallback = null;
    this.map = null;
    this._sourceAdded = false;
    this._currentData = null;

    this.map = new maplibregl.Map({
      container: this.container,
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
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 20,
          },
        ],
      },
      center: [-2.0, 53.0],
      zoom: 5,
      attributionControl: false,
    });

    this.map.addControl(new maplibregl.NavigationControl(), 'top-right');
    this.map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    this._popup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      maxWidth: '320px',
      className: 'map-popup',
    });

    this.map.on('load', () => {
      this._addEmptySource();
      this._addLayers();
      this._bindEvents();
      // If data was set before map loaded, render it now
      if (this._pendingData) {
        this._setData(this._pendingData.geojson, this._pendingData.onHover);
        this._pendingData = null;
      }
    });
  }

  _addEmptySource() {
    this.map.addSource('geojson-data', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
    this._sourceAdded = true;
  }

  _addLayers() {
    // Polygon fill
    this.map.addLayer({
      id: 'geojson-fill',
      type: 'fill',
      source: 'geojson-data',
      filter: ['any',
        ['==', ['geometry-type'], 'Polygon'],
        ['==', ['geometry-type'], 'MultiPolygon'],
      ],
      paint: {
        'fill-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#f5a623',
          '#1d4ed8',
        ],
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.6,
          0.35,
        ],
      },
    });

    // Polygon outline
    this.map.addLayer({
      id: 'geojson-outline',
      type: 'line',
      source: 'geojson-data',
      filter: ['any',
        ['==', ['geometry-type'], 'Polygon'],
        ['==', ['geometry-type'], 'MultiPolygon'],
      ],
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#f5a623',
          'rgba(255,255,255,0.45)',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          2.5,
          0.8,
        ],
      },
    });

    // Lines
    this.map.addLayer({
      id: 'geojson-line',
      type: 'line',
      source: 'geojson-data',
      filter: ['any',
        ['==', ['geometry-type'], 'LineString'],
        ['==', ['geometry-type'], 'MultiLineString'],
      ],
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#f5a623',
          '#5b8dee',
        ],
        'line-width': 2,
      },
    });

    // Points
    this.map.addLayer({
      id: 'geojson-point',
      type: 'circle',
      source: 'geojson-data',
      filter: ['any',
        ['==', ['geometry-type'], 'Point'],
        ['==', ['geometry-type'], 'MultiPoint'],
      ],
      paint: {
        'circle-radius': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          7,
          4,
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#f5a623',
          '#5b8dee',
        ],
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 1,
      },
    });
  }

  _bindEvents() {
    const interactiveLayers = ['geojson-fill', 'geojson-line', 'geojson-point'];
    let hoveredId = null;

    this.map.on('mousemove', interactiveLayers, (e) => {
      if (!e.features || !e.features.length) return;

      // Clear previous hover
      if (hoveredId !== null) {
        this.map.setFeatureState({ source: 'geojson-data', id: hoveredId }, { hover: false });
      }

      hoveredId = e.features[0].id;
      this.map.setFeatureState({ source: 'geojson-data', id: hoveredId }, { hover: true });
      this.map.getCanvas().style.cursor = 'pointer';

      // Tooltip
      const props = e.features[0].properties;
      let html = '<div class="map-popup-content">';
      const keys = Object.keys(props);
      for (let i = 0; i < Math.min(keys.length, 6); i++) {
        html += `<div><strong>${this._esc(keys[i])}:</strong> ${this._esc(String(props[keys[i]]))}</div>`;
      }
      if (keys.length > 6) html += '<div style="color:var(--muted)">…</div>';
      html += '</div>';

      this._popup.setLngLat(e.lngLat).setHTML(html).addTo(this.map);

      if (this.onHoverCallback) this.onHoverCallback(props);
    });

    this.map.on('mouseleave', interactiveLayers, () => {
      if (hoveredId !== null) {
        this.map.setFeatureState({ source: 'geojson-data', id: hoveredId }, { hover: false });
      }
      hoveredId = null;
      this.map.getCanvas().style.cursor = '';
      this._popup.remove();
      if (this.onHoverCallback) this.onHoverCallback(null);
    });
  }

  updateData(geojson, onHover) {
    this.onHoverCallback = onHover;
    this._currentData = geojson;

    if (!this.map.loaded() || !this._sourceAdded) {
      this._pendingData = { geojson, onHover };
      return;
    }

    this._setData(geojson, onHover);
  }

  _setData(geojson, onHover) {
    const MAX_MAP_FEATURES = 50_000;
    let features = geojson.features || [];
    let capped = false;

    if (features.length > MAX_MAP_FEATURES) {
      console.warn(`MapViewer: capping ${features.length} features to ${MAX_MAP_FEATURES} for map render. Full dataset remains in the table.`);
      features = features.slice(0, MAX_MAP_FEATURES);
      capped = true;
    }

    // Reduce coordinate precision to 6 decimal places (~10cm accuracy)
    // and drop any Z/M dimensions — both dramatically shrink payload size.
    features = features.map((f, i) => ({
      ...f,
      id: i,
      geometry: this._simplifyGeom(f.geometry),
    }));

    const payload = { type: 'FeatureCollection', features };
    this._mapFeatureCount = features.length; // track how many IDs exist in the map source

    this.map.getSource('geojson-data').setData(payload);

    if (capped) {
      // Show a map overlay note
      this._showCapNotice(features.length, (geojson.features || []).length);
    } else {
      this._hideCapNotice();
    }

    // Auto-fit bounds (use capped features for speed)
    if (features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      let hasValidBounds = false;
      // Sample up to 1000 features for bounds calc to stay fast
      const sampleStep = Math.max(1, Math.floor(features.length / 1000));
      for (let i = 0; i < features.length; i += sampleStep) {
        const f = features[i];
        try {
          if (f.geometry && f.geometry.coordinates) {
            this._expandBounds(bounds, f.geometry.coordinates);
            hasValidBounds = true;
          }
        } catch (_) { /* skip malformed */ }
      }

      if (hasValidBounds) {
        this.map.fitBounds(bounds, {
          padding: 40,
          maxZoom: 16,
          duration: 800,
        });
      }
    }
  }

  // Reduce coordinate precision to 6dp and strip Z/M to shrink JSON payload
  _simplifyGeom(geom) {
    if (!geom) return geom;
    const round6 = (n) => Math.round(n * 1e6) / 1e6;
    const simplifyCoord = (c) => [round6(c[0]), round6(c[1])]; // drop Z
    const simplifyRing  = (ring) => ring.map(simplifyCoord);
    const simplifyRings = (rings) => rings.map(simplifyRing);

    switch (geom.type) {
      case 'Point':           return { type: 'Point', coordinates: simplifyCoord(geom.coordinates) };
      case 'LineString':      return { type: 'LineString', coordinates: simplifyRing(geom.coordinates) };
      case 'Polygon':         return { type: 'Polygon', coordinates: simplifyRings(geom.coordinates) };
      case 'MultiPoint':      return { type: 'MultiPoint', coordinates: geom.coordinates.map(simplifyCoord) };
      case 'MultiLineString': return { type: 'MultiLineString', coordinates: geom.coordinates.map(simplifyRing) };
      case 'MultiPolygon':    return { type: 'MultiPolygon', coordinates: geom.coordinates.map(simplifyRings) };
      default: return geom;
    }
  }

  _showCapNotice(shown, total) {
    let notice = this.container.querySelector('.map-cap-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.className = 'map-cap-notice';
      notice.style.cssText = [
        'position:absolute', 'bottom:32px', 'left:50%', 'transform:translateX(-50%)',
        'background:rgba(11,14,19,0.88)', 'border:1px solid #f5a623',
        'color:#f5a623', 'font-family:"Source Code Pro",monospace', 'font-size:11px',
        'padding:6px 14px', 'border-radius:5px', 'z-index:10', 'pointer-events:none',
        'white-space:nowrap'
      ].join(';');
      this.container.appendChild(notice);
    }
    notice.textContent = `⚠ Map showing first ${shown.toLocaleString()} of ${total.toLocaleString()} features — full dataset in table`;
    notice.style.display = 'block';
  }

  _hideCapNotice() {
    const notice = this.container.querySelector('.map-cap-notice');
    if (notice) notice.style.display = 'none';
  }

  _expandBounds(bounds, coords) {
    if (typeof coords[0] === 'number') {
      bounds.extend([coords[0], coords[1]]);
    } else {
      for (const c of coords) this._expandBounds(bounds, c);
    }
  }

  highlightFeature(dataItem) {
    // Reset hover on all map features (only IDs that exist in the map source)
    const count = this._mapFeatureCount || 0;
    for (let i = 0; i < count; i++) {
      this.map.setFeatureState({ source: 'geojson-data', id: i }, { hover: false });
    }
    if (!dataItem) return;
    // Match by index in the original full dataset
    if (!this._currentData || !this._currentData.features) return;
    const idx = this._currentData.features.findIndex(f => f.properties === dataItem);
    // Only highlight if this feature is actually rendered on the map
    if (idx !== -1 && idx < count) {
      this.map.setFeatureState({ source: 'geojson-data', id: idx }, { hover: true });
    }
  }

  resize() {
    if (this.map) this.map.resize();
  }

  _esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
