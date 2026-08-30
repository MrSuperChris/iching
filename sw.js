// Offline cache for the I Ching PWA.
// Network-first: always prefer fresh files when online, fall back to cache offline.
// (Cache-first traps stale assets, which masks updates — avoid it here.)
// Bump CACHE on every deploy: a changed sw.js makes returning clients pick up the
// new worker, which purges the old cache in activate() — no hard-refresh needed.
const CACHE = "iching-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./iching.js",
  "./data.js",
  "./manifest.webmanifest",
  "./icons/icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    // Force the network attempt past the browser HTTP cache, or "network-first"
    // can still hand back an HTTP-cached stale asset (GitHub Pages max-age=600).
    fetch(e.request, { cache: "reload" })
      .then((res) => {
        // Only cache a genuine success — never a 404/5xx error page served during a
        // deploy window, which would otherwise become the stale offline fallback.
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
