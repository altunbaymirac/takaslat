import type { Listing, SwapOffer } from '../types';
import { analyzeOffer } from '../lib/swapIntelligence';

const fmt = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(Math.abs(value));

const fmtPercent = (value: number) => value > 1000 ? '10 kattan fazla' : `%${value}`;

export default function OfferDecisionPanel({
  offer,
  targetListing,
  offeredListing,
}: {
  offer: SwapOffer;
  targetListing?: Listing;
  offeredListing?: Listing;
}) {
  const analysis = analyzeOffer(offer, targetListing, offeredListing);
  const scoreClass = analysis.score >= 78
    ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-900/20 dark:border-emerald-900/40'
    : analysis.score >= 50
      ? 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-900/20 dark:border-amber-900/40'
      : 'text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-900/20 dark:border-red-900/40';

  return (
    <section className="mt-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">Akıllı Teklif Kontrolü</p>
          <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{analysis.verdict}</h3>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-black ${scoreClass}`}>%{analysis.score}</span>
      </div>

      {analysis.valueGap !== null && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          Tahmini değer farkı: <strong>{fmt(analysis.valueGap)}</strong>
          {analysis.valueGapPercent !== null && ` (${fmtPercent(analysis.valueGapPercent)})`}
        </div>
      )}

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Olumlu sinyaller</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(analysis.positives.length ? analysis.positives : ['Henüz güçlü bir doğrulama sinyali yok']).map((item) => (
              <li key={item}>✓ {item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-600">Kontrol edilecekler</p>
          <ul className="mt-1 space-y-1 text-xs text-slate-600 dark:text-slate-300">
            {(analysis.risks.length ? analysis.risks : ['Belirgin risk sinyali bulunmadı']).map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-700">
        <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Sonraki adım</p>
        <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{analysis.nextSteps[0]}</p>
      </div>
    </section>
  );
}
