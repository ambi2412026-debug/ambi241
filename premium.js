(function(){
'use strict';

/* ────────────────────────────────────────────────────────────────
   DONNÉES & ÉTAT GLOBAL
──────────────────────────────────────────────────────────────── */
var _state = {
  isOpen: false,
  currentTab: 'notifs',
  notifications: [],
  unreadCount: 0,
  filter: 'all',
  broadcastType: 'info',
  onlineCount: Math.floor(Math.random()*38)+12,
  stats: { total: 0, opened: 0, lastSent: null },
  perms: {
    comments: true, posts: true, presence: false, events: true, system: true
  },
  _realtimeInterval: null,
  _presenceInterval: null
};

/* Types & configs */
var NOTIF_TYPES = {
  comment: { icon:'🗨️', color:'var(--cyan)', label:'Commentaire', pill:'ni-ch-push' },
  message: { icon:'💬', color:'var(--pink)', label:'Message', pill:'ni-ch-push' },
  post:    { icon:'📝', color:'var(--purple)', label:'Publication', pill:'ni-ch-push' },
  like:    { icon:'❤️', color:'var(--red)', label:'Like', pill:'ni-ch-push' },
  presence:{ icon:'👥', color:'var(--green)', label:'Présence', pill:'ni-ch-push' },
  event:   { icon:'🎉', color:'var(--amber)', label:'Événement', pill:'ni-ch-wa' },
  alert:   { icon:'⚠️', color:'var(--red)', label:'Alerte', pill:'ni-ch-push' },
  info:    { icon:'ℹ️', color:'var(--cyan)', label:'Info', pill:'ni-ch-push' },
  promo:   { icon:'🎁', color:'var(--purple)', label:'Promo', pill:'ni-ch-wa' },
  system:  { icon:'⚙️', color:'var(--muted)', label:'Système', pill:'ni-ch-push' }
};

/* Faux utilisateurs pour simulations */
var FAKE_USERS = [
  {name:'Kenzo Mba', avatar:'🎩', role:'member'},
  {name:'Priya Ndong', avatar:'🌺', role:'member'},
  {name:'Marco Ossoukou', avatar:'🦅', role:'establishment'},
  {name:'Aya Boulingui', avatar:'💃', role:'admin'},
  {name:'Jean-Luc Oyane', avatar:'🎸', role:'member'},
  {name:'Fatou Bivigou', avatar:'👑', role:'member'},
  {name:'Club Miami', avatar:'🍸', role:'establishment'},
  {name:'Basha Lounge', avatar:'🎶', role:'establishment'},
];

var FAKE_COMMENTS = [
  'Incroyable ambiance ce soir ! 🔥',
  'L\'ambiance est au top, je recommande !',
  'Quelqu\'un connaît les horaires ?',
  'On est arrivés, c\'est bondé mais génial 🎉',
  'La musique est parfaite ce soir 🎵',
  'Table disponible ? DM moi',
  'Meilleur spot de Libreville 🇬🇦',
  'Soirée mémorable, merci AMBI241 !',
];

var FAKE_PLACES = [
  'Miami Club', 'Basha Lounge', 'La Terrasse', 'BarSo', 'Sky Rooftop',
  'Le Palace', 'Jazz Corner', 'Okoumé Bar', 'Nkembo Lounge', 'Galaxy Club'
];

/* ────────────────────────────────────────────────────────────────
   HELPERS
──────────────────────────────────────────────────────────────── */
function _rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function _ts(){ return Date.now(); }
function _ago(ts){
  var diff = Math.floor((Date.now()-ts)/1000);
  if(diff<60) return 'À l\'instant';
  if(diff<3600) return Math.floor(diff/60)+'min';
  if(diff<86400) return Math.floor(diff/3600)+'h';
  return Math.floor(diff/86400)+'j';
}
function _uid(){ return Math.random().toString(36).slice(2,8); }

/* ────────────────────────────────────────────────────────────────
   CORE — AJOUTER UNE NOTIFICATION
──────────────────────────────────────────────────────────────── */
function _addNotif(type, title, msg, opts){
  opts = opts||{};
  var n = {
    id: _uid(),
    type: type,
    title: title,
    msg: msg,
    ts: _ts(),
    read: false,
    avatar: opts.avatar||'🔔',
    preview: opts.preview||'',
    actions: opts.actions||[],
    place: opts.place||null,
  };
  _state.notifications.unshift(n);
  // Limiter à 50 notifs max
  if(_state.notifications.length > 50) _state.notifications.pop();
  _state.stats.total++;
  _state.stats.lastSent = new Date();
  _updateUnread();
  _renderNotifList();
  _updateBadge();
  _updateAdminStats();
  // Toast si panel fermé
  if(!_state.isOpen){
    _showToast(n);
  }
  return n;
}

/* ────────────────────────────────────────────────────────────────
   BADGE & COMPTEUR
──────────────────────────────────────────────────────────────── */
function _updateUnread(){
  _state.unreadCount = _state.notifications.filter(function(n){ return !n.read; }).length;
}

function _updateBadge(){
  var count = _state.unreadCount;
  // Header badge (dans le bouton 💬)
  var badge = document.getElementById('notifBadge');
  if(badge){
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
  // Panel badge
  var pbadge = document.getElementById('notifPanelBadge');
  if(pbadge){
    pbadge.textContent = count > 99 ? '99+' : count;
    pbadge.style.display = count > 0 ? 'flex' : 'none';
  }
  // Tab badge flux
  var tbadge = document.getElementById('notifTabBadge');
  if(tbadge){
    tbadge.textContent = count;
    tbadge.style.display = count > 0 ? 'inline-flex' : 'none';
  }
  // Panel sub
  var sub = document.getElementById('notifPanelSub');
  if(sub){
    sub.textContent = count > 0
      ? count + ' notification' + (count>1?'s':'') + ' non lue'+(count>1?'s':'')
      : 'Tout est à jour ✓';
  }
  // Chat btn pulse
  var chatBtn = document.getElementById('notifBellBtn');
  if(chatBtn){
    if(count > 0) chatBtn.classList.add('has-unread');
    else chatBtn.classList.remove('has-unread');
  }
  // Compatibilité ancien système
  var bellBadge = document.getElementById('notifBadge');
  if(bellBadge){
    // déjà géré
  }
}

/* ────────────────────────────────────────────────────────────────
   RENDER LIST
──────────────────────────────────────────────────────────────── */
function _renderNotifList(){
  var list = document.getElementById('notifList');
  if(!list) return;

  var filtered = _state.notifications.filter(function(n){
    if(_state.filter === 'all') return true;
    return n.type === _state.filter;
  });

  if(filtered.length === 0){
    list.innerHTML = '<div class="notif-empty"><span>🔕</span>'
      + (_state.filter==='all' ? 'Aucune notification pour l\'instant' : 'Aucune notification de ce type')
      + '</div>';
    return;
  }

  // Grouper par "Aujourd'hui" / "Avant"
  var todayStart = new Date(); todayStart.setHours(0,0,0,0);
  var groups = {};
  filtered.forEach(function(n){
    var g = n.ts >= todayStart.getTime() ? "Aujourd'hui" : "Plus tôt";
    if(!groups[g]) groups[g] = [];
    groups[g].push(n);
  });

  var html = '';
  Object.keys(groups).forEach(function(g){
    html += '<div class="notif-group-header">'+g+'</div>';
    groups[g].forEach(function(n){
      html += _renderNotifItem(n);
    });
  });

  list.innerHTML = html;
}

function _renderNotifItem(n){
  var cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES['info'];
  var unreadClass = n.read ? '' : ' unread';
  var pilClass = 'ni-ch-push';
  if(n.type==='event'||n.type==='promo') pilClass='ni-ch-wa';

  var actionsHtml = '';
  if(n.actions && n.actions.length){
    actionsHtml = '<div class="notif-item-actions">';
    n.actions.forEach(function(a){
      actionsHtml += '<button class="notif-item-action-btn '+a.cls+'" onclick="_ambiNotifAction(\''+n.id+'\',\''+a.type+'\')">'
        +a.label+'</button>';
    });
    actionsHtml += '<button class="notif-item-action-btn nia-dismiss" onclick="_ambiDismissNotif(\''+n.id+'\')">✕</button>';
    actionsHtml += '</div>';
  }

  var previewHtml = n.preview
    ? '<div class="notif-item-preview">' + n.preview + '</div>'
    : '';

  return '<div class="notif-item'+unreadClass+'" id="ni_'+n.id+'" onclick="_ambiReadNotif(\''+n.id+'\')">'
    +'<div class="notif-item-avatar-wrap">'
    +'<div class="notif-item-avatar">'+n.avatar+'</div>'
    +'<div class="notif-type-badge" style="background:'+cfg.color+';border:2px solid var(--bg);">'+cfg.icon+'</div>'
    +(n.msgCount>1?'<div class="notif-msg-count-badge">'+n.msgCount+'</div>':'')
    +'</div>'
    +'<div class="ni-body">'
    +'<div class="ni-top-row">'
    +'<span class="ni-title">'+n.title+'</span>'
    +'<span class="ni-time">'+_ago(n.ts)+'</span>'
    +'</div>'
    +'<div class="ni-msg">'+n.msg+'</div>'
    +previewHtml
    +'<span class="notif-type-pill" style="background:'+cfg.color+'22;color:'+cfg.color+';border:1px solid '+cfg.color+'44;">'+cfg.icon+' '+cfg.label+'</span>'
    +(n.read?'':'<span class="notif-unread-dot" style="background:var(--pink);width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:0.35rem;vertical-align:middle;"></span>')
    +actionsHtml
    +'</div>'
    +'</div>';
}

/* ────────────────────────────────────────────────────────────────
   ACTIONS SUR ITEMS
──────────────────────────────────────────────────────────────── */
window._ambiReadNotif = function(id){
  var n = _state.notifications.find(function(x){ return x.id===id; });
  if(n && !n.read){
    n.read = true;
    _updateUnread();
    _updateBadge();
    _renderNotifList();
    _state.stats.opened++;
    _updateAdminStats();
  }
};

window._ambiDismissNotif = function(id){
  _state.notifications = _state.notifications.filter(function(x){ return x.id!==id; });
  _updateUnread();
  _updateBadge();
  _renderNotifList();
};

window._ambiNotifAction = function(id, actionType){
  var n = _state.notifications.find(function(x){ return x.id===id; });
  if(!n) return;
  n.read = true;
  _updateUnread();
  _updateBadge();
  _renderNotifList();
  if(typeof window.showToast==='function'){
    window.showToast('✅ Action effectuée');
  }
};

window._ambiNotifMarkAllRead = function(){
  _state.notifications.forEach(function(n){ n.read=true; });
  _state.stats.opened = _state.stats.total;
  _updateUnread();
  _updateBadge();
  _renderNotifList();
  _updateAdminStats();
};

/* ────────────────────────────────────────────────────────────────
   PANEL — OUVRIR / FERMER
──────────────────────────────────────────────────────────────── */
window.openAmbiNotifPanel = function(){
  var panel = document.getElementById('notifPanel');
  if(!panel) return;
  _state.isOpen = true;
  panel.classList.add('open');
  // Afficher tab admin seulement si admin
  var adminTab = document.getElementById('_ntab_admin');
  if(adminTab) adminTab.style.display = window.isAdmin ? 'flex' : 'none';
  _renderNotifList();
  _updatePresenceCount();
  _updateAdminStats();
};

window.closeAmbiNotifPanel = function(){
  var panel = document.getElementById('notifPanel');
  if(panel) panel.classList.remove('open');
  _state.isOpen = false;
};

window._ambiNotifPanelBgClose = function(e){
  if(e.target.classList.contains('notif-panel')){
    window.closeAmbiNotifPanel();
  }
};

/* Backward compatibility */
window.AMBI241_NOTIF = {
  panel: { open: window.openAmbiNotifPanel, close: window.closeAmbiNotifPanel },
  trigger: function(type, title, msg, opts){
    _addNotif(type||'info', title, msg, opts||{});
  }
};

/* ────────────────────────────────────────────────────────────────
   TABS
──────────────────────────────────────────────────────────────── */
window._ambiSwitchNotifTab = function(tab, btn){
  _state.currentTab = tab;
  // Désactiver tous les tabs
  document.querySelectorAll('.notif-panel-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.notif-tab-pane').forEach(function(p){ p.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  var pane = document.getElementById('_npane_'+tab);
  if(pane) pane.classList.add('active');
};

/* ────────────────────────────────────────────────────────────────
   FILTRES
──────────────────────────────────────────────────────────────── */
window.ambiFilterNotifs = function(type, btn){
  _state.filter = type;
  document.querySelectorAll('.notif-filter-btn').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  _renderNotifList();
};

/* ────────────────────────────────────────────────────────────────
   TOAST RICHE
──────────────────────────────────────────────────────────────── */
function _showToast(n){
  var cfg = NOTIF_TYPES[n.type] || NOTIF_TYPES['info'];
  var toast = document.getElementById('notifToast');
  var icon = document.getElementById('notifToastIcon');
  var label = document.getElementById('notifToastLabel');
  var title = document.getElementById('notifToastTitle');
  var msg = document.getElementById('notifToastMsg');
  if(!toast) return;
  if(icon) icon.textContent = n.avatar || cfg.icon;
  if(label){ label.textContent = cfg.label; label.style.color = cfg.color; }
  if(title) title.textContent = n.title;
  if(msg) msg.textContent = n.msg;
  toast.classList.add('show');
  setTimeout(function(){ toast.classList.remove('show'); }, 4200);
}

/* Compat showNotifToast existant */
window.showNotifToast = function(text, item){
  if(item){
    _showToast({ type: item.type||'info', title: item.title||text, msg: item.msg||'', avatar: item.icon||'🔔' });
  }
};

/* ────────────────────────────────────────────────────────────────
   PRÉSENCE TEMPS RÉEL
──────────────────────────────────────────────────────────────── */
function _updatePresenceCount(){
  // Variation aléatoire ±3
  _state.onlineCount = Math.max(5, _state.onlineCount + Math.floor(Math.random()*7)-3);
  var el = document.getElementById('notifPresenceCount');
  if(el) el.textContent = _state.onlineCount + ' membres actifs';
  // Aussi mettre à jour le KPI admin
  var kadm = document.getElementById('nadmKpiOnline');
  if(kadm) kadm.textContent = _state.onlineCount;
}

/* ────────────────────────────────────────────────────────────────
   ADMIN STATS
──────────────────────────────────────────────────────────────── */
function _updateAdminStats(){
  var kTotal = document.getElementById('nadmKpiTotal');
  var kOpen = document.getElementById('nadmKpiOpen');
  var kRate = document.getElementById('nadmOpenRate');
  var kLast = document.getElementById('nadmLastSent');
  if(kTotal) kTotal.textContent = _state.stats.total;
  if(kOpen) kOpen.textContent = _state.stats.opened;
  var rate = _state.stats.total > 0
    ? Math.round(_state.stats.opened/_state.stats.total*100) + '%'
    : '—';
  if(kRate) kRate.textContent = rate;
  if(kLast){
    kLast.textContent = _state.stats.lastSent
      ? _state.stats.lastSent.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})
      : '—';
  }
}

/* ────────────────────────────────────────────────────────────────
   ADMIN — ACTIONS
──────────────────────────────────────────────────────────────── */
window._ambiAdmSimulateComment = function(){
  var user = _rand(FAKE_USERS);
  var place = _rand(FAKE_PLACES);
  _addNotif('comment',
    user.name + ' a commenté',
    'à ' + place,
    {
      avatar: user.avatar,
      preview: _rand(FAKE_COMMENTS),
      actions: [
        {type:'reply', label:'↩ Répondre', cls:'nia-reply'},
        {type:'like', label:'❤️', cls:'nia-like'}
      ]
    }
  );
  if(typeof window.showToast==='function') window.showToast('🗨️ Commentaire simulé');
};

window._ambiAdmSimulatePresence = function(){
  var user = _rand(FAKE_USERS);
  var place = _rand(FAKE_PLACES);
  _state.onlineCount++;
  _updatePresenceCount();
  _addNotif('presence',
    user.name + ' est arrivé',
    'Vient de rejoindre ' + place,
    { avatar: user.avatar }
  );
  if(typeof window.showToast==='function') window.showToast('👥 Présence simulée');
};

window._ambiAdmSimulatePost = function(){
  var user = _rand(FAKE_USERS);
  var place = _rand(FAKE_PLACES);
  _addNotif('post',
    user.name + ' a publié',
    'Nouvelle publication : ' + place,
    {
      avatar: user.avatar,
      preview: 'Ambiance de folie ce soir ! On est ' + (Math.floor(Math.random()*20)+5) + ' 🔥',
      actions: [
        {type:'like', label:'❤️ Liker', cls:'nia-like'},
        {type:'reply', label:'💬 Commenter', cls:'nia-reply'}
      ]
    }
  );
  if(typeof window.showToast==='function') window.showToast('📝 Publication simulée');
};

window._ambiAdmClearAll = function(){
  if(!confirm('Vider toutes les notifications ?')) return;
  _state.notifications = [];
  _state.unreadCount = 0;
  _state.stats = { total:0, opened:0, lastSent:null };
  _updateBadge();
  _renderNotifList();
  _updateAdminStats();
  if(typeof window.showToast==='function') window.showToast('🗑️ Notifications vidées');
};

/* ────────────────────────────────────────────────────────────────
   BROADCAST
──────────────────────────────────────────────────────────────── */
window._ambiToggleCompose = function(){
  var box = document.getElementById('notifComposeBox');
  if(box) box.classList.toggle('open');
};

window._ambiSetBroadcastType = function(type, btn){
  _state.broadcastType = type;
  document.querySelectorAll('.notif-compose-type-btn').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
};

window._ambiSendBroadcast = function(){
  var txt = document.getElementById('notifComposeText');
  var msg = txt ? txt.value.trim() : '';
  if(!msg){ if(typeof window.showToast==='function') window.showToast('⚠️ Message vide'); return; }
  var cfg = NOTIF_TYPES[_state.broadcastType] || NOTIF_TYPES['info'];
  _addNotif(_state.broadcastType, '📢 Message Admin', msg, {
    avatar: '📢',
    actions: []
  });
  if(txt) txt.value = '';
  var box = document.getElementById('notifComposeBox');
  if(box) box.classList.remove('open');
  if(typeof window.showToast==='function') window.showToast('✅ Notification diffusée à tous les membres');
};

// Compteur caractères compose
document.addEventListener('DOMContentLoaded', function(){
  var ta = document.getElementById('notifComposeText');
  var cnt = document.getElementById('notifComposeCount');
  if(ta && cnt){
    ta.addEventListener('input', function(){
      cnt.textContent = ta.value.length + '/280';
      cnt.style.color = ta.value.length > 250 ? 'var(--red)' : 'var(--muted)';
    });
  }
});

/* ────────────────────────────────────────────────────────────────
   PERMISSIONS GRANULAIRES
──────────────────────────────────────────────────────────────── */
window._ambiPermToggle = function(perm, val){
  _state.perms[perm] = val;
  try{ localStorage.setItem('ambi_nperm_'+perm, val); }catch(e){}
  if(typeof window.showToast==='function'){
    window.showToast(val ? '🔔 '+perm+' activé' : '🔕 '+perm+' désactivé');
  }
};

window._ambiTogglePill = function(el){
  el.classList.toggle('on');
  if(typeof window.showToast==='function'){
    window.showToast(el.classList.contains('on') ? '✅ Canal activé' : '❌ Canal désactivé');
  }
};

/* Restore perms from localStorage */
document.addEventListener('DOMContentLoaded', function(){
  Object.keys(_state.perms).forEach(function(perm){
    try{
      var stored = localStorage.getItem('ambi_nperm_'+perm);
      if(stored !== null){
        var val = stored === 'true';
        _state.perms[perm] = val;
        var el = document.getElementById('nperm_'+perm);
        if(el) el.checked = val;
      }
    }catch(e){}
  });
});

/* ────────────────────────────────────────────────────────────────
   SIMULATIONS TEMPS RÉEL AUTOMATIQUES
──────────────────────────────────────────────────────────────── */
function _startRealtime(){
  // Présence — mise à jour toutes les 12s
  _state._presenceInterval = setInterval(function(){
    _updatePresenceCount();
  }, 12000);

  // Notifications automatiques — toutes les 20-40s
  function _scheduleNext(){
    var delay = 20000 + Math.random()*20000;
    setTimeout(function(){
      _triggerAutoNotif();
      _scheduleNext();
    }, delay);
  }
  _scheduleNext();
}

function _triggerAutoNotif(){
  var r = Math.random();
  if(r < 0.35 && _state.perms.comments){
    // Commentaire
    var user = _rand(FAKE_USERS);
    var place = _rand(FAKE_PLACES);
    _addNotif('comment', user.name+' a commenté', 'à '+place, {
      avatar: user.avatar,
      preview: _rand(FAKE_COMMENTS)
    });
  } else if(r < 0.55 && _state.perms.presence){
    // Présence
    var user2 = _rand(FAKE_USERS);
    var place2 = _rand(FAKE_PLACES);
    _state.onlineCount += Math.floor(Math.random()*3)+1;
    _updatePresenceCount();
    _addNotif('presence', user2.name+' est arrivé', 'Vient de rejoindre '+place2, { avatar: user2.avatar });
  } else if(r < 0.72 && _state.perms.posts){
    // Publication
    var user3 = _rand(FAKE_USERS);
    _addNotif('post', user3.name+' a publié', 'Nouvelle publication dans le forum', {
      avatar: user3.avatar,
      preview: _rand(FAKE_COMMENTS)
    });
  } else if(r < 0.85 && _state.perms.events){
    // Événement
    var place3 = _rand(FAKE_PLACES);
    _addNotif('event', '🎉 Événement ce soir', 'Soirée spéciale à '+place3+' — Entrée libre jusqu\'à 22h', {
      avatar: '🎉',
      actions: [{type:'open', label:'Voir', cls:'nia-reply'}]
    });
  } else {
    // Info système
    _addNotif('info', 'Ambiance mise à jour', _rand(FAKE_PLACES)+' : '+_rand(['🔥 Bondé','👌 Idéal','💤 Calme','⚡ Ambiance ++']), { avatar:'📊' });
  }
}

/* ────────────────────────────────────────────────────────────────
   INITIALISATION
──────────────────────────────────────────────────────────────── */
function _init(){
  // Notifs de bienvenue initiales
  setTimeout(function(){
    _addNotif('info', 'Bienvenue sur AMBI241 ! 🇬🇦',
      'Le centre de notifications est actif. Temps réel activé.',
      { avatar:'🎉' });
  }, 1200);

  setTimeout(function(){
    var place = _rand(FAKE_PLACES);
    _addNotif('event', 'Soirée ce soir à '+place,
      'Ambiance garantie — Entrée libre jusqu\'à 22h30',
      { avatar:'🎉', actions:[{type:'open', label:'Voir le lieu', cls:'nia-reply'}] });
  }, 3000);

  setTimeout(function(){
    var user = _rand(FAKE_USERS);
    _addNotif('presence', user.name+' est en ligne',
      'Vient de rejoindre '+_rand(FAKE_PLACES),
      { avatar: user.avatar });
  }, 5500);

  // Démarrer le temps réel
  _startRealtime();

  // Exposer openAmbiNotifPanel pour le bouton header
  // (déjà fait plus haut)
  console.log('[AMBI241] 💬 Système notifications enrichi v3 — initialisé');
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded', _init);
} else {
  setTimeout(_init, 500);
}

})();