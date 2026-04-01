import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { initializeDuckDB, fetchBoundary, queryPopulation, generateJoyplot } from './services/dataService';
import type { JoySlice } from './services/dataService';
import Controls from './components/Controls';
import JoyplotCanvas from './components/JoyplotCanvas';

function App() {
  const {
    city,
    resolution,
    heightScale,
    clipToBoundary,
    printMode,
    customTitle,
    customSubtitle,
    titlePosition,
    mapScalePosition,
    cityCenter,
    isLoading,
    setLoading,
    statusMessage,
    setCityCenter,
    setCustomTitle,
    setCustomSubtitle,
  } = useAppStore();
  const [data, setData] = useState<JoySlice[]>([]);
  const [bbox, setBbox] = useState<number[] | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [maxPop, setMaxPop] = useState(1);
  const [isDbReady, setIsDbReady] = useState(false);

  useEffect(() => {
    setLoading(true, 'Initializing DuckDB...');
    initializeDuckDB((msg) => useAppStore.getState().setLoading(true, msg))
      .then(() => {
        setIsDbReady(true);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false, 'Failed to initialize DuckDB');
      });
  }, []);

  useEffect(() => {
    if (!isDbReady) return;

    if (!city.trim()) {
      setData([]);
      setBbox(null);
      setGeojson(null);
      setMaxPop(1);
      setCityCenter(null);
      setCustomTitle('');
      setCustomSubtitle('');
      setLoading(false, '');
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      setLoading(true, `Fetching boundary for ${city}...`);
      try {
        const { geojson, bbox } = await fetchBoundary(city);
        if (cancelled) return;

        setBbox(bbox);
        setGeojson(geojson);
        setCityCenter([(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2]);

        const numSlices = resolution;
        const pointsPerSlice = Math.floor(resolution * 1.5);
        const latStep = (bbox[3] - bbox[1]) / numSlices;
        const lonStep = (bbox[2] - bbox[0]) / pointsPerSlice;
        
        const h3Set = new Set<string>();
        const h3js = await import('h3-js');
        
        for (let i = 0; i <= numSlices; i++) {
          const lat = bbox[3] - i * latStep;
          for (let j = 0; j <= pointsPerSlice; j++) {
            const lon = bbox[0] + j * lonStep;
            const h3Index = h3js.latLngToCell(lat, lon, 8);
            h3Set.add(h3Index);
          }
        }

        setLoading(true, `Querying ${h3Set.size} cells...`);
        const popMap = await queryPopulation(Array.from(h3Set));
        if (cancelled) return;
        
        const slices = generateJoyplot(geojson, bbox, resolution, popMap);
        
        let maxP = 0;
        slices.forEach(s => s.points.forEach(p => { if (p.pop > maxP) maxP = p.pop; }));
        
        setMaxPop(maxP || 1);
        setData(slices);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [city, resolution, isDbReady, setLoading, setCityCenter, setCustomTitle, setCustomSubtitle]);

  useEffect(() => {
    if (!city.trim()) return;
    const title = city.trim();
    const subtitle = cityCenter
      ? `Population ridgeline map | ${cityCenter[0].toFixed(4)}°, ${cityCenter[1].toFixed(4)}°`
      : 'Population ridgeline map';
    setCustomTitle(title);
    setCustomSubtitle(subtitle);
  }, [city, cityCenter, setCustomTitle, setCustomSubtitle]);

  return (
    <div className="app-container">
      <JoyplotCanvas 
        slices={data} 
        bbox={bbox} 
        geojson={geojson} 
        maxPop={maxPop}
        heightScale={heightScale}
        clipToBoundary={clipToBoundary}
        printMode={printMode}
        city={city}
        cityCenter={cityCenter}
        customTitle={customTitle}
        customSubtitle={customSubtitle}
        titlePosition={titlePosition}
        mapScalePosition={mapScalePosition}
      />
      
      <Controls />

      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <Loader2 className="animate-spin" size={24} color="#22d3ee" />
            <div className="loading-info">
               <span className="loading-title">Processing...</span>
               <span className="loading-status">{statusMessage}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
