export class ControlPanel {
  constructor(options = {}) {
    this._el = null;
    this._options = {
      title: 'Location Solver',
      subtitle: 'Drag markers, adjust p, and solve to find optimal facility locations.',
      initialP: 8,
      ...options,
    };
    this._state = {
      p: this._options.initialP,
      solving: false,
      stats: null,
      candidateCount: 0,
      selectedCount: 0,
      demandCount: 0,
      addingMode: false,
    };
    this._listeners = {};
  }

  getElement() {
    if (this._el) return this._el;
    this._el = this._build();
    return this._el;
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'ls-control';
    el.innerHTML = `
      <div class="ls-control-header">
        <h1 class="ls-control-title">${this._options.title}</h1>
        <p class="ls-control-subtitle">${this._options.subtitle}</p>
      </div>

      <div class="ls-control-section">
        <div class="ls-p-slider">
          <div class="ls-p-slider-header">
            <label class="ls-p-slider-label">Facilities to select</label>
            <span class="ls-p-value" data-ls-pval>${this._state.p}</span>
          </div>
          <input type="range" class="ls-p-range" data-ls-prange
            min="1" max="20" value="${this._state.p}" />
          <div class="ls-p-range-labels">
            <span>1</span>
            <span>${Math.floor(20 / 2)}</span>
            <span>20</span>
          </div>
        </div>

        <div class="ls-candidate-actions">
          <button class="ls-btn ls-btn-add" data-ls-addbtn>
            <span class="ls-btn-icon">+</span> Add Candidate
          </button>
          <button class="ls-btn ls-btn-remove" data-ls-removebtn>
            &minus; Remove Mode
          </button>
        </div>

        <button class="ls-btn ls-btn-solve" data-ls-solvebtn>
          <span class="ls-btn-label">Solve</span>
        </button>
      </div>

      <div class="ls-control-section ls-results-section" data-ls-results>
        <h2 class="ls-results-title">Results</h2>
        <div class="ls-results-empty" data-ls-empty>Click Solve to see results</div>
        <div class="ls-results-content" data-ls-content style="display:none">
          <div class="ls-stat">
            <span class="ls-stat-label">Selected Facilities</span>
            <span class="ls-stat-value" data-ls-stat-selected>0</span>
          </div>
          <div class="ls-stat">
            <span class="ls-stat-label">Total Weighted Distance</span>
            <span class="ls-stat-value" data-ls-stat-cost>0 km</span>
          </div>
          <div class="ls-stat">
            <span class="ls-stat-label">Max Distance</span>
            <span class="ls-stat-value" data-ls-stat-max>0 km</span>
          </div>
          <div class="ls-stat">
            <span class="ls-stat-label">Median Distance</span>
            <span class="ls-stat-value" data-ls-stat-median>0 km</span>
          </div>
          <div class="ls-stat">
            <span class="ls-stat-label">Average Distance</span>
            <span class="ls-stat-value" data-ls-stat-avg>0 km</span>
          </div>
        </div>
      </div>

      <div class="ls-control-footer" data-ls-footer>
        <span data-ls-footer-text></span>
      </div>
    `;

    this._bindEvents(el);
    return el;
  }

  _bindEvents(el) {
    const pRange = el.querySelector('[data-ls-prange]');
    pRange.addEventListener('input', () => {
      this._state.p = parseInt(pRange.value);
      el.querySelector('[data-ls-pval]').textContent = this._state.p;
      this._emit('pChanged', this._state.p);
    });

    const addBtn = el.querySelector('[data-ls-addbtn]');
    addBtn.addEventListener('click', () => {
      this._state.addingMode = !this._state.addingMode;
      addBtn.classList.toggle('ls-btn-add--active', this._state.addingMode);
      if (this._state.addingMode) {
        addBtn.innerHTML = '<span class="ls-btn-icon">+</span> Click on map...';
      } else {
        addBtn.innerHTML = '<span class="ls-btn-icon">+</span> Add Candidate';
      }
      this._emit('addingModeChanged', this._state.addingMode);
    });

    const removeBtn = el.querySelector('[data-ls-removebtn]');
    removeBtn.addEventListener('click', () => {
      this._emit('removeLastCandidate');
    });

    const solveBtn = el.querySelector('[data-ls-solvebtn]');
    solveBtn.addEventListener('click', () => {
      this._emit('solveRequested');
    });
  }

  set p(value) {
    this._state.p = value;
    if (this._el) {
      this._el.querySelector('[data-ls-prange]').value = value;
      this._el.querySelector('[data-ls-pval]').textContent = value;
    }
  }

  get p() {
    return this._state.p;
  }

  setSolving(active) {
    this._state.solving = active;
    if (this._el) {
      const btn = this._el.querySelector('[data-ls-solvebtn]');
      btn.disabled = active;
      btn.querySelector('.ls-btn-label').textContent = active ? 'Solving...' : 'Solve';
      btn.classList.toggle('ls-btn-solve--loading', active);
    }
  }

  setStats(stats) {
    this._state.stats = stats;
    if (!this._el || !stats) return;

    const contentEl = this._el.querySelector('[data-ls-content]');
    const emptyEl = this._el.querySelector('[data-ls-empty]');

    emptyEl.style.display = 'none';
    contentEl.style.display = '';

    this._el.querySelector('[data-ls-stat-selected]').textContent = stats.selectedCount || 0;
    this._el.querySelector('[data-ls-stat-cost]').textContent =
      `${Math.round(stats.totalCost).toLocaleString()} km`;
    this._el.querySelector('[data-ls-stat-max]').textContent =
      `${stats.maxDist.toFixed(1)} km`;
    this._el.querySelector('[data-ls-stat-median]').textContent =
      `${stats.medianDist.toFixed(1)} km`;
    this._el.querySelector('[data-ls-stat-avg]').textContent =
      `${stats.avgDist.toFixed(1)} km`;
  }

  clearStats() {
    this._state.stats = null;
    if (this._el) {
      const contentEl = this._el.querySelector('[data-ls-content]');
      const emptyEl = this._el.querySelector('[data-ls-empty]');
      emptyEl.style.display = '';
      contentEl.style.display = 'none';
    }
  }

  setFooterInfo(info) {
    if (!this._el) return;
    const footerText = this._el.querySelector('[data-ls-footer-text]');
    footerText.textContent = info || '';
  }

  updateCandidateCount(count) {
    this._state.candidateCount = count;
    if (this._el) {
      const pRange = this._el.querySelector('[data-ls-prange]');
      pRange.max = Math.max(count, 1);
      this._el.querySelector(
        '.ls-p-range-labels span:last-child'
      ).textContent = count;
    }
  }

  updateP(p) {
    this._state.p = p;
    if (this._el) {
      this._el.querySelector('[data-ls-prange]').value = p;
      this._el.querySelector('[data-ls-pval]').textContent = p;
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
    if (this._el && this._el.parentNode) {
      this._el.parentNode.removeChild(this._el);
    }
    this._listeners = {};
  }
}
