import { nextCandidateId } from './utils.js';

export class MarkerManager {
  constructor(map, options = {}) {
    this.map = map;
    this._markers = new Map();
    this._candidates = [];
    this._selected = [];
    this._listeners = {};
    this._addingMode = false;
    this._nextId = 0;

    this._pinColors = options.pinColors || {
      unselected: { fill: '#1e293b', stroke: '#94a3b8' },
      selected: { fill: '#dc2626', stroke: '#fecaca' },
    };
  }

  get candidates() {
    return this._candidates;
  }

  set candidates(list) {
    this._candidates = list;
    this._syncMarkers();
  }

  get selected() {
    return this._selected;
  }

  set selected(list) {
    this._selected = list;
    this._syncMarkers();
  }

  setAddingMode(active) {
    this._addingMode = active;
    if (active) {
      this.map.getCanvas().style.cursor = 'crosshair';
    } else {
      this.map.getCanvas().style.cursor = '';
    }
  }

  addCandidate(lng, lat) {
    const id = nextCandidateId();
    const candidate = { id, lng, lat };
    this._candidates = [...this._candidates, candidate];
    this._syncMarkers();
    this._emit('candidatesChanged', this._candidates);
    return candidate;
  }

  removeCandidate(id) {
    this._candidates = this._candidates.filter((c) => c.id !== id);
    const marker = this._markers.get(id);
    if (marker) {
      marker.remove();
      this._markers.delete(id);
    }
    this._emit('candidatesChanged', this._candidates);
  }

  updateCandidate(id, lng, lat) {
    this._candidates = this._candidates.map((c) =>
      c.id === id ? { ...c, lng, lat } : c
    );
    const marker = this._markers.get(id);
    if (marker) {
      marker.setLngLat([lng, lat]);
      this._updateMarkerStyle(id);
    }
    this._emit('candidatesChanged', this._candidates);
  }

  _createMarkerEl(candidate) {
    const isSelected = this._selected.includes(this._candidates.indexOf(candidate));
    const colors = isSelected ? this._pinColors.selected : this._pinColors.unselected;

    const el = document.createElement('div');
    el.className = 'ls-marker';
    el.innerHTML = `
      <div class="ls-marker-inner">
        <svg width="32" height="44" viewBox="-16 -44 32 44" class="ls-marker-svg">
          <filter id="ls-shadow-${candidate.id}">
            <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.3"/>
          </filter>
          <path
            d="M0 0 C -9.5 -12 -16 -24 -16 -34 A 16 16 0 0 1 16 -34 C 16 -24 9.5 -12 0 0 Z"
            fill="${colors.fill}"
            stroke="${colors.stroke}"
            stroke-width="1.5"
            filter="url(#ls-shadow-${candidate.id})"
          />
          <circle cx="0" cy="-34" r="6" fill="${colors.stroke}" stroke="#fff" stroke-width="1.5" />
          <circle cx="0" cy="-34" r="2.5" fill="${colors.fill}" />
        </svg>
        <button class="ls-marker-remove" title="Remove candidate">&times;</button>
      </div>
    `;

    el.querySelector('.ls-marker-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeCandidate(candidate.id);
    });

    return el;
  }

  _updateMarkerStyle(id) {
    const marker = this._markers.get(id);
    if (!marker) return;

    const candidate = this._candidates.find((c) => c.id === id);
    if (!candidate) return;

    const isSelected = this._selected.includes(
      this._candidates.indexOf(candidate)
    );
    const colors = isSelected
      ? this._pinColors.selected
      : this._pinColors.unselected;

    const el = marker.getElement();
    const path = el.querySelector('path');
    const outerCircle = el.querySelector('circle:nth-of-type(1)');
    const innerCircle = el.querySelector('circle:nth-of-type(2)');

    if (path) {
      path.setAttribute('fill', colors.fill);
      path.setAttribute('stroke', colors.stroke);
    }
    if (outerCircle) {
      outerCircle.setAttribute('fill', colors.stroke);
    }
    if (innerCircle) {
      innerCircle.setAttribute('fill', colors.fill);
    }
  }

  _syncMarkers() {
    const existingIds = new Set(this._markers.keys());
    const currentIds = new Set(this._candidates.map((c) => c.id));

    for (const id of existingIds) {
      if (!currentIds.has(id)) {
        this._markers.get(id).remove();
        this._markers.delete(id);
      }
    }

    for (const candidate of this._candidates) {
      if (!this._markers.has(candidate.id)) {
        const el = this._createMarkerEl(candidate);
        const marker = new maplibregl.Marker({
          element: el,
          draggable: true,
          anchor: 'bottom',
        })
          .setLngLat([candidate.lng, candidate.lat])
          .addTo(this.map);

        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          this.updateCandidate(candidate.id, lngLat.lng, lngLat.lat);
          this._emit('candidateDragEnd', {
            id: candidate.id,
            lng: lngLat.lng,
            lat: lngLat.lat,
          });
        });

        this._markers.set(candidate.id, marker);
      } else {
        const marker = this._markers.get(candidate.id);
        marker.setLngLat([candidate.lng, candidate.lat]);
        this._updateMarkerStyle(candidate.id);
      }
    }
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => {
      this._listeners[event] = this._listeners[event].filter(
        (cb) => cb !== callback
      );
    };
  }

  _emit(event, data) {
    (this._listeners[event] || []).forEach((cb) => cb(data));
  }

  destroy() {
    for (const marker of this._markers.values()) {
      marker.remove();
    }
    this._markers.clear();
  }
}
