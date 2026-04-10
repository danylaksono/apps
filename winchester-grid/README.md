# Grid Allocation Visualisation Module

This module visualises the grid allocation results on an interactive map.

## Setup

1.  **Data Preparation**:
    The data has been pre-processed using `scripts/prepare_data.py`. If you need to update the data, run:
    ```bash
    python3 scripts/prepare_data.py
    ```
    This generates `parcels.geojson`, `substations.geojson`, and `allocations.json` in the `data/` directory.

2.  **Running the Visualisation**:
    Due to browser security restrictions (CORS), you cannot open `index.html` directly from the file system. You must serve it via a local web server.

    You can use Python's built-in HTTP server:
    ```bash
    cd visualisation_module
    python3 -m http.server 8000
    ```

    Then open your browser and navigate to:
    [http://localhost:8000](http://localhost:8000)

## Features

- **Parcels**: Solar (Yellow) and Wind (Blue) parcels.
- **Substations**: Red circles.
- **Connections**:
    - **Thick Green Line**: Successful allocation.
    - **Thin Dotted Grey Line**: Potential or failed allocation attempt.
    - **Opacity**: Indicates deployment year (More opaque = sooner).

## Technologies

- MapLibre GL JS
- Turf.js
