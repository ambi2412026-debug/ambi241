/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — profiles-public.js
   Module Profils Publics
   • Affiche le profil public d'un autre utilisateur
   • Expose window.openPublicProfil(uid)
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  async function openPublicProfil(uid) {
    if (!uid || !window.db) return;

    try {
      const snap = await window.fbGetDoc(window.fbDoc(window.db, 'users', uid));
      if (!snap.exists()) {
        console.warn('[ProfilesPublic] Utilisateur introuvable :', uid);
        return;
      }

      const data = snap.data();
      renderPublicModal(data, uid);
    } catch (err) {
      console.warn('[ProfilesPublic] Erreur :', err);
    }
  }

  function renderPublicModal(data, uid) {
    // Si la modal existe déjà dans index.html, la remplir
    const modal   = document.querySelector('#publicProfilModal, #profileModal, [data-modal="profil-public"]');
    const nameEl  = document.querySelector('#pubProfilNom, [data-pub-nom]');
    const avatarEl = document.querySelector('#pubProfilAvatar, [data-pub-avatar]');

    if (nameEl)  nameEl.textContent = data.displayName || data.nom || 'Utilisateur';
    if (avatarEl && data.photoURL) avatarEl.src = data.photoURL;

    if (modal) {
      modal.classList.add('open', 'show');
      modal.style.display = '';
    }

    console.log('[ProfilesPublic] Profil ouvert :', data.displayName || uid);
  }

  function closePublicProfil() {
    const modal = document.querySelector('#publicProfilModal, #profileModal, [data-modal="profil-public"]');
    if (modal) {
      modal.classList.remove('open', 'show');
    }
  }

  window.openPublicProfil  = openPublicProfil;
  window.closePublicProfil = closePublicProfil;

  console.log('[AMBI241] ✅ Module Profils Publics chargé');
})();
