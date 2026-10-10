import { Pressable, Text, View } from 'react-native';

import type { DishSummary } from '@/lib/types';
import { verdict } from '@/lib/types';
import { radius, space, useColors } from '@/lib/theme';

import { AppText, Row } from './ui';

export function Stars({ value, size = 16 }: { value: number | null; size?: number }) {
  const c = useColors();
  if (value == null) return null;
  const rounded = Math.round(value);
  return (
    <Text accessibilityLabel={`${value} out of 5 stars`} style={{ color: c.star, fontSize: size, letterSpacing: 1 }}>
      {'★'.repeat(rounded)}
      <Text style={{ color: c.border }}>{'★'.repeat(5 - rounded)}</Text>
    </Text>
  );
}

export function StarPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const c = useColors();
  return (
    <Row>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`}
          onPress={() => onChange(value === n ? null : n)}
          hitSlop={4}>
          <Text style={{ fontSize: 30, color: value != null && n <= value ? c.star : c.border }}>★</Text>
        </Pressable>
      ))}
      {value != null && (
        <AppText variant="small" onPress={() => onChange(null)}>
          Clear
        </AppText>
      )}
    </Row>
  );
}

export function LikeToggle({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  const c = useColors();
  const option = (liked: boolean, label: string) => {
    const selected = value === liked;
    const color = liked ? c.liked : c.disliked;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ selected }}
        onPress={() => onChange(liked)}
        style={({ pressed }) => ({
          flex: 1,
          paddingVertical: space.md,
          borderRadius: radius.sm,
          borderWidth: 2,
          borderColor: selected ? color : c.border,
          backgroundColor: selected ? (liked ? c.likedBg : c.dislikedBg) : c.surface,
          alignItems: 'center',
          opacity: pressed ? 0.8 : 1,
        })}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: selected ? color : c.text }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <Row>
      {option(true, '👍  Liked it')}
      {option(false, '👎  Didn’t like it')}
    </Row>
  );
}

const VERDICT_LABEL = {
  'must-try': 'Must try',
  mixed: 'Mixed',
  skip: 'Skip',
  untried: 'No reviews yet',
} as const;

export function VerdictBadge({ dish }: { dish: Pick<DishSummary, 'likes' | 'dislikes'> }) {
  const c = useColors();
  const v = verdict(dish);
  const style = {
    'must-try': { bg: c.likedBg, fg: c.liked },
    skip: { bg: c.dislikedBg, fg: c.disliked },
    mixed: { bg: c.mixedBg, fg: c.text },
    untried: { bg: c.surfaceAlt, fg: c.textMuted },
  }[v];
  return (
    <View style={{ backgroundColor: style.bg, borderRadius: radius.pill, paddingHorizontal: space.sm + 2, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ color: style.fg, fontSize: 12, fontWeight: '700' }}>{VERDICT_LABEL[v]}</Text>
    </View>
  );
}

export function LikeCounts({ likes, dislikes }: { likes: number; dislikes: number }) {
  return (
    <AppText variant="small">
      👍 {likes}   👎 {dislikes}
    </AppText>
  );
}
