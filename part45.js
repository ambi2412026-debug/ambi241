
(function(){
  'use strict';

  /* ── Utilitaire : lire un entier dans un élément DOM ── */
  function _elInt(id){
    var el = document.getElementById(id);
    if(!el) return 0;
    return parseInt(el.textContent, 10) || 0;
  }

  /* ── Écriture dans un badge nav ── */
  function _setNav(id, n){
    var el = document.getElementById(id);
    if(!el) return;
    if(n > 0){
      el.textContent = n > 99 ? '99+' : String(n);
      el.classList.add('show');
    } else {
      el.textContent = '';
      el.classList.remove('show');
    }
  }

  /* ── Calcul Forum : demandes reçues + DMs ── */
  function _getForumCount(){
    var req  = (window._requestsIn || []).length;
    var dm   = _elInt('dmInboxBadge');
    /* Lire aussi le badge DOM tabBadgeReq comme fallback */
    var reqTab = _elInt('tabBadgeReq');
    return Math.max(req, reqTab) + dm;
  }

  /* ── Calcul Profil : demandes reçues (pour section Profil) ── */
  function _getProfilCount(){
    /* Les demandes d'amis peuvent aussi atterrir dans Profil si l'utilisateur
       n'est pas encore dans la section Forum */
    return 0; /* géré par Firestore dans le moteur v4 — ne pas doubler */
  }

  /* ── Flush global ── */
  function _flush(){
    var forum     = _getForumCount();
    var paiements = _elInt('navBadgePaiements') > 0 ? _elInt('navBadgePaiements') : 0;
    var profil    = _elInt('navBadgeProfil')    > 0 ? _elInt('navBadgeProfil')    : 0;
    var admin     = _elInt('navBadgeAdmin')     > 0 ? _elInt('navBadgeAdmin')     : 0;
    var total     = forum + paiements + profil + admin;

    /* Mettre à jour seulement le badge Forum ici ; les autres sont gérés par le moteur v4 */
    _setNav('navBadgeForum', forum);

    /* Synchroniser aussi window._ambiNavBadge si disponible */
    if(window._ambiNavBadge && window._ambiNavBadge.counts){
      window._ambiNavBadge.counts.navBadgeForum = forum;
    }

    /* Badge icône PWA supprimé — version web uniquement */

    /* ── Titre onglet ── */
    var base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = total > 0 ? '(' + total + ') ' + base : base;
  }

  /* ── Observer tabBadgeReq (Demandes) pour détecter changements ── */
  function _observeTabBadgeReq(){
    var el = document.getElementById('tabBadgeReq');
    if(!el){
      setTimeout(_observeTabBadgeReq, 1500);
      return;
    }
    var obs = new MutationObserver(function(){
      setTimeout(_flush, 50);
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  /* ── Observer dmInboxBadge (DMs) ── */
  function _observeDmBadge(){
    var el = document.getElementById('dmInboxBadge');
    if(!el){
      setTimeout(_observeDmBadge, 2000);
      return;
    }
    var obs = new MutationObserver(function(){
      setTimeout(_flush, 50);
    });
    obs.observe(el, { childList: true, characterData: true, subtree: true });
  }

  /* ── Patch updateBadges social pour propager vers nav ── */
  function _patchUpdateBadges(){
    var _orig = window.updateBadges;
    window.updateBadges = function(){
      if(typeof _orig === 'function') _orig.apply(this, arguments);
      setTimeout(_flush, 80);
    };
  }

  /* ── Réinitialiser badge Forum à l'ouverture de la section social ── */
  function _patchSwitchSectionBadge(){
    var _orig = window.switchSection;
    if(typeof _orig !== 'function'){
      setTimeout(_patchSwitchSectionBadge, 500);
      return;
    }
    window.switchSection = function(sec, btn){
      var result = _orig.apply(this, arguments);
      if(sec === 'social'){
        /* Laisser 300ms pour que le rendu se fasse, puis effacer */
        setTimeout(function(){
          _setNav('navBadgeForum', 0);
          if(window._ambiNavBadge && window._ambiNavBadge.counts){
            window._ambiNavBadge.counts.navBadgeForum = 0;
          }
          /* Icône app PWA supprimée — version web uniquement */
        }, 300);
      }
      return result;
    };
  }

  /* ── Polling léger toutes les 4s comme filet de sécurité ── */
  function _startPolling(){
    _flush();
    setInterval(_flush, 4000);
  }

  /* ── Demande permission notification ── */
  function _askPerm(){
    if(!('Notification' in window)) return;
    if(Notification.permission !== 'default') return;
    Notification.requestPermission().catch(function(){});
  }

  /* ── Initialisation ── */
  function _init(){
    _patchUpdateBadges();
    _patchSwitchSectionBadge();
    _observeTabBadgeReq();
    _observeDmBadge();
    _startPolling();
    /* Demander permission sur premier geste */
    document.addEventListener('click', function _p(){ _askPerm(); document.removeEventListener('click', _p); }, { once: true });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_init, 2000); });
  } else {
    setTimeout(_init, 2000);
  }

})();
