import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function Compare() {
  useSEO({ title: 'İlan Karşılaştır', description: 'Birden fazla aracı yan yana karşılaştır, en iyi takas teklifini bul.' });

  const { compareList, listings, toggleCompare, clearCompare } = useAppStore();

  const items = compareList
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  if (items.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">⚖️</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Karşılaştırılacak ilan yok</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          İlan kartlarındaki "Karşılaştır" butonuna tıklayarak 2-3 ilan ekleyin.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
        >
          İlanlara Göz At
        </Link>
      </div>
    );
  }

  // ─── En iyi değer hesapla (her sayısal alan için) ───────────────────────────

  const prices = items.map((l) => l.estimatedValue);
  const years  = items.map((l) => l.vehicleDetails?.year ?? 0);
  const kms    = items.map((l) => l.vehicleDetails?.km ?? Infinity);

  const minPrice = Math.min(...prices);
  const maxYear  = Math.max(...years);
  const minKm    = Math.min(...kms);

  function priceBadge(v: number) { return v === minPrice && items.length > 1; }
  function yearBadge(v: number)  { return v === maxYear  && items.length > 1 && v > 0; }
  function kmBadge(v: number)    { return v === minKm    && items.length > 1 && v < Infinity; }

  // ─── Satır renderi ──────────────────────────────────────────────────────────

  const Row = ({
    label,
    render,
    isBest,
  }: {
    label: string;
    render: (l: NonNullable<typeof items[0]>) => React.ReactNode;
    isBest?: (l: NonNullable<typeof items[0]>) => boolean;
  }) => (
    <tr className="border-b border-slate-100 dark:border-slate-700 last:border-0">
      <td className="py-3 px-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide w-32 align-top">
        {label}
      </td>
      {items.map((l) => (
        <td key={l.id} className="py-3 px-4 align-top">
          <div className={`flex items-center gap-2 ${isBest?.(l) ? 'font-bold text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>
            <span className="text-sm">{render(l)}</span>
            {isBest?.(l) && <span className="text-emerald-500 text-xs">★ En iyi</span>}
          </div>
        </td>
      ))}
    </tr>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-32">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>⚖️</span> Karşılaştırma
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {items.length} ilan yan yana — yeşil ★ en iyi değeri gösterir
          </p>
        </div>
        <button
          onClick={clearCompare}
          className="text-sm text-slate-500 dark:text-slate-400 hover:text-red-600 font-medium"
        >
          Listeyi Temizle
        </button>
      </header>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* ── Header: thumbnails ── */}
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900">
                <th className="w-32"></th>
                {items.map((l) => (
                  <th key={l.id} className="p-4 text-left">
                    <div className="space-y-2">
                      <div className="relative">
                        <img
                          src={l.images[0]}
                          alt={l.title}
                          className="w-full h-32 object-cover rounded-xl"
                        />
                        <button
                          onClick={() => toggleCompare(l.id)}
                          className="absolute top-2 right-2 w-7 h-7 bg-black/60 hover:bg-red-600 text-white rounded-full flex items-center justify-center transition-colors"
                          title="Karşılaştırmadan çıkar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <Link
                        to={`/listing/${l.id}`}
                        className="block text-sm font-semibold text-slate-800 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 line-clamp-2"
                      >
                        {l.title}
                      </Link>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{l.city}</p>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            {/* ── Body: comparison rows ── */}
            <tbody>
              <Row label="Fiyat"   render={(l) => fmt(l.estimatedValue)}                isBest={(l) => priceBadge(l.estimatedValue)} />
              <Row label="Yıl"     render={(l) => l.vehicleDetails?.year ?? '—'}        isBest={(l) => yearBadge(l.vehicleDetails?.year ?? 0)} />
              <Row label="Km"      render={(l) => l.vehicleDetails ? `${l.vehicleDetails.km.toLocaleString('tr-TR')} km` : '—'} isBest={(l) => kmBadge(l.vehicleDetails?.km ?? Infinity)} />
              <Row label="Marka"   render={(l) => l.vehicleDetails?.brand ?? '—'} />
              <Row label="Model"   render={(l) => l.vehicleDetails?.model ?? '—'} />
              <Row label="Yakıt"   render={(l) => l.vehicleDetails?.fuel ?? '—'} />
              <Row label="Şanzıman"render={(l) => l.vehicleDetails?.transmission ?? '—'} />
              <Row label="Kasa"    render={(l) => l.vehicleDetails?.bodyType ?? '—'} />
              <Row label="Renk"    render={(l) => l.vehicleDetails?.color ?? '—'} />
              <Row label="Motor"   render={(l) => l.vehicleDetails?.engineCC ? `${l.vehicleDetails.engineCC} cc` : '—'} />
              <Row label="Hasar"   render={(l) => (
                l.vehicleDetails?.hasAccidentRecord
                  ? <span className="text-red-600 dark:text-red-400 font-semibold">⚠ Var</span>
                  : <span className="text-emerald-600 dark:text-emerald-400 font-semibold">✅ Yok</span>
              )} />
              <Row label="Durum"   render={(l) => l.condition} />
              <Row label="Sahibi"  render={(l) => l.ownerName} />
              <Row label="İsteniyor" render={(l) => (
                <span className="text-xs text-amber-700 dark:text-amber-400 line-clamp-3 leading-relaxed">
                  {l.wantedFor}
                </span>
              )} />
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="bg-slate-50 dark:bg-slate-900 px-4 py-3 grid gap-2" style={{ gridTemplateColumns: `8rem repeat(${items.length}, 1fr)` }}>
          <div />
          {items.map((l) => (
            <Link
              key={l.id}
              to={`/listing/${l.id}`}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold text-center py-2 rounded-xl transition-colors"
            >
              İlanı Aç
            </Link>
          ))}
        </div>
      </div>

      {items.length < 3 && (
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-6">
          Daha fazla ilan ekleyebilirsiniz · {3 - items.length} boş slot kaldı
        </p>
      )}
    </div>
  );
}
