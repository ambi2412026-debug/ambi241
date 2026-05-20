/* ══════════════════════════════════════════════════════════════════════
   AMBI241 — Moteur Notifications Push v1
   À placer JUSTE AVANT </body> dans index.html
   (après le script routeur SW_NOTIF_CLICK existant)

   Ce script gère :
   ✅ Demande de permission notifications
   ✅ Enregistrement de la subscription WebPush
   ✅ Mise à jour du badge cloche dans la topbar
   ✅ Toast maison quand l'app est au premier plan (foreground)
   ✅ Synchronisation avec Firestore (optionnel)
   ══════════════════════════════════════════════════════════════════════ */

(function() {
  'use strict';

  /* ── CONFIG — À ADAPTER ───────────────────────────────────────────── */
  var AMBI_CONFIG = {
    /* Clé publique VAPID (générer sur https://vapidkeys.com ou via web-push) */
    vapidPublicKey: 'REMPLACER_PAR_TA_CLE_VAPID_PUBLIQUE',

    /* Endpoint backend pour sauvegarder la subscription */
    subscribeEndpoint: '/api/push/subscribe',

    /* Délai avant de proposer les notifs (ms) — évite le pop-up immédiat */
    promptDelay: 4000,

    /* Clé localStorage pour savoir si l'utilisateur a déjà refusé */
    storageKey: 'ambi241_notif_asked',
  };
  /* ─────────────────────────────────────────────────────────────────── */

  /* Convertit une clé VAPID base64url → Uint8Array */
  function _urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw     = atob(base64);
    var output  = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) { output[i] = raw.charCodeAt(i); }
    return output;
  }

  /* Met à jour le badge cloche dans la topbar */
  function _updateBellBadge(count) {
    var bells = document.querySelectorAll('.notif-bell-btn, [data-notif-bell]');
    bells.forEach(function(btn) {
      var badge = btn.querySelector('.notif-bell-badge');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notif-bell-badge';
        badge.style.cssText = [
          'position:absolute', 'top:-5px', 'right:-5px',
          'min-width:18px', 'height:18px', 'border-radius:99px',
          'background:#ff4466', 'color:#fff',
          'font-size:0.55rem', 'font-weight:900',
          'font-family:\'Syne\',sans-serif',
          'display:flex', 'align-items:center', 'justify-content:center',
          'padding:0 4px', 'border:2px solid #1a0a28',
          'box-shadow:0 0 8px rgba(255,68,102,0.55)',
          'z-index:10', 'pointer-events:none',
          'animation:badgePulse 1.4s ease-in-out infinite'
        ].join(';');
        btn.style.position = 'relative';
        btn.appendChild(badge);
      }
      if (!count || count <= 0) {
        badge.style.display = 'none';
      } else {
        badge.style.display = 'flex';
        badge.textContent = count > 99 ? '99+' : String(count);
      }
    });
  }

  /* Affiche un toast maison quand l'app est au premier plan */
  function _showForegroundToast(data) {
    var existing = document.getElementById('ambi241-fg-toast');
    if (existing) existing.remove();

    var toast = document.createElement('div');
    toast.id = 'ambi241-fg-toast';
    toast.style.cssText = [
      'position:fixed', 'top:16px', 'left:50%', 'transform:translateX(-50%)',
      'width:calc(100% - 32px)', 'max-width:400px',
      'background:linear-gradient(135deg,#2c1040,#230d35)',
      'border:1px solid rgba(255,45,155,0.35)', 'border-radius:16px',
      'padding:12px 14px', 'display:flex', 'align-items:center', 'gap:12px',
      'box-shadow:0 8px 32px rgba(0,0,0,0.6)',
      'z-index:99999',
      'animation:slideDown 0.35s cubic-bezier(.175,.885,.32,1.275)',
      'cursor:pointer'
    ].join(';');

    toast.innerHTML = [
      '<div style="width:40px;height:40px;border-radius:12px;',
        'background:linear-gradient(135deg,#cc44ff,#ff2d9b);',
        'display:flex;align-items:center;justify-content:center;',
        'font-size:1.2rem;flex-shrink:0;">🎉</div>',
      '<div style="flex:1;min-width:0;">',
        '<div style="font-size:0.65rem;font-weight:800;color:#ff2d9b;',
          'font-family:\'Syne\',sans-serif;text-transform:uppercase;',
          'letter-spacing:0.06em;margin-bottom:2px;">',
          'AMBI241</div>',
        '<div style="font-size:0.78rem;font-weight:700;color:#fff0f8;',
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">',
          (data.title || 'AMBI241') + '</div>',
        '<div style="font-size:0.68rem;color:#b088c0;',
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">',
          (data.body || '') + '</div>',
      '</div>',
      '<button id="ambi241-fg-toast-close" style="background:none;border:none;',
        'color:#b088c0;cursor:pointer;font-size:0.9rem;flex-shrink:0;padding:2px 4px;">✕</button>'
    ].join('');

    /* Fermeture manuelle */
    toast.querySelector('#ambi241-fg-toast-close').addEventListener('click', function(e) {
      e.stopPropagation();
      toast.remove();
    });

    /* Clic → routing */
    toast.addEventListener('click', function() {
      toast.remove();
      if (data.url && typeof switchSection === 'function') {
        var url = new URL(data.url, window.location.origin);
        var tab = url.searchParams.get('tab');
        if (tab) {
          /* Réutilise le routeur déjà en place dans index.html */
          var ev = new MessageEvent('message', {
            data: { type: 'SW_NOTIF_CLICK', targetUrl: data.url }
          });
          window.dispatchEvent(ev);
        }
      }
    });

    document.body.appendChild(toast);

    /* Auto-dismiss après 4,5s */
    setTimeout(function() { if (toast.parentNode) toast.remove(); }, 4500);
  }

  /* Enregistre la subscription WebPush côté backend */
  function _saveSubscription(subscription) {
    if (!AMBI_CONFIG.subscribeEndpoint || AMBI_CONFIG.subscribeEndpoint === '/api/push/subscribe') {
      /* Pas de backend configuré — log uniquement */
      console.log('[AMBI241 Notif] 📋 Subscription (à envoyer à ton backend):', JSON.stringify(subscription));
      return Promise.resolve();
    }
    return fetch(AMBI_CONFIG.subscribeEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription)
    }).then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      console.log('[AMBI241 Notif] ✅ Subscription enregistrée côté serveur');
    }).catch(function(err) {
      console.warn('[AMBI241 Notif] ⚠️ Impossible d\'enregistrer la subscription:', err);
    });
  }

  /* Demande la permission et s'abonne */
  function _requestAndSubscribe() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[AMBI241 Notif] Push non supporté sur ce navigateur');
      return;
    }

    /* Déjà refusé par l'utilisateur → ne plus demander */
    if (localStorage.getItem(AMBI_CONFIG.storageKey) === 'denied') return;

    /* Permission déjà accordée → s'abonner directement */
    if (Notification.permission === 'granted') {
      _subscribe();
      return;
    }

    /* Permission déjà refusée par le navigateur */
    if (Notification.permission === 'denied') {
      console.log('[AMBI241 Notif] Permission refusée par le navigateur');
      return;
    }

    /* Pas encore demandé → afficher d'abord une UI custom, puis demander */
    setTimeout(function() {
      _showPermissionPrompt();
    }, AMBI_CONFIG.promptDelay);
  }

  /* UI custom avant le pop-up natif */
  function _showPermissionPrompt() {
    var existing = document.getElementById('ambi241-notif-prompt');
    if (existing) return;

    var prompt = document.createElement('div');
    prompt.id = 'ambi241-notif-prompt';
    prompt.style.cssText = [
      'position:fixed', 'bottom:80px', 'left:50%', 'transform:translateX(-50%)',
      'width:calc(100% - 32px)', 'max-width:380px',
      'background:linear-gradient(135deg,#2c1040,#230d35)',
      'border:1px solid rgba(255,45,155,0.4)', 'border-radius:18px',
      'padding:16px', 'z-index:99998',
      'box-shadow:0 8px 40px rgba(0,0,0,0.7)',
      'animation:slideUp 0.4s cubic-bezier(.175,.885,.32,1.275)'
    ].join(';');

    prompt.innerHTML = [
      '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">',
        '<div style="font-size:1.8rem">🔔</div>',
        '<div>',
          '<div style="font-family:\'Syne\',sans-serif;font-weight:800;',
            'font-size:0.88rem;color:#fff0f8;margin-bottom:2px;">',
            'Activer les notifications</div>',
          '<div style="font-size:0.7rem;color:#b088c0;line-height:1.4;">',
            'Messages, événements, ambiances en direct à Libreville</div>',
        '</div>',
      '</div>',
      '<div style="display:flex;gap:8px;">',
        '<button id="ambi241-notif-deny" style="flex:1;padding:10px;border-radius:10px;',
          'background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);',
          'color:#b088c0;font-family:\'DM Sans\',sans-serif;font-weight:700;',
          'font-size:0.78rem;cursor:pointer;">',
          'Plus tard</button>',
        '<button id="ambi241-notif-allow" style="flex:2;padding:10px;border-radius:10px;',
          'background:linear-gradient(135deg,#ff2d9b,#cc44ff);border:none;',
          'color:#fff;font-family:\'Syne\',sans-serif;font-weight:800;',
          'font-size:0.78rem;cursor:pointer;',
          'box-shadow:0 4px 16px rgba(255,45,155,0.35);">',
          '🔔 Activer</button>',
      '</div>'
    ].join('');

    prompt.querySelector('#ambi241-notif-allow').addEventListener('click', function() {
      prompt.remove();
      Notification.requestPermission().then(function(permission) {
        if (permission === 'granted') {
          _subscribe();
        } else {
          localStorage.setItem(AMBI_CONFIG.storageKey, 'denied');
        }
      });
    });

    prompt.querySelector('#ambi241-notif-deny').addEventListener('click', function() {
      prompt.remove();
      localStorage.setItem(AMBI_CONFIG.storageKey, 'denied');
    });

    document.body.appendChild(prompt);
  }

  /* S'abonne aux push via le Service Worker */
  function _subscribe() {
    navigator.serviceWorker.ready.then(function(reg) {
      return reg.pushManager.getSubscription().then(function(existing) {
        if (existing) {
          console.log('[AMBI241 Notif] ✅ Déjà abonné');
          _saveSubscription(existing);
          return existing;
        }

        var appKey = _urlBase64ToUint8Array(AMBI_CONFIG.vapidPublicKey);
        return reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appKey
        }).then(function(subscription) {
          console.log('[AMBI241 Notif] ✅ Nouvelle subscription créée');
          return _saveSubscription(subscription).then(function() { return subscription; });
        });
      });
    }).catch(function(err) {
      console.warn('[AMBI241 Notif] ❌ Erreur subscription:', err);
    });
  }

  /* Écoute les messages SW → toast foreground */
  function _listenForForegroundPush() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', function(event) {
      var msg = event.data || {};
      /* Le SW envoie SW_FOREGROUND_PUSH quand l'app est ouverte */
      if (msg.type === 'SW_FOREGROUND_PUSH') {
        _showForegroundToast(msg);
        /* Incrémenter le badge cloche */
        var bells = document.querySelectorAll('.notif-bell-btn, [data-notif-bell]');
        if (bells.length > 0) {
          var badge = bells[0].querySelector('.notif-bell-badge');
          var current = badge ? (parseInt(badge.textContent, 10) || 0) : 0;
          _updateBellBadge(current + 1);
        }
      }
    });
  }

  /* ── POINT D'ENTRÉE ─────────────────────────────────────────────── */
  function _init() {
    _listenForForegroundPush();
    _requestAndSubscribe();

    /* Expose l'API publique */
    window.ambi241Notif = {
      requestPermission: _requestAndSubscribe,
      updateBellBadge:   _updateBellBadge,
      showToast:         _showForegroundToast,
      subscribe:         _subscribe,
    };

    console.log('[AMBI241 Notif] ✅ Moteur notifications initialisé');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})();
