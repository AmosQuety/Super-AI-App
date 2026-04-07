const CACHE_NAME = 'prism-vision-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/animation.css',
];

self.addEventListener('install', (e: any) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e: any) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
