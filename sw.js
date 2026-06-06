/* ══════════════════════════════════════════════════
   AMBI241 — Service Worker
   Push Notifications + Badge + Cache offline
   ══════════════════════════════════════════════════ */

const CACHE_NAME = 'ambi241-v1';
const OFFLINE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/apple-touch-icon.png',
  '/og-image.jpg'
];

// ── INSTALLATION : mise en cache des ressources essentielles ──
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(OFFLINE_ASSETS);
    }).catch(function() {
      // Si un fichier manque, on continue quand même
      return Promise.resolve();
    })
  );
  self.skipWaiting();
});

// ── ACTIVATION : suppression des anciens caches ──
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(key) { return key !== CACHE_NAME; })
            .map(function(key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// ── FETCH : stratégie Network-first avec fallback cache ──
self.addEventListener('fetch', function(event) {
  // Ignorer les requêtes non-GET et Firebase
  if (event.request.method !== 'GET') return;
  if (event.request.url.includes('firestore.googleapis.com')) return;
  if (event.request.url.includes('identitytoolkit.googleapis.com')) return;

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Mettre en cache les nouvelles ressources
        if (response && response.status === 200 && response.type === 'basic') {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Fallback depuis le cache si hors ligne
        return caches.match(event.request).then(function(cached) {
          return cached || caches.match('/index.html');
        });
      })
  );
});

// ══════════════════════════════════════════════════
// ── PUSH NOTIFICATIONS ──
// ══════════════════════════════════════════════════
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'AMBI241', body: event.data ? event.data.text() : 'Nouvelle notification' };
  }

  var title   = data.title   || 'AMBI241 🎶';
  var body    = data.body    || 'Découvrez l\'ambiance en direct à Libreville !';
  var icon    = data.icon    || '/icon-512.png';
  var badge   = data.badge   || '/favicon.png';
  var tag     = data.tag     || 'ambi241-notif';
  var url     = data.url     || '/';
  var count   = data.count   || 0;

  var options = {
    body:    body,
    icon:    icon,
    badge:   badge,
    tag:     tag,
    data:    { url: url },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: '👀 Voir',    icon: '/favicon.png' },
      { action: 'dismiss', title: '✕ Ignorer' }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Mettre à jour le badge (nombre de messages non lus)
      count > 0 && self.registration.setAppBadge
        ? self.registration.setAppBadge(count)
        : Promise.resolve()
    ])
  );
});

// ── Clic sur la notification ──
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var action = event.action;
  var url = (event.notification.data && event.notification.data.url) || '/';

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Si l'app est déjà ouverte, la mettre au premier plan
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(url);
            return;
          }
        }
        // Sinon ouvrir une nouvelle fenêtre
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ── Fermeture de la notification ──
self.addEventListener('notificationclose', function(event) {
  // Optionnel : analytics de fermeture
});

// ══════════════════════════════════════════════════
// ── MESSAGE depuis l'app principale ──
// ══════════════════════════════════════════════════
self.addEventListener('message', function(event) {
  if (!event.data) return;

  // Mettre à jour le badge depuis l'app
  if (event.data.type === 'SET_BADGE' && self.registration.setAppBadge) {
    var n = parseInt(event.data.count) || 0;
    if (n > 0) {
      self.registration.setAppBadge(n);
    } else {
      self.registration.clearAppBadge && self.registration.clearAppBadge();
    }
  }

  // Forcer mise à jour du SW
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
