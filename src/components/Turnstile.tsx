import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { TURNSTILE_SITE_KEY } from '../lib/turnstile';

/**
 * Cloudflare Turnstile — bot koruması.
 *
 * Supabase Auth'ta "Bot and Abuse Protection" açıldığında kayıt, giriş ve
 * şifre sıfırlama istekleri geçerli bir captcha token'ı olmadan reddedilir.
 * Doğrulama Supabase sunucusunda yapıldığı için formu atlayıp API'ye doğrudan
 * vuran botlar da geçemez.
 *
 * VITE_TURNSTILE_SITE_KEY tanımlı değilse bileşen hiçbir şey çizmez ve
 * token üretmez; akışlar bugünkü gibi captcha'sız çalışır. Bu sayede önce
 * frontend deploy edilir, widget'ın göründüğü doğrulanır, SONRA Supabase'te
 * koruma açılır. Ters sıra tüm girişleri kırar.
 */

const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile yüklenemedi')));
    script.onerror = () => { scriptPromise = null; reject(new Error('Turnstile yüklenemedi')); };
    if (!existing) document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  /** Token tek kullanımlıktır; her denemeden sonra çağır. */
  reset: () => void;
}

interface Props {
  onToken: (token: string | null) => void;
  className?: string;
}

const Turnstile = forwardRef<TurnstileHandle, Props>(function Turnstile({ onToken, className }, ref) {
  const container = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);

  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);

  useImperativeHandle(ref, () => ({
    reset() {
      onTokenRef.current(null);
      if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
    },
  }), []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !container.current) return;
    let cancelled = false;

    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        widgetId.current = api.render(container.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: 'tr',
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={container} className={className} />;
});

export default Turnstile;
