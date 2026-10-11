// AMBI241 — j'aime : notification a l'auteur + compteur persistant j'aime/commentaires non vus (badge Forum)
(function () {
  'use strict';
  function logged() { var u = window.currentUserUID; return !!(u && String(u).indexOf('anon_') !== 0); }
  function lsKey() { return 'ambi241_forum_seen_' + window.currentUserUID; }
  function getSeen() { try { return parseInt(localStorage.getItem(lsKey()), 10) || 0; } catch (e) { return 0; } }
  function setSeen(t) { try { localStorage.setItem(lsKey(), String(t)); } catch (e) {} }

  /* 1. Notification a l'auteur quand on aime sa publication */
  function authorOf(pubId) {
    var el = document.querySelector('[data-pub-id="' + pubId + '"]');
    var u = el && el.getAttribute('data-author-uid');
    if (u) return Promise.resolve(u);
    return window.fbGetDoc(window.fbDoc(window.db, 'forum_publications', pubId)).then(function (s) {
      var d = (s && s.exists()) ? s.data() : {};
      return d.authorUid || d.uid || '';
    });
  }
  function notifyLike(pubId) {
    var me = window.currentUserUID;
    if (!logged()) return;
    if (!(window.db && window.fbDoc && window.fbGetDoc && window.fbSetDoc)) return;
    authorOf(pubId).then(function (to) {
      if (!to || to === me || String(to).indexOf('anon_') === 0) return;
      var ref = window.fbDoc(window.db, 'user_notifications', 'like_' + pubId + '_' + me);
      return window.fbGetDoc(ref).then(function (s) {
        if (s && s.exists()) return;
        var who = window.currentUserPseudo || 'Un membre';
        return window.fbSetDoc(ref, {
          targetUid: to,
          fromUID: me,
          fromName: who,
          fromAvatar: window.currentUserPhotoURL || '',
          icon: '\u2764\uFE0F',
          title: who + ' a aim\u00e9 votre publication',
          msg: '',
          key: 'forum_like',
          channel: 'push',
          unread: true,
          ts: Date.now()
        });
      });
    }).catch(function () {});
  }
  function wrapLike() {
    if (typeof window.forumToggleLike !== 'function') return false;
    if (window.forumToggleLike.__nl) return true;
    var orig = window.forumToggleLike;
    var w = function (id, btn) {
      var r = orig.apply(this, arguments);
      try { if (btn && btn.classList.contains('liked')) notifyLike(id); } catch (e) {}
      return r;
    };
    w.__nl = true;
    window.forumToggleLike = w;
    return true;
  }

  /* 2. Compteur persistant : j'aime + commentaires recus depuis la derniere ouverture du Forum */
  var unsub = null, listenFor = '', docs = [];
  function recount() {
    var seen = getSeen(), n = 0;
    docs.forEach(function (d) {
      if ((d.key === 'forum_like' || d.key === 'forum_comment') && (d.ts || 0) > seen) n++;
    });
    window.__ambiSocialUnread = n;
  }
  function startCount() {
    var uid = logged() ? window.currentUserUID : '';
    if (uid === listenFor) return;
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    listenFor = uid; docs = []; window.__ambiSocialUnread = 0;
    if (!uid) return;
    if (!(window.db && window.fbCollection && window.fbQuery && window.fbWhere && window.fbOnSnapshot)) { listenFor = ''; return; }
    if (!getSeen()) setSeen(Date.now());
    try {
      var q = window.fbQuery(window.fbCollection(window.db, 'user_notifications'), window.fbWhere('targetUid', '==', uid));
      unsub = window.fbOnSnapshot(q, function (snap) {
        docs = [];
        snap.forEach(function (ds) { var d = ds.data() || {}; docs.push({ key: d.key, ts: d.ts }); });
        recount();
      }, function () {});
    } catch (e) { listenFor = ''; }
  }

  /* 3. Ouverture du Forum = tout est vu */
  function wrapSwitch() {
    if (typeof window.switchSection !== 'function') return false;
    if (window.switchSection.__fs) return true;
    var orig = window.switchSection;
    var w = function (sec) {
      try { if (sec === 'social' && logged()) { setSeen(Date.now()); window.__ambiSocialUnread = 0; } } catch (e) {}
      return orig.apply(this, arguments);
    };
    w.__fs = true;
    window.switchSection = w;
    return true;
  }

  var k = 0;
  var iv = setInterval(function () {
    var a = wrapLike(), b = wrapSwitch();
    if ((a && b) || ++k > 60) clearInterval(iv);
  }, 500);
  setInterval(startCount, 2000);
})();
