/* ═══ PROFIL — LOGIQUE JS ═══ */
var pTabDefs = {
  membre:    { tabs: ['fav','activite','notif'],         prefix: 'pm-tab-' },
  chauffeur: { tabs: ['trips','avis','compte'],          prefix: 'pc-tab-' },
  etab:      { tabs: ['infos','photos','avis','fiches'], prefix: 'pe-tab-' }
};

function pSwitchRole(role) {
  document.querySelectorAll('.profil-view').forEach(function(v){ v.classList.remove('active'); });
  var vEl = document.getElementById('pv-' + role);
  if(vEl) vEl.classList.add('active');
  document.querySelectorAll('.demo-tab-profil').forEach(function(t){ t.classList.toggle('active', t.dataset.role === role); });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function pSetStab(btn, role, tab) {
  var def = pTabDefs[role];
  btn.closest('.section-tabs-p').querySelectorAll('.stab-p').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  def.tabs.forEach(function(t){
    var el = document.getElementById(def.prefix + t);
    if(el) el.style.display = (t === tab) ? '' : 'none';
  });
}

function pOpenEditModal(role) {
  var m = document.getElementById('pmodal-' + role);
  if(m){ m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function pCloseModal(role) {
  var m = document.getElementById('pmodal-' + role);
  if(m){ m.classList.remove('open'); document.body.style.overflow = ''; }
}

function pSaveProfile(role) {
  pCloseModal(role);
  setTimeout(function(){ pShowToast('✅ Profil mis à jour avec succès !'); }, 300);
}

function pToggleDispo(input) {
  var isOn = input.checked;
  var dot  = document.getElementById('p-dispo-dot');
  var txt  = document.getElementById('p-dispo-text');
  var sub  = document.getElementById('p-dispo-sub');
  if(dot){ dot.classList.toggle('off', !isOn); }
  if(txt){ txt.textContent = isOn ? 'Disponible' : 'Hors ligne'; }
  if(sub){ sub.textContent = isOn ? 'Vous recevez des demandes de course' : 'Vous ne recevrez pas de demandes'; }
  pShowToast(isOn ? '🟢 Vous êtes maintenant disponible' : '⚫ Vous êtes hors ligne');
}

/* Upload avatar — sauvegarde Firestore + localStorage */
function pHandleAvatarUpload(input) {
  var file = input.files[0];
  if(!file) return;

  var activeView = document.querySelector('#sec-profil .profil-view.active');
  if(!activeView) return;
  var role = activeView.id.replace('pv-','');
  var uid = window.currentUserUID;

  // Compression canvas (max 240px, jpeg 0.82)
  var reader = new FileReader();
  reader.onload = function(e) {
    var img0 = new Image();
    img0.onload = function(){
      var MAX = 240;
      var w = img0.width, h = img0.height;
      var ratio = Math.min(MAX/w, MAX/h, 1);
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(w*ratio);
      canvas.height = Math.round(h*ratio);
      canvas.getContext('2d').drawImage(img0, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.82);

      // 1. Mettre à jour le DOM immédiatement
      [document.getElementById('pav-'+role), document.getElementById('pmodal-av-'+role)].forEach(function(av){
        if(!av) return;
        var imgEl = av.querySelector('img') || document.createElement('img');
        imgEl.src = dataUrl;
        imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        if(!imgEl.parentElement) av.prepend(imgEl);
        Array.from(av.childNodes).forEach(function(n){ if(n.nodeType===3) n.textContent=''; });
      });
      // Mettre à jour aussi l'avatar header
      if(typeof _renderMyAvatar==='function' && uid){
        var pseudo = window.currentUserPseudo||'?';
        var init = (pseudo||'?')[0].toUpperCase();
        var wrap = document.getElementById('myAvatarWrap');
        if(wrap) wrap.innerHTML = '<img src="'+dataUrl+'" style="width:74px;height:74px;border-radius:50%;object-fit:cover;display:block;">';
        if(typeof _refreshQuickbarAvatar==='function') _refreshQuickbarAvatar(dataUrl, init);
      }
      // Mettre en cache mémoire
      if(uid && typeof _userAvatarCache!=='undefined') _userAvatarCache[uid] = dataUrl;

      // 2. Sauvegarder en localStorage (persistance immédiate offline)
      if(uid){
        try { localStorage.setItem('ambi241_avatar_'+uid, dataUrl); } catch(er){}
      }

      // 3. Sauvegarder dans Firestore (persistance cloud)
      if(uid && window.db && window.fbDoc && window.fbUpdateDoc){
        (window.fbSetDoc ? window.fbSetDoc(window.fbDoc(window.db,'users',uid),{ avatarUrl: dataUrl },{merge:true}) : window.fbUpdateDoc(window.fbDoc(window.db,'users',uid),{ avatarUrl: dataUrl }))
          .then(function(){ pShowToast('✅ Photo de profil sauvegardée !'); })
          .catch(function(){ pShowToast('✅ Photo enregistrée localement'); });
      } else {
        pShowToast('✅ Photo de profil mise à jour');
      }
    };
    img0.onerror = function(){ pShowToast('❌ Image invalide'); };
    img0.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* Upload cover — sauvegarde Firestore + localStorage */
function pHandleCoverUpload(input) {
  var file = input.files[0];
  if(!file) return;
  var uid = window.currentUserUID;

  var reader = new FileReader();
  reader.onload = function(e) {
    var img0 = new Image();
    img0.onload = function(){
      // Compression cover (max 800px largeur, jpeg 0.80)
      var MAX_W = 800;
      var w = img0.width, h = img0.height;
      var ratio = Math.min(MAX_W/w, 1);
      var canvas = document.createElement('canvas');
      canvas.width  = Math.round(w*ratio);
      canvas.height = Math.round(h*ratio);
      canvas.getContext('2d').drawImage(img0, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL('image/jpeg', 0.80);

      // 1. Mettre à jour le DOM immédiatement
      var activeView = document.querySelector('#sec-profil .profil-view.active');
      if(!activeView) return;
      var role = activeView.id.replace('pv-','');
      var cover = document.getElementById('pcov-'+role);
      if(!cover) return;
      var img = cover.querySelector('img');
      if(!img){ img = document.createElement('img'); cover.prepend(img); var fd=cover.querySelector('div:not(.cover-overlay)'); if(fd) fd.style.display='none'; }
      img.src = dataUrl;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';

      // 2. Sauvegarder en localStorage (persistance immédiate offline)
      if(uid){
        try { localStorage.setItem('ambi241_cover_'+role+'_'+uid, dataUrl); } catch(er){}
      }

      // 3. Sauvegarder dans Firestore (persistance cloud)
      if(uid && window.db && window.fbDoc && window.fbUpdateDoc){
        var field = {}; field['coverUrl_'+role] = dataUrl;
        (window.fbSetDoc ? window.fbSetDoc(window.fbDoc(window.db,'users',uid),field,{merge:true}) : window.fbUpdateDoc(window.fbDoc(window.db,'users',uid),field))
          .then(function(){ pShowToast('✅ Photo de couverture sauvegardée !'); })
          .catch(function(){ pShowToast('✅ Couverture enregistrée localement'); });
      } else {
        pShowToast('✅ Photo de couverture mise à jour');
      }
    };
    img0.onerror = function(){ pShowToast('❌ Image invalide'); };
    img0.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

/* Upload gallery */
/* ══════════════════════════════════════════════════════
   GALERIE PROFIL — Upload, Persistance, Affichage
   ══════════════════════════════════════════════════════ */

/* Clé localStorage galerie */
function _pGalleryKey() {
  return 'ambi241_pgallery_' + (window.currentUserUID || 'guest');
}

/* Charger les URLs sauvegardées */
function _pGalleryLoad() {
  try { return JSON.parse(localStorage.getItem(_pGalleryKey()) || '[]'); } catch(e) { return []; }
}

/* Sauvegarder les URLs (max 12 items, chaque dataURL compressée) */
function _pGallerySave(urls) {
  try { localStorage.setItem(_pGalleryKey(), JSON.stringify(urls.slice(0, 12))); } catch(e) {}
}

/* Compresser une image via canvas (max 400px, qualité 0.72) */
function _pCompressImage(dataUrl, cb) {
  var img = new Image();
  img.onload = function() {
    var MAX = 400;
    var w = img.width, h = img.height;
    var ratio = Math.min(MAX / w, MAX / h, 1);
    var cw = Math.round(w * ratio), ch = Math.round(h * ratio);
    var canvas = document.createElement('canvas');
    canvas.width = cw; canvas.height = ch;
    var ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, cw, ch);
    cb(canvas.toDataURL('image/jpeg', 0.72));
  };
  img.onerror = function() { cb(null); };
  img.src = dataUrl;
}

/* Créer un élément gallery-item avec gestion d'erreur */
function _pMakeGalleryItem(src, onDelete) {
  var item = document.createElement('div');
  item.className = 'gallery-item';
  item.style.position = 'relative';

  var img = document.createElement('img');
  img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

  /* ── Gestion d'erreur : si l'image ne charge pas → supprimer l'item ── */
  img.onerror = function() {
    item.remove();
    /* Mettre à jour la sauvegarde : retirer l'URL cassée */
    var saved = _pGalleryLoad();
    var idx = saved.indexOf(src);
    if(idx !== -1) { saved.splice(idx, 1); _pGallerySave(saved); }
  };

  img.src = src;
  item.appendChild(img);

  /* Bouton supprimer (appui long ou tap sur ×) */
  var del = document.createElement('button');
  del.innerHTML = '✕';
  del.style.cssText = 'position:absolute;top:4px;right:4px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,.65);border:1.5px solid rgba(255,255,255,.3);color:#fff;font-size:.65rem;cursor:pointer;display:none;align-items:center;justify-content:center;z-index:2;';
  del.onclick = function(e) {
    e.stopPropagation();
    item.remove();
    var saved = _pGalleryLoad();
    var idx = saved.indexOf(src);
    if(idx !== -1) { saved.splice(idx, 1); _pGallerySave(saved); }
    if(typeof onDelete === 'function') onDelete();
  };
  item.appendChild(del);

  /* Afficher/masquer le bouton supprimer au hover/touch */
  item.addEventListener('mouseenter', function(){ del.style.display='flex'; });
  item.addEventListener('mouseleave', function(){ del.style.display='none'; });
  var _touch = null;
  item.addEventListener('touchstart', function(){ _touch = setTimeout(function(){ del.style.display = del.style.display==='flex'?'none':'flex'; }, 500); }, {passive:true});
  item.addEventListener('touchend', function(){ clearTimeout(_touch); }, {passive:true});

  return item;
}

/* Restaurer la galerie depuis localStorage */
function _pGalleryRestore(gridId) {
  var grid = document.getElementById(gridId);
  if(!grid) return;
  var saved = _pGalleryLoad();
  if(!saved.length) return;
  var addBtn = grid.querySelector('.gallery-add');
  /* Retirer d'abord les items existants qui ne sont pas démo ni add */
  var existing = grid.querySelectorAll('.gallery-item[data-saved]');
  existing.forEach(function(el){ el.remove(); });
  saved.forEach(function(url) {
    if(!url) return;
    var item = _pMakeGalleryItem(url);
    item.setAttribute('data-saved','1');
    if(addBtn) grid.insertBefore(item, addBtn);
    else grid.appendChild(item);
  });
}

/* Upload : lecture, compression, sauvegarde, affichage */
function pHandleGalleryUpload(input) {
  /* FIX#1 — Require UID to save photos permanently */
  if(!window.currentUserUID) {
    if(typeof pShowToast === 'function') pShowToast('🔒 Connectez-vous pour sauvegarder vos photos');
    else if(typeof window.showToast === 'function') window.showToast('🔒 Connectez-vous pour sauvegarder vos photos');
    input.value = '';
    return;
  }
  var files = Array.from(input.files || []);
  if(!files.length) return;
  var activeView = document.querySelector('#sec-profil .profil-view.active');
  if(!activeView) return;
  var role = activeView.id.replace('pv-','');
  var gridId = role === 'etab' ? 'pgallery-etab' : 'pgallery-membre';
  var grid = document.getElementById(gridId);
  if(!grid) return;

  var count = 0, total = files.length;
  var saved = _pGalleryLoad();

  files.forEach(function(file) {
    /* Vérifier que c'est bien une image (format renderable) */
    var renderableTypes = /^image\/(jpeg|jpg|png|webp|gif|avif|bmp|svg\+xml)$/i;
    var ext = (file.name || '').split('.').pop().toLowerCase();
    var renderableExts = /^(jpg|jpeg|png|webp|gif|avif|bmp|svg)$/;
    var isRenderable = (file.type && renderableTypes.test(file.type)) || renderableExts.test(ext);

    var reader = new FileReader();
    reader.onload = function(e) {
      var rawUrl = e.target.result;
      if(!rawUrl) { count++; return; }

      /* Compresser avant insertion + sauvegarde */
      _pCompressImage(rawUrl, function(compressedUrl) {
        var finalUrl = compressedUrl || rawUrl;
        var addBtn = grid.querySelector('.gallery-add');
        var item = _pMakeGalleryItem(finalUrl);
        item.setAttribute('data-saved','1');
        if(addBtn) grid.insertBefore(item, addBtn);
        else grid.appendChild(item);

        /* Sauvegarder en localStorage */
        saved.push(finalUrl);
        _pGallerySave(saved);
        /* FIX#1b — Aussi sauvegarder dans Firestore pour persistance cross-session */
        _pGallerySaveToFirestore(saved);

        count++;
        if(count === total) pShowToast('✅ ' + count + ' photo' + (count>1?'s':'') + ' ajoutée' + (count>1?'s':''));
      });
    };
    reader.onerror = function() { count++; if(count===total) pShowToast('⚠️ Certains fichiers n\'ont pas pu être chargés'); };
    reader.readAsDataURL(file);
  });

  /* Réinitialiser l'input pour permettre de re-sélectionner le même fichier */
  input.value = '';
}

/* Toast */
var _pToastTimer = null;
function pShowToast(msg) {
  // Utilise le toast existant de l'app si disponible, sinon crée le sien
  if(typeof showToast === 'function') { showToast(msg); return; }
  var t = document.getElementById('p-toast-el');
  if(!t){
    t = document.createElement('div');
    t.id = 'p-toast-el';
    t.style.cssText = 'position:fixed;bottom:calc(var(--nav-h, 54px) + var(--player-h, 0px) + 18px);left:50%;transform:translateX(-50%) translateY(20px);background:rgba(0,255,170,.9);color:#000;font-size:.82rem;font-weight:800;padding:.55rem 1.2rem;border-radius:30px;opacity:0;transition:all .3s;pointer-events:none;z-index:600;white-space:nowrap;';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  t.style.transform = 'translateX(-50%) translateY(0)';
  if(_pToastTimer) clearTimeout(_pToastTimer);
  _pToastTimer = setTimeout(function(){ t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(20px)'; }, 2800);
}