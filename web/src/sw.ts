const CACHE_NAME = 'prism-vision-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/animation.css',
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
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => (self as any).clients.claim())
  );
});

self.addEventListener('fetch', (e: any) => {
  // Skip non-http/https requests (like WebSockets for HMR, chrome-extensions, etc.)
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // ── Network-First for API/GraphQL (GET only) ──────────────────────────────
  if (url.pathname.includes('/graphql') || url.pathname.includes('/api/')) {
    if (e.request.method === 'GET') {
      e.respondWith(
        fetch(e.request).then((response: Response) => {
          if (response && response.ok) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, cloned));
          }
          return response;
        }).catch(() => caches.match(e.request))
      );
    }
    return;
  }

  // ── Stale-While-Revalidate for static assets ──────────────────────────────
  e.respondWith(
    caches.open(CACHE_NAME).then(cache => {
      return cache.match(e.request).then((cachedResponse: Response | undefined) => {
        const fetchPromise = fetch(e.request).then((networkResponse: Response) => {
          if (
            networkResponse &&
            networkResponse.ok &&
            e.request.method === 'GET' &&
            url.origin === (self as any).location.origin
          ) {
            const clonedResponse = networkResponse.clone();
            cache.put(e.request, clonedResponse);
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      });
    })
  );
});
