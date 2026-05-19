import { MapView } from './components/MapView';
import { PlannerPanel } from './components/PlannerPanel';
import { SettingsPanel } from './components/SettingsPanel';

export default function App() {
  return (
    <div className="app-shell">
      <PlannerPanel />
      <MapView />
      <SettingsPanel floating />
    </div>
  );
}
