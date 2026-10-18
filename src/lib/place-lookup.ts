/**
 * Restaurant lookup via Photon (komoot's free OpenStreetMap search).
 * No key or account; the public instance throttles heavy use, which this app won't hit.
 * Results must be credited: "© OpenStreetMap contributors".
 */

const PHOTON_URL = 'https://photon.komoot.io/api/';

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

export type Coords = { latitude: number; longitude: number };

export type PlaceResult = {
  /** OpenStreetMap id, e.g. "N2501812416" — stable, used to spot duplicates. */
  osmId: string;
  name: string;
  street: string;
  city: string;
  region: string;
};

type PhotonFeature = {
  properties: {
    name?: string;
    housenumber?: string;
    street?: string;
    city?: string;
    district?: string;
    county?: string;
    state?: string;
    osm_type?: string;
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
  for (const { properties: p } of data.features ?? []) {
    if (!p.name || !p.osm_type || p.osm_id == null) continue;
    const osmId = `${p.osm_type}${p.osm_id}`;
    if (results.some((r) => r.osmId === osmId)) continue;
    results.push({
      osmId,
      name: p.name,
      street: [p.housenumber, p.street].filter(Boolean).join(' '),
      city: p.city ?? p.district ?? p.county ?? '',
      region: p.state ?? '',
    });
  }
  return results;
}

/**
 * Finds restaurants by name or "street number + street". With coords, results are
 * limited to the visitor's area first; if nothing matches there, searches everywhere
 * (still preferring nearby) so out-of-town places can be found too.
 */
export async function searchPlaces(query: string, coords: Coords | null, signal?: AbortSignal): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  if (coords) {
    const nearby = await fetchPlaces(buildUrl(q, coords, true), signal);
    if (nearby.length) return nearby;
  }
  return fetchPlaces(buildUrl(q, coords, false), signal);
}
