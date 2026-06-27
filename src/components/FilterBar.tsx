import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import AdvancedFilters from './AdvancedFilters';
import SavedSearchesPanel from './SavedSearchesPanel';
import VoiceSearch from './VoiceSearch';
import { fetchListingByCode } from '../services/api';
import { CITIES_81 } from '../data/cities';
import { VEHICLE_GROUPS, VEHICLE_GROUP_ICONS } from '../data/vehicleTypes';

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

  // ── İlan kodu araması: Enter'a basınca API'den çek, doğrudan ilana git ────────
  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter') return;
    const q = filters.searchQuery.trim();
    if (!LISTING_CODE_RE.test(q)) return;

    // Önce store'da ara (anlık)
    const local = listings.find((l) => l.listingCode?.toUpperCase() === q.toUpperCase());
    if (local) {
      setFilters({ searchQuery: '' });
      navigate(`/listings/${local.id}`);
      return;
    }

    // Store'da yoksa API'den çek
    setCodeSearching(true);
    try {
      const listing = await fetchListingByCode(q);
      if (listing) {
        setFilters({ searchQuery: '' });
        navigate(`/listings/${listing.id}`);
      }
    } catch {
      // Bulunamadı — normal arama olarak devam et
    } finally {
      setCodeSearching(false);
    }
  }

  // Aramayı 1 saniye sonra geçmişe kaydet (debounce)
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

  // ── Autocomplete: marka + model + şehir listesi ─────────────────────────────
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
    <div className="space-y-3">
      {/* ── Search ── */}
      <div className="relative" ref={acRef}>
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none"
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          placeholder="Marka, model, yıl veya TKS-XXXXXXX ilan kodu..."
          value={filters.searchQuery}
          onChange={e => { setFilters({ searchQuery: e.target.value }); setAcOpen(true); }}
          onFocus={() => setAcOpen(true)}
          onKeyDown={handleSearchKeyDown}
          disabled={codeSearching}
          className="w-full pl-11 pr-10 py-3 text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400 disabled:opacity-60"
        />
        {codeSearching && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        )}
        {/* Sesli arama */}
        <VoiceSearch onResult={(t) => setFilters({ searchQuery: t })} />

        {filters.searchQuery && (
          <button
            onClick={() => setFilters({ searchQuery: '' })}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 rounded-full transition-colors"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Autocomplete dropdown */}
        {acOpen && (suggestions.length > 0 || (filters.searchQuery.length === 0 && searchHistory.length > 0)) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-20 py-1 overflow-hidden max-h-80 overflow-y-auto">
            {/* Geçmiş aramalar (sadece input boşken) */}
            {filters.searchQuery.length === 0 && searchHistory.length > 0 && (
              <div>
                <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                  Son Aramalar
                </div>
                {searchHistory.slice(0, 6).map((s) => (
                  <button
                    key={s}
                    onClick={() => { setFilters({ searchQuery: s }); setAcOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Öneriler */}
            {suggestions.length > 0 && (
              <>
                {filters.searchQuery.length === 0 && searchHistory.length > 0 && (
                  <div className="border-t border-slate-100 dark:border-slate-700" />
                )}
                <div className="px-4 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider bg-slate-50 dark:bg-slate-900">
                  Öneriler
                </div>
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => { setFilters({ searchQuery: s }); setAcOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

      {/* ── Araç grubu chip'leri ── */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilters({ vehicleGroup: '' })}
          className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all ${
            !filters.vehicleGroup
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
          }`}
        >
          Tümü
        </button>
        {VEHICLE_GROUP_KEYS.map(group => (
          <button
            key={group}
            onClick={() => setFilters({ vehicleGroup: filters.vehicleGroup === group ? '' : group })}
            className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all ${
              filters.vehicleGroup === group
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {VEHICLE_GROUP_ICONS[group]} {group}
          </button>
        ))}
      </div>

      {/* ── Filter row ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* City */}
        <div className="relative">
          <select
            value={filters.city}
            onChange={e => setFilters({ city: e.target.value })}
            className="appearance-none text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:border-slate-300 transition-colors"
          >
            <option value="">Tüm Şehirler</option>
            {CITIES_81.map(c => <option key={c}>{c}</option>)}
          </select>
          <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Price */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 hover:border-slate-300 transition-colors">
          <span className="text-xs text-slate-400 font-medium select-none">₺</span>
          <input
            type="number"
            placeholder="Min"
            value={filters.minValue || ''}
            onChange={e => setFilters({ minValue: Number(e.target.value) || 0 })}
            className="w-16 text-xs bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400"
          />
          <span className="text-slate-300 text-xs select-none">-</span>
          <input
            type="number"
            placeholder="Max"
            value={filters.maxValue < 5_000_000 ? filters.maxValue : ''}
            onChange={e => setFilters({ maxValue: Number(e.target.value) || 5_000_000 })}
            className="w-20 text-xs bg-transparent border-none outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400"
          />
        </div>

        {/* Advanced filters dropdown */}
        <AdvancedFilters />

        {/* Saved searches */}
        <SavedSearchesPanel />

        {/* Reset */}
        {active && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-red-500 transition-colors px-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sıfırla
          </button>
        )}
      </div>
    </div>
  );
}
