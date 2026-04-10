import geopandas as gpd
import pandas as pd
import os

data_dir = "data"
files = [
    "primary_substation.gpkg",
    "bsp_substations.gpkg",
    "gsp_with_headroom.gpkg",
    "8.3_solar_potential.gpkg",
    "8.4_wind_potential.gpkg"
]

for f in files:
    path = os.path.join(data_dir, f)
    if os.path.exists(path):
        try:
            gdf = gpd.read_file(path, rows=5)
            print(f"File: {f}")
            print(f"Columns: {list(gdf.columns)}")
            if "Combined Score" in gdf.columns:
                print(f"Sample Combined Score: {gdf['Combined Score'].tolist()}")
            if "Overall Suitability" in gdf.columns:
                print(f"Sample Suitability: {gdf['Overall Suitability'].tolist()}")
            print("-" * 20)
        except Exception as e:
            print(f"Error reading {f}: {e}")
