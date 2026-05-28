import { useEffect, useMemo, useRef, useState } from 'react';

interface Props {
  value:    string;
  onChange: (brand: string) => void;
  brands:   string[];
  required?: boolean;
  placeholder?: string;
}

/**
 * Aranabilir marka seçici — combobox tarzı
 * - Yazarken filtreler
 * - Listeden seçilen markaya kilitlenir
 * - Listede olmayan marka da yazılabilir (custom)
 */
export default function BrandPicker({ value, onChange, brands, required, placeholder }: Props) {
  const [query, setQuery]   = useState(value);
  const [open,  setOpen]    = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // value prop dışarıdan değişirse senkronize et
  useEffect(() => { setQuery(value); }, [value]);

  // Outside click → kapat
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return brands.slice(0, 30);   // ilk 30
    return brands.filter((b) => b.toLowerCase().includes(q)).slice(0, 30);
  }, [query, brands]);

  function pick(brand: string) {
    onChange(brand);
    setQuery(brand);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        required={required}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          onChange(e.target.value);   // her değişiklikte parent'a bildir
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder ?? 'Marka seç...'}
        className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 pr-9 focus:outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
      >
        <svg className="w-4 h-4 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-30 max-h-72 overflow-y-auto py-1">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-slate-400 dark:text-slate-500 text-center">
              Eşleşme yok — yazdığın "<strong>{query}</strong>" markası kullanılacak
            </div>
          ) : (
            filtered.map((b) => {
              const isActive = b.toLowerCase() === value.toLowerCase();
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => pick(b)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {b}
                  {isActive && <span className="ml-2 text-xs">✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
