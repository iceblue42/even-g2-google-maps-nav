import { useState, useEffect, useSyncExternalStore } from 'react';
import { subscribe, getStore, setApiKey as setApiKeyAction } from './state/nav-state';
import ApiKeyScreen from './phone/ApiKeyScreen';
import SearchScreen from './phone/SearchScreen';
import RouteSelectScreen from './phone/RouteSelectScreen';
import ActiveNavScreen from './phone/ActiveNavScreen';

interface AppProps {
  bridge: any;
}

function useNavStore() {
  return useSyncExternalStore(subscribe, getStore, getStore);
}

export default function App({ bridge }: AppProps) {
  const store = useNavStore();
  const [screen, setScreen] = useState<'apikey' | 'search' | 'route' | 'active'>('apikey');

  // Auto-navigate based on state
  useEffect(() => {
    if (store.state === 'NAVIGATING' || store.state === 'RECALCULATING') {
      setScreen('active');
    } else if (store.state === 'ARRIVED') {
      setScreen('search');
    }
  }, [store.state]);

  // Check if API key already stored
  useEffect(() => {
    if (store.apiKey) {
      setScreen('search');
    }
  }, [store.apiKey]);

  // Try to load API key from bridge storage or localStorage on mount
  useEffect(() => {
    // Check localStorage first (works in all contexts)
    try {
      const localKey = localStorage.getItem('gmaps_api_key');
      if (localKey) {
        setApiKeyAction(localKey);
        setScreen('search');
        return;
      }
    } catch (_e) { /* ignore */ }

    // Then check bridge storage (Even Hub context)
    if (!bridge) return;
    bridge.getLocalStorage('gmaps_api_key').then((key: string | null) => {
      if (key) {
        setApiKeyAction(key);
        // Also sync to localStorage
        try { localStorage.setItem('gmaps_api_key', key); } catch (_e) { /* ignore */ }
        setScreen('search');
      }
    }).catch(() => {});
  }, [bridge]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Google Maps Nav</h1>
        {store.error && <div className="error-banner">{store.error}</div>}
      </header>

      <main className="app-main">
        {screen === 'apikey' && (
          <ApiKeyScreen
            bridge={bridge}
            onComplete={() => setScreen('search')}
          />
        )}
        {screen === 'search' && (
          <SearchScreen
            onRouteSearch={() => setScreen('route')}
          />
        )}
        {screen === 'route' && (
          <RouteSelectScreen
            bridge={bridge}
            onBack={() => setScreen('search')}
            onStartNav={() => setScreen('active')}
          />
        )}
        {screen === 'active' && (
          <ActiveNavScreen
            bridge={bridge}
            onStop={() => setScreen('search')}
          />
        )}
      </main>
    </div>
  );
}
