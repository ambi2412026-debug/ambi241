// ══════════════════════════════════════════════════════════════════════════════
// 🔧 PATCH FIREBASE — Débloquer le chargement des établissements
// À INJECTER à la fin du <script type="module"> (avant </script> ligne 11528)
// ══════════════════════════════════════════════════════════════════════════════

console.log('[AMBI241] 🔷 Module Firebase — exposant les fonctions globales...');

// S'assurer que loadData() est appelée dès que Firebase est prêt
(function ensureDataLoaded() {
  if (!window.db || !window.fbCollection || !window.fbQuery || !window.fbOnSnapshot) {
    // Firebase ne pas encore complètement initialisé
    console.log('[AMBI241] ⏳ Firebase initialisation en cours...');
    setTimeout(ensureDataLoaded, 300);
    return;
  }

  console.log('[AMBI241] ✅ Firebase prêt — vérification du cache et du listener...');

  // Marquer Firebase comme vraiment prêt
  window.__firebaseModuleReady = true;

  // Forcer l'exécution de loadData() si pas déjà appelée
  if (typeof loadData === 'function' && !window._loadDataCalled) {
    window._loadDataCalled = true;
    console.log('[AMBI241] 🚀 Démarrage de loadData() depuis le module Firebase');
    
    // Utiliser requestIdleCallback si disponible pour ne pas bloquer
    if ('requestIdleCallback' in window) {
      requestIdleCallback(loadData);
    } else {
      setTimeout(loadData, 100);
    }
  }
})();

// Vérifier que les établissements arrivent bien en direct depuis Firestore
console.log('[AMBI241] 📡 Souscription aux établissements via onSnapshot() activée');

// ══════════════════════════════════════════════════════════════════════════════
// END PATCH
// ══════════════════════════════════════════════════════════════════════════════
