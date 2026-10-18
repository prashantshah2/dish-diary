import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, View } from 'react-native';

import { formatISODate, fromISODate, toISODate } from '@/lib/dates';
import { space, useColors } from '@/lib/theme';

import { AppText, Button, Row } from './ui';

export type DateFieldProps = {
  label: string;
  /** "YYYY-MM-DD", or null for no date. */
  value: string | null;
  onChange: (value: string | null) => void;
};

/**
 * iOS: Apple's compact date button (tap → calendar).
 * Android: a button that opens the system calendar dialog.
 * Future dates are blocked — you can't have visited yet.
 */
export function DateField({ label, value, onChange }: DateFieldProps) {
  const c = useColors();
  const [dialogOpen, setDialogOpen] = useState(false);
  const today = new Date();
  const date = value ? fromISODate(value) : today;

  const clear = value ? (
    <AppText variant="small" accessibilityRole="button" onPress={() => onChange(null)} style={{ color: c.primary, textDecorationLine: 'underline' }}>
      Clear
    </AppText>
  ) : null;

  if (Platform.OS === 'ios') {
    return (
      <View style={{ gap: space.xs }}>
        <AppText variant="label">{label}</AppText>
        <Row>
          {value ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="compact"
              maximumDate={today}
              accentColor={c.primary}
              onValueChange={(_e, d) => onChange(toISODate(d))}
            />
          ) : (
            // Compact picker always shows a date, so start from "no date" with a button.
            <Button title="Pick a date" variant="secondary" compact onPress={() => onChange(toISODate(today))} />
          )}
          {clear}
        </Row>
      </View>
    );
  }

  // Android: the dialog opens when mounted, so mount it only while picking.
  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      <Row>
        <Button title={value ? formatISODate(value) : 'Pick a date'} variant="secondary" compact onPress={() => setDialogOpen(true)} />
        {clear}
      </Row>
      {dialogOpen && (
        <DateTimePicker
          value={date}
          mode="date"
          presentation="dialog"
          maximumDate={today}
          onValueChange={(_e, d) => {
            setDialogOpen(false);
            onChange(toISODate(d));
          }}
          onDismiss={() => setDialogOpen(false)}
        />
      )}
    </View>
  );
}
