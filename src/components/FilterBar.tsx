import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import AdvancedFilters from './AdvancedFilters';
import SavedSearchesPanel from './SavedSearchesPanel';
import { fetchListingByCode } from '../services/api';
import { CITIES_81 } from '../data/cities';
import { VEHICLE_GROUPS } from '../data/vehicleTypes';
import { getBrandsForVehicleGroup } from '../data/brands';
import { getModelsFromDB } from '../data/vehicleDatabase';

const LISTING_CODE_RE = /^TKS-\d{7}$/i;
const VEHICLE_GROUP_KEYS = Object.keys(VEHICLE_GROUPS);
type CategoryChoice = 'Tümü' | 'Araç' | 'Ev' | 'Arsa';

export default function FilterBar({ onFilterChange }: { onFilterChange?: () => void } = {}) {
  const { filters, setFilters: _setFilters, resetFilters: _resetFilters, listings } = useAppStore();
  const navigate = useNavigate();

  const setFilters: typeof _setFilters = (f) => { _setFilters(f); onFilterChange?.(); };
  const resetFilters = () => { _resetFilters(); onFilterChange?.(); };
  const [codeQuery, setCodeQuery] = useState('');
  const [codeSearching, setCodeSearching] = useState(false);
  const [codeOpen, setCodeOpen] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);

  async function handleCodeSearch() {
    const q = codeQuery.trim();
    if (!LISTING_CODE_RE.test(q)) return;

    const local = listings.find((l) => l.listingCode?.toUpperCase() === q.toUpperCase());
    if (local) {
      setCodeQuery('');
      setCodeOpen(false);
      navigate(`/listings/${local.id}`);
      return;
    }

    setCodeSearching(true);
    try {
      const listing = await fetchListingByCode(q);
      if (listing) {
        setCodeQuery('');
        setCodeOpen(false);
        navigate(`/listings/${listing.id}`);
      }
    } catch {
      // Kod bulunamazsa sessizce yok say.
    } finally {
      setCodeSearching(false);
    }
  }

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (codeRef.current && !codeRef.current.contains(e.target as Node)) setCodeOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const active =
    filters.category !== 'Tümü' ||
    filters.propertyKind !== '' ||
    filters.vehicleGroup !== '' ||
    filters.brands.length > 0 ||
    filters.model !== '' ||
    filters.city !== '' ||
    filters.minValue > 0 ||
    filters.maxValue < 5_000_000;

  const selectedBrand = filters.brands[0] ?? '';
  const brandOptions = getBrandsForVehicleGroup(filters.vehicleGroup);
  const modelOptions = selectedBrand ? getModelsFromDB(filters.vehicleGroup, selectedBrand) : [];
  const categoryChoice: CategoryChoice =
    filters.category === 'Tümü'
      ? 'Tümü'
      : filters.category === 'Araç'
        ? 'Araç'
        : filters.propertyKind === 'Arsa'
          ? 'Arsa'
          : 'Ev';
  const isVehicle = categoryChoice === 'Araç';

  function pickCategory(category: CategoryChoice) {
    const sharedVehicleReset = {
      vehicleGroup: '',
      brands: [],
      model: '',
      fuels: [],
      noAccidentOnly: false,
    };

    if (category === 'Tümü') {
      setFilters({ category: 'Tümü', propertyKind: '', ...sharedVehicleReset });
      return;
    }

    if (category === 'Araç') {
      setFilters({ category: 'Araç', propertyKind: '', ...sharedVehicleReset });
      return;
    }

    setFilters({
      category: 'Gayrimenkul',
      propertyKind: category,
      ...sharedVehicleReset,
    });
  }

  function pickVehicleGroup(group: string) {
    const next = filters.vehicleGroup === group ? '' : group;
    setFilters({ vehicleGroup: next, brands: [], model: '' });
  }

  function pickBrand(brand: string) {
    setFilters({ brands: brand ? [brand] : [], model: '' });
  }

  function pickModel(model: string) {
    setFilters({ model });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-700">
        <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">Kategori</span>
        {(['Tümü', 'Araç', 'Ev', 'Arsa'] as CategoryChoice[]).map(category => (
          <button
            key={category}
            onClick={() => pickCategory(category)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
              categoryChoice === category
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            {category}
          </button>
        ))}

        <div className="relative ml-auto" ref={codeRef}>
          <input
            type="text"
            placeholder="TKS-XXXXXXX ilan kodu"
            value={codeQuery}
            onChange={(e) => { setCodeQuery(e.target.value); setCodeOpen(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCodeSearch(); }}
            disabled={codeSearching}
            className="h-8 w-44 rounded-md border border-slate-200 bg-slate-50 px-3 text-xs text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          />
          {codeOpen && LISTING_CODE_RE.test(codeQuery.trim()) && (
            <button
              onClick={handleCodeSearch}
              disabled={codeSearching}
              className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-blue-600 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-blue-400"
            >
              {codeSearching ? 'Aranıyor…' : `"${codeQuery.trim()}" ilanına git`}
            </button>
          )}
        </div>
      </div>

      {isVehicle && (
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 py-3 dark:border-slate-700">
          <span className="mr-1 text-xs font-bold uppercase tracking-wide text-slate-400">Araç tipi</span>
          <button
            onClick={() => pickVehicleGroup('')}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
              !filters.vehicleGroup
                ? 'border-blue-600 bg-blue-600 text-white'
                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
          >
            Tümü
          </button>
          {VEHICLE_GROUP_KEYS.map(group => (
            <button
              key={group}
              onClick={() => pickVehicleGroup(group)}
              className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                filters.vehicleGroup === group
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {group}
            </button>
          ))}
        </div>
      )}

      <div className={`grid gap-2 pt-3 ${
        isVehicle
          ? 'lg:grid-cols-[1fr_1fr_180px_230px_auto_auto]'
          : 'lg:grid-cols-[minmax(180px,1fr)_minmax(230px,1fr)_auto]'
      }`}>
        {isVehicle && <div className="relative">
          <select
            value={selectedBrand}
            onChange={e => pickBrand(e.target.value)}
            className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">Tüm markalar</option>
            {brandOptions.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>}

        {isVehicle && <div className="relative">
          <select
            value={filters.model}
            onChange={e => pickModel(e.target.value)}
            disabled={!selectedBrand}
            className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">{selectedBrand ? 'Tüm modeller' : 'Önce marka seç'}</option>
            {modelOptions.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>}

        <div className="relative">
          <select
            value={filters.city}
            onChange={e => setFilters({ city: e.target.value })}
            className="h-10 w-full appearance-none rounded-md border border-slate-200 bg-slate-50 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition hover:border-slate-300 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            <option value="">Tüm şehirler</option>
            {CITIES_81.map(c => <option key={c}>{c}</option>)}
          </select>
          <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <div className="flex h-10 items-center rounded-md border border-slate-200 bg-slate-50 px-3 transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900">
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

        {isVehicle && <AdvancedFilters />}
        <SavedSearchesPanel />
      </div>

      {active && (
        <div className="mt-3 flex justify-end border-t border-slate-100 pt-3 dark:border-slate-700">
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sıfırla
          </button>
        </div>
      )}
    </div>
  );
}
