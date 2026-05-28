import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../types';
import { aiRisk, aiSwapScore } from '../services/api';
import { showToast } from './Toast';

type RiskResult = Awaited<ReturnType<typeof aiRisk>>;
type SwapScoreResult = Awaited<ReturnType<typeof aiSwapScore>>;

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

function toneClass(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40';
  if (score >= 55) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40';
  return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-900/40';
}

export default function ListingAIInsights({ listing }: { listing: Listing }) {
  const [loading, setLoading] = useState(false);
  const [risk, setRisk] = useState<RiskResult | null>(null);
  const [score, setScore] = useState<SwapScoreResult | null>(null);

  async function runAnalysis() {
    setLoading(true);
    try {
      const [riskRes, scoreRes] = await Promise.all([
        aiRisk({ listingId: listing.id }),
        aiSwapScore({ sourceListingId: listing.id }),
      ]);
      setRisk(riskRes);
      setScore(scoreRes);
      showToast('AI ilan analizi güncellendi', 'success');
    } catch {
      showToast('AI analizi için backend bağlantısı gerekli', 'error');
    } finally {
      setLoading(false);
    }
  }

  const suggestions = score?.suggestions.slice(0, 3) ?? [];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-blue-100 dark:border-blue-900/40 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>✦</span> AI İlan Analizi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Veritabanındaki güncel ilanlara göre risk analizi ve takas uyumu.
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Analiz ediliyor...' : risk ? 'Yenile' : 'AI analiz et'}
        </button>
      </div>

      {!risk && !score && (
        <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-5 text-sm text-slate-600 dark:text-slate-300">
          AI bu ilanı platformdaki gerçek kayıtlarla karşılaştırır; fiyat farkı, açıklama kalitesi, risk sinyalleri ve en uygun takas adaylarını çıkarır.
        </div>
      )}

      {risk && (
        <div className="mb-4">
          <div className={`rounded-xl border p-4 ${toneClass(100 - risk.riskScore)}`}>
            <p className="text-xs font-semibold opacity-80">Risk Seviyesi</p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-2xl font-black">%{risk.riskScore}</span>
              <span className="pb-1 text-xs font-bold">{risk.level}</span>
            </div>
            {(risk.positives[0] || risk.risks[0]) && (
              <p className="mt-2 text-xs leading-relaxed">{risk.positives[0] ?? risk.risks[0]}</p>
            )}
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">En uygun takas adayları</p>
            <span className="text-[11px] text-slate-400">{suggestions.length} eşleşme</span>
          </div>
          <div className="space-y-2">
            {suggestions.map((s) => (
              <Link
                key={s.listingId}
                to={`/listing/${s.listingId}`}
                className="block rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-3 transition-colors hover:border-blue-300 dark:hover:border-blue-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">{s.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {s.city} · {fmt(s.value)} · Fark {fmt(Math.abs(s.priceDiff))}
                    </p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${toneClass(s.compatibilityScore)}`}>
                    %{s.compatibilityScore}
                  </span>
                </div>
                {s.reasons.length > 0 && (
                  <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{s.reasons.join(' · ')}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {risk && risk.checklist.length > 0 && (
        <div className="mt-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 p-3">
          <p className="mb-1 text-xs font-bold text-blue-800 dark:text-blue-200">Görüşmeden önce kontrol</p>
          <ul className="space-y-1">
            {risk.checklist.slice(0, 3).map((item) => (
              <li key={item} className="text-xs text-blue-700 dark:text-blue-300">✓ {item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
