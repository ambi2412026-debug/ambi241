// AMBI241 — Forum : compteur de commentaires reel (compte la sous-collection)
(function () {
  'use strict';
  var busy = 0;
  function sync() {
    if (!window.db || !window.fbGetDocs || !window.fbCollection) return;
    var els = document.querySelectorAll('[id^="fcmt_count_"]:not([data-real])');
    for (var i = 0; i < els.length && busy < 4; i++) {
      (function (el) {
        var id = el.id.replace('fcmt_count_', '');
        if (!id) return;
        el.setAttribute('data-real', '1');
        busy++;
        var col = window.fbCollection(window.db, 'forum_publications', id, 'comments');
        var q = (window.fbQuery && window.fbLimit) ? window.fbQuery(col, window.fbLimit(100)) : col;
        window.fbGetDocs(q).then(function (snap) {
          el.textContent = snap.size >= 100 ? '99+' : String(snap.size);
        }).catch(function () {}).then(function () { busy--; });
      })(els[i]);
    }
  }
  setInterval(sync, 2000);
})();
