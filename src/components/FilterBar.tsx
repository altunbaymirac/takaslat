import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import AdvancedFilters from './AdvancedFilters';
import { advancedFilterCount } from '../lib/filterSummary';
import SavedSearchesPanel from './SavedSearchesPanel';
import ListingSearchBar from './ListingSearchBar';
import { CITIES_81 } from '../data/cities';
import { VEHICLE_GROUPS } from '../data/vehicleTypes';
import { getBrandsForVehicleGroup } from '../data/brands';
import { getModelsFromDB } from '../data/vehicleDatabase';

const VEHICLE_GROUP_KEYS = Object.keys(VEHICLE_GROUPS);
type CategoryChoice = 'Araç' | 'Ev' | 'Arsa';

const formatPrice = (value: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(value);

export default function FilterBar({
  onFilterChange,
  embedded = false,
  resultCount,
}: {
  onFilterChange?: () => void;
  embedded?: boolean;
  resultCount?: number;
} = {}) {
  const { filters, setFilters: _setFilters, resetFilters: _resetFilters } = useAppStore();

  const setFilters: typeof _setFilters = (f) => { _setFilters(f); onFilterChange?.(); };
  const resetFilters = () => { _resetFilters(); onFilterChange?.(); };
  const [panelOpen, setPanelOpen] = useState(false);

  const selectedBrand = filters.brands[0] ?? '';
  const brandOptions = Array.from(new Set(getBrandsForVehicleGroup(filters.vehicleGroup)));
  const modelOptions = selectedBrand
    ? Array.from(new Set(getModelsFromDB(filters.vehicleGroup, selectedBrand)))
    : [];
  const categoryChoice: CategoryChoice =
    filters.category === 'Gayrimenkul'
      ? filters.propertyKind === 'Arsa' ? 'Arsa' : 'Ev'
      : 'Araç';
  const isVehicle = categoryChoice === 'Araç';

  // Panelin arkasında duran seçimler — rozet olarak da gösterilir.
  const chips: { label: string; clear: () => void }[] = [];
  if (filters.vehicleGroup) chips.push({ label: filters.vehicleGroup, clear: () => setFilters({ vehicleGroup: '', brands: [], model: '' }) });
  if (selectedBrand)        chips.push({ label: selectedBrand, clear: () => setFilters({ brands: [], model: '' }) });
  if (filters.model)        chips.push({ label: filters.model, clear: () => setFilters({ model: '' }) });
  if (filters.city)         chips.push({ label: filters.city, clear: () => setFilters({ city: '' }) });
  if (filters.minValue > 0 || filters.maxValue < 5_000_000) {
    chips.push({
      label: `${formatPrice(filters.minValue)} – ${filters.maxValue < 5_000_000 ? formatPrice(filters.maxValue) : '∞'} ₺`,
      clear: () => setFilters({ minValue: 0, maxValue: 5_000_000 }),
    });
  }
  filters.fuels.forEach((fuel) => chips.push({ label: fuel, clear: () => setFilters({ fuels: filters.fuels.filter((f) => f !== fuel) }) }));
  if (filters.noAccidentOnly) chips.push({ label: 'Hasarsız', clear: () => setFilters({ noAccidentOnly: false }) });

  const filterCount = chips.length + (isVehicle ? advancedFilterCount(filters) - filters.fuels.length - (filters.noAccidentOnly ? 1 : 0) : 0);

  function pickCategory(category: CategoryChoice) {
    const sharedVehicleReset = { vehicleGroup: '', brands: [], model: '', fuels: [], noAccidentOnly: false };
    if (category === 'Araç') {
      setFilters({ category: 'Araç', propertyKind: '', ...sharedVehicleReset });
      return;
    }
    setFilters({ category: 'Gayrimenkul', propertyKind: category, ...sharedVehicleReset });
  }

  return (
    <div className={embedded
      ? 'bg-white p-4 dark:bg-slate-900'
      : 'rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800'
    }>
      <ListingSearchBar onSearch={onFilterChange} />

      {/* Kategori + filtre girişi */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
          {(['Araç', 'Ev', 'Arsa'] as CategoryChoice[]).map((category, index) => (
            <button
              key={category}
              type="button"
              onClick={() => pickCategory(category)}
              className={`min-h-10 border-slate-200 px-4 text-sm font-semibold transition-colors dark:border-slate-700 ${
                index > 0 ? 'border-l' : ''
              } ${
                categoryChoice === category
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-controls="listing-filter-panel"
          className={`flex min-h-10 items-center gap-2 rounded-md border px-4 text-sm font-semibold transition-colors ${
            filterCount > 0
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filtrele
          {filterCount > 0 && (
            <span className="rounded-full bg-white/25 px-1.5 text-[11px] font-bold leading-tight">{filterCount}</span>
          )}
        </button>

        <SavedSearchesPanel />
      </div>

      {/* Aktif filtre rozetleri */}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={chip.clear}
              className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 py-1 pl-2.5 pr-2 text-xs font-semibold text-slate-600 transition-colors hover:border-red-200 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              {chip.label}
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          <button
            type="button"
            onClick={resetFilters}
            className="ml-1 text-xs font-semibold text-slate-400 transition-colors hover:text-red-600"
          >
            Tümünü temizle
          </button>
        </div>
      )}

      {/* Tek filtre paneli */}
      {panelOpen && (
        <div
          id="listing-filter-panel"
          className="mt-3 space-y-4 rounded-md border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"
        >
          {isVehicle && (
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Araç tipi</p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setFilters({ vehicleGroup: '', brands: [], model: '' })}
                  className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                    !filters.vehicleGroup
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  Tümü
                </button>
                {VEHICLE_GROUP_KEYS.map((group) => (
                  <button
                    key={group}
                    type="button"
                    onClick={() => setFilters({ vehicleGroup: filters.vehicleGroup === group ? '' : group, brands: [], model: '' })}
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
            </div>
          )}

          <div className={`grid gap-3 sm:grid-cols-2 ${isVehicle ? 'lg:grid-cols-4' : 'lg:grid-cols-2'}`}>
            {isVehicle && (
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Marka</span>
                <select
                  value={selectedBrand}
                  onChange={(e) => setFilters({ brands: e.target.value ? [e.target.value] : [], model: '' })}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="">Tüm markalar</option>
                  {brandOptions.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </label>
            )}

            {isVehicle && (
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Model</span>
                <select
                  value={filters.model}
                  onChange={(e) => setFilters({ model: e.target.value })}
                  disabled={!selectedBrand}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <option value="">{selectedBrand ? 'Tüm modeller' : 'Önce marka seç'}</option>
                  {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Şehir</span>
              <select
                value={filters.city}
                onChange={(e) => setFilters({ city: e.target.value })}
                className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
              >
                <option value="">Tüm şehirler</option>
                {CITIES_81.map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>

            <div>
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-400">Fiyat aralığı (₺)</span>
              <div className="flex h-10 items-center rounded-md border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-800">
                <input
                  type="number"
                  placeholder="Min"
                  aria-label="En düşük fiyat"
                  value={filters.minValue || ''}
                  onChange={(e) => setFilters({ minValue: Number(e.target.value) || 0 })}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300"
                />
                <span className="mx-2 select-none text-slate-300">–</span>
                <input
                  type="number"
                  placeholder="Max"
                  aria-label="En yüksek fiyat"
                  value={filters.maxValue < 5_000_000 ? filters.maxValue : ''}
                  onChange={(e) => setFilters({ maxValue: Number(e.target.value) || 5_000_000 })}
                  className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300"
                />
              </div>
            </div>
          </div>

          {isVehicle && <AdvancedFilters onChange={onFilterChange} />}

          <div className="flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-700">
            <button
              type="button"
              onClick={resetFilters}
              className="text-sm font-semibold text-slate-500 transition-colors hover:text-red-600"
            >
              Filtreleri sıfırla
            </button>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="btn-primary rounded-md px-5 py-2 text-sm font-bold"
            >
              {resultCount !== undefined ? `${resultCount} ilanı göster` : 'Uygula'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
