// Statik sayfa üretimi (scripts/generate-static-seo-pages.mjs) ve Vercel
// fonksiyonları (api/listing.js, api/sitemap.js) aynı meta mantığını kullanır.
// "_lib" altındaki dosyalar Vercel'de fonksiyona dönüşmez.

export const ORIGIN = 'https://www.takaslat.com';
export const DEFAULT_IMAGE = `${ORIGIN}/og-image.png`;

export const LISTING_FIELDS =
  'id,title,description,estimated_value,city,category,images,is_active,brand,model,wanted_for,created_at,updated_at';

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function setMeta(html, attr, name, content) {
  const pattern = new RegExp(`<meta ${attr}="${name}"\\s+content="[^"]*"\\s*/>`);
  return html.replace(pattern, `<meta ${attr}="${name}" content="${escapeHtml(content)}" />`);
}

/**
 * index.html şablonundaki meta etiketlerini sayfaya göre değiştirir.
 * `image` verilmezse varsayılan 1200×630 OG görseli ve boyutları korunur;
 * ilan görseli gibi boyutu bilinmeyen görsellerde boyut etiketleri kaldırılır.
 */
export function renderPage(template, {
  title,
  description,
  path,
  image,
  type = 'website',
  robots,
  jsonLd,
  jsonLdId,
  heading,
  body = '',
}) {
  const url = `${ORIGIN}${path}`;
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`);

  html = setMeta(html, 'name', 'description', description);
  html = setMeta(html, 'property', 'og:type', type);
  html = setMeta(html, 'property', 'og:url', url);
  html = setMeta(html, 'property', 'og:title', title);
  html = setMeta(html, 'property', 'og:description', description);
  html = setMeta(html, 'name', 'twitter:title', title);
  html = setMeta(html, 'name', 'twitter:description', description);
  if (robots) html = setMeta(html, 'name', 'robots', robots);

  if (image) {
    html = setMeta(html, 'property', 'og:image', image);
    html = setMeta(html, 'name', 'twitter:image', image);
    html = html.replace(/\s*<meta property="og:image:(?:width|height|type)"\s+content="[^"]*"\s*\/>/g, '');
  }

  if (jsonLd) {
    const idAttr = jsonLdId ? ` id="${escapeHtml(jsonLdId)}"` : '';
    html = html.replace('</head>', `    <script${idAttr} type="application/ld+json">${safeJson(jsonLd)}</script>\n  </head>`);
  }

  return html.replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${fallbackContent(heading ?? title, description, body)}</div>`,
  );
}

function fallbackContent(heading, description, body) {
  return `<main style="max-width:960px;margin:0 auto;padding:48px 20px;font-family:Arial,sans-serif;color:#0f172a">
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(description)}</p>${body}
        <nav aria-label="Takas kategorileri">
          <a href="/arac-takas">Araç takas</a> · <a href="/ev-takas">Ev takas</a> · <a href="/arsa-takas">Arsa takas</a> · <a href="/listings">Tüm ilanlar</a>
        </nav>
      </main>`;
}

const money = (value) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(value);

function absoluteImage(value) {
  const image = String(value ?? '').trim();
  if (!image) return null;
  if (/^https?:\/\//i.test(image)) return image;
  return `${ORIGIN}${image.startsWith('/') ? image : `/${image}`}`;
}

function clip(value, max) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** Tek bir ilanın sunucu tarafı HTML'i; başlık/açıklama ListingDetail'in useSEO çağrısıyla aynı. */
export function renderListingPage(template, listing) {
  const name = String(listing.title ?? '').trim();
  const city = String(listing.city ?? '').trim();
  const path = `/listing/${encodeURIComponent(listing.id)}`;
  const url = `${ORIGIN}${path}`;
  const price = Number(listing.estimated_value) || 0;
  const images = (Array.isArray(listing.images) ? listing.images : []).map(absoluteImage).filter(Boolean);
  const title = `${city ? `${name} — ${city}` : name} | Takaslat`;
  const description = `${name} · ${money(price)}${city ? ` · ${city}` : ''}. Takaslat'ta takas teklifleri verin.`;
  const wantedFor = String(listing.wanted_for ?? '').trim();
  const brand = String(listing.brand ?? '').trim();
  const model = String(listing.model ?? '').trim();

  const additionalProperty = [
    city ? { '@type': 'PropertyValue', name: 'Şehir', value: city } : null,
    wantedFor ? { '@type': 'PropertyValue', name: 'Takasta istenen', value: wantedFor } : null,
  ].filter(Boolean);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        name,
        description: clip(listing.description, 5000) || description,
        image: images,
        category: listing.category,
        url,
        ...(brand ? { brand: { '@type': 'Brand', name: brand } } : {}),
        ...(model ? { model } : {}),
        itemCondition: 'https://schema.org/UsedCondition',
        additionalProperty,
        offers: {
          '@type': 'Offer',
          price,
          priceCurrency: 'TRY',
          availability: listing.is_active === false ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
          url,
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Takaslat', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'İlanlar', item: `${ORIGIN}/listings` },
          { '@type': 'ListItem', position: 3, name, item: url },
        ],
      },
    ],
  };

  const details = [
    listing.description ? `<p>${escapeHtml(clip(listing.description, 1000))}</p>` : '',
    wantedFor ? `<p>Takasta istenen: ${escapeHtml(wantedFor)}</p>` : '',
  ].join('');

  return renderPage(template, {
    title,
    description,
    path,
    image: images[0],
    type: 'product',
    jsonLd,
    // ListingDetail aynı id ile useJsonLd çağırıyor; böylece iki kopya oluşmaz.
    jsonLdId: 'listing-jsonld',
    heading: name,
    body: details ? `\n        ${details}` : '',
  });
}

export function renderNotFoundPage(template, path) {
  return renderPage(template, {
    title: 'İlan bulunamadı | Takaslat',
    description: 'Aradığın ilan kaldırılmış ya da yayından çekilmiş olabilir. Güncel takas ilanlarına göz at.',
    path,
    robots: 'noindex, follow',
    heading: 'İlan bulunamadı',
  });
}
