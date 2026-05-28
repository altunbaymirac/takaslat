import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import { useSEO } from '../hooks/useSEO';

// Yaklaşık Türkiye şehir koordinatları (SVG için 1000x500 grid)
const CITY_COORDS: Record<string, { x: number; y: number; population?: number }> = {
  'İstanbul':  { x: 240, y: 90 },
  'Ankara':    { x: 480, y: 200 },
  'İzmir':     { x: 180, y: 270 },
  'Bursa':     { x: 290, y: 130 },
  'Antalya':   { x: 380, y: 350 },
  'Adana':     { x: 590, y: 320 },
  'Konya':     { x: 460, y: 290 },
  'Kayseri':   { x: 580, y: 250 },
  'Eskişehir': { x: 400, y: 170 },
  'Trabzon':   { x: 750, y: 130 },
  'Diyarbakır':{ x: 770, y: 280 },
  'Gaziantep': { x: 670, y: 320 },
  'Mersin':    { x: 530, y: 350 },
  'Manisa':    { x: 215, y: 250 },
  'Kocaeli':   { x: 280, y: 110 },
  'Samsun':    { x: 600, y: 110 },
  'Erzurum':   { x: 820, y: 180 },
  'Van':       { x: 880, y: 240 },
  'Şanlıurfa': { x: 720, y: 320 },
};

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function MapView() {
  useSEO({ title: 'Harita Görünümü', description: 'Türkiye genelindeki araç takas ilanlarını harita üzerinde keşfet.' });

  const { listings } = useAppStore();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  // Şehir bazlı ilan sayıları
  const byCity = useMemo(() => {
    const m = new Map<string, { count: number; totalValue: number }>();
    for (const l of listings) {
      const c = m.get(l.city) ?? { count: 0, totalValue: 0 };
      m.set(l.city, { count: c.count + 1, totalValue: c.totalValue + l.estimatedValue });
    }
    return m;
  }, [listings]);

  const max = Math.max(...Array.from(byCity.values()).map((v) => v.count), 1);

  const cityListings = useMemo(
    () => selectedCity ? listings.filter((l) => l.city === selectedCity) : [],
    [listings, selectedCity]
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>🗺️</span> Harita Görünümü
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Türkiye genelinde ilan dağılımı — şehre tıkla, ilanları gör.
          </p>
        </div>
        <Link to="/" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
          ← Liste görünümü
        </Link>
      </header>

      {/* Harita */}
      <div className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-slate-800 dark:to-slate-900 rounded-2xl p-4 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm mb-6 overflow-hidden">
        <svg viewBox="0 0 1000 500" className="w-full h-auto" style={{ maxHeight: 500 }}>
          {/* Türkiye dış sınırı — basit ülke şekli */}
          <path
            d="M 50,180 Q 80,90 200,80 L 380,70 Q 500,75 620,90 L 800,110 Q 900,150 940,200 L 960,260 Q 940,330 880,360 L 750,400 Q 600,420 450,410 L 280,400 Q 150,380 80,330 Q 40,260 50,180 Z"
            fill="rgb(226 232 240 / 0.5)"
            stroke="rgb(148 163 184)"
            strokeWidth="1.5"
            className="dark:fill-slate-700/30 dark:stroke-slate-600"
          />

          {/* Şehirler */}
          {Object.entries(CITY_COORDS).map(([city, { x, y }]) => {
            const stat = byCity.get(city);
            const count = stat?.count ?? 0;
            const radius = count === 0 ? 4 : Math.max(8, Math.min(30, 8 + (count / max) * 22));
            const isSelected = selectedCity === city;

            return (
              <g
                key={city}
                onClick={() => count > 0 && setSelectedCity(isSelected ? null : city)}
                style={{ cursor: count > 0 ? 'pointer' : 'default' }}
                className="transition-all"
              >
                {/* Halo (seçili veya hover) */}
                {count > 0 && (
                  <circle
                    cx={x}
                    cy={y}
                    r={radius + 6}
                    fill={isSelected ? 'rgb(59 130 246 / 0.3)' : 'rgb(59 130 246 / 0.15)'}
                    className="hover:opacity-100 transition-opacity"
                  />
                )}
                {/* Ana daire */}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={count === 0 ? 'rgb(203 213 225)' : isSelected ? 'rgb(37 99 235)' : 'rgb(59 130 246)'}
                  stroke="white"
                  strokeWidth="2"
                />
                {/* Sayı (yeterince büyükse) */}
                {radius >= 12 && (
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    className="font-bold text-xs fill-white pointer-events-none"
                    style={{ fontSize: 11 }}
                  >
                    {count}
                  </text>
                )}
                {/* Şehir adı */}
                <text
                  x={x}
                  y={y + radius + 14}
                  textAnchor="middle"
                  className="text-[10px] fill-slate-700 dark:fill-slate-200 font-medium pointer-events-none"
                  style={{ fontSize: 10 }}
                >
                  {city}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-slate-300" /> İlan yok
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500" /> Az
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-full bg-blue-500" /> Çok
          </div>
        </div>
      </div>

      {/* Seçilen şehir ilanları */}
      {selectedCity && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              📍 {selectedCity} — {cityListings.length} ilan
              {byCity.get(selectedCity) && (
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400 ml-2">
                  Toplam değer: {fmt(byCity.get(selectedCity)!.totalValue)}
                </span>
              )}
            </h2>
            <button
              onClick={() => setSelectedCity(null)}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-500"
            >
              ✕ Seçimi temizle
            </button>
          </div>
          {cityListings.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">Bu şehirde aktif ilan yok.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {cityListings.map((l) => <ListingCard key={l.id} listing={l} />)}
            </div>
          )}
        </section>
      )}

      {!selectedCity && byCity.size > 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          ☝ Bir şehre tıkla, oradaki ilanları gör.
        </p>
      )}
    </div>
  );
}
