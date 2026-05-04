// sw.js - 在 /mobile/ 目录下

const CACHE_NAME = 'hcquick-v3'; // 升级版本号

// 仅缓存本站核心文件，不缓存外部或可能失败的文件
const urlsToCache = [
  '/mobile/',
  '/mobile/index.html',
  '/mobile/style.css',
  '/mobile/db.js',
  '/mobile/brand-spec.js',
  '/mobile/material-calc.js',
  '/mobile/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // 逐个缓存，并忽略失败的文件，防止安装完全失败
      return Promise.allSettled(
        urlsToCache.map(url =>
          cache.add(url).catch(err => {
            console.warn('⚠️ 跳过缓存失败:', url, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 精准拦截：只缓存本站文档，data.cloudgj.cn 放行
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 1. data.cloudgj.cn 的全部请求都走网络
  if (url.hostname === 'data.cloudgj.cn') {
    return; // 不拦截，浏览器直接请求
  }

  // 2. 可选：强制刷新的忽略
  if (url.searchParams.has('force-reload')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. 仅对本站文档和代码文件走缓存优先
  if (
    event.request.destination === 'document' ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css')
  ) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
  }
  // 其他请求（图片、图标、视频等）完全放行
});
