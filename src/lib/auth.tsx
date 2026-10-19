import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { friendlyError, supabase } from './supabase';

const NAME_KEY = 'dish-diary.displayName';

type AuthState = {
  session: Session | null;
  /** True until the saved session (if any) has been loaded. */
  loading: boolean;
  userId: string | null;
  /** Name shown on new posts; empty string means "Anonymous". */
  displayName: string;
  setDisplayName: (name: string) => void;
  /** Creates a hidden anonymous account, protected by the CAPTCHA token. */
  startContributing: (captchaToken: string) => Promise<string | null>;
  /** Signed in with an email account that's listed in public.admins. */
  isAdmin: boolean;
  /** Signed in with an email + password account (not an anonymous visitor). */
  account: { email: string; name: string } | null;
  signUp: (name: string, email: string, password: string, captchaToken: string) => Promise<string | null>;
  signIn: (email: string, password: string, captchaToken: string) => Promise<string | null>;
  updateAccountName: (name: string) => Promise<string | null>;
  /** Emails a one-time sign-in link to an existing (admin) account. */
  sendSignInLink: (email: string, captchaToken: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

function readName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayName, setName] = useState(readName);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  // Anonymous visitors are never admins; for email accounts, ask the database.
  const [adminFor, setAdminFor] = useState<string | null>(null);
  const emailUserId = session && !session.user.is_anonymous ? session.user.id : null;
  useEffect(() => {
    if (!emailUserId) return;
    let active = true;
    supabase.rpc('is_admin').then(({ data }) => {
      if (active) setAdminFor(data === true ? emailUserId : null);
    });
    return () => {
      active = false;
    };
  }, [emailUserId]);
  const isAdmin = !!emailUserId && adminFor === emailUserId;

  const account =
    session && !session.user.is_anonymous
      ? {
          email: session.user.email ?? '',
          name: String(session.user.user_metadata?.display_name ?? '').trim(),
        }
      : null;

  const setDisplayName = (name: string) => {
    const trimmed = name.trim().slice(0, 40);
    setName(trimmed);
    try {
      localStorage.setItem(NAME_KEY, trimmed);
    } catch {
      // Storage unavailable (e.g. private browsing) — keep it for this visit only.
    }
  };

  const signUp = async (name: string, email: string, password: string, captchaToken: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { captchaToken, data: { display_name: name.trim().slice(0, 40) } },
    });
    if (error) return friendlyError(error);
    // With "Confirm email" on, Supabase returns no session until the email link is clicked.
    if (!data.session) return 'Account created, but email confirmation is turned on in Supabase, so you can’t sign in yet.';
    return null;
  };

  const signIn = async (email: string, password: string, captchaToken: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password, options: { captchaToken } });
    return error ? friendlyError(error) : null;
  };

  const updateAccountName = async (name: string) => {
    const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim().slice(0, 40) } });
    return error ? friendlyError(error) : null;
  };

  const startContributing = async (captchaToken: string) => {
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    return error ? friendlyError(error) : null;
  };

  const sendSignInLink = async (email: string, captchaToken: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // Only existing accounts (created in the dashboard) can sign in — no self sign-up.
        shouldCreateUser: false,
        captchaToken,
        // Come back to the admin page on this site. Must be listed under Redirect URLs in
        // Supabase; in the app, Supabase falls back to its Site URL (the website).
        emailRedirectTo: Platform.OS === 'web' ? `${window.location.origin}/admin` : undefined,
      },
    });
    return error ? friendlyError(error) : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        userId: session?.user.id ?? null,
        // Account holders post under their account name; visitors under the name they typed.
        displayName: account ? account.name : displayName,
        setDisplayName,
        startContributing,
        isAdmin,
        account,
        signUp,
        signIn,
        updateAccountName,
        sendSignInLink,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
