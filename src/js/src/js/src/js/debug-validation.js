/**
 * AMBI241 — Debug & Validation Script
 * À exécuter dans la console (F12) pour diagnostiquer les problèmes
 */

(function() {
  console.clear();
  console.log('%c🔍 AMBI241 Validation Tool', 'font-size:16px;font-weight:bold;color:#00ffaa');
  console.log('═'.repeat(60));
  
  const checks = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  function checkFirebase() {
    console.log('\n%c📦 Vérification Firebase', 'color:#ffd700;font-weight:bold');
    
    if (!window.__firebaseApp) {
      checks.failed.push('Firebase App pas initialisé');
      console.error('❌ window.__firebaseApp undefined');
      return;
    }
    checks.passed.push('Firebase App initialisé');
    console.log('✅ Firebase App trouvé');
    
    if (!window.db) {
      checks.failed.push('Firestore pas initialisé');
      console.error('❌ window.db undefined');
      return;
    }
    checks.passed.push('Firestore DB initialisé');
    console.log('✅ Firestore DB trouvé');
    
    if (!window.auth) {
      checks.failed.push('Firebase Auth pas initialisé');
      console.error('❌ window.auth undefined');
      return;
    }
    checks.passed.push('Firebase Auth initialisé');
    console.log('✅ Firebase Auth trouvé');
    
    if (!window.storage) {
      checks.warnings.push('Firebase Storage pas trouvé (optionnel)');
      console.warn('⚠️ window.storage undefined');
    } else {
      checks.passed.push('Firebase Storage initialisé');
      console.log('✅ Firebase Storage trouvé');
    }
  }
  
  function checkSyncModules() {
    console.log('\n%c🔄 Vérification Modules Sync', 'color:#ffd700;font-weight:bold');
    
    if (!window.firebaseSync) {
      checks.failed.push('Module firebase-data-sync.js pas chargé');
      console.error('❌ window.firebaseSync undefined');
      return;
    }
    checks.passed.push('Module firebase-data-sync.js chargé');
    console.log('✅ Module firebase-data-sync trouvé');
    
    if (!window.ambiSync) {
      checks.failed.push('Module sync-integration.js pas chargé');
      console.error('❌ window.ambiSync undefined');
      return;
    }
    checks.passed.push('Module sync-integration.js chargé');
    console.log('✅ Module sync-integration trouvé');
    
    const methods = ['loadEtablissements', 'loadEtablissement', 'subscribe', 'getStatus'];
    methods.forEach(method => {
      if (typeof window.ambiSync[method] === 'function') {
        console.log(`  ✓ Méthode ${method} disponible`);
      } else {
        checks.failed.push(`Méthode ambiSync.${method} pas disponible`);
        console.error(`  ❌ Méthode ${method} undefined`);
      }
    });
  }
  
  function checkConnectivity() {
    console.log('\n%c🌐 Vérification Connectivité', 'color:#ffd700;font-weight:bold');
    
    const isOnline = navigator.onLine;
    console.log(`Internet: ${isOnline ? '✅ Connecté' : '❌ Hors ligne'}`);
    
    if (!isOnline) {
      checks.warnings.push('Actuellement hors ligne');
    } else {
      checks.passed.push('Connexion Internet active');
    }
    
    if (window.firebaseSync) {
      const status = window.firebaseSync.getStatus();
      console.log(`Firebase: ${status.isConnected ? '✅ Connecté' : '❌ Déconnecté'}`);
      console.log(`Syncing: ${status.isSyncing ? '🔄 Oui' : '✅ Non'}`);
      console.log(`Retry count: ${status.retryCount}`);
      
      if (status.isConnected) {
        checks.passed.push('Connecté à Firebase');
      } else {
        checks.warnings.push('Déconnecté de Firebase');
      }
    }
  }
  
  function checkCache() {
    console.log('\n%c💾 Vérification Cache Local', 'color:#ffd700;font-weight:bold');
    
    try {
      const testKey = '__ambi_test_' + Date.now();
      localStorage.setItem(testKey, 'test');
      const value = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      
      if (value === 'test') {
        checks.passed.push('LocalStorage disponible');
        console.log('✅ LocalStorage fonctionne');
      } else {
        checks.failed.push('LocalStorage ne persiste pas');
        console.error('❌ LocalStorage test échoué');
      }
    } catch (error) {
      checks.failed.push('LocalStorage non disponible');
      console.error('❌ LocalStorage erreur:', error.message);
    }
    
    const cacheKeys = Object.keys(localStorage)
      .filter(k => k.startsWith('ambi_cache_'));
    
    if (cacheKeys.length > 0) {
      console.log(`📦 ${cacheKeys.length} entrées en cache:`);
      cacheKeys.forEach(key => {
        const item = localStorage.getItem(key);
        try {
          const { timestamp } = JSON.parse(item);
          const age = Math.round((Date.now() - timestamp) / 1000);
          console.log(`  • ${key.replace('ambi_cache_', '')}: ${age}s`);
        } catch (e) {
          console.log(`  • ${key} (invalide)`);
        }
      });
    } else {
      console.log('📦 Aucune entrée en cache (normal au premier lancement)');
    }
  }
  
  async function checkData() {
    console.log('\n%c📊 Vérification Données', 'color:#ffd700;font-weight:bold');
    
    if (!window.ambiSync) {
      checks.failed.push('Impossible de tester les données (ambiSync pas chargé)');
      console.error('❌ ambiSync pas disponible');
      return;
    }
    
    try {
      console.log('⏳ Chargement des établissements...');
      
      const etabs = await window.ambiSync.loadEtablissements();
      
      if (Array.isArray(etabs) && etabs.length > 0) {
        checks.passed.push(`${etabs.length} établissements chargés`);
        console.log(`✅ ${etabs.length} établissements trouvés`);
        
        const first = etabs[0];
        console.log('Exemple de données:', first);
        
        const requiredFields = ['id', 'nom'];
        const hasRequiredFields = requiredFields.every(field => field in first);
        
        if (hasRequiredFields) {
          checks.passed.push('Structure des données valide');
          console.log('✅ Structure des données correcte');
        } else {
          checks.failed.push('Structure des données invalide');
          console.error('❌ Champs manquants:', 
            requiredFields.filter(f => !(f in first))
          );
        }
        
      } else {
        checks.warnings.push('Aucun établissement trouvé');
        console.warn('⚠️ Tableaux vides');
      }
      
    } catch (error) {
      checks.failed.push(`Erreur chargement données: ${error.message}`);
      console.error('❌ Erreur:', error);
    }
  }
  
  function checkUI() {
    console.log('\n%c🎨 Vérification UI', 'color:#ffd700;font-weight:bold');
    
    const indicator = document.getElementById('syncIndicator');
    if (indicator) {
      checks.passed.push('Indicateur de sync visible');
      console.log('✅ Indicateur de sync trouvé');
    } else {
      checks.warnings.push('Indicateur de sync pas visible (créé au démarrage)');
      console.warn('⚠️ Indicateur pas encore créé');
    }
  }
  
  function showSummary() {
    console.log('\n%c📋 RÉSUMÉ', 'color:#00ffaa;font-weight:bold;font-size:14px');
    console.log('═'.repeat(60));
    
    console.log(`%c✅ RÉUSSIS: ${checks.passed.length}`, 'color:#00ffaa;font-weight:bold');
    checks.passed.forEach(item => console.log(`  ✓ ${item}`));
    
    if (checks.warnings.length > 0) {
      console.log(`\n%c⚠️  AVERTISSEMENTS: ${checks.warnings.length}`, 'color:#ffd700;font-weight:bold');
      checks.warnings.forEach(item => console.log(`  ⚠️  ${item}`));
    }
    
    if (checks.failed.length > 0) {
      console.log(`\n%c❌ ÉCHOUÉS: ${checks.failed.length}`, 'color:#ff4466;font-weight:bold');
      checks.failed.forEach(item => console.log(`  ✗ ${item}`));
    }
    
    console.log('\n%c🎯 DIAGNOSTIC', 'color:#00ffaa;font-weight:bold;font-size:14px');
    console.log('═'.repeat(60));
    
    if (checks.failed.length === 0) {
      console.log('%c✅ TOUT EST OK !', 'color:#00ffaa;font-weight:bold;font-size:14px');
      console.log('Les modules Sync sont correctement configurés.');
      console.log('Vous pouvez utiliser:\n');
      console.log('  window.ambiSync.loadEtablissements()');
      console.log('  window.ambiSync.getStatus()');
      console.log('  window.ambiSync.clearCache()');
    } else {
      console.log('%c❌ DES PROBLÈMES ONT ÉTÉ DÉTECTÉS', 'color:#ff4466;font-weight:bold;font-size:14px');
      console.log('\nProblèmes à corriger:');
      checks.failed.forEach((item, i) => {
        console.log(`${i + 1}. ${item}`);
      });
      console.log('\nSolution:');
      console.log('1. Vérifier que firebase-data-sync.js est chargé');
      console.log('2. Vérifier que sync-integration.js est chargé');
      console.log('3. Vérifier l\'ordre des scripts dans le HTML');
      console.log('4. Ouvrir la Console (F12) pour les erreurs');
    }
    
    console.log('═'.repeat(60));
    console.log('Documentation: https://github.com/ambi241');
  }
  
  async function runAllChecks() {
    checkFirebase();
    checkSyncModules();
    checkConnectivity();
    checkCache();
    checkUI();
    
    setTimeout(async () => {
      await checkData();
      showSummary();
    }, 1000);
  }
  
  runAllChecks();
  
  window.ambiDebug = {
    retest: runAllChecks,
    getStatus: () => ({
      passed: checks.passed,
      failed: checks.failed,
      warnings: checks.warnings
    })
  };
  
  console.log('\n💡 Astuce: Taper `ambiDebug.retest()` pour relancer les tests');
  console.log('💡 Astuce: Taper `ambiDebug.getStatus()` pour voir les résultats\n');
})();
