import { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import FilterBar from '../components/FilterBar';
import { useSEO } from '../hooks/useSEO';
import { VEHICLE_GROUPS } from '../data/vehicleTypes';

type SortOption = 'newest' | 'oldest' | 'price_asc' | 'price_desc' | 'popular';

const SORT_LABELS: Record<SortOption, string> = {
  newest:     '🕐 En Yeni',
  oldest:     '🕰️ En Eski',
  price_asc:  '💰 Fiyat: Düşük → Yüksek',
  price_desc: '💎 Fiyat: Yüksek → Düşük',
  popular:    '🔥 En Popüler',
};

const PAGE_SIZE = 12;

const LISTING_CODE_RE = /^TKS-\d{7}$/i;

export default function Home() {
  useSEO({
    title: 'Araç Takasının En Akıllı Adresi | Takaslat',
    description: 'Arabanı takas et. İlan ver, teklif al, güvenle buluş. Türkiye\'nin en akıllı araç takas platformu.',
  });

  const navigate = useNavigate();

  const {
    listings, filters, openAIPanel,
    recentlyViewed, clearRecentlyViewed,
    boostedListings, setFilters,
  } = useAppStore();

  const [sortBy, setSortBy]     = useState<SortOption>('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [page, setPage]         = useState(1);

  // ── İlan kodu doğrudan yönlendirme ──────────────────────────────────────────
  useEffect(() => {
    const q = filters.searchQuery.trim();
    if (!LISTING_CODE_RE.test(q)) return;
    const match = listings.find(
      (l) => l.listingCode?.toUpperCase() === q.toUpperCase()
    );
    if (match) {
      setFilters({ searchQuery: '' });
      navigate(`/listings/${match.id}`);
    }
    // listingCode store'da yoksa (API'den gelmeyen ilan) backend /code/:code endpointi devreye girer
    // FilterBar'daki Enter olayında bu da tetiklenecek
  }, [filters.searchQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  const recentlyViewedListings = useMemo(
    () => recentlyViewed
      .map((id) => listings.find((l) => l.id === id))
      .filter((l): l is NonNullable<typeof l> => Boolean(l)),
    [recentlyViewed, listings]
  );

  // ── Gerçek istatistikler (ilan verisinden hesaplanır) ──────────────────────
  const heroStats = useMemo(() => {
    const count = listings.length;
    const avg = count
      ? Math.round(listings.reduce((sum, l) => sum + (l.estimatedValue || 0), 0) / count)
      : 0;
    const cities = new Set(listings.map((l) => l.city).filter(Boolean)).size;
    const fmtAvg =
      avg >= 1_000_000 ? `₺${(avg / 1_000_000).toFixed(1)}M`
      : avg >= 1_000   ? `₺${Math.round(avg / 1_000)}K`
      : `₺${avg}`;
    return { count, fmtAvg, cities };
  }, [listings]);

  const filtered = useMemo(() => {
    const result = listings.filter(l => {
      if (filters.category !== 'Tümü' && l.category !== filters.category) return false;
      if (filters.city && l.city !== filters.city) return false;
      if (l.estimatedValue < filters.minValue || l.estimatedValue > filters.maxValue) return false;
      if (filters.searchQuery) {
        // Tam metin arama — birden çok kelimeyi AND ile arar
        const terms = filters.searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const haystack = [
          l.listingCode,
          l.title, l.description, l.wantedFor, l.city, l.condition,
          l.vehicleDetails?.brand, l.vehicleDetails?.model, l.vehicleDetails?.fuel, l.vehicleDetails?.transmission, l.vehicleDetails?.color, l.vehicleDetails?.bodyType,
          l.electronicDetails?.brand, l.electronicDetails?.model, l.electronicDetails?.type, l.electronicDetails?.color,
          l.propertyDetails?.type, l.propertyDetails?.rooms,
          ...(l.tags ?? []),
        ].filter(Boolean).join(' ').toLowerCase();
        if (!terms.every((t) => haystack.includes(t))) return false;
      }
      // ── Gelişmiş filtreler ─────────────────────────────────────────────────
      const v = l.vehicleDetails;
      if (filters.brands.length > 0 && (!v?.brand || !filters.brands.includes(v.brand))) return false;
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

    // ── Sort ──────────────────────────────────────────────────────────────────
    result.sort((a, b) => {
      // Boost'lu olanlar her zaman üstte
      const boostA = boostedListings[a.id];
      const boostB = boostedListings[b.id];
      const validBoost = (ts: string | undefined) =>
        ts ? Date.now() - new Date(ts).getTime() < 7 * 86_400_000 : false;
      const aBoost = validBoost(boostA);
      const bBoost = validBoost(boostB);
      if (aBoost && !bBoost) return -1;
      if (!aBoost && bBoost) return 1;

      // Sıralama kriteri
      switch (sortBy) {
        case 'price_asc':  return a.estimatedValue - b.estimatedValue;
        case 'price_desc': return b.estimatedValue - a.estimatedValue;
        case 'popular':    return (b.viewCount ?? 0) - (a.viewCount ?? 0);
        case 'oldest':     return a.createdAt.localeCompare(b.createdAt);
        default:           return b.createdAt.localeCompare(a.createdAt); // newest
      }
    });

    return result;
  }, [listings, filters, boostedListings, sortBy]);

  // Sayfalama
  const totalPages  = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedResult = useMemo(
    () => filtered.slice(0, page * PAGE_SIZE),
    [filtered, page]
  );

  return (
    <>
      {/* ════════════════════════════════ HERO ════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2d6e] via-[#1B4FD8] to-[#2563eb]">
        {/* decorative blobs */}
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-9 pb-7 text-center">
          {/* eyebrow */}
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full mb-4 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {listings.length} aktif ilan • Türkiye geneli
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white leading-[1.1] tracking-tight mb-3">
            Ne var ne yok, <span className="text-amber-400">takaslat.</span>
          </h1>

          <p className="text-blue-200 text-sm sm:text-base max-w-lg mx-auto mb-6 leading-relaxed">
            Araç takasının en akıllı adresi. İlan ver, teklif al, güvenle buluş.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <a href="#listings"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-7 py-3 rounded-2xl transition-colors shadow-lg shadow-blue-900/20">
              Araçları İncele
            </a>
            <button
              onClick={() => openAIPanel()}
              className="bg-amber-400 hover:bg-amber-300 text-amber-900 font-semibold text-sm px-7 py-3 rounded-2xl transition-colors shadow-lg shadow-amber-900/10 flex items-center gap-2">
              <span className="text-base leading-none">✦</span>
              AI ile Eşleştir
            </button>
            <Link to="/create"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white font-semibold text-sm px-7 py-3 rounded-2xl transition-colors border border-white/20">
              Aracımı Takas Et
            </Link>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="relative border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-3 divide-x divide-white/10">
            {[
              { n: `${heroStats.count}`, label: 'Aktif İlan' },
              { n: heroStats.fmtAvg, label: 'Ortalama Değer' },
              { n: `${heroStats.cities}`, label: 'İl' },
            ].map(s => (
              <div key={s.label} className="py-4 text-center">
                <p className="text-xl font-bold text-white">{s.n}</p>
                <p className="text-blue-300 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════ MAIN ════════════════════════════════ */}
      <div id="listings" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Son görüntülenen ilanlar — hero altında ince şerit */}
        {recentlyViewedListings.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>🕐</span> Son Baktıkların
              </h2>
              <button
                onClick={clearRecentlyViewed}
                className="text-xs text-slate-400 hover:text-red-500 font-medium"
              >
                Temizle
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {recentlyViewedListings.slice(0, 8).map((l) => (
                <Link
                  key={l.id}
                  to={`/listing/${l.id}`}
                  className="flex-shrink-0 w-44 bg-white dark:bg-slate-800 rounded-2xl overflow-hidden card-shadow hover:shadow-md transition-shadow"
                >
                  <img src={l.images[0]} alt="" className="w-full h-24 object-cover" />
                  <div className="p-2.5">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{l.title}</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-0.5">
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(l.estimatedValue)}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Toolbar: başlık, sıralama, harita ── */}
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">İlanlar</h2>

          <div className="flex items-center gap-2">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setSortOpen(v => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-full transition-colors"
              >
                <svg className="w-3.5 h-3.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                {SORT_LABELS[sortBy].split(' ').slice(1).join(' ')}
                <svg className={`w-3 h-3 text-slate-400 transition-transform ${sortOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
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
              <span>🗺️</span> Harita
            </Link>
          </div>
        </div>
        <FilterBar onFilterChange={() => setPage(1)} />

        <div className="mt-5">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white dark:bg-slate-800 card-shadow flex items-center justify-center mb-4">
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
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    Sayfa {page} / {totalPages}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {pagedResult.map(l => <ListingCard key={l.id} listing={l} />)}
              </div>

              {/* Daha Fazla Göster */}
              {page * PAGE_SIZE < filtered.length && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  <button
                    onClick={() => setPage(p => p + 1)}
                    className="inline-flex items-center gap-2 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold text-sm px-8 py-3 rounded-2xl border border-blue-200 dark:border-blue-900/40 shadow-sm hover:shadow-md transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                    Daha Fazla Göster
                    <span className="text-xs text-blue-400 font-normal">
                      ({filtered.length - page * PAGE_SIZE} ilan daha)
                    </span>
                  </button>
                  {/* Progress bar */}
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
      </div>

    </>
  );
}
