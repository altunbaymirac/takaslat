import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { playDing } from '../lib/sound';
import {
  requestEmailVerification,
  getEmailNotificationPref,
  setEmailNotificationPref,
  forgotPassword,
} from '../services/api';
import { showToast } from '../components/Toast';
import ProfileEditModal from '../components/ProfileEditModal';
import { useSEO } from '../hooks/useSEO';

const legalContactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL as string | undefined;

// ─── Küçük yapı taşları ─────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm">
      <h2 className="px-5 pt-5 pb-1 text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h2>
      <div className="divide-y divide-slate-100 dark:divide-slate-700 px-5 pb-2">{children}</div>
    </section>
  );
}

function Row({ label, hint, children }: { label: string; hint?: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-3.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

function Toggle({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={on}
      className={`relative w-12 h-6 shrink-0 rounded-full overflow-hidden transition-colors disabled:opacity-50 ${on ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${on ? 'translate-x-6' : 'translate-x-0'}`}
      />
    </button>
  );
}

const secondaryBtn =
  'rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700';

// ─── Sayfa ──────────────────────────────────────────────────────────────────

export default function Settings() {
  useSEO({ title: 'Ayarlar', description: 'Hesap ayarlarını, bildirimlerini ve güvenlik tercihlerini yönet.', noIndex: true });

  const navigate = useNavigate();
  const { darkMode, toggleDarkMode, soundEnabled, toggleSound, currentUser, logoutUser } = useAppStore();
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [mailPref, setMailPref] = useState(true);
  const [mailPrefSaving, setMailPrefSaving] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    let alive = true;
    getEmailNotificationPref()
      .then((value) => { if (alive) setMailPref(value); })
      .catch(() => { /* varsayılan açık kalsın */ });
    return () => { alive = false; };
  }, [currentUser]);

  async function toggleMailNotifications() {
    const next = !mailPref;
    setMailPrefSaving(true);
    setMailPref(next);
    try {
      await setEmailNotificationPref(next);
      showToast(next ? 'Bildirim e-postaları açıldı' : 'Bildirim e-postaları kapatıldı', 'success');
    } catch {
      setMailPref(!next);
      showToast('Tercih kaydedilemedi, tekrar dene', 'error');
    } finally {
      setMailPrefSaving(false);
    }
  }

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

  async function sendPasswordReset() {
    if (!currentUser?.email) return;
    setResetLoading(true);
    try {
      await forgotPassword(currentUser.email);
      setResetSent(true);
      showToast('Şifre değiştirme bağlantısı e-postana gönderildi', 'success');
    } catch {
      showToast('Bağlantı gönderilemedi, biraz sonra tekrar dene', 'error');
    } finally {
      setResetLoading(false);
    }
  }

  function logout() {
    logoutUser();
    showToast('Oturum kapatıldı', 'success');
    navigate('/');
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

  const initial = (currentUser.name || currentUser.email || '?').trim().charAt(0).toLocaleUpperCase('tr-TR');
  const deletionMail = legalContactEmail
    ? `mailto:${legalContactEmail}?subject=${encodeURIComponent('Hesap silme talebi')}&body=${encodeURIComponent(
        `Merhaba,\n\nTakaslat hesabımın ve kişisel verilerimin silinmesini talep ediyorum.\n\nHesap e-postası: ${currentUser.email}\n`,
      )}`
    : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Ayarlar</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Hesabını, bildirimlerini, güvenliğini ve gizlilik tercihlerini buradan yönet.
        </p>
      </header>

      <div className="space-y-4">

        {/* Hesap */}
        <Section title="Hesap">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              {currentUser.avatar ? (
                <img src={currentUser.avatar} alt="" className="h-12 w-12 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-lg font-bold text-white">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{currentUser.name || 'İsimsiz kullanıcı'}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {currentUser.email}{currentUser.city ? ` · ${currentUser.city}` : ''}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setEditOpen(true)} className={secondaryBtn}>
                Profili düzenle
              </button>
              <Link to={`/profile/${currentUser.id}`} className={secondaryBtn}>
                Profilimi gör
              </Link>
            </div>
          </div>
        </Section>

        {/* Görünüm */}
        <Section title="Görünüm">
          <Row label="Karanlık mod" hint="Göz yormayan koyu tema">
            <Toggle on={darkMode} onClick={toggleDarkMode} label="Karanlık modu aç/kapat" />
          </Row>
        </Section>

        {/* Bildirimler */}
        <Section title="Bildirimler">
          <Row label="Sesli bildirim" hint="Yeni teklif veya mesaj geldiğinde kısa bir ses çalar">
            {soundEnabled && (
              <button
                type="button"
                onClick={() => playDing()}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Dene
              </button>
            )}
            <Toggle on={soundEnabled} onClick={toggleSound} label="Sesli bildirimi aç/kapat" />
          </Row>
          <Row
            label="E-posta bildirimi"
            hint={<>Teklif, mesaj ve ilan sonucu için <span className="break-all">{currentUser.email}</span> adresine mail gelsin</>}
          >
            <Toggle
              on={mailPref}
              onClick={toggleMailNotifications}
              disabled={mailPrefSaving}
              label="E-posta bildirimlerini aç/kapat"
            />
          </Row>
        </Section>

        {/* Güvenlik */}
        <Section title="Güvenlik">
          <Row
            label="E-posta doğrulama"
            hint={
              currentUser.emailVerified
                ? 'Hesabın doğrulandı.'
                : emailSent
                  ? <>Doğrulama bağlantısı <strong>{currentUser.email}</strong> adresine gönderildi.</>
                  : 'Doğrulanmış hesaplar karşı tarafa daha çok güven verir.'
            }
          >
            {currentUser.emailVerified ? (
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                Doğrulandı
              </span>
            ) : !emailSent && (
              <button
                type="button"
                onClick={sendVerificationLink}
                disabled={emailLoading}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 whitespace-nowrap"
              >
                {emailLoading ? 'Gönderiliyor…' : 'Bağlantı gönder'}
              </button>
            )}
          </Row>
          <Row
            label="Şifre"
            hint={resetSent
              ? 'Bağlantı gönderildi. E-postandaki bağlantıdan yeni şifreni belirle.'
              : 'E-postana gönderilecek bağlantıyla yeni şifre belirlersin.'}
          >
            {!resetSent && (
              <button type="button" onClick={sendPasswordReset} disabled={resetLoading} className={secondaryBtn}>
                {resetLoading ? 'Gönderiliyor…' : 'Şifremi değiştir'}
              </button>
            )}
          </Row>
        </Section>

        {/* Gizlilik ve veriler */}
        <Section title="Gizlilik ve veriler">
          <Row label="Çerez tercihleri" hint="Analitik ve reklam ölçümüne verdiğin izni değiştir">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('takaslat:open-consent'))}
              className={secondaryBtn}
            >
              Düzenle
            </button>
          </Row>
          <Row label="Politikalar" hint="Verilerinin nasıl işlendiğini ve kullanım şartlarını oku">
            <Link to="/gizlilik" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Gizlilik</Link>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <Link to="/kullanim-kosullari" className="text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300">Koşullar</Link>
          </Row>
          {deletionMail && (
            <Row label="Hesabımı sil" hint="KVKK kapsamında hesabının ve kişisel verilerinin silinmesini talep edebilirsin.">
              <a
                href={deletionMail}
                className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
              >
                Silme talebi gönder
              </a>
            </Row>
          )}
        </Section>

        <button
          type="button"
          onClick={logout}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          Oturumu kapat
        </button>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 pb-2">
          Takaslat · © {new Date().getFullYear()} Tüm hakları saklıdır.
        </p>
      </div>

      {editOpen && <ProfileEditModal onClose={() => setEditOpen(false)} />}
    </div>
  );
}
