import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Stars } from '@/components/rating';
import { Turnstile } from '@/components/turnstile';
import { AppText, Button, Card, Chip, EmptyState, Field, Loading, Notice, Row, Screen } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { friendlyError, supabase } from '@/lib/supabase';
import { space } from '@/lib/theme';

export default function AccountScreen() {
  const { loading, account } = useAuth();
  if (loading) return <Screen><Loading /></Screen>;
  return <Screen>{account ? <SignedIn /> : <SignInOrUp />}</Screen>;
}

function SignInOrUp() {
  const { signIn, signUp, session } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

  const submit = async () => {
    if (mode === 'up' && !name.trim()) return setError('Enter the name to show on your posts.');
    if (!email.includes('@')) return setError('Enter your email address.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (!captcha) return setError('Complete the check first.');
    setBusy(true);
    setError(null);
    const err = mode === 'up' ? await signUp(name, email, password, captcha) : await signIn(email, password, captcha);
    setBusy(false);
    // CAPTCHA tokens are single-use: get a fresh one whatever happened.
    setCaptcha(null);
    setCaptchaKey((k) => k + 1);
    if (err) setError(err);
  };

  return (
    <View style={{ maxWidth: 480, width: '100%', gap: space.lg }}>
      <AppText variant="title">{mode === 'in' ? 'Sign in' : 'Create an account'}</AppText>
      <AppText variant="muted">
        An account lets you post under your name and edit or delete your reviews from any device. You can still post
        without one.
      </AppText>
      <Row>
        <Chip label="Sign in" selected={mode === 'in'} onPress={() => setMode('in')} />
        <Chip label="Create account" selected={mode === 'up'} onPress={() => setMode('up')} />
      </Row>
      <Card style={{ gap: space.md }}>
        {mode === 'up' && (
          <Field label="Your name" hint="Shown next to what you post." value={name} onChangeText={setName} placeholder="e.g. Priya" maxLength={40} autoComplete="name" />
        )}
        <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoComplete="email" inputMode="email" />
        <Field
          label="Password"
          hint={mode === 'up' ? 'At least 8 characters.' : undefined}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          onSubmitEditing={submit}
        />
        {siteKey ? (
          <Turnstile key={captchaKey} siteKey={siteKey} onToken={setCaptcha} onError={setError} />
        ) : (
          <Notice message="CAPTCHA isn't configured: set EXPO_PUBLIC_TURNSTILE_SITE_KEY in .env." />
        )}
        <Button title={mode === 'in' ? 'Sign in' : 'Create account'} onPress={submit} loading={busy} disabled={!captcha} />
        {session?.user.is_anonymous && (
          <AppText variant="small">
            Posts you made on this device without an account stay up, but won’t move to your account.
          </AppText>
        )}
        <Notice message={error} />
      </Card>
    </View>
  );
}

type MyReview = {
  id: string;
  dish_id: string;
  liked: boolean;
  rating: number | null;
  note: string | null;
  created_at: string;
  dishes: { name: string; restaurants: { name: string } | null } | null;
};

function SignedIn() {
  const { account, userId, updateAccountName, signOut } = useAuth();
  const [name, setName] = useState(account?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<MyReview[] | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    supabase
      .from('reviews')
      .select('id, dish_id, liked, rating, note, created_at, dishes(name, restaurants(name))')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (!active) return;
        if (err) setError(friendlyError(err));
        setReviews((data as unknown as MyReview[]) ?? []);
      });
    return () => {
      active = false;
    };
  }, [userId, version]);

  const saveName = async () => {
    setSaving(true);
    setMessage(null);
    const err = await updateAccountName(name);
    setSaving(false);
    if (err) setError(err);
    else setMessage('Saved. New posts will show this name.');
  };

  const remove = async (id: string) => {
    const { error: err } = await supabase.from('reviews').delete().eq('id', id);
    if (err) setError(friendlyError(err));
    else setVersion((v) => v + 1);
  };

  return (
    <View style={{ gap: space.lg }}>
      <Row style={{ justifyContent: 'space-between' }} wrap>
        <AppText variant="title">Your account</AppText>
        <Button title="Sign out" variant="secondary" compact onPress={signOut} />
      </Row>
      <AppText variant="muted">Signed in as {account?.email}</AppText>

      <Card style={{ maxWidth: 480 }}>
        <Field label="Name on your posts" value={name} onChangeText={setName} maxLength={40} autoComplete="name" />
        <Row>
          <Button title="Save name" onPress={saveName} loading={saving} disabled={name.trim() === (account?.name ?? '')} compact />
        </Row>
        <Notice message={message} tone="info" />
      </Card>

      <Notice message={error} />
      <AppText variant="heading">Your reviews{reviews ? ` (${reviews.length})` : ''}</AppText>
      {reviews === null ? (
        <Loading />
      ) : reviews.length === 0 ? (
        <EmptyState title="No reviews yet" body="Open a restaurant, pick a dish, and say whether you liked it." />
      ) : (
        reviews.map((r) => (
          <Card key={r.id}>
            <Link href={{ pathname: '/dish/[id]', params: { id: r.dish_id } }}>
              <AppText variant="label" style={{ textDecorationLine: 'underline' }}>
                {r.liked ? '👍' : '👎'} {r.dishes?.name ?? 'Dish'} · {r.dishes?.restaurants?.name ?? ''}
              </AppText>
            </Link>
            <Stars value={r.rating} size={14} />
            {r.note ? <AppText>{r.note}</AppText> : null}
            <Row>
              <Button
                title="Edit"
                variant="secondary"
                compact
                onPress={() => router.push({ pathname: '/dish/[id]', params: { id: r.dish_id } })}
              />
              <Button title="Delete" variant="danger" compact onPress={() => remove(r.id)} />
            </Row>
          </Card>
        ))
      )}
    </View>
  );
}
