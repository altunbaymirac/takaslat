import { useEffect, useState } from 'react';
import { Analytics } from '@vercel/analytics/react';
import { applyConsentPreferences, getConsentPreferences, saveConsentPreferences } from '../lib/analytics';

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => getConsentPreferences() === null);
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => getConsentPreferences()?.analytics === true);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    const existing = getConsentPreferences();
    if (existing) {
      applyConsentPreferences(existing);
    }

    const openPreferences = () => {
      const current = getConsentPreferences();
      setAnalytics(current?.analytics ?? false);
      setMarketing(current?.marketing ?? false);
      setVisible(true);
    };

    window.addEventListener('takaslat:open-consent', openPreferences);
    return () => window.removeEventListener('takaslat:open-consent', openPreferences);
  }, []);

  function save(nextAnalytics = analytics, nextMarketing = marketing) {
    saveConsentPreferences({ analytics: nextAnalytics, marketing: nextMarketing });
    setAnalyticsEnabled(nextAnalytics);
    setVisible(false);
  }

  return (
    <>
      {analyticsEnabled && <Analytics />}
      {visible && <section className="fixed inset-x-3 bottom-3 z-[10000] mx-auto max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900" aria-label="Çerez tercihleri">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-slate-950 dark:text-white">Çerez tercihleri</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Zorunlu depolama oturum ve güvenlik için kullanılır. Analitik ve reklam ölçümü yalnızca onayınızla etkinleşir.
          </p>
          <div className="mt-3 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} className="h-4 w-4 accent-blue-600" />
              Analitik
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200">
              <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} className="h-4 w-4 accent-blue-600" />
              Reklam ölçümü
            </label>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:max-w-64 sm:justify-end">
          <button type="button" onClick={() => save(false, false)} className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">Reddet</button>
          <button type="button" onClick={() => save()} className="rounded-md border border-blue-600 px-3 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300">Seçimleri kaydet</button>
          <button type="button" onClick={() => save(true, true)} className="rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700">Tümünü kabul et</button>
        </div>
      </div>
      </section>}
    </>
  );
}
