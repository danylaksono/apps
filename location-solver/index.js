import { solvePMedian, computeStats } from './src/solver.js';
import { LayerManager } from './src/layer-manager.js';
import { MarkerManager } from './src/marker-manager.js';
import { ControlPanel } from './src/control.js';

export { solvePMedian, computeStats } from './src/solver.js';
export { generateMockData, haversineDist, COLORS } from './src/utils.js';
export { LayerManager } from './src/layer-manager.js';
export { MarkerManager } from './src/marker-manager.js';
export { ControlPanel } from './src/control.js';

export class LocationSolver {
  constructor(options = {}) {
    this._map = null;
    this._options = {
      p: 8,
      maxIterations: 50,
      autoSolve: true,
      position: 'top-right',
      demand: [],
      candidates: [],
      onSolveStart: null,
      onSolveEnd: null,
      ...options,
    };

    this._demand = this._options.demand;
    this._candidates = this._options.candidates;
    this._p = this._options.p;
    this._solution = null;

    this._controlPanel = new ControlPanel({
      title: this._options.title || 'Location Solver',
      subtitle: this._options.subtitle || 'Drag markers, adjust p, and solve.',
      initialP: this._options.p,
    });

    this._layers = null;
    this._markers = null;
    this._init = false;
    this._mapClickUnsub = null;
    this._removingMode = false;
  }

  _initAddTo(map) {
    this._map = map;
    this._layers = new LayerManager(map);
    this._markers = new MarkerManager(map, this._options.markerOptions);

    this._layers.addSources();

    this._markers.candidates = this._candidates;
    this._controlPanel.updateCandidateCount(this._candidates.length);

    this._markers.on('candidatesChanged', (candidates) => {
      this._candidates = candidates;
      this._controlPanel.updateCandidateCount(candidates.length);
      if (this._options.autoSolve && this._demand.length > 0) {
        this.solve();
      } else {
        this._render();
      }
    });

    this._markers.on('candidateDragEnd', () => {
      if (this._options.autoSolve && this._demand.length > 0) {
        this.solve();
      } else {
        this._render();
      }
    });

    this._controlPanel.on('pChanged', (p) => {
      this._p = p;
      if (this._options.autoSolve && this._demand.length > 0) {
        this.solve();
      }
    });

    this._controlPanel.on('solveRequested', () => {
      this.solve();
    });

    this._controlPanel.on('addingModeChanged', (active) => {
      this._markers.setAddingMode(active);
      if (active) {
        this._mapClickUnsub = map.on('click', (e) => {
          const candidate = this._markers.addCandidate(e.lngLat.lng, e.lngLat.lat);
          this._controlPanel.setAddingMode(false);
          this._markers.setAddingMode(false);
          const btn = this._controlPanel.getElement().querySelector('[data-ls-addbtn]');
          btn.classList.remove('ls-btn-add--active');
          btn.innerHTML = '<span class="ls-btn-icon">+</span> Add Candidate';
          if (this._mapClickUnsub) {
            this._mapClickUnsub();
            this._mapClickUnsub = null;
          }
        });
      } else {
        if (this._mapClickUnsub) {
          this._mapClickUnsub();
          this._mapClickUnsub = null;
        }
      }
    });

    this._controlPanel.on('removeLastCandidate', () => {
      if (this._candidates.length === 0) return;
      const last = this._candidates[this._candidates.length - 1];
      this._markers.removeCandidate(last.id);
    });

    this._init = true;

    if (this._demand.length > 0 && this._candidates.length > 0) {
      requestAnimationFrame(() => this.solve());
    }
  }

  setData(demand, candidates) {
    this._demand = demand;
    this._candidates = candidates;
    if (this._markers) {
      this._markers.candidates = candidates;
      this._controlPanel.updateCandidateCount(candidates.length);
    }
    if (this._init) {
      this.solve();
    }
  }

  setP(p) {
    this._p = Math.max(1, Math.min(p, this._candidates.length));
    this._controlPanel.updateP(this._p);
  }

  solve() {
    if (!this._init || this._demand.length === 0 || this._candidates.length === 0) return;
    if (this._candidates.length < this._p) {
      this.setP(this._candidates.length);
    }

    this._controlPanel.setSolving(true);
    this._controlPanel.clearStats();

    if (this._options.onSolveStart) {
      this._options.onSolveStart({ demand: this._demand, candidates: this._candidates, p: this._p });
    }

    const start = performance.now();

    setTimeout(() => {
      const solution = solvePMedian({
        demand: this._demand,
        candidates: this._candidates,
        p: this._p,
        maxIterations: this._options.maxIterations,
      });

      const timeMs = performance.now() - start;
      const stats = computeStats(this._demand, this._candidates, solution);

      stats.timeMs = timeMs;
      stats.selectedCount = solution.selected.length;

      this._solution = { ...solution, stats };

      this._render();
      this._controlPanel.setStats(stats);
      this._controlPanel.setFooterInfo(
        `${this._candidates.length} candidates | ${this._demand.length.toLocaleString()} demand points | ${(stats.totalPop / 1000).toFixed(0)}k total pop | Solved in ${timeMs.toFixed(0)}ms`
      );
      this._controlPanel.setSolving(false);

      if (this._options.onSolveEnd) {
        this._options.onSolveEnd(this._solution, stats);
      }
    }, 10);
  }

  _render() {
    if (!this._layers || !this._markers) return;

    if (this._solution) {
      const { selected, allocations } = this._solution;
      this._layers.updateDemand(this._demand, allocations);
      this._layers.updateLines(this._demand, this._candidates, selected, allocations);
      this._layers.updateSelected(this._candidates, selected);
      this._markers.selected = selected;
    } else {
      this._layers.updateDemand(this._demand, null);
      this._layers.updateLines(this._demand, this._candidates, [], null);
      this._layers.updateSelected(this._candidates, []);
      this._markers.selected = [];
    }
  }

  getSolution() {
    return this._solution;
  }

  attach(map) {
    if (!this._init) {
      this._initAddTo(map);
    }
  }

  getContainer() {
    return this._controlPanel.getElement();
  }

  onAdd(map) {
    this._container = document.createElement('div');
    this._container.className = 'ls-container mapboxgl-ctrl';

    const panelEl = this._controlPanel.getElement();
    this._container.appendChild(panelEl);

    this._initAddTo(map);

    return this._container;
  }

  onRemove() {
    if (this._mapClickUnsub) this._mapClickUnsub();
    if (this._layers) this._layers.remove();
    if (this._markers) this._markers.destroy();
    if (this._controlPanel) this._controlPanel.destroy();
    if (this._container && this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
    }
    this._map = null;
    this._init = false;
  }

  getDefaultPosition() {
    return this._options.position || 'top-right';
  }

  destroy() {
    this.onRemove();
  }
}
