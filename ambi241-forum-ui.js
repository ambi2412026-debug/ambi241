// AMBI241 — Forum : 4 onglets (Fil, Messages, Amis, Communautés)
// - Fil : le mur de publications (forumPubSection déplacé, contenu intact)
// - Messages : liste des discussions privées
// - Amis : suggestions, liste d'amis, et section « Demandes d'amis » repliable
// - Communautés : avec raccourcis Projets / Bloqués
// Les éléments tabBadgeReq, requestsIn, requestsOut, forumFeed, forumComposeBar gardent leur identifiant.
(function () {
  'use strict';

  var TABS_KEY = { fil: 'fil', publications: 'fil', messages: 'messages', amis: 'amis', demandes: 'amis', communautes: 'communautes', projets: 'communautes', bloques: 'communautes' };
  var convs = [];
  var unsub = null;
  var startedFor = '';
  var reqOpened = false;

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function meUID() { var u = window.currentUserUID; return (u && String(u).indexOf('anon_') !== 0) ? u : ''; }

  function loadCss() {
    if (document.getElementById('ambi241ForumUiCss')) return;
    var l = document.createElement('link');
    l.id = 'ambi241ForumUiCss'; l.rel = 'stylesheet'; l.href = 'ambi241-forum-ui.css?v=2';
    document.head.appendChild(l);
  }

  function setLabel(tab, label) {
    var n = tab.firstChild;
    while (n && n.nodeType !== 3) n = n.nextSibling;
    if (n) n.nodeValue = label + ' '; else tab.insertBefore(document.createTextNode(label + ' '), tab.firstChild);
  }

  function mkTab(key, label, extra) {
    var t = document.createElement('div');
    t.className = 'soc-tab'; t.setAttribute('data-tab', key);
    t.setAttribute('onclick', "socSwitchTab('" + key + "')");
    t.innerHTML = label + (extra || '');
    return t;
  }

  function buildUi() {
    var tabs = document.querySelector('#sec-social .soc-tabs');
    var paneAmis = document.getElementById('pane-amis');
    if (!tabs || !paneAmis) return false;
    if (document.getElementById('pane-fil')) return true;

    // 1. clés + libellés des onglets existants
    var amisTab = null;
    Array.prototype.forEach.call(tabs.querySelectorAll('.soc-tab'), function (t) {
      var m = /socSwitchTab\('([a-z]+)'\)/.exec(t.getAttribute('onclick') || '');
      if (!m) return;
      t.setAttribute('data-tab', m[1]);
      t.classList.remove('active');
      if (m[1] === 'amis') { amisTab = t; setLabel(t, 'Amis'); }
      else if (m[1] === 'communautes') setLabel(t, 'Communautés');
      else if (m[1] === 'demandes' || m[1] === 'projets' || m[1] === 'bloques') t.classList.add('soc-tab-ghost');
    });
    if (!amisTab) return false;

    // 2. nouveaux onglets, placés avant Amis
    var tFil = mkTab('fil', 'Fil');
    var tMsg = mkTab('messages', 'Messages', '<span class="soc-tab-badge" id="tabBadgeMsg" style="display:none">0</span>');
    tabs.insertBefore(tFil, amisTab);
    tabs.insertBefore(tMsg, amisTab);
    tFil.classList.add('active');

    // 3. volet Fil : on y déplace le mur de publications
    var pf = document.createElement('div');
    pf.className = 'soc-pane active'; pf.id = 'pane-fil';
    var wall = document.getElementById('forumPubSection');
    if (wall) {
      var sep = wall.nextElementSibling;
      if (sep && sep.style && sep.style.height === '1px') sep.style.display = 'none';
      pf.appendChild(wall);
    }
    paneAmis.parentNode.insertBefore(pf, paneAmis);
    paneAmis.classList.remove('active');

    // 4. volet Messages
    var pm = document.createElement('div');
    pm.className = 'soc-pane'; pm.id = 'pane-messages';
    pm.innerHTML = '<div id="msgList"></div>';
    paneAmis.parentNode.insertBefore(pm, paneAmis);
    pm.querySelector('#msgList').addEventListener('click', function (e) {
      var row = e.target.closest ? e.target.closest('.msg-row') : null;
      if (!row || typeof window.openDM !== 'function') return;
      var uid = row.getAttribute('data-uid');
      if (!uid) return;
      var pe = findPerson(uid);
      window._dmPeerHint = { uid: uid, name: pe.name || 'Membre', avatar: pe.avatar || '' };
      window.openDM(uid);
    });

    // 5. section « Demandes d'amis » en tête du volet Amis (les nœuds sont déplacés, pas copiés)
    var pd = document.getElementById('pane-demandes');
    if (pd && !document.getElementById('amisReqBlock')) {
      var det = document.createElement('details');
      det.id = 'amisReqBlock'; det.className = 'soc-req-block';
      det.innerHTML = '<summary>Demandes d\'amis <span class="soc-tab-badge" id="amisReqBadge" style="display:none">0</span></summary><div class="soc-req-body"></div>';
      var body = det.querySelector('.soc-req-body');
      while (pd.firstChild) body.appendChild(pd.firstChild);
      paneAmis.insertBefore(det, paneAmis.firstChild);
    }

    // 6. raccourcis Projets / Bloqués dans Communautés, retour dans leurs volets
    var pc = document.getElementById('pane-communautes');
    if (pc && !pc.querySelector('.soc-more-row')) {
      var row = document.createElement('div');
      row.className = 'soc-more-row';
      row.innerHTML = '<button onclick="socSwitchTab(\'projets\')">🎯 Projets</button><button onclick="socSwitchTab(\'bloques\')">🚫 Bloqués</button>';
      pc.insertBefore(row, pc.firstChild);
    }
    ['pane-projets', 'pane-bloques'].forEach(function (id) {
      var p = document.getElementById(id);
      if (p && !p.querySelector('.soc-back-btn')) {
        var b = document.createElement('button');
        b.className = 'soc-back-btn'; b.textContent = '← Communautés';
        b.setAttribute('onclick', "socSwitchTab('communautes')");
        p.insertBefore(b, p.firstChild);
      }
    });
    return true;
  }

  function wrapSwitch() {
    if (typeof window.socSwitchTab !== 'function') return false;
    if (window.socSwitchTab.__ui) return true;
    var orig = window.socSwitchTab;
    var w = function (tab) {
      var go = (tab === 'publications') ? 'fil' : (tab === 'demandes' ? 'amis' : tab);
      var r;
      try { r = orig.call(this, go); } catch (e) {}
      var key = TABS_KEY[go] || 'fil';
      Array.prototype.forEach.call(document.querySelectorAll('#sec-social .soc-tab'), function (t) {
        t.classList.toggle('active', t.getAttribute('data-tab') === key);
      });
      if (go === 'messages') renderMessages();
      if (tab === 'demandes') {
        var d = document.getElementById('amisReqBlock');
        if (d) { d.open = true; try { d.scrollIntoView({ block: 'start' }); } catch (e) {} }
      }
      return r;
    };
    w.__ui = true;
    window.socSwitchTab = w;
    return true;
  }

  // ── Demandes : pastille repliable ──
  function syncReq() {
    var b = document.getElementById('amisReqBadge');
    if (!b) return;
    var n = Array.isArray(window._requestsIn) ? window._requestsIn.length : 0;
    b.textContent = String(n);
    b.style.display = n > 0 ? '' : 'none';
    if (n > 0 && !reqOpened) { var d = document.getElementById('amisReqBlock'); if (d) { d.open = true; reqOpened = true; } }
  }

  // ── Messages ──
  function ts(v) { return v ? (typeof v.toMillis === 'function' ? v.toMillis() : (typeof v === 'number' ? v : Date.parse(v) || 0)) : 0; }
  function fmt(ms) {
    if (!ms) return '';
    var d = new Date(ms), n = new Date();
    if (d.toDateString() === n.toDateString()) return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
    return ('0' + d.getDate()).slice(-2) + '/' + ('0' + (d.getMonth() + 1)).slice(-2);
  }

  function startListener() {
    var me = meUID();
    if (!me) { if (typeof unsub === 'function') { try { unsub(); } catch (e) {} } unsub = null; startedFor = ''; convs = []; return; }
    if (startedFor === me) return;
    if (!window.db || !window.fbCollection || !window.fbOnSnapshot || !window.fbQuery || !window.fbWhere) return;
    startedFor = me;
    if (typeof unsub === 'function') { try { unsub(); } catch (e) {} }
    var q = window.fbQuery(window.fbCollection(window.db, 'dm_conversations'), window.fbWhere('participants', 'array-contains', me));
    unsub = window.fbOnSnapshot(q, function (snap) {
      var list = [];
      snap.forEach(function (d) {
        var data = d.data() || {};
        var other = (data.participants || []).filter(function (u) { return u !== me; })[0];
        if (!other || !data.lastMsg) return;
        list.push({ uid: other, last: data.lastMsg, from: data.lastMsgFrom, at: ts(data.updatedAt), unread: data['unread_' + me] || 0 });
      });
      list.sort(function (a, b) { return b.at - a.at; });
      convs = list;
      renderMessages();
    }, function () {});
  }

  var nameCache = {};
  var usersState = 0;
  function loadUsers() {
    if (usersState) return;
    if (!window.db || !window.fbGetDocs || !window.fbCollection) return;
    usersState = 1;
    window.fbGetDocs(window.fbCollection(window.db, 'users')).then(function (snap) {
      snap.forEach(function (d) {
        var x = d.data() || {};
        var n = x.name || x.pseudo || x.displayName;
        if (!n) return;
        var rec = { name: n, avatar: x.avatarEmoji || '' };
        nameCache[d.id] = rec;
        if (x.uid) nameCache[x.uid] = rec;
      });
      usersState = 2;
      renderMessages();
    }).catch(function () { usersState = 2; });
  }

  function findPerson(uid) {
    var srcs = [window._friends, window._requestsOut, window._requestsIn, window._blocked, window._suggestions];
    for (var i = 0; i < srcs.length; i++) {
      var a = srcs[i];
      if (!Array.isArray(a)) continue;
      for (var j = 0; j < a.length; j++) if (a[j] && a[j].uid === uid && a[j].name) return a[j];
    }
    var cards = document.querySelectorAll('#friendsList .friend-card');
    for (var k = 0; k < cards.length; k++) {
      var oc = cards[k].getAttribute('onclick') || '';
      if (oc.indexOf("'" + uid + "'") !== -1) {
        var n = cards[k].querySelector('.friend-name');
        if (n && n.textContent.trim()) return { uid: uid, name: n.textContent.trim() };
      }
    }
    if (nameCache[uid]) return nameCache[uid];
    return {};
  }

    var _pc = window._socPhotoCache = window._socPhotoCache || {};
  function _msgPhotoP(uid){
    if(typeof window._socFetchUser!=='function' || typeof window._socPickPhoto!=='function') return Promise.resolve('');
    if(!_pc[uid]) _pc[uid] = window._socFetchUser(uid).then(function(u){ return window._socPickPhoto(u); }).catch(function(){ return ''; });
    return _pc[uid];
  }
  function _fillMsgPh(box){
    box.querySelectorAll('.msg-row').forEach(function(row){
      var uid=row.getAttribute('data-uid'); var av=row.querySelector('.soc-avatar');
      if(!uid||!av) return;
      _msgPhotoP(uid).then(function(url){
        if(!url || av.querySelector('img')) return;
        av.innerHTML='<img src="'+String(url).replace(/"/g,'%22')+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" alt="">';
        av.style.overflow='hidden';
      });
    });
  }

  function renderMessages() {
    var box = document.getElementById('msgList');
    if (!box) return;
    var me = meUID();
    var total = 0;
    convs.forEach(function (c) { total += c.unread; });
    var tb = document.getElementById('tabBadgeMsg');
    if (tb) { tb.textContent = total > 99 ? '99+' : String(total); tb.style.display = total > 0 ? '' : 'none'; }
    if (!convs.length) {
      box.innerHTML = '<div class="soc-empty"><div class="soc-empty-icon">💬</div><div class="soc-empty-title">Aucune conversation</div><div class="soc-empty-sub">Ouvre l\'onglet Amis et touche 💬 pour écrire à quelqu\'un.</div></div>';
      return;
    }
    var h = '';
    convs.forEach(function (c) {
      var f = findPerson(c.uid);
      if (!f.name) loadUsers();
      var name = f.name || 'Membre';
      var av = (f.avatar && f.avatar !== '👤') ? f.avatar : esc((name[0] || '?').toUpperCase());
      var prev = (c.from === me ? 'Toi : ' : '') + String(c.last).substring(0, 70);
      h += '<div class="msg-row' + (c.unread > 0 ? ' unread' : '') + '" data-uid="' + esc(c.uid) + '">' +
           '<div class="soc-avatar">' + av + '</div>' +
           '<div class="msg-body"><div class="msg-top"><span class="msg-name">' + esc(name) + '</span><span class="msg-time">' + fmt(c.at) + '</span></div>' +
           '<div class="msg-bottom"><span class="msg-preview">' + esc(prev) + '</span>' +
           (c.unread > 0 ? '<span class="msg-unread">' + (c.unread > 99 ? '99+' : c.unread) + '</span>' : '') +
           '</div></div></div>';
    });
    box.innerHTML = h; _fillMsgPh(box);
  }

  loadCss();
  var tries = 0;
  var iv = setInterval(function () {
    var ok = buildUi() && wrapSwitch();
    if (ok || ++tries > 80) clearInterval(iv);
  }, 400);
  setInterval(function () { startListener(); syncReq(); }, 1500);
})();
