import { useSEO } from '../hooks/useSEO';

const controllerName = import.meta.env.VITE_DATA_CONTROLLER_NAME as string | undefined;
const legalContactEmail = import.meta.env.VITE_LEGAL_CONTACT_EMAIL as string | undefined;

export default function Privacy() {
  useSEO({
    title: 'Gizlilik ve Çerez Politikası',
    description: 'Takaslat kişisel veri işleme, çerez ve reklam ölçümü politikası.',
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <header className="border-b border-slate-200 pb-6 dark:border-slate-700">
        <p className="text-xs font-bold uppercase text-blue-700 dark:text-blue-300">Yasal bilgilendirme</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white sm:text-3xl">Gizlilik ve Çerez Politikası</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Son güncelleme: 31 Ağustos 2026</p>
      </header>

      <div className="space-y-8 py-8 text-sm leading-7 text-slate-700 dark:text-slate-200">
        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Veri sorumlusu</h2>
          {controllerName && legalContactEmail ? (
            <p className="mt-2">
              Veri sorumlusu <strong>{controllerName}</strong> kuruluşudur. Kişisel verilerle ilgili başvurularınızı{' '}
              <a className="font-semibold text-blue-700 underline dark:text-blue-300" href={`mailto:${legalContactEmail}`}>{legalContactEmail}</a>{' '}
              adresine iletebilirsiniz.
            </p>
          ) : (
            <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
              Veri sorumlusu unvanı ve yasal iletişim adresi production ortamında henüz tanımlanmamıştır.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">İşlenen veriler</h2>
          <p className="mt-2">
            Hesap ve doğrulama bilgileri, ilan içerikleri, teklif ve görüşme kayıtları, güvenlik kayıtları, cihaz ve kullanım
            bilgileri işlenebilir. Özel belgeler yalnızca yetkili kullanıcıların erişebildiği özel depolama alanında tutulur.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">İşleme amaçları ve hukuki sebepler</h2>
          <p className="mt-2">
            Veriler; üyelik ve ilan hizmetlerinin sunulması, takas görüşmelerinin yürütülmesi, dolandırıcılığın önlenmesi,
            güvenlik, destek ve yasal yükümlülüklerin yerine getirilmesi amaçlarıyla sözleşmenin kurulması veya ifası,
            hukuki yükümlülük ve meşru menfaat sebeplerine dayanılarak işlenir. Analitik ve reklam ölçümü yalnızca ayrıca
            izin verdiğinizde etkinleştirilir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Aktarımlar</h2>
          <p className="mt-2">
            Barındırma, veritabanı, kimlik doğrulama ve güvenlik hizmetleri için Vercel ve Supabase altyapıları kullanılır.
            İzin vermeniz halinde kullanım ve dönüşüm olayları Google Analytics ve Meta ile paylaşılabilir. Teklif mesajı,
            ilan açıklaması, e-posta veya telefon gibi doğrudan tanımlayıcı veriler reklam olaylarına eklenmez.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Çerez tercihleri</h2>
          <p className="mt-2">
            Oturum ve güvenlik için zorunlu depolama kullanılır. Analitik ve reklam ölçümü varsayılan olarak kapalıdır.
            Footer bölümündeki “Çerez tercihleri” bağlantısından kararınızı değiştirebilirsiniz. İzin geri çekildiğinde
            ilgili ölçüm sağlayıcılarına ret sinyali gönderilir ve erişilebilen ölçüm çerezleri temizlenir.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-950 dark:text-white">Saklama ve haklarınız</h2>
          <p className="mt-2">
            Veriler hizmetin sunulması ve yasal yükümlülükler için gerekli süre boyunca saklanır. KVKK kapsamındaki bilgi
            talep etme, düzeltme, silme ve itiraz haklarını veri sorumlusu iletişim adresi üzerinden kullanabilirsiniz.
          </p>
        </section>
      </div>
    </div>
  );
}
