import { Link } from 'react-router-dom';
import type { Listing } from '../types';
import { useAppStore } from '../store/useAppStore';

const CONDITION_COLOR: Record<string, string> = {
  'Mükemmel': 'bg-emerald-500',
  'İyi':      'bg-blue-500',
  'Orta':     'bg-amber-500',
  'Yıpranmış':'bg-red-500',
};

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

export default function ListingCard({ listing }: { listing: Listing }) {
  const { openAIPanel, favorites, toggleFavorite, compareList, toggleCompare, isBoosted } = useAppStore();
  const v         = listing.vehicleDetails;
  const isFav     = favorites.includes(listing.id);
  const isCompare = compareList.includes(listing.id);
  const boosted   = isBoosted(listing.id);

  const ageMs  = Date.now() - new Date(listing.createdAt).getTime();
  const isNew  = ageMs < 2 * 86_400_000;
  const isHot  = (listing.viewCount ?? 0) >= 5 && ageMs < 7 * 86_400_000;

  return (
    <article className="relative bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">

      {/* ── Thumbnail ── */}
      <Link to={`/listing/${listing.id}`} className="relative block flex-shrink-0 overflow-hidden">
        <img
          src={listing.images[0]}
          alt={listing.title}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />

        {/* Badge — top left */}
        <div className="absolute top-2.5 left-2.5 flex gap-1.5">
          {boosted && (
            <span className="bg-violet-600 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
              Öne Çıkan
            </span>
          )}
          {!boosted && isHot && (
            <span className="bg-orange-500 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
              Popüler
            </span>
          )}
          {!boosted && !isHot && isNew && (
            <span className="bg-emerald-500 text-white text-[10px] font-semibold px-2.5 py-0.5 rounded-full">
              Yeni
            </span>
          )}
        </div>

        {/* Condition — bottom right */}
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-full">
          <span className={`w-1.5 h-1.5 rounded-full ${CONDITION_COLOR[listing.condition] ?? 'bg-slate-400'}`} />
          <span className="text-[10px] font-medium text-white">{listing.condition}</span>
        </div>
      </Link>

      {/* Favorite button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavorite(listing.id); }}
        aria-label={isFav ? 'Favorilerden çıkar' : 'Favorilere ekle'}
        className={`absolute top-2.5 right-2.5 w-8 h-8 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm ${
          isFav
            ? 'bg-red-500 text-white'
            : 'bg-white/90 text-slate-500 hover:text-red-500'
        }`}
      >
        <svg className="w-4 h-4" fill={isFav ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>

      {/* ── Body ── */}
      <div className="flex flex-col flex-1 p-3.5 gap-2.5">

        {/* City */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
          <svg className="w-3 h-3 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          </svg>
          {listing.city}
        </div>

        {/* Title */}
        <Link to={`/listing/${listing.id}`}>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-2">
            {listing.title}
          </h3>
        </Link>

        {/* Vehicle spec chips */}
        {v && (
          <div className="flex flex-wrap gap-1.5">
            {[v.year.toString(), `${v.km.toLocaleString('tr-TR')} km`, v.fuel, v.transmission].map((t) => (
              <span
                key={t}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-medium px-2 py-0.5 rounded-md"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {/* Price */}
        <p className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {fmt(listing.estimatedValue)}
        </p>

        {/* Swap request */}
        <div className="mt-auto border-l-2 border-blue-200 dark:border-blue-900 pl-2.5 py-0.5">
          <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-0.5">Takas teklifi</p>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">{listing.wantedFor}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-0.5">
          <Link
            to={`/listing/${listing.id}`}
            className="flex-1 text-center text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl transition-colors"
          >
            Teklif gönder
          </Link>

          <button
            onClick={() => toggleCompare(listing.id)}
            aria-label={isCompare ? 'Karşılaştırmadan çıkar' : 'Karşılaştırmaya ekle'}
            title={isCompare ? 'Karşılaştırmadan çıkar' : 'Karşılaştır'}
            className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border ${
              isCompare
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-slate-50 dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </button>

          <button
            onClick={() => openAIPanel(listing.id)}
            aria-label="AI ile eşleştir"
            title="AI ile eşleştir"
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </button>
        </div>
      </div>
    </article>
  );
}
