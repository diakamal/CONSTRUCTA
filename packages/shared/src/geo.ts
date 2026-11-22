const EARTH_RADIUS_M = 6371000;

export interface LatLng {
  lat: number;
  lng: number;
}

/** Great-circle distance in meters. Mirrors public.distance_m() in the database. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Client-side pre-check only; the server RPC check_in() is the source of truth. */
export function isInsideGeofence(point: LatLng, center: LatLng, radiusM: number): boolean {
  return distanceMeters(point, center) <= radiusM;
}
