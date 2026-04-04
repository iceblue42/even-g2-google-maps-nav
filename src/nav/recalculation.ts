import { getStore, setState, setNavState } from '../state/nav-state';
import { fetchDirections } from './directions';
import { resetToRoute } from './route-tracker';
import { resetTransitTracker } from './transit-tracker';
import { eventBus, Events } from '../state/events';

let isRecalculating = false;

export async function recalculateRoute() {
  if (isRecalculating) return;

  const store = getStore();
  if (!store.progress || !store.destination || !store.apiKey) return;

  isRecalculating = true;
  setNavState('RECALCULATING');

  try {
    const routes = await fetchDirections(
      store.progress.currentPosition,
      store.destination.location,
      store.travelMode,
      store.apiKey,
      false // no alternatives during recalculation
    );

    if (routes.length === 0) {
      throw new Error('No route found');
    }

    const newRoute = routes[0];
    setState({
      state: 'NAVIGATING',
      route: newRoute,
      routes: [newRoute],
      error: null,
    });

    resetTransitTracker();
    resetToRoute(newRoute);
    eventBus.emit(Events.RECALCULATE_DONE, newRoute);
  } catch (err: any) {
    console.error('[Recalculation] Failed:', err);
    // Restore NAVIGATING state with previous route
    setState({
      state: 'NAVIGATING',
      error: `Recalculation failed: ${err.message}`,
    });
    // Clear error after 5 seconds
    setTimeout(() => {
      const s = getStore();
      if (s.error?.startsWith('Recalculation failed')) {
        setState({ error: null });
      }
    }, 5000);
  } finally {
    isRecalculating = false;
  }
}

// Listen for recalculation requests
eventBus.on(Events.RECALCULATE_REQUESTED, recalculateRoute);
eventBus.on(Events.OFF_ROUTE, recalculateRoute);
