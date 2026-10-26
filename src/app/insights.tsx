import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';

import { ColumnChart, HBarList, Meter, StatTile, VerdictBar, type ColumnDatum } from '@/components/charts';
import { DateField } from '@/components/date-field';
import { AppText, Card, Chip, Grid, Loading, Notice, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { addDaysISO, shortISODate, toISODate, todayISO } from '@/lib/dates';
import { friendlyError, supabase } from '@/lib/supabase';
import { space, useColors } from '@/lib/theme';

type Bucket = 'day' | 'week';
type Preset = '7d' | '4w' | '12w' | 'all' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: '7d', label: 'Last 7 days' },
  { key: '4w', label: 'Last 4 weeks' },
  { key: '12w', label: 'Last 12 weeks' },
  { key: 'all', label: 'All time' },
  { key: 'custom', label: 'Custom' },
];

type ActivityRow = {
  bucket: string;
  reviews: number;
  restaurants: number;
  dishes: number;
  photos: number;
  contributors: number;
  account_contributors: number;
  anonymous_contributors: number;
};
type Counts = { reviews: number; restaurants: number; dishes: number; photos: number; contributors: number };
type Totals = { current: Counts; previous: Counts; days: number };
type Content = {
  cuisines: { name: string; reviews: number }[];
  verdicts: { must_try: number; mixed: number; skip: number };
  top_restaurants: { name: string; reviews: number }[];
  most_liked: { dish: string; restaurant: string; likes: number; dislikes: number }[];
  most_skipped: { dish: string; restaurant: string; likes: number; dislikes: number }[];
  cities: { name: string; restaurants: number }[];
  detail: { reviews: number; with_photo: number; with_note: number; with_rating: number };
};
type Capacity = { database_bytes: number; photo_bytes: number; photo_files: number; busiest_uploader_24h: number };

const FREE_DB_BYTES = 500 * 1024 ** 2;
const FREE_STORAGE_BYTES = 1024 ** 3;
const DAILY_PHOTO_LIMIT = 10;
// Project ref from https://<ref>.supabase.co, for a direct link to the usage page.
const PROJECT_REF = /^https:\/\/([^.]+)\.supabase\.co/.exec(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '')?.[1] ?? '_';
const timeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

function formatBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.round(n / 1024)} KB`;
}

export default function InsightsScreen() {
  const { loading, isAdmin } = useAuth();
  if (loading) return <Screen><Loading /></Screen>;
  if (!isAdmin) {
    return (
      <Screen>
        <AppText variant="title">Insights</AppText>
        <Notice message="Admins only. Sign in on the Admin page with an admin account." />
      </Screen>
    );
  }
  return <Dashboard />;
}

function Dashboard() {
  const c = useColors();
  const today = todayISO();
  const [bucket, setBucket] = useState<Bucket>('day');
  const [preset, setPreset] = useState<Preset>('4w');
  const [customStart, setCustomStart] = useState<string | null>(addDaysISO(today, -27));
  const [customEnd, setCustomEnd] = useState<string | null>(today);
  const [firstDay, setFirstDay] = useState<string | null>(null);

  // Earliest activity, for "All time".
  useEffect(() => {
    Promise.all([
      supabase.from('restaurants').select('created_at').order('created_at').limit(1),
      supabase.from('reviews').select('created_at').order('created_at').limit(1),
    ]).then(([r, v]) => {
      const dates = [r.data?.[0]?.created_at, v.data?.[0]?.created_at].filter(Boolean) as string[];
      setFirstDay(dates.length ? toISODate(new Date(dates.sort()[0])) : today);
    });
  }, [today]);

  const range = useMemo((): { start: string; end: string } | { error: string } => {
    switch (preset) {
      case '7d':
        return { start: addDaysISO(today, -6), end: today };
      case '4w':
        return { start: addDaysISO(today, -27), end: today };
      case '12w':
        return { start: addDaysISO(today, -83), end: today };
      case 'all':
        return { start: firstDay ?? addDaysISO(today, -83), end: today };
      case 'custom':
        if (!customStart || !customEnd) return { error: 'Pick a start and an end date.' };
        if (customStart > customEnd) return { error: 'The start date is after the end date.' };
        return { start: customStart, end: customEnd };
    }
  }, [preset, today, firstDay, customStart, customEnd]);

  const [activity, setActivity] = useState<ActivityRow[] | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [capacity, setCapacity] = useState<Capacity | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(false);

  const rangeKey = 'error' in range ? null : `${range.start}|${range.end}|${bucket}`;

  useEffect(() => {
    if (!rangeKey || 'error' in range) return;
    let active = true;
    const args = { p_start: range.start, p_end: range.end, p_tz: timeZone };
    // Keep the previous charts on screen (dimmed) while new numbers load.
    Promise.resolve().then(() => active && setRefreshing(true));
    Promise.all([
      supabase.rpc('insights_activity', { ...args, p_bucket: bucket }),
      supabase.rpc('insights_totals', args),
      supabase.rpc('insights_content', args),
    ]).then(([a, t, ct]) => {
      if (!active) return;
      const err = a.error ?? t.error ?? ct.error;
      setError(err ? friendlyError(err) : null);
      if (!err) {
        setActivity(a.data as ActivityRow[]);
        setTotals(t.data as Totals);
        setContent(ct.data as Content);
      }
      setRefreshing(false);
    });
    return () => {
      active = false;
    };
    // rangeKey captures range + bucket.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeKey]);

  useEffect(() => {
    let active = true;
    supabase.rpc('insights_capacity').then(({ data, error: err }) => {
      if (!active) return;
      if (err) setError(friendlyError(err));
      else setCapacity(data as Capacity);
    });
    return () => {
      active = false;
    };
  }, []);

  const label = (d: string) => (bucket === 'week' ? `Wk of ${shortISODate(d)}` : shortISODate(d));
  const col = (pick: (r: ActivityRow) => number[]): ColumnDatum[] =>
    (activity ?? []).map((r) => ({ label: label(r.bucket), values: pick(r) }));
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');

  return (
    <Screen>
      <AppText variant="title">Insights</AppText>
      <AppText variant="muted">Activity, content and free-tier usage. Counts come from what’s stored; no visitor tracking.</AppText>

      {/* Filters: one row, above everything they scope. */}
      <Card>
        <Row wrap style={{ gap: space.sm }}>
          <AppText variant="label" style={{ minWidth: 70 }}>Range</AppText>
          {PRESETS.map((p) => (
            <Chip key={p.key} label={p.label} selected={preset === p.key} onPress={() => setPreset(p.key)} />
          ))}
        </Row>
        {preset === 'custom' && (
          <Row wrap style={{ gap: space.lg, alignItems: 'flex-start' }}>
            <DateField label="From" value={customStart} onChange={setCustomStart} />
            <DateField label="To" value={customEnd} onChange={setCustomEnd} />
          </Row>
        )}
        <Row wrap style={{ gap: space.sm }}>
          <AppText variant="label" style={{ minWidth: 70 }}>Group by</AppText>
          <Chip label="Day" selected={bucket === 'day'} onPress={() => setBucket('day')} />
          <Chip label="Week" selected={bucket === 'week'} onPress={() => setBucket('week')} />
        </Row>
        {'error' in range ? (
          <Notice message={range.error} />
        ) : (
          <AppText variant="small">
            {shortISODate(range.start)} – {shortISODate(range.end)}, {timeZone}
          </AppText>
        )}
      </Card>

      <Notice message={error} />

      {!activity || !totals || !content ? (
        !error && <Loading />
      ) : (
        <View style={{ gap: space.lg, opacity: refreshing ? 0.5 : 1 }}>
          {/* ── 1. Activity ─────────────────────────── */}
          <AppText variant="heading">Activity</AppText>
          <Grid
            items={[
              { key: 'reviews', label: 'Reviews' },
              { key: 'restaurants', label: 'Restaurants added' },
              { key: 'dishes', label: 'Dishes added' },
              { key: 'photos', label: 'Photos' },
              { key: 'contributors', label: 'Active contributors' },
            ] as { key: keyof Counts; label: string }[]}
            keyOf={(t) => t.key}
            maxColumns={3}
            render={(t) => (
              <Card>
                <StatTile label={t.label} value={totals.current[t.key]} previous={totals.previous[t.key]} />
              </Card>
            )}
          />

          <Card>
            <AppText variant="label">Reviews per {bucket}</AppText>
            <ColumnChart data={col((r) => [r.reviews])} series={[{ name: 'reviews', color: c.chart1 }]} />
          </Card>
          <Card>
            <AppText variant="label">Restaurants and dishes added per {bucket}</AppText>
            <ColumnChart
              data={col((r) => [r.restaurants, r.dishes])}
              series={[
                { name: 'restaurants', color: c.chart1 },
                { name: 'dishes', color: c.chart2 },
              ]}
            />
          </Card>
          <Card>
            <AppText variant="label">Active contributors per {bucket}</AppText>
            <ColumnChart
              stacked
              data={col((r) => [r.account_contributors, r.anonymous_contributors])}
              series={[
                { name: 'with an account', color: c.chart1 },
                { name: 'anonymous', color: c.chart2 },
              ]}
            />
          </Card>
          <Card>
            <AppText variant="label">Photos uploaded per {bucket}</AppText>
            <ColumnChart data={col((r) => [r.photos])} series={[{ name: 'photos', color: c.chart1 }]} />
          </Card>

          {/* Table view: every number without hovering. */}
          <Pressable accessibilityRole="button" onPress={() => setShowTable((s) => !s)}>
            <AppText variant="small" style={{ color: c.primary, textDecorationLine: 'underline' }}>
              {showTable ? 'Hide' : 'Show'} activity as a table
            </AppText>
          </Pressable>
          {showTable && <ActivityTable rows={activity} label={label} />}

          {/* ── 2. Content ──────────────────────────── */}
          <AppText variant="heading">What people are eating</AppText>
          <AppText variant="small">Reviews posted in this range; hidden entries excluded.</AppText>
          <Grid
            items={[
              { key: 'cuisines', title: 'Reviews by cuisine' },
              { key: 'verdicts', title: 'Dish verdicts' },
              { key: 'top', title: 'Top restaurants by reviews' },
              { key: 'cities', title: 'Restaurants reviewed, by city' },
              { key: 'liked', title: 'Most-liked dishes' },
              { key: 'skipped', title: 'Most “skip” dishes' },
            ]}
            keyOf={(i) => i.key}
            maxColumns={2}
            render={(i) => (
              <Card style={{ height: '100%' }}>
                <AppText variant="label">{i.title}</AppText>
                {i.key === 'cuisines' && (
                  <HBarList items={content.cuisines.map((x) => ({ name: x.name, value: x.reviews }))} color={c.chart1} />
                )}
                {i.key === 'verdicts' && (
                  <View style={{ gap: space.md }}>
                    <VerdictBar mustTry={content.verdicts.must_try} mixed={content.verdicts.mixed} skip={content.verdicts.skip} />
                    <View style={{ gap: 4 }}>
                      <AppText variant="small">
                        {pct(content.detail.with_photo, content.detail.reviews)} of reviews have a photo ·{' '}
                        {pct(content.detail.with_note, content.detail.reviews)} a note ·{' '}
                        {pct(content.detail.with_rating, content.detail.reviews)} stars
                      </AppText>
                    </View>
                  </View>
                )}
                {i.key === 'top' && (
                  <HBarList items={content.top_restaurants.map((x) => ({ name: x.name, value: x.reviews }))} color={c.chart1} />
                )}
                {i.key === 'cities' && (
                  <HBarList items={content.cities.map((x) => ({ name: x.name, value: x.restaurants }))} color={c.chart1} />
                )}
                {i.key === 'liked' && <DishList rows={content.most_liked} kind="likes" />}
                {i.key === 'skipped' && <DishList rows={content.most_skipped} kind="dislikes" />}
              </Card>
            )}
          />
        </View>
      )}

      {/* ── 4. Capacity (always current) ───────────── */}
      <AppText variant="heading">Free-tier capacity</AppText>
      <Card>
        {capacity ? (
          <View style={{ gap: space.lg }}>
            <Meter label="Database" used={capacity.database_bytes} total={FREE_DB_BYTES} format={formatBytes} />
            <Meter label="Photo storage" used={capacity.photo_bytes} total={FREE_STORAGE_BYTES} format={formatBytes} />
            <AppText variant="small">
              {capacity.photo_files} photo files · Busiest uploader in the last 24 hours: {capacity.busiest_uploader_24h} of{' '}
              {DAILY_PHOTO_LIMIT} allowed photos
            </AppText>
            <AppText
              variant="small"
              accessibilityRole="link"
              onPress={() => Linking.openURL(`https://supabase.com/dashboard/project/${PROJECT_REF}/settings/usage`)}
              style={{ color: c.primary, textDecorationLine: 'underline' }}>
              Monthly downloads (5 GB egress) are only shown in Supabase → Settings → Usage ↗
            </AppText>
          </View>
        ) : (
          !error && <Loading />
        )}
      </Card>
    </Screen>
  );
}

function DishList({ rows, kind }: { rows: Content['most_liked']; kind: 'likes' | 'dislikes' }) {
  const c = useColors();
  if (!rows.length) return <AppText variant="small">Nothing in this range yet.</AppText>;
  return (
    <View style={{ gap: space.sm }}>
      {rows.map((r) => (
        <Row key={r.dish + r.restaurant} style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flexShrink: 1 }}>
            <AppText variant="small" style={{ color: c.text, fontWeight: '600' }}>{r.dish}</AppText>
            <AppText variant="small">{r.restaurant}</AppText>
          </View>
          <Text style={{ color: c.text, fontVariant: ['tabular-nums'] }}>
            {kind === 'likes' ? `👍 ${r.likes}` : `👎 ${r.dislikes}`}
          </Text>
        </Row>
      ))}
    </View>
  );
}

function ActivityTable({ rows, label }: { rows: ActivityRow[]; label: (d: string) => string }) {
  const c = useColors();
  const cols: { key: keyof ActivityRow; title: string }[] = [
    { key: 'reviews', title: 'Reviews' },
    { key: 'restaurants', title: 'Restaurants' },
    { key: 'dishes', title: 'Dishes' },
    { key: 'photos', title: 'Photos' },
    { key: 'contributors', title: 'Contributors' },
  ];
  const cell = { flex: 1, minWidth: 70, fontSize: 13, color: c.text, fontVariant: ['tabular-nums' as const] };
  return (
    <Card>
      <ScrollView horizontal showsHorizontalScrollIndicator>
      <View style={{ minWidth: 520, flex: 1 }}>
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 6 }}>
        <Text style={{ ...cell, flex: 1.4, color: c.textMuted }}>Period</Text>
        {cols.map((col) => (
          <Text key={col.key} style={{ ...cell, color: c.textMuted, textAlign: 'right' }}>{col.title}</Text>
        ))}
      </View>
      {[...rows].reverse().map((r) => (
        <View key={r.bucket} style={{ flexDirection: 'row', paddingVertical: 4 }}>
          <Text style={{ ...cell, flex: 1.4 }}>{label(r.bucket)}</Text>
          {cols.map((col) => (
            <Text key={col.key} style={{ ...cell, textAlign: 'right' }}>{r[col.key]}</Text>
          ))}
        </View>
      ))}
      </View>
      </ScrollView>
    </Card>
  );
}
