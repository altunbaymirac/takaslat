import { Link } from 'react-router-dom';
import { useSEO } from '../hooks/useSEO';

export default function NotFound() {
  useSEO({ title: 'Sayfa bulunamadı', noIndex: true });

  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <p className="text-sm font-black text-blue-700">404</p>
      <h1 className="mt-2 text-3xl font-black text-slate-950 dark:text-white">Sayfa bulunamadı</h1>
      <p className="mt-3 text-slate-500">Aradığın sayfa kaldırılmış veya adresi değişmiş olabilir.</p>
      <Link to="/" className="mt-7 inline-flex rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
        Ana sayfaya dön
      </Link>
    </div>
  );
}
