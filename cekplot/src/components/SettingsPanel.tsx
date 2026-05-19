import { KeyRound, Route, Settings, X, Save } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { usePlannerStore } from '../store/usePlannerStore';
import type { RoutingProfile } from '../types';

const profiles: Array<{ id: RoutingProfile; label: string }> = [
  { id: 'driving-car', label: 'Car' },
  { id: 'driving-hgv', label: 'HGV' },
  { id: 'cycling-regular', label: 'Cycle' },
  { id: 'foot-walking', label: 'Walk' },
];

interface SettingsPanelProps {
  floating?: boolean;
}

export function SettingsPanel({ floating = false }: SettingsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const titleId = floating ? 'floating-settings-title' : 'settings-title';
  const apiKey = usePlannerStore((state) => state.apiKey);
  const hasFallbackApiKey = usePlannerStore((state) => state.hasFallbackApiKey);
  const profile = usePlannerStore((state) => state.profile);
  const setApiKey = usePlannerStore((state) => state.setApiKey);
  const setProfile = usePlannerStore((state) => state.setProfile);

  const [draftKey, setDraftKey] = useState(apiKey);

  useEffect(() => {
    setDraftKey(apiKey);
  }, [apiKey]);

  function handleSaveKey() {
    setApiKey(draftKey);
    setToastMessage('API key saved to local storage.');
    
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  }

  const panelContent = (
    <section className={floating ? 'settings-panel floating-content' : 'panel-section settings-panel'} aria-labelledby={titleId}>
      <div className="section-title">
        <KeyRound size={16} aria-hidden="true" />
        <h2 id={titleId}>Settings</h2>
        {floating && (
          <button type="button" className="icon-button close-settings" onClick={() => setIsOpen(false)} aria-label="Close settings">
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="field">
        <span>OpenRouteService API key</span>
        <div className="key-input-row">
          <input
            value={draftKey}
            onChange={(event) => setDraftKey(event.target.value)}
            placeholder={hasFallbackApiKey ? 'Using deployed fallback key' : 'Paste your ORS key'}
            type="password"
            autoComplete="off"
          />
          <button type="button" className="secondary-button" onClick={handleSaveKey}>
            <Save size={16} aria-hidden="true" />
            Save
          </button>
        </div>
      </div>
      <p className="hint">
        Keys are stored locally in this browser. A deployed fallback key should be referrer-restricted.
      </p>

      <div className="field">
        <span className="field-label">
          <Route size={15} aria-hidden="true" />
          Routing profile
        </span>
        <div className="segmented compact" role="radiogroup" aria-label="Routing profile">
          {profiles.map((item) => (
            <button
              key={item.id}
              type="button"
              className={profile === item.id ? 'active' : ''}
              onClick={() => setProfile(item.id)}
              role="radio"
              aria-checked={profile === item.id}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

    </section>
  );

  if (!floating) {
    return panelContent;
  }

  return (
    <div className={`floating-settings ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="floating-settings-trigger"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        aria-controls="floating-settings-panel"
        aria-label={isOpen ? 'Close settings' : 'Open settings'}
      >
        <Settings size={18} aria-hidden="true" />
      </button>
      <div id="floating-settings-panel" className="floating-settings-panel" hidden={!isOpen}>
        {panelContent}
      </div>
      {toastMessage && (
        <div className="toast-notification" role="status">
          {toastMessage}
        </div>
      )}
    </div>
  );
}
