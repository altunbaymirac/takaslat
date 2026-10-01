// /sitemap.xml isteklerini karşılar (vercel.json rewrite). Deploy beklemeden
// yeni ilanları ekler, kaldırılanları çıkarır.
import { ORIGIN, escapeXml } from './_lib/seo.js';

export const config = { runtime: 'edge' };

const STATIC_PATHS = [
  '/',
  '/listings',
  '/arac-takas',
  '/ev-takas',
  '/arsa-takas',
  '/map',
  '/auctions',
  '/trust',
  '/gizlilik',
  '/kullanim-kosullari',
];

function entry(path, { lastmod, image } = {}) {
  const fields = [`    <loc>${escapeXml(`${ORIGIN}${path}`)}</loc>`];
  if (lastmod) fields.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (image) fields.push(`    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`);
  return `  <url>\n${fields.join('\n')}\n  </url>`;
}

async function listingEntries() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase environment is not configured');
  const response = await fetch(
    `${supabaseUrl}/rest/v1/listings?select=id,updated_at,created_at,images&is_active=eq.true&order=created_at.desc&limit=1000`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const listings = await response.json();
  return listings.map((listing) => {
    const modifiedAt = listing.updated_at || listing.created_at;
    const image = Array.isArray(listing.images)
      ? listing.images.find((value) => /^https?:\/\//i.test(String(value)))
      : undefined;
    return entry(`/listing/${encodeURIComponent(listing.id)}`, {
      lastmod: modifiedAt ? new Date(modifiedAt).toISOString() : undefined,
      image,
    });
  });
}

export default async function handler() {
  const entries = STATIC_PATHS.map((path) => entry(path));
  let cacheControl = 'public, s-maxage=3600, stale-while-revalidate=86400';
  try {
    entries.push(...await listingEntries());
  } catch (error) {
    // İlanlar alınamazsa en azından statik sayfaları dön, kısa süre önbellekle.
    console.error(`[sitemap] ${String(error)}`);
    cacheControl = 'public, s-maxage=60';
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`;
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': cacheControl },
  });
}
