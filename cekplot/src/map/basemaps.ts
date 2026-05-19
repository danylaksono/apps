import type { BasemapId } from '../types';
import type { StyleSpecification } from 'maplibre-gl';

export interface BasemapDefinition {
  id: BasemapId;
  label: string;
  description: string;
  style: StyleSpecification;
  note?: string;
}

const cartoAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const osmAttribution =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const esriAttribution =
  'Tiles &copy; Esri, Maxar, Earthstar Geographics, and the GIS User Community';

function rasterStyle(
  tiles: string[],
  attribution: string,
  background: string,
): StyleSpecification {
  return {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      basemap: {
        type: 'raster',
        tiles,
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': background },
      },
      {
        id: 'basemap',
        type: 'raster',
        source: 'basemap',
      },
    ],
  };
}

export const BASEMAPS: Record<BasemapId, BasemapDefinition> = {
  light: {
    id: 'light',
    label: 'Light',
    description: 'CARTO Positron for clean planning and labels.',
    style: rasterStyle(
      ['https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', 'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'],
      cartoAttribution,
      '#f4f6f4',
    ),
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    description: 'CARTO Dark Matter for high contrast route review.',
    style: rasterStyle(
      ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', 'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      cartoAttribution,
      '#101418',
    ),
  },
  osm: {
    id: 'osm',
    label: 'OSM',
    description: 'OpenStreetMap standard tiles.',
    style: rasterStyle(['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], osmAttribution, '#eef2ee'),
    note: 'Use politely and follow the OSMF tile usage policy for public deployments.',
  },
  satellite: {
    id: 'satellite',
    label: 'Satellite',
    description: 'Esri World Imagery context.',
    style: rasterStyle(
      ['https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      esriAttribution,
      '#111827',
    ),
    note: 'External imagery availability and terms are controlled by Esri.',
  },
};

export const basemapList = Object.values(BASEMAPS);
