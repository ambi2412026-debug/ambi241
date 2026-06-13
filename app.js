/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — app-1.js
   Orchestrateur Principal v2.0
   • Chargé après firebase-config.js
   • Initialise tous les modules dans le bon ordre
   • Gère la navigation et l'auth globale
═══════════════════════════════════════════════════════════════════ */

(async function bootstrapAMBI241() {
  'use strict';

  console.log('%c🚀 AMBI241 v2.0 — Démarrage', 'color:#ff2d9b;font-weight:bold;font-size:14px');

  // ── 1. Attendre Firebase ──────────────────────────────────────
  await new Promise((resolve, reject) => {
    if (window.firebaseReady && window.db && window.auth) {
      return resolve();
    }
    const t = setTimeout(() => reject(new Error('Firebase timeout (10s)')), 10000);
    window.addEventListener('firebaseInitialized', () => { clearTimeout(t); resolve(); }, { once: true });
  });

  console.log('%c✅ Firebase prêt', 'color:#00ffaa');

  // ── 2. Démarrer core-app.js si non déjà chargé ───────────────
  // (core-app.js est chargé via <script> dans index.html — pas besoin de l'importer)

  // ── 3. Signal global ─────────────────────────────────────────
  window.AMBI241_READY = true;
  window.dispatchEvent(new CustomEvent('ambi241Ready'));

  console.log('%c🎉 AMBI241 prêt !', 'color:#00e5ff;font-weight:bold;font-size:14px');

})().catch(err => {
  console.error('[AMBI241] ❌ Erreur bootstrap :', err);
});
