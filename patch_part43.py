import re

with open('part43.js', 'r', encoding='utf-8') as f:
    content = f.read()

replacements = []

old1 = """  var _fm = {
    type: 'ambiance',
    mood: '\U0001F525',
    photos: [],     // base64 strings
    video: null,    // base64 string
    videoBlob: null,"""
new1 = """  var _fm = {
    type: 'ambiance',
    mood: '\U0001F525',
    photos: [],     // base64 strings (apercu local uniquement)
    photoFiles: [], // File objects reels - upload Cloudinary
    video: null,    // base64 string (apercu local uniquement)
    videoFile: null, // File video reel - upload Cloudinary
    videoBlob: null,"""
replacements.append((old1, new1))

old2 = """    var files = Array.from(inp.files||[]).slice(0, remain);
    files.forEach(function(file){
      if(!file.type.startsWith('image/')){ _toast('\u26A0\uFE0F Fichier non support\u00e9'); return; }
      var reader = new FileReader();
      reader.onload = function(ev){
        _fm.photos.push(ev.target.result);
        _renderMediaPreview();
        _updateModalCounters();
      };
      reader.readAsDataURL(file);
    });
    inp.value='';
  };"""
new2 = """    var files = Array.from(inp.files||[]).slice(0, remain);
    files.forEach(function(file){
      if(!file.type.startsWith('image/')){ _toast('\u26A0\uFE0F Fichier non support\u00e9'); return; }
      _fm.photoFiles.push(file);
      var reader = new FileReader();
      reader.onload = function(ev){
        _fm.photos.push(ev.target.result);
        _renderMediaPreview();
        _updateModalCounters();
      };
      reader.readAsDataURL(file);
    });
    inp.value='';
  };"""
replacements.append((old2, new2))

old3 = """      _fm.videoBlob = blobUrl;
      var reader = new FileReader();
      reader.onload = function(ev){ _fm.video = ev.target.result; _renderMediaPreview(); _updateModalCounters(); };
      reader.readAsDataURL(file);
      inp.value='';
    };
    tmpVid.onerror = function(){
      // Si on ne peut pas lire les metadata, on laisse passer (verification cote client echouee)
      _fm.videoBlob = blobUrl;
      var reader = new FileReader();
      reader.onload = function(ev){ _fm.video = ev.target.result; _renderMediaPreview(); _updateModalCounters(); };
      reader.readAsDataURL(file);
      inp.value='';
    };"""
new3 = """      _fm.videoBlob = blobUrl;
      _fm.videoFile = file;
      var reader = new FileReader();
      reader.onload = function(ev){ _fm.video = ev.target.result; _renderMediaPreview(); _updateModalCounters(); };
      reader.readAsDataURL(file);
      inp.value='';
    };
    tmpVid.onerror = function(){
      // Si on ne peut pas lire les metadata, on laisse passer (verification cote client echouee)
      _fm.videoBlob = blobUrl;
      _fm.videoFile = file;
      var reader = new FileReader();
      reader.onload = function(ev){ _fm.video = ev.target.result; _renderMediaPreview(); _updateModalCounters(); };
      reader.readAsDataURL(file);
      inp.value='';
    };"""
replacements.append((old3, new3))

old4 = """  window.forumRemovePhoto = function(i){ _fm.photos.splice(i,1); _renderMediaPreview(); _updateModalCounters(); };
  window.forumRemoveVideo = function(){ _fm.video=null; if(_fm.videoBlob){ URL.revokeObjectURL(_fm.videoBlob); _fm.videoBlob=null; } _renderMediaPreview(); _updateModalCounters(); };"""
new4 = """  window.forumRemovePhoto = function(i){ _fm.photos.splice(i,1); _fm.photoFiles.splice(i,1); _renderMediaPreview(); _updateModalCounters(); };
  window.forumRemoveVideo = function(){ _fm.video=null; _fm.videoFile=null; if(_fm.videoBlob){ URL.revokeObjectURL(_fm.videoBlob); _fm.videoBlob=null; } _renderMediaPreview(); _updateModalCounters(); };"""
replacements.append((old4, new4))

old5 = """    _fm.photos = [];
    _fm.video = null;
    _fm.videoBlob = null;"""
new5 = """    _fm.photos = [];
    _fm.photoFiles = [];
    _fm.video = null;
    _fm.videoFile = null;
    _fm.videoBlob = null;"""
replacements.append((old5, new5))

old6 = """  window.forumSubmitPost = function(){
    if(!_isLoggedIn()){ _toast('\U0001F512 Connectez-vous pour publier'); forumClosePubModal(); if(typeof window.openModal==='function') window.openModal('loginModal'); return; }
    if(_fm.submitting) return;
    var ta = document.getElementById('forumPubTextarea');
    var text = ta ? ta.value.trim() : '';
    if(!text && !_fm.photos.length && !_fm.video){ _toast('\u270D\uFE0F Ajoutez du texte, une photo ou une video'); return; }
    // Verifs limites
    var pc = _todayPhotoCount(), vc = _todayVideoCount();
    if(_fm.photos.length && pc + _fm.photos.length > 5){ _toast('\U0001F4F7 Limite de 5 photos/jour atteinte'); return; }
    if(_fm.video && vc >= 2){ _toast('\U0001F3AC Limite de 2 videos/jour atteinte'); return; }
    _fm.submitting = true;
    var sb = document.getElementById('forumSubmitBtn'); if(sb){ sb.disabled=true; sb.textContent='\u23F3 Publication\u2026'; }
    var pseudo = _pseudo(), uid = _uid(), ts = Date.now();
    var pubData = {
      type: _fm.type,
      mood: _fm.mood,
      text: text,
      pseudo: pseudo,
      author: pseudo,
      uid: uid,
      authorUid: uid,
      timestamp: ts,
      createdAt: new Date().toISOString(),
      likes: 0,
      comments: 0,
      photos: _fm.photos,
      video: _fm.video || null,
      hasVideo: !!_fm.video,
      visibility: 'public',
      expiresAt: null
    };
    if(_fm.video) pubData.expiresAt = new Date(ts + 2*24*60*60*1000).toISOString();
    // Sauvegarder Firebase
    if(_col() && window.fbAddDoc){
      window.fbAddDoc(_col(), pubData).then(function(ref){
        _incPhotoCount(_fm.photos.length);
        if(_fm.video) _incVideoCount();
        _toast('\U0001F680 Publication partagee avec la communaute !');
        forumClosePubModal();
        // Injecter la card en haut du feed
        var feed = document.getElementById('forumFeed');
        if(feed){
          var card = _buildCard(ref.id, pubData);
          card.classList.add('new-post');
          var firstCard = feed.querySelector('.forum-card');
          if(firstCard) feed.insertBefore(card, firstCard);
          else feed.insertBefore(card, feed.firstChild);
          var empty = document.getElementById('forumFeedEmpty'); if(empty) empty.style.display='none';
          // Mettre a jour compteur hero
          var hpc = document.getElementById('heroPostsCount');
          if(hpc){ var n=parseInt(hpc.textContent)||0; hpc.textContent=n+1; }
        }
        _fm.submitting=false;
      }).catch(function(e){
        _toast('\u274C Erreur lors de la publication : '+e.message);
        if(sb){ sb.disabled=false; sb.textContent='\U0001F680 Publier'; }
        _fm.submitting=false;
      });
    } else {
      // Pas de firebase, affichage local uniquement
      var feed2 = document.getElementById('forumFeed');
      if(feed2){
        var card2 = _buildCard('local_'+ts, pubData);
        feed2.insertBefore(card2, feed2.firstChild);
        var empty2 = document.getElementById('forumFeedEmpty'); if(empty2) empty2.style.display='none';
      }
      _toast('\u2705 Publication ajoutee (mode local)');
      forumClosePubModal();
      _fm.submitting=false;
    }
  };"""
new6 = """  function _forumUploadOne(file, folder, uid, ts){
    if(!window.fbStorage || !window.fbRef || !window.fbUploadBytes || !window.fbGetDownloadURL){
      return Promise.reject(new Error('Upload media indisponible'));
    }
    var ext = (file.type.split('/')[1]||'jpg').replace(/[^a-z0-9]/gi,'');
    var path = folder+'/'+uid+'_'+ts+'_'+Math.random().toString(36).slice(2,8)+'.'+ext;
    var ref = window.fbRef(window.fbStorage, path);
    return window.fbUploadBytes(ref, file).then(function(){
      return window.fbGetDownloadURL(ref);
    });
  }

  window.forumSubmitPost = function(){
    if(!_isLoggedIn()){ _toast('\U0001F512 Connectez-vous pour publier'); forumClosePubModal(); if(typeof window.openModal==='function') window.openModal('loginModal'); return; }
    if(_fm.submitting) return;
    var ta = document.getElementById('forumPubTextarea');
    var text = ta ? ta.value.trim() : '';
    if(!text && !_fm.photoFiles.length && !_fm.videoFile){ _toast('\u270D\uFE0F Ajoutez du texte, une photo ou une video'); return; }
    var pc = _todayPhotoCount(), vc = _todayVideoCount();
    if(_fm.photoFiles.length && pc + _fm.photoFiles.length > 5){ _toast('\U0001F4F7 Limite de 5 photos/jour atteinte'); return; }
    if(_fm.videoFile && vc >= 2){ _toast('\U0001F3AC Limite de 2 videos/jour atteinte'); return; }
    _fm.submitting = true;
    var sb = document.getElementById('forumSubmitBtn'); if(sb){ sb.disabled=true; sb.textContent='\u23F3 Envoi des medias\u2026'; }
    var pseudo = _pseudo(), uid = _uid(), ts = Date.now();

    var photoUploads = _fm.photoFiles.map(function(f){ return _forumUploadOne(f, 'forum/photos', uid, ts); });
    var videoUpload = _fm.videoFile ? _forumUploadOne(_fm.videoFile, 'forum/videos', uid, ts) : Promise.resolve(null);

    Promise.all(photoUploads).then(function(photoUrls){
      return videoUpload.then(function(videoUrl){ return { photoUrls: photoUrls, videoUrl: videoUrl }; });
    }).then(function(res){
      if(sb) sb.textContent='\u23F3 Publication\u2026';
      var pubData = {
        type: _fm.type,
        mood: _fm.mood,
        text: text,
        pseudo: pseudo,
        author: pseudo,
        uid: uid,
        authorUid: uid,
        timestamp: ts,
        createdAt: new Date().toISOString(),
        likes: 0,
        comments: 0,
        photos: res.photoUrls,
        video: res.videoUrl || null,
        hasVideo: !!res.videoUrl,
        visibility: 'public',
        expiresAt: null
      };
      if(res.videoUrl) pubData.expiresAt = new Date(ts + 2*24*60*60*1000).toISOString();
      if(_col() && window.fbAddDoc){
        return window.fbAddDoc(_col(), pubData).then(function(ref){
          _incPhotoCount(res.photoUrls.length);
          if(res.videoUrl) _incVideoCount();
          _toast('\U0001F680 Publication partagee avec la communaute !');
          forumClosePubModal();
          var feed = document.getElementById('forumFeed');
          if(feed){
            var card = _buildCard(ref.id, pubData);
            card.classList.add('new-post');
            var firstCard = feed.querySelector('.forum-card');
            if(firstCard) feed.insertBefore(card, firstCard);
            else feed.insertBefore(card, feed.firstChild);
            var empty = document.getElementById('forumFeedEmpty'); if(empty) empty.style.display='none';
            var hpc = document.getElementById('heroPostsCount');
            if(hpc){ var n=parseInt(hpc.textContent)||0; hpc.textContent=n+1; }
          }
          _fm.submitting=false;
        });
      } else {
        var feed2 = document.getElementById('forumFeed');
        if(feed2){
          var card2 = _buildCard('local_'+ts, pubData);
          feed2.insertBefore(card2, feed2.firstChild);
          var empty2 = document.getElementById('forumFeedEmpty'); if(empty2) empty2.style.display='none';
        }
        _toast('\u2705 Publication ajoutee (mode local)');
        forumClosePubModal();
        _fm.submitting=false;
      }
    }).catch(function(e){
      _toast('\u274C Erreur lors de l\\'envoi : '+(e && e.message ? e.message : 'inconnue'));
      if(sb){ sb.disabled=false; sb.textContent='\U0001F680 Publier'; }
      _fm.submitting=false;
    });
  };"""
replacements.append((old6, new6))

missing = []
for i, (old, new) in enumerate(replacements, 1):
    if old not in content:
        missing.append(i)
    else:
        content = content.replace(old, new, 1)

if missing:
    print("ECHEC - blocs introuvables:", missing)
else:
    with open('part43.js', 'w', encoding='utf-8') as f:
        f.write(content)
    print("OK - 6/6 remplacements appliques avec succes.")
