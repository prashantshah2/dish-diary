import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { photoUrl, pickPhotos, removePhotos, uploadReviewPhotos, type LocalPhoto } from '@/lib/photos';
import { friendlyError, supabase } from '@/lib/supabase';
import { MAX_PHOTOS_PER_REVIEW, type Review, type ReviewPhoto } from '@/lib/types';
import { radius, space, useColors } from '@/lib/theme';

import { ContributorGate, NameField } from './contributor-gate';
import { DateField } from './date-field';
import { LikeToggle, StarPicker } from './rating';
import { AppText, Button, Card, Field, Notice, Row } from './ui';

export function ReviewForm({
  dishId,
  existing,
  existingPhotos = [],
  onSaved,
  onCancel,
  asAdmin,
}: {
  dishId: string;
  existing?: Review;
  existingPhotos?: ReviewPhoto[];
  /** `warning` is set when the review saved but a photo step failed. */
  onSaved: (warning?: string) => void;
  onCancel?: () => void;
  /** Admin editing someone else's review: keep their name on it; can remove photos, not add. */
  asAdmin?: boolean;
}) {
  const { displayName, userId } = useAuth();
  const [liked, setLiked] = useState<boolean | null>(existing?.liked ?? null);
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [note, setNote] = useState(existing?.note ?? '');
  const [visitedOn, setVisitedOn] = useState<string | null>(existing?.visited_on ?? null);
  const [kept, setKept] = useState<ReviewPhoto[]>(existingPhotos);
  const [added, setAdded] = useState<LocalPhoto[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remaining = MAX_PHOTOS_PER_REVIEW - kept.length - added.length;

  const addPhotos = async (source: 'library' | 'camera') => {
    setError(null);
    try {
      const picked = await pickPhotos(source, remaining);
      setAdded((a) => [...a, ...picked].slice(0, MAX_PHOTOS_PER_REVIEW - kept.length));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const save = async () => {
    if (liked === null) return setError('Pick 👍 or 👎 first.');
    setBusy('Saving…');
    setError(null);
    const fields = {
      liked,
      rating,
      note: note.trim() || null,
      visited_on: visitedOn,
      ...(asAdmin ? {} : { author_name: displayName || null }),
    };
    const { data, error: err } = existing
      ? await supabase.from('reviews').update(fields).eq('id', existing.id).select('id').single()
      : await supabase.from('reviews').insert({ dish_id: dishId, ...fields }).select('id').single();
    if (err || !data) {
      setBusy(null);
      return setError(friendlyError(err));
    }

    // The review is saved; photo problems are reported but don't undo it.
    const removed = existingPhotos.filter((p) => !kept.includes(p));
    let warning = removed.length ? await removePhotos(removed) : null;
    if (!warning && added.length && userId) {
      setBusy(`Uploading ${added.length} photo${added.length > 1 ? 's' : ''}…`);
      try {
        warning = await uploadReviewPhotos(data.id, userId, added);
      } catch (e) {
        // e.g. a photo the browser can't decode — the review itself is already saved.
        warning = `Your review was saved, but the photos couldn’t be processed: ${(e as Error).message}`;
      }
    }
    setBusy(null);
    onSaved(warning ?? undefined);
  };

  return (
    <ContributorGate>
      <Card>
        <AppText variant="heading">
          {asAdmin ? `Edit ${existing?.author_name || 'Anonymous'}’s review` : existing ? 'Edit your review' : 'Add your review'}
        </AppText>
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

        <View style={{ gap: space.xs }}>
          <AppText variant="label">Photos (optional, up to {MAX_PHOTOS_PER_REVIEW})</AppText>
          <Row wrap>
            {kept.map((p) => (
              <PhotoTile key={p.id} uri={photoUrl(p.thumb_path)} onRemove={() => setKept((k) => k.filter((x) => x !== p))} />
            ))}
            {added.map((p) => (
              <PhotoTile key={p.uri} uri={p.uri} onRemove={() => setAdded((a) => a.filter((x) => x !== p))} />
            ))}
          </Row>
          {!asAdmin && remaining > 0 && (
            <Row wrap>
              <Button title="Add from library" variant="secondary" compact onPress={() => addPhotos('library')} />
              <Button title="Take photo" variant="secondary" compact onPress={() => addPhotos('camera')} />
            </Row>
          )}
        </View>

        {!asAdmin && <NameField />}
        <Notice message={error} />
        {busy && <AppText variant="small">{busy}</AppText>}
        <Row>
          <Button title={existing ? 'Save changes' : 'Post review'} onPress={save} loading={!!busy} />
          {onCancel && <Button title="Cancel" variant="ghost" onPress={onCancel} />}
        </Row>
      </Card>
    </ContributorGate>
  );
}

function PhotoTile({ uri, onRemove }: { uri: string; onRemove: () => void }) {
  const c = useColors();
  return (
    <View>
      <Image source={{ uri }} style={{ width: 72, height: 72, borderRadius: radius.sm, backgroundColor: c.surfaceAlt }} contentFit="cover" />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove photo"
        onPress={onRemove}
        hitSlop={8}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: c.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: c.background, fontSize: 12, fontWeight: '700' }}>✕</Text>
      </Pressable>
    </View>
  );
}
