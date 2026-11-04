const CACHE = 'shipu-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      // 相对 SW 作用域解析，子路径部署时也能命中正确的首页
      .then((cache) => cache.addAll(['./']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // 只接管同源请求，跨域字体/CDN 交给浏览器自己的 HTTP 缓存
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // 206 分段响应和 opaque 响应无法写入 Cache Storage
        if (response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy)).catch(() => {});
        }
        return response;
      })
      .catch(async () => (await caches.match(event.request)) || Response.error()),
  );
});
