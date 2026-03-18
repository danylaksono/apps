import {
  AlertCircle,
  Compass,
  Download,
  Loader2,
  Map,
  PieChart,
  RefreshCw,
  SlidersHorizontal,
  Type,
  Palette
} from "lucide-react";
import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";

/**
 * Shows the idle / first-time-loading / error overlay.
 * When `hasData` is true we never block the view — a subtle loading bar
 * is rendered separately via `LoadingBar`.
 */
function StatusOverlay({ status, hasData, errorMessage, onRetry }) {
  // If data already exists, don't show full-screen overlays for loading
  if (hasData && status !== "error") return null;

  if (status === "idle") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-400">
        <Compass size={56} strokeWidth={1} className="text-gray-300" />
        <p className="text-sm font-medium">Select a city to begin</p>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/80 z-10">
        <div className="spinner" />
        <p className="text-sm font-medium text-gray-600">Extracting urban geometry…</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-white z-20">
        <AlertCircle size={36} className="text-red-500" />
        <div className="space-y-1">
          <h2 className="font-bold text-gray-900">Process failed</h2>
          <p className="text-sm text-gray-500 max-w-[280px] mx-auto">{errorMessage}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-2">
          Retry
        </Button>
      </div>
    );
  }

  return null;
}

/**
 * Subtle indeterminate progress bar shown at the top of a panel
 * when loading new data while old data is still visible.
 */
function LoadingBar({ isLoading }) {
  if (!isLoading) return null;
  return (
    <div className="absolute top-0 left-0 right-0 z-30 h-1 bg-gray-200 overflow-hidden">
      <div className="h-full w-1/3 bg-gray-800 rounded-full animate-loading-bar" />
    </div>
  );
}

function ControlGroup({ label, value, min, max, step, onChange }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <Label className="text-xs font-medium text-gray-600">{label}</Label>
        <Badge variant="secondary" className="font-mono text-xs px-1.5 py-0 h-5 min-w-[32px] justify-center">
          {value}
        </Badge>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vals) => onChange(vals[0])}
        className="py-1"
      />
    </div>
  );
}

export default function PosterPanel({
  status,
  hasData,
  errorMessage,
  mode,
  mapCanvasRef,
  roseCanvasRef,
  printCanvasRef,
  printConfig,
  onPrintConfigChange,
  onResetPrintConfig,
  posterDimensions,
  cityName,
  onDownload,
  onRetry,
}) {
  // Show canvases whenever data exists
  const showCanvas = hasData;
  const isRefreshing = hasData && status === "loading";

  const renderOverlay = () => (
    <StatusOverlay
      status={status}
      hasData={hasData}
      errorMessage={errorMessage}
      onRetry={onRetry}
    />
  );

  const handleWheel = (e) => {
    if (!hasData) return;
    const zoomDelta = e.deltaY > 0 ? -0.05 : 0.05;
    const newZoom = Math.max(0.7, Math.min(3, printConfig.mapZoom + zoomDelta));
    onPrintConfigChange({ mapZoom: Number(newZoom.toFixed(2)) });
  };

  const [isDragging, setIsDragging] = useState(false);
  
  const handlePointerDown = (e) => {
    if (!hasData) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  
  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    const moveX = e.movementX * (2 / rect.width) / printConfig.mapZoom;
    const moveY = e.movementY * (2 / rect.height) / printConfig.mapZoom;

    const newX = Math.max(-1, Math.min(1, printConfig.mapShiftX + moveX));
    const newY = Math.max(-1, Math.min(1, printConfig.mapShiftY + moveY));
    
    onPrintConfigChange({ 
      mapShiftX: Number(newX.toFixed(3)), 
      mapShiftY: Number(newY.toFixed(3)) 
    });
  };
  
  const handlePointerUp = (e) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const canvasInteractionProps = {
    onWheel: handleWheel,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerLeave: handlePointerUp,
    style: { 
      touchAction: 'none',
      cursor: hasData ? (isDragging ? "grabbing" : "grab") : "default" 
    }
  };

  /* ─── EXPLORE TAB ─── */
  if (mode === "explore") {
    return (
      <div className="h-full grid grid-cols-1 md:grid-cols-2 gap-3 min-h-0">
        {/* Rose Chart — LEFT */}
        <div className="flex flex-col min-h-[300px] md:min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden relative">
          <LoadingBar isLoading={isRefreshing} />
          <div className="shrink-0 py-2.5 px-4 border-b border-gray-100 flex items-center gap-2">
            <PieChart size={14} className="text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Rose Chart</span>
            {isRefreshing && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
          </div>
          <div className={`flex-1 relative bg-gray-50/50 transition-opacity duration-200 ${isRefreshing ? "opacity-50" : ""}`}>
            <canvas
              ref={roseCanvasRef}
              className={`preview-canvas ${showCanvas ? "visible" : ""}`}
            />
            {renderOverlay()}
          </div>
        </div>

        {/* Map — RIGHT */}
        <div className="flex flex-col min-h-[300px] md:min-h-0 bg-white border border-gray-200 rounded-lg overflow-hidden relative">
          <LoadingBar isLoading={isRefreshing} />
          <div className="shrink-0 py-2.5 px-4 border-b border-gray-100 flex items-center gap-2">
            <Map size={14} className="text-gray-400" />
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Street Network Map</span>
            {isRefreshing && <Loader2 size={12} className="animate-spin text-gray-400 ml-auto" />}
          </div>
          <div className={`flex-1 relative bg-gray-50/50 overflow-hidden transition-opacity duration-200 ${isRefreshing ? "opacity-50" : ""}`} {...canvasInteractionProps}>
            <canvas
              ref={mapCanvasRef}
              className={`preview-canvas ${showCanvas ? "visible" : ""}`}
            />
            {renderOverlay()}
          </div>
        </div>
      </div>
    );
  }

  /* ─── PRINT TAB ─── */
  return (
    <div className="h-full flex flex-col md:flex-row gap-4 min-h-0">
      {/* Editor Sidebar */}
      <div className="flex flex-col w-full md:w-[300px] lg:w-[340px] shrink-0 bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="shrink-0 py-3 px-4 border-b border-gray-100 flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">Poster Editor</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Layout Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-2">
              <Map size={12} /> Layout
            </h3>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Orientation</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={printConfig.orientation === "portrait" ? "default" : "outline"}
                  size="sm"
                  className="text-sm h-8"
                  onClick={() => onPrintConfigChange({ orientation: "portrait" })}
                >
                  Portrait
                </Button>
                <Button
                  variant={printConfig.orientation === "landscape" ? "default" : "outline"}
                  size="sm"
                  className="text-sm h-8"
                  onClick={() => onPrintConfigChange({ orientation: "landscape" })}
                >
                  Landscape
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Chart Placement</Label>
              <select 
                className="flex h-9 w-full rounded-md border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gray-400"
                value={printConfig.rosePosition}
                onChange={(e) => onPrintConfigChange({ rosePosition: e.target.value })}
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
                <option value="top-right">Top Right</option>
                <option value="top-left">Top Left</option>
                <option value="center">Center</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            
            {printConfig.rosePosition !== "hidden" && (
              <ControlGroup
                label="Chart Size"
                value={printConfig.roseSizePercent}
                min={15} max={60} step={1}
                onChange={(value) => onPrintConfigChange({ roseSizePercent: value })}
              />
            )}
          </div>

          <hr className="border-gray-100" />

          {/* Typography Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-2">
              <Type size={12} /> Typography
            </h3>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Custom Title</Label>
              <Input 
                placeholder={cityName.toUpperCase()} 
                value={printConfig.title || ""}
                onChange={(e) => onPrintConfigChange({ title: e.target.value })}
                className="text-sm bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium text-gray-700">Custom Subtitle</Label>
              <Input 
                placeholder="Coordinates (Default)" 
                value={printConfig.subtitle || ""}
                onChange={(e) => onPrintConfigChange({ subtitle: e.target.value })}
                className="text-sm bg-white"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Styling Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-2">
              <Palette size={12} /> Theme
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "light", label: "Classic Light", bg: "#fdfdfb", color: "#0f172a" },
                { id: "dark", label: "Midnight", bg: "#0f172a", color: "#f8fafc" },
                { id: "blueprint", label: "Blueprint", bg: "#1e3a8a", color: "#ffffff" },
                { id: "monochrome", label: "Monochrome", bg: "#ffffff", color: "#000000" }
              ].map((theme) => (
                <button
                  key={theme.id}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
                    printConfig.theme === theme.id 
                      ? 'border-gray-400 bg-gray-50 ring-1 ring-gray-300' 
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                  onClick={() => onPrintConfigChange({ theme: theme.id })}
                >
                  <div 
                    className="w-4 h-4 rounded-full border border-gray-300" 
                    style={{ backgroundColor: theme.bg }}
                  >
                    <div className="w-2 h-2 rounded-full m-auto mt-1" style={{ backgroundColor: theme.color }} />
                  </div>
                  {theme.label}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Advanced / Map Tweaks */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Advanced
            </h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Drag and scroll on the poster canvas to pan and zoom the map.
            </p>
            <ControlGroup
              label="Fine-tune Zoom"
              value={printConfig.mapZoom}
              min={0.5} max={5} step={0.05}
              onChange={(value) => onPrintConfigChange({ mapZoom: value })}
            />
          </div>

          <Button
            variant="ghost"
            className="w-full text-xs font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 h-9"
            onClick={onResetPrintConfig}
          >
            <RefreshCw size={12} className="mr-2" />
            Reset Defaults
          </Button>
        </div>
      </div>

      {/* Poster Preview Area */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        <div className="flex-1 relative flex items-center justify-center p-4 lg:p-6 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
          <LoadingBar isLoading={isRefreshing} />
          <div 
            className={`relative bg-white shadow-lg transition-all duration-300 ${
              printConfig.orientation === "portrait" ? "aspect-[4/5] h-full" : "aspect-[10/7] w-full"
            } ${isRefreshing ? "opacity-50" : ""}`}
            style={{ 
              maxHeight: '100%', 
              maxWidth: '100%',
              borderRadius: '2px',
              ...canvasInteractionProps.style
            }}
            onWheel={canvasInteractionProps.onWheel}
            onPointerDown={canvasInteractionProps.onPointerDown}
            onPointerMove={canvasInteractionProps.onPointerMove}
            onPointerUp={canvasInteractionProps.onPointerUp}
            onPointerLeave={canvasInteractionProps.onPointerLeave}
          >
            <canvas
              ref={printCanvasRef}
              width={posterDimensions.width}
              height={posterDimensions.height}
              className={`w-full h-full object-contain transition-opacity duration-300 ${showCanvas ? "opacity-100" : "opacity-0"}`}
            />
            {renderOverlay()}
          </div>

          {showCanvas && (
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {isRefreshing && (
                <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5 bg-white/90 px-2 py-1 rounded">
                  <Loader2 size={12} className="animate-spin" />
                  Loading…
                </span>
              )}
              <Button
                size="sm"
                className="shadow-md bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs h-8 px-4"
                onClick={onDownload}
                disabled={isRefreshing}
              >
                <Download size={14} className="mr-2" />
                Export {cityName}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
