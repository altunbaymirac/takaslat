import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import AdvancedFilters from './AdvancedFilters';
import SavedSearchesPanel from './SavedSearchesPanel';
import VoiceSearch from './VoiceSearch';
import { fetchListingByCode } from '../services/api';
import { CITIES_81 } from '../data/cities';
import { VEHICLE_GROUPS } from '../data/vehicleTypes';

const LISTING_CODE_RE = /^TKS-\d{7}$/i;
const VEHICLE_GROUP_KEYS = Object.keys(VEHICLE_GROUPS);

export default function FilterBar({ onFilterChange }: { onFilterChange?: () => void } = {}) {
  const { filters, setFilters: _setFilters, resetFilters: _resetFilters, listings, recordSearch, searchHistory } = useAppStore();
  const navigate = useNavigate();

  const setFilters: typeof _setFilters = (f) => { _setFilters(f); onFilterChange?.(); };
  const resetFilters = () => { _resetFilters(); onFilterChange?.(); };
  const [acOpen, setAcOpen] = useState(false);
  const [codeSearching, setCodeSearching] = useState(false);
  const acRef = useRef<HTMLDivElement>(null);

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = filters.searchQuery.trim();
    if (!LISTING_CODE_RE.test(q)) return;

    const local = listings.find((l) => l.listingCode?.toUpperCase() === q.toUpperCase());
    if (local) {
      setFilters({ searchQuery: '' });
      navigate(`/listings/${local.id}`);
      return;
    }

    setCodeSearching(true);
    try {
      const listing = await fetchListingByCode(q);
      if (listing) {
        setFilters({ searchQuery: '' });
        navigate(`/listings/${listing.id}`);
      }
    } catch {
      // Kod bulunamazsa mevcut metin normal arama olarak kalır.
    } finally {
      setCodeSearching(false);
    }
  }

  useEffect(() => {
    if (!filters.searchQuery || filters.searchQuery.trim().length < 2) return;
    const timer = setTimeout(() => recordSearch(filters.searchQuery), 1000);
    return () => clearTimeout(timer);
  }, [filters.searchQuery, recordSearch]);

  const active =
    filters.vehicleGroup !== '' ||
    filters.city !== '' ||
    filters.minValue > 0 ||
    filters.maxValue < 5_000_000 ||
    filters.searchQuery !== '';

  const suggestions = useMemo(() => {
    const q = filters.searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];

    const set = new Set<string>();
    for (const l of listings) {
      const candidates = [
        l.vehicleDetails?.brand,
        l.vehicleDetails?.model,
        l.electronicDetails?.brand,
        l.electronicDetails?.model,
        l.electronicDetails?.type,
        l.propertyDetails?.type,
        l.city,
      ].filter(Boolean) as string[];
      for (const c of candidates) {
        if (c.toLowerCase().includes(q) && c.toLowerCase() !== q) set.add(c);
      }
    }
    return Array.from(set).slice(0, 8);
  }, [filters.searchQuery, listings]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (acRef.current && !acRef.current.contains(e.target as Node)) setAcOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="grid gap-2 lg:grid-cols-[minmax(260px,1fr)_180px_230px_auto_auto]">
        <div className="relative" ref={acRef}>
          <svg
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Marka, model, yıl veya TKS-XXXXXXX ilan kodu"
            value={filters.searchQuery}
            onChange={e => { setFilters({ searchQuery: e.target.value }); setAcOpen(true); }}
            onFocus={() => setAcOpen(true)}
            onKeyDown={handleSearchKeyDown}
            disabled={codeSearching}
            className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-20 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:bg-slate-900"
          />
          {codeSearching && (
            <div className="absolute right-10 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          )}
          <VoiceSearch onResult={(t) => setFilters({ searchQuery: t })} />
          {filters.searchQuery && (
            <button
              onClick={() => setFilters({ searchQuery: '' })}
              className="absolute right-3.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-slate-200 text-slate-500 transition-colors hover:bg-slate-300 hover:text-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              title="Aramayı temizle"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {acOpen && (suggestions.length > 0 || (filters.searchQuery.length === 0 && searchHistory.length > 0)) && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
              {filters.searchQuery.length === 0 && searchHistory.length > 0 && (
                <div>
                  <div className="bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                    Son aramalar
                  </div>
                  {searchHistory.slice(0, 6).map((s) => (
                    <button
                      key={s}
                      onClick={() => { setFilters({ searchQuery: s }); setAcOpen(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-blue-900/20"
                    >
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {suggestions.length > 0 && (
                <>
                  {filters.searchQuery.length === 0 && searchHistory.length > 0 && (
                    <div className="border-t border-slate-100 dark:border-slate-700" />
                  )}
                  <div className="bg-slate-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:bg-slate-900 dark:text-slate-500">
                    Öneriler
                  </div>
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => { setFilters({ searchQuery: s }); setAcOpen(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-blue-900/20"
                    >
                      <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      {s}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        <div className="relative">
          <select
            value={filters.city}
            onChange={e => setFilters({ city: e.target.value })}
            className="h-12 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 pl-4 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">Tüm şehirler</option>
            {CITIES_81.map(c => <option key={c}>{c}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900">
          <span className="mr-2 select-none text-sm font-bold text-slate-400">₺</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minValue || ''}
            onChange={e => setFilters({ minValue: Number(e.target.value) || 0 })}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300"
          />
          <span className="mx-2 select-none text-slate-300">-</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxValue < 5_000_000 ? filters.maxValue : ''}
            onChange={e => setFilters({ maxValue: Number(e.target.value) || 5_000_000 })}
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300"
          />
        </div>

        <AdvancedFilters />
        <SavedSearchesPanel />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">Araç tipi</span>
        <button
          onClick={() => setFilters({ vehicleGroup: '' })}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
            !filters.vehicleGroup
              ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
          }`}
        >
          Tümü
        </button>
        {VEHICLE_GROUP_KEYS.map(group => (
          <button
            key={group}
            onClick={() => setFilters({ vehicleGroup: filters.vehicleGroup === group ? '' : group })}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
              filters.vehicleGroup === group
                ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
                : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
            }`}
          >
            {group}
          </button>
        ))}

        {active && (
          <button
            onClick={resetFilters}
            className="ml-auto flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sıfırla
          </button>
        )}
      </div>
    </div>
  );
}
