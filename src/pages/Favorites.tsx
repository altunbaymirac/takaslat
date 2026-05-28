import { Link } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ListingCard from '../components/ListingCard';
import { useSEO } from '../hooks/useSEO';

export default function Favorites() {
  useSEO({ title: 'Favorilerim', description: 'Kaydettiğin araç ilanlarına hızlıca ulaş.' });
  const { favorites, listings } = useAppStore();

  // Favoriler dizisindeki sıraya göre ilanları topla (silinmiş olabilir, filtrele)
  const favListings = favorites
    .map((id) => listings.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> => Boolean(l));

  if (favListings.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="text-6xl mb-4">💔</div>
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">Henüz favori yok</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-sm mx-auto">
          Beğendiğiniz ilanları kalp ikonuna tıklayarak buraya ekleyin. Karşılaştırmak için ideal!
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          İlanlara Göz At
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <header className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>❤️</span> Favorilerim
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {favListings.length} kayıtlı ilan
          </p>
        </div>
        <Link
          to="/"
          className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline"
        >
          Tüm ilanlar →
        </Link>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {favListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
