/* ══════════════════════════════════════════════════════════════
   AMBI241 — Initialisation PWA
   Sépare tout le code d'enregistrement du service worker et de
   gestion de l'installation hors de index.html.
   ══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Enregistrement du service worker ── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js')
        .then(function (reg) {
          console.log('[PWA] Service worker enregistré, scope :', reg.scope);
        })
        .catch(function (err) {
          console.error('[PWA] Échec enregistrement service worker :', err);
        });
    });
  }

  /* ── Capture du prompt d'installation natif ──
     Chrome/Edge déclenchent "beforeinstallprompt" seulement si le
     manifest + le service worker sont valides. On garde l'event
     pour pouvoir déclencher l'installation depuis un bouton de
     l'app (ex: un bouton "Installer AMBI241" dans le menu). */
  window._ambiDeferredInstallPrompt = null;

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    window._ambiDeferredInstallPrompt = event;
    window.dispatchEvent(new CustomEvent('ambi-pwa-installable'));
  });

  /* Fonction globale à appeler depuis un bouton existant de l'app
     (ex: onclick="ambiInstallPWA()") pour proposer l'installation. */
  window.ambiInstallPWA = function () {
    var promptEvent = window._ambiDeferredInstallPrompt;
    if (!promptEvent) {
      console.warn('[PWA] Aucune invite d\'installation disponible pour le moment.');
      return Promise.resolve(null);
    }
    promptEvent.prompt();
    return promptEvent.userChoice.then(function (choice) {
      window._ambiDeferredInstallPrompt = null;
      return choice;
    });
  };

  window.addEventListener('appinstalled', function () {
    window._ambiDeferredInstallPrompt = null;
    console.log('[PWA] AMBI241 installée avec succès.');
  });
})();
