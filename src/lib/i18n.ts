/**
 * Basit i18n — TR (varsayılan) + EN
 *
 * Kullanım:
 *   const { t, lang, setLang } = useT();
 *   t('home.title')
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Lang = 'tr' | 'en';

type Dictionary = Record<string, string>;

const TR: Dictionary = {
  // Navbar
  'nav.listings':       'İlanlar',
  'nav.favorites':      'Favoriler',
  'nav.conversations':  'Görüşmeler',
  'nav.trends':         'Trendler',
  'nav.create':         'İlan Ver',
  'nav.login':          'Giriş Yap',
  'nav.register':       'Kayıt Ol',
  'nav.logout':         'Çıkış Yap',
  'nav.dashboard':      'Dashboard',
  'nav.wishlist':       'İstek Listem',
  'nav.map':            'Harita',

  // Common
  'common.cancel':      'İptal',
  'common.save':        'Kaydet',
  'common.delete':      'Sil',
  'common.edit':        'Düzenle',
  'common.search':      'Ara',
  'common.loading':     'Yükleniyor…',
  'common.error':       'Hata',
  'common.success':     'Başarılı',
  'common.back':        'Geri',
  'common.next':        'İleri',
  'common.continue':    'Devam Et',

  // Hero
  'hero.title':         'Akıllı Takas Platformu',
  'hero.subtitle':      'Aracını, elektroniğini, gayrimenkulünü saniyeler içinde takas et — yapay zeka ile en iyi eşleşmeyi bul.',
  'hero.cta':           'İlanları Keşfet',
  'hero.ai':            '✦ AI ile Eşleştir',

  // Listings
  'listings.empty':         'Sonuç bulunamadı',
  'listings.tryDifferent':  'Farklı filtreler deneyin',
  'listings.showing':       'ilan gösteriliyor',

  // Filters
  'filter.search':      'Marka, model, açıklama veya etiket ara…',
  'filter.all':         'Tümü',
  'filter.allCities':   'Tüm Şehirler',
  'filter.reset':       'Sıfırla',
};

const EN: Dictionary = {
  // Navbar
  'nav.listings':       'Listings',
  'nav.favorites':      'Favorites',
  'nav.conversations':  'Conversations',
  'nav.trends':         'Trends',
  'nav.create':         'Post Ad',
  'nav.login':          'Log In',
  'nav.register':       'Sign Up',
  'nav.logout':         'Sign Out',
  'nav.dashboard':      'Dashboard',
  'nav.wishlist':       'Wishlist',
  'nav.map':            'Map',

  // Common
  'common.cancel':      'Cancel',
  'common.save':        'Save',
  'common.delete':      'Delete',
  'common.edit':        'Edit',
  'common.search':      'Search',
  'common.loading':     'Loading…',
  'common.error':       'Error',
  'common.success':     'Success',
  'common.back':        'Back',
  'common.next':        'Next',
  'common.continue':    'Continue',

  // Hero
  'hero.title':         'Smart Swap Platform',
  'hero.subtitle':      'Trade your car, electronics, real estate in seconds — find the best match with AI.',
  'hero.cta':           'Browse Listings',
  'hero.ai':            '✦ Match with AI',

  // Listings
  'listings.empty':         'No results',
  'listings.tryDifferent':  'Try different filters',
  'listings.showing':       'listings shown',

  // Filters
  'filter.search':      'Search brand, model, description or tag…',
  'filter.all':         'All',
  'filter.allCities':   'All Cities',
  'filter.reset':       'Reset',
};

const DICTIONARIES: Record<Lang, Dictionary> = { tr: TR, en: EN };

interface LangState {
  lang: Lang;
  setLang: (l: Lang) => void;
}

export const useLangStore = create<LangState>()(
  persist(
    (set) => ({
      lang: 'tr',
      setLang: (l) => set({ lang: l }),
    }),
    { name: 'takaslat-lang' }
  )
);

export function useT() {
  const { lang, setLang } = useLangStore();
  const dict = DICTIONARIES[lang];
  function t(key: string, fallback?: string): string {
    return dict[key] ?? fallback ?? key;
  }
  return { t, lang, setLang };
}
