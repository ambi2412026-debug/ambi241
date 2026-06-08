/* ══════════════════════════════════════════════════════════════════
   MODULE : GALERIE PHOTOS — Import Maps Admin
   Fonctionnalités :
   - Peuplement automatique du sélecteur après import
   - Upload multiple Firebase Storage → galerie Firestore
   - Définir photo de profil (admin ou établissement selon permission)
   - Galerie visible publiquement, gestion admin complète
   ══════════════════════════════════════════════════════════════════ */
(function(){
  'use strict';

  /* ── State ── */
  var _curEtabId   = null;   // ID Firestore du doc sélectionné
  var _curEtabData = null;   // données de l'établissement
  var _gallery     = [];     // [{url, storagePath, isProfile}]
  var _uploading   = false;

  /* ── Peuplement du sélecteur avec les établissements importés lors de la session ── */
  function igm2GalleryPopulatePicker(importedDocs){
    var sel = document.getElementById('igm2GalleryEtabPicker');
    if(!sel) return;
    // Vider sauf option vide
    while(sel.options.length > 1) sel.remove(1);
    if(!importedDocs || !importedDocs.length) return;
    importedDocs.forEach(function(d){
      var opt = document.createElement('option');
      opt.value = d.firestoreId || d.id;
      opt.textContent = (d.icon||'') + ' ' + d.nom + (d.quartier ? ' — ' + d.quartier : '');
      opt.dataset.nom = d.nom;
      sel.appendChild(opt);
    });
  }
  window.igm2GalleryPopulatePicker = igm2GalleryPopulatePicker;

  /* ── Chargement des données d'un établissement sélectionné ── */
  async function igm2GalleryLoadEtab(etabId){
    _curEtabId = etabId || null;
    _curEtabData = null;
    _gallery = [];
    igm2GallerySetStatus('');
    var preview = document.getElementById('igm2ProfilePreview');
    if(preview) preview.style.display = etabId ? 'flex' : 'none';
    igm2GalleryRender();

    if(!etabId || !window.db || !window.fbDoc || !window.fbGetDoc) return;

    try {
      var snap = await window.fbGetDoc(window.fbDoc(window.db, 'etablissements', etabId));
      if(!snap.exists()) { igm2GallerySetStatus('Établissement introuvable.','err'); return; }
      _curEtabData = snap.data();

      // Charger la permission profil (champ allowEtabProfilePhoto)
      var permCk = document.getElementById('igm2AllowEtabProfilePerm');
      if(permCk) permCk.checked = (_curEtabData.allowEtabProfilePhoto !== false);

      // Charger la galerie (champ gallery : [{url, storagePath, isProfile}])
      _gallery = Array.isArray(_curEtabData.gallery) ? _curEtabData.gallery : [];

      // Rétrocompatibilité : intégrer photo_interieur / photo_exterieur comme 1ères photos
      if(!_gallery.length){
        if(_curEtabData.photo_interieur) _gallery.push({url:_curEtabData.photo_interieur, storagePath:'', isProfile:false, label:'Intérieur'});
        if(_curEtabData.photo_exterieur) _gallery.push({url:_curEtabData.photo_exterieur, storagePath:'', isProfile:false, label:'Extérieur'});
      }

      igm2GalleryRender();
      igm2GalleryUpdateProfilePreview();
    } catch(e){
      igm2GallerySetStatus('Erreur chargement : ' + e.message,'err');
    }
  }
  window.igm2GalleryLoadEtab = igm2GalleryLoadEtab;

  /* ── Rendu de la grille ── */
  function igm2GalleryRender(){
    var grid = document.getElementById('igm2GalleryGrid');
    if(!grid) return;
    var count = document.getElementById('igm2GalleryCount');
    if(count) count.textContent = _gallery.length ? '(' + _gallery.length + ' photo' + (_gallery.length>1?'s':'') + ')' : '';

    var html = '';
    _gallery.forEach(function(p, i){
      var isProfile = !!p.isProfile;
      html += '<div class="igm-gallery-thumb' + (isProfile?' igm-profile-thumb':'') + '" data-gi="' + i + '">';
      if(isProfile) html += '<div class="igm-profile-crown">★ Profil</div>';
      html += '<img src="' + p.url + '" alt="Photo ' + (i+1) + '" loading="lazy" onclick="igm2GalleryLightbox(' + i + ')">';
      if(_curEtabId){
        html += '<button class="igm-thumb-del" onclick="event.stopPropagation();igm2GalleryDeletePhoto(' + i + ')" title="Supprimer">✕</button>';
        if(!isProfile){
          html += '<button class="igm-set-profile-btn" onclick="event.stopPropagation();igm2GallerySetProfile(' + i + ')">⭐ Définir profil</button>';
        }
      }
      html += '</div>';
    });

    // Bouton ajout
    if(_curEtabId){
      html += '<div class="igm-gallery-add" onclick="igm2GalleryTriggerUpload()" title="Ajouter des photos"><span>＋</span><small>Photo</small></div>';
    }

    grid.innerHTML = html;
  }

  /* ── Preview photo de profil ── */
  function igm2GalleryUpdateProfilePreview(){
    var prof = _gallery.find(function(p){ return p.isProfile; });
    var nameEl = document.getElementById('igm2ProfilePreviewName');
    var statusEl = document.getElementById('igm2ProfilePreviewStatus');
    var img = document.getElementById('igm2ProfilePreviewImg');
    var placeholder = document.getElementById('igm2ProfilePreviewPlaceholder');
    if(nameEl && _curEtabData) nameEl.textContent = _curEtabData.nom || '—';
    if(prof && prof.url){
      if(img){ img.src = prof.url; img.style.display = 'block'; }
      if(placeholder) placeholder.style.display = 'none';
      if(statusEl) statusEl.textContent = 'Photo de profil définie ✓';
    } else {
      if(img){ img.src = ''; img.style.display = 'none'; }
      if(placeholder) placeholder.style.display = 'flex';
      if(statusEl) statusEl.textContent = 'Aucune photo de profil définie';
    }
  }

  /* ── Déclencheur upload ── */
  function igm2GalleryTriggerUpload(){
    if(!_curEtabId){ igm2GallerySetStatus('Sélectionnez d\'abord un établissement.','err'); return; }
    var inp = document.getElementById('igm2GalleryFileInput');
    if(inp) inp.click();
  }
  window.igm2GalleryTriggerUpload = igm2GalleryTriggerUpload;

  /* ── Gestion des fichiers sélectionnés ── */
  async function igm2GalleryHandleFiles(input){
    var files = Array.from(input.files||[]);
    input.value = '';
    if(!files.length || !_curEtabId) return;
    if(_uploading){ igm2GallerySetStatus('Upload en cours, patientez…'); return; }

    var MAX_PHOTOS = 12;
    if(_gallery.length + files.length > MAX_PHOTOS){
      files = files.slice(0, MAX_PHOTOS - _gallery.length);
      igm2GallerySetStatus('Max ' + MAX_PHOTOS + ' photos par établissement. ' + files.length + ' photo(s) traitée(s).','err');
    }
    if(!files.length) return;

    if(!window.fbStorage || !window.fbRef || !window.fbUploadBytes || !window.fbGetDownloadURL){
      igm2GallerySetStatus('Firebase Storage non disponible.','err'); return;
    }

    _uploading = true;
    igm2GallerySetStatus('<div class="igm-gallery-uploading"><div class="igm-spin"></div> Upload en cours (' + files.length + ' photo' + (files.length>1?'s':'') + ')…</div>');

    var newPhotos = [];
    for(var i = 0; i < files.length; i++){
      var file = files[i];
      try {
        var ext = file.name.split('.').pop().toLowerCase() || 'jpg';
        var ts  = Date.now() + '_' + Math.random().toString(36).slice(2,7);
        var storagePath = 'etablissements/' + _curEtabId + '/gallery/' + ts + '.' + ext;
        var storRef = window.fbRef(window.fbStorage, storagePath);
        await window.fbUploadBytes(storRef, file);
        var url = await window.fbGetDownloadURL(storRef);
        newPhotos.push({ url: url, storagePath: storagePath, isProfile: false });
      } catch(e){
        igm2GallerySetStatus('Erreur upload ' + file.name + ' : ' + e.message,'err');
      }
    }

    if(newPhotos.length){
      _gallery = _gallery.concat(newPhotos);
      await igm2GallerySave();
      igm2GalleryRender();
      igm2GalleryUpdateProfilePreview();
      igm2GallerySetStatus(newPhotos.length + ' photo(s) ajoutée(s) ✓','ok');
    }
    _uploading = false;
  }
  window.igm2GalleryHandleFiles = igm2GalleryHandleFiles;

  /* ── Définir photo de profil ── */
  async function igm2GallerySetProfile(index){
    if(!_curEtabId) return;
    _gallery.forEach(function(p){ p.isProfile = false; });
    if(_gallery[index]) _gallery[index].isProfile = true;
    await igm2GallerySave();
    igm2GalleryRender();
    igm2GalleryUpdateProfilePreview();
    igm2GallerySetStatus('Photo de profil mise à jour ✓','ok');
    if(typeof showToast === 'function') showToast('⭐ Photo de profil définie pour ' + (_curEtabData&&_curEtabData.nom||'l\'établissement'));
  }
  window.igm2GallerySetProfile = igm2GallerySetProfile;

  /* ── Supprimer une photo ── */
  async function igm2GalleryDeletePhoto(index){
    if(!_curEtabId) return;
    var p = _gallery[index];
    if(!p) return;
    if(!confirm('Supprimer cette photo ?')) return;

    // Supprimer du Storage si path disponible
    if(p.storagePath && window.fbRef && window.fbStorage && window.fbDeleteObject){
      try { await window.fbDeleteObject(window.fbRef(window.fbStorage, p.storagePath)); } catch(e){}
    }
    _gallery.splice(index, 1);
    // S'assurer qu'il reste au plus 1 photo de profil
    if(!_gallery.some(function(ph){ return ph.isProfile; }) && _gallery.length){
      _gallery[0].isProfile = false;
    }
    await igm2GallerySave();
    igm2GalleryRender();
    igm2GalleryUpdateProfilePreview();
    igm2GallerySetStatus('Photo supprimée.','ok');
  }
  window.igm2GalleryDeletePhoto = igm2GalleryDeletePhoto;

  /* ── Sauvegarder permission photo de profil ── */
  async function igm2SaveProfilePerm(){
    if(!_curEtabId || !window.db || !window.fbDoc || !window.fbUpdateDoc) return;
    var ck = document.getElementById('igm2AllowEtabProfilePerm');
    var allowed = ck ? ck.checked : true;
    try {
      await window.fbUpdateDoc(window.fbDoc(window.db,'etablissements',_curEtabId),{ allowEtabProfilePhoto: allowed });
      igm2GallerySetStatus(allowed ? '🔓 L\'établissement peut choisir sa photo de profil.' : '🔒 Seul l\'admin peut choisir la photo de profil.','ok');
    } catch(e){ igm2GallerySetStatus('Erreur : ' + e.message,'err'); }
  }
  window.igm2SaveProfilePerm = igm2SaveProfilePerm;

  /* ── Sauvegarder la galerie dans Firestore ── */
  async function igm2GallerySave(){
    if(!_curEtabId || !window.db || !window.fbDoc || !window.fbUpdateDoc) return;
    var profilePhoto = (_gallery.find(function(p){return p.isProfile;})||{}).url || '';
    try {
      await window.fbUpdateDoc(window.fbDoc(window.db,'etablissements',_curEtabId),{
        gallery: _gallery,
        photo_profil: profilePhoto   // champ dédié photo de profil
      });
    } catch(e){ igm2GallerySetStatus('Erreur sauvegarde : ' + e.message,'err'); }
  }

  /* ── Lightbox rapide ── */
  function igm2GalleryLightbox(index){
    var p = _gallery[index]; if(!p) return;
    var viewer = document.getElementById('photoViewer');
    if(viewer){
      var img = viewer.querySelector('img');
      if(img){ img.src = p.url; img.alt = 'Photo galerie'; }
      viewer.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    }
  }
  window.igm2GalleryLightbox = igm2GalleryLightbox;

  /* ── Status bar helper ── */
  function igm2GallerySetStatus(html, type){
    var el = document.getElementById('igm2GalleryStatus');
    if(!el) return;
    el.innerHTML = html;
    el.className = 'igm-gallery-status' + (type ? ' ' + type : '');
    if(type === 'ok') setTimeout(function(){ if(el.className.indexOf('ok')!==-1) el.innerHTML=''; }, 3500);
  }

  /* ── Populate le picker après un import réussi (hook sur igm2StartImport) ── */
  var _origImport = window.igm2StartImport;
  window.igm2StartImport = async function(){
    await _origImport.apply(this, arguments);
    // Après import : recharger la liste depuis Firestore pour peupler le picker
    setTimeout(igm2GalleryRefreshPickerFromFirestore, 1200);
  };

  async function igm2GalleryRefreshPickerFromFirestore(){
    if(!window.db || !window.fbGetDocs || !window.fbCollection) return;
    try {
      var snap = await window.fbGetDocs(window.fbCollection(window.db,'etablissements'));
      var docs = [];
      snap.forEach(function(d){
        var v = d.data();
        docs.push({ firestoreId: d.id, nom: v.nom||'?', quartier: v.quartier||'', icon: '' });
      });
      docs.sort(function(a,b){ return a.nom.localeCompare(b.nom,'fr'); });
      igm2GalleryPopulatePicker(docs);
      var preview = document.getElementById('igm2ProfilePreview');
      if(preview) preview.style.display = 'none';
      igm2GalleryRender();
    } catch(e){}
  }

  console.log('[AMBI241] ✅ Module Galerie Photos (Import Maps) — chargé');
})();