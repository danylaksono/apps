/* ═══════════════════════════════════════════════════════════════════════════
   charts.js — Four interactive ECharts with cross-filtering
   ═══════════════════════════════════════════════════════════════════════════ */

let annualChart      = null;
let cumulativeChart  = null;
let techMixChart     = null;
let substationChart  = null;

const CLR = {
    pv:        '#F8B648',
    wind:      '#065D92',
    primary:   '#7D2248',
    bsp:       '#065D92',
    allocated: '#008001',
    remaining: '#e5e7eb',
    muted:     '#6b7280',
    highlight: 'rgba(125,34,72,0.08)',
};

// Shared tooltip text style
const TOOLTIP = { textStyle: { fontSize: 11 } };
const TITLE_STYLE = { fontSize: 12, fontWeight: 600, color: CLR.muted };
const LEGEND_STYLE = { textStyle: { fontSize: 10 }, itemWidth: 12, itemHeight: 8 };


// ═════════════════════════════════════════════════════════════════════════
// 1. Annual Deployment Bar Chart (stacked PV / Wind per year)
// ═════════════════════════════════════════════════════════════════════════
function initAnnualChart() {
    const dom = document.getElementById('chart-annual');
    if (!dom) return;
    annualChart = echarts.init(dom);

    // Click a bar → set year range to that single year
    annualChart.on('click', (params) => {
        if (params.componentType === 'series') {
            const yr = Number(params.name);
            const [y0, y1] = DashboardState.yearRange;
            if (y0 === yr && y1 === yr) {
                // Already selected → reset to full range
                DashboardState.set({ yearRange: [2025, 2050] });
            } else {
                DashboardState.set({ yearRange: [yr, yr] });
            }
            // Sync the slider
            syncSlider(...(y0 === yr && y1 === yr ? [2025, 2050] : [yr, yr]));
        }
    });

    window.addEventListener('resize', () => annualChart?.resize());
}

function renderAnnualChart(state) {
    if (!annualChart || !state.dashboardData) return;

    const ts = state.dashboardData.timeseries;
    const [y0, y1] = state.yearRange;

    const years = ts.map(t => t.year);
    const pvData = ts.map(t => t.pv_mw);
    const windData = ts.map(t => t.wind_mw);

    // Highlight selected range
    const markAreaData = (y0 !== 2025 || y1 !== 2050)
        ? [[{ xAxis: String(y0 - 0.5) }, { xAxis: String(y1 + 0.5) }]]
        : [];

    annualChart.setOption({
        title: {
            text: 'Annual Deployment',
            textStyle: TITLE_STYLE, left: 8, top: 4,
        },
        tooltip: {
            ...TOOLTIP,
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const yr = params[0].axisValue;
                const pv = params[0]?.value || 0;
                const w  = params[1]?.value || 0;
                return `<strong>${yr}</strong><br>` +
                    `${params[0].marker} PV: ${pv.toFixed(2)} MW<br>` +
                    `${params[1].marker} Wind: ${w.toFixed(2)} MW<br>` +
                    `Total: <strong>${(pv + w).toFixed(2)} MW</strong>`;
            },
        },
        legend: { ...LEGEND_STYLE, data: ['PV', 'Wind'], right: 8, top: 4 },
        grid: { left: 42, right: 10, top: 34, bottom: 24 },
        xAxis: {
            type: 'category', data: years.map(String),
            axisLabel: { fontSize: 8, interval: 4 },
            axisTick: { alignWithLabel: true },
        },
        yAxis: {
            type: 'value', name: 'MW',
            nameTextStyle: { fontSize: 8 },
            axisLabel: { fontSize: 8 },
            splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        },
        series: [
            {
                name: 'PV', type: 'bar', stack: 'total',
                data: pvData,
                itemStyle: { color: CLR.pv },
                barMaxWidth: 16,
                markArea: {
                    silent: true,
                    itemStyle: { color: CLR.highlight },
                    data: markAreaData,
                },
            },
            {
                name: 'Wind', type: 'bar', stack: 'total',
                data: windData,
                itemStyle: { color: CLR.wind },
                barMaxWidth: 16,
            },
        ],
    }, true);
}


// ═════════════════════════════════════════════════════════════════════════
// 2. Cumulative Deployment Area Chart
// ═════════════════════════════════════════════════════════════════════════
function initCumulativeChart() {
    const dom = document.getElementById('chart-cumulative');
    if (!dom) return;
    cumulativeChart = echarts.init(dom);

    // Click on a point → set year range up to that year (cumulative to that point)
    cumulativeChart.on('click', (params) => {
        if (params.componentType === 'series') {
            const yr = Number(params.name);
            DashboardState.set({ yearRange: [2025, yr] });
            syncSlider(2025, yr);
        }
    });

    window.addEventListener('resize', () => cumulativeChart?.resize());
}

function renderCumulativeChart(state) {
    if (!cumulativeChart || !state.dashboardData) return;

    const ts = state.dashboardData.timeseries;
    const [y0, y1] = state.yearRange;

    const years = ts.map(t => t.year);
    const pvCumul = ts.map(t => t.cumulative_pv_mw);
    const windCumul = ts.map(t => t.cumulative_wind_mw);

    const markAreaData = (y0 !== 2025 || y1 !== 2050)
        ? [[{ xAxis: y0 }, { xAxis: y1 }]]
        : [];

    // Mark line at current slider end position
    const markLineData = (y1 !== 2050)
        ? [{ xAxis: y1, label: { show: true, formatter: `${y1}`, fontSize: 9, position: 'end' }, lineStyle: { color: CLR.primary, type: 'solid', width: 1.5 } }]
        : [];

    cumulativeChart.setOption({
        title: {
            text: 'Cumulative Capacity',
            textStyle: TITLE_STYLE, left: 8, top: 4,
        },
        tooltip: {
            ...TOOLTIP,
            trigger: 'axis',
            formatter: (params) => {
                const yr = params[0].axisValue;
                let total = 0;
                let html = `<strong>${yr}</strong><br>`;
                params.forEach(p => {
                    html += `${p.marker} ${p.seriesName}: ${p.value.toFixed(1)} MW<br>`;
                    total += p.value;
                });
                html += `Total: <strong>${total.toFixed(1)} MW</strong>`;
                return html;
            },
        },
        legend: { ...LEGEND_STYLE, data: ['PV', 'Wind'], right: 8, top: 4 },
        grid: { left: 42, right: 10, top: 34, bottom: 24 },
        xAxis: {
            type: 'category', data: years,
            axisLabel: { fontSize: 8, interval: 4 },
            axisTick: { alignWithLabel: true },
        },
        yAxis: {
            type: 'value', name: 'MW',
            nameTextStyle: { fontSize: 8 },
            axisLabel: { fontSize: 8 },
            splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        },
        series: [
            {
                name: 'PV', type: 'line', stack: 'total',
                areaStyle: { opacity: 0.35 },
                lineStyle: { width: 1.5 }, symbol: 'none',
                data: pvCumul,
                itemStyle: { color: CLR.pv },
                markArea: {
                    silent: true,
                    itemStyle: { color: CLR.highlight },
                    data: markAreaData,
                },
                markLine: {
                    silent: true,
                    data: markLineData,
                    symbol: 'none',
                },
            },
            {
                name: 'Wind', type: 'line', stack: 'total',
                areaStyle: { opacity: 0.35 },
                lineStyle: { width: 1.5 }, symbol: 'none',
                data: windCumul,
                itemStyle: { color: CLR.wind },
            },
        ],
    }, true);
}


// ═════════════════════════════════════════════════════════════════════════
// 3. Technology & Connection Mix — nested donut
//    Inner ring: PV vs Wind  |  Outer ring: Primary vs BSP
// ═════════════════════════════════════════════════════════════════════════
function initTechMixChart() {
    const dom = document.getElementById('chart-tech-mix');
    if (!dom) return;
    techMixChart = echarts.init(dom);

    // Click a slice → toggle technology or connection filter
    techMixChart.on('click', (params) => {
        if (params.seriesName === 'Technology') {
            const tech = params.name;  // 'PV' or 'Wind'
            DashboardState.set({
                technology: DashboardState.technology === tech ? 'all' : tech,
            });
        } else if (params.seriesName === 'Connection') {
            const level = params.name === '33kV Primary' ? 'primary' : 'bsp';
            DashboardState.set({
                connectionLevel: DashboardState.connectionLevel === level ? 'all' : level,
            });
        }
    });

    window.addEventListener('resize', () => techMixChart?.resize());
}

function renderTechMixChart(state) {
    if (!techMixChart || !state.dashboardData) return;

    const filtered = getFilteredAllocations(state);

    // Technology split
    let pvMW = 0, windMW = 0;
    let primaryMW = 0, bspMW = 0;
    filtered.forEach(a => {
        const mw = a.estimated_capacity_mw || 0;
        if (a.technology === 'PV') pvMW += mw; else windMW += mw;
        if (a.connection_level === 'primary') primaryMW += mw; else bspMW += mw;
    });

    const totalMW = pvMW + windMW;

    techMixChart.setOption({
        title: {
            text: 'Technology & Connection',
            textStyle: TITLE_STYLE, left: 8, top: 4,
        },
        tooltip: {
            ...TOOLTIP,
            formatter: (params) => {
                const pct = totalMW > 0 ? (params.value / totalMW * 100).toFixed(1) : 0;
                return `${params.marker} ${params.name}<br><strong>${params.value.toFixed(1)} MW</strong> (${pct}%)`;
            },
        },
        legend: {
            ...LEGEND_STYLE,
            data: ['PV', 'Wind', '33kV Primary', '132kV BSP'],
            bottom: 2, left: 'center',
            orient: 'horizontal',
        },
        series: [
            {
                name: 'Technology',
                type: 'pie',
                radius: ['0%', '45%'],
                center: ['50%', '46%'],
                label: {
                    show: true, position: 'inside', fontSize: 10, fontWeight: 600,
                    formatter: (p) => p.percent > 3 ? `${p.name}\n${p.percent.toFixed(0)}%` : '',
                    color: '#fff',
                },
                data: [
                    { value: +pvMW.toFixed(2),   name: 'PV',   itemStyle: { color: CLR.pv } },
                    { value: +windMW.toFixed(2),  name: 'Wind', itemStyle: { color: CLR.wind } },
                ].filter(d => d.value > 0),
                emphasis: { scaleSize: 4 },
            },
            {
                name: 'Connection',
                type: 'pie',
                radius: ['55%', '72%'],
                center: ['50%', '46%'],
                label: {
                    show: true, fontSize: 9,
                    formatter: (p) => p.percent > 5 ? `${p.name} ${p.percent.toFixed(0)}%` : '',
                },
                data: [
                    { value: +primaryMW.toFixed(2), name: '33kV Primary', itemStyle: { color: CLR.primary } },
                    { value: +bspMW.toFixed(2),     name: '132kV BSP',    itemStyle: { color: '#3498db' } },
                ].filter(d => d.value > 0),
                emphasis: { scaleSize: 3 },
            },
        ],
    }, true);
}


// ═════════════════════════════════════════════════════════════════════════
// 4. Substation Utilisation Horizontal Bar Chart
// ═════════════════════════════════════════════════════════════════════════
function initSubstationChart() {
    const dom = document.getElementById('chart-substation');
    if (!dom) return;
    substationChart = echarts.init(dom);

    // Click a bar → select that substation
    substationChart.on('click', (params) => {
        if (params.componentType === 'series') {
            const subId = params.name;
            const current = DashboardState.selectedSubstation;
            DashboardState.set({
                selectedSubstation: current === subId ? null : subId,
            });
        }
    });

    window.addEventListener('resize', () => substationChart?.resize());
}

function renderSubstationChart(state) {
    if (!substationChart || !state.dashboardData) return;

    // Aggregate from filtered allocations
    const filtered = getFilteredAllocations(state);
    const subMap = {};
    filtered.forEach(a => {
        const sid = a.connection_substation_id;
        if (!subMap[sid]) subMap[sid] = { id: sid, allocated_mw: 0, headroom_mw: 0 };
        subMap[sid].allocated_mw += a.estimated_capacity_mw || 0;
        subMap[sid].headroom_mw = a.connection_headroom_mw || 0;
    });

    // Include substations with headroom but no filtered allocations
    if (!state.selectedSubstation) {
        state.dashboardData.substations.forEach(s => {
            if (!subMap[s.id] && s.headroom_mw > 0) {
                subMap[s.id] = { id: s.id, allocated_mw: 0, headroom_mw: s.headroom_mw };
            }
        });
    }

    // Sort by utilisation descending, take top 12
    const subs = Object.values(subMap)
        .filter(s => s.headroom_mw > 0)
        .map(s => ({ ...s, util: s.headroom_mw > 0 ? s.allocated_mw / s.headroom_mw * 100 : 0 }))
        .sort((a, b) => b.util - a.util)
        .slice(0, 12);

    const names = subs.map(s => s.id).reverse();
    const allocated = subs.map(s => s.allocated_mw).reverse();
    const remaining = subs.map(s => Math.max(0, s.headroom_mw - s.allocated_mw)).reverse();

    substationChart.setOption({
        title: {
            text: 'Substation Utilisation',
            textStyle: TITLE_STYLE, left: 8, top: 4,
        },
        tooltip: {
            ...TOOLTIP,
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params) => {
                const name = params[0].axisValue;
                const alloc = params[0]?.value || 0;
                const rem = params[1]?.value || 0;
                const total = alloc + rem;
                const pct = total > 0 ? (alloc / total * 100).toFixed(1) : 0;
                return `<strong>${name}</strong><br>` +
                    `Allocated: ${alloc.toFixed(2)} MW<br>` +
                    `Remaining: ${rem.toFixed(2)} MW<br>` +
                    `Utilisation: <strong>${pct}%</strong>`;
            },
        },
        legend: { ...LEGEND_STYLE, data: ['Allocated', 'Remaining'], right: 8, top: 4 },
        grid: { left: 90, right: 10, top: 34, bottom: 12 },
        xAxis: {
            type: 'value', name: 'MW',
            nameTextStyle: { fontSize: 8 },
            axisLabel: { fontSize: 8 },
            splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
        },
        yAxis: {
            type: 'category', data: names,
            axisLabel: {
                fontSize: 8,
                formatter: (v) => v.length > 12 ? v.slice(0, 11) + '\u2026' : v,
            },
        },
        series: [
            {
                name: 'Allocated', type: 'bar', stack: 'total',
                data: allocated,
                itemStyle: { color: CLR.allocated },
                barMaxWidth: 12,
            },
            {
                name: 'Remaining', type: 'bar', stack: 'total',
                data: remaining,
                itemStyle: { color: CLR.remaining },
                barMaxWidth: 12,
            },
        ],
    }, true);

    // Highlight selected substation
    if (state.selectedSubstation) {
        const idx = names.indexOf(state.selectedSubstation);
        if (idx >= 0) {
            substationChart.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx });
        }
    }
}


// ═════════════════════════════════════════════════════════════════════════
// Register all chart renderers
// ═════════════════════════════════════════════════════════════════════════
DashboardState.onChange(renderAnnualChart);
DashboardState.onChange(renderCumulativeChart);
DashboardState.onChange(renderTechMixChart);
DashboardState.onChange(renderSubstationChart);
