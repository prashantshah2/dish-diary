import { Link, router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { AdminBar } from '@/components/admin-tools';
import { Turnstile } from '@/components/turnstile';
import { AppText, Button, Card, EmptyState, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { countDemoRestaurants, removeDemoData } from '@/lib/demo';
import { addDaysISO, todayISO } from '@/lib/dates';
import { exportAllToExcel } from '@/lib/export';
import { friendlyError, supabase } from '@/lib/supabase';
import type { ReportTarget } from '@/lib/types';
import { space, useColors } from '@/lib/theme';

export default function AdminScreen() {
  const { session, loading, isAdmin, signOut } = useAuth();

  if (loading) return <Screen><Loading /></Screen>;

  // Signed in with an email account that isn't on the admin list.
  if (session && !session.user.is_anonymous && !isAdmin) {
    return (
      <Screen>
        <AppText variant="title">Admin</AppText>
        <Notice message={`${session.user.email ?? 'This account'} isn’t an admin (or admin status is still loading).`} />
        <Row>
          <Button title="Sign out" variant="secondary" onPress={signOut} />
        </Row>
      </Screen>
    );
  }

  if (!isAdmin) return <AdminSignIn />;

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <AppText variant="title">Admin</AppText>
        <Button title="Sign out" variant="secondary" compact onPress={signOut} />
      </Row>
      <AppText variant="muted">
        Signed in as {session?.user.email}. While signed in you’ll see Edit, Hide and Delete on every restaurant, dish
        and review, including hidden ones.
      </AppText>
      <VisitsCard />
      <Card>
        <AppText variant="heading">Insights</AppText>
        <AppText variant="muted">Visitors and activity per day or week, what people review, and free-tier usage.</AppText>
        <Row>
          <Button title="Open Insights" compact onPress={() => router.push('/insights')} />
        </Row>
      </Card>
      <PhotoStorageCard />
      <ExportCard />
      <DemoDataCard />
      <ReportsList />
    </Screen>
  );
}

/** If an emailed link failed (expired, already used), Supabase sends us back with the reason in the URL. */
function linkErrorFromUrl(): string | null {
  if (Platform.OS !== 'web') return null;
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search.slice(1));
  const description = params.get('error_description');
  return description ? `That sign-in link didn’t work: ${description.replace(/\+/g, ' ')}. Request a new one.` : null;
}

function AdminSignIn() {
  const { sendSignInLink } = useAuth();
  const [email, setEmail] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [linkSent, setLinkSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(linkErrorFromUrl);
  const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

  const send = async () => {
    if (!email.includes('@')) return setError('Enter your email address.');
    if (!captcha) return setError('Complete the check above first.');
    setBusy(true);
    setError(null);
    const err = await sendSignInLink(email, captcha);
    setBusy(false);
    // CAPTCHA tokens are single-use: get a fresh one whatever happened.
    setCaptcha(null);
    setCaptchaKey((k) => k + 1);
    if (err) setError(err);
    else setLinkSent(true);
  };

  return (
    <Screen>
      <View style={{ maxWidth: 480, width: '100%', gap: space.lg }}>
        <AppText variant="title">Admin sign-in</AppText>
        <Card style={{ gap: space.md }}>
          {!linkSent ? (
            <>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                inputMode="email"
              />
              {siteKey ? (
                <Turnstile key={captchaKey} siteKey={siteKey} onToken={setCaptcha} onError={setError} />
              ) : (
                <Notice message="CAPTCHA isn't configured: set EXPO_PUBLIC_TURNSTILE_SITE_KEY in .env." />
              )}
              <Button title="Email me a sign-in link" onPress={send} loading={busy} disabled={!captcha} />
              <AppText variant="small">Only accounts set up as admin can sign in.</AppText>
            </>
          ) : (
            <>
              <AppText variant="heading">Check your email</AppText>
              <AppText>
                We sent a sign-in link to {email}. Open it on this device — whichever browser opens the link is the one
                that gets signed in. It can take a minute; check spam too.
              </AppText>
              <AppText
                variant="small"
                accessibilityRole="button"
                onPress={() => {
                  setLinkSent(false);
                  setError(null);
                }}
                style={{ textDecorationLine: 'underline' }}>
                Use a different email or send again
              </AppText>
            </>
          )}
          <Notice message={error} />
        </Card>
      </View>
    </Screen>
  );
}

type VisitCounts = { visits: number; unique_visitors: number };

/** Visits today and over the last 7 days (admin visits aren't counted). */
function VisitsCard() {
  const c = useColors();
  const [data, setData] = useState<{ today: VisitCounts; week: VisitCounts } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const today = todayISO();
    let tz = 'UTC';
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {}
    supabase
      .rpc('insights_visits', { p_start: addDaysISO(today, -6), p_end: today, p_bucket: 'day', p_tz: tz })
      .then(({ data: d, error: err }) => {
        if (!active) return;
        if (err) return setError(friendlyError(err));
        const series = (d?.series ?? []) as (VisitCounts & { bucket: string })[];
        const last = series[series.length - 1] ?? { visits: 0, unique_visitors: 0 };
        setData({ today: last, week: d.current as VisitCounts });
      });
    return () => {
      active = false;
    };
  }, []);

  const figure = (n: number, label: string) => (
    <View style={{ minWidth: 120 }}>
      <AppText style={{ fontSize: 26, fontWeight: '800', color: c.text, fontVariant: ['tabular-nums'] }}>{n}</AppText>
      <AppText variant="small">{label}</AppText>
    </View>
  );

  return (
    <Card>
      <AppText variant="heading">Visits</AppText>
      {data ? (
        <Row wrap style={{ gap: space.xl }}>
          {figure(data.today.visits, 'visits today')}
          {figure(data.today.unique_visitors, 'unique visitors today')}
          {figure(data.week.visits, 'visits, last 7 days')}
          {figure(data.week.unique_visitors, 'unique visitors, last 7 days')}
        </Row>
      ) : (
        !error && <Loading />
      )}
      <Notice message={error} />
      <AppText variant="small">Admin visits aren’t counted. Charts by day, week or any range are on Insights.</AppText>
    </Card>
  );
}

/** Shown only while the README screenshot demo data (supabase/demo/demo-setup.sql) is loaded. */
function DemoDataCard() {
  const [count, setCount] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    countDemoRestaurants().then((n) => active && setCount(n));
    return () => {
      active = false;
    };
  }, []);

  if (!count && !message) return null;

  const remove = async () => {
    setBusy(true);
    setError(null);
    const err = await removeDemoData();
    setBusy(false);
    setConfirming(false);
    if (err) return setError(err);
    setCount(0);
    setMessage('Demo data removed.');
  };

  return (
    <Card>
      <AppText variant="heading">Demo data</AppText>
      {message ? (
        <Notice message={message} tone="info" />
      ) : (
        <>
          <AppText variant="muted">
            {count} demo restaurant{count === 1 ? '' : 's'} (with their dishes, reviews and photos) loaded for screenshots.
          </AppText>
          {confirming ? (
            <Row wrap>
              <Button title="Yes, remove demo data" variant="danger" loading={busy} onPress={remove} compact />
              <Button title="Cancel" variant="ghost" onPress={() => setConfirming(false)} compact />
            </Row>
          ) : (
            <Row>
              <Button title="Remove demo data" variant="danger" onPress={() => setConfirming(true)} compact />
            </Row>
          )}
        </>
      )}
      <Notice message={error} />
    </Card>
  );
}

const FREE_STORAGE_BYTES = 1024 ** 3; // Supabase Free: 1 GB

function PhotoStorageCard() {
  const [usage, setUsage] = useState<{ count: number; bytes: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('review_photos')
      .select('bytes')
      .limit(100000)
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) return setError(friendlyError(err));
        setUsage({ count: data.length, bytes: data.reduce((sum, r) => sum + (r.bytes ?? 0), 0) });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card>
      <AppText variant="heading">Photo storage</AppText>
      {usage ? (
        <AppText>
          {usage.count} photo{usage.count === 1 ? '' : 's'} · {(usage.bytes / 1024 ** 2).toFixed(1)} MB of 1 GB (
          {((usage.bytes / FREE_STORAGE_BYTES) * 100).toFixed(1)}%)
        </AppText>
      ) : (
        !error && <Loading />
      )}
      <AppText variant="small">Exact usage, including egress: Supabase → Settings → Usage.</AppText>
      <Notice message={error} />
    </Card>
  );
}

function ExportCard() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { fileName, counts } = await exportAllToExcel();
      setMessage(
        `Downloaded ${fileName}: ` +
          Object.entries(counts)
            .map(([sheet, n]) => `${n} ${sheet.toLowerCase()}`)
            .join(', ')
      );
    } catch (e) {
      setError(`Export failed: ${(e as Error).message}`);
    }
    setBusy(false);
  };

  return (
    <Card>
      <AppText variant="heading">Export to Excel</AppText>
      <AppText variant="muted">
        One .xlsx file with a sheet each for restaurants, dishes, reviews and reports, hidden entries included.
      </AppText>
      {Platform.OS === 'web' ? (
        <Row>
          <Button title="Download Excel file" onPress={run} loading={busy} />
        </Row>
      ) : (
        <AppText variant="small">Open the website to export; downloads aren’t supported in the app.</AppText>
      )}
      <Notice message={message} tone="info" />
      <Notice message={error} />
    </Card>
  );
}

type ReportGroup = {
  type: ReportTarget;
  id: string;
  reasons: { reason: string | null; created_at: string; reportId: string }[];
  label: string;
  href: Href | null;
  hidden: boolean;
};

function ReportsList() {
  const c = useColors();
  const [groups, setGroups] = useState<ReportGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: reports, error: err } = await supabase
        .from('reports')
        .select('id, target_type, target_id, reason, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      if (err) {
        if (active) setError(friendlyError(err));
        return;
      }
      const ids = (t: ReportTarget) => [...new Set(reports.filter((r) => r.target_type === t).map((r) => r.target_id))];
      const [rs, ds, vs] = await Promise.all([
        supabase.from('restaurants').select('id, name, is_hidden').in('id', ids('restaurant')),
        supabase.from('dishes').select('id, name, is_hidden').in('id', ids('dish')),
        supabase.from('reviews').select('id, dish_id, author_name, note, is_hidden').in('id', ids('review')),
      ]);

      const byKey = new Map<string, ReportGroup>();
      for (const r of reports) {
        const key = `${r.target_type}:${r.target_id}`;
        let g = byKey.get(key);
        if (!g) {
          const type = r.target_type as ReportTarget;
          g = { type, id: r.target_id, reasons: [], label: 'Already deleted', href: null, hidden: false };
          if (type === 'restaurant') {
            const t = rs.data?.find((x) => x.id === r.target_id);
            if (t) Object.assign(g, { label: t.name, hidden: t.is_hidden, href: { pathname: '/restaurant/[id]', params: { id: t.id } } });
          } else if (type === 'dish') {
            const t = ds.data?.find((x) => x.id === r.target_id);
            if (t) Object.assign(g, { label: t.name, hidden: t.is_hidden, href: { pathname: '/dish/[id]', params: { id: t.id } } });
          } else {
            const t = vs.data?.find((x) => x.id === r.target_id);
            if (t)
              Object.assign(g, {
                label: `${t.author_name || 'Anonymous'}: “${(t.note ?? '').slice(0, 80) || 'no note'}”`,
                hidden: t.is_hidden,
                href: { pathname: '/dish/[id]', params: { id: t.dish_id } },
              });
          }
          byKey.set(key, g);
        }
        g.reasons.push({ reason: r.reason, created_at: r.created_at, reportId: r.id });
      }
      if (active) {
        setGroups([...byKey.values()]);
        setError(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [version]);

  const dismiss = async (g: ReportGroup) => {
    const { error: err } = await supabase.from('reports').delete().in('id', g.reasons.map((r) => r.reportId));
    if (err) setError(friendlyError(err));
    else reload();
  };

  return (
    <View style={{ gap: space.md }}>
      <AppText variant="heading">Reports</AppText>
      <Notice message={error} />
      {groups === null ? (
        <Loading />
      ) : groups.length === 0 ? (
        <EmptyState title="Nothing reported" body="When people use “Report”, it shows up here." />
      ) : (
        groups.map((g) => (
          <Card key={`${g.type}:${g.id}`}>
            <AppText variant="small" style={{ color: c.primary, fontWeight: '700' }}>
              {g.type.toUpperCase()} · reported {g.reasons.length}× {g.hidden ? '· hidden' : ''}
            </AppText>
            {g.href ? (
              <Link href={g.href}>
                <AppText variant="label" style={{ textDecorationLine: 'underline' }}>{g.label}</AppText>
              </Link>
            ) : (
              <AppText variant="label">{g.label}</AppText>
            )}
            {g.reasons.map((r) => (
              <AppText key={r.reportId} variant="small">
                {new Date(r.created_at).toLocaleDateString()} — {r.reason || 'no reason given'}
              </AppText>
            ))}
            {g.href && <AdminBar type={g.type} id={g.id} hidden={g.hidden} onChanged={reload} />}
            <Row>
              <Button title="Dismiss report" variant="ghost" compact onPress={() => dismiss(g)} />
            </Row>
          </Card>
        ))
      )}
    </View>
  );
}
