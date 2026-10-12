import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ContributorGate, NameField } from '@/components/contributor-gate';
import { AppText, Button, Card, Chip, Field, Notice, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';
import { CUISINES } from '@/lib/types';
import { space } from '@/lib/theme';

export default function NewRestaurantScreen() {
  const { displayName } = useAuth();
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Please enter the restaurant name.');
    setBusy(true);
    setError(null);
    const { data, error: err } = await supabase
      .from('restaurants')
      .insert({
        name: name.trim(),
        cuisine,
        price_level: price,
        address: address.trim() || null,
        city: city.trim() || null,
        author_name: displayName || null,
      })
      .select('id')
      .single();
    setBusy(false);
    if (err) return setError(friendlyError(err));
    router.replace({ pathname: '/restaurant/[id]', params: { id: data.id } });
  };

  return (
    <Screen>
      <View style={{ maxWidth: 640, width: '100%', gap: space.lg }}>
        <AppText variant="title">Add a restaurant</AppText>
        <AppText variant="muted">Add the place first — then you can add dishes and reviews to it.</AppText>
        <ContributorGate>
          <Card style={{ gap: space.lg }}>
            <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Taj Palace" maxLength={120} />
            <View style={{ gap: space.xs }}>
              <AppText variant="label">Cuisine</AppText>
              <Row wrap>
                {CUISINES.map((c) => (
                  <Chip key={c} label={c} selected={cuisine === c} onPress={() => setCuisine(cuisine === c ? null : c)} />
                ))}
              </Row>
            </View>
            <View style={{ gap: space.xs }}>
              <AppText variant="label">Price</AppText>
              <Row wrap>
                {[1, 2, 3, 4].map((p) => (
                  <Chip key={p} label={'$'.repeat(p)} selected={price === p} onPress={() => setPrice(price === p ? null : p)} />
                ))}
              </Row>
            </View>
            <Field label="Street address" value={address} onChangeText={setAddress} placeholder="123 Main St" maxLength={300} />
            <Field label="City" value={city} onChangeText={setCity} placeholder="e.g. San Jose" maxLength={80} />
            <NameField />
            <Notice message={error} />
            <Row>
              <Button title="Add restaurant" onPress={save} loading={busy} />
              <Button title="Cancel" variant="ghost" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
            </Row>
          </Card>
        </ContributorGate>
      </View>
    </Screen>
  );
}
