import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ListingCard from '../components/ListingCard';
import { useSEO, useJsonLd } from '../hooks/useSEO';
import { useAppStore } from '../store/useAppStore';
import type { Listing } from '../types';

type CategoryKind = 'vehicle' | 'home' | 'land';

const CONFIG = {
  vehicle: {
    path: '/arac-takas',
    title: 'Araç Takas İlanları',
    description: 'Otomobil, motosiklet ve diğer araç takas ilanlarını karşılaştır. Aracını ilan ver, uygun teklifleri değerlendir.',
    intro: 'Araç takasında marka, model, yıl, kilometre ve ekspertiz bilgilerini karşılaştırarak sana uygun ilanları bul.',
    guide: ['Araç bilgilerini ve ekspertiz kaydını incele', 'Değer farkını teklif içinde açıkça belirt', 'Devir öncesi aracı ve belgeleri doğrula'],
  },
  home: {
    path: '/ev-takas',
    title: 'Ev Takas İlanları',
    description: 'Daire, villa, müstakil ev ve yazlık takas ilanlarını keşfet. Konum, metrekare ve tapu bilgilerine göre karşılaştır.',
    intro: 'Ev takasında konum, net metrekare, bina yaşı ve tapu bilgilerini birlikte değerlendirerek doğru ilana ulaş.',
    guide: ['Tapu ve imar bilgilerini doğrula', 'Konum ve metrekare farkını karşılaştır', 'Devir masraflarını tekliften önce netleştir'],
  },
  land: {
    path: '/arsa-takas',
    title: 'Arsa Takas İlanları',
    description: 'Arsa, tarla ve parsel takas ilanlarını keşfet. Konum, alan ve tapu özelliklerine göre uygun ilanları karşılaştır.',
    intro: 'Arsa takasında ada parsel, imar durumu, yol cephesi ve tapu niteliği gibi temel bilgileri karşılaştır.',
    guide: ['Ada parsel ve tapu kaydını doğrula', 'İmar ve yol durumunu belediyeden kontrol et', 'Metrekare ve konum değerini karşılaştır'],
  },
} satisfies Record<CategoryKind, {
  path: string;
  title: string;
  description: string;
  intro: string;
  guide: string[];
}>;

const LAND_WORDS = ['arsa', 'tarla', 'parsel', 'imar', 'bahçe'];

function isLand(listing: Listing) {
  if (listing.propertyDetails?.type) return listing.propertyDetails.type === 'Arsa';
  const text = [listing.title, listing.description, listing.wantedFor, ...(listing.tags ?? [])]
    .join(' ')
    .toLocaleLowerCase('tr-TR');
  return LAND_WORDS.some((word) => text.includes(word));
}

function matches(listing: Listing, kind: CategoryKind) {
  if (kind === 'vehicle') return listing.category === 'Araç' && !isLand(listing);
  if (kind === 'land') return isLand(listing);
  return listing.category === 'Gayrimenkul' && !isLand(listing);
}

export default function CategoryLanding({ kind }: { kind: CategoryKind }) {
  const config = CONFIG[kind];
  const listings = useAppStore((state) => state.listings);
  const matchingListings = useMemo(
    () => listings.filter((listing) => listing.isActive !== false && matches(listing, kind)).slice(0, 8),
    [kind, listings],
  );

  useSEO({ title: config.title, description: config.description, url: config.path });
  useJsonLd(`category-${kind}-jsonld`, {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Takaslat', item: 'https://www.takaslat.com/' },
          { '@type': 'ListItem', position: 2, name: config.title, item: `https://www.takaslat.com${config.path}` },
        ],
      },
      {
        '@type': 'ItemList',
        name: config.title,
        numberOfItems: matchingListings.length,
        itemListElement: matchingListings.map((listing, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          url: `https://www.takaslat.com/listing/${listing.id}`,
          name: listing.title,
        })),
      },
    ],
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <nav aria-label="Sayfa yolu" className="mb-5 text-sm text-slate-500">
        <Link to="/" className="hover:text-blue-700">Takaslat</Link>
        <span className="px-2">/</span>
        <span>{config.title}</span>
      </nav>

      <header className="border-b border-slate-200 pb-7 dark:border-slate-800">
        <h1 className="text-3xl font-black text-slate-950 dark:text-white">{config.title}</h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300">{config.intro}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to="/listings" className="rounded-md bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700">
            Tüm ilanları incele
          </Link>
          <Link to="/create" className="rounded-md border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-800 hover:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            İlan ver
          </Link>
        </div>
      </header>

      <section className="py-8" aria-labelledby="category-listings-title">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="category-listings-title" className="text-xl font-black text-slate-950 dark:text-white">Güncel ilanlar</h2>
            <p className="mt-1 text-sm text-slate-500">{matchingListings.length} uygun ilan gösteriliyor</p>
          </div>
          <Link to="/listings" className="text-sm font-bold text-blue-700 hover:text-blue-800">Tümünü gör</Link>
        </div>
        {matchingListings.length > 0 ? (
          <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
            {matchingListings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        ) : (
          <div className="rounded-md border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <p className="font-semibold text-slate-700 dark:text-slate-200">Bu kategoride aktif ilan bulunmuyor.</p>
            <Link to="/create" className="mt-3 inline-block text-sm font-bold text-blue-700">İlk ilanı ver</Link>
          </div>
        )}
      </section>

      <section className="border-y border-slate-200 py-8 dark:border-slate-800" aria-labelledby="category-guide-title">
        <h2 id="category-guide-title" className="text-xl font-black text-slate-950 dark:text-white">Takas öncesi kontrol listesi</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {config.guide.map((item, index) => (
            <div key={item} className="flex gap-3 rounded-md border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-black text-blue-700 dark:bg-blue-950 dark:text-blue-300">{index + 1}</span>
              <p className="text-sm font-semibold leading-6 text-slate-700 dark:text-slate-200">{item}</p>
            </div>
          ))}
        </div>
      </section>

      <nav aria-label="Diğer takas kategorileri" className="flex flex-wrap gap-3 py-8">
        {(Object.keys(CONFIG) as CategoryKind[]).filter((item) => item !== kind).map((item) => (
          <Link key={item} to={CONFIG[item].path} className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-500 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            {CONFIG[item].title}
          </Link>
        ))}
      </nav>
    </div>
  );
}
