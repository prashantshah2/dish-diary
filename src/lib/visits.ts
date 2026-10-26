import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Visit counting for the admin Insights page. Stores only an anonymous random device id
 * on the device; each visit sends that id, a visit id and website/iOS to log_visit().
 * A new visit starts on first open or after 30 minutes without activity.
 *
 * Development copies (localhost, Expo Go) don't log, because they share the live database —
 * set EXPO_PUBLIC_LOG_DEV_VISITS=1 in .env to test logging locally.
 */

const VISITOR_KEY = 'dish-diary.visitorId';
const SESSION_KEY = 'dish-diary.visitId';
const LAST_ACTIVE_KEY = 'dish-diary.lastActive';
const VISIT_GAP_MS = 30 * 60 * 1000;

const enabled = !__DEV__ || process.env.EXPO_PUBLIC_LOG_DEV_VISITS === '1';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked (e.g. private browsing) — counts as a new visitor each time
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore: analytics must never break the app
  }
}

/** Random version-4 UUID (crypto.randomUUID isn't available in every runtime). */
function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Call on app start, when the app comes back to the foreground, and on navigation.
 * Logs a visit only when 30+ minutes have passed since the last activity.
 */
export function touchVisit() {
  if (!enabled) return;
  const now = Date.now();
  const last = Number(read(LAST_ACTIVE_KEY) ?? 0);
  write(LAST_ACTIVE_KEY, String(now));
  if (last && now - last < VISIT_GAP_MS && read(SESSION_KEY)) return;

  let visitor = read(VISITOR_KEY);
  if (!visitor) {
    visitor = uuid();
    write(VISITOR_KEY, visitor);
  }
  const visit = uuid();
  write(SESSION_KEY, visit);
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  // Fire and forget; a failed log is simply not counted.
  supabase.rpc('log_visit', { p_visitor: visitor, p_session: visit, p_platform: platform }).then(
    () => undefined,
    () => undefined
  );
}
