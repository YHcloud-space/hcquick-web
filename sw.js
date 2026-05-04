const CACHE_NAME = 'hcquick-v11';  // ✅ 版本号升级

const urlsToCache = [
  '/mobile/',                         // 主路径
  '/mobile/index.html',
  '/mobile/style.css',
  '/mobile/db.js',
  '/mobile/brand-spec.js',
  '/mobile/material-calc.js',
  '/mobile/manifest.json',
  '/mobile/icon-192.png',             // 🔔 添加图标
  '/mobile/icon-512.png'  
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
