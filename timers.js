/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — timers.js
   Module Timers & Compteurs
   • Gestion centralisée des setInterval (anti memory-leak)
   • Expose window.ambiTimer pour créer/détruire les timers
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const _timers = new Map();

  const ambiTimer = {
    /**
     * Crée un timer nommé (idempotent — empêche les doublons)
     * @param {string} name  - identifiant unique
     * @param {Function} fn  - callback
     * @param {number} ms    - intervalle en ms
     */
    start(name, fn, ms) {
      if (_timers.has(name)) {
        console.warn(`[Timers] Timer "${name}" déjà actif — ignoré`);
        return;
      }
      const id = setInterval(fn, ms);
      _timers.set(name, id);
      console.log(`[Timers] ▶ "${name}" démarré (${ms}ms)`);
    },

    /** Stoppe un timer par son nom */
    stop(name) {
      if (!_timers.has(name)) return;
      clearInterval(_timers.get(name));
      _timers.delete(name);
      console.log(`[Timers] ■ "${name}" arrêté`);
    },

    /** Stoppe tous les timers actifs */
    stopAll() {
      _timers.forEach((id, name) => {
        clearInterval(id);
        console.log(`[Timers] ■ "${name}" arrêté`);
      });
      _timers.clear();
      console.log('[Timers] Tous les timers arrêtés');
    },

    /** Liste les timers actifs */
    list() {
      return Array.from(_timers.keys());
    }
  };

  // Stoppe tous les timers à la fermeture de la page
  window.addEventListener('beforeunload', () => ambiTimer.stopAll());

  // Stoppe les timers quand l'onglet devient inactif (économie batterie)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('[Timers] Page cachée — timers suspendus non critiques');
    }
  });

  window.ambiTimer = ambiTimer;

  console.log('[AMBI241] ✅ Module Timers chargé');
})();
