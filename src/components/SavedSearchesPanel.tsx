import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from './Toast';

export default function SavedSearchesPanel() {
  const { filters, savedSearches, saveCurrentSearch, deleteSavedSearch, applySavedSearch } = useAppStore();
  const [open,      setOpen]      = useState(false);
  const [naming,    setNaming]    = useState(false);
  const [name,      setName]      = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setNaming(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Aktif bir filtre var mı kontrol et
  const hasActive =
    filters.category !== 'Tümü' ||
    filters.city !== '' ||
    filters.searchQuery !== '' ||
    filters.brands.length > 0 ||
    filters.fuels.length > 0 ||
    filters.noAccidentOnly;

  function handleSave() {
    if (!name.trim()) return;
    saveCurrentSearch(name.trim());
    showToast('Arama kaydedildi', 'success');
    setName('');
    setNaming(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all ${
          savedSearches.length > 0
            ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
        </svg>
        Aramalar
        {savedSearches.length > 0 && (
          <span className="bg-amber-500 text-white text-[10px] font-bold rounded-full px-1.5 leading-tight">
            {savedSearches.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-1rem)] max-w-72 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-30 overflow-hidden">
          {/* Header + save current */}
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            {naming ? (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  placeholder="Arama ismi…"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3 rounded-lg"
                >
                  Kaydet
                </button>
              </div>
            ) : (
              <button
                onClick={() => hasActive ? setNaming(true) : showToast('Önce filtre seçin', 'info')}
                disabled={!hasActive}
                className="w-full text-left text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed py-2 px-2 rounded-lg transition-colors"
              >
                + Mevcut filtreyi kaydet
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto">
            {savedSearches.length === 0 ? (
              <div className="py-8 text-center">
                <svg className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
                <p className="text-sm text-slate-500 dark:text-slate-400">Kayıtlı arama yok</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Sık aradığınız kriterleri kaydedin</p>
              </div>
            ) : (
              savedSearches.map((s) => {
                const summary: string[] = [];
                if (s.filters.category !== 'Tümü') summary.push(s.filters.category);
                if (s.filters.city)                summary.push(s.filters.city);
                if (s.filters.brands.length > 0)   summary.push(s.filters.brands.join(', '));
                if (s.filters.searchQuery)         summary.push(`"${s.filters.searchQuery}"`);
                return (
                  <div
                    key={s.id}
                    className="px-4 py-3 border-b border-slate-50 dark:border-slate-700 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-start gap-3"
                  >
                    <button
                      onClick={() => { applySavedSearch(s.id); setOpen(false); showToast(`"${s.name}" uygulandı`, 'success'); }}
                      className="flex-1 text-left"
                    >
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{s.name}</p>
                      {summary.length > 0 && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                          {summary.join(' · ')}
                        </p>
                      )}
                    </button>
                    <button
                      onClick={() => deleteSavedSearch(s.id)}
                      title="Sil"
                      className="w-6 h-6 text-slate-400 hover:text-red-500 flex items-center justify-center"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
