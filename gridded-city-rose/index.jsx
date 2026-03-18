import React, { useState, useEffect, useRef } from 'react';
import { Compass, MapPin, Loader2, Download, Search, Info } from 'lucide-react';

const App = () => {
  const [cityName, setCityName] = useState('Yogyakarta, Indonesia');
  const [status, setStatus] = useState('idle'); // idle, loading, processing, error, success
  const [data, setData] = useState(null);
  const [searchQuery, setSearchQuery] = useState('Yogyakarta, Indonesia');
  const canvasRef = useRef(null);

  // Constants for calculation
  const NUM_BINS = 36; // 10 degrees per bin
  const BIN_SIZE = 360 / NUM_BINS;

  const calculateBearing = (lat1, lon1, lat2, lon2) => {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    let θ = Math.atan2(y, x);
    let bearing = (θ * 180 / Math.PI + 360) % 360;
    return bearing;
  };

  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchData = async (query) => {
    setStatus('loading');
    try {
      // 1. Geocode the city name to get a bounding box or center
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`);
      const geoData = await geoRes.json();
      
      if (geoData.length === 0) throw new Error("City not found");
      
      const city = geoData[0];
      const bbox = city.boundingbox; // [latMin, latMax, lonMin, lonMax]
      setCityName(city.display_name.split(',')[0]);

      // 2. Query Overpass for highway ways
      // We limit the area to avoid massive downloads for large regions
      const overpassQuery = `
        [out:json][timeout:30];
        (
          way["highway"](${bbox[0]},${bbox[2]},${bbox[1]},${bbox[3]});
        );
        out geom;
      `;
      
      const ovRes = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(overpassQuery)
      });
      
      const ovData = await ovRes.json();
      if (!ovData.elements || ovData.elements.length === 0) throw new Error("No street data found");
      
      processOsmData(ovData.elements);
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  const processOsmData = (elements) => {
    setStatus('processing');
    const bins = new Array(NUM_BINS).fill(0);
    let totalLength = 0;

    elements.forEach(el => {
      if (el.type === 'way' && el.geometry) {
        for (let i = 0; i < el.geometry.length - 1; i++) {
          const p1 = el.geometry[i];
          const p2 = el.geometry[i + 1];
          
          const bearing = calculateBearing(p1.lat, p1.lon, p2.lat, p2.lon);
          const dist = calculateDistance(p1.lat, p1.lon, p2.lat, p2.lon);
          
          // Add to bin (and its 180-degree reciprocal)
          const binIdx = Math.floor(bearing / BIN_SIZE) % NUM_BINS;
          const reciprocalIdx = Math.floor(((bearing + 180) % 360) / BIN_SIZE) % NUM_BINS;
          
          bins[binIdx] += dist;
          bins[reciprocalIdx] += dist;
          totalLength += (dist * 2);
        }
      }
    });

    // Normalize
    const normalizedBins = bins.map(v => v / totalLength);
    setData(normalizedBins);
    setStatus('success');
  };

  const drawRose = () => {
    if (!data || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) * 0.4;

    ctx.clearRect(0, 0, width, height);

    // Grid circles
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1.0].forEach(scale => {
      ctx.beginPath();
      ctx.arc(centerX, centerY, maxRadius * scale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Compass lines
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - maxRadius); ctx.lineTo(centerX, centerY + maxRadius);
    ctx.moveTo(centerX - maxRadius, centerY); ctx.lineTo(centerX + maxRadius, centerY);
    ctx.stroke();

    // The Rose Bars
    const maxVal = Math.max(...data);
    
    data.forEach((val, i) => {
      const angle = (i * BIN_SIZE - 90) * Math.PI / 180; // Start from North
      const barLength = (val / maxVal) * maxRadius;
      
      const startAngle = (i * BIN_SIZE - 90 - (BIN_SIZE/2) + 1) * Math.PI / 180;
      const endAngle = (i * BIN_SIZE - 90 + (BIN_SIZE/2) - 1) * Math.PI / 180;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, barLength, startAngle, endAngle);
      ctx.closePath();
      
      // Color based on orientation
      const hue = (i * BIN_SIZE) % 180;
      ctx.fillStyle = `hsla(${hue}, 70%, 50%, 0.8)`;
      ctx.fill();
    });

    // Labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', centerX, centerY - maxRadius - 10);
    ctx.fillText('S', centerX, centerY + maxRadius + 20);
    ctx.fillText('E', centerX + maxRadius + 15, centerY + 5);
    ctx.fillText('W', centerX - maxRadius - 15, centerY + 5);
  };

  useEffect(() => {
    if (status === 'success') {
      drawRose();
    }
  }, [data, status]);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Compass className="text-blue-600" />
              Urban Orientation Rose
            </h1>
            <p className="text-slate-500 mt-1">Analyzing city street fingerprints inspired by Geoff Boeing.</p>
          </div>
          
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="Search city..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && fetchData(searchQuery)}
              />
            </div>
            <button 
              onClick={() => fetchData(searchQuery)}
              disabled={status === 'loading'}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg shadow-sm transition-colors flex items-center gap-2"
            >
              {status === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Controls & Info */}
          <div className="md:col-span-1 space-y-4">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-4">Currently Analyzing</h2>
              <div className="flex items-start gap-3">
                <MapPin className="text-red-500 w-5 h-5 shrink-0 mt-1" />
                <div>
                  <p className="font-bold text-lg leading-tight">{cityName}</p>
                  <p className="text-xs text-slate-400 mt-1 uppercase tracking-tweak">OpenStreetMap Data</p>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800 leading-relaxed">
                  <Info className="w-4 h-4 mb-1" />
                  This diagram represents the distribution of street orientations. Bins pointing to 0°/180° indicate North-South roads. Longer bars mean more road-meters in that direction.
                </div>
                
                {status === 'success' && (
                  <button 
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `${cityName}-rose.png`;
                      link.href = canvasRef.current.toDataURL();
                      link.click();
                    }}
                    className="w-full py-2 border border-slate-200 hover:bg-slate-50 rounded-lg flex items-center justify-center gap-2 text-sm font-medium transition-colors"
                  >
                    <Download className="w-4 h-4" /> Download Export
                  </button>
                )}
              </div>
            </div>

            <div className="bg-slate-900 text-slate-400 p-6 rounded-2xl shadow-inner text-xs leading-relaxed italic">
              "A city's orientation entropy tells the story of its birth—be it through imperial planning, rapid grid expansion, or the slow, meandering paths of history."
            </div>
          </div>

          {/* Canvas Section */}
          <div className="md:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col items-center justify-center min-h-[500px] relative overflow-hidden">
            {status === 'idle' && (
              <div className="text-center p-8">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Compass className="text-slate-300 w-8 h-8" />
                </div>
                <p className="text-slate-400">Click Analyze to generate the rose diagram.</p>
              </div>
            )}

            {status === 'loading' && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="font-medium animate-pulse">Fetching OSM Data...</p>
              </div>
            )}

            {status === 'processing' && (
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="font-medium">Calculating Bearings...</p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center text-red-500 p-8">
                <p className="font-bold">Error loading data.</p>
                <p className="text-sm opacity-80 mt-1">Try a more specific city name or check connection.</p>
              </div>
            )}

            <canvas 
              ref={canvasRef} 
              width={800} 
              height={800} 
              className={`max-w-full h-auto ${status === 'success' ? 'block' : 'hidden'}`}
            />

            {status === 'success' && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-white/80 backdrop-blur rounded-full border border-slate-200 text-[10px] text-slate-500 font-mono">
                36 BINS • LENGTH-WEIGHTED • {data.length > 0 ? 'SYMMETRIC' : ''}
              </div>
            )}
          </div>
        </main>

        <footer className="text-center py-8 text-slate-400 text-xs">
          Built with OpenStreetMap and Overpass API. Inspired by Geoff Boeing's OSMnx research.
        </footer>
      </div>
    </div>
  );
};

export default App;