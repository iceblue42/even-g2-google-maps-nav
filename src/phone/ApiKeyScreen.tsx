import { useState } from 'react';
import { validateApiKey } from '../nav/places';
import { setApiKey } from '../state/nav-state';

interface Props {
  bridge: any;
  onComplete: () => void;
}

export default function ApiKeyScreen({ bridge, onComplete }: Props) {
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!key.trim()) return;
    setLoading(true);
    setError('');

    const valid = await validateApiKey(key.trim());
    if (!valid) {
      setError('Invalid API key. Please check and try again.');
      setLoading(false);
      return;
    }

    // Persist to both bridge storage and localStorage
    try {
      localStorage.setItem('gmaps_api_key', key.trim());
    } catch (_e) { /* ignore */ }
    if (bridge) {
      try {
        await bridge.setLocalStorage('gmaps_api_key', key.trim());
      } catch (e) {
        console.warn('Could not persist API key to bridge storage:', e);
      }
    }

    setApiKey(key.trim());
    setLoading(false);
    onComplete();
  };

  return (
    <div className="screen">
      <p className="screen-title">Google Maps API Key</p>
      <p style={{ fontSize: 13, color: '#888' }}>
        Enter your Google Maps API key to enable navigation. The key needs Directions, Places, and Geocoding APIs enabled.
      </p>

      <div className="input-group">
        <label>API Key</label>
        <input
          type="text"
          className="text-input"
          placeholder="AIza..."
          value={key}
          onChange={e => setKey(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <button className="btn" onClick={handleSubmit} disabled={loading || !key.trim()}>
        {loading ? 'Validating...' : 'Save & Continue'}
      </button>
    </div>
  );
}
