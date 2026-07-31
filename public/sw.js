// Minimal, hand-rolled service worker (no Workbox/next-pwa -- avoids a new
// dependency, matches this repo's no-framework-magic convention). Scope is
// deliberately narrow per REQ-27: cache the static app shell only, and give
// navigations a styled offline fallback when the network is unreachable.
// Never caches or serves a response for anything else -- no page HTML, no
// RSC payload, no API/Server Action response, no inventory/plan/receipt
// data is ever written into the Cache API. That's what keeps "offline shell
// caches but data does not sync offline" true.

const SHELL_CACHE = 'inventro-shell-v1';
const OFFLINE_URL = '/offline.html';
const SHELL_ASSETS = ['/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-maskable.svg', OFFLINE_URL];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Per-asset fetch+put, not cache.add()/cache.addAll(): addAll is
      // all-or-nothing (one failed asset aborts the whole install, leaving
      // a registered-but-useless worker with an empty cache -- a missing
      // shell asset should degrade, not fail closed), and cache.add() has
      // thinner browser support than fetch+put -- an unsupported cache.add()
      // would silently no-op every asset while still reporting "success",
      // which no check against a real server can detect after the fact.
      Promise.all(
        SHELL_ASSETS.map((url) =>
          fetch(url)
            .then((response) => {
              if (!response.ok) throw new Error(`${url}: ${response.status}`);
              return cache.put(url, response);
            })
            .catch((err) => {
              console.warn('[sw] failed to precache', url, err);
            }),
        ),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  // Only ever intervene on top-level navigations. Every other request
  // (data fetches, Server Actions, API routes, RSC payloads, _next static
  // chunks, images) passes straight through to the network untouched.
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(OFFLINE_URL);
      return (
        cached ??
        new Response('<h1>Offline</h1><p>Inventro needs a connection.</p>', {
          status: 503,
          headers: { 'Content-Type': 'text/html' },
        })
      );
    }),
  );
});
