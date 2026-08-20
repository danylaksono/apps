/** Keyless raster basemaps. All are registered as raster layers in the base
 *  style; switching = toggling layer visibility (no map.setStyle churn). */

export interface BasemapDef {
  id: string;
  label: string;
  tiles: string[];
  attribution: string;
  maxzoom?: number;
}

export const BASEMAPS: BasemapDef[] = [
  {
    id: "dark",
    label: "Dark",
    tiles: ["https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors © CARTO",
  },
  {
    id: "satellite",
    label: "Satellite",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "osm",
    label: "OSM",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    // OSMF tile policy: z19 is the practical cap and heavy use is discouraged.
    maxzoom: 19,
  },
  {
    id: "light",
    label: "Light",
    tiles: [
      "https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    ],
    attribution: "© OpenStreetMap contributors © CARTO",
  },
];

export const DEFAULT_BASEMAP = "dark";

export function basemapSourceId(id: string): string {
  return `bm-${id}`;
}
