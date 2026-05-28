import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function CompareBar() {
  const { compareList, listings, toggleCompare, clearCompare } = useAppStore();

  if (compareList.length === 0) return null;

  const items = compareList
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-lg">⚖️</span>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Karşılaştır
          </span>
          <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
            {compareList.length} / 3
          </span>
        </div>

        {/* Selected items */}
        <div className="flex items-center gap-2 flex-1 overflow-x-auto">
          {items.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl pl-2 pr-1 py-1 flex-shrink-0"
            >
              <img src={l.images[0]} alt="" className="w-8 h-8 rounded-lg object-cover" />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[140px] truncate">
                {l.title}
              </span>
              <button
                onClick={() => toggleCompare(l.id)}
                className="w-5 h-5 rounded-full text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center transition-colors"
                title="Kaldır"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          {[...Array(3 - items.length)].map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex items-center justify-center w-32 h-10 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-400 dark:text-slate-500 flex-shrink-0"
            >
              + Ekle
            </div>
          ))}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={clearCompare}
            className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 font-medium px-2 py-1"
          >
            Temizle
          </button>
          <Link
            to="/compare"
            className={`text-sm font-semibold px-4 py-2 rounded-xl transition-colors ${
              items.length >= 2
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 pointer-events-none'
            }`}
          >
            Karşılaştır →
          </Link>
        </div>
      </div>
    </div>
  );
}
