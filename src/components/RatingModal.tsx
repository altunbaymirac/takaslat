import { useState, type FormEvent } from 'react';
import type { SwapOffer } from '../types';
import { useAppStore } from '../store/useAppStore';
import { rateOffer } from '../services/api';
import { showToast } from './Toast';

interface Props {
  offer:   SwapOffer;
  onClose: () => void;
}

export default function RatingModal({ offer, onClose }: Props) {
  const { currentUserId, addRating, loadOffers } = useAppStore();
  const otherUserId   = offer.fromUserId === currentUserId ? offer.toUserId   : offer.fromUserId;
  const otherUserName = offer.fromUserId === currentUserId ? 'karşı taraf'   : offer.fromUserName;

  const [stars,   setStars]   = useState<0 | 1 | 2 | 3 | 4 | 5>(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!stars || loading) return;
    setLoading(true);
    try {
      await rateOffer(offer.id, stars, comment || undefined);
      // Also update local store for immediate UI feedback
      addRating({
        offerId:    offer.id,
        fromUserId: currentUserId,
        toUserId:   otherUserId,
        stars:      stars as 1 | 2 | 3 | 4 | 5,
        comment:    comment || undefined,
      });
      // Refresh offers so fromRated/toRated flags update
      void loadOffers();
      showToast('Değerlendirmeniz alındı', 'success');
      onClose();
    } catch {
      showToast('Değerlendirme gönderilemedi, tekrar deneyin', 'error');
    } finally {
      setLoading(false);
    }
  }

  const starLabels = ['', 'Çok kötü', 'Kötü', 'Orta', 'İyi', 'Mükemmel'];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 modal-overlay" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>⭐</span> Takası Değerlendir
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="text-center">
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-1">
              <strong>{otherUserName}</strong> ile yaptığınız takas nasıl geçti?
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-5">
              {offer.listingTitle}
            </p>

            {/* Yıldızlar */}
            <div className="flex justify-center gap-1.5 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setStars(n as 1 | 2 | 3 | 4 | 5)}
                  className="transition-transform hover:scale-110"
                >
                  <svg
                    className={`w-10 h-10 ${stars >= n ? 'text-amber-400' : 'text-slate-200 dark:text-slate-600'}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </button>
              ))}
            </div>
            <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 h-5">
              {stars > 0 && starLabels[stars]}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200 mb-1.5">
              Yorum <span className="text-slate-400 font-normal">(isteğe bağlı)</span>
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Karşı taraf güvenilir miydi? İletişim nasıldı?"
              className="w-full text-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium py-2.5 rounded-xl text-sm"
            >
              Sonra
            </button>
            <button
              type="submit"
              disabled={!stars}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              {loading ? 'Gönderiliyor...' : 'Değerlendirmeyi Gönder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
