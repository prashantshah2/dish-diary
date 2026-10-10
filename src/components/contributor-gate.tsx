import { useState, type ReactNode } from 'react';

import { useAuth } from '@/lib/auth';

import { Turnstile } from './turnstile';
import { AppText, Button, Card, Field, Loading, Notice } from './ui';

/**
 * Shows `children` (a form) once the visitor has a session. The first time someone
 * contributes, they pass a CAPTCHA and get a hidden anonymous account — no sign-up.
 */
export function ContributorGate({ children }: { children: ReactNode }) {
  const { session, loading, startContributing } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

  if (loading) return <Loading />;
  if (session) return <>{children}</>;

  if (!siteKey) {
    return <Notice message="CAPTCHA isn't configured: set EXPO_PUBLIC_TURNSTILE_SITE_KEY in .env." />;
  }

  return (
    <Card>
      <AppText variant="heading">Quick check before you post</AppText>
      <AppText variant="muted">
        No sign-up needed. This keeps spam bots out; you’ll only see it once on this device.
      </AppText>
      {/* Tokens are single-use: after any failure, hide the widget until "Try again"
          mounts a fresh one, instead of silently starting another check. */}
      {!error && (
        <Turnstile
          key={attempt}
          siteKey={siteKey}
          onError={setError}
          onToken={async (token) => {
            setBusy(true);
            const err = await startContributing(token);
            setBusy(false);
            if (err) setError(`Couldn’t start posting: ${err}`);
          }}
        />
      )}
      {busy && <Loading />}
      <Notice message={error} />
      {error && (
        <Button
          title="Try again"
          variant="secondary"
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}
        />
      )}
    </Card>
  );
}

/** "Your name" input, remembered on this device and attached to new posts. */
export function NameField() {
  const { displayName, setDisplayName } = useAuth();
  return (
    <Field
      label="Your name (optional)"
      hint="Shown next to what you post. Leave blank to post as Anonymous."
      value={displayName}
      onChangeText={setDisplayName}
      placeholder="e.g. Priya"
      maxLength={40}
      autoComplete="name"
    />
  );
}
