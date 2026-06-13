/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — notifications.js
   Module Notifications en Temps Réel
   • Écoute Firestore notifications/{uid}
   • Expose window.showNotification()
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  let _unsubscribeNotif = null;

  function showNotification(message, type = 'info', duration = 4000) {
    // Utilise le système de toast existant dans index.html si disponible
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    // Fallback toast minimal
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: var(--surface, #230d35); color: var(--text, #fff0f8);
      border: 1px solid var(--pink, #ff2d9b); border-radius: 12px;
      padding: 0.75rem 1.25rem; font-size: 0.85rem; font-weight: 600;
      z-index: 9999; box-shadow: 0 4px 24px rgba(255,45,155,0.3);
      animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), duration);
  }

  function startNotificationListener(uid) {
    if (!window.db || !uid) return;
    if (_unsubscribeNotif) _unsubscribeNotif();

    const notifRef = window.fbCollection(window.db, 'notifications');
    const q = window.fbQuery(
      notifRef,
      window.fbWhere('uid', '==', uid),
      window.fbWhere('read', '==', false),
      window.fbOrderBy('createdAt', 'desc'),
      window.fbLimit(20)
    );

    _unsubscribeNotif = window.fbOnSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          showNotification(data.message || 'Nouvelle notification', data.type || 'info');
        }
      });
    }, (err) => {
      console.warn('[Notifications] Listener error:', err);
    });
  }

  function stopNotificationListener() {
    if (_unsubscribeNotif) {
      _unsubscribeNotif();
      _unsubscribeNotif = null;
    }
  }

  // Démarre/arrête selon l'état d'auth
  function initNotifications() {
    if (!window.fbOnAuth || !window.auth) return;

    window.fbOnAuth(window.auth, (user) => {
      if (user) {
        startNotificationListener(user.uid);
      } else {
        stopNotificationListener();
      }
    });

    console.log('[AMBI241] ✅ Module Notifications initialisé');
  }

  window.showNotification       = showNotification;
  window.initNotifications      = initNotifications;
  window.stopNotificationListener = stopNotificationListener;

  window.addEventListener('ambi241Ready', initNotifications);

  console.log('[AMBI241] ✅ Module Notifications chargé');
})();
