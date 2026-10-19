import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { HiddenBadge } from '@/components/admin-tools';
import { AppText, Button, Card, Chip, EmptyState, Field, Grid, Loading, Notice, Row, Screen } from '@/components/ui';
import { boxAround, distanceMiles, formatMiles, locate, locateErrorMessage, type Coords } from '@/lib/location';
import { friendlyError, supabase } from '@/lib/supabase';
import { CUISINES, cuisineLabel, type RestaurantSummary } from '@/lib/types';
import { space } from '@/lib/theme';

const RADII_MILES = [2, 5, 10, 25];

type Listed = RestaurantSummary & { distance?: number };

/** Escape characters that have special meaning in a SQL LIKE pattern. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export default function RestaurantsScreen() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [items, setItems] = useState<Listed[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // "Near me": reviewed places within `radius` miles of `here`, nearest first.
  const [here, setHere] = useState<Coords | null>(null);
  const [radius, setRadius] = useState(10);
  const [locating, setLocating] = useState(false);

  const toggleNearMe = async () => {
    if (here) return setHere(null);
    setLocating(true);
    setError(null);
    const result = await locate();
    setLocating(false);
    if ('coords' in result) setHere(result.coords);
    else setError(locateErrorMessage(result.error));
  };

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    let q = supabase.from('restaurant_summaries').select('*').order('name').limit(200);
    if (debounced) {
      const pattern = `%${likeEscape(debounced)}%`;
      q = q.or(`name.ilike.${JSON.stringify(pattern)},city.ilike.${JSON.stringify(pattern)}`);
    }
    if (cuisine) q = q.eq('cuisine', cuisine);
    if (here) {
      // Cheap box filter in the database, exact distance below.
      const box = boxAround(here, radius);
      q = q
        .gt('review_count', 0)
        .gte('lat', box.minLat)
        .lte('lat', box.maxLat)
        .gte('lng', box.minLng)
        .lte('lng', box.maxLng);
    }
    const { data, error: err } = await q;
    setError(err ? friendlyError(err) : null);
    let rows: Listed[] = (data as RestaurantSummary[]) ?? [];
    if (here) {
      rows = rows
        .map((r) => ({ ...r, distance: distanceMiles(here, { latitude: r.lat!, longitude: r.lng! }) }))
        .filter((r) => r.distance <= radius)
        .sort((a, b) => a.distance - b.distance);
    }
    setItems(rows);
  }, [debounced, cuisine, here, radius]);

  // Reload whenever this screen comes back into view (e.g. after adding a place).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <AppText variant="title">Restaurants</AppText>
        <Button title="+ Add restaurant" onPress={() => router.push('/restaurant/new')} />
      </Row>

      {/* Two ways to find places, side by side: type a search, or use your location. */}
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field
            label="Search"
            value={query}
            onChangeText={setQuery}
            placeholder="Restaurant name or city"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <AppText variant="muted" style={{ paddingBottom: space.md - 2 }}>or</AppText>
        <Button
          title={locating ? 'Finding you…' : '📍 Near me'}
          variant={here ? 'primary' : 'secondary'}
          onPress={toggleNearMe}
          loading={locating}
        />
      </Row>
      {here && (
        <View style={{ gap: space.xs }}>
          <Row wrap style={{ gap: space.xs + 2 }}>
            {RADII_MILES.map((mi) => (
              <Chip key={mi} label={`Within ${mi} mi`} selected={radius === mi} onPress={() => setRadius(mi)} />
            ))}
          </Row>
          <AppText variant="small">Reviewed restaurants within {radius} miles of you, nearest first. Tap 📍 Near me again to see all.</AppText>
        </View>
      )}

      {/* Wraps onto extra lines so every cuisine is visible without sideways scrolling. */}
      <Row wrap style={{ gap: space.xs + 2 }}>
        <Chip label="All" selected={!cuisine} onPress={() => setCuisine(null)} />
        {CUISINES.map((name) => (
          <Chip key={name} label={cuisineLabel(name)} selected={cuisine === name} onPress={() => setCuisine(cuisine === name ? null : name)} />
        ))}
      </Row>

      <Notice message={error} />

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          title={here ? `No reviewed restaurants within ${radius} miles` : debounced || cuisine ? 'No matches' : 'No restaurants yet'}
          body={
            here
              ? 'Try a bigger distance, or add a place near you and review it.'
              : debounced || cuisine
                ? 'Try a different search, or add the place yourself.'
                : 'Be the first to add a place you’ve eaten at.'
          }
          action={<Button title="Add a restaurant" onPress={() => router.push('/restaurant/new')} />}
        />
      ) : (
        <Grid items={items} keyOf={(r) => r.id} render={(r) => <RestaurantCard r={r} />} />
      )}
    </Screen>
  );
}

function RestaurantCard({ r }: { r: Listed }) {
  return (
    <Link href={{ pathname: '/restaurant/[id]', params: { id: r.id } }} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, height: '100%' })}>
        <Card style={{ height: '100%' }}>
          <AppText variant="heading" numberOfLines={2}>
            {r.name}
          </AppText>
          <HiddenBadge hidden={r.is_hidden} />
          <AppText variant="muted" numberOfLines={1}>
            {[r.cuisine && cuisineLabel(r.cuisine), r.price_level ? '$'.repeat(r.price_level) : null, r.city].filter(Boolean).join(' · ') || ' '}
          </AppText>
          <AppText variant="small">
            {r.distance != null ? `📍 ${formatMiles(r.distance)} · ` : ''}
            {r.dish_count} {r.dish_count === 1 ? 'dish' : 'dishes'} · {r.review_count}{' '}
            {r.review_count === 1 ? 'review' : 'reviews'}
          </AppText>
        </Card>
      </Pressable>
    </Link>
  );
}
