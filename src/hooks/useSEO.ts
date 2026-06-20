import { useEffect } from 'react';

interface SEOOptions {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
}

const DEFAULT_TITLE       = 'Takaslat — Araç Takasının En Akıllı Adresi';
const DEFAULT_DESCRIPTION = 'Aracını akıllıca takas et. Türkiye\'nin en kapsamlı araç takas platformu.';
const DEFAULT_IMAGE       = '/og-image.svg';

function setMeta(name: string, content: string, attr: 'name' | 'property' = 'name') {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

export function useSEO({ title, description, image, url, type = 'website' }: SEOOptions = {}) {
  useEffect(() => {
    const pageTitle      = title       ? `${title} | Takaslat` : DEFAULT_TITLE;
    const pageDesc       = description ?? DEFAULT_DESCRIPTION;
    const pageImage      = image       ?? DEFAULT_IMAGE;
    const pageUrl        = url         ?? window.location.href;

    // Basic
    document.title = pageTitle;
    setMeta('description', pageDesc);

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

    return () => {
      // Reset to defaults on unmount
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, image, url, type]);
}
