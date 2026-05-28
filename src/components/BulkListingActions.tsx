import { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import type { Listing } from '../types';
import { showToast } from './Toast';

interface Props {
  listings: Listing[];
}

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function BulkListingActions({ listings }: Props) {
  const { updateListing, deleteListing } = useAppStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [percent, setPercent] = useState('-5');

  const selectedListings = useMemo(
    () => listings.filter((l) => selected.includes(l.id)),
    [listings, selected]
  );
  const selectedValue = selectedListings.reduce((sum, l) => sum + l.estimatedValue, 0);

  const toggle = (id: string) => {
    setSelected((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  };

  const applyPriceChange = () => {
    const rate = Number(percent);
    if (!selected.length || Number.isNaN(rate)) return;
    for (const listing of selectedListings) {
      updateListing(listing.id, {
        estimatedValue: Math.max(1, Math.round(listing.estimatedValue * (1 + rate / 100))),
      });
    }
    showToast(`${selected.length} ilan fiyatı güncellendi`, 'success');
  };

  const deactivate = () => {
    if (!selected.length) return;
    for (const id of selected) deleteListing(id);
    setSelected([]);
    showToast('Seçili ilanlar pasifleştirildi', 'success');
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Toplu İşlemler</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {selected.length ? `${selected.length} ilan seçili - toplam ${fmt(selectedValue)}` : 'İlanları seçip fiyat güncelleyebilir veya pasifleştirebilirsin.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelected(listings.map((l) => l.id))}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Tümünü Seç
          </button>
          <button
            type="button"
            onClick={() => setSelected([])}
            className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Temizle
          </button>
          <select
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            <option value="-10">%-10</option>
            <option value="-5">%-5</option>
            <option value="5">%+5</option>
            <option value="10">%+10</option>
          </select>
          <button
            type="button"
            disabled={!selected.length}
            onClick={applyPriceChange}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Fiyat Güncelle
          </button>
          <button
            type="button"
            disabled={!selected.length}
            onClick={deactivate}
            className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            Pasifleştir
          </button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <label key={listing.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2">
            <input
              type="checkbox"
              checked={selected.includes(listing.id)}
              onChange={() => toggle(listing.id)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">{listing.title}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{fmt(listing.estimatedValue)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
