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
    pitch,
    padding,
    projectionScale,
    offsetX,
    offsetY,
    rotation,
    clipToBoundary,
    printMode,
    customTitle,
    customSubtitle,
    titlePosition,
    mapScalePosition,
    cityCenter,
    boundaryOverride,
    boundaryLabel,
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
      .catch((err) => {
        console.error(err);
        setLoading(false, 'Failed to initialize DuckDB');
      });
  }, [setLoading]);

  useEffect(() => {
    if (!isDbReady) return;

    if (!city.trim() && !boundaryOverride) {
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
      const activeBoundary = boundaryOverride || (city.trim() ? await fetchBoundary(city) : null);
      if (!activeBoundary || cancelled) return;

      const { geojson: boundaryGeojson, bbox: boundaryBbox } = activeBoundary;
      setLoading(true, boundaryOverride ? 'Loading uploaded boundary...' : `Fetching boundary for ${city}...`);

      try {
        if (cancelled) return;

        setBbox(boundaryBbox);
        setGeojson(boundaryGeojson);
        setCityCenter([(boundaryBbox[1] + boundaryBbox[3]) / 2, (boundaryBbox[0] + boundaryBbox[2]) / 2]);

        const numSlices = resolution;
        const pointsPerSlice = Math.floor(resolution * 1.5);
        const latStep = (boundaryBbox[3] - boundaryBbox[1]) / numSlices;
        const lonStep = (boundaryBbox[2] - boundaryBbox[0]) / pointsPerSlice;

        const h3Set = new Set<string>();
        const h3js = await import('h3-js');

        for (let i = 0; i <= numSlices; i++) {
          const lat = boundaryBbox[3] - i * latStep;
          for (let j = 0; j <= pointsPerSlice; j++) {
            const lon = boundaryBbox[0] + j * lonStep;
            h3Set.add(h3js.latLngToCell(lat, lon, 8));
          }
        }

        setLoading(true, `Querying ${h3Set.size} cells...`);
        const popMap = await queryPopulation(Array.from(h3Set));
        if (cancelled) return;

        const slices = generateJoyplot(boundaryGeojson, boundaryBbox, resolution, popMap);

        let maxP = 0;
        slices.forEach((slice) => slice.points.forEach((point) => {
          if (point.pop > maxP) maxP = point.pop;
        }));

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
  }, [city, resolution, isDbReady, boundaryOverride, setLoading, setCityCenter, setCustomTitle, setCustomSubtitle]);

  useEffect(() => {
    const hasCity = city.trim().length > 0;
    const hasBoundary = Boolean(boundaryOverride);

    if (!hasCity && !hasBoundary) {
      setCustomTitle('');
      setCustomSubtitle('');
      return;
    }

    const title = hasBoundary ? boundaryLabel || 'Custom boundary' : city.trim();
    const subtitle = cityCenter
      ? `${hasBoundary ? 'Uploaded GeoJSON boundary' : 'Population ridgeline map'} | ${cityCenter[0].toFixed(4)}°, ${cityCenter[1].toFixed(4)}°`
      : hasBoundary
        ? 'Uploaded GeoJSON boundary'
        : 'Population ridgeline map';

    setCustomTitle(title);
    setCustomSubtitle(subtitle);
  }, [city, cityCenter, boundaryOverride, boundaryLabel, setCustomTitle, setCustomSubtitle]);

  return (
    <div className="app-container">
      <JoyplotCanvas
        slices={data}
        bbox={bbox}
        geojson={geojson}
        maxPop={maxPop}
        heightScale={heightScale}
        pitch={pitch}
        padding={padding}
        projectionScale={projectionScale}
        offsetX={offsetX}
        offsetY={offsetY}
        rotation={rotation}
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