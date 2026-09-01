import { useState } from 'react';
import type { Listing } from '../types';
import { useAppStore } from '../store/useAppStore';
import { aiAutoMessage, aiOfferQuality, type OfferQualityResult } from '../services/api';
import { getOfferTone } from '../lib/listingHealth';
import { MAX_OFFER_MESSAGE_LENGTH, MAX_OFFER_VALUE, validateOfferDraft } from '../lib/offerValidation';
import { showToast } from './Toast';

interface Props {
  listing: Listing;
  onClose: () => void;
}

export default function SwapOfferModal({ listing, onClose }: Props) {
  const { sendOffer, currentUserId, currentUserName, listings } = useAppStore();
  const [message, setMessage] = useState('');
  const [selectedListing, setSelectedListing] = useState('');
  const [offeredValue, setOfferedValue] = useState('');
  const [sent, setSent] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [quality, setQuality] = useState<OfferQualityResult | null>(null);

  const myListings = listings.filter((l) =>
    l.ownerId === currentUserId
    && l.id !== listing.id
    && l.isActive !== false
    && l.moderationStatus !== 'pending'
    && l.moderationStatus !== 'rejected'
  );
  const selected = myListings.find((l) => l.id === selectedListing);
  const localTone = getOfferTone(message);

  const parsedOfferedValue = offeredValue.trim() === '' ? selected?.estimatedValue : Number(offeredValue);
  const effectiveOfferedValue = parsedOfferedValue ?? 0;
  const priceDiff = effectiveOfferedValue > 0 ? effectiveOfferedValue - listing.estimatedValue : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const validationError = validateOfferDraft({
      actorId: currentUserId,
      targetOwnerId: listing.ownerId,
      targetListingId: listing.id,
      offeredListingId: selected?.id,
      message,
      offeredValue: parsedOfferedValue,
    });
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }
    setSending(true);
    try {
      await sendOffer({
        fromUserId: currentUserId,
        fromUserName: currentUserName,
        toUserId: listing.ownerId,
        listingId: listing.id,
        listingTitle: listing.title,
        offeredListingId: selected?.id,
        offeredListingTitle: selected?.title,
        message: message.trim(),
        status: 'Beklemede',
        offeredValue: parsedOfferedValue,
      });
      setSent(true);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Teklif gönderilemedi', 'error');
    } finally {
      setSending(false);
    }
  };

  async function generateMessage() {
    setAiLoading(true);
    try {
      const res = await aiAutoMessage({
        sourceListingId: selected?.id,
        targetListingId: listing.id,
        tone: 'profesyonel',
      });
      setMessage(res.message);
      if (selected && !offeredValue) setOfferedValue(String(selected.estimatedValue));
      showToast('AI teklif mesajı hazır', 'success');
    } catch {
      const base = selected
        ? `Merhaba, ${selected.title} ilanımı ${listing.title} ilanınız için takas olarak değerlendirmek isterim. Araç/ürün detaylarını ve varsa nakit fark konusunu karşılıklı konuşabiliriz. Uygun görürseniz ekspertiz ve bakım belgelerini de paylaşabilirim.`
        : `Merhaba, ${listing.title} ilanınızla ilgileniyorum. Takas beklentinize uygun bir teklif hazırlamak isterim. Detayları ve varsa nakit fark konusunu konuşabiliriz.`;
      setMessage(base);
      showToast('Backend AI kapalı olduğu için yerel taslak yazıldı', 'success');
    } finally {
      setAiLoading(false);
    }
  }

  async function analyzeQuality() {
    if (message.trim().length < 10) {
      showToast('Önce kısa bir teklif mesajı yazın', 'error');
      return;
    }
    setQualityLoading(true);
    try {
      const res = await aiOfferQuality({
        message,
        listingId: listing.id,
        offeredListingId: selected?.id,
        offeredValue: parsedOfferedValue,
      });
      setQuality(res);
      showToast('Teklif kalitesi analiz edildi', 'success');
    } catch {
      setQuality({
        score: localTone.score,
        positives: localTone.notes.length > 0 ? localTone.notes : ['Mesaj okunabilir durumda'],
        issues: localTone.score >= 65 ? [] : ['Daha fazla detay ve güven sinyali ekleyin'],
        improvedMessage: message.trim().length > 0
          ? `${message.trim()}\n\nDilerseniz ekspertiz, bakım geçmişi ve nakit fark detaylarını da paylaşabilirim.`
          : '',
      });
      showToast('Yerel teklif analizi hazırlandı', 'success');
    } finally {
      setQualityLoading(false);
    }
  }

  const formatPrice = (value: number) =>
    new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Takas Teklifi Gönder</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            İlan: <span className="font-medium text-slate-700 dark:text-slate-200">{listing.title}</span>
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Değer: <span className="font-semibold text-blue-600 dark:text-blue-400">{formatPrice(listing.estimatedValue)}</span>
          </p>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-blue-700 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Teklif Gönderildi!</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              Teklifiniz {listing.ownerName} adlı kullanıcıya iletildi. Yanıtı "Tekliflerim" sayfasından takip edebilirsiniz.
            </p>
            <button
              onClick={onClose}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              Tamam
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {myListings.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                  Hangi ilanınızı teklif ediyorsunuz?
                </label>
                <select
                  value={selectedListing}
                  onChange={(e) => setSelectedListing(e.target.value)}
                  className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Bir ilan seçin (opsiyonel)</option>
                  {myListings.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title} — {formatPrice(l.estimatedValue)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
                Teklif ettiğiniz değer (₺)
              </label>
              <input
                type="number"
                min={0}
                max={MAX_OFFER_VALUE}
                step={1000}
                placeholder="Örn: 850000"
                value={offeredValue}
                onChange={(e) => setOfferedValue(e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {priceDiff !== null && (
              <div className={`rounded-xl px-4 py-3 flex items-center justify-between gap-2 border ${
                priceDiff > 0
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40'
                  : priceDiff < 0
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
              }`}>
                <span className={`text-sm font-medium ${
                  priceDiff > 0 ? 'text-blue-700 dark:text-blue-400'
                  : priceDiff < 0 ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-600 dark:text-slate-400'
                }`}>
                  {priceDiff > 0 ? 'Hedef değerin üzerinde' : priceDiff < 0 ? 'Hedef değerin altında' : 'Değerler eşit'}
                </span>
                <span className={`text-base font-bold ${
                  priceDiff > 0 ? 'text-blue-700 dark:text-blue-400'
                  : priceDiff < 0 ? 'text-red-600 dark:text-red-400'
                  : 'text-slate-500 dark:text-slate-400'
                }`}>
                  {priceDiff === 0 ? 'Eşit' : `${priceDiff > 0 ? '+' : ''}${formatPrice(priceDiff)}`}
                </span>
              </div>
            )}

            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Mesajınız <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={generateMessage}
                    disabled={aiLoading}
                    className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50 dark:border-blue-900/40 dark:bg-blue-900/20 dark:text-blue-300"
                  >
                    {aiLoading ? 'Yazıyor...' : 'AI taslak'}
                  </button>
                  <button
                    type="button"
                    onClick={analyzeQuality}
                    disabled={qualityLoading}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:border-blue-500 hover:text-blue-700 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    {qualityLoading ? 'Bakıyor...' : 'Kalite ölç'}
                  </button>
                </div>
              </div>
              <textarea
                required
                maxLength={MAX_OFFER_MESSAGE_LENGTH}
                rows={4}
                placeholder="Takas teklifinizi açıklayın. Hangi aracı veya ürünü teklif ediyorsunuz? Nakit fark ödeyecek misiniz?"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              {message.trim().length > 0 && (
                <div className="mt-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Canlı ton skoru: {localTone.label}</span>
                    <span className="font-bold text-blue-600 dark:text-blue-300">%{localTone.score}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${localTone.score}%` }} />
                  </div>
                  {localTone.notes.length > 0 && (
                    <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">{localTone.notes.join(' · ')}</p>
                  )}
                </div>
              )}
              {quality && (
                <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs dark:border-blue-900/40 dark:bg-blue-900/10">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="font-bold text-blue-900 dark:text-blue-200">AI teklif analizi</p>
                    <span className="rounded-full bg-white px-2 py-0.5 font-black text-blue-700 dark:bg-slate-900 dark:text-blue-300">%{quality.score}</span>
                  </div>
                  {quality.positives.length > 0 && <p className="text-emerald-700 dark:text-emerald-300">Güçlü: {quality.positives.join(', ')}</p>}
                  {quality.issues.length > 0 && <p className="mt-1 text-amber-700 dark:text-amber-300">Eksik: {quality.issues.join(', ')}</p>}
                  {quality.improvedMessage && (
                    <button
                      type="button"
                      onClick={() => setMessage(quality.improvedMessage)}
                      className="mt-2 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700"
                    >
                      Önerilen mesajı kullan
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 rounded-lg transition-colors"
              >
                İptal
              </button>
              <button
                type="submit"
                disabled={sending}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {sending ? 'Gönderiliyor...' : 'Teklif Gönder'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
