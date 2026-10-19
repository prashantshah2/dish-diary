import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useAuth } from '@/lib/auth';
import { formatISODate } from '@/lib/dates';
import { friendlyError, supabase } from '@/lib/supabase';
import type { DishSummary, Review } from '@/lib/types';
import { space } from '@/lib/theme';

import { AdminBar, DishRenameForm, HiddenBadge } from './admin-tools';
import { LikeCounts, Stars, VerdictBadge } from './rating';
import { ReportButton } from './report-button';
import { ReviewForm } from './review-form';
import { AppText, Button, Card, Loading, Notice, Row } from './ui';

/** Everything about one dish: summary, the visitor's own review, and everyone else's. */
export function DishReviews({
  dishId,
  onChanged,
  onDeleted,
}: {
  dishId: string;
  onChanged?: () => void;
  /** Called after an admin deletes this dish. */
  onDeleted?: () => void;
}) {
  const { userId } = useAuth();
  const [renaming, setRenaming] = useState(false);
  const [adminEditing, setAdminEditing] = useState<string | null>(null);
  const [dish, setDish] = useState<DishSummary | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [version, setVersion] = useState(0);

  // Callers pass key={dishId}, so switching dishes remounts with fresh state.
  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.from('dish_summaries').select('*').eq('id', dishId).maybeSingle(),
      supabase.from('reviews').select('*').eq('dish_id', dishId).order('created_at', { ascending: false }),
    ]).then(([d, r]) => {
      if (!active) return;
      setError(d.error || r.error ? friendlyError(d.error ?? r.error) : null);
      setDish(d.data as DishSummary | null);
      setReviews((r.data as Review[]) ?? []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [dishId, version]);

  const afterChange = () => {
    setEditing(false);
    setRenaming(false);
    setAdminEditing(null);
    setVersion((v) => v + 1);
    onChanged?.();
  };

  if (loading) return <Loading />;
  if (!dish) return <Notice message={error ?? 'This dish was not found or has been removed.'} />;

  const mine = reviews.find((r) => r.user_id && r.user_id === userId);
  const others = reviews.filter((r) => r !== mine);

  const remove = async () => {
    if (!mine) return;
    const { error: err } = await supabase.from('reviews').delete().eq('id', mine.id);
    if (err) setError(friendlyError(err));
    else afterChange();
  };

  return (
    <View style={{ gap: space.lg }}>
      <View style={{ gap: space.xs }}>
        <AppText variant="title">{dish.name}</AppText>
        <HiddenBadge hidden={dish.is_hidden} />
        <Row wrap>
          <VerdictBadge dish={dish} />
          <LikeCounts likes={dish.likes} dislikes={dish.dislikes} />
          {dish.avg_rating != null && (
            <Row>
              <Stars value={dish.avg_rating} />
              <AppText variant="small">{dish.avg_rating}</AppText>
            </Row>
          )}
        </Row>
        <Row>
          <AppText variant="small">Added by {dish.author_name || 'Anonymous'}</AppText>
          <ReportButton type="dish" id={dish.id} />
        </Row>
        {renaming ? (
          <DishRenameForm dishId={dish.id} name={dish.name} onDone={(saved) => (saved ? afterChange() : setRenaming(false))} />
        ) : (
          <AdminBar
            type="dish"
            id={dish.id}
            hidden={dish.is_hidden}
            onChanged={afterChange}
            onEdit={() => setRenaming(true)}
            onDeleted={() => {
              onChanged?.();
              onDeleted?.();
            }}
            deleteWarning={`Its ${dish.review_count} review${dish.review_count === 1 ? '' : 's'} will be deleted too.`}
          />
        )}
      </View>

      <Notice message={error} />

      {mine && !editing ? (
        <Card>
          <AppText variant="label">Your review</AppText>
          <ReviewBody review={mine} />
          <Row>
            <Button title="Edit" variant="secondary" compact onPress={() => setEditing(true)} />
            <Button title="Delete" variant="danger" compact onPress={remove} />
          </Row>
        </Card>
      ) : (
        <ReviewForm
          key={mine?.id ?? 'new'}
          dishId={dish.id}
          existing={mine}
          onSaved={afterChange}
          onCancel={mine ? () => setEditing(false) : undefined}
        />
      )}

      <AppText variant="heading">
        {others.length ? `What others said (${others.length})` : 'No other reviews yet'}
      </AppText>
      {others.map((r) =>
        adminEditing === r.id ? (
          <ReviewForm key={r.id} dishId={dish.id} existing={r} asAdmin onSaved={afterChange} onCancel={() => setAdminEditing(null)} />
        ) : (
          <Card key={r.id}>
            <HiddenBadge hidden={r.is_hidden} />
            <ReviewBody review={r} />
            <ReportButton type="review" id={r.id} />
            <AdminBar type="review" id={r.id} hidden={r.is_hidden} onChanged={afterChange} onEdit={() => setAdminEditing(r.id)} />
          </Card>
        )
      )}
    </View>
  );
}

function ReviewBody({ review }: { review: Review }) {
  return (
    <View style={{ gap: space.xs }}>
      <Row wrap>
        <AppText variant="label">{review.liked ? '👍' : '👎'} {review.author_name || 'Anonymous'}</AppText>
        <Stars value={review.rating} size={14} />
      </Row>
      {review.note ? <AppText>{review.note}</AppText> : null}
      <AppText variant="small">
        {review.visited_on ? `Visited ${formatISODate(review.visited_on)} · ` : ''}
        Posted {new Date(review.created_at).toLocaleDateString()}
      </AppText>
    </View>
  );
}
