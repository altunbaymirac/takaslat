import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

export default function FloatingActionButton() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { openAIPanel, aiPanelOpen, currentUser, compareList, bundleCart } = useAppStore();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const items = currentUser ? [
    { icon: '📋', label: 'Yeni İlan',    to: '/create',         color: 'bg-blue-600 hover:bg-blue-700' },
    { icon: '✦',  label: 'TakaslAI',     onClick: () => openAIPanel(), color: 'bg-amber-500 hover:bg-amber-600' },
    { icon: '🎯', label: 'Akıllı Araçlar', to: '/smart-tools',  color: 'bg-violet-600 hover:bg-violet-700' },
    { icon: '❤️', label: 'Favoriler',   to: '/favorites',      color: 'bg-rose-500 hover:bg-rose-600' },
    { icon: '🏠', label: 'Anasayfa',    to: '/',               color: 'bg-emerald-600 hover:bg-emerald-700' },
  ] : [
    { icon: '✦',  label: 'TakaslAI',     onClick: () => openAIPanel(), color: 'bg-amber-500 hover:bg-amber-600' },
    { icon: '🏠', label: 'Anasayfa',    to: '/',               color: 'bg-emerald-600 hover:bg-emerald-700' },
    { icon: '🔐', label: 'Giriş Yap',   to: '/login',          color: 'bg-blue-600 hover:bg-blue-700' },
  ];

  // AI paneli açıkken FAB'ı gizle — çakışmayı önle
  if (location.pathname.startsWith('/listing/') || aiPanelOpen || compareList.length > 0 || bundleCart.length > 0) return null;

  return (
    <div className="fixed bottom-6 right-5 z-20 print:hidden" ref={ref}>
      {/* Mini menu */}
      {open && (
        <div className="absolute bottom-full right-0 mb-3 flex flex-col items-end gap-2">
          {items.map((it, i) => (
            <div
              key={it.label}
              className="flex items-center gap-2 animate-[fade-up_0.2s_ease-out]"
              style={{ animationDelay: `${i * 0.04}s`, opacity: 1 }}
            >
              <span className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-lg shadow-lg whitespace-nowrap">
                {it.label}
              </span>
              {it.to ? (
                <Link
                  to={it.to}
                  onClick={() => setOpen(false)}
                  className={`w-11 h-11 rounded-full ${it.color} text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}
                >
                  <span className="text-lg">{it.icon}</span>
                </Link>
              ) : (
                <button
                  onClick={() => { it.onClick?.(); setOpen(false); }}
                  className={`w-11 h-11 rounded-full ${it.color} text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform`}
                >
                  <span className="text-lg">{it.icon}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Hızlı menü"
        className={`w-14 h-14 rounded-full text-white shadow-2xl flex items-center justify-center transition-all hover:scale-110 ${
          open
            ? 'bg-slate-700 rotate-45'
            : 'bg-gradient-to-br from-blue-600 to-indigo-700'
        }`}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
}
