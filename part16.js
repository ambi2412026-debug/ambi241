
/* ═══ AMBI241 — Animations v2.1 Stable ═══ */
(function(){
'use strict';
var REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ─── Scroll progress bar (throttlé) ─── */
var bar = document.createElement('div');
bar.id = 'ambi-progress';
document.body.appendChild(bar);
var _ticking = false;
window.addEventListener('scroll', function(){
  if(_ticking) return;
  _ticking = true;
  requestAnimationFrame(function(){
    var s = window.scrollY, t = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (t > 0 ? Math.min(100,(s/t)*100) : 0) + '%';
    _ticking = false;
  });
}, {passive:true});

if(REDUCED) return; /* Pas d'animations si prefers-reduced-motion */

/* ─── Shimmer sur type-tiles (injecté une seule fois) ─── */
document.addEventListener('DOMContentLoaded', function(){
  document.querySelectorAll('.type-tile').forEach(function(t){
    if(!t.querySelector('.tt-shim')){
      var s = document.createElement('span');
      s.className = 'tt-shim';
      t.appendChild(s);
    }
  });
});

/* ─── Floating particles — SUPPRIMÉES (gain : setInterval + DOM churn + 6 layers GPU) ─── */
/* spawnParticle désactivé */

/* ─── Click/tap burst SUPPRIMÉ (fleurs/étoiles désactivées) ─── */

/* ─── Nav bloom SUPPRIMÉ ─── */

/* ─── Scroll reveal léger (cartes uniquement) ─── */
if('IntersectionObserver' in window){
  var obs = new IntersectionObserver(function(entries){
    entries.forEach(function(e){
      if(e.isIntersecting){
        e.target.classList.add('card-reveal');
        obs.unobserve(e.target);
      }
    });
  }, {threshold:0.06, rootMargin:'0px 0px -10px 0px'});
  function observeOnce(){
    document.querySelectorAll('.card:not(.card-reveal)').forEach(function(c){obs.observe(c);});
  }
  setTimeout(observeOnce, 500);
}
})();
