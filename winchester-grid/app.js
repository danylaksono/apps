/* ═══════════════════════════════════════════════════════════════════════════
   app.js — Map initialisation, layers, filter integration
   ═══════════════════════════════════════════════════════════════════════════ */

const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'osm': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap contributors',
            },
        },
        layers: [{
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            minzoom: 0,
            maxzoom: 19,
        }],
    },
    center: [-1.3, 51.07],
    zoom: 10,
});


// ── Colour expressions ──────────────────────────────────────────────────
const COLOUR_EXPRS = {
    technology: [
        'match', ['get', 'preferred_technology'],
        'PV', '#F8B648',
        'Wind', '#065D92',
        '#d1d5db',  // fallback grey
    ],
    suitability: [
        'match', ['get', 'suitability'],
        'TRUE', '#008001',
        'MAYBE', '#F8B648',
        'FALSE', '#e74c3c',
        '#888888',
    ],
    status: [
        'match', ['get', 'allocation_status'],
        'Allocated', '#008001',
        'Not allocated', '#9ca3af',
        '#d1d5db',
    ],
};


// ── Build map filter expression from DashboardState ─────────────────────
function buildParcelFilter(state) {
    const conditions = ['all'];

    // Allocation status filter
    if (!state.showUnallocated) {
        conditions.push(['==', ['get', 'allocation_status'], 'Allocated']);
    }

    // Technology filter
    if (state.technology !== 'all') {
        conditions.push(['==', ['get', 'preferred_technology'], state.technology]);
    }

    // Connection level filter
    if (state.connectionLevel !== 'all') {
        conditions.push(['==', ['get', 'connection_level'], state.connectionLevel]);
    }

    // Year filter (only for allocated parcels with a deployment year)
    conditions.push([
        'any',
        ['!', ['has', 'deployment_year_calendar']],
        ['==', ['get', 'deployment_year_calendar'], null],
        ['all',
            ['>=', ['get', 'deployment_year_calendar'], state.yearRange[0]],
            ['<=', ['get', 'deployment_year_calendar'], state.yearRange[1]],
        ],
    ]);

    // Selected substation
    if (state.selectedSubstation) {
        conditions.push(['==', ['get', 'connection_substation_id'], state.selectedSubstation]);
    }

    return conditions;
}

function buildConnectionFilter(state) {
    const conditions = ['all'];

    if (state.technology !== 'all') {
        conditions.push(['==', ['get', 'technology'], state.technology]);
    }
    if (state.connectionLevel !== 'all') {
        conditions.push(['==', ['get', 'connection_level'], state.connectionLevel]);
    }
    conditions.push(['>=', ['get', 'year'], state.yearRange[0]]);
    conditions.push(['<=', ['get', 'year'], state.yearRange[1]]);

    if (state.selectedSubstation) {
        conditions.push(['==', ['get', 'substation'], state.selectedSubstation]);
    }

    return conditions;
}


// ── Map load ────────────────────────────────────────────────────────────
map.on('load', async () => {
    try {
        // Fetch data in parallel
        const [parcelsRes, substationsRes, dashDataRes] = await Promise.all([
            fetch('data/parcels.geojson'),
            fetch('data/substations.geojson'),
            fetch('data/dashboard_data.json'),
        ]);

        const parcels = await parcelsRes.json();
        const substations = await substationsRes.json();
        const dashboardData = await dashDataRes.json();

        // Store in global state
        DashboardState.parcelsGeoJSON = parcels;
        DashboardState.substationsGeoJSON = substations;
        DashboardState.dashboardData = dashboardData;

        // ── Build connection lines ──────────────────────────────────
        const substationLookup = {};
        substations.features.forEach(f => {
            const coords = f.geometry.type === 'Point'
                ? f.geometry.coordinates
                : turf.centroid(f).geometry.coordinates;
            substationLookup[f.properties.name] = coords;
        });

        const parcelLookup = {};
        parcels.features.forEach(f => {
            parcelLookup[f.properties.id] = f;
        });

        const lineFeatures = [];
        dashboardData.allocations.forEach(alloc => {
            const parcel = parcelLookup[alloc.parcel_id];
            const subCoords = substationLookup[alloc.connection_substation_id];
            if (!parcel || !subCoords || !alloc.deployment_year) return;

            const centroid = turf.centroid(parcel).geometry.coordinates;
            lineFeatures.push({
                type: 'Feature',
                geometry: { type: 'LineString', coordinates: [centroid, subCoords] },
                properties: {
                    parcel_id: alloc.parcel_id,
                    substation: alloc.connection_substation_id,
                    technology: alloc.technology,
                    connection_level: alloc.connection_level,
                    year: alloc.deployment_year,
                    capacity_mw: alloc.estimated_capacity_mw,
                },
            });
        });

        const connectionsFC = { type: 'FeatureCollection', features: lineFeatures };

        // ── Build substation centroid points for circle markers ────
        const substationPoints = {
            type: 'FeatureCollection',
            features: substations.features.map(f => ({
                type: 'Feature',
                geometry: f.geometry.type === 'Point'
                    ? f.geometry
                    : turf.centroid(f).geometry,
                properties: f.properties,
            })),
        };

        // ── Add sources ─────────────────────────────────────────────
        map.addSource('parcels', { type: 'geojson', data: parcels });
        map.addSource('substations', { type: 'geojson', data: substations });
        map.addSource('substation-points', { type: 'geojson', data: substationPoints });
        map.addSource('connections', { type: 'geojson', data: connectionsFC });

        // ── Parcel fill layer ───────────────────────────────────────
        map.addLayer({
            id: 'parcels-fill',
            type: 'fill',
            source: 'parcels',
            paint: {
                'fill-color': COLOUR_EXPRS.technology,
                'fill-opacity': 0.65,
            },
        });

        // Parcel outline
        map.addLayer({
            id: 'parcels-outline',
            type: 'line',
            source: 'parcels',
            paint: {
                'line-color': '#374151',
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.2, 14, 1],
                'line-opacity': 0.3,
            },
        });

        // ── Connection lines ────────────────────────────────────────
        map.addLayer({
            id: 'connections',
            type: 'line',
            source: 'connections',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: {
                'line-color': [
                    'match', ['get', 'technology'],
                    'PV', '#F8B648',
                    'Wind', '#065D92',
                    '#2ecc71',
                ],
                'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 4],
                'line-opacity': 0.6,
            },
        });

        // ── Substations ─────────────────────────────────────────────
        // Substation supply area fills (polygons only, semi-transparent)
        map.addLayer({
            id: 'substations-area',
            type: 'fill',
            source: 'substations',
            filter: ['!=', ['geometry-type'], 'Point'],
            paint: {
                'fill-color': [
                    'match', ['get', 'type'],
                    'primary', '#e74c3c',
                    'bsp', '#065D92',
                    'gsp', '#9b59b6',
                    '#7f8c8d',
                ],
                'fill-opacity': 0.05,
            },
        });

        // Substation centroid circles (use point source for circle layer)
        map.addLayer({
            id: 'substations-circle',
            type: 'circle',
            source: 'substation-points',
            paint: {
                'circle-radius': [
                    'interpolate', ['linear'],
                    ['coalesce', ['get', 'headroom_mw'], 0],
                    0, 4,
                    10, 6,
                    50, 10,
                    200, 16,
                ],
                'circle-color': [
                    'interpolate', ['linear'],
                    ['coalesce', ['get', 'utilisation_pct'], 0],
                    0, '#9ca3af',
                    30, '#F8B648',
                    70, '#008001',
                    100, '#7D2248',
                ],
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ffffff',
                'circle-opacity': 0.85,
            },
        });

        // ── Fit bounds ──────────────────────────────────────────────
        const bbox = turf.bbox(parcels);
        map.fitBounds(bbox, { padding: 40 });

        // ── Popup ───────────────────────────────────────────────────
        const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false });

        // Parcel click
        map.on('click', 'parcels-fill', (e) => {
            const p = e.features[0].properties;
            const cap = p.estimated_capacity_mw != null ? Number(p.estimated_capacity_mw).toFixed(3) : 'N/A';
            const pvP = p.pv_generation_potential_mw != null ? Number(p.pv_generation_potential_mw).toFixed(3) : '0';
            const wP = p.wind_generation_potential_mw != null ? Number(p.wind_generation_potential_mw).toFixed(3) : '0';
            const yr = p.deployment_year_calendar || 'N/A';

            popup.setLngLat(e.lngLat).setHTML(`
                <h4>Parcel ${p.id}</h4>
                <table>
                    <tr><td>Status</td><td><strong>${p.allocation_status}</strong></td></tr>
                    <tr><td>Technology</td><td>${p.preferred_technology || 'N/A'}</td></tr>
                    <tr><td>Connection</td><td>${(p.connection_level || '').toUpperCase()} &rarr; ${p.connection_substation_id || 'N/A'}</td></tr>
                    <tr><td>Deploy Year</td><td>${yr}</td></tr>
                    <tr><td>Capacity</td><td>${cap} MW</td></tr>
                    <tr><td>PV Potential</td><td>${pvP} MW</td></tr>
                    <tr><td>Wind Potential</td><td>${wP} MW</td></tr>
                    <tr><td>Suitability</td><td>${p.suitability}</td></tr>
                </table>
            `).addTo(map);
        });

        // Substation hover tooltip (lightweight)
        const hoverPopup = new maplibregl.Popup({
            closeButton: false,
            closeOnClick: false,
            offset: 14,
            className: 'sub-hover-popup',
        });

        map.on('mouseenter', 'substations-circle', (e) => {
            map.getCanvas().style.cursor = 'pointer';
            const p = e.features[0].properties;
            const headroom = p.headroom_mw != null ? Number(p.headroom_mw).toFixed(1) : '?';
            const util = p.utilisation_pct != null ? Number(p.utilisation_pct).toFixed(0) : '0';
            const allocated = p.allocated_mw != null ? Number(p.allocated_mw).toFixed(1) : '0';
            const typeLabel = p.type === 'primary' ? 'Primary (33kV)' : p.type === 'bsp' ? 'BSP (132kV)' : 'GSP';

            hoverPopup.setLngLat(e.lngLat).setHTML(`
                <strong>${p.name}</strong> &middot; ${typeLabel}<br>
                Headroom: <strong>${headroom} MW</strong><br>
                Allocated: ${allocated} MW (${util}% used)
            `).addTo(map);
        });

        map.on('mousemove', 'substations-circle', (e) => {
            hoverPopup.setLngLat(e.lngLat);
        });

        map.on('mouseleave', 'substations-circle', () => {
            map.getCanvas().style.cursor = '';
            hoverPopup.remove();
        });

        // Substation click → detail panel + filter
        map.on('click', 'substations-circle', (e) => {
            hoverPopup.remove(); // dismiss hover tooltip
            const p = e.features[0].properties;
            const panel = document.getElementById('detail-panel');
            const content = document.getElementById('detail-content');

            const headroom = p.headroom_mw != null ? Number(p.headroom_mw).toFixed(1) : 'N/A';
            const firmCap = p.firm_capacity_mw != null ? Number(p.firm_capacity_mw).toFixed(1) : 'N/A';
            const headroomPct = p.headroom_pct != null ? Number(p.headroom_pct).toFixed(1) + '%' : 'N/A';
            const allocated = p.allocated_mw != null ? Number(p.allocated_mw).toFixed(2) : '0';
            const parcels = p.allocated_parcels || 0;
            const util = p.utilisation_pct != null ? Number(p.utilisation_pct).toFixed(1) + '%' : '0%';
            const typeLabel = p.type === 'primary' ? 'Primary (33kV)' : p.type === 'bsp' ? 'BSP (132kV)' : 'GSP';

            // Explanatory text based on utilisation
            const utilNum = Number(p.utilisation_pct) || 0;
            let explanation = '';
            if (utilNum === 0) {
                explanation = 'No capacity has been allocated here. Either there are no suitable parcels in this supply area, or the substation has no available headroom.';
            } else if (utilNum < 30) {
                explanation = `Only ${util} of this substation's headroom is used. There are likely not enough suitable parcels nearby to fill the remaining capacity.`;
            } else if (utilNum < 70) {
                explanation = `${util} of this substation's headroom has been allocated to ${parcels} sites. Some capacity remains available.`;
            } else {
                explanation = `This substation is well utilised at ${util}. Most of the available headroom has been matched to suitable nearby parcels.`;
            }

            content.innerHTML = `
                <h4>${p.name}</h4>
                <div class="detail-type-badge">${typeLabel}</div>
                <table>
                    <tr><td>Firm Capacity</td><td>${firmCap} MW</td></tr>
                    <tr><td>Gen. Headroom</td><td>${headroom} MW (${headroomPct} of firm)</td></tr>
                    <tr><td>Allocated</td><td><strong>${allocated} MW</strong></td></tr>
                    <tr><td>Sites Connected</td><td>${parcels}</td></tr>
                    <tr><td>Utilisation</td><td><strong>${util}</strong></td></tr>
                </table>
                <p class="detail-explanation">${explanation}</p>
                <p class="detail-hint">Click again to deselect. While selected, the sidebar and charts show only this substation's data.</p>
            `;
            panel.classList.remove('hidden');

            // Toggle substation selection
            const current = DashboardState.selectedSubstation;
            DashboardState.set({
                selectedSubstation: current === p.name ? null : p.name,
            });
        });

        // Cursor changes for parcels and connections
        ['parcels-fill', 'connections'].forEach(layer => {
            map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
            map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
        });

        // ── State-driven map updates ────────────────────────────────
        DashboardState.onChange((state) => {
            // Parcel fill colour
            map.setPaintProperty('parcels-fill', 'fill-color',
                COLOUR_EXPRS[state.colourMode] || COLOUR_EXPRS.technology
            );

            // Parcel filter
            const pFilter = buildParcelFilter(state);
            map.setFilter('parcels-fill', pFilter);
            map.setFilter('parcels-outline', pFilter);

            // Connection visibility + filter
            const connVis = state.showConnections ? 'visible' : 'none';
            map.setLayoutProperty('connections', 'visibility', connVis);
            if (state.showConnections) {
                map.setFilter('connections', buildConnectionFilter(state));
            }
        });

        // ── Initialise dashboard ────────────────────────────────────
        initControls();
        initAnnualChart();
        initCumulativeChart();
        initTechMixChart();
        initSubstationChart();

        // Trigger initial render
        DashboardState.notify();

        console.log('Dashboard loaded:', {
            parcels: parcels.features.length,
            substations: substations.features.length,
            allocations: dashboardData.allocations.length,
        });

    } catch (err) {
        console.error('Error loading dashboard:', err);
        document.getElementById('narrative-text').textContent =
            'Error loading data. Check the console and ensure data files exist in data/.';
    }
});
