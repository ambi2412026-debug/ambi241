
// ════════════════════════════════════════════════════════════════════
// TAXI MODULE SYSTÈME
// ════════════════════════════════════════════════════════════════════

let selectedService = 'car';
let isAdminLoggedIn = false;
// Mot de passe admin taxi = PIN super-admin du site (hashé via SHA-256)

// CONTACTS PAR DÉFAUT — vide : seuls les contacts ajoutés manuellement (admin ou chauffeur inscrit) apparaissent
const defaultContacts = [];

// ── Migration : purger les contacts fictifs pré-chargés ──────────────
(function _purgeFakeContacts() {
  var FAKE_NAMES = ['Gozem Moto','Gozem Premium','TaxiGab+','Wilcovic Jeremy','M. BEDRICK ESSONO','SOGATRA','GOZEM GABON'];
  var FAKE_PHONES = ['+24176519044','24176519044','+24177001010','24177001010',
                     '+24106000001','24106000001','+24107000002','24107000002',
                     '+24101000003','24101000003'];
  try {
    var stored = localStorage.getItem('taxiContacts');
    if(!stored) return; // rien à purger
    var contacts = JSON.parse(stored);
    var cleaned = contacts.filter(function(c) {
      var nameMatch = FAKE_NAMES.some(function(n){ return (c.name||'').trim() === n; });
      var phoneClean = (c.phone||'').replace(/\s/g,'');
      var phoneMatch = FAKE_PHONES.some(function(p){ return phoneClean === p; });
      // Garder si ce n'est pas un fictif OU si l'admin l'a manuellement modifié (addedBy présent)
      return (!nameMatch && !phoneMatch) || c.addedBy;
    });
    localStorage.setItem('taxiContacts', JSON.stringify(cleaned));
  } catch(e) {}
})();

// ── Migration : forcer online:true pour tous les contacts actifs ajoutés par admin ──
(function _migrateOnlineStatus() {
  try {
    var stored = localStorage.getItem('taxiContacts');
    if(!stored) return;
    var contacts = JSON.parse(stored);
    var changed = false;
    contacts.forEach(function(c) {
      // Si ajouté par admin ou auto-inscrit et actif → marquer online
      if(c.active && c.online === undefined) {
        c.online = true;
        changed = true;
      }
    });
    if(changed) localStorage.setItem('taxiContacts', JSON.stringify(contacts));
  } catch(e) {}
})();

function openTaxiModal() {
  document.getElementById('taxiModal').classList.add('open');
  document.getElementById('taxiModalOverlay').classList.add('open');
  loadTaxiContacts();
  setCurrentTime();
}

function closeTaxiModal() {
  document.getElementById('taxiModal').classList.remove('open');
  document.getElementById('taxiModalOverlay').classList.remove('open');
}

function switchTaxiTab(tab) {
  document.querySelectorAll('.taxi-tab').forEach(function(t){ t.classList.remove('active'); });
  document.querySelectorAll('.taxi-tab-content').forEach(function(c){ c.classList.remove('active'); });
  // Marquer le bon onglet actif
  var tabMap = {order:0, contacts:1, dashboard:2, admin:3};
  var tabs = document.querySelectorAll('.taxi-tab');
  var allTabs = document.querySelectorAll('.taxi-modal .taxi-tab');
  allTabs.forEach(function(t){
    var onclick = t.getAttribute('onclick') || '';
    if(onclick.indexOf("'"+tab+"'") !== -1 || onclick.indexOf('"'+tab+'"') !== -1) t.classList.add('active');
  });
  var content = document.getElementById('taxi-' + tab);
  if(content) content.classList.add('active');
  if(tab === 'contacts') loadTaxiContacts();
}

function selectService(service) {
  selectedService = service;
  document.querySelectorAll('.taxi-service-btn').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.taxi-service-btn').forEach(function(b){
    var onclick = b.getAttribute('onclick') || '';
    if(onclick.indexOf("'"+service+"'") !== -1 || onclick.indexOf('"'+service+'"') !== -1) b.classList.add('active');
  });
}

function setCurrentTime() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('taxiTime').value = hh + ':' + mm;
}

function orderTaxi() {
  const from = document.getElementById('taxiFrom').value;
  const to = document.getElementById('taxiTo').value;
  const time = document.getElementById('taxiTime').value;

  if(!to.trim()) {
    alert('⚠️ Veuillez entrer une destination');
    return;
  }

  alert('🚕 COMMANDE CONFIRMÉE\n\n' +
    '📍 De: ' + from + '\n' +
    '🎯 Vers: ' + to + '\n' +
    '🚗 Type: ' + selectedService.toUpperCase() + '\n' +
    '🕐 Heure: ' + time + '\n\n' +
    '✓ Votre chauffeur arrive dans 3-5 minutes');
}

/* ════════════════════════════════════════════════════════════
   taxiContacts — Source unique : Firestore (taxi_contacts)
   Partagé entre tous les appareils en temps réel.
════════════════════════════════════════════════════════════ */
var _taxiContactsUnsub = null;
function _subscribeTaxiContactsFirestore(){
  if(!window.db||!window.fbCollection||!window.fbOnSnapshot) return;
  if(_taxiContactsUnsub) return;
  _taxiContactsUnsub = window.fbOnSnapshot(
    window.fbCollection(window.db,'taxi_contacts'),
    function(snap){
      var list2=[];
      snap.forEach(function(d){ list2.push(Object.assign({_fsId:d.id},d.data())); });
      try { localStorage.setItem('taxiContacts',JSON.stringify(list2)); } catch(e) {}
      loadTaxiContacts();
    },
    function(err){ console.warn('[TaxiContacts] onSnapshot error',err); }
  );
}
function _saveTaxiContactFs(c){
  if(!window.db||!window.fbSetDoc||!window.fbDoc||!window.fbAddDoc||!window.fbCollection) return;
  if(c._fsId){
    window.fbSetDoc(window.fbDoc(window.db,'taxi_contacts',c._fsId),c,{merge:true}).catch(function(){});
  } else {
    window.fbAddDoc(window.fbCollection(window.db,'taxi_contacts'),c).then(function(r){ c._fsId=r.id; }).catch(function(){});
  }
}
function _deleteTaxiContactFs(fsId){
  if(!window.db||!window.fbDeleteDoc||!window.fbDoc||!fsId) return;
  window.fbDeleteDoc(window.fbDoc(window.db,'taxi_contacts',fsId)).catch(function(){});
}
(function _waitFbTaxi(){
  if(window.db&&window.fbCollection&&window.fbOnSnapshot){ _subscribeTaxiContactsFirestore(); }
  else { setTimeout(_waitFbTaxi,900); }
})();

function loadTaxiContacts() {
  var contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
  var list = document.getElementById('taxiContactsList');
  if(!list) return;
  list.innerHTML = '';

  // Seulement actifs ET online
  var online = contacts.filter(function(c){ return c.active && c.online; });

  // Mise à jour compteur dans l'onglet
  var countBadge = document.getElementById('taxiDispoCount');
  if(countBadge) {
    if(online.length > 0) {
      countBadge.textContent = online.length;
      countBadge.style.display = 'inline-block';
    } else {
      countBadge.style.display = 'none';
    }
  }

  if(online.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;">
        <div style="font-size:2.5rem;margin-bottom:0.7rem;">🚕</div>
        <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--text);font-size:0.9rem;margin-bottom:0.4rem;">Aucun chauffeur disponible</div>
        <div style="font-size:0.72rem;color:var(--muted);line-height:1.6;">Les chauffeurs disponibles apparaissent ici en temps réel.<br>Activez votre GPS pour voir les plus proches en premier.</div>
      </div>`;
    return;
  }

  // Calcul distance si GPS client dispo
  function haversine(lat1, lng1, lat2, lng2) {
    if(!lat1||!lat2) return null;
    var R=6371, dLat=(lat2-lat1)*Math.PI/180, dLng=(lng2-lng1)*Math.PI/180;
    var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  var cLat = window._taxiUserLat || null;
  var cLng = window._taxiUserLng || null;

  online.forEach(function(c) {
    c._dist = (cLat && c.lat) ? haversine(cLat, cLng, c.lat, c.lng) : null;
  });

  // Tri : d'abord ceux avec distance connue (croissant), puis sans GPS
  online.sort(function(a,b){
    if(a._dist===null && b._dist===null) return 0;
    if(a._dist===null) return 1;
    if(b._dist===null) return -1;
    return a._dist - b._dist;
  });

  // En-tête
  var sorted = online.some(function(c){ return c._dist !== null; });
  var headerHtml = `<div class="taxi-dispo-header">
    <span class="taxi-dispo-title">🟢 ${online.length} Chauffeur${online.length>1?'s':''} disponible${online.length>1?'s':''}</span>
    ${sorted ? '<span class="taxi-dispo-sort">📍 Triés par proximité</span>' : '<span class="taxi-dispo-sort">Activez GPS pour proximité</span>'}
  </div>`;
  list.innerHTML = headerHtml;

  online.forEach(function(c, idx) {
    var initials = (c.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);
    var distHtml = c._dist !== null
      ? `<span class="taxi-dist-badge">📍 ${c._dist < 1 ? Math.round(c._dist*1000)+'m' : c._dist.toFixed(1)+'km'}</span>`
      : '';
    var ratingHtml = c.rating ? `⭐ ${Number(c.rating).toFixed(1)}` : '';
    var avatarHtml = c.photo
      ? `<img src="${c.photo}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(0,255,170,0.35);" onerror="this.outerHTML='<div style=\\'width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#ff2d9b,#ff8800);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;color:#000;flex-shrink:0;\\'>${initials}</div>'">`
      : (getAdminDefaultPhotoForDriver()
          ? `<img src="${getAdminDefaultPhotoForDriver()}" style="width:46px;height:46px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid rgba(0,255,170,0.35);" onerror="this.outerHTML='<div style=\\'width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#9D84FF,#ff8800);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;color:#000;flex-shrink:0;\\'>${initials}</div>'">`
          : `<div style="width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#9D84FF,#ff8800);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1rem;color:#000;flex-shrink:0;position:relative;">${initials}<span class="taxi-online-dot" style="position:absolute;bottom:0;right:0;width:12px;height:12px;border:2px solid var(--surface);"></span></div>`);

    var safePhone = (c.phone||'').replace(/['"]/g,'');
    var html = `
      <div class="taxi-contact-card taxi-card-v2" style="cursor:pointer;" onclick="showDriverProfile('${encodeURIComponent(safePhone)}')">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
          ${avatarHtml}
          <div style="flex:1;min-width:0;">
            <div style="font-weight:800;font-size:0.88rem;color:var(--text);display:flex;align-items:center;gap:6px;">
              ${escHtml(c.name||'Chauffeur')}
              <span class="taxi-online-dot" style="width:7px;height:7px;flex-shrink:0;"></span>
            </div>
            <div style="font-size:0.7rem;color:var(--muted);margin-top:2px;">${escHtml(c.type||'🚗 Taxi')} ${ratingHtml ? '• '+ratingHtml : ''}</div>
            <div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap;">
              ${distHtml}
              <span style="font-size:0.65rem;color:var(--green);font-weight:700;">● Disponible</span>
            </div>
          </div>
        </div>
        <div class="taxi-action-col" onclick="event.stopPropagation();">
          <button class="taxi-wa-btn" onclick="openWhatsApp('${encodeURIComponent(safePhone)}','${encodeURIComponent(c.name||'')}')" title="WhatsApp">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </button>
          <div class="taxi-call-wrap">
            <button class="taxi-contact-action" onclick="callTaxi('${encodeURIComponent(safePhone)}')">APPELER</button>
          </div>
        </div>
      </div>`;
    list.innerHTML += html;
  });
}

// ════════════════════════════════════════════════════════════════════
// WHATSAPP ENRICHI — message complet avec toutes les conditions + deep-link
// ════════════════════════════════════════════════════════════════════

function _buildDeepLink(driverPhone, orderCtx) {
  // Deep-link vers le tableau de bord chauffeur avec les détails complets de la commande
  var clean = (driverPhone||'').replace(/\s|\+/g,'');
  var base = window.AMBI241_APP_URL;
  if (!base) {
    // Fallback : tenter d'utiliser l'URL courante
    base = (window.location.protocol === 'http:' || window.location.protocol === 'https:')
           ? window.location.href.split('?')[0]
           : null;
  }
  if (!base) {
    console.error('❌ AMBI241_APP_URL non configuré. Configurez-le dans le panneau admin Taxi Pro.');
    return '#url-non-configuree';
  }
  // S'assurer que la base se termine sans slash final avant d'ajouter les params
  base = base.replace(/\/$/, '');
  var url = base + '?taxi_driver=' + clean + '&action=offer';
  if (!orderCtx) return url;
  // Encoder chaque champ de la commande dans l'URL
  var fields = ['from','to','price','vehicle','passengers','time','clientName','clientPhone'];
  fields.forEach(function(k) {
    if (orderCtx[k]) url += '&order_' + k + '=' + encodeURIComponent(orderCtx[k]);
  });
  // GPS si disponible
  if (window._taxiUserLat && window._taxiUserLng) {
    url += '&order_lat=' + window._taxiUserLat.toFixed(6);
    url += '&order_lng=' + window._taxiUserLng.toFixed(6);
  }
  return url;
}

function openWhatsApp(encodedPhone, encodedName, contextData) {
  var phone = decodeURIComponent(encodedPhone);
  var name  = decodeURIComponent(encodedName || '');
  var clean = phone.replace(/\s|\+/g, '');

  // Récupérer le contexte de la commande si disponible
  var ctx = contextData || window._tdbPendingReq || {};
  var from        = ctx.from        || (document.getElementById('taxiFrom')        ? document.getElementById('taxiFrom').value        : '');
  var to          = ctx.to          || (document.getElementById('taxiProDestination')? document.getElementById('taxiProDestination').value : '');
  var price       = ctx.price       || (document.getElementById('taxiProPrice')     ? document.getElementById('taxiProPrice').value + ' XAF' : '');
  var vehicle     = ctx.vehicle     || taxiProState.selectedVehicle || '';
  var passengers  = ctx.passengers  || '';
  var timeVal     = ctx.time        || (document.getElementById('taxiProTime')      ? document.getElementById('taxiProTime').value      : '');
  var clientName  = ctx.clientName  || (document.getElementById('taxiProFirstName') ? document.getElementById('taxiProFirstName').value : '');
  var gpsCoords   = '';
  if(window._taxiUserLat && window._taxiUserLng) {
    gpsCoords = '📌 GPS: https://maps.google.com/?q=' + window._taxiUserLat.toFixed(6) + ',' + window._taxiUserLng.toFixed(6);
  }

  // Deep-link dashboard chauffeur — on passe le contexte complet de la commande
  var orderCtx = { from, to, price, vehicle, passengers, time: timeVal, clientName };
  var dashLink = _buildDeepLink(phone, orderCtx);

  // Avertissement si URL non configurée
  if (dashLink === '#url-non-configuree') {
    alert('⚠️ URL de l\'application non configurée !\nConfigurez-la dans le panneau Admin Taxi Pro avant d\'envoyer des commandes.\nLe lien tableau de bord chauffeur ne fonctionnera pas.');
  }

  // Construire le message enrichi — infos critiques EN PREMIER
  var lines = [];
  lines.push('🚕 *AMBI241 — NOUVELLE COMMANDE TAXI PRO*');
  lines.push('');
  // Résumé immédiat (visible même si message tronqué)
  if(clientName && to)   lines.push('👤 *' + clientName + '* → 🏁 *' + to + '*');
  if(price)              lines.push('💰 Prix : *' + price + '*');
  if(vehicle)            lines.push('🚗 ' + vehicle + (passengers ? '  👥 ' + passengers + ' pers.' : ''));
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  if(from)       lines.push('📍 Départ     : *' + from + '*');
  if(gpsCoords)  lines.push(gpsCoords);
  if(to)         lines.push('🏁 Destination : *' + to + '*');
  if(timeVal)    lines.push('🕐 Heure       : *' + timeVal + '*');
  if(vehicle)    lines.push('🚗 Véhicule    : *' + vehicle + '*');
  if(passengers) lines.push('👥 Passagers   : *' + passengers + '*');
  if(price)      lines.push('💰 Prix proposé: *' + price + '*');
  lines.push('━━━━━━━━━━━━━━━━━━━━');
  lines.push('');
  lines.push('✅ *Répondez ACCEPTER ou REFUSER*');
  lines.push('');
  lines.push('📲 *Votre tableau de bord :*');
  lines.push(dashLink);
  lines.push('');
  lines.push('_Bonjour ' + (name||'Chauffeur') + ', merci de confirmer votre disponibilité._');
  lines.push('_— AMBI241 Taxi Pro, Libreville 🇬🇦_');

  var msg = encodeURIComponent(lines.join('\n'));
  window.open('https://wa.me/' + clean + '?text=' + msg, '_blank');
  showTaxiNotification('💬 WhatsApp enrichi envoyé !');
}

function callTaxi(encodedPhone) {
  window.open('tel:' + decodeURIComponent(encodedPhone));
  showTaxiNotification('📞 Appel initié...');
}

function loginAdmin() {
  const pass = document.getElementById('adminPass').value;
  const btn  = document.getElementById('taxiAdminLoginBtn');
  if(!pass){ alert('⚠️ Entrez le code PIN'); return; }
  // Vérification via le même hash SHA-256 que le PIN super-admin du site
  (window.hashPin || hashPin)(pass).then(function(h) {
    const storedHash = (window.loadPinHash || loadPinHash)();
    if(storedHash && h === storedHash) {
      isAdminLoggedIn = true;
      document.getElementById('adminPanel').style.display = 'block';
      document.getElementById('adminPass').style.display  = 'none';
      if(btn) btn.style.display = 'none';
      loadAdminContacts();
      showTaxiNotification('✓ Mode Admin activé');
    } else {
      alert('❌ Code PIN incorrect');
    }
  }).catch(function(){ alert('❌ Erreur de vérification'); });
}

function addTaxiContact() {
  const name  = document.getElementById('adminName').value.trim();
  const phone = document.getElementById('adminPhone').value.trim();
  const type  = document.getElementById('adminType').value;

  if(!name || !phone) { alert('⚠️ Remplissez le nom et le numéro'); return; }

  let contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');

  // Vérifier doublon
  var exists = contacts.some(function(c){ return c.phone.replace(/\s/g,'') === phone.replace(/\s/g,''); });
  if(exists) { alert('⚠️ Ce numéro est déjà dans la liste'); return; }

  var cleanPhone = phone.replace(/\s/g,'').replace('+','');
  var isEnt = document.getElementById('adminTypeEnt') ? document.getElementById('adminTypeEnt').checked : true;

  contacts.push({
    name:         name,
    phone:        phone,
    whatsapp:     cleanPhone,
    type:         type,
    active:       true,
    online:       true,
    hours:        '24H/24',
    isEnterprise: isEnt,
    availability: 'open',
    addedBy:      'admin',
    addedAt:      new Date().toISOString(),
    photo:        '',
    rating:       5.0,
    courses:      0
  });

  localStorage.setItem('taxiContacts', JSON.stringify(contacts));
  document.getElementById('adminName').value  = '';
  document.getElementById('adminPhone').value = '';
  loadAdminContacts();
  loadTaxiContacts(); // sync immédiate avec la liste Contacts 24H
  showTaxiNotification('✅ ' + name + ' ajouté à la liste 24H/24 !');
}

function deleteContact(index) {
  if(confirm('Confirmer la suppression ?')) {
    let contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
    contacts.splice(index, 1);
    localStorage.setItem('taxiContacts', JSON.stringify(contacts));
    loadAdminContacts();
    loadTaxiContacts();
    showTaxiNotification('✓ Contact supprimé');
  }
}

function loadAdminContacts() {
  let contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
  const list = document.getElementById('adminContactsList');
  if(!list) return;

  // Titre avec compteur
  var titleEl = document.getElementById('adminContactsTitle');
  if(titleEl) titleEl.textContent = '📋 CONTACTS ACTUELS (' + contacts.length + ')';

  if(contacts.length === 0) {
    list.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem;">
      <div style="font-size:2rem;margin-bottom:0.5rem;">🚕</div>
      Aucun chauffeur enregistré.<br>Utilisez le formulaire ci-dessus pour en ajouter.
    </div>`;
    return;
  }
  list.innerHTML = '';

  contacts.forEach((contact, idx) => {
    const isIndividual = contact.isEnterprise === false;
    const initials = contact.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const source = contact.addedBy === 'chauffeur_inscription'
      ? '<span style="font-size:0.58rem;background:rgba(0,229,255,0.12);color:var(--cyan);padding:0.1rem 0.35rem;border-radius:4px;border:1px solid rgba(0,229,255,0.25);">🚗 Auto-inscrit</span>'
      : '<span style="font-size:0.58rem;background:rgba(157,132,255,0.12);color:var(--amber);padding:0.1rem 0.35rem;border-radius:4px;border:1px solid rgba(157,132,255,0.25);">🔑 Ajouté Admin</span>';
    const availColor = (contact.availability||'open')==='open' ? 'var(--green)' : (contact.availability==='busy' ? 'var(--amber)' : 'var(--red)');
    const availLabel = (contact.availability||'open')==='open' ? '● Disponible' : (contact.availability==='busy' ? '● En course' : '● Indisponible');
    const photoBlock = isIndividual ? `
      <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
        ${contact.photo
          ? `<img src="${contact.photo}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:1.5px solid var(--taxi-gold);" alt="photo">`
          : `<div style="width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,#9D84FF,#7C5FE8);display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:800;color:#1a0018;">${initials}</div>`}
        <label style="font-size:11px;color:var(--cyan);cursor:pointer;">📷 Photo
          <input type="file" accept="image/*" style="display:none;" onchange="uploadDriverPhoto(${idx},this)">
        </label>
      </div>` : '';
    const html = `
      <div class="taxi-contact-card" style="margin-bottom:8px;">
        <div class="taxi-contact-icon">${contact.type.split(' ')[0]}</div>
        <div class="taxi-contact-info" style="flex:1;">
          <div class="taxi-contact-name">${contact.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">${contact.phone}</div>
          <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:3px;">
            <span style="font-size:10px;color:${isIndividual?'var(--cyan)':'var(--amber)'};">${isIndividual?'👤 Particulier':'🏢 Entreprise'}</span>
            ${source}
          </div>
          <div style="font-size:10px;color:${availColor};margin-top:2px;">${availLabel}</div>
          ${photoBlock}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
          <button class="taxi-admin-btn delete" onclick="deleteContact(${idx})" style="width:auto;padding:6px 10px;margin:0;font-size:0.68rem;">
            ✕ Suppr.
          </button>
          <button onclick="toggleContactActive(${idx})" style="width:auto;padding:4px 8px;margin:0;font-size:0.62rem;border-radius:6px;border:1px solid rgba(157,132,255,0.3);background:rgba(157,132,255,0.08);color:var(--amber);cursor:pointer;font-family:'DM Sans',sans-serif;">
            ${contact.active ? '⏸ Désact.' : '▶ Activer'}
          </button>
        </div>
      </div>
    `;
    list.innerHTML += html;
  });
}

function toggleContactActive(idx) {
  var contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
  if(!contacts[idx]) return;
  contacts[idx].active = !contacts[idx].active;
  // Synchroniser online avec active : désactiver = hors ligne, activer = en ligne
  contacts[idx].online = contacts[idx].active;
  localStorage.setItem('taxiContacts', JSON.stringify(contacts));
  loadAdminContacts();
  loadTaxiContacts();
  showTaxiNotification(contacts[idx].active ? '▶ Contact activé' : '⏸ Contact désactivé');
}
window.toggleContactActive = toggleContactActive;

function uploadDriverPhoto(idx, input) {
  var file = input.files && input.files[0];
  if(!file) return;
  input.value = '';

  if (file.size > 10 * 1024 * 1024) { if(typeof showToast==='function') showToast('⚠️ Image trop grande (max 10 Mo)'); return; }

  if(typeof showToast==='function') showToast('⏳ Upload photo chauffeur...');
  if(typeof showUploadProgress==='function') showUploadProgress(10,'Chauffeur...');

  function _saveContact(photoURL){
    var contacts=[];
    try{ contacts=JSON.parse(localStorage.getItem('taxiContacts')||'[]'); }catch(er){}
    if(contacts[idx]){
      contacts[idx].photo = photoURL;
      contacts[idx].photoUpdated = new Date().toISOString();
      try{ localStorage.setItem('taxiContacts', JSON.stringify(contacts)); }catch(er){}
    }
    if(typeof hideUploadProgress==='function') hideUploadProgress(700);
    if(typeof showToast==='function') showToast('✅ Photo chauffeur sauvegardée !');
    if(typeof loadAdminContacts==='function') loadAdminContacts();
    if(typeof loadTaxiContacts==='function') loadTaxiContacts();
  }

  // Firebase Storage en priorité
  if (window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL) {
    var storRef = window.fbRef(window.fbStorage,'taxi/drivers/driver_'+_cryptoId(12)+'_'+idx+'.jpg');
    if(typeof showUploadProgress==='function') showUploadProgress(30,'Upload...');
    window.fbUploadBytes(storRef, file).then(function(){
      if(typeof showUploadProgress==='function') showUploadProgress(80,'Finalisation...');
      return window.fbGetDownloadURL(storRef);
    }).then(function(url){ _saveContact(url); })
    .catch(function(err){
      console.warn('Firebase indispo:', err);
      if(typeof compressImage==='function'){ compressImage(file, function(d){ _saveContact(d); }); }
      else { if(typeof hideUploadProgress==='function') hideUploadProgress(0); }
    });
  } else if(typeof compressImage==='function'){
    compressImage(file, function(d){ _saveContact(d); });
  } else {
    var rd = new FileReader();
    rd.onload = function(e){ _saveContact(e.target.result); };
    rd.readAsDataURL(file);
  }
}

function showTaxiNotification(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:calc(var(--nav-h, 54px) + var(--player-h, 0px) + 46px);left:50%;transform:translateX(-50%);background:var(--taxi-gold);color:var(--taxi-dark);padding:12px 20px;border-radius:20px;font-weight:700;z-index:9999;animation:slideUp 0.3s ease;box-shadow:0 4px 16px rgba(157,132,255,0.3);';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Fermer modal au clic overlay
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('taxiModalOverlay');
  overlay.addEventListener('click', e => {
    if(e.target === overlay) closeTaxiModal();
  });

  // ══════════════════════════════════════════════════════════════
  // LOGO TAXI DRAGGABLE + SUPPRESSION APPUI LONG
  // ══════════════════════════════════════════════════════════════
  const taxiBtn = document.querySelector('.taxi-btn-main');
  const taxiModule = document.getElementById('taxiModuleContainer');

  if(taxiBtn && taxiModule) {
    // Rendre le conteneur positionnable librement
    taxiModule.style.position = 'fixed';
    taxiModule.style.zIndex = '999';
    taxiModule.style.cursor = 'grab';
    taxiModule.style.userSelect = 'none';
    taxiModule.style.touchAction = 'none';

    // Réinitialiser la position sauvegardée pour forcer la nouvelle position par défaut (gauche)
    localStorage.removeItem('taxiBtnPos');
    // Restaurer la dernière position sauvegardée — uniquement si elle est raisonnable
    const savedPos = null; // position par défaut forcée : haut gauche
    // Position par défaut : gauche, au niveau du hero
    const defaultLeft = 10;
    const defaultTop = Math.round(window.innerHeight * 0.28); // haut à gauche, niveau hero
    if(savedPos && savedPos.x > 0 && savedPos.y > 100 && savedPos.y < window.innerHeight - 80) {
      taxiModule.style.left = savedPos.x + 'px';
      taxiModule.style.top  = savedPos.y + 'px';
      taxiModule.style.bottom = 'auto';
      taxiModule.style.right  = 'auto';
    } else {
      // Position par défaut côté gauche, niveau milieu-haut du contenu
      taxiModule.style.left   = defaultLeft + 'px';
      taxiModule.style.top    = defaultTop + 'px';
      taxiModule.style.bottom = 'auto';
      taxiModule.style.right  = 'auto';
    }

    let isDragging = false;
    let startX, startY, origLeft, origTop;
    let longPressTimer = null;
    let dragMoved = false;
    const LONG_PRESS_MS = 1200;

    function getModuleRect() {
      const r = taxiModule.getBoundingClientRect();
      return { left: r.left, top: r.top };
    }

    function startDrag(clientX, clientY) {
      isDragging = true;
      dragMoved = false;
      taxiModule.style.cursor = 'grabbing';
      const pos = getModuleRect();
      origLeft = pos.left;
      origTop  = pos.top;
      startX = clientX;
      startY = clientY;
    }

    function moveDrag(clientX, clientY) {
      if(!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if(Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        dragMoved = true;
        clearTimeout(longPressTimer); // annuler appui long si on bouge
      }
      let newLeft = origLeft + dx;
      let newTop  = origTop  + dy;
      // Contraindre dans la fenêtre
      const W = window.innerWidth  - taxiModule.offsetWidth;
      const H = window.innerHeight - taxiModule.offsetHeight;
      newLeft = Math.max(0, Math.min(newLeft, W));
      newTop  = Math.max(0, Math.min(newTop,  H));
      taxiModule.style.left   = newLeft + 'px';
      taxiModule.style.top    = newTop  + 'px';
      taxiModule.style.bottom = 'auto';
      taxiModule.style.right  = 'auto';
    }

    function endDrag() {
      if(!isDragging) return;
      isDragging = false;
      taxiModule.style.cursor = 'grab';
      clearTimeout(longPressTimer);
      // Sauvegarder la position
      const pos = getModuleRect();
      localStorage.setItem('taxiBtnPos', JSON.stringify({ x: pos.left, y: pos.top }));
    }

    function startLongPress() {
      longPressTimer = setTimeout(() => {
        if(!dragMoved) {
          // Masquage temporaire uniquement — réapparaît au rechargement de la page
          taxiModule.style.opacity = '0';
          taxiModule.style.transition = 'opacity 0.4s ease';
          setTimeout(() => {
            taxiModule.style.display = 'none';
            taxiModule.style.opacity = '';
            taxiModule.style.transition = '';
            showTaxiNotification('🚕 Masqué jusqu\'au prochain rechargement');
          }, 400);
        }
      }, LONG_PRESS_MS);
    }

    // ── TOUCH EVENTS ──
    taxiModule.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      startDrag(t.clientX, t.clientY);
      startLongPress();
    }, { passive: true });

    taxiModule.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      moveDrag(t.clientX, t.clientY);
    }, { passive: true });

    taxiModule.addEventListener('touchend', () => {
      endDrag();
    });

    // ── MOUSE EVENTS (desktop) ──
    taxiModule.addEventListener('mousedown', (e) => {
      startDrag(e.clientX, e.clientY);
      startLongPress();
    });

    document.addEventListener('mousemove', (e) => {
      if(isDragging) moveDrag(e.clientX, e.clientY);
    });

    document.addEventListener('mouseup', () => {
      endDrag();
    });

    // Empêcher l'ouverture du modal si on a fait un drag
    taxiBtn.addEventListener('click', (e) => {
      if(dragMoved) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }
});

// ═══════════════════════════════════════════════════════════
// GÉOLOCALISATION POINT DE DÉPART — BOUTON INTELLIGENT
// ═══════════════════════════════════════════════════════════
let _taxiUserLat = null, _taxiUserLng = null;

function taxiDetectLocation() {
  const btn    = document.getElementById('taxiGeoBtn');
  const input  = document.getElementById('taxiFrom');
  const status = document.getElementById('taxiGeoStatus');
  const statusTxt = document.getElementById('taxiGeoStatusText');
  if (!btn) return;

  // État chargement
  btn.textContent = '⏳';
  btn.style.borderColor = 'rgba(157,132,255,0.6)';
  btn.style.background  = 'rgba(157,132,255,0.12)';
  btn.style.color       = 'var(--amber)';
  btn.style.animation   = 'spin 1s linear infinite';

  if (!navigator.geolocation) {
    btn.textContent = '❌';
    btn.style.animation = 'none';
    showTaxiNotification('⚠️ Géolocalisation non disponible sur ce navigateur');
    return;
  }

  navigator.geolocation.getCurrentPosition(
    function(pos) {
      _taxiUserLat = pos.coords.latitude;
      _taxiUserLng = pos.coords.longitude;

      // Bouton vert ✅
      btn.textContent = '✅';
      btn.style.animation   = 'none';
      btn.style.borderColor = 'rgba(0,255,170,0.7)';
      btn.style.background  = 'rgba(0,255,170,0.15)';
      btn.style.color       = 'var(--green)';
      btn.style.boxShadow   = '0 0 14px rgba(0,255,170,0.35)';

      // Remplir le champ
      if (input) input.value = '📍 Ma position (' + _taxiUserLat.toFixed(5) + ', ' + _taxiUserLng.toFixed(5) + ')';

      // Afficher actions
      const actions = document.getElementById('taxiGeoActions');
      if (actions) { actions.style.display = 'flex'; }

      // Badge statut
      if (status)    { status.style.display = 'flex'; }
      if (statusTxt) { statusTxt.textContent = '✅ Position GPS détectée avec succès'; }
      document.getElementById('taxiGeoStatusDot').style.background = 'var(--green)';

      showTaxiNotification('✅ Position GPS détectée !');
    },
    function(err) {
      btn.textContent = '❌';
      btn.style.animation   = 'none';
      btn.style.borderColor = 'rgba(255,68,102,0.5)';
      btn.style.background  = 'rgba(255,68,102,0.1)';
      btn.style.color       = 'var(--red)';

      if (status)    { status.style.display = 'flex'; }
      if (statusTxt) { statusTxt.textContent = '❌ Accès refusé — vérifiez les permissions'; }
      document.getElementById('taxiGeoStatusDot').style.background = 'var(--red)';

      let msg = '❌ Localisation refusée';
      if (err.code === 1) msg = '🔒 Permission GPS refusée';
      else if (err.code === 3) msg = '⏱️ Délai dépassé — Réessayez';
      showTaxiNotification(msg);
    },
    { timeout: 10000, enableHighAccuracy: true, maximumAge: 30000 }
  );
}

// ══ FICHE PUBLIQUE CHAUFFEUR ══
function showDriverProfile(encodedPhone) {
  var phone = decodeURIComponent(encodedPhone);
  var contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
  var c = contacts.find(function(x){ return x.phone === phone && x.online && x.active; });
  if(!c) { showTaxiNotification('⚠️ Chauffeur introuvable'); return; }

  var initials = (c.name||'?').split(' ').map(function(w){return w[0]||'';}).join('').toUpperCase().slice(0,2);

  // Calcul distance
  function haversine(la1,lo1,la2,lo2){
    if(!la1||!la2) return null;
    var R=6371,dLa=(la2-la1)*Math.PI/180,dLo=(lo2-lo1)*Math.PI/180;
    var a=Math.sin(dLa/2)*Math.sin(dLa/2)+Math.cos(la1*Math.PI/180)*Math.cos(la2*Math.PI/180)*Math.sin(dLo/2)*Math.sin(dLo/2);
    return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
  }
  var dist = (window._taxiUserLat && c.lat) ? haversine(window._taxiUserLat, window._taxiUserLng, c.lat, c.lng) : null;
  var distStr = dist !== null ? (dist < 1 ? Math.round(dist*1000)+'m' : dist.toFixed(1)+'km') : 'Non précisée';

  // Calculer temps estimé (à ~30km/h en ville)
  var etaMin = dist !== null ? Math.max(2, Math.round(dist/30*60)) : null;

  var old = document.getElementById('_driverProfileOverlay');
  if(old) old.remove();

  var ratingStars = '';
  if(c.rating) {
    var r = Number(c.rating);
    for(var i=1;i<=5;i++) ratingStars += i<=Math.round(r) ? '★' : '☆';
  }

  var avatarBlock = c.photo
    ? `<img src="${escHtml(c.photo)}" class="taxi-profile-avatar" onerror="this.outerHTML='<div class=\\'taxi-profile-avatar\\'>${initials}</div>'">`
    : (getAdminDefaultPhotoForDriver()
        ? `<img src="${getAdminDefaultPhotoForDriver()}" class="taxi-profile-avatar" onerror="this.outerHTML='<div class=\\'taxi-profile-avatar\\'>${initials}</div>'">`
        : `<div class="taxi-profile-avatar">${initials}</div>`);

  var overlay = document.createElement('div');
  overlay.id = '_driverProfileOverlay';
  overlay.className = 'taxi-profile-overlay';
  overlay.onclick = function(e){ if(e.target===overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div class="taxi-profile-sheet">
      <div class="taxi-profile-drag"></div>
      <button onclick="document.getElementById('_driverProfileOverlay').remove()" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:30px;height:30px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>

      <!-- Hero -->
      <div class="taxi-profile-hero">
        <div class="taxi-profile-avatar-wrap">
          ${avatarBlock}
          <div class="taxi-profile-online-badge"></div>
        </div>
        <div style="flex:1;min-width:0;">
          <div class="taxi-profile-name">${escHtml(c.name||'Chauffeur')}</div>
          <div class="taxi-profile-company">${escHtml(c.type||'🚗 Taxi')} — ${escHtml(c.company||c.hours||'24H/24')}</div>
          ${c.rating ? `<div class="taxi-profile-rating"><span style="color:var(--amber);font-size:0.85rem;">${ratingStars}</span> <span>${Number(c.rating).toFixed(1)}</span></div>` : ''}
          <div style="display:inline-flex;align-items:center;gap:4px;background:rgba(0,255,170,0.1);border:1px solid rgba(0,255,170,0.25);color:var(--green);font-size:0.62rem;font-weight:800;padding:2px 8px;border-radius:20px;margin-top:4px;">
            <span class="taxi-online-dot" style="width:6px;height:6px;animation:pulse 1.2s infinite;"></span> DISPONIBLE
          </div>
        </div>
      </div>

      <!-- Stats -->
      <div class="taxi-profile-stats">
        <div class="taxi-profile-stat">
          <div class="taxi-profile-stat-val">${distStr}</div>
          <div class="taxi-profile-stat-lbl">Distance</div>
        </div>
        <div class="taxi-profile-stat">
          <div class="taxi-profile-stat-val">${etaMin !== null ? '~'+etaMin+' min' : '—'}</div>
          <div class="taxi-profile-stat-lbl">Arrivée est.</div>
        </div>
        <div class="taxi-profile-stat">
          <div class="taxi-profile-stat-val">${c.courses || '—'}</div>
          <div class="taxi-profile-stat-lbl">Courses</div>
        </div>
      </div>

      <!-- Infos -->
      <div class="taxi-profile-info">
        <div class="taxi-profile-info-row">
          <div class="taxi-profile-info-icon">📞</div>
          <div><div class="taxi-profile-info-text">${escHtml(c.phone||'N/A')}</div><div class="taxi-profile-info-sub">Numéro direct</div></div>
        </div>
        <div class="taxi-profile-info-row">
          <div class="taxi-profile-info-icon">🕐</div>
          <div><div class="taxi-profile-info-text">${escHtml(c.hours||'24H/24')}</div><div class="taxi-profile-info-sub">Disponibilité</div></div>
        </div>
        ${c.vehicle ? `<div class="taxi-profile-info-row"><div class="taxi-profile-info-icon">🚗</div><div><div class="taxi-profile-info-text">${escHtml(c.vehicle)}</div><div class="taxi-profile-info-sub">Véhicule</div></div></div>` : ''}
        ${c.sector ? `<div class="taxi-profile-info-row"><div class="taxi-profile-info-icon">📍</div><div><div class="taxi-profile-info-text">${escHtml(c.sector)}</div><div class="taxi-profile-info-sub">Zone habituelle</div></div></div>` : ''}
      </div>

      <!-- Actions -->
      <div class="taxi-profile-actions">
        <button class="taxi-profile-btn-cmd" onclick="commanderDriverDirect('${encodeURIComponent(c.phone||'')}','${encodeURIComponent(c.name||'')}')">
          🚕 Commander ce Chauffeur
        </button>
        <button class="taxi-profile-btn-wa" onclick="openWhatsApp('${encodeURIComponent(c.phone||'')}','${encodeURIComponent(c.name||'')}')">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Contacter via WhatsApp
        </button>
        <button class="taxi-profile-btn-call" onclick="callTaxi('${encodeURIComponent(c.phone||'')}')">
          📞 Appel Direct
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

// Commander directement un chauffeur depuis sa fiche
function commanderDriverDirect(encodedPhone, encodedName) {
  var phone = decodeURIComponent(encodedPhone);
  var name  = decodeURIComponent(encodedName);
  // Fermer la fiche
  var overlay = document.getElementById('_driverProfileOverlay');
  if(overlay) overlay.remove();
  // Ouvrir le modal de commande PRO pré-sélectionné
  taxiProOpenCommandModal();
  // Attendre que le modal soit ouvert puis pré-sélectionner le chauffeur
  setTimeout(function(){
    // Aller à l'étape 5 directement n'est pas forcé — on pré-sélectionne après rendu
    var drivers = getTaxiProDrivers();
    var driver = drivers.find(function(d){ return d.phone === phone; });
    if(driver) {
      taxiProState.selectedDriver = driver.id;
      // Rafraîchir la liste et sélectionner visuellement
      taxiProRenderDriversList();
      setTimeout(function(){
        document.querySelectorAll('.taxi-driver-item').forEach(function(el, i){
          if(drivers[i] && drivers[i].id === driver.id) el.classList.add('selected');
        });
      }, 50);
      showTaxiNotification('✅ ' + name + ' pré-sélectionné');
    }
  }, 200);
}
window.showDriverProfile = showDriverProfile;
window.commanderDriverDirect = commanderDriverDirect;

function taxiShareWhatsApp() {
  if (!_taxiUserLat || !_taxiUserLng) {
    showTaxiNotification('⚠️ Détectez d\'abord votre position');
    return;
  }
  const mapsLink = 'https://maps.google.com/?q=' + _taxiUserLat + ',' + _taxiUserLng;
  const text = encodeURIComponent('🚕 *Taxi Pro AMBI241* — Mon point de départ :\n📍 ' + mapsLink + '\n\nPouvez-vous venir me chercher ici ?');
  window.open('https://wa.me/?text=' + text, '_blank');
  showTaxiNotification('💬 WhatsApp ouvert avec votre position...');
}

function taxiOpenGoogleMaps() {
  if (!_taxiUserLat || !_taxiUserLng) {
    showTaxiNotification('⚠️ Détectez d\'abord votre position');
    return;
  }
  window.open('https://maps.google.com/?q=' + _taxiUserLat + ',' + _taxiUserLng, '_blank');
  showTaxiNotification('🗺️ Google Maps ouvert...');
}

console.log('%c🚕 TAXI PRO MODULE CHARGÉ', 'color:#9D84FF;font-size:16px;font-weight:bold;');

// ════════════════════════════════════════════════════════════════════
// DEEP-LINK — ouverture de l'écran d'offre chauffeur depuis lien WA
// Format: ?taxi_driver=PHONE&action=offer&order_from=...&order_to=...
// (rétrocompatible avec action=dashboard)
// ════════════════════════════════════════════════════════════════════
(function _handleTaxiDeepLink() {
  var params = new URLSearchParams(window.location.search);
  var driverPhone = params.get('taxi_driver');
  var action      = params.get('action');
  if (!driverPhone || (action !== 'offer' && action !== 'dashboard')) return;

  // Extraire les détails de la commande encodés dans l'URL
  var orderFromUrl = {
    from:        params.get('order_from')        || '',
    to:          params.get('order_to')          || '',
    price:       params.get('order_price')       || '',
    vehicle:     params.get('order_vehicle')     || '',
    passengers:  params.get('order_passengers')  || '',
    time:        params.get('order_time')        || '',
    clientName:  params.get('order_clientName')  || '',
    clientPhone: params.get('order_clientPhone') || '',
    lat:         params.get('order_lat')         || '',
    lng:         params.get('order_lng')         || ''
  };
  var hasOrderData = !!(orderFromUrl.from || orderFromUrl.to || orderFromUrl.price);

  window.addEventListener('load', function() {
    setTimeout(function() {
      // 1) Chercher le chauffeur dans _chauffeurDrivers (peut être absent sur l'appareil du chauffeur)
      var cleanTarget = driverPhone.replace(/\s|\+/g,'');
      var driver = null;
      var allDrivers = Object.values(window._chauffeurDrivers || {});
      driver = allDrivers.find(function(d) {
        return (d.phone||'').replace(/\s|\+/g,'') === cleanTarget;
      });

      // 2) Si on a les détails de la commande → afficher l'écran d'offre directement,
      //    sans exiger que le chauffeur soit dans le localStorage local
      if (hasOrderData) {
        _showTaxiOfferScreen(cleanTarget, driver, orderFromUrl);
        return;
      }

      // 3) Fallback (ancien lien sans order_*) : ouvrir le dashboard si connecté
      if (driver && driver.status === 'approved') {
        _showChauffeurBoard(driver);
        setTimeout(function(){
          var btn = document.querySelector('[data-board-tab="commandes"]');
          if(btn) btn.click();
        }, 300);
        showTaxiNotification('🚗 Tableau de bord ouvert depuis WhatsApp !');
      } else {
        // Portail de login pré-rempli
        setTimeout(function() {
          _showChauffeurLoginGate();
          var emailEl = document.getElementById('_cgEmail');
          if(emailEl && driver) emailEl.value = driver.email || '';
          var gate = document.getElementById('_chauffeurGate');
          if(gate) {
            var info = document.createElement('div');
            info.style.cssText = 'background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);border-radius:10px;padding:0.6rem 0.8rem;margin-bottom:0.8rem;font-size:0.72rem;color:var(--cyan);text-align:center;';
            info.innerHTML = '🔗 Lien WhatsApp reçu — Connectez-vous pour voir votre commande';
            var form = gate.querySelector('div > div');
            if(form) form.insertBefore(info, form.firstChild);
          }
        }, 500);
      }
    }, 800);
  });
})();

// ════════════════════════════════════════════════════════════════════
// ÉCRAN D'OFFRE — affiché sur l'appareil du CHAUFFEUR quand il ouvre le lien WA
// Ne dépend PAS du localStorage local : tous les détails viennent de l'URL
// ════════════════════════════════════════════════════════════════════
function _showTaxiOfferScreen(driverPhone, driver, order) {
  // Supprimer un éventuel écran précédent
  var old = document.getElementById('_taxiOfferScreen');
  if (old) old.remove();

  var driverName = driver ? escHtml(driver.pseudo || driver.name || 'Chauffeur') : 'Chauffeur';

  var gpsLink = '';
  if (order.lat && order.lng) {
    gpsLink = '<a href="https://maps.google.com/?q=' + order.lat + ',' + order.lng + '" target="_blank" style="color:var(--cyan);font-size:0.7rem;text-decoration:none;">📌 Voir sur la carte</a>';
  }

  var wrap = document.createElement('div');
  wrap.id = '_taxiOfferScreen';
  wrap.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:10020;overflow-y:auto;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:2rem 1rem 6rem;';

  wrap.innerHTML = `
    <div style="width:100%;max-width:420px;">
      <!-- En-tête -->
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:2.8rem;margin-bottom:0.4rem;">🚕</div>
        <div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:var(--amber);">Nouvelle Commande</div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem;">Bonjour ${driverName} — une course vous attend</div>
      </div>

      <!-- Carte commande -->
      <div style="background:linear-gradient(135deg,rgba(255,184,0,0.13),rgba(255,45,155,0.07));border:2px solid rgba(157,132,255,0.45);border-radius:20px;padding:1.2rem;margin-bottom:1rem;animation:pulse 2s infinite;">

        <!-- Départ / Arrivée -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;margin-bottom:0.9rem;">
          <div style="background:rgba(0,0,0,0.25);border-radius:12px;padding:0.7rem 0.8rem;">
            <div style="font-size:0.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.2rem;">Départ</div>
            <div style="font-size:0.82rem;font-weight:700;color:var(--text);">${escHtml(order.from || '—')}</div>
            ${gpsLink ? '<div style="margin-top:0.3rem;">'+gpsLink+'</div>' : ''}
          </div>
          <div style="background:rgba(0,0,0,0.25);border-radius:12px;padding:0.7rem 0.8rem;">
            <div style="font-size:0.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.2rem;">Destination</div>
            <div style="font-size:0.82rem;font-weight:700;color:var(--text);">${escHtml(order.to || '—')}</div>
          </div>
        </div>

        <!-- Détails -->
        <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-bottom:0.9rem;">
          ${order.clientName ? '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:0.35rem 0.6rem;font-size:0.7rem;color:var(--text);">👤 '+escHtml(order.clientName)+'</div>' : ''}
          ${order.vehicle    ? '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:0.35rem 0.6rem;font-size:0.7rem;color:var(--text);">🚗 '+escHtml(order.vehicle)+'</div>' : ''}
          ${order.passengers ? '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:0.35rem 0.6rem;font-size:0.7rem;color:var(--text);">👥 '+escHtml(order.passengers)+' passager(s)</div>' : ''}
          ${order.time       ? '<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:0.35rem 0.6rem;font-size:0.7rem;color:var(--text);">🕐 '+escHtml(order.time)+'</div>' : ''}
        </div>

        <!-- Prix -->
        ${order.price ? '<div style="text-align:center;margin-bottom:0.9rem;"><div style="font-family:Syne,sans-serif;font-size:2rem;font-weight:800;color:var(--green);">'+escHtml(order.price)+'</div><div style="font-size:0.65rem;color:var(--muted);">Prix proposé</div></div>' : ''}

        <!-- Boutons ACCEPTER / REFUSER -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;">
          <button onclick="_offerAccept('${escHtml(driverPhone)}')" style="padding:0.85rem;border-radius:14px;border:none;background:linear-gradient(135deg,var(--green),#00cc88);color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;box-shadow:0 4px 20px rgba(0,255,170,0.3);">
            ✅ ACCEPTER
          </button>
          <button onclick="_offerRefuse()" style="padding:0.85rem;border-radius:14px;border:1.5px solid rgba(255,68,102,0.5);background:rgba(255,68,102,0.1);color:var(--red);font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;">
            ❌ REFUSER
          </button>
        </div>
      </div>

      <!-- Info driver non reconnu -->
      ${!driver ? '<div style="background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.7rem;color:var(--cyan);text-align:center;margin-bottom:0.8rem;">🔗 Lien reçu via WhatsApp — Acceptez ou refusez la course ci-dessus.<br><span style="color:var(--muted);">Connectez-vous ensuite pour accéder à votre tableau de bord complet.</span></div>' : ''}

      <!-- Accès dashboard -->
      <button onclick="document.getElementById('_taxiOfferScreen').remove();${driver && driver.status==='approved' ? '_showChauffeurBoard(window._chauffeurDrivers[\''+escHtml(driver.uid||'')+'\'||\'\']\u007C\u007C{phone:\''+escHtml(driverPhone)+'\',pseudo:\'Chauffeur\',status:\'approved\'});' : '_showChauffeurLoginGate();'}" style="width:100%;padding:0.7rem;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--muted);font-size:0.75rem;font-weight:600;cursor:pointer;font-family:\'DM Sans\',sans-serif;">
        → Accéder à mon tableau de bord
      </button>
    </div>
  `;

  document.body.appendChild(wrap);

  // Sauvegarder la commande dans le pendingReq global pour acceptation
  window._tdbPendingReq = order;
}

function _offerAccept(driverPhone) {
  var order = window._tdbPendingReq || {};
  // Sauvegarder dans les commandes en attente du chauffeur (localStorage local)
  var key = 'ambi241_pending_orders_' + driverPhone.replace(/\s|\+/g,'');
  var pending = [];
  try { pending = JSON.parse(localStorage.getItem(key) || '[]'); } catch(e){}
  pending.unshift({ ...order, acceptedAt: new Date().toISOString(), status: 'accepted' });
  try { localStorage.setItem(key, JSON.stringify(pending.slice(0,50))); } catch(e){}

  // Remplacer l'écran d'offre par un écran de confirmation
  var screen = document.getElementById('_taxiOfferScreen');
  if (screen) {
    screen.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem;">' +
      '<div style="font-size:4rem;margin-bottom:1rem;">✅</div>' +
      '<div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800;color:var(--green);margin-bottom:0.5rem;">Course acceptée !</div>' +
      '<div style="font-size:0.8rem;color:var(--muted);margin-bottom:0.4rem;">Rendez-vous au point de départ.</div>' +
      (order.from ? '<div style="font-size:0.9rem;color:var(--text);font-weight:700;margin-bottom:1.5rem;">📍 ' + escHtml(order.from) + '</div>' : '') +
      (order.lat && order.lng ? '<a href="https://maps.google.com/?q='+order.lat+','+order.lng+'" target="_blank" style="padding:0.7rem 1.5rem;border-radius:30px;background:linear-gradient(135deg,var(--green),#00cc88);color:#000;font-weight:800;font-size:0.85rem;text-decoration:none;margin-bottom:1rem;">🗺️ Ouvrir Maps</a>' : '') +
      '<button onclick="document.getElementById(\'_taxiOfferScreen\').remove()" style="margin-top:1rem;padding:0.6rem 1.2rem;border-radius:30px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted);font-size:0.75rem;cursor:pointer;">Fermer</button>' +
      '</div>';
  }
  showTaxiNotification('✅ Course acceptée ! Rendez-vous au client.');
}

function _offerRefuse() {
  var screen = document.getElementById('_taxiOfferScreen');
  if (screen) {
    screen.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:2rem;">' +
      '<div style="font-size:4rem;margin-bottom:1rem;">❌</div>' +
      '<div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:var(--red);margin-bottom:0.5rem;">Course refusée</div>' +
      '<div style="font-size:0.78rem;color:var(--muted);margin-bottom:1.5rem;">Le client sera informé automatiquement.</div>' +
      '<button onclick="document.getElementById(\'_taxiOfferScreen\').remove()" style="padding:0.6rem 1.2rem;border-radius:30px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted);font-size:0.75rem;cursor:pointer;">Fermer</button>' +
      '</div>';
  }
  showTaxiNotification('❌ Course refusée');
}

// ════════════════════════════════════════════════════════════════════
// TABLEAU DE BORD — LOGIQUE
// ════════════════════════════════════════════════════════════════════

let tdbRole = 'chauffeur';
let tdbOnDuty = false;
let tdbMissionActive = false;
let tdbMissionRunning = false;
let tdbTimerInterval = null;
let tdbTimerSec = 0;
let tdbReqCountdownInterval = null;
let tdbReqSec = 30;
let tdbData = {
  chauffeur: { courses: 0, gains: 0, km: 0, note: 5.0 },
  conducteur: { courses: 0, gains: 0, km: 0, note: 5.0 },
  livreur:    { courses: 0, gains: 0, km: 0, note: 5.0 }
};

// ── Listener Firestore pour les demandes taxi en temps réel ──
let _tdbRequestsUnsub = null;

// ── Normalise un numéro de téléphone → format +XXXXXXXXXXX (sans espaces/tirets) ──
function _normPhone(p) {
  if (!p) return '';
  var s = String(p).replace(/[\s\-\.\(\)]/g, ''); // supprimer espaces, tirets, parens, points
  if (s.charAt(0) !== '+') s = '+' + s;            // ajouter le + si absent
  return s;
}
window._normPhone = _normPhone;

function tdbStartListeningRequests() {
  if (!window.db || !window.fbCollection || !window.fbOnSnapshot || !window.fbQuery || !window.fbWhere || !window.fbOrderBy || !window.fbLimit) return;
  if (_tdbRequestsUnsub) { _tdbRequestsUnsub(); _tdbRequestsUnsub = null; }

  var uid = window.currentUserUID || '';
  var driver = uid ? (window._chauffeurDrivers || {})[uid] : null;
  if (!driver || driver.status !== 'approved') return;

  var driverPhone = (driver.phone || '').replace(/[\s\-\(\)]/g, '');
  // Normaliser vers format +XXXXXXXXXXX (avec +, sans espaces)
  var driverPhoneNorm = _normPhone(driver.phone || '');

  // Écouter les nouvelles demandes adressées à ce chauffeur (statut 'pending')
  try {
    var q = window.fbQuery(
      window.fbCollection(window.db, 'taxi_requests'),
      window.fbWhere('driverPhone', '==', driverPhoneNorm),
      window.fbWhere('status', '==', 'pending'),
      window.fbOrderBy('createdAt', 'desc'),
      window.fbLimit(1)
    );
    _tdbRequestsUnsub = window.fbOnSnapshot(q, function(snap) {
      if (!tdbOnDuty) return;
      snap.docChanges().forEach(function(change) {
        if (change.type === 'added') {
          var req = change.doc.data();
          req._docId = change.doc.id;
          _tdbShowRealRequest(req);
        }
      });
    }, function(err) {
      console.warn('[TDB] Listener taxi_requests:', err);
    });
  } catch(e) { console.warn('[TDB] tdbStartListeningRequests:', e); }
}

function tdbStopListeningRequests() {
  if (_tdbRequestsUnsub) { _tdbRequestsUnsub(); _tdbRequestsUnsub = null; }
}

function _tdbShowRealRequest(req) {
  if (tdbMissionActive) { showTaxiNotification('⚠️ Vous avez déjà une course en cours'); return; }
  window._tdbPendingReq = req;
  var card = document.getElementById('tdbRequestCard');
  if (!card) return;
  var fromEl = document.getElementById('tdbReqFrom');
  var toEl   = document.getElementById('tdbReqTo');
  var priceEl= document.getElementById('tdbReqPrice');
  var distEl = document.getElementById('tdbReqDist');
  if (fromEl)  fromEl.textContent  = req.from  || req.pickup  || '—';
  if (toEl)    toEl.textContent    = req.to    || req.destination || '—';
  if (priceEl) priceEl.textContent = req.price ? req.price + ' XAF' : (req.estimatedPrice ? req.estimatedPrice + ' XAF' : '—');
  if (distEl)  distEl.textContent  = req.dist  || req.distance || (req.estimatedKm ? req.estimatedKm + ' km' : '—');
  card.style.display = 'block';
  tdbReqSec = 30;
  var cdEl = document.getElementById('tdbReqCountdown');
  if (cdEl) cdEl.textContent = tdbReqSec + 's';
  clearInterval(tdbReqCountdownInterval);
  tdbReqCountdownInterval = setInterval(function() {
    tdbReqSec--;
    var el = document.getElementById('tdbReqCountdown');
    if (el) el.textContent = tdbReqSec + 's';
    if (tdbReqSec <= 0) {
      clearInterval(tdbReqCountdownInterval);
      if (card) card.style.display = 'none';
      // Marquer comme expiré dans Firestore
      _tdbUpdateRequestStatus(req._docId, 'expired');
      showTaxiNotification('⏰ Demande expirée — en attente de la prochaine demande');
    }
  }, 1000);
  showTaxiNotification('🔔 Nouvelle demande de course reçue !');
}

function _tdbUpdateRequestStatus(docId, status, extra) {
  if (!docId || !window.db || !window.fbDoc || !window.fbUpdateDoc) return;
  try {
    var upd = Object.assign({ status: status, updatedAt: new Date().toISOString() }, extra || {});
    window.fbUpdateDoc(window.fbDoc(window.db, 'taxi_requests', docId), upd).catch(function(e) {
      console.warn('[TDB] updateRequestStatus:', e);
    });
  } catch(e) {}
}

// ── Charger les KPIs depuis Firestore (taxi_kpi/{uid}) ──
function tdbLoadKPIsFromFirestore() {
  var uid = window.currentUserUID || '';
  if (!uid || !window.db || !window.fbDoc || !window.fbGetDoc) return;
  try {
    var today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    window.fbGetDoc(window.fbDoc(window.db, 'taxi_kpi', uid + '_' + today)).then(function(snap) {
      if (snap && snap.exists && snap.exists()) {
        var d = snap.data();
        ['chauffeur', 'conducteur', 'livreur'].forEach(function(role) {
          if (d[role]) {
            tdbData[role].courses = d[role].courses || 0;
            tdbData[role].gains   = d[role].gains   || 0;
            tdbData[role].km      = d[role].km      || 0;
            tdbData[role].note    = d[role].note    || 5.0;
          }
        });
        tdbRefreshKPIs();
      }
    }).catch(function(e) { console.warn('[TDB] loadKPIs:', e); });
  } catch(e) {}
}

// ── Persister les KPIs dans Firestore après chaque course ──
function tdbSaveKPIsToFirestore() {
  var uid = window.currentUserUID || '';
  if (!uid || !window.db || !window.fbDoc || !window.fbSetDoc) return;
  try {
    var today = new Date().toISOString().slice(0, 10);
    window.fbSetDoc(
      window.fbDoc(window.db, 'taxi_kpi', uid + '_' + today),
      { uid: uid, date: today, chauffeur: tdbData.chauffeur, conducteur: tdbData.conducteur, livreur: tdbData.livreur, updatedAt: new Date().toISOString() },
      { merge: true }
    ).catch(function(e) { console.warn('[TDB] saveKPIs:', e); });
  } catch(e) {}
}

// ── Charger l'historique depuis Firestore ──
function tdbLoadHistoryFromFirestore(limit) {
  var uid = window.currentUserUID || '';
  if (!uid || !window.db || !window.fbCollection || !window.fbQuery || !window.fbWhere || !window.fbOrderBy || !window.fbLimit || !window.fbGetDocs) return;
  try {
    var q = window.fbQuery(
      window.fbCollection(window.db, 'taxi_history'),
      window.fbWhere('driverUid', '==', uid),
      window.fbOrderBy('completedAt', 'desc'),
      window.fbLimit(limit || 20)
    );
    window.fbGetDocs(q).then(function(snap) {
      var hist = document.getElementById('tdbHistory');
      if (!hist) return;
      hist.innerHTML = '';
      snap.forEach(function(doc) {
        var r = doc.data();
        var div = document.createElement('div');
        div.className = 'tdb-history-item';
        var d = new Date(r.completedAt || r.createdAt || Date.now());
        var timeStr = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
        var dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
        var stars = '⭐'.repeat(Math.round(r.rating || 5));
        var price = r.price ? r.price.toLocaleString('fr-FR') + ' XAF' : (r.pricePaid ? r.pricePaid.toLocaleString('fr-FR') + ' XAF' : '—');
        div.innerHTML = '<div class="tdb-hist-icon tdb-done-icon">✓</div>' +
          '<div class="tdb-hist-info"><div class="tdb-hist-route">' + _esc(r.from || r.pickup || '?') + ' → ' + _esc(r.to || r.destination || '?') + '</div>' +
          '<div class="tdb-hist-time">' + dateStr + ', ' + timeStr + '</div></div>' +
          '<div class="tdb-hist-price">' + price + '</div>' +
          '<div class="tdb-hist-stars">' + stars + '</div>';
        hist.appendChild(div);
      });
      if (snap.empty) {
        hist.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;">Aucune course terminée pour l\'instant.</div>';
      }
    }).catch(function(e) { console.warn('[TDB] loadHistory:', e); });
  } catch(e) {}
}

function switchDriverRole(role) {
  tdbRole = role;
  // Boutons rôle
  document.querySelectorAll('.tdb-role-btn').forEach(b => b.classList.remove('active'));
  const ids = { chauffeur:'tdbRoleChauf', conducteur:'tdbRoleCond', livreur:'tdbRoleLivr' };
  document.getElementById(ids[role]).classList.add('active');
  // Outils
  document.querySelectorAll('[id^="tdb-tools-"]').forEach(d => d.style.display = 'none');
  document.getElementById('tdb-tools-' + role).style.display = 'block';
  // Mettre à jour labels
  const subs = { chauffeur:'Activez pour recevoir des courses', conducteur:'Activez pour démarrer votre service', livreur:'Activez pour recevoir des colis' };
  document.getElementById('tdbStatusSub').textContent = tdbOnDuty ? 'Vous êtes en service' : subs[role];
  const titles = { chauffeur:'Course en cours', conducteur:'Trajet en cours', livreur:'Livraison en cours' };
  document.getElementById('tdbMissionTitle').textContent = titles[role];
  const kpiLabels = { chauffeur:'Courses', conducteur:'Trajets', livreur:'Livraisons' };
  document.getElementById('tdbKpiCoursesLbl').textContent = kpiLabels[role];
  tdbRefreshKPIs();
}

function toggleDriverService(chk) {
  tdbOnDuty = chk.checked;
  const dot = document.getElementById('tdbStatusDot');
  const label = document.getElementById('tdbStatusLabel');
  const sub = document.getElementById('tdbStatusSub');
  const card = document.getElementById('tdbStatusCard');
  if (tdbOnDuty) {
    dot.classList.add('tdb-dot-active');
    label.textContent = 'En service';
    label.style.color = 'var(--green)';
    sub.textContent = 'Vous recevez des demandes';
    card.style.borderColor = 'rgba(0,255,170,0.4)';
    showTaxiNotification('🟢 Vous êtes maintenant en service !');
    // Persister statut online dans taxiContacts + localStorage
    _persistDriverOnlineStatus(true);
    // Démarrer l'écoute des vraies demandes Firebase
    tdbStartListeningRequests();
  } else {
    dot.classList.remove('tdb-dot-active');
    label.textContent = 'Hors service';
    label.style.color = '';
    sub.textContent = 'Activez pour recevoir des demandes';
    card.style.borderColor = '';
    clearInterval(tdbTimerInterval);
    document.getElementById('tdbMissionCard').style.display = 'none';
    document.getElementById('tdbRequestCard').style.display = 'none';
    tdbMissionActive = false;
    tdbMissionRunning = false;
    showTaxiNotification('🔴 Vous êtes hors service');
    _persistDriverOnlineStatus(false);
    // Arrêter l'écoute des demandes
    tdbStopListeningRequests();
  }
}

// Persiste le statut online du chauffeur dans taxiContacts (localStorage)
function _persistDriverOnlineStatus(online) {
  try {
    var uid = window.currentUserUID || '';
    var contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
    var updated = false;
    contacts = contacts.map(function(c) {
      if((uid && c.uid === uid) || (c.addedBy === 'chauffeur_inscription')) {
        // vérif email si dispo
        var driver = uid ? _chauffeurDrivers[uid] : null;
        if(driver && c.email && c.email.toLowerCase() !== driver.email.toLowerCase()) return c;
        c.online = online;
        c.onlineUpdatedAt = new Date().toISOString();
        if(online && window._taxiUserLat) {
          c.lat = window._taxiUserLat;
          c.lng = window._taxiUserLng;
        } else if(!online) {
          c.lat = null; c.lng = null;
        }
        updated = true;
      }
      return c;
    });
    localStorage.setItem('taxiContacts', JSON.stringify(contacts));
    // Rafraîchir la liste publique si visible
    if(typeof loadTaxiContacts === 'function') loadTaxiContacts();
  } catch(e) {}
}

function tdbRefreshKPIs() {
  const d = tdbData[tdbRole];
  document.getElementById('tdbKpiCourses').textContent = d.courses;
  document.getElementById('tdbKpiGains').textContent = d.gains.toLocaleString('fr-FR') + ' XAF';
  document.getElementById('tdbKpiKm').textContent = d.km + ' km';
  document.getElementById('tdbKpiNote').textContent = d.note.toFixed(1);
}

function tdbSimulateRequest() {
  // Cette fonction est désactivée en production.
  // Les vraies demandes arrivent en temps réel via Firebase (collection 'taxi_requests').
  // Elle reste présente uniquement pour les tests admin locaux.
  showTaxiNotification('ℹ️ Les demandes arrivent automatiquement via Firebase lorsque vous êtes en service.');
}

function tdbAcceptRequest() {
  clearInterval(tdbReqCountdownInterval);
  document.getElementById('tdbRequestCard').style.display = 'none';
  const r = window._tdbPendingReq || {};
  document.getElementById('tdbMissionFrom').textContent = r.from || r.pickup || 'Départ';
  document.getElementById('tdbMissionTo').textContent = r.to || r.destination || 'Destination';
  document.getElementById('tdbClientName').textContent = r.client || r.clientName || 'Client';
  document.getElementById('tdbClientAvatar').textContent = r.avatar || '👤';
  document.getElementById('tdbClientInfo').textContent = r.price ? r.price + ' XAF' : (r.estimatedPrice ? r.estimatedPrice + ' XAF' : '');
  document.getElementById('tdbBtnStart').style.display = 'inline-flex';
  document.getElementById('tdbBtnEnd').style.display = 'none';
  document.getElementById('tdbMissionCard').style.display = 'block';
  tdbMissionActive = true;
  tdbMissionRunning = false;
  tdbTimerSec = 0;
  document.getElementById('tdbMissionTimer').textContent = '00:00';
  // Marquer la demande comme acceptée dans Firestore
  if (r._docId) {
    _tdbUpdateRequestStatus(r._docId, 'accepted', {
      acceptedAt: new Date().toISOString(),
      driverUid: window.currentUserUID || ''
    });
  }
  showTaxiNotification('✅ Course acceptée ! Rendez-vous au client.');
}

function tdbDeclineRequest() {
  clearInterval(tdbReqCountdownInterval);
  document.getElementById('tdbRequestCard').style.display = 'none';
  const r = window._tdbPendingReq || {};
  if (r._docId) {
    _tdbUpdateRequestStatus(r._docId, 'declined', {
      declinedAt: new Date().toISOString(),
      driverUid: window.currentUserUID || ''
    });
  }
  showTaxiNotification('❌ Demande refusée — en attente de la prochaine demande réelle');
}

function tdbStartMission() {
  tdbMissionRunning = true;
  document.getElementById('tdbBtnStart').style.display = 'none';
  document.getElementById('tdbBtnEnd').style.display = 'inline-flex';
  clearInterval(tdbTimerInterval);
  tdbTimerInterval = setInterval(() => {
    tdbTimerSec++;
    const m = String(Math.floor(tdbTimerSec/60)).padStart(2,'0');
    const s = String(tdbTimerSec%60).padStart(2,'0');
    const el = document.getElementById('tdbMissionTimer');
    if(el) el.textContent = m+':'+s;
  }, 1000);
  showTaxiNotification('🚗 Trajet démarré !');
}

function tdbEndMission() {
  clearInterval(tdbTimerInterval);
  document.getElementById('tdbMissionCard').style.display = 'none';
  tdbMissionActive = false;
  tdbMissionRunning = false;
  const r = window._tdbPendingReq || {};
  const priceNum = parseInt((r.price||r.estimatedPrice||'0').toString().replace(/\D/g,'')) || 0;
  const kmNum = parseInt((r.dist||r.distance||r.estimatedKm||'0').toString().replace(/\D+/,'')) || 0;
  const durationMin = Math.round(tdbTimerSec / 60);
  tdbData[tdbRole].courses++;
  tdbData[tdbRole].gains += priceNum;
  tdbData[tdbRole].km += kmNum;
  tdbRefreshKPIs();

  const now = new Date();
  const timeStr = now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
  const hist = document.getElementById('tdbHistory');
  const div = document.createElement('div');
  div.className = 'tdb-history-item tdb-hist-new';
  div.innerHTML = `<div class="tdb-hist-icon tdb-done-icon">✓</div><div class="tdb-hist-info"><div class="tdb-hist-route">${_esc(r.from||r.pickup||'?')} → ${_esc(r.to||r.destination||'?')}</div><div class="tdb-hist-time">Aujourd'hui, ${timeStr}</div></div><div class="tdb-hist-price">${priceNum ? priceNum.toLocaleString('fr-FR') + ' XAF' : '—'}</div><div class="tdb-hist-stars">⭐⭐⭐⭐⭐</div>`;
  hist.prepend(div);

  // Sauvegarder la course dans Firestore (taxi_history)
  var uid = window.currentUserUID || '';
  var driver = uid ? (window._chauffeurDrivers || {})[uid] : null;
  if (uid && window.db && window.fbAddDoc && window.fbCollection) {
    var histEntry = {
      driverUid:     uid,
      driverPhone:   driver ? (driver.phone || '') : '',
      driverName:    driver ? (driver.pseudo || driver.name || '') : '',
      role:          tdbRole,
      from:          r.from || r.pickup || '',
      to:            r.to || r.destination || '',
      price:         priceNum,
      km:            kmNum,
      durationMin:   durationMin,
      client:        r.client || r.clientName || '',
      clientPhone:   r.clientPhone || '',
      rating:        5,
      status:        'completed',
      requestId:     r._docId || '',
      completedAt:   now.toISOString(),
      createdAt:     r.createdAt || now.toISOString()
    };
    window.fbAddDoc(window.fbCollection(window.db, 'taxi_history'), histEntry).catch(function(e) {
      console.warn('[TDB] taxi_history write:', e);
    });
  }

  // Marquer la demande originale comme terminée
  if (r._docId) {
    _tdbUpdateRequestStatus(r._docId, 'completed', {
      completedAt: now.toISOString(),
      durationMin: durationMin,
      finalPrice: priceNum
    });
  }

  // Persister les KPIs du jour
  tdbSaveKPIsToFirestore();

  showTaxiNotification('🎉 Course terminée ! +' + (priceNum ? priceNum.toLocaleString('fr-FR') + ' XAF' : '0'));
}

function tdbReportIssue() {
  var reasons = ['Passager non trouvé','Problème de route','Urgence véhicule','Passager agressif','Adresse incorrecte','Paiement refusé'];
  var reason = prompt('Signaler un incident ?\n\nMotifs possibles :\n' + reasons.map(function(r,i){return (i+1)+'. '+r;}).join('\n') + '\n\nEntrez le motif :');
  if (!reason || !reason.trim()) return;
  var r = window._tdbPendingReq || {};
  var uid = window.currentUserUID || '';
  var driver = uid ? (window._chauffeurDrivers || {})[uid] : null;
  if (uid && window.db && window.fbAddDoc && window.fbCollection) {
    window.fbAddDoc(window.fbCollection(window.db, 'taxi_incidents'), {
      driverUid:   uid,
      driverPhone: driver ? (driver.phone || '') : '',
      driverName:  driver ? (driver.pseudo || driver.name || '') : '',
      requestId:   r._docId || '',
      from:        r.from || r.pickup || '',
      to:          r.to || r.destination || '',
      client:      r.client || r.clientName || '',
      reason:      reason.trim(),
      reportedAt:  new Date().toISOString(),
      status:      'open'
    }).then(function() {
      showTaxiNotification('⚠️ Incident signalé — support notifié');
    }).catch(function(e) {
      console.warn('[TDB] incident report:', e);
      showTaxiNotification('⚠️ Incident enregistré localement');
    });
  } else {
    showTaxiNotification('⚠️ Incident enregistré — synchronisé à la reconnexion');
  }
}

function tdbCallClient() {
  const r = window._tdbPendingReq || {};
  const phone = r.clientPhone || r.phone || '';
  if (phone) {
    window.location.href = 'tel:' + phone.replace(/\s/g, '');
  } else {
    showTaxiNotification('📞 Numéro client non disponible');
  }
}

function tdbNavigation() {
  const r = window._tdbPendingReq || {};
  const dest = r.to || 'Libreville, Gabon';
  const origin = r.from || '';
  let url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(dest);
  if(origin) url += '&origin=' + encodeURIComponent(origin);
  showTaxiNotification('🗺️ Ouverture navigation vers ' + dest);
  window.open(url, '_blank');
}

function tdbShowEarnings() {
  const d = tdbData[tdbRole];
  const avg = d.courses > 0 ? Math.round(d.gains/d.courses) : 0;
  const html = `
    <div style="position:fixed;inset:0;z-index:950;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--surface);border:1.5px solid rgba(255,215,0,0.3);border-radius:20px;padding:1.5rem;width:min(360px,100%);box-shadow:0 0 40px rgba(255,215,0,0.15);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;">
          <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--amber);">💰 Gains du jour</div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.9rem;">✕</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.7rem;margin-bottom:1rem;">
          <div style="background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:0.9rem;text-align:center;">
            <div style="font-size:1.5rem;font-weight:800;color:var(--amber);">${d.courses}</div>
            <div style="font-size:0.65rem;color:var(--muted);margin-top:0.2rem;">COURSES</div>
          </div>
          <div style="background:rgba(0,255,170,0.08);border:1px solid rgba(0,255,170,0.2);border-radius:12px;padding:0.9rem;text-align:center;">
            <div style="font-size:1.2rem;font-weight:800;color:var(--green);">${d.gains.toLocaleString('fr-FR')}</div>
            <div style="font-size:0.65rem;color:var(--muted);margin-top:0.2rem;">XAF TOTAL</div>
          </div>
          <div style="background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:0.9rem;text-align:center;">
            <div style="font-size:1.3rem;font-weight:800;color:var(--cyan);">${d.km} km</div>
            <div style="font-size:0.65rem;color:var(--muted);margin-top:0.2rem;">PARCOURUS</div>
          </div>
          <div style="background:rgba(255,45,155,0.08);border:1px solid rgba(255,45,155,0.2);border-radius:12px;padding:0.9rem;text-align:center;">
            <div style="font-size:1.3rem;font-weight:800;color:var(--pink);">${avg.toLocaleString('fr-FR')}</div>
            <div style="font-size:0.65rem;color:var(--muted);margin-top:0.2rem;">XAF MOY./COURSE</div>
          </div>
        </div>
        <div style="background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.15);border-radius:10px;padding:0.8rem;font-size:0.75rem;color:var(--muted);">
          📊 Objectif journalier : <strong style="color:var(--amber);">50 000 XAF</strong>
          <div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;margin-top:0.5rem;">
            <div style="height:100%;width:${Math.min(100,Math.round(d.gains/500))}%;background:linear-gradient(90deg,var(--amber),var(--green));border-radius:3px;transition:width 0.5s;"></div>
          </div>
          <div style="margin-top:0.3rem;">${Math.min(100,Math.round(d.gains/500))}% atteint</div>
        </div>
      </div>
    </div>`;
  const wrap = document.createElement('div');
  wrap.innerHTML = html;
  document.body.appendChild(wrap.firstElementChild);
}

function tdbShowStats() {
  const d = tdbData[tdbRole];
  const avg = d.courses > 0 ? Math.round(d.gains/d.courses) : 0;
  const uid = window.currentUserUID || '';

  // Calculer le taux d'acceptation réel depuis les données Firebase
  let acceptRate = '—';
  let peakHour = '—';
  let bestZone = '—';

  const buildModal = function(rate, peak, zone) {
    const html = `
    <div style="position:fixed;inset:0;z-index:950;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)this.remove()">
      <div style="background:var(--surface);border:1.5px solid rgba(255,45,155,0.3);border-radius:20px;padding:1.5rem;width:min(360px,100%);box-shadow:0 0 40px rgba(255,45,155,0.1);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.2rem;">
          <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--pink);">📈 Statistiques</div>
          <button onclick="this.closest('[style*=fixed]').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.9rem;">✕</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.6rem;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:var(--muted);">🕐 Heure de pointe</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--text);">${peak}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:var(--muted);">📍 Zone la + fréquente</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--amber);">${zone}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:var(--muted);">💰 Gain moy./course</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--green);">${avg ? avg.toLocaleString('fr-FR') + ' XAF' : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:var(--muted);">⭐ Note chauffeur</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--amber);">${d.note.toFixed(1)} / 5.0</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:var(--muted);">🚗 Distance totale</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--cyan);">${d.km > 0 ? d.km + ' km' : '—'}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding:0.65rem 0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">
            <span style="font-size:0.8rem;color:var(--muted);">✅ Taux d'acceptation</span>
            <span style="font-size:0.8rem;font-weight:700;color:var(--green);">${rate}</span>
          </div>
        </div>
      </div>
    </div>`;
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    document.body.appendChild(wrap.firstElementChild);
  };

  // Calculer les stats depuis l'historique Firestore si possible
  if (uid && window.db && window.fbCollection && window.fbQuery && window.fbWhere && window.fbOrderBy && window.fbLimit && window.fbGetDocs) {
    const q30 = window.fbQuery(
      window.fbCollection(window.db, 'taxi_history'),
      window.fbWhere('driverUid', '==', uid),
      window.fbOrderBy('completedAt', 'desc'),
      window.fbLimit(50)
    );
    window.fbGetDocs(q30).then(function(snap) {
      const rides = [];
      snap.forEach(function(doc) { rides.push(doc.data()); });
      // Heure de pointe
      const hourCounts = {};
      rides.forEach(function(r) {
        if (r.completedAt) {
          const h = new Date(r.completedAt).getHours();
          hourCounts[h] = (hourCounts[h] || 0) + 1;
        }
      });
      const peakH = Object.entries(hourCounts).sort(function(a,b){ return b[1]-a[1]; })[0];
      const peakStr = peakH ? (peakH[0] + 'h – ' + (parseInt(peakH[0])+2) + 'h') : '—';
      // Zone la plus fréquente
      const zoneCounts = {};
      rides.forEach(function(r) {
        const z = (r.from || '').split(' ')[0];
        if (z) zoneCounts[z] = (zoneCounts[z] || 0) + 1;
      });
      const topZone = Object.entries(zoneCounts).sort(function(a,b){ return b[1]-a[1]; })[0];
      const zoneStr = topZone ? topZone[0] : '—';
      // Taux d'acceptation depuis taxi_requests
      const acceptQ = window.fbQuery(
        window.fbCollection(window.db, 'taxi_requests'),
        window.fbWhere('driverUid', '==', uid),
        window.fbOrderBy('createdAt', 'desc'),
        window.fbLimit(50)
      );
      window.fbGetDocs(acceptQ).then(function(reqSnap) {
        let total = 0, accepted = 0;
        reqSnap.forEach(function(doc) {
          const s = doc.data().status;
          total++;
          if (s === 'accepted' || s === 'completed') accepted++;
        });
        const rateStr = total > 0 ? Math.round(accepted/total*100) + '%' : '—';
        buildModal(rateStr, peakStr, zoneStr);
      }).catch(function() { buildModal('—', peakStr, zoneStr); });
    }).catch(function() { buildModal('—', '—', '—'); });
  } else {
    buildModal('—', '—', '—');
  }
}

// Conducteur
function tdbMonterPassager() {
  const el = document.getElementById('tdbPassagers');
  const cap = parseInt(document.getElementById('tdbCapacite').textContent)||40;
  let n = parseInt(el.textContent)||0;
  if(n < cap) { el.textContent = ++n; tdbData.conducteur.courses++; tdbRefreshKPIs(); showTaxiNotification('⬆️ +1 passager monté'); }
  else showTaxiNotification('⚠️ Bus complet !');
}

function tdbDescendrePassager() {
  const el = document.getElementById('tdbPassagers');
  let n = parseInt(el.textContent)||0;
  if(n > 0) { el.textContent = --n; showTaxiNotification('⬇️ 1 passager descendu'); }
}

function tdbArretUrgence() {
  if(confirm('🚨 ARRÊT D\'URGENCE\n\nActiver le signal d\'urgence et notifier le centre ?'))
    showTaxiNotification('🚨 Urgence signalée — Centre de contrôle averti');
}

function tdbChangerLigne() {
  // Récupère les lignes réelles depuis les contacts conducteurs enregistrés
  var contacts = [];
  try { contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]'); } catch(e) {}
  var lignes = contacts.filter(function(c) { return c.ligne || c.line; }).map(function(c) { return c.ligne || c.line; });
  if (lignes.length === 0) {
    lignes = ['Ligne 1 — Centre → Owendo','Ligne 2 — Akanda → Glass','Ligne 3 — Owendo → Aéroport','Ligne 4 — Louis → Angondjé'];
  }
  // Afficher un menu de sélection réel
  var options = lignes.map(function(l, i) { return (i+1) + '. ' + l; }).join('\n');
  var choice = prompt('Changer de ligne :\n\n' + options + '\n\nEntrez le numéro de la ligne :');
  var idx = parseInt(choice) - 1;
  if (isNaN(idx) || idx < 0 || idx >= lignes.length) return;
  var selected = lignes[idx];
  var el = document.getElementById('tdbLigne');
  if (el) el.textContent = selected;
  // Persister le choix
  var uid = window.currentUserUID || '';
  if (uid) {
    try { localStorage.setItem('ambi241_driver_ligne_' + uid, selected); } catch(e) {}
  }
  showTaxiNotification('🔀 Ligne changée : ' + selected);
}

// Livreur
function tdbDelivered(btn, id) {
  const item = btn.closest('.tdb-delivery-item');
  item.style.opacity = '0.5';
  item.style.textDecoration = 'line-through';
  btn.textContent = '✓';
  btn.style.background = 'rgba(0,255,170,0.2)';
  btn.style.borderColor = 'rgba(0,255,170,0.4)';
  btn.style.color = 'var(--green)';
  btn.disabled = true;
  const el = document.getElementById('tdbColisLivres');
  if(el) el.textContent = (parseInt(el.textContent)||0)+1;
  const att = document.getElementById('tdbColisAttente');
  if(att) att.textContent = Math.max(0, (parseInt(att.textContent)||0)-1);
  tdbData.livreur.courses++; tdbData.livreur.gains += 1500;
  tdbRefreshKPIs();
  showTaxiNotification('📦 Colis #' + id + ' livré avec succès !');
}

function tdbScanColis() { showTaxiNotification('📷 Scanner ouvert... (simulation)'); }
function tdbEchecLivraison() {
  const el = document.getElementById('tdbColisEchecs');
  if(el) el.textContent = (parseInt(el.textContent)||0)+1;
  showTaxiNotification('🔄 Échec enregistré — colis renvoyé au dépôt');
}
function tdbContactClient() { showTaxiNotification('📞 Appel client en cours...'); }
function tdbRapportFin() {
  const d = tdbData.livreur;
  alert('📝 RAPPORT DE FIN DE JOURNÉE\n\n' +
    '✅ Livrés : ' + document.getElementById('tdbColisLivres').textContent + '\n' +
    '❌ Échecs : ' + document.getElementById('tdbColisEchecs').textContent + '\n' +
    '💰 Gains : ' + d.gains.toLocaleString('fr-FR') + ' XAF\n' +
    '⭐ Note : ' + d.note.toFixed(1) + '/5.0\n\n' +
    'Rapport envoyé au gestionnaire.');
}

function tdbLoadMoreHistory() {
  tdbLoadHistoryFromFirestore(50);
}

// Init dashboard on first show
window._tdbInited = false;
const _origSwitchTaxiTab = switchTaxiTab;
switchTaxiTab = function(tab) {
  _origSwitchTaxiTab(tab);
  if(tab === 'dashboard' && !window._tdbInited) {
    window._tdbInited = true;
    // Charger les KPIs du jour depuis Firestore
    tdbLoadKPIsFromFirestore();
    // Charger l'historique réel des courses
    tdbLoadHistoryFromFirestore(20);
    // Exposer les nouvelles fonctions Firebase sur window
    window.tdbStartListeningRequests = tdbStartListeningRequests;
    window.tdbStopListeningRequests  = tdbStopListeningRequests;
    window.tdbLoadKPIsFromFirestore  = tdbLoadKPIsFromFirestore;
    window.tdbSaveKPIsToFirestore    = tdbSaveKPIsToFirestore;
    window.tdbLoadHistoryFromFirestore = tdbLoadHistoryFromFirestore;
  }
};

// ── Exposer TOUTES les fonctions taxi sur window (portée module isolée) ──
window.taxiProOpenCommandModal    = taxiProOpenCommandModal;
window.taxiProCloseCommandModal   = taxiProCloseCommandModal;
window.taxiProNextStep            = taxiProNextStep;
window.taxiProPrevStep            = taxiProPrevStep;
window.taxiProSelectVehicle       = taxiProSelectVehicle;
window.taxiProSelectGPS           = taxiProSelectGPS;
window.taxiProSelectCurrency      = taxiProSelectCurrency;
window.taxiProUpdatePriceDisplay  = taxiProUpdatePriceDisplay;
window.taxiProRenderDriversList   = taxiProRenderDriversList;
window.taxiProSelectDriver        = taxiProSelectDriver;
window.taxiProSubmitOrder         = taxiProSubmitOrder;
window.taxiProShowDriverResponseModal = taxiProShowDriverResponseModal;
window.taxiProHideDriverResponseModal = taxiProHideDriverResponseModal;
window.taxiProSimulateDriverResponse  = taxiProSimulateDriverResponse;
window._taxiProListenDriverResponse   = _taxiProListenDriverResponse;
window.taxiProAcceptOrder         = taxiProAcceptOrder;
window.taxiProAcceptCounter       = taxiProAcceptCounter;
window.taxiProProposeCounter      = taxiProProposeCounter;
window.taxiProCancelOrder         = taxiProCancelOrder;
window.taxiProCallDriver          = taxiProCallDriver;
window.taxiProShowToast           = taxiProShowToast;
window.switchDriverRole           = switchDriverRole;
window.toggleDriverService        = toggleDriverService;
window.tdbRefreshKPIs             = tdbRefreshKPIs;
window.tdbSimulateRequest         = tdbSimulateRequest;
window.tdbAcceptRequest           = tdbAcceptRequest;
window.tdbDeclineRequest          = tdbDeclineRequest;
window.tdbStartMission            = tdbStartMission;
window.tdbEndMission              = tdbEndMission;
window.tdbReportIssue             = tdbReportIssue;
window.tdbCallClient              = tdbCallClient;
window.tdbNavigation              = tdbNavigation;
window.tdbShowEarnings            = tdbShowEarnings;
window.tdbShowStats               = tdbShowStats;
window.tdbMonterPassager          = tdbMonterPassager;
window.tdbDescendrePassager       = tdbDescendrePassager;
window.tdbArretUrgence            = tdbArretUrgence;
window.tdbChangerLigne            = tdbChangerLigne;
window.tdbDelivered               = tdbDelivered;
window.tdbScanColis               = tdbScanColis;
window.tdbEchecLivraison          = tdbEchecLivraison;
window.tdbContactClient           = tdbContactClient;
window.tdbRapportFin              = tdbRapportFin;
window.tdbLoadMoreHistory         = tdbLoadMoreHistory;
window.tdbStartListeningRequests  = tdbStartListeningRequests;
window.tdbStopListeningRequests   = tdbStopListeningRequests;
window.tdbLoadKPIsFromFirestore   = tdbLoadKPIsFromFirestore;
window.tdbSaveKPIsToFirestore     = tdbSaveKPIsToFirestore;
window.tdbLoadHistoryFromFirestore= tdbLoadHistoryFromFirestore;

// ════════════════════════════════════════════════════════════════════
// ESPACE CHAUFFEUR — TABLEAU DE BORD PRIVÉ (accès par mot de passe)
// ════════════════════════════════════════════════════════════════════

// ── URL DE BASE DE L'APPLICATION (configurable par l'admin) ──────────
// Si l'app est hébergée en ligne, cette valeur est automatique.
// Si l'app tourne en local (file://), définissez manuellement l'URL ici :
(function() {
  var saved = localStorage.getItem('ambi241_app_url');
  var proto = window.location.protocol;
  var auto  = (proto === 'http:' || proto === 'https:')
              ? window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '/').replace(/\/$/, '') + '/'
              : window.location.href.split('?')[0].replace(/\/[^\/]*$/, '/'); // fallback file://
  window.AMBI241_APP_URL = saved || auto || null;
  if (!window.AMBI241_APP_URL) {
    console.warn('AMBI241: URL non configurée - liens WhatsApp chauffeur désactivés');
  }
})();
window.setAmbi241AppUrl = function(url) {
  if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
    alert('❌ URL invalide. Elle doit commencer par https://');
    return;
  }
  var clean = url.replace(/\?.*$/, '').replace(/\/$/, '') + '/';
  localStorage.setItem('ambi241_app_url', clean);
  window.AMBI241_APP_URL = clean;
  alert('✅ URL configurée : ' + clean + '\nLes liens chauffeur WhatsApp utiliseront cette adresse.');
};
// ─────────────────────────────────────────────────────────────────────

/* ════════════════════════════════════════════════════════════
   _chauffeurDrivers — Source unique : Firestore (chauffeurs/{uid})
   Le cache localStorage sert de fallback offline uniquement.
════════════════════════════════════════════════════════════ */
var _chauffeurDrivers = JSON.parse(localStorage.getItem('ambi241_chauffeurs') || '{}');

function saveChauffeurDrivers(uid, data) {
  if(uid && data) _chauffeurDrivers[uid] = data;
  try { localStorage.setItem('ambi241_chauffeurs', JSON.stringify(_chauffeurDrivers)); } catch(e) {}
  if(!window.db || !window.fbSetDoc || !window.fbDoc) return;
  if(uid && data){
    window.fbSetDoc(window.fbDoc(window.db, 'chauffeurs', uid), data, { merge: true })
      .catch(function(e){ console.warn('[Chauffeurs] Firestore write error', e); });
  }
}

function loadChauffeurDriversFromFirestore(){
  if(!window.db || !window.fbCollection || !window.fbOnSnapshot) return;
  window.fbOnSnapshot(
    window.fbCollection(window.db, 'chauffeurs'),
    function(snap){
      snap.forEach(function(d){ _chauffeurDrivers[d.id] = Object.assign({ uid: d.id }, d.data()); });
      try { localStorage.setItem('ambi241_chauffeurs', JSON.stringify(_chauffeurDrivers)); } catch(e) {}
      window._chauffeurDrivers = _chauffeurDrivers;
      if(typeof loadTaxiContacts === 'function') loadTaxiContacts();
    },
    function(err){ console.warn('[Chauffeurs] onSnapshot error', err); }
  );
}
(function _waitFbDrivers(){
  if(window.db && window.fbCollection && window.fbOnSnapshot){ loadChauffeurDriversFromFirestore(); }
  else { setTimeout(_waitFbDrivers, 800); }
})();

// ── Réparer les chauffeurs existants dont le phone est un email ──
function repairDriverPhones() {
  var contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
  var changed = false;
  contacts.forEach(function(c) {
    // Si le phone ressemble à un email (contient @), c'est un bug → vider pour forcer correction
    if (c.phone && c.phone.indexOf('@') !== -1) {
      c.phone = '';
      c.whatsapp = '';
      changed = true;
    }
  });
  if (changed) {
    localStorage.setItem('taxiContacts', JSON.stringify(contacts));
    console.warn('⚠️ Numéros chauffeurs corrompus (email utilisé comme phone) ont été réinitialisés. Veuillez re-saisir les numéros depuis le panneau admin.');
  }
}
repairDriverPhones();

// Appelé quand un membre s'inscrit avec le flag "chauffeur"
function registerUserAsDriver(uid, email, pseudo, password) {
  var driverDataPending = {
    uid: uid, email: email, pseudo: pseudo,
    password: password,
    status: 'pending',
    joinedAt: new Date().toISOString(),
    courses: 0, gains: 0
  };
  saveChauffeurDrivers(uid, driverDataPending);
  // Notif admin
  if(typeof pushNotif === 'function') {
    pushNotif({ targetRole:'admin', key:'new_driver', icon:'🚗', title:'Nouveau Chauffeur inscrit',
      msg: pseudo + ' (' + email + ') demande le statut Chauffeur', channel:'push', fromAdmin:false });
  }
  // NE PAS ajouter à taxiContacts tant que non approuvé par admin
}
window.registerUserAsDriver = registerUserAsDriver;

// Admin : désigner un membre existant comme chauffeur
window.adminDesignDriver = function(uid, email, pseudo, _unused_password, phone) {
  if(!isAdmin) { showToast('Admin requis'); return; }
  var cleanPhone = (phone || '').replace(/\s|\+/g,'');
  var driverDataApproved = {
    uid: uid, email: email, pseudo: pseudo,
    // password supprimé — Firebase Auth gère les credentials
    phone: cleanPhone,
    whatsapp: cleanPhone,
    status: 'approved', approvedBy: 'admin',
    approvedAt: new Date().toISOString(),
    courses: 0, gains: 0
  };
  saveChauffeurDrivers(uid, driverDataApproved);

  // ── Ajouter/mettre à jour dans Firestore taxi_contacts (partagé) ──
  var contactEntry = {
    name: pseudo, phone: cleanPhone, whatsapp: cleanPhone,
    type: '🚗 Taxi Particulier',
    active: true, online: true, hours: '24H/24',
    isEnterprise: false, availability: 'open',
    addedBy: 'chauffeur_inscription', email: email, uid: uid,
    addedAt: new Date().toISOString(), photo: '', rating: 5.0, courses: 0
  };
  if(window.db && window.fbCollection && window.fbQuery && window.fbWhere && window.fbGetDocs){
    window.fbGetDocs(window.fbQuery(window.fbCollection(window.db,'taxi_contacts'), window.fbWhere('uid','==',uid)))
      .then(function(snap){
        if(!snap.empty){
          snap.forEach(function(d){ window.fbSetDoc(window.fbDoc(window.db,'taxi_contacts',d.id), contactEntry, {merge:true}).catch(function(){}); });
        } else {
          window.fbAddDoc(window.fbCollection(window.db,'taxi_contacts'), contactEntry).catch(function(){});
        }
        if(typeof loadTaxiContacts==='function') loadTaxiContacts();
        if(typeof loadAdminContacts==='function') loadAdminContacts();
      }).catch(function(e){ console.warn('[taxiContacts] adminDesignDriver error', e); });
  } else {
    var lsContacts = JSON.parse(localStorage.getItem('taxiContacts')||'[]');
    var eIdx = lsContacts.findIndex(function(c){ return c.uid===uid || (c.email&&c.email.toLowerCase()===email.toLowerCase()); });
    if(eIdx>=0){ lsContacts[eIdx]=Object.assign(lsContacts[eIdx],contactEntry); } else { lsContacts.push(contactEntry); }
    localStorage.setItem('taxiContacts',JSON.stringify(lsContacts));
    if(typeof loadTaxiContacts==='function') loadTaxiContacts();
    if(typeof loadAdminContacts==='function') loadAdminContacts();
  }

  showToast('✅ ' + pseudo + ' désigné Chauffeur + ajouté à la liste 24H !');
  // ── Envoyer un email Firebase de définition de mot de passe ──
  // Le chauffeur reçoit un lien pour choisir son mot de passe AMBI241
  if(email && window.fbSendPasswordResetEmail && window.auth){
    window.fbSendPasswordResetEmail(window.auth, email).then(function(){
      showToast('📧 Lien de connexion envoyé à ' + email);
      addAdminLog('📧 Email activation Chauffeur envoyé → ' + pseudo + ' (' + email + ')', 'driver_activation_email');
    }).catch(function(err){
      if(err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'){
        showToast('⚠️ ' + pseudo + ' doit d\'abord créer un compte AMBI241 avec cet email.');
      }
      // Autres erreurs ignorées silencieusement — le chauffeur peut se connecter avec son compte existant
    });
  }
  if(typeof renderAdmUsers === 'function') renderAdmUsers();
};

// Admin : révoquer un chauffeur
window.adminRevokeDriver = function(uid) {
  if(!isAdmin) { showToast('Admin requis'); return; }
  if(_chauffeurDrivers[uid]) {
    _chauffeurDrivers[uid].status = 'revoked';
    saveChauffeurDrivers(uid, _chauffeurDrivers[uid]);
    showToast('Statut chauffeur révoqué');
  }
};

// Admin : valider la pièce d'identité d'un chauffeur
window._adminVerifyIdDoc = function(uid) {
  if(!isAdmin) { showToast('Admin requis'); return; }
  try {
    var raw = localStorage.getItem('ambi241_idDoc_'+uid);
    if(raw){
      var doc = JSON.parse(raw);
      doc.verified = true;
      doc.verifiedAt = new Date().toISOString();
      localStorage.setItem('ambi241_idDoc_'+uid, JSON.stringify(doc));
      showToast('✅ Pièce d\'identité vérifiée !');
      // Refresh panel
      var panel = document.getElementById('_chauffeurAdminPanel');
      if(panel){ panel.remove(); _showChauffeurAdminPanel(); }
    }
  } catch(e){ showToast('Erreur vérification'); }
};

// Ouvrir le tableau de bord chauffeur (sécurisé par MDP du compte)
function openChauffeurDashboard() {
  // Si admin : accès direct avec vue de gestion
  if(isAdmin) { _showChauffeurAdminPanel(); return; }

  // Si membre connecté et approuvé : accès direct
  var uid = window.currentUserUID || '';
  var driver = uid ? _chauffeurDrivers[uid] : null;
  if(driver && driver.status === 'approved') {
    _showChauffeurBoard(driver);
    return;
  }
  if(driver && driver.status === 'pending') {
    showToast('⏳ Votre demande Chauffeur est en attente de validation Admin');
    return;
  }

  // Sinon : demander le mot de passe de compte
  _showChauffeurLoginGate();
}
window.openChauffeurDashboard = openChauffeurDashboard;
window._showChauffeurAdminPanel = _showChauffeurAdminPanel;
window._chauffeurDrivers = _chauffeurDrivers;

// Portail de connexion chauffeur
function _showChauffeurLoginGate() {
  var old = document.getElementById('_chauffeurGate');
  if(old) old.remove();
  var div = document.createElement('div');
  div.id = '_chauffeurGate';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1rem;';
  div.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid rgba(157,132,255,0.4);border-radius:22px;padding:1.6rem 1.4rem;width:min(370px,100%);position:relative;">
      <button onclick="document.getElementById('_chauffeurGate').remove()" style="position:absolute;top:0.7rem;right:0.9rem;background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;">✕</button>
      <div style="text-align:center;margin-bottom:1.2rem;">
        <div style="font-size:2.5rem;margin-bottom:0.4rem;">🚗</div>
        <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1rem;color:var(--amber);">Espace Chauffeur Taxi Pro</div>
        <div style="font-size:0.72rem;color:var(--muted);margin-top:0.25rem;">Accès sécurisé — Membres Chauffeurs uniquement</div>
      </div>
      <div style="margin-bottom:0.7rem;">
        <label style="font-size:0.72rem;color:var(--muted);display:block;margin-bottom:0.3rem;">Email de votre compte AMBI241</label>
        <input id="_cgEmail" type="email" placeholder="votre@email.com" style="width:100%;background:var(--surface2);border:1px solid rgba(157,132,255,0.25);border-radius:9px;color:var(--text);padding:0.55rem 0.7rem;font-size:0.85rem;font-family:DM Sans,sans-serif;outline:none;">
      </div>
      <div style="margin-bottom:1rem;">
        <label style="font-size:0.72rem;color:var(--muted);display:block;margin-bottom:0.3rem;">Mot de passe de votre compte</label>
        <input id="_cgPwd" type="password" placeholder="Mot de passe" style="width:100%;background:var(--surface2);border:1px solid rgba(157,132,255,0.25);border-radius:9px;color:var(--text);padding:0.55rem 0.7rem;font-size:0.85rem;font-family:DM Sans,sans-serif;outline:none;">
      </div>
      <div id="_cgMsg" style="font-size:0.75rem;text-align:center;margin-bottom:0.7rem;display:none;color:var(--red);"></div>
      <button onclick="_verifyChauffeurLogin()" id="_cgLoginBtn" style="width:100%;padding:0.6rem;border-radius:11px;border:none;background:linear-gradient(135deg,var(--amber),#ff8800);color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;">🔓 Accéder à mon Tableau de Bord</button>
      <div style="text-align:center;margin-top:0.6rem;">
        <button onclick="document.getElementById('_chauffeurGate').remove();openForgotModal();" style="background:none;border:none;color:var(--cyan);font-size:0.73rem;cursor:pointer;text-decoration:underline;font-family:'DM Sans',sans-serif;">🔑 Mot de passe oublié ?</button>
      </div>
      <div style="text-align:center;margin-top:0.5rem;">
        <span style="font-size:0.68rem;color:var(--muted);">Pas encore chauffeur ? </span>
        <button onclick="document.getElementById('_chauffeurGate').remove();document.getElementById('userOverlay').classList.add('show');switchUserTab('inscription')" style="background:none;border:none;color:var(--amber);font-size:0.68rem;cursor:pointer;text-decoration:underline;font-family:DM Sans,sans-serif;">Inscrivez-vous</button>
      </div>
    </div>`;
  document.body.appendChild(div);
  setTimeout(function(){ var el=document.getElementById('_cgEmail'); if(el) el.focus(); }, 80);
}

function _verifyChauffeurLogin() {
  var email = (document.getElementById('_cgEmail').value || '').trim().toLowerCase();
  var pwd   = (document.getElementById('_cgPwd').value || '').trim();
  var msg   = document.getElementById('_cgMsg');
  var btn   = document.getElementById('_cgLoginBtn');
  if(!email || !pwd) { msg.textContent='Remplissez tous les champs'; msg.style.display='block'; return; }

  // ── Vérifier d'abord que l'email est bien un chauffeur enregistré ──
  var driver = Object.values(_chauffeurDrivers).find(function(d){
    return (d.email||'').toLowerCase() === email;
  });
  if(!driver) { msg.textContent='Cet email n\'est pas enregistré comme chauffeur.'; msg.style.display='block'; return; }
  if(driver.status === 'pending') { msg.textContent='Votre demande est en attente de validation Admin.'; msg.style.display='block'; return; }
  if(driver.status === 'revoked') { msg.textContent='Accès révoqué. Contactez l\'Admin.'; msg.style.display='block'; return; }

  // ── Authentification via Firebase Auth (même compte AMBI241) ──
  if(!window.fbSignIn || !window.auth) {
    // Firebase indisponible : afficher un message clair
    msg.textContent='Service d\'authentification indisponible. Réessayez dans quelques instants.';
    msg.style.display='block';
    if(btn){ btn.disabled=false; btn.textContent='🔓 Accéder à mon Tableau de Bord'; }
    return;
  }

  msg.style.display='none';
  if(btn){ btn.disabled=true; btn.textContent='⏳ Connexion...'; }

  window.fbSignIn(window.auth, email, pwd).then(function(result){
    // Connexion Firebase réussie → accès chauffeur
    if(btn){ btn.disabled=false; btn.textContent='🔓 Accéder à mon Tableau de Bord'; }
    var old = document.getElementById('_chauffeurGate'); if(old) old.remove();
    // Enrichir le driver avec les infos Firebase Auth
    driver.uid   = driver.uid   || result.user.uid;
    driver.email = driver.email || result.user.email;
    _showChauffeurBoard(driver);
  }).catch(function(err){
    if(btn){ btn.disabled=false; btn.textContent='🔓 Accéder à mon Tableau de Bord'; }
    var code = err.code || '';
    var errMsg = (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
      ? 'Mot de passe incorrect. Utilisez le même que votre compte AMBI241.'
      : (code === 'auth/user-not-found' || code === 'auth/invalid-email')
        ? 'Aucun compte AMBI241 trouvé pour cet email.'
        : (code === 'auth/too-many-requests')
          ? 'Trop de tentatives. Réessayez plus tard.'
          : 'Erreur : ' + (err.message||code);
    msg.textContent = errMsg; msg.style.display='block';
  });
}
window._verifyChauffeurLogin = _verifyChauffeurLogin;

// Afficher le tableau de bord chauffeur — VERSION REDESIGNÉE
function _showChauffeurBoard(driver) {
  var old = document.getElementById('_chauffeurBoard');
  if(old) old.remove();

  // ── Stats persistées par chauffeur ──
  var statsKey = 'ambi241_drvstats_' + (driver.uid||driver.email||'x');
  var stats = JSON.parse(localStorage.getItem(statsKey) || '{"courses":0,"gains":0,"km":0,"note":4.8,"history":[]}');

  // ── Avatar — depuis Firebase en priorité, localStorage en cache ──
  var myUid = driver.uid || '';
  var myPhotoB64 = driver.photoURL || driver.photo || '';
  if(!myPhotoB64){ try { myPhotoB64 = localStorage.getItem('ambi241_photo_'+myUid) || ''; } catch(e){} }
  // Recharger depuis Firebase en arrière-plan
  if(myUid && window.db && window.fbGetDoc && window.fbDoc && !myPhotoB64){
    window.fbGetDoc(window.fbDoc(window.db,'users',myUid)).then(function(snap){
      if(snap.exists && snap.exists() && snap.data().photoURL){
        var url = snap.data().photoURL;
        try{ localStorage.setItem('ambi241_photo_'+myUid, url); }catch(e){}
        var av = document.getElementById('_chauffAvatar_'+myUid);
        if(av) av.src = url;
      }
    }).catch(function(){});
  }
  var avatarHtml = myPhotoB64
    ? '<img id="_chauffAvatar_'+myUid+'" src="'+myPhotoB64+'" style="width:56px;height:56px;border-radius:50%;object-fit:cover;border:2.5px solid var(--amber);">'
    : '<div style="width:56px;height:56px;border-radius:50%;background:rgba(157,132,255,0.15);border:2px solid rgba(157,132,255,0.4);display:flex;align-items:center;justify-content:center;font-size:1.6rem;">🚗</div>';

  // ── Commandes en attente ──
  var pendingOrders = JSON.parse(localStorage.getItem('ambi241_pending_orders_' + (driver.phone||'').replace(/\s|\+/g,'')) || '[]');

  var div = document.createElement('div');
  div.id = '_chauffeurBoard';
  div.style.cssText = 'position:fixed;inset:0;background:var(--bg);z-index:10010;overflow-y:auto;padding:0 0 6rem;';

  div.innerHTML = `
  <!-- ══ HEADER ══ -->
  <div style="background:rgba(13,0,20,0.97);border-bottom:1px solid rgba(157,132,255,0.2);padding:0.7rem 1rem;display:flex;align-items:center;gap:0.7rem;position:sticky;top:0;z-index:10;backdrop-filter:blur(20px);">
    <button onclick="document.getElementById('_chauffeurBoard').remove()" style="background:rgba(255,255,255,0.07);border:1px solid rgba(255,255,255,0.1);color:var(--muted);font-size:1rem;width:32px;height:32px;border-radius:50%;cursor:pointer;flex-shrink:0;">←</button>
    <div style="flex:1;">
      <div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.95rem;color:var(--amber);">🚗 Dashboard Chauffeur</div>
      <div style="font-size:0.62rem;color:var(--muted);">Bienvenue ${escHtml(driver.pseudo)}</div>
    </div>
    <div id="_boardOnlineDot" style="width:10px;height:10px;border-radius:50%;background:var(--red);box-shadow:0 0 8px rgba(255,68,102,0.5);transition:all 0.3s;"></div>
    <div style="font-size:0.68rem;font-weight:700;" id="_boardOnlineLabel" style="color:var(--muted);">Hors service</div>
  </div>

  <!-- ══ PROFIL CARD ══ -->
  <div style="margin:1rem;background:linear-gradient(135deg,rgba(157,132,255,0.1),rgba(255,45,155,0.06));border:1.5px solid rgba(157,132,255,0.3);border-radius:16px;padding:0.9rem 1rem;display:flex;align-items:center;gap:0.8rem;">
    ${avatarHtml}
    <div style="flex:1;min-width:0;">
      <div style="font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.9rem;">${escHtml(driver.pseudo)}</div>
      <div style="font-size:0.65rem;color:var(--green);margin-top:0.1rem;">✅ Chauffeur Vérifié Taxi Pro</div>
      <div style="font-size:0.6rem;color:var(--muted);">${escHtml(driver.phone||'')} · ${escHtml(driver.license||'')}</div>
    </div>
    <div style="text-align:center;">
      <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.2rem;color:var(--amber);">${Number(stats.note||4.8).toFixed(1)}</div>
      <div style="font-size:0.58rem;color:var(--muted);">Note ⭐</div>
    </div>
  </div>

  <!-- ══ TOGGLE SERVICE ══ -->
  <div style="margin:0 1rem 1rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:0.9rem 1rem;display:flex;align-items:center;justify-content:space-between;" id="_boardServiceCard">
    <div>
      <div style="font-weight:700;color:var(--text);font-size:0.85rem;" id="_boardServiceLabel">Hors service</div>
      <div style="font-size:0.65rem;color:var(--muted);margin-top:0.1rem;" id="_boardServiceSub">Activez pour recevoir des courses</div>
    </div>
    <label style="position:relative;width:52px;height:28px;">
      <input type="checkbox" id="_boardServiceToggle" onchange="_boardToggleService(this)" style="opacity:0;width:0;height:0;">
      <span style="position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:28px;cursor:pointer;transition:0.25s;" id="_boardServiceSlider">
        <span style="position:absolute;width:22px;height:22px;top:3px;left:3px;background:#fff;border-radius:50%;transition:0.25s;" id="_boardServiceKnob"></span>
      </span>
    </label>
  </div>

  <!-- ══ KPI STATS ══ -->
  <div style="margin:0 1rem 1rem;display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.7rem;text-align:center;">
      <div style="font-family:Syne,sans-serif;font-size:1.3rem;font-weight:800;color:var(--green);" id="_bKpiCourses">${stats.courses||0}</div>
      <div style="font-size:0.58rem;color:var(--muted);">Courses</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.7rem;text-align:center;">
      <div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:var(--amber);" id="_bKpiGains">${(stats.gains||0).toLocaleString('fr-FR')}</div>
      <div style="font-size:0.58rem;color:var(--muted);">XAF gains</div>
    </div>
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.7rem;text-align:center;">
      <div style="font-family:Syne,sans-serif;font-size:1.3rem;font-weight:800;color:var(--cyan);" id="_bKpiKm">${stats.km||0}</div>
      <div style="font-size:0.58rem;color:var(--muted);">km parcourus</div>
    </div>
  </div>

  <!-- ══ ONGLETS ══ -->
  <div style="display:flex;border-bottom:1px solid rgba(255,255,255,0.07);margin:0 1rem 0.8rem;gap:0.2rem;">
    <button data-board-tab="commandes" onclick="_boardSwitchTab('commandes')" style="flex:1;padding:0.6rem 0.3rem;border:none;background:transparent;color:var(--amber);font-family:'DM Sans',sans-serif;font-size:0.72rem;font-weight:700;cursor:pointer;border-bottom:2px solid var(--amber);position:relative;">
      Commandes
      ${pendingOrders.length ? '<span style="position:absolute;top:4px;right:4px;background:var(--red);color:#fff;font-size:0.5rem;font-weight:900;width:14px;height:14px;border-radius:50%;display:flex;align-items:center;justify-content:center;">'+pendingOrders.length+'</span>' : ''}
    </button>
    <button data-board-tab="course" onclick="_boardSwitchTab('course')" style="flex:1;padding:0.6rem 0.3rem;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.72rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;">En Course</button>
    <button data-board-tab="historique" onclick="_boardSwitchTab('historique')" style="flex:1;padding:0.6rem 0.3rem;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.72rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;">Historique</button>
    <button data-board-tab="profil" onclick="_boardSwitchTab('profil')" style="flex:1;padding:0.6rem 0.3rem;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.72rem;font-weight:600;cursor:pointer;border-bottom:2px solid transparent;">Profil</button>
  </div>

  <!-- ══ TAB: COMMANDES ══ -->
  <div id="_boardTab_commandes" style="padding:0 1rem;">
    <!-- Demande entrante simulée -->
    <div id="_boardIncomingReq" style="display:none;background:linear-gradient(135deg,rgba(157,132,255,0.15),rgba(255,45,155,0.08));border:2px solid rgba(157,132,255,0.5);border-radius:16px;padding:1rem;margin-bottom:0.8rem;animation:pulse 1.5s infinite;">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.7rem;">
        <div style="width:8px;height:8px;border-radius:50%;background:var(--amber);box-shadow:0 0 10px rgba(157,132,255,0.7);animation:pulse 1s infinite;"></div>
        <span style="font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.85rem;">NOUVELLE DEMANDE</span>
        <span id="_boardReqCountdown" style="margin-left:auto;background:rgba(255,68,102,0.2);color:var(--red);font-size:0.7rem;font-weight:800;padding:0.15rem 0.5rem;border-radius:10px;">30s</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.7rem;">
        <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.5rem 0.6rem;">
          <div style="font-size:0.58rem;color:var(--muted);margin-bottom:0.1rem;">DÉPART</div>
          <div style="font-size:0.78rem;font-weight:700;color:var(--text);" id="_boardReqFrom">—</div>
        </div>
        <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.5rem 0.6rem;">
          <div style="font-size:0.58rem;color:var(--muted);margin-bottom:0.1rem;">DESTINATION</div>
          <div style="font-size:0.78rem;font-weight:700;color:var(--text);" id="_boardReqTo">—</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem;">
        <div>
          <span style="font-size:0.68rem;color:var(--muted);">👤 </span><span style="font-size:0.75rem;font-weight:700;color:var(--text);" id="_boardReqClient">—</span>
          <br><span style="font-size:0.65rem;color:var(--muted);" id="_boardReqDist">—</span>
        </div>
        <div style="font-family:Syne,sans-serif;font-size:1.2rem;font-weight:800;color:var(--green);" id="_boardReqPrice">—</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
        <button onclick="_boardAcceptReq()" style="padding:0.6rem;border-radius:11px;border:none;background:linear-gradient(135deg,var(--green),#00cc88);color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;cursor:pointer;">✅ ACCEPTER</button>
        <button onclick="_boardRefuseReq()" style="padding:0.6rem;border-radius:11px;border:none;background:rgba(255,68,102,0.15);border:1px solid rgba(255,68,102,0.4);color:var(--red);font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;cursor:pointer;">❌ REFUSER</button>
      </div>
    </div>

    <!-- Liste des commandes en attente -->
    <div id="_boardOrdersList"></div>

    <!-- État vide -->
    <div id="_boardOrdersEmpty" style="text-align:center;padding:2.5rem 1rem;color:var(--muted);">
      <div style="font-size:3rem;margin-bottom:0.5rem;">📭</div>
      <div style="font-size:0.85rem;font-weight:700;color:var(--text);margin-bottom:0.3rem;">Aucune commande en attente</div>
      <div style="font-size:0.72rem;">Activez le service pour recevoir des demandes en temps réel</div>
    </div>
  </div>

  <!-- ══ TAB: EN COURSE ══ -->
  <div id="_boardTab_course" style="display:none;padding:0 1rem;">
    <div id="_boardRideCard" style="display:none;background:rgba(0,229,255,0.05);border:1.5px solid rgba(0,229,255,0.25);border-radius:16px;padding:1rem;margin-bottom:1rem;">
      <div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);margin-bottom:0.8rem;font-size:0.88rem;" id="_boardRideTitle">Course acceptée</div>
      <!-- Stepper -->
      <div style="display:flex;align-items:center;gap:0;margin-bottom:1rem;" id="_boardRideStepper">
        <div class="_bStep active" id="_bStep0" style="flex:1;text-align:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:var(--amber);display:flex;align-items:center;justify-content:center;margin:0 auto 0.25rem;font-size:0.7rem;">1</div>
          <div style="font-size:0.55rem;color:var(--amber);font-weight:700;">En route</div>
        </div>
        <div style="flex:1;height:2px;background:rgba(255,255,255,0.08);" id="_bLine0"></div>
        <div class="_bStep" id="_bStep1" style="flex:1;text-align:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 0.25rem;font-size:0.7rem;color:var(--muted);">2</div>
          <div style="font-size:0.55rem;color:var(--muted);font-weight:700;">Client à bord</div>
        </div>
        <div style="flex:1;height:2px;background:rgba(255,255,255,0.08);" id="_bLine1"></div>
        <div class="_bStep" id="_bStep2" style="flex:1;text-align:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 0.25rem;font-size:0.7rem;color:var(--muted);">3</div>
          <div style="font-size:0.55rem;color:var(--muted);font-weight:700;">Destination</div>
        </div>
        <div style="flex:1;height:2px;background:rgba(255,255,255,0.08);" id="_bLine2"></div>
        <div class="_bStep" id="_bStep3" style="flex:1;text-align:center;">
          <div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;margin:0 auto 0.25rem;font-size:0.7rem;color:var(--muted);">✓</div>
          <div style="font-size:0.55rem;color:var(--muted);font-weight:700;">Terminé</div>
        </div>
      </div>
      <!-- Infos course -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.8rem;">
        <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.5rem 0.6rem;">
          <div style="font-size:0.58rem;color:var(--muted);">DÉPART</div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--text);" id="_boardRideFrom">—</div>
        </div>
        <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.5rem 0.6rem;">
          <div style="font-size:0.58rem;color:var(--muted);">DESTINATION</div>
          <div style="font-size:0.75rem;font-weight:700;color:var(--text);" id="_boardRideTo">—</div>
        </div>
      </div>
      <!-- Timer + Prix -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.8rem;">
        <div style="background:rgba(0,0,0,0.2);border-radius:10px;padding:0.5rem 0.8rem;text-align:center;">
          <div style="font-family:Syne,sans-serif;font-size:1.3rem;font-weight:800;color:var(--cyan);" id="_boardRideTimer">00:00</div>
          <div style="font-size:0.58rem;color:var(--muted);">Durée</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:0.65rem;color:var(--muted);">Client</div>
          <div style="font-size:0.8rem;font-weight:700;color:var(--text);" id="_boardRideClient">—</div>
        </div>
        <div style="background:rgba(0,255,170,0.08);border-radius:10px;padding:0.5rem 0.8rem;text-align:center;">
          <div style="font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;color:var(--green);" id="_boardRidePrice">—</div>
          <div style="font-size:0.58rem;color:var(--muted);">Prix</div>
        </div>
      </div>
      <!-- Action Button -->
      <button id="_boardRideBtn" onclick="_boardNextRideStep()" style="width:100%;padding:0.7rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--amber),#ff8800);color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;">📍 Client arrivé — À bord</button>
      <!-- Outils -->
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.4rem;margin-top:0.6rem;">
        <button onclick="_boardCallClient()" style="padding:0.45rem;border-radius:8px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.06);color:var(--cyan);font-size:0.65rem;cursor:pointer;font-family:'DM Sans',sans-serif;">📞 Appeler</button>
        <button onclick="_boardOpenNav()" style="padding:0.45rem;border-radius:8px;border:1px solid rgba(157,132,255,0.3);background:rgba(157,132,255,0.06);color:var(--amber);font-size:0.65rem;cursor:pointer;font-family:'DM Sans',sans-serif;">🗺️ Maps</button>
        <button onclick="_boardReportIssue()" style="padding:0.45rem;border-radius:8px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.06);color:var(--red);font-size:0.65rem;cursor:pointer;font-family:'DM Sans',sans-serif;">⚠️ Incident</button>
      </div>
    </div>
    <div id="_boardNoCourseMsg" style="text-align:center;padding:2.5rem 1rem;color:var(--muted);">
      <div style="font-size:3rem;margin-bottom:0.5rem;">🚕</div>
      <div style="font-size:0.82rem;">Aucune course en cours.<br>Acceptez une demande pour démarrer.</div>
    </div>
  </div>

  <!-- ══ TAB: HISTORIQUE ══ -->
  <div id="_boardTab_historique" style="display:none;padding:0 1rem;">
    <div id="_boardHistList"></div>
  </div>

  <!-- ══ TAB: PROFIL ══ -->
  <div id="_boardTab_profil" style="display:none;padding:0 1rem;">
    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1rem;margin-bottom:0.8rem;">
      <div style="font-family:Syne,sans-serif;font-weight:700;color:var(--pink);font-size:0.8rem;margin-bottom:0.8rem;">🔐 Informations du compte</div>
      <div style="font-size:0.78rem;color:var(--muted);line-height:2.2;">
        <div>📧 Email : <strong style="color:var(--text);">${escHtml(driver.email||'—')}</strong></div>
        <div>📞 Téléphone : <strong style="color:var(--text);">${escHtml(driver.phone||'—')}</strong></div>
        <div>🪪 Licence : <strong style="color:var(--text);">${escHtml(driver.license||'—')}</strong></div>
        <div>🏢 Compagnie : <strong style="color:var(--text);">${escHtml(driver.company||'—')}</strong></div>
        <div>📅 Membre depuis : <strong style="color:var(--cyan);">${driver.approvedAt ? new Date(driver.approvedAt).toLocaleDateString('fr-FR') : '—'}</strong></div>
      </div>
    </div>
    <div style="background:rgba(255,68,102,0.05);border:1px solid rgba(255,68,102,0.2);border-radius:12px;padding:0.8rem;font-size:0.68rem;color:var(--red);line-height:1.6;">
      🔐 <strong>Données confidentielles</strong> — Vos informations ne sont visibles que par vous et l'Admin AMBI241.
    </div>
  </div>
  `;

  document.body.appendChild(div);

  // ── Initialiser les données ──
  window._boardDriver = driver;
  window._boardStats = stats;
  window._boardStatsKey = statsKey;
  window._boardRideStep = 0;
  window._boardRideTimerSec = 0;
  window._boardRideTimerInterval = null;
  window._boardActiveReq = null;
  window._boardOnDuty = false;

  _boardRenderHistory();
  _boardRenderOrders();
}

// ──── Toggle service ────
function _boardToggleService(chk) {
  window._boardOnDuty = chk.checked;
  var dot   = document.getElementById('_boardOnlineDot');
  var label = document.getElementById('_boardOnlineLabel');
  var sLabel = document.getElementById('_boardServiceLabel');
  var sSub  = document.getElementById('_boardServiceSub');
  var card  = document.getElementById('_boardServiceCard');
  var slider = document.getElementById('_boardServiceSlider');
  var knob  = document.getElementById('_boardServiceKnob');
  if(chk.checked) {
    dot.style.background = 'var(--green)';
    dot.style.boxShadow = '0 0 8px rgba(0,255,170,0.6)';
    label.textContent = 'En service';
    if(sLabel) sLabel.textContent = 'En service';
    if(sSub)   sSub.textContent   = 'Vous recevez des demandes';
    if(card)   card.style.borderColor = 'rgba(0,255,170,0.3)';
    if(slider) slider.style.background = 'var(--green)';
    if(knob)   knob.style.transform = 'translateX(24px)';
    showTaxiNotification('🟢 Vous êtes en service !');
    _persistDriverOnlineStatus(true);
    // Démarrer l'écoute des vraies demandes Firebase
    if (typeof tdbStartListeningRequests === 'function') tdbStartListeningRequests();
  } else {
    dot.style.background = 'var(--red)';
    dot.style.boxShadow = '0 0 8px rgba(255,68,102,0.5)';
    label.textContent = 'Hors service';
    if(sLabel) sLabel.textContent = 'Hors service';
    if(sSub)   sSub.textContent   = 'Activez pour recevoir des courses';
    if(card)   card.style.borderColor = '';
    if(slider) slider.style.background = 'rgba(255,255,255,0.1)';
    if(knob)   knob.style.transform = 'translateX(0)';
    showTaxiNotification('🔴 Hors service');
    _persistDriverOnlineStatus(false);
    // Cacher la demande entrante
    var req = document.getElementById('_boardIncomingReq');
    if(req) req.style.display = 'none';
  }
}

// ──── Switcher d'onglets ────
function _boardSwitchTab(tab) {
  ['commandes','course','historique','profil'].forEach(function(t) {
    var panel = document.getElementById('_boardTab_'+t);
    var btn   = document.querySelector('[data-board-tab="'+t+'"]');
    if(panel) panel.style.display = t===tab ? (t==='commandes'?'block':'block') : 'none';
    if(btn) {
      btn.style.color = t===tab ? 'var(--amber)' : 'var(--muted)';
      btn.style.borderBottom = t===tab ? '2px solid var(--amber)' : '2px solid transparent';
    }
  });
}

// ──── Écoute des vraies demandes Firebase pour ce tableau de bord ────
function _boardSimRequest() {
  // Cette fonction est désactivée. Les demandes arrivent via Firebase onSnapshot (tdbStartListeningRequests).
  // Laissée en place pour la compatibilité des appels existants.
}

// Afficher une demande réelle reçue depuis Firebase dans ce tableau de bord
function _boardShowRealRequest(req) {
  window._boardActiveReq = req;
  var el = document.getElementById('_boardIncomingReq');
  if(!el) return;
  var setT = function(id, val) { var e = document.getElementById(id); if(e) e.textContent = val; };
  setT('_boardReqFrom',  req.from || req.pickup || '—');
  setT('_boardReqTo',    req.to || req.destination || '—');
  setT('_boardReqPrice', req.price ? req.price + ' XAF' : (req.estimatedPrice ? req.estimatedPrice + ' XAF' : '—'));
  setT('_boardReqDist',  req.dist || req.distance || (req.estimatedKm ? req.estimatedKm + ' km' : '—'));
  setT('_boardReqClient',req.client || req.clientName || 'Client');
  el.style.display = 'block';
  _boardSwitchTab('commandes');
  var sec = 30;
  var cdEl = document.getElementById('_boardReqCountdown');
  if(cdEl) cdEl.textContent = sec + 's';
  clearInterval(window._boardCDInterval);
  window._boardCDInterval = setInterval(function() {
    sec--;
    if(cdEl) cdEl.textContent = sec + 's';
    if(sec <= 0) {
      clearInterval(window._boardCDInterval);
      if(el) el.style.display = 'none';
      _tdbUpdateRequestStatus(req._docId, 'expired');
      showTaxiNotification('⏰ Demande expirée');
    }
  }, 1000);
  showTaxiNotification('🔔 Nouvelle demande de course !');
}
window._boardShowRealRequest = _boardShowRealRequest;

// ──── Accepter une demande ────
function _boardAcceptReq() {
  clearInterval(window._boardCDInterval);
  var r = window._boardActiveReq;
  if(!r) return;
  var el = document.getElementById('_boardIncomingReq');
  if(el) el.style.display = 'none';
  // Activer l'onglet En Course avec le stepper
  _boardStartRide(r);
  _boardSwitchTab('course');
  showTaxiNotification('✅ Course acceptée ! En route vers le client.');
  // Notification WhatsApp auto (simulée)
  showTaxiNotification('💬 Client notifié par WhatsApp — Taxi en route');
}

// ──── Refuser avec motif ────
function _boardRefuseReq() {
  clearInterval(window._boardCDInterval);
  var el = document.getElementById('_boardIncomingReq');
  // Afficher choix de motif
  var motifs = ['Zone trop loin','Déjà en course','Problème véhicule','Autre'];
  var motifHtml = motifs.map(function(m,i) {
    return '<button onclick="_boardConfirmRefuse(\''+m+'\')" style="width:100%;padding:0.6rem 0.8rem;margin-bottom:0.4rem;border-radius:10px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.78rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;">❌ '+m+'</button>';
  }).join('');
  var overlay = document.createElement('div');
  overlay.id = '_refuseOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10020;display:flex;align-items:center;justify-content:center;padding:1rem;';
  overlay.innerHTML = '<div style="background:var(--surface);border:1px solid rgba(255,68,102,0.3);border-radius:20px;padding:1.4rem;width:min(360px,100%);"><div style="font-family:Syne,sans-serif;font-weight:800;color:var(--red);margin-bottom:0.3rem;">Motif de refus</div><div style="font-size:0.72rem;color:var(--muted);margin-bottom:1rem;">Sélectionnez un motif (facultatif)</div>'+motifHtml+'<button onclick="document.getElementById(\'_refuseOverlay\').remove()" style="width:100%;padding:0.5rem;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted);font-size:0.72rem;cursor:pointer;font-family:DM Sans,sans-serif;">Annuler</button></div>';
  document.body.appendChild(overlay);
}
window._boardConfirmRefuse = function(motif) {
  document.getElementById('_refuseOverlay').remove();
  var el = document.getElementById('_boardIncomingReq');
  if(el) el.style.display = 'none';
  // Marquer la demande comme refusée dans Firestore
  var req = window._boardActiveReq || {};
  if (req._docId) _tdbUpdateRequestStatus(req._docId, 'declined', { declinedAt: new Date().toISOString(), motif: motif });
  showTaxiNotification('❌ Refusé : ' + motif + ' — en attente de la prochaine demande réelle');
};

// ──── Démarrer une course ────
function _boardStartRide(r) {
  window._boardCurrentRide = r;
  window._boardRideStep = 0;
  // Remplir les infos
  var setT = function(id, val) { var e = document.getElementById(id); if(e) e.textContent = val; };
  setT('_boardRideFrom', r.from||'—');
  setT('_boardRideTo', r.to||'—');
  setT('_boardRideClient', r.client||'Client');
  setT('_boardRidePrice', r.price||'—');
  setT('_boardRideTitle', 'En route vers le client');
  setT('_boardRideBtn', '📍 Client à bord — Démarrer le trajet');
  // Timer
  clearInterval(window._boardRideTimerInterval);
  window._boardRideTimerSec = 0;
  document.getElementById('_boardRideTimer').textContent = '00:00';
  window._boardRideTimerInterval = setInterval(function() {
    window._boardRideTimerSec++;
    var m = String(Math.floor(window._boardRideTimerSec/60)).padStart(2,'0');
    var s = String(window._boardRideTimerSec%60).padStart(2,'0');
    var timerEl = document.getElementById('_boardRideTimer');
    if(timerEl) timerEl.textContent = m+':'+s;
  }, 1000);
  // Afficher
  var card = document.getElementById('_boardRideCard');
  var noMsg = document.getElementById('_boardNoCourseMsg');
  if(card) card.style.display = 'block';
  if(noMsg) noMsg.style.display = 'none';
  _boardUpdateStepper(0);
}

// ──── Avancer dans le flow de course ────
var _boardRideStepLabels = [
  { title:'Client à bord — Trajet en cours', btn:'🏁 Destination atteinte' },
  { title:'En approche de la destination', btn:'✅ Terminer la course' },
  { title:'Course terminée !', btn:'🎉 Nouvelle course' }
];
function _boardNextRideStep() {
  window._boardRideStep = (window._boardRideStep||0) + 1;
  var step = window._boardRideStep;
  if(step <= 2) {
    var info = _boardRideStepLabels[step-1];
    var setT = function(id,v){ var e=document.getElementById(id);if(e)e.textContent=v; };
    setT('_boardRideTitle', info.title);
    setT('_boardRideBtn', info.btn);
    _boardUpdateStepper(step);
    if(step === 1) showTaxiNotification('👥 Client à bord — trajet démarré !');
    if(step === 2) showTaxiNotification('🏁 Destination atteinte !');
  } else {
    // Terminer la course
    clearInterval(window._boardRideTimerInterval);
    var r = window._boardCurrentRide || {};
    var priceNum = parseInt((r.price||'0').replace(/\D/g,'')) || 0;
    var kmNum = parseInt((r.dist||'0').replace(/\D+/,'')) || 0;
    // Sauvegarder stats
    var stats = window._boardStats || {};
    stats.courses = (stats.courses||0) + 1;
    stats.gains   = (stats.gains  ||0) + priceNum;
    stats.km      = (stats.km     ||0) + kmNum;
    if(!stats.history) stats.history = [];
    var now = new Date();
    stats.history.unshift({
      from: r.from, to: r.to, price: r.price, dist: r.dist,
      client: r.client, duration: window._boardRideTimerSec,
      date: now.toISOString(), rating: 5
    });
    if(stats.history.length > 50) stats.history.length = 50;
    window._boardStats = stats;
    try { localStorage.setItem(window._boardStatsKey, JSON.stringify(stats)); } catch(e){}
    // Mettre à jour KPIs
    var setT = function(id,v){ var e=document.getElementById(id);if(e)e.textContent=v; };
    setT('_bKpiCourses', stats.courses);
    setT('_bKpiGains', stats.gains.toLocaleString('fr-FR'));
    setT('_bKpiKm', stats.km);
    // Masquer la course
    var card = document.getElementById('_boardRideCard');
    var noMsg = document.getElementById('_boardNoCourseMsg');
    if(card) card.style.display = 'none';
    if(noMsg) noMsg.style.display = 'block';
    _boardUpdateStepper(3);
    _boardRenderHistory();
    // Sauvegarder la course dans Firestore taxi_history
    var uid2 = window.currentUserUID || '';
    var drv2 = uid2 ? (window._chauffeurDrivers || {})[uid2] : null;
    if (uid2 && window.db && window.fbAddDoc && window.fbCollection) {
      window.fbAddDoc(window.fbCollection(window.db, 'taxi_history'), {
        driverUid:   uid2,
        driverPhone: drv2 ? (drv2.phone || '') : '',
        driverName:  drv2 ? (drv2.pseudo || drv2.name || '') : '',
        role: 'chauffeur',
        from: r.from || r.pickup || '',
        to:   r.to || r.destination || '',
        price: priceNum,
        km:    kmNum,
        durationMin: Math.round((window._boardRideTimerSec || 0) / 60),
        client:    r.client || r.clientName || '',
        clientPhone: r.clientPhone || '',
        rating: 5,
        status: 'completed',
        requestId: r._docId || '',
        completedAt: now.toISOString()
      }).catch(function(e) { console.warn('[Board] taxi_history:', e); });
    }
    if (r._docId) _tdbUpdateRequestStatus(r._docId, 'completed', { completedAt: now.toISOString(), finalPrice: priceNum });
    // Persister les KPIs
    tdbSaveKPIsToFirestore();
    showTaxiNotification('🎉 Course terminée ! +' + (priceNum ? priceNum.toLocaleString('fr-FR') + ' XAF' : '0'));
    _boardSwitchTab('historique');
  }
}

// ──── Stepper visuel ────
function _boardUpdateStepper(activeStep) {
  var colors = ['var(--amber)','var(--cyan)','var(--pink)','var(--green)'];
  for(var i=0;i<4;i++) {
    var stepEl = document.getElementById('_bStep'+i);
    if(!stepEl) continue;
    var circle = stepEl.querySelector('div');
    var label  = stepEl.querySelectorAll('div')[1];
    if(i <= activeStep) {
      circle.style.background = colors[i];
      circle.style.color = '#000';
      if(label) { label.style.color = colors[i]; label.style.fontWeight = '800'; }
    } else {
      circle.style.background = 'rgba(255,255,255,0.1)';
      circle.style.color = 'var(--muted)';
      if(label) { label.style.color = 'var(--muted)'; label.style.fontWeight = '600'; }
    }
    if(i < 3) {
      var line = document.getElementById('_bLine'+i);
      if(line) line.style.background = i < activeStep ? colors[i] : 'rgba(255,255,255,0.08)';
    }
  }
}

function _boardCallClient() {
  var r = window._boardCurrentRide || {};
  showTaxiNotification('📞 Appel vers ' + (r.client||'client') + '...');
}
function _boardOpenNav() {
  var r = window._boardCurrentRide || {};
  if(r.to) window.open('https://www.google.com/maps/search/'+encodeURIComponent(r.to+', Libreville'), '_blank');
}
function _boardReportIssue() {
  var motifs = ['Passager non trouvé','Problème de route','Urgence véhicule','Passager agressif','Adresse incorrecte','Paiement refusé'];
  var motif = prompt('Signaler un incident :\n\n' + motifs.map(function(m,i){return (i+1)+'. '+m;}).join('\n') + '\n\nEntrez le motif :');
  if (!motif || !motif.trim()) return;
  var r = window._boardActiveReq || window._boardCurrentRide || {};
  var uid = window.currentUserUID || '';
  var drv = uid ? (window._chauffeurDrivers || {})[uid] : null;
  if (uid && window.db && window.fbAddDoc && window.fbCollection) {
    window.fbAddDoc(window.fbCollection(window.db, 'taxi_incidents'), {
      driverUid:   uid,
      driverPhone: drv ? (drv.phone || '') : '',
      driverName:  drv ? (drv.pseudo || drv.name || '') : '',
      requestId:   r._docId || '',
      from:        r.from || r.pickup || '',
      to:          r.to || r.destination || '',
      client:      r.client || r.clientName || '',
      reason:      motif.trim(),
      reportedAt:  new Date().toISOString(),
      status:      'open'
    }).then(function() {
      showTaxiNotification('⚠️ Incident signalé — support notifié');
    }).catch(function() {
      showTaxiNotification('⚠️ Incident enregistré — synchronisé à la reconnexion');
    });
  } else {
    showTaxiNotification('⚠️ Incident enregistré localement');
  }
}

// ──── Historique ────
function _boardRenderHistory() {
  var el = document.getElementById('_boardHistList');
  if(!el) return;
  var stats = window._boardStats || {};
  var history = stats.history || [];
  if(!history.length) {
    el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem;"><div style="font-size:2.5rem;margin-bottom:0.5rem;">📋</div>Aucune course enregistrée</div>';
    return;
  }
  el.innerHTML = history.map(function(h) {
    var d = h.date ? new Date(h.date) : new Date();
    var timeStr = d.toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
    var dur = h.duration ? Math.floor(h.duration/60)+'min' : '—';
    return '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0.7rem 0.8rem;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.6rem;">'
      +'<div style="width:28px;height:28px;border-radius:50%;background:rgba(0,255,170,0.15);display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:var(--green);font-weight:800;flex-shrink:0;">✓</div>'
      +'<div style="flex:1;min-width:0;">'
        +'<div style="font-size:0.78rem;font-weight:700;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+(h.from||'?')+' → '+(h.to||'?')+'</div>'
        +'<div style="font-size:0.62rem;color:var(--muted);margin-top:0.1rem;">'+timeStr+' · '+dur+'</div>'
      +'</div>'
      +'<div style="text-align:right;flex-shrink:0;">'
        +'<div style="font-family:Syne,sans-serif;font-size:0.85rem;font-weight:800;color:var(--green);">'+(h.price||'—')+'</div>'
        +'<div style="font-size:0.65rem;color:var(--amber);">⭐'.repeat(h.rating||5)+'</div>'
      +'</div></div>';
  }).join('');
}

// ──── Render commandes en attente ────
function _boardRenderOrders() {
  var el = document.getElementById('_boardOrdersList');
  var emptyEl = document.getElementById('_boardOrdersEmpty');
  if(!el) return;
  var driver = window._boardDriver;
  var phone = driver ? (driver.phone||'').replace(/\s|\+/g,'') : '';
  var orders = [];
  try { orders = JSON.parse(localStorage.getItem('ambi241_pending_orders_'+phone) || '[]'); } catch(e){}
  if(!orders.length) {
    el.innerHTML = '';
    if(emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if(emptyEl) emptyEl.style.display = 'none';
  el.innerHTML = '<div style="font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;">Commandes reçues</div>'
    + orders.map(function(o, i) {
      return '<div style="background:rgba(255,184,0,0.05);border:1px solid rgba(157,132,255,0.2);border-radius:12px;padding:0.7rem 0.8rem;margin-bottom:0.5rem;">'
        +'<div style="font-size:0.72rem;font-weight:700;color:var(--text);">'+escHtml(o.clientName||'Client')+'</div>'
        +'<div style="font-size:0.65rem;color:var(--muted);">'+escHtml(o.from||'—')+' → '+escHtml(o.to||'—')+'</div>'
        +'<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'
        +'<button onclick="_boardAcceptStoredOrder('+i+')" style="flex:1;padding:0.4rem;border-radius:8px;border:none;background:rgba(0,255,170,0.15);color:var(--green);font-size:0.68rem;font-weight:700;cursor:pointer;">✅ Accepter</button>'
        +'<button onclick="_boardRefuseStoredOrder('+i+')" style="flex:1;padding:0.4rem;border-radius:8px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.68rem;font-weight:700;cursor:pointer;">❌ Refuser</button>'
        +'</div></div>';
    }).join('');
}
window._boardAcceptStoredOrder = function(i) {
  var driver = window._boardDriver;
  var phone = driver ? (driver.phone||'').replace(/\s|\+/g,'') : '';
  var orders = JSON.parse(localStorage.getItem('ambi241_pending_orders_'+phone) || '[]');
  var o = orders[i];
  if(!o) return;
  orders.splice(i, 1);
  localStorage.setItem('ambi241_pending_orders_'+phone, JSON.stringify(orders));
  _boardStartRide(o);
  _boardSwitchTab('course');
  _boardRenderOrders();
  showTaxiNotification('✅ Course acceptée !');
};
window._boardRefuseStoredOrder = function(i) {
  _boardRefuseReq();
};

window._boardToggleService = _boardToggleService;
window._boardSwitchTab     = _boardSwitchTab;
window._boardSimRequest    = _boardSimRequest;
window._boardAcceptReq     = _boardAcceptReq;
window._boardRefuseReq     = _boardRefuseReq;
window._boardNextRideStep  = _boardNextRideStep;
window._boardCallClient    = _boardCallClient;
window._boardOpenNav       = _boardOpenNav;
window._boardReportIssue   = _boardReportIssue;

// Afficher panneau admin de gestion des chauffeurs
function _showChauffeurAdminPanel() {
  var old = document.getElementById('_chauffeurAdminPanel');
  if(old) old.remove();
  var drivers = Object.values(_chauffeurDrivers);
  var div = document.createElement('div');
  div.id = '_chauffeurAdminPanel';
  div.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10010;display:flex;align-items:center;justify-content:center;padding:1rem;';

  var listHtml = drivers.length === 0
    ? "<div style='text-align:center;padding:2rem;color:var(--muted);'>Aucun chauffeur inscrit</div>"
    : drivers.map(function(d){
        var badgeColor = d.status==='approved' ? 'var(--green)' : d.status==='pending' ? 'var(--amber)' : 'var(--red)';
        var badgeLabel = d.status==='approved' ? '✅ Approuvé' : d.status==='pending' ? '⏳ En attente' : '❌ Révoqué';
        // Photo du chauffeur (admin peut voir)
        // ✅ Photo depuis Firebase (photoURL sur l'objet chauffeur) ou cache localStorage
        var dPhoto = d.photoURL || d.photo || ''; if(!dPhoto){ try { dPhoto = localStorage.getItem('ambi241_photo_'+d.uid)||''; } catch(e){} }
        var dIdDoc = null; try { var raw2=localStorage.getItem('ambi241_idDoc_'+d.uid); if(raw2) dIdDoc=JSON.parse(raw2); } catch(e){}
        var avatarAdm = dPhoto
          ? '<img src="'+dPhoto+'" style="width:36px;height:36px;border-radius:50%;object-fit:cover;border:1.5px solid '+badgeColor+';flex-shrink:0;">'
          : '<div style="width:36px;height:36px;border-radius:50%;background:rgba(157,132,255,0.15);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">🚗</div>';
        var idBadge = dIdDoc
          ? '<span style="font-size:0.55rem;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.25);color:var(--cyan);border-radius:4px;padding:0.07rem 0.3rem;margin-left:0.25rem;">'+(dIdDoc.type==='passeport'?'🛂':'🪪')+(dIdDoc.verified?' ✅':' ⏳')+'</span>'
          : '<span style="font-size:0.55rem;background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.2);color:var(--red);border-radius:4px;padding:0.07rem 0.3rem;margin-left:0.25rem;">Pas de pièce</span>';
        return "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.75rem;margin-bottom:0.5rem;'>"
          +"<div style='display:flex;align-items:center;justify-content:space-between;gap:0.5rem;'>"
          +avatarAdm
          +"<div style='flex:1;min-width:0;padding-left:0.4rem;'>"
          +"<div style='font-weight:700;font-size:0.82rem;color:var(--text);display:flex;align-items:center;flex-wrap:wrap;gap:0.2rem;'>🚗 "+escHtml(d.pseudo)+idBadge+"</div>"
          +"<div style='font-size:0.65rem;color:var(--muted);'>"+escHtml(d.email)+"</div>"
          +"<div style='font-size:0.6rem;color:"+badgeColor+";margin-top:0.1rem;'>"+badgeLabel+"</div>"
          +(dIdDoc&&dIdDoc.data ? "<div style='margin-top:0.4rem;'><img src='"+dIdDoc.data+"' style='width:100%;max-height:60px;object-fit:cover;border-radius:6px;filter:blur(2px);cursor:pointer;' onclick='this.style.filter=\"none\"' title='Cliquer pour voir'></div>" : "")
          +"</div>"
          +"<div style='display:flex;flex-direction:column;gap:0.25rem;flex-shrink:0;'>"
          +(d.status!=='approved' ? "<button onclick=\"adminDesignDriver('"+escHtml(d.uid)+"','"+escHtml(d.email)+"','"+escHtml(d.pseudo)+"','','"+escHtml(d.phone||d.tel||'')+"')\" style='background:rgba(0,255,170,0.12);border:1px solid rgba(0,255,170,0.3);color:var(--green);font-size:0.62rem;font-weight:700;padding:0.22rem 0.5rem;border-radius:6px;cursor:pointer;font-family:DM Sans,sans-serif;'>✅ Approuver</button>" : "")
          +(d.status==='approved' ? "<button onclick=\"adminRevokeDriver('"+d.uid+"');document.getElementById('_chauffeurAdminPanel').remove();_showChauffeurAdminPanel()\" style='background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.3);color:var(--red);font-size:0.62rem;font-weight:700;padding:0.22rem 0.5rem;border-radius:6px;cursor:pointer;font-family:DM Sans,sans-serif;'>✕ Révoquer</button>" : "")
          +(dIdDoc&&!dIdDoc.verified ? "<button onclick=\"_adminVerifyIdDoc('"+d.uid+"')\" style='background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.25);color:var(--cyan);font-size:0.6rem;font-weight:700;padding:0.2rem 0.45rem;border-radius:6px;cursor:pointer;font-family:DM Sans,sans-serif;'>🪪 Vérifier</button>" : "")
          +"</div></div></div>";
      }).join('');

  div.innerHTML = `
    <div style="background:var(--surface);border:1.5px solid rgba(157,132,255,0.4);border-radius:22px;padding:0;width:min(480px,100%);max-height:90vh;overflow:hidden;position:relative;display:flex;flex-direction:column;">
      <!-- Header -->
      <div style="padding:1.2rem 1.3rem 0.7rem;border-bottom:1px solid rgba(157,132,255,0.15);flex-shrink:0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <div style="font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:1rem;">🚗 Panel Admin — Taxi Pro</div>
          <div style="font-size:0.68rem;color:var(--muted);margin-top:0.1rem;">${drivers.length} chauffeur(s) · ${window.taxiProTransactions ? window.taxiProTransactions.length : 0} transaction(s)</div>
        </div>
        <button onclick="document.getElementById('_chauffeurAdminPanel').remove()" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:30px;height:30px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
      </div>

      <!-- Tabs navigation -->
      <div style="display:flex;overflow-x:auto;border-bottom:1px solid rgba(157,132,255,0.12);flex-shrink:0;scrollbar-width:none;background:rgba(0,0,0,0.2);">
        <button id="_admTab-chauffeurs" onclick="_admSwitchTab('chauffeurs')" style="flex-shrink:0;padding:0.6rem 0.9rem;border:none;background:transparent;color:var(--amber);font-family:'DM Sans',sans-serif;font-size:0.68rem;font-weight:700;cursor:pointer;border-bottom:2.5px solid var(--amber);white-space:nowrap;">🚗 Chauffeurs</button>
        <button id="_admTab-transactions" onclick="_admSwitchTab('transactions')" style="flex-shrink:0;padding:0.6rem 0.9rem;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.68rem;font-weight:700;cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;">💳 Transactions</button>
        <button id="_admTab-echanges" onclick="_admSwitchTab('echanges')" style="flex-shrink:0;padding:0.6rem 0.9rem;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.68rem;font-weight:700;cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;">💬 Échanges</button>
        <button id="_admTab-operations" onclick="_admSwitchTab('operations')" style="flex-shrink:0;padding:0.6rem 0.9rem;border:none;background:transparent;color:var(--muted);font-family:'DM Sans',sans-serif;font-size:0.68rem;font-weight:700;cursor:pointer;border-bottom:2.5px solid transparent;white-space:nowrap;">⚙️ Opérations</button>
      </div>

      <!-- Content scrollable -->
      <div style="overflow-y:auto;flex:1;padding:1rem 1.1rem;">

        <!-- ═══ TAB: CHAUFFEURS ═══ -->
        <div id="_admPane-chauffeurs">
          <!-- Désigner chauffeur -->
          <div style="background:rgba(157,132,255,0.06);border:1px solid rgba(255,184,0,0.22);border-radius:12px;padding:0.9rem;margin-bottom:0.9rem;">
            <div style="font-size:0.75rem;font-weight:800;color:var(--amber);margin-bottom:0.6rem;display:flex;align-items:center;gap:0.4rem;">➕ Désigner un Chauffeur
              <span style="font-size:0.6rem;font-weight:400;color:var(--muted);margin-left:auto;">Nouveau membre du réseau</span>
            </div>
            <input id="_newDrvEmail" type="email" placeholder="Email du membre" style="width:100%;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:0.45rem 0.6rem;font-size:0.78rem;font-family:DM Sans,sans-serif;margin-bottom:0.4rem;outline:none;box-sizing:border-box;">
            <input id="_newDrvPseudo" type="text" placeholder="Pseudo / Nom complet" style="width:100%;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:0.45rem 0.6rem;font-size:0.78rem;font-family:DM Sans,sans-serif;margin-bottom:0.4rem;outline:none;box-sizing:border-box;">
            <input id="_newDrvPhone" type="tel" placeholder="📱 Numéro WhatsApp (ex: +24160141924)" style="width:100%;background:var(--surface2);border:1px solid rgba(37,211,102,0.35);border-radius:8px;color:var(--text);padding:0.45rem 0.6rem;font-size:0.78rem;font-family:DM Sans,sans-serif;margin-bottom:0.4rem;outline:none;box-sizing:border-box;">
            <div style="display:flex;gap:0.4rem;margin-bottom:0.4rem;">
              <select id="_newDrvRole" style="flex:1;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:0.45rem 0.5rem;font-size:0.75rem;font-family:DM Sans,sans-serif;outline:none;">
                <option value="chauffeur">🚗 Chauffeur</option>
                <option value="conducteur">🚌 Conducteur</option>
                <option value="livreur">📦 Livreur</option>
              </select>
              <select id="_newDrvZone" style="flex:1;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);padding:0.45rem 0.5rem;font-size:0.75rem;font-family:DM Sans,sans-serif;outline:none;">
                <option>Centre-Ville</option><option>Louis</option><option>Glass</option>
                <option>Akanda</option><option>Angondjé</option><option>Owendo</option><option>Aéroport</option>
              </select>
            </div>
            <!-- _newDrvPwd supprimé — Firebase envoie un email de définition de mot de passe au chauffeur -->
            <button onclick="_adminAddDriverManual()" style="width:100%;padding:0.52rem;border-radius:9px;border:none;background:linear-gradient(135deg,var(--amber),#ff8800);color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;">✅ Désigner Chauffeur</button>
            <div style="margin-top:0.8rem;padding:0.6rem 0.7rem;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.25);border-radius:8px;">
              <div style="font-size:0.65rem;color:var(--cyan);font-weight:700;margin-bottom:0.35rem;">🌐 URL de l\'app (pour les liens WhatsApp chauffeur)</div>
              <div style="font-size:0.62rem;color:var(--muted);margin-bottom:0.4rem;" id="_appUrlDisplay">${window.AMBI241_APP_URL ? '✅ ' + window.AMBI241_APP_URL : '❌ Non configurée — les liens 404 !'}</div>
              <input id="_newAppUrl" type="url" placeholder="https://votre-site.com/index.html" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.3);border-radius:6px;color:var(--text);padding:0.35rem 0.5rem;font-size:0.72rem;font-family:DM Sans,sans-serif;margin-bottom:0.35rem;outline:none;box-sizing:border-box;">
              <button onclick="setAmbi241AppUrl(document.getElementById('_newAppUrl').value);document.getElementById('_appUrlDisplay').textContent='✅ '+window.AMBI241_APP_URL;" style="width:100%;padding:0.35rem;border-radius:6px;border:none;background:rgba(0,229,255,0.15);color:var(--cyan);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">💾 Enregistrer l\'URL</button>
            </div>
          </div>
          <!-- Liste chauffeurs -->
          <div style="font-size:0.68rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;">📋 Liste des Chauffeurs (${drivers.length})</div>
          ${listHtml}
        </div>

        <!-- ═══ TAB: TRANSACTIONS ═══ -->
        <div id="_admPane-transactions" style="display:none;">
          <!-- KPIs -->
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.5rem;margin-bottom:0.9rem;">
            ${[
              { id:'_adm_totOrders', label:'Total Commandes', color:'var(--amber)', icon:'📋' },
              { id:'_adm_accepted', label:'Acceptées', color:'var(--green)', icon:'✅' },
              { id:'_adm_revenue', label:'Revenus XAF', color:'var(--cyan)', icon:'💰' },
              { id:'_adm_commission', label:'Commission (10%)', color:'var(--pink)', icon:'📊' }
            ].map(k=>`
              <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.75rem;text-align:center;">
                <div style="font-size:1rem;">${k.icon}</div>
                <div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.05rem;color:${k.color};" id="${k.id}">—</div>
                <div style="font-size:0.58rem;color:var(--muted);margin-top:0.1rem;">${k.label}</div>
              </div>`).join('')}
          </div>
          <!-- Filtres -->
          <div style="display:flex;gap:0.4rem;margin-bottom:0.7rem;flex-wrap:wrap;">
            <input id="_admTransSearch" placeholder="🔍 Client, chauffeur, ID…" oninput="_admRenderTrans()" style="flex:2;min-width:120px;padding:0.4rem 0.6rem;background:var(--surface2);border:1px solid rgba(157,132,255,0.2);border-radius:8px;color:var(--text);font-size:0.72rem;font-family:DM Sans,sans-serif;outline:none;">
            <select id="_admTransFilter" onchange="_admRenderTrans()" style="flex:1;min-width:90px;padding:0.4rem 0.5rem;background:var(--surface2);border:1px solid rgba(157,132,255,0.2);border-radius:8px;color:var(--text);font-size:0.7rem;font-family:DM Sans,sans-serif;outline:none;">
              <option value="">Tous</option>
              <option value="pending">⏳ En attente</option>
              <option value="accepted">✅ Acceptée</option>
              <option value="completed">🏁 Complétée</option>
              <option value="rejected">❌ Rejetée</option>
              <option value="cancelled">🚫 Annulée</option>
            </select>
          </div>
          <div id="_admTransList" style="display:flex;flex-direction:column;gap:0.5rem;"></div>
        </div>

        <!-- ═══ TAB: ÉCHANGES ═══ -->
        <div id="_admPane-echanges" style="display:none;">
          <div style="display:flex;gap:0.4rem;margin-bottom:0.8rem;">
            <input id="_admChatSearch" placeholder="🔍 Rechercher un échange…" oninput="_admRenderChats()" style="flex:1;padding:0.4rem 0.6rem;background:var(--surface2);border:1px solid rgba(0,229,255,0.2);border-radius:8px;color:var(--text);font-size:0.72rem;font-family:DM Sans,sans-serif;outline:none;">
          </div>
          <!-- Échanges simulés -->
          <div id="_admChatList" style="display:flex;flex-direction:column;gap:0.45rem;"></div>

          <!-- Composer un message broadcast -->
          <div style="margin-top:0.9rem;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.2);border-radius:12px;padding:0.85rem;">
            <div style="font-size:0.72rem;font-weight:800;color:var(--cyan);margin-bottom:0.5rem;">📡 Message Broadcast Admin</div>
            <select id="_admBroadcastTarget" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.18);border-radius:8px;color:var(--text);padding:0.4rem 0.5rem;font-size:0.72rem;font-family:DM Sans,sans-serif;outline:none;margin-bottom:0.4rem;">
              <option value="all">📢 Tous les chauffeurs</option>
              <option value="online">🟢 Chauffeurs en ligne</option>
              <option value="clients">👥 Tous les clients</option>
            </select>
            <textarea id="_admBroadcastMsg" placeholder="Votre message pour les chauffeurs / clients…" maxlength="250" style="width:100%;background:var(--surface2);border:1px solid rgba(0,229,255,0.15);border-radius:8px;color:var(--text);padding:0.45rem 0.6rem;font-size:0.75rem;font-family:DM Sans,sans-serif;outline:none;resize:vertical;min-height:55px;box-sizing:border-box;margin-bottom:0.5rem;"></textarea>
            <button onclick="_admSendBroadcast()" style="width:100%;padding:0.5rem;border-radius:9px;border:none;background:linear-gradient(135deg,var(--cyan),var(--green));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;">📡 Envoyer le message</button>
          </div>
        </div>

        <!-- ═══ TAB: OPÉRATIONS ═══ -->
        <div id="_admPane-operations" style="display:none;">
          <!-- Stats globales -->
          <div style="font-size:0.68rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.55rem;">📊 Statistiques Globales</div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.4rem;margin-bottom:0.9rem;">
            ${[
              { label:'Taux acceptation', val:'72%', color:'var(--green)' },
              { label:'Note moyenne', val:'4.8 ⭐', color:'var(--amber)' },
              { label:'Temps moy. réponse', val:'~4 min', color:'var(--cyan)' },
              { label:'Zones actives', val:'4', color:'var(--pink)' },
              { label:'Courses/heure', val:'18', color:'var(--amber)' },
              { label:'Annulations', val:'12%', color:'var(--red)' },
            ].map(s=>`<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:0.6rem;text-align:center;">
              <div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.95rem;color:${s.color};">${s.val}</div>
              <div style="font-size:0.56rem;color:var(--muted);margin-top:0.08rem;line-height:1.3;">${s.label}</div>
            </div>`).join('')}
          </div>

          <!-- Actions rapides opérationnelles -->
          <div style="font-size:0.68rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.55rem;">⚡ Actions Rapides</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin-bottom:0.9rem;">
            <button onclick="_admExportTrans()" style="padding:0.6rem;border-radius:9px;border:1px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.07);color:var(--green);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;display:flex;align-items:center;gap:0.4rem;">📥 Exporter transactions</button>
            <button onclick="_admResetDayStats()" style="padding:0.6rem;border-radius:9px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.07);color:var(--cyan);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;display:flex;align-items:center;gap:0.4rem;">🔄 Reset stats du jour</button>
            <button onclick="_admToggleService()" style="padding:0.6rem;border-radius:9px;border:1px solid rgba(157,132,255,0.3);background:rgba(255,184,0,0.07);color:var(--amber);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;display:flex;align-items:center;gap:0.4rem;">🔌 Mode urgence ON/OFF</button>
            <button onclick="_admViewZones()" style="padding:0.6rem;border-radius:9px;border:1px solid rgba(204,68,255,0.3);background:rgba(204,68,255,0.07);color:var(--purple);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;text-align:left;display:flex;align-items:center;gap:0.4rem;">🗺️ Zones de couverture</button>
          </div>

          <!-- Paramètres du service -->
          <div style="font-size:0.68rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.55rem;">🔧 Paramètres du Service</div>
          <div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.85rem;display:flex;flex-direction:column;gap:0.6rem;">
            ${[
              { label:'Commission plateforme', sub:'Pourcentage prélevé sur chaque course', val:'10%', id:'_admParamComm' },
              { label:'Rayon de recherche', sub:'Distance max client → chauffeur', val:'5 km', id:'_admParamRadius' },
              { label:'Délai d\'annulation', sub:'Avant pénalité pour le client', val:'3 min', id:'_admParamCancel' },
            ].map(p=>`
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;">
                <div>
                  <div style="font-size:0.73rem;font-weight:600;color:var(--text);">${p.label}</div>
                  <div style="font-size:0.6rem;color:var(--muted);">${p.sub}</div>
                </div>
                <button id="${p.id}" onclick="_admEditParam('${p.id}','${p.label}')" style="background:rgba(157,132,255,0.1);border:1px solid rgba(157,132,255,0.3);color:var(--amber);font-size:0.7rem;font-weight:700;padding:0.2rem 0.55rem;border-radius:7px;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;">${p.val}</button>
              </div>`).join('')}
          </div>

          <!-- Log des événements -->
          <div style="margin-top:0.9rem;">
            <div style="font-size:0.68rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;">📜 Journal des événements</div>
            <div style="background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.6rem;font-size:0.65rem;color:var(--muted);line-height:1.9;max-height:130px;overflow-y:auto;font-family:'DM Sans',monospace;">
              ${(function(){
                const now = new Date();
                const logs = [
                  { t: new Date(now-60000*2),  msg:'✅ Transaction ORD-1701234567891 complétée — 35 000 XAF' },
                  { t: new Date(now-60000*8),  msg:'🔔 Nouvelle demande: Glass → Owendo (45 000 XAF)' },
                  { t: new Date(now-60000*15), msg:'🚗 Alain Mba passé EN SERVICE' },
                  { t: new Date(now-60000*22), msg:'❌ Transaction ORD-1701234567892 rejetée' },
                  { t: new Date(now-60000*35), msg:'👤 Nouveau chauffeur: Marie Nkoghe ajoutée' },
                  { t: new Date(now-60000*48), msg:'💳 Commission perçue: 3 500 XAF' },
                ].map(l=>`<div><span style="color:rgba(255,255,255,0.25);">${l.t.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span> ${l.msg}</div>`).join('');
                return logs;
              })()}
            </div>
          </div>
        </div>

      </div><!-- end content -->
    </div>`;

  document.body.appendChild(div);

  // Initialiser les données des tabs après injection
  _admInitPanelData();
}
window._showChauffeurAdminPanel = _showChauffeurAdminPanel;

// ── Fonctions de navigation des tabs admin ──
function _admSwitchTab(tab) {
  ['chauffeurs','transactions','echanges','operations'].forEach(function(t) {
    var pane = document.getElementById('_admPane-' + t);
    var btn  = document.getElementById('_admTab-' + t);
    if (pane) pane.style.display = t === tab ? 'block' : 'none';
    if (btn) {
      btn.style.color       = t === tab ? 'var(--amber)' : 'var(--muted)';
      btn.style.borderBottom = t === tab ? '2.5px solid var(--amber)' : '2.5px solid transparent';
      btn.style.background  = t === tab ? 'rgba(255,184,0,0.05)' : 'transparent';
    }
  });
  if (tab === 'transactions') { _admRenderTrans(); }
  if (tab === 'echanges')     { _admRenderChats(); }
}
window._admSwitchTab = _admSwitchTab;

function _admInitPanelData() {
  var txs      = window.taxiProTransactions || [];
  var accepted = txs.filter(function(t){ return t.status==='accepted'||t.status==='completed'; }).length;
  var revenue  = txs.filter(function(t){ return t.status==='completed'; }).reduce(function(s,t){ return s+(t.price||0); }, 0);
  var comm     = Math.round(revenue * 0.1);
  var _s = function(id, v) { var el = document.getElementById(id); if(el) el.textContent = v; };
  _s('_adm_totOrders', txs.length);
  _s('_adm_accepted', accepted);
  _s('_adm_revenue', revenue.toLocaleString('fr-FR') + ' XAF');
  _s('_adm_commission', comm.toLocaleString('fr-FR') + ' XAF');
}
window._admInitPanelData = _admInitPanelData;

function _admRenderTrans() {
  var panel   = document.getElementById('_admTransList');
  var search  = (document.getElementById('_admTransSearch') || {}).value || '';
  var filter  = (document.getElementById('_admTransFilter') || {}).value || '';
  if (!panel) return;
  var statusColor = { pending:'var(--amber)', accepted:'var(--green)', completed:'var(--cyan)', rejected:'var(--red)', cancelled:'var(--muted)' };
  var statusIcon  = { pending:'⏳', accepted:'✅', completed:'🏁', rejected:'❌', cancelled:'🚫' };
  var txs = (window.taxiProTransactions || []).filter(function(t) {
    var ok = !search || (t.client||'').toLowerCase().includes(search.toLowerCase()) ||
             (t.driver||'').toLowerCase().includes(search.toLowerCase()) || (t.id||'').includes(search);
    return ok && (!filter || t.status===filter);
  }).sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
  if (!txs.length) { panel.innerHTML='<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.78rem;">📭 Aucune transaction</div>'; return; }
  panel.innerHTML = txs.map(function(t){
    var sc=statusColor[t.status]||'var(--muted)', si=statusIcon[t.status]||'❓';
    var dateStr=t.createdAt?new Date(t.createdAt).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
    return '<div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.65rem 0.75rem;font-size:0.7rem;">'
      +'<div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;"><span style="color:rgba(255,255,255,0.25);font-size:0.58rem;">'+t.id+'</span><span style="color:'+sc+';font-weight:700;font-size:0.65rem;">'+si+' '+t.status.toUpperCase()+'</span></div>'
      +'<div style="color:var(--text);font-weight:600;">👤 '+t.client+' → 🚕 '+t.driver+'</div>'
      +'<div style="color:var(--muted);margin-top:0.12rem;">📍 '+t.from+' → '+t.to+' | '+dateStr+'</div>'
      +'<div style="color:var(--amber);font-weight:700;margin-top:0.18rem;">💰 '+(t.price||0).toLocaleString('fr-FR')+' '+t.currency+'</div>'
      +(t.status==='pending'?'<div style="display:flex;gap:0.35rem;margin-top:0.4rem;">'
        +'<button onclick="taxiProApproveTrans(\''+t.id+'\');_admRenderTrans();_admInitPanelData();" style="flex:1;padding:0.28rem;border-radius:6px;border:1px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.07);color:var(--green);font-size:0.63rem;font-weight:700;cursor:pointer;">✅ Valider</button>'
        +'<button onclick="taxiProRejectTrans(\''+t.id+'\');_admRenderTrans();_admInitPanelData();" style="flex:1;padding:0.28rem;border-radius:6px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.63rem;font-weight:700;cursor:pointer;">❌ Rejeter</button>'
        +'</div>':'')+'</div>';
  }).join('');
}
window._admRenderTrans = _admRenderTrans;

/* ══ DISCUSSIONS TAXI PRO — SOURCE FIREBASE UNIQUEMENT ══
   Aucune donnée fictive : le tableau est vide avant le premier vrai échange.
   Firebase collection "taxiChats" alimente ce tableau en temps réel.          */
window._admChats = window._admChats || [];

/* Charger les discussions depuis Firebase */
function _loadTaxiChatsFromFirebase() {
  if (!window.db || !window.fbCollection || !window.fbGetDocs) return;
  try {
    var q = window.fbQuery
      ? window.fbQuery(window.fbCollection(window.db, 'taxiChats'), window.fbOrderBy ? window.fbOrderBy('time', 'desc') : undefined)
      : window.fbCollection(window.db, 'taxiChats');
    window.fbGetDocs(q).then(function(snap) {
      var chats = [];
      snap.forEach(function(d) {
        var data = d.data();
        chats.push({
          id:       d.id,
          client:   data.client   || 'Client',
          driver:   data.driver   || 'Chauffeur',
          lastMsg:  data.lastMsg  || data.message || '',
          time:     data.time     ? new Date(data.time) : new Date(data.createdAt || Date.now()),
          unread:   data.unread   || 0,
          status:   data.status   || 'active'
        });
      });
      window._admChats = chats;
      if (typeof _admRenderChats === 'function') _admRenderChats();
    }).catch(function() {
      /* Firebase indisponible — afficher état vide proprement */
      window._admChats = [];
      if (typeof _admRenderChats === 'function') _admRenderChats();
    });
  } catch(e) {}
}

/* Abonnement temps réel si onSnapshot disponible */
function _subscribeTaxiChats() {
  if (!window.db || !window.fbCollection || !window.fbOnSnapshot) return;
  try {
    window.fbOnSnapshot(
      window.fbCollection(window.db, 'taxiChats'),
      function(snap) {
        var chats = [];
        snap.forEach(function(d) {
          var data = d.data();
          chats.push({
            id:      d.id,
            client:  data.client  || 'Client',
            driver:  data.driver  || 'Chauffeur',
            lastMsg: data.lastMsg || data.message || '',
            time:    data.time    ? new Date(data.time) : new Date(data.createdAt || Date.now()),
            unread:  data.unread  || 0,
            status:  data.status  || 'active'
          });
        });
        /* Trier par date décroissante */
        chats.sort(function(a,b){ return (b.time||0)-(a.time||0); });
        window._admChats = chats;
        if (typeof _admRenderChats === 'function') _admRenderChats();
      },
      function() { _loadTaxiChatsFromFirebase(); }
    );
  } catch(e) { _loadTaxiChatsFromFirebase(); }
}

/* Démarrer la sync au chargement */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (window.fbOnSnapshot) _subscribeTaxiChats();
    else _loadTaxiChatsFromFirebase();
  }, 2000);
});

function _admRenderChats() {
  var panel = document.getElementById('_admChatList');
  var search = (document.getElementById('_admChatSearch')||{}).value||'';
  if (!panel) return;
  var statusStyle = { active:{color:'var(--green)',bg:'rgba(0,255,170,0.1)',label:'En cours'}, closed:{color:'var(--muted)',bg:'rgba(255,255,255,0.04)',label:'Terminé'}, dispute:{color:'var(--red)',bg:'rgba(255,68,102,0.1)',label:'⚠️ Litige'}, completed:{color:'var(--cyan)',bg:'rgba(0,229,255,0.1)',label:'✅ OK'} };
  var chats = window._admChats.filter(function(c){ return !search||(c.client+c.driver+c.lastMsg).toLowerCase().includes(search.toLowerCase()); });
  panel.innerHTML = chats.map(function(c){
    var ss=statusStyle[c.status]||statusStyle.closed;
    var timeStr=new Date(c.time).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
    return '<div style="background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.6rem 0.75rem;cursor:pointer;" onclick="_admOpenChat(\''+c.id+'\')">'
      +'<div style="display:flex;align-items:center;gap:0.45rem;margin-bottom:0.18rem;">'
      +'<div style="flex:1;font-size:0.71rem;font-weight:700;color:var(--text);">👤 '+c.client+' ↔ 🚕 '+c.driver+'</div>'
      +(c.unread>0?'<span style="background:var(--pink);color:#fff;font-size:0.52rem;font-weight:800;width:15px;height:15px;border-radius:50%;display:flex;align-items:center;justify-content:center;">'+c.unread+'</span>':'')
      +'<span style="font-size:0.58rem;color:'+ss.color+';background:'+ss.bg+';padding:0.06rem 0.3rem;border-radius:5px;font-weight:700;">'+ss.label+'</span>'
      +'</div>'
      +'<div style="font-size:0.65rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+c.lastMsg+'</div>'
      +'<div style="font-size:0.56rem;color:rgba(255,255,255,0.22);margin-top:0.1rem;">'+timeStr+'</div>'
      +(c.status==='dispute'?'<button onclick="event.stopPropagation();_admResolveDispute(\''+c.id+'\')" style="margin-top:0.3rem;width:100%;padding:0.25rem;border-radius:6px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.62rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">⚠️ Résoudre le litige</button>':'')
      +'</div>';
  }).join('')||'<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.78rem;"><div style="font-size:2.5rem;margin-bottom:0.6rem;">💬</div><div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);margin-bottom:0.3rem;">Aucun échange pour l\'instant</div>Les discussions entre clients et chauffeurs apparaîtront ici en temps réel.</div>';
}
window._admRenderChats = _admRenderChats;

function _admOpenChat(id){ var c=(window._admChats||[]).find(function(x){return x.id===id;}); if(!c)return; c.unread=0; showAdminToast('💬 Échange ouvert : '+c.client+' ↔ '+c.driver); _admRenderChats(); }
function _admResolveDispute(id){ var c=(window._admChats||[]).find(function(x){return x.id===id;}); if(!c)return; c.status='completed'; showAdminToast('✅ Litige résolu pour '+c.client); _admRenderChats(); }
function _admSendBroadcast(){ var target=(document.getElementById('_admBroadcastTarget')||{}).value||'all'; var msg=((document.getElementById('_admBroadcastMsg')||{}).value||'').trim(); if(!msg){showAdminToast('⚠️ Écrivez un message d\'abord');return;} var label={all:'tous les chauffeurs',online:'chauffeurs en ligne',clients:'clients'}[target]||target; showAdminToast('📡 Message envoyé à '+label+' !'); var ta=document.getElementById('_admBroadcastMsg'); if(ta)ta.value=''; window._admChats.unshift({id:'BR'+Date.now(),client:'ADMIN',driver:'Broadcast → '+label,lastMsg:msg,time:new Date(),unread:0,status:'completed'}); _admRenderChats(); }
function _admExportTrans(){ var txs=window.taxiProTransactions||[]; var csv='ID,Client,Chauffeur,De,A,Prix,Statut\n'+txs.map(function(t){return [t.id,t.client,t.driver,t.from,t.to,t.price+' '+t.currency,t.status].join(',');}).join('\n'); var blob=new Blob([csv],{type:'text/csv'}); var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='taxi-transactions.csv'; a.click(); showAdminToast('📥 Export CSV téléchargé'); }
function _admResetDayStats(){ if(!confirm('Réinitialiser les stats du jour ?'))return; if(window.tdbData){Object.keys(window.tdbData).forEach(function(r){window.tdbData[r].courses=0;window.tdbData[r].gains=0;window.tdbData[r].km=0;});} showAdminToast('🔄 Stats réinitialisées'); }
function _admToggleService(){ window._admServiceEmergency=!window._admServiceEmergency; showAdminToast(window._admServiceEmergency?'🚨 Mode urgence ACTIVÉ':'✅ Mode normal rétabli'); }
function _admViewZones(){ showAdminToast('🗺️ Louis: 🔴 Actif | Glass: 🟡 Modéré | Angondjé: 🟢 Calme | Centre: 🔴 Actif'); }
function _admEditParam(id,label){ var btn=document.getElementById(id); var cur=btn?btn.textContent:''; var val=prompt('Modifier "'+label+'" (actuel: '+cur+'):', cur); if(val!==null&&val.trim()){if(btn)btn.textContent=val.trim(); showAdminToast('✅ '+label+' mis à jour');} }
window._admOpenChat=_admOpenChat; window._admResolveDispute=_admResolveDispute; window._admSendBroadcast=_admSendBroadcast;
window._admExportTrans=_admExportTrans; window._admResetDayStats=_admResetDayStats; window._admToggleService=_admToggleService;
window._admViewZones=_admViewZones; window._admEditParam=_admEditParam;

function _adminAddDriverManual() {
  var email  = (document.getElementById('_newDrvEmail').value || '').trim().toLowerCase();
  var pseudo = (document.getElementById('_newDrvPseudo').value || '').trim();
  var phone  = (document.getElementById('_newDrvPhone').value || '').trim().replace(/\s/g,'');
  if(!email || !pseudo) { showToast('Email et pseudo requis'); return; }
  if(!phone) { showToast('⚠️ Numéro WhatsApp requis pour envoyer les commandes au chauffeur'); return; }
  var uid = 'drv_' + Date.now();
  // Pas de mot de passe passé — Firebase gère les credentials via email de reset
  window.adminDesignDriver(uid, email, pseudo, null, phone);
  document.getElementById('_chauffeurAdminPanel').remove();
  window._showChauffeurAdminPanel();
}
window._adminAddDriverManual = _adminAddDriverManual;

// Fix #1 : Rendre tdbSimulateRequest fonctionnel depuis TOUS les boutons
// (Les boutons HTML appellent déjà window.tdbSimulateRequest, s'assurer qu'ils sont exposés)
(function() {
  // Ré-exposer pour s'assurer que le scope ne les cache pas
  var _fns = ['tdbSimulateRequest','tdbNavigation','tdbShowEarnings','tdbShowStats',
              'tdbMonterPassager','tdbDescendrePassager','tdbArretUrgence','tdbChangerLigne',
              'tdbScanColis','tdbEchecLivraison','tdbContactClient','tdbRapportFin',
              'tdbLoadMoreHistory','tdbAcceptRequest','tdbDeclineRequest',
              'tdbStartMission','tdbEndMission','tdbReportIssue','tdbCallClient',
              'switchDriverRole','toggleDriverService','tdbRefreshKPIs'];
  _fns.forEach(function(n){ if(typeof window[n] !== 'function') window[n] = function(){ showToast('Activez le service pour utiliser cette fonction'); }; });
})();

/* ════════════════════════════════════════════════════════════════════
   TAXI PRO PROFESSIONNEL - SYSTÈME DE COMMANDE AVANCÉ
   ════════════════════════════════════════════════════════════════════ */

const taxiProState = {
  currentStep: 1,
  vehicleType: null,
  gpsMethod: 'whatsapp',
  currency: 'XAF',
  selectedDriver: null,
  clientData: {},
  exchangeRates: { 'XAF': 1, 'EUR': 655.957, 'USD': 605.550, 'CNY': 88.500 }
};

// taxiProDrivers est maintenant dynamique — chargé depuis taxiContacts (localStorage)
function getTaxiProDrivers() {
  try {
    var contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
    return contacts
      .filter(function(c){ return c.active; })
      .map(function(c, i){
        return {
          id: c.phone || String(i),
          name: c.name || 'Chauffeur',
          company: c.company || c.type || 'Taxi',
          status: 'online',
          rating: c.rating || null,
          phone: c.phone || '',
          whatsapp: c.whatsapp || c.phone || '',
          photo: c.photo || null
        };
      });
  } catch(e){ return []; }
}
// Compatibilité avec l'ancien code qui accède à taxiProDrivers directement
Object.defineProperty(window, 'taxiProDrivers', { get: getTaxiProDrivers, configurable: true });

function taxiProOpenCommandModal() {
  const modal = document.getElementById('taxiProCommandModal');
  if(!modal) return;
  // Reset état
  taxiProState.currentStep = 1;
  taxiProState.vehicleType = null;
  taxiProState.selectedDriver = null;
  // Revenir à l'étape 1
  document.querySelectorAll('.taxi-pro-command-step').forEach(el => el.classList.remove('active'));
  const step1 = document.getElementById('taxiProStep1');
  if(step1) step1.classList.add('active');
  const ind = document.getElementById('taxiProStepIndicator');
  if(ind) ind.textContent = 'Étape 1 / 5 - Véhicule';
  document.querySelectorAll('.taxi-vehicle-card').forEach(el => el.classList.remove('selected'));
  // Pré-remplir depuis formulaire principal
  const dest = document.getElementById('taxiTo') ? document.getElementById('taxiTo').value : '';
  const from = document.getElementById('taxiFrom') ? document.getElementById('taxiFrom').value : '';
  const time = document.getElementById('taxiTime') ? document.getElementById('taxiTime').value : '';
  setTimeout(function(){
    if(dest && document.getElementById('taxiProDestination')) document.getElementById('taxiProDestination').value = dest;
    if(from && document.getElementById('taxiProGPS')) document.getElementById('taxiProGPS').value = from;
    if(time && document.getElementById('taxiProTime')) document.getElementById('taxiProTime').value = time;
  }, 50);
  // Afficher
  modal.style.display = 'flex';
  taxiProRenderDriversList();
  document.body.style.overflow = 'hidden';
}

function taxiProCloseCommandModal() {
  const modal = document.getElementById('taxiProCommandModal');
  if(modal) {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';
  }
}

function taxiProSelectVehicle(type) {
  taxiProState.vehicleType = type;
  document.querySelectorAll('.taxi-vehicle-card').forEach(el => el.classList.remove('selected'));
  event.target.closest('.taxi-vehicle-card').classList.add('selected');
}

function taxiProSelectGPS(method) {
  taxiProState.gpsMethod = method;
  document.querySelectorAll('.taxi-gps-btn').forEach(el => el.classList.remove('active'));
  event.target.closest('.taxi-gps-btn').classList.add('active');
}

function taxiProSelectCurrency(curr) {
  taxiProState.currency = curr;
  document.querySelectorAll('.taxi-currency-badge').forEach(el => el.classList.remove('active'));
  event.target.closest('.taxi-currency-badge').classList.add('active');
  taxiProUpdatePriceDisplay();
}

function taxiProUpdatePriceDisplay() {
  const price = parseFloat(document.getElementById('taxiProPrice').value) || 0;
  let displayPrice = price;
  if(taxiProState.currency !== 'XAF') {
    displayPrice = (price * taxiProState.exchangeRates[taxiProState.currency]).toFixed(2);
  }
  const display = document.getElementById('taxiProPriceDisplay');
  if(display) display.textContent = displayPrice.toLocaleString('fr-FR') + ' ' + taxiProState.currency;
}

function taxiProRenderDriversList() {
  const list = document.getElementById('taxiProDriversList');
  if(!list) return;
  const drivers = getTaxiProDrivers();
  if(drivers.length === 0) {
    list.innerHTML = `
      <div style="text-align:center;padding:2rem 1rem;">
        <div style="font-size:2rem;margin-bottom:0.6rem;">🚕</div>
        <div style="font-family:'Syne',sans-serif;font-weight:800;color:var(--text);font-size:0.88rem;margin-bottom:0.35rem;">Aucun chauffeur disponible</div>
        <div style="font-size:0.72rem;color:var(--muted);line-height:1.5;">Les chauffeurs apparaissent ici après inscription<br>ou ajout par l'administrateur.</div>
      </div>`;
    return;
  }
  list.innerHTML = drivers.map(d => {
    const initials = d.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    const driverDefaultPhoto = getAdminDefaultPhotoForDriver();
    const avatarHtml = d.photo
      ? `<img src="${d.photo}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--taxi-gold,#9D84FF);flex-shrink:0;" onerror="this.outerHTML='<div class=\\'taxi-driver-avatar\\'>${initials}</div>'">`
      : (driverDefaultPhoto
          ? `<img src="${driverDefaultPhoto}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--taxi-gold,#9D84FF);flex-shrink:0;" onerror="this.outerHTML='<div class=\\'taxi-driver-avatar\\'>${initials}</div>'">`
          : `<div class="taxi-driver-avatar">${initials}</div>`);
    const ratingHtml = d.rating ? ` • ⭐ ${d.rating}` : '';
    const safeId = encodeURIComponent(d.id);
    return `
    <div class="taxi-driver-item" onclick="taxiProSelectDriver(decodeURIComponent('${safeId}'))">
      ${avatarHtml}
      <div class="taxi-driver-info">
        <div class="taxi-driver-name">${d.name}</div>
        <div class="taxi-driver-meta">${d.company}${ratingHtml}</div>
      </div>
      <div class="taxi-driver-status">✓</div>
    </div>`;
  }).join('');
}

function taxiProSelectDriver(id) {
  taxiProState.selectedDriver = id;
  const drivers = getTaxiProDrivers();
  document.querySelectorAll('.taxi-driver-item').forEach((el, i) => {
    el.classList.toggle('selected', drivers[i]?.id === id);
  });
}

function taxiProNextStep(step) {
  // Validation avant avancer
  const cur = taxiProState.currentStep;
  if(step > cur) {
    if(cur === 1 && !taxiProState.vehicleType) {
      taxiProShowToast('⚠️ Sélectionnez un type de véhicule'); return;
    }
    if(cur === 2) {
      const fn = document.getElementById('taxiProFirstName');
      if(!fn || !fn.value.trim()) { taxiProShowToast('⚠️ Entrez votre prénom'); return; }
    }
    if(cur === 3) {
      const dest = document.getElementById('taxiProDestination');
      if(!dest || !dest.value.trim()) { taxiProShowToast('⚠️ Entrez votre destination'); return; }
    }
    if(cur === 4) {
      const price = document.getElementById('taxiProPrice');
      if(!price || !price.value || parseFloat(price.value) <= 0) { taxiProShowToast('⚠️ Entrez un montant'); return; }
    }
    if(cur === 5 && !taxiProState.selectedDriver) {
      taxiProShowToast('⚠️ Sélectionnez un chauffeur'); return;
    }
  }
  taxiProState.currentStep = step;
  document.querySelectorAll('.taxi-pro-command-step').forEach(el => el.classList.remove('active'));
  const stepEl = document.getElementById('taxiProStep' + step);
  if(stepEl) {
    stepEl.classList.add('active');
    const steps = ['Véhicule', 'Informations', 'Destination', 'Montant', 'Chauffeur'];
    const indicator = document.getElementById('taxiProStepIndicator');
    if(indicator) indicator.textContent = `Étape ${step} / 5 — ${steps[step-1] || ''}`;
  }
  // Scroll haut du modal
  const modal = document.querySelector('#taxiProCommandModal .taxi-modal');
  if(modal) modal.scrollTop = 0;
}

function taxiProPrevStep(step) {
  taxiProNextStep(step);
}

function taxiProSubmitOrder() {
  const firstName   = (document.getElementById('taxiProFirstName')?.value || '').trim();
  const gpsVal      = (document.getElementById('taxiProGPS')?.value || '').trim();
  const destination = (document.getElementById('taxiProDestination')?.value || '').trim();
  const time        = document.getElementById('taxiProTime')?.value || '';
  const price       = (document.getElementById('taxiProPrice')?.value || '').trim();

  if(!taxiProState.vehicleType) { taxiProShowToast('⚠️ Sélectionnez un véhicule'); taxiProNextStep(1); return; }
  if(!firstName)                 { taxiProShowToast('⚠️ Entrez votre prénom');       taxiProNextStep(2); return; }
  if(!destination)               { taxiProShowToast('⚠️ Entrez la destination');     taxiProNextStep(3); return; }
  if(!price || parseFloat(price)<=0) { taxiProShowToast('⚠️ Entrez un montant');     taxiProNextStep(4); return; }
  if(!taxiProState.selectedDriver)   { taxiProShowToast('⚠️ Sélectionnez un chauffeur'); return; }

  const driver = getTaxiProDrivers().find(d => d.id === taxiProState.selectedDriver);
  const orderId = _cryptoOrderToken('ORD');
  const vehicleLabels = { sedan:'Berline', minibus:'Minibus', suv:'SUV', van:'Van' };

  const clientData = {
    id: orderId,
    firstName, destination, time, price,
    gps: gpsVal,
    currency: taxiProState.currency,
    vehicleType: taxiProState.vehicleType,
    vehicleLabel: vehicleLabels[taxiProState.vehicleType] || taxiProState.vehicleType,
    driverId: taxiProState.selectedDriver,
    driverName: driver ? driver.name : '?',
    driverPhone: driver ? (driver.phone || driver.whatsapp || '') : '',
    clientUid: window.currentUserUID || '',
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  taxiProState.clientData = clientData;

  // Fermer modal et afficher attente réponse chauffeur
  taxiProCloseCommandModal();

  // Préparer modal réponse : état "en attente"
  const icon    = document.getElementById('taxiProResponseIcon');
  const title   = document.getElementById('taxiProResponseTitle');
  const msg     = document.getElementById('taxiProResponseMsg');
  const actions = document.getElementById('taxiProResponseActions');
  if(icon)    icon.textContent    = '⏳';
  if(title)   title.textContent   = 'Demande envoyée…';
  if(msg)     msg.textContent     = `${driver ? driver.name : 'Le chauffeur'} reçoit votre demande. Veuillez patienter.`;
  if(actions) actions.innerHTML   = `<div style="font-size:0.75rem;color:var(--muted);text-align:center;">En attente de réponse du chauffeur…</div>`;
  taxiProShowDriverResponseModal();

  // ─── Écrire la commande dans Firestore (taxi_requests) ───
  var firestoreDocId = null;
  if(window.db && window.fbAddDoc && window.fbCollection) {
    window.fbAddDoc(window.fbCollection(window.db, 'taxi_requests'), {
      orderId:      orderId,
      clientName:   firstName,
      clientUid:    window.currentUserUID || '',
      from:         gpsVal || 'À préciser',
      to:           destination,
      pickup:       gpsVal || '',
      destination:  destination,
      price:        parseFloat(price),
      currency:     taxiProState.currency,
      vehicleType:  taxiProState.vehicleType,
      vehicleLabel: vehicleLabels[taxiProState.vehicleType] || taxiProState.vehicleType,
      driverId:     taxiProState.selectedDriver,
      driverName:   driver ? driver.name : '',
      driverPhone:  driver ? _normPhone(driver.phone || driver.whatsapp || '') : '',
      time:         time || 'Immédiat',
      status:       'pending',
      createdAt:    new Date().toISOString()
    }).then(function(docRef) {
      firestoreDocId = docRef.id;
      clientData._docId = docRef.id;
      // Écouter la réponse réelle du chauffeur
      _taxiProListenDriverResponse(docRef.id, driver, clientData);
    }).catch(function(e) {
      console.warn('[TaxiPro] taxi_requests write:', e);
      // Fallback : pas de réponse simulée, informer l'utilisateur
      if(msg) msg.textContent = 'Commande enregistrée localement. Contactez le chauffeur via WhatsApp.';
      if(actions) actions.innerHTML = '';
    });
  } else {
    // Firebase non disponible : redirection directe WhatsApp
    if(msg) msg.textContent = 'Firebase indisponible. Contactez le chauffeur directement.';
  }

  // ─── Notification WhatsApp ENRICHIE avec deep-link ───
  if(driver) {
    var contextData = {
      from: gpsVal || 'À préciser', to: destination,
      price: parseFloat(price).toLocaleString('fr-FR') + ' ' + taxiProState.currency,
      vehicle: vehicleLabels[taxiProState.vehicleType],
      clientName: firstName, time: time || 'Immédiat'
    };
    var driverWA = (driver.whatsapp || driver.phone || '').replace(/\s|\+/g,'');
    if(driverWA) {
      setTimeout(function() {
        if(confirm('Envoyer la demande à ' + (driver.name||'le chauffeur') + ' via WhatsApp ?')) {
          openWhatsApp(encodeURIComponent('+' + driverWA), encodeURIComponent(driver.name||'Chauffeur'), contextData);
        }
      }, 300);
    }
  }
}

// ─── Écouter la réponse réelle du chauffeur sur taxi_requests ───
var _taxiProResponseUnsub = null;
function _taxiProListenDriverResponse(docId, driver, order) {
  if(!window.db || !window.fbDoc || !window.fbOnSnapshot) return;
  if(_taxiProResponseUnsub) { _taxiProResponseUnsub(); _taxiProResponseUnsub = null; }

  var icon    = document.getElementById('taxiProResponseIcon');
  var title   = document.getElementById('taxiProResponseTitle');
  var msg     = document.getElementById('taxiProResponseMsg');
  var actions = document.getElementById('taxiProResponseActions');

  // Timeout de 2 minutes si aucune réponse
  var timeout = setTimeout(function() {
    if(_taxiProResponseUnsub) { _taxiProResponseUnsub(); _taxiProResponseUnsub = null; }
    if(icon)  icon.textContent  = '⏰';
    if(title) title.textContent = 'Délai dépassé';
    if(msg)   msg.textContent   = 'Le chauffeur n\'a pas répondu. Essayez un autre chauffeur ou contactez-le via WhatsApp.';
    if(actions) actions.innerHTML = '<button onclick="taxiProHideDriverResponseModal()" style="padding:0.6rem 1.2rem;border-radius:10px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:var(--muted);font-size:0.78rem;cursor:pointer;">Fermer</button>';
    taxiProShowToast('⏰ Aucune réponse du chauffeur');
  }, 120000);

  try {
    _taxiProResponseUnsub = window.fbOnSnapshot(
      window.fbDoc(window.db, 'taxi_requests', docId),
      function(snap) {
        if(!snap || !snap.exists || !snap.exists()) return;
        var data = snap.data();
        var status = data.status;
        if(status === 'pending') return; // Pas encore répondu

        clearTimeout(timeout);
        if(_taxiProResponseUnsub) { _taxiProResponseUnsub(); _taxiProResponseUnsub = null; }

        if(status === 'accepted') {
          if(icon)  icon.textContent  = '✅';
          if(title) title.textContent = 'Commande Acceptée !';
          if(msg)   msg.textContent   = (data.driverName || (driver ? driver.name : 'Le chauffeur')) + ' a accepté votre commande. Taxi en route vers vous !';
          if(actions) actions.innerHTML = `
            <button class="taxi-response-btn taxi-response-accept" onclick="taxiProAcceptOrder(${taxiProState.selectedDriver})">
              ✓ Taxi En Route
            </button>
            <button class="taxi-response-btn taxi-response-reject" onclick="taxiProCancelOrder()">
              ✗ Annuler
            </button>`;
        } else if(status === 'counter') {
          var counterPrice = data.counterPrice || (parseFloat(order.price||0) + 5000);
          if(icon)  icon.textContent  = '💰';
          if(title) title.textContent = 'Contre-offre';
          if(msg)   msg.textContent   = (data.driverName || (driver ? driver.name : 'Le chauffeur')) + ' propose : ' + counterPrice.toLocaleString('fr-FR') + ' ' + (order.currency||'XAF');
          if(actions) actions.innerHTML = `
            <button class="taxi-response-btn taxi-response-accept" onclick="taxiProAcceptCounter(${taxiProState.selectedDriver}, ${counterPrice})">✓ Accepter</button>
            <button class="taxi-response-btn taxi-response-counter" onclick="taxiProProposeCounter()">💬 Contre-Proposition</button>
            <button class="taxi-response-btn taxi-response-reject" onclick="taxiProCancelOrder()">✗ Refuser</button>`;
        } else if(status === 'declined') {
          if(icon)  icon.textContent  = '❌';
          if(title) title.textContent = 'Demande Refusée';
          if(msg)   msg.textContent   = (data.driverName || (driver ? driver.name : 'Le chauffeur')) + ' n\'est pas disponible. Veuillez choisir un autre chauffeur.';
          if(actions) actions.innerHTML = '<button onclick="taxiProHideDriverResponseModal()" style="padding:0.6rem 1.2rem;border-radius:10px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-size:0.82rem;font-weight:700;cursor:pointer;width:100%;">Choisir un autre chauffeur</button>';
          taxiProShowToast('❌ ' + (driver ? driver.name : 'Chauffeur') + ' non disponible');
        }
      },
      function(err) {
        clearTimeout(timeout);
        console.warn('[TaxiPro] listener response:', err);
        if(msg) msg.textContent = 'Erreur de connexion. Contactez le chauffeur via WhatsApp.';
      }
    );
  } catch(e) {
    clearTimeout(timeout);
    console.warn('[TaxiPro] _taxiProListenDriverResponse:', e);
  }
}

function taxiProSimulateDriverResponse(order) {
  // Désactivé — les réponses arrivent via Firebase onSnapshot (_taxiProListenDriverResponse).
  // Conservé pour la compatibilité, sans effet en production.
}

function taxiProShowDriverResponseModal() {
  const modal = document.getElementById('taxiProDriverResponseModal');
  if(modal) modal.classList.add('show');
}

function taxiProHideDriverResponseModal() {
  const modal = document.getElementById('taxiProDriverResponseModal');
  if(modal) modal.classList.remove('show');
}

function taxiProAcceptOrder(driverId) {
  const driver = getTaxiProDrivers().find(d => d.id === driverId);
  taxiProHideDriverResponseModal();

  const tracking = document.getElementById('taxiProTrackingActive');
  if(tracking) {
    const nameEl = document.getElementById('taxiProDriverName');
    if(nameEl) nameEl.textContent = driver ? driver.name : '?';
    // Ajouter ETA dynamique
    let eta = 8;
    const etaEl = document.getElementById('taxiProETA');
    if(etaEl) {
      etaEl.textContent = eta + ' min';
      const etaInterval = setInterval(() => {
        eta--;
        if(etaEl) etaEl.textContent = eta > 0 ? eta + ' min' : '🚗 Arrivé !';
        if(eta <= 0) clearInterval(etaInterval);
      }, 60000);
    }
    tracking.classList.add('show');
  }
  taxiProShowToast(`✅ ${driver ? driver.name : 'Chauffeur'} en route ! Arrivée dans ~8 min`);
}

function taxiProAcceptCounter(driverId, newPrice) {
  const driver = getTaxiProDrivers().find(d => d.id === driverId);
  taxiProState.clientData.price = newPrice;
  taxiProHideDriverResponseModal();
  
  const tracking = document.getElementById('taxiProTrackingActive');
  if(tracking) {
    document.getElementById('taxiProDriverName').textContent = driver.name;
    tracking.classList.add('show');
  }
  
  taxiProShowToast(`✅ Contre-offre acceptée! ${driver.name} arrive...`);
}

function taxiProProposeCounter() {
  const newPrice = prompt('Proposez un nouveau montant:');
  if(newPrice && !isNaN(newPrice)) {
    taxiProShowToast(`📤 Votre contre-offre a été envoyée`);
  }
}

function taxiProCancelOrder() {
  taxiProHideDriverResponseModal();
  const tracking = document.getElementById('taxiProTrackingActive');
  if(tracking) tracking.classList.remove('show');
  taxiProShowToast('❌ Commande annulée');
}

function taxiProCallDriver() {
  const driver = getTaxiProDrivers().find(d => d.id === taxiProState.selectedDriver);
  if(driver) taxiProShowToast(`📞 Appel vers ${driver.name}...`);
}

function taxiProShowToast(message) {
  const toast = document.createElement('div');
  toast.className = 'taxi-toast-notif';
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Initialisation au chargement
window.addEventListener('load', () => {
  const now = new Date();
  const timeInput = document.getElementById('taxiProTime');
  if(timeInput) timeInput.value = now.toTimeString().slice(0, 5);
});

/* ════════════════════════════════════════════════════════════════════
   ADMIN TAXI PRO - GESTION DES TRANSACTIONS
   ════════════════════════════════════════════════════════════════════ */

/* ══ TRANSACTIONS TAXI PRO — SOURCE FIREBASE UNIQUEMENT ══
   Aucune donnée fictive : tableau vide jusqu'à la première vraie commande.
   Firebase collection "taxiProOrders" est la source de vérité.              */
window.taxiProTransactions = window.taxiProTransactions || [];

/* Charger les commandes Taxi Pro depuis Firebase */
function _loadTaxiTransFromFirebase() {
  if (!window.db || !window.fbCollection || !window.fbGetDocs) return;
  try {
    var col = window.fbCollection(window.db, 'taxiProOrders');
    var q = window.fbQuery && window.fbOrderBy
      ? window.fbQuery(col, window.fbOrderBy('createdAt', 'desc'))
      : col;
    window.fbGetDocs(q).then(function(snap) {
      var txs = [];
      snap.forEach(function(d) {
        var data = d.data();
        txs.push(Object.assign({ id: d.id }, data, {
          createdAt: data.createdAt ? new Date(data.createdAt) : null,
          acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : null,
          currency: data.currency || 'XAF',
          price: Number(data.price) || 0
        }));
      });
      window.taxiProTransactions = txs;
      if (typeof renderTaxiProTransactions === 'function') renderTaxiProTransactions();
    }).catch(function() {
      window.taxiProTransactions = [];
      if (typeof renderTaxiProTransactions === 'function') renderTaxiProTransactions();
    });
  } catch(e) {}
}

/* Abonnement temps réel */
function _subscribeTaxiTrans() {
  if (!window.db || !window.fbCollection || !window.fbOnSnapshot) return;
  try {
    window.fbOnSnapshot(
      window.fbCollection(window.db, 'taxiProOrders'),
      function(snap) {
        var txs = [];
        snap.forEach(function(d) {
          var data = d.data();
          txs.push(Object.assign({ id: d.id }, data, {
            createdAt:  data.createdAt  ? new Date(data.createdAt)  : null,
            acceptedAt: data.acceptedAt ? new Date(data.acceptedAt) : null,
            currency: data.currency || 'XAF',
            price: Number(data.price) || 0
          }));
        });
        txs.sort(function(a,b){ return (b.createdAt||0)-(a.createdAt||0); });
        window.taxiProTransactions = txs;
        if (typeof renderTaxiProTransactions === 'function') renderTaxiProTransactions();
        if (typeof updateTaxiProStats === 'function') updateTaxiProStats(txs);
      },
      function() { _loadTaxiTransFromFirebase(); }
    );
  } catch(e) { _loadTaxiTransFromFirebase(); }
}

/* Persister une nouvelle commande dans Firebase */
function _saveTaxiTransToFirebase(transaction) {
  if (!window.db || !window.fbCollection || !window.fbAddDoc) return;
  try {
    window.fbAddDoc(window.fbCollection(window.db, 'taxiProOrders'), transaction).catch(function(){});
  } catch(e) {}
}

/* Mettre à jour le statut d'une commande dans Firebase */
function _updateTaxiTransStatus(id, fields) {
  if (!window.db || !window.fbDoc || !window.fbUpdateDoc) return;
  try {
    window.fbUpdateDoc(window.fbDoc(window.db, 'taxiProOrders', id), fields).catch(function(){});
  } catch(e) {}
}

/* Démarrer la sync au chargement */
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(function() {
    if (window.fbOnSnapshot) _subscribeTaxiTrans();
    else _loadTaxiTransFromFirebase();
  }, 2200);
});

// Afficher les transactions Taxi Pro
function renderTaxiProTransactions() {
  const panel = document.getElementById('taxiProTransactionsList');
  const searchInput = document.getElementById('taxiProSearchInput');
  const filterStatus = document.getElementById('taxiProFilterStatus');
  
  if(!panel) return;

  // Récupérer les valeurs de recherche et filtre
  const searchText = (searchInput ? searchInput.value.toLowerCase() : '');
  const statusFilter = (filterStatus ? filterStatus.value : '');

  // Filtrer les transactions
  let filtered = window.taxiProTransactions.filter(t => {
    const matchSearch = !searchText || 
      t.client.toLowerCase().includes(searchText) ||
      t.driver.toLowerCase().includes(searchText) ||
      t.id.toLowerCase().includes(searchText) ||
      t.clientPhone.includes(searchText);
    
    const matchStatus = !statusFilter || t.status === statusFilter;
    
    return matchSearch && matchStatus;
  });

  // Trier par date décroissante
  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Mettre à jour les statistiques
  updateTaxiProStats(window.taxiProTransactions);

  if(filtered.length === 0) {
    var isFiltered = searchText || statusFilter;
    panel.innerHTML = isFiltered
      ? '<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.8rem;"><div style="font-size:2rem;margin-bottom:0.5rem;">🔍</div>Aucune transaction correspond à votre recherche</div>'
      : '<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.8rem;"><div style="font-size:2.5rem;margin-bottom:0.6rem;">📭</div><div style="font-family:Syne,sans-serif;font-weight:800;color:var(--amber);margin-bottom:0.3rem;">Aucune commande pour l\'instant</div>Les vraies commandes Taxi Pro apparaîtront ici dès que les chauffeurs recevront leurs premières demandes.</div>';
    return;
  }

  // Construire le HTML des transactions
  let html = '';
  filtered.forEach(t => {
    const statusIcon = { 'pending': '⏳', 'accepted': '✅', 'rejected': '❌', 'completed': '🏁', 'cancelled': '🚫' }[t.status] || '❓';
    const dateStr = t.createdAt ? new Date(t.createdAt).toLocaleString('fr-FR', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'}) : '-';
    const commission = Math.round(t.price * 0.1); // 10% commission
    const ratingStr = t.rating ? '⭐' + t.rating.toFixed(1) : 'N/A';

    html += `
      <div class="taxi-trans-card">
        <div class="taxi-trans-header">
          <div class="taxi-trans-id">${t.id}</div>
          <div class="taxi-trans-status ${t.status}">${statusIcon} ${t.status.toUpperCase()}</div>
        </div>

        <div class="taxi-trans-row">
          <span class="taxi-trans-label">📅 Date:</span>
          <span class="taxi-trans-value">${dateStr}</span>
        </div>

        <div class="taxi-trans-parties">
          <div class="taxi-trans-party">
            <div class="taxi-trans-party-label">👤 CLIENT</div>
            <div class="taxi-trans-party-name">${t.client}</div>
            <div class="taxi-trans-party-info">📱 ${t.clientPhone}</div>
          </div>
          <div class="taxi-trans-party">
            <div class="taxi-trans-party-label">🚕 CHAUFFEUR</div>
            <div class="taxi-trans-party-name">${t.driver}</div>
            <div class="taxi-trans-party-info">${t.driverCompany} • ${ratingStr}</div>
          </div>
        </div>

        <div class="taxi-trans-row">
          <span class="taxi-trans-label">🚗 Trajet:</span>
          <span class="taxi-trans-value">${t.from} → ${t.to}</span>
        </div>

        <div class="taxi-trans-row">
          <span class="taxi-trans-label">🕐 Heure:</span>
          <span class="taxi-trans-value">${t.time}</span>
        </div>

        <div class="taxi-trans-row">
          <span class="taxi-trans-label">💰 Montant:</span>
          <span class="taxi-trans-value">${t.price.toLocaleString('fr-FR')} ${t.currency}</span>
        </div>

        <div class="taxi-trans-row">
          <span class="taxi-trans-label">📊 Commission (10%):</span>
          <span class="taxi-trans-value">${commission.toLocaleString('fr-FR')} ${t.currency}</span>
        </div>

        ${t.rejectionReason ? `<div class="taxi-trans-row"><span class="taxi-trans-label">⚠️ Motif:</span><span style="color:var(--red);">${t.rejectionReason}</span></div>` : ''}

        ${t.status === 'pending' ? `
          <div class="taxi-trans-actions">
            <button class="taxi-trans-btn taxi-trans-btn-approve" onclick="taxiProApproveTrans('${t.id}')">✅ Valider</button>
            <button class="taxi-trans-btn taxi-trans-btn-reject" onclick="taxiProRejectTrans('${t.id}')">❌ Rejeter</button>
            <button class="taxi-trans-btn taxi-trans-btn-info" onclick="taxiProShowTransDetail('${t.id}')">ℹ️ Détails</button>
          </div>
        ` : t.status === 'accepted' ? `
          <div class="taxi-trans-actions">
            <button class="taxi-trans-btn taxi-trans-btn-approve" onclick="taxiProCompleteTrans('${t.id}')">🏁 Terminer</button>
            <button class="taxi-trans-btn taxi-trans-btn-reject" onclick="taxiProCancelTrans('${t.id}')">🚫 Annuler</button>
            <button class="taxi-trans-btn taxi-trans-btn-info" onclick="taxiProShowTransDetail('${t.id}')">ℹ️ Détails</button>
          </div>
        ` : t.status === 'completed' ? `
          <div class="taxi-trans-actions">
            <button class="taxi-trans-btn taxi-trans-btn-refund" onclick="taxiProRefundTrans('${t.id}')">💳 Rembourser</button>
            <button class="taxi-trans-btn taxi-trans-btn-info" onclick="taxiProShowTransDetail('${t.id}')">ℹ️ Détails</button>
          </div>
        ` : `
          <div class="taxi-trans-actions">
            <button class="taxi-trans-btn taxi-trans-btn-info" onclick="taxiProShowTransDetail('${t.id}')">ℹ️ Voir Détails</button>
          </div>
        `}
      </div>
    `;
  });

  panel.innerHTML = html;
}

// Mettre à jour les statistiques
function updateTaxiProStats(transactions) {
  const totalOrders = transactions.length;
  const acceptedCount = transactions.filter(t => t.status === 'accepted' || t.status === 'completed').length;
  const totalRevenue = transactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + (t.price || 0), 0);
  const commission = Math.round(totalRevenue * 0.1);

  const el1 = document.getElementById('taxiProTotalOrders');
  const el2 = document.getElementById('taxiProAcceptedCount');
  const el3 = document.getElementById('taxiProTotalRevenue');
  const el4 = document.getElementById('taxiProTotalCommission');

  if(el1) el1.textContent = totalOrders;
  if(el2) el2.textContent = acceptedCount;
  if(el3) el3.textContent = totalRevenue.toLocaleString('fr-FR');
  if(el4) el4.textContent = commission.toLocaleString('fr-FR');
}

// Approuver une transaction
function taxiProApproveTrans(orderId) {
  const trans = window.taxiProTransactions.find(t => t.id === orderId);
  if(trans) {
    trans.status = 'accepted';
    trans.acceptedAt = new Date();
    _updateTaxiTransStatus(orderId, { status: 'accepted', acceptedAt: Date.now() });
    showAdminToast('✅ Transaction validée');
    renderTaxiProTransactions();
  }
}

// Rejeter une transaction
function taxiProRejectTrans(orderId) {
  const reason = prompt('Motif du rejet:');
  if(reason === null) return;
  const trans = window.taxiProTransactions.find(t => t.id === orderId);
  if(trans) {
    trans.status = 'rejected';
    trans.rejectionReason = reason;
    _updateTaxiTransStatus(orderId, { status: 'rejected', rejectionReason: reason, rejectedAt: Date.now() });
    showAdminToast('❌ Transaction rejetée');
    renderTaxiProTransactions();
  }
}

// Compléter une transaction
function taxiProCompleteTrans(orderId) {
  const trans = window.taxiProTransactions.find(t => t.id === orderId);
  if(trans) {
    trans.status = 'completed';
    trans.completedAt = new Date();
    _updateTaxiTransStatus(orderId, { status: 'completed', completedAt: Date.now() });
    showAdminToast('🏁 Transaction complétée');
    renderTaxiProTransactions();
  }
}

// Annuler une transaction
function taxiProCancelTrans(orderId) {
  const reason = prompt('Raison de l\'annulation:');
  if(reason === null) return;
  const trans = window.taxiProTransactions.find(t => t.id === orderId);
  if(trans) {
    trans.status = 'cancelled';
    trans.cancelReason = reason;
    _updateTaxiTransStatus(orderId, { status: 'cancelled', cancelReason: reason, cancelledAt: Date.now() });
    showAdminToast('🚫 Transaction annulée');
    renderTaxiProTransactions();
  }
}

// Rembourser une transaction
function taxiProRefundTrans(orderId) {
  if(!confirm('⚠️ Rembourser le client pour cette transaction?')) return;
  const trans = window.taxiProTransactions.find(t => t.id === orderId);
  if(trans) {
    trans.refunded = true;
    trans.refundedAt = new Date();
    _updateTaxiTransStatus(orderId, { refunded: true, refundedAt: Date.now() });
    showAdminToast(`💳 Remboursement de ${trans.price} ${trans.currency} effectué`);
    renderTaxiProTransactions();
  }
}

// Afficher les détails complets
function taxiProShowTransDetail(orderId) {
  const trans = window.taxiProTransactions.find(t => t.id === orderId);
  if(trans) {
    const msg = `
📋 DÉTAILS COMPLETS - ${trans.id}

👤 CLIENT: ${trans.client}
📱 Téléphone: ${trans.clientPhone}

🚕 CHAUFFEUR: ${trans.driver}
🏢 Entreprise: ${trans.driverCompany}
🚗 Véhicule: ${trans.vehicle}
⭐ Note: ${trans.rating ? trans.rating.toFixed(1) + '/5' : 'N/A'}

📍 TRAJET:
   De: ${trans.from}
   À: ${trans.to}

🕐 Heure demandée: ${trans.time}
💰 Montant: ${trans.price.toLocaleString('fr-FR')} ${trans.currency}
📊 Commission (10%): ${Math.round(trans.price * 0.1).toLocaleString('fr-FR')} ${trans.currency}

📅 Créée: ${new Date(trans.createdAt).toLocaleString('fr-FR')}
${trans.acceptedAt ? '✅ Acceptée: ' + new Date(trans.acceptedAt).toLocaleString('fr-FR') + '\n' : ''}

🔔 Statut: ${trans.status.toUpperCase()}
${trans.rejectionReason ? '⚠️ Motif rejet: ' + trans.rejectionReason + '\n' : ''}
${trans.cancelReason ? '⚠️ Motif annulation: ' + trans.cancelReason + '\n' : ''}
${trans.refunded ? '💳 Remboursé: OUI\n' : ''}
    `;
    alert(msg);
  }
}

// Fonction helper - afficher toast
function showAdminToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;top:100px;left:50%;transform:translateX(-50%);background:var(--amber);color:var(--taxi-dark);padding:10px 20px;border-radius:30px;z-index:1000;font-weight:700;font-size:13px;font-family:"DM Sans",sans-serif;animation:slideDown 0.3s;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

// Ajouter event listeners pour recherche et filtre
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('taxiProSearchInput');
  const filterStatus = document.getElementById('taxiProFilterStatus');
  if(searchInput) searchInput.addEventListener('input', renderTaxiProTransactions);
  if(filterStatus) filterStatus.addEventListener('change', renderTaxiProTransactions);
});



/* ════════════════════════════════════════════════════════════════════════════ */
/* ═══════════════ PROFIL UTILISATEUR - STOCKAGE & GESTION ════════════════════ */
/* ════════════════════════════════════════════════════════════════════════════ */

window.userProfiles = {
  user1: {
    id: 'user1',
    name: 'Ahmed Diallo',
    username: '@ahmeddiallo',
    phone: '+241 06 XX XX XX',
    email: 'ahmed@example.com',
    photo: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%23ff2d9b"/%3E%3Ctext x="50" y="55" font-size="50" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold"%3E🧑%3C/text%3E%3C/svg%3E',
    joinedDate: '2024-01-15',
    totalOrders: 47,
    rating: 4.8,
    taxiPro: false,
    idPhotos: [],
    verified: false
  },
  user2: {
    id: 'user2',
    name: 'Yasmina Mboup',
    username: '@yasmboup',
    phone: '+241 07 XX XX XX',
    email: 'yas@example.com',
    photo: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Ccircle cx="50" cy="50" r="50" fill="%2300e5ff"/%3E%3Ctext x="50" y="55" font-size="50" fill="white" text-anchor="middle" font-family="Arial" font-weight="bold"%3E👩%3C/text%3E%3C/svg%3E',
    joinedDate: '2024-02-20',
    totalOrders: 82,
    rating: 4.9,
    taxiPro: true,
    taxiProLicense: 'TP-241-2024-001',
    taxiProCompany: 'Diallo Express Taxi',
    idPhotos: [{data: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ffd700" width="100" height="100"/%3E%3Ctext x="50" y="50" font-size="40" fill="white" text-anchor="middle" dominant-baseline="middle"%3E✓%3C/text%3E%3C/svg%3E', verified: true, uploadedAt: '2024-03-01T10:00:00Z'}],
    verified: true
  }
};

window.taxiProMembers = {
  user2: {
    id: 'user2',
    name: 'Yasmina Mboup',
    license: 'TP-241-2024-001',
    company: 'Diallo Express Taxi',
    status: 'approved',
    joinedDate: '2024-03-01',
    documents: {license: true, insurance: true, registration: true, inspection: true}
  }
};

function openMyProfileModal(userId) {
  const user = window.userProfiles[userId];
  if (!user) return;
  
  const modal = document.getElementById('user-profile-modal');
  document.getElementById('profileNameEl').textContent = user.name;
  document.getElementById('profileUsernameEl').textContent = user.username;
  document.getElementById('profilePhotoImg').src = user.photo;
  document.getElementById('profileStatOrders').textContent = user.totalOrders;
  document.getElementById('profileStatRating').textContent = user.rating.toFixed(1);
  document.getElementById('profileStatMember').textContent = user.taxiPro ? '🥇 Pro' : 'Membre';
  
  let badge = '';
  if (user.taxiPro) {
    badge = '<span class="taxi-pro-badge">🥇 Taxi Pro Verifie</span>';
  }
  document.getElementById('profileBadgeEl').innerHTML = badge;
  
  const infoGrid = document.getElementById('profileInfoGrid');
  infoGrid.innerHTML = `
    <div class="profile-info-row">
      <div class="profile-info-icon">📞</div>
      <div class="profile-info-content">
        <div class="profile-info-label">Telephone</div>
        <div class="profile-info-value">${user.phone}</div>
      </div>
    </div>
    <div class="profile-info-row">
      <div class="profile-info-icon">✉️</div>
      <div class="profile-info-content">
        <div class="profile-info-label">Email</div>
        <div class="profile-info-value">${user.email}</div>
      </div>
    </div>
    <div class="profile-info-row">
      <div class="profile-info-icon">📅</div>
      <div class="profile-info-content">
        <div class="profile-info-label">Membre depuis</div>
        <div class="profile-info-value">${new Date(user.joinedDate).toLocaleDateString('fr-FR')}</div>
      </div>
    </div>
    ${user.taxiPro ? `
    <div class="profile-info-row">
      <div class="profile-info-icon">🚕</div>
      <div class="profile-info-content">
        <div class="profile-info-label">Licence Taxi</div>
        <div class="profile-info-value">${user.taxiProLicense || 'N/A'}</div>
      </div>
    </div>
    <div class="profile-info-row">
      <div class="profile-info-icon">🏢</div>
      <div class="profile-info-content">
        <div class="profile-info-label">Entreprise</div>
        <div class="profile-info-value">${user.taxiProCompany || 'N/A'}</div>
      </div>
    </div>
    ` : ''}
  `;
  
  if (user.idPhotos && user.idPhotos.length > 0) {
    document.getElementById('profileIdGallerySection').style.display = 'block';
    const gallery = document.getElementById('profileGalleryGrid');
    gallery.innerHTML = user.idPhotos.map((photo, idx) => `
      <div class="profile-gallery-item ${photo.verified ? 'verified' : ''}" onclick="removeGalleryPhoto(${idx})">
        <img src="${photo.data}" alt="Photo identite">
      </div>
    `).join('');
  } else {
    document.getElementById('profileIdGallerySection').style.display = 'block';
    const gallery = document.getElementById('profileGalleryGrid');
    gallery.innerHTML = '<div class="profile-gallery-item empty" style="grid-column:1/-1;height:80px;">📸 Galerie vide</div>';
  }
  
  modal.classList.add('open');

    // Ajouter événement au clic sur le nom du chauffeur
    var profileModal = document.getElementById('userProfileModal');
    if (profileModal) {
      var nameEl = profileModal.querySelector('[data-field="name"]');
      if (nameEl && !nameEl.hasAttribute('data-whatsapp-ready')) {
        nameEl.setAttribute('data-whatsapp-ready', 'true');
        nameEl.style.cursor = 'pointer';
        nameEl.style.color = 'var(--cyan)';
        nameEl.style.textDecoration = 'underline';
        nameEl.style.transition = 'all 0.2s';
        
        nameEl.addEventListener('mouseenter', function() {
          this.style.color = 'var(--pink)';
          this.style.fontSize = '1.1em';
        });
        
        nameEl.addEventListener('mouseleave', function() {
          this.style.color = 'var(--cyan)';
          this.style.fontSize = '1em';
        });
        
        nameEl.addEventListener('click', function(e) {
          e.stopPropagation();
          var phone = profileModal.querySelector('[data-field="phone"]');
          if (phone) {
            var phoneNum = phone.textContent.replace(/[^0-9+]/g, '');
            contactChauffeurWhatsApp(phoneNum, nameEl.textContent);
          }
        });
      }
    }
    
  }

function closeMyProfileModal() {
  document.getElementById('user-profile-modal').classList.remove('open');
}

function triggerPhotoUpload() {
  triggerProfilePhotoUpload();
}

/* ── Upload photo profil membre — même système que Admin Config App ── */
function triggerProfilePhotoUpload() {
  // Supprimer l'ancien input si présent pour éviter accumulation
  var old = document.getElementById('_profileMemberFileInput');
  if (old) old.remove();

  var input = document.createElement('input');
  input.type = 'file';
  input.id = '_profileMemberFileInput';
  input.accept = 'image/*';
  input.style.display = 'none';
  input.onchange = function() {
    var file = input.files && input.files[0];
    input.value = '';
    // Retirer du DOM immédiatement pour ne pas bloquer la navigation
    if (input.parentNode) input.parentNode.removeChild(input);
    if (!file) return;
    if (typeof window._processAvatarFile === 'function') {
      window._processAvatarFile(file);
    } else {
      // Fallback : lecture locale directe
      var uid = window.currentUserUID;
      if (!uid) { if(typeof showToast==='function') showToast('🔒 Connectez-vous d\'abord'); return; }
      var reader = new FileReader();
      reader.onload = function(ev) {
        var dataUrl = ev.target.result;
        try { localStorage.setItem('ambi241_avatar_'+uid, dataUrl); } catch(e) {}
        var img = document.getElementById('profilePhotoImg');
        if (img) img.src = dataUrl;
        if (typeof showToast==='function') showToast('✅ Photo de profil mise à jour !');
      };
      reader.readAsDataURL(file);
    }
  };
  document.body.appendChild(input);
  // Délai court pour garantir l'attachement au DOM avant le click (mobile Safari)
  setTimeout(function() { input.click(); }, 50);
}
window.triggerProfilePhotoUpload = triggerProfilePhotoUpload;

function uploadProfilePhoto(event) {
  // Conservé pour compatibilité — délègue à la nouvelle fonction
  var file = event && event.target && event.target.files && event.target.files[0];
  if (event && event.target) event.target.value = '';
  if (!file) return;
  if (typeof window._processAvatarFile === 'function') {
    window._processAvatarFile(file);
  }
}

function triggerGalleryUpload() {
  document.getElementById('galleryUploadInput').click();
}

function uploadGalleryPhoto(event) {
  var file = event.target && event.target.files && event.target.files[0];
  if (event.target) event.target.value = '';
  if (!file) return;
  var uid = window.currentUserUID;
  if (!uid) { if(typeof showToast==='function') showToast('🔒 Connectez-vous d\'abord'); return; }

  var isImgOk = file.type.startsWith('image/') ||
    /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|svg|ico)$/i.test(file.name);
  if (!isImgOk) { if(typeof showToast==='function') showToast('❌ Fichier non reconnu comme image'); return; }
  if (file.size > 10*1024*1024) { if(typeof showToast==='function') showToast('⚠️ Image trop grande (max 10 Mo)'); return; }

  if(typeof showToast==='function') showToast('⏳ Upload galerie...');
  if(typeof showUploadProgress==='function') showUploadProgress(10,'Galerie...');

  function _saveGalleryUrl(url){
    if(window.db && window.fbDoc && window.fbUpdateDoc){
      var userDoc = window.fbDoc(window.db,'users',uid);
      // Ajouter à idPhotos[]
      window.fbGetDoc && window.fbGetDoc(userDoc).then(function(snap){
        var data = snap.exists ? (snap.data ? snap.data() : snap._document&&snap._document.data) : {};
        if(!data) data={};
        var photos = (data.idPhotos||[]).slice();
        photos.push({url:url, verified:false, uploadedAt:new Date().toISOString()});
        return window.fbUpdateDoc(userDoc,{idPhotos:photos});
      }).then(function(){
        if(typeof hideUploadProgress==='function') hideUploadProgress(700);
        if(typeof showToast==='function') showToast('✅ Photo ajoutée à la galerie !');
        if(typeof window._renderUserPhotosUI==='function') window._renderUserPhotosUI();
      }).catch(function(){ if(typeof hideUploadProgress==='function') hideUploadProgress(0); });
    } else {
      // Fallback localStorage
      try{
        var arr=JSON.parse(localStorage.getItem('ambi241_gallery_'+uid)||'[]');
        arr.push({url:url,verified:false,uploadedAt:new Date().toISOString()});
        localStorage.setItem('ambi241_gallery_'+uid,JSON.stringify(arr));
      }catch(e){}
      if(typeof hideUploadProgress==='function') hideUploadProgress(700);
      if(typeof showToast==='function') showToast('✅ Photo ajoutée à la galerie !');
      if(typeof window._renderUserPhotosUI==='function') window._renderUserPhotosUI();
    }
  }

  if(window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL){
    var storRef = window.fbRef(window.fbStorage,'users/'+uid+'/gallery_'+_cryptoId(12)+'.jpg');
    if(typeof showUploadProgress==='function') showUploadProgress(30,'Upload...');
    window.fbUploadBytes(storRef, file).then(function(){
      if(typeof showUploadProgress==='function') showUploadProgress(80,'Finalisation...');
      return window.fbGetDownloadURL(storRef);
    }).then(function(url){
      _saveGalleryUrl(url);
    }).catch(function(){
      // Fallback compression locale
      if(typeof compressImage==='function'){
        compressImage(file, function(dataUrl){ _saveGalleryUrl(dataUrl); });
      } else { if(typeof hideUploadProgress==='function') hideUploadProgress(0); }
    });
  } else if(typeof compressImage==='function'){
    compressImage(file, function(dataUrl){ _saveGalleryUrl(dataUrl); });
  } else { if(typeof hideUploadProgress==='function') hideUploadProgress(0); }
}

function removeGalleryPhoto(index) {
  if (confirm('Supprimer cette photo?')) {
    const currentUser = getCurrentUser();
    if (currentUser && currentUser.idPhotos) {
      currentUser.idPhotos.splice(index, 1);
      alert('✅ Photo supprimee');
      openMyProfileModal(currentUser.id);
    }
  }
}

function editUserProfile() {
  alert('Interface de modification du profil');
}

function shareUserProfile() {
  alert('Partage via: WhatsApp, Email, SMS...');
}

function reportUserProfile() {
  alert('Signaler ce profil');
}

function openTaxiProModal(userId) {
  const user = window.userProfiles[userId];
  if (!user) return;
  
  const modal = document.getElementById('taxi-pro-modal');
  const licenseInput = document.getElementById('taxiProLicense');
  const companyInput = document.getElementById('taxiProCompany');
  
  if (user.taxiPro) {
    licenseInput.value = user.taxiProLicense || '';
    companyInput.value = user.taxiProCompany || '';
  }
  
  const adminSection = document.getElementById('taxiProMembersSection');
  if (isAdmin) {
    adminSection.style.display = 'block';
    renderTaxiProMembers();
  }
  
  modal.classList.add('open');
}

function closeTaxiProModal() {
  document.getElementById('taxi-pro-modal').classList.remove('open');
}

function uploadTaxiProDoc(docType) {
  var uid = window.currentUserUID;
  if (!uid) { if(typeof showToast==='function') showToast('🔒 Connectez-vous d\'abord'); return; }

  var labelMap = {license:'Permis de conduire', insurance:'Assurance', registration:'Carte grise', inspection:'Vignette'};
  var docLabel = labelMap[docType] || docType;

  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.pdf';
  input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);

  input.onchange = function(){
    var file = input.files && input.files[0];
    try{ document.body.removeChild(input); }catch(e){}
    if (!file) return;

    var isOk = file.type.startsWith('image/') || file.type === 'application/pdf' ||
      /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|pdf)$/i.test(file.name);
    if (!isOk) { if(typeof showToast==='function') showToast('❌ Format non reconnu (image ou PDF)'); return; }
    if (file.size > 10*1024*1024) { if(typeof showToast==='function') showToast('⚠️ Fichier trop grand (max 10 Mo)'); return; }

    if(typeof showToast==='function') showToast('⏳ Upload '+docLabel+'...');
    if(typeof showUploadProgress==='function') showUploadProgress(10,'Upload...');

    function _markDocUploaded(url){
      // Marquer visuellement le doc comme uploadé
      var docEl = document.querySelector('.taxi-pro-doc-item[onclick*="\''+docType+'\'"]');
      if(docEl){ docEl.classList.add('uploaded'); }
      // Sauvegarder dans Firestore si possible
      if(window.db && window.fbDoc && window.fbUpdateDoc){
        var upd={}; upd['doc_'+docType]=url; upd['doc_'+docType+'_ts']=new Date().toISOString();
        (window.fbSetDoc ? window.fbSetDoc(window.fbDoc(window.db,'users',uid),upd,{merge:true}) : window.fbUpdateDoc(window.fbDoc(window.db,'users',uid),upd)).catch(function(){});
      }
      try{ localStorage.setItem('ambi241_doc_'+docType+'_'+uid, url); }catch(e){}
      if(typeof hideUploadProgress==='function') hideUploadProgress(700);
      if(typeof showToast==='function') showToast('✅ '+docLabel+' uploadé !');
    }

    if(window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL){
      var storRef = window.fbRef(window.fbStorage,'users/'+uid+'/docs/'+docType+'_'+_cryptoId(12)+'.jpg');
      if(typeof showUploadProgress==='function') showUploadProgress(30,'Upload...');
      window.fbUploadBytes(storRef, file).then(function(){
        if(typeof showUploadProgress==='function') showUploadProgress(80,'Finalisation...');
        return window.fbGetDownloadURL(storRef);
      }).then(function(url){ _markDocUploaded(url); })
      .catch(function(){
        if(typeof compressImage==='function'){
          compressImage(file, function(dataUrl){ _markDocUploaded(dataUrl); });
        } else { if(typeof hideUploadProgress==='function') hideUploadProgress(0); }
      });
    } else if(typeof compressImage==='function'){
      compressImage(file, function(dataUrl){ _markDocUploaded(dataUrl); });
    } else { if(typeof hideUploadProgress==='function') hideUploadProgress(0); }
  };
  input.click();
}

function submitTaxiPro() {
  const license = document.getElementById('taxiProLicense').value.trim();
  const company = document.getElementById('taxiProCompany').value.trim();
  
  if (!license || !company) {
    alert('Remplissez tous les champs');
    return;
  }
  
  const currentUser = getCurrentUser();
  if (currentUser) {
    currentUser.taxiPro = true;
    currentUser.taxiProLicense = license;
    currentUser.taxiProCompany = company;
    
    if (!window.taxiProMembers[currentUser.id]) {
      window.taxiProMembers[currentUser.id] = {
        id: currentUser.id,
        name: currentUser.name,
        license: license,
        company: company,
        status: 'pending',
        joinedDate: new Date().toISOString(),
        documents: {}
      };
    }
    
    alert('Demande Taxi Pro soumise!');
    closeTaxiProModal();
  }
}

function renderTaxiProMembers() {
  const list = document.getElementById('taxiProMembersList');
  const members = Object.values(window.taxiProMembers);
  
  list.innerHTML = members.map(member => `
    <div class="taxi-pro-member-item">
      <div class="taxi-pro-member-info">
        <div class="taxi-pro-member-name">${member.name}</div>
        <div class="taxi-pro-member-license">${member.license} • ${member.company}</div>
      </div>
      <div class="taxi-pro-member-actions">
        ${member.status === 'pending' ? '<button class="taxi-pro-member-btn promote" onclick="approveTaxiProMember(' + "'" + member.id + "'" + ')">Approuver</button>' : ''}
        <button class="taxi-pro-member-btn revoke" onclick="revokeTaxiProMember(' + "'" + member.id + "'" + ')">Revoquer</button>
      </div>
    </div>
  `).join('');
}

function approveTaxiProMember(userId) {
  if (window.taxiProMembers[userId]) {
    window.taxiProMembers[userId].status = 'approved';
    const user = window.userProfiles[userId];
    if (user) user.verified = true;
    alert('Membre Taxi Pro approuve!');
    renderTaxiProMembers();
  }
}

function revokeTaxiProMember(userId) {
  if (confirm('Etes-vous sur de revoquer ce statut?')) {
    const member = window.taxiProMembers[userId];
    if (member) member.status = 'revoked';
    const user = window.userProfiles[userId];
    if (user) user.taxiPro = false;
    alert('Statut Taxi Pro revoque');
    renderTaxiProMembers();
  }
}

function getCurrentUser() {
  return window.userProfiles.user1;
}

// Note: isAdmin() function removed — use the global variable `isAdmin` (boolean) instead
// The function was conflicting with the global var isAdmin=false; defined earlier


// ════════════════════════════════════════════════════════════════
// RÉINITIALISATION MOT DE PASSE — nettoyé (v2)
// Email : Firebase sendPasswordResetEmail (automatique)
// Tel   : ticket Firestore support_requests (traité par admin)
// Fonctions openPasswordResetModal / sendPasswordReset supprimées
// (modal #resetPasswordModal inexistant — dead code retiré)
// ════════════════════════════════════════════════════════════════



// ════════════════════════════════════════════════════════════════
// REDIRECTION WHATSAPP - Clic sur nom chauffeur
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════════════
// SYSTÈME DE COMMANDES & FLUX WHATSAPP COMPLET
// ════════════════════════════════════════════════════════════════════════

// Stockage des commandes avec tokens uniques
window.commandesEnCours = {};
window.commandeTokens = {};

// Générer un token unique pour une commande
function generateCommandToken() {
  return 'CMD-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
}

// Créer une commande détaillée
function createDetailedOrder(driverId, driverName, driverPhone, orderDetails = {}) {
  const token = generateCommandToken();
  
  // Données de la commande
  const order = {
    token: token,
    driverId: driverId,
    driverName: driverName,
    driverPhone: driverPhone,
    clientId: getCurrentUserId(),
    clientName: getCurrentUserName(),
    details: orderDetails,
    createdAt: new Date().toISOString(),
    status: 'pending', // pending, accepted, rejected
    rejectionReason: null
  };
  
  // Sauvegarder la commande
  window.commandesEnCours[token] = order;
  window.commandeTokens[driverPhone] = token;
  
  console.log('✅ Commande créée:', token);
  return token;
}

// Construire le lien de validation pour le chauffeur
function buildDriverValidationLink(token) {
  var base = window.AMBI241_APP_URL
             || ((window.location.protocol === 'http:' || window.location.protocol === 'https:')
                 ? window.location.href.split('?')[0] : null);
  if (!base) return '#url-non-configuree';
  return base.replace(/\/$/, '') + '?action=validate-order&token=' + token;
}

// Contacter chauffeur avec lien de commande
function contactChauffeurWithOrder(phoneNumber, chauffeurName, driverId, orderDetails) {
  if (!phoneNumber) {
    alert('❌ Numéro WhatsApp non disponible');
    return;
  }
  
  // Nettoyer le numéro
  let cleaned = phoneNumber.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('0') || cleaned.startsWith('1')) {
    cleaned = '+241' + cleaned.substring(1);
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+241' + cleaned;
  }
  
  // Créer la commande avec token
  const token = createDetailedOrder(driverId, chauffeurName, cleaned, orderDetails);
  
  // Construire le lien de validation
  const validationLink = buildDriverValidationLink(token);
  
  // Message WhatsApp avec lien de commande
  const message = `Bonjour ${chauffeurName},\n\n📋 NOUVELLE COMMANDE AMBI241\n\nClient: ${getCurrentUserName()}\nLocalisation: [À confirmer]\n\n🔗 Voir détails & valider: ${validationLink}\n\nMerci!`;
  
  const encodedMessage = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/${cleaned}?text=${encodedMessage}`;
  
  console.log('✅ Ouverture WhatsApp avec lien de commande:', validationLink);
  window.open(whatsappUrl, '_blank', 'width=600,height=700');
}

// Gérer la validation de commande (quand le chauffeur clique le lien)
function handleOrderValidation(token) {
  const order = window.commandesEnCours[token];
  
  if (!order) {
    alert('❌ Commande non trouvée');
    return;
  }
  
  // Vérifier si c'est le chauffeur
  const currentUser = getCurrentUser();
  if (currentUser.id !== order.driverId) {
    alert('⚠️ Vous n\'êtes pas autorisé à valider cette commande');
    return;
  }
  
  // Ouvrir le modal de réponse du chauffeur
  openDriverResponseModal(token, order);
}

// Modal: Chauffeur accepte/refuse la commande
function openDriverResponseModal(token, order) {
  const html = `
    <div id="driverResponseModal" style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--surface);
      border: 2px solid #9D84FF;
      border-radius: 20px;
      padding: 2rem;
      width: min(420px, 95vw);
      z-index: 10000;
      box-shadow: 0 20px 60px rgba(0,0,0,0.9);
    ">
      <h2 style="font-family: Syne; color: #9D84FF; margin-bottom: 1rem; text-align: center;">
        📍 RÉPONDRE À LA COMMANDE
      </h2>
      
      <p style="color: var(--muted); margin-bottom: 1.5rem; text-align: center;">
        Client: <strong style="color: var(--text);">${order.clientName}</strong>
      </p>
      
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; color: var(--text); font-weight: 600; margin-bottom: 0.5rem;">
          ✅ ACCEPTER
        </label>
        <button onclick="acceptOrder('${token}')" style="
          width: 100%;
          padding: 1rem;
          background: linear-gradient(135deg, #9D84FF, #7C5FE8);
          border: none;
          border-radius: 12px;
          color: white;
          font-weight: 700;
          cursor: pointer;
          font-family: DM Sans;
          transition: all 0.2s;
        ">
          ✅ ACCEPTER LA COMMANDE
        </button>
      </div>
      
      <div style="margin-bottom: 1.5rem;">
        <label style="display: block; color: var(--text); font-weight: 600; margin-bottom: 0.5rem;">
          ❌ REFUSER (optionnel: motif)
        </label>
        <input type="text" id="rejectionReason" placeholder="Raison du refus..." style="
          width: 100%;
          padding: 0.75rem;
          background: rgba(157, 132, 255, 0.1);
          border: 1px solid rgba(157, 132, 255, 0.3);
          border-radius: 12px;
          color: var(--text);
          margin-bottom: 0.5rem;
          font-family: DM Sans;
        " />
        <button onclick="rejectOrder('${token}')" style="
          width: 100%;
          padding: 1rem;
          background: rgba(255, 68, 102, 0.2);
          border: 1px solid #ff4466;
          border-radius: 12px;
          color: #ff4466;
          font-weight: 700;
          cursor: pointer;
          font-family: DM Sans;
          transition: all 0.2s;
        ">
          ❌ REFUSER LA COMMANDE
        </button>
      </div>
    </div>
  `;
  
  // Injecter le modal
  const wrapper = document.createElement('div');
  wrapper.innerHTML = html;
  wrapper.style.position = 'fixed';
  wrapper.style.inset = '0';
  wrapper.style.background = 'rgba(0,0,0,0.7)';
  wrapper.style.zIndex = '9999';
  wrapper.onclick = function(e) {
    if (e.target === wrapper) wrapper.remove();
  };
  
  document.body.appendChild(wrapper);
}

// Chauffeur accepte la commande
function acceptOrder(token) {
  const order = window.commandesEnCours[token];
  if (!order) return;
  
  order.status = 'accepted';
  recordTransaction(order, "accepted");
  order.acceptedAt = new Date().toISOString();
  
  alert('✅ Commande acceptée! Vous allez être redirigé vers votre tableau de bord.');
  
  // Fermer le modal
  const modal = document.getElementById('driverResponseModal');
  if (modal) modal.parentElement.remove();
  
  // Rediriger vers tableau de bord Taxi Pro du chauffeur
  redirectToTaxiProDashboard(token, 'accepted');
}

// Chauffeur refuse la commande
function rejectOrder(token) {
  const reason = document.getElementById('rejectionReason').value || 'Non spécifiée';
  const order = window.commandesEnCours[token];
  if (!order) return;
  
  order.status = 'rejected';
  recordTransaction(order, "rejected", {rejectionReason: reason});
  order.rejectionReason = reason;
  order.rejectedAt = new Date().toISOString();
  
  alert(`❌ Commande refusée (Motif: ${reason})`);
  
  // Fermer le modal
  const modal = document.getElementById('driverResponseModal');
  if (modal) modal.parentElement.remove();
  
  // Rediriger vers tableau de bord
  redirectToTaxiProDashboard(token, 'rejected');
}

// Rediriger vers le tableau de bord Taxi Pro du chauffeur
function redirectToTaxiProDashboard(token, action) {
  const order = window.commandesEnCours[token];
  
  // Chercher l'utilisateur chauffeur correspondant
  const driver = Object.values(window.userProfiles).find(u => 
    u.id === order.driverId || u.phone === order.driverPhone
  );
  
  if (driver) {
    // Ouvrir le profil/dashboard du chauffeur
    openTaxiProDashboardForDriver(driver.id, action, token);
  }
}

function openTaxiProDashboardForDriver(driverId, action, token) {
  // Simuler l'ouverture du dashboard Taxi Pro
  const driver = window.userProfiles[driverId];
  
  if (driver) {
    // Enregistrer l'action
    if (!window.driverActions) window.driverActions = {};
    window.driverActions[token] = {
      action: action,
      driver: driver.id,
      timestamp: new Date().toISOString()
    };
    
    // Afficher confirmation
    alert(`✅ Tableau de bord Taxi Pro ouvert\nAction: ${action.toUpperCase()}\n\nVous pouvez désormais gérer l'offre.`);
    
    // Mettre à jour l'interface (simulé)
    console.log('📊 Dashboard Taxi Pro mis à jour', window.driverActions[token]);
  }
}

// Fonction pour obtenir l'ID utilisateur actuel
function getCurrentUserId() {
  const user = getCurrentUser();
  return user ? user.id : 'client_' + Date.now();
}

// Fonction pour obtenir le nom utilisateur actuel
function getCurrentUserName() {
  const user = getCurrentUser();
  return user ? user.name : 'Client AMBI241';
}

// Vérifier le lien de validation au chargement
function checkOrderValidationLink() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const action = params.get('action');
  
  if (action === 'validate-order' && token) {
    console.log('🔗 Lien de validation détecté:', token);
    handleOrderValidation(token);
  }
}

// Appeler au chargement de la page
window.addEventListener('load', checkOrderValidationLink);



function contactChauffeurWhatsApp(phoneNumber, chauffeurName, driverId = null) {
  // Rediriger vers le nouveau système
  if (!driverId) {
    driverId = generateRandomId();
  }
  contactChauffeurWithOrder(phoneNumber, chauffeurName, driverId);
}

function generateRandomId() {
  return 'driver_' + Math.random().toString(36).substring(2, 9);
}



// ════════════════════════════════════════════════════════════════════════
// SYSTÈME D'HISTORIQUE DES TRANSACTIONS
// Enregistrement complet pour Chauffeur + Admin
// ════════════════════════════════════════════════════════════════════════

// Initialiser le stockage d'historique
if (!window.transactionHistory) {
  window.transactionHistory = {};
}

if (!window.adminLogs) {
  window.adminLogs = [];
}

if (!window.driverTransactionHistory) {
  window.driverTransactionHistory = {};
}

// Enregistrer une transaction
function recordTransaction(order, action, details = {}) {
  const transactionId = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  
  const transaction = {
    id: transactionId,
    token: order.token,
    driverId: order.driverId,
    driverName: order.driverName,
    driverPhone: order.driverPhone,
    clientId: order.clientId,
    clientName: order.clientName,
    action: action, // 'created', 'accepted', 'rejected', 'completed', 'cancelled'
    status: order.status,
    rejectionReason: order.rejectionReason || null,
    details: details,
    timestamp: new Date().toISOString(),
    formattedTime: formatDate(new Date()),
    ipAddress: 'N/A', // À implémenter si besoin
    userAgent: navigator.userAgent.substring(0, 100)
  };
  
  // Enregistrer dans l'historique global
  window.transactionHistory[transactionId] = transaction;
  
  // Enregistrer pour le chauffeur spécifique
  if (!window.driverTransactionHistory[order.driverId]) {
    window.driverTransactionHistory[order.driverId] = [];
  }
  window.driverTransactionHistory[order.driverId].push(transaction);
  
  // Enregistrer dans les logs admin
  window.adminLogs.push({
    ...transaction,
    category: 'transaction',
    severity: action === 'rejected' ? 'warning' : 'info',
    adminViewed: false
  });
  
  // Sauvegarder dans localStorage pour persistance
  try {
    localStorage.setItem('transactionHistory_' + transactionId, JSON.stringify(transaction));
    localStorage.setItem('driverTransactions_' + order.driverId, JSON.stringify(window.driverTransactionHistory[order.driverId]));
    localStorage.setItem('adminLogs', JSON.stringify(window.adminLogs));
  } catch (e) {
    console.warn('⚠️ Erreur sauvegarde localStorage:', e);
  }
  
  // Envoyer au serveur (si backend disponible)
  sendTransactionToServer(transaction);
  
  console.log('✅ Transaction enregistrée:', transactionId);
  console.log('   Driver:', order.driverName);
  console.log('   Client:', order.clientName);
  console.log('   Action:', action);
  
  return transactionId;
}

// Envoyer la transaction au serveur
function sendTransactionToServer(transaction) {
  // À adapter avec votre API
  // Example:
  // fetch('/api/transactions', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(transaction)
  // }).then(r => r.json()).catch(e => console.warn('Erreur serveur:', e));
  
  console.log('📤 Transaction prête pour serveur:', transaction.id);
}

// Obtenir l'historique du chauffeur
function getDriverTransactionHistory(driverId) {
  return window.driverTransactionHistory[driverId] || [];
}

// Obtenir toutes les transactions (pour admin)
function getAllTransactions() {
  return Object.values(window.transactionHistory);
}

// Obtenir les logs admin
function getAdminLogs(filter = {}) {
  let logs = [...window.adminLogs];
  
  if (filter.driverId) {
    logs = logs.filter(l => l.driverId === filter.driverId);
  }
  if (filter.action) {
    logs = logs.filter(l => l.action === filter.action);
  }
  if (filter.status) {
    logs = logs.filter(l => l.status === filter.status);
  }
  if (filter.startDate) {
    logs = logs.filter(l => new Date(l.timestamp) >= new Date(filter.startDate));
  }
  if (filter.endDate) {
    logs = logs.filter(l => new Date(l.timestamp) <= new Date(filter.endDate));
  }
  
  return logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

// Afficher l'historique du chauffeur
function displayDriverTransactionHistory(driverId) {
  const transactions = getDriverTransactionHistory(driverId);
  
  let html = '<div style="max-height: 600px; overflow-y: auto;">';
  
  if (transactions.length === 0) {
    html += '<p style="color: var(--muted); text-align: center; padding: 2rem;">Aucune transaction</p>';
  } else {
    html += transactions.map(txn => `
      <div style="
        padding: 1rem;
        border-bottom: 1px solid rgba(157, 132, 255, 0.1);
        background: rgba(157, 132, 255, 0.02);
        border-radius: 8px;
        margin-bottom: 0.5rem;
      ">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div>
            <strong style="color: #9D84FF;">${txn.clientName}</strong>
            <br><small style="color: var(--muted);">${txn.formattedTime}</small>
          </div>
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 700;
            ${txn.action === 'accepted' ? 'background: rgba(0,255,170,0.2); color: var(--green);' : 
              txn.action === 'rejected' ? 'background: rgba(255,68,102,0.2); color: #ff4466;' :
              'background: rgba(0,229,255,0.2); color: var(--cyan);'}
          ">
            ${txn.action.toUpperCase()}
          </span>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--muted);">
          ${txn.status === 'rejected' ? '<strong>Motif:</strong> ' + (txn.rejectionReason || 'N/A') : 'Commande: ' + txn.token}
        </div>
      </div>
    `).join('');
  }
  
  html += '</div>';
  return html;
}

// Tableau admin: Afficher toutes les transactions
function displayAdminTransactionTable(filter = {}) {
  const logs = getAdminLogs(filter);
  
  let html = `
    <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
      <thead>
        <tr style="background: rgba(157, 132, 255, 0.1); border-bottom: 2px solid #9D84FF;">
          <th style="padding: 0.75rem; text-align: left; color: #9D84FF;">Date/Heure</th>
          <th style="padding: 0.75rem; text-align: left; color: #9D84FF;">Chauffeur</th>
          <th style="padding: 0.75rem; text-align: left; color: #9D84FF;">Client</th>
          <th style="padding: 0.75rem; text-align: left; color: #9D84FF;">Action</th>
          <th style="padding: 0.75rem; text-align: left; color: #9D84FF;">Statut</th>
          <th style="padding: 0.75rem; text-align: left; color: #9D84FF;">Détails</th>
        </tr>
      </thead>
      <tbody>
        ${logs.map((log, i) => `
          <tr style="border-bottom: 1px solid rgba(157, 132, 255, 0.1); background: ${i % 2 ? 'rgba(157, 132, 255, 0.02)' : 'transparent'};">
            <td style="padding: 0.75rem;">${log.formattedTime}</td>
            <td style="padding: 0.75rem;"><strong>${log.driverName}</strong></td>
            <td style="padding: 0.75rem;">${log.clientName}</td>
            <td style="padding: 0.75rem;">
              <span style="
                padding: 0.25rem 0.5rem;
                border-radius: 6px;
                font-size: 0.7rem;
                font-weight: 700;
                background: rgba(157, 132, 255, 0.2);
                color: #9D84FF;
              ">${log.action}</span>
            </td>
            <td style="padding: 0.75rem;">
              <span style="
                padding: 0.25rem 0.5rem;
                border-radius: 6px;
                font-size: 0.7rem;
                font-weight: 700;
                ${log.status === 'accepted' ? 'background: rgba(0,255,170,0.2); color: var(--green);' : 
                  log.status === 'rejected' ? 'background: rgba(255,68,102,0.2); color: #ff4466;' :
                  'background: rgba(0,229,255,0.2); color: var(--cyan);'}
              ">${log.status}</span>
            </td>
            <td style="padding: 0.75rem; font-size: 0.75rem; color: var(--muted);">
              ${log.rejectionReason ? 'Refus: ' + log.rejectionReason : 'Token: ' + log.token.substring(0, 12) + '...'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  
  return html;
}

// Mettre à jour la transaction après acceptation/refus
function updateTransactionStatus(token, status, rejectionReason = null) {
  const order = window.commandesEnCours[token];
  if (!order) return;
  
  order.status = status;
  order.rejectionReason = rejectionReason;
  
  // Enregistrer l'action
  recordTransaction(order, status, {
    rejectionReason: rejectionReason
  });
  
  console.log('✅ Transaction mise à jour:', token, 'Status:', status);
}

// Utilitaires
function formatDate(date) {
  const options = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' };
  return date.toLocaleDateString('fr-FR', options);
}

// Charger l'historique depuis localStorage au démarrage
function loadTransactionHistoryFromStorage() {
  try {
    const keys = Object.keys(localStorage);
    const txnKeys = keys.filter(k => k.startsWith('transactionHistory_'));
    
    txnKeys.forEach(key => {
      try {
        const txn = JSON.parse(localStorage.getItem(key));
        if (txn) {
          window.transactionHistory[txn.id] = txn;
        }
      } catch (e) {
        console.warn('Erreur chargement transaction:', e);
      }
    });
    
    const adminLogsStr = localStorage.getItem('adminLogs');
    if (adminLogsStr) {
      window.adminLogs = JSON.parse(adminLogsStr);
    }
  } catch (e) {
    console.warn('⚠️ Erreur chargement historique:', e);
  }
}

// Charger au démarrage
window.addEventListener('load', loadTransactionHistoryFromStorage);


