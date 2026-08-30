
(function(){
  // ══ MOTEUR OSM — Nominatim + Overpass (100% gratuit, sans clé API) ══
  var _igmResults = [];
  var _igmSelectedIds = new Set();
  var _igmSelectedCats = new Set(['Bar','Bar Terrasse','Snack','Restaurant','Discotheque',]);

  // Mapping catégorie → tags Overpass OSM + mots-clés Nominatim
  var IGM_CAT_CONFIG = {
    "Bar":          {label:"Bars",             icon:"🍺",
      overpassTags: [["amenity","bar"],["amenity","pub"],["amenity","lounge"]],
      queries:["bar Libreville","pub Libreville","lounge Libreville"]},
    "Bar Terrasse": {label:"Bar Terrasses",    icon:"🌴",
      overpassTags: [["amenity","bar"],["amenity","pub"]],
      queries:["bar terrasse Libreville","rooftop bar Libreville"]},
    "Snack":        {label:"Snacks",           icon:"🍾",
      overpassTags: [["amenity","fast_food"],["amenity","snack_bar"],["amenity","food_court"]],
      queries:["snack Libreville","fast food Libreville","maquis Libreville"]},
    "Restaurant":   {label:"Restos & Pâtiss.",icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"1.1em\" height=\"0.8em\" style=\"display:inline-block;vertical-align:middle;flex-shrink:0;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>",
      overpassTags: [["amenity","restaurant"],["amenity","cafe"],["shop","bakery"]],
      queries:["restaurant Libreville","patisserie Libreville","café Libreville"]},
    "Discotheque":  {label:"Boîtes de Nuit",  icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 30\" width=\"1.1em\" height=\"0.8em\" style=\"flex-shrink:0;vertical-align:middle;\"><circle cx=\"11\" cy=\"4\" r=\"3\" fill=\"#ff2d9b\"/><path d=\"M11 7 Q7 13 5 20 Q8 18 11 19 Q14 18 17 20 Q15 13 11 7Z\" fill=\"#ff2d9b\"/><line x1=\"11\" y1=\"10\" x2=\"5\" y2=\"6\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"11\" y1=\"10\" x2=\"17\" y2=\"13\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"9\" y1=\"19\" x2=\"6\" y2=\"27\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"19\" x2=\"16\" y2=\"26\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"37\" cy=\"4\" r=\"3\" fill=\"#cc44ff\"/><line x1=\"37\" y1=\"7\" x2=\"37\" y2=\"19\" stroke=\"#cc44ff\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"11\" x2=\"31\" y2=\"13\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"11\" x2=\"43\" y2=\"7\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"19\" x2=\"33\" y2=\"27\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"19\" x2=\"41\" y2=\"26\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><text x=\"21\" y=\"13\" font-size=\"8\" fill=\"#ffd700\">♪</text></svg>",
      overpassTags: [["amenity","nightclub"],["amenity","music_venue"]],
      queries:["nightclub Libreville","discothèque Libreville","boite de nuit Libreville"]}
  };

  var IGM_QUARTIERS = ["Centre-ville","Akanda","Glass","Libreville","Louis","Owendo","Nombakélé","Batterie IV","PK5","PK8","PK12","Angondjé","Nzeng-Ayong","La Sablière"];

  /* ── Init : charger les existants depuis Firebase ── */
  function igmInit() {
    window._igmInited = true;
    igmReset(false);
    // Afficher l'info de domaine actuel pour le diagnostic
    var statusEl = document.getElementById('igmSearchStatus');
    if(statusEl) statusEl.textContent = '📡 Domaine : ' + window.location.hostname + ' — Prêt à lancer la recherche';
    if(!window.db || !window.fbGetDocs || !window.fbCollection){
      if(statusEl) statusEl.textContent += ' (Firebase non connecté — existants non chargés)';
      return;
    }
    window.fbGetDocs(window.fbCollection(window.db, 'etablissements')).then(function(snap){
      var existing = new Set();
      var maxId = 0;
      snap.forEach(function(d){
        var data = d.data();
        if(data.nom) existing.add(data.nom.toLowerCase().trim());
        if(data.place_id) existing.add(data.place_id);
        if(data.id && data.id > maxId) maxId = data.id;
      });
      window._igmExisting = existing;
      window._igmMaxId = maxId;
      if(statusEl) statusEl.textContent = '✅ ' + snap.size + ' établissements déjà en base. Sélectionnez les catégories et lancez la recherche.';
    }).catch(function(e){
      if(statusEl) statusEl.textContent = '⚠️ Erreur Firebase : ' + e.message;
    });
  }
  window.igmInit = igmInit;

  /* ── Reset ── */
  function igmReset(reload) {
    _igmResults = [];
    _igmSelectedIds.clear();
    if(reload !== false) {
      igmSetStep(1);
      document.querySelectorAll('#igmLogWrap,#igmImportLog').forEach(function(el){ el.innerHTML=''; });
      document.getElementById('igmImportDone').style.display = 'none';
      document.getElementById('igmResultsList').innerHTML = '';
    }
  }
  window.igmReset = igmReset;

  /* ── Étapes ── */
  function igmSetStep(n) {
    [1,2,3,4].forEach(function(i){
      var s = document.getElementById('igm-step'+i);
      var sec = document.getElementById('igm-sec'+i);
      if(s){ s.classList.toggle('igm-active', i===n); s.classList.toggle('igm-done', i<n); }
      if(sec) sec.classList.toggle('igm-active', i===n);
    });
  }

  /* ── Toggles catégories ── */
  function igmToggleCat(el) {
    var key = el.dataset.key;
    if(_igmSelectedCats.has(key)) _igmSelectedCats.delete(key);
    else _igmSelectedCats.add(key);
    el.classList.toggle('igm-cat-sel', _igmSelectedCats.has(key));
  }
  window.igmToggleCat = igmToggleCat;

  /* ── Log ── */
  function igmLog(msg, type) {
    var wrap = document.getElementById('igmLogWrap');
    if(!wrap) return;
    var line = document.createElement('div');
    line.className = 'igm-log-line' + (type ? ' igm-'+type : '');
    line.textContent = new Date().toLocaleTimeString('fr') + ' — ' + msg;
    wrap.appendChild(line);
    wrap.scrollTop = wrap.scrollHeight;
  }

  /* ── Progression ── */
  function igmSetProgress(pct, label, detail) {
    var fill = document.getElementById('igmProgressFill');
    var lbl  = document.getElementById('igmProgressLabel');
    var det  = document.getElementById('igmProgressDetail');
    var stat = document.getElementById('igmSearchStatus');
    if(fill) fill.style.width = pct + '%';
    if(lbl) lbl.textContent = Math.round(pct) + '%';
    if(det && detail) det.textContent = detail;
    if(stat && label) stat.textContent = label;
  }

  /* ══════════════════════════════════════════════════════════
     MOTEUR OSM — double stratégie sans clé API :
     1) Overpass API — données structurées OSM (tags amenity/tourism)
     2) Nominatim    — recherche textuelle en fallback
     ══════════════════════════════════════════════════════════ */

  // Libreville bounding box : sud,ouest,nord,est
  var IGM_BBOX = '0.25,9.35,0.55,9.60';
  var IGM_CENTER = {lat: 0.4162, lng: 9.4673};

  /* ── Recherche Overpass (tags OSM) ── */
  function igmSearchOverpass(tagPairs) {
    // Construire la requête Overpass QL
    var nodeQueries = tagPairs.map(function(pair){
      return 'node["' + pair[0] + '"="' + pair[1] + '"](' + IGM_BBOX + ');';
    }).join('\n');
    var wayQueries = tagPairs.map(function(pair){
      return 'way["' + pair[0] + '"="' + pair[1] + '"](' + IGM_BBOX + ');';
    }).join('\n');
    var query = '[out:json][timeout:25];\n(\n' + nodeQueries + '\n' + wayQueries + '\n);\nout center;';

    var OVERPASS_ENDPOINTS = [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.kumi.systems/api/interpreter'
    ];

    function tryEndpoint(idx) {
      return fetch(OVERPASS_ENDPOINTS[idx], {
        method: 'POST',
        headers: {'Content-Type': 'application/x-www-form-urlencoded'},
        body: 'data=' + encodeURIComponent(query)
      })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){
        return (data.elements || []).map(function(el){
          var tags = el.tags || {};
          var lat = el.lat || (el.center && el.center.lat) || 0;
          var lng = el.lon || (el.center && el.center.lon) || 0;
          var addr = [tags['addr:street'], tags['addr:city'] || 'Libreville'].filter(Boolean).join(', ');
          return {
            place_id: 'osm_' + el.type + '_' + el.id,
            name: tags.name || tags['name:fr'] || null,
            formatted_address: addr || 'Libreville, Gabon',
            rating: 0,
            user_ratings_total: 0,
            geometry: { location: { lat: lat, lng: lng } }
          };
        }).filter(function(p){ return p.name; }); // ignorer sans nom
      })
      .catch(function(e){
        if(idx + 1 < OVERPASS_ENDPOINTS.length) return tryEndpoint(idx + 1);
        throw e;
      });
    }
    return tryEndpoint(0);
  }

  /* ── Recherche Nominatim (texte libre) ── */
  function igmSearchNominatim(query) {
    var url = 'https://nominatim.openstreetmap.org/search'
      + '?q=' + encodeURIComponent(query + ' Gabon')
      + '&format=json'
      + '&limit=20'
      + '&addressdetails=1'
      + '&bounded=1'
      + '&viewbox=9.35,0.55,9.60,0.25'
      + '&accept-language=fr';
    return fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'AMBI241-App/1.0' } })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(data){
        return (data || []).map(function(el){
          var addr = el.display_name || 'Libreville, Gabon';
          return {
            place_id: 'nom_' + el.osm_type + '_' + el.osm_id,
            name: el.namedetails && el.namedetails.name ? el.namedetails.name : el.display_name.split(',')[0],
            formatted_address: addr,
            rating: 0,
            user_ratings_total: 0,
            geometry: { location: { lat: parseFloat(el.lat), lng: parseFloat(el.lon) } }
          };
        });
      });
  }

  /* ── Normaliser un résultat OSM → format commun (déjà normalisé ci-dessus) ── */
  function igmNormalizeREST(p) {
    return p; // déjà normalisé dans igmSearchOverpass / igmSearchNominatim
  }

  /* ── Helpers ── */
  function igmIsExisting(place) {
    if(!window._igmExisting) return false;
    if(place.place_id && window._igmExisting.has(place.place_id)) return true;
    if(place.name && window._igmExisting.has(place.name.toLowerCase().trim())) return true;
    return false;
  }

  function igmExtractQuartier(addr) {
    if(!addr) return 'Libreville';
    for(var i=0;i<IGM_QUARTIERS.length;i++){
      if(addr.toLowerCase().indexOf(IGM_QUARTIERS[i].toLowerCase()) !== -1) return IGM_QUARTIERS[i];
    }
    return 'Libreville';
  }

  function igmEsc(s) {
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Traiter un lot de résultats ── */
  function igmProcessResults(rawResults, catKey, seen, isREST) {
    var newFound = 0;
    for(var ri=0; ri<rawResults.length; ri++){
      var p = isREST ? igmNormalizeREST(rawResults[ri]) : rawResults[ri];
      if(!p.place_id || seen.has(p.place_id)) continue;
      seen.add(p.place_id);
      var existing = igmIsExisting(p);
      var lat = 0, lng = 0;
      try {
        if(p.geometry && p.geometry.location){
          lat = typeof p.geometry.location.lat === 'function' ? p.geometry.location.lat() : p.geometry.location.lat;
          lng = typeof p.geometry.location.lng === 'function' ? p.geometry.location.lng() : p.geometry.location.lng;
        }
      } catch(e){}
      _igmResults.push({
        place_id: p.place_id,
        nom: p.name,
        adresse: p.formatted_address || p.vicinity || '',
        quartier: igmExtractQuartier(p.formatted_address || p.vicinity || ''),
        note: p.rating || 0,
        avis: p.user_ratings_total || 0,
        lat: lat, lng: lng,
        catKey: catKey, type: catKey,
        isExisting: existing,
        selected: !existing
      });
      if(!existing) newFound++;
    }
    return newFound;
  }

  /* ══════════════════════════════════════════════════════════
     LANCER LA RECHERCHE — Overpass d'abord, Nominatim en fallback
     ══════════════════════════════════════════════════════════ */
  async function igmStartSearch() {
    if(_igmSelectedCats.size === 0){
      if(typeof showToast==='function') showToast('⚠️ Sélectionne au moins une catégorie');
      return;
    }
    igmSetStep(2);
    _igmResults = [];
    var seen = new Set();

    var cats   = Array.from(_igmSelectedCats);
    var totalQ = cats.reduce(function(s,c){ return s + IGM_CAT_CONFIG[c].queries.length; }, 0);
    var done   = 0;

    igmLog('🗺️ Recherche via OpenStreetMap (gratuit, sans clé API)...');
    igmLog('📡 Démarrage — ' + totalQ + ' requêtes en cours...');

    try {
      for(var ci=0; ci<cats.length; ci++){
        var catKey = cats[ci];
        var cfg    = IGM_CAT_CONFIG[catKey];
        igmLog('📂 Catégorie : ' + cfg.label);

        // ── 1. Overpass : tags OSM structurés ──
        try {
          igmLog('  → Overpass tags OSM (' + cfg.overpassTags.length + ' tags)...');
          var overpassRes = await igmSearchOverpass(cfg.overpassTags);
          var newOv = igmProcessResults(overpassRes, catKey, seen, true);
          igmLog('  ✓ Overpass : ' + overpassRes.length + ' trouvés (' + newOv + ' nouveaux)', 'ok');
        } catch(e) {
          igmLog('  ⚠️ Overpass indisponible : ' + e.message + ' → Nominatim...', 'warn');
        }

        // ── 2. Nominatim : recherche textuelle ──
        for(var qi=0; qi<cfg.queries.length; qi++){
          var q = cfg.queries[qi];
          done++;
          igmSetProgress((done/totalQ)*100, 'Nominatim : "' + q + '"', done+'/'+totalQ+' requêtes');
          igmLog('  → Nominatim "' + q + '"');

          try {
            var nomRes = await igmSearchNominatim(q);
            var newNom = igmProcessResults(nomRes, catKey, seen, true);
            igmLog('  ✓ ' + nomRes.length + ' résultats (' + newNom + ' nouveaux)', 'ok');
            var cntEl = document.getElementById('igm-cnt-' + catKey);
            if(cntEl) cntEl.textContent = _igmResults.filter(function(r){ return r.catKey===catKey && !r.isExisting; }).length + ' nv';
          } catch(e) {
            igmLog('  ⚠️ Erreur "' + q + '" : ' + e.message, 'warn');
          }

          // Respecter la politique Nominatim : 1 requête/seconde max
          await new Promise(function(r){ setTimeout(r, 1100); });
        }
      }

      igmSetProgress(100, 'Recherche terminée !', totalQ+'/'+totalQ+' requêtes');
      igmLog('═══════════════════════════════════════', 'ok');
      igmLog('🎉 Total trouvé : ' + _igmResults.length + ' établissements', 'ok');
      igmLog('✅ Nouveaux : ' + _igmResults.filter(function(r){ return !r.isExisting; }).length, 'ok');
      igmLog('⚠️ Déjà présents : ' + _igmResults.filter(function(r){ return r.isExisting; }).length, 'warn');

      if(_igmResults.length === 0){
        igmLog('💡 Aucun résultat — les données OSM sur Libreville peuvent être incomplètes. Vous pouvez ajouter des établissements manuellement.', 'warn');
        if(typeof showToast==='function') showToast('⚠️ Aucun établissement OSM trouvé pour ces catégories');
        igmSetStep(1);
        return;
      }

      setTimeout(igmShowResults, 600);

    } catch(e) {
      igmLog('❌ Erreur fatale : ' + e.message, 'err');
      if(typeof showToast==='function') showToast('❌ ' + e.message);
    }
  }
  window.igmStartSearch = igmStartSearch;

  /* ── Afficher les résultats ── */
  function igmShowResults() {
    igmSetStep(3);
    var newCount = _igmResults.filter(function(r){ return !r.isExisting; }).length;
    var existCount = _igmResults.filter(function(r){ return r.isExisting; }).length;
    var el;
    el = document.getElementById('igmStatTotal'); if(el) el.textContent = _igmResults.length;
    el = document.getElementById('igmStatNew');   if(el) el.textContent = newCount;
    el = document.getElementById('igmStatExists');if(el) el.textContent = existCount;

    _igmResults.sort(function(a,b){
      if(a.isExisting !== b.isExisting) return a.isExisting ? 1 : -1;
      return b.note - a.note;
    });

    _igmSelectedIds = new Set(_igmResults.filter(function(r){ return r.selected; }).map(function(r){ return r.place_id; }));
    igmRenderResults();
  }

  function igmRenderResults() {
    var list = document.getElementById('igmResultsList');
    var html = '';
    for(var i=0; i<_igmResults.length; i++){
      var r = _igmResults[i];
      var sel = _igmSelectedIds.has(r.place_id);
      var cfg = IGM_CAT_CONFIG[r.catKey];
      html += '<div class="igm-result-card ' + (sel?'igm-rc-sel':'') + ' ' + (r.isExisting?'igm-rc-exists':'') + '" onclick="igmToggleResult(\''+igmEsc(r.place_id)+'\') " data-igm-id="'+igmEsc(r.place_id)+'">';
      html += '<div class="igm-rc-check">'+(sel?'✓':'')+'</div>';
      html += '<div style="flex:1;min-width:0;">';
      html += '<div class="igm-rc-name">'+cfg.icon+' '+igmEsc(r.nom)+'</div>';
      html += '<div class="igm-rc-meta">';
      html += '<span class="igm-rc-tag igm-rc-tag-type">'+cfg.label+'</span>';
      if(r.note) html += '<span class="igm-rc-tag igm-rc-tag-rating">⭐ '+r.note.toFixed(1)+'</span>';
      if(r.avis) html += '<span class="igm-rc-tag igm-rc-tag-reviews">'+r.avis+' avis</span>';
      if(r.isExisting) html += '<span class="igm-rc-tag igm-rc-tag-exists">⚠️ Déjà présent</span>';
      html += '</div>';
      html += '<div class="igm-rc-addr">📍 '+igmEsc(r.adresse || r.quartier)+'</div>';
      html += '</div></div>';
    }
    list.innerHTML = html;
    igmUpdateCount();
  }

  function igmToggleResult(placeId) {
    if(_igmSelectedIds.has(placeId)) _igmSelectedIds.delete(placeId);
    else _igmSelectedIds.add(placeId);
    var card = document.querySelector('[data-igm-id="'+placeId+'"]');
    if(card){
      var sel = _igmSelectedIds.has(placeId);
      card.classList.toggle('igm-rc-sel', sel);
      card.querySelector('.igm-rc-check').textContent = sel ? '✓' : '';
    }
    igmUpdateCount();
  }
  window.igmToggleResult = igmToggleResult;

  function igmSelectAll(val) {
    _igmSelectedIds.clear();
    if(val) _igmResults.filter(function(r){ return !r.isExisting; }).forEach(function(r){ _igmSelectedIds.add(r.place_id); });
    igmRenderResults();
  }
  window.igmSelectAll = igmSelectAll;

  function igmUpdateCount() {
    var el = document.getElementById('igmSelectedCount');
    if(el) el.textContent = _igmSelectedIds.size;
  }

  /* ── IMPORT FIREBASE ── */
  async function igmStartImport() {
    var toImport = _igmResults.filter(function(r){ return _igmSelectedIds.has(r.place_id); });
    if(!toImport.length){ if(typeof showToast==='function') showToast('⚠️ Aucun établissement sélectionné'); return; }
    if(!window.db || !window.fbAddDoc || !window.fbCollection){ if(typeof showToast==='function') showToast('❌ Firebase non disponible'); return; }

    /* ── FIX: Vérifier que l'admin est bien authentifié Firebase avant d'écrire ── */
    if(!window.auth || !window.auth.currentUser){
      if(typeof showToast==='function') showToast('🔒 Connectez-vous avec votre compte Firebase pour importer');
      /* Ouvrir le modal de connexion */
      var overlay = document.getElementById('userOverlay');
      if(overlay){ overlay.classList.add('show'); if(typeof window.switchUserTab==='function') window.switchUserTab('connexion'); }
      return;
    }
    /* Forcer un refresh du token pour s'assurer que les claims sont à jour */
    try { await window.auth.currentUser.getIdToken(true); } catch(e) { console.warn('[IGM] Token refresh failed:', e); }

    igmSetStep(4);
    var logWrap = document.getElementById('igmImportLog');

    function ilog(msg, type) {
      var line = document.createElement('div');
      line.className = 'igm-log-line' + (type ? ' igm-'+type : '');
      line.textContent = new Date().toLocaleTimeString('fr') + ' — ' + msg;
      logWrap.appendChild(line);
      logWrap.scrollTop = logWrap.scrollHeight;
    }

    var maxId = window._igmMaxId || 100;
    var imported = 0, errors = 0;
    ilog('🚀 Import de ' + toImport.length + ' établissements...', 'ok');

    for(var i=0; i<toImport.length; i++){
      var r = toImport[i];
      var pct = ((i+1)/toImport.length)*100;
      var fill = document.getElementById('igmImportProgressFill');
      var lbl  = document.getElementById('igmImportProgressLabel');
      var det  = document.getElementById('igmImportProgressDetail');
      if(fill) fill.style.width = pct + '%';
      if(lbl) lbl.textContent = Math.round(pct) + '%';
      if(det) det.textContent = (i+1) + '/' + toImport.length;

      var newId = ++maxId;
      var doc = {
        id: newId,
        nom: r.nom,
        type: r.type,
        quartier: r.quartier,
        ambiance: "Chill",
        statut: "",
        note: r.note || 0,
        avis: r.avis || 0,
        contact: "",
        paiement: "En attente",
        affluence: 0,
        lat: r.lat,
        lng: r.lng,
        place_id: r.place_id,
        maps_url: "https://www.google.com/maps/place/?q=place_id:" + r.place_id,
        photo_interieur: "",
        photo_exterieur: ""
      };

      try {
        await window.fbAddDoc(window.fbCollection(window.db, "etablissements"), doc);
        ilog('✅ [' + newId + '] ' + r.nom + ' (' + IGM_CAT_CONFIG[r.catKey].label + ')', 'ok');
        imported++;
      } catch(e) {
        ilog('❌ Erreur ' + r.nom + ': ' + e.message, 'err');
        errors++;
      }
      await new Promise(function(res){ setTimeout(res, 150); });
    }

    window._igmMaxId = maxId;
    ilog('🎉 Terminé ! ' + imported + ' importés, ' + errors + ' erreur(s).', 'ok');
    var sumEl = document.getElementById('igmImportSummary');
    if(sumEl) sumEl.textContent = imported + ' établissements ajoutés à Firebase · ' + errors + ' erreur(s)';
    var doneEl = document.getElementById('igmImportDone');
    if(doneEl) doneEl.style.display = 'block';

    /* Invalider le cache local pour forcer un rechargement des établissements */
    window._igmInited = false;
    if(typeof window.loadEtablissements === 'function') {
      setTimeout(function(){ window.loadEtablissements(); }, 800);
    }
  }
  window.igmStartImport = igmStartImport;
})();
