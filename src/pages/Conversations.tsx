import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import type { SwapOffer, OfferStatus } from '../types';
import RatingModal from '../components/RatingModal';
import NegotiationSimulator from '../components/NegotiationSimulator';
import MeetingScheduler from '../components/MeetingScheduler';
import { aiConversationCoach, aiErrorMessage, confirmOfferComplete, subscribeNotificationStream, type RawMessageEvent, type OfferStatusEvent } from '../services/api';
import { showToast } from '../components/Toast';

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS: Record<OfferStatus, { label: string; dot: string; badge: string }> = {
  Beklemede:    { label: 'Beklemede',    dot: 'bg-amber-400',  badge: 'bg-amber-50  text-amber-700  border-amber-200'  },
  Görüşülüyor:  { label: 'Görüşülüyor',  dot: 'bg-blue-500',   badge: 'bg-blue-50   text-blue-700   border-blue-200'   },
  Onaylandı:    { label: 'Onaylandı',    dot: 'bg-violet-500', badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  Tamamlandı:   { label: 'Tamamlandı',   dot: 'bg-emerald-500',badge: 'bg-emerald-50 text-emerald-700 border-emerald-200'},
  Reddedildi:   { label: 'Reddedildi',   dot: 'bg-red-400',    badge: 'bg-red-50    text-red-700    border-red-200'    },
};

function fmt(n: number) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Az önce';
  if (m < 60) return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
}

// ─── Conversation list item ───────────────────────────────────────────────────

function ConvItem({
  offer, isActive, isIncoming, onClick,
}: {
  offer: SwapOffer;
  isActive: boolean;
  isIncoming: boolean;
  onClick: () => void;
}) {
  const st = STATUS[offer.status];
  const lastMsg = offer.messages?.[offer.messages.length - 1];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
        isActive ? 'bg-blue-50 border-l-2 border-l-blue-600' : ''
      }`}
    >
      <div className="flex items-start gap-3">
        {/* avatar placeholder */}
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 mt-0.5">
          {(isIncoming ? offer.fromUserName : 'S')[0]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
              {isIncoming ? offer.fromUserName : offer.listingTitle}
            </p>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 flex-shrink-0">{timeAgo(offer.createdAt)}</span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500 truncate">
            {lastMsg ? lastMsg.text : offer.message}
          </p>

          <div className="flex items-center gap-2 mt-1.5">
            <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${st.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
              {st.label}
            </span>
            {isIncoming && (
              <span className="text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Gelen</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

function ChatPanel({ offer, isIncoming, onBack }: { offer: SwapOffer; isIncoming: boolean; onBack?: () => void }) {
  const {
    updateOfferStatus,
    addOfferMessage,
    loadOffers,
    currentUserId,
    listings,
    isMuted,
    toggleMuteOffer,
    conversationNotes,
    setConversationNote,
    reviseOffer,
  } = useAppStore();
  const [ratingOpen, setRatingOpen] = useState(false);
  const [aiNegOpen,  setAiNegOpen]  = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionValue, setRevisionValue] = useState(offer.offeredValue?.toString() ?? '');
  const [revisionListingId, setRevisionListingId] = useState(offer.offeredListingId ?? '');
  const [coachLoading, setCoachLoading] = useState(false);
  const [coachReplies, setCoachReplies] = useState<string[]>([]);
  const [coachNote, setCoachNote] = useState<string | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  // Optimistic: track if current user already clicked confirm this session
  const [localConfirmed, setLocalConfirmed] = useState(false);
  // Sekme: Sohbet (mesajlaşma) | Teklif (özet, yol haritası, aksiyonlar)
  const [chatTab, setChatTab] = useState<'sohbet' | 'teklif'>('sohbet');

  // Server-side "already rated" flags take priority, fall back to optimistic local check
  const alreadyRated = isIncoming ? !!offer.toRated : !!offer.fromRated;

  async function handleConfirmComplete() {
    if (confirmLoading || localConfirmed) return;
    setConfirmLoading(true);
    try {
      const result = await confirmOfferComplete(offer.id);
      setLocalConfirmed(true);
      if (result.status === 'Tamamlandı') {
        updateOfferStatus(offer.id, 'Tamamlandı');
        showToast('🎉 Takas tamamlandı!', 'success');
        setTimeout(() => setRatingOpen(true), 400);
      } else {
        showToast('Onayınız alındı, karşı tarafın onayı bekleniyor', 'info');
      }
      // Refresh offers to get updated fromConfirmed/toConfirmed
      void loadOffers();
    } catch {
      showToast('Onay gönderilemedi, tekrar deneyin', 'error');
      setLocalConfirmed(false);
    } finally {
      setConfirmLoading(false);
    }
  }
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const st = STATUS[offer.status];

  const relatedListing = listings.find(l => l.id === offer.listingId);
  const myListings = listings.filter(l => l.ownerId === currentUserId);
  const selectedRevisionListing = myListings.find(l => l.id === revisionListingId);

  // ── Real-time: listen for incoming messages & status changes via SSE ──
  useEffect(() => {
    const stop = subscribeNotificationStream(
      () => undefined,                                        // notifications handled in App.tsx
      (evt: RawMessageEvent) => {
        if (evt.offerId !== offer.id) return;
        if (evt.fromUserId === currentUserId) return;       // own message, already in store
        addOfferMessage(offer.id, evt.text, evt.fromUserId);
      },
      (evt: OfferStatusEvent) => {
        if (evt.offerId !== offer.id) return;
        void loadOffers();
      },
    );
    return stop;
  }, [offer.id, currentUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [offer.messages]);

  useEffect(() => {
    setRevisionValue(offer.offeredValue?.toString() ?? '');
    setRevisionListingId(offer.offeredListingId ?? '');
    setRevisionOpen(false);
  }, [offer.id, offer.offeredListingId, offer.offeredValue]);

  const send = () => {
    if (!text.trim()) return;
    addOfferMessage(offer.id, text.trim(), currentUserId);
    setCoachReplies([]);
    setCoachNote(null);
    setText('');
  };

  function submitRevision(e: React.FormEvent) {
    e.preventDefault();
    const value = Number(revisionValue);
    if (!value && !selectedRevisionListing) {
      showToast('Revizyon için değer veya teklif edilecek ilan seçin', 'error');
      return;
    }
    reviseOffer(offer.id, {
      offeredValue: value || selectedRevisionListing?.estimatedValue,
      offeredListingId: selectedRevisionListing?.id,
      offeredListingTitle: selectedRevisionListing?.title,
    });
    setRevisionOpen(false);
    showToast('Teklif revize edildi', 'success');
  }

  // Build a unified message thread: first message = the original offer message
  const thread = [
    { id: 'initial', fromUserId: offer.fromUserId, text: offer.message, createdAt: offer.createdAt },
    ...(offer.messages ?? []),
  ];
  const otherUserId = isIncoming ? offer.fromUserId : offer.toUserId;
  const revisionMessages = thread.filter((msg) => msg.text.toLocaleLowerCase('tr-TR').includes('teklif revize edildi'));
  const cashDiff = relatedListing && offer.offeredValue
    ? offer.offeredValue - relatedListing.estimatedValue
    : null;
  const roadmap = [
    { label: 'Teklif gönderildi', done: true },
    { label: 'Görüşme başladı',   done: offer.status !== 'Beklemede' },
    { label: 'Teklif onaylandı',  done: offer.status === 'Onaylandı' || offer.status === 'Tamamlandı' },
    { label: 'Takas tamamlandı',  done: offer.status === 'Tamamlandı' },
  ];

  async function askCoach() {
    // Karşı tarafın SON mesajı — benim taslağım/kendi mesajım değil
    const lastFromOther = [...thread].reverse().find((m) => m.fromUserId === otherUserId);
    const lastMessage = lastFromOther?.text;
    if (!lastMessage) {
      setCoachReplies([]);
      setCoachNote(null);
      showToast('Karşı taraftan henüz mesaj yok — koç için önce yanıt bekle', 'info');
      return;
    }

    setCoachLoading(true);
    try {
      const res = await aiConversationCoach({
        lastMessage,
        listingId: offer.listingId,
      });
      setCoachReplies(res.replies);
      setCoachNote(`${res.intent} · ${res.nextBestAction}`);
      showToast('AI cevap önerileri hazır', 'success');
    } catch (err) {
      showToast(aiErrorMessage(err), 'error');
    } finally {
      setCoachLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {onBack && (
            <button
              onClick={onBack}
              className="sm:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              aria-label="Geri"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base truncate">{offer.listingTitle}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {isIncoming ? `Gönderen: ${offer.fromUserName}` : 'Gönderilen teklif'}
              {offer.offeredValue && <span className="ml-2 font-semibold text-blue-600">{fmt(offer.offeredValue)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => toggleMuteOffer(offer.id)}
            title={isMuted(offer.id) ? 'Sesi aç' : 'Sessize al'}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isMuted(offer.id)
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {isMuted(offer.id) ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15zM17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => setMeetingOpen(true)}
            title="Buluşma planla"
            className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 px-2.5 py-1.5 rounded-full transition-colors flex items-center gap-1"
          >
            <span>📅</span>
            <span className="hidden sm:inline">Buluşma</span>
          </button>
          <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border ${st.badge}`}>
            <span className={`w-2 h-2 rounded-full ${st.dot}`} />
            {st.label}
          </span>
        </div>
      </div>

      {/* ── Sekmeler: Sohbet | Teklif ── */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
        {([['sohbet', 'Sohbet'], ['teklif', 'Teklif']] as const).map(([key, label]) => {
          const needsAttention = key === 'teklif' && (
            (offer.status === 'Beklemede' && isIncoming) ||
            offer.status === 'Görüşülüyor' ||
            (offer.status === 'Onaylandı' && !localConfirmed)
          );
          return (
            <button
              key={key}
              onClick={() => setChatTab(key)}
              className={`relative flex-1 py-2.5 text-sm font-semibold transition-colors ${
                chatTab === key ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
              }`}
            >
              {label}
              {needsAttention && <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-amber-400 align-middle" />}
              {chatTab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
            </button>
          );
        })}
      </div>

      {/* ── Related listing card (Teklif sekmesi) ── */}
      {chatTab === 'teklif' && relatedListing && (
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200">
          <Link to={`/listing/${relatedListing.id}`} className="flex items-center gap-3 group">
            <img src={relatedListing.images?.[0] ?? 'https://picsum.photos/seed/listing/100/100'} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-700 group-hover:text-blue-600 transition-colors truncate">
                {relatedListing.title}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 dark:text-slate-500">{fmt(relatedListing.estimatedValue)} · {relatedListing.city}</p>
            </div>
            <svg className="w-4 h-4 text-slate-300 group-hover:text-blue-500 ml-auto flex-shrink-0 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      )}

      {chatTab === 'teklif' && (
      <div className="flex-1 overflow-y-auto border-b border-slate-200 bg-white px-5 py-3 dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Teklif Özeti</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {offer.offeredListingTitle ?? 'İlan seçilmemiş'}
              {offer.offeredValue && <span className="ml-2 text-blue-600 dark:text-blue-300">{fmt(offer.offeredValue)}</span>}
            </p>
          </div>
          {offer.status !== 'Tamamlandı' && offer.status !== 'Reddedildi' && (
            <button
              type="button"
              onClick={() => setRevisionOpen(true)}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300"
            >
              Teklifi Revize Et
            </button>
          )}
        </div>

        <details className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
          <summary className="cursor-pointer text-xs font-semibold text-slate-600 dark:text-slate-300">Özel görüşme notları</summary>
          <textarea
            value={conversationNotes[offer.id] ?? ''}
            onChange={(e) => setConversationNote(offer.id, e.target.value)}
            rows={3}
            placeholder="Karşı tarafın beklentisi, anlaşılan nakit fark, buluşma detayı..."
            className="mt-2 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
        </details>

        <details className="mt-3 group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400">
            <svg className="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Yol haritası ve anlaşma özeti
            <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
              {STATUS[offer.status].label}
            </span>
          </summary>
          <div className="mt-2 grid gap-2 md:grid-cols-[1fr_220px]">
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
              <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">Takas Yol Haritası</p>
              <div className="grid gap-2 sm:grid-cols-4">
                {roadmap.map((step, index) => (
                  <div key={step.label} className="flex items-center gap-2 text-xs">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${
                      step.done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {index + 1}
                    </span>
                    <span className={step.done ? 'font-semibold text-slate-700 dark:text-slate-200' : 'text-slate-400'}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs dark:border-blue-900/40 dark:bg-blue-900/10">
              <p className="font-bold text-blue-900 dark:text-blue-200">Anlaşma özeti</p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                {revisionMessages.length} revizyon · {cashDiff === null ? 'fark belirsiz' : cashDiff >= 0 ? `${fmt(cashDiff)} teklif fazla` : `${fmt(Math.abs(cashDiff))} karşı ilan fazla`}
              </p>
              <p className="mt-1 text-blue-700 dark:text-blue-300">
                Durum: {STATUS[offer.status].label}
              </p>
            </div>
          </div>
        </details>
      </div>
      )}

      {/* ── Messages (Sohbet sekmesi) ── */}
      {chatTab === 'sohbet' && (
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 bg-slate-50 dark:bg-slate-900">
        {thread.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center px-6">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-2xl">💬</div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Henüz mesaj yok</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Aşağıdaki kutudan ilk mesajını yazarak görüşmeyi başlat.</p>
          </div>
        )}
        {thread.map((msg) => {
          const isMine = msg.fromUserId === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                isMine
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-bl-sm shadow-sm border border-slate-100 dark:border-slate-600'
              }`}>
                <p>{msg.text}</p>
                <p className={`text-[10px] mt-1 ${isMine ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>
                  {timeAgo(msg.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      )}

      {/* ── Status actions (Teklif sekmesi) ── */}
      {chatTab === 'teklif' && offer.status !== 'Tamamlandı' && offer.status !== 'Reddedildi' && (
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">

          {/* Beklemede — yalnızca ilan sahibi (isIncoming) yanıtlar */}
          {offer.status === 'Beklemede' && isIncoming && (
            <>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Teklifi yanıtla:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => updateOfferStatus(offer.id, 'Görüşülüyor')}
                  className="flex-1 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 py-2 rounded-xl transition-colors"
                >
                  💬 Görüşmeye Başla
                </button>
                <button
                  onClick={() => updateOfferStatus(offer.id, 'Reddedildi')}
                  className="flex-1 text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 rounded-xl transition-colors"
                >
                  ✕ Reddet
                </button>
              </div>
            </>
          )}

          {/* Beklemede — teklifi gönderen kişi bekliyor */}
          {offer.status === 'Beklemede' && !isIncoming && (
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 py-1">
              ⏳ Teklif yanıtı bekleniyor…
            </p>
          )}

          {/* Görüşülüyor — her iki taraf onaylayabilir */}
          {offer.status === 'Görüşülüyor' && (
            <>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Teklifi resmileştir:</p>
              <div className="flex gap-2">
                <button
                  onClick={() => updateOfferStatus(offer.id, 'Onaylandı')}
                  className="flex-1 text-xs font-semibold bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 py-2 rounded-xl transition-colors"
                >
                  ✓ Her İki Taraf Anlaştı — Onayla
                </button>
                <button
                  onClick={() => updateOfferStatus(offer.id, 'Reddedildi')}
                  className="text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 px-3 rounded-xl transition-colors"
                >
                  ✕
                </button>
              </div>
            </>
          )}

          {/* Onaylandı — çift onay ile tamamla */}
          {offer.status === 'Onaylandı' && (
            <>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                Her iki taraf da onayladığında takas tamamlanır:
              </p>
              <div className="flex gap-2 mb-2.5">
                <div className={`flex-1 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  offer.fromConfirmed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900'
                }`}>
                  <span>{offer.fromConfirmed ? '✓' : '○'}</span>
                  <span>{isIncoming ? 'Teklif sahibi' : 'Sen'}</span>
                </div>
                <div className={`flex-1 flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold ${
                  offer.toConfirmed
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-900'
                }`}>
                  <span>{offer.toConfirmed ? '✓' : '○'}</span>
                  <span>{isIncoming ? 'Sen' : 'Karşı taraf'}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {localConfirmed ? (
                  <div className="flex-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 py-2.5 rounded-xl text-center dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800">
                    ✓ Onayınız alındı — karşı taraf bekleniyor
                  </div>
                ) : (
                  <button
                    disabled={confirmLoading}
                    onClick={handleConfirmComplete}
                    className="flex-1 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {confirmLoading ? '…' : '🤝 Takas Tamamlandı — Onayla'}
                  </button>
                )}
                <button
                  onClick={() => updateOfferStatus(offer.id, 'Reddedildi')}
                  className="text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-2 px-3 rounded-xl transition-colors"
                  title="İptal et"
                >
                  ✕
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Hızlı yanıt şablonları (Sohbet sekmesi) ── */}
      {chatTab === 'sohbet' && offer.status !== 'Tamamlandı' && offer.status !== 'Reddedildi' && (
        <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex gap-1.5 overflow-x-auto">
          {[
            { icon: '👋', text: 'Merhaba, ilanınızla ilgileniyorum.' },
            { icon: '💰', text: 'Fiyat konusunda esnek misiniz?' },
            { icon: '📅', text: 'Ne zaman görüşebiliriz?' },
            { icon: '📍', text: 'Hangi şehirde buluşabiliriz?' },
            { icon: '📋', text: 'Belgeleri görebilir miyim?' },
            { icon: '🤝', text: 'Takas teklifini kabul ediyorum.' },
            { icon: '❓', text: 'Aracın bakım geçmişi nasıl?' },
            { icon: '✅', text: 'Anlaştık, ne zaman buluşalım?' },
          ].map((tpl) => (
            <button
              key={tpl.text}
              onClick={() => setText(tpl.text)}
              title={tpl.text}
              className="flex-shrink-0 text-xs bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full transition-colors flex items-center gap-1"
            >
              <span>{tpl.icon}</span>
              <span className="hidden sm:inline truncate max-w-[120px]">{tpl.text}</span>
            </button>
          ))}
        </div>
      )}

      {chatTab === 'sohbet' && offer.status !== 'Tamamlandı' && offer.status !== 'Reddedildi' && coachReplies.length > 0 && (
        <div className="border-t border-blue-100 dark:border-blue-900/40 bg-blue-50/80 dark:bg-blue-900/10 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-blue-900 dark:text-blue-200">AI cevap koçu</p>
            {coachNote && <span className="truncate text-[11px] text-blue-700 dark:text-blue-300">{coachNote}</span>}
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {coachReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                onClick={() => setText(reply)}
                title={reply}
                className="max-w-[260px] shrink-0 rounded-xl border border-blue-200 bg-white px-3 py-2 text-left text-xs leading-relaxed text-slate-700 shadow-sm transition-colors hover:border-blue-400 hover:bg-blue-50 dark:border-blue-900/40 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-blue-900/20"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Input (Sohbet sekmesi) ── */}
      {chatTab === 'sohbet' && (offer.status !== 'Tamamlandı' && offer.status !== 'Reddedildi' ? (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send()}
            placeholder="Mesaj yaz..."
            className="flex-1 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-400"
          />
          <button
            onClick={askCoach}
            disabled={coachLoading}
            title="AI cevap öner"
            className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 flex items-center justify-center transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <span className="text-sm">{coachLoading ? '...' : '✦'}</span>
          </button>
          <button
            onClick={() => setAiNegOpen(true)}
            title="AI Negosiasyon Analizi"
            className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <span className="text-sm">🤖</span>
          </button>
          <button
            onClick={send}
            disabled={!text.trim()}
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      ) : (
        <div className={`px-4 py-3 border-t border-slate-200 dark:border-slate-700 ${
          offer.status === 'Tamamlandı' ? 'bg-emerald-50' : 'bg-red-50'
        }`}>
          <div className="text-center text-sm font-medium">
            {offer.status === 'Tamamlandı'
              ? <span className="text-emerald-700">🎉 Takas tamamlandı!</span>
              : <span className="text-red-600">Bu teklif reddedildi.</span>}
          </div>
          {offer.status === 'Tamamlandı' && !alreadyRated && (
            <button
              onClick={() => setRatingOpen(true)}
              className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-1.5"
            >
              <span>⭐</span> Karşı tarafı değerlendir
            </button>
          )}
          {offer.status === 'Tamamlandı' && alreadyRated && (
            <p className="mt-1.5 text-center text-xs text-emerald-600">✓ Değerlendirme kaydedildi</p>
          )}
        </div>
      ))}

      {revisionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setRevisionOpen(false)}>
          <form
            onSubmit={submitRevision}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Teklifi Revize Et</h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Yeni değer veya teklif edilecek ilan görüşmeye işlenir.</p>
              </div>
              <button
                type="button"
                onClick={() => setRevisionOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Teklif edeceğiniz ilan</span>
                <select
                  value={revisionListingId}
                  onChange={(e) => {
                    setRevisionListingId(e.target.value);
                    const l = myListings.find(item => item.id === e.target.value);
                    if (l) setRevisionValue(String(l.estimatedValue));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                >
                  <option value="">İlan seçmeden revize et</option>
                  {myListings.map((l) => (
                    <option key={l.id} value={l.id}>{l.title} - {fmt(l.estimatedValue)}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-sm font-semibold text-slate-700 dark:text-slate-200">Yeni teklif değeri</span>
                <input
                  type="number"
                  value={revisionValue}
                  onChange={(e) => setRevisionValue(e.target.value)}
                  placeholder="Örn: 850000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>

              {relatedListing && revisionValue && (
                <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                  Fark analizi: {fmt(Math.abs(Number(revisionValue) - relatedListing.estimatedValue))}
                  {' '}
                  {Number(revisionValue) >= relatedListing.estimatedValue ? 'sizin teklifiniz yüksek' : 'karşı tarafın ilanı yüksek'}.
                </div>
              )}
            </div>

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setRevisionOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Revizyonu Kaydet
              </button>
            </div>
          </form>
        </div>
      )}

      {ratingOpen && (
        <RatingModal offer={offer} onClose={() => setRatingOpen(false)} />
      )}

      {aiNegOpen && (
        <NegotiationSimulator
          listingId={offer.listingId}
          listingTitle={offer.listingTitle}
          onClose={() => setAiNegOpen(false)}
        />
      )}

      {meetingOpen && (
        <MeetingScheduler
          offer={offer}
          onClose={() => setMeetingOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Conversations() {
  useSEO({ title: 'Mesajlar', description: 'Takas tekliflerin ve kullanıcılarla yazışmaların.' });

  const { offers, currentUserId } = useAppStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<'all' | 'incoming' | 'outgoing'>('all');

  const incoming = offers.filter(o => o.toUserId === currentUserId);
  const outgoing = offers.filter(o => o.fromUserId === currentUserId);
  const all = [...incoming, ...outgoing].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const shown = tab === 'all' ? all : tab === 'incoming' ? incoming : outgoing;
  const activeOffer = offers.find(o => o.id === activeId);
  const isIncoming = activeOffer ? activeOffer.toUserId === currentUserId : false;

  // Auto-select first on mount
  useEffect(() => {
    if (!activeId && shown.length > 0) setActiveId(shown[0].id);
  }, []);

  const pendingCount = incoming.filter(o => o.status === 'Beklemede').length;

  // Giriş yapılmamışsa CTA göster
  if (!currentUserId) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Görüşmeler</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Tüm takas teklifleri ve sohbetler</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col items-center justify-center py-20 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Görüşmelerine erişmek için giriş yap</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-6">
            Takas tekliflerini görmek ve sohbet etmek için hesabına giriş yapman gerekiyor.
          </p>
          <div className="flex gap-3">
            <Link to="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">
              Giriş Yap
            </Link>
            <Link to="/register" className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors">
              Kayıt Ol
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Görüşmeler</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-500 mt-0.5">Tüm takas teklifleri ve sohbetler</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden" style={{ height: 'calc(100vh - 180px)', minHeight: 480 }}>
        <div className="flex h-full">
          {/* ── Sol panel: liste — mobilde chat açıkken gizle ── */}
          <div className={`w-full sm:w-72 md:w-80 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 flex flex-col ${activeId ? 'hidden sm:flex' : 'flex'}`}>
            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
              {([['all','Tümü'], ['incoming','Gelen'], ['outgoing','Gönderilen']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`flex-1 py-3 text-xs font-semibold transition-colors relative ${
                    tab === key ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'
                  }`}
                >
                  {label}
                  {key === 'incoming' && pendingCount > 0 && (
                    <span className="ml-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">
                      {pendingCount}
                    </span>
                  )}
                  {tab === key && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600" />}
                </button>
              ))}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {shown.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Henüz görüşme yok</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Bir ilana teklif göndererek başlayın</p>
                  <Link to="/" className="mt-3 text-xs font-semibold text-blue-600 hover:underline">İlanlara Git</Link>
                </div>
              ) : (
                shown.map(o => (
                  <ConvItem
                    key={o.id}
                    offer={o}
                    isActive={o.id === activeId}
                    isIncoming={o.toUserId === currentUserId}
                    onClick={() => setActiveId(o.id)}
                  />
                ))
              )}
            </div>

            {/* Stats bar */}
            <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 px-4 py-2.5 flex justify-around flex-shrink-0">
              {[
                { label: 'Bekleyen',   value: incoming.filter(o => o.status === 'Beklemede').length,  color: 'text-amber-600'   },
                { label: 'Aktif',      value: offers.filter(o => o.status === 'Görüşülüyor').length,  color: 'text-blue-600'    },
                { label: 'Tamamlanan', value: offers.filter(o => o.status === 'Tamamlandı').length,   color: 'text-emerald-600' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className={`text-base font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Sağ panel: chat — mobilde tam ekran, masaüstünde yan panel ── */}
          <div className={`flex-1 min-w-0 flex-col ${activeId ? 'flex' : 'hidden sm:flex'}`}>
            {activeOffer ? (
              <ChatPanel
                key={activeOffer.id}
                offer={activeOffer}
                isIncoming={isIncoming}
                onBack={() => setActiveId(null)}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center px-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <p className="text-slate-600 dark:text-slate-300 font-semibold mb-1">Bir görüşme seçin</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm max-w-xs">Soldaki listeden bir teklif seçerek sohbeti görüntüleyin</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
