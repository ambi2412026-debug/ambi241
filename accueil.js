/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — accueil.js
   Module Page d'Accueil
   • Hero / landing
   • Expose window.initAccueil()
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function initAccueil() {
    // La logique accueil est dans index.html.
    // Ce fichier sert de point d'extension / hook.
    console.log('[AMBI241] ✅ Module Accueil initialisé');

    // Exemple : animer le hero au premier chargement
    const hero = document.querySelector('.hero, #accueil, [data-section="accueil"]');
    if (hero) {
      hero.style.opacity = '0';
      requestAnimationFrame(() => {
        hero.style.transition = 'opacity 0.6s ease';
        hero.style.opacity    = '1';
      });
    }
  }

  // Expose pour core-app.js
  window.initAccueil = initAccueil;

  // Auto-init si DOM déjà prêt
  if (document.readyState !== 'loading') {
    initAccueil();
  } else {
    document.addEventListener('DOMContentLoaded', initAccueil);
  }

  console.log('[AMBI241] ✅ Module Accueil chargé');
})();
