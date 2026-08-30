
(function(){
  var wrap = document.getElementById('ambiSplashStars');
  var splash = document.getElementById('ambiSplash');
  if(!wrap || !splash) return;
  var COUNT = 220;
  var frag = document.createDocumentFragment();
  for(var i=0;i<COUNT;i++){
    var s = document.createElement('span');
    s.className = 'ambi-star';
    var size = (Math.random()*1.1+0.4).toFixed(2);
    s.style.width = size+'px';
    s.style.height = size+'px';
    s.style.left = (Math.random()*100).toFixed(2)+'%';
    s.style.setProperty('--ambi-drift', (Math.random()*30-15).toFixed(1)+'px');
    s.style.animationDuration = (Math.random()*0.9+0.7).toFixed(2)+'s';
    s.style.animationDelay = (Math.random()*1.8).toFixed(2)+'s';
    s.style.opacity = (Math.random()*0.5+0.5).toFixed(2);
    frag.appendChild(s);
  }
  wrap.appendChild(frag);

  var MIN_MS = 1600, start = Date.now();
  function hideAmbiSplash(){
    var wait = Math.max(0, MIN_MS-(Date.now()-start));
    setTimeout(function(){
      splash.classList.add('ambi-splash-hide');
      setTimeout(function(){ if(splash.parentNode) splash.parentNode.removeChild(splash); }, 650);
    }, wait);
  }
  if(document.readyState==='complete'){ hideAmbiSplash(); }
  else { window.addEventListener('load', hideAmbiSplash); }
  setTimeout(hideAmbiSplash, 5000); // filet de sécurité
})();
