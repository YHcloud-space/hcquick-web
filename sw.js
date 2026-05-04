const CACHE_NAME = 'hcquick-v12';  // ⬆️ 升级版本，强制刷新

const urlsToCache = [
  '/mobile/',
  '/mobile/index.html',
  '/mobile/style.css',
  '/mobile/db.js',
  '/mobile/brand-spec.js',
  '/mobile/material-calc.js',
  '/mobile/manifest.json',
  '/mobile/icon-192.png',
  '/mobile/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.searchParams.has('force-reload')) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
