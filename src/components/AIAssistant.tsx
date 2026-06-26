import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import type { AIMessage, AISuggestion } from '../types';
import { useAppStore } from '../store/useAppStore';
import { runSwapAI } from '../lib/swapAI';

// ─── Suggestion card ──────────────────────────────────────────────────────────

// Server response'da inline alanlar geliyor; fallback olarak store'daki listing de kullanılabilir
interface RichSuggestion extends AISuggestion {
  title?: string;
  estimatedValue?: number;
  city?: string;
  image?: string;
  ownerName?: string;
}

function SuggestionCard({ s, fallbackListing }: {
  s: RichSuggestion;
  fallbackListing: ReturnType<typeof useAppStore.getState>['listings'][0] | undefined;
}) {
  const title    = s.title            ?? fallbackListing?.title          ?? '—';
  const value    = s.estimatedValue   ?? fallbackListing?.estimatedValue ?? 0;
  const image    = s.image            ?? fallbackListing?.images[0]      ?? '';

  if (!title && !fallbackListing) return null;

  const fmt = (n: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

  const scoreColor =
    s.compatibilityScore >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : s.compatibilityScore >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-red-50 text-red-700 border-red-200';

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-3 shadow-sm">
      <div className="flex gap-3">
        {image && <img src={image} alt="" className="w-16 h-16 object-cover rounded-xl flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="text-xs font-semibold text-slate-800 line-clamp-1">{title}</p>
            <span className={`flex-shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full border ${scoreColor}`}>
              %{s.compatibilityScore}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-1.5">
            {fmt(value)}
            {s.priceDiff !== 0 && (
              <span className={s.priceDiff > 0 ? ' text-amber-600' : ' text-emerald-600'}>
                {' '}{s.priceDiff > 0 ? `+${fmt(s.priceDiff)}` : fmt(s.priceDiff)} fark
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {s.reasons.map((r, i) => (
              <span key={i} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-md font-medium">{r}</span>
            ))}
          </div>
          {s.negotiationTip && (
            <p className="text-[11px] text-slate-400 italic leading-relaxed">💡 {s.negotiationTip}</p>
          )}
          <Link to={`/listing/${s.listingId}`} className="inline-flex items-center gap-0.5 text-xs font-semibold text-blue-600 hover:text-blue-700 mt-1.5">
            İlana Git <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Message renderer ─────────────────────────────────────────────────────────

/** Basit markdown: **bold** destekler, satır başı `-` veya `1.` liste işaretleri temizlenir */
function renderLine(line: string, lineKey: number) {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let keyIdx = 0;

  while (remaining.length > 0) {
    const boldStart = remaining.indexOf('**');
    if (boldStart === -1) {
      parts.push(<span key={keyIdx++}>{remaining}</span>);
      break;
    }
    // text before **
    if (boldStart > 0) {
      parts.push(<span key={keyIdx++}>{remaining.slice(0, boldStart)}</span>);
    }
    const boldEnd = remaining.indexOf('**', boldStart + 2);
    if (boldEnd === -1) {
      // unclosed **, render literally
      parts.push(<span key={keyIdx++}>{remaining.slice(boldStart)}</span>);
      break;
    }
    parts.push(
      <strong key={keyIdx++} className="font-semibold">
        {remaining.slice(boldStart + 2, boldEnd)}
      </strong>
    );
    remaining = remaining.slice(boldEnd + 2);
  }

  return (
    <p key={lineKey} className={lineKey > 0 ? 'mt-1' : ''}>
      {parts}
    </p>
  );
}

function MessageText({ content }: { content: string }) {
  return <>{content.split('\n').map((line, i) => renderLine(line, i))}</>;
}

// ─── Dynamic quick actions ───────────────────────────────────────────────────

function buildListingQuickActions(listing: ReturnType<typeof useAppStore.getState>['listings'][0]): string[] {
  const v = listing.vehicleDetails;
  const actions: string[] = [];

  // 1. Her zaman: bu ilan için en iyi eşleşmeler
  actions.push(`${v?.brand ?? listing.title} için en uygun takasları bul`);

  // 2. Yakıt tipine göre alternatif öneri
  if (v?.fuel === 'Dizel') {
    actions.push('Hibrit veya benzinli alternatifler var mı?');
  } else if (v?.fuel === 'Benzin') {
    actions.push('Dizel veya hibrit alternatifler göster');
  } else if (v?.fuel === 'Hibrit' || v?.fuel === 'Elektrik') {
    actions.push('Benzer hibrit/elektrik ilanlar var mı?');
  } else {
    actions.push('Farklı yakıt tipinde alternatifler?');
  }

  // 3. Km durumuna göre
  if (v?.km !== undefined) {
    if (v.km > 150_000) {
      actions.push('Daha düşük kilometreli seçenekler?');
    } else if (v.km < 50_000) {
      actions.push('Aynı km aralığında başka ne var?');
    } else {
      actions.push('Daha az km\'li araçları göster');
    }
  } else {
    actions.push('Daha az km\'li araçları göster');
  }

  // 4. Hasar kaydı / fiyat / wantedFor'a göre
  if (v?.hasAccidentRecord) {
    actions.push('Hasarsız ve yakın fiyatlı alternatifler?');
  } else if (listing.wantedFor && listing.wantedFor.length > 5) {
    // wantedFor'dan ilk kelime grubunu al (max 4 kelime)
    const want = listing.wantedFor.split(/[\s,،]+/).slice(0, 3).join(' ');
    actions.push(`"${want}" isteğine uygun ilanlar?`);
  } else {
    actions.push('Pazarlık için müzakere taktikleri?');
  }

  return actions.slice(0, 4);
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AIAssistant() {
  const {
    aiPanelOpen, aiPanelListingId, aiMessages,
    addAIMessage, clearAIMessages, closeAIPanel, listings,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const currentListing = aiPanelListingId ? listings.find(l => l.id === aiPanelListingId) : null;

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages, loading]);

  // Welcome message
  useEffect(() => {
    if (!aiPanelOpen || aiMessages.length > 0) return;
    const msg: AIMessage = {
      role: 'assistant',
      content: currentListing
        ? `**${currentListing.title}** ilanındasın. Ne öğrenmek istiyorsun?\n\nTakas seçeneklerini bulabilirim, fiyat değerlendirmesi yapabilirim ya da pazarlık için ne söylemen gerektiğini anlatabilirim.`
        : `Merhaba! Ben TakaslAI. Takas bulmana, fiyat karşılaştırmasına ya da pazarlık tüyolarına yardımcı olabilirim.\n\nMesela şunu yazabilirsin:\n- "Toyota Corolla arıyorum"\n- "Daha ucuz var mı?"\n- "BMW alınır mı?"\n- "Nasıl pazarlık yapayım?"`,
    };
    addAIMessage(msg);
  }, [aiPanelOpen]);

  const quickActions = currentListing
    ? buildListingQuickActions(currentListing)
    : [
        'En iyi eşleşmeleri bul',
        'Müzakere taktikleri neler?',
        'Fiyat analizi yap',
        'Hasarsız ilanları göster',
      ];

  const sendMessage = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;

    const userMsg: AIMessage = { role: 'user', content: text };
    addAIMessage(userMsg);
    setInput('');
    setLoading(true);

    try {
      // ── Yerel skorlama motoru: store'daki gerçek ilanlar üzerinde çalışır ──
      // (Backend yok; tüm AI mantığı tarayıcıda runSwapAI ile hesaplanır)
      await new Promise(r => setTimeout(r, 500));
      const result = runSwapAI({
        currentListing: currentListing ?? null,
        allListings:    listings,
        userQuery:      text,
      });
      addAIMessage({
        role:        'assistant',
        content:     result.message,
        suggestions: result.suggestions,
      });
    } catch {
      addAIMessage({ role: 'assistant', content: 'Bir hata oluştu, lütfen tekrar deneyin.' });
    } finally {
      setLoading(false);
    }
  };

  if (!aiPanelOpen) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 md:hidden" onClick={closeAIPanel} />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[420px] bg-slate-50 z-50 flex flex-col shadow-2xl border-l border-slate-200">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-[#1B4FD8] to-[#2563eb] px-4 py-3.5 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-white text-base">✦</div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">TakaslAI</p>
              <p className="text-blue-200 text-[11px]">Akıllı Takas Asistanı</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => clearAIMessages()}
              title="Sohbeti temizle"
              className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
            <button onClick={closeAIPanel}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Context listing ── */}
        {currentListing && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2.5 flex items-center gap-3 flex-shrink-0">
            <img src={currentListing.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-700 truncate">{currentListing.title}</p>
              <p className="text-[11px] text-blue-500">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(currentListing.estimatedValue)}
                {' · '}{currentListing.city}
              </p>
            </div>
          </div>
        )}

        {/* ── Messages ── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {aiMessages.map((msg, i) => (
            <div key={i}>
              <div className={`flex items-end gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs flex-shrink-0 mb-0.5">✦</div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white text-slate-700 rounded-bl-sm shadow-sm border border-slate-100'
                }`}>
                  <MessageText content={msg.content} />
                </div>
              </div>

              {/* Suggestion cards */}
              {msg.suggestions && msg.suggestions.length > 0 && (
                <div className="ml-9 mt-3 space-y-2">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    {msg.suggestions.length} eşleşme bulundu
                  </p>
                  {(msg.suggestions as RichSuggestion[]).map(s => (
                    <SuggestionCard
                      key={s.listingId}
                      s={s}
                      fallbackListing={listings.find(l => l.id === s.listingId)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex items-end gap-2">
              <div className="w-7 h-7 rounded-xl bg-blue-600 flex items-center justify-center text-white text-xs flex-shrink-0">✦</div>
              <div className="bg-white border border-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1.5 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dot-1" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dot-2" />
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400 dot-3" />
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ── Quick actions ── */}
        {aiMessages.length <= 1 && (
          <div className="px-4 pb-3 flex-shrink-0">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Hızlı Başlat</p>
            <div className="space-y-1.5">
              {quickActions.map(a => (
                <button
                  key={a}
                  disabled={loading}
                  onClick={() => sendMessage(a)}
                  className="w-full text-left text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-100 px-3 py-2 rounded-xl transition-colors disabled:opacity-50 leading-relaxed"
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Input ── */}
        <div className="border-t border-slate-200 bg-white px-4 py-3 flex-shrink-0">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Soru veya talep yazın..."
              disabled={loading}
              className="flex-1 text-sm bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 placeholder-slate-400"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-slate-400 text-center mt-2">
            ✦ TakaslAI
          </p>
        </div>
      </div>
    </>
  );
}
