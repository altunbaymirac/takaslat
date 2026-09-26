import { useSEO } from '../hooks/useSEO';

const providerName = import.meta.env.VITE_DATA_CONTROLLER_NAME as string | undefined;
const legalContactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL as string | undefined;

export default function Terms() {
  useSEO({
    title: 'Kullanım Koşulları',
    description: 'Takaslat platformunun kullanım, ilan, teklif ve kullanıcı sorumluluğu koşulları.',
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="border-b border-slate-200 pb-6 dark:border-slate-700">
        <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">Yasal Bilgilendirme</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-950 dark:text-white">Kullanım Koşulları</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Son güncelleme: 31 Ağustos 2026</p>
      </header>

      {!providerName || !legalContactEmail ? (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="alert">
          Platform işletmecisi unvanı ve yasal iletişim adresi production ortamında henüz tanımlanmamıştır.
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          Platform işletmecisi: <strong>{providerName}</strong>. İletişim: <a className="font-semibold text-blue-700 hover:underline dark:text-blue-300" href={`mailto:${legalContactEmail}`}>{legalContactEmail}</a>
        </p>
      )}

      <div className="mt-8 space-y-8 text-sm leading-7 text-slate-700 dark:text-slate-300">
        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Platformun rolü</h2>
          <p className="mt-2">Takaslat, kullanıcıların ilan yayınlamasına, teklif göndermesine ve takas görüşmesi yürütmesine aracılık eden bir platformdur. İlan konusu varlığın sahibi, satıcısı, alıcısı veya işlemin tarafı değildir.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Hesap ve ilan sorumluluğu</h2>
          <p className="mt-2">Kullanıcılar hesap bilgilerinin güvenliğinden; ilan, fotoğraf, açıklama, değer ve takas beklentilerinin doğru, güncel ve hukuka uygun olmasından sorumludur. Başkasına ait, yanıltıcı, sahte veya hak ihlali oluşturan içerik yayınlanamaz.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Teklif ve işlem güvenliği</h2>
          <p className="mt-2">Tekliflerin kabulü kullanıcılar arasında bağlayıcı bir satış veya devir işlemini tek başına tamamlamaz. Taraflar mülkiyet, ruhsat, tapu, ekspertiz, borç, haciz, vergi ve ödeme kontrollerini ilgili resmi kayıtlar ve uzmanlar üzerinden kendileri yapmalıdır.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Yasak kullanımlar ve moderasyon</h2>
          <p className="mt-2">Dolandırıcılık, spam, taciz, yasa dışı ürün veya hizmet, kimlik taklidi, güvenlik önlemlerini aşma ve platformu kötüye kullanma yasaktır. Takaslat riskli içerikleri inceleyebilir, görünürlüğünü sınırlayabilir, ilanı kaldırabilir veya hesabı askıya alabilir.</p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Değişiklikler ve iletişim</h2>
          <p className="mt-2">Koşullar hizmet veya mevzuat değişikliklerine göre güncellenebilir. Güncel sürüm bu sayfada yayınlanır. Yasal bildirim ve destek talepleri, yukarıda belirtilen iletişim adresine gönderilebilir.</p>
        </section>
      </div>
    </main>
  );
}
