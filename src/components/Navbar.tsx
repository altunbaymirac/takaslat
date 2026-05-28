import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import NotificationBell from './NotificationBell';
import { useT } from '../lib/i18n';

const NAV = [
  { to: '/',              label: 'İlanlar'    },
  { to: '/favorites',     label: 'Favoriler'  },
  { to: '/conversations', label: 'Görüşmeler' },
  { to: '/trends',        label: 'Trendler'   },
  { to: '/create',        label: 'İlan Ver'   },
];

export default function Navbar() {
  const { pathname }  = useLocation();
  const navigate      = useNavigate();
  const {
    openAIPanel, offers, currentUser, currentUserId, logoutUser,
    favorites, darkMode, toggleDarkMode,
  } = useAppStore();

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { lang, setLang } = useT();

  const pending = offers.filter(
    (o) => o.toUserId === currentUserId && o.status === 'Beklemede'
  ).length;

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  function handleLogout() {
    logoutUser();
    setMenuOpen(false);
    navigate('/');
  }

  const initials = currentUser?.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?';

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-6">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <span className="font-bold text-[15px] text-slate-900 dark:text-slate-100 tracking-tight">Takaslat</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1 flex-1">
          {NAV.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className={`relative text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${
                pathname === to
                  ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {label}
              {to === '/favorites' && favorites.length > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {favorites.length}
                </span>
              )}
              {to === '/conversations' && pending > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-red-500 text-white rounded-full">
                  {pending}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Notifications (only when logged in) */}
          {currentUser && <NotificationBell />}

          {/* Keyboard shortcuts hint (?) */}
          <button
            onClick={() => {
              const ev = new KeyboardEvent('keydown', { key: '?', bubbles: true });
              document.dispatchEvent(ev);
            }}
            title="Klavye kısayolları (?)"
            className="hidden lg:flex w-9 h-9 rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 items-center justify-center transition-colors"
          >
            <kbd className="text-xs font-bold">?</kbd>
          </button>

          {/* Language toggle */}
          <button
            onClick={() => setLang(lang === 'tr' ? 'en' : 'tr')}
            title={lang === 'tr' ? 'Switch to English' : 'Türkçe\'ye geç'}
            className="text-xs font-bold rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 w-9 h-9 flex items-center justify-center transition-colors uppercase tracking-wide"
          >
            {lang === 'tr' ? 'EN' : 'TR'}
          </button>

          {/* Dark mode toggle */}
          <button
            onClick={toggleDarkMode}
            title={darkMode ? 'Aydınlık moda geç' : 'Karanlık moda geç'}
            className="w-9 h-9 rounded-xl text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            {darkMode ? (
              // Güneş
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            ) : (
              // Ay
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            )}
          </button>

          {/* AI button */}
          <button
            onClick={() => openAIPanel()}
            className="hidden sm:inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200 dark:border-amber-900/50 transition-colors"
          >
            <span className="text-[13px] leading-none">✦</span>
            TakaslAI
          </button>

          {currentUser ? (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 px-2 py-1 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                {currentUser.avatar ? (
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-7 h-7 rounded-full object-cover" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                    {initials}
                  </div>
                )}
                <span className="hidden sm:block text-sm font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
                  {currentUser.name}
                </span>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{currentUser.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentUser.email}</p>
                  </div>
                  <Link
                    to={`/profile/${currentUser.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    <span>👤 Profilim</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>📊 Dashboard</span>
                  </Link>
                  <Link
                    to="/wishlist"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>🎁 İstek Listem</span>
                  </Link>
                  <Link
                    to="/map"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>🗺️ Harita</span>
                  </Link>
                  <Link
                    to="/achievements"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>🏆 Başarımlarım</span>
                  </Link>
                  <Link
                    to="/smart-tools"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>✦ Akıllı Araçlar</span>
                  </Link>
                  <Link
                    to="/trust"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>🛡️ Güven Merkezi</span>
                  </Link>
                  {(currentUser.role === 'ADMIN' || currentUser.email === 'demo@takaslat.com') && (
                    <Link
                      to="/admin"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <span>🛡️ Admin Paneli</span>
                    </Link>
                  )}
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>⚙️ Ayarlar</span>
                  </Link>
                  <Link
                    to="/favorites"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>❤️ Favorilerim</span>
                    {favorites.length > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                        {favorites.length}
                      </span>
                    )}
                  </Link>
                  <Link
                    to="/create"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>+ İlan Ver</span>
                  </Link>
                  <Link
                    to="/conversations"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    <span>Görüşmelerim</span>
                    {pending > 0 && (
                      <span className="ml-auto inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                        {pending}
                      </span>
                    )}
                  </Link>
                  <hr className="my-1 border-slate-100 dark:border-slate-700" />
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Çıkış Yap
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                Giriş Yap
              </Link>
              <Link
                to="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-1.5 rounded-full transition-colors"
              >
                Kayıt Ol
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden flex border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900">
        {[...NAV, { to: '/ai', label: 'AI ✦' }].map(({ to, label }) =>
          to === '/ai' ? (
            <button
              key="ai"
              onClick={() => openAIPanel()}
              className="flex-1 py-2.5 text-xs font-semibold text-amber-600 dark:text-amber-400"
            >
              {label}
            </button>
          ) : (
            <Link
              key={to}
              to={to}
              className={`flex-1 py-2.5 text-center text-xs font-semibold transition-colors relative ${
                pathname === to ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {pathname === to && (
                <span className="absolute top-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
              )}
              {label}
              {to === '/favorites' && favorites.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold bg-red-500 text-white rounded-full">
                  {favorites.length}
                </span>
              )}
              {to === '/conversations' && pending > 0 && (
                <span className="ml-1 inline-flex items-center justify-center w-3.5 h-3.5 text-[9px] font-bold bg-red-500 text-white rounded-full">
                  {pending}
                </span>
              )}
            </Link>
          )
        )}
      </nav>
    </header>
  );
}
