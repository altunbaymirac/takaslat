import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { playDing } from '../lib/sound';
import { disableTwoFactor, setupTwoFactor, verifyTwoFactor, requestEmailVerification, confirmEmailVerification } from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';

const ACCENT_OPTIONS: { id: string; name: string; bgClass: string }[] = [
  { id: 'blue',    name: 'Mavi',    bgClass: 'bg-blue-600'    },
  { id: 'emerald', name: 'Yeşil',   bgClass: 'bg-emerald-600' },
  { id: 'violet',  name: 'Mor',     bgClass: 'bg-violet-600'  },
  { id: 'orange',  name: 'Turuncu', bgClass: 'bg-orange-600'  },
  { id: 'pink',    name: 'Pembe',   bgClass: 'bg-pink-600'    },
  { id: 'teal',    name: 'Turkuaz', bgClass: 'bg-teal-600'    },
];

export default function Settings() {
  useSEO({ title: 'Ayarlar', description: 'Hesap ayarlarını, bildirimlerini ve güvenlik tercihlerini yönet.' });

  const { darkMode, toggleDarkMode, soundEnabled, toggleSound, accentColor, setAccentColor, resetOnboarding, currentUser } = useAppStore();
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [twoFactorLoading, setTwoFactorLoading] = useState(false);

  // E-posta doğrulama
  const [emailCode, setEmailCode]         = useState('');
  const [emailDevCode, setEmailDevCode]   = useState<string | null>(null);
  const [emailLoading, setEmailLoading]   = useState<'request' | 'confirm' | null>(null);

  async function startTwoFactor() {
    setTwoFactorLoading(true);
    try {
      const res = await setupTwoFactor();
      setDevCode(res.devCode ?? null);
      showToast('2FA kodu oluşturuldu', 'success');
    } catch {
      showToast('2FA başlatılamadı', 'error');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function confirmTwoFactor() {
    setTwoFactorLoading(true);
    try {
      await verifyTwoFactor(twoFactorCode);
      useAppStore.setState((s) => ({ currentUser: s.currentUser ? { ...s.currentUser, twoFactorEnabled: true } : s.currentUser }));
      setTwoFactorCode('');
      setDevCode(null);
      showToast('2FA aktif edildi', 'success');
    } catch {
      showToast('Kod hatalı veya süresi doldu', 'error');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  async function startEmailVerification() {
    setEmailLoading('request');
    try {
      const res = await requestEmailVerification();
      setEmailDevCode((res as { devCode?: string }).devCode ?? null);
      showToast('Doğrulama kodu oluşturuldu', 'success');
    } catch {
      showToast('Kod gönderilemedi, tekrar dene', 'error');
    } finally {
      setEmailLoading(null);
    }
  }

  async function confirmEmailCode() {
    setEmailLoading('confirm');
    try {
      await confirmEmailVerification(emailCode);
      useAppStore.setState((s) => ({ currentUser: s.currentUser ? { ...s.currentUser, emailVerified: true } : s.currentUser }));
      setEmailCode('');
      setEmailDevCode(null);
      showToast('E-posta doğrulandı ✓', 'success');
    } catch {
      showToast('Kod hatalı veya süresi doldu', 'error');
    } finally {
      setEmailLoading(null);
    }
  }

  async function turnOffTwoFactor() {
    setTwoFactorLoading(true);
    try {
      await disableTwoFactor();
      useAppStore.setState((s) => ({ currentUser: s.currentUser ? { ...s.currentUser, twoFactorEnabled: false } : s.currentUser }));
      showToast('2FA kapatıldı', 'success');
    } catch {
      showToast('2FA kapatılamadı', 'error');
    } finally {
      setTwoFactorLoading(false);
    }
  }

  if (!currentUser) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">Ayarlara erişmek için giriş yap</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xs mb-6">Hesap ayarlarını yönetmek için giriş yapman gerekiyor.</p>
        <div className="flex gap-3">
          <a href="/login" className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors">Giriş Yap</a>
          <a href="/register" className="px-5 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl transition-colors">Kayıt Ol</a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <span>⚙️</span> Ayarlar
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Görünüm, ses ve dil tercihlerini kişiselleştir.
        </p>
      </header>

      <div className="space-y-4">

        {/* Görünüm */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🎨</span> Görünüm
          </h2>

          {/* Dark mode */}
          <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Karanlık Mod</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Göz yormayan koyu tema</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full overflow-hidden transition-colors ${darkMode ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Accent color */}
          <div className="py-3 border-b border-slate-100 dark:border-slate-700">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-1">Vurgu Rengi</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Butonlar, linkler ve seçimler bu rengi kullanır</p>
            <div className="flex flex-wrap gap-2">
              {ACCENT_OPTIONS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setAccentColor(c.id)}
                  className={`w-10 h-10 rounded-full ${c.bgClass} relative transition-transform hover:scale-110 ${
                    accentColor === c.id ? 'ring-2 ring-offset-2 dark:ring-offset-slate-800 ring-slate-900 dark:ring-white' : ''
                  }`}
                  title={c.name}
                >
                  {accentColor === c.id && (
                    <svg className="absolute inset-0 m-auto w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 italic">
              💡 Şu anki vurgu: <span className="font-semibold capitalize text-slate-600 dark:text-slate-300">{ACCENT_OPTIONS.find((a) => a.id === accentColor)?.name}</span>
            </p>
          </div>
        </section>

        {/* Ses */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🔔</span> Bildirim Sesleri
          </h2>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">Sesli Bildirim</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Yeni teklif/mesaj geldiğinde sessiz ding 🛎️</p>
            </div>
            <div className="flex items-center gap-2">
              {soundEnabled && (
                <button
                  onClick={() => playDing()}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                >
                  🎵 Test
                </button>
              )}
              <button
                onClick={toggleSound}
                className={`relative w-12 h-6 rounded-full overflow-hidden transition-colors ${soundEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                    soundEnabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </section>


        {/* Güvenlik */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <span>🔐</span> Güvenlik
          </h2>

          {/* E-posta doğrulama */}
          {currentUser && (
            <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-700">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    E-posta Doğrulama
                    {currentUser.emailVerified
                      ? <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">✓ Doğrulandı</span>
                      : <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">Doğrulanmadı</span>
                    }
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{currentUser.email}</p>
                </div>
                {!currentUser.emailVerified && (
                  <button
                    onClick={startEmailVerification}
                    disabled={emailLoading === 'request'}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                  >
                    {emailLoading === 'request' ? 'Gönderiliyor…' : 'Kod Gönder'}
                  </button>
                )}
              </div>

              {emailDevCode && !currentUser.emailVerified && (
                <div className="mt-3 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-3">
                  <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                    Geliştirme kodu: <strong>{emailDevCode}</strong>
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      placeholder="6 haneli kod"
                      className="min-w-0 flex-1 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                    />
                    <button
                      onClick={confirmEmailCode}
                      disabled={emailCode.length !== 6 || emailLoading === 'confirm'}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {emailLoading === 'confirm' ? '…' : 'Onayla'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">2 Aşamalı Doğrulama</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Girişte e-posta kodu ister. Geliştirme modunda kod server loguna da yazılır.
              </p>
            </div>
            {currentUser?.twoFactorEnabled ? (
              <button
                onClick={turnOffTwoFactor}
                disabled={twoFactorLoading}
                className="rounded-xl bg-red-50 dark:bg-red-900/20 px-4 py-2 text-sm font-semibold text-red-700 dark:text-red-300 disabled:opacity-50"
              >
                Kapat
              </button>
            ) : (
              <button
                onClick={startTwoFactor}
                disabled={twoFactorLoading || !currentUser}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                2FA Başlat
              </button>
            )}
          </div>

          {!currentUser && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">2FA için giriş yapmalısın.</p>
          )}

          {devCode && (
            <div className="mt-4 rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-900/20 p-3">
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">Geliştirme kodu: <strong>{devCode}</strong></p>
              <div className="flex gap-2">
                <input
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  maxLength={6}
                  placeholder="6 haneli kod"
                  className="min-w-0 flex-1 rounded-lg border border-blue-200 dark:border-blue-900 bg-white dark:bg-slate-950 px-3 py-2 text-sm text-slate-800 dark:text-slate-100"
                />
                <button
                  onClick={confirmTwoFactor}
                  disabled={twoFactorCode.length !== 6 || twoFactorLoading}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Onayla
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Onboarding */}
        <section className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-100 dark:border-slate-700 shadow-sm">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
            <span>🎓</span> Yardım & Rehber
          </h2>
          <button
            onClick={resetOnboarding}
            className="w-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium text-sm py-2.5 rounded-xl border border-blue-100 dark:border-blue-900/40"
          >
            🎉 Onboarding Turunu Tekrar Göster
          </button>
        </section>

        {/* Versiyon */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-2">
          Takaslat v1.0.0 · © {new Date().getFullYear()} Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
}
