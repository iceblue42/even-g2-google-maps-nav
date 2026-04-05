import type { LatLng } from '../state/types';

/**
 * Try multiple methods to get the user's location:
 * 1. navigator.geolocation (browser GPS)
 * 2. Google Geolocation API (cell/WiFi-based, no GPS needed)
 * 3. IP-based geolocation as last resort
 */
export async function getLocationFallback(apiKey: string): Promise<LatLng> {
  const errors: string[] = [];

  // Method 1: Try browser GPS and Google Geolocation API in parallel
  // Use whichever responds first with valid data
  try {
    const pos = await Promise.any([
      getBrowserLocation().then(p => { console.log('[Geo] Browser GPS succeeded'); return p; }),
      getGoogleGeolocation(apiKey).then(p => { console.log('[Geo] Google Geolocation API succeeded'); return p; }),
    ]);
    return pos;
  } catch (e: any) {
    const msg = `GPS+Google: ${e.message || e}`;
    console.warn('[Geo]', msg);
    errors.push(msg);
  }

  // Method 2: IP-based geolocation as last resort
  try {
    const pos = await getIpLocation();
    console.log('[Geo] Got location from IP geolocation');
    return pos;
  } catch (e: any) {
    const msg = `IP: ${e.message || e}`;
    console.warn('[Geo]', msg);
    errors.push(msg);
  }

  throw new Error(errors.join(' | '));
}

function getBrowserLocation(): Promise<LatLng> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

async function getGoogleGeolocation(apiKey: string): Promise<LatLng> {
  // Try to get WiFi access points for better accuracy
  const body: any = { considerIp: true };

  // If WiFi RTT API is available, scan for access points
  try {
    if ('NetworkInformation' in window || 'connection' in navigator) {
      // Can't enumerate WiFi APs from browser, but considerIp + cell info helps
    }
  } catch (_e) { /* ignore */ }

  const res = await fetch(
    `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Google Geolocation: ${res.status} ${errText}`);
  }
  const data = await res.json();
  if (!data.location) throw new Error('No location in response');

  console.log(`[Geo] Google accuracy: ${data.accuracy}m`);
  return { lat: data.location.lat, lng: data.location.lng };
}

async function getIpLocation(): Promise<LatLng> {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error(`IP geolocation: ${res.status}`);
  const data = await res.json();
  if (!data.latitude || !data.longitude) throw new Error('No coordinates in IP response');
  return { lat: data.latitude, lng: data.longitude };
}

/**
 * Watch position with fallback — tries browser GPS first,
 * falls back to periodic Google Geolocation API polling.
 */
export function watchLocationWithFallback(
  apiKey: string,
  onPosition: (pos: LatLng) => void,
  onError: (err: string) => void
): () => void {
  // Try browser watchPosition first
  if (navigator.geolocation) {
    const watchId = navigator.geolocation.watchPosition(
      pos => onPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        console.warn('[Geo] watchPosition error:', err.message);
        onError(err.message);
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }

  // Fallback: poll Google Geolocation API every 5 seconds
  console.log('[Geo] No browser geolocation, falling back to API polling');
  const interval = setInterval(async () => {
    try {
      const pos = await getGoogleGeolocation(apiKey);
      onPosition(pos);
    } catch (e: any) {
      onError(e.message);
    }
  }, 5000);

  // Get initial position immediately
  getGoogleGeolocation(apiKey).then(onPosition).catch(e => onError(e.message));

  return () => clearInterval(interval);
}
