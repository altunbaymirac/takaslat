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

type AnalyticsWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string };
};

export function getConsentPreferences(): ConsentPreferences | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentPreferences>;
    return { analytics: parsed.analytics === true, marketing: parsed.marketing === true };
  } catch {
    return null;
  }
}

export function saveConsentPreferences(preferences: ConsentPreferences) {
  localStorage.setItem(CONSENT_KEY, JSON.stringify(preferences));
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
