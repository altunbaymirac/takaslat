import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import FilterBar from '../components/FilterBar';
import { useSEO } from '../hooks/useSEO';
import { VEHICLE_GROUPS } from '../data/vehicleTypes';
import { aiErrorMessage, aiHomeMatch, type HomeMatchResult } from '../services/api';

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular';

const SORT_LABELS: Record<SortOption, string> = {
  newest:     'En yeni',
  oldest:     'En eski',
  price_asc:  'Fiyat — düşükten yükseğe',
  price_desc: 'Fiyat — yüksekten düşüğe',
  popular:    'En popüler',
};

const PAGE_SIZE = 12;
const LISTING_CODE_RE = /^TKS-\d{7}$/i;
const formatPrice = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);

export default function Listings() {
  useSEO({
    title: 'İlanlar | Takaslat',
    description: 'Türkiye genelindeki araç takas ilanlarını keşfet. Filtrele, karşılaştır, teklif ver.',
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    listings, filters,
    recentlyViewed, clearRecentlyViewed,
    boostedListings, setFilters, currentUserId,
  } = useAppStore();

  const [sortBy, setSortBy]       = useState<SortOption>('newest');
  const [sortOpen, setSortOpen]   = useState(false);
  const [page, setPage]           = useState(1);
  const [activeTab, setActiveTab] = useState<'search' | 'ai'>(
    searchParams.get('tab') === 'ai' ? 'ai' : 'search'
  );

  const [aiQuery, setAiQuery]                     = useState('');
  const [aiSourceListingId, setAiSourceListingId] = useState('');
  const [aiCashDirection, setAiCashDirection]     = useState<'any' | 'pay' | 'receive'>('any');
  const [aiCashAmount, setAiCashAmount]           = useState('');
  const [aiLoading, setAiLoading]   = useState(false);
  const [aiResult, setAiResult]     = useState<HomeMatchResult | null>(null);
  const [aiError, setAiError]       = useState<string | null>(null);

  useEffect(() => {
    const q = filters.searchQuery.trim();
    if (!LISTING_CODE_RE.test(q)) return;
    const match = listings.find(l => l.listingCode?.toUpperCase() === q.toUpperCase());
    if (match) {
      setFilters({ searchQuery: '' });
      navigate(`/listings/${match.id}`);
    }
  }, [filters.searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentlyViewedListings = useMemo(
    () => recentlyViewed
      .map(id => listings.find(l => l.id === id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l)),
    [recentlyViewed, listings]
  );

  const myListings = useMemo(
    () => listings.filter(l => l.ownerId === currentUserId),
    [listings, currentUserId]
  );

  const aiMatchedListings = useMemo(() => {
    if (!aiResult) return [];
    return aiResult.suggestions
      .map(s => {
        const listing = listings.find(l => l.id === s.listingId);
        return listing ? { listing, suggestion: s } : null;
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [aiResult, listings]);

  async function runHomeAI() {
    if (aiQuery.trim().length < 3) {
      setAiError('Aradığın aracı biraz daha detaylı yaz.');
      return;
    }
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await aiHomeMatch({
        query: aiQuery.trim(),
        sourceListingId: aiSourceListingId || undefined,
        cashDirection: aiCashDirection,
        cashAmount: Number(aiCashAmount) || undefined,
      });
      setAiResult(result);
      setPage(1);
    } catch (err) {
      setAiResult(null);
      setAiError(aiErrorMessage(err));
    } finally {
      setAiLoading(false);
    }
  }

  const filtered = useMemo(() => {
    const result = listings.filter(l => {
      if (filters.category !== 'Tümü' && l.category !== filters.category) return false;
      if (filters.city && l.city !== filters.city) return false;
      if (l.estimatedValue < filters.minValue || l.estimatedValue > filters.maxValue) return false;
      if (filters.searchQuery) {
        const terms = filters.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [
          l.listingCode, l.title, l.description, l.wantedFor, l.city, l.condition,
          l.vehicleDetails?.brand, l.vehicleDetails?.model, l.vehicleDetails?.fuel,
          l.vehicleDetails?.transmission, l.vehicleDetails?.color, l.vehicleDetails?.bodyType,
          l.electronicDetails?.brand, l.electronicDetails?.model, l.electronicDetails?.type, l.electronicDetails?.color,
          l.propertyDetails?.type, l.propertyDetails?.rooms,
          ...(l.tags ?? []),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!terms.every(t => haystack.includes(t))) return false;
      }
      const v = l.vehicleDetails;
      if (filters.brands.length > 0 && (!v?.brand || !filters.brands.includes(v.brand))) return false;
      if (filters.model && v?.model !== filters.model) return false;
      if (filters.fuels.length  > 0 && (!v?.fuel  || !filters.fuels.includes(v.fuel)))   return false;
      if (v?.year !== undefined) {
        if (v.year < filters.minYear || v.year > filters.maxYear) return false;
      }
      if (v?.km !== undefined) {
        if (v.km < filters.minKm || v.km > filters.maxKm) return false;
      }
      if (filters.noAccidentOnly && v?.hasAccidentRecord) return false;
      if (filters.vehicleGroup && VEHICLE_GROUPS[filters.vehicleGroup]) {
        const allowed = VEHICLE_GROUPS[filters.vehicleGroup];
        if (!v?.bodyType || !allowed.includes(v.bodyType)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const validBoost = (ts: string | undefined) =>
        ts ? Date.now() - new Date(ts).getTime() < 7 * 86_400_000 : false;
      const aBoost = validBoost(boostedListings[a.id]);
      const bBoost = validBoost(boostedListings[b.id]);
      if (aBoost && !bBoost) return -1;
      if (!aBoost && bBoost) return 1;
      switch (sortBy) {
        case 'price_asc':  return a.estimatedValue - b.estimatedValue;
        case 'price_desc': return b.estimatedValue - a.estimatedValue;
        case 'popular':    return (b.viewCount ?? 0) - (a.viewCount ?? 0);
        case 'oldest':     return a.createdAt.localeCompare(b.createdAt);
        default:           return b.createdAt.localeCompare(a.createdAt);
      }
    });

    return result;
  }, [listings, filters, boostedListings, sortBy]);

  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedResult = useMemo(() => filtered.slice(0, page * PAGE_SIZE), [filtered, page]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Tab switcher ── */}
      <div className="mb-4 flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab('search')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm sm:text-base font-semibold transition-all ${
            activeTab === 'search'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          İlan Ara
        </button>
        <button
          onClick={() => setActiveTab('ai')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm sm:text-base font-semibold transition-all ${
            activeTab === 'ai'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
          </svg>
          AI ile Bul
        </button>
      </div>

      {/* ── Tab content ── */}
      {activeTab === 'search' ? (
        <FilterBar onFilterChange={() => setPage(1)} />
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <textarea
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runHomeAI(); }
            }}
            placeholder="Ne arıyorsun? Örn: 2020 ve üstü sedan, otomatik, hasarsız, 500.000 km altı"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />

          <details className="mt-2">
            <summary className="cursor-pointer select-none text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
              Gelişmiş seçenekler (opsiyonel)
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-3">
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Kendi ilanım</label>
                <select
                  value={aiSourceListingId}
                  onChange={e => setAiSourceListingId(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="">Seçmeden ara</option>
                  {myListings.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Para farkı</label>
                <select
                  value={aiCashDirection}
                  onChange={e => setAiCashDirection(e.target.value as 'any' | 'pay' | 'receive')}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="any">Fark önemli değil</option>
                  <option value="pay">Üste para öderim</option>
                  <option value="receive">Para farkı alırım</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-400">Tutar (₺)</label>
                <input
                  type="number"
                  value={aiCashAmount}
                  onChange={e => setAiCashAmount(e.target.value)}
                  placeholder="Örn: 100000"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                />
              </div>
            </div>
          </details>

          {aiError && (
            <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {aiError}
            </p>
          )}

          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-slate-400">Enter ile ara · Shift+Enter yeni satır</p>
            <button
              type="button"
              onClick={runHomeAI}
              disabled={aiLoading || aiQuery.trim().length < 3}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
            >
              {aiLoading ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Arıyor...
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  AI ile Ara
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── AI Results ── */}
      {aiResult && (
        <section className="mt-4 rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-blue-900/40 dark:bg-slate-800">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-blue-500">AI eşleştirme</p>
              <h2 className="mt-1 text-lg font-bold text-slate-900 dark:text-slate-100">{aiResult.message}</h2>
              {aiResult.source && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Kaynak ilan: <span className="font-semibold text-slate-700 dark:text-slate-200">{aiResult.source.title}</span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => setAiResult(null)}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700"
            >
              Kapat
            </button>
          </div>

          {aiMatchedListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {aiMatchedListings.map(({ listing, suggestion }) => (
                <div key={listing.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
                  <Link to={`/listing/${listing.id}`} className="flex gap-3 p-3 transition hover:bg-white dark:hover:bg-slate-800">
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
            <div className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              AI bu kriterlerle uygun ilan bulamadı.
            </div>
          )}
        </section>
      )}

      {/* ── Recently Viewed ── */}
      {recentlyViewedListings.length > 0 && (
        <section className="mt-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Son baktıkların</h2>
            <button onClick={clearRecentlyViewed} className="text-xs text-slate-400 hover:text-red-500 font-medium">
              Temizle
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
            {recentlyViewedListings.slice(0, 8).map(l => (
              <Link
                key={l.id}
                to={`/listing/${l.id}`}
                className="flex-shrink-0 w-44 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <img src={l.images[0]} alt="" className="w-full h-24 object-cover" />
                <div className="p-2.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{l.title}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-0.5">{formatPrice(l.estimatedValue)}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Listings toolbar ── */}
      <div className="flex items-center justify-between mt-6 mb-3 flex-wrap gap-2">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">İlanlar</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setSortOpen(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full transition-colors"
            >
              <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
              </svg>
              {SORT_LABELS[sortBy]}
              <svg className={`w-3 h-3 text-slate-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {sortOpen && (
              <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-20">
                {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSortBy(key); setSortOpen(false); setPage(1); }}
                    className={`w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2 ${
                      sortBy === key
                        ? 'text-blue-600 dark:text-blue-400 font-semibold bg-blue-50 dark:bg-blue-900/20'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700'
                    }`}
                  >
                    {label}
                    {sortBy === key && <span className="ml-auto text-blue-500">✓</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link
            to="/map"
            className="text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            Harita
          </Link>
        </div>
      </div>

      {/* ── Listings grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 shadow-sm flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-semibold mb-1">Sonuç bulunamadı</p>
          <p className="text-slate-400 dark:text-slate-500 text-sm">Farklı filtreler deneyin</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              <span className="font-semibold text-slate-700 dark:text-slate-200">{filtered.length}</span> ilan
              {filtered.length > PAGE_SIZE && (
                <span> · <span className="font-semibold text-slate-700 dark:text-slate-200">{Math.min(page * PAGE_SIZE, filtered.length)}</span> gösteriliyor</span>
              )}
            </p>
            {totalPages > 1 && (
              <span className="text-xs text-slate-400 dark:text-slate-500">Sayfa {page} / {totalPages}</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedResult.map(l => <ListingCard key={l.id} listing={l} />)}
          </div>

          {page * PAGE_SIZE < filtered.length && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <button
                onClick={() => setPage(p => p + 1)}
                className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-sm px-8 py-3 rounded-2xl border border-blue-200 dark:border-blue-900/40 shadow-sm hover:shadow-md transition-all"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                Daha fazla göster
                <span className="text-xs text-blue-400 font-normal">({filtered.length - page * PAGE_SIZE} ilan daha)</span>
              </button>
              <div className="w-48 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, (page * PAGE_SIZE / filtered.length) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                %{Math.round((Math.min(page * PAGE_SIZE, filtered.length) / filtered.length) * 100)} görüntülendi
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
