(function(){
'use strict';

/* ─── État global monétisation ─── */
var _moState = {
  boosts: [],
  pubs: [],
  revenus: [],
  eventFlash: [],
  loaded: false
};

/* ─── Charger depuis Firebase ─── */
function loadMonetisationData(cb){
  if(!window.db || !window.fbCollection || !window.fbGetDocs){
    _moState.loaded = true; if(cb) cb(); return;
  }
  var promises = [];
  // Boosts
  promises.push(window.fbGetDocs(window.fbCollection(window.db,'monetisation_boosts')).then(function(s){
    _moState.boosts=[];s.forEach(function(d){_moState.boosts.push(Object.assign({_docId:d.id},d.data()));});
  }).catch(function(){}));
  // Pubs
  promises.push(window.fbGetDocs(window.fbCollection(window.db,'monetisation_pubs')).then(function(s){
    _moState.pubs=[];s.forEach(function(d){_moState.pubs.push(Object.assign({_docId:d.id},d.data()));});
  }).catch(function(){}));
  // Revenus (paiements abonnements existants)
  _moState.revenus = (window.paiements||[]).slice();
  // Events flash actifs sur les étabs
  _moState.eventFlash = (window.etablissements||[]).filter(function(e){
    return e.event_flash && e.event_flash.texte && Date.now()<(e.event_flash.expire||0);
  }).map(function(e){ return Object.assign({etabNom:e.nom},e.event_flash); });
  _moState.loaded = true;
  if(cb) cb();
}

/* ─── Render principal Monétisation Admin ─── */
window.renderAdmMonetisation = function(){
  var container = document.getElementById('adminMonetisationContent');
  if(!container) return;
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.82rem;">⏳ Chargement monétisation…</div>';
  loadMonetisationData(function(){
    var html = _buildMonetisHeader() + _buildMonetRevenu() + _buildMonetBoosts() + _buildMonetPubs() + _buildMonetEventFlash();
    container.innerHTML = html;
  });
};

function _buildMonetisHeader(){
  var totalAbos = (window.paiements||[]).filter(function(p){ return p.statut==='Confirme'; }).length;
  var totalRev  = totalAbos * 5000;
  var totalPubs = _moState.pubs.filter(function(p){ return p.statut==='active'; }).length;
  var totalBoosts = _moState.boosts.filter(function(b){ return b.actif; }).length;
  return '<div style="background:linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,45,155,0.08));border:1.5px solid rgba(255,215,0,0.35);border-radius:18px;padding:1.3rem;margin-bottom:1.2rem;position:relative;overflow:hidden;" class="admin-monetis-card">'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.75rem;color:var(--amber);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.8rem;">💰 Vue d\'ensemble Monétisation</div>'
    +'<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.6rem;">'
    +'<div style="background:rgba(0,255,170,0.07);border:1px solid rgba(0,255,170,0.2);border-radius:12px;padding:0.8rem;text-align:center;">'
    +'<div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;color:var(--green);">'+totalRev.toLocaleString('fr-FR')+'</div>'
    +'<div style="font-size:0.6rem;color:var(--muted);">XAF/mois (abos actifs)</div></div>'
    +'<div style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:0.8rem;text-align:center;">'
    +'<div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;color:var(--amber);">'+totalAbos+'</div>'
    +'<div style="font-size:0.6rem;color:var(--muted);">Abonnés actifs</div></div>'
    +'<div style="background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:0.8rem;text-align:center;">'
    +'<div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;color:var(--cyan);">'+totalBoosts+'</div>'
    +'<div style="font-size:0.6rem;color:var(--muted);">Boosts actifs</div></div>'
    +'<div style="background:rgba(204,68,255,0.07);border:1px solid rgba(204,68,255,0.2);border-radius:12px;padding:0.8rem;text-align:center;">'
    +'<div style="font-family:Syne,sans-serif;font-size:1.4rem;font-weight:800;color:var(--purple);">'+totalPubs+'</div>'
    +'<div style="font-size:0.6rem;color:var(--muted);">Pubs actives</div></div>'
    +'</div></div>';
}

function _buildMonetRevenu(){
  var list = (window.paiements||[]).slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var html = '<div style="margin-bottom:1.2rem;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--green);font-size:0.88rem;">💳 Revenus & Abonnements</div>'
    +'<span style="font-size:0.68rem;color:var(--muted);">'+list.length+' enregistrements</span></div>';
  if(!list.length){
    html += '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.78rem;">Aucun paiement enregistré</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
    list.slice(0,12).forEach(function(p){
      var isOk = p.statut==='Confirme';
      html += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.65rem 0.9rem;display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-size:0.78rem;font-weight:700;color:var(--text);">'+escHtml(p.nom||'—')+'</div>'
        +'<div style="font-size:0.6rem;color:var(--muted);">'+escHtml(p.mode||'')+(p.date?' · '+escHtml(p.date):'')+'</div></div>'
        +'<div style="text-align:right;">'
        +'<div style="font-family:Syne,sans-serif;font-size:0.85rem;font-weight:800;color:'+(isOk?'var(--green)':'var(--amber)')+';">'+((p.montant||0).toLocaleString('fr-FR'))+' XAF</div>'
        +'<div style="font-size:0.58rem;background:'+(isOk?'rgba(0,255,170,0.1)':'rgba(255,215,0,0.1)')+';color:'+(isOk?'var(--green)':'var(--amber)')+';padding:0.06rem 0.4rem;border-radius:5px;">'+escHtml(p.statut||'—')+'</div>'
        +'</div></div>';
    });
    html += '</div>';
    if(list.length>12) html += '<div style="text-align:center;font-size:0.7rem;color:var(--muted);padding:0.5rem;">… et '+(list.length-12)+' autres</div>';
  }
  html += '</div>';
  return html;
}

function _buildMonetBoosts(){
  var etabs = window.etablissements||[];
  var html = '<div style="margin-bottom:1.2rem;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:0.88rem;">🚀 Boosts Visibilité</div>'
    +'<button onclick="openBoostModal()" style="background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.35);color:var(--cyan);font-size:0.68rem;font-weight:700;padding:0.3rem 0.6rem;border-radius:8px;cursor:pointer;font-family:DM Sans,sans-serif;">+ Nouveau Boost</button>'
    +'</div>'
    +'<div style="background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.15);border-radius:14px;padding:0.9rem;margin-bottom:0.6rem;">'
    +'<div style="font-size:0.72rem;color:var(--muted);line-height:1.7;margin-bottom:0.6rem;">Un <strong style="color:var(--cyan)">Boost</strong> propulse un établissement en tête de liste pendant une durée définie. Les établissements boostés apparaissent avec un badge ⚡ visible de tous les utilisateurs.</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.4rem;">'
    +'<div style="background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);border-radius:10px;padding:0.55rem;text-align:center;cursor:pointer;" onclick="openBoostModal(\'24h\')">'
    +'<div style="font-size:1rem;margin-bottom:0.15rem;">⚡</div>'
    +'<div style="font-family:Syne,sans-serif;font-size:0.72rem;font-weight:800;color:var(--cyan);">24h</div>'
    +'<div style="font-size:0.58rem;color:var(--muted);">2 500 XAF</div></div>'
    +'<div style="background:rgba(0,229,255,0.1);border:2px solid rgba(0,229,255,0.4);border-radius:10px;padding:0.55rem;text-align:center;cursor:pointer;" onclick="openBoostModal(\'3j\')">'
    +'<div style="font-size:1rem;margin-bottom:0.15rem;">⚡⚡</div>'
    +'<div style="font-family:Syne,sans-serif;font-size:0.72rem;font-weight:800;color:var(--cyan);">3 jours</div>'
    +'<div style="font-size:0.58rem;color:var(--green);">6 000 XAF</div>'
    +'<div style="font-size:0.48rem;background:rgba(0,255,170,0.15);color:var(--green);border-radius:4px;padding:0.06rem 0.25rem;margin-top:0.1rem;">Populaire</div></div>'
    +'<div style="background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);border-radius:10px;padding:0.55rem;text-align:center;cursor:pointer;" onclick="openBoostModal(\'7j\')">'
    +'<div style="font-size:1rem;margin-bottom:0.15rem;">⚡⚡⚡</div>'
    +'<div style="font-family:Syne,sans-serif;font-size:0.72rem;font-weight:800;color:var(--cyan);">7 jours</div>'
    +'<div style="font-size:0.58rem;color:var(--amber);">12 000 XAF</div></div>'
    +'</div></div>';

  var actifs = (window.etablissements||[]).filter(function(e){ return e.boost_expire && Date.now()<e.boost_expire; });
  if(actifs.length){
    html += '<div style="font-size:0.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.4rem;">⚡ Boosts en cours ('+actifs.length+')</div>'
      +'<div style="display:flex;flex-direction:column;gap:0.35rem;">';
    actifs.forEach(function(e){
      var left = Math.ceil((e.boost_expire - Date.now())/3600000);
      html += '<div style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.2);border-radius:10px;padding:0.55rem 0.8rem;display:flex;justify-content:space-between;align-items:center;">'
        +'<div style="font-size:0.78rem;font-weight:700;color:var(--text);">⚡ '+escHtml(e.nom)+'</div>'
        +'<div style="display:flex;align-items:center;gap:0.4rem;">'
        +'<span style="font-size:0.62rem;color:var(--cyan);">'+left+'h restantes</span>'
        +'<button onclick="cancelBoost(\''+escHtml(e._docId||String(e.id))+'\')" style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:var(--red);font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:5px;cursor:pointer;font-family:DM Sans,sans-serif;">Annuler</button>'
        +'</div></div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:0.8rem;color:var(--muted);font-size:0.72rem;">Aucun boost actif en ce moment.</div>';
  }
  html += '</div>';
  return html;
}

function _buildMonetPubs(){
  var html = '<div style="margin-bottom:1.2rem;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--purple);font-size:0.88rem;">📢 Publicités & Bannières</div>'
    +'<button onclick="openPubModal()" style="background:rgba(204,68,255,0.1);border:1px solid rgba(204,68,255,0.35);color:var(--purple);font-size:0.68rem;font-weight:700;padding:0.3rem 0.6rem;border-radius:8px;cursor:pointer;font-family:DM Sans,sans-serif;">+ Créer Pub</button>'
    +'</div>'
    +'<div style="background:rgba(204,68,255,0.04);border:1px solid rgba(204,68,255,0.15);border-radius:14px;padding:0.9rem;margin-bottom:0.6rem;">'
    +'<div style="font-size:0.72rem;color:var(--muted);line-height:1.7;margin-bottom:0.7rem;">Les <strong style="color:var(--purple)">publicités</strong> sont des bannières cliquables insérées dans la liste principale. Elles dirigent vers un lien externe (site, WhatsApp, etc).</div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;">'
    +'<div style="background:rgba(204,68,255,0.07);border:1px solid rgba(204,68,255,0.2);border-radius:10px;padding:0.65rem;text-align:center;">'
    +'<div style="font-size:1.1rem;margin-bottom:0.15rem;">📣</div>'
    +'<div style="font-family:Syne,sans-serif;font-size:0.72rem;font-weight:800;color:var(--purple);">Hebdomadaire</div>'
    +'<div style="font-size:0.58rem;color:var(--muted);">8 000 XAF / 7j</div></div>'
    +'<div style="background:rgba(204,68,255,0.1);border:2px solid rgba(204,68,255,0.4);border-radius:10px;padding:0.65rem;text-align:center;">'
    +'<div style="font-size:1.1rem;margin-bottom:0.15rem;">🏆</div>'
    +'<div style="font-family:Syne,sans-serif;font-size:0.72rem;font-weight:800;color:var(--purple);">Mensuelle</div>'
    +'<div style="font-size:0.58rem;color:var(--amber);">25 000 XAF / mois</div></div>'
    +'</div></div>';

  var pubsActives = _moState.pubs.filter(function(p){ return p.statut==='active'; });
  if(pubsActives.length){
    html += '<div style="font-size:0.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.4rem;">Pubs actives ('+pubsActives.length+')</div>'
      +'<div style="display:flex;flex-direction:column;gap:0.35rem;">';
    pubsActives.forEach(function(p){
      html += '<div style="background:rgba(204,68,255,0.05);border:1px solid rgba(204,68,255,0.2);border-radius:10px;padding:0.55rem 0.8rem;display:flex;justify-content:space-between;align-items:center;">'
        +'<div><div style="font-size:0.78rem;font-weight:700;color:var(--text);">📣 '+escHtml(p.titre||p.title||'—')+'</div>'
        +'<div style="font-size:0.6rem;color:var(--muted);">'+escHtml(p.annonceur||'')+'</div></div>'
        +'<button onclick="togglePub(\''+escHtml(p._docId||'')+'\',false)" style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:var(--red);font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:5px;cursor:pointer;font-family:DM Sans,sans-serif;">Désactiver</button>'
        +'</div>';
    });
    html += '</div>';
  } else {
    html += '<div style="text-align:center;padding:0.8rem;color:var(--muted);font-size:0.72rem;">Aucune publicité active.</div>';
  }
  html += '</div>';
  return html;
}

function _buildMonetEventFlash(){
  var evts = _moState.eventFlash;
  var html = '<div style="margin-bottom:1.2rem;">'
    +'<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;">'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.88rem;">📣 Événements Flash actifs</div>'
    +'<span style="font-size:0.68rem;background:rgba(255,45,155,0.12);color:var(--pink);padding:0.15rem 0.5rem;border-radius:8px;">'+evts.length+' en cours</span>'
    +'</div>';
  if(!evts.length){
    html += '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.78rem;">Aucun événement flash actif en ce moment.</div>';
  } else {
    html += '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
    evts.forEach(function(ev){
      var left = ev.expire ? Math.ceil((ev.expire-Date.now())/3600000) : '?';
      html += '<div class="card-event-flash" style="margin:0;border-radius:12px;">'
        +'<div class="cef-live"></div>'
        +'<div class="cef-body">'
        +'<div class="cef-tag">'+escHtml(ev.etabNom||'—')+'</div>'
        +'<div class="cef-title">'+escHtml(ev.texte||'—')+'</div>'
        +'<div class="cef-expire">⏰ '+left+'h restantes</div>'
        +'</div></div>';
    });
    html += '</div>';
  }
  html += '</div>';
  return html;
}

/* ─── Modal Boost ─── */
window.openBoostModal = function(preset){
  var etabs = window.etablissements||[];
  var opts = etabs.map(function(e){ return '<option value="'+escHtml(String(e.id))+'">'+escHtml(e.nom)+'</option>'; }).join('');
  var dureeOptions = [
    {val:'24h',label:'24 heures — 2 500 XAF'},
    {val:'3j', label:'3 jours — 6 000 XAF'},
    {val:'7j', label:'7 jours — 12 000 XAF'}
  ];
  var dureeHtml = dureeOptions.map(function(d){
    return '<option value="'+d.val+'"'+(d.val===(preset||'3j')?' selected':'')+'>'+d.label+'</option>';
  }).join('');
  var html = '<div id="_boostOverlay" style="position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)closeBoostModal()">'
    +'<div style="background:var(--surface);border:1.5px solid rgba(0,229,255,0.4);border-radius:24px;padding:1.6rem 1.4rem;width:min(380px,100%);animation:popIn 0.28s cubic-bezier(0.34,1.56,0.64,1);position:relative;">'
    +'<button onclick="closeBoostModal()" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">✕</button>'
    +'<div style="font-size:2rem;text-align:center;margin-bottom:0.5rem;">⚡</div>'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--cyan);margin-bottom:0.2rem;">Activer un Boost</div>'
    +'<div style="font-size:0.72rem;color:var(--muted);margin-bottom:1.1rem;">L\'établissement apparaîtra en tête de liste avec le badge ⚡</div>'
    +'<div class="field"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:0.3rem;">Établissement</label>'
    +'<select id="boostEtabSel" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.25);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.85rem;padding:0.6rem 0.8rem;outline:none;">'+opts+'</select></div>'
    +'<div class="field" style="margin-top:0.7rem;"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:0.3rem;">Durée</label>'
    +'<select id="boostDureeSel" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.25);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.85rem;padding:0.6rem 0.8rem;outline:none;">'+dureeHtml+'</select></div>'
    +'<button onclick="confirmBoost()" style="width:100%;margin-top:1rem;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--cyan),var(--purple));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;">⚡ Activer le Boost</button>'
    +'</div></div>';
  var w=document.createElement('div'); w.id='_boostWrap'; w.innerHTML=html;
  document.body.appendChild(w);
};
window.closeBoostModal = function(){
  var el=document.getElementById('_boostWrap'); if(el) el.remove();
};
window.confirmBoost = function(){
  var eid = (document.getElementById('boostEtabSel')||{}).value;
  var duree = (document.getElementById('boostDureeSel')||{}).value;
  if(!eid){ if(typeof showToast==='function') showToast('Sélectionnez un établissement'); return; }
  var msMap = {'24h':86400000,'3j':259200000,'7j':604800000};
  var ms = msMap[duree]||86400000;
  var expire = Date.now()+ms;
  var etab = (window.etablissements||[]).find(function(e){ return String(e.id)===String(eid); });
  if(!etab){ if(typeof showToast==='function') showToast('Établissement introuvable'); return; }
  if(window.db && window.fbDoc && window.fbUpdateDoc && etab._docId){
    window.fbUpdateDoc(window.fbDoc(window.db,'etablissements',etab._docId),{boost_expire:expire,boost_duree:duree})
      .then(function(){
        etab.boost_expire=expire; etab.boost_duree=duree;
        window.closeBoostModal();
        if(typeof showToast==='function') showToast('⚡ Boost activé pour '+etab.nom+' !');
        window.renderAdmMonetisation();
      }).catch(function(err){ if(typeof showToast==='function') showToast('Erreur: '+err.message); });
  } else {
    etab.boost_expire=expire; etab.boost_duree=duree;
    window.closeBoostModal();
    if(typeof showToast==='function') showToast('⚡ Boost activé (local) !');
    window.renderAdmMonetisation();
  }
};
window.cancelBoost = function(docId){
  if(!confirm('Annuler ce boost ?')) return;
  var etab = (window.etablissements||[]).find(function(e){ return (e._docId||String(e.id))===docId; });
  if(!etab) return;
  etab.boost_expire = 0;
  if(window.db && window.fbDoc && window.fbUpdateDoc && etab._docId){
    window.fbUpdateDoc(window.fbDoc(window.db,'etablissements',etab._docId),{boost_expire:0}).catch(function(){});
  }
  if(typeof showToast==='function') showToast('⚡ Boost annulé');
  window.renderAdmMonetisation();
};

/* ─── Modal Pub ─── */
window.openPubModal = function(){
  var html = '<div id="_pubOverlay" style="position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)closePubModal()">'
    +'<div style="background:var(--surface);border:1.5px solid rgba(204,68,255,0.4);border-radius:24px;padding:1.6rem 1.4rem;width:min(380px,100%);animation:popIn 0.28s cubic-bezier(0.34,1.56,0.64,1);position:relative;">'
    +'<button onclick="closePubModal()" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">✕</button>'
    +'<div style="font-size:2rem;text-align:center;margin-bottom:0.5rem;">📣</div>'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--purple);margin-bottom:0.2rem;">Créer une Publicité</div>'
    +'<div style="font-size:0.72rem;color:var(--muted);margin-bottom:1.1rem;">Bannière visible dans la liste principale — cliquable vers votre lien.</div>'
    +'<div class="field"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.3rem;">Titre de la pub *</label>'
    +'<input id="pubTitreInput" type="text" maxlength="60" placeholder="Ex: Grand Opening Le Royale Bar..." style="width:100%;background:var(--surface2);border:1px solid rgba(204,68,255,0.25);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.85rem;padding:0.6rem 0.8rem;outline:none;box-sizing:border-box;"></div>'
    +'<div class="field" style="margin-top:0.6rem;"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.3rem;">Annonceur</label>'
    +'<input id="pubAnnonceurInput" type="text" maxlength="40" placeholder="Nom de l\'établissement ou entreprise" style="width:100%;background:var(--surface2);border:1px solid rgba(204,68,255,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.85rem;padding:0.6rem 0.8rem;outline:none;box-sizing:border-box;"></div>'
    +'<div class="field" style="margin-top:0.6rem;"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.3rem;">Lien URL (optionnel)</label>'
    +'<input id="pubUrlInput" type="url" placeholder="https://wa.me/... ou site web" style="width:100%;background:var(--surface2);border:1px solid rgba(204,68,255,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.85rem;padding:0.6rem 0.8rem;outline:none;box-sizing:border-box;"></div>'
    +'<button onclick="savePub()" style="width:100%;margin-top:1rem;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--purple),var(--pink));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;">📣 Publier la publicité</button>'
    +'</div></div>';
  var w=document.createElement('div'); w.id='_pubWrap'; w.innerHTML=html;
  document.body.appendChild(w);
};
window.closePubModal = function(){
  var el=document.getElementById('_pubWrap'); if(el) el.remove();
};
window.savePub = function(){
  var titre = (document.getElementById('pubTitreInput')||{}).value||'';
  var annonceur = (document.getElementById('pubAnnonceurInput')||{}).value||'';
  var url = (document.getElementById('pubUrlInput')||{}).value||'';
  if(!titre.trim()){ if(typeof showToast==='function') showToast('⚠️ Saisissez un titre'); return; }
  var data = { titre:titre.trim(), annonceur:annonceur.trim(), url:url.trim(), statut:'active', createdAt:Date.now() };
  if(window.db && window.fbCollection && window.fbAddDoc){
    window.fbAddDoc(window.fbCollection(window.db,'monetisation_pubs'),data)
      .then(function(ref){ data._docId=ref.id; _moState.pubs.push(data); window.closePubModal(); if(typeof showToast==='function') showToast('📣 Pub publiée !'); window.renderAdmMonetisation(); })
      .catch(function(err){ if(typeof showToast==='function') showToast('Erreur: '+err.message); });
  } else {
    _moState.pubs.push(data); window.closePubModal(); if(typeof showToast==='function') showToast('📣 Pub créée (local) !'); window.renderAdmMonetisation();
  }
};
window.togglePub = function(docId, active){
  var pub = _moState.pubs.find(function(p){ return p._docId===docId; });
  if(!pub) return;
  pub.statut = active ? 'active' : 'inactive';
  if(window.db && window.fbDoc && window.fbUpdateDoc && docId){
    window.fbUpdateDoc(window.fbDoc(window.db,'monetisation_pubs',docId),{statut:pub.statut}).catch(function(){});
  }
  if(typeof showToast==='function') showToast(active?'📣 Pub activée':'📣 Pub désactivée');
  window.renderAdmMonetisation();
};

/* ─── Fiche admin éditable d'un établissement ─── */
function buildAdmExtraFields(etab){
  var ageOpts = ['','18-25 ans','25-35 ans','35-45 ans','45+ ans','Mixte'];
  var ageHtml = '<div style="margin-bottom:0.7rem;"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.25rem;">👥 Âge moyen clientèle</label>'
    +'<select id="etabAdm_age_clientele" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.83rem;padding:0.55rem 0.8rem;outline:none;box-sizing:border-box;">'
    +ageOpts.map(function(o){return '<option value="'+o+'"'+(etab.age_clientele===o?' selected':'')+'>'+( o||'Non précisé')+'</option>';}).join('')
    +'</select></div>';
  var dressOpts = ['','Casual','Smart casual','Tenue de soirée','Tenue africaine'];
  var dressHtml = '<div style="margin-bottom:0.7rem;"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.25rem;">👔 Dress code</label>'
    +'<select id="etabAdm_dress_code" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.83rem;padding:0.55rem 0.8rem;outline:none;box-sizing:border-box;">'
    +dressOpts.map(function(o){return '<option value="'+o+'"'+(etab.dress_code===o?' selected':'')+'>'+( o||'Non précisé')+'</option>';}).join('')
    +'</select></div>';
  var allGenres = ['Afrobeats','Rumba','Ndombolo','R&B','Hip-Hop','Coupé-Décalé','Zouk','Electronic','Reggae','Jazz','Variété','Ambiance live'];
  var curGenres = etab.genres_musicaux || [];
  var genresHtml = '<div style="margin-bottom:0.7rem;"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.4rem;">🎵 Genres musicaux</label>'
    +'<div style="display:flex;flex-wrap:wrap;gap:0.3rem;" id="etabAdm_genres_wrap">'
    +allGenres.map(function(g){
      var chk = curGenres.indexOf(g)!==-1;
      return '<label style="display:flex;align-items:center;gap:0.2rem;font-size:0.68rem;color:var(--text);background:'+(chk?'rgba(204,68,255,0.15)':'rgba(255,255,255,0.04)')+';border:1px solid '+(chk?'rgba(204,68,255,0.4)':'rgba(255,255,255,0.1)')+';border-radius:20px;padding:0.22rem 0.5rem;cursor:pointer;">'
        +'<input type="checkbox" class="etabAdmGenre" value="'+escHtml(g)+'" '+(chk?'checked':'')+' style="width:12px;height:12px;accent-color:var(--purple);">'+escHtml(g)+'</label>';
    }).join('')
    +'</div></div>';
  return ageHtml+dressHtml+genresHtml;
}
window.openEtabAdminProfile = function(eid){
  var etab = (window.etablissements||[]).find(function(e){ return String(e.id)===String(eid); });
  if(!etab){ if(typeof showToast==='function') showToast('Établissement introuvable'); return; }
  var statusMap = {'Ouvert - Bonde':'🔴 Bondé','Ouvert - Anime':'🟢 Animé','Ouvert - Calme':'🟡 Calme','Ferme':'⚫ Fermé'};
  var fields = [
    {key:'nom',label:'Nom',type:'text'},
    {key:'type',label:'Type',type:'text'},
    {key:'quartier',label:'Quartier',type:'text'},
    {key:'contact',label:'Contact / WhatsApp',type:'text'},
    {key:'description',label:'Description',type:'textarea'},
    {key:'ouverture',label:'Heure ouverture',type:'text'},
    {key:'fermeture',label:'Heure fermeture',type:'text'},
    {key:'capacite_totale',label:'🪑 Places totales',type:'number'},
    {key:'nb_vip',label:'🏆 Espaces VIP',type:'number'},
    {key:'nb_chambres',label:'🛏️ Chambres',type:'number'},
    {key:'maps_url',label:'Lien Google Maps',type:'url'}
  ];
  var inputs = fields.map(function(f){
    var val = escHtml(String(etab[f.key]||''));
    if(f.type==='textarea'){
      return '<div class="field"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.25rem;">'+f.label+'</label>'
        +'<textarea id="etabAdm_'+f.key+'" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.83rem;padding:0.55rem 0.8rem;outline:none;resize:vertical;min-height:60px;box-sizing:border-box;">'+val+'</textarea></div>';
    }
    return '<div class="field"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.25rem;">'+f.label+'</label>'
      +'<input id="etabAdm_'+f.key+'" type="'+f.type+'" value="'+val+'" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.83rem;padding:0.55rem 0.8rem;outline:none;box-sizing:border-box;"></div>';
  }).join('');
  var statutHtml = '<div class="field"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.4rem;">Statut</label>'
    +'<div style="display:flex;gap:0.3rem;flex-wrap:wrap;">'
    +['Ouvert - Bonde','Ouvert - Anime','Ouvert - Calme','Ferme'].map(function(s){
      var active = etab.statut===s;
      return '<button onclick="document.querySelectorAll(\'[data-statut-btn]\').forEach(function(x){x.style.background=\'rgba(255,255,255,0.04)\';x.style.borderColor=\'rgba(255,255,255,0.1)\'});this.style.background=\'rgba(255,45,155,0.2)\';this.style.borderColor=\'var(--pink)\';window.__etabAdmNewStatut=\''+s+'\'" data-statut-btn style="padding:0.35rem 0.6rem;border-radius:8px;border:1px solid '+(active?'var(--pink)':'rgba(255,255,255,0.1)')+';background:'+(active?'rgba(255,45,155,0.2)':'rgba(255,255,255,0.04)')+';color:var(--text);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">'+(statusMap[s]||s)+'</button>';
    }).join('')
    +'</div></div>';
  window.__etabAdmNewStatut = etab.statut;
  var paiementHtml = '<div class="field"><label style="font-size:0.68rem;color:var(--muted);font-weight:600;display:block;margin-bottom:0.4rem;">Paiement</label>'
    +'<div style="display:flex;gap:0.3rem;">'
    +['Actif','En attente','Inactif'].map(function(p){
      var active = etab.paiement===p;
      return '<button onclick="document.querySelectorAll(\'[data-pay-btn]\').forEach(function(x){x.style.background=\'rgba(255,255,255,0.04)\'});this.style.background=\'rgba(255,215,0,0.2)\';window.__etabAdmNewPaiement=\''+p+'\'" data-pay-btn style="flex:1;padding:0.35rem 0.4rem;border-radius:8px;border:1px solid rgba(255,215,0,0.3);background:'+(active?'rgba(255,215,0,0.2)':'rgba(255,255,255,0.04)')+';color:var(--amber);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">'+p+'</button>';
    }).join('')
    +'</div></div>';
  window.__etabAdmNewPaiement = etab.paiement;
  var html = '<div id="_etabAdmOverlay" style="position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.9);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:1rem;overflow-y:auto;" onclick="if(event.target===this)closeEtabAdminProfile()">'
    +'<div style="background:var(--surface);border:1.5px solid rgba(255,45,155,0.4);border-radius:24px;padding:1.5rem 1.3rem;width:min(440px,100%);max-height:92vh;overflow-y:auto;animation:popIn 0.28s cubic-bezier(0.34,1.56,0.64,1);position:relative;">'
    +'<button onclick="closeEtabAdminProfile()" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">✕</button>'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--pink);margin-bottom:0.2rem;">✏️ Fiche Admin</div>'
    +'<div style="font-size:0.72rem;color:var(--muted);margin-bottom:1.2rem;">Modifier les informations de <strong style="color:var(--text);">'+escHtml(etab.nom||'—')+'</strong></div>'
    +inputs + buildAdmExtraFields(etab) + statutHtml + paiementHtml
    +'<div style="display:flex;gap:0.5rem;margin-top:1.1rem;">'
    +'<button onclick="saveEtabAdminProfile(\''+escHtml(String(eid))+'\')" style="flex:2;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;">💾 Sauvegarder</button>'
    +'<button onclick="closeEtabAdminProfile()" style="flex:1;padding:0.75rem;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--muted);font-family:Syne,sans-serif;font-weight:700;font-size:0.88rem;cursor:pointer;">Annuler</button>'
    +'</div></div></div>';
  var w=document.createElement('div'); w.id='_etabAdmWrap'; w.innerHTML=html;
  document.body.appendChild(w);
};
window.closeEtabAdminProfile = function(){
  var el=document.getElementById('_etabAdmWrap'); if(el) el.remove();
};
window.saveEtabAdminProfile = function(eid){
  var etab = (window.etablissements||[]).find(function(e){ return String(e.id)===String(eid); });
  if(!etab){ if(typeof showToast==='function') showToast('Établissement introuvable'); return; }
  var numFields=['capacite_totale','nb_vip','nb_chambres'];
  var txtFields=['nom','type','quartier','contact','description','ouverture','fermeture','maps_url','age_clientele','dress_code'];
  var updates = {};
  txtFields.forEach(function(k){
    var el = document.getElementById('etabAdm_'+k);
    if(el) updates[k] = el.value.trim ? el.value.trim() : el.value;
  });
  numFields.forEach(function(k){
    var el = document.getElementById('etabAdm_'+k);
    if(el) updates[k] = parseInt(el.value)||0;
  });
  updates.genres_musicaux = Array.from(document.querySelectorAll('.etabAdmGenre:checked')).map(function(c){return c.value;});
  updates.statut = window.__etabAdmNewStatut || etab.statut;
  updates.paiement = window.__etabAdmNewPaiement || etab.paiement;
  Object.assign(etab, updates);
  if(window.db && window.fbDoc && window.fbUpdateDoc && etab._docId){
    window.fbUpdateDoc(window.fbDoc(window.db,'etablissements',etab._docId), updates)
      .then(function(){
        window.closeEtabAdminProfile();
        if(typeof renderAll==='function') renderAll();
        if(typeof showToast==='function') showToast('✅ Fiche mise à jour !');
      }).catch(function(err){ if(typeof showToast==='function') showToast('Erreur Firebase: '+err.message); });
  } else {
    window.closeEtabAdminProfile();
    if(typeof renderAll==='function') renderAll();
    if(typeof showToast==='function') showToast('✅ Fiche mise à jour (local) !');
  }
};

/* ─── Android Back Button — Confirmation de sortie (v2 robuste) ─── */
(function initAndroidBackExit(){
  /* Cooldown anti double-déclenchement */
  var _cooldown = false;
  var COOLDOWN_MS = 400;

  /* ── Vérifie si un élément est réellement visible à l'écran ── */
  function isVisible(el){
    if(!el) return false;
    var s = el.style;
    var cs = window.getComputedStyle(el);
    if(s.display === 'none' || cs.display === 'none') return false;
    if(s.visibility === 'hidden' || cs.visibility === 'hidden') return false;
    if(parseFloat(s.opacity||cs.opacity) === 0) return false;
    return true;
  }

  /* ── Ferme le premier overlay/modal ouvert et retourne true ── */
  function closeTopModal(){
    /* Ordre de priorité : overlays génériques d'abord */
    var selectors = [
      '.overlay.show',
      '.perm-lightbox.show',
      '.lightbox.show',
      '#notifPanel.open',
      '[id$="Overlay"][style*="flex"]',
      '[id$="overlay"][style*="flex"]',
      '[id$="Overlay"][style*="display: flex"]',
      '[id$="Overlay"][style*="display:flex"]'
    ];
    for(var i=0;i<selectors.length;i++){
      var el = document.querySelector(selectors[i]);
      /* Exclure androidExitOverlay lui-même pour éviter boucle infinie */
      if(el && el.id !== 'androidExitOverlay' && isVisible(el)){
        el.classList.remove('show','open');
        el.style.display = 'none';
        return true;
      }
    }
    /* Panels spéciaux — appeler SEULEMENT si l'élément est réellement visible */
    var closerMap = [
      ['closeAdminDashboard',   'adminDashOverlay'],
      ['closeUserModal',        'userModal'],
      ['closeGalerie',          'galerieOverlay'],
      ['closeInvit',            'invitOverlay'],
      ['closeLightbox',         null],
      ['closeFullscreenPhoto',  null],
      ['closePhotoModal',       'photoModal'],
      ['closeRatingModal',      'ratingModal'],
      ['closePresenceModal',    'presenceModal'],
      ['closeEventFlashModal',  'eventFlashModal'],
      ['closeGpsDetailModal',   'gpsDetailModal'],
      ['closeNearbyMode',       'nearbyOverlay'],
      ['closeLegalModal',       'legalModal'],
      ['closeSupportRequestModal','supportRequestModal'],
      ['closeReservationModal', 'reservationModal'],
      ['closeUserProfile',      'userProfileModal'],
      ['closeAssignEtabModal',  'assignEtabModal'],
      ['closeLeaveAppModal',    'leaveAppOverlay'],
      ['closeForgotModal',      'forgotModal'],
      ['closeEtabAdminProfile', 'etabAdminProfileOverlay']
    ];
    for(var j=0;j<closerMap.length;j++){
      var fn = closerMap[j][0];
      var elId = closerMap[j][1];
      var visible = elId ? isVisible(document.getElementById(elId)) : false;
      if(visible && typeof window[fn]==='function'){
        try{ window[fn](); }catch(e){}
        return true;
      }
    }
    return false;
  }

  /* ── Affiche l'overlay de confirmation ── */
  function showExitConfirm(){
    var overlay = document.getElementById('androidExitOverlay');
    if(!overlay) return;
    overlay.style.display = 'flex';
    /* Re-pousser pour intercepter le prochain retour */
    try{ history.pushState({ambi241:'exit-confirm'}, '', window.location.href); }catch(e){}
  }

  /* ── Action confirmée — tente de fermer/minimiser sans quitter l'historique ── */
  window.androidExitConfirmed = function(){
    var overlay = document.getElementById('androidExitOverlay');
    if(overlay) overlay.style.display = 'none';
    /* Sur Android PWA : on essaie de minimiser proprement */
    if(typeof window.AndroidInterface !== 'undefined' && window.AndroidInterface.minimize){
      window.AndroidInterface.minimize();
      return;
    }
    /* Fallback : retour dans l'historique du navigateur (ne quitte pas la PWA) */
    if(window.history.length > 2){
      window.history.go(-1);
    } else {
      /* Dernier recours silencieux — on reste sur la page */
      try{ window.history.pushState({ambi241:'home'}, '', window.location.href); }catch(e){}
    }
  };

  /* ── Initialise l'état dans l'historique ── */
  function init(){
    try{ history.pushState({ambi241:'home'}, '', window.location.href); }catch(e){}
  }

  /* ── Gestionnaire popstate ── */
  window.addEventListener('popstate', function(e){
    /* Anti double-déclenchement */
    if(_cooldown) return;
    _cooldown = true;
    setTimeout(function(){ _cooldown = false; }, COOLDOWN_MS);

    /* 1. Un modal/overlay est ouvert → le fermer en priorité */
    if(closeTopModal()){
      try{ history.pushState({ambi241:'home'}, '', window.location.href); }catch(e){}
      return;
    }

    /* 2. Aucun modal → demander confirmation de sortie */
    showExitConfirm();
  });

  /* ── Démarrage ── */
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

/* ─── Ripple JS nav supprimé ─── */

/* ─── Firebase persistence : recharger l'onglet admin actif au démarrage ─── */
(function restoreAdminTab(){
  document.addEventListener('DOMContentLoaded', function(){
    var saved = '';
    try{ saved = localStorage.getItem('ambi241_admTab')||''; }catch(e){}
    if(saved && typeof switchAdminTab === 'function'){
      var tabs = ['paiements','visiteurs','statistiques','contacts','taxipro','weeksong','monetisation'];
      if(tabs.indexOf(saved)!==-1){
        // Ne restaurer que si le dashboard admin est ouvert
        var adminTabs = document.getElementById('adminTabs');
        if(adminTabs && adminTabs.style.display !== 'none'){
          switchAdminTab(saved);
        }
      }
    }
  });
})();

/* ─── Amélioration : membres de la galerie cliquables (ouvre profil) ─── */
document.addEventListener('DOMContentLoaded', function(){
  document.addEventListener('click', function(e){
    var memberAvatar = e.target.closest('[data-member-uid]');
    if(memberAvatar){
      var uid = memberAvatar.getAttribute('data-member-uid');
      var pseudo = memberAvatar.getAttribute('data-member-pseudo')||uid||'Membre';
      if(uid && typeof openUserProfileModal === 'function'){
        openUserProfileModal(uid, pseudo);
      } else if(uid){
        if(typeof showToast==='function') showToast('👤 '+pseudo);
      }
    }
  });
});

/* ─── Tuto audio : inséré statiquement dans le HTML du modal — voir wsam-wrap ─── */

console.log('✅ Module Monétisation AMBI241 v1.0 — Boosts · Revenus · Pubs · EventFlash · Android Back');
})();