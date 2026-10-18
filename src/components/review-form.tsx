import { useState } from 'react';

import { useAuth } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';

import { ContributorGate, NameField } from './contributor-gate';
import { DateField } from './date-field';
import { LikeToggle, StarPicker } from './rating';
import { AppText, Button, Card, Field, Notice, Row } from './ui';

export function ReviewForm({
  dishId,
  existing,
  onSaved,
  onCancel,
}: {
  dishId: string;
  existing?: Review;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const { displayName } = useAuth();
  const [liked, setLiked] = useState<boolean | null>(existing?.liked ?? null);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [visitedOn, setVisitedOn] = useState<string | null>(existing?.visited_on ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (liked === null) return setError('Pick 👍 or 👎 first.');
    setBusy(true);
    setError(null);
    const fields = {
      liked,
      rating,
      note: note.trim() || null,
      visited_on: visitedOn,
      author_name: displayName || null,
    };
    const { error: err } = existing
      ? await supabase.from('reviews').update(fields).eq('id', existing.id)
      : await supabase.from('reviews').insert({ dish_id: dishId, ...fields });
    setBusy(false);
    if (err) setError(friendlyError(err));
    else onSaved();
  };

  return (
    <ContributorGate>
      <Card>
        <AppText variant="heading">{existing ? 'Edit your review' : 'Add your review'}</AppText>
        <LikeToggle value={liked} onChange={setLiked} />
        <AppText variant="label">Rating (optional)</AppText>
        <StarPicker value={rating} onChange={setRating} />
        <Field
          label="Notes (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Too spicy? Great portion? Order it with…"
          multiline
          maxLength={1000}
        />
        <DateField label="Date visited (optional)" value={visitedOn} onChange={setVisitedOn} />
        <NameField />
        <Notice message={error} />
        <Row>
          <Button title={existing ? 'Save changes' : 'Post review'} onPress={save} loading={busy} />
          {onCancel && <Button title="Cancel" variant="ghost" onPress={onCancel} />}
        </Row>
      </Card>
    </ContributorGate>
  );
}
