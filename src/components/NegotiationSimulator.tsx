import { useState, type FormEvent } from 'react';
import { aiNegotiate, type NegotiationAnalysis } from '../services/api';
import { showToast } from './Toast';

interface Props {
  listingId?:    string;
  listingTitle?: string;
  onClose:       () => void;
}

const TONE_COLORS: Record<string, { bg: string; text: string; emoji: string }> = {
  agresif: { bg: 'bg-red-100 dark:bg-red-900/30',        text: 'text-red-700 dark:text-red-300',         emoji: '⚡' },
  pasif:   { bg: 'bg-amber-100 dark:bg-amber-900/30',    text: 'text-amber-700 dark:text-amber-300',     emoji: '😐' },
  dengeli: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', emoji: '✅' },
};

const POSSIBILITY_COLORS: Record<string, string> = {
  kabul:    'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40',
  pazarlık: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-900/40',
  red:      'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40',
};

export default function NegotiationSimulator({ listingId, listingTitle, onClose }: Props) {
  const [myMessage,    setMyMessage]    = useState('');
  const [offeredValue, setOfferedValue] = useState('');
  const [loading,      setLoading]      = useState(false);
  const [result,       setResult]       = useState<NegotiationAnalysis | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await aiNegotiate({
        myMessage,
        listingId,
        offeredValue: offeredValue ? Number(offeredValue) : undefined,
      });
      setResult(res);
    } catch {
      showToast('Analiz yapılamadı', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto modal-overlay" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl my-8 modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>🤖</span> AI Negosiasyon Simülatörü
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {listingTitle ? `İlan: ${listingTitle}` : 'Mesajını analiz et — karşı tarafın muhtemel yanıtlarını gör'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Karşı tarafa göndereceğin mesaj
              </label>
              <textarea
                required
                rows={5}
                value={myMessage}
                onChange={(e) => setMyMessage(e.target.value)}
                placeholder="Örn: Merhaba, ilanınızı inceledim. Aracım için takas teklif etmek istiyorum, fark olarak 50.000 TL ödeyebilirim. Belgelerimiz tam, dilerseniz yerinde görüşelim."
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Teklif Değeri (opsiyonel)
              </label>
              <input
                type="number"
                value={offeredValue}
                onChange={(e) => setOfferedValue(e.target.value)}
                placeholder="Örn: 850000"
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={loading || myMessage.length < 5}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? 'Analiz ediliyor…' : <>✦ Analiz Et</>}
            </button>
          </form>

          {/* Sonuçlar */}
          {result && (
            <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-700">

              {/* Genel skor + ton */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-blue-600 p-4 text-white">
                  <div className="text-xs opacity-90 mb-1">Genel Skor</div>
                  <div className="text-3xl font-bold">{result.analysis.overallScore}<span className="text-base opacity-75">/100</span></div>
                  <div className="text-xs opacity-90 mt-1">{result.analysis.length.note}</div>
                </div>
                <div className={`rounded-2xl p-4 ${TONE_COLORS[result.analysis.tone].bg}`}>
                  <div className={`text-xs font-semibold ${TONE_COLORS[result.analysis.tone].text} mb-1`}>
                    {TONE_COLORS[result.analysis.tone].emoji} Ton: {result.analysis.tone.charAt(0).toUpperCase() + result.analysis.tone.slice(1)}
                  </div>
                  <div className={`text-xs ${TONE_COLORS[result.analysis.tone].text} opacity-90`}>{result.analysis.toneReason}</div>
                </div>
              </div>

              {/* Olumlu / olumsuz */}
              {(result.analysis.positives.length > 0 || result.analysis.negatives.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {result.analysis.positives.length > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3">
                      <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300 mb-2">✅ Güçlü yanlar</p>
                      <ul className="space-y-1">
                        {result.analysis.positives.map((p, i) => (
                          <li key={i} className="text-xs text-emerald-700 dark:text-emerald-300">• {p}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.analysis.negatives.length > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 rounded-xl p-3">
                      <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">⚠️ Zayıf yanlar</p>
                      <ul className="space-y-1">
                        {result.analysis.negatives.map((n, i) => (
                          <li key={i} className="text-xs text-red-700 dark:text-red-400">• {n}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Karşı tarafın olası yanıtları */}
              <div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">🎭 Karşı tarafın muhtemel yanıtları</p>
                <div className="space-y-2">
                  {result.possibilities.map((p, i) => (
                    <div key={i} className={`rounded-xl p-3 border ${POSSIBILITY_COLORS[p.type]}`}>
                      <div className="flex items-start justify-between gap-3 mb-1">
                        <span className="text-xs font-bold uppercase tracking-wide opacity-80">
                          {p.type === 'kabul' ? '✓ Kabul' : p.type === 'red' ? '✕ Red' : '🔄 Pazarlık'}
                        </span>
                        <span className="text-xs font-bold opacity-80">%{p.probability}</span>
                      </div>
                      <p className="text-sm font-medium italic text-slate-700 dark:text-slate-200">"{p.message}"</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">→ {p.reason}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tavsiyeler */}
              {result.tips.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-700 dark:text-blue-300 mb-2">💡 Tavsiyeler</p>
                  <ul className="space-y-1.5">
                    {result.tips.map((t, i) => (
                      <li key={i} className="text-xs text-blue-700 dark:text-blue-300">• {t}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
