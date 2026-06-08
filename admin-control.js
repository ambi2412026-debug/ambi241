/* ═══════════════════════════════════════════════════════════════
   AMBI241 — ADMIN CONTROL GLOBAL v2.0
   • Édition complète des établissements
   • Gestion des publications (Contenu)
   • Configuration globale de l'app
   • Bannissement utilisateurs
   ═══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ─── Patch switchAdmTab pour les nouveaux onglets ─── */
var _origSwitchAdmTab = window.switchAdmTab;
window.switchAdmTab = function(tab){
  // Synchroniser les deux variables (locale + window)
  window._currentAdmTab = tab;
  try{ _currentAdmTab = tab; }catch(e){}
  // Gérer les nouveaux panels
  var allTabs = ["overview","etabl","users","notifs","payments","connexions","settings","reservations","classement","support","content","appconfig","importgmaps"];
  allTabs.forEach(function(t){
    var btn   = document.getElementById('admtab-'+t);
    var panel = document.getElementById('admpanel-'+t);
    if(btn)   btn.classList.toggle('active', t===tab);
    if(panel){
      if(t===tab){
        panel.style.display='block';
        panel.style.visibility='visible';
        panel.style.height='';
        panel.style.overflow='';
      } else {
        panel.style.display='none';
        panel.style.visibility='hidden';
        panel.style.height='0';
        panel.style.overflow='hidden';
      }
    }
  });
  if(tab === 'content'){
    if(typeof window.renderAdmContent==='function') window.renderAdmContent();
    return;
  }
  if(tab === 'appconfig'){
    renderAdmAppConfig(0);
    return;
  }
  _origSwitchAdmTab(tab);
};

/* ══════════════════════════════════════════════════════════════
   ══ 1. ÉDITION COMPLÈTE D'UN ÉTABLISSEMENT               ══
   ══════════════════════════════════════════════════════════════ */

var _aeCurrentId = null;

window.admOpenEditEtab = function(id){
  if(!window.isAdmin){ showToast('Accès admin requis'); return; }
  var e = etablissements.find(function(x){ return x.id === id; });
  if(!e){ showToast('Établissement introuvable'); return; }
  _aeCurrentId = id;

  // Remplir les champs
  var G = function(i){ return document.getElementById(i); };
  G('aeNom').value       = e.nom || '';
  G('aeType').value      = e.type || 'Bar';
  G('aeQuartier').value  = e.quartier || '';
  G('aeStatut').value    = e.statut || 'Ouvert - Anime';
  G('aeDesc').value      = e.description || '';
  G('aeTel').value       = e.contact || '';
  G('aeEmail').value     = e.email || '';
  G('aeOuv').value       = e.ouverture || '';
  G('aeFerm').value      = e.fermeture || '';
  G('aeAff').value       = e.affluence || 0;
  G('aeCap').value       = e.capacite_totale || 0;
  G('aeVip').value       = e.nb_vip || 0;
  G('aeCh').value        = e.nb_chambres || 0;
  G('aePaiement').value  = e.paiement || 'Actif (Admin)';
  G('aeAmbiance').value  = e.ambiance || '';
  G('aeMaps').value      = e.maps_url || '';
  G('admEditEtabSubtitle').textContent = 'ID: ' + id + (e._docId ? ' · Doc: '+e._docId : '');

  var msg = G('admEditEtabMsg');
  if(msg){ msg.style.display='none'; msg.textContent=''; }

  G('admEditEtabOverlay').classList.add('show');
};

window.admCloseEditEtab = function(){
  document.getElementById('admEditEtabOverlay').classList.remove('show');
  _aeCurrentId = null;
};

window.admSaveEditEtab = function(){
  if(!_aeCurrentId){ return; }
  var e = etablissements.find(function(x){ return x.id === _aeCurrentId; });
  if(!e){ showToast('Introuvable'); return; }
  var G = function(i){ return document.getElementById(i); };

  var nom = (G('aeNom').value||'').trim();
  var quartier = (G('aeQuartier').value||'').trim();
  if(!nom || !quartier){
    var msg=G('admEditEtabMsg');
    msg.style.display='block'; msg.style.color='var(--red)'; msg.style.background='rgba(255,68,102,0.08)'; msg.style.border='1px solid rgba(255,68,102,0.2)';
    msg.textContent='Nom et Quartier sont obligatoires.'; return;
  }

  var fields = {
    nom:             nom,
    type:            G('aeType').value,
    quartier:        quartier,
    statut:          G('aeStatut').value,
    description:     (G('aeDesc').value||'').trim(),
    contact:         (G('aeTel').value||'').trim(),
    email:           (G('aeEmail').value||'').trim(),
    ouverture:       (G('aeOuv').value||'').trim(),
    fermeture:       (G('aeFerm').value||'').trim(),
    affluence:       parseInt(G('aeAff').value)||0,
    capacite_totale: parseInt(G('aeCap').value)||0,
    nb_vip:          parseInt(G('aeVip').value)||0,
    nb_chambres:     parseInt(G('aeCh').value)||0,
    paiement:        G('aePaiement').value,
    ambiance:        (G('aeAmbiance').value||'').trim(),
    maps_url:        (G('aeMaps').value||'').trim(),
    _adminOverride:  true
  };

  var btn = G('admEditEtabSaveBtn');
  btn.disabled=true; btn.textContent='⏳ Enregistrement...';

  // Mise à jour locale immédiate
  Object.keys(fields).forEach(function(k){ e[k]=fields[k]; });
  renderStats(); renderAll(); renderHome();
  if(window._currentAdmTab==='etabl') renderAdmEtabl();

  // Sync Firebase
  if(!e._docId){
    showToast('Mis à jour localement (pas de doc Firebase)');
    btn.disabled=false; btn.textContent='💾 Enregistrer les modifications';
    admCloseEditEtab();
    return;
  }
  window.fbUpdateDoc(window.fbDoc(window.db,'etablissements',e._docId), fields)
    .then(function(){
      showToast('✅ Établissement mis à jour !');
      btn.disabled=false; btn.textContent='💾 Enregistrer les modifications';
      admCloseEditEtab();
      if(window._currentAdmTab==='etabl') renderAdmEtabl();
    })
    .catch(function(err){
      var msg=G('admEditEtabMsg');
      msg.style.display='block'; msg.style.color='var(--red)'; msg.style.background='rgba(255,68,102,0.08)'; msg.style.border='1px solid rgba(255,68,102,0.2)';
      msg.textContent='Erreur Firebase : '+err.message;
      btn.disabled=false; btn.textContent='💾 Enregistrer les modifications';
    });
};

/* ─── Patch renderAdmEtabl pour ajouter le bouton Éditer ─── */
var _origRenderAdmEtabl = window.renderAdmEtabl || renderAdmEtabl;
window.renderAdmEtabl = function(){
  if(typeof _origRenderAdmEtabl === 'function') _origRenderAdmEtabl();
  // Injecter le bouton Éditer dans chaque card établissement
  setTimeout(function(){
    document.querySelectorAll('#adminEtablList .notif-admin-item').forEach(function(card){
      if(card.querySelector('.adm-edit-btn')) return; // déjà injecté
      var btnRow = card.querySelector('div[style*="display:flex"][style*="margin-top:0.6rem"]');
      if(!btnRow) return;
      // Trouver l'id via le bouton supprimer existant
      var delBtn = btnRow.querySelector('button[onclick*="deleteEtablissement"]');
      if(!delBtn) return;
      var match = delBtn.getAttribute('onclick').match(/deleteEtablissement\((\d+)\)/);
      if(!match) return;
      var id = parseInt(match[1]);
      var editBtn = document.createElement('button');
      editBtn.className = 'adm-edit-btn';
      editBtn.innerHTML = '✏️ Modifier';
      editBtn.setAttribute('onclick','admOpenEditEtab('+id+')');
      editBtn.style.cssText='font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:6px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.4);color:var(--amber);cursor:pointer;font-weight:700;';
      btnRow.insertBefore(editBtn, btnRow.firstChild);
    });
  }, 120);
};

/* ══════════════════════════════════════════════════════════════
   ══ 2. GESTION DU CONTENU (Publications)                  ══
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════
   ══  ONGLET CONTENU — Version complète standalone            ══
   ══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════
   ONGLET CONTENU — module autonome
   ══════════════════════════════════════════════════════ */
var _admPubList   = [];
var _admPubFilter = 'all';
var _admPubSearch = '';

window._admContentSave = function() {
  var CK = 'ambi241_content_v1';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(CK) || '{}'); } catch(e) {}
  var keys = ['hero_title','hero_subtitle','hero_cta','welcome_msg',
              'banner_active','banner_text','annonce_active','annonce_titre','annonce_texte',
              'appname','footer_text','contact_email','contact_whatsapp',
              'reseaux_instagram','reseaux_facebook','reseaux_tiktok'];
  keys.forEach(function(k) {
    var el = document.getElementById('cc_' + k);
    if (!el) return;
    saved[k] = el.type === 'checkbox' ? el.checked : el.value;
  });
  try { localStorage.setItem(CK, JSON.stringify(saved)); } catch(e) {}
  if (typeof showToast === 'function') showToast('✅ Contenu sauvegardé !');
};

window._loadAdmPubs = function() {
  var sub = document.getElementById('admPubSub');
  if (!sub) return;
  if (!window.db || !window.fbCollection || !window.fbGetDocs || !window.fbQuery || !window.fbOrderBy) {
    sub.innerHTML = '<div style="color:#b088c0;font-size:0.73rem;">Firebase non disponible sur fichier local.<br>Les publications s\'affichent après déploiement.</div>';
    return;
  }
  sub.innerHTML = '⏳ Chargement…';
  var q = window.fbQuery(window.fbCollection(window.db, 'publications'), window.fbOrderBy('createdAt', 'desc'));
  window.fbGetDocs(q).then(function(snap) {
    _admPubList = [];
    snap.forEach(function(doc) { _admPubList.push(Object.assign({ _docId: doc.id }, doc.data())); });
    window._renderAdmPubList();
  }).catch(function(err) {
    sub.innerHTML = '<div style="color:#ff4466;font-size:0.73rem;">Erreur: ' + err.message + '</div>';
  });
};

window._renderAdmPubList = function() {
  var sub = document.getElementById('admPubSub');
  if (!sub) return;
  var list = _admPubList.filter(function(p) {
    if (_admPubFilter !== 'all' && p.type !== _admPubFilter) return false;
    if (_admPubSearch) {
      var q = _admPubSearch.toLowerCase();
      return (p.titre||'').toLowerCase().indexOf(q) !== -1 || (p.pseudo||'').toLowerCase().indexOf(q) !== -1;
    }
    return true;
  });
  var h = '<div style="font-size:0.7rem;color:#b088c0;margin-bottom:0.4rem;">' + list.length + ' / ' + _admPubList.length + ' publication(s)</div>';
  list.slice(0, 20).forEach(function(p) {
    var ds = ''; try { if (p.createdAt && p.createdAt.toDate) ds = p.createdAt.toDate().toLocaleDateString('fr-FR'); } catch(e) {}
    h += '<div style="border:1px solid rgba(255,255,255,0.07);border-radius:9px;padding:0.6rem;margin-bottom:0.4rem;' + (p._hidden ? 'opacity:0.4;' : '') + '">'
       + '<div style="font-size:0.58rem;color:#b088c0;text-transform:uppercase;">' + (p.type||'info') + ' · ' + (p.pseudo||'Anonyme') + ' · ' + ds + '</div>'
       + '<div style="font-size:0.8rem;font-weight:700;color:#fff0f8;margin:0.15rem 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (p.titre||'Sans titre') + '</div>'
       + '<div style="display:flex;gap:0.3rem;margin-top:0.3rem;">'
       + '<button onclick="window.admPinPub(\'' + p._docId + '\')" style="font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:5px;border:1px solid rgba(255,215,0,0.3);background:rgba(255,215,0,0.05);color:#ffd700;cursor:pointer;">' + (p._pinned ? '📌 Épinglé' : '📌') + '</button>'
       + '<button onclick="window.admHidePub(\'' + p._docId + '\',' + (!p._hidden) + ')" style="font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:5px;border:1px solid rgba(0,229,255,0.25);background:rgba(0,229,255,0.05);color:#00e5ff;cursor:pointer;">' + (p._hidden ? '👁️' : '🚫') + '</button>'
       + '<button onclick="window.admDeletePub(\'' + p._docId + '\')" style="font-size:0.6rem;padding:0.15rem 0.4rem;border-radius:5px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.05);color:#ff4466;cursor:pointer;">🗑️</button>'
       + '</div></div>';
  });
  sub.innerHTML = h;
};

window.admDeletePub = function(docId) {
  if (!confirm('Supprimer ?')) return;
  if (!window.db || !window.fbDeleteDoc || !window.fbDoc) return;
  window.fbDeleteDoc(window.fbDoc(window.db, 'publications', docId))
    .then(function() { _admPubList = _admPubList.filter(function(p) { return p._docId !== docId; }); window._renderAdmPubList(); if(typeof showToast==='function') showToast('✅ Supprimé'); })
    .catch(function(err) { if(typeof showToast==='function') showToast('Erreur: ' + err.message); });
};

window.admPinPub = function(docId) {
  var p = _admPubList.find(function(x) { return x._docId === docId; });
  if (!p) return;
  var nv = !p._pinned;
  if (window.db && window.fbUpdateDoc && window.fbDoc) {
    window.fbUpdateDoc(window.fbDoc(window.db, 'publications', docId), { _pinned: nv })
      .then(function() { p._pinned = nv; window._renderAdmPubList(); })
      .catch(function(e) { if(typeof showToast==='function') showToast('Erreur: '+e.message); });
  } else { p._pinned = nv; window._renderAdmPubList(); }
};

window.admHidePub = function(docId, hide) {
  var p = _admPubList.find(function(x) { return x._docId === docId; });
  if (!p) return;
  if (window.db && window.fbUpdateDoc && window.fbDoc) {
    window.fbUpdateDoc(window.fbDoc(window.db, 'publications', docId), { _hidden: hide })
      .then(function() { p._hidden = hide; window._renderAdmPubList(); })
      .catch(function(e) { if(typeof showToast==='function') showToast('Erreur: '+e.message); });
  } else { p._hidden = hide; window._renderAdmPubList(); }
};

/* ══════════════════════════════════════════════════════════════
   ══ 3. CONFIGURATION GLOBALE DE L'APPLICATION             ══
   ══════════════════════════════════════════════════════════════ */

var _appCfg = {};

window.renderAdmAppConfig = function(attempt){
  attempt = attempt || 0;
  var panel = document.getElementById('adminAppConfigPanel');
  if(!panel) return;

  if(!window.db){
    if(attempt === 0){
      panel.innerHTML = '<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.82rem;">⏳ Connexion Firebase en cours…<br><span style="font-size:0.72rem;opacity:0.6;">Nouvelle tentative automatique</span></div>';
    }
    if(attempt < 15){
      setTimeout(function(){
        var stillActive = (window._currentAdmTab==='appconfig') || (typeof _currentAdmTab!=='undefined' && _currentAdmTab==='appconfig');
        if(stillActive) window.renderAdmAppConfig(attempt + 1);
      }, 1000);
    } else {
      panel.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--red);font-size:0.82rem;">⚠️ Firebase indisponible.<br><button onclick="window.renderAdmAppConfig(0)" style="margin-top:0.7rem;padding:0.4rem 1rem;border-radius:8px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.08);color:var(--cyan);cursor:pointer;font-family:DM Sans,sans-serif;font-size:0.78rem;">↻ Réessayer</button></div>';
    }
    return;
  }
  panel.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">⏳ Chargement...</div>';

  window.fbGetDoc(window.fbDoc(window.db,'config','app_settings'))
    .then(function(snap){
      _appCfg = snap.exists() ? (snap.data()||{}) : {};
      _renderAppConfigUI();
    })
    .catch(function(){ _appCfg={}; _renderAppConfigUI(); });
};

function _renderAppConfigUI(){
  var panel = document.getElementById('adminAppConfigPanel');
  if(!panel) return;
  var c = _appCfg;

  var html = '';

  // ── Maintenance
  html += '<div style="background:linear-gradient(135deg,rgba(255,68,102,0.1),rgba(204,68,255,0.06));border:1.5px solid rgba(255,68,102,0.35);border-radius:16px;padding:1.1rem;margin-bottom:1rem;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.5rem;">';
  html += '<div><div style="font-family:Syne,sans-serif;font-weight:800;color:var(--red);font-size:0.9rem;">🔧 Mode Maintenance</div><div style="font-size:0.68rem;color:var(--muted);margin-top:0.1rem;">Affiche un message de maintenance à tous les visiteurs</div></div>';
  html += '<label style="position:relative;width:44px;height:24px;flex-shrink:0;"><input type="checkbox" id="cfgMaintenance" '+(c.maintenance?'checked':'')+' onchange="_admSaveAppCfgField(\'maintenance\',this.checked)" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:'+(c.maintenance?'var(--red)':'rgba(255,255,255,0.1)')+';border-radius:24px;cursor:pointer;transition:.25s;"><span style="position:absolute;width:16px;height:16px;left:'+(c.maintenance?'24px':'4px')+';top:4px;background:#fff;border-radius:50%;transition:.25s;display:block;"></span></span></label>';
  html += '</div>';
  html += '<input id="cfgMaintMsg" type="text" placeholder="Message de maintenance..." value="'+_escHtmlLocal(c.maintenance_msg||'')+'" maxlength="120" style="width:100%;background:var(--surface2);border:1px solid rgba(255,68,102,0.25);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.82rem;">';
  html += '<button onclick="_admSaveAppCfgField(\'maintenance_msg\',document.getElementById(\'cfgMaintMsg\').value)" style="margin-top:0.5rem;width:100%;padding:0.45rem;border-radius:8px;border:1px solid rgba(255,68,102,0.4);background:rgba(255,68,102,0.1);color:var(--red);font-family:Syne,sans-serif;font-weight:700;font-size:0.78rem;cursor:pointer;">Enregistrer le message</button>';
  html += '</div>';

  // ── Bannière globale
  html += '<div style="background:rgba(255,215,0,0.06);border:1.5px solid rgba(255,215,0,0.3);border-radius:16px;padding:1.1rem;margin-bottom:1rem;">';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.6rem;">';
  html += '<div><div style="font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.9rem;">📢 Bannière globale</div><div style="font-size:0.68rem;color:var(--muted);">Bandeau affiché en haut de l\'app pour tous</div></div>';
  html += '<label style="position:relative;width:44px;height:24px;flex-shrink:0;"><input type="checkbox" id="cfgBanner" '+(c.banner_active?'checked':'')+' onchange="_admSaveAppCfgField(\'banner_active\',this.checked)" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:'+(c.banner_active?'var(--amber)':'rgba(255,255,255,0.1)')+';border-radius:24px;cursor:pointer;transition:.25s;"><span style="position:absolute;width:16px;height:16px;left:'+(c.banner_active?'24px':'4px')+';top:4px;background:#fff;border-radius:50%;transition:.25s;display:block;"></span></span></label>';
  html += '</div>';
  html += '<input id="cfgBannerMsg" type="text" placeholder="Ex: 🎉 Soirée spéciale ce soir à Yoka Lounge !" value="'+_escHtmlLocal(c.banner_msg||'')+'" maxlength="120" style="width:100%;background:var(--surface2);border:1px solid rgba(255,215,0,0.2);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.82rem;margin-bottom:0.5rem;">';
  html += '<input id="cfgBannerLink" type="url" placeholder="Lien optionnel (https://...)" value="'+_escHtmlLocal(c.banner_link||'')+'" maxlength="200" style="width:100%;background:var(--surface2);border:1px solid rgba(255,215,0,0.2);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.82rem;">';
  html += '<button onclick="_admSaveBanner()" style="margin-top:0.5rem;width:100%;padding:0.45rem;border-radius:8px;border:1px solid rgba(255,215,0,0.4);background:rgba(255,215,0,0.1);color:var(--amber);font-family:Syne,sans-serif;font-weight:700;font-size:0.78rem;cursor:pointer;">Enregistrer la bannière</button>';
  html += '</div>';

  // ── Limites
  html += '<div style="background:rgba(0,229,255,0.04);border:1.5px solid rgba(0,229,255,0.2);border-radius:16px;padding:1.1rem;margin-bottom:1rem;">';
  html += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:0.9rem;margin-bottom:0.8rem;">⚙️ Limites & Règles</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:0.7rem;">';
  html += '<div><label style="font-size:0.68rem;color:var(--muted);display:block;margin-bottom:0.25rem;">Publications / jour (max)</label><input id="cfgMaxPubs" type="number" min="1" max="50" value="'+(c.max_pubs_per_day||5)+'" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.2);border-radius:8px;color:var(--cyan);padding:0.5rem;font-size:0.9rem;text-align:center;font-weight:700;"></div>';
  html += '<div><label style="font-size:0.68rem;color:var(--muted);display:block;margin-bottom:0.25rem;">Photos par publication</label><input id="cfgMaxPhotos" type="number" min="1" max="10" value="'+(c.max_photos_per_pub||5)+'" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.2);border-radius:8px;color:var(--cyan);padding:0.5rem;font-size:0.9rem;text-align:center;font-weight:700;"></div>';
  html += '</div>';
  html += '<div style="margin-bottom:0.7rem;"><label style="font-size:0.68rem;color:var(--muted);display:block;margin-bottom:0.25rem;">Message d\'accueil (page d\'accueil)</label><input id="cfgWelcome" type="text" maxlength="100" value="'+_escHtmlLocal(c.welcome_msg||'')+'" placeholder="Ex: Trouvez l\'ambiance en temps réel 🌙" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.2);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.82rem;"></div>';
  html += '<button onclick="_admSaveLimits()" style="width:100%;padding:0.5rem;border-radius:8px;border:none;background:linear-gradient(135deg,var(--cyan),var(--purple));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;">💾 Enregistrer les limites</button>';
  html += '</div>';

  // ── Accès & Sécurité
  html += '<div style="background:rgba(204,68,255,0.05);border:1.5px solid rgba(204,68,255,0.25);border-radius:16px;padding:1.1rem;margin-bottom:1rem;">';
  html += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--purple);font-size:0.9rem;margin-bottom:0.8rem;">🔐 Accès & Sécurité</div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;"><div><div style="font-size:0.78rem;color:var(--text);font-weight:600;">Inscription publique</div><div style="font-size:0.65rem;color:var(--muted);">Permettre aux nouveaux utilisateurs de s\'inscrire</div></div><label style="position:relative;width:44px;height:24px;flex-shrink:0;"><input type="checkbox" '+(c.registration_open!==false?'checked':'')+' onchange="_admSaveAppCfgField(\'registration_open\',this.checked)" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:'+(c.registration_open!==false?'var(--green)':'rgba(255,255,255,0.1)')+';border-radius:24px;cursor:pointer;transition:.25s;"><span style="position:absolute;width:16px;height:16px;left:'+(c.registration_open!==false?'24px':'4px')+';top:4px;background:#fff;border-radius:50%;transition:.25s;display:block;"></span></span></label></div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;"><div><div style="font-size:0.78rem;color:var(--text);font-weight:600;">Modération des publications</div><div style="font-size:0.65rem;color:var(--muted);">Publier en attente d\'approbation admin</div></div><label style="position:relative;width:44px;height:24px;flex-shrink:0;"><input type="checkbox" '+(c.pub_moderation?'checked':'')+' onchange="_admSaveAppCfgField(\'pub_moderation\',this.checked)" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:'+(c.pub_moderation?'var(--pink)':'rgba(255,255,255,0.1)')+';border-radius:24px;cursor:pointer;transition:.25s;"><span style="position:absolute;width:16px;height:16px;left:'+(c.pub_moderation?'24px':'4px')+';top:4px;background:#fff;border-radius:50%;transition:.25s;display:block;"></span></span></label></div>';
  html += '<div style="display:flex;align-items:center;justify-content:space-between;"><div><div style="font-size:0.78rem;color:var(--text);font-weight:600;">Commentaires activés</div><div style="font-size:0.65rem;color:var(--muted);">Autoriser les commentaires sur les publications</div></div><label style="position:relative;width:44px;height:24px;flex-shrink:0;"><input type="checkbox" '+(c.comments_enabled!==false?'checked':'')+' onchange="_admSaveAppCfgField(\'comments_enabled\',this.checked)" style="opacity:0;width:0;height:0;"><span style="position:absolute;inset:0;background:'+(c.comments_enabled!==false?'var(--green)':'rgba(255,255,255,0.1)')+';border-radius:24px;cursor:pointer;transition:.25s;"><span style="position:absolute;width:16px;height:16px;left:'+(c.comments_enabled!==false?'24px':'4px')+';top:4px;background:#fff;border-radius:50%;transition:.25s;display:block;"></span></span></label></div>';
  html += '</div>';

  // ── Actions rapides
  html += '<div style="background:rgba(0,255,170,0.04);border:1.5px solid rgba(0,255,170,0.2);border-radius:16px;padding:1.1rem;margin-bottom:1rem;">';
  html += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--green);font-size:0.9rem;margin-bottom:0.8rem;">⚡ Actions rapides</div>';
  html += '<div style="display:grid;gap:0.5rem;">';
  html += '<button onclick="admForceRefreshAll()" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.07);color:var(--green);font-family:Syne,sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;">↻ Forcer rechargement des données</button>';
  html += '<button onclick="admExportUsers()" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.07);color:var(--cyan);font-family:Syne,sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;">📥 Exporter liste membres (CSV)</button>';
  html += '<button onclick="admClearPubCache()" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(255,215,0,0.3);background:rgba(255,215,0,0.07);color:var(--amber);font-family:Syne,sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;">🗑️ Réinitialiser compteurs publications</button>';
  html += '<button onclick="purgerHorsScope()" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(255,68,102,0.4);background:rgba(255,68,102,0.07);color:var(--red);font-family:Syne,sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;">🧹 Purger établissements hors-scope Firebase</button>';
  html += '<div id="purgeHorsScopeStatus" style="font-size:0.72rem;color:var(--muted);text-align:center;min-height:1.2rem;margin-top:0.2rem;"></div>';
  html += '</div></div>';

  panel.innerHTML = html;
}

window._admSaveAppCfgField = function(key, val){
  if(!window.db) return;
  _appCfg[key] = val;
  window.fbSetDoc(window.fbDoc(window.db,'config','app_settings'), _appCfg, {merge:true})
    .then(function(){ showToast('✅ Paramètre sauvegardé'); renderAdmAppConfig(); })
    .catch(function(e){ showToast('Erreur: '+e.message); });
};

window._admSaveBanner = function(){
  var msg  = (document.getElementById('cfgBannerMsg')||{}).value||'';
  var link = (document.getElementById('cfgBannerLink')||{}).value||'';
  _admSaveMultipleFields({banner_msg: msg, banner_link: link});
};

window._admSaveLimits = function(){
  var maxPubs   = parseInt((document.getElementById('cfgMaxPubs')||{}).value)||5;
  var maxPhotos = parseInt((document.getElementById('cfgMaxPhotos')||{}).value)||5;
  var welcome   = ((document.getElementById('cfgWelcome')||{}).value||'').trim();
  _admSaveMultipleFields({max_pubs_per_day: maxPubs, max_photos_per_pub: maxPhotos, welcome_msg: welcome});
};

function _admSaveMultipleFields(fields){
  if(!window.db) return;
  Object.assign(_appCfg, fields);
  window.fbSetDoc(window.fbDoc(window.db,'config','app_settings'), _appCfg, {merge:true})
    .then(function(){ showToast('✅ Configuration enregistrée !'); })
    .catch(function(e){ showToast('Erreur: '+e.message); });
}

window.admForceRefreshAll = function(){
  if(typeof loadData==='function') loadData();
  showToast('↻ Rechargement en cours...');
  setTimeout(function(){ showToast('✅ Données rechargées'); }, 2000);
};

/* ══ PURGE ÉTABLISSEMENTS HORS-SCOPE ══
   Supprime de Firestore tous les établissements dont le type
   ne correspond pas aux catégories AMBI241 (Bar/Restaurant/Hotel/Club/Snack/Bar Terrasse).
   Utilise la même logique que _apIsAppEtab pour la cohérence.
*/
window.purgerHorsScope = async function(){
  if(!window.isAdmin){ showToast('❌ Accès admin requis'); return; }
  if(!window.db || !window.fbGetDocs || !window.fbCollection || !window.fbDeleteDoc || !window.fbDoc){
    showToast('❌ Firebase non disponible'); return;
  }

  var statusEl = document.getElementById('purgeHorsScopeStatus');
  function setStatus(msg){ if(statusEl) statusEl.innerHTML = msg; }

  // Aperçu d'abord
  setStatus('⏳ Analyse en cours…');
  var snap;
  try{ snap = await window.fbGetDocs(window.fbCollection(window.db,'etablissements')); }
  catch(e){ setStatus('❌ ' + e.message); return; }

  var horsScope = [], inScope = [];
  snap.forEach(function(d){
    var v = d.data();
    if(_apIsAppEtab(v)) inScope.push(d.id);
    else horsScope.push({id: d.id, nom: v.nom||v.name||d.id, type: v.type||'?'});
  });

  if(!horsScope.length){
    setStatus('✅ Aucun établissement hors-scope trouvé (' + inScope.length + ' valides).');
    return;
  }

  // Confirmation avec détail
  var preview = horsScope.slice(0,5).map(function(e){ return '• '+e.nom+' ['+e.type+']'; }).join('\n');
  var more = horsScope.length > 5 ? '\n… et '+(horsScope.length-5)+' autres.' : '';
  var msg = '⚠️ PURGE HORS-SCOPE\n\n'
    + horsScope.length + ' établissements vont être supprimés de Firebase :\n\n'
    + preview + more + '\n\n'
    + inScope.length + ' établissements AMBI241 seront conservés.\n\n'
    + 'Confirmer la suppression ?';

  if(!confirm(msg)){ setStatus('Annulé.'); return; }

  // Suppression par lots de 20 (limite Firestore batch)
  setStatus('🗑️ Suppression en cours…');
  var deleted = 0, errors = 0;
  var CHUNK = 20;
  for(var i = 0; i < horsScope.length; i += CHUNK){
    var chunk = horsScope.slice(i, i + CHUNK);
    await Promise.all(chunk.map(async function(e){
      try{
        await window.fbDeleteDoc(window.fbDoc(window.db,'etablissements',e.id));
        deleted++;
      } catch(err){
        errors++;
        console.error('Erreur suppression', e.id, err);
      }
    }));
    setStatus('🗑️ ' + deleted + '/' + horsScope.length + ' supprimés…');
  }

  var msg2 = '✅ ' + deleted + ' hors-scope supprimés'
    + (errors ? ' · ❌ ' + errors + ' erreur(s)' : '')
    + ' — ' + inScope.length + ' établissements AMBI241 conservés.';
  setStatus(msg2);
  showToast(msg2);

  // Recharger les données
  if(typeof loadData === 'function') setTimeout(loadData, 500);
  if(typeof renderAll === 'function') setTimeout(renderAll, 800);
};

window.admExportUsers = function(){
  if(!window.db){ showToast('Firebase requis'); return; }
  showToast('⏳ Export en cours...');
  window.fbGetDocs(window.fbCollection(window.db,'users')).then(function(snap){
    var rows = ['Email,Pseudo,Rôle,Date inscription'];
    snap.forEach(function(doc){
      var d=doc.data();
      rows.push([d.email||'',d.pseudo||'',d.role||'',d.createdAt||''].map(function(v){ return '"'+String(v).replace(/"/g,'""')+'"'; }).join(','));
    });
    var blob = new Blob([rows.join('\n')], {type:'text/csv'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ambi241_membres_'+new Date().toISOString().slice(0,10)+'.csv';
    a.click();
    showToast('✅ CSV exporté ('+snap.size+' membres)');
  }).catch(function(e){ showToast('Erreur: '+e.message); });
};

window.admClearPubCache = function(){
  if(!confirm('Réinitialiser les compteurs de publications du jour pour TOUS les utilisateurs ?')) return;
  var keys=[];
  for(var i=0;i<localStorage.length;i++){ var k=localStorage.key(i); if(k&&k.startsWith('pubday_')) keys.push(k); }
  keys.forEach(function(k){ localStorage.removeItem(k); });
  showToast('✅ Compteurs réinitialisés ('+keys.length+' entrées)');
};

/* ══════════════════════════════════════════════════════════════
   ══ 4. BANNISSEMENT UTILISATEURS                           ══
   ══════════════════════════════════════════════════════════════ */

window.admBanUser = function(uid, pseudo, banned){
  var action = banned ? 'débannir' : 'bannir';
  if(!confirm((banned?'Débannir':'Bannir')+' '+pseudo+' ?\n'+(banned?"L'utilisateur retrouvera accès à l'app.":"Cet utilisateur ne pourra plus publier ni commenter."))) return;
  if(!window.db){ showToast('Firebase requis'); return; }
  window.fbSetDoc(window.fbDoc(window.db,'users',uid), {banned: !banned, bannedAt: !banned ? new Date().toISOString() : null, bannedBy: window.currentUserEmail||'admin'}, {merge:true})
    .then(function(){
      showToast(!banned ? '🚫 Utilisateur banni' : '✅ Utilisateur débanni');
      if(window._currentAdmTab==='users') renderAdmUsers();
    })
    .catch(function(e){ showToast('Erreur: '+e.message); });
};

/* Patch renderAdmUsers pour ajouter le bouton Bannir */
var _fbGetDocs2 = null;
(function tryPatchUsers(){
  if(typeof renderAdmUsers !== 'undefined' && window.fbGetDocs){
    _fbGetDocs2 = window.fbGetDocs;
  }
  setTimeout(tryPatchUsers, 2000);
})();

/* ══════════════════════════════════════════════════════════════
   ══ 5. BANNIÈRE GLOBALE — Lecture côté visiteur             ══
   ══════════════════════════════════════════════════════════════ */

function _checkGlobalBanner(){
  if(!window.db || !window.fbGetDoc || !window.fbDoc) return;
  window.fbGetDoc(window.fbDoc(window.db,'config','app_settings')).then(function(snap){
    if(!snap.exists()) return;
    var cfg = snap.data()||{};
    // Maintenance
    if(cfg.maintenance && !window.isAdmin){
      var msg = cfg.maintenance_msg || '🔧 Maintenance en cours, veuillez patienter...';
      var overlay = document.getElementById('_maintOverlay');
      if(!overlay){
        overlay = document.createElement('div');
        overlay.id = '_maintOverlay';
        overlay.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(13,0,20,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;';
        overlay.innerHTML='<div style="font-size:3rem;margin-bottom:1rem;">🔧</div><div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.2rem;color:var(--amber);margin-bottom:0.5rem;">Maintenance</div><div style="font-size:0.88rem;color:var(--muted);line-height:1.6;max-width:280px;">'+_escHtmlLocal(msg)+'</div>';
        document.body.appendChild(overlay);
      }
    } else {
      var old = document.getElementById('_maintOverlay');
      if(old) old.remove();
    }
    // Bannière
    var bannerEl = document.getElementById('_globalBannerBar');
    if(cfg.banner_active && cfg.banner_msg){
      if(!bannerEl){
        bannerEl = document.createElement('div');
        bannerEl.id = '_globalBannerBar';
        bannerEl.style.cssText='position:fixed;top:0;left:0;right:0;z-index:500;background:linear-gradient(90deg,rgba(255,215,0,0.95),rgba(255,45,155,0.85));color:#000;font-size:0.78rem;font-weight:700;padding:0.45rem 1rem;text-align:center;cursor:pointer;display:flex;align-items:center;justify-content:space-between;';
        document.body.appendChild(bannerEl);
      }
      bannerEl.innerHTML='<span>📢 '+_escHtmlLocal(cfg.banner_msg)+'</span><button onclick="this.parentElement.style.display=\'none\'" style="background:none;border:none;color:#000;font-size:1rem;cursor:pointer;padding:0 0.3rem;line-height:1;">✕</button>';
      if(cfg.banner_link) bannerEl.querySelector('span').onclick=function(){ window.open(cfg.banner_link,'_blank'); };
    } else {
      if(bannerEl) bannerEl.style.display='none';
    }
  }).catch(function(){});
}

// Vérifier la bannière au chargement et toutes les 2 minutes
setTimeout(_checkGlobalBanner, 3000);
setInterval(_checkGlobalBanner, 120000);

console.log('✅ AMBI241 Admin Control v2.0 chargé');
})();