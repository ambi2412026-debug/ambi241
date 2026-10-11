
/* ── Supprime délai 300ms sur les boutons du Forum ComposeBar (📷🎬 + texte) ── */
(function(){
  function boostForumCompose(){
    var cb = document.getElementById('forumComposeBar');
    if(!cb) return;
    var targets = cb.querySelectorAll('button, [onclick], div[style*="cursor:pointer"]');
    targets.forEach(function(el){
      if(el._forumTouchBoosted) return;
      el._forumTouchBoosted = true;
      el.style.touchAction = 'manipulation'; /* supprime double-tap zoom = retire délai 300ms */
      el.addEventListener('touchstart', function(e){ var t=e.touches&&e.touches[0]; el._ts=t?{x:t.clientX,y:t.clientY,s:Date.now()}:null; }, {passive:true});
      el.addEventListener('touchend', function(e){
        var t0=el._ts, t1=e.changedTouches&&e.changedTouches[0]; el._ts=null;
        if(!t0||!t1||Math.abs(t1.clientX-t0.clientX)>10||Math.abs(t1.clientY-t0.clientY)>10||(Date.now()-t0.s)>600) return;
        var modal = document.querySelector('#forumPubModal.open, #forumInviteOverlay[style*="flex"]');
        if(modal) return;
        e.preventDefault();
        el.click();
      }, {passive:false});
    });
    /* Aussi le container lui-même */
    if(!cb._forumTouchBoosted){
      cb._forumTouchBoosted = true;
      cb.style.touchAction = 'manipulation';
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(boostForumCompose, 900); });
  } else { setTimeout(boostForumCompose, 900); }
})();
