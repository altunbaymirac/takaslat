import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { showToast } from '../components/Toast';
import { downloadCSV } from '../lib/csv';
import { useSEO } from '../hooks/useSEO';
import { isPlatformAdmin } from '../lib/roles';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)    return 'az önce';
  if (m < 60)   return `${m} dk önce`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h} sa önce`;
  return `${Math.floor(h / 24)} gün önce`;
};

export default function Dashboard() {
  useSEO({ title: 'Kontrol Paneli', description: 'İlanlarını, tekliflerini ve mesajlarını tek yerden yönet.' });

  const {
    listings, offers, favorites, currentUser, currentUserId,
    getNotifications,
    searchHistory, clearSearchHistory, setFilters,
  } = useAppStore();


  // ── İstatistikler ───────────────────────────────────────────────────────────

  const myListings   = useMemo(() => listings.filter((l) => l.ownerId === currentUserId), [listings, currentUserId]);
  const incoming     = useMemo(() => offers.filter((o) => o.toUserId === currentUserId),  [offers, currentUserId]);
  const outgoing     = useMemo(() => offers.filter((o) => o.fromUserId === currentUserId), [offers, currentUserId]);
  const pending      = incoming.filter((o) => o.status === 'Beklemede').length;
  const completed    = offers.filter((o) => o.status === 'Tamamlandı').length;
  const totalValue   = myListings.reduce((s, l) => s + l.estimatedValue, 0);
  const totalViews   = myListings.reduce((s, l) => s + (l.viewCount ?? 0), 0);

  // ── Aktivite akışı (son 8) ──────────────────────────────────────────────────

  const activity = useMemo(() => {
    const items: Array<{ kind: string; icon: string; text: string; when: string; href?: string }> = [];

    // Son ilanlarım
    for (const l of myListings.slice(0, 3)) {
      items.push({
        kind: 'listing', icon: '📋',
        text: `İlanım: ${l.title}`,
        when: l.createdAt,
        href: `/listing/${l.id}`,
      });
    }
    // Son teklifler
    for (const o of offers.slice(0, 5)) {
      const isIn = o.toUserId === currentUserId;
      items.push({
        kind: 'offer',
        icon: isIn ? '🤝' : '📤',
        text: isIn ? `${o.fromUserName} sana teklif gönderdi: ${o.listingTitle}` : `Teklif gönderildin: ${o.listingTitle}`,
        when: o.createdAt,
        href: '/conversations',
      });
    }

    return items
      .sort((a, b) => b.when.localeCompare(a.when))
      .slice(0, 8);
  }, [myListings, offers, currentUserId]);

  if (!currentUser) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Giriş gerekiyor</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Kontrol panelini görmek için giriş yap.</p>
        <Link to="/login" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium">
          Giriş Yap
        </Link>
      </div>
    );
  }

  const unreadNotes = getNotifications().filter((n) => !n.read).length;

  function exportListings() {
    downloadCSV(
      `ilanlarim-${new Date().toISOString().split('T')[0]}.csv`,
      myListings.map((l) => ({
        id:             l.id,
        title:          l.title,
        category:       l.category,
        fiyat:          l.estimatedValue,
        sehir:          l.city,
        durum:          l.condition,
        marka:          l.vehicleDetails?.brand ?? l.electronicDetails?.brand ?? '',
        model:          l.vehicleDetails?.model ?? l.electronicDetails?.model ?? '',
        yil:            l.vehicleDetails?.year ?? '',
        km:             l.vehicleDetails?.km ?? '',
        goruntulenme:   l.viewCount ?? 0,
        olusturulma:    l.createdAt.split('T')[0],
        link:           `${window.location.origin}/listing/${l.id}`,
      })),
      [
        { key: 'id',           label: 'ID' },
        { key: 'title',        label: 'Başlık' },
        { key: 'category',     label: 'Kategori' },
        { key: 'fiyat',        label: 'Fiyat (₺)' },
        { key: 'sehir',        label: 'Şehir' },
        { key: 'durum',        label: 'Durum' },
        { key: 'marka',        label: 'Marka' },
        { key: 'model',        label: 'Model' },
        { key: 'yil',          label: 'Yıl' },
        { key: 'km',           label: 'KM' },
        { key: 'goruntulenme', label: 'Görüntülenme' },
        { key: 'olusturulma',  label: 'Oluşturulma' },
        { key: 'link',         label: 'Link' },
      ],
    );
    showToast('İlanlar indirildi', 'success');
  }

  function exportOffers() {
    const allOffers = [...incoming, ...outgoing];
    downloadCSV(
      `tekliflerim-${new Date().toISOString().split('T')[0]}.csv`,
      allOffers.map((o) => ({
        id:        o.id,
        tip:       o.toUserId === currentUserId ? 'Gelen' : 'Gönderilen',
        ilan:      o.listingTitle,
        karsi:     o.toUserId === currentUserId ? o.fromUserName : 'İlan Sahibi',
        teklif:    o.offeredValue ?? '',
        karsi_ilan: o.offeredListingTitle ?? '',
        mesaj:     o.message,
        durum:     o.status,
        tarih:     o.createdAt.split('T')[0],
      })),
      [
        { key: 'id',         label: 'ID' },
        { key: 'tip',        label: 'Tip' },
        { key: 'ilan',       label: 'İlan' },
        { key: 'karsi',      label: 'Karşı Taraf' },
        { key: 'teklif',     label: 'Teklif (₺)' },
        { key: 'karsi_ilan', label: 'Karşı İlan' },
        { key: 'mesaj',      label: 'Mesaj' },
        { key: 'durum',      label: 'Durum' },
        { key: 'tarih',      label: 'Tarih' },
      ],
    );
    showToast('Teklifler indirildi', 'success');
  }


  // ── UI ──────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Hoş geldin, {currentUser.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Hesabının özeti, son aktivitelerin ve hızlı işlemler.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {myListings.length > 0 && (
            <button
              onClick={exportListings}
              title="İlanlarımı CSV olarak indir"
              className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <span>📥</span> İlanları İndir
            </button>
          )}
          {(incoming.length + outgoing.length > 0) && (
            <button
              onClick={exportOffers}
              title="Tekliflerimi CSV olarak indir"
              className="text-xs font-semibold bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <span>📥</span> Teklifleri İndir
            </button>
          )}
        </div>
      </header>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[
          { icon: '📋', label: 'İlanlarım',         value: myListings.length.toString(),  color: 'bg-blue-600',     link: '/profile/' + currentUserId },
          { icon: '🤝', label: 'Bekleyen Teklifler',value: pending.toString(),            color: 'bg-amber-600',    link: '/conversations' },
          { icon: '✅', label: 'Tamamlanan',        value: completed.toString(),          color: 'bg-emerald-600',  link: '/conversations' },
          { icon: '👁️', label: 'Toplam Görüntülenme', value: totalViews.toString(),       color: 'bg-blue-600',   link: '/profile/' + currentUserId },
        ].map((s) => (
          <Link
            key={s.label}
            to={s.link}
            className={`${s.color} text-white rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all`}
          >
            <div className="text-2xl sm:text-3xl mb-1">{s.icon}</div>
            <div className="text-xs opacity-90 mb-0.5">{s.label}</div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight">{s.value}</div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Aktivite akışı */}
        <section className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-5 sm:p-6 border border-slate-100 dark:border-slate-700 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>⚡</span> Son Aktiviteler
            </h2>
            {unreadNotes > 0 && (
              <span className="text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full">
                {unreadNotes} okunmamış
              </span>
            )}
          </div>
          {activity.length === 0 ? (
            <div className="text-center py-10">
              <div className="text-3xl mb-2">📭</div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Henüz aktivite yok</p>
              <Link to="/create" className="inline-block mt-3 text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline">
                İlk ilanını oluştur →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {activity.map((a, i) => (
                <Link
                  key={i}
                  to={a.href ?? '#'}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <span className="text-lg flex-shrink-0">{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{a.text}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{timeAgo(a.when)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Hızlı işlemler + Özet */}
        <aside className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Portföy</h3>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">{fmt(totalValue)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{myListings.length} ilanın toplam değeri</p>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 text-center">
              <div>
                <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{outgoing.length}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Gönderilen</p>
              </div>
              <div>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{incoming.length}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Gelen</p>
              </div>
              <div>
                <p className="text-lg font-bold text-red-500">❤ {favorites.length}</p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Favori</p>
              </div>
            </div>
          </div>

          {/* Son aramalar */}
          {searchHistory.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                  <span>🔍</span> Son Aramalar
                </h3>
                <button
                  onClick={clearSearchHistory}
                  className="text-xs text-slate-400 hover:text-red-500 font-medium"
                >
                  Temizle
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {searchHistory.slice(0, 8).map((s) => (
                  <Link
                    key={s}
                    to="/"
                    onClick={() => setFilters({ searchQuery: s })}
                    className="text-xs bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-700 dark:hover:text-blue-300 px-2.5 py-1 rounded-full transition-colors"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 🎁 Davet kartı */}
          <div className="rounded-2xl bg-blue-700 p-5 text-white shadow-sm">
            <h3 className="text-sm font-bold uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>🎁</span> Arkadaşlarını Davet Et
            </h3>
            <p className="text-xs opacity-90 mb-3">
              Davet linkiyle gelen her arkadaşın için <strong>+1 takas başarımı</strong>
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${window.location.origin}/register?ref=${currentUserId}`}
                className="flex-1 text-xs bg-white/20 backdrop-blur border border-white/30 text-white placeholder-white/60 rounded-lg px-2 py-1.5 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/register?ref=${currentUserId}`);
                  showToast('Davet linki kopyalandı', 'success');
                }}
                className="bg-white text-rose-700 hover:bg-rose-50 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
              >
                Kopyala
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Hızlı İşlem</h3>
            <div className="space-y-2">
              {[
                { to: '/create',        label: '+ Yeni İlan Ver',   color: 'bg-blue-600 hover:bg-blue-700 text-white' },
                { to: '/favorites',     label: '❤️ Favoriler',      color: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200' },
                { to: '/conversations', label: '💬 Görüşmeler',     color: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200' },
                ...(isPlatformAdmin(currentUser?.role)
                  ? [{ to: '/trends', label: '📈 Trend Paneli', color: 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200' }]
                  : []),
              ].map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className={`block text-sm font-semibold text-center py-2.5 rounded-xl transition-colors ${q.color}`}
                >
                  {q.label}
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
