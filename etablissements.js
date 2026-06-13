/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — etablissements.js
   Module Lieux / Bars / Restaurants
   • Chargement paginé depuis Firestore
   • Utilise le cache de performance-optimize.js
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let _etabInited = false;

  async function initEtablissements() {
    if (_etabInited) return;
    _etabInited = true;

    console.log('[AMBI241] ✅ Module Établissements initialisé');

    // Lazy-charge uniquement quand la section est visible
    const section = document.querySelector('#etablissements, [data-section="etablissements"], .lieux-section');
    if (!section) return;

    // Utilise le helper paginé de performance-optimize.js si disponible
    if (typeof window._loadEtablissementsPaginated === 'function') {
      try {
        const lieux = await window._loadEtablissementsPaginated(null, 50);
        console.log(`[Etablissements] ${lieux.length} lieux chargés`);
      } catch (err) {
        console.warn('[Etablissements] Erreur chargement :', err);
      }
    }
  }

  window.initEtablissements = initEtablissements;

  window.addEventListener('ambi241Ready', initEtablissements);

  console.log('[AMBI241] ✅ Module Établissements chargé');
})();
