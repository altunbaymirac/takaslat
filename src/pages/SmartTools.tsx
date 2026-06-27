import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import {
  aiAutoMessage,
  aiBudget,
  aiConversationCoach,
  aiListingQuality,
  aiMarketInsights,
  aiOfferQuality,
  aiPersonalFeed,
  aiPriceGap,
  aiRisk,
  aiScenarios,
  aiSwapAdvice,
  aiSwapScore,
  aiErrorMessage,
  fetchDeals,
  type BudgetResult,
  type Deal,
  type SwapAdvice,
} from '../services/api';
import { showToast } from '../components/Toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

type AIResult = {
  title: string;
  data: Record<string, unknown>;
};

function scoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  if (score >= 55) return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
}

function ResultPanel({ result }: { result: AIResult | null }) {
  if (!result) return null;
  const data = result.data;
  const list =
    (data.suggestions as Array<Record<string, unknown>> | undefined) ??
    (data.candidates as Array<Record<string, unknown>> | undefined) ??
    (data.items as Array<Record<string, unknown>> | undefined);
  const scenarios = data.scenarios as Array<Record<string, unknown>> | undefined;
  const tips = data.tips as string[] | undefined;
  const risks = data.risks as string[] | undefined;
  const positives = data.positives as string[] | undefined;
  const fixes = data.fixes as string[] | undefined;
  const replies = data.replies as string[] | undefined;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-5 shadow-sm dark:border-blue-900/40 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{result.title}</h2>
        {'score' in data && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreColor(Number(data.score))}`}>
            %{String(data.score)}
          </span>
        )}
        {'riskScore' in data && (
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${scoreColor(100 - Number(data.riskScore))}`}>
            Risk %{String(data.riskScore)}
          </span>
        )}
      </div>

      {typeof data.message === 'string' && (
        <p className="mb-3 rounded-xl bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-100">
          {data.message}
        </p>
      )}
      {typeof data.explanation === 'string' && (
        <p className="mb-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {data.explanation}
        </p>
      )}
      {typeof data.suggestedMessage === 'string' && (
        <div className="mb-3 rounded-xl border border-slate-100 p-3 dark:border-slate-700">
          <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">Önerilen mesaj</p>
          <p className="text-sm text-slate-800 dark:text-slate-100">{data.suggestedMessage}</p>
        </div>
      )}
      {typeof data.improvedMessage === 'string' && (
        <div className="mb-3 rounded-xl border border-slate-100 p-3 dark:border-slate-700">
          <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">İyileştirilmiş teklif</p>
          <p className="text-sm text-slate-800 dark:text-slate-100">{data.improvedMessage}</p>
        </div>
      )}
      {typeof data.improvedDescription === 'string' && (
        <div className="mb-3 rounded-xl border border-slate-100 p-3 dark:border-slate-700">
          <p className="mb-1 text-xs font-bold text-slate-500 dark:text-slate-400">İyileştirilmiş açıklama</p>
          <p className="text-sm text-slate-800 dark:text-slate-100">{data.improvedDescription}</p>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          {list.map((item, i) => {
            const id = String(item.listingId ?? item.id ?? '');
            const score = Number(item.compatibilityScore ?? item.score ?? 0);
            return (
              <Link
                key={`${id}-${i}`}
                to={id ? `/listing/${id}` : '#'}
                className="rounded-xl border border-slate-100 p-3 hover:border-blue-300 dark:border-slate-700"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-900 dark:text-slate-100">
                      {String(item.title ?? 'İlan')}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {String(item.city ?? '')} {item.value ? `· ${fmt(Number(item.value))}` : ''}
                    </p>
                  </div>
                  {score > 0 && <span className={`rounded-full px-2 py-1 text-xs font-bold ${scoreColor(score)}`}>%{score}</span>}
                </div>
                {Array.isArray(item.reasons) && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{item.reasons.slice(0, 2).join(' · ')}</p>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {scenarios && scenarios.length > 0 && (
        <div className="mb-3 grid gap-2 md:grid-cols-3">
          {scenarios.map((s, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-3 dark:border-slate-700">
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{String(s.name)}</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{String(s.bestFor)}</p>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{String(s.plan)}</p>
            </div>
          ))}
        </div>
      )}

      {[tips, risks, positives, fixes, replies].filter(Boolean).map((arr, idx) => (
        <div key={idx} className="mb-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900">
          {arr!.map((x) => (
            <p key={x} className="text-xs text-slate-600 dark:text-slate-300">• {x}</p>
          ))}
        </div>
      ))}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 dark:text-slate-400">Ham AI çıktısı</summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </section>
  );
}

export default function SmartTools() {
  useSEO({ title: 'Akıllı Araçlar', description: 'AI destekli fiyat tahmini, mesaj asistanı ve kişisel öneriler.' });

  const { listings, favorites, searchHistory, wishlist } = useAppStore();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [dealsLoading, setDealsLoading] = useState(true);

  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [aiText, setAiText] = useState('2020 Civic aracım var, SUV takas istiyorum. 100 bin TL fark verebilirim.');
  const [cashDiff, setCashDiff] = useState('100000');
  const [result, setResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const [budget, setBudget] = useState('');
  const [budgetCat, setBudgetCat] = useState<string>('');
  const [budgetCity, setBudgetCity] = useState('');
  const [budgetResult, setBudgetResult] = useState<BudgetResult | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(false);
  const [advice, setAdvice] = useState<SwapAdvice | null>(null);

  const sortedListings = useMemo(
    () => [...listings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 80),
    [listings]
  );
  const source = listings.find((l) => l.id === sourceId);
  const target = listings.find((l) => l.id === targetId);

  useEffect(() => {
    fetchDeals()
      .then((r) => setDeals(r.deals))
      .catch(() => showToast('Fırsatlar yüklenemedi', 'error'))
      .finally(() => setDealsLoading(false));
  }, []);

  async function runAI(title: string, fn: () => Promise<Record<string, unknown>>) {
    setAiLoading(true);
    try {
      setResult({ title, data: await fn() });
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleBudget(e: FormEvent) {
    e.preventDefault();
    if (!budget) return;
    setBudgetLoading(true);
    try {
      const res = await aiBudget({
        budget: Number(budget),
        category: budgetCat || undefined,
        city: budgetCity || undefined,
      });
      setBudgetResult(res);
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setBudgetLoading(false);
    }
  }

  async function runAdvice() {
    await runAI('AI Takas Danışmanı', async () => {
      const res = await aiSwapAdvice({ listingId: sourceId || undefined, userText: aiText });
      setAdvice(res);
      return res as unknown as Record<string, unknown>;
    });
  }

  const wishlistTerms = wishlist.map((w) => [w.name, w.brand, w.model, w.city].filter(Boolean).join(' '));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-slate-100">
          <span>✦</span> Akıllı Araçlar
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Platformdaki gerçek ilanları analiz eder; takas skoru, risk, fiyat farkı, kişisel öneri ve pazarlık desteği sunar.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-4 text-base font-bold text-slate-900 dark:text-slate-100">AI Kontrol Masası</h2>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Kaynak ilan</label>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Seçiniz</option>
                {sortedListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Hedef ilan</label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              >
                <option value="">Seçiniz</option>
                {sortedListings.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">AI metni / son mesaj / hedef</label>
              <textarea
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">Maksimum nakit fark</label>
              <input
                value={cashDiff}
                onChange={(e) => setCashDiff(e.target.value)}
                type="number"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button disabled={!sourceId || aiLoading} onClick={() => runAI('Gerçek Takas Skoru', () => aiSwapScore({ sourceListingId: sourceId, targetListingId: targetId || undefined }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Takas Skoru</button>
            <button disabled={(!sourceId && !source) || (!targetId && !target) || aiLoading} onClick={() => runAI('Fiyat Farkı Analizi', () => aiPriceGap({ sourceListingId: sourceId || undefined, targetListingId: targetId || undefined }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Fiyat Farkı</button>
            <button disabled={!targetId || aiLoading} onClick={() => runAI('Güven / Risk Analizi', () => aiRisk({ listingId: targetId }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Risk</button>
            <button disabled={!(targetId || sourceId) || aiLoading} onClick={() => runAI('İlan Kalitesi Skoru', () => aiListingQuality({ listingId: targetId || sourceId }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-slate-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">İlan Kalitesi</button>
            <button disabled={!targetId || aiLoading} onClick={() => runAI('Otomatik Takas Mesajı', () => aiAutoMessage({ sourceListingId: sourceId || undefined, targetListingId: targetId }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Mesaj Yaz</button>
            <button disabled={!aiText.trim() || aiLoading} onClick={() => runAI('Teklif Kalitesi Analizi', () => aiOfferQuality({ message: aiText, listingId: targetId || undefined, offeredListingId: sourceId || undefined }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Teklif Analizi</button>
            <button disabled={!aiText.trim() || aiLoading} onClick={() => runAI('AI Görüşme Koçu', () => aiConversationCoach({ lastMessage: aiText, listingId: targetId || undefined }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Görüşme Koçu</button>
            <button disabled={aiLoading} onClick={() => runAI('Kişisel AI Feed', () => aiPersonalFeed({ favoriteIds: favorites, searchHistory, wishlistTerms }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Kişisel Feed</button>
            <button disabled={aiLoading} onClick={() => runAI('Pazar Analizi', () => aiMarketInsights() as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Pazar</button>
            <button disabled={!aiText.trim() || aiLoading} onClick={() => runAI('AI Takas Senaryoları', () => aiScenarios({ sourceListingId: sourceId || undefined, targetText: aiText, maxCashDiff: Number(cashDiff) || undefined }) as unknown as Promise<Record<string, unknown>>)} className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Senaryo</button>
          </div>

          <button
            onClick={runAdvice}
            disabled={!aiText.trim() || aiLoading}
            className="mt-3 w-full rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300"
          >
            {aiLoading ? 'AI çalışıyor...' : 'Genel Takas Danışmanı'}
          </button>

          {(source || target) && (
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {source && <p><strong>Kaynak:</strong> {source.title} · {fmt(source.estimatedValue)}</p>}
              {target && <p><strong>Hedef:</strong> {target.title} · {fmt(target.estimatedValue)}</p>}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <ResultPanel result={result} />

          {advice && !result && (
            <ResultPanel result={{ title: 'AI Takas Danışmanı', data: advice as unknown as Record<string, unknown> }} />
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Fırsat İlanları</h2>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Benzer ilan ortalamasından ucuz olanlar</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                  {deals.length}
                </span>
              </div>
              {dealsLoading ? (
                <div className="py-8 text-center text-sm text-slate-400">Yükleniyor...</div>
              ) : deals.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-500">Şu an fırsat ilanı yok.</div>
              ) : (
                <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
                  {deals.map((d) => (
                    <Link key={d.listingId} to={`/listing/${d.listingId}`} className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5 hover:border-emerald-300 dark:border-slate-700">
                      <img src={d.image} alt="" className="h-14 w-14 flex-shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{d.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{d.city}</p>
                        <p className="mt-1 text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmt(d.price)}</p>
                      </div>
                      <div className="rounded-lg bg-emerald-600 px-2 py-1 text-xs font-bold text-white">-%{d.savingPct}</div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-1 text-base font-bold text-slate-900 dark:text-slate-100">Bütçe Asistanı</h2>
              <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">Bütçene göre platformdaki uygun ilanları bulur.</p>
              <form onSubmit={handleBudget} className="mb-4 space-y-3">
                <input
                  type="number"
                  required
                  min={1000}
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="500000"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select value={budgetCat} onChange={(e) => setBudgetCat(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
                    <option value="">Hepsi</option>
                    <option>Araç</option>
                    <option>Elektronik</option>
                    <option>Gayrimenkul</option>
                    <option>Diğer</option>
                  </select>
                  <input value={budgetCity} onChange={(e) => setBudgetCity(e.target.value)} placeholder="Şehir" className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                </div>
                <button type="submit" disabled={budgetLoading || !budget} className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
                  {budgetLoading ? 'Hesaplanıyor...' : 'Analiz Et'}
                </button>
              </form>
              {budgetResult && (
                <div className="space-y-2 border-t border-slate-100 pt-4 dark:border-slate-700">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-emerald-50 p-3 text-center dark:bg-emerald-900/20">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Bütçe içinde</p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">{budgetResult.inBudgetCount}</p>
                    </div>
                    <div className="rounded-xl bg-amber-50 p-3 text-center dark:bg-amber-900/20">
                      <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">+%10 esnek</p>
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{budgetResult.stretchCount}</p>
                    </div>
                  </div>
                  <div className="max-h-72 space-y-2 overflow-y-auto">
                    {budgetResult.inBudget.map((l) => (
                      <Link key={l.listingId} to={`/listing/${l.listingId}`} className="flex items-center gap-3 rounded-lg border border-slate-100 p-2 dark:border-slate-700">
                        <img src={l.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{l.title}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{fmt(l.price)} · {l.city}</p>
                        </div>
                        <span className="text-xs font-bold text-blue-600 dark:text-blue-300">%{l.utilization}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
