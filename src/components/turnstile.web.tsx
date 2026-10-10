import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import type { TurnstileProps } from './turnstile';

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile failed to load')));
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error('Could not load the CAPTCHA. Check your connection or ad blocker.'));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function Turnstile({ siteKey, onToken, onError }: TurnstileProps) {
  // react-native-web renders <View> as a <div>, so the ref is a DOM element.
  const container = useRef<View>(null);

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId = api.render(container.current as unknown as HTMLElement, {
          sitekey: siteKey,
          callback: onToken,
          // Don't loop on "Verifying…": stop and report the code so it can be diagnosed.
          retry: 'never',
          'error-callback': (code: string) => {
            onError(`CAPTCHA check failed (error ${code}).`);
            return true; // handled — suppress Turnstile's own retry/console noise
          },
          'expired-callback': () => onError('CAPTCHA expired. Please complete it again.'),
        });
      })
      .catch((e: Error) => onError(e.message));

    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
    // Render once per mount; callbacks are stable enough for this widget's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey]);

  return <View ref={container} style={{ minHeight: 65 }} />;
}
