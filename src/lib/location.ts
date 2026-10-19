import * as Location from 'expo-location';
import { Platform } from 'react-native';

export type Coords = { latitude: number; longitude: number };

export type LocateResult = { coords: Coords } | { error: 'denied' | 'unavailable' };

// Asked at most once per visit while it succeeds; failures can be retried.
let cached: Promise<LocateResult> | null = null;

/** The visitor's approximate location, or why it couldn't be had (asks permission the first time). */
export function locate(): Promise<LocateResult> {
  cached ??= (async (): Promise<LocateResult> => {
    try {
      const { granted } = await Location.requestForegroundPermissionsAsync();
      if (!granted) return { error: 'denied' };
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 10 * 60 * 1000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
      return { coords: { latitude: pos.coords.latitude, longitude: pos.coords.longitude } };
    } catch (e) {
      // Browsers report PERMISSION_DENIED as code 1; anything else means the device couldn't tell.
      return { error: (e as { code?: number }).code === 1 ? 'denied' : 'unavailable' };
    }
  })();
  return cached.then((r) => {
    if ('error' in r) cached = null; // let them retry after fixing permissions
    return r;
  });
}

/** Same as locate(), for callers that just carry on without a location. */
export async function getCoords(): Promise<Coords | null> {
  const r = await locate();
  return 'coords' in r ? r.coords : null;
}

/** What to tell people when locate() fails, per platform. */
export function locateErrorMessage(error: 'denied' | 'unavailable'): string {
  if (Platform.OS !== 'web') {
    return error === 'denied'
      ? 'Location access is off for this app. Turn it on in the iPhone Settings app (Privacy & Security → Location Services), then try again.'
      : 'Your phone couldn’t find your location right now. Check that Location Services is on and try again.';
  }
  return error === 'denied'
    ? 'Your browser is blocking location for this site. Click the icon at the left of the address bar, allow Location, then try again. On a Mac, also check System Settings → Privacy & Security → Location Services is on for your browser.'
    : 'Your device couldn’t find your location. On a Mac: System Settings → Privacy & Security → Location Services must be on, and on for your browser. Wi-Fi helps too.';
}

const EARTH_RADIUS_MILES = 3958.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Straight-line ("as the crow flies") distance in miles. */
export function distanceMiles(a: Coords, b: Coords): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(h));
}

/** Lat/lng box that contains the circle of `miles` around `c` (for a cheap database filter). */
export function boxAround(c: Coords, miles: number) {
  const latDelta = miles / 69; // ~69 miles per degree of latitude
  const lngDelta = miles / (69 * Math.max(Math.cos(toRad(c.latitude)), 0.2));
  return {
    minLat: c.latitude - latDelta,
    maxLat: c.latitude + latDelta,
    minLng: c.longitude - lngDelta,
    maxLng: c.longitude + lngDelta,
  };
}

export function formatMiles(miles: number): string {
  return miles < 0.1 ? 'nearby' : `${miles < 10 ? miles.toFixed(1) : Math.round(miles)} mi`;
}
