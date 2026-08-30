
  (function() {
    'use strict';

    /* Correspondance tab SW → section interne + sous-onglet social */
    var TAB_MAP = {
      'home':    { section: 'accueil',        social: null   },
      'map':     { section: 'etablissements', social: null   },
      'social':  { section: 'accueil',         social: null   },  /* forum supprimé */
      'taxi':    { section: 'accueil',        social: null   }, /* taxi = widget accueil */
      'profil':  { section: 'profil',         social: null   },
      'paiements':{ section: 'paiements',     social: null   },
    };

    var SUB_MAP = {
      'messages':  'publications',
      'demandes':  'demandes',
      'amis':      'amis',
      'appel':     'publications',
      'communautes':'communautes',
    };

    function _routeFromUrl() {
      var params = new URLSearchParams(window.location.search);
      var tab    = params.get('tab');
      var sub    = params.get('sub');
      var modal  = params.get('modal');
      var action = params.get('action');
      var autoAccept = params.get('autoAccept');
      var dm     = params.get('dm');

      if (!tab) return; /* Lancement normal, pas depuis une notif */

      /* Attendre que switchSection et socSwitchTab soient disponibles */
      var attempts = 0;
      var interval = setInterval(function() {
        attempts++;
        if (attempts > 40) { clearInterval(interval); return; } /* timeout 8s */

        if (typeof switchSection !== 'function') return;

        clearInterval(interval);

        var route = TAB_MAP[tab] || { section: 'accueil', social: null };
        var navBtns = document.querySelectorAll('.nav-item');

        /* Naviguer vers la bonne section */
        var navBtn = null;
        navBtns.forEach(function(b) {
          if (b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'" + route.section + "'") !== -1) {
            navBtn = b;
          }
        });
        switchSection(route.section, navBtn);

        /* Sous-onglet social si applicable */
        if (tab === 'social' && sub && typeof window.socSwitchTab === 'function') {
          setTimeout(function() {
            window.socSwitchTab(SUB_MAP[sub] || sub);
          }, 350);
        }

        /* Acceptation automatique ami depuis la notif */
        if (autoAccept && typeof window.autoAcceptFriendRequest === 'function') {
          setTimeout(function() { window.autoAcceptFriendRequest(autoAccept); }, 600);
        }

        /* Ouvrir DM direct */
        if (dm && typeof window.openDMWith === 'function') {
          setTimeout(function() { window.openDMWith(dm); }, 600);
        }

        /* Ouvrir modal VIP ou promo */
        if (modal && typeof window.openModal === 'function') {
          setTimeout(function() { window.openModal(modal); }, 500);
        }

        /* Nettoyer l'URL sans recharger la page */
        var cleanUrl = window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);

        console.log('[AMBI241] 🔔 Routage notif → section:', route.section, sub ? '/ sous-onglet: ' + sub : '');
      }, 200);
    }

    /* Lancer au chargement de la page */
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(_routeFromUrl, 1200); /* Laisser l'app s'initialiser d'abord */
      });
    } else {
      setTimeout(_routeFromUrl, 1200);
    }

    /* SW_NOTIF_CLICK désactivé — version web uniquement */
    if (false) {
        var msg = event.data || {};
        if (msg.type !== 'SW_NOTIF_CLICK') return;

        var url = new URL(msg.targetUrl || window.location.href, window.location.origin);
        var tab    = url.searchParams.get('tab');
        var sub    = url.searchParams.get('sub');
        var modal  = url.searchParams.get('modal');
        var autoAccept = url.searchParams.get('autoAccept');
        var dm     = url.searchParams.get('dm');

        if (!tab || typeof switchSection !== 'function') return;

        var route = TAB_MAP[tab] || { section: 'accueil', social: null };
        var navBtn = null;
        document.querySelectorAll('.nav-item').forEach(function(b) {
          if (b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'" + route.section + "'") !== -1) navBtn = b;
        });
        switchSection(route.section, navBtn);

        if (tab === 'social' && sub && typeof window.socSwitchTab === 'function') {
          setTimeout(function() { window.socSwitchTab(SUB_MAP[sub] || sub); }, 350);
        }
        if (autoAccept && typeof window.autoAcceptFriendRequest === 'function') {
          setTimeout(function() { window.autoAcceptFriendRequest(autoAccept); }, 600);
        }
        if (dm && typeof window.openDMWith === 'function') {
          setTimeout(function() { window.openDMWith(dm); }, 600);
        }
        if (modal && typeof window.openModal === 'function') {
          setTimeout(function() { window.openModal(modal); }, 500);
        }
    }
  })();
  