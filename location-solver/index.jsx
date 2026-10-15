import React, { useState, useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';

// --- Utility & Math Functions ---
// Haversine formula to get true distance in kilometers between two lng/lat points
const haversineDist = (p1, p2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (p2.lat - p1.lat) * (Math.PI / 180);
  const dLon = (p2.lng - p1.lng) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1.lat * (Math.PI / 180)) * Math.cos(p2.lat * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Standard distinct colors for the allocations
const COLORS = [
  '#facc15', '#f97316', '#ef4444', '#84cc16', 
  '#3b82f6', '#ec4899', '#a855f7', '#8b5cf6',
  '#14b8a6', '#06b6d4', '#10b981', '#f43f5e',
  '#d946ef', '#6366f1', '#0ea5e9', '#22c55e',
  '#eab308', '#f59e0b', '#dc2626', '#65a30d'
];

// --- Algorithm: P-Median Heuristic (Teitz-Bart) ---
const solvePMedian = (demand, candidates, p) => {
  if (p <= 0 || candidates.length === 0) return { selected: [], allocations: [], totalCost: 0 };
  
  // 1. Initial selection
  let selected = Array.from({ length: Math.min(p, candidates.length) }, (_, i) => i);
  let unselected = Array.from({ length: candidates.length }, (_, i) => i).filter(i => !selected.includes(i));

  const calculateCost = (selIndices) => {
    let cost = 0;
    const allocs = new Int32Array(demand.length);
    const selCands = selIndices.map(i => candidates[i]);
    
    for (let i = 0; i < demand.length; i++) {
      let minDist = Infinity;
      let bestCandIdx = -1;
      for (let j = 0; j < selCands.length; j++) {
        const dist = haversineDist(demand[i], selCands[j]);
        if (dist < minDist) {
          minDist = dist;
          bestCandIdx = j; 
        }
      }
      cost += minDist * demand[i].weight;
      allocs[i] = bestCandIdx;
    }
    return { cost, allocs };
  };

  let currentRes = calculateCost(selected);
  let bestCost = currentRes.cost;
  let bestAlloc = currentRes.allocs;

  // 2. Local Search (Swap)
  let improved = true;
  let iterations = 0;
  const MAX_ITER = 50; 

  while (improved && iterations < MAX_ITER) {
    improved = false;
    iterations++;

    for (let i = 0; i < selected.length; i++) {
      for (let j = 0; j < unselected.length; j++) {
        const newSelected = [...selected];
        newSelected[i] = unselected[j];
        
        const testRes = calculateCost(newSelected);

        if (testRes.cost < bestCost - 0.0001) { 
          bestCost = testRes.cost;
          bestAlloc = testRes.allocs;
          
          const temp = selected[i];
          selected[i] = unselected[j];
          unselected[j] = temp;
          
          improved = true;
          break; 
        }
      }
      if (improved) break; 
    }
  }

  return { selected, allocations: bestAlloc, totalCost: bestCost };
};

// --- Mock Data Generation (DFW Area Coordinates) ---
const generateMockData = (numDemand = 1600, numCandidates = 20) => {
  const demand = [];
  const centers = [
    { lng: -97.33, lat: 32.75, spread: 0.15, weightMult: 1.5 }, // West core (Fort Worth)
    { lng: -96.80, lat: 32.77, spread: 0.20, weightMult: 2.0 }, // East core (Dallas)
    { lng: -96.80, lat: 33.10, spread: 0.12, weightMult: 0.8 }, // North suburb (Frisco)
    { lng: -97.10, lat: 32.40, spread: 0.14, weightMult: 0.7 }, // South suburb (Mansfield/Midlothian)
  ];

  const randomNormal = () => {
    let u = 0, v = 0;
    while(u === 0) u = Math.random();
    while(v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  };

  for (let i = 0; i < numDemand; i++) {
    const center = centers[Math.floor(Math.random() * centers.length)];
    const lng = center.lng + randomNormal() * center.spread;
    const lat = center.lat + randomNormal() * center.spread;
    
    demand.push({ 
      id: i,
      lng, lat, 
      weight: Math.floor(Math.abs(randomNormal() * 1000 * center.weightMult) + 100)
    });
  }

  const candidates = [];
  for (let i = 0; i < numCandidates; i++) {
    if (i < centers.length * 2) {
      const c = centers[i % centers.length];
      candidates.push({
        id: i,
        lng: c.lng + (Math.random() - 0.5) * 0.15,
        lat: c.lat + (Math.random() - 0.5) * 0.15
      });
    } else {
      candidates.push({
        id: i,
        lng: -97.5 + Math.random() * 1.0,
        lat: 32.2 + Math.random() * 1.0
      });
    }
  }

  return { demand, candidates };
};

// --- Main Application Component ---
export default function App() {
  const [data, setData] = useState({ demand: [], candidates: [] });
  const [p, setP] = useState(8);
  const [solution, setSolution] = useState({ selected: [], allocations: null, stats: null });
  const [isSolving, setIsSolving] = useState(false);
  
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);
  const markersRef = useRef(new Map());

  // Inject MapLibre CSS
  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://unpkg.com/maplibre-gl@3.6.2/dist/maplibre-gl.css';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  // Initialize data
  useEffect(() => {
    setData(generateMockData());
  }, []);

  // Solve function
  const handleSolve = useCallback(() => {
    if (data.candidates.length === 0) return;
    setIsSolving(true);
    
    setTimeout(() => {
      const start = performance.now();
      const res = solvePMedian(data.demand, data.candidates, p);
      
      let maxDist = 0;
      const distances = [];
      let totalPop = 0;
      
      for(let i=0; i<data.demand.length; i++) {
        const assignedIdx = res.allocations[i];
        if (assignedIdx === -1) continue;
        const cand = data.candidates[res.selected[assignedIdx]];
        const d = haversineDist(data.demand[i], cand);
        maxDist = Math.max(maxDist, d);
        distances.push(d);
        totalPop += data.demand[i].weight;
      }
      
      distances.sort((a,b) => a-b);
      const medianDist = distances.length > 0 ? distances[Math.floor(distances.length/2)] : 0;

      setSolution({
        selected: res.selected,
        allocations: res.allocations,
        stats: {
          totalCost: res.totalCost,
          maxDist: maxDist, 
          medianDist: medianDist,
          timeMs: performance.now() - start,
          totalPop
        }
      });
      setIsSolving(false);
    }, 10);
  }, [data, p]);

  // Initial solve
  useEffect(() => {
    if (data.demand.length > 0) {
      handleSolve();
    }
  }, [data.demand.length]);

  // Initialize MapLibre Map
  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
      center: [-97.05, 32.75], // Centered roughly over DFW Airport
      zoom: 8.5
    });

    map.on('load', () => {
      // 1. Source for allocation lines
      map.addSource('allocations', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // 2. Source for demand points
      map.addSource('demand', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });

      // Layer for lines (drawn first/underneath)
      map.addLayer({
        id: 'allocation-lines',
        type: 'line',
        source: 'allocations',
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 1,
          'line-opacity': 0.4
        }
      });

      // Layer for demand points
      map.addLayer({
        id: 'demand-points',
        type: 'circle',
        source: 'demand',
        paint: {
          'circle-radius': ['get', 'radius'],
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.8,
          'circle-stroke-width': 0.5,
          'circle-stroke-color': '#ffffff'
        }
      });

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      map.remove();
    };
  }, []);

  // Sync Data & Solution to Map Sources
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    // Build Demand Points GeoJSON
    const demandFeatures = data.demand.map((d, i) => {
      let color = '#cbd5e1'; 
      if (solution.allocations && solution.allocations[i] !== -1) {
         color = COLORS[solution.allocations[i] % COLORS.length];
      }
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [d.lng, d.lat] },
        properties: {
          color,
          radius: Math.min(6, Math.max(2, d.weight / 250)) // Scale visualization
        }
      };
    });

    // Build Allocation Lines GeoJSON
    const lineFeatures = [];
    if (solution.allocations && solution.selected.length > 0) {
      const selectedCands = solution.selected.map(idx => data.candidates[idx]);
      
      for (let i = 0; i < data.demand.length; i++) {
        const d = data.demand[i];
        const assignedIdx = solution.allocations[i];
        
        if (assignedIdx >= 0 && assignedIdx < selectedCands.length) {
          const cand = selectedCands[assignedIdx];
          lineFeatures.push({
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: [[d.lng, d.lat], [cand.lng, cand.lat]]
            },
            properties: {
              color: COLORS[assignedIdx % COLORS.length]
            }
          });
        }
      }
    }

    // Safely update sources
    if (map.getSource('demand')) {
      map.getSource('demand').setData({ type: 'FeatureCollection', features: demandFeatures });
    }
    if (map.getSource('allocations')) {
      map.getSource('allocations').setData({ type: 'FeatureCollection', features: lineFeatures });
    }

  }, [data.demand, data.candidates, solution, mapReady]);

  // Sync Interactive Markers
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    
    // Add new markers / update logic
    data.candidates.forEach((cand, idx) => {
      const isSelected = solution.selected.includes(idx);
      const fillColor = isSelected ? '#dc2626' : '#171717';
      const holeColor = isSelected ? 'white' : '#737373';

      if (!markersRef.current.has(cand.id)) {
        // Create custom DOM element for the marker pin
        const el = document.createElement('div');
        el.className = 'cursor-grab active:cursor-grabbing';
        el.innerHTML = `
          <svg width="28" height="30" viewBox="-14 -30 28 30" class="drop-shadow-md">
            <path d="M0 0 C -8 -10 -14 -20 -14 -30 A 14 14 0 0 1 14 -30 C 14 -20 8 -10 0 0 Z" fill="${fillColor}" stroke="white" stroke-width="2"/>
            <circle cx="0" cy="-30" r="5" fill="${holeColor}" />
          </svg>
        `;

        const marker = new maplibregl.Marker({ element: el, draggable: true })
          .setLngLat([cand.lng, cand.lat])
          .addTo(mapRef.current);

        // Update state on drag end
        marker.on('dragend', () => {
          const lngLat = marker.getLngLat();
          setData(prev => ({
            ...prev,
            candidates: prev.candidates.map(c => 
              c.id === cand.id ? { ...c, lng: lngLat.lng, lat: lngLat.lat } : c
            )
          }));
        });

        markersRef.current.set(cand.id, marker);
      } else {
        // Update colors of existing markers if selection state changed
        const marker = markersRef.current.get(cand.id);
        const svgPath = marker.getElement().querySelector('path');
        const svgCircle = marker.getElement().querySelector('circle');
        if (svgPath && svgCircle) {
           svgPath.setAttribute('fill', fillColor);
           svgCircle.setAttribute('fill', holeColor);
        }
      }
    });

  }, [data.candidates, solution.selected, mapReady]);

  return (
    <div className="flex h-screen w-full bg-gray-100 font-sans overflow-hidden">
      
      {/* MapLibre Container */}
      <div className="flex-1 relative" ref={mapContainer} />

      {/* Sidebar UI */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900 leading-tight mb-2">DFW Location Solver</h1>
          <p className="text-xs text-gray-500 mb-4 leading-relaxed">
            Powered by MapLibre GL JS. Drag candidate markers, set the slider, and re-solve to find optimal facility locations.
          </p>
          
          <div className="mb-6">
            <div className="flex justify-between items-end mb-2">
              <label className="text-sm font-medium text-gray-700">Facilities to select:</label>
              <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded">{p}</span>
            </div>
            <input 
              type="range" 
              min="1" 
              max={data.candidates.length} 
              value={p} 
              onChange={(e) => setP(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1">
              <span>1</span>
              <span>{Math.floor(data.candidates.length / 2)}</span>
              <span>{data.candidates.length}</span>
            </div>
          </div>

          <button 
            onClick={handleSolve}
            disabled={isSolving}
            className={`w-full py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white 
              ${isSolving ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'} 
              transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {isSolving ? 'Solving...' : 'Solve'}
          </button>
        </div>

        <div className="p-6 flex-1 bg-gray-50 overflow-y-auto">
          <h2 className="text-sm font-bold text-gray-900 mb-4">Results</h2>
          
          {solution.stats ? (
            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-gray-600">Selected facilities:</span>
                <span className="font-semibold text-gray-900">{solution.selected.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-gray-600">Total w. distance:</span>
                <span className="font-semibold text-gray-900">
                  {Math.round(solution.stats.totalCost).toLocaleString()} km
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-200 pb-2">
                <span className="text-gray-600">Max distance:</span>
                <span className="font-semibold text-gray-900">
                  {solution.stats.maxDist.toFixed(1)} km
                </span>
              </div>
              <div className="flex justify-between items-center pb-2">
                <span className="text-gray-600">Median distance:</span>
                <span className="font-semibold text-gray-900">
                  {solution.stats.medianDist.toFixed(1)} km
                </span>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-400 italic text-center mt-8">
              Click solve to see results
            </div>
          )}
        </div>

        {/* Footer Stats */}
        {solution.stats && (
          <div className="p-4 bg-gray-100 text-[10px] text-gray-500 border-t border-gray-200 text-center">
            {data.candidates.length} candidates | {data.demand.length.toLocaleString()} demand points | {(solution.stats.totalPop/1000).toFixed(0)}k total pop
            <br/>
            Solved in {solution.stats.timeMs.toFixed(0)}ms via Teitz-Bart heuristic
          </div>
        )}
      </div>
    </div>
  );
}