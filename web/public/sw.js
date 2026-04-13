const CACHE_NAME = 'prism-vision-v3';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/animation.css',
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  // Skip non-http/https requests (like WebSockets for HMR, chrome-extensions, etc.)
  if (!e.request.url.startsWith('http')) return;

  const url = new URL(e.request.url);

  // ── Network-First for API/GraphQL (GET only) ──────────────────────────────
  if (url.pathname.includes('/graphql') || url.pathname.includes('/api/')) {
    if (e.request.method === 'GET') {
      e.respondWith(
        fetch(e.request).then(response => {
          if (response && response.ok) {
            const cloned = response.clone();
            // Fire-and-forget cache storage
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
      return cache.match(e.request).then(cachedResponse => {
        const fetchPromise = fetch(e.request).then(networkResponse => {
          if (
            networkResponse &&
            networkResponse.ok &&
            e.request.method === 'GET' &&
            url.origin === self.location.origin
          ) {
            // Clone FIRST before the response is ever used/returned
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

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (_error) {
    payload = {
      title: 'Xemora update',
      body: event.data ? event.data.text() : 'Your task has an update.',
    };
  }

  const title = payload.title || 'Xemora notification';
  const options = {
    body: payload.body || 'Your task has an update.',
    icon: payload.icon || '/icon.svg',
    badge: payload.badge || '/icon.svg',
    tag: payload.tag || 'xemora-task-update',
    renotify: Boolean(payload.renotify),
    data: payload.data || { url: '/dashboard' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const destination = event.notification?.data?.url || '/dashboard';
  const targetUrlObject = new URL(destination, self.location.origin);
  const taskId = event.notification?.data?.taskId || null;
  if (taskId) {
    targetUrlObject.searchParams.set('pushTaskId', taskId);
  }
  targetUrlObject.searchParams.set('pushEvent', 'clicked');
  const targetUrl = targetUrlObject.href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (!('focus' in client)) {
          continue;
        }

        if ('navigate' in client) {
          return client.navigate(targetUrl).then(() => client.focus()).catch(() => client.focus());
        }

        return client.focus();
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }

      return Promise.resolve();
    })
  );
});
