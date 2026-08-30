
/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — Système de Présence Temps Réel — v3.0 PROFESSIONAL
   ───────────────────────────────────────────────────────────────────
   Architecture : Firebase Realtime Database (onDisconnect natif)
                  + Firestore /sessions fallback si RTDB indisponible
   ───────────────────────────────────────────────────────────────────
   Fonctionnement RTDB :
     1. À l'ouverture : écriture dans /presence/{sessionId} = { online: true, ... }
     2. onDisconnect().remove() : suppression GARANTIE par les serveurs Firebase
        même si l'onglet crash, réseau coupé, batterie morte
     3. onValue('/presence') : push WebSocket natif → compteur instantané
   ───────────────────────────────────────────────────────────────────
   Fonctionnement Firestore fallback :
     1. Écriture dans sessions/{sessionId} avec ts = Date.now()
     2. Heartbeat toutes les 45s pour maintenir la session vivante
     3. onSnapshot temps réel — filtre TTL 90s côté client
     4. beforeunload + visibilitychange : suppression proactive à la fermeture
   ═══════════════════════════════════════════════════════════════════ */

import { getDatabase, ref as rtdbRef, set as rtdbSet, remove as rtdbRemove,
         onValue, onDisconnect, serverTimestamp as rtdbServerTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-database.js';

import { collection, doc, setDoc, deleteDoc, onSnapshot, getDocs,
         serverTimestamp as fsServerTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';

(function () {
  'use strict';

  /* ── Constantes ── */
  var SESSION_TTL_MS   = 90 * 1000;   // Firestore fallback : session expirée après 90s
  var HEARTBEAT_MS     = 45 * 1000;   // Firestore fallback : heartbeat toutes les 45s
  var RTDB_PATH        = 'presence';  // Nœud RTDB : /presence/{sessionId}
  var FS_COLLECTION    = 'sessions';  // Collection Firestore fallback

  /* ── État du module ── */
  var _sessionId       = null;   // ID unique de cette session navigateur
  var _mode            = null;   // 'rtdb' | 'firestore'
  var _rtdbRef         = null;   // Référence RTDB de cette session
  var _heartbeatTimer  = null;   // Timer heartbeat Firestore
  var _unsub           = null;   // Unsubscribe du listener temps réel
  var _rtdbApp         = null;   // Instance RTDB
  var _destroyed       = false;  // Flag : session terminée

  /* ── Génération d'un sessionId stable (survit au refresh, unique par onglet) ── */
  function _makeSessionId() {
    /* Clé par onglet via sessionStorage — jamais partagée entre onglets */
    var key = 'ambi241_sid';
    var sid = sessionStorage.getItem(key);
    if (!sid) {
      var uid  = (window.currentUserUID || '');
      var rand = Math.random().toString(36).slice(2, 10);
      var time = Date.now().toString(36);
      sid = (uid ? uid.slice(0, 8) : 'anon') + '_' + time + '_' + rand;
      sessionStorage.setItem(key, sid);
    }
    return sid;
  }

  /* ── Métadonnées de la session (pour Status Live admin) ── */
  function _sessionMeta() {
    return {
      uid:       window.currentUserUID   || null,
      pseudo:    window.currentUserPseudo || window.currentUserEmail || 'Visiteur',
      role:      window.currentUserRole  || 'user',
      device:    /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      ts:        Date.now(),
      online:    true
    };
  }

  /* ══════════════════════════════════════════════════════════
     MODE A — Firebase Realtime Database (solution principale)
     ══════════════════════════════════════════════════════════ */

  function _initRTDB(app) {
    try {
      var db = getDatabase(app);
      _rtdbApp = db;

      var presRef  = rtdbRef(db, RTDB_PATH + '/' + _sessionId);
      _rtdbRef = presRef;

      /* Écriture de la session */
      rtdbSet(presRef, _sessionMeta()).catch(function (e) {
        console.warn('[AMBI241] RTDB write failed, switching to Firestore:', e.code);
        _initFirestore();
      });

      /* ⭐ onDisconnect : suppression garantie par les serveurs Firebase
         même si l'onglet est tué violemment (crash, killswitch OS, perte réseau) */
      onDisconnect(presRef).remove();

      /* Listener temps réel sur tout /presence — push WebSocket natif */
      var rootRef = rtdbRef(db, RTDB_PATH);
      _unsub = onValue(rootRef, function (snap) {
        var count = 0;
        var sessions = [];
        snap.forEach(function (child) {
          var data = child.val();
          if (data && data.online) {
            count++;
            sessions.push({ sid: child.key, pseudo: data.pseudo, role: data.role,
                            device: data.device, ts: data.ts, uid: data.uid });
          }
        });
        _updateCounter(count, sessions, 'rtdb');
      });

      /* Rafraîchir les métadonnées si l'utilisateur se connecte en cours de session */
      window.addEventListener('ambi241:userChanged', function () {
        if (!_destroyed && _rtdbRef) {
          rtdbSet(_rtdbRef, _sessionMeta()).catch(function(){});
        }
      });

      _mode = 'rtdb';
      console.log('[AMBI241] ✅ Présence RTDB initialisée (session:', _sessionId, ')');
    } catch (e) {
      console.warn('[AMBI241] RTDB non disponible, fallback Firestore:', e.message);
      _initFirestore();
    }
  }

  /* ══════════════════════════════════════════════════════════
     MODE B — Firestore /sessions (fallback robuste)
     ══════════════════════════════════════════════════════════ */

  function _initFirestore() {
    if (_mode === 'firestore' || _mode === 'rtdb') return; // déjà initialisé
    var fsDb = window.db;
    if (!fsDb) {
      /* Firestore pas encore prêt — attendre */
      setTimeout(_initFirestore, 800);
      return;
    }

    _mode = 'firestore';
    var sesRef = doc(fsDb, FS_COLLECTION, _sessionId);

    /* Écriture initiale */
    setDoc(sesRef, _sessionMeta()).catch(function(){});

    /* Heartbeat : maintient la session vivante */
    _heartbeatTimer = setInterval(function () {
      if (_destroyed) return;
      setDoc(sesRef, _sessionMeta()).catch(function(){});
    }, HEARTBEAT_MS);

    /* ══ QUOTA-FIX ═══════════════════════════════════════════════
       Avant : onSnapshot() sur TOUTE la collection "sessions" —
       comme Realtime Database n'est pas activé sur ce projet, ce
       mode de secours Firestore est celui qui tourne EN PERMANENCE
       pour chaque visiteur. Chaque heartbeat (toutes les 45s) de
       CHAQUE onglet ouvert déclenchait une relecture de la collection
       entière pour TOUS les autres onglets ouverts → même effet
       boule de neige que pour les établissements.
       Après : un getDocs() relancé toutes les POLL_MS, avec le même
       traitement et le même appel à _updateCounter(). */
    var SESSIONS_POLL_MS = 45000; // 45s — aligné sur le heartbeat
    try {
      var colRef = collection(fsDb, FS_COLLECTION);
      var fetchSessions = function() {
        getDocs(colRef).then(function (snap) {
          var now   = Date.now();
          var count = 0;
          var sessions = [];
          snap.forEach(function (d) {
            var data = d.data();
            /* Filtre TTL côté client : session considérée morte si ts > 90s */
            if (data && data.online && (now - (data.ts || 0)) < SESSION_TTL_MS) {
              count++;
              sessions.push({ sid: d.id, pseudo: data.pseudo, role: data.role,
                              device: data.device, ts: data.ts, uid: data.uid });
            }
          });
          _updateCounter(count, sessions, 'firestore');
        }).catch(function(e) {
          console.warn('[AMBI241] getDocs sessions error:', e.code);
          /* Permissions manquantes : fallback sur comptage _livePresences */
          _fallbackCount();
        });
      };
      fetchSessions(); // premier chargement immédiat
      _unsub = setInterval(fetchSessions, SESSIONS_POLL_MS);
    } catch(e) {
      _fallbackCount();
    }

    /* Nettoyage proactif à la fermeture de l'onglet */
    window.addEventListener('beforeunload', function () {
      _destroyed = true;
      /* deleteDoc synchrone best-effort — sendBeacon plus fiable que fetch */
      try {
        deleteDoc(sesRef).catch(function(){});
      } catch(e) {}
    });

    /* Nettoyage quand l'onglet passe en arrière-plan prolongé */
    document.addEventListener('visibilitychange', function () {
      if (document.hidden && _heartbeatTimer) {
        /* Onglet caché : on garde le heartbeat mais on ralentit à 2x TTL */
        clearInterval(_heartbeatTimer);
        _heartbeatTimer = setInterval(function() {
          if (!_destroyed) setDoc(sesRef, _sessionMeta()).catch(function(){});
        }, HEARTBEAT_MS * 2);
      } else if (!document.hidden && !_destroyed) {
        /* Retour au premier plan : heartbeat normal + mise à jour immédiate */
        clearInterval(_heartbeatTimer);
        setDoc(sesRef, _sessionMeta()).catch(function(){});
        _heartbeatTimer = setInterval(function() {
          if (!_destroyed) setDoc(sesRef, _sessionMeta()).catch(function(){});
        }, HEARTBEAT_MS);
      }
    });

    console.log('[AMBI241] ✅ Présence Firestore fallback initialisée (session:', _sessionId, ')');
  }

  /* ══════════════════════════════════════════════════════════
     FALLBACK ULTIME — Lecture _livePresences (déduplication)
     ══════════════════════════════════════════════════════════ */

  function _fallbackCount() {
    /* Déduplique tous les users présents dans n'importe quel établissement */
    var seen  = {};
    var total = 0;
    if (window._livePresences) {
      Object.values(window._livePresences).forEach(function (entry) {
        (entry.users || []).forEach(function (u) {
          var k = u.uid || u.email || u;
          if (k && !seen[k]) { seen[k] = true; total++; }
        });
        if (!(entry.users || []).length && entry.count > 0) total += entry.count;
      });
    }
    _updateCounter(total, [], 'fallback');
  }

  /* ══════════════════════════════════════════════════════════
     MISE À JOUR DU COMPTEUR DANS L'UI
     ══════════════════════════════════════════════════════════ */

  function _updateCounter(total, sessions, source) {
    /* Exposer pour le Status Live */
    window._onlineSessions = sessions;
    window._onlineCount    = total;
    window._onlineSource   = source;

    /* Dispatch pour autres composants (ex. Status Live tab) */
    window.dispatchEvent(new CustomEvent('ambi241:onlineCount', {
      detail: { count: total, sessions: sessions, source: source }
    }));

    /* ── Mettre à jour le bouton header admin ── */
    var el  = document.getElementById('admOnlineCount');
    var btn = document.getElementById('admOnlineBtn');
    if (!el) return;

    var prev = parseInt(el.getAttribute('data-prev') || '-1', 10);
    el.textContent = total;
    el.setAttribute('data-prev', String(total));

    /* ── Couleur sémantique selon affluence ── */
    var color, borderColor, shadow;
    if (total === 0) {
      color = 'rgba(0,255,170,0.35)'; borderColor = 'rgba(0,255,170,0.18)';
      shadow = 'none';
    } else if (total < 5) {
      color = '#00ffaa';  borderColor = 'rgba(0,255,170,0.45)';
      shadow = '0 0 8px rgba(0,255,170,0.3)';
    } else if (total < 20) {
      color = '#ffd700';  borderColor = 'rgba(255,215,0,0.5)';
      shadow = '0 0 10px rgba(255,215,0,0.35)';
    } else if (total < 50) {
      color = '#ff9500';  borderColor = 'rgba(255,149,0,0.5)';
      shadow = '0 0 12px rgba(255,149,0,0.4)';
    } else {
      color = '#ff2d9b';  borderColor = 'rgba(255,45,155,0.6)';
      shadow = '0 0 14px rgba(255,45,155,0.45)';
    }

    el.style.color       = color;
    el.style.borderColor = borderColor;
    el.style.boxShadow   = shadow;
    if (btn) {
      btn.style.borderColor = borderColor;
      btn.style.boxShadow   = '0 0 12px rgba(0,255,170,0.15), ' + shadow;
    }

    /* ── Flash d'animation si le nombre change ── */
    if (prev >= 0 && prev !== total) {
      var isUp = total > prev;
      el.style.transform  = 'scale(1.35)';
      el.style.background = isUp
        ? 'rgba(0,255,170,0.38)'
        : 'rgba(255,45,155,0.22)';
      el.style.transition = 'all 0.15s ease-out';
      setTimeout(function () {
        el.style.transform  = 'scale(1)';
        el.style.background = 'rgba(0,255,170,0.18)';
        el.style.transition = 'all 0.4s ease';
      }, 280);

      /* Badge tooltip si changement significatif */
      if (Math.abs(total - prev) >= 1 && prev >= 0) {
        _showCounterPulse(el, isUp, total - prev);
      }
    }

    /* ── Indicateur de source (RTDB/Firestore/fallback) ── */
    if (btn) {
      var srcDot = btn.querySelector('.adm-src-dot');
      if (!srcDot) {
        srcDot = document.createElement('span');
        srcDot.className = 'adm-src-dot';
        srcDot.style.cssText = 'width:4px;height:4px;border-radius:50%;flex-shrink:0;margin-left:2px;opacity:0.6;';
        var liveLabel = btn.querySelector('[style*="LIVE"]') || btn.firstChild;
        if (liveLabel && liveLabel.parentNode) {
          btn.appendChild(srcDot);
        }
      }
      /* Vert = RTDB (temps réel parfait) | Cyan = Firestore | Jaune = fallback */
      srcDot.style.background = source === 'rtdb' ? '#00ffaa'
                               : source === 'firestore' ? '#00e5ff'
                               : '#ffd700';
      srcDot.title = source === 'rtdb'       ? 'Realtime Database — temps réel natif'
                   : source === 'firestore'  ? 'Firestore — temps réel (heartbeat 45s)'
                   : 'Mode dégradé — estimé';
    }
  }

  /* ── Micro-animation : badge delta (+N / -N) ── */
  function _showCounterPulse(el, isUp, delta) {
    var badge = document.createElement('span');
    badge.textContent = (isUp ? '+' : '') + delta;
    badge.style.cssText = [
      'position:absolute',
      'top:-14px',
      'left:50%',
      'transform:translateX(-50%) translateY(0)',
      'font-family:Syne,sans-serif',
      'font-size:0.55rem',
      'font-weight:900',
      'color:' + (isUp ? '#00ffaa' : '#ff4466'),
      'pointer-events:none',
      'white-space:nowrap',
      'opacity:1',
      'transition:all 0.7s ease-out',
      'z-index:9999'
    ].join(';');

    var wrap = el.parentNode || el;
    var wStyle = window.getComputedStyle(wrap);
    if (wStyle.position === 'static') wrap.style.position = 'relative';
    wrap.appendChild(badge);

    requestAnimationFrame(function () {
      badge.style.transform  = 'translateX(-50%) translateY(-12px)';
      badge.style.opacity    = '0';
    });
    setTimeout(function () { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 800);
  }

  /* ══════════════════════════════════════════════════════════
     INITIALISATION — séquence de boot
     ══════════════════════════════════════════════════════════ */

  function _boot() {
    _sessionId = _makeSessionId();

    /* Attendre que Firebase app soit initialisée */
    var _waitFirebase = function () {
      if (window.__firebaseReady && window.db && window.__firebaseApp) {
        _startRTDB(window.__firebaseApp);
      } else if (window.__firebaseReady && window.db) {
        import('https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js')
          .then(function(m) {
            var fbApp = m.getApp();
            window.__firebaseApp = fbApp;
            _startRTDB(fbApp);
          })
          .catch(function() { _initFirestore(); });
      } else {
        setTimeout(_waitFirebase, 300);
      }
    };

    var _startRTDB = function(fbApp) {
      try {
        var rtdb = getDatabase(fbApp);
        window._rtdb = rtdb; /* exposé pour debug console */

        /* .info/connected : nœud spécial Firebase indiquant la connexion WebSocket */
        var connRef = rtdbRef(rtdb, '.info/connected');
        var _connUnsub = onValue(connRef, function(snap) {
          _connUnsub(); /* écouter une seule fois pour le boot */
          if (snap.val() === true) {
            console.info('[AMBI241] RTDB connecté ✅');
            _initRTDB(fbApp);
          } else {
            console.info('[AMBI241] RTDB hors ligne, fallback Firestore');
            _initFirestore();
          }
        }, function(err) {
          console.warn('[AMBI241] RTDB erreur (' + (err.code || err.message) + '), fallback Firestore');
          _initFirestore();
        });

        /* Timeout sécurité 4s : si pas de réponse RTDB → Firestore */
        setTimeout(function() {
          if (_mode === null) {
            console.info('[AMBI241] RTDB timeout 4s, fallback Firestore');
            _connUnsub();
            _initFirestore();
          }
        }, 4000);

      } catch(e) {
        console.warn('[AMBI241] getDatabase() échoué:', e.message);
        _initFirestore();
      }
    };

    _waitFirebase();
  }

  /* ══════════════════════════════════════════════════════════
     HOOKS : ouverture / fermeture du dashboard admin
     ══════════════════════════════════════════════════════════ */

  /* Patch openAdminDashboard — forcer un refresh du compteur à l'ouverture */
  var _origOpen = window.openAdminDashboard;
  window.openAdminDashboard = function (btn) {
    if (typeof _origOpen === 'function') _origOpen(btn);
    /* Afficher immédiatement la valeur en cache */
    if (typeof window._onlineCount === 'number') {
      _updateCounter(window._onlineCount, window._onlineSessions || [], window._onlineSource || 'cache');
    }
  };

  /* Exposer pour usage externe (Status Live tab) */
  window.admGetOnlineSessions = function () { return window._onlineSessions || []; };
  window.admGetOnlineCount    = function () { return window._onlineCount    || 0; };
  window.admGetOnlineSource   = function () { return window._onlineSource   || 'unknown'; };

  /* ── Démarrage ── */
  _boot();

})();
