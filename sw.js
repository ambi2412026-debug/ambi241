// ════════════════════════════════════════════════
//  AMBI241 — Service Worker PWA
//  Gère le cache, l'offline et les mises à jour
// ════════════════════════════════════════════════

const CACHE_NAME = 'ambi241-v1.0.0';
const OFFLINE_URL = './index.html';

// Ressources à mettre en cache au premier chargement
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
];

// ══ INSTALLATION ══
self.addEventListener('install', function(event) {
  console.log('[SW] Installation AMBI241...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[SW] Mise en cache des ressources...');
      // On cache chaque ressource individuellement pour éviter qu'une erreur bloque tout
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(function(url) {
          return cache.add(url).catch(function(err) {
            console.warn('[SW] Impossible de cacher:', url, err);
          });
        })
      );
    }).then(function() {
      console.log('[SW] Installation terminée');
      return self.skipWaiting();
    })
  );
});

// ══ ACTIVATION (nettoyage anciens caches) ══
self.addEventListener('activate', function(event) {
  console.log('[SW] Activation AMBI241...');
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) {
            console.log('[SW] Suppression ancien cache:', name);
            return caches.delete(name);
          })
      );
    }).then(function() {
      console.log('[SW] Actif et en contrôle');
      return self.clients.claim();
    })
  );
});

// ══ FETCH — Stratégie Network First + fallback Cache ══
self.addEventListener('fetch', function(event) {
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Ignorer les extensions Chrome et requêtes internes
  if (event.request.url.startsWith('chrome-extension://')) return;
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('googleapis.com/identitytoolkit')) return;

  event.respondWith(
    fetch(event.request)
      .then(function(networkResponse) {
        // Succès réseau → on met à jour le cache
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          var responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(function() {
        // Pas de réseau → on essaie le cache
        return caches.match(event.request).then(function(cachedResponse) {
          if (cachedResponse) {
            console.log('[SW] Servi depuis cache (offline):', event.request.url);
            return cachedResponse;
          }
          // Fallback sur la page principale si c'est une navigation
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
          // Réponse vide pour les autres ressources
          return new Response('', {
            status: 408,
            statusText: 'Hors ligne - Ressource non disponible'
          });
        });
      })
  );
});

// ══ MESSAGE — Force la mise à jour ══
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

console.log('[SW] AMBI241 Service Worker chargé ✅');
