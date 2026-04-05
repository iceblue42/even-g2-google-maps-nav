import type { LatLng } from '../state/types';

const R = 6371000; // Earth radius in meters

export function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearing(from: LatLng, to: LatLng): number {
  const dLng = toRad(to.lng - from.lng);
  const fromLat = toRad(from.lat);
  const toLat = toRad(to.lat);
  const y = Math.sin(dLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) - Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Returns the closest point on segment [a, b] to point p, and the distance to it. */
export function pointToSegment(p: LatLng, a: LatLng, b: LatLng): { point: LatLng; distance: number } {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  if (dx === 0 && dy === 0) {
    return { point: a, distance: haversineDistance(p, a) };
  }
  let t = ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const closest: LatLng = {
    lat: a.lat + t * dy,
    lng: a.lng + t * dx,
  };
  return { point: closest, distance: haversineDistance(p, closest) };
}

/** Find the closest point on an entire polyline to a given point. */
export function snapToPolyline(p: LatLng, polyline: LatLng[]): { point: LatLng; distance: number; segmentIndex: number } {
  if (polyline.length === 0) return { point: p, distance: 0, segmentIndex: 0 };

  let bestDist = Infinity;
  let bestPoint = polyline[0];
  let bestSegment = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const { point, distance } = pointToSegment(p, polyline[i], polyline[i + 1]);
    if (distance < bestDist) {
      bestDist = distance;
      bestPoint = point;
      bestSegment = i;
    }
  }

  return { point: bestPoint, distance: bestDist, segmentIndex: bestSegment };
}

/** Calculate distance along a polyline from a start point to the end. */
export function distanceAlongPolyline(polyline: LatLng[], fromIndex: number, fromPoint: LatLng): number {
  if (polyline.length < 2) return 0;
  if (fromIndex >= polyline.length - 1) return 0;
  let total = haversineDistance(fromPoint, polyline[fromIndex + 1]);
  for (let i = fromIndex + 1; i < polyline.length - 1; i++) {
    total += haversineDistance(polyline[i], polyline[i + 1]);
  }
  return total;
}

/** Total length of a polyline. */
export function polylineLength(polyline: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < polyline.length - 1; i++) {
    total += haversineDistance(polyline[i], polyline[i + 1]);
  }
  return total;
}

/** Convert lat/lng + zoom to tile x/y (fractional). */
export function latLngToTileXY(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const n = Math.pow(2, zoom);
  const x = ((lng + 180) / 360) * n;
  const latRad = toRad(lat);
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
  return { x, y };
}

/** Convert tile x/y + zoom back to lat/lng. */
export function tileXYToLatLng(tileX: number, tileY: number, zoom: number): LatLng {
  const n = Math.pow(2, zoom);
  const lng = (tileX / n) * 360 - 180;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / n)));
  return { lat: toDeg(latRad), lng };
}
