import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

const FUELS = ['Benzin', 'Dizel', 'LPG', 'Hibrit', 'Elektrik'];

/**
 * Araç ilanları için ayrıntılı alanlar. Kendi açılır penceresi yoktur;
 * FilterBar'daki tek filtre panelinin içinde gösterilir.
 */
export default function AdvancedFilters({ onChange }: { onChange?: () => void } = {}) {
  const { filters, setFilters: _setFilters, listings } = useAppStore();
  const setFilters: typeof _setFilters = (f) => { _setFilters(f); onChange?.(); };

  // Marka rozetleri veritabanındaki gerçek ilanlardan üretilir.
  const listedBrands = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => { if (l.vehicleDetails?.brand) set.add(l.vehicleDetails.brand); });
    return Array.from(set).sort();
  }, [listings]);

  function toggleFuel(fuel: string) {
    setFilters({
      fuels: filters.fuels.includes(fuel)
        ? filters.fuels.filter((x) => x !== fuel)
        : [...filters.fuels, fuel],
    });
  }

  const currentYear = new Date().getFullYear();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {listedBrands.length > 0 && (
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Sitedeki markalar</p>
          <div className="flex flex-wrap gap-1.5">
            {listedBrands.map((brand) => (
              <button
                key={brand}
                type="button"
                onClick={() => setFilters({ brands: filters.brands.includes(brand) ? [] : [brand], model: '' })}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                  filters.brands.includes(brand)
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="sm:col-span-2">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Yakıt tipi</p>
        <div className="flex flex-wrap gap-1.5">
          {FUELS.map((fuel) => (
            <button
              key={fuel}
              type="button"
              onClick={() => toggleFuel(fuel)}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-all ${
                filters.fuels.includes(fuel)
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
              }`}
            >
              {fuel}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Model yılı</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={1990}
            max={currentYear}
            value={filters.minYear}
            onChange={(e) => setFilters({ minYear: Number(e.target.value) || 1990 })}
            aria-label="En eski model yılı"
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <span className="self-center text-slate-400">—</span>
          <input
            type="number"
            min={1990}
            max={currentYear}
            value={filters.maxYear}
            onChange={(e) => setFilters({ maxYear: Number(e.target.value) || currentYear })}
            aria-label="En yeni model yılı"
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Kilometre</p>
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            step={5_000}
            value={filters.minKm}
            onChange={(e) => setFilters({ minKm: Number(e.target.value) || 0 })}
            aria-label="En düşük kilometre"
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <span className="self-center text-slate-400">—</span>
          <input
            type="number"
            min={0}
            step={5_000}
            value={filters.maxKm}
            onChange={(e) => setFilters({ maxKm: Number(e.target.value) || 500_000 })}
            aria-label="En yüksek kilometre"
            className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <label className="flex cursor-pointer items-center gap-3 rounded-md bg-slate-50 px-3 py-2.5 transition-colors hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800 sm:col-span-2">
        <input
          type="checkbox"
          checked={filters.noAccidentOnly}
          onChange={(e) => setFilters({ noAccidentOnly: e.target.checked })}
          className="h-4 w-4 rounded text-blue-600"
        />
        <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Sadece hasar kaydı olmayan ilanlar</span>
      </label>
    </div>
  );
}
