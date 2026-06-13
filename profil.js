/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — profil.js
   Module Profil Utilisateur
   • Charge et affiche les infos du profil connecté
   • Expose window.initProfil()
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  async function loadProfil(uid) {
    if (!window.db || !uid) return null;
    try {
      const snap = await window.fbGetDoc(window.fbDoc(window.db, 'users', uid));
      return snap.exists() ? snap.data() : null;
    } catch (err) {
      console.warn('[Profil] Erreur chargement :', err);
      return null;
    }
  }

  function renderProfil(data) {
    if (!data) return;

    const nameEls = document.querySelectorAll('[data-profil-nom], .profil-nom, #profilNom');
    nameEls.forEach(el => { el.textContent = data.displayName || data.nom || ''; });

    const avatarEls = document.querySelectorAll('[data-profil-avatar], .profil-avatar img, #profilAvatar');
    avatarEls.forEach(el => {
      if (data.photoURL && el.tagName === 'IMG') el.src = data.photoURL;
    });
  }

  function initProfil() {
    if (!window.fbOnAuth || !window.auth) return;

    window.fbOnAuth(window.auth, async (user) => {
      if (!user) return;
      const data = await loadProfil(user.uid);
      renderProfil(data);
    });

    console.log('[AMBI241] ✅ Module Profil initialisé');
  }

  window.initProfil   = initProfil;
  window.loadProfil   = loadProfil;
  window.renderProfil = renderProfil;

  window.addEventListener('ambi241Ready', initProfil);

  console.log('[AMBI241] ✅ Module Profil chargé');
})();
