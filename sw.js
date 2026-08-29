/* ══════════════════════════════════════════════════
   AMBI241 — Service Worker
   Push Notifications + Badge + Cache offline
   ══════════════════════════════════════════════════ */

const CACHE_NAME    = 'ambi241-v2';
const SHELL_CACHE   = CACHE_NAME + '-shell';
const RUNTIME_CACHE = CACHE_NAME + '-runtime';

/* App shell : tout ce qu'il faut pour afficher l'app hors-ligne.
   Complète cette liste si tu ajoutes d'autres fichiers "cœur". */
const OFFLINE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './core-app.js',
  './style.css',
  './styles.css',
  './favicon.png',
  './apple-touch-icon.png',
  './og-image.jpg',
  './icon-72.png',
  './icon-96.png',
  './icon-128.png',
  './icon-144.png',
  './icon-152.png',
  './icon-192.png',
  './icon-384.png',
  './icon-512.png'
];

/* Jamais interceptés : temps réel / auth, la donnée live ne doit
   jamais être servie depuis un cache obsolète */
const NEVER_CACHE_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'firebasestorage.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'securetoken.googleapis.com',
  'maps.googleapis.com'
];

/* CDN versionnées dans l'URL → sans risque en cache-first */
const CDN_CACHE_HOSTS = [
  'unpkg.com',
  'cdnjs.cloudflare.com',
  'fonts.gstatic.com',
  'fonts.googleapis.com',
  'www.gstatic.com'
];

// ── INSTALLATION : mise en cache de l'app shell ──
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return Promise.all(
        OFFLINE_ASSETS.map(function (url) {
          return cache.add(url).catch(function (err) {
            console.warn('[SW] pré-cache raté pour', url, err);
          });
        })
      );
    }).then(function () { self.skipWaiting(); })
  );
});

// ── ACTIVATION : suppression des anciens caches ──
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key.startsWith('ambi241-') && key !== SHELL_CACHE && key !== RUNTIME_CACHE; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () { self.clients.claim(); })
  );
});

// ── FETCH ──
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  var url = new URL(request.url);

  // Firebase / Auth / Maps : toujours en direct, jamais de cache
  if (NEVER_CACHE_HOSTS.some(function (host) { return url.hostname.includes(host); })) {
    return;
  }

  // Navigation (ouverture / rechargement de page) → network-first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // CDN versionnées (Leaflet, polices, qrcode.js...) → cache-first
  if (CDN_CACHE_HOSTS.some(function (host) { return url.hostname.includes(host); })) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // Assets même origine (JS/CSS/images locaux) → stale-while-revalidate
  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }
  // Tout le reste : laisser passer normalement
});

function networkFirst(request) {
  return caches.open(SHELL_CACHE).then(function (cache) {
    return fetch(request).then(function (fresh) {
      cache.put(request, fresh.clone());
      return fresh;
    }).catch(function () {
      return cache.match(request).then(function (cached) {
        return cached || cache.match('./index.html');
      });
    });
  });
}

function cacheFirst(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (fresh) {
        cache.put(request, fresh.clone());
        return fresh;
      }).catch(function () { return cached; });
    });
  });
}

function staleWhileRevalidate(request) {
  return caches.open(RUNTIME_CACHE).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var fetchPromise = fetch(request).then(function (fresh) {
        cache.put(request, fresh.clone());
        return fresh;
      }).catch(function () { return cached; });
      return cached || fetchPromise;
    });
  });
}

// ══════════════════════════════════════════════════
// ── PUSH NOTIFICATIONS ── (inchangé)
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
  var icon    = data.icon    || './icon-512.png';
  var badge   = data.badge   || './favicon.png';
  var tag     = data.tag     || 'ambi241-notif';
  var url     = data.url     || './index.html';
  var count   = data.count   || 0;

  var options = {
    body:    body,
    icon:    icon,
    badge:   badge,
    tag:     tag,
    data:    { url: url },
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open',    title: '👀 Voir',    icon: './favicon.png' },
      { action: 'dismiss', title: '✕ Ignorer' }
    ]
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      count > 0 && self.registration.setAppBadge
        ? self.registration.setAppBadge(count)
        : Promise.resolve()
    ])
  );
});

// ── Clic sur la notification ── (inchangé)
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var action = event.action;
  var url = (event.notification.data && event.notification.data.url) || './index.html';

  if (action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if ('focus' in client) {
            client.focus();
            if ('navigate' in client) client.navigate(url);
            return;
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ── Fermeture de la notification ── (inchangé)
self.addEventListener('notificationclose', function(event) {
  // Optionnel : analytics de fermeture
});

// ══════════════════════════════════════════════════
// ── MESSAGE depuis l'app principale ── (inchangé)
// ══════════════════════════════════════════════════
self.addEventListener('message', function(event) {
  if (!event.data) return;

  if (event.data.type === 'SET_BADGE' && self.registration.setAppBadge) {
    var n = parseInt(event.data.count) || 0;
    if (n > 0) {
      self.registration.setAppBadge(n);
    } else {
      self.registration.clearAppBadge && self.registration.clearAppBadge();
    }
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
