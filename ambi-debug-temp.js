(function(){
  var log=document.createElement('div');
  log.id='ambiDebugOverlay';
  log.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:black;color:#0f0;font-size:10px;padding:4px;max-height:150px;overflow:auto;font-family:monospace;';
  document.body.appendChild(log);
  function line(t){var d=document.createElement('div');d.textContent=t;log.appendChild(d);log.scrollTop=log.scrollHeight;}
  var count=0;
  var iv=setInterval(function(){
    count++;
    var tile=document.querySelector('.type-tile-bar');
    var bg=tile?tile.querySelector('.tt-bgphoto'):null;
    if(tile&&bg){
      var cs=getComputedStyle(bg);
      line(count+'s cls='+tile.className+' bg='+cs.backgroundImage.substring(0,50)+' op='+cs.opacity+' disp='+cs.display);
    } else {
      line(count+'s INTROUVABLE tile='+!!tile+' bg='+!!bg);
    }
    if(count>=15) clearInterval(iv);
  },1000);
})();
