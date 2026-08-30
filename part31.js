
(function(){
  'use strict';
  document.addEventListener('DOMContentLoaded',function(){
    document.querySelectorAll('*').forEach(function(el){
      if(el.children.length===0&&el.textContent.trim()==='⌛ Chargement...'&&!el._ambiPatched){
        el._ambiPatched=true;
        var parent=el.parentElement;if(!parent)return;
        var skel=document.createElement('div');
        skel.className='tdm-skeleton';
        skel.innerHTML='<div class="tdm-skel-card"></div><div class="tdm-skel-card"></div><div class="tdm-skel-card"></div>';
        var skelId='_skel_'+Math.random().toString(36).slice(2);skel.id=skelId;
        el.style.display='none';parent.insertBefore(skel,el);
        setTimeout(function(){
          var s=document.getElementById(skelId);
          if(s){s.style.transition='opacity .4s';s.style.opacity='0';setTimeout(function(){if(s.parentElement)s.remove();},400);}
          if(el.style.display==='none'){el.style.display='';el.textContent='— Aucun résultat pour l\'instant';}
        },5000);
      }
    });
    document.querySelectorAll('img:not([loading])').forEach(function(img,i){if(i>2){img.setAttribute('loading','lazy');img.setAttribute('decoding','async');}});
  });
  var _orig=window.setInterval,_n=0;
  window.setInterval=function(fn,delay){
    if(delay===800&&_n<3){_n++;var tid;tid=_orig.call(window,function(){fn();if(window.currentUserUID){clearInterval(tid);window.setInterval=_orig;}},2000);return tid;}
    return _orig.apply(window,arguments);
  };
  setTimeout(function(){document.querySelectorAll('.live-dot,.heb-dot,.dispo-updated-dot,.cef-live,.hero-eyebrow-dot').forEach(function(d){d.style.willChange='auto';});},10000);
  console.log('[AMBI241] Patch performance OK');
})();
