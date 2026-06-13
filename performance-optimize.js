/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — Optimisation Firestore & Performance
   • Lazy loading des établissements
   • Pagination intelligente
   • Cache local (localStorage)
   • Limitation des listeners simultanés
═══════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CACHE LOCAL (5 minutes)
  // ─────────────────────────────────────────────────────────────
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  window._getCachedData = function(key) {
    const cached = localStorage.getItem(`ambi_cache_${key}`);
    if (!cached) return null;
    
    try {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp > CACHE_TTL) {
        localStorage.removeItem(`ambi_cache_${key}`);
        return null;
      }
      console.log(`✅ Cache HIT: ${key}`);
      return data;
    } catch (err) {
      localStorage.removeItem(`ambi_cache_${key}`);
      return null;
    }
  };

  window._setCachedData = function(key, data) {
    try {
      localStorage.setItem(`ambi_cache_${key}`, JSON.stringify({
        data: data,
        timestamp: Date.now()
      }));
      console.log(`💾 Cache SET: ${key}`);
    } catch (err) {
      console.warn(`⚠️ Cache write error: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────────────────────
  // PAGINATION & LAZY LOADING
  // ─────────────────────────────────────────────────────────────
  window._loadEtablissementsPaginated = async function(type = null, pageSize = 50) {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('Firebase not ready');
      return [];
    }

    // Essayer le cache d'abord
    const cacheKey = `etabs_${type || 'all'}`;
    const cached = window._getCachedData(cacheKey);
    if (cached) return cached;

    try {
      console.log(`⏳ Chargement ${type || 'tous'} établissements (limite: ${pageSize})...`);
      
      let q = window.fbCollection(window.db, 'etablissements');
      
      if (type) {
        q = window.fbQuery(q, window.fbWhere('type', '==', type));
      }

      // IMPORTANT: Limiter les résultats
      q = window.fbQuery(q, window.fbLimit(pageSize));

      const snapshot = await window.fbGetDocs(q);
      const data = [];

      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() });
      });

      console.log(`✅ ${data.length} établissements chargés`);
      
      // Mettre en cache
      window._setCachedData(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error('❌ Erreur chargement établissements:', error.message);
      return [];
    }
  };

  // ─────────────────────────────────────────────────────────────
  // LIMITER LES LISTENERS SIMULTANÉS
  // ─────────────────────────────────────────────────────────────
  const MAX_LISTENERS = 15; // Au lieu de 100+
  let activeListeners = 0;

  window._subscribeLimited = function(ref, callback) {
    if (activeListeners >= MAX_LISTENERS) {
      console.warn(`⚠️ Max listeners (${MAX_LISTENERS}) atteints. En attente...`);
      // Attendre 500ms et réessayer
      setTimeout(() => window._subscribeLimited(ref, callback), 500);
      return;
    }

    activeListeners++;
    console.log(`📡 Listener ${activeListeners}/${MAX_LISTENERS}`);

    const unsubscribe = window.fbOnSnapshot ? 
      window.fbOnSnapshot(ref, callback) : 
      null;

    if (unsubscribe) {
      return () => {
        unsubscribe();
        activeListeners--;
        console.log(`📡 Listener fermé. ${activeListeners}/${MAX_LISTENERS} restants`);
      };
    }
  };

  // ─────────────────────────────────────────────────────────════════
  // COMPRESSION D'IMAGES
  // ═════════════════════════════════════════════════════════════════
  window._getOptimizedImageURL = function(url, maxWidth = 400) {
    if (!url) return '';
    
    // Si c'est une URL Firebase Storage
    if (url.includes('firebasestorage.googleapis.com')) {
      // Ajouter les paramètres de redimensionnement Firebase
      return `${url}?alt=media&w=${maxWidth}`;
    }
    
    return url;
  };

  // ─────────────────────────────────────────────────────════════
  // PATCH: Intersection Observer pour images lazy loading
  // ═════════════════════════════════════════════════════════════
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
            observer.unobserve(img);
          }
        }
      });
    }, {
      rootMargin: '50px'
    });

    // Observer toutes les images avec data-src
    window.addEventListener('load', () => {
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    });

    window._observeImage = function(img) {
      if (img && img.dataset.src) {
        imageObserver.observe(img);
      }
    };
  }

  // ─────────────────────────────────────────────────────────────
  // DÉBOUNCE: Éviter trop de requêtes
  // ─────────────────────────────────────────────────────────────
  window._debounce = function(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // ─────────────────────────────────────────────────────────────
  // THROTTLE: Limiter les mises à jour de scroll
  // ─────────────────────────────────────────────────────────────
  window._throttle = function(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };

  // ─────────────────────────────────────────────────────────────
  // STATS DE PERFORMANCE
  // ─────────────────────────────────────────────────────────────
  window._showPerformanceStats = function() {
    const stats = {
      cacheSize: Object.keys(localStorage)
        .filter(k => k.startsWith('ambi_cache_')).length,
      activeListeners: activeListeners,
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
