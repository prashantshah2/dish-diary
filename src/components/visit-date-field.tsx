import { useState } from 'react';
import { View } from 'react-native';

import { isMonthOnly } from '@/lib/dates';
import { space } from '@/lib/theme';

import { DateField } from './date-field';
import { Select } from './select';
import { AppText, Chip, Row } from './ui';

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const YEARS_BACK = 30;

const monthName = (m: string) => new Date(2000, Number(m) - 1, 1).toLocaleDateString(undefined, { month: 'long' });

/**
 * A date that can be an exact day ("YYYY-MM-DD") or just a month and year ("YYYY-MM"),
 * for when you don't remember the day. Future dates are blocked.
 */
export function VisitDateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  const [monthOnly, setMonthOnly] = useState(value ? isMonthOnly(value) : false);
  // Month and year are picked separately, so keep a half-picked choice here until both are set.
  const [month, setMonth] = useState<string | null>(value?.slice(5, 7) ?? null);
  const [year, setYear] = useState<string | null>(value?.slice(0, 4) ?? null);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const years = Array.from({ length: YEARS_BACK }, (_, i) => String(thisYear - i));
  const months = year === String(thisYear) ? MONTHS.slice(0, thisMonth) : MONTHS;

  const pickMonthYear = (m: string | null, y: string | null) => {
    // Picking this year can make a later month invalid.
    if (m && y === String(thisYear) && Number(m) > thisMonth) m = null;
    setMonth(m);
    setYear(y);
    onChange(m && y ? `${y}-${m}` : null);
  };

  const switchTo = (toMonthOnly: boolean) => {
    if (toMonthOnly === monthOnly) return;
    setMonthOnly(toMonthOnly);
    if (toMonthOnly) {
      // Keep the month of the exact day, if one was picked.
      pickMonthYear(value?.slice(5, 7) ?? month, value?.slice(0, 4) ?? year);
    } else {
      onChange(null);
    }
  };

  return (
    <View style={{ gap: space.xs }}>
      <AppText variant="label">{label}</AppText>
      <Row wrap>
        <Chip label="Exact day" selected={!monthOnly} onPress={() => switchTo(false)} />
        <Chip label="Month & year" selected={monthOnly} onPress={() => switchTo(true)} />
      </Row>
      {monthOnly ? (
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Select label="Month" value={month} options={months} onChange={(m) => pickMonthYear(m, year)} placeholder="Month" formatOption={monthName} noneLabel="No month" />
          </View>
          <View style={{ flex: 1 }}>
            <Select label="Year" value={year} options={years} onChange={(y) => pickMonthYear(month, y)} placeholder="Year" noneLabel="No year" />
          </View>
        </Row>
      ) : (
        <DateField label="Day" value={value && !isMonthOnly(value) ? value : null} onChange={onChange} />
      )}
    </View>
  );
}
