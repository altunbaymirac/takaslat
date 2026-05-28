import { useAppStore } from '../store/useAppStore';
import type { SwapOffer, OfferStatus } from '../types';
import { useSEO } from '../hooks/useSEO';

const statusConfig: Record<OfferStatus, { label: string; color: string; bg: string }> = {
  'Beklemede': { label: 'Beklemede', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
  'Görüşülüyor': { label: 'Görüşülüyor', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  'Onaylandı': { label: 'Onaylandı', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  'Tamamlandı': { label: 'Tamamlandı', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
  'Reddedildi': { label: 'Reddedildi', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
};

function OfferCard({ offer, isIncoming, onStatusChange }: {
  offer: SwapOffer;
  isIncoming: boolean;
  onStatusChange?: (status: OfferStatus) => void;
}) {
  const formatPrice = (value?: number) =>
    value ? new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value) : '-';

  const status = statusConfig[offer.status];

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-5 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isIncoming ? (
              <span className="text-xs font-medium bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">Gelen Teklif</span>
            ) : (
              <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">Gönderilen Teklif</span>
            )}
            <span className={`text-xs font-medium border px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
              {status.label}
            </span>
          </div>

          <h3 className="font-semibold text-slate-800 dark:text-slate-100 truncate">{offer.listingTitle}</h3>

          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center gap-1">
              <span>{isIncoming ? offer.fromUserName : 'Siz'}</span>
              <span className="text-slate-300">→</span>
              <span>{isIncoming ? 'Siz' : 'İlan Sahibi'}</span>
            </div>
            {offer.offeredListingTitle && (
              <div>
                Teklif edilen: <span className="font-medium text-slate-700">{offer.offeredListingTitle}</span>
              </div>
            )}
            {offer.offeredValue && (
              <div>
                Teklif değeri: <span className="font-semibold text-blue-600">{formatPrice(offer.offeredValue)}</span>
              </div>
            )}
          </div>

          <div className="mt-3 bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
            <p className="text-sm text-slate-600 dark:text-slate-300 italic">"{offer.message}"</p>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
            {new Date(offer.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {isIncoming && offer.status === 'Beklemede' && onStatusChange && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => onStatusChange('Görüşülüyor')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Görüşmeye Başla
          </button>
          <button
            onClick={() => onStatusChange('Tamamlandı')}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Kabul Et
          </button>
          <button
            onClick={() => onStatusChange('Reddedildi')}
            className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Reddet
          </button>
        </div>
      )}

      {isIncoming && offer.status === 'Görüşülüyor' && onStatusChange && (
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          <button
            onClick={() => onStatusChange('Tamamlandı')}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
          >
            Tamamlandı Olarak İşaretle
          </button>
          <button
            onClick={() => onStatusChange('Reddedildi')}
            className="flex-1 border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium py-2 rounded-lg transition-colors"
          >
            İptal Et
          </button>
        </div>
      )}
    </div>
  );
}

export default function MyOffers() {
  useSEO({ title: 'Tekliflerim', description: 'Gönderdiğin ve aldığın takas tekliflerini takip et.' });

  const { offers, currentUserId, updateOfferStatus } = useAppStore();

  const outgoing = offers.filter((o) => o.fromUserId === currentUserId);
  const incoming = offers.filter((o) => o.toUserId === currentUserId);

  const stats = {
    pending: incoming.filter((o) => o.status === 'Beklemede').length,
    negotiating: offers.filter((o) => o.status === 'Görüşülüyor').length,
    completed: offers.filter((o) => o.status === 'Tamamlandı').length,
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Tekliflerim</h1>
        <p className="text-slate-500 dark:text-slate-400">Gelen ve gönderilen takas teklifleriniz</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{stats.pending}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Bekleyen</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.negotiating}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Görüşülüyor</div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{stats.completed}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400">Tamamlanan</div>
        </div>
      </div>

      {/* Incoming */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-purple-500 rounded-full" />
          Gelen Teklifler
          {incoming.length > 0 && (
            <span className="text-sm font-normal text-slate-400">({incoming.length})</span>
          )}
        </h2>
        {incoming.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-slate-500 text-sm">Henüz gelen teklifiniz yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incoming.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                isIncoming={true}
                onStatusChange={(status) => updateOfferStatus(offer.id, status)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Outgoing */}
      <section>
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-500 rounded-full" />
          Gönderilen Teklifler
          {outgoing.length > 0 && (
            <span className="text-sm font-normal text-slate-400">({outgoing.length})</span>
          )}
        </h2>
        {outgoing.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl p-8 text-center">
            <p className="text-slate-500 text-sm">Henüz teklif göndermediniz</p>
          </div>
        ) : (
          <div className="space-y-3">
            {outgoing.map((offer) => (
              <OfferCard key={offer.id} offer={offer} isIncoming={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
