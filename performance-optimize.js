/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — performance-optimize.js  (v3.0 — OPTIMISÉ)
   ✅ Cache localStorage 5 min (partagé entre tous les modules)
   ✅ _countByType() — seule requête compteur, résultat en cache
   ✅ Préchargement AGRESSIF : compteurs + top du moment dès Firebase prêt
   ✅ Lazy loading images, débounce, throttle
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ─────────────────────────────────────────────────────────────
  // CACHE LOCAL (partagé entre tous les modules)
  // ─────────────────────────────────────────────────────────────
  window._getCachedData = function (key) {
    try {
      const raw = localStorage.getItem(`ambi_cache_${key}`);
      if (!raw) return null;
      const { data, timestamp } = JSON.parse(raw);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(`ambi_cache_${key}`);
        return null;
      }
      console.log(`✅ Cache HIT: ${key}`);
      return data;
    } catch {
      localStorage.removeItem(`ambi_cache_${key}`);
      return null;
    }
  };

  window._setCachedData = function (key, data) {
    try {
      localStorage.setItem(`ambi_cache_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      console.log(`💾 Cache SET: ${key}`);
    } catch (e) {
      // localStorage plein : vider les plus vieux et réessayer
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('ambi_cache_'))
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(`ambi_cache_${key}`, JSON.stringify({ data, timestamp: Date.now() }));
      } catch { /* silencieux */ }
    }
  };

  window._clearCache = function () {
    Object.keys(localStorage)
      .filter(k => k.startsWith('ambi_cache_'))
      .forEach(k => localStorage.removeItem(k));
    console.log('🗑️ Cache vidé');
  };

  // ─────────────────────────────────────────────────────────────
  // COMPTEUR RAPIDE PAR TYPE (UNE SEULE requête pour tout)
  // Résultat mis en cache — accueil.js le lit sans refaire la requête
  // ─────────────────────────────────────────────────────────────
  window._countByType = async function () {
    // ✅ Vérifier le cache d'abord → retour immédiat
    const cached = window._getCachedData('count_by_type');
    if (cached) return cached;

    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Perf] Firebase non dispo pour _countByType');
      return {};
    }

    try {
      const snap = await window.fbGetDocs(
        window.fbCollection(window.db, 'etablissements')
      );
      const counts = {};
      snap.forEach(doc => {
        const t = (doc.data().type || 'autre').toLowerCase().trim();
        counts[t] = (counts[t] || 0) + 1;
      });
      window._setCachedData('count_by_type', counts);
      console.log('[Perf] ✅ _countByType :', counts);
      return counts;
    } catch (e) {
      console.error('[Perf] ❌ _countByType :', e.message);
      return {};
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PRÉCHARGEMENT TOP DU MOMENT (fire & forget)
  // Pré-cache les 6 premiers établissements pour accueil.js
  // ─────────────────────────────────────────────────────────────
  window._prefetchTop = async function () {
    // Déjà en cache ? Rien à faire
    if (window._getCachedData('top_du_moment')) return;
    if (!window.db || !window.fbGetDocs || !window.fbCollection) return;

    try {
      let snap;
      if (window.fbQuery && window.fbOrderBy && window.fbLimit) {
        snap = await window.fbGetDocs(
          window.fbQuery(
            window.fbCollection(window.db, 'etablissements'),
            window.fbOrderBy('createdAt', 'desc'),
            window.fbLimit(6)
          )
        );
      } else {
        snap = await window.fbGetDocs(
          window.fbCollection(window.db, 'etablissements')
        );
      }

      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
      items.sort((a, b) => {
        const ta = a.createdAt?.seconds || a.createdAt || 0;
        const tb = b.createdAt?.seconds || b.createdAt || 0;
        return tb - ta;
      });

      window._setCachedData('top_du_moment', items.slice(0, 6));
      console.log('[Perf] ✅ Top du moment pré-caché');
    } catch (e) {
      console.warn('[Perf] ⚠️ _prefetchTop :', e.message);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PRÉCHARGEMENT AGRESSIF : lance tout dès Firebase prêt
  // Les données sont en cache AVANT que accueil.js les demande
  // ─────────────────────────────────────────────────────────────
  function startPrefetch() {
    // Lancer en parallèle, sans bloquer l'UI
    Promise.all([
      window._countByType(),
      window._prefetchTop()
    ]).then(() => {
      console.log('[Perf] ✅ Préchargement terminé — données en cache');
      window.dispatchEvent(new CustomEvent('perfCacheReady'));
    }).catch(e => console.warn('[Perf] Préchargement partiel :', e.message));
  }

  // Déclencher dès que Firebase est disponible
  if (window.db && window.fbGetDocs) {
    startPrefetch();
  } else {
    window.addEventListener('firebaseInitialized', startPrefetch, { once: true });
  }

  // ─────────────────────────────────────────────────────────────
  // PAGINATION & LAZY LOADING établissements
  // ─────────────────────────────────────────────────────────────
  window._loadEtablissementsPaginated = async function (type = null, pageSize = 50) {
    const cacheKey = `etabs_${type || 'all'}`;
    const cached = window._getCachedData(cacheKey);
    if (cached) return cached;

    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Perf] Firebase not ready');
      return [];
    }

    try {
      let q = window.fbCollection(window.db, 'etablissements');
      if (type && window.fbQuery && window.fbWhere) {
        q = window.fbQuery(q, window.fbWhere('type', '==', type));
      }
      if (window.fbQuery && window.fbLimit) {
        q = window.fbQuery(q, window.fbLimit(pageSize));
      }

      const snapshot = await window.fbGetDocs(q);
      const data = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() }));

      window._setCachedData(cacheKey, data);
      console.log(`[Perf] ✅ ${data.length} établissements chargés (${type || 'tous'})`);
      return data;
    } catch (error) {
      console.error('[Perf] ❌ Chargement établissements :', error.message);
      return [];
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LIMITER LES LISTENERS SIMULTANÉS
  // ─────────────────────────────────────────────────────────────
  const MAX_LISTENERS = 15;
  let activeListeners = 0;

  window._subscribeLimited = function (ref, callback) {
    if (activeListeners >= MAX_LISTENERS) {
      console.warn(`⚠️ Max listeners (${MAX_LISTENERS}) atteints`);
      setTimeout(() => window._subscribeLimited(ref, callback), 500);
      return;
    }
    activeListeners++;
    const unsub = window.fbOnSnapshot ? window.fbOnSnapshot(ref, callback) : null;
    if (unsub) {
      return () => { unsub(); activeListeners--; };
    }
  };

  // ─────────────────────────────────────────────────────────────
  // IMAGES : lazy loading
  // ─────────────────────────────────────────────────────────────
  window._getOptimizedImageURL = function (url, maxWidth = 400) {
    if (!url) return '';
    if (url.includes('firebasestorage.googleapis.com')) {
      return `${url}?alt=media&w=${maxWidth}`;
    }
    return url;
  };

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            obs.unobserve(img);
          }
        }
      });
    }, { rootMargin: '50px' });

    window.addEventListener('load', () => {
      document.querySelectorAll('img[data-src]').forEach(img => observer.observe(img));
    });

    window._observeImage = img => {
      if (img && img.dataset.src) observer.observe(img);
    };
  }

  // ─────────────────────────────────────────────────────────────
  // DEBOUNCE / THROTTLE
  // ─────────────────────────────────────────────────────────────
  window._debounce = function (func, wait) {
    let t;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => func(...args), wait);
    };
  };

  window._throttle = function (func, limit) {
    let inThrottle;
    return function (...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  };

  // ─────────────────────────────────────────────────────────────
  // STATS
  // ─────────────────────────────────────────────────────────────
  window._showPerformanceStats = function () {
    const stats = {
      cacheSize: Object.keys(localStorage).filter(k => k.startsWith('ambi_cache_')).length,
      activeListeners,
      cachedKeys: Object.keys(localStorage)
        .filter(k => k.startsWith('ambi_cache_'))
        .map(k => k.replace('ambi_cache_', ''))
    };
    console.table(stats);
    return stats;
  };

  console.log('%c⚡ AMBI241 Performance v3.0 chargé', 'color: #00ffaa; font-weight: bold; font-size: 14px');
  window.PERF_LOADED = true;

})();
