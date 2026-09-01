import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

const origin = 'https://www.takaslat.com';
const distDir = resolve('dist');
const baseHtml = await readFile(resolve(distDir, 'index.html'), 'utf8');
const env = loadEnv('production', process.cwd(), '');

const staticPages = [
  {
    path: '/listings',
    title: 'Takas İlanları | Araç, Ev ve Arsa | Takaslat',
    description: 'Türkiye genelindeki araç, ev ve arsa takas ilanlarını filtrele, karşılaştır ve teklif ver.',
    heading: 'Araç, ev ve arsa takas ilanları',
  },
  {
    path: '/arac-takas',
    title: 'Araç Takas İlanları | Takaslat',
    description: 'Otomobil, motosiklet ve diğer araç takas ilanlarını karşılaştır. Aracını ilan ver, uygun teklifleri değerlendir.',
    heading: 'Araç takas ilanları',
  },
  {
    path: '/ev-takas',
    title: 'Ev Takas İlanları | Takaslat',
    description: 'Daire, villa, müstakil ev ve yazlık takas ilanlarını konum, metrekare ve tapu bilgilerine göre karşılaştır.',
    heading: 'Ev takas ilanları',
  },
  {
    path: '/arsa-takas',
    title: 'Arsa Takas İlanları | Takaslat',
    description: 'Arsa, tarla ve parsel takas ilanlarını konum, alan, imar ve tapu özelliklerine göre karşılaştır.',
    heading: 'Arsa takas ilanları',
  },
];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function replaceMeta(html, { title, description, path, image = `${origin}/pwa-512.png`, type = 'website', jsonLd }) {
  const url = `${origin}${path}`;
  let output = html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(description)}" />`)
    .replace(/<link rel="canonical" href="[^"]*"\s*\/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`)
    .replace(/<meta property="og:type"\s+content="[^"]*"\s*\/>/, `<meta property="og:type" content="${type}" />`)
    .replace(/<meta property="og:url"\s+content="[^"]*"\s*\/>/, `<meta property="og:url" content="${escapeHtml(url)}" />`)
    .replace(/<meta property="og:title"\s+content="[^"]*"\s*\/>/, `<meta property="og:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta property="og:description" content="[^"]*"\s*\/>/, `<meta property="og:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta property="og:image"\s+content="[^"]*"\s*\/>/, `<meta property="og:image" content="${escapeHtml(image)}" />`)
    .replace(/<meta name="twitter:title"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:title" content="${escapeHtml(title)}" />`)
    .replace(/<meta name="twitter:description" content="[^"]*"\s*\/>/, `<meta name="twitter:description" content="${escapeHtml(description)}" />`)
    .replace(/<meta name="twitter:image"\s+content="[^"]*"\s*\/>/, `<meta name="twitter:image" content="${escapeHtml(image)}" />`);

  if (jsonLd) output = output.replace('</head>', `    <script type="application/ld+json">${safeJson(jsonLd)}</script>\n  </head>`);
  return output;
}

function fallbackContent(heading, description) {
  return `<main style="max-width:960px;margin:0 auto;padding:48px 20px;font-family:Arial,sans-serif;color:#0f172a">
        <h1>${escapeHtml(heading)}</h1>
        <p>${escapeHtml(description)}</p>
        <nav aria-label="Takas kategorileri">
          <a href="/arac-takas">Araç takas</a> · <a href="/ev-takas">Ev takas</a> · <a href="/arsa-takas">Arsa takas</a> · <a href="/listings">Tüm ilanlar</a>
        </nav>
      </main>`;
}

async function writeRoute(path, html) {
  const target = resolve(distDir, path.slice(1));
  await mkdir(target, { recursive: true });
  await writeFile(resolve(target, 'index.html'), html, 'utf8');
}

for (const page of staticPages) {
  const html = replaceMeta(baseHtml, page).replace(
    /<div id="root">[\s\S]*?<\/div>/,
    `<div id="root">${fallbackContent(page.heading, page.description)}</div>`,
  );
  await writeRoute(page.path, html);
}

try {
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase build environment is not configured');
  const fields = 'id,title,description,estimated_value,city,category,images,is_active,created_at';
  const response = await fetch(`${supabaseUrl}/rest/v1/listings?select=${fields}&is_active=eq.true&order=created_at.desc&limit=1000`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);

  const listings = await response.json();
  for (const listing of listings) {
    const path = `/listing/${encodeURIComponent(listing.id)}`;
    const title = `${listing.title} | Takas İlanı | Takaslat`;
    const description = String(listing.description || `${listing.title} takas ilanını Takaslat'ta incele.`).slice(0, 160);
    const image = Array.isArray(listing.images) && listing.images[0] ? listing.images[0] : `${origin}/pwa-512.png`;
    const url = `${origin}${path}`;
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: listing.title,
      description,
      image: listing.images,
      category: listing.category,
      url,
      itemCondition: 'https://schema.org/UsedCondition',
      offers: {
        '@type': 'Offer',
        price: listing.estimated_value,
        priceCurrency: 'TRY',
        availability: 'https://schema.org/InStock',
        url,
      },
    };
    const html = replaceMeta(baseHtml, { title, description, path, image, type: 'product', jsonLd }).replace(
      /<div id="root">[\s\S]*?<\/div>/,
      `<div id="root">${fallbackContent(listing.title, description)}</div>`,
    );
    await writeRoute(path, html);
  }
  console.log(`[seo] Generated ${staticPages.length} static pages and ${listings.length} listing pages.`);
} catch (error) {
  console.warn(`[seo] Generated static pages without listing snapshots: ${String(error)}`);
}
