import { useEffect } from 'react';

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  noIndex?: boolean;
}

const DEFAULT_TITLE       = 'Takaslat | Araç, Ev ve Arsa Takas Platformu';
const DEFAULT_DESCRIPTION = 'Araç, ev ve arsa takas ilanlarını keşfet. Ücretsiz ilan ver, teklif al ve güvenle takas yap.';
const DEFAULT_IMAGE       = '/pwa-512.png';
const PROD_ORIGIN         = 'https://www.takaslat.com';
const PRIVATE_PATH_PREFIXES = [
  '/admin', '/dashboard', '/settings', '/conversations', '/offers',
  '/favorites', '/compare', '/wishlist', '/achievements', '/smart-tools',
  '/create', '/login', '/register', '/reset-password', '/ai-sonuclar', '/profile/',
];

function absoluteUrl(value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return `${PROD_ORIGIN}${value.startsWith('/') ? value : `/${value}`}`;
}

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function useSEO({ title, description, image, url, type = 'website', noIndex = false }: SEOOptions = {}) {
  useEffect(() => {
    const pageTitle      = title       ? `${title} | Takaslat` : DEFAULT_TITLE;
    const pageDesc       = description ?? DEFAULT_DESCRIPTION;
    const pageImage      = absoluteUrl(image ?? DEFAULT_IMAGE);
    const pageUrl        = absoluteUrl(url ?? window.location.pathname);
    const isPrivatePage  = PRIVATE_PATH_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix));
    const robotsContent  = noIndex || isPrivatePage
      ? 'noindex, nofollow, noarchive'
      : 'index, follow, max-image-preview:large';

    // Basic
    document.title = pageTitle;
    setMeta('description', pageDesc);
    setMeta('robots', robotsContent);
    setMeta('googlebot', robotsContent);

    // Open Graph
    setMeta('og:title',       pageTitle,  'property');
    setMeta('og:description', pageDesc,   'property');
    setMeta('og:image',       pageImage,  'property');
    setMeta('og:url',         pageUrl,    'property');
    setMeta('og:type',        type,       'property');
    setMeta('og:site_name',   'Takaslat', 'property');

    // Twitter Card
    setMeta('twitter:card',        'summary_large_image');
    setMeta('twitter:title',       pageTitle);
    setMeta('twitter:description', pageDesc);
    setMeta('twitter:image',       pageImage);

    // Canonical link
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = pageUrl;

    let alternate = document.querySelector<HTMLLinkElement>('link[rel="alternate"][hreflang="tr-TR"]');
    if (!alternate) {
      alternate = document.createElement('link');
      alternate.rel = 'alternate';
      alternate.hreflang = 'tr-TR';
      document.head.appendChild(alternate);
    }
    alternate.href = pageUrl;

    return () => {
      // Reset to defaults on unmount
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, image, url, type, noIndex]);
}

// ─── JSON-LD structured data (zengin snippet / Google için) ──────────────────

export function useJsonLd(id: string, data: object | null) {
  useEffect(() => {
    if (!data) return;
    let el = document.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement('script');
      el.id = id;
      el.type = 'application/ld+json';
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);

    return () => { el?.remove(); };
  }, [id, data]);
}
