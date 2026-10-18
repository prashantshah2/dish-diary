import { useColorScheme, View } from 'react-native';

import { todayISO } from '@/lib/dates';
import { radius, space, useColors } from '@/lib/theme';

import type { DateFieldProps } from './date-field';
import { AppText, Row } from './ui';

/** Web: the browser's own calendar picker via <input type="date">. */
export function DateField({ label, value, onChange }: DateFieldProps) {
  const c = useColors();
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      <Row>
        <input
          type="date"
          aria-label={label}
          value={value ?? ''}
          max={todayISO()}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            font: 'inherit',
            fontSize: 16,
            color: value ? c.text : c.textMuted,
            backgroundColor: c.surface,
            border: `1px solid ${c.border}`,
            borderRadius: radius.sm,
            padding: `${space.sm}px ${space.md}px`,
            minHeight: 44,
            boxSizing: 'border-box',
            colorScheme: scheme, // calendar popup follows light/dark mode
          }}
        />
        {value && (
          <AppText variant="small" accessibilityRole="button" onPress={() => onChange(null)} style={{ color: c.primary, textDecorationLine: 'underline' }}>
            Clear
          </AppText>
        )}
      </Row>
    </View>
  );
}
