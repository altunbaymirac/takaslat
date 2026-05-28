import { useMemo, useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import ProfileEditModal from '../components/ProfileEditModal';
import BulkListingActions from '../components/BulkListingActions';
import { fetchUserById, type PublicUser } from '../services/api';
import { useSEO } from '../hooks/useSEO';

const fmt = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);

export default function Profile() {
  const { id } = useParams<{ id: string }>();
  const { listings, offers, currentUser } = useAppStore();
  const [editOpen, setEditOpen]   = useState(false);
  const [apiUser, setApiUser]     = useState<PublicUser | null>(null);
  const [loading, setLoading]     = useState(false);

  const profileUser = apiUser ?? (currentUser?.id === id ? currentUser : null);
  useSEO({
    title:       profileUser ? `${profileUser.name} — Profil` : 'Kullanıcı Profili',
    description: profileUser ? `${profileUser.name}'in ilanlarını ve değerlendirmelerini gör.` : undefined,
    image:       profileUser?.avatar ?? undefined,
  });
  const [notFound, setNotFound]   = useState(false);

  // Bu kullanıcının ilanları
  const userListings = useMemo(
    () => listings.filter((l) => l.ownerId === id),
    [listings, id]
  );

  // Kullanıcı bilgisi: önce ilanlardan, yoksa API'den çek
  const profileFromListing = userListings[0];

  useEffect(() => {
    if (profileFromListing) return;          // ilanlar varsa API'ye gerek yok
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    fetchUserById(id).then((u) => {
      if (u) setApiUser(u);
      else    setNotFound(true);
    }).catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, profileFromListing]);

  // İstatistikler
  const completedSwaps = useMemo(
    () => offers.filter(
      (o) => (o.fromUserId === id || o.toUserId === id) && o.status === 'Tamamlandı'
    ).length,
    [offers, id]
  );

  const totalValue = userListings.reduce((sum, l) => sum + l.estimatedValue, 0);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-blue-600 border-t-transparent animate-spin mx-auto mb-4" />
        <p className="text-slate-500 dark:text-slate-400">Profil yükleniyor...</p>
      </div>
    );
  }

  if (notFound || (!profileFromListing && !apiUser)) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">👤</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Kullanıcı bulunamadı</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8">
          Bu kullanıcının aktif ilanı yok veya hesap kaldırılmış.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    );
  }

  // Profil verisi: önce ilan kaynağı, yoksa API
  const ownerName    = profileFromListing?.ownerName    ?? apiUser?.name    ?? 'Kullanıcı';
  const ownerAvatar  = profileFromListing?.ownerAvatar  ?? apiUser?.avatar  ?? '';
  const ownerCity    = profileFromListing?.city         ?? apiUser?.city    ?? '';
  const ownerRating  = profileFromListing?.ownerRating  ?? apiUser?.rating  ?? 5;
  const ownerSwaps   = profileFromListing?.ownerTotalSwaps ?? apiUser?.totalSwaps ?? completedSwaps;
  const emailVerified = profileFromListing?.ownerEmailVerified ?? apiUser?.emailVerified ?? false;
  const phoneVerified = profileFromListing?.ownerPhoneVerified ?? apiUser?.phoneVerified ?? false;
  const memberSince  = apiUser?.createdAt
    ? new Date(apiUser.createdAt)
    : userListings.length > 0
      ? new Date(Math.min(...userListings.map((l) => new Date(l.createdAt).getTime())))
      : null;

  const isSelf = currentUser?.id === id;
  const trustScore = Math.min(100,
    35 +
    (emailVerified ? 20 : 0) +
    (phoneVerified ? 20 : 0) +
    (ownerSwaps > 0 ? 15 : 0) +
    (ownerRating >= 4.7 ? 10 : 0)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Profil başlık kartı ── */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700 rounded-2xl p-6 sm:p-8 mb-8 text-white relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl" />

        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {ownerAvatar ? (
            <img
              src={ownerAvatar}
              alt={ownerName}
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-white/30 shadow-xl"
            />
          ) : (
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white/20 border-4 border-white/30 flex items-center justify-center text-3xl font-bold shadow-xl">
              {ownerName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold">{ownerName}</h1>
              {isSelf && (
                <>
                  <span className="text-xs bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/30">
                    Siz
                  </span>
                  <button
                    onClick={() => setEditOpen(true)}
                    className="text-xs font-semibold bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full border border-white/30 transition-colors flex items-center gap-1"
                  >
                    ✏️ Düzenle
                  </button>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-blue-100 text-sm">
              {ownerCity && (
                <span className="flex items-center gap-1">
                  📍 {ownerCity}
                </span>
              )}
              {memberSince && (
                <>
                  {ownerCity && <span className="text-blue-300">·</span>}
                  <span>{memberSince.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}'den beri üye</span>
                </>
              )}
            </div>

            {/* Yıldız değerlendirmesi */}
            <div className="flex items-center gap-1 mt-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg key={star} className={`w-4 h-4 ${star <= Math.round(ownerRating) ? 'text-amber-300' : 'text-white/30'}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-sm text-amber-200 ml-1">{ownerRating.toFixed(1)}</span>
              <span className="text-xs text-blue-200 ml-2">({ownerSwaps} takas)</span>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/20">
                Güven skoru %{trustScore}
              </span>
              {emailVerified && (
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/20">
                  ✓ E-posta doğrulandı
                </span>
              )}
              {phoneVerified && (
                <span className="rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/20">
                  ✓ Telefon doğrulandı
                </span>
              )}
              {isSelf && (
                <Link to="/trust" className="rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-50">
                  Güven merkezine git
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── İstatistik kartları ── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
        {[
          { icon: '📋', label: 'Aktif İlan', value: userListings.length.toString() },
          { icon: '🤝', label: 'Tamamlanan Takas', value: ownerSwaps.toString() },
          { icon: '💰', label: 'Toplam Portföy', value: fmt(totalValue) },
        ].map((s) => (
          <div key={s.label} className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700 shadow-sm">
            <div className="text-2xl mb-1">{s.icon}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">{s.label}</div>
            <div className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100">{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Kullanıcının ilanları ── */}
      <section>
        {isSelf && userListings.length > 0 && (
          <BulkListingActions listings={userListings} />
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            {isSelf ? 'İlanlarım' : `${ownerName} adlı kullanıcının ilanları`}
          </h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            {userListings.length} ilan
          </span>
        </div>

        {userListings.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center border border-slate-100 dark:border-slate-700">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-slate-500 dark:text-slate-400">Henüz aktif ilan yok</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {userListings.map((l) => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        )}
      </section>

      {editOpen && <ProfileEditModal onClose={() => setEditOpen(false)} />}
    </div>
  );
}
