/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — accueil.js  (VERSION CORRIGÉE)
   • Compteurs catégories depuis Firestore (avec cache 5 min)
   • Top du moment (3 derniers établissements actifs)
   • Skeleton loader pendant le chargement
   • Pas de "0" affiché, pas de "Chargement..." bloqué
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // CONFIG : correspondance type Firestore → sélecteur HTML
  // Adapter les clés selon vos vraies valeurs dans Firestore
  // ─────────────────────────────────────────────────────────────
  const CATEGORIES = [
    { type: 'bar',        labels: ['bar','Bar','bars','Bars'] },
    { type: 'hotel',      labels: ['hotel','Hotel','hôtel','Hôtel','hotels','Hotels'] },
    { type: 'snack',      labels: ['snack','Snack','snacks','Snacks','fast-food'] },
    { type: 'restaurant', labels: ['restaurant','Restaurant','restaurants'] },
    { type: 'boite',      labels: ['boite','Boite','boîte','Boîte','nightclub','club'] },
    { type: 'maquis',     labels: ['maquis','Maquis'] },
  ];

  // ─────────────────────────────────────────────────────────────
  // UTILITAIRE : trouver l'élément compteur dans le DOM
  // Cherche [data-counter="bar"], .counter-bar, #count-bar, etc.
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
  // CŒUR : charger les compteurs depuis Firestore
  // ─────────────────────────────────────────────────────────────
  async function loadCompteurs() {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) {
      console.warn('[Accueil] Firebase non prêt pour les compteurs');
      return;
    }

    showSkeletons();

    // ── Essayer le cache d'abord ──────────────────────────────
    const CACHE_KEY = 'compteurs_accueil';
    if (window._getCachedData) {
      const cached = window._getCachedData(CACHE_KEY);
      if (cached) {
        console.log('[Accueil] ✅ Compteurs depuis cache');
        applyCompteurs(cached);
        return;
      }
    }

    // ── Requête Firestore unique (toute la collection) ────────
    try {
      console.log('[Accueil] ⏳ Chargement compteurs établissements...');
      const snap = await window.fbGetDocs(
        window.fbCollection(window.db, 'etablissements')
      );

      // Compter par type
      const counts = {};
      snap.forEach(doc => {
        const t = (doc.data().type || '').toLowerCase().trim();
        counts[t] = (counts[t] || 0) + 1;
      });

      console.log('[Accueil] 📊 Résultats Firestore :', counts);

      // Construire l'objet résultat par catégorie UI
      const result = {};
      CATEGORIES.forEach(({ type, labels }) => {
        let total = 0;
        labels.forEach(lbl => { total += counts[lbl.toLowerCase()] || 0; });
        result[type] = total;
      });

      // Mettre en cache 5 min
      if (window._setCachedData) {
        window._setCachedData(CACHE_KEY, result);
      }

      applyCompteurs(result);
    } catch (err) {
      console.error('[Accueil] ❌ Erreur compteurs :', err.message);
      // En cas d'erreur, remettre 0 proprement
      CATEGORIES.forEach(({ type }) => {
        const el = findCounterEl(type);
        if (el) { el.textContent = '0'; el.style.opacity = '1'; }
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // APPLIQUER les chiffres dans le DOM avec animation
  // ─────────────────────────────────────────────────────────────
  function applyCompteurs(result) {
    CATEGORIES.forEach(({ type }) => {
      const el = findCounterEl(type);
      if (!el) return;
      const val = result[type] || 0;
      animateCount(el, val);
    });
    console.log('[Accueil] ✅ Compteurs affichés');
  }

  function animateCount(el, target) {
    el.style.opacity = '1';
    if (target === 0) { el.textContent = '0'; return; }
    let current = 0;
    const step = Math.max(1, Math.floor(target / 20));
    const interval = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(interval);
    }, 40);
  }

  // ─────────────────────────────────────────────────────────────
  // TOP DU MOMENT : 3 derniers établissements actifs
  // ─────────────────────────────────────────────────────────────
  async function loadTopDuMoment() {
    if (!window.db || !window.fbGetDocs || !window.fbQuery ||
        !window.fbCollection || !window.fbOrderBy || !window.fbLimit) {
      console.warn('[Accueil] Firebase query helpers non disponibles pour Top');
      return;
    }

    const container = document.querySelector(
      '#top-du-moment, .top-du-moment, [data-section="top"]'
    );
    if (!container) return;

    // Skeleton texte
    container.innerHTML = '<p style="opacity:0.4;text-align:center">Chargement...</p>';

    const CACHE_KEY = 'top_du_moment';
    if (window._getCachedData) {
      const cached = window._getCachedData(CACHE_KEY);
      if (cached) { renderTop(container, cached); return; }
    }

    try {
      const q = window.fbQuery(
        window.fbCollection(window.db, 'etablissements'),
        window.fbOrderBy('createdAt', 'desc'),
        window.fbLimit(3)
      );
      const snap = await window.fbGetDocs(q);
      const items = [];
      snap.forEach(doc => items.push({ id: doc.id, ...doc.data() }));

      if (window._setCachedData) window._setCachedData(CACHE_KEY, items);
      renderTop(container, items);
    } catch (err) {
      console.warn('[Accueil] Top du moment :', err.message);
      container.innerHTML = '<p style="opacity:0.5;text-align:center">Aucun résultat</p>';
    }
  }

  function renderTop(container, items) {
    if (!items || items.length === 0) {
      container.innerHTML = '<p style="opacity:0.5;text-align:center">Aucun établissement</p>';
      return;
    }
    container.innerHTML = items.map(item => `
      <div class="top-card" data-id="${item.id}" style="cursor:pointer">
        <img src="${item.photo || item.image || item.imageUrl || ''}"
             alt="${item.nom || item.name || ''}"
             loading="lazy"
             style="width:100%;height:140px;object-fit:cover;border-radius:8px;"
             onerror="this.style.display='none'">
        <p style="margin:6px 0 2px;font-weight:600">${item.nom || item.name || 'Sans nom'}</p>
        <small style="opacity:0.6">${item.type || ''} ${item.ville || item.quartier || ''}</small>
      </div>
    `).join('');
    console.log('[Accueil] ✅ Top du moment affiché');
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
    console.log('[AMBI241] ✅ Module Accueil initialisé');
    animateHero();

    // Si Firebase est déjà prêt → charger immédiatement
    if (window.db && window.fbGetDocs) {
      await Promise.all([loadCompteurs(), loadTopDuMoment()]);
    } else {
      // Sinon attendre le signal firebaseInitialized
      window.addEventListener('firebaseInitialized', async () => {
        await Promise.all([loadCompteurs(), loadTopDuMoment()]);
      }, { once: true });

      // Fallback : si ambi241Ready arrive aussi
      window.addEventListener('ambi241Ready', async () => {
        if (!window._accueilLoaded) {
          window._accueilLoaded = true;
          await Promise.all([loadCompteurs(), loadTopDuMoment()]);
        }
      }, { once: true });
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

  console.log('[AMBI241] ✅ Module Accueil chargé');
})();
