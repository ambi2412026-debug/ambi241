/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — core-app.js  (VERSION CORRIGÉE)
   • Chargement PARALLÈLE des modules (au lieu de série)
   • Firebase attendu max 8s (au lieu de 10s)
   • Performance-optimize chargé EN PREMIER avant tout
   • Accueil chargé en priorité AVANT les autres modules
═══════════════════════════════════════════════════════════════════ */

(async function initAMBI241() {
  'use strict';

  console.log('%c🔥 AMBI241 Initialisation', 'color: #ff2d9b; font-weight: bold; font-size: 14px');

  // ─────────────────────────────────────────────────────────────
  // 1. ATTENDRE FIREBASE (max 8 secondes)
  // ─────────────────────────────────────────────────────────────
  if (!window.firebaseReady || !window.db || !window.auth) {
    console.log('%c⏳ En attente de Firebase...', 'color: #00e5ff');

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Firebase non initialisé dans les 8 secondes'));
      }, 8000);

      if (window.db && window.auth) {
        clearTimeout(timer);
        resolve();
        return;
      }

      window.addEventListener('firebaseInitialized', () => {
        clearTimeout(timer);
        resolve();
      }, { once: true });
    });
  }

  if (!window.db || !window.auth) {
    throw new Error('❌ Firebase globals non disponibles. Vérifiez firebase-config.js');
  }

  console.log('%c✅ Firebase prêt', 'color: #00ffaa');

  // ─────────────────────────────────────────────────────────────
  // 2. CHARGER PERFORMANCE-OPTIMIZE EN PREMIER (cache, helpers)
  // ─────────────────────────────────────────────────────────────
  try {
    await import('./performance-optimize.js');
    console.log('%c⚡ Performance module OK', 'color: #00ffaa');
  } catch (e) {
    console.warn('⚠️ Performance module optionnel :', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 3. CHARGER ACCUEIL EN PRIORITÉ (compteurs visibles dès l'ouverture)
  // ─────────────────────────────────────────────────────────────
  try {
    await import('./accueil.js');
    console.log('%c✅ Accueil chargé (prioritaire)', 'color: #00ffaa');
  } catch (e) {
    console.warn('⚠️ Accueil :', e.message);
  }

  // ─────────────────────────────────────────────────────────────
  // 4. CHARGER LES AUTRES MODULES EN PARALLÈLE
  //    (plus rapide qu'en série : tous lancés en même temps)
  // ─────────────────────────────────────────────────────────────
  console.log('%c📦 Chargement modules en parallèle...', 'color: #ffd700');

  const modules = [
    { name: 'Lieux',          path: './etablissements.js' },
    { name: 'Profil',         path: './profil.js' },
    { name: 'Forum',          path: './forum.js' },
    { name: 'Social',         path: './social.js' },
    { name: 'Paiements',      path: './paiements.js' },
    { name: 'Notifications',  path: './notifications.js' },
    { name: 'Timers',         path: './timers.js' },
    { name: 'Admin',          path: './admin.js' },
    { name: 'Profils Publics',path: './profiles-public.js' },
  ];

  const results = await Promise.allSettled(
    modules.map(m => import(m.path))
  );

  let ok = 0;
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      console.log(`  ✅ ${modules[i].name}`);
      ok++;
    } else {
      console.warn(`  ⚠️ ${modules[i].name} : ${r.reason?.message}`);
    }
  });

  console.log(`%c✅ ${ok}/${modules.length} modules chargés`,
    `color: ${ok === modules.length ? '#00ffaa' : '#ff9900'}`);

  // ─────────────────────────────────────────────────────────────
  // 5. INITIALISER L'INTERFACE
  // ─────────────────────────────────────────────────────────────
  if (typeof window.initAccueil === 'function') {
    try { window.initAccueil(); } catch (e) { console.warn('Accueil init:', e); }
  }
  if (typeof window.initAuth === 'function') {
    try { window.initAuth(); } catch (e) { console.warn('Auth init:', e); }
  }

  // ─────────────────────────────────────────────────────────────
  // 6. SIGNAL READINESS
  // ─────────────────────────────────────────────────────────────
  window.AMBI241_READY = true;
  window.dispatchEvent(new CustomEvent('ambi241Ready'));
  console.log('%c🚀 AMBI241 prêt !', 'color: #00e5ff; font-weight: bold; font-size: 14px');

  // ─────────────────────────────────────────────────────────────
  // 7. ERREURS GLOBALES
  // ─────────────────────────────────────────────────────────────
  window.addEventListener('error', e =>
    console.error('%c❌ Erreur globale', 'color:#ff4466', e.error));
  window.addEventListener('unhandledrejection', e =>
    console.error('%c❌ Promise rejetée', 'color:#ff4466', e.reason));

})().catch(error => {
  console.error('%c💥 ERREUR INITIALISATION', 'color:#ff4466;font-weight:bold', error);
  document.body.innerHTML = `
    <div style="background:#1a0a28;color:#fff0f8;font-family:'DM Sans',sans-serif;
      padding:3rem;text-align:center;min-height:100vh;display:flex;
      flex-direction:column;justify-content:center;align-items:center">
      <h1 style="font-size:2rem;margin-bottom:1rem;color:#ff4466">⚠️ Erreur de Chargement</h1>
      <p style="font-size:1.1rem;margin-bottom:2rem;max-width:600px">
        L'application AMBI241 n'a pas pu se charger correctement.
      </p>
      <details style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,45,155,0.3);
        border-radius:12px;padding:1rem;text-align:left;max-width:600px;cursor:pointer">
        <summary style="cursor:pointer;font-weight:bold;margin-bottom:0.5rem">📋 Détails</summary>
        <pre style="font-family:monospace;font-size:0.85rem;color:#ff9900">${error.message}</pre>
      </details>
      <p style="margin-top:2rem;color:#b088c0">
        <button onclick="location.reload()" style="background:#ff2d9b;border:none;color:white;
          padding:0.5rem 1rem;border-radius:8px;cursor:pointer;font-weight:bold">
          🔄 Recharger
        </button>
      </p>
    </div>`;
});
