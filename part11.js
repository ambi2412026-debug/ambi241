
(function(){
  var canvas = document.getElementById('fireworksCanvas');
  var ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  var particles = [];
  var done = false;

  /* ── Formes étoile ── */
  function drawStar(cx, cy, spikes, outerR, innerR, color, alpha, rot){
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    for(var i=0;i<spikes*2;i++){
      var r = i%2===0 ? outerR : innerR;
      var a = (Math.PI/spikes)*i - Math.PI/2;
      i===0 ? ctx.moveTo(Math.cos(a)*r, Math.sin(a)*r)
             : ctx.lineTo(Math.cos(a)*r, Math.sin(a)*r);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    /* shadowBlur supprimé — trop coûteux sur mobile */
    ctx.fill();
    ctx.restore();
  }

  /* ── Palette dorée ── */
  var GOLDS = ['#ffd700','#ffec6e','#fff0a0','#ffb300','#ffe066','#ffffff'];

  /* ── Créer une salve ── */
  function burst(cx, cy, count){
    for(var i=0;i<count;i++){
      var angle = (Math.PI*2/count)*i + (Math.random()-0.5)*0.3;
      var speed = 1.8 + Math.random()*3.5;
      var size  = 2 + Math.random()*4;
      var color = GOLDS[Math.floor(Math.random()*GOLDS.length)];
      particles.push({
        x:cx, y:cy,
        vx: Math.cos(angle)*speed,
        vy: Math.sin(angle)*speed,
        size: size,
        color: color,
        alpha: 1,
        rot: Math.random()*Math.PI*2,
        rotV: (Math.random()-0.5)*0.2,
        gravity: 0.05 + Math.random()*0.03,
        life: 1,
        decay: 0.045 + Math.random()*0.03
      });
    }
  }

  /* ── Séquence de salves réduite ── */
  var W = canvas.width, H = canvas.height;
  var salves = [
    { t:40,  cx:W*0.5,  cy:H*0.38, n:18 },
    { t:130, cx:W*0.25, cy:H*0.45, n:14 },
    { t:130, cx:W*0.75, cy:H*0.42, n:14 },
    { t:240, cx:W*0.5,  cy:H*0.32, n:16 },
  ];

  var start = null;

  function frame(ts){
    if(!start) start = ts;
    var elapsed = ts - start;

    /* Déclencher les salves au bon moment */
    salves.forEach(function(s){
      if(!s.fired && elapsed >= s.t){
        s.fired = true;
        burst(s.cx, s.cy, s.n);
      }
    });

    ctx.clearRect(0,0,canvas.width,canvas.height);

    var alive = false;
    particles.forEach(function(p){
      if(p.alpha <= 0) return;
      alive = true;
      p.x  += p.vx;
      p.y  += p.vy;
      p.vy += p.gravity;
      p.vx *= 0.985;
      p.rot += p.rotV;
      p.life -= p.decay;
      p.alpha = Math.max(0, p.life);
      drawStar(p.x, p.y, 5, p.size, p.size*0.42, p.color, p.alpha, p.rot);
    });

    /* Continuer tant que des particules ou des salves restent */
    var allFired = salves.every(function(s){ return s.fired; });
    if(!allFired || alive){
      requestAnimationFrame(frame);
    } else {
      /* Nettoyer le canvas et le retirer */
      ctx.clearRect(0,0,canvas.width,canvas.height);
      canvas.style.display='none';
    }
  }

  /* Lancer après un léger délai (page chargée) */
  window.addEventListener('load', function(){
    setTimeout(function(){
      requestAnimationFrame(frame);
    }, 300);
  });
})();
