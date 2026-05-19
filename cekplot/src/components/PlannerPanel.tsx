import { FileUp, LocateFixed, MapPin, Navigation, RotateCcw, Wand2 } from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { optimiseStops, fetchDirections } from '../services/orsClient';
import { usePlannerStore } from '../store/usePlannerStore';
import type { LocationPoint } from '../types';
import { parseLocationsCsv, formatDistance, formatDuration } from '../utils/csv';
import { StopList } from './StopList';
import { AddressSearch } from './AddressSearch';

const MAX_TARGET_STOPS = 49;

export function PlannerPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvText, setCsvText] = useState('');
  const origin = usePlannerStore((state) => state.origin);
  const targets = usePlannerStore((state) => state.targets);
  const orderedStops = usePlannerStore((state) => state.orderedStops);
  const placementMode = usePlannerStore((state) => state.placementMode);
  const profile = usePlannerStore((state) => state.profile);
  const status = usePlannerStore((state) => state.status);
  const error = usePlannerStore((state) => state.error);
  const routeSummary = usePlannerStore((state) => state.routeSummary);
  const setPlacementMode = usePlannerStore((state) => state.setPlacementMode);
  const addTargets = usePlannerStore((state) => state.addTargets);
  const clearTargets = usePlannerStore((state) => state.clearTargets);
  const setOrderedStops = usePlannerStore((state) => state.setOrderedStops);
  const setRoute = usePlannerStore((state) => state.setRoute);
  const setStatus = usePlannerStore((state) => state.setStatus);
  const setError = usePlannerStore((state) => state.setError);
  const getEffectiveApiKey = usePlannerStore((state) => state.getEffectiveApiKey);

  const orderedTargets = useMemo(
    () =>
      orderedStops
        .map((id) => targets.find((target) => target.id === id))
        .filter((target): target is LocationPoint => Boolean(target)),
    [orderedStops, targets],
  );

  const canRequestRoute = Boolean(origin && orderedTargets.length > 0 && status === 'idle');

  function importCsv(text: string) {
    const parsed = parseLocationsCsv(text);
    if (parsed.length === 0) {
      setError('No valid coordinates found. Use name,lat,lng or lat,lng rows.');
      return;
    }

    addTargets(
      parsed.map((location, index) => ({
        name: location.name || `Imported stop ${index + 1}`,
        lat: location.lat,
        lng: location.lng,
      })),
    );
    setCsvText('');
    setError(null);
  }

  async function handleFileImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    importCsv(text);
    event.target.value = '';
  }

  async function optimise() {
    if (!origin) {
      setError('Set an origin before optimising.');
      return;
    }
    if (targets.length > MAX_TARGET_STOPS) {
      setError(`Keep this plan to ${MAX_TARGET_STOPS} target stops or fewer for ORS public routing limits.`);
      return;
    }

    try {
      setStatus('optimising');
      setError(null);
      const result = await optimiseStops({
        origin,
        targets,
        apiKey: getEffectiveApiKey(),
        profile,
      });
      setOrderedStops(result.orderedIds);
      if (result.summary) {
        setError(`Optimised ${targets.length} stops. Request directions to draw the route.`);
      }
    } catch (caught) {
      console.error('Optimise failed:', caught);
      setError(caught instanceof Error ? caught.message : 'Unable to optimise the route.');
    } finally {
      setStatus('idle');
    }
  }

  async function route() {
    if (!origin || orderedTargets.length === 0) {
      setError('Set an origin and at least one stop before routing.');
      return;
    }
    if (orderedTargets.length > MAX_TARGET_STOPS) {
      setError(`Keep this plan to ${MAX_TARGET_STOPS} target stops or fewer for ORS public routing limits.`);
      return;
    }

    try {
      setStatus('routing');
      setError(null);
      const coordinates: Array<[number, number]> = [
        [origin.lng, origin.lat],
        ...orderedTargets.map((target) => [target.lng, target.lat] as [number, number]),
      ];
      const result = await fetchDirections({
        coordinates,
        apiKey: getEffectiveApiKey(),
        profile,
      });
      setRoute(result.geoJson, {
        distanceMeters: result.distanceMeters,
        durationSeconds: result.durationSeconds,
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to fetch route directions.');
    } finally {
      setStatus('idle');
    }
  }

  return (
    <aside className="planner-panel" aria-label="Route planner controls">
      <header className="brand-panel">
        <div>
          <h1>Cekplot</h1>
          <p>Optimise a stop order, then route through Makassar.</p>
        </div>
        <span className="city-chip">Makassar</span>
      </header>

      <section className="panel-section">
        <div className="section-title">
          <LocateFixed size={16} aria-hidden="true" />
          <h2>Map input</h2>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Map click mode">
          <button
            type="button"
            className={placementMode === 'origin' ? 'active' : ''}
            onClick={() => setPlacementMode('origin')}
            role="radio"
            aria-checked={placementMode === 'origin'}
          >
            Origin
          </button>
          <button
            type="button"
            className={placementMode === 'target' ? 'active' : ''}
            onClick={() => setPlacementMode('target')}
            role="radio"
            aria-checked={placementMode === 'target'}
          >
            Target
          </button>
        </div>
        <AddressSearch />
      </section>

      <section className="panel-section">
        <div className="section-title">
          <FileUp size={16} aria-hidden="true" />
          <h2>Import stops</h2>
        </div>
        <textarea
          value={csvText}
          onChange={(event) => setCsvText(event.target.value)}
          rows={4}
          placeholder={'name,lat,lng\nFort Rotterdam,-5.13439,119.40574'}
        />
        <div className="button-row">
          <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
            Upload CSV
          </button>
          <button type="button" className="secondary-button" onClick={() => importCsv(csvText)} disabled={!csvText.trim()}>
            Import text
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept=".csv,text/csv,text/plain" onChange={handleFileImport} hidden />
      </section>

      <section className="panel-section grow">
        <div className="section-title">
          <Navigation size={16} aria-hidden="true" />
          <h2>Stops</h2>
          <span className="count-pill">{orderedTargets.length}</span>
        </div>
        <StopList />
      </section>

      <section className="action-panel">
        {routeSummary && (
          <div className="route-summary">
            <span>{formatDistance(routeSummary.distanceMeters)}</span>
            <span>{formatDuration(routeSummary.durationSeconds)}</span>
          </div>
        )}
        {error && <div className={error.startsWith('Optimised') ? 'notice' : 'error-box'}>{error}</div>}
        <div className="button-row">
          <button type="button" className="primary-button" onClick={optimise} disabled={!canRequestRoute}>
            <Wand2 size={16} aria-hidden="true" />
            {status === 'optimising' ? 'Optimising' : 'Optimise'}
          </button>
          <button type="button" className="primary-button dark" onClick={route} disabled={!canRequestRoute}>
            <Navigation size={16} aria-hidden="true" />
            {status === 'routing' ? 'Routing' : 'Route'}
          </button>
          <button type="button" className="icon-button reset" onClick={clearTargets} aria-label="Clear all stops">
            <RotateCcw size={16} aria-hidden="true" />
          </button>
        </div>
      </section>

    </aside>
  );
}
