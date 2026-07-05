const CACHE = 'helferchen-v3';
const STATIC = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Pass API requests through
  if (e.request.url.includes('/api/')) return;
  
  // Stale-while-revalidate for everything else
  e.respondWith(
    caches.open(CACHE).then(cache => {
      return cache.match(e.request).then(cached => {
        const networked = fetch(e.request).then(res => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            cache.put(e.request, res.clone());
          }
          return res;
        }).catch(() => cache.match('/index.html'));
        return cached || networked;
      });
    })
  );
});
