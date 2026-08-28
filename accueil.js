/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — accueil.js  (v3.0 — OPTIMISÉ)
   ✅ Utilise _countByType() de performance-optimize (cache partagé)
   ✅ Plus de double requête Firestore
   ✅ Top du moment avec fallback si fbOrderBy/fbLimit absents
   ✅ Affichage immédiat depuis cache au 2ème chargement
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CONFIG : correspondance type Firestore → sélecteur HTML
  // ─────────────────────────────────────────────────────────────
  const CATEGORIES = [
    { type: 'bar',        labels: ['bar','bars'] },
    { type: 'snack',      labels: ['snack','snacks','fast-food','fastfood'] },
    { type: 'restaurant', labels: ['restaurant','restaurants','resto','restos','pâtisserie','patisserie'] },
    { type: 'boite',      labels: ['boite','boîte','nightclub','club','discothèque','discotheque'] },
    { type: 'maquis',     labels: ['maquis'] },
    { type: 'terrasse',   labels: ['terrasse','bar terrasse','bar terrasses'] },
  ];

  // ─────────────────────────────────────────────────────────────
  // UTILITAIRE : trouver l'élément compteur dans le DOM
  // ─────────────────────────────────────────────────────────────
  function findCounterEl(type) {
    return (
      document.querySelector(`[data-counter="${type}"]`) ||
      document.querySelector(`[data-type="${type}"] .count`) ||
      document.querySelector(`[data-type="${type}"] .counter`) ||
      document.querySelector(`.counter-${type}`) ||
      document.querySelector(`#count-${type}`) ||
      document.querySelector(`#counter-${type}`)
    );
  }

  // ─────────────────────────────────────────────────────────────
  // SKELETON : afficher "—" pendant le chargement
  // ─────────────────────────────────────────────────────────────
  function showSkeletons() {
    CATEGORIES.forEach(({ type }) => {
      const el = findCounterEl(type);
      if (el && (el.textContent.trim() === '0' || el.textContent.trim() === '')) {
        el.textContent = '—';
        el.style.opacity = '0.4';
      }
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ANIMATION COMPTEUR
  // ─────────────────────────────────────────────────────────────
  function animateCount(el, target) {
    el.style.opacity = '1';
    if (target === 0) { el.textContent = '0'; return; }
    let current = 0;
    const step = Math.max(1, Math.floor(target / 20));
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 40);
  }

  // ─────────────────────────────────────────────────────────────
  // APPLIQUER les chiffres dans le DOM
  // rawCounts = { bar: 3, snack: 2, ... } (clés brutes Firestore)
  // ─────────────────────────────────────────────────────────────
  function applyCompteurs(rawCounts) {
    CATEGORIES.forEach(({ type, labels }) => {
      const el = findCounterEl(type);
      if (!el) return;
      // Additionner tous les labels qui correspondent à ce type
      let total = 0;
      labels.forEach(lbl => { total += rawCounts[lbl] || 0; });
      animateCount(el, total);
    });
    console.log('[Accueil] ✅ Compteurs affichés');
  }

  // ─────────────────────────────────────────────────────────────
  // CHARGER LES COMPTEURS
  // Priorité : cache partagé (_countByType) → requête Firestore
  // ─────────────────────────────────────────────────────────────
  async function loadCompteurs() {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Accueil] Firebase non prêt pour les compteurs');
      return;
    }

    showSkeletons();

    // ✅ Utiliser _countByType() de performance-optimize.js
    // Cette fonction gère elle-même son propre cache localStorage
    if (window._countByType) {
      try {
        const counts = await window._countByType();
        applyCompteurs(counts);
        return;
      } catch (e) {
        console.warn('[Accueil] _countByType échoué, fallback direct', e.message);
      }
    }

    // Fallback : requête directe si performance-optimize pas chargé
    try {
      console.log('[Accueil] ⏳ Fallback requête directe compteurs...');
      const snap = await window.fbGetDocs(
        window.fbCollection(window.db, 'etablissements')
      );
      const counts = {};
      snap.forEach(doc => {
        const t = (doc.data().type || '').toLowerCase().trim();
        if (t) counts[t] = (counts[t] || 0) + 1;
      });
      applyCompteurs(counts);
    } catch (err) {
      console.error('[Accueil] ❌ Erreur compteurs :', err.message);
      CATEGORIES.forEach(({ type }) => {
        const el = findCounterEl(type);
        if (el) { el.textContent = '0'; el.style.opacity = '1'; }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // TOP DU MOMENT
  // Robuste : fonctionne avec ou sans fbOrderBy/fbLimit
  // ─────────────────────────────────────────────────────────────
  async function loadTopDuMoment() {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Accueil] Firebase non prêt pour Top du moment');
      return;
    }

    const container = document.querySelector(
      '#top-du-moment, .top-du-moment, [data-section="top"]'
    );
    if (!container) {
      console.warn('[Accueil] Conteneur Top du moment introuvable');
      return;
    }

    // Skeleton
    container.innerHTML = '<p style="opacity:0.4;text-align:center;padding:12px">⏳ Chargement...</p>';

    // Cache
    const CACHE_KEY = 'top_du_moment';
    if (window._getCachedData) {
      const cached = window._getCachedData(CACHE_KEY);
      if (cached) {
        renderTop(container, cached);
        return;
      }
    }

    try {
      let snap;

      // Essayer avec fbQuery + fbOrderBy + fbLimit si disponibles
      if (window.fbQuery && window.fbOrderBy && window.fbLimit) {
        const q = window.fbQuery(
          window.fbCollection(window.db, 'etablissements'),
          window.fbOrderBy('createdAt', 'desc'),
          window.fbLimit(6)
        );
        snap = await window.fbGetDocs(q);
      } else {
        // ✅ Fallback robuste : charger sans tri et trier en JS
        console.warn('[Accueil] fbOrderBy/fbLimit absents — fallback JS sort');
        snap = await window.fbGetDocs(
          window.fbCollection(window.db, 'etablissements')
        );
      }

      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

      // Trier par createdAt en JS si pas fait par Firestore
      items.sort((a, b) => {
        const ta = a.createdAt?.seconds || a.createdAt || 0;
        const tb = b.createdAt?.seconds || b.createdAt || 0;
        return tb - ta;
      });

      const top6 = items.slice(0, 6);

      if (window._setCachedData) window._setCachedData(CACHE_KEY, top6);
      renderTop(container, top6);

    } catch (err) {
      console.warn('[Accueil] ❌ Top du moment :', err.message);
      container.innerHTML = '<p style="opacity:0.5;text-align:center;padding:12px">Aucun résultat disponible</p>';
    }
  }

  function renderTop(container, items) {
    if (!items || items.length === 0) {
      container.innerHTML = '<p style="opacity:0.5;text-align:center;padding:12px">Aucun établissement</p>';
      return;
    }
    container.innerHTML = items.map((item, i) => `
      <div class="top-card" data-id="${item.id}" style="cursor:pointer" onclick="if(window.ouvrirEtablissement)window.ouvrirEtablissement('${item.id}')">
        <img src="${item.photo || item.image || item.imageUrl || item.photoURL || ''}"
             alt="${item.nom || item.name || ''}"
             loading="lazy"
             style="width:100%;height:140px;object-fit:cover;border-radius:8px;"
             onerror="this.style.display=&apos;none&apos;">
        <p style="margin:6px 0 2px;font-weight:600">${item.nom || item.name || 'Sans nom'}</p>
        <small style="opacity:0.6">${item.type || ''} — ${item.quartier || item.ville || ''}</small>
      </div>
    `).join('');
    console.log(`[Accueil] ✅ Top du moment : ${items.length} établissements affichés`);
  }

  // ─────────────────────────────────────────────────────────────
  // ANIMATION HERO
  // ─────────────────────────────────────────────────────────────
  function animateHero() {
    const hero = document.querySelector('.hero, #accueil, [data-section="accueil"]');
    if (hero) {
      hero.style.opacity = '0';
      requestAnimationFrame(() => {
        hero.style.transition = 'opacity 0.5s ease';
        hero.style.opacity = '1';
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // INIT PRINCIPALE
  // ─────────────────────────────────────────────────────────────
  async function initAccueil() {
    console.log('[AMBI241] 🏠 Module Accueil initialisé');
    animateHero();

    const firebaseReady = window.db && window.fbGetDocs;

    if (firebaseReady) {
      // Firebase déjà prêt → charger en parallèle immédiatement
      Promise.all([loadCompteurs(), loadTopDuMoment()]);
    } else {
      // Attendre firebaseInitialized (émis par firebase-config.js)
      let loaded = false;

      const doLoad = () => {
        if (loaded) return;
        loaded = true;
        Promise.all([loadCompteurs(), loadTopDuMoment()]);
      };

      window.addEventListener('firebaseInitialized', doLoad, { once: true });
      window.addEventListener('ambi241Ready', doLoad, { once: true });

      // Fallback ultime : si Firebase prend > 8s, afficher un message
      setTimeout(() => {
        if (!loaded) {
          console.error('[Accueil] ⚠️ Firebase trop lent (>8s) — abandon compteurs');
          CATEGORIES.forEach(({ type }) => {
            const el = findCounterEl(type);
            if (el) { el.textContent = '?'; el.style.opacity = '0.5'; }
          });
          const container = document.querySelector('#top-du-moment, .top-du-moment, [data-section="top"]');
          if (container) container.innerHTML = '<p style="opacity:0.5;text-align:center;padding:12px">Connexion lente — réessayez</p>';
        }
      }, 8000);
    }
  }

  // Expose pour core-app.js
  window.initAccueil = initAccueil;

  // Auto-init
  if (document.readyState !== 'loading') {
    initAccueil();
  } else {
    document.addEventListener('DOMContentLoaded', initAccueil);
  }

  console.log('[AMBI241] ✅ Module Accueil chargé (v3.0)');
})();
