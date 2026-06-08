(function(){
'use strict';

/* ═══════════════════════════════════════════════════════════
   STYLES SUPPLÉMENTAIRES
═══════════════════════════════════════════════════════════ */
var _proStyle = document.createElement('style');
_proStyle.textContent = `
/* Bouton like actif */
.socpub-action-btn.like.active { color: var(--pink) !important; }
.socpub-action-btn.like.active .socpub-action-icon { filter: drop-shadow(0 0 4px rgba(255,45,155,0.7)); }

/* Barre réactions emoji */
.sp-emoji-bar {
  display: none; gap: 0.35rem; flex-wrap: wrap;
  background: var(--surface2); border: 1px solid rgba(255,45,155,0.25);
  border-radius: 14px; padding: 0.45rem 0.6rem; margin: 0.25rem 0 0.5rem;
}
.sp-emoji-bar.open { display: flex; }
.sp-emoji-btn {
  font-size: 1.25rem; cursor: pointer; border: none; background: none;
  padding: 0.1rem 0.25rem; border-radius: 8px; transition: transform 0.15s;
  position: relative;
}
.sp-emoji-btn:active { transform: scale(1.35); }
.sp-emoji-count {
  position: absolute; bottom: -4px; right: -4px;
  background: var(--pink); color: #fff; font-size: 0.45rem;
  font-weight: 800; border-radius: 10px; padding: 0 3px; min-width: 12px;
  text-align: center; line-height: 12px; pointer-events: none;
  display: none;
}
.sp-emoji-count.has-count { display: block; }

/* Commentaires pros */
.socpub-comment { animation: fadeUp 0.2s ease; }
/* @keyframes fadeUp — défini globalement */
.socpub-comment-del {
  background: none; border: none; color: var(--red); cursor: pointer;
  font-size: 0.65rem; padding: 0.1rem 0.3rem; border-radius: 5px;
  opacity: 0.6; transition: opacity 0.15s;
}
.socpub-comment-del:hover { opacity: 1; }

/* Partage — compteur */
.sp-share-count {
  font-size: 0.7rem; color: var(--muted); margin-left: 0.2rem;
}
`;
document.head.appendChild(_proStyle);

/* ═══════════════════════════════════════════════════════════
   CACHE LOCAL LIKES
═══════════════════════════════════════════════════════════ */
var _likedPubs   = new Set();   // pubIds likés par l'utilisateur courant
var _likesLoaded = false;

/** Charger tous les likes de l'utilisateur depuis userLikes */
function _loadUserLikes(uid){
  if(!uid || !window.db || !window.fbQuery || !window.fbCollection ||
     !window.fbWhere || !window.fbGetDocs) return;
  window.fbGetDocs(
    window.fbQuery(
      window.fbCollection(window.db,'userLikes'),
      window.fbWhere('uid','==',uid)
    )
  ).then(function(snap){
    _likedPubs.clear();
    snap.forEach(function(d){ _likedPubs.add(d.data().pubId); });
    _likesLoaded = true;
    _applyLikeStates();
  }).catch(function(){});
}

/** Mettre en rose tous les boutons déjà likés dans le DOM */
function _applyLikeStates(){
  _likedPubs.forEach(function(pubId){
    var btn = document.querySelector(
      '.socpub-action-btn.like[onclick*="\''+pubId+'\'"], '+
      '.socpub-action-btn.like[onclick*="\"'+pubId+'\""]'
    );
    if(btn && !btn.classList.contains('active')){
      btn.classList.add('active');
      btn.style.color = 'var(--pink)';
    }
  });
}

/** Observer currentUserUID pour déclencher le chargement */
(function(){
  var _watchInterval = setInterval(function(){
    if(window.currentUserUID){
      clearInterval(_watchInterval);
      _loadUserLikes(window.currentUserUID);
    }
  }, 600);
  // Écouter aussi après chaque render de feed
  var _origRender = window._socFeedRender;
  setTimeout(function(){
    if(_likesLoaded) _applyLikeStates();
  }, 1200);
})();

// Patcher le feed render pour re-appliquer les états après chaque refresh
var _patchApplyOnRender = setInterval(function(){
  if(typeof window._socFeedRender === 'function'){
    clearInterval(_patchApplyOnRender);
    var _orig = window._socFeedRender;
    window._socFeedRender = function(){
      _orig.apply(this, arguments);
      setTimeout(_applyLikeStates, 150);
    };
  }
  if(document.getElementById('socPubFeed')){
    clearInterval(_patchApplyOnRender);
    var _obs = new MutationObserver(function(){ if(_likesLoaded) setTimeout(_applyLikeStates,80); });
    _obs.observe(document.getElementById('socPubFeed'),{childList:true,subtree:false});
  }
}, 800);

/* ═══════════════════════════════════════════════════════════
   ❤️  LIKES — NIVEAU PROFESSIONNEL
═══════════════════════════════════════════════════════════ */
window.socPubToggleLike = function(pubId, btn){
  if(!btn) return;
  if(!window.currentUserUID){
    if(typeof window.showToast==='function') window.showToast('🔒 Connectez-vous pour liker !');
    return;
  }
  var uid      = window.currentUserUID;
  var wasLiked = _likedPubs.has(pubId);
  var countEl  = document.getElementById('likeCount_'+pubId)
               || btn.querySelector('.socpub-action-count');
  var prevN    = countEl ? (parseInt(countEl.textContent)||0) : 0;
  var newN     = wasLiked ? Math.max(0, prevN-1) : prevN+1;

  /* ── Mise à jour optimiste ── */
  if(wasLiked){ _likedPubs.delete(pubId); btn.classList.remove('active'); btn.style.color=''; }
  else         { _likedPubs.add(pubId);   btn.classList.add('active');    btn.style.color='var(--pink)'; }
  if(countEl) countEl.textContent = newN;

  /* Animation */
  btn.style.transform = 'scale(1.28)';
  setTimeout(function(){ btn.style.transform=''; }, 200);

  if(typeof window.showToast==='function')
    window.showToast(wasLiked ? '💔 Like retiré' : '❤️ J\'aime !');

  /* ── Sync Firebase ── */
  if(!window.db || !window.fbDoc || !window.fbAddDoc || !window.fbDeleteDoc ||
     !window.fbUpdateDoc || !window.fbFieldIncrement || !window.fbCollection ||
     !window.fbQuery || !window.fbWhere || !window.fbGetDocs){ return; }

  function _rollback(){
    if(wasLiked){ _likedPubs.add(pubId);   btn.classList.add('active');    btn.style.color='var(--pink)'; }
    else         { _likedPubs.delete(pubId); btn.classList.remove('active'); btn.style.color=''; }
    if(countEl) countEl.textContent = prevN;
    if(typeof window.showToast==='function') window.showToast('⚠️ Erreur réseau — like restauré');
  }

  if(wasLiked){
    /* Supprimer le doc userLikes + décrémenter */
    window.fbGetDocs(
      window.fbQuery(
        window.fbCollection(window.db,'userLikes'),
        window.fbWhere('uid','==',uid),
        window.fbWhere('pubId','==',pubId)
      )
    ).then(function(snap){
      var dels=[];
      snap.forEach(function(d){ dels.push(window.fbDeleteDoc(d.ref)); });
      return Promise.all(dels);
    }).then(function(){
      return window.fbUpdateDoc(
        window.fbDoc(window.db,'publications',pubId),
        { likes: window.fbFieldIncrement(-1) }
      );
    }).catch(_rollback);
  } else {
    /* Créer le doc userLikes + incrémenter */
    var likeData = {
      uid       : uid,
      pubId     : pubId,
      createdAt : window.fbServerTimestamp ? window.fbServerTimestamp() : new Date()
    };
    window.fbAddDoc(window.fbCollection(window.db,'userLikes'), likeData)
    .then(function(){
      return window.fbUpdateDoc(
        window.fbDoc(window.db,'publications',pubId),
        { likes: window.fbFieldIncrement(1) }
      );
    }).catch(_rollback);
  }
};

/* Synchroniser ambi_likePost avec le même système */
window.ambi_likePost = function(pubId, btn){ window.socPubToggleLike(pubId, btn); };

/* ═══════════════════════════════════════════════════════════
   💬  COMMENTAIRES — NIVEAU PROFESSIONNEL
═══════════════════════════════════════════════════════════ */

/** Réactions emoji disponibles */
var _REACTIONS = ['❤️','🔥','👏','😂','😮','💃'];

/** Afficher/masquer la barre emoji d'un commentaire */
window.socToggleEmojiReactions = function(pubId, cmtId){
  var bar = document.getElementById('emojireact_'+cmtId);
  if(bar) bar.classList.toggle('open');
};

/** Réagir à un commentaire (stocké Firebase) */
window.socReactToComment = function(pubId, cmtId, emoji, btn){
  var uid = window.currentUserUID;
  if(!uid){ if(typeof window.showToast==='function') window.showToast('🔒 Connectez-vous !'); return; }

  /* Mise à jour compteur visuel */
  var countEl = btn ? btn.querySelector('.sp-emoji-count') : null;
  if(countEl){
    var n = parseInt(countEl.getAttribute('data-n')||'0')||0;
    n++;
    countEl.setAttribute('data-n', n);
    countEl.textContent = n;
    countEl.classList.add('has-count');
  }
  if(typeof window.showToast==='function') window.showToast(emoji+' Réaction ajoutée !');

  /* Firebase : arrayUnion UID dans le champ de réaction */
  if(!window.db || !window.fbDoc || !window.fbUpdateDoc) return;
  var field = 'reactions.'+emoji.codePointAt(0);
  var upd = {};
  // Utiliser arrayUnion si disponible, sinon setDoc merge
  if(window.fbArrayUnion){
    upd[field] = window.fbArrayUnion(uid);
    window.fbUpdateDoc(
      window.fbDoc(window.db,'publications',pubId,'comments',cmtId), upd
    ).catch(function(){});
  } else {
    /* Fallback : lire puis écrire */
    window.fbGetDoc && window.fbGetDoc(window.fbDoc(window.db,'publications',pubId,'comments',cmtId))
    .then(function(snap){
      var data = snap.exists() ? snap.data() : {};
      var reactions = data.reactions || {};
      var key = emoji.codePointAt(0).toString();
      var arr = reactions[key] || [];
      if(arr.indexOf(uid)===-1) arr.push(uid);
      reactions[key] = arr;
      return window.fbUpdateDoc(snap.ref, { reactions: reactions });
    }).catch(function(){});
  }
};

/** Soumettre un commentaire — version pro avec compteur atomique */
window.socSubmitComment = function(pubId){
  if(!window.currentUserUID){
    if(typeof window.showToast==='function') window.showToast('🔒 Connectez-vous pour commenter');
    return;
  }
  var uid    = window.currentUserUID;
  var pseudo = window.currentUserPseudo || window.currentUserEmail || 'Membre';

  /* Lire le texte depuis l'input visible */
  var inpA = document.getElementById('commentInput_'+pubId);
  var inpB = document.getElementById('pubCmtTxt_'+pubId);
  var text = (inpA ? inpA.value.trim() : '') || (inpB ? inpB.value.trim() : '');
  if(!text) return;

  /* Vider les champs */
  if(inpA) inpA.value = '';
  if(inpB) inpB.value = '';

  /* ── Affichage optimiste ── */
  var list = document.getElementById('commentsList_'+pubId);
  var cmtId = 'tmp_'+Date.now();
  var letter = (pseudo[0]||'?').toUpperCase();
  var cmtHtml = '<div class="socpub-comment" id="cmtItem_'+cmtId+'">'
    +'<div class="socpub-comment-avatar">'+letter+'</div>'
    +'<div class="socpub-comment-body">'
    +'<div class="socpub-comment-author">'+_escPro(pseudo)+' <span class="socpub-comment-time">· À l\'instant</span></div>'
    +'<div class="socpub-comment-text">'+_escPro(text)+'</div>'
    +'<div class="socpub-comment-actions">'
    +'<button onclick="socCommentLike(this)">👍 <span>0</span></button>'
    +'<button onclick="socOpenReply(\''+pubId+'\',\''+cmtId+'\',this)">↩ Répondre</button>'
    +'<button class="socpub-comment-del" onclick="socDeleteComment(\''+pubId+'\',\''+cmtId+'\',\''+uid+'\',this)" title="Supprimer">🗑</button>'
    +'</div></div></div>';
  if(list) list.insertAdjacentHTML('beforeend', cmtHtml);

  /* Mettre à jour compteur local */
  var cc = document.getElementById('cmtCount_'+pubId);
  if(cc) cc.textContent = (parseInt(cc.textContent)||0)+1;

  if(typeof window.showToast==='function') window.showToast('💬 Commentaire publié !');

  /* ── Firebase : écrire le commentaire + incrémenter compteur atomique ── */
  if(!window.db || !window.fbAddDoc || !window.fbCollection || !window.fbUpdateDoc ||
     !window.fbFieldIncrement || !window.fbDoc){ return; }

  var cmtData = {
    uid       : uid,
    pseudo    : pseudo,
    texte     : text,
    reactions : {},
    createdAt : window.fbServerTimestamp ? window.fbServerTimestamp() : new Date()
  };
  window.fbAddDoc(
    window.fbCollection(window.db,'publications',pubId,'comments'),
    cmtData
  ).then(function(ref){
    /* Remplacer l'ID temporaire par le vrai ID Firebase */
    var tmpEl = document.getElementById('cmtItem_'+cmtId);
    if(tmpEl && ref && ref.id){
      tmpEl.id = 'cmtItem_'+ref.id;
      /* Mettre à jour les onclick du bouton supprimer */
      var delBtn = tmpEl.querySelector('.socpub-comment-del');
      if(delBtn) delBtn.setAttribute('onclick',
        'socDeleteComment(\''+pubId+'\',\''+ref.id+'\',\''+uid+'\',this)');
    }
    /* Incrémenter compteur atomique */
    return window.fbUpdateDoc(
      window.fbDoc(window.db,'publications',pubId),
      { comments: window.fbFieldIncrement(1) }
    );
  }).catch(function(){
    /* Rollback visuel */
    var tmpEl = document.getElementById('cmtItem_'+cmtId);
    if(tmpEl) tmpEl.remove();
    if(cc) cc.textContent = Math.max(0,(parseInt(cc.textContent)||1)-1);
    if(typeof window.showToast==='function') window.showToast('⚠️ Erreur — commentaire non sauvegardé');
  });
};

/** Supprimer un commentaire (auteur ou admin) */
window.socDeleteComment = function(pubId, cmtId, authorUid, btn){
  var uid = window.currentUserUID;
  if(!uid){ if(typeof window.showToast==='function') window.showToast('🔒 Connectez-vous !'); return; }

  var isAdmin  = window.currentUserRole === 'admin' || window.currentUserRole === 'super_admin';
  var isAuthor = uid === authorUid;
  if(!isAuthor && !isAdmin){
    if(typeof window.showToast==='function') window.showToast('⛔ Vous ne pouvez supprimer que vos commentaires');
    return;
  }
  /* Retirer visuellement */
  var cmtEl = document.getElementById('cmtItem_'+cmtId);
  if(cmtEl){ cmtEl.style.opacity='0.3'; cmtEl.style.pointerEvents='none'; }

  var cc = document.getElementById('cmtCount_'+pubId);
  if(cc) cc.textContent = Math.max(0,(parseInt(cc.textContent)||1)-1);

  /* Firebase : supprimer + décrémenter compteur atomique */
  if(!window.db || !window.fbDeleteDoc || !window.fbDoc || !window.fbUpdateDoc ||
     !window.fbFieldIncrement){ if(cmtEl) cmtEl.remove(); return; }

  window.fbDeleteDoc(window.fbDoc(window.db,'publications',pubId,'comments',cmtId))
  .then(function(){
    if(cmtEl) cmtEl.remove();
    return window.fbUpdateDoc(
      window.fbDoc(window.db,'publications',pubId),
      { comments: window.fbFieldIncrement(-1) }
    );
  }).catch(function(){
    if(cmtEl){ cmtEl.style.opacity=''; cmtEl.style.pointerEvents=''; }
    if(cc) cc.textContent = (parseInt(cc.textContent)||0)+1;
    if(typeof window.showToast==='function') window.showToast('⚠️ Erreur lors de la suppression');
  });

  if(typeof window.showToast==='function') window.showToast('🗑 Commentaire supprimé');
};

/** Charger les commentaires depuis Firebase — version pro avec réactions et delete */
window._socLoadCommentsPro = function(pubId, listEl){
  if(!window.db || !window.fbCollection || !window.fbQuery ||
     !window.fbOrderBy || !window.fbGetDocs) return;
  var uid = window.currentUserUID || '';
  var isAdmin = window.currentUserRole === 'admin' || window.currentUserRole === 'super_admin';
  try {
    var q = window.fbQuery(
      window.fbCollection(window.db,'publications',pubId,'comments'),
      window.fbOrderBy('createdAt','asc')
    );
    window.fbGetDocs(q).then(function(snap){
      if(!snap || snap.empty) return;
      var html = '';
      snap.forEach(function(d){
        var c = d.data();
        var cid = d.id;
        var cl = (c.pseudo||c.auteur||'?')[0].toUpperCase();
        var ct = c.createdAt && c.createdAt.toDate
          ? c.createdAt.toDate().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
          : 'À l\'instant';
        var canDelete = uid && (uid === c.uid || isAdmin);

        /* Réactions */
        var reactHtml = '<div class="sp-emoji-bar" id="emojireact_'+cid+'">';
        _REACTIONS.forEach(function(em){
          var key   = em.codePointAt(0).toString();
          var rArr  = (c.reactions && c.reactions[key]) || [];
          var rN    = rArr.length;
          reactHtml += '<button class="sp-emoji-btn" onclick="socReactToComment(\''+pubId+'\',\''+cid+'\',\''+em+'\',this)">'
            + em
            + '<span class="sp-emoji-count'+(rN>0?' has-count':'')+'" data-n="'+rN+'">'+(rN>0?rN:'')+'</span>'
            +'</button>';
        });
        reactHtml += '</div>';

        html += '<div class="socpub-comment" id="cmtItem_'+cid+'">'
          +'<div class="socpub-comment-avatar">'+cl+'</div>'
          +'<div class="socpub-comment-body">'
          +'<div class="socpub-comment-author">'+_escPro(c.pseudo||c.auteur||'Membre')
          +' <span class="socpub-comment-time">· '+ct+'</span></div>'
          +'<div class="socpub-comment-text">'+_escPro(c.texte||c.text||c.message||'')+'</div>'
          +reactHtml
          +'<div class="socpub-comment-actions">'
          +'<button onclick="socCommentLike(this)">👍 <span>0</span></button>'
          +'<button onclick="socOpenReply(\''+pubId+'\',\''+cid+'\',this)">↩ Répondre</button>'
          +'<button onclick="socToggleEmojiReactions(\''+pubId+'\',\''+cid+'\')" title="Réagir">😊</button>'
          +(canDelete ? '<button class="socpub-comment-del" onclick="socDeleteComment(\''+pubId+'\',\''+cid+'\',\''+_escPro(c.uid||'')+'\',this)" title="Supprimer">🗑</button>' : '')
          +'</div>'
          +'</div></div>';
      });
      if(html) listEl.innerHTML = html;
      var cc = document.getElementById('cmtCount_'+pubId);
      if(cc) cc.textContent = snap.size;
    }).catch(function(){});
  } catch(e){}
};

/* Patcher socPubToggleComments pour utiliser _socLoadCommentsPro */
var _origToggleCmt = window.socPubToggleComments;
window.socPubToggleComments = function(pubId){
  var section = document.getElementById('comments_'+pubId);
  if(!section) return;
  var isOpen = section.style.display !== 'none';
  section.style.display = isOpen ? 'none' : 'block';
  if(!isOpen){
    /* Init avatar */
    var myLetter = ((window.currentUserPseudo||window.currentUserEmail||'?')[0]||'?').toUpperCase();
    var avEl = document.getElementById('cmtAvatar_'+pubId);
    if(avEl) avEl.textContent = myLetter;
    /* Charger depuis Firebase (pro) */
    var list = document.getElementById('commentsList_'+pubId);
    if(list && !list.dataset.loadedPro){
      list.dataset.loadedPro = '1';
      window._socLoadCommentsPro(pubId, list);
    }
    var inp = document.getElementById('commentInput_'+pubId);
    if(inp) setTimeout(function(){ inp.focus(); }, 120);
  }
};

/* ═══════════════════════════════════════════════════════════
   ↪️  PARTAGER — NIVEAU PROFESSIONNEL
═══════════════════════════════════════════════════════════ */
window.socPubShare = function(pubId){
  /* URL propre avec ?pub=ID */
  var base = window.location.href.split('?')[0].split('#')[0];
  var url  = base + '?pub=' + pubId;

  var card     = document.querySelector('[data-pub-id="'+pubId+'"]');
  var authorEl = card ? card.querySelector('.socpub-author') : null;
  var author   = authorEl ? authorEl.textContent.trim().replace(/✓/g,'').trim() : 'AMBI241';
  var textEl   = card ? card.querySelector('.socpub-text') : null;
  var text     = textEl ? textEl.textContent.trim().slice(0,100) : 'Ambiance à Libreville';

  /* Feuille de partage native (Android / iOS) */
  if(navigator.share){
    navigator.share({ title:'AMBI241 — '+author, text: text, url: url })
    .then(function(){ _logShare(pubId); })
    .catch(function(){});
  } else {
    try { navigator.clipboard.writeText(url); } catch(e){}
    if(typeof window.showToast==='function') window.showToast('📋 Lien copié : '+url);
    _logShare(pubId);
  }

  /* Incrémenter compteur visuel si présent */
  var shareCountEl = card ? card.querySelector('.sp-share-count') : null;
  if(shareCountEl){
    var sn = parseInt(shareCountEl.getAttribute('data-n')||'0')||0;
    sn++;
    shareCountEl.setAttribute('data-n', sn);
    shareCountEl.textContent = sn > 0 ? sn : '';
  }
};

/** Log Firebase du partage */
function _logShare(pubId){
  if(!window.db || !window.fbDoc || !window.fbUpdateDoc || !window.fbFieldIncrement) return;
  window.fbUpdateDoc(
    window.fbDoc(window.db,'publications',pubId),
    { shares: window.fbFieldIncrement(1) }
  ).catch(function(){});
}

/* Synchroniser ambi_sharePost */
window.ambi_sharePost = function(pubId){ window.socPubShare(pubId); };

/* ═══════════════════════════════════════════════════════════
   HELPER ESCAPE
═══════════════════════════════════════════════════════════ */
function _escPro(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ═══════════════════════════════════════════════════════════
   INIT — charger les likes dès que l'utilisateur se connecte
═══════════════════════════════════════════════════════════ */
(function(){
  /* Observer currentUserUID via polling */
  var _uid0 = window.currentUserUID;
  var _watchUid = setInterval(function(){
    var uid = window.currentUserUID;
    if(uid && uid !== _uid0){
      _uid0 = uid;
      _loadUserLikes(uid);
    }
    if(uid && !_likesLoaded){
      _loadUserLikes(uid);
    }
  }, 800);
  /* Charger immédiatement si déjà connecté */
  if(window.currentUserUID) _loadUserLikes(window.currentUserUID);
})();

console.log('[AMBI241] ✅ Module PRO — Likes·Commentaires·Partage Firebase chargé');
})();