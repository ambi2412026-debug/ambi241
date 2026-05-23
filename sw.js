/* ═══════════════════════════════════════════════════════════════
   AMBI241 — Service Worker v2.0
   Cache-first pour assets statiques
   Network-first pour Firestore / API temps réel
   IndexedDB sync pour les lieux (bars, restaurants…)
   ═══════════════════════════════════════════════════════════════ */

const CACHE_NAME  = 'ambi241-v2';
const DB_NAME     = 'ambi241-db';
const DB_VERSION  = 1;

/* ── Fichiers mis en cache dès l'installation ── */
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  /* Polices critiques (optionnel si CDN) */
  'https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500&display=swap',
];

/* ── Domaines qui doivent TOUJOURS passer par le réseau ── */
const NETWORK_DOMAINS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'maps.googleapis.com',
];

/* ════════════════════════════════════════════════════════════════
   1. INSTALLATION — pré-cache des assets statiques
   ════════════════════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  console.log('[SW] Install — mise en cache des assets statiques');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] Erreur install:', err))
  );
});

/* ════════════════════════════════════════════════════════════════
   2. ACTIVATION — nettoyage des vieux caches
   ════════════════════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  console.log('[SW] Activate — nettoyage ancien cache');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => {
          console.log('[SW] Suppression ancien cache:', k);
          return caches.delete(k);
        })
      ))
      .then(() => self.clients.claim())
  );
});

/* ════════════════════════════════════════════════════════════════
   3. FETCH — stratégie par type de requête
   ════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  /* A) Firestore / Auth / Maps → TOUJOURS réseau */
  if (NETWORK_DOMAINS.some(d => url.hostname.includes(d))) {
    event.respondWith(networkOnly(event.request));
    return;
  }

  /* B) Requêtes POST/PUT/DELETE → réseau (pas de cache) */
  if (event.request.method !== 'GET') {
    event.respondWith(fetch(event.request));
    return;
  }

  /* C) Assets statiques (.js, .css, .png, .woff2…) → cache-first */
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  /* D) Pages HTML → network-first avec fallback cache */
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  /* E) Tout le reste → stale-while-revalidate */
  event.respondWith(staleWhileRevalidate(event.request));
});

/* ════════════════════════════════════════════════════════════════
   4. STRATÉGIES DE CACHE
   ════════════════════════════════════════════════════════════════ */

/* Réseau uniquement (Firestore, Auth) */
async function networkOnly(request) {
  try {
    return await fetch(request);
  } catch (err) {
    console.warn('[SW] networkOnly — hors-ligne, requête ignorée:', request.url);
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/* Cache-first → assets statiques */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Asset non disponible hors-ligne', { status: 503 });
  }
}

/* Network-first → pages HTML */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || caches.match('/index.html');
  }
}

/* Stale-while-revalidate → images, API secondaires */
async function staleWhileRevalidate(request) {
  const cache  = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  return cached || await fetchPromise || new Response('Non disponible', { status: 503 });
}

/* ════════════════════════════════════════════════════════════════
   5. HELPER — détecter les assets statiques
   ════════════════════════════════════════════════════════════════ */
function isStaticAsset(url) {
  const staticExts = ['.js', '.css', '.png', '.jpg', '.jpeg', '.webp',
                      '.svg', '.ico', '.woff', '.woff2', '.ttf'];
  return staticExts.some(ext => url.pathname.endsWith(ext));
}

/* ════════════════════════════════════════════════════════════════
   6. MESSAGES depuis la page principale
   ════════════════════════════════════════════════════════════════ */
self.addEventListener('message', event => {
  if (!event.data) return;

  /* Forcer la mise à jour du SW */
  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Mise à jour forcée');
    self.skipWaiting();
  }

  /* Vider le cache (debug) */
  if (event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0]?.postMessage({ done: true });
    });
  }

  /* Sauvegarder les lieux en cache (appelé depuis index.html) */
  if (event.data.type === 'CACHE_LIEUX') {
    cacheLieux(event.data.lieux);
  }
});

/* ════════════════════════════════════════════════════════════════
   7. CACHE DES LIEUX via IndexedDB (accès direct permanent)
      Appelé depuis index.html : navigator.serviceWorker.controller
        .postMessage({ type: 'CACHE_LIEUX', lieux: [...] })
   ════════════════════════════════════════════════════════════════ */
function cacheLieux(lieux) {
  if (!Array.isArray(lieux) || lieux.length === 0) return;

  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = e => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains('lieux')) {
      const store = db.createObjectStore('lieux', { keyPath: 'id' });
      store.createIndex('categorie', 'categorie', { unique: false });
      store.createIndex('quartier',  'quartier',  { unique: false });
    }
    if (!db.objectStoreNames.contains('meta')) {
      db.createObjectStore('meta', { keyPath: 'key' });
    }
  };

  req.onsuccess = e => {
    const db = e.target.result;
    const tx = db.transaction(['lieux', 'meta'], 'readwrite');
    const store = tx.objectStore('lieux');

    /* Écrire chaque lieu */
    lieux.forEach(lieu => store.put(lieu));

    /* Horodatage de la dernière sync */
    tx.objectStore('meta').put({ key: 'lastSync', value: Date.now() });

    tx.oncomplete = () => {
      console.log(`[SW] ${lieux.length} lieux mis en cache IndexedDB`);
    };
    tx.onerror = err => console.warn('[SW] IndexedDB write error:', err);
  };

  req.onerror = err => console.warn('[SW] IndexedDB open error:', err);
}

/* ════════════════════════════════════════════════════════════════
   8. NOTIFICATIONS PUSH (si activées plus tard)
   ════════════════════════════════════════════════════════════════ */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || 'AMBI241', {
      body:    data.body    || 'Nouvelle activité sur AMBI241',
      icon:    '/icon-192.png',
      badge:   '/icon-192.png',
      vibrate: [100, 50, 100],
      data:    { url: data.url || '/' },
      actions: [
        { action: 'open',    title: '👀 Voir' },
        { action: 'dismiss', title: '✕ Fermer' }
      ]
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      const existing = windowClients.find(c => c.url === targetUrl && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(targetUrl);
    })
  );
});

console.log('[AMBI241] ✅ Service Worker v2.0 chargé');
