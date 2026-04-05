import type { NavProgress, TransitProgress, TransitSubState, AlertLevel, NavStep } from '../state/types';
import { haversineDistance } from '../utils/geo';
import { setTransitSubState, setAlertLevel } from '../state/nav-state';
import { eventBus, Events } from '../state/events';

const BOARDING_PROXIMITY = 100; // meters to consider "at stop"

let currentTransitStep: NavStep | null = null;
let boardedAt: number | null = null;
let lastSubState: TransitSubState = 'WALKING_TO_STOP';
let lastAlertLevel: AlertLevel = 'none';

function determineTransitSubState(progress: NavProgress): TransitSubState {
  const step = progress.currentStep;

  if (step.travelMode !== 'TRANSIT') {
    // Walking leg — determine if walking TO or FROM a transit stop
    // Simple heuristic: if previous step was transit, we're walking from stop
    return lastSubState === 'ON_VEHICLE' ? 'WALKING_FROM_STOP' : 'WALKING_TO_STOP';
  }

  if (!step.transitDetails) return 'WALKING_TO_STOP';

  const td = step.transitDetails;
  const now = Date.now() / 1000;

  // Check if near departure stop
  const distToDeparture = haversineDistance(progress.currentPosition, step.startLocation);

  if (!boardedAt) {
    // Not yet boarded
    if (distToDeparture < BOARDING_PROXIMITY) {
      if (now >= td.departureTime) {
        // Departure time passed and we're at the stop — assume boarded
        boardedAt = now;
        return 'ON_VEHICLE';
      }
      return 'WAITING';
    }
    return 'WALKING_TO_STOP';
  }

  return 'ON_VEHICLE';
}

function calculateStopsRemaining(step: NavStep): number {
  if (!step.transitDetails) return 0;
  const td = step.transitDetails;
  const now = Date.now() / 1000;
  const totalDuration = td.arrivalTime - td.departureTime;
  if (totalDuration <= 0) return 0;

  const elapsed = now - td.departureTime;
  const fraction = Math.min(1, Math.max(0, elapsed / totalDuration));
  const stopsElapsed = Math.floor(fraction * td.numStops);
  return Math.max(0, td.numStops - stopsElapsed);
}

function determineAlertLevel(stopsRemaining: number): AlertLevel {
  if (stopsRemaining <= 0) return 'now';
  if (stopsRemaining <= 1) return 'imminent';
  if (stopsRemaining <= 3) return 'approaching';
  return 'none';
}

export function processTransitProgress(progress: NavProgress): TransitProgress {
  const subState = determineTransitSubState(progress);

  // Track state transitions
  if (subState !== lastSubState) {
    lastSubState = subState;
    setTransitSubState(subState);
    eventBus.emit(Events.TRANSIT_STATE_CHANGED, subState);

    // Reset boarding when moving to a new transit step
    if (subState === 'WALKING_TO_STOP') {
      boardedAt = null;
      currentTransitStep = null;
    }
  }

  if (progress.currentStep.travelMode === 'TRANSIT') {
    currentTransitStep = progress.currentStep;
  }

  let stopsRemaining: number | undefined;
  let alertLevel: AlertLevel = 'none';

  if (subState === 'ON_VEHICLE' && currentTransitStep?.transitDetails) {
    stopsRemaining = calculateStopsRemaining(currentTransitStep);
    alertLevel = determineAlertLevel(stopsRemaining);

    setAlertLevel(alertLevel);
    if (alertLevel !== lastAlertLevel) {
      lastAlertLevel = alertLevel;
      eventBus.emit(Events.TRANSIT_ALERT, alertLevel);
    }
  }

  const td = currentTransitStep?.transitDetails;

  return {
    ...progress,
    transitSubState: subState,
    isOnVehicle: subState === 'ON_VEHICLE',
    currentLineName: td ? `${td.lineShortName || td.lineName}` : undefined,
    stopsRemaining,
    exitStopName: td?.arrivalStop,
    vehicleArrivalTime: td?.arrivalTime,
    alertLevel,
  };
}

export function resetTransitTracker() {
  currentTransitStep = null;
  boardedAt = null;
  lastSubState = 'WALKING_TO_STOP';
  lastAlertLevel = 'none';
}
