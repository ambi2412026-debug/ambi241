
/* ═══════════════════════════════════════════════════════
   MODULE FORUM PUBLICATIONS — AMIS & COMMUNAUTÉS
   Firebase Firestore · Photos 5/jour · Vidéos 2/jour
   Visible par tous · Upload réservé aux inscrits
   ═══════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ── État du module ── */
  var _fm = {
    type: 'ambiance',
    mood: '🔥',
    photos: [],     // base64 strings (apercu local uniquement)
    photoFiles: [], // File objects reels - upload Cloudinary
    video: null,    // base64 string (apercu local uniquement)
    videoFile: null, // File video reel - upload Cloudinary
    videoBlob: null,
    emojiPanelOpen: false,
    submitting: false,
    filter: 'all',
    lastDoc: null,
    PAGE_SIZE: 12,
    unsubscribe: null,
    todayKey: new Date().toISOString().slice(0,10)
  };

  /* ── Clés localStorage pour limites quotidiennes ── */
  function _todayPhotoCount(){
    try{ return parseInt(localStorage.getItem('fm_photos_'+_fm.todayKey)||'0'); }catch(e){ return 0; }
  }
  function _todayVideoCount(){
    try{ return parseInt(localStorage.getItem('fm_videos_'+_fm.todayKey)||'0'); }catch(e){ return 0; }
  }
  function _incPhotoCount(n){
    try{ localStorage.setItem('fm_photos_'+_fm.todayKey, _todayPhotoCount()+n); }catch(e){}
  }
  function _incVideoCount(){
    try{ localStorage.setItem('fm_videos_'+_fm.todayKey, _todayVideoCount()+1); }catch(e){}
  }

  /* ── Utilitaires ── */
  function _esc(s){ var d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; }
  function _toast(msg){ if(typeof window.showToast==='function') window.showToast(msg); else alert(msg); }
  function _isLoggedIn(){ return !!(window.currentUserUID && window.currentUserUID.indexOf('anon_')!==0); }
  function _pseudo(){ return window.currentUserPseudo || window.currentUserEmail || 'Anonyme'; }
  function _uid(){ return window.currentUserUID || ''; }
  function _letter(p){ return (p||'?')[0].toUpperCase(); }
  function _timeAgo(ts){
    if(!ts) return '';
    var diff = Date.now() - ts;
    if(diff < 60000) return 'À l\'instant';
    if(diff < 3600000) return Math.floor(diff/60000)+'min';
    if(diff < 86400000) return Math.floor(diff/3600000)+'h';
    return Math.floor(diff/86400000)+'j';
  }

  /* ── Référence Firestore ── */
  function _col(){
    if(!window.db || !window.fbCollection) return null;
    return window.fbCollection(window.db, 'forum_publications');
  }

  /* ══════════════════════════════════════════
     INITIALISATION
  ══════════════════════════════════════════ */
  function initForum(){
    _updateComposeBar();
    _renderDotsBar('forumPhotoDotsBar', _todayPhotoCount(), 5, false);
    _renderDotsBar('forumVideoDotsBar', _todayVideoCount(), 2, true);
    _loadFeed();
  }

  /* Met à jour barre de composition selon l'état de connexion */
  function _updateComposeBar(){
    var cb = document.getElementById('forumComposeBar');
    var gb = document.getElementById('forumGuestBanner');
    if(!cb) return;
    if(_isLoggedIn()){
      cb.style.display = 'flex';
      if(gb) gb.style.display = 'none';
      var av = document.getElementById('forumComposeAvatar');
      if(av){
        av.textContent = _letter(_pseudo());
        if(window.currentUserPhotoURL){ av.style.backgroundImage='url('+window.currentUserPhotoURL+')'; av.style.backgroundSize='cover'; av.textContent=''; }
      }
    } else {
      // Mode invité : barre visible → clic → invitation d'inscription
      cb.style.display = 'flex';
      if(gb) gb.style.display = 'none';
      var av2 = document.getElementById('forumComposeAvatar');
      if(av2){ av2.textContent='👤'; av2.style.backgroundImage=''; av2.style.background='rgba(255,45,155,0.12)'; av2.style.border='1.5px dashed rgba(255,45,155,0.3)'; }
    }
  }

  /* ══════════════════════════════════════════
     CHARGEMENT DU FIL (Firestore)
  ══════════════════════════════════════════ */
  var _loadFeedRetries = 0;
  function _loadFeed(append){
    if(!_col()){
      // Firebase pas encore prêt → retry borné (max 10 × 800ms = 8s)
      if(_loadFeedRetries++ < 10){
        setTimeout(function(){ _loadFeed(append); }, 800);
      } else {
        console.warn('[Forum] Firebase non disponible après 8s');
        var loader = document.getElementById('forumFeedLoader');
        if(loader) loader.style.display='none';
        var empty = document.getElementById('forumFeedEmpty');
        if(empty) empty.style.display='block';
      }
      return;
    }
    _loadFeedRetries = 0; // reset pour prochain appel
    var loader = document.getElementById('forumFeedLoader');
    if(loader) loader.style.display = 'block';
    var empty = document.getElementById('forumFeedEmpty');
    if(empty && !append) empty.style.display = 'none';

    try{
      var q = window.fbQuery(
        _col(),
        window.fbOrderBy('timestamp','desc'),
        window.fbLimit(_fm.PAGE_SIZE + (_fm.lastDoc ? 1 : 0))
      );
      if(_fm.lastDoc && append) q = window.fbQuery(_col(), window.fbOrderBy('timestamp','desc'), window.fbStartAfter(_fm.lastDoc), window.fbLimit(_fm.PAGE_SIZE));

      window.fbGetDocs(q).then(function(snap){
        if(loader) loader.style.display = 'none';
        var feed = document.getElementById('forumFeed');
        if(!feed) return;
        var docs = snap.docs;
        _fm.lastDoc = docs.length ? docs[docs.length-1] : _fm.lastDoc;
        var loadMore = document.getElementById('forumLoadMore');
        if(loadMore) loadMore.style.display = docs.length >= _fm.PAGE_SIZE ? 'inline-block' : 'none';
        if(!append){
          // Vider le feed (garder empty + loader)
          Array.from(feed.children).forEach(function(c){
            if(c.id!=='forumFeedEmpty' && c.id!=='forumFeedLoader') c.remove();
          });
        }
        var filtered = docs.filter(function(d){ return _fm.filter==='all' || d.data().type===_fm.filter; });
        if(!filtered.length && !append){
          if(empty) empty.style.display='block';
          return;
        }
        filtered.forEach(function(d){ feed.appendChild(_buildCard(d.id, d.data())); });
        // Mettre à jour le compteur hero avec le total de publications chargées
        if(!append){
          var _hpc = document.getElementById('heroPostsCount');
          if(_hpc) _hpc.textContent = docs.length;
        }
      }).catch(function(e){
        if(loader) loader.style.display='none';
        console.warn('[Forum] load error', e);
      });
    } catch(e){
      if(loader) loader.style.display='none';
      console.warn('[Forum] query error', e);
    }
  }

  window.forumLoadMorePosts = function(){ _loadFeed(true); };

  /* ══════════════════════════════════════════
     FILTRE
  ══════════════════════════════════════════ */
  window.forumFilter = function(type, btn){
    _fm.filter = type;
    _fm.lastDoc = null;
    document.querySelectorAll('.forum-fchip').forEach(function(b){ b.classList.remove('active'); });
    if(btn) btn.classList.add('active');
    _loadFeed();
  };

  /* ══════════════════════════════════════════
     CONSTRUCTION D'UNE CARD — grille mixte, +N overlay, badge rôle
  ══════════════════════════════════════════ */
  function _buildCard(id, data){
    var el = document.createElement('article');
    el.className = 'forum-card';
    el.setAttribute('data-pub-id', id);
    el.setAttribute('data-type', data.type||'ambiance');
    el.setAttribute('data-author-uid', data.uid||data.authorId||'');

    /* Médias mixtes : video + photos[], max 5 affichés */
    var allMedia = [];
    if(data.video)  allMedia.push({ src: data.video,  type:'video' });
    if(data.photos && data.photos.length){
      data.photos.forEach(function(src){ allMedia.push({ src:src, type:'photo' }); });
    }
    var mediaHtml = '';
    if(allMedia.length){
      var shown  = allMedia.slice(0, 5);
      var hidden = allMedia.length - shown.length;
      var count  = shown.length;
      var gridCls = count===1?'g1':count===2?'g2':'g3';
      mediaHtml = '<div class="forum-card-media-grid '+gridCls+'" style="border-radius:12px;overflow:hidden;margin-bottom:0.65rem;">';
      shown.forEach(function(m, i){
        var isLast = (i===shown.length-1) && hidden>0;
        var hCls   = count===1?'tall':'short';
        var ovr    = isLast ? '<div class="fm-overlay-more">+'+hidden+'</div>' : '';
        var vidBdg = m.type==='video' ? '<div class="fm-vid-badge">\u25B6</div>' : '';
        mediaHtml +=
          '<div class="fcm-item" data-src="'+_esc(m.src)+'" data-mtype="'+m.type+'" '+
               'onclick="forumLightbox(\''+id+'\','+i+')" '+
               'style="position:relative;overflow:hidden;cursor:pointer;background:#000;">'+
            (m.type==='video'
              ? '<video src="'+_esc(m.src)+'" class="forum-card-img '+hCls+'" preload="metadata" muted playsinline style="pointer-events:none;"></video>'
              : '<img src="'+_esc(m.src)+'" class="forum-card-img '+hCls+'" loading="lazy" alt="Photo">')+
            vidBdg+ovr+
          '</div>';
      });
      mediaHtml += '</div>';
    }

    /* Badge rôle */
    var role = data.role||data.userRole||'';
    var roleBadge = '';
    if(role==='admin'||role==='superadmin'){
      roleBadge='<span style="display:inline-flex;align-items:center;gap:2px;background:rgba(255,45,155,0.13);border:1px solid rgba(255,45,155,0.28);border-radius:5px;font-size:0.55rem;font-weight:800;padding:1px 5px;margin-left:5px;color:#ff2d9b;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle;">\u{1F451} Admin</span>';
    } else if(role==='chauffeur'){
      roleBadge='<span style="display:inline-flex;align-items:center;gap:2px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.25);border-radius:5px;font-size:0.55rem;font-weight:800;padding:1px 5px;margin-left:5px;color:#ffd700;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle;">\u{1F695} Chauffeur</span>';
    } else if(role==='membre'){
      roleBadge='<span style="display:inline-flex;align-items:center;gap:2px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.2);border-radius:5px;font-size:0.55rem;font-weight:800;padding:1px 5px;margin-left:5px;color:#00e5ff;text-transform:uppercase;letter-spacing:.04em;vertical-align:middle;">\u2736 Membre</span>';
    }

    var typeColors={ambiance:'var(--pink)',photo:'var(--cyan)',video:'var(--green)',soiree:'var(--amber)',annonce:'var(--purple)',texte:'var(--muted)'};
    var typeIcons ={ambiance:'\U0001f525',photo:'\U0001f4f7',video:'\U0001f3ac',soiree:'\U0001f389',annonce:'\U0001f4e3',texte:'\u270d\ufe0f'};
    var typeColor = typeColors[data.type]||'var(--muted)';
    var typeIcon  = typeIcons[data.type]||'\u270d\ufe0f';
    var likes    = data.likes||0;
    var comments = data.comments||0;

    el.innerHTML =
      '<div class="forum-card-header">'+
        '<div class="forum-card-avatar">'+_esc(_letter(data.pseudo||data.author||'?'))+'</div>'+
        '<div class="forum-card-meta">'+
          '<div class="forum-card-author">'+_esc(data.pseudo||data.author||'Utilisateur')+
            roleBadge+
            ' <span style="background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.22);border-radius:5px;font-size:0.55rem;padding:1px 5px;margin-left:4px;color:'+typeColor+';">'+typeIcon+' '+(data.type||'ambiance')+'</span>'+
            (data.mood?' <span style="font-size:0.85rem;">'+_esc(data.mood)+'</span>':'')+
          '</div>'+
          '<div class="forum-card-time">'+_timeAgo(data.timestamp)+(data.location?' \u00b7 \U0001f4cd '+_esc(data.location):'')+'</div>'+
        '</div>'+
        '<div style="font-size:1.1rem;cursor:pointer;color:var(--muted);padding:0.2rem 0.4rem;position:relative;" onclick="forumMoreMenu(\''+id+'\',this)">\u22ef</div>'+
      '</div>'+
      (data.text?'<p class="forum-card-text">'+_esc(data.text).replace(/\n/g,'<br>')+'</p>':'')+
      mediaHtml+
      '<div class="forum-card-actions">'+
        '<button class="forum-action-btn" id="flike_'+id+'" onclick="forumToggleLike(\''+id+'\',this)">\u2764\ufe0f <span class="flike-count">'+likes+'</span></button>'+
        '<button class="forum-action-btn" onclick="forumToggleComments(\''+id+'\')">💬 <span id="fcmt_count_'+id+'">'+comments+'</span></button>'+
        '<button class="forum-action-btn" onclick="forumShare(\''+id+'\',\''+_esc(data.text||'')+'\')">↪\ufe0f Partager</button>'+
      '</div>'+
      '<div class="forum-comments-section" id="fcmts_'+id+'">'+
        '<div id="fcmts_list_'+id+'" style="margin-bottom:0.4rem;"></div>'+
        (_isLoggedIn()?
          '<div class="forum-comment-input-row">'+
            '<div class="forum-card-avatar" style="width:28px;height:28px;font-size:0.65rem;">'+_esc(_letter(_pseudo()))+'</div>'+
            '<textarea class="forum-comment-input" id="fcmt_inp_'+id+'" placeholder="Votre commentaire\u2026 \U0001f60a" rows="1" oninput="this.style.height=\'auto\';this.style.height=Math.min(this.scrollHeight,90)+\'px\'"></textarea>'+
            '<button class="forum-comment-send" onclick="forumSendComment(\''+id+'\')">\u27a4</button>'+
          '</div>':
          '<div style="font-size:0.72rem;color:var(--muted);text-align:center;padding:0.4rem;">🔒 Connectez-vous pour commenter</div>'
        )+
      '</div>';
    return el;
  }

  /* ══════════════════════════════════════════
     OUVRIR MODAL PUBLICATION
  ══════════════════════════════════════════ */
  window.forumOpenPublish = function(type){
    // Vérification connexion AVANT d'ouvrir le modal
    if(!_isLoggedIn()){
      // Afficher invitation d'inscription
      var inv = document.getElementById('forumInviteOverlay');
      if(inv){ inv.style.display='flex'; return; }
      // Fallback : ouvrir modal connexion
      if(typeof window.openModal==='function') window.openModal('loginModal');
      else _toast('🔒 Connectez-vous ou inscrivez-vous pour publier');
      return;
    }
    var modal = document.getElementById('forumPubModal');
    if(!modal) return;
    _fm.photos = [];
    _fm.photoFiles = [];
    _fm.video = null;
    _fm.videoFile = null;
    _fm.videoBlob = null;
    _fm.type = type||'ambiance';
    _fm.mood = '🔥';
    _fm.submitting = false;
    // Reset UI
    var ta = document.getElementById('forumPubTextarea'); if(ta) ta.value='';
    var cc = document.getElementById('forumPubCharCount'); if(cc) cc.textContent='0';
    var prev = document.getElementById('forumPubMediaPreview'); if(prev) prev.innerHTML='';
    var ep = document.getElementById('forumEmojiPanel'); if(ep) ep.style.display='none';
    var sb = document.getElementById('forumSubmitBtn'); if(sb){ sb.disabled=false; sb.textContent='🚀 Publier'; }
    var lb = document.getElementById('forumDailyLimitBanner'); if(lb) lb.style.display='none';
    // Update type chips
    document.querySelectorAll('.forum-type-chip').forEach(function(c){ c.classList.remove('active'); });
    var chip = document.querySelector('.forum-type-chip[onclick*="\''+_fm.type+'\'"]');
    if(chip) chip.classList.add('active');
    // Update counters
    _updateModalCounters();
    modal.style.display='flex'; modal.classList.add('open'); alert('modal affiche, display=' + modal.style.display + ' classes=' + modal.className);
    document.body.style.overflow='hidden';
  };

  window.forumClosePubModal = function(){
    var modal = document.getElementById('forumPubModal');
    if(modal){ modal.classList.remove('open'); modal.style.display='none'; }
    document.body.style.overflow='';
  };

  function _updateModalCounters(){
    var pc = _todayPhotoCount(); var vc = _todayVideoCount();
    var el_p = document.getElementById('forumDailyPhotos'); if(el_p) el_p.textContent=pc;
    var el_v = document.getElementById('forumDailyVideos'); if(el_v) el_v.textContent=vc;
    _renderDotsBar('forumPhotoDotsBar', pc, 5, false);
    _renderDotsBar('forumVideoDotsBar', vc, 2, true);
    var pc2 = document.getElementById('forumPhotoCount'); if(pc2) pc2.textContent='('+_fm.photos.length+'/'+Math.max(0,5-pc)+')';
    var vc2 = document.getElementById('forumVideoCount'); if(vc2) vc2.textContent='('+(_fm.video?'1':'0')+'/'+Math.max(0,2-vc)+')';
  }

  function _renderDotsBar(id, used, max, isVideo){
    var el = document.getElementById(id); if(!el) return;
    el.innerHTML='';
    for(var i=0;i<max;i++){
      var d=document.createElement('div');
      d.className='forum-daily-dot'+(isVideo?' vid':'')+(i<used?' used':'');
      el.appendChild(d);
    }
  }

  /* ── Types / Mood ── */
  window.forumSelectType = function(type, btn){
    _fm.type = type;
    document.querySelectorAll('.forum-type-chip').forEach(function(c){ c.classList.remove('active'); });
    if(btn) btn.classList.add('active');
  };
  window.forumSelectMood = function(emoji, btn){
    _fm.mood = emoji;
    document.querySelectorAll('#forumPubModal .forum-type-chip[onclick*="forumSelectMood"]').forEach(function(c){ c.classList.remove('active'); });
    if(btn) btn.classList.add('active');
  };

  /* ── Textarea ── */
  window.forumPubTextInput = function(ta){
    var cc = document.getElementById('forumPubCharCount'); if(cc) cc.textContent=ta.value.length;
  };

  /* ── Emoji ── */
  window.forumPickEmoji = function(){
    var ep = document.getElementById('forumEmojiPanel');
    if(!ep) return;
    _fm.emojiPanelOpen = !_fm.emojiPanelOpen;
    ep.style.display = _fm.emojiPanelOpen ? 'block' : 'none';
  };
  window.forumInsertEmoji = function(emoji){
    var ta = document.getElementById('forumPubTextarea'); if(!ta) return;
    var s=ta.selectionStart, e=ta.selectionEnd;
    ta.value = ta.value.slice(0,s)+emoji+ta.value.slice(e);
    ta.selectionStart = ta.selectionEnd = s+emoji.length;
    ta.focus();
    var cc=document.getElementById('forumPubCharCount'); if(cc) cc.textContent=ta.value.length;
  };

  /* ── Photos ── */
  window.forumOnPhotosSelected = function(inp){
    var remain = 5 - _todayPhotoCount() - _fm.photos.length;
    if(remain <= 0){ _toast('📷 Limite 5 photos/jour atteinte'); inp.value=''; return; }
    var files = Array.from(inp.files||[]).slice(0, remain);
    files.forEach(function(file){
      if(!file.type.startsWith('image/')){ _toast('⚠️ Fichier non supporté'); return; }
      _fm.photoFiles.push(file);
      var reader = new FileReader();
      reader.onload = function(ev){
        _fm.photos.push(ev.target.result);
        _renderMediaPreview();
        _updateModalCounters();
      };
      reader.readAsDataURL(file);
    });
    inp.value='';
  };

  /* ── Vidéo ── */
  window.forumOnVideoSelected = function(inp){
    if(_todayVideoCount() + (_fm.video?1:0) >= 2){ _toast('🎬 Limite 2 vidéos/jour atteinte'); inp.value=''; return; }
    var file = inp.files[0]; if(!file) return;
    if(!file.type.startsWith('video/')){ _toast('⚠️ Fichier vidéo uniquement'); inp.value=''; return; }
    if(file.size > 50*1024*1024){ _toast('⚠️ Vidéo trop lourde (50 Mo max)'); inp.value=''; return; }
    // ── Vérification durée 40 secondes max ──
    var blobUrl = URL.createObjectURL(file);
    var tmpVid = document.createElement('video');
    tmpVid.preload = 'metadata';
    tmpVid.onloadedmetadata = function(){
      if(tmpVid.duration > 40){
        URL.revokeObjectURL(blobUrl);
        _toast('⏱️ Vidéo trop longue — 40 secondes maximum');
        inp.value='';
        return;
      }
      _fm.videoBlob = blobUrl;
      _fm.videoFile = file;
      var reader = new FileReader();
      reader.onload = function(ev){ _fm.video = ev.target.result; _renderMediaPreview(); _updateModalCounters(); };
      reader.readAsDataURL(file);
      inp.value='';
    };
    tmpVid.onerror = function(){
      // Si on ne peut pas lire les metadata, on laisse passer (vérification côté client échouée)
      _fm.videoBlob = blobUrl;
      _fm.videoFile = file;
      var reader = new FileReader();
      reader.onload = function(ev){ _fm.video = ev.target.result; _renderMediaPreview(); _updateModalCounters(); };
      reader.readAsDataURL(file);
      inp.value='';
    };
    tmpVid.src = blobUrl;
  };

  function _renderMediaPreview(){
    var prev = document.getElementById('forumPubMediaPreview'); if(!prev) return;
    prev.innerHTML='';
    // Vidéo
    if(_fm.videoBlob){
      var vd=document.createElement('div');
      vd.style.cssText='position:relative;width:100%;border-radius:12px;overflow:hidden;margin-bottom:0.4rem;';
      vd.innerHTML='<video src="'+_fm.videoBlob+'" controls style="width:100%;max-height:200px;display:block;background:#000;" preload="metadata"></video>'+
        '<button onclick="forumRemoveVideo()" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.7);border:none;border-radius:50%;color:#fff;width:26px;height:26px;font-size:0.7rem;cursor:pointer;">✕</button>';
      prev.appendChild(vd);
    }
    // Photos
    _fm.photos.forEach(function(src,i){
      var div=document.createElement('div');
      div.style.cssText='position:relative;width:80px;height:80px;border-radius:10px;overflow:hidden;';
      div.innerHTML='<img src="'+src+'" style="width:100%;height:100%;object-fit:cover;">'+
        '<button onclick="forumRemovePhoto('+i+')" style="position:absolute;top:2px;right:2px;background:rgba(0,0,0,0.7);border:none;border-radius:50%;color:#fff;width:20px;height:20px;font-size:0.6rem;cursor:pointer;">✕</button>';
      prev.appendChild(div);
    });
  }
  window.forumRemovePhoto = function(i){ _fm.photos.splice(i,1); _fm.photoFiles.splice(i,1); _renderMediaPreview(); _updateModalCounters(); };
  window.forumRemoveVideo = function(){ _fm.video=null; _fm.videoFile=null; if(_fm.videoBlob){ URL.revokeObjectURL(_fm.videoBlob); _fm.videoBlob=null; } _renderMediaPreview(); _updateModalCounters(); };

  /* ══════════════════════════════════════════
     SOUMETTRE LA PUBLICATION
  ══════════════════════════════════════════ */
  window.forumSubmitPost = function(){
    if(!_isLoggedIn()){ _toast('🔒 Connectez-vous pour publier'); forumClosePubModal(); if(typeof window.openModal==='function') window.openModal('loginModal'); return; }
    if(_fm.submitting) return;
    var ta = document.getElementById('forumPubTextarea');
    var text = ta ? ta.value.trim() : '';
    if(!text && !_fm.photos.length && !_fm.video){ _toast('✍️ Ajoutez du texte, une photo ou une vidéo'); return; }
    // Vérifs limites
    var pc = _todayPhotoCount(), vc = _todayVideoCount();
    if(_fm.photoFiles.length && pc + _fm.photoFiles.length > 5){ _toast('📷 Limite de 5 photos/jour atteinte'); return; }
    if(_fm.videoFile && vc >= 2){ _toast('🎬 Limite de 2 vidéos/jour atteinte'); return; }
    _fm.submitting = true;
    var sb = document.getElementById('forumSubmitBtn'); if(sb){ sb.disabled=true; sb.textContent='⏳ Envoi des médias…'; }
    var pseudo = _pseudo(), uid = _uid(), ts = Date.now();

    function _forumUploadOne(file, folder){
      if(!window.fbStorage || !window.fbRef || !window.fbUploadBytes || !window.fbGetDownloadURL){
        return Promise.reject(new Error('Upload media indisponible'));
      }
      var ext = (file.type.split('/')[1]||'jpg').replace(/[^a-z0-9]/gi,'');
      var path = folder+'/'+uid+'_'+ts+'_'+Math.random().toString(36).slice(2,8)+'.'+ext;
      var ref = window.fbRef(window.fbStorage, path);
      return window.fbUploadBytes(ref, file).then(function(){
        return window.fbGetDownloadURL(ref);
      });
    }

    var photoUploads = _fm.photoFiles.map(function(f){ return _forumUploadOne(f, 'forum/photos'); });
    var videoUpload = _fm.videoFile ? _forumUploadOne(_fm.videoFile, 'forum/videos') : Promise.resolve(null);

    Promise.all(photoUploads).then(function(photoUrls){
      return videoUpload.then(function(videoUrl){ return { photoUrls: photoUrls, videoUrl: videoUrl }; });
    }).then(function(res){
      if(sb) sb.textContent='⏳ Publication…';
      var pubData = {
        type: _fm.type,
        mood: _fm.mood,
        text: text,
        pseudo: pseudo,
        author: pseudo,
        uid: uid,
        authorUid: uid,
        timestamp: ts,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        photos: res.photoUrls,
        video: res.videoUrl || null,
        hasVideo: !!res.videoUrl,
        visibility: 'public',
        expiresAt: null
      };
      if(res.videoUrl) pubData.expiresAt = new Date(ts + 2*24*60*60*1000).toISOString();
      if(_col() && window.fbAddDoc){
        return window.fbAddDoc(_col(), pubData).then(function(ref){
          _incPhotoCount(res.photoUrls.length);
          if(res.videoUrl) _incVideoCount();
          _toast('🚀 Publication partagée avec la communauté !');
          forumClosePubModal();
          var feed = document.getElementById('forumFeed');
          if(feed){
            var card = _buildCard(ref.id, pubData);
            card.classList.add('new-post');
            var firstCard = feed.querySelector('.forum-card');
            if(firstCard) feed.insertBefore(card, firstCard);
            else feed.insertBefore(card, feed.firstChild);
            var empty = document.getElementById('forumFeedEmpty'); if(empty) empty.style.display='none';
            var hpc = document.getElementById('heroPostsCount');
            if(hpc){ var n=parseInt(hpc.textContent)||0; hpc.textContent=n+1; }
          }
          _fm.submitting=false;
        });
      } else {
        var feed2 = document.getElementById('forumFeed');
        if(feed2){
          var card2 = _buildCard('local_'+ts, pubData);
          feed2.insertBefore(card2, feed2.firstChild);
          var empty2 = document.getElementById('forumFeedEmpty'); if(empty2) empty2.style.display='none';
        }
        _toast('✅ Publication ajoutée (mode local)');
        forumClosePubModal();
        _fm.submitting=false;
      }
    }).catch(function(e){
      _toast('❌ Erreur lors de l\'envoi : '+(e && e.message ? e.message : 'inconnue'));
      if(sb){ sb.disabled=false; sb.textContent='🚀 Publier'; }
      _fm.submitting=false;
    });
  };

  /* ══════════════════════════════════════════
     LIKES
  ══════════════════════════════════════════ */
  window.forumToggleLike = function(id, btn){
    if(!btn) return;
    if(!_isLoggedIn()){
      _toast('🔒 Connectez-vous pour liker');
      return;
    }
    var liked = btn.classList.toggle('liked');
    var countEl = btn.querySelector('.flike-count');
    var count = parseInt(countEl ? countEl.textContent : '0') || 0;
    countEl.textContent = liked ? count+1 : Math.max(0,count-1);
    if(!_col() || !window.fbDoc || !window.fbUpdateDoc || !window.fbIncrement) return;
    try{
      window.fbUpdateDoc(window.fbDoc(window.db,'forum_publications',id),{
        likes: window.fbIncrement(liked ? 1 : -1)
      }).catch(function(){});
    }catch(e){}
  };

  /* ══════════════════════════════════════════
     COMMENTAIRES
  ══════════════════════════════════════════ */
  window.forumToggleComments = function(id){
    var sec = document.getElementById('fcmts_'+id); if(!sec) return;
    var open = sec.style.display==='block';
    sec.style.display = open ? 'none' : 'block';
    if(!open) _loadComments(id);
  };

  function _loadComments(pubId){
    var list = document.getElementById('fcmts_list_'+pubId); if(!list) return;
    if(!_col() || !window.fbQuery || !window.fbOrderBy || !window.fbGetDocs) return;
    try{
      var cmtCol = window.fbCollection(window.db,'forum_publications',pubId,'comments');
      var q = window.fbQuery(cmtCol, window.fbOrderBy('timestamp','asc'), window.fbLimit(30));
      window.fbGetDocs(q).then(function(snap){
        list.innerHTML='';
        snap.docs.forEach(function(d){
          var data=d.data();
          list.appendChild(_buildComment(data, pubId, d.id));
        });
      }).catch(function(){});
    }catch(e){}
  }

  function _buildComment(data, pubId, cmtId){
    var div=document.createElement('div');
    div.className='forum-comment';
    if(cmtId) div.setAttribute('data-cmt-id', cmtId);
    var isAuthor = data.uid && data.uid === (window.currentUserUID||'__');
    var isAdmin  = window.currentUserRole==='admin' || window.currentUserRole==='superadmin';
    var canDel   = (isAuthor || isAdmin) && pubId && cmtId;
    var delBtn   = canDel
      ? '<button onclick="forumDeleteComment(\''+pubId+'\',\''+cmtId+'\',this)" style="background:none;border:none;color:rgba(255,68,102,0.55);font-size:0.72rem;cursor:pointer;padding:0.1rem 0.25rem;transition:color 0.15s;margin-left:auto;align-self:flex-start;flex-shrink:0;" title="Supprimer" onmouseover="this.style.color=\'#ff4466\'" onmouseout="this.style.color=\'rgba(255,68,102,0.55)\'">🗑</button>'
      : '';
    div.innerHTML='<div class="forum-comment-avatar">'+_esc(_letter(data.pseudo||'?'))+'</div>'+
      '<div class="forum-comment-bubble" style="flex:1;">'+
        '<div class="forum-comment-author">'+_esc(data.pseudo||'Utilisateur')+'</div>'+
        '<div class="forum-comment-text">'+_esc(data.text||'')+'</div>'+
      '</div>'+
      delBtn;
    return div;
  }

  window.forumDeleteComment = function(pubId, cmtId, btn){
    var row = btn ? btn.closest('.forum-comment') : null;
    if(!_col() || !window.fbDoc || !window.fbDeleteDoc){
      if(row) row.remove();
      // décrémenter compteur local
      var ccEl = document.getElementById('fcmt_count_'+pubId);
      if(ccEl) ccEl.textContent = Math.max(0, parseInt(ccEl.textContent||'0')-1);
      return;
    }
    try{
      var cmtRef = window.fbDoc(window.db,'forum_publications',pubId,'comments',cmtId);
      window.fbDeleteDoc(cmtRef).then(function(){
        if(row) row.remove();
        var ccEl = document.getElementById('fcmt_count_'+pubId);
        if(ccEl) ccEl.textContent = Math.max(0, parseInt(ccEl.textContent||'0')-1);
        if(window.fbDoc && window.fbUpdateDoc && window.fbIncrement){
          window.fbUpdateDoc(window.fbDoc(window.db,'forum_publications',pubId),{comments:window.fbIncrement(-1)}).catch(function(){});
        }
        _toast('🗑️ Commentaire supprimé');
      }).catch(function(e){ _toast('❌ '+e.message); });
    }catch(e){ _toast('❌ '+e.message); }
  };

  window.forumSendComment = function(pubId){
    if(!_isLoggedIn()){ _toast('🔒 Connectez-vous pour commenter'); return; }
    var inp = document.getElementById('fcmt_inp_'+pubId); if(!inp) return;
    var text = inp.value.trim(); if(!text) return;
    inp.value=''; inp.style.height='auto';
    var cmtData = { text:text, pseudo:_pseudo(), uid:_uid(), timestamp:Date.now() };
    // Afficher immédiatement (sans ID définitif, donc pas de bouton supprimer pour l'instant)
    var list = document.getElementById('fcmts_list_'+pubId);
    if(list) list.appendChild(_buildComment(cmtData, pubId, null));
    // Incrémenter compteur local
    var ccEl = document.getElementById('fcmt_count_'+pubId);
    if(ccEl) ccEl.textContent = parseInt(ccEl.textContent||'0')+1;
    // Sauvegarder Firebase
    if(!_col() || !window.fbAddDoc) return;
    try{
      var cmtCol = window.fbCollection(window.db,'forum_publications',pubId,'comments');
      window.fbAddDoc(cmtCol, cmtData).then(function(ref){
        // Remplacer le commentaire temporaire par la version avec ID
        if(list){
          var tmpNodes = list.querySelectorAll('.forum-comment:not([data-cmt-id])');
          if(tmpNodes.length){
            var lastTmp = tmpNodes[tmpNodes.length-1];
            var withId = _buildComment(cmtData, pubId, ref.id);
            list.replaceChild(withId, lastTmp);
          }
        }
        if(window.fbDoc && window.fbUpdateDoc && window.fbIncrement){
          window.fbUpdateDoc(window.fbDoc(window.db,'forum_publications',pubId),{comments:window.fbIncrement(1)}).catch(function(){});
        }
      }).catch(function(){});
    }catch(e){}
  };

  /* ══════════════════════════════════════════
     PARTAGER
  ══════════════════════════════════════════ */
  window.forumShare = function(id, text){
    var url = window.location.href.split('#')[0]+'#forum_pub_'+id;
    if(navigator.share){ navigator.share({title:'AMBI241',text:text||'Ambiance Libreville',url:url}).catch(function(){}); }
    else { try{navigator.clipboard.writeText(url);_toast('🔗 Lien copié !');}catch(e){} }
  };

  /* ══════════════════════════════════════════
     MORE MENU
  ══════════════════════════════════════════ */
  window.forumMoreMenu = function(id, btn){
    // Créer ou récupérer le menu dropdown
    var existing = document.getElementById('forumMoreMenuDrop');
    if(existing) existing.remove();

    var pub = document.querySelector('[data-pub-id="'+id+'"]');
    var isAuthor = pub && pub.getAttribute('data-author-uid') === (window.currentUserUID||'__');
    var isAdmin = window.currentUserRole==='admin' || window.currentUserRole==='superadmin';
    var canDelete = isAuthor || isAdmin;

    var menu = document.createElement('div');
    menu.id = 'forumMoreMenuDrop';
    menu.style.cssText = 'position:fixed;z-index:1000;background:#2c1040;border:1px solid rgba(255,45,155,0.28);border-radius:14px;padding:0.35rem;min-width:168px;box-shadow:0 10px 36px rgba(0,0,0,0.55);animation:fmMenuPop 0.17s cubic-bezier(0.34,1.56,0.64,1);';

    var items = [
      { icon:'🔗', label:'Copier le lien', action: function(){ forumShare(id,''); menu.remove(); } },
      { icon:'🚩', label:'Signaler', action: function(){ _toast('🚩 Publication signalée'); menu.remove(); } },
    ];
    if(canDelete) items.push({ icon:'🗑️', label:'Supprimer', danger:true, action: function(){
      menu.remove();
      _forumConfirmDelete(id);
    }});

    items.forEach(function(it, idx){
      if(it.danger && idx > 0){
        var div=document.createElement('div');
        div.style.cssText='height:1px;background:rgba(255,255,255,0.07);margin:0.2rem 0;';
        menu.appendChild(div);
      }
      var el=document.createElement('div');
      el.style.cssText='display:flex;align-items:center;gap:0.5rem;padding:0.55rem 0.75rem;border-radius:10px;cursor:pointer;font-size:0.8rem;font-weight:600;color:'+(it.danger?'#ff4466':'#fff0f8')+';transition:background 0.13s;';
      el.innerHTML='<span>'+it.icon+'</span><span>'+it.label+'</span>';
      el.onmouseover=function(){ this.style.background=it.danger?'rgba(255,68,102,0.12)':'rgba(255,255,255,0.07)'; };
      el.onmouseout=function(){ this.style.background='transparent'; };
      el.onclick=it.action;
      menu.appendChild(el);
    });

    // Injecter keyframes si pas encore présent
    if(!document.getElementById('fmMenuKeyframes')){
      var s=document.createElement('style'); s.id='fmMenuKeyframes';
      s.textContent='@keyframes fmMenuPop{from{opacity:0;transform:scale(0.88) translateY(-4px)}to{opacity:1;transform:scale(1) translateY(0)}}';
      document.head.appendChild(s);
    }

    document.body.appendChild(menu);

    // Positionner près du bouton ⋯
    var rect = btn.getBoundingClientRect ? btn.getBoundingClientRect() : {bottom:100,right:100};
    var mw = 168;
    var left = Math.min(rect.right - mw, window.innerWidth - mw - 8);
    menu.style.top = (rect.bottom + 6) + 'px';
    menu.style.left = Math.max(8, left) + 'px';

    // Fermer au clic extérieur
    setTimeout(function(){
      document.addEventListener('click', function _close(e){
        if(!menu.contains(e.target)){ menu.remove(); document.removeEventListener('click',_close); }
      });
    }, 50);
  };

  function _forumConfirmDelete(id){
    // Mini modal de confirmation propre
    var overlay = document.createElement('div');
    overlay.style.cssText='position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML=
      '<div style="background:#230d35;border:1.5px solid rgba(255,68,102,0.35);border-radius:20px;padding:1.4rem 1.3rem;max-width:300px;width:100%;text-align:center;animation:fmMenuPop 0.2s cubic-bezier(0.34,1.56,0.64,1);">'+
        '<div style="font-size:2rem;margin-bottom:0.6rem;">🗑️</div>'+
        '<div style="font-family:\'Syne\',sans-serif;font-size:0.95rem;font-weight:800;margin-bottom:0.4rem;">Supprimer ?</div>'+
        '<div style="font-size:0.78rem;color:#b088c0;margin-bottom:1.1rem;line-height:1.5;">Cette publication sera définitivement supprimée.</div>'+
        '<div style="display:flex;gap:0.6rem;">'+
          '<button id="_fmCancelDel" style="flex:1;padding:0.65rem;border-radius:12px;border:1.5px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.05);color:#fff0f8;font-weight:700;cursor:pointer;font-size:0.82rem;">Annuler</button>'+
          '<button id="_fmConfirmDel" style="flex:1;padding:0.65rem;border-radius:12px;border:none;background:linear-gradient(135deg,#ff4466,#cc1133);color:#fff;font-weight:800;cursor:pointer;font-size:0.82rem;">Supprimer</button>'+
        '</div>'+
      '</div>';
    document.body.appendChild(overlay);
    document.getElementById('_fmCancelDel').onclick = function(){ overlay.remove(); };
    document.getElementById('_fmConfirmDel').onclick = function(){
      overlay.remove();
      var card = document.querySelector('[data-pub-id="'+id+'"]');
      if(_col() && window.fbDoc && window.fbDeleteDoc){
        window.fbDeleteDoc(window.fbDoc(window.db,'forum_publications',id)).then(function(){
          if(card) card.remove(); _toast('🗑️ Publication supprimée');
        }).catch(function(e){ _toast('❌ '+e.message); });
      } else { if(card) card.remove(); _toast('🗑️ Supprimé (local)'); }
    };
    overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };
  }

  /* ══════════════════════════════════════════
     LIGHTBOX — prev/next + photo + vidéo
  ══════════════════════════════════════════ */
  var _lbItems = [];
  var _lbIdx   = 0;

  window.forumLightbox = function(pubId, mediaIdx){
    var card = document.querySelector('[data-pub-id="'+pubId+'"]');
    if(!card) return;

    // Collecter tous les médias de la card (photos + vidéos)
    _lbItems = [];
    card.querySelectorAll('.fcm-item[data-src]').forEach(function(el){
      _lbItems.push({ src: el.getAttribute('data-src'), type: el.getAttribute('data-mtype')||'photo' });
    });
    // Fallback : images simples si pas de data-src
    if(!_lbItems.length){
      card.querySelectorAll('.forum-card-img').forEach(function(el){
        _lbItems.push({ src: el.src, type:'photo' });
      });
      card.querySelectorAll('.forum-card-video').forEach(function(el){
        _lbItems.push({ src: el.src||el.currentSrc, type:'video' });
      });
    }
    if(!_lbItems.length) return;

    _lbIdx = Math.min(mediaIdx||0, _lbItems.length-1);
    _lbRender();

    var lb = document.getElementById('forumLightbox');
    lb.style.display='flex';
    document.body.style.overflow='hidden';
  };

  function _lbRender(){
    var item = _lbItems[_lbIdx];
    if(!item) return;
    var img = document.getElementById('forumLightboxImg');
    var vid = document.getElementById('forumLightboxVid');
    var ctr = document.getElementById('forumLbCounter');
    var prev = document.getElementById('forumLbPrev');
    var next = document.getElementById('forumLbNext');

    if(item.type==='video'){
      img.style.display='none'; img.src='';
      vid.style.display='block'; vid.src=item.src;
      vid.play().catch(function(){});
    } else {
      vid.style.display='none'; vid.pause(); vid.src='';
      img.style.display='block'; img.src=item.src;
    }

    if(ctr) ctr.textContent = _lbItems.length > 1 ? (_lbIdx+1)+' / '+_lbItems.length : '';
    if(prev) prev.style.display = _lbIdx > 0 ? 'flex' : 'none';
    if(next) next.style.display = _lbIdx < _lbItems.length-1 ? 'flex' : 'none';
  }

  window.forumLbNav = function(dir){
    _lbIdx = Math.max(0, Math.min(_lbItems.length-1, _lbIdx+dir));
    _lbRender();
  };

  window.forumLightboxClose = function(){
    var lb = document.getElementById('forumLightbox');
    lb.style.display='none';
    document.body.style.overflow='';
    var vid = document.getElementById('forumLightboxVid');
    if(vid){ vid.pause(); vid.src=''; }
  };

  // Navigation clavier
  document.addEventListener('keydown', function(e){
    var lb = document.getElementById('forumLightbox');
    if(!lb || lb.style.display==='none') return;
    if(e.key==='ArrowLeft')  forumLbNav(-1);
    if(e.key==='ArrowRight') forumLbNav(1);
    if(e.key==='Escape')     forumLightboxClose();
  });

  /* ══════════════════════════════════════════
     SYNC AUTH STATE
  ══════════════════════════════════════════ */
  // Ré-init quand l'auth change
  var _authWatcher = setInterval(function(){
    var cb = document.getElementById('forumComposeBar');
    if(!cb) return;
    _updateComposeBar();
  }, 2000);

  /* ══════════════════════════════════════════
     SYNC AVEC SOC-TABS (rendre l'onglet Amis actif par défaut)
  ══════════════════════════════════════════ */
  var _origSocSwitchTab = window.socSwitchTab;
  window.socSwitchTab = function(tab){
    if(typeof _origSocSwitchTab==='function') _origSocSwitchTab(tab);
    // Mettre à jour le tab Amis comme actif
    var tabs = document.querySelectorAll('.soc-tab');
    tabs.forEach(function(t){ t.classList.remove('active'); });
    if(tab==='amis'){
      var t=document.getElementById('socTabAmis'); if(t) t.classList.add('active');
    }
  };

  /* ══════════════════════════════════════════
     EXPOSITION DES FONCTIONS NÉCESSAIRES AU SWITCH TAB
  ══════════════════════════════════════════ */
  // Assurer que socSwitchTab gère bien 'amis' pour afficher pane-amis
  var _origSocSwitchTab2 = window.socSwitchTab;
  window.socSwitchTab = function(tab){
    // Cacher tous les panes
    document.querySelectorAll('.soc-pane').forEach(function(p){ p.classList.remove('active'); });
    var pane = document.getElementById('pane-'+tab);
    if(pane) pane.classList.add('active');
    // Mettre à jour les tabs
    document.querySelectorAll('.soc-tab').forEach(function(t){ t.classList.remove('active'); });
    // Trouver le tab correspondant
    var found = Array.from(document.querySelectorAll('.soc-tab')).find(function(t){ return t.getAttribute('onclick') && t.getAttribute('onclick').indexOf("'"+tab+"'")!==-1; });
    if(found) found.classList.add('active');
  };

  /* ══════════════════════════════════════════
     DÉMARRAGE — robuste, attend Firebase
  ══════════════════════════════════════════ */

  // Fonction idempotente exposée pour le lazy-init de switchSection('social')
  var _forumInited = false;
  window._initForumOnce = function(){
    if(_forumInited) return;
    _forumInited = true;
    initForum();
  };

  // Fallback au chargement : attendre que Firebase soit prêt (max 8 × 700ms)
  var _fbWaitTries = 0;
  function _waitFirebaseThenInit(){
    if(_forumInited) return;
    if(window.db && window.fbCollection){
      window._initForumOnce();
    } else if(_fbWaitTries++ < 8){
      setTimeout(_waitFirebaseThenInit, 700);
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(_waitFirebaseThenInit, 800); });
  } else {
    setTimeout(_waitFirebaseThenInit, 800);
  }
})();
