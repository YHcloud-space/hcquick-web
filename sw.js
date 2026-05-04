const CACHE_NAME = 'hcquick-v14';  // ⬆️ 再升级版本，强制更新

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

  // ✅ 跳过 data.cloudgj.cn 的所有请求，直接走网络（避免跨域缓存问题）
  if (url.hostname === 'data.cloudgj.cn') {
    event.respondWith(fetch(event.request));
    return;
  }

  // 原有 force-reload 跳过缓存逻辑
  if (url.searchParams.has('force-reload')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 其他请求走缓存优先
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});
