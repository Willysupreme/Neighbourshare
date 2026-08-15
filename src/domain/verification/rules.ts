import { Neighborhood } from "@/types";

/**
 * Haversine great-circle distance between two lat/lng points, in km.
 * Used only for sorting nearby neighborhoods by rough proximity - this is
 * NOT precise geocoding, just "which of these is probably closer." Uses
 * the free browser Geolocation API for the user's own position (no paid
 * Google Maps Platform APIs, no billing account required).
 */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Sorts neighborhoods by distance from the given point. Neighborhoods
 * without stored coordinates (older/manually-added ones) sort after all
 * neighborhoods that do have coordinates, rather than being excluded.
 */
export function sortByDistance<T extends Pick<Neighborhood, "latitude" | "longitude">>(
  neighborhoods: T[],
  fromLat: number,
  fromLng: number
): T[] {
  return [...neighborhoods].sort((a, b) => {
    const aHas = a.latitude != null && a.longitude != null;
    const bHas = b.latitude != null && b.longitude != null;
    if (!aHas && !bHas) return 0;
    if (!aHas) return 1;
    if (!bHas) return -1;
    const distA = haversineDistanceKm(fromLat, fromLng, a.latitude!, a.longitude!);
    const distB = haversineDistanceKm(fromLat, fromLng, b.latitude!, b.longitude!);
    return distA - distB;
  });
}

export function verifyNeighborhoodCode(neighborhood: Pick<Neighborhood, "verificationCode">, code: string): boolean {
  return neighborhood.verificationCode.trim().toLowerCase() === code.trim().toLowerCase();
}

/**
 * Adds a random offset (default up to ~300m) to a coordinate pair before
 * it is ever persisted, so precise residential/current-location data is
 * never stored - only an approximate position. Applied at the point of
 * capture (ShareLocationButton) rather than at display time, so the exact
 * value never exists in the database even transiently.
 *
 * This is a privacy control, not a security one - it deliberately
 * degrades precision rather than encrypting it, matching the spec's
 * intent ("approximately 2km away" rather than an exact address).
 */
export function fuzzCoordinates(
  lat: number,
  lng: number,
  radiusMeters = 300
): { latitude: number; longitude: number } {
  // Random point within a circle of the given radius, uniform by area
  // (sqrt of a uniform random for radius avoids clustering at the center).
  const angle = Math.random() * 2 * Math.PI;
  const distance = radiusMeters * Math.sqrt(Math.random());

  const metersPerDegreeLat = 111_320;
  const metersPerDegreeLng = 111_320 * Math.cos((lat * Math.PI) / 180);

  const dLat = (distance * Math.sin(angle)) / metersPerDegreeLat;
  const dLng = (distance * Math.cos(angle)) / (metersPerDegreeLng || 1);

  return { latitude: lat + dLat, longitude: lng + dLng };
}

/** Generates a shareable code for a newly created neighborhood, e.g. "OSU-4K7Q". */
export function generateVerificationCode(name: string): string {
  const prefix = name
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase() || "NBHD";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${suffix}`;
}
