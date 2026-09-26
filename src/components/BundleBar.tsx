import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { showToast } from './Toast';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function BundleBar() {
  const { bundleCart, listings, toggleBundleItem, clearBundle, sendOffer, currentUser, currentUserId, currentUserName } = useAppStore();
  const [message, setMessage]   = useState('');
  const [showSend, setShowSend] = useState(false);
  const [sending, setSending] = useState(false);

  if (bundleCart.length === 0) return null;

  const items = bundleCart
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  if (items.length === 0) return null;

  // Birden fazla farklı sahip varsa bundle gönderilemez
  const owners       = new Set(items.map((l) => l.ownerId));
  const sameOwner    = owners.size === 1;
  const ownerId      = Array.from(owners)[0];
  const isOwnBundle  = ownerId === currentUserId;
  const totalValue   = items.reduce((s, l) => s + l.estimatedValue, 0);

  async function handleSend() {
    if (!currentUser) { showToast('Giriş gerekli', 'error'); return; }
    if (!sameOwner)   { showToast('Bundle için aynı sahipten olmalı', 'error'); return; }
    if (isOwnBundle)  { showToast('Kendi ilanlarına teklif gönderemezsin', 'error'); return; }
    if (!message.trim() || message.trim().length < 10) {
      showToast('En az 10 karakter mesaj gerekli', 'error');
      return;
    }

    if (sending) return;
    setSending(true);
    try {
      await Promise.all(items.map((l) => sendOffer({
        fromUserId:          currentUserId,
        fromUserName:        currentUserName,
        toUserId:            l.ownerId,
        listingId:           l.id,
        listingTitle:        l.title,
        message:             `[BUNDLE - ${items.length} ilan, toplam ${fmt(totalValue)}] ${message}`,
        offeredValue:        l.estimatedValue,
        status:              'Beklemede',
        offeredListingTitle: items.length > 1 ? `Bundle: ${items.map((x) => x.title).join(' + ')}` : undefined,
      })));
      showToast(`${items.length} ilanlı bundle teklif gönderildi`, 'success');
      clearBundle();
      setMessage('');
      setShowSend(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Paket teklif gönderilemedi', 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 max-h-[50dvh] overflow-y-auto border-t border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800 md:bottom-0 md:pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">

        {/* Üst satır: özet + actions */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bundle Teklif</span>
            <span className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 rounded-full">
              {items.length} ilan
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              · {fmt(totalValue)}
            </span>
            {!sameOwner && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ⚠ Farklı sahipler — sadece aynı sahipten bundle yapılabilir
              </span>
            )}
          </div>

          {/* Selected items */}
          <div className="flex items-center gap-1.5 flex-1 overflow-x-auto py-1 max-w-full">
            {items.map((l) => (
              <div key={l.id} className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-1 pr-0.5 py-0.5 flex-shrink-0">
                <img src={l.images[0]} alt="" className="w-6 h-6 rounded object-cover" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 max-w-[120px] truncate">{l.title}</span>
                <button
                  onClick={() => toggleBundleItem(l.id)}
                  className="w-4 h-4 rounded text-slate-400 hover:text-red-500"
                  title="Kaldır"
                >
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={clearBundle}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 font-medium px-2 py-1"
            >
              Temizle
            </button>
            <button
              onClick={() => setShowSend((v) => !v)}
              disabled={!sameOwner || isOwnBundle}
              className="btn-primary text-sm font-semibold px-4 py-2 rounded-xl"
            >
              {showSend ? 'Kapat' : 'Paket Teklif Gönder'}
            </button>
          </div>
        </div>

        {/* Mesaj formu */}
        {showSend && sameOwner && !isOwnBundle && (
          <div className="mt-3 flex gap-2">
            <textarea
              rows={2}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Bundle teklifin için mesaj — örn: 3 ilanını da paket olarak almak istiyorum, fiyat müzakereye açıkım"
              className="flex-1 text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <button
              onClick={handleSend}
              disabled={sending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-semibold px-4 rounded-xl"
            >
              {sending ? 'Gönderiliyor...' : 'Gönder'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
