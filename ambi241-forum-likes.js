// AMBI241 — Forum : alias fbIncrement (compteurs j'aime/commentaires) + j'aime memorises par utilisateur
(function () {
  'use strict';
  function uid() { var u = window.currentUserUID; return (u && String(u).indexOf('anon_') !== 0) ? u : ''; }
  function key() { return 'ambi241_forum_likes_' + uid(); }
  var set = {}, loadedFor = '';
  function loadLocal() { try { set = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { set = {}; } }
  function saveLocal() { try { localStorage.setItem(key(), JSON.stringify(set)); } catch (e) {} }
  function resetMarks() {
    document.querySelectorAll('[id^="flike_"]').forEach(function (b) { b.removeAttribute('data-lkr'); });
  }
  function loadRemote() {
    if (!(window.db && window.fbCollection && window.fbQuery && window.fbWhere && window.fbGetDocs)) return;
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, 'forum_likes'), window.fbWhere('uid', '==', uid())))
      .then(function (s) {
        s.forEach(function (d) { var x = d.data() || {}; if (x.pubId) set[x.pubId] = 1; });
        saveLocal(); resetMarks();
      }).catch(function () {});
  }
  function sync() {
    if (!window.fbIncrement && window.fbFieldIncrement) window.fbIncrement = window.fbFieldIncrement;
    var u = uid();
    if (!u) { loadedFor = ''; return; }
    if (loadedFor !== u) { loadedFor = u; loadLocal(); loadRemote(); }
    document.querySelectorAll('[id^="flike_"]').forEach(function (b) {
      if (b.getAttribute('data-lkr')) return;
      b.setAttribute('data-lkr', '1');
      if (set[b.id.slice(6)]) b.classList.add('liked');
    });
  }
  function wrap() {
    if (typeof window.forumToggleLike !== 'function') return false;
    if (window.forumToggleLike.__lk) return true;
    var orig = window.forumToggleLike;
    var w = function (id, btn) {
      var r = orig.apply(this, arguments);
      try {
        if (!uid() || !btn) return r;
        var liked = btn.classList.contains('liked');
        if (liked) set[id] = 1; else delete set[id];
        saveLocal();
        if (window.db && window.fbDoc) {
          var ref = window.fbDoc(window.db, 'forum_likes', id + '_' + uid());
          if (liked && window.fbSetDoc) window.fbSetDoc(ref, { uid: uid(), pubId: id, ts: Date.now() }).catch(function () {});
          else if (!liked && window.fbDeleteDoc) window.fbDeleteDoc(ref).catch(function () {});
        }
      } catch (e) {}
      return r;
    };
    w.__lk = true;
    window.forumToggleLike = w;
    return true;
  }
  var k = 0;
  var iv = setInterval(function () { if (wrap() || ++k > 60) clearInterval(iv); }, 500);
  setInterval(sync, 1500);
  sync();
})();
