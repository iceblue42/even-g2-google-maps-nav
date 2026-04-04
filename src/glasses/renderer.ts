import type { NavRoute, NavProgress, TransitProgress, TravelMode, DisplayMode } from '../state/types';
import { getStore, setDisplayMode, setNavState, setEnvironment } from '../state/nav-state';
import { eventBus, Events } from '../state/events';
import { processTransitProgress } from '../nav/transit-tracker';
import {
  getDefaultContainerConfig,
  getAlertContainerConfig,
  getOverviewContainerConfig,
  getMapOnlyContainerConfig,
  getEnvironmentContainerConfig,
  MAP_WIDTH, MAP_HEIGHT,
  HEADER_ID, HEADER_NAME,
  NAV_ID, NAV_NAME,
  ENV_ID, ENV_NAME,
  FOOTER_ID, FOOTER_NAME,
  MAP_ID, MAP_NAME,
} from './layout';
import { formatHeader, formatNavInstruction, formatFooter, formatStepsList } from './nav-text';
import {
  formatTransitHeader, formatTransitNav, formatTransitFooter,
  getAlertText, getAlertFooter, shouldShowAlert,
} from './transit-text';
import {
  formatEnvironmentDisplay, formatEnvironmentHeader, formatEnvironmentFooter,
  formatWeatherCompact, formatEnvironmentCompact,
} from './env-text';
import { renderMap, getZoomForMode } from './map-renderer';
import { startEnvironmentUpdates } from '../nav/environment';
import '../nav/recalculation'; // Side-effect: registers event listeners

let bridge: any = null;
let currentRoute: NavRoute | null = null;
let currentMode: TravelMode = 'walking';
let isAlertMode = false;
let currentDisplayMode: DisplayMode = 'default';

// Image update queue — ensures sequential sends
let imageQueue: Promise<void> = Promise.resolve();

// Throttle map updates
let lastMapUpdateTime = 0;
let lastMapPosition = { lat: 0, lng: 0 };
const MAP_UPDATE_INTERVAL = 4000; // 4 seconds
const MAP_UPDATE_DISTANCE = 20; // 20 meters

function distanceFast(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dlat = (a.lat - b.lat) * 111320;
  const dlng = (a.lng - b.lng) * 111320 * Math.cos(a.lat * Math.PI / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function shouldUpdateMap(position: { lat: number; lng: number }): boolean {
  const now = Date.now();
  if (now - lastMapUpdateTime < MAP_UPDATE_INTERVAL) return false;
  if (distanceFast(position, lastMapPosition) < MAP_UPDATE_DISTANCE && lastMapUpdateTime > 0) return false;
  return true;
}

function queueImageUpdate(data: any) {
  imageQueue = imageQueue.then(async () => {
    try {
      await bridge.updateImageRawData(data);
    } catch (e) {
      console.warn('[Renderer] Image update failed:', e);
    }
  });
}

async function updateTextContainer(id: number, name: string, content: string) {
  if (!bridge) return;
  try {
    await bridge.textContainerUpgrade({
      containerID: id,
      containerName: name,
      content,
      contentOffset: 0,
      contentLength: content.length,
    });
  } catch (e) {
    console.warn(`[Renderer] Text update failed for ${name}:`, e);
  }
}

function getRemainingPolyline(progress: NavProgress): { lat: number; lng: number }[] {
  if (!currentRoute) return [];
  const allSteps = currentRoute.legs.flatMap(l => l.steps);
  const points: { lat: number; lng: number }[] = [];

  // Add snapped position as first point
  points.push(progress.snappedPosition);

  // Add remaining polyline from current step onward
  for (let i = progress.currentStepIndex; i < allSteps.length; i++) {
    const step = allSteps[i];
    for (const p of step.polyline) {
      points.push(p);
    }
  }

  return points;
}

async function updateDefaultDisplay(progress: NavProgress) {
  const allSteps = currentRoute?.legs.flatMap(l => l.steps) || [];
  const totalSteps = allSteps.length;

  let headerText: string;
  let navText: string;
  let footerText: string;

  if (currentMode === 'transit') {
    const transitProgress = processTransitProgress(progress);

    // Check if we should switch to alert mode
    if (shouldShowAlert(transitProgress) && !isAlertMode) {
      await switchToAlertMode(transitProgress);
      return;
    }
    if (!shouldShowAlert(transitProgress) && isAlertMode) {
      await switchToNormalMode();
    }

    if (isAlertMode) {
      await updateAlertDisplay(transitProgress);
      return;
    }

    headerText = formatTransitHeader(transitProgress);
    navText = formatTransitNav(transitProgress);
    footerText = formatTransitFooter(transitProgress, totalSteps);
  } else {
    headerText = formatHeader(progress);
    // Append compact weather to header if available
    const weatherStr = formatWeatherCompact(getStore().environment);
    if (weatherStr) {
      headerText += ` | ${weatherStr}`;
    }
    navText = formatNavInstruction(progress);
    footerText = formatFooter(progress, totalSteps);
  }

  // Environment compact text
  const envText = formatEnvironmentCompact(getStore().environment);

  // Update text containers (these are fast, do in parallel)
  await Promise.all([
    updateTextContainer(HEADER_ID, HEADER_NAME, headerText),
    updateTextContainer(NAV_ID, NAV_NAME, navText),
    updateTextContainer(ENV_ID, ENV_NAME, envText),
    updateTextContainer(FOOTER_ID, FOOTER_NAME, footerText),
  ]);

  // Update map image (throttled)
  if (shouldUpdateMap(progress.snappedPosition)) {
    lastMapUpdateTime = Date.now();
    lastMapPosition = { ...progress.snappedPosition };

    const zoom = getZoomForMode(currentMode);
    const remainingPoly = getRemainingPolyline(progress);

    try {
      const pngBytes = await renderMap(
        progress.snappedPosition,
        remainingPoly,
        zoom,
        MAP_WIDTH,
        MAP_HEIGHT,
        progress.bearing
      );

      if (pngBytes.length > 0) {
        queueImageUpdate({
          containerID: MAP_ID,
          containerName: MAP_NAME,
          imageData: pngBytes,
        });
      }
    } catch (e) {
      console.warn('[Renderer] Map render failed:', e);
    }
  }
}

async function updateEnvironmentDisplay() {
  const env = getStore().environment;
  const header = formatEnvironmentHeader(env);
  const body = formatEnvironmentDisplay(env);
  const footer = formatEnvironmentFooter(env);

  await Promise.all([
    updateTextContainer(HEADER_ID, HEADER_NAME, header),
    updateTextContainer(NAV_ID, NAV_NAME, body),
    updateTextContainer(FOOTER_ID, FOOTER_NAME, footer),
  ]);
}

async function updateOverviewDisplay(progress: NavProgress) {
  const allSteps = currentRoute?.legs.flatMap(l => l.steps) || [];
  const headerText = formatHeader(progress);
  const stepsText = formatStepsList(progress, allSteps);
  const footerText = formatFooter(progress, allSteps.length);

  await Promise.all([
    updateTextContainer(HEADER_ID, HEADER_NAME, headerText),
    updateTextContainer(NAV_ID, NAV_NAME, stepsText),
    updateTextContainer(FOOTER_ID, FOOTER_NAME, footerText),
  ]);
}

async function updateMapOnlyDisplay(progress: NavProgress) {
  const headerText = formatHeader(progress);
  await updateTextContainer(HEADER_ID, HEADER_NAME, headerText);

  // Larger map in map-only mode
  if (shouldUpdateMap(progress.snappedPosition)) {
    lastMapUpdateTime = Date.now();
    lastMapPosition = { ...progress.snappedPosition };

    const zoom = getZoomForMode(currentMode);
    const remainingPoly = getRemainingPolyline(progress);

    try {
      const pngBytes = await renderMap(
        progress.snappedPosition,
        remainingPoly,
        zoom,
        280, 140,
        progress.bearing
      );

      if (pngBytes.length > 0) {
        queueImageUpdate({
          containerID: MAP_ID,
          containerName: MAP_NAME,
          imageData: pngBytes,
        });
      }
    } catch (e) {
      console.warn('[Renderer] Map render failed:', e);
    }
  }
}

async function switchToAlertMode(transitProgress: TransitProgress) {
  if (!bridge) return;
  isAlertMode = true;

  const alertText = getAlertText(transitProgress);
  const footerText = getAlertFooter(transitProgress);
  const config = getAlertContainerConfig(alertText, footerText);

  try {
    await bridge.rebuildPageContainer(config);
  } catch (e) {
    console.warn('[Renderer] Alert mode rebuild failed:', e);
  }
}

async function updateAlertDisplay(transitProgress: TransitProgress) {
  const alertText = getAlertText(transitProgress);
  const footerText = getAlertFooter(transitProgress);

  await Promise.all([
    updateTextContainer(1, 'alert-txt', alertText),
    updateTextContainer(2, 'alert-footer', footerText),
  ]);
}

async function switchToNormalMode() {
  if (!bridge) return;
  isAlertMode = false;

  const config = getDefaultContainerConfig('Resuming navigation...', '', '', '');
  try {
    await bridge.rebuildPageContainer(config);
    // Send initial map after rebuild
    lastMapUpdateTime = 0; // Force map update
  } catch (e) {
    console.warn('[Renderer] Normal mode rebuild failed:', e);
  }
}

/** Handle display mode cycling from glasses gestures. */
async function cycleDisplayMode() {
  const modes: DisplayMode[] = ['default', 'overview', 'map-only', 'environment'];
  const currentIdx = modes.indexOf(currentDisplayMode);
  const nextIdx = (currentIdx + 1) % modes.length;
  const nextMode = modes[nextIdx];

  currentDisplayMode = nextMode;
  setDisplayMode(nextMode);

  if (!bridge) return;

  const store = getStore();
  const progress = store.progress;
  if (!progress || !currentRoute) return;

  const allSteps = currentRoute.legs.flatMap(l => l.steps);

  try {
    if (nextMode === 'overview') {
      const header = formatHeader(progress);
      const steps = formatStepsList(progress, allSteps);
      const footer = formatFooter(progress, allSteps.length);
      const config = getOverviewContainerConfig(header, steps, footer);
      await bridge.rebuildPageContainer(config);
    } else if (nextMode === 'map-only') {
      const header = formatHeader(progress);
      const config = getMapOnlyContainerConfig(header);
      await bridge.rebuildPageContainer(config);
      lastMapUpdateTime = 0; // Force map update
    } else if (nextMode === 'environment') {
      const env = store.environment;
      const header = formatEnvironmentHeader(env);
      const body = formatEnvironmentDisplay(env);
      const footer = formatEnvironmentFooter(env);
      const config = getEnvironmentContainerConfig(header, body, footer);
      await bridge.rebuildPageContainer(config);
    } else {
      // Default mode
      const header = formatHeader(progress);
      const nav = formatNavInstruction(progress);
      const footer = formatFooter(progress, allSteps.length);
      const envText = formatEnvironmentCompact(getStore().environment);
      const config = getDefaultContainerConfig(header, nav, envText, footer);
      await bridge.rebuildPageContainer(config);
      lastMapUpdateTime = 0; // Force map update
    }
  } catch (e) {
    console.warn('[Renderer] Display mode switch failed:', e);
  }
}

/** Initialize glasses display when navigation starts. */
export async function initGlassesDisplay(b: any, route: NavRoute, mode: TravelMode) {
  bridge = b;
  currentRoute = route;
  currentMode = mode;
  isAlertMode = false;
  currentDisplayMode = 'default';
  lastMapUpdateTime = 0;

  const config = getDefaultContainerConfig(
    'Starting navigation...',
    'Waiting for GPS...',
    '',
    ''
  );

  try {
    const result = await bridge.createStartUpPageContainer(config);
    if (result !== 0) {
      console.error('[Renderer] createStartUpPageContainer failed with code:', result);
      return;
    }
    console.log('[Renderer] Glasses display initialized');

    // Start environment data fetching
    const store = getStore();
    startEnvironmentUpdates(
      () => store.progress?.currentPosition || store.origin,
      store.apiKey,
      (envData) => setEnvironment(envData)
    );
  } catch (e) {
    console.error('[Renderer] Failed to create startup page:', e);
  }
}

/** Register glasses event handler for gestures. */
export function initGlassesEventHandler(b: any) {
  bridge = b;

  b.onEvenHubEvent(async (event: any) => {
    // Double-click (system event) -> recalculate
    if (event.sysEvent) {
      const eventType = event.sysEvent.eventType;
      // DOUBLE_CLICK_EVENT = 3
      if (eventType === 3) {
        eventBus.emit(Events.RECALCULATE_REQUESTED);
        return;
      }
    }

    if (event.textEvent) {
      const eventType = event.textEvent.eventType;
      switch (eventType) {
        case 0: // CLICK_EVENT -> cycle display mode
          await cycleDisplayMode();
          break;
        case 1: // SCROLL_TOP_EVENT (swipe up) -> preview next step
          await previewStep(1);
          break;
        case 2: // SCROLL_BOTTOM_EVENT (swipe down) -> preview prev step
          await previewStep(-1);
          break;
      }
    }

    // Foreground/background events
    if (event.textEvent?.eventType === 4) {
      // FOREGROUND_ENTER_EVENT
      lastMapUpdateTime = 0; // Force map refresh
    }
  });

  // Listen for navigation progress updates
  eventBus.on(Events.NAV_PROGRESS, async (progress: unknown) => {
    const p = progress as NavProgress;
    const store = getStore();
    if (store.state !== 'NAVIGATING') return;

    currentRoute = store.route;

    switch (currentDisplayMode) {
      case 'default':
        await updateDefaultDisplay(p);
        break;
      case 'overview':
        await updateOverviewDisplay(p);
        break;
      case 'map-only':
        await updateMapOnlyDisplay(p);
        break;
      case 'environment':
        await updateEnvironmentDisplay();
        break;
    }
  });

  // Listen for arrival
  eventBus.on(Events.NAV_ARRIVED, async () => {
    if (!bridge) return;
    try {
      const config = getAlertContainerConfig('ARRIVED\n\nYou have reached\nyour destination', '');
      await bridge.rebuildPageContainer(config);

      // Auto-shutdown after 5 seconds
      setTimeout(() => {
        try {
          bridge.shutDownPageContainer(0);
        } catch (_e) { /* ignore */ }
        setNavState('ARRIVED');
      }, 5000);
    } catch (e) {
      console.warn('[Renderer] Arrival display failed:', e);
    }
  });

  // Listen for recalculation start
  eventBus.on(Events.RECALCULATE_REQUESTED, async () => {
    await updateTextContainer(NAV_ID, NAV_NAME, 'Recalculating...');
  });
}

/** Preview an adjacent step for 3 seconds. */
let previewTimeout: ReturnType<typeof setTimeout> | null = null;

async function previewStep(direction: number) {
  const store = getStore();
  if (!store.progress || !currentRoute) return;

  const allSteps = currentRoute.legs.flatMap(l => l.steps);
  const previewIdx = store.progress.currentStepIndex + direction;
  if (previewIdx < 0 || previewIdx >= allSteps.length) return;

  const step = allSteps[previewIdx];
  const previewText = `[Preview step ${previewIdx + 1}]\n${step.instruction}`;

  await updateTextContainer(NAV_ID, NAV_NAME, previewText);

  // Revert after 3 seconds
  if (previewTimeout) clearTimeout(previewTimeout);
  previewTimeout = setTimeout(async () => {
    if (store.progress) {
      const nav = formatNavInstruction(store.progress);
      await updateTextContainer(NAV_ID, NAV_NAME, nav);
    }
  }, 3000);
}
