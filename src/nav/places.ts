import type { PlacePrediction, LatLng } from '../state/types';
import { loadGoogleMaps } from './google-maps-loader';

let autocompleteService: any = null;
let placesService: any = null;
let geocoder: any = null;

function getAutocompleteService() {
  if (!autocompleteService) {
    if (!window.google?.maps?.places?.AutocompleteService) {
      throw new Error('Google Maps Places library not loaded. Check that "Places API" is enabled in Google Cloud Console.');
    }
    autocompleteService = new window.google.maps.places.AutocompleteService();
  }
  return autocompleteService;
}

function getPlacesService() {
  if (!placesService) {
    // PlacesService requires a DOM element or map, use a hidden div
    const div = document.createElement('div');
    placesService = new window.google.maps.places.PlacesService(div);
  }
  return placesService;
}

function getGeocoder() {
  if (!geocoder) {
    geocoder = new window.google.maps.Geocoder();
  }
  return geocoder;
}

export async function searchPlaces(query: string, apiKey: string, location?: LatLng): Promise<PlacePrediction[]> {
  await loadGoogleMaps(apiKey);

  const service = getAutocompleteService();

  const request: any = {
    input: query,
  };

  if (location) {
    request.locationBias = {
      center: { lat: location.lat, lng: location.lng },
      radius: 50000,
    };
  }

  return new Promise((resolve, reject) => {
    service.getPlacePredictions(request, (predictions: any[] | null, status: string) => {
      console.log('[Places] Autocomplete status:', status, 'results:', predictions?.length ?? 0);

      if (status === 'ZERO_RESULTS' || !predictions || predictions.length === 0) {
        resolve([]);
        return;
      }
      if (status !== 'OK') {
        reject(new Error(`Places Autocomplete: ${status}`));
        return;
      }

      resolve(predictions.map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
      })));
    });
  });
}

export async function getPlaceLocation(placeId: string, apiKey: string): Promise<{ name: string; location: LatLng }> {
  await loadGoogleMaps(apiKey);

  const service = getPlacesService();

  return new Promise((resolve, reject) => {
    service.getDetails(
      { placeId, fields: ['geometry', 'formatted_address', 'name'] },
      (result: any, status: string) => {
        if (status !== 'OK' || !result) {
          reject(new Error(`Place Details: ${status}`));
          return;
        }

        resolve({
          name: result.name || result.formatted_address || 'Unknown',
          location: {
            lat: result.geometry.location.lat(),
            lng: result.geometry.location.lng(),
          },
        });
      }
    );
  });
}

/** Reverse geocode a LatLng to get a human-readable address. */
export async function reverseGeocode(location: LatLng, apiKey: string): Promise<string> {
  await loadGoogleMaps(apiKey);

  const gc = getGeocoder();

  return new Promise((resolve, reject) => {
    gc.geocode(
      { location: { lat: location.lat, lng: location.lng } },
      (results: any[], status: string) => {
        if (status !== 'OK' || !results || results.length === 0) {
          reject(new Error(`Geocode: ${status}`));
          return;
        }

        // Try to find a street address or point of interest
        const preferred = results.find((r: any) =>
          r.types.includes('street_address') ||
          r.types.includes('premise') ||
          r.types.includes('point_of_interest')
        );

        const best = preferred || results[0];
        resolve(best.formatted_address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`);
      }
    );
  });
}

/** Validate an API key by trying to load the Google Maps SDK. */
export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    await loadGoogleMaps(apiKey);
    return !!window.google?.maps;
  } catch {
    return false;
  }
}
