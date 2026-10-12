/* Module « Comment ça marche » — AMBI241
   Fichier autonome, sans bibliothèque. Tout se règle dans CONFIG. */
(function () {
  "use strict";

  var CONFIG = {
    homePathRegex: /(^\/$|\/index\.html$|\/ambi241\/?$)/i,
    adminPathRegex: /admin/i,
    // Menu ☰ d'AMBI241 : <div class="sitenav-item"> dans #siteNavPanel → la ligne est ajoutée sous le premier élément (hors « Installer »)
    menuAnchor: null, // fusion : l'entrée « Guide AMBI241 » (en-tête + menu ☰) ouvre ce guide, pas de seconde ligne
    legacyGuideId: "guideOverlay", // ancien guide complet (rôles, outils, lexique), accessible depuis un lien en bas du guide
    // Page admin : petit bouton « ❓ Guide » ajouté dans l'en-tête, juste avant « Logout »
    menuAnchorAdmin: { selector: ".adm-header-right .adm-logout-btn", before: true, text: "❓ Guide", style: "background:#7c3aed;border-color:#7c3aed;color:#fff;margin-right:6px" },
    menuLabel: "Comment ça marche",
    menuIcon: "❓",
    toast: { text: "Comment ça marche !", delayMs: 1500, durationMs: 15000, oncePerSession: true },
    fab: { text: "❓ Guide", position: "bottom-right", showOnAdmin: false }, // bouton permanent désactivé partout
    color: "#d81b7a",
    adminPinSelector: ".pin-key", // admin.html affiche d'abord un clavier PIN : guide admin et bulle attendent son déverrouillage (null = pas de PIN)
    adminEmails: ["ambi2412026@gmail.com"], // comptes qui voient le guide Administrateur
    lockedMessage: "Cet espace guide est réservé à l'administrateur.",
    defaultRole: { normal: "visiteur", admin: "admin" },
    roles: [
      {
        id: "visiteur", label: "Visiteur", color: "#2563eb",
        intro: "Vous découvrez AMBI241 sans compte.",
        secs: [
          { t: "✅ Ce que je peux faire", p: ["Explorez les bars, restaurants, snacks et discothèques.", "Consultez les fiches : photos, adresse et contacts.", "Contactez un lieu par WhatsApp, téléphone ou email.", "Lisez les publications du forum."] },
          { t: "⚠️ Ce que je dois faire", p: ["Créez un compte pour publier ou commenter.", "Vérifiez les informations avant de vous déplacer."] },
          { t: "🔧 Comment faire", p: ["Touchez Lieux dans la barre du bas.", "Choisissez une catégorie ou cherchez un nom.", "Touchez une fiche pour voir les détails."] },
          { t: "⭐ Points importants", p: ["Ne partagez jamais votre mot de passe.", "Installez l'application depuis le menu ☰ pour y accéder vite."] }
        ]
      },
      {
        id: "membre", label: "Membre", color: "#16a34a",
        intro: "Vous avez un compte AMBI241.",
        secs: [
          { t: "✅ Ce que je peux faire", p: ["Publiez texte, photo ou vidéo dans le forum.", "Aimez, commentez et partagez les publications.", "Consultez la section Paiements."] },
          { t: "⚠️ Ce que je dois faire", p: ["Respectez les autres membres dans vos publications.", "Gardez votre profil à jour."] },
          { t: "🔧 Comment faire", p: ["Touchez Forum dans la barre du bas.", "Écrivez votre message puis ajoutez un média.", "Touchez Publier et attendez la fin de l'envoi.", "Utilisez le menu ⋯ pour copier le lien ou signaler."] },
          { t: "⭐ Points importants", p: ["Les contenus inappropriés sont signalés puis supprimés.", "Ne publiez aucune donnée privée d'autrui."] }
        ]
      },
      {
        id: "etablissement", label: "Établissement", color: "#ea580c",
        intro: "Vous gérez un lieu présent dans l'annuaire.",
        secs: [
          { t: "✅ Ce que je peux faire", p: ["Faites connaître votre lieu dans l'annuaire AMBI241.", "Présentez photos, équipements et moyens de contact.", "Recevez des demandes par plusieurs canaux."] },
          { t: "⚠️ Ce que je dois faire", p: ["Fournissez des informations exactes et à jour.", "Vérifiez vos numéros de contact."] },
          { t: "🔧 Comment faire", p: ["Ouvrez la fiche de votre établissement.", "Modifiez les informations puis enregistrez.", "Ajoutez des photos nettes de votre lieu."] },
          { t: "⭐ Points importants", p: ["Une fiche trompeuse peut être retirée.", "Contactez l'administration pour toute modification importante."] }
        ]
      },
      {
        id: "admin", label: "Administrateur", color: "#7c3aed", adminOnly: true,
        intro: "Vous gérez la plateforme AMBI241.",
        secs: [
          { t: "✅ Ce que je peux faire", p: ["Gérez les établissements de l'annuaire.", "Modérez les publications du forum.", "Envoyez des notifications aux utilisateurs."] },
          { t: "⚠️ Ce que je dois faire", p: ["Traitez régulièrement les signalements reçus.", "Contrôlez les informations avant publication."] },
          { t: "🔧 Comment faire", p: ["Ouvrez le panneau d'administration.", "Choisissez la rubrique à traiter.", "Validez, modifiez ou supprimez, puis confirmez."] },
          { t: "⭐ Points importants", p: ["Vérifiez bien avant de supprimer : action définitive.", "Ne communiquez jamais vos accès administrateur."] }
        ]
      }
    ]
  };

  var path = location.pathname;
  var isAdminPage = CONFIG.adminPathRegex.test(path);
  var isHome = !isAdminPage && CONFIG.homePathRegex.test(path);
  var C = CONFIG.color;
  var adminByEmail = false; // renseigné par la détection asynchrone ou GuideWidget.setUser()

  function el(tag, props, kids) {
    var e = document.createElement(tag);
    if (props) for (var k in props) {
      if (k === "style") e.style.cssText = props[k];
      else if (k === "text") e.textContent = props[k];
      else e.setAttribute(k, props[k]);
    }
    (kids || []).forEach(function (c) { e.appendChild(c); });
    return e;
  }

  /* ---------- Accès au guide Administrateur ---------- */
  function emailMatch(e) {
    if (!e) return false;
    var x = String(e).toLowerCase();
    return CONFIG.adminEmails.some(function (a) { return a.toLowerCase() === x; });
  }

  function pinVisible() { // vrai tant que le clavier PIN de la page admin est affiché
    if (!CONFIG.adminPinSelector) return false;
    try {
      var k = document.querySelector(CONFIG.adminPinSelector);
      if (!k) return false;
      var r = k.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(k).visibility !== "hidden";
    } catch (e) { return false; }
  }

  function isAdminUser() {
    if (isAdminPage) return !pinVisible(); // page admin : valable seulement une fois le PIN passé
    if (adminByEmail) return true;
    try { // session Supabase stockée par le navigateur
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (/^sb-.*-auth-token$/.test(k)) {
          var v = JSON.parse(localStorage.getItem(k) || "null");
          var u = v && (v.user || (v.currentSession && v.currentSession.user));
          if (u && emailMatch(u.email)) return true;
        }
      }
    } catch (e) {}
    try { // variables globales éventuelles de l'application
      var g = window.currentUser || window.user || (window.GSC && window.GSC.user);
      if (g && emailMatch(g.email)) return true;
    } catch (e) {}
    return false;
  }

  function detectFirebaseUser() { // session Firebase Auth (IndexedDB)
    try {
      var req = indexedDB.open("firebaseLocalStorageDb");
      req.onsuccess = function () {
        try {
          var db = req.result;
          if (!db.objectStoreNames.contains("firebaseLocalStorage")) { db.close(); return; }
          var all = db.transaction("firebaseLocalStorage").objectStore("firebaseLocalStorage").getAll();
          all.onsuccess = function () {
            (all.result || []).forEach(function (r) { if (r && r.value && emailMatch(r.value.email)) adminByEmail = true; });
            db.close();
          };
        } catch (e) {}
      };
    } catch (e) {}
  }

  /* ---------- Styles ---------- */
  function injectCss() {
    var s = el("style");
    s.textContent =
      ".gw-toast{position:fixed;left:50%;right:auto;transform:translateX(-50%);width:max-content;bottom:78px;max-width:80%;margin:0;background:" + C + ";color:#000;padding:8px 36px 8px 14px;border-radius:12px;font:800 14px/1.3 system-ui,sans-serif;box-shadow:0 6px 20px rgba(0,0,0,.3);z-index:99998;cursor:pointer}" +
      ".gw-x{position:absolute;right:8px;top:6px;background:none;border:0;color:#fff;font-size:18px;cursor:pointer}" +
      ".gw-fab{position:fixed;bottom:16px;" + (CONFIG.fab.position.indexOf("left") > -1 ? "left" : "right") + ":14px;background:" + C + ";color:#fff;border:0;border-radius:24px;padding:12px 16px;font:600 14px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3);z-index:99997;cursor:pointer}" +
      ".gw-ov{position:fixed;inset:0;background:rgba(0,0,0,.35);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:10px}" +
      ".gw-box{--gw-c:" + C + ";background:rgba(255,255,255,.74);-webkit-backdrop-filter:blur(18px) saturate(1.4);backdrop-filter:blur(18px) saturate(1.4);border:1px solid rgba(255,255,255,.55);box-shadow:0 10px 40px rgba(0,0,0,.35);color:#1b1b1b;width:100%;max-width:520px;max-height:90vh;overflow:auto;border-radius:16px;font:14px/1.45 system-ui,sans-serif}" +
      ".gw-hd{position:sticky;top:0;z-index:1;background:var(--gw-c);background:color-mix(in srgb,var(--gw-c) 88%,transparent);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;font-weight:700}" +
      ".gw-tabs{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;border-bottom:1px solid rgba(0,0,0,.08)}" +
      ".gw-tab{display:flex;align-items:center;justify-content:center;text-align:center;height:52px;width:100%;box-sizing:border-box;border:1.5px solid var(--c);background:rgba(255,255,255,.45);color:var(--c);border-radius:14px;padding:4px 8px;font:600 14px system-ui,sans-serif;cursor:pointer}" +
      ".gw-tab.on{background:var(--c);color:#fff;box-shadow:0 3px 10px rgba(0,0,0,.2)}" +
      ".gw-body{padding:12px 14px}.gw-body h4{margin:14px 0 4px;color:var(--gw-c)}.gw-body ul{margin:0;padding-left:18px}.gw-body li{margin:3px 0}" +
      ".gw-lock{text-align:center;padding:28px 12px;font-size:15px}.gw-lock b{display:block;font-size:34px;margin-bottom:8px}";
    document.head.appendChild(s);
  }

  /* ---------- Fenêtre du guide ---------- */
  function renderBody(box, id) {
    var role = CONFIG.roles.filter(function (r) { return r.id === id; })[0] || CONFIG.roles[0];
    var shell = box.parentNode;
    if (shell && shell.style) shell.style.setProperty("--gw-c", role.color || C);
    box.innerHTML = "";
    if (role.adminOnly && !isAdminUser()) {
      box.appendChild(el("div", { class: "gw-lock" }, [el("b", { text: "🔒" }), el("span", { text: CONFIG.lockedMessage })]));
      return;
    }
    box.appendChild(el("p", { text: role.intro, style: "margin:0 0 4px;font-style:italic" }));
    role.secs.forEach(function (sec) {
      box.appendChild(el("h4", { text: sec.t }));
      var ul = el("ul");
      sec.p.forEach(function (t) { ul.appendChild(el("li", { text: t })); });
      box.appendChild(ul);
    });
  }

  function open(roleId) {
    if (document.getElementById("gw-ov")) return;
    var admin = isAdminUser();
    var start = roleId || (isAdminPage ? CONFIG.defaultRole.admin : CONFIG.defaultRole.normal);
    var body = el("div", { class: "gw-body" });
    var tabs = el("div", { class: "gw-tabs" });
    CONFIG.roles.forEach(function (r) {
      var locked = r.adminOnly && !admin;
      var b = el("button", { class: "gw-tab", text: (locked ? "🔒 " : "") + r.label, type: "button", style: "--c:" + (r.color || C) });
      b.onclick = function () {
        Array.prototype.forEach.call(tabs.children, function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        renderBody(body, r.id);
      };
      b.setAttribute("data-id", r.id);
      tabs.appendChild(b);
    });
    var close = el("button", { class: "gw-x", text: "✕", type: "button", "aria-label": "Fermer" });
    var ov = el("div", { class: "gw-ov", id: "gw-ov" }, [
      el("div", { class: "gw-box" }, [el("div", { class: "gw-hd" }, [el("span", { text: "Comment ça marche" }), close]), tabs, body])
    ]);
    function shut() { ov.remove(); }
    close.onclick = shut;
    ov.addEventListener("click", function (e) { if (e.target === ov) shut(); });
    var legacy = CONFIG.legacyGuideId && document.getElementById(CONFIG.legacyGuideId);
    if (legacy) {
      var more = el("button", { class: "gw-tab", type: "button", text: "📖 Guide complet : rôles, outils, lexique", style: "--c:" + C + ";width:calc(100% - 24px);margin:0 12px 14px" });
      more.onclick = function () { shut(); legacy.classList.add("show"); };
      ov.firstChild.appendChild(more);
    }
    document.body.appendChild(ov);
    var first = tabs.querySelector('[data-id="' + start + '"]') || tabs.firstChild;
    first.click();
  }

  /* ---------- Ligne du menu latéral ---------- */
  function addMenuLine() {
    var a = isAdminPage ? CONFIG.menuAnchorAdmin : CONFIG.menuAnchor;
    if (!a) return false;
    var links = document.querySelectorAll(a.selector || "a");
    var target = null;
    for (var i = 0; i < links.length; i++) {
      var l = links[i];
      if (l.closest && l.closest("#gw-ov")) continue;
      if (l.id === "gw-menu") continue;
      var okText = a.textRegex ? a.textRegex.test(l.textContent || "") : true;
      var okHref = a.hrefContains ? (l.getAttribute("href") || "").indexOf(a.hrefContains) > -1 : true;
      if (okText && okHref) { target = l; if (!a.last) break; }
    }
    if (!target || document.getElementById("gw-menu")) return !!target;
    var line = target.cloneNode(false);
    line.removeAttribute("onclick");
    line.classList.remove("active");
    line.id = "gw-menu";
    if (line.tagName === "A") line.href = "#";
    var ico = target.querySelector('[class*="ico"]');
    if (ico) {
      var si = ico.cloneNode(false);
      si.textContent = CONFIG.menuIcon;
      line.appendChild(si);
      var lab = ico.nextElementSibling ? ico.nextElementSibling.cloneNode(false) : null;
      if (lab) { lab.removeAttribute("id"); lab.textContent = CONFIG.menuLabel; line.appendChild(lab); }
      else line.appendChild(document.createTextNode(CONFIG.menuLabel));
    } else {
      line.textContent = a.text || (CONFIG.menuIcon + " " + CONFIG.menuLabel);
    }
    if (a.style) line.style.cssText += ";" + a.style;
    line.onclick = function (e) {
      e.preventDefault();
      e.stopPropagation();
      try { if (typeof window.closeMenu === "function") window.closeMenu(); } catch (x) {}
      try { if (typeof window.closeSiteNav === "function") window.closeSiteNav(); } catch (x) {}
      try { // menu latéral de la page admin (mobile)
        var sb = document.getElementById("sidebar"); if (sb) sb.classList.remove("open");
        var so = document.getElementById("sidebar-overlay"); if (so) so.classList.remove("open");
      } catch (x) {}
      open();
    };
    var holder = target.parentNode && target.parentNode.tagName === "LI" ? target.parentNode : target;
    var copy = holder === target ? line : holder.cloneNode(false);
    if (holder !== target) copy.appendChild(line);
    holder.parentNode.insertBefore(copy, a.before ? holder : holder.nextSibling);
    return true;
  }

  /* ---------- Bulle éphémère ---------- */
  function showToast() {
    var T = CONFIG.toast;
    var key = "gw_toast_" + (isAdminPage ? "admin" : "home");
    try { if (T.oncePerSession && sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch (e) {}
    setTimeout(function () {
      var x = el("button", { class: "gw-x", text: "✕", type: "button", "aria-label": "Fermer" });
      var t = el("div", { class: "gw-toast", text: T.text }, [x]);
      x.onclick = function (e) { e.stopPropagation(); t.remove(); };
      t.onclick = function () { t.remove(); open(); };
      document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.remove(); }, T.durationMs);
    }, T.delayMs);
  }

  function addFab() {
    if (document.getElementById("gw-fab")) return;
    var b = el("button", { class: "gw-fab", id: "gw-fab", text: CONFIG.fab.text, type: "button" });
    b.onclick = function () { open(); };
    document.body.appendChild(b);
  }

  function init() {
    injectCss();
    detectFirebaseUser();
    if (isAdminPage || isHome) {
      if (isAdminPage && CONFIG.adminPinSelector) { // bulle seulement après le PIN
        var waits = 0;
        var w = setInterval(function () {
          waits++;
          if (!pinVisible()) { clearInterval(w); showToast(); }
          else if (waits > 1800) clearInterval(w);
        }, 1000);
      } else showToast();
      if (isAdminPage && CONFIG.fab.showOnAdmin) addFab();
      // menu latéral : souvent construit ou rouvert après le chargement → on surveille la page
      if (isAdminPage ? CONFIG.menuAnchorAdmin : CONFIG.menuAnchor) {
        addMenuLine();
        var timer = null;
        new MutationObserver(function () {
          if (document.getElementById("gw-menu") || timer) return;
          timer = setTimeout(function () { timer = null; addMenuLine(); }, 300);
        }).observe(document.body, { childList: true, subtree: true });
      }
    }
  }

  window.GuideWidget = {
    open: open,
    // Si la détection automatique échoue, l'application peut appeler GuideWidget.setUser(email)
    setUser: function (email) { adminByEmail = emailMatch(email); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
