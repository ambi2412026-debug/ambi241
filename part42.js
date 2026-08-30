
  /* ── 1. Enregistrement du Service Worker — désactivé (PWA supprimée) ── */

  /* ── 2. Lecture des lieux depuis IndexedDB au démarrage ── */
  window.ambi_loadLieuxFromCache = function(callback) {
    var req = indexedDB.open('ambi241-db', 1);

    req.onupgradeneeded = function(e) {
      var db = e.target.result;
      if (!db.objectStoreNames.contains('lieux')) {
        db.createObjectStore('lieux', { keyPath: 'id' });
      }
    };

    req.onsuccess = function(e) {
      var db = e.target.result;
      try {
        var tx    = db.transaction('lieux', 'readonly');
        var store = tx.objectStore('lieux');
        var all   = store.getAll();

        all.onsuccess = function() {
          var lieux = all.result || [];
          console.log('[AMBI241] 📦 ' + lieux.length + ' lieux chargés depuis IndexedDB');
          if (typeof callback === 'function') callback(lieux);
        };
        all.onerror = function() { if (typeof callback === 'function') callback([]); };
      } catch(e) {
        if (typeof callback === 'function') callback([]);
      }
    };

    req.onerror = function() { if (typeof callback === 'function') callback([]); };
  };

  /* ── 3. Sauvegarder les lieux dans IndexedDB ── */
  window.ambi_saveLieuxToCache = function(lieux) {
    if (!Array.isArray(lieux) || lieux.length === 0) return;

    /* IndexedDB direct (version web) */
    var req = indexedDB.open('ambi241-db', 1);
    req.onsuccess = function(e) {
      var db = e.target.result;
      try {
        var tx    = db.transaction('lieux', 'readwrite');
        var store = tx.objectStore('lieux');
        lieux.forEach(function(l) { store.put(l); });
        tx.oncomplete = function() {
          console.log('[AMBI241] 💾 ' + lieux.length + ' lieux sauvegardés en local');
        };
      } catch(err) {
        console.warn('[AMBI241] Erreur sauvegarde lieux:', err);
      }
    };
  };

  /* ── 4. Au démarrage : afficher les données locales immédiatement ── */
  document.addEventListener('DOMContentLoaded', function() {
    window.ambi_loadLieuxFromCache(function(lieuxCaches) {
      if (lieuxCaches.length > 0) {
        console.log('[AMBI241] ⚡ ' + lieuxCaches.length + ' lieux disponibles offline');
      }
    });
  });
  