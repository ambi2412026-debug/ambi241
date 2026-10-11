// AMBI241 — notifications : badge icone, notifications live (amis / email), alerte auteur de commentaire Forum
(function () {
  'use strict';
  function logged() { var u = window.currentUserUID; return !!(u && String(u).indexOf('anon_') !== 0); }

  /* 1. Badge sur l'icone de l'app */
  function wrapBadge() {
    if (typeof window.renderNotifBadge !== 'function') return false;
    if (window.renderNotifBadge.__ab) return true;
    var orig = window.renderNotifBadge;
    var w = function () {
      var r = orig.apply(this, arguments);
      try {
        var list = (typeof window.loadNotifs === 'function') ? window.loadNotifs() : [];
        var n = list.filter(function (x) { return x && x.unread; }).length;
        if (navigator.setAppBadge) {
          if (n > 0) navigator.setAppBadge(n).catch(function () {});
          else if (navigator.clearAppBadge) navigator.clearAppBadge().catch(function () {});
        }
      } catch (e) {}
      return r;
    };
    w.__ab = true;
    window.renderNotifBadge = w;
    return true;
  }

  /* 2. Notifications live : toUID (amis) et targetEmail */
  var stops = [], polls = [], listenFor = '', seen = {};
  function stopAll() {
    stops.forEach(function (s) { try { s(); } catch (e) {} });
    polls.forEach(function (p) { clearInterval(p); });
    stops = []; polls = [];
  }
  function deliver(id, n) {
    try {
      if (typeof window.pushNotif === 'function') {
        window.pushNotif({
          targetRole: 'all',
          key: n.key || 'notif',
          icon: n.icon || '🔔',
          title: n.title || (n.type === 'friend_accepted' ? "Demande d'ami acceptée" : 'Notification'),
          msg: n.msg || '',
          channel: 'push',
          fromAdmin: true,
          fromAvatar: n.fromPhoto || n.fromAvatar || n.avatar || n.photo || '',
          fromName: n.fromPseudo || n.fromName || n.pseudo || '',
          fromUID: n.fromUID || n.fromUid || ''
        });
      }
    } catch (e) {}
    try {
      window.fbUpdateDoc(window.fbDoc(window.db, 'user_notifications', id), { unread: false, read: true }).catch(function () {});
    } catch (e) {}
  }
  function watch(field, value, flagField, flagValue, skipFirst, skipIf) {
    var col = window.fbCollection(window.db, 'user_notifications');
    var q = window.fbQuery(col, window.fbWhere(field, '==', value), window.fbWhere(flagField, '==', flagValue));
    var first = true;
    function handle(snap) {
      snap.forEach(function (ds) {
        var id = ds.id;
        if (seen[id]) return;
        var n = ds.data() || {};
        if (skipIf && skipIf(n)) return;
        seen[id] = 1;
        if (first && skipFirst) return;
        deliver(id, n);
      });
      first = false;
    }
    if (typeof window.fbOnSnapshot === 'function') {
      stops.push(window.fbOnSnapshot(q, handle, function () {}));
    } else if (window.fbGetDocs) {
      var run = function () { window.fbGetDocs(q).then(handle).catch(function () {}); };
      run();
      polls.push(setInterval(run, 60000));
    }
  }
  function startLive() {
    var uid = logged() ? window.currentUserUID : '';
    var key = uid ? uid + '|' + (window.currentUserEmail || '') : '';
    if (key === listenFor) return;
    stopAll();
    listenFor = key;
    seen = {};
    if (!uid) return;
    if (!(window.db && window.fbCollection && window.fbQuery && window.fbWhere && window.fbUpdateDoc && window.fbDoc)) { listenFor = ''; return; }
    try {
      watch('targetUid', uid, 'unread', true, true, null);
      watch('toUID', uid, 'read', false, false, null);
      if (window.currentUserEmail) {
        watch('targetEmail', window.currentUserEmail, 'unread', true, false, function (n) { return !!n.targetUid; });
      }
    } catch (e) { listenFor = ''; }
  }

  /* 3. Notifier l'auteur d'une publication du Forum quand on la commente */
  function notifyAuthor(pubId, text) {
    var me = window.currentUserUID;
    if (!logged()) return;
    if (!(window.fbGetDoc && window.fbDoc && window.fbAddDoc && window.fbCollection && window.db)) return;
    window.fbGetDoc(window.fbDoc(window.db, 'forum_publications', pubId)).then(function (snap) {
      if (!snap || !snap.exists()) return;
      var d = snap.data() || {};
      var to = d.authorUid || d.uid;
      if (!to || to === me || String(to).indexOf('anon_') === 0) return;
      var who = window.currentUserPseudo || 'Un membre';
      window.fbAddDoc(window.fbCollection(window.db, 'user_notifications'), {
        targetUid: to,
        fromUID: me,
        fromPseudo: who,
        fromPhoto: window.currentUserPhotoURL || '',
        icon: '💬',
        title: who + ' a commenté votre publication',
        msg: String(text).slice(0, 120),
        key: 'forum_comment',
        channel: 'push',
        unread: true,
        ts: Date.now()
      }).catch(function () {});
    }).catch(function () {});
  }
  function wrapComment() {
    if (typeof window.forumSendComment !== 'function') return false;
    if (window.forumSendComment.__nf) return true;
    var orig = window.forumSendComment;
    var w = function (pubId) {
      var inp = document.getElementById('fcmt_inp_' + pubId);
      var text = inp ? String(inp.value || '').trim() : '';
      var r = orig.apply(this, arguments);
      try { if (text) notifyAuthor(pubId, text); } catch (e) {}
      return r;
    };
    w.__nf = true;
    window.forumSendComment = w;
    return true;
  }

  var n = 0;
  var iv = setInterval(function () {
    var a = wrapBadge(), b = wrapComment();
    if ((a && b) || ++n > 60) clearInterval(iv);
  }, 500);
  setInterval(startLive, 2000);
})();
