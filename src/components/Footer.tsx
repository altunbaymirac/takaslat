import { Link } from 'react-router-dom';

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-10 sm:px-6 md:py-10 lg:px-8">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">

          {/* Marka */}
          <div className="text-center sm:text-left">
            <Link to="/" className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100">
              takaslat
            </Link>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Akıllı takas platformu
            </p>
          </div>

          {/* Linkler */}
          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            <Link to="/listings" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">İlanlar</Link>
            <Link to="/arac-takas" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Araç takas</Link>
            <Link to="/ev-takas" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Ev takas</Link>
            <Link to="/arsa-takas" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Arsa takas</Link>
            <Link to="/trends" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Trendler</Link>
            <Link to="/settings" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Ayarlar</Link>
            <Link to="/gizlilik" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Gizlilik</Link>
            <Link to="/kullanim-kosullari" className="hover:text-slate-900 dark:hover:text-slate-200 transition-colors">Kullanım Koşulları</Link>
            <button
              type="button"
              onClick={() => window.dispatchEvent(new Event('takaslat:open-consent'))}
              className="transition-colors hover:text-slate-900 dark:hover:text-slate-200"
            >
              Çerez tercihleri
            </button>
          </nav>

          {/* Copyright */}
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center sm:text-right">
            © {year} Takaslat.<br className="hidden sm:block" /> Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </footer>
  );
}
