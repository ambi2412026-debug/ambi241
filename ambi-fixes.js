(function () {
  "use strict";
  function log(m) { try { if (window.__ambiLog) window.__ambiLog(m); } catch (e) {} }
  function brancherFiches() {
    if (typeof window.navHandleFiches !== "function") return setTimeout(brancherFiches, 500);
    if (window.navHandleFiches.__ambi) return;
    var orig = window.navHandleFiches;
    var f = function (btn) {
      try {
        var em = String(window.currentUserEmail || "").toLowerCase().trim(); var etab = !!em && typeof etablissements !== "undefined" && Array.isArray(etablissements) && etablissements.some(function (e) { return String(e.email || "").toLowerCase().trim() === em || String(e.responsable_email || "").toLowerCase().trim() === em; });
        if (window.currentUserUID && window.isAdmin && !etab) { log("Fiches : admin sans etablissement, ouverture de la page Fiches"); return window.switchSection("fiches", btn); }
      } catch (e) { log("Fiches : " + e.message); }
      return orig.apply(this, arguments);
    };
    f.__ambi = true;
    window.navHandleFiches = f;
  }
  var SECS = ["accueil", "etablissements", "fiches", "paiements", "contacts", "profil", "social"];
  function securiserNav() {
    if (typeof window.switchSection !== "function") return setTimeout(securiserNav, 500);
    if (window.switchSection.__ambi) return;
    var prev = window.switchSection;
    var w = function (name, btn) {
      try { return prev.apply(this, arguments); }
      catch (err) {
        log("switchSection(" + name + ") a plante : " + (err && err.message));
        try {
          if (btn) { document.querySelectorAll(".nav-item").forEach(function (b) { b.classList.remove("active"); }); btn.classList.add("active"); }
          SECS.forEach(function (s) { var el = document.getElementById("sec-" + s); if (el) el.classList.toggle("section-hidden", s !== name); });
        } catch (e2) {}
      }
    };
    w.__ambi = true;
    window.switchSection = w;
  }
  function go() { brancherFiches(); setTimeout(securiserNav, 2500); }
  if (document.readyState === "complete") go(); else window.addEventListener("load", go);
})();
(function () {
  "use strict";
  try {
    var st = document.createElement("style");
    st.textContent = "#_userProfileOverlay{z-index:10200 !important}";
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
})();
(function () {
  "use strict";
  function log(m) { try { if (window.__ambiLog) window.__ambiLog(m); } catch (e) {} }
  try {
    var st = document.createElement("style");
    st.textContent = "#notifToast{pointer-events:auto !important;cursor:pointer}";
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
  var vues = {};
  function dejaVu(o) {
    var k = "ambi_nv_" + [o && o.key, o && o.title, o && o.msg].join("|");
    if (vues[k]) return true;
    vues[k] = 1;
    try { if (sessionStorage.getItem(k)) return true; sessionStorage.setItem(k, "1"); } catch (e) {}
    return false;
  }
  function brancherPush() {
    if (typeof window.pushNotif !== "function") return setTimeout(brancherPush, 500);
    if (window.pushNotif.__ambiDedup) return;
    var orig = window.pushNotif;
    var w = function (o) {
      try { if (o && o.key === "paiement_pending" && dejaVu(o)) { log("pushNotif doublon ignore : " + o.title); return; } } catch (e) {}
      return orig.apply(this, arguments);
    };
    w.__ambiDedup = true;
    window.pushNotif = w;
  }
  function brancherToast() {
    var t = document.getElementById("notifToast");
    if (!t) return setTimeout(brancherToast, 500);
    if (t.__ambiClick) return;
    t.__ambiClick = true;
    t.addEventListener("click", function () {
      var titre = (document.getElementById("notifToastTitle") || {}).textContent || "";
      t.classList.remove("show");
      if (/paiement/i.test(titre) && typeof window.switchSection === "function") {
        var b = document.querySelector('.nav-item[onclick*="paiements"]');
        try { window.switchSection("paiements", b); } catch (e) { log("toast->paiements : " + e.message); }
      }
    });
  }
  function go() { brancherPush(); brancherToast(); }
  if (document.readyState === "complete") go(); else window.addEventListener("load", go);
})();
