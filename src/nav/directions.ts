import type { NavRoute, NavLeg, NavStep, TransitDetails, LatLng, TravelMode } from '../state/types';
import { decodePolyline } from '../utils/polyline';
import { loadGoogleMaps } from './google-maps-loader';

let directionsService: any = null;

function getDirectionsService() {
  if (!directionsService) {
    directionsService = new window.google.maps.DirectionsService();
  }
  return directionsService;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').trim();
}

function parseTransitDetails(td: any): TransitDetails | undefined {
  if (!td) return undefined;
  return {
    lineName: td.line?.name || '',
    lineShortName: td.line?.short_name || td.line?.name || '',
    vehicleType: td.line?.vehicle?.type || 'BUS',
    headsign: td.headsign || '',
    departureStop: td.departure_stop?.name || '',
    arrivalStop: td.arrival_stop?.name || '',
    departureTime: td.departure_time?.value ? Math.floor(td.departure_time.value.getTime() / 1000) : 0,
    arrivalTime: td.arrival_time?.value ? Math.floor(td.arrival_time.value.getTime() / 1000) : 0,
    numStops: td.num_stops || 0,
  };
}

function parseStep(step: any): NavStep {
  const travelMode = step.travel_mode as 'WALKING' | 'BICYCLING' | 'TRANSIT';

  let instruction = stripHtml(step.instructions || '');
  if (travelMode === 'TRANSIT' && step.transit) {
    const td = step.transit;
    const vehicle = td.line?.vehicle?.name || 'Transit';
    instruction = `Take ${vehicle} ${td.line?.short_name || td.line?.name || ''} toward ${td.headsign || 'destination'}`;
  }

  // The JS SDK uses step.path (array of LatLng objects) instead of encoded polyline
  let polyline: LatLng[] = [];
  if (step.path && step.path.length > 0) {
    polyline = step.path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
  } else if (step.polyline?.points) {
    polyline = decodePolyline(step.polyline.points);
  }

  return {
    instruction,
    maneuver: step.maneuver || '',
    distance: step.distance?.value || 0,
    duration: step.duration?.value || 0,
    startLocation: {
      lat: step.start_location?.lat() ?? step.start_location?.lat ?? 0,
      lng: step.start_location?.lng() ?? step.start_location?.lng ?? 0,
    },
    endLocation: {
      lat: step.end_location?.lat() ?? step.end_location?.lat ?? 0,
      lng: step.end_location?.lng() ?? step.end_location?.lng ?? 0,
    },
    polyline,
    travelMode,
    transitDetails: parseTransitDetails(step.transit),
  };
}

function parseLeg(leg: any): NavLeg {
  return {
    startLocation: {
      lat: leg.start_location?.lat() ?? 0,
      lng: leg.start_location?.lng() ?? 0,
    },
    endLocation: {
      lat: leg.end_location?.lat() ?? 0,
      lng: leg.end_location?.lng() ?? 0,
    },
    duration: leg.duration?.value || 0,
    distance: leg.distance?.value || 0,
    startAddress: leg.start_address || '',
    endAddress: leg.end_address || '',
    arrivalTime: leg.arrival_time?.value ? Math.floor(leg.arrival_time.value.getTime() / 1000) : undefined,
    departureTime: leg.departure_time?.value ? Math.floor(leg.departure_time.value.getTime() / 1000) : undefined,
    steps: (leg.steps || []).map(parseStep),
  };
}

function parseRoute(route: any): NavRoute {
  const legs = (route.legs || []).map(parseLeg);

  // overview_path is an array of LatLng objects in the JS SDK
  let overviewPolyline: LatLng[] = [];
  if (route.overview_path) {
    overviewPolyline = route.overview_path.map((p: any) => ({ lat: p.lat(), lng: p.lng() }));
  } else if (route.overview_polyline?.points) {
    overviewPolyline = decodePolyline(route.overview_polyline.points);
  }

  return {
    summary: route.summary || '',
    duration: legs.reduce((sum: number, l: NavLeg) => sum + l.duration, 0),
    distance: legs.reduce((sum: number, l: NavLeg) => sum + l.distance, 0),
    overviewPolyline,
    legs,
  };
}

const TRAVEL_MODE_MAP: Record<TravelMode, string> = {
  walking: 'WALKING',
  bicycling: 'BICYCLING',
  transit: 'TRANSIT',
};

export async function fetchDirections(
  origin: LatLng,
  destination: LatLng,
  mode: TravelMode,
  apiKey: string,
  alternatives = true
): Promise<NavRoute[]> {
  await loadGoogleMaps(apiKey);

  const service = getDirectionsService();

  const request: any = {
    origin: new window.google.maps.LatLng(origin.lat, origin.lng),
    destination: new window.google.maps.LatLng(destination.lat, destination.lng),
    travelMode: TRAVEL_MODE_MAP[mode],
    provideRouteAlternatives: alternatives,
  };

  if (mode === 'transit') {
    request.transitOptions = {
      departureTime: new Date(),
    };
  }

  return new Promise((resolve, reject) => {
    service.route(request, (response: any, status: string) => {
      if (status !== 'OK') {
        reject(new Error(`Directions: ${status}`));
        return;
      }

      const routes = (response.routes || []).map(parseRoute);
      resolve(routes);
    });
  });
}
