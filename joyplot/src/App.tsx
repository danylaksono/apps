import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAppStore } from './store/useAppStore';
import { initializeDuckDB, fetchBoundary, fetchLocalFeaturedBoundary, queryPopulation, generateJoyplot } from './services/dataService';
import type { JoySlice } from './services/dataService';
import Controls from './components/Controls';
import JoyplotCanvas from './components/JoyplotCanvas';
import WelcomeJoyplotBackdrop from './components/WelcomeJoyplotBackdrop';

interface SerializedJoySlice {
  index: number;
  baseLat: number;
  points: [number, number, number][];
}

interface CarouselCacheCity {
  city: string;
  bbox: number[];
  cityCenter: [number, number];
  maxPop: number;
  slices: SerializedJoySlice[];
}

interface CarouselCache {
  version: number;
  resolution: number;
  cities: Record<string, CarouselCacheCity>;
}

const featuredCities = [
  'Jakarta',
  'Surabaya',
  'Bandung',
  'Madiun',
  'Medan',
  'Gresik',
  'Denpasar',
  'Solo',
  'Semarang',
  'Yogyakarta',
  'Manokwari',
  'Makassar',
  'Bekasi',
];

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
    rotateX,
    rotateY,
    rotateZ,
    clipToBoundary,
    printMode,
    printTheme,
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
    setCity,
    userSelected,
    setRotateY,
    setRotateZ,
  } = useAppStore();

  const [data, setData] = useState<JoySlice[]>([]);
  const featuredIndexRef = useRef(0);
  const rotateYRef = useRef(rotateY);
  const [bbox, setBbox] = useState<number[] | null>(null);
  const [geojson, setGeojson] = useState<any>(null);
  const [maxPop, setMaxPop] = useState(1);
  const [isDbReady, setIsDbReady] = useState(false);
  const [carouselCache, setCarouselCache] = useState<CarouselCache | null | undefined>(undefined);
  const carouselDelayMs = 12000;
  const carouselEnabled = false;

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
    if (!carouselEnabled) return;
    if (!isDbReady || userSelected || boundaryOverride) return;
    if (!city.trim()) {
      featuredIndexRef.current = 0;
      setRotateY(0);
      setCity(featuredCities[0]);
      return;
    }
  }, [carouselEnabled, isDbReady, userSelected, boundaryOverride, city, setCity, setRotateY]);

  useEffect(() => {
    if (!carouselEnabled) return;
    if (!isDbReady || userSelected || boundaryOverride || isLoading) return;

    const currentCity = city.trim();
    if (!currentCity) return;

    const currentIndex = featuredCities.indexOf(currentCity);
    if (currentIndex === -1) return;

    featuredIndexRef.current = currentIndex;

    const timeout = window.setTimeout(() => {
      const nextIndex = (featuredIndexRef.current + 1) % featuredCities.length;
      featuredIndexRef.current = nextIndex;
      setRotateY(0);
      setCity(featuredCities[nextIndex]);
    }, carouselDelayMs);

    return () => window.clearTimeout(timeout);
  }, [carouselEnabled, isDbReady, userSelected, boundaryOverride, isLoading, city, setCity, setRotateY]);

  rotateYRef.current = rotateY;

  useEffect(() => {
    if (!carouselEnabled) return;
    if (!isDbReady || userSelected || boundaryOverride || isLoading) return;
    if (!city.trim() || !featuredCities.includes(city.trim())) return;

    const rotationTimer = window.setInterval(() => {
      setRotateY(rotateYRef.current + 0.3);
    }, 30);

    return () => window.clearInterval(rotationTimer);
  }, [carouselEnabled, isDbReady, userSelected, boundaryOverride, city, setRotateY, setRotateZ]);

  useEffect(() => {
    if (!carouselEnabled) return;
    const url = `${import.meta.env.BASE_URL}data_source/joyplot-carousel-cache.json`;
    fetch(url)
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data && typeof data === 'object') {
          setCarouselCache(data as CarouselCache);
        }
      })
      .catch(() => {
        setCarouselCache(null);
      });
  }, []);

  const isInitialGuidanceActive = !userSelected && !boundaryOverride && !city.trim() && !isLoading;

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
    let loadingMessage = '';
    const isCarouselCity = !userSelected && !boundaryOverride && featuredCities.includes(city.trim());
    if (isCarouselCity && carouselCache === undefined) return;

    const loadData = async () => {
      const activeBoundary = boundaryOverride
        || (isCarouselCity
          ? await fetchLocalFeaturedBoundary(city)
          : city.trim()
            ? await fetchBoundary(city)
            : null);
      if (!activeBoundary || cancelled) return;

      const { geojson: boundaryGeojson, bbox: boundaryBbox } = activeBoundary;
      setLoading(true, boundaryOverride
        ? 'Loading uploaded boundary...'
        : isCarouselCity
          ? `Loading featured boundary for ${city}...`
          : `Fetching boundary for ${city}...`);

      try {
        if (cancelled) return;

        const normalizedCityKey = city.trim().toLowerCase();
        const carouselEntry = isCarouselCity && carouselCache?.resolution === resolution
          ? carouselCache.cities[normalizedCityKey]
          : null;

        if (carouselEntry) {
          setBbox(carouselEntry.bbox);
          setGeojson(boundaryGeojson);
          setCityCenter(carouselEntry.cityCenter);
          setMaxPop(carouselEntry.maxPop);
          setData(carouselEntry.slices.map((slice) => ({
            index: slice.index,
            baseLat: slice.baseLat,
            points: slice.points.map(([lon, lat, pop]) => ({ lon, lat, pop })),
          })));
          return;
        }

        if (cancelled) return;

        const currentCityCenter: [number, number] = [(boundaryBbox[1] + boundaryBbox[3]) / 2, (boundaryBbox[0] + boundaryBbox[2]) / 2];
        setBbox(boundaryBbox);
        setGeojson(boundaryGeojson);
        setCityCenter(currentCityCenter);

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
        const errorMessage = err instanceof Error ? err.message : '';
        loadingMessage = /not found/i.test(errorMessage) || /invalid featured city name/i.test(errorMessage)
          ? 'City is not available.'
          : 'Unable to load boundary.';
      } finally {
        if (!cancelled) {
          setLoading(false, loadingMessage);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [city, resolution, isDbReady, boundaryOverride, setLoading, setCityCenter, setCustomTitle, setCustomSubtitle, carouselCache, userSelected]);

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
        rotateX={rotateX}
        rotateY={rotateY}
        rotateZ={rotateZ}
        clipToBoundary={clipToBoundary}
        printMode={printMode}
        printTheme={printTheme}
        city={city}
        cityCenter={cityCenter}
        customTitle={customTitle}
        customSubtitle={customSubtitle}
        titlePosition={titlePosition}
        mapScalePosition={mapScalePosition}
      />

      {isInitialGuidanceActive && (
        <div className="initial-guidance-overlay">
          <WelcomeJoyplotBackdrop />
          <div className="initial-guidance-card">
            <span className="guidance-badge">Welcome</span>
            <h2>Get started with your first joyplot</h2>
            <p>Search a city name or upload a GeoJSON boundary to render Indonesia's population ridgeline view.</p>
            <ul className="guidance-list">
              <li>Search for a city, e.g. <strong>Bandung</strong> or <strong>Jakarta</strong>.</li>
              <li>Upload your own <strong>GeoJSON</strong> boundary if you want custom regions.</li>
              <li>Adjust resolution, height scale, clipping, and export when ready.</li>
            </ul>
          </div>
        </div>
      )}

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