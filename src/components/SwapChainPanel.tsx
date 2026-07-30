import { Link } from 'react-router-dom';
import type { Listing } from '../types';
import { findSwapChains } from '../lib/swapIntelligence';

const fmt = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);

export default function SwapChainPanel({ listing, listings }: { listing: Listing; listings: Listing[] }) {
  const chains = findSwapChains(listings, listing.id);

  return (
    <section className="rounded-2xl border border-cyan-100 bg-white p-6 shadow-sm dark:border-cyan-900/40 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">Takas Zinciri</p>
          <h2 className="mt-1 text-base font-bold text-slate-900 dark:text-slate-100">Karşılıklı eşleşme motoru</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            İki veya üç ilan arasında herkesin istediği aracı bulur.
          </p>
        </div>
        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-xs font-black text-cyan-700 dark:border-cyan-900/50 dark:bg-cyan-900/20 dark:text-cyan-300">
          {chains.length} aday
        </span>
      </div>

      {chains.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Şimdilik uygun zincir yok</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Yeni ilanlar geldikçe takas beklentileri otomatik yeniden eşleştirilir.
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {chains.map((chain) => (
            <div key={chain.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-xs font-black text-cyan-700 dark:text-cyan-300">
                  {chain.kind === 'direct' ? 'Doğrudan eşleşme' : 'Üçlü takas'}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  En yüksek fark {fmt(chain.maxCashGap)}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {chain.listings.map((item, index) => (
                  <div key={item.id} className="contents">
                    <Link
                      to={`/listing/${item.id}`}
                      className="max-w-[180px] truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-cyan-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                    >
                      {item.title}
                    </Link>
                    {index < chain.listings.length - 1 && <span className="font-bold text-cyan-500">→</span>}
                  </div>
                ))}
                <span className="font-bold text-cyan-500">→</span>
                <span className="text-xs font-bold text-slate-500">Başa dön</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
