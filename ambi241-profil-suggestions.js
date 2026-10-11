// AMBI241 — "Personnes que tu pourrais connaitre" dans l'onglet Profil, avant "Informations & Acces"
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
    var t = sec.querySelector('.ambiInfo-title');
    var anchor = t ? t.parentNode : null;
    if (!anchor || !anchor.parentNode) { if (strip) strip.style.display = 'none'; return; }
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'profilSuggestStrip';
      strip.className = 'soc-suggest-strip';
      strip.innerHTML = '<div class="soc-suggest-label">\u2728 Personnes que tu pourrais conna\u00eetre</div>' +
                        '<div class="soc-suggest-row" id="suggestionsRowProfil"></div>';
    }
    strip.style.display = '';
    if (strip.parentNode !== anchor.parentNode || strip.nextElementSibling !== anchor) {
      anchor.parentNode.insertBefore(strip, anchor);
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
