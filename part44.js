
/* ── Sensibilité nav : supprime délai 300ms + zone tactile élargie ── */
(function(){
  function boostNav(){
    var bottomNav = document.querySelector('.bottom-nav');
    if(!bottomNav) return;
    bottomNav.querySelectorAll('.nav-item').forEach(function(btn){
      if(btn._touchBoosted) return;
      btn._touchBoosted = true;
      /* touchAction manipulation = supprime double-tap zoom (300ms) */
      btn.style.touchAction = 'manipulation';
      var _touchMoved = false;
      var _touchStartX, _touchStartY;
      btn.addEventListener('touchstart', function(e){
        _touchMoved = false;
        _touchStartX = e.touches[0].clientX;
        _touchStartY = e.touches[0].clientY;
        /* Feedback visuel immédiat */
        btn.style.transform = 'scale(0.93)';
        btn.style.transition = 'transform 0.08s, color 0.08s';
      }, {passive:true});
      btn.addEventListener('touchmove', function(e){
        var dx = Math.abs(e.touches[0].clientX - _touchStartX);
        var dy = Math.abs(e.touches[0].clientY - _touchStartY);
        if(dx > 6 || dy > 6) _touchMoved = true;
        if(_touchMoved){
          btn.style.transform = '';
        }
      }, {passive:true});
      btn.addEventListener('touchend', function(e){
        btn.style.transform = '';
        if(_touchMoved) return;
        /* Hors modal : déclencher immédiatement sans délai */
        var modal = document.querySelector('.overlay.show, [id$="Overlay"].show');
        if(modal) return;
        e.preventDefault();
        btn.click();
      }, {passive:false});
      btn.addEventListener('touchcancel', function(){
        _touchMoved = true;
        btn.style.transform = '';
      }, {passive:true});
    });
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boostNav);
  } else { boostNav(); }
  setTimeout(boostNav, 600);
  setTimeout(boostNav, 1500); /* fallback si nav injectée tard */
})();
