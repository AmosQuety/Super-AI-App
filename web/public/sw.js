const CACHE_NAME = 'prism-vision-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/index.css',
  '/animation.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => response || fetch(e.request))
  );
});
