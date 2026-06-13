/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — performance-optimize.js  (VERSION CORRIGÉE)
   • Cache localStorage 5 min (inchangé, fonctionnait déjà)
   • NOUVEAU : _countByType() — requête compteur ultra-rapide
   • NOUVEAU : préchargement compteurs dès que Firebase est prêt
   • Lazy loading images, débounce, throttle (inchangés)
═══════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // ─────────────────────────────────────────────────────────────
  // CACHE LOCAL
  // ─────────────────────────────────────────────────────────────
  window._getCachedData = function (key) {
    const raw = localStorage.getItem(`ambi_cache_${key}`);
    if (!raw) return null;
    try {
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
      console.warn(`⚠️ Cache write error: ${e.message}`);
    }
  };

  window._clearCache = function () {
    Object.keys(localStorage)
      .filter(k => k.startsWith('ambi_cache_'))
      .forEach(k => localStorage.removeItem(k));
    console.log('🗑️ Cache vidé');
  };

  // ─────────────────────────────────────────────────────────────
  // NOUVEAU : COMPTEUR RAPIDE PAR TYPE
  // Utilise une seule requête pour tout compter d'un coup
  // ─────────────────────────────────────────────────────────────
  window._countByType = async function () {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Perf] Firebase non dispo pour _countByType');
      return {};
    }

    const CACHE_KEY = 'count_by_type';
    const cached = window._getCachedData(CACHE_KEY);
    if (cached) return cached;

    try {
      const snap = await window.fbGetDocs(
        window.fbCollection(window.db, 'etablissements')
      );
      const counts = {};
      snap.forEach(doc => {
        const t = (doc.data().type || 'autre').toLowerCase().trim();
        counts[t] = (counts[t] || 0) + 1;
      });
      window._setCachedData(CACHE_KEY, counts);
      console.log('[Perf] ✅ _countByType :', counts);
      return counts;
    } catch (e) {
      console.error('[Perf] ❌ _countByType :', e.message);
      return {};
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PRÉCHARGEMENT : lancer _countByType dès Firebase prêt
  // Les données seront déjà en cache quand accueil.js en a besoin
  // ─────────────────────────────────────────────────────────────
  function prefetchCounts() {
    if (window.db && window.fbGetDocs) {
      window._countByType(); // fire & forget — met en cache
    } else {
      window.addEventListener('firebaseInitialized', () => {
        window._countByType();
      }, { once: true });
    }
  }
  prefetchCounts();

  // ─────────────────────────────────────────────────────────────
  // PAGINATION & LAZY LOADING établissements
  // ─────────────────────────────────────────────────────────────
  window._loadEtablissementsPaginated = async function (type = null, pageSize = 50) {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Perf] Firebase not ready');
      return [];
    }

    const cacheKey = `etabs_${type || 'all'}`;
    const cached = window._getCachedData(cacheKey);
    if (cached) return cached;

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
      console.log(`[Perf] ✅ ${data.length} établissements chargés`);
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
  // IMAGES : optimisation URL + lazy loading
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

  console.log('%c⚡ AMBI241 Performance Module Loaded', 'color: #00ffaa; font-weight: bold; font-size: 14px');
  window.PERF_LOADED = true;

})();
