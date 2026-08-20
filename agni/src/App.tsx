import MapView from "./components/MapView";
import LayerPanel from "./components/LayerPanel";
import BasemapSwitcher from "./components/BasemapSwitcher";
import KpiBar from "./components/KpiBar";
import DashboardRail from "./components/DashboardRail";
import CamsTimeline from "./components/CamsTimeline";
import { useFirms } from "./lib/firms";

export default function App() {
  useFirms();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapView />
      <LayerPanel />
      <BasemapSwitcher />
      <DashboardRail />
      <CamsTimeline />
      <KpiBar />
    </div>
  );
}
