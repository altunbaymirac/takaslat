import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

interface Step {
  title:   string;
  body:    string;
  hint?:   string;
}

const STEPS: Step[] = [
  {
    title: "Takaslat'a hoş geldin!",
    body:  'Burada araç, elektronik, gayrimenkul ve daha fazlasını saniyeler içinde takas edebilirsin. Sana hızlıca platform turu atalım.',
    hint:  'Sadece 6 adım — 1 dakika sürer',
  },
  {
    title: 'Akıllı Arama',
    body:  'Üstteki arama kutusuna yaz veya mikrofon butonuna basıp konuş. Sağda "Gelişmiş Filtre" ile marka, yıl, km gibi detaylar.',
    hint:  '/ tuşu arama kutusuna hızlıca odaklanır',
  },
  {
    title: 'TakaslAI Asistanı',
    body:  'Sağ üstte ✦ TakaslAI butonuna bas. AI sana takas öner, fiyat analiz et, pazarlık tavsiyesi ver. Aracını söyle, gerisini halletsin.',
    hint:  'i tuşu AI panelini açar',
  },
  {
    title: 'Karşılaştır ve Paket Teklif',
    body:  'İki veya üç ilanı yan yana karşılaştır. Aynı kullanıcının birden çok ilanını paket olarak teklif et.',
  },
  {
    title: 'Akıllı Araçlar',
    body:  '"Akıllı Araçlar" sayfasında fırsat ilanları (ortalamadan ucuz olanlar) ve bütçe asistanı (X TL ne alır) var.',
    hint:  'g + t → Trendler, g + d → Dashboard',
  },
  {
    title: 'İlan Ver',
    body:  'Sağ üstte "İlan Ver" butonuyla başla. Şablonlardan birini seç, AI ile açıklama yaz, fiyatı AI ile hesapla. Hepsi otomatik.',
    hint:  'c tuşu ilan formuna gider',
  },
];

export default function OnboardingTour() {
  const { onboardingDone, completeOnboarding, currentUser } = useAppStore();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Sadece giriş yapmış + onboarding görmemiş kullanıcılara göster
    if (currentUser && !onboardingDone) {
      const t = setTimeout(() => setVisible(true), 1000);
      return () => clearTimeout(t);
    }
  }, [currentUser, onboardingDone]);

  if (!visible) return null;

  function finish() {
    completeOnboarding();
    setVisible(false);
  }

  function skip() {
    completeOnboarding();
    setVisible(false);
  }

  const current = STEPS[step];
  const isLast  = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 relative">

        {/* Skip */}
        <button
          onClick={skip}
          className="absolute top-3 right-3 text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium"
        >
          Atla
        </button>

        {/* Progress dots */}
        <div className="flex justify-center gap-1.5 mb-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-blue-600' : i < step ? 'w-1.5 bg-blue-300' : 'w-1.5 bg-slate-200 dark:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* İçerik */}
        <div className="text-center">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">{current.title}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{current.body}</p>
          {current.hint && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 italic">{current.hint}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="text-sm font-medium text-slate-500 dark:text-slate-400 disabled:opacity-30 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            ← Geri
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">{step + 1} / {STEPS.length}</span>
          {isLast ? (
            <button
              onClick={finish}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl"
            >
              Başlayalım
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm px-5 py-2 rounded-xl"
            >
              İleri →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
