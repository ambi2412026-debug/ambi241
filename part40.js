
/* ═══════════════════════════════════════
   FICHES SECTORIELLES — Module AMBI241
   ═══════════════════════════════════════ */
(function(){
function fShowSector(sector) {
  document.querySelectorAll('#sec-fiches .fiche-wrap').forEach(function(f){ f.classList.remove('visible'); });
  document.querySelectorAll('#sec-fiches .stab').forEach(function(t){ t.classList.remove('active'); });
  var fiche = document.getElementById('fiche-fs-' + sector);
  if (fiche) fiche.classList.add('visible');
  var tab = document.querySelector('#sec-fiches .stab-' + sector);
  if (tab) tab.classList.add('active');
}
window.fShowSector = fShowSector;

function fProTab(prefix, pane, btn) {
  document.querySelectorAll('[id^="fs-' + prefix + '-pane-"]').forEach(function(p){ p.classList.remove('active'); });
  if (btn) {
    btn.closest('.pro-tabs').querySelectorAll('.pro-tab').forEach(function(t){ t.classList.remove('active'); });
    btn.classList.add('active');
  }
  var target = document.getElementById('fs-' + prefix + '-pane-' + pane);
  if (target) target.classList.add('active');
}
window.fProTab = fProTab;

// Init listeners fiches (appelé au lazy-load de la section)
function initFichesModule() {
  var section = document.getElementById('sec-fiches');
  if (!section || section._fichesInit) return;
  section._fichesInit = true;

  // Sliders
  section.querySelectorAll('.pro-slider').forEach(function(slider) {
    slider.addEventListener('input', function() {
      this.nextElementSibling.textContent = this.value + '%';
    });
  });
  // Chips toggle
  section.querySelectorAll('.pro-chip').forEach(function(chip) {
    chip.addEventListener('click', function() { this.classList.toggle('sel'); });
  });
  // Stat btns
  section.querySelectorAll('.pro-stat-row').forEach(function(row) {
    row.querySelectorAll('.pro-stat-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        row.querySelectorAll('.pro-stat-btn').forEach(function(b){ b.classList.remove('open','closed','busy','calm'); });
        var txt = this.textContent;
        if (txt.includes('Ouvert')) this.classList.add('open');
        else if (txt.includes('Fermé')) this.classList.add('closed');
        else if (txt.includes('Bondé') || txt.includes('Complet')) this.classList.add('busy');
        else if (txt.includes('Calme') || txt.includes('Peu')) this.classList.add('calm');
      });
    });
  });
  // Dispo counters
  section.querySelectorAll('.pro-dispo-ctrl').forEach(function(ctrl) {
    var minus = ctrl.children[0], span = ctrl.children[1], plus = ctrl.children[2];
    if (!minus || !span || !plus) return;
    minus.addEventListener('click', function() {
      var v = Math.max(0, (parseInt(span.textContent) || 0) - 1);
      span.textContent = v;
      span.className = 'pro-dispo-num' + (v===0?' zero':v<=3?' low':'');
    });
    plus.addEventListener('click', function() {
      var v = (parseInt(span.textContent) || 0) + 1;
      span.textContent = v;
      span.className = 'pro-dispo-num' + (v===0?' zero':v<=3?' low':'');
    });
  });
  // Save btns
  section.querySelectorAll('.pro-save-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var orig = this.textContent;
      this.textContent = '✅ Sauvegardé !';
      this.style.background = 'linear-gradient(135deg,var(--green),#009966)';
      var self = this;
      setTimeout(function() { self.textContent = orig; self.style.background = ''; }, 2000);
    });
  });
}
window.initFichesModule = initFichesModule;

// Hook dans le lazy-load système existant
var _origLazy = window._lazyInitSection;
window._lazyInitSection = function(name) {
  if (typeof _origLazy === 'function') _origLazy(name);
  if (name === 'fiches') initFichesModule();
};
})();
