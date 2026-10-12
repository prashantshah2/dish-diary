import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { radius, space, useColors } from '@/lib/theme';

import { AppText } from './ui';

/**
 * Dropdown pick list: a field showing the current choice; tapping it opens the
 * options right below, and picking one closes it again.
 */
export function Select({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  formatOption = (v) => v,
  noneLabel = 'None',
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  /** How an option is displayed (e.g. with an icon); the stored value is unchanged. */
  formatOption?: (value: string) => string;
  /** First option in the list, which clears the choice. */
  noneLabel?: string;
}) {
  const c = useColors();
  const [open, setOpen] = useState(false);

  const pick = (v: string | null) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value ?? placeholder}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: c.surface,
          borderColor: open ? c.primary : c.border,
          borderWidth: 1,
          borderRadius: radius.sm,
          paddingHorizontal: space.md,
          minHeight: 44,
        }}>
        <Text style={{ fontSize: 16, color: value ? c.text : c.textMuted }}>{value ? formatOption(value) : placeholder}</Text>
        <Text style={{ fontSize: 12, color: c.textMuted }}>{open ? '▲' : '▼'}</Text>
      </Pressable>

      {open && (
        <View
          accessibilityRole="menu"
          style={{
            backgroundColor: c.surface,
            borderColor: c.border,
            borderWidth: 1,
            borderRadius: radius.sm,
            overflow: 'hidden',
          }}>
          {[null, ...options].map((opt) => {
            const selected = opt === value;
            return (
              <Pressable
                key={opt ?? '__none'}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
                onPress={() => pick(opt)}
                style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                  paddingHorizontal: space.md,
                  paddingVertical: space.sm + 2,
                  backgroundColor: selected ? c.surfaceAlt : pressed || hovered ? c.background : 'transparent',
                  borderTopWidth: opt === null ? 0 : 1,
                  borderTopColor: c.border,
                })}>
                <Text style={{ fontSize: 15, color: opt === null ? c.textMuted : c.text, fontWeight: selected ? '700' : '400' }}>
                  {opt === null ? noneLabel : formatOption(opt)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}
