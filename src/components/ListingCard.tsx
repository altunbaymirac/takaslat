import { Link } from 'react-router-dom';
import type { Listing } from '../types';

const PAGE_LOADED_AT = Date.now();
import { useAppStore } from '../store/useAppStore';

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const { favorites, toggleFavorite, compareList, toggleCompare, isBoosted } = useAppStore();
  const v         = listing.vehicleDetails;
  const isFav     = favorites.includes(listing.id);
  const isCompare = compareList.includes(listing.id);
  const boosted   = isBoosted(listing.id);

  const ageMs = PAGE_LOADED_AT - new Date(listing.createdAt).getTime();
  const isNew = ageMs < 2 * 86_400_000;
  const isHot = (listing.viewCount ?? 0) >= 5 && ageMs < 7 * 86_400_000;

  const badge = boosted
    ? { text: 'Öne Çıkan', color: 'bg-blue-700' }
    : isHot
    ? { text: 'Popüler', color: 'bg-blue-600' }
    : isNew
    ? { text: 'Yeni', color: 'bg-slate-700' }
    : null;

  return (
    <article className="relative flex items-stretch gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 py-3 sm:px-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">

      {/* ── Thumbnail ── */}
      <Link to={`/listing/${listing.id}`} className="relative flex-shrink-0 w-28 h-24 sm:w-32 sm:h-28 rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
        <img
          src={listing.images[0]}
          alt={listing.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {badge && (
          <span className={`absolute top-1 left-1 ${badge.color} text-white text-[9px] font-bold px-1.5 py-0.5 rounded`}>
            {badge.text}
          </span>
        )}
      </Link>

      {/* ── Info ── */}
      <Link to={`/listing/${listing.id}`} className="min-w-0 flex-1 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="text-[13px] sm:text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug line-clamp-2">
            {listing.title}
          </h3>

          {v && (
            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {v.year} · {v.km.toLocaleString('tr-TR')} km · {v.fuel} · {v.transmission}
            </p>
          )}

          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500 truncate">
            <svg className="inline w-3 h-3 -mt-0.5 mr-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            </svg>
            {listing.city}
          </p>
        </div>

        <div className="flex items-end justify-between mt-1.5">
          <p className="text-sm sm:text-base font-extrabold text-blue-700 dark:text-blue-400 tracking-tight">
            {fmt(listing.estimatedValue)}
          </p>
          <p className="hidden sm:block max-w-[40%] text-[10px] text-slate-400 dark:text-slate-500 truncate text-right">
            Takas: {listing.wantedFor}
          </p>
        </div>
      </Link>

      {/* Favorite / Compare */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(listing.id); }}
          aria-label={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isFav ? 'text-red-500' : 'text-slate-300 dark:text-slate-600 hover:text-red-400'
          }`}
        >
          <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </button>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCompare(listing.id); }}
          aria-label={isCompare ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle'}
          title={isCompare ? 'Karşılaştırmadan çıkar' : 'Karşılaştır'}
          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
            isCompare ? 'text-blue-700 dark:text-blue-400' : 'text-slate-300 dark:text-slate-600 hover:text-blue-600'
          }`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
          </svg>
        </button>
      </div>
    </article>
  );
}
