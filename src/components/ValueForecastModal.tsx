import { useEffect, useState } from 'react';
import { aiForecast, type ValueForecast } from '../services/api';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

interface Props {
  listingId: string;
  onClose:   () => void;
}

export default function ValueForecastModal({ listingId, onClose }: Props) {
  const [data,    setData]    = useState<ValueForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    aiForecast(listingId)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [listingId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🔮</span> Değer Tahmin Grafiği
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              12 aylık projeksiyon — nominal değer kaybı + TL enflasyonu
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="text-center py-12">
              <div className="text-3xl mb-3 animate-pulse">🔮</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Tahmin hesaplanıyor…</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {data && (
            <div className="space-y-5">
              {/* Özet kartları */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                  <p className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase">Şu an</p>
                  <p className="text-lg font-bold text-blue-900 dark:text-blue-200">{fmt(data.currentValue)}</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${data.summary.totalChange6m >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
                  <p className={`text-[10px] font-semibold uppercase ${data.summary.totalChange6m >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>6 ay sonra</p>
                  <p className={`text-lg font-bold ${data.summary.totalChange6m >= 0 ? 'text-emerald-900 dark:text-emerald-200' : 'text-amber-900 dark:text-amber-200'}`}>{fmt(data.summary.after6m)}</p>
                  <p className="text-[10px] mt-0.5 opacity-75">{data.summary.totalChange6m >= 0 ? '+' : ''}{data.summary.totalChange6m.toFixed(1)}%</p>
                </div>
                <div className={`rounded-xl p-3 text-center ${data.summary.totalChange12m >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                  <p className={`text-[10px] font-semibold uppercase ${data.summary.totalChange12m >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>12 ay sonra</p>
                  <p className={`text-lg font-bold ${data.summary.totalChange12m >= 0 ? 'text-emerald-900 dark:text-emerald-200' : 'text-red-900 dark:text-red-200'}`}>{fmt(data.summary.after12m)}</p>
                  <p className="text-[10px] mt-0.5 opacity-75">{data.summary.totalChange12m >= 0 ? '+' : ''}{data.summary.totalChange12m.toFixed(1)}%</p>
                </div>
              </div>

              {/* Bar chart */}
              <div>
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Aylık projeksiyon</p>
                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4">
                  {(() => {
                    const max = Math.max(...data.months.map((m) => m.value));
                    const min = Math.min(...data.months.map((m) => m.value)) * 0.95;
                    return (
                      <div className="grid grid-cols-13 gap-1 items-end" style={{ height: 140 }}>
                        {data.months.map((m, i) => {
                          const pct = ((m.value - min) / (max - min)) * 100;
                          const isNow  = m.month === 0;
                          const trend = m.value >= data.currentValue ? 'green' : 'red';
                          return (
                            <div key={i} className="flex flex-col items-center justify-end h-full group">
                              <div
                                className={`w-full rounded-t transition-all ${
                                  isNow
                                    ? 'bg-blue-500'
                                    : trend === 'green' ? 'bg-emerald-400 dark:bg-emerald-500' : 'bg-amber-400 dark:bg-amber-500'
                                } group-hover:opacity-80`}
                                style={{ height: `${Math.max(8, pct)}%` }}
                                title={`${m.label}: ${fmt(m.value)}`}
                              />
                              {(i === 0 || i === 6 || i === 12) && (
                                <span className="text-[9px] text-slate-500 dark:text-slate-400 mt-1">{m.label}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Tavsiye + faktörler */}
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4">
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200 mb-2">{data.recommendation}</p>
                {data.factors.length > 0 && (
                  <ul className="space-y-1 mt-2">
                    {data.factors.map((f, i) => (
                      <li key={i} className="text-xs text-blue-800 dark:text-blue-300">• {f}</li>
                    ))}
                  </ul>
                )}
                <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-3 italic">
                  ⚠ Bu projeksiyon tahmindir. Gerçek değer piyasa koşullarına göre değişebilir.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
