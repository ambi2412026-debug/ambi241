(function () {
  "use strict";
  function log(m) { try { if (window.__ambiLog) window.__ambiLog(m); } catch (e) {} }
  function brancherFiches() {
    if (typeof window.navHandleFiches !== "function") return setTimeout(brancherFiches, 500);
    if (window.navHandleFiches.__ambi) return;
    var orig = window.navHandleFiches;
    var f = function (btn) {
      try {
        var etab = typeof userEtabIds !== "undefined" && userEtabIds && userEtabIds.length > 0;
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
