import type { LatLng, NavRoute, NavProgress, NavStep } from '../state/types';
import { haversineDistance, snapToPolyline, distanceAlongPolyline, bearing } from '../utils/geo';
import { updateProgress } from '../state/nav-state';
import { eventBus, Events } from '../state/events';

const OFF_ROUTE_THRESHOLD = 50; // meters
const STEP_ADVANCE_NEAR = 30; // meters to step end
const STEP_ADVANCE_NEXT = 50; // meters to next step start
const OFF_ROUTE_COUNT_THRESHOLD = 3;

const SPEED_WALKING = 1.4; // m/s
const SPEED_CYCLING = 4.2; // m/s

let watchId: number | null = null;
let currentRoute: NavRoute | null = null;
let currentStepIndex = 0;
let currentLegIndex = 0;
let offRouteCount = 0;

function getAllSteps(): NavStep[] {
  if (!currentRoute) return [];
  return currentRoute.legs.flatMap(l => l.steps);
}

function getRemainingDistance(snapped: LatLng, stepIndex: number): number {
  const steps = getAllSteps();
  if (stepIndex >= steps.length) return 0;

  const currentStep = steps[stepIndex];
  const { segmentIndex } = snapToPolyline(snapped, currentStep.polyline);
  let dist = distanceAlongPolyline(currentStep.polyline, segmentIndex, snapped);

  for (let i = stepIndex + 1; i < steps.length; i++) {
    dist += steps[i].distance;
  }
  return dist;
}

function calculateEta(remainingDistance: number, travelMode: string): { timestamp: number; minutes: number } {
  const speed = travelMode === 'BICYCLING' ? SPEED_CYCLING : SPEED_WALKING;
  const seconds = remainingDistance / speed;
  const timestamp = Math.floor(Date.now() / 1000 + seconds);
  const minutes = Math.round(seconds / 60);
  return { timestamp, minutes };
}

function onPositionUpdate(position: GeolocationPosition) {
  if (!currentRoute) return;

  const pos: LatLng = {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
  };

  const steps = getAllSteps();
  if (currentStepIndex >= steps.length) {
    eventBus.emit(Events.NAV_ARRIVED);
    return;
  }

  const currentStep = steps[currentStepIndex];

  // Snap to current step's polyline
  const snap = snapToPolyline(pos, currentStep.polyline);

  // Check off-route
  if (snap.distance > OFF_ROUTE_THRESHOLD) {
    offRouteCount++;
    if (offRouteCount >= OFF_ROUTE_COUNT_THRESHOLD) {
      offRouteCount = 0;
      eventBus.emit(Events.OFF_ROUTE);
    }
  } else {
    offRouteCount = 0;
  }

  // Check step advancement
  const distToStepEnd = haversineDistance(snap.point, currentStep.endLocation);
  if (distToStepEnd < STEP_ADVANCE_NEAR && currentStepIndex < steps.length - 1) {
    const nextStep = steps[currentStepIndex + 1];
    const distToNextStart = haversineDistance(pos, nextStep.startLocation);
    if (distToNextStart < STEP_ADVANCE_NEXT) {
      currentStepIndex++;
      // Update leg index
      let stepCount = 0;
      for (let i = 0; i < currentRoute.legs.length; i++) {
        stepCount += currentRoute.legs[i].steps.length;
        if (currentStepIndex < stepCount) {
          currentLegIndex = i;
          break;
        }
      }
      eventBus.emit(Events.NAV_STEP_CHANGED, currentStepIndex);
    }
  }

  // Check arrival (last step, close to end)
  if (currentStepIndex === steps.length - 1 && distToStepEnd < 30) {
    eventBus.emit(Events.NAV_ARRIVED);
    return;
  }

  // Calculate remaining distance and ETA
  const remainingDist = getRemainingDistance(snap.point, currentStepIndex);

  // For transit routes, use the leg's arrival time
  let eta: { timestamp: number; minutes: number };
  const currentLeg = currentRoute.legs[currentLegIndex];
  if (currentLeg.arrivalTime) {
    const minutes = Math.max(0, Math.round((currentLeg.arrivalTime - Date.now() / 1000) / 60));
    eta = { timestamp: currentLeg.arrivalTime, minutes };
  } else {
    eta = calculateEta(remainingDist, currentStep.travelMode);
  }

  const progress: NavProgress = {
    currentStepIndex,
    currentLegIndex,
    distanceToStepEnd: distToStepEnd,
    totalRemainingDistance: remainingDist,
    currentPosition: pos,
    snappedPosition: snap.point,
    bearing: bearing(snap.point, currentStep.endLocation),
    etaTimestamp: eta.timestamp,
    etaMinutes: eta.minutes,
    isOffRoute: offRouteCount > 0,
    currentStep: steps[currentStepIndex],
  };

  updateProgress(progress);
  eventBus.emit(Events.NAV_PROGRESS, progress);
}

function onPositionError(err: GeolocationPositionError) {
  console.warn('[RouteTracker] GPS error:', err.message);
  // Don't stop tracking — GPS may recover
}

export function startTracking(route: NavRoute) {
  stopTracking();
  currentRoute = route;
  currentStepIndex = 0;
  currentLegIndex = 0;
  offRouteCount = 0;

  watchId = navigator.geolocation.watchPosition(onPositionUpdate, onPositionError, {
    enableHighAccuracy: true,
    maximumAge: 2000,
    timeout: 10000,
  });
}

export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  currentRoute = null;
  currentStepIndex = 0;
  currentLegIndex = 0;
  offRouteCount = 0;
}

export function resetToRoute(route: NavRoute) {
  startTracking(route);
}

export function getCurrentStepIndex(): number {
  return currentStepIndex;
}
