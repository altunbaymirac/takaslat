import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import type { LiveAuction, Listing } from '../types';

const money = (value: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);

function getAuctionStatus(auction: LiveAuction, now: number) {
  if (auction.status === 'ended' || now >= new Date(auction.endsAt).getTime()) return 'ended';
  if (now < new Date(auction.startsAt).getTime()) return 'scheduled';
  return 'live';
}

function formatRemaining(ms: number) {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function AuctionCard({
  auction,
  listing,
  selected,
  now,
  onSelect,
}: {
  auction: LiveAuction;
  listing?: Listing;
  selected: boolean;
  now: number;
  onSelect: () => void;
}) {
  const status = getAuctionStatus(auction, now);
  const remaining = new Date(auction.endsAt).getTime() - now;

  return (
    <button
      onClick={onSelect}
      className={`w-full overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all dark:bg-slate-900 ${
        selected
          ? 'border-blue-400 ring-2 ring-blue-100 dark:border-blue-500 dark:ring-blue-900/40'
          : 'border-slate-200 hover:border-blue-200 dark:border-slate-800 dark:hover:border-blue-800'
      }`}
    >
      <div className="relative h-36 bg-slate-200 dark:bg-slate-800">
        {listing?.images?.[0] ? (
          <img src={listing.images[0]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-3xl">Mezat</div>
        )}
        <div className="absolute left-3 top-3 flex items-center gap-2">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${
            status === 'live'
              ? 'bg-red-600 text-white'
              : status === 'scheduled'
              ? 'bg-amber-400 text-amber-950'
              : 'bg-slate-800 text-white'
          }`}>
            {status === 'live' ? 'CANLI' : status === 'scheduled' ? 'YAKINDA' : 'BİTTİ'}
          </span>
          <span className="rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            {status === 'ended' ? 'Kapandı' : formatRemaining(remaining)}
          </span>
        </div>
      </div>
      <div className="p-4">
        <p className="line-clamp-1 text-sm font-bold text-slate-900 dark:text-slate-100">{auction.title}</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{listing?.city ?? 'Takaslat'}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Güncel teklif</p>
            <p className="text-sm font-black text-blue-700 dark:text-blue-300">{money(auction.currentBid)}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Artış</p>
            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{money(auction.bidIncrement)}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Auctions() {
  useSEO({
    title: 'Canlı Mezat',
    description: 'Takaslat canlı mezatlarında ilanlara anlık teklif ver.',
  });

  const {
    auctions,
    auctionSyncState,
    listings,
    currentUser,
    createAuction,
    placeAuctionBid,
    closeAuction,
  } = useAppStore();

  const [now, setNow] = useState(() => Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bidDraft, setBidDraft] = useState<string | null>(null);
  const [bidMode, setBidMode] = useState<'cash' | 'expertise' | 'swap'>('cash');
  const [bidListingId, setBidListingId] = useState('');
  const [selectedListingId, setSelectedListingId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [message, setMessage] = useState('');
  const [pendingAction, setPendingAction] = useState<'create' | 'bid' | 'close' | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const sortedAuctions = useMemo(
    () => [...auctions].sort((a, b) => {
      const aStatus = getAuctionStatus(a, now);
      const bStatus = getAuctionStatus(b, now);
      if (aStatus !== bStatus) return aStatus === 'live' ? -1 : bStatus === 'live' ? 1 : 0;
      return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
    }),
    [auctions, now]
  );

  const selectedAuction = sortedAuctions.find((auction) => auction.id === selectedId) ?? sortedAuctions[0];
  const selectedListing = selectedAuction
    ? listings.find((listing) => listing.id === selectedAuction.listingId)
    : undefined;
  const availableListings = listings.filter(
    (listing) =>
      currentUser?.id === listing.ownerId &&
      !auctions.some((auction) => auction.listingId === listing.id && getAuctionStatus(auction, now) !== 'ended')
  );
  const activeCount = auctions.filter((auction) => getAuctionStatus(auction, now) === 'live').length;
  const totalBids = auctions.reduce((sum, auction) => sum + auction.bids.length, 0);
  const nextBid = selectedAuction ? selectedAuction.currentBid + selectedAuction.bidIncrement : 0;
  const selectedStatus = selectedAuction ? getAuctionStatus(selectedAuction, now) : 'ended';
  const bidAmount = bidDraft ?? String(nextBid);
  const canManageSelectedAuction = Boolean(
    currentUser && (selectedAuction?.ownerId === currentUser.id || selectedListing?.ownerId === currentUser.id)
  );
  const bidListings = listings.filter((listing) =>
    currentUser?.id === listing.ownerId && listing.id !== selectedAuction?.listingId
  );

  async function handleBid(delta = 0) {
    if (!selectedAuction) return;
    if (!currentUser) {
      setMessage('Teklif vermek için giriş yapmalısın.');
      return;
    }
    if (canManageSelectedAuction) {
      setMessage('Kendi mezadına teklif veremezsin.');
      return;
    }
    const offeredListing = bidListings.find((listing) => listing.id === bidListingId);
    if (bidMode === 'swap' && !offeredListing) {
      setMessage('Takaslı teklif için kendi ilanlarından birini seçmelisin.');
      return;
    }
    const amount = Number(bidAmount) + delta;
    if (!Number.isFinite(amount) || amount < nextBid) {
      setMessage(`Minimum teklif ${money(nextBid)} olmalı.`);
      return;
    }
    setPendingAction('bid');
    try {
      const note = bidMode === 'cash'
        ? 'Nakit teklif'
        : bidMode === 'expertise'
          ? 'Ekspertiz sonucuna bağlı nakit teklif'
          : `Takas + nakit · ${offeredListing?.title}`;
      await placeAuctionBid(selectedAuction.id, amount, note);
      setBidDraft(String(amount + selectedAuction.bidIncrement));
      setMessage(`${money(amount)} teklifin alındı.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Teklif gönderilemedi.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCreateAuction() {
    if (!currentUser) {
      setMessage('Mezat başlatmak için giriş yapmalısın.');
      return;
    }
    const listing = listings.find((item) => item.id === selectedListingId) ?? availableListings[0];
    if (!listing) {
      setMessage('Mezat başlatmak için önce aktif bir ilan gerekli.');
      return;
    }
    const nowMs = now;
    const startingPrice = Math.max(1_000, Math.round((listing.estimatedValue * 0.75) / 1000) * 1000);
    setPendingAction('create');
    try {
      const auctionId = await createAuction({
        listingId: listing.id,
        title: listing.title,
        startsAt: new Date(nowMs).toISOString(),
        endsAt: new Date(nowMs + durationMinutes * 60_000).toISOString(),
        startingPrice,
        bidIncrement: Math.max(5_000, Math.round((listing.estimatedValue * 0.015) / 1000) * 1000),
        reservePrice: Math.round((listing.estimatedValue * 0.9) / 1000) * 1000,
        status: 'live',
      });
      setSelectedId(auctionId);
      setSelectedListingId('');
      setBidDraft(null);
      setMessage(`${listing.title} için canlı mezat başladı.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mezat başlatılamadı.');
    } finally {
      setPendingAction(null);
    }
  }

  async function handleCloseAuction() {
    if (!selectedAuction) return;
    setPendingAction('close');
    try {
      await closeAuction(selectedAuction.id);
      setMessage('Mezat kapatıldı.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Mezat kapatılamadı.');
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-black text-red-700 dark:bg-red-900/30 dark:text-red-300">
                  Canlı Mezat
                </span>
                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  {activeCount} aktif salon
                </span>
                {auctionSyncState === 'loading' && (
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Yükleniyor</span>
                )}
                {auctionSyncState === 'local' && (
                  <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Yerel önizleme</span>
                )}
                {auctionSyncState === 'error' && (
                  <span className="text-xs font-semibold text-red-700 dark:text-red-300">Bağlantı sorunu</span>
                )}
              </div>
              <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">
                Anlık teklif ver, takası mezatta yakala
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                İlan sahipleri süreli mezat açar, katılımcılar minimum artışla teklif verir. Süre bitince en yüksek teklif görüşmeye taşınır.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
              {[
                { label: 'Aktif', value: activeCount },
                { label: 'Toplam teklif', value: totalBids },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xl font-black text-slate-900 dark:text-slate-100">{item.value}</p>
                  <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[360px_1fr] lg:px-8">
        <aside className="space-y-4">
          <div className="grid gap-3">
            {sortedAuctions.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                Henüz aktif mezat yok. İlan sahipleri kendi ilanlarını mezata açtığında burada görünecek.
              </div>
            ) : (
              sortedAuctions.map((auction) => (
                <AuctionCard
                  key={auction.id}
                  auction={auction}
                  listing={listings.find((listing) => listing.id === auction.listingId)}
                  selected={selectedAuction?.id === auction.id}
                  now={now}
                  onSelect={() => {
                    setSelectedId(auction.id);
                    setBidDraft(null);
                  }}
                />
              ))
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">İlandan mezat başlat</h2>
            <div className="mt-3 space-y-3">
              {!currentUser ? (
                <Link
                  to="/login?redirect=/auctions"
                  className="block w-full rounded-xl bg-slate-900 px-4 py-2.5 text-center text-sm font-black text-white transition-colors hover:bg-blue-700 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  Giriş yap
                </Link>
              ) : (
                <>
              <select
                value={selectedListingId}
                onChange={(event) => setSelectedListingId(event.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="">Uygun ilan seç</option>
                {availableListings.map((listing) => (
                  <option key={listing.id} value={listing.id}>{listing.title}</option>
                ))}
              </select>
              {availableListings.length === 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mezata açabileceğin aktif bir ilanın yok. Önce ilan oluşturmalısın.
                </p>
              )}
              <div className="grid grid-cols-3 gap-2">
                {[15, 30, 60].map((minutes) => (
                  <button
                    key={minutes}
                    onClick={() => setDurationMinutes(minutes)}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                      durationMinutes === minutes
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {minutes} dk
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreateAuction}
                disabled={availableListings.length === 0 || pendingAction !== null}
                className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 dark:bg-blue-600 dark:hover:bg-blue-500 dark:disabled:bg-slate-700"
              >
                {pendingAction === 'create' ? 'Başlatılıyor' : 'Mezadı başlat'}
              </button>
                </>
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0">
          {!selectedAuction ? (
            <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm text-slate-500 dark:text-slate-400">Bir mezat seç veya yeni mezat başlat.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="grid lg:grid-cols-[1fr_330px]">
                <div className="min-w-0">
                  <div className="relative h-[300px] bg-slate-200 dark:bg-slate-800 sm:h-[420px]">
                    {selectedListing?.images?.[0] ? (
                      <img src={selectedListing.images[0]} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-400">Görsel yok</div>
                    )}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-5 text-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-black">
                          {selectedStatus === 'live' ? 'CANLI' : selectedStatus === 'scheduled' ? 'YAKINDA' : 'BİTTİ'}
                        </span>
                        {selectedAuction.reservePrice && selectedAuction.currentBid >= selectedAuction.reservePrice && (
                          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-black">Rezerv aşıldı</span>
                        )}
                      </div>
                      <h2 className="mt-3 text-2xl font-black sm:text-3xl">{selectedAuction.title}</h2>
                      <p className="mt-1 text-sm text-white/75">{selectedListing?.city ?? 'Takaslat'} · başlangıç {money(selectedAuction.startingPrice)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 p-5 sm:grid-cols-4">
                    {[
                      { label: 'Güncel teklif', value: money(selectedAuction.currentBid), tone: 'text-blue-700 dark:text-blue-300' },
                      { label: 'Minimum teklif', value: money(nextBid), tone: 'text-slate-900 dark:text-slate-100' },
                      { label: 'Kalan süre', value: selectedStatus === 'ended' ? 'Kapandı' : formatRemaining(new Date(selectedAuction.endsAt).getTime() - now), tone: 'text-red-600 dark:text-red-300' },
                      { label: 'Teklif', value: selectedAuction.bids.length, tone: 'text-slate-900 dark:text-slate-100' },
                    ].map((item) => (
                      <div key={item.label} className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-950">
                        <p className="text-[11px] font-bold uppercase text-slate-400">{item.label}</p>
                        <p className={`mt-1 text-lg font-black ${item.tone}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-slate-100 p-5 dark:border-slate-800">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Teklif akışı</h3>
                      {selectedListing && (
                        <Link to={`/listing/${selectedListing.id}`} className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-300">
                          İlan detayına git
                        </Link>
                      )}
                    </div>
                    <div className="space-y-2">
                      {selectedAuction.bids.length === 0 ? (
                        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">Henüz teklif yok.</p>
                      ) : (
                        selectedAuction.bids.slice(0, 8).map((bid) => (
                          <div key={bid.id} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 p-3 dark:bg-slate-950">
                            <div>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{bid.userName}</p>
                              <p className="text-xs text-slate-400">{new Date(bid.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
                              {bid.note && <p className="mt-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">{bid.note}</p>}
                            </div>
                            <p className="text-sm font-black text-blue-700 dark:text-blue-300">{money(bid.amount)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 lg:border-l lg:border-t-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-slate-100">Teklif ver</h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Minimum artış {money(selectedAuction.bidIncrement)}. Süre bitince teklif kabul edilmez.
                  </p>

                  {!currentUser && (
                    <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
                      Teklif vermek için giriş yapmalısın.
                    </div>
                  )}
                  {canManageSelectedAuction && (
                    <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-200">
                      Bu mezat sana ait. Teklif veremezsin, yalnızca mezadı kapatabilirsin.
                    </div>
                  )}

                  <div className="mt-4 space-y-3">
                    <div>
                      <p className="mb-2 text-[11px] font-bold uppercase text-slate-400">Teklif türü</p>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          ['cash', 'Nakit'],
                          ['expertise', 'Ekspertiz şartlı'],
                          ['swap', 'Takas + nakit'],
                        ] as const).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            onClick={() => setBidMode(mode)}
                            disabled={selectedStatus !== 'live' || !currentUser || canManageSelectedAuction || pendingAction !== null}
                            className={`min-h-11 rounded-xl border px-2 py-2 text-[11px] font-bold transition-colors ${
                              bidMode === mode
                                ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                            } disabled:opacity-50`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {bidMode === 'swap' && (
                      <select
                        value={bidListingId}
                        onChange={(event) => setBidListingId(event.target.value)}
                        disabled={selectedStatus !== 'live' || !currentUser || canManageSelectedAuction || pendingAction !== null}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                      >
                        <option value="">Takas için ilanını seç</option>
                        {bidListings.map((listing) => (
                          <option key={listing.id} value={listing.id}>
                            {listing.title} · {money(listing.estimatedValue)}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-bold uppercase text-slate-400">
                        {bidMode === 'swap' ? 'Toplam paket değeri' : 'Teklif tutarı'}
                      </span>
                    <input
                      type="number"
                      min={nextBid}
                      step={selectedAuction.bidIncrement}
                      value={bidAmount}
                      onChange={(event) => setBidDraft(event.target.value)}
                      disabled={selectedStatus !== 'live' || !currentUser || canManageSelectedAuction || pendingAction !== null}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-lg font-black text-slate-900 outline-none focus:border-blue-400 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    />
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setBidDraft(String(nextBid))}
                        disabled={selectedStatus !== 'live' || !currentUser || canManageSelectedAuction || pendingAction !== null}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        Minimum
                      </button>
                      <button
                        onClick={() => setBidDraft(String(nextBid + selectedAuction.bidIncrement))}
                        disabled={selectedStatus !== 'live' || !currentUser || canManageSelectedAuction || pendingAction !== null}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        +1 artış
                      </button>
                    </div>
                    <button
                      onClick={() => handleBid(0)}
                      disabled={selectedStatus !== 'live' || !currentUser || canManageSelectedAuction || pendingAction !== null}
                      className="btn-primary w-full rounded-2xl px-4 py-3 text-sm font-black"
                    >
                      {pendingAction === 'bid' ? 'Gönderiliyor' : 'Teklif ver'}
                    </button>
                    {canManageSelectedAuction && (
                      <button
                        onClick={handleCloseAuction}
                        disabled={selectedStatus === 'ended' || pendingAction !== null}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                      >
                        {pendingAction === 'close' ? 'Kapatılıyor' : 'Mezadı kapat'}
                      </button>
                    )}
                  </div>

                  {message && (
                    <p className="mt-4 rounded-2xl bg-white p-3 text-xs font-semibold text-slate-600 shadow-sm dark:bg-slate-900 dark:text-slate-300">
                      {message}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
