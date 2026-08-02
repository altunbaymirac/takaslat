import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Listing } from '../types';
import { aiDescribe, aiSwapScore, aiErrorMessage } from '../services/api';
import { showToast } from './Toast';

type DescriptionResult = Awaited<ReturnType<typeof aiDescribe>>;
type SwapScoreResult = Awaited<ReturnType<typeof aiSwapScore>>;

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

function toneClass(score: number) {
  if (score >= 80) return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40';
  if (score >= 55) return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40';
  return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40';
}

function buildLocalSummary(listing: Listing) {
  const v = listing.vehicleDetails;
  if (!v) {
    return `${listing.title}, ${listing.city} konumunda takasa açık bir ilan. İlan açıklaması ve beklenti metni üzerinden uygun takas adayları değerlendirilebilir.`;
  }

  const parts = [
    `${v.year} model ${v.brand} ${v.model}`,
    v.bodyType ? `${v.bodyType} kasa` : null,
    `${v.transmission.toLocaleLowerCase('tr-TR')} vites`,
    `${v.fuel.toLocaleLowerCase('tr-TR')} yakıt`,
    `${v.km.toLocaleString('tr-TR')} km`,
  ].filter(Boolean);

  return `${parts.join(', ')} özelliklerinde bir araç. ${listing.city} çevresinde takas düşünen kullanıcılar için değerlendirilebilir.`;
}

function buildHighlights(listing: Listing) {
  const v = listing.vehicleDetails;
  if (!v) return ['Takas beklentisi belirtilmiş', 'Platform içi teklif akışına uygun'];

  const items: string[] = [];
  if (v.year >= 2020) items.push('Yeni model yılı');
  if (v.km <= 75_000) items.push('Düşük kilometre');
  if (v.transmission === 'Otomatik') items.push('Otomatik vites');
  if (v.bodyType) items.push(`${v.bodyType} kasa`);
  if (!v.hasAccidentRecord) items.push('Hasar kaydı yok olarak girilmiş');
  if (v.hasExpertise) items.push('Ekspertiz bilgisi var');
  return items.slice(0, 5);
}

export default function ListingAIInsights({ listing }: { listing: Listing }) {
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState<DescriptionResult | null>(null);
  const [score, setScore] = useState<SwapScoreResult | null>(null);

  async function runAnalysis() {
    setLoading(true);
    try {
      const v = listing.vehicleDetails;
      const [descriptionRes, scoreRes] = await Promise.all([
        v
          ? aiDescribe({
              brand: v.brand,
              model: v.model,
              year: v.year,
              km: v.km,
              fuel: v.fuel,
              transmission: v.transmission,
              color: v.color,
              bodyType: v.bodyType,
              hasAccidentRecord: v.hasAccidentRecord,
              condition: listing.condition,
              city: listing.city,
            })
          : Promise.resolve({ description: buildLocalSummary(listing), basedOnSimilar: 0 }),
        aiSwapScore({ sourceListingId: listing.id }),
      ]);

      setDescription(descriptionRes);
      setScore(scoreRes);
      showToast('AI ilan özeti güncellendi', 'success');
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setLoading(false);
    }
  }

  const suggestions = score?.suggestions.slice(0, 3) ?? [];
  const highlights = buildHighlights(listing);
  const isVehicle = Boolean(listing.vehicleDetails);
  const analysisDescription = isVehicle
    ? 'Araç özellikleri, kullanım profili ve takas uyumu.'
    : 'İlan bilgileri, takas beklentisi ve uygun eşleşmeler.';
  const emptyDescription = isVehicle
    ? 'AI; model, kilometre, kullanım profili ve takas beklentisini birlikte değerlendirir.'
    : 'AI; ilan açıklamasını, değerini ve takas beklentisini birlikte değerlendirir.';

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm dark:border-blue-900/40 dark:bg-slate-800">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            AI İlan Analizi
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {analysisDescription}
          </p>
        </div>
        <button
          type="button"
          onClick={runAnalysis}
          disabled={loading}
          className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Analiz ediliyor...' : description ? 'Yenile' : 'AI analiz et'}
        </button>
      </div>

      {!description && !score && (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {emptyDescription}
        </div>
      )}

      {description && (
        <div className="mb-4 space-y-3">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-blue-900 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-100">
            <p className="text-xs font-bold uppercase tracking-wide opacity-70">İlan özeti</p>
            <p className="mt-2 text-sm leading-relaxed">{description.description}</p>
            {description.basedOnSimilar > 0 && (
              <p className="mt-2 text-[11px] font-semibold opacity-70">
                {description.basedOnSimilar} benzer ilan verisiyle desteklendi.
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {highlights.map((item) => (
              <span
                key={item}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
              >
                {item}
              </span>
            ))}
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
                className="block rounded-xl border border-slate-100 bg-slate-50 p-3 transition-colors hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-blue-700"
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

      {description && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          <p className="mb-1 text-xs font-bold text-slate-700 dark:text-slate-200">Kimler için uygun?</p>
          <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
            {listing.vehicleDetails?.bodyType
              ? `${listing.vehicleDetails.bodyType} kasa, ${listing.vehicleDetails.fuel.toLocaleLowerCase('tr-TR')} yakıt ve ${listing.vehicleDetails.transmission.toLocaleLowerCase('tr-TR')} vites tercih eden; takasta fiyat farkını net konuşmak isteyen kullanıcılar için uygun bir aday.`
              : 'Takas beklentisini netleştirip benzer değerdeki ilanlarla karşılaştırmak isteyen kullanıcılar için uygun bir aday.'}
          </p>
        </div>
      )}
    </div>
  );
}
