const cacheName = "Arghorithm-snow-world-1.0.2";
const contentToCache = [
    "Build/BuildSnowWorld.loader.js",
    "Build/BuildSnowWorld.framework.js.br",
    "Build/BuildSnowWorld.data.br",
    "Build/BuildSnowWorld.wasm.br",
    "TemplateData/style.css"

];

self.addEventListener('install', function (e) {
    console.log('[Service Worker] Install');
    self.skipWaiting();

    e.waitUntil((async function () {
      const cache = await caches.open(cacheName);
      console.log('[Service Worker] Caching all: app shell and content');
      await cache.addAll(contentToCache);
    })());
});

self.addEventListener('activate', function (e) {
    console.log('[Service Worker] Activate');
    e.waitUntil((async function () {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== cacheName).map(k => caches.delete(k)));
      await self.clients.claim();
    })());
});

self.addEventListener('fetch', function (e) {
    e.respondWith((async function () {
      try {
        const response = await fetch(e.request);
        const cache = await caches.open(cacheName);
        cache.put(e.request, response.clone());
        return response;
      } catch (err) {
        const cached = await caches.match(e.request);
        if (cached) return cached;
        throw err;
      }
    })());
});
