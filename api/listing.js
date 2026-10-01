// /listing/:id isteklerini karşılar (vercel.json rewrite). İlanı Supabase'den
// istek anında okuyup SPA şablonuna title/description/canonical/JSON-LD basar;
// böylece deploy'dan sonra açılan ilanlar da botlara doğru meta ile görünür,
// kaldırılan ilanlar 404 + noindex döner.
import { LISTING_FIELDS, renderListingPage, renderNotFoundPage } from './_lib/seo.js';

export const config = { runtime: 'edge' };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

let cachedTemplate = null;

async function loadTemplate(request) {
  if (cachedTemplate) return { html: cachedTemplate };
  // Preview deploy'larda Vercel koruması varsa ziyaretçinin çerezi şablon isteğini de yetkilendirir.
  const cookie = request.headers.get('cookie');
  const response = await fetch(new URL('/index.html', request.url), cookie ? { headers: { cookie } } : undefined);
  if (!response.ok) return { response };
  cachedTemplate = await response.text();
  return { html: cachedTemplate };
}

function html(body, status, cacheControl) {
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cacheControl },
  });
}

async function fetchListing(id) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error('Supabase environment is not configured');
  // Anon anahtar RLS'e tabidir: yalnızca aktif ve reddedilmemiş ilanlar döner.
  const response = await fetch(
    `${supabaseUrl}/rest/v1/listings?select=${LISTING_FIELDS}&id=eq.${id}&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  if (!response.ok) throw new Error(`Supabase returned ${response.status}`);
  const rows = await response.json();
  return rows[0] ?? null;
}

export default async function handler(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id') ?? decodeURIComponent(url.pathname.split('/').pop() ?? '');
  const path = `/listing/${encodeURIComponent(id)}`;

  const template = await loadTemplate(request);
  if (!template.html) return template.response;

  if (!UUID_PATTERN.test(id)) {
    return html(renderNotFoundPage(template.html, path), 404, 'public, s-maxage=3600');
  }

  let listing;
  try {
    listing = await fetchListing(id);
  } catch (error) {
    // Veritabanına ulaşılamazsa uygulamayı yine aç; istemci ilanı kendisi yükler.
    console.error(`[listing-seo] ${String(error)}`);
    return html(template.html, 200, 'no-store');
  }

  if (!listing) {
    // Sahibi pasif ilanını görebilsin diye gövde yine SPA; botlar 404 görür.
    return html(renderNotFoundPage(template.html, path), 404, 'public, s-maxage=60');
  }

  return html(
    renderListingPage(template.html, listing),
    200,
    'public, s-maxage=300, stale-while-revalidate=3600',
  );
}
