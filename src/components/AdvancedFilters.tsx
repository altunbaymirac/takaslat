import { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';

const FUELS = ['Benzin', 'Dizel', 'LPG', 'Hibrit', 'Elektrik'];

export default function AdvancedFilters() {
  const { filters, setFilters, listings } = useAppStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Marka listesini DB'deki gerçek ilanlardan üret
  const allBrands = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((l) => {
      if (l.vehicleDetails?.brand) set.add(l.vehicleDetails.brand);
    });
    return Array.from(set).sort();
  }, [listings]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Aktif gelişmiş filtre sayısı
  const activeCount =
    filters.brands.length +
    filters.fuels.length +
    (filters.minYear > 1990 ? 1 : 0) +
    (filters.maxYear < new Date().getFullYear() ? 1 : 0) +
    (filters.minKm > 0 ? 1 : 0) +
    (filters.maxKm < 500_000 ? 1 : 0) +
    (filters.noAccidentOnly ? 1 : 0);

  function toggleBrand(b: string) {
    setFilters({
      brands: filters.brands.includes(b)
        ? filters.brands.filter((x) => x !== b)
        : [...filters.brands, b],
    });
  }

  function toggleFuel(f: string) {
    setFilters({
      fuels: filters.fuels.includes(f)
        ? filters.fuels.filter((x) => x !== f)
        : [...filters.fuels, f],
    });
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`relative flex h-12 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all ${
          activeCount > 0
            ? 'border-blue-600 bg-blue-600 text-white shadow-sm'
            : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
        }`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
        </svg>
        Gelişmiş Filtre
        {activeCount > 0 && (
          <span className="bg-white/30 text-[10px] font-bold rounded-full px-1.5 leading-tight">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-[calc(100vw-1rem)] max-w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-30 p-4 max-h-[70dvh] overflow-y-auto">
          {/* Markalar */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Markalar {filters.brands.length > 0 && `(${filters.brands.length})`}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {allBrands.map((b) => (
                <button
                  key={b}
                  onClick={() => toggleBrand(b)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all border ${
                    filters.brands.includes(b)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {b}
                </button>
              ))}
              {allBrands.length === 0 && (
                <p className="text-xs text-slate-400">Yükleniyor…</p>
              )}
            </div>
          </div>

          {/* Yakıt */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Yakıt Tipi</p>
            <div className="flex flex-wrap gap-1.5">
              {FUELS.map((f) => (
                <button
                  key={f}
                  onClick={() => toggleFuel(f)}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full transition-all border ${
                    filters.fuels.includes(f)
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Yıl aralığı */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Model Yılı: <span className="text-slate-700 dark:text-slate-200">{filters.minYear} – {filters.maxYear}</span>
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={1990}
                max={new Date().getFullYear()}
                value={filters.minYear}
                onChange={(e) => setFilters({ minYear: Number(e.target.value) || 1990 })}
                className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min"
              />
              <span className="text-slate-400 self-center">—</span>
              <input
                type="number"
                min={1990}
                max={new Date().getFullYear()}
                value={filters.maxYear}
                onChange={(e) => setFilters({ maxYear: Number(e.target.value) || new Date().getFullYear() })}
                className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Max"
              />
            </div>
          </div>

          {/* Km aralığı */}
          <div className="mb-4">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Kilometre: <span className="text-slate-700 dark:text-slate-200">{filters.minKm.toLocaleString('tr-TR')} – {filters.maxKm.toLocaleString('tr-TR')}</span>
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                min={0}
                step={5_000}
                value={filters.minKm}
                onChange={(e) => setFilters({ minKm: Number(e.target.value) || 0 })}
                className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Min km"
              />
              <span className="text-slate-400 self-center">—</span>
              <input
                type="number"
                min={0}
                step={5_000}
                value={filters.maxKm}
                onChange={(e) => setFilters({ maxKm: Number(e.target.value) || 500_000 })}
                className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Max km"
              />
            </div>
          </div>

          {/* Hasar */}
          <label className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-900 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <input
              type="checkbox"
              checked={filters.noAccidentOnly}
              onChange={(e) => setFilters({ noAccidentOnly: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              ✅ Sadece hasarsız ilanlar
            </span>
          </label>

          {/* Actions */}
          <div className="flex gap-2 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
            <button
              onClick={() => setFilters({
                brands: [], fuels: [], minYear: 1990, maxYear: new Date().getFullYear(),
                minKm: 0, maxKm: 500_000, noAccidentOnly: false,
              })}
              className="flex-1 text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 font-medium py-2"
            >
              Sıfırla
            </button>
            <button
              onClick={() => setOpen(false)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-xl"
            >
              Uygula
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
