import { useState, useEffect, useSyncExternalStore } from 'react';
import { fetchDirections } from '../nav/directions';
import {
  subscribe, getStore, setTravelMode, setRoutes, selectRoute,
  startNavigation, setError
} from '../state/nav-state';
import { startTracking } from '../nav/route-tracker';
import { initGlassesDisplay } from '../glasses/renderer';
import { formatDuration, formatDistance, formatTime } from '../utils/time';
import type { TravelMode, NavRoute, NavStep } from '../state/types';

interface Props {
  bridge: any;
  onBack: () => void;
  onStartNav: () => void;
}

export default function RouteSelectScreen({ bridge, onBack, onStartNav }: Props) {
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const modes: { key: TravelMode; label: string }[] = [
    { key: 'walking', label: 'Walking' },
    { key: 'bicycling', label: 'Cycling' },
    { key: 'transit', label: 'Transit' },
  ];

  const fetchRoutes = async (mode: TravelMode) => {
    if (!store.origin || !store.destination) return;
    setLoading(true);
    setError(null);
    setSelectedIndex(0);

    try {
      const routes = await fetchDirections(
        store.origin,
        store.destination.location,
        mode,
        store.apiKey
      );
      setRoutes(routes);
      if (routes.length > 0) {
        selectRoute(routes[0]);
      }
    } catch (err: any) {
      setError(err.message);
      setRoutes([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch routes when screen mounts or mode changes
  useEffect(() => {
    fetchRoutes(store.travelMode);
  }, [store.travelMode]);

  const handleModeChange = (mode: TravelMode) => {
    setTravelMode(mode);
  };

  const handleSelectRoute = (route: NavRoute, index: number) => {
    setSelectedIndex(index);
    selectRoute(route);
  };

  const handleStartNav = () => {
    if (!store.route) return;

    // Start GPS tracking — abort if geolocation is unavailable
    const gpsAvailable = startTracking(store.route);
    if (!gpsAvailable) {
      setError('GPS is not available. Navigation requires location access. Please check that the Even Realities app has location permission enabled.');
      return;
    }

    // Initialize glasses display
    if (bridge) {
      initGlassesDisplay(bridge, store.route, store.travelMode);
    }

    startNavigation();
    onStartNav();
  };

  const getTransitInfo = (route: NavRoute) => {
    const transitSteps = route.legs.flatMap(l => l.steps).filter(s => s.travelMode === 'TRANSIT');
    return transitSteps.map(s => ({
      line: s.transitDetails?.lineShortName || s.transitDetails?.lineName || '?',
      type: s.transitDetails?.vehicleType || 'TRANSIT',
    }));
  };

  const getVehicleLabel = (type: string) => {
    switch (type) {
      case 'BUS': return 'Bus';
      case 'SUBWAY': return 'Metro';
      case 'TRAM': return 'Tram';
      case 'HEAVY_RAIL': case 'RAIL': case 'COMMUTER_TRAIN': return 'Train';
      default: return 'Transit';
    }
  };

  const renderStepBreakdown = (route: NavRoute) => {
    const steps = route.legs.flatMap(l => l.steps);
    return (
      <div className="route-breakdown">
        {steps.map((step: NavStep, j: number) => (
          <div key={j} className="route-segment">
            <div className="segment-indicator">
              <div className={`segment-dot ${step.travelMode === 'TRANSIT' ? 'transit' : 'walk'}`} />
              {j < steps.length - 1 && <div className="segment-line" />}
            </div>
            <div className="segment-content">
              {step.travelMode === 'TRANSIT' && step.transitDetails ? (
                <>
                  <div className="segment-header">
                    <span className="segment-vehicle">
                      {getVehicleLabel(step.transitDetails.vehicleType)} {step.transitDetails.lineShortName || step.transitDetails.lineName}
                    </span>
                    <span className="segment-duration">{formatDuration(step.duration)}</span>
                  </div>
                  <div className="segment-detail">
                    {step.transitDetails.departureStop}
                    {step.transitDetails.departureTime > 0 && (
                      <span className="segment-time"> at {formatTime(step.transitDetails.departureTime)}</span>
                    )}
                  </div>
                  <div className="segment-detail">
                    → {step.transitDetails.arrivalStop} ({step.transitDetails.numStops} stops)
                  </div>
                  <div className="segment-detail" style={{ color: '#666' }}>
                    Toward {step.transitDetails.headsign}
                  </div>
                </>
              ) : (
                <>
                  <div className="segment-header">
                    <span className="segment-walk">Walk</span>
                    <span className="segment-duration">{formatDuration(step.duration)}</span>
                  </div>
                  <div className="segment-detail">
                    {step.instruction} ({formatDistance(step.distance)})
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="screen">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="screen-title">Select Route</p>
        <button className="btn btn-secondary btn-small" onClick={onBack}>Back</button>
      </div>

      <div style={{ fontSize: 13, color: '#888' }}>
        To: {store.destination?.name}
      </div>

      <div className="mode-tabs">
        {modes.map(m => (
          <button
            key={m.key}
            className={`mode-tab ${store.travelMode === m.key ? 'active' : ''}`}
            onClick={() => handleModeChange(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="loading">
          <div className="loading-spinner" />
          <p style={{ marginTop: 8 }}>Finding routes...</p>
        </div>
      )}

      {!loading && store.routes.length === 0 && !store.error && (
        <div className="loading">No routes found</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {store.routes.map((route, i) => (
          <div
            key={i}
            className={`route-card ${selectedIndex === i ? 'selected' : ''}`}
            onClick={() => handleSelectRoute(route, i)}
          >
            <div className="route-card-header">
              <span className="route-duration">{formatDuration(route.duration)}</span>
              <span className="route-distance">{formatDistance(route.distance)}</span>
            </div>
            <div className="route-summary">
              {route.summary || `Route ${i + 1}`}
            </div>
            {store.travelMode === 'transit' && (
              <div className="route-transit-info">
                {getTransitInfo(route).map((t, j) => (
                  <span key={j} className="transit-badge">
                    {t.type === 'BUS' ? 'Bus' : t.type === 'SUBWAY' ? 'Metro' : 'Train'} {t.line}
                  </span>
                ))}
              </div>
            )}
            {store.travelMode === 'transit' && selectedIndex === i && renderStepBreakdown(route)}
          </div>
        ))}
      </div>

      {store.routes.length > 0 && (
        <button className="btn" onClick={handleStartNav}>
          Start Navigation
        </button>
      )}
    </div>
  );
}
