/* ═══════════════════════════════════════════════════════════════════════════
   dashboard.js — State management, KPI computation, narrative engine
   ═══════════════════════════════════════════════════════════════════════════ */

// ── Global dashboard state ──────────────────────────────────────────────
const DashboardState = {
    // Raw data (set once after fetch)
    dashboardData: null,   // { allocations, summary, timeseries, substations }
    parcelsGeoJSON: null,
    substationsGeoJSON: null,

    // Filter state
    yearRange: [2025, 2050],
    technology: 'all',        // 'all' | 'PV' | 'Wind'
    connectionLevel: 'all',   // 'all' | 'primary' | 'bsp'
    colourMode: 'technology', // 'technology' | 'suitability' | 'status'
    showConnections: true,
    showUnallocated: false,
    selectedSubstation: null, // substation id or null

    // Callbacks registered by other modules
    _listeners: [],

    onChange(fn) {
        this._listeners.push(fn);
    },

    notify() {
        this._listeners.forEach(fn => fn(this));
    },

    /** Apply a partial state update and notify listeners */
    set(partial) {
        Object.assign(this, partial);
        this.notify();
    },

    reset() {
        this.set({
            yearRange: [2025, 2050],
            technology: 'all',
            connectionLevel: 'all',
            colourMode: 'technology',
            showConnections: true,
            showUnallocated: false,
            selectedSubstation: null,
        });
    },
};


// ── Derived data helpers ────────────────────────────────────────────────
function getFilteredAllocations(state) {
    if (!state.dashboardData) return [];
    const allocs = state.dashboardData.allocations;
    return allocs.filter(a => {
        if (a.deployment_year < state.yearRange[0] || a.deployment_year > state.yearRange[1]) return false;
        if (state.technology !== 'all' && a.technology !== state.technology) return false;
        if (state.connectionLevel !== 'all' && a.connection_level !== state.connectionLevel) return false;
        if (state.selectedSubstation && a.connection_substation_id !== state.selectedSubstation) return false;
        return true;
    });
}

function computeKPIs(state) {
    const s = state.dashboardData?.summary;
    if (!s) return null;

    const filtered = getFilteredAllocations(state);
    const totalMW = filtered.reduce((sum, a) => sum + (a.estimated_capacity_mw || 0), 0);
    const parcels = filtered.length;
    const substations = new Set(filtered.map(a => a.connection_substation_id)).size;

    // Estimation of generation: PV * CF_PV * 8760 + Wind * CF_WIND * 8760, in GWh
    const pvMW = filtered.filter(a => a.technology === 'PV').reduce((s, a) => s + (a.estimated_capacity_mw || 0), 0);
    const windMW = filtered.filter(a => a.technology === 'Wind').reduce((s, a) => s + (a.estimated_capacity_mw || 0), 0);
    const genGWh = (pvMW * 8760 * s.cf_pv + windMW * 8760 * s.cf_wind) / 1000;

    // Use global denominators for percentages
    const pctPotential = s.total_potential_mw > 0 ? (totalMW / s.total_potential_mw * 100) : 0;
    const pctHeadroom = s.total_headroom_mw > 0 ? (totalMW / s.total_headroom_mw * 100) : 0;

    return {
        parcels,
        totalMW,
        pctPotential,
        pctHeadroom,
        substations,
        genGWh,
        pvMW,
        windMW,
        // Context
        totalParcels: s.total_allocated,
        totalCapacity: s.total_capacity_mw,
        totalPotential: s.total_potential_mw,
        totalHeadroom: s.total_headroom_mw,
    };
}


// ── KPI panel renderer ──────────────────────────────────────────────────
function renderKPIs(state) {
    const k = computeKPIs(state);
    if (!k) return;

    const isFiltered = (
        state.yearRange[0] !== 2025 || state.yearRange[1] !== 2050 ||
        state.technology !== 'all' || state.connectionLevel !== 'all' ||
        state.selectedSubstation !== null
    );

    const el = (id) => document.getElementById(id);

    el('kpi-parcels').textContent = k.parcels.toLocaleString();
    el('kpi-parcels-sub').textContent = isFiltered
        ? `of ${k.totalParcels.toLocaleString()} total`
        : `from ${state.dashboardData.summary.total_parcels.toLocaleString()} assessed`;

    el('kpi-capacity').textContent = k.totalMW.toFixed(1);
    el('kpi-capacity-sub').textContent = isFiltered
        ? `of ${k.totalCapacity.toFixed(1)} MW total`
        : `PV: ${k.pvMW.toFixed(1)} / Wind: ${k.windMW.toFixed(1)}`;

    el('kpi-potential-pct').textContent = k.pctPotential.toFixed(1) + '%';
    el('kpi-potential-sub').textContent = `${k.totalMW.toFixed(1)} of ${k.totalPotential.toLocaleString()} MW`;

    el('kpi-headroom').textContent = k.pctHeadroom.toFixed(1) + '%';
    el('kpi-headroom-sub').textContent = `${k.totalMW.toFixed(1)} of ${k.totalHeadroom.toFixed(1)} MW`;

    el('kpi-substations').textContent = k.substations;
    el('kpi-substations-sub').textContent = isFiltered ? 'in filter' : 'serving sites';

    el('kpi-generation').textContent = k.genGWh.toFixed(1);
    el('kpi-generation-sub').textContent = `~${Math.round(k.genGWh * 1000 / 3.5).toLocaleString()} homes`;
}


// ── Narrative engine ────────────────────────────────────────────────────
function renderNarrative(state) {
    const s = state.dashboardData?.summary;
    if (!s) return;

    const k = computeKPIs(state);
    const el = document.getElementById('narrative-text');
    const parts = [];

    const isDefault = (
        state.yearRange[0] === 2025 && state.yearRange[1] === 2050 &&
        state.technology === 'all' && state.connectionLevel === 'all' &&
        state.selectedSubstation === null
    );

    if (isDefault) {
        // Full baseline narrative
        parts.push(
            `The deployment plan selects <strong>${s.total_allocated.toLocaleString()}</strong> sites ` +
            `from ${s.total_parcels.toLocaleString()} assessed parcels, ` +
            `deploying <strong>${s.total_capacity_mw.toFixed(1)} MW</strong> of generation capacity.`
        );
        parts.push(
            `This represents <strong>${s.capacity_pct_of_potential}%</strong> of the total ` +
            `${s.total_potential_mw.toLocaleString()} MW technical potential &mdash; ` +
            `the gap is because each site&rsquo;s capacity is limited by the grid headroom ` +
            `at its local substation, not by land area.`
        );
        parts.push(
            `<strong>${s.headroom_utilisation_pct}%</strong> of the ${s.total_headroom_mw.toFixed(0)} MW ` +
            `available grid headroom is utilised. The remainder sits at substations ` +
            `where there are not enough nearby suitable parcels to fill the available capacity.`
        );
        parts.push(
            `Technology mix: <strong>${s.pv_allocated_mw.toFixed(1)} MW PV</strong> ` +
            `(${s.pv_allocated_count} sites) and ` +
            `<strong>${s.wind_allocated_mw.toFixed(1)} MW Wind</strong> ` +
            `(${s.wind_allocated_count} sites).`
        );
    } else {
        // Contextual narrative responding to filters
        if (state.selectedSubstation) {
            const sub = state.dashboardData.substations.find(
                s => s.id === state.selectedSubstation
            );
            if (sub) {
                parts.push(
                    `<strong>${sub.id}</strong> (${sub.connection_level.toUpperCase()}) &mdash; ` +
                    `${sub.headroom_mw.toFixed(1)} MW headroom, ` +
                    `${sub.allocated_mw.toFixed(2)} MW allocated across ${sub.parcels} sites ` +
                    `(${sub.utilisation_pct.toFixed(1)}% utilised).`
                );
            }
        }

        const [y0, y1] = state.yearRange;
        if (y0 !== 2025 || y1 !== 2050) {
            const span = y0 === y1 ? `In ${y0}` : `Between ${y0} and ${y1}`;
            parts.push(
                `${span}, <strong>${k.parcels}</strong> sites deploy ` +
                `<strong>${k.totalMW.toFixed(1)} MW</strong> ` +
                `(${k.pctHeadroom.toFixed(1)}% of grid headroom).`
            );

            // Cumulative context: what's deployed up to y1
            const ts = state.dashboardData.timeseries;
            const cumEntry = ts.filter(t => t.year <= y1).pop();
            if (cumEntry) {
                parts.push(
                    `Cumulative by ${y1}: ${cumEntry.cumulative_mw.toFixed(1)} MW installed ` +
                    `across ${cumEntry.cumulative_parcels} sites, ` +
                    `generating ~${(cumEntry.cumulative_generation_mwh / 1000).toFixed(1)} GWh/year.`
                );
            }
        }

        if (state.technology !== 'all') {
            const techMW = state.technology === 'PV' ? k.pvMW : k.windMW;
            const techPct = s.total_capacity_mw > 0 ? (techMW / s.total_capacity_mw * 100) : 0;
            parts.push(
                `${state.technology} accounts for <strong>${techMW.toFixed(1)} MW</strong> ` +
                `across ${k.parcels} sites (${techPct.toFixed(1)}% of total allocated capacity).`
            );
        }

        if (state.connectionLevel !== 'all') {
            const levelLabel = state.connectionLevel === 'primary' ? '33kV Primary' : '132kV BSP';
            parts.push(
                `Showing ${levelLabel} connections: ` +
                `<strong>${k.parcels}</strong> sites, ` +
                `<strong>${k.totalMW.toFixed(1)} MW</strong>.`
            );
        }

        if (parts.length === 0) {
            parts.push(
                `Filtered view: <strong>${k.parcels}</strong> sites, ` +
                `<strong>${k.totalMW.toFixed(1)} MW</strong> capacity.`
            );
        }
    }

    el.innerHTML = parts.join('<br><br>');
}


// ── Legend renderer ─────────────────────────────────────────────────────
function renderLegend(state) {
    const el = document.getElementById('legend-content');
    let html = '';

    // Parcels legend depends on colour mode
    html += '<div class="legend-section">Parcels</div>';
    if (state.colourMode === 'technology') {
        html += legendRow('#F8B648', 'PV');
        html += legendRow('#065D92', 'Wind');
    } else if (state.colourMode === 'suitability') {
        html += legendRow('#008001', 'Suitable (TRUE)');
        html += legendRow('#F8B648', 'Marginal (MAYBE)');
        html += legendRow('#e74c3c', 'Unsuitable (FALSE)');
    } else {
        html += legendRow('#008001', 'Allocated');
        html += legendRow('#9ca3af', 'Not allocated');
    }

    html += '<div class="legend-section">Substations</div>';
    html += '<div class="legend-hint">Size = headroom capacity (MW)</div>';
    html += legendCircle('#9ca3af', 'Low utilisation (0%)');
    html += legendCircle('#F8B648', 'Moderate (~30%)');
    html += legendCircle('#008001', 'Good (~70%)');
    html += legendCircle('#7D2248', 'High (100%)');
    html += '<div class="legend-hint" style="margin-top:4px">Click a substation for details</div>';

    html += '<div class="legend-section">Connections</div>';
    html += legendRow('#F8B648', 'PV connection');
    html += legendRow('#065D92', 'Wind connection');

    el.innerHTML = html;
}

function legendRow(colour, label) {
    return `<div class="legend-row"><span class="legend-swatch" style="background:${colour}"></span>${label}</div>`;
}
function legendCircle(colour, label) {
    return `<div class="legend-row"><span class="legend-circle" style="background:${colour}"></span>${label}</div>`;
}


/**
 * Sync a header button group UI to match the current state value.
 * Called by charts when they change a filter via DashboardState.set().
 */
function syncButtonGroup(containerId, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll('.btn').forEach(b => {
        b.classList.toggle('active', b.dataset.value === value);
    });
}

// Listen for state changes and keep button groups in sync
DashboardState.onChange((state) => {
    syncButtonGroup('tech-filter', state.technology);
    syncButtonGroup('level-filter', state.connectionLevel);
    syncButtonGroup('colour-mode', state.colourMode);
});

/**
 * Sync the time slider UI to match a year range.
 * Called by charts when they cross-filter the year range.
 */
function syncSlider(y0, y1) {
    const slider = document.getElementById('time-slider');
    if (!slider?.noUiSlider) return;
    if (_sliderMode === 'single') {
        slider.noUiSlider.set(y0);
    } else {
        slider.noUiSlider.set([y0, y1]);
    }
}


// ── Playback state ──────────────────────────────────────────────────────
let _playInterval = null;
let _sliderMode = 'range'; // 'range' | 'single'

function stopPlayback() {
    if (_playInterval) {
        clearInterval(_playInterval);
        _playInterval = null;
    }
    const btn = document.getElementById('btn-play');
    btn.innerHTML = '&#9654;';
    btn.classList.remove('playing');
}

function startPlayback() {
    const slider = document.getElementById('time-slider');
    stopPlayback(); // clear any existing

    // Always switch to single-year mode for playback
    if (_sliderMode !== 'single') {
        switchToSingle(slider);
    }

    const btn = document.getElementById('btn-play');
    btn.innerHTML = '&#9646;&#9646;';
    btn.classList.add('playing');

    // Start from current position or 2025
    let current = DashboardState.yearRange[0];
    if (current >= 2050) current = 2025;

    _playInterval = setInterval(() => {
        current++;
        if (current > 2050) {
            stopPlayback();
            return;
        }
        slider.noUiSlider.set(current);
        DashboardState.set({ yearRange: [current, current] });
    }, 800);
}

function switchToRange(slider) {
    _sliderMode = 'range';
    stopPlayback();

    document.getElementById('mode-range').classList.add('active');
    document.getElementById('mode-single').classList.remove('active');

    // Destroy and recreate as range slider
    slider.noUiSlider.destroy();
    createSlider(slider, 'range');
    DashboardState.set({ yearRange: [2025, 2050] });
}

function switchToSingle(slider) {
    _sliderMode = 'single';

    document.getElementById('mode-single').classList.add('active');
    document.getElementById('mode-range').classList.remove('active');

    const currentStart = DashboardState.yearRange[0];

    // Destroy and recreate as single-handle slider
    slider.noUiSlider.destroy();
    createSlider(slider, 'single', currentStart);
    DashboardState.set({ yearRange: [currentStart, currentStart] });
}

function createSlider(el, mode, initialValue) {
    const isSingle = mode === 'single';
    const start = isSingle ? (initialValue || 2025) : [2025, 2050];

    noUiSlider.create(el, {
        start: start,
        connect: isSingle ? [true, false] : true,
        step: 1,
        range: { min: 2025, max: 2050 },
        format: {
            to: v => Math.round(v),
            from: v => Number(v),
        },
        pips: {
            mode: 'values',
            values: [2025, 2030, 2035, 2040, 2045, 2050],
            density: 4,
        },
    });

    el.noUiSlider.on('update', (values) => {
        const label = document.getElementById('year-label');
        if (isSingle) {
            label.textContent = String(Number(values[0]));
        } else {
            const y0 = Number(values[0]);
            const y1 = Number(values[1]);
            label.textContent = y0 === y1 ? `${y0}` : `${y0} \u2013 ${y1}`;
        }
    });

    el.noUiSlider.on('change', (values) => {
        if (isSingle) {
            const yr = Number(values[0]);
            DashboardState.set({ yearRange: [yr, yr] });
        } else {
            DashboardState.set({ yearRange: [Number(values[0]), Number(values[1])] });
        }
    });
}


// ── Wire up header controls ─────────────────────────────────────────────
function initControls() {
    // Time slider — initialise as range mode
    const slider = document.getElementById('time-slider');
    createSlider(slider, 'range');

    // Play / pause button
    document.getElementById('btn-play').addEventListener('click', () => {
        if (_playInterval) {
            stopPlayback();
        } else {
            startPlayback();
        }
    });

    // Range / Single mode toggle
    document.getElementById('mode-range').addEventListener('click', () => {
        switchToRange(slider);
    });
    document.getElementById('mode-single').addEventListener('click', () => {
        switchToSingle(slider);
    });

    // Button groups
    function wireButtonGroup(containerId, stateKey) {
        const container = document.getElementById(containerId);
        container.querySelectorAll('.btn').forEach(btn => {
            btn.addEventListener('click', () => {
                container.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                DashboardState.set({ [stateKey]: btn.dataset.value });
            });
        });
    }

    wireButtonGroup('tech-filter', 'technology');
    wireButtonGroup('level-filter', 'connectionLevel');
    wireButtonGroup('colour-mode', 'colourMode');

    // Toggle checkboxes
    document.getElementById('toggle-connections').addEventListener('change', (e) => {
        DashboardState.set({ showConnections: e.target.checked });
    });
    document.getElementById('toggle-unallocated').addEventListener('change', (e) => {
        DashboardState.set({ showUnallocated: e.target.checked });
    });

    // Reset button
    document.getElementById('btn-reset').addEventListener('click', () => {
        // Stop any playback
        stopPlayback();
        // Reset slider to range mode
        if (_sliderMode !== 'range') {
            switchToRange(slider);
        } else {
            slider.noUiSlider.set([2025, 2050]);
        }
        // Reset button groups — activate the first button in each group
        document.querySelectorAll('.btn-group').forEach(g => {
            g.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
            const first = g.querySelector('.btn');
            if (first) first.classList.add('active');
        });
        // Reset checkboxes
        document.getElementById('toggle-connections').checked = true;
        document.getElementById('toggle-unallocated').checked = false;
        // Reset state
        DashboardState.reset();
    });

    // Detail panel close
    document.getElementById('detail-close').addEventListener('click', () => {
        document.getElementById('detail-panel').classList.add('hidden');
        DashboardState.set({ selectedSubstation: null });
    });
}


// ── Register renderers as state listeners ───────────────────────────────
DashboardState.onChange(renderKPIs);
DashboardState.onChange(renderNarrative);
DashboardState.onChange(renderLegend);
