// ══════════════════════════════════════════════════════════════
// RÉSERVATION DIRECTE ÉTABLISSEMENT — WHATSAPP PRO
// Même mécanique que Taxi Pro : clic nom → sheet → WA direct
// L'établissement reçoit un lien Accepter/Refuser dashboard
// ══════════════════════════════════════════════════════════════

var _etabQorderState = {
  etabId: null,
  etabNom: '',
  etabContact: '',
  etabType: '',
  etabPhoto: '',
  selectedType: 'table_vip',
  token: ''
};

// Ouvrir le sheet de réservation directe (appelé depuis vip-reserve-btn enrichi)
function openEtabQorder(etabId, etabNom, etabContact, etabType, etabPhoto) {
  _etabQorderState.etabId    = etabId;
  _etabQorderState.etabNom   = decodeURIComponent(etabNom || '');
  _etabQorderState.etabContact = decodeURIComponent(etabContact || '');
  _etabQorderState.etabType  = decodeURIComponent(etabType || '');
  _etabQorderState.etabPhoto = decodeURIComponent(etabPhoto || '');
  _etabQorderState.selectedType = 'table_vip';
  _etabQorderState.token = '';

  // Adapter les types selon l'établissement
  var isHotel = (_etabQorderState.etabType||'').toLowerCase().indexOf('hotel') !== -1
             || (_etabQorderState.etabType||'').toLowerCase().indexOf('hôtel') !== -1;
  var isResto = (_etabQorderState.etabType||'').toLowerCase().indexOf('restaurant') !== -1
             || (_etabQorderState.etabType||'').toLowerCase().indexOf('snack') !== -1;

  // Mettre à jour l'en-tête
  var avatarEl = document.getElementById('etabQorderAvatar');
  var nameEl   = document.getElementById('etabQorderName');
  var subEl    = document.getElementById('etabQorderSub');

  if (nameEl)  nameEl.textContent  = _etabQorderState.etabNom || 'Établissement';
  if (subEl)   subEl.textContent   = _etabQorderState.etabType + ' · Libreville';
  if (avatarEl) {
    if (_etabQorderState.etabPhoto) {
      avatarEl.innerHTML = '<img src="' + _etabQorderState.etabPhoto + '" onerror="this.parentNode.textContent=\'🏠\'">';
    } else {
      var typeIcons = { Bar:'🍺', Discotheque:'🎵', Restaurant:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 40" width="1.4em" height="1em" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><line x1="10" y1="4" x2="10" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/><line x1="7" y1="4" x2="7" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="4" x2="13" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M7 16 Q10 20 13 16" fill="none" stroke="white" stroke-width="1.6"/><circle cx="28" cy="22" r="14" fill="none" stroke="white" stroke-width="2.2"/><circle cx="28" cy="22" r="9" fill="rgba(255,255,255,0.12)" stroke="white" stroke-width="1.2"/><circle cx="28" cy="22" r="3.5" fill="white" opacity="0.7"/><ellipse cx="46" cy="10" rx="3.5" ry="5" fill="none" stroke="white" stroke-width="2"/><line x1="46" y1="15" x2="46" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>', Hotel:'🏨', Snack:'🍾', 'Bar Terrasse':'☀️' };
      var ic = typeIcons[_etabQorderState.etabType] || '🏠';
      avatarEl.textContent = ic;
    }
  }

  // Adapter la grille des types selon l'établissement
  var typeGrid = document.getElementById('etabQorderTypeGrid');
  if (typeGrid) {
    var types = [
      { key:'table_vip',    icon:'🛋️', label:'Table VIP' },
      { key:'soiree',       icon:'🎉', label:'Soirée privée' },
      { key:'anniversaire', icon:'🎂', label:'Anniversaire' },
      { key:'chambre',      icon:'🛏️', label:'Chambre / Suite', hotelOnly: true },
      { key:'repas',        icon:'🍽️', label:'Repas / Menu',    restoOnly: true },
    ];
    var html = '';
    types.forEach(function(t) {
      if (t.hotelOnly && !isHotel) return;
      if (t.restoOnly && !isResto && !isHotel) return;
      var isActive = t.key === 'table_vip';
      html += '<button class="etab-qorder-type-btn' + (isActive ? ' active' : '') + '" onclick="selectEtabQorderType(this,\'' + t.key + '\')">'
        + '<span class="ticon">' + t.icon + '</span>' + t.label + '</button>';
    });
    typeGrid.innerHTML = html;
  }

  // Pré-remplir le nom si connecté
  var nomEl = document.getElementById('etabQorderNom');
  if (nomEl && window.currentUserPseudo) nomEl.value = window.currentUserPseudo;

  // Date par défaut = aujourd'hui
  var dateEl = document.getElementById('etabQorderDate');
  if (dateEl) {
    var today = new Date();
    dateEl.value = today.toISOString().split('T')[0];
  }

  // Réinitialiser
  var bodyEl = document.getElementById('etabQorderBody');
  var sentEl = document.getElementById('etabQorderSent');
  if (bodyEl) bodyEl.style.display = 'block';
  if (sentEl) sentEl.classList.remove('show');

  document.getElementById('etabQorderOverlay').classList.add('open');
}

function closeEtabQorder() {
  document.getElementById('etabQorderOverlay').classList.remove('open');
}

function selectEtabQorderType(btn, type) {
  _etabQorderState.selectedType = type;
  var btns = document.querySelectorAll('.etab-qorder-type-btn');
  btns.forEach(function(b) { b.classList.remove('active'); });
  if (btn) btn.classList.add('active');
}

function sendEtabQorderWhatsApp() {
  var nom  = (document.getElementById('etabQorderNom')  || {}).value || '';
  var tel  = (document.getElementById('etabQorderTel')  || {}).value || '';
  var date = (document.getElementById('etabQorderDate') || {}).value || '';
  var nb   = (document.getElementById('etabQorderNb')   || {}).value || '2';
  var msg  = (document.getElementById('etabQorderMsg')  || {}).value || '';

  nom = nom.trim(); tel = tel.trim();
  if (!nom || !tel) { showToast('Nom et téléphone requis'); return; }

  // Token unique pour traçabilité (accept/refus)
  var token = 'AMBI' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
  _etabQorderState.token = token;

  // Deep-link tableau de bord de l'établissement (même logique que _buildDeepLink taxi)
  var base = window.AMBI241_APP_URL || window.location.href.split('?')[0];
  base = (base || '').replace(/\/$/, '');
  var cleanTel = (tel || '').replace(/\s|\+/g, '');

  var acceptUrl = base + '?etab_id=' + encodeURIComponent(_etabQorderState.etabId)
    + '&action=accept_resa&token=' + token + '&client=' + encodeURIComponent(nom);
  var refusUrl  = base + '?etab_id=' + encodeURIComponent(_etabQorderState.etabId)
    + '&action=refuse_resa&token=' + token + '&client=' + encodeURIComponent(nom);

  // Types labels
  var typeLabels = {
    table_vip:'🛋️ Table VIP', soiree:'🎉 Soirée privée',
    anniversaire:'🎂 Anniversaire', chambre:'🛏️ Chambre/Suite', repas:'🍽️ Repas/Menu'
  };
  var typeLabel = typeLabels[_etabQorderState.selectedType] || '⭐ Réservation VIP';

  // GPS client si disponible
  var gpsLine = '';
  if (window._taxiUserLat && window._taxiUserLng) {
    gpsLine = '\n📌 Position client : https://maps.google.com/?q='
      + window._taxiUserLat.toFixed(6) + ',' + window._taxiUserLng.toFixed(6);
  }

  // Message WhatsApp enrichi — adapté AMBI241 établissements
  var lines = [];
  lines.push('⭐ *AMBI241 — NOUVELLE RÉSERVATION*');
  lines.push('');
  lines.push('🏠 *' + _etabQorderState.etabNom + '*');
  lines.push(typeLabel);
  lines.push('━━━━━━━━━━━━━━━━');
  lines.push('👤 Client  : *' + nom + '*');
  lines.push('📞 Tél      : *' + tel + '*');
  if (date) lines.push('📅 Date     : *' + date + '*');
  lines.push('👥 Personnes: *' + nb + '*');
  if (msg)  lines.push('💬 Note     : ' + msg);
  if (gpsLine) lines.push(gpsLine);
  lines.push('━━━━━━━━━━━━━━━━');
  lines.push('🔖 Ref: ' + token);
  lines.push('');
  lines.push('✅ *ACCEPTER* → ' + acceptUrl);
  lines.push('❌ *REFUSER*  → ' + refusUrl);
  lines.push('');
  lines.push('_(Liens de réponse tableau de bord AMBI241)_');

  var waText = encodeURIComponent(lines.join('\n'));

  // Numéro destinataire : contact de l'établissement ou admin AMBI241
  var etabContact = (_etabQorderState.etabContact || '').replace(/\s|\+/g, '');
  var waNum = etabContact && etabContact.length >= 8 ? etabContact : '24174450924';
  var waUrl = 'https://wa.me/' + waNum + '?text=' + waText;

  // Enregistrement Firebase (même logique que taxi)
  if (window.db && window.fbAddDoc && window.fbCollection) {
    window.fbAddDoc(window.fbCollection(window.db, 'reservations'), {
      etablissementId: String(_etabQorderState.etabId),
      etablissementNom: _etabQorderState.etabNom,
      userId: window.currentUserUID || 'anonyme',
      userNom: nom, userTel: tel,
      nbPersonnes: parseInt(nb) || 2,
      typePlace: typeLabel,
      statut: 'en_attente',
      message: msg,
      date: date,
      token: token,
      channel: 'whatsapp_direct',
      timestamp: Date.now(),
      lu: false
    }).then(function() {
      try {
        pushNotif({ targetRole:'admin', key:'resa_wa_'+token, icon:'⭐',
          title:'Réservation WA — ' + _etabQorderState.etabNom,
          msg: nom + ' · ' + nb + ' pers · ' + tel,
          channel:'push', fromAdmin:false });
      } catch(e2) {}
    }).catch(function(){});
  }

  // Ouvrir WhatsApp
  window.open(waUrl, '_blank');

  // Afficher la confirmation
  var bodyEl = document.getElementById('etabQorderBody');
  var sentEl = document.getElementById('etabQorderSent');
  var tokEl  = document.getElementById('etabQorderToken');
  if (bodyEl) bodyEl.style.display = 'none';
  if (sentEl) sentEl.classList.add('show');
  if (tokEl)  tokEl.textContent = '🔖 Réf : ' + token;

  showToast('✅ Demande envoyée à ' + _etabQorderState.etabNom + ' !');
}

// ── Gestion de la réponse accept/refus depuis le dashboard ──────
// Si l'URL contient action=accept_resa ou action=refuse_resa,
// on affiche le résultat au propriétaire de l'établissement
(function() {
  var params = new URLSearchParams(window.location.search);
  var action = params.get('action');
  var token  = params.get('token');
  var client = params.get('client');
  var etabId = params.get('etab_id');

  if (!action || (action !== 'accept_resa' && action !== 'refuse_resa')) return;

  window.addEventListener('DOMContentLoaded', function() {
    setTimeout(function() {
      var isAccept = action === 'accept_resa';
      var icon  = isAccept ? '✅' : '❌';
      var title = isAccept ? 'Réservation ACCEPTÉE' : 'Réservation REFUSÉE';
      var color = isAccept ? 'var(--green)' : 'var(--red)';
      var msg   = isAccept
        ? 'La réservation de ' + decodeURIComponent(client||'ce client') + ' a été confirmée.\nUn WhatsApp de confirmation lui sera envoyé.'
        : 'La réservation de ' + decodeURIComponent(client||'ce client') + ' a été refusée.\nVous pouvez lui proposer une autre date.';

      // Mettre à jour le statut dans Firebase
      if (window.db && window.fbCollection && window.fbGetDocs && window.fbWhere && window.fbQuery) {
        var q = window.fbQuery(
          window.fbCollection(window.db, 'reservations'),
          window.fbWhere('token', '==', token)
        );
        window.fbGetDocs(q).then(function(snap) {
          snap.forEach(function(d) {
            window.fbUpdateDoc(window.fbDoc(window.db, 'reservations', d.id), {
              statut: isAccept ? 'confirmée' : 'refusée',
              reponduAt: Date.now(),
              lu: true
            }).catch(function(){});
          });
        }).catch(function(){});
      }

      // Notification visuelle (toast + alert stylé)
      showToast(icon + ' ' + title);
      setTimeout(function() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:10090;display:flex;align-items:center;justify-content:center;padding:1rem;';
        overlay.innerHTML = '<div style="background:var(--surface);border:2px solid '+color+';border-radius:22px;padding:2rem 1.5rem;width:min(380px,100%);text-align:center;">'
          + '<div style="font-size:3rem;margin-bottom:0.8rem;">'+icon+'</div>'
          + '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.1rem;color:'+color+';margin-bottom:0.5rem;">'+title+'</div>'
          + '<div style="font-size:0.82rem;color:var(--muted);line-height:1.6;white-space:pre-line;">'+msg+'</div>'
          + '<div style="margin-top:0.8rem;font-size:0.65rem;color:rgba(255,255,255,0.25);">Réf : '+token+'</div>'
          + '<button onclick="this.closest(\'div[style]\').remove();window.history.replaceState({},\'\',window.location.pathname);" style="margin-top:1.2rem;padding:0.65rem 2rem;border-radius:30px;border:1px solid '+color+';background:transparent;color:'+color+';font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;">Fermer</button>'
          + '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e) {
          if (e.target === overlay) {
            overlay.remove();
            window.history.replaceState({}, '', window.location.pathname);
          }
        });
      }, 600);
    }, 1200);
  });
})();

window.openEtabQorder   = openEtabQorder;
window.closeEtabQorder  = closeEtabQorder;
window.selectEtabQorderType = selectEtabQorderType;
window.sendEtabQorderWhatsApp = sendEtabQorderWhatsApp;

console.log("✅ Système Réservation Directe Établissements (WhatsApp Pro) chargé");