import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import { useSEO } from '../hooks/useSEO';

const CITIES: Record<string, [number, number]> = {
  'İstanbul':   [41.01, 28.97],
  'Ankara':     [39.92, 32.85],
  'İzmir':      [38.42, 27.14],
  'Bursa':      [40.19, 29.06],
  'Antalya':    [36.89, 30.71],
  'Adana':      [36.99, 35.33],
  'Konya':      [37.87, 32.49],
  'Kayseri':    [38.72, 35.49],
  'Eskişehir':  [39.78, 30.52],
  'Trabzon':    [41.00, 39.72],
  'Diyarbakır': [37.91, 40.22],
  'Gaziantep':  [37.07, 37.38],
  'Mersin':     [36.80, 34.63],
  'Manisa':     [38.62, 27.43],
  'Kocaeli':    [40.76, 29.92],
  'Samsun':     [41.29, 36.33],
  'Erzurum':    [39.91, 41.27],
  'Van':        [38.49, 43.38],
  'Şanlıurfa':  [37.16, 38.79],
};

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function MapView() {
  useSEO({ title: 'Harita Görünümü', description: 'Türkiye genelindeki araç takas ilanlarını harita üzerinde keşfet.' });

  const { listings } = useAppStore();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);

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
    () => (selectedCity ? listings.filter((l) => l.city === selectedCity) : []),
    [listings, selectedCity]
  );

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;

    const map = L.map(mapRef.current, {
      center: [39.1, 35.6],
      zoom: 6,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    Object.entries(CITIES).forEach(([city, [lat, lng]]) => {
      const stat = byCity.get(city);
      const count = stat?.count ?? 0;
      const radius = count === 0 ? 5 : Math.max(10, Math.min(32, 10 + (count / max) * 22));

      const circle = L.circleMarker([lat, lng], {
        radius,
        fillColor: count === 0 ? '#94a3b8' : '#3b82f6',
        fillOpacity: count === 0 ? 0.4 : 0.85,
        color: '#ffffff',
        weight: 2,
      }).addTo(map);

      circle.bindTooltip(
        count > 0
          ? `<strong>${city}</strong><br/>${count} ilan · ${fmt(stat!.totalValue)}`
          : `<strong>${city}</strong><br/>İlan yok`,
        { direction: 'top', className: 'leaflet-tooltip-custom' }
      );

      if (count > 0) {
        circle.on('click', () => {
          setSelectedCity((prev) => (prev === city ? null : city));
        });
        circle.getElement()?.classList.add('cursor-pointer');
      }
    });

    leafletMap.current = map;

    return () => {
      map.remove();
      leafletMap.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Seçili şehrin marker rengini güncelle
  useEffect(() => {
    if (!leafletMap.current) return;
    leafletMap.current.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker) {
        const ll = layer.getLatLng();
        const city = Object.entries(CITIES).find(
          ([, [lat, lng]]) => Math.abs(ll.lat - lat) < 0.01 && Math.abs(ll.lng - lng) < 0.01
        )?.[0];
        if (!city) return;
        const count = byCity.get(city)?.count ?? 0;
        if (count === 0) return;
        layer.setStyle({
          fillColor: selectedCity === city ? '#1d4ed8' : '#3b82f6',
          fillOpacity: 0.85,
        });
      }
    });
  }, [selectedCity, byCity]);

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
      <div
        ref={mapRef}
        className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm mb-6"
        style={{ height: 480 }}
      />

      {/* Seçilen şehir ilanları */}
      {selectedCity && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              📍 {selectedCity}
              <span className="text-sm font-normal text-slate-500 dark:text-slate-400">
                — {cityListings.length} ilan
                {byCity.get(selectedCity) && ` · Toplam: ${fmt(byCity.get(selectedCity)!.totalValue)}`}
              </span>
            </h2>
            <button
              onClick={() => setSelectedCity(null)}
              className="text-sm text-slate-400 hover:text-red-500 transition-colors"
            >
              ✕ Kapat
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

      {!selectedCity && (
        <p className="text-center text-sm text-slate-400 dark:text-slate-500">
          Mavi noktaya tıkla, o şehirdeki ilanları gör.
        </p>
      )}
    </div>
  );
}
