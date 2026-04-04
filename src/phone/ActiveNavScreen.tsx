import { useSyncExternalStore } from 'react';
import { subscribe, getStore, resetNavigation } from '../state/nav-state';
import { stopTracking } from '../nav/route-tracker';
import { resetTransitTracker } from '../nav/transit-tracker';
import { stopEnvironmentUpdates } from '../nav/environment';
import { eventBus, Events } from '../state/events';
import { formatDistance, formatEta } from '../utils/time';

interface Props {
  bridge: any;
  onStop: () => void;
}

export default function ActiveNavScreen({ bridge, onStop }: Props) {
  const store = useSyncExternalStore(subscribe, getStore, getStore);

  const handleStop = () => {
    stopTracking();
    resetTransitTracker();
    stopEnvironmentUpdates();

    if (bridge) {
      try {
        bridge.shutDownPageContainer(0);
      } catch (e) {
        console.warn('Could not shut down glasses display:', e);
      }
    }

    resetNavigation();
    onStop();
  };

  const handleRecalculate = () => {
    eventBus.emit(Events.RECALCULATE_REQUESTED);
  };

  const progress = store.progress;
  const step = progress?.currentStep;
  const allSteps = store.route?.legs.flatMap(l => l.steps) || [];
  const totalSteps = allSteps.length;

  return (
    <div className="screen">
      <p className="screen-title">
        {store.state === 'RECALCULATING' ? 'Recalculating...' : 'Navigating'}
      </p>

      {store.state === 'RECALCULATING' && (
        <div className="loading">
          <div className="loading-spinner" />
        </div>
      )}

      {progress && step && (
        <>
          <div className="nav-info-card">
            <div className="nav-step-text">{step.instruction}</div>
            <div className="nav-distance-text">
              {formatDistance(progress.distanceToStepEnd)}
            </div>
            <div className="nav-eta-text">
              {formatEta(progress.etaTimestamp, progress.etaMinutes)}
            </div>
          </div>

          {step.travelMode === 'TRANSIT' && step.transitDetails && (
            <div className="nav-info-card">
              <div style={{ fontSize: 14, color: '#4ade80' }}>
                {step.transitDetails.vehicleType} {step.transitDetails.lineShortName}
              </div>
              <div style={{ fontSize: 13, color: '#aaa' }}>
                {step.transitDetails.departureStop} → {step.transitDetails.arrivalStop}
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>
                {step.transitDetails.numStops} stops
              </div>
              {store.transitSubState === 'ON_VEHICLE' && store.alertLevel !== 'none' && (
                <div style={{
                  fontSize: 16,
                  fontWeight: 'bold',
                  color: store.alertLevel === 'now' ? '#ef4444' :
                         store.alertLevel === 'imminent' ? '#f59e0b' : '#4ade80',
                  marginTop: 8,
                }}>
                  {store.alertLevel === 'now' ? 'GET OFF NOW!' :
                   store.alertLevel === 'imminent' ? 'NEXT STOP — GET READY!' :
                   'Approaching your stop'}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: 13, color: '#888' }}>
            Step {progress.currentStepIndex + 1}/{totalSteps} | {formatDistance(progress.totalRemainingDistance)} remaining
          </div>

          {progress.isOffRoute && (
            <div className="error-banner">You appear to be off route</div>
          )}
        </>
      )}

      {store.environment && (
        <div className="nav-info-card">
          <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>Environment</div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {store.environment.weather && (
              <div>
                <div style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>
                  {Math.round(store.environment.weather.temperature)}°C
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {store.environment.weather.condition}
                </div>
              </div>
            )}
            {store.environment.airQuality && (
              <div>
                <div style={{
                  fontSize: 16, fontWeight: 600,
                  color: store.environment.airQuality.aqi <= 50 ? '#4ade80' :
                         store.environment.airQuality.aqi <= 100 ? '#facc15' :
                         store.environment.airQuality.aqi <= 150 ? '#f97316' : '#ef4444'
                }}>
                  AQI {store.environment.airQuality.aqi}
                </div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  {store.environment.airQuality.category}
                </div>
              </div>
            )}
            {store.environment.pollen && (
              <div>
                <div style={{ fontSize: 13, color: '#fff' }}>Pollen</div>
                <div style={{ fontSize: 12, color: '#888' }}>
                  Grass: {store.environment.pollen.grass.category} | Tree: {store.environment.pollen.tree.category}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {!progress && (
        <div className="loading">
          <div className="loading-spinner" />
          <p style={{ marginTop: 8 }}>Waiting for GPS...</p>
        </div>
      )}

      <div className="nav-controls">
        <button className="btn btn-secondary" onClick={handleRecalculate}
          disabled={store.state === 'RECALCULATING'}>
          Recalculate
        </button>
        <button className="btn btn-danger" onClick={handleStop}>
          Stop
        </button>
      </div>
    </div>
  );
}
