
(function() {
  'use strict';

  var WS_KEY  = 'ambi241_weeksong_v2';
  var _audio  = null;
  var _blob   = null;
  var _cfg    = null;
  var _active = false; // l'utilisateur a activé la lecture

  /* ── Charger la config au démarrage ── */
  function init() {
    try { _cfg = JSON.parse(localStorage.getItem(WS_KEY) || 'null'); } catch(e) {}
    // Ignorer les blob URLs (éphémères, ne survivent pas entre sessions)
    if (_cfg && _cfg.audioUrl && _cfg.audioUrl.startsWith('blob:')) {
      _cfg.audioUrl = '';
      _cfg.active = false;
    }
    _renderHeaderBtn();
    if (_cfg && _cfg.active && _cfg.audioUrl) {
      _buildAudio(_cfg.audioUrl);
    }
    // Sync Firebase si disponible
    setTimeout(_syncFirebase, 1500);
  }

  function _syncFirebase() {
    if (!window.db || !window.fbDoc) return;
    try {
      if (window.fbOnSnapshot) {
        window.fbOnSnapshot(
          window.fbDoc(window.db, 'config', 'week_song'),
          function(snap) {
            if (!snap.exists || !snap.exists()) return;
            var d = snap.data();
            if (!d) return;
            if (d.audioUrl && d.audioUrl.startsWith('blob:')) return;
            _cfg = d;
            try { localStorage.setItem(WS_KEY, JSON.stringify(d)); } catch(e) {}
            _renderHeaderBtn();
            /* Ne reconstruire l'audio que si l'URL a changé ou si l'audio n'existe pas encore */
            if (d.active && d.audioUrl && !d.audioUrl.startsWith('blob:')) {
              var currentSrc = _audio ? (_audio.src || '') : '';
              /* Comparer uniquement si l'URL est vraiment différente (évite de couper la lecture en cours) */
              var normalizedNew = decodeURIComponent(d.audioUrl).split('?')[0];
              var normalizedCur = decodeURIComponent(currentSrc).split('?')[0];
              if (!_audio || normalizedNew !== normalizedCur) {
                _buildAudio(d.audioUrl);
                /* Relancer la lecture si l'utilisateur avait activé */
                if (_active) {
                  _audio.addEventListener('canplay', function _onCp() {
                    _audio.removeEventListener('canplay', _onCp);
                    _audio.play().catch(function(){});
                  });
                }
              }
            } else if (!d.active && _audio) {
              _audio.pause();
            }
          },
          function() {}
        );
      } else if (window.fbGetDoc) {
        window.fbGetDoc(window.fbDoc(window.db, 'config', 'week_song')).then(function(snap) {
          if (!snap.exists || !snap.exists()) return;
          var d = snap.data();
          if (!d || (d.audioUrl && d.audioUrl.startsWith('blob:'))) return;
          _cfg = d;
          try { localStorage.setItem(WS_KEY, JSON.stringify(d)); } catch(e) {}
          _renderHeaderBtn();
          if (d.active && d.audioUrl && !_audio) _buildAudio(d.audioUrl);
        }).catch(function() {});
      }
    } catch(e) {}
  }

  /* ── Bouton header : toujours affiché, libellé selon état ── */
  function _renderHeaderBtn() {
    var btn = document.getElementById('weekSongHeaderBtn');
    if (!btn) return;
    // Icône seulement dans le header (pas de texte pour éviter le débordement)
    btn.innerHTML = '<span class="wshb-dot"></span>🎵';
    // Toujours visible — même sans chanson (pour que l'admin puisse y accéder)
    btn.style.display = 'flex';
  }

  /* ── Construire l'élément audio (avec fallback CORS automatique) ── */
  var _corsRetried = false;
  function _buildAudio(url, _noCors) {
    if (!url) return;
    /* Détruire l'instance précédente proprement */
    if (_audio) {
      _audio.pause();
      _audio.removeEventListener('timeupdate', _updateProgress);
      _audio.removeEventListener('loadedmetadata', _updateProgress);
      _audio.src = '';
      _audio = null;
    }
    _corsRetried = false;

    var a = new Audio();
    /* Premier essai SANS crossOrigin (compatibilité max — Firebase, CDN, hébergements simples).
       Si erreur MEDIA_ERR_SRC_NOT_SUPPORTED (code 4) → on retente avec crossOrigin='anonymous'
       uniquement si le serveur supporte CORS. */
    if (_noCors) {
      /* 2e tentative forcée sans crossOrigin — cas où CORS header absent */
    } else {
      /* Pas de crossOrigin par défaut pour maximiser la compatibilité */
    }
    a.preload = 'metadata';          // 'metadata' d'abord pour éviter téléchargement complet inutile
    a.volume  = 0.8;
    a.loop    = !_cfg || _cfg.loop !== false;

    a.addEventListener('canplay', function() {
      /* Audio prêt à jouer → passer en preload auto pour un buffering fluide */
      a.preload = 'auto';
    });
    a.addEventListener('timeupdate', _updateProgress);
    a.addEventListener('loadedmetadata', function() {
      _updateProgress();
      /* Synchroniser le volume depuis le slider si présent */
      var vol = document.getElementById('wspVol');
      if (vol) a.volume = vol.value / 100;
    });
    a.addEventListener('play',  function() { _setPlaying(true); });
    a.addEventListener('pause', function() { _setPlaying(false); });
    a.addEventListener('ended', function() {
      /* Fin de piste (loop=false) : remettre à zéro l'affichage */
      if (!a.loop) {
        _setPlaying(false);
        _updateProgress();
      }
    });
    a.addEventListener('error', function() {
      var code = a.error ? a.error.code : '?';
      var msg  = { 1:'Lecture annulée', 2:'Erreur réseau', 3:'Erreur de décodage', 4:'Source introuvable ou format non supporté' };
      console.error('[WeekSong] Erreur audio code', code, '— URL:', url);
      /* Tentative CORS automatique si code 4 et pas encore réessayé */
      if (code === 4 && !_corsRetried) {
        _corsRetried = true;
        console.warn('[WeekSong] Tentative CORS avec crossOrigin=anonymous…');
        var b = new Audio();
        b.crossOrigin = 'anonymous';
        b.preload = 'auto';
        b.volume  = a.volume;
        b.loop    = a.loop;
        b.addEventListener('timeupdate', _updateProgress);
        b.addEventListener('loadedmetadata', _updateProgress);
        b.addEventListener('play',  function() { _setPlaying(true); });
        b.addEventListener('pause', function() { _setPlaying(false); });
        b.addEventListener('ended', function() { if (!b.loop) { _setPlaying(false); _updateProgress(); } });
        b.addEventListener('error', function() {
          console.error('[WeekSong] Échec CORS également. URL inaccessible:', url);
          /* Tenter le blob de session si disponible */
          if (typeof _wsamCurrentBlobUrl !== 'undefined' && _wsamCurrentBlobUrl) {
            console.warn('[WeekSong] Tentative fallback blob local…');
            var c = new Audio();
            c.volume  = b.volume;
            c.loop    = b.loop;
            c.addEventListener('timeupdate', _updateProgress);
            c.addEventListener('loadedmetadata', _updateProgress);
            c.addEventListener('play',  function() { _setPlaying(true); });
            c.addEventListener('pause', function() { _setPlaying(false); });
            c.addEventListener('error', function() {
              if (typeof showToast === 'function') showToast('❌ Audio inaccessible — vérifiez les règles Firebase Storage (lecture publique requise)');
            });
            _audio = c;
            c.src = _wsamCurrentBlobUrl;
            c.load();
            if (_active) c.play().catch(function(){});
          } else {
            if (typeof showToast === 'function') showToast('❌ Audio inaccessible — vérifiez les règles Firebase Storage (lecture publique requise)');
          }
        });
        _audio = b;
        b.src = url;
        b.load();
        /* Si l'utilisateur avait déjà cliqué play, retenter */
        if (_active) b.play().catch(function(){});
        return;
      }
      if (typeof showToast === 'function') showToast('⚠️ ' + (msg[code] || 'Erreur audio code ' + code));
    });

    _audio = a;
    a.src = url;
    a.load();
    _fillPlayer();
    /* Appliquer le volume sauvegardé */
    var vol = document.getElementById('wspVol');
    if (vol) {
      vol.value = (_cfg && _cfg.volume) || 80;
      a.volume  = vol.value / 100;
    }
  }

  /* ── Remplir les infos du player ── */
  function _fillPlayer() {
    if (!_cfg) return;
    var t = document.getElementById('wspTitle');
    var ar = document.getElementById('wspArtist');
    var art = document.getElementById('wspArt');
    var topT = document.getElementById('wspTopbarTitle');
    if (t)  t.textContent  = _cfg.title  || 'Chanson de la semaine';
    if (ar) ar.textContent = _cfg.artist || 'AMBI241';
    if (topT) topT.textContent = _cfg.title || 'Chanson de la semaine';
    if (art) {
      var u = _cfg.artUrl;
      art.innerHTML = (u && (u.startsWith('http') || u.startsWith('data:')))
        ? '<img src="' + u + '" alt="">' : '🎵';
    }
  }

  /* ── Activer au clic utilisateur ── */
  window.weekSongUserActivate = function() {
    /* Pas de chanson configurée → ouvrir le modal admin si admin, sinon toast */
    if (!_cfg || !_cfg.active || !_cfg.audioUrl) {
      var adminBtn = document.getElementById('adminBtn');
      if (adminBtn && adminBtn.style.display !== 'none') {
        document.getElementById('weekSongAdminModal').classList.add('show');
        wsamLoad();
      } else {
        if (typeof showToast === 'function') showToast('🎵 Aucune chanson de la semaine disponible pour l\'instant');
      }
      return;
    }
    _active = true;
    var player = document.getElementById('weekSongPlayer');
    if (player) { player.classList.add('show'); document.body.classList.add('wsp-open'); if(window._syncPlayerH) window._syncPlayerH(); }

    /* ★ CORRECTIF PRINCIPAL : si l'audio n'est pas encore initialisé
       (ex. Firebase sync pas encore terminée, ou premier clic après reload),
       on reconstruit l'objet audio avant de tenter la lecture. */
    if (!_audio && _cfg.audioUrl) {
      _buildAudio(_cfg.audioUrl);
      /* Attendre canplay avant de lancer la lecture (robustesse mobile) */
      var _started = false;
      _audio.addEventListener('canplay', function onCanPlay() {
        if (!_started) {
          _started = true;
          _audio.removeEventListener('canplay', onCanPlay);
          _audio.play().catch(function() {
            if (typeof showToast === 'function') showToast('▶ Appuyez sur le bouton play pour démarrer');
          });
        }
      });
      return;
    }
    _play();
  };

  window.weekSongToggle = function() {
    /* Si l'audio n'existe pas encore, le reconstruire et jouer */
    if (!_audio) {
      if (_cfg && _cfg.audioUrl) { weekSongUserActivate(); }
      return;
    }
    if (_audio.paused) _play(); else _audio.pause();
  };

  function _play() {
    if (!_audio) return;
    var player = document.getElementById('weekSongPlayer');
    if (player) { player.classList.add('show'); document.body.classList.add('wsp-open'); }
    /* Si la piste est terminée (ended), revenir au début */
    if (!_audio.loop && _audio.currentTime >= (_audio.duration || 0) && _audio.duration > 0) {
      _audio.currentTime = 0;
    }
    var p = _audio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(function(err) {
        /* NotAllowedError = politique autoplay navigateur → l'utilisateur doit cliquer sur ▶ */
        if (err && err.name === 'NotAllowedError') {
          if (typeof showToast === 'function') showToast('▶ Appuyez sur le bouton play pour démarrer');
        } else {
          console.warn('[WeekSong] play() rejeté:', err);
          if (typeof showToast === 'function') showToast('⚠️ Lecture impossible — vérifiez votre connexion');
        }
      });
    }
  }

  window.weekSongSeek = function(delta) {
    if (!_audio) return;
    _audio.currentTime = Math.max(0, Math.min(_audio.duration || 0, _audio.currentTime + delta));
  };

  window.weekSongClose = function() {
    if (_audio) _audio.pause();
    _active = false;
    var player = document.getElementById('weekSongPlayer');
    if (player) { player.classList.remove('show'); player.classList.remove('minimized'); }
    document.body.classList.remove('wsp-open');
    document.body.classList.remove('wsp-minimized'); if(window._syncPlayerH) window._syncPlayerH();
    if(window._syncPlayerH) window._syncPlayerH();
    _setPlaying(false);
  };

  window.weekSongToggleMinimize = function() {
    var player = document.getElementById('weekSongPlayer');
    if (!player) return;
    var isMin = player.classList.contains('minimized');
    var btn = document.getElementById('wspMinimizeBtn');
    var topTitle = document.getElementById('wspTopbarTitle');
    if (isMin) {
      player.classList.remove('minimized');
      document.body.classList.remove('wsp-minimized');
      if (btn) { btn.innerHTML = '&#x2014;'; btn.title = 'R\u00e9duire'; }
      if (topTitle) topTitle.textContent = 'Chanson de la semaine';
    } else {
      player.classList.add('minimized');
      document.body.classList.add('wsp-minimized'); if(window._syncPlayerH) window._syncPlayerH();
      var titre = document.getElementById('wspTitle');
      var label = (titre && titre.textContent) ? titre.textContent : 'Chanson de la semaine';
      if (btn) { btn.innerHTML = '&#x25a1;'; btn.title = 'Agrandir'; }
      if (topTitle) topTitle.textContent = label;
    }
  };

  function _setPlaying(playing) {
    var btn  = document.getElementById('wspPlayBtn');
    var wave = document.getElementById('wspWave');
    if (btn)  btn.textContent = playing ? '⏸' : '▶';
    if (wave) { if (playing) wave.classList.add('on'); else wave.classList.remove('on'); }
  }

  function _updateProgress() {
    if (!_audio) return;
    var cur = _audio.currentTime || 0, dur = _audio.duration || 0;
    var bar = document.getElementById('wspProgBar');
    var tim = document.getElementById('wspTime');
    if (bar) bar.style.width = (dur > 0 ? cur / dur * 100 : 0) + '%';
    if (tim) tim.textContent = _fmt(cur) + ' / ' + _fmt(dur);
  }

  function _fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    return Math.floor(s / 60) + ':' + ('0' + Math.floor(s % 60)).slice(-2);
  }

  /* Volume */
  document.addEventListener('DOMContentLoaded', function() {
    var vol = document.getElementById('wspVol');
    if (vol) vol.addEventListener('input', function() { if (_audio) _audio.volume = this.value / 100; });
    /* Clic sur barre de progression */
    var pw = document.getElementById('wspProgWrap');
    if (pw) pw.addEventListener('click', function(e) {
      if (!_audio || !_audio.duration) return;
      _audio.currentTime = ((e.clientX - pw.getBoundingClientRect().left) / pw.offsetWidth) * _audio.duration;
    });
  });

  /* ════════════════════════════════════════════════════════
     ADMIN — Configuration de la chanson
  ════════════════════════════════════════════════════════ */

  /* Pré-remplir le modal admin */
  function wsamLoad() {
    var c = _cfg || {};
    _val('wsamTitle',    c.title    || '');
    _val('wsamArtist',   c.artist   || '');
    _val('wsamArtUrl',   c.artUrl   || '');
    _val('wsamAudioUrl', c.audioUrl || '');
    var active = document.getElementById('wsamActive');
    var loop   = document.getElementById('wsamLoop');
    if (active) active.checked = c.active !== false;
    if (loop)   loop.checked   = c.loop   !== false;
    var ok = document.getElementById('wsamAudioOk');
    var okT = document.getElementById('wsamAudioOkTxt');
    if (ok && c.audioUrl) { ok.classList.add('show'); if (okT) okT.textContent = 'Audio configuré'; }
    else if (ok) ok.classList.remove('show');
  }
  window.wsamLoad = wsamLoad;
  window._weekSongGetCfg = function() { return _cfg; };

  function _val(id, v) { var e = document.getElementById(id); if (e) e.value = v; }
  function _get(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }
  function _chk(id) { var e = document.getElementById(id); return e ? e.checked : false; }

  /* ══════════════════════════════════════════════════════
     OPTION B — URL DISTANTE (Google Drive, Dropbox, lien direct)
  ══════════════════════════════════════════════════════ */

  /* Basculer entre onglet URL et onglet Fichier local */
  window.wsamSrcTab = function(tab) {
    var tabUrl  = document.getElementById('wsTabUrl');
    var tabFile = document.getElementById('wsTabFile');
    var panUrl  = document.getElementById('wsamPanelUrl');
    var panFile = document.getElementById('wsamPanelFile');
    if (tab === 'url') {
      if (tabUrl)  tabUrl.classList.add('active');
      if (tabFile) tabFile.classList.remove('active');
      if (panUrl)  panUrl.style.display  = '';
      if (panFile) panFile.style.display = 'none';
    } else {
      if (tabUrl)  tabUrl.classList.remove('active');
      if (tabFile) tabFile.classList.add('active');
      if (panUrl)  panUrl.style.display  = 'none';
      if (panFile) panFile.style.display = '';
    }
  };

  /* Convertir automatiquement les liens Google Drive et Dropbox en lien direct */
  window.wsamConvertUrl = function() {
    var input = document.getElementById('wsamAudioUrl');
    if (!input) return;
    var url = (input.value || '').trim();
    if (!url) { if (typeof showToast === 'function') showToast('⚠️ Collez d\'abord une URL'); return; }

    var converted = url;

    /* Google Drive — plusieurs formats possibles */
    var gdMatch = url.match(/drive\.google\.com\/file\/d\/([^\/\?&]+)/);
    if (!gdMatch) gdMatch = url.match(/drive\.google\.com\/open\?id=([^&]+)/);
    if (!gdMatch) gdMatch = url.match(/id=([^&]+)/);
    if (gdMatch && url.indexOf('drive.google.com') !== -1) {
      converted = 'https://drive.google.com/uc?export=download&id=' + gdMatch[1];
      input.value = converted;
      _showTestResult('', '');
      if (typeof showToast === 'function') showToast('✅ Lien Google Drive converti ! Cliquez Tester.');
      return;
    }

    /* Dropbox */
    if (url.indexOf('dropbox.com') !== -1) {
      converted = url
        .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
        .replace(/[?&]dl=0/, '')
        .replace(/[?&]dl=1/, '');
      if (converted.indexOf('?') === -1) converted += '?raw=1';
      else converted += '&raw=1';
      input.value = converted;
      _showTestResult('', '');
      if (typeof showToast === 'function') showToast('✅ Lien Dropbox converti ! Cliquez Tester.');
      return;
    }

    if (typeof showToast === 'function') showToast('ℹ️ Lien déjà au format direct ou non reconnu');
  };

  /* Tester si l'URL est lisible comme audio */
  window.wsamTestUrl = function() {
    var url = (document.getElementById('wsamAudioUrl') || {}).value || '';
    url = url.trim();
    if (!url) { if (typeof showToast === 'function') showToast('⚠️ Entrez une URL d\'abord'); return; }

    _showTestResult('⏳ Test en cours…', '');
    if (typeof showToast === 'function') showToast('⏳ Test de l\'URL audio…');

    var testAudio = new Audio();
    var done = false;

    var timeout = setTimeout(function() {
      if (done) return; done = true;
      testAudio.src = '';
      _showTestResult('err', '❌ Timeout — URL trop lente ou inaccessible depuis ce navigateur');
    }, 10000);

    testAudio.addEventListener('canplay', function() {
      if (done) return; done = true;
      clearTimeout(timeout);
      testAudio.src = '';
      _showTestResult('ok', '✅ URL valide — audio lisible !');
      /* Marquer l'audio comme prêt */
      var ok  = document.getElementById('wsamAudioOk');
      var okT = document.getElementById('wsamAudioOkTxt');
      if (ok) ok.classList.add('show');
      if (okT) okT.textContent = '✅ URL testée et fonctionnelle';
      if (typeof showToast === 'function') showToast('✅ URL audio OK !');
    });

    testAudio.addEventListener('error', function() {
      if (done) return; done = true;
      clearTimeout(timeout);
      var code = testAudio.error ? testAudio.error.code : '?';
      var msgs = {1:'Lecture annulée',2:'Erreur réseau ou CORS',3:'Décodage impossible',4:'Format non supporté ou URL invalide'};
      _showTestResult('err', '❌ ' + (msgs[code] || 'Erreur inconnue') + ' — vérifiez le lien et les droits de partage');
      if (typeof showToast === 'function') showToast('❌ URL inaccessible');
    });

    testAudio.src = url;
    testAudio.load();
  };

  function _showTestResult(cls, msg) {
    var el = document.getElementById('wsamUrlTestResult');
    if (!el) return;
    el.className = 'wsam-url-test-result' + (cls ? ' ' + cls : '');
    el.textContent = msg;
  }

  /* Réinitialiser l'indicateur quand l'URL change manuellement */
  window.wsamUrlChanged = function() {
    _showTestResult('', '');
    var ok = document.getElementById('wsamAudioOk');
    if (ok) ok.classList.remove('show');
  };

  /* Fichier local → blob URL (session uniquement) */
  var _wsamCurrentBlobUrl = null;

  window.wsamLoadFile = function(input) {
    var file = input.files[0];
    if (!file) return;

    if (!file.type.startsWith('audio/') && !/\.(mp3|aac|ogg|wav|m4a|flac)$/i.test(file.name)) {
      if (typeof showToast === 'function') showToast('⚠️ Format non supporté — MP3, AAC, OGG, WAV uniquement');
      return;
    }

    if (_wsamCurrentBlobUrl) { try { URL.revokeObjectURL(_wsamCurrentBlobUrl); } catch(e){} }
    _wsamCurrentBlobUrl = URL.createObjectURL(file);

    /* Lire la durée */
    var tmp = new Audio();
    tmp.addEventListener('loadedmetadata', function() {
      var label = '⚠️ ' + file.name + (tmp.duration > 0 ? ' · ' + _fmt(tmp.duration) : '') + ' (local — session uniquement)';
      var ok  = document.getElementById('wsamAudioOk');
      var okT = document.getElementById('wsamAudioOkTxt');
      if (ok) ok.classList.add('show');
      if (okT) okT.textContent = label;
      tmp.src = '';
    });
    tmp.src = _wsamCurrentBlobUrl;

    /* Mettre l'URL dans le champ caché pour wsamSave */
    document.getElementById('wsamAudioUrl').value = _wsamCurrentBlobUrl;
    if (typeof showToast === 'function') showToast('📁 ' + file.name + ' chargé (session)');
  };

  /* Preview pochette */
  window.wsamPrevArt = function(url) {}; // pas d'aperçu dans la version légère

  /* Sauvegarder */
  window.wsamSave = function() {
    var title    = _get('wsamTitle');
    var audioUrl = _get('wsamAudioUrl');
    if (!title)    { if (typeof showToast==='function') showToast('⚠️ Saisissez un titre'); return; }
    if (!audioUrl) { if (typeof showToast==='function') showToast('⚠️ Entrez une URL audio ou choisissez un fichier local'); return; }
    if (audioUrl.startsWith('blob:')) {
      if (typeof showToast==='function') showToast('⚠️ Fichier local — actif uniquement cette session. Pour du permanent, utilisez une URL distante.');
    }
    var cfg = {
      title:    title,
      artist:   _get('wsamArtist'),
      artUrl:   _get('wsamArtUrl'),
      audioUrl: audioUrl,
      active:   _chk('wsamActive'),
      loop:     _chk('wsamLoop'),
      volume:   parseInt((document.getElementById('wspVol') || {value:80}).value) || 80,
      updatedAt: Date.now()
    };
    _cfg = cfg;
    try { localStorage.setItem(WS_KEY, JSON.stringify(cfg)); } catch(e) {}
    /* Firebase */
    if (window.db && window.fbDoc && window.fbSetDoc) {
      window.fbSetDoc(window.fbDoc(window.db, 'config', 'week_song'), cfg)
        .then(function() { if(typeof showToast==='function') showToast('✅ Chanson de la semaine publiée !'); })
        .catch(function() { if(typeof showToast==='function') showToast('✅ Sauvegardé (Firebase hors ligne)'); });
    } else {
      if (typeof showToast === 'function') showToast('✅ Chanson sauvegardée !');
    }
    _renderHeaderBtn();
    _buildAudio(audioUrl);
    document.getElementById('weekSongAdminModal').classList.remove('show');
  };

  /* Effacer */
  window.wsamClear = function() {
    if (!confirm('Supprimer la chanson de la semaine ?')) return;
    _cfg = { active: false, audioUrl: '', title: '', updatedAt: Date.now() };
    try { localStorage.setItem(WS_KEY, JSON.stringify(_cfg)); } catch(e) {}
    if (window.db && window.fbDoc && window.fbSetDoc) {
      window.fbSetDoc(window.fbDoc(window.db, 'config', 'week_song'), _cfg).catch(function(){});
    }
    if (_audio) { _audio.pause(); _audio = null; }
    weekSongClose();
    _renderHeaderBtn();
    document.getElementById('weekSongAdminModal').classList.remove('show');
    if (typeof showToast === 'function') showToast('🗑 Chanson retirée');
  };

  /* Accès admin via bouton header si admin connecté */
  window.weekSongOpenAdmin = function() {
    wsamLoad();
    document.getElementById('weekSongAdminModal').classList.add('show');
  };

  /* Brancher bouton header : clic long = admin, clic court = play */
  document.addEventListener('DOMContentLoaded', function() {
    var btn = document.getElementById('weekSongHeaderBtn');
    if (!btn) return;
    var holdTimer;
    btn.addEventListener('pointerdown', function() {
      holdTimer = setTimeout(function() {
        /* Appui long → ouvrir admin si admin connecté */
        var adminBtn = document.getElementById('adminBtn');
        if (adminBtn && adminBtn.style.display !== 'none') {
          wsamLoad();
          document.getElementById('weekSongAdminModal').classList.add('show');
        }
      }, 600);
    });
    btn.addEventListener('pointerup',     function() { clearTimeout(holdTimer); });
    btn.addEventListener('pointercancel', function() { clearTimeout(holdTimer); });
  });

  /* Bouton 🎵 Son déjà intégré en HTML dans adminTabs — pas d'injection JS nécessaire */

  /* Init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
