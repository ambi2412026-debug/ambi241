import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-app.js";
import { getFirestore, collection, getDocs, doc, updateDoc, setDoc, deleteDoc, orderBy, query, where, getDoc, addDoc, onSnapshot, serverTimestamp, limit, increment, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-firestore.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js";
import { getStorage, ref, uploadBytes, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyCx3hD28Lb9EtUrawHbTnM-6vmXdgO1ABw",
  authDomain: "ambi241.firebaseapp.com",
  projectId: "ambi241",
  storageBucket: "ambi241.firebasestorage.app",
  messagingSenderId: "422590051382",
  appId: "1:422590051382:web:fe05eaf701a6f704c2d497",
  databaseURL: "https://ambi241-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// ── Persistance locale : la session survit au refresh ──
setPersistence(auth, browserLocalPersistence).catch(function(){});

// ── Expose tout en global pour le script classique ci-dessous ──
window.db           = db;
window.auth         = auth;
window.__firebaseApp = app; /* exposé pour le module de présence RTDB */
window.storage      = storage;
window.fbStorage    = storage;
window.fbRef        = ref;
window.fbUploadBytes              = uploadBytes;
window.fbUploadBytesResumable     = uploadBytesResumable;
window.fbGetDownloadURL           = getDownloadURL;
window.fbDeleteObject    = deleteObject;
window.fbCollection = collection;
window.fbGetDocs    = getDocs;
window.fbDoc        = doc;
window.fbGetDoc     = getDoc;
window.fbUpdateDoc  = updateDoc;
window.fbDeleteDoc  = deleteDoc;
window.fbSetDoc     = setDoc;
window.fbAddDoc     = addDoc;

/* ════════════════════════════════════════════════════════════════
   SYSTÈME DE PHOTOS UTILISATEUR
   • Upload de photo de profil (avatar)
   • Upload de photo d'identité (CNI/Passeport)  
   • Vérification d'identité pour paiements
   ════════════════════════════════════════════════════════════════ */

window._uploadUserPhoto = function(type, preselectedFile) {
  // type: 'profile' ou 'identity'
  if (!window.currentUserUID) {
    if (typeof showToast === 'function') showToast('🔒 Veuillez vous connecter');
    return;
  }

  function _processFile(file) {
    if (!file) return;
    var isImgOk = file.type.startsWith('image/') ||
      /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|svg|ico)$/i.test(file.name);
    if (!isImgOk) {
      if (typeof showToast === 'function') showToast('❌ Fichier non reconnu comme image');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      if (typeof showToast === 'function') showToast('⚠️ Image trop grande (max 10 Mo)');
      return;
    }

    if (typeof showToast === 'function') showToast('⏳ Upload en cours...');
    if (typeof showUploadProgress === 'function') showUploadProgress(10, 'Upload...');

    var uid = window.currentUserUID;

    function _onSuccess(photoURL) {
      var userDocRef = window.fbDoc && window.fbDoc(window.db, 'users', uid);
      var updateData = {};
      if (type === 'profile') {
        updateData.photoURL = photoURL;
        updateData.photoProfileUpdated = new Date().toISOString();
      } else {
        updateData.photoIdentityURL = photoURL;
        updateData.identityVerified = false;
        updateData.identitySubmittedAt = new Date().toISOString();
      }
      /* ── FIX: setDoc+merge pour nouveaux membres (updateDoc échoue si doc inexistant) ── */
      var p = Promise.resolve();
      if (userDocRef) {
        if (window.fbSetDoc) {
          p = window.fbSetDoc(userDocRef, updateData, { merge: true });
        } else if (window.fbUpdateDoc) {
          p = window.fbUpdateDoc(userDocRef, updateData).catch(function(err) {
            /* Si le document n'existe pas encore, on le crée */
            if (err && (err.code === 'not-found' || (err.message && err.message.indexOf('No document') !== -1))) {
              if (window.fbSetDoc) return window.fbSetDoc(userDocRef, updateData, { merge: true });
            }
            return Promise.reject(err);
          });
        }
      }
      p.then(function() {
        if (typeof hideUploadProgress === 'function') hideUploadProgress(700);
        if (typeof window._renderUserPhotosUI === 'function') window._renderUserPhotosUI();
        if (typeof renderHome === 'function') renderHome();
        if (typeof showToast === 'function') showToast('✅ Photo mise à jour !');
      }).catch(function(err) {
        if (typeof hideUploadProgress === 'function') hideUploadProgress(0);
        if (typeof showToast === 'function') showToast('❌ Erreur sauvegarde');
      });
    }

    function _fallback(file) {
      if (typeof compressImage === 'function') {
        compressImage(file, function(dataUrl) {
          try { localStorage.setItem('ambi241_user_photo_' + type + '_' + uid, dataUrl); } catch(e) {}
          _onSuccess(dataUrl);
        });
      } else {
        var rd = new FileReader();
        rd.onload = function(ev) {
          try { localStorage.setItem('ambi241_user_photo_' + type + '_' + uid, ev.target.result); } catch(e) {}
          _onSuccess(ev.target.result);
        };
        rd.onerror = function() {
          if (typeof hideUploadProgress === 'function') hideUploadProgress(0);
          if (typeof showToast === 'function') showToast('❌ Erreur lecture fichier');
        };
        rd.readAsDataURL(file);
      }
    }

    if (window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL &&
        window.db && window.fbDoc && window.fbUpdateDoc) {
      var fileName = 'users/' + uid + '/' + type + '_' + _cryptoId(12) + '.jpg';
      var storageRef = window.fbRef(window.fbStorage, fileName);
      if (typeof showUploadProgress === 'function') showUploadProgress(30, 'Upload...');
      window.fbUploadBytes(storageRef, file).then(function() {
        if (typeof showUploadProgress === 'function') showUploadProgress(80, 'Finalisation...');
        return window.fbGetDownloadURL(storageRef);
      }).then(function(photoURL) {
        _onSuccess(photoURL);
      }).catch(function(err) {
        console.warn('Firebase Storage indisponible, compression locale...', err);
        _fallback(file);
      });
    } else {
      _fallback(file);
    }
  }

  // Si un fichier est déjà fourni (depuis label <input>), l'utiliser directement
  if (preselectedFile) {
    _processFile(preselectedFile);
    return;
  }

  // Sinon créer un input file caché et l'ajouter au DOM (fallback)
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);

  input.onchange = function() {
    var file = input.files && input.files[0];
    try { document.body.removeChild(input); } catch(e) {}
    _processFile(file);
  };

  input.click();
};

// Fallback : compression base64 + stockage localStorage
function _fallbackBase64(file, type, loadingMsg, _done) {
  if (typeof compressImage === 'function') {
    compressImage(file, function(dataUrl) {
      try {
        localStorage.setItem('ambi241_user_photo_' + type + '_' + window.currentUserUID, dataUrl);
      } catch(e) {}
      // Mettre à jour Firestore si dispo
      // Mettre à jour Firestore si dispo (FIX: setDoc+merge pour nouveaux membres)
      if (window.db && window.fbDoc && window.currentUserUID) {
        var upd = {};
        if (type === 'profile') { upd.photoURL = dataUrl; }
        else { upd.photoIdentityURL = dataUrl; upd.identityVerified = false; upd.identitySubmittedAt = new Date().toISOString(); }
        var _ref = window.fbDoc(window.db, 'users', window.currentUserUID);
        if (window.fbSetDoc) { window.fbSetDoc(_ref, upd, { merge: true }).catch(function(){}); }
        else if (window.fbUpdateDoc) { window.fbUpdateDoc(_ref, upd).catch(function(e){ if (window.fbSetDoc) window.fbSetDoc(_ref, upd, {merge:true}).catch(function(){}); }); }
      }
      _done('✅ Photo sauvegardée !', false);
    });
  } else {
    var reader = new FileReader();
    reader.onload = function(ev) {
      var dataUrl = ev.target.result;
      try { localStorage.setItem('ambi241_user_photo_' + type + '_' + window.currentUserUID, dataUrl); } catch(e) {}
      _done('✅ Photo sauvegardée (locale) !', false);
    };
    reader.onerror = function() { _done('❌ Erreur lecture fichier', true); };
    reader.readAsDataURL(file);
  }
}

window._deleteUserPhoto = function(type) {
  if (!window.currentUserUID) return;
  if (!confirm('Supprimer cette photo ?')) return;

  if (!window.db || !window.fbDoc || !window.fbUpdateDoc) {
    // Supprimer du localStorage uniquement
    try { localStorage.removeItem('ambi241_user_photo_' + type + '_' + window.currentUserUID); } catch(e) {}
    if (typeof window._renderUserPhotosUI === 'function') window._renderUserPhotosUI();
    return;
  }

  var userDocRef = window.fbDoc(window.db, 'users', window.currentUserUID);
  var updateData = {};
  if (type === 'profile') {
    updateData.photoURL = '';
  } else if (type === 'identity') {
    updateData.photoIdentityURL = '';
    updateData.identityVerified = false;
  }
  // Nettoyer aussi le localStorage
  try { localStorage.removeItem('ambi241_user_photo_' + type + '_' + window.currentUserUID); } catch(e) {}

  window.fbUpdateDoc(userDocRef, updateData).then(function() {
    if (typeof window._renderUserPhotosUI === 'function') window._renderUserPhotosUI();
    if (typeof renderHome === 'function') renderHome();
    if (typeof showToast === 'function') showToast('✅ Photo supprimée');
  }).catch(function(err) {
    console.error('Erreur suppression:', err);
    if (typeof showToast === 'function') showToast('❌ Erreur suppression');
  });
};

window._getUserPhotoData = function(uid) {
  return new Promise(function(resolve) {
    if (!window.db || !window.fbDoc || !window.fbGetDoc) { resolve(null); return; }
    window.fbGetDoc(window.fbDoc(window.db, 'users', uid)).then(function(snap) {
      if (!snap.exists || !snap.exists()) { resolve(null); return; }
      var data = snap.data();
      // Fusionner avec données localStorage si présentes
      var localProfile  = '';
      var localIdentity = '';
      try { localProfile  = localStorage.getItem('ambi241_user_photo_profile_' + uid) || ''; } catch(e) {}
      try { localIdentity = localStorage.getItem('ambi241_user_photo_identity_' + uid) || ''; } catch(e) {}
      resolve({
        photoURL: data.photoURL || localProfile || '',
        photoIdentityURL: data.photoIdentityURL || localIdentity || '',
        identityVerified: data.identityVerified || false,
        identitySubmittedAt: data.identitySubmittedAt || null
      });
    }).catch(function() {
      // Fallback localStorage
      var localProfile  = '';
      var localIdentity = '';
      try { localProfile  = localStorage.getItem('ambi241_user_photo_profile_' + uid) || ''; } catch(e) {}
      try { localIdentity = localStorage.getItem('ambi241_user_photo_identity_' + uid) || ''; } catch(e) {}
      resolve({ photoURL: localProfile, photoIdentityURL: localIdentity, identityVerified: false, identitySubmittedAt: null });
    });
  });
};

window._renderUserPhotosUI = function() {
  if (!window.currentUserUID) return;
  window._getUserPhotoData(window.currentUserUID).then(function(photoData) {
    if (!photoData) return;

    // Photo de profil
    var profilePhotoBox = document.getElementById('profilePhotoBox');
    var deleteProfileBtn = document.getElementById('deleteProfilePhotoBtn');
    if (profilePhotoBox) {
      if (photoData.photoURL) {
        profilePhotoBox.innerHTML = '<img src="' + photoData.photoURL + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>';
        if (deleteProfileBtn) deleteProfileBtn.style.display = 'block';
      } else {
        profilePhotoBox.innerHTML = '<div class="photo-upload-placeholder"><span>📷</span><small>Cliquer pour ajouter</small></div>';
        if (deleteProfileBtn) deleteProfileBtn.style.display = 'none';
      }
    }

    // Photo d'identité
    var identityPhotoBox = document.getElementById('identityPhotoBox');
    var deleteIdentityBtn = document.getElementById('deleteIdentityPhotoBtn');
    var verificationStatus = document.getElementById('identityVerificationStatus');

    if (identityPhotoBox) {
      if (photoData.photoIdentityURL) {
        identityPhotoBox.innerHTML = '<img src="' + photoData.photoIdentityURL + '" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"/>';
        if (deleteIdentityBtn) deleteIdentityBtn.style.display = 'block';
      } else {
        identityPhotoBox.innerHTML = '<div class="photo-cni-placeholder"><span>🆔</span><small>CNI ou Passeport</small></div>';
        if (deleteIdentityBtn) deleteIdentityBtn.style.display = 'none';
      }
    }

    // Statut vérification
    if (verificationStatus) {
      if (!photoData.photoIdentityURL) {
        verificationStatus.innerHTML = '';
      } else if (photoData.identityVerified) {
        verificationStatus.innerHTML = '<div class="identity-verified-badge" style="font-size:0.72rem;color:var(--green);font-weight:700;margin-top:0.3rem;">✓ Identité vérifiée</div>';
      } else if (photoData.identitySubmittedAt) {
        verificationStatus.innerHTML = '<div class="identity-pending-badge" style="font-size:0.72rem;color:var(--amber);font-weight:700;margin-top:0.3rem;">⏳ En attente de vérification</div>';
      }
    }
  });
};

/* ════════════════════════════════════════════════════════════════
   GESTION DES PHOTOS DE CHAUFFEURS TAXI
   ════════════════════════════════════════════════════════════════ */

window._uploadDriverPhoto = function(contactIndex) {
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,.heic,.heif,.avif,.bmp,.tiff,.tif,.jfif';
  input.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(input);

  input.onchange = function(e) {
    var file = e.target.files && e.target.files[0];
    try{ document.body.removeChild(input); }catch(er){}
    if (!file) return;

    var isImg = (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|svg)$/i.test(file.name||'');
    if(!isImg){ if(typeof showToast==='function') showToast('❌ Fichier non reconnu comme image'); return; }
    if (file.size > 10 * 1024 * 1024) { if(typeof showToast==='function') showToast('⚠️ Image trop grande (max 10 Mo)'); return; }

    if(typeof showToast==='function') showToast('⏳ Upload photo chauffeur...');
    if(typeof showUploadProgress==='function') showUploadProgress(10,'Chauffeur...');

    function _savePhoto(photoURL){
      var contacts = [];
      try{ contacts = JSON.parse(localStorage.getItem('taxiContacts')||'[]'); }catch(er){}
      if (contacts[contactIndex]) {
        contacts[contactIndex].photo = photoURL;
        contacts[contactIndex].photoUpdated = new Date().toISOString();
        try{ localStorage.setItem('taxiContacts', JSON.stringify(contacts)); }catch(er){}
      }
      if(typeof hideUploadProgress==='function') hideUploadProgress(700);
      if(typeof showToast==='function') showToast('✅ Photo chauffeur mise à jour !');
      if (typeof loadTaxiContacts === 'function') loadTaxiContacts();
      if (typeof loadAdminContacts === 'function') loadAdminContacts();
    }

    if (window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL) {
      var storRef = window.fbRef(window.fbStorage,'taxi/drivers/driver_'+_cryptoId(12)+'_'+contactIndex+'.jpg');
      if(typeof showUploadProgress==='function') showUploadProgress(30,'Upload...');
      window.fbUploadBytes(storRef, file).then(function(){
        if(typeof showUploadProgress==='function') showUploadProgress(80,'Finalisation...');
        return window.fbGetDownloadURL(storRef);
      }).then(function(url){ _savePhoto(url); })
      .catch(function(err){
        console.warn('Storage indispo, compression locale:', err);
        if(typeof compressImage==='function'){ compressImage(file, function(d){ _savePhoto(d); }); }
        else { if(typeof hideUploadProgress==='function') hideUploadProgress(0); }
      });
    } else if(typeof compressImage==='function'){
      compressImage(file, function(d){ _savePhoto(d); });
    } else {
      var rd = new FileReader();
      rd.onload = function(ev){ _savePhoto(ev.target.result); };
      rd.readAsDataURL(file);
    }
  };
  input.click();
};

window._deleteDriverPhoto = function(contactIndex) {
  if (!confirm('Supprimer la photo du chauffeur ?')) return;

  try {
    let contacts = JSON.parse(localStorage.getItem('taxiContacts') || '[]');
    if (contacts[contactIndex]) {
      contacts[contactIndex].photo = '';
      localStorage.setItem('taxiContacts', JSON.stringify(contacts));
      if (typeof loadTaxiContacts === 'function') loadTaxiContacts();
      if (typeof loadAdminContacts === 'function') loadAdminContacts();
    }
  } catch (err) {
    console.error('Erreur suppression:', err);
  }
};


window.fbOnSnapshot = onSnapshot;
window.fbServerTimestamp = serverTimestamp;
window.fbFieldIncrement = increment;
window.fbQuery      = query;
window.fbOrderBy    = orderBy;
window.fbWhere      = where;
window.fbLimit      = limit;
window.fbArrayUnion  = arrayUnion;
window.fbArrayRemove = arrayRemove;
window.fbCreateUser = createUserWithEmailAndPassword;
window.fbSignIn     = signInWithEmailAndPassword;
window.fbSignOut    = signOut;
window.fbSendPasswordResetEmail = sendPasswordResetEmail;

// Suivi de l'état de connexion
onAuthStateChanged(auth, function(user) {
  if (user) {
    window.currentUserEmail = user.email;
    window.currentUserUID   = user.uid;
    // ── Vérifier l'expiration du token au login ──────────────
    user.getIdToken(false).catch(function(err){
      if(err.code === 'auth/user-token-expired' || err.code === 'auth/invalid-user-token'){
        _handleSessionExpired();
      }
    });
    // Récupérer le pseudo depuis Firestore pour l'afficher dans le header
    getDoc(doc(db, "users", user.uid)).then(function(snap) {
      var pseudo = snap.exists() ? (snap.data().pseudo || user.email) : user.email;
      var photoURL = snap.exists() ? (snap.data().photoURL || '') : '';
      window.currentUserPseudo = pseudo;
      window.currentUserPhotoURL = photoURL;
      updateHeaderUser(pseudo);
      // Mettre à jour avatar quickbar
      var qba = document.getElementById("pubQuickbarAvatar");
      if(qba) qba.textContent = (pseudo||"?")[0].toUpperCase();
      // ── Enregistrer la session de connexion ──
      _logUserSession(user.uid, user.email, pseudo);
    }).catch(function(err) {
      // Détecter une session expirée via erreur Firestore
      if(err && (err.code === 'auth/user-token-expired' || err.code === 'permission-denied')){
        _handleSessionExpired(); return;
      }
      window.currentUserPseudo = user.email;
      updateHeaderUser(user.email);
      _logUserSession(user.uid, user.email, user.email);
    });
    // Vérifier si cet utilisateur est admin secondaire (après délai pour que les configs soient chargées)
    setTimeout(function(){
      if(typeof checkSecondaryAdminAccess === "function") checkSecondaryAdminAccess();
      if(typeof renderAll === "function") { renderAll(); renderHome(); }
      // ── Synchroniser les notifications Firebase pour cet utilisateur ──
      if(typeof _syncUserNotifsFromFirebase === "function") _syncUserNotifsFromFirebase();
      // ── Afficher l'onboarding notifications si pas encore fait ──
      setTimeout(function(){
        if(typeof ambiShowNotifOnboarding === 'function') ambiShowNotifOnboarding();
      }, 2800);
      // ── Initialiser le cache des likes de l'utilisateur ──
      if(typeof _initLikedCache === 'function') setTimeout(_initLikedCache, 600);
      if(typeof window.__onAuthPubHook === 'function') window.__onAuthPubHook(user.uid);
      // ── Mettre à jour le label nav Connexion → Profil ──
      if(typeof updateNavLabels === "function") updateNavLabels();
      // ── Pré-remplir sec-profil avec les vraies données utilisateur ──
      if(typeof _syncProfilSection === "function") setTimeout(_syncProfilSection, 400);
      // ── Visibilité pro-panels fiches selon rôle ──
      setTimeout(function(){ if(typeof _applyFichesPanelVisibility === 'function') _applyFichesPanelVisibility(); }, 600);
      // ── Actualiser le panneau paiements ──
      if(typeof updatePayVis === "function") setTimeout(updatePayVis, 500);
      // ── Démarrer le listener Taxi Pro si le user est un chauffeur approuvé ──
      setTimeout(function() {
        var uid = user.uid;
        var drivers = window._chauffeurDrivers || {};
        var driver = drivers[uid];
        if (driver && driver.status === 'approved') {
          if (typeof tdbStartListeningRequests === 'function') {
            tdbStartListeningRequests();
            console.log('[AMBI241] 🚕 Listener Taxi Pro démarré auto pour chauffeur approuvé :', driver.pseudo || user.email);
          }
        }
      }, 3500); // après chargement de _chauffeurDrivers (loadData)
    }, 2000);
  } else {
    window.currentUserEmail  = "";
    window.currentUserUID    = null;
    window.currentUserPseudo = "";
    updateHeaderUser(null);
    // ── Repasser le bouton en "Connexion" après déconnexion ──
    if(typeof updateNavLabels === "function") updateNavLabels();
    // ── Masquer les pro-panels fiches pour les visiteurs ──
    if(typeof _applyFichesPanelVisibility === 'function') _applyFichesPanelVisibility();
    // ── Réafficher les formules d'abonnement après déconnexion ──
    if(typeof updatePayVis === "function") setTimeout(updatePayVis, 200);
  }
  // Déclenche le rendu si l'app est déjà initialisée (sans recharger les données)
  // loadData() fait déjà renderAll() — inutile de le rappeler ici
  // if (typeof renderAll === "function") { renderAll(); renderHome(); }
});

/* ── Gestion session expirée Firebase ─────────────────────────────
   Appelé quand le token Firebase est invalide / expiré.
   Déconnecte proprement l'utilisateur et redirige vers la connexion. */
function _handleSessionExpired(){
  if(window._sessionExpiredHandled) return;
  window._sessionExpiredHandled = true;
  // Réinitialiser l'état admin
  isAdmin = false; isSuperAdmin = false;
  window.currentUserEmail = ""; window.currentUserUID = null; window.currentUserPseudo = "";
  // Déconnexion Firebase silencieuse
  if(window.fbSignOut && window.auth){
    window.fbSignOut(window.auth).catch(function(){});
  }
  // Afficher un message clair et rediriger vers la connexion
  showToast("⏱️ Session expirée — veuillez vous reconnecter");
  setTimeout(function(){
    window._sessionExpiredHandled = false;
    if(typeof updateNavLabels === "function") updateNavLabels();
    if(typeof updatePayVis === "function") updatePayVis();
    if(typeof renderAll === "function") renderAll();
    // Ouvrir le modal de connexion automatiquement
    var overlay = document.getElementById('userOverlay');
    if(overlay){ overlay.classList.add('show'); }
    if(typeof switchUserTab === 'function') switchUserTab('connexion');
  }, 1200);
}
window._handleSessionExpired = _handleSessionExpired;

// ── Enregistrement de session de connexion ──────────────────────
function _logUserSession(uid, email, pseudo){
  if(!uid || !window.db) return;
  // Pas de géolocalisation au login — trop lent (timeout 5s)
  var sessionData = {
    uid: uid,
    email: email || "",
    pseudo: pseudo || email || "",
    connectedAt: (window.fbServerTimestamp ? window.fbServerTimestamp() : new Date().toISOString()),
    connectedAtMs: Date.now(),
    userAgent: navigator.userAgent || "",
    platform: navigator.platform || "",
    language: navigator.language || "",
    screenRes: screen.width + "x" + screen.height,
    timezone: Intl && Intl.DateTimeFormat ? Intl.DateTimeFormat().resolvedOptions().timeZone : "",
    online: navigator.onLine,
    sessionId: uid + "_" + Date.now(),
    geoStatus: "skipped"
  };
  _writeSessionLog(sessionData);
}
function _writeSessionLog(data){
  if(!window.db || !window.fbAddDoc || !window.fbCollection) return;
  window.fbAddDoc(window.fbCollection(window.db, "connection_logs"), data).then(function(){
    // Notifier l'admin via le système de notifications
    if(typeof pushNotif === "function"){
      try{
        var geoLabel = (data.lat && data.lng) ? "📍 Position disponible" : "📍 Sans géolocalisation";
        var device = typeof _parseDevice === "function" ? _parseDevice(data.userAgent||"") : {label:"Appareil inconnu"};
        pushNotif({
          targetRole: "admin",
          key: "new_connexion_"+data.uid,
          icon: "🔌",
          title: "Connexion : "+(data.pseudo||data.email||"Utilisateur"),
          msg: device.label+" · "+geoLabel+" · "+new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}),
          channel: "push",
          fromAdmin: false
        });
      }catch(e2){}
    }
  }).catch(function(){});
}

// Signal que Firebase est prêt — loadData() sera appelé par le script principal
window.__firebaseReady = true;
if (window.__appReady) { loadData(); initMeteo(); }
// Charger la config admin (superadmin + admins secondaires) dès que Firebase est prêt
setTimeout(function(){
  if(typeof loadAdminConfig === "function") loadAdminConfig();
}, 400);

// ══════════════════════════════════════════════════════════════
// ══  MOTEUR DONNÉES RÉELLES FIRESTORE — TEMPS RÉEL          ══
// ══  Présences · Votes · Notes · Avis · Classement Live     ══
// ══════════════════════════════════════════════════════════════

// Cache global temps réel (partagé avec le script principal)
window._livePresences = {};  // { eid: { count: N, users: [...] } }
window._liveVotes     = {};  // { eid: { pos: N, neg: N, myVote: null|'pos'|'neg' } }
window._liveRatings   = {};  // { eid: { note: X.X, avis: N } }

var _presUnsubs  = {}; // unsubscribe map pour présences
var _voteUnsubs  = {}; // unsubscribe map pour votes
var _rateUnsubs  = {}; // unsubscribe map pour ratings

// ── Abonner un établissement à ses flux Firestore ────────────
function _subscribeEtab(eid) {
  var eidStr = String(eid);

  // ── Présences (sous-collection) ──────────────────────────────
  if (!_presUnsubs[eidStr]) {
    try {
      var presCol = collection(db, "etablissements", eidStr, "presences");
      _presUnsubs[eidStr] = onSnapshot(presCol, function(snap) {
        var now = Date.now();
        var TTL = 3 * 3600 * 1000;
        var users = [];
        snap.forEach(function(d) {
          var data = d.data();
          if (data.ts && (now - data.ts) < TTL) {
            users.push({ uid: d.id, pseudo: data.pseudo || "Visiteur", ts: data.ts });
          }
        });
        window._livePresences[eidStr] = { count: users.length, users: users };
        _patchCardPresence(eid);
        _updateRankScoreLive();
      }, function() {});
    } catch(e) {}
  }

  // ── Votes (sous-collection) ──────────────────────────────────
  if (!_voteUnsubs[eidStr]) {
    try {
      var voteCol = collection(db, "etablissements", eidStr, "votes");
      _voteUnsubs[eidStr] = onSnapshot(voteCol, function(snap) {
        var pos = 0, neg = 0, myVote = null;
        var myUid = window.currentUserUID || null;
        snap.forEach(function(d) {
          var v = d.data().vote;
          if (v === "pos") pos++;
          if (v === "neg") neg++;
          if (myUid && d.id === myUid) myVote = v || null;
        });
        window._liveVotes[eidStr] = { pos: pos, neg: neg, myVote: myVote };
        _patchCardVotes(eid);
        _updateRankScoreLive();
      }, function() {});
    } catch(e) {}
  }

  // ── Ratings / Notes (sous-collection "ratings") ──────────────
  if (!_rateUnsubs[eidStr]) {
    try {
      var rateCol = collection(db, "etablissements", eidStr, "ratings");
      _rateUnsubs[eidStr] = onSnapshot(rateCol, function(snap) {
        var total = 0, count = 0;
        snap.forEach(function(d) {
          var r = d.data().rating;
          if (r >= 1 && r <= 5) { total += r; count++; }
        });
        var avgNote = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
        window._liveRatings[eidStr] = { note: avgNote, avis: count };
        // Mettre à jour l'établissement local
        var etab = (typeof etablissements !== "undefined") ? etablissements.find(function(x){ return x.id === eid; }) : null;
        if (etab && count > 0) {
          etab.note = avgNote;
          etab.avis = count;
        }
        _patchCardRating(eid);
        _updateRankScoreLive();
      }, function() {});
    } catch(e) {}
  }
}

// ── Patch en direct des éléments DOM sans re-render total ───
function _patchCardPresence(eid) {
  var eidStr = String(eid);
  var live = window._livePresences[eidStr] || { count: 0, users: [] };
  // Mettre à jour le compteur dans la carte via l'élément id
  var presCountEls = document.querySelectorAll("[data-live-pres='"+eidStr+"']");
  presCountEls.forEach(function(el) {
    el.textContent = live.count;
  });
  var presLabelEls = document.querySelectorAll("[data-live-presl='"+eidStr+"']");
  presLabelEls.forEach(function(el) {
    el.textContent = live.count + " pers. sur place";
  });
}

function _patchCardVotes(eid) {
  var eidStr = String(eid);
  var live = window._liveVotes[eidStr] || { pos: 0, neg: 0, myVote: null };
  var posEl = document.getElementById("vpos-" + eidStr);
  var negEl = document.getElementById("vneg-" + eidStr);
  if (posEl) posEl.textContent = live.pos;
  if (negEl) negEl.textContent = live.neg;
}

function _patchCardRating(eid) {
  var eidStr = String(eid);
  var live = window._liveRatings[eidStr];
  if (!live) return;
  var noteEls = document.querySelectorAll("[data-live-note='"+eidStr+"']");
  noteEls.forEach(function(el) { el.textContent = live.note.toFixed(1); });
  var avisEls = document.querySelectorAll("[data-live-avis='"+eidStr+"']");
  avisEls.forEach(function(el) { el.textContent = live.avis + " avis"; });
}

// ── Recalcul du score de classement et mise à jour en direct ──
function _updateRankScoreLive() {
  if (typeof etablissements === "undefined" || !etablissements.length) return;
  // Re-calculer le score de chaque étab avec les données live
  var scored = etablissements.map(function(e) {
    var eidStr = String(e.id);
    var lp = window._livePresences[eidStr] || { count: 0 };
    var lv = window._liveVotes[eidStr]     || { pos: 0, neg: 0 };
    var base = e.affluence || 0;
    var presBonus = Math.min(lp.count * 3, 30);
    var voteBonus = (lv.pos * 2) - (lv.neg * 3);
    var realAff = Math.max(0, Math.min(100, base + presBonus + voteBonus));
    return { id: e.id, score: realAff };
  }).sort(function(a, b) { return b.score - a.score; });
  // Mettre à jour les badges de rang dans le DOM
  scored.forEach(function(r, idx) {
    var rankEls = document.querySelectorAll("[data-live-rank='"+r.id+"']");
    var medal = idx === 0 ? "🏆 N°1" : idx === 1 ? "🥈 N°2" : idx === 2 ? "🥉 N°3" : "N°" + (idx + 1);
    var color = idx === 0 ? "var(--amber)" : idx === 1 ? "#c0c0c0" : idx === 2 ? "#cd7f32" : "var(--muted)";
    rankEls.forEach(function(el) {
      el.textContent = medal;
      el.style.color = color;
    });
  });
}

// ── S'abonner UNIQUEMENT aux étabs actifs (payés) pour limiter les listeners ────────────────────
function _subscribeAllEtabs() {
  if (typeof etablissements === "undefined") return;
  var actifs = etablissements.filter(function(e){
    return e.paiement === "Confirme" || e.paiement === "Actif" || estPaiementConfirme(e);
  });
  /* Bug2-FIX: Cap à 15 max — chaque _subscribeEtab ouvre 3 onSnapshot Firestore
   * (presences + votes + ratings). 30+ etabs = 90+ WebSocket listeners simultanés
   * sur mobile → saturation mémoire → crash navigateur ("Aïe aïe aïe"). */
  var MAX_SUBS = 15;
  if(actifs.length === 0) actifs = etablissements.slice(0, Math.min(MAX_SUBS, etablissements.length));
  actifs = actifs.slice(0, MAX_SUBS);
  actifs.forEach(function(e) { _subscribeEtab(e.id); });
}

// Appeler dès que Firebase est prêt + après chaque loadData
window._subscribeAllEtabs = _subscribeAllEtabs;

// Abonnement immédiat (les établissements locaux sont déjà chargés)
setTimeout(function() {
  _subscribeAllEtabs();
}, 800);