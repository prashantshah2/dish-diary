import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { ContributorGate } from '@/components/contributor-gate';
import { DishReviews } from '@/components/dish-reviews';
import { LikeCounts, Stars, VerdictBadge } from '@/components/rating';
import { ReportButton } from '@/components/report-button';
import { AppText, Button, Card, EmptyState, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';
import { cuisineLabel, verdict, type DishSummary, type RestaurantSummary } from '@/lib/types';
import { MAX_CONTENT_WIDTH, radius, space, useBreakpoint, useColors } from '@/lib/theme';

const SECTIONS = [
  { key: 'must-try', title: 'Must try' },
  { key: 'mixed', title: 'Mixed opinions' },
  { key: 'untried', title: 'No reviews yet' },
  { key: 'skip', title: 'Skip these' },
] as const;

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isWide } = useBreakpoint();
  const c = useColors();
  const [restaurant, setRestaurant] = useState<RestaurantSummary | null>(null);
  const [dishes, setDishes] = useState<DishSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('restaurant_summaries').select('*').eq('id', id).maybeSingle(),
      supabase.from('dish_summaries').select('*').eq('restaurant_id', id).order('name'),
    ]).then(([r, d]) => {
      if (!active) return;
      setError(r.error || d.error ? friendlyError(r.error ?? d.error) : null);
      setRestaurant(r.data as RestaurantSummary | null);
      setDishes((d.data as DishSummary[]) ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id, version]);

  // On wide screens, fall back to the first dish so the right-hand pane is never empty.
  const activeDish = selected ?? (isWide ? (dishes[0]?.id ?? null) : null);

  if (loading) return <Screen><Loading /></Screen>;
  if (!restaurant) {
    return (
      <Screen>
        <Notice message={error ?? 'This restaurant was not found or has been removed.'} />
      </Screen>
    );
  }

  const openDish = (dishId: string) => {
    if (isWide) setSelected(dishId);
    else router.push({ pathname: '/dish/[id]', params: { id: dishId } });
  };

  const header = (
    <View style={{ gap: space.xs }}>
      <AppText variant="title">{restaurant.name}</AppText>
      <AppText variant="muted">
        {[restaurant.cuisine && cuisineLabel(restaurant.cuisine), restaurant.price_level ? '$'.repeat(restaurant.price_level) : null].filter(Boolean).join(' · ')}
      </AppText>
      {(restaurant.address || restaurant.city) && (
        <AppText variant="muted">{[restaurant.address, restaurant.city].filter(Boolean).join(', ')}</AppText>
      )}
      <Row>
        <AppText variant="small">Added by {restaurant.author_name || 'Anonymous'}</AppText>
        <ReportButton type="restaurant" id={restaurant.id} />
      </Row>
    </View>
  );

  const dishList = (
    <View style={{ gap: space.lg }}>
      <Notice message={error} />
      {dishes.length === 0 ? (
        <EmptyState title="No dishes yet" body="Add a dish you’ve tried here, then say whether you liked it." />
      ) : (
        SECTIONS.map(({ key, title }) => {
          const group = dishes
            .filter((d) => verdict(d) === key)
            .sort((a, b) => b.likes - b.dislikes - (a.likes - a.dislikes));
          if (!group.length) return null;
          return (
            <View key={key} style={{ gap: space.sm }}>
              <AppText variant="heading">{title}</AppText>
              {group.map((d) => (
                <DishRow key={d.id} dish={d} active={isWide && d.id === activeDish} onPress={() => openDish(d.id)} />
              ))}
            </View>
          );
        })
      )}
      <AddDish restaurantId={restaurant.id} onAdded={(dishId) => { reload(); openDish(dishId); }} />
    </View>
  );

  return (
    <>
      <Stack.Screen options={{ title: restaurant.name }} />
      {isWide ? (
        // Tablet/desktop: dish list on the left, selected dish's reviews on the right.
        <View style={{ flex: 1, flexDirection: 'row', width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' }}>
          <ScrollView style={{ flex: 2, borderRightWidth: 1, borderRightColor: c.border }} contentContainerStyle={{ padding: space.xl, gap: space.lg }}>
            {header}
            {dishList}
          </ScrollView>
          <ScrollView style={{ flex: 3 }} contentContainerStyle={{ padding: space.xl }}>
            {activeDish ? (
              <DishReviews key={activeDish} dishId={activeDish} onChanged={reload} />
            ) : (
              <EmptyState title="Pick a dish" body="Select a dish on the left to see what people thought." />
            )}
          </ScrollView>
        </View>
      ) : (
        <Screen>
          {header}
          {dishList}
        </Screen>
      )}
    </>
  );
}

function DishRow({ dish, active, onPress }: { dish: DishSummary; active: boolean; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      <Card style={active ? { borderColor: c.primary, borderWidth: 2 } : undefined}>
        <Row style={{ justifyContent: 'space-between' }}>
          <AppText variant="label" style={{ flexShrink: 1, fontSize: 16 }} numberOfLines={2}>
            {dish.name}
          </AppText>
          <VerdictBadge dish={dish} />
        </Row>
        <Row wrap>
          <LikeCounts likes={dish.likes} dislikes={dish.dislikes} />
          <Stars value={dish.avg_rating} size={13} />
        </Row>
      </Card>
    </Pressable>
  );
}

function AddDish({ restaurantId, onAdded }: { restaurantId: string; onAdded: (dishId: string) => void }) {
  const { displayName } = useAuth();
  const c = useColors();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) {
    return (
      <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: c.border, borderRadius: radius.md, padding: space.sm }}>
        <Button title="+ Add a dish" variant="ghost" onPress={() => setOpen(true)} />
      </View>
    );
  }

  const save = async () => {
    if (!name.trim()) return setError('Enter the dish name.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('dishes')
      .insert({ restaurant_id: restaurantId, name: name.trim(), author_name: displayName || null })
      .select('id')
      .single();
    setBusy(false);
    if (err) return setError(friendlyError(err));
    setName('');
    setOpen(false);
    onAdded(data.id);
  };

  return (
    <ContributorGate>
      <Card>
        <Field label="Dish name" value={name} onChangeText={setName} placeholder="e.g. Butter chicken" maxLength={120} autoFocus onSubmitEditing={save} />
        <Notice message={error} />
        <Row>
          <Button title="Add dish" onPress={save} loading={busy} />
          <Button title="Cancel" variant="ghost" onPress={() => setOpen(false)} />
        </Row>
      </Card>
    </ContributorGate>
  );
}
