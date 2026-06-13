/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — paiements.js
   Module Paiements & Portefeuille
   • Lecture solde Firestore
   • Expose window.initPaiements()
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  async function loadSolde(uid) {
    if (!window.db || !uid) return null;
    try {
      const snap = await window.fbGetDoc(window.fbDoc(window.db, 'wallets', uid));
      return snap.exists() ? snap.data().solde ?? 0 : 0;
    } catch (err) {
      console.warn('[Paiements] Erreur lecture solde :', err);
      return null;
    }
  }

  async function initPaiements() {
    if (!window.fbOnAuth || !window.auth) return;

    window.fbOnAuth(window.auth, async (user) => {
      const soldeEl = document.querySelector('[data-solde], .wallet-solde, #solde');
      if (!soldeEl || !user) return;

      const solde = await loadSolde(user.uid);
      if (solde !== null) {
        soldeEl.textContent = `${solde.toLocaleString('fr-FR')} FCFA`;
      }
    });

    console.log('[AMBI241] ✅ Module Paiements initialisé');
  }

  window.initPaiements = initPaiements;
  window.loadSolde     = loadSolde;

  window.addEventListener('ambi241Ready', initPaiements);

  console.log('[AMBI241] ✅ Module Paiements chargé');
})();
