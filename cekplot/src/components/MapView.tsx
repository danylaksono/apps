import 'maplibre-gl/dist/maplibre-gl.css';

import maplibregl, { LngLatBounds, type GeoJSONSource } from 'maplibre-gl';
import { useEffect, useMemo, useRef } from 'react';
import { BASEMAPS, basemapList } from '../map/basemaps';
import { usePlannerStore } from '../store/usePlannerStore';
import type { GeoJsonFeatureCollection, LocationPoint } from '../types';

const MAKASSAR_CENTER: [number, number] = [119.4327, -5.1477];

function emptyFeatureCollection(): GeoJsonFeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function addPlannerLayers(map: maplibregl.Map, route: GeoJsonFeatureCollection | null) {
  if (!map.getSource('route')) {
    map.addSource('route', {
      type: 'geojson',
      data: route ?? emptyFeatureCollection(),
    });
  }

  if (!map.getLayer('route-casing')) {
    map.addLayer({
      id: 'route-casing',
      type: 'line',
      source: 'route',
      paint: {
        'line-color': '#073b3a',
        'line-width': 8,
        'line-opacity': 0.55,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
  }

  if (!map.getLayer('route-line')) {
    map.addLayer({
      id: 'route-line',
      type: 'line',
      source: 'route',
      paint: {
        'line-color': '#16a085',
        'line-width': 4,
        'line-opacity': 0.95,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    });
  }

}

function fitToData(map: maplibregl.Map, origin: LocationPoint | null, orderedTargets: LocationPoint[]) {
  const points = [origin, ...orderedTargets].filter((point): point is LocationPoint => Boolean(point));
  if (points.length === 0) return;

  const bounds = new LngLatBounds();
  points.forEach((point) => bounds.extend([point.lng, point.lat]));
  map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 800 });
}

export function MapView() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, maplibregl.Marker>>(new Map());
  const origin = usePlannerStore((state) => state.origin);
  const targets = usePlannerStore((state) => state.targets);
  const orderedStops = usePlannerStore((state) => state.orderedStops);
  const routeGeoJson = usePlannerStore((state) => state.routeGeoJson);
  const focusPoint = usePlannerStore((state) => state.focusPoint);
  const selectedBasemap = usePlannerStore((state) => state.selectedBasemap);
  const placementMode = usePlannerStore((state) => state.placementMode);
  const setOrigin = usePlannerStore((state) => state.setOrigin);
  const addTarget = usePlannerStore((state) => state.addTarget);
  const setSelectedBasemap = usePlannerStore((state) => state.setSelectedBasemap);
  const placementModeRef = useRef(placementMode);
  const setOriginRef = useRef(setOrigin);
  const addTargetRef = useRef(addTarget);

  const orderedTargets = useMemo(
    () =>
      orderedStops
        .map((id) => targets.find((target) => target.id === id))
        .filter((target): target is LocationPoint => Boolean(target)),
    [orderedStops, targets],
  );

  useEffect(() => {
    placementModeRef.current = placementMode;
    setOriginRef.current = setOrigin;
    addTargetRef.current = addTarget;
  }, [placementMode, setOrigin, addTarget]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[selectedBasemap].style,
      center: MAKASSAR_CENTER,
      zoom: 12,
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-left');
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

    map.on('load', () => {
      addPlannerLayers(map, routeGeoJson);
      fitToData(map, origin, orderedTargets);
    });

    map.on('click', (event) => {
      const { lat, lng } = event.lngLat;
      if (placementModeRef.current === 'origin') {
        setOriginRef.current({ name: 'Origin', lat, lng });
      } else {
        addTargetRef.current({ name: `Stop ${usePlannerStore.getState().targets.length + 1}`, lat, lng });
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.setStyle(BASEMAPS[selectedBasemap].style);
    map.once('styledata', () => {
      if (!map.isStyleLoaded()) {
        map.once('idle', () => addPlannerLayers(map, routeGeoJson));
        return;
      }
      addPlannerLayers(map, routeGeoJson);
    });
  }, [selectedBasemap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;

    const routeSource = map.getSource('route') as GeoJSONSource | undefined;
    if (routeSource) {
      routeSource.setData(routeGeoJson ?? emptyFeatureCollection());
    }
  }, [routeGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markerSpecs = [
      ...(origin ? [{ key: `origin-${origin.id}`, point: origin, label: 'O', role: 'origin' as const }] : []),
      ...orderedTargets.map((target, index) => ({
        key: `target-${target.id}`,
        point: target,
        label: String(index + 1),
        role: 'target' as const,
      })),
    ];
    const activeKeys = new Set(markerSpecs.map((spec) => spec.key));

    markersRef.current.forEach((marker, key) => {
      if (!activeKeys.has(key)) {
        marker.remove();
        markersRef.current.delete(key);
      }
    });

    markerSpecs.forEach((spec) => {
      const existing = markersRef.current.get(spec.key);
      if (existing) {
        const element = existing.getElement();
        element.textContent = spec.label;
        element.classList.remove('origin', 'target');
        element.classList.add(spec.role);
        element.setAttribute('aria-label', `${spec.role === 'origin' ? 'Origin' : `Stop ${spec.label}`}: ${spec.point.name}`);
        element.onclick = (event) => {
          event.stopPropagation();
          map.flyTo({ center: [spec.point.lng, spec.point.lat], zoom: Math.max(map.getZoom(), 15), essential: true });
        };
        existing.setLngLat([spec.point.lng, spec.point.lat]);
        return;
      }

      const element = document.createElement('button');
      element.type = 'button';
      element.className = `planner-marker ${spec.role}`;
      element.textContent = spec.label;
      element.setAttribute('aria-label', `${spec.role === 'origin' ? 'Origin' : `Stop ${spec.label}`}: ${spec.point.name}`);
      element.onclick = (event) => {
        event.stopPropagation();
        map.flyTo({ center: [spec.point.lng, spec.point.lat], zoom: Math.max(map.getZoom(), 15), essential: true });
      };

      markersRef.current.set(
        spec.key,
        new maplibregl.Marker({ element, anchor: 'center' }).setLngLat([spec.point.lng, spec.point.lat]).addTo(map),
      );
    });
  }, [origin, orderedTargets]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !routeGeoJson) return;
    fitToData(map, origin, orderedTargets);
  }, [routeGeoJson, origin, orderedTargets]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusPoint) return;

    map.flyTo({
      center: [focusPoint.lng, focusPoint.lat],
      zoom: Math.max(map.getZoom(), 15),
      essential: true,
    });
  }, [focusPoint]);

  return (
    <main className="map-shell">
      <div className="map-basemap-control" role="radiogroup" aria-label="Basemap">
        {basemapList.map((basemap) => (
          <button
            key={basemap.id}
            type="button"
            className={selectedBasemap === basemap.id ? 'active' : ''}
            onClick={() => setSelectedBasemap(basemap.id)}
            role="radio"
            aria-checked={selectedBasemap === basemap.id}
            title={basemap.note ?? basemap.description}
          >
            <span className={`basemap-swatch ${basemap.id}`} />
            <span>{basemap.label}</span>
          </button>
        ))}
      </div>
      <div ref={containerRef} className="map-container" aria-label="Route planning map" />
    </main>
  );
}
