/* sw.js — Service Worker de désactivation AMBI241 */
/* Déployer ce fichier pour purger le cache des anciens utilisateurs PWA */

self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      return self.clients.claim();
    }).then(function() {
      /* Notifier tous les onglets ouverts */
      return self.clients.matchAll({ type: 'window' }).then(function(clients) {
        clients.forEach(function(client) {
          client.postMessage({ type: 'SW_DEACTIVATED' });
        });
      });
    })
  );
});

self.addEventListener('fetch', function(event) {
  /* Ne rien intercepter — laisser passer toutes les requêtes normalement */
  return;
});
