
(function(){
  var _pubTab = "tous";
  var _pubType = "avis";
  var _pubUnsub = null;
  var _pubData = [];
  var _pubPage = 10;
  // Photos en attente d'upload (max 5)
  var _pubPhotos = []; // [{file, dataUrl}]
  var _pubVideo  = null; // {file, dataUrl, duration}

  // ── Initialiser Publications quand la section devient active ──
  var _pubInited = false;
  var _origSwitch = window.switchSection;
  window.switchSection = function(name, btn){
    _origSwitch(name, btn);
    if(name === "publications" && !_pubInited){
      _pubInited = true;
      initPubs();
    }
  };

  function initPubs(){
    if(!window.db || !window.fbCollection || !window.fbQuery || !window.fbOrderBy || !window.fbOnSnapshot) {
      setTimeout(initPubs, 300);
      return;
    }
    populateEtabSelect();
    subscribePubs();
  }

  function populateEtabSelect(){
    var sel = document.getElementById("pubEtabSelect");
    if(!sel || !window.etablissements) return;
    // Éviter la duplication des options à chaque ouverture
    if(sel.options.length > 1) return;
    window.etablissements.forEach(function(e){
      var opt = document.createElement("option");
      opt.value = e.id || e.nom;
      opt.textContent = e.nom;
      sel.appendChild(opt);
    });
  }

  function subscribePubs(){
    if(_pubUnsub){ _pubUnsub(); }
    var q = window.fbQuery(
      window.fbCollection(window.db, "publications"),
      window.fbOrderBy("createdAt", "desc")
    );
    _pubUnsub = window.fbOnSnapshot(q, function(snap){
      var prevCount = _pubData.length;
      _pubData = [];
      snap.forEach(function(d){ _pubData.push(Object.assign({_id: d.id}, d.data())); });
      // Activer badge si nouvelle pub et section pas active
      if(_pubInited && _pubData.length > prevCount){
        var activeSec = document.querySelector(".nav-item.active");
        var isOnDisc = activeSec && activeSec.dataset && activeSec.dataset.section === "publications";
        if(!isOnDisc) markDiscBadge(true);
      }
      renderPubs();
    }, function(){ renderPubs(); });
  }

  // ── Nettoyage des publications vidéo expirées (>24h) ──
  function _purgeExpiredVideoPubs(){
    var now = Date.now();
    var toDelete = [];
    _pubData.forEach(function(p){
      if((p.isVideo || p.video) && p.expiresAt){
        var exp = new Date(p.expiresAt).getTime();
        if(exp && now > exp) toDelete.push(p._id);
      }
    });
    toDelete.forEach(function(id){
      // Supprimer de Firestore
      if(window.db && window.fbDoc && window.fbDeleteDoc){
        window.fbDeleteDoc(window.fbDoc(window.db, 'publications', id)).catch(function(){});
      }
      // Supprimer du cache local
      _pubData = _pubData.filter(function(p){ return p._id !== id; });
    });
    if(toDelete.length) console.log('[AMBI241] '+toDelete.length+' vidéo(s) expirée(s) supprimée(s)');
  }

  function renderPubs(){
    var list = document.getElementById("pubList");
    if(!list) return;
    // Supprimer les vidéos expirées avant affichage
    _purgeExpiredVideoPubs();
    var filtered = _pubData.filter(function(p){
      return _pubTab === "tous" || p.type === _pubTab;
    });
    // Tri antichronologique : plus récent en haut, plus ancien en bas
    filtered = filtered.slice().sort(function(a, b){
      var ta = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
      var tb = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
      return tb - ta;
    });
    if(!filtered.length){
      list.innerHTML = '<div class="pub-empty"><span>&#128221;</span>Aucune publication pour le moment.<br><small>Soyez le premier à publier !</small></div>';
      var lm = document.getElementById("pubLoadMore");
      if(lm) lm.style.display = "none";
      return;
    }
    var show = filtered.slice(0, _pubPage);
    list.innerHTML = show.map(function(p){ return buildPubCard(p); }).join("");
    var lm = document.getElementById("pubLoadMore");
    if(lm) lm.style.display = filtered.length > _pubPage ? "block" : "none";
    // Charger les vrais avatars de manière asynchrone
    setTimeout(function(){
      show.forEach(function(p){
        if(!p.uid) return;
        loadUserAvatar(p.uid, function(url){
          if(!url) return;
          var el = document.getElementById("pav_"+p._id);
          if(el){
            el.innerHTML = '<img src="'+url+'" style="width:38px;height:38px;border-radius:50%;object-fit:cover;display:block;">';
            el.style.background="none"; el.style.padding="0";
          }
        });
      });
      // Avatar de l'utilisateur connecté dans les zones de commentaire
      if(window.currentUserUID){
        loadUserAvatar(window.currentUserUID, function(url){
          if(!url) return;
          document.querySelectorAll('[id^="myCommentAvatar_"]').forEach(function(el){
            el.innerHTML = '<img src="'+url+'" alt="">';
            el.style.background = "none";
            el.style.fontSize = "0";
          });
        });
      }
    }, 0);
  }

  function buildPubCard(p){
    var typeLabel = {annonce:"Annonce",soiree:"Soirée",avis:"Avis",news:"News"}[p.type] || "Post";
    var typeClass = "pub-type-"+(p.type||"avis");
    var typeEmoji = {annonce:"&#128227;",soiree:"&#127881;",avis:"&#11088;",news:"&#128240;"}[p.type] || "&#128221;";
    var initiale = (p.pseudo||p.auteur||p.author||p.displayName||"?")[0].toUpperCase();
    var ts = "";
    if(p.createdAt && p.createdAt.toDate){
      var d = p.createdAt.toDate();
      ts = d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"}) + " · " + d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
    }
    var roleClass = p.role === "admin" ? "pub-badge-admin" : (p.role === "etablissement" ? "pub-badge-etab" : "pub-badge-member");
    var roleLabel = p.role === "admin" ? "&#9881; Admin" : (p.role === "etablissement" ? "&#127968; Établ." : "&#128100; Membre");
    var etabTag = p.etab ? '<span class="pub-etab-tag">&#128205; '+escHtml(p.etab)+'</span>' : "";
    var likes = p.likes || 0;
    var comments = p.comments || 0;

    // ── Photos ──
    var photosHtml = "";
    var photos = Array.isArray(p.photos) ? p.photos : [];
    if(photos.length){
      var cnt = Math.min(photos.length, 5);
      var countClass = "count-"+cnt;
      var imgs = photos.slice(0,5).map(function(url){
        return '<img class="pub-photo-img'+(cnt===1?" tall":"")
          +'" src="'+escHtml(url)+'" alt="" loading="lazy" onclick="openPubPhotoLightbox(\''+escHtml(url)+'\')">';
      }).join("");
      photosHtml = '<div class="pub-photos"><div class="pub-photos-row '+countClass+'">'+imgs+'</div></div>';
    }

    // ── Vidéo ──
    var videoHtml = "";
    if(p.video){
      var vdur = p.videoDuration ? ' <span style="font-size:0.65rem;color:var(--muted);">'+p.videoDuration+'s</span>' : "";
      var vexpHtml = "";
      if(p.expiresAt){
        var vexpMs = new Date(p.expiresAt).getTime() - Date.now();
        if(vexpMs > 0){
          var vexpH = Math.ceil(vexpMs / 3600000);
          vexpHtml = ' <span style="font-size:0.6rem;color:var(--amber);font-weight:700;">⏳ Expire dans '+vexpH+'h</span>';
        }
      }
      videoHtml = '<div class="pub-photos" style="padding-bottom:0.4rem;">'
        +'<video class="pub-video-player" src="'+escHtml(p.video)+'" controls playsinline preload="metadata"></video>'
        +'<div style="padding:0.25rem 0.75rem 0;font-size:0.7rem;color:var(--cyan);font-weight:700;">&#127916; Vidéo'+vdur+vexpHtml+'</div>'
        +'</div>';
    }

    // ── Section commentaires (masquée par défaut) ──
    var commentsSection = buildCommentsSection(p._id, comments);

    return '<div class="pub-card" data-pubid="'+escHtml(p._id)+'">'
      +'<div class="pub-card-head">'
      +'<div class="pub-avatar" id="pav_'+escHtml(p._id)+'" style="cursor:pointer;" onclick="openPubAuthorFilter(\''+escHtml(p.pseudo||p.auteur||'')+'\',\''+escHtml(p._id)+'\')" title="Publications de '+escHtml(p.pseudo||p.auteur||'Membre')+'">'+initiale+'</div>'
      +'<div class="pub-meta">'
      +'<div class="pub-author" style="cursor:pointer;" onclick="openPubAuthorFilter(\''+escHtml(p.pseudo||p.auteur||'')+'\',\''+escHtml(p._id)+'\')">'+escHtml(p.pseudo||p.auteur||p.author||p.displayName||"Membre")+'<span class="pub-badge '+roleClass+'">'+roleLabel+'</span></div>'
      +'<div class="pub-time">'+ts+' &nbsp;<span class="pub-type-chip '+typeClass+'">'+typeEmoji+' '+typeLabel+'</span></div>'
      +'</div></div>'
      +(p.titre ? '<div class="pub-body"><div class="pub-title">'+escHtml(p.titre)+'</div>' : '<div class="pub-body">')
      +'<div class="pub-text">'+escHtml(p.texte||"")+'</div>'
      +'</div>'
      +photosHtml
      +videoHtml
      +'<div class="pub-footer">'
      +'<button class="pub-action-btn pub-like-btn'+((_likedPubs&&_likedPubs[p._id])?' liked':'')+' " onclick="likePub(\''+p._id+'\',this)">&#10084;&#65039; <span>'+likes+'</span></button>'
      +'<button class="pub-action-btn pub-comment-btn" onclick="togglePubComments(\''+p._id+'\',this)">&#128172; <span>'+comments+'</span></button>'
      +'<button class="pub-action-btn" onclick="sharePub(\''+p._id+'\')" style="margin-left:auto;">&#8629;&#65039; Partager</button>'
      +(p.etab ? '<span class="pub-etab-tag" style="cursor:pointer;" onclick="searchEtabFromPub(\''+escHtml(p.etab)+'\')" title="Voir cet établissement">&#128205; '+escHtml(p.etab)+'</span>' : "")
      +'</div>'
      +commentsSection
      +'</div>';
  }

  function buildCommentsSection(pubId, count){
    var userAvatarHtml = "";
    if(window.currentUserUID){
      var initiale = (window.currentUserPseudo||window.currentUserEmail||"?")[0].toUpperCase();
      userAvatarHtml = '<div id="myCommentAvatar_'+pubId+'" class="pub-comment-avatar" style="flex-shrink:0;width:28px;height:28px;">'+initiale+'</div>';
      // On chargera la vraie photo après
    }
    var inputHtml = window.currentUserUID
      ? '<div class="pub-comment-input-row" style="display:flex;align-items:flex-start;gap:0.4rem;">'
        + userAvatarHtml
        +'<textarea class="pub-comment-textarea" id="pubCmtTxt_'+pubId+'" placeholder="Votre commentaire..." maxlength="300" rows="1" style="flex:1;"></textarea>'
        +'<button class="pub-comment-send" onclick="sendPubComment(\''+pubId+'\')">Envoyer</button>'
        +'</div>'
      : '<div style="font-size:0.75rem;color:var(--muted);text-align:center;padding:0.4rem 0;">Connectez-vous pour commenter</div>';

    return '<div class="pub-comments-section hidden" id="pubCmtSection_'+pubId+'">'
      +'<div id="pubCmtList_'+pubId+'"><div class="pub-comments-empty">Chargement...</div></div>'
      +inputHtml
      +'</div>';
  }


  // ── Filtrer les publications d'un auteur ──
  window.openPubAuthorFilter = function(pseudo, pubId){
    if(!pseudo){ return; }
    // Highlight la card de cet auteur et afficher un toast
    showToast('👤 ' + pseudo);
    // Optionnel : mettre en évidence via scroll vers la pub
    var el = document.querySelector('[data-pubid="'+pubId+'"]');
    if(el){
      el.scrollIntoView({behavior:'smooth', block:'center'});
      el.style.transition = 'box-shadow 0.3s ease';
      el.style.boxShadow = '0 0 0 2px rgba(0,229,255,0.8)';
      setTimeout(function(){ el.style.boxShadow = ''; }, 1800);
    }
  };

  // ── Rechercher un établissement depuis une publication ──
  window.searchEtabFromPub = function(etabNom){
    switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
    setTimeout(function(){
      var inp = document.getElementById('searchInput');
      if(inp){ inp.value = etabNom; inp.dispatchEvent(new Event('input')); }
      showToast('🏠 ' + etabNom);
    }, 150);
  };

  // ── Toggle section commentaires ──
  window.togglePubComments = function(pubId, btn){
    var section = document.getElementById("pubCmtSection_"+pubId);
    if(!section) return;
    var isOpen = !section.classList.contains("hidden");
    if(isOpen){
      section.classList.add("hidden");
      if(btn) btn.classList.remove("active-comment");
    } else {
      section.classList.remove("hidden");
      if(btn) btn.classList.add("active-comment");
      loadPubComments(pubId);
      // Reconstruire le champ si utilisateur vient de se connecter
      var inputRow = section.querySelector(".pub-comment-input-row, div[style*='Connectez']");
      if(inputRow && !window.currentUserUID && !section.querySelector(".pub-comment-textarea")){
        inputRow.outerHTML = '<div style="font-size:0.75rem;color:var(--muted);text-align:center;padding:0.4rem 0;">Connectez-vous pour commenter</div>';
      } else if(!section.querySelector(".pub-comment-textarea") && window.currentUserUID){
        var inp = document.createElement("div");
        inp.className = "pub-comment-input-row";
        inp.innerHTML = '<textarea class="pub-comment-textarea" id="pubCmtTxt_'+pubId+'" placeholder="Votre commentaire..." maxlength="300" rows="1"></textarea>'
          +'<button class="pub-comment-send" onclick="sendPubComment(\''+pubId+'\')">Envoyer</button>';
        section.appendChild(inp);
      }
    }
  };

  // ── Charger commentaires d'une publication ──
  function loadPubComments(pubId){
    var listEl = document.getElementById("pubCmtList_"+pubId);
    if(!listEl || !window.db) return;
    listEl.innerHTML = '<div class="pub-comments-empty">Chargement...</div>';
    var q = window.fbQuery(
      window.fbCollection(window.db, "publications", pubId, "comments"),
      window.fbOrderBy("createdAt", "asc")
    );
    window.fbGetDocs(q).then(function(snap){
      if(snap.empty){
        listEl.innerHTML = '<div class="pub-comments-empty">&#128172; Aucun commentaire. Soyez le premier !</div>';
        return;
      }
      var html = "";
      var REACT_TYPES = ["❤️","🔥","👏","😂","😮","💃"];
      snap.forEach(function(doc){
        var c = doc.data();
        var initiale = (c.pseudo||"?")[0].toUpperCase();
        var ctime = "";
        if(c.createdAt && c.createdAt.toDate){
          var cd = c.createdAt.toDate();
          ctime = cd.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})+" · "+cd.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
        }
        var canDel = (window.isAdmin || (window.currentUserUID && window.currentUserUID === c.uid));
        var delBtn = canDel ? '<button class="pub-comment-del" onclick="deletePubComment(\''+pubId+'\',\''+doc.id+'\',this)" title="Supprimer">&#10005;</button>' : "";

        // ── Réactions ──
        var reactions = c.reactions || {};
        var reactHtml = '<div class="pub-cmt-reaction-bar">';
        REACT_TYPES.forEach(function(em){
          var users = reactions[em] || [];
          var cnt = users.length;
          var hasReacted = window.currentUserUID && users.indexOf(window.currentUserUID) !== -1;
          reactHtml += '<button class="pub-cmt-react-btn'+(hasReacted?" reacted":"")+'" '
            +'onclick="togglePubCmtReaction(\''+pubId+'\',\''+doc.id+'\',\''+em+'\')"' 
            +' id="react_'+doc.id+'_'+em.codePointAt(0)+'">' 
            +em+(cnt>0?' <span>'+cnt+'</span>':'')+'</button>';
        });
        reactHtml += '<button class="pub-cmt-reply-btn" onclick="togglePubReplyForm(\''+pubId+'\',\''+doc.id+'\')">&#x21A9;&#xFE0F; Répondre</button>';
        reactHtml += '</div>';

        // ── Formulaire réponse ──
        var replyForm = '';
        if(window.currentUserUID){
          replyForm = '<div class="pub-cmt-reply-form" id="replyForm_'+doc.id+'">' 
            +'<textarea class="pub-cmt-reply-textarea" id="replyTxt_'+doc.id+'" placeholder="Répondre à '+escHtml(c.pseudo||"Anonyme")+'…" rows="1" maxlength="280"></textarea>' 
            +'<button class="pub-cmt-reply-send" onclick="sendPubReply(\''+pubId+'\',\''+doc.id+'\')">Envoyer</button></div>';
        }

        // ── Réponses existantes ──
        var replies = Array.isArray(c.replies) ? c.replies : [];
        var repliesHtml = "";
        if(replies.length){
          repliesHtml = '<div class="pub-cmt-replies">';
          replies.forEach(function(r){
            var ri = (r.pseudo||"?")[0].toUpperCase();
            var rt = r.createdAt && r.createdAt.toDate ? r.createdAt.toDate().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}) : "";
            repliesHtml += '<div class="pub-cmt-reply-item"><div class="pub-cmt-reply-avatar">'+escHtml(ri)+'</div>' 
              +'<div class="pub-cmt-reply-body"><div class="pub-cmt-reply-meta">' 
              +'<span class="pub-cmt-reply-author">'+escHtml(r.pseudo||"Anonyme")+'</span>' 
              +'<span class="pub-cmt-reply-time">'+rt+'</span></div>' 
              +'<div class="pub-cmt-reply-text">'+escHtml(r.texte||"")+'</div></div></div>';
          });
          repliesHtml += '</div>';
        }

        html += '<div class="pub-comment-item" id="pubCmt_'+doc.id+'">' 
          +'<div class="pub-comment-avatar" id="cmtav_'+doc.id+'">'+escHtml(initiale)+'</div>' 
          +'<div class="pub-comment-body">' 
          +'<div class="pub-comment-meta"><span class="pub-comment-author">'+escHtml(c.pseudo||"Anonyme")+'</span>' 
          +'<span class="pub-comment-time">'+ctime+'</span>'+delBtn+'</div>' 
          +'<div class="pub-comment-text">'+escHtml(c.texte||"")+'</div>' 
          +reactHtml+replyForm+repliesHtml 
          +'</div></div>';
      });
      listEl.innerHTML = html;

      // ── Charger les photos de profil des auteurs de commentaires ──
      var cmtDocs = [];
      snap.forEach(function(doc){ cmtDocs.push({id: doc.id, data: doc.data()}); });
      setTimeout(function(){
        cmtDocs.forEach(function(item){
          var c = item.data;
          if(!c.uid) return;
          loadUserAvatar(c.uid, function(url){
            if(!url) return;
            var el = document.getElementById("cmtav_"+item.id);
            if(el){
              el.innerHTML = '<img src="'+url+'" alt="">';
              el.style.background = "none";
              el.style.fontSize = "0";
            }
          });
        });
      }, 0);
    }).catch(function(){
      listEl.innerHTML = '<div class="pub-comments-empty">Erreur de chargement.</div>';
    });
  }

  // ── Réagir à un commentaire ──
  window.togglePubCmtReaction = function(pubId, cmtId, emoji){
    if(!window.currentUserUID){ showToast("Connectez-vous pour réagir"); return; }
    var docRef = window.fbDoc(window.db, "publications", pubId, "comments", cmtId);
    window.fbGetDoc(docRef).then(function(snap){
      if(!snap.exists()) return;
      var reactions = snap.data().reactions || {};
      var users = reactions[emoji] || [];
      var idx = users.indexOf(window.currentUserUID);
      if(idx === -1){ users.push(window.currentUserUID); }
      else { users.splice(idx, 1); }
      reactions[emoji] = users;
      return window.fbUpdateDoc(docRef, { reactions: reactions }).then(function(){
        var key = emoji.codePointAt(0);
        var btn = document.getElementById("react_"+cmtId+"_"+key);
        if(btn){
          var isNow = users.indexOf(window.currentUserUID) !== -1;
          btn.className = "pub-cmt-react-btn"+(isNow?" reacted":"");
          btn.innerHTML = emoji+(users.length>0?' <span>'+users.length+'</span>':'́');
        }
      });
    }).catch(function(){ showToast("Erreur réaction"); });
  };

  // ── Ouvrir/fermer formulaire réponse ──
  window.togglePubReplyForm = function(pubId, cmtId){
    if(!window.currentUserUID){ showToast("Connectez-vous pour répondre"); return; }
    var form = document.getElementById("replyForm_"+cmtId);
    if(!form) return;
    form.classList.toggle("open");
    if(form.classList.contains("open")){
      var ta = document.getElementById("replyTxt_"+cmtId);
      if(ta) setTimeout(function(){ ta.focus(); }, 80);
    }
  };

  // ── Envoyer une réponse à un commentaire ──
  window.sendPubReply = function(pubId, cmtId){
    if(!window.currentUserUID){ showToast("Connectez-vous pour répondre"); return; }
    var ta = document.getElementById("replyTxt_"+cmtId);
    if(!ta) return;
    var texte = ta.value.trim();
    if(!texte){ showToast("Réponse vide"); return; }
    var sendBtn = ta.parentNode ? ta.parentNode.querySelector(".pub-cmt-reply-send") : null;
    if(sendBtn) sendBtn.disabled = true;
    var docRef = window.fbDoc(window.db, "publications", pubId, "comments", cmtId);
    window.fbGetDoc(docRef).then(function(snap){
      if(!snap.exists()) return;
      var replies = snap.data().replies || [];
      var newReply = {
        uid: window.currentUserUID,
        pseudo: window.currentUserPseudo || window.currentUserEmail || "Anonyme",
        texte: texte,
        createdAt: new Date().toISOString()
      };
      replies.push(newReply);
      return window.fbUpdateDoc(docRef, { replies: replies }).then(function(){
        ta.value = "";
        if(sendBtn) sendBtn.disabled = false;
        var form = document.getElementById("replyForm_"+cmtId);
        if(form) form.classList.remove("open");
        var container = document.getElementById("pubCmt_"+cmtId);
        if(container){
          var replyEntry = '<div class="pub-cmt-reply-item">' 
            +'<div class="pub-cmt-reply-avatar">'+escHtml((window.currentUserPseudo||"?")[0].toUpperCase())+'</div>' 
            +'<div class="pub-cmt-reply-body"><div class="pub-cmt-reply-meta">' 
            +'<span class="pub-cmt-reply-author">'+escHtml(window.currentUserPseudo||"Anonyme")+'</span>' 
            +'<span class="pub-cmt-reply-time">à l\'instant</span></div>' 
            +'<div class="pub-cmt-reply-text">'+escHtml(texte)+'</div></div></div>';
          var existing = container.querySelector(".pub-cmt-replies");
          if(existing){ existing.insertAdjacentHTML("beforeend", replyEntry); }
          else {
            var bodyEl = container.querySelector(".pub-comment-body");
            if(bodyEl){ var d=document.createElement("div"); d.className="pub-cmt-replies"; d.innerHTML=replyEntry; bodyEl.appendChild(d); }
          }
        }
        showToast("↩ Réponse envoyée !");
      });
    }).catch(function(e){
      if(sendBtn) sendBtn.disabled = false;
      showToast("Erreur : "+(e.message||""));
    });
  };


  // ── Envoyer un commentaire ──
  window.sendPubComment = function(pubId){
    if(!window.currentUserUID){ showToast("Connectez-vous pour commenter"); return; }
    var ta = document.getElementById("pubCmtTxt_"+pubId);
    if(!ta) return;
    var texte = ta.value.trim();
    if(!texte){ showToast("Commentaire vide"); return; }
    var sendBtn = ta.parentNode ? ta.parentNode.querySelector(".pub-comment-send") : null;
    if(sendBtn) sendBtn.disabled = true;
    var data = {
      uid: window.currentUserUID,
      pseudo: window.currentUserPseudo || window.currentUserEmail || "Anonyme",
      texte: texte,
      createdAt: window.fbServerTimestamp()
    };
    window.fbAddDoc(window.fbCollection(window.db, "publications", pubId, "comments"), data)
      .then(function(){
        ta.value = "";
        if(sendBtn) sendBtn.disabled = false;
        // Incrémenter le compteur
        var cardEl = document.querySelector('[data-pubid="'+pubId+'"]');
        if(cardEl){
          var cmtSpan = cardEl.querySelector('.pub-comment-btn span') || cardEl.querySelector('.pub-action-btn:nth-child(2) span');
          if(cmtSpan) cmtSpan.textContent = (parseInt(cmtSpan.textContent)||0) + 1;
        }
        var incVal = window.fbFieldIncrement ? window.fbFieldIncrement(1) : (((_pubData.find(function(p){return p._id===pubId;})||{}).comments||0)+1);
        window.fbUpdateDoc(window.fbDoc(window.db,'publications',pubId),{comments:incVal}).catch(function(){});
        loadPubComments(pubId);
      })
      .catch(function(e){
        if(sendBtn) sendBtn.disabled = false;
        showToast("Erreur : "+e.message);
      });
  };

  // ── Supprimer un commentaire ──
  window.deletePubComment = function(pubId, cmtId, btn){
    if(!window.currentUserUID && !window.isAdmin){ showToast("Non autorisé"); return; }
    if(!confirm("Supprimer ce commentaire ?")) return;
    window.fbDeleteDoc(window.fbDoc(window.db, "publications", pubId, "comments", cmtId))
      .then(function(){
        var el = document.getElementById("pubCmt_"+cmtId);
        if(el) el.remove();
        // Décrémenter le compteur
        var cardEl = document.querySelector('[data-pubid="'+pubId+'"]');
        if(cardEl){
          var cmtSpan = cardEl.querySelector('.pub-comment-btn span') || cardEl.querySelector('.pub-action-btn:nth-child(2) span');
          if(cmtSpan){ var v = Math.max(0,(parseInt(cmtSpan.textContent)||0)-1); cmtSpan.textContent = v; }
        }
        var decVal = window.fbFieldIncrement ? window.fbFieldIncrement(-1) : Math.max(0,((_pubData.find(function(p){return p._id===pubId;})||{}).comments||1)-1);
        window.fbUpdateDoc(window.fbDoc(window.db,'publications',pubId),{comments:decVal}).catch(function(){});
      })
      .catch(function(e){ showToast("Erreur : "+e.message); });
  };

  // ── Lightbox photo publication ──
  window.openPubPhotoLightbox = function(url){
    var lb = document.getElementById("lightbox");
    var img = document.getElementById("lightboxImg");
    if(lb && img){ img.src = url; lb.classList.add("show"); }
  };

  // ── Gestion photos dans le modal compose ──
  window.onPubPhotosSelected = function(input){
    var files = Array.from(input.files || []);
    files.forEach(function(file){
      if(_pubPhotos.length >= 5) return;
      // Accepter tous les fichiers (assouplissement pour éviter blocage upload)
      // Préférer les types image/ mais accepter aussi HEIC, WebP et autres formats photo
      var isImage = file.type.startsWith("image/") || 
                    file.name.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|svg|tiff)$/i);
      if(!isImage) return;
      var reader = new FileReader();
      reader.onload = function(e){
        _pubPhotos.push({ file: file, dataUrl: e.target.result });
        renderPubPhotoGrid();
      };
      reader.readAsDataURL(file);
    });
    input.value = "";
  };

  function renderPubPhotoGrid(){
    var grid = document.getElementById("pubPhotoGrid");
    var addBtn = document.getElementById("pubPhotoAddBtn");
    if(!grid) return;
    grid.innerHTML = _pubPhotos.map(function(item, idx){
      return '<div class="pub-photo-thumb">'
        +'<img src="'+item.dataUrl+'" alt="">'
        +'<button class="pub-photo-del" onclick="removePubPhoto('+idx+')">&#10005;</button>'
        +'</div>';
    }).join("");
    var isFull = _pubPhotos.length >= 5;
    if(addBtn){ addBtn.style.opacity = isFull ? "0.4" : "1"; addBtn.style.pointerEvents = isFull ? "none" : "auto"; }
    var textEl = document.getElementById("pubPhotoAddBtnText");
    if(textEl) textEl.textContent = isFull ? "\u2713 5/5 photos max" : "+ Ajouter des photos";
  }

  window.removePubPhoto = function(idx){
    _pubPhotos.splice(idx, 1);
    renderPubPhotoGrid();
  };

  // ── Gestion vidéo dans le modal compose ──
  window.onPubVideoSelected = function(input){
    var file = input.files && input.files[0];
    input.value = "";
    if(!file) return;
    // Accepter tous les formats vidéo possibles (assouplissement pour éviter blocage upload)
    var isVideo = file.type.startsWith("video/") || 
                  file.name.toLowerCase().match(/\.(mp4|webm|avi|mov|mkv|flv|wmv|m4v|3gp|ogv|ts|mts|m2ts)$/i);
    if(!isVideo){ showVideoErr("Format non supporté (vidéo uniquement)."); return; }

    var objUrl = URL.createObjectURL(file);
    var tmpVid = document.createElement("video");
    tmpVid.preload = "metadata";
    tmpVid.muted = true;
    tmpVid.playsInline = true;

    tmpVid.onloadedmetadata = function(){
      var realDur = tmpVid.duration;
      var targetDur = Math.min(realDur, 10);

      if(realDur <= 10){
        // Vidéo OK, utiliser directement — on garde objUrl pour preview (évite readAsDataURL qui charge tout en RAM)
        _pubVideo = { file: file, previewUrl: objUrl, dataUrl: null, duration: Math.round(realDur), _ownObjUrl: true };
        renderPubVideoPreview();
        return;
      }

      // Vidéo trop longue → découpage automatique à 10s via MediaRecorder
      showVideoInfo("✂️ Vidéo trop longue — découpage automatique à 10s en cours...");

      var canvas = document.createElement("canvas");
      tmpVid.onloadeddata = function(){
        canvas.width  = tmpVid.videoWidth  || 640;
        canvas.height = tmpVid.videoHeight || 360;
        var ctx = canvas.getContext("2d");

        var mimeType = "video/webm;codecs=vp8";
        if(!MediaRecorder.isTypeSupported(mimeType)) mimeType = "video/webm";
        if(!MediaRecorder.isTypeSupported(mimeType)) mimeType = "";

        var stream = canvas.captureStream(30);
        // Ajouter l'audio si disponible
        try{
          var audioCtx = new (window.AudioContext||window.webkitAudioContext)();
          var src = audioCtx.createMediaElementSource(tmpVid);
          var dest = audioCtx.createMediaStreamDestination();
          src.connect(dest);
          dest.stream.getAudioTracks().forEach(function(t){ stream.addTrack(t); });
        }catch(e){}

        var recorder = new MediaRecorder(stream, mimeType ? {mimeType: mimeType} : {});
        var chunks = [];
        recorder.ondataavailable = function(e){ if(e.data && e.data.size>0) chunks.push(e.data); };
        recorder.onstop = function(){
          URL.revokeObjectURL(objUrl);
          var blob = new Blob(chunks, {type: mimeType||"video/webm"});
          var trimmedFile = new File([blob], "video_trim.webm", {type: blob.type});
          // Utiliser createObjectURL au lieu de readAsDataURL pour éviter de charger tout en RAM
          var previewUrl = URL.createObjectURL(blob);
          _pubVideo = { file: trimmedFile, previewUrl: previewUrl, dataUrl: null, duration: 10, trimmed: true, _ownObjUrl: true };
          renderPubVideoPreview();
          showVideoInfo("✅ Vidéo découpée à 10s avec succès !");
          setTimeout(function(){ hideVideoInfo(); }, 2500);
        };

        // Dessiner chaque frame sur le canvas
        var stopped = false;
        function drawFrame(){
          if(stopped) return;
          ctx.drawImage(tmpVid, 0, 0, canvas.width, canvas.height);
          requestAnimationFrame(drawFrame);
        }

        tmpVid.currentTime = 0;
        tmpVid.onplay = function(){
          drawFrame();
          recorder.start();
          setTimeout(function(){
            stopped = true;
            tmpVid.pause();
            recorder.stop();
          }, 10000);
        };
        tmpVid.play().catch(function(){
          // fallback si autoplay bloqué
          showVideoErr("Impossible de découper automatiquement. Choisissez une vidéo ≤ 10s.");
          URL.revokeObjectURL(objUrl);
        });
      };
      tmpVid.src = objUrl;
      tmpVid.load();
    };

    tmpVid.onerror = function(){ URL.revokeObjectURL(objUrl); showVideoErr("Impossible de lire ce fichier vidéo."); };
    // ✅ FIX Bug1: timeout de sécurité si onloadedmetadata ne se déclenche jamais (Android)
    var _metaTimeout = setTimeout(function(){
      URL.revokeObjectURL(objUrl);
      showVideoErr("⏱ Impossible de lire les métadonnées — essayez un fichier MP4.");
    }, 8000);
    var _origOnMeta = tmpVid.onloadedmetadata;
    tmpVid.onloadedmetadata = function(){
      clearTimeout(_metaTimeout);
      _origOnMeta.call(this);
    };
    tmpVid.src = objUrl;
  };

  function showVideoInfo(msg){
    var el = document.getElementById("pubVideoErr");
    if(el){ el.textContent = msg; el.style.display = "block"; el.style.color = "var(--cyan)"; }
  }
  function hideVideoInfo(){
    var el = document.getElementById("pubVideoErr");
    if(el){ el.style.display = "none"; }
  }

  function showVideoErr(msg){
    var el = document.getElementById("pubVideoErr");
    if(el){ el.textContent = msg; el.style.display = "block"; el.style.color = "var(--red)"; }
  }

  function renderPubVideoPreview(){
    var wrap = document.getElementById("pubVideoPreviewWrap");
    var vid  = document.getElementById("pubVideoPreview");
    var dur  = document.getElementById("pubVideoDuration");
    var addBtn = document.getElementById("pubVideoAddBtn");
    var errEl  = document.getElementById("pubVideoErr");
    if(!_pubVideo){ 
      if(wrap) wrap.style.display = "none";
      if(addBtn) addBtn.style.display = "flex";
      if(errEl) errEl.style.display = "none";
      return;
    }
    if(errEl) errEl.style.display = "none";
    // Utiliser previewUrl (objectURL) en priorité, dataUrl en fallback
    if(vid){ vid.src = _pubVideo.previewUrl || _pubVideo.dataUrl || ""; }
    if(dur){
      dur.textContent = (_pubVideo.trimmed ? "✂️ " : "") + _pubVideo.duration + "s";
      dur.className = "pub-video-duration";
      dur.title = _pubVideo.trimmed ? "Vidéo découpée automatiquement à 10s" : "";
    }
    if(wrap) wrap.style.display = "block";
    if(addBtn) addBtn.style.display = "none";
  }

  window.removePubVideo = function(){
    // Libérer l'objectURL si on l'a créé nous-mêmes
    if(_pubVideo && _pubVideo._ownObjUrl && _pubVideo.previewUrl){
      URL.revokeObjectURL(_pubVideo.previewUrl);
    }
    _pubVideo = null;
    renderPubVideoPreview();
    var addBtn = document.getElementById("pubVideoAddBtn");
    if(addBtn) addBtn.style.display = "flex";
  };

  async function uploadPubVideo(pubId){
    if(!_pubVideo) return null;
    var ext = (_pubVideo.file.name || "video.mp4").split(".").pop() || "mp4";
    var path = "publications/"+pubId+"/video_"+Date.now()+"."+ext;
    var storRef = window.fbRef(window.fbStorage, path);
    var snap = await uploadFileWithTimeout(storRef, _pubVideo.file, 120000);
    // Libérer l'objectURL après upload réussi
    if(_pubVideo && _pubVideo._ownObjUrl && _pubVideo.previewUrl){
      URL.revokeObjectURL(_pubVideo.previewUrl);
      _pubVideo._ownObjUrl = false;
    }
    return await window.fbGetDownloadURL(snap.ref);
  }

  // ── Compteur publications du jour (localStorage) ──
  function getPubDayKey(uid){ return "pubday_"+uid+"_"+new Date().toISOString().slice(0,10); }

  function getTodayPubCount(uid){
    try{ return parseInt(localStorage.getItem(getPubDayKey(uid))||"0"); }catch(e){ return 0; }
  }

  function incTodayPubCount(uid){
    try{ localStorage.setItem(getPubDayKey(uid), getTodayPubCount(uid)+1); }catch(e){}
  }

  function updateDailyInfoUI(){
    var uid = window.currentUserUID;
    if(!uid) return;
    var count = getTodayPubCount(uid);
    var countEl = document.getElementById("pubDailyCount");
    var banner  = document.getElementById("pubDailyLimitBanner");
    var submitBtn = document.getElementById("pubSubmitBtn");
    if(countEl){
      countEl.textContent = count+" / 5";
      countEl.className = "pdi-count" + (count>=5 ? " maxed" : count>=4 ? " warning" : "");
    }
    if(banner){ banner.classList.toggle("show", count >= 5); }
    if(submitBtn){ submitBtn.disabled = count >= 5; }
  }

  // ── Marquer le badge actif sur le bouton Discussions ──
  window.markDiscBadge = function(hasNew){
    var btn = document.querySelector(".nav-item[data-section='publications']");
    if(btn) btn.classList.toggle("has-new", !!hasNew);
  };

  // ── Compression image avant upload (réduit la taille pour mobile) ──
  function compressImageFile(file, maxWidthPx, qualityJpeg){
    maxWidthPx   = maxWidthPx   || 1280;
    qualityJpeg  = qualityJpeg  || 0.82;
    return new Promise(function(resolve){
      var reader = new FileReader();
      reader.onload = function(ev){
        var img = new Image();
        img.onload = function(){
          var w = img.width, h = img.height;
          if(w > maxWidthPx){ h = Math.round(h * maxWidthPx / w); w = maxWidthPx; }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          canvas.toBlob(function(blob){ resolve(blob || file); }, 'image/jpeg', qualityJpeg);
        };
        img.onerror = function(){ resolve(file); };
        img.src = ev.target.result;
      };
      reader.onerror = function(){ resolve(file); };
      reader.readAsDataURL(file);
    });
  }

  // ── Upload d'un fichier unique avec timeout + retry automatique ──
  function uploadFileWithTimeout(storRef, blob, timeoutMs, _attempt){
    timeoutMs = timeoutMs || 30000;
    _attempt  = _attempt  || 1;
    return new Promise(function(resolve, reject){
      var task = window.fbUploadBytesResumable(storRef, blob);
      var timer = setTimeout(function(){
        try{ task.cancel(); }catch(e){}
        if(_attempt < 3){
          // Retry silencieux (×2 max) avec même timeout
          showUploadProgress(null, "⏳ Reconnexion… tentative "+(_attempt+1)+"/3");
          uploadFileWithTimeout(storRef, blob, timeoutMs, _attempt+1).then(resolve).catch(reject);
        } else {
          reject(new Error("Timeout upload fichier (>"+Math.round(timeoutMs/1000)+"s) — vérifiez votre connexion"));
        }
      }, timeoutMs);
      task.on('state_changed',
        null,
        function(err){ clearTimeout(timer); reject(err); },
        function(){ clearTimeout(timer); resolve(task.snapshot); }
      );
    });
  }

  // Convertit une photo en base64 compressé (identique à adminDefaultPhotoSelected)
  function compressPubPhotoToBase64(file){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(ev){
        var img = new Image();
        img.onload = function(){
          var MAX = 1024;
          var w = img.width, h = img.height;
          if(w > MAX || h > MAX){
            if(w > h){ h = Math.round(h * MAX / w); w = MAX; }
            else { w = Math.round(w * MAX / h); h = MAX; }
          }
          var canvas = document.createElement("canvas");
          canvas.width = w; canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        img.onerror = function(){ resolve(ev.target.result); };
        img.src = ev.target.result;
      };
      reader.onerror = function(){ reject(new Error("Lecture fichier impossible")); };
      reader.readAsDataURL(file);
    });
  }

  // Publie les photos en base64 directement dans Firestore (sans Firebase Storage)
  async function uploadPubPhotos(pubId){
    if(!_pubPhotos.length) return [];
    var base64Urls = [];
    for(var i = 0; i < _pubPhotos.length; i++){
      var item = _pubPhotos[i];
      // Utiliser le dataUrl déjà chargé si disponible, sinon compresser
      var dataUrl = item.dataUrl || await compressPubPhotoToBase64(item.file);
      // Recompresser si la dataUrl est trop grande (> 600 Ko en base64)
      if(dataUrl.length > 800000){
        try { dataUrl = await compressPubPhotoToBase64(item.file); } catch(e){}
      }
      base64Urls.push(dataUrl);
    }
    return base64Urls;
  }

  function escHtml(s){ return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }

  window.switchPubTab = function(tab, btn){
    _pubTab = tab;
    _pubPage = 10;
    document.querySelectorAll(".pub-tab").forEach(function(b){ b.classList.remove("active"); });
    if(btn) btn.classList.add("active");
    renderPubs();
  };

  window.loadMorePubs = function(){
    _pubPage += 10;
    renderPubs();
  };

  window.selectPubType = function(type, btn){
    _pubType = type;
    document.querySelectorAll(".pub-compose-modal .ptc").forEach(function(b){ b.classList.remove("active"); });
    if(btn) btn.classList.add("active");
  };

  window.openPubCompose = function(){
    if(!window.currentUserUID){
      showToast("Connectez-vous pour publier !");
      document.getElementById("userOverlay").classList.add("show");
      return;
    }
    var count = getTodayPubCount(window.currentUserUID);
    if(count >= 5){
      showToast("🚫 Limite de 5 publications/jour atteinte !");
      return;
    }
    populateEtabSelect();
    _pubPhotos = [];
    _pubVideo  = null;
    renderPubPhotoGrid();
    renderPubVideoPreview();
    updateDailyInfoUI();
    document.getElementById("pubComposeOverlay").classList.add("show");
  };

  window.closePubCompose = function(){
    document.getElementById("pubComposeOverlay").classList.remove("show");
    document.getElementById("pubTitleInput").value = "";
    document.getElementById("pubTextInput").value = "";
    _pubPhotos = [];
    // Libérer l'objectURL vidéo si créé
    if(_pubVideo && _pubVideo._ownObjUrl && _pubVideo.previewUrl){
      URL.revokeObjectURL(_pubVideo.previewUrl);
    }
    _pubVideo  = null;
    renderPubPhotoGrid();
    renderPubVideoPreview();
    var msg = document.getElementById("pubMsg");
    if(msg){ msg.style.display="none"; }
  };

  // ── Compteur vidéo par étab du jour ──
  function getEtabVideoDayKey(etabId){
    return "etabvid_"+etabId+"_"+new Date().toISOString().slice(0,10);
  }
  function getTodayEtabVideoCount(etabId){
    try{ return parseInt(localStorage.getItem(getEtabVideoDayKey(etabId))||"0"); }catch(e){ return 0; }
  }
  function incTodayEtabVideoCount(etabId){
    try{ localStorage.setItem(getEtabVideoDayKey(etabId), getTodayEtabVideoCount(etabId)+1); }catch(e){}
  }

  window.submitPub = async function(){
    if(!window.currentUserUID){ showToast("Connexion requise"); return; }
    var todayCount = getTodayPubCount(window.currentUserUID);
    if(todayCount >= 5){ showToast("🚫 Limite de 5 publications/jour atteinte !"); return; }
    var titre = document.getElementById("pubTitleInput").value.trim();
    var texte = document.getElementById("pubTextInput").value.trim();
    var etab  = document.getElementById("pubEtabSelect").value;
    if(!titre || !texte){ showToast("Titre et message requis"); return; }
    // Vérifier limite vidéo par établissement (max 2/jour)
    if(_pubVideo && etab){
      var etabVidCount = getTodayEtabVideoCount(etab);
      if(etabVidCount >= 2){
        showToast("🎬 Limite de 2 vidéos par établissement et par jour atteinte !");
        return;
      }
    }
    var btn = document.getElementById("pubSubmitBtn");
    var msg = document.getElementById("pubMsg");
    btn.disabled = true;
    btn.textContent = "⏳ Envoi...";
    if(msg){ msg.style.display="none"; }

    // Timeout sécurité 60s
    var _aborted = false;
    var _safetyTimer = setTimeout(function(){
      _aborted = true;
      btn.disabled = false;
      btn.textContent = "🚀 Publier";
      if(msg){ msg.textContent = "⏱ Délai dépassé — vérifiez votre connexion et réessayez."; msg.style.display="block"; msg.style.color="var(--red)"; }
    }, 60000);

    try {
      // Préparer les photos en base64 AVANT d'écrire dans Firestore
      var photoUrls = [];
      if(_pubPhotos.length){
        btn.textContent = "📷 Compression photos...";
        photoUrls = await uploadPubPhotos(null);
        if(_aborted) return;
      }

      var data = {
        pseudo: window.currentUserPseudo || window.currentUserEmail || "Anonyme",
        uid: window.currentUserUID,
        role: window.isAdmin ? "admin" : "membre",
        type: _pubType,
        titre: titre,
        texte: texte,
        etab: etab || "",
        likes: 0,
        comments: 0,
        createdAt: window.fbServerTimestamp()
      };
      if(photoUrls.length){ data.photos = photoUrls; }

      btn.textContent = "📡 Publication...";
      var docRef = await window.fbAddDoc(window.fbCollection(window.db, "publications"), data);
      if(_aborted) return;

      // Vidéo : upload Firebase Storage + limite 2/étab/jour + expiration 24h
      if(_pubVideo){
        btn.textContent = "⬆ Vidéo...";
        showUploadProgress(50, "Vidéo...");
        var videoUrl = await uploadPubVideo(docRef.id);
        if(_aborted) return;
        var expiresAt = new Date(Date.now() + 24*60*60*1000).toISOString();
        if(videoUrl){
          await window.fbUpdateDoc(window.fbDoc(window.db, "publications", docRef.id), {
            video: videoUrl, videoDuration: _pubVideo.duration,
            isVideo: true, expiresAt: expiresAt
          });
        }
        // Incrémenter compteur vidéo par étab
        if(etab) incTodayEtabVideoCount(etab);
        hideUploadProgress(600);
      }

      clearTimeout(_safetyTimer);
      incTodayPubCount(window.currentUserUID);
      btn.disabled = false;
      btn.textContent = "🚀 Publier";
      window.closePubCompose();
      showToast("Publication envoyée ✓");
    } catch(e) {
      clearTimeout(_safetyTimer);
      btn.disabled = false;
      btn.textContent = "🚀 Publier";
      hideUploadProgress(0);
      if(msg){ msg.textContent = "Erreur : "+e.message; msg.style.display="block"; msg.style.color="var(--red)"; }
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     LIKES — avec suivi par utilisateur (likedBy) dans Firebase
     ═══════════════════════════════════════════════════════════════ */
  var _likedPubs = {};   /* cache local { pubId: true/false } */

  /* Initialiser le cache des likes de l'utilisateur connecté */
  function _initLikedCache(){
    if(!window.currentUserUID || !window.db) return;
    /* Lire tous les likes de l'utilisateur depuis Firestore */
    window.fbGetDocs(
      window.fbQuery(
        window.fbCollection(window.db,'userLikes'),
        window.fbWhere('uid','==',window.currentUserUID)
      )
    ).then(function(snap){
      snap.forEach(function(d){ _likedPubs[d.data().pubId] = true; });
      /* Mettre à jour l'affichage des boutons déjà rendus */
      Object.keys(_likedPubs).forEach(function(pid){
        var btn = document.querySelector('[data-pubid="'+pid+'"] .pub-like-btn');
        if(btn) btn.classList.add('liked');
      });
    }).catch(function(){});
  }
  /* Déclencher après connexion */
  var _origOnAuthPub = window.__onAuthPubHook;
  window.__onAuthPubHook = function(uid){
    if(typeof _origOnAuthPub==='function') _origOnAuthPub(uid);
    _initLikedCache();
  };

  window.likePub = function(id, btn){
    if(!window.currentUserUID){
      if(typeof showToast==='function') showToast('🔒 Connectez-vous pour liker !');
      return;
    }
    if(!id || !window.db || !window.fbDoc || !window.fbUpdateDoc) return;

    var isLiked = !!_likedPubs[id];
    var spanEl  = btn ? btn.querySelector('span') : null;
    var current = spanEl ? (parseInt(spanEl.textContent)||0) : 0;
    var newVal  = isLiked ? Math.max(0, current-1) : current+1;

    /* Mise à jour optimiste UI */
    _likedPubs[id] = !isLiked;
    if(spanEl) spanEl.textContent = newVal;
    if(btn){
      btn.classList.toggle('liked', !isLiked);
      btn.style.transform='scale(1.25)';
      setTimeout(function(){ btn.style.transform=''; },200);
    }
    if(typeof showToast==='function') showToast(isLiked ? '💔 Like retiré' : "❤️ J'aime !");

    /* Firebase : compteur + collection userLikes */
    var pubRef  = window.fbDoc(window.db,'publications',id);
    var likeRef = window.fbDoc(window.db,'userLikes',window.currentUserUID+'_'+id);
    var p1 = window.fbUpdateDoc(pubRef,{ likes: newVal });
    var p2;
    if(!isLiked){
      p2 = window.fbSetDoc
        ? window.fbSetDoc(likeRef,{ uid:window.currentUserUID, pubId:id, createdAt:window.fbServerTimestamp()})
        : Promise.resolve();
    } else {
      p2 = window.fbDeleteDoc ? window.fbDeleteDoc(likeRef) : Promise.resolve();
    }
    Promise.all([p1,p2]).catch(function(){
      /* Rollback */
      _likedPubs[id] = isLiked;
      if(spanEl) spanEl.textContent = current;
      if(btn) btn.classList.toggle('liked', isLiked);
      if(typeof showToast==='function') showToast('⚠️ Erreur réseau — réessayez');
    });
  };

  /* ── Partager une publication ── */
  window.sharePub = function(id){
    var url  = window.location.origin + window.location.pathname + '?pub=' + id;
    var card = document.querySelector('[data-pubid="'+id+'"]');
    var textEl = card ? card.querySelector('.pub-text') : null;
    var text   = textEl ? textEl.textContent.trim().slice(0,100) : 'Découvrez cette publication sur AMBI241';
    var authorEl = card ? card.querySelector('.pub-author') : null;
    var author   = authorEl ? authorEl.textContent.replace(/Admin|Établ\.|Membre/g,'').trim() : 'AMBI241';
    if(navigator.share){
      navigator.share({ title:'AMBI241 — '+author, text:text, url:url })
        .then(function(){
          /* Log partage Firebase */
          if(window.db && window.fbDoc && window.fbUpdateDoc){
            window.fbUpdateDoc(window.fbDoc(window.db,'publications',id),{shares:(window.fbFieldIncrement ? window.fbFieldIncrement(1) : 1)}).catch(function(){});
          }
        })
        .catch(function(){});
    } else {
      try{ navigator.clipboard.writeText(url); }catch(e){}
      if(typeof showToast==='function') showToast('📋 Lien copié dans le presse-papier !');
    }
  };

  // ══════════════════════════════════════════════════════════════
  // ══  WHATSAPP BROADCAST — Envoi groupé / individuel admin    ══
  // ══════════════════════════════════════════════════════════════

  var _waSelected = {};   // { etabId: { nom, tel } }
  var _waSendIdx  = 0;
  var _waSendList = [];

  // Ouvre le modal de broadcast (admin)
  window.openWaBroadcast = function(){
    if(!isAdmin){ showToast("Réservé aux administrateurs."); return; }
    _waSelected = {};
    _renderWaEtabList();
    document.getElementById("waMessageInput").value = "";
    document.getElementById("waMsgCount").textContent = "0/600";
    document.getElementById("waProgress").style.display = "none";
    document.getElementById("waSendBtnTxt").textContent = "Envoyer aux sélectionnés";
    document.getElementById("waSendBtn").disabled = false;
    document.getElementById("waBroadcastOverlay").classList.add("show");
  };

  window.closeWaBroadcast = function(){
    document.getElementById("waBroadcastOverlay").classList.remove("show");
  };

  // Rend la liste des établissements avec leur numéro
  function _renderWaEtabList(){
    var list = document.getElementById("waEtabList");
    if(!list) return;
    var html = "";
    etablissements.forEach(function(e){
      var tel = (e.contact||"").replace(/\s/g,"");
      var waNum = tel.replace(/\+/g,"");
      var hasNum = waNum && waNum.length >= 8;
      var isSelected = !!_waSelected[e.id];
      html += "<div class='wa-etab-item"+(isSelected?" selected":"")+"' onclick='waToggleEtab("+e.id+")' id='waitem-"+e.id+"'>";
      html += "<div class='wa-etab-check'>"+(isSelected?"&#10003;":"")+"</div>";
      html += "<div class='wa-etab-name'>"+escHtml(e.nom||"")+"</div>";
      if(hasNum){
        html += "<div class='wa-etab-num'>+"+waNum+"</div>";
      } else {
        html += "<div class='wa-etab-nonum'>Pas de numéro</div>";
      }
      html += "</div>";
    });
    list.innerHTML = html || "<div style='text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;'>Aucun établissement chargé.</div>";
    _updateWaCount();
  }

  window.waToggleEtab = function(id){
    var e = etablissements.find(function(x){ return x.id == id; });
    if(!e) return;
    var tel = (e.contact||"").replace(/\s/g,"");
    var waNum = tel.replace(/\+/g,"");
    if(!waNum || waNum.length < 8) return; // pas de numéro, on ignore
    if(_waSelected[id]){
      delete _waSelected[id];
    } else {
      _waSelected[id] = { nom: e.nom, tel: waNum };
    }
    var item = document.getElementById("waitem-"+id);
    if(item){
      item.classList.toggle("selected", !!_waSelected[id]);
      var chk = item.querySelector(".wa-etab-check");
      if(chk) chk.innerHTML = _waSelected[id] ? "&#10003;" : "";
    }
    _updateWaCount();
  };

  window.waToggleAll = function(){
    var eligible = etablissements.filter(function(e){
      var tel = (e.contact||"").replace(/\s/g,"").replace(/\+/g,"");
      return tel && tel.length >= 8;
    });
    var allSelected = eligible.length > 0 && eligible.every(function(e){ return !!_waSelected[e.id]; });
    if(allSelected){
      // Désélectionner tout
      _waSelected = {};
    } else {
      // Sélectionner tout
      eligible.forEach(function(e){
        var tel = (e.contact||"").replace(/\s/g,"").replace(/\+/g,"");
        _waSelected[e.id] = { nom: e.nom, tel: tel };
      });
    }
    _renderWaEtabList();
  };

  function _updateWaCount(){
    var n = Object.keys(_waSelected).length;
    var lbl = document.getElementById("waCountLabel");
    if(lbl) lbl.textContent = n+" sélectionné"+(n>1?"s":"")+" (avec numéro)";
  }

  // Envoi séquentiel : ouvre wa.me un à un avec délai
  window.waSendSequential = function(){
    var msg = (document.getElementById("waMessageInput").value||"").trim();
    if(!msg){ showToast("Rédigez un message avant d'envoyer."); return; }
    var keys = Object.keys(_waSelected);
    if(!keys.length){ showToast("Sélectionnez au moins un établissement."); return; }
    _waSendList = keys.map(function(k){ return _waSelected[k]; });
    _waSendIdx  = 0;
    document.getElementById("waProgress").style.display = "block";
    document.getElementById("waSendBtn").disabled = true;
    _waSendNext(msg);
  };

  function _waSendNext(msg){
    if(_waSendIdx >= _waSendList.length){
      document.getElementById("waProgressFill").style.width = "100%";
      document.getElementById("waProgressLbl").textContent = "✓ Envoi terminé — "+_waSendList.length+" message(s) ouverts";
      document.getElementById("waSendBtn").disabled = false;
      document.getElementById("waSendBtnTxt").textContent = "Envoyer aux sélectionnés";
      showToast("✓ "+_waSendList.length+" conversations WhatsApp ouvertes !");
      return;
    }
    var item = _waSendList[_waSendIdx];
    var pct  = Math.round((_waSendIdx / _waSendList.length) * 100);
    document.getElementById("waProgressFill").style.width = pct+"%";
    document.getElementById("waProgressLbl").textContent = "Envoi "+(_waSendIdx+1)+"/"+_waSendList.length+" — "+item.nom;
    document.getElementById("waSendBtnTxt").textContent = "Envoi "+(_waSendIdx+1)+"/"+_waSendList.length+"...";
    var url = "https://wa.me/"+item.tel+"?text="+encodeURIComponent(msg);
    window.open(url, "_blank");
    _waSendIdx++;
    // Délai entre les ouvertures pour éviter le blocage navigateur
    setTimeout(function(){ _waSendNext(msg); }, 900);
  }

  // ── Envoi individuel rapide depuis fiche admin ──
  window.openWaSingle = function(waNum, nom){
    if(!isAdmin){ showToast("Réservé aux administrateurs."); return; }
    var defMsg = "Bonjour "+nom+" ! Ceci est un message de l'équipe AMBI241.";
    var msg = prompt("Message WhatsApp à envoyer à "+nom+" :", defMsg);
    if(msg === null) return; // annulé
    if(!msg.trim()){ showToast("Message vide."); return; }
    var url = "https://wa.me/"+waNum+"?text="+encodeURIComponent(msg.trim());
    window.open(url, "_blank");
    logContactClick(nom, nom, "whatsapp");
    showToast("&#128172; Conversation WhatsApp ouverte !");
  };

})();
