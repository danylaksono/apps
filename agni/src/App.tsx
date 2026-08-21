import { useEffect } from "react";
import { ChartLine, Stack, X } from "@phosphor-icons/react";
import MapView from "./components/MapView";
import LayerPanel from "./components/LayerPanel";
import BasemapSwitcher from "./components/BasemapSwitcher";
import KpiBar from "./components/KpiBar";
import CamsTimeline from "./components/CamsTimeline";
import RasterTimeline from "./components/RasterTimeline";
import DashboardRail from "./components/DashboardRail";
import { useFirms } from "./lib/firms";
import { useForestTagging } from "./lib/forestTag";
import { useIsCompact } from "./lib/useMedia";
import { useLayersStore } from "./store/layers";

function Tab({
  on,
  onClick,
  icon: Icon,
  label,
}: {
  on: boolean;
  onClick: () => void;
  icon: typeof Stack;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors ${
        on ? "bg-fire-400/20 text-fire-300" : "text-ink-300"
      }`}
    >
      {on ? <X size={14} weight="bold" /> : <Icon size={14} weight="duotone" />}
      {label}
    </button>
  );
}

/** Phone toolbar. On a small screen the two panels cover the map, so they are
 *  closed by default and only one can be open at a time — this is the control
 *  that swaps between them. On desktop it is not rendered at all. */
function MobileBar() {
  const layersOpen = useLayersStore((s) => s.layersOpen);
  const railOpen = useLayersStore((s) => s.railOpen);
  const setLayersOpen = useLayersStore((s) => s.setLayersOpen);
  const setRailOpen = useLayersStore((s) => s.setRailOpen);

  const show = (which: "layers" | "rail") => {
    if (which === "layers") {
      setRailOpen(false);
      setLayersOpen(!layersOpen);
    } else {
      setLayersOpen(false);
      setRailOpen(!railOpen);
    }
  };

  return (
    <nav className="pointer-events-auto absolute inset-x-2 bottom-2 z-30 flex gap-1 rounded-xl border border-ink-700/60 bg-ink-900/95 p-1 shadow-2xl backdrop-blur md:hidden">
      <Tab
        on={layersOpen}
        onClick={() => show("layers")}
        icon={Stack}
        label="Layers"
      />
      <Tab
        on={railOpen}
        onClick={() => show("rail")}
        icon={ChartLine}
        label="Charts"
      />
    </nav>
  );
}

export default function App() {
  useFirms();
  useForestTagging();
  const compact = useIsCompact();
  const setLayersOpen = useLayersStore((s) => s.setLayersOpen);
  const setRailOpen = useLayersStore((s) => s.setRailOpen);

  // Crossing the breakpoint resets to that layout's sensible default: both
  // panels open on a desktop, neither on a phone where they would hide the map.
  useEffect(() => {
    setLayersOpen(!compact);
    setRailOpen(!compact);
  }, [compact, setLayersOpen, setRailOpen]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView />
      <LayerPanel />
      <BasemapSwitcher />
      <DashboardRail />
      <CamsTimeline />
      <RasterTimeline />
      <KpiBar />
      <MobileBar />
    </div>
  );
}
