/** Geospatial helpers shared by the geocoder and the ETL. */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Central Canggu (Batu Bolong / Berawa) — the reference point every distance
 * column in the source workbook is measured from. Stated in the workbook's
 * Overview → Methodology section.
 */
export const CANGGU: LatLng = { lat: -8.656, lng: 115.135 };

/**
 * Road distance is modelled at 1.35x straight-line distance, matching the
 * workbook methodology for Bali's non-grid road network.
 */
export const ROAD_FACTOR = 1.35;

const EARTH_RADIUS_KM = 6371;

const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Distance from central Canggu in kilometres. */
export const kmFromCanggu = (p: LatLng) => haversineKm(CANGGU, p);

/**
 * Rough bounding box for the island of Bali. Used to reject geocoder results
 * that resolve to a same-named place elsewhere in Indonesia or the world.
 */
export const BALI_BOUNDS = {
  minLat: -8.95,
  maxLat: -8.02,
  minLng: 114.4,
  maxLng: 115.75,
};

/** Initial bearing from `a` to `b`, in radians. */
export function bearingRad(a: LatLng, b: LatLng): number {
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return Math.atan2(y, x);
}

/** Point reached by travelling `distanceKm` from `origin` along `bearing`. */
export function destination(
  origin: LatLng,
  bearing: number,
  distanceKm: number,
): LatLng {
  const angular = distanceKm / EARTH_RADIUS_KM;
  const lat1 = toRad(origin.lat);
  const lng1 = toRad(origin.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: (lat2 * 180) / Math.PI, lng: (((lng2 * 180) / Math.PI + 540) % 360) - 180 };
}

/**
 * Pins a coarse locality-level guess onto the exact distance the workbook
 * records for that school.
 *
 * When the geocoder can only resolve a school to its village, every school in
 * that village collapses onto one centroid — two markers on top of each other,
 * both at the wrong radius. But the workbook independently records each
 * school's straight-line distance from Canggu, so the true location is known to
 * lie somewhere on a circle of that radius. Keeping the *bearing* of the
 * village centroid and correcting the *radius* to the recorded figure yields a
 * point that is consistent with the workbook by construction, and separates
 * schools that share a village because their recorded distances differ.
 */
export function snapToRecordedDistance(
  approximate: LatLng,
  recordedKm: number,
): LatLng {
  return destination(CANGGU, bearingRad(CANGGU, approximate), recordedKm);
}

export function isInBali(p: LatLng): boolean {
  return (
    p.lat >= BALI_BOUNDS.minLat &&
    p.lat <= BALI_BOUNDS.maxLat &&
    p.lng >= BALI_BOUNDS.minLng &&
    p.lng <= BALI_BOUNDS.maxLng
  );
}
