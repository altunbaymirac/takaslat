import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import {
  confirmEmailVerification,
  confirmPhoneVerification,
  disableTwoFactor,
  requestEmailVerification,
  requestPhoneVerification,
  setupTwoFactor,
  verifyTwoFactor,
} from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';

const itemClass = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900';

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${
      ok
        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300'
        : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300'
    }`}>
      {ok ? 'Tamam' : 'Eksik'} · {label}
    </span>
  );
}

export default function TrustCenter() {
  useSEO({ title: 'Güven Merkezi', description: 'E-posta ve telefon doğrulama, 2FA ve hesap güvenliğini yönet.' });

  const { currentUser, updateProfile, initAuth } = useAppStore();
  const [phone, setPhone] = useState(currentUser?.phone ?? '');
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [emailDevCode, setEmailDevCode] = useState<string | null>(null);
  const [phoneDevCode, setPhoneDevCode] = useState<string | null>(null);
  const [twoFactorDevCode, setTwoFactorDevCode] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  const score = useMemo(() => {
    if (!currentUser) return 0;
    let value = 35;
    if (currentUser.emailVerified) value += 20;
    if (currentUser.phoneVerified) value += 20;
    if (currentUser.twoFactorEnabled) value += 15;
    if ((currentUser.totalSwaps ?? 0) > 0) value += 5;
    if ((currentUser.rating ?? 5) >= 4.7) value += 5;
    return Math.min(100, value);
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Güven merkezi için giriş gerekli</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Doğrulama, 2FA ve güvenlik ayarları hesabınıza bağlı çalışır.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          Giriş Yap
        </Link>
      </div>
    );
  }

  async function run(key: string, fn: () => Promise<void>) {
    setLoading(key);
    try {
      await fn();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 rounded-3xl bg-slate-950 p-6 text-white shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">Takaslat Güven Merkezi</p>
          <h1 className="mt-2 text-2xl font-black">Hesap, ilan ve takas güvenliği</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">
            Hesabınız SQLite veritabanında tutulur. Şifreler bcrypt ile hashlenir, oturumlar JWT ile yönetilir, yazma işlemleri kimlik doğrulama ister.
          </p>
        </div>
        <div className="min-w-[180px] rounded-2xl bg-white/10 p-4">
          <p className="text-xs text-slate-300">Güven skoru</p>
          <p className="mt-1 text-4xl font-black">%{score}</p>
          <div className="mt-3 h-2 rounded-full bg-white/15">
            <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${score}%` }} />
          </div>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        <Pill ok={Boolean(currentUser.emailVerified)} label="E-posta doğrulama" />
        <Pill ok={Boolean(currentUser.phoneVerified)} label="Telefon doğrulama" />
        <Pill ok={Boolean(currentUser.twoFactorEnabled)} label="2FA" />
        <Pill ok={(currentUser.totalSwaps ?? 0) > 0} label="Takas geçmişi" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <section className={itemClass}>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">E-posta doğrulama</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{currentUser.email}</p>
          {emailDevCode && (
            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Demo kod: {emailDevCode}
            </p>
          )}
          <div className="mt-4 space-y-2">
            <button
              disabled={currentUser.emailVerified || loading === 'email-request'}
              onClick={() => run('email-request', async () => {
                const res = await requestEmailVerification();
                setEmailDevCode(res.devCode ?? null);
                showToast(res.message, 'success');
              })}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Kod Gönder
            </button>
            <div className="flex gap-2">
              <input
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value)}
                maxLength={6}
                placeholder="6 haneli kod"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                disabled={currentUser.emailVerified || emailCode.length !== 6 || loading === 'email-confirm'}
                onClick={() => run('email-confirm', async () => {
                  await confirmEmailVerification(emailCode);
                  await initAuth();
                  showToast('E-posta doğrulandı', 'success');
                })}
                className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                Onayla
              </button>
            </div>
          </div>
        </section>

        <section className={itemClass}>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Telefon doğrulama</h2>
          <div className="mt-3 flex gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              onClick={() => run('phone-save', async () => {
                await updateProfile({ phone });
                await initAuth();
                showToast('Telefon kaydedildi', 'success');
              })}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200"
            >
              Kaydet
            </button>
          </div>
          {phoneDevCode && (
            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Demo kod: {phoneDevCode}
            </p>
          )}
          <div className="mt-4 space-y-2">
            <button
              disabled={currentUser.phoneVerified || loading === 'phone-request'}
              onClick={() => run('phone-request', async () => {
                const res = await requestPhoneVerification();
                setPhoneDevCode(res.devCode ?? null);
                showToast(res.message, 'success');
              })}
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              SMS Demo Kodu Gönder
            </button>
            <div className="flex gap-2">
              <input
                value={phoneCode}
                onChange={(e) => setPhoneCode(e.target.value)}
                maxLength={6}
                placeholder="6 haneli kod"
                className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                disabled={currentUser.phoneVerified || phoneCode.length !== 6 || loading === 'phone-confirm'}
                onClick={() => run('phone-confirm', async () => {
                  await confirmPhoneVerification(phoneCode);
                  await initAuth();
                  showToast('Telefon doğrulandı', 'success');
                })}
                className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
              >
                Onayla
              </button>
            </div>
          </div>
        </section>

        <section className={itemClass}>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">İki adımlı doğrulama</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Girişte e-posta kodu isteyerek hesap ele geçirilme riskini azaltır.
          </p>
          {twoFactorDevCode && (
            <p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
              Demo kod: {twoFactorDevCode}
            </p>
          )}
          <div className="mt-4 space-y-2">
            {!currentUser.twoFactorEnabled ? (
              <>
                <button
                  onClick={() => run('2fa-setup', async () => {
                    const res = await setupTwoFactor();
                    setTwoFactorDevCode(res.devCode ?? null);
                    showToast(res.message, 'success');
                  })}
                  className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  2FA Kod Oluştur
                </button>
                <div className="flex gap-2">
                  <input
                    value={twoFactorCode}
                    onChange={(e) => setTwoFactorCode(e.target.value)}
                    maxLength={6}
                    placeholder="6 haneli kod"
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                  />
                  <button
                    disabled={twoFactorCode.length !== 6}
                    onClick={() => run('2fa-verify', async () => {
                      await verifyTwoFactor(twoFactorCode);
                      await initAuth();
                      showToast('2FA aktif edildi', 'success');
                    })}
                    className="rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    Aktif Et
                  </button>
                </div>
              </>
            ) : (
              <button
                onClick={() => run('2fa-disable', async () => {
                  await disableTwoFactor();
                  await initAuth();
                  showToast('2FA kapatıldı', 'success');
                })}
                className="w-full rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                2FA Kapat
              </button>
            )}
          </div>
        </section>
      </div>

      <section className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className={itemClass}>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Veri ve saklama</h2>
          <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <p>Veritabanı: <strong>server/prisma/dev.db</strong> SQLite dosyası.</p>
            <p>Şifreler: bcrypt hash, düz metin şifre saklanmaz.</p>
            <p>Oturum: 7 gün süreli JWT token, frontend localStorage içinde tutulur.</p>
            <p>Dosyalar: lokal upload klasörü; production için S3 uyumlu depolamaya taşınabilir.</p>
          </div>
        </div>
        <div className={itemClass}>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Güvenli takas checklist</h2>
          <div className="mt-3 grid gap-2 text-sm text-slate-600 dark:text-slate-300">
            {[
              'Ekspertiz ve servis belgelerini görüşme içinde isteyin.',
              'Nakit farkı yazılı teklif revizyonu ile netleştirin.',
              'Buluşmayı kamusal ve güvenli bir lokasyonda planlayın.',
              'Ruhsat, IMEI veya tapu bilgilerini işlem öncesi doğrulayın.',
              'Platform dışı ödeme veya kapora taleplerine dikkat edin.',
            ].map((item) => (
              <p key={item} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-950">{item}</p>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
