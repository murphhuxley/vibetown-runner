// Vibetown Runner Service Worker
// Strategies:
//   - Stale-while-revalidate: /assets/index-*.{js,css} (hashed bundle)
//   - Cache-first: /assets/sprites/, /assets/tilesets/, /assets/audio/, /assets/backgrounds/, /assets/fonts/
//   - Network-only: Convex RPC, /api/*

const CACHE = 'vibetown-v1';
const SHELL = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function isBundle(url) {
  return /\/assets\/index-[^/]+\.(js|css)$/.test(url.pathname);
}

function isCacheableAsset(url) {
  return /\/assets\/(sprites|tilesets|audio|backgrounds|fonts)\//.test(url.pathname)
    || /\/icons\//.test(url.pathname)
    || /\/splash\//.test(url.pathname);
}

function isNetworkOnly(url) {
  return /\.convex\.cloud$/.test(url.hostname) || /^\/api\//.test(url.pathname);
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (isNetworkOnly(url)) return; // default network
  if (isCacheableAsset(url)) {
    event.respondWith(
      caches.match(event.request).then(hit => hit || fetch(event.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(event.request, clone));
        return res;
      }))
    );
    return;
  }
  if (isBundle(url) || SHELL.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then(hit => {
        const fetchPromise = fetch(event.request).then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(event.request, clone));
          return res;
        }).catch(() => hit);
        return hit || fetchPromise;
      })
    );
  }
});
