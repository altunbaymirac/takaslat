import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchTrends, type TrendsData } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

const compactFmt = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` :
  n >= 1_000     ? `${(n / 1_000).toFixed(0)}K`    :
  n.toString();

// ─── Bar chart bileşeni ───────────────────────────────────────────────────────

function HBar({ label, value, max, color, suffix }: {
  label: string; value: number; max: number; color: string; suffix?: string;
}) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  const valueInside = pct >= 72;
  return (
    <div className="flex items-center gap-3">
      <div className="w-24 text-xs text-slate-600 dark:text-slate-300 font-medium truncate flex-shrink-0">{label}</div>
      <div className="flex-1 h-7 bg-slate-100 dark:bg-slate-800 rounded-lg relative overflow-visible">
        <div
          className={`h-full ${color} transition-all duration-500 rounded-lg`}
          style={{ width: `${pct}%` }}
        />
        {/* Sayı yüksek barlarda içeride, kısa barlarda dışarıda gösterilir. */}
        <span
          className={`absolute top-1/2 -translate-y-1/2 text-xs font-bold ${
            valueInside ? 'right-2 text-white' : 'text-slate-700 dark:text-slate-200'
          }`}
          style={valueInside ? undefined : { left: `calc(${pct}% + 8px)` }}
        >
          {value.toLocaleString('tr-TR')}{suffix}
        </span>
      </div>
    </div>
  );
}

// ─── Sayfa ────────────────────────────────────────────────────────────────────

export default function Trends() {
  useSEO({ title: 'Piyasa Trendleri', description: 'Araç fiyat trendleri, talep analizi ve piyasa verilerini keşfet.' });

  const [data, setData] = useState<TrendsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetchTrends()
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-slate-500 dark:text-slate-400">Trend verisi yüklenemedi. Backend çalışıyor mu?</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const maxBrand = Math.max(...data.topBrands.map((b) => b.count), 1);
  const maxCity  = Math.max(...data.topCities.map((c) => c.count), 1);
  const maxCat   = Math.max(...data.categories.map((c) => c.count), 1);
  const maxFuel  = Math.max(...data.fuels.map((f) => f.count), 1);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>📈</span> Trend Paneli
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerçek zamanlı piyasa analitiği — pazarın nabzı
          </p>
        </div>
        <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
          ← İlanlara dön
        </Link>
      </header>

      {/* Genel istatistikler */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { icon: '📋', label: 'Toplam İlan',    value: data.totalListings.toLocaleString('tr-TR'),   color: 'bg-blue-600' },
          { icon: '💰', label: 'Ortalama Değer', value: fmt(data.avgPrice),                            color: 'bg-emerald-600' },
          { icon: '🌟', label: 'Toplam Portföy', value: `₺${compactFmt(data.totalValue)}`,            color: 'bg-violet-600' },
          { icon: '🆕', label: 'Son 7 Gün',      value: `+${data.recent7d}`,                          color: 'bg-orange-600' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-2xl p-4 sm:p-5 text-white shadow-sm`}>
            <div className="text-2xl sm:text-3xl mb-1">{s.icon}</div>
            <div className="text-xs opacity-90 mb-0.5">{s.label}</div>
            <div className="text-lg sm:text-2xl font-bold tracking-tight">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* En popüler markalar */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span>🏆</span> En Popüler Markalar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">İlan sayısı + görüntülenme bazlı</p>
          {data.topBrands.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Henüz veri yok</p>
          ) : (
            <div className="space-y-2">
              {data.topBrands.map((b, i) => (
                <div key={b.brand} className="flex items-center gap-3">
                  <span className="w-6 text-xs font-bold text-slate-400 dark:text-slate-500">#{i + 1}</span>
                  <HBar
                    label={b.brand}
                    value={b.count}
                    max={maxBrand}
                    color="bg-blue-500/80 dark:bg-blue-500"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 w-20 text-right">{fmt(b.avgPrice)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Kategori dağılımı */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span>🗂️</span> Kategori Dağılımı
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Aktif ilanlar</p>
          {data.categories.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Henüz veri yok</p>
          ) : (
            <div className="space-y-2.5">
              {data.categories.map((c) => {
                const icon: Record<string, string> = { 'Araç': '🚗', 'Elektronik': '📱', 'Gayrimenkul': '🏠', 'Diğer': '📦' };
                return (
                  <HBar
                    key={c.name}
                    label={`${icon[c.name] ?? ''} ${c.name}`}
                    value={c.count}
                    max={maxCat}
                    color="bg-emerald-500/80 dark:bg-emerald-500"
                  />
                );
              })}
            </div>
          )}
        </section>

        {/* En aktif şehirler */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span>🌍</span> En Aktif Şehirler
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">En çok ilan paylaşan şehirler</p>
          <div className="space-y-2.5">
            {data.topCities.map((c) => (
              <HBar
                key={c.name}
                label={`📍 ${c.name}`}
                value={c.count}
                max={maxCity}
                color="bg-amber-500/80 dark:bg-amber-500"
              />
            ))}
          </div>
        </section>

        {/* Yakıt türleri */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 flex items-center gap-2">
            <span>⛽</span> Yakıt Tercihi
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Araç ilanlarında</p>
          {data.fuels.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500 py-6 text-center">Araç ilanı yok</p>
          ) : (
            <div className="space-y-2.5">
              {data.fuels.map((f) => {
                const icon: Record<string, string> = { 'Benzin': '⛽', 'Dizel': '🛢️', 'LPG': '🔵', 'Hibrit': '⚡', 'Elektrik': '⚡' };
                return (
                  <HBar
                    key={f.name}
                    label={`${icon[f.name] ?? ''} ${f.name}`}
                    value={f.count}
                    max={maxFuel}
                    color="bg-violet-500/80 dark:bg-violet-500"
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>

      <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
        ✦ Veriler gerçek zamanlı · Sayfa her açılışta yenilenir
      </p>
    </div>
  );
}
