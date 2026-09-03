import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { playDing } from '../lib/sound';
import { requestEmailVerification } from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';

export default function Settings() {
  useSEO({ title: 'Ayarlar', description: 'Hesap ayarlarını, bildirimlerini ve güvenlik tercihlerini yönet.', noIndex: true });

  const { darkMode, toggleDarkMode, soundEnabled, toggleSound, currentUser } = useAppStore();
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  async function sendVerificationLink() {
    setEmailLoading(true);
    try {
      const res = await requestEmailVerification();
      setEmailSent(true);
      showToast(res.message, 'success');
    } catch {
      showToast('Bağlantı gönderilemedi, tekrar dene', 'error');
    } finally {
      setEmailLoading(false);
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
          <div className="flex items-center justify-between py-3">
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
                {!currentUser.emailVerified && !emailSent && (
                  <button
                    onClick={sendVerificationLink}
                    disabled={emailLoading}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
                  >
                    {emailLoading ? 'Gönderiliyor…' : 'Link Gönder'}
                  </button>
                )}
              </div>
              {emailSent && !currentUser.emailVerified && (
                <p className="mt-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                  Doğrulama bağlantısı <strong>{currentUser.email}</strong> adresine gönderildi. E-postanızdaki bağlantıya tıklayın.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">2 Aşamalı Doğrulama</p>
            <p className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
              2FA yakında · Google Authenticator ve benzeri uygulamalar desteklenecek.
            </p>
          </div>
        </section>

        {/* Versiyon */}
        <p className="text-center text-xs text-slate-400 dark:text-slate-600 pb-2">
          Takaslat v1.0.0 · © {new Date().getFullYear()} Tüm hakları saklıdır.
        </p>
      </div>
    </div>
  );
}
