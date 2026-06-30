import { useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import type { HomeMatchResult } from '../services/api';

const formatPrice = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);

export default function AIResults() {
  useSEO({
    title: 'AI Eşleştirme Sonuçları | Takaslat',
    description: 'Yapay zekanın senin için bulduğu takas önerileri.',
  });

  const navigate = useNavigate();
  const location = useLocation();
  const { listings } = useAppStore();

  const result = (location.state as { result?: HomeMatchResult } | null)?.result ?? null;

  const matchedListings = useMemo(() => {
    if (!result) return [];
    return result.suggestions
      .map(s => {
        const listing = listings.find(l => l.id === s.listingId);
        return listing ? { listing, suggestion: s } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [result, listings]);

  if (!result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-slate-300 dark:text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
        </div>
        <p className="text-slate-600 dark:text-slate-300 font-semibold mb-1">Henüz bir AI araması yapılmadı</p>
        <p className="text-slate-400 dark:text-slate-500 text-sm mb-6">Sonuç görmek için önce AI ile arama yap.</p>
        <button
          onClick={() => navigate('/listings?tab=ai')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-6 py-3 rounded-2xl transition-colors"
        >
          AI ile Bul'a git
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-blue-500">AI eşleştirme</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">{result.message}</h1>
          {result.source && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Kaynak ilan: <span className="font-semibold text-slate-700 dark:text-slate-200">{result.source.title}</span>
            </p>
          )}
        </div>
        <Link
          to="/listings?tab=ai"
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
        >
          Yeni AI araması
        </Link>
      </div>

      {matchedListings.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {matchedListings.map(({ listing, suggestion }) => (
            <div key={listing.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <Link to={`/listing/${listing.id}`} className="flex gap-3 p-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
                <img src={listing.images[0]} alt="" className="h-24 w-32 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">%{suggestion.compatibilityScore}</span>
                    <span className="truncate text-xs text-slate-400">{listing.city}</span>
                  </div>
                  <h3 className="line-clamp-2 text-sm font-bold text-slate-900 dark:text-slate-100">{listing.title}</h3>
                  <p className="mt-1 text-sm font-black text-blue-600">{formatPrice(listing.estimatedValue)}</p>
                  {suggestion.priceDiff !== null && (
                    <p className={`mt-1 text-xs font-semibold ${suggestion.priceDiff > 0 ? 'text-amber-600' : suggestion.priceDiff < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                      {suggestion.priceDiff === 0
                        ? 'Değerler denk'
                        : suggestion.priceDiff > 0
                        ? `${formatPrice(suggestion.priceDiff)} üste gerekebilir`
                        : `${formatPrice(Math.abs(suggestion.priceDiff))} fark alınabilir`}
                    </p>
                  )}
                </div>
              </Link>
              <div className="border-t border-slate-100 px-3 py-3 text-xs dark:border-slate-700">
                {suggestion.reasons.length > 0 && (
                  <p className="text-slate-600 dark:text-slate-300">{suggestion.reasons.join(' · ')}</p>
                )}
                {suggestion.cashNote && <p className="mt-1 font-semibold text-blue-700 dark:text-blue-300">{suggestion.cashNote}</p>}
                {suggestion.negotiationTip && <p className="mt-1 text-slate-500 dark:text-slate-400">{suggestion.negotiationTip}</p>}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900 px-4 py-16 text-center text-sm text-slate-500 dark:text-slate-400">
          AI bu kriterlerle uygun ilan bulamadı.
        </div>
      )}
    </div>
  );
}
