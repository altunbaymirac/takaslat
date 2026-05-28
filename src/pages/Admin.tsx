import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdminListings, fetchAdminStats, moderateListing, sendTestNotification, fetchAdminUsers, setUserRole, banUser, type AdminStats, type AdminUser } from '../services/api';
import type { Listing } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';
import { showToast } from '../components/Toast';
import { getListingHealth, toneForScore } from '../lib/listingHealth';

type AdminListing = Listing & {
  moderationStatus?: string;
  rejectionReason?: string | null;
  owner?: { id: string; name: string; email: string };
};

const fmt = (n: number) => new Intl.NumberFormat('tr-TR').format(n);

export default function Admin() {
  useSEO({ title: 'Admin Paneli' });

  const currentUser = useAppStore((s) => s.currentUser);
  const pushNotification = useAppStore((s) => s.pushNotification);
  const [tab, setTab] = useState<'listings' | 'users'>('listings');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [listings, setListings] = useState<AdminListing[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [status, setStatus] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.email === 'demo@takaslat.com';

  async function load() {
    setLoading(true);
    try {
      if (tab === 'listings') {
        const [s, l] = await Promise.all([fetchAdminStats(), fetchAdminListings(status || undefined)]);
        setStats(s);
        setListings(l as AdminListing[]);
      } else {
        const [s, u] = await Promise.all([fetchAdminStats(), fetchAdminUsers(userSearch || undefined)]);
        setStats(s);
        setUsers(u);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Admin verisi alınamadı', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, status, tab, userSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  async function setModeration(id: string, next: 'pending' | 'approved' | 'rejected') {
    const reason = next === 'rejected' ? window.prompt('Red sebebi') ?? undefined : undefined;
    try {
      await moderateListing(id, next, reason);
      showToast('Moderasyon güncellendi', 'success');
      await load();
    } catch {
      showToast('Moderasyon güncellenemedi', 'error');
    }
  }

  async function changeRole(userId: string, role: 'USER' | 'ADMIN' | 'MODERATOR') {
    try {
      await setUserRole(userId, role);
      showToast(`Rol güncellendi: ${role}`, 'success');
      void load();
    } catch {
      showToast('Rol güncellenemedi', 'error');
    }
  }

  async function handleBan(userId: string, name: string) {
    if (!window.confirm(`"${name}" kullanıcısının tüm ilanları pasif yapılsın mı?`)) return;
    try {
      await banUser(userId);
      showToast('Kullanıcı banlandı, ilanları kaldırıldı', 'success');
      void load();
    } catch {
      showToast('Ban işlemi başarısız', 'error');
    }
  }

  async function testNotification() {
    try {
      const note = await sendTestNotification();
      pushNotification(note);
      showToast('Test bildirimi gönderildi', 'success');
    } catch {
      showToast('Test bildirimi gönderilemedi', 'error');
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin yetkisi gerekli</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Bu panel yalnızca moderasyon yetkisi olan kullanıcılar içindir.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Admin Paneli</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Moderasyon, güvenlik ve platform sağlığı tek ekranda.</p>
        </div>
        <button
          onClick={testNotification}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Test Bildirimi
        </button>
      </header>

      {stats && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-6">
          {[
            ['Kullanıcı', stats.users],
            ['Aktif ilan', stats.listings],
            ['İnceleme', stats.pendingListings],
            ['Teklif', stats.offers],
            ['Pasif/şikayet', stats.reports],
            ['Okunmamış', stats.notifications],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
              <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{fmt(Number(value))}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tab navigasyonu */}
      <div className="mb-4 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-900 w-fit">
        {(['listings', 'users'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-xl px-5 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            {t === 'listings' ? '📋 İlanlar' : '👥 Kullanıcılar'}
          </button>
        ))}
      </div>

      {/* ── İlan Moderasyonu ── */}
      {tab === 'listings' && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">İlan Moderasyonu</h2>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            >
              <option value="">Tümü</option>
              <option value="pending">İncelemede</option>
              <option value="approved">Onaylı</option>
              <option value="rejected">Reddedildi</option>
            </select>
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Yükleniyor...</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {listings.map((listing) => {
                const health = getListingHealth(listing);
                const tone = toneForScore(health.score);
                const toneClass: Record<string, string> = {
                  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  blue:    'bg-blue-50 text-blue-700 border-blue-200',
                  amber:   'bg-amber-50 text-amber-700 border-amber-200',
                  red:     'bg-red-50 text-red-700 border-red-200',
                };
                return (
                  <div key={listing.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link to={`/listing/${listing.id}`} className="font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100">
                          {listing.title}
                        </Link>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {listing.moderationStatus ?? 'approved'}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${toneClass[tone]}`}>
                          Kalite %{health.score}
                        </span>
                        {health.missing.length > 0 && (
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            {health.missing.length} eksik
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {listing.owner?.name ?? listing.ownerName} · {listing.city} · {fmt(listing.estimatedValue)} TL
                      </p>
                      {listing.rejectionReason && <p className="mt-1 text-xs text-red-600">{listing.rejectionReason}</p>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setModeration(listing.id, 'pending')} className="rounded-lg border border-amber-200 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">İncele</button>
                      <button onClick={() => setModeration(listing.id, 'approved')} className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Onayla</button>
                      <button onClick={() => setModeration(listing.id, 'rejected')} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">Reddet</button>
                    </div>
                  </div>
                );
              })}
              {listings.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">Bu filtrede ilan yok</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Kullanıcı Yönetimi ── */}
      {tab === 'users' && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Kullanıcı Yönetimi</h2>
            <input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Ad veya e-posta ara..."
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 w-56"
            />
          </div>

          {loading ? (
            <div className="p-8 text-center text-sm text-slate-500">Yükleniyor...</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.map((user) => (
                <div key={user.id} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{user.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        user.role === 'ADMIN' ? 'bg-violet-100 text-violet-700' :
                        user.role === 'MODERATOR' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}>
                        {user.role}
                      </span>
                      {user.emailVerified
                        ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">✓ E-posta</span>
                        : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">E-posta doğrulanmadı</span>
                      }
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {user.email} · {user._count.listings} ilan · {user._count.sentOffers} teklif · ⭐ {user.rating.toFixed(1)}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      Katılım: {new Date(user.createdAt).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      defaultValue={user.role}
                      onChange={(e) => changeRole(user.id, e.target.value as 'USER' | 'ADMIN' | 'MODERATOR')}
                      className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      <option value="USER">USER</option>
                      <option value="MODERATOR">MODERATOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button
                      onClick={() => handleBan(user.id, user.name)}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                    >
                      Ban
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="p-8 text-center text-sm text-slate-400">Kullanıcı bulunamadı</p>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
