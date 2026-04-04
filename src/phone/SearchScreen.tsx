import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { searchPlaces, getPlaceLocation, reverseGeocode } from '../nav/places';
import { setOrigin, setDestination, subscribe, getStore } from '../state/nav-state';
import type { PlacePrediction } from '../state/types';

interface Props {
  onRouteSearch: () => void;
}

export default function SearchScreen({ onRouteSearch }: Props) {
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [originAddress, setOriginAddress] = useState('');
  const [searchError, setSearchError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Get current location on mount
  useEffect(() => {
    if (store.origin) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [store.origin]);

  // Reverse geocode when origin is set
  useEffect(() => {
    if (!store.origin || !store.apiKey) return;
    reverseGeocode(store.origin, store.apiKey)
      .then(address => setOriginAddress(address))
      .catch(() => setOriginAddress(`${store.origin!.lat.toFixed(4)}, ${store.origin!.lng.toFixed(4)}`));
  }, [store.origin, store.apiKey]);

  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearchError('');
        console.log('[SearchScreen] Searching for:', value, 'apiKey present:', !!store.apiKey);
        const results = await searchPlaces(value, store.apiKey, store.origin ?? undefined);
        console.log('[SearchScreen] Got results:', results.length);
        setSuggestions(results);
      } catch (e: any) {
        console.error('Search error:', e);
        setSearchError(e.message || 'Search failed');
      }
    }, 300);
  };

  const handleSelectPlace = async (prediction: PlacePrediction) => {
    setLoading(true);
    setSuggestions([]);
    setQuery(prediction.mainText);

    try {
      const place = await getPlaceLocation(prediction.placeId, store.apiKey);
      setDestination({ name: place.name, location: place.location });
      onRouteSearch();
    } catch (e: any) {
      console.error('Place details error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <p className="screen-title">Where to?</p>

      <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        {gpsLoading ? 'Getting your location...' :
          originAddress ? `From: ${originAddress}` :
          store.origin ? `From: ${store.origin.lat.toFixed(4)}, ${store.origin.lng.toFixed(4)}` :
          'Location unavailable'}
      </div>

      <div className="input-group">
        <label>Destination</label>
        <input
          type="text"
          className="text-input"
          placeholder="Search for a place..."
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          autoFocus
        />
      </div>

      {searchError && <div className="error-banner">{searchError}</div>}

      {loading && (
        <div className="loading">
          <div className="loading-spinner" />
        </div>
      )}

      {suggestions.length > 0 && (
        <ul className="suggestion-list">
          {suggestions.map(s => (
            <li
              key={s.placeId}
              className="suggestion-item"
              onClick={() => handleSelectPlace(s)}
            >
              <div className="suggestion-main">{s.mainText}</div>
              {s.secondaryText && (
                <div className="suggestion-secondary">{s.secondaryText}</div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
