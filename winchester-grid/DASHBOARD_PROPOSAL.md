# Interactive Dashboard Proposal

## Problem with the current state

The existing visualisation module is a single-purpose map viewer:

- **No filtering** - all 1,012 allocated parcels render at once with connection lines, producing visual clutter
- **No temporal control** - the 26-year deployment timeline (2025-2050) is encoded only as line opacity, which is nearly impossible to read
- **No summary metrics** - the user must click individual connection lines to learn anything; there is no overview
- **No charts** - the 14 chart types exist only as static PNGs in the report, disconnected from the map
- **No narrative** - the methodology and the "why" behind the numbers is absent; the three Winchester questions (parcel count vs capacity vs headroom utilisation) cannot be answered by looking at the dashboard
- **No cross-filtering** - selecting a substation does not highlight its parcels; filtering by technology does not update the map or charts

The result: clients receive a cluttered map that raises more questions than it answers, plus a separate PDF of static charts with no way to explore relationships between them.

---

## Proposed dashboard layout

A single-page application with four coordinated panels:

```
+---------------------------------------------------------------+
|  HEADER BAR: Title | Global filters | Time slider (2025-2050) |
+-------------------+-------------------------------------------+
|                   |                                           |
|   SIDEBAR         |              MAP                          |
|   - KPI cards     |   MapLibre GL JS                          |
|   - Narrative     |   - Parcels (fill by tech/suitability)    |
|   - Context text  |   - Substations (sized by headroom)       |
|   (responds to    |   - Connections (filtered by year)         |
|    user actions)  |   - Hover/click details                   |
|                   |                                           |
+-------------------+-------------------------------------------+
|                CHARTS PANEL (collapsible)                      |
|   Chart 1   |   Chart 2   |   Chart 3   |   Chart 4          |
+---------------------------------------------------------------+
```

### Panel 1 - Header bar (global controls)

| Element | Behaviour |
|---------|-----------|
| **Time slider** | Range slider from 2025 to 2050. Controls which deployment years are visible on the map and reflected in all KPIs and charts. Default: full range. Supports single-year and range modes. |
| **Technology filter** | Toggle buttons: All / PV / Wind. Cross-filters map, charts, KPIs, and narrative. |
| **Connection level filter** | Toggle buttons: All / Primary (33kV) / BSP (132kV). |
| **Suitability filter** | Checkboxes: TRUE / MAYBE / FALSE. Controls parcel visibility. |
| **Reset** | Restores all filters to defaults. |

### Panel 2 - Sidebar (KPIs + narrative)

**KPI cards** (update live with every filter/slider change):

| KPI | What it shows | Why it matters |
|-----|---------------|----------------|
| Parcels selected | Count of parcels in current filter | Answers "how many sites?" |
| Capacity allocated (MW) | Sum of estimated_capacity_mw for filtered set | Answers "how much power?" |
| % of total potential | allocated MW / total generation potential MW | Answers the "2.4%" question |
| Headroom utilised (%) | allocated MW / available headroom MW | Answers the "51.6%" question |
| Substations active | Count of unique substations serving filtered parcels | Shows grid spread |
| Est. generation (GWh/yr) | Annual energy from filtered set | Translates MW to energy |

**Narrative panel** (dynamic text that responds to user actions):

This is the key differentiator. A text block below the KPIs that updates automatically:

- **Baseline state** (no filters): Displays the executive summary - "1,012 parcels selected from 1,025 suitable sites, deploying 292 MW (2.4% of 12,213 MW total potential). 51.6% of the 566 MW available grid headroom is utilised."
- **When the user moves the time slider to e.g. 2025-2030**: "By 2030, 195 parcels are deployed with 57 MW cumulative capacity. Headroom utilisation reaches 10.1%. The early deployments prioritise substations with the most available headroom."
- **When the user selects a single substation on the map**: "Substation X serves N parcels with Y MW headroom. Z MW has been allocated (W% utilised). Remaining headroom: Q MW."
- **When the user filters to PV only**: "PV accounts for 276 MW across 918 parcels (94.5% of total allocated capacity)."

This turns the dashboard into a self-explaining tool. Each interaction generates a plain-English summary that a non-technical client can read.

### Panel 3 - Map (central, largest panel)

Improvements over current map:

| Feature | Current | Proposed |
|---------|---------|----------|
| Parcel colour | Suitability only | Toggle between suitability, technology, allocation status, and capacity (graduated) |
| Substation markers | Fixed-size circles | Proportional to headroom MW; fill colour shows utilisation % (green->yellow->red gradient) |
| Connection lines | All visible, opacity by year | Filtered by time slider; colour by technology (PV=amber, Wind=teal); animate on year change |
| Unallocated parcels | Not shown | Shown as grey outlines (opt-in toggle), so clients can see what was excluded and why |
| Hover tooltip | None (click only) | Lightweight tooltip on hover showing parcel ID, technology, capacity; full detail panel on click |
| Substation click | None | Clicking a substation highlights all its connected parcels and updates the narrative panel |
| Brushing | None | Lasso/rectangle select to filter a geographic area; all other panels update accordingly |

### Panel 4 - Charts (bottom, collapsible)

Replace the 14 static PNGs with 4 interactive charts that cross-filter with the map. Use a lightweight charting library (e.g. Apache ECharts, Observable Plot, or Chart.js).

| Chart | Type | Interaction |
|-------|------|-------------|
| **Cumulative deployment** | Area chart (MW over years), stacked by technology | Brushing a year range on this chart updates the time slider and map. A vertical marker follows the current slider position. |
| **Substation utilisation** | Horizontal bar chart showing headroom used vs remaining per substation | Clicking a bar highlights the substation and its parcels on the map. Sorted by utilisation %. |
| **Capacity breakdown** | Stacked bar or treemap showing capacity by connection level and technology | Clicking a segment filters the map to that subset. |
| **Parcel size distribution** | Histogram of parcel capacities (MW bins) | Brushing a range highlights matching parcels on the map. |

All four charts respond to the global filters and time slider. Selecting elements in any chart cross-filters the others and the map.

---

## Coordinated interaction model

The core principle is **brushing and linking**: every panel is both a filter control and a display. User actions in any panel propagate to all others.

```
Time slider -----> filters allocations by year
    |
    +--> KPIs recalculate
    +--> Narrative text updates
    +--> Map shows only parcels deployed up to selected year
    +--> Charts highlight the selected time window
    +--> Cumulative chart shows a "current position" marker

Substation click (map) -----> highlights connected parcels
    |
    +--> KPIs show substation-level stats
    +--> Narrative describes that substation
    +--> Charts highlight that substation's contribution
    +--> Utilisation bar chart highlights the selected bar

Technology filter -----> filters everything to PV or Wind
    |
    +--> All panels update simultaneously
```

---

## Methodology explainer (guided walkthrough)

Add an optional **"How it works"** overlay/stepper that walks the client through the methodology in 5 steps, each tied to a specific map state:

| Step | Map state | Explanation |
|------|-----------|-------------|
| 1. Suitable sites | Show all parcels coloured by suitability, no connections | "We start with 1,025 technically suitable GMPV sites identified by LENZA suitability analysis." |
| 2. Grid infrastructure | Show substations sized by headroom, parcels dimmed | "Each site falls within a substation's supply area. Substations have limited capacity (headroom) for new generation." |
| 3. Matching sites to grid | Show connections appearing, parcels coloured by allocation status | "We match sites to their nearest substation and check if headroom is available. 1,012 sites can connect; 13 require grid upgrades." |
| 4. Capacity allocation | Connections coloured by capacity, KPIs visible | "Each site receives capacity up to the substation's remaining headroom. Total: 292 MW from 566 MW available (51.6% utilised)." |
| 5. Deployment timeline | Time slider animates from 2025 to 2050 | "Sites are scheduled across 26 years. Use the slider to explore the rollout." |

This directly addresses the client's confusion about the three numbers (1,012 parcels, 2.4% capacity, 51.6% headroom).

---

## Technical approach

### Keep: vanilla JS + MapLibre GL JS + Turf.js (CDN-based, no build step)

### Add:
- **Apache ECharts** (CDN) for interactive charts - lightweight, supports bindable brushing and linking, good defaults
- **noUiSlider** (CDN) for the time range slider - lightweight, touch-friendly, range mode
- **CSS Grid** for the dashboard layout - no framework needed

### Data changes:
- Extend `prepare_data.py` to export a single consolidated `dashboard_data.json` containing:
  - allocations (all 4,303 records, not just allocated)
  - substation summaries (headroom, capacity, utilisation pre-computed)
  - global statistics (totals for KPI denominators)
  - time series (pre-aggregated by year for chart performance)
- Keep GeoJSON files for map layers (parcels, substations)

### Performance:
- 8,606 parcels + 45 substations + 1,012 connections is well within MapLibre's capability
- Pre-aggregate chart data server-side to avoid client-side groupby on every filter change
- Use MapLibre's built-in filter expressions for map layer filtering (no re-rendering needed)

---

## File structure (proposed)

```
visualisation_module/
  data/
    parcels.geojson          (existing, extend with allocation status)
    substations.geojson      (existing, extend with utilisation stats)
    dashboard_data.json      (new: consolidated allocations + summaries)
  scripts/
    prepare_data.py          (extend)
  index.html                 (rewrite: dashboard layout)
  style.css                  (rewrite: grid layout, panel styling)
  app.js                     (rewrite: map initialisation, layer management)
  dashboard.js               (new: KPIs, narrative engine, filter state)
  charts.js                  (new: ECharts bindings, cross-filter logic)
  walkthrough.js             (new: guided methodology stepper)
  DASHBOARD_PROPOSAL.md      (this file)
  IMPLEMENTATION_PLAN.md     (existing, to be updated)
```

---

## Implementation priority

| Phase | Scope | Effort |
|-------|-------|--------|
| **Phase 1** | Dashboard layout + time slider + KPI cards + narrative panel | Core structure |
| **Phase 2** | Map improvements (colour modes, substation sizing, hover tooltips, unallocated parcels) | Visual clarity |
| **Phase 3** | Interactive charts (cumulative deployment, substation utilisation) with cross-filtering | Analytical depth |
| **Phase 4** | Guided walkthrough stepper | Client onboarding |
| **Phase 5** | Brushing/linking, geographic selection, remaining charts | Power-user features |
