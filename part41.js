
  (function(){
    'use strict';

    /* ─────────────────────────────────────────────────────────────
       1. SONS WEB AUDIO — sonneries 100% natives, zéro fichier
    ───────────────────────────────────────────────────────────── */
    var _audioCtx = null;
    function _getAudioCtx(){
      if(!_audioCtx){
        try{ _audioCtx = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; }
      }
      if(_audioCtx.state === 'suspended'){ _audioCtx.resume(); }
      return _audioCtx;
    }

    /* Joue un son selon le type (message, ami, paiement, notif, alerte) */
    function playNotifSound(type){
      var ctx = _getAudioCtx();
      if(!ctx) return;
      /* Patterns de notes : [fréquence, durée_s, délai_s] */
      var patterns = {
        message:        [[880,0.08,0],[1100,0.1,0.1],[880,0.08,0.22]],
        friend_request: [[523,0.1,0],[659,0.1,0.12],[784,0.15,0.25]],
        paiement:       [[440,0.05,0],[880,0.05,0.07],[1320,0.12,0.15],[880,0.08,0.3]],
        alert:          [[330,0.15,0],[330,0.15,0.18],[330,0.15,0.36],[523,0.25,0.55]],
        default:        [[660,0.07,0],[880,0.12,0.1]]
      };
      var notes = patterns[type] || patterns.default;
      notes.forEach(function(n){
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = (type === 'alert') ? 'sawtooth' : 'sine';
        osc.frequency.setValueAtTime(n[0], ctx.currentTime + n[2]);
        gain.gain.setValueAtTime(0, ctx.currentTime + n[2]);
        gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + n[2] + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n[2] + n[1]);
        osc.start(ctx.currentTime + n[2]);
        osc.stop(ctx.currentTime + n[2] + n[1] + 0.02);
      });
    }

    /* Déverrouiller l'AudioContext sur le premier geste utilisateur */
    function _unlockAudio(){
      _getAudioCtx();
      document.removeEventListener('touchstart', _unlockAudio, {passive:true});
      document.removeEventListener('click', _unlockAudio);
    }
    document.addEventListener('touchstart', _unlockAudio, {passive:true});
    document.addEventListener('click', _unlockAudio);

    /* ─────────────────────────────────────────────────────────────
       2. MISE À JOUR DES BADGES NAV
    ───────────────────────────────────────────────────────────── */
    function _setNavBadge(id, count){
      var el = document.getElementById(id);
      if(!el) return;
      if(count > 0){
        el.textContent = count > 99 ? '99+' : count > 9 ? '9+' : String(count);
        el.classList.add('show');
      } else {
        el.textContent = '';
        el.classList.remove('show');
      }
    }

    /* Efface le badge quand l'utilisateur ouvre la section */
    function _clearNavBadgeOnOpen(section, badgeId){
      var orig = window.switchSection;
      if(typeof orig !== 'function') return;
      window.switchSection = function(sec, btn){
        if(sec === section){ _setNavBadge(badgeId, 0); _COUNTS[badgeId] = 0; }
        return orig.apply(this, arguments);
      };
    }

    /* Compteurs courants par badge */
    var _COUNTS = {
      navBadgeForum:     0,
      navBadgeProfil:    0,
      navBadgePaiements: 0,
      navBadgeAdmin:     0
    };
    var _PREV_TOTAL = 0; /* pour détecter les nouvelles arrivées */

    /* ─────────────────────────────────────────────────────────────
       3. SOURCE A — notifications générales (LocalStorage + Firestore)
    ───────────────────────────────────────────────────────────── */
    function _syncFromNotifStore(){
      if(typeof loadNotifs !== 'function') return;
      var all = loadNotifs();
      var unread = all.filter(function(n){ return n.unread; });

      /* Classer par type de notification */
      var forum = 0, profil = 0, paiements = 0, admin = 0;
      unread.forEach(function(n){
        var k = (n.key||'').toLowerCase();
        var t = (n.type||'').toLowerCase();
        if(k.indexOf('message')!==-1 || k.indexOf('friend')!==-1 || k.indexOf('ami')!==-1
           || k.indexOf('community')!==-1 || k.indexOf('communaute')!==-1 || k.indexOf('forum')!==-1
           || k.indexOf('dm_')!==-1 || k.indexOf('call')!==-1 || k.indexOf('appel')!==-1){
          forum++;
        } else if(k.indexOf('paiement')!==-1 || k.indexOf('payment')!==-1 || k.indexOf('sub_')!==-1
                  || k.indexOf('abonnement')!==-1){
          paiements++;
        } else if(k.indexOf('admin')!==-1 || k.indexOf('super')!==-1){
          admin++;
        } else {
          profil++;
        }
      });

      var newTotal = unread.length;
      if(newTotal > _PREV_TOTAL){
        /* Déterminer le type du son à jouer selon la dernière notif */
        var last = unread[unread.length - 1] || {};
        var lk = (last.key||'').toLowerCase();
        var soundType = 'default';
        if(lk.indexOf('message')!==-1 || lk.indexOf('dm_')!==-1) soundType = 'message';
        else if(lk.indexOf('friend')!==-1 || lk.indexOf('ami')!==-1) soundType = 'friend_request';
        else if(lk.indexOf('paiement')!==-1 || lk.indexOf('payment')!==-1) soundType = 'paiement';
        else if(lk.indexOf('alert')!==-1 || lk.indexOf('urgent')!==-1) soundType = 'alert';
        playNotifSound(soundType);
      }
      _PREV_TOTAL = newTotal;

      _COUNTS.navBadgeForum     = forum;
      _COUNTS.navBadgeProfil    = profil;
      _COUNTS.navBadgePaiements = paiements;
      _COUNTS.navBadgeAdmin     = admin;
      _flushBadges();
    }

    /* ─────────────────────────────────────────────────────────────
       4. SOURCE B — demandes d'amis & DMs (section Forum)
    ───────────────────────────────────────────────────────────── */
    function _syncFromSocial(){
      var reqIn  = (window._requestsIn  || []).length;
      var dmEl   = document.getElementById('dmInboxBadge');
      var dmUnread = dmEl ? (parseInt(dmEl.textContent, 10) || 0) : 0;

      /* Injecter dans le badge Forum (cumulatif) */
      _COUNTS.navBadgeForum = reqIn + dmUnread; // valeur reelle, pas cumulative
      _flushBadges();
    }

    /* ─────────────────────────────────────────────────────────────
       5. SOURCE C — Firestore temps réel (user_notifications)
    ───────────────────────────────────────────────────────────── */
    var _fsUnsubNavBadge = null;
    function _startFirestoreListener(uid){
      if(_fsUnsubNavBadge) return; /* déjà actif */
      if(!window.db || !window.fbCollection || !window.fbQuery || !window.fbWhere || !window.fbOnSnapshot) return;

      try{
        var q = window.fbQuery(
          window.fbCollection(window.db, 'user_notifications'),
          window.fbWhere('toUID',  '==', uid),
          window.fbWhere('unread', '==', true)
        );
        _fsUnsubNavBadge = window.fbOnSnapshot(q, function(snap){
          var docs = snap ? snap.docs || [] : [];
          var forum = 0, profil = 0, paiements = 0, admin = 0;

          docs.forEach(function(d){
            var data = d.data ? d.data() : d;
            var k = ((data.key||data.type||'') + '').toLowerCase();
            if(k.indexOf('message')!==-1 || k.indexOf('friend')!==-1 || k.indexOf('ami')!==-1
               || k.indexOf('dm')!==-1 || k.indexOf('call')!==-1 || k.indexOf('communaute')!==-1){
              forum++;
            } else if(k.indexOf('paiement')!==-1 || k.indexOf('payment')!==-1 || k.indexOf('sub_')!==-1){
              paiements++;
            } else if(k.indexOf('admin')!==-1){
              admin++;
            } else {
              profil++;
            }
          });

          var total = docs.length;
          if(total > _PREV_TOTAL){
            playNotifSound('default');
          }
          _PREV_TOTAL = total;

          _COUNTS.navBadgeForum     = forum; // valeur reelle Firestore
          _COUNTS.navBadgeProfil    = profil;
          _COUNTS.navBadgePaiements = paiements;
          _COUNTS.navBadgeAdmin     = admin;
          _flushBadges(); /* badges mis à jour centralement dans _flushBadges */
        }, function(err){
          console.warn('[NavBadge] Firestore listener error:', err && err.code);
        });
      }catch(e){
        console.warn('[NavBadge] fbOnSnapshot unavailable:', e.message);
      }
    }

    /* ─────────────────────────────────────────────────────────────
       6. FLUSH — met à jour l'affichage de tous les badges
          + synchronise le badge sur l'icône de l'app (PWA)
    ───────────────────────────────────────────────────────────── */
    function _flushBadges(){
      Object.keys(_COUNTS).forEach(function(id){
        _setNavBadge(id, _COUNTS[id]);
      });

      /* ── Badge icône app Android/iOS (comme WhatsApp) ── */
      var totalBadge = (_COUNTS.navBadgeForum || 0)
                     + (_COUNTS.navBadgeProfil || 0)
                     + (_COUNTS.navBadgePaiements || 0)
                     + (_COUNTS.navBadgeAdmin || 0);

      /* ── Titre de l'onglet ── */
      var baseTitle = document.title.replace(/^\(\d+\)\s*/, '');
      document.title = totalBadge > 0 ? '(' + totalBadge + ') ' + baseTitle : baseTitle;
    }

    /* ─────────────────────────────────────────────────────────────
       6b. PERMISSION NOTIFICATION — demander au bon moment
    ─────────────────────────────────────────────────────────────── */

    /* ─────────────────────────────────────────────────────────────
       7. PATCH pushNotif — son immédiat à chaque push in-app
    ───────────────────────────────────────────────────────────── */
    var _origPushNotif = window.pushNotif;
    window.pushNotif = function(opts){
      var result = _origPushNotif ? _origPushNotif.apply(this, arguments) : undefined;
      /* Son selon le type */
      var k = (opts && (opts.key||opts.type) || '').toLowerCase();
      var s = 'default';
      if(k.indexOf('message')!==-1 || k.indexOf('dm_')!==-1) s = 'message';
      else if(k.indexOf('friend')!==-1 || k.indexOf('ami')!==-1) s = 'friend_request';
      else if(k.indexOf('paiement')!==-1 || k.indexOf('payment')!==-1) s = 'paiement';
      else if(k.indexOf('alert')!==-1 || k.indexOf('urgent')!==-1) s = 'alert';
      playNotifSound(s);
      /* Rafraîchir les badges */
      setTimeout(_syncFromNotifStore, 100);
      return result;
    };

    /* ─────────────────────────────────────────────────────────────
       8. PATCH updateBadges (social) — propager vers nav
    ───────────────────────────────────────────────────────────── */
    var _origUpdateBadges = window.updateBadges;
    window.updateBadges = function(){
      if(typeof _origUpdateBadges === 'function') _origUpdateBadges.apply(this, arguments);
      setTimeout(_syncFromSocial, 50);
    };

    /* ─────────────────────────────────────────────────────────────
       9. RÉINITIALISER badge quand l'utilisateur ouvre la section
    ───────────────────────────────────────────────────────────── */
    function _patchSwitchSection(){
      if(typeof window.switchSection !== 'function'){
        setTimeout(_patchSwitchSection, 400);
        return;
      }
      var _orig = window.switchSection;
      window.switchSection = function(sec, btn){
        var mapping = {
          social: 'navBadgeForum',
          profil: 'navBadgeProfil',
          paiements: 'navBadgePaiements'
        };
        if(mapping[sec]){
          _COUNTS[mapping[sec]] = 0;
          _setNavBadge(mapping[sec], 0);
        }
        return _orig.apply(this, arguments);
      };
    }

    /* ─────────────────────────────────────────────────────────────
       10. DÉMARRAGE — attendre Firebase + user connecté
    ───────────────────────────────────────────────────────────── */
    function _boot(){
      /* Lancer le polling LocalStorage immédiatement */
      _syncFromNotifStore();
      setInterval(_syncFromNotifStore, 5000);

      /* Patcher la navigation */
      _patchSwitchSection();

      /* Attendre la connexion utilisateur pour Firestore temps réel */
      var _watchUser = setInterval(function(){
        var uid = window.currentUserUID;
        if(uid){
          clearInterval(_watchUser);
          _startFirestoreListener(uid);
          _syncFromNotifStore();
          _syncFromSocial();
        }
      }, 800);

      /* MutationObserver sur dmInboxBadge pour détecter nouveaux DMs */
      var _dmObserverStarted = false;
      var _tryObserveDm = function(){
        var dmEl = document.getElementById('dmInboxBadge');
        if(dmEl && !_dmObserverStarted){
          _dmObserverStarted = true;
          var obs = new MutationObserver(function(){
            var n = parseInt(dmEl.textContent, 10) || 0;
            if(n > 0){
              playNotifSound('message');
              _COUNTS.navBadgeForum = n; // valeur directe DM
              _flushBadges();
            }
          });
          obs.observe(dmEl, {childList:true, characterData:true, subtree:true});
        } else if(!_dmObserverStarted){
          setTimeout(_tryObserveDm, 1500);
        }
      };
      setTimeout(_tryObserveDm, 2000);
    }

    if(document.readyState === 'loading'){
      document.addEventListener('DOMContentLoaded', function(){ setTimeout(_boot, 1500); });
    } else {
      setTimeout(_boot, 1500);
    }

    /* Exposer pour debug console */
    window._ambiNavBadge = {
      play: playNotifSound,
      sync: _syncFromNotifStore,
      set: _setNavBadge,
      counts: _COUNTS
    };
  })();
  