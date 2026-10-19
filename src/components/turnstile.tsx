import { WebView } from 'react-native-webview';

export type TurnstileProps = {
  siteKey: string;
  onToken: (token: string) => void;
  onError: (message: string) => void;
};

/**
 * iOS/Android: Turnstile only runs inside a web page, so we host it in a small
 * WebView. The page pretends to live on EXPO_PUBLIC_TURNSTILE_HOST, which must be
 * one of the hostnames listed on the Turnstile widget in Cloudflare.
 */
export function Turnstile({ siteKey, onToken, onError }: TurnstileProps) {
  const host = process.env.EXPO_PUBLIC_TURNSTILE_HOST ?? 'localhost';

  const html = `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?onload=start&render=explicit" async></script>
<style>html,body{margin:0;background:transparent;display:flex;justify-content:center}</style>
</head><body><div id="w"></div>
<script>
  function send(type, value) { window.ReactNativeWebView.postMessage(JSON.stringify({ type, value })); }
  function start() {
    turnstile.render('#w', {
      sitekey: ${JSON.stringify(siteKey)},
      callback: function (t) { send('token', t); },
      retry: 'never',
      'error-callback': function (code) { send('error', 'CAPTCHA check failed (error ' + code + ').'); return true; },
      'expired-callback': function () { send('error', 'CAPTCHA expired. Please complete it again.'); }
    });
  }
</script></body></html>`;

  return (
    <WebView
      source={{ html, baseUrl: `https://${host}` }}
      // Turnstile runs its check in about:blank / about:srcdoc iframes. iOS applies this
      // list to every frame, and the default (http/https only) blocks those, which
      // leaves the widget stuck on "Verifying…".
      originWhitelist={['https://*', 'about:blank', 'about:srcdoc']}
      style={{ height: 70, width: 310, backgroundColor: 'transparent' }}
      scrollEnabled={false}
      onMessage={(event) => {
        try {
          const msg = JSON.parse(event.nativeEvent.data) as { type: string; value: string };
          if (msg.type === 'token') onToken(msg.value);
          else onError(msg.value);
        } catch {
          onError('CAPTCHA check failed. Please try again.');
        }
      }}
    />
  );
}
