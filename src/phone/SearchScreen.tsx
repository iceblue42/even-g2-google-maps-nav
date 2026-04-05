import { useState, useEffect, useRef, useSyncExternalStore } from 'react';
import { searchPlaces, getPlaceLocation, reverseGeocode } from '../nav/places';
import { getLocation } from '../nav/geolocation';
import { setOrigin, setDestination, subscribe, getStore } from '../state/nav-state';
import type { PlacePrediction } from '../state/types';

interface Props {
  onRouteSearch: () => void;
}

export default function SearchScreen({ onRouteSearch }: Props) {
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const [query, setQuery] = useState('');
  const [originQuery, setOriginQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlacePrediction[]>([]);
  const [originSuggestions, setOriginSuggestions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [originAddress, setOriginAddress] = useState('');
  const [searchError, setSearchError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [showOriginSearch, setShowOriginSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const originDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Try to get GPS location
  const tryGetLocation = () => {
    setGpsLoading(true);
    setLocationError('');

    getLocation()
      .then(pos => {
        setOrigin(pos);
        setLocationError('');
        setGpsLoading(false);
        setShowOriginSearch(false);
      })
      .catch(err => {
        setLocationError(err.message || 'Could not get GPS location.');
        setGpsLoading(false);
        setShowOriginSearch(true);
      });
  };

  useEffect(() => {
    if (store.origin) return;
    tryGetLocation();
  }, [store.origin]);

  // Reverse geocode when origin is set
  useEffect(() => {
    if (!store.origin || !store.apiKey) return;
    reverseGeocode(store.origin, store.apiKey)
      .then(address => setOriginAddress(address))
      .catch(() => setOriginAddress(`${store.origin!.lat.toFixed(4)}, ${store.origin!.lng.toFixed(4)}`));
  }, [store.origin, store.apiKey]);

  // Destination search
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        setSearchError('');
        const results = await searchPlaces(value, store.apiKey, store.origin ?? undefined);
        setSuggestions(results);
      } catch (e: any) {
        setSearchError(e.message || 'Search failed');
      }
    }, 300);
  };

  // Origin search
  const handleOriginQueryChange = (value: string) => {
    setOriginQuery(value);
    if (originDebounceRef.current) clearTimeout(originDebounceRef.current);
    if (value.length < 3) { setOriginSuggestions([]); return; }

    originDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPlaces(value, store.apiKey);
        setOriginSuggestions(results);
      } catch (_e) { /* ignore */ }
    }, 300);
  };

  const handleSelectOrigin = async (prediction: PlacePrediction) => {
    setOriginSuggestions([]);
    setOriginQuery(prediction.mainText);
    try {
      const place = await getPlaceLocation(prediction.placeId, store.apiKey);
      setOrigin(place.location);
      setOriginAddress(place.name);
      setLocationError('');
      setShowOriginSearch(false);
    } catch (e: any) {
      setLocationError(`Could not get location details: ${e.message || 'Unknown error'}`);
    }
  };

  const handleSelectPlace = async (prediction: PlacePrediction) => {
    setLoading(true);
    setSuggestions([]);
    setQuery(prediction.mainText);

    try {
      const place = await getPlaceLocation(prediction.placeId, store.apiKey);
      setDestination({ name: place.name, location: place.location });
      if (!store.origin) {
        setSearchError('Please set your starting location first.');
        return;
      }
      onRouteSearch();
    } catch (e: any) {
      setSearchError(`Could not get place details: ${e.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen">
      <p className="screen-title">Where to?</p>

      {/* Origin display */}
      <div style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        {gpsLoading ? 'Getting your location...' :
          originAddress ? `From: ${originAddress}` :
          store.origin ? `From: ${store.origin.lat.toFixed(4)}, ${store.origin.lng.toFixed(4)}` :
          'Starting location not set'}
      </div>

      {/* Origin controls: change / retry */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowOriginSearch(!showOriginSearch)}
          style={{ flex: 1 }}
        >
          {store.origin ? 'Change start' : 'Set start location'}
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={tryGetLocation}
          disabled={gpsLoading}
          style={{ flex: 1 }}
        >
          {gpsLoading ? 'Locating...' : 'Use GPS'}
        </button>
      </div>

      {locationError && <div className="error-banner">{locationError}</div>}

      {/* Origin search input */}
      {showOriginSearch && (
        <>
          <div className="input-group">
            <label>Starting location</label>
            <input
              type="text"
              className="text-input"
              placeholder="Search for your current location..."
              value={originQuery}
              onChange={e => handleOriginQueryChange(e.target.value)}
              autoFocus
            />
          </div>
          {originSuggestions.length > 0 && (
            <ul className="suggestion-list">
              {originSuggestions.map(s => (
                <li key={s.placeId} className="suggestion-item" onClick={() => handleSelectOrigin(s)}>
                  <div className="suggestion-main">{s.mainText}</div>
                  {s.secondaryText && <div className="suggestion-secondary">{s.secondaryText}</div>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Destination search */}
      <div className="input-group">
        <label>Destination</label>
        <input
          type="text"
          className="text-input"
          placeholder="Search for a place..."
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
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
            <li key={s.placeId} className="suggestion-item" onClick={() => handleSelectPlace(s)}>
              <div className="suggestion-main">{s.mainText}</div>
              {s.secondaryText && <div className="suggestion-secondary">{s.secondaryText}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
