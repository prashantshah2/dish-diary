import 'expo-sqlite/localStorage/install'; // provides localStorage on iOS/Android; no-op on web
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Missing Supabase settings. Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_KEY.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Web: pick up the login from an emailed sign-in link (admin). Apps don't open those links.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// On phones, only refresh the login token while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

/** Turns Supabase/Postgres errors into messages people can act on. */
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return 'Something went wrong.';
  if (error.code === '23505') return 'That already exists — check the list before adding it again.';
  if (error.code === '23514') return 'Some text is too long or a value is out of range.';
  return error.message ?? 'Something went wrong.';
}
