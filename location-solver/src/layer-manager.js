import { COLORS } from './utils.js';

const DEMAND_SOURCE = 'ls-demand';
const DEMAND_LINES_SOURCE = 'ls-lines';
const SELECTED_CIRCLES_SOURCE = 'ls-selected-circles';
const SELECTED_LABELS_SOURCE = 'ls-selected-labels';

export class LayerManager {
  constructor(map) {
    this.map = map;
    this._added = false;
  }

  addSources() {
    const map = this.map;

    const sources = [
      { id: DEMAND_SOURCE, type: 'geojson', data: this._emptyFC() },
      { id: DEMAND_LINES_SOURCE, type: 'geojson', data: this._emptyFC() },
      { id: SELECTED_CIRCLES_SOURCE, type: 'geojson', data: this._emptyFC() },
      { id: SELECTED_LABELS_SOURCE, type: 'geojson', data: this._emptyFC() },
    ];

    for (const src of sources) {
      if (!map.getSource(src.id)) {
        map.addSource(src.id, src);
      }
    }

    this._addLayers();
    this._added = true;
  }

  _addLayers() {
    const map = this.map;

    if (!map.getLayer('ls-demand-circles')) {
      map.addLayer({
        id: 'ls-demand-circles',
        type: 'circle',
        source: DEMAND_SOURCE,
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.75,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#ffffff',
        },
      });
    }

    if (!map.getLayer('ls-allocation-lines')) {
      map.addLayer({
        id: 'ls-allocation-lines',
        type: 'line',
        source: DEMAND_LINES_SOURCE,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 0.8,
          'line-opacity': 0.35,
        },
      });
    }

    if (!map.getLayer('ls-selected-circles')) {
      map.addLayer({
        id: 'ls-selected-circles',
        type: 'circle',
        source: SELECTED_CIRCLES_SOURCE,
        paint: {
          'circle-radius': 8,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.9,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#fff',
        },
      });
    }

    if (!map.getLayer('ls-selected-labels')) {
      map.addLayer({
        id: 'ls-selected-labels',
        type: 'symbol',
        source: SELECTED_LABELS_SOURCE,
        layout: {
          'text-field': ['get', 'label'],
          'text-size': 11,
          'text-offset': [0, -1.6],
          'text-anchor': 'bottom',
        },
        paint: {
          'text-color': '#1e293b',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2,
        },
      });
    }
  }

  updateDemand(demand, allocations) {
    const source = this.map.getSource(DEMAND_SOURCE);
    if (!source) return;

    const features = demand.map((d, i) => {
      let color = '#94a3b8';
      if (allocations && allocations[i] !== -1) {
        color = COLORS[allocations[i] % COLORS.length];
      }
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          color,
          radius: Math.min(6, Math.max(1.5, d.weight / 250)),
        },
      };
    });

    source.setData({ type: 'FeatureCollection', features });
  }

  updateLines(demand, candidates, selected, allocations) {
    const source = this.map.getSource(DEMAND_LINES_SOURCE);
    if (!source) return;

    const features = [];
    if (allocations && selected.length > 0) {
      const selectedCands = selected.map((i) => candidates[i]);

      for (let i = 0; i < demand.length; i++) {
        const d = demand[i];
        const assignedIdx = allocations[i];

        if (assignedIdx >= 0 && assignedIdx < selectedCands.length) {
          const cand = selectedCands[assignedIdx];
          features.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [
                [d.lng, d.lat],
                [cand.lng, cand.lat],
              ],
            },
            properties: { color: COLORS[assignedIdx % COLORS.length] },
          });
        }
      }
    }

    source.setData({ type: 'FeatureCollection', features });
  }

  updateSelected(candidates, selected) {
    const circleSource = this.map.getSource(SELECTED_CIRCLES_SOURCE);
    const labelSource = this.map.getSource(SELECTED_LABELS_SOURCE);

    if (!circleSource || !labelSource) return;

    const circleFeatures = [];
    const labelFeatures = [];

    selected.forEach((si, idx) => {
      const cand = candidates[si];
      if (!cand) return;
      const color = COLORS[idx % COLORS.length];

      circleFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cand.lng, cand.lat] },
        properties: { color },
      });

      labelFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [cand.lng, cand.lat] },
        properties: { label: `F${idx + 1}`, color },
      });
    });

    circleSource.setData({
      type: 'FeatureCollection',
      features: circleFeatures,
    });
    labelSource.setData({
      type: 'FeatureCollection',
      features: labelFeatures,
    });
  }

  clear() {
    for (const id of [
      DEMAND_SOURCE,
      DEMAND_LINES_SOURCE,
      SELECTED_CIRCLES_SOURCE,
      SELECTED_LABELS_SOURCE,
    ]) {
      const src = this.map.getSource(id);
      if (src) src.setData(this._emptyFC());
    }
  }

  remove() {
    const layerIds = [
      'ls-selected-labels',
      'ls-selected-circles',
      'ls-allocation-lines',
      'ls-demand-circles',
    ];
    const sourceIds = [
      SELECTED_LABELS_SOURCE,
      SELECTED_CIRCLES_SOURCE,
      DEMAND_LINES_SOURCE,
      DEMAND_SOURCE,
    ];

    for (const id of layerIds) {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    }
    for (const id of sourceIds) {
      if (this.map.getSource(id)) this.map.removeSource(id);
    }
    this._added = false;
  }

  _emptyFC() {
    return { type: 'FeatureCollection', features: [] };
  }
}
