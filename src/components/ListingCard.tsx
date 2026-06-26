import { Link } from 'react-router-dom';
import type { Listing } from '../types';
import { useAppStore } from '../store/useAppStore';
import { getListingHealth } from '../lib/listingHealth';

const CONDITION_DOT: Record<string, string> = {
  'Mükemmel': 'bg-emerald-400',
  'İyi':      'bg-blue-400',
  'Orta':     'bg-amber-400',
  'Yıpranmış':'bg-red-400',
};

const TRUST_BADGE: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-900/40',
  blue:    'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-900/40',
  amber:   'bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-900/40',
  slate:   'bg-slate-50 text-slate-500 border-slate-100 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600',
};

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const { openAIPanel, favorites, toggleFavorite, compareList, toggleCompare, isBoosted, bundleCart, toggleBundleItem } = useAppStore();
  const isBundled = bundleCart.includes(listing.id);
  const v = listing.vehicleDetails;
  const isFav     = favorites.includes(listing.id);
  const isCompare = compareList.includes(listing.id);
  const boosted   = isBoosted(listing.id);
  const health = getListingHealth(listing);

  // Trending: son 7 günde eklenmiş + viewCount ≥ 5
  const ageMs    = Date.now() - new Date(listing.createdAt).getTime();
  const isRecent = ageMs < 7 * 86_400_000;
  const isHot    = (listing.viewCount ?? 0) >= 5;
  const isNew    = ageMs < 2 * 86_400_000;
  const trending = isRecent && isHot;

  return (
    <article className="relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden card-shadow card-shadow-hover transition-all duration-200 hover:-translate-y-0.5 flex flex-col">
      {/* ── Thumbnail ── */}
      <Link to={`/listing/${listing.id}`} className="relative block flex-shrink-0 overflow-hidden">
        <img
          src={listing.images[0]}
          alt={listing.title}
          className="w-full h-44 object-cover transition-transform duration-300 hover:scale-105"
          loading="lazy"
        />

        {/* gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

        {/* top-left: category + (boosted/trending/new) */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5 items-start">
          <span className="bg-white/90 backdrop-blur-sm text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
            {listing.category}
          </span>
          {boosted && (
            <span className="bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
              ⚡ Öne Çıkan
            </span>
          )}
          {!boosted && trending && (
            <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 animate-pulse">
              🔥 Trending
            </span>
          )}
          {!boosted && !trending && isNew && (
            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md flex items-center gap-1">
              ✨ Yeni
            </span>
          )}
        </div>

        {/* top-right: condition */}
        <span className="absolute top-2.5 right-12 flex items-center gap-1 bg-white/90 backdrop-blur-sm text-slate-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
          <span className={`w-1.5 h-1.5 rounded-full ${CONDITION_DOT[listing.condition]}`} />
          {listing.condition}
        </span>
        {/* bottom: vehicle meta */}
        {v && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-1.5">
            {[v.year.toString(), `${v.km.toLocaleString('tr-TR')} km`, v.fuel].map((t) => (
              <span key={t} className="bg-black/50 backdrop-blur-sm text-white text-[10px] font-medium px-1.5 py-0.5 rounded-md">
                {t}
              </span>
            ))}
          </div>
        )}
      </Link>

      {/* favorite button — ayrı, link'in dışında */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(listing.id); }}
        title={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-all backdrop-blur-sm ${
          isFav
            ? 'bg-red-500 text-white shadow-lg scale-105'
            : 'bg-white/90 text-slate-600 hover:bg-white hover:text-red-500'
        }`}
        style={{ position: 'absolute' }}
      >
        <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 p-3.5 gap-2">
        {/* city */}
        <div className="flex items-center gap-1 text-slate-400 dark:text-slate-500 text-[11px]">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          {listing.city}
        </div>

        <div className="flex flex-wrap gap-1">
          {health.trustBadges.slice(0, 2).map((badge) => (
            <span key={badge.label} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TRUST_BADGE[badge.tone]}`}>
              {badge.label}
            </span>
          ))}
        </div>

        {/* title */}
        <Link to={`/listing/${listing.id}`}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
            {listing.title}
          </h3>
        </Link>

        {/* price */}
        <p className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {fmt(listing.estimatedValue)}
        </p>

        {/* wanted */}
        <div className="mt-auto rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/40 px-3 py-2">
          <p className="text-[10px] font-bold text-amber-500 dark:text-amber-400 uppercase tracking-widest mb-0.5">İsteniyor</p>
          <p className="text-xs text-amber-800 dark:text-amber-200 line-clamp-2 leading-relaxed">{listing.wantedFor}</p>
        </div>


        {/* actions */}
        <div className="flex gap-2 pt-0.5">
          <Link
            to={`/listing/${listing.id}`}
            className="flex-1 text-center text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl transition-colors"
          >
            Teklif Gönder
          </Link>
          <button
            onClick={() => toggleCompare(listing.id)}
            title={isCompare ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle'}
            className={`flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2 rounded-xl transition-colors border ${
              isCompare
                ? 'bg-blue-600 text-white border-blue-600'
                : 'text-slate-500 dark:text-slate-300 bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300'
            }`}
          >
            <span className="text-sm leading-none">⚖️</span>
            <span>{isCompare ? 'Çıkar' : 'Karşılaştır'}</span>
          </button>
          <button
            onClick={() => toggleBundleItem(listing.id)}
            title={isBundled ? 'Bundle\'dan çıkar' : 'Bundle\'a ekle (paket teklif)'}
            className={`flex items-center justify-center gap-1 text-xs font-semibold px-2.5 py-2 rounded-xl transition-colors border ${
              isBundled
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'
            }`}
          >
            <span className="text-sm leading-none">🛒</span>
          </button>
          <button
            onClick={() => openAIPanel(listing.id)}
            title="AI Eşleştir"
            className="flex items-center justify-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 border border-amber-200 dark:border-amber-900/40 px-2.5 py-2 rounded-xl transition-colors"
          >
            <span className="text-sm leading-none">✦</span>
          </button>
        </div>
      </div>
    </article>
  );
}
