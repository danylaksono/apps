import { useEffect, useRef, useState } from "react";
import SearchControls from "./components/SearchControls";
import PosterPanel from "./components/PosterPanel";
import {
  drawExploreMap,
  drawExploreRose,
  drawPoster,
  getPosterDimensions,
} from "./lib/canvasRenderer";
import { fetchCity, fetchStreetWays } from "./lib/overpass";
import { processRoseData } from "./lib/rose";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const DEFAULT_QUERY = "Yogyakarta, Indonesia";
const DEFAULT_PRINT_CONFIG = {
  orientation: "portrait",
  title: "",
  subtitle: "",
  theme: "light",
  rosePosition: "bottom-right",
  roseSizePercent: 30,
  mapZoom: 1,
  mapShiftX: 0,
  mapShiftY: 0,
};

export default function App() {
  const [status, setStatus] = useState("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [cityName, setCityName] = useState("");
  const [searchQuery, setSearchQuery] = useState(DEFAULT_QUERY);
  const [bbox, setBbox] = useState(null);
  const [coords, setCoords] = useState({ lat: 0, lon: 0 });
  const [osmElements, setOsmElements] = useState([]);
  const [roseData, setRoseData] = useState(null);
  const [mode, setMode] = useState("explore");
  const [printConfig, setPrintConfig] = useState(() => {
    try {
      const saved = localStorage.getItem("city-rose-config");
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error("Failed to load config", e);
    }
    return DEFAULT_PRINT_CONFIG;
  });
  const mapCanvasRef = useRef(null);
  const roseCanvasRef = useRef(null);
  const printCanvasRef = useRef(null);

  useEffect(() => {
    localStorage.setItem("city-rose-config", JSON.stringify(printConfig));
  }, [printConfig]);

  useEffect(() => {
    if (status !== "success") {
      return;
    }

    drawExploreMap(mapCanvasRef.current, {
      bbox,
      osmElements,
      mapZoom: printConfig.mapZoom,
      mapShiftX: printConfig.mapShiftX,
      mapShiftY: printConfig.mapShiftY,
    });

    drawExploreRose(roseCanvasRef.current, {
      roseData,
    });

    drawPoster(printCanvasRef.current, {
      bbox,
      cityName,
      coords,
      osmElements,
      roseData,
      layout: printConfig,
    });
  }, [bbox, cityName, coords, osmElements, printConfig, roseData, status]);

  async function generate() {
    const query = searchQuery.trim();
    if (!query) {
      setStatus("error");
      setErrorMessage("Please enter a city name first.");
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const city = await fetchCity(query);
      const streetElements = await fetchStreetWays(city.areaId);
      const nextRoseData = processRoseData(streetElements);

      setCityName(city.cityName);
      setBbox(city.bbox);
      setCoords(city.coords);
      setOsmElements(streetElements);
      setRoseData(nextRoseData);
      setStatus("success");
    } catch (error) {
      setStatus("error");
      setErrorMessage(error.message || "Unexpected processing error.");
    }
  }

  function downloadPoster() {
    const canvas = printCanvasRef.current;
    if (!canvas) {
      return;
    }

    const link = document.createElement("a");
    const safeCityName = cityName.toLowerCase().replace(/\s+/g, "-");
    link.download = `${safeCityName || "city"}-print.png`;
    link.href = canvas.toDataURL("image/png", 1.0);
    link.click();
  }

  function updatePrintConfig(nextPatch) {
    setPrintConfig((previous) => ({ ...previous, ...nextPatch }));
  }

  const posterDimensions = getPosterDimensions(printConfig.orientation);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <header className="shrink-0 border-b border-gray-200 bg-white">
        <div className="w-full px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 flex-1">
            <h1 className="text-lg font-bold tracking-tight hidden sm:block">
              City Rose
            </h1>
            <div className="flex-1 max-w-md">
              <SearchControls
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onGenerate={generate}
                isLoading={status === "loading"}
              />
            </div>
          </div>

          <Tabs value={mode} onValueChange={setMode}>
            <TabsList>
              <TabsTrigger value="explore" className="text-sm font-medium">Explore</TabsTrigger>
              <TabsTrigger value="print" className="text-sm font-medium">Print</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Main Content — fills remaining viewport */}
      <main className="flex-1 min-h-0 w-full p-3 sm:p-4">
        <PosterPanel
          status={status}
          errorMessage={errorMessage}
          mode={mode}
          mapCanvasRef={mapCanvasRef}
          roseCanvasRef={roseCanvasRef}
          printCanvasRef={printCanvasRef}
          printConfig={printConfig}
          onPrintConfigChange={updatePrintConfig}
          onResetPrintConfig={() => {
            setPrintConfig(DEFAULT_PRINT_CONFIG);
          }}
          posterDimensions={posterDimensions}
          cityName={cityName}
          onDownload={downloadPoster}
          onRetry={generate}
        />
      </main>
    </div>
  );
}
