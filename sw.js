/* ══════════════════════════════════════════════════════
   AMBI241 — Service Worker v2
   Mise à jour silencieuse automatique
   ══════════════════════════════════════════════════════ */

var CACHE_NAME = 'ambi241-v2';

var CACHE_URLS = [
  './',
  './index.html',
  './manifest.json'
];

/* ── Installation ── */
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return Promise.allSettled(
        CACHE_URLS.map(function(url){ return cache.add(url); })
      );
    })
  );
});

/* ── Activation : nettoie les anciens caches ── */
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys
          .filter(function(key){ return key !== CACHE_NAME; })
          .map(function(key){ return caches.delete(key); })
      );
    }).then(function(){
      return self.clients.claim();
    })
  );
});

/* ── Message depuis index.html → activation immédiate ── */
self.addEventListener('message', function(event) {
  if(event.data && event.data.type === 'SKIP_WAITING'){
    self.skipWaiting();
  }
});

/* ── Fetch : Network First, fallback cache si hors-ligne ── */
self.addEventListener('fetch', function(event) {
  if(event.request.method !== 'GET') return;
  if(!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      if(response && response.status === 200 && response.type === 'basic'){
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache){
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function(){
      return caches.match(event.request);
    })
  );
});
