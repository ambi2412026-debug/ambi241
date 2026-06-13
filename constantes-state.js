
(function () {
'use strict';

/* ────────────────────────────────────────────────────────────
   CONSTANTES & STATE
──────────────────────────────────────────────────────────── */
var QR_BASE_URL       = window.location.origin + window.location.pathname;
var _qrCurrentEtabId  = null;
var _qrCurrentEtabObj = null;
var _qrVoteCache      = {};
var _qrAdminTimer     = null;
var _qrRecentVotes    = [];

/* ────────────────────────────────────────────────────────────
   HELPERS — rôle utilisateur
──────────────────────────────────────────────────────────── */
function qrIsGuest()  { return !window.currentUserUID; }
function qrIsAdmin()  { return !!(window.isAdmin); }
function qrIsOwnerOf(etabId) {
  /* L'établissement appartient à l'utilisateur connecté si son email
     correspond à etab.email ou si etab.ownerUID === currentUserUID */
  var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(etabId); });
  if (!etab) return false;
  var uid   = window.currentUserUID;
  var email = (window.currentUserEmail || '').toLowerCase();
  if (uid   && etab.ownerUID && etab.ownerUID === uid)   return true;
  if (email && etab.email    && etab.email.toLowerCase() === email) return true;
  return false;
}

/* Clé localStorage pour éviter le double-vote (membres) */
function qrMonthVoteKey(etabId) {
  var mois = new Date().toISOString().slice(0, 7);
  return 'ambi241_qrvote_' + etabId + '_' + (window.currentUserUID || 'anon') + '_' + mois;
}
function qrHasVotedThisMonth(etabId) {
  try { return !!localStorage.getItem(qrMonthVoteKey(etabId)); } catch(e){ return false; }
}
function qrMarkVotedThisMonth(etabId) {
  try { localStorage.setItem(qrMonthVoteKey(etabId), '1'); } catch(e){}
}

/* Clé localStorage pour vote propriétaire */
function qrOwnerVoteKey(etabId) {
  var mois = new Date().toISOString().slice(0, 7);
  return 'ambi241_ownervote_' + etabId + '_' + mois;
}

/* ────────────────────────────────────────────────────────────
   1. LANDING PAGE (URL ?ambi_vote=XXX)
──────────────────────────────────────────────────────────── */
function qrCheckLandingMode() {
  var etabId = new URLSearchParams(window.location.search).get('ambi_vote');
  if (etabId) qrShowScanLanding(etabId);
}

function qrShowScanLanding(etabId) {
  var landing = document.getElementById('ambiQrScanLanding');
  if (!landing) return;
  landing.classList.add('show');
  document.body.style.overflow = 'hidden';
  var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(etabId); });
  if (etab) qrPopulateLandingCard(etab);
  else {
    setTimeout(function() {
      var e2 = (window.etablissements || []).find(function(e){ return String(e.id) === String(etabId); });
      if (e2) qrPopulateLandingCard(e2);
      else {
        var nameEl = document.getElementById('qrLandingEtabName');
        if (nameEl) nameEl.textContent = 'Établissement #' + etabId;
        qrShowLandingSections(etabId);
      }
    }, 2500);
  }
}

function qrPopulateLandingCard(etab) {
  var icons = {'Bar':'🍻','Restaurant':'🍽️','Nightclub':'🎶','Maquis':'🌴','Hôtel':'🏨','Café':'☕'};
  var av = document.getElementById('qrLandingEtabAvatar');
  var nm = document.getElementById('qrLandingEtabName');
  var ty = document.getElementById('qrLandingEtabType');
  if (av) av.textContent = icons[etab.type] || '🏠';
  if (nm) nm.textContent = etab.nom || 'Établissement';
  if (ty) ty.textContent = (etab.type || '') + (etab.quartier ? ' • ' + etab.quartier : '');
  qrShowLandingSections(etab.id);
}

function qrShowLandingSections(etabId) {
  window._qrLandingEtabId = etabId;
  var memberSec = document.getElementById('qrLandingMemberSection');
  var guestSec  = document.getElementById('qrLandingGuestSection');
  var signupCta = document.getElementById('qrLandingSignupCta');
  var isMember  = !qrIsGuest();
  /* Visiteur : redirige directement vers l'inscription */
  if (!isMember) {
    if (guestSec)  guestSec.style.display  = 'block';
    if (memberSec) memberSec.style.display = 'none';
    if (signupCta) signupCta.style.display = 'block';
  } else {
    if (guestSec)  guestSec.style.display  = 'none';
    if (memberSec) memberSec.style.display = 'block';
    if (signupCta) signupCta.style.display = 'none';
    /* Vérifier si déjà voté ce mois */
    if (qrHasVotedThisMonth(etabId)) {
      var btns = document.querySelector('#qrLandingMemberSection .qr-landing-vote-btns');
      var done = document.getElementById('qrLandingVoteConfirm');
      if (btns) btns.style.display = 'none';
      if (done) { done.style.display = 'block'; done.querySelector && (done.querySelector('.qr-vote-confirm-title').textContent = '✅ Vous avez déjà voté ce mois'); }
    }
  }
}

window.ambiQrCastVoteLanding = function(direction) {
  var etabId = window._qrLandingEtabId;
  if (!etabId) return;
  /* Visiteur non inscrit → inscription */
  if (qrIsGuest()) { ambiQrGoToSignup(); return; }
  /* Déjà voté ce mois */
  if (qrHasVotedThisMonth(etabId)) {
    if (typeof showToast === 'function') showToast('✅ Vous avez déjà voté ce mois pour cet établissement');
    return;
  }
  qrRecordVote(etabId, direction, function(ok) {
    var confirm = document.getElementById('qrLandingVoteConfirm');
    var btns    = document.querySelector('#qrLandingMemberSection .qr-landing-vote-btns');
    if (confirm) confirm.style.display = 'block';
    if (btns)    btns.style.display    = 'none';
    if (ok) { qrNotifyEtablissement(etabId, direction); qrNotifyAdmin(etabId, direction); }
  });
};

window.ambiQrCloseLanding = function() {
  var landing = document.getElementById('ambiQrScanLanding');
  if (landing) landing.classList.remove('show');
  document.body.style.overflow = '';
  var url = new URL(window.location.href);
  url.searchParams.delete('ambi_vote');
  history.replaceState({}, '', url.toString());
};

window.ambiQrGoToSignup = function() {
  if (typeof ambiQrCloseLanding === 'function') ambiQrCloseLanding();
  if (typeof ambiQrCloseModal === 'function') ambiQrCloseModal();
  var btn = document.querySelector('[onclick*="openLogin"],[onclick*="showLogin"],#loginBtn,.auth-login-btn,[onclick*="signup"],[onclick*="register"]');
  if (btn) setTimeout(function(){ btn.click(); }, 300);
  else if (typeof showToast === 'function') showToast('🔐 Inscrivez-vous pour voter !');
};

/* ────────────────────────────────────────────────────────────
   2. OUVERTURE MODAL — logique conditionnelle selon rôle
──────────────────────────────────────────────────────────── */
function qrGetVoteUrl(etabId) {
  return QR_BASE_URL + '?ambi_vote=' + etabId;
}

window.ambiQrOpenModal = function(etabId) {
  var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(etabId); });
  if (!etab) { if (typeof showToast === 'function') showToast('Établissement introuvable'); return; }

  _qrCurrentEtabId  = etabId;
  _qrCurrentEtabObj = etab;

  var modal = document.getElementById('ambiQrModal');
  if (!modal) return;

  /* Remplir infos établissement */
  var icons = {'Bar':'🍻','Restaurant':'🍽️','Nightclub':'🎶','Maquis':'🌴','Hôtel':'🏨','Café':'☕'};
  document.getElementById('qrModalEtabName').textContent = etab.nom || 'Établissement';
  document.getElementById('qrModalEtabType').textContent =
    (icons[etab.type] || '🏠') + '  ' + (etab.type || '') + (etab.quartier ? '  •  📍 ' + etab.quartier : '');

  var voteUrl = qrGetVoteUrl(etabId);
  var linkEl  = document.getElementById('qrModalLink');
  if (linkEl) linkEl.textContent = voteUrl;

  /* Charger le compteur de votes */
  qrLoadVoteCount(etabId, function(data) {
    var el = document.getElementById('qrModalVoteNum');
    if (el) el.textContent = data.total || 0;
    /* Stats propriétaire */
    var stT = document.getElementById('ownerStatTotal');
    var stP = document.getElementById('ownerStatPos');
    var stN = document.getElementById('ownerStatNeg');
    if (stT) stT.textContent = data.total || 0;
    if (stP) stP.textContent = data.pos   || 0;
    if (stN) stN.textContent = data.neg   || 0;
  });

  /* Position classement */
  qrGetRankingPosition(etabId, function(pos) {
    var badge = document.getElementById('qrModalRankingBadge');
    var posEl = document.getElementById('qrModalRankPos');
    if (badge && posEl && pos) {
      posEl.textContent = '#' + pos;
      badge.style.display = 'inline-flex';
    }
  });

  /* Afficher la bonne section selon le rôle */
  qrShowModalSection(etabId);

  /* Générer le QR code */
  qrGenerateCode(voteUrl);

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
};

function qrShowModalSection(etabId) {
  var secGuest  = document.getElementById('qrSectionGuest');
  var secMember = document.getElementById('qrSectionMember');
  var secOwner  = document.getElementById('qrSectionOwner');
  var linkRow   = document.getElementById('qrLinkRow');

  /* Cacher tout */
  [secGuest, secMember, secOwner].forEach(function(el){ if(el) el.style.display = 'none'; });
  if (linkRow) linkRow.style.display = 'none';

  var isOwner = qrIsOwnerOf(etabId);
  var isAdmin = qrIsAdmin();
  var isGuest = qrIsGuest();

  if (isGuest) {
    /* ── Visiteur : uniquement le mur d'inscription ── */
    if (secGuest) secGuest.style.display = 'block';

  } else if (isOwner || isAdmin) {
    /* ── Propriétaire ou Admin : outils complets ── */
    if (secOwner) secOwner.style.display = 'block';
    if (linkRow)  linkRow.style.display  = 'flex';

    /* Vérifier vote propriétaire ce mois */
    var ownerBtn  = document.getElementById('ownerSelfVoteBtn');
    var ownerDone = document.getElementById('ownerSelfVoteDone');
    var alreadyOwner = !!localStorage.getItem(qrOwnerVoteKey(etabId));
    if (ownerBtn)  ownerBtn.style.display  = alreadyOwner ? 'none' : 'flex';
    if (ownerDone) ownerDone.style.display = alreadyOwner ? 'block' : 'none';

    /* Reset boutons de test vote */
    var posB = document.getElementById('qrOwnerVotePosBtn');
    var negB = document.getElementById('qrOwnerVoteNegBtn');
    if (posB) { posB.disabled = false; posB.classList.remove('qr-voted'); }
    if (negB) { negB.disabled = false; negB.classList.remove('qr-voted'); }

  } else {
    /* ── Membre inscrit : vote unique par mois ── */
    if (secMember) secMember.style.display = 'block';

    var voteDone    = document.getElementById('qrMemberVoteArea');
    var alreadyMsg  = document.getElementById('qrMemberAlreadyVoted');
    var confirm     = document.getElementById('qrModalVoteConfirm');
    var posBtn      = document.getElementById('qrModalVotePosBtn');
    var negBtn      = document.getElementById('qrModalVoteNegBtn');

    if (confirm) confirm.classList.remove('show');

    if (qrHasVotedThisMonth(etabId)) {
      /* Déjà voté ce mois */
      if (voteDone)   voteDone.style.display  = 'none';
      if (alreadyMsg) alreadyMsg.style.display = 'block';
    } else {
      if (voteDone)   voteDone.style.display  = 'block';
      if (alreadyMsg) alreadyMsg.style.display = 'none';
      if (posBtn) { posBtn.disabled = false; posBtn.classList.remove('qr-voted'); }
      if (negBtn) { negBtn.disabled = false; negBtn.classList.remove('qr-voted'); }
    }
  }
}

window.ambiQrCloseModal = function() {
  var modal = document.getElementById('ambiQrModal');
  if (modal) modal.classList.remove('open');
  document.body.style.overflow = '';
  _qrCurrentEtabId  = null;
  _qrCurrentEtabObj = null;
};

/* ────────────────────────────────────────────────────────────
   3. GÉNÉRATION QR CODE
──────────────────────────────────────────────────────────── */
function qrGenerateCode(url) {
  var container = document.getElementById('qrModalCanvas');
  if (!container) return;
  container.innerHTML = '';
  function tryGenerate() {
    if (typeof QRCode === 'undefined') { setTimeout(tryGenerate, 200); return; }
    try {
      new QRCode(container, {
        text: url, width: 220, height: 220,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
      });
    } catch(e) {
      container.innerHTML = '<div style="font-size:0.7rem;color:#ff4466;padding:0.5rem;">Erreur génération QR</div>';
    }
  }
  tryGenerate();
}

/* ────────────────────────────────────────────────────────────
   4. VOTE INLINE — membres (une seule fois par mois)
──────────────────────────────────────────────────────────── */
window.ambiQrCastVoteInline = function(direction, isOwnerTest) {
  if (!_qrCurrentEtabId) return;
  if (qrIsGuest()) { ambiQrGoToSignup(); return; }

  var etabId = _qrCurrentEtabId;

  /* Pour les membres normaux : vérifier vote ce mois */
  if (!isOwnerTest && !qrIsOwnerOf(etabId) && !qrIsAdmin()) {
    if (qrHasVotedThisMonth(etabId)) {
      if (typeof showToast === 'function') showToast('✅ Vous avez déjà voté ce mois !');
      return;
    }
  }

  /* Désactiver boutons */
  var posBtn = isOwnerTest ? document.getElementById('qrOwnerVotePosBtn') : document.getElementById('qrModalVotePosBtn');
  var negBtn = isOwnerTest ? document.getElementById('qrOwnerVoteNegBtn') : document.getElementById('qrModalVoteNegBtn');
  if (posBtn) posBtn.disabled = true;
  if (negBtn) negBtn.disabled = true;

  qrRecordVote(etabId, direction, function(ok) {
    if (!isOwnerTest) {
      /* Afficher confirmation pour membre normal */
      var confirm = document.getElementById('qrModalVoteConfirm');
      var msgEl   = document.getElementById('qrModalVoteConfirmMsg');
      if (confirm) confirm.classList.add('show');
      if (msgEl) msgEl.textContent = ok
        ? '✅ Vote comptabilisé ! Merci pour votre participation.'
        : '⚠️ Vous avez déjà voté pour cet établissement ce mois-ci.';
      /* Basculer vers "déjà voté" */
      if (ok) {
        var area = document.getElementById('qrMemberVoteArea');
        var done = document.getElementById('qrMemberAlreadyVoted');
        setTimeout(function() {
          if (area) area.style.display = 'none';
          if (done) done.style.display = 'block';
        }, 2000);
      }
    } else {
      /* Test vote propriétaire */
      if (typeof showToast === 'function') showToast(ok ? '✅ Vote test enregistré !' : '⚠️ Vote déjà fait ce mois.');
      setTimeout(function() {
        if (posBtn) posBtn.disabled = false;
        if (negBtn) negBtn.disabled = false;
      }, 2000);
    }

    if (ok) {
      qrLoadVoteCount(etabId, function(data) {
        var el = document.getElementById('qrModalVoteNum');
        if (el) el.textContent = data.total || 0;
        var stT = document.getElementById('ownerStatTotal');
        var stP = document.getElementById('ownerStatPos');
        var stN = document.getElementById('ownerStatNeg');
        if (stT) stT.textContent = data.total || 0;
        if (stP) stP.textContent = data.pos   || 0;
        if (stN) stN.textContent = data.neg   || 0;
      });
      qrNotifyEtablissement(etabId, direction);
      qrNotifyAdmin(etabId, direction);
      /* Déclencher recalcul classement public */
      setTimeout(function() { qrUpdatePublicRanking(); }, 500);
    }
  });
};

/* ────────────────────────────────────────────────────────────
   5. VOTE PROPRIÉTAIRE (pour son propre établissement)
──────────────────────────────────────────────────────────── */
window.ambiQrOwnerSelfVote = function() {
  if (!_qrCurrentEtabId) return;
  var etabId = _qrCurrentEtabId;
  var moisKey = qrOwnerVoteKey(etabId);
  if (localStorage.getItem(moisKey)) {
    if (typeof showToast === 'function') showToast('✅ Vote propriétaire déjà enregistré ce mois');
    return;
  }
  localStorage.setItem(moisKey, '1');

  var voteData = {
    etabId: String(etabId),
    direction: 'pos',
    uid: window.currentUserUID || 'owner',
    pseudo: (window.currentUserPseudo || window.currentUserEmail || 'Propriétaire') + ' [propriétaire]',
    ts: Date.now(),
    source: 'owner_self_vote',
    monthKey: new Date().toISOString().slice(0, 7),
    isOwnerVote: true
  };

  if (window.db && window.fbAddDoc && window.fbCollection) {
    window.fbAddDoc(window.fbCollection(window.db, 'qr_votes'), voteData)
      .then(function() { return qrIncrementEtabVoteCount(etabId, 'pos'); })
      .catch(function(err) { console.warn('[QR] Owner vote error:', err); });
  }

  var ownerBtn  = document.getElementById('ownerSelfVoteBtn');
  var ownerDone = document.getElementById('ownerSelfVoteDone');
  if (ownerBtn)  ownerBtn.style.display  = 'none';
  if (ownerDone) ownerDone.style.display = 'block';

  qrLoadVoteCount(etabId, function(data) {
    var el  = document.getElementById('qrModalVoteNum');
    var stT = document.getElementById('ownerStatTotal');
    var stP = document.getElementById('ownerStatPos');
    if (el)  el.textContent  = data.total || 0;
    if (stT) stT.textContent = data.total || 0;
    if (stP) stP.textContent = data.pos   || 0;
  });

  if (typeof showToast === 'function') showToast('⭐ Vote propriétaire enregistré !');
  setTimeout(function() { qrUpdatePublicRanking(); }, 500);
};

/* ────────────────────────────────────────────────────────────
   6. ENREGISTREMENT VOTE FIREBASE
──────────────────────────────────────────────────────────── */
function qrRecordVote(etabId, direction, callback) {
  var monthKey = new Date().toISOString().slice(0, 7);
  /* Anti-doublon localStorage pour membres normaux */
  var isOwner = qrIsOwnerOf(etabId) || qrIsAdmin();
  if (!isOwner) {
    var voteKey = 'ambi241_qrvote_' + etabId + '_' + (window.currentUserUID || 'anon') + '_' + monthKey;
    try {
      if (localStorage.getItem(voteKey)) { callback(false); return; }
      localStorage.setItem(voteKey, '1');
    } catch(e) {}
  }

  var voteData = {
    etabId    : String(etabId),
    direction : direction,
    uid       : window.currentUserUID || 'anon',
    pseudo    : window.currentUserPseudo || window.currentUserEmail || 'Anonyme',
    ts        : Date.now(),
    source    : 'qr_code',
    monthKey  : monthKey
  };

  if (window.db && window.fbAddDoc && window.fbCollection) {
    window.fbAddDoc(window.fbCollection(window.db, 'qr_votes'), voteData)
      .then(function() { return qrIncrementEtabVoteCount(etabId, direction); })
      .catch(function(err) { console.warn('[QR] Firebase vote error:', err); });
  }

  /* Cache local */
  if (!_qrVoteCache[etabId]) _qrVoteCache[etabId] = { total: 0, pos: 0, neg: 0 };
  _qrVoteCache[etabId].total++;
  _qrVoteCache[etabId][direction] = (_qrVoteCache[etabId][direction] || 0) + 1;
  _qrVoteCache[etabId].myVote = direction;

  /* Ajouter aux votes récents (dashboard admin) */
  _qrRecentVotes.unshift({ etabId: etabId, direction: direction, ts: Date.now(), uid: voteData.pseudo });
  if (_qrRecentVotes.length > 20) _qrRecentVotes.pop();
  qrRenderRecentVotes();

  callback(true);
}

function qrIncrementEtabVoteCount(etabId, direction) {
  if (!window.db || !window.fbDoc || !window.fbGetDoc || !window.fbSetDoc) return;
  var docRef = window.fbDoc(window.db, 'qr_vote_counts', String(etabId));
  return window.fbGetDoc(docRef).then(function(snap) {
    var d = snap.exists() ? snap.data() : { pos: 0, neg: 0, total: 0 };
    d[direction] = (d[direction] || 0) + 1;
    d.total      = (d.total || 0) + 1;
    d.lastUpdated = Date.now();
    return window.fbSetDoc(docRef, d);
  }).catch(function(e) { console.warn('[QR] increment error:', e); });
}

function qrLoadVoteCount(etabId, callback) {
  /* Cache court terme */
  if (_qrVoteCache[etabId] && _qrVoteCache[etabId]._loaded) {
    callback(_qrVoteCache[etabId]);
    return;
  }
  if (window.db && window.fbDoc && window.fbGetDoc) {
    window.fbGetDoc(window.fbDoc(window.db, 'qr_vote_counts', String(etabId)))
      .then(function(snap) {
        var d = snap.exists() ? snap.data() : { total: 0, pos: 0, neg: 0 };
        _qrVoteCache[etabId] = { total: d.total || 0, pos: d.pos || 0, neg: d.neg || 0, _loaded: true };
        callback(_qrVoteCache[etabId]);
      }).catch(function() { callback({ total: 0, pos: 0, neg: 0 }); });
  } else { callback({ total: 0, pos: 0, neg: 0 }); }
}

/* ────────────────────────────────────────────────────────────
   7. CLASSEMENT PUBLIC — mise à jour basée sur votes QR
──────────────────────────────────────────────────────────── */
function qrUpdatePublicRanking() {
  /* Recalcule le score d'affluence de chaque établissement
     en intégrant les votes QR comme facteur de classement */
  if (!window.db || !window.fbGetDocs || !window.fbCollection) return;
  window.fbGetDocs(window.fbCollection(window.db, 'qr_vote_counts'))
    .then(function(snap) {
      var scores = {};
      snap.forEach(function(doc) {
        var d = doc.data();
        /* Score = votes positifs × 2 + votes négatifs × 0.5 */
        scores[doc.id] = (d.pos || 0) * 2 - (d.neg || 0) * 0.5;
      });
      /* Mettre à jour le score QR dans la collection etablissements si possible */
      if (window.fbDoc && window.fbSetDoc) {
        Object.keys(scores).forEach(function(etabId) {
          var ref = window.fbDoc(window.db, 'qr_ranking_scores', String(etabId));
          window.fbSetDoc(ref, { score: scores[etabId], updatedAt: Date.now() }).catch(function(){});
        });
      }
      /* Déclencher un re-render du classement si la fonction existe */
      if (typeof window.renderAll === 'function') {
        try { window.renderAll(); } catch(e){}
      }
    }).catch(function(){});
}

function qrGetRankingPosition(etabId, callback) {
  if (!window.db || !window.fbGetDocs || !window.fbCollection) { callback(null); return; }
  window.fbGetDocs(window.fbCollection(window.db, 'qr_vote_counts'))
    .then(function(snap) {
      var list = [];
      snap.forEach(function(doc) { list.push({ id: doc.id, total: doc.data().total || 0 }); });
      list.sort(function(a, b) { return b.total - a.total; });
      var pos = list.findIndex(function(x) { return String(x.id) === String(etabId); });
      callback(pos >= 0 ? pos + 1 : null);
    }).catch(function() { callback(null); });
}

/* ────────────────────────────────────────────────────────────
   8. NOTIFICATIONS
──────────────────────────────────────────────────────────── */
function qrNotifyEtablissement(etabId, direction) {
  if (!window.db || !window.fbDoc || !window.fbGetDoc || !window.fbSetDoc || !window.fbGetDocs || !window.fbCollection) return;
  var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(etabId); });
  if (!etab || !etab.email) return;
  var notif = {
    id: Date.now() + '_qrvote', key: 'qr_vote_received',
    icon: direction === 'pos' ? '🎉' : '📊',
    title: direction === 'pos' ? '🏆 Nouveau vote positif via QR !' : '📊 Nouveau vote enregistré',
    msg: direction === 'pos'
      ? 'Félicitations ! Un client vous a attribué un vote positif via QR Code.'
      : 'Un vote a été comptabilisé via votre QR Code.',
    channel: 'push', ts: Date.now(), unread: true, fromQrVote: true, etabId: String(etabId)
  };
  window.fbGetDocs(window.fbCollection(window.db, 'users')).then(function(snap) {
    snap.forEach(function(d) {
      var u = d.data();
      if ((u.email || '').toLowerCase() === etab.email.toLowerCase()) {
        var ref = window.fbDoc(window.db, 'user_notifications', d.id);
        window.fbGetDoc(ref).then(function(s2) {
          var items = s2.exists() ? (s2.data().items || []) : [];
          items.push(notif);
          window.fbSetDoc(ref, { items: items.slice(-60), uid: d.id, updatedAt: Date.now() });
        }).catch(function(){});
      }
    });
  }).catch(function(){});
}

function qrNotifyAdmin(etabId, direction) {
  if (!window.saveToAdminLog) return;
  var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(etabId); });
  window.saveToAdminLog({
    id: Date.now() + '_qradm', key: 'qr_vote_admin', icon: '📱',
    title: '📱 Vote QR — ' + (etab ? etab.nom : 'Étab. #' + etabId),
    msg: 'Vote ' + (direction === 'pos' ? '👍 positif' : '👎 négatif') + ' reçu via QR Code',
    channel: 'push', ts: Date.now(), unread: true, etabId: String(etabId), direction: direction
  });
}

/* ────────────────────────────────────────────────────────────
   9. TÉLÉCHARGEMENT QR (Canvas → PNG — A4 / A5 / Carré)
──────────────────────────────────────────────────────────── */
window.ambiQrDownload = function(format) {
  if (!_qrCurrentEtabObj) { if (typeof showToast === 'function') showToast('Aucun établissement sélectionné'); return; }
  var etab    = _qrCurrentEtabObj;
  var voteUrl = qrGetVoteUrl(_qrCurrentEtabId);
  var cfgs    = {
    a4    : { w: 794,  h: 1123, qrSize: 420, label: 'A4' },
    a5    : { w: 559,  h:  794, qrSize: 300, label: 'A5' },
    square: { w: 400,  h:  400, qrSize: 280, label: 'Carré' }
  };
  var cfg = cfgs[format] || cfgs.a4;
  if (typeof QRCode === 'undefined') {
    if (typeof showToast === 'function') showToast('⏳ QR en cours de chargement, réessayez…');
    return;
  }
  var tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:' + cfg.qrSize + 'px;height:' + cfg.qrSize + 'px;overflow:hidden;visibility:hidden;';
  document.body.appendChild(tempDiv);
  try {
    new QRCode(tempDiv, { text: voteUrl, width: cfg.qrSize, height: cfg.qrSize, colorDark: '#000000', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.H });
  } catch(e) { document.body.removeChild(tempDiv); if (typeof showToast === 'function') showToast('❌ Erreur génération QR'); return; }

  function _buildPoster() {
    var qrEl = tempDiv.querySelector('canvas') || tempDiv.querySelector('img');
    if (qrEl && qrEl.tagName === 'IMG' && !qrEl.complete) { qrEl.onload = function(){ _drawAndSave(qrEl); }; qrEl.onerror = function(){ _drawAndSave(null); }; return; }
    _drawAndSave(qrEl);
  }

  function _drawAndSave(qrEl) {
    var qrSource = qrEl;
    if (qrEl && qrEl.tagName === 'IMG') {
      try { var tmpC = document.createElement('canvas'); tmpC.width = cfg.qrSize; tmpC.height = cfg.qrSize; tmpC.getContext('2d').drawImage(qrEl, 0, 0, cfg.qrSize, cfg.qrSize); qrSource = tmpC; } catch(e){ qrSource = null; }
    }
    var canvas = document.createElement('canvas');
    canvas.width = cfg.w; canvas.height = cfg.h;
    var ctx = canvas.getContext('2d');
    var grad = ctx.createLinearGradient(0, 0, cfg.w, cfg.h);
    grad.addColorStop(0, '#1a0a28'); grad.addColorStop(0.5, '#230d35'); grad.addColorStop(1, '#2c1040');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, cfg.w, cfg.h);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#ff2d9b'; ctx.beginPath(); ctx.arc(0, 0, cfg.w * 0.55, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#00e5ff'; ctx.beginPath(); ctx.arc(cfg.w, cfg.h, cfg.w * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    var yOff = format === 'square' ? 20 : 50;
    ctx.textAlign = 'center';
    ctx.font = 'bold ' + Math.round(cfg.w * 0.09) + 'px Arial';
    ctx.fillStyle = '#ff2d9b'; ctx.fillText('AMBI', cfg.w / 2 - cfg.w * 0.08, yOff + cfg.w * 0.09);
    ctx.fillStyle = '#00e5ff'; ctx.fillText('241',  cfg.w / 2 + cfg.w * 0.06, yOff + cfg.w * 0.09);
    var logoBottom = yOff + cfg.w * 0.095;
    if (format !== 'square') {
      ctx.font = 'bold ' + Math.round(cfg.w * 0.055) + 'px Arial'; ctx.fillStyle = '#fff0f8';
      var nomY = logoBottom + 60;
      ctx.fillText(etab.nom || 'Établissement', cfg.w / 2, nomY);
      ctx.font = Math.round(cfg.w * 0.032) + 'px Arial'; ctx.fillStyle = '#b088c0';
      ctx.fillText((etab.type || '') + (etab.quartier ? ' • ' + etab.quartier : ''), cfg.w / 2, nomY + 38);
      var qrX = (cfg.w - cfg.qrSize) / 2, qrY = nomY + 75, pad = 18;
      ctx.fillStyle = '#ffffff'; _roundRect(ctx, qrX - pad, qrY - pad, cfg.qrSize + pad * 2, cfg.qrSize + pad * 2, 22); ctx.fill();
      if (qrSource) { try { ctx.drawImage(qrSource, qrX, qrY, cfg.qrSize, cfg.qrSize); } catch(e){} }
      var qrBottom = qrY + cfg.qrSize + pad + 40;
      ctx.font = 'bold ' + Math.round(cfg.w * 0.038) + 'px Arial'; ctx.fillStyle = '#00e5ff';
      ctx.fillText('Scannez pour voter', cfg.w / 2, qrBottom);
      ctx.font = Math.round(cfg.w * 0.028) + 'px Arial'; ctx.fillStyle = '#b088c0';
      ctx.fillText('et aider cet établissement à progresser !', cfg.w / 2, qrBottom + 36);
      ctx.strokeStyle = 'rgba(255,45,155,0.4)'; ctx.lineWidth = 3;
      _roundRect(ctx, 20, 20, cfg.w - 40, cfg.h - 40, 24); ctx.stroke();
      ctx.font = Math.round(cfg.w * 0.024) + 'px Arial'; ctx.fillStyle = 'rgba(176,136,192,0.55)';
      ctx.fillText('ambi241.com • Libreville, Gabon', cfg.w / 2, cfg.h - 28);
    } else {
      var qrXSq = (cfg.w - cfg.qrSize) / 2, qrYSq = logoBottom + 25;
      ctx.fillStyle = '#ffffff'; _roundRect(ctx, qrXSq - 14, qrYSq - 14, cfg.qrSize + 28, cfg.qrSize + 28, 16); ctx.fill();
      if (qrSource) { try { ctx.drawImage(qrSource, qrXSq, qrYSq, cfg.qrSize, cfg.qrSize); } catch(e){} }
      ctx.font = 'bold ' + Math.round(cfg.w * 0.055) + 'px Arial'; ctx.fillStyle = '#fff0f8';
      ctx.fillText(etab.nom || '—', cfg.w / 2, qrYSq + cfg.qrSize + 45);
    }
    try {
      var a = document.createElement('a');
      a.download = 'ambi241_qr_' + (etab.nom || 'etablissement').replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_' + format + '.png';
      a.href = canvas.toDataURL('image/png', 0.96);
      a.click();
      if (typeof showToast === 'function') showToast('📥 QR ' + cfg.label + ' téléchargé !');
    } catch(e) { if (typeof showToast === 'function') showToast('❌ Erreur export : ' + e.message); }
    try { document.body.removeChild(tempDiv); } catch(e2){}
  }
  setTimeout(_buildPoster, 350);
};

function _roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

/* ────────────────────────────────────────────────────────────
   10. COPIER LE LIEN
──────────────────────────────────────────────────────────── */
window.ambiQrCopyLink = function() {
  if (!_qrCurrentEtabId) return;
  var url = qrGetVoteUrl(_qrCurrentEtabId);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(function(){ if (typeof showToast === 'function') showToast('📋 Lien copié !'); });
  } else {
    var ta = document.createElement('textarea');
    ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
    if (typeof showToast === 'function') showToast('📋 Lien copié !');
  }
};

/* ────────────────────────────────────────────────────────────
   11. ICÔNES QR SUR LES CARTES — visible pour TOUS
──────────────────────────────────────────────────────────── */
function qrInjectCardIcons() {
  (window.etablissements || []).forEach(function(etab) {
    var cardEl = document.getElementById('card-etab-' + etab.id);
    if (!cardEl || cardEl.querySelector('.qr-card-icon')) return;

    var isGuest = qrIsGuest();
    var isOwner = qrIsOwnerOf(etab.id);
    var isAdmin = qrIsAdmin();

    var btn = document.createElement('button');
    /* Classe selon rôle */
    if (isGuest) {
      btn.className = 'qr-card-icon qr-guest';
      btn.setAttribute('title', 'Votez pour cet établissement (inscription gratuite requise)');
      btn.innerHTML = '<span class="qr-card-icon-tooltip">🔐 Voter</span>▦';
    } else if (isOwner || isAdmin) {
      btn.className = 'qr-card-icon qr-owner';
      btn.setAttribute('title', isAdmin ? 'Administration QR Vote' : 'Mon QR Code de vote');
      btn.innerHTML = '<span class="qr-card-icon-tooltip">' + (isAdmin ? '⚙️ QR Admin' : '⭐ Mon QR') + '</span>▦';
    } else {
      btn.className = 'qr-card-icon';
      btn.setAttribute('title', 'Voter pour cet établissement via QR Code');
      btn.innerHTML = '<span class="qr-card-icon-tooltip">📲 QR Vote</span>▦';
    }

    btn.setAttribute('aria-label', 'QR Code de vote — ' + (etab.nom || ''));
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      /* Visiteur → ouvrir modal avec mur d'inscription */
      ambiQrOpenModal(etab.id);
    });

    cardEl.style.position = 'relative';
    cardEl.appendChild(btn);
  });
}

/* ────────────────────────────────────────────────────────────
   12. ADMIN DASHBOARD — votes QR en temps réel
──────────────────────────────────────────────────────────── */
/* ────────────────────────────────────────────────────────────
   HELPERS — données localStorage pour dashboard admin
──────────────────────────────────────────────────────────── */
function qrBuildVotesFromLocalStorage() {
  /* Reconstruit les compteurs de votes depuis les clés localStorage */
  var results = {};
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      /* Format: ambi241_qrvote_ETABID_UID_YYYY-MM */
      if (key && key.startsWith('ambi241_qrvote_')) {
        var parts = key.split('_');
        if (parts.length >= 4) {
          var etabId = parts[2];
          if (!results[etabId]) results[etabId] = { etabId: etabId, total: 0, pos: 0, neg: 0 };
          results[etabId].total++;
          results[etabId].pos++; /* localStorage ne stocke que les votes positifs par défaut */
        }
      }
    }
    /* Fusionner avec le cache mémoire _qrVoteCache */
    Object.keys(_qrVoteCache).forEach(function(id) {
      var c = _qrVoteCache[id];
      if (!results[id]) results[id] = { etabId: id, total: 0, pos: 0, neg: 0 };
      results[id].total = Math.max(results[id].total, c.total || 0);
      results[id].pos   = Math.max(results[id].pos,   c.pos   || 0);
      results[id].neg   = Math.max(results[id].neg,   c.neg   || 0);
    });
  } catch(e) {}
  return Object.values(results).filter(function(v){ return v.total > 0; });
}

function qrRenderVotesList(votes, kpiTotal, kpiPos, kpiEtabs, listEl) {
  votes.sort(function(a, b){ return b.total - a.total; });
  var maxVotes   = votes[0] ? (votes[0].total || 1) : 1;
  var totalGlobal = 0, posGlobal = 0;
  votes.forEach(function(v){ totalGlobal += v.total; posGlobal += v.pos; });

  if (kpiTotal) kpiTotal.textContent = totalGlobal;
  if (kpiPos)   kpiPos.textContent   = totalGlobal > 0 ? Math.round(posGlobal / totalGlobal * 100) + '%' : '—';
  if (kpiEtabs) kpiEtabs.textContent = votes.length;

  var ranks = ['🥇','🥈','🥉'];
  var rankClasses = ['gold','silver','bronze'];
  var html = '';
  votes.slice(0, 15).forEach(function(v, i) {
    var etab    = (window.etablissements || []).find(function(e){ return String(e.id) === String(v.etabId); });
    var nom     = etab ? etab.nom : 'Étab. #' + v.etabId;
    var pct     = Math.round(v.total / maxVotes * 100);
    var posPct  = v.total > 0 ? Math.round(v.pos / v.total * 100) : 0;
    var fillCls = posPct >= 70 ? 'fill-pos' : 'fill-mixed';
    var rankIcon  = i < 3 ? ranks[i] : (i + 1);
    var rankClass = i < 3 ? rankClasses[i] : '';
    html += '<div class="qr-adm-vote-row">'
      + '<div class="qr-adm-rank ' + rankClass + '">' + rankIcon + '</div>'
      + '<div class="qr-adm-vote-name" title="' + nom + '">' + nom + '</div>'
      + '<div class="qr-adm-vote-bar"><div class="qr-adm-vote-fill ' + fillCls + '" style="width:' + pct + '%"></div></div>'
      + '<div class="qr-adm-vote-count">' + v.total + '</div>'
      + '<div class="qr-adm-vote-pct" style="color:' + (posPct >= 70 ? '#00ffaa' : '#ffd700') + '">👍' + posPct + '%</div>'
      + '</div>';
  });
  listEl.innerHTML = html || '<div style="text-align:center;padding:0.7rem;font-size:0.72rem;color:rgba(255,240,248,0.3);">Aucun vote QR encore enregistré</div>';
}

function qrLoadAdminVotes() {
  /* Sécurité : n'exécuter que si l'utilisateur est admin */
  if (!window.isAdmin) return;

  var listEl    = document.getElementById('qrAdminVotesList');
  var kpiTotal  = document.getElementById('qrAdmKpiTotal');
  var kpiPos    = document.getElementById('qrAdmKpiPos');
  var kpiEtabs  = document.getElementById('qrAdmKpiEtabs');

  if (!listEl) return;

  /* ── Fallback localStorage si Firebase absent ── */
  if (!window.db || !window.fbGetDocs || !window.fbCollection) {
    var localVotes = qrBuildVotesFromLocalStorage();
    if (localVotes.length > 0) {
      qrRenderVotesList(localVotes, kpiTotal, kpiPos, kpiEtabs, listEl);
    } else {
      listEl.innerHTML = '<div style="text-align:center;padding:1rem;font-size:0.72rem;color:rgba(255,240,248,0.4);">Aucun vote local enregistré<br><span style=\"font-size:0.62rem;color:rgba(255,240,248,0.3);\">Les votes apparaîtront ici après activation de Firebase</span></div>';
      if (kpiTotal) kpiTotal.textContent = '0';
      if (kpiPos)   kpiPos.textContent   = '—';
      if (kpiEtabs) kpiEtabs.textContent = '0';
    }
    clearTimeout(_qrAdminTimer);
    _qrAdminTimer = setTimeout(qrLoadAdminVotes, 30000);
    return;
  }

  window.fbGetDocs(window.fbCollection(window.db, 'qr_vote_counts')).then(function(snap) {
    if (snap.empty) {
      listEl.innerHTML = '<div style="font-size:0.72rem;color:rgba(255,240,248,0.3);text-align:center;padding:0.7rem;">Aucun vote QR encore enregistré</div>';
      return;
    }
    var votes = [];
    var totalGlobal = 0, posGlobal = 0;
    snap.forEach(function(doc) {
      var d = doc.data();
      votes.push({ etabId: doc.id, total: d.total || 0, pos: d.pos || 0, neg: d.neg || 0 });
      totalGlobal += d.total || 0;
      posGlobal   += d.pos   || 0;
    });
    qrRenderVotesList(votes, kpiTotal, kpiPos, kpiEtabs, listEl);
  }).catch(function(err) {
    listEl.innerHTML = '<div style="font-size:0.7rem;color:#ff4466;padding:0.6rem;">Erreur: ' + err.message + '</div>';
  });

  clearTimeout(_qrAdminTimer);
  _qrAdminTimer = setTimeout(qrLoadAdminVotes, 30000); /* Auto-refresh 30s */
}

function qrRenderRecentVotes() {
  var el = document.getElementById('qrAdmRecentVotes');
  if (!el) return;
  if (_qrRecentVotes.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:0.5rem;font-size:0.68rem;color:rgba(255,240,248,0.3);">Aucun vote récent</div>';
    return;
  }
  var html = '';
  _qrRecentVotes.slice(0, 10).forEach(function(v) {
    var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(v.etabId); });
    var nom  = etab ? etab.nom : 'Étab. #' + v.etabId;
    var ago  = Math.round((Date.now() - v.ts) / 60000);
    var agoStr = ago < 1 ? 'maintenant' : ago + ' min';
    html += '<div class="qr-adm-recent-item">'
      + '<div class="qr-adm-recent-dir">' + (v.direction === 'pos' ? '👍' : '👎') + '</div>'
      + '<div class="qr-adm-recent-info">'
        + '<div class="qr-adm-recent-etab">' + nom + '</div>'
        + '<div class="qr-adm-recent-user">' + (v.uid || 'Anonyme') + '</div>'
      + '</div>'
      + '<div class="qr-adm-recent-time">' + agoStr + '</div>'
      + '</div>';
  });
  el.innerHTML = html;
}

/* Actions admin */
window.ambiQrAdmExportCSV = function() {
  if (!window.db || !window.fbGetDocs || !window.fbCollection) { if (typeof showToast === 'function') showToast('Firebase non disponible'); return; }
  window.fbGetDocs(window.fbCollection(window.db, 'qr_votes')).then(function(snap) {
    var rows = ['Établissement,Direction,Utilisateur,Date,Source'];
    snap.forEach(function(doc) {
      var d = doc.data();
      var etab = (window.etablissements || []).find(function(e){ return String(e.id) === String(d.etabId); });
      var nom  = etab ? etab.nom.replace(/,/g, ' ') : 'Étab. #' + d.etabId;
      rows.push([nom, d.direction, (d.pseudo || '').replace(/,/g, ' '), new Date(d.ts).toLocaleString('fr-FR'), d.source || ''].join(','));
    });
    var blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = 'ambi241_qr_votes_' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
    URL.revokeObjectURL(url);
    if (typeof showToast === 'function') showToast('📊 Export CSV téléchargé !');
  }).catch(function(){ if (typeof showToast === 'function') showToast('❌ Erreur export'); });
};

window.ambiQrAdmResetMonth = function() {
  if (!confirm('Réinitialiser tous les compteurs de votes QR de ce mois ? Cette action est irréversible.')) return;
  if (typeof showToast === 'function') showToast('⚠️ Fonctionnalité disponible via la console Firebase');
};

window.ambiQrAdmForceReclassement = function() {
  qrUpdatePublicRanking();
  if (typeof showToast === 'function') showToast('🔄 Recalcul du classement lancé…');
  setTimeout(function() { qrLoadAdminVotes(); }, 1500);
};

window.ambiQrRefreshAdminVotes = function() {
  clearTimeout(_qrAdminTimer);
  qrLoadAdminVotes();
};

/* ────────────────────────────────────────────────────────────
   13. HOOK loadData / renderAll + MutationObserver
──────────────────────────────────────────────────────────── */
function qrHookFunctions() {
  if (window._qrHookDone) return;
  window._qrHookDone = true;
  var origLoad = window.loadData;
  if (typeof origLoad === 'function') {
    window.loadData = function() { var r = origLoad.apply(this, arguments); setTimeout(qrInjectCardIcons, 600); return r; };
  }
  var origRender = window.renderAll;
  if (typeof origRender === 'function') {
    window.renderAll = function() { var r = origRender.apply(this, arguments); setTimeout(qrInjectCardIcons, 350); return r; };
  }
}

/* ────────────────────────────────────────────────────────────
   14. EXPOSITION GLOBALE & DÉMARRAGE
──────────────────────────────────────────────────────────── */
window.ambiQrInjectCardIcons    = qrInjectCardIcons;
window.ambiQrLoadAdminVotes     = qrLoadAdminVotes;
window.ambiQrUpdatePublicRanking = qrUpdatePublicRanking;

function qrInit() {
  qrCheckLandingMode();
  qrHookFunctions();
  var attempts = 0;
  var timer = setInterval(function() {
    attempts++;
    if ((window.etablissements || []).length > 0) {
      clearInterval(timer);
      qrInjectCardIcons();
      if (window.isAdmin) {
        /* Charger les votes admin avec retry si Firebase pas encore prêt */
        var _initRetry = 0;
        var _initLoad = function(){
          _initRetry++;
          if(window.db && window.fbGetDocs && window.fbCollection){
            qrLoadAdminVotes();
          } else if(_initRetry < 8){
            setTimeout(_initLoad, 800);
          }
        };
        setTimeout(_initLoad, 1200);
      }
    }
    if (attempts > 30) clearInterval(timer);
  }, 500);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', qrInit);
} else {
  qrInit();
}

/* Observer DOM pour ré-injecter après renderAll dynamique */
var _qrReinjectTimer = null;
new MutationObserver(function(mutations) {
  var hasCard = mutations.some(function(m) {
    return Array.from(m.addedNodes).some(function(n) {
      return n.nodeType === 1 && (
        (n.id && n.id.indexOf('card-etab-') !== -1) ||
        (typeof n.className === 'string' && n.className.indexOf('card') !== -1)
      );
    });
  });
  if (hasCard) {
    clearTimeout(_qrReinjectTimer);
    _qrReinjectTimer = setTimeout(qrInjectCardIcons, 250);
  }
}).observe(document.body, { childList: true, subtree: true });

console.log('[AMBI241] ✅ QR Code Vote System v2 chargé — rôles: guest/member/owner/admin');

})();
