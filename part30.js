
(function(){
'use strict';

/* ── FIX 1 : Reset _admOverviewRetries à chaque ouverture admin
   → corrige "Impossible de charger les données Firebase"
   qui apparaissait après la 1re ouverture à froid          ── */
var _origOpenAdmin = window.openAdminDashboard;
window.openAdminDashboard = function(btn) {
  window._admOverviewRetries = 0;
  if (typeof _origOpenAdmin === 'function') _origOpenAdmin(btn);
};
var _origSwitchAdm = window.switchAdmTab;
window.switchAdmTab = function(tab) {
  if (tab === 'overview') window._admOverviewRetries = 0;
  if (typeof _origSwitchAdm === 'function') _origSwitchAdm(tab);
};

/* ── FIX 2 : Bouton Réessayer — forcer loadData puis rerender ── */
window._admRetryOverview = function() {
  window._admOverviewRetries = 0;
  var doRender = function() { if (typeof renderAdmOverview === 'function') renderAdmOverview(); };
  if (typeof loadDataForce === 'function') { loadDataForce(); setTimeout(doRender, 2000); }
  else if (typeof loadData === 'function') { loadData(); setTimeout(doRender, 2000); }
  else setTimeout(doRender, 300);
};

/* ── FIX 3 : Throttle loadData sur mobile (auto-sync 60s → 2min)
   évite le freeze toutes les minutes sur Android               ── */
setTimeout(function() {
  if (window.innerWidth > 480) return;
  var _orig = window.loadData;
  if (typeof _orig !== 'function') return;
  var _last = 0;
  window.loadData = function() {
    var now = Date.now();
    if (now - _last < 120000) return; // throttle 2min sur mobile
    _last = now;
    return _orig.apply(this, arguments);
  };
  window.loadDataForce = _orig; // accès forcé via bouton sync
}, 6000);

/* ── FIX 4 : Purger les setInterval UID-watchers en doublon
   Le fichier contient 6+ intervalles à 600ms qui tournent
   tous en même temps → ralentit le thread JS mobile         ── */
(function() {
  var _extra = []; // callbacks excédentaires
  var _origSI = window.setInterval;
  var _count = 0;
  window.setInterval = function(fn, delay) {
    if (typeof fn === 'function' && delay >= 500 && delay <= 900) {
      _count++;
      if (_count > 3) {
        // Appel immédiat unique pour ne pas rater l'init
        try { fn(); } catch(e) {}
        _extra.push(fn);
        return _origSI(function(){}, 99999); // timer bidon
      }
    }
    return _origSI.apply(window, arguments);
  };
  // Observateur central toutes les 2s pour les callbacks coalescés
  _origSI(function() {
    _extra.forEach(function(fn) { try { fn(); } catch(e) {} });
  }, 2000);
  // Après 30s remettre setInterval normal (widgets tiers, etc.)
  setTimeout(function() { window.setInterval = _origSI; }, 30000);
})();

/* ── FIX 5 : Désactiver will-change sur éléments statiques
   consomme de la mémoire GPU inutilement sur mobile          ── */
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.section-hidden').forEach(function(el) {
    el.style.willChange = 'auto';
  });
});
})();
