import { useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { formatVisitDate } from '@/lib/dates';
import { friendlyError, supabase } from '@/lib/supabase';
import type { RestaurantSummary } from '@/lib/types';
import { space, useColors } from '@/lib/theme';

import { AppText, Button, Card, Field, Notice, Row } from './ui';
import { VisitDateField } from './visit-date-field';

/**
 * The restaurant's comment and visit date. Whoever added the restaurant, and
 * admins, can edit or delete it (delete clears both, the restaurant stays).
 */
export function RestaurantComment({ restaurant, onChanged }: { restaurant: RestaurantSummary; onChanged: () => void }) {
  const { userId, isAdmin } = useAuth();
  const c = useColors();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [notes, setNotes] = useState(restaurant.notes ?? '');
  const [visitedOn, setVisitedOn] = useState<string | null>(restaurant.visited_on);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMine = !!userId && restaurant.created_by === userId;
  const canManage = isMine || isAdmin;
  const hasComment = !!(restaurant.notes || restaurant.visited_on);

  const save = async (fields: { notes: string | null; visited_on: string | null }) => {
    setBusy(true);
    setError(null);
    // RLS lets only the creator or an admin update; a blocked update returns no row.
    const { data, error: err } = await supabase.from('restaurants').update(fields).eq('id', restaurant.id).select('id');
    setBusy(false);
    if (err) return setError(friendlyError(err));
    if (!data?.length) return setError('You can only change comments you added.');
    setEditing(false);
    setConfirming(false);
    onChanged();
  };

  if (editing) {
    return (
      <Card>
        <AppText variant="heading">{isMine ? 'Edit your comment' : `Edit ${restaurant.author_name || 'Anonymous'}’s comment`}</AppText>
        <VisitDateField label="When did you go?" value={visitedOn} onChange={setVisitedOn} />
        <Field label="Comments" value={notes} onChangeText={setNotes} placeholder="Atmosphere, service, who you went with…" maxLength={1000} multiline />
        <Notice message={error} />
        <Row>
          <Button title="Save" onPress={() => save({ notes: notes.trim() || null, visited_on: visitedOn })} loading={busy} />
          <Button
            title="Cancel"
            variant="ghost"
            onPress={() => {
              setNotes(restaurant.notes ?? '');
              setVisitedOn(restaurant.visited_on);
              setError(null);
              setEditing(false);
            }}
          />
        </Row>
      </Card>
    );
  }

  if (!hasComment && !canManage) return null;

  return (
    <View style={{ gap: space.xs }}>
      {restaurant.visited_on && <AppText variant="muted">Visited {formatVisitDate(restaurant.visited_on)}</AppText>}
      {restaurant.notes && <AppText>{restaurant.notes}</AppText>}
      {canManage &&
        (confirming ? (
          <>
            <AppText variant="small" style={{ color: c.danger }}>Delete this comment and visit date?</AppText>
            <Row wrap>
              <Button title="Yes, delete" variant="danger" compact loading={busy} onPress={() => save({ notes: null, visited_on: null })} />
              <Button title="Cancel" variant="ghost" compact onPress={() => setConfirming(false)} />
            </Row>
          </>
        ) : (
          <Row wrap>
            <Button
              title={hasComment ? 'Edit comment' : 'Add a comment'}
              variant="secondary"
              compact
              onPress={() => {
                setNotes(restaurant.notes ?? '');
                setVisitedOn(restaurant.visited_on);
                setEditing(true);
              }}
            />
            {hasComment && <Button title="Delete comment" variant="danger" compact onPress={() => setConfirming(true)} />}
          </Row>
        ))}
      <Notice message={error} />
    </View>
  );
}
