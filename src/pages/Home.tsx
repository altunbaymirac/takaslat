import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useSEO } from '../hooks/useSEO';

const AIIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

export default function Home() {
  useSEO({
    title: 'Araç Takasının En Akıllı Adresi | Takaslat',
    description: 'Arabanı takas et. İlan ver, teklif al, güvenle buluş. Türkiye\'nin en akıllı araç takas platformu.',
  });

  const { listings } = useAppStore();

  const heroStats = useMemo(() => {
    const count = listings.length;
    const cities = new Set(listings.map(l => l.city).filter(Boolean)).size;
    return { count, cities };
  }, [listings]);

  return (
    <>
      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0f2d6e] via-[#1B4FD8] to-[#2563eb]">
        <div className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full bg-blue-400/20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-[480px] h-[480px] rounded-full bg-indigo-500/20 blur-3xl" />

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-10 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-white/90 text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {heroStats.count} aktif ilan · Türkiye geneli
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-[1.1] tracking-tight mb-4">
            Ne var ne yok, <span className="text-amber-400">takaslat.</span>
          </h1>

          <p className="text-blue-200 text-base sm:text-lg max-w-lg mx-auto mb-8 leading-relaxed">
            Araç takasının en akıllı adresi. İlan ver, teklif al, güvenle buluş.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/listings"
              className="bg-white text-blue-700 hover:bg-blue-50 font-semibold text-sm px-8 py-3.5 rounded-2xl transition-colors shadow-lg shadow-blue-900/20"
            >
              İlanları Keşfet
            </Link>
            <Link
              to="/create"
              className="bg-amber-400 hover:bg-amber-300 text-amber-900 font-semibold text-sm px-8 py-3.5 rounded-2xl transition-colors shadow-lg shadow-amber-900/10"
            >
              İlan ver
            </Link>
            <Link
              to="/listings?tab=ai"
              className="flex items-center gap-2 bg-violet-500 hover:bg-violet-400 text-white font-semibold text-sm px-8 py-3.5 rounded-2xl transition-colors shadow-lg shadow-violet-900/20"
            >
              <AIIcon />
              TakaslAI
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
                color: 'bg-violet-50 dark:bg-violet-900/10 border-violet-100 dark:border-violet-900/30',
                iconColor: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
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
                color: 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30',
                iconColor: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
                icon: (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
              {
                title: 'Harita Görünümü',
                desc: 'Sana yakın ilanları haritada gör, filtrelemek yerine konumla keşfet.',
                color: 'bg-amber-50 dark:bg-amber-900/10 border-amber-100 dark:border-amber-900/30',
                iconColor: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
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

      {/* ══════════════════════════ CTA ══════════════════════════ */}
      <section className="py-16 bg-gradient-to-br from-[#0f2d6e] via-[#1B4FD8] to-[#2563eb]">
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
