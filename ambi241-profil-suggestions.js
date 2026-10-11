// AMBI241 — "Personnes que tu pourrais connaitre" aussi dans l'onglet Profil
(function () {
  'use strict';
  function logged() { var u = window.currentUserUID; return !!(u && String(u).indexOf('anon_') !== 0); }
  var loadedFor = '';

  function mirror() {
    var src = document.getElementById('suggestionsRow');
    var dst = document.getElementById('suggestionsRowProfil');
    if (src && dst && dst.innerHTML !== src.innerHTML) dst.innerHTML = src.innerHTML;
  }

  function wrapRender() {
    if (typeof window.renderSuggestions !== 'function') return false;
    if (window.renderSuggestions.__pf) return true;
    var orig = window.renderSuggestions;
    var w = function () {
      var r = orig.apply(this, arguments);
      try { mirror(); } catch (e) {}
      return r;
    };
    w.__pf = true;
    window.renderSuggestions = w;
    return true;
  }

  function sync() {
    var strip = document.getElementById('profilSuggestStrip');
    if (!logged()) { if (strip) strip.remove(); loadedFor = ''; return; }
    var sec = document.getElementById('sec-profil');
    if (!sec) return;
    if (!strip || strip.parentNode !== sec) {
      if (strip) strip.remove();
      strip = document.createElement('div');
      strip.id = 'profilSuggestStrip';
      strip.className = 'soc-suggest-strip';
      strip.innerHTML = '<div class="soc-suggest-label">\u2728 Personnes que tu pourrais conna\u00eetre</div>' +
                        '<div class="soc-suggest-row" id="suggestionsRowProfil"></div>';
      sec.insertBefore(strip, sec.firstChild);
    }
    if (loadedFor !== window.currentUserUID) {
      loadedFor = window.currentUserUID;
      try { if (typeof window._socLoadMembresFirebase === 'function') window._socLoadMembresFirebase(); } catch (e) {}
      try { if (typeof window.renderSuggestions === 'function') window.renderSuggestions(); } catch (e) {}
    }
    mirror();
  }

  var k = 0;
  var iv = setInterval(function () { if (wrapRender() || ++k > 60) clearInterval(iv); }, 500);
  setInterval(sync, 1500);
})();
