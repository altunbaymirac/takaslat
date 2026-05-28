/**
 * Takaslat — Service Worker
 *
 * Strateji:
 *   - Static assets (HTML, CSS, JS, icons): cache-first
 *   - API çağrıları (/api/...): network-only (cache yok, çünkü gerçek zamanlı)
 *   - Diğer her şey: stale-while-revalidate
 */

const CACHE_VERSION = 'takaslat-v1';
const CACHE_NAME    = `${CACHE_VERSION}-static`;

const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg',
];

// ── Install: pre-cache temel kaynaklar ──────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

// ── Activate: eski cache'leri temizle ───────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !k.startsWith(CACHE_VERSION)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: route-based strateji ─────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // API çağrılarını cache'leme — her zaman gerçek backend'e git
  if (url.pathname.startsWith('/api/')) {
    return; // varsayılan davranış (network)
  }

  // GET olmayan istekleri cache'leme
  if (event.request.method !== 'GET') return;

  // Vite HMR / dev kaynaklarını atla
  if (url.pathname.startsWith('/@vite') || url.pathname.startsWith('/@react-refresh')) return;

  // Stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(event.request);
      const networkPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cached);

      return cached ?? networkPromise;
    })
  );
});
