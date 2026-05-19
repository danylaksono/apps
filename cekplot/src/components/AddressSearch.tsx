import { LocateFixed, Plus, Search } from 'lucide-react';
import { FormEvent, useRef, useState } from 'react';
import { searchAddress } from '../services/geocoder';
import { usePlannerStore } from '../store/usePlannerStore';
import type { GeocodeResult } from '../types';
import { formatCoordinate } from '../utils/csv';

export function AddressSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const setOrigin = usePlannerStore((state) => state.setOrigin);
  const addTarget = usePlannerStore((state) => state.addTarget);
  const focusLocation = usePlannerStore((state) => state.focusLocation);
  const setError = usePlannerStore((state) => state.setError);

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      setIsSearching(true);
      setError(null);
      const nextResults = await searchAddress(query, controller.signal);
      setResults(nextResults);
      if (nextResults.length === 0) {
        setError('No matching address found in the Makassar search area.');
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : 'Unable to search for that address.');
    } finally {
      setIsSearching(false);
    }
  }

  function useResult(result: GeocodeResult, role: 'origin' | 'target') {
    const point = {
      name: result.label.split(',')[0] || 'Search result',
      lat: result.lat,
      lng: result.lng,
    };

    if (role === 'origin') {
      setOrigin(point);
    } else {
      addTarget(point);
    }

    focusLocation({ id: result.id, ...point });
    setQuery(point.name);
    setResults([]);
    setError(null);
  }

  return (
    <div className="address-search">
      <form className="search-form" onSubmit={handleSearch}>
        <label className="field search-field">
          <span>Address search</span>
          <div className="search-input-row">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search an address or place"
              autoComplete="off"
            />
            <button type="submit" className="icon-button" disabled={isSearching || query.trim().length < 3} aria-label="Search address">
              <Search size={16} aria-hidden="true" />
            </button>
          </div>
        </label>
      </form>

      {results.length > 0 && (
        <div className="search-results" aria-label="Address search results">
          {results.map((result) => (
            <article key={result.id} className="search-result">
              <div>
                <strong>{result.label}</strong>
                <span>
                  {formatCoordinate(result.lat)}, {formatCoordinate(result.lng)}
                  {result.category ? ` · ${result.category}` : ''}
                </span>
              </div>
              <div className="search-result-actions">
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => useResult(result, 'origin')}
                  aria-label={`Set ${result.label} as origin`}
                  title="Set as origin"
                >
                  <LocateFixed size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-button"
                  onClick={() => useResult(result, 'target')}
                  aria-label={`Add ${result.label} as target`}
                  title="Add as target"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* <p className="hint">
        Search results by Nominatim and OpenStreetMap. Searches are user-triggered and limited for the public service.
      </p> */}
    </div>
  );
}
