
(function() {
'use strict';

/* ══════════════════════════════════════════════════════
   0 — STYLES
   ══════════════════════════════════════════════════════ */
var _css = `
/* ── Overlay ── */
#ppOverlay{
  display:none;position:fixed;inset:0;z-index:5000;
  background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);
  align-items:flex-end;justify-content:center;
  padding:0;
  animation:ppFadeIn .2s ease;
}
#ppOverlay.pp-open{display:flex;}
@keyframes ppFadeIn{from{opacity:0}to{opacity:1}}

/* ── Sheet ── */
#ppSheet{
  background:var(--surface,#230d35);
  border:1px solid rgba(255,45,155,0.22);
  border-bottom:none;
  border-radius:22px 22px 0 0;
  width:100%;max-width:520px;
  max-height:92vh;
  overflow-y:auto;
  padding:0 0 2rem 0;
  position:relative;
  animation:ppSlideUp .3s cubic-bezier(0.34,1.3,0.64,1);
  -webkit-overflow-scrolling:touch;
}
@keyframes ppSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}

/* ── Drag handle (flottant sur la photo) ── */
.pp-handle{
  width:40px;height:4px;border-radius:4px;
  background:rgba(255,255,255,0.4);
  position:absolute;top:10px;left:50%;transform:translateX(-50%);
  z-index:20;
}

/* ── Banner zone — plein écran, sans bande noire ── */
.pp-banner{
  position:relative;
  height:220px;
  background:linear-gradient(135deg,rgba(255,45,155,0.4),rgba(0,229,255,0.2),rgba(204,68,255,0.35));
  overflow:hidden;
  flex-shrink:0;
  border-radius:22px 22px 0 0;
  margin:0;
}
.pp-banner-img{
  width:100%;height:100%;
  object-fit:cover;object-position:center top;
  display:block;
}
/* Dégradé bas uniquement — pas de bande noire en haut */
.pp-banner::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(to bottom,transparent 45%,rgba(35,13,53,0.82) 100%);
  pointer-events:none;
}
/* Titre nom établissement superposé sur la photo */
.pp-banner-title{
  position:absolute;bottom:0;left:0;right:0;
  padding:0.7rem 1.2rem 0.5rem;
  z-index:5;
}

/* ── Header zone — directement sous la photo ── */
.pp-header{
  display:flex;align-items:flex-start;gap:12px;
  padding:0.75rem 1.2rem 0;
  position:relative;z-index:2;
  margin-bottom:0.5rem;
}

/* ── Avatar (plus grand, positionné sur la photo) ── */
.pp-avatar{
  width:72px;height:72px;border-radius:16px;
  border:3px solid var(--surface,#230d35);
  flex-shrink:0;overflow:hidden;
  display:flex;align-items:center;justify-content:center;
  font-weight:800;font-size:1.5rem;
  background:linear-gradient(135deg,#ff2d9b,#cc44ff);
  color:#fff;
  box-shadow:0 4px 18px rgba(0,0,0,0.55);
  margin-top:-36px;
  position:relative;z-index:10;
}
.pp-avatar img{width:100%;height:100%;object-fit:cover;display:block;}


/* ── Name+badges row ── */
.pp-name-block{flex:1;min-width:0;padding-bottom:4px;}
.pp-display-name{
  font-family:'Syne',sans-serif;font-weight:800;font-size:1rem;
  color:var(--text,#fff0f8);line-height:1.2;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.pp-role-badge{
  display:inline-flex;align-items:center;gap:4px;
  font-size:0.58rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  padding:2px 7px;border-radius:4px;margin-top:4px;
}
.pp-role-membre{background:rgba(0,229,255,0.12);color:#00e5ff;border:1px solid rgba(0,229,255,0.3);}
.pp-role-etablissement{background:rgba(255,215,0,0.12);color:#ffd700;border:1px solid rgba(255,215,0,0.3);}
.pp-role-chauffeur{background:rgba(255,215,0,0.12);color:#ff9800;border:1px solid rgba(255,152,0,0.35);}
.pp-role-admin{background:rgba(255,45,155,0.15);color:#ff2d9b;border:1px solid rgba(255,45,155,0.35);}

/* ── Close btn (flottant sur la photo) ── */
.pp-close-btn{
  position:absolute;top:14px;right:14px;z-index:30;
  background:rgba(0,0,0,0.45);border:1.5px solid rgba(255,255,255,0.25);
  color:rgba(255,255,255,0.9);width:34px;height:34px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:0.95rem;cursor:pointer;transition:all .2s;
  backdrop-filter:blur(6px);
}
.pp-close-btn:active{background:rgba(255,255,255,0.18);transform:scale(.92);}

/* ── Body ── */
.pp-body{padding:0 1.2rem;}
.pp-bio{
  font-size:0.82rem;color:var(--muted,#b088c0);line-height:1.6;
  margin-bottom:0.85rem;white-space:pre-wrap;
}
.pp-bio-empty{
  font-size:0.78rem;color:rgba(255,255,255,0.2);font-style:italic;
  margin-bottom:0.85rem;
}

/* ── Stats chips ── */
.pp-stats{display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.85rem;}
.pp-stat{
  display:inline-flex;flex-direction:column;align-items:center;
  background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);
  border-radius:10px;padding:0.4rem 0.6rem;min-width:52px;
}
.pp-stat-val{font-family:'Syne',sans-serif;font-size:0.9rem;font-weight:800;color:var(--text,#fff0f8);line-height:1;}
.pp-stat-lbl{font-size:0.56rem;color:var(--muted,#b088c0);margin-top:2px;}

/* ── Social row ── */
.pp-socials{display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.9rem;}
.pp-social-btn{
  display:inline-flex;align-items:center;gap:5px;
  padding:0.32rem 0.65rem;border-radius:20px;
  font-size:0.7rem;font-weight:700;font-family:'DM Sans',sans-serif;
  text-decoration:none;border:1px solid;cursor:pointer;
  transition:all .18s;
}
.pp-social-btn:active{opacity:.7;transform:scale(.95);}
.pp-social-wa{background:rgba(37,211,102,.1);border-color:rgba(37,211,102,.35);color:#25d366;}
.pp-social-ig{background:rgba(225,48,108,.1);border-color:rgba(225,48,108,.35);color:#e1306c;}
.pp-social-fb{background:rgba(24,119,242,.1);border-color:rgba(24,119,242,.35);color:#1877f2;}
.pp-social-tk{background:rgba(0,0,0,.2);border-color:rgba(255,255,255,.2);color:#fff;}
.pp-social-web{background:rgba(0,229,255,.08);border-color:rgba(0,229,255,.3);color:#00e5ff;}
.pp-social-phone{background:rgba(0,255,170,.08);border-color:rgba(0,255,170,.3);color:#00ffaa;}

/* ── Divider ── */
.pp-divider{height:1px;background:rgba(255,255,255,.06);margin:0.6rem 0;}

/* ── Section label ── */
.pp-section-lbl{
  font-size:0.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  color:rgba(255,255,255,.3);margin-bottom:0.5rem;display:flex;align-items:center;gap:.5rem;
}
.pp-section-lbl::after{content:'';flex:1;height:1px;background:rgba(255,255,255,.06);}

/* ── Action buttons ── */
.pp-actions{display:flex;gap:0.5rem;margin-top:0.3rem;padding-top:0.7rem;border-top:1px solid rgba(255,255,255,.06);}
.pp-btn{
  flex:1;padding:0.65rem;border-radius:12px;border:none;
  font-family:'Syne',sans-serif;font-weight:800;font-size:0.8rem;
  cursor:pointer;transition:opacity .2s;
}
.pp-btn:active{opacity:.8;}
.pp-btn-edit{background:linear-gradient(135deg,#ff2d9b,#cc44ff);color:#fff;}
.pp-btn-sec{background:rgba(255,255,255,.06);color:var(--muted);border:1px solid rgba(255,255,255,.1);}

/* ══ EDIT FORM ══ */
#ppEditPanel{display:none;}
#ppEditPanel.pp-edit-open{display:block;}
.pp-edit-title{
  font-family:'Syne',sans-serif;font-weight:800;font-size:0.95rem;
  color:var(--pink,#ff2d9b);margin-bottom:0.3rem;
  display:flex;align-items:center;gap:.5rem;
}
.pp-field{margin-bottom:0.75rem;}
.pp-field label{display:block;font-size:0.68rem;font-weight:700;color:var(--muted,#b088c0);margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.05em;}
.pp-field input,.pp-field textarea,.pp-field select{
  width:100%;background:var(--surface2,#2c1040);
  border:1px solid rgba(255,45,155,.2);border-radius:10px;
  color:var(--text,#fff0f8);font-family:'DM Sans',sans-serif;
  font-size:0.84rem;padding:.55rem .8rem;outline:none;
  transition:border-color .2s;
}
.pp-field input:focus,.pp-field textarea:focus{border-color:rgba(255,45,155,.5);}
.pp-field textarea{resize:vertical;min-height:70px;}
.pp-char-count{font-size:0.62rem;color:var(--muted);text-align:right;margin-top:2px;}

/* Avatar upload zone */
.pp-avatar-upload{
  display:flex;align-items:center;gap:12px;margin-bottom:1rem;
}
.pp-avatar-preview{
  width:62px;height:62px;border-radius:50%;overflow:hidden;
  border:2px solid rgba(255,45,155,.35);
  display:flex;align-items:center;justify-content:center;
  font-size:1.4rem;font-weight:800;flex-shrink:0;
  background:linear-gradient(135deg,#ff2d9b,#cc44ff);color:#fff;
  cursor:pointer;position:relative;
}
.pp-avatar-preview img{width:100%;height:100%;object-fit:cover;display:block;}
.pp-avatar-preview input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;}
.pp-avatar-change-hint{font-size:0.72rem;color:var(--muted);}
.pp-avatar-change-hint small{display:block;font-size:0.62rem;color:rgba(255,255,255,.25);margin-top:2px;}

/* Visibility toggle */
.pp-visibility-row{
  display:flex;align-items:center;justify-content:space-between;
  background:rgba(0,229,255,.04);border:1px solid rgba(0,229,255,.12);
  border-radius:10px;padding:.55rem .75rem;margin-bottom:.85rem;
}
.pp-vis-label{font-size:.78rem;color:var(--text);}
.pp-vis-sub{font-size:.62rem;color:var(--muted);}

/* Save / Cancel */
.pp-save-row{display:flex;gap:.5rem;margin-top:1rem;}
.pp-btn-save{background:linear-gradient(135deg,#00ffaa,#00e5ff);color:#000;font-family:'Syne',sans-serif;font-weight:800;font-size:.85rem;padding:.7rem;border-radius:12px;border:none;cursor:pointer;flex:1;transition:opacity .2s;}
.pp-btn-save:active{opacity:.85;}
.pp-btn-cancel{background:rgba(255,255,255,.05);color:var(--muted);border:1px solid rgba(255,255,255,.1);font-family:'Syne',sans-serif;font-weight:700;font-size:.82rem;padding:.7rem;border-radius:12px;cursor:pointer;flex:1;}
`;

var styleEl = document.createElement('style');
styleEl.textContent = _css;
document.head.appendChild(styleEl);

/* ══════════════════════════════════════════════════════
   1 — CRÉER LE MODAL DOM (une seule fois)
   ══════════════════════════════════════════════════════ */
var _overlay = null;
function _initModal() {
  if(document.getElementById('ppOverlay')) { _overlay = document.getElementById('ppOverlay'); return; }
  _overlay = document.createElement('div');
  _overlay.id = 'ppOverlay';
  _overlay.innerHTML = `
    <div id="ppSheet">
      <button class="pp-close-btn" onclick="window.closePublicProfile()">✕</button>
      <div class="pp-banner" id="ppBanner">
        <div class="pp-handle"></div>
        <img id="ppBannerImg" class="pp-banner-img" src="" alt="" style="display:none;">
        <div class="pp-banner-title" id="ppBannerTitle" style="display:none;"></div>
      </div>
      <div class="pp-header">
        <div class="pp-avatar" id="ppAvatar"></div>
        <div class="pp-name-block">
          <div class="pp-display-name" id="ppDisplayName">—</div>
          <div id="ppRoleBadge"></div>
        </div>
      </div>
      <div class="pp-body">
        <div id="ppViewPanel">
          <div id="ppBio"></div>
          <div class="pp-stats" id="ppStats"></div>
          <div class="pp-section-lbl" id="ppSocialsLabel" style="display:none;">Contact &amp; Réseaux</div>
          <div class="pp-socials" id="ppSocials"></div>
          <div class="pp-divider" id="ppActionsDivider"></div>
          <div class="pp-actions" id="ppActions"></div>
        </div>
        <div id="ppEditPanel">
          <div class="pp-edit-title">✏️ Modifier le profil public</div>
          <div style="font-size:.72rem;color:var(--muted);margin-bottom:1rem;line-height:1.5;">
            Ces informations sont visibles par tous les visiteurs.
          </div>
          <div class="pp-avatar-upload">
            <div class="pp-avatar-preview" id="ppEditAvatarPreview">
              <input type="file" accept="image/*" id="ppAvatarInput" onchange="window._ppOnAvatarSelected(this)">
            </div>
            <div>
              <div class="pp-avatar-change-hint">Cliquez pour changer l'avatar</div>
              <small class="pp-avatar-change-hint" style="font-size:.62rem;color:rgba(255,255,255,.25);">Carré conseillé · max 2Mo</small>
            </div>
          </div>
          <div class="pp-visibility-row">
            <div>
              <div class="pp-vis-label">👁️ Profil public</div>
              <div class="pp-vis-sub">Visible par tous les visiteurs</div>
            </div>
            <label class="notif-toggle"><input type="checkbox" id="ppVisToggle" checked><span class="notif-toggle-slider"></span></label>
          </div>
          <div class="pp-field">
            <label>Nom affiché *</label>
            <input type="text" id="ppEditName" maxlength="40" placeholder="Votre nom ou pseudo public">
          </div>
          <div class="pp-field">
            <label>Bio / Description</label>
            <textarea id="ppEditBio" maxlength="160" placeholder="Présentez-vous en quelques mots..." rows="3" oninput="document.getElementById('ppBioCount').textContent=this.value.length+'/160'"></textarea>
            <div class="pp-char-count" id="ppBioCount">0/160</div>
          </div>
          <div class="pp-section-lbl" style="margin-bottom:.6rem;">Réseaux &amp; Contact visibles</div>
          <div class="pp-field">
            <label>📱 WhatsApp (numéro)</label>
            <input type="tel" id="ppEditWA" placeholder="+241 XX XX XX XX" maxlength="20">
          </div>
          <div class="pp-field">
            <label>📸 Instagram (@username)</label>
            <input type="text" id="ppEditIG" placeholder="@moncompte" maxlength="30">
          </div>
          <div class="pp-field">
            <label>🎵 TikTok (@username)</label>
            <input type="text" id="ppEditTK" placeholder="@moncompte" maxlength="30">
          </div>
          <div class="pp-field">
            <label>🌐 Site web / Lien</label>
            <input type="url" id="ppEditWeb" placeholder="https://..." maxlength="80">
          </div>
          <div class="pp-save-row">
            <button class="pp-btn-save" onclick="window._ppSave()">💾 Sauvegarder</button>
            <button class="pp-btn-cancel" onclick="window._ppCancelEdit()">Annuler</button>
          </div>
        </div>
      </div>
    </div>`;
  _overlay.addEventListener('click', function(e){ if(e.target === _overlay) window.closePublicProfile(); });
  document.body.appendChild(_overlay);
}

/* ══════════════════════════════════════════════════════
   2 — STOCKAGE PROFILS
   ══════════════════════════════════════════════════════ */
var PROFILE_KEY = 'ambi241_pub_profiles_v1';

function _loadProfiles() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}'); } catch(e) { return {}; }
}
function _saveProfiles(obj) {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(obj)); } catch(e) {}
}
function _getProfile(type, id) {
  var all = _loadProfiles();
  return all[type + ':' + id] || {};
}
function _setProfile(type, id, data) {
  var all = _loadProfiles();
  all[type + ':' + id] = Object.assign(_getProfile(type, id), data, { updatedAt: Date.now() });
  _saveProfiles(all);
  // Sync Firebase si disponible
  if(window.db && window.fbDoc && window.fbSetDoc) {
    try {
      var docKey = ('pubprofile_' + type + '_' + String(id)).replace(/[^a-zA-Z0-9_-]/g,'_');
      window.fbSetDoc(window.fbDoc(window.db, 'public_profiles', docKey), all[type + ':' + id]).catch(function(){});
    } catch(e) {}
  }
}

/* ══════════════════════════════════════════════════════
   3 — ÉTAT COURANT
   ══════════════════════════════════════════════════════ */
var _ppState = { type: null, id: null, rawData: {}, editing: false };
var _ppAvatarDataUrl = null; // pour l'upload en cours

/* ══════════════════════════════════════════════════════
   4 — VÉRIFIER SI L'UTILISATEUR PEUT ÉDITER
   ══════════════════════════════════════════════════════ */
function _canEdit(type, id, rawData) {
  // Admin global
  if(window.isAdmin) return true;
  if(type === 'membre') {
    if(!window.currentUserUID && !window.currentUserEmail) return false;
    var profUid = rawData.uid || rawData.userId || '';
    var profEmail = (rawData.email || '').toLowerCase();
    var curEmail = (window.currentUserEmail || '').toLowerCase();
    var curUid = window.currentUserUID || '';
    return (profUid && profUid === curUid) || (profEmail && profEmail === curEmail);
  }
  if(type === 'etablissement') {
    if(typeof window.isResponsable === 'function') return window.isResponsable(id);
    // Fallback: si l'email du gérant correspond
    var etabEmail = (rawData.email || '').toLowerCase();
    var curEmail2 = (window.currentUserEmail || '').toLowerCase();
    return etabEmail && curEmail2 && etabEmail === curEmail2;
  }
  if(type === 'chauffeur') {
    // Le chauffeur peut éditer si son phone correspond à l'utilisateur courant
    var driverPhone = (rawData.phone || '').replace(/\s/g,'');
    var curPhone = (window.currentUserPhone || '').replace(/\s/g,'');
    return curPhone && driverPhone && driverPhone === curPhone;
  }
  return false;
}

/* ══════════════════════════════════════════════════════
   5 — RENDRE LE PROFIL EN LECTURE
   ══════════════════════════════════════════════════════ */
function _renderView(type, id, rawData, profData) {
  _initModal();
  var canEdit = _canEdit(type, id, rawData);

  /* ── Avatar ── */
  var avatarEl = document.getElementById('ppAvatar');
  avatarEl.innerHTML = '';
  var avatarSrc = profData.avatar || rawData.photo || rawData.photo_profil ||
    (rawData.photos && rawData.photos[0]) || '';
  // Fallback établissement : photo principale
  if(!avatarSrc && type === 'etablissement') {
    avatarSrc = rawData._photo_profile_approved || '';
    if(!avatarSrc && rawData._gphoto_urls && rawData._gphoto_urls.length>0) avatarSrc = rawData._gphoto_urls[0];
    if(!avatarSrc) avatarSrc = rawData.photo_interieur || rawData.photo_exterieur || '';
    /* Slots localStorage */
    if(!avatarSrc){
      try{
        var _aKeys=['ambi241_photos_'+id+'_exterieur','ambi241_photos_'+id+'_interieur','ambi241_photos_'+id];
        for(var _ai=0;_ai<_aKeys.length;_ai++){
          var _ad=localStorage.getItem(_aKeys[_ai]);
          if(_ad){var _as=JSON.parse(_ad);if(_as&&_as[0]&&_as[0].url){avatarSrc=_as[0].url;break;}}
        }
      }catch(ex3){}
    }
  }
  // Fallback chauffeur
  if(!avatarSrc && type === 'chauffeur') {
    avatarSrc = rawData.photo || '';
  }
  if(avatarSrc) {
    avatarEl.innerHTML = '<img src="' + avatarSrc + '" alt="" onerror="this.parentElement.innerHTML=\''+_ppInitials(rawData, type)+'\'">';
  } else {
    avatarEl.textContent = _ppInitials(rawData, type);
    // Color per type
    var bgMap = { membre: 'linear-gradient(135deg,#00e5ff,#0080ff)', etablissement: 'linear-gradient(135deg,#ffd700,#ff8800)', chauffeur: 'linear-gradient(135deg,#ff9800,#ffcc00)' };
    avatarEl.style.background = bgMap[type] || 'linear-gradient(135deg,#ff2d9b,#cc44ff)';
  }

  /* ── Banner ── */
  var bannerImg = document.getElementById('ppBannerImg');
  var bannerTitle = document.getElementById('ppBannerTitle');
  // Chercher la meilleure photo disponible
  var bannerSrc = '';
  if(type === 'etablissement') {
    bannerSrc = rawData._photo_profile_approved || '';
    if(!bannerSrc && rawData._gphoto_urls && rawData._gphoto_urls.length>0) bannerSrc = rawData._gphoto_urls[0];
    if(!bannerSrc) bannerSrc = rawData.photo_exterieur || rawData.photo_interieur || profData.avatar || '';
    /* Slots localStorage */
    if(!bannerSrc){
      try{
        var _bKeys=['ambi241_photos_'+id+'_exterieur','ambi241_photos_'+id+'_interieur','ambi241_photos_'+id];
        for(var _bi=0;_bi<_bKeys.length;_bi++){
          var _bd=localStorage.getItem(_bKeys[_bi]);
          if(_bd){var _bs=JSON.parse(_bd);if(_bs&&_bs[0]&&_bs[0].url){bannerSrc=_bs[0].url;break;}}
        }
      }catch(ex2){}
    }
    /* Appel getGooglePhotoUrl si disponible */
    if(!bannerSrc && typeof getGooglePhotoUrl==='function'){
      var _gp=getGooglePhotoUrl(rawData,'exterieur');
      if(_gp && !_gp.startsWith('data:image/svg')) bannerSrc=_gp;
    }
  } else if(type === 'membre') {
    bannerSrc = profData.avatar || rawData.photo || '';
  } else if(type === 'chauffeur') {
    bannerSrc = rawData.photo || profData.avatar || '';
  }
  if(bannerSrc) {
    bannerImg.src = bannerSrc;
    bannerImg.style.display = 'block';
    bannerImg.onerror = function(){ this.style.display='none'; };
  } else {
    bannerImg.style.display = 'none';
  }
  // Afficher le nom sur la photo (établissements uniquement)
  if(bannerTitle) {
    if(type === 'etablissement') {
      bannerTitle.style.display = 'block';
      bannerTitle.innerHTML = '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.15rem;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.8);line-height:1.2;">' + (typeof escHtml==='function'?escHtml(rawData.nom||displayName):(rawData.nom||displayName).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')) + '</div>';
    } else {
      bannerTitle.style.display = 'none';
    }
  }

  /* ── Name ── */
  var displayName = profData.displayName || rawData.nom || rawData.name || rawData.pseudo || rawData.displayName || '—';
  document.getElementById('ppDisplayName').textContent = displayName;

  /* ── Role badge ── */
  var roleMap = {
    membre: { cls: 'pp-role-membre', label: '👤 Membre' },
    etablissement: { cls: 'pp-role-etablissement', label: '🏠 Établissement' },
    chauffeur: { cls: 'pp-role-chauffeur', label: '🚕 Chauffeur' }
  };
  var role = roleMap[type] || { cls: 'pp-role-membre', label: type };
  // Admin override
  if(rawData._isAdmin || (type === 'membre' && window.isAdmin && _canEdit('membre', id, rawData))) {
    role = { cls: 'pp-role-admin', label: '👑 Admin' };
  }
  var badgeEl = document.getElementById('ppRoleBadge');
  badgeEl.innerHTML = '<span class="pp-role-badge ' + role.cls + '">' + role.label + '</span>';
  // Extra badges
  if(type === 'etablissement' && rawData.type) {
    badgeEl.innerHTML += ' <span class="pp-role-badge" style="background:rgba(204,68,255,.1);color:#cc44ff;border:1px solid rgba(204,68,255,.25);">' + rawData.type + '</span>';
  }
  if(type === 'etablissement' && rawData.quartier) {
    badgeEl.innerHTML += ' <span class="pp-role-badge" style="background:rgba(0,255,170,.08);color:#00ffaa;border:1px solid rgba(0,255,170,.2);">📍 ' + rawData.quartier + '</span>';
  }

  /* ── Bio ── */
  var bioEl = document.getElementById('ppBio');
  var bio = profData.bio || rawData.description || rawData.bio || '';
  if(bio) {
    bioEl.className = 'pp-bio';
    bioEl.textContent = bio;
  } else {
    bioEl.className = 'pp-bio-empty';
    bioEl.textContent = canEdit ? 'Aucune bio renseignée — cliquez sur Modifier pour vous présenter.' : 'Aucune description publique.';
  }

  /* ── Stats ── */
  var statsEl = document.getElementById('ppStats');
  statsEl.innerHTML = '';
  if(type === 'etablissement') {
    var stats = [
      { val: rawData.note ? Number(rawData.note).toFixed(1) + '★' : '—', lbl: 'Note', color: '#ffd700' },
      { val: (rawData.affluence || 0) + '%', lbl: 'Affluence', color: '#ff4466' },
      { val: rawData.avis || 0, lbl: 'Avis', color: '#00e5ff' }
    ];
    stats.forEach(function(s) {
      statsEl.innerHTML += '<div class="pp-stat"><div class="pp-stat-val" style="color:' + s.color + '">' + s.val + '</div><div class="pp-stat-lbl">' + s.lbl + '</div></div>';
    });
    if(rawData.capacity) statsEl.innerHTML += '<div class="pp-stat"><div class="pp-stat-val">' + rawData.capacity + '</div><div class="pp-stat-lbl">Capacité</div></div>';
    if(rawData.statut && rawData.statut !== '') {
      var sColor = rawData.statut.indexOf('Fermé') !== -1 ? '#ff4466' : rawData.statut.indexOf('Bondé') !== -1 ? '#ff2d9b' : '#00ffaa';
      statsEl.innerHTML += '<div class="pp-stat"><div class="pp-stat-val" style="color:' + sColor + ';font-size:.72rem;">' + rawData.statut.replace('Ouvert - ','') + '</div><div class="pp-stat-lbl">Statut</div></div>';
    }
  } else if(type === 'chauffeur') {
    var r = Number(rawData.rating || profData.rating || 4.8);
    statsEl.innerHTML = '<div class="pp-stat"><div class="pp-stat-val" style="color:#ffd700">' + r.toFixed(1) + '★</div><div class="pp-stat-lbl">Note</div></div>'
      + '<div class="pp-stat"><div class="pp-stat-val" style="color:#00ffaa">' + (rawData.courses || 0) + '</div><div class="pp-stat-lbl">Courses</div></div>'
      + '<div class="pp-stat"><div class="pp-stat-val">' + (rawData.type || '🚗') + '</div><div class="pp-stat-lbl">Véhicule</div></div>';
    if(rawData.online) statsEl.innerHTML += '<div class="pp-stat"><div class="pp-stat-val" style="color:#00ffaa;font-size:.72rem;">● Dispo</div><div class="pp-stat-lbl">Statut</div></div>';
  } else if(type === 'membre') {
    var nbPubs = 0;
    try { var allPubs = JSON.parse(localStorage.getItem('ambi241_publications') || '[]'); nbPubs = allPubs.filter(function(p){ return (p.pseudo||p.auteur) === displayName; }).length; } catch(e){}
    if(nbPubs > 0) statsEl.innerHTML += '<div class="pp-stat"><div class="pp-stat-val" style="color:#cc44ff">' + nbPubs + '</div><div class="pp-stat-lbl">Posts</div></div>';
  }

  /* ── Socials ── */
  var socialsEl = document.getElementById('ppSocials');
  var socialsLbl = document.getElementById('ppSocialsLabel');
  socialsEl.innerHTML = '';
  var hasSocials = false;
  function addSocial(icon, cls, href, label) {
    hasSocials = true;
    socialsEl.innerHTML += '<a class="pp-social-btn ' + cls + '" href="' + href + '" target="_blank" rel="noopener">' + icon + ' ' + label + '</a>';
  }
  // WhatsApp
  var wa = profData.whatsapp || (type === 'etablissement' ? rawData.contact : '') || (type === 'chauffeur' ? rawData.phone : '');
  if(wa) {
    var cleanWa = wa.replace(/[\s\+]/g,'');
    addSocial('💬', 'pp-social-wa', 'https://wa.me/' + cleanWa, 'WhatsApp');
  }
  // Instagram
  var ig = profData.instagram || rawData.instagram || '';
  if(ig) { var igU = ig.replace('@',''); addSocial('📸', 'pp-social-ig', 'https://instagram.com/' + igU, ig.startsWith('@') ? ig : '@' + ig); }
  // TikTok
  var tk = profData.tiktok || rawData.tiktok || '';
  if(tk) { var tkU = tk.replace('@',''); addSocial('🎵', 'pp-social-tk', 'https://tiktok.com/@' + tkU, tk.startsWith('@') ? tk : '@' + tk); }
  // Website
  var web = profData.website || rawData.website || rawData.maps_url || '';
  if(web && web.indexOf('google.com/maps') === -1) addSocial('🌐', 'pp-social-web', web, 'Site web');
  // Google Maps for establishments
  if(type === 'etablissement' && rawData.maps_url) addSocial('📍', 'pp-social-web', rawData.maps_url, 'Google Maps');
  // Phone for chauffeur if no whatsapp
  if(type === 'chauffeur' && rawData.phone && !wa) addSocial('📞', 'pp-social-phone', 'tel:' + rawData.phone, rawData.phone);

  socialsLbl.style.display = hasSocials ? 'flex' : 'none';

  /* ── Actions ── */
  var actEl = document.getElementById('ppActions');
  var actDivEl = document.getElementById('ppActionsDivider');
  actEl.innerHTML = '';
  if(canEdit) {
    actEl.innerHTML = '<button class="pp-btn pp-btn-edit" onclick="window._ppOpenEdit()">✏️ Modifier mon profil</button>';
  }
  // Pour établissement: bouton voir fiche
  if(type === 'etablissement') {
    actEl.innerHTML += '<button class="pp-btn pp-btn-sec" onclick="window.closePublicProfile();setTimeout(function(){if(typeof openFicheEtab===\'function\')openFicheEtab(' + id + ');},120);">🏠 Voir la fiche complète pour réservation</button>';
    /* Rechargement réactif si la photo Google arrive après l'ouverture */
    if(!bannerSrc && rawData._gphoto_urls === undefined && typeof _gphotoEnqueue === 'function') {
      _gphotoEnqueue(rawData);
      var _ppPhotoWait = 0;
      var _ppPhotoTimer = setInterval(function(){
        _ppPhotoWait++;
        var _newBanner = rawData._photo_profile_approved || (rawData._gphoto_urls && rawData._gphoto_urls[0]) || '';
        if(_newBanner || _ppPhotoWait > 12) {
          clearInterval(_ppPhotoTimer);
          if(_newBanner && document.getElementById('ppBannerImg')) {
            var _bImgEl = document.getElementById('ppBannerImg');
            _bImgEl.src = _newBanner;
            _bImgEl.style.display = 'block';
          }
        }
      }, 500);
    }
  }
  // Pour chauffeur: bouton appeler
  if(type === 'chauffeur' && rawData.phone) {
    actEl.innerHTML += '<a class="pp-btn pp-btn-sec" href="tel:' + rawData.phone + '" style="text-align:center;text-decoration:none;display:block;">📞 Appeler</a>';
  }
  var hasActions = actEl.innerHTML !== '';
  actDivEl.style.display = hasActions ? 'block' : 'none';
  actEl.style.display = hasActions ? 'flex' : 'none';
}

/* ══════════════════════════════════════════════════════
   6 — OUVRIR / FERMER
   ══════════════════════════════════════════════════════ */
window.openPublicProfile = function(type, id, rawData) {
  _initModal();
  var profData = _getProfile(type, id);
  _ppState = { type: type, id: id, rawData: rawData || {}, editing: false };
  _ppAvatarDataUrl = null;

  // Masquer l'éditeur, montrer la vue
  document.getElementById('ppViewPanel').style.display = 'block';
  document.getElementById('ppEditPanel').classList.remove('pp-edit-open');

  _renderView(type, id, rawData || {}, profData);

  _overlay.classList.add('pp-open');
  document.body.style.overflow = 'hidden';
};

window.closePublicProfile = function() {
  if(_overlay) _overlay.classList.remove('pp-open');
  document.body.style.overflow = '';
};

/* ══════════════════════════════════════════════════════
   7 — ÉDITEUR
   ══════════════════════════════════════════════════════ */
window._ppOpenEdit = function() {
  var s = _ppState;
  var profData = _getProfile(s.type, s.id);
  var rawData = s.rawData;

  // Pré-remplir les champs
  var currentName = profData.displayName || rawData.nom || rawData.name || rawData.pseudo || '';
  document.getElementById('ppEditName').value = currentName;
  document.getElementById('ppEditBio').value = profData.bio || rawData.description || rawData.bio || '';
  document.getElementById('ppBioCount').textContent = (profData.bio || '').length + '/160';
  document.getElementById('ppEditWA').value = profData.whatsapp || (s.type === 'etablissement' ? rawData.contact : '') || (s.type === 'chauffeur' ? rawData.phone : '') || '';
  document.getElementById('ppEditIG').value = profData.instagram || rawData.instagram || '';
  document.getElementById('ppEditTK').value = profData.tiktok || rawData.tiktok || '';
  document.getElementById('ppEditWeb').value = profData.website || rawData.website || '';
  document.getElementById('ppVisToggle').checked = profData.isPublic !== false;

  // Avatar preview
  var prevEl = document.getElementById('ppEditAvatarPreview');
  var avatarSrc = profData.avatar || rawData.photo || (s.type === 'etablissement' ? (rawData._photo_profile_approved || rawData.photo_interieur || '') : '') || '';
  prevEl.innerHTML = '';
  if(avatarSrc) {
    prevEl.innerHTML = '<img src="' + avatarSrc + '" alt="">';
  } else {
    prevEl.textContent = _ppInitials(rawData, s.type);
    prevEl.style.background = s.type === 'etablissement' ? 'linear-gradient(135deg,#ffd700,#ff8800)' : s.type === 'chauffeur' ? 'linear-gradient(135deg,#ff9800,#ffcc00)' : 'linear-gradient(135deg,#ff2d9b,#cc44ff)';
  }
  // Réajouter l'input file
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.id = 'ppAvatarInput';
  inp.style.cssText = 'position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;';
  inp.onchange = function(){ window._ppOnAvatarSelected(this); };
  prevEl.appendChild(inp);

  document.getElementById('ppViewPanel').style.display = 'none';
  document.getElementById('ppEditPanel').classList.add('pp-edit-open');

  // Scroll to top
  document.getElementById('ppSheet').scrollTop = 0;
};

window._ppCancelEdit = function() {
  document.getElementById('ppEditPanel').classList.remove('pp-edit-open');
  document.getElementById('ppViewPanel').style.display = 'block';
};

window._ppOnAvatarSelected = function(inp) {
  var file = inp.files && inp.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    _ppAvatarDataUrl = e.target.result;
    var prevEl = document.getElementById('ppEditAvatarPreview');
    var src = e.target.result;
    // Reconstruire avec img
    var inputEl = prevEl.querySelector('input[type=file]');
    prevEl.innerHTML = '<img src="' + src + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">';
    if(inputEl) prevEl.appendChild(inputEl);
  };
  reader.readAsDataURL(file);
};

window._ppSave = function() {
  var s = _ppState;
  if(!s.type || !s.id) return;
  var name = (document.getElementById('ppEditName').value || '').trim();
  if(!name) { if(typeof showToast === 'function') showToast('⚠️ Le nom affiché est requis'); return; }

  var newData = {
    displayName: name,
    bio: (document.getElementById('ppEditBio').value || '').trim(),
    whatsapp: (document.getElementById('ppEditWA').value || '').trim(),
    instagram: (document.getElementById('ppEditIG').value || '').trim(),
    tiktok: (document.getElementById('ppEditTK').value || '').trim(),
    website: (document.getElementById('ppEditWeb').value || '').trim(),
    isPublic: document.getElementById('ppVisToggle').checked
  };
  if(_ppAvatarDataUrl) newData.avatar = _ppAvatarDataUrl;

  _setProfile(s.type, s.id, newData);
  if(typeof showToast === 'function') showToast('✅ Profil public mis à jour !');

  // Mettre à jour l'affichage
  var profData = _getProfile(s.type, s.id);
  _ppCancelEdit();
  _renderView(s.type, s.id, s.rawData, profData);
};

/* ══════════════════════════════════════════════════════
   8 — UTILITAIRES
   ══════════════════════════════════════════════════════ */
function _ppInitials(data, type) {
  var name = data.nom || data.name || data.pseudo || data.displayName || '?';
  return name.split(' ').map(function(w){ return w[0] || ''; }).join('').toUpperCase().slice(0,2) || '??';
}

/* ══════════════════════════════════════════════════════
   9 — HOOKS AUTOMATIQUES (Patch des fonctions existantes)
   ══════════════════════════════════════════════════════ */

// ── A) Auteurs de publications → profil membre ──
var _prevOpenPubAuthorFilter = window.openPubAuthorFilter;
window.openPubAuthorFilter = function(pseudo, pubId) {
  if(!pseudo) return;
  // Chercher les données du membre
  var rawData = { pseudo: pseudo, name: pseudo };
  // Essayer de récupérer le UID depuis Firebase
  if(window.currentUserPseudo === pseudo && window.currentUserUID) {
    rawData.uid = window.currentUserUID;
    rawData.email = window.currentUserEmail || '';
  }
  window.openPublicProfile('membre', 'pseudo_' + pseudo.replace(/\s/g,'_'), rawData);
};

// ── B) Noms établissements (dans les publications et les cartes) ──
// On patche searchEtabFromPub pour montrer le profil aussi
var _prevSearchEtabFromPub = window.searchEtabFromPub;
window.searchEtabFromPub = function(etabNom) {
  // Chercher l'établissement dans la liste
  if(typeof etablissements !== 'undefined') {
    var found = etablissements.find(function(e) {
      return (e.nom || '').toLowerCase() === (etabNom || '').toLowerCase();
    });
    if(found) { window.openPublicProfile('etablissement', found.id, found); return; }
  }
  // Fallback : comportement original
  if(typeof _prevSearchEtabFromPub === 'function') _prevSearchEtabFromPub(etabNom);
};

// ── C) Chauffeurs (déjà hookés via showDriverProfile) ──
// On remplace showDriverProfile
var _prevShowDriverProfile = window.showDriverProfile;
window.showDriverProfile = function(encodedPhone) {
  var phone = '';
  try { phone = decodeURIComponent(encodedPhone); } catch(e) { phone = encodedPhone; }
  var contacts = [];
  try { contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]'); } catch(e) {}
  var driver = contacts.find(function(c) { return (c.phone||'').replace(/\s/g,'') === phone.replace(/\s/g,''); });
  if(driver) {
    window.openPublicProfile('chauffeur', 'driver_' + phone.replace(/[^0-9]/g,''), driver);
  } else if(typeof _prevShowDriverProfile === 'function') {
    _prevShowDriverProfile(encodedPhone);
  } else {
    // Profil minimal
    window.openPublicProfile('chauffeur', 'driver_' + phone.replace(/[^0-9]/g,''), { phone: phone, name: 'Chauffeur', type: '🚗 Taxi' });
  }
};

// ── D) Noms cliquables dans les établissements (header nom) ──
// On ajoute un listener délégué pour les .card-nom et .card-title cliquables
document.addEventListener('click', function(e) {
  var target = e.target;
  // Remonter jusqu'à 3 niveaux
  for(var i = 0; i < 3; i++) {
    if(!target) break;
    if(target.getAttribute && target.getAttribute('data-pp-type')) {
      var ppType = target.getAttribute('data-pp-type');
      var ppId = target.getAttribute('data-pp-id');
      var ppRaw = {};
      try { ppRaw = JSON.parse(target.getAttribute('data-pp-raw') || '{}'); } catch(e) {}
      window.openPublicProfile(ppType, ppId, ppRaw);
      e.stopPropagation();
      return;
    }
    target = target.parentElement;
  }
}, true);

/* ══════════════════════════════════════════════════════
   10 — HELPER POUR RENDRE LES NOMS CLIQUABLES PARTOUT
   ══════════════════════════════════════════════════════ */
/**
 * Enveloppe un nom en texte dans un span cliquable qui ouvre le profil public.
 * Usage dans les templates HTML existants :
 *   ppLink('membre', 'pseudo_Jean', { pseudo:'Jean' }, 'Jean')
 *   ppLink('etablissement', 42, etabObj, 'Le Crystal')
 *   ppLink('chauffeur', 'driver_24177001010', driverObj, 'M. Dupont')
 */
window.ppLink = function(type, id, rawData, label) {
  var safeRaw = JSON.stringify(rawData || {}).replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return '<span style="cursor:pointer;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;" '
    + 'data-pp-type="' + type + '" data-pp-id="' + id + '" data-pp-raw="' + safeRaw + '">'
    + (label || '—')
    + '</span>';
};
window.ppLinkEtab = function(etab) {
  if(!etab) return '—';
  return window.ppLink('etablissement', etab.id, etab, etab.nom || '—');
};
window.ppLinkDriver = function(driver) {
  if(!driver) return '—';
  var pid = 'driver_' + (driver.phone||'').replace(/[^0-9]/g,'');
  return window.ppLink('chauffeur', pid, driver, driver.name || '—');
};
window.ppLinkMembre = function(pseudo, uid, email) {
  var raw = { pseudo: pseudo, uid: uid || '', email: email || '' };
  return window.ppLink('membre', 'pseudo_' + (pseudo||'').replace(/\s/g,'_'), raw, pseudo || '—');
};

/* ══════════════════════════════════════════════════════
   11 — PATCH RENDU TABLEAU ADMIN : noms établissements cliquables
   ══════════════════════════════════════════════════════ */
// Après chaque renderAll, rendre les noms d'établissements dans les cartes cliquables
var _raf_tick = null;
function _patchEtabNameLinks() {
  // Trouver tous les éléments qui affichent un nom d'établissement dans les cartes
  document.querySelectorAll('[data-etab-id]').forEach(function(el) {
    if(el.getAttribute('data-pp-patched')) return;
    el.setAttribute('data-pp-patched', '1');
    var etabId = parseInt(el.getAttribute('data-etab-id'));
    if(!etabId || isNaN(etabId)) return;
    var etab = typeof etablissements !== 'undefined' ? etablissements.find(function(e){ return e.id === etabId; }) : null;
    if(!etab) return;
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(ev) {
      ev.stopPropagation();
      window.openPublicProfile('etablissement', etabId, etab);
    });
  });
}

// Observer les mutations pour patcher automatiquement
if(typeof MutationObserver !== 'undefined') {
  var _ppMo = new MutationObserver(function() {
    if(_raf_tick) cancelAnimationFrame(_raf_tick);
    _raf_tick = requestAnimationFrame(_patchEtabNameLinks);
  });
  _ppMo.observe(document.body, { childList: true, subtree: true });
}

/* ══════════════════════════════════════════════════════
   12 — INIT : charger les profils depuis Firebase au démarrage
   ══════════════════════════════════════════════════════ */
function _loadProfilesFromFirebase() {
  if(!window.db || !window.fbCollection || !window.fbGetDocs) return;
  try {
    window.fbGetDocs(window.fbCollection(window.db, 'public_profiles')).then(function(snap) {
      var all = _loadProfiles();
      snap.forEach(function(d) {
        var key = d.id.replace('pubprofile_','').replace(/_/g, function(m, off, str) {
          // Reconstruire la clé type:id
          return off === str.indexOf('_') ? ':' : '_';
        });
        // Simplification : stocker directement par docId transformé
        var data = d.data();
        var parts = d.id.replace('pubprofile_','').split('_');
        if(parts.length >= 2) {
          var t = parts[0];
          var id2 = parts.slice(1).join('_');
          all[t + ':' + id2] = data;
        }
      });
      _saveProfiles(all);
    }).catch(function(){});
  } catch(e) {}
}

// Attendre que Firebase soit prêt
setTimeout(function() {
  _loadProfilesFromFirebase();
}, 3000);

console.log('[AMBI241] ✅ Système Profils Publics chargé — openPublicProfile(type,id,data) disponible');

/* ══════════════════════════════════════════════════════════════════
   🛠️ PATCH UNIVERSEL — IMPORT FICHIERS (photos / vidéos / docs)
   Accepte TOUS les formats image et vidéo reconnus par le navigateur.
   Remplace tous les garde-fous restrictifs dispersés dans l'app.
   ══════════════════════════════════════════════════════════════════ */
(function(){

  /* ── Vérificateur universel ── */
  window.ambi_isImageFile = function(file){
    if(!file) return false;
    if(file.type && file.type.startsWith('image/')) return true;
    return /\.(jpe?g|jpg|png|webp|gif|heic|heif|avif|bmp|tiff?|svg|ico|jfif|pjpeg|pjp)$/i.test(file.name||'');
  };
  window.ambi_isVideoFile = function(file){
    if(!file) return false;
    if(file.type && file.type.startsWith('video/')) return true;
    return /\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|3gp|ogv|ts|mts|m2ts|f4v|rm|rmvb)$/i.test(file.name||'');
  };
  window.ambi_isMediaFile = function(file){
    return window.ambi_isImageFile(file) || window.ambi_isVideoFile(file);
  };

  /* ── Patcher accept="image/*" → tous formats + HEIC/AVIF ── */
  function _upgradeInputs(){
    document.querySelectorAll('input[type=file]').forEach(function(inp){
      if(inp.dataset.ambiPatched) return;
      inp.dataset.ambiPatched = '1';
      // Elargir les types image
      if(inp.accept === 'image/*'){
        inp.accept = 'image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.jfif';
      }
      // Elargir les types vidéo
      if(inp.accept === 'video/*'){
        inp.accept = 'video/*,.avi,.mov,.mkv,.wmv,.m4v,.3gp,.ts';
      }
    });
  }

  // Patcher maintenant et à chaque mutation DOM (inputs créés dynamiquement)
  _upgradeInputs();
  if(typeof MutationObserver !== 'undefined'){
    var _mo = new MutationObserver(function(){ _upgradeInputs(); });
    _mo.observe(document.body, {childList:true, subtree:true});
  }

  /* ── Patcher pHandleAvatarUpload pour accepter tous formats ── */
  var _origPHandleAvatar = window.pHandleAvatarUpload;
  window.pHandleAvatarUpload = function(input){
    var file = input.files && input.files[0];
    if(file && !window.ambi_isImageFile(file)){
      if(typeof showToast === 'function') showToast('❌ Fichier non reconnu comme image');
      input.value = '';
      return;
    }
    if(typeof _origPHandleAvatar === 'function') _origPHandleAvatar.call(this, input);
  };

  /* ── Patcher _ppOnAvatarSelected pour accepter tous formats ── */
  var _origPPOnAvatar = window._ppOnAvatarSelected;
  window._ppOnAvatarSelected = function(inp){
    var file = inp.files && inp.files[0];
    if(file && !window.ambi_isImageFile(file)){
      if(typeof showToast === 'function') showToast('❌ Fichier non reconnu comme image');
      inp.value = '';
      return;
    }
    if(typeof _origPPOnAvatar === 'function') _origPPOnAvatar.call(this, inp);
  };

  /* ── uploadProfilePhoto — délègue désormais à triggerProfilePhotoUpload (non-bloquant) ── */
  /* Le patch format universel reste actif via _processAvatarFile et onAvatarFileSelected */

  console.log('[AMBI241] ✅ Patch universel import fichiers actif — tous formats image/vidéo acceptés');
})();

})(); // fin IIFE

/* ══════════════════════════════════════════════════════════════
   ══ SCROLL NAV ARROWS — Luxury & Discrete                    ══
   ══════════════════════════════════════════════════════════════ */
(function(){
  // CSS injection
  var css = `
    .ambi-scroll-nav {
      position: fixed;
      right: 6px;
      bottom: calc(var(--nav-h, 54px) + var(--player-h, 0px) + 34px); /* au-dessus de la tab bar + lecteur */
      z-index: 200; /* abaissé : ne bloque plus les boutons 📷🎬🎉 de la compose-bar */
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }

    .ambi-scroll-btn {
      pointer-events: all;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(26, 10, 40, 0.72);
      backdrop-filter: blur(18px) saturate(1.6);
      -webkit-backdrop-filter: blur(18px) saturate(1.6);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: opacity 0.35s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1), border-color 0.25s, box-shadow 0.25s;
      box-shadow: 0 2px 16px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06);
      opacity: 0;
      transform: translateX(6px);
      will-change: opacity, transform;
    }

    .ambi-scroll-btn.visible {
      opacity: 1;
      transform: translateX(0);
    }

    .ambi-scroll-btn:hover {
      border-color: rgba(255,45,155,0.45);
      box-shadow: 0 4px 22px rgba(255,45,155,0.22), inset 0 1px 0 rgba(255,255,255,0.08);
    }

    .ambi-scroll-btn:active {
      transform: scale(0.88);
    }

    /* Icône SVG chevron */
    .ambi-scroll-btn svg {
      width: 14px;
      height: 14px;
      stroke: rgba(255,255,255,0.55);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      fill: none;
      transition: stroke 0.2s;
      flex-shrink: 0;
    }

    .ambi-scroll-btn:hover svg {
      stroke: var(--pink, #ff2d9b);
    }

    /* Trait doré ultra-fin entre les deux boutons */
    .ambi-scroll-divider {
      width: 1px;
      height: 14px;
      background: linear-gradient(to bottom, transparent, rgba(255,215,0,0.25), transparent);
      margin: 0 auto;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.35s ease;
    }

    .ambi-scroll-divider.visible {
      opacity: 1;
    }
  `;

  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  // DOM
  var nav = document.createElement('div');
  nav.className = 'ambi-scroll-nav';
  nav.setAttribute('aria-label', 'Navigation scroll');

  var btnUp = document.createElement('button');
  btnUp.className = 'ambi-scroll-btn';
  btnUp.setAttribute('aria-label', 'Remonter');
  btnUp.innerHTML = `<svg viewBox="0 0 16 16"><polyline points="3,10 8,5 13,10"/></svg>`;

  var divider = document.createElement('div');
  divider.className = 'ambi-scroll-divider';

  var btnDown = document.createElement('button');
  btnDown.className = 'ambi-scroll-btn';
  btnDown.setAttribute('aria-label', 'Descendre');
  btnDown.innerHTML = `<svg viewBox="0 0 16 16"><polyline points="3,6 8,11 13,6"/></svg>`;

  nav.appendChild(btnUp);
  nav.appendChild(divider);
  nav.appendChild(btnDown);
  document.body.appendChild(nav);

  // Logique scroll smooth par page
  function scrollPage(dir) {
    var amount = Math.max(window.innerHeight * 0.82, 300);
    window.scrollBy({ top: dir * amount, behavior: 'smooth' });
  }

  btnUp.addEventListener('click', function(){ scrollPage(-1); });
  btnDown.addEventListener('click', function(){ scrollPage(1); });

  // Visibilité conditionnelle
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function(){
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      var scrollMax = document.documentElement.scrollHeight - window.innerHeight;
      var canUp   = scrollTop > 60;
      var canDown = scrollTop < scrollMax - 60;

      btnUp.classList.toggle('visible', canUp);
      btnDown.classList.toggle('visible', canDown);
      divider.classList.toggle('visible', canUp || canDown);
      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  // Vérifier au chargement (contenu déjà scrollé, ou page courte)
  setTimeout(onScroll, 400);
})();

/* ════════════════════════════════════════════════════════════════
   AMBI241 — MODULE SOCIAL : JavaScript Amis, Communautés, Projets
   ════════════════════════════════════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════════
   AMBI241 — MODULE SOCIAL : Amis, Communautés, Projets
   Intégration Firebase Firestore (collections: friendships, communities, projects)
   ════════════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ══ ÉTAT LOCAL (mis à jour dynamiquement depuis Firebase après login) ══ */
var _currentUser = {
  uid: '',
  name: window.currentUserPseudo || window.currentUserEmail || '',
  avatar: '👤',
  bio: '',
  establishement: 'Libreville'
};

var _friends = [
  // Liste chargée depuis Firebase (amis réels uniquement)
];

var _requestsIn = [
  // Demandes reçues — chargées depuis Firebase pour cet utilisateur uniquement
];

var _requestsOut = [
  // Demandes envoyées — chargées depuis Firebase pour cet utilisateur uniquement
];

var _blocked = [
  // Utilisateurs bloqués réels depuis Firebase
];

var _communities = [
  // Communautés réelles chargées depuis Firebase
];

var _projects = [
  // Projets réels chargés depuis Firebase
];

var _suggestions = [
  // Suggestions réelles chargées depuis Firebase (_socLoadMembresFirebase)
];

var _confirmCallback = null;
var _selectedCommCat = 'musique';
var _selectedPrivacy = 'public';
var _selectedProjType = 'diverti';
var _fabOpen = false;
var _activeTab = 'amis';
var _toastTimer = null;

/* ════════════ INIT ════════════ */
document.addEventListener('DOMContentLoaded', function(){
  renderFriends();
  renderRequests();
  renderSuggestions();
  renderCommunities('discover');
  renderProjects('all');
  renderBlocked();
  updateBadges();
  // Peupler les selects projets avec les communautés
  populateProjCommSelect();
  
  // ✅ Charger les demandes de l'utilisateur courant depuis Firebase
  if(window.currentUserUID){
    _socLoadFriendships(window.currentUserUID, []);
  }
});

/* ════════════ CHARGEMENT MEMBRES FIREBASE ════════════
   Au login, on charge tous les membres inscrits dans Firestore
   et on les intègre automatiquement dans la communauté sociale.
   Leurs données réelles (pseudo, email, role, photo...) sont utilisées.
   ════════════════════════════════════════════════════════ */
function _socLoadMembresFirebase(){
  if(!window.db || !window.fbCollection || !window.fbGetDocs) return;
  var meUID = window.currentUserUID;
  window.fbGetDocs(window.fbCollection(window.db,'users')).then(function(snap){
    var allUsers = [];
    snap.forEach(function(d){
      var data = d.data();
      if(d.id === meUID) return; // on exclut le membre connecté (par UID)
      /* ✅ FIX: exclure aussi par email pour éviter doublons si UID pas encore sync */
      var meEmail = (window.currentUserEmail||'').toLowerCase().trim();
      if(meEmail && data.email && data.email.toLowerCase().trim() === meEmail) return;
      var roleLabel = { admin:'Admin', super_admin:'Super Admin', establishment:'Établissement', chauffeur:'Chauffeur', membre:'Membre Premium', user:'Membre' }[data.role||'user'] || 'Membre';
      var pseudo = data.pseudo || data.displayName || (data.email ? data.email.split('@')[0] : 'Membre');
      var initials = pseudo.slice(0,2).toUpperCase();
      var avatar = data.avatarEmoji || _socInitialsAvatar(initials);
      allUsers.push({
        uid:    d.id,
        name:   pseudo,
        email:  data.email || '',
        avatar: avatar,
        initials: initials,
        status: 'online',
        etab:   data.establishment || data.ville || 'Libreville',
        role:   data.role || 'user',
        roleLabel: roleLabel,
        mutualFriends: 0,
        tag:    data.role === 'chauffeur' ? '🚕 Chauffeur' : data.role === 'establishment' ? '🏛️ Établissement' : null,
        createdAt: data.createdAt || null
      });
    });

    // ── Séparer amis (si déjà liés) vs suggestions ──
    // Pour l'instant tous sont en suggestions + membres de la communauté
    // Les vraies relations "amis" viendront de la collection 'friendships'
    var newSuggestions = allUsers.slice(0, 8).map(function(u){
      return { uid:u.uid, name:u.name, avatar:u.avatar, mutual:u.mutualFriends||0, etab:u.etab, role:u.roleLabel };
    });

    if(newSuggestions.length){
      _suggestions = newSuggestions;
      renderSuggestions();
    }

    // ── Charger les vraies relations d'amis depuis Firestore ──
    if(meUID){
      _socLoadFriendships(meUID, allUsers);
    }

    // ── Mettre à jour le membre courant dans _currentUser ──
    _currentUser.uid  = meUID || 'me';
    _currentUser.name = window.currentUserPseudo || window.currentUserEmail || 'Moi';

    console.log('[AMBI241 Social] ✅ '+allUsers.length+' membres chargés depuis Firebase');
  }).catch(function(e){
    console.warn('[AMBI241 Social] Erreur chargement membres:', e);
  });
}

/* Charger les vraies relations amis depuis la collection 'friendships' — TEMPS RÉEL */
var _socFriendUnsubs = []; // unsub functions pour les listeners friendship
function _socStopFriendListeners(){
  _socFriendUnsubs.forEach(function(u){ try{ u(); }catch(e){} });
  _socFriendUnsubs = [];
}

function _socLoadFriendships(meUID, allUsers){
  if(!window.db || !window.fbCollection || !window.fbOnSnapshot) return;

  // Stopper les anciens listeners avant d'en créer de nouveaux
  _socStopFriendListeners();

  /* ── 0. Charger les utilisateurs bloqués depuis Firebase ── */
  // ✅ FIX : blocages persistés dans Firebase, rechargés à chaque connexion
  window.fbGetDocs && window.fbGetDocs(window.fbCollection(window.db,'users',meUID,'blocked')).then(function(snap){
    _blocked = [];
    snap.forEach(function(d){
      var data = d.data();
      _blocked.push({ uid:d.id, name:data.name||'Utilisateur', avatar:data.avatar||'👤', blockedAt: data.blockedAt ? new Date(data.blockedAt).toLocaleDateString('fr') : '—' });
    });
    renderBlocked();
  }).catch(function(){});

  /* ── 1. Listener temps réel : sous-collection friends ── */
  var u1 = window.fbOnSnapshot(
    window.fbCollection(window.db,'users',meUID,'friends'),
    function(snap){
      snap.forEach(function(d){
        // Ignorer si déjà dans la liste
        if(_friends.find(function(f){ return f.uid===d.id; })) return;
        var data = d.data();
        var pseudo = data.pseudo || data.name || data.email || d.id;
        _friends.push({
          uid: d.id,
          name: pseudo,
          avatar: data.avatarEmoji || data.avatar || '👤',
          etab: data.etab || data.ville || 'Libreville',
          status: 'online',
          mutualFriends: 0,
          tag: data.tag || null
        });
      });
      // Gérer les suppressions (docChange type='removed')
      snap.docChanges && snap.docChanges().forEach(function(change){
        if(change.type === 'removed'){
          _friends = _friends.filter(function(f){ return f.uid !== change.doc.id; });
        }
      });
      renderFriends();
      updateBadges();
    },
    function(e){ console.warn('[AMBI241 Social] friends listener error:', e); }
  );
  _socFriendUnsubs.push(u1);

  /* ── 2. Listener temps réel : demandes REÇUES ── */
  // ✅ FIX : reconstruire depuis Firebase au 1er chargement pour éviter réapparition
  var _reqInFirstLoad = true;
  var u2 = window.fbOnSnapshot(
    window.fbCollection(window.db,'users',meUID,'friend_requests_in'),
    function(snap){
      if(_reqInFirstLoad){
        _reqInFirstLoad = false;
        var freshList = [];
        snap.forEach(function(d){
          var data = d.data();
          var alreadyFriend = _friends.find(function(f){ return f.uid===d.id; });
          if(!alreadyFriend){
            freshList.push({
              uid: d.id,
              name: data.pseudo || data.name || data.email || d.id,
              avatar: data.avatarEmoji || '👤',
              etab: data.etab || 'Libreville',
              msg: data.msg || "Salut, ajoutons-nous !",
              mutualFriends: 0
            });
          }
        });
        _requestsIn = freshList;
      } else {
        snap.docChanges && snap.docChanges().forEach(function(change){
          var d = change.doc;
          var data = d.data();
          if(change.type === 'added'){
            var alreadyFriend = _friends.find(function(f){ return f.uid===d.id; });
            var alreadyReq    = _requestsIn.find(function(r){ return r.uid===d.id; });
            if(!alreadyFriend && !alreadyReq){
              _requestsIn.push({
                uid: d.id,
                name: data.pseudo || data.name || data.email || d.id,
                avatar: data.avatarEmoji || '👤',
                etab: data.etab || 'Libreville',
                msg: data.msg || "Salut, ajoutons-nous !",
                mutualFriends: 0
              });
              if(typeof socToast === 'function'){
                var senderName = data.pseudo || data.name || "Quelqu'un";
                socToast('👋 '+senderName+" t'a envoyé une demande d'amitié !");
              }
            }
          }
          if(change.type === 'removed'){
            _requestsIn = _requestsIn.filter(function(r){ return r.uid !== d.id; });
          }
        });
      }
      renderRequests();
      updateBadges();
    },
    function(e){ console.warn('[AMBI241 Social] friend_requests_in listener error:', e); }
  );
  _socFriendUnsubs.push(u2);

  /* ── 3. Listener temps réel : demandes ENVOYÉES ── */
  // ✅ FIX : même approche, reconstruire au premier chargement
  var _reqOutFirstLoad = true;
  var u3 = window.fbOnSnapshot(
    window.fbCollection(window.db,'users',meUID,'friend_requests_out'),
    function(snap){
      if(_reqOutFirstLoad){
        _reqOutFirstLoad = false;
        var freshOut = [];
        snap.forEach(function(d){
          var data = d.data();
          var alreadyFriend = _friends.find(function(f){ return f.uid===d.id; });
          if(!alreadyFriend){
            freshOut.push({
              uid: d.id,
              name: data.name || data.pseudo || d.id,
              avatar: data.avatar || '👤',
              sentAt: data.sentAt ? new Date(data.sentAt).toLocaleDateString('fr') : "À l'instant"
            });
          }
        });
        _requestsOut = freshOut;
      } else {
        snap.docChanges && snap.docChanges().forEach(function(change){
          var d = change.doc;
          var data = d.data();
          if(change.type === 'added'){
            var alreadyFriend = _friends.find(function(f){ return f.uid===d.id; });
            var alreadyOut    = _requestsOut.find(function(r){ return r.uid===d.id; });
            if(!alreadyFriend && !alreadyOut){
              _requestsOut.push({
                uid: d.id,
                name: data.name || data.pseudo || d.id,
                avatar: data.avatar || '👤',
                sentAt: data.sentAt ? new Date(data.sentAt).toLocaleDateString('fr') : "À l'instant"
              });
            }
          }
          if(change.type === 'removed'){
            _requestsOut = _requestsOut.filter(function(r){ return r.uid !== d.id; });
          }
        });
      }
      renderRequests();
    },
    function(e){ console.warn('[AMBI241 Social] friend_requests_out listener error:', e); }
  );
  _socFriendUnsubs.push(u3);
}

/* Génère un emoji avatar à partir des initiales */
function _socInitialsAvatar(initials){
  var pool = ['🦁','🔥','🌸','⚡','💫','🎸','🎵','🌺','🦅','🎷','🌹','🦋','⭐','🎯','🌴','🌊'];
  var code = (initials.charCodeAt(0)||65) + (initials.charCodeAt(1)||65);
  return pool[code % pool.length];
}

/* ── Hook : déclencher le chargement Firebase dès la connexion ── */
(function(){
  var _prevUID = null;
  // Watcher sur currentUserUID — détecte connexion ET déconnexion
  setInterval(function(){
    var uid = window.currentUserUID || null;
    if(uid && uid !== _prevUID){
      // Nouvelle connexion ou changement d'utilisateur
      _prevUID = uid;
      // Stopper les listeners de l'éventuel utilisateur précédent
      if(typeof _socStopFriendListeners === 'function') _socStopFriendListeners();
      if(typeof _dmInboxUnsub !== 'undefined' && typeof _dmInboxUnsub === 'function'){ _dmInboxUnsub(); _dmInboxUnsub = null; }
      setTimeout(_socLoadMembresFirebase, 800);
    } else if(!uid && _prevUID){
      // Déconnexion : stopper tous les listeners
      _prevUID = null;
      if(typeof _socStopFriendListeners === 'function') _socStopFriendListeners();
      if(typeof _dmInboxUnsub !== 'undefined' && typeof _dmInboxUnsub === 'function'){ _dmInboxUnsub(); _dmInboxUnsub = null; }
    }
  }, 500);
  // Aussi au cas où l'utilisateur est déjà connecté au chargement
  setTimeout(function(){
    if(window.currentUserUID) _socLoadMembresFirebase();
  }, 2500);
})();

/* ════════════ ONGLETS ════════════ */
window.socSwitchTab = function(tab){
  _activeTab = tab;
  document.querySelectorAll('.soc-tab').forEach(function(el){el.classList.remove('active');});
  document.querySelectorAll('.soc-pane').forEach(function(el){el.classList.remove('active');});
  // Activer le bon onglet
  var tabs = document.querySelectorAll('.soc-tab');
  /* publications est le 1er tab (index 0), puis amis(1), demandes(2)… */
  var tabMap = {'publications':0,'amis':1,'demandes':2,'communautes':3,'projets':4,'bloques':5};
  if(tabs[tabMap[tab]] !== undefined) tabs[tabMap[tab]].classList.add('active');
  var pane = document.getElementById('pane-'+tab);
  if(pane) pane.classList.add('active');
  // Scroll top
  window.scrollTo(0,0);
};

/* ════════════ FRIENDS RENDER ════════════ */
/* Cache les unread counts par UID ami (peuplé par _dmStartInboxListener) */
window._friendUnreadCounts = window._friendUnreadCounts || {};

function renderFriends(){
  var el = document.getElementById('friendsList');
  if(!el) return;
  if(!_friends.length){
    el.innerHTML = '<div class="soc-empty"><div class="soc-empty-icon">👤</div><div class="soc-empty-title">Aucun ami encore</div><div class="soc-empty-sub">Recherche des membres et envoie des demandes d\'amitié !</div></div>';
    return;
  }
  var meUID = window.currentUserUID || '';
  var h = '<div style="padding:0.5rem 0.75rem 0.2rem;display:flex;align-items:center;justify-content:space-between;"><span style="font-size:0.62rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);">'+_friends.length+' ami'+((_friends.length>1)?'s':'')+' 👥</span></div>';
  _friends.forEach(function(f){
    /* ✅ Sécurité: ne jamais afficher soi-même dans sa propre liste */
    if(meUID && f.uid === meUID) return;
    var convId = meUID && f.uid ? (meUID < f.uid ? meUID+'_'+f.uid : f.uid+'_'+meUID) : '';
    var unread = (window._friendUnreadCounts && convId) ? (window._friendUnreadCounts[convId]||0) : 0;
    var dotCls = f.status==='online' ? 'online' : f.status==='away' ? 'away' : 'offline';
    var statusLabel = f.status==='online' ? '<span style="color:var(--green);font-size:0.6rem;font-weight:700;">● En ligne</span>' : f.status==='away' ? '<span style="color:var(--amber);font-size:0.6rem;">● Absent</span>' : '<span style="color:var(--muted);font-size:0.6rem;">○ Hors ligne</span>';
    h += '<div class="friend-card fade-in" onclick="openMemberProfile(\''+f.uid+'\')">';
    /* Avatar avec glow online */
    var glowStyle = f.status==='online' ? 'box-shadow:0 0 0 2px var(--green),0 0 10px rgba(0,255,170,0.3);' : '';
    h += '<div class="soc-avatar" style="'+glowStyle+'">'+f.avatar+'<div class="soc-online-dot '+dotCls+'"></div></div>';
    /* Info */
    h += '<div class="friend-info">';
    h += '<div class="friend-name">'+esc(f.name)+'</div>';
    h += '<div class="friend-meta" style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">'+statusLabel+'<span class="friend-meta-dot"></span><span>'+esc(f.etab||'Libreville')+'</span>';
    if(f.tag) h += '<span class="friend-tag">'+esc(f.tag)+'</span>';
    h += '</div></div>';
    /* Actions */
    h += '<div class="friend-actions">';
    /* Bouton message avec badge non-lu */
    h += '<div class="friend-msg-wrap">';
    h += '<button class="friend-act-btn msg" onclick="event.stopPropagation();openDM(\''+f.uid+'\')" title="Message">💬</button>';
    if(unread > 0) h += '<span class="friend-unread-badge">'+unread+'</span>';
    h += '</div>';
    h += '<button class="friend-act-btn del" onclick="event.stopPropagation();confirmAction(\'Supprimer '+esc(f.name)+' de tes amis ?\',\'🗑️\',\'Supprimer\',function(){removeFriend(\''+f.uid+'\')})" title="Supprimer">🗑️</button>';
    h += '<button class="friend-act-btn blk" onclick="event.stopPropagation();confirmAction(\'Bloquer '+esc(f.name)+' ?\',\'🚫\',\'Bloquer\',function(){blockUser(\''+f.uid+'\')})" title="Bloquer">🚫</button>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

/* ════════════ SUGGESTIONS ════════════ */
function renderSuggestions(){
  var el = document.getElementById('suggestionsRow');
  if(!el) return;
  /* ✅ FIX: Exclure soi-même, amis existants, demandes envoyées, bloqués */
  var meUID = window.currentUserUID || '';
  var friendUIDs  = (_friends||[]).map(function(f){ return f.uid; });
  var outUIDs     = (_requestsOut||[]).map(function(r){ return r.uid; });
  var blockedUIDs = (_blocked||[]).map(function(b){ return b.uid; });
  var visible = _suggestions.filter(function(s){
    if(!s.uid) return false;
    if(meUID && s.uid === meUID) return false;
    if(friendUIDs.indexOf(s.uid)  !== -1) return false;
    if(outUIDs.indexOf(s.uid)     !== -1) return false;
    if(blockedUIDs.indexOf(s.uid) !== -1) return false;
    return true;
  });
  var h = '';
  visible.forEach(function(s){
    h += '<div class="soc-suggest-item">';
    h += '<div class="soc-suggest-avatar">'+s.avatar+'</div>';
    h += '<div class="soc-suggest-name">'+esc(s.name)+'</div>';
    var sub = s.role ? s.role : (s.mutual ? s.mutual+' communs' : 'Membre');
    h += '<div class="soc-suggest-sub">'+sub+'</div>';
    h += '<button class="soc-suggest-add" onclick="quickAddFriend(\''+s.uid+'\',\''+esc(s.name)+'\')">+ Ajouter</button>';
    h += '</div>';
  });
  el.innerHTML = h || '<div style="padding:0.6rem 1rem;font-size:0.75rem;color:var(--muted);">Aucune suggestion disponible</div>';
}

/* ════════════ REQUESTS RENDER ════════════ */
function renderRequests(){
  // ✅ SÉCURITÉ : Vérifier que les demandes appartiennent à l'utilisateur courant
  var meUID = window.currentUserUID;
  
  // Reçues
  var el = document.getElementById('requestsIn');
  if(el){
    if(!_requestsIn.length){
      el.innerHTML = '<div class="soc-empty"><div class="soc-empty-icon">📭</div><div class="soc-empty-title">Aucune demande reçue</div></div>';
    } else {
      var h = '<div style="padding:0.6rem 1rem 0.2rem;"><div style="font-size:0.62rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:0.5rem;">Demandes reçues ('+_requestsIn.length+')</div></div>';
      _requestsIn.forEach(function(r){
        h += '<div class="friend-req-card">';
        h += '<div class="friend-req-top"><div class="soc-avatar">'+r.avatar+'</div>';
        h += '<div class="friend-info"><div class="friend-name">'+esc(r.name)+'</div>';
        h += '<div class="friend-meta">'+esc(r.etab)+'<span class="friend-meta-dot"></span>'+r.mutualFriends+' amis communs</div></div></div>';
        h += '<div class="friend-req-msg">"'+esc(r.msg)+'"</div>';
        h += '<div class="friend-req-actions">';
        h += '<button class="friend-req-accept" onclick="acceptRequest(\''+r.uid+'\')">✅ Accepter</button>';
        h += '<button class="friend-req-decline" onclick="declineRequest(\''+r.uid+'\')">✕ Refuser</button>';
        h += '</div></div>';
      });
      el.innerHTML = h;
    }
  }
  // Envoyées
  var el2 = document.getElementById('requestsOut');
  if(el2){
    if(!_requestsOut.length){
      el2.innerHTML = '<div style="padding:0 1rem;font-size:0.75rem;color:var(--muted);">Aucune demande en attente.</div>';
    } else {
      var h2 = '';
      _requestsOut.forEach(function(r){
        h2 += '<div class="friend-card">';
        h2 += '<div class="soc-avatar" style="background:linear-gradient(135deg,var(--muted),rgba(255,255,255,0.2))">'+r.avatar+'</div>';
        h2 += '<div class="friend-info"><div class="friend-name">'+esc(r.name)+'</div>';
        h2 += '<div class="friend-meta">Demande envoyée · '+esc(r.sentAt)+'</div></div>';
        h2 += '<div class="friend-actions"><button class="friend-act-btn del" onclick="cancelRequest(\''+r.uid+'\')">Annuler</button></div>';
        h2 += '</div>';
      });
      el2.innerHTML = h2;
    }
  }
}

/* ════════════ COMMUNITIES RENDER ════════════ */
window.commSubTab = function(sub, btn){
  document.querySelectorAll('#pane-communautes .soc-cat-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  ['commListDiscover','commListMes','commListEtab','commListEvent'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.style.display = 'none';
  });
  var map = {discover:'commListDiscover', mes:'commListMes', etab:'commListEtab', event:'commListEvent'};
  var target = document.getElementById(map[sub]);
  if(target){
    target.style.display = 'block';
    renderCommunities(sub);
  }
};

function renderCommunities(sub){
  var filtered;
  if(sub==='discover') filtered = _communities;
  else if(sub==='mes') filtered = _communities.filter(function(c){return c.joined;});
  else if(sub==='etab') filtered = _communities.filter(function(c){return !!c.etab;});
  else filtered = _communities;

  var containerId = {discover:'commListDiscover',mes:'commListMes',etab:'commListEtab',event:'commListEvent'}[sub];
  var el = document.getElementById(containerId);
  if(!el) return;

  if(!filtered.length){
    el.innerHTML = '<div class="soc-empty"><div class="soc-empty-icon">🏘️</div><div class="soc-empty-title">Aucune communauté</div><div class="soc-empty-sub">Sois le premier à en créer une !</div></div>';
    return;
  }

  var h = '';
  filtered.forEach(function(c){
    h += '<div class="comm-card" onclick="openCommDetail(\''+c.id+'\')">';
    h += '<div class="comm-cover">'+c.emoji+'<span class="comm-cat-badge">'+esc(c.cat)+'</span></div>';
    h += '<div class="comm-body">';
    h += '<div class="comm-name">'+esc(c.name)+'</div>';
    h += '<div class="comm-desc">'+esc(c.desc)+'</div>';
    h += '</div>';
    h += '<div class="comm-footer">';
    h += '<div class="comm-stats">';
    h += '<div class="comm-stat">👥 <span>'+c.members+'</span></div>';
    h += '<div class="comm-stat">💬 <span>'+c.posts+'</span> posts</div>';
    if(c.privacy!=='public') h += '<div class="comm-stat">'+(c.privacy==='invite'?'🔗 Invitation':'🔒 Privée')+'</div>';
    h += '</div>';
    h += '<button class="comm-join-btn'+(c.joined?' joined':'')+(c.privacy!=='public'&&!c.joined?' disabled':'')+'" onclick="event.stopPropagation();toggleJoinComm(\''+c.id+'\')">'+(c.joined?'✓ Rejointe':(c.privacy==='private'?'🔒 Fermée':'Rejoindre'))+'</button>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

/* ════════════ PROJECTS RENDER ════════════ */
window.projSubTab = function(sub, btn){
  document.querySelectorAll('#pane-projets .soc-cat-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  renderProjects(sub);
};

function renderProjects(filter){
  var el = document.getElementById('projList');
  if(!el) return;
  var filtered = filter==='all' ? _projects : _projects.filter(function(p){return p.type===filter;});
  if(!filtered.length){
    el.innerHTML = '<div class="soc-empty"><div class="soc-empty-icon">🎯</div><div class="soc-empty-title">Aucun projet</div><div class="soc-empty-sub">Lance ton premier projet collaboratif !</div></div>';
    return;
  }
  var h = '';
  filtered.forEach(function(p){
    h += '<div class="proj-card fade-in">';
    h += '<div class="proj-header">';
    h += '<div class="proj-icon">'+p.emoji+'</div>';
    h += '<div class="proj-info"><div class="proj-name">'+esc(p.name)+'</div>';
    h += '<div class="proj-type-badge">'+esc(p.type)+'</div></div>';
    h += '<div style="flex-shrink:0;text-align:right;"><div style="font-size:0.65rem;color:var(--'+(p.status==='En cours'?'green':'amber')+');">'+esc(p.status)+'</div>';
    if(p.deadline) h += '<div style="font-size:0.6rem;color:var(--muted);">⏳ '+esc(p.deadline)+'</div>';
    h += '</div></div>';
    h += '<div class="proj-desc">'+esc(p.desc)+'</div>';
    h += '<div class="proj-meta-row">';
    if(p.comm) h += '<div class="proj-meta-chip">🏘️ '+esc(p.comm)+'</div>';
    if(p.event) h += '<div class="proj-meta-chip">🎉 '+esc(p.event.substring(0,20))+'…</div>';
    h += '</div>';
    h += '<div class="proj-progress"><div class="proj-progress-bar" style="width:'+p.progress+'%"></div></div>';
    h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.4rem;">';
    h += '<div class="proj-member-row">';
    p.members.forEach(function(av){ h += '<div class="proj-member-av">'+av+'</div>'; });
    if(p.membersCount>p.members.length) h += '<div class="proj-more-members">+'+( p.membersCount-p.members.length)+' membres</div>';
    h += '</div>';
    h += '<div style="font-size:0.68rem;color:var(--cyan);font-weight:700;">'+p.progress+'% complété</div>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

/* ════════════ BLOCKED RENDER ════════════ */
function renderBlocked(){
  var el = document.getElementById('blockedList');
  if(!el) return;
  if(!_blocked.length){
    el.innerHTML = '<div class="soc-empty"><div class="soc-empty-icon">✅</div><div class="soc-empty-title">Aucun utilisateur bloqué</div></div>';
    return;
  }
  var h = '';
  _blocked.forEach(function(b){
    h += '<div class="friend-card">';
    h += '<div class="soc-avatar" style="background:rgba(255,68,102,0.2);color:var(--red);">'+b.avatar+'</div>';
    h += '<div class="friend-info"><div class="friend-name" style="color:var(--muted);">'+esc(b.name)+'</div>';
    h += '<div class="friend-meta">Bloqué le '+esc(b.blockedAt)+'</div></div>';
    h += '<div class="friend-actions">';
    h += '<button class="friend-act-btn ok" onclick="unblockUser(\''+b.uid+'\')">🔓 Débloquer</button>';
    h += '</div></div>';
  });
  el.innerHTML = h;
}

/* ════════════ ACTIONS AMIS ════════════ */
window.removeFriend = function(uid){
  _friends = _friends.filter(function(f){return f.uid!==uid;});
  renderFriends();
  updateBadges();
  socToast('👋 Ami supprimé');
  // ✅ Firebase : supprimer la relation des deux côtés
  var meUID = window.currentUserUID;
  if(meUID && window.db && window.fbDoc && window.fbDeleteDoc){
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'friends',uid)).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'friends',meUID)).catch(function(){});
  }
};

window.blockUser = function(uid){
  var f = _friends.find(function(x){return x.uid===uid;});
  if(f){ _friends = _friends.filter(function(x){return x.uid!==uid;}); }
  var r = _requestsIn.find(function(x){return x.uid===uid;});
  if(r){ _requestsIn = _requestsIn.filter(function(x){return x.uid!==uid;}); if(typeof updateBadges==='function') updateBadges(); }
  var blockedEntry = { uid:uid, name:(f||r||{name:'Utilisateur'}).name, avatar:(f||r||{avatar:'👤'}).avatar, blockedAt:new Date().toLocaleDateString('fr-FR') };
  _blocked.push(blockedEntry);
  renderFriends();renderRequests();renderBlocked();
  updateBadges();
  socToast('🚫 Utilisateur bloqué');
  // ✅ Firebase : écrire le blocage + supprimer l'amitié et les demandes
  var meUID = window.currentUserUID;
  if(meUID && window.db && window.fbSetDoc && window.fbDoc && window.fbDeleteDoc){
    window.fbSetDoc(window.fbDoc(window.db,'users',meUID,'blocked',uid),
      { uid:uid, name:blockedEntry.name, blockedAt:new Date().toISOString() }).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'friends',uid)).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'friends',meUID)).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'friend_requests_in',uid)).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'friend_requests_out',meUID)).catch(function(){});
  }
};

window.unblockUser = function(uid){
  _blocked = _blocked.filter(function(b){return b.uid!==uid;});
  renderBlocked();
  socToast('🔓 Utilisateur débloqué');
  // ✅ Firebase : supprimer le blocage
  var meUID = window.currentUserUID;
  if(meUID && window.db && window.fbDoc && window.fbDeleteDoc){
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'blocked',uid)).catch(function(){});
  }
};

window.acceptRequest = function(uid){
  var req = _requestsIn.find(function(r){return r.uid===uid;});
  if(!req) return;
  _requestsIn = _requestsIn.filter(function(r){return r.uid!==uid;});
  _friends.push({ uid:req.uid, name:req.name, avatar:req.avatar, status:'online', etab:req.etab||'Membre', mutualFriends:req.mutualFriends||0, tag:null });
  renderRequests();renderFriends();
  updateBadges();
  socToast('✅ '+req.name+' est maintenant ton ami·e !');
  // ✅ Firebase : écrire l'amitié et supprimer les demandes (bidirectionnel)
  var meUID = window.currentUserUID;
  if(meUID && window.db && window.fbSetDoc && window.fbDoc && window.fbDeleteDoc){
    var ts = new Date().toISOString();
    // Créer la relation d'amitié des deux côtés
    window.fbSetDoc(window.fbDoc(window.db,'users',meUID,'friends',uid),
      { uid:uid, name:req.name, avatar:req.avatar, addedAt:ts }, {merge:true}).catch(function(){});
    window.fbSetDoc(window.fbDoc(window.db,'users',uid,'friends',meUID),
      { uid:meUID, name:window.currentUserPseudo||'', avatar:'👤', addedAt:ts }, {merge:true}).catch(function(){});
    // Supprimer les demandes des deux côtés
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'friend_requests_in',uid)).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'friend_requests_out',meUID)).catch(function(){});
    // Notification à l'autre utilisateur
    if(window.fbAddDoc && window.fbCollection){
      window.fbAddDoc(window.fbCollection(window.db,'user_notifications'),{
        toUID: uid, fromUID: meUID,
        type: 'friend_accepted',
        msg: (window.currentUserPseudo||'') + ' a accepté ta demande d\'amitié.',
        read: false, createdAt: ts
      }).catch(function(){});
    }
  }
};

window.declineRequest = function(uid){
  _requestsIn = _requestsIn.filter(function(r){return r.uid!==uid;});
  renderRequests();updateBadges();
  socToast('✕ Demande refusée');
  // ✅ Firebase : supprimer la demande pour qu'elle ne réapparaisse pas
  var meUID = window.currentUserUID;
  if(meUID && window.db && window.fbDoc && window.fbDeleteDoc){
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'friend_requests_in',uid)).catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'friend_requests_out',meUID)).catch(function(){});
  }
};

window.cancelRequest = function(uid){
  _requestsOut = _requestsOut.filter(function(r){return r.uid!==uid;});
  renderRequests();
  socToast('↩️ Demande annulée');
  // Supprimer de Firebase (sous-collections propres)
  var meUID = window.currentUserUID;
  if(meUID && window.db && window.fbDoc && window.fbDeleteDoc){
    window.fbDeleteDoc(window.fbDoc(window.db,'users',meUID,'friend_requests_out',uid))
      .catch(function(){});
    window.fbDeleteDoc(window.fbDoc(window.db,'users',uid,'friend_requests_in',meUID))
      .catch(function(){});
  }
};

window.quickAddFriend = function(uid, name){
  /* FIX#3 — Ajouter ami requiert connexion */
  if(!_requireAuth('Ajouter un ami')) return;
  var meUID = window.currentUserUID;
  // Vérifier doublon
  if(_requestsOut.find(function(r){return r.uid===uid;})) {
    socToast('⚠️ Demande déjà envoyée à '+name); return;
  }
  _suggestions = _suggestions.filter(function(s){return s.uid!==uid;});
  _requestsOut.push({ uid:uid, name:name, avatar:'👤', sentAt:"À l'instant" });
  renderSuggestions();renderRequests();
  socToast('📨 Demande envoyée à '+name+' !');
  // ── Écriture Firebase (sous-collections propres à chaque utilisateur) ──
  if(meUID && window.db && window.fbDoc && window.fbSetDoc){
    var senderData = {
      pseudo: window.currentUserPseudo || window.currentUserEmail || 'Membre',
      avatarEmoji: '👤',
      msg: 'Salut, ajoutons-nous !',
      sentAt: Date.now()
    };
    // Écrire dans la boîte de réception du destinataire
    window.fbSetDoc(window.fbDoc(window.db,'users',uid,'friend_requests_in',meUID), senderData)
      .catch(function(e){ console.warn('[AMBI241] friend_requests_in write error:', e); });
    // Écrire dans les envois du demandeur (pour reload sessions futures)
    window.fbSetDoc(window.fbDoc(window.db,'users',meUID,'friend_requests_out',uid), {
      name: name, avatar:'👤', sentAt: Date.now()
    }).catch(function(e){ console.warn('[AMBI241] friend_requests_out write error:', e); });
  }
};

/* ════════════ MODALE PROFIL MEMBRE ════════════ */
window.openMemberProfile = function(uid){
  var f = _friends.find(function(x){return x.uid===uid;});
  if(!f) return;
  document.getElementById('mpTitle').textContent = f.name;
  var h = '';
  h += '<div class="member-profile-header">';
  h += '<div class="member-profile-avatar">'+f.avatar+'</div>';
  h += '<div class="member-profile-name">'+esc(f.name)+'</div>';
  h += '<div class="member-profile-bio">Membre actif • '+esc(f.etab)+(f.tag?' • '+esc(f.tag):'')+'</div>';
  h += '<div class="member-profile-stats">';
  h += '<div class="member-stat"><div class="member-stat-val">'+f.mutualFriends+'</div><div class="member-stat-label">Amis communs</div></div>';
  h += '<div class="member-stat"><div class="member-stat-val">12</div><div class="member-stat-label">Communautés</div></div>';
  h += '<div class="member-stat"><div class="member-stat-val">3</div><div class="member-stat-label">Projets</div></div>';
  h += '</div></div>';
  h += '<div class="member-profile-actions">';
  h += '<button class="soc-btn-primary" style="flex:2;" onclick="openDM(\''+f.uid+'\');closeModal(\'modalMemberProfile\')">💬 Message</button>';
  h += '<button class="soc-btn-secondary" style="flex:1;margin:0;" onclick="confirmAction(\'Supprimer '+esc(f.name)+' de tes amis ?\',\'🗑️\',\'Supprimer\',function(){removeFriend(\''+f.uid+'\');closeModal(\'modalMemberProfile\')})">🗑️</button>';
  h += '<button class="soc-btn-secondary" style="flex:1;margin:0;" onclick="confirmAction(\'Bloquer '+esc(f.name)+' ?\',\'🚫\',\'Bloquer\',function(){blockUser(\''+f.uid+'\');closeModal(\'modalMemberProfile\')})">🚫</button>';
  h += '</div>';
  // Communautés en commun
  var communs = _communities.filter(function(c){return c.joined;}).slice(0,2);
  if(communs.length){
    h += '<div style="padding:0.8rem 1rem;border-top:1px solid rgba(255,255,255,0.06);">';
    h += '<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--muted);margin-bottom:0.5rem;">Communautés en commun</div>';
    communs.forEach(function(c){
      h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem 0;">';
      h += '<span style="font-size:1.1rem;">'+c.emoji+'</span>';
      h += '<div><div style="font-size:0.78rem;font-weight:700;color:var(--text);">'+esc(c.name)+'</div>';
      h += '<div style="font-size:0.62rem;color:var(--muted);">'+c.members+' membres</div></div></div>';
    });
    h += '</div>';
  }
  document.getElementById('mpBody').innerHTML = h;
  openModal('modalMemberProfile');
};

/* ════════════ COMMUNAUTÉS ACTIONS ════════════ */
window.toggleJoinComm = function(id){
  /* FIX#3 — Rejoindre communauté requiert connexion */
  if(!_requireAuth('Rejoindre une communauté')) return;
  var c = _communities.find(function(x){return x.id===id;});
  if(!c || c.privacy==='private') return;
  c.joined = !c.joined;
  c.members += c.joined ? 1 : -1;
  renderCommunities('discover');
  renderCommunities('mes');
  socToast(c.joined ? '🏘️ Tu as rejoint "'+c.name+'"' : '👋 Tu as quitté "'+c.name+'"');
  // Firebase : setDoc/deleteDoc dans collection 'memberships'
};

window.openCommDetail = function(id){
  var c = _communities.find(function(x){return x.id===id;});
  if(!c) return;
  document.getElementById('cdTitle').textContent = c.name;
  // Membres réels chargés depuis Firebase
  var demoAvatars = [];
  var h = '';
  h += '<div class="comm-detail-cover">'+c.emoji+'</div>';
  h += '<div class="comm-detail-info">';
  h += '<div class="comm-detail-name">'+esc(c.name)+'</div>';
  h += '<div class="comm-detail-desc">'+esc(c.desc)+'</div>';
  h += '<div class="comm-detail-tags">';
  c.tags.forEach(function(t){ h += '<span class="comm-tag">'+esc(t)+'</span>'; });
  h += '</div></div>';
  h += '<div class="comm-members-strip">';
  h += '<div class="comm-members-label">Membres ('+c.members+')</div>';
  h += '<div class="comm-members-avatars">';
  // Membres réels de la communauté (chargés depuis Firebase)
  if(demoAvatars.length) {
    demoAvatars.slice(0,6).forEach(function(av){ h += '<div class="comm-member-av">'+av+'</div>'; });
  } else {
    h += '<span style="font-size:0.68rem;color:var(--muted);">Membres chargés depuis Firebase</span>';
  }
  h += '<span class="comm-members-count">+'+Math.max(0,c.members-6)+' autres</span></div></div>';
  // Actions
  h += '<div style="padding:0.8rem 1rem;">';
  if(!c.joined && c.privacy!=='private'){
    h += '<button class="soc-btn-primary" onclick="toggleJoinComm(\''+c.id+'\');closeModal(\'modalCommDetail\')">🏘️ Rejoindre la communauté</button>';
  } else if(c.joined){
    h += '<button class="soc-btn-primary" style="background:rgba(0,255,170,0.12);color:var(--green);box-shadow:none;border:1.5px solid rgba(0,255,170,0.3);" onclick="socToast(\'💬 Fil de la communauté (bientôt disponible)\')">💬 Voir le fil</button>';
    h += '<button class="soc-btn-secondary" onclick="confirmAction(\'Quitter "'+esc(c.name)+'" ?\',\'🚪\',\'Quitter\',function(){toggleJoinComm(\''+c.id+'\');closeModal(\'modalCommDetail\')})">🚪 Quitter</button>';
  } else {
    h += '<button class="soc-btn-secondary" disabled>🔒 Communauté privée</button>';
  }
  // Projets liés
  var liés = _projects.filter(function(p){return p.comm===c.name;});
  if(liés.length){
    h += '<div style="margin-top:1rem;padding-top:0.8rem;border-top:1px solid rgba(255,255,255,0.06);">';
    h += '<div style="font-size:0.65rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:var(--cyan);margin-bottom:0.5rem;">Projets actifs ('+liés.length+')</div>';
    liés.forEach(function(p){
      h += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.35rem;background:rgba(0,229,255,0.04);border-radius:9px;margin-bottom:0.3rem;">';
      h += '<span>'+p.emoji+'</span><div><div style="font-size:0.78rem;font-weight:700;color:var(--text);">'+esc(p.name)+'</div>';
      h += '<div style="font-size:0.62rem;color:var(--muted);">'+p.progress+'% · '+p.membersCount+' membres</div></div></div>';
    });
    h += '</div>';
  }
  h += '</div>';
  document.getElementById('cdBody').innerHTML = h;
  openModal('modalCommDetail');
};

/* ════════════ CRÉER COMMUNAUTÉ ════════════ */
window.selectCommCat = function(btn){
  document.querySelectorAll('#commCatGrid .soc-cat-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  _selectedCommCat = btn.dataset.cat;
};

window.selectPrivacy = function(btn){
  document.querySelectorAll('#modalCreateComm [data-priv]').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  _selectedPrivacy = btn.dataset.priv;
};

window.createCommunity = function(){
  var name = document.getElementById('commName').value.trim();
  var desc = document.getElementById('commDesc').value.trim();
  if(!name){socToast('⚠️ Donne un nom à ta communauté !');return;}
  var newComm = {
    id:'c'+(Date.now()), name:name, emoji:'🏘️', desc:desc||'Ma nouvelle communauté',
    cat:_selectedCommCat, etab:document.getElementById('commEtab').value||null,
    members:1, posts:0, joined:true, privacy:_selectedPrivacy,
    tags:[_selectedCommCat.charAt(0).toUpperCase()+_selectedCommCat.slice(1)]
  };
  _communities.unshift(newComm);
  // Réinitialiser
  document.getElementById('commName').value='';
  document.getElementById('commDesc').value='';
  closeModal('modalCreateComm');
  renderCommunities('discover');
  renderCommunities('mes');
  socToast('🎉 Communauté "'+name+'" créée !');
  // Firebase : addDoc(collection(db,'communities'), {...newComm, createdBy:currentUser.uid, createdAt:serverTimestamp()})
};

/* ════════════ CRÉER PROJET ════════════ */
window.selectProjType = function(btn){
  document.querySelectorAll('#projTypeGrid .soc-cat-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  _selectedProjType = btn.dataset.type;
};

function populateProjCommSelect(){
  var sel = document.getElementById('projComm');
  if(!sel) return;
  sel.innerHTML = '<option value="">— Aucune communauté —</option>';
  _communities.filter(function(c){return c.joined;}).forEach(function(c){
    sel.innerHTML += '<option value="'+c.id+'">'+esc(c.name)+'</option>';
  });
}

window.createProject = function(){
  var name = document.getElementById('projName').value.trim();
  var desc = document.getElementById('projDesc').value.trim();
  if(!name){socToast('⚠️ Donne un titre à ton projet !');return;}
  var commId = document.getElementById('projComm').value;
  var commName = '';
  if(commId){ var c = _communities.find(function(x){return x.id===commId;}); if(c) commName=c.name; }
  var evtSel = document.getElementById('projEvent');
  var evtName = evtSel.value ? evtSel.options[evtSel.selectedIndex].text : null;
  var newProj = {
    id:'p'+(Date.now()), name:name, emoji:'🎯', type:_selectedProjType,
    desc:desc||'Un nouveau projet passionnant.', comm:commName||null,
    event:evtName||null, progress:0,
    members:[_currentUser.avatar], membersCount:1,
    deadline:document.getElementById('projDeadline').value||null, status:'En cours'
  };
  _projects.unshift(newProj);
  document.getElementById('projName').value='';
  document.getElementById('projDesc').value='';
  closeModal('modalCreateProj');
  renderProjects('all');
  socToast('🚀 Projet "'+name+'" lancé !');
  // Firebase : addDoc(collection(db,'projects'), {...newProj, createdBy:currentUser.uid, createdAt:serverTimestamp()})
};

/* ════════════ RECHERCHE ════════════ */
window.socHandleSearch = function(val){
  if(!val) return;
  socToast('🔍 Recherche : '+val);
  // Firebase : query(collection(db,'users'), where('nameLower','>=',val.toLowerCase()))
};

/* ════════════ AJOUTER AMI — liste membres ════════════
   Remplace l'ancien champ de recherche par une liste checkable
   de tous les abonnés, filtrée par type (membre / chauffeur / établissement).
   ═══════════════════════════════════════════════════════════ */
var _afAllMembers  = [];   // tous les membres chargés
var _afSelected    = new Set();
var _afFilterType  = 'tous';
var _afSearchVal   = '';

/* ── Types : label + badge class ── */
var _afTypeMap = {
  super_admin:   { label:'⭐ Super Admin',   cls:'af-badge-super_admin' },
  admin:         { label:'⭐ Admin',          cls:'af-badge-admin' },
  establishment: { label:'🏛️ Établissement',  cls:'af-badge-establishment' },
  chauffeur:     { label:'🚕 Chauffeur',      cls:'af-badge-chauffeur' },
  gerant:        { label:'🏛️ Gérant',         cls:'af-badge-establishment' },
  membre:        { label:'👤 Membre',         cls:'af-badge-membre' },
  user:          { label:'👤 Membre',         cls:'af-badge-user' }
};

/* ── Ouvre et charge la liste ── */
window.afLoadMembers = function(){
  if(!_requireAuth('Ajouter un ami')) return;
  _afSelected.clear();
  _afFilterType = 'tous';
  _afSearchVal  = '';
  var si = document.getElementById('afSearchInput'); if(si) si.value='';
  document.querySelectorAll('[data-af-filter]').forEach(function(b){
    b.classList.toggle('af-active', b.dataset.afFilter==='tous');
  });
  afUpdateSendBtn();

  var el = document.getElementById('afMemberList');
  if(!el) return;

  /* 1) Utiliser les suggestions déjà chargées si Firebase absent */
  if(!window.db || !window.fbCollection || !window.fbGetDocs){
    _afAllMembers = _suggestions.map(function(u){
      return {uid:u.uid, name:u.name, avatar:u.avatar, etab:u.etab||'Libreville', role:u.role||'user'};
    });
    afRenderList(); return;
  }

  el.innerHTML='<div class="af-empty"><div class="af-empty-icon">⏳</div>Chargement…</div>';
  var meUID = window.currentUserUID;

  window.fbGetDocs(window.fbCollection(window.db,'users')).then(function(snap){
    /* Recalculer ici pour être sûr que _requestsOut et _friends sont synchronisés */
    var alreadyOut = _requestsOut.map(function(r){return r.uid;});
    var alreadyFriends = _friends.map(function(f){return f.uid;});
    var list = [];
    snap.forEach(function(d){
      if(d.id === meUID) return;
      var data = d.data();
      var name = data.pseudo || data.displayName || (data.email ? data.email.split('@')[0] : 'Membre');
      var role = data.role || data.memberType || 'user';
      var isAlready = alreadyOut.indexOf(d.id)!==-1 || alreadyFriends.indexOf(d.id)!==-1;
      list.push({
        uid:      d.id,
        name:     name,
        avatar:   data.avatarEmoji || data.avatarInitials || '👤',
        etab:     data.establishment || data.ville || 'Libreville',
        role:     role,
        already:  isAlready
      });
    });
    // Trier : non-amis en premier, puis par rôle
    list.sort(function(a,b){
      if(a.already !== b.already) return a.already ? 1 : -1;
      var order = {establishment:0, chauffeur:1, gerant:0, admin:2, super_admin:2, membre:3, user:3};
      return (order[a.role]||3) - (order[b.role]||3);
    });
    _afAllMembers = list;
    afRenderList();
  }).catch(function(){
    /* Fallback sur suggestions */
    _afAllMembers = _suggestions.map(function(u){
      return {uid:u.uid, name:u.name, avatar:u.avatar, etab:u.etab||'Libreville', role:u.role||'user', already:false};
    });
    afRenderList();
  });
};
window.afLoadMembers = afLoadMembers;

/* ── Rendu de la liste filtrée ── */
function afRenderList(){
  var el = document.getElementById('afMemberList');
  if(!el) return;
  var filtered = _afAllMembers.filter(function(m){
    if(m.already) return false; /* Exclure complètement les membres déjà démarchés ou amis */
    var matchType = _afFilterType === 'tous' || m.role === _afFilterType
      || (_afFilterType === 'membre' && (m.role==='user'||m.role==='membre'));
    var matchSearch = !_afSearchVal || m.name.toLowerCase().includes(_afSearchVal.toLowerCase());
    return matchType && matchSearch;
  });
  if(!filtered.length){
    el.innerHTML='<div class="af-empty"><div class="af-empty-icon">🔍</div>Aucun membre trouvé</div>';
    return;
  }
  var h = '';
  filtered.forEach(function(m){
    var sel = _afSelected.has(m.uid);
    var tm  = _afTypeMap[m.role] || _afTypeMap.user;
    var rowCls = 'af-member-row' + (sel?' af-selected':'');
    h += '<div class="'+rowCls+'" onclick="afToggle(\''+m.uid+'\')" data-af-uid="'+m.uid+'">';
    h += '<div class="af-check">'+(sel?'✓':'')+'</div>';
    h += '<div class="af-avatar">'+m.avatar+'</div>';
    h += '<div style="flex:1;min-width:0;">';
    h += '<div class="af-name">'+esc(m.name)+'</div>';
    h += '<div class="af-meta">';
    h += '<span class="af-badge '+tm.cls+'">'+tm.label+'</span>';
    if(m.etab && m.etab !== 'Libreville') h += '<span class="af-etab">· '+esc(m.etab)+'</span>';
    h += '</div></div>';
    h += '<div style="width:26px;height:26px;border-radius:50%;background:'+(sel?'rgba(0,255,170,0.12)':'rgba(255,255,255,0.04)')+';border:1px solid '+(sel?'rgba(0,255,170,0.35)':'rgba(255,255,255,0.1)')+';display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;transition:all 0.15s;">'+(sel?'✓':'＋')+'</div>';
    h += '</div>';
  });
  el.innerHTML = h;
  afUpdateSendBtn();
}

/* ── Toggle sélection ── */
window.afToggle = function(uid){
  if(_afSelected.has(uid)) _afSelected.delete(uid); else _afSelected.add(uid);
  // Mise à jour visuelle ciblée
  var row = document.querySelector('[data-af-uid="'+uid+'"]');
  if(row){
    var sel = _afSelected.has(uid);
    row.classList.toggle('af-selected', sel);
    var chk = row.querySelector('.af-check');
    if(chk) chk.textContent = sel ? '✓' : '';
    var plus = row.querySelector('div[style*="border-radius:50%"]');
    if(plus){
      plus.style.background = sel ? 'rgba(0,255,170,0.12)' : 'rgba(255,255,255,0.04)';
      plus.style.borderColor = sel ? 'rgba(0,255,170,0.35)' : 'rgba(255,255,255,0.1)';
      plus.textContent = sel ? '✓' : '＋';
    }
  }
  afUpdateSendBtn();
};

/* ── Sélectionner tout (visibles, non déjà envoyés) ── */
window.afSelectAll = function(){
  var filtered = _afAllMembers.filter(function(m){
    var matchType = _afFilterType === 'tous' || m.role === _afFilterType
      || (_afFilterType === 'membre' && (m.role==='user'||m.role==='membre'));
    var matchSearch = !_afSearchVal || m.name.toLowerCase().includes(_afSearchVal.toLowerCase());
    return matchType && matchSearch && !m.already;
  });
  var allSel = filtered.every(function(m){return _afSelected.has(m.uid);});
  filtered.forEach(function(m){ if(allSel) _afSelected.delete(m.uid); else _afSelected.add(m.uid); });
  afRenderList();
};

/* ── Filtre texte ── */
window.afFilterList = function(val){
  _afSearchVal = val.trim();
  afRenderList();
};

/* ── Filtre par type ── */
window.afSetFilter = function(type, btn){
  _afFilterType = type;
  document.querySelectorAll('[data-af-filter]').forEach(function(b){ b.classList.remove('af-active'); });
  if(btn) btn.classList.add('af-active');
  afRenderList();
};

/* ── Mise à jour bouton envoi ── */
function afUpdateSendBtn(){
  var n = _afSelected.size;
  var lbl = document.getElementById('afSelCount');
  if(lbl) lbl.textContent = n + ' sélectionné(s)';
  var btn = document.getElementById('afSendBtn');
  if(btn){
    btn.textContent = '📨 Envoyer les demandes (' + n + ')';
    btn.disabled = n === 0;
    btn.style.opacity = n === 0 ? '0.45' : '1';
  }
}

/* ── Envoi en lot ── */
window.afSendRequests = function(){
  if(!_requireAuth('Ajouter un ami')) return;
  if(!_afSelected.size){ socToast('⚠️ Sélectionne au moins un membre'); return; }
  var meUID   = window.currentUserUID;
  var senderData = {
    pseudo:      window.currentUserPseudo || window.currentUserEmail || 'Membre',
    avatarEmoji: '👤',
    msg:         'Salut, on se retrouve sur AMBI241 !',
    sentAt:      Date.now()
  };
  var sent = 0;
  _afSelected.forEach(function(uid){
    var m = _afAllMembers.find(function(x){return x.uid===uid;});
    if(!m) return;
    // éviter doublon local
    if(!_requestsOut.find(function(r){return r.uid===uid;})){
      _requestsOut.push({ uid:uid, name:m.name, avatar:m.avatar, sentAt:"À l'instant" });
      sent++;
    }
    // Écriture Firebase
    if(meUID && window.db && window.fbDoc && window.fbSetDoc){
      window.fbSetDoc(window.fbDoc(window.db,'users',uid,'friend_requests_in',meUID), senderData)
        .catch(function(e){ console.warn('[AMBI241] friend_requests_in write error:', e); });
      window.fbSetDoc(window.fbDoc(window.db,'users',meUID,'friend_requests_out',uid), {
        name: m.name, avatar: m.avatar, sentAt: Date.now()
      }).catch(function(e){ console.warn('[AMBI241] friend_requests_out write error:', e); });
    }
  });
  // Retirer des suggestions
  _afSelected.forEach(function(uid){
    _suggestions = _suggestions.filter(function(s){return s.uid!==uid;});
  });
  _afSelected.clear();
  closeModal('modalAddFriend');
  renderSuggestions();
  renderRequests();
  socToast('📨 ' + sent + ' demande(s) d\'amitié envoyée(s) !');
};

/* ── Compat : garder searchUsers / sendFriendRequest pour d'autres appels éventuels ── */
window.searchUsers = function(){ /* remplacé par afLoadMembers */ };
window.sendFriendRequest = function(){ afSendRequests(); };

/* ════════════ MODALE + UTILITAIRES ════════════ */
/* FIX#3 — Redirection inscription pour visiteurs non connectés */
function _requireAuth(actionLabel, cb) {
  if(window.currentUserUID || window.currentUserEmail) {
    if(typeof cb === 'function') cb();
    return true;
  }
  closeSocFab();
  /* Toast informatif */
  var msg = '👤 ' + (actionLabel || 'Cette action') + ' nécessite un compte gratuit';
  if(typeof window.showToast === 'function') window.showToast(msg);
  else if(typeof socToast === 'function') socToast(msg);
  /* Ouvrir le modal d'inscription après un léger délai */
  setTimeout(function(){
    var overlay = document.getElementById('userOverlay');
    if(overlay) overlay.classList.add('show');
    if(typeof switchUserTab === 'function') switchUserTab('inscription');
  }, 350);
  return false;
}
window._requireAuth = _requireAuth;

window.openModal = function(id){
  /* Modales sociales nécessitant une connexion */
  var authRequired = ['modalAddFriend','modalCreateComm','modalCreateProj','modalMemberProfile','modalDMChat'];
  var labels = {
    modalAddFriend:   'Ajouter un ami',
    modalCreateComm:  'Créer une communauté',
    modalCreateProj:  'Lancer un projet',
    modalMemberProfile: 'Voir ce profil',
    modalDMChat: 'Envoyer un message'
  };
  if(authRequired.indexOf(id) !== -1) {
    if(!_requireAuth(labels[id] || 'Cette fonctionnalité')) return;
  }
  var el = document.getElementById(id);
  if(el) el.classList.add('open');
  closeSocFab();
};
window.closeModal = function(id){
  var el = document.getElementById(id);
  if(el) el.classList.remove('open');
};

/* ════════════════════════════════════════════════════════════
   DM CHAT — Firebase Firestore Temps Réel
   Collection : dm_conversations/{convId}/messages
   convId = ordre alphabétique uid1_uid2
   Listener onSnapshot actif pendant que le modal est ouvert.
════════════════════════════════════════════════════════════ */
var _dmCurrentUid    = null;
var _dmCurrentConvId = null;
var _dmUnsub         = null;

function _dmConvId(a, b){ return a < b ? a+'_'+b : b+'_'+a; }

/* ══════════════════════════════════════════════════════════════
   PLAYER HEIGHT SYNC — système global unique
   Met à jour --player-h sur :root dès que #weekSongPlayer
   apparaît, disparaît ou change de taille.
   Tous les éléments fixed bottom utilisent cette variable.
══════════════════════════════════════════════════════════════ */
(function(){
  function _syncPlayerH(){
    var player = document.getElementById('weekSongPlayer');
    var h = (player && (player.classList.contains('show') || player.style.display === 'flex'))
              ? player.offsetHeight
              : 0;
    document.documentElement.style.setProperty('--player-h', h + 'px');
  }

  function _attachPlayerObserver(){
    var player = document.getElementById('weekSongPlayer');
    if(!player) return;
    if(player._ambiObserved) return;
    player._ambiObserved = true;

    // Observer class/style changes (show / hide / minimize)
    if(typeof MutationObserver !== 'undefined'){
      var mo = new MutationObserver(_syncPlayerH);
      mo.observe(player, { attributes: true, attributeFilter: ['class','style'] });
    }

    // Observer resize (lecture complète vs miniature)
    if(typeof ResizeObserver !== 'undefined'){
      var ro = new ResizeObserver(_syncPlayerH);
      ro.observe(player);
    }

    _syncPlayerH(); // état initial
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', _attachPlayerObserver);
  } else {
    setTimeout(_attachPlayerObserver, 300);
  }

  // Exposer pour que weekSongOpen/Close puissent forcer la sync immédiatement
  window._syncPlayerH = _syncPlayerH;
})();

window.openDM = function(uid){
  if(!window.currentUserUID){
    if(typeof socToast==='function') socToast('🔒 Connectez-vous pour envoyer un message');
    return;
  }
  var friend = (_friends||[]).find(function(x){ return x.uid===uid; });
  if(!friend){ if(typeof socToast==='function') socToast('⚠️ Ami introuvable'); return; }

  if(typeof _dmUnsub==='function'){ _dmUnsub(); _dmUnsub=null; }

  _dmCurrentUid    = uid;
  _dmCurrentConvId = _dmConvId(window.currentUserUID, uid);

  /* ── Réinitialiser immédiatement le badge non-lu de cet ami ── */
  if(window._friendUnreadCounts && _dmCurrentConvId){
    window._friendUnreadCounts[_dmCurrentConvId] = 0;
  }
  /* Re-render la liste d'amis pour effacer le badge rouge sur le bouton 💬 */
  if(typeof renderFriends === 'function'){ try{ renderFriends(); }catch(e){} }

  var avEl=document.getElementById('dmPeerAv');
  var nameEl=document.getElementById('dmPeerName');
  var peerName = friend.name||friend.pseudo||'Inconnu';
  if(avEl)   avEl.textContent   = friend.avatar || (peerName[0]||'?').toUpperCase();
  if(nameEl) nameEl.textContent = peerName;

  var inp=document.getElementById('dmInput');
  if(inp) inp.value='';
  var box=document.getElementById('dmMessages');
  if(box) box.innerHTML='<div class="dm-empty"><div class="dm-empty-icon">⏳</div><div class="dm-empty-txt">Chargement…</div></div>';

  if(window._syncPlayerH) window._syncPlayerH();
  openModal('modalDMChat');
  _dmMarkRead(_dmCurrentConvId, window.currentUserUID);
  /* ── Effacer le badge DM immédiatement à l'ouverture ── */
  var _dmBadgeEl = document.getElementById('dmInboxBadge');
  if(_dmBadgeEl){ _dmBadgeEl.textContent='0'; _dmBadgeEl.style.display='none'; }
  /* Marquer comme lu dans Firestore user_notifications (type dm/message) */
  (function(){
    var meUID = window.currentUserUID;
    if(!meUID||!window.db||!window.fbCollection||!window.fbQuery||!window.fbWhere||!window.fbGetDocs||!window.fbUpdateDoc||!window.fbDoc) return;
    try{
      var q = window.fbQuery(
        window.fbCollection(window.db,'user_notifications'),
        window.fbWhere('toUID','==',meUID),
        window.fbWhere('unread','==',true)
      );
      window.fbGetDocs(q).then(function(snap){
        snap.forEach(function(d){
          var k=((d.data().key||d.data().type||'')+'').toLowerCase();
          if(k.indexOf('message')!==-1||k.indexOf('dm')!==-1){
            window.fbUpdateDoc(window.fbDoc(window.db,'user_notifications',d.id),{unread:false}).catch(function(){});
          }
        });
        /* Resync badge nav */
        if(typeof window._ambiNavBadge !== 'undefined' && typeof window._ambiNavBadge.sync === 'function'){
          setTimeout(window._ambiNavBadge.sync, 300);
        }
      }).catch(function(){});
    }catch(e){}
  })();

  if(!window.db||!window.fbCollection||!window.fbOnSnapshot||!window.fbQuery||!window.fbOrderBy||!window.fbLimit){
    if(box) box.innerHTML='<div class="dm-empty"><div class="dm-empty-icon">⚠️</div><div class="dm-empty-txt">Firebase non disponible</div></div>';
    setTimeout(function(){ if(inp) inp.focus(); },380); return;
  }

  var msgsQ=window.fbQuery(
    window.fbCollection(window.db,'dm_conversations',_dmCurrentConvId,'messages'),
    window.fbOrderBy('sentAt','asc'), window.fbLimit(100)
  );
  _dmUnsub=window.fbOnSnapshot(msgsQ, function(snap){
    var msgs=[]; snap.forEach(function(d){ msgs.push(Object.assign({_id:d.id},d.data())); });
    _dmRenderMessages(msgs);
  }, function(err){ console.warn('[DM] onSnapshot error',err); });

  setTimeout(function(){ if(inp) inp.focus(); },380);
};
window.openDM=window.openDM;

function _dmRenderMessages(msgs){
  var box=document.getElementById('dmMessages');
  if(!box) return;
  var meUid=window.currentUserUID||'';
  if(!msgs.length){
    box.innerHTML='<div class="dm-empty"><div class="dm-empty-icon">💬</div><div class="dm-empty-txt">Commence la conversation !</div></div>';
    return;
  }
  var html='';
  msgs.forEach(function(m){
    var isMe=m.from===meUid;
    var cls=isMe?'dm-me':'dm-them';
    var t='';
    if(m.sentAt){ var d=(typeof m.sentAt.toDate==='function')?m.sentAt.toDate():new Date(m.sentAt); t=d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); }
    html+='<div class="dm-bubble '+cls+'">'+_escDM(m.text||'')+( t?'<div class="dm-bubble-time">'+t+'</div>':'')+'</div>';
  });
  box.innerHTML=html; box.scrollTop=box.scrollHeight;
}
function _escDM(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _dmMarkRead(convId,uid){
  if(!window.db||!window.fbSetDoc||!window.fbDoc) return;
  var f={}; f['unread_'+uid]=0;
  window.fbSetDoc(window.fbDoc(window.db,'dm_conversations',convId),f,{merge:true}).catch(function(){});
}

window.dmSend = function(){
  var inp=document.getElementById('dmInput');
  if(!inp||!_dmCurrentUid||!_dmCurrentConvId) return;
  var txt=inp.value.trim(); if(!txt||txt.length>500) return;
  var meUid=window.currentUserUID;
  if(!meUid){ if(typeof socToast==='function') socToast('🔒 Connexion requise'); return; }
  var btn=document.getElementById('dmSendBtn'); if(btn) btn.disabled=true;
  inp.value='';
  if(!window.db||!window.fbAddDoc||!window.fbCollection||!window.fbSetDoc||!window.fbDoc||!window.fbServerTimestamp){
    if(typeof socToast==='function') socToast('⚠️ Firebase non disponible');
    if(btn) btn.disabled=false; return;
  }
  var ts=window.fbServerTimestamp();
  var msgData={ from:meUid, fromName:window.currentUserPseudo||window.currentUserEmail||'Moi', to:_dmCurrentUid, text:txt, sentAt:ts };
  window.fbAddDoc(window.fbCollection(window.db,'dm_conversations',_dmCurrentConvId,'messages'), msgData)
    .then(function(){
      var meta={ participants:[meUid,_dmCurrentUid], lastMsg:txt.substring(0,80), lastMsgFrom:meUid, lastMsgAt:ts, updatedAt:ts };
      if(window.fbFieldIncrement) meta['unread_'+_dmCurrentUid]=window.fbFieldIncrement(1);
      window.fbSetDoc(window.fbDoc(window.db,'dm_conversations',_dmCurrentConvId),meta,{merge:true}).catch(function(){});
      if(btn) btn.disabled=false;
    }).catch(function(e){
      console.warn('[DM] send error',e);
      if(typeof socToast==='function') socToast('❌ Erreur : '+(e.message||'')); if(btn) btn.disabled=false;
    });
};
window.dmSend=window.dmSend;

/* Couper le listener quand le modal se ferme */
(function(){
  var _oc=window.closeModal;
  window.closeModal=function(id){
    if(id==='modalDMChat'&&typeof _dmUnsub==='function'){ _dmUnsub(); _dmUnsub=null; }
    if(typeof _oc==='function') _oc(id);
  };
})();

/* ════════════════════════════════════════════════════════════
   DM INBOX LISTENER — arrière-plan
   Tourne dès la connexion (indépendamment du modal).
   Écoute les conversations où l'utilisateur est participant
   et affiche une notification in-app si un nouveau message arrive.
════════════════════════════════════════════════════════════ */
var _dmInboxUnsub = null;
var _dmInboxLastSeen = {}; // convId → lastMsgAt (pour éviter faux positifs au 1er chargement)
var _dmInboxReady   = false; // true après le 1er snapshot (baseline établie)

function _dmStartInboxListener(meUID){
  if(!window.db || !window.fbCollection || !window.fbOnSnapshot || !window.fbQuery || !window.fbWhere) return;
  if(typeof _dmInboxUnsub === 'function'){ _dmInboxUnsub(); _dmInboxUnsub = null; }
  _dmInboxReady = false;

  var q = window.fbQuery(
    window.fbCollection(window.db, 'dm_conversations'),
    window.fbWhere('participants', 'array-contains', meUID)
  );

  _dmInboxUnsub = window.fbOnSnapshot(q, function(snap){
    /* Calculer le total non-lu reel depuis TOUTES les conversations */
    var unreadKey = 'unread_' + meUID;
    var totalUnread = 0;
    /* ✅ FIX: alimenter aussi les badges par ami pour renderFriends */
    window._friendUnreadCounts = window._friendUnreadCounts || {};
    snap.forEach(function(d){
      var cnt = d.data()[unreadKey] || 0;
      totalUnread += cnt;
      /* Stocker par convId pour que renderFriends puisse lire */
      window._friendUnreadCounts[d.id] = cnt;
    });

    /* Mettre a jour le badge DM avec la vraie valeur */
    var dmBadge = document.getElementById('dmInboxBadge');
    if(dmBadge){
      if(totalUnread > 0){
        dmBadge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        dmBadge.style.display = 'inline-flex';
      } else {
        dmBadge.textContent = '0';
        dmBadge.style.display = 'none';
      }
    }
    /* ✅ FIX: re-render la liste d'amis pour mettre à jour les badges non-lus */
    if(typeof renderFriends === 'function'){
      try{ renderFriends(); }catch(e){}
    }

    if(!_dmInboxReady){
      snap.forEach(function(d){
        var data = d.data();
        _dmInboxLastSeen[d.id] = data.updatedAt ? (typeof data.updatedAt.toMillis==='function' ? data.updatedAt.toMillis() : data.updatedAt) : 0;
      });
      _dmInboxReady = true;
      return;
    }

    snap.docChanges && snap.docChanges().forEach(function(change){
      if(change.type !== 'added' && change.type !== 'modified') return;
      var d = change.doc; var data = d.data(); var convId = d.id;
      if(data.lastMsgFrom === meUID) return;
      if(_dmCurrentConvId === convId) return;
      if(!(data[unreadKey] > 0)) return;
      var newTs = data.updatedAt ? (typeof data.updatedAt.toMillis==='function' ? data.updatedAt.toMillis() : data.updatedAt) : 0;
      var lastTs = _dmInboxLastSeen[convId] || 0;
      if(newTs <= lastTs) return;
      _dmInboxLastSeen[convId] = newTs;
      var senderName = ((_friends||[]).find(function(f){ return f.uid===data.lastMsgFrom; })||{}).name || "Quelqu'un";
      var preview = data.lastMsg ? data.lastMsg.substring(0,60) : '...';
      if(typeof socToast === 'function'){ socToast('💬 '+senderName+' : '+preview); }
    });
  }, function(e){ console.warn('[DM Inbox] listener error:', e); });
}

/* Démarrer l'inbox listener dès que l'utilisateur est connecté */
(function(){
  var _inboxWatcher = setInterval(function(){
    if(window.currentUserUID && window.fbWhere){
      clearInterval(_inboxWatcher);
      setTimeout(function(){ _dmStartInboxListener(window.currentUserUID); }, 1200);
    }
  }, 600);
})();

// Fermer modal au clic sur l'overlay
document.querySelectorAll('.soc-modal-overlay').forEach(function(el){
  el.addEventListener('click', function(e){
    if(e.target===el) closeModal(el.id);
  });
});

window.toggleSocFab = function(){
  _fabOpen = !_fabOpen;
  var fab = document.getElementById('socFab');
  var menu = document.getElementById('socFabMenu');
  if(fab) fab.style.transform = _fabOpen ? 'rotate(45deg)' : '';
  if(menu) menu.classList.toggle('open', _fabOpen);
};
function closeSocFab(){
  _fabOpen = false;
  var fab = document.getElementById('socFab');
  var menu = document.getElementById('socFabMenu');
  if(fab) fab.style.transform = '';
  if(menu) menu.classList.remove('open');
}

window.confirmAction = function(msg, icon, okLabel, cb){
  document.getElementById('confirmMsg').textContent = msg;
  document.getElementById('confirmIcon').textContent = icon||'⚠️';
  document.getElementById('confirmOkBtn').textContent = okLabel||'Confirmer';
  _confirmCallback = cb;
  openModal('modalConfirm');
};
window.executeConfirm = function(){
  closeModal('modalConfirm');
  if(typeof _confirmCallback==='function') _confirmCallback();
  _confirmCallback = null;
};

function updateBadges(){
  var bf = document.getElementById('tabBadgeFriends');
  var br = document.getElementById('tabBadgeReq');
  if(bf) bf.textContent = _friends.length;
  if(br) br.textContent = _requestsIn.length;
  if(br) br.style.display = _requestsIn.length?'':'none';
}

function socToast(msg){
  window.socToast = socToast; // expose
  var t = document.getElementById('socToast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  if(_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3000);
}
window.socToast = socToast;

function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

console.log('[AMBI241] ✅ Module Social chargé — Amis, Communautés, Projets');
})();

