import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable } from 'react-native';

import { AppText, Button, Card, Chip, EmptyState, Field, Grid, Loading, Notice, Row, Screen } from '@/components/ui';
import { friendlyError, supabase } from '@/lib/supabase';
import { CUISINES, type RestaurantSummary } from '@/lib/types';
import { space } from '@/lib/theme';

/** Escape characters that have special meaning in a SQL LIKE pattern. */
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);

export default function RestaurantsScreen() {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [items, setItems] = useState<RestaurantSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    const { data, error: err } = await q;
    setError(err ? friendlyError(err) : null);
    setItems((data as RestaurantSummary[]) ?? []);
  }, [debounced, cuisine]);

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

      <Field
        label="Search"
        value={query}
        onChangeText={setQuery}
        placeholder="Restaurant name or city"
        autoCorrect={false}
        returnKeyType="search"
      />

      {/* Wraps onto extra lines so every cuisine is visible without sideways scrolling. */}
      <Row wrap style={{ gap: space.xs + 2 }}>
        <Chip label="All" selected={!cuisine} onPress={() => setCuisine(null)} />
        {CUISINES.map((name) => (
          <Chip key={name} label={name} selected={cuisine === name} onPress={() => setCuisine(cuisine === name ? null : name)} />
        ))}
      </Row>

      <Notice message={error} />

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <EmptyState
          title={debounced || cuisine ? 'No matches' : 'No restaurants yet'}
          body={debounced || cuisine ? 'Try a different search, or add the place yourself.' : 'Be the first to add a place you’ve eaten at.'}
          action={<Button title="Add a restaurant" onPress={() => router.push('/restaurant/new')} />}
        />
      ) : (
        <Grid items={items} keyOf={(r) => r.id} render={(r) => <RestaurantCard r={r} />} />
      )}
    </Screen>
  );
}

function RestaurantCard({ r }: { r: RestaurantSummary }) {
  return (
    <Link href={{ pathname: '/restaurant/[id]', params: { id: r.id } }} asChild>
      <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1, height: '100%' })}>
        <Card style={{ height: '100%' }}>
          <AppText variant="heading" numberOfLines={2}>
            {r.name}
          </AppText>
          <AppText variant="muted" numberOfLines={1}>
            {[r.cuisine, r.price_level ? '$'.repeat(r.price_level) : null, r.city].filter(Boolean).join(' · ') || ' '}
          </AppText>
          <AppText variant="small">
            {r.dish_count} {r.dish_count === 1 ? 'dish' : 'dishes'} · {r.review_count}{' '}
            {r.review_count === 1 ? 'review' : 'reviews'}
          </AppText>
        </Card>
      </Pressable>
    </Link>
  );
}
