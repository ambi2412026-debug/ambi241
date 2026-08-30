
(function(){
  // ══ MOTEUR OSM igm2 ══
  var _r2 = [], _sel2 = new Set();
  var _cats2 = new Set(['Bar','Snack','Restaurant','Discotheque',]);

  var CFG2 = {
    "Bar":          {label:"Bars",             icon:"🍺",
      overpassTags:[["amenity","bar"],["amenity","pub"]],
      queries:["bar Libreville","pub Libreville","lounge Libreville"]},
    "Snack":        {label:"Snacks",           icon:"🍾",
      overpassTags:[["amenity","fast_food"],["amenity","snack_bar"]],
      queries:["snack Libreville","fast food Libreville","maquis Libreville"]},
    "Restaurant":   {label:"Restos & Pâtiss.",icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"1.1em\" height=\"0.8em\" style=\"display:inline-block;vertical-align:middle;flex-shrink:0;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>",
      overpassTags:[["amenity","restaurant"],["amenity","cafe"],["shop","bakery"]],
      queries:["restaurant Libreville","patisserie Libreville"]},
    "Discotheque":  {label:"Boîtes de Nuit",  icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 30\" width=\"1.1em\" height=\"0.8em\" style=\"flex-shrink:0;vertical-align:middle;\"><circle cx=\"11\" cy=\"4\" r=\"3\" fill=\"#ff2d9b\"/><path d=\"M11 7 Q7 13 5 20 Q8 18 11 19 Q14 18 17 20 Q15 13 11 7Z\" fill=\"#ff2d9b\"/><line x1=\"11\" y1=\"10\" x2=\"5\" y2=\"6\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"11\" y1=\"10\" x2=\"17\" y2=\"13\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"9\" y1=\"19\" x2=\"6\" y2=\"27\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"19\" x2=\"16\" y2=\"26\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"37\" cy=\"4\" r=\"3\" fill=\"#cc44ff\"/><line x1=\"37\" y1=\"7\" x2=\"37\" y2=\"19\" stroke=\"#cc44ff\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"11\" x2=\"31\" y2=\"13\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"11\" x2=\"43\" y2=\"7\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"19\" x2=\"33\" y2=\"27\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"19\" x2=\"41\" y2=\"26\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><text x=\"21\" y=\"13\" font-size=\"8\" fill=\"#ffd700\">♪</text></svg>",
      overpassTags:[["amenity","nightclub"],["amenity","music_venue"]],
      queries:["nightclub Libreville","discothèque Libreville"]}
  };
  var QTRS2 = ["Centre-ville","Akanda","Glass","Louis","Owendo","Nombakélé","Batterie IV","PK5","PK8","PK12","Angondjé","Nzeng-Ayong","La Sablière"];

  function igm2Init() {
    window._igm2Inited = true;
    igm2Reset(false);
    if(!window.db||!window.fbGetDocs||!window.fbCollection) return;
    window.fbGetDocs(window.fbCollection(window.db,"etablissements")).then(function(snap){
      var ex=new Set(), maxId=0;
      snap.forEach(function(d){
        var v=d.data();
        if(v.nom) ex.add(v.nom.toLowerCase().trim());
        if(v.place_id) ex.add(v.place_id);
        if(v.id&&v.id>maxId) maxId=v.id;
      });
      window._igm2Ex=ex; window._igm2Max=maxId;
    }).catch(function(){});
  }
  window.igm2Init=igm2Init;

  function igm2Reset(reload) {
    _r2=[]; _sel2.clear();
    if(reload!==false){
      igm2Step(1);
      ['igm2LogWrap','igm2ImportLog'].forEach(function(id){ var e=document.getElementById(id); if(e) e.innerHTML=''; });
      var d=document.getElementById('igm2ImportDone'); if(d) d.style.display='none';
      var rl=document.getElementById('igm2ResultsList'); if(rl) rl.innerHTML='';
    }
  }
  window.igm2Reset=igm2Reset;

  function igm2Step(n){
    [1,2,3,4].forEach(function(i){
      var s=document.getElementById('igm2-step'+i), sec=document.getElementById('igm2-sec'+i);
      if(s){s.classList.toggle('igm-active',i===n);s.classList.toggle('igm-done',i<n);}
      if(sec) sec.classList.toggle('igm-active',i===n);
    });
  }

  function igm2ToggleCat(el){
    var k=el.dataset.key;
    if(_cats2.has(k)) _cats2.delete(k); else _cats2.add(k);
    el.classList.toggle('igm-cat-sel',_cats2.has(k));
  }
  window.igm2ToggleCat=igm2ToggleCat;

  function igm2Log(msg,type){
    var w=document.getElementById('igm2LogWrap'); if(!w) return;
    var l=document.createElement('div');
    l.className='igm-log-line'+(type?' igm-'+type:'');
    l.textContent=new Date().toLocaleTimeString('fr')+' — '+msg;
    w.appendChild(l); w.scrollTop=w.scrollHeight;
  }

  var _igm2ProgTimer=null, _igm2ProgCurrent=0;

  function igm2Prog(pct,label,detail){
    _igm2ProgCurrent=pct;
    var f=document.getElementById('igm2ProgressFill'),lb=document.getElementById('igm2ProgressLabel'),dt=document.getElementById('igm2ProgressDetail'),st=document.getElementById('igm2SearchStatus');
    if(f) f.style.width=pct+'%';
    if(lb) lb.textContent=Math.round(pct)+'%';
    if(dt&&detail) dt.textContent=detail;
    if(st&&label) st.textContent=label;
  }

  /* Animation fluide vers le palier suivant (s'arrête ~1.5% avant) */
  function igm2ProgAnimate(from,to){
    clearInterval(_igm2ProgTimer);
    _igm2ProgCurrent=from;
    var cap=to-1.5;
    var f=document.getElementById('igm2ProgressFill'),lb=document.getElementById('igm2ProgressLabel');
    _igm2ProgTimer=setInterval(function(){
      var rem=cap-_igm2ProgCurrent;
      if(rem<0.05){clearInterval(_igm2ProgTimer);return;}
      _igm2ProgCurrent+=rem*0.07;
      if(f) f.style.width=_igm2ProgCurrent+'%';
      if(lb) lb.textContent=Math.round(_igm2ProgCurrent)+'%';
    },80);
  }

  function igm2ProgStop(){clearInterval(_igm2ProgTimer);_igm2ProgTimer=null;}

  /* igm2LoadSDK / igm2Search / igm2RunBatch — supprimés (remplacés par OSM) */

  function igm2IsEx(p){
    if(!window._igm2Ex) return false;
    return (p.place_id&&window._igm2Ex.has(p.place_id))||(p.name&&window._igm2Ex.has(p.name.toLowerCase().trim()));
  }

  function igm2Qrt(addr){
    if(!addr) return 'Libreville';
    for(var i=0;i<QTRS2.length;i++) if(addr.toLowerCase().indexOf(QTRS2[i].toLowerCase())!==-1) return QTRS2[i];
    return 'Libreville';
  }

  function igm2Esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  /* ── Recherche Overpass OSM (igm2) ── */
  var IGM2_BBOX = '0.25,9.35,0.55,9.60';

  function igm2SearchOverpass(tagPairs){
    var nodeQ = tagPairs.map(function(p){return 'node["'+p[0]+'"="'+p[1]+'"](' + IGM2_BBOX + ');';}).join('\n');
    var wayQ  = tagPairs.map(function(p){return 'way["'+p[0]+'"="'+p[1]+'"](' + IGM2_BBOX + ');';}).join('\n');
    var query = '[out:json][timeout:25];\n(\n'+nodeQ+'\n'+wayQ+'\n);\nout center;';
    var ENDPOINTS = ['https://overpass-api.de/api/interpreter','https://overpass.kumi.systems/api/interpreter'];
    function tryE(idx){
      return fetch(ENDPOINTS[idx],{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'data='+encodeURIComponent(query)})
        .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
        .then(function(data){
          return (data.elements||[]).map(function(el){
            var tags=el.tags||{};
            var lat=el.lat||(el.center&&el.center.lat)||0;
            var lng=el.lon||(el.center&&el.center.lon)||0;
            var addr=[tags['addr:street'],tags['addr:city']||'Libreville'].filter(Boolean).join(', ');
            return {place_id:'osm2_'+el.type+'_'+el.id,name:tags.name||tags['name:fr']||null,
              formatted_address:addr||'Libreville, Gabon',rating:0,user_ratings_total:0,
              geometry:{location:{lat:lat,lng:lng}}};
          }).filter(function(p){return p.name;});
        })
        .catch(function(e){if(idx+1<ENDPOINTS.length)return tryE(idx+1);throw e;});
    }
    return tryE(0);
  }

  function igm2SearchNominatim(query){
    var url='https://nominatim.openstreetmap.org/search'
      +'?q='+encodeURIComponent(query+' Gabon')
      +'&format=json&limit=20&addressdetails=1&bounded=1'
      +'&viewbox=9.35,0.55,9.60,0.25&accept-language=fr';
    return fetch(url,{headers:{'Accept':'application/json','User-Agent':'AMBI241-App/1.0'}})
      .then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();})
      .then(function(data){
        return (data||[]).map(function(el){
          return {place_id:'nom2_'+el.osm_type+'_'+el.osm_id,
            name:el.display_name.split(',')[0],
            formatted_address:el.display_name||'Libreville, Gabon',
            rating:0,user_ratings_total:0,
            geometry:{location:{lat:parseFloat(el.lat),lng:parseFloat(el.lon)}}};
        });
      });
  }

  async function igm2StartSearch(){
    if(!_cats2.size){if(typeof showToast==='function')showToast('⚠️ Sélectionne au moins une catégorie');return;}
    igm2Step(2); _r2=[]; var seen=new Set();
    var cats=Array.from(_cats2);
    var allQueries=[]; for(var ci=0;ci<cats.length;ci++){var c=cats[ci];CFG2[c].queries.forEach(function(q){allQueries.push({q:q,cat:c});});}
    var total=allQueries.length, done=0;
    igm2Log('🗺️ Recherche OpenStreetMap (sans clé API)...');
    igm2Prog(0,'Recherche OSM / Overpass...','0/'+total+' requêtes');

    // 1 — Overpass par catégorie
    for(var ci2=0;ci2<cats.length;ci2++){
      var catKey=cats[ci2], cfg=CFG2[catKey];
      if(!cfg.overpassTags) continue;
      try{
        igm2Log('  → Overpass tags : '+cfg.label);
        var ovRes=await igm2SearchOverpass(cfg.overpassTags);
        var nf=0;
        for(var ri=0;ri<ovRes.length;ri++){
          var p=ovRes[ri];if(!p.place_id||seen.has(p.place_id))continue;seen.add(p.place_id);
          var ex=igm2IsEx(p);
          _r2.push({place_id:p.place_id,nom:p.name,adresse:p.formatted_address,quartier:igm2Qrt(p.formatted_address),note:0,avis:0,
            lat:p.geometry.location.lat,lng:p.geometry.location.lng,catKey:catKey,type:catKey,isExisting:ex,selected:!ex});
          if(!ex)nf++;
        }
        igm2Log('  ✓ Overpass '+cfg.label+' : '+ovRes.length+' ('+nf+' nv)','ok');
      }catch(e){igm2Log('  ⚠️ Overpass erreur : '+e.message,'warn');}
    }

    // 2 — Nominatim par requête texte
    for(var ti=0;ti<allQueries.length;ti++){
      var task=allQueries[ti]; done++;
      igm2Prog(Math.round((done/total)*100),'Nominatim "'+task.q+'"',done+'/'+total+' requêtes');
      igm2Log('  → Nominatim "'+task.q+'"');
      try{
        var nomRes=await igm2SearchNominatim(task.q);
        var nf2=0;
        for(var ri2=0;ri2<nomRes.length;ri2++){
          var p2=nomRes[ri2];if(!p2.place_id||seen.has(p2.place_id))continue;seen.add(p2.place_id);
          var ex2=igm2IsEx(p2);
          _r2.push({place_id:p2.place_id,nom:p2.name,adresse:p2.formatted_address,quartier:igm2Qrt(p2.formatted_address),note:0,avis:0,
            lat:p2.geometry.location.lat,lng:p2.geometry.location.lng,catKey:task.cat,type:task.cat,isExisting:ex2,selected:!ex2});
          if(!ex2)nf2++;
        }
        igm2Log('  ✓ '+nomRes.length+' résultats ('+nf2+' nv)','ok');
        var ce=document.getElementById('igm2-cnt-'+task.cat);if(ce)ce.textContent=_r2.filter(function(r){return r.catKey===task.cat&&!r.isExisting;}).length+' nv';
      }catch(e){igm2Log('  ⚠️ '+task.q+': '+e.message,'warn');}
      // Respecter la politique Nominatim (1 req/s)
      await new Promise(function(r){setTimeout(r,1100);});
    }

    igm2Prog(100,'Terminé !',total+'/'+total+' requêtes');
    igm2Log('🎉 '+_r2.length+' établissements trouvés','ok');
    igm2Log('✅ Nouveaux : '+_r2.filter(function(r){return !r.isExisting;}).length,'ok');
    igm2Log('⚠️ Déjà présents : '+_r2.filter(function(r){return r.isExisting;}).length,'warn');
    if(_r2.length===0){igm2Log('💡 Aucun résultat OSM. Les données Libreville peuvent être incomplètes.','warn');igm2Step(1);return;}
    setTimeout(igm2ShowResults,400);
  }
  window.igm2StartSearch=igm2StartSearch;

  function igm2ShowResults(){
    igm2Step(3);
    var ne=_r2.filter(function(r){return !r.isExisting;}).length, ex=_r2.filter(function(r){return r.isExisting;}).length;
    ['igm2StatTotal','igm2StatNew','igm2StatExists'].forEach(function(id,i){ var e=document.getElementById(id); if(e) e.textContent=[_r2.length,ne,ex][i]; });
    _r2.sort(function(a,b){return a.isExisting!==b.isExisting?(a.isExisting?1:-1):b.note-a.note;});
    _sel2=new Set(_r2.filter(function(r){return r.selected;}).map(function(r){return r.place_id;}));
    igm2Render();
  }

  function igm2Render(){
    var list=document.getElementById('igm2ResultsList'), html='';
    for(var i=0;i<_r2.length;i++){
      var r=_r2[i],sel=_sel2.has(r.place_id),cfg=CFG2[r.catKey];
      html+='<div class="igm-result-card '+(sel?'igm-rc-sel':'')+' '+(r.isExisting?'igm-rc-exists':'')+'" onclick="igm2Toggle(\''+igm2Esc(r.place_id)+'\')" data-i2="'+igm2Esc(r.place_id)+'">';
      html+='<div class="igm-rc-check">'+(sel?'✓':'')+'</div>';
      html+='<div style="flex:1;min-width:0;"><div class="igm-rc-name">'+cfg.icon+' '+igm2Esc(r.nom)+'</div>';
      html+='<div class="igm-rc-meta"><span class="igm-rc-tag igm-rc-tag-type">'+cfg.label+'</span>';
      if(r.note) html+='<span class="igm-rc-tag igm-rc-tag-rating">⭐ '+r.note.toFixed(1)+'</span>';
      if(r.avis) html+='<span class="igm-rc-tag igm-rc-tag-reviews">'+r.avis+' avis</span>';
      if(r.isExisting) html+='<span class="igm-rc-tag igm-rc-tag-exists">⚠️ Déjà présent</span>';
      html+='</div><div class="igm-rc-addr">📍 '+igm2Esc(r.adresse||r.quartier)+'</div></div></div>';
    }
    list.innerHTML=html; igm2Count();
  }

  function igm2Toggle(id){
    if(_sel2.has(id)) _sel2.delete(id); else _sel2.add(id);
    var c=document.querySelector('[data-i2="'+id+'"]');
    if(c){var s=_sel2.has(id);c.classList.toggle('igm-rc-sel',s);c.querySelector('.igm-rc-check').textContent=s?'✓':'';}
    igm2Count();
  }
  window.igm2Toggle=igm2Toggle;

  function igm2SelectAll(v){_sel2.clear();if(v)_r2.filter(function(r){return !r.isExisting;}).forEach(function(r){_sel2.add(r.place_id);});igm2Render();}
  window.igm2SelectAll=igm2SelectAll;

  function igm2Count(){var e=document.getElementById('igm2SelectedCount');if(e)e.textContent=_sel2.size;}

  /* ── Import Firebase en lots parallèles (BATCH_SIZE docs simultanés) ── */
  var IGM2_IMPORT_BATCH = 10; /* 10 écritures en parallèle — import 2x plus rapide */

  async function igm2StartImport(){
    var toImp=_r2.filter(function(r){return _sel2.has(r.place_id);});
    if(!toImp.length){if(typeof showToast==='function')showToast('⚠️ Aucun établissement sélectionné');return;}
    if(!window.db||!window.fbAddDoc||!window.fbCollection){if(typeof showToast==='function')showToast('❌ Firebase non disponible');return;}

    /* ── FIX: Vérifier que l'admin est bien authentifié Firebase avant d'écrire ── */
    if(!window.auth || !window.auth.currentUser){
      if(typeof showToast==='function') showToast('🔒 Connectez-vous avec votre compte Firebase pour importer');
      var overlay = document.getElementById('userOverlay');
      if(overlay){ overlay.classList.add('show'); if(typeof window.switchUserTab==='function') window.switchUserTab('connexion'); }
      return;
    }
    /* Forcer un refresh du token pour s'assurer que les claims sont à jour */
    try { await window.auth.currentUser.getIdToken(true); } catch(e) { console.warn('[IGM2] Token refresh failed:', e); }
    /* FIX Bug 3: s'assurer que le panel parent est visible avant d'activer l'étape 4 */
    var _igmPanel = document.getElementById('admpanel-importgmaps');
    if(_igmPanel){
      _igmPanel.style.display='block';
      _igmPanel.style.visibility='visible';
      _igmPanel.style.height='';
      _igmPanel.style.overflow='';
    }
    igm2Step(4);
    var lw=document.getElementById('igm2ImportLog');
    function il(msg,type){var l=document.createElement('div');l.className='igm-log-line'+(type?' igm-'+type:'');l.textContent=new Date().toLocaleTimeString('fr')+' — '+msg;lw.appendChild(l);lw.scrollTop=lw.scrollHeight;}
    var maxId=window._igm2Max||100, imp=0, err=0;
    il('🚀 Import de '+toImp.length+' établissements ('+IGM2_IMPORT_BATCH+'x parallèle)...','ok');

    /* Pré-attribuer les IDs pour éviter les conflits */
    var docs=toImp.map(function(r){
      var newId=++maxId;
      /* ── FIX maps_url : les place_id OSM (osm2_*) sont invalides sur Google Maps.
         On utilise les coordonnées GPS (toujours présentes via Overpass/Nominatim)
         pour construire une URL qui ouvre directement le point sur la carte.
         Format : https://maps.google.com/?q=lat,lng — fonctionne sur Android/iOS/Web. ── */
      var isGooglePlaceId = r.place_id && /^ChIJ/i.test(r.place_id);
      var mapsUrl;
      if(isGooglePlaceId){
        mapsUrl = "https://www.google.com/maps/place/?q=place_id:" + r.place_id;
      } else if(r.lat && r.lng){
        mapsUrl = "https://maps.google.com/?q=" + r.lat + "," + r.lng
                + "&query=" + encodeURIComponent((r.nom||'') + ' Libreville');
      } else {
        mapsUrl = "https://maps.google.com/?q=" + encodeURIComponent((r.nom||'') + ' ' + (r.quartier||'') + ' Libreville Gabon');
      }
      return {id:newId,nom:r.nom,type:r.type,quartier:r.quartier,ambiance:"Chill",statut:"",note:r.note||0,avis:r.avis||0,contact:"",paiement:"En attente",affluence:0,lat:r.lat,lng:r.lng,place_id:r.place_id,maps_url:mapsUrl,photo_interieur:"",photo_exterieur:"",catKey:r.catKey};
    });
    window._igm2Max=maxId;

    var total=docs.length, done=0;
    var updateProg=function(){
      done++;
      var pct=(done/total)*100;
      var f=document.getElementById('igm2ImportProgressFill'),lb=document.getElementById('igm2ImportProgressLabel'),dt=document.getElementById('igm2ImportProgressDetail');
      if(f) f.style.width=pct+'%'; if(lb) lb.textContent=Math.round(pct)+'%'; if(dt) dt.textContent=done+'/'+total;
    };

    /* Traiter par lots parallèles */
    for(var i=0;i<docs.length;i+=IGM2_IMPORT_BATCH){
      var batch=docs.slice(i,i+IGM2_IMPORT_BATCH);
      var batchResults=await Promise.allSettled(
        batch.map(function(doc){
          var d={id:doc.id,nom:doc.nom,type:doc.type,quartier:doc.quartier,ambiance:doc.ambiance,statut:doc.statut,note:doc.note,avis:doc.avis,contact:doc.contact,paiement:doc.paiement,affluence:doc.affluence,lat:doc.lat,lng:doc.lng,place_id:doc.place_id,maps_url:doc.maps_url,photo_interieur:doc.photo_interieur,photo_exterieur:doc.photo_exterieur};
          return window.fbAddDoc(window.fbCollection(window.db,"etablissements"),d).then(function(){return doc;});
        })
      );
      for(var bi=0;bi<batchResults.length;bi++){
        var br=batchResults[bi];
        if(br.status==='fulfilled'){il('✅ ['+br.value.id+'] '+br.value.nom+' ('+CFG2[br.value.catKey].label+')','ok');imp++;}
        else{il('❌ '+batch[bi].nom+': '+(br.reason&&br.reason.message||'erreur'),'err');err++;}
        updateProg();
      }
    }

    il('🎉 Terminé ! '+imp+' importés, '+err+' erreur(s).','ok');
    var sm=document.getElementById('igm2ImportSummary'); if(sm) sm.textContent=imp+' établissements ajoutés · '+err+' erreur(s)';
    var dn=document.getElementById('igm2ImportDone'); if(dn) dn.style.display='block';
    window._igm2Inited=false;
    if(typeof window.loadEtablissements==='function') setTimeout(function(){window.loadEtablissements();},800);
    if(typeof window.admRefreshEtabl==='function') setTimeout(function(){window.admRefreshEtabl();},1200);
  }
  window.igm2StartImport=igm2StartImport;
})();
