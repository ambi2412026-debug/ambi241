/* ══════════════════════════════════════════════════════
   AMBI241 — Service Worker v3
   ✅ Push Notifications
   ✅ notificationclick routing
   ✅ Mise à jour silencieuse automatique
   ══════════════════════════════════════════════════════ */

var CACHE_NAME = 'ambi241-v3';

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

/* ══════════════════════════════════════════════════════
   ✅ PUSH NOTIFICATIONS
   ══════════════════════════════════════════════════════ */
self.addEventListener('push', function(event) {
  var data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch(e) {
    data = { title: 'AMBI241', body: event.data ? event.data.text() : 'Nouvelle notification' };
  }

  var title   = data.title   || 'AMBI241';
  var body    = data.body    || 'Nouvelle notification';
  var icon    = data.icon    || './icon-192.png';
  var badge   = data.badge   || './icon-72.png';
  var tag     = data.tag     || 'ambi241-notif';
  var url     = data.url     || data.targetUrl || './';
  var vibrate = data.vibrate || [200, 100, 200];

  var options = {
    body:    body,
    icon:    icon,
    badge:   badge,
    tag:     tag,
    vibrate: vibrate,
    renotify: true,
    requireInteraction: data.requireInteraction || false,
    data: {
      targetUrl: url,
      tab:       data.tab       || null,
      sub:       data.sub       || null,
      modal:     data.modal     || null,
      dm:        data.dm        || null,
      autoAccept: data.autoAccept || null
    }
  };

  /* Actions rapides optionnelles */
  if (data.actions && Array.isArray(data.actions)) {
    options.actions = data.actions;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

/* ══════════════════════════════════════════════════════
   ✅ CLIC SUR NOTIFICATION → routing vers la bonne section
   ══════════════════════════════════════════════════════ */
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  var notifData  = event.notification.data || {};
  var targetUrl  = notifData.targetUrl || './';
  var action     = event.action || '';

  /* Support actions rapides (ex: "reply", "dismiss") */
  if (action === 'dismiss') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      /* 1. App déjà ouverte → on l'active et on lui envoie un message */
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.indexOf(self.location.origin) === 0 && 'focus' in client) {
          client.focus();
          client.postMessage({
            type: 'SW_NOTIF_CLICK',
            targetUrl:  targetUrl,
            tab:        notifData.tab        || null,
            sub:        notifData.sub        || null,
            modal:      notifData.modal      || null,
            dm:         notifData.dm         || null,
            autoAccept: notifData.autoAccept || null
          });
          return;
        }
      }
      /* 2. App fermée → ouvrir avec l'URL cible */
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

/* ── Push subscription change (renouvellement auto) ── */
self.addEventListener('pushsubscriptionchange', function(event) {
  event.waitUntil(
    self.registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: event.oldSubscription
        ? event.oldSubscription.options.applicationServerKey
        : null
    }).then(function(subscription) {
      /* Envoyer la nouvelle subscription à ton backend */
      return fetch('/api/push/resubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription)
      });
    }).catch(function(err) {
      console.warn('[AMBI241 SW] pushsubscriptionchange échoué:', err);
    })
  );
});
