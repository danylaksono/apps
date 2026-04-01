# Joyplot Map Implementation Plan

This plan outlines the steps to upgrade the current `draft.jsx` from a procedural population generator to an interactive joyplot using real H3 population data for Indonesia.

## Phase 1: Infrastructure & Data Setup
- [ ] **DuckDB Integration**: Add `duckdb-wasm` to the project to handle efficient querying of the `indonesia_population_h3.parquet` file.
- [ ] **H3 Library**: Integrate `h3-js` for converting GeoJSON boundaries into H3 cells and managing spatial lookups.
- [ ] **Data Layer**: Implement a data fetching layer that can:
    - Load the Parquet file into DuckDB.
    - Query population data based on a list of H3 indices.

## Phase 2: Administrative Boundary Service
- [ ] **Enhanced Search**: Improve the city search to use Nominatim/Overpass API more robustly.
- [ ] **Boundary Validation**: Add logic to check the area size of the fetched boundary. If too large (e.g., > 5000 km²), suggest a smaller area or sub-district.
- [ ] **H3 Conversion**: Create a utility to "polyfill" the GeoJSON boundary with H3 resolution 8 cells (matching the data source).

## Phase 3: Joyplot Calculation Engine
- [ ] **Data Alignment**: Update `processJoyplot` to:
    - Map transect lines (latitude slices) to H3 cells.
    - Query the population for these cells from DuckDB.
    - Handle missing data (zeros for areas outside the dataset or unpopulated).
- [ ] **Row-based Aggregation**: Instead of random sampling, aggregate H3 data points that fall within the "latitudinal buffer" of each joyplot slice to create smoother, more accurate ridges.

## Phase 4: UI/UX Refinement
- [ ] **Visual Feedback**: 
    - Add a progress bar or detailed status indicator for "Loading Parquet", "Indexing H3", and "Querying DuckDB".
    - Use DeckGL for the base map rendering if the canvas approach becomes too limited for complex interactivity.
- [ ] **Interactive Controls**:
    - Add a toggle for "Smoothing" (Gaussian blur on the population data).
    - Add a search bar with auto-complete for Indonesian cities.

## Phase 5: Optimization
- [ ] **Caching**: Implement a mechanism to cache DuckDB query results for recently searched cities.
- [ ] **Tiling/Sampling**: If performance is still an issue, implement a strategy to sample H3 cells at lower resolutions when zoomed out or when the boundary is large.

## Technical Stack
- **Frontend**: React, DeckGL (optional transition from pure Canvas)
- **Database**: DuckDB-Wasm
- **Spatial**: h3-js, turf.js
- **Data Source**: H3 Resolution 8 Indonesia Population (Parquet)
