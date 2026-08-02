import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { requestEmailVerification } from '../services/api';
import { showToast } from '../components/Toast';
import { useSEO } from '../hooks/useSEO';

const checklist = [
  'Ürün veya aracı görmeden kapora göndermeyin.',
  'Ekspertiz, servis ve sahiplik belgelerini işlemden önce kontrol edin.',
  'Nakit farkını ve takas koşullarını görüşme içinde yazılı olarak netleştirin.',
  'Buluşmayı aydınlık, kamusal ve güvenli bir yerde planlayın.',
  'Ruhsat, şasi, IMEI veya tapu bilgilerini resmi kayıtlarla karşılaştırın.',
  'Şüpheli ödeme bağlantılarına ve platform dışına yönlendiren taleplere dikkat edin.',
];

export default function TrustCenter() {
  useSEO({ title: 'Güvenli Takas', description: 'Hesap doğrulama durumunu kontrol et ve güvenli takas adımlarını incele.' });

  const currentUser = useAppStore((state) => state.currentUser);
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const score = useMemo(() => {
    if (!currentUser) return 0;
    let value = 50;
    if (currentUser.emailVerified) value += 25;
    if (currentUser.phoneVerified) value += 10;
    if ((currentUser.totalSwaps ?? 0) > 0) value += 10;
    if ((currentUser.rating ?? 0) >= 4.7) value += 5;
    return Math.min(100, value);
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Hesap durumunu görmek için giriş yapın</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400">Doğrulama bilgileriniz hesabınıza bağlıdır.</p>
        <Link to="/login" className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">
          Giriş yap
        </Link>
      </div>
    );
  }

  async function sendVerification() {
    setLoading(true);
    try {
      const result = await requestEmailVerification();
      setEmailSent(true);
      showToast(result.message, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Doğrulama bağlantısı gönderilemedi', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-slate-200 pb-6 dark:border-slate-800">
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Güvenli takas</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950 dark:text-white">İşlem öncesi hesabınızı ve ilanı kontrol edin</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Doğrulanmış hesap bilgileri karşı tarafa güven verir. Takas kararını vermeden önce belge ve ürün kontrollerini tamamlayın.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Hesap güven skoru</p>
          <p className="mt-2 text-4xl font-bold text-slate-950 dark:text-white">%{score}</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600" style={{ width: `${score}%` }} />
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-300">E-posta</dt>
              <dd className={currentUser.emailVerified ? 'font-semibold text-blue-700 dark:text-blue-300' : 'font-semibold text-slate-500'}>
                {currentUser.emailVerified ? 'Doğrulandı' : 'Doğrulanmadı'}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-300">Tamamlanan takas</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">{currentUser.totalSwaps ?? 0}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-600 dark:text-slate-300">Kullanıcı puanı</dt>
              <dd className="font-semibold text-slate-900 dark:text-white">
                {currentUser.rating != null ? currentUser.rating.toFixed(1) : 'Henüz yok'}
              </dd>
            </div>
          </dl>
        </aside>

        <div className="space-y-6">
          {!currentUser.emailVerified && (
            <section className="border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-bold text-slate-950 dark:text-white">E-posta adresinizi doğrulayın</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{currentUser.email}</p>
              {emailSent ? (
                <p className="mt-4 border-l-2 border-blue-600 pl-3 text-sm text-slate-700 dark:text-slate-200">
                  Doğrulama bağlantısı gönderildi. Gelen kutunuzu ve spam klasörünü kontrol edin.
                </p>
              ) : (
                <button
                  disabled={loading}
                  onClick={() => void sendVerification()}
                  className="mt-4 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Gönderiliyor...' : 'Doğrulama bağlantısı gönder'}
                </button>
              )}
            </section>
          )}

          <section className="border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <h2 className="font-bold text-slate-950 dark:text-white">İşlem öncesi kontrol listesi</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Teklif vermeden ve buluşmadan önce bu adımları tamamlayın.</p>
            </div>
            <ol className="divide-y divide-slate-100 dark:divide-slate-800">
              {checklist.map((item, index) => (
                <li key={item} className="flex gap-4 px-5 py-4 text-sm leading-6 text-slate-700 dark:text-slate-200">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    {index + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="border-l-2 border-slate-300 px-4 py-1 dark:border-slate-700">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Şüpheli bir durum mu var?</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              İlan detayındaki bildirim seçeneğini kullanın ve görüşme içinde kişisel veya finansal bilgi paylaşmayın.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
