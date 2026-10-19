(function () {
  "use strict";
  var BADGE = { admin: "navBadgeAdmin", paiements: "navBadgePaiements" };
  var LABEL = { admin: "Paramètres", paiements: "Paiements" };
  var DECL = { navAdminSettings: "admin", "admtab-notifs": "admin", navPaiementsBtn: "paiements", "admtab-payments": "paiements" };
  var minuteur = null, supprime = false;

  function cat(k) {
    k = String(k || "").toLowerCase();
    if (/message|friend|ami|community|communaute|forum|dm_|call|appel/.test(k)) return "forum";
    if (/paiement|payment|sub_|abonnement/.test(k)) return "paiements";
    if (/admin|super/.test(k)) return "admin";
    return "profil";
  }
  function fmt(v) {
    try {
      if (!v) return "";
      if (v.toDate) v = v.toDate();
      if (typeof v === "number" || v instanceof Date) return new Date(v).toLocaleString("fr-FR");
      return String(v).slice(0, 25);
    } catch (e) { return ""; }
  }
  function lire() {
    try { var a = typeof window.loadNotifs === "function" ? window.loadNotifs() : []; return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function majLocal(cible) {
    var all = lire();
    if (!all.length) return 0;
    var avant = JSON.stringify(all), n = 0;
    all.forEach(function (x) { if (x && x.unread && cat(x.key) === cible) { x.unread = false; x.read = true; n++; } });
    if (!n) return 0;
    try {
      if (typeof window.saveNotifs === "function") { window.saveNotifs(all); }
      else {
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (localStorage.getItem(k) === avant) { localStorage.setItem(k, JSON.stringify(all)); break; }
        }
      }
    } catch (e) {}
    return n;
  }
  function fsOk() {
    return window.currentUserUID && window.db && window.fbQuery && window.fbWhere && window.fbCollection && window.fbGetDocs && window.fbUpdateDoc && window.fbDoc;
  }
  function fsRequete() {
    return window.fbQuery(window.fbCollection(window.db, "user_notifications"), window.fbWhere("toUID", "==", window.currentUserUID), window.fbWhere("unread", "==", true));
  }
  function majFirestore(cible) {
    if (!fsOk()) return;
    try {
      window.fbGetDocs(fsRequete()).then(function (snap) {
        (snap.docs || []).forEach(function (d) {
          var x = d.data ? d.data() : {};
          if (cat((x.key || x.type || "") + "") === cible) window.fbUpdateDoc(window.fbDoc(window.db, "user_notifications", d.id), { unread: false, read: true }).catch(function () {});
        });
      }).catch(function () {});
    } catch (e) {}
  }
  function effacer(cible) {
    var el = document.getElementById(BADGE[cible]);
    if (el) { el.textContent = ""; el.classList.remove("show"); }
    try { var c = window._ambiNavBadge && window._ambiNavBadge.counts; if (c) c[BADGE[cible]] = 0; } catch (e) {}
    try { if (typeof window.renderNotifBadge === "function") window.renderNotifBadge(); } catch (e) {}
  }
  function marquerLu(cible) { majLocal(cible); majFirestore(cible); effacer(cible); }

  function sources(cible, cb) {
    var items = [];
    lire().forEach(function (x) {
      if (x && x.unread && cat(x.key) === cible) items.push({ titre: x.title || x.body || x.msg, key: x.key || "?", src: "appareil", date: fmt(x.ts || x.time || x.date || x.createdAt) });
    });
    if (!fsOk()) return cb(items);
    try {
      window.fbGetDocs(fsRequete()).then(function (snap) {
        (snap.docs || []).forEach(function (d) {
          var x = d.data ? d.data() : {};
          if (cat((x.key || x.type || "") + "") === cible) items.push({ titre: x.title || x.body || x.msg, key: x.key || x.type || "?", src: "en ligne", date: fmt(x.ts || x.createdAt || x.time || x.date) });
        });
        cb(items);
      }).catch(function () { cb(items); });
    } catch (e) { cb(items); }
  }
  function ouvrirModal(cible) {
    sources(cible, function (items) {
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2147483002;display:flex;align-items:center;justify-content:center";
      var box = document.createElement("div");
      box.style.cssText = "background:#1a0a28;color:#fff;border:1px solid #ff2d9b;border-radius:14px;padding:16px;width:340px;max-width:92vw;max-height:80vh;overflow:auto;font-family:Arial,sans-serif;font-size:14px";
      var h = document.createElement("div");
      h.style.cssText = "font-weight:700;margin-bottom:8px";
      h.textContent = "🔔 " + LABEL[cible] + " : " + items.length + " non lue(s)";
      box.appendChild(h);
      items.forEach(function (it) {
        var d = document.createElement("div");
        d.style.cssText = "padding:6px 0;border-top:1px solid rgba(255,255,255,.12)";
        d.textContent = (it.titre || "(sans titre)") + "  [" + it.key + " · " + it.src + (it.date ? " · " + it.date : "") + "]";
        box.appendChild(d);
      });
      function bt(txt, bg, fn) {
        var b = document.createElement("button");
        b.type = "button"; b.textContent = txt; b.onclick = fn;
        b.style.cssText = "border:0;border-radius:10px;padding:10px 14px;margin:10px 6px 0 0;font-size:14px;font-weight:700;color:#fff;cursor:pointer;background:" + bg;
        return b;
      }
      box.appendChild(bt("Tout marquer lu", "#d4177f", function () { marquerLu(cible); ov.remove(); }));
      box.appendChild(bt("Fermer", "#555", function () { ov.remove(); }));
      ov.appendChild(box);
      document.body.appendChild(ov);
    });
  }

  document.addEventListener("click", function (e) {
    if (supprime) { supprime = false; e.stopImmediatePropagation(); e.preventDefault(); }
  }, true);
  document.addEventListener("click", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("#navAdminSettings,#admtab-notifs,#navPaiementsBtn,#admtab-payments") : null;
    if (!t) return;
    var cible = DECL[t.id];
    setTimeout(function () { marquerLu(cible); }, 400);
  });
  document.addEventListener("touchstart", function (e) {
    var t = e.target && e.target.closest ? e.target.closest("#navAdminSettings,#navPaiementsBtn") : null;
    if (!t) return;
    clearTimeout(minuteur);
    minuteur = setTimeout(function () { supprime = true; ouvrirModal(DECL[t.id]); }, 700);
  }, { passive: true });
  ["touchend", "touchmove", "touchcancel"].forEach(function (ev) {
    document.addEventListener(ev, function () {
      clearTimeout(minuteur);
      if (supprime) setTimeout(function () { supprime = false; }, 400);
    }, { passive: true });
  });
  document.addEventListener("contextmenu", function (e) { if (supprime) e.preventDefault(); });
})();
