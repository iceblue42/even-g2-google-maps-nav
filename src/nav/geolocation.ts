import type { LatLng } from '../state/types';

/**
 * Get the user's exact GPS location from their phone.
 * Uses navigator.geolocation with high accuracy (GPS hardware).
 */
export async function getLocation(): Promise<LatLng> {
  if (!navigator.geolocation) {
    throw new Error('Geolocation is not supported. The Even Realities app may need to enable location access for plugins.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please allow location access for the Even Realities app in your phone settings.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('GPS position unavailable. Please ensure location services are enabled on your phone.'));
            break;
          case err.TIMEOUT:
            reject(new Error('GPS timed out. Please ensure you have a clear view of the sky or try again.'));
            break;
          default:
            reject(new Error(`Location error: ${err.message}`));
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

/**
 * Watch the user's GPS position continuously.
 * Returns a cleanup function to stop watching.
 */
export function watchLocation(
  onPosition: (pos: LatLng) => void,
  onError: (err: string) => void
): () => void {
  if (!navigator.geolocation) {
    onError('Geolocation is not supported in this WebView.');
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    pos => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    err => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          onError('Location permission denied.');
          break;
        case err.POSITION_UNAVAILABLE:
          onError('GPS unavailable.');
          break;
        case err.TIMEOUT:
          onError('GPS timed out.');
          break;
        default:
          onError(err.message);
      }
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
  );

  return () => navigator.geolocation.clearWatch(watchId);
}
