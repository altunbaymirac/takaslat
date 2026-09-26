import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { fetchTrends, type TrendsData } from '../services/api';
import { useSEO } from '../hooks/useSEO';
import { useAppStore } from '../store/useAppStore';
import { isPlatformAdmin } from '../lib/roles';

const formatPrice = (value: number) =>
  new Intl.NumberFormat('tr-TR', {
    style: 'currency',
    currency: 'TRY',
    maximumFractionDigits: 0,
  }).format(value);

function HorizontalBar({ label, value, max, detail }: {
  label: string;
  value: number;
  max: number;
  detail?: string;
}) {
  const percentage = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  return (
    <div className="grid grid-cols-[minmax(90px,140px)_1fr_auto] items-center gap-3 py-2">
      <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">{label}</span>
      <div className="h-2 overflow-hidden rounded-sm bg-slate-200 dark:bg-slate-700">
        <div className="h-full bg-blue-700 dark:bg-blue-500" style={{ width: `${percentage}%` }} />
      </div>
      <span className="min-w-16 text-right text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
        {value.toLocaleString('tr-TR')}{detail ? ` · ${detail}` : ''}
      </span>
    </div>
  );
}

function DataSection({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 border-b border-slate-200 pb-3 dark:border-slate-700">
        <h2 className="text-base font-bold text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

export default function Trends() {
  useSEO({ title: 'Piyasa Verileri', description: 'Aktif ilanların kategori, şehir, marka ve yakıt dağılımını inceleyin.', noIndex: true });
  const currentUser = useAppStore((s) => s.currentUser);
  const isAdmin = isPlatformAdmin(currentUser?.role);
  const [data, setData] = useState<TrendsData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    fetchTrends().then(setData).catch(() => setError(true));
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin yetkisi gerekli</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Piyasa verileri paneli yalnızca yönetim yetkisi olan kullanıcılar içindir.</p>
      </div>
    );
  }

  if (error) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">Piyasa verileri şu anda yüklenemiyor.</div>;
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid animate-pulse grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900" />)}
        </div>
      </div>
    );
  }

  const maxBrand = Math.max(...data.topBrands.map((item) => item.count), 1);
  const maxCity = Math.max(...data.topCities.map((item) => item.count), 1);
  const maxCategory = Math.max(...data.categories.map((item) => item.count), 1);
  const maxFuel = Math.max(...data.fuels.map((item) => item.count), 1);
  const stats = [
    { label: 'Aktif ilan', value: data.totalListings.toLocaleString('tr-TR') },
    { label: 'Ortalama değer', value: formatPrice(data.avgPrice) },
    { label: 'Toplam portföy', value: formatPrice(data.totalValue) },
    { label: 'Son 7 gün', value: `+${data.recent7d}` },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Piyasa Verileri</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Aktif ilanlardan hesaplanan güncel pazar görünümü.</p>
        </div>
        <Link to="/listings" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-400">İlanlara dön</Link>
      </header>

      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 border-l-4 border-l-blue-700 bg-white p-4 dark:border-slate-700 dark:border-l-blue-500 dark:bg-slate-900">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">{stat.label}</p>
            <p className="mt-2 break-words text-lg font-bold tabular-nums text-slate-950 dark:text-white sm:text-xl">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <DataSection title="Popüler markalar" subtitle="Aktif araç ilanı sayısı ve ortalama değer">
          {data.topBrands.length ? data.topBrands.map((item) => (
            <HorizontalBar key={item.brand} label={item.brand} value={item.count} max={maxBrand} detail={formatPrice(item.avgPrice)} />
          )) : <p className="py-6 text-center text-sm text-slate-500">Henüz marka verisi yok.</p>}
        </DataSection>

        <DataSection title="Kategori dağılımı" subtitle="Aktif ilanların kategori bazında dağılımı">
          {data.categories.length ? data.categories.map((item) => (
            <HorizontalBar key={item.name} label={item.name} value={item.count} max={maxCategory} />
          )) : <p className="py-6 text-center text-sm text-slate-500">Henüz kategori verisi yok.</p>}
        </DataSection>

        <DataSection title="Aktif şehirler" subtitle="En çok ilan bulunan şehirler">
          {data.topCities.length ? data.topCities.map((item) => (
            <HorizontalBar key={item.name} label={item.name} value={item.count} max={maxCity} />
          )) : <p className="py-6 text-center text-sm text-slate-500">Henüz şehir verisi yok.</p>}
        </DataSection>

        <DataSection title="Yakıt dağılımı" subtitle="Araç ilanlarındaki yakıt tercihleri">
          {data.fuels.length ? data.fuels.map((item) => (
            <HorizontalBar key={item.name} label={item.name} value={item.count} max={maxFuel} />
          )) : <p className="py-6 text-center text-sm text-slate-500">Henüz araç verisi yok.</p>}
        </DataSection>
      </div>

      <p className="mt-5 text-center text-xs text-slate-400">Veriler sayfa açıldığında aktif ilanlardan yeniden hesaplanır.</p>
    </div>
  );
}
