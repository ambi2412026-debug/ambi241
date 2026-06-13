/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — etablissements.js
   Module Lieux / Bars / Restaurants
   • Chargement COMPLET depuis Firestore (tous les documents)
   • Fix : pas de orderBy("id") → n'exclut plus les docs sans champ id
   • Fix : dédoublonnage par _docId, inclut les docs sans id numérique
   • Expose loadData() globalement (complète core-app.js)
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Cache localStorage ─────────────────────────────────────── */
  var _CACHE_KEY = 'ambi241_etab_cache_v4';
  var _CACHE_TTL = 30 * 1000; // 30 secondes

  function _saveCache(data) {
    try {
      localStorage.setItem(_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
    } catch(e) { /* storage plein — pas critique */ }
  }

  function _loadCache() {
    try {
      var raw = localStorage.getItem(_CACHE_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (!obj || !obj.data || (Date.now() - obj.ts) > _CACHE_TTL) return null;
      return obj.data;
    } catch(e) { return null; }
  }

  /* ── Dédoublonnage ──────────────────────────────────────────── */
  /* FIX : on ne filtre plus sur !e.id — les docs sans champ "id"
     numérique sont gardés, identifiés par leur _docId Firestore.   */
  function _deduplicate(firebaseData) {
    var seen = {};
    return firebaseData.filter(function(e) {
      var key = e.id ? String(e.id) : (e._docId || null);
      if (!key) return true;          // aucune clé → inclure quand même
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  /* ── Rendu après chargement ─────────────────────────────────── */
  function _renderAfterLoad() {
    if (typeof window.rebuildPaiements  === 'function') window.rebuildPaiements();
    if (typeof window.applyDynamicStatus === 'function' && window.etablissements) {
      window.etablissements.forEach(function(e) { window.applyDynamicStatus(e); });
    }
    if (typeof window.setSyncing        === 'function') window.setSyncing(false);
    if (typeof window.invalidateScoreCache === 'function') window.invalidateScoreCache();
    if (typeof window.renderAll         === 'function') window.renderAll();
    if (typeof window.renderHome        === 'function') window.renderHome();
    if (typeof window.renderStats       === 'function') window.renderStats();
    if (typeof window.renderPayments    === 'function') window.renderPayments();
    if (typeof window.updateSyncTime    === 'function') window.updateSyncTime();
    if (typeof window._subscribeAllEtabs === 'function') {
      setTimeout(window._subscribeAllEtabs, 500);
    }
    console.log('[AMBI241] ✅ ' + (window.etablissements ? window.etablissements.length : 0) + ' établissements chargés');
  }

  /* ── loadData principale ─────────────────────────────────────── */
  /* FIX CLEF : on utilise fbCollection() sans fbOrderBy("id")
     Un orderBy sur un champ Firestore exclut silencieusement tous
     les documents qui ne possèdent pas ce champ → perte de lieux.  */
  function loadData() {
    /* Guard : Firebase pas encore prêt → réessayer dans 300ms */
    if (typeof window.fbCollection !== 'function' ||
        typeof window.fbGetDocs    !== 'function' ||
        !window.db) {
      setTimeout(loadData, 300);
      return;
    }

    /* Si déjà défini dans core-app.js, ne pas écraser */
    if (window._etabLoadDataOwner === 'core-app') {
      return;
    }

    /* ÉTAPE 1 : afficher le cache immédiatement (UX instantanée) */
    var _isPWA = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
                || window.navigator.standalone === true;
    var cached = _isPWA ? null : _loadCache();
    if (cached && cached.length > 0) {
      window.etablissements = cached;
      if (typeof window.applyDynamicStatus === 'function') {
        window.etablissements.forEach(function(e) { window.applyDynamicStatus(e); });
      }
      if (typeof window.rebuildPaiements === 'function') window.rebuildPaiements();
      if (typeof window.renderAll  === 'function') window.renderAll();
      if (typeof window.renderHome === 'function') window.renderHome();
    }

    /* ÉTAPE 2 : requête Firestore SANS orderBy → tous les documents */
    if (typeof window.setSyncing === 'function') window.setSyncing(true);

    var colEtab = window.fbCollection(window.db, 'etablissements');
    var colPaie = window.fbCollection(window.db, 'paiements');

    var pEtab = window.fbGetDocs(colEtab);
    var pPaie = (typeof window.fbGetDocs === 'function' && colPaie)
                ? window.fbGetDocs(colPaie).catch(function(){ return { forEach: function(){} }; })
                : Promise.resolve({ forEach: function(){} });

    Promise.all([pEtab, pPaie]).then(function(results) {
      var snapEtab = results[0];
      var snapPaie = results[1];

      /* ── Établissements ── */
      var raw = [];
      snapEtab.forEach(function(d) {
        raw.push(Object.assign({ _docId: d.id }, d.data()));
      });

      if (raw.length > 0) {
        raw = _deduplicate(raw);
        window.etablissements = raw;
        _saveCache(raw);
      } else if (!window.etablissements || !window.etablissements.length) {
        if (typeof window.getDefaults === 'function') {
          window.etablissements = window.getDefaults();
        }
      }

      /* ── Paiements Firebase ── */
      if (typeof window._paiementsFirebase !== 'undefined') {
        window._paiementsFirebase = [];
        snapPaie.forEach(function(d) {
          window._paiementsFirebase.push(Object.assign({ _docId: d.id }, d.data()));
        });
      }

      _renderAfterLoad();

      /* ── Photos en arrière-plan ── */
      setTimeout(function() {
        if (typeof window.loadAllPhotoProfiles === 'function') window.loadAllPhotoProfiles();
      }, 2500);
      setTimeout(function() {
        if (typeof window.loadSlotPhotosAsync === 'function' &&
            typeof window.estPaiementConfirme === 'function' &&
            window.etablissements && window.etablissements.length) {
          var actifs = window.etablissements.filter(function(e) {
            return window.estPaiementConfirme(e);
          });
          actifs.slice(0, 10).forEach(function(e, i) {
            setTimeout(function() {
              if (e.id) window.loadSlotPhotosAsync(e.id);
            }, i * 200);
          });
        }
      }, 3500);

    }).catch(function(err) {
      console.error('[AMBI241] loadData Firestore error:', err);
      if (!window.etablissements || !window.etablissements.length) {
        if (typeof window.getDefaults === 'function') {
          window.etablissements = window.getDefaults();
        }
      }
      _renderAfterLoad();
    });
  }

  /* ── Exposer globalement ─────────────────────────────────────── */
  /* Seulement si core-app.js n'a pas déjà défini sa propre loadData */
  if (typeof window.loadData !== 'function') {
    window.loadData = loadData;
    window._etabLoadDataOwner = 'etablissements.js';
  } else {
    /* core-app.js a sa propre loadData — signaler pour ne pas interférer */
    window._etabLoadDataOwner = 'core-app';
    console.warn('[AMBI241] loadData déjà définie par core-app.js — vérifier le fix orderBy("id") dans core-app.js');
  }

  /* ── Init lazy ───────────────────────────────────────────────── */
  var _etabInited = false;

  function initEtablissements() {
    if (_etabInited) return;
    _etabInited = true;
    console.log('[AMBI241] ✅ Module Établissements initialisé');

    /* Si Firebase est déjà prêt, charger immédiatement */
    if (window.__firebaseReady && window.db) {
      loadData();
    }
    /* Sinon loadData sera appelé par core-app.js via window.__appReady */
  }

  window.initEtablissements = initEtablissements;

  /* Déclencher à l'event ambi241Ready si disponible */
  window.addEventListener('ambi241Ready', initEtablissements);

  /* Fallback DOMContentLoaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(initEtablissements, 600);
    });
  } else {
    setTimeout(initEtablissements, 600);
  }

  console.log('[AMBI241] ✅ Module Établissements chargé (fix orderBy + dédoublonnage complet)');
})();
