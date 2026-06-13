/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — forum.js
   Module Forum / Discussions
   • Expose window._initForumOnce() (utilisé par index.html)
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Note : La logique complète du forum est dans index.html.
  // Ce module assure la compatibilité et les hooks d'extension.

  let _forumInited = false;

  function initForum() {
    if (_forumInited) return;
    _forumInited = true;

    // Délègue à la fonction inline si déjà définie dans index.html
    if (typeof window._initForumOnce === 'function') {
      window._initForumOnce();
    }

    console.log('[AMBI241] ✅ Module Forum initialisé');
  }

  window.initForumModule = initForum;

  // S'assurer que _initForumOnce est toujours disponible
  if (!window._initForumOnce) {
    window._initForumOnce = function () {
      console.log('[Forum] initForumOnce appelé depuis module externe');
    };
  }

  window.addEventListener('ambi241Ready', function () {
    setTimeout(initForum, 300);
  });

  console.log('[AMBI241] ✅ Module Forum chargé');
})();
