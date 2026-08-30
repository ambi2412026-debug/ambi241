
(function(){
'use strict';

var GEO_MAX = 200;
var _pending = null;
var _origInline  = null;
var _origLanding = null;

/* Attendre que les fonctions originales soient chargees */
function _hookWhenReady(){
  if(typeof window.ambiQrCastVoteInline === 'function' && !window._geoHookDone){
    window._geoHookDone = true;
    _origInline  = window.ambiQrCastVoteInline;
    _origLanding = window.ambiQrCastVoteLanding;
    _patchFunctions();
  } else if(!window._geoHookDone){
    setTimeout(_hookWhenReady, 300);
  }
}

function _patchFunctions(){

  window.ambiQrCastVoteInline = function(direction, isOwnerTest){
    var etabId = window._qrCurrentEtabId;
    if(!etabId) return;
    if(!window.currentUserUID){ if(typeof window.ambiQrGoToSignup==='function') window.ambiQrGoToSignup(); return; }
    if(!isOwnerTest && !_isOwner(etabId) && !window.isAdmin){
      var k='ambi241_qrvote_'+etabId+'_'+(window.currentUserUID||'anon')+'_'+new Date().toISOString().slice(0,7);
      try{ if(localStorage.getItem(k)){ if(typeof showToast==='function') showToast('✅ Vous avez deja vote ce mois !'); return; } }catch(e){}
    }
    var etab=(window.etablissements||[]).find(function(e){return String(e.id)===String(etabId);});
    if(!etab||!etab.lat||!etab.lng){ _origInline(direction,isOwnerTest); return; }
    _pending={etabId:etabId,direction:direction,isOwnerTest:!!isOwnerTest,isLanding:false};
    _show(etab,direction);
  };

  window.ambiQrCastVoteLanding = function(direction){
    var etabId = window._qrLandingEtabId;
    if(!etabId) return;
    if(!window.currentUserUID){ if(typeof window.ambiQrGoToSignup==='function') window.ambiQrGoToSignup(); return; }
    var k='ambi241_qrvote_'+etabId+'_'+(window.currentUserUID||'anon')+'_'+new Date().toISOString().slice(0,7);
    try{ if(localStorage.getItem(k)){ if(typeof showToast==='function') showToast('✅ Vous avez deja vote ce mois !'); return; } }catch(e){}
    var etab=(window.etablissements||[]).find(function(e){return String(e.id)===String(etabId);});
    if(!etab||!etab.lat||!etab.lng){ _origLanding(direction); return; }
    _pending={etabId:etabId,direction:direction,isOwnerTest:false,isLanding:true};
    _show(etab,direction);
  };
}

function _isOwner(id){
  var e=(window.etablissements||[]).find(function(x){return String(x.id)===String(id);});
  if(!e) return false;
  return (window.currentUserUID&&e.ownerUID===window.currentUserUID)||
         (window.currentUserEmail&&e.email&&e.email.toLowerCase()===(window.currentUserEmail||'').toLowerCase());
}

function _el(id){ return document.getElementById(id)||{style:{},className:'',textContent:''}; }

function _show(etab, direction){
  var m=document.getElementById('ambiQrGeoModal');
  if(!m) return;
  _el('qrGeoState').className='qr-geo-state loading';
  _el('qrGeoState').textContent='\uD83D\uDCE1';
  _el('qrGeoMsg').textContent='Verification de votre position en cours...';
  _el('qrGeoDist').style.display='none';
  _el('qrGeoConfirmBtn').style.display='none';
  _el('qrGeoRetryBtn').style.display='none';
  _el('qrGeoEtabName').textContent=etab.nom||'Etablissement';
  var vd=_el('qrGeoVoteDir');
  vd.textContent=direction==='pos'?'\uD83D\uDC4D Top ambiance !':'\uD83D\uDC4E Decu...';
  vd.className='qr-geo-vote-dir '+(direction==='pos'?'pos':'neg');
  m.classList.add('open');
  document.body.style.overflow='hidden';
  _check(parseFloat(etab.lat),parseFloat(etab.lng));
}

function _haversineM(la1,lo1,la2,lo2){
  var R=6371000,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
  var a=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

function _check(eLat, eLng){
  if(!navigator.geolocation){ _setState('error','\u26A0\uFE0F','Geolocalisation non supportee.', true); return; }
  navigator.geolocation.getCurrentPosition(
    function(pos){
      var dist=_haversineM(pos.coords.latitude,pos.coords.longitude,eLat,eLng);
      var dr=Math.round(dist);
      var d=_el('qrGeoDist'); d.style.display='flex';
      _el('qrGeoDistNum').textContent=dr+' m';
      var pct=Math.min(100,(dist/GEO_MAX)*100);
      var bar=_el('qrGeoDistBar'); bar.style.width=pct+'%';
      bar.className='qr-geo-bar-fill '+(dist<=GEO_MAX?'ok':'bad');
      if(dist<=GEO_MAX){
        _setState('ok','\u2705','Position confirmee ! Vous etes bien sur place.',false,true);
        setTimeout(function(){ var mm=document.getElementById('ambiQrGeoModal'); if(mm&&mm.classList.contains('open')) window._qrGeoConfirm(); },1500);
      } else {
        _setState('error','\uD83D\uDCCD','Vous devez etre physiquement present.\nDistance : '+dr+' m (max '+GEO_MAX+' m autorisés).',true);
      }
    },
    function(err){
      var msg='Impossible d\'obtenir votre position.';
      if(err.code===1) msg='\uD83D\uDD12 Acces localisation refuse.\nActivez-la dans vos reglages.';
      else if(err.code===2) msg='\uD83D\uDCE1 Signal GPS indisponible. Essayez en exterieur.';
      else if(err.code===3) msg='\u23F1 Delai GPS depasse. Reessayez.';
      _setState('error','\u26A0\uFE0F',msg,true);
    },
    {enableHighAccuracy:true,timeout:12000,maximumAge:0}
  );
}

function _setState(cls, icon, msg, showRetry, showConfirm){
  var s=_el('qrGeoState'); s.className='qr-geo-state '+cls; s.textContent=icon;
  _el('qrGeoMsg').textContent=msg;
  _el('qrGeoRetryBtn').style.display=showRetry?'block':'none';
  _el('qrGeoConfirmBtn').style.display=showConfirm?'block':'none';
}

window._qrGeoConfirm = function(){
  var m=document.getElementById('ambiQrGeoModal');
  if(m) m.classList.remove('open');
  document.body.style.overflow='';
  if(!_pending) return;
  var pv=_pending; _pending=null;
  if(pv.isLanding){ _origLanding(pv.direction); }
  else             { _origInline(pv.direction,pv.isOwnerTest); }
};

window._qrGeoRetry = function(){
  if(!_pending) return;
  var etab=(window.etablissements||[]).find(function(e){return String(e.id)===String(_pending.etabId);});
  if(!etab) return;
  _setState('loading','\uD83D\uDCE1','Verification de votre position...',false,false);
  _el('qrGeoDist').style.display='none';
  _check(parseFloat(etab.lat),parseFloat(etab.lng));
};

window._qrGeoCancel = function(){
  _pending=null;
  var m=document.getElementById('ambiQrGeoModal');
  if(m) m.classList.remove('open');
  document.body.style.overflow='';
};

_hookWhenReady();

})();
