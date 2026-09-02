import * as Sentry from '@sentry/react';

/**
 * Hata izleme. VITE_SENTRY_DSN tanımlı değilse tamamen devre dışı kalır,
 * yani local geliştirme ve testler Sentry'ye hiçbir şey göndermez.
 */

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

let started = false;

export function initMonitoring() {
  if (started || !dsn || import.meta.env.MODE === 'test') return;
  started = true;

  Sentry.init({
    dsn,
    environment: import.meta.env.PROD ? 'production' : 'development',
    // Kullanıcının e-postası, IP'si ve çerezleri olayla birlikte gönderilmez.
    sendDefaultPii: false,
    // Performans örneklemesi düşük tutuldu; ücretsiz kotayı hata olayları için saklıyoruz.
    tracesSampleRate: 0.1,
    ignoreErrors: [
      // Kullanıcı eski bir sürümdeyken yeni deploy sonrası oluşan chunk hataları.
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
      // Tarayıcı eklentilerinden ve ağ kesintilerinden gelen gürültü.
      'ResizeObserver loop',
      'NetworkError when attempting to fetch resource',
      'Load failed',
    ],
  });
}

/** Yakalanmış bir hatayı, isteğe bağlı bağlamla birlikte bildirir. */
export function reportError(error: unknown, context?: Record<string, unknown>) {
  if (!dsn || !started) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

/** Oturum açan kullanıcıyı olaylara iliştirir (yalnızca kullanıcı kimliği). */
export function setMonitoringUser(userId: string | null) {
  if (!dsn || !started) return;
  Sentry.setUser(userId ? { id: userId } : null);
}
