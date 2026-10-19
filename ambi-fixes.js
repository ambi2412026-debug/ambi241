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
        if ((typeof isAdmin !== "undefined" && isAdmin) && !etab) { log("Fiches : admin sans etablissement, ouverture de la page Fiches"); return window.switchSection("fiches", btn); }
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
(function () {
  "use strict";
  function log(m) { try { if (window.__ambiLog) window.__ambiLog(m); } catch (e) {} }
  function fermer() {
    try { if (typeof window.closeUserProfile === "function") window.closeUserProfile(); } catch (e) { log("closeUserProfile : " + e.message); }
    ["_userProfileWrap", "_userProfileOverlay"].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
  }
  function surCroix(e) {
    var ov = document.getElementById("_userProfileOverlay");
    if (!ov) return false;
    var bs = ov.querySelectorAll("button"), x = e.clientX, y = e.clientY;
    for (var i = 0; i < bs.length; i++) {
      if ((bs[i].textContent || "").trim() !== "\u2715") continue;
      var r = bs[i].getBoundingClientRect();
      if (x >= r.left - 12 && x <= r.right + 12 && y >= r.top - 12 && y <= r.bottom + 12) return true;
    }
    return false;
  }
  document.addEventListener("click", function (e) {
    if (surCroix(e)) { e.preventDefault(); e.stopPropagation(); log("croix profil : fermeture forcee"); fermer(); }
  }, true);
})();
(function () {
  "use strict";
  function log(m) { try { if (window.__ambiLog) window.__ambiLog(m); } catch (e) {} }
  var dernier = 0;
  function fermer() {
    try { if (typeof window.closeUserProfile === "function") window.closeUserProfile(); } catch (e) {}
    ["_userProfileWrap", "_userProfileOverlay"].forEach(function (id) { var el = document.getElementById(id); if (el) el.remove(); });
  }
  function surCroix(x, y) {
    var ov = document.getElementById("_userProfileOverlay");
    if (!ov) return false;
    var bs = ov.querySelectorAll("button");
    for (var i = 0; i < bs.length; i++) {
      if ((bs[i].textContent || "").trim() !== "\u2715") continue;
      var r = bs[i].getBoundingClientRect();
      if (x >= r.left - 14 && x <= r.right + 14 && y >= r.top - 14 && y <= r.bottom + 14) return true;
    }
    return false;
  }
  document.addEventListener("touchend", function (e) {
    var t = e.changedTouches && e.changedTouches[0];
    if (!t || !surCroix(t.clientX, t.clientY)) return;
    e.preventDefault(); e.stopPropagation();
    if (Date.now() - dernier < 500) return;
    dernier = Date.now();
    log("croix profil : touchend, fermeture forcee");
    fermer();
  }, { capture: true, passive: false });
})();
(function () {
  "use strict";
  try {
    var st = document.createElement("style");
    st.textContent =
      "#adminDashPanel .adm-header{padding:0 .6rem !important;height:52px !important;gap:.4rem;align-items:center}" +
      "#adminDashPanel .adm-header-left{gap:.4rem !important;min-width:0;flex:1 1 auto;overflow:hidden;align-items:center}" +
      "#adminDashPanel .adm-header-left>div:last-child{min-width:0;display:flex;flex-direction:column;justify-content:center}" +
      "#adminDashPanel .adm-header-icon{font-size:1.05rem !important;flex-shrink:0;line-height:1}" +
      "#adminDashPanel .adm-header-title{font-size:.76rem !important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#adminDashPanel .adm-header-sub{font-size:.52rem !important;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      "#adminDashPanel .adm-header-right{gap:.3rem !important;flex-shrink:0;align-items:center}" +
      "#adminDashPanel .adm-header-right button{flex-shrink:0}" +
      "#adminDashPanel #admOnlineBtn{padding:.2rem .45rem .2rem .4rem !important;gap:.3rem !important}" +
      "#adminDashPanel #admOnlineBtn>span:last-child{display:none !important}" +
      "#adminDashPanel .adm-header-right button:not(#admOnlineBtn){width:30px;height:30px;padding:0;font-size:.85rem;display:flex;align-items:center;justify-content:center;border-radius:50%}";
    (document.head || document.documentElement).appendChild(st);
  } catch (e) {}
})();
