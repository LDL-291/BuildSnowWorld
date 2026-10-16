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
    const req = e.request;
    const url = new URL(req.url);

    // Only same-origin GETs for the game's own static files are cached here. Everything else goes straight to
    // the network: the API (api.arghorithm.com) returns per-player data (wallet, rewards, weekly state...), and
    // caching it cache-first by URL froze those responses at their first value (stars stuck at 0, rewards that
    // never updated). Addressables bundles and local catalogs (RemoteAssets/, StreamingAssets/) are cached by
    // Unity's own IndexedDB cache; range requests and non-GET requests cannot be cached safely.
    if (req.method !== 'GET' || url.origin !== self.location.origin || req.headers.has('range') ||
        url.pathname.indexOf('/RemoteAssets/') !== -1 || url.pathname.indexOf('/StreamingAssets/') !== -1) {
        return;
    }

    e.respondWith((async function () {
      let response = await caches.match(req);
      console.log(`[Service Worker] Fetching resource: ${req.url}`);
      if (response) { return response; }

      response = await fetch(req);
      if (response.ok && response.status === 200) {
        const cache = await caches.open(cacheName);
        console.log(`[Service Worker] Caching new resource: ${req.url}`);
        cache.put(req, response.clone());
      }
      return response;
    })());
});
