// AMBI241 — diagnostic : affiche un toast si l'ecriture/lecture friend_requests_out echoue
(function () {
  'use strict';
  function toast(m) { try { if (typeof socToast === 'function') socToast(m); } catch (e) {} }
  var done = '';
  function check() {
    var u = window.currentUserUID;
    if (!u || String(u).indexOf('anon_') === 0 || done === u) return;
    if (!(window.db && window.fbCollection && window.fbGetDocs)) return;
    done = u;
    window.fbGetDocs(window.fbCollection(window.db, 'users', u, 'friend_requests_out'))
      .then(function (s) { toast('Diag demandes envoyees : ' + s.size + ' trouvee(s) dans Firestore'); })
      .catch(function (e) { toast('Diag : lecture refusee (' + (e && e.code) + ')'); });
  }
  setInterval(check, 2000);
})();
