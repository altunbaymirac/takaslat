import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import SwapOfferModal from '../components/SwapOfferModal';
import ShareMenu from '../components/ShareMenu';
import ReportModal from '../components/ReportModal';
import EditListingModal from '../components/EditListingModal';
import ValueForecastModal from '../components/ValueForecastModal';
import ImageLightbox from '../components/ImageLightbox';
import ListingQASection from '../components/ListingQASection';
import ListingCard from '../components/ListingCard';
import VideoEmbed from '../components/VideoEmbed';
import ListingAIInsights from '../components/ListingAIInsights';
import { showToast } from '../components/Toast';
import { getListingHealth } from '../lib/listingHealth';
import { fetchListingById } from '../services/api';
import { useSEO } from '../hooks/useSEO';
import type { Listing } from '../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

// ─── Küçük yardımcı: özellik satırı ─────────────────────────────────────────

function SpecRow({ icon, label, value, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: 'green' | 'red' | 'amber';
}) {
  const accentClass = accent === 'green'
    ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
    : accent === 'red'
    ? 'text-red-600 dark:text-red-400 font-semibold'
    : accent === 'amber'
    ? 'text-amber-600 dark:text-amber-400 font-semibold'
    : 'text-slate-800 dark:text-slate-200 font-medium';

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
      <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400 text-sm">
        <span className="w-5 h-5 flex items-center justify-center flex-shrink-0">{icon}</span>
        {label}
      </div>
      <span className={`text-sm ${accentClass}`}>{value}</span>
    </div>
  );
}

// ─── Öne çıkan özellik rozeti ─────────────────────────────────────────────────

function HighlightBadge({ icon, text, color }: { icon: string; text: string; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${color}`}>
      <span>{icon}</span>
      <span>{text}</span>
    </div>
  );
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { listings, openAIPanel, currentUserId, favorites, toggleFavorite, deleteListing, recordView, boostListing, isBoosted } = useAppStore();

  // ── State — tümü koşullu return'lardan önce (Rules of Hooks) ─────────────
  const [apiFetched, setApiFetched]       = useState<Listing | null>(null);
  const [apiLoading, setApiLoading]       = useState(false);
  const [apiNotFound, setApiNotFound]     = useState(false);
  const [activeImage, setActiveImage]     = useState(0);
  const [offerModalOpen,    setOfferModalOpen]    = useState(false);
  const [reportModalOpen,   setReportModalOpen]   = useState(false);
  const [editModalOpen,     setEditModalOpen]     = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [forecastOpen,      setForecastOpen]      = useState(false);
  const [lightboxOpen,      setLightboxOpen]      = useState(false);

  // ── Store'da yoksa API'den yükle ──────────────────────────────────────────
  const storeMatch = listings.find((l) => l.id === id);
  useEffect(() => {
    if (storeMatch || !id) return;
    setApiLoading(true);
    setApiNotFound(false);
    fetchListingById(id)
      .then((l) => { if (l) setApiFetched(l); else setApiNotFound(true); })
      .catch(() => setApiNotFound(true))
      .finally(() => setApiLoading(false));
  }, [id, storeMatch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (id) recordView(id);
  }, [id, recordView]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Hooks that depend on listing.id — use `id` (URL param) to stay above ─
  // conditional returns and obey Rules of Hooks.
  // Do NOT use `?? []` here — a new array reference every render breaks useSyncExternalStore
  const viewLog      = useAppStore((s) => s.viewLog[id ?? '']);
  const viewsByDay   = useMemo(() => {
    const log = viewLog ?? [];
    const days: { day: string; date: Date; count: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push({ day: d.toLocaleDateString('tr-TR', { weekday: 'short' }), date: d, count: 0 });
    }
    for (const ts of log) {
      const t = new Date(ts);
      for (const d of days) {
        const dayEnd = new Date(d.date);
        dayEnd.setDate(d.date.getDate() + 1);
        if (t >= d.date && t < dayEnd) { d.count++; break; }
      }
    }
    return days;
  }, [viewLog]);

  // ── SEO — listing may be null while loading; hook updates when data arrives ─
  const pendingListing = storeMatch ?? apiFetched;
  useSEO({
    title:       pendingListing ? `${pendingListing.title} — ${pendingListing.city}` : undefined,
    description: pendingListing
      ? `${pendingListing.title} · ${new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(pendingListing.estimatedValue)} · ${pendingListing.city}. Takaslat'ta takas teklifleri verin.`
      : undefined,
    image:       pendingListing?.images?.[0],
    type:        'product',
  });

  // ── Derived values (non-hook, can be after conditional returns) ───────────
  const listing = storeMatch ?? apiFetched;

  if (apiLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400">İlan yükleniyor...</p>
      </div>
    );
  }

  if (!listing || apiNotFound) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4">🔍</div>
        <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-100 mb-2">İlan bulunamadı</h2>
        <p className="text-slate-400 mb-8">Bu ilan kaldırılmış veya URL yanlış olabilir.</p>
        <Link to="/" className="bg-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors">
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  // ── Event handlers (non-hook — safe after conditional returns) ───────────
  function handleFavoriteClick(listingId: string, wasFav: boolean) {
    toggleFavorite(listingId);
    showToast(wasFav ? 'Favorilerden çıkarıldı' : 'Favorilere eklendi', 'success');
  }

  async function handleDelete() {
    if (!listing) return;
    try {
      await deleteListing(listing.id);
      navigate('/');
      showToast('İlan kaldırıldı', 'success');
    } catch {
      showToast('İlan kaldırılamadı, tekrar deneyin', 'error');
    }
  }

  const v  = listing.vehicleDetails;
  const e  = listing.electronicDetails;
  const p  = listing.propertyDetails;
  const isOwner = listing.ownerId === currentUserId;
  const listingHealth = getListingHealth(listing);
  const trustToneClass: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40',
    blue:    'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40',
    amber:   'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40',
    slate:   'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
  };
  const ownerRating = listing.ownerRating ?? 5;

  // ── Sahip için istatistikler ─────────────────────────────────────────────
  const allOffers    = useAppStore.getState().offers;  // getState() is NOT a hook — safe here
  const offersOnThis = allOffers.filter((o) => o.listingId === listing.id);
  const ownerStats   = isOwner ? {
    views:    listing.viewCount ?? 0,
    offers:   offersOnThis.length,
    pending:  offersOnThis.filter((o) => o.status === 'Beklemede').length,
    accepted: offersOnThis.filter((o) => o.status === 'Tamamlandı').length,
  } : null;
  // viewsByDay is computed above (before conditional returns)
  const isFav = favorites.includes(listing.id);
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/listing/${listing.id}`
    : `/listing/${listing.id}`;

  const conditionMeta: Record<string, { color: string; label: string }> = {
    'Mükemmel': { color: 'bg-emerald-100 text-emerald-700', label: 'Mükemmel' },
    'İyi':      { color: 'bg-blue-100 text-blue-700',       label: 'İyi'       },
    'Orta':     { color: 'bg-amber-100 text-amber-700',     label: 'Orta'      },
    'Yıpranmış':{ color: 'bg-red-100 text-red-700',         label: 'Yıpranmış' },
  };

  // Otomatik öne çıkan özellikler
  const highlights: { icon: string; text: string; color: string }[] = [];
  if (v) {
    if (!v.hasAccidentRecord)       highlights.push({ icon: '✅', text: 'Hasar Kaydı Yok',        color: 'bg-emerald-50 text-emerald-700' });
    if ((v.km ?? 0) < 50_000)       highlights.push({ icon: '🏃', text: 'Düşük Kilometre',         color: 'bg-blue-50 text-blue-700'     });
    if ((v.year ?? 0) >= 2021)      highlights.push({ icon: '✨', text: `${v.year} Model`,          color: 'bg-violet-50 text-violet-700' });
    if (v.fuel === 'Hibrit')        highlights.push({ icon: '⚡', text: 'Hibrit',                  color: 'bg-teal-50 text-teal-700'     });
    if (v.fuel === 'Elektrik')      highlights.push({ icon: '⚡', text: 'Elektrikli',              color: 'bg-teal-50 text-teal-700'     });
    if (v.transmission === 'Otomatik') highlights.push({ icon: '🕹️', text: 'Otomatik Vites',    color: 'bg-slate-100 text-slate-600'  });
    if (v.hasAccidentRecord)        highlights.push({ icon: '⚠️', text: 'Hasar Kaydı Var',        color: 'bg-red-50 text-red-600'       });
  }
  if (e) {
    if (e.warranty === 'Devam ediyor')      highlights.push({ icon: '🛡️', text: 'Garantisi devam ediyor', color: 'bg-emerald-50 text-emerald-700' });
    if ((e.batteryHealth ?? 0) >= 90)       highlights.push({ icon: '🔋', text: `Batarya %${e.batteryHealth}`, color: 'bg-emerald-50 text-emerald-700' });
    else if (e.batteryHealth && e.batteryHealth < 80) highlights.push({ icon: '🪫', text: `Batarya %${e.batteryHealth}`, color: 'bg-amber-50 text-amber-700' });
    if ((e.accessories?.length ?? 0) >= 3)  highlights.push({ icon: '📦', text: 'Tam aksesuarlı',            color: 'bg-blue-50 text-blue-700' });
    if (e.accessories?.includes('Orijinal kutu')) highlights.push({ icon: '🎁', text: 'Orijinal kutusunda',  color: 'bg-violet-50 text-violet-700' });
  }
  if (p) {
    if (p.balcony)                          highlights.push({ icon: '🌿', text: 'Balkonlu',          color: 'bg-emerald-50 text-emerald-700' });
    if (p.elevator)                         highlights.push({ icon: '🛗', text: 'Asansörlü',         color: 'bg-blue-50 text-blue-700' });
    if (p.parking)                          highlights.push({ icon: '🅿️', text: 'Otoparklı',        color: 'bg-blue-50 text-blue-700' });
    if (p.furnished)                        highlights.push({ icon: '🛋️', text: 'Eşyalı',            color: 'bg-amber-50 text-amber-700' });
    if (p.titleDeed === 'Kat Mülkiyetli')   highlights.push({ icon: '📜', text: 'Kat Mülkiyetli',    color: 'bg-emerald-50 text-emerald-700' });
    if ((p.buildingAge ?? 99) <= 5)         highlights.push({ icon: '🏗️', text: 'Yeni Bina',         color: 'bg-violet-50 text-violet-700' });
  }
  if (listing.condition === 'Mükemmel') highlights.push({ icon: '⭐', text: 'Mükemmel Durum', color: 'bg-amber-50 text-amber-700' });

  // Yakıt ikonu
  const fuelIcon: Record<string, string> = {
    'Benzin': '⛽', 'Dizel': '🛢️', 'LPG': '🔵',
    'Hibrit': '⚡', 'Elektrik': '⚡',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb + Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
        <nav className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500">
          <Link to="/" className="hover:text-blue-600 transition-colors">İlanlar</Link>
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-slate-600 dark:text-slate-300 truncate max-w-xs">{listing.title}</span>
        </nav>

        <div className="flex items-center gap-2">
          {/* Görüntülenme sayacı */}
          {typeof listing.viewCount === 'number' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 px-3 py-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <strong className="font-semibold text-slate-700 dark:text-slate-200">{listing.viewCount.toLocaleString('tr-TR')}</strong>
              görüntülenme
            </span>
          )}

          {/* Favori */}
          <button
            onClick={() => handleFavoriteClick(listing.id, isFav)}
            title={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
            className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${
              isFav
                ? 'bg-red-500 border-red-500 text-white shadow-md'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-red-500'
            }`}
          >
            <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Paylaş */}
          <ShareMenu url={shareUrl} title={listing.title} />

          {/* Değer Tahmini */}
          <button
            onClick={() => setForecastOpen(true)}
            title="12 aylık değer projeksiyonu"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-slate-600 dark:text-slate-300 hover:text-violet-600 flex items-center justify-center transition-colors"
          >
            <span className="text-sm">🔮</span>
          </button>

          {/* Yazdır / PDF */}
          <button
            onClick={() => window.print()}
            title="İlanı yazdır / PDF olarak kaydet"
            className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center justify-center transition-colors print:hidden"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
          </button>

          {/* Şikayet (sahibi değilse) */}
          {!isOwner && (
            <button
              onClick={() => setReportModalOpen(true)}
              title="Bu ilanı şikayet et"
              className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-600 dark:text-slate-300 hover:text-red-600 flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* ── Sol: Görsel + Özellikler ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Galeri */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="relative aspect-video bg-slate-100">
              <img
                src={listing.images[activeImage]}
                alt={listing.title}
                onClick={() => setLightboxOpen(true)}
                className="w-full h-full object-cover cursor-zoom-in"
              />
              {/* Üst rozetler */}
              <div className="absolute top-3 left-3 flex gap-2">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${conditionMeta[listing.condition]?.color ?? 'bg-slate-100 text-slate-600'}`}>
                  {listing.condition}
                </span>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/90 text-slate-700">
                  {listing.category}
                </span>
              </div>
              {/* Fotoğraf sayısı */}
              {listing.images.length > 1 && (
                <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  {activeImage + 1} / {listing.images.length}
                </div>
              )}
              {/* Sol/sağ oklar */}
              {listing.images.length > 1 && (
                <>
                  <button
                    onClick={() => setActiveImage(i => (i - 1 + listing.images.length) % listing.images.length)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow transition"
                  >
                    <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <button
                    onClick={() => setActiveImage(i => (i + 1) % listing.images.length)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/80 hover:bg-white rounded-full flex items-center justify-center shadow transition"
                  >
                    <svg className="w-4 h-4 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                  </button>
                </>
              )}
            </div>
            {/* Küçük görseller */}
            {listing.images.length > 1 && (
              <div className="p-3 flex gap-2 overflow-x-auto">
                {listing.images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${
                      activeImage === i ? 'border-blue-600 scale-105' : 'border-transparent hover:border-slate-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Başlık + Fiyat + Hızlı Özellikler */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 leading-tight">{listing.title}</h1>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                    {listing.city}
                  </span>
                  <span>·</span>
                  <span>{new Date(listing.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">{fmt(listing.estimatedValue)}</div>
                <div className="text-xs text-slate-400 mt-0.5">Tahmini değer</div>
              </div>
            </div>

            {/* Hızlı araç özellikleri (bar) */}
            {v && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
                {[
                  { icon: '📅', label: 'Model Yılı', value: v.year?.toString() ?? '—' },
                  { icon: '🛣️', label: 'Kilometre',  value: `${(v.km ?? 0).toLocaleString('tr-TR')} km` },
                  { icon: fuelIcon[v.fuel ?? ''] ?? '⛽', label: 'Yakıt', value: v.fuel ?? '—' },
                  { icon: '⚙️', label: 'Şanzıman',   value: v.transmission ?? '—' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl py-3 px-2 text-center">
                    <span className="text-xl mb-1">{icon}</span>
                    <span className="text-xs text-slate-400 mb-0.5">{label}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hızlı elektronik özellikleri (bar) */}
            {e && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                {[
                  { icon: '📱', label: 'Tür',       value: e.type },
                  { icon: '💾', label: 'Depolama',  value: e.storage ?? '—' },
                  { icon: '🛡️', label: 'Garanti',  value: e.warranty ?? '—' },
                  { icon: '🔋', label: 'Batarya',   value: e.batteryHealth ? `%${e.batteryHealth}` : '—' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl py-3 px-2 text-center">
                    <span className="text-xl mb-1">{icon}</span>
                    <span className="text-xs text-slate-400 mb-0.5">{label}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Hızlı gayrimenkul özellikleri (bar) */}
            {p && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                {[
                  { icon: '📐', label: 'Net m²',     value: p.netSqm?.toString() ?? '—' },
                  { icon: '🚪', label: 'Oda',        value: p.rooms ?? '—' },
                  { icon: '🏢', label: 'Kat',        value: p.floor ?? '—' },
                  { icon: '🏗️', label: 'Bina Yaşı', value: p.buildingAge !== undefined ? `${p.buildingAge} yıl` : '—' },
                ].map(({ icon, label, value }) => (
                  <div key={label} className="flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 rounded-xl py-3 px-2 text-center">
                    <span className="text-xl mb-1">{icon}</span>
                    <span className="text-xs text-slate-400 mb-0.5">{label}</span>
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Etiketler */}
            {listing.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {listing.tags.map((tag) => (
                  <span key={tag} className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-medium">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Öne Çıkan Özellikler */}
          {highlights.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <span>⭐</span> Öne Çıkan Özellikler
              </h2>
              <div className="flex flex-wrap gap-2">
                {highlights.map((h, i) => (
                  <HighlightBadge key={i} {...h} />
                ))}
              </div>
            </div>
          )}

          <ListingAIInsights listing={listing} />

          {/* Detaylı Araç Özellikleri */}
          {v && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                <span>🚗</span> Araç Özellikleri
              </h2>
              <p className="text-xs text-slate-400 mb-4">Satıcı tarafından girilmiş teknik bilgiler</p>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                <SpecRow
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/></svg>}
                  label="Marka"
                  value={v.brand ?? '—'}
                />
                <SpecRow
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>}
                  label="Model"
                  value={v.model ?? '—'}
                />
                <SpecRow
                  icon={<span className="text-sm">📅</span>}
                  label="Model Yılı"
                  value={v.year?.toString() ?? '—'}
                  accent={(v.year ?? 0) >= 2021 ? 'green' : undefined}
                />
                <SpecRow
                  icon={<span className="text-sm">🛣️</span>}
                  label="Kilometre"
                  value={`${(v.km ?? 0).toLocaleString('tr-TR')} km`}
                  accent={(v.km ?? 0) < 50_000 ? 'green' : (v.km ?? 0) > 150_000 ? 'amber' : undefined}
                />
                <SpecRow
                  icon={<span className="text-sm">{fuelIcon[v.fuel ?? ''] ?? '⛽'}</span>}
                  label="Yakıt Tipi"
                  value={v.fuel ?? '—'}
                />
                <SpecRow
                  icon={<span className="text-sm">⚙️</span>}
                  label="Şanzıman"
                  value={v.transmission ?? '—'}
                />
                {v.bodyType && (
                  <SpecRow
                    icon={<span className="text-sm">🚘</span>}
                    label="Kasa Tipi"
                    value={v.bodyType}
                  />
                )}
                {v.color && (
                  <SpecRow
                    icon={<span className="text-sm">🎨</span>}
                    label="Renk"
                    value={v.color}
                  />
                )}
                {v.engineCC && (
                  <SpecRow
                    icon={<span className="text-sm">🔧</span>}
                    label="Motor Hacmi"
                    value={`${v.engineCC.toLocaleString('tr-TR')} cc`}
                  />
                )}
                <SpecRow
                  icon={<span className="text-sm">{v.hasAccidentRecord ? '⚠️' : '✅'}</span>}
                  label="Hasar Kaydı"
                  value={v.hasAccidentRecord ? 'Var' : 'Yok'}
                  accent={v.hasAccidentRecord ? 'red' : 'green'}
                />
                <SpecRow
                  icon={<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
                  label="Genel Durum"
                  value={listing.condition}
                  accent={listing.condition === 'Mükemmel' || listing.condition === 'İyi' ? 'green' : listing.condition === 'Yıpranmış' ? 'red' : 'amber'}
                />
              </div>
            </div>
          )}

          {/* ── Elektronik Özellikleri ─────────────────────────────────────── */}
          {e && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                <span>📱</span> Cihaz Özellikleri
              </h2>
              <p className="text-xs text-slate-400 mb-4">Satıcı tarafından girilmiş teknik bilgiler</p>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                <SpecRow icon={<span className="text-sm">📱</span>} label="Tür"        value={e.type} />
                <SpecRow icon={<span className="text-sm">🏷️</span>} label="Marka"      value={e.brand} />
                <SpecRow icon={<span className="text-sm">📋</span>} label="Model"      value={e.model} />
                {e.year && <SpecRow icon={<span className="text-sm">📅</span>} label="Yıl" value={e.year.toString()} />}
                {e.storage && <SpecRow icon={<span className="text-sm">💾</span>} label="Depolama" value={e.storage} />}
                {e.ram && <SpecRow icon={<span className="text-sm">🧠</span>} label="RAM" value={e.ram} />}
                {e.screenSize && <SpecRow icon={<span className="text-sm">📺</span>} label="Ekran" value={`${e.screenSize}"`} />}
                {e.color && <SpecRow icon={<span className="text-sm">🎨</span>} label="Renk" value={e.color} />}
                {e.os && <SpecRow icon={<span className="text-sm">💻</span>} label="İşletim Sistemi" value={e.os} />}
                {e.batteryHealth !== undefined && (
                  <SpecRow
                    icon={<span className="text-sm">{e.batteryHealth >= 90 ? '🔋' : '🪫'}</span>}
                    label="Batarya Sağlığı"
                    value={`%${e.batteryHealth}`}
                    accent={e.batteryHealth >= 90 ? 'green' : e.batteryHealth >= 80 ? 'amber' : 'red'}
                  />
                )}
                <SpecRow
                  icon={<span className="text-sm">🛡️</span>}
                  label="Garanti"
                  value={e.warranty ?? '—'}
                  accent={e.warranty === 'Devam ediyor' ? 'green' : e.warranty === 'Bitti' ? 'amber' : undefined}
                />
                {e.accessories && e.accessories.length > 0 && (
                  <div className="py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">📦 Aksesuarlar</p>
                    <div className="flex flex-wrap gap-1.5">
                      {e.accessories.map((a) => (
                        <span key={a} className="text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 px-2 py-1 rounded-full font-medium">
                          ✓ {a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Gayrimenkul Özellikleri ────────────────────────────────────── */}
          {p && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
                <span>🏠</span> Gayrimenkul Özellikleri
              </h2>
              <p className="text-xs text-slate-400 mb-4">Mülke ait teknik bilgiler</p>

              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                <SpecRow icon={<span className="text-sm">🏢</span>} label="Mülk Türü" value={p.type} />
                {p.rooms && <SpecRow icon={<span className="text-sm">🚪</span>} label="Oda Sayısı" value={p.rooms} />}
                {p.netSqm !== undefined && <SpecRow icon={<span className="text-sm">📐</span>} label="Net m²" value={`${p.netSqm} m²`} />}
                {p.grossSqm !== undefined && <SpecRow icon={<span className="text-sm">📏</span>} label="Brüt m²" value={`${p.grossSqm} m²`} />}
                {p.floor && <SpecRow icon={<span className="text-sm">🏬</span>} label="Kat" value={p.floor} />}
                {p.buildingAge !== undefined && (
                  <SpecRow
                    icon={<span className="text-sm">🏗️</span>}
                    label="Bina Yaşı"
                    value={`${p.buildingAge} yıl`}
                    accent={p.buildingAge <= 5 ? 'green' : p.buildingAge <= 15 ? undefined : 'amber'}
                  />
                )}
                {p.heating && <SpecRow icon={<span className="text-sm">🔥</span>} label="Isıtma" value={p.heating} />}
                {p.titleDeed && (
                  <SpecRow
                    icon={<span className="text-sm">📜</span>}
                    label="Tapu Durumu"
                    value={p.titleDeed}
                    accent={p.titleDeed === 'Kat Mülkiyetli' || p.titleDeed === 'Müstakil Tapu' ? 'green' : 'amber'}
                  />
                )}
                {p.monthlyDues !== undefined && (
                  <SpecRow
                    icon={<span className="text-sm">💸</span>}
                    label="Aylık Aidat"
                    value={fmt(p.monthlyDues)}
                  />
                )}
                <div className="py-3">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Bina Olanakları</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { val: p.furnished, icon: '🛋️', label: 'Eşyalı' },
                      { val: p.balcony,   icon: '🌿', label: 'Balkon' },
                      { val: p.elevator,  icon: '🛗', label: 'Asansör' },
                      { val: p.parking,   icon: '🅿️', label: 'Otopark' },
                    ].map((b) => (
                      <span key={b.label}
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          b.val
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 line-through'
                        }`}>
                        {b.icon} {b.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {listing.attachments && listing.attachments.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <span>📎</span> Belgeler ve Ekspertiz
              </h2>
              <div className="space-y-2">
                {listing.attachments.map((file) => (
                  <a
                    key={file.id}
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-3 py-2 hover:border-blue-300 dark:hover:border-blue-700"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {file.kind === 'expertise' ? 'Ekspertiz' : file.kind === 'image' ? 'Fotoğraf' : 'Belge'} · {Math.round(file.size / 1024)} KB
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">Aç</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Video Embed */}
          {listing.videoUrl && <VideoEmbed url={listing.videoUrl} />}

          {/* Açıklama */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>📋</span> Açıklama
            </h2>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line text-sm">{listing.description}</p>
          </div>

          {/* ── Soru-Cevap ── */}
          <ListingQASection listingId={listing.id} ownerId={listing.ownerId} />

          {/* Konum */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <span>📍</span> Konum
            </h2>
            <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl h-32 flex items-center justify-center border border-slate-100">
              <div className="text-center">
                <div className="text-3xl mb-1">🗺️</div>
                <p className="text-slate-700 font-semibold">{listing.city}</p>
                <p className="text-slate-400 text-xs mt-0.5">Yaklaşık konum gösterilmektedir</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Sağ: Sidebar ── */}
        <div className="space-y-4 print:hidden">

          {/* Fiyat özeti (sticky) */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fmt(listing.estimatedValue)}</div>
            <div className="text-xs text-slate-400 mb-4">Tahmini değer</div>

            {v && (
              <div className="space-y-1.5 text-sm mb-4 pb-4 border-b border-slate-100">
                <div className="flex justify-between text-slate-500">
                  <span>Yıl</span>
                  <span className="font-medium text-slate-700">{v.year}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Kilometre</span>
                  <span className="font-medium text-slate-700">{(v.km ?? 0).toLocaleString('tr-TR')} km</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Yakıt</span>
                  <span className="font-medium text-slate-700">{v.fuel}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Şanzıman</span>
                  <span className="font-medium text-slate-700">{v.transmission}</span>
                </div>
                <div className="flex justify-between text-slate-500">
                  <span>Hasar</span>
                  <span className={`font-semibold ${v.hasAccidentRecord ? 'text-red-600' : 'text-emerald-600'}`}>
                    {v.hasAccidentRecord ? 'Var' : 'Yok'}
                  </span>
                </div>
              </div>
            )}

            {!isOwner ? (
              <div className="space-y-2.5">
                <button
                  onClick={() => setOfferModalOpen(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
                >
                  🤝 Takas Teklifi Gönder
                </button>
                <button
                  onClick={() => openAIPanel(listing.id)}
                  className="w-full bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 border border-amber-200 dark:border-amber-900/40"
                >
                  <span className="text-base">✦</span>
                  AI ile Eşleştir
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Takaslat ilanı: ${listing.title}\n${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold py-3 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 border border-emerald-200 dark:border-emerald-900/40"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp'ta Paylaş
                </a>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-900/40">
                  <p className="text-blue-700 dark:text-blue-300 text-sm font-medium">📋 Bu sizin ilanınız</p>
                </div>

                {/* Sahip istatistikleri */}
                {ownerStats && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { icon: '👁️', label: 'Görüntülenme', value: ownerStats.views,    color: 'bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300' },
                        { icon: '🤝', label: 'Toplam Teklif', value: ownerStats.offers,   color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' },
                        { icon: '⏳', label: 'Bekleyen',       value: ownerStats.pending,  color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300' },
                        { icon: '✅', label: 'Tamamlanan',     value: ownerStats.accepted, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' },
                      ].map((s) => (
                        <div key={s.label} className={`rounded-xl p-2.5 text-center ${s.color}`}>
                          <div className="text-base">{s.icon}</div>
                          <div className="text-lg font-bold leading-tight">{s.value}</div>
                          <div className="text-[10px] opacity-80">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* 7 günlük view chart */}
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">📈 Son 7 Gün</p>
                      {(() => {
                        const max = Math.max(...viewsByDay.map((d) => d.count), 1);
                        return (
                          <div className="flex items-end justify-between gap-1 h-20">
                            {viewsByDay.map((d, i) => {
                              const pct = (d.count / max) * 100;
                              return (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                                  <div className="flex-1 w-full flex items-end">
                                    <div
                                      className={`w-full rounded-t transition-all ${
                                        d.count > 0 ? 'bg-violet-500 dark:bg-violet-400 group-hover:bg-violet-600' : 'bg-slate-200 dark:bg-slate-700'
                                      }`}
                                      style={{ height: `${Math.max(4, pct)}%` }}
                                      title={`${d.day}: ${d.count} görüntülenme`}
                                    />
                                  </div>
                                  <span className="text-[9px] text-slate-500 dark:text-slate-400 truncate w-full text-center">
                                    {d.day}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1">
                        Toplam: {viewsByDay.reduce((s, d) => s + d.count, 0)} (sayfa açma)
                      </p>
                    </div>
                  </>
                )}
                {/* Boost butonu */}
                {!isBoosted(listing.id) ? (
                  <button
                    onClick={() => {
                      boostListing(listing.id);
                      showToast('İlan 7 gün boyunca öne çıkarıldı', 'success');
                    }}
                    className="w-full bg-violet-100 dark:bg-violet-900/30 hover:bg-violet-200 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 border border-violet-200 dark:border-violet-900/40"
                  >
                    <span>⚡</span> Öne Çıkar (7 gün)
                  </button>
                ) : (
                  <div className="w-full bg-violet-600 text-white font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                    <span>⚡</span> Öne Çıkarıldı
                  </div>
                )}

                <button
                  onClick={() => setEditModalOpen(true)}
                  className="w-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Düzenle
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem('takaslat-duplicate', JSON.stringify(listing));
                    showToast('İlan formuna kopyalandı', 'success');
                    navigate('/create');
                  }}
                  className="w-full bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Çoğalt (Yeni Kopyası)
                </button>
                <button
                  onClick={() => setDeleteConfirmOpen(true)}
                  className="w-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 font-semibold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2 border border-red-100 dark:border-red-900/40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
                  </svg>
                  İlanı Kaldır
                </button>
              </div>
            )}
          </div>

          {/* Sahibi ne istiyor */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2 text-sm">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
              Sahibi Ne İstiyor?
            </h3>
            <p className="text-amber-700 text-sm leading-relaxed">{listing.wantedFor}</p>
          </div>

          {/* İlan sahibi (profile linki) */}
          <Link
            to={`/profile/${listing.ownerId}`}
            className="block bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-200 dark:hover:border-blue-700 transition-all group"
          >
            <h3 className="font-semibold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide mb-3 flex items-center justify-between">
              İlan Sahibi
              <span className="text-blue-600 dark:text-blue-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity normal-case font-medium">
                Profili gör →
              </span>
            </h3>
            <div className="flex items-center gap-3 mb-3">
              {listing.ownerAvatar ? (
                <img src={listing.ownerAvatar} alt={listing.ownerName} className="w-11 h-11 rounded-full object-cover" />
              ) : (
                <div className="w-11 h-11 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                  {listing.ownerName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{listing.ownerName}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  {listing.city} · {(listing.ownerTotalSwaps ?? 0).toLocaleString('tr-TR')} tamamlanan takas
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className={`w-4 h-4 ${star <= Math.round(ownerRating) ? 'text-amber-400' : 'text-slate-200 dark:text-slate-600'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">{ownerRating.toFixed(1)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {listingHealth.trustBadges.map((badge) => (
                <span key={badge.label} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${trustToneClass[badge.tone]}`}>
                  {badge.label}
                </span>
              ))}
            </div>
          </Link>

          {/* Güvenlik notu */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs text-slate-500 font-medium mb-1">🔒 Güvenli Takas</p>
            <p className="text-xs text-slate-400 leading-relaxed">
              Teklifler uygulama üzerinden yapılır. Ödeme veya transfer taleplerine ihtiyatlı yaklaşın.
            </p>
          </div>
        </div>
      </div>

      {/* Benzer İlanlar */}
      {(() => {
        const benzer = listings
          .filter((l) =>
            l.id !== listing.id &&
            l.category === listing.category &&
            (listing.vehicleDetails?.brand
              ? l.vehicleDetails?.brand === listing.vehicleDetails.brand
              : true)
          )
          .slice(0, 4);
        if (benzer.length === 0) return null;
        return (
          <div className="mt-10">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-4">Benzer İlanlar</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {benzer.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          </div>
        );
      })()}

      {offerModalOpen && (
        <SwapOfferModal listing={listing} onClose={() => setOfferModalOpen(false)} />
      )}

      {reportModalOpen && (
        <ReportModal
          listingId={listing.id}
          listingTitle={listing.title}
          onClose={() => setReportModalOpen(false)}
        />
      )}

      {editModalOpen && (
        <EditListingModal
          listing={listing}
          onClose={() => setEditModalOpen(false)}
        />
      )}

      {forecastOpen && (
        <ValueForecastModal
          listingId={listing.id}
          onClose={() => setForecastOpen(false)}
        />
      )}

      {lightboxOpen && (
        <ImageLightbox
          images={listing.images}
          initial={activeImage}
          onClose={() => setLightboxOpen(false)}
        />
      )}

      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirmOpen(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center">
              <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">İlan kaldırılsın mı?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                <strong className="text-slate-700 dark:text-slate-200">{listing.title}</strong> kalıcı olarak kaldırılacak. Bu işlem geri alınamaz.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmOpen(false)}
                  className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 rounded-xl text-sm"
                >
                  İptal
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-xl text-sm"
                >
                  Evet, Kaldır
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
