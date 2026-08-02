import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useRef, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import { useSEO } from '../hooks/useSEO';
import type { Listing } from '../types';

const CITIES: Record<string, [number, number]> = {
  'Adana':           [37.00, 35.32],
  'Adıyaman':        [37.76, 38.28],
  'Afyonkarahisar':  [38.75, 30.54],
  'Ağrı':            [39.72, 43.05],
  'Amasya':          [40.65, 35.83],
  'Ankara':          [39.92, 32.85],
  'Antalya':         [36.89, 30.71],
  'Artvin':          [41.18, 41.82],
  'Aydın':           [37.85, 27.84],
  'Balıkesir':       [39.65, 27.89],
  'Bilecik':         [40.15, 29.98],
  'Bingöl':          [38.88, 40.50],
  'Bitlis':          [38.40, 42.11],
  'Bolu':            [40.73, 31.61],
  'Burdur':          [37.72, 30.29],
  'Bursa':           [40.19, 29.06],
  'Çanakkale':       [40.15, 26.41],
  'Çankırı':         [40.60, 33.62],
  'Çorum':           [40.55, 34.95],
  'Denizli':         [37.77, 29.09],
  'Diyarbakır':      [37.91, 40.22],
  'Edirne':          [41.68, 26.56],
  'Elazığ':          [38.68, 39.22],
  'Erzincan':        [39.75, 39.50],
  'Erzurum':         [39.91, 41.27],
  'Eskişehir':       [39.78, 30.52],
  'Gaziantep':       [37.07, 37.38],
  'Giresun':         [40.91, 38.39],
  'Gümüşhane':       [40.46, 39.48],
  'Hakkari':         [37.57, 43.74],
  'Hatay':           [36.40, 36.33],
  'Isparta':         [37.76, 30.55],
  'Mersin':          [36.80, 34.63],
  'İstanbul':        [41.01, 28.97],
  'İzmir':           [38.42, 27.14],
  'Kars':            [40.61, 43.09],
  'Kastamonu':       [41.37, 33.78],
  'Kayseri':         [38.72, 35.49],
  'Kırklareli':      [41.73, 27.22],
  'Kırşehir':        [39.15, 34.16],
  'Kocaeli':         [40.76, 29.92],
  'Konya':           [37.87, 32.49],
  'Kütahya':         [39.42, 29.98],
  'Malatya':         [38.35, 38.31],
  'Manisa':          [38.62, 27.43],
  'Kahramanmaraş':   [37.58, 36.94],
  'Mardin':          [37.31, 40.73],
  'Muğla':           [37.22, 28.37],
  'Muş':             [38.74, 41.50],
  'Nevşehir':        [38.63, 34.72],
  'Niğde':           [37.97, 34.69],
  'Ordu':            [40.98, 37.88],
  'Rize':            [41.02, 40.52],
  'Sakarya':         [40.78, 30.40],
  'Samsun':          [41.29, 36.33],
  'Siirt':           [37.93, 41.95],
  'Sinop':           [42.03, 35.15],
  'Sivas':           [39.75, 37.02],
  'Tekirdağ':        [40.98, 27.51],
  'Tokat':           [40.31, 36.56],
  'Trabzon':         [41.00, 39.72],
  'Tunceli':         [39.31, 39.44],
  'Şanlıurfa':       [37.16, 38.79],
  'Uşak':            [38.67, 29.41],
  'Van':             [38.49, 43.38],
  'Yozgat':          [39.82, 34.80],
  'Zonguldak':       [41.45, 31.80],
  'Aksaray':         [38.37, 34.03],
  'Bayburt':         [40.26, 40.22],
  'Karaman':         [37.18, 33.22],
  'Kırıkkale':       [39.85, 33.51],
  'Batman':          [37.89, 41.13],
  'Şırnak':          [37.51, 42.46],
  'Bartın':          [41.64, 32.34],
  'Ardahan':         [41.11, 42.70],
  'Iğdır':           [39.92, 44.04],
  'Yalova':          [40.65, 29.27],
  'Karabük':         [41.20, 32.62],
  'Kilis':           [36.72, 37.12],
  'Osmaniye':        [37.07, 36.25],
  'Düzce':           [40.83, 31.16],
};

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

type MapCategory = 'Tümü' | 'Araç' | 'Ev' | 'Arsa';

function isLandListing(listing: Listing) {
  if (listing.propertyDetails?.type) return listing.propertyDetails.type === 'Arsa';
  const text = `${listing.title} ${listing.description} ${listing.wantedFor}`.toLocaleLowerCase('tr-TR');
  return !listing.vehicleDetails && ['arsa', 'tarla', 'parsel', 'imar', 'bahçe'].some((term) => text.includes(term));
}

export default function MapView() {
  useSEO({ title: 'Harita Görünümü', description: 'Türkiye genelindeki takas ilanlarını harita üzerinde filtreleyerek keşfet.' });

  const { listings } = useAppStore();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [category, setCategory] = useState<MapCategory>('Tümü');
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const markerLayer = useRef<L.LayerGroup | null>(null);

  const filteredListings = useMemo(() => {
    const min = Number(minValue) || 0;
    const max = Number(maxValue) || Number.POSITIVE_INFINITY;
    return listings.filter((listing) => {
      const isLand = isLandListing(listing);
      if (category === 'Araç' && (listing.category !== 'Araç' || isLand)) return false;
      if (category === 'Ev' && (listing.category !== 'Gayrimenkul' || isLand)) return false;
      if (category === 'Arsa' && !isLand) return false;
      return listing.estimatedValue >= min && listing.estimatedValue <= max;
    });
  }, [category, listings, maxValue, minValue]);

  const byCity = useMemo(() => {
    const result = new Map<string, { count: number; totalValue: number }>();
    for (const listing of filteredListings) {
      const current = result.get(listing.city) ?? { count: 0, totalValue: 0 };
      result.set(listing.city, {
        count: current.count + 1,
        totalValue: current.totalValue + listing.estimatedValue,
      });
    }
    return result;
  }, [filteredListings]);

  const cityListings = useMemo(
    () => selectedCity ? filteredListings.filter((listing) => listing.city === selectedCity) : [],
    [filteredListings, selectedCity]
  );

  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    const map = L.map(mapRef.current, { center: [39.1, 35.6], zoom: 6, scrollWheelZoom: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    markerLayer.current = L.layerGroup().addTo(map);
    leafletMap.current = map;
    setMapReady(true);
    return () => {
      map.remove();
      markerLayer.current = null;
      leafletMap.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapReady || !markerLayer.current) return;
    markerLayer.current.clearLayers();
    const maxCount = Math.max(...Array.from(byCity.values()).map((value) => value.count), 1);

    for (const [city, stat] of byCity) {
      const coordinates = CITIES[city];
      if (!coordinates) continue;
      const radius = Math.max(10, Math.min(28, 10 + (stat.count / maxCount) * 18));
      const circle = L.circleMarker(coordinates, {
        radius,
        fillColor: selectedCity === city ? '#1e40af' : '#2563eb',
        fillOpacity: 0.86,
        color: '#ffffff',
        weight: 2,
      }).addTo(markerLayer.current);
      circle.bindTooltip(`<strong>${city}</strong><br/>${stat.count} ilan · ${fmt(stat.totalValue)}`, {
        direction: 'top',
        className: 'leaflet-tooltip-custom',
      });
      circle.on('click', () => setSelectedCity((current) => current === city ? null : city));
    }
  }, [byCity, mapReady, selectedCity]);

  const resetFilters = () => {
    setCategory('Tümü');
    setMinValue('');
    setMaxValue('');
    setSelectedCity(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Harita Görünümü</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Konuma, kategoriye ve değere göre aktif ilanları inceleyin.</p>
        </div>
        <Link to="/listings" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400">Liste görünümü</Link>
      </header>

      <section className="mb-4 border-y border-slate-200 bg-white py-3 dark:border-slate-700 dark:bg-slate-900">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[180px_1fr_1fr_auto_auto]">
          <select value={category} onChange={(event) => { setCategory(event.target.value as MapCategory); setSelectedCity(null); }} className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
            <option>Tümü</option>
            <option>Araç</option>
            <option>Ev</option>
            <option>Arsa</option>
          </select>
          <input type="number" min="0" value={minValue} onChange={(event) => { setMinValue(event.target.value); setSelectedCity(null); }} placeholder="Minimum değer" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950" />
          <input type="number" min="0" value={maxValue} onChange={(event) => { setMaxValue(event.target.value); setSelectedCity(null); }} placeholder="Maksimum değer" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-600 dark:border-slate-700 dark:bg-slate-950" />
          <div className="flex h-10 items-center whitespace-nowrap px-2 text-sm font-semibold text-slate-600 dark:text-slate-300">{filteredListings.length} ilan</div>
          <button type="button" onClick={resetFilters} className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:border-blue-600 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300">Sıfırla</button>
        </div>
      </section>

      <div ref={mapRef} className="mb-6 h-[420px] overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 sm:h-[520px]" />

      {selectedCity ? (
        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 dark:border-slate-700">
            <div>
              <h2 className="text-lg font-bold text-slate-950 dark:text-white">{selectedCity}</h2>
              <p className="text-sm text-slate-500">{cityListings.length} ilan · {fmt(byCity.get(selectedCity)?.totalValue ?? 0)}</p>
            </div>
            <button type="button" onClick={() => setSelectedCity(null)} className="text-sm font-semibold text-slate-600 hover:text-blue-700 dark:text-slate-300">Kapat</button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {cityListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      ) : (
        <p className="text-center text-sm text-slate-500">İlanları görmek için haritadaki bir şehri seçin.</p>
      )}
    </div>
  );
}
