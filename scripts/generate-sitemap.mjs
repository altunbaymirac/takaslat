import { writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const siteUrl = 'https://www.takaslat.com';
const env = loadEnv('production', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const staticPages = [
  '/',
  '/listings',
  '/arac-takas',
  '/ev-takas',
  '/arsa-takas',
  '/trends',
  '/map',
  '/auctions',
  '/gizlilik',
  '/kullanim-kosullari',
];

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function entry(path, { lastmod, image } = {}) {
  const fields = [`    <loc>${escapeXml(`${siteUrl}${path}`)}</loc>`];
  if (lastmod) fields.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
  if (image) fields.push(`    <image:image><image:loc>${escapeXml(image)}</image:loc></image:image>`);
  return `  <url>\n${fields.join('\n')}\n  </url>`;
}

const entries = staticPages.map((path) => entry(path));

try {
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase build environment is not configured');
  const fields = 'id,updated_at,created_at,images';
  const response = await fetch(`${supabaseUrl}/rest/v1/listings?select=${fields}&is_active=eq.true&order=created_at.desc&limit=1000`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (response.ok) {
    const listings = await response.json();
    for (const listing of listings) {
      const modifiedAt = listing.updated_at || listing.created_at;
      const lastmod = modifiedAt ? new Date(modifiedAt).toISOString() : undefined;
      const image = Array.isArray(listing.images)
        ? listing.images.find((value) => /^https?:\/\//i.test(String(value)))
        : undefined;
      entries.push(entry(`/listing/${encodeURIComponent(listing.id)}`, { lastmod, image }));
    }
  } else {
    console.warn(`[sitemap] Supabase returned ${response.status}; generated static sitemap.`);
  }
} catch (error) {
  console.warn(`[sitemap] Listing fetch failed; generated static sitemap: ${String(error)}`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${entries.join('\n')}\n</urlset>\n`;
await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml, 'utf8');
console.log(`[sitemap] Generated ${entries.length} URLs.`);
