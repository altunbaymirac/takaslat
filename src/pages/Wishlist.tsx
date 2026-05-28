import { useState, useMemo, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../components/Toast';
import type { Category, WishItem } from '../types';
import { useSEO } from '../hooks/useSEO';

const CATS: Category[] = ['Araç', 'Elektronik', 'Gayrimenkul', 'Diğer'];

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

function WishCard({ wish, matched }: { wish: WishItem; matched: ReturnType<typeof useAppStore.getState>['listings'] }) {
  const { removeWish, toggleWishNotify } = useAppStore();

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{wish.name}</h3>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {wish.category && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-full">{wish.category}</span>}
            {wish.brand    && <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">🏷️ {wish.brand}</span>}
            {wish.city     && <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full">📍 {wish.city}</span>}
            {wish.maxValue && <span className="text-xs bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full">💰 {fmt(wish.maxValue)}</span>}
            {(wish.minYear || wish.maxYear) && (
              <span className="text-xs bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full">
                📅 {wish.minYear ?? '*'} – {wish.maxYear ?? '*'}
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => toggleWishNotify(wish.id)}
          title={wish.notify ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
          className={`text-xs font-semibold px-3 py-1 rounded-full transition-colors flex-shrink-0 ${
            wish.notify
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          🔔 {wish.notify ? 'Açık' : 'Kapalı'}
        </button>

        <button
          onClick={() => removeWish(wish.id)}
          title="Sil"
          className="w-7 h-7 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center flex-shrink-0 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Eşleşmeler */}
      <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            🎯 {matched.length} eşleşme bulundu
          </p>
        </div>
        {matched.length === 0 ? (
          <p className="text-xs text-slate-400 dark:text-slate-500 italic">Henüz uyan ilan yok — bildirim açıkken yeni gelen ilanlar burada görünecek.</p>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {matched.slice(0, 6).map((l) => (
              <Link
                key={l.id}
                to={`/listing/${l.id}`}
                className="flex-shrink-0 w-32 bg-slate-50 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow"
              >
                <img src={l.images[0]} alt="" className="w-full h-20 object-cover" />
                <div className="p-2">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">{l.title}</p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 font-bold mt-1">{fmt(l.estimatedValue)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Wishlist() {
  useSEO({ title: 'İstek Listesi', description: 'Aradığın aracı tanımla, uygun ilan çıkınca bildirim al.' });

  const { wishlist, addWish, listings, matchWish } = useAppStore();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category | ''>('');
  const [brand, setBrand] = useState('');
  const [city, setCity] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [minYear, setMinYear] = useState('');
  const [maxYear, setMaxYear] = useState('');

  const wishWithMatches = useMemo(() =>
    wishlist.map((w) => ({ wish: w, matches: matchWish(w, listings) })),
    [wishlist, listings, matchWish]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    addWish({
      name:     name.trim(),
      category: (category || undefined) as Category | undefined,
      brand:    brand.trim() || undefined,
      city:     city.trim()  || undefined,
      maxValue: maxValue ? Number(maxValue) : undefined,
      minYear:  minYear  ? Number(minYear)  : undefined,
      maxYear:  maxYear  ? Number(maxYear)  : undefined,
      notify:   true,
    });
    showToast(`"${name}" istek listene eklendi`, 'success');
    setName(''); setCategory(''); setBrand(''); setCity('');
    setMaxValue(''); setMinYear(''); setMaxYear('');
    setOpen(false);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🎁</span> İstek Listem
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Aradığın özellikteki ilanları kaydet — yeni eşleşme geldiğinde haberdar ol.
          </p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-4 py-2 rounded-xl"
        >
          {open ? 'Kapat' : '+ Yeni İstek'}
        </button>
      </header>

      {/* Yeni istek formu */}
      {open && (
        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm mb-6 space-y-3"
        >
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">İstek Adı *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: SUV - dizel - Ankara"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Kategori</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as Category)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Hepsi</option>
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Marka</label>
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)}
                placeholder="Örn: BMW, Toyota..."
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Şehir</label>
              <input type="text" value={city} onChange={(e) => setCity(e.target.value)}
                placeholder="Örn: Ankara"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Maksimum Değer (₺)</label>
              <input type="number" value={maxValue} onChange={(e) => setMaxValue(e.target.value)}
                placeholder="1000000"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Min Yıl</label>
              <input type="number" value={minYear} onChange={(e) => setMinYear(e.target.value)}
                placeholder="2018"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">Max Yıl</label>
              <input type="number" value={maxYear} onChange={(e) => setMaxYear(e.target.value)}
                placeholder="2024"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl">
            İstek Listesine Ekle
          </button>
        </form>
      )}

      {/* İstekler */}
      {wishlist.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎁</div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">İstek listen boş</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
            Aradığın özellikteki ilanları kaydet, yeni eşleşmeler geldiğinde haberdar ol.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {wishWithMatches.map(({ wish, matches }) => (
            <WishCard key={wish.id} wish={wish} matched={matches} />
          ))}
        </div>
      )}
    </div>
  );
}
