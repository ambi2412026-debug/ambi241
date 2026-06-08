/* ══════════════════════════════════════════════════════════════
   AMBI241 — ADMIN SOCIAL MEDIA MANAGER
   ══════════════════════════════════════════════════════════════ */
(function(){
'use strict';

/* ── État ── */
var _smData = {
  accounts: {
    ig:  { handle:'@ambi241', followers:0, delta:'+0', color:'#e1306c', emoji:'📸', connected:false },
    fb:  { handle:'AMBI241',  followers:0, delta:'+0', color:'#1877f2', emoji:'👍', connected:false },
    tk:  { handle:'@ambi_241',followers:0, delta:'+0', color:'#fff',    emoji:'🎵', connected:false },
    wa:  { handle:'+241 XX XX XX XX', followers:0, delta:'+0', color:'#25d366', emoji:'💬', connected:false }
  },
  reach: {
    ig: { days:[], values:[] },
    fb: { days:[], values:[] },
    tk: { days:[], values:[] }
  },
  posts: [],
  comments: [],
  trends: [
    { rank:1, tag:'#LibrevilleNight',    vol:'—', badge:'hot' },
    { rank:2, tag:'#Ambi241',            vol:'—', badge:'rise' },
    { rank:3, tag:'#Sortir241',          vol:'—', badge:'rise' },
    { rank:4, tag:'#Gabon',              vol:'—', badge:'new' },
    { rank:5, tag:'#NightlifeLibreville',vol:'—', badge:'hot' },
  ],
  savedHashtags: ['#Ambi241','#Libreville','#Sortir241','#Gabon'],
  topPosts: []
};
var _currentReachPlatform = 'ig';
var _currentPostFilter = 'all';
var _currentCommentFilter = 'all';
var _selectedPlatforms = {};
var _smInitialized = false;

/* ── Entry point ── */
window.renderSocialMediaAdmin = function(){
  if(!_smInitialized){
    _renderKPIs();
    _renderAccounts();
    _renderReach('ig');
    _renderAudienceGrid();
    _renderPosts('all');
    _renderComments('all');
    _renderTrends();
    _renderSavedHashtags();
    _renderTopPosts();
    _populateEtabSelect();
    _smInitialized = true;
  }
};

/* ── KPIs ── */
function _renderKPIs(){
  var d = _smData.accounts;
  _setKPI('asmFollowersIG', _fmt(d.ig.followers), d.ig.delta, true);
  _setKPI('asmFollowersFB', _fmt(d.fb.followers), d.fb.delta, true);
  _setKPI('asmFollowersTK', _fmt(d.tk.followers), d.tk.delta, true);
  _setKPI('asmEngagementRate', '6.8%', '+0.4%', true);
}
function _setKPI(valId, val, delta, up){
  var el = document.getElementById(valId);
  if(el) el.textContent = val;
  var dId = valId + 'Delta';
  var dEl = document.getElementById(dId);
  if(dEl){ dEl.textContent = (up?'▲ ':'▼ ') + delta + ' ce mois'; dEl.className = 'asm-kpi-delta ' + (up?'up':'down'); }
}

/* ── Comptes ── */
function _renderAccounts(){
  var el = document.getElementById('asmAccountsPanel');
  if(!el) return;
  var html = '';
  Object.keys(_smData.accounts).forEach(function(k){
    var a = _smData.accounts[k];
    html += '<div style="display:flex;align-items:center;gap:0.65rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:13px;padding:0.75rem 0.9rem;">';
    html += '<span style="font-size:1.3rem;">'+a.emoji+'</span>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:0.8rem;font-weight:700;color:'+a.color+';">'+_esc(a.handle)+'</div>';
    html += '<div style="font-size:0.63rem;color:var(--muted);margin-top:0.08rem;">'+_fmt(a.followers)+' abonnés · '+a.delta+' ce mois</div></div>';
    html += '<div style="font-size:0.62rem;font-weight:800;padding:0.18rem 0.5rem;border-radius:20px;border:1px solid;'+(a.connected?'background:rgba(0,255,170,0.1);border-color:rgba(0,255,170,0.35);color:var(--green);':'background:rgba(255,68,102,0.08);border-color:rgba(255,68,102,0.3);color:var(--red);')+'">'+(a.connected?'● Connecté':'○ Déconnecté')+'</div>';
    if(!a.connected) html += '<button onclick="smToast(\'🔗 Redirection OAuth…\')" style="padding:0.28rem 0.55rem;border-radius:8px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.35);color:var(--amber);font-size:0.65rem;font-weight:800;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Connecter</button>';
    html += '</div>';
  });
  el.innerHTML = html;
}

/* ── Reach / barchart ── */
function _renderReach(plt){
  _currentReachPlatform = plt;
  var data = _smData.reach[plt];
  var max = Math.max.apply(null, data.values);
  var colors = { ig:'#e1306c', fb:'#1877f2', tk:'#ffffff' };
  var col = colors[plt] || 'var(--pink)';
  var chart = document.getElementById('asmReachChart');
  if(!chart) return;
  var html = '';
  data.days.forEach(function(day, i){
    var pct = max ? Math.round((data.values[i]/max)*100) : 0;
    html += '<div class="asm-bar-row">';
    html += '<div class="asm-bar-label">'+day+'</div>';
    html += '<div class="asm-bar-track"><div class="asm-bar-fill" style="width:'+pct+'%;background:'+col+';opacity:0.85;"></div></div>';
    html += '<div class="asm-bar-val">'+_fmt(data.values[i])+'</div></div>';
  });
  chart.innerHTML = html;
  var total = data.values.reduce(function(a,b){return a+b;},0);
  var avg = Math.round(total/data.values.length);
  var peak = Math.max.apply(null, data.values);
  var sum = document.getElementById('asmReachSummary');
  if(sum){
    sum.innerHTML = 
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;padding:0.65rem;text-align:center;"><div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:'+col+';">'+_fmt(total)+'</div><div style="font-size:0.62rem;color:var(--muted);">Total portée</div></div>'+
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;padding:0.65rem;text-align:center;"><div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:'+col+';">'+_fmt(avg)+'</div><div style="font-size:0.62rem;color:var(--muted);">Moy. / jour</div></div>'+
      '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;padding:0.65rem;text-align:center;"><div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:'+col+';">'+_fmt(peak)+'</div><div style="font-size:0.62rem;color:var(--muted);">Pic journalier</div></div>';
  }
}
window.asmSwitchReach = function(plt, btn){
  _currentReachPlatform = plt;
  var classes = {ig:'active-ig',fb:'active-fb',tk:'active-tk'};
  document.querySelectorAll('.asm-plt-tab').forEach(function(b){
    b.className = 'asm-plt-tab';
  });
  if(btn) btn.className = 'asm-plt-tab ' + (classes[plt]||'');
  _renderReach(plt);
};

/* ── Audience grid ── */
function _renderAudienceGrid(){
  // déjà rendu en HTML statique, on pourrait dynamiser depuis Firebase
}

/* ── Posts ── */
function _renderPosts(filter){
  _currentPostFilter = filter;
  var el = document.getElementById('asmPostsList');
  if(!el) return;
  var posts = _smData.posts.filter(function(p){ return filter==='all' || p.status===filter; });
  if(!posts.length){ el.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;">Aucune publication dans cette catégorie</div>'; return; }
  var pltEmoji = {ig:'📸',fb:'👍',tk:'🎵',wa:'💬'};
  var html = '';
  posts.forEach(function(p){
    var statusClass = p.status;
    var statusLabel = {scheduled:'⏰ Programmé',published:'✅ Publié',draft:'📝 Brouillon',failed:'❌ Échec'}[p.status]||p.status;
    html += '<div class="asm-post-card" id="asmPost_'+p.id+'">';
    html += '<div class="asm-post-header">';
    html += '<div class="asm-post-platforms">';
    p.platforms.forEach(function(pl){ html += '<span class="asm-post-plat-icon">'+pltEmoji[pl]+'</span>'; });
    html += '</div>';
    html += '<div class="asm-post-body">';
    html += '<div class="asm-post-caption">'+_esc(p.caption)+'</div>';
    html += '<div class="asm-post-meta">';
    if(p.date) html += '<span class="asm-post-date">'+p.date+'</span>';
    html += '<span class="asm-post-status '+statusClass+'">'+statusLabel+'</span>';
    if(p.likes!==null) html += '<span style="font-size:0.62rem;color:var(--muted);">❤️ '+p.likes+' &nbsp;💬 '+p.comments+' &nbsp;👁️ '+_fmt(p.reach)+'</span>';
    html += '</div></div>';
    html += '<div class="asm-post-actions">';
    if(p.status!=='published') html += '<button class="asm-icon-btn edit" onclick="asmEditPost(\''+p.id+'\')" title="Modifier">✏️</button>';
    html += '<button class="asm-icon-btn del" onclick="asmDeletePost(\''+p.id+'\')" title="Supprimer">🗑️</button></div></div>';
    html += '</div>';
  });
  el.innerHTML = html;
}
window.asmFilterPosts = function(filter, btn){
  _currentPostFilter = filter;
  document.querySelectorAll('.asm-filter-bar .asm-filter-chip').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  _renderPosts(filter);
};
window.asmDeletePost = function(id){
  _smData.posts = _smData.posts.filter(function(p){return p.id!==id;});
  _renderPosts(_currentPostFilter);
  smToast('🗑️ Publication supprimée');
};
window.asmEditPost = function(id){
  var p = _smData.posts.find(function(x){return x.id===id;});
  if(!p) return;
  asmOpenCompose(p);
};

/* ── Commentaires ── */
function _renderComments(filter){
  _currentCommentFilter = filter;
  var el = document.getElementById('asmCommentsList');
  if(!el) return;
  var comments = _smData.comments.filter(function(c){ return filter==='all' || (filter==='flagged' && c.status==='flagged') || (filter==='pending' && c.status==='pending'); });
  var flagged = _smData.comments.filter(function(c){return c.status==='flagged';});
  var fc = document.getElementById('asmFlagCount');
  if(fc) fc.textContent = flagged.length || '';
  if(!comments.length){ el.innerHTML='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;">Aucun commentaire dans cette catégorie</div>'; return; }
  var pltColor = {ig:'#e1306c',fb:'#1877f2',tk:'#fff',wa:'#25d366'};
  var pltLabel = {ig:'Instagram',fb:'Facebook',tk:'TikTok',wa:'WhatsApp'};
  var html = '';
  comments.forEach(function(c){
    html += '<div class="asm-comment-item '+(c.status==='flagged'?'flagged':(c.status==='approved'?'approved':''))+'" id="asmCmt_'+c.id+'">';
    html += '<div class="asm-comment-top">';
    html += '<div class="asm-comment-avatar">'+c.emoji+'</div>';
    html += '<div class="asm-comment-info"><div class="asm-comment-author">'+_esc(c.author)+'<span class="asm-comment-platform" style="color:'+pltColor[c.platform]+'">'+pltLabel[c.platform]+'</span></div>';
    html += '<div class="asm-comment-time">'+c.time+'</div></div>';
    if(c.status==='flagged') html += '<span class="asm-flag-badge">🚩 '+_esc(c.reason||'Signalé')+'</span>';
    html += '</div>';
    html += '<div class="asm-comment-text">'+_esc(c.text)+'</div>';
    html += '<div class="asm-comment-btns">';
    if(c.status!=='approved') html += '<button class="asm-comment-btn approve" onclick="asmModComment(\''+c.id+'\',\'approved\')">✅ Approuver</button>';
    html += '<button class="asm-comment-btn reply" onclick="asmReplyComment(\''+c.id+'\')">↩️ Répondre</button>';
    html += '<button class="asm-comment-btn hide" onclick="asmModComment(\''+c.id+'\',\'hidden\')">🙈 Masquer</button>';
    html += '<button class="asm-comment-btn delete" onclick="asmModComment(\''+c.id+'\',\'deleted\')">🗑️ Supprimer</button>';
    html += '</div></div>';
  });
  el.innerHTML = html;
}
window.asmFilterComments = function(filter, btn){
  _currentCommentFilter = filter;
  var bars = document.querySelectorAll('#panelSocialMedia .asm-section:nth-child(6) .asm-filter-chip');
  bars.forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  _renderComments(filter);
};
window.asmModComment = function(id, action){
  var msgs = {approved:'✅ Commentaire approuvé',hidden:'🙈 Commentaire masqué',deleted:'🗑️ Commentaire supprimé'};
  if(action==='deleted'){
    _smData.comments = _smData.comments.filter(function(c){return c.id!==id;});
  } else {
    _smData.comments.forEach(function(c){ if(c.id===id) c.status=action; });
  }
  smToast(msgs[action]||'Modifié');
  _renderComments(_currentCommentFilter);
};
window.asmReplyComment = function(id){
  var c = _smData.comments.find(function(x){return x.id===id;});
  if(c) smToast('↩️ Réponse à '+c.author+' — fonctionnalité Pro (API native requise)');
};

/* ── Trends ── */
function _renderTrends(){
  var el = document.getElementById('asmTrendsList');
  if(!el) return;
  var badgeLabel = {hot:'🔥 Hot',rise:'📈 En hausse',new:'✨ Nouveau'};
  var html = '';
  _smData.trends.forEach(function(t){
    html += '<div class="asm-trend-item" onclick="asmInsertHashtagFromTrend(\''+_esc(t.tag)+'\')">';
    html += '<div class="asm-trend-rank">#'+t.rank+'</div>';
    html += '<div class="asm-trend-tag">'+_esc(t.tag)+'</div>';
    html += '<div class="asm-trend-vol">'+t.vol+'</div>';
    html += '<span class="asm-trend-badge '+t.badge+'">'+badgeLabel[t.badge]+'</span>';
    html += '</div>';
  });
  el.innerHTML = html;
}

/* ── Saved hashtags ── */
function _renderSavedHashtags(){
  var el = document.getElementById('asmSavedHashtags');
  if(!el) return;
  var html = '';
  _smData.savedHashtags.forEach(function(h){
    html += '<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.22rem 0.55rem;border-radius:20px;background:rgba(255,45,155,0.1);border:1px solid rgba(255,45,155,0.25);color:var(--pink);font-size:0.7rem;font-weight:700;">';
    html += _esc(h);
    html += ' <span onclick="asmRemoveHashtag(\''+_esc(h)+'\')" style="cursor:pointer;opacity:0.6;font-size:0.65rem;">✕</span></span>';
  });
  if(!html) html = '<span style="font-size:0.72rem;color:var(--muted);">Aucun hashtag enregistré</span>';
  el.innerHTML = html;
}
window.asmAddHashtag = function(){
  var inp = document.getElementById('asmHashtagInput');
  if(!inp) return;
  var val = inp.value.trim();
  if(!val) return;
  if(!val.startsWith('#')) val = '#'+val;
  if(_smData.savedHashtags.indexOf(val)===-1) _smData.savedHashtags.push(val);
  inp.value = '';
  _renderSavedHashtags();
  smToast('🏷️ Hashtag ajouté');
};
window.asmRemoveHashtag = function(h){
  _smData.savedHashtags = _smData.savedHashtags.filter(function(x){return x!==h;});
  _renderSavedHashtags();
};
window.asmInsertHashtagFromTrend = function(h){
  if(_smData.savedHashtags.indexOf(h)===-1){ _smData.savedHashtags.push(h); _renderSavedHashtags(); }
  smToast('🏷️ '+h+' ajouté à vos hashtags');
};

/* ── Top posts ── */
function _renderTopPosts(){
  var el = document.getElementById('asmTopPostsList');
  if(!el) return;
  var pltEmoji = {ig:'📸',fb:'👍',tk:'🎵',wa:'💬'};
  var html = '';
  _smData.topPosts.forEach(function(p, i){
    var medal = ['🥇','🥈','🥉'][i] || (i+1+'.') ;
    html += '<div style="display:flex;align-items:center;gap:0.65rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.75rem 0.9rem;margin-bottom:0.45rem;">';
    html += '<div style="font-size:1.2rem;flex-shrink:0;">'+medal+'</div>';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:0.78rem;color:var(--text);display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:0.2rem;">'+pltEmoji[p.platform]+' '+_esc(p.caption)+'</div>';
    html += '<div style="display:flex;gap:0.5rem;font-size:0.65rem;color:var(--muted);">❤️ '+p.likes+' &nbsp;💬 '+p.comments+' &nbsp;👁️ '+_fmt(p.reach)+' &nbsp;📅 '+p.date+'</div>';
    html += '</div></div>';
  });
  el.innerHTML = html;
}

/* ── Composer ── */
window.asmOpenCompose = function(prefill){
  var modal = document.getElementById('asmComposeModal');
  if(!modal) return;
  if(prefill){
    var cap = document.getElementById('asmPostCaption');
    if(cap){ cap.value = prefill.caption||''; asmUpdateCharCount(cap); }
    var sched = document.getElementById('asmPostSchedule');
    if(sched && prefill.date) sched.value = prefill.date.replace(' ','T');
    (prefill.platforms||[]).forEach(function(pl){ asmTogglePlatform(pl, document.getElementById('asmChk'+pl.toUpperCase())); });
  } else {
    var cap2 = document.getElementById('asmPostCaption');
    if(cap2){ cap2.value=''; asmUpdateCharCount(cap2); }
    _selectedPlatforms = {};
    ['IG','FB','TK','WA'].forEach(function(p){ var b = document.getElementById('asmChk'+p); if(b){ b.className='asm-plt-check'; } });
  }
  _populateEtabSelect();
  modal.classList.add('open');
  document.body.style.overflow='hidden';
};
window.asmCloseCompose = function(){
  var modal = document.getElementById('asmComposeModal');
  if(modal) modal.classList.remove('open');
  document.body.style.overflow='';
  asmRemoveMedia();
};
window.asmTogglePlatform = function(pl, btn){
  if(!btn) return;
  var classes = {ig:'checked-ig',fb:'checked-fb',tk:'checked-tk',wa:'checked-wa'};
  var cls = classes[pl];
  if(_selectedPlatforms[pl]){
    delete _selectedPlatforms[pl];
    btn.className = 'asm-plt-check';
  } else {
    _selectedPlatforms[pl] = true;
    btn.className = 'asm-plt-check ' + cls;
  }
};
window.asmUpdateCharCount = function(ta){
  var count = document.getElementById('asmCharCount');
  if(!count || !ta) return;
  var len = ta.value.length;
  count.textContent = len + ' / 2200';
  count.className = 'asm-char-count' + (len>2200?' over':'');
};
window.asmInsertHashtag = function(h){
  var ta = document.getElementById('asmPostCaption');
  if(!ta) return;
  ta.value = ta.value ? ta.value + ' ' + h : h;
  asmUpdateCharCount(ta);
  ta.focus();
};
window.asmPickMedia = function(){ var f = document.getElementById('asmMediaFile'); if(f) f.click(); };
window.asmPreviewMedia = function(inp){
  var file = inp.files && inp.files[0];
  if(!file) return;
  var prev = document.getElementById('asmMediaPreview');
  var img = document.getElementById('asmMediaImg');
  if(prev && img){ var r=new FileReader(); r.onload=function(e){img.src=e.target.result;prev.style.display='block';}; r.readAsDataURL(file); }
};
window.asmRemoveMedia = function(){
  var prev = document.getElementById('asmMediaPreview');
  var img = document.getElementById('asmMediaImg');
  var inp = document.getElementById('asmMediaFile');
  if(prev) prev.style.display='none';
  if(img) img.src='';
  if(inp) inp.value='';
};
window.asmSavePost = function(status){
  var cap = document.getElementById('asmPostCaption');
  var sched = document.getElementById('asmPostSchedule');
  if(!cap || !cap.value.trim()){ smToast('⚠️ Rédigez une légende'); return; }
  var plts = Object.keys(_selectedPlatforms);
  if(!plts.length){ smToast('⚠️ Sélectionnez au moins une plateforme'); return; }
  if(status==='scheduled' && !sched.value){ smToast('⚠️ Choisissez une date de programmation'); return; }
  var newPost = {
    id: 'p'+Date.now(),
    caption: cap.value.trim(),
    platforms: plts,
    status: status,
    date: sched && sched.value ? sched.value.replace('T',' ') : null,
    likes: null, comments: null, reach: null
  };
  _smData.posts.unshift(newPost);
  asmCloseCompose();
  _renderPosts(_currentPostFilter);
  var msgs = {scheduled:'🚀 Publication programmée !', draft:'💾 Brouillon enregistré !'};
  smToast(msgs[status]||'Publication enregistrée');
};

/* ── Export ── */
window.asmExport = function(fmt){
  if(fmt==='csv'){
    var rows = [['Date','Plateforme(s)','Légende','Statut','Likes','Commentaires','Portée']];
    _smData.posts.forEach(function(p){
      rows.push([p.date||'—',p.platforms.join('+'),p.caption.replace(/"/g,'""'),p.status,p.likes||'—',p.comments||'—',p.reach||'—']);
    });
    var csv = rows.map(function(r){return r.map(function(c){return '"'+c+'"';}).join(',');}).join('\n');
    _downloadText('ambi241_social_report.csv', csv, 'text/csv');
    smToast('📊 Export CSV téléchargé');
  } else if(fmt==='json'){
    var data = { generatedAt: new Date().toISOString(), accounts: _smData.accounts, posts: _smData.posts, savedHashtags: _smData.savedHashtags };
    _downloadText('ambi241_social_report.json', JSON.stringify(data, null, 2), 'application/json');
    smToast('⚙️ Export JSON téléchargé');
  } else if(fmt==='pdf'){
    smToast('📄 Export PDF — fonctionnalité disponible avec plan Pro');
  }
};
function _downloadText(filename, content, mime){
  var blob = new Blob([content], {type:mime});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href=url; a.download=filename; a.click();
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
}

/* ── Peuple select établissements ── */
function _populateEtabSelect(){
  var sel = document.getElementById('asmPostEtab');
  if(!sel) return;
  var etabs = window.ETABLISSEMENTS || window.etablissements || [];
  var html = '<option value="">— Aucun établissement —</option>';
  etabs.slice(0,30).forEach(function(e){
    html += '<option value="'+_esc(e.id||e.nom)+'">'+_esc(e.nom||e.name)+'</option>';
  });
  if(!etabs.length){
    ['Bus\'O','Olako Beach','N\'Djinn Lounge','L\'Équipe Bar','Le Patchwork'].forEach(function(n){
      html += '<option value="'+_esc(n)+'">'+_esc(n)+'</option>';
    });
  }
  sel.innerHTML = html;
}

/* ── Fermer modal au clic overlay ── */
document.addEventListener('click', function(e){
  var modal = document.getElementById('asmComposeModal');
  if(modal && e.target === modal) asmCloseCompose();
});

/* ── Utilitaires ── */
function _fmt(n){ if(n>=1000) return (n/1000).toFixed(1).replace('.0','')+'K'; return ''+n; }
function _esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function smToast(msg){ if(typeof window.showToast==='function'){ window.showToast(msg); return; } if(typeof window.socToast==='function'){ window.socToast(msg); return; } var t=document.getElementById('socToast')||document.getElementById('toastMsg'); if(t){ t.textContent=msg; t.classList.add('show'); setTimeout(function(){t.classList.remove('show');},3000); } }

window.renderSocialMediaAdmin = window.renderSocialMediaAdmin;
console.log('[AMBI241] ✅ Admin Social Media Manager chargé');
})();

/* ══════════════════════════════════════════════════════════════
   AMBI241 — PATCH CORRECTIFS v3.1 (Bugs #1 #2 #3)
   1. Persistance photos galerie profil
   2. Vitesse nav bar
   3. Redirection inscription visiteurs
   ══════════════════════════════════════════════════════════════ */
(function(){

  /* ── FIX #1 : Firestore sync galerie ── */
  window._pGallerySaveToFirestore = function(urls) {
    if(!window.currentUserUID || !window.db || !window.fbDoc || !window.fbUpdateDoc) return;
    try {
      // Ne stocker que les 12 premières; chaque URL est déjà compressée (base64 ~20-80KB)
      var toStore = (urls || []).slice(0, 12);
      window.fbUpdateDoc(
        window.fbDoc(window.db, 'users', window.currentUserUID),
        { galleryPhotos: toStore, galleryUpdatedAt: Date.now() }
      ).catch(function(e){ console.warn('[AMBI241] Gallery Firestore save failed:', e); });
    } catch(e) {}
  };

  window._pGalleryRestoreFromFirestore = function() {
    var uid = window.currentUserUID;
    if(!uid || !window.db || !window.fbDoc || !window.fbGetDoc) return;
    window.fbGetDoc(window.fbDoc(window.db, 'users', uid)).then(function(snap) {
      if(!snap.exists()) return;
      var data = snap.data();
      var fsUrls = data.galleryPhotos;
      if(!Array.isArray(fsUrls) || !fsUrls.length) return;
      // Fusionner avec localStorage (Firestore gagne en cas de conflit)
      var localUrls = [];
      try { localUrls = JSON.parse(localStorage.getItem('ambi241_pgallery_' + uid) || '[]'); } catch(e){}
      // Firestore est la source de vérité
      try { localStorage.setItem('ambi241_pgallery_' + uid, JSON.stringify(fsUrls.slice(0,12))); } catch(e){}
      // Raffraîchir la galerie dans l'UI
      setTimeout(function(){
        if(typeof _pGalleryRestore === 'function') {
          _pGalleryRestore('pgallery-membre');
          _pGalleryRestore('pgallery-etab');
        }
      }, 200);
    }).catch(function(e){ console.warn('[AMBI241] Gallery Firestore restore failed:', e); });
  };

  /* ── FIX #1 : Hook onAuthStateChanged pour restore galerie ── */
  // Surveiller le changement de UID pour déclencher la restauration
  var _lastGalleryUID = null;
  setInterval(function() {
    var uid = window.currentUserUID || null;
    if(uid && uid !== _lastGalleryUID) {
      _lastGalleryUID = uid;
      // Délai pour laisser Firebase initialiser
      setTimeout(function() {
        _pGalleryRestoreFromFirestore();
      }, 1500);
    }
  }, 600);

  /* ── FIX #1 : Avatar profil — reload depuis Firestore à chaque connexion ── */
  var _lastAvatarUID = null;
  setInterval(function() {
    var uid = window.currentUserUID || null;
    if(uid && uid !== _lastAvatarUID) {
      _lastAvatarUID = uid;
      // Attendre que l'UI soit prête
      setTimeout(function() {
        if(typeof window._renderUserPhotosUI === 'function') {
          window._renderUserPhotosUI();
        }
        // Aussi recharger l'avatar dans la barre de nav / header
        if(typeof loadUserAvatar === 'function') {
          loadUserAvatar(uid, function(url) {
            if(!url) return;
            // Avatar du profil principal
            var pavEl = document.getElementById('pav-membre');
            if(pavEl) {
              var img = pavEl.querySelector('img') || document.createElement('img');
              img.src = url;
              img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;z-index:1;';
              if(!pavEl.contains(img)) pavEl.prepend(img);
              Array.from(pavEl.childNodes).forEach(function(n){ if(n.nodeType===3) n.textContent=''; });
            }
            // Mini-avatar dans la quickbar publication
            var qba = document.getElementById('pubQuickbarAvatar');
            if(qba) {
              qba.innerHTML = '<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
            }
          });
        }
      }, 1200);
    }
  }, 600);

  /* ── FIX #2 : Nav bar — ajouter touch-action: manipulation ── */
  // Injecter CSS pour réduire le délai tactile sur mobile
  var navStyle = document.createElement('style');
  navStyle.textContent = [
    '.nav-item { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }',
    '.nav-item:active { transform: scale(0.88); opacity: 0.75; transition: transform 0.08s, opacity 0.08s; }',
    '/* Réduire la durée des transitions de sections */',
    '.section-hidden { display: none !important; }',
    '#sec-profil, #sec-accueil, #sec-etablissements, #sec-social, #sec-paiements {',
    '  will-change: auto;',  /* éviter les repaints coûteux sur sections cachées */
    '}'
  ].join('\n');
  document.head.appendChild(navStyle);

  /* ── FIX #3 : Toast amélioré pour redirection inscription ── */
  // Surcharger le toggleSocFab pour les visiteurs : afficher les options mais intercepter les clics
  var _origToggleSocFab = window.toggleSocFab;
  window.toggleSocFab = function() {
    if(!window.currentUserUID && !window.currentUserEmail) {
      // Visiteur : ouvrir directement l'inscription au lieu du FAB
      if(typeof window.showToast === 'function') {
        window.showToast('👤 Créez un compte gratuit pour accéder au social');
      }
      setTimeout(function(){
        var overlay = document.getElementById('userOverlay');
        if(overlay) overlay.classList.add('show');
        if(typeof switchUserTab === 'function') switchUserTab('inscription');
      }, 300);
      return;
    }
    if(typeof _origToggleSocFab === 'function') _origToggleSocFab();
  };

  console.log('[AMBI241] ✅ Patch v3.1 appliqué — Bugs #1 (photos) #2 (nav speed) #3 (guest redirect)');
})();

/* ══════════════════════════════════════════════════════════════════════
   SOCIAL PUBLICATIONS — JS (Posts · Discussions · Likes · Commentaires)
   ══════════════════════════════════════════════════════════════════════ */
(function(){

  /* ── Patch socSwitchTab — délègue à la version corrigée ── */
  /* La fonction base gère maintenant 'publications' correctement via tabMap */
  /* On garde juste l'init avatars quand on active publications */
  var _origSocSwitch = window.socSwitchTab;
  window.socSwitchTab = function(tab) {
    if(typeof _origSocSwitch === 'function') _origSocSwitch(tab);
    if(tab === 'publications') _socPubInitAvatars();
  };

  /* ── Init avatars dans le fil ── */
  function _socPubInitAvatars(){
    var pseudo = window.currentUserPseudo || window.currentUserEmail || '?';
    var letter = (pseudo[0] || '?').toUpperCase();
    var els = document.querySelectorAll('.socpub-comment-compose-avatar, #socPubComposeAvatar');
    els.forEach(function(el){ el.textContent = letter; });
  }

  /* ── Filtre catégories ── */
  window.socPubFilter = function(type, btn) {
    document.querySelectorAll('.socpub-fchip').forEach(function(c){ c.classList.remove('active'); });
    if(btn) btn.classList.add('active');
    var cards = document.querySelectorAll('.socpub-card');
    cards.forEach(function(card){
      if(type === 'all') {
        card.style.display = '';
      } else {
        card.style.display = (card.dataset.type === type) ? '' : 'none';
      }
    });
  };

  /* ── Toggle likes ── */
  window.socPubToggleLike = function(pubId, btn) {
    if(!btn) return;
    // Vérifier la connexion
    if(!window.currentUserUID){
      if(typeof window.showToast==='function') window.showToast('🔒 Connectez-vous pour liker !');
      return;
    }
    var active = btn.classList.toggle('active');
    // Mettre à jour le compteur (cherche likeCount_ dans les deux feeds)
    var countEl = document.getElementById('likeCount_' + pubId)
                || btn.querySelector('.socpub-action-count');
    if(countEl){
      var n = parseInt(countEl.textContent) || 0;
      countEl.textContent = active ? n + 1 : Math.max(0, n - 1);
    }
    // Couleur live
    btn.style.color = active ? 'var(--pink)' : '';
    // Mini animation
    btn.style.transform = 'scale(1.22)';
    setTimeout(function(){ btn.style.transform = ''; }, 180);
    // Sync Firebase (non bloquant)
    if(window.db && window.fbDoc && window.fbUpdateDoc){
      try {
        var newN = countEl ? (parseInt(countEl.textContent)||0) : 0;
        window.fbUpdateDoc(window.fbDoc(window.db,'publications',pubId),{likes:newN}).catch(function(){});
      } catch(e){}
    }
    if(typeof window.showToast==='function') window.showToast(active ? "❤️ J'aime !" : '💔 Retrait du like');
  };

  /* ── Réaction emoji ── */
  window.socPubReact = function(pubId, emoji, btn) {
    if(typeof window.showToast === 'function') window.showToast('Vous avez réagi ' + emoji);
    var picker = document.getElementById('emojipicker_' + pubId);
    if(picker) picker.style.display = 'none';
  };

  /* ── Toggle commentaires ── */
  window.socPubToggleComments = function(pubId) {
    var section = document.getElementById('comments_' + pubId);
    if(!section) return;
    var isOpen = section.style.display !== 'none';
    section.style.display = isOpen ? 'none' : 'block';
    if(!isOpen) {
      // Mettre à jour l'avatar de l'utilisateur connecté
      var myLetter = ((window.currentUserPseudo||window.currentUserEmail||'?')[0]||'?').toUpperCase();
      var avEl = document.getElementById('cmtAvatar_'+pubId);
      if(avEl) avEl.textContent = myLetter;
      // Charger les commentaires depuis Firebase si pas encore chargés
      var list = document.getElementById('commentsList_'+pubId);
      if(list && !list.dataset.loaded){
        list.dataset.loaded = '1';
        _socLoadComments(pubId, list);
      }
      var inp = document.getElementById('commentInput_' + pubId);
      if(inp) setTimeout(function(){ inp.focus(); }, 120);
    }
  };

  /* ── Charger les commentaires depuis Firebase ── */
  function _socLoadComments(pubId, listEl){
    if(!window.db || !window.fbCollection || !window.fbQuery || !window.fbOrderBy || !window.fbGetDocs) return;
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
          var cl = (c.pseudo||c.auteur||'?')[0].toUpperCase();
          var ct = c.createdAt && c.createdAt.toDate ? c.createdAt.toDate().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}) : "À l'instant";
          html += '<div class="socpub-comment">'
            +'<div class="socpub-comment-avatar">'+cl+'</div>'
            +'<div class="socpub-comment-body">'
            +'<div class="socpub-comment-author">'+_esc(c.pseudo||c.auteur||'Membre')+' <span class="socpub-comment-time">· '+ct+'</span></div>'
            +'<div class="socpub-comment-text">'+_esc(c.texte||c.text||c.message||'')+'</div>'
            +'<div class="socpub-comment-actions"><button onclick="socCommentLike(this)">👍 <span>0</span></button></div>'
            +'</div></div>';
        });
        if(html) listEl.innerHTML = html;
        // Mettre à jour le compteur
        var cc = document.getElementById('cmtCount_'+pubId);
        if(cc) cc.textContent = snap.size;
      }).catch(function(){});
    } catch(e){}
  }

  /* ── Soumettre un commentaire ── */
  window.socSubmitComment = function(pubId) {
    /* Déléguer à sendPubComment (Firebase) si disponible */
    if(!window.currentUserUID){
      if(typeof window.showToast==='function') window.showToast('🔒 Connectez-vous pour commenter'); return;
    }
    var inpSoc = document.getElementById('commentInput_' + pubId);
    /* sendPubComment attend un textarea id="pubCmtTxt_{pubId}" */
    var inpPub = document.getElementById('pubCmtTxt_' + pubId);
    if(inpSoc && !inpPub){
      var fake = document.createElement('textarea');
      fake.id = 'pubCmtTxt_' + pubId; fake.value = inpSoc.value; fake.style.display = 'none';
      document.body.appendChild(fake);
    } else if(inpSoc && inpPub && !inpPub.value){
      inpPub.value = inpSoc.value;
    }
    if(typeof window.sendPubComment === 'function'){
      window.sendPubComment(pubId);
      setTimeout(function(){
        var proxy = document.getElementById('pubCmtTxt_' + pubId);
        if(proxy && proxy.style.display === 'none'){ if(inpSoc) inpSoc.value = ''; proxy.remove(); }
        else if(inpSoc && inpPub) inpSoc.value = inpPub.value;
      }, 500);
      return;
    }
    /* Fallback DOM local */
    var inp = inpSoc || document.getElementById('pubCmtTxt_' + pubId);
    if(!inp || !inp.value.trim()) return;
    var text = inp.value.trim(); inp.value = '';
    var list = document.getElementById('commentsList_' + pubId); if(!list) return;
    var pseudo = window.currentUserPseudo || window.currentUserEmail || 'Moi';
    var letter = (pseudo[0] || '?').toUpperCase();
    var html = '<div class="socpub-comment" style="animation:fadeUp 0.2s ease;">'
      + '<div class="socpub-comment-avatar">'+letter+'</div>'
      + '<div class="socpub-comment-body">'
      + '<div class="socpub-comment-author">'+_esc(pseudo)+' <span class="socpub-comment-time">· À l\'instant</span></div>'
      + '<div class="socpub-comment-text">'+_esc(text)+'</div>'
      + '<div class="socpub-comment-actions"><button onclick="socCommentLike(this)">👍 <span>0</span></button><button onclick="socOpenReply(\''+pubId+'\',\'new\',this)">↩ Répondre</button></div>'
      + '</div></div>';
    list.insertAdjacentHTML('beforeend', html);
    // Mettre à jour le compteur de commentaires
    var cc = document.getElementById('cmtCount_'+pubId);
    if(cc) cc.textContent = (parseInt(cc.textContent)||0) + 1;
    if(typeof window.showToast === 'function') window.showToast('💬 Commentaire publié !');
  };

  /* ── Like commentaire ── */
  window.socCommentLike = function(btn) {
    var span = btn.querySelector('span');
    if(!span) return;
    var n = parseInt(span.textContent) || 0;
    span.textContent = n + 1;
    btn.style.color = 'var(--pink)';
  };

  /* ── Ouvrir réponse ── */
  window.socOpenReply = function(pubId, commentId, btn) {
    var inp = document.getElementById('commentInput_' + pubId);
    if(inp) { inp.placeholder = '↩ Répondre…'; inp.focus(); }
  };

  /* ── Partager ── */
  window.socPubShare = function(pubId) {
    var url = window.location.href.split('#')[0] + '#pub-' + pubId;
    var card = document.querySelector('[data-pub-id="'+pubId+'"]');
    var authorEl = card ? card.querySelector('.socpub-author') : null;
    var author = authorEl ? authorEl.textContent.trim().replace('✓','').trim() : 'AMBI241';
    var textEl = card ? card.querySelector('.socpub-text') : null;
    var text = textEl ? textEl.textContent.trim().slice(0,80) : 'Ambiance à Libreville';
    if(navigator.share){
      navigator.share({ title: 'AMBI241 — '+author, text: text, url: url })
        .catch(function(){});
    } else {
      try { navigator.clipboard.writeText(url); } catch(e){}
      if(typeof window.showToast === 'function') window.showToast('📋 Lien copié dans le presse-papier !');
    }
  };

  /* ── RSVP Événement ── */
  window.socEventRsvp = function(pubId, type, btn) {
    var siblings = btn.parentNode.querySelectorAll('.socpub-event-cta');
    siblings.forEach(function(s){ if(s.dataset && s.classList) s.classList.remove('active'); });
    btn.classList.add('active');
    var countSpan = btn.querySelector('span');
    if(countSpan) {
      var n = parseInt(countSpan.textContent) || 0;
      countSpan.textContent = n + 1;
    }
    var msg = type === 'interesse' ? '⭐ Vous êtes intéressé(e) !' : '✅ Participation confirmée !';
    if(typeof window.showToast === 'function') window.showToast(msg);
  };

  /* ── Menu contextuel ── */
  window.socPubMoreMenu = function(pubId, btn) {
    if(typeof window.showToast === 'function') window.showToast('📋 Options : Signaler · Copier le lien · Partager');
  };

  /* ── Load more ── */
  window.socPubLoadMore = function() {
    if(typeof window.showToast === 'function') window.showToast('⬇ Chargement des publications…');
  };

  /* ══════════════════════════════════════════════════════════
     ══  MODAL PUBLICATION — version enrichie AMBI241 PRO  ══
     ══════════════════════════════════════════════════════════ */

  /* ── État interne du composer ── */
  var _spState = {
    type: 'ambiance',
    mood: '🔥',
    visibility: 'public',
    mentions: [],
    gifUrl: null,
    videoPreviewUrl: null,
    pollData: null,
    location: null
  };

  /* ── Ouvrir / Fermer ── */
  window.socOpenPublishModal = function(type) {
    var modal = document.getElementById('socPubModal');
    if(!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    var t = type || 'ambiance';
    var chip = document.querySelector('.socpub-type-chip[onclick*="\''+t+'\'"]');
    if(chip) socPubSelectType(t, chip);
    _socPubInitAvatars();
    // reset
    _spState = { type:t, mood:'🔥', visibility:'public', mentions:[], gifUrl:null, videoPreviewUrl:null, pollData:null, location:null };
  };
  window.socClosePubModal = function() {
    var modal = document.getElementById('socPubModal');
    if(modal) modal.classList.remove('open');
    document.body.style.overflow = '';
  };

  /* ── Sélection du type ── */
  window.socPubSelectType = function(type, btn) {
    _spState.type = type;
    document.querySelectorAll('.socpub-type-chip').forEach(function(c){ c.classList.remove('active'); });
    if(btn) btn.classList.add('active');
    var ta = document.getElementById('socPubTextarea');
    var placeholders = {
      ambiance: '🔥 Quelle ambiance ce soir ? @mention possible…',
      avis:     '⭐ Donnez votre avis sur un établissement…',
      soiree:   '🎉 Décrivez l\'ambiance de la soirée…',
      annonce:  '📣 Votre annonce pour la communauté…',
      photo:    '📷 Décrivez votre photo…',
      video:    '🎬 Décrivez votre vidéo…',
      event:    '🗓 Détails de votre événement…',
      sondage:  '📊 Contexte du sondage (optionnel)…'
    };
    if(ta) ta.placeholder = placeholders[type] || placeholders.ambiance;
    // Afficher/masquer panneau sondage
    var pollPanel = document.getElementById('socPubPollPanel');
    if(pollPanel) pollPanel.style.display = (type==='sondage') ? 'block' : 'none';
    // Si type vidéo, cliquer input vidéo directement
    if(type==='video') document.getElementById('socPubVideoInput').click();
  };

  /* ── Sélection mood/ambiance ── */
  window.socPubSelectMood = function(mood, btn) {
    _spState.mood = mood;
    document.querySelectorAll('.socpub-mood-chip').forEach(function(c){ c.classList.remove('active'); });
    if(btn) btn.classList.add('active');
  };

  /* ── Visibilité ── */
  window.socPubSetVisibility = function(vis, btn) {
    _spState.visibility = vis;
    document.querySelectorAll('.socpub-vis-btn').forEach(function(b){ b.classList.remove('active'); });
    if(btn) btn.classList.add('active');
  };

  /* ── Input texte + mentions @ ── */
  var _mentionUsers = []; // Chargés depuis Firebase (membres réels uniquement)
  window.socPubOnTextInput = function(ta) {
    // Compteur
    var cc = document.getElementById('socPubCharCount'); if(cc) cc.textContent = ta.value.length;
    // Détection @mention
    var val = ta.value, curPos = ta.selectionStart;
    var before = val.substring(0, curPos);
    var m = before.match(/@(\w*)$/);
    var box = document.getElementById('socPubMentionBox');
    if(m && box) {
      var q = m[1].toLowerCase();
      var filtered = _mentionUsers.filter(function(u){ return u.toLowerCase().startsWith(q); });
      if(filtered.length) {
        box.style.display='block';
        box.innerHTML = filtered.map(function(u){
          return '<div onclick="socPubInsertMention(\''+u+'\')" style="padding:0.35rem 0.6rem;border-radius:8px;font-size:0.75rem;cursor:pointer;display:flex;align-items:center;gap:0.4rem;transition:background 0.15s;" onmouseover="this.style.background=\'rgba(255,45,155,0.12)\'" onmouseout="this.style.background=\'transparent\'">'
            +'<span style="width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--purple));display:inline-flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:800;color:#fff;flex-shrink:0;">'+u[0].toUpperCase()+'</span>'
            +'<span style="color:var(--text);font-weight:600;">@'+u+'</span></div>';
        }).join('');
      } else { box.style.display='none'; }
    } else if(box) { box.style.display='none'; }
  };
  window.socPubInsertMention = function(user) {
    var ta = document.getElementById('socPubTextarea');
    var box = document.getElementById('socPubMentionBox');
    if(!ta) return;
    var val = ta.value, cur = ta.selectionStart;
    var before = val.substring(0,cur).replace(/@\w*$/, '@'+user+' ');
    ta.value = before + val.substring(cur);
    if(box) box.style.display='none';
    if(!_spState.mentions.includes(user)) _spState.mentions.push(user);
    var ml = document.getElementById('socPubMentionsList');
    if(ml) ml.textContent = _spState.mentions.map(function(u){return '@'+u;}).join(' ');
    ta.focus();
  };

  /* ── Photos ── */
  window.socPubOnPhotosSelected = function(inp) {
    var preview = document.getElementById('socPubMediaPreview');
    if(!preview || !inp.files) return;
    Array.from(inp.files).slice(0, 5).forEach(function(file) {
      var reader = new FileReader();
      reader.onload = function(ev) {
        var div = document.createElement('div');
        div.style.cssText = 'width:74px;height:74px;border-radius:12px;overflow:hidden;border:2px solid rgba(255,45,155,0.35);position:relative;flex-shrink:0;cursor:pointer;';
        div.innerHTML = '<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover;">'
          + '<button onclick="this.parentNode.remove()" style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;background:rgba(0,0,0,0.75);color:#fff;border:none;font-size:0.62rem;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;">✕</button>';
        preview.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
    // auto-select type photo
    var chipPhoto = document.querySelector('.socpub-type-chip[onclick*="\'photo\'"]');
    if(chipPhoto) socPubSelectType('photo', chipPhoto);
  };

  /* ── Vidéo avec preview ── */
  window.socPubOnVideoSelected = function(inp) {
    var preview = document.getElementById('socPubMediaPreview');
    if(!preview || !inp.files || !inp.files[0]) return;
    var file = inp.files[0];
    var url = URL.createObjectURL(file);
    _spState.videoPreviewUrl = url;
    // Vignette vidéo
    var div = document.createElement('div');
    div.id = 'socPubVideoPreviewDiv';
    div.style.cssText = 'width:100%;border-radius:14px;overflow:hidden;border:2px solid rgba(0,229,255,0.35);position:relative;margin-bottom:0.5rem;';
    div.innerHTML = '<video src="'+url+'" controls style="width:100%;max-height:200px;display:block;background:#000;" playsinline></video>'
      + '<div style="position:absolute;top:6px;right:6px;display:flex;gap:4px;">'
      + '<span style="background:rgba(0,229,255,0.85);color:#000;font-size:0.6rem;font-weight:800;padding:2px 7px;border-radius:5px;">VIDÉO</span>'
      + '<button onclick="document.getElementById(\'socPubVideoPreviewDiv\').remove();_spState.videoPreviewUrl=null;" style="width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.75);color:#fff;border:none;font-size:0.65rem;cursor:pointer;">✕</button>'
      + '</div>';
    // Supprimer ancien preview vidéo si présent
    var old = document.getElementById('socPubVideoPreviewDiv');
    if(old) old.remove();
    preview.prepend(div);
    // auto-select type vidéo
    var chipVid = document.querySelector('.socpub-type-chip[onclick*="\'video\'"]');
    if(chipVid) { document.querySelectorAll('.socpub-type-chip').forEach(function(c){c.classList.remove('active');}); chipVid.classList.add('active'); _spState.type='video'; }
  };

  /* ── Localisation ── */
  window.socPubAddLocation = function() {
    if(navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function(pos){
        _spState.location = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Libreville, Gabon' };
        if(typeof window.showToast==='function') window.showToast('📍 Position GPS capturée !');
      }, function(){
        _spState.location = { lat:-0.7893, lng:8.7776, label:'Libreville, Gabon' };
        if(typeof window.showToast==='function') window.showToast('📍 Libreville, Gabon ajouté');
      });
    } else {
      _spState.location = { lat:-0.7893, lng:8.7776, label:'Libreville, Gabon' };
      if(typeof window.showToast==='function') window.showToast('📍 Libreville, Gabon ajouté');
    }
  };

  /* ── GIF picker (Tenor via proxy CORS) ── */
  var _gifTimer = null;
  window.socPubOpenGif = function() {
    var panel = document.getElementById('socPubGifPanel');
    if(!panel) return;
    panel.style.display = panel.style.display==='none' ? 'block' : 'none';
    if(panel.style.display==='block') socPubSearchGif('ambiance gabon');
  };
  window.socPubSearchGif = function(q) {
    clearTimeout(_gifTimer);
    if(!q || q.length < 2) return;
    _gifTimer = setTimeout(function(){
      var grid = document.getElementById('socPubGifGrid');
      if(!grid) return;
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:1rem;color:var(--muted);font-size:0.7rem;">🔍 Recherche en cours…</div>';
      // Tenor API (clé publique de démo)
      var url = 'https://tenor.googleapis.com/v2/search?q='+encodeURIComponent(q)+'&key=AIzaSyAyimkuYQYF_FXVALexPmHA2zHg0B8XHHA&limit=9&media_filter=gif';
      fetch(url)
        .then(function(r){return r.json();})
        .then(function(data){
          grid.innerHTML='';
          if(!data.results||!data.results.length){grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:0.8rem;color:var(--muted);font-size:0.7rem;">Aucun GIF trouvé</div>';return;}
          data.results.forEach(function(item){
            var gifUrl = item.media_formats && item.media_formats.tinygif ? item.media_formats.tinygif.url : '';
            if(!gifUrl) return;
            var img = document.createElement('img');
            img.src = gifUrl;
            img.style.cssText='width:100%;height:70px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s;';
            img.onclick = function(){ socPubSelectGif(gifUrl); };
            img.onmouseover=function(){this.style.borderColor='var(--cyan)';};
            img.onmouseout=function(){this.style.borderColor=this.classList.contains('selected')?'var(--cyan)':'transparent';};
            grid.appendChild(img);
          });
        })
        .catch(function(){
          grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:0.8rem;color:var(--muted);font-size:0.7rem;">⚠️ GIF indisponible hors connexion</div>';
        });
    }, 500);
  };
  window.socPubSelectGif = function(url) {
    _spState.gifUrl = url;
    var preview = document.getElementById('socPubMediaPreview');
    var old = document.getElementById('socPubGifPreviewItem');
    if(old) old.remove();
    if(preview) {
      var div=document.createElement('div');
      div.id='socPubGifPreviewItem';
      div.style.cssText='width:90px;height:70px;border-radius:10px;overflow:hidden;border:2px solid rgba(0,229,255,0.4);position:relative;flex-shrink:0;';
      div.innerHTML='<img src="'+url+'" style="width:100%;height:100%;object-fit:cover;">'
        +'<span style="position:absolute;bottom:2px;left:3px;background:rgba(0,229,255,0.85);color:#000;font-size:0.52rem;font-weight:900;padding:1px 4px;border-radius:4px;">GIF</span>'
        +'<button onclick="this.parentNode.remove();_spState.gifUrl=null;" style="position:absolute;top:2px;right:2px;width:16px;height:16px;border-radius:50%;background:rgba(0,0,0,0.75);color:#fff;border:none;font-size:0.55rem;cursor:pointer;">✕</button>';
      preview.appendChild(div);
    }
    var panel = document.getElementById('socPubGifPanel');
    if(panel) panel.style.display='none';
    if(typeof window.showToast==='function') window.showToast('🎞️ GIF sélectionné !');
  };

  /* ── Sondage : ajouter option ── */
  window.socPubAddPollOption = function() {
    var opts = document.querySelectorAll('.socpub-poll-opt');
    if(opts.length >= 4) { if(typeof window.showToast==='function') window.showToast('Maximum 4 options'); return; }
    var inp = document.createElement('input');
    inp.className='socpub-poll-input socpub-poll-opt';
    inp.placeholder='Option '+(opts.length+1);
    inp.maxLength=60;
    inp.style.cssText='width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(204,68,255,0.2);border-radius:9px;color:var(--text);font-family:\'DM Sans\',sans-serif;font-size:0.78rem;padding:0.42rem 0.7rem;outline:none;margin-bottom:0.35rem;';
    document.getElementById('socPubPollOptions').appendChild(inp);
  };

  /* ── Save Firebase ── */
  async function _socPubSaveFirebase(pubData) {
    if(!window.db || !window.fbAddDoc || !window.fbCollection) return null;
    try {
      var ref = await window.fbAddDoc(window.fbCollection(window.db, 'publications'), pubData);
      return ref.id;
    } catch(e) { console.warn('[AMBI241] Firebase save error:', e); return null; }
  }

  /* ── Soumettre publication ── */
  window.socSubmitNewPub = function() {
    var ta = document.getElementById('socPubTextarea');
    var text = ta ? ta.value.trim() : '';
    // Sondage : vérifier question
    var isPoll = _spState.type === 'sondage';
    if(isPoll) {
      var pollQ = document.getElementById('socPubPollQ');
      if(!pollQ || !pollQ.value.trim()) {
        if(typeof window.showToast==='function') window.showToast('📊 Entrez une question pour le sondage');
        return;
      }
    } else if(!text && !_spState.gifUrl && !_spState.videoPreviewUrl && document.querySelectorAll('#socPubMediaPreview > div').length === 0) {
      if(typeof window.showToast==='function') window.showToast('✍️ Ajoutez du contenu avant de publier');
      return;
    }
    var submitBtn = document.getElementById('socPubSubmitBtn');
    if(submitBtn) { submitBtn.disabled=true; submitBtn.textContent='⏳ Publication…'; }

    var pseudo = window.currentUserPseudo || window.currentUserEmail || 'Moi';
    var uid = window.currentUserUID || ('anon_'+Date.now());
    var letter = (pseudo[0]||'?').toUpperCase();
    var etab = document.getElementById('socPubEtabSelect');
    var etabVal = etab ? etab.value : '';
    var etabName = etab && etab.value ? etab.options[etab.selectedIndex].text : '';
    var ts = Date.now();
    var pubId = 'sp_new_'+ts;

    // Collecter les photos depuis la prévisualisation (base64)
    var _photoEls2 = document.querySelectorAll('#socPubMediaPreview > div:not(#socPubVideoPreviewDiv):not(#socPubGifPreviewItem)');
    var _photoURLs2 = [];
    _photoEls2.forEach(function(el){
      var img = el.querySelector('img');
      if(img && img.src && img.src.startsWith('data:')) _photoURLs2.push(img.src);
    });
    // Fallback : images du feed local déjà construites
    if(!_photoURLs2.length){
      document.querySelectorAll('#socPubMediaPreview img').forEach(function(img){
        if(img.src && img.src.startsWith('data:') && !img.closest('#socPubVideoPreviewDiv') && !img.closest('#socPubGifPreviewItem')){
          _photoURLs2.push(img.src);
        }
      });
    }

    // Construire objet publication
    var pubData = {
      id: pubId,
      type: _spState.type,
      mood: _spState.mood,
      visibility: _spState.visibility,
      text: text,
      texte: text,
      mentions: _spState.mentions,
      etab: etabVal,
      etabName: etabName,
      location: _spState.location,
      gifUrl: _spState.gifUrl || null,
      hasVideo: !!_spState.videoPreviewUrl,
      photos: _photoURLs2,
      photoURLs: _photoURLs2,
      author: pseudo,
      pseudo: pseudo,
      auteur: pseudo,
      uid: uid,
      authorUid: uid,
      photoURL: window.currentUserPhotoURL || window.currentUserPhoto || '',
      authorLetter: letter,
      timestamp: ts,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0
    };

    // Sondage
    if(isPoll) {
      var opts = Array.from(document.querySelectorAll('.socpub-poll-opt')).map(function(i){return i.value.trim();}).filter(Boolean);
      var dur = document.getElementById('socPubPollDuration');
      pubData.poll = { question: document.getElementById('socPubPollQ').value.trim(), options: opts, duration: dur ? parseInt(dur.value) : 3, votes: opts.map(function(){return 0;}) };
    }

    // Construire le HTML feed
    var mediaHtml = '';
    var imgs = document.querySelectorAll('#socPubMediaPreview img:not([style*="height:100"])'); // hack: photos uniquement
    // Preview vidéo
    if(_spState.videoPreviewUrl) {
      mediaHtml += '<div style="border-radius:12px;overflow:hidden;margin:0.6rem 0;border:1.5px solid rgba(0,229,255,0.25);">'
        +'<video src="'+_spState.videoPreviewUrl+'" controls style="width:100%;max-height:240px;display:block;background:#000;" playsinline></video></div>';
    }
    // GIF
    if(_spState.gifUrl) {
      mediaHtml += '<div style="border-radius:12px;overflow:hidden;margin:0.6rem 0;"><img src="'+_spState.gifUrl+'" style="width:100%;max-height:200px;object-fit:cover;display:block;"></div>';
    }
    // Photos
    var photoEls = document.querySelectorAll('#socPubMediaPreview > div:not(#socPubVideoPreviewDiv):not(#socPubGifPreviewItem)');
    if(photoEls.length) {
      var cols = photoEls.length===1?'1fr':(photoEls.length===2?'1fr 1fr':'1fr 1fr 1fr');
      mediaHtml += '<div style="display:grid;grid-template-columns:'+cols+';gap:4px;margin:0.6rem 0;border-radius:12px;overflow:hidden;">';
      photoEls.forEach(function(el){
        var img = el.querySelector('img');
        if(img) mediaHtml += '<img src="'+img.src+'" style="width:100%;height:110px;object-fit:cover;">';
      });
      mediaHtml += '</div>';
    }
    // Sondage
    if(isPoll && pubData.poll) {
      var pq = pubData.poll;
      mediaHtml += '<div style="background:rgba(204,68,255,0.08);border:1px solid rgba(204,68,255,0.25);border-radius:14px;padding:0.85rem;margin:0.6rem 0;">'
        +'<div style="font-family:\'Syne\',sans-serif;font-size:0.85rem;font-weight:800;color:var(--purple);margin-bottom:0.6rem;">📊 '+_esc(pq.question)+'</div>'
        + pq.options.map(function(opt,i){
          return '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(204,68,255,0.2);border-radius:9px;padding:0.45rem 0.75rem;margin-bottom:0.3rem;font-size:0.78rem;cursor:pointer;transition:all 0.15s;" onclick="socPubVotePoll(this,'+i+')">'
            +'<div style="display:flex;justify-content:space-between;align-items:center;"><span>'+_esc(opt)+'</span><span style="color:var(--purple);font-size:0.68rem;font-weight:700;">0%</span></div>'
            +'<div style="height:3px;background:rgba(204,68,255,0.15);border-radius:3px;margin-top:0.3rem;"><div style="height:100%;width:0%;background:var(--purple);border-radius:3px;transition:width 0.4s;"></div></div></div>';
        }).join('')
        +'<div style="font-size:0.62rem;color:var(--muted);margin-top:0.3rem;">Expire dans '+pq.duration+' jour(s)</div></div>';
    }
    // Localisation
    var locHtml = _spState.location ? ' · <span style="color:var(--green);">📍 '+_esc(_spState.location.label)+'</span>' : ' · 📍 Libreville';
    // Mood badge
    var moodBadge = '<span style="background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.25);border-radius:6px;font-size:0.65rem;padding:1px 6px;margin-left:0.3rem;">'+_spState.mood+'</span>';
    // Visibilité
    var visIcons = {public:'🌐',amis:'👥',moi:'🔒'};

    var html = '<article class="socpub-card" data-pub-id="'+pubId+'" data-type="'+_spState.type+'" style="border-color:rgba(0,255,170,0.3);">'
      + '<div class="socpub-card-header">'
      + '<div class="socpub-avatar">'+letter+'</div>'
      + '<div class="socpub-meta"><div class="socpub-author">'+_esc(pseudo)+' <span class="socpub-badge verifie">✓</span>'+moodBadge+'</div>'
      + '<div class="socpub-time">À l\'instant'+locHtml+' <span style="font-size:0.6rem;opacity:0.6;">'+visIcons[_spState.visibility]+'</span></div></div>'
      + '<div class="socpub-more-btn" onclick="socPubMoreMenu(\''+pubId+'\',this)">⋯</div></div>'
      + (text ? '<p class="socpub-text">'+_esc(text).replace(/@(\w+)/g,'<span style="color:var(--cyan);">@$1</span>')+'</p>' : '')
      + mediaHtml
      + (etabName ? '<div style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.18);border-radius:8px;padding:0.25rem 0.55rem;font-size:0.65rem;color:var(--cyan);margin:0.35rem 0 0.5rem;">📍 '+_esc(etabName)+'</div>' : '')
      + '<div class="socpub-action-bar">'
      + '<button class="socpub-action-btn like" onclick="socPubToggleLike(\''+pubId+'\',this)"><span class="socpub-action-icon">❤️</span> J\'aime <span class="socpub-action-count">0</span></button>'
      + '<button class="socpub-action-btn comment" onclick="socPubToggleComments(\''+pubId+'\')"><span class="socpub-action-icon">💬</span> Commenter</button>'
      + '<button class="socpub-action-btn share" onclick="socPubShare(\''+pubId+'\')"><span class="socpub-action-icon">↪️</span> Partager</button>'
      + '</div></article>';

    var feed = document.getElementById('socPubFeed');
    if(feed) {
      var loadMore = feed.querySelector('.socpub-load-more');
      if(loadMore) loadMore.insertAdjacentHTML('beforebegin', html);
      else feed.insertAdjacentHTML('afterbegin', html);
    }

    // Reset modal
    if(ta) ta.value = '';
    var cc = document.getElementById('socPubCharCount'); if(cc) cc.textContent='0';
    var prev = document.getElementById('socPubMediaPreview'); if(prev) prev.innerHTML='';
    var pollPanel = document.getElementById('socPubPollPanel'); if(pollPanel) pollPanel.style.display='none';
    var gifPanel = document.getElementById('socPubGifPanel'); if(gifPanel) gifPanel.style.display='none';
    var mb = document.getElementById('socPubMentionsList'); if(mb) mb.textContent='';
    var mentBox = document.getElementById('socPubMentionBox'); if(mentBox) mentBox.style.display='none';
    _spState = {type:'ambiance',mood:'🔥',visibility:'public',mentions:[],gifUrl:null,videoPreviewUrl:null,pollData:null,location:null};

    // Compteur quotidien
    var used = document.getElementById('socPubDailyUsed');
    if(used) { var n=parseInt(used.textContent)+1; used.textContent=n; }

    socClosePubModal();
    if(typeof window.showToast==='function') window.showToast('🚀 Publication partagée !');

    // Sauvegarde Firebase — convertir vidéo en base64 avant envoi
    (function(){
      var videoUrl = _spState ? _spState.videoPreviewUrl : null;
      var _etabForLimit = etabVal || '';
      // Vérifier limite vidéo par étab
      if(videoUrl && _etabForLimit){
        var _etabVidKey = 'etabvid_'+_etabForLimit+'_'+new Date().toISOString().slice(0,10);
        var _etabVidCount = 0;
        try{ _etabVidCount = parseInt(localStorage.getItem(_etabVidKey)||'0'); }catch(e){}
        if(_etabVidCount >= 2){
          if(typeof window.showToast==='function') window.showToast('🎬 Limite de 2 vidéos par établissement et par jour atteinte !');
          // Publier sans vidéo
          pubData.hasVideo = false;
          pubData.video = null;
          _socPubSaveFirebase(pubData).then(function(fid){
            if(fid) console.log('[AMBI241] pub saved (video blocked) firebase id:', fid);
          });
          return;
        }
      }
      if(!videoUrl){
        _socPubSaveFirebase(pubData).then(function(fid){
          if(fid) console.log('[AMBI241] pub saved firebase id:', fid);
        });
        return;
      }
      // Convertir blob vidéo → base64
      fetch(videoUrl).then(function(r){ return r.blob(); }).then(function(blob){
        var reader = new FileReader();
        reader.onload = function(ev){
          pubData.video = ev.target.result;
          pubData.hasVideo = true;
          pubData.isVideo = true;
          pubData.expiresAt = new Date(Date.now() + 24*60*60*1000).toISOString();
          _socPubSaveFirebase(pubData).then(function(fid){
            if(fid){
              console.log('[AMBI241] pub+vidéo saved firebase id:', fid);
              // Incrémenter compteur vidéo par étab
              if(_etabForLimit){
                var _key = 'etabvid_'+_etabForLimit+'_'+new Date().toISOString().slice(0,10);
                try{ localStorage.setItem(_key, (parseInt(localStorage.getItem(_key)||'0')+1)); }catch(e){}
              }
            }
          });
        };
        reader.readAsDataURL(blob);
      }).catch(function(){
        _socPubSaveFirebase(pubData).then(function(fid){
          if(fid) console.log('[AMBI241] pub saved (no video) firebase id:', fid);
        });
      });
    })();

    if(submitBtn) { submitBtn.disabled=false; submitBtn.textContent='🚀 Publier maintenant'; }
  };

  /* ── Vote sondage (UI locale) ── */
  window.socPubVotePoll = function(optEl, idx) {
    var pollWrap = optEl.closest('div[style*="border-radius:14px"]');
    if(!pollWrap || optEl.dataset.voted) return;
    var bars = pollWrap.querySelectorAll('[style*="height:3px"]');
    var fills = pollWrap.querySelectorAll('[style*="width:0%"]');
    var pcts = pollWrap.querySelectorAll('[style*="0%"]');
    // Simuler vote : option choisie 67%, autres 33%/(n-1)
    var n = bars.length; if(!n) return;
    optEl.dataset.voted='1';
    optEl.style.borderColor='var(--purple)'; optEl.style.background='rgba(204,68,255,0.1)';
    Array.from(pollWrap.querySelectorAll('[onclick^="socPubVotePoll"]')).forEach(function(el,i){
      var pct = i===idx ? 67 : Math.floor(33/(n-1));
      var fill = el.querySelector('[style*="height:100%"]');
      var pctEl = el.querySelector('[style*="color:var(--purple)"]');
      if(fill) fill.style.width=pct+'%';
      if(pctEl) pctEl.textContent=pct+'%';
      el.style.pointerEvents='none';
    });
  };
  window.socPubVotePoll = window.socPubVotePoll;

  /* ── ADMIN : switchAdminTab patch ── */
  var _origSwitchAdminTab = window.switchAdminTab;
  window.switchAdminTab = function(tab) {
    if(tab === 'publicationsmod') {
      // Masquer tous les panels
      var panels = document.querySelectorAll('[id^="panel"]');
      panels.forEach(function(p){ p.style.display = 'none'; });
      // Désactiver tous les tabs admin
      var adminBtns = document.querySelectorAll('#adminTabs button');
      adminBtns.forEach(function(b){ b.style.background = 'transparent'; });
      // Activer Publications
      var pubPanel = document.getElementById('panelPublicationsMod');
      if(pubPanel) pubPanel.style.display = 'block';
      var pubTabBtn = document.getElementById('tabPublicationsMod');
      if(pubTabBtn) { pubTabBtn.style.background = 'var(--cyan)'; pubTabBtn.style.color = '#000'; }
      _admPubLoadStats();
      return;
    }
    if(typeof _origSwitchAdminTab === 'function') _origSwitchAdminTab(tab);
    // Cacher publications panel si autre onglet
    var pubPanel = document.getElementById('panelPublicationsMod');
    if(pubPanel) pubPanel.style.display = 'none';
  };

  /* ── Admin : charger stats ── */
  function _admPubLoadStats() {
    // Simuler des stats depuis le feed actuel
    var cards = document.querySelectorAll('.socpub-card');
    var el;
    el = document.getElementById('admPubTotal'); if(el) el.textContent = cards.length || 4;
    el = document.getElementById('admPubLikes'); if(el) el.textContent = '192';
    el = document.getElementById('admPubComments'); if(el) el.textContent = '28';
    el = document.getElementById('admPubFlagged'); if(el) el.textContent = '1';
  }

  /* ── Admin : filtre publications ── */
  window.admPubFilter = function(type, btn) {
    document.querySelectorAll('#panelPublicationsMod .asm-filter-chip').forEach(function(c){ c.classList.remove('active'); });
    if(btn) btn.classList.add('active');
  };

  /* ── Admin : actions sur posts ── */
  window.admPubAction = function(action, postId) {
    var msgs = { pin:'📌 Publication épinglée !', unpin:'📌 Publication désépinglée', approve:'✅ Publication approuvée', hide:'🙈 Publication masquée', flag:'🚩 Publication signalée', delete:'🗑 Publication supprimée' };
    if(typeof window.showToast === 'function') window.showToast(msgs[action] || 'Action effectuée');
    if(action === 'delete') {
      var card = document.querySelector('.adm-socpub-post[data-id="'+postId+'"]');
      if(card) card.remove();
    }
  };

  /* ── Admin : règles ── */
  window.admPubRuleChange = function(rule, val) {
    var labels = { modBefore:'Modération avant publication', dailyLimit:'Limite quotidienne', photos:'Photos autorisées', comments:'Commentaires', autoFilter:'Filtre auto', publicFeed:'Feed public' };
    var msg = (labels[rule]||rule) + (val ? ' activé ✅' : ' désactivé ⚠️');
    if(typeof window.showToast === 'function') window.showToast(msg);
  };

  /* ── Admin : mots interdits ── */
  window.admAddBannedWord = function() {
    var inp = document.getElementById('admBannedWordInput');
    if(!inp || !inp.value.trim()) return;
    var word = inp.value.trim().toLowerCase();
    var list = document.getElementById('admBannedWordsList');
    if(list) {
      var span = document.createElement('span');
      span.style.cssText = 'background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.3);color:var(--red);font-size:0.68rem;font-weight:700;padding:0.15rem 0.55rem;border-radius:20px;cursor:pointer;';
      span.textContent = word + ' ✕';
      span.onclick = function(){ admRemoveBannedWord(this); };
      list.appendChild(span);
    }
    inp.value = '';
    if(typeof window.showToast === 'function') window.showToast('🚫 Mot interdit ajouté : ' + word);
  };
  window.admRemoveBannedWord = function(el) {
    if(el && el.parentNode) el.parentNode.removeChild(el);
  };

  /* ── Admin : export ── */
  window.admPubExport = function(format) {
    if(typeof window.showToast === 'function') window.showToast('📤 Export '+format.toUpperCase()+' en cours…');
  };

  /* ── Helper escape ── */
  function _esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Activer onglet Publications par défaut à l'ouverture de sec-social ── */
  // Patcher la navigation principale pour activer publications quand on arrive sur social
  var _origSwitchSection = window.switchSection;
  window.switchSection = function(name, btn) {
    if(typeof _origSwitchSection === 'function') _origSwitchSection(name, btn);
    if(name === 'social') {
      setTimeout(function(){
        // Activer le pane publications et son onglet
        var pane = document.getElementById('pane-publications');
        var tabs = document.querySelectorAll('#sec-social .soc-pane');
        var tabBtns = document.querySelectorAll('#sec-social .soc-tab');
        if(pane && !document.querySelector('#sec-social .soc-pane.active')) {
          tabs.forEach(function(p){ p.classList.remove('active'); });
          tabBtns.forEach(function(t){ t.classList.remove('active'); });
          pane.classList.add('active');
          if(tabBtns[0]) tabBtns[0].classList.add('active');
        }
        _socPubInitAvatars();
      }, 80);
    }
  };

  console.log('[AMBI241] ✅ Social Publications Panel — chargé');
})();