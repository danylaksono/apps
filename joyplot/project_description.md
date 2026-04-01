This project is aimed to be a reusable, interactive joyplot of city population data in Indonesia. The idea is to allow user to choose certain city/sub level administrative boundary in Indonesia (boundary from online open data like overture or OSM overpass), load the data, compute the needed parameters and draw the joyplot over the map. The current draft utilises DeckGL with a mockup calculation to simulate the data.

I have provided the h3 population data from kontur in ./data source. The data is a h3 table of population count in h3 resolution 8 (~400m). Here's my high-level idea of the app workflow to upgrade the app from draft to an actual data visualisation project:
- platform architecture: deckgl h3, turfjs or duckdb if needed
- upon loading the web app, the user is shown a basemap of Indonesia and some menu to select city e.g., via search.
- using overpass api or nominatim or overture data, the boundary of the searched city is loaded (otherwise clearly said that the boundary is not available). also limit the area of the boundary. if it's too large then ask or suggest smaller area.
- using deckgl h3 or h3js, the loaded boundary is converted to h3 table, which further acts as the lookup to load only the relevant data from the table. the table is currently in parquet format, so I think using duckdb is reasonable. this might be the biggest bottleneck in the app since loading all these interactively will take some time, so think of the best strategy and provide enough visual feedback to the user
- the function to calculate the joyplot is evoked based on the loaded data. some smart calculation need to be made to make use of the h3 data as best as possible (e.g., to calculate nearby data or to get the data in the same 'row')
- joy plot is visualised interactively to the user. 

Create a detailed implementation plan for this.