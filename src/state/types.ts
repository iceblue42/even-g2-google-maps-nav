export interface LatLng {
  lat: number;
  lng: number;
}

export type TravelMode = 'walking' | 'bicycling' | 'transit';

export type NavState = 'IDLE' | 'ROUTE_SELECTED' | 'NAVIGATING' | 'RECALCULATING' | 'ARRIVED';

export type TransitSubState = 'WALKING_TO_STOP' | 'WAITING' | 'ON_VEHICLE' | 'WALKING_FROM_STOP';

export type DisplayMode = 'default' | 'overview' | 'map-only' | 'environment';

export type AlertLevel = 'none' | 'approaching' | 'imminent' | 'now';

export interface TransitDetails {
  lineName: string;
  lineShortName: string;
  vehicleType: string;
  headsign: string;
  departureStop: string;
  arrivalStop: string;
  departureTime: number;
  arrivalTime: number;
  numStops: number;
}

export interface NavStep {
  instruction: string;
  maneuver: string;
  distance: number;
  duration: number;
  startLocation: LatLng;
  endLocation: LatLng;
  polyline: LatLng[];
  travelMode: 'WALKING' | 'BICYCLING' | 'TRANSIT';
  transitDetails?: TransitDetails;
}

export interface NavLeg {
  startLocation: LatLng;
  endLocation: LatLng;
  duration: number;
  distance: number;
  startAddress: string;
  endAddress: string;
  steps: NavStep[];
  arrivalTime?: number;
  departureTime?: number;
}

export interface NavRoute {
  summary: string;
  duration: number;
  distance: number;
  overviewPolyline: LatLng[];
  legs: NavLeg[];
}

export interface NavProgress {
  currentStepIndex: number;
  currentLegIndex: number;
  distanceToStepEnd: number;
  totalRemainingDistance: number;
  currentPosition: LatLng;
  snappedPosition: LatLng;
  bearing: number;
  etaTimestamp: number;
  etaMinutes: number;
  isOffRoute: boolean;
  currentStep: NavStep;
}

export interface TransitProgress extends NavProgress {
  transitSubState: TransitSubState;
  isOnVehicle: boolean;
  currentLineName?: string;
  stopsRemaining?: number;
  exitStopName?: string;
  vehicleArrivalTime?: number;
  alertLevel: AlertLevel;
}

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface Destination {
  name: string;
  location: LatLng;
}

export interface RouteOption {
  route: NavRoute;
  index: number;
}

export interface AirQualityData {
  aqi: number;
  category: string;
  dominantPollutant: string;
  recommendation: string;
}

export interface WeatherData {
  temperature: number;
  feelsLike: number;
  condition: string;
  humidity: number;
  windSpeed: number;
  windUnit: string;
  uvIndex: number;
}

export interface PollenLevel {
  level: number;
  category: string;
}

export interface PollenData {
  grass: PollenLevel;
  tree: PollenLevel;
  weed: PollenLevel;
}

export interface EnvironmentData {
  airQuality?: AirQualityData;
  weather?: WeatherData;
  pollen?: PollenData;
  fetchedAt: number;
}

export interface NavStore {
  state: NavState;
  route: NavRoute | null;
  routes: NavRoute[];
  progress: NavProgress | null;
  transitSubState: TransitSubState | null;
  alertLevel: AlertLevel;
  apiKey: string;
  origin: LatLng | null;
  destination: Destination | null;
  travelMode: TravelMode;
  displayMode: DisplayMode;
  environment: EnvironmentData | null;
  error: string | null;
}
