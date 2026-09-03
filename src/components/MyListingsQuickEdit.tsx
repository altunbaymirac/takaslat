import { useState } from 'react';
import EditListingModal from './EditListingModal';
import type { Listing } from '../types';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

/** Kendi ilanlarını tek tıkla düzenlemek için kısa liste. */
export default function MyListingsQuickEdit({ listings }: { listings: Listing[] }) {
  const [editing, setEditing] = useState<Listing | null>(null);

  if (listings.length === 0) return null;

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Hızlı düzenle</h3>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Bir ilan seç, bilgilerini güncelle.</p>

      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {listings.map((listing) => (
          <li key={listing.id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
              {listing.title}
            </span>
            <span className="hidden text-xs text-slate-500 dark:text-slate-400 sm:block">
              {fmt(listing.estimatedValue)}
            </span>
            <button
              type="button"
              onClick={() => setEditing(listing)}
              className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Düzenle
            </button>
          </li>
        ))}
      </ul>

      {editing && (
        <EditListingModal listing={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}
