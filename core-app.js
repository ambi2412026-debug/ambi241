/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — core-app.js
   ═════════════════════════════════════════════════════════════════
   Point d'entrée pour l'application
   • Attend Firebase
   • Charge les modules métier
   • Initialise l'interface
═══════════════════════════════════════════════════════════════════ */

(async function initAMBI241() {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // 1. ATTENDRE FIREBASE
  // ─────────────────────────────────────────────────────────────
  console.log('%c🔥 AMBI241 Initialisation', 'color: #ff2d9b; font-weight: bold; font-size: 14px');
  
  let firebaseReady = false;
  
  // Vérifier si Firebase est déjà chargé
  if (window.firebaseReady && window.db && window.auth) {
    firebaseReady = true;
    console.log('%c✅ Firebase déjà initialisé', 'color: #00ffaa');
  } else {
    // Sinon, attendre le signal
    console.log('%c⏳ En attente de Firebase...', 'color: #00e5ff');
    
    await new Promise((resolve, reject) => {
      const maxWait = 10000; // 10 secondes max
      const timer = setTimeout(() => {
        reject(new Error('Firebase n\'a pas été initialisé dans les 10 secondes'));
      }, maxWait);
      
      const onReady = () => {
        clearTimeout(timer);
        window.removeEventListener('firebaseInitialized', onReady);
        console.log('%c✅ Firebase initialisé', 'color: #00ffaa');
        resolve();
      };
      
      window.addEventListener('firebaseInitialized', onReady);
    });
    
    firebaseReady = true;
  }

  // Vérifier que Firebase a bien exposé les globals
  if (!window.db || !window.auth) {
    throw new Error('❌ Firebase globals non disponibles. Vérifiez firebase-config.js');
  }

  // ─────────────────────────────────────────────────────────────
  // 2. CHARGER LES MODULES MÉTIER (en série, dans l'ordre)
  // ─────────────────────────────────────────────────────────────
  console.log('%c📦 Chargement des modules métier...', 'color: #ffd700');

  const modules = [
    { name: 'Accueil', path: './accueil.js' },
    { name: 'Lieux', path: './etablissements.js' },
    { name: 'Profil', path: './profil.js' },
    { name: 'Forum', path: './forum.js' },
    { name: 'Social', path: './social.js' },
    { name: 'Paiements', path: './paiements.js' },
    { name: 'Notifications', path: './notifications.js' },
    { name: 'Timers', path: './timers.js' },
    { name: 'Admin', path: './admin.js' },
    { name: 'Profils Publics', path: './profiles-public.js' }
  ];

  let loadedCount = 0;
  const loadErrors = [];

  for (const module of modules) {
    try {
      console.log(`  ⏳ Chargement ${module.name}...`);
      await import(module.path);
      console.log(`  ✅ ${module.name} chargé`);
      loadedCount++;
    } catch (error) {
      console.warn(`  ⚠️  ${module.name} : ${error.message}`);
      loadErrors.push({ module: module.name, error: error.message });
      // Continue même si un module échoue
    }
  }

  console.log(`%c✅ ${loadedCount}/${modules.length} modules chargés`, 
    `color: ${loadErrors.length === 0 ? '#00ffaa' : '#ff9900'}`);

  if (loadErrors.length > 0) {
    console.warn('%c⚠️ Modules avec erreurs :', 'color: #ff4466');
    loadErrors.forEach(err => {
      console.warn(`  • ${err.module}: ${err.error}`);
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. INITIALISER L'INTERFACE
  // ─────────────────────────────────────────────────────────────
  console.log('%c🎨 Initialisation interface...', 'color: #cc44ff');

  // Callback si définies dans les modules
  if (typeof window.initAccueil === 'function') {
    try {
      window.initAccueil();
      console.log('  ✅ Accueil initialisé');
    } catch (err) {
      console.warn('  ⚠️ Accueil init error:', err);
    }
  }

  if (typeof window.initAuth === 'function') {
    try {
      window.initAuth();
      console.log('  ✅ Auth initialisé');
    } catch (err) {
      console.warn('  ⚠️ Auth init error:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 4. SIGNAL DE READINESS
  // ─────────────────────────────────────────────────────────────
  window.AMBI241_READY = true;
  window.dispatchEvent(new CustomEvent('ambi241Ready'));
  
  console.log('%c🚀 AMBI241 prêt !', 'color: #00e5ff; font-weight: bold; font-size: 14px');

  // ─────────────────────────────────────────────────────────────
  // 5. ERREUR GLOBALE HANDLER
  // ─────────────────────────────────────────────────────────────
  window.addEventListener('error', (event) => {
    console.error('%c❌ Erreur globale', 'color: #ff4466', event.error);
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('%c❌ Promise rejetée', 'color: #ff4466', event.reason);
  });

})().catch(error => {
  console.error('%c💥 ERREUR LORS DE L\'INITIALISATION', 'color: #ff4466; font-weight: bold', error);
  
  // Afficher un message d'erreur à l'utilisateur
  document.body.innerHTML = `
    <div style="
      background: #1a0a28;
      color: #fff0f8;
      font-family: 'DM Sans', sans-serif;
      padding: 3rem;
      text-align: center;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    ">
      <h1 style="font-size: 2rem; margin-bottom: 1rem; color: #ff4466;">
        ⚠️ Erreur de Chargement
      </h1>
      <p style="font-size: 1.1rem; margin-bottom: 2rem; max-width: 600px;">
        L'application AMBI241 n'a pas pu se charger correctement.
      </p>
      <details style="
        background: rgba(255,255,255,0.05);
        border: 1px solid rgba(255,45,155,0.3);
        border-radius: 12px;
        padding: 1rem;
        text-align: left;
        max-width: 600px;
        cursor: pointer;
      ">
        <summary style="cursor: pointer; font-weight: bold; margin-bottom: 0.5rem;">
          📋 Détails Techniques
        </summary>
        <pre style="
          font-family: 'Courier New', monospace;
          font-size: 0.85rem;
          overflow-x: auto;
          color: #ff9900;
        ">${error.message}</pre>
      </details>
      <p style="margin-top: 2rem; color: #b088c0;">
        Ouvrez la console (F12) pour plus de détails.
        <br/>
        Essayez de <button onclick="location.reload()" style="
          background: #ff2d9b;
          border: none;
          color: white;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
        ">recharger la page</button>.
      </p>
    </div>
  `;
});
