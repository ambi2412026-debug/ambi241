
(function(){
'use strict';

/* ═══════════════════════════════════════════════
   ÉTAT GLOBAL
═══════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════
   HELPER : escape HTML
═══════════════════════════════════════════════ */
function _e(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ═══════════════════════════════════════════════
   OUVRIR LA PUBLICATION (redirige vers le vrai modal)
   Prend en compte si l'utilisateur est connecté ou non
═══════════════════════════════════════════════ */
window.ambi_openPublish = function(typeHint) {
  // Si l'utilisateur n'est pas connecté → ouvrir la connexion
  if (!window.currentUserUID) {
    if (typeof window.showToast === 'function') window.showToast('🔒 Connectez-vous pour publier !');
    var overlay = document.getElementById('userOverlay');
    if (overlay) {
      overlay.classList.add('show');
      if (typeof window.switchUserTab === 'function') window.switchUserTab('connexion');
    }
    return;
  }

  // Vérifier limite quotidienne (5 pub/jour)
  var uid = window.currentUserUID;
  var dayKey = 'pubday_' + uid + '_' + new Date().toISOString().slice(0,10);
  var todayCount = 0;
  try { todayCount = parseInt(localStorage.getItem(dayKey) || '0'); } catch(e) {}
  if (todayCount >= 5) {
    if (typeof window.showToast === 'function') window.showToast('🚫 Limite de 5 publications/jour atteinte !');
    return;
  }

  // Ouvrir le vrai modal de publication (socPubModal - enrichi)
  if (typeof window.socOpenPublishModal === 'function') {
    window.socOpenPublishModal(typeHint || 'ambiance');
    return;
  }
  if (typeof window.openPubCompose === 'function') {
    window.openPubCompose();
    return;
  }
  // FALLBACK DIRECT : ouvrir le modal socPubModal sans dependance au module
  var modal = document.getElementById('socPubModal');
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    setTimeout(function() {
      var ta = document.getElementById('socPubTextarea');
      if (ta) ta.focus();
    }, 120);
    return;
  }
  // Dernier recours : modal simple inline
  _ambiShowSimplePublishModal(typeHint);
};

/* Modal de publication simple (fallback ultime) */
function _ambiShowSimplePublishModal(typeHint) {
  var existing = document.getElementById('_ambiSimplePubOverlay');
  if (existing) { existing.style.display = 'flex'; return; }
  var overlay = document.createElement('div');
  overlay.id = '_ambiSimplePubOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:900;background:rgba(0,0,0,0.85);backdrop-filter:blur(12px);display:flex;align-items:flex-end;justify-content:center;';
  overlay.innerHTML = '<div style="background:var(--surface);border:1px solid rgba(255,45,155,0.3);border-radius:24px 24px 0 0;padding:1.4rem;width:100%;max-width:540px;max-height:85vh;overflow-y:auto;">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">'
    + '<span style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--pink);">&#x270D;&#xFE0F; Nouvelle publication</span>'
    + '<button id="_ambiSimplePubClose" style="width:30px;height:30px;border-radius:50%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);font-size:0.9rem;cursor:pointer;">&#x2715;</button>'
    + '</div>'
    + '<textarea id="_ambiSimplePubTA" placeholder="Quelle ambiance ce soir ?" maxlength="600"'
    + ' style="width:100%;min-height:110px;background:rgba(255,255,255,0.04);border:1.5px solid rgba(255,45,155,0.25);border-radius:14px;padding:0.8rem;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.9rem;resize:none;outline:none;box-sizing:border-box;"></textarea>'
    + '<div style="display:flex;justify-content:flex-end;margin-top:0.8rem;gap:0.5rem;">'
    + '<button id="_ambiSimplePubCancel" style="padding:0.55rem 1.1rem;border-radius:20px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:var(--muted);font-family:DM Sans,sans-serif;font-size:0.8rem;cursor:pointer;">Annuler</button>'
    + '<button id="_ambiSimplePubSubmit" style="padding:0.55rem 1.4rem;border-radius:20px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.8rem;cursor:pointer;">Publier</button>'
    + '</div></div>';
  document.body.appendChild(overlay);
  var close = function() { overlay.style.display = 'none'; document.body.style.overflow = ''; };
  overlay.querySelector('#_ambiSimplePubClose').onclick = close;
  overlay.querySelector('#_ambiSimplePubCancel').onclick = close;
  overlay.addEventListener('click', function(e) { if (e.target === overlay) close(); });
  overlay.querySelector('#_ambiSimplePubSubmit').onclick = function() {
    var ta = overlay.querySelector('#_ambiSimplePubTA');
    var txt = (ta && ta.value.trim()) || '';
    if (!txt) { if (typeof showToast === 'function') showToast('Ecrivez quelque chose !'); return; }
    var pub = {
      text: txt, type: typeHint || 'ambiance',
      uid: window.currentUserUID || 'anon',
      pseudo: window.currentUserPseudo || window.currentUserEmail || 'Membre',
      ts: Date.now(), likes: 0, comments: 0
    };
    if (window.db && window.fbAddDoc && window.fbCollection) {
      window.fbAddDoc(window.fbCollection(window.db, 'publications'), pub)
        .then(function() { if (typeof showToast === 'function') showToast('Publication partagee !'); })
        .catch(function() {});
    } else {
      if (typeof showToast === 'function') showToast('Publication partagee !');
    }
    close();
    try {
      var dayKey = 'pubday_' + (window.currentUserUID||'x') + '_' + new Date().toISOString().slice(0,10);
      localStorage.setItem(dayKey, String((parseInt(localStorage.getItem(dayKey)||'0')+1)));
    } catch(e2) {}
  };
  setTimeout(function() { var ta = overlay.querySelector('#_ambiSimplePubTA'); if(ta) ta.focus(); }, 80);
}

/* ═══════════════════════════════════════════════
   TAB POSTS (normal)
═══════════════════════════════════════════════ */
window.ambi_switchToPostsTab = function() {
  if (typeof window.socSwitchTab === 'function') window.socSwitchTab('publications');
};


/* ═══════════════════════════════════════════════
   LIKE SUR POST LIVE
═══════════════════════════════════════════════ */
window.ambi_likePost = function(pubId, btn) {
  if (!window.currentUserUID) {
    if (typeof window.showToast === 'function') window.showToast('🔒 Connectez-vous pour liker !');
    return;
  }
  btn.classList.toggle('active');
  var span = btn.querySelector('span');
  var n = parseInt(span ? span.textContent : 0) || 0;
  var liked = btn.classList.contains('active');
  if (span) span.textContent = liked ? n + 1 : Math.max(0, n - 1);
  btn.style.transform = 'scale(1.2)';
  setTimeout(function(){ btn.style.transform = ''; }, 160);
  // Sync Firebase
  if (window.db && window.fbDoc && window.fbUpdateDoc) {
    try {
      window.fbUpdateDoc(window.fbDoc(window.db, 'publications', pubId), { likes: liked ? n + 1 : Math.max(0, n - 1) }).catch(function(){});
    } catch(e) {}
  }
};

/* ═══════════════════════════════════════════════
   PARTAGER UN POST
═══════════════════════════════════════════════ */
window.ambi_sharePost = function(pubId) {
  if (navigator.share) {
    navigator.share({ title: 'AMBI241 Live', text: 'Regardez ça sur AMBI241 !', url: window.location.href });
  } else {
    if (typeof window.showToast === 'function') window.showToast('📋 Lien copié !');
    try { navigator.clipboard.writeText(window.location.href); } catch(e) {}
  }
};

/* ═══════════════════════════════════════════════
   INIT : pseudo dans la barre + keyboard nav
═══════════════════════════════════════════════ */
function ambi_initComposeBar() {
  var pseudo = window.currentUserPseudo || window.currentUserEmail || null;
  var letter = pseudo ? (pseudo[0] || '?').toUpperCase() : '?';
  var avatar = document.getElementById('socPubComposeAvatar');
  if (avatar) avatar.textContent = letter;
  var ct = document.getElementById('ambiComposeText');
  if (ct && pseudo) {
    var name = pseudo.split(/[@\s]/)[0];
    ct.textContent = name + ', partagez votre ambiance…';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Keyboard on compose bar
  var bar = document.getElementById('ambiComposeBar');
  if (bar) {
    bar.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); window.ambi_openPublish(); }
    });
  }
  ambi_initComposeBar();
  // Watcher pour la connexion utilisateur
  var _watcher = setInterval(function() {
    if (window.currentUserUID || window.currentUserPseudo) {
      ambi_initComposeBar();
      clearInterval(_watcher);
    }
  }, 700);
});

/* Intercept changement de pseudo (connexion) */
try {
  var _pseudoVal = window.currentUserPseudo;
  Object.defineProperty(window, 'currentUserPseudo', {
    get: function(){ return _pseudoVal; },
    set: function(v){ _pseudoVal = v; if(v) ambi_initComposeBar(); },
    configurable: true
  });
} catch(e) {}

/* ═══════════════════════════════════════════════
   PATCHER socSwitchTab pour réinitialiser le mode live
   quand on change d'onglet (Amis, Demandes, etc.)
═══════════════════════════════════════════════ */
var _origSocSwitchForLive = window.socSwitchTab;
window.socSwitchTab = function(tab) {
  if (typeof _origSocSwitchForLive === 'function') _origSocSwitchForLive(tab);
  if (tab === 'publications') {
    ambi_initComposeBar();
  }
};

/* ═══════════════════════════════════════════════
   RAFRAÎCHIR LE FEED LIVE après une nouvelle publication
═══════════════════════════════════════════════ */
var _origSocSubmit = window.socSubmitNewPub;
window.socSubmitNewPub = function() {
  if (typeof _origSocSubmit === 'function') _origSocSubmit();
  // Incrémenter compteur local
  if (window.currentUserUID) {
    var dayKey = 'pubday_' + window.currentUserUID + '_' + new Date().toISOString().slice(0,10);
    try {
      var c = parseInt(localStorage.getItem(dayKey) || '0');
      localStorage.setItem(dayKey, c + 1);
    } catch(e) {}
  }
};
})();

/* ═══════════════════════════════════════════════════════════════
   CORRECTIF — CHARGER LES PUBLICATIONS FIREBASE dans socPubFeed
   (onglet Posts dans COMPTES / sec-social)
   Ce feed était vide car aucun listener Firebase n'alimentait
   le div #socPubFeed. Ce module corrige ce bug.
═══════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  var _socFeedUnsub = null;
  var _socFeedData  = [];
  var _socFeedFilter = 'all';
  var _socFeedInited = false;

  /* ── Échapper le HTML ── */
  function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  /* ── Formater la date ── */
  function _fmtDate(ts){
    if(!ts) return 'À l\'instant';
    var d = ts.toDate ? ts.toDate() : new Date(ts);
    var now = new Date();
    var diff = Math.floor((now - d) / 1000);
    if(diff < 60)  return 'À l\'instant';
    if(diff < 3600) return Math.floor(diff/60) + ' min';
    if(diff < 86400) return Math.floor(diff/3600) + ' h';
    return d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  }

  /* ── Construire une carte pour socPubFeed ── */
  function _buildSocCard(p){
    var pid    = _esc(p._id || p.id || '');
    var pseudo = _esc(p.pseudo || p.auteur || p.displayName || 'Anonyme');
    var letter = (p.pseudo || p.auteur || p.displayName || '?')[0].toUpperCase();
    var text   = _esc(p.texte || p.text || p.titre || p.message || '');
    var ts     = _fmtDate(p.createdAt);
    var mood   = p.mood || '';
    var vis    = {public:'🌐', amis:'👥', moi:'🔒'}[p.visibility] || '🌐';
    var likes  = parseInt(p.likes) || 0;
    var cmtCnt = parseInt(p.comments) || 0;

    // Photos
    var photoHtml = '';
    var photos = Array.isArray(p.photos) ? p.photos : (Array.isArray(p.photoURLs) ? p.photoURLs : []);
    if(photos.length){
      var cols = photos.length===1?'1fr':(photos.length===2?'1fr 1fr':'1fr 1fr 1fr');
      photoHtml = '<div style="display:grid;grid-template-columns:'+cols+';gap:4px;margin:0.6rem 0;border-radius:12px;overflow:hidden;">';
      photos.slice(0,5).forEach(function(url){
        photoHtml += '<img src="'+_esc(url)+'" style="width:100%;height:140px;object-fit:cover;cursor:pointer;" loading="lazy" onclick="if(window.openPubPhotoLightbox)openPubPhotoLightbox(\''+_esc(url)+'\');else window.open(\''+_esc(url)+'\',\'_blank\')">';
      });
      photoHtml += '</div>';
    }

    // GIF
    var gifHtml = '';
    if(p.gifUrl){
      gifHtml = '<div style="border-radius:12px;overflow:hidden;margin:0.6rem 0;">'
        +'<img src="'+_esc(p.gifUrl)+'" style="width:100%;max-height:200px;object-fit:cover;display:block;" loading="lazy"></div>';
    }

    // Vidéo
    var videoHtml = '';
    if(p.video || p.videoURL){
      videoHtml = '<div style="border-radius:12px;overflow:hidden;margin:0.6rem 0;border:1.5px solid rgba(0,229,255,0.2);">'
        +'<video src="'+_esc(p.video||p.videoURL)+'" controls style="width:100%;max-height:240px;display:block;background:#000;" playsinline></video></div>';
    }

    // Établissement
    var etabHtml = p.etab ? '<div style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.18);border-radius:8px;padding:0.2rem 0.5rem;font-size:0.65rem;color:var(--cyan);margin:0.3rem 0 0.5rem;">📍 '+_esc(p.etab)+'</div>' : '';

    // Mood
    var moodHtml = mood ? '<span style="background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.22);border-radius:6px;font-size:0.62rem;padding:1px 6px;margin-left:0.3rem;">'+_esc(mood)+'</span>' : '';

    // Section commentaires (masquée par défaut, révélée au clic)
    var myLetter = ((window.currentUserPseudo||window.currentUserEmail||'?')[0]||'?').toUpperCase();
    var cmtSection = '<div id="comments_'+pid+'" class="socpub-comments-section" style="display:none;">'
      +'<div id="commentsList_'+pid+'" class="socpub-comments-list"></div>'
      +'<div class="socpub-comment-compose">'
      +'<div class="socpub-comment-compose-avatar" id="cmtAvatar_'+pid+'">'+myLetter+'</div>'
      +'<div class="socpub-comment-compose-input-wrap">'
      +'<input class="socpub-comment-input" id="commentInput_'+pid+'"'
      +' placeholder="Écrire un commentaire…"'
      +' onkeydown="if(event.key===\'Enter\'){event.preventDefault();socSubmitComment(\''+pid+'\');}">'
      +'</div>'
      +'<button class="socpub-comment-submit" onclick="socSubmitComment(\''+pid+'\')">➤</button>'
      +'</div></div>';

    var avatarStyle = 'background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;color:#fff;';
    var avatarInner = (p.photoURL || p.authorPhoto)
      ? '<img src="'+_esc(p.photoURL||p.authorPhoto)+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" onerror="this.parentNode.innerHTML=\''+letter+'\';this.parentNode.style.background=\'linear-gradient(135deg,var(--pink),var(--purple))\'">'
      : letter;
    return '<article class="socpub-card" data-pub-id="'+pid+'" data-type="'+_esc(p.type||'ambiance')+'">'
      +'<div class="socpub-card-header">'
      +'<div class="socpub-avatar" id="_sfa_'+pid+'" style="'+avatarStyle+'">'+avatarInner+'</div>'
      +'<div class="socpub-meta">'
      +'<div class="socpub-author">'+pseudo+' <span class="socpub-badge verifie">✓</span>'+moodHtml+'</div>'
      +'<div class="socpub-time">'+ts+' <span style="font-size:0.6rem;opacity:0.6;">'+vis+'</span></div>'
      +'</div>'
      +'<div class="socpub-more-btn" onclick="socPubMoreMenu(\''+pid+'\',this)">⋯</div>'
      +'</div>'
      +(text ? '<p class="socpub-text">'+text.replace(/@(\w+)/g,'<span style="color:var(--cyan);">@$1</span>')+'</p>' : '')
      +photoHtml+gifHtml+videoHtml+etabHtml
      +'<div class="socpub-action-bar">'
      +'<button class="socpub-action-btn like" onclick="socPubToggleLike(\''+pid+'\',this)">'
        +'<span class="socpub-action-icon">❤️</span> J\'aime '
        +'<span id="likeCount_'+pid+'" class="socpub-action-count">'+likes+'</span>'
      +'</button>'
      +'<button class="socpub-action-btn comment" onclick="socPubToggleComments(\''+pid+'\')">'
        +'<span class="socpub-action-icon">💬</span> Commenter '
        +'<span id="cmtCount_'+pid+'" class="socpub-action-count">'+cmtCnt+'</span>'
      +'</button>'
      +'<button class="socpub-action-btn share" onclick="socPubShare(\''+pid+'\')"><span class="socpub-action-icon">↪️</span> Partager</button>'
      +'</div>'
      +cmtSection
      +'</article>';
  }

  /* ── Purger les vidéos expirées du socFeed ── */
  function _purgeSocExpired(){
    var now = Date.now();
    var toDelete = [];
    _socFeedData.forEach(function(p){
      if((p.isVideo || p.video) && p.expiresAt){
        var exp = new Date(p.expiresAt).getTime();
        if(exp && now > exp) toDelete.push(p._id || p.id);
      }
    });
    toDelete.forEach(function(id){
      if(window.db && window.fbDoc && window.fbDeleteDoc){
        window.fbDeleteDoc(window.fbDoc(window.db, 'publications', id)).catch(function(){});
      }
      _socFeedData = _socFeedData.filter(function(p){ return (p._id||p.id) !== id; });
      var el = document.querySelector('[data-pub-id="'+id+'"]');
      if(el) el.remove();
    });
    if(toDelete.length) console.log('[AMBI241] socFeed: '+toDelete.length+' vidéo(s) expirée(s) retirée(s)');
  }

  /* ── Rendre le feed ── */
  function _renderSocFeed(){
    _purgeSocExpired();
    var feed = document.getElementById('socPubFeed');
    var empty = document.getElementById('socPubEmpty');
    if(!feed) return;

    var data = _socFeedData;
    if(_socFeedFilter !== 'all'){
      data = data.filter(function(p){ return (p.type||'ambiance') === _socFeedFilter; });
    }

    if(!data.length){
      if(empty) empty.style.display = 'block';
      // Supprimer cartes existantes
      Array.from(feed.querySelectorAll('.socpub-card,.socpub-load-more')).forEach(function(el){ el.remove(); });
      return;
    }
    if(empty) empty.style.display = 'none';

    var html = data.map(function(p){ return _buildSocCard(p); }).join('');
    // Injecter en préservant l'empty
    Array.from(feed.querySelectorAll('.socpub-card,.socpub-load-more')).forEach(function(el){ el.remove(); });
    if(empty) empty.insertAdjacentHTML('afterend', html);
    else feed.insertAdjacentHTML('beforeend', html);

    // Charger les avatars photo si disponibles
    setTimeout(function(){
      data.forEach(function(p){
        if(!p.uid || !p._id) return;
        if(typeof window.loadUserAvatar === 'function'){
          window.loadUserAvatar(p.uid, function(url){
            if(!url) return;
            var el = document.getElementById('_sfa_' + p._id);
            if(el){ el.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">'; el.style.padding='0'; }
          });
        }
      });
    }, 300);
  }

  /* ── Démarrer le listener Firebase ── */
  function _startSocFeed(){
    if(_socFeedInited) return;
    _socFeedInited = true;

    if(!window.db || !window.fbCollection || !window.fbQuery || !window.fbOrderBy || !window.fbOnSnapshot){
      // Firebase pas encore prêt — réessayer dans 1 s
      setTimeout(function(){ _socFeedInited = false; _startSocFeed(); }, 1000);
      return;
    }

    try {
      if(_socFeedUnsub) _socFeedUnsub();
      var q = window.fbQuery(
        window.fbCollection(window.db, 'publications'),
        window.fbOrderBy('createdAt', 'desc')
      );
      _socFeedUnsub = window.fbOnSnapshot(q, function(snap){
        _socFeedData = [];
        snap.forEach(function(d){ _socFeedData.push(Object.assign({ _id: d.id }, d.data())); });
        _renderSocFeed();
      }, function(err){
        console.warn('[AMBI241] socPubFeed snapshot error:', err);
        _renderSocFeed();
      });
    } catch(e) {
      console.warn('[AMBI241] socPubFeed init error:', e);
    }
  }

  /* ── Exposer le filtre ── */
  var _origSocPubFilter = window.socPubFilter;
  window.socPubFilter = function(type, btn){
    if(typeof _origSocPubFilter === 'function') _origSocPubFilter(type, btn);
    _socFeedFilter = type || 'all';
    _renderSocFeed();
  };

  /* ── Patcher socSwitchTab pour déclencher au 1er affichage ── */
  var _origSocSwitchFeed = window.socSwitchTab;
  window.socSwitchTab = function(tab){
    if(typeof _origSocSwitchFeed === 'function') _origSocSwitchFeed(tab);
    if(tab === 'publications') _startSocFeed();
  };

  /* ── Patcher ambi_switchToPostsTab ── */
  var _origAmbiSwitch = window.ambi_switchToPostsTab;
  window.ambi_switchToPostsTab = function(){
    if(typeof _origAmbiSwitch === 'function') _origAmbiSwitch();
    _startSocFeed();
  };

  /* ── Après une nouvelle publication, rafraîchir le feed ── */
  var _origSocSubmitFeed = window.socSubmitNewPub;
  window.socSubmitNewPub = function(){
    if(typeof _origSocSubmitFeed === 'function') _origSocSubmitFeed();
    setTimeout(_renderSocFeed, 800);
  };

  /* ── Démarrage automatique : si le pane publications est déjà actif ou
        quand l'utilisateur se connecte ── */
  function _autoStart(){
    var pane = document.getElementById('pane-publications');
    if(pane && pane.classList.contains('active')) _startSocFeed();
    // Démarrer aussi quand la section sociale est ouverte
    var secSocial = document.getElementById('sec-social');
    if(secSocial && !secSocial.classList.contains('section-hidden')) _startSocFeed();
  }

  // Lancer dès que le DOM est prêt
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){
      setTimeout(_autoStart, 300);
      setTimeout(_startSocFeed, 800); // fallback réduit à 800ms
    });
  } else {
    setTimeout(_autoStart, 300);
    setTimeout(_startSocFeed, 800);
  }

  // Patcher openSection / showSection si elles existent
  ['openSection','showSection','_openSection'].forEach(function(fn){
    var orig = window[fn];
    if(typeof orig !== 'function') return;
    window[fn] = function(sec){
      orig.apply(this, arguments);
      if(sec === 'social' || sec === 'comptes' || sec === 'sec-social'){
        setTimeout(_startSocFeed, 200);
      }
    };
  });
  // Vérification périodique des vidéos expirées toutes les heures
  setInterval(function(){
    _purgeSocExpired();
  }, 60 * 60 * 1000);;
})();
