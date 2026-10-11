// AMBI241 — suggestions : memoriser par compte les demandes d'amis deja envoyees
(function () {
  'use strict';
  var cache = {}, cacheFor = '', seen = {}, remoteFor = '';
  function uid() { var u = window.currentUserUID; return (u && String(u).indexOf('anon_') !== 0) ? u : ''; }
  function lsKey() { return 'ambi241_reqout_' + cacheFor; }
  function load() {
    var u = uid();
    if (!u) return null;
    if (cacheFor !== u) {
      cacheFor = u; seen = {}; remoteFor = '';
      try { cache = JSON.parse(localStorage.getItem(lsKey()) || '{}') || {}; } catch (e) { cache = {}; }
    }
    return cache;
  }
  function save() { try { localStorage.setItem(lsKey(), JSON.stringify(cache)); } catch (e) {} }
  function rerender() { try { if (typeof renderSuggestions === 'function') renderSuggestions(); } catch (e) {} }
  window.__ambiReqOutHas = function (x) { var c = load(); return !!(c && c[x]); };

  function curOut() {
    try { return (typeof _requestsOut !== 'undefined' && _requestsOut) ? _requestsOut : null; } catch (e) { return null; }
  }
  function fetchRemote() {
    var u = uid();
    if (!u || remoteFor === u) return;
    if (!(window.db && window.fbCollection && window.fbGetDocs)) return;
    remoteFor = u;
    rerender();
    window.fbGetDocs(window.fbCollection(window.db, 'users', u, 'friend_requests_out')).then(function (snap) {
      if (uid() !== u) return;
      var ch = false;
      snap.forEach(function (d) { if (!cache[d.id]) { cache[d.id] = 1; ch = true; } });
      if (ch) { save(); rerender(); }
    }).catch(function () {});
  }
  function reconcile() {
    var c = load(); if (!c) return;
    var out = curOut(); if (!out) return;
    var now = Date.now(), ch = false, present = {};
    out.forEach(function (r) {
      if (!r || !r.uid) return;
      present[r.uid] = 1;
      if (!seen[r.uid]) seen[r.uid] = now;
      if (!c[r.uid]) { c[r.uid] = 1; ch = true; }
    });
    Object.keys(seen).forEach(function (k) {
      if (present[k]) return;
      if (now - seen[k] < 15000) return;
      delete seen[k];
      if (c[k]) { delete c[k]; ch = true; }
    });
    if (ch) { save(); rerender(); }
  }
  function wrapAdd() {
    if (typeof window.quickAddFriend !== 'function') return false;
    if (window.quickAddFriend.__rm) return true;
    var orig = window.quickAddFriend;
    var w = function () {
      var r = orig.apply(this, arguments);
      try { reconcile(); } catch (e) {}
      return r;
    };
    w.__rm = true;
    window.quickAddFriend = w;
    return true;
  }
  var k = 0;
  var iv = setInterval(function () { if (wrapAdd() || ++k > 60) clearInterval(iv); }, 500);
  setInterval(function () { fetchRemote(); reconcile(); }, 1500);
})();
