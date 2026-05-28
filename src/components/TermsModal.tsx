import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function TermsModal() {
  const { termsAccepted, acceptTerms } = useAppStore();
  const [scrolled, setScrolled] = useState(false);
  const [checked, setChecked] = useState(false);

  if (termsAccepted) return null;

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setScrolled(true);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">⚖️</span>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Kullanım Koşulları & Yasal Uyarı
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Devam etmek için lütfen okuyun ve onaylayın.
          </p>
        </div>

        {/* Scrollable content */}
        <div
          className="overflow-y-auto px-6 py-4 flex-1 space-y-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed"
          onScroll={handleScroll}
        >
          <section>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">1. Platform Hakkında</h3>
            <p>
              Takaslat, kullanıcıların araç, elektronik, gayrimenkul ve diğer varlıklarını birbiriyle takas etmesini
              kolaylaştıran bir aracı platformdur. Takaslat, yapılan hiçbir takas işleminin tarafı değildir;
              alıcı ve satıcı/takas eden taraflar arasındaki sözleşmenin tarafları yalnızca ilgili kullanıcılardır.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">
              2. ⚠️ Vergi ve Yasal Yükümlülükler
            </h3>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 space-y-2">
              <p className="font-semibold text-amber-800 dark:text-amber-300">
                Türkiye Vergi Mevzuatı Uyarısı
              </p>
              <p>
                Türk vergi mevzuatı kapsamında takas işlemleri <strong>barter/takas</strong> niteliği
                taşıyabilir ve gelir vergisi, KDV veya diğer yasal yükümlülüklere konu olabilir.
                Özellikle ticari nitelik taşıyan veya tekrar eden takas işlemleri vergi dairesine
                beyan edilmesi gerekebilir.
              </p>
              <p>
                <strong>Takaslat</strong>, gerçekleştirilen işlemler nedeniyle doğabilecek herhangi
                bir <strong>vergi, ceza veya yasal yaptırımdan sorumlu tutulamaz.</strong>
                Kullanıcılar, kendi işlemlerine ilişkin yasal yükümlülüklerinden bizzat sorumludur.
              </p>
              <p>
                Şüphe halinde bir <strong>mali müşavir veya avukattan</strong> profesyonel destek almanızı tavsiye ederiz.
              </p>
            </div>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">3. Güvenli Takas İlkeleri</h3>
            <ul className="list-disc pl-4 space-y-1 text-xs">
              <li>Kapora veya ödeme göndermeden önce aracı/ürünü yerinde görün.</li>
              <li>Araç takaslarında noterde devir işlemi yaptırın.</li>
              <li>Tanımadığınız kişilerle ıssız yerlerde buluşmaktan kaçının.</li>
              <li>Ekspertiz raporunu ve tüm belgeleri karşılıklı paylaşın.</li>
              <li>Takas bedelini ve fark ödemesini yazılı belgeleyin.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">4. Yasak İçerikler</h3>
            <p>
              Sahte ilan oluşturmak, başkalarını dolandırmak, yasal olmayan ürünleri listelemek
              kesinlikle yasaktır ve hesap kapatma ile yasal işlem başlatılmasına yol açar.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">5. Gizlilik</h3>
            <p>
              Kişisel verileriniz Türk Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında
              işlenmektedir. Verileriniz üçüncü şahıslarla satılmaz veya paylaşılmaz.
            </p>
          </section>

          <section>
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-1">6. Sorumluluk Sınırı</h3>
            <p>
              Takaslat, kullanıcılar arasındaki anlaşmazlıklardan, dolandırıcılık girişimlerinden,
              araç/ürün kusurlarından veya yasal uyumsuzluklardan sorumlu tutulamaz. Platform
              yalnızca bir buluşma ve iletişim ortamı sağlar.
            </p>
          </section>

          <p className="text-xs text-slate-400 dark:text-slate-500 italic">
            Son güncelleme: Mayıs 2026 · Takaslat v1.0
          </p>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 space-y-3">
          {!scrolled && (
            <p className="text-xs text-center text-slate-400 dark:text-slate-500 animate-pulse">
              ↓ Tamamını okumak için kaydırın
            </p>
          )}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={checked}
              onChange={e => setChecked(e.target.checked)}
              disabled={!scrolled}
              className="mt-0.5 w-4 h-4 rounded accent-blue-600 disabled:opacity-40"
            />
            <span className={`text-xs leading-relaxed ${!scrolled ? 'text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-300'}`}>
              Kullanım koşullarını, vergi uyarısını ve gizlilik politikasını okudum, anladım ve kabul ediyorum.
              Gerçekleştireceğim takas işlemlerinin yasal yükümlülüklerinden şahsen sorumlu olduğumu kabul ediyorum.
            </span>
          </label>
          <button
            onClick={acceptTerms}
            disabled={!checked || !scrolled}
            className="w-full py-3 rounded-2xl font-bold text-sm transition-all
              bg-blue-600 text-white hover:bg-blue-700 active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
          >
            Kabul Et ve Devam Et
          </button>
        </div>
      </div>
    </div>
  );
}
