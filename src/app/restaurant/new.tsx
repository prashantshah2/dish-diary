import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ContributorGate, NameField } from '@/components/contributor-gate';
import { PlaceSearch } from '@/components/place-search';
import { Select } from '@/components/select';
import { VisitDateField } from '@/components/visit-date-field';
import { AppText, Button, Card, Chip, Field, Notice, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { geocodeAddress, type PlaceResult } from '@/lib/place-lookup';
import { friendlyError, supabase } from '@/lib/supabase';
import { CUISINES, cuisineLabel } from '@/lib/types';
import { space, useColors } from '@/lib/theme';

export default function NewRestaurantScreen() {
  const { displayName } = useAuth();
  const c = useColors();
  const [name, setName] = useState('');
  const [cuisine, setCuisine] = useState<string | null>(null);
  const [price, setPrice] = useState<number | null>(null);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [visitedOn, setVisitedOn] = useState<string | null>(null);
  // The search pick: its map place id (to spot duplicates), plus position / ZIP for saving.
  const [picked, setPicked] = useState<PlaceResult | null>(null);
  const [existing, setExisting] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickPlace = async (place: PlaceResult) => {
    setError(null);
    // Same map place already added? Send them there instead of creating a duplicate.
    const { data: found } = await supabase
      .from('restaurants')
      .select('id, name')
      .eq(place.googlePlaceId ? 'google_place_id' : 'osm_id', place.googlePlaceId ?? place.osmId)
      .maybeSingle();
    if (found) {
      setExisting(found);
      return;
    }
    setExisting(null);
    setPicked(place);
    setName(place.name);
    setAddress(place.street);
    setCity(place.city);
  };

  const clearPick = () => {
    setPicked(null);
    setName('');
    setAddress('');
    setCity('');
  };

  const save = async () => {
    if (!name.trim()) return setError('Please enter the restaurant name.');
    setBusy(true);
    setError(null);
    // Keep the picked position / ZIP unless they changed the address afterwards.
    // Google picks have no position (it may not be stored), so theirs is looked up here.
    const unchanged = picked && picked.street === address && picked.city === city;
    const coords =
      unchanged && picked.latitude != null && picked.longitude != null
        ? { latitude: picked.latitude, longitude: picked.longitude }
        : await geocodeAddress(address, city, {
            near: picked?.latitude != null && picked.longitude != null ? { latitude: picked.latitude, longitude: picked.longitude } : null,
            ...(unchanged ? { postcode: picked.postcode, countryCode: picked.countryCode } : {}),
          });
    const { data, error: err } = await supabase
      .from('restaurants')
      .insert({
        name: name.trim(),
        cuisine,
        price_level: price,
        address: address.trim() || null,
        city: city.trim() || null,
        notes: notes.trim() || null,
        visited_on: visitedOn,
        // only sent when picked from search
        ...(picked?.osmId ? { osm_id: picked.osmId } : {}),
        ...(picked?.googlePlaceId ? { google_place_id: picked.googlePlaceId } : {}),
        ...(coords ? { lat: coords.latitude, lng: coords.longitude } : {}),
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
            <PlaceSearch onPick={pickPlace} />
            {existing && (
              <Card style={{ backgroundColor: c.surfaceAlt }}>
                <AppText variant="label">{existing.name} is already in Dish Diary.</AppText>
                <Row>
                  <Button
                    title="Open it"
                    compact
                    onPress={() => router.replace({ pathname: '/restaurant/[id]', params: { id: existing.id } })}
                  />
                  <Button title="Dismiss" variant="ghost" compact onPress={() => setExisting(null)} />
                </Row>
              </Card>
            )}
            {picked && (
              <Row wrap>
                <AppText variant="small">Filled from map search — check and edit below.</AppText>
                <AppText variant="small" accessibilityRole="button" onPress={clearPick} style={{ color: c.primary, textDecorationLine: 'underline' }}>
                  Clear
                </AppText>
              </Row>
            )}
            <Field label="Name *" value={name} onChangeText={setName} placeholder="e.g. Taj Palace" maxLength={120} />
            <Select label="Cuisine" value={cuisine} options={CUISINES} onChange={setCuisine} placeholder="Choose a cuisine" formatOption={cuisineLabel} noneLabel="No cuisine" />
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
            <VisitDateField label="When did you go?" value={visitedOn} onChange={setVisitedOn} />
            <Field label="Comments" value={notes} onChangeText={setNotes} placeholder="Atmosphere, service, who you went with…" maxLength={1000} multiline />
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
