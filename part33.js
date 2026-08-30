
(function() {
'use strict';

/* ── État ── */
var _step = 0;

/* ── Log debug Android ── */
function aqaLog(msg, color) {
  var box = document.getElementById('aqaDebugBox');
  var log = document.getElementById('aqaDebugLog');
  if (!box || !log) return;
  box.style.display = 'block';
  var line = document.createElement('div');
  line.style.color = color || '#aaddff';
  var ts = new Date().toTimeString().slice(0,8);
  line.textContent = '[' + ts + '] ' + msg;
  log.appendChild(line);
  box.scrollTop = box.scrollHeight;
}
var _totalSteps = 6;
var _gpsLat = null;
var _gpsLng = null;
var _capVal = '';

/* ── Ouverture / fermeture ── */
window.openAqaModal = function() {
  if (typeof window.isAdmin === 'undefined' ? false : !window.isAdmin) {
    if (typeof window.showToast === 'function') window.showToast('Accès admin requis');
    return;
  }
  _step = 0;
  _gpsLat = null; _gpsLng = null; _capVal = '';
  aqaReset();
  aqaRenderStep();
  document.getElementById('aqaOverlay').classList.add('show');
};

window.closeAqaModal = function() {
  document.getElementById('aqaOverlay').classList.remove('show');
};

/* ── Reset champs ── */
function aqaReset() {
  ['aqaQuartier','aqaNom','aqaGerant','aqaTel','aqaEmail','aqaOuv','aqaFerm','aqaDesc','aqaMdp','aqaCapExact','aqaNbVip'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('aqaGpsCoords').textContent = 'Appuyez sur le bouton →';
  document.getElementById('aqaGpsBadge').innerHTML = '';
  // radios
  ['aqaCat1','aqaCat2','aqaCat3','aqaCat4','aqaCat5','aqaCat6','aqaCat7','aqaCat8','aqaCat9','aqaCat10','aqaCat11','aqaCat12',
   'aqaEsp1','aqaEsp2','aqaEsp3','aqaEsp4','aqaEsp5','aqaEsp6'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.checked = false;
  });
  // checkboxes son
  ['aqaSon1','aqaSon2','aqaSon3','aqaSon4','aqaSon5','aqaSon6','aqaSon7','aqaSon8'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.checked = false;
  });
  // photos
  ['aqaPhotoExt','aqaPhotoInt'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  ['aqaPreviewExt','aqaPreviewInt'].forEach(function(id) { var el = document.getElementById(id); if (el) { el.src=''; el.style.display='none'; }});
  ['aqaNameExt','aqaNameInt'].forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = id==='aqaNameExt'?'Aucune photo':'Aucune photo (optionnel)'; });
  // sliders
  var sl = document.getElementById('aqaVue'); if (sl) { sl.value = 5; document.getElementById('aqaVueVal').textContent = '5'; }
  // caps
  document.querySelectorAll('.aqa-cap-chip').forEach(function(c) { c.classList.remove('sel'); });
  _capVal = '';
  // status
  var msg = document.getElementById('aqaStatusMsg'); if (msg) { msg.className = 'aqa-status-msg'; msg.textContent = ''; }
  // statut select default
  var stat = document.getElementById('aqaStatut'); if (stat) stat.value = 'Ouvert - Anime';
}

/* ── Rendu du step courant ── */
function aqaRenderStep() {
  // Sections
  for (var i = 0; i < _totalSteps; i++) {
    var sec = document.getElementById('aqaStep' + i);
    if (sec) sec.classList.toggle('active', i === _step);
  }
  // Stepper
  document.querySelectorAll('.aqa-step').forEach(function(el, idx) {
    el.classList.remove('active','done');
    if (idx === _step) el.classList.add('active');
    else if (idx < _step) el.classList.add('done');
  });
  // Boutons nav
  var prevBtn = document.getElementById('aqaPrevBtn');
  var nextBtn = document.getElementById('aqaNextBtn');
  var subBtn  = document.getElementById('aqaSubmitBtn');
  prevBtn.style.display = _step > 0 ? '' : 'none';
  nextBtn.style.display = _step < _totalSteps - 1 ? '' : 'none';
  subBtn.style.display  = _step === _totalSteps - 1 ? '' : 'none';
  // Récap si dernière étape
  if (_step === _totalSteps - 1) aqaBuildRecap();
}

window.aqaGoStep = function(s) {
  if (s > _step) return; // ne peut avancer qu'avec le bouton Suivant
  _step = s;
  aqaRenderStep();
};

window.aqaNav = function(dir) {
  if (dir > 0) {
    if (!aqaValidateStep()) return;
  }
  _step = Math.max(0, Math.min(_totalSteps - 1, _step + dir));
  aqaRenderStep();
};

/* ── Validation par étape ── */
function aqaValidateStep() {
  if (_step === 0) {
    var q = (document.getElementById('aqaQuartier').value || '').trim();
    if (!q) { aqaShake('aqaQuartier'); showMsg('Veuillez indiquer le quartier / adresse.','err'); return false; }
    return true;
  }
  if (_step === 1) {
    var n = (document.getElementById('aqaNom').value || '').trim();
    if (!n) { aqaShake('aqaNom'); showMsg('Le nom est obligatoire.','err'); return false; }
    if (_step === 1) {
      var mdp = (document.getElementById('aqaMdp').value || '').trim();
      if (!mdp || mdp.length < 6) { aqaShake('aqaMdp'); showMsg('Le mot de passe est obligatoire (6 caractères min.).','err'); return false; }
    }
    return true;
  }
  if (_step === 2) {
    var cat = document.querySelector('input[name="aqaCat"]:checked');
    if (!cat) { showMsg('Veuillez sélectionner une catégorie.','err'); return false; }
    return true;
  }
  return true;
}

function aqaShake(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--red)';
  el.focus();
  setTimeout(function() { el.style.borderColor = ''; }, 1500);
}

function showMsg(txt, type) {
  // Toast rapide
  if (typeof window.showToast === 'function') window.showToast(txt);
}

/* ── GPS ── */
window.aqaGetGPS = function() {
  var coordEl = document.getElementById('aqaGpsCoords');
  var badgeEl = document.getElementById('aqaGpsBadge');
  coordEl.textContent = '⏳ Localisation en cours…';
  badgeEl.innerHTML = '';
  if (!navigator.geolocation) {
    coordEl.textContent = 'Géolocalisation non disponible';
    badgeEl.innerHTML = '<span class="aqa-gps-badge err">❌ Non supporté</span>';
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos) {
    _gpsLat = Math.round(pos.coords.latitude  * 1e6) / 1e6;
    _gpsLng = Math.round(pos.coords.longitude * 1e6) / 1e6;
    var acc = Math.round(pos.coords.accuracy);
    coordEl.textContent = _gpsLat + ', ' + _gpsLng;
    badgeEl.innerHTML = '<span class="aqa-gps-badge ok">✅ Précision ±' + acc + 'm</span>';
  }, function(err) {
    coordEl.textContent = 'Erreur : ' + err.message;
    badgeEl.innerHTML = '<span class="aqa-gps-badge err">❌ ' + err.message + '</span>';
  }, { enableHighAccuracy: true, timeout: 10000 });
};

/* ── Preview photo ── */
window.aqaPreviewPhoto = function(input, previewId, nameId) {
  var file = input.files && input.files[0];
  var prev = document.getElementById(previewId);
  var name = document.getElementById(nameId);
  if (!file) { if (prev) { prev.src=''; prev.style.display='none'; } if (name) name.textContent='Aucune photo'; return; }
  if (name) name.textContent = file.name.length > 30 ? file.name.substr(0,27)+'…' : file.name;
  var reader = new FileReader();
  reader.onload = function(e) { if (prev) { prev.src = e.target.result; prev.style.display = 'block'; } };
  reader.readAsDataURL(file);
};

/* ── Capacité chips ── */
window.aqaSelCap = function(el, val) {
  document.querySelectorAll('.aqa-cap-chip').forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
  _capVal = val;
};

/* ── Récapitulatif ── */
function aqaBuildRecap() {
  var cat = document.querySelector('input[name="aqaCat"]:checked');
  var esp = document.querySelector('input[name="aqaEspace"]:checked');
  var sons = Array.from(document.querySelectorAll('.aqa-amb-item:checked')).map(function(c) { return c.value; });
  var vue = document.getElementById('aqaVue') ? document.getElementById('aqaVue').value : '—';
  var extHas = document.getElementById('aqaPhotoExt') && document.getElementById('aqaPhotoExt').files && document.getElementById('aqaPhotoExt').files[0];
  var intHas = document.getElementById('aqaPhotoInt') && document.getElementById('aqaPhotoInt').files && document.getElementById('aqaPhotoInt').files[0];

  function row(icon, label, val) {
    if (!val) return '';
    return '<div style="display:flex;gap:0.5rem;align-items:baseline;border-bottom:1px solid rgba(255,255,255,0.04);padding:0.2rem 0;">'
      + '<span style="font-size:0.9rem;">' + icon + '</span>'
      + '<span style="color:var(--muted);font-size:0.7rem;min-width:90px;">' + label + '</span>'
      + '<span style="color:var(--text);font-weight:700;font-size:0.78rem;">' + val + '</span>'
      + '</div>';
  }
  var html = '';
  html += row('🏢', 'Nom', (document.getElementById('aqaNom')||{}).value);
  html += row('👤', 'Gérant', (document.getElementById('aqaGerant')||{}).value);
  html += row('📞', 'Téléphone', (document.getElementById('aqaTel')||{}).value);
  html += row('📧', 'Email', (document.getElementById('aqaEmail')||{}).value);
  html += row('🔑', 'Mot de passe', (document.getElementById('aqaMdp')||{}).value ? '••••••' : '—');
  html += row('📍', 'Quartier', (document.getElementById('aqaQuartier')||{}).value);
  html += row('🌐', 'GPS', _gpsLat ? _gpsLat + ', ' + _gpsLng : '<em style="color:var(--red)">Non capturé</em>');
  html += row('🏷️', 'Type', cat ? cat.value : '—');
  html += row('🕐', 'Horaires', ((document.getElementById('aqaOuv')||{}).value||'—') + ' → ' + ((document.getElementById('aqaFerm')||{}).value||'—'));
  html += row('👥', 'Capacité', _capVal || ((document.getElementById('aqaCapExact')||{}).value ? (document.getElementById('aqaCapExact').value + ' places') : '—'));
  html += row('🌅', 'Vue / Score', vue + ' / 10');
  html += row('🗺️', 'Situation', esp ? esp.value : '—');
  html += row('🔊', 'Ambiance sonore', sons.length ? sons.join(', ') : '—');
  html += row('📸', 'Photo extérieure', extHas ? '✅ ' + document.getElementById('aqaPhotoExt').files[0].name : '❌ Aucune');
  html += row('🏠', 'Photo intérieure', intHas ? '✅ ' + document.getElementById('aqaPhotoInt').files[0].name : '— optionnel');
  document.getElementById('aqaRecap').innerHTML = html;
}

/* ── Upload photo helper ── */
function aqaUploadPhoto(inputId, path) {
  return new Promise(function(resolve) {
    var inp = document.getElementById(inputId);
    var file = inp && inp.files && inp.files[0];
    if (!file) { resolve(''); return; }
    if (!window.fbRef || !window.fbStorage || !window.fbUploadBytes || !window.fbGetDownloadURL) {
      console.warn('[AQA] Firebase Storage non disponible pour', inputId);
      resolve(''); return;
    }
    // ⏱️ Timeout de sécurité : 30s max par photo pour éviter le blocage infini
    var _done = false;
    var _timeout = setTimeout(function() {
      if (!_done) { _done = true; console.warn('[AQA] Timeout upload photo:', inputId); aqaLog('⏱️ TIMEOUT upload ' + inputId, '#ff4466'); resolve(''); }
    }, 30000);
    function done(val) { if (!_done) { _done = true; clearTimeout(_timeout); resolve(val); } }

    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var maxDim = 900; var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { var r = Math.min(maxDim/w, maxDim/h); w=Math.round(w*r); h=Math.round(h*r); }
        var canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(function(blob) {
          // 🛡️ Guard : blob null possible si canvas tainté ou mémoire insuffisante
          if (!blob) { console.warn('[AQA] canvas.toBlob() a retourné null pour', inputId); done(''); return; }
          var ref = window.fbRef(window.fbStorage, path);
          window.fbUploadBytes(ref, blob)
            .then(function() { return window.fbGetDownloadURL(ref); })
            .then(function(url) { done(url); })
            .catch(function(err) { console.warn('[AQA] Erreur upload Storage:', err.message || err); aqaLog('❌ Storage err: ' + (err.message || err.code || err), '#ff4466'); done(''); });
        }, 'image/jpeg', 0.88);
      };
      img.onerror = function() { done(''); };
      img.src = ev.target.result;
    };
    reader.onerror = function() { done(''); };
    reader.readAsDataURL(file);
  });
}

/* ── Connexion Firebase depuis le modal AQA ── */
window.aqaDoSignIn = function() {
  var email = (document.getElementById('aqaAuthEmail').value || '').trim();
  var pwd   = (document.getElementById('aqaAuthPwd').value  || '');
  var msgEl = document.getElementById('aqaAuthMsg');
  var btn   = document.getElementById('aqaAuthBtn');

  if (!email || !pwd) {
    msgEl.textContent = '⚠️ Remplissez email et mot de passe.'; return;
  }
  if (!window.fbSignIn || !window.auth) {
    msgEl.textContent = '❌ Firebase Auth non disponible. Rechargez la page.'; return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Connexion…';
  msgEl.style.color = 'var(--muted)';
  msgEl.textContent = 'Connexion en cours…';

  window.fbSignIn(window.auth, email, pwd).then(function() {
    msgEl.style.color = 'var(--green)';
    msgEl.textContent = '✅ Connecté ! Envoi en cours…';
    btn.textContent = '✅ Connecté';
    document.getElementById('aqaAuthBox').style.display = 'none';
    // Relancer la soumission maintenant que l'auth est OK
    setTimeout(function() { window.aqaSubmit(); }, 400);
  }).catch(function(err) {
    btn.disabled = false;
    btn.textContent = '🔑 Se connecter et créer l\'établissement';
    msgEl.style.color = 'var(--red)';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msgEl.textContent = '❌ Email ou mot de passe incorrect.';
    } else if (err.code === 'auth/too-many-requests') {
      msgEl.textContent = '🚫 Trop de tentatives. Réessayez dans quelques minutes.';
    } else {
      msgEl.textContent = '❌ Erreur : ' + (err.message || err.code);
    }
  });
};

/* ── Soumission Firebase ── */
window.aqaSubmit = function() {
  var nom = (document.getElementById('aqaNom').value || '').trim();
  var quartier = (document.getElementById('aqaQuartier').value || '').trim();
  var cat = document.querySelector('input[name="aqaCat"]:checked');

  if (!nom || !quartier || !cat) {
    var msgEl = document.getElementById('aqaStatusMsg');
    msgEl.className = 'aqa-status-msg err';
    msgEl.textContent = '❌ Données incomplètes — vérifiez nom, quartier et catégorie.';
    return;
  }

  if (!window.fbDoc || !window.db || !window.fbSetDoc) {
    var msgEl2 = document.getElementById('aqaStatusMsg');
    msgEl2.className = 'aqa-status-msg err';
    msgEl2.textContent = '❌ Firebase non disponible. Vérifiez votre connexion.';
    return;
  }

  // ── Vérification Firebase Auth ──
  // Le mode Admin PIN est local. Firestore/Storage exigent un utilisateur authentifié.
  if (!window.auth || !window.auth.currentUser) {
    var msgElAuth = document.getElementById('aqaStatusMsg');
    msgElAuth.className = 'aqa-status-msg err';
    msgElAuth.textContent = '⚠️ Connexion Firebase requise (mode Admin PIN détecté sans session Firebase).';
    var authBox = document.getElementById('aqaAuthBox');
    if (authBox) {
      authBox.style.display = 'block';
      var authMsgEl = document.getElementById('aqaAuthMsg');
      if (authMsgEl) { authMsgEl.style.color = 'var(--muted)'; authMsgEl.textContent = ''; }
    }
    aqaLog('⚠️ Non authentifié Firebase — formulaire de connexion affiché', '#ffaa00');
    return;
  }

  var subBtn = document.getElementById('aqaSubmitBtn');
  var prevBtn = document.getElementById('aqaPrevBtn');
  subBtn.disabled = true; prevBtn.disabled = true;
  subBtn.textContent = '⏳ Envoi en cours…';

  var msgEl3 = document.getElementById('aqaStatusMsg');
  msgEl3.className = 'aqa-status-msg loading';
  msgEl3.textContent = '⏳ Upload des photos et enregistrement…';

  // Reset debug log
  var dbgLog = document.getElementById('aqaDebugLog');
  if (dbgLog) dbgLog.innerHTML = '';
  aqaLog('Démarrage envoi…', '#00e5ff');
  aqaLog('Firebase db: ' + (window.db ? '✅' : '❌'), window.db ? '#00ffaa' : '#ff4466');
  aqaLog('Firebase storage: ' + (window.fbStorage ? '✅' : '❌'), window.fbStorage ? '#00ffaa' : '#ff4466');

  // Générer ID
  var maxId = (window.etablissements || []).reduce(function(m, e) { return Math.max(m, e.id || 0); }, 0);
  var newId = maxId + 1;
  var docId = 'etab_' + String(newId).padStart(3, '0');
  aqaLog('ID généré: ' + docId, '#ffd700');

  // Collect data
  var esp  = document.querySelector('input[name="aqaEspace"]:checked');
  var sons = Array.from(document.querySelectorAll('.aqa-amb-item:checked')).map(function(c) { return c.value; });
  var vue  = parseInt((document.getElementById('aqaVue') || {}).value) || 5;
  var capExact = parseInt((document.getElementById('aqaCapExact') || {}).value) || 0;
  var nbVip = parseInt((document.getElementById('aqaNbVip') || {}).value) || 0;

  aqaLog('Upload photos en cours…', '#00e5ff');
  var _extHas = document.getElementById('aqaPhotoExt') && document.getElementById('aqaPhotoExt').files && document.getElementById('aqaPhotoExt').files[0];
  var _intHas = document.getElementById('aqaPhotoInt') && document.getElementById('aqaPhotoInt').files && document.getElementById('aqaPhotoInt').files[0];
  aqaLog('Photo ext: ' + (_extHas ? '📷 ' + document.getElementById('aqaPhotoExt').files[0].name : 'aucune'));
  aqaLog('Photo int: ' + (_intHas ? '📷 ' + document.getElementById('aqaPhotoInt').files[0].name : 'aucune'));

  Promise.all([
    aqaUploadPhoto('aqaPhotoExt', 'etablissements/' + docId + '/photo_exterieur.jpg'),
    aqaUploadPhoto('aqaPhotoInt', 'etablissements/' + docId + '/photo_interieur.jpg')
  ]).then(function(urls) {
    aqaLog('Photos OK → ext:' + (urls[0] ? '✅' : '⚠️ vide') + ' int:' + (urls[1] ? '✅' : '⚠️ vide'), '#00ffaa');
    aqaLog('Écriture Firestore…', '#00e5ff');

    var now = new Date().toISOString();
    var data = {
      id: newId,
      nom: nom,
      type: cat.value,
      quartier: quartier,
      gerant: (document.getElementById('aqaGerant').value || '').trim(),
      contact: (document.getElementById('aqaTel').value || '').trim(),
      email: (document.getElementById('aqaEmail').value || '').trim(),
      ouverture: (document.getElementById('aqaOuv').value || '').trim() || '18h00',
      fermeture: (document.getElementById('aqaFerm').value || '').trim() || '02h00',
      description: (document.getElementById('aqaDesc').value || '').trim(),
      statut: (document.getElementById('aqaStatut').value) || 'Ouvert - Anime',
      affluence: 50,
      note: 0,
      avis: 0,
      paiement: 'Actif (Admin)',
      ambiance: 'Festif',
      // Géolocalisation
      lat: _gpsLat,
      lng: _gpsLng,
      geolocalisé: !!_gpsLat,
      // Photos
      photo_exterieur: urls[0] || '',
      photo_interieur: urls[1] || '',
      // Capacité
      capacite_tranche: _capVal || '',
      capacite_totale: capExact,
      nb_vip: nbVip,
      // Originalité
      score_vue: vue,
      situation_geo: esp ? esp.value : '',
      ambiance_sonore: sons,
      // Méta
      created_at: now,
      created_by: 'admin_quick_add',
      password: (document.getElementById('aqaMdp') ? (document.getElementById('aqaMdp').value || '').trim() : ''),
      maps_url: _gpsLat ? 'https://maps.google.com/?q=' + _gpsLat + ',' + _gpsLng : '',
      affluence_tendance: 'Stable',
      places_dispo: 0
    };

    var docRef = window.fbDoc(window.db, 'etablissements', docId);
    return window.fbSetDoc(docRef, data);

  }).then(function() {
    aqaLog('✅ Firestore écrit avec succès !', '#00ffaa');
    msgEl3.className = 'aqa-status-msg ok';
    msgEl3.textContent = '✅ Établissement créé avec succès dans Firebase !';
    subBtn.textContent = '✅ Créé !';
    if (typeof window.loadData === 'function') window.loadData();
    setTimeout(function() { window.closeAqaModal(); }, 2200);

  }).catch(function(err) {
    console.error('[AQA] Erreur aqaSubmit:', err);
    aqaLog('❌ ERREUR: ' + (err && (err.message || err.code) ? (err.message || err.code) : JSON.stringify(err)), '#ff4466');
    msgEl3.className = 'aqa-status-msg err';
    msgEl3.textContent = '❌ Erreur : ' + (err && (err.message || err.code) ? (err.message || err.code) : JSON.stringify(err));
    subBtn.disabled = false; prevBtn.disabled = false;
    subBtn.textContent = '⚡ Créer l\'établissement';
  });
};

/* ── Afficher le bouton FAB uniquement quand admin connecté ── */
function aqaCheckAdminBtn() {
  var btn = document.getElementById('adminQuickAddBtn');
  if (!btn) return;
  // Visible uniquement sur l'onglet home (nav index 0) ET si isAdmin
  var isAdm = typeof window.isAdmin !== 'undefined' ? window.isAdmin : false;
  btn.style.display = isAdm ? 'flex' : 'none';
}

// PERF: _aqaInterval corrigé — s'arrête dès Firebase prêt, max 30s au lieu de 60s
var _aqaInterval = setInterval(function() {
  aqaCheckAdminBtn();
  if (typeof window.currentUserUID !== 'undefined' && window.currentUserUID) {
    clearInterval(_aqaInterval); // arrêt immédiat dès que Firebase est prêt
  }
}, 1200);
// Sécurité : arrêt forcé après 30s quoi qu'il arrive
setTimeout(function() { clearInterval(_aqaInterval); }, 30000);

// Exposer globalement pour appel depuis les handlers PIN/toggleAdmin
window.aqaCheckAdminBtn = aqaCheckAdminBtn;

// Vérification initiale
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(aqaCheckAdminBtn, 2000);
});

// Permettre au bouton existant dans adminTabs de pointer vers le nouveau modal
window.openAdminAddModal = window.openAqaModal;
})();
