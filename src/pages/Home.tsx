import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO, useJsonLd } from '../hooks/useSEO';

const AIIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const FAQS = [
  {
    q: 'Takaslat nedir, araç takası nasıl yapılır?',
    a: 'Takaslat, aracını, evini veya arsanı başka bir araç ya da gayrimenkulle değiştirmeni sağlayan takas platformudur. İlanını fotoğrafları ve gerekli detaylarıyla yayınlarsın. Diğer kullanıcılar sana takas teklifi gönderir, sen de uygun bulduğun teklifleri değerlendirip pazarlık yapabilirsin. Anlaştığınızda güvenle buluşup takası tamamlarsınız.',
  },
  {
    q: 'İlan vermek ücretli mi?',
    a: 'Hayır, Takaslat\'ta ilan vermek tamamen ücretsizdir. Aracını fotoğraflayıp bilgilerini girerek dakikalar içinde yayına alabilirsin.',
  },
  {
    q: 'AI ile eşleştirme nasıl çalışıyor?',
    a: 'TakaslAI özelliğiyle aradığın aracı kendi cümlelerinle yazman yeterli — yapay zeka mevcut ilanlar arasından sana en uygun olanları saniyeler içinde sıralar.',
  },
  {
    q: 'Üstüne para ekleyerek takas yapabilir miyim?',
    a: 'Evet. Teklif verirken aracının değer farkını nakit olarak ekleyebilir veya talep edebilirsin, bu seçenek teklif ekranında mevcuttur.',
  },
  {
    q: 'Karşı tarafın güvenilir olduğunu nasıl anlarım?',
    a: 'Her kullanıcının profilinde geçmiş takasları, aldığı değerlendirmeler ve hesap doğrulama durumu şeffaf şekilde gösterilir. Güven skoruna bakarak karar verebilirsin.',
  },
  {
    q: 'Takas sırasında anlaşmazlık olursa ne olur?',
    a: 'Görüşmeler platform üzerinden mesajlaşma geçmişiyle birlikte tutulur. Anlaşmazlık durumunda destek ekibimize ulaşabilir, ayrıca buluşmayı her zaman güvenli ve halka açık bir noktada yapmanı öneririz.',
  },
];

export default function Home() {
  useSEO({
    title: 'Akıllı Takas Platformu',
    description: 'Takaslat ile araç, ev ve arsa takası yap. İlan ver, AI ile eşleş, teklif al ve güvenle buluş.',
    url: '/',
  });

  useJsonLd('site-jsonld', {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'Takaslat',
        url: 'https://www.takaslat.com/',
        logo: 'https://www.takaslat.com/pwa-512.png',
      },
      {
        '@type': 'WebSite',
        name: 'Takaslat',
        url: 'https://www.takaslat.com/',
        potentialAction: {
          '@type': 'SearchAction',
          target: 'https://www.takaslat.com/listings?q={search_term_string}',
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  });

  useJsonLd('faq-jsonld', {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  });

  const { listings } = useAppStore();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const heroStats = useMemo(() => {
    const count = listings.length;
    const cities = new Set(listings.map(l => l.city).filter(Boolean)).size;
    return { count, cities };
  }, [listings]);

  return (
    <>
      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <section className="relative overflow-hidden bg-blue-700">
        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {heroStats.count} aktif ilan · Türkiye geneli
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-4">
            Ne var ne yok, <span className="text-amber-400">takaslat.</span>
          </h1>

          <p className="text-blue-200 text-base sm:text-lg max-w-lg mx-auto mb-8 leading-relaxed">
            Araç, ev ve arsa takasının akıllı adresi. İlan ver, teklif al, güvenle buluş.
          </p>

          <div className="mx-auto grid w-full max-w-md grid-cols-2 gap-3 sm:flex sm:max-w-none sm:flex-wrap sm:justify-center">
            <Link
              to="/listings"
              className="flex min-h-12 items-center justify-center rounded-lg bg-white px-5 py-3 text-sm font-semibold text-blue-700 shadow-lg shadow-blue-900/20 transition-colors hover:bg-blue-50 sm:px-8"
            >
              İlanları Keşfet
            </Link>
            <Link
              to="/create"
              className="flex min-h-12 items-center justify-center rounded-lg bg-amber-400 px-5 py-3 text-sm font-semibold text-amber-950 shadow-lg shadow-amber-900/10 transition-colors hover:bg-amber-300 sm:px-8"
            >
              İlan ver
            </Link>
            <Link
              to="/listings?tab=ai"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-colors hover:bg-white/20 sm:px-8"
            >
              <AIIcon />
              TakaslAI
            </Link>
            <Link
              to="/auctions"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/30 bg-white/10 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-950/20 transition-colors hover:bg-white/20 sm:px-8"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 18.75h16.5M6 15.75l4.5-4.5 3 3L18 8.25M15 8.25h3v3" />
              </svg>
              Mezata Git
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative border-t border-white/10 bg-white/5 backdrop-blur-sm">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-2 divide-x divide-white/10">
            {[
              { n: `${heroStats.count}`, label: 'Aktif İlan' },
              { n: `${heroStats.cities}`, label: 'İl' },
            ].map(s => (
              <div key={s.label} className="py-5 text-center">
                <p className="text-2xl font-bold text-white">{s.n}</p>
                <p className="text-blue-300 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════ NASIL ÇALIŞIR ══════════════════════════ */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Süreç</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              Takas bu kadar basit
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'İlanını ver',
                desc: 'Aracını fotoğrafla, teknik detayları ekle. 2 dakikada yayında.',
                icon: (
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                ),
              },
              {
                step: '2',
                title: 'Teklif al',
                desc: 'Diğer kullanıcılardan takas teklifleri gel, değerlendir, pazarlık yap.',
                icon: (
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                ),
              },
              {
                step: '3',
                title: 'Güvenle buluş',
                desc: 'Anlaşıldı mı? Buluşma planla, takası tamamla, değerlendirme bırak.',
                icon: (
                  <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
            ].map(({ step, title, desc, icon }) => (
              <div key={step} className="relative flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mb-4 relative">
                  {icon}
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center">
                    {step}
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════ ÖZELLİKLER ══════════════════════════ */}
      <section className="py-16 bg-slate-50 dark:bg-slate-950">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Neden Takaslat?</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              Akıllı özellikler, gerçek kolaylık
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {[
              {
                title: 'AI Eşleştirme',
                desc: 'Aradığın aracı doğal dille yaz; yapay zekamız en uygun ilanları saniyeler içinde sıralar.',
                color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',
                iconColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                icon: (
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                ),
              },
              {
                title: 'Canlı Sohbet',
                desc: 'Teklif sahibiyle doğrudan mesajlaş, pazarlık yap, buluşma planla. Her şey tek yerden.',
                color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',
                iconColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
                  </svg>
                ),
              },
              {
                title: 'Güven Skoru',
                desc: 'Her kullanıcının geçmiş takasları, yorumları ve profil doğrulaması şeffaf şekilde görünür.',
                color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',
                iconColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
              {
                title: 'Harita Görünümü',
                desc: 'Sana yakın ilanları haritada gör, filtrelemek yerine konumla keşfet.',
                color: 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/30',
                iconColor: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                ),
              },
            ].map(({ title, desc, color, iconColor, icon }) => (
              <div key={title} className={`rounded-2xl border p-6 ${color}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${iconColor}`}>
                  {icon}
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1.5">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-12 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-500">Takas kategorileri</p>
            <h2 className="mt-2 text-2xl font-extrabold text-slate-900 dark:text-slate-100">Aradığın takasa doğrudan ulaş</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { to: '/arac-takas', title: 'Araç takas', text: 'Otomobil ve diğer araç ilanlarını karşılaştır.' },
              { to: '/ev-takas', title: 'Ev takas', text: 'Daire, villa ve yazlık ilanlarını keşfet.' },
              { to: '/arsa-takas', title: 'Arsa takas', text: 'Arsa, tarla ve parsel ilanlarını incele.' },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="rounded-md border border-slate-200 p-5 transition-colors hover:border-blue-500 dark:border-slate-700 dark:hover:border-blue-500">
                <h3 className="font-bold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{item.text}</p>
                <span className="mt-4 inline-block text-sm font-bold text-blue-700 dark:text-blue-300">İlanları gör</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════ SSS ══════════════════════════ */}
      <section className="py-16 bg-white dark:bg-slate-900">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-2">Sıkça Sorulan Sorular</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100">
              Aklında soru mu var?
            </h2>
          </div>

          <div className="space-y-3">
            {FAQS.map((item, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={item.q}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
                >
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                  >
                    <span className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
                      {item.q}
                    </span>
                    <svg
                      className={`w-4 h-4 flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {open && (
                    <div className="px-5 py-4 bg-white dark:bg-slate-900 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════ CTA ══════════════════════════ */}
      <section className="bg-blue-700 py-16">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white mb-4">
            Hemen başla, ücretsiz ilan ver
          </h2>
          <p className="text-blue-200 text-sm sm:text-base mb-8 leading-relaxed">
            Binlerce araç ilanı seni bekliyor. Takasını bul, parasız değiştir.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/listings"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-7 py-3 rounded-2xl transition-colors shadow-lg"
            >
              İlanlara Göz At
            </Link>
            <Link
              to="/create"
              className="bg-amber-400 hover:bg-amber-300 text-amber-900 font-semibold text-sm px-7 py-3 rounded-2xl transition-colors shadow-lg"
            >
              İlan Ver
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
