/**
 * Restaurant lookup. Google Places first, through the `place-search` Edge Function
 * (which holds the key and stays inside the free tiers); Photon (komoot's free
 * OpenStreetMap search) when Google is unavailable or its daily cap is used up.
 * Results must be credited: "Google Maps" or "© OpenStreetMap contributors".
 */

import type { Coords } from './location';
import { supabase } from './supabase';

const PHOTON_URL = 'https://photon.komoot.io/api/';

/** After Google fails (e.g. daily cap reached), use Photon for a while before retrying. */
const GOOGLE_RETRY_MS = 10 * 60 * 1000;
let googleDownUntil = 0;

/**
 * Groups the typing and the final pick into one Google session (one billable details
 * call, free autocomplete). A new token starts after each pick.
 */
let sessionToken: string | null = null;

function newSessionToken(): string {
  let s = '';
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}

const PLACE_TAGS = [
  'amenity:restaurant',
  'amenity:cafe',
  'amenity:bar',
  'amenity:pub',
  'amenity:fast_food',
  'amenity:ice_cream',
  'amenity:food_court',
  'shop:bakery',
];

/** Half-size of the search box around the visitor, in degrees latitude (~30 km). */
const BOX_DEGREES = 0.27;

export type PlaceResult = {
  /** OpenStreetMap id, e.g. "N2501812416" — stable, used to spot duplicates. */
  osmId: string | null;
  /** Google place id; the only Google value we may store long-term. */
  googlePlaceId: string | null;
  name: string;
  street: string;
  city: string;
  region: string;
  postcode: string;
  /** ISO country code, e.g. "US". */
  countryCode: string;
  /** Photon only — Google coordinates may not be stored, so those are looked up on save. */
  latitude: number | null;
  longitude: number | null;
};

/** One row in the search results; `resolve` fills in the address when picked. */
export type PlaceSuggestion = {
  key: string;
  name: string;
  description: string;
  resolve: () => Promise<PlaceResult>;
};

export type PlaceSearchResults = { source: 'google' | 'osm'; suggestions: PlaceSuggestion[] };

type PhotonFeature = {
  geometry?: { coordinates?: [number, number] }; // [longitude, latitude]
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    postcode?: string;
    countrycode?: string;
    osm_type?: string;
    osm_value?: string;
    osm_id?: number;
  };
};

function buildUrl(query: string, coords: Coords | null, boxed: boolean): string {
  const params = new URLSearchParams({ q: query, limit: '5' });
  PLACE_TAGS.forEach((tag) => params.append('osm_tag', tag));
  if (coords) {
    params.set('lat', coords.latitude.toFixed(4));
    params.set('lon', coords.longitude.toFixed(4));
    if (boxed) {
      // Longitude degrees shrink toward the poles, so widen the box to stay ~square.
      const lonDelta = BOX_DEGREES / Math.max(Math.cos((coords.latitude * Math.PI) / 180), 0.2);
      params.set(
        'bbox',
        [
          coords.longitude - lonDelta,
          coords.latitude - BOX_DEGREES,
          coords.longitude + lonDelta,
          coords.latitude + BOX_DEGREES,
        ]
          .map((n) => n.toFixed(4))
          .join(',')
      );
    }
  }
  return `${PHOTON_URL}?${params}`;
}

async function fetchPlaces(url: string, signal?: AbortSignal): Promise<PlaceResult[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Search service returned ${res.status}`);
  const data = (await res.json()) as { features?: PhotonFeature[] };
  const results: PlaceResult[] = [];
  for (const { properties: p, geometry } of data.features ?? []) {
    const [longitude, latitude] = geometry?.coordinates ?? [];
    if (!p.name || !p.osm_type || p.osm_id == null || latitude == null || longitude == null) continue;
    const osmId = `${p.osm_type}${p.osm_id}`;
    if (results.some((r) => r.osmId === osmId)) continue;
    results.push({
      osmId,
      googlePlaceId: null,
      name: p.name,
      street: [p.housenumber, p.street].filter(Boolean).join(' '),
      city: p.city ?? p.district ?? p.county ?? '',
      region: p.state ?? '',
      postcode: p.postcode ?? '',
      countryCode: p.countrycode?.toUpperCase() ?? '',
      latitude,
      longitude,
    });
  }
  return results;
}

/**
 * Photon search by name or "street number + street". With coords, results are
 * limited to the visitor's area first; if nothing matches there, searches everywhere
 * (still preferring nearby) so out-of-town places can be found too.
 */
async function searchPhoton(q: string, coords: Coords | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  if (coords) {
    const nearby = await fetchPlaces(buildUrl(q, coords, true), signal);
    if (nearby.length) return nearby;
  }
  return fetchPlaces(buildUrl(q, coords, false), signal);
}

async function callGoogle<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('place-search', { body, signal });
  if (error || !data) throw error ?? new Error('Search service returned nothing');
  return data;
}

async function searchGoogle(q: string, coords: Coords | null, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  sessionToken ??= newSessionToken();
  const token = sessionToken;
  const { results } = await callGoogle<{ results: { placeId: string; name: string; description: string }[] }>(
    { action: 'autocomplete', input: q, sessionToken: token, lat: coords?.latitude, lng: coords?.longitude },
    signal
  );
  return results.map((r) => ({
    key: r.placeId,
    name: r.name,
    description: r.description,
    resolve: async () => {
      sessionToken = null; // the pick ends this session
      const place: PlaceResult = {
        osmId: null,
        googlePlaceId: r.placeId,
        name: r.name,
        street: '',
        city: '',
        region: '',
        postcode: '',
        countryCode: '',
        latitude: null,
        longitude: null,
      };
      try {
        const address = await callGoogle<Pick<PlaceResult, 'street' | 'city' | 'region' | 'postcode' | 'countryCode'>>({
          action: 'details',
          placeId: r.placeId,
          sessionToken: token,
        });
        return { ...place, ...address };
      } catch {
        return place; // name only; they can type the address
      }
    },
  }));
}

/** Finds restaurants by name (or, with Photon, by street address too). */
export async function searchPlaces(query: string, coords: Coords | null, signal?: AbortSignal): Promise<PlaceSearchResults> {
  const q = query.trim();
  if (q.length < 3) return { source: 'osm', suggestions: [] };
  if (Date.now() >= googleDownUntil) {
    try {
      return { source: 'google', suggestions: await searchGoogle(q, coords, signal) };
    } catch (e) {
      if (signal?.aborted) throw e;
      googleDownUntil = Date.now() + GOOGLE_RETRY_MS;
    }
  }
  const places = await searchPhoton(q, coords, signal);
  return {
    source: 'osm',
    suggestions: places.map((p) => ({
      key: p.osmId!,
      name: p.name,
      description: [p.street, p.city, p.region].filter(Boolean).join(' · '),
      resolve: async () => p,
    })),
  };
}

// Street-name words that don't identify a street (types, directions, units).
const GENERIC_STREET_WORDS = new Set(
  'st street rd road ave avenue blvd boulevard dr drive ln lane way ct court pl place pkwy parkway hwy highway cir circle ter terrace sq square n s e w ne nw se sw north south east west suite ste unit apt'.split(' ')
);

async function photonFeatures(params: URLSearchParams): Promise<PhotonFeature[]> {
  try {
    const res = await fetch(`${PHOTON_URL}?${params}`);
    if (!res.ok) return [];
    return ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
  } catch {
    return [];
  }
}

function coordsOf(f: PhotonFeature | undefined): Coords | null {
  const [longitude, latitude] = f?.geometry?.coordinates ?? [];
  return latitude == null || longitude == null ? null : { latitude, longitude };
}

const sameCountry = (f: PhotonFeature, countryCode?: string) =>
  !countryCode || f.properties.countrycode?.toUpperCase() === countryCode.toUpperCase();

/**
 * Map position for a restaurant's address, from OpenStreetMap (never Google, whose
 * coordinates may not be stored). Tries, in order:
 *   1. the exact address: same house number on a street with the same name;
 *   2. the middle of its ZIP / postcode area (about 1–3 miles off), if one is known;
 * and otherwise returns null rather than a wrong spot. Photon answers a missing house
 * number with some other building, so close-but-different matches are rejected.
 */
export async function geocodeAddress(
  street: string,
  city: string,
  hint: { postcode?: string; countryCode?: string; near?: Coords | null } = {}
): Promise<Coords | null> {
  const houseNumber = street.trim().match(/^(\d+[a-z]?)\b/i)?.[1].toLowerCase();
  const streetWords = street
    .toLowerCase()
    .replace(/^\s*\d+[a-z]?\b/, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !/\d/.test(w) && !GENERIC_STREET_WORDS.has(w));

  const q = [street, city].map((s) => s.trim()).filter(Boolean).join(', ');
  if (houseNumber && streetWords.length && q.length >= 5) {
    const params = new URLSearchParams({ q, limit: '5' });
    if (hint.near) {
      params.set('lat', hint.near.latitude.toFixed(4));
      params.set('lon', hint.near.longitude.toFixed(4));
    }
    const exact = (await photonFeatures(params)).find(({ properties: p }) => {
      const found = p.street?.toLowerCase() ?? '';
      return (
        p.housenumber?.toLowerCase().replace(/\s/g, '') === houseNumber &&
        streetWords.every((w) => found.includes(w)) &&
        sameCountry({ properties: p }, hint.countryCode)
      );
    });
    if (exact) return coordsOf(exact);
  }

  const postcode = hint.postcode?.trim();
  if (postcode) {
    // The same postcode exists in several countries, so check the country too.
    const area = (await photonFeatures(new URLSearchParams({ q: postcode, limit: '10' }))).find(
      (f) => f.properties.osm_value === 'postcode' &&
        (f.properties.postcode ?? f.properties.name) === postcode &&
        sameCountry(f, hint.countryCode)
    );
    if (area) return coordsOf(area);
  }

  return null; // coordinates are optional; never block saving
}
