import { track } from '@vercel/analytics';

export type ConsentPreferences = {
  analytics: boolean;
  marketing: boolean;
};

export type ProductEvent =
  | 'sign_up'
  | 'view_listing'
  | 'listing_started'
  | 'listing_published'
  | 'offer_started'
  | 'offer_sent'
  | 'conversation_started'
  | 'swap_completed';

const CONSENT_KEY = 'takaslat-cookie-consent-v1';
const CONSENT_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string };
};

function parseConsentPreferences(raw: string | null): ConsentPreferences | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    if (typeof parsed.analytics !== 'boolean' || typeof parsed.marketing !== 'boolean') return null;
    return { analytics: parsed.analytics === true, marketing: parsed.marketing === true };
  } catch {
    return null;
  }
}

function readConsentCookie() {
  const prefix = `${CONSENT_KEY}=`;
  const item = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(prefix));
  if (!item) return null;
  try {
    return decodeURIComponent(item.slice(prefix.length));
  } catch {
    return null;
  }
}

function writeConsentCookie(preferences: ConsentPreferences) {
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${CONSENT_KEY}=${encodeURIComponent(JSON.stringify(preferences))}; Max-Age=${CONSENT_MAX_AGE_SECONDS}; Path=/; SameSite=Lax${secure}`;
}

export function getConsentPreferences(): ConsentPreferences | null {
  let stored: ConsentPreferences | null = null;
  try {
    stored = parseConsentPreferences(localStorage.getItem(CONSENT_KEY));
  } catch {
    // localStorage kapalıysa aynı tercih birinci taraf çerezinden okunur.
  }
  if (stored) return stored;

  const cookiePreferences = parseConsentPreferences(readConsentCookie());
  if (!cookiePreferences) return null;
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(cookiePreferences));
  } catch {
    // Çerez tek başına tercihi kalıcı tutmaya yeterlidir.
  }
  return cookiePreferences;
}

export function saveConsentPreferences(preferences: ConsentPreferences) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(preferences));
  } catch {
    // Gizli mod veya depolama kısıtı durumunda çerez yedeği kullanılır.
  }
  writeConsentCookie(preferences);
  window.dispatchEvent(new CustomEvent('takaslat:consent', { detail: preferences }));
  applyConsentPreferences(preferences);
}

function addScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const script = document.createElement('script');
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

function clearMeasurementCookies(prefixes: string[]) {
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0]?.trim();
    if (!name || !prefixes.some((prefix) => name.startsWith(prefix))) return;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
  });
}

export function applyConsentPreferences(preferences: ConsentPreferences) {
  const browserWindow = window as AnalyticsWindow;
  const googleTagId = import.meta.env.VITE_GOOGLE_TAG_ID as string | undefined;
  const metaPixelId = import.meta.env.VITE_META_PIXEL_ID as string | undefined;

  browserWindow.gtag?.('consent', 'update', {
    analytics_storage: preferences.analytics ? 'granted' : 'denied',
    ad_storage: preferences.marketing ? 'granted' : 'denied',
    ad_user_data: preferences.marketing ? 'granted' : 'denied',
    ad_personalization: preferences.marketing ? 'granted' : 'denied',
  });
  if (!preferences.analytics) clearMeasurementCookies(['_ga', '_gid']);
  if (!preferences.marketing) {
    browserWindow.fbq?.('consent', 'revoke');
    clearMeasurementCookies(['_fbp', '_fbc']);
  }

  if (preferences.analytics && googleTagId) {
    browserWindow.dataLayer ??= [];
    browserWindow.gtag ??= (...args: unknown[]) => { browserWindow.dataLayer?.push(args); };
    browserWindow.gtag('js', new Date());
    browserWindow.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: preferences.marketing ? 'granted' : 'denied',
      ad_user_data: preferences.marketing ? 'granted' : 'denied',
      ad_personalization: preferences.marketing ? 'granted' : 'denied',
    });
    browserWindow.gtag('config', googleTagId, { anonymize_ip: true });
    addScript('takaslat-google-tag', `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleTagId)}`);
  }

  if (preferences.marketing && metaPixelId) {
    if (!browserWindow.fbq) {
      const fbq = ((...args: unknown[]) => {
        if (fbq.callMethod) fbq.callMethod(...args);
        else fbq.queue?.push(args);
      }) as NonNullable<AnalyticsWindow['fbq']>;
      fbq.queue = [];
      fbq.loaded = true;
      fbq.version = '2.0';
      browserWindow.fbq = fbq;
    }
    browserWindow.fbq?.('init', metaPixelId);
    browserWindow.fbq?.('consent', 'grant');
    browserWindow.fbq?.('track', 'PageView');
    addScript('takaslat-meta-pixel', 'https://connect.facebook.net/en_US/fbevents.js');
  }
}

export function trackProductEvent(name: ProductEvent, properties: Record<string, string | number | boolean> = {}) {
  if (import.meta.env.MODE === 'test') return;
  const preferences = getConsentPreferences();
  const browserWindow = window as AnalyticsWindow;
  if (preferences?.analytics) {
    track(name, properties);
    browserWindow.gtag?.('event', name, properties);
  }
  if (preferences?.marketing) browserWindow.fbq?.('trackCustom', name, properties);
}
