// cacheVersion MUST change on every deploy that touches Build/* content -- the fetch
// handler below is cache-first with no revalidation, so a stale cacheName means browsers
// serve old cached bundle bytes forever regardless of what's actually redeployed (real
// incident: 2026-08-18, "Invalid binary data file size" from a data.br cached under an
// unchanged cache name across multiple redeploys).
const cacheVersion = "0b32016b18b6";
const cacheName = `Arghorithm-snow-world-${cacheVersion}`;
const contentToCache = [
    "TemplateData/style.css"
];

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    self.skipWaiting();

    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      // {cache: 'reload'} forces a real network fetch per URL, bypassing the HTTP
      // cache -- cache.addAll() alone can still pick up an HTTP-cached stale response.
      await Promise.all(contentToCache.map(async (url) => {
        const response = await fetch(url, { cache: 'reload' });
        await cache.put(url, response);
      }));
    })());
});

self.addEventListener('activate', function (e) {
    console.log('[Service Worker] Activate');
    e.waitUntil((async function () {
      const names = await caches.keys();
      await Promise.all(names.filter(n => n !== cacheName).map(n => caches.delete(n)));
      await self.clients.claim();
    })());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      let response = await caches.match(e.request);
      console.log(`[Service Worker] Fetching resource: ${e.request.url}`);
      if (response) { return response; }

      response = await fetch(e.request);
      const cache = await caches.open(cacheName);
      console.log(`[Service Worker] Caching new resource: ${e.request.url}`);
      cache.put(e.request, response.clone());
      return response;
    })());
});
