import type { NavStore, NavState, NavRoute, NavProgress, TravelMode, DisplayMode, Destination, LatLng, TransitSubState, AlertLevel, EnvironmentData } from './types';

type Listener = (store: NavStore) => void;

const initialStore: NavStore = {
  state: 'IDLE',
  route: null,
  routes: [],
  progress: null,
  transitSubState: null,
  alertLevel: 'none',
  apiKey: '',
  origin: null,
  destination: null,
  travelMode: 'walking',
  displayMode: 'default',
  environment: null,
  error: null,
};

let store: NavStore = { ...initialStore };
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn(store));
}

export function getStore(): NavStore {
  return store;
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setState(partial: Partial<NavStore>) {
  store = { ...store, ...partial };
  notify();
}

export function setNavState(state: NavState) {
  setState({ state });
}

export function setApiKey(key: string) {
  setState({ apiKey: key });
}

export function setOrigin(origin: LatLng | null) {
  setState({ origin });
}

export function setDestination(dest: Destination | null) {
  setState({ destination: dest });
}

export function setTravelMode(mode: TravelMode) {
  setState({ travelMode: mode });
}

export function setRoutes(routes: NavRoute[]) {
  setState({ routes });
}

export function selectRoute(route: NavRoute) {
  setState({ route, state: 'ROUTE_SELECTED' });
}

export function startNavigation() {
  setState({ state: 'NAVIGATING', error: null });
}

export function updateProgress(progress: NavProgress) {
  setState({ progress });
}

export function setTransitSubState(sub: TransitSubState | null) {
  setState({ transitSubState: sub });
}

export function setAlertLevel(level: AlertLevel) {
  setState({ alertLevel: level });
}

export function setDisplayMode(mode: DisplayMode) {
  setState({ displayMode: mode });
}

export function setEnvironment(env: EnvironmentData | null) {
  setState({ environment: env });
}

export function setError(error: string | null) {
  setState({ error });
}

export function resetNavigation() {
  setState({
    state: 'IDLE',
    route: null,
    routes: [],
    progress: null,
    transitSubState: null,
    alertLevel: 'none',
    displayMode: 'default',
    environment: null,
    error: null,
  });
}
