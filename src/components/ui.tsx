import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';

import { MAX_CONTENT_WIDTH, radius, space, useBreakpoint, useColors } from '@/lib/theme';

type TextVariant = 'title' | 'heading' | 'body' | 'muted' | 'small' | 'label';

export function AppText({
  variant = 'body',
  style,
  ...rest
}: TextProps & { variant?: TextVariant }) {
  const c = useColors();
  const color = variant === 'muted' || variant === 'small' ? c.textMuted : c.text;
  return <Text style={[{ color }, textStyles[variant], style]} {...rest} />;
}

const textStyles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 19, lineHeight: 26, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 23 },
  muted: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
});

/** Scrollable page body with side gutters and a max width on large screens. */
export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const c = useColors();
  const { isPhone } = useBreakpoint();
  const inner = (
    <View
      style={{
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        paddingHorizontal: isPhone ? space.lg : space.xl,
        paddingVertical: space.xl,
        gap: space.lg,
        flexGrow: 1,
      }}>
      {children}
    </View>
  );
  if (!scroll) return <View style={{ flex: 1, backgroundColor: c.background }}>{inner}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={{ flexGrow: 1 }}
      keyboardShouldPersistTaps="handled">
      {inner}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderColor: c.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: space.lg,
          gap: space.sm,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** Lays children out in 1–3 columns depending on screen width. */
export function Grid<T>({
  items,
  render,
  keyOf,
  maxColumns = 3,
}: {
  items: T[];
  render: (item: T) => ReactNode;
  keyOf: (item: T) => string;
  maxColumns?: number;
}) {
  const { columns } = useBreakpoint();
  const cols = Math.min(columns, maxColumns);
  const basis = `${100 / cols}%` as const;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -space.sm / 2 }}>
      {items.map((item) => (
        <View key={keyOf(item)} style={{ width: basis, padding: space.sm / 2 }}>
          {render(item)}
        </View>
      ))}
    </View>
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  compact?: boolean;
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, compact }: ButtonProps) {
  const c = useColors();
  const bg =
    variant === 'primary' ? c.primary : variant === 'secondary' ? c.surfaceAlt : 'transparent';
  const fg =
    variant === 'primary' ? c.onPrimary : variant === 'danger' ? c.danger : variant === 'ghost' ? c.primary : c.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.sm,
        paddingVertical: compact ? space.xs + 2 : space.md - 2,
        paddingHorizontal: compact ? space.md : space.lg,
        opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: space.sm,
        minHeight: compact ? 32 : 44,
      })}>
      {loading && <ActivityIndicator size="small" color={fg} />}
      <Text style={{ color: fg, fontWeight: '600', fontSize: compact ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  ...input
}: TextInputProps & { label: string; hint?: string }) {
  const c = useColors();
  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={c.textMuted}
        {...input}
        style={[
          {
            color: c.text,
            backgroundColor: c.surface,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: radius.sm,
            paddingHorizontal: space.md,
            paddingVertical: space.sm + 2,
            fontSize: 16,
            minHeight: input.multiline ? 90 : 44,
            textAlignVertical: input.multiline ? 'top' : 'center',
          },
          input.style,
        ]}
      />
      {hint ? <AppText variant="small">{hint}</AppText> : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
}) {
  const c = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: space.md,
        paddingVertical: space.xs + 2,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c.primary : c.border,
        backgroundColor: selected ? c.primary : c.surface,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Text style={{ color: selected ? c.onPrimary : c.text, fontSize: 14, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function Row({ children, wrap, style }: { children: ReactNode; wrap?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: wrap ? 'wrap' : 'nowrap' },
        style,
      ]}>
      {children}
    </View>
  );
}

export function Notice({ message, tone = 'error' }: { message: string | null; tone?: 'error' | 'info' }) {
  const c = useColors();
  if (!message) return null;
  return (
    <View
      style={{
        backgroundColor: tone === 'error' ? c.dislikedBg : c.surfaceAlt,
        borderRadius: radius.sm,
        padding: space.md,
      }}>
      <AppText style={{ color: tone === 'error' ? c.danger : c.text }}>{message}</AppText>
    </View>
  );
}

export function Loading() {
  const c = useColors();
  return (
    <View style={{ padding: space.xxl, alignItems: 'center' }}>
      <ActivityIndicator color={c.primary} />
    </View>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: space.xxl }}>
      <AppText variant="heading">{title}</AppText>
      {body ? <AppText variant="muted" style={{ textAlign: 'center' }}>{body}</AppText> : null}
      {action}
    </Card>
  );
}
