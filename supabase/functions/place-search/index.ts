// Dish Diary — restaurant search through Google Places API (New).
// Keeps the Google key (secret GOOGLE_PLACES_API_KEY) off devices and fixes which
// fields are requested, so every call stays in the free tiers:
//   - autocomplete: billed as "Autocomplete Session Usage" (free) when the session
//     ends with a details call using the same session token.
//   - details: only addressComponents → "Place Details Essentials" (10k free/month).
// Daily caps are set in Google Cloud; when they're hit Google returns 429 and the
// app falls back to Photon.
//
// Deploy with JWT verification off; the handler checks the user itself.

import { createClient } from 'npm:@supabase/supabase-js@2';

const GOOGLE_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
const PLACES = 'https://places.googleapis.com/v1';

// Primary-type filters don't match subtypes (e.g. indian_restaurant), so filter on
// every type a suggestion carries instead.
const FOOD_TYPES = new Set(['restaurant', 'food', 'cafe', 'bar', 'pub', 'bakery', 'meal_takeaway', 'meal_delivery', 'ice_cream_shop', 'food_court', 'coffee_shop']);

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

type Prediction = {
  placeId: string;
  types?: string[];
  structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
};

type AddressComponent = { longText?: string; shortText?: string; types?: string[] };

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  if (!GOOGLE_KEY) return json({ error: 'not_configured' }, 503);

  // Only people with a session (the app's contributors) may search.
  const token = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!token) return json({ error: 'auth' }, 401);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { data: auth } = await supabase.auth.getUser(token);
  if (!auth.user) return json({ error: 'auth' }, 401);

  let body: { action?: string; input?: string; sessionToken?: string; placeId?: string; lat?: number; lng?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const session = typeof body.sessionToken === 'string' && /^[\w-]{8,64}$/.test(body.sessionToken) ? body.sessionToken : undefined;

  if (body.action === 'autocomplete') {
    const input = typeof body.input === 'string' ? body.input.trim().slice(0, 120) : '';
    if (input.length < 3) return json({ results: [] });
    const near = Number.isFinite(body.lat) && Number.isFinite(body.lng);
    const res = await fetch(`${PLACES}/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_KEY,
        'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.types,suggestions.placePrediction.structuredFormat',
      },
      body: JSON.stringify({
        input,
        ...(session ? { sessionToken: session } : {}),
        ...(near ? { locationBias: { circle: { center: { latitude: body.lat, longitude: body.lng }, radius: 30000 } } } : {}),
      }),
    });
    if (!res.ok) return json({ error: 'google', status: res.status }, res.status === 429 ? 429 : 502);
    const data = (await res.json()) as { suggestions?: { placePrediction?: Prediction }[] };
    const results = (data.suggestions ?? [])
      .map((s) => s.placePrediction)
      .filter((p): p is Prediction => !!p?.placeId && !!p.types?.some((t) => FOOD_TYPES.has(t)))
      .map((p) => ({
        placeId: p.placeId,
        name: p.structuredFormat?.mainText?.text ?? '',
        description: p.structuredFormat?.secondaryText?.text ?? '',
      }))
      .filter((p) => p.name);
    return json({ results });
  }

  if (body.action === 'details') {
    const placeId = typeof body.placeId === 'string' && /^[\w-]{10,300}$/.test(body.placeId) ? body.placeId : null;
    if (!placeId) return json({ error: 'bad_request' }, 400);
    const params = session ? `?sessionToken=${encodeURIComponent(session)}` : '';
    const res = await fetch(`${PLACES}/places/${placeId}${params}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_KEY, 'X-Goog-FieldMask': 'addressComponents' },
    });
    if (!res.ok) return json({ error: 'google', status: res.status }, res.status === 429 ? 429 : 502);
    const data = (await res.json()) as { addressComponents?: AddressComponent[] };
    const part = (type: string, short = false) => {
      const c = data.addressComponents?.find((a) => a.types?.includes(type));
      return (short ? c?.shortText : c?.longText) ?? '';
    };
    return json({
      street: [part('street_number'), part('route')].filter(Boolean).join(' '),
      city: part('locality') || part('postal_town') || part('sublocality') || part('administrative_area_level_2'),
      region: part('administrative_area_level_1', true),
      // Used only to place the restaurant via OpenStreetMap when its exact address isn't there.
      postcode: part('postal_code'),
      countryCode: part('country', true),
    });
  }

  return json({ error: 'bad_request' }, 400);
});
