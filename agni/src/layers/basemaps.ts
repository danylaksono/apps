/** Basemaps. All are registered in the one base style; switching = toggling
 *  layer visibility (no map.setStyle churn).
 *
 *  Two kinds live here. Raster basemaps are a tile URL and nothing else.
 *  Vector basemaps are a whole MapLibre style JSON that has to be spliced into
 *  ours — see vectorBasemap.ts for how, and why it is worth the trouble.
 *
 *  CARTO's Dark Matter and Voyager rasters used to fill the dark and light
 *  slots. CARTO now requires an API key for basemap tiles, so both were
 *  replaced by OpenFreeMap, which serves the same OpenMapTiles schema with no
 *  key, no signup and no rate limit — but as vector tiles only. */

interface BasemapCommon {
  id: string;
  label: string;
  attribution: string;
}

export interface RasterBasemapDef extends BasemapCommon {
  kind: "raster";
  tiles: string[];
  maxzoom?: number;
}

export interface VectorBasemapDef extends BasemapCommon {
  kind: "vector";
  /** MapLibre style JSON, fetched on first use rather than at startup. */
  styleUrl: string;
}

export type BasemapDef = RasterBasemapDef | VectorBasemapDef;

/** OpenFreeMap serves every one of its styles off the same font and sprite
 *  endpoints, so the base style can declare them up front and any style we
 *  splice in later renders its labels and icons without a second thought. */
export const OFM_GLYPHS =
  "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const OFM_SPRITE = "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";
export const OFM_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> © OpenStreetMap contributors';

export const BASEMAPS: BasemapDef[] = [
  {
    id: "dark",
    label: "Dark",
    kind: "vector",
    styleUrl: "https://tiles.openfreemap.org/styles/dark",
    attribution: OFM_ATTRIBUTION,
  },
  {
    id: "satellite",
    label: "Satellite",
    kind: "raster",
    tiles: [
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    ],
    attribution: "Esri, Maxar, Earthstar Geographics",
  },
  {
    id: "osm",
    label: "OSM",
    kind: "raster",
    tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
    attribution: "© OpenStreetMap contributors",
    // OSMF tile policy: z19 is the practical cap and heavy use is discouraged.
    maxzoom: 19,
  },
  {
    id: "light",
    label: "Light",
    kind: "vector",
    // Positron over Liberty/Bright: the muted grey stays out of the way of the
    // fire palette, which the colourful styles fight with.
    styleUrl: "https://tiles.openfreemap.org/styles/positron",
    attribution: OFM_ATTRIBUTION,
  },
];

export const DEFAULT_BASEMAP = "dark";

/** Namespace for everything a basemap owns — the raster source and layer ids,
 *  and the prefix each spliced-in vector layer id carries. Anything under it
 *  is basemap furniture and belongs below the overlays. */
const BASEMAP_PREFIX = "bm-";

export function basemapSourceId(id: string): string {
  return `${BASEMAP_PREFIX}${id}`;
}

export function isBasemapLayer(layerId: string): boolean {
  return layerId === "background" || layerId.startsWith(BASEMAP_PREFIX);
}
