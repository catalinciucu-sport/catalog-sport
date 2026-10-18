// Catalog Sport – păstrează aplicația pe dispozitiv, ca să se deschidă și fără internet.
// Fișierele aplicației se iau întâi de pe internet (așa primești imediat actualizările) și se păstrează
// în cache pentru când nu ai semnal. Nu e nevoie să schimbi nimic aici când actualizezi aplicația.
const CACHE = 'catalog-sport';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', 'index.html'])).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // fișierele aplicației: internet întâi, cache dacă nu e semnal
    e.respondWith(fetch(req, {cache: 'no-cache'}).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => caches.match(req, {ignoreSearch: true}).then(hit => hit || caches.match('index.html'))));
  } else if (/cdnjs\.cloudflare\.com|fonts\.(googleapis|gstatic)\.com/.test(url.hostname)) {
    // biblioteca Excel și fonturile nu se schimbă: cache întâi
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r;
    })));
  }
  // restul (datele către Google) merg direct, fără cache
});
