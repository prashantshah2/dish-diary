import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

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

  const setDisplayName = (name: string) => {
    const trimmed = name.trim().slice(0, 40);
    setName(trimmed);
    try {
      localStorage.setItem(NAME_KEY, trimmed);
    } catch {
      // Storage unavailable (e.g. private browsing) — keep it for this visit only.
    }
  };

  const startContributing = async (captchaToken: string) => {
    const { error } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
    return error ? friendlyError(error) : null;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        userId: session?.user.id ?? null,
        displayName,
        setDisplayName,
        startContributing,
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
