"""
Prepare data for the interactive dashboard.

Outputs:
  - data/parcels.geojson       Parcel polygons with allocation metadata
  - data/substations.geojson   Substation points/polygons with headroom stats
  - data/dashboard_data.json   Consolidated allocations + pre-aggregated summaries
"""
import geopandas as gpd
import pandas as pd
import numpy as np
import json
import os

# ---------------------------------------------------------------------------
# Paths — update TRACE_CSV / ALLOC_CSV to the latest run
# ---------------------------------------------------------------------------
DATA_DIR = "data"
OUTPUT_DIR = "visualisation_module/data"
LATEST_RUN = "outputs/20260204_071730"
TRACE_CSV = os.path.join(LATEST_RUN, "deployment_allocations_assignment_trace.csv")
ALLOC_CSV = os.path.join(LATEST_RUN, "deployment_allocations.csv")

os.makedirs(OUTPUT_DIR, exist_ok=True)

# Power factor used in pipeline (MVA -> MW)
PF = 0.95


def _safe(v):
    """Convert numpy/pandas types to JSON-safe Python types. Never returns NaN."""
    if v is None:
        return None
    # Catch all NaN variants (float nan, numpy nan, pandas NA)
    try:
        if pd.isna(v):
            return None
    except (ValueError, TypeError):
        pass  # pd.isna raises for some types like lists
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.bool_,)):
        return bool(v)
    return v


def _truncate_coords(geom_dict, precision=5):
    """Truncate coordinate precision in a __geo_interface__ dict to reduce file size."""
    def _round(coords):
        if isinstance(coords[0], (list, tuple)):
            return [_round(c) for c in coords]
        return [round(c, precision) for c in coords]

    out = dict(geom_dict)
    out['coordinates'] = _round(out['coordinates'])
    return out


# ── 1. Load trace (all parcels) and allocations (deployed only) ───────────
print("Loading trace and allocation CSVs …")
df_trace = pd.read_csv(TRACE_CSV)
df_trace["parcel_id"] = df_trace["parcel_id"].astype(str)

df_alloc = pd.read_csv(ALLOC_CSV)
df_alloc["parcel_id"] = df_alloc["parcel_id"].astype(str)

unique_parcel_ids = set(df_trace["parcel_id"].unique())


# ── 2. Substations GeoJSON (enriched) ────────────────────────────────────
def load_substations(df_trace):
    features = []

    # --- Primary ---
    print("  Primary substations …")
    gdf = gpd.read_file(os.path.join(DATA_DIR, "primary_substation.gpkg")).to_crs(epsg=4326)
    for _, row in gdf.iterrows():
        sid = row["primarysubs"]
        headroom_mva = row.get("Generation Headroom", 0)
        headroom_mw = float(headroom_mva) * PF if headroom_mva and not pd.isna(headroom_mva) else 0.0
        firm_mva = row.get("firmcapacit", None)
        firm_mw = float(firm_mva) * PF if firm_mva and not pd.isna(firm_mva) else None
        headroom_pct = (headroom_mw / firm_mw * 100) if firm_mw and firm_mw > 0 else None

        # Allocation stats for this substation
        sub_allocs = df_trace[
            (df_trace["connection_substation_id"] == sid)
            & (df_trace["allocation_status"] == "Allocated")
        ]
        allocated_mw = sub_allocs["estimated_capacity_mw"].sum() if not sub_allocs.empty else 0.0
        parcel_count = len(sub_allocs)
        utilisation = (allocated_mw / headroom_mw * 100) if headroom_mw > 0 else 0.0

        features.append({
            "type": "Feature",
            "geometry": _truncate_coords(row.geometry.__geo_interface__),
            "properties": {
                "id": sid, "name": sid, "type": "primary",
                "headroom_mw": round(headroom_mw, 2),
                "firm_capacity_mw": round(firm_mw, 2) if firm_mw else None,
                "headroom_pct": round(headroom_pct, 1) if headroom_pct else None,
                "allocated_mw": round(allocated_mw, 3),
                "allocated_parcels": parcel_count,
                "utilisation_pct": round(utilisation, 1),
            },
        })

    # --- BSP ---
    print("  BSP substations …")
    gdf = gpd.read_file(os.path.join(DATA_DIR, "bsp_substations.gpkg")).to_crs(epsg=4326)
    for _, row in gdf.iterrows():
        sid = row["Substation Name"]
        headroom_mva = row.get("Generation Headroom", 0)
        headroom_mw = float(headroom_mva) * PF if headroom_mva and not pd.isna(headroom_mva) else 0.0
        firm_mva = row.get("Firm Capacity", None) or row.get("Firm Capacity [Winter]", None)
        firm_mw = float(firm_mva) * PF if firm_mva and not pd.isna(firm_mva) else None
        headroom_pct = (headroom_mw / firm_mw * 100) if firm_mw and firm_mw > 0 else None

        sub_allocs = df_trace[
            (df_trace["connection_substation_id"] == sid)
            & (df_trace["allocation_status"] == "Allocated")
        ]
        allocated_mw = sub_allocs["estimated_capacity_mw"].sum() if not sub_allocs.empty else 0.0
        parcel_count = len(sub_allocs)
        utilisation = (allocated_mw / headroom_mw * 100) if headroom_mw > 0 else 0.0

        features.append({
            "type": "Feature",
            "geometry": _truncate_coords(row.geometry.__geo_interface__),
            "properties": {
                "id": sid, "name": sid, "type": "bsp",
                "headroom_mw": round(headroom_mw, 2),
                "firm_capacity_mw": round(firm_mw, 2) if firm_mw else None,
                "headroom_pct": round(headroom_pct, 1) if headroom_pct else None,
                "allocated_mw": round(allocated_mw, 3),
                "allocated_parcels": parcel_count,
                "utilisation_pct": round(utilisation, 1),
            },
        })

    # --- GSP ---
    print("  GSP substations …")
    gdf = gpd.read_file(os.path.join(DATA_DIR, "gsp_with_headroom.gpkg")).to_crs(epsg=4326)
    for _, row in gdf.iterrows():
        sid = row["Substation Name"]
        headroom_mva = row.get("Demand Headroom [Actual]", 0)
        headroom_mw = float(headroom_mva) * PF if headroom_mva and not pd.isna(headroom_mva) else 0.0

        features.append({
            "type": "Feature",
            "geometry": _truncate_coords(row.geometry.__geo_interface__),
            "properties": {
                "id": sid, "name": sid, "type": "gsp",
                "headroom_mw": round(headroom_mw, 2),
                "firm_capacity_mw": None,
                "headroom_pct": None,
                "allocated_mw": 0.0,
                "allocated_parcels": 0,
                "utilisation_pct": 0.0,
            },
        })

    return {"type": "FeatureCollection", "features": features}


# ── 3. Parcels GeoJSON (deduplicated, enriched with allocation info) ──────
def load_parcels(parcel_ids, df_trace):
    """
    Load solar and wind parcel GeoPackages, merge into one feature per parcel_id.

    Suitability is resolved per-parcel:
      - If the parcel was allocated, use the suitability from the technology it was
        allocated for (PV → solar GPKG, Wind → wind GPKG).
      - Otherwise, use the "best" suitability across both technologies
        (TRUE > MAYBE > FALSE).
    Geometry comes from the solar GPKG (primary) with wind as fallback.
    """
    trace_lookup = df_trace.set_index("parcel_id").to_dict("index")

    # Load both GPKGs and index by parcel ID
    print("  Solar parcels …")
    gdf_solar = gpd.read_file(os.path.join(DATA_DIR, "8.3_solar_potential.gpkg")).to_crs(epsg=4326)
    gdf_solar["_id"] = gdf_solar["ID"].astype(str)
    gdf_solar = gdf_solar[gdf_solar["_id"].isin(parcel_ids)]
    gdf_solar["geometry"] = gdf_solar["geometry"].simplify(tolerance=0.00005, preserve_topology=True)
    solar_lookup = {str(row["ID"]): row for _, row in gdf_solar.iterrows()}

    print("  Wind parcels …")
    gdf_wind = gpd.read_file(os.path.join(DATA_DIR, "8.4_wind_potential.gpkg")).to_crs(epsg=4326)
    gdf_wind["_id"] = gdf_wind["ID"].astype(str)
    gdf_wind = gdf_wind[gdf_wind["_id"].isin(parcel_ids)]
    gdf_wind["geometry"] = gdf_wind["geometry"].simplify(tolerance=0.00005, preserve_topology=True)
    wind_lookup = {str(row["ID"]): row for _, row in gdf_wind.iterrows()}

    # Suitability priority for picking the "best"
    _suit_rank = {"TRUE": 2, "MAYBE": 1, "FALSE": 0}

    features = []
    all_ids = sorted(parcel_ids)

    for pid in all_ids:
        tr = trace_lookup.get(pid, {})
        solar_row = solar_lookup.get(pid)
        wind_row = wind_lookup.get(pid)

        # Pick geometry: prefer solar, fall back to wind
        geom_row = solar_row if solar_row is not None else wind_row
        if geom_row is None:
            continue  # no geometry at all — skip

        # Resolve suitability
        pv_suit = solar_row.get("Overall Suitability", "FALSE") if solar_row is not None else "FALSE"
        wind_suit = wind_row.get("Overall Suitability", "FALSE") if wind_row is not None else "FALSE"
        preferred_tech = _safe(tr.get("preferred_technology"))

        if preferred_tech == "PV":
            suitability = pv_suit
        elif preferred_tech == "Wind":
            suitability = wind_suit
        else:
            # Not allocated — use the better of the two
            suitability = pv_suit if _suit_rank.get(pv_suit, 0) >= _suit_rank.get(wind_suit, 0) else wind_suit

        # Area / generation from whichever technology row is available (prefer solar)
        area_row = solar_row if solar_row is not None else wind_row
        area_km2 = _safe(area_row.get("Parcel Area (km²)")) if area_row is not None else None
        gen_gwh_pv = _safe(solar_row.get("Generation Potential (GWh)")) if solar_row is not None else None
        gen_gwh_wind = _safe(wind_row.get("Generation Potential (GWh)")) if wind_row is not None else None

        features.append({
            "type": "Feature",
            "geometry": _truncate_coords(geom_row.geometry.__geo_interface__),
            "properties": {
                "id": pid,
                "area_km2": area_km2,
                "pv_potential_gwh": gen_gwh_pv,
                "wind_potential_gwh": gen_gwh_wind,
                "pv_suitability": pv_suit,
                "wind_suitability": wind_suit,
                "suitability": suitability,
                # Allocation metadata (all through _safe to avoid NaN)
                "allocation_status": _safe(tr.get("allocation_status")) or "Unknown",
                "preferred_technology": preferred_tech,
                "connection_level": _safe(tr.get("connection_level")),
                "connection_substation_id": _safe(tr.get("connection_substation_id")),
                "estimated_capacity_mw": _safe(tr.get("estimated_capacity_mw")),
                "deployment_year_calendar": _safe(tr.get("deployment_year_calendar")),
                "pv_generation_potential_mw": _safe(tr.get("pv_generation_potential_mw")),
                "wind_generation_potential_mw": _safe(tr.get("wind_generation_potential_mw")),
                "connection_headroom_mw": _safe(tr.get("connection_headroom_mw")),
            },
        })

    return {"type": "FeatureCollection", "features": features}


# ── 4. Dashboard data JSON (allocations + pre-aggregated summaries) ──────
def build_dashboard_data(df_trace, df_alloc):
    allocated = df_trace[df_trace["allocation_status"] == "Allocated"]

    # --- Allocation records (compact) ---
    alloc_records = []
    for _, r in allocated.iterrows():
        alloc_records.append({
            "parcel_id": str(r["parcel_id"]),
            "technology": r.get("preferred_technology"),
            "connection_level": r.get("connection_level"),
            "connection_substation_id": _safe(r.get("connection_substation_id")),
            "deployment_year": int(r["deployment_year_calendar"]) if pd.notna(r.get("deployment_year_calendar")) else None,
            "estimated_capacity_mw": _safe(r.get("estimated_capacity_mw")),
            "pv_potential_mw": _safe(r.get("pv_generation_potential_mw")),
            "wind_potential_mw": _safe(r.get("wind_generation_potential_mw")),
            "connection_headroom_mw": _safe(r.get("connection_headroom_mw")),
        })

    # --- Global summary ---
    total_parcels = len(df_trace)
    total_allocated = len(allocated)
    total_capacity_mw = allocated["estimated_capacity_mw"].sum()
    total_pv_potential = df_trace["pv_generation_potential_mw"].sum()
    total_wind_potential = df_trace["wind_generation_potential_mw"].sum()
    total_potential = total_pv_potential + total_wind_potential

    # Headroom (unique substations only)
    hd = df_trace[["connection_level", "connection_substation_id", "connection_headroom_mw"]].drop_duplicates()
    hd = hd[hd["connection_substation_id"].notna()]
    total_headroom_all = hd["connection_headroom_mw"].fillna(0).sum()
    total_headroom_positive = hd[hd["connection_headroom_mw"] > 0]["connection_headroom_mw"].sum()

    pv_alloc = allocated[allocated["preferred_technology"] == "PV"]["estimated_capacity_mw"].sum()
    wind_alloc = allocated[allocated["preferred_technology"] == "Wind"]["estimated_capacity_mw"].sum()
    pv_count = (allocated["preferred_technology"] == "PV").sum()
    wind_count = (allocated["preferred_technology"] == "Wind").sum()
    primary_count = (allocated["connection_level"] == "primary").sum()
    bsp_count = (allocated["connection_level"] == "bsp").sum()
    upgrade_count = (df_trace["connection_level"] == "upgrade_required").sum()

    # PV and Wind capacity factors for generation estimation
    CF_PV = 0.11
    CF_WIND = 0.19

    summary = {
        "total_parcels": int(total_parcels),
        "total_allocated": int(total_allocated),
        "total_capacity_mw": round(float(total_capacity_mw), 2),
        "total_pv_potential_mw": round(float(total_pv_potential), 2),
        "total_wind_potential_mw": round(float(total_wind_potential), 2),
        "total_potential_mw": round(float(total_potential), 2),
        "total_headroom_mw": round(float(total_headroom_positive), 2),
        "headroom_utilisation_pct": round(float(total_capacity_mw / total_headroom_positive * 100), 1) if total_headroom_positive > 0 else 0,
        "capacity_pct_of_potential": round(float(total_capacity_mw / total_potential * 100), 1) if total_potential > 0 else 0,
        "pv_allocated_mw": round(float(pv_alloc), 2),
        "wind_allocated_mw": round(float(wind_alloc), 2),
        "pv_allocated_count": int(pv_count),
        "wind_allocated_count": int(wind_count),
        "primary_count": int(primary_count),
        "bsp_count": int(bsp_count),
        "upgrade_required_count": int(upgrade_count),
        "year_min": int(allocated["deployment_year_calendar"].min()),
        "year_max": int(allocated["deployment_year_calendar"].max()),
        "cf_pv": CF_PV,
        "cf_wind": CF_WIND,
    }

    # --- Time series (pre-aggregated by year) ---
    ts_records = []
    cumul_mw = 0.0
    cumul_pv = 0.0
    cumul_wind = 0.0
    cumul_parcels = 0
    for year in sorted(allocated["deployment_year_calendar"].dropna().unique()):
        yr = allocated[allocated["deployment_year_calendar"] == year]
        yr_mw = yr["estimated_capacity_mw"].sum()
        yr_pv = yr[yr["preferred_technology"] == "PV"]["estimated_capacity_mw"].sum()
        yr_wind = yr[yr["preferred_technology"] == "Wind"]["estimated_capacity_mw"].sum()
        yr_parcels = len(yr)
        cumul_mw += yr_mw
        cumul_pv += yr_pv
        cumul_wind += yr_wind
        cumul_parcels += yr_parcels
        gen_mwh = yr_pv * 8760 * CF_PV + yr_wind * 8760 * CF_WIND
        cumul_gen = cumul_pv * 8760 * CF_PV + cumul_wind * 8760 * CF_WIND

        ts_records.append({
            "year": int(year),
            "capacity_mw": round(float(yr_mw), 3),
            "pv_mw": round(float(yr_pv), 3),
            "wind_mw": round(float(yr_wind), 3),
            "parcels": int(yr_parcels),
            "cumulative_mw": round(float(cumul_mw), 3),
            "cumulative_pv_mw": round(float(cumul_pv), 3),
            "cumulative_wind_mw": round(float(cumul_wind), 3),
            "cumulative_parcels": int(cumul_parcels),
            "generation_mwh": round(float(gen_mwh), 1),
            "cumulative_generation_mwh": round(float(cumul_gen), 1),
        })

    # --- Substation summary ---
    sub_summary = []
    sub_groups = allocated.groupby("connection_substation_id")
    for sid, grp in sub_groups:
        headroom = grp["connection_headroom_mw"].iloc[0]
        alloc_mw = grp["estimated_capacity_mw"].sum()
        sub_summary.append({
            "id": str(sid),
            "connection_level": grp["connection_level"].iloc[0],
            "headroom_mw": round(float(headroom), 2) if headroom and not pd.isna(headroom) else 0,
            "allocated_mw": round(float(alloc_mw), 3),
            "parcels": len(grp),
            "utilisation_pct": round(float(alloc_mw / headroom * 100), 1) if headroom and headroom > 0 else 0,
            "pv_mw": round(float(grp[grp["preferred_technology"] == "PV"]["estimated_capacity_mw"].sum()), 3),
            "wind_mw": round(float(grp[grp["preferred_technology"] == "Wind"]["estimated_capacity_mw"].sum()), 3),
        })

    return {
        "allocations": alloc_records,
        "summary": summary,
        "timeseries": ts_records,
        "substations": sorted(sub_summary, key=lambda s: s["allocated_mw"], reverse=True),
    }


# ── Main ──────────────────────────────────────────────────────────────────
def main():
    print("=== Preparing dashboard data ===")

    print("\n1/3  Substations …")
    sub_fc = load_substations(df_trace)
    with open(os.path.join(OUTPUT_DIR, "substations.geojson"), "w") as f:
        json.dump(sub_fc, f)
    print(f"     wrote {len(sub_fc['features'])} substations")

    print("\n2/3  Parcels …")
    par_fc = load_parcels(unique_parcel_ids, df_trace)
    with open(os.path.join(OUTPUT_DIR, "parcels.geojson"), "w") as f:
        json.dump(par_fc, f)
    print(f"     wrote {len(par_fc['features'])} parcels")

    print("\n3/3  Dashboard data …")
    dash = build_dashboard_data(df_trace, df_alloc)
    with open(os.path.join(OUTPUT_DIR, "dashboard_data.json"), "w") as f:
        json.dump(dash, f)
    print(f"     wrote {len(dash['allocations'])} allocations, {len(dash['timeseries'])} year records, {len(dash['substations'])} substations")

    print("\n=== Done ===")


if __name__ == "__main__":
    main()
