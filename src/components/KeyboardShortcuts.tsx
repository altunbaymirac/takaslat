import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const SHORTCUTS: Array<{ keys: string[]; label: string; section: string }> = [
  { section: 'Gezinme', keys: ['g', 'h'], label: 'İlanlara git (Home)' },
  { section: 'Gezinme', keys: ['g', 'f'], label: 'Favorilerim' },
  { section: 'Gezinme', keys: ['g', 'c'], label: 'Görüşmeler' },
  { section: 'Gezinme', keys: ['g', 'd'], label: 'Dashboard' },
  { section: 'Gezinme', keys: ['g', 't'], label: 'Trend Paneli' },
  { section: 'Gezinme', keys: ['g', 'm'], label: 'Harita' },
  { section: 'Gezinme', keys: ['g', 'w'], label: 'İstek Listem' },
  { section: 'Gezinme', keys: ['g', 'a'], label: 'Başarımlarım' },
  { section: 'Aksiyon', keys: ['c'],      label: 'Yeni İlan Ver' },
  { section: 'Aksiyon', keys: ['/'],      label: 'Arama kutusuna odaklan' },
  { section: 'Aksiyon', keys: ['i'],      label: 'TakaslAI panelini aç' },
  { section: 'Aksiyon', keys: ['t'],      label: 'Karanlık modu değiştir' },
  { section: 'Yardım',  keys: ['?'],      label: 'Bu kısayol kılavuzunu göster' },
];

export default function KeyboardShortcuts() {
  const navigate = useNavigate();
  const { openAIPanel, toggleDarkMode } = useAppStore();
  const [helpOpen,    setHelpOpen]    = useState(false);
  const [pendingG,    setPendingG]    = useState(false);

  useEffect(() => {
    let gTimer: ReturnType<typeof setTimeout> | undefined;

    function onKey(e: KeyboardEvent) {
      // Input/textarea/contenteditable içindeyken kısayolları yok say
      const tag = (e.target as HTMLElement | null)?.tagName;
      const editable = (e.target as HTMLElement | null)?.isContentEditable;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || editable) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // Yardım
      if (e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (e.key === 'Escape') {
        setHelpOpen(false);
        setPendingG(false);
        return;
      }

      // Arama'ya odaklan
      if (e.key === '/' && !pendingG) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[placeholder*="Marka"]');
        input?.focus();
        return;
      }

      // Tek tuş aksiyonları
      if (!pendingG) {
        if (e.key === 'c') { e.preventDefault(); navigate('/create');     return; }
        if (e.key === 'i') { e.preventDefault(); openAIPanel();           return; }
        if (e.key === 't') { e.preventDefault(); toggleDarkMode();        return; }

        // "g" başlat — sonraki tuş gezinme
        if (e.key === 'g') {
          e.preventDefault();
          setPendingG(true);
          if (gTimer) clearTimeout(gTimer);
          gTimer = setTimeout(() => setPendingG(false), 1500);
          return;
        }
      }

      // "g" + tuş gezinmesi
      if (pendingG) {
        const target: Record<string, string> = {
          h: '/',
          f: '/favorites',
          c: '/conversations',
          d: '/dashboard',
          t: '/trends',
          m: '/map',
          w: '/wishlist',
          a: '/achievements',
        };
        if (target[e.key]) {
          e.preventDefault();
          navigate(target[e.key]);
        }
        setPendingG(false);
        if (gTimer) clearTimeout(gTimer);
      }
    }

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (gTimer) clearTimeout(gTimer);
    };
  }, [pendingG, navigate, openAIPanel, toggleDarkMode]);

  // Sections gruplama
  const grouped = SHORTCUTS.reduce<Record<string, typeof SHORTCUTS>>((acc, s) => {
    (acc[s.section] ??= []).push(s);
    return acc;
  }, {});

  return (
    <>
      {/* "g" göstergesi */}
      {pendingG && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-full shadow-xl z-[70] animate-pulse">
          ⌨️ <kbd>g</kbd> bekleniyor… (h/f/c/d/t/m/w/a)
        </div>
      )}

      {/* Yardım modal */}
      {helpOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80] flex items-center justify-center p-4 modal-overlay" onClick={() => setHelpOpen(false)}>
          <div
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto modal-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>⌨️</span> Klavye Kısayolları
              </h2>
              <button onClick={() => setHelpOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              {Object.entries(grouped).map(([section, items]) => (
                <div key={section}>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    {section}
                  </h3>
                  <div className="space-y-2">
                    {items.map((s, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-sm text-slate-700 dark:text-slate-200">{s.label}</span>
                        <div className="flex gap-1">
                          {s.keys.map((k, j) => (
                            <kbd
                              key={j}
                              className="px-2 py-0.5 text-xs font-mono font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 rounded shadow-sm"
                            >
                              {k}
                            </kbd>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <p className="text-xs text-slate-500 dark:text-slate-400 pt-3 border-t border-slate-100 dark:border-slate-700 italic">
                💡 İpucu: <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">g</kbd> tuşuna bas, ardından gitmek istediğin sayfanın harfini gir.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
