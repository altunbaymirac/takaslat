import { writeFile } from 'node:fs/promises';
import { loadEnv } from 'vite';

const siteUrl = 'https://www.takaslat.com';
const env = loadEnv('production', process.cwd(), '');
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

const staticPages = [
  ['/', 'daily', '1.0'],
  ['/listings', 'hourly', '0.9'],
  ['/trends', 'weekly', '0.6'],
  ['/map', 'weekly', '0.5'],
  ['/register', 'monthly', '0.5'],
];

function entry(path, lastmod, changefreq, priority) {
  return `  <url>\n    <loc>${siteUrl}${path}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
}

const today = new Date().toISOString().slice(0, 10);
const entries = staticPages.map(([path, frequency, priority]) => entry(path, today, frequency, priority));

try {
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase build environment is not configured');
  const response = await fetch(`${supabaseUrl}/rest/v1/listings?select=id,updated_at,created_at&is_active=eq.true&order=created_at.desc&limit=1000`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
  });
  if (response.ok) {
    const listings = await response.json();
    for (const listing of listings) {
      const lastmod = String(listing.updated_at || listing.created_at || today).slice(0, 10);
      entries.push(entry(`/listing/${encodeURIComponent(listing.id)}`, lastmod, 'weekly', '0.7'));
    }
  } else {
    console.warn(`[sitemap] Supabase returned ${response.status}; generated static sitemap.`);
  }
} catch (error) {
  console.warn(`[sitemap] Listing fetch failed; generated static sitemap: ${String(error)}`);
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`;
await writeFile(new URL('../public/sitemap.xml', import.meta.url), xml, 'utf8');
console.log(`[sitemap] Generated ${entries.length} URLs.`);
