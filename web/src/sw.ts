// sw.ts — Service Worker (xemora-v4)
// Strategy summary:
//   /graphql, /api/*   → Network-first, cache fallback, offline.html if nothing cached
//   static assets      → Stale-While-Revalidate
//   everything else    → Stale-While-Revalidate, offline.html as last resort

const CACHE_NAME = 'xemora-v4';
const OFFLINE_URL = '/offline.html';

const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/animation.css',
  OFFLINE_URL, // Pre-cache offline fallback page
];

self.addEventListener('install', (e: any) => {
  (self as any).skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e: any) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        // Delete all old cache versions — only keep current CACHE_NAME
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => (self as any).clients.claim())
  );
});

self.addEventListener('fetch', (e: any) => {
  // Skip non-http/https (WebSockets, chrome-extensions, etc.)
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // ── Network-First for API / GraphQL ─────────────────────────────────────
  if (url.pathname.includes('/graphql') || url.pathname.includes('/api/')) {
    if (e.request.method === 'GET') {
      e.respondWith(
        fetch(e.request)
          .then((response: Response) => {
            if (response && response.ok) {
              const cloned = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(e.request, cloned));
            }
            return response;
          })
          .catch(async () => {
            // Cache miss + offline → return offline page instead of browser error
            const cached = await caches.match(e.request);
            return cached ?? (await caches.match(OFFLINE_URL))!;
          })
      );
    }
    return;
  }

  // ── Stale-While-Revalidate for all static assets ─────────────────────────
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then((cachedResponse: Response | undefined) => {
        const fetchPromise = fetch(e.request)
          .then((networkResponse: Response) => {
            if (
              networkResponse &&
              networkResponse.ok &&
              e.request.method === 'GET' &&
              url.origin === (self as any).location.origin
            ) {
              cache.put(e.request, networkResponse.clone());
            }
            return networkResponse;
          })
          .catch(async () => {
            // Network failed and no cache — serve offline fallback
            return (await caches.match(OFFLINE_URL)) ?? new Response('Offline', { status: 503 });
          });

        // Serve cache instantly while revalidating in background
        return cachedResponse ?? fetchPromise;
      });
    })
  );
});
