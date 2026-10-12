// AMBI241 — Forum : j'aime fiables (v2)
// - 1 j'aime par utilisateur et par publication : document forum_likes/{pubId}_{uid} (source de verite)
// - compteur partage forum_publications.likes mis a jour dans la MEME transaction (atomique, jamais sous 0)
// - mise a jour en temps reel : les j'aime des autres utilisateurs s'ajoutent au meme decompte
// - echec Firestore = retour arriere visible + message (plus d'echec silencieux qui "redescend" au rechargement)
(function () {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js';
  var LIVE_LIMIT = 40;           // publications suivies en temps reel (les plus recentes)
  var fs = null;                 // module Firestore (meme instance que firebase-core.js)
  var set = {};                  // pubId -> 1 : publications aimees par l'utilisateur courant
  var loadedFor = '';            // uid pour lequel `set` est charge
  var pending = {};              // pubId -> true pendant une ecriture en cours
  var buf = {};                  // pubId -> valeurs recues en direct pendant l'ecriture (rejouees ensuite, dans l'ordre)
  var live = null;               // ecoute temps reel (desabonnement) ou 'starting'

  /* ---------- utilitaires ---------- */
  function uid() { var u = window.currentUserUID; return (u && String(u).indexOf('anon_') !== 0) ? u : ''; }
  function key() { return 'ambi241_forum_likes_' + uid(); }
  function toast(m) { try { if (typeof window.showToast === 'function') window.showToast(m); } catch (e) {} }
  function loadSdk() { return fs ? Promise.resolve(fs) : import(SDK).then(function (m) { fs = m; return m; }); }
  function loadLocal() { try { set = JSON.parse(localStorage.getItem(key()) || '{}') || {}; } catch (e) { set = {}; } }
  function saveLocal() { try { localStorage.setItem(key(), JSON.stringify(set)); } catch (e) {} }

  function btnOf(id) { return document.getElementById('flike_' + id); }
  function countEl(id) { return document.querySelector('#flike_' + id + ' .flike-count'); }
  function readCount(id) { var e = countEl(id); return e ? (parseInt(e.textContent, 10) || 0) : 0; }
  function paintCount(id, n) { var e = countEl(id); if (e) e.textContent = String(Math.max(0, n | 0)); }
  function paintLiked(id, liked) { var b = btnOf(id); if (b) b.classList[liked ? 'add' : 'remove']('liked'); }

  /* alias attendu par les compteurs de commentaires (part43.js) */
  function aliasIncrement() { if (!window.fbIncrement && window.fbFieldIncrement) window.fbIncrement = window.fbFieldIncrement; }

  /* ---------- etat "aime" de l'utilisateur ---------- */
  function markAll() {
    var u = uid();
    var list = document.querySelectorAll('[id^="flike_"]');
    if (!u) {                                             // deconnecte : aucun coeur ne doit rester allume
      loadedFor = ''; set = {};
      for (var j = 0; j < list.length; j++) list[j].classList.remove('liked');
      return;
    }
    if (loadedFor !== u) { loadedFor = u; loadLocal(); loadRemote(); }
    for (var i = 0; i < list.length; i++) {
      var id = list[i].id.slice(6);
      if (!pending[id]) list[i].classList[set[id] ? 'add' : 'remove']('liked');
    }
  }

  function loadRemote() {
    var u = uid();
    if (!u || !(window.db && window.fbCollection && window.fbQuery && window.fbWhere && window.fbGetDocs)) return;
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, 'forum_likes'), window.fbWhere('uid', '==', u)))
      .then(function (s) {
        if (uid() !== u) return;
        var fresh = {};
        s.forEach(function (d) { var x = d.data() || {}; if (x.pubId) fresh[x.pubId] = 1; });
        set = fresh;                    // le serveur fait foi (un j'aime retire ailleurs disparait ici)
        saveLocal(); markAll();
      })
      .catch(function (e) { console.warn('[AMBI241 likes] lecture forum_likes refusee :', e && e.code); });
  }

  /* ---------- ecriture atomique ---------- */
  function commit(id, want) {
    var u = uid();
    return loadSdk().then(function (m) {
      var pubRef = m.doc(window.db, 'forum_publications', id);
      var likeRef = m.doc(window.db, 'forum_likes', id + '_' + u);
      return m.runTransaction(window.db, function (tx) {
        return Promise.all([tx.get(pubRef), tx.get(likeRef)]).then(function (r) {
          if (!r[0].exists()) { var err = new Error('pub-missing'); err.code = 'pub-missing'; throw err; }
          var cur = Math.max(0, Number(r[0].data().likes) || 0);
          var has = r[1].exists();
          var out = { liked: has, likes: cur, changed: false };
          if (want && !has) {
            out = { liked: true, likes: cur + 1, changed: true };
            tx.set(likeRef, { uid: u, pubId: id, ts: Date.now() });
            tx.update(pubRef, { likes: out.likes });
          } else if (!want && has) {
            out = { liked: false, likes: Math.max(0, cur - 1), changed: true };
            tx.delete(likeRef);
            tx.update(pubRef, { likes: out.likes });
          }
          return out;
        });
      });
    });
  }

  function explain(e) {
    var c = e && e.code;
    if (c === 'permission-denied') return "❌ J'aime non enregistré : permission refusée (règles Firestore à autoriser)";
    if (c === 'pub-missing') return "⚠️ Cette publication n'existe plus";
    if (c === 'unavailable' || (typeof navigator !== 'undefined' && navigator.onLine === false)) return "📡 Pas de connexion : j'aime non enregistré";
    return "❌ J'aime non enregistré (" + String(c || (e && e.message) || "?").slice(0,80) + ")";
  }

  /* valeur a afficher apres notre ecriture : si d'autres j'aime sont arrives APRES le notre, c'est le plus recent qui gagne */
  function settled(id, mine) {
    var b = buf[id] || []; delete buf[id];
    var i = b.lastIndexOf(mine);
    return (i !== -1 && i < b.length - 1) ? b[b.length - 1] : mine;
  }

  function toggle(id, btn) {
    if (!btn) return Promise.resolve(null);
    if (!uid()) { toast('🔒 Connectez-vous pour liker'); return Promise.resolve(null); }
    if (pending[id]) return Promise.resolve(null);       // un seul clic a la fois par publication
    var wasLiked = btn.classList.contains('liked') || !!set[id];
    var want = !wasLiked;
    var before = readCount(id);
    pending[id] = true;
    paintLiked(id, want);                                 // retour visuel immediat
    paintCount(id, before + (want ? 1 : -1));
    return commit(id, want).then(function (res) {
      delete pending[id];
      if (res.liked) set[id] = 1; else delete set[id];
      saveLocal();
      paintLiked(id, res.liked);
      paintCount(id, settled(id, res.likes));             // valeur serveur = decompte commun (avec les j'aime des autres arrives entre-temps)
      return res;
    }).catch(function (e) {
      delete pending[id];
      var b = buf[id]; delete buf[id];
      paintLiked(id, wasLiked);                           // retour arriere : rien ne ment a l'ecran
      paintCount(id, b && b.length ? b[b.length - 1] : before);
      console.warn('[AMBI241 likes] echec :', e && (e.code || e.message), e);
      toast(explain(e));
      return null;
    });
  }

  var installed = false;                                  // une seule installation : ne jamais re-envelopper (ambi241-forum-social.js enveloppe cette fonction)
  function install() {
    aliasIncrement();
    if (installed) return true;
    if (typeof window.forumToggleLike !== 'function') return false;
    var f = function (id, btn) { return toggle(id, btn); };
    f.__lk2 = true;
    window.forumToggleLike = f;
    installed = true;
    return true;
  }

  /* ---------- decompte commun en temps reel ---------- */
  function startLive() {
    if (live || !(window.db && window.fbCollection && window.fbQuery && window.fbOrderBy && window.fbLimit)) return;
    live = 'starting';
    loadSdk().then(function (m) {
      var q = window.fbQuery(window.fbCollection(window.db, 'forum_publications'), window.fbOrderBy('timestamp', 'desc'), window.fbLimit(LIVE_LIMIT));
      live = m.onSnapshot(q, function (snap) {
        snap.docChanges().forEach(function (c) {
          if (c.type === 'removed') return;
          var id = c.doc.id;
          var n = Number((c.doc.data() || {}).likes);
          if (!isFinite(n)) return;
          if (pending[id]) { (buf[id] = buf[id] || []).push(Math.max(0, n)); return; }   // ne pas ecraser un clic en cours
          if (countEl(id)) paintCount(id, n);
        });
      }, function (e) { console.warn('[AMBI241 likes] temps reel indisponible :', e && e.code); live = null; });
    }).catch(function () { live = null; });
  }

  /* ---------- demarrage ---------- */
  var tries = 0;
  var iv = setInterval(function () { aliasIncrement(); startLive(); if (install() || ++tries > 120) clearInterval(iv); }, 500);
  var timer = null;
  function schedule() { if (timer) return; timer = setTimeout(function () { timer = null; markAll(); }, 120); }
  try { new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  setInterval(function () { aliasIncrement(); startLive(); markAll(); }, 2500);
  install(); markAll(); startLive();

  window.AmbiLikes = { version: 2, toggle: toggle, state: function () { return { liked: Object.keys(set), pending: Object.keys(pending), live: !!live }; } };
})();
