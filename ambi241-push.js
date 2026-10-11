// AMBI241 — alertes telephone (Firebase Cloud Messaging + relais Cloudflare)
(function () {
  'use strict';
  var RELAY = 'https://ambi241-relais.ambi2412026-91a.workers.dev/notify';
  var VAPID = 'BHLzTyBKzlQuHm7LqsPzVlgM6JrS5ElqsfX89bH_ejji9VqtY10MCaBhi1O6GJtMqYSUA5EjcRPnXZ77QLiFoBk';
  var CFG = {
    apiKey: 'AIzaSyCx3hD28Lb9EtUrawHbTnM-6vmXdgO1ABw',
    authDomain: 'ambi241.firebaseapp.com',
    projectId: 'ambi241',
    storageBucket: 'ambi241.firebasestorage.app',
    messagingSenderId: '422590051382',
    appId: '1:422590051382:web:fe05eaf701a6f704c2d497'
  };
  var LS = 'ambi241_push_token';
  var supported = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
  var btn = null, fcm = null, regFor = '';

  function ping(id) {
    try {
      fetch(RELAY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: id }), keepalive: true }).catch(function () {});
    } catch (e) {}
  }

  function wrapAdd() {
    if (typeof window.fbAddDoc !== 'function') return false;
    if (window.fbAddDoc.__push) return true;
    var orig = window.fbAddDoc;
    var w = function (ref) {
      var p = orig.apply(this, arguments);
      try {
        if (ref && ref.path === 'user_notifications' && p && p.then) {
          p.then(function (r) { if (r && r.id) ping(r.id); }).catch(function () {});
        }
      } catch (e) {}
      return p;
    };
    w.__push = true;
    window.fbAddDoc = w;
    return true;
  }

  function wrapOut() {
    if (typeof window.fbSignOut !== 'function') return false;
    if (window.fbSignOut.__push) return true;
    var orig = window.fbSignOut;
    var w = function () {
      var args = arguments, self = this, tk = '';
      try { tk = localStorage.getItem(LS) || ''; } catch (e) {}
      var go = function () { return orig.apply(self, args); };
      if (!tk || !window.db || !window.fbDeleteDoc || !window.fbDoc) return go();
      return new Promise(function (resolve, reject) {
        var done = false;
        var fin = function () {
          if (done) return;
          done = true;
          try { localStorage.removeItem(LS); } catch (e) {}
          regFor = '';
          go().then(resolve, reject);
        };
        setTimeout(fin, 2000);
        try { window.fbDeleteDoc(window.fbDoc(window.db, 'pushTokens', tk)).then(fin, fin); } catch (e) { fin(); }
      });
    };
    w.__push = true;
    window.fbSignOut = w;
    return true;
  }

  function getFcm() {
    if (fcm) return fcm;
    fcm = Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.1/firebase-messaging.js')
    ]).then(function (m) {
      var app;
      try { app = m[0].getApp('ambi241-push'); } catch (e) { app = m[0].initializeApp(CFG, 'ambi241-push'); }
      return { messaging: m[1].getMessaging(app), getToken: m[1].getToken };
    });
    return fcm;
  }

  function register() {
    var uid = window.currentUserUID;
    if (!uid || !window.db || !window.fbSetDoc || !window.fbDoc) return Promise.resolve(false);
    return navigator.serviceWorker.ready.then(function (reg) {
      return getFcm().then(function (f) {
        return f.getToken(f.messaging, { vapidKey: VAPID, serviceWorkerRegistration: reg });
      });
    }).then(function (token) {
      if (!token) return false;
      return window.fbSetDoc(window.fbDoc(window.db, 'pushTokens', token), {
        uid: uid,
        emailLower: String(window.currentUserEmail || '').toLowerCase(),
        at: Date.now()
      }).then(function () {
        try { localStorage.setItem(LS, token); } catch (e) {}
        return true;
      });
    }).catch(function (e) { console.warn('[push]', e); window.__pushErr = String((e && (e.code || e.message)) || e).slice(0, 60); return false; });
  }

  function hide() { if (btn) btn.style.display = 'none'; }

  function show() {
    if (btn) { btn.style.display = 'block'; return; }
    btn = document.createElement('button');
    btn.textContent = '🔔 Activer les alertes téléphone';
    btn.style.cssText = 'position:fixed;left:10px;bottom:76px;z-index:99998;background:#e11d48;color:#fff;border:0;border-radius:999px;padding:9px 14px;font:600 13px sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.4)';
    btn.onclick = function () {
      Notification.requestPermission().then(function (p) {
        if (p !== 'granted') { hide(); return; }
        regFor = window.currentUserUID || '';
        btn.textContent = '… activation';
        register().then(function (ok) {
          btn.textContent = ok ? '✅ Alertes activées' : ('⚠️ ' + (window.__pushErr || 'Échec') + ' (réessayer)');
          if (ok) setTimeout(hide, 1500);
        });
      });
    };
    document.body.appendChild(btn);
  }

  function tick() {
    if (!supported || !document.body) return;
    var uid = window.currentUserUID || '';
    if (!uid || Notification.permission === 'denied') return hide();
    var stored = '';
    try { stored = localStorage.getItem(LS) || ''; } catch (e) {}
    if (Notification.permission === 'granted') {
      if (regFor !== uid) { regFor = uid; register(); }
      return stored ? hide() : show();
    }
    show();
  }

  var n = 0;
  var iv = setInterval(function () {
    var a = wrapAdd(), b = wrapOut();
    if ((a && b) || ++n > 60) clearInterval(iv);
  }, 500);
  setInterval(tick, 2500);
})();
