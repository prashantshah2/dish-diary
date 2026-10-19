import { useState } from 'react';
import { Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';
import { CUISINES, cuisineLabel, type ReportTarget, type RestaurantSummary } from '@/lib/types';
import { radius, space, useColors } from '@/lib/theme';

import { Select } from './select';
import { AppText, Button, Card, Chip, Field, Notice, Row } from './ui';

const TABLE: Record<ReportTarget, string> = { restaurant: 'restaurants', dish: 'dishes', review: 'reviews' };

export function HiddenBadge({ hidden }: { hidden: boolean }) {
  const c = useColors();
  if (!hidden) return null;
  return (
    <View style={{ backgroundColor: c.dislikedBg, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.danger, fontSize: 12, fontWeight: '700' }}>Hidden — only admins see this</Text>
    </View>
  );
}

/**
 * Edit / Hide / Delete buttons, shown only to admins. Delete asks for a second
 * tap on the page itself (confirm dialogs don't work everywhere).
 */
export function AdminBar({
  type,
  id,
  hidden,
  onChanged,
  onEdit,
  onDeleted,
  deleteWarning,
}: {
  type: ReportTarget;
  id: string;
  hidden: boolean;
  onChanged: () => void;
  onEdit?: () => void;
  onDeleted?: () => void;
  /** Extra text for the delete confirmation, e.g. what else gets deleted. */
  deleteWarning?: string;
}) {
  const { isAdmin } = useAuth();
  const c = useColors();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isAdmin) return null;

  const run = async (op: () => PromiseLike<{ error: { message?: string; code?: string } | null }>, after: () => void) => {
    setBusy(true);
    setError(null);
    const { error: err } = await op();
    setBusy(false);
    if (err) setError(friendlyError(err));
    else after();
  };

  const toggleHidden = () =>
    run(() => supabase.from(TABLE[type]).update({ is_hidden: !hidden }).eq('id', id), onChanged);

  const remove = () =>
    run(() => supabase.from(TABLE[type]).delete().eq('id', id), () => {
      setConfirming(false);
      (onDeleted ?? onChanged)();
    });

  return (
    <View style={{ gap: space.xs, borderLeftWidth: 3, borderLeftColor: c.primary, paddingLeft: space.sm }}>
      {confirming ? (
        <>
          <AppText variant="small" style={{ color: c.danger }}>
            Delete this {type} permanently?{deleteWarning ? ` ${deleteWarning}` : ''} Hiding is reversible; deleting is not.
          </AppText>
          <Row wrap>
            <Button title="Yes, delete" variant="danger" compact loading={busy} onPress={remove} />
            <Button title="Cancel" variant="ghost" compact onPress={() => setConfirming(false)} />
          </Row>
        </>
      ) : (
        <Row wrap>
          <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>Admin</AppText>
          {onEdit && <Button title="Edit" variant="secondary" compact onPress={onEdit} />}
          <Button title={hidden ? 'Unhide' : 'Hide'} variant="secondary" compact loading={busy} onPress={toggleHidden} />
          <Button title="Delete" variant="danger" compact onPress={() => setConfirming(true)} />
        </Row>
      )}
      <Notice message={error} />
    </View>
  );
}

/** Admin edit of a restaurant's details (author name is left as posted). */
export function RestaurantEditForm({
  restaurant,
  onDone,
}: {
  restaurant: RestaurantSummary;
  onDone: (saved: boolean) => void;
}) {
  const [name, setName] = useState(restaurant.name);
  const [cuisine, setCuisine] = useState<string | null>(restaurant.cuisine);
  const [price, setPrice] = useState<number | null>(restaurant.price_level);
  const [address, setAddress] = useState(restaurant.address ?? '');
  const [city, setCity] = useState(restaurant.city ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Name can’t be empty.');
    setBusy(true);
    const { error: err } = await supabase
      .from('restaurants')
      .update({ name: name.trim(), cuisine, price_level: price, address: address.trim() || null, city: city.trim() || null })
      .eq('id', restaurant.id);
    setBusy(false);
    if (err) setError(friendlyError(err));
    else onDone(true);
  };

  return (
    <Card style={{ gap: space.md }}>
      <AppText variant="heading">Edit restaurant</AppText>
      <Field label="Name" value={name} onChangeText={setName} maxLength={120} />
      <Select label="Cuisine" value={cuisine} options={CUISINES} onChange={setCuisine} formatOption={cuisineLabel} noneLabel="No cuisine" />
      <View style={{ gap: space.xs }}>
        <AppText variant="label">Price</AppText>
        <Row wrap>
          {[1, 2, 3, 4].map((p) => (
            <Chip key={p} label={'$'.repeat(p)} selected={price === p} onPress={() => setPrice(price === p ? null : p)} />
          ))}
        </Row>
      </View>
      <Field label="Street address" value={address} onChangeText={setAddress} maxLength={300} />
      <Field label="City" value={city} onChangeText={setCity} maxLength={80} />
      <Notice message={error} />
      <Row>
        <Button title="Save" onPress={save} loading={busy} />
        <Button title="Cancel" variant="ghost" onPress={() => onDone(false)} />
      </Row>
    </Card>
  );
}

/** Admin rename of a dish. */
export function DishRenameForm({ dishId, name: initial, onDone }: { dishId: string; name: string; onDone: (saved: boolean) => void }) {
  const [name, setName] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) return setError('Name can’t be empty.');
    setBusy(true);
    const { error: err } = await supabase.from('dishes').update({ name: name.trim() }).eq('id', dishId);
    setBusy(false);
    if (err) setError(friendlyError(err));
    else onDone(true);
  };

  return (
    <Card>
      <Field label="Dish name" value={name} onChangeText={setName} maxLength={120} autoFocus onSubmitEditing={save} />
      <Notice message={error} />
      <Row>
        <Button title="Save" onPress={save} loading={busy} compact />
        <Button title="Cancel" variant="ghost" onPress={() => onDone(false)} compact />
      </Row>
    </Card>
  );
}
