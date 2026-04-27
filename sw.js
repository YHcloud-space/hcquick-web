const CACHE_NAME = 'hcquick-v10';  // ✅ 版本号升级

const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/db.js',
  '/brand-spec.js',
  '/material-calc.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();  // ✅ 立即激活
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();  // ✅ 立即接管所有页面
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    
    // 如果 URL 中包含 ?force-reload，跳过缓存，直接走网络
    if (url.searchParams.has('force-reload')) {
        event.respondWith(fetch(event.request));
        return;
    }
    
    // 否则走缓存优先策略
    event.respondWith(
        caches.match(event.request).then(cached => cached || fetch(event.request))
    );
});
