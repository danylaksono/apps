import { useEffect, useRef, useState } from 'react';
import SearchControls from './components/SearchControls';
import PosterPanel from './components/PosterPanel';
import FooterInfo from './components/FooterInfo';
import { drawPoster } from './lib/canvasRenderer';
import { fetchCity, fetchStreetWays } from './lib/overpass';
import { processRoseData } from './lib/rose';

const DEFAULT_QUERY = 'Yogyakarta, Indonesia';

export default function App() {
  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [cityName, setCityName] = useState('');
  const [searchQuery, setSearchQuery] = useState(DEFAULT_QUERY);
  const [bbox, setBbox] = useState(null);
  const [coords, setCoords] = useState({ lat: 0, lon: 0 });
  const [osmElements, setOsmElements] = useState([]);
  const [roseData, setRoseData] = useState(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (status !== 'success') {
      return;
    }

    drawPoster(canvasRef.current, {
      bbox,
      cityName,
      coords,
      osmElements,
      roseData,
    });
  }, [bbox, cityName, coords, osmElements, roseData, status]);

  async function generate() {
    const query = searchQuery.trim();
    if (!query) {
      setStatus('error');
      setErrorMessage('Please enter a city name first.');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    try {
      const city = await fetchCity(query);
      const streetElements = await fetchStreetWays(city.areaId);
      const nextRoseData = processRoseData(streetElements);

      setCityName(city.cityName);
      setBbox(city.bbox);
      setCoords(city.coords);
      setOsmElements(streetElements);
      setRoseData(nextRoseData);
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error.message || 'Unexpected processing error.');
    }
  }

  function downloadPoster() {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const link = document.createElement('a');
    const safeCityName = cityName.toLowerCase().replace(/\s+/g, '-');
    link.download = `${safeCityName || 'city'}-print.png`;
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  }

  return (
    <div className="app-shell">
      <div className="backdrop-orb orb-left" />
      <div className="backdrop-orb orb-right" />

      <main className="layout">
        <h1 className="title">City Rose</h1>
        <p className="subtitle">Street orientation fingerprint from OpenStreetMap geometry</p>

        <SearchControls
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onGenerate={generate}
          isLoading={status === 'loading'}
        />

        <PosterPanel
          status={status}
          errorMessage={errorMessage}
          canvasRef={canvasRef}
          cityName={cityName}
          onDownload={downloadPoster}
          onRetry={generate}
        />

        <FooterInfo />
      </main>
    </div>
  );
}
