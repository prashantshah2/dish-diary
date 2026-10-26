import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { touchVisit } from '@/lib/visits';

/** Renders nothing; starts a visit on open, on return to the app, and keeps it alive while browsing. */
export function VisitTracker() {
  const pathname = usePathname();

  useEffect(() => {
    touchVisit();
  }, [pathname]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') touchVisit();
    });
    // Web tabs: count a return to the tab after 30+ minutes as a new visit.
    const onVisible = () => {
      if (document.visibilityState === 'visible') touchVisit();
    };
    if (Platform.OS === 'web') document.addEventListener('visibilitychange', onVisible);
    return () => {
      sub.remove();
      if (Platform.OS === 'web') document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
