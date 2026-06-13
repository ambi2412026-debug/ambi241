/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — admin.js
   Module Panel Administrateur
   • Vérifie le rôle admin de l'utilisateur connecté
   • Expose window.initAdmin()
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let _adminInited = false;

  async function initAdmin() {
    if (_adminInited) return;
    _adminInited = true;

    const auth = window.auth;
    const db   = window.db;

    if (!auth || !db) {
      console.warn('[Admin] Firebase non disponible');
      return;
    }

    auth.onAuthStateChanged
      ? auth.onAuthStateChanged(onAuthChange)
      : window.addEventListener('ambi241Ready', () => {
          if (window.fbOnAuth) window.fbOnAuth(window.auth, onAuthChange);
        });

    console.log('[AMBI241] ✅ Module Admin initialisé');
  }

  async function onAuthChange(user) {
    const adminPanel = document.querySelector('#adminPanel, [data-section="admin"], .admin-section');
    if (!adminPanel) return;

    if (!user) {
      adminPanel.style.display = 'none';
      return;
    }

    try {
      const snap = await window.fbGetDoc(window.fbDoc(window.db, 'users', user.uid));
      const isAdmin = snap.exists() && snap.data().role === 'admin';
      adminPanel.style.display = isAdmin ? '' : 'none';
      if (isAdmin) console.log('[Admin] ✅ Accès admin autorisé');
    } catch (err) {
      console.warn('[Admin] Erreur vérification rôle :', err);
    }
  }

  window.initAdmin = initAdmin;

  // Auto-init après Firebase
  window.addEventListener('ambi241Ready', initAdmin);
  window.addEventListener('firebaseInitialized', initAdmin);

  console.log('[AMBI241] ✅ Module Admin chargé');
})();
