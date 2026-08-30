
// ── PIN SÉCURISÉ — hash SHA-256, jamais en clair dans le code ──
// Pour changer le PIN, utiliser changeAdminPin() dans l'interface admin
var PIN_HASH = "0e3803a9c7361edd5a4ef83c013db8b952cab73373150ff24d3d73d92c40bad2";
async function hashPin(pin){ const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(pin)); return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join(""); }
function loadPinHash(){ try{ var s=lsGet("ambi241_pin_hash"); return s||PIN_HASH; }catch(e){ return PIN_HASH; } }
function savePinHash(h){ try{ lsSet("ambi241_pin_hash", h); }catch(e){} }

// ── HELPERS localStorage robustes — anti-bug quota/accès refusé ──
var _memFallback={};
function lsGet(key,def){
  try{ var v=localStorage.getItem(key); return v!==null?v:(def!==undefined?def:null); }
  catch(e){ return (_memFallback[key]!==undefined)?_memFallback[key]:(def!==undefined?def:null); }
}
function lsSet(key,val){
  try{ localStorage.setItem(key,val); _memFallback[key]=val; }
  catch(e){ _memFallback[key]=val; }
}
function lsDel(key){
  try{ localStorage.removeItem(key); }catch(e){}
  delete _memFallback[key];
}

/* ══════════════════════════════════════════════════════════════
   🎯 GESTIONNAIRE CENTRALISÉ D'ÉVÉNEMENTS
   Remplace les addEventListener isolés sans removeEventListener.
   Usage : EventMgr.on(el, 'click', fn, 'monContexte')
           EventMgr.off('monContexte')  ← supprime tous les listeners du contexte
   ══════════════════════════════════════════════════════════════ */
var EventMgr = (function(){
  // Map : contexte → [{el, type, fn, opts}]
  var _reg = {};

  function on(el, type, fn, ctx, opts){
    if(!el || typeof fn !== 'function') return;
    ctx = ctx || '__global';
    if(!_reg[ctx]) _reg[ctx] = [];
    el.addEventListener(type, fn, opts || false);
    _reg[ctx].push({ el: el, type: type, fn: fn, opts: opts || false });
  }

  function off(ctx){
    if(!ctx){ ctx = '__global'; }
    var list = _reg[ctx];
    if(!list) return;
    list.forEach(function(item){
      try{ item.el.removeEventListener(item.type, item.fn, item.opts); }catch(e){}
    });
    delete _reg[ctx];
  }

  function offAll(){
    Object.keys(_reg).forEach(off);
  }

  /* Raccourci one-shot : s'auto-supprime après 1 appel */
  function once(el, type, fn, ctx){
    var wrapper = function(e){
      fn(e);
      off(ctx || '__once_' + type);
    };
    on(el, type, wrapper, ctx || '__once_' + type);
  }

  return { on: on, off: off, offAll: offAll, once: once };
})();
window.EventMgr = EventMgr;

/* ══════════════════════════════════════════════════════════════
   📶 GESTION OFFLINE — File d'attente d'écritures Firestore
   Détecte navigator.onLine, met en file d'attente les écritures
   quand hors ligne, les rejoue dès le retour de connexion.
   ══════════════════════════════════════════════════════════════ */
var OfflineQueue = (function(){
  var QUEUE_KEY = 'ambi241_offline_queue';
  var _flushing = false;
  var _isOnline = navigator.onLine;

  /* ── Lire / écrire la file dans localStorage ── */
  function _load(){
    try{ return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); }catch(e){ return []; }
  }
  function _save(q){
    try{ localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }catch(e){}
  }

  /* ── Ajouter une écriture en file ── */
  function enqueue(op){
    /* op = { path: 'collection/docId', data: {...}, type: 'set'|'update'|'add' } */
    var q = _load();
    q.push({ op: op, ts: Date.now(), id: _cryptoId ? _cryptoId(8) : Math.random().toString(36).slice(2) });
    _save(q);
  }

  /* ── Rejouer toutes les opérations en attente ── */
  function flush(){
    if(_flushing || !navigator.onLine) return;
    if(!window.db || !window.fbSetDoc || !window.fbUpdateDoc || !window.fbAddDoc) return;
    var q = _load();
    if(!q.length) return;
    _flushing = true;
    var promises = q.map(function(item){
      try{
        var parts  = item.op.path.split('/');
        var isDoc  = parts.length % 2 === 0;
        if(!isDoc){ return window.fbAddDoc(window.fbCollection(window.db, parts[0]), item.op.data); }
        var docRef = window.fbDoc(window.db, parts.slice(0,-1).join('/'), parts[parts.length-1]);
        if(item.op.type === 'update') return window.fbUpdateDoc(docRef, item.op.data);
        return window.fbSetDoc(docRef, item.op.data, { merge: true });
      }catch(e){ return Promise.resolve(); }
    });
    Promise.allSettled(promises).then(function(results){
      // Retirer seulement les opérations qui ont réussi
      var remaining = q.filter(function(item, i){ return results[i] && results[i].status === 'rejected'; });
      _save(remaining);
      _flushing = false;
      if(remaining.length){ showToast && showToast('⚠️ '+remaining.length+' opération(s) hors-ligne non synchronisée(s)'); }
      else if(q.length > 0){ showToast && showToast('✅ '+q.length+' opération(s) synchronisée(s) après retour en ligne'); }
    });
  }

  /* ── Écriture intelligente : direct si online, file si offline ── */
  function write(path, data, type){
    if(navigator.onLine && window.db){
      try{
        var parts = path.split('/');
        var isDoc = parts.length % 2 === 0;
        if(!isDoc) return window.fbAddDoc(window.fbCollection(window.db, parts[0]), data);
        var docRef = window.fbDoc(window.db, parts.slice(0,-1).join('/'), parts[parts.length-1]);
        if(type === 'update') return window.fbUpdateDoc(docRef, data);
        return window.fbSetDoc(docRef, data, { merge: true });
      }catch(e){ /* fall through to queue */ }
    }
    // Hors ligne : mettre en file
    enqueue({ path: path, data: data, type: type || 'set' });
    showToast && showToast('📴 Hors ligne — opération sauvegardée, sera synchronisée dès reconnexion');
    return Promise.resolve();
  }

  /* ── Bannière état réseau ── */
  function _updateBanner(online){
    _isOnline = online;
    var b = document.getElementById('ambiOfflineBanner');
    if(!b){
      b = document.createElement('div');
      b.id = 'ambiOfflineBanner';
      b.style.cssText = 'display:none;position:fixed;top:0;left:0;right:0;z-index:9999;background:#333;color:#fff;text-align:center;font-size:0.8rem;font-weight:700;padding:0.45rem;font-family:DM Sans,sans-serif;transition:all 0.3s;';
      document.body.appendChild(b);
    }
    if(online){
      b.style.background = 'var(--green, #00ffaa)';
      b.style.color = '#001a0e';
      b.textContent = '✅ Connexion rétablie';
      b.style.display = 'block';
      setTimeout(function(){ b.style.display = 'none'; }, 3000);
      flush(); // rejouer la file
    } else {
      b.style.background = 'var(--red, #ff4466)';
      b.style.color = '#fff';
      b.textContent = '📴 Hors ligne — les modifications seront synchronisées à la reconnexion';
      b.style.display = 'block';
    }
  }

  /* ── Écouter les events réseau ── */
  window.addEventListener('online',  function(){ _updateBanner(true);  });
  window.addEventListener('offline', function(){ _updateBanner(false); });
  // Vérification initiale
  if(!navigator.onLine) setTimeout(function(){ _updateBanner(false); }, 1500);

  return { enqueue: enqueue, flush: flush, write: write };
})();
window.OfflineQueue = OfflineQueue;
function lsGetJSON(key,def){ try{ var v=lsGet(key); return v?JSON.parse(v):(def!==undefined?def:null); }catch(e){ return def!==undefined?def:null; } }
function lsSetJSON(key,obj){ try{ lsSet(key,JSON.stringify(obj)); }catch(e){} }

/* ══════════════════════════════════════════════════════════════════════
   AUTO-FETCH PHOTOS — AMBI241 v3
   PRIORITÉ : photo_profile_approved > photo_interieur/exterieur >
              Google Places API (place_id) > Fallback SVG par type
   • Tous les établissements obtiennent une image, même sans place_id
   • Cache localStorage 7 jours pour les photos Google
   • Re-render réactif dès réception
   ══════════════════════════════════════════════════════════════════════ */
var GPLACES_API_KEY = "AIzaSyCx3hD28Lb9EtUrawHbTnM-6vmXdgO1ABw";
var GPHOTO_CACHE_PREFIX = "ambi241_gphoto_";
var GPHOTO_CACHE_TTL = 7 * 24 * 3600 * 1000;
var _gphotoFetchQueue = [];
var _gphotoFetchBusy = false;

/* ── FALLBACK SVG GÉNÉRÉ PAR TYPE D'ÉTABLISSEMENT ─────────────────── */
function generateFallbackPhoto(type, nom) {
  var t = (type || "").toLowerCase();
  var n = (nom || "").substring(0, 2).toUpperCase();

  // Palette + icône par type
  var cfg = {
    disco:    { g1:"#1a0028", g2:"#3d0066", ic:"&#9835;", label:"DISCOTH\u00c8QUE", c1:"#cc44ff", c2:"#ff2d9b" },
    bar:      { g1:"#0d1a00", g2:"#1a3300", ic:"&#127866;", label:"BAR",         c1:"#00ffaa", c2:"#00e5ff" },
    resto:    { g1:"#1a0d00", g2:"#331a00", ic:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"2.2em\" height=\"1.6em\" style=\"display:inline-block;vertical-align:middle;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>", label:"RESTAURANT",  c1:"#ffd700", c2:"#ff9500" },
    lounge:   { g1:"#0d001a", g2:"#1a0033", ic:"&#127870;", label:"LOUNGE",      c1:"#cc44ff", c2:"#00e5ff" },
    snack:    { g1:"#001a0d", g2:"#003320", ic:"🍾", label:"SNACK-BAR",   c1:"#00ffaa", c2:"#ffd700" },
    default:  { g1:"#0d0014", g2:"#1a0028", ic:"&#127968;", label:"\u00c9TABLISSEMENT",c1:"#ff2d9b", c2:"#cc44ff" }
  };

  var v;
  if(t.includes("disco") || t.includes("night") || t.includes("club")) v = cfg.disco;
  else if(t.includes("snack"))                                           v = cfg.snack;
  else if(t.includes("lounge"))                                          v = cfg.lounge;
  else if(t.includes("restaurant") || t.includes("resto"))               v = cfg.resto;
  else if(t.includes("bar"))                                             v = cfg.bar;
  else                                                                   v = cfg.default;

  // SVG inline encodé en data-URI (160×280, proportions card)
  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="320" viewBox="0 0 560 320">',
    '<defs>',
    '<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">',
    '<stop offset="0%" stop-color="',v.g1,'"/>',
    '<stop offset="100%" stop-color="',v.g2,'"/>',
    '</linearGradient>',
    '<linearGradient id="ac" x1="0%" y1="0%" x2="100%" y2="0%">',
    '<stop offset="0%" stop-color="',v.c1,'" stop-opacity="0.6"/>',
    '<stop offset="100%" stop-color="',v.c2,'" stop-opacity="0.6"/>',
    '</linearGradient>',
    '<radialGradient id="gl" cx="50%" cy="40%" r="55%">',
    '<stop offset="0%" stop-color="',v.c1,'" stop-opacity="0.25"/>',
    '<stop offset="100%" stop-color="transparent"/>',
    '</radialGradient>',
    '</defs>',
    // Fond
    '<rect width="560" height="320" fill="url(#bg)"/>',
    '<rect width="560" height="320" fill="url(#gl)"/>',
    // Grille déco légère
    '<line x1="0" y1="80" x2="560" y2="80" stroke="',v.c1,'" stroke-opacity="0.07" stroke-width="1"/>',
    '<line x1="0" y1="160" x2="560" y2="160" stroke="',v.c1,'" stroke-opacity="0.07" stroke-width="1"/>',
    '<line x1="0" y1="240" x2="560" y2="240" stroke="',v.c1,'" stroke-opacity="0.07" stroke-width="1"/>',
    '<line x1="140" y1="0" x2="140" y2="320" stroke="',v.c1,'" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="280" y1="0" x2="280" y2="320" stroke="',v.c1,'" stroke-opacity="0.05" stroke-width="1"/>',
    '<line x1="420" y1="0" x2="420" y2="320" stroke="',v.c1,'" stroke-opacity="0.05" stroke-width="1"/>',
    // Cercle glow central
    '<circle cx="280" cy="145" r="90" fill="',v.c1,'" fill-opacity="0.06"/>',
    '<circle cx="280" cy="145" r="60" fill="',v.c1,'" fill-opacity="0.07"/>',
    // Icône type
    '<text x="280" y="160" font-size="72" text-anchor="middle" dominant-baseline="middle">',v.ic,'</text>',
    // Bande accent bas
    '<rect x="0" y="260" width="560" height="60" fill="url(#ac)"/>',
    // Initiales établissement
    '<text x="40" y="298" font-family="Arial Black,sans-serif" font-size="22" font-weight="900" fill="white" fill-opacity="0.95">',String(n||"").replace(/[<>&"]/g,function(c){return{"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c]||c;}),'</text>',
    // Label type
    '<text x="280" y="294" font-family="Arial,sans-serif" font-size="13" font-weight="800" fill="white" fill-opacity="0.8" text-anchor="middle" letter-spacing="3">',v.label,'</text>',
    // Badge "AUTO"
    '<rect x="460" y="268" width="80" height="22" rx="11" fill="',v.c2,'" fill-opacity="0.3"/>',
    '<text x="500" y="283" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="white" fill-opacity="0.8" text-anchor="middle" letter-spacing="1">AUTO</text>',
    '</svg>'
  ].join("");

  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/* ── Cache ──────────────────────────────────────────────────────────── */
function _gphotoReadCache(placeId) {
  try {
    var raw = localStorage.getItem(GPHOTO_CACHE_PREFIX + placeId);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (Date.now() - obj.ts > GPHOTO_CACHE_TTL) {
      localStorage.removeItem(GPHOTO_CACHE_PREFIX + placeId);
      return null;
    }
    return obj.urls || null;
  } catch(err) { return null; }
}

function _gphotoWriteCache(placeId, urls) {
  try {
    localStorage.setItem(GPHOTO_CACHE_PREFIX + placeId, JSON.stringify({ ts: Date.now(), urls: urls }));
  } catch(err) {}
}

function _gphotoMakeUrl(photoName) {
  return "https://places.googleapis.com/v1/" + photoName
    + "/media?maxHeightPx=800&maxWidthPx=1200&key=" + GPLACES_API_KEY;
}

/* ── Fetch Google Places pour UN établissement ──────────────────────── */
function _gphotoFetchOne(e, callback) {
  if (!e.place_id) {
    // Pas de place_id → admin default en priorité, sinon fallback SVG immédiat
    if (!e._gphoto_urls || e._gphoto_urls.length === 0) {
      e._gphoto_urls = [];
      e._fallback_svg = getAdminDefaultPhotoForEtab(e) || generateFallbackPhoto(e.type, e.nom);
    }
    if(callback) callback(null);
    return;
  }
  var cached = _gphotoReadCache(e.place_id);
  if (cached !== null) {
    e._gphoto_urls = cached;
    // Si Google n'avait rien renvoyé → admin default en priorité, sinon fallback SVG
    if (cached.length === 0) {
      var _admDefCached = getAdminDefaultPhotoForEtab(e);
      if (_admDefCached) {
        e._fallback_svg = _admDefCached;
        e._fallback_svg_is_admin_default = true;
      } else if (!e._fallback_svg || e._fallback_svg_is_admin_default) {
        e._fallback_svg = generateFallbackPhoto(e.type, e.nom);
        e._fallback_svg_is_admin_default = false;
      }
    }
    if(callback) callback(cached.length > 0 ? cached[0] : null);
    return;
  }
  var url = "https://places.googleapis.com/v1/places/" + e.place_id
    + "?fields=photos&languageCode=fr&key=" + GPLACES_API_KEY;
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.setRequestHeader("X-Goog-FieldMask", "photos");
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    try {
      if (xhr.status === 200) {
        var data = JSON.parse(xhr.responseText);
        var photos = (data && data.photos) ? data.photos : [];
        if (photos.length === 0) {
          _gphotoWriteCache(e.place_id, []);
          e._gphoto_urls = [];
          // Aucune photo Google → admin default en priorité, sinon SVG
          var _admDef = getAdminDefaultPhotoForEtab(e);
          e._fallback_svg = _admDef || generateFallbackPhoto(e.type, e.nom);
          if(callback) callback(null);
          return;
        }
        // Trier par résolution décroissante, garder les 5 meilleures
        var sorted = photos.slice().sort(function(a,b){
          return ((b.widthPx||0)*(b.heightPx||0)) - ((a.widthPx||0)*(a.heightPx||0));
        });
        var urls = sorted.slice(0, 5).map(function(p){ return _gphotoMakeUrl(p.name); });
        _gphotoWriteCache(e.place_id, urls);
        e._gphoto_urls = urls;
        e._fallback_svg = null; // photo réelle disponible, pas de fallback
        if(callback) callback(urls[0]);
      } else {
        e._gphoto_urls = [];
        e._fallback_svg = getAdminDefaultPhotoForEtab(e) || generateFallbackPhoto(e.type, e.nom);
        if(callback) callback(null);
      }
    } catch(err) {
      e._gphoto_urls = [];
      e._fallback_svg = getAdminDefaultPhotoForEtab(e) || generateFallbackPhoto(e.type, e.nom);
      if(callback) callback(null);
    }
  };
  xhr.onerror = function() {
    e._gphoto_urls = [];
    e._fallback_svg = getAdminDefaultPhotoForEtab(e) || generateFallbackPhoto(e.type, e.nom);
    if(callback) callback(null);
  };
  try { xhr.send(); } catch(err) {
    e._gphoto_urls = [];
    e._fallback_svg = getAdminDefaultPhotoForEtab(e) || generateFallbackPhoto(e.type, e.nom);
    if(callback) callback(null);
  }
}

/* ── File d'attente (throttle réseau) ───────────────────────────────── */
function _gphotoProcessQueue() {
  if (_gphotoFetchBusy || _gphotoFetchQueue.length === 0) return;
  _gphotoFetchBusy = true;
  var item = _gphotoFetchQueue.shift();
  _gphotoFetchOne(item.e, function(url) {
    _gphotoFetchBusy = false;
    // Re-render si une nouvelle photo réelle est arrivée
    if (url) {
      setTimeout(function(){
        if(typeof renderAll === "function") renderAll();
        if(typeof renderHome === "function") renderHome();
      }, 0);
    }
    if (_gphotoFetchQueue.length > 0) setTimeout(_gphotoProcessQueue, 180);
  });
}

/* ── Extraction du place_id depuis un maps_url ───────────────────────── *
 * Gère :                                                                  *
 *   • ?q=place_id:ChIJ...                                                 *
 *   • /place/Nom/@lat,lng,z/data=...0x<hex>                               *
 *   • Liens courts maps.app.goo.gl  → Text Search API                    *
 *   • /search/Nom... → Text Search API (fallback)                         */
var _placeIdResolveCache = {};
var _placeIdResolvePending = {};

function _extractPlaceIdFromUrl(url) {
  if (!url) return null;
  // Cas 1 : q=place_id:ChIJ...
  var m1 = url.match(/[?&]q=place_id:(ChIJ[^&\s]+)/);
  if (m1) return m1[1];
  // Cas 2 : /data=...!1s0x... → hex cid (non utilisable directement, skip)
  // Cas 3 : place_id= direct dans l'url
  var m3 = url.match(/place_id=(ChIJ[^&\s]+)/);
  if (m3) return m3[1];
  return null;
}

function _resolveTextSearch(query, callback) {
  var cacheKey = 'ts_' + query;
  if (_placeIdResolveCache[cacheKey]) { callback(_placeIdResolveCache[cacheKey]); return; }
  if (_placeIdResolvePending[cacheKey]) { _placeIdResolvePending[cacheKey].push(callback); return; }
  _placeIdResolvePending[cacheKey] = [callback];
  var url = 'https://places.googleapis.com/v1/places:searchText'
    + '?key=' + GPLACES_API_KEY;
  var xhr = new XMLHttpRequest();
  xhr.open('POST', url, true);
  xhr.setRequestHeader('Content-Type', 'application/json');
  xhr.setRequestHeader('X-Goog-FieldMask', 'places.id,places.displayName');
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    var pid = null;
    try {
      if (xhr.status === 200) {
        var d = JSON.parse(xhr.responseText);
        if (d.places && d.places.length > 0) pid = d.places[0].id;
      }
    } catch(err) {}
    _placeIdResolveCache[cacheKey] = pid;
    var cbs = _placeIdResolvePending[cacheKey] || [];
    delete _placeIdResolvePending[cacheKey];
    cbs.forEach(function(cb){ cb(pid); });
  };
  xhr.onerror = function() {
    _placeIdResolveCache[cacheKey] = null;
    var cbs = _placeIdResolvePending[cacheKey] || [];
    delete _placeIdResolvePending[cacheKey];
    cbs.forEach(function(cb){ cb(null); });
  };
  try {
    xhr.send(JSON.stringify({ textQuery: query, languageCode: 'fr', maxResultCount: 1 }));
  } catch(err) {
    var cbs = _placeIdResolvePending[cacheKey] || [];
    delete _placeIdResolvePending[cacheKey];
    cbs.forEach(function(cb){ cb(null); });
  }
}

function _buildSearchQuery(e) {
  // Extraire le nom de recherche depuis maps_url si possible
  var url = e.maps_url || '';
  var m = url.match(/\/search\/([^/?@]+)/);
  if (m) return decodeURIComponent(m[1].replace(/\+/g, ' ')) + ' Libreville';
  m = url.match(/[?&]q=([^&]+)/);
  if (m) return decodeURIComponent(m[1].replace(/\+/g, ' '));
  // Fallback : nom + quartier + ville
  return (e.nom || '') + ' ' + (e.quartier ? e.quartier + ' ' : '') + 'Libreville Gabon';
}

/* ── Enqueue : tous les établissements, avec ou sans place_id ────────── */
function _gphotoEnqueue(e) {
  // Déjà traité (même si _gphoto_urls est vide, le fallback SVG est là)
  if (e._gphoto_urls !== undefined) return;

  // Sans place_id : tenter de le résoudre via maps_url ou Text Search
  if (!e.place_id) {
    // Tentative 1 : extraire directement depuis maps_url
    var extracted = _extractPlaceIdFromUrl(e.maps_url);
    if (extracted) {
      e.place_id = extracted;
      // Continuer normalement (tombera dans la section "avec place_id" ci-dessous)
    } else {
      // Tentative 2 : Text Search API Google (si maps_url ou nom disponible)
      if (e.maps_url || e.nom) {
        // Marquer en cours de résolution pour éviter double enqueue
        e._gphoto_urls = undefined;
        e._gphoto_resolving = true;
        var query = _buildSearchQuery(e);
        _resolveTextSearch(query, function(pid) {
          e._gphoto_resolving = false;
          if (pid) {
            e.place_id = pid;
            // Relancer l'enqueue maintenant qu'on a le place_id
            e._gphoto_urls = undefined;
            _gphotoEnqueue(e);
            // Re-render
            setTimeout(function(){
              if(typeof renderAll === 'function') renderAll();
              if(typeof renderHome === 'function') renderHome();
            }, 0);
          } else {
            // Aucun résultat → fallback SVG
            e._gphoto_urls = [];
            e._fallback_svg = generateFallbackPhoto(e.type, e.nom);
            setTimeout(function(){
              if(typeof renderAll === 'function') renderAll();
              if(typeof renderHome === 'function') renderHome();
            }, 0);
          }
        });
        // Afficher le fallback SVG pendant le chargement asynchrone des photos admin
        e._gphoto_urls = [];
        e._fallback_svg = generateFallbackPhoto(e.type, e.nom);
        return;
      }
      // Vraiment rien disponible → fallback SVG
      e._gphoto_urls = [];
      e._fallback_svg = generateFallbackPhoto(e.type, e.nom);
      return;
    }
  }

  // Avec place_id : vérifier le cache d'abord
  var cached = _gphotoReadCache(e.place_id);
  if (cached !== null) {
    e._gphoto_urls = cached;
    if (cached.length === 0) e._fallback_svg = generateFallbackPhoto(e.type, e.nom);
    return;
  }
  // Sinon : mettre en file d'attente
  var already = _gphotoFetchQueue.some(function(i){ return i.e.place_id === e.place_id; });
  if (!already) _gphotoFetchQueue.push({ e: e });
}

/* ── autoFetchAllGooglePhotos DÉSACTIVÉE ────────────────────────────────
 * Ancienne fonction qui enqueues TOUS les établissements en une fois
 * → des centaines de requêtes Google simultanées → crash navigateur mobile.
 * Les photos sont maintenant chargées à la demande (lazy) via _gphotoEnqueue()
 * appelé lors du rendu de chaque carte individuelle. */
function autoFetchAllGooglePhotos() {
  /* NO-OP intentionnel — ne pas réactiver sans throttling */
  return;
}
window.autoFetchAllGooglePhotos = autoFetchAllGooglePhotos;
window._gphotoEnqueue = _gphotoEnqueue;
window.generateFallbackPhoto = generateFallbackPhoto;

/* ── Résolution finale de la photo pour une carte ────────────────────── *
 * Priorité : profil approuvé > photo manuelle > Google > fallback SVG   */
function getGooglePhotoUrl(e, type) {
  // Photo de profil approuvée = priorité absolue
  if (e._photo_profile_approved) return e._photo_profile_approved;
  // Photos Google Places réelles = priorité sur photos manuelles
  if (e._gphoto_urls && e._gphoto_urls.length > 0) {
    // Pour intérieur on prend la 2e si dispo, sinon la 1re
    if (type === 'interieur' && e._gphoto_urls.length > 1) return e._gphoto_urls[1];
    return e._gphoto_urls[0];
  }
  // Lancer le fetch Google si pas encore fait
  if (e._gphoto_urls === undefined) _gphotoEnqueue(e);
  // Photos manuelles en attente du résultat Google
  if (type === 'exterieur' && e.photo_exterieur) return e.photo_exterieur;
  if (type === 'interieur' && e.photo_interieur) return e.photo_interieur;
  // Photo admin par défaut en priorité sur le fallback SVG généré
  var _admDefault = getAdminDefaultPhotoForEtab(e);
  if (_admDefault) {
    e._fallback_svg = _admDefault;
    e._fallback_svg_is_admin_default = true;
    return _admDefault;
  }
  // Fallback SVG généré
  if (e._fallback_svg) return e._fallback_svg;
  if (!e.place_id && !e._fallback_svg) {
    e._fallback_svg = generateFallbackPhoto(e.type, e.nom);
    e._fallback_svg_is_admin_default = false;
    return e._fallback_svg;
  }
  return null;
}

/* ══════════════════════════════════════════════════════════════
   ══ SYSTÈME PHOTO DE PROFIL — MODÉRATION RESPONSABLE/ADMIN  ══
   ══ Google propose → responsable/admin approuve             ══
   ══════════════════════════════════════════════════════════════ */

// Cache mémoire { eid: { url, status, source, approvedBy, ts } }
var _photoProfileCache = {};

// Charger la photo de profil approuvée depuis Firebase
function loadPhotoProfile(eid, callback) {
  if (!window.db || !window.fbGetDocs || !window.fbQuery || !window.fbCollection || !window.fbWhere || !window.fbOrderBy || !window.fbLimit) {
    if(callback) callback(null); return;
  }
  var eidStr = String(eid);
  if (_photoProfileCache[eidStr] !== undefined) {
    if(callback) callback(_photoProfileCache[eidStr]);
    return;
  }
  try {
    window.fbGetDocs(
      window.fbQuery(
        window.fbCollection(window.db, "etablissements", eidStr, "photo_profile"),
        window.fbWhere("status", "==", "approved"),
        window.fbOrderBy("ts", "desc"),
        window.fbLimit(1)
      )
    ).then(function(snap){
      if (!snap || snap.empty) {
        _photoProfileCache[eidStr] = null;
        if(callback) callback(null);
      } else {
        var d = snap.docs[0].data();
        _photoProfileCache[eidStr] = d;
        var etab = etablissements.find(function(x){ return String(x.id) === eidStr; });
        if (etab && d.url) etab._photo_profile_approved = d.url;
        if(callback) callback(d);
      }
    }).catch(function(){ _photoProfileCache[eidStr] = null; if(callback) callback(null); });
  } catch(e) { _photoProfileCache[eidStr] = null; if(callback) callback(null); }
}

// Charger toutes les photos profils au démarrage (avec délai pour éviter le flooding Firebase)
function loadAllPhotoProfiles() {
  if (!window.db || !etablissements) return;
  var list = etablissements.slice(0);
  var idx = 0;
  /* Utiliser requestIdleCallback si dispo — charge les photos uniquement quand
     le navigateur est inactif, sans jamais bloquer le thread UI principal */
  var _scheduleNext = window.requestIdleCallback
    ? function() { requestIdleCallback(loadNext, { timeout: 1500 }); }
    : function() { setTimeout(loadNext, 80); };
  function loadNext() {
    if (idx >= list.length) return;
    loadPhotoProfile(list[idx].id, null);
    idx++;
    _scheduleNext();
  }
  setTimeout(_scheduleNext, 800);
}
window.loadAllPhotoProfiles = loadAllPhotoProfiles;

// Proposer la meilleure photo Google comme photo de profil (en attente de modération)
function proposeGooglePhotoProfile(eid) {
  var eidStr = String(eid);
  var etab = etablissements.find(function(x){ return String(x.id) === eidStr; });
  if (!etab) { showToast("Établissement introuvable"); return; }

  // Vérification accès : admin ou responsable uniquement
  if (!isAdmin && !canEditPhotos(etab)) { showToast("Accès refusé"); return; }

  // Ouvrir le modal de choix : upload local OU lien
  _showPhotoChoiceModal(eid, etab);
}
window.proposeGooglePhotoProfile = proposeGooglePhotoProfile;

/* Modal de choix : photo depuis appareil OU lien URL/Google */
function _showPhotoChoiceModal(eid, etab) {
  var eidStr = String(eid);
  var old = document.getElementById('_photoChoiceModal');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = '_photoChoiceModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.82);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

  // Créer un input file caché dédié à la photo de profil
  var fileInputId = '_profilePhotoFileInput_' + eidStr;
  var existingInput = document.getElementById(fileInputId);
  if (existingInput) existingInput.remove();
  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.id = fileInputId;
  fileInput.accept = 'image/*';
  fileInput.style.display = 'none';
  fileInput.onchange = function() {
    var file = fileInput.files[0];
    if (!file) return;
    overlay.remove();
    showUploadProgress(20, "Compression...");
    // ✅ Système direct : compresse → base64 → updateField (sans Firebase Storage)
    compressImage(file, function(dataUrl) {
      if(!dataUrl){ hideUploadProgress(400); showToast("❌ Impossible de lire l'image"); fileInput.value=''; return; }
      showUploadProgress(70, "Sauvegarde...");
      updateField(eid, {photo_interieur: dataUrl, _photo_profile_approved: dataUrl});
      if (etab) etab._photo_profile_approved = dataUrl;
      try{
        localStorage.setItem('ambi_photo_'+eid+'_interieur', dataUrl);
        localStorage.setItem('ambi_photo_'+eid+'_profile', dataUrl);
      }catch(e){}
      hideUploadProgress(500);
      showToast("✅ Photo enregistrée !");
      if (typeof renderAll === "function") setTimeout(renderAll, 200);
    });
    fileInput.value = '';
  };
  document.body.appendChild(fileInput);

  var currentPhoto = etab._photo_profile_approved || etab.photo_interieur || etab.photo_exterieur || '';
  var previewHtml = currentPhoto
    ? '<div style="text-align:center;margin-bottom:0.9rem;"><img src="'+currentPhoto+'" style="width:100%;max-height:140px;object-fit:cover;border-radius:10px;border:1px solid rgba(255,45,155,0.3);" onerror="this.style.display=\'none\'"></div>'
    : '<div style="height:70px;display:flex;align-items:center;justify-content:center;color:#b088c0;font-size:0.78rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px dashed rgba(255,255,255,0.12);margin-bottom:0.9rem;">Aucune photo actuellement</div>';

  overlay.innerHTML = [
    '<div style="background:#1a0028;border:1px solid rgba(255,45,155,0.4);border-radius:20px;padding:1.4rem 1.2rem;width:min(360px,100%);max-height:92vh;overflow-y:auto;">',
    '<div style="font-family:Syne,sans-serif;font-size:1rem;font-weight:800;color:#ff2d9b;margin-bottom:0.2rem;">🖼️ Photo de présentation</div>',
    '<div style="font-size:0.7rem;color:#b088c0;margin-bottom:0.9rem;">'+escHtml(etab.nom||'')+'</div>',
    previewHtml,
    // Bouton upload principal
    '<label for="'+fileInputId+'" style="display:block;width:100%;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,#9D84FF,#7C5FE8);color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;text-align:center;box-sizing:border-box;margin-bottom:0.55rem;">📷 Choisir depuis l\'appareil</label>',
    // Séparateur
    '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.55rem;"><div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div><span style="font-size:0.62rem;color:#b088c0;">ou</span><div style="flex:1;height:1px;background:rgba(255,255,255,0.1);"></div></div>',
    // Bouton URL/Google Maps
    '<button onclick="document.getElementById(\'_photoChoiceModal\').remove();_showMapsLinkInputModal('+eid+',etablissements.find(function(x){return String(x.id)===\''+eidStr+'\'})||{})" style="display:block;width:100%;padding:0.65rem;border-radius:12px;border:1px solid rgba(255,45,155,0.35);background:rgba(255,45,155,0.08);color:#ff2d9b;font-family:DM Sans,sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;text-align:center;box-sizing:border-box;margin-bottom:0.55rem;">🔗 Coller un lien URL / Google Maps</button>',
    // Supprimer photo si elle existe
    currentPhoto ? '<button onclick="if(confirm(\'Supprimer la photo de présentation ?\')){'
      +'var obj={photo_interieur:\'\',_photo_profile_approved:\'\'};updateField('+eid+',obj);'
      +'var et=etablissements.find(function(x){return String(x.id)===\''+eidStr+'\';});if(et){et._photo_profile_approved=\'\';et.photo_interieur=\'\';}localStorage.removeItem(\'ambi_photo_'+eid+'_interieur\');localStorage.removeItem(\'ambi_photo_'+eid+'_profile\');'
      +'if(\'indexedDB\' in window){var req=indexedDB.open(\'AMBI241_DB\',1);req.onsuccess=function(ev){var db=ev.target.result;if(db.objectStoreNames.contains(\'photos\')){var tx=db.transaction(\'photos\',\'readwrite\');tx.objectStore(\'photos\').delete(\'ambi_photo_'+eid+'_interieur\');tx.objectStore(\'photos\').delete(\'ambi_photo_'+eid+'_profile\');}db.close();};}'
      +'showToast(\'Photo supprimée\');'
      +'if(typeof renderAll===\'function\')setTimeout(renderAll,200);document.getElementById(\'_photoChoiceModal\').remove();}" '
      +'style="display:block;width:100%;padding:0.5rem;border-radius:10px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:#ff4466;font-family:DM Sans,sans-serif;font-size:0.75rem;cursor:pointer;margin-bottom:0.5rem;">🗑️ Supprimer la photo actuelle</button>' : '',
    // Fermer
    '<button onclick="document.getElementById(\'_photoChoiceModal\').remove()" style="display:block;width:100%;padding:0.5rem;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:#b088c0;font-family:DM Sans,sans-serif;font-size:0.8rem;cursor:pointer;">Annuler</button>',
    '</div>'
  ].join('');

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(ev){ if(ev.target===overlay) overlay.remove(); });
}

/* Modal de saisie d'un lien Google Maps ou d'une URL image directe */
function _showMapsLinkInputModal(eid, etab) {
  var eidStr = String(eid);
  // Supprimer un modal précédent si présent
  var old = document.getElementById('_mapsLinkModal');
  if (old) old.remove();

  var overlay = document.createElement('div');
  overlay.id = '_mapsLinkModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';

  overlay.innerHTML = [
    '<div style="background:#1a0028;border:1px solid rgba(255,45,155,0.4);border-radius:20px;padding:1.4rem 1.2rem;width:min(380px,100%);max-height:90vh;overflow-y:auto;">',
    '<div style="font-family:Syne,sans-serif;font-size:1rem;font-weight:800;color:#ff2d9b;margin-bottom:0.25rem;">🗺️ Importer une photo</div>',
    '<div style="font-size:0.72rem;color:#b088c0;margin-bottom:1rem;line-height:1.5;">',
      'Colle un lien Google Maps <em>ou</em> une URL d\'image directe.<br>',
      '<span style="color:#00e5ff;">Ex : https://maps.app.goo.gl/... &nbsp;|&nbsp; https://exemple.com/photo.jpg</span>',
    '</div>',
    '<input id="_mapsLinkInput" type="url" placeholder="https://maps.app.goo.gl/..." ',
      'style="width:100%;padding:0.75rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,45,155,0.4);border-radius:8px;color:#fff0f8;font-size:0.82rem;font-family:DM Sans,sans-serif;margin-bottom:0.7rem;" ',
      'value="' + (etab.maps_url || '') + '">',
    '<div id="_mapsLinkStatus" style="font-size:0.7rem;color:#b088c0;min-height:1.2rem;margin-bottom:0.8rem;"></div>',
    '<div style="display:flex;gap:0.6rem;">',
      '<button onclick="document.getElementById(\'_mapsLinkModal\').remove()" ',
        'style="flex:1;padding:0.6rem;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#b088c0;font-family:DM Sans,sans-serif;font-size:0.8rem;cursor:pointer;">Annuler</button>',
      '<button id="_mapsLinkConfirm" onclick="_resolveMapsLinkAndImport(\'' + eidStr + '\')" ',
        'style="flex:2;padding:0.6rem;border-radius:10px;border:none;background:linear-gradient(135deg,#9D84FF,#7C5FE8);color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;">Charger →</button>',
    '</div>',
    '</div>'
  ].join('');

  document.body.appendChild(overlay);
  overlay.addEventListener('click', function(ev){ if(ev.target===overlay) overlay.remove(); });
  setTimeout(function(){ var inp = document.getElementById('_mapsLinkInput'); if(inp) inp.focus(); }, 80);
}
window._showMapsLinkInputModal = _showMapsLinkInputModal;

/* Résolution du lien saisi : place_id → photos Google OU URL directe → photo immédiate */
function _resolveMapsLinkAndImport(eidStr) {
  var inp = document.getElementById('_mapsLinkInput');
  var statusEl = document.getElementById('_mapsLinkStatus');
  var btn = document.getElementById('_mapsLinkConfirm');
  if (!inp) return;
  var val = (inp.value || '').trim();
  if (!val) { if(statusEl) statusEl.textContent = '⚠️ Champ vide'; return; }

  var etab = etablissements.find(function(x){ return String(x.id) === eidStr; });
  if (!etab) return;

  // Cas 1 : URL d'image directe (jpg/png/webp/jpeg/gif)
  if (/\.(jpe?g|png|webp|gif|bmp)(\?.*)?$/i.test(val) || val.includes('googleusercontent') || val.includes('fbcdn') || val.includes('cloudinary') || val.includes('imgur')) {
    if(btn) btn.disabled = true;
    if(statusEl) statusEl.innerHTML = '<span style="color:#00e5ff;">⏳ Vérification de l\'image…</span>';
    var testImg = new Image();
    testImg.onload = function() {
      document.getElementById('_mapsLinkModal') && document.getElementById('_mapsLinkModal').remove();
      savePhotoProfile(etab.id, val, 'url_directe');
    };
    testImg.onerror = function() {
      if(btn) btn.disabled = false;
      if(statusEl) statusEl.innerHTML = '<span style="color:#ff4466;">❌ URL image inaccessible</span>';
    };
    testImg.src = val;
    return;
  }

  // Cas 2 : Lien Google Maps — tenter d'en extraire le place_id
  if(btn) btn.disabled = true;
  if(statusEl) statusEl.innerHTML = '<span style="color:#00e5ff;">⏳ Recherche de la fiche Google…</span>';

  // Mise à jour du maps_url sur l'objet local
  etab.maps_url = val;

  // Tentative extraction directe
  var extracted = _extractPlaceIdFromUrl(val);
  if (extracted) {
    etab.place_id = extracted;
    etab._gphoto_urls = undefined; // reset pour forcer refetch
    document.getElementById('_mapsLinkModal') && document.getElementById('_mapsLinkModal').remove();
    _showPhotoImportModal(etab.id, etab);
    return;
  }

  // Text Search sur le nom de recherche dans l'URL ou le nom de l'établissement
  var query = _buildSearchQuery(etab);
  _resolveTextSearch(query, function(pid) {
    if (pid) {
      etab.place_id = pid;
      etab._gphoto_urls = undefined;
      document.getElementById('_mapsLinkModal') && document.getElementById('_mapsLinkModal').remove();
      _showPhotoImportModal(etab.id, etab);
    } else {
      if(btn) btn.disabled = false;
      if(statusEl) statusEl.innerHTML = '<span style="color:#ff4466;">❌ Établissement introuvable sur Google. Essaie une URL d\'image directe.</span>';
    }
  });
}
window._resolveMapsLinkAndImport = _resolveMapsLinkAndImport;

/* Affichage du sélecteur de photos Google après résolution */
function _showPhotoImportModal(eid, etab) {
  if (etab._gphoto_urls && etab._gphoto_urls.length > 0) {
    openPhotoModerationModal(eid, etab._gphoto_urls);
    return;
  }
  // Fetch frais
  etab._gphoto_urls = undefined;
  _gphotoFetchOne(etab, function(url){
    if (!url || !etab._gphoto_urls || etab._gphoto_urls.length === 0) {
      showToast("Aucune photo Google trouvée pour cet établissement");
      return;
    }
    openPhotoModerationModal(eid, etab._gphoto_urls);
  });
}
window._showPhotoImportModal = _showPhotoImportModal;

// Sauvegarder la photo de profil choisie (status: pending → admin/responsable valide)
function savePhotoProfile(eid, url, source) {
  if (!window.db) return;
  var eidStr = String(eid);
  var userEmail = currentUserEmail || "inconnu";
  var data = {
    url: url,
    status: (isAdmin || isResponsable(eid)) ? "approved" : "pending",
    source: source || "google",
    proposedBy: userEmail,
    approvedBy: (isAdmin || isResponsable(eid)) ? userEmail : null,
    ts: Date.now()
  };
  window.fbAddDoc(window.fbCollection(window.db, "etablissements", eidStr, "photo_profile"), data)
    .then(function(){
      _photoProfileCache[eidStr] = undefined; // Invalider cache
      if (data.status === "approved") {
        var etab = etablissements.find(function(x){ return String(x.id) === eidStr; });
        if (etab) etab._photo_profile_approved = url;
        showToast("✅ Photo de profil approuvée et active !");
      } else {
        showToast("📤 Photo soumise pour modération");
      }
      if(typeof renderAll === "function") setTimeout(renderAll, 200);
    })
    .catch(function(e){ showToast("Erreur sauvegarde: " + e.message); });
}
window.savePhotoProfile = savePhotoProfile;

// Approuver une photo en attente (admin ou responsable)
function approvePhotoProfile(eid, docId, url) {
  if (!window.db) return;
  var eidStr = String(eid);
  window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", eidStr, "photo_profile", docId), {
    status: "approved",
    approvedBy: currentUserEmail || "admin",
    approvedAt: Date.now()
  }).then(function(){
    _photoProfileCache[eidStr] = undefined;
    var etab = etablissements.find(function(x){ return String(x.id) === eidStr; });
    if (etab) etab._photo_profile_approved = url;
    showToast("✅ Photo approuvée comme photo de profil !");
    if(typeof renderAll === "function") setTimeout(renderAll, 300);
  }).catch(function(e){ showToast("Erreur: " + e.message); });
}
window.approvePhotoProfile = approvePhotoProfile;

// Rejeter une photo
function rejectPhotoProfile(eid, docId) {
  if (!window.db) return;
  var eidStr = String(eid);
  window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", eidStr, "photo_profile", docId), {
    status: "rejected",
    rejectedBy: currentUserEmail || "admin",
    rejectedAt: Date.now()
  }).then(function(){
    showToast("❌ Photo rejetée");
  }).catch(function(e){ showToast("Erreur: " + e.message); });
}
window.rejectPhotoProfile = rejectPhotoProfile;

// Vérifier si l'utilisateur est responsable de l'établissement
function isResponsable(eid) {
  if (!currentUserEmail) return false;
  var etab = etablissements.find(function(x){ return String(x.id) === String(eid); });
  if (!etab) return false;
  return etab.responsable_email && etab.responsable_email === currentUserEmail;
}
window.isResponsable = isResponsable;

/* ── Modal de sélection/modération de photo de profil ── */
function openPhotoModerationModal(eid, googleUrls) {
  var existing = document.getElementById("__photoModerationModal");
  if (existing) existing.remove();

  var etab = etablissements.find(function(x){ return String(x.id) === String(eid); }) || {};
  var currentApproved = etab._photo_profile_approved || null;
  var urls = googleUrls || (etab._gphoto_urls || []);

  var html = "<div id='__photoModerationModal' style='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.88);display:flex;align-items:flex-end;justify-content:center;padding:1rem;'>";
  html += "<div style='background:var(--surface);border:1px solid rgba(255,45,155,0.3);border-radius:20px 20px 16px 16px;width:100%;max-width:460px;max-height:88vh;overflow-y:auto;padding:1.2rem;'>";

  // Header
  html += "<div style='display:flex;align-items:center;gap:0.6rem;margin-bottom:1rem;'>";
  html += "<span style='font-size:1.3rem;'>🖼️</span>";
  html += "<div style='flex:1;'><div style='font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.92rem;'>Photo de Profil</div>";
  html += "<div style='font-size:0.68rem;color:var(--muted);'>" + escHtml(etab.nom || "") + " — Choisir la meilleure photo</div></div>";
  html += "<button onclick=\"document.getElementById('__photoModerationModal').remove()\" style='background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);border-radius:8px;padding:0.3rem 0.6rem;cursor:pointer;font-size:0.8rem;'>✕</button>";
  html += "</div>";

  // Photo actuelle approuvée
  if (currentApproved) {
    html += "<div style='margin-bottom:1rem;'>";
    html += "<div style='font-size:0.65rem;font-weight:800;color:var(--green);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.4rem;'>✅ Photo active actuellement</div>";
    html += "<div style='position:relative;border-radius:12px;overflow:hidden;border:2px solid rgba(0,255,170,0.5);'>";
    html += "<img src='" + currentApproved + "' style='width:100%;height:140px;object-fit:cover;display:block;'>";
    html += "<span style='position:absolute;top:6px;right:6px;background:rgba(0,255,170,0.9);color:#000;font-size:0.55rem;font-weight:800;padding:0.15rem 0.4rem;border-radius:6px;'>PROFIL ACTIF</span>";
    html += "</div></div>";
  }

  // Photos Google disponibles
  if (urls.length > 0) {
    html += "<div style='font-size:0.65rem;font-weight:800;color:var(--cyan);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🗺️ Photos Google Maps disponibles</div>";
    html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;'>";
    urls.forEach(function(url, i) {
      var isCurrent = (url === currentApproved);
      html += "<div onclick=\"selectGooglePhotoProfile(" + eid + ",'" + url.replace(/'/g,"\\'") + "',this)\" style='position:relative;border-radius:10px;overflow:hidden;border:2px solid " + (isCurrent ? "rgba(0,255,170,0.6)" : "rgba(255,255,255,0.1)") + ";cursor:pointer;transition:border-color 0.2s;'>";
      html += "<img src='" + url + "' style='width:100%;height:90px;object-fit:cover;display:block;'>";
      if (i === 0) html += "<span style='position:absolute;top:4px;left:4px;background:rgba(255,45,155,0.9);color:#fff;font-size:0.5rem;font-weight:800;padding:0.1rem 0.3rem;border-radius:4px;'>⭐ MEILLEURE</span>";
      if (isCurrent) html += "<span style='position:absolute;bottom:4px;right:4px;background:rgba(0,255,170,0.9);color:#000;font-size:0.5rem;font-weight:800;padding:0.1rem 0.3rem;border-radius:4px;'>✓ ACTIVE</span>";
      html += "</div>";
    });
    html += "</div>";
  } else {
    html += "<div style='text-align:center;padding:1.5rem;color:var(--muted);font-size:0.78rem;'>⏳ Chargement des photos Google en cours...</div>";
  }

  // Bouton valider la sélection
  html += "<div id='_ppm_selected_preview' style='display:none;margin-bottom:0.8rem;'>";
  html += "<div style='font-size:0.65rem;font-weight:800;color:var(--amber);text-transform:uppercase;margin-bottom:0.4rem;'>📌 Sélectionnée</div>";
  html += "<img id='_ppm_selected_img' src='' style='width:100%;height:110px;object-fit:cover;border-radius:10px;border:2px solid rgba(255,215,0,0.5);'>";
  html += "</div>";

  html += "<button id='_ppm_confirm_btn' onclick=\"confirmPhotoProfileSelection(" + eid + ")\" style='display:none;width:100%;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;'>✅ Approuver cette photo comme profil</button>";

  html += "</div></div>";

  document.body.insertAdjacentHTML("beforeend", html);
}
window.openPhotoModerationModal = openPhotoModerationModal;

// Sélection d'une photo dans la grille
window._ppm_selected_url = null;
function selectGooglePhotoProfile(eid, url, el) {
  window._ppm_selected_url = url;
  window._ppm_selected_eid = eid;
  // Highlight sélection
  var grid = el.parentElement;
  Array.from(grid.children).forEach(function(c){ c.style.borderColor = "rgba(255,255,255,0.1)"; });
  el.style.borderColor = "rgba(255,215,0,0.8)";
  // Afficher preview
  var preview = document.getElementById("_ppm_selected_preview");
  var img = document.getElementById("_ppm_selected_img");
  var btn = document.getElementById("_ppm_confirm_btn");
  if (preview) preview.style.display = "block";
  if (img) img.src = url;
  if (btn) btn.style.display = "block";
}
window.selectGooglePhotoProfile = selectGooglePhotoProfile;

function confirmPhotoProfileSelection(eid) {
  var url = window._ppm_selected_url;
  if (!url) { showToast("Sélectionnez une photo d'abord"); return; }
  savePhotoProfile(eid, url, "google");
  var modal = document.getElementById("__photoModerationModal");
  if (modal) modal.remove();
}
window.confirmPhotoProfileSelection = confirmPhotoProfileSelection;

function isGooglePlacesPhoto(url) {
  if (!url) return false;
  return url.indexOf("maps.googleapis.com/maps/api/place/photo") !== -1
      || url.indexOf("lh3.googleusercontent.com") !== -1
      || url.indexOf("lh4.googleusercontent.com") !== -1
      || url.indexOf("lh5.googleusercontent.com") !== -1
      || url.indexOf("lh6.googleusercontent.com") !== -1;
}

/* ══════════════════════════════════════════════════════════════
   ══ SYSTÈME MÉTÉO — Open-Meteo (gratuit, sans clé API)       ══
   ══ Libreville, Gabon · lat:0.3924 lng:9.4536               ══
   ══ Mise à jour toutes les 30 minutes                        ══
   ══════════════════════════════════════════════════════════════ */

var METEO_LAT  = 0.3924;
var METEO_LNG  = 9.4536;
var METEO_CACHE_KEY = "ambi241_meteo_cache";
var METEO_CACHE_TTL = 90 * 60 * 1000; // 90 min — limite les requêtes réseau
var _meteoData = null;

// Codes WMO → emoji + description française
var WMO_CODES = {
  0:  { icon:"☀️",  label:"Ciel dégagé" },
  1:  { icon:"🌤️", label:"Principalement dégagé" },
  2:  { icon:"⛅",  label:"Partiellement nuageux" },
  3:  { icon:"☁️",  label:"Couvert" },
  45: { icon:"🌫️", label:"Brouillard" },
  48: { icon:"🌫️", label:"Brouillard givrant" },
  51: { icon:"🌦️", label:"Bruine légère" },
  53: { icon:"🌦️", label:"Bruine modérée" },
  55: { icon:"🌧️", label:"Bruine dense" },
  61: { icon:"🌧️", label:"Pluie légère" },
  63: { icon:"🌧️", label:"Pluie modérée" },
  65: { icon:"🌧️", label:"Forte pluie" },
  80: { icon:"🌦️", label:"Averses légères" },
  81: { icon:"🌧️", label:"Averses modérées" },
  82: { icon:"⛈️",  label:"Averses violentes" },
  95: { icon:"⛈️",  label:"Orage" },
  96: { icon:"⛈️",  label:"Orage avec grêle" },
  99: { icon:"⛈️",  label:"Orage violent" }
};

function getWmo(code) {
  return WMO_CODES[code] || { icon:"🌡️", label:"Conditions variables" };
}

// Calcul ressenti (Humidex simplifié pour tropical)
function calcFeelsLike(temp, humid) {
  var e = 6.105 * Math.exp(17.27 * temp / (237.7 + temp)) * (humid / 100);
  var humidex = temp + 0.5555 * (e - 10);
  return Math.round(humidex);
}

// Alerte météo selon conditions
function getMeteoAlert(code, wind, rain) {
  if (code >= 95) return "⚡ Alerte orage — Sorties déconseillées";
  if (code >= 80 && rain > 5) return "🌧️ Fortes averses prévues ce soir";
  if (wind > 40) return "💨 Vent fort — Terrasses perturbées";
  if (code >= 61 && rain > 2) return "☔ Pluie en cours — Prévoyez un abri";
  return null;
}

// Récupérer météo depuis Open-Meteo
function fetchMeteo(forceRefresh) {
  // Cache localStorage
  if (!forceRefresh) {
    try {
      var cached = JSON.parse(localStorage.getItem(METEO_CACHE_KEY) || "null");
      if (cached && (Date.now() - cached.ts < METEO_CACHE_TTL)) {
        _meteoData = cached.data;
        renderMeteo(cached.data);
        return;
      }
    } catch(e) {}
  }

  var url = "https://api.open-meteo.com/v1/forecast"
    + "?latitude=" + METEO_LAT
    + "&longitude=" + METEO_LNG
    + "&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,surface_pressure,visibility"
    + "&hourly=temperature_2m,precipitation_probability,weather_code"
    + "&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,precipitation_sum,uv_index_max"
    + "&timezone=Africa%2FLibreville"
    + "&forecast_days=3";

  // XMLHttpRequest pour compatibilité file:// et CORS
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.onreadystatechange = function() {
    if (xhr.readyState !== 4) return;
    if (xhr.status === 200) {
      try {
        var data = JSON.parse(xhr.responseText);
        _meteoData = data;
        try { localStorage.setItem(METEO_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
        renderMeteo(data);
      } catch(e) { renderMeteoError(); }
    } else {
      renderMeteoError();
    }
  };
  xhr.onerror = function() { renderMeteoError(); };
  xhr.send();
}

// Afficher la météo dans le widget hero
function renderMeteo(data) {
  if (!data || !data.current) return;
  var c = data.current;
  var wmo = getWmo(c.weather_code);
  var temp   = Math.round(c.temperature_2m);
  var humid  = Math.round(c.relative_humidity_2m);
  var wind   = Math.round(c.wind_speed_10m);
  var rain   = c.precipitation || 0;
  var feel   = Math.round(c.apparent_temperature || calcFeelsLike(temp, humid));
  var alert  = getMeteoAlert(c.weather_code, wind, rain);

  // Hero widget
  var elIcon  = document.getElementById("meteoIcon");
  var elTemp  = document.getElementById("meteoTemp");
  var elFeel  = document.getElementById("meteoFeel");
  var elHumid = document.getElementById("meteoHumid");
  var elWind  = document.getElementById("meteoWind");
  var elPluie = document.getElementById("meteoPluie");
  var elDesc  = document.getElementById("meteoDesc");
  var elAlert = document.getElementById("meteoAlert");
  var elStrip = document.getElementById("meteoStrip");

  if (elIcon)  elIcon.textContent  = wmo.icon;
  if (elTemp)  elTemp.textContent  = temp;
  if (elFeel)  elFeel.textContent  = feel;
  if (elHumid) elHumid.textContent = humid + "%";
  if (elWind)  elWind.textContent  = wind + " km/h";
  if (elPluie) elPluie.textContent = rain.toFixed(1) + " mm";
  if (elDesc)  elDesc.textContent  = wmo.label + " · Libreville";

  if (elAlert) {
    if (alert) {
      elAlert.textContent = alert;
      elAlert.style.display = "block";
    } else {
      elAlert.style.display = "none";
    }
  }

  // Couleur strip selon conditions
  if (elStrip) {
    if (c.weather_code >= 95) {
      elStrip.style.borderColor = "rgba(255,68,102,0.4)";
      elStrip.style.background  = "rgba(255,68,102,0.06)";
    } else if (c.weather_code >= 61) {
      elStrip.style.borderColor = "rgba(0,229,255,0.2)";
      elStrip.style.background  = "rgba(0,229,255,0.04)";
    } else if (c.weather_code === 0 || c.weather_code === 1) {
      elStrip.style.borderColor = "rgba(255,215,0,0.25)";
      elStrip.style.background  = "rgba(255,215,0,0.04)";
    }
  }

  // Mettre à jour le mini badge météo sur chaque carte si présent
  renderMeteoMini(temp, wmo.icon, alert);

  // Afficher prévisions dans les cartes terrasses
  renderMeteoTerrasse(data);
}

function renderMeteoError() {
  var el = document.getElementById("meteoDesc");
  if (el) el.textContent = "Météo · Libreville";
  var mini = document.getElementById("meteoMiniSyncBar");
  if (mini) mini.textContent = "🌡️ LBV";
  // Masquer le strip si pas de données - afficher version minimaliste
  var strip = document.getElementById("meteoStrip");
  if (strip) {
    strip.innerHTML = "<span style='font-size:0.65rem;color:var(--muted);'>🌡️ Météo · Libreville &nbsp;·&nbsp; <span style=\'color:var(--cyan);\'>Données disponibles avec connexion internet</span></span>";
  }
}

// Mini badge météo dans la live banner (sync-bar)
function renderMeteoMini(temp, icon, alert) {
  var mini = document.getElementById("meteoMiniSyncBar");
  if (mini) {
    mini.innerHTML = icon + " " + temp + "°C" + (alert ? " ⚠️" : "");
    mini.title = alert || ("Météo Libreville " + temp + "°C");
  }
}

// Conseil météo pour les terrasses / bars extérieurs
function renderMeteoTerrasse(data) {
  if (!data || !data.current) return;
  var c = data.current;
  var wmo = getWmo(c.weather_code);
  // Mettre à jour tous les éléments de classe meteo-terrasse-badge
  document.querySelectorAll(".meteo-terrasse-badge").forEach(function(el){
    var rain = c.precipitation || 0;
    if (c.weather_code >= 61 || rain > 1) {
      el.textContent = "🌧️ Pluie en cours";
      el.style.color = "var(--cyan)";
    } else if (c.weather_code >= 95) {
      el.textContent = "⛈️ Orage — Terrasse fermée ?";
      el.style.color = "var(--red)";
    } else {
      el.textContent = wmo.icon + " " + Math.round(c.temperature_2m) + "°C · Terrasse agréable";
      el.style.color = "var(--green)";
    }
  });
}

// Prévisions horaires pour ce soir (18h-02h)
function getMeteoSoiree() {
  if (!_meteoData || !_meteoData.hourly) return null;
  var hours = _meteoData.hourly;
  var now = new Date();
  var results = [];
  for (var i = 0; i < hours.time.length; i++) {
    var t = new Date(hours.time[i]);
    var h = t.getHours();
    if (t.toDateString() === now.toDateString() && h >= 18 && h <= 23) {
      results.push({
        heure: h + "h",
        temp: Math.round(hours.temperature_2m[i]),
        pluie_prob: hours.precipitation_probability[i],
        code: hours.weather_code[i],
        wmo: getWmo(hours.weather_code[i])
      });
    }
  }
  return results;
}
window.getMeteoSoiree = getMeteoSoiree;

// Générer HTML prévisions soirée (utilisé dans les fiches)
function renderMeteoSoireeHtml() {
  var soiree = getMeteoSoiree();
  if (!soiree || soiree.length === 0) return "";
  var html = "<div style='display:flex;gap:0.4rem;overflow-x:auto;padding:0.3rem 0;'>";
  soiree.forEach(function(s){
    var pColor = s.pluie_prob > 60 ? "var(--cyan)" : s.pluie_prob > 30 ? "var(--amber)" : "var(--green)";
    html += "<div style='flex-shrink:0;text-align:center;background:rgba(0,0,0,0.3);border-radius:8px;padding:0.35rem 0.5rem;min-width:38px;'>";
    html += "<div style='font-size:0.58rem;color:var(--muted);'>" + s.heure + "</div>";
    html += "<div style='font-size:1rem;'>" + s.wmo.icon + "</div>";
    html += "<div style='font-size:0.62rem;font-weight:700;color:var(--text);'>" + s.temp + "°</div>";
    html += "<div style='font-size:0.52rem;color:" + pColor + ";'>" + s.pluie_prob + "%</div>";
    html += "</div>";
  });
  html += "</div>";
  return html;
}
window.renderMeteoSoireeHtml = renderMeteoSoireeHtml;

// Démarrage + refresh automatique (90 min) — pause quand onglet invisible
var _meteoIntervalId = null;
var _meteoInitDone = false; // garde contre double appel
function _startMeteoInterval() {
  if (_meteoIntervalId) return;
  _meteoIntervalId = setInterval(function(){
    if (!document.hidden) fetchMeteo(true);
  }, METEO_CACHE_TTL);
}
function initMeteo() {
  if (_meteoInitDone) return; // déjà initialisé — évite double intervalle/listener
  _meteoInitDone = true;
  fetchMeteo(false);
  _startMeteoInterval();
  // Page Visibility API : refresh uniquement quand l'onglet redevient actif ET que le cache est périmé
  document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
      try {
        var cached = JSON.parse(localStorage.getItem(METEO_CACHE_KEY) || "null");
        if (!cached || (Date.now() - cached.ts >= METEO_CACHE_TTL)) fetchMeteo(true);
      } catch(e) { fetchMeteo(false); }
    }
  });
}
window.initMeteo = initMeteo;

var VISIT_KEY="ambi241_visits";
var isAdmin=false;
var isSuperAdmin=false;  // Premier admin / propriétaire de l'app
var currentUserEmail="";

/* ══════════════════════════════════════════════════════════════
   🔐 SÉCURITÉ — Vérification Firebase custom claims
   Chaque action sensible appelle _verifyAdminClaim() au lieu
   de lire la variable globale isAdmin (contournable en console).
   ══════════════════════════════════════════════════════════════ */
/**
 * Vérifie via Firebase que l'utilisateur courant a bien le claim admin=true.
 * Retourne une Promise<boolean>.
 * @param {boolean} forceRefresh - Si true, force un nouveau token (défaut: false).
 */
function _verifyAdminClaim(forceRefresh){
  if(!window.auth || !window.auth.currentUser) return Promise.resolve(false);
  return window.auth.currentUser.getIdTokenResult(!!forceRefresh).then(function(result){
    return result.claims && result.claims.admin === true;
  }).catch(function(){ return false; });
}
window._verifyAdminClaim = _verifyAdminClaim;

/**
 * Wrapper pour les actions sensibles admin.
 * Vérifie les claims, execute fn() si autorisé, sinon affiche "Accès refusé".
 * @param {Function} fn - Fonction à exécuter si admin confirmé
 * @param {boolean} forceRefresh - Forcer rechargement token
 */
function _withAdminGuard(fn, forceRefresh){
  _verifyAdminClaim(forceRefresh).then(function(claimOk){
    // Accepte : claim Firebase OU mode PIN local (isAdmin) — double vérif
    if(claimOk || isAdmin){
      fn();
    } else {
      showToast("🔒 Accès refusé — vérification admin échouée");
      // Forcer déconnexion du mode admin si la session a expiré
      if(isAdmin){ isAdmin=false; isSuperAdmin=false; renderStats&&renderStats(); renderAll&&renderAll(); }
    }
  });
}
window._withAdminGuard = _withAdminGuard;

/* ══════════════════════════════════════════════════════════════
   🔑 SÉCURITÉ — Génération d'IDs cryptographiquement sûrs
   Remplace Date.now() pour les tokens de commande / noms de fichiers.
   ══════════════════════════════════════════════════════════════ */
/**
 * Génère un identifiant aléatoire sécurisé (base36).
 * @param {number} [len=16] - Longueur souhaitée
 * @returns {string}
 */
function _cryptoId(len){
  len = len || 16;
  var arr = new Uint32Array(Math.ceil(len / 5) + 1);
  crypto.getRandomValues(arr);
  return Array.from(arr, function(n){ return n.toString(36); }).join('').slice(0, len);
}
window._cryptoId = _cryptoId;

/**
 * Génère un token de commande préfixé, sécurisé.
 * @param {string} [prefix='ORD'] - Préfixe du token
 * @returns {string} Ex: "ORD-k7f2m9x4a1bc3e5d"
 */
function _cryptoOrderToken(prefix){
  return (prefix || 'ORD') + '-' + _cryptoId(16);
}
window._cryptoOrderToken = _cryptoOrderToken;
var currentType="all";

// 🔐 SÉCURITÉ PAIEMENTS
var currentUserRole="user"; // "admin" | "super_admin" | "establishment" | "user"
var currentEstablishmentId=null; // Nom de l'établissement connecté (si rôle establishment)
var _payEstablishmentFilter=null; // Filtre admin : restreindre à un établissement précis

// ── SUPER-ADMIN (propriétaire unique de l'application) ──────
// L'email du premier admin est stocké dans Firebase (collection "config/superadmin")
// et en localStorage comme fallback. Il est le SEUL à pouvoir gérer les autres admins.
var SUPER_ADMIN_KEY = "ambi241_superadmin_email";
var _superAdminEmail = "";  // chargé depuis Firebase au démarrage
var _adminsList = [];       // liste des admins secondaires chargée depuis Firebase

function loadSuperAdmin(){
  // Lire depuis localStorage en fallback
  _superAdminEmail = lsGet(SUPER_ADMIN_KEY, "");
}

function isSuperAdminUser(){
  // CAS 1 : Admin via PIN sans compte Firebase connecté → propriétaire par défaut
  if(isAdmin && !currentUserEmail) return true;
  // CAS 2 : Admin via PIN + compte Firebase connecté
  if(isAdmin && currentUserEmail){
    var superEmail = _superAdminEmail || lsGet(SUPER_ADMIN_KEY, "");
    // Pas encore de superadmin défini → cet admin est le propriétaire
    if(!superEmail) return true;
    return currentUserEmail.toLowerCase().trim() === superEmail.toLowerCase().trim();
  }
  return false;
}

// Charge la config super-admin et la liste des admins depuis Firebase
function loadAdminConfig(){
  if(!window.db || typeof window.fbGetDoc !== "function"){
    // Firebase pas encore initialise : reessayer dans 300ms
    setTimeout(function(){ loadAdminConfig(); }, 300);
    return;
  }
  // S'assurer que currentUserEmail est synchronisé avec window.currentUserEmail
  if(!currentUserEmail && window.currentUserEmail) currentUserEmail = window.currentUserEmail;

  // ── Auto-enregistrement immédiat si aucun superadmin en cache ──
  var cachedSuper = lsGet(SUPER_ADMIN_KEY, "");
  if(!cachedSuper && isAdmin && currentUserEmail){
    _superAdminEmail = currentUserEmail;
    lsSet(SUPER_ADMIN_KEY, currentUserEmail);
    // Rafraîchir immédiatement l'UI avec le fallback local
    if(_currentAdmTab === "users") renderAdmUsers();
    if(_currentAdmTab === "settings") renderAdmSettings();
  }

  // Charger le superadmin depuis Firebase
  window.fbGetDoc(window.fbDoc(window.db, "config", "superadmin")).then(function(snap){
    if(snap.exists()){
      var data = snap.data();
      _superAdminEmail = data.email || "";
      lsSet(SUPER_ADMIN_KEY, _superAdminEmail);
    } else if(isAdmin && currentUserEmail){
      // Aucun doc Firebase → se proclamer superadmin et l'écrire
      _initSuperAdmin(currentUserEmail);
    }
    // Toujours synchroniser isSuperAdmin global après résolution Firebase
    isSuperAdmin = isSuperAdminUser();
    // Rafraîchir l'affichage si panel admin ouvert
    if(isAdmin && _currentAdmTab === "users") renderAdmUsers();
    if(isAdmin && _currentAdmTab === "settings") renderAdmSettings();
  }).catch(function(){
    // En cas d'erreur réseau : utiliser le fallback local
    isSuperAdmin = isSuperAdminUser();
    if(isAdmin && _currentAdmTab === "users") renderAdmUsers();
  });

  // Charger la liste des admins secondaires
  window.fbGetDoc(window.fbDoc(window.db, "config", "admins")).then(function(snap){
    if(snap.exists()){
      _adminsList = snap.data().list || [];
    }
    checkSecondaryAdminAccess();
    // Recharger l'onglet membres pour afficher la liste à jour
    if(isAdmin && _currentAdmTab === "users") renderAdmUsers();
  }).catch(function(){});
}

// Initialise le superadmin (première fois)
function _initSuperAdmin(email){
  if(!window.db || !window.fbSetDoc || !window.fbDoc) return;
  window.fbSetDoc(window.fbDoc(window.db, "config", "superadmin"), {
    email: email,
    setAt: new Date().toISOString()
  }).then(function(){
    _superAdminEmail = email;
    lsSet(SUPER_ADMIN_KEY, email);
    isSuperAdmin = true;
    // Rafraîchir l'UI pour afficher les boutons SuperAdmin
    if(isAdmin && _currentAdmTab === "users") renderAdmUsers();
    if(isAdmin && _currentAdmTab === "settings") renderAdmSettings();
    showToast("👑 Propriétaire enregistré !");
  }).catch(function(){});
}

// Vérifie si l'utilisateur connecté est dans la liste des admins secondaires
function checkSecondaryAdminAccess(){
  if(!currentUserEmail || isAdmin) return;
  var em = currentUserEmail.toLowerCase().trim();
  var found = _adminsList.some(function(a){ return (a.email||"").toLowerCase().trim() === em; });
  if(found){
    isAdmin = true;
    isSuperAdmin = false;
    // Mettre à jour l'UI
    var abtn = document.getElementById("adminBtn");
    if(abtn){ abtn.style.background="rgba(255,215,0,0.2)"; abtn.style.borderColor="rgba(255,215,0,0.6)"; abtn.style.color="#ffd700"; }
    renderStats(); renderAll(); renderHome(); updatePayVis(); renderPayments();
    // ── Afficher le bouton Ajout rapide ──
    if(typeof window.aqaCheckAdminBtn==='function') window.aqaCheckAdminBtn();
    // ── Actualiser la visibilité des pro-panels ──
    if(typeof _applyFichesPanelVisibility === 'function') setTimeout(_applyFichesPanelVisibility, 300);
    showToast("🔑 Accès Admin secondaire activé");
  }
}

// Promouvoir un membre comme admin secondaire (SuperAdmin uniquement)
function promoteToAdmin(uid, email, pseudo){
  if(!isSuperAdminUser()){ showToast("Réservé au propriétaire de l'application"); return; }
  if(!window.db || !window.fbSetDoc || !window.fbDoc){ showToast("Firebase requis"); return; }
  if(!confirm("Promouvoir " + (pseudo||email) + " comme Admin secondaire ?\n\nIl pourra gérer les établissements, paiements et membres, mais PAS gérer d'autres admins.")){return;}

  var newList = _adminsList.filter(function(a){ return (a.email||"").toLowerCase() !== email.toLowerCase(); });
  newList.push({ uid: uid, email: email, pseudo: pseudo||email, promotedAt: new Date().toISOString() });

  window.fbSetDoc(window.fbDoc(window.db, "config", "admins"), { list: newList }).then(function(){
    _adminsList = newList;
    showToast("✅ " + (pseudo||email) + " promu Admin secondaire !");
    renderAdmUsers();

    // ── Mettre à jour le profil Firebase de l'utilisateur ──
    if(uid){
      window.fbSetDoc(window.fbDoc(window.db, "users", uid), { isSecondaryAdmin: true }, { merge: true }).catch(function(){});
    }

    // ── Notification instantanée dans Firebase (lue au prochain login du membre) ──
    var notifData = {
      targetUid:   uid   || "",
      targetEmail: email || "",
      icon:  "🔑",
      title: "Vous êtes maintenant Admin !",
      msg:   "Le propriétaire d'AMBI241 vous a accordé les droits d'administration. Entrez le code PIN pour accéder au tableau de bord.",
      key:   "promoted_admin",
      channel: "push",
      fromAdmin: true,
      ts:    Date.now(),
      unread: true
    };
    window.fbAddDoc(window.fbCollection(window.db, "user_notifications"), notifData).catch(function(){});

    // ── Notification locale immédiate (si le membre est connecté sur cet appareil) ──
    pushNotif({ targetRole:"all", key:"promoted_admin", icon:"🔑",
      title:"Nouveau droit Admin attribué",
      msg: (pseudo||email) + " est maintenant Admin secondaire.",
      channel:"push", fromAdmin:true });

  }).catch(function(err){ showToast("Erreur: "+err.message); });
}

// Révoquer un admin secondaire (SuperAdmin uniquement)
function revokeAdmin(uid, email, pseudo){
  if(!isSuperAdminUser()){ showToast("Réservé au propriétaire de l'application"); return; }
  if(!confirm("Révoquer les droits Admin de " + (pseudo||email) + " ?\n\nIl redeviendra simple membre.")){ return; }

  var newList = _adminsList.filter(function(a){ return (a.email||"").toLowerCase() !== email.toLowerCase(); });
  window.fbSetDoc(window.fbDoc(window.db, "config", "admins"), { list: newList }).then(function(){
    _adminsList = newList;
    showToast("✅ Droits Admin révoqués pour " + (pseudo||email));
    renderAdmUsers();

    // ── Mettre à jour le profil Firebase ──
    if(uid){
      window.fbSetDoc(window.fbDoc(window.db, "users", uid), { isSecondaryAdmin: false }, { merge: true }).catch(function(){});
    }

    // ── Notification instantanée de révocation ──
    var notifData = {
      targetUid:   uid   || "",
      targetEmail: email || "",
      icon:  "🔒",
      title: "Droits Admin révoqués",
      msg:   "Vos droits d'administration sur AMBI241 ont été révoqués par le propriétaire.",
      key:   "revoked_admin",
      channel: "push",
      fromAdmin: true,
      ts:    Date.now(),
      unread: true
    };
    window.fbAddDoc(window.fbCollection(window.db, "user_notifications"), notifData).catch(function(){});

  }).catch(function(err){ showToast("Erreur: "+err.message); });
}

// Céder la propriété de l'application (SuperAdmin → autre personne)
function transferOwnership(uid, email, pseudo){
  if(!isSuperAdminUser()){ showToast("Réservé au propriétaire de l'application"); return; }
  if(!confirm(
    "⚠️ TRANSFERT DE PROPRIÉTÉ\n\n" +
    "Vous allez céder la propriété complète d'AMBI241 à :\n" +
    (pseudo||email) + "\n\n" +
    "Vous perdrez vos droits SuperAdmin.\n\n" +
    "Cette action est IRRÉVERSIBLE. Confirmer ?"
  )){ return; }
  var oldEmail = _superAdminEmail;
  window.fbSetDoc(window.fbDoc(window.db, "config", "superadmin"), {
    email: email,
    transferredFrom: oldEmail,
    transferredAt: new Date().toISOString()
  }).then(function(){
    _superAdminEmail = email;
    lsSet(SUPER_ADMIN_KEY, email);
    isSuperAdmin = false;
    showToast("✅ Propriété transférée à " + (pseudo||email) + ". Vos droits SuperAdmin ont été révoqués.");
    renderAdmUsers();
    renderAdmSettings();
    // Promouvoir le nouveau proprio en admin
    if(window.fbSetDoc && uid){
      window.fbSetDoc(window.fbDoc(window.db, "users", uid), { isSecondaryAdmin: true }, { merge: true }).catch(function(){});
    }
  }).catch(function(err){ showToast("Erreur transfert: "+err.message); });
}

window.promoteToAdmin    = promoteToAdmin;
window.revokeAdmin       = revokeAdmin;
window.transferOwnership = transferOwnership;
var currentStatus="all";
var currentSort="affluence";
var currentView="compact";
var soireePhotos={};
var etablissements=[];

// ── PHOTOS GALERIE LOCALE (permanentes — max 5) — déclaré tôt car utilisé dans buildCard ──
var MAX_SLOT=5;
var SLOT_EXPIRE_MS = Number.MAX_SAFE_INTEGER; // Permanent : photos restent jusqu'à suppression manuelle
// ── PAIEMENTS : chargés depuis Firebase, pas de base hardcodée fictive ──
var _paiementsBase=[];  // sera alimenté exclusivement par Firebase + établissements réels
var _paiementsFirebase=[]; // chargés depuis Firebase
var paiements=[];

// Génère le tableau paiements complet : base + Firebase + tous les établissements non couverts
function rebuildPaiements(){
  // Fusionner base + Firebase (Firebase remplace la base si même nom)
  var merged={};
  _paiementsBase.forEach(function(p){ merged[p.nom.toLowerCase().trim()]=p; });
  _paiementsFirebase.forEach(function(p){ merged[p.nom.toLowerCase().trim()]=p; });

  // Ajouter tous les établissements manquants
  etablissements.forEach(function(e,i){
    var key=(e.nom||"").toLowerCase().trim();
    if(!merged[key]){
      var modes=["Airtel Money","Moov Money"];
      var mode=modes[i%2];
      // Date réelle si disponible (abonnement_activated_at), sinon date du jour
      var dateStr = "";
      if(e.abonnement_activated_at){
        var d=new Date(e.abonnement_activated_at);
        dateStr=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
      } else {
        var today=new Date();
        dateStr=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
      }
      // Statut basé sur le champ paiement de l'établissement
      var statut=(e.paiement&&e.paiement.indexOf("Actif")!==-1)?"Confirme":"En attente";
      var num=Object.keys(merged).length+1;
      merged[key]={
        id:"PAY-"+String(num).padStart(3,"0"),
        nom:e.nom,
        mode:mode,
        montant:5000,
        date:dateStr,
        statut:statut,
        _auto:true
      };
    }
  });

  // Reconstruire le tableau trié par id
  paiements=Object.values(merged).sort(function(a,b){
    return (a.id||"").localeCompare(b.id||"");
  });
}

// 🔐 SÉCURITÉ: Retourne uniquement les paiements accessibles selon le rôle
function getVisiblePayments(){
  var list=paiements;
  // Établissement : ne voit que ses propres paiements
  if(currentUserRole==="establishment"&&currentEstablishmentId){
    list=list.filter(function(p){return p.nom.toLowerCase()===currentEstablishmentId.toLowerCase();});
  }
  // Admin : peut filtrer par établissement spécifique
  if(isAdmin&&_payEstablishmentFilter){
    list=list.filter(function(p){return p.nom.toLowerCase()===_payEstablishmentFilter.toLowerCase();});
  }
  // Filtres statut + recherche
  return list.filter(function(p){
    var matchF=_payFilter==="all"||p.statut===_payFilter;
    var matchS=!_paySearch||p.nom.toLowerCase().indexOf(_paySearch)!==-1||p.id.toLowerCase().indexOf(_paySearch)!==-1;
    return matchF&&matchS;
  });
}

// Charger les paiements depuis Firebase (collection "paiements")
function loadPaiementsFromFirebase(){
  if(!window.db||typeof window.fbCollection!=="function"||typeof window.fbGetDocs!=="function") return;
  var q=window.fbQuery(window.fbCollection(window.db,"paiements"),window.fbOrderBy("id"));
  window.fbGetDocs(q).then(function(snapshot){
    _paiementsFirebase=[];
    snapshot.forEach(function(d){ _paiementsFirebase.push(Object.assign({_docId:d.id},d.data())); });
    rebuildPaiements();
    renderPayments();
    renderStats();
  }).catch(function(){ rebuildPaiements(); renderPayments(); });
}

// ── GPS state — déclaré tôt pour éviter les références avant définition ──
var _gpsState = {
  active: false, lat: null, lng: null, accuracy: null,
  timestamp: null, watchId: null, watching: false,
  radius: 1, sort: "distance", loading: false, error: null, permissionDenied: false
};

/* ── Persistance localStorage du mode GPS ──────────────────────────────────
   Sauvegarde lat/lng/radius/sort/_method pour survivre aux rechargements.
   La position n'est restaurée que si elle date de moins de 10 minutes.      */
function _saveGpsState() {
  try {
    localStorage.setItem('ambi241_gps', JSON.stringify({
      lat: _gpsState.lat, lng: _gpsState.lng,
      accuracy: _gpsState.accuracy, timestamp: _gpsState.timestamp,
      radius: _gpsState.radius, sort: _gpsState.sort,
      _method: _gpsState._method || 'GPS'
    }));
  } catch(e) {}
}
function _clearGpsState() {
  try { localStorage.removeItem('ambi241_gps'); } catch(e) {}
}
/* Restauration au chargement */
(function() {
  try {
    var saved = localStorage.getItem('ambi241_gps');
    if (!saved) return;
    var s = JSON.parse(saved);
    /* Ignorer si position trop vieille (>10 min) ou invalide */
    if (!s.lat || !s.lng) return;
    if (s.timestamp && (Date.now() - s.timestamp) > 600000) { localStorage.removeItem('ambi241_gps'); return; }
    _gpsState.lat       = s.lat;
    _gpsState.lng       = s.lng;
    _gpsState.accuracy  = s.accuracy  || null;
    _gpsState.timestamp = s.timestamp || Date.now();
    _gpsState.radius    = s.radius    || 1;
    _gpsState.sort      = s.sort      || 'distance';
    _gpsState._method   = s._method   || 'GPS';
    _gpsState.active    = true;
    /* Afficher le panneau GPS dès que le DOM est prêt */
    var _showRestoredPanel = function() {
      var panel = document.getElementById('gpsPanel');
      if (panel) panel.classList.add('show');
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', _showRestoredPanel);
    } else {
      setTimeout(_showRestoredPanel, 0);
    }
  } catch(e) {}
})();
// ── Coordonnées approximatives des quartiers de Libreville ──
var QUARTIER_COORDS = {
  "Centre-ville":      [0.3924, 9.4536],
  "Louis":             [0.4140, 9.4320],
  "Batterie IV":       [0.4410, 9.4420],
  "Montagne Sainte":   [0.4080, 9.4390],
  "Akebe":             [0.4270, 9.4470],
  "PK5":               [0.3830, 9.4440],
  "Nombakele":         [0.4480, 9.4590],
  "Sotega":            [0.4360, 9.4650],
  "Awendje":           [0.4300, 9.4740],
  "Glass":             [0.3720, 9.4580],
  "Akanda":            [0.5060, 9.3980],
  "Nzeng-Ayong":       [0.4200, 9.4550],
  "PK8":               [0.3620, 9.4360],
  "PK12":              [0.3410, 9.4190],
  "Owendo":            [0.2940, 9.5020],
  "Alibandeng":        [0.4580, 9.4720],
  "Angondje":          [0.4810, 9.4300],
  "Oloumi":            [0.3690, 9.4340]
};
function haversineKm(lat1,lng1,lat2,lng2){var R=6371;var dLat=(lat2-lat1)*Math.PI/180;var dLng=(lng2-lng1)*Math.PI/180;var a=Math.sin(dLat/2)*Math.sin(dLat/2)+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)*Math.sin(dLng/2);return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));}
function fmtDist(km){if(km<0.1)return Math.round(km*1000)+" m";if(km<1)return Math.round(km*1000)+" m";if(km<10)return km.toFixed(1)+" km";return Math.round(km)+" km";}
function distClass(km){if(km<=0.5)return"dist-close";if(km<=2)return"";return"dist-far";}
function enrichWithDistances(){if(_gpsState.lat===null)return;etablissements.forEach(function(e){var lat=e.lat,lng=e.lng;if(!lat||!lng){var qc=QUARTIER_COORDS[e.quartier];if(qc){lat=qc[0];lng=qc[1];}}if(lat&&lng){e._distKm=haversineKm(_gpsState.lat,_gpsState.lng,lat,lng);}else{e._distKm=null;}});}
function filterByRadius(data){if(!_gpsState.active||_gpsState.lat===null)return data;var r=_gpsState.radius;if(r>=999)return data;return data.filter(function(e){return typeof e._distKm==="number"&&e._distKm<=r;});}
function sortGpsData(data){if(!_gpsState.active)return data;var s=_gpsState.sort;return data.slice().sort(function(a,b){if(s==="distance"){var da=a._distKm!==null?a._distKm:9999;var db=b._distKm!==null?b._distKm:9999;return da-db;}if(s==="affluence")return(b.affluence||0)-(a.affluence||0);if(s==="note")return(b.note||0)-(a.note||0);return 0;});}
function getNearbyCount(){if(_gpsState.lat===null||_gpsState.radius>=999)return etablissements.length;return etablissements.filter(function(e){return e._distKm!==null&&e._distKm<=_gpsState.radius;}).length;}
var CATEGORIES=[
  {key:"Bar",label:"Bar et Lounge",icon:"&#127867;",badge:"cb-bar"},
  {key:"Discotheque",label:"Discotheque et Club",icon:"&#127925;",badge:"cb-club"},
  {key:"Restaurant",label:"Restaurant, Café et Maquis",icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"2.2em\" height=\"1.6em\" style=\"display:inline-block;vertical-align:middle;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>",badge:"cb-resto"},
  {key:"Bar Terrasse",label:"Bar Terrasse et Rooftop",icon:"🌴",badge:"cb-roof"},
  {key:"Snack",label:"Snack-Bar",icon:"🍾",badge:"cb-snack"},
];

function getCategory(type){
  if(!type)return "Bar";
  var t=type.toLowerCase().trim();

  // ── 1. Correspondances exactes (priorité absolue) ──
  var exact={
    "discotheque":"Discotheque","discothèque":"Discotheque","nightclub":"Discotheque","night club":"Discotheque",
    "snack":"Snack","snack-bar":"Snack",
    "bar terrasse":"Bar Terrasse","bar-terrasse":"Bar Terrasse","rooftop":"Bar Terrasse","rooftop bar":"Bar Terrasse",
    "restaurant":"Restaurant","café":"Restaurant","cafe":"Restaurant","brasserie":"Restaurant","pizzeria":"Restaurant",
    "bar":"Bar","lounge":"Bar","bar lounge":"Bar","pub":"Bar","taverne":"Bar",
    "salle":"Salle","salle de spectacle":"Salle","salle de cérémonie":"Salle","salle de ceremonie":"Salle","salle polyvalente":"Salle","centre culturel":"Salle","théâtre":"Salle","cinema":"Salle","cinéma":"Salle","auditorium":"Salle",
    "stade":"Stade","stade de football":"Stade","stade football":"Stade","terrain football":"Stade","complexe sportif":"Stade",
    "tourisme":"Tourisme","site touristique":"Tourisme","parc national":"Tourisme","parc naturel":"Tourisme","réserve":"Tourisme","reserve":"Tourisme","musée":"Tourisme","musee":"Tourisme","monument":"Tourisme","plage":"Tourisme","cascade":"Tourisme"
  };
  if(exact[t])return exact[t];

  // ── 3. Discothèques / Clubs ──
  // "nightclub" ou "club" seul (mais pas "bar lounge club" → vérifier que "bar" N'est PAS le mot dominant)
  if(t.indexOf("disco")!==-1||t.indexOf("nightclub")!==-1||t.indexOf("night club")!==-1)return "Discotheque";
  // "club" seul, seulement si pas accompagné de "bar" ou "snack"
  if(t.indexOf("club")!==-1&&t.indexOf("bar")===-1&&t.indexOf("snack")===-1)return "Discotheque";

  // ── 4. Bar Terrasse / Rooftop (avant Bar et Snack) ──
  if(t.indexOf("terrasse")!==-1||t.indexOf("rooftop")!==-1||t.indexOf("bar terrasse")!==-1||t.indexOf("bar-terrasse")!==-1)return "Bar Terrasse";

  // ── 5. Snack (avant Bar pour éviter "snack-bar" → Bar) ──
  if(t.indexOf("snack")!==-1)return "Snack";

  // ── 6. Restaurants & Cafés (avant Bar pour éviter "bar restaurant" → Bar) ──
  // Si "restaurant" ou "resto" est présent ET "bar" aussi → Restaurant (lieu mixte classé resto)
  if(t.indexOf("restaurant")!==-1||t.indexOf("resto")!==-1||t.indexOf("p\u00e2tisserie")!==-1||t.indexOf("patisserie")!==-1||t.indexOf("brasserie")!==-1||t.indexOf("pizzeria")!==-1||t.indexOf("bistro")!==-1||t.indexOf("caf\u00e9")!==-1||t.indexOf("cafe")!==-1||t.indexOf("maquis")!==-1)return "Restaurant";

  // ── 7. Bars & Lounges ──
  if(t.indexOf("bar")!==-1||t.indexOf("lounge")!==-1||t.indexOf("pub")!==-1||t.indexOf("taverne")!==-1)return "Bar";

  // ── 8. Salles de spectacles & cérémonies ──
  if(t.indexOf("salle")!==-1||t.indexOf("spectacle")!==-1||t.indexOf("c\u00e9r\u00e9monie")!==-1||t.indexOf("ceremonie")!==-1||t.indexOf("th\u00e9\u00e2tre")!==-1||t.indexOf("cin\u00e9ma")!==-1||t.indexOf("auditorium")!==-1||t.indexOf("culturel")!==-1)return "Salle";

  // ── 9. Stades de Football ──
  if(t.indexOf("stade")!==-1||t.indexOf("terrain")!==-1||t.indexOf("complexe sportif")!==-1||t.indexOf("foot")!==-1)return "Stade";

  // ── 10. Sites touristiques & Parcs nationaux ──
  if(t.indexOf("touristique")!==-1||t.indexOf("parc")!==-1||t.indexOf("r\u00e9serve")!==-1||t.indexOf("reserve")!==-1||t.indexOf("mus\u00e9e")!==-1||t.indexOf("monument")!==-1||t.indexOf("plage")!==-1||t.indexOf("cascade")!==-1)return "Tourisme";

  // ── 11. Fallback ──
  return "Bar";
}
function getCatInfo(key){
  for(var i=0;i<CATEGORIES.length;i++){if(CATEGORIES[i].key===key)return CATEGORIES[i];}
  return CATEGORIES[0];
}

/* ── Icône spécifique au sous-type pour les badges dans les cartes liste ──
   Restos  : 🎂 pour pâtisseries, SVG fourchette/assiette pour restos
   Autres  : fallback sur getCatInfo standard
*/
function getCatInfoForEtab(e){
  var base = getCatInfo(getCategory(e.type));
  var t = (e.type||'').toLowerCase().trim();

  // ── Pâtisserie vs Restaurant ──
  if(base.key === 'Restaurant'){
    var isPat = t.indexOf('p\u00e2tisserie') !== -1 || t.indexOf('patisserie') !== -1 || t.indexOf('pastry') !== -1;
    if(isPat){
      return {
        key:'Restaurant', badge:'cb-resto',
        label:'Pâtisserie',
        icon:'<span style="font-size:1.15em;vertical-align:middle;">🎂</span>'
      };
    }
  }

  return base;
}

// CLOCK
function updateClock(){
  var now=new Date();
  var h=String(now.getHours()).padStart(2,"0");
  var m=String(now.getMinutes()).padStart(2,"0");
  var s=String(now.getSeconds()).padStart(2,"0");
  var el=document.getElementById("heroClock");
  if(el) el.innerHTML = h + '<span class="hc-colon">:</span>' + m + '<span class="hc-colon">:</span>' + s;
  var days=["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
  var months=["Jan","Fév","Mars","Avr","Mai","Juin","Juil","Août","Sep","Oct","Nov","Déc"];
  var d2=document.getElementById("heroDate");
  var dateStr = days[now.getDay()]+". "+now.getDate()+" "+months[now.getMonth()]+" "+now.getFullYear();
  if(d2) d2.textContent=dateStr;
  var d3=document.getElementById("heroDateInline");
  if(d3) d3.textContent=dateStr;
}
setInterval(updateClock,1000);
updateClock();

// TRAFFIC
function trackVisit(){
  var today=new Date().toDateString();
  var stored=lsGetJSON(VISIT_KEY, {});
  if(!stored.date)stored={date:"",count:0,total:0};
  if(stored.date!==today){stored={date:today,count:1,total:(stored.total||0)+1};}
  else{stored.count+=1;}
  lsSetJSON(VISIT_KEY, stored);
}
function getTraffic(){
  var stored=lsGetJSON(VISIT_KEY, {});
  if(!stored.date)return {date:"",count:0,total:0};
  return stored;
}
trackVisit();

// SOIREE PHOTOS — Firebase-first avec fallback localStorage
var _soireePhotosCache = { lastTs: 0, cached: false, timeoutId: null };
function loadSoireePhotos(){
  var now = Date.now();
  // ✅ Ne requêter Firebase que si dernière requête > 5s (debounce)
  if (_soireePhotosCache.cached && (now - _soireePhotosCache.lastTs < 5000)) {
    return; // garder le cache en mémoire — pas refaire la requête
  }
  
  // Chargement synchrone depuis localStorage (cache rapide)
  var stored=lsGetJSON("ambi241_soiree", {});
  soireePhotos=stored;
  
  // Mise à jour async depuis Firebase si dispo (avec debounce)
  if(window.db && window.fbGetDocs && window.fbCollection){
    clearTimeout(_soireePhotosCache.timeoutId);
    _soireePhotosCache.timeoutId = setTimeout(function(){
      window.fbGetDocs(window.fbCollection(window.db, "soireePhotos")).then(function(snap){
        var fbData = {};
        snap.forEach(function(d){
          var eid = d.id;
          fbData[eid] = d.data().photos || [];
        });
        // Fusionner avec localStorage (Firebase a priorité)
        soireePhotos = Object.assign({}, stored, fbData);
        try{ lsSetJSON("ambi241_soiree", soireePhotos); }catch(e){}
        _soireePhotosCache.cached = true;
        _soireePhotosCache.lastTs = now;
      }).catch(function(){
        _soireePhotosCache.cached = true;
        _soireePhotosCache.lastTs = now;
      });
    }, 50); // attendre 50ms de calme avant requêter
  } else {
    _soireePhotosCache.cached = true;
    _soireePhotosCache.lastTs = now;
  }
}
function saveSoireePhoto(eid, dataUrl){
  var eidStr = String(eid);
  var stored = lsGetJSON("ambi241_soiree", {});
  if(!stored[eidStr]) stored[eidStr]=[];
  var newEntry = {url:dataUrl, ts:Date.now(), addedBy: window.currentUserUID||"inconnu"};
  stored[eidStr].push(newEntry);
  try{ lsSetJSON("ambi241_soiree", stored); }catch(e){}
  soireePhotos = stored;
  // Persister dans Firebase Firestore
  if(window.db && window.fbSetDoc && window.fbDoc){
    window.fbSetDoc(window.fbDoc(window.db, "soireePhotos", eidStr),
      { photos: stored[eidStr], updatedAt: Date.now() }, { merge: true }
    ).catch(function(){});
  }
}
function getTimeLeft(ts){
  var left=SLOT_EXPIRE_MS-(Date.now()-ts);
  if(left<=0)return"Expiree";
  var h=Math.floor(left/3600000);
  var m=Math.floor((left%3600000)/60000);
  return h+"h"+String(m).padStart(2,"0");
}
loadSoireePhotos();
restorePhotosPersistence(); // ✅ Une seule fois au démarrage (pas à chaque render)
// ✅ Précharger les photos slot Firebase pour tous les établissements en cache
if(typeof etablissements !== 'undefined' && etablissements.length){
  etablissements.forEach(function(e){ if(e.id) loadSlotPhotosAsync(e.id); });
}

// ── FIREBASE — Lecture et mise à jour des établissements ──────

// ══════════════════════════════════════════════════════════════
// ══  MOTEUR DYNAMIQUE — Score de classement pondéré         ══
// ══════════════════════════════════════════════════════════════

var _rankWeights = {
  affluence: 30,   // % — total = 100
  note:       30,
  avis:       20,
  presences:  10,
  votes:      10
};

var _rankSort = { col: "score", asc: false };

var RANK_WEIGHTS_KEY = "ambi241_rank_weights";

function loadRankWeights(){
  var saved = lsGetJSON(RANK_WEIGHTS_KEY, null);
  if(saved && typeof saved === "object"){
    Object.keys(_rankWeights).forEach(function(k){ if(saved[k]!==undefined) _rankWeights[k]=saved[k]; });
  }
}

function saveRankWeights(){
  lsSetJSON(RANK_WEIGHTS_KEY, _rankWeights);
}

/* Calcule un score global 0-100 pour un établissement */
function computeRankScore(e){
  var w = _rankWeights;
  var pd = getPresenceData(e.id) || { count: 0, list: [] };
  var vd = getVoteData(e.id) || { pos: 0, neg: 0 };

  // Affluence : déjà 0-100
  var sAff = Math.min(100, Math.max(0, e.affluence || 0));
  // Note : 0-5 → 0-100
  var sNote = Math.min(100, Math.max(0, ((e.note || 0) / 5) * 100));
  // Avis : log scale (0 avis → 0, 1000+ → 100)
  var sAvis = Math.min(100, Math.round(Math.log10(Math.max(1, e.avis || 0) + 1) / Math.log10(1001) * 100));
  // Présences : 0-20+ → 0-100 (cap 20)
  var sPresences = Math.min(100, Math.round((pd.count / 20) * 100));
  // Votes nets : ratio positif
  var totalVotes = vd.pos + vd.neg;
  var sVotes = totalVotes > 0 ? Math.round((vd.pos / totalVotes) * 100) : 50;

  var total = (w.affluence/100)*sAff + (w.note/100)*sNote + (w.avis/100)*sAvis + (w.presences/100)*sPresences + (w.votes/100)*sVotes;
  // Normaliser si poids total != 100
  var wSum = w.affluence + w.note + w.avis + w.presences + w.votes;
  if(wSum > 0) total = total / (wSum/100);

  return {
    score:     Math.round(total),
    affluence: Math.round(sAff),
    note:      Math.round(sNote),
    avis:      Math.round(sAvis),
    presences: Math.round(sPresences),
    votes:     Math.round(sVotes)
  };
}

/* Applique un statut dynamique basé sur l'affluence réelle (sans écraser les overrides admin) */
function applyDynamicStatus(e){
  if(e._adminOverride) return; // l'admin a fixé manuellement → respecter
  var pd = getPresenceData(e.id) || { count: 0, list: [] };
  var vd = getVoteData(e.id) || { pos: 0, neg: 0 };
  var realAff = computeRealAffluence(e, pd, vd);
  if(realAff >= 75) e.statut = "Ouvert - Bonde";
  else if(realAff >= 40) e.statut = "Ouvert - Anime";
  else e.statut = "Ouvert - Calme";
}

// ── Tableau de bord classement admin ──────────────────────────
function renderAdmClassement(){
  loadRankWeights();
  var container = document.getElementById("adminClassementContent");
  if(!container) return;

  var w = _rankWeights;
  var wSum = w.affluence + w.note + w.avis + w.presences + w.votes;

  // Build scored list
  var scored = etablissements.map(function(e){
    var res = computeRankScore(e);
    return Object.assign({}, e, { _rank: res });
  });
  // Sort
  scored.sort(function(a,b){
    var col = _rankSort.col;
    var va = col==="score" ? a._rank.score : (col==="nom" ? a.nom : (a._rank[col]!==undefined ? a._rank[col] : (a[col]||0)));
    var vb = col==="score" ? b._rank.score : (col==="nom" ? b.nom : (b._rank[col]!==undefined ? b._rank[col] : (b[col]||0)));
    if(typeof va==="string") return _rankSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    return _rankSort.asc ? va - vb : vb - va;
  });

  var html = "";

  /* ── Détection pré-lancement : si tous les établissements ont note=0 ET avis=0 ET affluence=0 ── */
  var hasRealData = etablissements.some(function(e){
    var pd = getPresenceData(e.id) || { count: 0 };
    var vd = getVoteData(e.id) || { pos: 0, neg: 0 };
    return (e.note > 0) || (e.avis > 0) || (e.affluence > 0) || (pd.count > 0) || (vd.pos + vd.neg > 0);
  });

  if(!hasRealData) {
    html += "<div style='background:rgba(255,215,0,0.07);border:1.5px solid rgba(255,215,0,0.35);border-radius:14px;padding:1.1rem;margin-bottom:1.2rem;'>";
    html += "<div style='display:flex;align-items:flex-start;gap:0.6rem;'>";
    html += "<span style='font-size:1.5rem;flex-shrink:0;'>🚀</span>";
    html += "<div>";
    html += "<div style='font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.85rem;margin-bottom:0.3rem;'>Pré-lancement — Aucune donnée réelle collectée</div>";
    html += "<div style='font-size:0.72rem;color:var(--muted);line-height:1.6;'>";
    html += "Le classement sera <strong style='color:var(--text);'>100% dynamique</strong> dès le premier utilisateur actif. "
          + "Pour l'instant, tous les scores sont à zéro. Le classement s'activera automatiquement avec :<br>"
          + "<span style='color:var(--green);'>• Les votes utilisateurs (👍/👎)</span><br>"
          + "<span style='color:var(--cyan);'>• Les présences signalées</span><br>"
          + "<span style='color:var(--pink);'>• Les notes et avis laissés</span><br>"
          + "<span style='color:var(--amber);'>• L\'affluence actualisée par les gérants</span>";
    html += "</div></div></div></div>";
  }

  // ── Titre ──
  html += "<div style='font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.95rem;margin-bottom:1rem;'>🏆 Classement Dynamique</div>";

  // ── Éditeur de poids ──
  html += "<div style='background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:14px;padding:1rem;margin-bottom:1.2rem;'>";
  html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:0.7rem;'>";
  html += "<span style='font-family:Syne,sans-serif;font-weight:700;font-size:0.8rem;color:var(--amber);'>⚖️ Pondération des critères</span>";
  html += "<span style='font-size:0.68rem;color:"+(wSum===100?"var(--green)":"var(--red)")+";font-weight:700;'>Total: "+wSum+"%</span>";
  html += "</div>";
  var criteria = [
    {key:"affluence", label:"Affluence", color:"var(--red)"},
    {key:"note",      label:"Note ★",   color:"var(--amber)"},
    {key:"avis",      label:"Avis",      color:"var(--cyan)"},
    {key:"presences", label:"Présences", color:"var(--green)"},
    {key:"votes",     label:"Votes",     color:"var(--purple)"}
  ];
  criteria.forEach(function(c){
    html += "<div style='display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;'>";
    html += "<span style='font-size:0.75rem;color:var(--text);width:80px;flex-shrink:0;'>"+c.label+"</span>";
    html += "<input type='range' min='0' max='100' value='"+w[c.key]+"' step='5' style='flex:1;accent-color:"+c.color+";' oninput=\""
      + "var newVal=parseInt(this.value);"
      + "var others=Object.keys(_rankWeights).filter(function(k){return k!=='"+c.key+"';});"
      + "var sumOthers=others.reduce(function(s,k){return s+_rankWeights[k];},0);"
      + "if(newVal+sumOthers>100){newVal=Math.max(0,100-sumOthers);this.value=newVal;}"
      + "_rankWeights['"+c.key+"']=newVal;"
      + "saveRankWeights();renderAdmClassement();\">";
    html += "<span style='font-size:0.78rem;font-weight:800;color:"+c.color+";width:32px;text-align:right;'>"+w[c.key]+"%</span>";
    html += "</div>";
  });
  html += "<div style='display:flex;gap:0.5rem;margin-top:0.6rem;'>";
  html += "<button onclick=\"_rankWeights={affluence:30,note:30,avis:20,presences:10,votes:10};saveRankWeights();renderAdmClassement();\" style='flex:1;padding:0.4rem;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--muted);font-family:DM Sans,sans-serif;font-size:0.72rem;cursor:pointer;'>↺ Réinitialiser (100%)</button>";
  html += "<button onclick='renderAdmClassement()' style='flex:1;padding:0.4rem;border-radius:8px;border:1px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.08);color:var(--green);font-family:Syne,sans-serif;font-weight:700;font-size:0.72rem;cursor:pointer;'>↻ Actualiser</button>";
  html += "</div></div>";

  // ── Bouton Nouveau Cycle ──
  var cycleStartTs = parseInt(localStorage.getItem("ambi241_cycle_start")||"0");
  var cycleInfo = cycleStartTs > 0
    ? "Cycle en cours depuis le " + new Date(cycleStartTs).toLocaleDateString("fr-FR", {day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})
    : "Aucun cycle enregistré";
  html += "<div style='background:rgba(255,68,102,0.06);border:1.5px solid rgba(255,68,102,0.28);border-radius:14px;padding:1rem;margin-bottom:1.2rem;'>";
  html += "<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;'>";
  html += "<span style='font-size:1.1rem;'>🔄</span>";
  html += "<span style='font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;color:var(--red);'>Nouveau cycle de classement</span>";
  html += "</div>";
  html += "<div style='font-size:0.72rem;color:var(--muted);margin-bottom:0.75rem;line-height:1.5;'>";
  html += "Remet à zéro les <strong style='color:var(--text);'>présences</strong> et les <strong style='color:var(--text);'>votes</strong> de tous les établissements pour repartir d'une collecte vierge.<br>";
  html += "<span style='color:rgba(255,255,255,0.35);font-size:0.65rem;'>Les données fixes (nom, note, avis, photos…) restent intactes.</span>";
  html += "</div>";
  html += "<div style='font-size:0.65rem;color:rgba(255,255,255,0.3);margin-bottom:0.65rem;'>📅 " + cycleInfo + "</div>";
  html += "<button onclick='resetCycleClassement()' style='width:100%;padding:0.65rem 1rem;border-radius:10px;border:1.5px solid rgba(255,68,102,0.55);background:rgba(255,68,102,0.12);color:var(--red);font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.4rem;transition:all 0.2s;' onmouseover=\"this.style.background='rgba(255,68,102,0.22)'\" onmouseout=\"this.style.background='rgba(255,68,102,0.12)'\">⚡ Démarrer un nouveau cycle</button>";
  html += "</div>";

  // ── Table triable ──
  function sortBtn(col, label){
    var active = _rankSort.col === col;
    var arrow = active ? (_rankSort.asc ? " ↑" : " ↓") : "";
    return "<button onclick=\"_rankSort={col:'"+col+"',asc:"+(!active?false:!_rankSort.asc)+"};renderAdmClassement();\" style='background:"+(active?"rgba(255,215,0,0.15)":"rgba(255,255,255,0.04)")+";border:1px solid "+(active?"rgba(255,215,0,0.4)":"rgba(255,255,255,0.08)")+";color:"+(active?"var(--amber)":"var(--muted)")+";font-size:0.6rem;font-weight:700;padding:0.18rem 0.45rem;border-radius:5px;cursor:pointer;font-family:DM Sans,sans-serif;'>"+label+arrow+"</button>";
  }

  html += "<div style='display:flex;flex-wrap:wrap;gap:0.3rem;margin-bottom:0.7rem;align-items:center;'>";
  html += "<span style='font-size:0.65rem;color:var(--muted);margin-right:0.2rem;'>Trier :</span>";
  html += sortBtn("score","Score");
  html += sortBtn("nom","Nom");
  html += sortBtn("affluence","Affluence");
  html += sortBtn("note","Note");
  html += sortBtn("avis","Avis");
  html += sortBtn("presences","Présences");
  html += sortBtn("votes","Votes");
  html += "</div>";

  // Medals
  var medals = ["🥇","🥈","🥉"];

  scored.forEach(function(e, idx){
    var r = e._rank;
    var medal = medals[idx] || "#"+(idx+1);
    var isOverride = !!e._adminOverride;
    var rankClass = idx===0 ? "rgba(255,215,0,0.1)" : idx===1 ? "rgba(192,192,192,0.07)" : idx===2 ? "rgba(205,127,50,0.07)" : "rgba(255,255,255,0.02)";
    var borderClass = idx===0 ? "rgba(255,215,0,0.3)" : idx===1 ? "rgba(192,192,192,0.2)" : idx===2 ? "rgba(205,127,50,0.2)" : "rgba(255,255,255,0.06)";

    html += "<div style='background:"+rankClass+";border:1px solid "+borderClass+";border-radius:14px;padding:0.8rem;margin-bottom:0.55rem;'>";

    // Row 1: medal + name + score
    html += "<div style='display:flex;align-items:center;gap:0.55rem;margin-bottom:0.5rem;'>";
    html += "<span style='font-size:1.1rem;width:24px;text-align:center;flex-shrink:0;'>"+medal+"</span>";
    html += "<div style='flex:1;min-width:0;'>";
    html += "<div style='font-weight:700;font-size:0.85rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+e.nom+(isOverride?" <span style='font-size:0.58rem;background:rgba(255,215,0,0.15);border:1px solid rgba(255,215,0,0.4);color:var(--amber);border-radius:4px;padding:0.06rem 0.3rem;'>✏️ Override</span>":"")+"</div>";
    html += "<div style='font-size:0.62rem;color:var(--muted);'>"+e.type+" · "+e.quartier+"</div>";
    html += "</div>";
    html += "<div style='text-align:right;flex-shrink:0;'>";
    html += "<div style='font-family:Syne,sans-serif;font-weight:800;font-size:1.1rem;color:"+(r.score>=70?"var(--green)":r.score>=40?"var(--amber)":"var(--red)")+";'>"+r.score+"</div>";
    html += "<div style='font-size:0.6rem;color:var(--muted);'>/ 100</div>";
    html += "</div></div>";

    // Score bar
    html += "<div style='background:rgba(255,255,255,0.05);border-radius:100px;height:5px;margin-bottom:0.55rem;overflow:hidden;'>";
    html += "<div style='height:100%;width:"+r.score+"%;background:linear-gradient(90deg,"+(r.score>=70?"var(--green)":r.score>=40?"var(--amber)":"var(--red)")+",transparent);border-radius:100px;transition:width 0.6s;'></div></div>";

    // Détail critères
    html += "<div style='display:grid;grid-template-columns:repeat(5,1fr);gap:0.3rem;margin-bottom:0.5rem;'>";
    [
      {k:"affluence",l:"Afflux",c:"var(--red)",   raw: Math.round(e.affluence||0),         unit:"%"},
      {k:"note",     l:"Note",  c:"var(--amber)",  raw: (e.note||0).toFixed(1),             unit:"/5"},
      {k:"avis",     l:"Avis",  c:"var(--cyan)",   raw: e.avis||0,                          unit:""},
      {k:"presences",l:"Prés.", c:"var(--green)",  raw: (getPresenceData(e.id)||{count:0}).count, unit:""},
      {k:"votes",    l:"Votes", c:"var(--purple)",  raw: (function(){ var vd=getVoteData(e.id)||{pos:0,neg:0}; return vd.pos+"/"+( vd.pos+vd.neg); })(), unit:""}
    ].forEach(function(cr){
      html += "<div style='text-align:center;background:rgba(255,255,255,0.03);border-radius:8px;padding:0.3rem 0.1rem;'>";
      html += "<div style='font-size:0.72rem;font-weight:800;color:"+cr.c+";'>"+cr.raw+"<span style='font-size:0.5rem;opacity:0.7;'>"+cr.unit+"</span></div>";
      html += "<div style='font-size:0.55rem;color:var(--muted);'>"+cr.l+"</div>";
      html += "</div>";
    });
    html += "</div>";

    // Admin actions row
    html += "<div style='display:flex;gap:0.3rem;flex-wrap:wrap;align-items:center;'>";
    var statusOpts = ["Ouvert - Anime","Ouvert - Bonde","Ouvert - Calme","Ferme"];
    statusOpts.forEach(function(s){
      var isActive = e.statut === s;
      html += "<button onclick=\"updateField("+e.id+",{statut:'"+s+"',_adminOverride:true});\" style='font-size:0.58rem;padding:0.18rem 0.42rem;border-radius:5px;cursor:pointer;border:1px solid "+(isActive?"rgba(255,45,155,0.5)":"rgba(255,255,255,0.1)")+";background:"+(isActive?"rgba(255,45,155,0.18)":"transparent")+";color:"+(isActive?"var(--pink)":"var(--muted)")+";font-family:DM Sans,sans-serif;'>"+s.replace("Ouvert - ","")+"</button>";
    });
    if(isOverride){
      html += "<button onclick=\"updateField("+e.id+",{_adminOverride:false});\" style='font-size:0.58rem;padding:0.18rem 0.42rem;border-radius:5px;cursor:pointer;border:1px solid rgba(0,229,255,0.35);background:rgba(0,229,255,0.08);color:var(--cyan);font-family:DM Sans,sans-serif;margin-left:auto;'>↺ Libérer</button>";
    }
    html += "</div></div>";
  });

  container.innerHTML = html;
}

window.renderAdmClassement = renderAdmClassement;

// ══════════════════════════════════════════════════════════════
// ══  RÉINITIALISATION DU CYCLE DE CLASSEMENT               ══
// ══════════════════════════════════════════════════════════════
// Efface UNIQUEMENT les données de participation au classement :
// présences, votes, cooldowns de présence.
// Les données fixes (nom, type, quartier, note, avis, photos…)
// ne sont PAS touchées.
function resetCycleClassement(){
  var confirmMsg =
    "⚡ NOUVEAU CYCLE AMBI241\n\n" +
    "Ce reset va remettre à zéro :\n" +
    "  • Affluence (signalements de présence)\n" +
    "  • Avis & notes AMBI241 (votes internes)\n" +
    "  • Votes communautaires 👍 / 👎\n" +
    "  • Présences enregistrées\n" +
    "  • Cooldowns individuels\n\n" +
    "Ce qui est CONSERVÉ :\n" +
    "  • Notes officielles Google Maps / Étoiles hôtels\n" +
    "  • Noms, photos, coordonnées\n\n" +
    "Confirmer ?";

  if(!confirm(confirmMsg)) return;

  try {
    // 1. Vider présences & votes localStorage
    try { localStorage.removeItem("ambi241_all_presence"); } catch(e){}
    try { localStorage.removeItem("ambi241_all_votes"); } catch(e){}

    // 2. Cooldowns et clés cycle
    var keysToDelete = [];
    for(var i = 0; i < localStorage.length; i++){
      var k = localStorage.key(i);
      if(!k) continue;
      if(k.indexOf("ambi241_lastpres_") === 0 ||
         k.indexOf("ambi241_vcd_") === 0 ||
         k.indexOf("ambi241_anon_presence_") === 0 ||
         k.indexOf("ambi241_etab_aff_") === 0){
        keysToDelete.push(k);
      }
    }
    keysToDelete.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });

    // 3. SessionStorage anonymes
    var ssKeys = [];
    for(var j = 0; j < sessionStorage.length; j++){
      var sk = sessionStorage.key(j);
      if(!sk) continue;
      if(sk.indexOf("ambi241_anon_presence_") === 0) ssKeys.push(sk);
    }
    ssKeys.forEach(function(k){ try{ sessionStorage.removeItem(k); }catch(e){} });

    // 4. Réinitialiser les caches live en mémoire
    if(window._livePresences) window._livePresences = {};
    if(window._liveVotes)     window._liveVotes     = {};

    // 5. Remettre affluence=0 et avis AMBI241=0 sur chaque étab en mémoire
    //    MAIS conserver note officielle Google (_officialNote) si elle existe
    if(typeof etablissements !== "undefined" && etablissements){
      etablissements.forEach(function(e){
        e.affluence = 0;
        // Conserver la note Google officielle si disponible
        if(!e._officialNote && e.note > 0 && e.place_id) {
          e._officialNote = e.note; // sauvegarder avant reset
        }
        // Remettre avis AMBI241 à 0, garder _officialNote intacte
        e.avis = 0;
        // Note : on garde e.note si c'est une note Google reconnue
        if(e._voteData) e._voteData = { pos:0, neg:0 };
        // Lever l'override admin pour que le statut dynamique reprenne le dessus
        e._adminOverride = false;
        e.statut = "Fermé";
      });
    }

    // 6. Firebase : effacer presences, votes_communautaires, affluence_signalements
    //    ET persister affluence=0 / avis=0 dans chaque doc etablissements/{docId}
    if(window.db && window.fbCollection && window.fbGetDocs && window.fbDeleteDoc){
      ["presences","votes_communautaires","affluence_signalements"].forEach(function(col){
        try{
          window.fbGetDocs(window.fbCollection(window.db, col)).then(function(snap){
            snap.forEach(function(d){ window.fbDeleteDoc(d.ref).catch(function(){}); });
          }).catch(function(){});
        }catch(e){}
      });
      // Effacer sous-collections presences + votes par étab ET remettre à zéro dans le doc principal
      if(typeof etablissements !== "undefined" && window.fbUpdateDoc && window.fbDoc){
        etablissements.forEach(function(etab){
          var eidStr = String(etab.id);
          // Sous-collection presences
          try{
            var presRef = window.fbCollection(window.db, "etablissements", eidStr, "presences");
            window.fbGetDocs(presRef).then(function(snap){
              snap.forEach(function(d){ window.fbDeleteDoc(d.ref).catch(function(){}); });
            }).catch(function(){});
          }catch(e){}
          // Sous-collection votes
          try{
            var voteRef = window.fbCollection(window.db, "etablissements", eidStr, "votes");
            window.fbGetDocs(voteRef).then(function(snap){
              snap.forEach(function(d){ window.fbDeleteDoc(d.ref).catch(function(){}); });
            }).catch(function(){});
          }catch(e){}
          // Sous-collection ratings (avis notés)
          try{
            var rateRef = window.fbCollection(window.db, "etablissements", eidStr, "ratings");
            window.fbGetDocs(rateRef).then(function(snap){
              snap.forEach(function(d){ window.fbDeleteDoc(d.ref).catch(function(){}); });
            }).catch(function(){});
          }catch(e){}
          // ★ CORRECTION PRINCIPALE : persister affluence=0, avis=0 dans le document Firestore
          //   pour éviter que loadData() ne restaure les anciennes valeurs après redémarrage
          if(etab._docId){
            try{
              window.fbUpdateDoc(
                window.fbDoc(window.db, "etablissements", etab._docId),
                { affluence: 0, avis: 0, _adminOverride: false }
              ).catch(function(){});
            }catch(e){}
          }
        });
      }
    }

    // 7. Cycle timestamp + tri
    try{ localStorage.setItem("ambi241_cycle_start", String(Date.now())); }catch(e){}
    try{ localStorage.setItem("ambi241_cycle_reset_count",
      String(parseInt(localStorage.getItem("ambi241_cycle_reset_count")||"0")+1)); }catch(e){}
    if(typeof _rankSort !== "undefined"){ _rankSort = { col: "score", asc: false }; }

    // 8. Rafraîchir affichage
    showToast("🔄 Nouveau cycle démarré — Afflux, Avis, Votes remis à zéro !");
    setTimeout(function(){
      if(typeof renderAll === "function") renderAll();
      if(typeof renderAdmClassement === "function") renderAdmClassement();
    }, 400);

  } catch(err) {
    showToast("❌ Erreur : " + err.message);
    console.error("resetCycleClassement error:", err);
  }
}
window.resetCycleClassement = resetCycleClassement;

// Charger les poids au démarrage
(function(){ loadRankWeights(); })();

function getDefaults(){
  /* IMPORTANT : Les données réelles sont dans Firebase (1028+ lieux).
     Retourne [] pour ne jamais afficher les anciennes 65 entrées statiques.
     Si Firebase est indisponible, l'app affichera un tableau vide. */
  return [];
}
function _getDefaultsLegacy_DISABLED(){
  return [
    // Établissements réels vérifiés via Google Places (place_id + coordonnées GPS)
    {id:9,nom:"Yoka_Lounge",type:"Discotheque",quartier:"Centre-ville",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 77 46 11 46",paiement:"En attente",affluence:0,lat:0.4399067,lng:9.4178608,place_id:"ChIJdX05QME7fxAR2Pvl8RHwxhM",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJdX05QME7fxAR2Pvl8RHwxhM",photo_interieur:"",photo_exterieur:""},
    {id:10,nom:"No Stress",type:"Bar",quartier:"Louis",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 66 26 66 94",paiement:"En attente",affluence:0,lat:0.4062708,lng:9.4330562,place_id:"ChIJR8fPZg47fxARj_2tJJo_ZEI",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJR8fPZg47fxARj_2tJJo_ZEI",photo_interieur:"",photo_exterieur:""},
    {id:11,nom:"HYPE BAR LOUNGE",type:"Bar Lounge",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.3970804,lng:9.4450048,place_id:"ChIJ5cGvApA7fxAR0ivmZjTaBps",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJ5cGvApA7fxAR0ivmZjTaBps",photo_interieur:"",photo_exterieur:""},
    {id:12,nom:"IBIZA NIGHTCLUB",type:"Discotheque",quartier:"Awendje",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 66 06 08 94",paiement:"En attente",affluence:0,lat:0.4304241,lng:9.4741436,place_id:"ChIJbe9wK8Q9fxARn7pfCKr8u_4",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJbe9wK8Q9fxARn7pfCKr8u_4",photo_interieur:"",photo_exterieur:""},
    {id:13,nom:"Insomnia",type:"Discotheque",quartier:"Louis",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 66 29 89 41",paiement:"En attente",affluence:0,lat:0.4097084,lng:9.4317941,place_id:"ChIJw01_DQs7fxARkcOP8RNoPbk",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJw01_DQs7fxARkcOP8RNoPbk",photo_interieur:"",photo_exterieur:""},
    {id:14,nom:"The Spot",type:"Bar",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 66 49 31 88",paiement:"En attente",affluence:0,lat:0.41765,lng:9.46948,place_id:"ChIJTWOdc549fxAR3cja4Xt39BM",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJTWOdc549fxAR3cja4Xt39BM",photo_interieur:"",photo_exterieur:""},
    {id:15,nom:"LIroko",type:"Bar Lounge",quartier:"Glass",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 74 51 84 57",paiement:"En attente",affluence:0,lat:0.3693162,lng:9.4570184,place_id:"ChIJIYbaaJ8_fxARpezZORim6j8",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJIYbaaJ8_fxARpezZORim6j8",photo_interieur:"",photo_exterieur:""},
    {id:16,nom:"Le Stone",type:"Bar Lounge",quartier:"Akanda",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 66 12 39 56",paiement:"En attente",affluence:0,lat:0.5093725,lng:9.4057482,place_id:"ChIJEZY8nIElfxAR_N7fhQ91vd0",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJEZY8nIElfxAR_N7fhQ91vd0",photo_interieur:"",photo_exterieur:""},
    {id:17,nom:"The Black Moon",type:"Discotheque",quartier:"Akanda",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 74 01 57 57",paiement:"En attente",affluence:0,lat:0.504208,lng:9.392055,place_id:"ChIJX6CeljklfxARsIUQ8oAAhJY",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJX6CeljklfxARsIUQ8oAAhJY",photo_interieur:"",photo_exterieur:""},
    {id:18,nom:"New Sunset Lounge Bar",type:"Discotheque",quartier:"Louis",ambiance:"Anime",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.4073798,lng:9.4318995,place_id:"ChIJM4PQrzk7fxARdEpzXhhKc2w",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJM4PQrzk7fxARdEpzXhhKc2w",photo_interieur:"",photo_exterieur:""},
    {id:19,nom:"Chez Dede",type:"Restaurant",quartier:"Centre-ville",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 62 12 58 00",paiement:"En attente",affluence:0,lat:0.4430902,lng:9.4240407,place_id:"ChIJ59RZctElfxAROG3gBalmhP0",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJ59RZctElfxAROG3gBalmhP0",photo_interieur:"",photo_exterieur:""},
    {id:20,nom:"La Voile Rouge",type:"Restaurant",quartier:"Louis",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 11 44 87 92",paiement:"En attente",affluence:0,lat:0.4257589,lng:9.4212315,place_id:"ChIJpYXkniI7fxARDtu78sQ_za4",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJpYXkniI7fxARDtu78sQ_za4",photo_interieur:"",photo_exterieur:""},
    {id:21,nom:"LOdika",type:"Restaurant",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 11 73 69 20",paiement:"En attente",affluence:0,lat:0.4127673,lng:9.4327373,place_id:"ChIJd3pt8go7fxARWFx8G63ZfnM",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJd3pt8go7fxARWFx8G63ZfnM",photo_interieur:"",photo_exterieur:""},
    {id:22,nom:"BANTU Restaurant Bar Pizzeria",type:"Bar Lounge",quartier:"Glass",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 74 14 49 49",paiement:"En attente",affluence:0,lat:0.3724932,lng:9.4582871,place_id:"ChIJNxAD-1E9fxARNsWfk-8ynNo",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJNxAD-1E9fxARNsWfk-8ynNo",photo_interieur:"",photo_exterieur:""},
    {id:23,nom:"Eat Vite Bord de Mer",type:"Restaurant",quartier:"Centre-ville",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 60 11 00 12",paiement:"En attente",affluence:0,lat:0.4339904,lng:9.4179514,place_id:"ChIJkQLXZJg7fxARYnTfMjmtHcU",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJkQLXZJg7fxARYnTfMjmtHcU",photo_interieur:"",photo_exterieur:""},
    {id:24,nom:"La Braise",type:"Bar Restaurant",quartier:"Louis",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 74 73 83 42",paiement:"En attente",affluence:0,lat:0.4036185,lng:9.4317285,place_id:"ChIJb0XI6MU7fxARG9sJgPJ9wuk",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJb0XI6MU7fxARG9sJgPJ9wuk",photo_interieur:"",photo_exterieur:""},
    {id:25,nom:"Roma Restaurant & Hotel",type:"Bar Restaurant",quartier:"Louis",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 74 44 98 64",paiement:"En attente",affluence:0,lat:0.4104582,lng:9.4307524,place_id:"ChIJ7ejDdqA7fxARFpD3K1c7dEY",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJ7ejDdqA7fxARFpD3K1c7dEY",photo_interieur:"",photo_exterieur:""},
    {id:26,nom:"Lamaia Lounge Bar & Restaurant",type:"Bar Lounge",quartier:"Louis",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 65 05 03 03",paiement:"En attente",affluence:0,lat:0.4126282,lng:9.432139,place_id:"ChIJF2DZGas7fxARZ5wgrpMJQFg",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJF2DZGas7fxARZ5wgrpMJQFg",photo_interieur:"",photo_exterieur:""},
    {id:27,nom:"AKWABA Lounge",type:"Bar Lounge",quartier:"Glass",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 65 10 31 31",paiement:"En attente",affluence:0,lat:0.3777398,lng:9.4560024,place_id:"ChIJeVSBAXw7fxARJUTlrxTB2fM",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJeVSBAXw7fxARJUTlrxTB2fM",photo_interieur:"",photo_exterieur:""},
    {id:28,nom:"Abuja Snack Bar",type:"Snack-Bar",quartier:"Awendje",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 77 38 77 50",paiement:"En attente",affluence:0,lat:0.3868435,lng:9.4734055,place_id:"ChIJB2Dc0lM9fxARTMGqHQJTAr4",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJB2Dc0lM9fxARTMGqHQJTAr4",photo_interieur:"",photo_exterieur:""},
    {id:29,nom:"The Weakers Snack-Bar",type:"Snack-Bar",quartier:"Awendje",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 62 58 87 39",paiement:"En attente",affluence:0,lat:0.3829818,lng:9.4800079,place_id:"ChIJ_3i8fas9fxAR085VB48knXQ",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJ_3i8fas9fxAR085VB48knXQ",photo_interieur:"",photo_exterieur:""},
    {id:30,nom:"LE 241 Snack Bar Cafe",type:"Snack-Bar",quartier:"Awendje",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 77 92 18 18",paiement:"En attente",affluence:0,lat:0.4047835,lng:9.4986943,place_id:"ChIJcc5ixSg9fxARTNgmF0_VvJQ",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJcc5ixSg9fxARTNgmF0_VvJQ",photo_interieur:"",photo_exterieur:""},
    {id:31,nom:"Snack Bar NUL BAR AILLEURS",type:"Snack-Bar",quartier:"Awendje",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 62 42 76 07",paiement:"En attente",affluence:0,lat:0.4118336,lng:9.470781,place_id:"ChIJmcsR1nA_fxAR3MQ2ChEuPy4",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJmcsR1nA_fxAR3MQ2ChEuPy4",photo_interieur:"",photo_exterieur:""},
    {id:32,nom:"LE CORNER LBV",type:"Bar Lounge",quartier:"Akanda",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 76 24 57 51",paiement:"En attente",affluence:0,lat:0.5030663,lng:9.4047995,place_id:"ChIJry0cxOglfxARSdnlgH4fyXk",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJry0cxOglfxARSdnlgH4fyXk",photo_interieur:"",photo_exterieur:""},
    {id:33,nom:"Entre Nous Restaurant & Bar",type:"Bar",quartier:"Centre-ville",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 66 99 21 98",paiement:"En attente",affluence:0,lat:0.4409874,lng:9.4434806,place_id:"ChIJN_z4U1Y7fxARTpu3F2bzwPU",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJN_z4U1Y7fxARTpu3F2bzwPU",photo_interieur:"",photo_exterieur:""},
    {id:34,nom:"Bineva Snack-Bar",type:"Snack-Bar",quartier:"Nzeng-Ayong",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 66 10 90 46",paiement:"En attente",affluence:0,lat:0.4153086,lng:9.4815077,place_id:"ChIJ514xOuw9fxARKE9_zP4megk",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJ514xOuw9fxARKE9_zP4megk",photo_interieur:"",photo_exterieur:""},
    {id:35,nom:"VIP Night Club",type:"Discotheque",quartier:"Louis",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 77 89 24 62",paiement:"En attente",affluence:0,lat:0.4091286,lng:9.4328372,place_id:"ChIJW8uY4go7fxAR8SIYtQ4mx1M",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJW8uY4go7fxAR8SIYtQ4mx1M",photo_interieur:"",photo_exterieur:""},
    {id:36,nom:"Cotton Club",type:"Discotheque",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.4120434,lng:9.4285665,place_id:"ChIJD3ZXHQw7fxARxNdszKkhkek",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJD3ZXHQw7fxARxNdszKkhkek",photo_interieur:"",photo_exterieur:""},
    {id:37,nom:"Boomerang Night Club",type:"Discotheque",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 62 28 19 19",paiement:"En attente",affluence:0,lat:0.4073107,lng:9.4345255,place_id:"ChIJA16SUHU7fxARc1L4R_yR9a0",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJA16SUHU7fxARc1L4R_yR9a0",photo_interieur:"",photo_exterieur:""},
    {id:38,nom:"La Noche Discotheque",type:"Discotheque",quartier:"Centre-ville",ambiance:"Anime",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.4386529,lng:9.4402257,place_id:"ChIJUylRSDk7fxAR1e4BG88skSg",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJUylRSDk7fxAR1e4BG88skSg",photo_interieur:"",photo_exterieur:""},
    {id:39,nom:"THE LIGHTS",type:"Discotheque",quartier:"Akanda",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 66 13 09 75",paiement:"En attente",affluence:0,lat:0.5110594,lng:9.4061635,place_id:"ChIJqdY9hQ09fxAR3Pd6kAHiAa8",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJqdY9hQ09fxAR3Pd6kAHiAa8",photo_interieur:"",photo_exterieur:""},
    {id:40,nom:"CEYO NIGHTCLUB",type:"Discotheque",quartier:"Nzeng-Ayong",ambiance:"Anime",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.4333249,lng:9.4841343,place_id:"ChIJ5-vIs9I9fxAR4A79RMNnJoQ",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJ5-vIs9I9fxAR4A79RMNnJoQ",photo_interieur:"",photo_exterieur:""},
    {id:41,nom:"Le Phoenix Night Club",type:"Discotheque",quartier:"Nzeng-Ayong",ambiance:"Festif",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.4274256,lng:9.4774206,place_id:"ChIJe75Tmr88fxARevbrLUcTvzc",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJe75Tmr88fxARevbrLUcTvzc",photo_interieur:"",photo_exterieur:""},
    {id:42,nom:"LOxy Snack Bar Et Nightclub",type:"Discotheque",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"",paiement:"En attente",affluence:0,lat:0.3976322,lng:9.4410695,place_id:"ChIJL2WJsrg7fxARA9LHKr8EPNs",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJL2WJsrg7fxARA9LHKr8EPNs",photo_interieur:"",photo_exterieur:""},
    {id:43,nom:"Sunset Bar Terrasse",type:"Bar Terrasse",quartier:"Louis",ambiance:"Festif",statut:"",note:0,avis:0,contact:"+241 74 25 19 80",paiement:"En attente",affluence:0,lat:0.4072794,lng:9.4345055,place_id:"ChIJnYM_TwA7fxARl3xJ9aYT-vs",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJnYM_TwA7fxARl3xJ9aYT-vs",photo_interieur:"",photo_exterieur:""},
    {id:44,nom:"RoofTop LBV",type:"Bar Terrasse",quartier:"Akanda",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 66 05 06 07",paiement:"En attente",affluence:0,lat:0.4980418,lng:9.392425,place_id:"ChIJvyxcu_wlfxARvNyqCRU2g9A",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJvyxcu_wlfxARvNyqCRU2g9A",photo_interieur:"",photo_exterieur:""},
    {id:45,nom:"Bar Terrasse Libreville",type:"Bar Terrasse",quartier:"Centre-ville",ambiance:"Tres Festif",statut:"",note:0,avis:0,contact:"+241 77 61 68 59",paiement:"En attente",affluence:0,lat:0.4362396,lng:9.4280635,place_id:"ChIJLQ9rzIk7fxARfED3YnR-n0M",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJLQ9rzIk7fxARfED3YnR-n0M",photo_interieur:"",photo_exterieur:""},
    {id:46,nom:"Paul Gabon Glass",type:"Patisserie Cafe",quartier:"Glass",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 11 44 99 99",paiement:"En attente",affluence:0,lat:0.3763756,lng:9.4547395,place_id:"ChIJpVoZYVM7fxAR-0J1lKYqENs",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJpVoZYVM7fxAR-0J1lKYqENs",photo_interieur:"",photo_exterieur:""},
    {id:47,nom:"Paul Libreville Centre",type:"Patisserie Cafe",quartier:"Louis",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 11 44 29 02",paiement:"En attente",affluence:0,lat:0.4231599,lng:9.4283105,place_id:"ChIJFzkUgBY7fxARgITPQoroGxs",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJFzkUgBY7fxARgITPQoroGxs",photo_interieur:"",photo_exterieur:""},
    {id:48,nom:"La Citronnelle",type:"Patisserie Cafe",quartier:"Akanda",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 66 10 32 30",paiement:"En attente",affluence:0,lat:0.4586431,lng:9.4081189,place_id:"ChIJn1nkZ7QlfxARPvqOlxCu5z4",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJn1nkZ7QlfxARPvqOlxCu5z4",photo_interieur:"",photo_exterieur:""},
    {id:49,nom:"Patisserie La Regina",type:"Patisserie Cafe",quartier:"Louis",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 74 44 12 12",paiement:"En attente",affluence:0,lat:0.4065169,lng:9.4323933,place_id:"ChIJP-aGQdw7fxARnDpdxzuX_YU",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJP-aGQdw7fxARnDpdxzuX_YU",photo_interieur:"",photo_exterieur:""},
    {id:50,nom:"MAISON M GABON",type:"Patisserie Cafe",quartier:"Glass",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 60 17 11 11",paiement:"En attente",affluence:0,lat:0.3718245,lng:9.4614964,place_id:"ChIJLW5kY4s9fxARPDquzK-fMv0",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJLW5kY4s9fxARPDquzK-fMv0",photo_interieur:"",photo_exterieur:""},
    {id:51,nom:"La Foret Noire Owendo",type:"Patisserie Cafe",quartier:"Glass",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 66 77 97 47",paiement:"En attente",affluence:0,lat:0.3311202,lng:9.4870622,place_id:"ChIJpfugDh0_fxARU9lZtYUZXBc",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJpfugDh0_fxARU9lZtYUZXBc",photo_interieur:"",photo_exterieur:""},
    {id:52,nom:"CACAO Patisserie Restaurant",type:"Patisserie Cafe",quartier:"Akanda",ambiance:"Chill",statut:"",note:0,avis:0,contact:"+241 60 20 33 33",paiement:"En attente",affluence:0,lat:0.4916073,lng:9.397478,place_id:"ChIJz3T9_colfxARu98C4UxBI44",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJz3T9_colfxARu98C4UxBI44",photo_interieur:"",photo_exterieur:""},
    {id:53,nom:"Glass Restaurant",type:"Restaurant",quartier:"Glass",ambiance:"Anime",statut:"",note:0,avis:0,contact:"+241 77 17 68 63",paiement:"En attente",affluence:0,lat:0.3735488,lng:9.4568002,place_id:"ChIJi3cE6M89fxARgpT9h_Cb3Q8",maps_url:"https://www.google.com/maps/place/?q=place_id:ChIJi3cE6M89fxARgpT9h_Cb3Q8",photo_interieur:"",photo_exterieur:""},
  ];
}

// Verifier si l'utilisateur peut modifier les photos d'un etablissement
function canEditPhotos(e){
  if(isAdmin)return true;
  if(!currentUserEmail)return false;
  // Un etablissement peut modifier ses propres photos si son email correspond
  var etablEmail=(e.email||"").toLowerCase().trim();
  return etablEmail&&etablEmail===currentUserEmail.toLowerCase().trim();
}

// ══════════════════════════════════════════════════════════════
// ══ GESTION DES PHOTOS — MODIFICATION ET SUPPRESSION          ══
// ══════════════════════════════════════════════════════════════

var _photoManagerEid=null;
var _photoManagerType=null; // 'slot', 'exterieur', 'interieur'

function openPhotoManager(eid, photoType){
  var etab=etablissements.find(function(x){return x.id===eid;})||{};
  if(!canEditPhotos(etab)){showToast("Accès refusé");return;}
  
  _photoManagerEid=eid;
  _photoManagerType=photoType;
  renderPhotoManager();
  
  var modal=document.getElementById("photoManagerModal");
  if(modal) modal.style.display="flex";
}

function closePhotoManager(){
  var modal=document.getElementById("photoManagerModal");
  if(modal) modal.style.display="none";
  _photoManagerEid=null;
  _photoManagerType=null;
}

function renderPhotoManager(){
  if(!_photoManagerEid)return;
  
  var etab=etablissements.find(function(x){return x.id===_photoManagerEid;})||{};
  var title="";
  var currentPhotos=[];
  
  if(_photoManagerType==="slot"){
    title="Photos galerie";
    currentPhotos=loadSlotPhotos(_photoManagerEid);
  } else if(_photoManagerType==="exterieur"){
    title="Photo Extérieur";
    currentPhotos=etab.photo_exterieur?[{url:etab.photo_exterieur,ts:0}]:[];
  } else if(_photoManagerType==="interieur"){
    title="Photo Intérieur";
    currentPhotos=etab.photo_interieur?[{url:etab.photo_interieur,ts:0}]:[];
  }
  
  var container=document.getElementById("photoManagerContent");
  if(!container)return;
  
  var html="<div style='padding:1.2rem;'>";
  html+="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;'>";
  html+="<h2 style='font-family:Syne,sans-serif;font-size:1rem;font-weight:800;color:var(--pink);margin:0;'>"+title+"</h2>";
  html+="<button onclick='closePhotoManager()' style='background:none;border:none;color:var(--muted);font-size:1.2rem;cursor:pointer;'>✕</button>";
  html+="</div>";
  
  if(currentPhotos.length===0){
    html+="<div style='text-align:center;padding:2rem 1rem;color:var(--muted);font-size:0.9rem;'>Aucune photo</div>";
  } else {
    html+="<div style='display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.8rem;margin-bottom:1rem;'>";
    currentPhotos.forEach(function(p,idx){
      html+="<div style='position:relative;border-radius:12px;overflow:hidden;aspect-ratio:1;background:rgba(255,255,255,0.05);cursor:pointer;' onclick='openPhotoViewer(\""+_photoManagerEid+"\",\""+_photoManagerType+"\","+idx+")'>";
      html+="<img src='"+p.url+"' style='width:100%;height:100%;object-fit:cover;' onerror=\"this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/></svg>'>";
      if(canEditPhotos(etab)){
        html+="<button onclick='event.stopPropagation();deletePhotoConfirm(\""+_photoManagerEid+"\",\""+_photoManagerType+"\","+idx+")' style='position:absolute;top:4px;right:4px;width:28px;height:28px;border-radius:50%;background:rgba(255,68,102,0.9);border:none;color:#fff;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;' title='Supprimer'>✕</button>";
        if(_photoManagerType==="slot"){
          html+="<button onclick='event.stopPropagation();slotSetAsProfile(\""+_photoManagerEid+"\","+idx+")' style='position:absolute;bottom:4px;left:2px;right:2px;background:rgba(0,229,255,0.88);border:none;color:#0a1a2a;font-size:0.48rem;font-weight:800;padding:0.18rem 0.2rem;border-radius:4px;cursor:pointer;font-family:DM Sans,sans-serif;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>⭐ Photo de profil</button>";
        }
      }
      html+="</div>";
    });
    html+="</div>";
  }
  
  if(_photoManagerType==="slot" && currentPhotos.length<MAX_SLOT){
    // Utiliser un <label> pour déclencher le sélecteur de fichier nativement (fiable Android)
    html+="<label for='__fileSlotPhoto' onclick='window.__slotUploadEid=_photoManagerEid;' style='display:block;width:100%;padding:0.75rem;background:rgba(255,45,155,0.15);border:1.5px dashed rgba(255,45,155,0.4);border-radius:8px;color:var(--pink);font-weight:600;cursor:pointer;font-family:DM Sans,sans-serif;font-size:0.9rem;text-align:center;box-sizing:border-box;'>+ Ajouter une photo</label>";
  } else if(_photoManagerType==="exterieur" || _photoManagerType==="interieur"){
    // ✅ label natif → ouvre directement la galerie sur Android/iOS (même système que photo profil admin)
    html+="<label for='__filePermPhoto' onclick='window.__permPhotoEid=_photoManagerEid;window.__permPhotoType=_photoManagerType;' style='display:block;width:100%;padding:0.75rem;background:rgba(255,45,155,0.15);border:1.5px dashed rgba(255,45,155,0.4);border-radius:8px;color:var(--pink);font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;font-size:0.9rem;text-align:center;box-sizing:border-box;'>📷 Changer la photo</label>";
  }
  
  html+="</div>";
  container.innerHTML=html;
}

function deletePhotoConfirm(eid, type, idx){
  if(!confirm("Supprimer cette photo ?"))return;
  deletePhoto(eid, type, idx);
  renderPhotoManager();
  showToast("Photo supprimée");
}

function deletePhoto(eid, type, idx){
  if(type==="slot"){
    deleteSlotPhoto(eid, idx);
  } else if(type==="exterieur"){
    var obj={}; obj.photo_exterieur="";
    updateField(eid, obj);
  } else if(type==="interieur"){
    var obj={}; obj.photo_interieur="";
    updateField(eid, obj);
  }
  renderAll();
  renderHome();
}

function triggerPhotoSlotUpload(){
  window.__slotUploadEid=_photoManagerEid;
  var inp=document.getElementById("__fileSlotPhoto");
  if(inp) inp.click();
}

function triggerPhotoPermUpload(){
  window.__permPhotoEid=_photoManagerEid;
  window.__permPhotoType=_photoManagerType;
  var inp=document.getElementById("__filePermPhoto");
  if(inp) inp.click();
}

/* ══════════════════════════════════════════════════════════════
   CACHE LOCAL ÉTABLISSEMENTS — localStorage TTL 5 min
   Évite un aller-retour Firestore à chaque ouverture de l'app.
   Sur réseau 3G Libreville (~300ms RTT), gain de ~600-900ms.
   ══════════════════════════════════════════════════════════════ */
var _ETAB_CACHE_KEY = 'ambi241_etab_cache_v4'; // v4 : invalide tous les anciens caches (65 lieux)
var _ETAB_CACHE_TTL = 5 * 60 * 1000; // PERF: 5 minutes (était 30s) — Firebase rafraîchit en arrière-plan

/* ── Purge automatique des anciennes clés cache (v1/v2/v3) au démarrage ── */
(function _purgeOldEtabCaches(){
  try {
    ['ambi241_etab_cache_v1','ambi241_etab_cache_v2','ambi241_etab_cache_v3'].forEach(function(k){
      if(localStorage.getItem(k)) localStorage.removeItem(k);
    });
  } catch(e) {}
})();

function _saveEtabCache(data) {
  try {
    localStorage.setItem(_ETAB_CACHE_KEY, JSON.stringify({ ts: Date.now(), data: data }));
  } catch(e) { /* storage plein — pas critique */ }
}

function _loadEtabCache() {
  try {
    var raw = localStorage.getItem(_ETAB_CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !obj.data || (Date.now() - obj.ts) > _ETAB_CACHE_TTL) return null;
    /* Appliquer la dédup même sur le cache — protège contre les caches anciens pollués */
    return _processEtabData(obj.data);
  } catch(e) { return null; }
}

function _processEtabData(firebaseData) {
  /* ── Passe 1 : dédoublonnage par id numérique ── */
  var _seenIds = {};
  var pass1 = firebaseData.filter(function(e) {
    if (!e.id || _seenIds[e.id]) return false;
    _seenIds[e.id] = true;
    return true;
  });

  /* ── Passe 2 : dédoublonnage par _docId Firestore ─────────────────────
     Évite les doublons créés si le même document est récupéré deux fois    */
  var _seenDocIds = {};
  var pass2 = pass1.filter(function(e) {
    if (!e._docId) return true;
    if (_seenDocIds[e._docId]) return false;
    _seenDocIds[e._docId] = true;
    return true;
  });

  /* ── Passe 3 : dédoublonnage par nom normalisé + type ──────────────────
     Détecte les mêmes établissements enregistrés plusieurs fois avec des
     id différents. En cas de doublon, on conserve celui avec l'affluence
     la plus haute (ou le premier rencontré si affluence identique).        */
  var _seenNames = {};
  var _dupsFound = [];
  var pass3 = pass2.filter(function(e) {
    if (!e.nom) return true;
    var key = e.nom.toLowerCase().trim().replace(/\s+/g,' ')
              + '||' + (e.type||'').toLowerCase().trim();
    if (_seenNames[key]) {
      /* Garder le plus riche en données (affluence > 0, note > 0) */
      var kept = _seenNames[key];
      var score = function(x){ return (x.affluence||0)*10 + (x.note||0)*5 + (x.avis||0); };
      if(score(e) > score(kept)){
        _dupsFound.push({ removed: kept, kept: e });
        _seenNames[key] = e; /* remplacer par le meilleur */
        return false; /* le précédent déjà dans le résultat — on l'enlève via reconstruct */
      }
      _dupsFound.push({ kept: kept, removed: e });
      return false;
    }
    _seenNames[key] = e;
    return true;
  });

  /* Reconstruction propre : les "replaced" doivent aussi être retirés */
  var _keptSet = {};
  pass3.forEach(function(e){ if(e._docId) _keptSet[e._docId] = true; else if(e.id) _keptSet['id_'+e.id] = true; });
  /* Ré-injecter les gagnants de remplacement qui ont peut-être été exclus */
  _dupsFound.forEach(function(d){
    var k = d.kept;
    var kKey = k._docId ? k._docId : ('id_'+k.id);
    if(!_keptSet[kKey]){
      pass3.push(k);
      _keptSet[kKey] = true;
    }
    var rKey = d.removed._docId ? d.removed._docId : ('id_'+d.removed.id);
    /* S'assurer que le removed n'est pas dans pass3 */
    pass3 = pass3.filter(function(x){
      var xk = x._docId ? x._docId : ('id_'+x.id);
      return xk !== rKey;
    });
  });

  if (_dupsFound.length > 0) {
    console.warn('[AMBI241] 🚨 Doublons Firebase supprimés (' + _dupsFound.length + ') :',
      _dupsFound.map(function(d){
        return '❌ "' + d.removed.nom + '" id=' + d.removed.id + ' doc=' + d.removed._docId
             + ' → conservé id=' + d.kept.id + ' doc=' + d.kept._docId;
      }).join('\n'));
  }

  /* ── Passe 4 : correction automatique des maps_url OSM invalides ───────────
     Les établissements importés via OSM ont un place_id "osm2_way_XXX" invalide
     sur Google Maps. On reconstruit l'URL depuis les coordonnées GPS (lat/lng). */
  pass3.forEach(function(e){
    var url = e.maps_url || '';
    if(url && url.indexOf('place_id:osm') !== -1){
      if(e.lat && e.lng){
        e.maps_url = 'https://maps.google.com/?q=' + e.lat + ',' + e.lng
                   + '&query=' + encodeURIComponent((e.nom||'') + ' Libreville');
      } else {
        e.maps_url = 'https://maps.google.com/?q=' + encodeURIComponent((e.nom||'') + ' ' + (e.quartier||'') + ' Libreville Gabon');
      }
    }
  });

  return pass3;
}

function _renderAfterLoad() {
  /* Verrou : à partir d'ici, les données Firestore sont "live" et priment
     sur tout instantané public arrivant en retard (voir _tryLoadPublicSnapshot). */
  window.__ambiLiveDataLoaded = true;
  document.getElementById("errorBanner").innerHTML = "";
  rebuildPaiements();
  etablissements.forEach(function(e) { applyDynamicStatus(e); });
  /* GPS-FIX: Firebase/cache a remplacé etablissements[] — les objets sont neufs
     et n'ont plus _distKm. On ré-injecte les distances si le mode GPS est actif. */
  if (typeof _gpsState !== "undefined" && _gpsState.active && _gpsState.lat !== null) {
    enrichWithDistances();
  }
  setSyncing(false);
  if (typeof invalidateScoreCache === 'function') invalidateScoreCache();
  /* Un seul renderAll couvre tout — évite 4 passes DOM successives */
  renderAll(); renderHome(); renderStats(); renderPayments(); updateSyncTime();
  if (typeof i18n !== "undefined") i18n.applyTranslations();
  if (isAdmin && (_currentAdmTab === 'overview' || window._currentAdmTab === 'overview') &&
      typeof renderAdmOverview === 'function') { renderAdmOverview(); }
}

function loadData(){
  /* Guard : si Firebase pas encore prêt, réessayer dans 300ms */
  if (typeof window.fbCollection !== "function" || typeof window.fbGetDocs !== "function" || !window.db) {
    setTimeout(loadData, 300);
    return;
  }

  /* ── ÉTAPE 1 : Afficher le cache immédiatement (rendu instantané) ── */
  /* FIX v3 : si l'app vient d'être lancée depuis l'écran d'accueil (PWA),
     ignorer le cache et aller directement sur Firestore pour avoir les données fraîches */
  /* PERF FIX: Utiliser le cache même en PWA pour affichage instantané,
     puis Firebase rafraîchit les données en arrière-plan */
  var cached = _loadEtabCache();

  if (cached && cached.length > 0) {
    etablissements = cached;
    // ✅ NE PAS appliquer applyDynamicStatus ici (cache path) — faire dans _renderAfterLoad après données fraîches
    /* GPS-FIX: Le cache remplace etablissements[] — ré-injecter _distKm si GPS actif */
    if (typeof _gpsState !== "undefined" && _gpsState.active && _gpsState.lat !== null) {
      enrichWithDistances();
    }
    rebuildPaiements();
    renderAll(); renderHome(); renderStats(); renderPayments();
    /* Pas de setSyncing(true) ici pour ne pas flasher le spinner si cache frais */
  }

  /* ── ÉTAPE 2 : Charger les établissements (toujours) + paiements (admin uniquement) ── */
  setSyncing(true);

  var qEtab = window.fbQuery(window.fbCollection(window.db, "etablissements"));

  /* PERF : La collection paiements (~lecture lourde) n'est chargée que si l'admin est connecté.
     Pour les visiteurs et utilisateurs normaux, on économise cette requête Firestore. */
  var etabPromise = window.fbGetDocs(qEtab);
  var paiePromise = isAdmin
    ? window.fbGetDocs(window.fbQuery(window.fbCollection(window.db, "paiements")))
    : Promise.resolve(null);

  Promise.all([etabPromise, paiePromise]).then(function(results) {
    var snapEtab = results[0];
    var snapPaie = results[1]; // null si non-admin

    /* ── Traiter établissements ── */
    var firebaseData = [];
    snapEtab.forEach(function(d) { firebaseData.push(Object.assign({ _docId: d.id }, d.data())); });

    if (firebaseData.length > 0) {
      firebaseData = _processEtabData(firebaseData);
      etablissements = firebaseData;
      _saveEtabCache(firebaseData); /* Mettre à jour le cache */
    } else {
      etablissements = getDefaults();
    }

    /* ── Traiter paiements (admin uniquement) ── */
    if (snapPaie) {
      _paiementsFirebase = [];
      snapPaie.forEach(function(d) { _paiementsFirebase.push(Object.assign({ _docId: d.id }, d.data())); });
    }

    /* ── Rendu final unique ── */
    _renderAfterLoad();
    updateSyncTime();

    /* ── Abonnements temps réel (présences/votes) ── */
    if (typeof window._subscribeAllEtabs === "function") { window._subscribeAllEtabs(); }

    /* ── Photos en arrière-plan — délais échelonnés pour ne pas saturer le réseau ── */
    // PERF: délai augmenté 1000→2000ms — laisse le rendu DOM se stabiliser avant les requêtes Firestore
    setTimeout(loadAllPhotoProfiles, 2000);
    setTimeout(function() {
      if (typeof loadSlotPhotosAsync === 'function' && etablissements && etablissements.length) {
        var actifs = etablissements.filter(function(e) { return estPaiementConfirme(e); });
        actifs.slice(0, 10).forEach(function(e, i) {
          /* Espacer les requêtes de 200ms chacune pour ne pas saturer la bande passante 3G */
          setTimeout(function() { if (e.id) loadSlotPhotosAsync(e.id); }, i * 200);
        });
      }
    }, 3500);

  }).catch(function(err) {
    console.error("Firebase loadData:", err);
    /* Si le cache existe, on garde les données en mémoire — sinon fallback défauts */
    if (!etablissements || !etablissements.length) {
      etablissements = getDefaults();
    }
    var eb = document.getElementById("errorBanner");
    if (eb) eb.innerHTML = "";
    _renderAfterLoad();
  });
}

function updateField(id,fields){
  setSyncing(true);
  var e=etablissements.find(function(x){return x.id===id;});
  if(!e){showToast("Erreur: etablissement introuvable");setSyncing(false);return;}
  // Marquer _adminOverride si l'admin modifie le statut manuellement
  if(fields.statut !== undefined && fields._adminOverride === undefined){
    fields._adminOverride = true;
  }
  // Permettre la réinitialisation explicite de l'override
  if(fields._adminOverride === false){
    e._adminOverride = false;
    fields._adminOverride = false;
    // Ré-appliquer le statut dynamique
    applyDynamicStatus(e);
  }
  // Mettre à jour localement immédiatement (UX fluide)
  Object.keys(fields).forEach(function(k){e[k]=fields[k];});
  renderStats();renderAll();renderHome();
  if(_currentAdmTab==="etabl") renderAdmEtabl();
  if(_currentAdmTab==="classement") renderAdmClassement();
  // Si pas de _docId : créer le doc Firebase avec toutes les données
  if(!e._docId){
    if(!window.db||typeof window.fbAddDoc!=="function"){setSyncing(false);showToast("Mis à jour localement");return;}
    var newDoc=Object.assign({},e);
    delete newDoc._docId;
    window.fbAddDoc(window.fbCollection(window.db,"etablissements"),newDoc).then(function(ref){
      e._docId=ref.id;
      showToast("✅ Créé dans Firebase !");setSyncing(false);updateSyncTime();
    }).catch(function(err){
      console.error("Firebase addDoc:",err);
      showToast("Mis à jour localement");setSyncing(false);
    });
    return;
  }
  var docRef=window.fbDoc(window.db,"etablissements",e._docId);
  window.fbUpdateDoc(docRef,fields).then(function(){
    showToast("Mis à jour !");setSyncing(false);updateSyncTime();
  }).catch(function(err){
    console.error("Firebase updateField:",err);
    showToast("Mis à jour localement");setSyncing(false);
  });
}

function setSyncing(v){
  document.getElementById("syncSpinner").style.display=v?"block":"none";
  var statusEl=document.getElementById("syncStatus");
  if(statusEl) statusEl.textContent=v?(typeof i18n!=="undefined"?i18n.t("sync_ing"):"Synchronisation..."):(typeof i18n!=="undefined"?i18n.t("sync_live"):"Données en direct");
}
function updateSyncTime(){
  document.getElementById("syncTime").textContent=new Date().toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
}

// ── Liste globale des types d'établissements (icônes/SVG) ──
// Factorisée ici pour être réutilisable à la fois par renderHomeImmediate()
// et par le système de compteurs précalculés (cache local + Firestore),
// qui permet un affichage quasi instantané dès le tout premier chargement.
var AMBI_TYPES_DEF = [
  {key:"Bar",        icon:"&#127867;", name:"Bars",                 cls:"bar",         countCls:"tt-count-bar"},
  {key:"Bar Terrasse",icon:"🌴",name:"Bar Terrasses",        cls:"bar-terrasse",countCls:"tt-count-bar-terrasse"},
  {key:"Snack",      icon:"&#127870;", name:"Snacks",               cls:"snack",       countCls:"tt-count-snack"},
  {key:"Restaurant", icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"2.2em\" height=\"1.6em\" style=\"display:inline-block;vertical-align:middle;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>", name:"Restos &amp;<br>Pâtisseries", cls:"resto",       countCls:"tt-count-resto"},
  {key:"Discotheque",icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 30\" width=\"2em\" height=\"1.3em\" style=\"display:inline-block;vertical-align:middle;\"><circle cx=\"11\" cy=\"4\" r=\"3\" fill=\"#ff2d9b\"/><path d=\"M11 7 Q7 13 5 20 Q8 18 11 19 Q14 18 17 20 Q15 13 11 7Z\" fill=\"#ff2d9b\"/><line x1=\"11\" y1=\"10\" x2=\"5\" y2=\"6\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"11\" y1=\"10\" x2=\"17\" y2=\"13\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"9\" y1=\"19\" x2=\"6\" y2=\"27\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"19\" x2=\"16\" y2=\"26\" stroke=\"#ff2d9b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"37\" cy=\"4\" r=\"3\" fill=\"#cc44ff\"/><line x1=\"37\" y1=\"7\" x2=\"37\" y2=\"19\" stroke=\"#cc44ff\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"11\" x2=\"31\" y2=\"13\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"11\" x2=\"43\" y2=\"7\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"19\" x2=\"33\" y2=\"27\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><line x1=\"37\" y1=\"19\" x2=\"41\" y2=\"26\" stroke=\"#cc44ff\" stroke-width=\"2\" stroke-linecap=\"round\"/><text x=\"21\" y=\"13\" font-size=\"8\" fill=\"#ffd700\">♪</text></svg>", name:"Boîtes de Nuit",       cls:"disco",       countCls:"tt-count-disco"},
];

/* ── Peint la grille des types à partir d'un objet de compteurs {key: count} ── */
function _paintTypesGrid(counts){
  var typesEl = document.getElementById("typesGrid");
  if(!typesEl) return;
  typesEl.innerHTML = AMBI_TYPES_DEF.map(function(t){
    var count = (counts && counts[t.key]) || 0;
    return '<div class="type-tile type-tile-'+t.cls+'" onclick="goToTypeFilter(\''+t.key+'\')" title="Voir les '+t.name+'">'
      + '<div class="tt-bgphoto"></div>'
      + '<div class="tt-icon">'+t.icon+'</div>'
      + '<div class="tt-name">'+t.name+'</div>'
      + '<div class="tt-count '+t.countCls+'">'+count+'</div>'
      + '</div>';
  }).join("");
}

/* ── Cache des compteurs précalculés par type ──
   Objectif : un tout premier visiteur (sans cache local, avant même le
   téléchargement complet des 1017 documents) voit des chiffres réels
   quasi instantanément, au lieu de "0" pendant le chargement.

   ARCHITECTURE : le document Firestore meta/typeCounts est calculé et
   maintenu côté SERVEUR par des Cloud Functions (voir functions/index.js),
   pas par le client. Le client ne fait que LIRE ce document (autorisé par
   les règles de sécurité : allow read: if true) et le mettre en cache
   local pour un affichage instantané au prochain démarrage. Aucune
   écriture cliente n'est nécessaire ni souhaitable ici : ça évite
   d'avoir à ouvrir les permissions d'écriture Firestore au public, et
   garantit une seule source de vérité cohérente pour les compteurs. ── */
var _TYPE_COUNTS_CACHE_KEY = 'ambi241_type_counts_v1';

function _saveTypeCountsCache(counts){
  /* Cache local uniquement (lecture instantanée au prochain démarrage
     sur cet appareil). Le calcul faisant foi vit côté serveur. */
  try { localStorage.setItem(_TYPE_COUNTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), counts: counts })); } catch(e){}
}

function _loadTypeCountsCache(){
  try {
    var raw = localStorage.getItem(_TYPE_COUNTS_CACHE_KEY);
    if(!raw) return null;
    var obj = JSON.parse(raw);
    if(!obj || !obj.counts) return null;
    /* On accepte le cache même expiré au boot — il sera rafraîchi dès que
       les vraies données (cache etab local ou Firestore) seront prêtes. */
    return obj.counts;
  } catch(e){ return null; }
}

/* ── Affichage instantané des compteurs au démarrage, avant même que
   Firestore ait fini de répondre (appelée uniquement quand il n'y a pas
   encore de cache etablissements[] local à afficher) ── */
function _renderTypeCountsInstant(){
  var typesEl = document.getElementById("typesGrid");
  if(!typesEl) return;
  var cached = _loadTypeCountsCache();
  if(cached){
    _paintTypesGrid(cached);
    return;
  }
  /* Pas de cache local (tout premier visiteur sur cet appareil) → on tente
     une lecture Firestore ultra-légère (1 document) plutôt que d'attendre
     le téléchargement complet de la collection etablissements. */
  if (window.db && typeof window.fbGetDoc === "function" && typeof window.fbDoc === "function") {
    window.fbGetDoc(window.fbDoc(window.db, "meta", "typeCounts")).then(function(snap){
      if (snap && typeof snap.exists === "function" ? snap.exists() : (snap && snap.exists)) {
        var data = snap.data();
        if (data && data.counts) {
          _paintTypesGrid(data.counts);
          try { localStorage.setItem(_TYPE_COUNTS_CACHE_KEY, JSON.stringify({ ts: Date.now(), counts: data.counts })); } catch(e){}
        }
      }
    }).catch(function(){});
  }
}

// RENDER HOME — avec debounce
var _renderHomeTimer = null;
var _renderHomeOrig = null;
function renderHome(){
  if(_renderHomeTimer) clearTimeout(_renderHomeTimer);
  _renderHomeTimer = setTimeout(renderHomeImmediate, 16);
}
function renderHomeImmediate(){
  var d = etablissements;

  /* ── OPTION 2 : Bandeau événement accueil ── */
  var bannerEl = document.getElementById("homeEventBanner");
  var bannerTextEl = document.getElementById("homeEventBannerText");
  var bannerSubEl = document.getElementById("homeEventBannerSub");
  if(bannerEl){
    var now = Date.now();
    // Trouver le premier événement actif (épinglé admin en priorité, sinon le plus récent)
    var activeEvts = d.filter(function(e){
      var ev = e.event_flash;
      if(!ev || !ev.texte) return false;
      var expire = ev.expire || (ev.ts + (ev.duree || 6) * 3600000);
      return now < expire;
    });
    // Prioriser les établissements épinglés par l'admin (event_flash.pinned = true)
    activeEvts.sort(function(a,b){
      var ap = (a.event_flash && a.event_flash.pinned) ? 1 : 0;
      var bp = (b.event_flash && b.event_flash.pinned) ? 1 : 0;
      return bp - ap;
    });
    if(activeEvts.length > 0){
      var best = activeEvts[0];
      var ev = best.event_flash;
      bannerTextEl.textContent = (ev.texte || "").substring(0, 80);
      var detail = [];
      if(best.nom) detail.push(best.nom);
      if(best.quartier) detail.push(best.quartier);
      if(ev.heure) detail.push(ev.heure);
      bannerSubEl.textContent = detail.join(" · ");
      bannerEl.classList.add("show");
      bannerEl.onclick = (function(bid){ return function(){ goToEtab(bid); }; })(best.id);
    } else {
      bannerEl.classList.remove("show");
      bannerEl.onclick = function(){ switchSection('etablissements',document.querySelectorAll('.nav-item')[1]); };
    }
  }

  /* ── Stats strip (4 tuiles) ── */
  var statsEl = document.getElementById("statsRowHome");
  if(statsEl){
    var bondes  = d.filter(function(e){ return e.statut  && e.statut.indexOf("Bonde") !== -1;  }).length;
    var animes  = d.filter(function(e){ return e.statut  && e.statut.indexOf("Anime") !== -1;  }).length;
    var calmes  = d.filter(function(e){ return e.statut  && e.statut.indexOf("Calme") !== -1;  }).length;
    var chips   = [
      {val: calmes, lbl: "Calmes", cls: "hss-amber", action: "window._filterOnSwitch={type:'all',status:'Calme'};switchSection('etablissements',document.querySelectorAll('.nav-item')[1]);"},
      {val: animes, lbl: "Animés", cls: "hss-cyan",  action: "window._filterOnSwitch={type:'all',status:'Anime'};switchSection('etablissements',document.querySelectorAll('.nav-item')[1]);"},
      {val: bondes, lbl: "Bondés", cls: "hss-red",   action: "window._filterOnSwitch={type:'all',status:'Bonde'};switchSection('etablissements',document.querySelectorAll('.nav-item')[1]);"}
    ];
    var lieuActifsChip = '<div class="hss-chip hss-pink" onclick="switchSection(\'etablissements\',document.querySelectorAll(\'.nav-item\')[1]);" style="cursor:pointer;transition:transform 0.15s,opacity 0.15s;" onmousedown="this.style.transform=\'scale(0.93)\'" onmouseup="this.style.transform=\'\'" ontouchstart="this.style.transform=\'scale(0.93)\'" ontouchend="this.style.transform=\'\'">'
      + '<div class="hss-val">' + d.length + '</div>'
      + '<div class="hss-lbl" style="line-height:1.3;">Lieux<br><span style="color:var(--green);font-weight:800;font-size:0.6rem;">' + d.length + ' ACTIFS</span></div>'
      + '</div>';
    statsEl.innerHTML = lieuActifsChip + chips.map(function(c){
      return '<div class="hss-chip '+c.cls+'" onclick="'+c.action+'" style="cursor:pointer;transition:transform 0.15s,opacity 0.15s;" onmousedown="this.style.transform=\'scale(0.93)\'" onmouseup="this.style.transform=\'\'" ontouchstart="this.style.transform=\'scale(0.93)\'" ontouchend="this.style.transform=\'\'"><div class="hss-val">'+c.val+'</div><div class="hss-lbl">'+c.lbl+'</div></div>';
    }).join("");
  }

  /* ── Grille types d'établissements ── */
  var typesEl = document.getElementById("typesGrid");
  if(typesEl){
    var typeCounts = {};
    AMBI_TYPES_DEF.forEach(function(t){
      typeCounts[t.key] = d.filter(function(e){ return getCategory(e.type) === t.key; }).length;
    });
    _paintTypesGrid(typeCounts);
    /* Dès qu'on dispose de vraies données (cache local ou Firestore), on
       met à jour le cache local pour que le prochain démarrage sur cet
       appareil affiche ces chiffres instantanément. Le document Firestore
       meta/typeCounts (source de vérité pour les autres appareils / tout
       premiers visiteurs) est maintenu côté serveur par les Cloud
       Functions — voir functions/index.js. */
    if(d && d.length > 0){ _saveTypeCountsCache(typeCounts); }
  }

  /* ── Top 6 meilleur de chaque catégorie ── */
  var topEl = document.getElementById("topLieux");
  if(topEl && typeof d !== 'undefined' && d && d.length > 0){
    // Calcul score réel pour chaque établissement
    var scored = d.map(function(e){
      var eidStr = String(e.id);
      var lp = window._livePresences ? (window._livePresences[eidStr]||{count:0}) : {count:0};
      var lv = window._liveVotes     ? (window._liveVotes[eidStr]    ||{pos:0,neg:0}) : {pos:0,neg:0};
      var base      = e.affluence || 0;
      var presBonus = Math.min(lp.count * 3, 30);
      var voteBonus = (lv.pos * 2) - (lv.neg * 3);
      // Inclure la note comme tiebreaker (×10 pour peser dans le score)
      var noteBonus = (e.note || 0) * 10;
      var score     = Math.max(0, Math.min(200, base + presBonus + voteBonus + noteBonus));
      return Object.assign({}, e, { _score: score });
    });

    // Top 6 : meilleur par catégorie d'abord, puis combler avec les meilleurs restants
    var allCats = ["Bar", "Bar Terrasse", "Snack", "Restaurant", "Discotheque"];
    var categoryMap = {};
    allCats.forEach(function(cat){ categoryMap[cat] = []; });

    scored.forEach(function(e){
      var cat = getCategory(e.type);
      if(allCats.indexOf(cat) !== -1) categoryMap[cat].push(e);
    });
    // Trier chaque catégorie par score décroissant
    allCats.forEach(function(cat){
      categoryMap[cat].sort(function(a,b){ return b._score - a._score; });
    });

    // Prendre le N°1 de chaque catégorie (dans l'ordre)
    var topSix = [];
    var usedIds = {};
    allCats.forEach(function(cat){
      if(categoryMap[cat].length > 0){
        var best = categoryMap[cat][0];
        if(!usedIds[best.id]){ topSix.push(best); usedIds[best.id]=true; }
      }
    });

    // Compléter jusqu'à 9 avec les meilleurs restants toutes catégories
    var allSorted = scored.slice().sort(function(a,b){ return b._score - a._score; });
    allSorted.forEach(function(e){
      if(topSix.length >= 6) return;
      if(!usedIds[e.id]){ topSix.push(e); usedIds[e.id]=true; }
    });
    topSix = topSix.slice(0, 6);

    if(!topSix.length){
      topEl.innerHTML = '<div style="text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:0.75rem;">Aucun établissement disponible pour le moment.</div>';
      return;
    }

    var categoryClasses = {
      "Bar":"bar","Discotheque":"club","Restaurant":"restaurant",
      "Bar Terrasse":"terrasse","Snack":"snack",
      
    };
    var categoryLabels = {
      "Bar":"BAR","Discotheque":"BOÎTES DE NUIT","Restaurant":"RESTOS & PÂTISS.",
      "Bar Terrasse":"BAR TERRASSES","Snack":"SNACKS",
      
    };
    var categoryIcons = {
      "Bar":"🍺","Discotheque":"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 30' width='1.4em' height='0.9em'><circle cx='11' cy='4' r='3' fill='#ff2d9b'/><path d='M11 7 Q7 13 5 20 Q8 18 11 19 Q14 18 17 20 Q15 13 11 7Z' fill='#ff2d9b'/><line x1='11' y1='10' x2='5' y2='6' stroke='#ff2d9b' stroke-width='2' stroke-linecap='round'/><line x1='11' y1='10' x2='17' y2='13' stroke='#ff2d9b' stroke-width='2' stroke-linecap='round'/><line x1='9' y1='19' x2='6' y2='27' stroke='#ff2d9b' stroke-width='2' stroke-linecap='round'/><line x1='13' y1='19' x2='16' y2='26' stroke='#ff2d9b' stroke-width='2' stroke-linecap='round'/><circle cx='37' cy='4' r='3' fill='#cc44ff'/><line x1='37' y1='7' x2='37' y2='19' stroke='#cc44ff' stroke-width='2.5' stroke-linecap='round'/><line x1='37' y1='11' x2='31' y2='13' stroke='#cc44ff' stroke-width='2' stroke-linecap='round'/><line x1='37' y1='11' x2='43' y2='7' stroke='#cc44ff' stroke-width='2' stroke-linecap='round'/><line x1='37' y1='19' x2='33' y2='27' stroke='#cc44ff' stroke-width='2' stroke-linecap='round'/><line x1='37' y1='19' x2='41' y2='26' stroke='#cc44ff' stroke-width='2' stroke-linecap='round'/><text x='21' y='13' font-size='8' fill='#ffd700'>♪</text></svg>","Restaurant":"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"2.2em\" height=\"1.6em\" style=\"display:inline-block;vertical-align:middle;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>",
      "Bar Terrasse":"🌴","Snack":"🍾",
      
    };

    topEl.innerHTML = topSix.map(function(e, i){
      if(!e) return '';
      var cat = getCategory(e.type);
      var cardClass = categoryClasses[cat] || "bar";
      var label = categoryLabels[cat] || "BAR";
      var icon = categoryIcons[cat] || "🏢";
      var note = e.note ? e.note.toFixed(1) : "—";
      var statut = e.statut || "";
      var heatIcon = statut.indexOf("Bonde") !== -1 ? "🔴" 
        : statut.indexOf("Anime") !== -1 ? "🟢" 
        : statut.indexOf("Calme") !== -1 ? "🟡" : "•";
      
      var extraInfo = '';
      var _t6click = 'goToTop6Etab('+e.id+',\''+cat+'\');';
      return '<div class="top6-card '+cardClass+'" onclick="'+_t6click+'" title="Voir '+escHtml(e.nom||'')+'">'
        + '<div class="t6c-rank t6c-rank-'+(i+1<=3?i+1:'other')+'">N°'+(i+1)+'</div>'
        + '<div class="t6c-icon">'+icon+'</div>'
        + '<div class="t6c-info">'
        +   '<div class="t6c-cat">'+label+'</div>'
        +   '<div class="t6c-name">'+(e.nom||"—")+'</div>'
        +   '<div class="t6c-heat">'+extraInfo+heatIcon+' '+note+' ★</div>'
        + '</div>'
        + '<div class="t6c-right">'+note+'<span class="t6c-arrow"> →</span></div>'
        + '</div>';
    }).join("");
  } else if(topEl) {
    topEl.innerHTML = '<div style="text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:0.75rem;">⏳ Chargement...</div>';
  }
}

/* Aller vers la section lieux avec filtre quartier pré-sélectionné */
function goToQuartier(quartier){
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
  setTimeout(function(){
    var searchInp = document.getElementById('searchInput');
    if(searchInp){
      searchInp.value = quartier;
      // Déclencher l'événement input
      searchInp.dispatchEvent(new Event('input'));
    }
    showToast('📍 ' + quartier);
  }, 120);
}
window.goToQuartier = goToQuartier;


function goToTypeFilter(type){
  /* Poser le filtre AVANT switchSection pour éviter tout flash "Tous" */
  window._filterOnSwitch = { type: type, status: 'all' };
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
  window.scrollTo(0, 0);
  showToast && showToast('🔍 ' + type);
}

/* ══════════════════════════════════════════════════════════════
   TOP DU MOMENT — Clic sur une carte
   1. Aller dans Lieux avec le filtre du type de la carte
   2. Ouvrir la quickSheet (openPublicProfile) de l'établissement N°1
      de cette catégorie (trié par score décroissant)
══════════════════════════════════════════════════════════════ */
function goToTop6Etab(id, cat){
  // ✅ NOUVEAU : Afficher en liste compacte (compact) au lieu de groupe
  // avec l'établissement cliqué en spotlight (fiche intégrale en tête)
  
  // 1. Appliquer le filtre de type AVANT le changement de section
  window._filterOnSwitch = { type: cat || 'all', status: 'all' };
  
  // 2. Basculer en vue compact (liste compacte)
  currentView = 'compact';
  document.querySelectorAll('[data-view]').forEach(function(b){ b.classList.remove('active'); });
  var compactBtn = document.querySelector('[data-view="compact"]');
  if(compactBtn) compactBtn.classList.add('active');
  
  // 3. Mémoriser l'établissement spotlight (affiché en fiche intégrale en tête)
  window._spotlightEtabTopMoment = id; // flag spécial pour le rendu compact
  
  // 4. Basculer vers Lieux
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
  window.scrollTo(0, 0);
}
window.goToTop6Etab = goToTop6Etab;

// PIN
var pinBuf="";
function pinPress(k){
  // ── ANTI-BRUTE FORCE PIN ──
  var pinLockUntil = parseInt(lsGet("ambi241_pin_lockuntil")||"0");
  if(pinLockUntil > Date.now()){
    var remMin = Math.ceil((pinLockUntil-Date.now())/60000);
    showToast("🔒 Accès bloqué — réessayez dans "+remMin+" min");
    return;
  }

  if(k==="clear"){pinBuf="";updateDots();return;}
  if(k==="del"){pinBuf=pinBuf.slice(0,-1);updateDots();return;}
  if(pinBuf.length>=4)return;
  pinBuf+=k;updateDots();
  if(pinBuf.length===4){
    hashPin(pinBuf).then(function(h){
      if(h===loadPinHash()){
        // ── Succès : réinitialiser le compteur ──
        lsSet("ambi241_pin_attempts","0");
        lsSet("ambi241_pin_lockuntil","0");
        document.getElementById("pinOverlay").classList.remove("show");
        isAdmin=true;
        // isSuperAdmin sera mis à jour par loadAdminConfig() après résolution Firebase
        isSuperAdmin = isSuperAdminUser(); // valeur provisoire (cache localStorage)
        // Afficher bouton admin, masquer le cadenas discret
        var abtn=document.getElementById("adminBtn");
        var unlockBtn=document.getElementById("adminUnlockBtn");
        if(abtn){ abtn.style.display="flex"; abtn.style.background="rgba(255,215,0,0.2)"; abtn.style.borderColor="rgba(255,215,0,0.6)"; abtn.style.color="#ffd700"; }
        if(unlockBtn) unlockBtn.style.display="none";
        // Afficher la cloche notifications et le bouton paramètres pour l'admin
        var bellWrap = document.getElementById("notifBellWrap");
        if(bellWrap) bellWrap.style.display = "inline-flex";
        var navSettings = document.getElementById("navAdminSettings");
        if(navSettings) navSettings.style.display = "flex";
        renderStats();renderAll();renderHome();updatePayVis();renderPayments();
        // ── Afficher le bouton Ajout rapide ──
        if(typeof window.aqaCheckAdminBtn==='function') window.aqaCheckAdminBtn();
        var t=getTraffic();
        document.getElementById("trafficVal").textContent=t.count+" (total: "+t.total+")";
        document.getElementById("trafficBadge").classList.add("show");
        showToast("Mode Admin activé");
        loadAdminConfig(); // charger config superadmin + liste admins secondaires
      } else {
        // ── Échec : incrémenter compteur ──
        var attempts = parseInt(lsGet("ambi241_pin_attempts")||"0") + 1;
        lsSet("ambi241_pin_attempts", String(attempts));
        if(attempts >= 5){
          // Bloquer 30 minutes
          var lockUntil = Date.now() + (30*60*1000);
          lsSet("ambi241_pin_lockuntil", String(lockUntil));
          lsSet("ambi241_pin_attempts","0");
          document.getElementById("pinError").style.display="block";
          document.getElementById("pinError").textContent="🚫 Trop de tentatives — accès bloqué 30 min";
          setTimeout(function(){pinBuf="";updateDots();document.getElementById("pinError").style.display="none";document.getElementById("pinError").textContent="";},3000);
        } else {
          var remaining = 5 - attempts;
          document.getElementById("pinError").style.display="block";
          document.getElementById("pinError").textContent="❌ PIN incorrect — "+remaining+" tentative"+(remaining>1?"s":"")+" restante"+(remaining>1?"s":"");
          setTimeout(function(){pinBuf="";updateDots();document.getElementById("pinError").style.display="none";document.getElementById("pinError").textContent="";},1500);
        }
      }
    });
  }
}
function updateDots(){
  for(var i=0;i<4;i++)document.getElementById("d"+i).classList.toggle("filled",i<pinBuf.length);
}
function toggleAdmin(){
  if(isAdmin){
    isAdmin=false;
    isSuperAdmin=false;
    var abtn=document.getElementById("adminBtn");
    var unlockBtn=document.getElementById("adminUnlockBtn");
    if(abtn){ abtn.style.display="none"; abtn.style.background=""; abtn.style.borderColor=""; abtn.style.color=""; }
    if(unlockBtn) unlockBtn.style.display="flex";
    // Réévaluer la visibilité de la cloche après désactivation du mode admin
    if(typeof renderNotifBadge === "function") renderNotifBadge();
    var navSettings = document.getElementById("navAdminSettings");
    if(navSettings) navSettings.style.display = "none";
    renderStats();renderAll();renderHome();updatePayVis();
    // ── Masquer le bouton Ajout rapide ──
    if(typeof window.aqaCheckAdminBtn==='function') window.aqaCheckAdminBtn();
    document.getElementById("trafficBadge").classList.remove("show");
    showToast("Mode Admin desactive");
  } else {
    pinBuf="";updateDots();
    document.getElementById("pinOverlay").classList.add("show");
  }
}
function updatePayVis(){
  var vis=document.getElementById("payVisitor");
  var tabs=document.getElementById("adminTabs");
  var userDash=document.getElementById("payUserDashboard");
  /* Toujours masquer l'ancien système adminTabs — le vrai dashboard est adminDashOverlay */
  if(tabs)tabs.style.display="none";
  if(isAdmin){
    /* Admin : masquer tout le front, ouvrir le vrai dashboard admin */
    if(vis)vis.style.display="none";
    if(userDash)userDash.style.display="none";
    renderVisitors();renderStatsAdmin();
    if(typeof openAdminDashboard==="function") openAdminDashboard();
  } else if(window.currentUserUID){
    /* Utilisateur connecté (non-admin) : afficher son dashboard financier personnel */
    if(vis)vis.style.display="none";
    if(userDash)userDash.style.display="block";
    renderUserPayDashboard();
  } else {
    /* Visiteur non connecté : afficher les formules d'abonnement */
    if(vis)vis.style.display="block";
    if(userDash)userDash.style.display="none";
  }
}

/* ══ DASHBOARD FINANCIER PERSONNEL (utilisateur connecté non-admin) ══════════
   Affiche à l'utilisateur connecté :
   — Son établissement lié, statut et formule d'abonnement
   — L'échéance en cours et le nombre de jours restants
   — L'historique de ses paiements
   — Un bouton de renouvellement si proche de l'échéance                     */
function renderUserPayDashboard(){
  var el=document.getElementById("payUserDashboardContent");
  if(!el) return;

  var email=(window.currentUserEmail||"").toLowerCase().trim();
  var pseudo=window.currentUserPseudo||email||"Utilisateur";

  /* ── Trouver l'établissement lié à cet email ── */
  var myEtab=null;
  if(typeof etablissements!=="undefined"){
    myEtab=etablissements.find(function(e){
      return (e.responsable_email||"").toLowerCase().trim()===email ||
             (e.email||"").toLowerCase().trim()===email;
    });
  }

  /* ── Trouver les paiements liés ── */
  var myPayments=[];
  if(typeof paiements!=="undefined" && myEtab){
    myPayments=paiements.filter(function(p){
      return (p.nom||"").toLowerCase()===myEtab.nom.toLowerCase();
    });
  }

  /* ── Calcul de l'échéance ── */
  var echeance=null, joursRestants=null, planLabel="—", planColor="var(--muted)";
  if(myEtab){
    var planType=(myEtab.abonnement_type||"mensuel").toLowerCase();
    var planDurations={mensuel:30, trimestriel:90, annuel:365};
    var duree=planDurations[planType]||30;
    if(planType==="mensuel"){planLabel="Mensuel";planColor="var(--amber)";}
    else if(planType==="trimestriel"){planLabel="Trimestriel";planColor="var(--pink)";}
    else if(planType==="annuel"){planLabel="Annuel";planColor="var(--cyan)";}

    /* Date d'activation */
    var dateActiv=null;
    if(myEtab.abonnement_activated_at){
      dateActiv=new Date(myEtab.abonnement_activated_at);
    } else if(myPayments.length>0){
      /* Dernier paiement confirmé */
      var lastConfirmed=myPayments.filter(function(p){return p.statut==="Confirme";});
      if(lastConfirmed.length>0){
        var parts=(lastConfirmed[lastConfirmed.length-1].date||"").split("/");
        if(parts.length===3) dateActiv=new Date(parts[2],parts[1]-1,parts[0]);
      }
    }
    if(dateActiv){
      echeance=new Date(dateActiv.getTime()+duree*24*3600*1000);
      joursRestants=Math.ceil((echeance.getTime()-Date.now())/(24*3600*1000));
    }
  }

  /* ── Statut de paiement ── */
  var statut=myEtab?(myEtab.paiement||"En attente"):"Non inscrit";
  var isActif=statut.indexOf("Actif")!==-1;
  var statutColor=isActif?"var(--green)":"var(--amber)";
  var statutEmoji=isActif?"✅":"⏳";

  /* ── Alerte échéance ── */
  var alerteEcheance="";
  if(joursRestants!==null){
    if(joursRestants<0){
      alerteEcheance='<div style="background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.35);border-radius:12px;padding:0.9rem;margin-bottom:1rem;text-align:center;">'
        +'<div style="font-size:1.2rem;margin-bottom:0.3rem;">⚠️</div>'
        +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--red);">Abonnement expiré</div>'
        +'<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;">Votre abonnement a expiré il y a '+Math.abs(joursRestants)+' jour(s).</div>'
        +'<div style="font-size:0.72rem;color:var(--muted);margin-top:0.2rem;">Renouvelez pour maintenir votre visibilité.</div>'
        +'</div>';
    } else if(joursRestants<=7){
      alerteEcheance='<div style="background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);border-radius:12px;padding:0.9rem;margin-bottom:1rem;text-align:center;">'
        +'<div style="font-size:1.2rem;margin-bottom:0.3rem;">⏰</div>'
        +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--amber);">Expiration imminente</div>'
        +'<div style="font-size:0.72rem;color:var(--muted);margin-top:0.3rem;">Il vous reste <strong style="color:var(--amber);">'+joursRestants+' jour(s)</strong> avant expiration.</div>'
        +'</div>';
    }
  }

  /* ── Rendu HTML ── */
  var html='';

  /* En-tête */
  html+='<div style="background:rgba(255,45,155,0.07);border:1px solid rgba(255,45,155,0.2);border-radius:16px;padding:1.1rem;margin-bottom:1rem;">';
  html+='<div style="display:flex;align-items:center;gap:0.7rem;margin-bottom:0.5rem;">';
  html+='<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-size:1rem;font-weight:800;color:#fff;flex-shrink:0;">'+(pseudo[0]||"?").toUpperCase()+'</div>';
  html+='<div>';
  html+='<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;color:var(--text);">'+pseudo+'</div>';
  html+='<div style="font-size:0.65rem;color:var(--muted);">'+email+'</div>';
  html+='</div></div>';
  if(myEtab){
    html+='<div style="font-size:0.72rem;color:var(--muted);">🏛️ Établissement lié : <strong style="color:var(--cyan);">'+myEtab.nom+'</strong></div>';
  } else {
    html+='<div style="font-size:0.72rem;color:var(--amber);">⚠️ Aucun établissement lié à ce compte.</div>';
  }
  html+='</div>';

  /* Alerte échéance si proche ou expirée */
  html+=alerteEcheance;

  if(myEtab){
    /* Carte statut + formule */
    html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;">';
    /* Statut */
    html+='<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.8rem;text-align:center;">';
    html+='<div style="font-size:1.3rem;margin-bottom:0.2rem;">'+statutEmoji+'</div>';
    html+='<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;color:'+statutColor+';">'+statut+'</div>';
    html+='<div style="font-size:0.6rem;color:var(--muted);margin-top:0.2rem;">Statut</div>';
    html+='</div>';
    /* Formule */
    html+='<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.8rem;text-align:center;">';
    html+='<div style="font-size:1.3rem;margin-bottom:0.2rem;">📅</div>';
    html+='<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;color:'+planColor+';">'+planLabel+'</div>';
    html+='<div style="font-size:0.6rem;color:var(--muted);margin-top:0.2rem;">Formule</div>';
    html+='</div>';
    html+='</div>';

    /* Carte abonnement premium avec blockclock */
    if(myEtab && typeof ambiRenderSubCard === "function"){
      html += ambiRenderSubCard(myEtab);
    }

    /* Bouton renouveler si expiré ou proche */
    if(joursRestants===null||joursRestants<=14){
      html+='<div style="margin-bottom:1rem;">';
      html+='<a href="https://wa.me/24174450924?text=Bonjour%20AMBI241%2C%20je%20souhaite%20renouveler%20mon%20abonnement%20pour%20'+encodeURIComponent(myEtab.nom)+'." target="_blank" ';
      html+='style="display:flex;align-items:center;justify-content:center;gap:0.5rem;width:100%;padding:0.8rem;border-radius:12px;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;text-decoration:none;box-shadow:0 4px 18px rgba(255,45,155,0.3);">';
      html+='🔄 Renouveler mon abonnement</a>';
      html+='</div>';
    }

    /* Historique des paiements */
    html+='<div style="margin-bottom:0.5rem;">';
    html+='<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--text);margin-bottom:0.7rem;">📋 Historique des paiements</div>';
    if(myPayments.length===0){
      html+='<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px solid rgba(255,255,255,0.06);">Aucun paiement enregistré.</div>';
    } else {
      myPayments.slice().reverse().forEach(function(p){
        var isConfirme=p.statut==="Confirme";
        var sc=isConfirme?"color:var(--green);border-color:rgba(0,255,170,0.3);":"color:var(--amber);border-color:rgba(255,215,0,0.3);";
        html+='<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:0.75rem;margin-bottom:0.45rem;display:flex;align-items:center;justify-content:space-between;">';
        html+='<div>';
        html+='<div style="font-family:Syne,sans-serif;font-weight:700;font-size:0.8rem;color:var(--text);">'+(p.montant||0).toLocaleString("fr-FR")+' XAF</div>';
        html+='<div style="font-size:0.62rem;color:var(--muted);margin-top:0.15rem;">📅 '+(p.date||"—")+'  •  '+(p.mode||"—")+'</div>';
        html+='</div>';
        html+='<span style="font-size:0.68rem;font-weight:700;padding:0.2rem 0.5rem;border-radius:20px;border:1px solid;background:transparent;'+sc+'">'+(isConfirme?"✅ Confirmé":"⏳ En attente")+'</span>';
        html+='</div>';
      });
    }
    html+='</div>';

    /* Contact admin */
    html+='<div style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.12);border-radius:12px;padding:0.9rem;text-align:center;">';
    html+='<div style="font-size:0.7rem;color:var(--muted);margin-bottom:0.5rem;">Une question sur votre abonnement ?</div>';
    html+='<div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">';
    html+='<a href="https://wa.me/24174450924" target="_blank" class="cp-action">💬 WhatsApp</a>';
    html+='<a href="mailto:ambi2412026@gmail.com" class="cp-action">✉️ Email</a>';
    html+='</div></div>';

  } else {
    /* Pas d'établissement lié — rediriger vers inscription */
    html+='<div style="text-align:center;padding:1.5rem;background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.2);border-radius:14px;">';
    html+='<div style="font-size:2rem;margin-bottom:0.6rem;">🏛️</div>';
    html+='<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.92rem;color:var(--amber);margin-bottom:0.4rem;">Inscrivez votre établissement</div>';
    html+='<div style="font-size:0.75rem;color:var(--muted);margin-bottom:1rem;line-height:1.6;">Aucun établissement n\'est lié à votre compte.<br>Contactez-nous pour procéder à l\'inscription.</div>';
    html+='<a href="https://wa.me/24174450924?text=Bonjour%20AMBI241%2C%20je%20souhaite%20inscrire%20mon%20%C3%A9tablissement." target="_blank" ';
    html+='style="display:inline-flex;align-items:center;gap:0.4rem;padding:0.65rem 1.2rem;border-radius:12px;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;text-decoration:none;">';
    html+='💬 Inscrire mon établissement</a>';
    html+='</div>';
  }

  el.innerHTML=html;
  if(typeof _initCountdownElements === "function") _initCountdownElements();
}
window.renderUserPayDashboard=renderUserPayDashboard;

function switchAdminTab(tab){
  var tabs=["paiements","visiteurs","statistiques","contacts","taxipro"];
  tabs.forEach(function(t){
    var btn=document.getElementById("tab"+t.charAt(0).toUpperCase()+t.slice(1));
    var panel=document.getElementById("panel"+t.charAt(0).toUpperCase()+t.slice(1));
    var active=t===tab;
    if(btn){btn.style.background=active?"var(--amber)":"transparent";btn.style.color=active?"#000":"var(--amber)";}
    if(panel)panel.style.display=active?"block":"none";
  });
  /* onglet Son (weeksong) — gestion séparée couleur pink */
  var btnWS=document.getElementById("tabWeekSongAdmin");
  var panelWS=document.getElementById("panelWeekSong");
  var wsActive=tab==="weeksong";
  if(btnWS){btnWS.style.background=wsActive?"rgba(255,45,155,0.2)":"transparent";btnWS.style.color="var(--pink)";btnWS.style.borderColor=wsActive?"var(--pink)":"rgba(255,45,155,0.35)";}
  if(panelWS)panelWS.style.display=wsActive?"block":"none";
  /* onglet Monétisation — couleur amber */
  var btnMo=document.getElementById("tabMonetisation");
  var panelMo=document.getElementById("panelMonetisation");
  var moActive=tab==="monetisation";
  if(btnMo){btnMo.style.background=moActive?"rgba(255,215,0,0.18)":"transparent";btnMo.style.color="var(--amber)";btnMo.style.borderColor=moActive?"var(--amber)":"rgba(255,215,0,0.45)";}
  if(panelMo)panelMo.style.display=moActive?"block":"none";
  /* onglet Social Media */
  var btnSM=document.getElementById("tabSocialMedia");
  var panelSM=document.getElementById("panelSocialMedia");
  var smActive=tab==="socialmedia";
  if(btnSM){btnSM.style.background=smActive?"rgba(225,48,108,0.18)":"transparent";btnSM.style.color="#e1306c";btnSM.style.borderColor=smActive?"#e1306c":"rgba(225,48,108,0.45)";}
  if(panelSM)panelSM.style.display=smActive?"block":"none";
  /* onglet Import Google Maps */
  var btnIG=document.getElementById("tabImportGMaps");
  var panelIG=document.getElementById("panelImportGMaps");
  var igActive=tab==="importgmaps";
  if(btnIG){btnIG.style.background=igActive?"rgba(0,255,170,0.18)":"transparent";btnIG.style.color="var(--green)";btnIG.style.borderColor=igActive?"var(--green)":"rgba(0,255,170,0.45)";}
  if(panelIG){
    panelIG.style.display = igActive ? "block" : "none";
  }
  if(igActive && !window._igmInited) igmInit();
  if(tab==="contacts") renderContactsAdmin();
  if(tab==="taxipro") renderTaxiProTransactions();
  if(tab==="monetisation") renderAdmMonetisation();
  if(tab==="socialmedia") renderSocialMediaAdmin();
  _currentAdmTab = tab;
  /* Persistance Firebase de l'onglet actif */
  try{ localStorage.setItem("ambi241_admTab", tab); }catch(e){}
}

// ── Render admin contacts log panel ──
function renderContactsAdmin(){
  var panel=document.getElementById("contactsAdminPanel");
  if(!panel)return;
  if(!window.db||!window.fbGetDocs||!window.fbCollection){
    panel.innerHTML="<div style='color:var(--muted);font-size:0.8rem;text-align:center;padding:2rem;'>Firebase non disponible</div>";
    return;
  }
  panel.innerHTML="<div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem;'>⏳ Chargement...</div>";
  window.fbGetDocs(window.fbCollection(window.db,"contact_clicks")).then(function(snap){
    var clicks=[];
    snap.forEach(function(doc){ clicks.push(Object.assign({_id:doc.id},doc.data())); });
    clicks.sort(function(a,b){return (b.ts||0)-(a.ts||0);});
    if(!clicks.length){
      panel.innerHTML="<div style='text-align:center;padding:3rem;color:var(--muted);font-size:0.82rem;'>📭 Aucun contact enregistré pour l'instant</div>";
      return;
    }
    var byChannel={whatsapp:0,telephone:0,email:0};
    clicks.forEach(function(c){ byChannel[c.channel]=(byChannel[c.channel]||0)+1; });
    var html="<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem;'>";
    html+="<div style='background:rgba(37,211,102,0.08);border:1px solid rgba(37,211,102,0.25);border-radius:10px;padding:0.7rem;text-align:center;'><div style='font-size:1.3rem;font-weight:800;color:#25d366;'>"+byChannel.whatsapp+"</div><div style='font-size:0.62rem;color:var(--muted);'>💬 WhatsApp</div></div>";
    html+="<div style='background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.25);border-radius:10px;padding:0.7rem;text-align:center;'><div style='font-size:1.3rem;font-weight:800;color:var(--cyan);'>"+byChannel.telephone+"</div><div style='font-size:0.62rem;color:var(--muted);'>📞 Appels</div></div>";
    html+="<div style='background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);border-radius:10px;padding:0.7rem;text-align:center;'><div style='font-size:1.3rem;font-weight:800;color:var(--amber);'>"+byChannel.email+"</div><div style='font-size:0.62rem;color:var(--muted);'>✉️ Emails</div></div>";
    html+="</div>";
    html+="<div style='font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem;'>📋 Historique ("+clicks.length+" entrées)</div>";
    html+="<div style='display:flex;flex-direction:column;gap:0.5rem;'>";
    clicks.slice(0,50).forEach(function(c){
      var chIcon={whatsapp:"💬",telephone:"📞",email:"✉️"}[c.channel]||"📲";
      var chColor={whatsapp:"#25d366",telephone:"var(--cyan)",email:"var(--amber)"}[c.channel]||"var(--muted)";
      var dt=c.ts ? new Date(c.ts).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
      html+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.75rem 0.9rem;'>";
      html+="<div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.3rem;'>";
      html+="<span style='font-size:0.82rem;font-weight:700;color:var(--text);'>"+chIcon+" "+escHtml(c.etabNom||"—")+"</span>";
      html+="<span style='font-size:0.62rem;color:var(--muted);'>"+dt+"</span></div>";
      html+="<div style='display:flex;gap:0.5rem;flex-wrap:wrap;font-size:0.68rem;'>";
      html+="<span style='color:"+chColor+";font-weight:700;border:1px solid;border-color:"+chColor+";border-radius:5px;padding:0.08rem 0.35rem;'>"+c.channel+"</span>";
      html+="<span style='color:var(--muted);'>👤 "+escHtml(c.pseudo||c.email||"Anonyme")+"</span>";
      if(c.email && c.email!=="non connecté") html+="<span style='color:var(--cyan);'>"+escHtml(c.email)+"</span>";
      html+="</div></div>";
    });
    html+="</div>";
    if(clicks.length>50) html+="<div style='text-align:center;color:var(--muted);font-size:0.72rem;padding:0.8rem;'>... et "+(clicks.length-50)+" entrées supplémentaires</div>";
    panel.innerHTML=html;
  }).catch(function(err){
    panel.innerHTML="<div style='color:var(--red);font-size:0.8rem;padding:1rem;'>Erreur : "+err.message+"</div>";
  });
}
window.renderContactsAdmin = renderContactsAdmin;

function renderVisitors(){
  var t=getTraffic();
  var total=t.total||0;
  var today=t.count||0;

  var panel=document.getElementById("visitorsPanel");
  if(!panel) return;

  // Compteurs locaux (trafic session courant)
  var html="";
  html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1rem;'>";
  html+="<div style='background:rgba(0,255,170,0.06);border:1px solid rgba(0,255,170,0.2);border-radius:12px;padding:0.9rem;text-align:center;'>";
  html+="<div style='font-size:1.6rem;font-family:Syne,sans-serif;font-weight:800;color:var(--green);'>"+today+"</div>";
  html+="<div style='font-size:0.7rem;color:var(--muted);'>Vues aujourd'hui</div></div>";
  html+="<div style='background:rgba(204,68,255,0.06);border:1px solid rgba(204,68,255,0.2);border-radius:12px;padding:0.9rem;text-align:center;'>";
  html+="<div style='font-size:1.6rem;font-family:Syne,sans-serif;font-weight:800;color:var(--purple);'>"+total+"</div>";
  html+="<div style='font-size:0.7rem;color:var(--muted);'>Total cumulé</div></div></div>";

  html+="<div id='visitorsFirebaseData'><div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.82rem;'>⏳ Chargement des connexions…</div></div>";
  panel.innerHTML=html;

  // Charger les vraies données depuis Firestore connection_logs
  if(!window.db || !window.fbGetDocs || !window.fbCollection){
    document.getElementById("visitorsFirebaseData").innerHTML="<div style='text-align:center;padding:1.5rem;color:var(--muted);font-size:0.78rem;'>Firebase non disponible</div>";
    return;
  }

  window.fbGetDocs(window.fbCollection(window.db,"connection_logs")).then(function(snap){
    var logs=[];
    snap.forEach(function(d){ logs.push(d.data()); });

    var fbHtml="";

    if(!logs.length){
      fbHtml="<div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.82rem;'>📭 Aucune connexion enregistrée pour l'instant</div>";
      document.getElementById("visitorsFirebaseData").innerHTML=fbHtml;
      return;
    }

    // Compteur membres connectés
    fbHtml+="<div style='background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.15);border-radius:12px;padding:0.9rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;'>";
    fbHtml+="<div style='font-size:0.8rem;font-weight:700;color:var(--cyan);'>👤 Membres connectés (total Firebase)</div>";
    fbHtml+="<div style='font-family:Syne,sans-serif;font-weight:800;font-size:1.3rem;color:var(--cyan);'>"+logs.length+"</div></div>";

    // Fréquences par timezone
    var tzMap={};
    logs.forEach(function(l){
      var tz = l.timezone || "Inconnue";
      tzMap[tz]=(tzMap[tz]||0)+1;
    });
    var tzList=Object.entries(tzMap).sort(function(a,b){return b[1]-a[1];}).slice(0,6);
    if(tzList.length){
      fbHtml+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🌍 Fuseaux horaires</div>";
      fbHtml+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:0.9rem;margin-bottom:1rem;'>";
      tzList.forEach(function(tz){
        var pct=Math.round((tz[1]/logs.length)*100);
        fbHtml+="<div style='margin-bottom:0.6rem;'>";
        fbHtml+="<div style='display:flex;justify-content:space-between;margin-bottom:0.2rem;'>";
        fbHtml+="<span style='font-size:0.78rem;color:var(--text);'>"+tz[0]+"</span>";
        fbHtml+="<span style='font-size:0.74rem;font-weight:700;color:var(--amber);'>"+tz[1]+" ("+pct+"%)</span></div>";
        fbHtml+="<div style='height:4px;background:rgba(255,255,255,0.06);border-radius:2px;overflow:hidden;'>";
        fbHtml+="<div style='height:100%;width:"+pct+"%;background:var(--amber);border-radius:2px;'></div></div></div>";
      });
      fbHtml+="</div>";
    }

    // Appareils
    var devMap={Mobile:0, Desktop:0, Tablette:0, Inconnu:0};
    logs.forEach(function(l){
      var ua=(l.userAgent||"").toLowerCase();
      if(ua.indexOf("mobile")!==-1||ua.indexOf("android")!==-1||ua.indexOf("iphone")!==-1) devMap.Mobile++;
      else if(ua.indexOf("tablet")!==-1||ua.indexOf("ipad")!==-1) devMap.Tablette++;
      else if(ua.length>10) devMap.Desktop++;
      else devMap.Inconnu++;
    });
    fbHtml+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--cyan);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>📱 Appareils</div>";
    fbHtml+="<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem;'>";
    [{k:"Mobile",ic:"📱",c:"var(--pink)"},{k:"Desktop",ic:"💻",c:"var(--cyan)"},{k:"Tablette",ic:"📟",c:"var(--purple)"}].forEach(function(d){
      var n=devMap[d.k];
      var pct=logs.length>0?Math.round((n/logs.length)*100):0;
      fbHtml+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.7rem;text-align:center;'>";
      fbHtml+="<div style='font-size:1.1rem;'>"+d.ic+"</div>";
      fbHtml+="<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.95rem;color:"+d.c+";'>"+pct+"%</div>";
      fbHtml+="<div style='font-size:0.62rem;color:var(--muted);'>"+d.k+"</div></div>";
    });
    fbHtml+="</div>";

    // Langues navigateur
    var langMap={};
    logs.forEach(function(l){
      var lang=(l.language||"").split("-")[0]||"?";
      langMap[lang]=(langMap[lang]||0)+1;
    });
    var langList=Object.entries(langMap).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
    if(langList.length>1){
      fbHtml+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🗣️ Langues navigateur</div>";
      fbHtml+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:0.9rem;margin-bottom:1rem;'>";
      langList.forEach(function(l){
        var pct=Math.round((l[1]/logs.length)*100);
        fbHtml+="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;'>";
        fbHtml+="<span style='font-size:0.78rem;color:var(--text);text-transform:uppercase;'>"+l[0]+"</span>";
        fbHtml+="<span style='font-size:0.74rem;font-weight:700;color:var(--green);'>"+l[1]+" ("+pct+"%)</span></div>";
      });
      fbHtml+="</div>";
    }

    // Résolution écran
    var resMap={};
    logs.forEach(function(l){
      var r=l.screenRes||"Inconnue";
      resMap[r]=(resMap[r]||0)+1;
    });
    var resList=Object.entries(resMap).sort(function(a,b){return b[1]-a[1];}).slice(0,4);
    if(resList.length){
      fbHtml+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🖥️ Résolutions</div>";
      fbHtml+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:0.9rem;margin-bottom:1rem;'>";
      resList.forEach(function(r){
        fbHtml+="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;'>";
        fbHtml+="<span style='font-size:0.78rem;color:var(--text);'>"+r[0]+"</span>";
        fbHtml+="<span style='font-size:0.74rem;font-weight:700;color:var(--purple);'>"+r[1]+" connexion"+(r[1]>1?"s":"")+"</span></div>";
      });
      fbHtml+="</div>";
    }

    // Connexions récentes
    var sorted=logs.slice().sort(function(a,b){return (b.connectedAtMs||0)-(a.connectedAtMs||0);}).slice(0,10);
    fbHtml+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🕐 10 Dernières connexions</div>";
    fbHtml+="<div style='display:flex;flex-direction:column;gap:0.4rem;'>";
    sorted.forEach(function(l){
      var dt=l.connectedAtMs ? new Date(l.connectedAtMs).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "—";
      fbHtml+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.6rem 0.8rem;display:flex;justify-content:space-between;align-items:center;'>";
      fbHtml+="<div><div style='font-size:0.8rem;font-weight:700;color:var(--text);'>"+escHtml(l.pseudo||l.email||"Membre")+"</div>";
      fbHtml+="<div style='font-size:0.62rem;color:var(--muted);'>"+escHtml(l.timezone||"")+"</div></div>";
      fbHtml+="<span style='font-size:0.62rem;color:var(--muted);'>"+dt+"</span></div>";
    });
    fbHtml+="</div>";

    document.getElementById("visitorsFirebaseData").innerHTML=fbHtml;
  }).catch(function(err){
    document.getElementById("visitorsFirebaseData").innerHTML="<div style='color:var(--red);font-size:0.8rem;padding:1rem;'>Erreur Firestore : "+err.message+"</div>";
  });
}

function renderStatsAdmin(){
  var d=etablissements;
  var actifs=d.length;
  var inactifs=0;
  var bondes=d.filter(function(e){return e.statut&&e.statut.indexOf("Bonde")!==-1;}).length;
  var animes=d.filter(function(e){return e.statut&&e.statut.indexOf("Anime")!==-1;}).length;
  var calmes=d.filter(function(e){return e.statut&&e.statut.indexOf("Calme")!==-1;}).length;
  var avgNote=(d.reduce(function(s,e){return s+(e.note||0);},0)/Math.max(d.length,1)).toFixed(1);
  var avgAff=(d.reduce(function(s,e){return s+(e.affluence||0);},0)/Math.max(d.length,1)).toFixed(0);
  var t=getTraffic();
  var rev=paiements.reduce(function(s,p){return s+(p.statut==="Confirme"?p.montant:0);},0);

  var catStats={};
  d.forEach(function(e){var c=getCategory(e.type||"");catStats[c]=(catStats[c]||0)+1;});

  var html="";
  // KPIs
  html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1rem;'>";
  var kpis=[
    {v:d.length,l:"Lieux total",c:"var(--pink)"},
    {v:actifs,l:"Actifs",c:"var(--green)"},
    {v:avgNote+"★",l:"Note moy.",c:"var(--amber)"},
    {v:avgAff+"%",l:"Affluence moy.",c:"var(--cyan)"}
  ];
  kpis.forEach(function(k){
    html+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.85rem;text-align:center;'>";
    html+="<div style='font-size:1.45rem;font-family:Syne,sans-serif;font-weight:800;color:"+k.c+";'>"+k.v+"</div>";
    html+="<div style='font-size:0.68rem;color:var(--muted);'>"+k.l+"</div></div>";
  });
  html+="</div>";

  // Revenus
  html+="<div style='background:rgba(0,255,170,0.05);border:1px solid rgba(0,255,170,0.15);border-radius:14px;padding:1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center;'>";
  html+="<div><div style='font-family:Syne,sans-serif;font-weight:700;color:var(--green);font-size:0.88rem;'>💰 Revenus confirmes</div><div style='font-size:0.72rem;color:var(--muted);margin-top:0.2rem;'>"+actifs+" etablissements actifs</div></div>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:800;font-size:1.2rem;color:var(--green);'>"+rev.toLocaleString("fr-FR")+" XAF</div></div>";

  // Ambiances
  html+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--pink);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🔴 Ambiances en direct</div>";
  html+="<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem;'>";
  var ambs=[{v:bondes,l:"Bondés",c:"#ff4466"},{v:animes,l:"Animés",c:"var(--green)"},{v:calmes,l:"Calmes",c:"var(--amber)"}];
  ambs.forEach(function(a){
    html+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.7rem;text-align:center;'>";
    html+="<div style='font-size:1.2rem;font-weight:800;font-family:Syne,sans-serif;color:"+a.c+";'>"+a.v+"</div>";
    html+="<div style='font-size:0.65rem;color:var(--muted);'>"+a.l+"</div></div>";
  });
  html+="</div>";

  // Catégories
  html+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:var(--purple);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>📊 Par catégorie</div>";
  html+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:0.9rem;'>";
  CATEGORIES.forEach(function(cat){
    var n=catStats[cat.key]||0;
    var pct=d.length>0?Math.round((n/d.length)*100):0;
    html+="<div style='display:flex;align-items:center;gap:0.6rem;margin-bottom:0.5rem;'>";
    html+="<span style='font-size:0.9rem;width:22px;text-align:center;'>"+cat.icon+"</span>";
    html+="<div style='flex:1;'><div style='display:flex;justify-content:space-between;margin-bottom:0.2rem;'><span style='font-size:0.78rem;color:var(--text);'>"+cat.label+"</span><span style='font-size:0.72rem;color:var(--muted);'>"+n+" ("+pct+"%)</span></div>";
    html+="<div style='height:4px;background:rgba(255,255,255,0.06);border-radius:2px;'><div style='height:100%;width:"+pct+"%;background:var(--purple);border-radius:2px;'></div></div></div></div>";
  });
  html+="</div>";

  var panel=document.getElementById("statsAdminPanel");
  if(panel)panel.innerHTML=html;

  // ── Charger les stats de contacts depuis Firebase ──
  if(window.db && window.fbGetDocs && window.fbCollection){
    window.fbGetDocs(window.fbCollection(window.db,"contact_clicks")).then(function(snap){
      var clicks=[];
      snap.forEach(function(doc){ clicks.push(doc.data()); });
      if(!clicks.length)return;
      var byChannel={whatsapp:0,telephone:0,email:0};
      var byEtab={};
      clicks.forEach(function(c){
        byChannel[c.channel]=(byChannel[c.channel]||0)+1;
        byEtab[c.etabNom]=(byEtab[c.etabNom]||0)+1;
      });
      var topEtabs=Object.entries(byEtab).sort(function(a,b){return b[1]-a[1];}).slice(0,5);
      var chHtml="<div style='margin-top:1rem;'>";
      chHtml+="<div style='font-family:Syne,sans-serif;font-size:0.72rem;font-weight:700;color:#25d366;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>📲 Contacts cliqués ("+clicks.length+" total)</div>";
      chHtml+="<div style='display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.8rem;'>";
      chHtml+="<div style='background:rgba(37,211,102,0.07);border:1px solid rgba(37,211,102,0.2);border-radius:10px;padding:0.7rem;text-align:center;'><div style='font-size:1.1rem;font-weight:800;color:#25d366;'>"+byChannel.whatsapp+"</div><div style='font-size:0.62rem;color:var(--muted);'>WhatsApp</div></div>";
      chHtml+="<div style='background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);border-radius:10px;padding:0.7rem;text-align:center;'><div style='font-size:1.1rem;font-weight:800;color:var(--cyan);'>"+byChannel.telephone+"</div><div style='font-size:0.62rem;color:var(--muted);'>Téléphone</div></div>";
      chHtml+="<div style='background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:10px;padding:0.7rem;text-align:center;'><div style='font-size:1.1rem;font-weight:800;color:var(--amber);'>"+byChannel.email+"</div><div style='font-size:0.62rem;color:var(--muted);'>Email</div></div>";
      chHtml+="</div>";
      if(topEtabs.length){
        chHtml+="<div style='font-size:0.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.4rem;'>🏆 Top établissements contactés</div>";
        chHtml+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0.8rem;'>";
        topEtabs.forEach(function(e,i){
          chHtml+="<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;'>";
          chHtml+="<span style='font-size:0.78rem;color:var(--text);'>"+["🥇","🥈","🥉","4️⃣","5️⃣"][i]+" "+e[0]+"</span>";
          chHtml+="<span style='font-size:0.75rem;font-weight:700;color:var(--pink);'>"+e[1]+" clic"+(e[1]>1?"s":"")+"</span></div>";
        });
        chHtml+="</div>";
      }
      chHtml+="</div>";
      if(panel) panel.innerHTML += chHtml;
    }).catch(function(){});
  }
}

// USER ACCOUNT
function switchUserTab(tab){
  document.getElementById("tabConnexion").classList.toggle("active",tab==="connexion");
  document.getElementById("tabInscription").classList.toggle("active",tab==="inscription");
  document.getElementById("tabMonProfil").classList.toggle("active",tab==="monprofil");
  document.getElementById("formConnexion").style.display=tab==="connexion"?"block":"none";
  document.getElementById("formInscription").style.display=tab==="inscription"?"block":"none";
  document.getElementById("formMonProfil").style.display=tab==="monprofil"?"block":"none";
  if(tab==="monprofil") _renderMyProfileTab();
}
/* ══════════════════════════════════════════════════════════════════
   PROFIL UTILISATEUR — Mon Profil + Photo + Profil visitable
   ══════════════════════════════════════════════════════════════════ */

// Cache avatar en mémoire { uid: url }
var _userAvatarCache = {};

// Charger l'avatar d'un utilisateur depuis Firestore
function loadUserAvatar(uid, cb){
  if(!uid){ if(cb) cb(null); return; }
  if(_userAvatarCache[uid] !== undefined){ if(cb) cb(_userAvatarCache[uid]); return; }
  if(!window.db){ if(cb) cb(null); return; }
  window.fbGetDoc(window.fbDoc(window.db,"users",uid)).then(function(snap){
    var url = snap.exists() ? (snap.data().avatarUrl||null) : null;
    _userAvatarCache[uid] = url;
    if(cb) cb(url);
  }).catch(function(){ _userAvatarCache[uid]=null; if(cb) cb(null); });
}

// Rendre l'onglet Mon Profil
function _renderMyProfileTab(){
  var uid    = window.currentUserUID;
  var email  = window.currentUserEmail||"";
  var pseudo = window.currentUserPseudo||"";
  var initiale = (pseudo||email||"?")[0].toUpperCase();

  // Pseudo & email
  var el = document.getElementById("myProfilePseudo");
  if(el) el.textContent = pseudo||email;
  var el2 = document.getElementById("myProfileEmail");
  if(el2) el2.textContent = email;

  // Badges (admin + établissement)
  var badge = document.getElementById("myProfileBadge");
  if(badge){
    var badgeHtml = '';
    if(isAdmin) badgeHtml += '<span style="font-size:0.62rem;font-weight:700;background:rgba(255,215,0,0.15);color:var(--amber);padding:0.18rem 0.55rem;border-radius:20px;border:1px solid rgba(255,215,0,0.35);">🔑 Admin</span>';
    var myEtab = etablissements.find(function(e){ return e.responsable_email===email; });
    if(myEtab) badgeHtml += '<span style="font-size:0.62rem;font-weight:700;background:rgba(0,229,255,0.1);color:var(--cyan);padding:0.18rem 0.55rem;border-radius:20px;border:1px solid rgba(0,229,255,0.25);">🏠 Gérant</span>';
    badge.innerHTML = badgeHtml;
  }

  // Infos depuis Firestore
  if(uid && window.db){
    window.fbGetDoc(window.fbDoc(window.db,"users",uid)).then(function(snap){
      var d = snap.exists() ? snap.data() : {};
      var rows = "";
      // Ligne email
      rows += _profileRow("✉️","Email",email||"—");
      if(d.tel) rows += _profileRow("📞","Téléphone",d.tel);
      if(d.dob) rows += _profileRow("🎂","Date de naissance",new Date(d.dob).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"}));
      if(d.createdAt) rows += _profileRow("📅","Membre depuis",new Date(d.createdAt).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"}));
      var infoEl = document.getElementById("myProfileInfoRows");
      if(infoEl) infoEl.innerHTML = rows||'<div style="font-size:0.78rem;color:var(--muted);text-align:center;">Aucune info supplémentaire</div>';

      // Établissement
      var etab = etablissements.find(function(e){ return e.responsable_email===email; });
      var etabSec = document.getElementById("mpEtabSection");
      var etabInfo = document.getElementById("mpEtabInfo");
      if(etab && etabSec && etabInfo){
        etabSec.style.display="block";
        etabInfo.innerHTML = '<div style="display:flex;align-items:center;gap:0.6rem;">'
          +'<span style="font-size:1.4rem;">'+( etab.photo_interieur || etab.photo_exterieur ? '' : '🏠')+'</span>'
          +'<div><div style="font-weight:700;color:var(--text);">'+escHtml(etab.nom)+'</div>'
          +'<div style="font-size:0.68rem;color:var(--muted);">'+escHtml(etab.type)+' · '+escHtml(etab.quartier||'')+'</div></div></div>';
      }

      // Badges section
      var badges = [];
      if(isAdmin) badges.push({icon:'🔑',label:'Admin',col:'var(--amber)',bg:'rgba(255,215,0,0.12)',brd:'rgba(255,215,0,0.3)'});
      if(etab) badges.push({icon:'🏠',label:'Gérant',col:'var(--cyan)',bg:'rgba(0,229,255,0.1)',brd:'rgba(0,229,255,0.25)'});
      if(d.verified) badges.push({icon:'✅',label:'Vérifié',col:'var(--green)',bg:'rgba(0,255,170,0.1)',brd:'rgba(0,255,170,0.25)'});
      if(d.createdAt && Date.now()-d.createdAt>86400000*30) badges.push({icon:'⭐',label:'Fidèle',col:'var(--purple)',bg:'rgba(204,68,255,0.1)',brd:'rgba(204,68,255,0.25)'});
      var badgeSec = document.getElementById("mpBadgesSection");
      var badgeList = document.getElementById("mpBadgesList");
      if(badges.length && badgeSec && badgeList){
        badgeSec.style.display="block";
        badgeList.innerHTML = badges.map(function(b){
          return '<span style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.3rem 0.65rem;border-radius:20px;background:'+b.bg+';border:1px solid '+b.brd+';color:'+b.col+';font-size:0.7rem;font-weight:700;">'+b.icon+' '+b.label+'</span>';
        }).join('');
      }
    }).catch(function(){});
  }

  // Avatar
  _renderMyAvatar(uid, initiale);
  
  // Photos de profil et d'identité
  setTimeout(function() { _renderUserPhotosUI(); }, 200);
}

function _renderMyAvatar(uid, initiale){
  var wrap = document.getElementById("myAvatarWrap");
  if(!wrap) return;
  loadUserAvatar(uid, function(url){
    if(url){
      var safeInit = escHtml(initiale||"?");
      var img = new Image();
      img.onload = function(){
        wrap.innerHTML = '<img src="'+url+'" style="width:74px;height:74px;border-radius:50%;object-fit:cover;display:block;">';
        _refreshQuickbarAvatar(url, initiale);
      };
      img.onerror = function(){
        // URL invalide ou expirée → fallback initiales + vider le cache
        _userAvatarCache[uid] = null;
        wrap.innerHTML = '<div class="user-avatar-initiale">'+safeInit+'</div>';
        _refreshQuickbarAvatar(null, initiale);
      };
      img.src = url;
    } else {
      wrap.innerHTML = '<div class="user-avatar-initiale">'+escHtml(initiale||"?")+'</div>';
      // Mettre à jour aussi le quickbar
      _refreshQuickbarAvatar(null, initiale);
    }
  });
}

function _refreshQuickbarAvatar(url, initiale){
  // 1. Quickbar (barre de publication)
  var qba = document.getElementById("pubQuickbarAvatar");
  if(qba){
    if(url){
      qba.innerHTML = '<img src="'+url+'" style="width:34px;height:34px;border-radius:50%;object-fit:cover;display:block;">';
      qba.style.background="none"; qba.style.padding="0";
    } else {
      qba.textContent = (initiale||"?");
      qba.style.background=""; qba.style.padding="";
    }
  }
  // 2. Mini-avatar header
  _updateHeaderThumb(url, initiale);
}

// Déclencher le sélecteur de fichier
function triggerAvatarUpload(){
  var inp = document.getElementById("avatarFileInput");
  if(inp) inp.click();
}
window.triggerAvatarUpload = triggerAvatarUpload;

// Upload avatar sélectionné
function onAvatarFileSelected(input){
  var file = input.files && input.files[0];
  if(file) _processAvatarFile(file);
  input.value = "";
}
window.onAvatarFileSelected = onAvatarFileSelected;

// Traitement fichier avatar (commun clic + drag-drop)
// ── Méthode : FileReader → canvas → base64 → Firestore (pas de Firebase Storage)
// ── Identique à adminDefaultPhotoSelected() qui fonctionne bien
function _processAvatarFile(file){
  if(!file) return;
  var isImgType = file.type.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|heic|heif|avif|bmp|tiff?|svg|ico)$/i.test(file.name);
  if(!isImgType){ _setAvatarStatus("error","❌ Fichier non reconnu comme image"); return; }
  if(file.size > 10*1024*1024){ _setAvatarStatus("error","❌ Image trop grande (max 10 Mo)"); return; }
  var uid = window.currentUserUID;
  if(!uid){ _setAvatarStatus("error","❌ Connectez-vous d'abord"); return; }
  _setAvatarStatus("uploading","⏳ Traitement en cours…");

  var reader = new FileReader();
  reader.onload = function(ev){
    var img = new Image();
    img.onload = function(){
      var canvas = document.createElement("canvas");
      var MAX = 240;
      var w = img.width, h = img.height;
      var ratio = Math.min(MAX/w, MAX/h, 1);
      canvas.width  = Math.round(w * ratio);
      canvas.height = Math.round(h * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      var dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      // Sauvegarder directement en base64 dans Firestore (même méthode que admin)
      (window.fbSetDoc ? window.fbSetDoc(window.fbDoc(window.db,"users",uid),{ avatarUrl: dataUrl },{merge:true}) : window.fbUpdateDoc(window.fbDoc(window.db,"users",uid),{ avatarUrl: dataUrl }))
        .then(function(){
          _userAvatarCache[uid] = dataUrl;
          var pseudo = window.currentUserPseudo||window.currentUserEmail||"?";
          var initiale = (pseudo||"?")[0].toUpperCase();
          _renderMyAvatar(uid, initiale);
          _setAvatarStatus("success","✅ Photo mise à jour !");
          setTimeout(function(){ _setAvatarStatus("",""); }, 3500);
          showToast("📷 Photo de profil mise à jour !");
        })
        .catch(function(e){
          _setAvatarStatus("error","❌ Erreur : "+(e.message||""));
        });
    };
    img.onerror = function(){ _setAvatarStatus("error","❌ Image invalide"); };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}
window._processAvatarFile = _processAvatarFile;

// Afficher le statut upload
function _setAvatarStatus(type, msg){
  var el = document.getElementById("avatarUploadStatus");
  if(!el) return;
  el.textContent = msg;
  el.style.color = type==="error" ? "var(--red)" : type==="success" ? "var(--green)" : "var(--cyan)";
}

// Initialiser drag-and-drop sur la zone avatar
(function initAvatarDragDrop(){
  document.addEventListener("DOMContentLoaded", function(){
    var zone = document.getElementById("avatarDropArea");
    if(!zone) return;
    zone.addEventListener("dragover", function(e){
      e.preventDefault();
      zone.classList.add("drag-over");
    });
    zone.addEventListener("dragleave", function(){
      zone.classList.remove("drag-over");
    });
    zone.addEventListener("drop", function(e){
      e.preventDefault();
      zone.classList.remove("drag-over");
      var file = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if(file) _processAvatarFile(file);
    });
  });
})();

// Modifier le pseudo
function openEditPseudoModal(){
  var uid = window.currentUserUID;
  if(!uid){ showToast("Non connecté"); return; }
  var cur = window.currentUserPseudo||"";
  var pseudo = prompt("Nouveau pseudo (max 30 caractères) :", cur);
  if(!pseudo || pseudo.trim()===cur.trim()) return;
  pseudo = pseudo.trim().substring(0,30);
  (window.fbSetDoc ? window.fbSetDoc(window.fbDoc(window.db,"users",uid),{ pseudo: pseudo },{merge:true}) : window.fbUpdateDoc(window.fbDoc(window.db,"users",uid),{ pseudo: pseudo })).then(function(){
    window.currentUserPseudo = pseudo;
    updateHeaderUser(pseudo);
    _renderMyProfileTab();
    showToast("✅ Pseudo mis à jour !");
  }).catch(function(e){ showToast("Erreur : "+e.message); });
}
window.openEditPseudoModal = openEditPseudoModal;

function closeUserModal(){document.getElementById("userOverlay").classList.remove("show");}

// ── Quitter l'application (suppression compte membre) ──────────
function openLeaveAppModal(){
  var overlay = document.getElementById("leaveAppOverlay");
  if(!overlay) return;
  // Reset
  document.querySelectorAll("input[name='leaveMotif']").forEach(function(r){ r.checked = false; });
  var ta = document.getElementById("leaveMotifAutre");
  if(ta){ ta.value = ""; ta.style.display = "none"; }
  var pw = document.getElementById("leaveAppPassword");
  if(pw) pw.value = "";
  var err = document.getElementById("leaveAppPassErr");
  if(err) err.textContent = "";
  var btn = document.getElementById("leaveAppConfirmBtn");
  if(btn){ btn.disabled = false; btn.textContent = "\uD83D\uDDD1\uFE0F Supprimer mon compte définitivement"; }
  // Afficher textarea si motif "autre"
  document.querySelectorAll("input[name='leaveMotif']").forEach(function(r){
    r.addEventListener("change", function(){
      if(ta) ta.style.display = this.value === "autre" ? "block" : "none";
    });
  });
  overlay.style.display = "flex";
}
function closeLeaveAppModal(){
  var overlay = document.getElementById("leaveAppOverlay");
  if(overlay) overlay.style.display = "none";
}
async function confirmLeaveApp(){
  var uid   = window.currentUserUID;
  var email = window.currentUserEmail;
  if(!uid || !email){ showToast("Non connecté."); return; }

  // Motif
  var motifEl = document.querySelector("input[name='leaveMotif']:checked");
  if(!motifEl){ document.getElementById("leaveAppPassErr").textContent = "Veuillez choisir un motif."; return; }
  var motif = motifEl.value;
  var ta = document.getElementById("leaveMotifAutre");
  var motifDetail = (ta && motif === "autre") ? (ta.value.trim() || "") : "";

  // Mot de passe
  var pw = (document.getElementById("leaveAppPassword")||{}).value || "";
  if(!pw){ document.getElementById("leaveAppPassErr").textContent = "Mot de passe requis."; return; }

  var btn = document.getElementById("leaveAppConfirmBtn");
  if(btn){ btn.disabled = true; btn.textContent = "⏳ Suppression en cours..."; }
  document.getElementById("leaveAppPassErr").textContent = "";

  try {
    // Ré-authentification Firebase
    var { EmailAuthProvider, reauthenticateWithCredential } = await import("https://www.gstatic.com/firebasejs/10.12.1/firebase-auth.js");
    var user = window.fbAuth && window.fbAuth.currentUser;
    if(!user) throw new Error("Session expirée, reconnectez-vous.");
    var cred = EmailAuthProvider.credential(email, pw);
    await reauthenticateWithCredential(user, cred);

    // Enregistrer le motif dans Firebase avant suppression
    if(window.db && window.fbAddDoc && window.fbCollection){
      try {
        await window.fbAddDoc(window.fbCollection(window.db, "departures"), {
          uid: uid, email: email,
          pseudo: window.currentUserPseudo || "",
          motif: motif, motifDetail: motifDetail,
          timestamp: Date.now()
        });
      } catch(e2){}
    }

    // Supprimer le document Firestore de l'utilisateur
    if(window.db && window.fbDeleteDoc && window.fbDoc){
      try { await window.fbDeleteDoc(window.fbDoc(window.db, "users", uid)); } catch(e3){}
    }

    // Supprimer le compte Firebase Auth
    await user.delete();

    // Nettoyage local
    closeLeaveAppModal();
    showToast("✅ Compte supprimé. À bientôt !");
    setTimeout(function(){ window.location.reload(); }, 1800);

  } catch(err){
    var msg = err.code === "auth/wrong-password" || err.code === "auth/invalid-credential"
      ? "Mot de passe incorrect."
      : (err.message || "Erreur inconnue.");
    document.getElementById("leaveAppPassErr").textContent = "❌ " + msg;
    if(btn){ btn.disabled = false; btn.textContent = "\uD83D\uDDD1\uFE0F Supprimer mon compte définitivement"; }
  }
}
window.openLeaveAppModal  = openLeaveAppModal;
window.closeLeaveAppModal = closeLeaveAppModal;
window.confirmLeaveApp    = confirmLeaveApp;

/* ═══════════════════════════════════════════════════════
   INSCRIPTION : type sélection + photos + pièce identité
   ═══════════════════════════════════════════════════════ */
var _regType = 'membre'; // 'membre' | 'gerant' | 'chauffeur'
var _regPhotoB64 = ''; // base64 photo profil
var _regIdB64    = ''; // base64 pièce identité

function regSelectType(type){
  _regType = type;
  var tiles = {
    'membre':   {id:'regTileMembre',   border:'var(--cyan)',   bg:'rgba(0,229,255,0.1)'},
    'gerant':   {id:'regTileGerant',   border:'var(--pink)',   bg:'rgba(255,45,155,0.1)'},
    'chauffeur':{id:'regTileChauffeur',border:'var(--amber)',  bg:'rgba(157,132,255,0.1)'}
  };
  Object.keys(tiles).forEach(function(k){
    var el = document.getElementById(tiles[k].id);
    if(!el) return;
    if(k === type){
      el.style.borderColor = tiles[k].border;
      el.style.background  = tiles[k].bg;
    } else {
      el.style.borderColor = 'rgba(255,255,255,0.1)';
      el.style.background  = 'rgba(255,255,255,0.03)';
    }
  });
  document.getElementById('regSectionGerant').style.display    = (type==='gerant')    ? 'block' : 'none';
  document.getElementById('regSectionChauffeur').style.display = (type==='chauffeur') ? 'block' : 'none';
  // Rendre la pièce obligatoire pour chauffeur
  var reqLabel = document.getElementById('regIdRequired');
  if(reqLabel){
    if(type==='chauffeur'){
      reqLabel.textContent = '(obligatoire)';
      reqLabel.style.color = 'var(--red)';
    } else {
      reqLabel.textContent = '(recommandée)';
      reqLabel.style.color = 'var(--muted)';
    }
  }
  // Sync ancien champ compat
  var dc = document.getElementById('regDriverCheck');
  if(dc) dc.checked = (type === 'chauffeur');
}

function regOnPhotoSelected(input){
  var file = input.files && input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    _regPhotoB64 = e.target.result;
    var preview = document.getElementById('regPhotoPreview');
    preview.innerHTML = '<img src="'+_regPhotoB64+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">';
    preview.style.border = '2px solid var(--cyan)';
    document.getElementById('regPhotoName').textContent = '✅ ' + file.name;
    document.getElementById('regPhotoName').style.color = 'var(--green)';
  };
  reader.readAsDataURL(file);
}

function regOnIdSelected(input){
  var file = input.files && input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(e){
    _regIdB64 = e.target.result;
    // Preview
    var dropContent = document.getElementById('regIdDropContent');
    var previewImg  = document.getElementById('regIdPreviewImg');
    var fileName    = document.getElementById('regIdFileName');
    if(previewImg){
      previewImg.src   = _regIdB64;
      previewImg.style.display = 'block';
    }
    if(dropContent) dropContent.style.display = 'none';
    if(fileName){
      fileName.textContent = '✅ ' + file.name;
      fileName.style.display = 'block';
    }
    var zone = document.getElementById('regIdDropZone');
    if(zone){ zone.style.borderColor='rgba(0,255,170,0.5)'; zone.style.background='rgba(0,255,170,0.04)'; }
  };
  reader.readAsDataURL(file);
}

function regUpdateIdTypeLabel(){
  // met à jour l'icône dans la zone drop selon le type choisi
}

function registerUser(){
  var pseudo  = document.getElementById("regPseudo").value.trim();
  var email   = document.getElementById("regEmail").value.trim();
  var tel     = document.getElementById("regTel").value.trim();
  var pwd     = document.getElementById("regPwd").value;
  var consent = document.getElementById("regConsent").checked;
  var msg     = document.getElementById("regMsg");

  if(!pseudo||!email||!tel||!pwd){
    msg.style.display="block";msg.style.color="var(--red)";
    msg.textContent="Veuillez remplir tous les champs obligatoires.";return;
  }
  if(pwd.length < 6){
    msg.style.display="block";msg.style.color="var(--red)";
    msg.textContent="Le mot de passe doit contenir au moins 6 caractères.";return;
  }
  if(!consent){
    msg.style.display="block";msg.style.color="var(--red)";
    msg.textContent="Vous devez accepter les conditions.";return;
  }

  // Validations par type
  if(_regType === 'gerant'){
    var enNom = (document.getElementById('regEtabNom')||{value:''}).value.trim();
    var enAdr = (document.getElementById('regEtabAdresse')||{value:''}).value.trim();
    var typesEtab = document.querySelectorAll('input[name="etabType"]:checked');
    if(!enNom||!enAdr){ msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Remplissez le nom et l'adresse de l'établissement.";return; }
    if(typesEtab.length===0){ msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Cochez au moins un type d'établissement.";return; }
  }
  if(_regType === 'chauffeur'){
    var permis   = (document.getElementById('regPermis')||{value:''}).value.trim();
    var vehicule = (document.getElementById('regVehicule')||{value:''}).value.trim();
    if(!permis||!vehicule){ msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Remplissez le permis et le véhicule (obligatoires Chauffeur).";return; }
    if(!_regIdB64){ msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Veuillez ajouter une photo de votre pièce d'identité (obligatoire pour les chauffeurs).";return; }
  }

  var btn = document.querySelector("#formInscription .modal-btn");
  if(btn){btn.disabled=true;btn.textContent="Création en cours...";}

  var _tryRegister = function(attempts){
    if(!window.fbCreateUser || !window.auth){
      if(attempts > 50){
        if(btn){btn.disabled=false;btn.textContent="👤 Créer mon compte";}
        msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Firebase non disponible. Rechargez la page.";
        return;
      }
      return setTimeout(function(){ _tryRegister(attempts+1); }, 100);
    }

    var wantsDriver = (_regType === 'chauffeur');
    var isGerant    = (_regType === 'gerant');

    // Données étab
    var etabData = null;
    if(isGerant){
      var etabTypes = [];
      document.querySelectorAll('input[name="etabType"]:checked').forEach(function(c){ etabTypes.push(c.value); });
      etabData = {
        nom:      (document.getElementById('regEtabNom')||{value:''}).value.trim(),
        adresse:  (document.getElementById('regEtabAdresse')||{value:''}).value.trim(),
        tel:      (document.getElementById('regEtabTel')||{value:''}).value.trim(),
        types:    etabTypes,
        typeAutre:(document.getElementById('regEtabTypeAutreText')||{value:''}).value.trim()
      };
    }

    // Données chauffeur
    var chauffData = null;
    if(wantsDriver){
      var services = [];
      document.querySelectorAll('input[name="chauffService"]:checked').forEach(function(c){ services.push(c.value); });
      chauffData = {
        permis:   (document.getElementById('regPermis')||{value:''}).value.trim(),
        vehicule: (document.getElementById('regVehicule')||{value:''}).value.trim(),
        immat:    (document.getElementById('regImmat')||{value:''}).value.trim(),
        services: services
      };
    }

    // Type de pièce d'identité
    var idTypeEl = document.querySelector('input[name="regIdType"]:checked');
    var idType   = idTypeEl ? idTypeEl.value : 'cni';

    window.fbCreateUser(window.auth,email,pwd).then(function(result){
      var uid = result.user.uid;

      // ✅ Upload des photos vers Firebase Storage si disponible
      function _uploadRegPhoto(b64, storagePath, fbField, idType){
        return new Promise(function(resolve){
          if(!b64){ resolve({}); return; }
          // Fallback localStorage immédiat
          try { localStorage.setItem('ambi241_photo_'+uid, b64); } catch(e){}
          if(!window.fbStorage || !window.fbRef || !window.fbUploadBytes || !window.fbGetDownloadURL){
            var out = {}; out[fbField] = b64; resolve(out); return;
          }
          // Convertir base64 en Blob
          try {
            var arr = b64.split(','), mime = arr[0].match(/:(.*?);/)[1], bstr = atob(arr[1]), n = bstr.length, u8 = new Uint8Array(n);
            for(var i=0;i<n;i++) u8[i]=bstr.charCodeAt(i);
            var blob = new Blob([u8], {type: mime});
            var storRef = window.fbRef(window.fbStorage, storagePath);
            window.fbUploadBytes(storRef, blob).then(function(){
              return window.fbGetDownloadURL(storRef);
            }).then(function(url){
              // Stocker aussi en localStorage comme cache
              try { localStorage.setItem('ambi241_photo_'+uid, url); } catch(e){}
              var out = {}; out[fbField] = url; resolve(out);
            }).catch(function(){
              var out = {}; out[fbField] = b64; resolve(out);
            });
          } catch(e){ var out = {}; out[fbField] = b64; resolve(out); }
        });
      }

      var photoPromise = _uploadRegPhoto(_regPhotoB64, 'users/'+uid+'/profile_'+_cryptoId(12)+'.jpg', 'photoURL');
      var idPromise    = _regIdB64 ? _uploadRegPhoto(_regIdB64, 'users/'+uid+'/identity_'+_cryptoId(12)+'.jpg', 'photoIdentityURL') : Promise.resolve({});

      return Promise.all([photoPromise, idPromise]).then(function(results){
        var photoData = Object.assign({}, results[0], results[1]);
        return window.fbSetDoc(window.fbDoc(window.db,"users",uid), Object.assign({
          pseudo:      pseudo,
          email:       email,
          tel:         tel,
          prenom:      (document.getElementById("regPrenom")||{value:''}).value.trim(),
          nom:         (document.getElementById("regNom")||{value:''}).value.trim(),
          dob:         document.getElementById("regDob").value||"",
          createdAt:   new Date().toISOString(),
          memberType:  _regType,
          wantsDriver: wantsDriver,
          isGerant:    isGerant,
          hasPhoto:    !!_regPhotoB64,
          hasIdDoc:    !!_regIdB64,
          idDocType:   _regIdB64 ? idType : null,
          idVerified:  false,
          etab:        etabData,
          chauffeur:   chauffData
        }, photoData)).then(function(){
          if(wantsDriver){ registerUserAsDriver(uid, email, pseudo, pwd); }
          return Promise.resolve();
        });
      });
    }).then(function(){
      var label = _regType==='gerant' ? 'Gérant Établissement' : (_regType==='chauffeur' ? 'Membre Chauffeur' : 'Simple Membre');
      msg.style.display="block";msg.style.color="var(--green)";
      msg.textContent="✅ Compte créé ! Bienvenue "+pseudo+" ("+label+") !";
      if(btn){btn.disabled=false;btn.textContent="👤 Créer mon compte";}
      window.currentUserPseudo = pseudo;
      updateHeaderUser(pseudo);
      // Reset photos
      _regPhotoB64 = ''; _regIdB64 = '';
      setTimeout(function(){closeUserModal();},1800);
    }).catch(function(err){
      if(btn){btn.disabled=false;btn.textContent="👤 Créer mon compte";}
      msg.style.display="block";msg.style.color="var(--red)";
      if(err.code==="auth/email-already-in-use")msg.textContent="Cet email est déjà utilisé.";
      else if(err.code==="auth/weak-password")msg.textContent="Mot de passe trop court (6 caractères min).";
      else msg.textContent="Erreur: "+err.message;
    });
  };
  _tryRegister(0);
}

function loginUser(){
  // ── RATE LIMITING connexion Firebase ──────────────────────────
  var _rlKey    = 'ambi241_login_lockuntil';
  var _rlCnt    = 'ambi241_login_attempts';
  var _lockUntil = parseInt(lsGet(_rlKey)||'0');
  if(_lockUntil > Date.now()){
    var _remMin = Math.ceil((_lockUntil - Date.now()) / 60000);
    var msg2 = document.getElementById('loginMsg');
    if(msg2){ msg2.style.display='block'; msg2.style.color='var(--red)';
      msg2.textContent='🔒 Trop de tentatives — réessayez dans '+_remMin+' min'; }
    return;
  }
  // ─────────────────────────────────────────────────────────────
  var identifier=(document.getElementById("loginIdentifier")||{value:''}).value.trim();
  var pwd=document.getElementById("loginPwd").value;
  var msg=document.getElementById("loginMsg");
  var btn=document.querySelector("#formConnexion .modal-btn");

  // Compat : ancien champ loginEmail si toujours présent
  if(!identifier){
    var legacyEmail = document.getElementById("loginEmail");
    if(legacyEmail) identifier = legacyEmail.value.trim();
  }

  if(!identifier||!pwd){
    if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Identifiant et mot de passe requis.";}
    return;
  }
  if(btn){btn.disabled=true;btn.textContent="Connexion...";}

  // Détecter si c'est un numéro de téléphone (commence par + ou chiffres, pas de @)
  var isPhone = !identifier.includes("@") && /^[+\d]/.test(identifier);

  var _doFirebaseLogin = function(email){
    var _tryLogin = function(attempts){
      if(!window.fbSignIn || !window.auth){
        if(attempts > 50){
          if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
          if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Firebase non disponible. Rechargez la page.";}
          return;
        }
        return setTimeout(function(){ _tryLogin(attempts+1); }, 100);
      }
      window.fbSignIn(window.auth,email,pwd).then(function(result){
        // ── Succès : reset compteur tentatives ──
        lsSet('ambi241_login_attempts','0');
        lsSet('ambi241_login_lockuntil','0');
        var user=result.user;
        msg.style.display="block";msg.style.color="var(--green)";
        msg.textContent="Connexion réussie ! Bienvenue !";
        if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
        window.fbGetDoc(window.fbDoc(window.db,"users",user.uid)).then(function(snap){
          var pseudo = snap.exists() ? (snap.data().pseudo || user.email) : user.email;
          window.currentUserPseudo = pseudo;
          updateHeaderUser(pseudo);
          msg.textContent = "Connexion réussie ! Bienvenue " + pseudo + " !";
        }).catch(function(){ updateHeaderUser(user.email); });
        setTimeout(function(){ checkPendingUserNotifications(user.uid, email); }, 1200);
        setTimeout(function(){closeUserModal();},1500);
      }).catch(function(err){
        // ── Échec : incrémenter compteur de tentatives ──
        var _attempts = parseInt(lsGet('ambi241_login_attempts')||'0') + 1;
        lsSet('ambi241_login_attempts', String(_attempts));
        if(_attempts >= 5){
          var _lockTs = Date.now() + (15 * 60 * 1000); // 15 min
          lsSet('ambi241_login_lockuntil', String(_lockTs));
          lsSet('ambi241_login_attempts','0');
        }
        if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
        msg.style.display="block";msg.style.color="var(--red)";
        if(err.code==="auth/user-not-found"||err.code==="auth/wrong-password"||err.code==="auth/invalid-credential")
          msg.textContent="Identifiant ou mot de passe incorrect.";
        else msg.textContent="Erreur: "+err.message;
      });
    };
    _tryLogin(0);
  };

  if(!isPhone){
    // Connexion directe par email
    _doFirebaseLogin(identifier);
  } else {
    // Recherche de l'email associé au numéro de téléphone dans Firestore
    if(!window.db || !window.fbCollection || !window.fbQuery || !window.fbWhere || !window.fbGetDocs){
      if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
      if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Service non disponible, réessayez.";}
      return;
    }
    // Normaliser le numéro (enlever espaces)
    var tel = identifier.replace(/\s/g,'');
    var q = window.fbQuery(
      window.fbCollection(window.db,"users"),
      window.fbWhere("tel","==",tel)
    );
    window.fbGetDocs(q).then(function(snap){
      if(snap.empty){
        // Essayer sans le +241 au cas où
        var telAlt = tel.replace(/^\+241/,'').replace(/^241/,'');
        var q2 = window.fbQuery(
          window.fbCollection(window.db,"users"),
          window.fbWhere("tel",">=",telAlt),
          window.fbWhere("tel","<=",telAlt+"\uf8ff")
        );
        return window.fbGetDocs(q2).then(function(snap2){
          if(snap2.empty){
            if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
            if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Aucun compte trouvé pour ce numéro.";}
            return;
          }
          var email = snap2.docs[0].data().email;
          if(!email){
            if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
            if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Compte sans email associé — utilisez votre email.";}
            return;
          }
          _doFirebaseLogin(email);
        });
      }
      var email = snap.docs[0].data().email;
      if(!email){
        if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
        if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Compte sans email associé — utilisez votre email.";}
        return;
      }
      _doFirebaseLogin(email);
    }).catch(function(err){
      if(btn){btn.disabled=false;btn.textContent="🔒 Se connecter";}
      if(msg){msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Erreur lors de la recherche: "+err.message;}
    });
  }
}

// ── Vérifie et affiche les notifications Firebase en attente ──────
function checkPendingUserNotifications(uid, email){
  if(!window.db || !window.fbCollection || !window.fbQuery || !window.fbWhere || !window.fbGetDocs) return;
  // Requête : notifs ciblées par uid OU par email, non lues
  var q = window.fbQuery(
    window.fbCollection(window.db, "user_notifications"),
    window.fbWhere("unread", "==", true),
    window.fbWhere("targetUid", "==", uid||"")
  );
  window.fbGetDocs(q).then(function(snap){
    snap.forEach(function(docSnap){
      var n = docSnap.data();
      // Afficher la notification localement
      pushNotif({
        targetRole: "all",
        key:        n.key || "notif",
        icon:       n.icon || "🔔",
        title:      n.title || "Notification",
        msg:        n.msg || "",
        channel:    "push",
        fromAdmin:  true
      });
      // Marquer comme lue dans Firebase
      window.fbUpdateDoc(window.fbDoc(window.db, "user_notifications", docSnap.id), { unread: false }).catch(function(){});
    });
  }).catch(function(){});
}

// ── MISE À JOUR HEADER SELON CONNEXION ───────────────────────
function updateHeaderUser(pseudo){
  var greeting = document.getElementById("userGreeting");
  var greetingName = document.getElementById("greetingName");
  var headerThumb = document.getElementById("headerAvatarThumb");
  var logoutBtn = document.getElementById("logoutBtn");
  var loginBtn  = document.getElementById("userLoginBtn");
  var tabMonProfil = document.getElementById("tabMonProfil");
  var tabInscription = document.getElementById("tabInscription");
  var tabConnexion = document.getElementById("tabConnexion");
  if(pseudo){
    var initiale = (pseudo||"?")[0].toUpperCase();
    // Afficher seulement la première lettre du nom pour gagner de l'espace
    greetingName.textContent = initiale;
    // Afficher l'initiale par défaut dans le thumb
    if(headerThumb) headerThumb.textContent = initiale;
    // Charger la vraie photo si dispo
    var uid = window.currentUserUID;
    if(uid){
      loadUserAvatar(uid, function(url){
        _updateHeaderThumb(url, initiale);
      });
    }
    greeting.classList.add("show");
    greeting.title = "Mon profil — "+pseudo;
    greeting.onclick = function(){ document.getElementById("userOverlay").classList.add("show"); switchUserTab("monprofil"); };
    logoutBtn.classList.add("show");
    if(loginBtn) loginBtn.style.display = "none";
    // La cloche est visible pour les membres/admins connectés, seulement si notifs non lues
    if(typeof renderNotifBadge === "function") renderNotifBadge();
    if(tabMonProfil){ tabMonProfil.style.display=""; }
    if(tabInscription){ tabInscription.style.display="none"; }
    if(tabConnexion){ tabConnexion.style.display="none"; }
  } else {
    greeting.classList.remove("show");
    if(headerThumb){ headerThumb.textContent="?"; }
    greeting.onclick = function(){ document.getElementById("userOverlay").classList.add("show"); };
    logoutBtn.classList.remove("show");
    if(loginBtn) loginBtn.style.display = "";
    // Masquer la cloche pour les visiteurs non connectés
    var bellWrapLogout = document.getElementById("notifBellWrap");
    if(bellWrapLogout) bellWrapLogout.style.display = "none";
    if(tabMonProfil){ tabMonProfil.style.display="none"; }
    if(tabInscription){ tabInscription.style.display=""; }
    if(tabConnexion){ tabConnexion.style.display=""; }
    switchUserTab("inscription");
  }
}

// Met à jour le mini-avatar dans le header
function _updateHeaderThumb(url, initiale){
  var thumb = document.getElementById("headerAvatarThumb");
  if(!thumb) return;
  if(url){
    thumb.innerHTML = '<img src="'+url+'" alt="">';
    thumb.style.background = "none";
    thumb.style.fontSize = "0";
  } else {
    thumb.textContent = initiale || "?";
    thumb.style.background = "";
    thumb.style.fontSize = "";
  }
}

// ── DÉCONNEXION ───────────────────────────────────────────────
function logoutUser(){
  if(!confirm("Voulez-vous vraiment vous déconnecter ?")) return;
  window.fbSignOut(window.auth).then(function(){
    showToast("Déconnecté avec succès");
  }).catch(function(err){
    showToast("Erreur lors de la déconnexion");
  });
}

// ── MOT DE PASSE OUBLIÉ ───────────────────────────────────────
function openForgotModal(){
  document.getElementById("userOverlay").classList.remove("show");
  document.getElementById("forgotOverlay").classList.add("show");
  switchForgotTab("email");
  document.getElementById("forgotEmailMsg").style.display = "none";
  document.getElementById("forgotTelMsg").style.display = "none";
  document.getElementById("forgotEmail").value = "";
  document.getElementById("forgotTel").value = "";
  document.getElementById("forgotPseudo").value = "";
}
function closeForgotModal(){
  document.getElementById("forgotOverlay").classList.remove("show");
}
function switchForgotTab(tab){
  document.getElementById("forgotTabEmail").classList.toggle("active", tab==="email");
  document.getElementById("forgotTabTel").classList.toggle("active", tab==="tel");
  document.getElementById("forgotFormEmail").style.display = tab==="email" ? "block" : "none";
  document.getElementById("forgotFormTel").style.display   = tab==="tel"   ? "block" : "none";
}

function sendForgotEmail(){
  var email = document.getElementById("forgotEmail").value.trim();
  var msg   = document.getElementById("forgotEmailMsg");
  var btn   = document.getElementById("forgotEmailBtn");

  if(!email){ msg.style.display="block"; msg.style.color="var(--red)"; msg.textContent="Veuillez entrer votre adresse email."; return; }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ msg.style.display="block"; msg.style.color="var(--red)"; msg.textContent="Format d'adresse email invalide."; return; }

  // Anti-spam : cooldown 60s
  var cooldownKey = "ambi241_reset_cd_" + email.toLowerCase().replace(/[^a-z0-9]/g,"");
  var lastSent = parseInt(localStorage.getItem(cooldownKey)||"0");
  var elapsed = Math.floor((Date.now() - lastSent) / 1000);
  if(elapsed < 60){
    msg.style.display="block"; msg.style.color="var(--amber)";
    msg.textContent="Patientez encore " + (60-elapsed) + " secondes avant de renvoyer.";
    return;
  }

  btn.disabled=true; btn.innerHTML="&#9203; Envoi en cours...";
  msg.style.display="block"; msg.style.color="var(--muted)"; msg.textContent="Connexion à Firebase…";

  if(!window.fbSendPasswordResetEmail || !window.auth){
    btn.disabled=false; btn.innerHTML="&#128231; Envoyer le lien de réinitialisation";
    msg.style.color="var(--red)"; msg.textContent="Service indisponible. Réessayez dans quelques instants.";
    return;
  }

  window.fbSendPasswordResetEmail(window.auth, email).then(function(){
    try { localStorage.setItem(cooldownKey, Date.now().toString()); } catch(e){}
    msg.style.display="block"; msg.style.color="var(--green)";
    var safeEmail = typeof escHtml==="function" ? escHtml(email) : email.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    msg.innerHTML="&#10003; Lien envoyé à <strong>"+safeEmail+"</strong>.<br><span style=\"font-size:0.72rem;opacity:0.8;\">Vérifiez votre boîte mail et les <em>spams</em>. Lien valable 1 heure.</span>";
    btn.disabled=true;
    var sec = 60;
    var iv = setInterval(function(){
      sec--;
      if(sec <= 0){ clearInterval(iv); btn.disabled=false; btn.innerHTML="&#128231; Envoyer le lien de réinitialisation"; return; }
      btn.innerHTML="&#128231; Renvoyer ("+sec+"s)";
    }, 1000);
  }).catch(function(err){
    btn.disabled=false; btn.innerHTML="&#128231; Envoyer le lien de réinitialisation";
    msg.style.display="block";
    if(err.code==="auth/invalid-email" || err.code==="auth/missing-email"){
      msg.style.color="var(--red)"; msg.textContent="Adresse email invalide.";
    } else if(err.code==="auth/too-many-requests"){
      msg.style.color="var(--amber)"; msg.textContent="Trop de tentatives. Attendez quelques minutes.";
    } else if(err.code==="auth/network-request-failed"){
      msg.style.color="var(--red)"; msg.textContent="Erreur réseau. Vérifiez votre connexion.";
    } else {
      // Message neutre (sécurité) pour auth/user-not-found, auth/invalid-credential
      msg.style.color="var(--green)";
      var safeEmail2 = typeof escHtml==="function" ? escHtml(email) : email.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
      msg.innerHTML="&#10003; Si un compte existe pour <strong>"+safeEmail2+"</strong>, un lien a été envoyé.<br><span style=\"font-size:0.72rem;opacity:0.8;\">Vérifiez votre boîte mail et les spams.</span>";
    }
  });
}

function sendForgotTel(){
  var tel    = (document.getElementById("forgotTel").value||"").trim();
  var pseudo = (document.getElementById("forgotPseudo").value||"").trim();
  var msg    = document.getElementById("forgotTelMsg");
  var btn    = document.getElementById("forgotTelBtn");

  if(!tel){ msg.style.display="block"; msg.style.color="var(--red)"; msg.textContent="Veuillez entrer votre numéro de téléphone."; return; }
  if(!pseudo){ msg.style.display="block"; msg.style.color="var(--red)"; msg.textContent="Veuillez entrer votre pseudo ou nom d'utilisateur."; return; }

  btn.disabled=true; btn.innerHTML="&#9203; Envoi en cours...";
  msg.style.display="block"; msg.style.color="var(--muted)"; msg.textContent="Enregistrement de votre demande…";

  // ── Écrire le ticket dans Firestore (support_requests) ──
  if(window.db && window.fbCollection && window.fbAddDoc){
    var now = new Date().toISOString();
    var telNorm = typeof _normPhone === "function" ? _normPhone(tel) : tel;
    window.fbAddDoc(window.fbCollection(window.db, "support_requests"), {
      type:      "reset_password",
      channel:   "tel",
      pseudo:    pseudo,
      tel:       telNorm,
      uid:       window.currentUserUID || "",
      email:     window.currentUserEmail || "",
      status:    "open",
      createdAt: now,
      messages:  [{
        from: "user",
        text: "Demande de réinitialisation de mot de passe par téléphone.\nPseudo : "+pseudo+"\nTél : "+telNorm,
        ts:   now
      }]
    }).then(function(docRef){
      btn.disabled=false; btn.innerHTML="&#128241; Envoyer ma demande";
      msg.style.color="var(--green)";
      msg.innerHTML="&#10003; Demande enregistrée (réf. <code style=\"font-size:0.68rem;\">"+docRef.id.slice(0,8)+"…</code>).<br>"
        +"<span style=\"font-size:0.72rem;opacity:0.85;\">Notre équipe vérifiera votre identité et vous enverra un lien de réinitialisation sous <strong>24h</strong>. "
        +"Gardez le téléphone <strong>"+telNorm+"</strong> à portée.</span>";
    }).catch(function(err){
      // Fallback si Firestore indisponible : envoyer par mailto
      _sendForgotTelMailto(tel, pseudo, msg, btn);
    });
  } else {
    // Firebase non disponible : fallback mailto
    _sendForgotTelMailto(tel, pseudo, msg, btn);
  }
}

function _sendForgotTelMailto(tel, pseudo, msg, btn){
  var subject = encodeURIComponent("AMBI241 - Récupération de compte par téléphone");
  var body    = encodeURIComponent("Demande de récupération de compte AMBI241\n\nPseudo : "+pseudo+"\nTéléphone : "+tel+"\n\nMerci de vérifier l'identité et d'envoyer un lien de réinitialisation.");
  btn.disabled=false; btn.innerHTML="&#128241; Envoyer ma demande";
  msg.style.color="var(--green)";
  msg.innerHTML="&#10003; Votre demande a été transmise.<br>"
    +"<span style=\"font-size:0.72rem;opacity:0.85;\">Notre équipe vous contactera sur le <strong>"+tel+"</strong> sous 24h.<br>"
    +"Vous pouvez aussi écrire directement : <a href='mailto:ambi2412026@gmail.com?subject="+subject+"&body="+body+"' style='color:var(--cyan);'>&#9993; ambi2412026@gmail.com</a></span>";
}
window._sendForgotTelMailto = _sendForgotTelMailto;

window.logoutUser     = logoutUser;
window.updateHeaderUser = updateHeaderUser;
window.openForgotModal  = openForgotModal;
window.closeForgotModal = closeForgotModal;
window.switchForgotTab  = switchForgotTab;
window.sendForgotEmail  = sendForgotEmail;
window.sendForgotTel    = sendForgotTel;

// GPS
document.getElementById("gpsBtn").addEventListener("click",function(){
  var btn=document.getElementById("gpsBtn");
  var statusTxt=document.getElementById("gpsStatusTxt");
  if(!navigator.geolocation){statusTxt.textContent="GPS non disponible";return;}
  btn.textContent="Localisation...";btn.disabled=true;
  navigator.geolocation.getCurrentPosition(
    function(pos){
      var lat=pos.coords.latitude.toFixed(6);
      var lng=pos.coords.longitude.toFixed(6);
      var url="https://maps.google.com/?q="+lat+","+lng;
      document.getElementById("latInput").value=lat;
      document.getElementById("lngInput").value=lng;
      document.getElementById("mapsUrlInput").value=url;
      document.getElementById("gpsCoordsDisplay").textContent="Position: "+lat+" N, "+lng+" E";
      document.getElementById("gpsMapsLink").href=url;
      document.getElementById("gpsResult").style.display="block";
      btn.textContent="Position obtenue !";
      statusTxt.textContent="Localisation confirmee";
    },
    function(){
      btn.disabled=false;btn.textContent="Reessayer";
      statusTxt.textContent="Acces GPS refuse. Autorisez la localisation.";
    }
  );
});

// FORM ETABLISSEMENT
function previewUpload(input,previewId,nameId){
  var file=input.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    var p=document.getElementById(previewId);
    var img=p.querySelector("img");
    img.src=ev.target.result;
    document.getElementById(nameId).textContent=file.name;
    p.style.display="block";
  };
  reader.readAsDataURL(file);
}

document.getElementById("etablForm").addEventListener("submit",function(e){
  e.preventDefault();
  var btn=document.getElementById("etablSubmitBtn");
  var msg=document.getElementById("etablMsg");
  if(!document.getElementById("etablConsent").checked){
    msg.style.display="block";msg.style.color="var(--red)";
    msg.textContent="Vous devez accepter les conditions.";return;
  }
  btn.disabled=true;btn.textContent="Envoi en cours...";
  var fd=new FormData(this);
  fetch(this.action,{method:"POST",body:fd,headers:{Accept:"application/json"}})
  .then(function(r){
    if(r.ok){
      document.getElementById("etablForm").style.display="none";
      msg.style.display="block";msg.style.color="var(--green)";
      msg.innerHTML="<div style=\"text-align:center;padding:1rem\"><div style=\"font-size:2.5rem\">&#127881;</div><div style=\"font-family:Syne,sans-serif;font-weight:800;font-size:1rem;margin-top:0.5rem\">Demande envoyee !</div><div style=\"font-size:0.8rem;color:var(--muted);margin-top:0.3rem\">Nous verifierons votre paiement et vous contacterons sous 24h.</div></div>";
    } else {
      btn.disabled=false;btn.textContent="Envoyer ma demande";
      msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Erreur. Reessayez.";
    }
  }).catch(function(){
    btn.disabled=false;btn.textContent="Envoyer ma demande";
    msg.style.display="block";msg.style.color="var(--red)";msg.textContent="Erreur de connexion.";
  });
});



// LIGHTBOX
function openLightbox(src){
  document.getElementById("lightboxImg").src=src;
  document.getElementById("lightbox").classList.add("show");
}
function closeLightbox(){document.getElementById("lightbox").classList.remove("show");}

// LIGHTBOX PHOTO PERMANENTE — 100vw plein écran
function openFullscreenPhoto(src, eid, type, nom){
  var lb = document.getElementById("permPhotoLightbox");
  var img = document.getElementById("permLbImg");
  var titleEl = document.getElementById("permLbTitle");
  var actionsEl = document.getElementById("permLbActions");

  img.src = src;
  titleEl.textContent = nom ? ("📍 " + nom) : "Photo du lieu";

  // Barre d'actions : télécharger + supprimer si autorisé
  var etab = (typeof etablissements !== "undefined") ? etablissements.find(function(x){ return x.id === eid; }) : null;
  var canEdit = etab && (typeof canEditPhotos === "function") ? canEditPhotos(etab) : false;

  var html = "<a href='"+src+"' download target='_blank' style='display:flex;align-items:center;gap:0.25rem;padding:0.38rem 0.7rem;border-radius:100px;font-size:0.7rem;font-weight:700;font-family:DM Sans,sans-serif;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.35);color:var(--cyan);text-decoration:none;'>⬇ Télécharger</a>";
  if(canEdit){
    html += "<button onclick=\"closeFullscreenPhoto();openPhotoModal("+eid+",'"+type+"')\" style='display:flex;align-items:center;gap:0.25rem;padding:0.38rem 0.7rem;border-radius:100px;font-size:0.7rem;font-weight:700;font-family:DM Sans,sans-serif;background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.35);color:var(--pink);cursor:pointer;border:none;'>✏️ Modifier</button>";
    html += "<button onclick=\"closeFullscreenPhoto();deletePermPhoto("+eid+",'"+type+"')\" style='display:flex;align-items:center;gap:0.25rem;padding:0.38rem 0.7rem;border-radius:100px;font-size:0.7rem;font-weight:700;font-family:DM Sans,sans-serif;background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.35);color:var(--red);cursor:pointer;border:none;'>🗑 Supprimer</button>";
  }
  actionsEl.innerHTML = html;

  lb.classList.add("show");
  // Fermer avec Escape
  document._permLbEsc = function(ev){ if(ev.key==="Escape") closeFullscreenPhoto(); };
  document.addEventListener("keydown", document._permLbEsc);
}
function closeFullscreenPhoto(){
  document.getElementById("permPhotoLightbox").classList.remove("show");
  document.getElementById("permLbImg").src = "";
  if(document._permLbEsc){
    document.removeEventListener("keydown", document._permLbEsc);
    document._permLbEsc = null;
  }
}

// RENDER STATS — grid 4 colonnes identique à l'accueil (Lieux / Calmes / Animés / Bondés)
function renderStats(){
  var d=etablissements;if(!d.length)return;
  var bondes=d.filter(function(e){return e.statut&&e.statut.indexOf("Bonde")!==-1;}).length;
  var animes=d.filter(function(e){return e.statut&&e.statut.indexOf("Anime")!==-1;}).length;
  var calmes=d.filter(function(e){return e.statut&&e.statut.indexOf("Calme")!==-1;}).length;
  var chips=[
    {val:calmes, lbl:"Calmes", cls:"sc-amber", filter:"Calme"},
    {val:animes, lbl:"Animés", cls:"sc-cyan",  filter:"Anime"},
    {val:bondes, lbl:"Bondés", cls:"sc-red",   filter:"Bonde"}
  ];
  var touch='ontouchstart="this.style.transform=\'scale(0.93)\'" ontouchend="this.style.transform=\'\'"';
  var html='<div class="stat-chip sc-pink" style="cursor:pointer;" '+touch+'><div class="val">'+d.length+'</div>'
    +'<div class="lbl" style="line-height:1.3;">Lieux<br><span style="color:var(--green);font-weight:800;font-size:0.55rem;">'+d.length+' ACTIFS</span></div></div>';
  chips.forEach(function(c){
    html+='<div class="stat-chip '+c.cls+'" onclick="window._filterOnSwitch={type:\'all\',status:\''+c.filter+'\'};" style="cursor:pointer;" '+touch+'>'
      +'<div class="val">'+c.val+'</div><div class="lbl">'+c.lbl+'</div></div>';
  });
  document.getElementById("statsRow").innerHTML=html;
}


// FILTER DATA
function estPaiementConfirme(etab){
  // MODIFIÉ : retourne toujours true pour afficher tous les établissements (admin et non-admin)
  return true;
}

function filterData(){
  var q=document.getElementById("searchInput").value.toLowerCase().trim();
  var data=etablissements.filter(function(e){
    // ── Recherche textuelle : NOM et QUARTIER uniquement (jamais e.type pour éviter les faux positifs inter-catégories) ──
    var ms=!q
      ||e.nom.toLowerCase().indexOf(q)!==-1
      ||(e.quartier&&e.quartier.toLowerCase().indexOf(q)!==-1)
      ||(e.description&&e.description.toLowerCase().indexOf(q)!==-1);
    // ── Filtre de catégorie : comparaison stricte via getCategory ──
    var mt=currentType==="all"||(getCategory(e.type)===currentType);
    var mv=currentStatus==="all"||(e.statut&&e.statut.indexOf(currentStatus)!==-1);
    // Admin voit tout (actifs + archivés) pour pouvoir les trier
    if(isAdmin) return ms&&mt;
    return ms&&mt&&mv;
  });
  // ── GPS : filtrer par rayon si mode actif ──
  if(typeof _gpsState !== "undefined" && _gpsState.active && _gpsState.lat !== null){
    data = filterByRadius(data);
    data = sortGpsData(data);
    // Même en mode GPS : l'établissement du membre toujours en 1er
    data = _pinMyEtabFirst(data);
    return data;
  }
  data.sort(function(a,b){
    if(currentSort==="affluence"){
      // Utiliser l'affluence réelle (live) si disponible
      var aLive = window._livePresences && window._liveVotes ? (function(){
        var lp = window._livePresences[String(a.id)]||{count:0};
        var lv = window._liveVotes[String(a.id)]||{pos:0,neg:0};
        return Math.max(0,Math.min(100,(a.affluence||0)+Math.min(lp.count*3,30)+(lv.pos*2)-(lv.neg*3)));
      })() : (a.affluence||0);
      var bLive = window._livePresences && window._liveVotes ? (function(){
        var lp = window._livePresences[String(b.id)]||{count:0};
        var lv = window._liveVotes[String(b.id)]||{pos:0,neg:0};
        return Math.max(0,Math.min(100,(b.affluence||0)+Math.min(lp.count*3,30)+(lv.pos*2)-(lv.neg*3)));
      })() : (b.affluence||0);
      return bLive - aLive;
    }
    if(currentSort==="note"){
      var aN = (window._liveRatings && window._liveRatings[String(a.id)] && window._liveRatings[String(a.id)].avis > 0) ? window._liveRatings[String(a.id)].note : (a.note||0);
      var bN = (window._liveRatings && window._liveRatings[String(b.id)] && window._liveRatings[String(b.id)].avis > 0) ? window._liveRatings[String(b.id)].note : (b.note||0);
      return bN - aN;
    }
    if(currentSort==="quartier")return(a.quartier||"").localeCompare(b.quartier||"");
    return 0;
  });
  // ── Épingler l'établissement du membre propriétaire en tête ──
  data = _pinMyEtabFirst(data);
  return data;
}

// Épingle l'établissement du membre connecté en tête de liste (pour modération facile)
function _pinMyEtabFirst(data){
  if(isAdmin || !currentUserEmail) return data;
  var myEm = currentUserEmail.toLowerCase().trim();
  var idx = data.findIndex(function(e){ return (e.email||"").toLowerCase().trim() === myEm; });
  if(idx <= 0) return data; // déjà en premier ou pas trouvé
  var mine = data.splice(idx, 1)[0];
  mine._isPinned = true;
  data.unshift(mine);
  return data;
}

function statusClass(s){
  if(!s)return "s-noir";
  if(s.indexOf("Bonde")!==-1)return "s-rouge";
  if(s.indexOf("Anime")!==-1)return "s-vert";
  if(s.indexOf("Calme")!==-1)return "s-jaune";
  return "s-noir";
}
function makeStars(n){
  var s="";
  for(var i=1;i<=5;i++)s+="<span class=\"star "+(i<=Math.floor(n)?"on":"off")+"\">"+"&#9733;"+"</span>";
  return s;
}

// BUILD CARD - all strings use double quotes
// ══════════════════════════════════════════════════════════════
// ══  CONTACT CLICK — Log Firebase + Notif Admin              ══
// ══════════════════════════════════════════════════════════════
function logContactClick(etabId, etabNom, channel){
  var ts = Date.now();
  var uid  = window.currentUserUID  || "anonyme";
  var email= window.currentUserEmail|| "non connecté";
  var pseudo=window.currentUserPseudo||email;

  var logData = {
    etabId:   String(etabId),
    etabNom:  etabNom || "",
    channel:  channel,        // "whatsapp" | "telephone" | "email"
    uid:      uid,
    email:    email,
    pseudo:   pseudo,
    ts:       ts,
    userAgent: navigator.userAgent || "",
    platform:  navigator.platform  || "",
    sessionId: uid + "_" + ts
  };

  // ── Écriture dans Firebase "contact_clicks" ──
  if(window.db && window.fbAddDoc && window.fbCollection){
    window.fbAddDoc(window.fbCollection(window.db,"contact_clicks"), logData)
      .then(function(){
        // ── Notif push admin ──
        if(typeof pushNotif === "function"){
          var icons = {whatsapp:"💬", telephone:"📞", email:"✉️"};
          var labels= {whatsapp:"WhatsApp", telephone:"Appel", email:"Email"};
          pushNotif({
            targetRole:"admin",
            key:"contact_"+channel+"_"+etabId+"_"+ts,
            icon: icons[channel]||"📲",
            title:"Contact "+ (labels[channel]||channel)+" — "+etabNom,
            msg:(pseudo||email)+" a contacté cet établissement via "+(labels[channel]||channel)+".",
            channel:"push",
            fromAdmin:false
          });
        }
      }).catch(function(){});
  }

  // ── Notif locale si admin connecté ──
  if(isAdmin && typeof showToast==="function"){
    showToast("📲 Contact: "+etabNom+" via "+(channel==="whatsapp"?"WhatsApp":channel==="telephone"?"Tél":"Email"));
  }
}
window.logContactClick = logContactClick;

// ══════════════════════════════════════════════════════════════════
// ══  SYSTÈME DISPONIBILITÉS EN TEMPS RÉEL — GÉRANT PRO         ══
// ══════════════════════════════════════════════════════════════════

// ── Presets par catégorie ─────────────────────────────────────────
var DISPO_PRESETS = {
  Bar:          [{icon:"🍺",name:"Bières pression",val:20,type:"nombre"},{icon:"🍾",name:"Bouteilles VIP",val:10,type:"nombre"},{icon:"🛋️",name:"Tables libres",val:5,type:"nombre"},{icon:"🎵",name:"Musique live",val:1,type:"oui_non"}],
  Discotheque:  [{icon:"💃",name:"Places danse",val:30,type:"nombre"},{icon:"🛋️",name:"Tables VIP",val:8,type:"nombre"},{icon:"🍾",name:"Bouteilles",val:15,type:"nombre"},{icon:"🎤",name:"Soirée DJ",val:1,type:"oui_non"}],
  Restaurant:   [{icon:"🍽️",name:"Tables libres",val:10,type:"nombre"},{icon:"🥩",name:"Plat du jour",val:1,type:"oui_non"},{icon:"🐟",name:"Poisson frais",val:8,type:"nombre"},{icon:"🍰",name:"Desserts",val:12,type:"nombre"},{icon:"🍷",name:"Vin en cave",val:20,type:"nombre"}],
  "Bar Terrasse":[{icon:"☂️",name:"Places terrasse",val:15,type:"nombre"},{icon:"🍹",name:"Cocktails spéciaux",val:1,type:"oui_non"},{icon:"🌅",name:"Vue disponible",val:1,type:"oui_non"},{icon:"🍺",name:"Bières",val:30,type:"nombre"}],
  Snack:        [{icon:"🍔",name:"Burgers",val:20,type:"nombre"},{icon:"🍟",name:"Frites",val:1,type:"oui_non"},{icon:"🥤",name:"Boissons fraîches",val:50,type:"nombre"},{icon:"🌮",name:"Plats chauds",val:15,type:"nombre"}],
  Salle:        [{icon:"🎭",name:"Places disponibles",val:100,type:"nombre"},{icon:"🎤",name:"Sonorisation",val:1,type:"oui_non"},{icon:"💡",name:"Éclairage scène",val:1,type:"oui_non"},{icon:"🅿️",name:"Places parking",val:20,type:"nombre"},{icon:"🍽️",name:"Service traiteur",val:1,type:"oui_non"},{icon:"📷",name:"Photographe dispo",val:1,type:"oui_non"}],
  Stade:        [{icon:"⚽",name:"Terrain disponible",val:1,type:"oui_non"},{icon:"🪑",name:"Places tribune",val:200,type:"nombre"},{icon:"🚿",name:"Vestiaires",val:1,type:"oui_non"},{icon:"🅿️",name:"Places parking",val:50,type:"nombre"},{icon:"🏆",name:"Match programmé",val:1,type:"oui_non"},{icon:"🍟",name:"Buvette",val:1,type:"oui_non"}],
  Tourisme:     [{icon:"🌿",name:"Entrée disponible",val:1,type:"oui_non"},{icon:"🚶",name:"Guides disponibles",val:3,type:"nombre"},{icon:"🅿️",name:"Places parking",val:15,type:"nombre"},{icon:"📸",name:"Zone photo",val:1,type:"oui_non"},{icon:"🍃",name:"Sentier ouvert",val:1,type:"oui_non"},{icon:"🏕️",name:"Camping autorisé",val:1,type:"oui_non"}]
};

var DISPO_EMOJIS = ["🍺","🍾","🍷","🍹","🍸","🥂","🥃","🍔","🍟","🌮","🍕","🥩","🐟","🍽️","🍰","🎂","🛏️","🛋️","🪑","☂️","🅿️","🚿","🏊","🧖","🎵","🎤","💃","🎮","🏋️","💼","📍","⭐","✅","🎁","🥤","🧃"];

// État local des dispos
var _dispoState = {}; // { [etabId]: [{id, icon, name, val, type, active}] }
var _dispoModal = { etabId: null, emoji: "🍽️", dtype: "nombre" };

// ── Charger les dispos depuis Firebase (ou cache local) ──────────
function loadDispoState(etabId, callback) {
  var key = "ambi241_dispo_" + etabId;
  // D'abord cache local
  try {
    var cached = JSON.parse(localStorage.getItem(key) || "null");
    if (cached) { _dispoState[etabId] = cached; if (callback) callback(cached); }
  } catch(e) {}

  // Puis Firebase (source of truth)
  if (!window.db || !window.fbDoc || !window.fbGetDoc) return;
  window.fbGetDoc(window.fbDoc(window.db, "etablissements_dispo", String(etabId)))
    .then(function(snap) {
      if (snap.exists()) {
        var d = snap.data();
        var items = d.items || [];
        _dispoState[etabId] = items;
        try { localStorage.setItem(key, JSON.stringify(items)); } catch(e) {}
        if (callback) callback(items);
        // Re-render la bande publique sur la carte
        refreshDispoPublicOnCard(etabId);
        // Re-render le panneau gérant si visible
        refreshDispoManagerOnCard(etabId);
      }
    }).catch(function() {});
}

// ── Écouter les changements temps réel ──────────────────────────
var _dispoUnsubs = {};
function subscribeDispoLive(etabId) {
  if (_dispoUnsubs[etabId]) return; // déjà subscrit
  if (!window.db || !window.fbDoc || !window.fbOnSnapshot) return;
  var docRef = window.fbDoc(window.db, "etablissements_dispo", String(etabId));
  _dispoUnsubs[etabId] = window.fbOnSnapshot(docRef, function(snap) {
    if (snap.exists()) {
      var items = snap.data().items || [];
      _dispoState[etabId] = items;
      try { localStorage.setItem("ambi241_dispo_" + etabId, JSON.stringify(items)); } catch(e) {}
      refreshDispoPublicOnCard(etabId);
      refreshDispoManagerOnCard(etabId);
    }
  }, function() {});
}

// ── Sauvegarder les dispos dans Firebase ────────────────────────
function saveDispoState(etabId) {
  var items = _dispoState[etabId] || [];
  try { localStorage.setItem("ambi241_dispo_" + etabId, JSON.stringify(items)); } catch(e) {}
  if (!window.db || !window.fbDoc || !window.fbSetDoc) return;
  window.fbSetDoc(window.fbDoc(window.db, "etablissements_dispo", String(etabId)), {
    items: items,
    etabId: String(etabId),
    updatedAt: Date.now()
  }, { merge: true }).catch(function(err) { console.warn("dispo save:", err); });
}

// ── Modifier la valeur d'un item ────────────────────────────────
window.dispoAdjust = function(etabId, itemId, delta) {
  var items = _dispoState[etabId] || [];
  var item = items.find(function(x) { return x.id === itemId; });
  if (!item) return;
  if (item.type === "oui_non") {
    item.val = item.val ? 0 : 1;
  } else {
    item.val = Math.max(0, Math.min(9999, (item.val || 0) + delta));
  }
  item.updatedAt = Date.now();
  saveDispoState(etabId);
  refreshDispoManagerOnCard(etabId);
  refreshDispoPublicOnCard(etabId);
};

// ── Supprimer un item ───────────────────────────────────────────
window.dispoRemoveItem = function(etabId, itemId) {
  var items = _dispoState[etabId] || [];
  _dispoState[etabId] = items.filter(function(x) { return x.id !== itemId; });
  saveDispoState(etabId);
  refreshDispoManagerOnCard(etabId);
  refreshDispoPublicOnCard(etabId);
  showToast("Indicateur supprimé");
};

// ── Toggle actif/inactif ─────────────────────────────────────────
window.dispoToggleActive = function(etabId, itemId) {
  var items = _dispoState[etabId] || [];
  var item = items.find(function(x) { return x.id === itemId; });
  if (!item) return;
  item.active = item.active === false ? true : false;
  item.updatedAt = Date.now();
  saveDispoState(etabId);
  refreshDispoManagerOnCard(etabId);
  refreshDispoPublicOnCard(etabId);
};

// ── Construire le panneau gérant HTML ───────────────────────────
function buildDispoManagerGrid(e) {
  var etabId = e.id;
  var items = _dispoState[etabId];
  if (!items) {
    // Charger et abonner au live
    loadDispoState(etabId, function() { refreshDispoManagerOnCard(etabId); });
    subscribeDispoLive(etabId);
    return "<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.6rem;'>⏳ Chargement...</div>";
  }
  subscribeDispoLive(etabId);
  if (!items.length) {
    return "<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem 0;'>Aucun indicateur — ajoutez-en un ci-dessous.</div>";
  }
  var html = "";
  items.forEach(function(item) {
    var isActive = item.active !== false;
    var dotCls = !isActive ? "" : item.type === "oui_non" ? (item.val ? "ok" : "empty") : item.val > 5 ? "ok" : item.val > 0 ? "low" : "empty";
    var valCls = !isActive ? "" : item.type === "oui_non" ? (item.val ? "val-ok" : "val-empty") : item.val > 5 ? "val-ok" : item.val > 0 ? "val-low" : "val-empty";
    var dispVal = item.type === "oui_non" ? (item.val ? "✅" : "❌") : item.type === "texte" ? (item.textVal || "—") : String(item.val || 0);

    html += "<div class='dispo-item-row' style='" + (!isActive ? "opacity:0.45;" : "") + "'>";
    html += "<div class='dispo-item-left'>";
    html += "<div class='dispo-status-dot " + dotCls + "'></div>";
    html += "<div class='dispo-item-icon'>" + (item.icon || "📍") + "</div>";
    html += "<div><div class='dispo-item-name'>" + escHtml(item.name || "") + "</div>";
    html += "<div class='dispo-item-sublabel'>" + (isActive ? "Visible" : "Masqué") + " · appuyer pour modifier</div></div>";
    html += "</div>";
    html += "<div class='dispo-item-controls'>";
    if (item.type === "texte") {
      html += "<input type='text' value='" + escHtml(item.textVal || "") + "' maxlength='20' style='width:90px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:7px;color:var(--text);font-size:0.78rem;padding:0.25rem 0.4rem;' onchange=\"dispoSetText(" + etabId + ",'" + item.id + "',this.value)\">";
    } else if (item.type === "oui_non") {
      html += "<button class='dispo-minus' onclick=\"dispoAdjust(" + etabId + ",'" + item.id + "',-1)\">" + (item.val ? "✕" : "✓") + "</button>";
      html += "<div class='dispo-val-display " + valCls + "'>" + dispVal + "</div>";
      html += "<button class='dispo-plus' onclick=\"dispoAdjust(" + etabId + ",'" + item.id + "',1)\">" + (item.val ? "✓" : "✕") + "</button>";
    } else {
      html += "<button class='dispo-minus' onclick=\"dispoAdjust(" + etabId + ",'" + item.id + "',-1)\">−</button>";
      html += "<div class='dispo-val-display " + valCls + "'>" + dispVal + "</div>";
      html += "<button class='dispo-plus' onclick=\"dispoAdjust(" + etabId + ",'" + item.id + "',1)\">+</button>";
    }
    html += "<button onclick=\"dispoToggleActive(" + etabId + ",'" + item.id + "')\" title='" + (isActive ? "Masquer" : "Afficher") + "' style='margin-left:0.1rem;background:none;border:none;font-size:0.9rem;cursor:pointer;opacity:0.7;'>" + (isActive ? "👁️" : "🙈") + "</button>";
    html += "<button onclick=\"dispoRemoveItem(" + etabId + ",'" + item.id + "')\" title='Supprimer' style='background:none;border:none;font-size:0.75rem;cursor:pointer;color:var(--red);opacity:0.6;'>🗑</button>";
    html += "</div></div>";
  });
  return html;
}

// ── Construire la bande publique HTML ────────────────────────────
function buildDispoPublicStrip(e) {
  var etabId = e.id;
  var items = _dispoState[etabId];
  if (!items) {
    loadDispoState(etabId, function() { refreshDispoPublicOnCard(etabId); });
    return ""; // ne rien afficher au 1er render, la bande apparaît dès que les données arrivent
  }
  var active = (items || []).filter(function(x) { return x.active !== false; });
  if (!active.length) return "";

  var now = Date.now();
  var lastUpd = Math.min.apply(null, active.map(function(x) { return x.updatedAt || now; }).concat([now]));
  var minAgo = Math.round((now - lastUpd) / 60000);
  var updStr = lastUpd === now ? "À l'instant" : minAgo < 60 ? "il y a " + minAgo + " min" : "il y a " + Math.round(minAgo/60) + "h";

  var chips = active.map(function(item) {
    var val = item.type === "oui_non" ? (item.val ? "Oui" : "Non") : item.type === "texte" ? (item.textVal || "—") : String(item.val || 0);
    var cls = item.type === "oui_non" ? (item.val ? "ok" : "empty") : item.val > 5 ? "ok" : item.val > 0 ? "low" : "empty";
    return "<div class='dispo-chip " + cls + "'><span class='dispo-chip-icon'>" + (item.icon || "📍") + "</span><span class='dispo-chip-val'>" + escHtml(val) + "</span><span class='dispo-chip-label'>" + escHtml(item.name || "") + "</span></div>";
  }).join("");

  return "<div class='dispo-live-strip'>" + chips + "</div>"
    + "<div class='dispo-updated'><div class='dispo-updated-dot'></div>Mis à jour " + updStr + "</div>";
}

// ── Rafraîchir en DOM direct (sans re-render la carte entière) ──
function refreshDispoPublicOnCard(etabId) {
  // La bande publique est dans .dispo-live-strip et .dispo-updated
  // On re-render juste la portion du card si trouvée
  var cards = document.querySelectorAll(".card");
  cards.forEach(function(card) {
    // Chercher l'identifiant dans les boutons du panneau
    var hasId = card.innerHTML.indexOf("dispoAdjust(" + etabId) !== -1
             || card.innerHTML.indexOf("\"dispoManagerGrid_" + etabId) !== -1
             || card.innerHTML.indexOf("dispoManagerGrid_" + etabId) !== -1;
    if (!hasId) return;
    // Trouver la strip existante
    var strip = card.querySelector(".dispo-live-strip");
    var updEl = card.querySelector(".dispo-updated");
    var etab = etablissements.find(function(x) { return x.id === etabId; });
    if (!etab) return;
    var newStrip = buildDispoPublicStrip(etab);
    if (!newStrip) { if (strip) strip.remove(); if (updEl) updEl.remove(); return; }
    var tmp = document.createElement("div");
    tmp.innerHTML = newStrip;
    if (strip) {
      strip.replaceWith(tmp.firstChild);
      if (updEl) { var newUpd = tmp.firstChild; card.querySelector(".dispo-updated") ? card.querySelector(".dispo-updated").replaceWith(newUpd) : null; }
    }
  });
}

function refreshDispoManagerOnCard(etabId) {
  var grid = document.getElementById("dispoManagerGrid_" + etabId);
  if (!grid) return;
  var etab = etablissements.find(function(x) { return x.id === etabId; });
  if (!etab) return;
  grid.innerHTML = buildDispoManagerGrid(etab);
}

// ── Texte libre ─────────────────────────────────────────────────
window.dispoSetText = function(etabId, itemId, text) {
  var items = _dispoState[etabId] || [];
  var item = items.find(function(x) { return x.id === itemId; });
  if (!item) return;
  item.textVal = text.trim();
  item.updatedAt = Date.now();
  saveDispoState(etabId);
  refreshDispoPublicOnCard(etabId);
};

// ── Modal ajout item ──────────────────────────────────────────────
window.openDispoItemModal = function(etabId) {
  _dispoModal.etabId = etabId;
  _dispoModal.emoji = "🍽️";
  _dispoModal.dtype = "nombre";

  // Déterminer catégorie pour presets
  var etab = etablissements.find(function(x) { return x.id === etabId; });
  var cat = etab ? getCategory(etab.type) : "Bar";
  var presets = DISPO_PRESETS[cat] || DISPO_PRESETS["Bar"];

  // Render presets
  var phtml = "";
  presets.forEach(function(p) {
    phtml += "<div class='dispo-preset-chip' onclick=\"applyDispoPreset('" + escHtml(p.icon) + "','" + escHtml(p.name) + "'," + p.val + ",'" + p.type + "')\">" + p.icon + " " + escHtml(p.name) + "</div>";
  });
  document.getElementById("dispoPresetChips").innerHTML = phtml;

  // Render emojis
  var ehtml = "";
  DISPO_EMOJIS.forEach(function(em) {
    ehtml += "<div class='dispo-emoji-opt" + (em === _dispoModal.emoji ? " sel" : "") + "' onclick=\"selectDispoEmoji('" + em + "',this)\">" + em + "</div>";
  });
  document.getElementById("dispoEmojiGrid").innerHTML = ehtml;

  // Reset fields
  document.getElementById("dispoItemName").value = "";
  document.getElementById("dispoItemVal").value = "10";
  document.getElementById("dispoItemTextVal").value = "";
  selectDispoType("nombre", document.querySelector(".dispo-type-btn[data-dtype='nombre']"));

  document.getElementById("dispoItemOverlay").classList.add("show");
};

window.closeDispoItemModal = function() {
  document.getElementById("dispoItemOverlay").classList.remove("show");
};

window.applyDispoPreset = function(icon, name, val, type) {
  selectDispoEmoji(icon, null);
  document.getElementById("dispoItemName").value = name;
  document.getElementById("dispoItemVal").value = val;
  selectDispoType(type, document.querySelector(".dispo-type-btn[data-dtype='" + type + "']"));
};

window.selectDispoEmoji = function(em, el) {
  _dispoModal.emoji = em;
  document.querySelectorAll(".dispo-emoji-opt").forEach(function(x) { x.classList.remove("sel"); });
  if (el) el.classList.add("sel");
  else {
    document.querySelectorAll(".dispo-emoji-opt").forEach(function(x) {
      if (x.textContent === em) x.classList.add("sel");
    });
  }
};

window.selectDispoType = function(dtype, btn) {
  _dispoModal.dtype = dtype;
  document.querySelectorAll(".dispo-type-btn").forEach(function(x) { x.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  var nf = document.getElementById("dispoValField");
  var tf = document.getElementById("dispoTextValField");
  if (dtype === "texte") { if(nf) nf.style.display = "none"; if(tf) tf.style.display = "block"; }
  else { if(nf) nf.style.display = "block"; if(tf) tf.style.display = "none"; }
  if (dtype === "oui_non" && nf) {
    var inp = nf.querySelector("input");
    if (inp) { inp.type = "text"; inp.value = "1"; inp.placeholder = "1 = Oui, 0 = Non"; }
  } else if (dtype === "nombre" && nf) {
    var inp2 = nf.querySelector("input");
    if (inp2) { inp2.type = "number"; inp2.placeholder = "Ex: 10"; }
  }
};

window.confirmAddDispoItem = function() {
  var etabId = _dispoModal.etabId;
  var name = (document.getElementById("dispoItemName").value || "").trim();
  var dtype = _dispoModal.dtype;
  if (!name) { showToast("Donnez un nom à l'indicateur"); return; }

  var val = 0, textVal = "";
  if (dtype === "nombre" || dtype === "oui_non") {
    val = parseInt(document.getElementById("dispoItemVal").value || "0") || 0;
  } else {
    textVal = (document.getElementById("dispoItemTextVal").value || "").trim();
  }

  if (!_dispoState[etabId]) _dispoState[etabId] = [];

  // Vérifier doublon
  var already = _dispoState[etabId].find(function(x) { return x.name.toLowerCase() === name.toLowerCase(); });
  if (already) { showToast("Cet indicateur existe déjà"); return; }

  _dispoState[etabId].push({
    id: "dispo_" + Date.now() + "_" + Math.random().toString(36).slice(2,6),
    icon: _dispoModal.emoji,
    name: name,
    val: val,
    textVal: textVal,
    type: dtype,
    active: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });

  saveDispoState(etabId);
  refreshDispoManagerOnCard(etabId);
  refreshDispoPublicOnCard(etabId);
  closeDispoItemModal();
  showToast("✅ " + name + " ajouté en direct !");
};

// ── Auto-initialisation : charger les dispos de tous les étabs ──
(function initAllDispos() {
  function _tryInit() {
    if (!window.etablissements || !window.etablissements.length) {
      setTimeout(_tryInit, 600);
      return;
    }
    // Charger les dispos de tous les étabs en arrière-plan
    window.etablissements.forEach(function(e) {
      loadDispoState(e.id, function() {
        refreshDispoPublicOnCard(e.id);
      });
      subscribeDispoLive(e.id);
    });
  }
  _tryInit();
})();

window.dispoAdjust = window.dispoAdjust;
window.dispoRemoveItem = window.dispoRemoveItem;
window.dispoToggleActive = window.dispoToggleActive;
window.dispoSetText = window.dispoSetText;
window.openDispoItemModal = window.openDispoItemModal;
window.closeDispoItemModal = window.closeDispoItemModal;
window.applyDispoPreset = window.applyDispoPreset;
window.selectDispoEmoji = window.selectDispoEmoji;
window.selectDispoType = window.selectDispoType;
window.confirmAddDispoItem = window.confirmAddDispoItem;

// ══════════════════════════════════════════════════════════════
// ══  ESPACE GÉRANT PRO — FONCTIONS JAVASCRIPT               ══
// ══════════════════════════════════════════════════════════════

// ── Switcher d'onglet ─────────────────────────────────────────
window.proTab = function(eid, name, btn) {
  ["dispo","statut","medias","calendar","stats"].forEach(function(t) {
    var p = document.getElementById("proPane-"+eid+"-"+t);
    if(p) p.className = "pro-tab-pane" + (t === name ? "" : " pro-pane-hidden");
  });
  var tabs = document.getElementById("proTabs-"+eid);
  if(tabs) tabs.querySelectorAll(".pro-tab").forEach(function(b){ b.classList.remove("pro-tab-active"); });
  if(btn) btn.classList.add("pro-tab-active");
  if(name === "calendar") loadCalendar(eid, function() {});
  if(name === "stats") { proLoadResa(eid); proLoadAvis(eid); }
};

// ── Helper : sauver dans pro_data (sous-collection Firebase) ─
function _proSave(eid, fields) {
  var e = etablissements.find(function(x){ return x.id == eid; });
  if(!e){ showToast("Établissement introuvable"); return; }
  if(!e.pro_data) e.pro_data = {};
  Object.keys(fields).forEach(function(k){ e.pro_data[k] = fields[k]; });
  if(!e._docId || !window.db || !window.fbUpdateDoc || !window.fbDoc){ showToast("💾 Sauvegardé localement"); return; }
  var fbFields = {};
  Object.keys(fields).forEach(function(k){ fbFields["pro_data."+k] = fields[k]; });
  window.fbUpdateDoc(window.fbDoc(window.db,"etablissements",e._docId), fbFields)
    .then(function(){ showToast("✅ Mis à jour en direct !"); })
    .catch(function(err){ showToast("Erreur : "+err.message); });
}

// ── Statut / Ambiance ──────────────────────────────────────────
window.proStat = function(eid, statut) {
  updateField(eid, { statut: statut, _adminOverride: true });
  // Mettre à jour le pill du panneau Pro
  var pill = document.querySelector("#proPan-"+eid+" .pro-status-pill");
  var isOpen = statut.indexOf("Ouvert") !== -1;
  if(pill){
    pill.className = "pro-status-pill " + (isOpen ? "pro-pill-open" : "pro-pill-closed");
    pill.textContent = isOpen ? "🟢 Ouvert" : "🔴 Fermé";
  }
  // Désactiver tous les boutons statut et activer le bon
  document.querySelectorAll("#proPan-"+eid+" .pro-stat-btn").forEach(function(b){ b.className="pro-stat-btn"; });
  var map = {"Ouvert - Anime":"psb-open","Ferme":"psb-closed","Ouvert - Bonde":"psb-full","Ouvert - Calme":"psb-calm"};
  document.querySelectorAll("#proPan-"+eid+" .pro-stat-btn").forEach(function(b){
    if(b.textContent.trim().indexOf(statut.replace("Ouvert - ","")) !== -1 && map[statut]){
      b.classList.add(map[statut]);
    }
  });
  showToast(isOpen ? "🟢 Ouvert — "+statut.replace("Ouvert - ","") : "🔴 Fermé");
};

// ── Affluence slider ───────────────────────────────────────────
window.proAff = function(eid, val) {
  updateField(eid, { affluence: val });
};

// ── File d'attente ─────────────────────────────────────────────
window.proFile = function(eid, delta) {
  var e = etablissements.find(function(x){ return x.id == eid; });
  if(!e) return;
  if(!e.pro_data) e.pro_data = {};
  var d = e.pro_data.dispo || {};
  var v = Math.max(0, (d.file_attente||0) + delta);
  d.file_attente = v;
  _proSave(eid, { dispo: d });
  var el = document.getElementById("proFile-"+eid);
  if(el) el.textContent = v;
};
window.proFileZero = function(eid) {
  var e = etablissements.find(function(x){ return x.id == eid; });
  if(!e || !e.pro_data) return;
  var d = e.pro_data.dispo || {};
  d.file_attente = 0;
  _proSave(eid, { dispo: d });
  var el = document.getElementById("proFile-"+eid);
  if(el) el.textContent = 0;
  showToast("File d'attente vidée ✓");
};

// ── Disponibilités numérotées ──────────────────────────────────
window.proAdj = function(eid, key, delta) {
  var e = etablissements.find(function(x){ return x.id == eid; });
  if(!e) return;
  if(!e.pro_data) e.pro_data = {};
  var d = e.pro_data.dispo || {};
  var v = Math.max(0, (d[key]||0) + delta);
  d[key] = v;
  _proSave(eid, { dispo: d });
  _proDispoUpdateDOM(eid, key, v);
};
window.proSet = function(eid, key) {
  var inp = document.getElementById("pds-"+eid+"-"+key);
  if(!inp || inp.value === "") return;
  var v = Math.max(0, parseInt(inp.value)||0);
  inp.value = "";
  var e = etablissements.find(function(x){ return x.id == eid; });
  if(!e) return;
  if(!e.pro_data) e.pro_data = {};
  var d = e.pro_data.dispo || {};
  d[key] = v;
  _proSave(eid, { dispo: d });
  _proDispoUpdateDOM(eid, key, v);
};
function _proDispoUpdateDOM(eid, key, v) {
  var el = document.getElementById("pdn-"+eid+"-"+key);
  if(el){
    el.textContent = v;
    el.className = "pro-dispo-num" + (v===0?" pdn-zero":v<=2?" pdn-low":"");
  }
  var card = document.getElementById("pdc-"+eid+"-"+key);
  if(card) card.style.borderColor = v===0?"rgba(255,68,102,0.4)":v<=2?"rgba(255,215,0,0.4)":"rgba(255,255,255,0.065)";
}

// ── Promo du jour ──────────────────────────────────────────────
window.proSavePromo = function(eid) {
  var inp = document.getElementById("proPromo-"+eid);
  if(!inp) return;
  var val = (inp.value||"").trim();
  _proSave(eid, { promo_jour: val });
  // Mettre à jour le bandeau public dans la fiche
  var bar = document.getElementById("pubPromoBar-"+eid);
  if(bar){
    if(val){ bar.style.display="flex"; var t=bar.querySelector(".pub-promo-txt"); if(t)t.textContent=val; }
    else bar.style.display="none";
  }
  showToast(val ? "🏷️ Offre publiée en direct !" : "🏷️ Offre retirée");
};

// ── Message d'ambiance ─────────────────────────────────────────
window.proSaveMsg = function(eid) {
  var inp = document.getElementById("proMsg-"+eid);
  if(!inp) return;
  var val = (inp.value||"").trim();
  _proSave(eid, { msg_ambiance: val });
  var el = document.getElementById("pubMsgAmb-"+eid);
  if(el){
    if(val){ el.style.display="flex"; var t=el.querySelector(".pub-msg-amb-txt"); if(t)t.textContent="📢 "+val; }
    else el.style.display="none";
  }
  showToast(val ? "📢 Message publié !" : "📢 Message retiré");
};

// ── Menu du jour ───────────────────────────────────────────────
window.proSaveMenu = function(eid) {
  var inp = document.getElementById("proMenu-"+eid);
  if(!inp) return;
  var val = (inp.value||"").trim();
  _proSave(eid, { menu_jour: val });
  var el = document.getElementById("pubMenuBanner-"+eid);
  if(el){
    if(val){ el.style.display="block"; var t=el.querySelector(".pub-menu-txt"); if(t)t.textContent=val; }
    else el.style.display="none";
  }
  showToast(val ? "🍽️ Menu publié en direct !" : "🍽️ Menu retiré");
};

// ── Horaires ───────────────────────────────────────────────────
window.proSaveHoraires = function(eid) {
  var ouv  = (document.getElementById("proHOuv-"+eid)||{}).value||"";
  var ferm = (document.getElementById("proHFerm-"+eid)||{}).value||"";
  if(!ouv||!ferm){ showToast("Renseignez l'ouverture ET la fermeture"); return; }
  updateField(eid, { ouverture: ouv, fermeture: ferm });
  showToast("🕒 Horaires mis à jour : "+ouv+" → "+ferm);
};

// ── Réservations en attente ────────────────────────────────────
window.proLoadResa = function(eid) {
  var container = document.getElementById("proResaList-"+eid);
  if(!container) return;
  if(!window.db||!window.fbCollection||!window.fbGetDocs||!window.fbQuery||!window.fbWhere){
    container.innerHTML="<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>Firebase non disponible</div>";
    return;
  }
  container.innerHTML="<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>⏳ Chargement…</div>";
  var q = window.fbQuery(
    window.fbCollection(window.db,"reservations"),
    window.fbWhere("etablissementId","==",String(eid)),
    window.fbWhere("statut","==","en_attente")
  );
  window.fbGetDocs(q).then(function(snap){
    var list=[];
    snap.forEach(function(d){ list.push(Object.assign({_docId:d.id},d.data())); });
    // Mettre à jour KPI
    var kpi = document.getElementById("proKpiResa-"+eid);
    if(kpi) kpi.textContent = list.length;
    if(!list.length){
      container.innerHTML="<div style='font-size:0.72rem;color:var(--green);text-align:center;padding:0.7rem;'>✅ Aucune réservation en attente</div>";
      return;
    }
    var html="";
    list.forEach(function(r){
      var did=(r._docId||"").replace(/"/g,"");
      var eidStr=String(eid);
      html+="<div class='pro-resa-item'>"
        +"<div><div class='pro-resa-nom'>"+escHtml(r.userNom||r.pseudo||"Client")+" · "+escHtml(String(r.nbPersonnes||1))+" pers.</div>"
        +"<div class='pro-resa-dtl'>"+escHtml(r.userTel||r.telephone||"")+(r.message?" · "+escHtml((r.message||"").substring(0,30)):"")+"</div>"
        +(r.services?"<div class='pro-resa-dtl' style='color:var(--amber);'>📦 "+escHtml((r.services||"").substring(0,40))+"</div>":"")
        +"</div>"
        +"<div style='display:flex;flex-direction:column;gap:0.22rem;flex-shrink:0;'>"
        +"<button class='pro-resa-ok' onclick='repondreReservation(\""+did+"\",\"confirmée\",\""+eidStr+"\")'>✅ Confirmer</button>"
        +"<button class='pro-resa-ko' onclick='repondreReservation(\""+did+"\",\"refusée\",\""+eidStr+"\")'>✕ Refuser</button>"
        +"</div></div>";
    });
    container.innerHTML=html;
  }).catch(function(err){
    container.innerHTML="<div style='font-size:0.72rem;color:var(--red);text-align:center;padding:0.7rem;'>Erreur : "+escHtml(err.message)+"</div>";
  });
};

// ── Derniers avis ──────────────────────────────────────────────
window.proLoadAvis = function(eid) {
  var container = document.getElementById("proAvisList-"+eid);
  if(!container) return;
  if(!window.db||!window.fbCollection||!window.fbGetDocs||!window.fbQuery){
    container.innerHTML="<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>Firebase non disponible</div>";
    return;
  }
  container.innerHTML="<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>⏳ Chargement…</div>";
  var buildQ = function(){
    try {
      if(window.fbOrderBy) return window.fbQuery(window.fbCollection(window.db,"etablissements",String(eid),"commentaires"),window.fbOrderBy("ts","desc"));
    } catch(e){}
    return window.fbCollection(window.db,"etablissements",String(eid),"commentaires");
  };
  window.fbGetDocs(buildQ()).then(function(snap){
    var list=[];
    snap.forEach(function(d){ list.push(d.data()); });
    if(!list.length){
      container.innerHTML="<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>Aucun avis pour l'instant</div>";
      return;
    }
    var html="";
    list.slice(0,6).forEach(function(c){
      var stars="";
      if(c.note){ for(var i=0;i<5;i++) stars+=i<Math.round(c.note)?"★":"☆"; }
      html+="<div class='pro-avis-item'>"
        +"<div class='pro-avis-author'>"+escHtml(c.pseudo||"Membre")+"</div>"
        +"<div class='pro-avis-txt'>"+escHtml((c.text||"").substring(0,100))+"</div>"
        +(stars?"<div class='pro-avis-note'>"+stars+"</div>":"")
        +"</div>";
    });
    container.innerHTML=html;
  }).catch(function(){
    container.innerHTML="<div style='font-size:0.72rem;color:var(--muted);text-align:center;'>Aucun avis.</div>";
  });
};

// ── Charger stats contacts (contacts_clics Firebase) ──────────
window.proLoadContacts = function(eid) {
  if(!window.db||!window.fbCollection||!window.fbGetDocs||!window.fbQuery||!window.fbWhere) return;
  var q = window.fbQuery(window.fbCollection(window.db,"contact_clicks"), window.fbWhere("etabId","==",String(eid)));
  window.fbGetDocs(q).then(function(snap){
    var el = document.getElementById("proKpiContacts-"+eid);
    if(el) el.textContent = snap.size||0;
  }).catch(function(){});
};

// ── Auto-init : charger les stats quand un onglet stats est ouvert ─
// (proLoadResa et proLoadAvis appelés depuis proTab)

// ── Expose publiquement ─────────────────────────────────────────
window.proTab          = window.proTab;
window.proStat         = window.proStat;
window.proAff          = window.proAff;
window.proFile         = window.proFile;
window.proFileZero     = window.proFileZero;
window.proAdj          = window.proAdj;
window.proSet          = window.proSet;
window.proSavePromo    = window.proSavePromo;
window.proSaveMsg      = window.proSaveMsg;
window.proSaveMenu     = window.proSaveMenu;
window.proSaveHoraires = window.proSaveHoraires;
window.proLoadResa     = window.proLoadResa;
window.proLoadAvis     = window.proLoadAvis;
window.proLoadContacts = window.proLoadContacts;
// ══ fin Espace Gérant Pro JS ══
function buildEtabInfoStrip(e){
  // Conservée pour compatibilité mais non utilisée directement (remplacée par buildEtabProfilePanel)
  return "";
}

function buildEtabProfilePanel(e){
  // ── TOUJOURS afficher le panneau (0 si non renseigné) ──
  var html = "<div class='etab-profile-panel'>";

  // ── Ligne capacité (stats chiffrées — toujours visibles) ──
  var stats = [];
  stats.push({icon:"🪑", val:(e.capacite_totale||0), lbl:"places"});
  stats.push({icon:"🏆", val:(e.nb_vip||0), lbl:"VIP"});
  // Chambres uniquement si renseignées
  if(e.nb_chambres>0)
    stats.push({icon:"🛏️", val:(e.nb_chambres||0), lbl:"chambres"});

  html += "<div class='epp-stats-row'>";
  stats.forEach(function(s){
    html += "<div class='epp-stat'>"
      +"<span class='epp-stat-icon'>"+s.icon+"</span>"
      +"<strong class='epp-stat-val'>"+s.val+"</strong>"
      +"<span class='epp-stat-lbl'>"+s.lbl+"</span>"
      +"</div>";
  });
  html += "</div>";

  // ── Note & avis publics ──
  html += "<div class='epp-stats-row' style='margin-top:0.3rem;'>";
  html += "<div class='epp-stat'><span class='epp-stat-icon'>⭐</span><strong class='epp-stat-val'>"+(e.note?e.note.toFixed(1):"0")+"</strong><span class='epp-stat-lbl'>note</span></div>";
  html += "<div class='epp-stat'><span class='epp-stat-icon'>💬</span><strong class='epp-stat-val'>"+(e.avis||0)+"</strong><span class='epp-stat-lbl'>avis</span></div>";
  html += "<div class='epp-stat'><span class='epp-stat-icon'>👥</span><strong class='epp-stat-val'>"+(e.affluence||0)+"%</strong><span class='epp-stat-lbl'>affluence</span></div>";
  html += "</div>";

  // ── Tags âge + dress code ──
  var tags = [];
  if(e.age_clientele)
    tags.push("<span class='epp-tag epp-tag-age'>👥 "+escHtml(e.age_clientele)+"</span>");
  else
    tags.push("<span class='epp-tag' style='opacity:0.5;'>👥 Âge : —</span>");
  if(e.dress_code)
    tags.push("<span class='epp-tag epp-tag-dress'>👔 "+escHtml(e.dress_code)+"</span>");
  else
    tags.push("<span class='epp-tag' style='opacity:0.5;'>👔 Dress code : —</span>");
  html += "<div class='epp-tags-row'>"+tags.join("")+"</div>";

  // ── Genres musicaux ──
  if(e.genres_musicaux && e.genres_musicaux.length){
    html += "<div class='epp-music-row'><span class='epp-music-icon'>🎵</span>";
    e.genres_musicaux.forEach(function(g){
      html += "<span class='epp-genre'>"+escHtml(g)+"</span>";
    });
    html += "</div>";
  } else {
    html += "<div class='epp-music-row' style='opacity:0.5;'><span class='epp-music-icon'>🎵</span><span class='epp-genre'>Musique : non renseignée</span></div>";
  }

  html += "</div>";
  return html;
}

// ── Barre live : places dispo + tendance affluence + musique ce soir ──
function buildLiveDispoBar(e, canManage){
  var hasDispo    = e.places_dispo !== undefined && e.places_dispo !== null && e.places_dispo > 0;
  var hasTendance = e.affluence_tendance && e.affluence_tendance !== "Stable";
  var hasMusiSoir = e.musique_soir && e.musique_soir.trim();
  // ── TOUJOURS afficher (public voit 0 si non renseigné) ──

  var cap = e.capacite_totale || 0;
  var dispo = e.places_dispo || 0;
  var tendance = e.affluence_tendance || "Stable";

  // Couleur du dot selon places dispo
  var dotClass = "green";
  var label = "";
  if(dispo > 0){
    var pct = cap > 0 ? Math.round((dispo / cap) * 100) : 100;
    if(pct < 20){ dotClass = "red"; label = "Presque complet"; }
    else if(pct < 50){ dotClass = "amber"; label = dispo + " place"+(dispo>1?"s":"")+" dispo"; }
    else { dotClass = "green"; label = dispo + " place"+(dispo>1?"s":"")+" dispo"; }
  } else if(tendance === "Saturé" || tendance === "Complet"){
    dotClass = "red"; label = "🔴 Complet";
  } else if(tendance === "En baisse"){
    dotClass = "amber"; label = "Places qui se libèrent";
  }

  // Badge tendance
  var tendBadge = "";
  if(tendance === "En hausse")      tendBadge = "<span class='eld-tendance up'>↗ En hausse</span>";
  else if(tendance === "En baisse") tendBadge = "<span class='eld-tendance down'>↘ Se libère</span>";
  else if(tendance === "Saturé" || tendance === "Complet") tendBadge = "<span class='eld-tendance full'>🔴 Saturé</span>";
  else if(hasDispo)                 tendBadge = "<span class='eld-tendance stab'>→ Stable</span>";

  // Libellé par défaut si aucune donnée
  if(!label) label = dispo + " place"+(dispo>1?"s":"")+" dispo";

  var html = "<div class='etab-live-dispo'>";
  html += "<div class='eld-dot "+dotClass+"'></div>";
  html += "<span class='eld-label'>"+escHtml(label)+"</span>";
  html += "<span class='eld-sub'>🎵 Ce soir : "+(hasMusiSoir?escHtml(e.musique_soir):"non renseigné")+"</span>";
  if(tendBadge) html += tendBadge;
  else html += "<span class='eld-tendance stab'>→ Stable</span>";
  html += "</div>";
  return html;
}

function buildCompactRow(e, rank, extraClass){
  extraClass = extraClass || "";
  var cat  = getCategory(e.type);
  var ci   = getCatInfoForEtab(e);
  var sc   = computeRankScore(e);
  var aff  = e.affluence || 0;
  var st   = (e.statut || "").toLowerCase();

  // Rang coloré
  var rankCls = rank === 1 ? "gold" : rank === 2 ? "silver" : rank === 3 ? "bronze" : "";

  // Statut pill
  var statLabel = "", statCls = "inconnu";
  if(st.indexOf("bond") !== -1 || st.indexOf("bonde") !== -1){ statLabel = "🔴 Bondé"; statCls = "bonde"; }
  else if(st.indexOf("anime") !== -1 || st.indexOf("animé") !== -1){ statLabel = "🟢 Animé"; statCls = "anime"; }
  else if(st.indexOf("calme") !== -1){ statLabel = "🟡 Calme"; statCls = "calme"; }
  else if(aff > 70){ statLabel = "🔴 Bondé"; statCls = "bonde"; }
  else if(aff > 35){ statLabel = "🟢 Animé"; statCls = "anime"; }
  else if(aff > 0){ statLabel = "🟡 Calme"; statCls = "calme"; }

  // Note étoile
  var note = e.note ? e.note.toFixed(1) : "—";

  // Score bar %
  var scorePct = Math.min(100, sc.score);

  // Photo miniature pour le panneau déployé
  var permPhoto = e._photo_profile_approved || e.photo_interieur || e.photo_exterieur || getGooglePhotoUrl(e,'exterieur') || e._fallback_svg || "";
  var canManage = isAdmin || isResponsable(e.id);

  // Contact row compact
  var contact = e.contact ? e.contact.replace(/\s/g,"") : "";
  var waUrl = contact ? "https://wa.me/"+(contact.replace(/\+/g,""))+"?text="+encodeURIComponent("Bonjour "+escHtml(e.nom)+" (via AMBI241)") : "";
  var telUrl = contact ? "tel:"+contact : "";

  // Nom vert clignotant si établissement proche (GPS) ou correspondant à la recherche
  var _isGpsNear = extraClass.indexOf("card-prox-near") !== -1;
  var _sqr = (document.getElementById("searchInput") ? document.getElementById("searchInput").value : "").toLowerCase().trim();
  var _isSearchMatch = _sqr && (
    e.nom.toLowerCase().indexOf(_sqr) !== -1 ||
    (e.quartier && e.quartier.toLowerCase().indexOf(_sqr) !== -1)
  );
  var _nameCls = (_isGpsNear || _isSearchMatch) ? " search-match-near" : "";

  var html = "";

  // ─ Ligne condensée ─
  html += "<div class='compact-row"+(extraClass?" "+extraClass:"")+"' id='cr-"+e.id+"' onclick='toggleCompactDetail("+e.id+")'>";
  html += "<div class='cr-rank "+rankCls+"'>"+rank+"</div>";
  html += "<div class='cr-icon'>"+ci.icon+"</div>";
  html += "<div class='cr-name"+_nameCls+"'>"+escHtml(e.nom)+"</div>";
  if(statLabel) html += "<div class='cr-status "+statCls+"'>"+statLabel+"</div>";
  html += "<div class='cr-score'>⭐ "+note+"</div>";
  html += "<div class='cr-chevron'>▼</div>";
  html += "</div>";

  // ─ Panneau déployé ─
  html += "<div class='compact-detail' id='cd-"+e.id+"'>";

  // Photo + infos
  if(permPhoto){
    html += "<div style='height:90px;overflow:hidden;position:relative;background:#000;cursor:pointer;' onclick='openFullscreenPhoto(\""+permPhoto.replace(/"/g,"&quot;").replace(/'/g,"\\'")+'",'+e.id+',"profile","'+escHtml(e.nom).replace(/"/g,"&quot;")+"\")'>";
    html += "<img src='"+permPhoto+"' loading='lazy' style='width:100%;height:100%;object-fit:cover;display:block;opacity:0.85;'>";
    html += "<div style='position:absolute;inset:0;background:linear-gradient(to right,rgba(0,0,0,0.6) 0%,transparent 50%);'></div>";
    html += "<div style='position:absolute;left:0.7rem;top:50%;transform:translateY(-50%);'>";
    html += "<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;color:#fff;'>"+escHtml(e.nom)+"</div>";
    html += "<div style='font-size:0.62rem;color:rgba(255,255,255,0.7);margin-top:0.1rem;'>"+escHtml(e.type)+" · "+escHtml(e.quartier||"")+"</div>";
    html += "</div>";
    html += "</div>";
  } else {
    html += "<div style='padding:0.5rem 0.9rem;'>";
    html += "<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;color:var(--text);'>"+escHtml(e.nom)+"</div>";
    html += "<div style='font-size:0.62rem;color:var(--muted);margin-top:0.1rem;'>"+escHtml(e.type)+" · "+escHtml(e.quartier||"")+"</div>";
    html += "</div>";
  }

  // Score bar
  html += "<div class='cr-score-bar-wrap'>";
  html += "<span>Score</span>";
  html += "<div class='cr-score-bar'><div class='cr-score-fill' style='width:"+scorePct+"%'></div></div>";
  html += "<span style='color:var(--amber);font-weight:800;'>"+sc.score+"</span>";
  html += "</div>";

  // Infos rapides
  html += "<div style='display:flex;gap:0.5rem;flex-wrap:wrap;padding:0.45rem 0.9rem 0.5rem;font-size:0.65rem;color:var(--muted);border-top:1px solid rgba(255,255,255,0.05);'>";
  if(e.ambiance) html += "<span>✨ "+escHtml(e.ambiance)+"</span>";
  if(e.avis) html += "<span>💬 "+e.avis+" avis</span>";
  if(e.affluence) html += "<span>👥 Affluence "+e.affluence+"%</span>";
  html += "</div>";

  // Contacts + bouton fiche complète
  html += "<div style='display:flex;gap:0.4rem;padding:0.45rem 0.9rem 0.7rem;flex-wrap:wrap;border-top:1px solid rgba(255,255,255,0.05);'>";
  if(waUrl) html += "<a href='"+waUrl+"' target='_blank' class='cc-btn cc-btn-wa' onclick=\"logContactClick('"+e.id+"','"+escHtml(e.nom).replace(/'/g,"\\'")+"','whatsapp')\">💬 WA</a>";
  if(telUrl) html += "<a href='"+telUrl+"' class='cc-btn cc-btn-tel' onclick=\"logContactClick('"+e.id+"','"+escHtml(e.nom).replace(/'/g,"\\'")+"','telephone')\">📞 Appeler</a>";
  if(e.maps_url) html += "<a href='"+e.maps_url+"' target='_blank' class='cc-btn cc-btn-mail' style='background:rgba(0,229,255,0.1);border-color:rgba(0,229,255,0.3);color:var(--cyan);'>📍 Maps</a>";
  html += "<button class='cc-btn' style='background:rgba(255,45,155,0.1);border:1px solid rgba(255,45,155,0.3);color:var(--pink);margin-left:auto;' onclick=\"event.stopPropagation();openFicheEtab("+e.id+")\">Fiche complète →</button>";
  html += "</div>";

  // Boutons admin
  if(canManage){
    html += "<div style='padding:0.35rem 0.9rem 0.55rem;border-top:1px solid rgba(255,255,255,0.05);display:flex;gap:0.4rem;flex-wrap:wrap;'>";
    html += "<button onclick=\"event.stopPropagation();openEditPanel("+e.id+")\" style='background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.3);color:var(--amber);font-size:0.68rem;font-weight:700;padding:0.28rem 0.65rem;border-radius:8px;cursor:pointer;font-family:DM Sans,sans-serif;'>✏️ Modifier</button>";
    html += "</div>";
  }

  html += "</div>"; // fin compact-detail
  return html;
}

window.toggleCompactDetail = function(eid){
  // Ouvrir la fiche publique complète détaillée
  var etab = etablissements.find(function(x){ return x.id === eid || String(x.id) === String(eid); });
  if(etab && typeof window.openPublicProfile === 'function'){
    window.openPublicProfile('etablissement', eid, etab);
  }
};

function buildCard(e,delay,compact,rank,extraClass){
  delay=delay||0;compact=compact||false;extraClass=extraClass||"";
  var sc=statusClass(e.statut);
  var cat=getCategory(e.type);
  var ci=getCatInfoForEtab(e);
  var aff=e.affluence||0;
  var affColor=aff>70?"var(--red)":aff>40?"var(--amber)":"var(--green)";

  // Bandeau "Mon établissement" si épinglé (membre propriétaire)
  var pinnedBanner = "";
  if(e._isPinned && !isAdmin && currentUserEmail){
    pinnedBanner = "<div style='background:linear-gradient(90deg,rgba(255,45,155,0.15),rgba(0,229,255,0.08));border-bottom:2px solid rgba(255,45,155,0.4);padding:0.42rem 0.9rem;display:flex;align-items:center;gap:0.5rem;'>"
      +"<span style='font-size:0.85rem;'>📌</span>"
      +"<span style='font-family:Syne,sans-serif;font-weight:800;font-size:0.72rem;color:var(--pink);'>Mon établissement</span>"
      +"<span style='font-size:0.62rem;color:var(--muted);'>— Épinglé pour modération rapide</span>"
      +"</div>";
  }

  // ── OPTION 1 : Bandeau flash événement ce soir ──
  var eventFlashHtml = "";
  var evt = e.event_flash;
  if(evt && evt.texte){
    var evtNow = Date.now();
    var evtExpire = evt.expire || (evt.ts + (evt.duree || 6) * 3600000);
    if(evtNow < evtExpire){
      var evtTimeLeft = evtExpire - evtNow;
      var evtH = Math.floor(evtTimeLeft / 3600000);
      var evtM = Math.floor((evtTimeLeft % 3600000) / 60000);
      var evtExpireStr = evtH > 0 ? "Expire dans " + evtH + "h " + evtM + "min" : "Expire dans " + evtM + " min";
      var evtWaTel = (e.contact||"").replace(/\s/g,"").replace(/\+/g,"");
      var evtWaMsg = encodeURIComponent("Bonjour " + (e.nom||"").replace(/'/g,"") + " (via AMBI241) — j'ai vu votre événement ce soir : " + (evt.texte||""));
      var evtWaUrl = evtWaTel ? "https://wa.me/" + evtWaTel + "?text=" + evtWaMsg : "";
      eventFlashHtml = "<div class='card-event-flash'>"
        + "<div class='cef-live'></div>"
        + "<div class='cef-body'>"
        + "<div class='cef-tag'>🎤 Événement ce soir</div>"
        + "<div class='cef-title'>" + escHtml(evt.texte) + "</div>"
        + (evt.detail ? "<div class='cef-sub'>" + escHtml(evt.detail) + "</div>" : "")
        + "<div class='cef-expire'>⏱ " + evtExpireStr + "</div>"
        + "</div>"
        + "<div class='cef-actions'>"
        + "<button class='cef-btn-open' onclick=\"goToEtab("+e.id+")\">Voir →</button>"
        + (evtWaUrl ? "<a style='background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.4);color:#25d366;font-size:0.58rem;font-weight:800;padding:0.22rem 0.5rem;border-radius:6px;text-decoration:none;display:block;text-align:center;font-family:DM Sans,sans-serif;' href='" + evtWaUrl + "' target='_blank' onclick=\"logContactClick('" + e.id + "','" + (e.nom||"").replace(/'/g,"") + "','whatsapp')\">💬 WA</a>" : "")
        + "</div>"
        + "</div>";
    }
  }

  // ── PHOTOS ──
  var slotPhotos=loadSlotPhotos(e.id);
  // ── Photo principale : approved > manuelle > Google > défaut admin > fallback SVG ──
  var permPhoto = e._photo_profile_approved || e.photo_interieur || e.photo_exterieur || getGooglePhotoUrl(e,'exterieur') || getAdminDefaultPhotoForEtab(e) || e._fallback_svg || generateFallbackPhoto(e.type, e.nom);
  var isProfileApproved = !!e._photo_profile_approved;
  var isManual = !isProfileApproved && (!!e.photo_interieur || !!e.photo_exterieur);
  var isGoogleAuto = !isProfileApproved && !isManual && !!permPhoto && (e._gphoto_urls && e._gphoto_urls.length > 0);
  var isFallbackSvg = !isProfileApproved && !isManual && !isGoogleAuto && !!e._fallback_svg && permPhoto === e._fallback_svg;
  var canManage = isAdmin || isResponsable(e.id);

  var photosHtml = "<div style='width:100%;'>";

  // ── GALERIE CE SOIR directement + fallback permPhoto (toujours rempli via generateFallbackPhoto) ──
  // Priorité : slotPhotos[0] (ce soir) > permPhoto (jamais vide)
  var displayedPhoto = (slotPhotos.length > 0) ? slotPhotos[0].url : permPhoto;
  
  photosHtml += "<div id='photo-wrap-"+e.id+"' style='position:relative;height:120px;overflow:hidden;background:rgba(255,45,155,0.06);cursor:pointer;'>";
  if(displayedPhoto){
    // Afficher la photo (slot ou permPhoto)
    var isSlotPhoto = slotPhotos.length > 0;
    photosHtml += "<img src='"+displayedPhoto+"' loading='lazy' style='width:100%;height:100%;object-fit:cover;display:block;' onclick='"+(isSlotPhoto ? "openSlotLightbox("+e.id+",0)" : "openFullscreenPhoto('"+displayedPhoto.replace(/'/g,"\\'")+"',"+e.id+",'profile','"+((e.nom||"").replace(/'/g,"\\'"))+"')")+"'>";
    
    if(isSlotPhoto){
      // Compteur badge supprimé (photos permanentes dans la galerie)
    }
    
    // Bouton gestion photos — UNIQUEMENT responsable/admin
    if(canManage){
      photosHtml += "<button onclick='event.stopPropagation();openPhotoManager("+e.id+",\"slot\")' style='position:absolute;top:4px;right:4px;font-size:0.55rem;font-weight:700;color:#fff;background:rgba(255,45,155,0.75);border-radius:5px;padding:0.15rem 0.4rem;cursor:pointer;z-index:5;border:none;'>📸 Gérer</button>";
    }
  } else {
    // Placeholder vide
    photosHtml += "<div style='height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.25rem;'>";
    photosHtml += "<span style='font-size:1.5rem;opacity:0.5;'>📸</span>";
    photosHtml += "<span style='font-size:0.55rem;color:var(--muted);'>Image de présentation</span>";
    // Bouton ajouter — UNIQUEMENT responsable/admin
    if(canManage){
      photosHtml += "<button onclick='openPhotoManager("+e.id+",\"slot\")' style='font-size:0.6rem;font-weight:700;color:var(--pink);cursor:pointer;background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.3);padding:0.2rem 0.5rem;border-radius:6px;margin-top:0.2rem;'>+ Ajouter</button>";
    }
    photosHtml += "</div>";
  }
  photosHtml += "</div>";

  photosHtml += "</div>"; // ferme wrapper

  // Photos soiree - photo principale permanente jusqu'au prochain upload
  var sp=soireePhotos[e.id]||[];
  var soireeHtml="";
  if(sp.length>0){
    soireeHtml="<div style='position:relative;width:100%;overflow:hidden;background:rgba(255,45,155,0.04);border-top:1px solid rgba(255,255,255,0.05);'>";
    soireeHtml+="<img src='"+sp[0].url+"' loading='lazy' style='width:100%;height:180px;object-fit:cover;display:block;cursor:zoom-in;' onclick=\"openFullscreenPhoto('"+sp[0].url.replace(/'/g,"\\'")+"',"+e.id+",'soiree','"+((e.nom||"").replace(/'/g,"\\'"))+"')\" onerror=\"this.onerror=null;this.style.height='70px';this.style.objectFit='contain';this.style.opacity='0.3';this.src='"+generateFallbackPhoto(e.type,e.nom).replace(/'/g,"\\'")+"'\">";
    soireeHtml+="<div style='display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.55rem;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);border-top:1px solid rgba(255,255,255,0.06);'>";
    soireeHtml+="<span style='font-size:0.6rem;color:var(--muted);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>📸 Galerie</span>";
    soireeHtml+="<a href='"+sp[0].url+"' download style='display:flex;align-items:center;gap:0.25rem;padding:0.28rem 0.55rem;border-radius:100px;font-size:0.65rem;font-weight:700;font-family:DM Sans,sans-serif;background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.35);color:var(--pink);text-decoration:none;'>⬇ Télécharger</a>";
    // Bouton ajouter galerie — UNIQUEMENT responsable/admin
    if(canManage){
      soireeHtml+="<button class=\"add-soiree-btn\" data-soiree-id=\""+e.id+"\" style='display:flex;align-items:center;gap:0.25rem;padding:0.28rem 0.55rem;border-radius:100px;font-size:0.65rem;font-weight:700;font-family:DM Sans,sans-serif;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.35);color:var(--cyan);cursor:pointer;'>➕ Ajouter</button>";
    }
    soireeHtml+="</div>";
    soireeHtml+="</div>";
  } else if(!compact&&canManage){
    // Placeholder galerie vide — visible seulement si responsable/admin
    soireeHtml="<div style='width:100%;height:56px;display:flex;align-items:center;justify-content:center;gap:0.5rem;background:rgba(255,45,155,0.03);border-top:1px solid rgba(255,255,255,0.04);'>";
    soireeHtml+="<span style='font-size:1.1rem;opacity:0.4;'>🔥</span>";
    soireeHtml+="<span style='font-size:0.55rem;color:var(--muted);'>Aucune photo dans la galerie</span>";
    soireeHtml+="<button class=\"add-soiree-btn\" data-soiree-id=\""+e.id+"\" style='font-size:0.6rem;font-weight:700;color:var(--pink);cursor:pointer;background:rgba(255,45,155,0.1);border:1px solid rgba(255,45,155,0.3);padding:0.2rem 0.5rem;border-radius:6px;'>+ Ajouter</button>";
    soireeHtml+="</div>";
  }

  // Maps - utilise maps_url si valide, ou génère depuis lat/lng (GPS fiable), ou recherche par nom
  var _rawMapsUrl = e.maps_url || '';
  var _mapsUrlIsOsmBroken = _rawMapsUrl && _rawMapsUrl.indexOf('place_id:osm') !== -1;
  var mapsUrl;
  if(_rawMapsUrl && !_mapsUrlIsOsmBroken){
    mapsUrl = _rawMapsUrl;
  } else if(e.lat && e.lng){
    mapsUrl = "https://maps.google.com/?q=" + e.lat + "," + e.lng + "&query=" + encodeURIComponent((e.nom||'') + ' Libreville');
  } else if(e.latitude && e.longitude){
    mapsUrl = "https://maps.google.com/?q=" + e.latitude + "," + e.longitude;
  } else {
    mapsUrl = "https://maps.google.com/?q=" + encodeURIComponent((e.nom||"") + " " + (e.quartier||"") + " Libreville Gabon");
  }
  var mapsBtn="<a href=\""+mapsUrl+"\" target=\"_blank\" class=\"maps-btn\">&#128205; Voir sur Maps</a>";

  // Affluence bar
  var affBar="";
  if(!compact){
    affBar="<div class=\"affluence-bar\">";
    affBar+="<div class=\"affluence-label\"><span>Affluence</span><span style=\"color:"+affColor+";font-weight:700;\">"+aff+"%</span></div>";
    affBar+="<div class=\"affluence-track\"><div class=\"affluence-fill\" style=\"width:"+aff+"%\"></div></div>";
    affBar+="</div>";
  }

  // Edit panel - admin only
  var ep="";
  if(isAdmin&&!compact){
    ep="<div class=\"edit-panel show\"><div class=\"edit-title\">Modifier "+e.nom+"</div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">Statut</div><div class=\"edit-opts\">";
    ep+="<button class=\"opt-btn "+(e.statut==="Ouvert - Bonde"?"sel-rouge":"")+"\" data-id=\""+e.id+"\" data-field=\"statut\" data-val=\"Ouvert - Bonde\">Bonde</button>";
    ep+="<button class=\"opt-btn "+(e.statut==="Ouvert - Anime"?"sel-vert":"")+"\" data-id=\""+e.id+"\" data-field=\"statut\" data-val=\"Ouvert - Anime\">Anime</button>";
    ep+="<button class=\"opt-btn "+(e.statut==="Ouvert - Calme"?"sel-jaune":"")+"\" data-id=\""+e.id+"\" data-field=\"statut\" data-val=\"Ouvert - Calme\">Calme</button>";
    ep+="<button class=\"opt-btn "+(e.statut==="Ferme"?"sel-noir":"")+"\" data-id=\""+e.id+"\" data-field=\"statut\" data-val=\"Ferme\">Ferme</button>";
    ep+="</div></div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">Ambiance</div><div class=\"edit-opts\">";
    ep+="<button class=\"opt-btn "+(e.ambiance==="Chill"?"sel-amb":"")+"\" data-id=\""+e.id+"\" data-field=\"ambiance\" data-val=\"Chill\">Chill</button>";
    ep+="<button class=\"opt-btn "+(e.ambiance==="Festif"?"sel-amb":"")+"\" data-id=\""+e.id+"\" data-field=\"ambiance\" data-val=\"Festif\">Festif</button>";
    ep+="<button class=\"opt-btn "+(e.ambiance==="Tres Festif"?"sel-amb":"")+"\" data-id=\""+e.id+"\" data-field=\"ambiance\" data-val=\"Tres Festif\">Tres Festif</button>";
    ep+="</div></div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">Affluence %</div>";
    ep+="<input class=\"affluence-input\" type=\"number\" min=\"0\" max=\"100\" value=\""+aff+"\" data-id=\""+e.id+"\" data-field=\"affluence\"></div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">Paiement</div><div class=\"edit-opts\">";
    ep+="<button class=\"opt-btn "+(e.paiement==="Actif"?"sel-pay":"")+"\" data-id=\""+e.id+"\" data-field=\"paiement\" data-val=\"Actif\">Actif</button>";
    ep+="<button class=\"opt-btn "+(e.paiement==="En attente"?"sel-paywait":"")+"\" data-id=\""+e.id+"\" data-field=\"paiement\" data-val=\"En attente\">En attente</button>";
    ep+="</div></div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">&#128248; Photos galerie (max "+MAX_SLOT+")</div>";
    var slotNow=loadSlotPhotos(e.id);
    ep+="<div style=\"display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;\">";
    if(slotNow.length>0){
      ep+="<span style=\"font-size:0.7rem;color:var(--green);padding:0.3rem 0;\">&#9679; "+slotNow.length+"/"+MAX_SLOT+"</span>";
      ep+="<button onclick=\"openPhotoManager("+e.id+",'slot')\" style=\"background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);font-size:0.72rem;font-weight:700;padding:0.4rem 0.7rem;border-radius:8px;cursor:pointer;\">&#128269; Gérer photos</button>";
    }
    if(slotNow.length<MAX_SLOT){
      ep+="<label for=\"__fileSlotPhoto\" class=\"mab-btn mab-upload\" style=\"padding:0.4rem 0.7rem;border-radius:8px;cursor:pointer;display:inline-block;\" onclick=\"window.__slotUploadEid="+e.id+"\">&#43; Ajouter photo</label>";
    } else {
      ep+="<span style=\"font-size:0.7rem;color:var(--amber);\">Maximum atteint</span>";
    }
    ep+="</div></div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">📸 Photos permanentes</div>";
    ep+="<div style=\"display:flex;gap:0.4rem;flex-wrap:wrap;\">";
    ep+="<button onclick=\"openPhotoManager("+e.id+",'interieur')\" style=\"flex:1;background:rgba(255,45,155,0.1);border:1px solid rgba(255,45,155,0.3);color:var(--pink);font-size:0.72rem;font-weight:700;padding:0.45rem 0.7rem;border-radius:8px;cursor:pointer;\">"+(e.photo_interieur?"✅":"➕")+" 🏠 Intérieur</button>";
    ep+="<button onclick=\"openPhotoManager("+e.id+",'exterieur')\" style=\"flex:1;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);font-size:0.72rem;font-weight:700;padding:0.45rem 0.7rem;border-radius:8px;cursor:pointer;\">"+(e.photo_exterieur?"✅":"➕")+" 🌍 Extérieur</button>";
    ep+="</div></div>";
    ep+="<div class=\"edit-row\"><div class=\"edit-lbl\">&#128205; Lien Maps</div>";
    ep+="<div style=\"display:flex;gap:0.4rem;align-items:center\">";
    ep+="<input class=\"maps-url-input\" type=\"url\" placeholder=\"https://maps.google.com/?q=...\" value=\""+(e.maps_url||"")+"\" data-id=\""+e.id+"\" style=\"flex:1;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:8px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.78rem;padding:0.5rem 0.7rem;outline:none;\">";
    ep+="<button onclick=\"saveMapsUrl("+e.id+")\" style=\"background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);font-size:0.72rem;font-weight:700;padding:0.45rem 0.7rem;border-radius:8px;cursor:pointer;white-space:nowrap;\">Sauver</button>";
    ep+="</div></div>";
    // ── Bouton Annoncer un événement (Admin) ──
    var evtActifAdmin = e.event_flash && e.event_flash.texte && (Date.now() < (e.event_flash.expire || (e.event_flash.ts + (e.event_flash.duree||6)*3600000)));
    ep+="<div class=\"edit-row\" style=\"border-top:1px solid rgba(255,45,155,0.15);padding-top:0.7rem;\">";
    ep+="<div class=\"edit-lbl\" style=\"color:var(--pink);\">📣 Événement ce soir</div>";
    if(evtActifAdmin){
      ep+="<div style=\"display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-top:0.3rem;\">";
      ep+="<span style=\"font-size:0.72rem;color:var(--green);\">✅ Actif : "+escHtml((e.event_flash.texte||"").substring(0,40))+"</span>";
      ep+="<button onclick=\"clearEventFlash("+e.id+")\" style=\"background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:var(--red);font-size:0.65rem;font-weight:700;padding:0.28rem 0.6rem;border-radius:7px;cursor:pointer;font-family:DM Sans,sans-serif;\">✕ Supprimer</button>";
      ep+="</div>";
    } else {
      ep+="<button onclick=\"openEventFlashModal("+e.id+")\" style=\"width:100%;margin-top:0.3rem;padding:0.55rem;border-radius:10px;border:1.5px solid rgba(255,45,155,0.45);background:linear-gradient(135deg,rgba(255,45,155,0.14),rgba(204,68,255,0.08));color:var(--pink);font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;\">📣 Annoncer un événement ce soir</button>";
    }
    ep+="</div>";
    ep+="<div class=\"edit-row\" style=\"margin-top:0.5rem;border-top:1px solid rgba(255,68,102,0.2);padding-top:0.7rem;\">";
    ep+="<button onclick=\"deleteEtablissement("+e.id+")\" style=\"width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(255,68,102,0.4);background:rgba(255,68,102,0.08);color:var(--red);font-family:Syne,sans-serif;font-weight:700;font-size:0.82rem;cursor:pointer;\">&#128465; Supprimer cet établissement</button>";
    ep+="</div>";
    ep+="</div></div>";
  } else if(!isAdmin && canEditPhotos(e) && !compact) {
    // ══════════════════════════════════════════════════
    // ══  ESPACE GÉRANT PRO — Panneau complet         ══
    // ══════════════════════════════════════════════════
    var cat = getCategory(e.type);
    var isResto = cat === "Restaurant" || cat === "Snack";
    var isBar   = cat === "Bar" || cat === "Bar Terrasse" || cat === "Discotheque";
    var pd = (e.pro_data) || {};
    var pdDispo = pd.dispo || {};
    var isOpen = (e.statut||"").indexOf("Ouvert") !== -1;
    var evtActif = e.event_flash && e.event_flash.texte && (Date.now() < (e.event_flash.expire || (e.event_flash.ts + (e.event_flash.duree||6)*3600000)));

    // ── Helper : carte dispo individuelle ──
    function proDispoCard(key, icon, label, max) {
      var v = pdDispo[key];
      var numCls = (v === undefined || v === null) ? "" : v === 0 ? " pdn-zero" : v <= 2 ? " pdn-low" : "";
      var display = (v !== undefined && v !== null) ? v : "—";
      var borderStyle = v === 0 ? "border-color:rgba(255,68,102,0.38);" : v !== undefined && v <= 2 ? "border-color:rgba(255,215,0,0.38);" : "";
      return "<div class='pro-dispo-card' id='pdc-"+e.id+"-"+key+"' style='"+borderStyle+"'>"
        +"<div class='pro-dispo-icon'>"+icon+"</div>"
        +"<div class='pro-dispo-lbl'>"+label+"</div>"
        +"<div class='pro-dispo-ctrl'>"
        +"<button onclick='proAdj("+e.id+",\""+key+"\",-1)'>−</button>"
        +"<span class='pro-dispo-num"+numCls+"' id='pdn-"+e.id+"-"+key+"'>"+display+"</span>"
        +"<button onclick='proAdj("+e.id+",\""+key+"\",1)'>+</button>"
        +"</div>"
        +"<div class='pro-dispo-setrow'>"
        +"<input class='pro-dispo-setinp' type='number' min='0' max='"+max+"' placeholder='Total' id='pds-"+e.id+"-"+key+"'>"
        +"<button class='pro-set-btn' onclick='proSet("+e.id+",\""+key+"\")'>Définir</button>"
        +"</div>"
        +"</div>";
    }

    ep = "<div class='pro-panel' id='proPan-"+e.id+"'>";

    // ── Header ──
    ep += "<div class='pro-panel-header'>"
      +"<div class='pro-panel-logo'>🏪</div>"
      +"<div class='pro-panel-title-col'>"
      +"<div class='pro-panel-title'>Espace Gérant Pro</div>"
      +"<div class='pro-panel-sub'>"+escHtml(e.nom)+" · "+escHtml(e.quartier||"")+"</div>"
      +"</div>"
      +"<div class='pro-status-pill "+(isOpen?"pro-pill-open":"pro-pill-closed")+"'>"+(isOpen?"🟢 Ouvert":"🔴 Fermé")+"</div>"
      +"</div>";

    // ── Onglets ──
    ep += "<div class='pro-tabs' id='proTabs-"+e.id+"'>"
      +"<button class='pro-tab pro-tab-active' onclick='proTab("+e.id+",\"dispo\",this)'>📦 Dispos</button>"
      +"<button class='pro-tab' onclick='proTab("+e.id+",\"statut\",this)'>⚡ Statut</button>"
      +"<button class='pro-tab' onclick='proTab("+e.id+",\"medias\",this)'>📸 Médias</button>"
      +"<button class='pro-tab' onclick='proTab("+e.id+",\"calendar\",this)'>📅 Calendrier</button>"
      +"<button class='pro-tab' onclick='proTab("+e.id+",\"stats\",this)'>📊 Stats</button>"
      +"</div>";

    // ════ ONGLET DISPOS ════
    ep += "<div class='pro-tab-pane' id='proPane-"+e.id+"-dispo'>";

    // Statut rapide
    ep += "<div class='pro-sec'>⚡ Statut en direct</div>";
    ep += "<div class='pro-stat-row'>"
      +"<button class='pro-stat-btn "+(isOpen&&e.statut==="Ouvert - Anime"?"psb-open":"")+"' onclick='proStat("+e.id+",\"Ouvert - Anime\")'>🟢 Ouvert</button>"
      +"<button class='pro-stat-btn "+(!isOpen?"psb-closed":"")+"' onclick='proStat("+e.id+",\"Ferme\")'>🔴 Fermé</button>"
      +"<button class='pro-stat-btn "+(e.statut==="Ouvert - Bonde"?"psb-full":"")+"' onclick='proStat("+e.id+",\"Ouvert - Bonde\")'>🔥 Bondé</button>"
      +"<button class='pro-stat-btn "+(e.statut==="Ouvert - Calme"?"psb-calm":"")+"' onclick='proStat("+e.id+",\"Ouvert - Calme\")'>🟡 Calme</button>"
      +"</div>";

    // Affluence slider
    ep += "<div class='pro-slider-row'>"
      +"<span class='pro-slider-lbl'>Affluence</span>"
      +"<input type='range' min='0' max='100' value='"+(e.affluence||0)+"' class='pro-slider' "
      +"oninput='this.nextElementSibling.textContent=this.value+\"%\"' "
      +"onchange='proAff("+e.id+",parseInt(this.value))'>"
      +"<span class='pro-slider-val'>"+(e.affluence||0)+"%</span>"
      +"</div>";

    // File d'attente
    ep += "<div class='pro-sec'>🕐 File d'attente</div>"
      +"<div class='pro-file-row'>"
      +"<button class='pro-cnt-btn' onclick='proFile("+e.id+",-1)'>−</button>"
      +"<span class='pro-cnt-val' id='proFile-"+e.id+"'>"+(pdDispo.file_attente||0)+"</span>"
      +"<span class='pro-cnt-unit'>pers. en attente</span>"
      +"<button class='pro-cnt-btn' onclick='proFile("+e.id+",1)'>+</button>"
      +"<button class='pro-cnt-zero' onclick='proFileZero("+e.id+")'>Vider</button>"
      +"</div>";

    // Grille disponibilités par type
    ep += "<div class='pro-sec'>📦 Disponibilités live</div>"
      +"<div class='pro-dispo-grid'>";
    ep += proDispoCard("places",     "🪑", "Places assises", 999);
    ep += proDispoCard("tables_vip", "🛋️", "Tables VIP", 99);
    if(isResto) {
      ep += proDispoCard("plats",    "🍽️", "Plats dispo", 999);
    }
    if(isBar || isResto) {
      ep += proDispoCard("boissons", "🍾", "Stock bouteilles", 9999);
      ep += proDispoCard("cocktails","🍹", "Cocktails", 999);
    }
    ep += "</div>"; // fin grille

    // Indicateurs libres (système existant)
    ep += "<div class='pro-sec'>🔧 Indicateurs personnalisés</div>"
      +"<div id='dispoManagerGrid_"+e.id+"'>"+buildDispoManagerGrid(e)+"</div>"
      +"<button class='dispo-add-item-btn' onclick='openDispoItemModal("+e.id+")'>+ Ajouter un indicateur (plat, chambre, place…)</button>";

    // Promo du jour
    ep += "<div class='pro-sec' style='margin-top:0.85rem;'>🏷️ Offre spéciale du jour</div>"
      +"<div style='display:flex;gap:0.4rem;align-items:flex-start;'>"
      +"<textarea id='proPromo-"+e.id+"' placeholder='Ex: Happy hour 18h-20h | 2 cocktails = 1 offert | Menu à 5000 XAF…' maxlength='120' rows='2' "
      +"style='flex:1;background:rgba(255,215,0,0.04);border:1px solid rgba(255,215,0,0.18);border-radius:9px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.76rem;padding:0.5rem 0.65rem;resize:none;outline:none;'>"+escHtml(pd.promo_jour||"")+"</textarea>"
      +"<button onclick='proSavePromo("+e.id+")' style='background:linear-gradient(135deg,rgba(255,215,0,0.2),rgba(255,45,155,0.12));border:1.5px solid rgba(255,215,0,0.42);color:var(--amber);font-family:Syne,sans-serif;font-weight:800;font-size:0.7rem;padding:0.55rem 0.65rem;border-radius:9px;cursor:pointer;white-space:nowrap;'>💾 Publier</button>"
      +"</div>"
      +(pd.promo_jour?"<div style='font-size:0.62rem;color:var(--green);margin-top:0.28rem;'>✅ En ligne : "+escHtml((pd.promo_jour||"").substring(0,55))+"…</div>":"");

    ep += "</div>"; // fin onglet dispo

    // ════ ONGLET STATUT ════
    ep += "<div class='pro-tab-pane pro-pane-hidden' id='proPane-"+e.id+"-statut'>";

    // Horaires
    ep += "<div class='pro-sec'>🕒 Horaires du jour</div>"
      +"<div style='display:flex;gap:0.45rem;align-items:center;flex-wrap:wrap;margin-bottom:0.8rem;'>"
      +"<input type='time' id='proHOuv-"+e.id+"' value='"+(e.ouverture||"18:00")+"' style='background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.18);border-radius:8px;color:var(--text);font-size:0.8rem;padding:0.38rem 0.5rem;'>"
      +"<span style='color:var(--muted);font-size:0.78rem;'>→</span>"
      +"<input type='time' id='proHFerm-"+e.id+"' value='"+(e.fermeture||"02:00")+"' style='background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.18);border-radius:8px;color:var(--text);font-size:0.8rem;padding:0.38rem 0.5rem;'>"
      +"<button onclick='proSaveHoraires("+e.id+")' style='background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.28);color:var(--cyan);font-family:Syne,sans-serif;font-weight:700;font-size:0.72rem;padding:0.4rem 0.75rem;border-radius:8px;cursor:pointer;'>💾 Sauver</button>"
      +"</div>";

    // Événement ce soir
    ep += "<div class='pro-sec'>📣 Événement ce soir</div>";
    if(evtActif){
      ep += "<div style='background:rgba(255,45,155,0.07);border:1px solid rgba(255,45,155,0.28);border-radius:9px;padding:0.55rem 0.75rem;display:flex;align-items:center;gap:0.45rem;margin-bottom:0.7rem;'>"
        +"<span style='font-size:0.73rem;color:var(--green);flex:1;'>✅ "+escHtml((e.event_flash.texte||"").substring(0,50))+"</span>"
        +"<button onclick='clearEventFlash("+e.id+")' style='background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.28);color:var(--red);font-size:0.62rem;font-weight:700;padding:0.18rem 0.5rem;border-radius:6px;cursor:pointer;font-family:DM Sans,sans-serif;'>✕ Retirer</button>"
        +"</div>";
    } else {
      ep += "<button onclick='openEventFlashModal("+e.id+")' style='width:100%;margin-bottom:0.7rem;padding:0.58rem;border-radius:10px;border:1.5px solid rgba(255,45,155,0.42);background:linear-gradient(135deg,rgba(255,45,155,0.12),rgba(204,68,255,0.07));color:var(--pink);font-family:Syne,sans-serif;font-weight:800;font-size:0.8rem;cursor:pointer;'>📣 Annoncer un événement ce soir</button>";
    }

    // Message d'ambiance
    ep += "<div class='pro-sec'>💬 Message d'ambiance</div>"
      +"<div style='display:flex;gap:0.4rem;align-items:center;margin-bottom:0.7rem;'>"
      +"<input type='text' id='proMsg-"+e.id+"' maxlength='80' value='"+escHtml(pd.msg_ambiance||"")+"' placeholder='Ex : DJ set à 22h 🎧 | Terrasse ouverte | Cuisine jusqu'à minuit…' style='flex:1;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);border-radius:9px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.78rem;padding:0.5rem 0.65rem;outline:none;'>"
      +"<button onclick='proSaveMsg("+e.id+")' style='background:rgba(255,45,155,0.1);border:1.5px solid rgba(255,45,155,0.35);color:var(--pink);font-family:Syne,sans-serif;font-weight:800;font-size:0.7rem;padding:0.52rem 0.65rem;border-radius:9px;cursor:pointer;white-space:nowrap;'>📢 Publier</button>"
      +"</div>"
      +(pd.msg_ambiance?"<div style='font-size:0.62rem;color:var(--cyan);margin-top:-0.4rem;margin-bottom:0.5rem;'>📢 En ligne : "+escHtml(pd.msg_ambiance)+"</div>":"");

    // Menu / Carte du jour
    ep += "<div class='pro-sec'>🍽️ Menu / Carte du jour</div>"
      +"<div style='display:flex;gap:0.4rem;align-items:flex-start;margin-bottom:0.7rem;'>"
      +"<textarea id='proMenu-"+e.id+"' placeholder='Ex: Entrée : Salade | Plat : Poulet DG | Dessert : Gâteau maison | Boisson incluse' maxlength='300' rows='3' "
      +"style='flex:1;background:rgba(255,255,255,0.035);border:1px solid rgba(255,255,255,0.09);border-radius:9px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.76rem;padding:0.5rem 0.65rem;resize:none;outline:none;'>"+escHtml(pd.menu_jour||"")+"</textarea>"
      +"<button onclick='proSaveMenu("+e.id+")' style='background:rgba(0,255,170,0.09);border:1.5px solid rgba(0,255,170,0.28);color:var(--green);font-family:Syne,sans-serif;font-weight:800;font-size:0.7rem;padding:0.52rem 0.65rem;border-radius:9px;cursor:pointer;white-space:nowrap;'>📋 Publier</button>"
      +"</div>"
      +(pd.menu_jour?"<div style='font-size:0.62rem;color:var(--green);margin-top:-0.3rem;margin-bottom:0.5rem;'>🍽️ Actif : "+escHtml((pd.menu_jour||"").substring(0,55))+"…</div>":"");

    // Musique ce soir (système existant)
    var curMusiSoir = e.musique_soir || "";
    ep += "<div class='pro-sec'>🎵 Musique ce soir</div>"
      +"<div style='display:flex;gap:0.4rem;margin-bottom:0.7rem;'>"
      +"<input type='text' id='musiSoirInput_"+e.id+"' value='"+escHtml(curMusiSoir)+"' placeholder='Ex: DJ Set · Afrobeats & Coupé-Décalé' maxlength='80' style='flex:1;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:8px;color:var(--text);padding:0.45rem 0.6rem;font-size:0.78rem;font-family:DM Sans,sans-serif;outline:none;'>"
      +"<button onclick='var v=(document.getElementById(\"musiSoirInput_"+e.id+"\").value||\"\").trim();updateField("+e.id+",{musique_soir:v});showToast(\"✅ Musique mise à jour\")' style='padding:0.45rem 0.8rem;border-radius:8px;background:rgba(255,45,155,0.1);border:1px solid rgba(255,45,155,0.3);color:var(--pink);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;'>OK</button>"
      +"</div>";

    // Tendance affluence (système existant)
    var curTend = e.affluence_tendance || "Stable";
    ep += "<div class='pro-sec'>📈 Tendance affluence</div>"
      +"<div style='display:flex;gap:0.3rem;flex-wrap:wrap;margin-bottom:0.7rem;'>";
    var tends = [
      {v:"En hausse",l:"↗ En hausse",cls:"tend-up"},
      {v:"Stable",   l:"→ Stable",   cls:"tend-stab"},
      {v:"En baisse",l:"↘ Se libère",cls:"tend-down"},
      {v:"Saturé",   l:"🔴 Saturé",  cls:"tend-full"}
    ];
    tends.forEach(function(t){
      ep += "<button class='tend-btn "+t.cls+(curTend===t.v?" active-tend":"")+"' onclick=\"updateField("+e.id+",{affluence_tendance:'"+t.v+"'});document.querySelectorAll('#card-etab-"+e.id+" .tend-btn').forEach(function(b){b.classList.remove('active-tend')});this.classList.add('active-tend')\">"+t.l+"</button>";
    });
    ep += "</div>";

    // Places dispo (système existant)
    var curPlacesDispo = (e.places_dispo !== undefined && e.places_dispo !== null) ? e.places_dispo : "";
    ep += "<div class='pro-sec'>🪑 Places dispo maintenant</div>"
      +"<div style='display:flex;gap:0.4rem;align-items:center;margin-bottom:0.7rem;'>"
      +"<input type='number' id='placesDispoInput_"+e.id+"' min='0' max='"+(e.capacite_totale||999)+"' value='"+curPlacesDispo+"' placeholder='Ex: 45' style='flex:1;background:var(--surface2);border:1px solid rgba(0,229,255,0.22);border-radius:8px;color:var(--text);padding:0.43rem 0.6rem;font-size:0.8rem;font-family:DM Sans,sans-serif;outline:none;'>"
      +"<button onclick='var v=parseInt(document.getElementById(\"placesDispoInput_"+e.id+"\").value)||0;updateField("+e.id+",{places_dispo:v});showToast(\"✅ Places mises à jour\")' style='padding:0.43rem 0.75rem;border-radius:8px;background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.28);color:var(--cyan);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;'>Enregistrer</button>"
      +(e.capacite_totale>0?"<span style='font-size:0.58rem;color:var(--muted);white-space:nowrap;'>/ "+e.capacite_totale+" total</span>":"")
      +"</div>";

    ep += "</div>"; // fin onglet statut

    // ════ ONGLET MÉDIAS ════
    ep += "<div class='pro-tab-pane pro-pane-hidden' id='proPane-"+e.id+"-medias'>";

    ep += "<div class='pro-sec'>📸 Photos galerie (max "+MAX_SLOT+")</div>";
    var slotNow2 = loadSlotPhotos(e.id);
    ep += "<div style='display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;margin-bottom:0.8rem;'>";
    if(slotNow2.length>0){
      ep += "<span style='font-size:0.68rem;color:var(--green);padding:0.28rem 0;'>● "+slotNow2.length+"/"+MAX_SLOT+"</span>"
        +"<button onclick='openPhotoManager("+e.id+",\"slot\")' style='background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.28);color:var(--cyan);font-size:0.7rem;font-weight:700;padding:0.38rem 0.65rem;border-radius:7px;cursor:pointer;'>👁 Gérer photos</button>";
    }
    if(slotNow2.length<MAX_SLOT){
      ep += "<label for='__fileSlotPhoto' class='mab-btn mab-upload' style='padding:0.38rem 0.7rem;border-radius:7px;cursor:pointer;display:inline-block;' onclick='window.__slotUploadEid="+e.id+";'>+ Photo galerie</label>";
    } else {
      ep += "<span style='font-size:0.68rem;color:var(--amber);'>Maximum "+MAX_SLOT+"/"+MAX_SLOT+" atteint</span>";
    }
    ep += "</div>";

    ep += "<div class='pro-sec'>🖼️ Photo officielle</div>"
      +"<button onclick='proposeGooglePhotoProfile("+e.id+")' style='width:100%;margin-bottom:0.8rem;background:rgba(255,45,155,0.09);border:1px solid rgba(255,45,155,0.28);color:var(--pink);font-size:0.73rem;font-weight:700;padding:0.48rem 0.7rem;border-radius:8px;cursor:pointer;'>"
      +(e._photo_profile_approved||e.photo_interieur?"✅ Modifier la photo de présentation":"➕ Ajouter une photo de présentation")+"</button>";

    ep += "<div class='pro-sec'>🎥 Galerie permanente</div>"
      +"<div style='display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.8rem;'>"
      +"<button onclick='openPhotoManager("+e.id+",\"interieur\")' style='flex:1;background:rgba(255,45,155,0.09);border:1px solid rgba(255,45,155,0.28);color:var(--pink);font-size:0.72rem;font-weight:700;padding:0.46rem 0.65rem;border-radius:8px;cursor:pointer;'>"+(e.photo_interieur?"✅":"➕")+" 🏠 Intérieur</button>"
      +"<button onclick='openPhotoManager("+e.id+",\"exterieur\")' style='flex:1;background:rgba(0,229,255,0.09);border:1px solid rgba(0,229,255,0.28);color:var(--cyan);font-size:0.72rem;font-weight:700;padding:0.46rem 0.65rem;border-radius:8px;cursor:pointer;'>"+(e.photo_exterieur?"✅":"➕")+" 🌍 Extérieur</button>"
      +"</div>";

    ep += "</div>"; // fin onglet médias

    // ════ ONGLET CALENDRIER ════
    ep += "<div class='pro-tab-pane pro-pane-hidden' id='proPane-"+e.id+"-calendar'>";

    ep += "<div class='pro-sec'>📅 Disponibilité de la semaine prochaine</div>";
    ep += "<div style='display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:0.4rem;margin-top:0.6rem;'>";
    
    for(var d=0; d<14; d++) {
      var date = new Date();
      date.setDate(date.getDate() + d);
      var dateStr = date.toISOString().split('T')[0];
      var avail = pdDispo && pdDispo[dateStr];
      var dow = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'][date.getDay()];
      var dom = date.getDate();
      
      ep += "<button style='background:"+(avail?"rgba(0,255,170,0.15)":"rgba(255,255,255,0.03)")+";border:1px solid "+(avail?"rgba(0,255,170,0.4)":"rgba(255,255,255,0.1)")+";border-radius:8px;padding:0.5rem;font-size:0.68rem;color:"+(avail?"var(--green)":"var(--muted)")+";font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;' "
        +"onclick='toggleDateDispo("+e.id+",\""+dateStr+"\",this)'>"
        +dow+"<br>"+dom
        +"</button>";
    }
    
    ep += "</div>";
    ep += "<div style='font-size:0.62rem;color:var(--muted);margin-top:0.5rem;'>💚 Vert = disponible | ⚪ Gris = indisponible (clients voient cela en réservant)</div>";

    ep += "</div>"; // fin onglet calendrier

    // ════ ONGLET STATS ════
    ep += "<div class='pro-tab-pane pro-pane-hidden' id='proPane-"+e.id+"-stats'>";

    ep += "<div class='pro-kpi-grid'>"
      +"<div class='pro-kpi'><div class='pro-kpi-val kv-amber' id='proKpiResa-"+e.id+"'>—</div><div class='pro-kpi-lbl'>Résas en attente</div></div>"
      +"<div class='pro-kpi'><div class='pro-kpi-val kv-cyan' id='proKpiContacts-"+e.id+"'>—</div><div class='pro-kpi-lbl'>Contacts reçus</div></div>"
      +"<div class='pro-kpi'><div class='pro-kpi-val kv-green'>"+(e.affluence||0)+"%</div><div class='pro-kpi-lbl'>Affluence actuelle</div></div>"
      +"<div class='pro-kpi'><div class='pro-kpi-val kv-pink'>"+(e.note?e.note.toFixed(1)+"★":"—")+"</div><div class='pro-kpi-lbl'>Note moy.</div></div>"
      +"</div>";

    // Réservations en attente
    ep += "<div class='pro-sec'>⭐ Réservations VIP en attente</div>"
      +"<div id='proResaList-"+e.id+"' style='margin-bottom:0.5rem;'><div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>Appuyer sur Actualiser ↓</div></div>"
      +"<button onclick='proLoadResa("+e.id+")' style='width:100%;margin-bottom:0.8rem;background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.22);color:var(--amber);font-family:Syne,sans-serif;font-weight:700;font-size:0.72rem;padding:0.42rem;border-radius:8px;cursor:pointer;'>🔄 Actualiser les réservations</button>";

    // Derniers avis
    ep += "<div class='pro-sec'>💬 Derniers avis clients</div>"
      +"<div id='proAvisList-"+e.id+"' style='margin-bottom:0.5rem;'><div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.7rem;'>Appuyer sur Actualiser ↓</div></div>"
      +"<button onclick='proLoadAvis("+e.id+")' style='width:100%;margin-bottom:0.5rem;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.18);color:var(--cyan);font-family:Syne,sans-serif;font-weight:700;font-size:0.72rem;padding:0.42rem;border-radius:8px;cursor:pointer;'>🔄 Actualiser les avis</button>";

    ep += "</div>"; // fin onglet stats

    // ── Danger zone ──
    ep += "<div class='pro-danger-row'>"
      +"<button onclick='deleteEtablissement("+e.id+")' class='pro-danger-btn'>🗑️ Supprimer mon établissement</button>"
      +"</div>";

    ep += "</div>"; // fin pro-panel
  }

  var commentsHtml = compact ? "" : buildCommentsSection(e);

  // ── Présence & Votes ──
  var presData   = getPresenceData(e.id) || { count: 0, list: [] };
  var voteData   = getVoteData(e.id) || { pos: 0, neg: 0 };
  var realAff    = computeRealAffluence(e, presData, voteData);
  var rankBadge  = buildRankBadge(e.id);
  var myPresence = isUserPresent(e.id);
  var myVote     = getMyVote(e.id);
  var presCountHtml = presData.count > 0
    ? "<span class=\"presence-count green-count\" data-live-pres=\""+e.id+"\">"+presData.count+"</span>"
    : "<span class=\"presence-count green-count\" data-live-pres=\""+e.id+"\" style=\"display:none\">0</span>";
  var presBtn = "<button class=\"presence-btn"+(myPresence?" active-presence":"")+"\" onclick=\"openPresenceModal("+e.id+")\" title=\""+(myPresence?"Vous êtes ici !":"Je suis là !")+"\">"
    + (myPresence ? "&#10003;" : "&#128204;") + presCountHtml + "</button>";

  var dotClass = realAff > 70 ? "red-dot" : realAff > 40 ? "orange" : "";
  var presRow = "<div class=\"card-presence-row\">"
    + presBtn
    + "<div class=\"presence-info\">"
    + "<div class=\"presence-label\">&#128204; Présences confirmées<span class=\"ranking-badge rank-other\" data-live-rank=\""+e.id+"\" style=\"margin-left:0.4rem;font-size:0.65rem;\">"+buildRankBadge(e.id).replace(/<[^>]+>/g,"")+"</span></div>"
    + "<div class=\"presence-live\"><div class=\"presence-dot "+dotClass+"\"></div>"
    + "<span data-live-presl=\""+e.id+"\">"+presData.count+" pers. sur place</span> &bull; Score réel: <strong style=\"color:var(--amber);margin-left:0.2rem;\">"+realAff+"%</strong></div>"
    + "</div>"
    + "<div class=\"vote-btns\">"
    + "<button class=\"vote-btn vote-pos"+(myVote==="pos"?" voted":"")+"\" onclick=\"castVote("+e.id+",'pos');voterEtablissement("+e.id+",'pos')\">&#128077; <span id=\"vpos-"+e.id+"\">"+voteData.pos+"</span></button>"
    + "<button class=\"vote-btn vote-neg"+(myVote==="neg"?" voted":"")+"\" onclick=\"castVote("+e.id+",'neg');voterEtablissement("+e.id+",'neg')\">&#128078; <span id=\"vneg-"+e.id+"\">"+voteData.neg+"</span></button>"
    + "</div>"
    + "</div>"
    + "<div class=\"real-affluence-bar\"><div class=\"real-affluence-fill\" style=\"width:"+realAff+"%\"></div></div>"
    + "<div class=\"real-affluence-label\"><span>Affluence réelle (présences + votes)</span><span class=\"ral-val\" style=\"color:"+(realAff>70?"var(--red)":realAff>40?"var(--amber)":"var(--green)")+"\">"+realAff+"%</span></div>"
    // ── Boutons signalement affluence communautaire ──
    + "<div style=\"display:flex;gap:0.3rem;flex-wrap:wrap;margin-top:0.4rem;padding:0.4rem;background:rgba(255,255,255,0.02);border-radius:10px;border:1px solid rgba(255,255,255,0.05);\">"
    + "<span style=\"font-size:0.62rem;color:var(--muted);width:100%;margin-bottom:0.2rem;\">📡 Signaler l'affluence maintenant :</span>"
    + "<button onclick=\"signalerAffluence("+e.id+",'Calme')\" style=\"flex:1;padding:0.3rem 0.2rem;border-radius:7px;border:1px solid rgba(255,215,0,0.3);background:rgba(255,215,0,0.07);color:var(--amber);font-size:0.65rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">🟡 Calme</button>"
    + "<button onclick=\"signalerAffluence("+e.id+",'Animé')\" style=\"flex:1;padding:0.3rem 0.2rem;border-radius:7px;border:1px solid rgba(0,255,170,0.3);background:rgba(0,255,170,0.07);color:var(--green);font-size:0.65rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">🟢 Animé</button>"
    + "<button onclick=\"signalerAffluence("+e.id+",'Bondé')\" style=\"flex:1;padding:0.3rem 0.2rem;border-radius:7px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.65rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">🔴 Bondé</button>"
    + "<button onclick=\"signalerAffluence("+e.id+",'Fermé')\" style=\"flex:1;padding:0.3rem 0.2rem;border-radius:7px;border:1px solid rgba(180,180,180,0.2);background:rgba(255,255,255,0.03);color:var(--muted);font-size:0.65rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">⚫ Fermé</button>"
    + "</div>";

  var aff = e.affluence || 0;
  var pendingBadge = (e.paiement === "En attente") ? " <span class=\"badge-pending\">En attente</span>" : "";
  var vipBtn = !compact ? '<div class="card-vip-row"><button class="vip-reserve-btn" '
    + 'onclick="openReservationModal(\'' + e.id + '\',\'' + e.nom.replace(/'/g,'') + '\',' + aff + ')">' 
    + '&#11088; R&#233;server une place VIP</button></div>' : '';

  // ── Bouton flottant sur le nom : réservation directe WhatsApp (même logique taxi pro) ──
  var etabContact = (e.contact||'').replace(/'/g,'');
  var etabPhotoForBtn = (e.photo_interieur||e.photo||'').replace(/'/g,'');
  var etabTypeForBtn  = (e.type||'').replace(/'/g,'');
  var etabNomForBtn   = (e.nom||'').replace(/'/g,'');
  // On expose la fn pour que le clic sur le nom ouvre le sheet direct
  window['_etabOrderBtn_'+e.id] = function() {
    openEtabQorder(
      e.id,
      encodeURIComponent(etabNomForBtn),
      encodeURIComponent(etabContact),
      encodeURIComponent(etabTypeForBtn),
      encodeURIComponent(etabPhotoForBtn)
    );
  };
  // ── Classe CSS par type pour bordure colorée ──
  var _catKey=(getCategory(e.type)||"Bar");
  var _typeClass="type-bar";
  if(_catKey==="Restaurant")_typeClass="type-restaurant";
  else if(_catKey==="Discotheque")_typeClass="type-discotheque";
  else if(_catKey==="Snack")_typeClass="type-snack";
  else if(_catKey==="Bar Terrasse")_typeClass="type-terrasse";
  else if(_catKey==="Salle")_typeClass="type-salle";
  else if(_catKey==="Stade")_typeClass="type-stade";
  else if(_catKey==="Tourisme")_typeClass="type-tourisme";

  return "<div class=\"card "+_typeClass+(extraClass?" "+extraClass:"")+"\" id=\"card-etab-"+e.id+"\" style=\"animation-delay:"+delay+"s;"+(e._isPinned&&!isAdmin?"box-shadow:0 0 18px rgba(255,45,155,0.18);":"")+(eventFlashHtml?"":"")+"\">"+ 
    pinnedBanner+
    eventFlashHtml+
    photosHtml+
    "<div class=\"card-top\">"+
    "<div class=\"card-row1\"><div>"+
    "<div class=\"card-num rank-"+(rank===1?'1':rank===2?'2':rank===3?'3':'other')+"\">N°"+(rank!=null?rank:e.id)+"</div>"+
    "<div class=\"card-name\"><button class=\"etab-name-order-btn\" onclick=\"window['_etabOrderBtn_'+"+e.id+"] && window['_etabOrderBtn_'+"+e.id+"]()\" title=\"📋 Réserver à "+e.nom.replace(/"/g,'')+"\" style=\"font-family:'Syne',sans-serif;font-size:inherit;font-weight:inherit;\">"+e.nom+" <span class=\"etab-name-order-pulse\">+</span></button> <span onclick=\"openGalerie("+e.id+")\" title=\"Voir la galerie de "+(e.nom||"").replace(/"/g,'')+"\" style=\"cursor:pointer;display:inline-flex;align-items:center;gap:0.35rem;flex-wrap:wrap;transition:color 0.2s;\"><span style=\"font-size:0.6rem;color:var(--pink);border:1px solid rgba(255,45,155,0.35);border-radius:5px;padding:0.08rem 0.3rem;font-family:DM Sans,sans-serif;font-weight:700;\">&#128247; Galerie</span>"+(e._distKm!=null?"<span class=\"dist-badge "+distClass(e._distKm)+"\">"+fmtDist(e._distKm)+"</span>":"")+"</span></div>"+
    "<span class=\"cat-badge "+ci.badge+"\" style=\"cursor:pointer;\" onclick=\"goToTypeFilter('"+getCategory(e.type)+"')\" title=\"Filtrer par "+ci.label+"\">"+ci.icon+" "+ci.label+"</span>"+
    "<div style=\"font-size:0.7rem;color:var(--cyan);margin-top:0.2rem;cursor:pointer;display:inline-flex;align-items:center;gap:0.2rem;\" onclick=\"goToQuartier('"+e.quartier.replace(/'/g,"")+"')\">&#128205; "+e.quartier+"<span style='font-size:0.55rem;opacity:0.6;'> ›</span></div>"+
    "</div>"+(e.statut ? "<span class=\"status-pill "+sc+"\">"+e.statut+"</span>" : "<span class=\"status-pill\">—</span>")+"</div>"+
    affBar+
    buildDispoPublicStrip(e)+
    buildEtabProfilePanel(e)+
    buildLiveDispoBar(e, canManage)+
    // ── Bandeau Offre spéciale du jour (pro_data.promo_jour) ──
    (function(){
      var pd = e.pro_data || {};
      var html = "";
      if(pd.promo_jour){
        html += "<div class='pub-promo-bar' id='pubPromoBar-"+e.id+"'>"
          +"<span class='pub-promo-tag'>🏷️ Offre</span>"
          +"<span class='pub-promo-txt'>"+escHtml(pd.promo_jour)+"</span>"
          +"</div>";
      } else {
        html += "<div class='pub-promo-bar' id='pubPromoBar-"+e.id+"' style='display:none;'>"
          +"<span class='pub-promo-tag'>🏷️ Offre</span><span class='pub-promo-txt'></span></div>";
      }
      if(pd.msg_ambiance){
        html += "<div class='pub-msg-amb' id='pubMsgAmb-"+e.id+"'>"
          +"<span style='font-size:0.85rem;flex-shrink:0;'>📢</span>"
          +"<span class='pub-msg-amb-txt'>"+escHtml(pd.msg_ambiance)+"</span>"
          +"</div>";
      } else {
        html += "<div class='pub-msg-amb' id='pubMsgAmb-"+e.id+"' style='display:none;'>"
          +"<span style='font-size:0.85rem;flex-shrink:0;'>📢</span><span class='pub-msg-amb-txt'></span></div>";
      }
      if(pd.menu_jour){
        html += "<div class='pub-menu-banner' id='pubMenuBanner-"+e.id+"'>"
          +"<div class='pub-menu-title'>🍽️ Menu du jour</div>"
          +"<div class='pub-menu-txt'>"+escHtml(pd.menu_jour)+"</div>"
          +"</div>";
      } else {
        html += "<div class='pub-menu-banner' id='pubMenuBanner-"+e.id+"' style='display:none;'>"
          +"<div class='pub-menu-title'>🍽️ Menu du jour</div><div class='pub-menu-txt'></div></div>";
      }
      return html;
    })()+
    "<div class=\"card-ambiance\"><span class=\"lbl\">Ambiance</span><span class=\"val\">"+e.ambiance+"</span></div>"+
    (getCategory(e.type)==="Terrasse" || (e.type||"").toLowerCase().indexOf("terrasse")!==-1 ? "<div style=\"padding:0.3rem 0.7rem 0;\"><span class='meteo-terrasse-badge' style='font-size:0.65rem;font-weight:700;'>🌡️ Météo chargement...</span></div>" : "")+
    mapsBtn+
    "</div>"+soireeHtml+
    presRow+
    vipBtn+
    // ── BARRE CONTACT cliquable (WhatsApp / Tél / Email) ──
    (function(){
      var tel = (e.contact||"").replace(/\s/g,"");
      var nom = (e.nom||"").replace(/'/g,"");
      var waNum = tel.replace(/\+/g,"");
      var waMsg = encodeURIComponent("Bonjour "+nom+" (via AMBI241), je souhaite vous contacter.");
      var waUrl = "https://wa.me/"+waNum+"?text="+waMsg;
      var mailUrl = e.email ? "mailto:"+e.email : "mailto:ambi2412026@gmail.com?subject=Contact%20"+encodeURIComponent(nom)+"%20via%20AMBI241";
      var html = "<div class='card-contact-row'>";
      // Téléphone
      if(tel){
        html += "<a class='cc-btn cc-btn-tel' href='tel:"+tel+"' onclick=\"logContactClick('"+e.id+"','"+nom+"','telephone')\" title='Appeler'>&#128222; Appeler</a>";
      }
      // WhatsApp — seulement si numéro disponible
      if(waNum && waNum.length >= 8){
        html += "<a class='cc-btn cc-btn-wa' href='"+waUrl+"' target='_blank' onclick=\"logContactClick('"+e.id+"','"+nom+"','whatsapp')\" title='WhatsApp'>&#128172; WhatsApp</a>";
        // Bouton envoi message admin (ouvre modal pré-rempli)
        if(isAdmin){
          html += "<button class='cc-btn cc-btn-wa' onclick=\"openWaSingle('"+waNum+"','"+nom.replace(/'/g,"")+"')\" title='Envoyer un message WhatsApp'>&#128172; Msg admin</button>";
        }
      }
      // Email
      html += "<a class='cc-btn cc-btn-mail' href='"+mailUrl+"' onclick=\"logContactClick('"+e.id+"','"+nom+"','email')\" title='Email'>&#9993; Email</a>";
      html += "</div>";
      return html;
    })()+
    "<div class=\"card-bottom\">"+
    "<div style=\"display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;\">"+
    (e.note > 0 || e.avis > 0
      ? "<div class=\"stars\">"+makeStars(e.note)+"</div>"
        +"<span class=\"note\" data-live-note=\""+e.id+"\">"+e.note+"</span>"
        +"<span class=\"avis\" data-live-avis=\""+e.id+"\">"+e.avis+" avis</span>"
      : "<div class=\"stars\">"+makeStars(0)+"</div>"
        +"<span class=\"note\" data-live-note=\""+e.id+"\">0</span>"
        +"<span class=\"avis\" data-live-avis=\""+e.id+"\">0 avis</span>"
    )+
    (!compact?"<button class=\"rate-btn\" onclick=\"openRatingModal("+e.id+")\">&#11088; "+(e.avis>0?"Voter":"1er avis")+"</button>":"")+
    "</div>"+
    "<span class=\"pay-tag\" style=\"display:none;\">"+(e.paiement||"")+"</span>"+
    "</div>"+ep+commentsHtml+"</div>";
}

// ══════════════════════════════════════════════════════════════
// ══  SYSTÈME DE COMMENTAIRES                                 ══
// ══════════════════════════════════════════════════════════════

var COMMENTS_PAGE_SIZE = 5;
var commentsCache = {};      // { eid: [comment, ...] }
var commentsPage  = {};      // { eid: number }
var commentsOpen  = {};      // { eid: bool }

/* Helpers date */
function fmtCommentDate(ts){
  var d = new Date(ts);
  var now = Date.now();
  var diff = now - ts;
  if(diff < 60000)  return "À l'instant";
  if(diff < 3600000) return Math.floor(diff/60000)+"min";
  if(diff < 86400000) return Math.floor(diff/3600000)+"h";
  return d.getDate()+"/"+(d.getMonth()+1)+"/"+d.getFullYear();
}

/* Vérifie si l'utilisateur connecté est proprio de l'établissement */
function isEtablissementOwner(e){
  if(!window.currentUserEmail) return false;
  var em = (e.email||"").toLowerCase().trim();
  return em && em === window.currentUserEmail.toLowerCase().trim();
}

/* Peut modérer (suppr/modifier) un commentaire ? */
function canModerateComment(e, comment){
  if(isAdmin) return true;
  if(isEtablissementOwner(e)) return true;
  // L'auteur du commentaire peut modifier/supprimer le sien
  if(window.currentUserUID && comment.uid === window.currentUserUID) return true;
  return false;
}

/* Initiales pour avatar */
function getInitials(pseudo){
  if(!pseudo) return "?";
  var parts = pseudo.trim().split(/\s+/);
  if(parts.length >= 2) return (parts[0][0]+parts[1][0]).toUpperCase();
  return pseudo.substring(0,2).toUpperCase();
}

/* Couleur avatar déterministe selon pseudo */
var AVATAR_COLORS = [
  "linear-gradient(135deg,#ff2d9b,#cc44ff)",
  "linear-gradient(135deg,#00e5ff,#00ffaa)",
  "linear-gradient(135deg,#ffd700,#ff2d9b)",
  "linear-gradient(135deg,#cc44ff,#00e5ff)",
  "linear-gradient(135deg,#00ffaa,#ffd700)",
  "linear-gradient(135deg,#ff4466,#ff2d9b)"
];
function avatarColor(pseudo){
  var h = 0;
  for(var i=0;i<(pseudo||"").length;i++) h = (h*31 + pseudo.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* Construit le HTML de la section commentaires */
function buildCommentsSection(e){
  var count = (commentsCache[e.id]||[]).length;
  var isOpen = commentsOpen[e.id] || false;
  var countLabel = count > 0 ? count+" commentaire"+(count>1?"s":"") : "Commenter";
  return "<div class=\"comments-section\" id=\"cs-"+e.id+"\">" +
    "<button class=\"comments-toggle-btn\" onclick=\"toggleComments("+e.id+")\">" +
    "&#128172; Discussion <span class=\"ct-count\" id=\"ccount-"+e.id+"\">"+countLabel+"</span>" +
    "<span style=\"font-size:0.75rem;color:var(--muted);\">"+(isOpen?"▲":"▼")+"</span>" +
    "</button>" +
    "<div class=\"comments-body"+(isOpen?" open":"")+"\" id=\"cb-"+e.id+"\">" +
    renderCommentsList(e) +
    "</div>" +
    "</div>";
}

/* Rend la liste + input */
function renderCommentsList(e){
  var all  = commentsCache[e.id] || [];
  var page = commentsPage[e.id]  || 1;
  var shown = all.slice(0, page * COMMENTS_PAGE_SIZE);
  var html = "";

  if(all.length === 0){
    html += "<div class=\"comments-empty\"><span>&#128172;</span>Soyez le premier à commenter !</div>";
  } else {
    shown.forEach(function(c){ html += renderOneComment(e, c); });
    if(all.length > shown.length){
      html += "<button class=\"comments-load-more\" onclick=\"loadMoreComments("+e.id+")\">&#8595; Voir plus de commentaires ("+(all.length - shown.length)+" restant"+(all.length-shown.length>1?"s":"")+")</button>";
    }
  }

  // Zone de saisie
  if(window.currentUserUID || window.currentUserEmail){
    html += "<div class=\"comment-input-wrap\" id=\"ci-"+e.id+"\">";
    html += "<textarea id=\"ctxt-"+e.id+"\" placeholder=\"Partagez votre avis sur "+e.nom+"...\" maxlength=\"500\" oninput=\"updateCharCount("+e.id+",this)\"></textarea>";
    html += "<div class=\"comment-input-footer\">";
    html += "<div class=\"comment-emojis\">";
    var emojis = ["🔥","👏","🎶","💃","🍹","😍"];
    emojis.forEach(function(em){
      html += "<button class=\"emoji-quick-btn\" onclick=\"appendEmoji("+e.id+",'"+ em +"')\">"+ em +"</button>";
    });
    html += "</div>";
    html += "<span class=\"comment-char-count\" id=\"ccc-"+e.id+"\">0/500</span>";
    html += "<button class=\"comment-send-btn\" onclick=\"postComment("+e.id+")\">&#9658; Envoyer</button>";
    html += "</div></div>";
  } else {
    html += "<div class=\"comment-login-prompt\">&#128172; Connectez-vous pour commenter<br><button onclick=\"document.getElementById('userOverlay').classList.add('show');switchUserTab('connexion')\">Se connecter / S'inscrire</button></div>";
  }
  return html;
}

/* Rend un seul commentaire */
function renderOneComment(e, c){
  var canMod = canModerateComment(e, c);
  var isOwnerTag = isEtablissementOwner(e) && c.uid === window.currentUserUID;
  var isAdminTag = isAdmin && c.uid === window.currentUserUID;
  var pseudo = c.pseudo || "Membre";
  var initials = getInitials(pseudo);
  var color = avatarColor(pseudo);
  var authorClass = c.isOwner ? "comment-author is-owner" : (c.isAdmin ? "comment-author is-admin-tag" : "comment-author");
  var badgeHtml = c.isOwner ? "<span class=\"comment-badge badge-owner\">&#127968; Propriétaire</span>" :
                  c.isAdmin ? "<span class=\"comment-badge badge-admin\">&#128272; Admin</span>" : "";

  var html = "<div class=\"comment-item\" id=\"citem-"+c.id+"\">";
  html += "<div class=\"comment-avatar\" style=\"background:"+color+";\">"+initials+"</div>";
  html += "<div class=\"comment-content\">";
  html += "<div class=\"comment-header\">";
  html += "<span class=\""+authorClass+"\">"+escHtml(pseudo)+"</span>";
  html += badgeHtml;
  html += "<span class=\"comment-time\">"+fmtCommentDate(c.ts)+"</span>";
  if(canMod){
    html += "<div class=\"comment-admin-btns\">";
    // Seul l'auteur peut modifier son propre commentaire
    if(c.uid === window.currentUserUID || isAdmin){
      html += "<button class=\"cam-btn cam-edit\" onclick=\"startEditComment("+e.id+",'"+c.id+"')\" title=\"Modifier\">&#9998;</button>";
    }
    html += "<button class=\"cam-btn cam-del\" onclick=\"deleteComment("+e.id+",'"+c.id+"')\" title=\"Supprimer\">&#128465;</button>";
    html += "</div>";
  }
  html += "</div>";
  html += "<div class=\"comment-text"+(c.edited?" edited":"")+"\" id=\"ctxt-display-"+c.id+"\">"+escHtml(c.text)+(c.edited?"<span class=\"comment-edited-tag\">(modifié)</span>":"")+"</div>";
  // Zone d'édition inline (cachée par défaut)
  html += "<div class=\"comment-edit-wrap\" id=\"cedit-"+c.id+"\" style=\"display:none;\">";
  html += "<textarea class=\"comment-edit-input\" id=\"cedit-txt-"+c.id+"\" maxlength=\"500\">"+escHtml(c.text)+"</textarea>";
  html += "<div class=\"comment-edit-actions\">";
  html += "<button class=\"ced-btn ced-save\" onclick=\"saveEditComment("+e.id+",'"+c.id+"')\">&#10003; Sauvegarder</button>";
  html += "<button class=\"ced-btn ced-cancel\" onclick=\"cancelEditComment('"+c.id+"')\">&#10005; Annuler</button>";
  html += "</div></div>";
  // Réactions
  var reactions = c.reactions || {};
  var reactionTypes = [{k:"❤️",l:"J'aime"},{k:"🔥",l:"Feu"},{k:"👏",l:"Bravo"},{k:"😮",l:"Wow"}];
  html += "<div class=\"comment-reactions\">";
  reactionTypes.forEach(function(r){
    var count = (reactions[r.k]||[]).length;
    var hasReacted = window.currentUserUID && (reactions[r.k]||[]).indexOf(window.currentUserUID)!==-1;
    html += "<button class=\"reaction-btn"+(hasReacted?" active-react":"")+"\" onclick=\"toggleReaction("+e.id+",'"+c.id+"','"+r.k+"')\" title=\""+r.l+"\">";
    html += r.k+(count>0?" "+count:"");
    html += "</button>";
  });
  // Bouton Répondre (visible par tous, action requiert connexion)
  html += "<button class=\"reply-btn\" onclick=\"toggleReplyInput("+e.id+",'"+c.id+"')\">&#8618; Répondre</button>";
  html += "</div>";

  // Affichage des réponses existantes
  var replies = c.replies || [];
  if(replies.length > 0){
    html += "<div class=\"replies-list\" id=\"replies-"+c.id+"\">";
    replies.forEach(function(r, ri){
      var rInitials = getInitials(r.pseudo||"M");
      var rColor = avatarColor(r.pseudo||"M");
      var canDelReply = isAdmin || (window.currentUserUID && r.uid === window.currentUserUID);
      html += "<div class=\"reply-item\" id=\"ritem-"+c.id+"-"+ri+"\">";
      html += "<div class=\"reply-avatar\" style=\"background:"+rColor+";\">"+rInitials+"</div>";
      html += "<div class=\"reply-content\">";
      html += "<span class=\"reply-author\">"+escHtml(r.pseudo||"Membre")+"</span>";
      html += "<span class=\"reply-time\">"+fmtCommentDate(r.ts)+"</span>";
      if(canDelReply){
        html += "<button class=\"reply-del-btn\" onclick=\"deleteReply("+e.id+",'"+c.id+"',"+ri+")\" title=\"Supprimer\">🗑</button>";
      }
      html += "<div class=\"reply-text\">"+escHtml(r.text||"")+"</div>";
      html += "</div></div>";
    });
    html += "</div>";
  } else {
    html += "<div class=\"replies-list\" id=\"replies-"+c.id+"\" style=\"display:none;\"></div>";
  }

  // Zone de saisie réponse (cachée par défaut)
  html += "<div class=\"reply-input-wrap\" id=\"rinput-"+c.id+"\">";
  if(window.currentUserUID || window.currentUserEmail){
    html += "<div class=\"reply-input-row\">";
    html += "<textarea class=\"reply-textarea\" id=\"rtxt-"+c.id+"\" placeholder=\"Répondre à "+escHtml(c.pseudo||"Membre")+"...\" maxlength=\"300\" rows=\"1\"></textarea>";
    html += "<button class=\"reply-send-btn\" id=\"rsend-"+c.id+"\" onclick=\"postReply("+e.id+",'"+c.id+"')\">↵ Envoyer</button>";
    html += "<button class=\"reply-cancel-btn\" onclick=\"toggleReplyInput("+e.id+",'"+c.id+"')\">✕</button>";
    html += "</div>";
  } else {
    html += "<div style=\"font-size:0.72rem;color:var(--muted);padding:0.4rem 0;\">&#128100; <button onclick=\"document.getElementById('userOverlay').classList.add('show');switchUserTab('connexion')\" style=\"background:none;border:none;color:var(--cyan);cursor:pointer;font-size:0.72rem;text-decoration:underline;\">Connectez-vous</button> pour répondre</div>";
  }
  html += "</div>";

  html += "</div></div>";
  return html;
}

/* Escape HTML pour sécurité */
function escHtml(s){
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\n/g,"<br>");
}

/* Toggle affichage section */
function toggleComments(eid){
  commentsOpen[eid] = !commentsOpen[eid];
  var body = document.getElementById("cb-"+eid);
  var btn  = body && body.previousElementSibling;
  if(!body) return;
  if(commentsOpen[eid]){
    body.classList.add("open");
    if(btn) btn.querySelector("span:last-child").textContent = "▲";
    // Charger depuis Firebase si pas encore fait
    if(!commentsCache[eid]){
      commentsCache[eid] = [];
      fetchComments(eid);
    }
    body.innerHTML = renderCommentsList(etablissements.find(function(x){return x.id===eid;})||{id:eid,nom:""});
  } else {
    body.classList.remove("open");
    if(btn) btn.querySelector("span:last-child").textContent = "▼";
  }
}

/* Chargement Firebase des commentaires d'un établissement */
function fetchComments(eid){
  if(!window.db || typeof window.fbCollection !== "function") return;
  var col = window.fbCollection(window.db, "etablissements", String(eid), "commentaires");
  var q   = window.fbQuery(col, window.fbOrderBy("ts", "desc"));
  window.fbGetDocs(q).then(function(snap){
    var comments = [];
    snap.forEach(function(d){ comments.push(Object.assign({id:d.id}, d.data())); });
    // Trier par ts croissant pour affichage
    comments.sort(function(a,b){ return a.ts - b.ts; });
    commentsCache[eid] = comments;
    refreshCommentsUI(eid);
  }).catch(function(err){
    console.error("fetchComments error:", err);
  });
}

/* Rafraîchit le rendu de la section commentaires dans le DOM */
function refreshCommentsUI(eid){
  var e = etablissements.find(function(x){ return x.id === eid; });
  if(!e) return;
  var body = document.getElementById("cb-"+eid);
  var countEl = document.getElementById("ccount-"+eid);
  if(body && commentsOpen[eid]){
    body.innerHTML = renderCommentsList(e);
  }
  // Mise à jour compteur
  var count = (commentsCache[eid]||[]).length;
  if(countEl) countEl.textContent = count > 0 ? count+" commentaire"+(count>1?"s":"") : "Commenter";
}

/* Poster un nouveau commentaire (version sécurisée) */
/* Anti-spam : 1 commentaire/minute + validation longueur + détection liens */
var _COMMENT_COOLDOWN_MS = 60 * 1000; // 1 min entre commentaires

function _validateCommentText(text){
  if(!text || text.trim().length < 2) return "Commentaire trop court (min 2 caractères)";
  if(text.length > 500) return "Commentaire trop long (max 500 caractères)";
  // Détection liens (permettrait spam externe)
  if(/(https?:\/\/|www\.)[^\s]{10,}/i.test(text)) return "Les liens ne sont pas autorisés dans les commentaires";
  // Détection répétition excessive de caractères (ex: aaaaaaaaaa)
  if(/(.)\1{9,}/.test(text)) return "Commentaire invalide (caractères répétés)";
  return null;
}

function _canPostComment(){
  var key = "ambi241_lastcomment";
  var last = parseInt(lsGet(key)||"0");
  var now = Date.now();
  if(last && (now-last) < _COMMENT_COOLDOWN_MS){
    var sec = Math.ceil((_COMMENT_COOLDOWN_MS-(now-last))/1000);
    showToast("⏳ Attendez "+sec+"s avant de commenter à nouveau");
    return false;
  }
  lsSet(key, String(now));
  return true;
}

function postComment(eid){
  var ta  = document.getElementById("ctxt-"+eid);
  if(!ta) return;
  var text = ta.value.trim();
  if(!text){ ta.focus(); return; }
  if(!window.currentUserUID && !window.currentUserEmail){ showToast("Connectez-vous pour commenter"); return; }

  // ── Validation anti-spam ──
  var commentErr = _validateCommentText(text);
  if(commentErr){ showToast("⚠️ "+commentErr); ta.focus(); return; }
  if(!_canPostComment()) return;

  var btn = ta.parentElement.querySelector(".comment-send-btn");
  if(btn){ btn.disabled = true; btn.textContent = "Envoi..."; }

  var e = etablissements.find(function(x){ return x.id === eid; });
  var pseudo = window.currentUserPseudo || window.currentUserEmail || "Membre";
  var comment = {
    uid:    window.currentUserUID || "",
    pseudo: pseudo,
    text:   text,
    ts:     Date.now(),
    edited: false,
    isOwner: isEtablissementOwner(e||{}),
    isAdmin: isAdmin,
    reactions: {}
  };

  // Sous-collection Firestore: etablissements/{eid}/commentaires
  if(!window.db || typeof window.fbCollection !== "function"){ showToast("Connexion Firebase non disponible"); if(btn){btn.disabled=false;btn.textContent="▶ Envoyer";} return; }
  var col = window.fbCollection(window.db, "etablissements", String(eid), "commentaires");
  window.fbAddDoc(col, comment).then(function(){
    ta.value = "";
    var cc = document.getElementById("ccc-"+eid);
    if(cc) cc.textContent = "0/500";
    if(btn){ btn.disabled=false; btn.textContent="▶ Envoyer"; }
    fetchComments(eid);
    showToast("Commentaire publié !");
  }).catch(function(err){
    if(btn){ btn.disabled=false; btn.textContent="▶ Envoyer"; }
    showToast("Erreur: "+err.message);
  });
}

/* Supprimer un commentaire */
function deleteComment(eid, cid){
  if(!confirm("Supprimer ce commentaire ?")) return;
  var docRef = window.fbDoc(window.db, "etablissements", String(eid), "commentaires", cid);
  window.fbDeleteDoc(docRef).then(function(){
    fetchComments(eid);
    showToast("Commentaire supprimé");
  }).catch(function(err){ showToast("Erreur: "+err.message); });
}

/* Commencer édition inline */
function startEditComment(eid, cid){
  var display = document.getElementById("ctxt-display-"+cid);
  var editWrap = document.getElementById("cedit-"+cid);
  if(display) display.style.display = "none";
  if(editWrap) editWrap.style.display = "block";
  var ta = document.getElementById("cedit-txt-"+cid);
  if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
}

function cancelEditComment(cid){
  var display = document.getElementById("ctxt-display-"+cid);
  var editWrap = document.getElementById("cedit-"+cid);
  if(display) display.style.display = "block";
  if(editWrap) editWrap.style.display = "none";
}

/* Sauvegarder l'édition */
function saveEditComment(eid, cid){
  var ta = document.getElementById("cedit-txt-"+cid);
  if(!ta) return;
  var newText = ta.value.trim();
  if(!newText){ showToast("Le commentaire ne peut pas être vide."); return; }
  var docRef = window.fbDoc(window.db, "etablissements", String(eid), "commentaires", cid);
  window.fbUpdateDoc(docRef, { text: newText, edited: true, editedAt: Date.now() }).then(function(){
    fetchComments(eid);
    showToast("Commentaire modifié !");
  }).catch(function(err){ showToast("Erreur: "+err.message); });
}

/* Réactions */
function toggleReaction(eid, cid, emoji){
  if(!window.currentUserUID){ showToast("Connectez-vous pour réagir"); return; }
  var comment = (commentsCache[eid]||[]).find(function(c){ return c.id === cid; });
  if(!comment) return;
  var reactions = comment.reactions || {};
  var users = reactions[emoji] || [];
  var idx = users.indexOf(window.currentUserUID);
  if(idx === -1){ users.push(window.currentUserUID); }
  else { users.splice(idx,1); }
  reactions[emoji] = users;
  var docRef = window.fbDoc(window.db, "etablissements", String(eid), "commentaires", cid);
  window.fbUpdateDoc(docRef, { reactions: reactions }).then(function(){
    comment.reactions = reactions;
    refreshCommentsUI(eid);
  }).catch(function(err){ showToast("Erreur réaction"); });
}

/* Charger plus de commentaires */
function loadMoreComments(eid){
  commentsPage[eid] = (commentsPage[eid]||1) + 1;
  refreshCommentsUI(eid);
}

/* Compteur caractères */
function updateCharCount(eid, ta){
  var cc = document.getElementById("ccc-"+eid);
  if(cc) cc.textContent = ta.value.length+"/500";
}

/* Ajouter emoji dans textarea */
function appendEmoji(eid, emoji){
  var ta = document.getElementById("ctxt-"+eid);
  if(!ta) return;
  ta.value += emoji;
  updateCharCount(eid, ta);
  ta.focus();
}

// Exposer globalement
window.toggleComments    = toggleComments;
window.postComment       = postComment;
window.deleteComment     = deleteComment;
window.startEditComment  = startEditComment;
window.cancelEditComment = cancelEditComment;
window.saveEditComment   = saveEditComment;
window.toggleReaction    = toggleReaction;
window.loadMoreComments  = loadMoreComments;
window.updateCharCount   = updateCharCount;
window.appendEmoji       = appendEmoji;

/* ── Toggle zone de réponse ── */
function toggleReplyInput(eid, cid){
  var wrap = document.getElementById("rinput-"+cid);
  if(!wrap) return;
  var isOpen = wrap.classList.contains("open");
  // Fermer tous les autres inputs de réponse dans la même section
  var section = document.getElementById("cb-"+eid);
  if(section){
    section.querySelectorAll(".reply-input-wrap.open").forEach(function(el){
      el.classList.remove("open");
    });
  }
  if(!isOpen){
    wrap.classList.add("open");
    var ta = document.getElementById("rtxt-"+cid);
    if(ta){ ta.focus(); }
  }
}

/* ── Poster une réponse ── */
function postReply(eid, cid){
  if(!window.currentUserUID && !window.currentUserEmail){ showToast("Connectez-vous pour répondre"); return; }
  var ta = document.getElementById("rtxt-"+cid);
  if(!ta) return;
  var text = ta.value.trim();
  if(!text){ ta.focus(); return; }

  var btn = document.getElementById("rsend-"+cid);
  if(btn){ btn.disabled = true; btn.textContent = "..."; }

  var pseudo = window.currentUserPseudo || window.currentUserEmail || "Membre";
  var reply = {
    uid:    window.currentUserUID || "",
    pseudo: pseudo,
    text:   text,
    ts:     Date.now(),
    isAdmin: isAdmin
  };

  // Récupérer le commentaire parent et ajouter la réponse dans son tableau
  var docRef = window.fbDoc(window.db, "etablissements", String(eid), "commentaires", cid);
  window.fbGetDoc(docRef).then(function(snap){
    if(!snap.exists()){ showToast("Commentaire introuvable"); return; }
    var existing = snap.data().replies || [];
    existing.push(reply);
    return window.fbUpdateDoc(docRef, { replies: existing });
  }).then(function(){
    ta.value = "";
    if(btn){ btn.disabled = false; btn.textContent = "↵ Envoyer"; }
    var wrap = document.getElementById("rinput-"+cid);
    if(wrap) wrap.classList.remove("open");
    fetchComments(eid);
    showToast("Réponse publiée !");
  }).catch(function(err){
    if(btn){ btn.disabled = false; btn.textContent = "↵ Envoyer"; }
    showToast("Erreur: "+(err&&err.message||err));
  });
}

/* ── Supprimer une réponse ── */
function deleteReply(eid, cid, replyIndex){
  if(!confirm("Supprimer cette réponse ?")) return;
  var docRef = window.fbDoc(window.db, "etablissements", String(eid), "commentaires", cid);
  window.fbGetDoc(docRef).then(function(snap){
    if(!snap.exists()) return;
    var replies = snap.data().replies || [];
    replies.splice(replyIndex, 1);
    return window.fbUpdateDoc(docRef, { replies: replies });
  }).then(function(){
    fetchComments(eid);
    showToast("Réponse supprimée");
  }).catch(function(err){ showToast("Erreur: "+(err&&err.message||err)); });
}

window.toggleReplyInput = toggleReplyInput;
window.postReply        = postReply;
window.deleteReply      = deleteReply;

// ══════════════════════════════════════════════════════════════
// ══  SYSTÈME PRÉSENCE + VOTES + CLASSEMENT RÉEL             ══
// ══════════════════════════════════════════════════════════════

var PRESENCE_TTL = 3 * 3600 * 1000; // présence expire après 3h
var _presenceEid = null;             // établissement en cours de vérification

/* ── Clés localStorage ── */
function presKey(eid){ return "ambi241_presence_"+eid; }
function voteKey(eid){ return "ambi241_vote_"+eid; }
function allPresKey(){ return "ambi241_all_presence"; }
function allVoteKey(){ return "ambi241_all_votes"; }

/* ── Données de présence globales (partagées entre cartes) ── */
function getAllPresence(){
  try{ return JSON.parse(lsGet(allPresKey())||"{}"); }
  catch(e){ return {}; }
}
function saveAllPresence(obj){
  try{ lsSetJSON(allPresKey(), obj); }
  catch(e){}
}
function getAllVotes(){
  try{ return JSON.parse(lsGet(allVoteKey())||"{}"); }
  catch(e){ return {}; }
}
function saveAllVotes(obj){
  try{ lsSetJSON(allVoteKey(), obj); }
  catch(e){}
}

/* ── Récupère le nombre de présences actives pour un étab ── */
function getPresenceData(eid){
  try {
    var all = getAllPresence();
    var list = (all && all[eid]) ? all[eid] : [];
    var now  = Date.now();
    // Nettoyer les présences expirées
    list = list.filter(function(p){ return p && (now - p.ts) < PRESENCE_TTL; });
    all[eid] = list;
    saveAllPresence(all);
    return { count: list.length, list: list };
  } catch(err) {
    return { count: 0, list: [] };
  }
}

/* ── L'utilisateur actuel est-il présent ? ── */
function isUserPresent(eid){
  var uid = window.currentUserUID || window.currentUserEmail || null;
  if(!uid){
    // Vérification anonyme par fingerprint (sessionStorage)
    var anonKey = "ambi241_anon_presence_"+eid;
    var ts = parseInt(sessionStorage.getItem(anonKey)||"0");
    return ts > 0 && (Date.now()-ts) < PRESENCE_TTL;
  }
  var data = getPresenceData(eid);
  return data.list.some(function(p){ return p.uid === uid; });
}

/* ── Enregistrer une présence (version sécurisée) ── */
/* Anti-abus : 1 présence par établissement toutes les 3h par appareil */
var _PRESENCE_LIMIT_MS = 3 * 3600 * 1000;
function _canRegisterPresence(eid){
  var key = "ambi241_lastpres_"+eid;
  var last = parseInt(lsGet(key)||"0");
  var now = Date.now();
  if(last && (now-last) < _PRESENCE_LIMIT_MS){
    var h = Math.ceil((_PRESENCE_LIMIT_MS-(now-last))/3600000);
    showToast("📌 Présence déjà enregistrée (expire dans ~"+h+"h)");
    return false;
  }
  lsSet(key, String(now));
  return true;
}
function registerPresence(eid){
  if(!_canRegisterPresence(eid)) return; // ← Bloque le double enregistrement
  var uid  = _getSecureVoterId(); // Réutilise le même fingerprint stable
  var pseudo = window.currentUserPseudo || "Visiteur";
  var all  = getAllPresence();
  var list = (all[eid]||[]).filter(function(p){
    return (Date.now()-p.ts) < _PRESENCE_LIMIT_MS && p.uid !== uid;
  });
  list.push({ uid: uid, pseudo: pseudo, ts: Date.now() });
  all[eid] = list;
  saveAllPresence(all);
  sessionStorage.setItem("ambi241_anon_presence_"+eid, String(Date.now()));
  var fbUid = window.currentUserUID || uid;
  if(window.db && window.fbDoc && window.fbSetDoc){
    var ref = window.fbDoc(window.db, "etablissements", String(eid), "presences", fbUid);
    window.fbSetDoc(ref, { uid: fbUid, pseudo: pseudo, ts: Date.now() }).catch(function(){});
  }
}

/* ── Supprimer une présence ── */
function removePresence(eid){
  var uid  = window.currentUserUID || window.currentUserEmail || null;
  var all  = getAllPresence();
  var list = (all[eid]||[]).filter(function(p){ return p.uid !== uid; });
  all[eid] = list;
  saveAllPresence(all);
  sessionStorage.removeItem("ambi241_anon_presence_"+eid);
}

/* ── Données de votes ── */
function getVoteData(eid){
  var all = getAllVotes();
  var votes = all[eid] || { pos:[], neg:[] };
  return { pos: votes.pos.length, neg: votes.neg.length, raw: votes };
}

/* ── Vote de l'utilisateur actuel ── */
function getMyVote(eid){
  var uid = window.currentUserUID || window.currentUserEmail || sessionStorage.getItem("ambi241_voter_id");
  if(!uid) return null;
  var all = getAllVotes();
  var v   = all[eid] || { pos:[], neg:[] };
  if(v.pos.indexOf(uid)!==-1) return "pos";
  if(v.neg.indexOf(uid)!==-1) return "neg";
  return null;
}

/* ══ SÉCURITÉ — Fingerprint semi-permanent anti-fraude ══════════
   Remplace sessionStorage (effaçable) par un ID persistant
   combinant localStorage + caractéristiques du navigateur.
   Un utilisateur ne peut pas voter 2× sur le même appareil. */
function _getSecureVoterId(){
  if(window.currentUserUID) return "fb_"+window.currentUserUID;
  var stored = lsGet("ambi241_fp_v2");
  if(stored) return stored;
  var nav = navigator;
  var raw = [nav.language||"",nav.platform||"",screen.width+"x"+screen.height,
             nav.hardwareConcurrency||"",
             (Intl&&Intl.DateTimeFormat?Intl.DateTimeFormat().resolvedOptions().timeZone:"")].join("|");
  var hash = raw.split("").reduce(function(h,c){return((h<<5)-h)+c.charCodeAt(0)|0;},0);
  var fp = "fp2_"+Math.abs(hash).toString(16)+"_"+Math.random().toString(36).substr(2,6);
  lsSet("ambi241_fp_v2", fp);
  return fp;
}

/* Cooldown votes : 10 min par établissement par appareil */
var _VOTE_COOLDOWN_MS = 10 * 60 * 1000;
function _checkVoteCooldown(eid){
  var key = "ambi241_vcd_"+eid;
  var last = parseInt(lsGet(key)||"0");
  var now = Date.now();
  if(last && (now-last) < _VOTE_COOLDOWN_MS){
    var rem = Math.ceil((_VOTE_COOLDOWN_MS-(now-last))/60000);
    showToast("⏳ Vote déjà enregistré — réessayez dans "+rem+" min");
    return false;
  }
  return true;
}

/* ── Voter (version sécurisée) ── */
function castVote(eid, type){
  // Vérification cooldown (10 min entre votes)
  if(!_checkVoteCooldown(eid)) return;
  lsSet("ambi241_vcd_"+eid, String(Date.now())); // Enregistrer timestamp

  var uid = _getSecureVoterId(); // Fingerprint stable (survit rechargements)
  var all  = getAllVotes();
  var v    = all[eid] ? { pos: all[eid].pos.slice(), neg: all[eid].neg.slice() } : { pos:[], neg:[] };
  var other = type==="pos" ? "neg" : "pos";
  // Retirer du camp opposé
  v[other] = v[other].filter(function(u){ return u!==uid; });
  // Toggle dans le camp choisi
  var idx = v[type].indexOf(uid);
  if(idx===-1){ v[type].push(uid); showToast(type==="pos"?"👍 Avis positif enregistré !":"👎 Avis négatif enregistré !"); }
  else        { v[type].splice(idx,1); showToast("Vote retiré"); }
  all[eid] = v;
  saveAllVotes(all);
  // Sauvegarder Firebase — le fingerprint est utilisé comme docId (1 vote/appareil)
  var fbUid = window.currentUserUID || uid;
  if(window.db && window.fbDoc && window.fbSetDoc){
    var ref = window.fbDoc(window.db, "etablissements", String(eid), "votes", fbUid);
    window.fbSetDoc(ref, { uid: fbUid, vote: idx===-1?type:null, ts: Date.now(), fp: uid }).catch(function(){});
  }
  renderAll(); renderHome();
}

/* ── Calcul affluence réelle (présences + votes + base admin) ── */
function computeRealAffluence(e, presData, voteData){
  if(!e) return 0;
  var base = e.affluence || 0;
  // Null-safe presData
  var safePresData = (presData && typeof presData === 'object') ? presData : { count: 0, list: [] };
  var presCount = (typeof safePresData.count === 'number') ? safePresData.count : 0;
  // Null-safe voteData
  var safeVoteData = (voteData && typeof voteData === 'object') ? voteData : { pos: 0, neg: 0 };
  var posVotes = (typeof safeVoteData.pos === 'number') ? safeVoteData.pos : 0;
  var negVotes = (typeof safeVoteData.neg === 'number') ? safeVoteData.neg : 0;
  // Chaque présence confirmée ajoute du poids (max +30 pts pour 10 présences)
  var presBonus = Math.min(presCount * 3, 30);
  // Votes : chaque pos +2, chaque neg -3
  var voteBonus = (posVotes * 2) - (negVotes * 3);
  var result = Math.max(0, Math.min(100, base + presBonus + voteBonus));
  return result;
}

/* ── Cache des rankings (recalculé UNE SEULE fois par renderAll) ── */
var _rankCache = null; // { eid -> position }

function _buildRankCache(){
  if(!etablissements || !etablissements.length){ _rankCache = {}; return; }
  var ranked = etablissements.map(function(e){
    var pd = getPresenceData(e.id) || { count: 0, list: [] };
    var vd = getVoteData(e.id) || { pos: 0, neg: 0 };
    return { id: e.id, score: computeRealAffluence(e, pd, vd) };
  }).sort(function(a,b){ return b.score - a.score; });
  _rankCache = {};
  ranked.forEach(function(r, i){ _rankCache[r.id] = i + 1; });
}

/* ── Classement en temps réel basé sur affluence réelle ── */
function buildRankBadge(eid){
  if(!_rankCache) _buildRankCache();
  var pos = _rankCache[eid] || 99;
  if(pos===1) return "<span class=\"ranking-badge rank-1\">🏆 1</span>";
  if(pos===2) return "<span class=\"ranking-badge rank-2\">🥈 2</span>";
  if(pos===3) return "<span class=\"ranking-badge rank-3\">🥉 3</span>";
  return "<span class=\"ranking-badge rank-other\">"+pos+"</span>";
}

/* ── Modal présence ── */
function openPresenceModal(eid){
  _presenceEid = eid;
  var e = etablissements.find(function(x){ return x.id===eid; })||{nom:""};
  document.getElementById("presenceModalTitle").textContent = "Je suis à : "+e.nom;
  document.getElementById("presenceModalSub").textContent = "Confirmez votre présence en "+e.nom+" maintenant";
  document.getElementById("presenceConfirmMsg").style.display = "none";
  document.getElementById("presenceLoginNote").style.display = window.currentUserUID ? "none" : "block";
  var _presRawUrl = e.maps_url || '';
  var _presOsmBroken = _presRawUrl && _presRawUrl.indexOf('place_id:osm') !== -1;
  var mapsUrl = (_presRawUrl && !_presOsmBroken)
    ? _presRawUrl
    : (e.lat && e.lng)
      ? ("https://maps.google.com/?q=" + e.lat + "," + e.lng + "&query=" + encodeURIComponent((e.nom||'') + ' Libreville'))
      : ("https://maps.google.com/?q=" + encodeURIComponent((e.nom||"") + " " + (e.quartier||"") + " Libreville"));
  document.getElementById("presenceGpsBtn").setAttribute("data-maps", mapsUrl);
  document.getElementById("presenceWaBtn").setAttribute("data-eid", eid);
  document.getElementById("presenceOverlay").classList.add("show");
}
function closePresenceModal(){ document.getElementById("presenceOverlay").classList.remove("show"); _presenceEid=null; }

function confirmPresenceWhatsApp(){
  if(!_presenceEid) return;
  var e = etablissements.find(function(x){ return x.id===_presenceEid; })||{nom:"",quartier:""};
  var pseudo = window.currentUserPseudo || "Visiteur AMBI241";
  var mapsUrl = e.maps_url || ("https://maps.google.com/?q="+encodeURIComponent((e.nom||"")+" "+(e.quartier||"")+" Libreville"));
  var msg = encodeURIComponent("✅ Je suis actuellement à *"+e.nom+"* ("+e.quartier+") — AMBI241\n📍 "+mapsUrl+"\n👤 "+pseudo);
  registerPresence(_presenceEid);
  document.getElementById("presenceConfirmMsg").style.display = "block";
  document.getElementById("presenceConfirmMsg").innerHTML = "✅ Présence enregistrée ! Ouverture WhatsApp...";
  setTimeout(function(){ window.open("https://wa.me/24174450924?text="+msg,"_blank"); }, 400);
  setTimeout(function(){ closePresenceModal(); renderAll(); renderHome(); }, 1800);
}

function confirmPresenceGPS(){
  if(!_presenceEid) return;
  var btn = document.getElementById("presenceGpsBtn");
  var mapsUrl = btn.getAttribute("data-maps") || "https://maps.google.com";
  registerPresence(_presenceEid);
  document.getElementById("presenceConfirmMsg").style.display = "block";
  document.getElementById("presenceConfirmMsg").innerHTML = "✅ Présence enregistrée ! Ouverture Google Maps...";
  setTimeout(function(){ window.open(mapsUrl,"_blank"); }, 400);
  setTimeout(function(){ closePresenceModal(); renderAll(); renderHome(); }, 1800);
}

window.openPresenceModal  = openPresenceModal;
window.closePresenceModal = closePresenceModal;
window.confirmPresenceWhatsApp = confirmPresenceWhatsApp;
window.confirmPresenceGPS = confirmPresenceGPS;
window.castVote           = castVote;

// ══════════════════════════════════════════════════════════════
// ══  SYSTÈME DE NOTATION ÉTOILES (RATINGS FIRESTORE)        ══
// ══════════════════════════════════════════════════════════════

var _ratingEid   = null;
var _ratingValue = 0;

var RATING_LABELS = ["","😕 Décevant","😐 Passable","🙂 Bien","😊 Très bien","🔥 Excellent !"];

function openRatingModal(eid) {
  if (!window.currentUserUID && !window.currentUserEmail) {
    showToast("Connectez-vous pour noter cet établissement");
    document.getElementById("userOverlay") && document.getElementById("userOverlay").classList.add("show");
    return;
  }
  _ratingEid = eid;
  _ratingValue = 0;
  var etab = etablissements.find(function(x){ return x.id === eid; }) || {};
  document.getElementById("ratingModalSub").textContent = "Notez : " + (etab.nom || "");
  document.getElementById("ratingMsg").style.display = "none";
  document.getElementById("ratingComment").value = "";
  document.getElementById("ratingSubmitBtn").disabled = true;
  document.getElementById("ratingValueLbl").textContent = "";
  _updateRatingStars(0);
  document.getElementById("ratingOverlay").classList.add("show");
}

function closeRatingModal() {
  document.getElementById("ratingOverlay").classList.remove("show");
  _ratingEid = null;
}

function setRatingStar(val) {
  _ratingValue = val;
  _updateRatingStars(val);
  document.getElementById("ratingValueLbl").textContent = RATING_LABELS[val] || "";
  document.getElementById("ratingSubmitBtn").disabled = false;
}

function _updateRatingStars(val) {
  document.querySelectorAll("#ratingStarsRow .rating-star").forEach(function(el) {
    var v = parseInt(el.getAttribute("data-val"), 10);
    el.classList.toggle("on", v <= val);
  });
}

function submitRating() {
  if (!_ratingEid || _ratingValue < 1) return;
  if (!window.currentUserUID && !window.currentUserEmail) {
    showToast("Connexion requise");
    return;
  }
  var btn = document.getElementById("ratingSubmitBtn");
  var msg = document.getElementById("ratingMsg");
  btn.disabled = true;
  btn.textContent = "Envoi en cours...";

  var uid = window.currentUserUID || (window.currentUserEmail + "_anon");
  var pseudo = window.currentUserPseudo || window.currentUserEmail || "Membre";
  var ratingData = {
    uid: uid,
    pseudo: pseudo,
    rating: _ratingValue,
    comment: document.getElementById("ratingComment").value.trim(),
    ts: Date.now()
  };

  if (!window.db || typeof window.fbDoc !== "function") {
    msg.style.display = "block"; msg.style.color = "var(--red)";
    msg.textContent = "Firebase non disponible";
    btn.disabled = false; btn.textContent = "⭐ Envoyer ma note";
    return;
  }

  // Stocker dans etablissements/{eid}/ratings/{uid} (1 vote par user)
  var ref = window.fbDoc(window.db, "etablissements", String(_ratingEid), "ratings", uid);
  window.fbSetDoc(ref, ratingData).then(function() {
    msg.style.display = "block"; msg.style.color = "var(--green)";
    msg.textContent = "✅ Note enregistrée ! Merci pour votre avis.";
    btn.textContent = "✅ Envoyé !";
    // Notification admin
    if (typeof pushNotif === "function") {
      var etab = etablissements.find(function(x){ return x.id === _ratingEid; }) || {};
      pushNotif({
        targetRole: "admin",
        key: "rating_"+_ratingEid+"_"+uid,
        icon: "⭐",
        title: "Nouvelle note — " + (etab.nom || ""),
        msg: pseudo + " a donné " + _ratingValue + "/5 à " + (etab.nom || ""),
        channel: "push",
        fromAdmin: false
      });
    }
    setTimeout(closeRatingModal, 1800);
  }).catch(function(err) {
    msg.style.display = "block"; msg.style.color = "var(--red)";
    msg.textContent = "Erreur: " + err.message;
    btn.disabled = false; btn.textContent = "⭐ Envoyer ma note";
  });
}

window.openRatingModal  = openRatingModal;
window.closeRatingModal = closeRatingModal;
window.setRatingStar    = setRatingStar;
window.submitRating     = submitRating;



// RENDER ALL — avec debounce optimisé
var _renderAllTimer = null;
var _renderAllPending = false;
var _renderAllOrig = renderAllImmediate;

/* ── Cache de scores (invalidé uniquement lors de changements de données) ── */
var _scoreCache = {};
var _scoreCacheVersion = 0;

function _getCachedScore(e){
  var key = e.id + '_' + _scoreCacheVersion;
  if(!_scoreCache[key]) _scoreCache[key] = computeRankScore(e);
  return _scoreCache[key];
}

function invalidateScoreCache(){ _scoreCacheVersion++; _scoreCache = {}; _rankCache = null; }
window.invalidateScoreCache = invalidateScoreCache;

/* ── Restaurer les photos sauvegardées localement au chargement ── */
var _photoPersistenceLoaded = false;
function restorePhotosPersistence(){
  // ✅ Ne charger qu'une fois au démarrage, pas à chaque render
  if(_photoPersistenceLoaded) return;
  _photoPersistenceLoaded = true;
  
  if(!window.etablissements || !Array.isArray(window.etablissements)) return;
  for(var i=0;i<window.etablissements.length;i++){
    var e=window.etablissements[i];
    var eid=e.id;
    /* Tenter localStorage en priorité */
    var photoInterieur=localStorage.getItem('ambi_photo_'+eid+'_interieur');
    var photoProfile=localStorage.getItem('ambi_photo_'+eid+'_profile');
    if(photoInterieur && !e.photo_interieur) e.photo_interieur=photoInterieur;
    if(photoProfile && !e._photo_profile_approved) e._photo_profile_approved=photoProfile;
  }
  
  // ✅ IndexedDB async en arrière-plan (non-bloquant) — une seule fois au démarrage
  if('indexedDB' in window){
    setTimeout(function(){
      try {
        var req = indexedDB.open('AMBI241_DB', 1);
        req.onsuccess = function(ev){
          var db = ev.target.result;
          if(db.objectStoreNames.contains('photos')){
            var tx = db.transaction('photos', 'readonly');
            var photoStore = tx.objectStore('photos');
            // Lister toutes les photos en une seule requête range
            var allReq = photoStore.getAll();
            allReq.onsuccess = function(){
              allReq.result.forEach(function(item){
                if(item && item.key && item.value){
                  var m = item.key.match(/ambi_photo_([^_]+)_(interieur|profile)/);
                  if(m){
                    var eid = m[1], type = m[2];
                    var et = window.etablissements.find(function(x){return x.id===eid;});
                    if(et){
                      if(type === 'interieur' && !et.photo_interieur) et.photo_interieur = item.value;
                      if(type === 'profile' && !et._photo_profile_approved) et._photo_profile_approved = item.value;
                    }
                  }
                }
              });
            };
          }
          db.close();
        };
      } catch(e){}
    }, 300); // délai pour ne pas bloquer le rendu initial
  }
}

function renderAll(){
  if(_renderAllTimer) clearTimeout(_renderAllTimer);
  _renderAllTimer = setTimeout(renderAllImmediate, 16); // PERF: 16ms (1 frame) au lieu de 150ms
}

function renderAllImmediate(){
  /* ── Restaurer les photos persistantes au chaque rendu ── */
  // ✅ loadSoireePhotos() déplacée au démarrage (ligne 13292) — ne pas réappeler à chaque render
  _rankCache = null; // invalider le cache rankings
  // ── Actualiser visibilité pro-panels fiches ──
  setTimeout(function(){ if(typeof _applyFichesPanelVisibility === 'function') _applyFichesPanelVisibility(); }, 200);

  // ── Bandeau "Mon établissement" (membres propriétaires uniquement) ──
  var myBanner = document.getElementById("myEtabBanner");
  if(myBanner){
    var myEm = (currentUserEmail||"").toLowerCase().trim();
    var myEtab = !isAdmin && myEm ? etablissements.find(function(e){ return (e.email||"").toLowerCase().trim() === myEm; }) : null;
    if(myEtab){
      myBanner.style.display = "flex";
      var sub = document.getElementById("myEtabBannerSub");
      if(sub) sub.textContent = myEtab.nom + " · " + myEtab.quartier + " — Statut : " + (myEtab.statut||"Inconnu");
      window._myEtabBannerClick = function(){ if(typeof openEtab === "function") openEtab(myEtab.id); };
    } else {
      myBanner.style.display = "none";
      window._myEtabBannerClick = null;
    }
  }
  var data=filterData();
  // Bandeau établissements archivés (admin uniquement) — supprimé : tous actifs
  var archivedHtml="";
  if(!data.length){
    var emptyMsg;
    if(typeof _gpsState !== "undefined" && _gpsState.active && _gpsState.lat !== null){
      var r = _gpsState.radius;
      var rLabel = r >= 999 ? "tous rayons" : (r < 1 ? (r*1000)+"m" : r+"km");
      emptyMsg = "<div style=\"text-align:center;padding:2.5rem 1rem;\"><div style=\"font-size:2.5rem;margin-bottom:0.8rem;\">&#128205;</div><div style=\"font-family:Syne,sans-serif;font-weight:800;font-size:0.95rem;color:var(--cyan);margin-bottom:0.4rem;\">Aucun lieu dans "+rLabel+"</div><div style=\"font-size:0.78rem;color:var(--muted);margin-bottom:1rem;\">Essayez d'élargir votre rayon de recherche</div><button onclick=\"setGpsRadius(999,null)\" style=\"background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);font-family:Syne,sans-serif;font-weight:700;font-size:0.82rem;padding:0.55rem 1.2rem;border-radius:100px;cursor:pointer;\">&#128270; Voir tous les lieux</button></div>";
    } else {
      emptyMsg = "<div style=\"text-align:center;padding:3rem;color:var(--muted)\">Aucun etablissement visible</div>";
    }
    document.getElementById("mainList").innerHTML=archivedHtml+emptyMsg;
    return;
  }
  // ── GPS banner dans la liste ──
  var gpsBannerHtml = "";
  var gpsActive = typeof _gpsState !== "undefined" && _gpsState.active && _gpsState.lat !== null;
  if(gpsActive){
    var nearby = typeof getNearbyCount === "function" ? getNearbyCount() : 0;
    var rLabel = _gpsState.radius >= 999 ? "tous" : (_gpsState.radius < 1 ? (_gpsState.radius*1000)+"m" : _gpsState.radius+"km");
    var methodLabel = _gpsState._method || "GPS";
    var methodIcon = methodLabel === "WhatsApp" ? "💬" : methodLabel === "Manuel" ? "✋" : "📡";
    gpsBannerHtml = "<div style=\"background:rgba(0,255,170,0.06);border:1px solid rgba(0,255,170,0.25);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.9rem;display:flex;align-items:center;gap:0.6rem;\">"
      +"<div style=\"width:10px;height:10px;border-radius:50%;background:var(--green);box-shadow:0 0 10px rgba(0,255,170,0.7);flex-shrink:0;animation:pulse 2s infinite;\"></div>"
      +"<div style=\"flex:1;\"><div style=\"font-size:0.8rem;font-weight:700;color:var(--green);\">"+methodIcon+" "+nearby+" lieu"+(nearby>1?"x":"")+" dans "+rLabel+" — triés par proximité</div>"
      +"<div style=\"font-size:0.62rem;color:var(--muted);margin-top:0.1rem;\">Via "+methodLabel+" · "+(_gpsState.sort==="distance"?"distance":_gpsState.sort==="affluence"?"affluence":"note")+"</div></div>"
      +"<button onclick=\"closeNearbyMode()\" style=\"background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.25);color:var(--red);font-size:0.7rem;font-weight:700;padding:0.25rem 0.55rem;border-radius:8px;cursor:pointer;font-family:DM Sans,sans-serif;\">&#10005; Désactiver</button>"
      +"</div>";
  }

  // ── Fonction helper : séparer proches / lointains et insérer les headers ──
  function buildProximityGroupedList(dataArr, buildFn, baseDelay) {
    if (!gpsActive) return null; // pas de groupage sans GPS
    var PROX_KM = _gpsState.radius >= 999 ? 3 : _gpsState.radius; // seuil "proche"
    var near = dataArr.filter(function(e){ return typeof e._distKm === "number" && e._distKm <= PROX_KM; });
    var far  = dataArr.filter(function(e){ return !(typeof e._distKm === "number" && e._distKm <= PROX_KM); });
    // Les deux groupes sont déjà triés par distance via sortGpsData
    var html2 = "";
    if (near.length > 0) {
      html2 += "<div class=\"proximity-section-header prox-near\">"
             + "<div class=\"prox-dot prox-dot-near\"></div>"
             + "&#127381; " + near.length + " lieu" + (near.length > 1 ? "x" : "") + " près de vous"
             + "<span style=\"margin-left:auto;font-size:0.6rem;font-weight:400;color:rgba(0,255,170,0.7);\">≤ " + (PROX_KM < 1 ? (PROX_KM*1000)+"m" : PROX_KM+"km") + "</span>"
             + "</div>";
      html2 += "<div class=\"cards-list\">";
      near.forEach(function(e,i){ html2 += buildFn(e, (baseDelay||0) + i*0.02, "card-prox-near", i+1); });
      html2 += "</div>";
    }
    if (far.length > 0) {
      html2 += "<div class=\"proximity-section-header prox-far\">"
             + "<div class=\"prox-dot prox-dot-far\"></div>"
             + "&#128205; " + far.length + " lieu" + (far.length > 1 ? "x" : "") + " plus loin"
             + "</div>";
      html2 += "<div class=\"cards-list\">";
      far.forEach(function(e,i){ html2 += buildFn(e, (baseDelay||0) + i*0.02, "", near.length+i+1); });
      html2 += "</div>";
    }
    if (near.length === 0 && far.length === 0) return null;
    return html2;
  }

  var html=gpsBannerHtml;
  // ═══ PERF PATCH — Virtualisation par IntersectionObserver ═══
  // Affiche _VIRT_INIT items au premier rendu, charge _VIRT_PAGE items supplémentaires
  // à chaque fois que le sentinel (div invisible) entre dans le viewport.
  // Sur 800 établissements : ~800 → ~30 nœuds DOM au démarrage.
  var _VIRT_PAGE = 20;
  var _VIRT_INIT = 30;
  window._virtPendingListe   = null;
  window._virtPendingCompact = null;

  function _attachVirtSentinel(dataArr, from, buildFn, listSelector) {
    if(window._virtObserver){ window._virtObserver.disconnect(); window._virtObserver = null; }
    var oldSentinel = document.getElementById('_virtSentinel');
    if(oldSentinel) oldSentinel.remove();
    if(from >= dataArr.length) return;
    var listEl = document.querySelector(listSelector);
    if(!listEl) return;
    var sentinel = document.createElement('div');
    sentinel.id = '_virtSentinel';
    sentinel.style.cssText = 'height:2px;width:100%;pointer-events:none;';
    listEl.parentNode.insertBefore(sentinel, listEl.nextSibling);
    var curFrom = from;
    window._virtObserver = new IntersectionObserver(function(entries){
      if(!entries[0].isIntersecting) return;
      var chunk = dataArr.slice(curFrom, curFrom + _VIRT_PAGE);
      if(!chunk.length){ window._virtObserver.disconnect(); sentinel.remove(); return; }
      var frag = '';
      chunk.forEach(function(e,i){ frag += buildFn(e, curFrom + i); });
      listEl.insertAdjacentHTML('beforeend', frag);
      curFrom += _VIRT_PAGE;
      if(curFrom >= dataArr.length){
        window._virtObserver.disconnect();
        window._virtObserver = null;
        sentinel.remove();
      }
    }, { rootMargin: '300px 0px', threshold: 0 });
    window._virtObserver.observe(sentinel);
  }
  // ═══ FIN PERF PATCH virtualisation ═══

  if(currentView==="compact"){
    // Vue compacte : tri par score (avec cache)
    if(!isAdmin){
      data = data.slice().sort(function(a,b){
        return _getCachedScore(b).score - _getCachedScore(a).score;
      });
    }
    // GPS actif → trier par distance d'abord + classe proche
    if(gpsActive) data = sortGpsData(data);
    var PROX_KM_C = (gpsActive && typeof _gpsState !== "undefined") ? (_gpsState.radius >= 999 ? 3 : _gpsState.radius) : 0;
    
    // ✅ NOUVEAU : Si spotlight depuis Top du moment, afficher en fiche complète EN TÊTE
    var spotlightFound = false;
    if(window._spotlightEtabTopMoment){
      var spEtab = data.find(function(e){ return String(e.id) === String(window._spotlightEtabTopMoment); });
      if(spEtab){
        spotlightFound = true;
        html += "<div class=\"compact-list\" style=\"border-bottom:1px solid rgba(255,45,155,0.15);padding-bottom:0.8rem;margin-bottom:0.8rem;\">";
        html += buildCard(spEtab, 0, false, 1); // Fiche complète en tête
        html += "</div>";
        // Retirer du spotlight pour ne pas l'afficher 2 fois
        data = data.filter(function(e){ return String(e.id) !== String(window._spotlightEtabTopMoment); });
        window._spotlightEtabTopMoment = null; // reset pour prochain rendu
      }
    }
    
    // PERF PATCH : afficher _VIRT_INIT items, sentinel charge la suite (sauf si GPS actif)
    var _compactSlice = gpsActive ? data : data.slice(0, _VIRT_INIT);
    html+="<div class=\"compact-list\">";
    _compactSlice.forEach(function(e,i){
      var _ec = (gpsActive && typeof e._distKm === "number" && e._distKm <= PROX_KM_C) ? "card-prox-near" : "";
      html+=buildCompactRow(e,spotlightFound?i+2:i+1,_ec); // Décaler le rank si spotlight
    });
    html+="</div>";
    if(!gpsActive && data.length > _VIRT_INIT){
      window._virtPendingCompact = { data: data, from: _VIRT_INIT };
    }
  } else if(currentView==="liste"){
    // Tri par score dans la vue liste (visiteurs, avec cache)
    if(!isAdmin){
      data = data.slice().sort(function(a,b){
        return _getCachedScore(b).score - _getCachedScore(a).score;
      });
    }
    // GPS actif → regrouper par proximité
    if(gpsActive){
      data = sortGpsData(data);
      var proxHtml = buildProximityGroupedList(data, function(e, delay, extraClass, rank){
        return buildCard(e, delay, false, rank, extraClass);
      }, 0);
      if(proxHtml) { html += proxHtml; }
      else {
        html+="<div class=\"cards-list\">";
        data.forEach(function(e,i){html+=buildCard(e,i*0.02,false,i+1);});
        html+="</div>";
      }
    } else {
      // PERF PATCH : afficher _VIRT_INIT items, sentinel charge la suite
      var _listeSlice = data.slice(0, _VIRT_INIT);
      html+="<div class=\"cards-list\">";
      _listeSlice.forEach(function(e,i){html+=buildCard(e,i*0.02,false,i+1);});
      html+="</div>";
      if(data.length > _VIRT_INIT){
        window._virtPendingListe = { data: data, from: _VIRT_INIT };
      }
    }
  } else {
    if(gpsActive){
      // GPS actif : d'abord une section "Proches de vous" toutes catégories mélangées, puis par catégorie
      data = sortGpsData(data);
      var PROX_KM2 = _gpsState.radius >= 999 ? 3 : _gpsState.radius;
      var nearAll = data.filter(function(e){ return typeof e._distKm === "number" && e._distKm <= PROX_KM2; });
      var farAll  = data.filter(function(e){ return !(typeof e._distKm === "number" && e._distKm <= PROX_KM2); });

      if(nearAll.length > 0){
        html += "<div class=\"proximity-section-header prox-near\">"
              + "<div class=\"prox-dot prox-dot-near\"></div>"
              + "&#127381; " + nearAll.length + " lieu" + (nearAll.length > 1 ? "x" : "") + " près de vous"
              + "<span style=\"margin-left:auto;font-size:0.6rem;font-weight:400;color:rgba(0,255,170,0.7);\">≤ " + (PROX_KM2 < 1 ? (PROX_KM2*1000)+"m" : PROX_KM2+"km") + "</span>"
              + "</div>";
        html += "<div class=\"cards-list\">";
        nearAll.forEach(function(e,i){ html += buildCard(e, i*0.03, false, i+1, "card-prox-near"); });
        html += "</div>";
      }

      if(farAll.length > 0){
        // Grouper les lointains par catégorie
        var farGroups = {};
        farAll.forEach(function(e){ var c=getCategory(e.type); if(!farGroups[c]) farGroups[c]=[]; farGroups[c].push(e); });
        html += "<div class=\"proximity-section-header prox-far\" style=\"margin-top:" + (nearAll.length > 0 ? "0.8rem" : "0") + ";\">"
              + "<div class=\"prox-dot prox-dot-far\"></div>"
              + "&#128205; " + farAll.length + " lieu" + (farAll.length > 1 ? "x" : "") + " plus éloigné" + (farAll.length > 1 ? "s" : "")
              + "</div>";
        var farGlobalRank = nearAll.length;
        CATEGORIES.forEach(function(cat){
          if(farGroups[cat.key] && farGroups[cat.key].length > 0){
            var gs = farGroups[cat.key].slice().sort(function(a,b){ return (a._distKm||9999)-(b._distKm||9999); });
            html += "<div class=\"cat-section\">";
            html += "<div class=\"cat-header\"><span class=\"cat-icon\">"+cat.icon+"</span><span class=\"cat-name\">"+cat.label+"</span><span class=\"cat-count\">"+gs.length+" lieu"+(gs.length>1?"x":"")+"</span></div>";
            html += "<div class=\"cards-list\">";
            gs.forEach(function(e,i){ farGlobalRank++; html += buildCard(e, i*0.04, false, farGlobalRank); });
            html += "</div></div>";
          }
        });
      }
    } else {
      /* ═══════════════════════════════════════════════════════
         VUE GROUPE — Grille de cellules accordion
         Chaque catégorie = une cellule (3 par ligne).
         Clic → déploiement du ruban d'établissements par le bas.
      ═══════════════════════════════════════════════════════ */
      var groups={};
      data.forEach(function(e){var c=getCategory(e.type);if(!groups[c])groups[c]=[];groups[c].push(e);});

      /* ─ Construire la grille de cellules ─ */
      var gridHtml = "<div class=\"cat-grid-wrap\">";
      CATEGORIES.forEach(function(cat){
        if(groups[cat.key] && groups[cat.key].length > 0){
          var cnt = groups[cat.key].length;
          gridHtml += "<div class=\"cat-cell\" id=\"catcell-"+cat.key+"\" onclick=\"window._toggleCatRibbon('"+cat.key.replace(/'/g,"\\'")+"')\">"
            + "<div class=\"cat-cell-icon\">"+cat.icon+"</div>"
            + "<div class=\"cat-cell-name\">"+cat.label+"</div>"
            + "<div class=\"cat-cell-count\">"+cnt+" lieu"+(cnt>1?"x":"")+"</div>"
            + "<span class=\"cat-cell-arrow\">▼</span>"
            + "</div>";
        }
      });
      gridHtml += "</div>";

      /* ─ Construire les rubans (initialement fermés) ─ */
      var ribbonsHtml = "";
      var globalRank = 0;
      CATEGORIES.forEach(function(cat){
        if(groups[cat.key] && groups[cat.key].length > 0){
          var groupSorted = groups[cat.key].slice().sort(function(a,b){
            return _getCachedScore(b).score - _getCachedScore(a).score;
          });
          ribbonsHtml += "<div class=\"cat-ribbon\" id=\"catribbon-"+cat.key+"\">"
            + "<div class=\"cat-ribbon-inner compact-list\">";
          groupSorted.forEach(function(e,i){
            globalRank++;
            var isSpotlight = (_spotlightEtabId !== null && String(e.id) === String(_spotlightEtabId));
            if(isSpotlight){
              ribbonsHtml += buildCard(e, i*0.04, false, globalRank);
            } else {
              ribbonsHtml += buildCompactRow(e, globalRank);
            }
          });
          ribbonsHtml += "</div></div>";
        }
      });

      /* Fallback : si aucune catégorie reconnue */
      if(!ribbonsHtml){
        ribbonsHtml = "<div class=\"cards-list\">";
        data.forEach(function(e,i){ribbonsHtml+=buildCard(e,i*0.04,false,i+1);});
        ribbonsHtml += "</div>";
      }
      html += gridHtml + ribbonsHtml;

      /* ─ Si spotlight : ouvrir automatiquement la bonne catégorie ─ */
      if(_spotlightEtabId !== null){
        var spEtab = data.find(function(e){ return String(e.id) === String(_spotlightEtabId); });
        if(spEtab){
          var spCat = getCategory(spEtab.type);
          setTimeout(function(){ window._toggleCatRibbon(spCat, true); }, 120);
        }
      }
    }
  }
  // Vue carte : mettre à jour les marqueurs si la carte est visible
  if(currentView==="carte"){
    var mc=document.getElementById("mapContainer");
    var ml=document.getElementById("mainList");
    if(mc) mc.style.display="block";
    if(ml) ml.style.display="none";
    if(window.openAmbiMap) setTimeout(function(){ window.openAmbiMap(); },50);
    return;
  }
  // Autres vues : s'assurer que la carte est masquée et la liste visible
  var _mc=document.getElementById("mapContainer");
  var _ml=document.getElementById("mainList");
  if(_mc) _mc.style.display="none";
  if(_ml) _ml.style.display="";
  // Bandeau archivés en bas de liste
  html+=archivedHtml;
  document.getElementById("mainList").innerHTML=html;
  // ═══ PERF PATCH — Attacher les sentinels de virtualisation après injection HTML ═══
  if(window._virtPendingListe){
    var _vpl = window._virtPendingListe;
    window._virtPendingListe = null;
    _attachVirtSentinel(_vpl.data, _vpl.from, function(e, idx){
      return buildCard(e, idx*0.02, false, idx+1);
    }, '#mainList .cards-list');
  }
  if(window._virtPendingCompact){
    var _vpc = window._virtPendingCompact;
    window._virtPendingCompact = null;
    _attachVirtSentinel(_vpc.data, _vpc.from, function(e, idx){
      var _ec = "";
      return buildCompactRow(e, idx+1, _ec);
    }, '#mainList .compact-list');
  }
  // ═══ FIN PERF PATCH sentinels ═══
  // Mise à jour silencieuse des marqueurs si la carte a déjà été ouverte
  if(window._ambiMapReady && window._renderMapMarkers) window._renderMapMarkers(data);
}

// ── Charger plus d'établissements (pagination liste) ──
// PERF PATCH : renderAllPaged remplacé par IntersectionObserver dans renderAllImmediate.
// Conservé ici en no-op pour compatibilité ascendante (anciens liens onclick éventuels).
window.renderAllPaged = function(from, total){ /* no-op — virtualisation active */ };
function toggleConfirme(index){
  if(!isAdmin)return;
  var p=paiements[index];
  if(!p)return;
  var newStatut=p.statut==="Confirme"?"En attente":"Confirme";
  // Si confirmation → activer l'abonnement sur l'établissement associé
  if(newStatut === "Confirme"){
    var etabMatch = etablissements.find(function(e){
      return e.nom && p.nom && e.nom.toLowerCase().indexOf(p.nom.toLowerCase().slice(0,10)) !== -1;
    });
    if(etabMatch && etabMatch.id){
      var planKey = p.abonnement_type || etabMatch.abonnement_type || "mensuel";
      var planData = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS["mensuel"];
      var now = Date.now();
      var updateSubData = {
        abonnement_type: planKey,
        abonnement_activated_at: now,
        abonnement_echeance: computeEcheance(planKey, now).toISOString(),
        paiement: "Actif — "+planData.label
      };
      if(window.db && window.fbDoc && window.fbUpdateDoc){
        window.fbUpdateDoc(window.fbDoc(window.db,"etablissements",String(etabMatch.id)), updateSubData)
          .then(function(){
            etabMatch.abonnement_type = planKey;
            etabMatch.abonnement_activated_at = now;
            etabMatch.abonnement_echeance = updateSubData.abonnement_echeance;
            etabMatch.paiement = updateSubData.paiement;
          }).catch(function(){});
      }
    }
  }
  // Mise à jour Firebase si disponible
  if(window.db && window.fbDoc && window.fbUpdateDoc){
    var docRef=window.fbDoc(window.db,"paiements",p.id);
    window.fbUpdateDoc(docRef,{statut:newStatut}).then(function(){
      paiements[index].statut=newStatut;
      renderPayments();renderAll();renderHome();
      showToast(newStatut==="Confirme"?"✅ Paiement confirmé — abonnement activé":"⏳ Remis en attente");
      if(newStatut==="Confirme" && typeof renderAdmEtabl==="function") setTimeout(renderAdmEtabl, 400);
    }).catch(function(){
      paiements[index].statut=newStatut;
      renderPayments();renderAll();renderHome();
      showToast(newStatut==="Confirme"?"✅ Confirmé (local)":"⏳ En attente (local)");
    });
  } else {
    paiements[index].statut=newStatut;
    renderPayments();renderAll();renderHome();
    showToast(newStatut==="Confirme"?"✅ Paiement confirmé — abonnement activé":"⏳ Remis en attente");
  }
}
window.toggleConfirme=toggleConfirme;
window.renderPayments=renderPayments;

// ══════════════════════════════════════════════════════════════
// ══ SYSTÈME GPS — PRÈS DE CHEZ VOUS                         ══
// ══════════════════════════════════════════════════════════════

// [GPS state and helpers declared earlier]

// ── Mettre à jour l'UI du bouton ─────────────────────────────
function updateGpsBtn() {
  var btn  = document.getElementById("gpsNearbyBtn");
  var sub  = document.getElementById("gpsNearbySubtxt");
  var badge = document.getElementById("gpsNearbyBadge");
  var pulse = document.getElementById("gpsNearbyPulse");
  if (!btn) return;

  btn.classList.remove("active","locating","error-state");

  if (_gpsState.loading) {
    btn.classList.add("locating");
    sub.textContent = "Localisation en cours...";
    if (pulse) pulse.style.display = "block";
    if (badge) badge.style.display = "none";
    return;
  }
  if (_gpsState.permissionDenied) {
    btn.classList.add("error-state");
    sub.textContent = "Accès GPS refusé — appuyez pour réessayer";
    if (pulse) pulse.style.display = "none";
    if (badge) badge.style.display = "none";
    return;
  }
  if (_gpsState.active && _gpsState.lat !== null) {
    btn.classList.add("active");
    var nearby = getNearbyCount();
    sub.textContent = nearby + " lieu" + (nearby > 1 ? "x" : "") + " dans " +
      (_gpsState.radius >= 999 ? "tous" : (_gpsState.radius < 1 ? (_gpsState.radius*1000)+"m" : _gpsState.radius+"km"));
    if (pulse) pulse.style.display = "block";
    if (badge) { badge.textContent = nearby; badge.style.display = nearby > 0 ? "" : "none"; }
  } else {
    sub.textContent = "Trouver les lieux proches de votre position";
    if (pulse) pulse.style.display = "none";
    if (badge) badge.style.display = "none";
  }
}

// [getNearbyCount declared earlier]

// ── Succès géolocalisation ───────────────────────────────────
function onGpsSuccess(pos) {
  _gpsState.lat      = pos.coords.latitude;
  _gpsState.lng      = pos.coords.longitude;
  _gpsState.accuracy = pos.coords.accuracy;
  _gpsState.timestamp = Date.now();
  _gpsState.loading  = false;
  _gpsState.error    = null;
  _gpsState.permissionDenied = false;
  // S'assurer que le mode actif est bien positionné avant tout render
  if (!_gpsState.active) _gpsState.active = true;

  _saveGpsState(); /* Persister pour survivre aux rechargements */
  enrichWithDistances();
  updateGpsBtn();
  updateGpsPanel();
  updateGpsDetailModal();
  renderAll(); // re-render avec distances
  showToast("📍 Position mise à jour !");
}

// ── Erreur géolocalisation ───────────────────────────────────
function onGpsError(err) {
  _gpsState.loading = false;
  _gpsState.error = err.message;
  if (err.code === 1) { // PERMISSION_DENIED
    _gpsState.permissionDenied = true;
    showToast("⛔ Accès GPS refusé");
    document.getElementById("gpsPermBanner") && (document.getElementById("gpsPermBanner").classList.add("show"));
  } else if (err.code === 2) {
    showToast("⚠️ Position indisponible");
  } else {
    showToast("⏱️ Délai GPS dépassé — réessayez");
  }
  updateGpsBtn();
  updateGpsPanel();
}

// ── Demander la position ─────────────────────────────────────
function requestGps(highAccuracy) {
  if (!navigator.geolocation) {
    showToast("GPS non disponible sur ce navigateur");
    return;
  }
  /* Annuler tout watch existant avant d'en démarrer un nouveau */
  stopGpsWatch();
  _gpsState.loading  = true;
  _gpsState.watching = true;
  updateGpsBtn();
  /* watchPosition au lieu de getCurrentPosition : la première position
     déclenche onGpsSuccess immédiatement, les suivantes gardent _distKm
     toujours à jour — plus de position périmée après navigation. */
  _gpsState.watchId = navigator.geolocation.watchPosition(
    function(pos) { onGpsSuccess(pos); if (typeof updateGpsWatchBtn === 'function') updateGpsWatchBtn(); },
    function(err)  { onGpsError(err);  stopGpsWatch(); },
    { enableHighAccuracy: highAccuracy !== false, timeout: 12000, maximumAge: 5000 }
  );
}

// ── Toggle mode Près de chez vous ───────────────────────────
function toggleNearbyMode() {
  if (_gpsState.active) {
    closeNearbyMode();
    return;
  }
  _gpsState.active = true;
  document.getElementById("gpsPanel").classList.add("show");
  updateGpsBtn();

  if (_gpsState.lat !== null) {
    // Position déjà connue, juste re-render
    enrichWithDistances();
    updateGpsPanel();
    renderAll();
  } else {
    requestGps(true);
  }
}

function closeNearbyMode() {
  _gpsState.active = false;
  _clearGpsState(); /* Supprimer la persistance localStorage */
  document.getElementById("gpsPanel").classList.remove("show");
  // Supprimer les distances des établissements
  etablissements.forEach(function(e){ delete e._distKm; });
  stopGpsWatch();
  updateGpsBtn();
  renderAll();
}

// ── Explorer les lieux depuis l'accueil ─────────────────────
function explorerLieux() {
  // ✅ CORRIGÉ : Basculer sur Lieux SANS ouvrir le modal GPS automatiquement
  // Le GPS modal ne s'ouvre que quand on clique sur "Près de chez moi"
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
}

// ── Carte depuis l'accueil ────────────────────────────────────
function ouvrirCarteHome() {
  // Basculer sur la section Lieux
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
  // Activer le mode carte après la transition
  setTimeout(function(){
    currentView = 'carte';
    document.querySelectorAll('[data-view]').forEach(function(b){ b.classList.remove('active'); });
    var carteBtn = document.querySelector('[data-view="carte"]');
    if(carteBtn) carteBtn.classList.add('active');
    if(window.openAmbiMap) window.openAmbiMap();
  }, 180);
}

// ── Quick nearby depuis l'accueil ────────────────────────────
function quickNearby() {
  switchSection("etablissements", document.querySelectorAll(".nav-item")[1]);
  setTimeout(function(){
    if (!_gpsState.active) openGeoMethodSheet();
  }, 100);
}

// ══════════════════════════════════════════════════════════════
// ══ GÉOLOCALISATION AVANCÉE — MÉTHODE PICKER               ══
// ══════════════════════════════════════════════════════════════

function openGeoMethodSheet() {
  // Si déjà actif → toggler la désactivation
  if (_gpsState.active) {
    if(confirm('Désactiver la géolocalisation et revenir au classement normal ?')) {
      closeNearbyMode();
    }
    return;
  }
  // Réinitialiser l'état du sheet
  document.getElementById('geoWaInputWrap').classList.remove('show');
  document.getElementById('geoManualWrap').classList.remove('show');
  document.getElementById('geoMethodOptions').style.display = 'flex';
  document.getElementById('geoMethodOptions').style.flexDirection = 'column';
  document.getElementById('geoMethodSheet').classList.add('open');
}

function closeGeoMethodSheet() {
  document.getElementById('geoMethodSheet').classList.remove('open');
}

function selectGeoMethod(method) {
  if (method === 'gps') {
    closeGeoMethodSheet();
    _gpsState.active = true;
    document.getElementById('gpsPanel').classList.add('show');
    updateGpsBtn();
    if (_gpsState.lat !== null) {
      enrichWithDistances();
      updateGpsPanel();
      renderAll();
    } else {
      requestGps(true);
    }
  } else if (method === 'whatsapp') {
    document.getElementById('geoMethodOptions').style.display = 'none';
    document.getElementById('geoWaInputWrap').classList.add('show');
    document.getElementById('geoManualWrap').classList.remove('show');
    setTimeout(function(){ document.getElementById('geoWaInput').focus(); }, 300);
  } else if (method === 'manual') {
    document.getElementById('geoMethodOptions').style.display = 'none';
    document.getElementById('geoManualWrap').classList.add('show');
    document.getElementById('geoWaInputWrap').classList.remove('show');
    setTimeout(function(){ document.getElementById('geoManualLat').focus(); }, 300);
  }
}

function _parseCoords(str) {
  // Tenter d'extraire lat/lng depuis une URL Google Maps ou des coordonnées brutes
  if (!str) return null;
  str = str.trim();
  // Format: https://maps.google.com/?q=0.3924,9.4536
  var m = str.match(/[?&]q=(-?\d+\.?\d*)[,\s](-?\d+\.?\d*)/i);
  if (!m) m = str.match(/@(-?\d+\.?\d*)[,\s](-?\d+\.?\d*)/i);
  if (!m) m = str.match(/^(-?\d+\.?\d*)[,\s;/\|]+(-?\d+\.?\d*)$/);
  if (m) {
    var lat = parseFloat(m[1]), lng = parseFloat(m[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat: lat, lng: lng };
    }
  }
  return null;
}

function _applyExternalCoords(lat, lng, methodLabel) {
  _gpsState.lat       = lat;
  _gpsState.lng       = lng;
  _gpsState.accuracy  = 500; // précision approximative
  _gpsState.timestamp = Date.now();
  _gpsState.loading   = false;
  _gpsState.error     = null;
  _gpsState.permissionDenied = false;
  _gpsState.active    = true;
  _gpsState._method   = methodLabel;
  _saveGpsState(); /* Persister méthode externe aussi */
  document.getElementById('gpsPanel').classList.add('show');
  enrichWithDistances();
  updateGpsBtn();
  updateGpsPanel();
  renderAll();
  closeGeoMethodSheet();
  showToast('📍 Position définie — résultats triés par proximité !');
}

function confirmGeoFromWA() {
  var input = (document.getElementById('geoWaInput').value || '').trim();
  var coords = _parseCoords(input);
  if (!coords) {
    showToast('⚠️ Lien ou coordonnées non reconnus. Vérifiez le format.');
    return;
  }
  _applyExternalCoords(coords.lat, coords.lng, 'WhatsApp');
}

function confirmGeoFromManual() {
  var lat = parseFloat(document.getElementById('geoManualLat').value);
  var lng = parseFloat(document.getElementById('geoManualLng').value);
  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    showToast('⚠️ Coordonnées invalides. Ex: Latitude 0.3924, Longitude 9.4536');
    return;
  }
  _applyExternalCoords(lat, lng, 'Manuel');
}

// ── Surcharger updateGpsBtn pour afficher la méthode ──
var _origUpdateGpsBtn = updateGpsBtn;
updateGpsBtn = function() {
  _origUpdateGpsBtn();
  var btn = document.getElementById('gpsNearbyBtn');
  var icon = document.getElementById('gnbIcon');
  if (!btn) return;
  if (_gpsState.active && _gpsState.lat !== null) {
    btn.classList.add('geo-method-active');
    if (icon) {
      var method = _gpsState._method || 'GPS';
      if (method === 'WhatsApp') icon.textContent = '💬';
      else if (method === 'Manuel') icon.textContent = '✋';
      else icon.textContent = '📡';
    }
  } else {
    btn.classList.remove('geo-method-active');
    if (icon) icon.textContent = '📍';
  }
};

// ── Rayon de recherche ───────────────────────────────────────
function setGpsRadius(km, btn) {
  _gpsState.radius = km;
  document.querySelectorAll(".gps-radius-btn").forEach(function(b){ b.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  enrichWithDistances();
  updateGpsPanel();
  updateGpsBtn();
  renderAll();
}

// ── Tri GPS ──────────────────────────────────────────────────
function setGpsSort(s, btn) {
  _gpsState.sort = s;
  document.querySelectorAll(".gps-sort-btn").forEach(function(b){ b.classList.remove("active"); });
  if (btn) btn.classList.add("active");
  renderAll();
}

// ── Panel GPS ────────────────────────────────────────────────
function updateGpsPanel() {
  var locRow  = document.getElementById("gpsUserLocRow");
  var locTxt  = document.getElementById("gpsUserLocTxt");
  var coords  = document.getElementById("gpsUserCoords");
  var resCount = document.getElementById("gpsResultCount");
  var resNum  = document.getElementById("gpsResultNum");
  var resRad  = document.getElementById("gpsResultRadius");
  var accWrap = document.getElementById("gpsAccuracyWrap");
  var accTxt  = document.getElementById("gpsAccuracyTxt");
  var accFill = document.getElementById("gpsAccuracyFill");

  if (!locRow) return;

  if (_gpsState.lat !== null) {
    locRow.style.display = "flex";
    // Obtenir quartier ou adresse approximative
    locTxt.textContent = "Votre position (Libreville)";
    coords.textContent = (Math.abs(_gpsState.lat).toFixed(5)) + "° " + (_gpsState.lat >= 0 ? "N" : "S") + ", " + (Math.abs(_gpsState.lng).toFixed(5)) + "° " + (_gpsState.lng >= 0 ? "E" : "O");

    // Résultats
    var nearby = getNearbyCount();
    resCount.style.display = "flex";
    resNum.textContent = nearby;
    resRad.textContent = _gpsState.radius >= 999 ? "tous rayons" :
      (_gpsState.radius < 1 ? (_gpsState.radius*1000)+"m" : _gpsState.radius+" km");

    // Précision
    if (_gpsState.accuracy) {
      accWrap.style.display = "block";
      var acc = Math.round(_gpsState.accuracy);
      accTxt.textContent = "±" + acc + " m";
      // Score précision : 100% = <5m, 0% = >500m
      var score = Math.max(0, Math.min(100, 100 - (acc / 500 * 100)));
      accFill.style.width = score + "%";
    }
  } else {
    locRow.style.display = "none";
    resCount.style.display = "none";
    accWrap.style.display = "none";
  }
}

// ── Rafraîchir position ──────────────────────────────────────
function refreshGpsPosition() {
  requestGps(true);
}

// ── Suivi temps réel ─────────────────────────────────────────
function toggleGpsWatch() {
  if (_gpsState.watching) {
    stopGpsWatch();
  } else {
    startGpsWatch();
  }
}

function startGpsWatch() {
  if (!navigator.geolocation) return;
  _gpsState.watching = true;
  _gpsState.watchId = navigator.geolocation.watchPosition(
    function(pos) { onGpsSuccess(pos); updateGpsWatchBtn(); },
    function(err) { onGpsError(err); stopGpsWatch(); },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
  );
  updateGpsWatchBtn();
  showToast("📡 Suivi GPS activé");
}

function stopGpsWatch() {
  if (_gpsState.watchId !== null) {
    navigator.geolocation.clearWatch(_gpsState.watchId);
    _gpsState.watchId = null;
  }
  _gpsState.watching = false;
  updateGpsWatchBtn();
}

function updateGpsWatchBtn() {
  var btn = document.getElementById("gpsWatchBtn");
  if (!btn) return;
  if (_gpsState.watching) {
    btn.classList.add("watching");
    btn.textContent = "🟢 Suivi temps réel — Actif (appuyer pour arrêter)";
  } else {
    btn.classList.remove("watching");
    btn.textContent = "📡 Suivi temps réel — Activer";
  }
}

// ── Modal détails GPS ────────────────────────────────────────
function openGpsDetailModal() {
  updateGpsDetailModal();
  document.getElementById("gpsDetailOverlay").classList.add("show");
}

function closeGpsDetailModal() {
  document.getElementById("gpsDetailOverlay").classList.remove("show");
}

function updateGpsDetailModal() {
  var sub    = document.getElementById("gpsDetailSub");
  var sDist  = document.getElementById("gpsStatDist");
  var sCount = document.getElementById("gpsStatCount");
  var sAcc   = document.getElementById("gpsStatAcc");
  var sUpd   = document.getElementById("gpsStatUpd");
  var permBanner = document.getElementById("gpsPermBanner");
  if (!sDist) return;

  if (_gpsState.permissionDenied) {
    permBanner && permBanner.classList.add("show");
    if (sub) sub.textContent = "Accès GPS refusé";
  } else {
    permBanner && permBanner.classList.remove("show");
  }

  if (_gpsState.lat !== null) {
    sub && (sub.textContent = "Position active — Libreville, Gabon");

    // Lieu le + proche
    var withDist = etablissements.filter(function(e){ return e._distKm !== null; });
    withDist.sort(function(a,b){ return a._distKm - b._distKm; });
    sDist.textContent = withDist.length ? fmtDist(withDist[0]._distKm) : "—";

    // Dans 1km
    sCount.textContent = etablissements.filter(function(e){ return e._distKm !== null && e._distKm <= 1; }).length;

    // Précision
    sAcc.textContent = _gpsState.accuracy ? "±"+Math.round(_gpsState.accuracy)+"m" : "—";

    // Mise à jour
    if (_gpsState.timestamp) {
      var d = new Date(_gpsState.timestamp);
      sUpd.textContent = d.getHours().toString().padStart(2,"0")+":"+d.getMinutes().toString().padStart(2,"0");
    }
  } else {
    sDist.textContent = "—";
    sCount.textContent = "—";
    sAcc.textContent = "—";
    sUpd.textContent = "—";
  }
}

// ── Exposer globalement ──────────────────────────────────────
window.toggleNearbyMode    = toggleNearbyMode;
window.closeNearbyMode     = closeNearbyMode;
window.quickNearby         = quickNearby;
window.explorerLieux       = explorerLieux;
window.ouvrirCarteHome     = ouvrirCarteHome;
window.openGeoMethodSheet  = openGeoMethodSheet;
window.closeGeoMethodSheet = closeGeoMethodSheet;
window.selectGeoMethod     = selectGeoMethod;
window.confirmGeoFromWA    = confirmGeoFromWA;
window.confirmGeoFromManual= confirmGeoFromManual;
window.setGpsRadius        = setGpsRadius;
window.setGpsSort          = setGpsSort;
window.refreshGpsPosition  = refreshGpsPosition;
window.toggleGpsWatch      = toggleGpsWatch;
window.openGpsDetailModal  = openGpsDetailModal;
window.closeGpsDetailModal = closeGpsDetailModal;

var _payFilter="all";
var _paySearch="";

window._payFilter=_payFilter;
window._paySearch=_paySearch;

function renderPayments(){
  // 🔐 SÉCURITÉ: paiements filtrés selon le rôle
  var visible=getVisiblePayments();

  // Stats calculées sur les paiements accessibles à l'utilisateur
  var basePay=paiements;
  if(currentUserRole==="establishment"&&currentEstablishmentId){
    basePay=basePay.filter(function(p){return p.nom.toLowerCase()===currentEstablishmentId.toLowerCase();});
  }
  var total=basePay.length;
  var nbConfirme=basePay.filter(function(p){return p.statut==="Confirme";}).length;
  var nbAttente=basePay.filter(function(p){return p.statut==="En attente";}).length;
  var confirmed=basePay.reduce(function(s,p){return s+(p.statut==="Confirme"?p.montant:0);},0);

  var html="";

  if(isAdmin){
    html+="<div style=\"display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:0.9rem;\">";
    html+="<div style=\"background:rgba(0,255,170,0.07);border:1px solid rgba(0,255,170,0.2);border-radius:12px;padding:0.65rem;text-align:center;\">";
    html+="<div style=\"font-family:Syne,sans-serif;font-size:1.15rem;font-weight:800;color:var(--green);\">"+nbConfirme+"</div><div style=\"font-size:0.62rem;color:var(--muted);\">Confirm\u00e9s</div></div>";
    html+="<div style=\"background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);border-radius:12px;padding:0.65rem;text-align:center;\">";
    html+="<div style=\"font-family:Syne,sans-serif;font-size:1.15rem;font-weight:800;color:var(--amber);\">"+nbAttente+"</div><div style=\"font-size:0.62rem;color:var(--muted);\">En attente</div></div>";
    html+="<div style=\"background:rgba(255,45,155,0.07);border:1px solid rgba(255,45,155,0.2);border-radius:12px;padding:0.65rem;text-align:center;\">";
    html+="<div style=\"font-family:Syne,sans-serif;font-size:1.15rem;font-weight:800;color:var(--pink);\">"+total+"</div><div style=\"font-size:0.62rem;color:var(--muted);\">Total</div></div>";
    html+="</div>";
    html+="<div style=\"display:flex;gap:0.4rem;margin-bottom:0.7rem;align-items:center;\">";
    html+="<input id=\"paySearchInp\" type=\"text\" placeholder=\"\u{1F50D} Rechercher...\" value=\""+_paySearch+"\" oninput=\"_paySearch=this.value.toLowerCase();renderPayments()\" style=\"flex:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,45,155,0.2);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.82rem;padding:0.5rem 0.8rem;outline:none;\">";
    html+="</div>";
    html+="<div style=\"display:flex;gap:0.4rem;margin-bottom:0.9rem;flex-wrap:wrap;\">";
    html+="<button onclick=\"_payFilter=\'all\';renderPayments()\" style=\"flex:1;padding:0.4rem;border-radius:8px;border:1px solid "+(_payFilter==="all"?"var(--pink)":"rgba(255,255,255,0.1)")+";background:"+(_payFilter==="all"?"rgba(255,45,155,0.15)":"transparent")+";color:"+(_payFilter==="all"?"var(--pink)":"var(--muted)")+";font-size:0.75rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">Tous ("+total+")</button>";
    html+="<button onclick=\"_payFilter=\'Confirme\';renderPayments()\" style=\"flex:1;padding:0.4rem;border-radius:8px;border:1px solid "+(_payFilter==="Confirme"?"var(--green)":"rgba(255,255,255,0.1)")+";background:"+(_payFilter==="Confirme"?"rgba(0,255,170,0.12)":"transparent")+";color:"+(_payFilter==="Confirme"?"var(--green)":"var(--muted)")+";font-size:0.75rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">\u2705 Confirm\u00e9s ("+nbConfirme+")</button>";
    html+="<button onclick=\"_payFilter=\'En attente\';renderPayments()\" style=\"flex:1;padding:0.4rem;border-radius:8px;border:1px solid "+(_payFilter==="En attente"?"var(--amber)":"rgba(255,255,255,0.1)")+";background:"+(_payFilter==="En attente"?"rgba(255,215,0,0.12)":"transparent")+";color:"+(_payFilter==="En attente"?"var(--amber)":"var(--muted)")+";font-size:0.75rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">\u23F3 En attente ("+nbAttente+")</button>";
    html+="</div>";
    // 🔐 NOUVEAU — Filtre par établissement (admin seulement)
    var estabNames={};
    paiements.forEach(function(p){estabNames[p.nom.toLowerCase()]=p.nom;});
    var estabList=Object.values(estabNames);
    if(estabList.length>0){
      html+="<div style=\"margin-bottom:0.9rem;padding-top:0.6rem;border-top:1px solid rgba(255,255,255,0.08);\">";
      html+="<div style=\"font-size:0.68rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:0.45rem;\">\uD83C\uDFEA Filtrer par \u00e9tablissement</div>";
      html+="<div style=\"display:flex;gap:0.3rem;flex-wrap:wrap;\">";
      html+="<button onclick=\"_payEstablishmentFilter=null;renderPayments()\" style=\"padding:0.35rem 0.7rem;border-radius:8px;border:1px solid "+(_payEstablishmentFilter===null?"var(--cyan)":"rgba(255,255,255,0.1)")+";background:"+(_payEstablishmentFilter===null?"rgba(0,229,255,0.15)":"transparent")+";color:"+(_payEstablishmentFilter===null?"var(--cyan)":"var(--muted)")+";font-size:0.72rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">\uD83D\uDCCA Tous</button>";
      estabList.forEach(function(name){
        var key=name.toLowerCase();
        var act=_payEstablishmentFilter===key;
        html+="<button onclick=\"_payEstablishmentFilter=\'"+key+"\';renderPayments()\" style=\"padding:0.35rem 0.7rem;border-radius:8px;border:1px solid "+(act?"var(--pink)":"rgba(255,255,255,0.1)")+";background:"+(act?"rgba(255,45,155,0.15)":"transparent")+";color:"+(act?"var(--pink)":"var(--muted)")+";font-size:0.72rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;\">\uD83C\uDFEA "+name+"</button>";
      });
      html+="</div></div>";
    }
  }

  /* ── Tri par statut paiement : Confirmé → En attente → Autres ── */
  if(isAdmin){
    visible = visible.slice().sort(function(a,b){
      var rank = function(p){
        if(p.statut==="Confirme") return 0;
        if(p.statut==="En attente") return 1;
        return 2;
      };
      return rank(a) - rank(b);
    });
  }

  visible.forEach(function(p,i){
    var realIdx=paiements.indexOf(p);
    var isConfirme = p.statut==="Confirme";
    // Trouver l'étab lié pour l'horloge
    var etabLie = etablissements.find(function(e){
      return e.nom && p.nom && e.nom.toLowerCase().indexOf(p.nom.toLowerCase().slice(0,8)) !== -1;
    });
    html+="<div class=\"pay-item\" style=\"animation-delay:"+(i*0.03)+"s;border-color:"+(isConfirme?"rgba(0,255,170,0.2)":"rgba(255,215,0,0.15)")+";\">";
    html+="<div class=\"pay-item-top\"><div><div class=\"pay-id\">"+p.id+"</div><div class=\"pay-name\">"+p.nom+"</div></div>";
    html+="<div class=\"pay-amount\">"+p.montant.toLocaleString("fr-FR")+" XAF</div></div>";
    html+="<div class=\"pay-chips\">";
    html+="<span class=\"pchip\">"+(p.mode==="Airtel Money"?"&#128992;":"&#128994;")+" "+p.mode+"</span>";
    html+="<span class=\"pchip\">&#128197; "+p.date+"</span>";
    if(isAdmin){
      if(isConfirme){
        // Horloge mini si étab activé
        var clockHtml = (etabLie && typeof ambiPayClockHTML === "function") ? ambiPayClockHTML(etabLie) : "<span class='pchip' style='color:var(--green);'>✅ Confirmé</span>";
        html += clockHtml;
      } else {
        // Bouton activation
        html += "<button class='ambi-confirm-pay-btn' style='margin-top:0.5rem;' onclick='ambiOpenActivateModal("+realIdx+")'>🟢 Confirmer &amp; Activer le chrono</button>";
      }
    } else {
      var sc2=isConfirme?"color:var(--green)":"color:var(--amber)";
      html+="<span class=\"pchip\" style=\"pointer-events:none;"+sc2+"\">"+(isConfirme?"✅ Confirmé":"⏳ En attente")+"</span>";
    }
    html+="</div></div>";
  });

  if(visible.length===0){
    html+="<div style=\"text-align:center;padding:2rem;color:var(--muted);font-size:0.82rem;\">Aucun paiement trouv\u00e9</div>";
  }

  html+="<div class=\"pay-total-bar\"><div class=\"t-lbl\">Total percu confirme</div><div class=\"t-val\">"+confirmed.toLocaleString("fr-FR")+" XAF</div></div>";
  var el=document.getElementById("payList");
  if(el)el.innerHTML=html;
  // Init countdowns + blockclocks après rendu
  setTimeout(function(){
    if(typeof _initCountdownElements==="function") _initCountdownElements();
    if(typeof _ambiInitBlockClocks==="function") _ambiInitBlockClocks();
  }, 80);
}

// NAV
var SECS=["accueil","etablissements","fiches","paiements","contacts","profil","social"];
function goHome(){switchSection("accueil",document.querySelector(".nav-item"));}
function switchSection(name,btn){
  /* FIX#2b — Mise à jour active immédiate, DOM section via rAF pour fluidité */
  if(btn){document.querySelectorAll(".nav-item").forEach(function(b){b.classList.remove("active");});btn.classList.add("active");}
  /* FIX — Fermer le modal de publication si ouvert + restaurer overflow */
  var _pubModal = document.getElementById('socPubModal');
  if(_pubModal && _pubModal.classList.contains('open')){
    _pubModal.classList.remove('open');
    document.body.style.overflow = '';
  }
  /* ── FILTRE LIEUX : reset ou application d'un filtre intentionnel ──────────
     Par défaut : chaque ouverture de Lieux repart de "Tous" (type + statut).
     Exception : si _filterOnSwitch est posé avant l'appel (tuiles d'accueil,
     boutons stats), ce filtre est appliqué directement sans double rendu.     */
  if(name === 'etablissements'){
    var _f = window._filterOnSwitch || null;
    window._filterOnSwitch = null; // toujours consommer le flag
    var _applyType   = _f ? (_f.type   || 'all') : 'all';
    var _applyStatus = _f ? (_f.status || 'all') : 'all';
    /* type */
    currentType = _applyType;
    document.querySelectorAll('#typeChips .fchip').forEach(function(c){ c.classList.remove('active'); });
    var _chip = document.querySelector('#typeChips .fchip[data-type="'+_applyType+'"]');
    if(_chip) _chip.classList.add('active');
    /* statut */
    currentStatus = _applyStatus;
    document.querySelectorAll('[data-status]').forEach(function(c){
      c.classList.toggle('active', c.dataset.status === _applyStatus);
    });
    /* vider la recherche textuelle sauf si on revenait manuellement */
    if(_f){ var _si = document.getElementById('searchInput'); if(_si) _si.value = ''; }
  }
  requestAnimationFrame(function(){
    SECS.forEach(function(s){document.getElementById("sec-"+s).classList.toggle("section-hidden",s!==name);});
  });
  // ── LAZY LOADING : initialiser le module de la section si pas encore fait ──
  _lazyInitSection(name);
  // PERF: renderAll immédiat à l'ouverture de la section lieux
  if(name === 'etablissements' && typeof renderAll === 'function') renderAll();
  // Effacer le badge Discussions quand on arrive sur la section
  if(name === "publications" && window.markDiscBadge){ window.markDiscBadge(false); }
  // Discussions redirigées vers Social
  if(name === "social" && window.markDiscBadge){ window.markDiscBadge(false); }
  // Actualiser le panneau paiements selon état de connexion
  if(name === "paiements" && typeof updatePayVis === "function"){ setTimeout(updatePayVis, 80); }
  // Fermer la carte si on quitte l'onglet etablissements
  if(name!=="etablissements" && window.closeAmbiMap) window.closeAmbiMap();
  // Afficher le footer uniquement sur la page contacts
  var footerEl = document.querySelector("footer");
  if(footerEl){ footerEl.style.display = (name === "contacts") ? "block" : "none"; }
  // Afficher le FAB + uniquement dans la section Social
  var fab = document.getElementById('socFab');
  var fabMenu = document.getElementById('socFabMenu');
  if(fab){
    fab.style.display = (name === 'social') ? 'flex' : 'none';
    if(name !== 'social' && fabMenu){ fabMenu.classList.remove('open'); }
  }
  window.scrollTo(0,0);
}

/* ── Lazy loading des modules par section ──────────────────────
   Chaque section n'est initialisée qu'au premier accès.
   Évite de charger toute la logique taxi/social/etc au démarrage. */
var _lazyInitDone = {};
function _lazyInitSection(name){
  if(_lazyInitDone[name]) return;
  _lazyInitDone[name] = true;
  switch(name){
    case 'taxi':
      // Initialiser le module taxi uniquement à l'ouverture de l'onglet
      if(typeof window.taxiProInit === 'function') setTimeout(window.taxiProInit, 100);
      if(typeof window.initTaxiSection === 'function') setTimeout(window.initTaxiSection, 100);
      break;
    case 'social':
      // Forum supprimé — rediriger vers accueil
      setTimeout(function(){ switchSection('accueil', null); }, 50);
      break;
    case 'profil':
      // Synchroniser le profil utilisateur au premier accès
      if(typeof window._syncProfilSection === 'function') setTimeout(window._syncProfilSection, 100);
      break;
    case 'paiements':
      // Charger le dashboard paiements au premier accès
      if(typeof window.updatePayVis === 'function') setTimeout(window.updatePayVis, 100);
      if(typeof window.renderPayments === 'function') setTimeout(window.renderPayments, 200);
      break;
    case 'classement':
      // Charger le classement au premier accès
      if(typeof window.renderClassement === 'function') setTimeout(window.renderClassement, 100);
      break;
    case 'contacts':
      // Contacts rarement visités — defer
      if(typeof window.renderContacts === 'function') setTimeout(window.renderContacts, 100);
      break;
    default:
      break;
  }
}

/* ══ NAVIGATION PROFIL / CONNEXION ══════════════════════════════
   — Connexion : utilisateur non connecté → ouvre le modal login
   — Profil    : utilisateur connecté → affiche sa section profil  */

/* Synchronise les données réelles de l'utilisateur connecté dans sec-profil */
function _syncProfilSection(){
  var uid    = window.currentUserUID;
  var email  = window.currentUserEmail  || '';
  var pseudo = window.currentUserPseudo || email || '';

  /* Initiales (1 ou 2 mots) */
  var initials = pseudo.trim().split(/\s+/).slice(0,2)
    .map(function(w){ return w[0] || ''; }).join('').toUpperCase()
    || (email[0] || '?').toUpperCase();

  var secProfil = document.getElementById('sec-profil');
  if(!secProfil) return;

  /* ── Avatar : initiales + tentative de chargement photo ── */
  var avEl = document.getElementById('pav-membre');
  if(avEl){
    /* Remplacer le texte brut "KM" par les vraies initiales */
    Array.from(avEl.childNodes).forEach(function(n){
      if(n.nodeType === 3) n.textContent = initials;
    });
    avEl.style.color = '#00e5ff';
    /* Charger la vraie photo si disponible */
    if(uid && typeof loadUserAvatar === 'function'){
      loadUserAvatar(uid, function(url){
        var av2 = document.getElementById('pav-membre');
        if(!av2) return;
        if(url){
          var img = av2.querySelector('img');
          if(!img){ img = document.createElement('img'); av2.prepend(img); }
          img.src = url;
          img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;z-index:1;';
          /* Masquer le texte d'initiales */
          Array.from(av2.childNodes).forEach(function(n){ if(n.nodeType === 3) n.textContent = ''; });
        } else {
          var img2 = av2.querySelector('img');
          if(img2) img2.remove();
          Array.from(av2.childNodes).forEach(function(n){ if(n.nodeType === 3) n.textContent = initials; });
        }
      });
    }
  }

  /* ── Nom affiché ── */
  var nameEl = secProfil.querySelector('#pv-membre .profile-name');
  if(nameEl){
    var displayName = pseudo || email;
    nameEl.innerHTML = (typeof escHtml === 'function' ? escHtml(displayName) : displayName)
      + ' <span class="verified-icon vi-cyan" title="Compte vérifié">✓</span>';
  }

  /* ── Handle / sous-titre ── */
  var handleEl = secProfil.querySelector('#pv-membre .profile-handle');
  if(handleEl){
    var handle = pseudo ? '@' + pseudo.toLowerCase().replace(/\s+/g,'_') : (email ? '@' + email.split('@')[0] : '');
    var city   = 'Libreville, Gabon';
    var parts  = [handle, city].filter(Boolean);
    handleEl.innerHTML = parts.map(function(p){
      return '<span>' + (typeof escHtml === 'function' ? escHtml(p) : p) + '</span>';
    }).join('<span class="handle-sep">·</span>');
  }

  /* ── Charger les données Firestore (bio, date inscription, etc.) ── */
  if(uid && window.db && window.fbGetDoc && window.fbDoc){
    window.fbGetDoc(window.fbDoc(window.db, 'users', uid)).then(function(snap){
      var d = snap.exists() ? snap.data() : {};

      /* Bio */
      var bioEl = secProfil.querySelector('#pv-membre .profile-bio');
      if(bioEl){
        var bio = d.bio || d.description || '';
        bioEl.textContent = bio || '✏️ Complétez votre bio dans Mon Profil';
        bioEl.style.fontStyle = bio ? 'normal' : 'italic';
        bioEl.style.opacity   = bio ? '1' : '0.55';
      }

      /* Date membre */
      if(d.createdAt && handleEl){
        try {
          var dt   = new Date(d.createdAt);
          var mois = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
          var sinceStr = 'Membre depuis ' + mois[dt.getMonth()] + ' ' + dt.getFullYear();
          var parts2   = [handle, city, sinceStr].filter(Boolean);
          handleEl.innerHTML = parts2.map(function(p){
            return '<span>' + (typeof escHtml === 'function' ? escHtml(p) : p) + '</span>';
          }).join('<span class="handle-sep">·</span>');
        } catch(e){}
      }

      /* Tags */
      var tagsEl = secProfil.querySelector('#pv-membre .profile-tags');
      if(tagsEl && d.interests && Array.isArray(d.interests) && d.interests.length){
        tagsEl.innerHTML = d.interests.slice(0,5).map(function(tag){
          return '<span class="ptag-item">' + (typeof escHtml === 'function' ? escHtml(tag) : tag) + '</span>';
        }).join('');
      }

      /* Badge rôle */
      var roleBadge = secProfil.querySelector('#pv-membre .p-role-badge');
      if(roleBadge){
        var role = (typeof getUserRole === 'function') ? getUserRole() : 'membre';
        var roleMap = {
          admin:          {cls:'rb-membre', label:'⭐ Admin'},
          super_admin:    {cls:'rb-membre', label:'🔑 Super Admin'},
          establishment:  {cls:'rb-etab',   label:'🏛️ Établissement'},
          etablissement:  {cls:'rb-etab',   label:'🏛️ Établissement'},
          chauffeur:      {cls:'rb-chauffeur', label:'🚕 Chauffeur'},
          membre:         {cls:'rb-membre', label:'● Membre Premium'},
          user:           {cls:'rb-membre', label:'● Membre'}
        };
        var rm = roleMap[role] || roleMap['user'];
        roleBadge.className = 'p-role-badge ' + rm.cls;
        roleBadge.innerHTML = '<span class="rb-dot"></span>' + rm.label;
      }

    }).catch(function(){});
  }

  /* ── Cacher l'écran visiteur si visible ── */
  var vs = document.getElementById('profil-visitor-screen');
  if(vs) vs.classList.remove('show');

  /* ── Détecter le rôle et router vers la bonne vue ── */
  var userRole = (typeof getUserRole === 'function') ? getUserRole() : 'membre';
  var roleToView = {
    admin:          'membre',   // Admin voit son profil membre
    super_admin:    'membre',
    etablissement:  'etab',
    establishment:  'etab',
    chauffeur:      'chauffeur',
    membre:         'membre',
    user:           'membre'
  };
  var targetView = roleToView[userRole] || 'membre';

  /* ── Cacher les onglets rôle (l'utilisateur ne peut pas changer de vue) ── */
  var navTabs = document.querySelector('#sec-profil .demo-nav-profil');
  if(navTabs) navTabs.classList.add('role-locked');

  /* ── Afficher les vues profil ── */
  var views = document.querySelector('#sec-profil .profil-views');
  if(views) views.style.display = '';

  /* ── Basculer sur la vue correspondant au rôle réel ── */
  if(typeof pSwitchRole === 'function') pSwitchRole(targetView);

  /* ── Restaurer les photos de galerie sauvegardées ── */
  setTimeout(function() {
    if(typeof _pGalleryRestore === 'function') {
      _pGalleryRestore('pgallery-membre');
      _pGalleryRestore('pgallery-etab');
    }
    /* Nettoyer les images cassées déjà dans le DOM */
    document.querySelectorAll('#sec-profil .gallery-item img').forEach(function(img){
      if(!img.complete || img.naturalWidth === 0) {
        img.onerror = function(){ this.closest('.gallery-item') && this.closest('.gallery-item').remove(); };
        if(img.src && img.src !== window.location.href) {
          var s = img.src; img.src = ''; img.src = s;
        }
      }
    });
  }, 100);
}
window._syncProfilSection = _syncProfilSection;

/* ══════════════════════════════════════════════════════════════
   PATCH v2 — Cohérence complète des vues Profil
   Corrige : données fictives sur TOUTES les vues (membre/chauffeur/étab),
   statut disponibilité chauffeur, initiales, modals, coordonnées.
   ══════════════════════════════════════════════════════════════ */
(function(){

  /* ─── Surcharge _syncProfilSection ─── */
  var _origSync = window._syncProfilSection;
  window._syncProfilSection = function(){
    if(typeof _origSync === 'function') _origSync.apply(this, arguments);
    _patchAll();
  };

  /* ─── Utilitaires ─── */
  function _esc(s){
    return typeof escHtml==='function' ? escHtml(s) : String(s||'')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _initiales(str){
    if(!str) return '?';
    return str.split(/\s+/).map(function(w){ return w[0]||''; }).join('').toUpperCase().slice(0,2) || str[0].toUpperCase();
  }
  function _setEl(id, val){ var el=document.getElementById(id); if(el && val!=null) el.textContent=val; }
  function _setHtml(id, val){ var el=document.getElementById(id); if(el && val!=null) el.innerHTML=val; }
  function _setAttr(id, attr, val){ var el=document.getElementById(id); if(el && val!=null) el[attr]=val; }

  /* ─── Patch principal ─── */
  function _patchAll(){
    var uid   = window.currentUserUID;
    var email = (window.currentUserEmail || '').toLowerCase().trim();
    if(!uid && !email) return;

    var role = (typeof getUserRole==='function') ? getUserRole() : 'membre';

    /* 1. Masquer nav onglets rôle */
    var navTabs = document.querySelector('#sec-profil .demo-nav-profil');
    if(navTabs) navTabs.style.display = 'none';

    /* 2. Router vers la bonne vue */
    var roleToView = {
      admin:'membre', super_admin:'membre',
      etablissement:'etab', establishment:'etab',
      chauffeur:'chauffeur',
      membre:'membre', user:'membre'
    };
    var view = roleToView[role] || 'membre';
    if(typeof pSwitchRole==='function') pSwitchRole(view);

    /* 3. Dispatch injection par rôle */
    if(view === 'chauffeur') _injectChauffeur(email, uid);
    else if(view === 'etab') _injectEtab(email, uid);
    else                     _injectMembre(uid, email, role);
  }

  /* ══ CHAUFFEUR ══ */
  function _injectChauffeur(email, uid){
    var drivers = window._chauffeurDrivers ? Object.values(window._chauffeurDrivers) : [];
    var driver  = drivers.find(function(d){
      return (d.email||'').toLowerCase().trim()===email || (d.uid||'')===uid;
    });

    var pseudo  = (driver && (driver.pseudo||driver.name||driver.prenom)) || (window.currentUserPseudo) || email.split('@')[0];
    var phone   = (driver && (driver.phone||driver.tel)) || '';
    var zone    = (driver && (driver.zone||driver.quartier||driver.ville)) || 'Libreville';
    var bio     = (driver && (driver.bio||driver.description)) || '';
    var vehic   = (driver && (driver.vehicule||driver.voiture||driver.car)) || '';
    var immat   = (driver && (driver.immat||driver.plaque||driver.immatriculation)) || '';
    var couleur = (driver && (driver.couleur||driver.color)) || '';
    var avail   = driver ? (driver.status==='approved' && driver.available!==false) : false;
    var init    = _initiales(pseudo);
    var mois    = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];

    /* Vue — Nom */
    _setHtml('pv-chauffeur-name', _esc(pseudo)+' <span class="verified-icon vi-gold" title="Chauffeur certifié AMBI241">✓</span>');

    /* Vue — Handle */
    var handleParts = ['Chauffeur AMBI241', zone];
    if(driver && driver.createdAt){ try{ var dt=new Date(driver.createdAt); handleParts.push('Depuis '+mois[dt.getMonth()]+' '+dt.getFullYear()); }catch(e){} }
    _setHtml('pv-chauffeur-handle', handleParts.map(function(p){ return '<span>'+_esc(p)+'</span>'; }).join('<span class="handle-sep">·</span>'));

    /* Vue — Bio */
    var bioEl = document.getElementById('pv-chauffeur-bio');
    if(bioEl){ if(bio){bioEl.textContent=bio;bioEl.style.fontStyle='normal';bioEl.style.opacity='1';}else{bioEl.textContent='Chauffeur professionnel disponible 7j/7.';bioEl.style.fontStyle='italic';bioEl.style.opacity='0.6';} }

    /* Vue — Avatar initiales */
    var avInitEl = document.getElementById('pav-chauffeur-initials');
    if(avInitEl) avInitEl.textContent = init;
    var avModal = document.getElementById('pmodal-av-chauffeur-init');
    if(avModal) avModal.textContent = init;

    /* Vue — Compte */
    _setEl('pv-chauffeur-email', email || '—');
    _setEl('pv-chauffeur-phone', phone || '—');

    /* Vue — Disponibilité (toggle) */
    var toggleEl = document.getElementById('p-dispo-toggle');
    if(toggleEl){ toggleEl.checked = avail; }
    var dotEl = document.getElementById('p-dispo-dot');
    if(dotEl) dotEl.classList.toggle('off', !avail);
    var txtEl = document.getElementById('p-dispo-text');
    if(txtEl) txtEl.textContent = avail ? 'Disponible' : 'Hors service';
    var subEl = document.getElementById('p-dispo-sub');
    if(subEl) subEl.textContent = avail ? 'Vous recevez des demandes de course' : 'Activez pour recevoir des courses';

    /* Modal — Pré-remplissage */
    _setAttr('pmodal-chauffeur-prenom','value', pseudo.split(' ')[0]||pseudo);
    _setAttr('pmodal-chauffeur-nom','value', pseudo.split(' ').slice(1).join(' ')||'');
    var bioTA = document.getElementById('pmodal-chauffeur-bio');
    if(bioTA) bioTA.value = bio;
    _setAttr('pmodal-chauffeur-vehicule','value', vehic);
    _setAttr('pmodal-chauffeur-immat','value', immat);
    _setAttr('pmodal-chauffeur-couleur','value', couleur);

    /* Vue — Avis (vider les fictifs) */
    _clearFictifAvis('pv-chauffeur-avis-list');

    /* ✅ RESTAURATION PHOTOS — charger avatar + cover depuis Firestore/localStorage */
    _restoreProfilePhotos('chauffeur', uid);
  }

  /* ══ ÉTABLISSEMENT ══ */
  function _injectEtab(email, uid){
    if(typeof etablissements==='undefined') return;
    var etab = etablissements.find(function(e){
      return (e.email||e.responsable_email||'').toLowerCase().trim()===email;
    });
    if(!etab) return;

    var nom     = etab.nom || etab.name || '—';
    var type    = etab.type || etab.categorie || 'Établissement';
    var desc    = etab.description || etab.bio || '';
    var adresse = etab.adresse || etab.address || etab.quartier || '—';
    var tel     = etab.telephone || etab.tel || etab.phone || '—';
    var social  = etab.instagram || etab.social || etab.reseaux || '—';
    var entree  = etab.entree || etab.prix_entree || '—';
    var parking = etab.parking ? 'Disponible' : (etab.parking===false ? 'Non disponible' : '—');
    var init    = _initiales(nom);

    /* Vue — Nom */
    _setHtml('pv-etab-name', _esc(nom)+' <span class="verified-icon vi-pink" title="Établissement vérifié">✓</span>');

    /* Vue — Handle */
    var handle = etab.handle || etab.instagram ? ('@'+(etab.handle||etab.instagram||'').replace('@','')) : ('@'+nom.toLowerCase().replace(/\s+/g,'_').slice(0,15));
    _setHtml('pv-etab-handle',
      '<span>'+_esc(handle)+'</span><span class="handle-sep">·</span>'
      +'<span>📍 '+_esc(adresse)+'</span><span class="handle-sep">·</span>'
      +'<span>'+_esc(type)+'</span>');

    /* Vue — Bio */
    var bioEl = document.getElementById('pv-etab-bio');
    if(bioEl){ if(desc){bioEl.textContent=desc;bioEl.style.fontStyle='normal';bioEl.style.opacity='1';}else{bioEl.textContent='Description non renseignée.';bioEl.style.fontStyle='italic';bioEl.style.opacity='0.5';} }

    /* Vue — Avatar initiales */
    var avInitEl = document.getElementById('pav-etab-initials');
    if(avInitEl) avInitEl.textContent = init;
    var avModal = document.getElementById('pmodal-av-etab-init');
    if(avModal) avModal.textContent = init;

    /* Vue — Infos */
    _setEl('pv-etab-address', adresse);
    _setEl('pv-etab-phone',   tel);
    _setEl('pv-etab-social',  social);
    _setEl('pv-etab-entree',  entree);
    _setEl('pv-etab-parking', parking);

    /* Modal — Pré-remplissage */
    _setAttr('pmodal-etab-nom','value', nom);
    var descTA = document.getElementById('pmodal-etab-desc');
    if(descTA) descTA.value = desc;
    _setAttr('pmodal-etab-adresse','value', adresse);
    _setAttr('pmodal-etab-tel','value', tel);
    _setAttr('pmodal-etab-prix','value', entree);

    /* Vue — Avis (vider les fictifs) */
    _clearFictifAvis('pv-etab-avis-list');
  }

  /* ══ MEMBRE ══ */
  function _injectMembre(uid, email, role){
    var pseudo = window.currentUserPseudo || email.split('@')[0] || '—';
    var init   = _initiales(pseudo);

    /* Avatar */
    var avInitEl = document.getElementById('pav-membre-initials');
    if(avInitEl) avInitEl.textContent = init;
    var avModal = document.getElementById('pmodal-av-membre-init');
    if(avModal) avModal.textContent = init;

    /* Nom — si pas déjà injecté par _syncProfilSection (qui lit Firebase) */
    var nameEl = document.getElementById('pv-membre-name');
    if(nameEl && nameEl.textContent.trim() === '—'){
      nameEl.innerHTML = _esc(pseudo)+' <span class="verified-icon vi-cyan" title="Compte vérifié">✓</span>';
    }

    /* Handle */
    var handleEl = document.getElementById('pv-membre-handle');
    if(handleEl && !handleEl.dataset.synced){
      handleEl.dataset.synced = '1';
      var h = '@'+pseudo.toLowerCase().replace(/\s+/g,'_');
      handleEl.innerHTML = '<span>'+_esc(h)+'</span><span class="handle-sep">·</span><span>Libreville, Gabon</span>';
    }

    /* Badge admin */
    if(role==='admin'){
      var badge = document.querySelector('#pv-membre .p-role-badge');
      if(badge){ badge.className='p-role-badge rb-membre'; badge.innerHTML='<span class="rb-dot"></span>⭐ Administrateur'; }
    }

    /* Modal pré-remplissage */
    var parts = pseudo.split(' ');
    _setAttr('pmodal-membre-prenom','value', parts[0]||pseudo);
    _setAttr('pmodal-membre-nom','value', parts.slice(1).join(' ')||'');
    _setAttr('pmodal-membre-pseudo','value', '@'+pseudo.toLowerCase().replace(/\s+/g,'_'));

    /* ✅ RESTAURATION PHOTOS */
    _restoreProfilePhotos('membre', uid);
  }

  /* ══ RESTAURATION PHOTOS au chargement du profil ══ */
  function _restoreProfilePhotos(role, uid){
    if(!uid) return;

    // 1. Essayer d'abord le localStorage (instantané, offline)
    var lsAvatar = '';
    var lsCover  = '';
    try { lsAvatar = localStorage.getItem('ambi241_avatar_'+uid) || ''; } catch(e){}
    try { lsCover  = localStorage.getItem('ambi241_cover_'+role+'_'+uid) || ''; } catch(e){}

    function _applyAvatar(src){
      if(!src) return;
      var avEl  = document.getElementById('pav-'+role);
      var avMod = document.getElementById('pmodal-av-'+role);
      [avEl, avMod].forEach(function(av){
        if(!av) return;
        var imgEl = av.querySelector('img') || document.createElement('img');
        imgEl.src = src;
        imgEl.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
        if(!imgEl.parentElement) av.prepend(imgEl);
        // Masquer le texte d'initiales
        Array.from(av.childNodes).forEach(function(n){ if(n.nodeType===3) n.textContent=''; });
      });
      // Mettre en cache mémoire
      if(typeof _userAvatarCache!=='undefined') _userAvatarCache[uid] = src;
    }

    function _applyCover(src){
      if(!src) return;
      var cover = document.getElementById('pcov-'+role);
      if(!cover) return;
      var img = cover.querySelector('img');
      if(!img){ img = document.createElement('img'); cover.prepend(img); var fd=cover.querySelector('div:not(.cover-overlay)'); if(fd) fd.style.display='none'; }
      img.src = src;
      img.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;';
    }

    // Appliquer immédiatement depuis localStorage
    if(lsAvatar) _applyAvatar(lsAvatar);
    if(lsCover)  _applyCover(lsCover);

    // 2. Vérifier/mettre à jour depuis Firestore (source de vérité)
    if(window.db && window.fbDoc && window.fbGetDoc){
      window.fbGetDoc(window.fbDoc(window.db,'users',uid)).then(function(snap){
        if(!snap.exists || !snap.exists()) return;
        var d = snap.data();
        // Avatar
        if(d.avatarUrl){
          _applyAvatar(d.avatarUrl);
          // Mettre à jour le cache localStorage si différent
          if(d.avatarUrl !== lsAvatar){
            try { localStorage.setItem('ambi241_avatar_'+uid, d.avatarUrl); } catch(e){}
          }
        }
        // Cover
        var coverField = 'coverUrl_'+role;
        if(d[coverField]){
          _applyCover(d[coverField]);
          if(d[coverField] !== lsCover){
            try { localStorage.setItem('ambi241_cover_'+role+'_'+uid, d[coverField]); } catch(e){}
          }
        }
        // Mettre à jour l'avatar header et quickbar
        if(d.avatarUrl && typeof _refreshQuickbarAvatar==='function'){
          var pseudo = window.currentUserPseudo||'?';
          _refreshQuickbarAvatar(d.avatarUrl, (pseudo||'?')[0].toUpperCase());
        }
      }).catch(function(){});
    }
  }

  /* ══ Effacer les avis fictifs ══ */
  function _clearFictifAvis(containerId){
    var el = document.getElementById(containerId);
    if(!el) return;
    /* Garder seulement si le contenu a déjà été chargé dynamiquement (pas le placeholder) */
    if(el.querySelector('.activity-item')) return; // déjà des vrais avis ou injectés
    el.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;font-style:italic;">Aucun avis pour le moment.</div>';
  }

  /* ── Surveiller connexion/déconnexion ── */
  var _prevUID = null;
  setInterval(function(){
    var uid = window.currentUserUID || null;
    if(uid !== _prevUID){
      _prevUID = uid;
      if(uid){ setTimeout(_patchAll, 500); }
    }
  }, 800);

  window._patchProfilCoherence = _patchAll;
})();

function navHandleProfil(btn){
  var connected = !!(window.currentUserUID);
  if(connected){
    /* FIX#2 — Naviguer immédiatement, synchroniser les données en async */
    switchSection('profil', btn);
    requestAnimationFrame(function(){
      setTimeout(function(){ _syncProfilSection(); }, 0);
    });
  } else {
    /* Visiteur : afficher l'écran de choix d'inscription dans la section Profil */
    _renderVisitorProfilScreen();
    switchSection('profil', btn);
  }
}
window.navHandleProfil = navHandleProfil;

/* ── Navigation Fiches : redirige vers Profil > Fiche Pro si propriétaire/admin ── */
function navHandleFiches(btn){
  var isOwnerOrAdmin = isAdmin || (typeof userEtabIds !== 'undefined' && userEtabIds && userEtabIds.length > 0);
  if(isOwnerOrAdmin && window.currentUserUID){
    // Aller dans Profil > vue Établissement > onglet Fiche Pro
    switchSection('profil', document.getElementById('navProfilBtn'));
    setTimeout(function(){
      pSwitchRole('etab');
      var ficheTabBtn = document.getElementById('pe-fiches-tab-btn');
      if(ficheTabBtn) pSetStab(ficheTabBtn, 'etab', 'fiches');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 200);
  } else if(window.currentUserUID) {
    // Connecté mais pas propriétaire : accès aux fiches publiques directement
    switchSection('fiches', btn);
  } else {
    // Non connecté → vers Profil connexion
    _renderVisitorProfilScreen();
    switchSection('profil', document.getElementById('navProfilBtn'));
  }
}
window.navHandleFiches = navHandleFiches;

/* ── Visibilité des pro-panels selon le rôle ── */
function _applyFichesPanelVisibility(){
  var canSeeProPanel = isAdmin || (typeof userEtabIds !== 'undefined' && userEtabIds && userEtabIds.length > 0);
  // Masquer ou afficher les pro-panels dans sec-fiches
  document.querySelectorAll('#sec-fiches .pro-panel').forEach(function(panel){
    if(canSeeProPanel){
      panel.classList.remove('pub-hidden');
    } else {
      panel.classList.add('pub-hidden');
    }
  });
  // Afficher le bouton "Fiches" nav uniquement si propriétaire/admin
  var fichesBtn = document.getElementById('navFichesBtn');
  if(fichesBtn) fichesBtn.style.display = canSeeProPanel ? '' : 'none';
  // Afficher le lien Fiches dans le menu hamburger
  var sitenavFiches = document.getElementById('sitenavFichesItem');
  if(sitenavFiches) sitenavFiches.style.display = canSeeProPanel ? '' : 'none';
  // Afficher le tab "Fiche Pro" dans le profil étab uniquement si propriétaire/admin
  var ficheTabBtn = document.getElementById('pe-fiches-tab-btn');
  if(ficheTabBtn) ficheTabBtn.style.display = canSeeProPanel ? '' : 'none';
}
window._applyFichesPanelVisibility = _applyFichesPanelVisibility;

/* Ouvre directement la fiche d'inscription pour un rôle donné */
function openRegistrationForRole(type){
  /* Pré-sélectionner le type dans le formulaire */
  if(typeof regSelectType === 'function') regSelectType(type);
  /* Ouvrir le modal avec l'onglet Inscription */
  var overlay = document.getElementById('userOverlay');
  if(overlay) overlay.classList.add('show');
  if(typeof switchUserTab === 'function') switchUserTab('inscription');
}
window.openRegistrationForRole = openRegistrationForRole;

/* Ouvrir le modal en mode Connexion depuis l'écran visiteur */
function openLoginFromProfil(){
  var overlay = document.getElementById('userOverlay');
  if(overlay) overlay.classList.add('show');
  if(typeof switchUserTab === 'function') switchUserTab('connexion');
}
window.openLoginFromProfil = openLoginFromProfil;

/* Affiche l'écran visiteur (3 cartes d'inscription) et cache les vues membres */
function _renderVisitorProfilScreen(){
  var vs = document.getElementById('profil-visitor-screen');
  var nav = document.querySelector('#sec-profil .demo-nav-profil');
  var views = document.querySelector('#sec-profil .profil-views');
  if(vs)   vs.classList.add('show');
  if(nav)  nav.style.display = 'none';
  if(views) views.style.display = 'none';
}
window._renderVisitorProfilScreen = _renderVisitorProfilScreen;

/* Met à jour le label + icône du bouton Profil/Connexion selon l'état d'auth */
function updateNavLabels(){
  var connected = !!(window.currentUserUID);
  var iconEl  = document.getElementById('navProfilIcon');
  var labelEl = document.getElementById('navProfilLabel');
  var btn     = document.getElementById('navProfilBtn');
  if(!iconEl || !labelEl) return;

  if(connected){
    /* Déterminer le rôle pour personnaliser l'icône */
    var role = (typeof getUserRole === 'function') ? getUserRole() : 'membre';
    var icons = { admin:'&#9881;', etablissement:'&#127963;', chauffeur:'&#128661;', membre:'&#128100;' };
    iconEl.innerHTML  = icons[role] || '&#128100;';
    labelEl.textContent = 'Profil';
    if(btn) btn.title = 'Mon profil';
  } else {
    iconEl.innerHTML  = '&#128100;'; /* 👤 */
    labelEl.textContent = 'Profil';
    if(btn) btn.title = 'Créer un compte / Se connecter';
  }
}
window.updateNavLabels = updateNavLabels;

/* Appel initial au chargement (utilisateur potentiellement déjà connecté via session) */
(function(){ setTimeout(updateNavLabels, 800); })();

// ── Navigation vers un établissement spécifique ─────────────────
/* ID de l'établissement actuellement "spotlight" dans la liste groupe */
var _spotlightEtabId = null;
window._spotlightEtabId = null;

function goToEtab(id) {
  // Si vue compacte : forcer vue liste pour afficher la fiche complète
  if(currentView === 'compact' || currentView === 'carte'){
    currentView = 'liste';
    document.querySelectorAll('[data-view]').forEach(function(b){ b.classList.remove('active'); });
    var listBtn = document.querySelector('[data-view="liste"]');
    if(listBtn) listBtn.classList.add('active');
  }
  // 1. Aller sur la section Lieux
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);
  // 2. Après rendu, trouver la carte et scroller dessus
  var attempts = 0;
  function tryScroll() {
    var el = document.getElementById('card-etab-' + id) || document.getElementById('cr-' + id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.transition = 'box-shadow 0.3s ease, transform 0.2s ease';
      el.style.boxShadow = '0 0 0 3px rgba(255,45,155,0.9), 0 8px 40px rgba(255,45,155,0.35)';
      el.style.transform = 'scale(1.012)';
      setTimeout(function() {
        el.style.transition = 'box-shadow 0.8s ease, transform 0.8s ease';
        el.style.boxShadow = '';
        el.style.transform = '';
      }, 1800);
    } else if (attempts < 12) {
      attempts++;
      setTimeout(tryScroll, 100);
    }
  }
  setTimeout(tryScroll, 300);
}
window.goToEtab = goToEtab;

/* ─────────────────────────────────────────────────────────────────
   goToEtabWithFiche(id)
   Appelé depuis le bouton "Voir la fiche complète pour réservation"
   dans le modal public profile.
   Comportement :
   1. Ferme le profil public
   2. Bascule vers la vue "groupe" (par catégorie)
   3. Ouvre le bottom-sheet ficheEtab avec tous les détails techniques
   4. À la fermeture, la liste défile (scroll) sur la position de
      l'établissement en mode "spotlight" :
        – sa fiche est affichée en mode complet (buildCard)
        – les autres sont en mode compact (buildCompactRow)
      Un 2e clic sur le bouton "Fiche complète →" de la carte rouvre le sheet.
───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
   _ambiScrollToCard(id)
   Scroll cinématique : remonte en haut de la liste, puis descend
   progressivement et se bloque exactement sur la carte de l'étab.
   Fonctionne en vue compacte (cr-{id}) et carte complète (card-etab-{id}).
───────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────
   _toggleCatRibbon(catKey, forceOpen)
   Ouvre/ferme le ruban d'une catégorie dans la vue groupe accordion.
   Une seule catégorie ouverte à la fois.
───────────────────────────────────────────────────────────────── */
window._toggleCatRibbon = function(catKey, forceOpen) {
  var cell    = document.getElementById('catcell-'    + catKey);
  var ribbon  = document.getElementById('catribbon-'  + catKey);
  if(!cell || !ribbon) return;

  var isOpen  = cell.classList.contains('open');
  var willOpen = forceOpen === true ? true : !isOpen;

  /* Fermer tous les autres */
  document.querySelectorAll('.cat-cell.open').forEach(function(c){
    var k = c.id.replace('catcell-','');
    c.classList.remove('open');
    var r = document.getElementById('catribbon-' + k);
    if(r) r.classList.remove('open');
  });

  if(willOpen){
    cell.classList.add('open');
    ribbon.classList.add('open');
    /* Scroll sur la cellule après ouverture */
    setTimeout(function(){
      cell.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }
};

window._ambiScrollToCard = function(id) {
  /* Trouver l'élément cible */
  var el = document.getElementById('card-etab-' + id) || document.getElementById('cr-' + id);
  if(!el) return;

  /* Trouver le conteneur scrollable (mainList ou son parent scrollable) */
  var scroller = document.scrollingElement || document.documentElement;

  /* 1. Remonter instantanément en haut */
  scroller.scrollTop = 0;

  /* 2. Calculer la position finale de la cible */
  setTimeout(function(){
    var elRect    = el.getBoundingClientRect();
    var finalTop  = scroller.scrollTop + elRect.top - 80; /* 80px de marge haute */
    if(finalTop < 0) finalTop = 0;

    /* 3. Animation easeInOut maison : du top → target */
    var startTop  = 0;
    var distance  = finalTop - startTop;
    var duration  = Math.min(1200, Math.max(600, Math.abs(distance) * 0.6)); /* vitesse proportionnelle */
    var startTime = null;

    function easeInOutCubic(t){ return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }

    function animateScroll(ts){
      if(!startTime) startTime = ts;
      var elapsed  = ts - startTime;
      var progress = Math.min(elapsed / duration, 1);
      var eased    = easeInOutCubic(progress);
      scroller.scrollTop = startTop + distance * eased;
      if(progress < 1){
        requestAnimationFrame(animateScroll);
      } else {
        /* 4. Arrivée : halo + déploiement si vue compacte */
        scroller.scrollTop = finalTop;
        _ambiHighlightCard(id);
      }
    }
    requestAnimationFrame(animateScroll);
  }, 80);
};

/* Halo + déploiement du panneau compact si applicable */
window._ambiHighlightCard = function(id) {
  var el = document.getElementById('card-etab-' + id) || document.getElementById('cr-' + id);
  if(!el) return;

  /* Vue compacte : déployer le panneau et fermer tous les autres */
  var detail = document.getElementById('cd-' + id);
  if(detail){
    /* Fermer tous les autres panneaux ouverts */
    document.querySelectorAll('.compact-detail.open').forEach(function(d){
      if(d.id !== 'cd-' + id){
        d.classList.remove('open');
        var rid = d.id.replace('cd-','');
        var row = document.getElementById('cr-' + rid);
        if(row) row.classList.remove('expanded');
      }
    });
    /* Ouvrir ce panneau */
    detail.classList.add('open');
    el.classList.add('expanded');
  }

  /* Halo de focus (bordure rose pulsante puis cyan) */
  el.style.transition = 'box-shadow 0.25s ease, transform 0.2s ease';
  el.style.boxShadow  = '0 0 0 3px rgba(255,45,155,1), 0 8px 32px rgba(255,45,155,0.5)';
  el.style.transform  = 'scale(1.012)';
  setTimeout(function(){
    el.style.boxShadow = '0 0 0 2px rgba(0,229,255,0.7), 0 4px 20px rgba(0,229,255,0.2)';
    el.style.transform = '';
    setTimeout(function(){
      el.style.transition = 'box-shadow 1.2s ease';
      el.style.boxShadow  = '';
    }, 1800);
  }, 600);
};

window.goToEtabWithFiche = function(id) {
  /* 1. Fermer le profil public */
  if(typeof window.closePublicProfile === 'function') window.closePublicProfile();

  /* 2. Conserver la vue actuelle (compact, liste ou groupe) — ne pas changer */
  /* En vue groupe : mémoriser le spotlight pour que renderAll affiche la fiche complète */
  if(currentView === 'groupe'){
    _spotlightEtabId = id;
    window._spotlightEtabId = id;
  }
  /* En vue carte : revenir en compact */
  if(currentView === 'carte'){
    currentView = 'compact';
    document.querySelectorAll('[data-view]').forEach(function(b){ b.classList.remove('active'); });
    var cb = document.querySelector('[data-view="compact"]');
    if(cb) cb.classList.add('active');
  }

  /* 3. Naviguer vers la section Lieux */
  switchSection('etablissements', document.querySelectorAll('.nav-item')[1]);

  /* 4. Ouvrir le bottom-sheet ficheEtab après le rendu */
  var _ficheAttempts = 0;
  function tryOpenFiche(){
    if(typeof window.openFicheEtab === 'function'){
      window.openFicheEtab(id);
    } else if(_ficheAttempts < 15){
      _ficheAttempts++;
      setTimeout(tryOpenFiche, 120);
    }
  }
  setTimeout(tryOpenFiche, 350);

  /* 5. À la fermeture du bottom-sheet :
        scroll cinématique haut→bas qui bloque sur la carte */
  var _origClose = window.closeFicheEtab;
  window.closeFicheEtab = function(){
    /* Restaurer immédiatement pour éviter la double-capture */
    window.closeFicheEtab = _origClose;
    if(typeof _origClose === 'function') _origClose();

    /* Petit délai pour laisser l'animation de fermeture se terminer */
    setTimeout(function(){
      window._ambiScrollToCard(id);
    }, 180);
  };
};

/* ══════════════════════════════════════════════════════════════
   FICHE COMPLÈTE — Modal de présentation intégrale d'un établissement
   Accessible via le bouton "Fiche complète →" sur chaque carte.
══════════════════════════════════════════════════════════════ */
(function(){
  /* ── Injecter les styles de la modale ── */
  var _ficheStyle = document.createElement('style');
  _ficheStyle.textContent = [
    '#ficheEtabOverlay{position:fixed;inset:0;z-index:9800;background:rgba(0,0,0,0.82);display:flex;align-items:flex-end;justify-content:center;opacity:0;pointer-events:none;transition:opacity 0.28s;}',
    '#ficheEtabOverlay.show{opacity:1;pointer-events:all;}',
    '#ficheEtabPanel{background:var(--surface);border-radius:22px 22px 0 0;width:100%;max-width:520px;max-height:92vh;display:flex;flex-direction:column;transform:translateY(60px);transition:transform 0.32s cubic-bezier(0.34,1.2,0.64,1);overflow:hidden;}',
    '#ficheEtabOverlay.show #ficheEtabPanel{transform:translateY(0);}',
    '#ficheEtabHero{position:relative;height:180px;background:#0d0514;flex-shrink:0;}',
    '#ficheEtabHeroImg{width:100%;height:100%;object-fit:cover;display:block;opacity:0.82;}',
    '#ficheEtabHeroGrad{position:absolute;inset:0;background:linear-gradient(to top,rgba(13,5,20,0.95) 0%,rgba(13,5,20,0.2) 60%,transparent 100%);}',
    '#ficheEtabCloseBtn{position:absolute;top:0.75rem;right:0.75rem;background:rgba(0,0,0,0.55);border:none;color:#fff;font-size:1.1rem;width:34px;height:34px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:2;}',
    '#ficheEtabHeroInfo{position:absolute;bottom:0.75rem;left:0.9rem;right:3rem;}',
    '#ficheEtabTitle{font-family:Syne,sans-serif;font-weight:800;font-size:1.18rem;color:#fff;text-shadow:0 2px 8px rgba(0,0,0,0.7);line-height:1.2;}',
    '#ficheEtabSub{font-size:0.68rem;color:rgba(255,255,255,0.75);margin-top:0.18rem;}',
    '#ficheEtabBody{overflow-y:auto;padding:1rem 1rem 2rem;flex:1;}',
    '.fiche-section{margin-bottom:1.1rem;}',
    '.fiche-section-title{font-family:Syne,sans-serif;font-size:0.65rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:0.5rem;padding-bottom:0.28rem;border-bottom:1px solid rgba(255,255,255,0.07);}',
    '.fiche-chips{display:flex;flex-wrap:wrap;gap:0.35rem;}',
    '.fiche-chip{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:0.22rem 0.65rem;font-size:0.65rem;color:var(--text);}',
    '.fiche-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;margin-bottom:0.8rem;}',
    '.fiche-stat{background:var(--surface2);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.65rem;text-align:center;}',
    '.fiche-stat-val{font-family:Syne,sans-serif;font-size:1.1rem;font-weight:800;}',
    '.fiche-stat-lbl{font-size:0.55rem;color:var(--muted);font-weight:700;text-transform:uppercase;margin-top:0.1rem;letter-spacing:0.04em;}',
    '.fiche-desc{font-size:0.76rem;color:var(--muted);line-height:1.6;}',
    '.fiche-info-line{display:flex;align-items:flex-start;gap:0.5rem;margin-bottom:0.42rem;font-size:0.73rem;}',
    '.fiche-info-icon{flex-shrink:0;font-size:0.9rem;}',
    '.fiche-info-val{color:var(--text);}',
    '.fiche-info-val a{color:var(--cyan);text-decoration:none;}',
    '.fiche-action-row{display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;}',
    '.fiche-btn{display:inline-flex;align-items:center;gap:0.4rem;padding:0.55rem 1rem;border-radius:10px;font-family:DM Sans,sans-serif;font-weight:700;font-size:0.78rem;cursor:pointer;border:none;text-decoration:none;transition:opacity 0.15s;flex:1;justify-content:center;}',
    '.fiche-btn:active{opacity:0.75;}',
    '.fiche-btn-wa{background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.35) !important;color:#25d366 !important;}',
    '.fiche-btn-tel{background:rgba(0,229,255,0.1);border:1px solid rgba(0,229,255,0.3) !important;color:var(--cyan) !important;}',
    '.fiche-btn-maps{background:rgba(255,45,155,0.1);border:1px solid rgba(255,45,155,0.3) !important;color:var(--pink) !important;}',
    '.fiche-gallery{display:grid;grid-template-columns:repeat(3,1fr);gap:0.3rem;border-radius:10px;overflow:hidden;}',
    '.fiche-gallery-img{width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;display:block;}',
    '.fiche-badge-statut{display:inline-flex;align-items:center;gap:0.3rem;padding:0.2rem 0.6rem;border-radius:20px;font-size:0.62rem;font-weight:800;margin-left:0.4rem;vertical-align:middle;}',
  ].join('');
  document.head.appendChild(_ficheStyle);

  /* ── Injecter la structure HTML de la modale ── */
  var _ficheDiv = document.createElement('div');
  _ficheDiv.id = 'ficheEtabOverlay';
  _ficheDiv.innerHTML = [
    '<div id="ficheEtabPanel">',
    '  <div id="ficheEtabHero">',
    '    <img id="ficheEtabHeroImg" src="" alt="">',
    '    <div id="ficheEtabHeroGrad"></div>',
    '    <button id="ficheEtabCloseBtn" onclick="closeFicheEtab()">✕</button>',
    '    <div id="ficheEtabHeroInfo">',
    '      <div id="ficheEtabTitle"></div>',
    '      <div id="ficheEtabSub"></div>',
    '    </div>',
    '  </div>',
    '  <div id="ficheEtabBody"></div>',
    '</div>',
  ].join('');
  document.body.appendChild(_ficheDiv);

  /* Fermer en cliquant le fond */
  _ficheDiv.addEventListener('click', function(ev){
    if(ev.target === _ficheDiv) closeFicheEtab();
  });
})();

window.closeFicheEtab = function(){
  var ov = document.getElementById('ficheEtabOverlay');
  if(ov){ ov.classList.remove('show'); }
};

window.openFicheEtab = function(id){
  var e = (window.etablissements||[]).find(function(x){ return x.id === id; });
  if(!e){ return; }

  var ov    = document.getElementById('ficheEtabOverlay');
  var img   = document.getElementById('ficheEtabHeroImg');
  var title = document.getElementById('ficheEtabTitle');
  var sub   = document.getElementById('ficheEtabSub');
  var body  = document.getElementById('ficheEtabBody');
  if(!ov||!img||!title||!sub||!body) return;

  /* Photo hero — priorité : profile_approved > Google Places > slots locaux > fallback SVG */
  var permPhoto = '';
  /* 1. Photo de profil approuvée */
  if(e._photo_profile_approved) permPhoto = e._photo_profile_approved;
  /* 2. Photos Google Places */
  if(!permPhoto && e._gphoto_urls && e._gphoto_urls.length > 0) permPhoto = e._gphoto_urls[0];
  /* 3. Photos manuelles Firestore */
  if(!permPhoto && e.photo_exterieur) permPhoto = e.photo_exterieur;
  if(!permPhoto && e.photo_interieur) permPhoto = e.photo_interieur;
  /* 4. Chercher dans les slots localStorage (clés avec et sans suffixe type) */
  if(!permPhoto){
    try{
      var _slotKeys = ['ambi241_photos_'+e.id+'_exterieur','ambi241_photos_'+e.id+'_interieur','ambi241_photos_'+e.id];
      for(var _ki=0;_ki<_slotKeys.length;_ki++){
        var _sd = localStorage.getItem(_slotKeys[_ki]);
        if(_sd){ var _sl=JSON.parse(_sd); if(_sl&&_sl[0]&&_sl[0].url){ permPhoto=_sl[0].url; break; } }
      }
    }catch(ex){}
  }
  /* 5. Appel getGooglePhotoUrl si disponible (lance le fetch si pas en cache) */
  if(!permPhoto && typeof getGooglePhotoUrl==='function') permPhoto = getGooglePhotoUrl(e,'exterieur')||'';
  /* 6. Fallback SVG généré */
  if(!permPhoto) permPhoto = e._fallback_svg||'';

  if(permPhoto && (permPhoto.startsWith('data:')||permPhoto.startsWith('http')||permPhoto.startsWith('/'))){ img.src = permPhoto; img.style.display=''; }
  else { img.src = ''; img.style.display='none'; }

  /* Status badge */
  var sc = (function(s){ s=s||'';
    if(s.indexOf('Bondé')!==-1||s.indexOf('Bonde')!==-1) return {label:'🔴 Bondé',bg:'rgba(255,68,102,0.18)',color:'var(--red)'};
    if(s.indexOf('Animé')!==-1||s.indexOf('Anime')!==-1) return {label:'🟢 Animé',bg:'rgba(0,255,170,0.14)',color:'var(--green)'};
    if(s.indexOf('Calme')!==-1) return {label:'🟡 Calme',bg:'rgba(255,215,0,0.14)',color:'var(--amber)'};
    if(s.indexOf('Fermé')!==-1||s.indexOf('Ferme')!==-1) return {label:'⚫ Fermé',bg:'rgba(255,255,255,0.07)',color:'var(--muted)'};
    return {label:'ℹ️ '+s,bg:'rgba(255,255,255,0.05)',color:'var(--muted)'};
  })(e.statut||'');

  title.innerHTML = escHtml(e.nom||'') +
    '<span class="fiche-badge-statut" style="background:'+sc.bg+';color:'+sc.color+';">'+sc.label+'</span>';
  sub.textContent = (e.type||'') + (e.quartier ? ' · ' + e.quartier : '');
  img.style.display = '';

  /* ── Corps de la fiche ── */
  var h = '';

  /* Stats row */
  var note  = e.note  ? parseFloat(e.note).toFixed(1) : '—';
  var avis  = e.avis  || 0;
  var aff   = e.affluence ? e.affluence + '%' : '—';
  var places = e.places || e.capacite || e.nb_places || null;
  h += '<div class="fiche-stat-row">';
  h += '<div class="fiche-stat"><div class="fiche-stat-val" style="color:var(--amber);">⭐ '+note+'</div><div class="fiche-stat-lbl">Note</div></div>';
  h += '<div class="fiche-stat"><div class="fiche-stat-val" style="color:var(--cyan);">'+aff+'</div><div class="fiche-stat-lbl">Affluence</div></div>';
  if(places){
    h += '<div class="fiche-stat"><div class="fiche-stat-val" style="color:var(--purple);">🪑 '+places+'</div><div class="fiche-stat-lbl">Places</div></div>';
  } else {
    h += '<div class="fiche-stat"><div class="fiche-stat-val" style="color:var(--text);">'+avis+'</div><div class="fiche-stat-lbl">Avis</div></div>';
  }
  h += '</div>';

  /* Description */
  if(e.description){
    h += '<div class="fiche-section">';
    h += '<div class="fiche-section-title">À propos</div>';
    h += '<div class="fiche-desc">'+escHtml(e.description)+'</div>';
    h += '</div>';
  }

  /* ── Détails techniques (ambiance, musique, dress code, VIP, places) ── */
  var hasTech = e.ambiance || e.type_musique || e.musique || e.dress_code || e.dresscode ||
                e.vip || e.vip_dispo || places || e.reservation || e.reservation_requise ||
                e.prix_moyen || e.prix_entree || e.entree || e.happy_hour;
  if(hasTech){
    h += '<div class="fiche-section"><div class="fiche-section-title">🎯 Détails de l\'établissement</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.45rem;">';
    var techItems = [];
    if(places)                          techItems.push({icon:'🪑',lbl:'Capacité',val:places+' places'});
    if(e.ambiance)                      techItems.push({icon:'✨',lbl:'Ambiance',val:e.ambiance});
    var musVal = e.type_musique || e.musique;
    if(musVal)                          techItems.push({icon:'🎵',lbl:'Musique',val:musVal});
    var dcVal = e.dress_code || e.dresscode;
    if(dcVal)                           techItems.push({icon:'👔',lbl:'Dress code',val:dcVal});
    if(e.vip || e.vip_dispo)           techItems.push({icon:'🏆',lbl:'Espace VIP',val:e.vip||e.vip_dispo||'Disponible'});
    var resaVal = e.reservation || e.reservation_requise;
    if(resaVal)                         techItems.push({icon:'📞',lbl:'Réservation',val:typeof resaVal==='boolean'?'Requise':resaVal});
    var prixVal = e.prix_moyen || e.prix_entree || e.entree;
    if(prixVal)                         techItems.push({icon:'💰',lbl:'Prix / Entrée',val:prixVal});
    if(e.happy_hour)                    techItems.push({icon:'🍹',lbl:'Happy hour',val:e.happy_hour});
    techItems.forEach(function(item){
      h += '<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.09);border-radius:11px;padding:0.55rem 0.65rem;">';
      h += '<div style="font-size:0.72rem;color:var(--muted);margin-bottom:0.15rem;">'+item.icon+' '+escHtml(item.lbl)+'</div>';
      h += '<div style="font-size:0.78rem;font-weight:700;color:var(--text);">'+escHtml(String(item.val))+'</div>';
      h += '</div>';
    });
    h += '</div>';
    /* Si aucun item dans la grille mais hasTech = true à cause de champs booléens */
    if(techItems.length === 0) h = h.replace('<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.45rem;">','').replace('</div>','');
    h += '</div></div>';
  }

  /* Infos pratiques */
  h += '<div class="fiche-section"><div class="fiche-section-title">Infos pratiques</div>';
  if(e.quartier)    h += '<div class="fiche-info-line"><span class="fiche-info-icon">📍</span><span class="fiche-info-val">'+escHtml(e.quartier)+'</span></div>';
  if(e.contact){
    var waNum = e.contact.replace(/\s/g,'').replace(/\+/g,'');
    var waMsg = encodeURIComponent('Bonjour '+escHtml(e.nom)+' (via AMBI241)');
    h += '<div class="fiche-info-line"><span class="fiche-info-icon">📞</span><span class="fiche-info-val"><a href="tel:'+e.contact+'">'+escHtml(e.contact)+'</a></span></div>';
    h += '<div class="fiche-info-line"><span class="fiche-info-icon">💬</span><span class="fiche-info-val"><a href="https://wa.me/'+waNum+'?text='+waMsg+'" target="_blank">WhatsApp</a></span></div>';
  }
  if(e.horaires)    h += '<div class="fiche-info-line"><span class="fiche-info-icon">🕐</span><span class="fiche-info-val">'+escHtml(e.horaires)+'</span></div>';
  if(e.type)        h += '<div class="fiche-info-line"><span class="fiche-info-icon">🏷️</span><span class="fiche-info-val">'+escHtml(e.type)+'</span></div>';
  h += '</div>';

  /* Tags / spécialités */
  var tags = [];
  if(e.tags && Array.isArray(e.tags)) tags = e.tags;
  else if(e.specialites && Array.isArray(e.specialites)) tags = e.specialites;
  if(tags.length){
    h += '<div class="fiche-section"><div class="fiche-section-title">Tags & spécialités</div><div class="fiche-chips">';
    tags.forEach(function(t){ h += '<span class="fiche-chip">'+escHtml(t)+'</span>'; });
    h += '</div></div>';
  }

  /* Galerie photos (slots locaux) */
  var galleryUrls = [];
  try{
    var sk = 'ambi241_photos_' + e.id;
    var sd = localStorage.getItem(sk);
    if(sd){ var sl=JSON.parse(sd); sl.forEach(function(s){ if(s&&s.url) galleryUrls.push(s.url); }); }
  }catch(ex){}
  if(galleryUrls.length > 1){
    h += '<div class="fiche-section"><div class="fiche-section-title">Galerie photos</div>';
    h += '<div class="fiche-gallery">';
    galleryUrls.forEach(function(u){
      h += '<img class="fiche-gallery-img" src="'+u+'" alt="" onclick="openFullscreenPhoto(\''+u+'\','+e.id+',\'gallery\',\''+escHtml(e.nom).replace(/'/g,'\\\'')+'\')" loading="lazy">';
    });
    h += '</div></div>';
  }

  /* Boutons d'action */
  var contact = e.contact||'';
  var waUrl   = contact ? 'https://wa.me/'+(contact.replace(/\+/g,'').replace(/\s/g,''))+'?text='+encodeURIComponent('Bonjour '+e.nom+' (via AMBI241) — Je souhaite faire une réservation') : '';
  var telUrl  = contact ? 'tel:'+contact : '';
  var _ficheRawUrl = e.maps_url || '';
  var _ficheOsmBroken = _ficheRawUrl && _ficheRawUrl.indexOf('place_id:osm') !== -1;
  var mapsUrl = (_ficheRawUrl && !_ficheOsmBroken)
    ? _ficheRawUrl
    : (e.lat && e.lng)
      ? ('https://maps.google.com/?q=' + e.lat + ',' + e.lng + '&query=' + encodeURIComponent((e.nom||'') + ' Libreville'))
      : ('https://maps.google.com/?q=' + encodeURIComponent((e.nom||'') + ' ' + (e.quartier||'') + ' Libreville Gabon'));
  h += '<div class="fiche-section"><div class="fiche-section-title">Contacts & Réservation</div>';
  h += '<div class="fiche-action-row">';
  if(waUrl)  h += '<a href="'+waUrl+'" target="_blank" class="fiche-btn fiche-btn-wa" style="border:1px solid;">💬 WhatsApp</a>';
  if(telUrl) h += '<a href="'+telUrl+'" class="fiche-btn fiche-btn-tel" style="border:1px solid;">📞 Appeler</a>';
  if(mapsUrl)h += '<a href="'+mapsUrl+'" target="_blank" class="fiche-btn fiche-btn-maps" style="border:1px solid;">📍 Maps</a>';
  h += '</div>';
  /* Bouton VIP réservation si disponible */
  if(waUrl){
    h += '<button onclick="closeFicheEtab();setTimeout(function(){var etab=window.etablissements&&window.etablissements.find(function(x){return x.id==='+e.id+';});if(etab&&typeof window._openReservSheet===\'function\')window._openReservSheet(etab);else if(typeof window.openReservationModal===\'function\')window.openReservationModal('+e.id+');},120);" style="margin-top:0.55rem;width:100%;background:linear-gradient(135deg,var(--pink),var(--purple));border:none;border-radius:12px;color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;padding:0.8rem;cursor:pointer;letter-spacing:0.02em;">🏠 Réserver une table / soirée VIP</button>';
  }
  h += '</div>';

  body.innerHTML = h;
  ov.classList.add('show');
  /* Bloquer le scroll de fond */
  document.body.style.overflow = 'hidden';

  /* Restaurer le scroll à la fermeture */
  var _restore = function(){
    document.body.style.overflow = '';
  };
  ov._ficheRestore = _restore;
};

/* Surcharger closeFicheEtab pour restaurer le scroll */
var _closeFicheOrig = window.closeFicheEtab;
window.closeFicheEtab = function(){
  var ov = document.getElementById('ficheEtabOverlay');
  if(ov){ ov.classList.remove('show'); if(typeof ov._ficheRestore==='function') ov._ficheRestore(); }
};

// ── Filtre de type dédié (lieux uniquement) ──
function setTypeFilter(type, el){
  currentType = type;
  // Vider la recherche textuelle quand on filtre par catégorie (évite les faux positifs)
  if(type !== 'all') {
    var si = document.getElementById('searchInput');
    if(si) si.value = '';
  }
  // N'activer/désactiver que les chips du bloc #typeChips
  document.querySelectorAll('#typeChips .fchip').forEach(function(c){
    c.classList.remove('active');
  });
  if(el) el.classList.add('active');
  else {
    var chip = document.querySelector('#typeChips .fchip[data-type="'+type+'"]');
    if(chip) chip.classList.add('active');
  }
  renderAll();
}
window.setTypeFilter = setTypeFilter;

// EVENTS
document.addEventListener("click",function(e){
  // Filtre de type : géré par setTypeFilter() (onclick direct sur #typeChips)
  // Filtre de statut
  var schip=e.target.closest("[data-status]");
  if(schip){currentStatus=schip.getAttribute("data-status");document.querySelectorAll("[data-status]").forEach(function(c){c.classList.remove("active");});schip.classList.add("active");renderAll();return;}
  var sortBtn=e.target.closest("[data-sort]");
  if(sortBtn){currentSort=sortBtn.getAttribute("data-sort");document.querySelectorAll("[data-sort]").forEach(function(b){b.classList.remove("active");});sortBtn.classList.add("active");renderAll();return;}
  var viewBtn=e.target.closest("[data-view]");
  if(viewBtn){currentView=viewBtn.getAttribute("data-view");document.querySelectorAll("[data-view]").forEach(function(b){b.classList.remove("active");});viewBtn.classList.add("active");renderAll();return;}
  var ebtn=e.target.closest("[data-field]");
  if(ebtn&&isAdmin&&ebtn.tagName==="BUTTON"){
    var id=parseInt(ebtn.getAttribute("data-id"));
    var field=ebtn.getAttribute("data-field");
    var val=ebtn.getAttribute("data-val");
    var obj={};obj[field]=val;
    updateField(id,obj);return;
  }
  var spbtn=e.target.closest("[data-soiree-id]");
  if(spbtn){
    var eid=parseInt(spbtn.getAttribute("data-soiree-id"));
    var etab=etablissements.find(function(x){return x.id===eid;})||{};
    if(isAdmin||canEditPhotos(etab)){
      window.__slotUploadEid=eid;
      var inp=document.getElementById("__fileSlotPhoto");
      if(inp){inp.value="";inp.click();}
    }
  }
});

// Affluence number input
document.addEventListener("change",function(e){
  var inp=e.target.closest(".affluence-input");
  if(inp&&isAdmin){
    var id=parseInt(inp.getAttribute("data-id"));
    var field=inp.getAttribute("data-field");
    var val=parseInt(inp.value);
    if(!isNaN(id)&&field&&!isNaN(val)){
      var obj={};obj[field]=val;
      updateField(id,obj);
    }
  }
});


(function(){
  var _touchStartX = 0;
  var _touchStartY = 0;
  var _touchStartTime = 0;
  var SECS_SWIPE = ["accueil","etablissements","paiements","contacts"];

  function getCurrentSecIndex(){
    for(var i=0;i<SECS_SWIPE.length;i++){
      var el=document.getElementById("sec-"+SECS_SWIPE[i]);
      if(el&&!el.classList.contains("section-hidden")) return i;
    }
    return 0;
  }

  // ⚠️ SWIPE ENTRE SECTIONS DÉSACTIVÉ — navigation uniquement via la barre de navigation
  // Les pages sont fixes : seul un clic sur un bouton de la bottom-nav change de section.
})();

// Compresse une image via canvas avant envoi (max 800px, qualité 0.75)
function compressImage(file,callback){
  // ✅ FIX Bug2: Gestion des formats non décodables nativement (HEIC, HEIF, AVIF…)
  var reader=new FileReader();
  reader.onerror=function(){ callback(null); };
  reader.onload=function(ev){
    var dataUrl=ev.target.result;
    var img=new Image();
    // Timeout 6s : si l'image ne se décode pas (HEIC sur Android), on passe le fichier brut
    var _imgTimeout=setTimeout(function(){ callback(dataUrl); },6000);
    img.onerror=function(){ clearTimeout(_imgTimeout); callback(dataUrl); };
    img.onload=function(){
      clearTimeout(_imgTimeout);
      var maxW=800,maxH=800;
      var w=img.width,h=img.height;
      if(w>maxW){h=Math.round(h*maxW/w);w=maxW;}
      if(h>maxH){w=Math.round(w*maxH/h);h=maxH;}
      var canvas=document.createElement("canvas");
      canvas.width=w;canvas.height=h;
      canvas.getContext("2d").drawImage(img,0,0,w,h);
      callback(canvas.toDataURL("image/jpeg",0.75));
    };
    img.src=dataUrl;
  };
  reader.readAsDataURL(file);
}

// Handler natif pour __fileSlotPhoto (déclenché par label, fiable Android)
var __permPhotoEid=null;
var __permPhotoType=null;

function onSlotPhotoSelected(inp){
  var eid=window.__slotUploadEid;
  if(!eid||!inp.files[0])return;
  var etab=etablissements.find(function(x){return x.id===eid;})||{};
  if(!canEditPhotos(etab)){showToast("Acces refuse");inp.value="";return;}
  var arr=loadSlotPhotos(eid);
  if(arr.length>=MAX_SLOT){showToast("Maximum "+MAX_SLOT+" photos atteint");inp.value="";return;}
  // Invalider le cache avant sauvegarde
  var eidStr = String(eid);
  delete _slotPhotoCache[eidStr];
  saveSlotPhoto(eid, inp.files[0]);
  inp.value="";
  // Rafraîchir l'UI après compression (async)
  setTimeout(function(){
    loadSlotPhotosAsync(eid, function(){
      renderAll(); renderHome();
      var modal=document.getElementById("photoManagerModal");
      if(modal && modal.style.display==="flex") renderPhotoManager();
    });
  }, 1200);
}

function onPermPhotoSelected(inp){
  var eid  = __permPhotoEid  || window.__permPhotoEid  || __photoModalEid;
  var type = __permPhotoType || window.__permPhotoType || __photoModalType || "exterieur";
  if(!eid || !inp.files || !inp.files[0]) return;
  var file = inp.files[0];
  var etab = etablissements.find(function(x){ return x.id === eid; }) || {};
  if(!canEditPhotos(etab) && !isAdmin){ showToast("Accès refusé"); inp.value=""; return; }

  __permPhotoEid  = eid;
  __permPhotoType = type;

  function _closeAnyPhotoModal(){
    closePhotoModal();
    var pm = document.getElementById("photoManagerModal");
    if(pm) pm.style.display = "none";
    _photoManagerEid = null; _photoManagerType = null;
  }

  showUploadProgress(20, "Compression...");

  // ✅ Système direct : compresse → base64 → updateField (même chemin que tous les autres champs)
  // Firebase Storage retiré — évite les blocages de progression sur Android/réseau instable
  compressImage(file, function(dataUrl){
    if(!dataUrl){ hideUploadProgress(400); showToast("❌ Impossible de lire l'image"); inp.value=""; return; }
    showUploadProgress(70, "Sauvegarde...");
    var field = type === "interieur" ? "photo_interieur" : "photo_exterieur";
    var obj = {}; obj[field] = dataUrl;
    updateField(eid, obj);
    hideUploadProgress(500);
    inp.value = "";
    _closeAnyPhotoModal();
    showToast("✅ Photo enregistrée !");
  });
}

// ── Modal photo permanente (URL + Upload) ──
var __photoModalEid = null;
var __photoModalType = null;

function loadGooglePhotosInModal(etab){
  var section = document.getElementById("photoModalGoogleSection");
  if(!section) return;
  if(!etab.place_id){ section.style.display="none"; return; }
  section.style.display="block";
  var grid = document.getElementById("photoModalGoogleGrid");
  var status = document.getElementById("photoModalGoogleStatus");
  if(grid) grid.innerHTML="";
  if(status) status.textContent="⏳ Chargement des photos Google Maps…";

  var urls = etab._gphoto_urls;
  if(urls && urls.length>0){
    _renderGooglePhotosInModal(urls);
  } else {
    // Lancer la récupération puis réessayer
    if(etab.place_id && urls===undefined){
      _gphotoEnqueue(etab);
      var tries=0;
      var poll=setInterval(function(){
        tries++;
        if(etab._gphoto_urls!==undefined){
          clearInterval(poll);
          if(etab._gphoto_urls.length>0){
            _renderGooglePhotosInModal(etab._gphoto_urls);
          } else {
            if(status) status.textContent="Aucune photo Google disponible.";
          }
        } else if(tries>30){
          clearInterval(poll);
          if(status) status.textContent="Impossible de charger les photos Google.";
        }
      }, 300);
    } else {
      if(status) status.textContent="Aucune photo Google disponible.";
    }
  }
}

function _renderGooglePhotosInModal(urls){
  var grid = document.getElementById("photoModalGoogleGrid");
  var status = document.getElementById("photoModalGoogleStatus");
  if(status) status.textContent="";
  if(!grid) return;
  grid.innerHTML="";
  urls.forEach(function(url){
    var img = document.createElement("img");
    img.src = url;
    img.style.cssText="width:100%;height:80px;object-fit:cover;border-radius:8px;cursor:pointer;border:2px solid transparent;transition:border-color 0.15s;";
    img.title="Utiliser cette photo";
    img.onclick=function(){
      var inp=document.getElementById("photoModalUrl");
      if(inp){ inp.value=url; previewPhotoUrl(); }
      // Highlight selected
      grid.querySelectorAll("img").forEach(function(i){ i.style.borderColor="transparent"; });
      img.style.borderColor="var(--cyan)";
    };
    grid.appendChild(img);
  });
}

function openPhotoModal(eid, type){
  var etab = etablissements.find(function(x){return x.id===eid;})||{};
  if(!canEditPhotos(etab) && !isAdmin){showToast("Accès refusé");return;}
  __photoModalEid  = eid;
  __photoModalType = type;
  // Exposer aussi sur window pour que le label natif puisse les lire
  window.__permPhotoEid  = eid;
  window.__permPhotoType = type;
  var modal = document.getElementById("photoModalOverlay");
  var title = document.getElementById("photoModalTitle");
  var urlInp = document.getElementById("photoModalUrl");
  var preview = document.getElementById("photoModalPreview");
  var currentField = type==="interieur"?"photo_interieur":"photo_exterieur";
  var currentUrl = etab[currentField]||"";
  if(title) title.textContent = (type==="interieur"?"🏠 Photo intérieur":"🌍 Photo extérieur") + " — " + etab.nom;
  if(urlInp) urlInp.value = currentUrl;
  if(preview){
    if(currentUrl){
      preview.innerHTML = "<img src='"+currentUrl+"' style='width:100%;max-height:160px;object-fit:cover;border-radius:10px;' onerror=\"this.parentNode.innerHTML='<span style=\\'color:var(--red);font-size:0.75rem;\\'>URL invalide ou image inaccessible</span>'\">";
    } else {
      preview.innerHTML = "<div style='height:80px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px dashed rgba(255,255,255,0.1);'>Aucune photo actuellement</div>";
    }
  }
  // Reset + load Google Photos section
  loadGooglePhotosInModal(etab);
  // Sync tab buttons
  var intBtn=document.getElementById("photoModalIntBtn");
  var extBtn=document.getElementById("photoModalExtBtn");
  if(intBtn){ intBtn.style.background=type==="interieur"?"var(--pink)":"rgba(255,255,255,0.04)"; intBtn.style.color=type==="interieur"?"#000":"var(--muted)"; }
  if(extBtn){ extBtn.style.background=type==="exterieur"?"var(--pink)":"rgba(255,255,255,0.04)"; extBtn.style.color=type==="exterieur"?"#000":"var(--muted)"; }
  if(modal) modal.classList.add("show");
}

function closePhotoModal(){
  var modal = document.getElementById("photoModalOverlay");
  if(modal) modal.classList.remove("show");
  __photoModalEid = null;
  __photoModalType = null;
}

function previewPhotoUrl(){
  var urlInp = document.getElementById("photoModalUrl");
  var preview = document.getElementById("photoModalPreview");
  var url = (urlInp&&urlInp.value.trim())||"";
  if(!preview) return;
  if(url){
    preview.innerHTML = "<img src='"+url+"' style='width:100%;max-height:160px;object-fit:cover;border-radius:10px;' onerror=\"this.parentNode.innerHTML='<span style=\\'color:var(--red);font-size:0.75rem;\\'>❌ Image inaccessible — vérifiez l\\'URL</span>'\">";
  } else {
    preview.innerHTML = "";
  }
}

function savePhotoUrl(){
  if(!__photoModalEid) return;
  var urlInp = document.getElementById("photoModalUrl");
  var url = (urlInp&&urlInp.value.trim())||"";
  if(!url){showToast("URL vide — rien à sauvegarder"); return;}
  var field = __photoModalType==="interieur"?"photo_interieur":"photo_exterieur";
  var obj={}; obj[field]=url;
  updateField(__photoModalEid, obj);
  closePhotoModal();
  showToast("✅ Photo URL sauvegardée !");
}

function triggerPhotoModalUpload(){
  if(!__photoModalEid) return;
  __permPhotoEid = __photoModalEid;
  __permPhotoType = __photoModalType;
  var inp = document.getElementById("__filePermPhoto");
  inp.value="";
  inp.click();
}

function triggerPermPhotoUpload(eid,type){
  openPhotoModal(eid, type);
}

function deletePermPhoto(eid,type){
  var etab=etablissements.find(function(x){return x.id===eid;})||{};
  if(!canEditPhotos(etab)){showToast("Acces refuse");return;}
  if(!confirm("Supprimer cette photo ?"))return;
  var obj={};obj["photo_"+type]=null;
  updateField(eid,obj);
  showToast("Photo supprimee !");
}

function openPhotoUpload(eid){
  var inp=document.getElementById("__fileSoireePhoto");
  inp.value="";
  inp.onchange=function(){
    var file=inp.files[0];if(!file)return;
    var reader=new FileReader();
    reader.onload=function(ev){
      saveSoireePhoto(eid,ev.target.result);
      renderAll();renderHome();
      showToast("Photo ajoutée (illimitée)");
    };
    reader.readAsDataURL(file);
  };
  inp.click();
}

// ── PHOTOS SLOT CE SOIR (permanent, max 5, Firebase-first + localStorage fallback) ──
// Les photos sont maintenant stockées dans Firestore (collection slotPhotos/{eid}/photos)
// et restent disponibles sur tous les appareils connectés au même compte.

var _slotPhotoCache = {}; // cache en mémoire {eid: [{url,ts,docId},...]}

// Charger les photos slot depuis Firebase (avec cache mémoire + fallback localStorage)
function loadSlotPhotosAsync(eid, callback){
  var eidStr = String(eid);
  if(_slotPhotoCache[eidStr] !== undefined){ if(callback) callback(_slotPhotoCache[eidStr]); return; }
  if(!window.db || !window.fbGetDocs || !window.fbCollection || !window.fbQuery || !window.fbOrderBy){
    // Fallback localStorage
    var stored = lsGetJSON("ambi241_slot_photos", {});
    _slotPhotoCache[eidStr] = (stored[eidStr]||[]);
    if(callback) callback(_slotPhotoCache[eidStr]);
    return;
  }
  window.fbGetDocs(
    window.fbQuery(
      window.fbCollection(window.db, "slotPhotos", eidStr, "photos"),
      window.fbOrderBy("ts", "asc")
    )
  ).then(function(snap){
    var arr = [];
    snap.forEach(function(d){ arr.push(Object.assign({docId:d.id}, d.data())); });
    _slotPhotoCache[eidStr] = arr;
    // Sync localStorage aussi
    var stored = lsGetJSON("ambi241_slot_photos", {});
    stored[eidStr] = arr;
    try{ lsSetJSON("ambi241_slot_photos", stored); }catch(e){}
    if(callback) callback(arr);
  }).catch(function(){
    var stored = lsGetJSON("ambi241_slot_photos", {});
    _slotPhotoCache[eidStr] = (stored[eidStr]||[]);
    if(callback) callback(_slotPhotoCache[eidStr]);
  });
}

// Version synchrone (utilise cache mémoire ou localStorage — pour compatibilité)
function loadSlotPhotos(eid){
  var eidStr = String(eid);
  if(_slotPhotoCache[eidStr] !== undefined) return _slotPhotoCache[eidStr];
  // Fallback localStorage synchrone
  var stored = lsGetJSON("ambi241_slot_photos", {});
  var arr = stored[eidStr] || [];
  _slotPhotoCache[eidStr] = arr;
  // Déclencher chargement async en arrière-plan pour mettre à jour le cache
  loadSlotPhotosAsync(eid, function(photos){
    _slotPhotoCache[eidStr] = photos;
  });
  return arr;
}

function saveSlotPhoto(eid, file_or_dataUrl){
  var eidStr = String(eid);
  var current = _slotPhotoCache[eidStr] || lsGetJSON("ambi241_slot_photos",{})[eidStr] || [];
  if(current.length >= MAX_SLOT){ showToast("Maximum "+MAX_SLOT+" photos atteint"); return; }

  // ✅ Système direct : base64 → Firestore (même principe que updateField)
  // Firebase Storage retiré — évite les blocages sur Android/réseau instable
  function _persist(dataUrl){
    if(!dataUrl){ hideUploadProgress && hideUploadProgress(400); showToast("❌ Impossible de lire l'image"); return; }
    showUploadProgress && showUploadProgress(70, "Photo soirée...");
    var rec = { url: dataUrl, ts: Date.now(), addedBy: window.currentUserUID || "inconnu" };

    // Sauvegarder en Firestore
    if(window.db && window.fbAddDoc && window.fbCollection){
      window.fbAddDoc(window.fbCollection(window.db, "slotPhotos", eidStr, "photos"), rec)
        .then(function(ref){
          rec.docId = ref.id;
          if(!_slotPhotoCache[eidStr]) _slotPhotoCache[eidStr] = [];
          _slotPhotoCache[eidStr].push(rec);
          var stored = lsGetJSON("ambi241_slot_photos", {});
          stored[eidStr] = _slotPhotoCache[eidStr];
          try{ lsSetJSON("ambi241_slot_photos", stored); }catch(e){}
          hideUploadProgress && hideUploadProgress(400);
          showToast("📸 Photo sauvegardée !");
          if(typeof renderAll === "function") renderAll();
          if(typeof renderHome === "function") renderHome();
        }).catch(function(){
          // Fallback localStorage
          if(!_slotPhotoCache[eidStr]) _slotPhotoCache[eidStr] = [];
          _slotPhotoCache[eidStr].push(rec);
          var stored = lsGetJSON("ambi241_slot_photos", {});
          stored[eidStr] = _slotPhotoCache[eidStr];
          try{ lsSetJSON("ambi241_slot_photos", stored); }catch(e){ showToast("Stockage plein, supprimez des photos"); }
          hideUploadProgress && hideUploadProgress(400);
          showToast("📸 Photo sauvegardée localement !");
          if(typeof renderAll === "function") renderAll();
          if(typeof renderHome === "function") renderHome();
        });
    } else {
      // Pas de Firestore — localStorage uniquement
      if(!_slotPhotoCache[eidStr]) _slotPhotoCache[eidStr] = [];
      _slotPhotoCache[eidStr].push(rec);
      var stored = lsGetJSON("ambi241_slot_photos", {});
      stored[eidStr] = _slotPhotoCache[eidStr];
      try{ lsSetJSON("ambi241_slot_photos", stored); }catch(e){}
      hideUploadProgress && hideUploadProgress(400);
      showToast("📸 Photo sauvegardée !");
      if(typeof renderAll === "function") renderAll();
      if(typeof renderHome === "function") renderHome();
    }
  }

  showUploadProgress && showUploadProgress(20, "Compression...");

  if(file_or_dataUrl instanceof File){
    if(typeof compressImage === "function"){ compressImage(file_or_dataUrl, _persist); }
    else {
      var fr = new FileReader();
      fr.onload = function(e){ _persist(e.target.result); };
      fr.onerror = function(){ hideUploadProgress && hideUploadProgress(400); showToast("❌ Erreur lecture fichier"); };
      fr.readAsDataURL(file_or_dataUrl);
    }
  } else {
    _persist(file_or_dataUrl);
  }
}

function deleteSlotPhoto(eid, idx){
  var eidStr = String(eid);
  if(!_slotPhotoCache[eidStr]) _slotPhotoCache[eidStr] = lsGetJSON("ambi241_slot_photos",{})[eidStr]||[];
  var arr = _slotPhotoCache[eidStr];
  var photo = arr[idx];
  // Supprimer de Firebase si possible
  if(photo && photo.docId && window.db && window.fbDoc && window.fbDeleteDoc){
    window.fbDeleteDoc(window.fbDoc(window.db,"slotPhotos",eidStr,"photos",photo.docId)).catch(function(){});
    // Supprimer du Storage si URL Firebase
    if(photo.url && photo.url.indexOf("firebasestorage")!==-1 && window.fbStorage && window.fbRef && window.fbDeleteObject){
      try{ window.fbDeleteObject(window.fbRef(window.fbStorage, photo.url)); }catch(e){}
    }
  }
  arr.splice(idx,1);
  _slotPhotoCache[eidStr] = arr;
  var stored=lsGetJSON("ambi241_slot_photos",{});
  stored[eidStr]=arr;
  try{lsSetJSON("ambi241_slot_photos",stored);}catch(e){}
}

// Lightbox spéciale pour le slot avec navigation et suppression
var _slotLbEid=null;
var _slotLbIdx=0;
function openSlotLightbox(eid,idx){
  var photos=loadSlotPhotos(eid);
  if(!photos.length)return;
  _slotLbEid=eid;
  _slotLbIdx=Math.max(0,Math.min(idx,photos.length-1));
  renderSlotLightbox();
  var lb=document.getElementById("slotLightbox");
  lb.style.display="flex";
}
function closeSlotLightbox(){
  var lb=document.getElementById("slotLightbox");
  lb.style.display="none";
  _slotLbEid=null;
}
function renderSlotLightbox(){
  if(_slotLbEid===null)return;
  var photos=loadSlotPhotos(_slotLbEid);
  if(!photos.length){closeSlotLightbox();return;}
  _slotLbIdx=Math.max(0,Math.min(_slotLbIdx,photos.length-1));
  var p=photos[_slotLbIdx];
  var etab=etablissements.find(function(x){return x.id===_slotLbEid;})||{};
  document.getElementById("slotLbImg").src=p.url;
  document.getElementById("slotLbCounter").textContent=(_slotLbIdx+1)+"/"+photos.length;
  document.getElementById("slotLbTimer").textContent=getTimeLeft(p.ts);
  // Boutons nav
  document.getElementById("slotLbPrev").style.display=_slotLbIdx>0?"flex":"none";
  document.getElementById("slotLbNext").style.display=_slotLbIdx<photos.length-1?"flex":"none";
  // Bouton suppr uniquement si canEditPhotos
  document.getElementById("slotLbDel").style.display=canEditPhotos(etab)?"flex":"none";
}
function slotLbNav(dir){
  var photos=loadSlotPhotos(_slotLbEid);
  _slotLbIdx=Math.max(0,Math.min(_slotLbIdx+dir,photos.length-1));
  renderSlotLightbox();
}
function slotLbDelete(){
  if(_slotLbEid===null)return;
  var etab=etablissements.find(function(x){return x.id===_slotLbEid;})||{};
  if(!canEditPhotos(etab)){showToast("Acces refuse");return;}
  if(!confirm("Supprimer cette photo ?"))return;
  var eidToDelete = _slotLbEid;
  var idxToDelete = _slotLbIdx;
  deleteSlotPhoto(eidToDelete, idxToDelete);
  // Invalider le cache et recharger depuis Firebase
  delete _slotPhotoCache[String(eidToDelete)];
  var photos=loadSlotPhotos(eidToDelete);
  if(!photos.length){closeSlotLightbox();renderAll();renderHome();showToast("Photo supprimee");return;}
  _slotLbIdx=Math.max(0,_slotLbIdx-1);
  renderSlotLightbox();
  renderAll();renderHome();
  showToast("Photo supprimee");
}
// ─────────────────────────────────────────────────────────────────

function saveMapsUrl(id){
  var inp=document.querySelector(".maps-url-input[data-id=\""+id+"\"]");
  if(!inp)return;
  var url=inp.value.trim();
  if(!url){showToast("Lien Maps vide");return;}
  updateField(id,{maps_url:url});
  showToast("Lien Maps sauvegarde !");
}

var toastTimer;
function showToast(msg){
  var t=document.getElementById("toast");
  t.textContent=msg;t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer=setTimeout(function(){t.classList.remove("show");},2500);
}

// ── BARRE DE PROGRESSION UPLOAD GLOBALE ──────────────────────────
var _upbHideTimer = null;
function showUploadProgress(pct, label){
  var bar = document.getElementById("uploadProgressBar");
  var fill = document.getElementById("upbFill");
  var lbl  = document.getElementById("upbLabel");
  if(!bar || !fill || !lbl) return;
  clearTimeout(_upbHideTimer);
  bar.classList.add("show");
  var p = Math.max(0, Math.min(100, Math.round(pct)));
  fill.style.width = p + "%";
  lbl.textContent  = label || (p + "%");
}
function hideUploadProgress(delay){
  var bar = document.getElementById("uploadProgressBar");
  var fill = document.getElementById("upbFill");
  if(!bar) return;
  // Remplir à 100% visuellement avant de masquer
  showUploadProgress(100, "✓");
  _upbHideTimer = setTimeout(function(){
    bar.classList.remove("show");
    if(fill) fill.style.width = "0%";
  }, delay !== undefined ? delay : 900);
}
window.showUploadProgress = showUploadProgress;
window.hideUploadProgress = hideUploadProgress;

// ══════════════════════════════════════════════════════════════
// ══ OPTION 1+2 — ÉVÉNEMENTS FLASH ÉTABLISSEMENTS            ══
// ══════════════════════════════════════════════════════════════

var _evtFlashEid = null;
var _evtFlashDuree = 6; // heures par défaut

function openEventFlashModal(eid){
  _evtFlashEid = eid;
  _evtFlashDuree = 6;
  var etab = etablissements.find(function(x){ return x.id === eid; }) || {};
  var existingEvt = etab.event_flash || {};

  var html =
    '<div id="_evtFlashOverlay" style="position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.88);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1rem;" onclick="if(event.target===this)closeEventFlashModal()">' +
    '<div class="evt-modal-wrap">' +
    '<button onclick="closeEventFlashModal()" style="position:absolute;top:1rem;right:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
    '<div style="font-size:2rem;text-align:center;margin-bottom:0.5rem;">📣</div>' +
    '<div class="evt-modal-title">Annoncer un événement ce soir</div>' +
    '<div class="evt-modal-sub">Le bandeau apparaîtra immédiatement sur votre carte et en tête de la page d\'accueil.</div>' +
    // Titre événement
    '<div class="field"><label>Titre de l\'événement <span class="req">*</span></label>' +
    '<input type="text" id="evtFlashTexte" placeholder="Ex: Artiste X en live dès 22h !" maxlength="80" value="'+escHtml(existingEvt.texte||'')+'" style="background:var(--surface2);border:1px solid rgba(255,45,155,0.25);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.88rem;padding:0.65rem 0.9rem;outline:none;width:100%;box-sizing:border-box;"></div>' +
    // Détail
    '<div class="field"><label>Détail (optionnel)</label>' +
    '<input type="text" id="evtFlashDetail" placeholder="Ex: Entrée libre · Bar Lounge" maxlength="60" value="'+escHtml(existingEvt.detail||'')+'" style="background:var(--surface2);border:1px solid rgba(255,45,155,0.15);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.88rem;padding:0.65rem 0.9rem;outline:none;width:100%;box-sizing:border-box;"></div>' +
    // Heure
    '<div class="field"><label>Heure de début (optionnel)</label>' +
    '<input type="text" id="evtFlashHeure" placeholder="Ex: 22h00" maxlength="10" value="'+escHtml(existingEvt.heure||'')+'" style="background:var(--surface2);border:1px solid rgba(255,45,155,0.15);border-radius:10px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.88rem;padding:0.65rem 0.9rem;outline:none;width:100%;box-sizing:border-box;"></div>' +
    // Durée
    '<div class="field"><label>Durée de l\'annonce</label></div>' +
    '<div class="evt-duration-row" id="evtDurRow">' +
    '<div class="evt-dur-btn active" onclick="_setEvtDuree(6,this)">6h</div>' +
    '<div class="evt-dur-btn" onclick="_setEvtDuree(12,this)">12h</div>' +
    '<div class="evt-dur-btn" onclick="_setEvtDuree(24,this)">24h</div>' +
    '</div>' +
    // Option épingler (admin seulement)
    (isAdmin ? '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.9rem;"><input type="checkbox" id="evtFlashPin" style="accent-color:var(--amber);width:15px;height:15px;"><label for="evtFlashPin" style="font-size:0.78rem;color:var(--muted);">Épingler sur la page d\'accueil (priorité maximale)</label></div>' : '') +
    '<button onclick="saveEventFlash()" style="width:100%;padding:0.8rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.95rem;cursor:pointer;margin-top:0.2rem;">📣 Publier l\'annonce</button>' +
    '<div id="evtFlashMsg" style="font-size:0.78rem;text-align:center;margin-top:0.5rem;display:none;"></div>' +
    '</div></div>';

  var wrap = document.createElement("div");
  wrap.id = "_evtFlashWrap";
  wrap.innerHTML = html;
  document.body.appendChild(wrap);
}

function _setEvtDuree(h, btn){
  _evtFlashDuree = h;
  document.querySelectorAll(".evt-dur-btn").forEach(function(b){ b.classList.remove("active"); });
  if(btn) btn.classList.add("active");
}

function closeEventFlashModal(){
  var el = document.getElementById("_evtFlashWrap");
  if(el) el.remove();
  _evtFlashEid = null;
}

function saveEventFlash(){
  var eid = _evtFlashEid;
  if(eid === null){ showToast("Erreur : établissement non défini"); return; }
  var texteEl = document.getElementById("evtFlashTexte");
  var detailEl = document.getElementById("evtFlashDetail");
  var heureEl = document.getElementById("evtFlashHeure");
  var pinEl = document.getElementById("evtFlashPin");
  var msgEl = document.getElementById("evtFlashMsg");

  var texte = texteEl ? texteEl.value.trim() : "";
  if(!texte){
    if(msgEl){ msgEl.style.display="block"; msgEl.style.color="var(--red)"; msgEl.textContent="Veuillez saisir un titre."; }
    return;
  }
  var now = Date.now();
  var evtData = {
    texte: texte,
    detail: detailEl ? detailEl.value.trim() : "",
    heure: heureEl ? heureEl.value.trim() : "",
    ts: now,
    duree: _evtFlashDuree,
    expire: now + _evtFlashDuree * 3600000,
    pinned: !!(pinEl && pinEl.checked)
  };

  // Sauvegarder dans Firebase
  if(window.db && window.fbDoc && window.fbUpdateDoc){
    if(msgEl){ msgEl.style.display="block"; msgEl.style.color="var(--cyan)"; msgEl.textContent="Enregistrement..."; }
    window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", String(eid)), { event_flash: evtData })
      .then(function(){
        // Mise à jour locale
        var etab = etablissements.find(function(x){ return x.id === eid; });
        if(etab) etab.event_flash = evtData;
        closeEventFlashModal();
        renderAll(); renderHome();
        showToast("📣 Événement annoncé avec succès !");
      }).catch(function(err){
        if(msgEl){ msgEl.textContent = "Erreur : "+err.message; msgEl.style.color="var(--red)"; }
      });
  } else {
    // Pas de Firebase : mise à jour locale uniquement
    var etab = etablissements.find(function(x){ return x.id === eid; });
    if(etab) etab.event_flash = evtData;
    closeEventFlashModal();
    renderAll(); renderHome();
    showToast("📣 Événement annoncé (local) !");
  }
}

function clearEventFlash(eid){
  if(!confirm("Supprimer l'annonce de cet événement ?")) return;
  if(window.db && window.fbDoc && window.fbUpdateDoc){
    window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", String(eid)), { event_flash: {} })
      .then(function(){
        var etab = etablissements.find(function(x){ return x.id === eid; });
        if(etab) etab.event_flash = {};
        renderAll(); renderHome();
        showToast("Annonce supprimée");
      }).catch(function(err){ showToast("Erreur : "+err.message); });
  } else {
    var etab = etablissements.find(function(x){ return x.id === eid; });
    if(etab) etab.event_flash = {};
    renderAll(); renderHome();
    showToast("Annonce supprimée (local)");
  }
}

window.openEventFlashModal = openEventFlashModal;
window.closeEventFlashModal = closeEventFlashModal;
window.saveEventFlash = saveEventFlash;
window.clearEventFlash = clearEventFlash;
window._setEvtDuree = _setEvtDuree;

// ── Nettoyage automatique des événements expirés ──────────────
setInterval(function(){
  var changed = false;
  etablissements.forEach(function(e){
    if(e.event_flash && e.event_flash.texte){
      var expire = e.event_flash.expire || (e.event_flash.ts + (e.event_flash.duree||6)*3600000);
      if(Date.now() >= expire){
        e.event_flash = {};
        changed = true;
        // Supprimer dans Firebase
        if(window.db && window.fbDoc && window.fbUpdateDoc){
          window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", String(e.id)), { event_flash: {} }).catch(function(){});
        }
      }
    }
  });
  if(changed){ renderAll(); renderHome(); }
}, 60000); // vérification chaque minute

// ══════════════════════════════════════════════════════════════


var galerieEtabId=null;
var MAX_GALERIE=10;

// ── Cache mémoire galerie (évite les lectures Firebase répétées) ──
var _galerieCache = {}; // { eid: [ {url, addedAt, docId, addedBy} ] }

// Charger la galerie depuis Firebase Firestore (permanent) avec fallback localStorage
function loadGalerieFirebase(eid, callback){
  var eidStr = String(eid);
  // Retourner le cache si disponible
  if(_galerieCache[eidStr] !== undefined){ if(callback) callback(_galerieCache[eidStr]); return; }
  if(!window.db || !window.fbGetDocs || !window.fbCollection || !window.fbQuery || !window.fbOrderBy){
    // Fallback localStorage si Firebase indisponible
    var stored = lsGetJSON("ambi241_galerie", {});
    _galerieCache[eidStr] = stored[eidStr] || [];
    if(callback) callback(_galerieCache[eidStr]);
    return;
  }
  try {
    window.fbGetDocs(
      window.fbQuery(
        window.fbCollection(window.db, "etablissements", eidStr, "galerie"),
        window.fbOrderBy("addedAt", "asc")
      )
    ).then(function(snap){
      var photos = [];
      snap.forEach(function(d){ photos.push(Object.assign({docId: d.id}, d.data())); });
      _galerieCache[eidStr] = photos;
      if(callback) callback(photos);
    }).catch(function(){
      // Fallback localStorage
      var stored = lsGetJSON("ambi241_galerie", {});
      _galerieCache[eidStr] = stored[eidStr] || [];
      if(callback) callback(_galerieCache[eidStr]);
    });
  } catch(e) {
    var stored = lsGetJSON("ambi241_galerie", {});
    _galerieCache[eidStr] = stored[eidStr] || [];
    if(callback) callback(_galerieCache[eidStr]);
  }
}

// Sauvegarder une photo dans Firebase Firestore (permanent)
function saveGaleriePhotoFirebase(eid, file, callback){
  var eidStr = String(eid);
  var addedBy = currentUserEmail || window.currentUserUID || "inconnu";

  function _persistRecord(url){
    var record = { url: url, addedAt: Date.now(), addedBy: addedBy };
    if(window.db && window.fbAddDoc && window.fbCollection){
      window.fbAddDoc(window.fbCollection(window.db, "etablissements", eidStr, "galerie"), record)
        .then(function(docRef){
          record.docId = docRef.id;
          if(!_galerieCache[eidStr]) _galerieCache[eidStr] = [];
          _galerieCache[eidStr].push(record);
          if(callback) callback(true);
        }).catch(function(){
          // Fallback localStorage si Firestore échoue
          var stored = lsGetJSON("ambi241_galerie", {});
          stored[eidStr] = (stored[eidStr]||[]);
          stored[eidStr].push(record);
          try{ lsSetJSON("ambi241_galerie", stored); }catch(e){}
          if(!_galerieCache[eidStr]) _galerieCache[eidStr] = [];
          _galerieCache[eidStr].push(record);
          if(callback) callback(true);
        });
    } else {
      // Fallback localStorage
      var stored = lsGetJSON("ambi241_galerie", {});
      stored[eidStr] = (stored[eidStr]||[]);
      stored[eidStr].push(record);
      try{ lsSetJSON("ambi241_galerie", stored); }catch(e){}
      if(!_galerieCache[eidStr]) _galerieCache[eidStr] = [];
      _galerieCache[eidStr].push(record);
      if(callback) callback(true);
    }
  }

  // Tenter Firebase Storage pour un vrai URL permanent, sinon base64
  if(window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL){
    var etab = etablissements.find(function(x){ return String(x.id)===eidStr; });
    var docId = (etab && etab._docId) || ("etab_"+String(eid).padStart(3,"0"));
    var path = "etablissements/"+docId+"/galerie/"+_cryptoId(16)+".jpg";
    var storageRef = window.fbRef(window.fbStorage, path);
    showUploadProgress(20, "Galerie...");
    window.fbUploadBytes(storageRef, file).then(function(){
      showUploadProgress(80, "Finalisation...");
      return window.fbGetDownloadURL(storageRef);
    }).then(function(url){
      hideUploadProgress(700);
      _persistRecord(url);
    }).catch(function(){
      // Fallback base64
      compressImage(file, function(dataUrl){ hideUploadProgress(700); _persistRecord(dataUrl); });
    });
  } else {
    compressImage(file, function(dataUrl){ hideUploadProgress(700); _persistRecord(dataUrl); });
  }
}

// Supprimer une photo depuis Firebase
function deleteGaleriePhotoFirebase(eid, photo, index, callback){
  var eidStr = String(eid);
  function _removeFromCache(){
    if(_galerieCache[eidStr]) _galerieCache[eidStr].splice(index,1);
    // Aussi dans localStorage si présent
    var stored = lsGetJSON("ambi241_galerie", {});
    if(stored[eidStr]){
      stored[eidStr].splice(index,1);
      try{ lsSetJSON("ambi241_galerie", stored); }catch(e){}
    }
    if(callback) callback();
  }
  if(photo.docId && window.db && window.fbDoc && window.fbDeleteDoc){
    window.fbDeleteDoc(window.fbDoc(window.db, "etablissements", eidStr, "galerie", photo.docId))
      .then(function(){ _removeFromCache(); })
      .catch(function(){ _removeFromCache(); });
  } else {
    _removeFromCache();
  }
}

function openGalerie(eid){
  if(!isAdmin && !currentUserEmail){
    document.getElementById("invitOverlay").classList.add("show");
    return;
  }
  galerieEtabId=eid;
  var etab=etablissements.find(function(x){return x.id===eid;})||{};
  document.getElementById("galerieNom").textContent="\uD83D\uDCF8 "+etab.nom;
  document.getElementById("galerieSub").textContent="Galerie photos — "+etab.quartier;
  var inp=document.getElementById("__fileGallery");
  if(inp)inp.value="";
  // Invalider le cache pour forcer rechargement depuis Firebase
  delete _galerieCache[String(eid)];
  renderGalerieGrid();
  document.getElementById("galerieOverlay").classList.add("show");
}
function closeGalerie(){
  document.getElementById("galerieOverlay").classList.remove("show");
  galerieEtabId=null;
}
function closeInvit(){
  document.getElementById("invitOverlay").classList.remove("show");
}
function openUserModal(){
  document.getElementById("userOverlay").classList.add("show");
  // Connexion est la vue par défaut (membres existants)
  // Si déjà connecté, le onAuthStateChanged aura switché vers monprofil
  var currentTab = document.getElementById("tabConnexion");
  if(currentTab && !currentTab.classList.contains("active")){
    var profTab = document.getElementById("tabMonProfil");
    var isProfVisible = profTab && profTab.style.display !== "none";
    if(!isProfVisible) switchUserTab("connexion");
  }
}

function renderGalerieGrid(){
  var eid=galerieEtabId;
  var etab=etablissements.find(function(x){return x.id===eid;})||{};
  var canEdit=isAdmin||canEditPhotos(etab);
  var grid=document.getElementById("galerieGrid");
  var addBar=document.getElementById("galerieAddBar");
  var countSpan=document.getElementById("galerieCount");

  // Afficher le spinner pendant le chargement Firebase
  grid.innerHTML="<div style=\"grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);font-size:0.82rem;\">⏳ Chargement de la galerie...</div>";
  addBar.style.display="none";

  loadGalerieFirebase(eid, function(photos){
    countSpan.textContent="("+photos.length+"/"+MAX_GALERIE+")";

    // ── Section avatars membres ── (photo de profil visible & cliquable)
    var memberAvatarsHtml = _buildMemberAvatarsSection(eid, canEdit);

    var html="";
    photos.forEach(function(p,i){
      html+="<div style=\"position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;background:var(--surface2);\">";
      html+="<img src=\""+escHtml(p.url)+"\" style=\"width:100%;height:100%;object-fit:cover;cursor:pointer;display:block;\" onclick=\"openLightbox('"+escHtml(p.url)+"')\" onerror=\"this.parentElement.style.background='rgba(255,255,255,0.04)'\">";
      if(p.addedBy){
        html+="<span style=\"position:absolute;bottom:3px;left:4px;font-size:0.5rem;background:rgba(0,0,0,0.65);color:rgba(255,255,255,0.75);padding:0.08rem 0.3rem;border-radius:4px;max-width:90%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">"+escHtml((p.addedBy||"").split("@")[0])+"</span>";
      }
      if(canEdit){
        html+="<button onclick=\"_deleteGaleriePhotoByIdx("+i+")\" style=\"position:absolute;top:4px;right:4px;background:rgba(0,0,0,0.7);border:none;color:#fff;width:24px;height:24px;border-radius:50%;font-size:0.75rem;cursor:pointer;line-height:24px;text-align:center;padding:0;\">&#10005;</button>";
        html+="<button onclick=\"event.stopPropagation();galerieSetAsProfile("+eid+","+i+")\" style=\"position:absolute;bottom:3px;right:3px;background:rgba(0,229,255,0.88);border:none;color:#0a1a2a;font-size:0.48rem;font-weight:800;padding:0.15rem 0.35rem;border-radius:4px;cursor:pointer;font-family:DM Sans,sans-serif;white-space:nowrap;\">⭐ Profil</button>";
      }
      html+="</div>";
    });

    if(photos.length===0){
      html="<div style=\"grid-column:1/-1;text-align:center;padding:2rem;color:var(--muted);font-size:0.82rem;\">&#128247; Aucune photo pour le moment</div>";
    }

    grid.innerHTML = memberAvatarsHtml + html;
    addBar.style.display=(canEdit&&photos.length<MAX_GALERIE)?"block":"none";

    // Charger les avatars membres de manière asynchrone
    _loadMemberAvatarsInGalerie(eid);
  });
}

// ── Section avatars membres dans la galerie ──
function _buildMemberAvatarsSection(eid, canEdit){
  var myUid = window.currentUserUID;
  if(!myUid) return "";

  var myInitiale = ((window.currentUserPseudo||window.currentUserEmail||"?")[0]).toUpperCase();
  var editBtn = canEdit
    ? " <button onclick=\"_openMyAvatarEditFromGalerie()\" style=\"font-size:0.6rem;font-weight:700;background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.35);color:var(--pink);padding:0.12rem 0.4rem;border-radius:5px;cursor:pointer;font-family:DM Sans,sans-serif;margin-left:0.35rem;\">✏️ Modifier</button>"
    : " <button onclick=\"_openMyAvatarEditFromGalerie()\" style=\"font-size:0.6rem;font-weight:700;background:rgba(0,229,255,0.10);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);padding:0.12rem 0.4rem;border-radius:5px;cursor:pointer;font-family:DM Sans,sans-serif;margin-left:0.35rem;\">🖼️ Ma photo</button>";

  return "<div id=\"galerieMembreSection\" style=\"grid-column:1/-1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,45,155,0.15);border-radius:12px;padding:0.6rem 0.75rem;margin-bottom:0.5rem;\">"
    +"<div style=\"font-size:0.6rem;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);margin-bottom:0.5rem;display:flex;align-items:center;gap:0.4rem;\">👤 Membres présents"+editBtn+"</div>"
    +"<div id=\"galerieMembreAvatars\" style=\"display:flex;flex-wrap:wrap;gap:0.4rem;align-items:center;\">"
    +"<div id=\"myGalerieAvatar\" style=\"cursor:pointer;\" onclick=\"_openMyAvatarEditFromGalerie()\">"
    +"<div style=\"width:36px;height:36px;border-radius:50%;border:2px solid var(--pink);display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--pink),var(--purple));font-weight:800;font-size:0.9rem;color:#fff;font-family:Syne,sans-serif;\" id=\"myGalerieAvatarInner\">"+myInitiale+"</div>"
    +"<div style=\"font-size:0.5rem;color:var(--muted);text-align:center;margin-top:0.15rem;\">Moi</div>"
    +"</div>"
    +"</div>"
    +"</div>";
}

// Charger les avatars des membres depuis Firebase (async)
function _loadMemberAvatarsInGalerie(eid){
  var myUid = window.currentUserUID;
  if(!myUid) return;
  // Charger l'avatar de l'utilisateur courant
  loadUserAvatar(myUid, function(url){
    var inner = document.getElementById("myGalerieAvatarInner");
    if(!inner) return;
    if(url){
      inner.innerHTML = "<img src=\""+escHtml(url)+"\" style=\"width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;\" onerror=\"this.style.display='none'\">";
      inner.style.padding="0";
      inner.style.overflow="hidden";
    }
  });
}

// Ouvrir l'éditeur d'avatar depuis la galerie
function _openMyAvatarEditFromGalerie(){
  var uid = window.currentUserUID;
  if(!uid){ showToast("Connectez-vous pour modifier votre photo"); return; }

  var old = document.getElementById("_galerieAvatarEditModal");
  if(old) old.remove();

  var overlay = document.createElement("div");
  overlay.id = "_galerieAvatarEditModal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:10100;display:flex;align-items:center;justify-content:center;padding:1rem;";

  var fileInputId = "_galerieAvatarFile";
  overlay.innerHTML = "<div style=\"background:var(--surface);border:1px solid rgba(255,45,155,0.4);border-radius:20px;padding:1.4rem 1.2rem;width:min(340px,100%);text-align:center;\">"
    +"<div style=\"font-family:Syne,sans-serif;font-size:1rem;font-weight:800;color:var(--pink);margin-bottom:0.3rem;\">🖼️ Ma photo de profil</div>"
    +"<div style=\"font-size:0.72rem;color:var(--muted);margin-bottom:1rem;line-height:1.5;\">Visible dans la galerie et les commentaires. Permanente jusqu'à votre prochain changement.</div>"
    +"<div id=\"_galerieAvatarPreview\" style=\"width:80px;height:80px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--purple));border:3px solid var(--pink);margin:0 auto 1rem;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.8rem;color:#fff;font-family:Syne,sans-serif;overflow:hidden;\">"+((window.currentUserPseudo||window.currentUserEmail||"?")[0]).toUpperCase()+"</div>"
    +"<input type=\"file\" id=\""+fileInputId+"\" accept=\"image/*\" style=\"display:none\" onchange=\"_onGalerieAvatarSelected(this)\">"
    +"<label for=\""+fileInputId+"\" style=\"display:block;width:100%;padding:0.7rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),#e0009a);color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;text-align:center;box-sizing:border-box;margin-bottom:0.6rem;\">📷 Choisir une photo</label>"
    +"<button onclick=\"document.getElementById('_galerieAvatarEditModal').remove()\" style=\"display:block;width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:var(--muted);font-family:DM Sans,sans-serif;font-size:0.8rem;cursor:pointer;\">Annuler</button>"
    +"</div>";

  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e){ if(e.target===overlay) overlay.remove(); });

  // Pré-charger l'avatar actuel
  loadUserAvatar(uid, function(url){
    var preview = document.getElementById("_galerieAvatarPreview");
    if(preview && url){
      preview.innerHTML = "<img src=\""+escHtml(url)+"\" style=\"width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;\">";
    }
  });
}
window._openMyAvatarEditFromGalerie = _openMyAvatarEditFromGalerie;

// Traiter la sélection d'un fichier avatar depuis la galerie
function _onGalerieAvatarSelected(inp){
  var file = inp.files[0];
  if(!file) return;
  var uid = window.currentUserUID;
  if(!uid){ showToast("Erreur: non connecté"); return; }

  showToast("⏳ Upload de votre photo...");
  inp.value = "";

  function _saveAvatarUrl(url){
    // Mettre à jour Firestore
    if(window.db && window.fbUpdateDoc && window.fbDoc){
      (window.fbSetDoc ? window.fbSetDoc(window.fbDoc(window.db,"users",uid),{ avatarUrl: url },{merge:true}) : window.fbUpdateDoc(window.fbDoc(window.db, "users", uid), { avatarUrl: url }))
        .then(function(){
          _userAvatarCache[uid] = url;
          showToast("✅ Photo de profil mise à jour !");
          // Mettre à jour l'aperçu dans la modal
          var preview = document.getElementById("_galerieAvatarPreview");
          if(preview){ preview.innerHTML = "<img src=\""+escHtml(url)+"\" style=\"width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;\">"; }
          // Mettre à jour l'avatar dans la galerie
          _loadMemberAvatarsInGalerie(galerieEtabId);
          // Mettre à jour le header
          if(typeof _renderMyProfileTab === "function") _renderMyProfileTab();
          // Fermer la modal après 1 seconde
          setTimeout(function(){ var m=document.getElementById("_galerieAvatarEditModal"); if(m) m.remove(); }, 1000);
        }).catch(function(e){ showToast("Erreur: "+e.message); });
    } else {
      // Fallback localStorage
      try{ localStorage.setItem("ambi241_photo_"+uid, url); }catch(e){}
      _userAvatarCache[uid] = url;
      showToast("✅ Photo enregistrée !");
      var preview = document.getElementById("_galerieAvatarPreview");
      if(preview){ preview.innerHTML = "<img src=\""+escHtml(url)+"\" style=\"width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;\">"; }
      _loadMemberAvatarsInGalerie(galerieEtabId);
    }
  }

  // Firebase Storage en priorité, sinon base64
  if(window.fbStorage && window.fbRef && window.fbUploadBytes && window.fbGetDownloadURL){
    var path = "users/"+uid+"/avatar_"+_cryptoId(12)+".jpg";
    var storageRef = window.fbRef(window.fbStorage, path);
    window.fbUploadBytes(storageRef, file).then(function(){
      return window.fbGetDownloadURL(storageRef);
    }).then(function(url){
      _saveAvatarUrl(url);
    }).catch(function(){
      compressImage(file, function(dataUrl){ _saveAvatarUrl(dataUrl); });
    });
  } else {
    compressImage(file, function(dataUrl){ _saveAvatarUrl(dataUrl); });
  }
}
window._onGalerieAvatarSelected = _onGalerieAvatarSelected;

// Appelé directement par onchange sur l'input dans la modal
function onGalerieFileSelected(inp){
  var file=inp.files[0];
  if(!file||galerieEtabId===null)return;
  var eidStr = String(galerieEtabId);
  var cached = _galerieCache[eidStr] || [];
  if(cached.length>=MAX_GALERIE){showToast("Maximum "+MAX_GALERIE+" photos atteint");inp.value="";return;}
  showToast("⏳ Upload en cours...");
  inp.value="";
  saveGaleriePhotoFirebase(galerieEtabId, file, function(ok){
    if(ok){
      showToast("✅ Photo ajoutée !");
      renderGalerieGrid();
    }
  });
}

function _deleteGaleriePhotoByIdx(index){
  if(!confirm("Supprimer cette photo ?"))return;
  var eidStr = String(galerieEtabId);
  var photos = _galerieCache[eidStr] || [];
  var photo = photos[index];
  if(!photo) return;
  deleteGaleriePhotoFirebase(galerieEtabId, photo, index, function(){
    showToast("Photo supprimée");
    renderGalerieGrid();
  });
}
window._deleteGaleriePhotoByIdx = _deleteGaleriePhotoByIdx;

// ── Définir une photo de galerie Firebase comme photo de profil de l'établissement ──
function galerieSetAsProfile(eid, idx){
  var eidStr = String(eid);
  var photos = _galerieCache[eidStr] || [];
  var photo = photos[idx];
  if(!photo || !photo.url){ showToast("Photo introuvable"); return; }
  updateField(eid, {photo_interieur: photo.url});
  showToast("✅ Photo définie comme photo de profil !");
  renderAll();
  renderHome();
}
window.galerieSetAsProfile = galerieSetAsProfile;

// ── Définir une photo du gestionnaire local (slot) comme photo de profil ──
function slotSetAsProfile(eid, idx){
  var photos = loadSlotPhotos(eid);
  var photo = photos[idx];
  if(!photo || !photo.url){ showToast("Photo introuvable"); return; }
  updateField(eid, {photo_interieur: photo.url});
  showToast("✅ Photo définie comme photo de profil !");
  renderAll();
  renderHome();
}
window.slotSetAsProfile = slotSetAsProfile;

// Rétrocompatibilité (ancienne signature utilisée nulle part, mais sécurité)
function deleteGaleriePhoto(index){ _deleteGaleriePhotoByIdx(index); }
// ─────────────────────────────────────────────────────────────────

// ══ SÉCURITÉ — Nettoyage automatique des cooldowns expirés ════
// Évite que localStorage grossisse indéfiniment avec des clés de protection
(function _cleanSecurityKeys(){
  try{
    var now = Date.now();
    var toDelete = [];
    for(var i=0; i<localStorage.length; i++){
      var k = localStorage.key(i);
      if(!k) continue;
      // Clés de cooldown sécurité (vote, signalement, présence, demande)
      if(k.indexOf("ambi241_vcd_")===0 ||
         k.indexOf("ambi241_scd_")===0 ||
         k.indexOf("ambi241_lastpres_")===0){
        var v = parseInt(localStorage.getItem(k)||"0");
        if(v && (now-v) > 24*3600*1000) toDelete.push(k); // > 24h → purger
      }
    }
    toDelete.forEach(function(k){ try{ localStorage.removeItem(k); }catch(e){} });
  }catch(e){}
})();

// ══ FIN PROTECTIONS SÉCURITÉ ════════════════════════════════════

/* PERF : Auto-sync public toutes les 2 min (au lieu de 60s) + skip si onglet caché */
setInterval(function(){if(!isAdmin && !document.hidden) loadData();}, 120000);

// ── Expose toutes les fonctions appelées depuis le HTML ──────
window.switchSection      = switchSection;
window.goHome             = goHome;
window.toggleAdmin        = toggleAdmin;
window.pinPress           = pinPress;
window.hashPin            = hashPin;
window.loadPinHash        = loadPinHash;
window.openUserModal      = openUserModal;
window.closeUserModal     = closeUserModal;
window.switchUserTab      = switchUserTab;
window.registerUser          = registerUser;
window.regSelectType         = regSelectType;
window.regOnPhotoSelected    = regOnPhotoSelected;
window.regOnIdSelected       = regOnIdSelected;
window.regUpdateIdTypeLabel  = regUpdateIdTypeLabel;
window.loginUser          = loginUser;
window.openGalerie        = openGalerie;
window.closeGalerie       = closeGalerie;
window.closeInvit         = closeInvit;
window.openLightbox       = openLightbox;
window.closeLightbox      = closeLightbox;
window.openFullscreenPhoto  = openFullscreenPhoto;
window.closeFullscreenPhoto = closeFullscreenPhoto;
window.openSlotLightbox   = openSlotLightbox;
window.closeSlotLightbox  = closeSlotLightbox;
// Alias corrects pour la lightbox slot (appelés depuis le HTML)
window.prevSlotPhoto      = function(){ slotLbNav(-1); };
window.nextSlotPhoto      = function(){ slotLbNav(1); };
window.deleteSlotPhotoLb  = slotLbDelete;
window.slotLbNav          = slotLbNav;
window.slotLbDelete       = slotLbDelete;
window.onSlotPhotoSelected    = onSlotPhotoSelected;
window.onPermPhotoSelected    = onPermPhotoSelected;
window.onGalerieFileSelected  = onGalerieFileSelected;
window.triggerPermPhotoUpload = triggerPermPhotoUpload;
window.deletePermPhoto        = deletePermPhoto;
window.openPhotoModal         = openPhotoModal;
window.closePhotoModal        = closePhotoModal;
window.savePhotoUrl           = savePhotoUrl;
window.previewPhotoUrl        = previewPhotoUrl;
window.triggerPhotoModalUpload = triggerPhotoModalUpload;

function deletePermPhotoFromModal(){
  if(!__photoModalEid) return;
  if(!confirm("Supprimer cette photo ?")) return;
  var obj = {};
  obj["photo_"+__photoModalType] = "";
  updateField(__photoModalEid, obj);
  closePhotoModal();
  showToast("Photo supprimée !");
}
window.deletePermPhotoFromModal = deletePermPhotoFromModal;

function switchPhotoModalType(type){
  if(!__photoModalEid) return;
  var etab = etablissements.find(function(x){return x.id===__photoModalEid;})||{};
  __photoModalType = type;
  var urlInp = document.getElementById("photoModalUrl");
  var preview = document.getElementById("photoModalPreview");
  var title = document.getElementById("photoModalTitle");
  var intBtn = document.getElementById("photoModalIntBtn");
  var extBtn = document.getElementById("photoModalExtBtn");
  var field = type==="interieur"?"photo_interieur":"photo_exterieur";
  var currentUrl = etab[field]||"";
  if(title) title.textContent = (type==="interieur"?"🏠 Photo intérieur":"🌍 Photo extérieur")+" — "+etab.nom;
  if(urlInp) urlInp.value = currentUrl;
  if(preview){
    if(currentUrl){
      preview.innerHTML = "<img src='"+currentUrl+"' style='width:100%;max-height:160px;object-fit:cover;border-radius:10px;' onerror=\"this.parentNode.innerHTML='<span style=\\'color:var(--red);font-size:0.75rem;\\'>URL invalide</span>'\">";
    } else {
      preview.innerHTML = "<div style='height:80px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.8rem;background:rgba(255,255,255,0.03);border-radius:10px;border:1px dashed rgba(255,255,255,0.1);'>Aucune photo</div>";
    }
  }
  if(intBtn) intBtn.style.background = type==="interieur"?"var(--pink)":"rgba(255,255,255,0.04)";
  if(intBtn) intBtn.style.color = type==="interieur"?"#000":"var(--muted)";
  if(extBtn) extBtn.style.background = type==="exterieur"?"var(--pink)":"rgba(255,255,255,0.04)";
  if(extBtn) extBtn.style.color = type==="exterieur"?"#000":"var(--muted)";
  // Reload Google photos section in case place_id is available
  loadGooglePhotosInModal(etab);
}
window.switchPhotoModalType = switchPhotoModalType;
window.loadGooglePhotosInModal = loadGooglePhotosInModal;
window.isGooglePlacesPhoto    = isGooglePlacesPhoto;
window.saveMapsUrl            = saveMapsUrl;
window.previewUpload          = previewUpload;
window.switchAdminTab         = switchAdminTab;
window.showToast              = showToast;
window.deleteGaleriePhoto     = deleteGaleriePhoto;
window.openPhotoUpload        = openPhotoUpload;
// ─────────────────────────────────────────────────────────────


// ══════════════════════════════════════════════════════════════
// ══  SYSTÈME D'ABONNEMENT ÉTABLISSEMENTS                     ══
// ══════════════════════════════════════════════════════════════

var SUBSCRIPTION_PLANS = {
  mensuel:     { label:"Mensuel",     icon:"📅", montant:5000,  dureeJours:30,   dureeLabel:"1 mois",   saving:"" },
  trimestriel: { label:"Trimestriel", icon:"📆", montant:12000, dureeJours:90,   dureeLabel:"3 mois",  saving:"Économisez 3 000 XAF" },
  annuel:      { label:"Annuel",      icon:"🗓️", montant:40000, dureeJours:365,  dureeLabel:"1 an",    saving:"Économisez 20 000 XAF" }
};

function selectSubPlan(plan, cardEl){
  var plans = SUBSCRIPTION_PLANS;
  if(!plans[plan]) return;
  // Update card visuals
  document.querySelectorAll(".sub-plan-card").forEach(function(c){ c.classList.remove("active"); });
  if(cardEl) cardEl.classList.add("active");
  // Update hidden inputs
  var typeInput = document.getElementById("abonnementTypeInput");
  var montantInput = document.getElementById("abonnementMontantInput");
  if(typeInput) typeInput.value = plan;
  if(montantInput) montantInput.value = plans[plan].montant;
  // Update summary
  var p = plans[plan];
  var nameEl = document.getElementById("subSummaryName");
  var durEl  = document.getElementById("subSummaryDuration");
  var priceEl= document.getElementById("subSummaryPrice");
  var echEl  = document.getElementById("subSummaryEcheance");
  if(nameEl) nameEl.textContent = p.icon+" Abonnement "+p.label;
  if(durEl)  durEl.textContent  = "Valable "+p.dureeLabel+" · Renouvelable avant échéance";
  if(priceEl) priceEl.innerHTML = p.montant.toLocaleString("fr-FR")+" <span style='font-size:0.78rem;color:var(--muted);'>XAF</span>";
  if(echEl)  echEl.textContent  = "📅 Échéance estimée : "+p.dureeLabel+" après activation";
  // Notify amount change for the banner too
  var inscBannerBtn = document.querySelector(".inscrire-big-btn");
  // don't update banner — it opens modal
}
window.selectSubPlan = selectSubPlan;

// ── Calcul date d'échéance ─────────────────────────────────────
function computeEcheance(plan, startTs){
  var p = SUBSCRIPTION_PLANS[plan];
  if(!p) return null;
  var start = startTs ? new Date(startTs) : new Date();
  return new Date(start.getTime() + p.dureeJours * 86400000);
}

// ── Vérifier statut abonnement d'un établissement ─────────────
function getSubscriptionStatus(etab){
  if(!etab) return "aucun";
  var type      = etab.abonnement_type || "mensuel";
  var activatedAt = etab.abonnement_activated_at || etab.timestamp || Date.now();
  var echeance  = computeEcheance(type, activatedAt);
  if(!echeance) return "aucun";
  var now = Date.now();
  var msLeft = echeance.getTime() - now;
  var daysLeft = Math.ceil(msLeft / 86400000);
  if(daysLeft <= 0)  return "expire";
  if(daysLeft <= 7)  return "critique";  // < 7j
  if(daysLeft <= 14) return "alerte";    // < 14j
  return "actif";
}

function getDaysLeft(etab){
  var type = etab.abonnement_type || "mensuel";
  var activatedAt = etab.abonnement_activated_at || etab.timestamp || Date.now();
  var echeance = computeEcheance(type, activatedAt);
  if(!echeance) return null;
  return Math.ceil((echeance.getTime() - Date.now()) / 86400000);
}

function getEcheanceStr(etab){
  var type = etab.abonnement_type || "mensuel";
  var activatedAt = etab.abonnement_activated_at || etab.timestamp || Date.now();
  var echeance = computeEcheance(type, activatedAt);
  if(!echeance) return "—";
  return echeance.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
}

// ── Vérification automatique et notifications ─────────────────
function checkSubscriptionRenewals(){
  if(!window.db || !isAdmin) return;
  var now = Date.now();
  etablissements.forEach(function(etab){
    if(!etab.paiement || etab.paiement.indexOf("Actif") === -1) return;
    var status = getSubscriptionStatus(etab);
    var daysLeft = getDaysLeft(etab);
    if(daysLeft === null) return;
    // Notifications d'avertissement
    if(status === "expire"){
      pushNotif({targetRole:"admin",key:"sub_expire_"+etab.id,icon:"🔴",title:"Abonnement EXPIRÉ — "+etab.nom,msg:"L'abonnement de "+etab.nom+" a expiré. Renouvellement en attente.",channel:"push"});
    } else if(status === "critique"){
      pushNotif({targetRole:"admin",key:"sub_critique_"+etab.id+"_d"+daysLeft,icon:"⚠️",title:"⚠️ Échéance dans "+daysLeft+"j — "+etab.nom,msg:"Rappel urgent : l'abonnement expire dans "+daysLeft+" jour(s). Contacter l'établissement.",channel:"push"});
    } else if(status === "alerte" && daysLeft === 14){
      pushNotif({targetRole:"admin",key:"sub_alerte14_"+etab.id,icon:"🔔",title:"Rappel abonnement — "+etab.nom,msg:"L'abonnement expire dans 14 jours ("+getEcheanceStr(etab)+").",channel:"push"});
    }
  });
}

// PERF: vérifications abonnements — aucun timer créé pour les non-admins
// Démarrage différé uniquement si admin actif ; relancé aussi à l'activation admin via ambi:authStateChanged
var _subRenewalInterval = null;
function _startSubRenewalTimer(){
  if(_subRenewalInterval) return; // déjà actif
  checkSubscriptionRenewals();
  _subRenewalInterval = setInterval(checkSubscriptionRenewals, 3600000);
}
setTimeout(function(){
  if(isAdmin) _startSubRenewalTimer();
}, 8000);
document.addEventListener('ambi:authStateChanged', function(){
  if(isAdmin) _startSubRenewalTimer();
});

// ── Notification établissement : rappel renouvellement ────────
function notifyEtablissementRenewal(etab){
  var status = getSubscriptionStatus(etab);
  var daysLeft = getDaysLeft(etab);
  if(status === "expire"){
    pushNotif({targetRole:"etablissement",key:"my_sub_expire",icon:"🔴",title:"Votre abonnement est expiré !",msg:"Votre fiche n'est plus visible. Renouvelez votre abonnement pour rester sur AMBI241.",channel:"push"});
  } else if(status === "critique"){
    pushNotif({targetRole:"etablissement",key:"my_sub_critique",icon:"⚠️",title:"Abonnement expire dans "+daysLeft+"j !",msg:"Procédez au renouvellement avant le "+getEcheanceStr(etab)+" pour maintenir votre visibilité.",channel:"push"});
  } else if(status === "alerte"){
    pushNotif({targetRole:"etablissement",key:"my_sub_alerte",icon:"🔔",title:"Rappel renouvellement — "+daysLeft+" jours",msg:"Votre abonnement expire le "+getEcheanceStr(etab)+". Renouvelez dès maintenant.",channel:"push"});
  }
}
window.notifyEtablissementRenewal = notifyEtablissementRenewal;

// ── Badge de statut abonnement ─────────────────────────────────
function renderSubStatusBadge(etab){
  var status = getSubscriptionStatus(etab);
  var daysLeft = getDaysLeft(etab);
  var plan = SUBSCRIPTION_PLANS[etab.abonnement_type] || SUBSCRIPTION_PLANS["mensuel"];
  if(status === "expire"){
    return "<span class='sub-status-badge ssb-expire'>🔴 Expiré</span>";
  } else if(status === "critique"){
    return "<span class='sub-status-badge ssb-alerte'>⚠️ "+daysLeft+"j restants</span>";
  } else if(status === "alerte"){
    return "<span class='sub-status-badge ssb-alerte'>🔔 "+daysLeft+"j restants</span>";
  } else if(status === "actif"){
    return "<span class='sub-status-badge ssb-actif'>✅ Actif · "+plan.label+"</span>";
  }
  return "<span class='sub-status-badge ssb-attente'>⏳ En attente</span>";
}
window.renderSubStatusBadge = renderSubStatusBadge;

// ── Horloge numérique compte à rebours ─────────────────────────
function _startCountdown(elId, echeanceTs){
  function _tick(){
    var el = document.getElementById(elId);
    if(!el) return;
    var diff = echeanceTs - Date.now();
    if(diff <= 0){
      el.innerHTML = "<span style='color:var(--red);'>EXPIRÉ</span>";
      return;
    }
    var d = Math.floor(diff / 86400000);
    var h = Math.floor((diff % 86400000) / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    el.innerHTML = (d > 0 ? "<span style='color:var(--amber);font-size:0.9em;'>"+d+"j</span> " : "")
      + String(h).padStart(2,"0")
      + "<span style='opacity:0.5;'>:</span>"
      + String(m).padStart(2,"0")
      + "<span style='opacity:0.5;'>:</span>"
      + String(s).padStart(2,"0");
    setTimeout(_tick, 1000);
  }
  setTimeout(_tick, 0);
}
function _initCountdownElements(){
  document.querySelectorAll('.ambi-countdown[data-ts]').forEach(function(el){
    if(el.id && !el.getAttribute('data-started')){
      el.setAttribute('data-started','1');
      _startCountdown(el.id, parseInt(el.getAttribute('data-ts'),10));
    }
  });
}
window._startCountdown = _startCountdown;
window._initCountdownElements = _initCountdownElements;

// ── Renouvellement admin depuis le dashboard ───────────────────
window.renewSubscription = function(etabId, plan){
  if(!isAdmin){ showToast("Accès admin requis"); return; }
  var etab = etablissements.find(function(e){ return String(e.id) === String(etabId); });
  if(!etab){ showToast("Établissement introuvable"); return; }
  var p = SUBSCRIPTION_PLANS[plan];
  if(!p){ showToast("Formule invalide"); return; }
  var now = Date.now();
  var nowIso = new Date().toISOString();
  // Si déjà actif, repart de la date d'échéance actuelle pour ne pas perdre de jours
  var daysLeft = getDaysLeft(etab);
  var baseTs = (daysLeft && daysLeft > 0) ? (Date.now() + daysLeft*86400000) : now;
  var updateData = {
    abonnement_type: plan,
    abonnement_activated_at: now,
    abonnement_echeance: computeEcheance(plan, now).toISOString(),
    paiement: "Actif — "+p.label
  };
  if(window.db && window.fbDoc && window.fbUpdateDoc){
    window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", String(etabId)), updateData)
      .then(function(){
        etab.abonnement_type = plan;
        etab.abonnement_activated_at = now;
        etab.abonnement_echeance = updateData.abonnement_echeance;
        etab.paiement = updateData.paiement;
        showToast("✅ Abonnement "+p.label+" activé pour "+etab.nom);
        renderAdmPayments();
        pushNotif({targetRole:"admin",key:"sub_renewed_"+etabId,icon:"✅",title:"Abonnement renouvelé — "+etab.nom,msg:p.label+" activé. Échéance : "+getEcheanceStr(etab),channel:"push"});
      }).catch(function(err){ showToast("Erreur : "+err.message); });
  } else {
    showToast("Firebase non disponible");
  }
};

// ══════════════════════════════════════════════════════════════
// ── SOUMISSION FORMULAIRE ÉTABLISSEMENT (Firebase + WhatsApp) ──
function submitEtablissement(event){
  if(event) event.preventDefault();
  var form = document.getElementById("etablForm");
  var btn  = document.getElementById("etablSubmitBtn");
  var msg  = document.getElementById("etablMsg");

  // ── HONEYPOT ANTI-BOT ──
  var hpot = document.getElementById("_hp_website");
  if(hpot && hpot.value){ return; } // Bot détecté → ignorer silencieusement

  // Récupérer les valeurs
  var nom       = (form.querySelector("[name=nom_etablissement]").value||"").trim();
  var type      = (form.querySelector("[name=type]").value||"").trim();
  var quartier  = (form.querySelector("[name=quartier]").value||"").trim();
  var desc      = (form.querySelector("[name=description]").value||"").trim();
  var gerant    = (form.querySelector("[name=gerant_nom]").value||"").trim();
  var tel       = (form.querySelector("[name=telephone]").value||"").trim();
  var email     = (form.querySelector("[name=email]").value||"").trim();
  var ouv       = (form.querySelector("[name=ouverture]").value||"18h00").trim();
  var ferm      = (form.querySelector("[name=fermeture]").value||"02h00").trim();
  var modePay   = (form.querySelector("[name=mode_paiement]").value||"").trim();
  var transaction=(form.querySelector("[name=transaction]").value||"").trim();
  var abonnementType   = (document.getElementById("abonnementTypeInput") ? document.getElementById("abonnementTypeInput").value : "mensuel");
  var abonnementMontant= (document.getElementById("abonnementMontantInput") ? parseInt(document.getElementById("abonnementMontantInput").value)||5000 : 5000);
  var subPlan = SUBSCRIPTION_PLANS[abonnementType] || SUBSCRIPTION_PLANS["mensuel"];
  var consent   = document.getElementById("etablConsent").checked;
  var lat       = document.getElementById("latInput").value;
  var lng       = document.getElementById("lngInput").value;
  var mapsUrl   = document.getElementById("mapsUrlInput").value;

  // ── NOUVEAUX CHAMPS : Capacité & Ambiance ──
  var capaciteTotale = parseInt(form.querySelector("[name=capacite_totale]").value)||0;
  var nbVip          = parseInt(form.querySelector("[name=nb_vip]").value)||0;
  var nbChambres     = parseInt(form.querySelector("[name=nb_chambres]").value)||0;
  var ageClientele   = form.querySelector("[name=age_clientele]").value||"";
  var dressCode      = form.querySelector("[name=dress_code]").value||"";
  var genresChecked  = Array.from(form.querySelectorAll("[name=genres_musicaux]:checked")).map(function(c){return c.value;});

  // ── VALIDATION ANTI-FRAUDE RENFORCÉE ──
  var validErrors = [];
  // Nom : min 3 caractères, pas que des chiffres
  if(!nom || nom.length < 3) validErrors.push("Nom de l'établissement trop court (min 3 car.)");
  if(/^\d+$/.test(nom)) validErrors.push("Nom invalide (ne peut pas être uniquement des chiffres)");
  // Téléphone Gabon : 8 à 12 chiffres
  var telClean = tel.replace(/[\s\-\.\+]/g,"");
  if(!telClean || telClean.length < 8 || telClean.length > 12 || !/^\d+$/.test(telClean))
    validErrors.push("Numéro de téléphone invalide (format gabonais attendu)");
  // Transaction : min 4 caractères
  if(!transaction || transaction.length < 4) validErrors.push("Code de transaction invalide (min 4 car.)");
  // Quartier obligatoire
  if(!quartier || quartier.length < 2) validErrors.push("Quartier requis");
  // Type obligatoire
  if(!type) validErrors.push("Type d'établissement requis");
  // Gérant obligatoire
  if(!gerant || gerant.length < 2) validErrors.push("Nom du gérant requis");
  // Mode paiement obligatoire
  if(!modePay) validErrors.push("Mode de paiement requis");
  // Consentement
  if(!consent) validErrors.push("Vous devez certifier l'exactitude des informations");
  // Anti-flood : 1 demande toutes les 2h par appareil
  var lastDemande = parseInt(lsGet("ambi241_last_demande")||"0");
  var FLOOD_CD = 2 * 3600 * 1000;
  if(lastDemande && (Date.now()-lastDemande) < FLOOD_CD){
    var hLeft = Math.ceil((FLOOD_CD-(Date.now()-lastDemande))/3600000);
    validErrors.push("Demande déjà envoyée — réessayez dans ~"+hLeft+"h");
  }

  if(validErrors.length > 0){
    msg.style.display="block"; msg.style.color="var(--red)";
    msg.innerHTML = "⚠️ "+validErrors.join("<br>⚠️ ");
    return;
  }

  // Enregistrer timestamp anti-flood
  lsSet("ambi241_last_demande", String(Date.now()));

  btn.disabled=true; btn.textContent="Envoi en cours...";

  // Données à stocker dans Firebase
  var demande = {
    nom_etablissement: nom,
    type: type,
    quartier: quartier,
    description: desc,
    gerant_nom: gerant,
    telephone: tel,
    email: email,
    ouverture: ouv,
    fermeture: ferm,
    mode_paiement: modePay,
    transaction: transaction,
    abonnement_type: abonnementType,
    abonnement_montant: abonnementMontant,
    abonnement_duree: subPlan.dureeLabel,
    latitude: lat||"",
    longitude: lng||"",
    maps_url: mapsUrl||"",
    // ── Capacité & Ambiance ──
    capacite_totale: capaciteTotale||0,
    nb_vip: nbVip||0,
    nb_chambres: nbChambres||0,
    age_clientele: ageClientele,
    dress_code: dressCode,
    genres_musicaux: genresChecked,
    statut_demande: "En attente",
    createdAt: new Date().toISOString(),
    timestamp: Date.now()
  };

  function onSuccess(){
    btn.disabled=false; btn.textContent="🚀 Envoyer ma demande";
    msg.style.display="block"; msg.style.color="var(--green)";
    msg.innerHTML="✅ Demande envoyée ! Nous reviendrons vers vous dans les 24h.<br><small style='color:var(--muted)'>Contactez-nous : ambi2412026@gmail.com</small>";
    // Notification WhatsApp admin
    var waMsg = encodeURIComponent(
      "🏠 NOUVELLE DEMANDE AMBI241\n\n"+
      "📌 Établissement : "+nom+"\n"+
      "🎭 Type : "+type+"\n"+
      "📍 Quartier : "+quartier+"\n"+
      "👤 Gérant : "+gerant+"\n"+
      "📞 Tél : "+tel+"\n"+
      (email?"✉ Email : "+email+"\n":"")+
      "💳 Paiement : "+modePay+"\n"+
      "🔑 Transaction : "+transaction+"\n"+
      "📅 Abonnement : "+subPlan.label+" — "+subPlan.montant.toLocaleString("fr-FR")+" XAF ("+subPlan.dureeLabel+")\n"+
      (lat?"📡 GPS : "+lat+","+lng+"\n":"")+
      "\nÀ valider dans le tableau de bord AMBI241."
    );
    setTimeout(function(){ window.open("https://wa.me/24174450924?text="+waMsg,"_blank"); },800);
    // Reset form après 3s
    setTimeout(function(){
      form.reset();
      document.getElementById("etablModal").classList.remove("show");
      msg.style.display="none";
    },4000);
    // Ajouter notif interne admin
    pushNotif({targetRole:"admin",key:"new_demande",icon:"🏠",title:"Nouvelle demande — "+nom,msg:type+" à "+quartier+". "+subPlan.label+" ("+subPlan.montant.toLocaleString("fr-FR")+" XAF). Txn: "+transaction,channel:"push",fromAdmin:false});
  }

  function onError(errMsg){
    btn.disabled=false; btn.textContent="🚀 Envoyer ma demande";
    msg.style.display="block"; msg.style.color="var(--red)";
    msg.textContent="Erreur d'envoi. Contactez-nous sur WhatsApp ou email. ("+errMsg+")";
    // Fallback WhatsApp direct
    var waMsg = encodeURIComponent(
      "🏠 DEMANDE INSCRIPTION AMBI241\n"+
      "Établissement : "+nom+" ("+type+")\n"+
      "Quartier : "+quartier+"\n"+
      "Gérant : "+gerant+" - "+tel+"\n"+
      "Paiement : "+modePay+" | Txn: "+transaction
    );
    setTimeout(function(){ window.open("https://wa.me/24174450924?text="+waMsg,"_blank"); },500);
  }

  // Sauvegarder dans Firebase (collection "demandes")
  if(window.db && typeof window.fbAddDoc==="function" && typeof window.fbCollection==="function"){
    window.fbAddDoc(window.fbCollection(window.db,"demandes"), demande)
      .then(onSuccess)
      .catch(function(err){ onError(err.message); });
  } else {
    // Firebase pas dispo → envoi WhatsApp direct
    onSuccess();
  }
}
window.submitEtablissement = submitEtablissement;

// ── ADMIN AJOUT ETABLISSEMENT GRATUIT ────────────────────────
function openAdminAddModal(){
  if(!isAdmin){showToast("Acces admin requis");return;}
  document.getElementById("adminAddFirebase").style.display="block";
  document.getElementById("adminAddOverlay").classList.add("show");
}
function closeAdminAddModal(){
  document.getElementById("adminAddOverlay").classList.remove("show");
}
// Aperçu photo dans le formulaire admin ajout
function aaPreviewPhoto(input, previewDivId, nameSpanId) {
  var file = input.files && input.files[0];
  var nameEl = document.getElementById(nameSpanId);
  var previewDiv = document.getElementById(previewDivId);
  if (!file) { if(nameEl) nameEl.textContent = "Aucun fichier"; if(previewDiv) previewDiv.style.display="none"; return; }
  if (nameEl) nameEl.textContent = file.name.length > 28 ? file.name.substring(0,25)+"..." : file.name;
  if (previewDiv) {
    var img = previewDiv.querySelector("img");
    var reader = new FileReader();
    reader.onload = function(ev){ if(img){ img.src = ev.target.result; previewDiv.style.display="block"; } };
    reader.readAsDataURL(file);
  }
}
window.aaPreviewPhoto = aaPreviewPhoto;

// Upload une image vers Firebase Storage et retourne l'URL, ou "" si pas de fichier
function aaUploadPhotoIfNeeded(fileInputId, storagePath) {
  return new Promise(function(resolve) {
    var inp = document.getElementById(fileInputId);
    var file = inp && inp.files && inp.files[0];
    if (!file) { resolve(""); return; }
    if (!window.fbRef || !window.fbStorage || !window.fbUploadBytes || !window.fbGetDownloadURL) { resolve(""); return; }
    // Compresser via canvas (max 800px)
    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var maxDim = 800;
        var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          var ratio = Math.min(maxDim/w, maxDim/h);
          w = Math.round(w*ratio); h = Math.round(h*ratio);
        }
        var canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) {
          var storRef = window.fbRef(window.fbStorage, storagePath);
          window.fbUploadBytes(storRef, blob).then(function(){
            return window.fbGetDownloadURL(storRef);
          }).then(function(url){ resolve(url); }).catch(function(){ resolve(""); });
        }, "image/jpeg", 0.85);
      };
      img.onerror = function(){ resolve(""); };
      img.src = ev.target.result;
    };
    reader.onerror = function(){ resolve(""); };
    reader.readAsDataURL(file);
  });
}

function adminAddFirebase(){
  var nom = document.getElementById("aaNom").value.trim();
  var type = document.getElementById("aaType").value;
  var quartier = document.getElementById("aaQuartier").value.trim();
  var msg = document.getElementById("aaFirebaseMsg");
  if(!nom||!type||!quartier){
    msg.style.display="block";msg.style.color="var(--red)";
    msg.textContent="Veuillez remplir les champs obligatoires (nom, type, quartier).";return;
  }
  var btn=document.getElementById("aaFirebaseBtn");
  var statusEl = document.getElementById("aaPhotoUploadStatus");
  btn.disabled=true;btn.textContent="Ajout en cours...";
  // Générer un nouvel ID (max id + 1)
  var maxId = etablissements.reduce(function(m,e){return Math.max(m,e.id||0);},0);
  var newId = maxId + 1;
  var docId = "etab_" + String(newId).padStart(3,"0");

  // Upload photos si sélectionnées
  var hasInt = document.getElementById("aaPhotoIntFile") && document.getElementById("aaPhotoIntFile").files && document.getElementById("aaPhotoIntFile").files[0];
  var hasExt = document.getElementById("aaPhotoExtFile") && document.getElementById("aaPhotoExtFile").files && document.getElementById("aaPhotoExtFile").files[0];
  if ((hasInt || hasExt) && statusEl) { statusEl.style.display="block"; statusEl.textContent="⏳ Upload des photos..."; }

  Promise.all([
    aaUploadPhotoIfNeeded("aaPhotoIntFile", "etablissements/"+docId+"/photo_interieur.jpg"),
    aaUploadPhotoIfNeeded("aaPhotoExtFile", "etablissements/"+docId+"/photo_exterieur.jpg")
  ]).then(function(urls) {
    if (statusEl) { statusEl.style.display="none"; }
    var newEtab = {
      id: newId,
      nom: nom,
      type: type,
      quartier: quartier,
      description: document.getElementById("aaDesc").value.trim(),
      contact: document.getElementById("aaTel").value.trim(),
      email: document.getElementById("aaEmail").value.trim(),
      ouverture: document.getElementById("aaOuv").value.trim()||"18h00",
      fermeture: document.getElementById("aaFerm").value.trim()||"02h00",
      statut: document.getElementById("aaStatut").value,
      affluence: parseInt(document.getElementById("aaAff").value)||50,
      note: 0, avis: 0, paiement: "Actif (Admin)",
      ambiance: "Festif", maps_url: "",
      photo_interieur: urls[0]||"",
      photo_exterieur: urls[1]||"",
      // ── Capacité & Ambiance ──
      capacite_totale: parseInt((document.getElementById("aaCapacite")||{}).value)||0,
      nb_vip: parseInt((document.getElementById("aaNbVip")||{}).value)||0,
      nb_chambres: parseInt((document.getElementById("aaNbChambres")||{}).value)||0,
      age_clientele: (document.getElementById("aaAge")||{}).value||"",
      genres_musicaux: Array.from(document.querySelectorAll(".aaGenre:checked")).map(function(c){return c.value;}),
      places_dispo: 0,
      musique_soir: "",
      affluence_tendance: "Stable"
    };
    var docRef = window.fbDoc(window.db, "etablissements", docId);
    return window.fbSetDoc(docRef, newEtab);
  }).then(function(){
    msg.style.display="block";msg.style.color="var(--green)";
    msg.textContent="✅ Établissement ajouté avec succès !";
    btn.disabled=false;btn.textContent="⚡ Ajouter maintenant";
    // Reset champs
    ["aaNom","aaDesc","aaTel","aaEmail","aaOuv","aaFerm"].forEach(function(id){
      var el=document.getElementById(id); if(el)el.value="";
    });
    document.getElementById("aaAff").value="50";
    // Reset photos
    ["aaPhotoIntFile","aaPhotoExtFile"].forEach(function(id){ var el=document.getElementById(id); if(el) el.value=""; });
    ["aaPreviewInt","aaPreviewExt"].forEach(function(id){ var el=document.getElementById(id); if(el) el.style.display="none"; });
    ["aaPhotoIntName","aaPhotoExtName"].forEach(function(id){ var el=document.getElementById(id); if(el) el.textContent="Aucun fichier"; });
    loadData();
    setTimeout(function(){closeAdminAddModal();},1500);
  }).catch(function(err){
    btn.disabled=false;btn.textContent="⚡ Ajouter maintenant";
    if (statusEl) statusEl.style.display="none";
    msg.style.display="block";msg.style.color="var(--red)";
    msg.textContent="Erreur: "+err.message;
  });
}
function deleteEtablissement(id){
  var etab=etablissements.find(function(x){return x.id===id;});
  if(!etab){showToast("Établissement introuvable");return;}
  if(!isAdmin && !canEditPhotos(etab)){showToast("Accès refusé");return;}
  if(!confirm("Supprimer définitivement \""+etab.nom+"\" ? Cette action est irréversible.")){return;}
  // Si pas de _docId : suppression locale uniquement (pas encore dans Firebase)
  if(!etab._docId){
    etablissements=etablissements.filter(function(x){return x.id!==id;});
    renderStats();renderAll();renderHome();if(_currentAdmTab==="etabl")renderAdmEtabl();
    showToast("✅ Supprimé localement");return;
  }
  var docRef=window.fbDoc(window.db,"etablissements",etab._docId);
  if(window.fbDeleteDoc){
    showToast("Suppression en cours...");
    window.fbDeleteDoc(docRef).then(function(){
      etablissements=etablissements.filter(function(x){return x.id!==id;});
      renderStats();renderAll();renderHome();if(_currentAdmTab==="etabl")renderAdmEtabl();
      showToast("✅ Établissement supprimé !");
    }).catch(function(err){
      showToast("Erreur suppression: "+err.message);
    });
  } else {
    showToast("Suppression Firebase non disponible");
  }
}
window.deleteEtablissement=deleteEtablissement;

/* ── RÉINITIALISATION MOT DE PASSE ÉTABLISSEMENT ── */
function resetEstabPassword(id, name){
  var etab = etablissements.find(function(x){ return x.id === id; });
  if(!etab)  { showToast("Établissement introuvable"); return; }
  if(!isAdmin){ showToast("Accès refusé - Admin requis"); return; }
  if(!etab.email){ showToast("❌ Pas d'email configuré pour cet établissement"); return; }

  if(!confirm(
    "🔑 RÉINITIALISATION — " + name + "\n" +
    "Email : " + etab.email + "\n\n" +
    "Firebase va envoyer un lien de réinitialisation à cet email.\n" +
    "Le gérant choisira lui-même son nouveau mot de passe.\nConfirmer ?"
  )) return;

  if(!window.fbSendPasswordResetEmail || !window.auth){
    showToast("❌ Firebase Auth non disponible"); return;
  }

  showToast("⏳ Envoi du lien en cours…");
  window.fbSendPasswordResetEmail(window.auth, etab.email).then(function(){
    showToast("✅ Lien de réinitialisation envoyé à " + etab.email);
    // Traçabilité Firestore — sans stocker de mot de passe
    if(etab._docId && window.db && window.fbDoc && window.fbUpdateDoc){
      window.fbUpdateDoc(window.fbDoc(window.db, "etablissements", etab._docId), {
        password_reset_date:     new Date().toISOString(),
        password_reset_by_admin: true
        // ⚠️ Le champ "password" n'est JAMAIS écrit ici — Firebase Auth gère le mot de passe
      }).catch(function(){});
    }
    addAdminLog("🔑 Lien reset envoyé — " + name + " (" + etab.email + ")", "reset_etab_pwd");
  }).catch(function(err){
    if(err.code === "auth/user-not-found" || err.code === "auth/invalid-credential"){
      showToast("⚠️ Aucun compte Firebase Auth pour " + etab.email + ". Le gérant doit s'inscrire d'abord.");
    } else if(err.code === "auth/too-many-requests"){
      showToast("⚠️ Trop de tentatives. Réessayez dans quelques minutes.");
    } else if(err.code === "auth/invalid-email"){
      showToast("❌ Email invalide : " + etab.email);
    } else {
      showToast("❌ Erreur : " + err.message);
    }
  });
}
window.resetEstabPassword = resetEstabPassword;

// ── Réinitialisation MDP Membre (SuperAdmin) ──────────────────
// DEFAULT_MEMBER_PWD supprimé — plus de mot de passe par défaut (sécurité)

function resetMemberPassword(uid, email, pseudo, fromTicketId){
  if(!isAdmin){ showToast("Accès refusé - Admin requis"); return; }
  if(!email){ showToast("Email membre introuvable"); return; }

  if(!confirm(
    "🔑 RÉINITIALISATION — " + pseudo + "\n" +
    "Email : " + email + "\n\n" +
    "Un email de réinitialisation sera envoyé à l'utilisateur.\nConfirmer ?"
  )) return;

  if(!window.fbSendPasswordResetEmail || !window.auth){
    showToast("Firebase non disponible"); return;
  }
  showToast("⏳ Envoi en cours...");
  window.fbSendPasswordResetEmail(window.auth, email).then(function(){
    showToast("✅ Email de réinitialisation envoyé à " + email);
    addAdminLog("🔑 Email reset envoyé — " + pseudo + " (" + email + ")", "reset_member_pwd");
    // Traçabilité Firestore (sans stocker le mot de passe)
    if(window.db && window.fbDoc && window.fbUpdateDoc && uid){
      window.fbUpdateDoc(window.fbDoc(window.db, "users", uid), {
        password_reset_date: new Date().toISOString(),
        password_reset_by_admin: true,
        must_change_password: true
      }).catch(function(){});
    }
    if(fromTicketId){
      _supportResolveTicket(fromTicketId, email, pseudo, "(lien envoyé par email)");
    } else {
      _supportAutoLog(uid, email, pseudo, "(lien envoyé par email)");
    }
    if(_currentAdmTab === "users") renderAdmUsers();
    if(_currentAdmTab === "support") renderAdmSupport();
  }).catch(function(err){
    if(err.code === "auth/user-not-found"){
      showToast("❌ Aucun compte Firebase pour cet email. L'utilisateur doit s'inscrire.");
    } else {
      showToast("Erreur: " + err.message);
    }
  });
}
window.resetMemberPassword = resetMemberPassword;

// ── Crée un log automatique de réinitialisation (sans ticket préalable) ──
function _supportAutoLog(uid, email, pseudo, newPwd){
  if(!window.db || !window.fbCollection || !window.fbAddDoc) return;
  var col = window.fbCollection(window.db, "support_requests");
  var now = new Date().toISOString();
  window.fbAddDoc(col, {
    uid: uid, email: email, pseudo: pseudo,
    type: "reset_password", status: "resolved",
    createdAt: now, resolvedAt: now,
    messages: [
      { from:"admin", text:"Réinitialisation effectuée par le Super Admin. Nouveau mot de passe : " + newPwd + "\nVeuillez vous connecter et modifier votre mot de passe dès que possible.", ts: now }
    ]
  }).catch(function(){});
}

// ── Résoudre un ticket support + notifier le membre ──
function _supportResolveTicket(ticketId, email, pseudo, newPwd){
  if(!window.db || !window.fbDoc || !window.fbUpdateDoc) return;
  var docRef = window.fbDoc(window.db, "support_requests", ticketId);
  var now = new Date().toISOString();
  // On ne peut pas append dans un array via updateDoc simple, on relit d'abord
  window.fbGetDoc && window.fbGetDoc(docRef).then(function(snap){
    var data = snap.exists() ? snap.data() : {};
    var msgs = data.messages || [];
    msgs.push({
      from:"admin",
      text:"✅ Votre mot de passe a été réinitialisé.\n\n🔑 Nouveau mot de passe : " + newPwd + "\n\nConnectez-vous avec ce mot de passe puis modifiez-le immédiatement dans votre profil.",
      ts: now
    });
    window.fbUpdateDoc(docRef, {
      status: "resolved",
      resolvedAt: now,
      messages: msgs
    }).then(function(){
      showToast("✅ Ticket résolu — " + pseudo + " notifié");
      if(_currentAdmTab === "support") renderAdmSupport();
    }).catch(function(err){ showToast("Err ticket: " + err.message); });
  }).catch(function(){
    // Fallback si fbGetDoc absent
    window.fbUpdateDoc(docRef, {
      status: "resolved",
      resolvedAt: now
    }).catch(function(){});
  });
}
window._supportResolveTicket = _supportResolveTicket;

// ── Membre : soumettre une demande de support ─────────────────
function memberSubmitSupportRequest(type, message){
  if(!window.currentUserUid && !window.auth){ showToast("Connectez-vous d'abord"); return; }
  var uid   = window.currentUserUid || (window.auth && window.auth.currentUser && window.auth.currentUser.uid) || "";
  var email = window.currentUserEmail || "";
  var pseudo= (document.getElementById("myProfilePseudo") && document.getElementById("myProfilePseudo").textContent) || email;
  if(!uid){ showToast("Session expirée, reconnectez-vous"); return; }
  if(!window.db || !window.fbAddDoc || !window.fbCollection){ showToast("Connexion Firebase requise"); return; }
  var now = new Date().toISOString();
  var col = window.fbCollection(window.db, "support_requests");
  var msg = message || "Demande de réinitialisation de mot de passe";
  showToast("⏳ Envoi de votre demande...");
  window.fbAddDoc(col, {
    uid: uid, email: email, pseudo: pseudo,
    type: type || "reset_password", status: "open",
    createdAt: now,
    messages:[{ from:"user", text: msg, ts: now }]
  }).then(function(){
    showToast("✅ Demande envoyée ! L'admin vous répondra bientôt.");
    closeSupportRequestModal();
    // Marquer badge support dans le profil
    var badge = document.getElementById("memberSupportBadge");
    if(badge) badge.style.display = "none"; // masquer le bouton d'envoi après envoi
  }).catch(function(err){
    showToast("Erreur: " + err.message);
  });
}
window.memberSubmitSupportRequest = memberSubmitSupportRequest;

function openSupportRequestModal(prefillType){
  var existingModal = document.getElementById("supportRequestModal");
  if(existingModal) existingModal.remove();
  var overlay = document.createElement("div");
  overlay.id = "supportRequestModal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;";
  overlay.innerHTML = `
    <div style="background:var(--surface);border:1px solid rgba(255,45,155,0.35);border-radius:20px;padding:1.4rem;width:min(400px,100%);position:relative;max-height:90vh;overflow-y:auto;">
      <button onclick="closeSupportRequestModal()" style="position:absolute;top:0.7rem;right:0.7rem;background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.3);color:var(--red);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">✕</button>
      <div style="font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:1rem;margin-bottom:0.3rem;">💬 Contacter le Support</div>
      <div style="font-size:0.73rem;color:var(--muted);margin-bottom:1.1rem;line-height:1.5;">Un administrateur traitera votre demande et vous répondra dans les meilleurs délais.</div>
      <div style="margin-bottom:0.8rem;">
        <label style="font-size:0.72rem;color:var(--muted);display:block;margin-bottom:0.35rem;">Type de demande</label>
        <select id="supportReqType" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.25);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.82rem;">
          <option value="reset_password" ${prefillType==="reset_password"?"selected":""}>🔑 Réinitialisation de mot de passe</option>
          <option value="compte_bloque">🔒 Compte bloqué / accès refusé</option>
          <option value="info_compte">ℹ️ Information sur mon compte</option>
          <option value="suppression">🗑️ Demande de suppression de compte</option>
          <option value="autre">📩 Autre demande</option>
        </select>
      </div>
      <div style="margin-bottom:1rem;">
        <label style="font-size:0.72rem;color:var(--muted);display:block;margin-bottom:0.35rem;">Message (optionnel)</label>
        <textarea id="supportReqMsg" placeholder="Décrivez votre problème..." maxlength="400" style="width:100%;background:var(--surface2);border:1px solid rgba(255,255,255,0.08);border-radius:8px;color:var(--text);padding:0.6rem;font-size:0.82rem;resize:vertical;min-height:80px;font-family:'DM Sans',sans-serif;"></textarea>
      </div>
      <div style="background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);border-radius:10px;padding:0.7rem;margin-bottom:1rem;font-size:0.72rem;color:var(--cyan);line-height:1.5;">
        ℹ️ Pour une réinitialisation de mot de passe, vous recevrez votre nouveau mot de passe temporaire via ce système. Pensez à le changer après connexion.
      </div>
      <button onclick="memberSubmitSupportRequest(document.getElementById('supportReqType').value, document.getElementById('supportReqMsg').value)" style="width:100%;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;">📤 Envoyer ma demande</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e){ if(e.target===overlay) closeSupportRequestModal(); });
}
window.openSupportRequestModal = openSupportRequestModal;

function closeSupportRequestModal(){
  var m = document.getElementById("supportRequestModal");
  if(m) m.remove();
}
window.closeSupportRequestModal = closeSupportRequestModal;

// ─────────────────────────────────────────────────────────────
// ── Démarre l'app (attend Firebase si pas encore prêt) ───────
window.__appReady = true;

var _startAppAttempts = 0;
function _startApp(){
  _startAppAttempts++;
  if(typeof window.fbGetDocs==="function" && typeof window.fbCollection==="function" && window.db){
    loadData();
  } else if(_startAppAttempts < 80){ // 80 * 100ms = 8s max
    setTimeout(_startApp, 100); // PERF: 100ms au lieu de 250ms — détecte Firebase 2.5x plus vite
  } else {
    // Firebase jamais prêt → afficher les données locales immédiatement
    var eb = document.getElementById("errorBanner");
    if(eb) eb.innerHTML = "";
    renderStats(); renderAll(); renderHome(); updateSyncTime();
  }
}
/* ── INSTANTANÉ PUBLIC (tous les établissements) ──────────────────
   Généré côté serveur (Cloud Function programmée, ~toutes les 2 min)
   et déposé dans Cloud Storage (accès public en lecture, avec en-tête
   Cache-Control pour profiter du cache HTTP navigateur/edge).
   Objectif : un tout premier visiteur (sans cache localStorage) voit
   la liste complète des lieux quasi instantanément — une seule requête
   HTTP vers un fichier statique, bien plus rapide qu'une requête
   Firestore complète (SDK + auth + parsing de 1017 documents).
   Les données Firestore live (loadData()) prennent ensuite le relais
   normalement et écrasent cet instantané dès qu'elles sont prêtes. ── */
var AMBI_SNAPSHOT_URL = "./data/etablissements-snapshot.json";
window.__ambiLiveDataLoaded = false; /* passe à true dans _renderAfterLoad() une fois Firestore chargé */

function _tryLoadPublicSnapshot(){
  if(typeof fetch !== "function") return;
  fetch(AMBI_SNAPSHOT_URL, { cache: "no-store" }).then(function(res){
    if(!res.ok) throw new Error("snapshot HTTP " + res.status);
    return res.json();
  }).then(function(payload){
    /* Si les données Firestore live sont arrivées entre-temps (plus
       fraîches par définition), on ne les écrase pas avec l'instantané. */
    if(window.__ambiLiveDataLoaded) return;
    var data = payload && payload.etablissements;
    if(!data || !data.length) return;
    etablissements = _processEtabData(data);
    if (typeof _gpsState !== "undefined" && _gpsState.active && _gpsState.lat !== null) {
      enrichWithDistances();
    }
    rebuildPaiements();
    etablissements.forEach(function(e){ applyDynamicStatus(e); });
    renderStats(); renderAll(); renderHome(); renderPayments();
  }).catch(function(){
    /* Silencieux : pas grave si l'instantané n'est pas encore généré
       (premier déploiement) ou injoignable — on retombe sur le spinner
       existant puis sur les données Firestore live normales. */
  });
}

// ── Démarrage : afficher le cache immédiatement si disponible, sinon skeleton ──
(function(){
  // PERF: tenter de charger le cache localStorage AVANT _startApp
  // Un utilisateur qui revient voit les données en <50ms au lieu d'attendre Firebase
  var _bootCache = null;
  try {
    var _raw = localStorage.getItem('ambi241_etab_cache_v4');
    if(_raw){
      var _obj = JSON.parse(_raw);
      // On accepte le cache même expiré au boot (Firebase le rafraîchira en arrière-plan)
      if(_obj && _obj.data && _obj.data.length > 0) _bootCache = _obj.data;
    }
  } catch(e){}

  if(_bootCache && _bootCache.length > 0){
    // Cache disponible → afficher immédiatement, sans attendre Firebase
    etablissements = _bootCache;
    rebuildPaiements();
    loadSuperAdmin();
    renderStats(); renderAll(); renderHome(); renderPayments();
  } else {
    // Première visite ou cache vide → spinner minimal
    etablissements = [];
    rebuildPaiements();
    loadSuperAdmin();
    var ml = document.getElementById("mainList");
    if(ml) ml.innerHTML = '<div style="text-align:center;padding:3rem 1rem;color:var(--muted);">'
      +'<div style="font-size:2rem;margin-bottom:0.8rem;">⏳</div>'
      +'<div style="font-family:Syne,sans-serif;font-weight:700;font-size:0.9rem;color:var(--cyan);">Chargement des lieux...</div>'
      +'<div style="font-size:0.72rem;margin-top:0.4rem;">Connexion à Firebase en cours</div>'
      +'</div>';
    renderStats(); renderHome(); renderPayments();
    /* PERF : pas de cache etablissements[] local → on affiche quand même
       les compteurs par type précalculés (cache local ou petit document
       Firestore "meta/typeCounts") au lieu de "0", pendant que les 1017
       documents se téléchargent en arrière-plan. */
    _renderTypeCountsInstant();
    /* PERF : et surtout, on charge l'instantané public (liste complète des
       lieux) pour un affichage quasi immédiat de tout l'écran d'accueil
       et de l'onglet Lieux, sans attendre la requête Firestore complète. */
    _tryLoadPublicSnapshot();
  }
})();
// PERF: initMeteo() supprimé ici — déjà appelé par le module Firebase via window.__appReady

_startApp();
updatePayVis();

// ══════════════════════════════════════════════════════════════
// ══ COLLECTE DE DONNÉES COMMUNAUTAIRES (Firebase)           ══
// ══ Affluence signalée · Votes persistants · Check-in        ══
// ══════════════════════════════════════════════════════════════

/* ── Identifiant anonyme persistant par navigateur ────────── */
function _getAnonId(){
  var k = "ambi241_anon_id";
  var id = localStorage.getItem(k);
  if(!id){ id = (Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0,16); localStorage.setItem(k,id); }
  return id;
}

/* ── Signaler l'affluence depuis la fiche établissement (version sécurisée) ─── */
/* Anti-spam : connexion requise + cooldown 5 min par établissement */
var _SIGNAL_COOLDOWN_MS = 5 * 60 * 1000;
window.signalerAffluence = function(etabId, niveau){
  // niveau : 'Calme' | 'Animé' | 'Bondé' | 'Fermé'
  // ── Vérification connexion ──
  if(!window.currentUserUID){
    showToast("🔒 Connectez-vous pour signaler l'affluence");
    if(typeof openUserModal === "function") openUserModal();
    return;
  }
  // ── Rate-limit 5 min ──
  var rlKey = "ambi241_scd_"+etabId;
  var lastSig = parseInt(lsGet(rlKey)||"0");
  var nowSig = Date.now();
  if(lastSig && (nowSig-lastSig) < _SIGNAL_COOLDOWN_MS){
    var remSig = Math.ceil((_SIGNAL_COOLDOWN_MS-(nowSig-lastSig))/60000);
    showToast("⏳ Signalement récent — réessayez dans "+remSig+" min");
    return;
  }
  lsSet(rlKey, String(nowSig));
  // ── Envoi Firebase ──
  if(!window.db || !window.fbAddDoc || !window.fbCollection){ showToast("Connexion requise"); return; }
  var uid = (window.currentUserUID || _getAnonId());
  window.fbAddDoc(window.fbCollection(window.db, "affluence_signalements"), {
    etablissement_id: String(etabId),
    niveau: niveau,
    signale_par: uid,
    created_at: window.fbServerTimestamp ? window.fbServerTimestamp() : new Date().toISOString()
  }).then(function(){
    showToast("✅ Affluence signalée : " + niveau);
    // Mise à jour locale immédiate pour UX fluide
    var etab = etablissements.find(function(e){ return String(e.id) === String(etabId); });
    if(etab){
      var map = {"Calme":25, "Animé":60, "Bondé":90, "Fermé":0};
      if(map[niveau] !== undefined) etab.affluence = map[niveau];
      applyDynamicStatus(etab);
      renderAll(); renderHome();
    }
  }).catch(function(err){ showToast("Erreur: " + err.message); });
};

/* ── Voter pour un établissement (persisté Firebase) ─────── */
window.voterEtablissement = function(etabId, type){
  // type: 'pos' | 'neg'
  if(!window.db || !window.fbSetDoc || !window.fbDoc){ showToast("Firebase non disponible"); return; }
  var uid = (window.currentUserUID || _getAnonId());
  // 1 vote par user par établissement (UNIQUE via docId = etabId_uid)
  var docId = String(etabId) + "_" + uid;
  window.fbSetDoc(window.fbDoc(window.db, "votes_communautaires", docId), {
    etablissement_id: String(etabId),
    user_id: uid,
    type: type,
    created_at: window.fbServerTimestamp ? window.fbServerTimestamp() : new Date().toISOString()
  }).then(function(){
    showToast(type === "pos" ? "👍 Vote positif enregistré !" : "👎 Vote enregistré");
  }).catch(function(err){ showToast("Erreur vote: " + err.message); });
};

/* ── Check-in / Présence (persisté Firebase) ─────────────── */
window.checkInFirebase = function(etabId){
  if(!window.db || !window.fbAddDoc || !window.fbCollection){ return; }
  var uid = (window.currentUserUID || _getAnonId());
  window.fbAddDoc(window.fbCollection(window.db, "presences"), {
    etablissement_id: String(etabId),
    user_id: uid,
    pseudo: window.currentUserPseudo || "Visiteur",
    created_at: window.fbServerTimestamp ? window.fbServerTimestamp() : new Date().toISOString()
  }).catch(function(){}); // silencieux
};

/* ── Charger les stats communautaires depuis Firebase ─────── */
window.loadStatsCommunautaires = function(etabId, callback){
  if(!window.db || !window.fbGetDocs || !window.fbCollection || !window.fbQuery || !window.fbWhere){ return; }
  var eid = String(etabId);
  Promise.all([
    // Votes
    window.fbGetDocs(window.fbQuery(
      window.fbCollection(window.db, "votes_communautaires"),
      window.fbWhere("etablissement_id","==",eid)
    )),
    // Présences du jour
    window.fbGetDocs(window.fbQuery(
      window.fbCollection(window.db, "presences"),
      window.fbWhere("etablissement_id","==",eid)
    )),
    // Dernier signalement affluence
    window.fbGetDocs(window.fbQuery(
      window.fbCollection(window.db, "affluence_signalements"),
      window.fbWhere("etablissement_id","==",eid)
    ))
  ]).then(function(results){
    var votesSnap = results[0], presSnap = results[1], affSnap = results[2];
    var pos=0, neg=0;
    votesSnap.forEach(function(d){ var v=d.data(); if(v.type==="pos")pos++; else neg++; });
    var presCount = presSnap.size;
    // Dernier signal affluence
    var lastAff = null;
    affSnap.forEach(function(d){ var v=d.data(); if(!lastAff || (v.created_at > lastAff.created_at)) lastAff=v; });
    if(callback) callback({ votes:{pos:pos,neg:neg}, presences:presCount, dernierSignal:lastAff?lastAff.niveau:null });
  }).catch(function(){});
};

/* ── Ajouter fbWhere si manquant (Firebase v9 modular) ────── */
(function waitFbWhere(){
  if(!window.fbWhere && window.firebase){
    try{ window.fbWhere = firebase.firestore ? null : null; }catch(e){}
  }
})();


// ── MODALES LÉGALES (CGU / Confidentialité) ──────────────────
var CGU_TEXT = "<div class='modal-title' style='margin-bottom:0.6rem'>&#128275; Conditions Générales d'Utilisation</div><div class='modal-sub' style='margin-bottom:1rem'>Dernière mise à jour : Avril 2026</div><div style='font-size:0.8rem;color:var(--muted);padding:0.8rem;border-left:2px solid var(--pink);margin-bottom:1rem;'><strong style='color:var(--text)'>Responsable :</strong> M. KOZANGUE ESSONO PATRICK BERTIN</div>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>1. Objet</strong><br>AMBI241 est un annuaire d'ambiance en temps réel des bars, restaurants et discotheques de Libreville, Gabon. L'utilisation de l'application implique l'acceptation des présentes conditions.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>2. Inscription établissement</strong><br>L'inscription d'un établissement est payante (5 000 XAF/mois). La validation est effectuée par l'équipe AMBI241 après vérification du paiement sous 24h. <strong style='color:var(--amber)'>Nom officiel de l'opérateur : KOZANGUE ESSONO PATRICK BERTIN</strong> - Tous les paiements et transactions financières doivent être validés par ce nom officiel.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>3. Compte utilisateur</strong><br>L'accès à la galerie membres requiert la création d'un compte. Vous êtes responsable de la confidentialité de vos identifiants.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>4. Contenu</strong><br>AMBI241 se réserve le droit de refuser ou supprimer tout contenu inapproprié. Les photos doivent être conformes aux bonnes mœurs et à la réglementation en vigueur.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>5. Responsabilité</strong><br>Les informations d'ambiance sont fournies à titre indicatif. AMBI241 ne peut être tenu responsable d'éventuelles inexactitudes.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>6. Propriété et Création</strong><br>AMBI241 a été créée par la PME informatique <strong style='color:var(--cyan)'>PC-INFORMATIQUE</strong>, sous la présidence de <strong style='color:var(--pink)'>KOZANGUE ESSONO PATRICK BERTIN</strong>.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7'><strong style='color:var(--text)'>7. Contact</strong><br>Pour toute question : <a href='mailto:ambi2412026@gmail.com' style='color:var(--cyan)'>ambi2412026@gmail.com</a></p>";

var CONF_TEXT = "<div class='modal-title' style='margin-bottom:0.6rem'>&#128274; Politique de Confidentialité</div><div class='modal-sub' style='margin-bottom:1rem'>Dernière mise à jour : Avril 2026</div><div style='font-size:0.8rem;color:var(--muted);padding:0.8rem;border-left:2px solid var(--cyan);margin-bottom:1rem;'><strong style='color:var(--text)'>Responsable :</strong> M. KOZANGUE ESSONO PATRICK BERTIN</div>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>Opérateur et Responsabilité</strong><br>AMBI241 est opérée par <strong style='color:var(--pink)'>KOZANGUE ESSONO PATRICK BERTIN</strong>, Président et fondateur de la PME informatique <strong style='color:var(--cyan)'>PC-INFORMATIQUE</strong>. Tout paiement et transaction financière doit être validé au nom officiel de l'opérateur.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>Données collectées</strong><br>Lors de l'inscription, nous collectons : pseudo, prénom, nom, email, téléphone et date de naissance. Ces données sont stockées de manière sécurisée via Firebase (Google).</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>Utilisation des données</strong><br>Vos données sont utilisées uniquement pour la gestion de votre compte AMBI241 et ne sont jamais revendues à des tiers.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>Photos</strong><br>Les photos de galerie (slot soirée) sont stockées sur Firebase Firestore/Storage et synchronisées sur tous vos appareils connectés. Un cache local (localStorage) est conservé pour un chargement rapide hors ligne. Les photos permanentes des établissements sont hébergées sur Firebase Storage.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7;margin-bottom:0.8rem'><strong style='color:var(--text)'>Vos droits</strong><br>Vous pouvez demander la suppression de votre compte et de vos données à tout moment en nous contactant par email.</p>"
  + "<p style='font-size:0.82rem;color:var(--muted);line-height:1.7'><strong style='color:var(--text)'>Contact DPO</strong><br><a href='mailto:ambi2412026@gmail.com' style='color:var(--cyan)'>ambi2412026@gmail.com</a> ou <strong>KOZANGUE ESSONO PATRICK BERTIN</strong> - Président PC-INFORMATIQUE</p>";

function openLegalModal(type){
  document.getElementById("legalContent").innerHTML = type === "cgu" ? CGU_TEXT : CONF_TEXT;
  document.getElementById("legalOverlay").classList.add("show");
}
function closeLegalModal(){
  document.getElementById("legalOverlay").classList.remove("show");
}
window.openLegalModal = openLegalModal;
window.closeLegalModal = closeLegalModal;


// ── SWIPE MOBILE pour naviguer entre sections ─────────────────
(function(){
  var startX=0, startY=0;
  var mainEl = document.querySelector("main");
  if(!mainEl) return;
  mainEl.addEventListener("touchstart", function(e){
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, {passive:true});
  mainEl.addEventListener("touchend", function(e){
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    if(Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)*0.8) return;
    var navBtns = document.querySelectorAll(".nav-item");
    var curIdx = 0;
    navBtns.forEach(function(b,i){ if(b.classList.contains("active")) curIdx = i; });
    var nextIdx = dx < 0 ? Math.min(curIdx+1, navBtns.length-1) : Math.max(curIdx-1, 0);
    if(nextIdx !== curIdx){
      var secs = ["accueil","etablissements","paiements","contacts"];
      if(nextIdx < secs.length) switchSection(secs[nextIdx], navBtns[nextIdx]);
    }
  }, {passive:true});
})();

// ══════════════════════════════════════════════════════════════
// ══ SYSTÈME DE NOTIFICATIONS CIBLÉES AMBI241 v2             ══
// ══════════════════════════════════════════════════════════════
// Chaque utilisateur ne reçoit QUE ses notifications.
// L'admin voit TOUT et peut modérer/supprimer n'importe quelle notif.

var NOTIF_KEY = "ambi241_notifications";
var NOTIF_ADMIN_KEY = "ambi241_notifs_admin_log"; // journal global pour l'admin
var NOTIF_PREFS_KEY = "ambi241_notif_prefs";
var notifPanelOpen = false;

// ── Rôle courant ────────────────────────────────────────────
function getUserRole(){
  if(isAdmin) return "admin";
  if(currentUserEmail){
    var em = currentUserEmail.toLowerCase().trim();
    // Gérant d'établissement
    var etab = etablissements.find(function(e){
      return (e.email||"").toLowerCase().trim() === em;
    });
    if(etab) return "etablissement";
    // Chauffeur approuvé
    if(window._chauffeurDrivers){
      var drivers = Object.values(window._chauffeurDrivers);
      var isDriver = drivers.some(function(d){
        return d.email && d.email.toLowerCase().trim() === em && d.status === 'approved';
      });
      if(isDriver) return "chauffeur";
    }
    return "membre";
  }
  return "visiteur";
}

// ── Canaux disponibles par rôle ─────────────────────────────
var ROLE_CHANNELS = {
  visiteur:      { push:true,  sms:false, email:false, wa:false },
  membre:        { push:true,  sms:true,  email:true,  wa:true  },
  etablissement: { push:true,  sms:true,  email:true,  wa:true  },
  admin:         { push:true,  sms:true,  email:true,  wa:true  }
};

// ── Événements par rôle — STRICTEMENT CIBLÉS ─────────────────
var ROLE_EVENTS = {
  visiteur: [
    { key:"new_spot",     label:"Nouveau lieu ouvert",     icon:"🏠", desc:"Un bar/resto rejoint AMBI241" },
    { key:"top_ambiance", label:"Lieu très bondé ce soir", icon:"🔥", desc:"Affluence > 80%" }
  ],
  membre: [
    { key:"new_spot",         label:"Nouveau lieu ouvert",      icon:"🏠", desc:"Un bar/resto rejoint AMBI241" },
    { key:"top_ambiance",     label:"Lieu très bondé ce soir",  icon:"🔥", desc:"Affluence > 80%" },
    { key:"galerie_new_photo",label:"Nouvelle photo en galerie", icon:"📸", desc:"Un lieu a ajouté une photo" },
    { key:"statut_change",    label:"Changement d'ambiance",    icon:"🎵", desc:"Statut d'un de vos lieux favoris" },
    { key:"promo",            label:"Soirée spéciale ce soir",  icon:"🎉", desc:"Évènement ou promo annoncé" }
  ],
  etablissement: [
    { key:"paiement_confirmed", label:"Paiement confirmé",         icon:"✅", desc:"Votre abonnement validé" },
    { key:"paiement_expire",    label:"Abonnement expirant",       icon:"⚠️", desc:"Renouvelez sous 7 jours" },
    { key:"new_avis",           label:"Nouvel avis reçu",          icon:"⭐", desc:"Un membre a noté votre lieu" },
    { key:"photo_added",        label:"Photo ajoutée à votre fiche",icon:"📷", desc:"Photo soirée publiée" },
    { key:"statut_updated",     label:"Statut mis à jour",         icon:"📡", desc:"Mise à jour en temps réel" },
    { key:"top_affluence",      label:"Vous êtes en top affluence",icon:"🏆", desc:"Top 3 ce soir" }
  ],
  chauffeur: [
    { key:"new_course",       label:"Nouvelle course reçue",    icon:"🚖", desc:"Un client vous demande" },
    { key:"course_accepted",  label:"Course acceptée",          icon:"✅", desc:"Confirmation de prise en charge" },
    { key:"new_avis_chauff",  label:"Nouvel avis reçu",         icon:"⭐", desc:"Un client a évalué votre course" },
    { key:"objet_oublie",     label:"Requête objet oublié",     icon:"🎒", desc:"Un passager signale un oubli" },
    { key:"paiement_course",  label:"Paiement de course",       icon:"💵", desc:"Confirmation du règlement" }
  ],
  admin: [
    { key:"new_inscription",  label:"Nouvelle inscription",     icon:"🏠", desc:"Demande à valider" },
    { key:"paiement_pending", label:"Paiement en attente",      icon:"💳", desc:"Mobile Money à valider" },
    { key:"new_membre",       label:"Nouveau membre inscrit",   icon:"👤", desc:"Compte créé" },
    { key:"top_traffic",      label:"Pic de trafic",            icon:"📈", desc:"Trafic inhabituel" },
    { key:"etabl_inactive",   label:"Établissement inactif",    icon:"😴", desc:"Pas de mise à jour > 24h" },
    { key:"paiement_expired", label:"Abonnement expiré",        icon:"❌", desc:"Établissement payant échu" }
  ]
};

// ── Prefs ────────────────────────────────────────────────────
function loadNotifPrefs(){
  try{ var r=lsGet(NOTIF_PREFS_KEY); return r?JSON.parse(r):{};} catch(e){ return {}; }
}
function saveNotifPrefs(p){ try{lsSetJSON(NOTIF_PREFS_KEY, p);}catch(e){} }
function getPref(role,key,ch){
  var p=loadNotifPrefs(); var k=role+"_"+key+"_"+ch;
  return p[k]!==undefined?p[k]:true;
}
function setPref(role,key,ch,val){
  var p=loadNotifPrefs(); p[role+"_"+key+"_"+ch]=val; saveNotifPrefs(p);
}

// ── Chargement / sauvegarde des notifications ─────────────────
// Chaque utilisateur a son propre store. L'admin a en plus un log global.
function _getNotifStoreKey(){
  // Pour l'admin: stocke dans la clé globale
  if(isAdmin) return NOTIF_KEY+"_admin";
  if(currentUserEmail) return NOTIF_KEY+"_"+btoa(currentUserEmail).replace(/=/g,"");
  return NOTIF_KEY+"_anon";
}

function loadNotifs(){
  try{ var r=lsGet(_getNotifStoreKey()); return r?JSON.parse(r):[]; }catch(e){ return []; }
}
function saveNotifs(arr){
  try{ lsSetJSON(_getNotifStoreKey(), arr.slice(-60)); }catch(e){}
}

// Log global (admin peut tout voir)
function saveToAdminLog(item){
  try{
    var log=lsGetJSON(NOTIF_ADMIN_KEY, []);
    log.push(item);
    lsSetJSON(NOTIF_ADMIN_KEY, log.slice(-200));
  }catch(e){}
}
function loadAdminLog(){
  try{ return lsGetJSON(NOTIF_ADMIN_KEY, []); }catch(e){ return []; }
}

// ── Envoi ciblé d'une notification ────────────────────────────
// opts: { targetRole, key, icon, title, msg, channel, fromAdmin }
// targetRole = "admin" | "membre" | "etablissement" | "visiteur" | "all"
// La notif n'est ajoutée AU STORE COURANT que si targetRole correspond au rôle actuel
function pushNotif(opts){
  var role = getUserRole();
  var targetRole = opts.targetRole || opts.role || "all";

  // ── Vérification ciblage strict ──
  var isTargeted = (targetRole === "all") || (targetRole === role);
  if(!isTargeted) return; // Pas pour cet utilisateur

  // ── Vérification préférence ──
  if(!opts.fromAdmin && !getPref(role, opts.key, opts.channel||"push")) return;

  var item = {
    id: Date.now()+"_"+Math.random().toString(36).slice(2,6),
    key: opts.key,
    icon: opts.icon||"🔔",
    title: opts.title,
    msg: opts.msg,
    channel: opts.channel||"push",
    targetRole: targetRole,
    ts: Date.now(),
    unread: true,
    fromAdmin: !!opts.fromAdmin
  };

  var notifs = loadNotifs();
  notifs.push(item);
  saveNotifs(notifs);
  renderNotifBadge();
  if(!notifPanelOpen) showNotifToast(item.icon+" "+item.title, item);

  // ── Transmission au Notification Engine v3.0 (sons + toasts riches + badge) ──
  var _engineType = (function(){
    var m = {
      message:"message", new_course:"taxi_dispatch", course_accepted:"taxi_dispatch",
      taxi_dispatch:"taxi_dispatch", friend_request:"friend_request",
      friend_accepted:"friend_accepted", paiement_confirmed:"system",
      paiement_pending:"system", paiement_expire:"system", top_ambiance:"event_flash",
      galerie_new_photo:"ambiance_update", new_inscription:"system",
      new_membre:"system", top_traffic:"system", statut_change:"ambiance_update",
      promo:"promo", vip_invite:"vip_invite", incoming_call:"incoming_call",
      call_missed:"incoming_call", sub_expire:"system", sub_alerte:"system"
    };
    return opts.type || m[opts.key] || "system";
  })();
  if(window.AMBI241_NOTIF && typeof window.AMBI241_NOTIF.trigger === "function"){
    window.AMBI241_NOTIF.trigger(_engineType, opts.title, opts.msg, {
      fromUID: opts.fromUID||null, fromName: opts.fromName||null,
      fromAvatar: opts.fromAvatar||null, targetRole: targetRole
    });
  }

  // ── Persistance Firestore format v3 (collection user_notifications, doc par notif) ──
  // Compatible avec le listener temps réel du Notification Engine v3.0
  // Dédoublonnage par clé composite uid+key+jour → max 1 doc par clé par jour
  if(window.db && window.fbDoc && window.fbSetDoc && window.fbCollection && currentUserUID && opts.key){
    try{
      var _dedupKey = currentUserUID + "_" + opts.key + "_" + new Date().toISOString().slice(0,10);
      var _dedupId  = btoa(_dedupKey).replace(/[^a-zA-Z0-9]/g,"").slice(0,60);
      window.fbSetDoc(
        window.fbDoc(window.db, "user_notifications", _dedupId),
        {
          toUID:      currentUserUID,
          type:       _engineType,
          title:      opts.title || "",
          body:       opts.msg   || "",
          fromUID:    opts.fromUID    || null,
          fromName:   opts.fromName   || null,
          fromAvatar: opts.fromAvatar || null,
          targetRole: targetRole,
          read:       false,
          createdAt:  new Date().toISOString(),
          _source:    "pushNotif",
          _key:       opts.key
        },
        { merge: false } // Ne pas écraser si déjà lu
      ).catch(function(){});
    }catch(ex){}
  }

  // ── Rétrocompatibilité : ancien format Firebase {items:[]} pour l'admin ──
  if(opts.fromAdmin && window.db && window.fbDoc && window.fbGetDoc && window.fbSetDoc && currentUserUID){
    try{
      var userNotifRef = window.fbDoc(window.db, "user_notifications_legacy", currentUserUID);
      window.fbGetDoc(userNotifRef).then(function(snap){
        var existing = snap.exists() ? (snap.data().items||[]) : [];
        existing.push(item);
        return window.fbSetDoc(userNotifRef, { items: existing.slice(-60), uid:currentUserUID, email:currentUserEmail||"", updatedAt:Date.now() });
      }).catch(function(){});
    }catch(ex){}
  }

  // Push navigateur
  if((opts.channel==="push"||!opts.channel) && typeof Notification!=="undefined" && Notification.permission==="granted"){
    try{
      new Notification("AMBI241 — "+opts.title,{
        body:opts.msg, icon:"/ambi241/favicon.ico", tag:opts.key
      });
    }catch(ex){}
  }

  // Toujours logger dans le journal admin (même si l'utilisateur courant n'est pas admin)
  saveToAdminLog(Object.assign({},item,{sentByRole:role}));
}

// ── Charger les notifs Firebase au login utilisateur ─────────────
// Appelé après connexion pour synchroniser les notifs depuis Firebase
function _syncUserNotifsFromFirebase(){
  if(!window.db || !window.fbDoc || !window.fbGetDoc || !currentUserUID) return;
  try{
    var ref = window.fbDoc(window.db, "user_notifications", currentUserUID);
    window.fbGetDoc(ref).then(function(snap){
      if(!snap.exists()) return;
      var fbItems = snap.data().items || [];
      if(!fbItems.length) return;
      // Fusionner avec les notifs locales (dédoublonnage par id)
      var local = loadNotifs();
      var localIds = local.map(function(n){ return n.id; });
      var newItems = fbItems.filter(function(n){ return localIds.indexOf(n.id) === -1; });
      if(newItems.length){
        var merged = local.concat(newItems).slice(-60);
        saveNotifs(merged);
        renderNotifBadge();
        if(newItems.length === 1) showNotifToast(newItems[0].icon+" "+newItems[0].title);
        else showNotifToast("🔔 "+newItems.length+" nouvelle(s) notification(s)");
      }
    }).catch(function(){});
  }catch(ex){}
}
window._syncUserNotifsFromFirebase = _syncUserNotifsFromFirebase;

// ── Envoi admin vers un rôle spécifique (depuis le dashboard) ─
function admSendNotif(){
  var target = document.getElementById("admNotifTarget").value;
  var title  = (document.getElementById("admNotifTitle").value||"").trim();
  var msg    = (document.getElementById("admNotifMsg").value||"").trim();
  var icon   = document.getElementById("admNotifIcon").value||"📢";
  if(!title||!msg){ showToast("Titre et message requis"); return; }

  // Sauve dans le log admin avec le ciblage
  var item = {
    id: Date.now()+"_adm",
    key:"admin_broadcast",
    icon:icon,
    title:title,
    msg:msg,
    channel:"push",
    targetRole:target,
    ts:Date.now(),
    unread:true,
    fromAdmin:true,
    sentByRole:"admin"
  };
  saveToAdminLog(item);

  // Aussi injecter dans le store du rôle ciblé si c'est l'utilisateur courant
  // (utile si admin teste vers lui-même)
  if(target==="all"||target===getUserRole()){
    var notifs=loadNotifs();
    notifs.push(item);
    saveNotifs(notifs);
    renderNotifBadge();
    showNotifToast(icon+" "+title);
  }

  // ── Persistance Firebase : stocker la notif pour chaque utilisateur ciblé ──
  if(window.db && window.fbCollection && window.fbGetDocs && window.fbDoc && window.fbGetDoc && window.fbSetDoc){
    window.fbGetDocs(window.fbCollection(window.db, "users")).then(function(snap){
      var promises = [];
      snap.forEach(function(d){
        var u = Object.assign({uid:d.id}, d.data());
        var uEmail = (u.email||"").toLowerCase();
        // Déterminer le rôle de l'utilisateur
        var uEtab = etablissements.find(function(e){ return (e.email||"").toLowerCase()===uEmail; });
        var uRole = uEtab ? "etablissement" : "membre";
        // Vérifier si l'utilisateur est ciblé
        var targeted = (target==="all") || (target===uRole);
        if(!targeted) return;
        // Ajouter la notif dans le document Firebase de cet utilisateur
        var ref = window.fbDoc(window.db, "user_notifications", d.id);
        var p = window.fbGetDoc(ref).then(function(snap2){
          var existing = snap2.exists() ? (snap2.data().items||[]) : [];
          existing.push(item);
          return window.fbSetDoc(ref, { items:existing.slice(-60), uid:d.id, email:u.email||"", updatedAt:Date.now() });
        });
        promises.push(p);
      });
      return Promise.all(promises);
    }).then(function(){
      showToast("✅ Notification diffusée à tous les "+target+"s !");
    }).catch(function(err){
      showToast("✅ Journalisé (Firebase push partiel: "+err.message+")");
    });
  } else {
    showToast("✅ Notification envoyée aux "+target+"s");
  }

  document.getElementById("admNotifTitle").value="";
  document.getElementById("admNotifMsg").value="";
  if(typeof renderAdminNotifs==="function") renderAdminNotifs();
}
window.admSendNotif = admSendNotif;

// ══════════════════════════════════════════════════════════════
// ══  NOTIFICATIONS URGENTES & TEMPLATES                       ══
// ══════════════════════════════════════════════════════════════

/* Templates urgents */
var _urgentTemplates = {
  fermeture:  { title:"🔒 Fermeture exceptionnelle",  msg:"L'application est temporairement fermée pour maintenance urgente. Merci de votre compréhension." },
  incident:   { title:"⚠️ Incident en cours",         msg:"Un incident technique est en cours de résolution. Certaines fonctionnalités peuvent être indisponibles." },
  maintenance:{ title:"🔧 Maintenance programmée",    msg:"Une maintenance est en cours. L'application sera de retour dans quelques minutes." },
  securite:   { title:"🛡️ Alerte sécurité",           msg:"Nous avons détecté une activité inhabituelle. Veuillez vérifier vos informations de connexion." }
};

/* Templates standards */
var _notifTemplates = {
  soiree:     { icon:"🎉", type:"event",  title:"🔥 Soirée exceptionnelle ce soir !",  msg:"Des établissements organisent des événements spéciaux ce soir. Découvrez l'ambiance en temps réel !" },
  promo:      { icon:"🎁", type:"promo",  title:"🎁 Offre exclusive pour vous !",       msg:"Profitez d'offres spéciales dans les établissements partenaires AMBI241 ce week-end." },
  classement: { icon:"🏆", type:"info",   title:"🏆 Nouveau classement disponible !",  msg:"Le classement hebdomadaire des établissements vient d'être mis à jour. Découvrez le top 10 !" },
  nouveaute:  { icon:"✨", type:"update", title:"✨ Nouvelle fonctionnalité AMBI241",  msg:"Une nouvelle mise à jour est disponible. Découvrez les nouvelles fonctionnalités de l'application !" },
  bienvenue:  { icon:"👋", type:"info",   title:"👋 Bienvenue sur AMBI241 !",          msg:"Trouvez l'ambiance des meilleurs bars et restaurants de Libreville en temps réel. Bonne découverte !" }
};

function admApplyUrgentTemplate(key){
  var tpl = _urgentTemplates[key];
  if(!tpl) return;
  var t = document.getElementById("admUrgentTitle");
  var m = document.getElementById("admUrgentMsg");
  if(t) t.value = tpl.title;
  if(m) m.value = tpl.msg;
}
window.admApplyUrgentTemplate = admApplyUrgentTemplate;

function admApplyTemplate(key){
  var tpl = _notifTemplates[key];
  if(!tpl) return;
  var t = document.getElementById("admNotifTitle");
  var m = document.getElementById("admNotifMsg");
  var ic = document.getElementById("admNotifIcon");
  var ty = document.getElementById("admNotifType");
  if(t) t.value = tpl.title;
  if(m) m.value = tpl.msg;
  if(ic) ic.value = tpl.icon;
  if(ty) ty.value = tpl.type;
}
window.admApplyTemplate = admApplyTemplate;

/* ── admSendNotif2 : version pour le panneau statique (IDs suffixés 2) ── */
function admSendNotif2(){
  var target = (document.getElementById("admNotifTarget2")||{}).value || "all";
  var title  = ((document.getElementById("admNotifTitle2")||{}).value||"").trim();
  var msg    = ((document.getElementById("admNotifMsg2")||{}).value||"").trim();
  var icon   = (document.getElementById("admNotifIcon2")||{}).value || "📢";
  if(!title||!msg){ showToast("Titre et message requis"); return; }
  var item = {
    id: Date.now()+"_adm",
    key:"admin_broadcast",
    icon:icon,
    title:title,
    msg:msg,
    channel:"push",
    targetRole:target,
    ts:Date.now(),
    unread:true,
    fromAdmin:true,
    sentByRole:"admin"
  };
  saveToAdminLog(item);
  if(target==="all"||target===getUserRole()){
    var notifs=loadNotifs();
    notifs.push(item);
    saveNotifs(notifs);
    renderNotifBadge();
    showNotifToast(icon+" "+title);
  }
  showToast("📨 Notification envoyée !");
  /* Effacer les champs */
  var t2=document.getElementById("admNotifTitle2"); if(t2) t2.value="";
  var m2=document.getElementById("admNotifMsg2");   if(m2) m2.value="";
}
window.admSendNotif2 = admSendNotif2;

function admSendUrgentNotif(){
  var title = (document.getElementById("admUrgentTitle").value||"").trim();
  var msg   = (document.getElementById("admUrgentMsg").value||"").trim();
  if(!title||!msg){ showToast("Titre et message requis pour l'alerte urgente"); return; }

  var item = {
    id: Date.now()+"_urg",
    key:"admin_urgent",
    icon:"🚨",
    title:title,
    msg:msg,
    channel:"push",
    targetRole:"all",
    priority:"urgent",
    ts:Date.now(),
    unread:true,
    fromAdmin:true,
    sentByRole:"admin"
  };
  saveToAdminLog(item);

  /* Injection locale */
  var notifs = loadNotifs();
  notifs.unshift(item); /* urgent en tête */
  saveNotifs(notifs);
  renderNotifBadge();
  showNotifToast("🚨 "+title);

  /* Diffusion Firebase */
  if(window.db && window.fbCollection && window.fbGetDocs && window.fbDoc && window.fbGetDoc && window.fbSetDoc){
    window.fbGetDocs(window.fbCollection(window.db,"users")).then(function(snap){
      var proms=[];
      snap.forEach(function(d){
        var ref=window.fbDoc(window.db,"user_notifications",d.id);
        var p=window.fbGetDoc(ref).then(function(s2){
          var ex=s2.exists()?(s2.data().items||[]):[];
          ex.unshift(item);
          return window.fbSetDoc(ref,{items:ex.slice(0,60),uid:d.id,updatedAt:Date.now()});
        });
        proms.push(p);
      });
      return Promise.all(proms);
    }).then(function(){ showToast("🚨 Alerte urgente diffusée à tous !"); })
      .catch(function(){ showToast("🚨 Alerte urgente envoyée (Firebase partiel)"); });
  } else {
    showToast("🚨 Alerte urgente envoyée !");
  }

  document.getElementById("admUrgentTitle").value="";
  document.getElementById("admUrgentMsg").value="";
  if(typeof renderAdminNotifs==="function") renderAdminNotifs();
}
window.admSendUrgentNotif = admSendUrgentNotif;

function admClearAllNotifs(){
  if(!confirm("Effacer tout l'historique des notifications admin ?")) return;
  try{ localStorage.removeItem("ambi241_admin_notif_log"); }catch(e){}
  var el=document.getElementById("adminAllNotifs");
  if(el) el.innerHTML="<div style='text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;'>📭 Aucune notification</div>";
  showToast("🗑️ Historique effacé");
}
window.admClearAllNotifs = admClearAllNotifs;

// ── Toast riche AMBI241 ───────────────────────────────────────
var _notifToastTimer;
// notifMeta : mapping type → {icon,color,label}
var _ambiNotifMeta = {
  message:        { icon:"💬", color:"var(--cyan)",   label:"Message",      pillBg:"rgba(0,229,255,0.18)"   },
  call_missed:    { icon:"📞", color:"var(--red)",    label:"Appel manqué", pillBg:"rgba(255,68,102,0.18)"  },
  call_incoming:  { icon:"📳", color:"var(--green)",  label:"Appel entrant",pillBg:"rgba(0,255,170,0.15)"   },
  friend_request: { icon:"👥", color:"var(--amber)",  label:"Demande",      pillBg:"rgba(255,215,0,0.15)"   },
  event:          { icon:"🎉", color:"var(--pink)",   label:"Événement",    pillBg:"rgba(255,45,155,0.14)"  },
  like:           { icon:"❤️", color:"var(--pink)",   label:"J'aime",       pillBg:"rgba(255,45,155,0.14)"  },
  promo:          { icon:"🎁", color:"var(--amber)",  label:"Promo",        pillBg:"rgba(255,215,0,0.15)"   },
  info:           { icon:"ℹ️", color:"var(--cyan)",   label:"Info",         pillBg:"rgba(0,229,255,0.12)"   },
  alert:          { icon:"🚨", color:"var(--red)",    label:"Alerte",       pillBg:"rgba(255,68,102,0.18)"  },
  update:         { icon:"✨", color:"var(--purple)",  label:"Mise à jour",  pillBg:"rgba(204,68,255,0.15)"  }
};
function _ambiGetMeta(notif){
  // Déterminer le type depuis la clé ou le type explicite
  var t = notif.type || notif.key || "info";
  // Heuristiques sur la clé
  if(t.indexOf("message")!==-1||t.indexOf("msg")!==-1) t="message";
  else if(t.indexOf("call")!==-1) t="call_missed";
  else if(t.indexOf("friend")!==-1||t.indexOf("ami")!==-1) t="friend_request";
  else if(t.indexOf("event")!==-1||t.indexOf("soiree")!==-1||t.indexOf("promo")!==-1) t="event";
  else if(t.indexOf("like")!==-1||t.indexOf("aime")!==-1) t="like";
  else if(t.indexOf("urgent")!==-1||t.indexOf("fermeture")!==-1||t.indexOf("incident")!==-1||t.indexOf("securite")!==-1) t="alert";
  else if(t.indexOf("update")!==-1||t.indexOf("nouveaute")!==-1) t="update";
  return _ambiNotifMeta[t] || _ambiNotifMeta.info;
}
function showNotifToast(msg, notif){
  var t=document.getElementById("notifToast");
  if(!t)return;
  // Mode riche si un objet notif est passé
  if(notif && document.getElementById("notifToastTitle")){
    var meta = _ambiGetMeta(notif);
    var iconEl=document.getElementById("notifToastIcon");
    var labelEl=document.getElementById("notifToastLabel");
    var titleEl=document.getElementById("notifToastTitle");
    var msgEl=document.getElementById("notifToastMsg");
    if(iconEl){ iconEl.textContent = notif.icon||meta.icon; iconEl.style.boxShadow="0 0 12px "+meta.color+"88"; }
    if(labelEl){ labelEl.textContent = "AMBI241 · "+meta.label; labelEl.style.color=meta.color; }
    if(titleEl) titleEl.textContent = notif.title||"";
    if(msgEl)   msgEl.textContent   = notif.msg||"";
    t.style.borderColor = meta.color+"44";
  } else {
    // Mode simple (fallback texte)
    var titleEl2=document.getElementById("notifToastTitle");
    var msgEl2=document.getElementById("notifToastMsg");
    var labelEl2=document.getElementById("notifToastLabel");
    if(titleEl2) titleEl2.textContent = msg||"";
    if(msgEl2)   msgEl2.textContent   = "";
    if(labelEl2) labelEl2.textContent = "AMBI241";
  }
  t.classList.add("show");
  clearTimeout(_notifToastTimer);
  _notifToastTimer=setTimeout(function(){t.classList.remove("show");},4500);
}

// ── Badge enrichi ────────────────────────────────────────────
function renderNotifBadge(){
  var unread=loadNotifs().filter(function(n){return n.unread;}).length;
  var isConnected = !!(window.currentUserUID);
  // Cloche : visible uniquement pour membre/admin connecté ET s'il y a des notifs non lues
  var bellWrap=document.getElementById("notifBellWrap");
  if(bellWrap){
    if(isConnected && unread>0){
      bellWrap.style.display="inline-flex";
    } else if(isConnected && isAdmin){
      // Admin connecté : toujours visible (même sans non-lues)
      bellWrap.style.display="inline-flex";
    } else {
      bellWrap.style.display="none";
    }
  }
  // Badge header
  var badge=document.getElementById("notifBadge");
  if(badge){
    badge.textContent=unread>99?"99+":unread>9?"9+":String(unread);
    badge.classList.toggle("show",unread>0);
  }
  // Badge dans le panel
  var panelBadge=document.getElementById("notifPanelBadge");
  if(panelBadge){
    panelBadge.textContent=unread>99?"99+":unread>9?"9+":String(unread);
    panelBadge.style.display=unread>0?"flex":"none";
  }
  // Sous-titre panel
  var sub=document.getElementById("notifPanelSub");
  if(sub) sub.textContent=unread>0?(unread+" non lue"+(unread>1?"s":"")):"Tout est lu";

  // Titre de l'onglet navigateur
  var baseTitle = document.title.replace(/^\(\d+\)\s*/,"");
  document.title = unread>0 ? "("+unread+") "+baseTitle : baseTitle;
}

// ── Filtre actif pour le panneau ─────────────────────────────
var _ambiNotifFilter = "all";
function ambiFilterNotifs(type, btn){
  _ambiNotifFilter = type;
  document.querySelectorAll(".notif-filter-btn").forEach(function(b){b.classList.remove("active");});
  if(btn) btn.classList.add("active");
  renderNotifList();
}
window.ambiFilterNotifs = ambiFilterNotifs;

// ── Rendu enrichi panneau ─────────────────────────────────────
function renderNotifList(){
  var all=loadNotifs().slice().reverse();
  // Appliquer filtre
  var notifs = _ambiNotifFilter==="all" ? all : all.filter(function(n){
    var m=_ambiGetMeta(n);
    if(_ambiNotifFilter==="message") return (n.type||n.key||"").indexOf("message")!==-1;
    if(_ambiNotifFilter==="event")   return ["event","promo","like"].indexOf(_ambiGetMeta(n).label.toLowerCase())!==-1||(n.key||"").indexOf("soiree")!==-1||(n.key||"").indexOf("event")!==-1;
    if(_ambiNotifFilter==="alert")   return m.label==="Alerte"||(n.priority==="urgent")||(n.key||"").indexOf("urgent")!==-1;
    if(_ambiNotifFilter==="info")    return ["Info","Mise à jour"].indexOf(m.label)!==-1;
    return true;
  });
  var list=document.getElementById("notifList");
  if(!list)return;
  if(!notifs.length){
    list.innerHTML="<div class=\"notif-empty\"><span>🔕</span>Aucune notification"+((_ambiNotifFilter!=="all")?" dans cette catégorie":"")+"</div>";
    renderNotifBadge(); return;
  }
  var channelLabel={push:"Push",sms:"SMS",email:"Email",wa:"WhatsApp"};
  var channelCls={push:"ni-ch-push",sms:"ni-ch-sms",email:"ni-ch-email",wa:"ni-ch-wa"};
  var html="";
  notifs.forEach(function(n){
    var ago=timeAgo(n.ts);
    var meta=_ambiGetMeta(n);
    var typeColor=meta.color;
    html+="<div class=\"notif-item"+(n.unread?" unread":"")+"\" style=\""+(n.unread?"border-left-color:"+typeColor:"")+"\""
         +" onclick=\"ambiMarkRead('"+n.id+"',this)\">";
    // Avatar + badge type
    html+="<div class=\"notif-item-avatar-wrap\">";
    html+="<div class=\"notif-item-avatar\" style=\""+(n.unread?"border-color:"+typeColor+"55;box-shadow:0 0 10px "+typeColor+"33":"")+"\">";
    html+=n.icon||meta.icon;
    html+="</div>";
    // Badge type icône
    html+="<div class=\"notif-type-badge\" style=\"background:"+typeColor+"\">"+meta.icon+"</div>";
    // Badge count (messages non lus)
    if(n.count&&n.count>0){
      html+="<div class=\"notif-msg-count-badge\" style=\"background:"+typeColor+"\">"+n.count+"</div>";
    }
    html+="</div>";
    // Corps
    html+="<div class=\"ni-body\">";
    html+="<div class=\"ni-top-row\">";
    html+="<div class=\"ni-title\">"+_escHtml(n.title||"")+"</div>";
    html+="<span class=\"ni-time\">"+ago+"</span>";
    html+="</div>";
    html+="<div class=\"ni-msg\">"+_escHtml(n.msg||"")+"</div>";
    // Pill type + canal
    html+="<span class=\"notif-type-pill\" style=\"background:"+meta.pillBg+";color:"+typeColor+";border:1px solid "+typeColor+"44\">"+meta.label+"</span>";
    if(n.channel&&channelLabel[n.channel]){
      html+=" <span class=\"ni-channel "+channelCls[n.channel]+"\">"+channelLabel[n.channel]+"</span>";
    }
    if(n.fromAdmin){
      html+=" <span class=\"ni-channel\" style=\"background:rgba(255,215,0,0.12);color:var(--amber);\">Admin</span>";
    }
    html+="</div>";
    // Point non-lu
    if(n.unread){
      html+="<div class=\"notif-unread-dot\" style=\"background:"+typeColor+";box-shadow:0 0 6px "+typeColor+"\"></div>";
    }
    html+="</div>";
  });
  list.innerHTML=html;
  // Marquer comme lus dans le store
  var arr=loadNotifs();
  arr.forEach(function(n){n.unread=false;});
  saveNotifs(arr);
  renderNotifBadge();
}

function _escHtml(s){
  return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function ambiMarkRead(id, el){
  if(!id||!el) return;
  el.classList.remove("unread");
  el.style.borderLeftColor="transparent";
  var dot=el.querySelector(".notif-unread-dot");
  if(dot) dot.style.display="none";
  var arr=loadNotifs();
  arr.forEach(function(n){if(n.id===id)n.unread=false;});
  saveNotifs(arr);
  renderNotifBadge();
}
window.ambiMarkRead=ambiMarkRead;

// ── Rendu préférences ─────────────────────────────────────────
function renderNotifPrefs(){
  var role=getUserRole();
  var events=ROLE_EVENTS[role]||[];
  var channels=ROLE_CHANNELS[role]||{};
  var panel=document.getElementById("notifPrefsRows");
  if(!panel)return;
  var roleLabel={visiteur:"Visiteur",membre:"Membre",etablissement:"Établissement",admin:"Admin"};
  var html="<div style='font-size:0.7rem;color:var(--cyan);margin-bottom:0.5rem;'>Rôle : <strong>"+roleLabel[role]+"</strong></div>";
  events.forEach(function(ev){
    var activeChannels=Object.keys(channels).filter(function(ch){return channels[ch];});
    activeChannels.forEach(function(ch){
      var chLabel={push:"🔔 Push",sms:"📱 SMS",email:"✉️ Email",wa:"💬 WhatsApp"}[ch];
      var checked=getPref(role,ev.key,ch);
      html+="<div class=\"notif-pref-row\">";
      html+="<div><div class=\"notif-pref-label\">"+ev.icon+" "+ev.label+"</div>";
      html+="<div class=\"notif-pref-sub\">"+chLabel+" — "+ev.desc+"</div></div>";
      html+="<label class=\"notif-toggle\"><input type=\"checkbox\" "+(checked?"checked":"")+" onchange=\"setPref('"+role+"','"+ev.key+"','"+ch+"',this.checked)\"><span class=\"notif-toggle-slider\"></span></label>";
      html+="</div>";
    });
  });
  if(typeof Notification!=="undefined"&&Notification.permission==="default"){
    html+="<button onclick=\"requestPushPermission()\" style=\"width:100%;margin-top:0.6rem;padding:0.5rem;border-radius:10px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.08);color:var(--cyan);font-size:0.78rem;font-weight:700;cursor:pointer;font-family:'DM Sans',sans-serif;\">🔔 Activer les notifications navigateur</button>";
  } else if(typeof Notification!=="undefined"&&Notification.permission==="granted"){
    html+="<div style='text-align:center;font-size:0.68rem;color:var(--green);margin-top:0.4rem;'>✅ Notifications navigateur actives</div>";
  }
  panel.innerHTML=html;
}

function timeAgo(ts){
  var diff=Date.now()-ts;
  if(diff<60000)return"À l'instant";
  if(diff<3600000)return Math.floor(diff/60000)+"min";
  if(diff<86400000)return Math.floor(diff/3600000)+"h";
  return Math.floor(diff/86400000)+"j";
}

function requestPushPermission(){
  if(!("Notification"in window))return;
  Notification.requestPermission().then(function(result){
    if(result==="granted"){
      showNotifToast("✅ Notifications Push activées !");
      // triggerWelcomeNotif supprimé — bannière désactivée
    }
    renderNotifPrefs();
  });
}

/* ══════════════════════════════════════════════════════════════
   ══ ONBOARDING NOTIFICATIONS — Module complet par rôle        ══
   ══════════════════════════════════════════════════════════════ */

var NOTIF_ONBOARD_KEY = 'ambi241_notif_onboard_v1';

/* Configurations par rôle (label, subtitle, couleur, icône pill, événements) */
var _nobRoleConfig = {
  membre: {
    pill    : '👤 Membre',
    pillBg  : 'rgba(0,229,255,0.12)',
    pillColor: '#00e5ff',
    subtitle: 'Recevez les messages du forum, les ambiances en temps réel et les demandes d\'amis.',
    events  : [
      { key:'forum_msg',      label:'Messages du forum',         icon:'💬', desc:'Réponses et mentions dans les discussions', on:true  },
      { key:'friend_request', label:'Demandes d\'amis',          icon:'👥', desc:'Quand un membre veut vous ajouter',         on:true  },
      { key:'top_ambiance',   label:'Ambiances en direct',       icon:'🔥', desc:'Lieux très animés ce soir près de vous',   on:true  },
      { key:'new_spot',       label:'Nouveau lieu ouvert',       icon:'🏠', desc:'Un bar/resto rejoint AMBI241',             on:false },
      { key:'promo',          label:'Soirées & événements',      icon:'🎉', desc:'Promos et soirées spéciales annoncées',    on:false },
      { key:'statut_change',  label:'Changement d\'ambiance',    icon:'🎵', desc:'Mise à jour d\'un de vos favoris',         on:false }
    ]
  },
  etablissement: {
    pill    : '🏢 Établissement',
    pillBg  : 'rgba(255,215,0,0.12)',
    pillColor: '#ffd700',
    subtitle: 'Soyez alerté des commandes, avis et commentaires laissés sur votre établissement.',
    events  : [
      { key:'new_commande',        label:'Commande reçue',             icon:'🛎️', desc:'Un client passe commande chez vous',          on:true  },
      { key:'new_avis',            label:'Nouvel avis / commentaire',  icon:'⭐', desc:'Un membre a noté ou commenté votre lieu',    on:true  },
      { key:'top_affluence',       label:'Top affluence ce soir',      icon:'🏆', desc:'Vous êtes dans le top 3 ce soir',            on:true  },
      { key:'photo_added',         label:'Photo soirée publiée',       icon:'📷', desc:'Une nouvelle photo a été ajoutée à votre fiche', on:true },
      { key:'paiement_expire',     label:'Abonnement qui expire',      icon:'⚠️', desc:'Rappel de renouvellement sous 7 jours',      on:true  },
      { key:'paiement_confirmed',  label:'Paiement confirmé',          icon:'✅', desc:'Votre abonnement a été validé',              on:true  }
    ]
  },
  chauffeur: {
    pill    : '🚖 Chauffeur',
    pillBg  : 'rgba(0,255,170,0.12)',
    pillColor: '#00ffaa',
    subtitle: 'Recevez les courses en temps réel, les avis clients et les requêtes passagers.',
    events  : [
      { key:'new_course',      label:'Nouvelle course reçue',     icon:'🚖', desc:'Un client vous demande — répondez vite !', on:true  },
      { key:'course_accepted', label:'Course confirmée',          icon:'✅', desc:'Confirmation de prise en charge',          on:true  },
      { key:'new_avis_chauff', label:'Nouvel avis reçu',          icon:'⭐', desc:'Un client a évalué votre course',          on:true  },
      { key:'objet_oublie',    label:'Objet oublié signalé',      icon:'🎒', desc:'Un passager signale un oubli dans le véhicule', on:true },
      { key:'paiement_course', label:'Paiement de course reçu',   icon:'💵', desc:'Confirmation du règlement client',         on:true  }
    ]
  },
  admin: {
    pill    : '🔑 Admin',
    pillBg  : 'rgba(255,215,0,0.15)',
    pillColor: '#ffd700',
    subtitle: 'Supervision complète : inscriptions, paiements, trafic et alertes système.',
    events  : [
      { key:'new_inscription',  label:'Nouvelle inscription',    icon:'🏠', desc:'Demande d\'établissement à valider',      on:true  },
      { key:'paiement_pending', label:'Paiement en attente',     icon:'💳', desc:'Mobile Money à confirmer',               on:true  },
      { key:'new_membre',       label:'Nouveau membre inscrit',  icon:'👤', desc:'Compte membre créé',                    on:true  },
      { key:'paiement_expired', label:'Abonnement expiré',       icon:'❌', desc:'Établissement payant échu',             on:true  },
      { key:'top_traffic',      label:'Pic de trafic',           icon:'📈', desc:'Activité inhabituelle sur l\'app',       on:false },
      { key:'etabl_inactive',   label:'Établissement inactif',   icon:'😴', desc:'Pas de mise à jour > 24h',              on:false }
    ]
  },
  visiteur: {
    pill    : '👀 Visiteur',
    pillBg  : 'rgba(255,255,255,0.08)',
    pillColor: 'rgba(255,255,255,0.5)',
    subtitle: 'Créez un compte pour accéder à toutes les fonctionnalités de notification.',
    events  : [
      { key:'new_spot',     label:'Nouveau lieu ouvert',     icon:'🏠', desc:'Un bar/resto rejoint AMBI241', on:true },
      { key:'top_ambiance', label:'Ambiances en direct',     icon:'🔥', desc:'Lieux très animés ce soir',   on:true }
    ]
  }
};

/* ── Vérifier si l'onboarding doit s'afficher ── */
function _nobShouldShow(){
  try{
    var data = JSON.parse(lsGet(NOTIF_ONBOARD_KEY)||'{}');
    if(data.done) return false;            // déjà complété
    if(data.skipped){
      /* Ré-afficher après 3 jours si sauté */
      var daysPassed = (Date.now() - (data.skippedAt||0)) / 86400000;
      return daysPassed >= 3;
    }
    return true;
  }catch(e){ return true; }
}

/* ── Construire et afficher le modal ── */
function ambiShowNotifOnboarding(){
  if(!_nobShouldShow()) return;

  var role   = getUserRole() || 'membre';
  var cfg    = _nobRoleConfig[role] || _nobRoleConfig['membre'];
  var prefs  = loadNotifPrefs();

  /* Pill de rôle */
  var pill = document.getElementById('nobRolePill');
  if(pill){
    pill.textContent    = cfg.pill;
    pill.style.background  = cfg.pillBg;
    pill.style.color       = cfg.pillColor;
    pill.style.border      = '1px solid ' + cfg.pillColor + '44';
  }

  /* Sous-titre */
  var sub = document.getElementById('nobSubtitle');
  if(sub) sub.textContent = cfg.subtitle;

  /* Badge permission navigateur */
  var permBadge = document.getElementById('nobPermBadge');
  if(permBadge){
    var needsPerm = (typeof Notification !== 'undefined' && Notification.permission === 'default');
    permBadge.style.display = needsPerm ? 'flex' : 'none';
  }

  /* Liste des notifications */
  var list = document.getElementById('nobList');
  if(list){
    list.innerHTML = cfg.events.map(function(ev){
      var prefKey  = role + '_' + ev.key + '_push';
      var isOn     = prefs[prefKey] !== undefined ? prefs[prefKey] : ev.on;
      return '<label class="nob-item' + (isOn ? ' nob-item-on' : '') + '" id="nob-item-'+ev.key+'">'
        + '<div class="nob-item-icon">'+ev.icon+'</div>'
        + '<div class="nob-item-text">'
        +   '<div class="nob-item-label">'+ev.label+'</div>'
        +   '<div class="nob-item-desc">'+ev.desc+'</div>'
        + '</div>'
        + '<label class="nob-toggle">'
        +   '<input type="checkbox" id="nob-chk-'+ev.key+'" '+(isOn?'checked':'')+' onchange="nobToggleItem(this,\''+ev.key+'\')">'
        +   '<div class="nob-toggle-track"><div class="nob-toggle-thumb"></div></div>'
        + '</label>'
        + '</label>';
    }).join('');
  }

  /* Afficher le modal */
  var overlay = document.getElementById('notifOnboardOverlay');
  if(overlay){ overlay.classList.add('show'); document.body.style.overflow='hidden'; }

  /* Jouer un son de démo discret */
  setTimeout(function(){
    if(typeof ambiPlayNotifSound === 'function') ambiPlayNotifSound('default');
  }, 600);
}
window.ambiShowNotifOnboarding = ambiShowNotifOnboarding;

/* ── Toggle d'un item dans le modal ── */
function nobToggleItem(chk, key){
  var item = document.getElementById('nob-item-' + key);
  if(item){ item.classList.toggle('nob-item-on', chk.checked); }
}
window.nobToggleItem = nobToggleItem;

/* ── Confirmation : sauvegarder les prefs + demander permission ── */
function ambiOnboardConfirm(){
  var role = getUserRole() || 'membre';
  var cfg  = _nobRoleConfig[role] || _nobRoleConfig['membre'];
  var prefs = loadNotifPrefs();

  /* Sauvegarder chaque préférence cochée */
  cfg.events.forEach(function(ev){
    var chk = document.getElementById('nob-chk-' + ev.key);
    var val = chk ? chk.checked : ev.on;
    ['push','sms','email','wa'].forEach(function(ch){
      prefs[role + '_' + ev.key + '_' + ch] = val;
    });
  });
  saveNotifPrefs(prefs);

  /* Marquer comme complété */
  try{ lsSetJSON(NOTIF_ONBOARD_KEY, { done:true, role:role, doneAt:Date.now() }); }catch(e){}

  /* Fermer le modal */
  _nobClose();

  /* Demander permission navigateur si pas encore accordée */
  if(typeof Notification !== 'undefined' && Notification.permission === 'default'){
    setTimeout(function(){
      Notification.requestPermission().then(function(result){
        if(result === 'granted'){
          /* Notification de bienvenue selon le rôle */
          var welcome = {
            membre      : { icon:'🎉', title:'Bienvenue dans la communauté !',       msg:'Vous recevrez vos messages et ambiances en temps réel.' },
            etablissement:{ icon:'🏢', title:'Notifications activées pour votre lieu',msg:'Commandes, avis et alertes vous parviendront immédiatement.' },
            chauffeur   : { icon:'🚖', title:'Prêt à recevoir des courses !',         msg:'Les nouvelles demandes vous seront envoyées en temps réel.' },
            admin       : { icon:'🔑', title:'Surveillance système activée',           msg:'Inscriptions, paiements et alertes arriveront ici.' },
            visiteur    : { icon:'✨', title:'Notifications activées',                 msg:'Restez informé des nouveaux lieux et ambiances.' }
          }[role] || { icon:'🔔', title:'Notifications activées', msg:'Bienvenue sur AMBI241 !' };

          pushNotif({
            targetRole : 'all',
            key        : 'welcome_notif',
            icon       : welcome.icon,
            title      : welcome.title,
            msg        : welcome.msg,
            channel    : 'push',
            fromAdmin  : true
          });
        } else if(result === 'denied'){
          showNotifToast('⚙️ Notifications désactivées dans les paramètres navigateur', null);
        }
        renderNotifPrefs();
      });
    }, 300);
  } else if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
    /* Permission déjà accordée → notification de confirmation directe */
    var roleWelcome = {
      membre      : { icon:'✅', title:'Préférences sauvegardées',   msg:'Vos notifications sont configurées.' },
      etablissement:{ icon:'✅', title:'Alertes établissement actives', msg:'Vous recevrez commandes et avis.' },
      chauffeur   : { icon:'✅', title:'Alertes chauffeur actives',   msg:'Courses et requêtes vous parviennent.' },
      admin       : { icon:'✅', title:'Supervision activée',          msg:'Toutes les alertes admin sont actives.' }
    }[role] || { icon:'✅', title:'Notifications configurées', msg:'' };
    setTimeout(function(){
      pushNotif({ targetRole:'all', key:'notif_prefs_saved', icon:roleWelcome.icon,
        title:roleWelcome.title, msg:roleWelcome.msg, channel:'push', fromAdmin:true });
    }, 200);
  }
}
window.ambiOnboardConfirm = ambiOnboardConfirm;

/* ── Skip ── */
function ambiOnboardSkip(){
  try{ lsSetJSON(NOTIF_ONBOARD_KEY, { skipped:true, skippedAt:Date.now() }); }catch(e){}
  _nobClose();
}
window.ambiOnboardSkip = ambiOnboardSkip;

function _nobClose(){
  var overlay = document.getElementById('notifOnboardOverlay');
  if(overlay){ overlay.classList.remove('show'); document.body.style.overflow=''; }
}

/* ── Réinitialiser l'onboarding (depuis les paramètres) ── */
function ambiResetNotifOnboarding(){
  try{ localStorage.removeItem(NOTIF_ONBOARD_KEY); }catch(e){}
  setTimeout(ambiShowNotifOnboarding, 200);
}
window.ambiResetNotifOnboarding = ambiResetNotifOnboarding;

function toggleNotifPanel(){
  notifPanelOpen=!notifPanelOpen;
  var panel=document.getElementById("notifPanel");
  panel.classList.toggle("open",notifPanelOpen);
  if(notifPanelOpen){_ambiNotifFilter="all";renderNotifList();renderNotifPrefs();}
}
function closeNotifPanel(){
  notifPanelOpen=false;
  var panel=document.getElementById("notifPanel");
  if(panel)panel.classList.remove("open");
}
window.closeNotifPanel=closeNotifPanel;
document.addEventListener("click",function(e){
  var panel=document.getElementById("notifPanel");
  var bell=document.getElementById("notifBellBtn");
  if(!panel)return;
  if(notifPanelOpen&&!panel.contains(e.target)&&e.target!==bell){
    notifPanelOpen=false; panel.classList.remove("open");
  }
});

function clearAllNotifs(){
  saveNotifs([]); renderNotifBadge(); renderNotifList();
}

// ══════════════════════════════════════════════════════════════
// ══  SYSTÈME APPEL ENTRANT AMBI241                           ══
// ══════════════════════════════════════════════════════════════
var _ambiCallWaveTimer=null;
var _ambiCallWaveRing=0;

function ambiShowIncomingCall(caller){
  // caller = { avatar, name }
  var overlay=document.getElementById("ambiIncomingCall");
  if(!overlay)return;
  var avatarEl=document.getElementById("ambiCallAvatar");
  var nameEl=document.getElementById("ambiCallName");
  var wavesEl=document.getElementById("ambiCallWaves");
  if(avatarEl) avatarEl.childNodes[0].textContent=caller.avatar||"📞";
  if(nameEl)   nameEl.textContent=caller.name||"Inconnu";
  // Ondes de sonnerie
  if(wavesEl){
    wavesEl.innerHTML="";
    for(var i=0;i<3;i++){
      var w=document.createElement("div");
      w.className="ambicall-wave";
      var size=(80+i*60)+"px";
      w.style.cssText="width:"+size+";height:"+size+";animation:ambiRingWave 1.8s ease-out "+( i*0.3)+"s infinite;";
      wavesEl.appendChild(w);
    }
  }
  overlay.classList.add("show");
  window._ambiCurrentCaller=caller;
}
window.ambiShowIncomingCall=ambiShowIncomingCall;

function ambiDeclineCall(){
  var overlay=document.getElementById("ambiIncomingCall");
  if(overlay) overlay.classList.remove("show");
  window._ambiCurrentCaller=null;
  pushNotif({targetRole:"all",key:"call_missed",icon:"📞",
    title:"Appel manqué"+(window._ambiCurrentCaller?" — "+window._ambiCurrentCaller.name:""),
    msg:"Vous avez manqué un appel vocal AMBI241.",channel:"push"});
}
window.ambiDeclineCall=ambiDeclineCall;

function ambiAcceptCall(){
  var overlay=document.getElementById("ambiIncomingCall");
  if(overlay) overlay.classList.remove("show");
  window._ambiCurrentCaller=null;
  if(typeof showToast==="function") showToast("✅ Appel accepté — fonctionnalité vocale bientôt disponible");
}
window.ambiAcceptCall=ambiAcceptCall;

function triggerWelcomeNotif(){
  var role=getUserRole();
  var msgs={
    visiteur:{title:"Bienvenue sur AMBI241 !",msg:"Découvrez l'ambiance des bars et restos de Libreville en temps réel."},
    membre:{title:"Bon retour, membre AMBI241 !",msg:"Vos lieux favoris sont mis à jour en direct. Bonne soirée !"},
    etablissement:{title:"Espace établissement actif",msg:"Mettez à jour votre ambiance pour attirer plus de clients ce soir."},
    admin:{title:"Mode Admin activé",msg:"Tableau de bord complet disponible. Paiements et membres à vérifier."}
  };
  var m=msgs[role]||msgs.visiteur;
  pushNotif({targetRole:role, key:"welcome", icon:"✨", title:m.title, msg:m.msg, channel:"push"});
}

function checkAutoNotifs(){
  var role=getUserRole();
  // ── Lieux bondés → TOUS ──
  var bondes=etablissements.filter(function(e){return(e.affluence||0)>=80&&e.statut&&e.statut.indexOf("Ouvert")!==-1;});
  if(bondes.length>0){
    var b=bondes[Math.floor(Math.random()*bondes.length)];
    pushNotif({targetRole:"all",key:"top_ambiance",icon:"🔥",title:"🔥 "+b.nom+" est bondé !",msg:"Affluence à "+b.affluence+"% — "+b.quartier+". Ambiance : "+b.ambiance+".",channel:"push"});
  }
  // ── Photos galerie → MEMBRES seulement ──
  if(role==="membre"){
    // Utiliser le cache Firebase en priorité, fallback localStorage
    var galerieData = Object.keys(_galerieCache||{}).length > 0
      ? _galerieCache
      : lsGetJSON("ambi241_galerie", {});
    var etabsAvecPhotos=Object.keys(galerieData).filter(function(id){return galerieData[id]&&galerieData[id].length>0;});
    if(etabsAvecPhotos.length>0){
      var eid=etabsAvecPhotos[0];
      var etab=etablissements.find(function(x){return String(x.id)===String(eid);});
      if(etab&&getPref("membre","galerie_new_photo","push")){
        pushNotif({targetRole:"membre",key:"galerie_new_photo",icon:"📸",title:"Nouvelle photo — "+etab.nom,msg:"La galerie de "+etab.nom+" vient d'être mise à jour.",channel:"push"});
      }
    }
  }
  // ── Établissement : ses propres infos ──
  if(role==="etablissement"){
    var myEtab=etablissements.find(function(e){return(e.email||"").toLowerCase().trim()===(currentUserEmail||"").toLowerCase().trim();});
    if(myEtab){
      if(myEtab.paiement&&myEtab.paiement.indexOf("Actif")!==-1){
        pushNotif({targetRole:"etablissement",key:"paiement_confirmed",icon:"✅",title:"Abonnement actif — "+myEtab.nom,msg:"Votre fiche est visible par tous les utilisateurs AMBI241.",channel:"push"});
        // Vérifier renouvellement
        notifyEtablissementRenewal(myEtab);
      }
      if((myEtab.affluence||0)>=80){
        pushNotif({targetRole:"etablissement",key:"top_affluence",icon:"🏆",title:"🏆 Vous êtes dans le Top 3 !",msg:myEtab.nom+" affiche "+myEtab.affluence+"% d'affluence.",channel:"push"});
      }
    }
  }
  // ── Admin : ses alertes spécifiques ──
  if(role==="admin"){
    var pending=paiements.filter(function(p){return p.statut==="En attente";});
    if(pending.length>0){
      pushNotif({targetRole:"admin",key:"paiement_pending",icon:"💳",title:pending.length+" paiement(s) en attente",msg:"À valider : "+pending.map(function(p){return p.nom;}).join(", "),channel:"push"});
    }
    var t=getTraffic();
    if(t.count>=5){
      pushNotif({targetRole:"admin",key:"top_traffic",icon:"📈",title:"Pic de trafic — "+t.count+" visites aujourd'hui",msg:"Total cumulé : "+t.total+" visites.",channel:"push"});
    }
  }
}

function initNotifications(){
  renderNotifBadge();
  // triggerWelcomeNotif() supprimé — bannière AMBI241·INFO désactivée
  setTimeout(function loop(){checkAutoNotifs();setTimeout(loop,120000);},5000);
}

var _notifInitDone=false;
(function waitForData(){
  if(etablissements.length>0&&!_notifInitDone){
    _notifInitDone=true;
    initNotifications();
  } else {
    setTimeout(waitForData,500);
  }
})();

window.toggleNotifPanel=toggleNotifPanel;
window.clearAllNotifs=clearAllNotifs;
window.setPref=setPref;
window.requestPushPermission=requestPushPermission;

var _prevRole="";
// PERF: setInterval 2000ms supprimé — remplacé par event-driven
function _onRoleChange(){
  var newRole=getUserRole();
  if(newRole!==_prevRole){
    _prevRole=newRole;
    if(!_notifInitDone)return;
    if(notifPanelOpen)renderNotifPrefs();
    var adminNavBtn=document.getElementById("adminNavBtn");
    if(adminNavBtn) adminNavBtn.style.display="flex";
  }
}
document.addEventListener('ambi:authStateChanged', _onRoleChange);
// Vérification initiale unique après boot
setTimeout(_onRoleChange, 1000);

// ══════════════════════════════════════════════════════════════
// ══ TABLEAU DE BORD ADMIN — LOGIQUE COMPLÈTE               ══
// ══════════════════════════════════════════════════════════════

var _currentAdmTab = "overview";
var _adminDashInitialized = false; // PERF: flag initialisation paresseuse

function openAdminDashboard(btn){
  // Toujours marquer actif dans la nav
  document.querySelectorAll(".nav-item").forEach(function(b){b.classList.remove("active");});
  if(btn)btn.classList.add("active");
  if(!isAdmin){
    showToast("\uD83D\uDD12 Acc\u00e8s Admin r\u00e9serv\u00e9 aux administrateurs");
    // Afficher info modale
    var infoHtml='<div style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;" id="_adminInfoOverlay" onclick="document.getElementById(\'_adminInfoOverlay\').remove();document.querySelectorAll(\'.nav-item\').forEach(function(b){b.classList.remove(\'active\')});document.querySelectorAll(\'.nav-item\')[0].classList.add(\'active\');"><div style="background:var(--surface);border:1.5px solid rgba(255,215,0,0.4);border-radius:22px;padding:2rem 1.5rem;width:min(360px,95%);text-align:center;animation:popIn 0.3s cubic-bezier(0.34,1.56,0.64,1);"><div style="font-size:2.5rem;margin-bottom:0.6rem;">⚙️</div><div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.1rem;color:var(--amber);margin-bottom:0.4rem;">Tableau de Bord Admin</div><div style="font-size:0.82rem;color:var(--muted);line-height:1.6;margin-bottom:1rem;">Cet espace est réservé aux <strong style="color:var(--text)">administrateurs AMBI241</strong>.<br>Connectez-vous avec un compte admin pour y accéder.</div><button onclick="document.getElementById(\'_adminInfoOverlay\').remove();document.querySelectorAll(\'.nav-item\').forEach(function(b){b.classList.remove(\'active\')});document.querySelectorAll(\'.nav-item\')[0].classList.add(\'active\');document.getElementById(\'authOverlay\').classList.add(\'show\');" style="width:100%;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--amber),var(--pink));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;margin-bottom:0.5rem;">🔑 Se connecter</button><button onclick="document.getElementById(\'_adminInfoOverlay\').remove();document.querySelectorAll(\'.nav-item\').forEach(function(b){b.classList.remove(\'active\')});document.querySelectorAll(\'.nav-item\')[0].classList.add(\'active\');" style="width:100%;padding:0.6rem;border-radius:12px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.05);color:var(--muted);font-family:DM Sans,sans-serif;font-size:0.85rem;cursor:pointer;">Fermer</button></div></div>';
    var div=document.createElement('div');
    div.innerHTML=infoHtml;
    document.body.appendChild(div.firstChild);
    return;
  }
  document.getElementById("adminDashOverlay").classList.add("show");
  document.body.style.overflow="hidden";
  // Afficher loading immédiatement
  var ov=document.getElementById("adminOverviewContent");
  if(ov) ov.innerHTML="<div style='text-align:center;padding:3rem 1rem;'><div style='font-size:2rem;margin-bottom:0.7rem;'>⏳</div><div style='color:var(--muted);font-size:0.85rem;'>Chargement du tableau de bord\u2026</div></div>";

  // PERF: initialisation paresseuse — toutes les données admin chargées
  // uniquement à la PREMIÈRE ouverture du dashboard, jamais au démarrage global
  if(!_adminDashInitialized){
    _adminDashInitialized = true;

    // 1. Config superadmin + liste admins secondaires
    if(typeof loadAdminConfig === "function") loadAdminConfig();

    // 2. Données établissements si absentes
    if((!etablissements||etablissements.length===0) && typeof loadData==="function") loadData();

    // 3. Collection paiements (lecture lourde — évitée au démarrage pour tous les non-admins)
    if(!window._paiementsFirebase || window._paiementsFirebase.length===0) {
      if(window.fbGetDocs && window.fbQuery && window.fbCollection && window.fbOrderBy && window.db) {
        window.fbGetDocs(window.fbQuery(window.fbCollection(window.db,"paiements"),window.fbOrderBy("id")))
          .then(function(snap){
            window._paiementsFirebase=window._paiementsFirebase||[];
            window._paiementsFirebase.length=0;
            snap.forEach(function(d){ window._paiementsFirebase.push(Object.assign({_docId:d.id},d.data())); });
            if(typeof rebuildPaiements==="function") rebuildPaiements();
            if(typeof renderPayments==="function") renderPayments();
          }).catch(function(err){ console.warn("[AMBI241] Paiements admin load error:", err); });
      }
    }

    // 4. Démarrer le timer abonnements si pas encore actif
    if(typeof _startSubRenewalTimer==="function") _startSubRenewalTimer();

    // 5. Pre-init panneau contenu
    setTimeout(function(){
      if(typeof window.renderAdmContent === 'function') window.renderAdmContent(0);
    }, 800);
  }

  // Délai pour laisser Firebase répondre avant le rendu
  setTimeout(function(){ switchAdmTab("overview"); }, 600);
  // Afficher le bouton admin nav
  var nb=document.getElementById("adminNavBtn");
  if(nb)nb.style.display="flex";
  // Charger badge support
  setTimeout(function(){ if(typeof _loadSupportBadge==="function") _loadSupportBadge(); }, 1200);
}
function closeAdminDashboard(){
  document.getElementById("adminDashOverlay").classList.remove("show");
  document.body.style.overflow="";
  // Réactiver accueil
  var navBtns=document.querySelectorAll(".nav-item");
  navBtns.forEach(function(b){b.classList.remove("active");});
  if(navBtns[0])navBtns[0].classList.add("active");
}
window.openAdminDashboard=openAdminDashboard;
window.closeAdminDashboard=closeAdminDashboard;

function switchAdmTab(tab){
  _currentAdmTab=tab;
  var tabs=["overview","etabl","users","notifs","payments","connexions","settings","reservations","classement","support","content","appconfig","importgmaps"];
  tabs.forEach(function(t){
    var btn=document.getElementById("admtab-"+t);
    var panel=document.getElementById("admpanel-"+t);
    if(btn) btn.classList.toggle("active",t===tab);
    if(panel){
      if(t===tab){
        panel.style.display="block";
        panel.style.visibility="visible";
        panel.style.height="";
        panel.style.overflow="";
      } else {
        // Fix boutons fantômes sur Android — appliqué à TOUS les panels
        panel.style.display="none";
        panel.style.visibility="hidden";
        panel.style.height="0";
        panel.style.overflow="hidden";
      }
    }
  });
  // Render content
  if(tab==="overview") renderAdmOverview();
  else if(tab==="etabl") renderAdmEtabl();
  else if(tab==="users"){
    renderAdmUsers();
    if(!_superAdminEmail) loadAdminConfig();
  }
  else if(tab==="notifs") renderAdminNotifs();
  else if(tab==="payments") renderAdmPayments();
  else if(tab==="connexions") renderAdmConnexions();
  else if(tab==="settings"){
    if(!_superAdminEmail && window.db) loadAdminConfig();
    else renderAdmSettings();
  }
  else if(tab==="reservations") renderAdmReservations();
  else if(tab==="classement") renderAdmClassement();
  else if(tab==="support") renderAdmSupport();
  else if(tab==="content") { if(typeof window.renderAdmContent==="function") window.renderAdmContent(); }
  else if(tab==="appconfig") { if(typeof window.renderAdmAppConfig==="function") window.renderAdmAppConfig(0); }
  else if(tab==="importgmaps") { if(!window._igm2Inited) igm2Init(); }
}
window.switchAdmTab=switchAdmTab;
window.openAdminAddModal=openAdminAddModal;
window.loadData=loadData;

// ── Vue d'ensemble ─────────────────────────────────────────────
/* Compteur de tentatives pour briser la boucle infinie si Firebase ne répond pas */
if(typeof window._admOverviewRetries === 'undefined') window._admOverviewRetries = 0;
function renderAdmOverview(){
  var d=etablissements;
  /* Si les données ne sont pas encore chargées, afficher un loader et réessayer */
  if(!d || d.length === 0){
    var overviewElCheck = document.getElementById("adminOverviewContent");
    window._admOverviewRetries++;
    if(window._admOverviewRetries > 8){
      /* Abandon après ~12 secondes — évite la boucle infinie */
      if(overviewElCheck){
        overviewElCheck.innerHTML = "<div style='text-align:center;padding:2.5rem 1rem;'>"
          +"<div style='font-size:2rem;margin-bottom:0.5rem;'>⚠️</div>"
          +"<div style='color:var(--red);font-size:0.85rem;margin-bottom:1rem;font-weight:700;'>Impossible de charger les données Firebase.</div>"
          +"<button onclick='window._admOverviewRetries=0;if(typeof loadData===\"function\")loadData();setTimeout(renderAdmOverview,1500);' style='padding:0.5rem 1.2rem;border-radius:10px;border:1px solid rgba(255,68,102,0.35);background:rgba(255,68,102,0.08);color:var(--red);font-family:DM Sans,sans-serif;font-weight:700;font-size:0.8rem;cursor:pointer;'>↻ Réessayer</button>"
          +"</div>";
      }
      return; /* Pas de nouveau setTimeout — fin de la boucle */
    }
    if(overviewElCheck && overviewElCheck.innerHTML.indexOf('kpi') === -1){
      overviewElCheck.innerHTML = "<div style='text-align:center;padding:2.5rem 1rem;'>"
        +"<div style='font-size:2rem;margin-bottom:0.5rem;'>⏳</div>"
        +"<div style='color:var(--muted);font-size:0.85rem;margin-bottom:1rem;'>Connexion à Firebase en cours…</div>"
        +"<button onclick='window._admOverviewRetries=0;if(typeof loadData===\"function\")loadData();setTimeout(renderAdmOverview,1200);' style='padding:0.5rem 1.2rem;border-radius:10px;border:1px solid rgba(0,229,255,0.35);background:rgba(0,229,255,0.08);color:var(--cyan);font-family:DM Sans,sans-serif;font-weight:700;font-size:0.8rem;cursor:pointer;'>↻ Actualiser</button>"
        +"</div>";
    }
    setTimeout(function(){
      if((_currentAdmTab==='overview'||window._currentAdmTab==='overview') && typeof renderAdmOverview==='function') renderAdmOverview();
    }, 1500);
    return;
  }
  window._admOverviewRetries = 0; /* Données chargées — reset compteur pour la prochaine ouverture */
  var actifs=d.length;
  var bondes=d.filter(function(e){return e.statut&&e.statut.indexOf("Bonde")!==-1;}).length;
  var animes=d.filter(function(e){return e.statut&&e.statut.indexOf("Anime")!==-1;}).length;
  var fermés=d.filter(function(e){return e.statut&&e.statut.indexOf("Ferme")!==-1;}).length;
  var pending=paiements.filter(function(p){return p.statut==="En attente";}).length;
  var rev=paiements.reduce(function(s,p){return s+(p.statut==="Confirme"?p.montant:0);},0);
  var avgNote=(d.reduce(function(s,e){return s+(e.note||0);},0)/Math.max(d.length,1)).toFixed(1);
  var avgAff=(d.reduce(function(s,e){return s+(e.affluence||0);},0)/Math.max(d.length,1)).toFixed(0);
  var t=getTraffic();
  var totalNotifs=loadAdminLog().length;

  var html="";
  // KPIs
  html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.6rem;margin-bottom:1rem;'>";
  var kpis=[
    {v:d.length,l:"Lieux total",c:"var(--pink)"},
    {v:actifs,l:"Lieux actifs",c:"var(--green)"},
    {v:rev.toLocaleString("fr-FR")+" XAF",l:"Revenus confirmés",c:"var(--amber)"},
    {v:pending,l:"Paiements en attente",c:"var(--red)"},
    {v:t.count,l:"Visites aujourd'hui",c:"var(--cyan)"},
    {v:t.total,l:"Visites totales",c:"var(--purple)"}
  ];
  kpis.forEach(function(k){
    html+="<div class='adm-kpi'><div class='kv' style='color:"+k.c+";'>"+k.v+"</div><div class='kl'>"+k.l+"</div></div>";
  });
  html+="</div>";

  // Ambiances
  html+="<div style='background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--pink);font-size:0.8rem;margin-bottom:0.7rem;'>🔴 Ambiances en direct</div>";
  html+="<div style='display:grid;grid-template-columns:repeat(4,1fr);gap:0.4rem;'>";
  [{v:bondes,l:"Bondés",c:"var(--red)"},{v:animes,l:"Animés",c:"var(--green)"},{v:d.length-bondes-animes-fermés,l:"Calmes",c:"var(--amber)"},{v:fermés,l:"Fermés",c:"var(--muted)"}].forEach(function(a){
    html+="<div style='text-align:center;padding:0.6rem;background:rgba(255,255,255,0.02);border-radius:10px;'><div style='font-size:1.2rem;font-weight:800;font-family:Syne,sans-serif;color:"+a.c+";'>"+a.v+"</div><div style='font-size:0.6rem;color:var(--muted);'>"+a.l+"</div></div>";
  });
  html+="</div></div>";

  // Actions rapides
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--amber);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.7rem;'>⚡ Actions rapides</div>";
  html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1rem;'>";
  html+="<button data-adm-action='addPlace' class='adm-action-btn' onclick='openAdminAddModal()' style='background:rgba(0,255,170,0.08);border-color:rgba(0,255,170,0.3);color:var(--green);'>&#43; Ajouter lieu</button>";
  html+="<button data-adm-action='payments' class='adm-action-btn' onclick='switchAdmTab(\"payments\")' style='background:rgba(255,215,0,0.08);border-color:rgba(255,215,0,0.3);color:var(--amber);'>&#128179; Paiements ("+pending+" att.)</button>";
  html+="<button data-adm-action='notifs' class='adm-action-btn' onclick='switchAdmTab(\"notifs\")' style='background:rgba(255,45,155,0.08);border-color:rgba(255,45,155,0.3);color:var(--pink);'>&#128276; Notifs ("+totalNotifs+")</button>";
  html+="<button data-adm-action='sync' class='adm-action-btn' onclick='loadData();showToast&&showToast(\"Synchronisation…\")' style='background:rgba(0,229,255,0.08);border-color:rgba(0,229,255,0.3);color:var(--cyan);'>&#8635; Synchroniser Firebase</button>";
  html+="<button data-adm-action='users' class='adm-action-btn' onclick='switchAdmTab(\"users\")' style='background:rgba(255,255,255,0.04);border-color:rgba(255,255,255,0.1);color:var(--text);'>&#128100; Membres</button>";
  html+="<button data-adm-action='support' class='adm-action-btn' onclick='switchAdmTab(\"support\")' style='background:rgba(255,215,0,0.07);border-color:rgba(255,215,0,0.25);color:var(--amber);position:relative;'>💬 Support (<span id='admOverviewSupportCount'>…</span>)</button>";
  html+="</div>";

  // Top affluence
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--cyan);font-size:0.8rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🏆 Top affluence ce soir</div>";
  var top3=d.slice().sort(function(a,b){return(b.affluence||0)-(a.affluence||0);}).slice(0,5);
  html+="<div style='background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:0.8rem;margin-bottom:1rem;'>";
  top3.forEach(function(e,i){
    var pct=e.affluence||0;
    html+="<div style='display:flex;align-items:center;gap:0.6rem;margin-bottom:0.55rem;'>";
    html+="<span style='font-size:1rem;width:26px;text-align:center;'>"+(i===0?"🥇":i===1?"🥈":i===2?"🥉":"#"+(i+1))+"</span>";
    html+="<div style='flex:1;'><div style='display:flex;justify-content:space-between;margin-bottom:0.2rem;'><span style='font-size:0.8rem;color:var(--text);font-weight:600;'>"+e.nom+"</span><span style='font-size:0.72rem;color:var(--amber);font-weight:700;'>"+pct+"%</span></div>";
    html+="<div style='height:4px;background:rgba(255,255,255,0.06);border-radius:2px;'><div style='height:100%;width:"+pct+"%;background:linear-gradient(90deg,var(--green),var(--amber),var(--red));border-radius:2px;'></div></div></div>";
    html+="<span style='font-size:0.62rem;color:var(--muted);'>"+e.quartier+"</span>";
    html+="</div>";
  });
  html+="</div>";

  // Raccourci Connexions récentes
  html+="<div data-adm-action='connexions' onclick='switchAdmTab(\"connexions\")' style='background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.2);border-radius:14px;padding:1rem;cursor:pointer;display:flex;align-items:center;gap:0.8rem;transition:all 0.2s;'>";
  html+="<div style='font-size:1.8rem;'>📷</div>";
  html+="<div style='flex:1;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:0.88rem;'>Historique des connexions</div>";
  html+="<div style='font-size:0.72rem;color:var(--muted);margin-top:0.2rem;'>Voir qui s'est connecté, depuis où et quand →</div>";
  html+="</div>";
  html+="<div style='font-size:1.2rem;color:var(--cyan);'>›</div>";
  html+="</div>";

  var overviewEl = document.getElementById("adminOverviewContent");
  overviewEl.innerHTML = html;

  // ── Délégation d'événements (remplace les onclick inline bloqués par CSP) ──
  // On retire l'ancien listener avant d'en ajouter un nouveau (évite l'accumulation
  // si renderAdmOverview() est appelé plusieurs fois lors des changements d'onglet).
  function _admOverviewClick(e){
    var btn = e.target.closest("[data-adm-action]");
    if(!btn) return;
    var action = btn.getAttribute("data-adm-action");
    switch(action){
      case "addPlace":   openAdminAddModal(); break;
      case "payments":   switchAdmTab("payments"); break;
      case "notifs":     switchAdmTab("notifs"); break;
      case "sync":       loadData(); showToast && showToast("Synchronisation…"); break;
      case "users":      switchAdmTab("users"); break;
      case "support":    switchAdmTab("support"); break;
      case "connexions": switchAdmTab("connexions"); break;
    }
  }
  if(overviewEl._admClickHandler){
    overviewEl.removeEventListener("click", overviewEl._admClickHandler);
  }
  overviewEl._admClickHandler = _admOverviewClick;
  overviewEl.addEventListener("click", _admOverviewClick);
}

// ── Établissements admin ───────────────────────────────────────
if(typeof window._admEtablCompact === 'undefined') window._admEtablCompact = false;
if(typeof window._admEtablActifsOpen === 'undefined') window._admEtablActifsOpen = true;
function renderAdmEtabl(){
  var d = etablissements.slice();

  /* ── Trier par statut paiement : Actif critiques → Actif alerte → Actif OK → En attente → Autres ── */
  var _payRank = function(e){
    var s = getSubscriptionStatus(e);
    if(!e.paiement || e.paiement.indexOf("Actif") === -1){
      return e.paiement && e.paiement.indexOf("attente") !== -1 ? 30 : 40;
    }
    if(s === "expire")   return 0;
    if(s === "critique") return 1;
    if(s === "alerte")   return 2;   /* <14j */
    /* ── 72h warning ── */
    var msLeft = _getMsLeft(e);
    if(msLeft !== null && msLeft <= 259200000) return 1; /* 72h = critique visuel */
    return 10;
  };
  d.sort(function(a,b){ return _payRank(a) - _payRank(b); });

  var isCompact = window._admEtablCompact;

  var html="<div style='margin-bottom:0.8rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;'>";
  html+="<span style='font-size:0.72rem;color:var(--muted);'><strong style='color:var(--green);'>"+d.length+" établissement(s)</strong> · trié par statut abonnement</span>";
  html+="<div style='display:flex;gap:0.4rem;align-items:center;'>";
  html+="<button onclick=\"window._admEtablCompact=!window._admEtablCompact;renderAdmEtabl();\" style='display:flex;align-items:center;gap:0.3rem;font-size:0.65rem;font-weight:700;padding:0.3rem 0.65rem;border-radius:20px;cursor:pointer;font-family:DM Sans,sans-serif;transition:all 0.2s;border:1px solid "+(isCompact?"rgba(157,132,255,0.5)":"rgba(255,255,255,0.12)")+";background:"+(isCompact?"rgba(157,132,255,0.15)":"rgba(255,255,255,0.04)")+";color:"+(isCompact?"#9D84FF":"var(--muted)")+";'>"+(isCompact?"<span style='font-size:0.75rem;'>≡</span> Détaillé":"<span style='font-size:0.75rem;'>⊟</span> Compact")+"</button>";
  html+="<input id='admSearchEtabl' type='text' placeholder='Rechercher...' oninput='admFilterEtabl()' style='background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:var(--text);font-size:0.78rem;padding:0.4rem 0.7rem;width:130px;'>";
  html+="</div>";
  html+="</div>";

  if(isCompact){
    html += _renderEtablCompact(d);
  } else {
    d.forEach(function(e){ html += _renderEtablCard(e); });
  }

  document.getElementById("adminEtablList").innerHTML = html;
  _initCountdownElements();
}

/* ── Helper : ms restants sur l'abonnement ── */
function _getMsLeft(e){
  if(!e || !e.abonnement_activated_at) return null;
  var ech = computeEcheance(e.abonnement_type||"mensuel", e.abonnement_activated_at);
  if(!ech) return null;
  return ech.getTime() - Date.now();
}

/* ── Helper : couleur + label horloge selon urgence ──
   🟢 Vert  : > 7 jours restants   (OK, pas urgent)
   🟠 Orange: 7j → 72h             (alerte modérée)
   🔴 Rouge : ≤ 72h ou expiré      (urgence critique)
*/
function _cdStyle(msLeft){
  var H72  = 259200000;   /* 72 heures en ms  */
  var D7   = 604800000;   /* 7  jours   en ms */
  if(msLeft === null)      return { color:"var(--green)", bg:"rgba(0,255,170,0.07)", border:"rgba(0,255,170,0.22)", warn:false, level:"green"  };
  if(msLeft <= 0)          return { color:"var(--red)",   bg:"rgba(255,68,102,0.12)", border:"rgba(255,68,102,0.5)", warn:true,  level:"red"    };
  if(msLeft <= H72)        return { color:"var(--red)",   bg:"rgba(255,68,102,0.12)", border:"rgba(255,68,102,0.5)", warn:true,  level:"red"    };
  if(msLeft <= D7)         return { color:"var(--amber)", bg:"rgba(255,215,0,0.09)",  border:"rgba(255,215,0,0.38)", warn:false, level:"orange" };
  /* > 7 jours — vert */
  return                          { color:"var(--green)", bg:"rgba(0,255,170,0.07)", border:"rgba(0,255,170,0.22)", warn:false, level:"green"  };
}

/* ── Vue COMPACTE : une ligne par établissement, expandable ── */
function _renderEtablCompact(list){
  var html = "<div style='display:flex;flex-direction:column;gap:0.3rem;margin-bottom:0.4rem;'>";
  list.forEach(function(e){
    var sc=e.statut&&e.statut.indexOf("Bonde")!==-1?"var(--red)":e.statut&&e.statut.indexOf("Anime")!==-1?"var(--green)":e.statut&&e.statut.indexOf("Ouvert")!==-1?"var(--amber)":"var(--muted)";
    var expandId = "admEtablExpand_"+e.id;
    var isPaid = e.paiement && (e.paiement.indexOf("Actif")!==-1||e.paiement.indexOf("Confirme")!==-1);
    var cdHtml = "";
    var rowBorderColor = "rgba(0,255,170,0.18)";

    if(isPaid && e.abonnement_activated_at){
      var ech = computeEcheance(e.abonnement_type||"mensuel", e.abonnement_activated_at);
      if(ech){
        var msLeft = ech.getTime() - Date.now();
        var st = _cdStyle(msLeft);
        var cdId = "admCdC_"+e.id;
        if(st.warn) rowBorderColor = "rgba(255,68,102,0.45)";
        else if(msLeft <= 604800000) rowBorderColor = "rgba(255,215,0,0.35)";

        /* Badge horloge compact — couleur selon urgence */
        cdHtml = "<span id='"+cdId+"' class='ambi-countdown' data-ts='"+ech.getTime()+"' "
          +"style='font-family:Syne,sans-serif;font-weight:800;font-size:0.58rem;"
          +"color:"+st.color+";letter-spacing:0.03em;"
          +"background:"+st.bg+";border:1px solid "+st.border+";"
          +"border-radius:5px;padding:0.1rem 0.3rem;white-space:nowrap;'>--:--:--</span>";

        /* Bannière d'avertissement 72h */
        if(st.warn && msLeft > 0){
          var h72r = Math.floor(msLeft/3600000);
          var m72r = Math.floor((msLeft%3600000)/60000);
          cdHtml += "<span style='display:inline-flex;align-items:center;gap:0.2rem;font-size:0.52rem;color:var(--red);font-weight:900;white-space:nowrap;background:rgba(255,68,102,0.14);border:1px solid rgba(255,68,102,0.45);border-radius:5px;padding:0.08rem 0.28rem;letter-spacing:0.02em;animation:pulse 1.2s infinite;'>⚠ "+h72r+"h"+String(m72r).padStart(2,"0")+"</span>";
        } else if(msLeft <= 0){
          cdHtml = "<span style='font-size:0.58rem;color:var(--red);font-weight:800;background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.4);border-radius:5px;padding:0.1rem 0.3rem;'>🔴 EXPIRÉ</span>";
        }
      }
    } else if(e.paiement && e.paiement.indexOf("attente") !== -1){
      rowBorderColor = "rgba(255,215,0,0.3)";
      cdHtml = "<span style='font-size:0.55rem;color:var(--amber);font-weight:800;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.3);border-radius:5px;padding:0.1rem 0.3rem;white-space:nowrap;'>⏳ Attente</span>";
    }

    html+="<div class='notif-admin-item' data-nom='"+(e.nom||"").toLowerCase()+"' style='background:var(--surface2);border:1px solid "+rowBorderColor+";border-radius:8px;overflow:hidden;'>";
    html+="<button onclick=\"(function(){var el=document.getElementById('"+expandId+"');if(el){el.style.display=el.style.display==='none'?'block':'none';var arr=el.previousSibling.querySelector('.adm-ec-arrow');if(arr)arr.style.transform=el.style.display==='none'?'rotate(0deg)':'rotate(90deg)';}})()\" style='width:100%;display:flex;align-items:center;gap:0.4rem;padding:0.5rem 0.65rem;background:transparent;border:none;cursor:pointer;text-align:left;'>";
    html+="<span class='adm-ec-arrow' style='font-size:0.75rem;color:var(--muted);display:inline-block;transform:rotate(0deg);transition:transform 0.2s;flex-shrink:0;'>›</span>";
    html+=cdHtml;
    html+="<span style='font-size:0.78rem;font-weight:700;color:var(--text);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;'>"+e.nom+"</span>";
    html+="<span style='font-size:0.58rem;color:var(--muted);white-space:nowrap;margin-right:0.3rem;'>"+e.type+"</span>";
    html+="<span style='font-size:0.6rem;font-weight:700;color:"+sc+";white-space:nowrap;border:1px solid "+sc+";border-radius:20px;padding:0.06rem 0.35rem;background:rgba(0,0,0,0.2);'>"+(e.statut?(e.statut.replace("Ouvert - ","")):("–"))+"</span>";
    html+="</button>";
    /* ── Bannière d'avertissement 72h visible côté admin (sans avoir à ouvrir) ── */
    if(isPaid && e.abonnement_activated_at){
      var echBan = computeEcheance(e.abonnement_type||"mensuel", e.abonnement_activated_at);
      if(echBan){
        var msB = echBan.getTime() - Date.now();
        if(msB > 0 && msB <= 259200000){
          var hB = Math.floor(msB/3600000);
          var mB = Math.floor((msB%3600000)/60000);
          html+="<div style='display:flex;align-items:center;gap:0.45rem;background:rgba(255,68,102,0.09);border-top:1px solid rgba(255,68,102,0.35);padding:0.3rem 0.65rem;'>";
          html+="<span style='font-size:0.62rem;'>🚨</span>";
          html+="<span style='font-size:0.62rem;font-weight:800;color:var(--red);letter-spacing:0.02em;'>RENOUVELLEMENT URGENT — moins de 72h ("+hB+"h"+String(mB).padStart(2,"0")+" restantes)</span>";
          html+="</div>";
        } else if(msB <= 0){
          html+="<div style='display:flex;align-items:center;gap:0.45rem;background:rgba(255,68,102,0.12);border-top:1px solid rgba(255,68,102,0.45);padding:0.3rem 0.65rem;'>";
          html+="<span style='font-size:0.62rem;'>🔴</span>";
          html+="<span style='font-size:0.62rem;font-weight:800;color:var(--red);'>ABONNEMENT EXPIRÉ — fiche masquée</span>";
          html+="</div>";
        }
      }
    }
    html+="<div id='"+expandId+"' style='display:none;padding:0.6rem 0.75rem;border-top:1px solid rgba(255,255,255,0.06);'>";
    html+="<div style='font-size:0.65rem;color:var(--muted);margin-bottom:0.5rem;'>"+e.quartier+" · "+e.type+"</div>";
    html+="<div style='display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:0.5rem;'>";
    var statusOpts=["Ouvert - Anime","Ouvert - Bonde","Ouvert - Calme","Ferme"];
    statusOpts.forEach(function(s){
      html+="<button onclick=\"updateField("+e.id+",{statut:'"+s+"'})\" style='font-size:0.58rem;padding:0.18rem 0.4rem;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:"+(e.statut===s?"rgba(255,45,155,0.2)":"transparent")+";color:"+(e.statut===s?"var(--pink)":"var(--muted)")+";font-family:DM Sans,sans-serif;'>"+s.replace("Ouvert - ",'')+"</button>";
    });
    html+="</div>";
    html+="<div style='display:flex;gap:0.35rem;flex-wrap:wrap;align-items:center;'>";
    html+="<button onclick=\"deleteEtablissement("+e.id+")\" style='font-size:0.6rem;padding:0.18rem 0.45rem;border-radius:5px;background:rgba(255,68,102,0.08);border:1px solid rgba(255,68,102,0.3);color:var(--red);cursor:pointer;'>🗑 Supprimer</button>";
    html+="<button onclick=\"resetEstabPassword("+e.id+",'"+escHtml(e.nom)+"')\" style='font-size:0.6rem;padding:0.18rem 0.45rem;border-radius:5px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);cursor:pointer;font-weight:700;'>🔑 MDP</button>";
    html+="<button onclick=\"(function(){var etab=etablissements.find(function(x){return x.id==="+e.id+"});if(typeof window.openPublicProfile==='function'&&etab)window.openPublicProfile('etablissement',"+e.id+",etab);else showToast('ID:"+e._docId+"');})()\" style='font-size:0.6rem;padding:0.18rem 0.45rem;border-radius:5px;background:rgba(0,229,255,0.06);border:1px solid rgba(0,229,255,0.25);color:var(--cyan);cursor:pointer;'>👁 Infos</button>";
    html+="<span style='margin-left:auto;font-size:0.6rem;'>"+renderSubStatusBadge(e)+"</span>";
    html+="</div>";
    html+="</div>";
    html+="</div>";
  });
  html+="</div>";
  return html;
}

/* ── Vue DÉTAILLÉE : carte complète ── */
function _renderEtablCard(e){
  var sc=e.statut&&e.statut.indexOf("Bonde")!==-1?"var(--red)":e.statut&&e.statut.indexOf("Anime")!==-1?"var(--green)":e.statut&&e.statut.indexOf("Ouvert")!==-1?"var(--amber)":"var(--muted)";
  var isPaid = e.paiement && (e.paiement.indexOf("Actif")!==-1||e.paiement.indexOf("Confirme")!==-1);
  var msLeft = _getMsLeft(e);
  var st = _cdStyle(isPaid ? msLeft : null);

  /* Bordure carte selon urgence */
  var cardBorderColor = isPaid
    ? (st.warn ? "rgba(255,68,102,0.5)" : msLeft !== null && msLeft <= 604800000 ? "rgba(255,215,0,0.35)" : "rgba(0,255,170,0.18)")
    : (e.paiement && e.paiement.indexOf("attente") !== -1 ? "rgba(255,215,0,0.25)" : "rgba(255,255,255,0.07)");

  var html="<div class='notif-admin-item' data-nom='"+(e.nom||"").toLowerCase()+"' style='background:rgba(0,255,170,0.03);border:1px solid "+cardBorderColor+";border-radius:10px;padding:0.85rem;margin-bottom:0.6rem;'>";

  /* ── Badge urgence en haut de carte (vue détaillée) ── */
  if(isPaid && msLeft !== null){
    var urgBadge = "";
    if(msLeft <= 0){
      urgBadge = "<div style='display:inline-flex;align-items:center;gap:0.3rem;background:rgba(255,68,102,0.14);border:1.5px solid rgba(255,68,102,0.55);border-radius:7px;padding:0.22rem 0.6rem;margin-bottom:0.55rem;'>"
        +"<span style='font-size:0.65rem;'>🔴</span>"
        +"<span style='font-family:Syne,sans-serif;font-size:0.68rem;font-weight:900;color:var(--red);letter-spacing:0.04em;text-transform:uppercase;'>Abonnement expiré</span>"
        +"</div>";
    } else if(msLeft <= 259200000){ /* ≤72h */
      var hU = Math.floor(msLeft/3600000);
      var mU = Math.floor((msLeft%3600000)/60000);
      urgBadge = "<div style='display:inline-flex;align-items:center;gap:0.3rem;background:rgba(255,68,102,0.12);border:1.5px solid rgba(255,68,102,0.5);border-radius:7px;padding:0.22rem 0.6rem;margin-bottom:0.55rem;animation:pulse 1.4s infinite;'>"
        +"<span style='font-size:0.65rem;'>🚨</span>"
        +"<span style='font-family:Syne,sans-serif;font-size:0.68rem;font-weight:900;color:var(--red);letter-spacing:0.04em;text-transform:uppercase;'>Urgence 72h — "+hU+"h"+String(mU).padStart(2,"0")+" restantes</span>"
        +"</div>";
    } else if(msLeft <= 604800000){ /* ≤7j */
      var dU = Math.ceil(msLeft/86400000);
      urgBadge = "<div style='display:inline-flex;align-items:center;gap:0.3rem;background:rgba(255,215,0,0.09);border:1.5px solid rgba(255,215,0,0.38);border-radius:7px;padding:0.22rem 0.6rem;margin-bottom:0.55rem;'>"
        +"<span style='font-size:0.65rem;'>⚠️</span>"
        +"<span style='font-family:Syne,sans-serif;font-size:0.68rem;font-weight:800;color:var(--amber);letter-spacing:0.04em;'>Renouveler sous "+dU+" jour(s)</span>"
        +"</div>";
    }
    if(urgBadge) html += urgBadge;
  }
  if(isPaid && e.abonnement_activated_at){
    var ech = computeEcheance(e.abonnement_type||"mensuel", e.abonnement_activated_at);
    if(ech){
      var cdId = "admCdD_"+e.id;
      var planLbl = (SUBSCRIPTION_PLANS[e.abonnement_type||"mensuel"]||{}).label || "Mensuel";
      var echeanceStr = ech.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
      html+="<div style='display:flex;align-items:center;gap:0.5rem;background:"+st.bg+";border:1px solid "+st.border+";border-radius:8px;padding:0.4rem 0.65rem;margin-bottom:0.6rem;'>";
      html+="<span style='font-size:0.7rem;flex-shrink:0;'>⏱️</span>";
      html+="<div style='flex:1;min-width:0;'>";
      html+="<div style='font-size:0.58rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;'>Abonnement "+planLbl+" · exp. "+echeanceStr+"</div>";
      /* Avertissement 72h */
      if(msLeft !== null && msLeft > 0 && msLeft <= 259200000){
        var h72 = Math.floor(msLeft/3600000);
        var m72 = Math.floor((msLeft%3600000)/60000);
        html+="<div style='font-size:0.65rem;font-weight:800;color:var(--red);margin-top:0.1rem;'>⚠️ Moins de 72h ! — "+h72+"h"+String(m72).padStart(2,"0")+" restantes</div>";
      } else if(msLeft !== null && msLeft <= 0){
        html+="<div style='font-size:0.65rem;font-weight:800;color:var(--red);margin-top:0.1rem;'>🔴 Abonnement EXPIRÉ</div>";
      }
      html+="</div>";
      html+="<span id='"+cdId+"' class='ambi-countdown' data-ts='"+ech.getTime()+"' "
           +"style='font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;"
           +"color:"+st.color+";letter-spacing:0.06em;flex-shrink:0;white-space:nowrap;'>--:--:--</span>";
      html+="</div>";
    }
  } else if(e.paiement && e.paiement.indexOf("attente") !== -1){
    html+="<div style='display:flex;align-items:center;gap:0.5rem;background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.25);border-radius:8px;padding:0.38rem 0.65rem;margin-bottom:0.5rem;'>";
    html+="<span style='font-size:0.7rem;'>⏳</span>";
    html+="<span style='font-size:0.68rem;color:var(--amber);font-weight:700;'>Paiement en attente de confirmation</span>";
    html+="</div>";
  }

  html+="<div style='display:flex;justify-content:space-between;align-items:flex-start;gap:0.4rem;'>";
  html+="<div style='cursor:pointer;' onclick=\"(function(){var etab=etablissements.find(function(x){return x.id==="+e.id+"});if(typeof window.openPublicProfile==='function'&&etab)window.openPublicProfile('etablissement',"+e.id+",etab);else showToast('Fiche: "+e.nom+"');})()\"><div style='font-weight:700;font-size:0.85rem;color:var(--text);text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px;'>"+e.nom+"</div><div style='font-size:0.7rem;color:var(--muted);'>"+e.type+" · "+e.quartier+"</div></div>";
  html+="<span style='font-size:0.65rem;font-weight:700;color:"+sc+";white-space:nowrap;'>"+e.statut+"</span></div>";
  html+="<div style='display:flex;justify-content:space-between;align-items:center;margin-top:0.5rem;'>";
  html+="<div style='display:flex;gap:0.4rem;flex-wrap:wrap;align-items:center;'>";
  var statusOpts=["Ouvert - Anime","Ouvert - Bonde","Ouvert - Calme","Ferme"];
  statusOpts.forEach(function(s){
    html+="<button onclick=\"updateField("+e.id+",{statut:'"+s+"'})\" style='font-size:0.6rem;padding:0.2rem 0.45rem;border-radius:5px;cursor:pointer;border:1px solid rgba(255,255,255,0.12);background:"+(e.statut===s?"rgba(255,45,155,0.2)":"transparent")+";color:"+(e.statut===s?"var(--pink)":"var(--muted)")+";font-family:DM Sans,sans-serif;'>"+s.replace("Ouvert - ",'')+"</button>";
  });
  if(e._adminOverride){
    html+="<span style='font-size:0.58rem;background:rgba(255,215,0,0.12);border:1px solid rgba(255,215,0,0.35);color:var(--amber);border-radius:4px;padding:0.06rem 0.3rem;margin-left:0.2rem;'>✏️ Override</span>";
    html+="<button onclick=\"updateField("+e.id+",{_adminOverride:false})\" style='font-size:0.58rem;padding:0.18rem 0.42rem;border-radius:5px;cursor:pointer;border:1px solid rgba(0,229,255,0.35);background:rgba(0,229,255,0.08);color:var(--cyan);font-family:DM Sans,sans-serif;'>↺ Libérer</button>";
  }
  html+="</div>";
  html+="<input type='number' min='0' max='100' value='"+(e.affluence||0)+"' onchange=\"updateField("+e.id+",{affluence:parseInt(this.value)})\" title='Affluence %' style='width:55px;background:var(--surface2);border:1px solid rgba(255,255,255,0.1);border-radius:6px;color:var(--amber);font-size:0.8rem;padding:0.25rem 0.4rem;text-align:center;'>";
  html+="</div>";
  html+="<div style='display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;'>";
  html+="<button onclick=\"deleteEtablissement("+e.id+")\" style='font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:6px;background:rgba(255,68,102,0.08);border:1px solid rgba(255,68,102,0.3);color:var(--red);cursor:pointer;'>&#128465; Supprimer</button>";
  html+="<button onclick=\"resetEstabPassword("+e.id+",'"+escHtml(e.nom)+"')\" style='font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:6px;background:rgba(0,229,255,0.12);border:1px solid rgba(0,229,255,0.35);color:var(--cyan);cursor:pointer;font-weight:700;'>🔑 RÉZ. MOT DE PASSE</button>";
  html+="<button onclick=\"(function(){var etab=etablissements.find(function(x){return x.id==="+e.id+"});if(typeof window.openPublicProfile==='function'&&etab)window.openPublicProfile('etablissement',"+e.id+",etab);else showToast('ID:"+e._docId+" · Email:"+(e.email||'N/A')+"');})()\" style='font-size:0.65rem;padding:0.2rem 0.5rem;border-radius:6px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.3);color:var(--cyan);cursor:pointer;font-weight:700;'>&#128065; Infos</button>";
  html+="<span style='margin-left:auto;'>"+renderSubStatusBadge(e)+"</span>";
  html+="</div>";
  html+="</div>";
  return html;
}

function admRefreshEtabl(){ loadData(); setTimeout(function(){if(_currentAdmTab==="etabl")renderAdmEtabl();},1500); }
function admFilterEtabl(){
  var q=(document.getElementById("admSearchEtabl").value||"").toLowerCase();
  document.querySelectorAll("#adminEtablList .notif-admin-item").forEach(function(el){
    el.style.display=(el.getAttribute("data-nom")||"").indexOf(q)!==-1?"":"none";
  });
}
window.admRefreshEtabl=admRefreshEtabl;
window.admFilterEtabl=admFilterEtabl;
window._renderEtablCompact=_renderEtablCompact;
window._renderEtablCard=_renderEtablCard;

// ── Membres admin ─────────────────────────────────────────────
function renderAdmUsers(){
  var superEmail = _superAdminEmail || lsGet(SUPER_ADMIN_KEY, "");
  // L'admin connecté via PIN (sans compte Firebase) est TOUJOURS le propriétaire
  var iAmSuper = isAdmin && isSuperAdminUser();

  // En-tête : info super-admin + bouton transfert
  var headerHtml = "";
  if(iAmSuper){
    headerHtml += "<div style='background:linear-gradient(135deg,rgba(255,215,0,0.12),rgba(255,45,155,0.08));border:1px solid rgba(255,215,0,0.3);border-radius:14px;padding:0.9rem;margin-bottom:1rem;'>";
    headerHtml += "<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;'>";
    headerHtml += "<span style='font-size:1rem;'>👑</span><span style='font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.85rem;'>Vous êtes le Propriétaire (SuperAdmin)</span></div>";
    headerHtml += "<div style='font-size:0.7rem;color:var(--muted);'>Vous seul pouvez promouvoir / révoquer des admins et transférer la propriété de l'application.</div>";
    headerHtml += "</div>";
  } else if(superEmail){
    headerHtml += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.7rem;margin-bottom:0.8rem;font-size:0.7rem;color:var(--muted);'>";
    headerHtml += "👑 Propriétaire : <strong style='color:var(--amber);'>"+escHtml(superEmail)+"</strong></div>";
  }

  // Section admins secondaires
  var adminsHtml = "<div style='background:rgba(255,215,0,0.04);border:1px solid rgba(255,215,0,0.18);border-radius:14px;padding:0.85rem;margin-bottom:1rem;'>";
  adminsHtml += "<div style='font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>🔑 Admins secondaires ("+_adminsList.length+")</div>";
  if(!_adminsList.length){
    adminsHtml += "<div style='font-size:0.75rem;color:var(--muted);text-align:center;padding:0.5rem;'>Aucun admin secondaire pour l'instant</div>";
  }
  _adminsList.forEach(function(a){
    adminsHtml += "<div style='display:flex;align-items:center;gap:0.5rem;background:rgba(255,255,255,0.03);border-radius:10px;padding:0.55rem 0.7rem;margin-bottom:0.4rem;'>";
    adminsHtml += "<div style='width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,var(--amber),var(--pink));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.8rem;color:#000;flex-shrink:0;'>"+((a.pseudo||a.email||"?")[0]).toUpperCase()+"</div>";
    adminsHtml += "<div style='flex:1;min-width:0;'>";
    adminsHtml += "<div style='font-weight:700;font-size:0.78rem;color:var(--text);'>"+escHtml(a.pseudo||"Inconnu")+" <span style='font-size:0.58rem;background:rgba(255,215,0,0.15);color:var(--amber);padding:0.05rem 0.3rem;border-radius:4px;border:1px solid rgba(255,215,0,0.3);'>Admin</span></div>";
    adminsHtml += "<div style='font-size:0.63rem;color:var(--muted);'>"+escHtml(a.email||"")+"</div>";
    adminsHtml += "</div>";
    if(iAmSuper){
      adminsHtml += "<div style='display:flex;gap:0.3rem;flex-shrink:0;'>";
      adminsHtml += "<button onclick=\"revokeAdmin('"+escHtml(a.uid||"")+"','"+escHtml(a.email||"")+"','"+escHtml(a.pseudo||"")+"')\" style='font-size:0.62rem;padding:0.22rem 0.5rem;border-radius:6px;background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:var(--red);cursor:pointer;font-family:DM Sans,sans-serif;'>✕ Révoquer</button>";
      adminsHtml += "<button onclick=\"transferOwnership('"+escHtml(a.uid||"")+"','"+escHtml(a.email||"")+"','"+escHtml(a.pseudo||"")+"')\" style='font-size:0.62rem;padding:0.22rem 0.5rem;border-radius:6px;background:rgba(255,215,0,0.08);border:1px solid rgba(255,215,0,0.25);color:var(--amber);cursor:pointer;font-family:DM Sans,sans-serif;'>👑 Céder</button>";
      adminsHtml += "<button onclick=\"designateSuccessor('"+escHtml(a.uid||"")+"','"+escHtml(a.email||"")+"','"+escHtml(a.pseudo||"")+"')\" style='font-size:0.62rem;padding:0.22rem 0.5rem;border-radius:6px;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.22);color:var(--cyan);cursor:pointer;font-family:DM Sans,sans-serif;'>🔮 Successeur</button>";
      adminsHtml += "</div>";
    }
    adminsHtml += "</div>";
  });
  adminsHtml += "</div>";

  document.getElementById("adminUsersContent").innerHTML = headerHtml + adminsHtml + "<div id='adminMembersList'><div style='font-size:0.75rem;color:var(--muted);text-align:center;padding:1.5rem;'>Chargement des membres...</div></div>";

  // Charger les membres depuis Firebase (avec retry si pas encore dispo)
  function _loadMembers(attempt){
    attempt = attempt || 1;
    if(!window.db || typeof window.fbCollection !== "function" || typeof window.fbGetDocs !== "function"){
      if(attempt <= 20){
        // Firebase pas encore pret : reessayer dans 300ms (max 6 secondes)
        document.getElementById("adminMembersList").innerHTML = "<div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.78rem;'>⏳ Connexion Firebase en cours...</div>";
        setTimeout(function(){ _loadMembers(attempt+1); }, 300);
      } else {
        document.getElementById("adminMembersList").innerHTML = "<div style='text-align:center;padding:2rem;color:var(--red);font-size:0.82rem;'>❌ Firebase non disponible. Vérifiez votre connexion.</div>";
      }
      return;
    }
    // Firebase pret : charger aussi la config superadmin si besoin
    if(!_superAdminEmail && isAdmin && currentUserEmail){
      if(!lsGet(SUPER_ADMIN_KEY, "")){
        _superAdminEmail = currentUserEmail;
        lsSet(SUPER_ADMIN_KEY, currentUserEmail);
        isSuperAdmin = true;
        // Re-render header avec le bon statut SuperAdmin
        renderAdmUsers();
        return;
      }
    }
    var col = window.fbCollection(window.db, "users");
    window.fbGetDocs(col).then(function(snap){
      var users = [];
      snap.forEach(function(d){ users.push(Object.assign({uid:d.id}, d.data())); });

      var h = "<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--cyan);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>👥 Membres inscrits ("+users.length+")</div>";
      if(!users.length){
        h += "<div style='text-align:center;padding:2rem;color:var(--muted);'>Aucun membre pour l'instant</div>";
        document.getElementById("adminMembersList").innerHTML = h; return;
      }

      // Trier : admins secondaires en premier, puis ordre alphabétique
      var adminEmails = _adminsList.map(function(a){ return (a.email||"").toLowerCase(); });
      users.sort(function(a,b){
        var aIsAdm = adminEmails.indexOf((a.email||"").toLowerCase()) !== -1;
        var bIsAdm = adminEmails.indexOf((b.email||"").toLowerCase()) !== -1;
        if(aIsAdm && !bIsAdm) return -1;
        if(!aIsAdm && bIsAdm) return 1;
        return (a.pseudo||a.email||"").localeCompare(b.pseudo||b.email||"");
      });

      users.forEach(function(u){
        var em = (u.email||"").toLowerCase();
        var isAdminUser = adminEmails.indexOf(em) !== -1;
        // isSuperUser : marquer le membre si son email = celui du superadmin Firebase
        // Quand superEmail est vide (PIN admin sans compte), personne n'est marqué superUser → boutons visibles
        var isSuperUser = superEmail ? (em === superEmail.toLowerCase()) : false;
        var myEtab = etablissements.find(function(e){ return (e.email||"").toLowerCase().trim() === em; });

        var uData = { uid:u.uid||"", email:u.email||"", pseudo:u.pseudo||"", tel:u.tel||"", dob:u.dob||"", createdAt:u.createdAt||"", isAdmin:isAdminUser, etabNom:myEtab?myEtab.nom:"" };
        var uDataStr = encodeURIComponent(JSON.stringify(uData));
        h += "<div class='notif-admin-item' style='"+(isAdminUser?"border-color:rgba(255,215,0,0.2);":"")+"'>";
        h += "<div style='display:flex;align-items:center;gap:0.6rem;cursor:pointer;' onclick=\"openUserProfile(decodeURIComponent('"+uDataStr+"'))\">";

        // Avatar — avec chargement photo réelle si disponible
        var avatarId = "admAvatar_"+escHtml(u.uid||u.email||"?");
        var avatarGrad = isSuperUser ? "linear-gradient(135deg,var(--amber),var(--pink))" : isAdminUser ? "linear-gradient(135deg,var(--amber),var(--cyan))" : "linear-gradient(135deg,var(--pink),var(--cyan))";
        h += "<div id='"+avatarId+"' style='width:34px;height:34px;border-radius:50%;background:"+avatarGrad+";display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;color:#000;flex-shrink:0;overflow:hidden;'>"+((u.pseudo||u.email||"?")[0]).toUpperCase()+"</div>";

        // Infos
        h += "<div style='flex:1;min-width:0;'>";
        h += "<div style='font-weight:700;font-size:0.82rem;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>"+escHtml(u.pseudo||"Inconnu");
        if(isSuperUser) h += " <span style='font-size:0.58rem;background:rgba(255,215,0,0.2);color:var(--amber);padding:0.05rem 0.35rem;border-radius:5px;border:1px solid rgba(255,215,0,0.4);'>👑 Propriétaire</span>";
        else if(isAdminUser) h += " <span style='font-size:0.58rem;background:rgba(255,215,0,0.12);color:var(--amber);padding:0.05rem 0.3rem;border-radius:5px;border:1px solid rgba(255,215,0,0.25);'>🔑 Admin</span>";
        if(myEtab) h += " <span style='font-size:0.58rem;background:rgba(255,45,155,0.12);color:var(--pink);padding:0.05rem 0.3rem;border-radius:5px;border:1px solid rgba(255,45,155,0.25);'>🏠 "+escHtml(myEtab.nom)+"</span>";
        h += "</div>";
        h += "<div style='font-size:0.65rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'>"+escHtml(u.email||"")+"</div>";
        if(u.tel) h += "<div style='font-size:0.62rem;color:var(--cyan);'>"+escHtml(u.tel)+"</div>";
        h += "</div>";

        h += "<div style='text-align:right;font-size:0.6rem;color:var(--muted);flex-shrink:0;'>"+(u.createdAt?new Date(u.createdAt).toLocaleDateString("fr-FR"):"")+"</div>";
        // Badge notifs non lues (si Firebase dispo, chargé en asynchrone)
        h += "<div id='_admNotifBadge_"+escHtml(u.uid||"")+"' style='flex-shrink:0;'></div>";
        h += "</div>";

        // Boutons d'action (SuperAdmin uniquement, pas sur soi-même)
        var isMySelf = currentUserEmail && em === currentUserEmail.toLowerCase();
        if(iAmSuper && !isSuperUser && !isMySelf){
          h += "<div style='display:flex;gap:0.35rem;margin-top:0.5rem;flex-wrap:wrap;'>";
          if(!isAdminUser){
            h += "<button onclick=\"promoteToAdmin('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"')\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.35);color:var(--amber);cursor:pointer;font-family:DM Sans,sans-serif;'>🔑 Promouvoir Admin</button>";
            h += "<button onclick=\"designateSuccessor('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"')\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.22);color:var(--cyan);cursor:pointer;font-family:DM Sans,sans-serif;'>🔮 Désigner successeur</button>";
          } else {
            h += "<button onclick=\"revokeAdmin('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"')\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:var(--red);cursor:pointer;font-family:DM Sans,sans-serif;'>✕ Révoquer Admin</button>";
            h += "<button onclick=\"transferOwnership('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"')\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,215,0,0.06);border:1px solid rgba(255,215,0,0.2);color:var(--amber);cursor:pointer;font-family:DM Sans,sans-serif;'>👑 Céder propriété</button>";
          }
          // Bouton Assigner établissement (disponible pour tout membre sans étab déjà assigné)
          if(!myEtab){
            h += "<button onclick=\"openAssignEtabModal('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"')\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,45,155,0.08);border:1px solid rgba(255,45,155,0.25);color:var(--pink);cursor:pointer;font-family:DM Sans,sans-serif;'>🏠 Assigner établissement</button>";
          }
          // ── Bouton Réinitialiser MDP (SuperAdmin uniquement) ──
          h += "<button onclick=\"resetMemberPassword('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"',null)\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,215,0,0.09);border:1px solid rgba(255,215,0,0.35);color:var(--amber);cursor:pointer;font-family:DM Sans,sans-serif;font-weight:700;'>🔑 Réinitialiser MDP</button>";
          // ── Bouton Désigner Chauffeur ──
          var isDriver = window._chauffeurDrivers && Object.values(window._chauffeurDrivers).some(function(d){ return d.email.toLowerCase()===em && d.status==='approved'; });
          if(!isDriver){
            h += "<button onclick=\"adminDesignDriver('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"',null)\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(157,132,255,0.12);border:1px solid rgba(157,132,255,0.4);color:var(--amber);cursor:pointer;font-family:DM Sans,sans-serif;font-weight:700;'>🚗 Désigner Chauffeur...</button>";
          } else {
            h += "<button onclick=\"adminRevokeDriver('"+escHtml(u.uid)+"');renderAdmUsers()\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,68,102,0.08);border:1px solid rgba(255,68,102,0.25);color:var(--red);cursor:pointer;font-family:DM Sans,sans-serif;'>🚗 Révoquer Chauffeur</button>";
          }
          // ── Bouton Supprimer Membre ──
          h += "<button onclick=\"deleteMember('"+escHtml(u.uid)+"','"+escHtml(u.email||"")+"','"+escHtml(u.pseudo||"")+"')\" style='font-size:0.63rem;padding:0.25rem 0.55rem;border-radius:6px;background:rgba(255,68,102,0.15);border:1px solid rgba(255,68,102,0.45);color:var(--red);cursor:pointer;font-family:DM Sans,sans-serif;font-weight:700;'>🗑️ Supprimer membre</button>";
          h += "</div>";
        }

        h += "</div>";
      });
      document.getElementById("adminMembersList").innerHTML = h;

      // 🖼️ Charger les vraies photos de profil en arrière-plan
      users.forEach(function(u){
        if(!u.uid) return;
        var elId = "admAvatar_"+escHtml(u.uid||u.email||"?");
        loadUserAvatar(u.uid, function(url){
          if(!url) return;
          var el = document.getElementById(elId);
          if(!el) return;
          var img = new Image();
          img.onload = function(){
            el.innerHTML = "";
            el.style.background = "none";
            el.style.padding = "0";
            var imgEl = document.createElement("img");
            imgEl.src = url;
            imgEl.style.cssText = "width:34px;height:34px;border-radius:50%;object-fit:cover;display:block;";
            el.appendChild(imgEl);
          };
          img.src = url;
        });

        // 🔔 Charger les badges de notifications non lues depuis Firebase
        if(window.db && window.fbDoc && window.fbGetDoc){
          (function(userId){
            window.fbGetDoc(window.fbDoc(window.db, "user_notifications", userId)).then(function(snap){
              if(!snap.exists()) return;
              var unread = (snap.data().items||[]).filter(function(n){ return n.unread; }).length;
              if(!unread) return;
              var badge = document.getElementById("_admNotifBadge_"+userId);
              if(badge) badge.innerHTML = '<div style="background:var(--pink);color:#000;font-size:0.58rem;font-weight:800;padding:0.08rem 0.35rem;border-radius:10px;white-space:nowrap;">🔔 '+unread+' non lue'+(unread>1?"s":"")+'</div>';
            }).catch(function(){});
          })(u.uid);
        }
      });

    }).catch(function(err){
      document.getElementById("adminMembersList").innerHTML = "<div style='color:var(--red);font-size:0.8rem;padding:1rem;text-align:center;'>Erreur: "+err.message+"</div>";
    });
  }
  _loadMembers(1);
}

// ── Supprimer un membre (SuperAdmin uniquement) ─────────────────
function deleteMember(uid, email, pseudo) {
  var nom = pseudo || email || uid;
  if (!confirm("⚠️ Supprimer définitivement le membre \"" + nom + "\" ?\n\nCette action supprimera son compte de la base de données. Elle est irréversible.")) return;
  if (!window.db || !window.fbDeleteDoc || !window.fbDoc) {
    showToast("❌ Firebase non disponible."); return;
  }
  // Supprimer le document utilisateur dans Firestore
  var docRef = window.fbDoc(window.db, "users", uid);
  window.fbDeleteDoc(docRef).then(function() {
    showToast("🗑️ Membre \"" + nom + "\" supprimé.");
    // Si c'était un admin secondaire, le retirer de la liste
    var em = (email || "").toLowerCase();
    _adminsList = _adminsList.filter(function(a){ return (a.email||"").toLowerCase() !== em; });
    if (_adminsList !== undefined && window.fbSetDoc && window.fbDoc) {
      window.fbSetDoc(window.fbDoc(window.db, "config", "admins"), { list: _adminsList }).catch(function(){});
    }
    // Rafraîchir la liste
    renderAdmUsers();
  }).catch(function(err) {
    showToast("❌ Erreur suppression : " + err.message);
  });
}
window.deleteMember = deleteMember;

// ── Support / Tchat de réception des demandes ──────────────────
var _supportFilter = "open"; // open | in_progress | resolved | all

function renderAdmSupport(){
  var container = document.getElementById("adminSupportContent");
  if(!container) return;

  var iAmSuper = isAdmin && isSuperAdminUser();
  var filterBtns = [
    {k:"open",      l:"🟠 Ouvertes",    c:"var(--red)"},
    {k:"in_progress",l:"🔵 En cours",   c:"var(--cyan)"},
    {k:"resolved",  l:"✅ Résolues",     c:"var(--green)"},
    {k:"all",       l:"📋 Tout",         c:"var(--muted)"}
  ];

  var h = "";
  // ── En-tête ──
  h += "<div style='background:linear-gradient(135deg,rgba(255,45,155,0.1),rgba(204,68,255,0.07));border:1px solid rgba(255,45,155,0.3);border-radius:14px;padding:0.9rem;margin-bottom:1rem;'>";
  h += "<div style='display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.5rem;'>";
  h += "<div><div style='font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.9rem;'>💬 Centre de Support</div>";
  h += "<div style='font-size:0.7rem;color:var(--muted);margin-top:0.2rem;'>Requêtes membres — réinitialisation MDP & assistance</div></div>";
  h += "<button onclick='renderAdmSupport()' style='padding:0.35rem 0.7rem;border-radius:8px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.08);color:var(--cyan);font-size:0.72rem;font-weight:700;cursor:pointer;'>↺ Actualiser</button>";
  h += "</div>";
  h += "</div>";

  // ── Filtres ──
  h += "<div style='display:flex;gap:0.35rem;flex-wrap:wrap;margin-bottom:1rem;'>";
  filterBtns.forEach(function(f){
    var isActive = (_supportFilter === f.k);
    h += "<button onclick=\"_supportFilter='"+f.k+"';renderAdmSupport()\" style='font-size:0.68rem;font-weight:700;padding:0.3rem 0.65rem;border-radius:20px;cursor:pointer;border:1px solid "+(isActive?f.c:"rgba(255,255,255,0.1)")+";background:"+(isActive?"rgba(255,255,255,0.08)":"transparent")+";color:"+(isActive?f.c:"var(--muted)")+";font-family:DM Sans,sans-serif;'>"+f.l+"</button>";
  });
  h += "</div>";

  h += "<div id='supportTicketList'><div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.78rem;'>⏳ Chargement des tickets...</div></div>";

  container.innerHTML = h;

  // ── Charger les tickets Firebase ──
  if(!window.db || !window.fbCollection || !window.fbGetDocs){
    document.getElementById("supportTicketList").innerHTML = "<div style='text-align:center;padding:2rem;color:var(--red);font-size:0.82rem;'>❌ Firebase non disponible</div>";
    return;
  }

  var col = window.fbCollection(window.db, "support_requests");
  var qArgs = [col];

  // Filtre par statut
  if(_supportFilter !== "all"){
    if(window.fbQuery && window.fbWhere){
      window.fbGetDocs(window.fbQuery(col, window.fbWhere("status","==",_supportFilter))).then(_renderTickets).catch(_supportErr);
      return;
    }
  }
  window.fbGetDocs(col).then(_renderTickets).catch(_supportErr);

  function _supportErr(err){
    var tl = document.getElementById("supportTicketList");
    if(tl) tl.innerHTML = "<div style='color:var(--red);padding:1rem;text-align:center;font-size:0.8rem;'>Erreur: "+err.message+"</div>";
  }

  function _renderTickets(snap){
    var tickets = [];
    snap.forEach(function(d){ tickets.push(Object.assign({_id:d.id}, d.data())); });

    // Filtre côté client si query non disponible
    if(_supportFilter !== "all"){
      tickets = tickets.filter(function(t){ return t.status === _supportFilter; });
    }

    // Tri : plus récents en premier
    tickets.sort(function(a,b){
      return new Date(b.createdAt||0) - new Date(a.createdAt||0);
    });

    var tl = document.getElementById("supportTicketList");
    if(!tl) return;

    if(!tickets.length){
      tl.innerHTML = "<div style='text-align:center;padding:3rem 1rem;'><div style='font-size:2.5rem;margin-bottom:0.5rem;'>📭</div><div style='color:var(--muted);font-size:0.82rem;'>Aucun ticket dans cette catégorie</div></div>";
      return;
    }

    var typeLabels = {
      reset_password:"🔑 Réinitialisation MDP",
      compte_bloque:"🔒 Compte bloqué",
      info_compte:"ℹ️ Info compte",
      suppression:"🗑️ Suppression compte",
      autre:"📩 Autre"
    };
    var statusConfig = {
      open:        {label:"Ouvert",      bg:"rgba(255,68,102,0.12)",  border:"rgba(255,68,102,0.3)",   col:"var(--red)"},
      in_progress: {label:"En cours",    bg:"rgba(0,229,255,0.08)",   border:"rgba(0,229,255,0.3)",    col:"var(--cyan)"},
      resolved:    {label:"Résolu",      bg:"rgba(0,255,170,0.07)",   border:"rgba(0,255,170,0.25)",   col:"var(--green)"}
    };

    var out = "";
    tickets.forEach(function(t){
      var sc = statusConfig[t.status] || statusConfig.open;
      var msgs = t.messages || [];
      var lastMsg = msgs.length ? msgs[msgs.length-1] : null;
      var createdFmt = t.createdAt ? new Date(t.createdAt).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"}) : "";
      var resolvedFmt = t.resolvedAt ? new Date(t.resolvedAt).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
      var typeLabel = typeLabels[t.type] || "📩 Demande";

      out += "<div style='background:"+sc.bg+";border:1px solid "+sc.border+";border-radius:14px;padding:1rem;margin-bottom:0.8rem;'>";

      // ── Ticket header ──
      out += "<div style='display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem;'>";
      out += "<div style='flex:1;min-width:0;'>";
      out += "<div style='display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;'>";
      out += "<div style='width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:0.85rem;flex-shrink:0;'>"+((t.pseudo||t.email||"?")[0]).toUpperCase()+"</div>";
      out += "<div>";
      out += "<div style='font-weight:700;font-size:0.82rem;color:var(--text);'>"+escHtml(t.pseudo||"Membre")+"</div>";
      out += "<div style='font-size:0.63rem;color:var(--muted);'>"+escHtml(t.email||"")+"</div>";
      out += "</div></div></div>";
      out += "<div style='text-align:right;flex-shrink:0;'>";
      out += "<div style='font-size:0.65rem;font-weight:700;color:"+sc.col+";background:"+sc.bg+";border:1px solid "+sc.border+";padding:0.15rem 0.5rem;border-radius:20px;display:inline-block;'>"+sc.label+"</div>";
      out += "<div style='font-size:0.6rem;color:var(--muted);margin-top:0.2rem;'>"+createdFmt+"</div>";
      out += "</div></div>";

      // ── Type de demande ──
      out += "<div style='font-size:0.72rem;color:var(--amber);font-weight:700;margin-bottom:0.5rem;'>"+typeLabel+"</div>";

      // ── Thread messages ──
      out += "<div style='background:rgba(0,0,0,0.2);border-radius:10px;padding:0.6rem;margin-bottom:0.7rem;max-height:180px;overflow-y:auto;'>";
      if(!msgs.length){
        out += "<div style='font-size:0.72rem;color:var(--muted);text-align:center;padding:0.5rem;'>Aucun message</div>";
      }
      msgs.forEach(function(m){
        var isAdmin_ = m.from === "admin";
        var mTime = m.ts ? new Date(m.ts).toLocaleString("fr-FR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";
        out += "<div style='margin-bottom:0.5rem;display:flex;flex-direction:column;align-items:"+(isAdmin_?"flex-end":"flex-start")+"'>";
        out += "<div style='max-width:85%;background:"+(isAdmin_?"rgba(255,45,155,0.15)":"rgba(255,255,255,0.06)")+";border:1px solid "+(isAdmin_?"rgba(255,45,155,0.3)":"rgba(255,255,255,0.1)")+";border-radius:"+(isAdmin_?"12px 12px 2px 12px":"12px 12px 12px 2px")+";padding:0.45rem 0.65rem;'>";
        out += "<div style='font-size:0.65rem;font-weight:700;color:"+(isAdmin_?"var(--pink)":"var(--cyan)")+";margin-bottom:0.15rem;'>"+(isAdmin_?"👑 Super Admin":"👤 "+escHtml(t.pseudo||"Membre"))+"</div>";
        out += "<div style='font-size:0.75rem;color:var(--text);white-space:pre-wrap;word-break:break-word;'>"+escHtml(m.text||"")+"</div>";
        out += "<div style='font-size:0.58rem;color:var(--muted);margin-top:0.15rem;text-align:right;'>"+mTime+"</div>";
        out += "</div></div>";
      });
      out += "</div>";

      // ── Zone réponse admin (tickets non résolus) ──
      if(t.status !== "resolved" && iAmSuper){
        var tid = t._id;
        out += "<div style='margin-bottom:0.5rem;'>";
        out += "<textarea id='supportReply_"+tid+"' placeholder='Votre réponse au membre...' maxlength='500' style='width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.78rem;resize:vertical;min-height:60px;font-family:DM Sans,sans-serif;'></textarea>";
        out += "</div>";
        out += "<div style='display:flex;gap:0.4rem;flex-wrap:wrap;'>";
        out += "<button onclick=\"_supportSendReply('"+tid+"','"+escHtml(t.uid||"")+"','"+escHtml(t.email||"")+"','"+escHtml(t.pseudo||"")+"')\" style='flex:1;font-size:0.7rem;padding:0.38rem 0.6rem;border-radius:8px;background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.35);color:var(--pink);cursor:pointer;font-weight:700;font-family:DM Sans,sans-serif;'>📤 Envoyer réponse</button>";
        if(t.type === "reset_password"){
          out += "<button onclick=\"resetMemberPassword('"+escHtml(t.uid||"")+"','"+escHtml(t.email||"")+"','"+escHtml(t.pseudo||"")+"','"+tid+"')\" style='flex:1;font-size:0.7rem;padding:0.38rem 0.6rem;border-radius:8px;background:rgba(255,215,0,0.1);border:1px solid rgba(255,215,0,0.35);color:var(--amber);cursor:pointer;font-weight:700;font-family:DM Sans,sans-serif;'>🔑 Réinitialiser + Notifier</button>";
        }
        out += "<button onclick=\"_supportMarkInProgress('"+tid+"')\" style='font-size:0.7rem;padding:0.38rem 0.6rem;border-radius:8px;background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.25);color:var(--cyan);cursor:pointer;font-family:DM Sans,sans-serif;'>🔵 En cours</button>";
        out += "<button onclick=\"_supportCloseTicket('"+tid+"')\" style='font-size:0.7rem;padding:0.38rem 0.6rem;border-radius:8px;background:rgba(0,255,170,0.07);border:1px solid rgba(0,255,170,0.25);color:var(--green);cursor:pointer;font-family:DM Sans,sans-serif;'>✅ Clore</button>";
        out += "</div>";
      }

      if(t.status === "resolved" && resolvedFmt){
        out += "<div style='font-size:0.62rem;color:var(--green);margin-top:0.4rem;text-align:right;'>✅ Résolu le "+resolvedFmt+"</div>";
      }

      out += "</div>"; // fin ticket card
    });

    tl.innerHTML = out;
  }
}
window.renderAdmSupport = renderAdmSupport;

// ── Envoyer une réponse admin sur un ticket ──
function _supportSendReply(ticketId, uid, email, pseudo){
  var ta = document.getElementById("supportReply_"+ticketId);
  var text = ta ? ta.value.trim() : "";
  if(!text){ showToast("Rédigez une réponse d'abord"); return; }
  if(!window.db || !window.fbDoc || !window.fbGetDoc || !window.fbUpdateDoc){ showToast("Firebase requis"); return; }
  var docRef = window.fbDoc(window.db, "support_requests", ticketId);
  var now = new Date().toISOString();
  showToast("⏳ Envoi...");
  window.fbGetDoc(docRef).then(function(snap){
    var data = snap.exists() ? snap.data() : {};
    var msgs = data.messages || [];
    msgs.push({ from:"admin", text:text, ts:now });
    return window.fbUpdateDoc(docRef, { messages:msgs, status:"in_progress", lastAdminReply:now });
  }).then(function(){
    showToast("✅ Réponse envoyée à "+pseudo);
    if(ta) ta.value = "";
    renderAdmSupport();
  }).catch(function(err){ showToast("Erreur: "+err.message); });
}
window._supportSendReply = _supportSendReply;

// ── Marquer "En cours" ──
function _supportMarkInProgress(ticketId){
  if(!window.db||!window.fbDoc||!window.fbUpdateDoc) return;
  window.fbUpdateDoc(window.fbDoc(window.db,"support_requests",ticketId),{status:"in_progress"})
    .then(function(){ renderAdmSupport(); }).catch(function(err){ showToast(err.message); });
}
window._supportMarkInProgress = _supportMarkInProgress;

// ── Clore un ticket ──
function _supportCloseTicket(ticketId){
  if(!window.db||!window.fbDoc||!window.fbUpdateDoc) return;
  window.fbUpdateDoc(window.fbDoc(window.db,"support_requests",ticketId),{status:"resolved",resolvedAt:new Date().toISOString()})
    .then(function(){ showToast("✅ Ticket clôturé"); renderAdmSupport(); }).catch(function(err){ showToast(err.message); });
}
window._supportCloseTicket = _supportCloseTicket;

// ── Badge support dans vue d'ensemble : nb tickets ouverts ──
function _loadSupportBadge(){
  if(!window.db||!window.fbCollection||!window.fbGetDocs) return;
  var col = window.fbCollection(window.db, "support_requests");
  var q = (window.fbQuery && window.fbWhere) ? window.fbQuery(col, window.fbWhere("status","==","open")) : col;
  window.fbGetDocs(q).then(function(snap){
    var n = 0;
    if(window.fbWhere){ n = snap.size; }
    else { snap.forEach(function(d){ if(d.data().status==="open") n++; }); }
    var badge = document.getElementById("admSupportBadge");
    if(badge){ badge.textContent = n > 0 ? n : ""; badge.style.display = n > 0 ? "inline-flex" : "none"; }
    // Badge aussi dans overview
    var ob = document.getElementById("admOverviewSupportCount");
    if(ob) ob.textContent = n;
  }).catch(function(){});
}
window._loadSupportBadge = _loadSupportBadge;

// ── Membre : voir ses propres tickets de support ──
function memberViewMyTickets(){
  var uid = window.currentUserUid || (window.auth && window.auth.currentUser && window.auth.currentUser.uid) || "";
  var email = window.currentUserEmail || "";
  if(!uid && !email){ showToast("Connectez-vous d'abord"); return; }
  if(!window.db||!window.fbCollection||!window.fbGetDocs){ showToast("Firebase requis"); return; }

  var existingModal = document.getElementById("myTicketsModal");
  if(existingModal) existingModal.remove();

  var overlay = document.createElement("div");
  overlay.id = "myTicketsModal";
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;padding:1rem;";

  var inner = document.createElement("div");
  inner.style.cssText = "background:var(--surface);border:1px solid rgba(255,45,155,0.3);border-radius:20px;padding:1.4rem;width:min(420px,100%);max-height:90vh;overflow-y:auto;position:relative;";
  inner.innerHTML = "<button onclick=\"document.getElementById('myTicketsModal').remove()\" style='position:absolute;top:0.7rem;right:0.7rem;background:rgba(255,68,102,0.12);border:1px solid rgba(255,68,102,0.3);color:var(--red);width:30px;height:30px;border-radius:50%;cursor:pointer;'>✕</button><div style='font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.95rem;margin-bottom:0.3rem;'>💬 Mes demandes de support</div><div style='font-size:0.72rem;color:var(--muted);margin-bottom:1rem;'>Suivez l'état de vos requêtes</div><div id='myTicketsList'>⏳ Chargement...</div>";
  overlay.appendChild(inner);
  document.body.appendChild(overlay);
  overlay.addEventListener("click", function(e){ if(e.target===overlay) overlay.remove(); });

  var col = window.fbCollection(window.db, "support_requests");
  var qr = (window.fbQuery && window.fbWhere) ? window.fbQuery(col, window.fbWhere("email","==",email)) : col;
  window.fbGetDocs(qr).then(function(snap){
    var tickets = [];
    snap.forEach(function(d){
      var data = d.data();
      if(!window.fbWhere || data.email === email) tickets.push(Object.assign({_id:d.id}, data));
    });
    tickets.sort(function(a,b){ return new Date(b.createdAt||0)-new Date(a.createdAt||0); });

    var list = document.getElementById("myTicketsList");
    if(!list) return;
    if(!tickets.length){ list.innerHTML = "<div style='text-align:center;padding:2rem;color:var(--muted);'>Aucune demande envoyée</div>"; return; }

    var html = "";
    var statusIco = {open:"🟠",in_progress:"🔵",resolved:"✅"};
    var statusLbl = {open:"En attente",in_progress:"En cours",resolved:"Résolu"};
    tickets.forEach(function(t){
      html += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.8rem;margin-bottom:0.7rem;'>";
      html += "<div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:0.4rem;'>";
      html += "<div style='font-size:0.75rem;font-weight:700;color:var(--text);'>"+(t.type==="reset_password"?"🔑 Réinitialisation MDP":"📩 "+t.type)+"</div>";
      html += "<div style='font-size:0.65rem;color:var(--muted);'>"+(statusIco[t.status]||"🟠")+" "+(statusLbl[t.status]||t.status)+"</div>";
      html += "</div>";
      var msgs = t.messages || [];
      msgs.forEach(function(m){
        var isAdm = m.from==="admin";
        html += "<div style='background:"+(isAdm?"rgba(255,45,155,0.1)":"rgba(255,255,255,0.04)")+";border-radius:8px;padding:0.4rem 0.6rem;margin-bottom:0.3rem;border-left:2px solid "+(isAdm?"var(--pink)":"var(--cyan)")+";'>";
        html += "<div style='font-size:0.6rem;font-weight:700;color:"+(isAdm?"var(--pink)":"var(--cyan)")+";margin-bottom:0.1rem;'>"+(isAdm?"👑 Admin":"Vous")+"</div>";
        html += "<div style='font-size:0.73rem;color:var(--text);white-space:pre-wrap;'>"+escHtml(m.text||"")+"</div>";
        html += "</div>";
      });
      if(t.status === "resolved"){
        html += "<div style='font-size:0.63rem;color:var(--green);margin-top:0.3rem;'>✅ Résolu</div>";
      }
      html += "</div>";
    });
    list.innerHTML = html;
  }).catch(function(err){
    var list = document.getElementById("myTicketsList");
    if(list) list.innerHTML = "<div style='color:var(--red);'>Erreur: "+err.message+"</div>";
  });
}
window.memberViewMyTickets = memberViewMyTickets;

// ── Notifications admin — journal complet + modération ─────────
function renderAdminNotifs(){
  var container = document.getElementById("adminAllNotifs");
  if(!container) return;

  // ── Onglets: Journal global | Par utilisateur | Envoyer
  var tabs = ["log","users","send"];
  var _admNotifTab = window._admNotifTab || "log";

  var tabsHtml = '<div style="display:flex;gap:0.2rem;background:var(--surface2);border-radius:10px;padding:0.2rem;margin-bottom:1rem;">'
    + '<button id="_anTab_log" onclick="window._admNotifTab=\'log\';renderAdminNotifs()" style="flex:1;padding:0.38rem;border-radius:7px;font-size:0.72rem;font-weight:700;cursor:pointer;border:none;background:'+(_admNotifTab==="log"?"var(--pink)":"transparent")+';color:'+(_admNotifTab==="log"?"#000":"var(--muted)")+';font-family:DM Sans,sans-serif;">📋 Journal</button>'
    + '<button id="_anTab_users" onclick="window._admNotifTab=\'users\';renderAdminNotifs()" style="flex:1;padding:0.38rem;border-radius:7px;font-size:0.72rem;font-weight:700;cursor:pointer;border:none;background:'+(_admNotifTab==="users"?"var(--cyan)":"transparent")+';color:'+(_admNotifTab==="users"?"#000":"var(--muted)")+';font-family:DM Sans,sans-serif;">👥 Par membre</button>'
    + '<button id="_anTab_send" onclick="window._admNotifTab=\'send\';renderAdminNotifs()" style="flex:1;padding:0.38rem;border-radius:7px;font-size:0.72rem;font-weight:700;cursor:pointer;border:none;background:'+(_admNotifTab==="send"?"var(--amber)":"transparent")+';color:'+(_admNotifTab==="send"?"#000":"var(--muted)")+';font-family:DM Sans,sans-serif;">📤 Envoyer</button>'
    + '</div>';

  var html = tabsHtml;

  // ════ ONGLET JOURNAL ════
  if(_admNotifTab === "log"){
    var log = loadAdminLog().slice().reverse();
    if(!log.length){
      html += '<div style="text-align:center;padding:2.5rem;color:var(--muted);font-size:0.82rem;"><span style="font-size:2rem;display:block;margin-bottom:0.5rem;">🔔</span>Aucune notification dans le journal</div>';
    } else {
      var roleLabel={admin:"Admin",membre:"Membre",etablissement:"Établ.",visiteur:"Visiteur",all:"Tous"};
      var roleColors={admin:"var(--amber)",membre:"var(--cyan)",etablissement:"var(--pink)",visiteur:"var(--muted)",all:"var(--green)"};
      log.forEach(function(n,i){
        html += '<div class="notif-admin-item" id="admnotif-'+i+'" style="position:relative;">';
        html += '<div style="display:flex;align-items:flex-start;gap:0.5rem;">';
        html += '<span style="font-size:1.1rem;flex-shrink:0;margin-top:0.05rem;">'+n.icon+'</span>';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-weight:700;font-size:0.82rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(n.title)+'</div>';
        html += '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.1rem;line-height:1.3;">'+escHtml(n.msg)+'</div>';
        html += '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;margin-top:0.3rem;">';
        var rCol = roleColors[n.targetRole||"all"]||"var(--muted)";
        html += '<span style="font-size:0.6rem;font-weight:700;color:'+rCol+';background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);padding:0.06rem 0.35rem;border-radius:4px;">→ '+(roleLabel[n.targetRole||"all"]||n.targetRole)+'</span>';
        html += '<span style="font-size:0.58rem;color:rgba(255,255,255,0.3);">'+(typeof timeAgo==="function"?timeAgo(n.ts):"")+' · '+(n.channel||"push")+(n.fromAdmin?' · <span style="color:var(--amber);">Admin</span>':'')+'</span>';
        html += '</div></div>';
        html += '<button onclick="admDeleteNotif('+i+')" title="Supprimer" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:0.78rem;padding:0.1rem 0.3rem;flex-shrink:0;">🗑️</button>';
        html += '</div></div>';
      });
      html += '<button onclick="admClearAllNotifLog()" style="width:100%;margin-top:0.6rem;padding:0.5rem;border-radius:10px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.06);color:var(--red);font-family:Syne,sans-serif;font-weight:700;font-size:0.78rem;cursor:pointer;">🗑️ Effacer tout le journal</button>';
    }
  }

  // ════ ONGLET PAR MEMBRE ════
  else if(_admNotifTab === "users"){
    html += '<div style="background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.18);border-radius:12px;padding:0.9rem;margin-bottom:1rem;">';
    html += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:0.8rem;margin-bottom:0.5rem;">👥 Notifications par Membre / Établissement</div>';
    html += '<div style="font-size:0.72rem;color:var(--muted);line-height:1.5;">Seules les notifications envoyées via Firebase sont visibles ici. Cliquez sur un membre pour gérer ses notifications.</div>';
    html += '</div>';

    html += '<div id="_admNotifUserList"><div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.75rem;">⏳ Chargement des membres...</div></div>';
  }

  // ════ ONGLET ENVOYER ════
  else if(_admNotifTab === "send"){
    html += '<div style="background:rgba(255,45,155,0.05);border:1px solid rgba(255,45,155,0.2);border-radius:14px;padding:1rem;margin-bottom:1rem;">';
    html += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.82rem;margin-bottom:0.8rem;">📢 Diffuser une notification</div>';

    // Cible
    html += '<div style="margin-bottom:0.7rem;">';
    html += '<label style="font-size:0.65rem;color:var(--muted);display:block;margin-bottom:0.3rem;text-transform:uppercase;letter-spacing:0.05em;">Destinataires</label>';
    html += '<select id="admNotifTarget" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.25);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.82rem;">';
    html += '<option value="all">🌐 Tous les utilisateurs</option>';
    html += '<option value="membre">👤 Membres inscrits uniquement</option>';
    html += '<option value="etablissement">🏠 Établissements uniquement</option>';
    html += '<option value="admin">🔑 Admins uniquement</option>';
    html += '</select></div>';

    // Icône
    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.65rem;color:var(--muted);display:block;margin-bottom:0.3rem;text-transform:uppercase;letter-spacing:0.05em;">Icône</label>';
    html += '<div style="display:flex;gap:0.3rem;flex-wrap:wrap;" id="_admNotifIconRow">';
    ["📢","🔔","🎉","⚡","⚠️","✅","💳","🏆","📸","🎵","🔥","🌟"].forEach(function(ic,i){
      html += '<button onclick="document.querySelectorAll(\'#_admNotifIconRow button\').forEach(function(b){b.style.background=\'rgba(255,255,255,0.04)\';b.style.borderColor=\'rgba(255,255,255,0.1)\'});this.style.background=\'rgba(255,45,155,0.2)\';this.style.borderColor=\'var(--pink)\';document.getElementById(\'admNotifIcon\').value=this.textContent;" style="font-size:1.05rem;padding:0.25rem 0.4rem;border-radius:7px;cursor:pointer;border:1px solid '+(i===0?'var(--pink)':'rgba(255,255,255,0.1)')+';background:'+(i===0?'rgba(255,45,155,0.18)':'rgba(255,255,255,0.04)')+';transition:all 0.15s;">'+ic+'</button>';
    });
    html += '</div><input type="hidden" id="admNotifIcon" value="📢"></div>';

    // Titre
    html += '<div style="margin-bottom:0.6rem;">';
    html += '<label style="font-size:0.65rem;color:var(--muted);display:block;margin-bottom:0.3rem;text-transform:uppercase;letter-spacing:0.05em;">Titre <span style="color:var(--red);">*</span></label>';
    html += '<input id="admNotifTitle" type="text" maxlength="60" placeholder="Ex: Mise à jour importante" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:8px;color:var(--text);padding:0.5rem 0.7rem;font-size:0.82rem;font-family:DM Sans,sans-serif;outline:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'rgba(255,45,155,0.5)\'" onblur="this.style.borderColor=\'rgba(255,45,155,0.2)\'">';
    html += '</div>';

    // Message
    html += '<div style="margin-bottom:0.9rem;">';
    html += '<label style="font-size:0.65rem;color:var(--muted);display:block;margin-bottom:0.3rem;text-transform:uppercase;letter-spacing:0.05em;">Message</label>';
    html += '<textarea id="admNotifMsg" maxlength="200" rows="3" placeholder="Corps de la notification..." style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:8px;color:var(--text);padding:0.5rem 0.7rem;font-size:0.8rem;font-family:DM Sans,sans-serif;outline:none;resize:none;transition:border-color 0.2s;" onfocus="this.style.borderColor=\'rgba(255,45,155,0.5)\'" onblur="this.style.borderColor=\'rgba(255,45,155,0.2)\'"></textarea>';
    html += '</div>';

    html += '<button onclick="admSendNotif()" style="width:100%;padding:0.72rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;cursor:pointer;">📤 Envoyer la notification</button>';
    html += '</div>';

    // Aperçu des notifs récentes envoyées
    var log = loadAdminLog().filter(function(n){ return n.fromAdmin; }).slice().reverse().slice(0,5);
    if(log.length){
      html += '<div style="font-family:Syne,sans-serif;font-weight:700;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.5rem;">Récemment envoyées</div>';
      log.forEach(function(n){
        var rColors = {admin:"var(--amber)",membre:"var(--cyan)",etablissement:"var(--pink)",all:"var(--green)"};
        html += '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid rgba(255,255,255,0.04);">';
        html += '<span style="font-size:0.9rem;">'+n.icon+'</span>';
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="font-size:0.75rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(n.title)+'</div>';
        html += '<div style="font-size:0.6rem;color:'+(rColors[n.targetRole||"all"]||"var(--muted)")+';">→ '+(n.targetRole||"all")+'</div>';
        html += '</div>';
        html += '<span style="font-size:0.58rem;color:rgba(255,255,255,0.3);flex-shrink:0;">'+(typeof timeAgo==="function"?timeAgo(n.ts):"")+'</span>';
        html += '</div>';
      });
    }
  }

  container.innerHTML = html;

  // Si onglet "par membre", charger depuis Firebase
  if(_admNotifTab === "users" && window.db && window.fbCollection && window.fbGetDocs){
    _admLoadNotifByUser();
  } else if(_admNotifTab === "users"){
    var el = document.getElementById("_admNotifUserList");
    if(el) el.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--red);font-size:0.78rem;">❌ Firebase requis pour cette vue</div>';
  }
}
window.renderAdminNotifs = renderAdminNotifs;

// ── Charger les notifications par utilisateur depuis Firebase ──
function _admLoadNotifByUser(){
  var el = document.getElementById("_admNotifUserList");
  if(!el) return;
  var col = window.fbCollection(window.db, "user_notifications");
  window.fbGetDocs(col).then(function(snap){
    var docs = [];
    snap.forEach(function(d){ docs.push(Object.assign({_uid:d.id}, d.data())); });
    if(!docs.length){
      el.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.78rem;">📭 Aucune notification stockée dans Firebase</div>';
      return;
    }
    // Trier par les plus récentes
    docs.sort(function(a,b){ return (b.updatedAt||0)-(a.updatedAt||0); });
    var h = '';
    docs.forEach(function(d){
      var items = d.items || [];
      var unreadCount = items.filter(function(n){ return n.unread; }).length;
      var lastItem = items.length ? items[items.length-1] : null;
      // Trouver le nom du membre/établissement
      var etab = etablissements.find(function(e){ return (e.email||"").toLowerCase()===(d.email||"").toLowerCase(); });
      var displayName = d.email || d._uid;
      var roleLabel = etab ? "🏠 "+escHtml(etab.nom) : "👤 Membre";
      h += '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:0.8rem;margin-bottom:0.55rem;cursor:pointer;" onclick="_admOpenUserNotifs(\''+escHtml(d._uid)+'\',\''+escHtml(d.email||"")+'\',\''+escHtml(displayName)+'\')">';
      h += '<div style="display:flex;align-items:center;gap:0.55rem;">';
      h += '<div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--pink),var(--purple));display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;color:#fff;flex-shrink:0;">'+(displayName[0]||"?").toUpperCase()+'</div>';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-weight:700;font-size:0.8rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(displayName)+'</div>';
      h += '<div style="font-size:0.63rem;color:var(--muted);">'+roleLabel+' · '+items.length+' notif(s)'+(unreadCount>0?' · <span style="color:var(--pink);">'+unreadCount+' non lue(s)</span>':'')+'</div>';
      if(lastItem) h += '<div style="font-size:0.62rem;color:rgba(255,255,255,0.3);margin-top:0.1rem;">Dernière : '+escHtml(lastItem.title)+'</div>';
      h += '</div>';
      if(unreadCount>0) h += '<div style="background:var(--pink);color:#000;font-size:0.62rem;font-weight:800;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+unreadCount+'</div>';
      h += '<span style="color:var(--muted);font-size:1rem;flex-shrink:0;">›</span>';
      h += '</div></div>';
    });
    el.innerHTML = h;
  }).catch(function(err){
    el.innerHTML = '<div style="color:var(--red);padding:1rem;text-align:center;font-size:0.78rem;">Erreur: '+err.message+'</div>';
  });
}

// ── Ouvrir la gestion des notifs d'un utilisateur spécifique ──
function _admOpenUserNotifs(uid, email, displayName){
  if(!window.db || !window.fbDoc || !window.fbGetDoc) return;
  var ref = window.fbDoc(window.db, "user_notifications", uid);
  window.fbGetDoc(ref).then(function(snap){
    var items = snap.exists() ? (snap.data().items||[]) : [];
    var modal = document.createElement("div");
    modal.id = "_admUserNotifModal";
    modal.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:600;display:flex;align-items:center;justify-content:center;padding:1rem;";
    var inner = '<div style="background:var(--surface);border:1px solid rgba(0,229,255,0.3);border-radius:20px;padding:1.4rem;width:min(400px,100%);max-height:88vh;overflow-y:auto;position:relative;animation:popIn 0.25s cubic-bezier(0.34,1.56,0.64,1);">';
    inner += '<button onclick="document.getElementById(\'_admUserNotifModal\').remove()" style="position:absolute;top:0.8rem;right:0.8rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;">✕</button>';
    inner += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:0.9rem;margin-bottom:0.25rem;">🔔 Notifications de</div>';
    inner += '<div style="font-size:0.78rem;color:var(--muted);margin-bottom:1rem;">'+escHtml(displayName||email)+'</div>';
    // Bouton supprimer toutes les notifs de cet user
    inner += '<div style="display:flex;gap:0.4rem;margin-bottom:1rem;flex-wrap:wrap;">';
    inner += '<button onclick="_admMarkAllReadForUser(\''+escHtml(uid)+'\')" style="flex:1;padding:0.42rem;border-radius:8px;border:1px solid rgba(0,229,255,0.3);background:rgba(0,229,255,0.07);color:var(--cyan);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">✓ Tout marquer lu</button>';
    inner += '<button onclick="_admClearUserNotifs(\''+escHtml(uid)+'\')" style="flex:1;padding:0.42rem;border-radius:8px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;">🗑️ Effacer tout</button>';
    inner += '</div>';
    if(!items.length){
      inner += '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.78rem;">📭 Aucune notification</div>';
    } else {
      items.slice().reverse().forEach(function(n, idx){
        var ago = typeof timeAgo==="function"?timeAgo(n.ts):"";
        inner += '<div style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.6rem;border-radius:10px;margin-bottom:0.4rem;background:'+(n.unread?"rgba(255,45,155,0.06)":"rgba(255,255,255,0.02)")+';border:1px solid '+(n.unread?"rgba(255,45,155,0.2)":"rgba(255,255,255,0.05)")+'">';
        inner += '<span style="font-size:1rem;flex-shrink:0;margin-top:0.05rem;">'+n.icon+'</span>';
        inner += '<div style="flex:1;min-width:0;">';
        inner += '<div style="font-size:0.78rem;font-weight:700;color:'+(n.unread?"var(--text)":"var(--muted)")+';">'+escHtml(n.title)+'</div>';
        if(n.msg) inner += '<div style="font-size:0.68rem;color:var(--muted);margin-top:0.1rem;">'+escHtml(n.msg)+'</div>';
        inner += '<div style="font-size:0.58rem;color:rgba(255,255,255,0.28);margin-top:0.15rem;">'+ago+(n.fromAdmin?' · <span style="color:var(--amber);">Admin</span>':'')+'</div>';
        inner += '</div>';
        if(n.unread) inner += '<div style="width:7px;height:7px;border-radius:50%;background:var(--pink);flex-shrink:0;margin-top:0.25rem;"></div>';
        inner += '</div>';
      });
    }
    inner += '</div>';
    modal.innerHTML = inner;
    modal.addEventListener("click", function(e){ if(e.target===modal) modal.remove(); });
    document.body.appendChild(modal);
  }).catch(function(err){ showToast("❌ "+err.message); });
}
window._admOpenUserNotifs = _admOpenUserNotifs;

function _admMarkAllReadForUser(uid){
  if(!window.db || !window.fbDoc || !window.fbGetDoc || !window.fbSetDoc) return;
  var ref = window.fbDoc(window.db, "user_notifications", uid);
  window.fbGetDoc(ref).then(function(snap){
    if(!snap.exists()) return;
    var items = (snap.data().items||[]).map(function(n){ return Object.assign({},n,{unread:false}); });
    return window.fbSetDoc(ref, Object.assign(snap.data(), { items:items }));
  }).then(function(){
    showToast("✓ Notifications marquées comme lues");
    document.getElementById("_admUserNotifModal") && document.getElementById("_admUserNotifModal").remove();
    _admLoadNotifByUser();
  }).catch(function(err){ showToast("❌ "+err.message); });
}
window._admMarkAllReadForUser = _admMarkAllReadForUser;

function _admClearUserNotifs(uid){
  if(!confirm("Effacer toutes les notifications de cet utilisateur ?")) return;
  if(!window.db || !window.fbDoc || !window.fbSetDoc) return;
  var ref = window.fbDoc(window.db, "user_notifications", uid);
  window.fbSetDoc(ref, { items:[], updatedAt:Date.now() }).then(function(){
    showToast("🗑️ Notifications effacées");
    document.getElementById("_admUserNotifModal") && document.getElementById("_admUserNotifModal").remove();
    _admLoadNotifByUser();
  }).catch(function(err){ showToast("❌ "+err.message); });
}
window._admClearUserNotifs = _admClearUserNotifs;
function admDeleteNotif(idx){
  var log=loadAdminLog().slice().reverse();
  log.splice(idx,1);
  // Remettre dans l'ordre chronologique
  try{lsSetJSON(NOTIF_ADMIN_KEY, log.reverse());}catch(e){}
  renderAdminNotifs();
  showToast("Notification supprimée");
}
function admClearAllNotifLog(){
  if(!confirm("Effacer tout le journal des notifications ?"))return;
  try{lsDel(NOTIF_ADMIN_KEY);}catch(e){}
  renderAdminNotifs();
  showToast("Journal effacé");
}
window.admDeleteNotif=admDeleteNotif;
window.admClearAllNotifLog=admClearAllNotifLog;

// ── Paiements admin ────────────────────────────────────────────
/* ── État local vue compacte + recherche ── */
var _admPayCompact = false;
var _admPaySearch  = '';

function admPayToggleCompact(){
  _admPayCompact = !_admPayCompact;
  renderAdmPayments();
}
function admPaySearch(val){
  _admPaySearch = (val||'').toLowerCase().trim();
  renderAdmPayments();
}
function admPayConfirmAll(){
  if(!isAdmin) return;
  var pending = paiements.filter(function(p){ return p.statut==='En attente'; });
  if(!pending.length){ showToast('Aucun paiement en attente'); return; }
  if(!confirm('Confirmer TOUS les '+pending.length+' paiement(s) en attente ?')) return;
  pending.forEach(function(p){
    var idx = paiements.indexOf(p);
    if(idx !== -1) toggleConfirme(idx);
  });
}

function renderAdmPayments(){
  var confirmed = paiements.filter(function(p){ return p.statut==='Confirme'; });
  var pending   = paiements.filter(function(p){ return p.statut==='En attente'; });
  var rev       = confirmed.reduce(function(s,p){ return s+p.montant; }, 0);
  var html      = '';

  /* ── BARRE D'ACTIONS GLOBALE ── */
  html += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,45,155,0.18);border-radius:14px;padding:0.8rem;margin-bottom:1rem;display:flex;flex-direction:column;gap:0.55rem;'>";

  /* Ligne 1 : Tout valider + toggle compact */
  html += "<div style='display:flex;gap:0.45rem;align-items:center;'>";
  html += "<button onclick='admPayConfirmAll()' style='flex:1;padding:0.55rem 0.5rem;border-radius:9px;border:none;background:linear-gradient(135deg,var(--green),var(--cyan));color:#001a0e;font-family:Syne,sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:0.35rem;'>✅ Tout valider"+(pending.length?" ("+pending.length+")":"")+"</button>";
  html += "<button onclick='admPayToggleCompact()' title='Basculer vue compacte / normale' style='padding:0.55rem 0.75rem;border-radius:9px;border:1px solid rgba(255,255,255,0.12);background:"+(_admPayCompact?"rgba(0,229,255,0.12)":"rgba(255,255,255,0.04)")+";color:"+(_admPayCompact?"var(--cyan)":"var(--muted)")+";font-size:0.8rem;cursor:pointer;font-weight:700;white-space:nowrap;'>"+(_admPayCompact?"☰ Normal":"⊟ Compact")+"</button>";
  html += "</div>";

  /* Ligne 2 : Recherche */
  html += "<div style='position:relative;'>";
  html += "<span style='position:absolute;left:0.65rem;top:50%;transform:translateY(-50%);font-size:0.85rem;pointer-events:none;'>🔍</span>";
  html += "<input id='admPaySearchInput' type='text' placeholder='Rechercher nom, mode, statut…' value='"+escHtml(_admPaySearch)+"' oninput=\"admPaySearch(this.value)\" style='width:100%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.10);border-radius:9px;color:var(--text);font-family:DM Sans,sans-serif;font-size:0.78rem;padding:0.48rem 0.6rem 0.48rem 2rem;outline:none;'>";
  html += "</div>";

  html += "</div>"; /* fin barre actions */

  /* ── KPIs synchronisés avec page Accueil/Lieux (4 cellules, mêmes chiffres) ── */
  var _d = etablissements;
  var _bondes  = _d.filter(function(e){ return e.statut && e.statut.indexOf('Bonde') !== -1; }).length;
  var _animes  = _d.filter(function(e){ return e.statut && e.statut.indexOf('Anime') !== -1; }).length;
  var _calmes  = _d.filter(function(e){ return e.statut && e.statut.indexOf('Calme') !== -1; }).length;
  html += "<div style='display:grid;grid-template-columns:repeat(4,1fr);gap:0.45rem;margin-bottom:1rem;'>";
  html += "<div class='stat-chip sc-pink'><div class='val'>"+_d.length+"</div><div class='lbl' style='line-height:1.3;'>Lieux<br><span style='color:var(--green);font-weight:800;font-size:0.5rem;'>"+_d.length+" ACTIFS</span></div></div>";
  html += "<div class='stat-chip sc-amber'><div class='val'>"+_calmes+"</div><div class='lbl'>Calmes</div></div>";
  html += "<div class='stat-chip sc-cyan'><div class='val'>"+_animes+"</div><div class='lbl'>Animés</div></div>";
  html += "<div class='stat-chip sc-red'><div class='val'>"+_bondes+"</div><div class='lbl'>Bondés</div></div>";
  html += "</div>";

  /* ── Alertes abonnements expirants ── */
  var alertEtabs = etablissements.filter(function(e){
    if(!e.paiement || e.paiement.indexOf('Actif')===-1) return false;
    var s = getSubscriptionStatus(e);
    return s==='expire'||s==='critique'||s==='alerte';
  });
  if(alertEtabs.length > 0){
    html += "<div class='renewal-banner'>";
    html += "<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;color:var(--pink);margin-bottom:0.5rem;'>🔔 Abonnements nécessitant attention ("+alertEtabs.length+")</div>";
    alertEtabs.forEach(function(etab){
      var status   = getSubscriptionStatus(etab);
      var daysLeft = getDaysLeft(etab);
      var planKey  = etab.abonnement_type || 'mensuel';
      var plan     = SUBSCRIPTION_PLANS[planKey];
      var statusIcon  = status==='expire'?'🔴':status==='critique'?'⚠️':'🔔';
      var statusLabel = status==='expire'?'Expiré':status==='critique'?'Critique — '+daysLeft+'j':'Alerte — '+daysLeft+'j';
      html += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.7rem;margin-bottom:0.45rem;'>";
      html += "<div style='display:flex;align-items:center;justify-content:space-between;gap:0.5rem;margin-bottom:0.45rem;'><div style='flex:1;min-width:0;'>";
      html += "<div style='font-weight:700;font-size:0.82rem;color:var(--text);'>"+statusIcon+" "+escHtml(etab.nom)+"</div>";
      html += "<div style='font-size:0.65rem;color:var(--muted);'>"+statusLabel+" · Formule : "+(plan?plan.label:'Mensuel')+" · Échéance : "+getEcheanceStr(etab)+"</div>";
      html += "</div></div>";
      html += "<div style='display:grid;grid-template-columns:repeat(3,1fr);gap:0.3rem;'>";
      Object.keys(SUBSCRIPTION_PLANS).forEach(function(planId){
        var p2 = SUBSCRIPTION_PLANS[planId];
        var isActive = planKey===planId;
        html += "<button onclick=\"renewSubscription('"+etab.id+"','"+planId+"')\" style='padding:0.35rem 0.2rem;border-radius:7px;border:1px solid "+(isActive?"var(--amber)":"rgba(255,255,255,0.1)")+";background:"+(isActive?"rgba(255,215,0,0.1)":"rgba(255,255,255,0.03)")+";color:"+(isActive?"var(--amber)":"var(--muted)")+";font-size:0.6rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;'>"+p2.icon+" "+p2.label+"<br><span style=\"font-size:0.55rem;\">"+p2.montant.toLocaleString('fr-FR')+" XAF</span></button>";
      });
      html += "</div></div>";
    });
    html += "</div>";
  }

  /* ── helper filtre recherche ── */
  function _matchSearch(text){ return !_admPaySearch || (text||'').toLowerCase().indexOf(_admPaySearch)!==-1; }

  /* ══ VUE COMPACTE ══ */
  if(_admPayCompact){
    /* Tableau compact — tous les paiements filtrés */
    var allPay = paiements.filter(function(p){
      return _matchSearch(p.nom+' '+p.mode+' '+(p.statut||'')+' '+(p.id||''));
    });
    if(!allPay.length){
      html += "<div style='text-align:center;padding:1.2rem;color:var(--muted);font-size:0.78rem;'>Aucun résultat"+ (_admPaySearch?" pour \""+escHtml(_admPaySearch)+"\"":"")+"></div>";
    } else {
      html += "<div style='background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.07);border-radius:12px;overflow:hidden;'>";
      /* En-tête */
      html += "<div style='display:grid;grid-template-columns:1fr auto auto;gap:0.4rem;padding:0.45rem 0.6rem;background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.06);font-size:0.6rem;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;'>";
      html += "<span>Établissement</span><span style='text-align:right;'>Montant</span><span style='text-align:center;'>Action</span>";
      html += "</div>";
      allPay.forEach(function(p){
        var idx = paiements.indexOf(p);
        var isPending = p.statut === 'En attente';
        var rowBg = isPending ? "rgba(255,215,0,0.03)" : "transparent";
        var subLabel = p.abonnement_type ? " · "+(SUBSCRIPTION_PLANS[p.abonnement_type]||{label:p.abonnement_type}).label : '';
        html += "<div style='display:grid;grid-template-columns:1fr auto auto;gap:0.4rem;align-items:center;padding:0.42rem 0.6rem;border-bottom:1px solid rgba(255,255,255,0.04);background:"+rowBg+";'>";
        /* Nom + infos */
        html += "<div style='min-width:0;'>";
        html += "<div style='font-weight:700;font-size:0.78rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>"+escHtml(p.nom)+"</div>";
        html += "<div style='font-size:0.58rem;color:var(--muted);'>"+p.mode+" · "+p.date+subLabel+"</div>";
        html += "</div>";
        /* Montant */
        html += "<div style='font-weight:800;font-size:0.78rem;color:"+(isPending?"var(--amber)":"var(--green)")+";white-space:nowrap;text-align:right;'>"+p.montant.toLocaleString('fr-FR')+" XAF</div>";
        /* Actions */
        html += "<div style='display:flex;flex-direction:column;gap:0.2rem;align-items:center;'>";
        if(isPending){
          html += "<button onclick='toggleConfirme("+idx+")' title='Confirmer' style='padding:0.25rem 0.5rem;border-radius:6px;border:none;background:linear-gradient(135deg,var(--green),var(--cyan));color:#001a0e;font-size:0.65rem;font-weight:800;cursor:pointer;white-space:nowrap;'>✓ OK</button>";
        } else {
          html += "<button onclick='toggleConfirme("+idx+")' title='Annuler ce paiement' style='padding:0.25rem 0.45rem;border-radius:6px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.07);color:var(--red);font-size:0.6rem;font-weight:700;cursor:pointer;white-space:nowrap;'>✕ Ann.</button>";
        }
        html += "</div>";
        html += "</div>";
      });
      html += "</div>";
    }

  /* ══ VUE NORMALE ══ */
  } else {

    /* Paiements en attente */
    var filtPending = pending.filter(function(p){
      return _matchSearch(p.nom+' '+p.mode+' '+(p.id||''));
    });
    if(filtPending.length > 0){
      html += "<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--amber);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.5rem;'>⚠️ En attente de validation</div>";
      filtPending.forEach(function(p){
        var idx = paiements.indexOf(p);
        var subLabel = p.abonnement_type ? " · "+(SUBSCRIPTION_PLANS[p.abonnement_type]||{label:p.abonnement_type}).label : '';
        html += "<div class='notif-admin-item' style='border-color:rgba(255,215,0,0.2);'>";
        html += "<div style='display:flex;justify-content:space-between;'><div><div style='font-weight:700;font-size:0.83rem;color:var(--text);'>"+escHtml(p.nom)+"</div><div style='font-size:0.7rem;color:var(--muted);'>"+p.id+" · "+p.mode+" · "+p.date+subLabel+"</div></div><div style='font-weight:800;color:var(--amber);font-size:0.9rem;'>"+p.montant.toLocaleString('fr-FR')+" XAF</div></div>";
        /* Boutons Confirmer + Annuler côte à côte */
        html += "<div style='display:flex;gap:0.4rem;margin-top:0.6rem;'>";
        html += "<button onclick='toggleConfirme("+idx+")' style='flex:1;padding:0.5rem;border-radius:8px;border:none;background:linear-gradient(135deg,var(--green),var(--cyan));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.8rem;cursor:pointer;'>✓ Confirmer paiement</button>";
        html += "<button onclick=\"if(confirm('Annuler ce paiement ?')){paiements.splice(paiements.indexOf(paiements["+idx+"]),1);renderAdmPayments();showToast('Paiement annulé');}\" style='padding:0.5rem 0.7rem;border-radius:8px;border:1px solid rgba(255,68,102,0.35);background:rgba(255,68,102,0.08);color:var(--red);font-family:Syne,sans-serif;font-weight:700;font-size:0.8rem;cursor:pointer;'>✕</button>";
        html += "</div>";
        html += "</div>";
      });
    } else if(_admPaySearch && pending.length > 0){
      html += "<div style='text-align:center;padding:0.7rem;color:var(--muted);font-size:0.75rem;'>Aucun résultat en attente pour cette recherche</div>";
    }

    /* Abonnements actifs */
    html += "<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--green);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;margin:0.8rem 0 0.5rem;'>📋 Abonnements établissements</div>";
    var etabsActifs = etablissements.filter(function(e){
      return e.paiement && e.paiement.indexOf('Actif') !== -1 && _matchSearch(e.nom+' '+(e.quartier||''));
    });
    if(!etabsActifs.length){
      html += "<div style='text-align:center;padding:1.2rem;color:var(--muted);font-size:0.78rem;'>Aucun abonnement actif"+(_admPaySearch?" trouvé":"")+"</div>";
    }
    etabsActifs.forEach(function(etab){
      var status   = getSubscriptionStatus(etab);
      var daysLeft = getDaysLeft(etab);
      var planKey  = etab.abonnement_type || 'mensuel';
      var plan     = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS['mensuel'];
      var statusBadge = renderSubStatusBadge(etab);
      html += "<div class='notif-admin-item' style='border-color:rgba(0,255,170,0.12);margin-bottom:0.55rem;'>";
      html += "<div style='display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;'>";
      html += "<div style='flex:1;min-width:0;'>";
      html += "<div style='font-weight:700;font-size:0.82rem;color:var(--text);'>"+escHtml(etab.nom)+"</div>";
      html += "<div style='font-size:0.65rem;color:var(--muted);margin-top:0.1rem;'>"+plan.icon+" "+plan.label+" · Échéance : "+getEcheanceStr(etab)+"</div>";
      html += "<div style='margin-top:0.3rem;'>"+statusBadge+"</div>";
      html += "</div>";
      html += "<div style='flex-shrink:0;text-align:right;'>";
      html += "<div style='font-weight:800;font-size:0.82rem;color:var(--green);'>"+plan.montant.toLocaleString('fr-FR')+" XAF</div>";
      html += "<div style='font-size:0.58rem;color:var(--muted);'>"+plan.dureeLabel+"</div>";
      html += "</div></div>";
      if(status!=='actif' || (daysLeft && daysLeft <= 30)){
        html += "<div style='margin-top:0.5rem;'>";
        html += "<div style='font-size:0.62rem;color:var(--muted);margin-bottom:0.25rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;'>Renouveler :</div>";
        html += "<div style='display:grid;grid-template-columns:repeat(3,1fr);gap:0.25rem;'>";
        Object.keys(SUBSCRIPTION_PLANS).forEach(function(pid){
          var pp = SUBSCRIPTION_PLANS[pid];
          var isCurrent = pid === planKey;
          html += "<button onclick=\"renewSubscription('"+etab.id+"','"+pid+"')\" style='padding:0.3rem 0.2rem;border-radius:7px;border:1px solid "+(isCurrent?"var(--amber)":"rgba(255,255,255,0.1)")+";background:"+(isCurrent?"rgba(255,215,0,0.08)":"rgba(255,255,255,0.02)")+";color:"+(isCurrent?"var(--amber)":"var(--muted)")+";font-size:0.6rem;font-weight:700;cursor:pointer;font-family:DM Sans,sans-serif;'>"+pp.icon+" "+pp.label+"</button>";
        });
        html += "</div></div>";
      }
      html += "</div>";
    });

    /* Historique paiements confirmés */
    var filtConfirmed = confirmed.filter(function(p){
      return _matchSearch(p.nom+' '+p.mode+' '+(p.id||''));
    });
    if(filtConfirmed.length > 0){
      html += "<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--muted);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.08em;margin:0.8rem 0 0.5rem;'>🗂 Historique paiements</div>";
      filtConfirmed.forEach(function(p){
        var idx = paiements.indexOf(p);
        html += "<div class='notif-admin-item' style='border-color:rgba(0,255,170,0.15);'>";
        html += "<div style='display:flex;justify-content:space-between;align-items:center;'>";
        html += "<div><div style='font-weight:600;font-size:0.8rem;color:var(--text);'>"+escHtml(p.nom)+"</div><div style='font-size:0.65rem;color:var(--muted);'>"+p.id+" · "+p.mode+"</div></div>";
        html += "<div style='text-align:right;display:flex;flex-direction:column;align-items:flex-end;gap:0.2rem;'>";
        html += "<div style='font-weight:700;color:var(--green);font-size:0.82rem;'>"+p.montant.toLocaleString('fr-FR')+" XAF</div>";
        html += "<button onclick='toggleConfirme("+idx+")' style='font-size:0.6rem;padding:0.18rem 0.5rem;border-radius:5px;background:rgba(255,68,102,0.08);border:1px solid rgba(255,68,102,0.28);color:var(--red);cursor:pointer;font-weight:700;'>✕ Annuler</button>";
        html += "</div>";
        html += "</div></div>";
      });
    }
  }

  document.getElementById("adminPaymentsContent").innerHTML = html;
  if(typeof _initCountdownElements === "function") _initCountdownElements();
  /* Remettre le focus sur la recherche si elle était active */
  if(_admPaySearch){
    var si = document.getElementById('admPaySearchInput');
    if(si){ si.focus(); si.setSelectionRange(si.value.length, si.value.length); }
  }
}

// ── Modération ─────────────────────────────────────────────────
function renderAdmModeration(){
  var html="";
  html+="<div style='background:rgba(204,68,255,0.06);border:1px solid rgba(204,68,255,0.2);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--purple);font-size:0.85rem;margin-bottom:0.7rem;'>🛡️ Outils de Modération</div>";
  html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;'>";
  html+="<button onclick=\"if(confirm('Réinitialiser toutes les notifs utilisateurs ?')){try{Object.keys(localStorage).filter(function(k){return k.startsWith('ambi241_notifications_')}).forEach(function(k){lsDel(k)});showToast('Notifs réinitialisées !');}catch(e){}}\" class='adm-action-btn' style='background:rgba(255,68,102,0.08);border-color:rgba(255,68,102,0.3);color:var(--red);'>&#128465; Reset toutes les notifs</button>";
  html+="<button onclick=\"if(confirm('Effacer le cache local des photos ?')){lsDel('ambi241_slot_photos');lsDel('ambi241_soiree');Object.keys(_slotPhotoCache).forEach(function(k){delete _slotPhotoCache[k];});showToast('Cache photos effacé (Firebase conservé) !');}\" class='adm-action-btn' style='background:rgba(255,215,0,0.06);border-color:rgba(255,215,0,0.25);color:var(--amber);'>&#128247; Purge cache local photos</button>";
  html+="<button onclick=\"loadData();showToast('Synchronisation Firebase lancée...')\" class='adm-action-btn' style='background:rgba(0,229,255,0.06);border-color:rgba(0,229,255,0.25);color:var(--cyan);'>&#8635; Sync Firebase</button>";
  html+="<button onclick=\"var r=parseInt(prompt('Nouvelle affluence globale (0-100) ?','50'));if(!isNaN(r)){etablissements.forEach(function(e){updateField(e.id,{affluence:r});});showToast('Affluence mise à jour !');}\" class='adm-action-btn' style='background:rgba(0,255,170,0.06);border-color:rgba(0,255,170,0.25);color:var(--green);'>&#128202; Ajuster affluence</button>";
  html+="</div></div>";

  // ── SECTION MODÉRATION PHOTOS DE PROFIL ──────────────────────
  html += "<div style='font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.82rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.7rem;'>🖼️ Photos de Profil — Modération</div>";
  html += "<div style='background:rgba(255,45,155,0.04);border:1px solid rgba(255,45,155,0.2);border-radius:12px;padding:0.9rem;margin-bottom:1rem;'>";
  html += "<div style='font-size:0.72rem;color:var(--muted);margin-bottom:0.7rem;line-height:1.5;'>Google propose automatiquement la meilleure photo de chaque établissement. Le responsable ou l'admin doit approuver avant affichage.</div>";

  if (!window.db) {
    html += "<div style='text-align:center;padding:1rem;color:var(--muted);font-size:0.78rem;'>🔌 Firebase requis</div>";
  } else {
    html += "<div id='_photo_mod_queue'>⏳ Chargement des photos en attente...</div>";
  }
  html += "</div>";

  // Commentaires récents (depuis le cache local)
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--pink);font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.6rem;'>💬 Commentaires récents</div>";
  var allComments=[];
  Object.keys(commentsCache||{}).forEach(function(eid){
    (commentsCache[eid]||[]).forEach(function(c){
      allComments.push(Object.assign({},c,{eid:eid}));
    });
  });
  allComments.sort(function(a,b){return(b.ts||0)-(a.ts||0);});
  if(!allComments.length){
    html+="<div style='text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;'>Aucun commentaire chargé. Ouvrez un établissement pour les voir ici.</div>";
  }
  allComments.slice(0,20).forEach(function(c){
    var etab=etablissements.find(function(x){return String(x.id)===String(c.eid);})||{nom:"Inconnu"};
    html+="<div class='notif-admin-item'>";
    html+="<div style='display:flex;justify-content:space-between;align-items:flex-start;'>";
    html+="<div><span style='font-weight:700;font-size:0.8rem;color:var(--cyan);'>"+escHtml(c.pseudo||"Anonyme")+"</span> <span style='font-size:0.68rem;color:var(--muted);'>sur "+escHtml(etab.nom)+"</span></div>";
    html+="<button onclick=\"deleteComment('"+c.eid+"','"+c.id+"')\" style='font-size:0.65rem;padding:0.15rem 0.4rem;border-radius:6px;background:rgba(255,68,102,0.08);border:1px solid rgba(255,68,102,0.3);color:var(--red);cursor:pointer;'>&#128465;</button>";
    html+="</div>";
    html+="<div style='font-size:0.75rem;color:var(--text);margin-top:0.3rem;'>"+escHtml(c.text)+"</div>";
    html+="<div style='font-size:0.62rem;color:rgba(255,255,255,0.25);margin-top:0.2rem;'>"+timeAgo(c.ts)+"</div>";
    html+="</div>";
  });

  document.getElementById("adminModerationContent").innerHTML=html;

  // Charger la file de modération photos depuis Firebase
  if (window.db) {
    _loadPhotoModerationQueue();
  }
}

// Charger toutes les photos en attente depuis Firebase
function _loadPhotoModerationQueue() {
  var container = document.getElementById("_photo_mod_queue");
  if (!container) return;

  // Chercher dans chaque établissement les photos pending
  var promises = etablissements.slice(0, 50).map(function(e) {
    return window.fbGetDocs(
      window.fbCollection(window.db, "etablissements", String(e.id), "photo_profile")
    ).then(function(snap) {
      var results = [];
      snap.forEach(function(d) {
        var dd = d.data();
        if (dd.status === "pending") {
          results.push(Object.assign({ _docId: d.id, _eid: e.id, _nom: e.nom }, dd));
        }
      });
      return results;
    }).catch(function(){ return []; });
  });

  Promise.all(promises).then(function(arrays) {
    var pending = [].concat.apply([], arrays);
    pending.sort(function(a,b){ return (b.ts||0)-(a.ts||0); });

    if (pending.length === 0) {
      container.innerHTML = "<div style='text-align:center;padding:1rem;color:var(--green);font-size:0.78rem;'>✅ Aucune photo en attente de modération</div>";
      return;
    }

    var html = "<div style='font-size:0.7rem;color:var(--amber);font-weight:700;margin-bottom:0.6rem;'>⏳ " + pending.length + " photo(s) en attente</div>";
    pending.forEach(function(p) {
      html += "<div style='background:rgba(255,215,0,0.04);border:1px solid rgba(255,215,0,0.2);border-radius:10px;padding:0.7rem;margin-bottom:0.6rem;'>";
      html += "<div style='display:flex;gap:0.7rem;align-items:flex-start;'>";
      html += "<img src='" + escHtml(p.url||"") + "' style='width:80px;height:60px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid rgba(255,255,255,0.1);'>";
      html += "<div style='flex:1;min-width:0;'>";
      html += "<div style='font-size:0.75rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>🏠 " + escHtml(p._nom||"") + "</div>";
      html += "<div style='font-size:0.62rem;color:var(--muted);margin-top:0.1rem;'>📤 Par: " + escHtml(p.proposedBy||"?") + "</div>";
      html += "<div style='font-size:0.62rem;color:var(--muted);'>🕐 " + timeAgo(p.ts) + "</div>";
      html += "<div style='font-size:0.6rem;color:var(--cyan);margin-top:0.1rem;'>Source: " + escHtml(p.source||"google") + "</div>";
      html += "</div></div>";
      html += "<div style='display:flex;gap:0.5rem;margin-top:0.6rem;'>";
      html += "<button onclick=\"approvePhotoProfile(" + p._eid + ",'" + p._docId + "','" + (p.url||"").replace(/'/g,"\\'") + "')\" style='flex:1;padding:0.45rem;border-radius:8px;border:none;background:rgba(0,255,170,0.15);border:1px solid rgba(0,255,170,0.4);color:var(--green);font-size:0.72rem;font-weight:700;cursor:pointer;'>✅ Approuver</button>";
      html += "<button onclick=\"rejectPhotoProfile(" + p._eid + ",'" + p._docId + "')\" style='flex:1;padding:0.45rem;border-radius:8px;border:none;background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);color:var(--red);font-size:0.72rem;font-weight:700;cursor:pointer;'>❌ Rejeter</button>";
      html += "<button onclick=\"openPhotoModerationModal(" + p._eid + ",['" + (p.url||"").replace(/'/g,"\\'") + "'])\" style='padding:0.45rem 0.6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--muted);font-size:0.72rem;cursor:pointer;'>👁</button>";
      html += "</div></div>";
    });

    container.innerHTML = html;
  });
}

// ── Historique des connexions (Admin) ──────────────────────────
var _connFilter = "all";
var _connPage   = 30;

function renderAdmConnexions(){
  var container = document.getElementById("adminConnexionsContent");
  if(!container) return;

  if(!window.db){
    container.innerHTML = "<div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem;'>🔌 Firebase non connecté</div>";
    return;
  }

  container.innerHTML = "<div style='text-align:center;padding:2rem;color:var(--muted);font-size:0.8rem;'>⏳ Chargement de l'historique...</div>";

  window.fbGetDocs(window.fbCollection(window.db, "connection_logs")).then(function(snap){
    var logs = [];
    snap.forEach(function(d){ logs.push(Object.assign({ _id: d.id }, d.data())); });

    // Trier : plus récent en premier
    logs.sort(function(a,b){
      var ta = a.connectedAtMs || 0;
      var tb = b.connectedAtMs || 0;
      return tb - ta;
    });

    // ── Stats globales ──
    var totalConn   = logs.length;
    var uniqueUsers = {};
    logs.forEach(function(l){ if(l.uid) uniqueUsers[l.uid] = true; });
    var uniqueCount = Object.keys(uniqueUsers).length;
    var geoCount    = logs.filter(function(l){ return l.lat && l.lng; }).length;
    var today       = new Date(); today.setHours(0,0,0,0);
    var todayCount  = logs.filter(function(l){ return l.connectedAtMs && l.connectedAtMs >= today.getTime(); }).length;

    // ── Détection multi-compte (même appareil) ──
    var uaMap = {};
    logs.forEach(function(l){
      if(!l.userAgent) return;
      var key = l.screenRes + "|" + l.timezone;
      if(!uaMap[key]) uaMap[key] = [];
      if(uaMap[key].indexOf(l.uid) === -1) uaMap[key].push(l.uid);
    });
    var suspiciousUids = {};
    Object.values(uaMap).forEach(function(uids){
      if(uids.length > 1) uids.forEach(function(u){ suspiciousUids[u] = true; });
    });

    // ── Filtre ──
    var filtered = logs;
    if(_connFilter === "today")  filtered = logs.filter(function(l){ return l.connectedAtMs >= today.getTime(); });
    if(_connFilter === "geo")    filtered = logs.filter(function(l){ return l.lat && l.lng; });
    if(_connFilter === "nogeo")  filtered = logs.filter(function(l){ return !l.lat || !l.lng; });
    if(_connFilter === "suspicious") filtered = logs.filter(function(l){ return suspiciousUids[l.uid]; });

    var shown = filtered.slice(0, _connPage);

    // ── Build HTML ──
    var h = "";

    // Stats chips
    h += "<div class='conn-stats-row'>";
    h += "<div class='conn-stat-chip'><div class='conn-stat-val' style='color:var(--cyan);'>"+totalConn+"</div><div class='conn-stat-lbl'>Total</div></div>";
    h += "<div class='conn-stat-chip'><div class='conn-stat-val' style='color:var(--pink);'>"+uniqueCount+"</div><div class='conn-stat-lbl'>Comptes</div></div>";
    h += "<div class='conn-stat-chip'><div class='conn-stat-val' style='color:var(--green);'>"+todayCount+"</div><div class='conn-stat-lbl'>Auj.</div></div>";
    h += "<div class='conn-stat-chip'><div class='conn-stat-val' style='color:var(--amber);'>"+geoCount+"</div><div class='conn-stat-lbl'>Géolocalisés</div></div>";
    h += "<div class='conn-stat-chip'><div class='conn-stat-val' style='color:var(--red);'>"+Object.keys(suspiciousUids).length+"</div><div class='conn-stat-lbl'>Suspects</div></div>";
    h += "</div>";

    // Filtres
    h += "<div class='conn-filter-bar'>";
    h += "<button class='conn-filter-btn"+(  _connFilter==="all"?"  active":"")+"' onclick=\"_connFilter='all';renderAdmConnexions()\">🌐 Tout</button>";
    h += "<button class='conn-filter-btn"+(_connFilter==="today"?" active":"")+"' onclick=\"_connFilter='today';renderAdmConnexions()\">📅 Aujourd'hui</button>";
    h += "<button class='conn-filter-btn"+(  _connFilter==="geo"?" active":"")+"' onclick=\"_connFilter='geo';renderAdmConnexions()\">📍 Géolocalisés</button>";
    h += "<button class='conn-filter-btn"+(_connFilter==="nogeo"?" active":"")+"' onclick=\"_connFilter='nogeo';renderAdmConnexions()\">❓ Sans localisation</button>";
    h += "<button class='conn-filter-btn"+(_connFilter==="suspicious"?" active":"")+"' onclick=\"_connFilter='suspicious';renderAdmConnexions()\">⚠️ Suspects</button>";
    h += "</div>";

    // Actions globales
    h += "<div style='display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;'>";
    h += "<button onclick='exportConnLogs()' style='font-size:0.72rem;padding:0.35rem 0.7rem;border-radius:8px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.25);color:var(--cyan);cursor:pointer;font-family:DM Sans,sans-serif;'>📥 Exporter CSV</button>";
    h += "<button onclick='clearOldLogs()' style='font-size:0.72rem;padding:0.35rem 0.7rem;border-radius:8px;background:rgba(255,68,102,0.07);border:1px solid rgba(255,68,102,0.25);color:var(--red);cursor:pointer;font-family:DM Sans,sans-serif;'>🗑️ Purger ancien &gt; 30j</button>";
    h += "<button onclick='renderAdmConnexions()' style='font-size:0.72rem;padding:0.35rem 0.7rem;border-radius:8px;background:rgba(0,255,170,0.06);border:1px solid rgba(0,255,170,0.2);color:var(--green);cursor:pointer;font-family:DM Sans,sans-serif;'>↻ Actualiser</button>";
    h += "</div>";

    // Label résultat
    h += "<div style='font-size:0.7rem;color:var(--muted);margin-bottom:0.6rem;'>"+filtered.length+" connexion(s) — "+shown.length+" affichée(s)</div>";

    if(!shown.length){
      h += "<div style='text-align:center;padding:2.5rem;color:var(--muted);font-size:0.82rem;'>🔌 Aucune connexion dans ce filtre</div>";
    }

    shown.forEach(function(l){
      var initiale = ((l.pseudo||l.email||"?")[0]).toUpperCase();
      var isSuspicious = suspiciousUids[l.uid];

      // Date & heure
      var dateStr = "—", heureStr = "—";
      if(l.connectedAtMs){
        var d = new Date(l.connectedAtMs);
        dateStr  = d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
        heureStr = d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      } else if(l.connectedAt && l.connectedAt.toDate){
        var d2 = l.connectedAt.toDate();
        dateStr  = d2.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
        heureStr = d2.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
      }

      // Déterminer si c'est la 1ère connexion de cet utilisateur
      var userLogs = logs.filter(function(x){ return x.uid === l.uid; });
      var isFirst  = userLogs.length > 0 && userLogs[userLogs.length - 1]._id === l._id;

      var cardClass = "conn-card" + (isSuspicious?" conn-suspicious":"") + (isFirst?" conn-new":"");

      // Badge
      var badge = isFirst
        ? "<span class='conn-badge conn-badge-new'>🆕 Première</span>"
        : (isSuspicious ? "<span class='conn-badge conn-badge-suspicious'>⚠️ Suspect</span>"
                        : "<span class='conn-badge conn-badge-return'>↩ Retour</span>");

      h += "<div class='"+cardClass+"'>";
      h += "<div class='conn-card-head'>";
      h += "<div class='conn-avatar'>"+initiale+"</div>";
      h += "<div class='conn-user-info'>";
      h += "<div class='conn-pseudo'>"+escHtml(l.pseudo||"Inconnu")+" "+badge+"</div>";
      h += "<div class='conn-email'>"+escHtml(l.email||"—")+"</div>";
      h += "</div>";
      h += "<div class='conn-time-badge'>";
      h += "<div class='conn-date'>"+dateStr+"</div>";
      h += "<div class='conn-hour'>🕐 "+heureStr+"</div>";
      h += "</div></div>";

      // Détails
      h += "<div class='conn-details'>";
      // Localisation
      if(l.lat && l.lng){
        var coord = l.lat.toFixed(4)+"°N, "+l.lng.toFixed(4)+"°E";
        h += "<div class='conn-detail-row'><span>📍</span><div><div style='font-size:0.62rem;color:var(--muted);'>Localisation</div><div class='conn-detail-val'><a href='https://www.google.com/maps?q="+l.lat+","+l.lng+"' target='_blank' style='color:var(--cyan);text-decoration:none;'>"+coord+"</a></div></div></div>";
        if(l.accuracy) h += "<div class='conn-detail-row'><span>🎯</span><div><div style='font-size:0.62rem;color:var(--muted);'>Précision</div><div class='conn-detail-val'>~"+Math.round(l.accuracy)+" m</div></div></div>";
      } else {
        h += "<div class='conn-detail-row'><span>📍</span><div><div style='font-size:0.62rem;color:var(--muted);'>Localisation</div><div class='conn-detail-val' style='color:var(--muted);'>Non autorisée</div></div></div>";
      }
      // Fuseau horaire
      if(l.timezone) h += "<div class='conn-detail-row'><span>🌍</span><div><div style='font-size:0.62rem;color:var(--muted);'>Fuseau</div><div class='conn-detail-val'>"+escHtml(l.timezone)+"</div></div></div>";
      // Langue
      if(l.language) h += "<div class='conn-detail-row'><span>🗣️</span><div><div style='font-size:0.62rem;color:var(--muted);'>Langue</div><div class='conn-detail-val'>"+escHtml(l.language)+"</div></div></div>";
      // Appareil
      var device = _parseDevice(l.userAgent||"");
      h += "<div class='conn-detail-row'><span>"+device.icon+"</span><div><div style='font-size:0.62rem;color:var(--muted);'>Appareil</div><div class='conn-detail-val'>"+escHtml(device.label)+"</div></div></div>";
      // Résolution
      if(l.screenRes) h += "<div class='conn-detail-row'><span>🖥️</span><div><div style='font-size:0.62rem;color:var(--muted);'>Écran</div><div class='conn-detail-val'>"+escHtml(l.screenRes)+"</div></div></div>";
      // Plateforme
      if(l.platform) h += "<div class='conn-detail-row'><span>💻</span><div><div style='font-size:0.62rem;color:var(--muted);'>Plateforme</div><div class='conn-detail-val'>"+escHtml(l.platform)+"</div></div></div>";
      // Connexions totales de cet user
      h += "<div class='conn-detail-row'><span>🔄</span><div><div style='font-size:0.62rem;color:var(--muted);'>Nbre de connexions</div><div class='conn-detail-val'>"+userLogs.length+"x</div></div></div>";
      h += "</div>";

      // Actions admin
      h += "<div class='conn-actions'>";
      h += "<button class='conn-action-btn' style='border-color:rgba(0,229,255,0.3);color:var(--cyan);' onclick=\"_showUserConnHistory('"+escHtml(l.uid)+"','"+escHtml(l.pseudo||l.email)+"')\">📋 Historique utilisateur</button>";
      if(l.lat && l.lng){
        h += "<button class='conn-action-btn' style='border-color:rgba(0,255,170,0.3);color:var(--green);' onclick=\"window.open('https://www.google.com/maps?q="+l.lat+","+l.lng+"','_blank')\">🗺️ Voir sur map</button>";
      }
      h += "<button class='conn-action-btn' style='border-color:rgba(255,68,102,0.3);color:var(--red);' onclick=\"openBlockModal('"+escHtml(l.uid)+"','"+escHtml(l.email||"")+"','"+escHtml(l.pseudo||"")+"')\">🚫 Bloquer</button>";
      h += "</div>";

      h += "</div>"; // conn-card
    });

    if(filtered.length > _connPage){
      h += "<button onclick='_connPage+=20;renderAdmConnexions()' style='display:block;width:100%;margin-top:0.5rem;padding:0.65rem;border-radius:12px;border:1px solid rgba(0,229,255,0.2);background:rgba(0,229,255,0.05);color:var(--cyan);font-family:DM Sans,sans-serif;font-size:0.8rem;font-weight:600;cursor:pointer;'>Voir "+Math.min(20,filtered.length-_connPage)+" de plus</button>";
    }

    container.innerHTML = h;
  }).catch(function(err){
    container.innerHTML = "<div style='text-align:center;padding:2rem;color:var(--red);font-size:0.8rem;'>❌ Erreur : "+err.message+"</div>";
  });
}
window.renderAdmConnexions = renderAdmConnexions;

// ── Détection type d'appareil depuis User-Agent ────────────────
function _parseDevice(ua){
  ua = ua.toLowerCase();
  if(ua.indexOf("iphone") !== -1)  return { icon:"📱", label:"iPhone" };
  if(ua.indexOf("ipad") !== -1)    return { icon:"📱", label:"iPad" };
  if(ua.indexOf("android") !== -1 && ua.indexOf("mobile") !== -1) return { icon:"📱", label:"Android Mobile" };
  if(ua.indexOf("android") !== -1) return { icon:"📱", label:"Android Tablette" };
  if(ua.indexOf("windows phone") !== -1) return { icon:"📱", label:"Windows Phone" };
  if(ua.indexOf("macintosh") !== -1 || ua.indexOf("mac os x") !== -1) return { icon:"💻", label:"Mac" };
  if(ua.indexOf("windows") !== -1) return { icon:"🖥️", label:"Windows PC" };
  if(ua.indexOf("linux") !== -1)   return { icon:"🐧", label:"Linux" };
  if(ua.indexOf("cros") !== -1)    return { icon:"💻", label:"Chromebook" };
  return { icon:"🌐", label:"Navigateur Web" };
}

// ── Historique d'un utilisateur spécifique ─────────────────────
window._showUserConnHistory = function(uid, pseudo){
  if(!window.db) return;
  window.fbGetDocs(window.fbCollection(window.db,"connection_logs")).then(function(snap){
    var logs = [];
    snap.forEach(function(d){ var dd=d.data(); if(dd.uid===uid) logs.push(Object.assign({_id:d.id},dd)); });
    logs.sort(function(a,b){ return (b.connectedAtMs||0)-(a.connectedAtMs||0); });
    var h = "<div id='_connHistOverlay' style='position:fixed;inset:0;z-index:600;background:rgba(0,0,0,0.92);backdrop-filter:blur(10px);display:flex;align-items:center;justify-content:center;padding:1rem;' onclick='if(event.target===this)this.remove()'>";
    h += "<div style='background:var(--surface);border:1px solid rgba(0,229,255,0.3);border-radius:20px;padding:1.4rem;width:min(420px,100%);max-height:85vh;overflow-y:auto;position:relative;'>";
    h += "<button onclick='document.getElementById(\"_connHistOverlay\").remove()' style='position:absolute;top:0.8rem;right:0.8rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;'>✕</button>";
    h += "<div style='font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:1rem;margin-bottom:0.3rem;'>📋 "+escHtml(pseudo)+"</div>";
    h += "<div style='font-size:0.72rem;color:var(--muted);margin-bottom:1rem;'>"+logs.length+" connexion(s) enregistrée(s)</div>";
    if(!logs.length){
      h += "<div style='text-align:center;padding:2rem;color:var(--muted);'>Aucune connexion enregistrée</div>";
    }
    logs.forEach(function(l, i){
      var dateStr="—", heureStr="—";
      if(l.connectedAtMs){ var d=new Date(l.connectedAtMs); dateStr=d.toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"}); heureStr=d.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); }
      var device=_parseDevice(l.userAgent||"");
      h += "<div style='background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.1);border-radius:10px;padding:0.7rem 0.9rem;margin-bottom:0.5rem;display:flex;align-items:center;gap:0.7rem;'>";
      h += "<div style='font-size:1.2rem;'>"+device.icon+"</div>";
      h += "<div style='flex:1;min-width:0;'>";
      h += "<div style='font-weight:700;font-size:0.78rem;color:var(--text);'>"+dateStr+" — "+heureStr+"</div>";
      h += "<div style='font-size:0.65rem;color:var(--muted);'>"+device.label+(l.timezone?" · "+l.timezone:"")+"</div>";
      if(l.lat&&l.lng) h += "<div style='font-size:0.63rem;color:var(--cyan);margin-top:0.1rem;'>📍 <a href='https://www.google.com/maps?q="+l.lat+","+l.lng+"' target='_blank' style='color:var(--cyan);'>Voir position</a></div>";
      else h += "<div style='font-size:0.63rem;color:var(--muted);margin-top:0.1rem;'>📍 Position non disponible</div>";
      h += "</div>";
      h += "<div style='font-size:0.62rem;color:var(--muted);text-align:right;'>#"+(logs.length-i)+"</div>";
      h += "</div>";
    });
    h += "</div></div>";
    var wrap = document.createElement("div");
    wrap.innerHTML = h;
    document.body.appendChild(wrap.firstChild);
  });
};

// ── Exporter les logs en CSV ───────────────────────────────────
window.exportConnLogs = function(){
  if(!window.db) return;
  window.fbGetDocs(window.fbCollection(window.db,"connection_logs")).then(function(snap){
    var rows = [["Pseudo","Email","UID","Date","Heure","Latitude","Longitude","Précision","Appareil","Fuseau","Langue","Écran","Plateforme","Nbre connexions"]];
    var all = [];
    snap.forEach(function(d){ all.push(Object.assign({_id:d.id},d.data())); });
    // Compter connexions par uid
    var uidCount = {};
    all.forEach(function(l){ uidCount[l.uid]=(uidCount[l.uid]||0)+1; });
    all.sort(function(a,b){ return (b.connectedAtMs||0)-(a.connectedAtMs||0); });
    all.forEach(function(l){
      var d=l.connectedAtMs?new Date(l.connectedAtMs):null;
      var dateStr=d?d.toLocaleDateString("fr-FR"):"";
      var heureStr=d?d.toLocaleTimeString("fr-FR"):"";
      var device=_parseDevice(l.userAgent||"");
      rows.push([
        l.pseudo||"",l.email||"",l.uid||"",
        dateStr,heureStr,
        l.lat||"",l.lng||"",l.accuracy?Math.round(l.accuracy):"",
        device.label,l.timezone||"",l.language||"",l.screenRes||"",l.platform||"",
        uidCount[l.uid]||1
      ]);
    });
    var csv = rows.map(function(r){ return r.map(function(c){ return '"'+(String(c).replace(/"/g,'""'))+'"'; }).join(","); }).join("\n");
    var blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href=url; a.download="ambi241_connexions_"+new Date().toISOString().slice(0,10)+".csv";
    a.click(); URL.revokeObjectURL(url);
    showToast("Export CSV téléchargé ✓");
  });
};

// ── Purger les logs de plus de 30 jours ───────────────────────
window.clearOldLogs = function(){
  if(!window.isAdmin){ showToast("Admin requis"); return; }
  if(!confirm("Supprimer toutes les connexions de plus de 30 jours ?")) return;
  if(!window.db) return;
  var limit30 = Date.now() - 30*24*60*60*1000;
  window.fbGetDocs(window.fbCollection(window.db,"connection_logs")).then(function(snap){
    var toDelete = [];
    snap.forEach(function(d){ var dd=d.data(); if((dd.connectedAtMs||0)<limit30) toDelete.push(d.id); });
    var promises = toDelete.map(function(id){ return window.fbDeleteDoc(window.fbDoc(window.db,"connection_logs",id)); });
    return Promise.all(promises).then(function(){ showToast("✓ "+toDelete.length+" entrées supprimées"); renderAdmConnexions(); });
  }).catch(function(e){ showToast("Erreur: "+e.message); });
};

// ── Paramètres admin ───────────────────────────────────────────
function renderAdmSettings(){
  var iAmSuper = isSuperAdminUser();  // recalcul live (fallback inclus)
  var superEmail = _superAdminEmail || lsGet(SUPER_ADMIN_KEY, "");
  var html="";

  // Bloc SuperAdmin
  if(iAmSuper){
    html+="<div style='background:linear-gradient(135deg,rgba(255,215,0,0.1),rgba(255,45,155,0.07));border:1px solid rgba(255,215,0,0.35);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
    html+="<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem;'><span style='font-size:1.1rem;'>👑</span><span style='font-family:Syne,sans-serif;font-weight:800;color:var(--amber);font-size:0.88rem;'>Propriétaire de l'application</span></div>";
    html+="<div style='font-size:0.72rem;color:var(--muted);line-height:1.6;'>";
    html+="Vous êtes le <strong style='color:var(--text);'>SuperAdmin</strong> — vous seul pouvez :<br>";
    html+="• Promouvoir / révoquer des admins secondaires<br>";
    html+="• Céder la propriété de l'application<br>";
    html+="• Accéder à tous les paramètres sensibles";
    html+="</div>";
    html+="<div style='margin-top:0.7rem;font-size:0.68rem;color:rgba(255,215,0,0.7);'>Email propriétaire : <strong>"+escHtml(superEmail)+"</strong></div>";
    html+="</div>";
  } else if(superEmail){
    html+="<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:0.75rem;margin-bottom:1rem;'>";
    html+="<div style='font-size:0.72rem;color:var(--muted);'>👑 Propriétaire : <strong style='color:var(--amber);'>"+escHtml(superEmail)+"</strong></div>";
    html+="<div style='font-size:0.65rem;color:var(--muted);margin-top:0.2rem;'>Vous êtes Admin secondaire. Certaines actions sont réservées au propriétaire.</div>";
    html+="</div>";
  }

  // PIN Admin
  html+="<div style='background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--amber);font-size:0.85rem;margin-bottom:0.7rem;'>⚙️ Paramètres de l'application</div>";
  html+="<div style='font-size:0.75rem;color:var(--muted);margin-bottom:1rem;'>PIN Admin actuel : <strong style='color:var(--amber);letter-spacing:0.2em;'>••••</strong></div>";
  html+="<div style='margin-bottom:0.8rem;'><label style='font-size:0.72rem;color:var(--muted);display:block;margin-bottom:0.3rem;'>Nouveau PIN (4 chiffres)</label>";
  html+="<input id='newPinInput' type='password' maxlength='4' pattern='[0-9]{4}' placeholder='Entrez 4 chiffres' style='width:100%;background:var(--surface2);border:1px solid rgba(255,215,0,0.2);border-radius:8px;color:var(--text);padding:0.5rem;font-size:0.85rem;'></div>";
  html+="<button onclick='changeAdminPin()' style='width:100%;padding:0.55rem;border-radius:10px;border:none;background:linear-gradient(135deg,var(--amber),var(--pink));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;cursor:pointer;'>🔐 Changer le PIN</button>";
  html+="</div>";

  // ── MODE APP ──
  var _appMode = (typeof lsGet==="function") ? (lsGet("ambi241_app_mode","live")) : "live";
  var modes = [
    {
      v:"live",
      l:"Live — Application normale",
      emoji:"🟢",
      c:"var(--green)",
      bc:"rgba(0,255,170,0.18)",
      details:[
        "Accès complet pour tous les utilisateurs et membres inscrits — toutes les fonctionnalités sont disponibles.",
        "Les établissements partenaires sont visibles en temps réel avec leurs statuts d'ambiance, avis et galeries.",
        "Paiements, réservations et module Taxi Pro opérationnels. Aucune restriction côté public."
      ]
    },
    {
      v:"prelancement",
      l:"Pré-lancement",
      emoji:"🔵",
      c:"var(--cyan)",
      bc:"rgba(0,229,255,0.12)",
      details:[
        "L'application est visible mais signalée comme étant en phase de test — aucune donnée réelle n'est collectée ni comptabilisée.",
        "Les visiteurs et membres peuvent naviguer, mais les actions sensibles (paiements, votes, réservations) sont désactivées ou simulées.",
        "Idéal pour valider l'interface avant un lancement officiel. Aucun impact sur les données Firebase de production."
      ]
    },
    {
      v:"maintenance",
      l:"Maintenance",
      emoji:"🔴",
      c:"var(--red)",
      bc:"rgba(255,68,102,0.12)",
      details:[
        "Un écran de maintenance remplace l'application pour tous les visiteurs et membres non-admins — l'accès est bloqué.",
        "Seuls les administrateurs connectés conservent l'accès complet au panneau de contrôle et aux données.",
        "À utiliser lors de mises à jour critiques, migrations Firebase ou corrections urgentes. Durée recommandée : moins de 30 minutes."
      ]
    }
  ];

  html+="<div style='background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.2);border-radius:14px;padding:1rem 1rem 0.6rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--cyan);font-size:0.85rem;margin-bottom:0.9rem;'>🌐 Mode de l'application</div>";

  modes.forEach(function(m){
    var active = _appMode===m.v;
    var borderCol = active ? m.c : "rgba(255,255,255,0.07)";
    var bgCol     = active ? m.bc : "rgba(255,255,255,0.02)";

    html+="<div onclick='setAppMode(\""+m.v+"\");renderAdmSettings();' style='border:1.5px solid "+borderCol+";background:"+bgCol+";border-radius:11px;padding:0.7rem 0.8rem;cursor:pointer;margin-bottom:0.55rem;transition:all 0.22s;position:relative;overflow:hidden;'>";

    // En-tête du mode
    html+="<div style='display:flex;align-items:center;gap:0.55rem;margin-bottom:"+(active?"0.65rem":"0")+"'>";
    html+="<div style='width:10px;height:10px;border-radius:50%;background:"+m.c+";flex-shrink:0;"+(active?"box-shadow:0 0 10px "+m.c+";":"opacity:0.35;")+";transition:all 0.2s;'></div>";
    html+="<span style='font-size:0.8rem;color:"+(active?"var(--text)":"var(--muted)")+";font-weight:"+(active?"800":"500")+";font-family:Syne,sans-serif;'>"+m.emoji+" "+m.l+"</span>";
    if(active) html+="<span style='margin-left:auto;font-size:0.58rem;font-weight:800;letter-spacing:0.08em;color:"+m.c+";background:rgba(255,255,255,0.06);padding:0.15rem 0.45rem;border-radius:20px;border:1px solid "+m.c+";'>ACTIF</span>";
    html+="</div>";

    // Détails explicatifs — affichés seulement si actif
    if(active){
      html+="<div style='display:flex;flex-direction:column;gap:0.4rem;padding-left:0.2rem;border-top:1px solid rgba(255,255,255,0.07);padding-top:0.55rem;'>";
      m.details.forEach(function(pt, idx){
        html+="<div style='display:flex;align-items:flex-start;gap:0.5rem;'>";
        html+="<span style='font-size:0.6rem;font-weight:800;color:"+m.c+";background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);min-width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:0.05rem;font-family:Syne,sans-serif;'>"+(idx+1)+"</span>";
        html+="<span style='font-size:0.72rem;color:var(--muted);line-height:1.5;'>"+pt+"</span>";
        html+="</div>";
      });
      html+="</div>";
    }

    html+="</div>";
  });

  // Note d'avertissement global
  html+="<div style='display:flex;align-items:flex-start;gap:0.45rem;background:rgba(255,215,0,0.05);border:1px solid rgba(255,215,0,0.2);border-radius:8px;padding:0.55rem 0.7rem;margin-top:0.2rem;margin-bottom:0.6rem;'>";
  html+="<span style='font-size:0.9rem;flex-shrink:0;margin-top:0.02rem;'>⚠️</span>";
  html+="<span style='font-size:0.68rem;color:rgba(255,215,0,0.8);line-height:1.5;'>Tout changement de mode est <strong>immédiat et global</strong>. Il affecte l'ensemble des utilisateurs connectés en temps réel.</span>";
  html+="</div>";

  html+="</div>";

  // ── TOGGLES FONCTIONNALITÉS ──
  var featureKeys = [
    {k:"feat_votes",      l:"👍 Votes utilisateurs",           def:true,  c:"var(--green)"},
    {k:"feat_presences",  l:"📍 Présences signalées",          def:true,  c:"var(--cyan)"},
    {k:"feat_reserv",     l:"⭐ Réservations VIP",             def:true,  c:"var(--amber)"},
    {k:"feat_notifs",     l:"🔔 Notifications push",           def:true,  c:"var(--pink)"},
    {k:"feat_evenements", l:"🎉 Événements flash",             def:true,  c:"var(--purple)"},
    {k:"feat_weeksong",   l:"🎵 Chanson de la semaine",        def:true,  c:"var(--pink)"},
    {k:"feat_classement", l:"🏆 Classement public",            def:true,  c:"var(--amber)"},
    {k:"feat_map",        l:"🗺️ Carte interactive",            def:true,  c:"var(--cyan)"},
    {k:"feat_avis",       l:"💬 Avis et commentaires",         def:true,  c:"var(--green)"}
  ];
  html+="<div style='background:rgba(204,68,255,0.04);border:1px solid rgba(204,68,255,0.2);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--purple);font-size:0.85rem;margin-bottom:0.7rem;'>🧩 Fonctionnalités actives</div>";
  featureKeys.forEach(function(f){
    var isOn = (typeof lsGet==="function") ? (lsGet(f.k,"1")==="1") : true;
    html+="<div style='display:flex;align-items:center;justify-content:space-between;padding:0.45rem 0;border-bottom:1px solid rgba(255,255,255,0.04);'>";
    html+="<span style='font-size:0.78rem;color:var(--text);'>"+f.l+"</span>";
    html+="<label class='notif-toggle'><input type='checkbox'"+(isOn?" checked":"")+" onchange='toggleFeature(\""+f.k+"\",this.checked)'><span class='notif-toggle-slider' style='"+(isOn?"background:"+f.c+";":"")+"'></span></label>";
    html+="</div>";
  });
  html+="</div>";

  // Infos Firebase
  html+="<div style='background:rgba(0,229,255,0.04);border:1px solid rgba(0,229,255,0.15);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--cyan);font-size:0.85rem;margin-bottom:0.7rem;'>🔥 Firebase</div>";
  html+="<div style='font-size:0.73rem;color:var(--muted);line-height:1.7;'>";
  html+="<div>Projet : <strong style='color:var(--text);'>ambi241</strong></div>";
  html+="<div>Email admin : <strong style='color:var(--text);'>ambi2412026@gmail.com</strong></div>";
  html+="<div>Établissements : <strong style='color:var(--green);'>"+etablissements.length+"</strong></div>";
  html+="<div>Admins secondaires : <strong style='color:var(--amber);'>"+_adminsList.length+"</strong></div>";
  html+="<div>Statut : <strong style='color:var(--green);'>&#9679; Connecté</strong></div>";
  html+="</div></div>";

  // Trafic
  var t=getTraffic();
  html+="<div style='background:rgba(204,68,255,0.04);border:1px solid rgba(204,68,255,0.15);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html+="<div style='font-family:Syne,sans-serif;font-weight:700;color:var(--purple);font-size:0.85rem;margin-bottom:0.6rem;'>📈 Trafic</div>";
  html+="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;'>";
  html+="<div class='adm-kpi'><div class='kv' style='color:var(--purple);'>"+t.count+"</div><div class='kl'>Aujourd'hui</div></div>";
  html+="<div class='adm-kpi'><div class='kv' style='color:var(--purple);'>"+t.total+"</div><div class='kl'>Total</div></div>";
  html+="</div></div>";

  // ── Photos par défaut (Admin) ──
  html += renderAdminDefaultPhotosSection();

  /* ── 🎵 Chanson de la semaine ── */
  html += "<div style='background:linear-gradient(135deg,rgba(255,45,155,0.08),rgba(204,68,255,0.05));border:1.5px solid rgba(255,45,155,0.3);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  html += "<div style='display:flex;align-items:center;gap:0.55rem;margin-bottom:0.6rem;'>";
  html += "<span style='font-size:1.1rem;'>🎵</span>";
  html += "<span style='font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.88rem;'>Chanson de la semaine</span>";
  html += "</div>";
  (function(){
    var cfg = window._weekSongGetCfg ? window._weekSongGetCfg() : null;
    if (cfg && cfg.active && cfg.title) {
      html += "<div style='font-size:0.72rem;color:var(--muted);margin-bottom:0.6rem;line-height:1.5;'>En cours : <strong style='color:var(--text);'>" + escHtml(cfg.title) + "</strong>";
      if (cfg.artist) html += " · " + escHtml(cfg.artist);
      html += "</div>";
    } else {
      html += "<div style='font-size:0.72rem;color:var(--muted);margin-bottom:0.6rem;'>Aucune chanson configurée pour cette semaine.</div>";
    }
  })();
  html += "<button onclick=\"weekSongOpenAdmin()\" style='width:100%;padding:0.65rem;border-radius:10px;border:1.5px solid rgba(255,45,155,0.45);background:rgba(255,45,155,0.1);color:var(--pink);font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;cursor:pointer;transition:all 0.2s;'>🎵 Configurer / Changer la chanson</button>";
  html += "</div>";

  // ══ LOGO & IDENTITÉ DE L'APPLICATION ══
  html += renderAdmLogoPanel();

  // ══ RESET TOTAL — NOUVEAU CYCLE ══
  html += renderAdmResetPanel();

  document.getElementById("adminSettingsContent").innerHTML=html;
  // Init des aperçus après injection du HTML
  setTimeout(initAdminDefaultPhotosPreviews, 80);
  setTimeout(initAdmLogoPanel, 120);
}


// ══════════════════════════════════════════════════════════════
// ══  LOGO & IDENTITÉ DE L'APPLICATION                         ══
// ══════════════════════════════════════════════════════════════

/* Clés Firestore pour le logo et les assets de l'app */
var ADMIN_APP_IDENTITY_DOC = "config/app_identity";
var _AMBI241_DEFAULT_LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAEAAQADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD4yooooAKKKKACiiigAooooAKKKKACiilxQAlFOC04L7UFKLYzFJUoQ0vlmgfs2Q0VN5Z9KQoaA9myKipCh9KaVoE4sbRS4pKCQooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiilAoAKULTlWp4YHkYBVJPtQawpuT0IAh9KlSIngAmvRfA/wl8TeI4RfGBNP00Dc15eN5cYX1GeW/AY9661rH4Q+CgBd3Nz4uv06pCfKtgfrnJ/M/StFTe7PZw+TVJLnqe6vM8c07RtQvplhtLSaaRuixoWJ/AV3Wi/Bfx5qSLJ/Yc1rG38d0ywgf99kH9K29S+OGqWsDWnhXSdL8P2vQC0t13/ixHP5VwmtePPFGruxv9avpwx5V522/kOP0qrQR1Kll1D4pOT8v6R3g+B89rg6x4t8N6d6iS83MPwA/rTx8LPBUXFx8T9EB7+XEz/+zCvJGvbqTne1Me4uepd/zovHsP65gYr3aX4nrw+GPgWTiP4n6SD/ALduy/8As1I3wXtbr/kE+O/DF5nopuShP6GvKtJM13ew24n2mRwu5mwBk4yT6V6b8cfhrcfDI6Tu8Q2+qnUIWceWhQoVIB4JOVOeG74PFUkmr2N6dbB1IObpaev/AACnq3wO8c2iGS306PUIgMhrOdJc/gDn9K4PWfDWs6TMYdR026tJB/DNEyH9RVnSvFuu6XIGsdUu7cj/AJ5TMv6A13ejfHDxRDELXVzaa1adGhv7dZAR9f8A9dR7jMeTLa+zcX+H6nkkkLKcMpH1qNkIr3Vb/wCEXjQFb/TrjwnfP/y2tD5lvn3Q9B9MfWsLxV8G9btLFtW8Pz2/iHSuonsG3sB/tJ1H4ZHvSdN9Dmr5JPl56TUl5HkhFNq7c2ssLlZEKkeoqsy1nY8OpSlB2aI6KUikoMgooooAKKKKACiiigAooooAKKKKACiinKKBpAoqREyaWOMsQAMmvU/hf8M/7Ys5PEfiS7XSPDtr80tzLwZcH7seepzxnB54AJ4qoxcmd+CwNTEz5Yo5fwH4G13xfqS2ek2TyDgySHhIwe7N0A/U9s16ey/Dn4XRhSsPizxJGOTn/RLZx+e4j8T/ALtY3j74oxJpreF/A9odF0JPlby+JrnsWduuD6Zye5PQeS3EssrFnJNaXUdtz2pV8Pl65aS5p9zsfHPxH8S+LJ2bUb9zBn5LeP5YkHbCj+ZyfeuQk86Rtzbjn1qbQ4oZ9RgjuH2RNIA7YztXPJ/Kvt3xH8A/A2peBX0vw5p0drfrEJLPUnlZnlbGR5hJwVcegG3II6c1CnKomzlSq41e0qTPlv4Z/CDxd4+sZ77RbWEWkDbGuLiYRRl8Z2AnqcY6dM84rj9b0K90TXbnSNShaG7tZmhmRuqMpwRX2R+y4ZfDnw38QWer20lvLpWquLiKQbTFlUDE/TBP4V5f+2Z4VOm+PrbxHFHiHVYcykDjz48K/wCY2N+JrSVFKCaN62AjGG2q/HZv8zpPB3wn+FmnfCnSvGfiuXUpIriCOS4kSQhFZ2IChUUnHGM5/Krms/Cr4UeM/hpqmu+AlubaawjlaOR5H+aSNN5jdH7FehGO3uK6b4c3egy/su2d14n099R0izhf7Tbpnc+y4O3HI6FgetW/hlrngf4geGNd8GeE9NvvDNs0GJjEiBtsh2FgcnJ6Ag8kdCK35YtWPS9nDlemifla2nTdnyD8M9Ah174haNokxcQXd9FDKU4YIWAOPfGa9L/a18H6D4S1zR4NCS4iS5si7xS3DShMSMq4LcjIHTp6VX+AmgPZftFWOlTFXk069n3kdCYlfn8xWj+2bcPdfE+1s1JP2bTYE2+hbc5/9CrFRSps4vZezw8oev52OZ+EXwL8R/EDSH1mC5tNO04OY0nudxMrD721VBJAzyTgVV+LPwS8VeALP+0rwQXum+YI/tdqxKqx6BgQGXPbIwfWu/8Ahv8ADT4x6t4Pi0RdQm0Tw7cv53k3UxTcDzkRqC+DwcYAPWu5+M2qaJ4B+Az+AbnXF1jWp4RAiOwaRVMokZyMnYq4woJz/R+yjy3aD6nR9lqtfxXnv+B8ZCR434JBrpfCHjXX/DN4t1pWoT27A8hW+Vv95eh/GsvTtJvdW1CO1sbWW4nlfbHHEhZmJ7ADk17PbfsxePZfDh1E/YI70ruTTmmPnNx0zjYG/wBkt+tc8YTesTzcLHFU3z0nYLfxN4D+JUP2bxfZxaFrb8Jq1omI5G/6ar3+p/76FcF8Sfhprng+ZZp40utOmP8Ao97bndDKOowexx2PP1HNcbdJPY3bwuGjkjYqwPBBHavRfhl8Ur7QIm0fVYY9V0G4Gy4sbkbkIPdc/dP6fQ80XT0keisTQxv7vErln3/zPL5EIPSoite1+P8A4baZqWiSeMfh7M9/pGC1zak5nsj3DDqVHr1A65HzHxueJo3KsMEVnKLR4+Oy+phpWlt0ZWop7CmVJ5rVgooooEFFFFABRRRQAUUUoFACqKmijLEADJpka5Nen/BvwNBrc8+u69J9k8PaYvm3kzHG7HIRT6n25545IzUYts9DA4OeJqKMTQ+FPgCwOlyeM/GUhtfD1qcqp4e8cdETvjIxx15AxglcX4rfEa98V3aWtugsdHtBss7GLASJRwDxwWx37dBgUfF3x/N4p1JLWyi+xaNZDyrGzThY0HGSBxuIH4Dge/nLuSauUktEenjcbDDw+r4fbq+5cs0+0XCoT949TX1sf2W9Em8GQpDrlwuvtGJDO4BtSSoO3aBuC8j58n1xzivkWwfZMre9fdWhJrXj74KeE9S8N6r/AGdrtpJEFut5Gzy8xS5xnOVCnbg5xW2HjGSd0LLIQqQfN3PkPxt4I8Q+B9dbTtc0+S1mU7kbqkq/3kYcMvuK+u/gt4mv/E/wKjOmy7ta0RPKG7ne0I3Rq3qHjyhrT8WeI/htqzx+APGus6XqF/5eJZCnlRxzY5ZZASIXPpnHY+lfPel/Ea3+C/jvxFpXhG4tvEWjTMqxSTOQrMvKtlODtJZTjhh6VqkqT30O6nGOFvLZaPXbT9PJn0rDe6B4q+G/iHxNo6FP7Y0qUXa7+UlihcYf0cAgE9wFNeK/Frx74T8Y/s96ZHearB/wktrJDi1XJl8xQY5GPGArJhs564FfP8vjTXxFqNra6ldWtpqMhkuraCVkikJJOCoOCOelYYW5nPAY5NROvdWRjVzCMk4Uk32+635H0B8Ivjj4e8LfDV/CWv8Ah+bVl86Rgm9PKeN8EqwYHoRmtK6/aW07SdOntvBngbTtHkkHyyFlIDdmKoqhiO2SRXhWi+BvFWr7Tp+h6hcBujJAxH54xXTW3wS+IM67v7BmQf7bov8ANqhVajVkhweNlCyp/n+rsR/CT4jL4P8AiKPFWoWbaluWVZU83a5MgILBiDzk55FautfEzTPEXxxtvHGq6W39nR3cEjWe8OxijCgDJwCflz6VQn+B/wAQol3f2FKw/wBiWNv5NXO6x8PfF+kgte6BqMSjqxgYj8xxS5ppWaJ9nj6au4X/AOHv+Z9ba5408CfE3To7LT/idf8AhqV1IaE/6OJCT/HuwG9OHx7V88/Gf4cSeCNQ06SbxLYaxbakXaOSB/nCqQCzLk9c8EE5wfSvLpI7y2YhldCOoqGa6nfAdicdKcq3MtUZ1swXJyTg1bofdHgzwxoXgb4d/wBvfDHSLTxZqskQH2zz13y5HOO6gf8APJcMe5NWNR8U6z4F+Dt34s8VXRl8RX4DQwONqwyuD5UKp0UIuXI9c55r5n/Zk8VwaH8RbI6t4hn0jS33eeQ5EUpCnakg5G0tjJxx7da739pT4s+EfFOk3PhrTrBr+6tLpTaaoJf3W3A8wqvU5I288EDPFbxqLkudsMRCVLmW3+XT7+33HgkGi634lu7250/T7y/aJWnuWhiaTYueXbA4GT1NLq3gzxJpOhW2u3+j3tvpl0xWC6khKxyEdgfwP5V75+xbp3itfEF9qVhJ9n0Iqsd8zR589xkpGh7MMk5HQHnOQKpftb/FSDWpj4K0WVJdPtJg15OpyJ51yAFP9xMkZ7nPYCsHTXJzM8+phqfs3Unu9Tx74c+OdX8HazHeafOQvAliY/JKv91h/XqK9C+IXg/RfGnhuXx34EgWExjfqulpjdbN1LoB/B1JA4xyOMhfC92G4rsfhj421Pwfr8N/ZSnbnbLET8sqd1b/AB7HmsYyWzHgMfCpH6tiNYvZ9jkZ4mRyrDBFQMK9p+MHg/TNQ0eH4g+Dov8AiTXjYubdRzZzd1IHRSenoeOhXPjUikE5qZRszz8wwMsLU5Xt0ZDRSkUlSeYFFFFABRRRQAU9RTVFWLeMu4UDJNBpTjzOx0fw88L33ivxJaaRYpmSZ8FiOEXqzH2A5rvvjX4psNPs7fwB4XfbpOmHbPIp5upx952I6gHP457Bca2j7Phf8JG1jPleI/ESGO14w0Ft1Lj0JyCPcp6GvCrydppWdjkk1q/dVj6SvJZdhlSj8ct/LyIZXJPWoyaCaSsj5mUrslhbDCvqD9m74j+G9L+FviPw34l1pdO+WSS2Pzb3EkRRlj2j7wYKQOOv1r5bU4NTRyOOASM1pTqODO3B4t0G/Mv393I9y7BycnrS6dYX+q3cdvaQS3E0h2qiKWZj7Ada3vh14I1fxnqwtLCILEg3zzycRwp3Zj2/rXoeseM/DPw5s30fwAkV5qu3Zda3KoYk9xCOgHv0+vWqtfV7Hp0MG6sXXxEuWH5+hT0z4VaV4fs49S+ImuQ6QjAMljFiS6kH+6Pu/r74p8/xM8I+GmMXgnwdaLIpwt7qQ8+U+4Xov515NrOs3+qXkl3fXU1xNI253kcszH3JrNZyTSdS3whUzeFBcmFgku/U9H1z4yePNTLK+v3UEZ/5Z2xEKj/vkCuXufF3iC5ctPq99IT1LXDn+ZrAZZAMlGA9cUiK7ttRSSewqHNyPPnmmKm/jZv2/izXoG3Q6texn/ZnYf1rpNF+L3jvSyPI8RXsi/3Z381fyfNeezRywttlRkPoRimhqOZoI5niqb+Nnttr8WtE1xRb+NvB2magG4a6tU8ice+Rwf0qS5+G3hTxhA1z8PNeR7rBb+yr8iOf/gJ6N/L3rxBXNW7C/ubSZJreZ43QgqysQQfUGq9pfc9GnnSrLkxMVJfiaGv6Fq3h+/kstRs57WeM4ZZFKke/096oWsn79fNbjPJr2Hwz8StJ8VadH4b+JFv9rhxsg1VF/wBJtj6k/wAQ/X1DVynxQ+HV/wCEp4ry3lTUNGuhus7+DmOVTz26N7flmnbqh4jAR5Pb4V80e3VHsfjj40eFdA+Eth4T+GhmhluLby7mVoyj2wI/ecn70rnOWHAHTtj5gu7hppC7Nkmo5GYcHNRE5oqVHM8vF42VbTYM81JG2KipQcVkcMXZnq/wQ8cQ6Hqcuj64oudA1JPIvYH5XB4D/Ufy9wKyPjH4Km8HeKJbVSZbGcedZz9pYm6HjuOh9x6Vw9vIUcMDgivevCsifE/4U3Hhq4KvruhRm401j96WLHzRfoAP+Ae9ax95WPp8HNZhhnh5/FHWP+X9foeAMKjq3eQtDM0bDBBqqwrJnzdWDhJpiUUUUGQUUUo60AOQV6B8EvCv/CU+NrOzlX/RIz51yx4AjXk89s8D8a4OJcnivdPBoHgv4E6v4hP7u/12T7Ban+IRjO9h/wCPfiBWlNa3Z7uS4dSq+0ntHU4v45eLf+Ep8Z3M1udthb/6PZoOAsS8DA7ZOW/H2rztjU1zKZJGY9zVcnNTJ3dzz8diXXqub6iUUUoqTiBRmur+HHhDUPF/iKDS7FANx3SSN92JB1ZvYf4DvXO2Nu9xOkUYJZjgACvb/Fc0Xwt+HsXhezKr4i1iES6rKp+aCI/dhB7E859s+orSEVuz2srwcJ3rVfgj+PkZ3xM8a6boejHwH4Hfy9Li+W9vF+/fydySP4PQd/pivHZZWdizEknvS3ErSOWYkk1EAzdATUyk5M5sfj54md9l0XYQmljYJIrEZAPSkII6ikqWedc+h/htrfh/4jQHwzffCeCWG2tQJL/QIZBdwAADzSuSH56g4yT1FcH4MsNF0Lxnqul+JoJNPSW3lhsrm8t2H2WbIKSMo5HQjvjOecVs/CHQrOw8PW3iS61rWbGS/vzYQHTCAYWAU75CSOPmGF4zgnIxXa2F8/xQbXvhr4suYNU8Q6Ws7aNrK4Mszw5JgZ+rowU7SckHHrXjyoVsmqfWUr0na6u21563/A+ghh6uFjSxM0nfY83+Lt3beKtd0ax0e4XXNWS1WC8vreIgXcu9tuBgFiFKruIBbFbNr8AdSsraOTxf4o8P+GJZFDLbX13+/wCfWNAxX8cVrfD1Ifhh8Jb3x75aN4g1K8bTdKZwCbQKuZZlz/F8yqD2yTUWuXnw18OeH7d/EjX3jTxLqlqLqeWDUDHDaM4yqEgEu44LZ6HiuTH5ricVXaw90r20V22t99El57nJiaixFV1qis30PIvHehWnh3xDPpdlrVjrMUWMXVmxMT5APBIB46HjqKwgafcOJJmdc4J4qPBr36UZRglJ3fc8ttXuiWOQqcg4r1T4S/EKGwt5PCvimNr/AMNXvyzQtyYCf+WiehB54/nXlGGHJBqSJyrAg8itoycWd2Bx08NU5o/8Od58XvAc3hHV1e2lF3pN4vnWN2nKzRnkcjjIyM/gehrz9hg17j8ItWtfGvhmf4a69MitIGl0e4k6wT4J2f7rc8fUdxXkXiPSrrR9XudOvImint5GjkQ9QQcEVU0t0d2aYSDisTR+GX4MyaKUjmkrM8Iehrrvhh4luPDHi2x1SBmxDKC6g43L0ZfxGa48HFTwOVcMDgg04uzOzBYiVCrGceh6j+0R4bt9M8WLrGmKDpesxC9tig+Ub+WX8Dzj0IrypxXvVsF8bfs9XEJ/eah4anEqHqxgfqPoP/ZK8ImUqxB7HFXUWtz1M7oRVRVobTVyCilPWkrM+fCnKKbT0oGtzQ0a3e5voYI1LM7gADua9f8A2kLpNKtvD3gu2KiPSdPXzQveV+WJ/AA/jXJ/AXShq3xL0a2ZdyLcLKw9k+c/+g1D8bNVOs/ErWrrdlftTon+6p2r+iitVpD1PpaT+r5ZKfWTt/X4nCMCTxTChz0r3P4L/Dnw3P4TvvHfjqWVNEtG2RQRnDXD8ZAPXHIGBjJ7gAmqvg74Z2fxG8Y6tNoBbR/Dds7SCe6O8wxknapPALYB74wCSeK7Fl1RxT6s+DnnNFTmntHd9L9jxUgilQZNexfGD4O/8IjoNv4h0fWrbWtImk8szwgDY3OAcEjBweQeoIOK8ijQlwo7nFctfDzoS5ZHdgsVTxceamz1X9nvQ7N9auvFWrpnTNBgN5LkcM4+4v1JGfwrhvHWv3niPxJfavevumuZS7DsPQD2AwB7CvT9Xb/hFP2edPs428u68RXbTzDuYYuFH0ztNeJStkk1M9EkfVZlL6th6eGj2u/UjPJr23wXb+GfBXwih8V+IvDVnrt3rF80FtDdFgEhjX52BUgglmAz7V4pCN0qj1NfQvxJ1jwzoHhLwP4c13w4dUiXQ47nMd08LxvK7McYBBzx1FdmBSip1H0X5nxuLorF16OFlPkUm23rsle2nd2OcHij4K6qMaj4H1bSnPV7DUd4H/AZF/rQfDnwQ1U/6B4y1vSWPRb7TxIB+Mbf0rHc/CDURwviPR3P/XK5UH/xw0w+CPBd7gaV8QrCNj/Df2ssB/MBh+ta+2lLeMZHovhGov8AdsRf0nf8JHY6T4G+zaZeWHg/4v8Ah6S1vU2TW8l09r5o9GVwBWRZfDT4neBL3/hMtDNtOdNVp/tlldxTiMActgE8AHuK4vQfBGta5qF9aaHdWV0bR9pYXaIJOSAU3kFhx29q9X+C/hPxT4bPi6XX9OureA+HbxUklU7CxUDAPTNCo0sYvZTp6O67o4cdhc6wWG+sSqOcI91523Rx+jfDv4n+NPDlreFZBorySSwvdXaQwhifnZQ7ADJHJHXFWx8GLa0G7X/iF4UsMfeQX3nuPwjBroviToHiXX/h98PoPDtheXe3SpPNNujEKfOf72OB+NeWW3gfX5vElxoV/PaadeQRiSX7bdpCqqcfxE4J5HA5pPDUMM+SFK/4GWDwWb5nTVaMuWMm0rR7Nrd+h2f/AAiPwb0vnUviBfaiw6pp+mtg/wDApCP5Uo1z4GaV/wAenhfxBrDDobu+SFT+CKT+tYi/D3w9aHOsfELQosfeS1825b/x1cfrTlsfhHpp/wBI1bxBqzDtBbRwKT9WZj+lP2so7Qij0v8AVHEP/ecQ16zS/BHWagvg/wAf/CzxDe+HfCFpoWo6C0VyPJleRpbdiUfcWPOCVNeE/dYg19EfBPWPB2oazq3hrw/4furNdS0e7hkmub0ys2IiwG0Kq9VBr57vUMd3Ih4IY1ljUpQhU6vexwYfDxwWKq4WNTnSs1q3a/S780XtCv59O1GC8t5WilidXR1OCpByD+det/Hi0g8SeH9E+ItjEqnUIRBfhRwtwgwfzA/QV4pEea9v+EUg8SfC7xb4Rm+eWO3Go2i9w8f3sfUAD8a4oaqx9llE/b054WXVXXqeHuMGmVYuo9kzJ6Gun+GXgfVvHHiCLSdKjBdvmkkc4SNB1Zj6f/qop0pVJcsT5rFVYYdOVR2SOSCMe1OXINfSrfDL4N+HR9i8SeOmnv1+WRLVflVu44Vunuc+1c98Tvg9pVn4Ufxf4G1xNb0eNts+APMhPHXHbkZyARkcY5rvlllSMb3PHpZ7QlNKzSfVrQzv2Y9TiHi6bQLxs2msWstpIp6HKkj+RH415r4v0yXSfEN9pswxJbTvE31ViD/Kr/w91BtH8Y6bfKSDBco5+gYZ/Sut/aZ01bL4oahNGoEd2I7lSB13qM/qDXE17p9/J/WMqjLrB/h/TPKGptPemVifNvcKkTrUdSx9aCobntP7LESx+Lr7UWH/AB5abPMD6HAH9TXlGrzGbVZpXOWZ8sfU165+zp+60Txpcr96PRJQPxB/wrxq9y124HJ3Vs9Io+hzH3cuox73PpvwrosvxF/Z007w54buYP7R02+Z7m3eQKSDuIOfTDcE8cEdaf48t/8AhX3wtsPhtpEouPEWrzCS/jt8s+DjCjHPJCgDuFJ6MK8T8HaF4+iRL3w/YayokGFltYpBuH1UdK9Cl+EPxSsdP0nxtaG4uNUlm3pDGzG7t3U5DuCMjp1z6Z617E8fCkoKcWpS91efXT8z8teAvOTVROMW5W8/PyNr4i283gj9m+y8L606pq2qX/2r7OTlo0Xrn8lH1JHY186adGZr6JAOrcV2nxgsvH0GqR3njqO/F1cpmOS6/jUcfL2wPQdK5vwRCLjxRpsJ6PcxqfxcCuPH1HOola1j6LhrCpOPvKXNK7ttuelftNSLZ6poXh6IjytM0iCLA/vEZP8ASvFn616v+07KZPivqi9k8pB9BEteTtXDU+Jn0mdzcsXL+ug+3OJ0Powr6sj0DRfFfxA+HS63ax3VjqPhURQRuSFadIpFXkdw4Xivk8cHNfQ3wn1W48XfD2103T7jZ4s8IXJ1HSFB+a4gyGkjX1KkBgO/NE6M8Tg62Gpu0pLT1PlMbJUK9HEy+GLs/R9TwXWbdrTVLi3ZdpSQqR9DVQMR0JFe5fGbw3ovi7Tbv4j+GbiyspAA+s6PJIEmtZ2bDMinG+NmORjkZwRXhh615+BxX1inqrSWjT3T7HrTVndPR7Ekc8sZykjL9DXtXw2vbzR/gb401y9uJQt8sOl2eWPLO2+TH0Vf1ry7wT4Y1bxZ4gtdH0i1ee4ncKoA4HuT2A9a7v4363pthpmlfDnw/cJcafoQb7Tcxn5bm7b/AFrj1UYCr7DPevcwl6UZVn6L1PIx+InWnDB05PVpy8knfX1Zr+INQv8AVf2b/D99p9xMr6RqE9lebHI+WQCSMnH/AAIV4q9xO7l2lYsepzXp/wAB/EWmIdU8D+I5xBoviGIQvO3S2mU5im/BuD7E1x/xC8Iat4N8SXOj6rbtHJE3ysOVdT0ZT3BHINGJvVpxqr0Y8DiJ0Kk8JOTtdyj6PV29Gc6XY9WJ/GpbCFri8iiVSxZgMVBXs3wX0fwl4e0yL4heKdQtL6SCVhp+hxOGnuZlxgyD+CMHBJPXGBXiY3E/V6XMk23okurPWguZ6s9K0vQtK8L/ABaso9OsYrV9I8HG41TYOGnNqxZm9GJdQa+V9QfzL2V/Via+gfG2s3vhvwJreva5L/xVXjlt3lHh7ey3biSO28gAD+6tfO7EsxJ6mu6jQqYXA0cPVd5pXfqzyMHNYnFVsTD4XZLzt1+8VK9Z/Zkv/s3xOsbZz+6vFktpAf4g6Hj8wK8lXrXd/BKUxfE3QHBxi+i/VgKIO0kfU5PNxxULd/zMHxnZf2f4l1CyxjyLiSP/AL5Yj+le1/srK934d8a6bpcqxa3Ppv8AojZwxAzkA+uSteYfGyMRfEzX1UYH26U/+PE1H8Jj4sHiq3bwclzJqkW6SNYBliFBLZHQjGcg8GuzA1PZ11pc8XirCqp7WF7a9dtyjq2lazFqctvcW1wkyOVZXUhgc9CDXunwZ0/UvDfwh8bar4hjkttNu7DybdZgVEspDAYB6/eAz/ga2Ph5+0DpN5qs0HxE0+1tY4YD5d1aWpaQyDGAQScA89Mc46CvFPir8VPEnjW5aC+vibCNyYII12RgdiVHU47nJrop4zD0q84rmbS6rR37PrbqfO1MNjcXThCcYxj11u9DjYJNupK6/wB/ivWf2k0Fzb+FNWHJu9FiLN6kZ/8Aiq8btHJuEPfcK9m+N37z4XfD+Y/eNjIpPsCmK8/m5kz9JyvXLq0PQ8RfrUdSP1qOsD5+e4VLH1qKpI+tA4bnuH7Og8zQfGsA+8+iS4H0Df4143eHZdue4avYP2WJBJ4k1XT2P/H5pc8QHqeP/r15JqsZj1GVGGCGwa2fwo+hzJc2XUX6nr3hP40/E6WzsNC0i5STyI0t4ESzR3KqNqj7uScYFe2WviPXfB2hL4j+JniiUXjrut9GtljV5D/tYH59h3JPy1xvwB1/4UeFfB1vf3Wqx2/iGVWFxJJA7yQHJAEfylduME9yTg8cVJ4k1b4FatqUupa3revatducu7Fvm9h8owPYdK+moXjTvKV2fjeLjGpXcY0mop9Fq/8AI8X+NPxG1Px/q0c9zEltZ2+5bW2jHyxAnJ56knjJP6DiuV8FTCDxNp0x4CXMbH8GBrvfjLffCu50y1i8CadqNvepIfPknb5GTHAALE5z34rzLTJDFeRODghuK8HG39rdu59zw9OFNU3GLik9memftPwmL4rakw6SLFID7GJa8mavav2kYhfP4c8TR4aPU9JiZiP76DDD9RXi0g5rlqfEz6DPKfLipfL8hlaPh7WdR0HVrfVNLupLa7t3EkUkbYKsO9Z1FRGTi7o8SUVNOMloz3e18U/D74nTRReL9PudE8QzsEbUNMQNFcueN0kJxhj3Kn8Kbr/w1+FnhTVrmy8QePruS5tJCk1ra6aTJkdss238a8/+B2njU/it4csiuVk1CEEe28E1H8aNQOp/FDxDels+bqExH03nFesq8XQ9rOCcr2Pnng5Rxf1ejUlGHLeyfn0vsdX4h+J2kaNotx4e+GukPo9rcIY7rUJnD3lyndS44RT/AHV/E15LI7SOXcksepptFedWxE6z949nC4OlhU1BavdvVv1Y5GZGDKcEdDXrHhP4padd+H4fC/xD0b+3tLgG21uVfZd2Y9Ec/eX/AGW4+leS0UUa86LvEeJwlLExtNbbPqvRnttl4C+EniG9hTRviBdWclzIscVreaa28MxwBuQlT9au6vN8N/hLq1zY2Vld+J/EdjIY99/GI7SCVTjPlgkuQemSBXjXhK7ay8SafdKfmiuEcfgwNd5+1HaLbfGbW3T7tzItyD6+Yiv/AFr0VXj7F1YQSkmeJPBTeKjh6tWUoNN2v2eztujh/GPiXVvFeu3Gs6zdvc3c7bndv0AHQADgAdKxqKK8qUnN80tz6GnTjTioQVkhVrv/AIF27XPxO0GMDP8Ap0ZP0Bz/AErgkFeu/syWinx8NUm4g0y1mu5G7AKhA/U06avJHs5NByxULev3HLfGS4W5+JOvSqcq1/Nj8HI/pXpH7Gtr5vjjUJwQGi02Uhm6KTtXJ9hmvF/E1299rV1ductNK0h+pJP9a9C+BPjSw8IQeIze21zLLf6XJa2xhAO2RuhbJ4X6V25fJLEJs8DivmrwqqGt3+p3uqfs46he3Mk1l4r0K4LsWIWVup+gNYOtfs1+NLOwuLyKbTbmOCJpTsuMEqoJONwHYV5FcalfpcNtmkXnoCeKH8Q6yIWh/tC6EbDDL5rYI+ma6alfCybvDX+vM8elhMfC3LVVvQpQR7LtU64avZPjb+7+F/gCE8EafI/4EpXjunZlvI+5LV7B+0m32SDwpow4+yaLFkehbP8AhXmLZtH6HliccBWk/JHiklRVI/Wo6xPn57hT0plOU0CW56b+ztqi6Z8UdIkdsJLN5J/4GCv8yKxvi9pbaR8QtZsdu1Y7uTb/ALpbI/QisHw3eyWGr213C22SKRXU+hByK9V/abskudc0zxTar/o+s2EU4btuAAI/LbWq1ifSw/f5XKPWLv8A1+JnfBz4daX40067nvfF+m6NNBIqJBcMA8gIzuGSOO3Ga7+5/ZtnMCz2/i/SHicfu3fcqv8AQ8g/hXzpZTTpKFiZgc9q+sPAGgp4t+BmkweJriXSbXTL1pheSDaGt+rYY8YySM9MjueK9vAKlWjyuOx+W5xLEYWfPGpo3tZaHAa9+zd4ns9MuL231TSrxYY2kKRTHc2FLEDK4zgHjNeEMhhmKk8qa+gPit8XbCy0aXwd8O4GsdKw0c93jE1yCMHnqAffk+w+WvnyVnMhY9zXHmEaMZJUz0skqYuUXPEP07ntsQHjD9npoU+e98M3RkI6n7PJ1/I/+g14lOm1iDxivR/gN4pt9A8VC11M7tJ1KM2d6jHjy34yfoefpmsf4seErjwj4uvNMkVmiDb4JD0kjPKsPw/UGuCWquffY+P1vCQxEd1oziaK3fBXhnUPFviO30PS/J+1T52ebKsa8DJ+ZjjoK9ys/wBm3+yLJb/xVq126Fd3k6Vp8l0x9t2Ao/OtaGDq11eK0PisbmmGwcuWrLXscR+ynAr/ABf066fGyyjmumJ7eXEzf0rzfxFObnW7y4Y5MkrMT9TmvoXQ/Efw8+HWqvDpngrxFI00L29xe3s/lyCN1KvtQLgHBPU1xXjn4Ti702XxX4AvX13Rj880e3F1ae0sfXH+0ODXfWwk40FTjq1ueXhsxpyxcq1ROMZJJN+X5Hj9FPljeJykilWHBBpleM1Y+lTuFFFORWdgqgkn0oAksm2XcTjswNet/tQKLjX/AA/rAwRqOg2cxI7kR7D+q1Q+H3wnvNR0z/hJvE94mg+HYuWupx88xH8MSdXb6cDua7/VvFXw18Wix0C88GeIbiy0yBbSyvre4H2jygScsm3aeSTj3xXr4fCzdCUJac1rHzeMx9P63CpSTkoXvbz8z5uor6Rn/Z2sddtGvfCuq6lbJjKxavpskH/kQArXifxA8H6j4K8QPo2qSWz3CqHzBMsi4PTkfy61x18FVoK8loelg82wuMnyU5e92OfjGTXtPgpP+EV+CWv69LlLjWXXTbUkYynWQj8Mj8K8w8HaJd69r1ppdlGXnuJVRB7k9/bvXoHx+1e0hutP8F6RKH0/QYPs5ZTxJMeZX/Pj8DWMNE2fa5ZH6tQniZdrL1PKm/ez+7GvozwmNK+FHwo0zxW+j2upeItcLG0Nym5IIl749Tx9c+g5+eNLtLq9vooLOCSeZ2CpHGpZmJ6AAdTX0P4c8d/D+/8ABemeGviRpWoQ32gFo4TCpy655VhkEHgAj2HI5r0stUVzSej6M/Ps+lOo4pK6vdpbsreCvBfhWLwzN8RPiV5iW1/OxsrK3XYZmJJJAGML1wBgYHXoDhfHLwJ4VsvDGleNfBUs/wDZGpO0Rhn+/FIvJH04PHPTqQaueKNU1j41+N7fRPCtgINM0+HbZ2u8KIYVwGdu2emcewGcU/8AaG1LTtC8K+H/AIbaXex3h0oNLfSxtlfPbqufbn6Zx1Brtqqm6UtNF17s8rDuvHFU1zPmb1j0UTyfwBpzan4t02wUE+fcxx/mwBrsf2mdRW9+KGoQxsDFaCO2QDtsQAj881Z/Zr0xJ/HB1i4AFrpNvJeSs3QBVwP1Ofwrzzxjqcur+Ir7Upjl7md5W+rMT/WvBekD9Xf7jK0nvN/h/SMR6ZTmptYnzj3ClFJRQIsQNtYEdjmvdbVR41/Z5lgH7zUPDU/mAdT9nfr+XP8A3xXgyHmvVP2efE0Gi+MksdRZTpmpobS6Vj8pV+AT7Zxn2JrSm9bH0GSV0qjoz2mrHAaLeLpetW17Jbx3C28yu0UgysgBztPsehr1Lxj8RvFXxU1S10PTbM2tk7KltplmCUDdB9fbPAHTFcV8WPC03hTxnfaVIreXHITE5H34zyp/Ij8c16d+xrHbN411GTZG99Fp0rWgfpvyoP6Ej6E16GBnNz9leyZ8fxFhI4SUqso3lHb/ADNi2+EPgTwnYwz/ABI8UrFezIGFnaHLL9SASfrgD0JrI8ffCbwnqPgy78XfDfWpNRtbLm7tZR+9jHcjgHjrgjpkgnBx5b8Qr/XL7xNfXOsPM128zGYvnO7POfT6V6z+zde2Oi+BfGmv6tqFuLYWRtVtWlAkkdlJXC9T6fifQ13KVKpUdHksu58/OniaFGOJ9o3LTTpqfPys1vP6Mpr3LR2g+LPw8TRXZT4q0SImyLHm7tx1jz3Ydvw9TXiWoo7zvMqHaT1qz4Z1u+0LVrfUdPuHguIHDo6nkEf56V4b9yTXQ/Q8nzBUvcqaxloyvdw3On3bIQ8MsbEehBFa2k+O/F+kMG07xDqVtjp5dy64/I16tr+j6X8XdFfxD4cjit/FMKbtQ01OPtOOssfqfUd/r97xC/sp7Sd4Z42jkQlWDDBBHanz1KXwOws1yeEHzOKlB7Pc9Esvjz8RYo/Ku9ZGpRd0voI5wf8AvtSa6Xw5+0Pc6dereTeDfD32gDb51rC1s5HcHyyAQfQjFeFFabWsMfiIbSPmauSYKp8VNfLT8jvPjF4x0Dxnq8OpaP4Zg0OUoftQhk3LM+fvYwAv4da4OiiuerVlVk5S3O3DYeGGpqlDZfMK6z4W6/oHhvxIup+INBXW7eNDstml8td/ZjwcgeneuTopU6jpyUl0Kr0Y1qbpy2Z734n/AGhk1SYSQ+B9BLIuyI3avcCNR0VVY7VHsFrm7v49+PjG0WnXttpMRGAlhaRQAD/gK5/WvKKcq5rqlmGIl9o8+lkeBhtTv66nT6z4/wDGOsknUvEOpXWe0ly7D9TWHunu5wZHaRyepOajt4GkcKqkk17H4C8H6V4U0VPG/jmPEHXT9NbiS8ccgkHog4PP8sBsXOpV+J3Po8ryeNSXuRUYrd22Lnhe2i+FvgNvFF8qr4j1aIx6VCw+aCIj5pyOx9Pw9TjxW9uJLq6eWRizu2SSck1u/EHxZqXi7xBcapqEu5pDhEX7kaDoijsB/wDX6msOytLieQNHEz4PYUtZPlidGb4+m0qVPSEf6ue7fs86JZ+F/DmqfFHW4laPT4zHp0bcGW4IwMfTP6k9q4JfC/iXxzH4j8YAq8Nnuu72eZwmSzZwuerdTivTfA3jrwXrvgax+H/j6xk0yC0G23vbYkANz87r68nJwQfQda6f4leE9T034OWXh/wJbf2po8sjXF/fW7q7T8/L8qk/KOCcZxgZxX0H1eE6Sitl08z8xeMq0cTKU1aUna72UT5p8O2PiJjd3ehw3rG0haW4ltg37qPoWYjovNY0sk00xMjFmJ6mvoPxKU+FnwTj0EHZ4h8TKJbsjhorbsh+vT8WrxbwTod14i8T2Wl2qkyXEyoDj7uTyT7AZP4V5eLo+xUYX16o+pySUsxrNxjo3ZPv5nqGgD/hDvgFqepP8l54imFpBxz5K53n6feH4ivEJ2LuWJ5Jr1j9orW7V9ctfC2lOP7N0KAWcYU8M4xvb65AH/Aa8jc1xVHrY+uzqrFTjRhtBWGHrSUUVkeAFFFFADlNWrOdoZlkU4INU6kQ00a0puEro+gPEkafFD4SQa7bgSa/4ejEV8B96aDqH98cn/vv2ryHwj4i1Twj4ht9X0ucwXVs+5TjI9CCO4I4I7itr4PeNrjwb4ohvAPNtJB5V1AeksR6jHqOo9x9a2fjj4Ht9Hv4df8AD5+0eH9UXzrWVOVQnkxn3HbPb3BreM3Fqcd0e9mWHhmuF9sldrSS/r+vuOh8a/GfQPFnhy8gvvAOk/2zdQ+WdQQ4ZG4+cDGc8d2Nct8Ifh1rXjrWPItUaKxjYG5uSPliU/zJ7Ada47wXaaZd+JrC11m9Njp8s6LcXG3d5SE8tjvgV9B+J/i9pHhZrDwt8Lo4o7G0kBmu9m77U3fqMkHuTgt0GAAK9WhL6xapWex+aYulLBJ0MJF3et+iOd+PGp+DdI8OQ+AfCOm21z9kmD3OpFAZXkAIIDDr157cADpk+CyRSIclSBX2Z8Vbr4V+Hr6z1Hxb4V+0arqVst1ILbITJ4ORvHOQe3PfmvFviv40+Gmr+Gm07wt4J/s29MqsLtpOVUZyMAnOeOvpTx+HjNuTla3QzybGVIQjCNNtN6s8t8O65qGh6lDf6ddS29xC25HRsEGvYhq/g34q2yx+IZLfw/4n2hV1BVxb3Z7eaP4W9/59K8HJ+bipoZXQ5UkGvEjK2h+hYHNJUI+zmuaD6M7Hx38O/EfhOfGo2LfZ2/1VzEd8Mg7FXHH4HB9q42SFlOGBFegeCPip4j8OW/2Dz0v9Mbh7K8XzYWHpg9Pwrqf7R+EPi0br/T73wtfP96Sz/e2+fXYeQPpiq5VLY7ngcJi/ew87PszxIpSba9nl+D+n6j8/hnxz4e1JD0SWfyJP++Wz/Os+f4G+O0P7rToLhT0aG7iYH/x6l7ORyzyPFR2jc8o2mlCGvVIvgf4+c/NpCxj1e5iA/wDQqux/Bm4s/m1/xP4d0lB97zL0O34KvX86PZS7ChkmKl9k8iSIk9K3/CvhLW/Ed+llpOnz3MrdQi8KPUnoB7mvRY7X4Q+FxvuL7UPFN2g4jhT7Pb592PzEfSsrxN8XdWubF9K8O2tr4e0sjb5FguxmH+0/U/pTUIrdnVHLsNhvexM16LU6K20vwb8LYvtWty23iDxMnMdhE263tm7GRv4iPT9O9eYeOfF+seLNYk1HVrpppG4VeiovZVHYCsK5uJZ3LuxYmqrE0pTvotjlxuae0j7KiuWHb/M2vCmi3viHXLbStPgee5uHCRoo5Jr6NvtX8O/AvSLfRtLsbHWPFM6q9/cyruSAf88x3/Uep6gD5y8GeIdR8M6/a6zpdw1vd2z745F7H+oxkY719PaR/wAIR8d7S2lu9mj+KbUDz1iAxcoPvMAfvcfivuvT2Mt5ORqPxH59nntPaxlVTdLrbv5mF8WdG0zx18NNP+IOhaKbPVpLgwXsNvGSrkAncAB2x19+ckZPlfg/4geMvAN4Tp95PAhI8y3lG6N/qp4/Hr71698TPizq3w91tPC3hLSo9L03TVEWy4twWn/2znseox16968k+K3xR1L4g2tjDqWn6dA9oWPm28O15N2PvEk5AxwPrW2LqQpycoytJfic+V0a1WChOmnTe13sjF+IfjPV/HXiSXWdWdTPLhVSMYRFAwFUdgK9I+GlvF8P/h7fePr5VXUbxGtNHRhzuP3pceg/p/tVxfwd8ESeLPEK/aG+z6Zar597cMcLHEOTz2Jwcfie1SfGrxnH4l11bXTF8jRtPT7PYQgYCxjjcR6tjP0wO1ePKpKT55bn6flWFp5ZhfbtWe0V+pwepXMl1dSTSMWZ2JJJyTVNqc7ZNR1zM8WrUc5NsKKKKRkFFFFABSqcUlFAE0blTkV7J8HPGWm3WlT+AfF77tDvz+7lY82kvZwT0GfyPsWz4upqeCVo3DKcEVUZWZ6WX46WFqcy1XVd0dh8UPBOp+C/EEtjdLvhb57edB8k0fZh/UdjxWP4LaA+J9PF7MIrc3MYkkboq7hkn8K9T+HvjPRvFXh1PAnjyQC1HGnai337R+gBJ/h6DnjHB4wV4T4k+BNZ8F6u1teRFoHy1vcxgmOZP7yn+Y6it4S5JKa2Rvm2VQr0nXw2sZfgdz+1l4j03W/iME0q9gu7S1tY4lkgkDxk8scEcHlqxNA+EmoeJvh9/wAJL4d1K11O7iLfa9Miz9ogUHg4/iz14/U5x5dIzk8kmt3wZ4u1vwpq0Wp6Lfy2lzEeGU9R3BHQg+h4roWJp1ardVaM+PeBrYfDxp0JWcfLcyZ7CeG7NtLGySKcFSMEGva/C/7Per674HtNbg1S0gv7xWkt7GfKNKg7hvU9cY6YOeawPBFlqfxX+LMc9/sM19ceddyRRBVVBy5wOBwPzr3b4xeENc8Z3Flc+Bda0+SHRYvs4soLkJJAynBPXGeAO3CjrXZhcHTcZTauuh5mY5nWhOFJS5Xu+q9D5Y8beDPEHhDUDZ63p09pJ1UuvyuPVT0I9xXOLIwPevqb4+y3Vh8EdC0TxfcRXXibz/MUtIHljjAYHJHrlRnvjvivHvgz8OJ/HniX7I7tbafCplu7nHEaD69z0H/1q5sTgbVlCn1O/A5x/srrVtLfj6HApdzJ0kYfjVuHWtRiGI7uZB/suRXa/Hb4fW3gPxaNNsLma5s5YEnhklADENnIOOOCDzVz4Y/BrWvG+hS6za32n2VpFL5Ja6lKZbAPHB9R+dYfU6vtHTW6PThn8adBV+dqLOAl13U5FxJe3DD3kJ/rVSS9mfkyNmvZ9b/Zz8VWulzXun32lao0KlmgtLjfIQPQEDP0614jeW8lvM0UgIZTgior4arR+NG1DO1jb8lS9vUR5WPUk01TuYCo6fEcMK5luXKbZ7l8OvhX4am8FWPinxnq95aW2p3Bt7KKzgEjkg4LMTwBnPHXiuf8V/CHWLPxh4g0LSDHqA0a3a7lkDBC0AAO4KTycMMqM969S/Z18QXWl/C7WdS8SJBc+GdNkV7eGWMMxuSQQEJ6dicg9cjvXY/Du88AeLfiCfE2ha1fxatdLL9u068XcJkZSH2t0wOuM9ugr6WOEoVKUVa35nw1TMsXQr1He6T+R8WTxtFIVPUVoaDrN9pF/De2NxLBPC4dHjYqykdCCK734y/CzxD4NdtVvLWM6XcTlILiGUOjHkgccg4Hcdq8wCnNeFVhPDVbH1mHq08bR5lqmerfFL4qnx/4Y0uz1LR7ZdXsyRLqKcNMmOF24wBnn0z0Aya4vwX4b1HxNrkGmabbtLLK2PZR3JPYDuab4O8M6p4l1eHTdLtXnmlOAB0A7knsB3Jr1vxJrWkfCjw/N4Y8M3Ed14kuU2anqUf/AC7+sUZ7H37f72AtVKsqz55nvZLktLD0/az0prX19Cn8UNe03wb4YHw68LzrKQd2r3idZ5e8Y/2Qeo9gOxz4pK5ZiSck1JdTvNIzuSSarMa55y5mPMcc8TO+yWyEJ5pKKKg8wKKKKACiiigAooooAKcpptFA0yzBK0bBlOCK9g+HfxLsbjRV8H+O7Y6noT/LE5/11oegZD1wPzHuPlPjANSRuVOQaqMmj0sDmFTCyvHZ7roz1H4lfCu50i0/4SDw9cLrPh6b5o7uDkxg9pAPuntnp9DxXl8kLI5DAg12/wAOviNr3g67LWNx5lrJxPay/NFKOhyv07jmvQrjQ/h38T4ftHh+5h8L+IHGWsJz/o0zf9MyPu/Qf98jrV8qlsenUwWHzBc+Gdpfy/5f19w39lvxb4V8NvqsGr3smm6lexiG1vvL3xwrznI6g52n0+XnFdZonwg8V2Xiu017wr4pstQ055w/263ucEDOTuUHn6AnNeE+MfA3iXwjeeRq+nTQZP7uQDKOPVWHB/Osi31vVrOJ4YLy4iRhhlWQgEe9erh8fGEVGa2Pz/M+HcTTrTlF2ct01f7j139o6Wy8RfF2Wz0ILcOfLgkMPzCSfGG24684HHUivXYfh/4l8J/CMeHvCWnpPrF+wOpz+aqsq45RckZ/u/8AfX96vmr4SeNrTwf4wi8Q6jpY1Qwo/lRtJsKuRhXBweRTdc+JPiXUvFVzr41S5t7qeQuTDKyBR2UYPAAwB7CuiljKUb1Huzyq+V4mSjQj8MV12bPXv2uNNn/szwlqV1GyXj2HkXKkcq67SQff5jV74WaVqWs/s06xpej27XN9NfjyolxubHlk4z6Cud+Jni/TPE/wC8OSXWrxXOv2926XETy7pyPm+Y98Y2cmtD4b+JF0f9mrXbix1VbPUotQXytk4SUbvL6DOeQG6ehroUo+3cr7r9ThlTqrBRhbVTsa/wAAvA3jPwd4tl17xOraTpNvbSG4knmUBhjgYz64P4euK+cviJd2l94t1O8sk2W011JJEuMYUsSB+Ve3fBj4onWrq78G+O9Qe80zVkMST3Um77PIejbm6An8jg+teKfEnR4tB8X6lpMN7DepaztGs8LBkkAPBBFcOOcZYdcjurnq5XCpHGz9srSsttrHMU5DhqTFOC14aPqLXPoH4L+JfCOr/DLUvh34r1P+yBPcC5tLwrlA+Bw35d+OTyOKvT614C+FXh7UofCetf8ACQeJL+Frb7WiFYrVG+8V9WI9M/pg/O0O9T8pIrZ0HQdZ169S002xuLuduiRoWP1PoPc8V60Mxagko6rqeSuHZYis+Vu0ndxXVkWp61qeowra3F3PJArFkiaQlVJ7gdBXR/Dj4c614vuy0EQt7GLm4vJvliiUcnJ7nHb88Dmu30/4feFvA8Caj8RdSR7oDdHo9m4aV/8AfI+6PxA9+1cx8RPilqWv2g0bS4ItH0KMYisLbhSB0LkY3H24HtnmuKpJyfNUd2fa4bK8Nl8FLEb/AMq/U6bxN430DwJo03hj4etvuZBsvdaxiSX1EZ7D3H4f3j4pdXDzSF3YsSc81HLIzkkkknqTURNYym5HJjswniXbZLZAxptFFQeY3cKKKKBBRRRQAUUUUAFFFFABRRRQAUoOKSigCRWqxb3MkLBkcqRVOlBouawqyg7pnrHgz4x6/pFp/ZuqrBrmlsAr2t+vmLj2J5H45FdA9r8HfGq74Li58Iag/wDA4822J/mB+I+leFKxqSOVlOVYitFUfU9ujnU3HkrpTXnues6z8DvE8cJu9CkstetCMrLYzqxI/wB04P5ZrgNY8K69pMpTUdLvLVgcYmhZP5imaP4k1jSZhLp+oXNq4/iilKH9K7vSfjj44tEEVxqCX8Q/gu4VkB/TP61V4M0ayuvrrB/ejzVoLlRgo+KT9+qbRvA9K9dHxh0u9+bWvAHhu9fu6QeUT+WaT/hP/hrNlrj4Z2oY/wDPK/dR/KmvUzeU4KXw1l9x5DGJlbK7gfanNDPIclGJ9xXrv/CefDCMZi+GkTN/t6g5H8qb/wALY8OWYzpXw48OwuOjToZiPzFFla3MCyrBxd3WX3Hl+naDqd/KIrOynnc9FjjLH8hXc6B8F/GeoRie508abbYy019IIVUeuDz+lXb/AOOfjB4TBpz2OlxHjbZ2iJx9TmuH1/xj4h1ty+qateXee0szMB9B0FL3F5lqOW0erk/uR6Wvhb4XeElEniDxI+v3adbTTB8mfQyf4EVQ174x3VtZNpfgzS7Tw3Y425tlBmYerSY6+45968lknd+WYmomYml7RrbQirnDjHloRUV5blzUdRur6d57meSWR2LMzsSSfUk9apM2aaTTazueLUrSqO8ncUmkoopGIUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABSg0lFADg1Lu96ZRQNSZJvNLvqKjNBXOyXeaTefWo6KA52SFvemlqbRQTzMXNJRRQIKKKKACiiigAooooAKKKKACiiigD/9k=";
var _appIdentityCache = {
  logoUrl: _AMBI241_DEFAULT_LOGO,
  splashLogoUrl: _AMBI241_DEFAULT_LOGO,
  appName: "AMBI241"
};

/** Charge l'identité de l'app depuis Firestore */
function loadAppIdentity() {
  if (!window.db || typeof window.fbGetDoc !== "function") return;
  window.fbGetDoc(window.fbDoc(window.db, "config", "app_identity"))
    .then(function(doc) {
      if (doc && doc.exists && doc.exists()) {
        var data = doc.data() || {};
        /* Garder le logo par défaut si Firestore n'en a pas */
        if (!data.logoUrl) data.logoUrl = _AMBI241_DEFAULT_LOGO;
        if (!data.splashLogoUrl) data.splashLogoUrl = _AMBI241_DEFAULT_LOGO;
        _appIdentityCache = data;
        _applyAppIdentity();
      } else {
        /* Aucun doc Firestore → appliquer le logo par défaut */
        _applyAppIdentity();
      }
    }).catch(function(){ _applyAppIdentity(); });
}

/** Applique logo + nom partout dans l'app */
function _applyAppIdentity() {
  var logo = _appIdentityCache.logoUrl || "";
  var splashLogo = _appIdentityCache.splashLogoUrl || logo;
  var appName = _appIdentityCache.appName || "AMBI241";

  /* ── Logo header principal ── */
  var headerImgs = document.querySelectorAll(".logo-img, #appLogoImg, [data-app-logo]");
  headerImgs.forEach(function(el) {
    if (logo) { el.src = logo; el.style.display = "block"; }
  });

  /* ── Logo écran de démarrage (splash) ── */
  var splashEl = document.getElementById("splashLogo");
  if (splashEl && splashLogo) splashEl.src = splashLogo;

  /* ── Nom de l'app dans le titre ── */
  if (appName && document.title.indexOf(appName) === -1) {
    document.title = appName + " - Ambiance Libreville en Direct";
  }

  /* ── Favicon dynamique ── */
  if (logo) {
    var favicon = document.querySelector("link[rel='icon'], link[rel='shortcut icon']");
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon"; favicon.type = "image/png";
      document.head.appendChild(favicon);
    }
    favicon.href = logo;
  }

  /* ── Apple touch icon ── */
  if (logo) {
    var appleIcon = document.querySelector("link[rel='apple-touch-icon']");
    if (appleIcon) appleIcon.href = logo;
  }
}

/** Sauvegarde l'identité dans Firestore */
function saveAppIdentity(fields) {
  if (!window.db || typeof window.fbSetDoc !== "function") {
    showToast("❌ Firebase non disponible");
    return Promise.reject();
  }
  Object.assign(_appIdentityCache, fields);
  return window.fbSetDoc(
    window.fbDoc(window.db, "config", "app_identity"),
    _appIdentityCache,
    { merge: true }
  ).then(function() {
    _applyAppIdentity();
    showToast("✅ Identité de l'app mise à jour !");
  }).catch(function(err) {
    showToast("❌ Erreur : " + (err.message || err));
  });
}

/** Compresse une image en base64 pour eviter les limites Firestore */
function _compressImageToBase64(dataUrl, maxPx, quality, callback) {
  var img = new Image();
  img.onload = function() {
    var w = img.width, h = img.height;
    var scale = Math.min(1, maxPx / Math.max(w, h, 1));
    var nw = Math.round(w * scale), nh = Math.round(h * scale);
    var canvas = document.createElement("canvas");
    canvas.width = nw; canvas.height = nh;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, nw, nh);
    callback(canvas.toDataURL("image/jpeg", quality));
  };
  img.onerror = function() { callback(dataUrl); };
  img.src = dataUrl;
}

/** Upload logo vers Supabase ou base64 compresse local */
function _uploadAppLogo(file, slot) {
  if (!file) return;
  var maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) { showToast("❌ Image trop lourde (max 5 Mo)"); return; }

  showToast("⏳ Traitement du logo...");

  var reader = new FileReader();
  reader.onload = function(ev) {
    var rawDataUrl = ev.target.result;

    /* Apercu immediat */
    var previewId = slot === "splash" ? "admLogoSplashPreview" : "admLogoMainPreview";
    var previewEl = document.getElementById(previewId);
    if (previewEl) { previewEl.src = rawDataUrl; previewEl.style.display = "block"; }

    /* Essayer Supabase si disponible */
    if (window.supabase && typeof window.supabase.storage !== "undefined") {
      var path = "app-identity/" + slot + "-" + Date.now() + ".png";
      window.supabase.storage.from("ambi241").upload(path, file, { upsert: true })
        .then(function(res) {
          if (res.error) throw res.error;
          var publicUrl = window.supabase.storage.from("ambi241").getPublicUrl(path).data.publicUrl;
          var fields = {};
          fields[slot === "splash" ? "splashLogoUrl" : "logoUrl"] = publicUrl;
          saveAppIdentity(fields);
        })
        .catch(function() {
          /* Fallback : compresser en base64 avant Firestore */
          _compressImageToBase64(rawDataUrl, 256, 0.75, function(compressed) {
            var fields = {};
            fields[slot === "splash" ? "splashLogoUrl" : "logoUrl"] = compressed;
            saveAppIdentity(fields);
          });
        });
    } else {
      /* Compresser avant stockage Firestore (evite erreur "value too long") */
      _compressImageToBase64(rawDataUrl, 256, 0.75, function(compressed) {
        var fields = {};
        fields[slot === "splash" ? "splashLogoUrl" : "logoUrl"] = compressed;
        saveAppIdentity(fields);
      });
    }
  };
  reader.readAsDataURL(file);
}

/** Génère le HTML du panneau logo admin */
function renderAdmLogoPanel() {
  var logoUrl = _appIdentityCache.logoUrl || "";
  var splashUrl = _appIdentityCache.splashLogoUrl || logoUrl;
  var appName = _appIdentityCache.appName || "AMBI241";

  var h = "";
  h += "<div style='background:linear-gradient(135deg,rgba(157,132,255,0.08),rgba(0,229,255,0.04));border:1px solid rgba(157,132,255,0.3);border-radius:14px;padding:1rem;margin-bottom:1rem;'>";
  h += "<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.35rem;'><span style='font-size:1.1rem;'>🎨</span><span style='font-family:Syne,sans-serif;font-weight:800;color:#9D84FF;font-size:0.92rem;'>Logo & Identité de l'application</span></div>";
  h += "<div style='font-size:0.72rem;color:var(--muted);margin-bottom:1rem;line-height:1.55;'>Le logo s'affiche dans le header, à l'écran de démarrage, et comme favicon. La mise à jour est instantanée pour tous les utilisateurs.</div>";

  /* ── Nom de l'app ── */
  h += "<div style='margin-bottom:1rem;'>";
  h += "<label style='font-size:0.72rem;color:var(--muted);display:block;margin-bottom:0.3rem;font-weight:700;'>📝 Nom de l'application</label>";
  h += "<div style='display:flex;gap:0.5rem;'>";
  h += "<input id='admAppNameInput' type='text' value='" + escHtml(appName) + "' placeholder='AMBI241' style='flex:1;background:var(--surface2);border:1px solid rgba(157,132,255,0.25);border-radius:8px;color:var(--text);padding:0.5rem 0.7rem;font-size:0.82rem;'>";
  h += "<button onclick='saveAppIdentity({appName:document.getElementById(\"admAppNameInput\").value})' style='padding:0.5rem 0.9rem;border-radius:8px;border:none;background:linear-gradient(135deg,#9D84FF,var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;white-space:nowrap;'>Sauver</button>";
  h += "</div></div>";

  /* ── Grid logo principal + splash ── */
  h += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:1rem;'>";

  /* Logo principal */
  h += "<div style='background:rgba(0,0,0,0.2);border:1.5px dashed rgba(157,132,255,0.3);border-radius:12px;padding:0.8rem;text-align:center;'>";
  h += "<div style='font-size:0.7rem;color:#9D84FF;font-weight:800;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.06em;'>🏷️ Logo principal</div>";
  h += "<div style='font-size:0.62rem;color:var(--muted);margin-bottom:0.6rem;'>Header + Favicon</div>";
  if (logoUrl) {
    h += "<img id='admLogoMainPreview' src='" + escHtml(logoUrl) + "' style='width:64px;height:64px;object-fit:contain;border-radius:12px;margin-bottom:0.5rem;display:block;margin-left:auto;margin-right:auto;border:1.5px solid rgba(157,132,255,0.25);'>";
  } else {
    h += "<img id='admLogoMainPreview' style='width:64px;height:64px;display:none;object-fit:contain;border-radius:12px;margin-bottom:0.5rem;margin-left:auto;margin-right:auto;'>";
    h += "<div style='font-size:1.8rem;margin-bottom:0.5rem;'>🖼️</div>";
  }
  h += "<label style='display:block;padding:0.45rem 0.6rem;border-radius:8px;border:1px solid rgba(157,132,255,0.4);background:rgba(157,132,255,0.08);color:#9D84FF;font-size:0.72rem;font-weight:700;cursor:pointer;'>";
  h += "📂 Choisir<input type='file' accept='image/*' style='display:none;' onchange='_uploadAppLogo(this.files[0],\"main\")'>";
  h += "</label></div>";

  /* Logo splash */
  h += "<div style='background:rgba(0,0,0,0.2);border:1.5px dashed rgba(0,229,255,0.3);border-radius:12px;padding:0.8rem;text-align:center;'>";
  h += "<div style='font-size:0.7rem;color:var(--cyan);font-weight:800;margin-bottom:0.5rem;text-transform:uppercase;letter-spacing:0.06em;'>🚀 Écran démarrage</div>";
  h += "<div style='font-size:0.62rem;color:var(--muted);margin-bottom:0.6rem;'>Splash screen PWA</div>";
  if (splashUrl) {
    h += "<img id='admLogoSplashPreview' src='" + escHtml(splashUrl) + "' style='width:64px;height:64px;object-fit:contain;border-radius:12px;margin-bottom:0.5rem;display:block;margin-left:auto;margin-right:auto;border:1.5px solid rgba(0,229,255,0.25);'>";
  } else {
    h += "<img id='admLogoSplashPreview' style='width:64px;height:64px;display:none;object-fit:contain;border-radius:12px;margin-bottom:0.5rem;margin-left:auto;margin-right:auto;'>";
    h += "<div style='font-size:1.8rem;margin-bottom:0.5rem;'>✨</div>";
  }
  h += "<label style='display:block;padding:0.45rem 0.6rem;border-radius:8px;border:1px solid rgba(0,229,255,0.35);background:rgba(0,229,255,0.06);color:var(--cyan);font-size:0.72rem;font-weight:700;cursor:pointer;'>";
  h += "📂 Choisir<input type='file' accept='image/*' style='display:none;' onchange='_uploadAppLogo(this.files[0],\"splash\")'>";
  h += "</label></div>";

  h += "</div>"; /* fin grid */

  /* ── Bouton appliquer partout ── */
  h += "<button onclick='saveAppIdentity(_appIdentityCache).then(function(){_applyAppIdentity();showToast(\"✅ Logo appliqué et sauvegardé partout !\");}).catch(function(){_applyAppIdentity();showToast(\"⚠️ Appliqué localement (erreur Firestore)\");});' style='width:100%;padding:0.6rem;border-radius:10px;border:none;background:linear-gradient(135deg,#9D84FF,var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;margin-bottom:0.5rem;'>🔄 Appliquer partout maintenant</button>";

  /* ── Supprimer logo ── */
  h += "<button onclick='if(confirm(\"Supprimer le logo personnalisé ?\"))saveAppIdentity({logoUrl:\"\",splashLogoUrl:\"\"})' style='width:100%;padding:0.45rem;border-radius:8px;border:1px solid rgba(255,68,102,0.3);background:rgba(255,68,102,0.06);color:var(--red);font-family:Syne,sans-serif;font-weight:700;font-size:0.75rem;cursor:pointer;'>🗑️ Supprimer le logo personnalisé</button>";

  h += "</div>";
  return h;
}

/** Init du panneau logo après injection HTML */
function initAdmLogoPanel() {
  /* Rien de spécial à initialiser — les inputs file sont inline */
}

/** Charge l'identité au démarrage de Firebase */
/* Appliquer le logo par défaut immédiatement sans attendre Firestore */
document.addEventListener('DOMContentLoaded', function(){ _applyAppIdentity(); });

(function _bootAppIdentity() {
  var _tries = 0;
  var _wait = setInterval(function() {
    _tries++;
    if (window.db && typeof window.fbGetDoc === "function") {
      clearInterval(_wait);
      loadAppIdentity();
    }
    if (_tries > 20) clearInterval(_wait);
  }, 500);
})();

// ══════════════════════════════════════════════════════════════
// ══  PANNEAU RESET TOTAL — NOUVEAU CYCLE                      ══
// ══════════════════════════════════════════════════════════════
function renderAdmResetPanel(){
  var cycleTs = parseInt(localStorage.getItem("ambi241_cycle_start")||"0");
  var cycleInfo = cycleTs > 0
    ? "Cycle actif depuis le " + new Date(cycleTs).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"})
      + " \u00e0 " + new Date(cycleTs).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"})
    : "Aucun cycle enregistr\u00e9";
  var html = "<div style='background:linear-gradient(135deg,rgba(255,68,102,0.08),rgba(204,68,255,0.05));border:2px solid rgba(255,68,102,0.4);border-radius:16px;padding:1.15rem;margin-bottom:1rem;position:relative;overflow:hidden;'>";
  html += "<div style='position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,var(--red),var(--purple),var(--red));'></div>";
  html += "<div style='display:flex;align-items:center;gap:0.5rem;margin-bottom:0.4rem;'>";
  html += "<span style='font-size:1.2rem;'>\uD83D\uDD04</span>";
  html += "<span style='font-family:Syne,sans-serif;font-weight:800;color:var(--red);font-size:0.9rem;'>R\u00e9initialisation \u2014 Nouveau cycle</span>";
  html += "</div>";
  html += "<div style='font-size:0.68rem;color:rgba(255,255,255,0.3);margin-bottom:0.9rem;'>\uD83D\uDCC5 "+cycleInfo+"</div>";
  return html + renderAdmResetButtons() + "</div>";
}
function renderAdmResetButtons(){
  var types=[
    {fn:"resetDataMembres",    l:"\uD83D\uDC64 Membres simples",         d:"Scores, activit\u00e9, pr\u00e9sences membres"},
    {fn:"resetDataChauffeurs", l:"\uD83D\uDE95 Chauffeurs Taxi Pro",      d:"Courses, notes, classement chauffeurs"},
    {fn:"resetDataGerants",    l:"\uD83C\uDFD9 G\u00e9rants \u00e9tablissements",d:"Scores affluence, votes, pr\u00e9sences"},
    {fn:"resetCycleClassement",l:"\uD83C\uDFC6 Classement \u00e9tablissements",d:"Pr\u00e9sences + votes lieux"}
  ];
  var h="<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.85rem;'>";
  types.forEach(function(r){
    h+="<button onclick='"+r.fn+"()' style='padding:0.6rem 0.5rem;border-radius:10px;border:1.5px solid rgba(255,68,102,0.35);background:rgba(255,68,102,0.05);color:var(--text);font-size:0.68rem;font-weight:700;cursor:pointer;text-align:left;line-height:1.4;font-family:DM Sans,sans-serif;'>";
    h+="<div style='font-size:0.72rem;font-weight:800;margin-bottom:0.2rem;'>"+r.l+"</div>";
    h+="<div style='font-size:0.6rem;color:var(--muted);font-weight:400;'>"+r.d+"</div></button>";
  });
  h+="</div>";
  h+="<button onclick='resetAllDataComplet()' style='width:100%;padding:0.75rem;border-radius:10px;border:none;background:linear-gradient(135deg,#cc1133,var(--red));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;cursor:pointer;box-shadow:0 4px 18px rgba(255,68,102,0.3);'>\uD83D\uDDD1\uFE0F Reset TOTAL \u2014 Nouveau cycle complet</button>";
  return h;
}
window.renderAdmResetPanel=renderAdmResetPanel;
function setAppMode(mode){ try{localStorage.setItem("ambi241_app_mode",mode);}catch(e){} var l={live:"\uD83D\uDFE2 Mode Live activ\u00e9",prelancement:"\uD83D\uDD35 Mode Pr\u00e9-lancement activ\u00e9",maintenance:"\uD83D\uDD34 Maintenance activ\u00e9e"}; showToast(l[mode]||"Mode mis \u00e0 jour"); }
window.setAppMode=setAppMode;
function toggleFeature(key,val){ try{localStorage.setItem(key,val?"1":"0");}catch(e){} showToast((val?"\u2705 ":"\uD83D\uDD15 ")+key.replace("feat_","").replace(/_/g," ")+(val?" activ\u00e9":" d\u00e9sactiv\u00e9")); }
window.toggleFeature=toggleFeature;
function resetDataMembres(){ if(!confirm("R\u00e9initialiser les donn\u00e9es des membres simples ?")) return; var keys=[]; for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k)continue;if(k.indexOf("ambi241_lastpres_")===0||k.indexOf("ambi241_vcd_")===0||k.indexOf("ambi241_membre_score_")===0||k.indexOf("ambi241_membre_activity_")===0)keys.push(k);} keys.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});showToast("\u2705 Membres simples r\u00e9initialis\u00e9s ("+keys.length+" cl\u00e9s)"); }
window.resetDataMembres=resetDataMembres;
function resetDataChauffeurs(){ if(!confirm("R\u00e9initialiser les donn\u00e9es des chauffeurs Taxi Pro ?")) return; var keys=[]; for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k)continue;if(k.indexOf("ambi241_driver_")===0||k.indexOf("ambi241_taxi_cycle_")===0)keys.push(k);} keys.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});if(window.db&&window.fbCollection&&window.fbGetDocs&&window.fbDeleteDoc){try{window.fbGetDocs(window.fbCollection(window.db,"taxi_scores")).then(function(s){s.forEach(function(d){window.fbDeleteDoc(d.ref).catch(function(){});});}).catch(function(){});}catch(e){}}showToast("\u2705 Chauffeurs r\u00e9initialis\u00e9s"); }
window.resetDataChauffeurs=resetDataChauffeurs;
function resetDataGerants(){
  if(!confirm("R\u00e9initialiser les donn\u00e9es des g\u00e9rants ?")) return;
  // Mémoire locale
  if(typeof etablissements!=="undefined"&&etablissements){
    etablissements.forEach(function(e){
      e.affluence=0;
      e.avis=0;
      e._adminOverride=false;
      if(e._voteData)e._voteData={pos:0,neg:0};
    });
  }
  // localStorage
  var keys=[];
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k)continue;if(k.indexOf("ambi241_gerant_")===0||k.indexOf("ambi241_etab_aff_")===0)keys.push(k);}
  keys.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
  // ★ CORRECTION : persister dans Firebase
  if(window.db&&window.fbUpdateDoc&&window.fbDoc&&typeof etablissements!=="undefined"){
    etablissements.forEach(function(etab){
      if(etab._docId){
        try{
          window.fbUpdateDoc(
            window.fbDoc(window.db,"etablissements",etab._docId),
            {affluence:0,avis:0,_adminOverride:false}
          ).catch(function(){});
        }catch(e){}
      }
    });
  }
  if(typeof renderAll==="function")setTimeout(renderAll,300);
  showToast("\u2705 G\u00e9rants r\u00e9initialis\u00e9s");
}
window.resetDataGerants=resetDataGerants;
function resetAllDataComplet(){
  if(!confirm("\u26A0\uFE0F RESET TOTAL\n\nCette action r\u00e9initialise :\n\u2022 Classement \u00e9tablissements\n\u2022 Membres simples\n\u2022 Chauffeurs Taxi Pro\n\u2022 G\u00e9rants\u2019 scores\n\nProfils et photos resteront intacts.\n\nConfirmer ?")) return;
  // 1. localStorage
  try{localStorage.removeItem("ambi241_all_presence");localStorage.removeItem("ambi241_all_votes");}catch(e){}
  var del=[];
  for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);if(!k)continue;if(k.indexOf("ambi241_lastpres_")===0||k.indexOf("ambi241_vcd_")===0||k.indexOf("ambi241_anon_presence_")===0||k.indexOf("ambi241_membre_score_")===0||k.indexOf("ambi241_membre_activity_")===0||k.indexOf("ambi241_driver_")===0||k.indexOf("ambi241_taxi_cycle_")===0||k.indexOf("ambi241_gerant_")===0||k.indexOf("ambi241_etab_aff_")===0)del.push(k);}
  del.forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
  // 2. sessionStorage
  var ss=[];
  for(var j=0;j<sessionStorage.length;j++){var sk=sessionStorage.key(j);if(sk&&sk.indexOf("ambi241_anon_")===0)ss.push(sk);}
  ss.forEach(function(k){try{sessionStorage.removeItem(k);}catch(e){}});
  // 3. Reset mémoire locale
  if(typeof etablissements!=="undefined"&&etablissements){
    etablissements.forEach(function(e){
      e.affluence=0;
      e.avis=0;
      e._adminOverride=false;
      e.statut="Fermé";
      if(e._voteData)e._voteData={pos:0,neg:0};
    });
  }
  // 4. Firebase : collections globales + sous-collections par étab + ★ doc principal
  if(window.db&&window.fbCollection&&window.fbGetDocs&&window.fbDeleteDoc){
    ["presences","votes","taxi_scores","votes_communautaires","affluence_signalements"].forEach(function(col){
      try{window.fbGetDocs(window.fbCollection(window.db,col)).then(function(s){s.forEach(function(d){window.fbDeleteDoc(d.ref).catch(function(){});});}).catch(function(){});}catch(e){}
    });
    // ★ CORRECTION PRINCIPALE : persister affluence=0/avis=0 dans chaque doc Firestore
    if(typeof etablissements!=="undefined"&&window.fbUpdateDoc&&window.fbDoc){
      etablissements.forEach(function(etab){
        var eidStr=String(etab.id);
        // Sous-collections presences / votes / ratings
        ["presences","votes","ratings"].forEach(function(sub){
          try{
            window.fbGetDocs(window.fbCollection(window.db,"etablissements",eidStr,sub))
              .then(function(s){s.forEach(function(d){window.fbDeleteDoc(d.ref).catch(function(){});});})
              .catch(function(){});
          }catch(e){}
        });
        // Mise à zéro dans le document principal etablissements/{docId}
        if(etab._docId){
          try{
            window.fbUpdateDoc(
              window.fbDoc(window.db,"etablissements",etab._docId),
              {affluence:0,avis:0,_adminOverride:false}
            ).catch(function(){});
          }catch(e){}
        }
      });
    }
  }
  // 5. Cycle + tri
  var now=Date.now();
  try{localStorage.setItem("ambi241_cycle_start",String(now));localStorage.setItem("ambi241_cycle_reset_count",String(parseInt(localStorage.getItem("ambi241_cycle_reset_count")||"0")+1));}catch(e){}
  if(typeof _rankSort!=="undefined")_rankSort={col:"score",asc:false};
  showToast("\u2705 Reset total \u2014 nouveau cycle d\u00e9marr\u00e9 !");
  setTimeout(function(){if(typeof renderAll==="function")renderAll();if(typeof renderAdmClassement==="function")renderAdmClassement();renderAdmSettings();},400);
}
window.resetAllDataComplet=resetAllDataComplet;

function changeAdminPin(){
  var inp=document.getElementById("newPinInput");
  if(!inp)return;
  var val=(inp.value||"").trim();
  if(!/^\d{4}$/.test(val)){showToast("Le PIN doit être 4 chiffres");return;}
  hashPin(val).then(function(h){
    savePinHash(h);
    inp.value="";
    showToast("✅ PIN Admin changé et sécurisé !");
  });
}
window.changeAdminPin=changeAdminPin;

// ══════════════════════════════════════════════════════════════
// ══  PHOTOS PAR DÉFAUT ADMIN — 6 cadres pour établissements  ══
// ══════════════════════════════════════════════════════════════

// Clé Firebase de stockage des photos par défaut admin
var ADMIN_DEFAULT_PHOTOS_DOC = "config/default_photos";

// Descripteurs des slots — alignés sur les 6 catégories principales de l'app
var ADMIN_PHOTO_SLOTS = [
  { key:"bar",         label:"Bars",                 icon:"🍺", hint:"Photo profil par défaut des bars" },
  { key:"bar_terrasse",label:"Bar Terrasses",        icon:"🌴", hint:"Photo profil par défaut des bars terrasses" },
  { key:"snack",       label:"Snacks",               icon:"🍾", hint:"Photo profil par défaut des snacks" },
  { key:"restaurant",  label:"Restos & Pâtisseries", icon:"<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 56 40\" width=\"1.1em\" height=\"0.8em\" style=\"display:inline-block;vertical-align:middle;flex-shrink:0;\"><line x1=\"10\" y1=\"4\" x2=\"10\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/><line x1=\"7\" y1=\"4\" x2=\"7\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><line x1=\"13\" y1=\"4\" x2=\"13\" y2=\"16\" stroke=\"white\" stroke-width=\"1.6\" stroke-linecap=\"round\"/><path d=\"M7 16 Q10 20 13 16\" fill=\"none\" stroke=\"white\" stroke-width=\"1.6\"/><circle cx=\"28\" cy=\"22\" r=\"14\" fill=\"none\" stroke=\"white\" stroke-width=\"2.2\"/><circle cx=\"28\" cy=\"22\" r=\"9\" fill=\"rgba(255,255,255,0.12)\" stroke=\"white\" stroke-width=\"1.2\"/><circle cx=\"28\" cy=\"22\" r=\"3.5\" fill=\"white\" opacity=\"0.7\"/><ellipse cx=\"46\" cy=\"10\" rx=\"3.5\" ry=\"5\" fill=\"none\" stroke=\"white\" stroke-width=\"2\"/><line x1=\"46\" y1=\"15\" x2=\"46\" y2=\"36\" stroke=\"white\" stroke-width=\"2.2\" stroke-linecap=\"round\"/></svg>", hint:"Photo profil par défaut des restos & pâtisseries" },
  { key:"patisserie",   label:"Pâtisseries",           icon:"🍰", hint:"Photo profil par défaut des pâtisseries" },
  { key:"boite_nuit",  label:"Boîtes de Nuit",       icon:"🎵", hint:"Photo profil par défaut des boîtes de nuit & clubs" },
  { key:"driver",      label:"Chauffeur (Taxi Pro)", icon:"🚕", hint:"Avatar par défaut pour les chauffeurs Taxi Pro" },
  { key:"company",     label:"Entreprise (Taxi Pro)",icon:"🏢", hint:"Logo/avatar par défaut pour les entreprises Taxi Pro" },
  { key:"generic",     label:"Autres établissements",icon:"📍", hint:"Photo de fallback générique (tous les autres lieux)" }
];

// Cache local des photos par défaut admin (initialisé au chargement)
var _adminDefaultPhotos = {};

/** Charge les photos par défaut admin depuis Firebase */
function loadAdminDefaultPhotos(cb){
  if(!window.db || !window.fbGetDoc || !window.fbDoc){
    if(cb) cb({});
    return;
  }
  window.fbGetDoc(window.fbDoc(window.db, "config", "default_photos"))
    .then(function(snap){
      _adminDefaultPhotos = snap.exists() ? (snap.data() || {}) : {};
      if(cb) cb(_adminDefaultPhotos);
    })
    .catch(function(){ if(cb) cb({}); });
}

/** Retourne la photo par défaut admin pour une clé donnée */
function getAdminDefaultPhoto(key){
  return _adminDefaultPhotos[key] || null;
}

/** Retourne la photo par défaut admin la plus adaptée à un établissement */
function getAdminDefaultPhotoForEtab(etab){
  if(!etab) return null;
  var type = (etab.type||"").toLowerCase();
  var key = "generic";
  // Mapper selon les 6 catégories principales — même ordre que getCategory()
  if(/bar.*terrasse|terrasse|rooftop/i.test(type)) key = "bar_terrasse";
  else if(/club|discothèque|discotheque|boîte|boite|night/i.test(type)) key = "boite_nuit";
  else if(/snack/i.test(type)) key = "snack";
  else if(/pâtisserie|patisserie/i.test(type)) key = "patisserie";
  else if(/restaurant|resto|brasserie|pizzeria|bistro|café|cafe|maquis/i.test(type)) key = "restaurant";
  else if(/bar|lounge|pub|taverne/i.test(type)) key = "bar";
  else if(/salle|cérémonie|ceremonie/i.test(type)) key = "salle";
  else if(/stade|football|foot/i.test(type)) key = "stade";
  else if(/tourisme|touristique|site/i.test(type)) key = "tourisme";
  return getAdminDefaultPhoto(key) || getAdminDefaultPhoto("generic") || null;
}

/** Retourne la photo par défaut admin pour un chauffeur Taxi Pro */
function getAdminDefaultPhotoForDriver(){
  return getAdminDefaultPhoto("driver") || getAdminDefaultPhoto("generic") || null;
}

/** Retourne la photo par défaut admin pour une entreprise Taxi Pro */
function getAdminDefaultPhotoForCompany(){
  return getAdminDefaultPhoto("company") || getAdminDefaultPhoto("generic") || null;
}

/** Sauvegarde une photo par défaut dans Firebase */
function saveAdminDefaultPhoto(key, dataUrl, callback){
  if(!window.db || !window.fbSetDoc || !window.fbDoc){
    showToast("❌ Firebase non disponible");
    if(callback) callback(false);
    return;
  }
  var update = {};
  update[key] = dataUrl;
  update["_updated"] = Date.now();
  _adminDefaultPhotos[key] = dataUrl;
  window.fbSetDoc(window.fbDoc(window.db,"config","default_photos"), _adminDefaultPhotos, {merge:true})
    .then(function(){
      showToast("✅ Photo par défaut enregistrée !");
      if(callback) callback(true);
    })
    .catch(function(e){
      showToast("❌ Erreur sauvegarde: " + (e.message||""));
      if(callback) callback(false);
    });
}

/** Supprime une photo par défaut */
function deleteAdminDefaultPhoto(key){
  if(!window.db || !window.fbSetDoc || !window.fbDoc){ showToast("❌ Firebase non disponible"); return; }
  delete _adminDefaultPhotos[key];
  _adminDefaultPhotos["_updated"] = Date.now();
  window.fbSetDoc(window.fbDoc(window.db,"config","default_photos"), _adminDefaultPhotos, {merge:false})
    .then(function(){
      showToast("🗑️ Photo par défaut supprimée");
      renderAdmSettings();
    })
    .catch(function(e){ showToast("❌ Erreur: " + (e.message||"")); });
}
window.deleteAdminDefaultPhoto = deleteAdminDefaultPhoto;

/** Génère le HTML de la section photos par défaut */
function renderAdminDefaultPhotosSection(){
  var html = "<div style='background:linear-gradient(135deg,rgba(157,132,255,0.08),rgba(0,229,255,0.05));border:1.5px solid rgba(157,132,255,0.35);border-radius:16px;padding:1.1rem;margin-top:1.2rem;'>";
  html += "<div style='display:flex;align-items:center;gap:0.55rem;margin-bottom:0.5rem;'>";
  html += "<span style='font-size:1.3rem;'>🖼️</span>";
  html += "<div style='font-family:Syne,sans-serif;font-weight:800;color:#9D84FF;font-size:0.92rem;'>Photos de profil par défaut</div>";
  html += "</div>";
  html += "<div style='font-size:0.73rem;color:var(--muted);margin-bottom:1.1rem;line-height:1.55;'>Ces photos s'affichent pour tout établissement, chauffeur ou entreprise qui n'a pas encore uploadé sa propre photo. Dès que l'établissement upload la sienne, elle remplace automatiquement la photo par défaut.</div>";
  html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;'>";

  ADMIN_PHOTO_SLOTS.forEach(function(slot){
    var existing = _adminDefaultPhotos[slot.key] || null;
    html += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(157,132,255,0.2);border-radius:12px;padding:0.75rem;'>";
    html += "<div style='font-size:1.1rem;text-align:center;margin-bottom:0.3rem;'>"+slot.icon+"</div>";
    html += "<div style='font-family:Syne,sans-serif;font-weight:700;font-size:0.72rem;color:#9D84FF;text-align:center;margin-bottom:0.4rem;'>"+slot.label+"</div>";

    // Aperçu photo
    if(existing){
      html += "<div style='position:relative;margin-bottom:0.5rem;'>";
      html += "<img id='adm-defphoto-preview-"+slot.key+"' src='"+existing+"' alt='default' style='width:100%;height:70px;object-fit:cover;border-radius:8px;border:2px solid rgba(157,132,255,0.45);'>";
      html += "<button onclick=\"deleteAdminDefaultPhoto('"+slot.key+"')\" title='Supprimer' style='position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:rgba(255,68,102,0.85);border:none;color:#fff;font-size:0.65rem;cursor:pointer;display:flex;align-items:center;justify-content:center;'>✕</button>";
      html += "</div>";
    } else {
      html += "<div id='adm-defphoto-preview-"+slot.key+"' style='width:100%;height:70px;border-radius:8px;background:rgba(157,132,255,0.07);border:2px dashed rgba(157,132,255,0.25);display:flex;align-items:center;justify-content:center;margin-bottom:0.5rem;'><span style='font-size:1.8rem;opacity:0.35;'>👤</span></div>";
    }

    // Bouton choisir (input file caché)
    html += "<label style='display:block;width:100%;padding:0.38rem 0.4rem;border-radius:8px;background:rgba(157,132,255,0.12);border:1px solid rgba(157,132,255,0.35);color:#9D84FF;font-family:DM Sans,sans-serif;font-size:0.68rem;font-weight:700;cursor:pointer;text-align:center;' title='"+slot.hint+"'>";
    html += (existing ? "🔄 Changer" : "📁 Choisir depuis galerie");
    html += "<input type='file' accept='image/*' style='display:none;' onchange=\"adminDefaultPhotoSelected(this,'"+slot.key+"')\">";
    html += "</label>";
    html += "</div>";
  });

  html += "</div>"; // grid
  html += "</div>"; // card
  return html;
}

/** Gère la sélection d'une photo depuis la galerie pour un slot par défaut */
function adminDefaultPhotoSelected(input, key){
  var file = input.files && input.files[0];
  if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){
    var dataUrl = ev.target.result;
    // Redimensionner si nécessaire avant de sauvegarder
    var img = new Image();
    img.onload = function(){
      var canvas = document.createElement("canvas");
      var MAX = 400;
      var w = img.width, h = img.height;
      if(w > MAX || h > MAX){
        if(w > h){ h = Math.round(h * MAX/w); w = MAX; }
        else { w = Math.round(w * MAX/h); h = MAX; }
      }
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      var compressed = canvas.toDataURL("image/jpeg", 0.82);
      saveAdminDefaultPhoto(key, compressed, function(ok){
        if(ok){
          // Mettre à jour l'aperçu inline sans re-rendre tout
          var previewEl = document.getElementById("adm-defphoto-preview-"+key);
          if(previewEl){
            if(previewEl.tagName === "IMG"){
              previewEl.src = compressed;
            } else {
              // Remplacer le placeholder div par un img
              var imgEl = document.createElement("img");
              imgEl.id = "adm-defphoto-preview-"+key;
              imgEl.src = compressed;
              imgEl.alt = "default";
              imgEl.style.cssText = "width:100%;height:70px;object-fit:cover;border-radius:8px;border:2px solid rgba(157,132,255,0.45);";
              previewEl.parentNode.replaceChild(imgEl, previewEl);
            }
          }
          // Re-rendre la section pour mettre à jour le bouton Changer vs Choisir
          setTimeout(function(){ renderAdmSettings(); }, 400);
        }
      });
    };
    img.src = dataUrl;
  };
  reader.readAsDataURL(file);
}
window.adminDefaultPhotoSelected = adminDefaultPhotoSelected;

/** Init aperçus photos par défaut après injection HTML (au cas où) */
function initAdminDefaultPhotosPreviews(){
  // Rien de spécial, les aperçus sont déjà dans le HTML injecté
}

// Patch de generateFallbackPhoto : si un établissement n'a pas de photo réelle
// et qu'il y a une photo admin par défaut, on l'utilise en priorité
(function patchFallbackPhotoWithAdminDefaults(){
  var originalGenerate = window.generateFallbackPhoto;
  // On sur-patch getPermPhotoForCard si elle existe, sinon on patch _fallback_svg resolution
  // Le patch principal se fait dans getAdminDefaultPhotoForEtab appelé par la carte
})();

// Charger les photos par défaut au démarrage (quand Firebase est prêt)
(function waitForFirebaseAndLoadDefaults(){
  var attempts = 0;
  var t = setInterval(function(){
    if(window.db && window.fbGetDoc && window.fbDoc){
      clearInterval(t);
      loadAdminDefaultPhotos(function(photos){
        _adminDefaultPhotos = photos || {};
        // Patcher les etablissements déjà chargés
        if(typeof etablissements !== "undefined" && etablissements && etablissements.length){
          etablissements.forEach(function(e){
            // Correction : !e._gphoto_urls était faux pour [] (tableau vide truthy)
            if(!e._photo_profile_approved && !e.photo_interieur && !e.photo_exterieur
               && (!e._gphoto_urls || e._gphoto_urls.length === 0)){
              var def = getAdminDefaultPhotoForEtab(e);
              if(def){
                e._fallback_svg = def;
                e._fallback_svg_is_admin_default = true;
              }
            }
          });
          // Re-render pour appliquer les nouvelles photos par défaut aux cartes déjà affichées
          if(typeof renderAll  === "function") setTimeout(renderAll,  80);
          if(typeof renderHome === "function") setTimeout(renderHome, 80);
        }
      });
    }
    if(++attempts > 60) clearInterval(t);
  }, 500);
})();

// ── Afficher le bouton Admin dans la nav quand mode admin actif ─
// PERF: setInterval 1000ms remplacé par event-driven (zero CPU en idle)
var _admNavShown=false;
function _admNavUpdate(){
  var nb=document.getElementById("adminNavBtn");
  if(!nb)return;
  if(isAdmin&&!_admNavShown){
    nb.style.display="flex"; _admNavShown=true;
  } else if(!isAdmin&&_admNavShown){
    nb.style.display="none"; _admNavShown=false;
    if(typeof closeAdminDashboard==='function') closeAdminDashboard();
  }
}
// Appel initial après DOM prêt
document.addEventListener('DOMContentLoaded', function(){ setTimeout(_admNavUpdate, 500); });
// Ré-évaluation à chaque changement d'état auth Firebase
document.addEventListener('ambi:authStateChanged', _admNavUpdate);
// Sécurité : vérification unique 3s après chargement puis on arrête
setTimeout(_admNavUpdate, 3000);

// ─────────────────────────────────────────────────────────────

// == RESERVATION VIP ==============================================
var _currentReservEtab = null;
function openReservationModal(etabId, etabNom, affluence) {
  _currentReservEtab = { id: etabId, nom: etabNom, affluence: affluence };
  document.getElementById('reservModalSub').textContent = etabNom + ' - Place VIP';
  var bar = document.getElementById('reservStatutBar');
  if (affluence >= 90) { bar.className = 'reserv-statut-bar rsb-sature'; bar.textContent = 'Sature - Reservation sous reserve'; }
  else if (affluence >= 70) { bar.className = 'reserv-statut-bar rsb-bonde'; bar.textContent = 'Bonde - Places VIP limitees'; }
  else { bar.className = 'reserv-statut-bar rsb-dispo'; bar.textContent = 'Places disponibles'; }
  if (window.currentUserPseudo) document.getElementById('reservNom').value = window.currentUserPseudo;
  document.getElementById('reservFeedback').style.display = 'none';
  var btn = document.getElementById('reservBtn');
  if (btn) { btn.disabled = false; btn.textContent = 'Envoyer ma demande VIP'; }
  
  // Charger le calendrier de disponibilité
  loadCalendar(etabId, function() {
    // Afficher calendrier après chargement
    var calWidget = buildCalendarWidget(etabId);
    var calPlaceholder = document.getElementById('reservCalendarWidget');
    if(calPlaceholder) calPlaceholder.innerHTML = calWidget;
  });
  
  // Réinitialiser le devis
  updateDevis();
  
  document.getElementById('reservationOverlay').classList.add('show');
}
function closeReservationModal() {
  document.getElementById('reservationOverlay').classList.remove('show');
  _currentReservEtab = null;
}
function envoyerReservation() {
  var nom = (document.getElementById('reservNom').value || '').trim();
  var tel = (document.getElementById('reservTel').value || '').trim();
  var nb  = document.getElementById('reservNb').value;
  var msg = (document.getElementById('reservMsg').value || '').trim();
  if (!nom || !tel) { showToast('Nom et telephone requis'); return; }
  var btn = document.getElementById('reservBtn');
  var fb  = document.getElementById('reservFeedback');
  btn.disabled = true; btn.textContent = 'Envoi en cours...';
  if (!window.db || !window.fbAddDoc || !window.fbCollection) {
    var waMsg = 'Reservation VIP AMBI241 - Etablissement: ' + _currentReservEtab.nom + ' | Nom: ' + nom + ' | Tel: ' + tel + ' | Pers: ' + nb + (msg ? ' | Note: ' + msg : '');
    window.open('https://wa.me/24174450924?text=' + encodeURIComponent(waMsg), '_blank');
    fb.style.display = 'block'; fb.style.color = 'var(--green)';
    fb.textContent = 'Demande envoyee ! Vous serez contacte au ' + tel;
    btn.textContent = 'Envoye'; return;
  }
  var etab = (window.etablissements || []).find(function(x){ return String(x.id) === String(_currentReservEtab.id); });
  window.fbAddDoc(window.fbCollection(window.db, 'reservations'), {
    etablissementId: String(_currentReservEtab.id), etablissementNom: _currentReservEtab.nom,
    userId: window.currentUserUID || 'anonyme', userNom: nom, userTel: tel, nbPersonnes: nb,
    typePlace: 'VIP', statut: 'en_attente', message: msg,
    affluenceAuMoment: _currentReservEtab.affluence, timestamp: Date.now(), lu: false
  }).then(function() {
    return window.fbAddDoc(window.fbCollection(window.db, 'admin_notifications'), {
      type: 'reservation_vip', etablissementNom: _currentReservEtab.nom,
      etablissementId: String(_currentReservEtab.id), userNom: nom, userTel: tel,
      nbPersonnes: nb, timestamp: Date.now(), lu: false
    });
  }).then(function() {
    if (etab && etab._docId && window.fbUpdateDoc && window.fbDoc) {
      var ns = (etab.scoreActivite || 0) + 10;
      window.fbUpdateDoc(window.fbDoc(window.db, 'etablissements', etab._docId), { scoreActivite: ns, lastActivity: Date.now() }).catch(function(){});
    }
    try { pushNotif({ targetRole:'admin', key:'new_inscription', icon:'VIP', title:'Reservation VIP - ' + _currentReservEtab.nom, msg: nom + ' - ' + nb + ' pers - ' + tel, channel:'push', fromAdmin:false }); } catch(e2) {}
    fb.style.display = 'block'; fb.style.color = 'var(--green)';
    fb.textContent = 'Demande envoyee ! Nous vous contacterons au ' + tel;
    btn.textContent = 'Envoye'; showToast('Reservation VIP envoyee !');
  }).catch(function(err) {
    btn.disabled = false; btn.textContent = 'Reessayer';
    fb.style.display = 'block'; fb.style.color = 'var(--red)';
    fb.textContent = 'Erreur: ' + err.message;
  });
}
function loadAdminReservations(callback) {
  if (!window.db || !window.fbCollection || !window.fbGetDocs || !window.fbQuery || !window.fbOrderBy) { callback([]); return; }
  var q = window.fbQuery(window.fbCollection(window.db, 'reservations'), window.fbOrderBy('timestamp', 'desc'));
  window.fbGetDocs(q).then(function(snap) {
    var list = []; snap.forEach(function(d){ list.push(Object.assign({_docId: d.id}, d.data())); });
    if (callback) callback(list);
  }).catch(function() { if (callback) callback([]); });
}
function renderAdmReservations() {
  var container = document.getElementById('adminReservContent');
  if (!container) return;
  container.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);">Chargement...</div>';
  loadAdminReservations(function(list) {
    if (!list.length) { container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);">Aucune reservation VIP pour l\u2019instant</div>'; return; }
    var pending=list.filter(function(r){return r.statut==='en_attente';}),
        confirmed=list.filter(function(r){return r.statut==='confirm\u00e9e';}),
        refused=list.filter(function(r){return r.statut==='refus\u00e9e';});
    var html='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-bottom:1rem;">'
      +'<div class="adm-kpi"><div class="kv" style="color:var(--amber);">'+pending.length+'</div><div class="kl">En attente</div></div>'
      +'<div class="adm-kpi"><div class="kv" style="color:var(--green);">'+confirmed.length+'</div><div class="kl">Confirm\u00e9es</div></div>'
      +'<div class="adm-kpi"><div class="kv" style="color:var(--red);">'+refused.length+'</div><div class="kl">Refus\u00e9es</div></div></div>';
    if (pending.length) { html+='<div style="font-weight:700;color:var(--amber);font-size:0.78rem;margin-bottom:0.6rem;">En attente</div>'; pending.forEach(function(r){html+=buildReservCard(r,true);}); }
    if (confirmed.length) { html+='<div style="font-weight:700;color:var(--green);font-size:0.78rem;margin:0.8rem 0 0.6rem;">Confirm\u00e9es</div>'; confirmed.forEach(function(r){html+=buildReservCard(r,false);}); }
    if (refused.length) { html+='<div style="font-weight:700;color:var(--red);font-size:0.78rem;margin:0.8rem 0 0.6rem;">Refus\u00e9es</div>'; refused.forEach(function(r){html+=buildReservCard(r,false);}); }
    container.innerHTML=html;
  });
}
function buildReservCard(r, showActions) {
  var sc=r.statut==='confirm\u00e9e'?'var(--green)':r.statut==='refus\u00e9e'?'var(--red)':'var(--amber)';
  var sl=r.statut==='confirm\u00e9e'?'Confirm\u00e9e':r.statut==='refus\u00e9e'?'Refus\u00e9e':'En attente';
  var ts=r.timestamp?new Date(r.timestamp).toLocaleDateString('fr-FR'):'';
  var aff=r.affluenceAuMoment!==undefined?' - '+r.affluenceAuMoment+'%':'';
  var did=(r._docId||'').replace(/"/g,''); var eid=(r.etablissementId||'').replace(/"/g,'');
  var h='<div class="adm-reserv-card"><div class="arc-head"><div>';
  h+='<div class="arc-nom">'+escHtml(r.userNom||'Inconnu')+' &middot; '+(r.nbPersonnes||'?')+' pers.</div>';
  h+='<div class="arc-etab">'+escHtml(r.etablissementNom||'')+aff+'</div>';
  h+='<div class="arc-tel">'+escHtml(r.userTel||'')+'</div>';
  if(r.message)h+='<div style="font-size:0.7rem;color:var(--muted);">'+escHtml(r.message)+'</div>';
  h+='<div style="font-size:0.62rem;color:rgba(255,255,255,0.25);">'+ts+'</div>';
  h+='</div><div style="font-size:0.7rem;font-weight:800;color:'+sc+';border:1px solid '+sc+';padding:0.2rem 0.5rem;border-radius:6px;">'+sl+'</div></div>';
  if(showActions&&did){
    h+='<div class="arc-actions">'
      +'<button class="arc-btn-ok" data-did="'+did+'" data-eid="'+eid+'" onclick="repondreReservation(this.dataset.did,\'confirm\u00e9e\',this.dataset.eid)">Confirmer</button>'
      +'<button class="arc-btn-no" data-did="'+did+'" data-eid="'+eid+'" onclick="repondreReservation(this.dataset.did,\'refus\u00e9e\',this.dataset.eid)">Refuser</button>'
      +'</div>';
  }
  h+='</div>'; return h;
}
function repondreReservation(rid, statut, etabId) {
  var raison = statut==='refus\u00e9e' ? (prompt('Raison du refus:')||'Complet ce soir') : 'Votre place VIP est confirm\u00e9e !';
  if(!window.db||!window.fbDoc||!window.fbUpdateDoc){showToast('Firebase non disponible');return;}
  window.fbUpdateDoc(window.fbDoc(window.db,'reservations',rid),{statut:statut,reponseAdmin:raison,lu:true,reponduAt:Date.now()})
    .then(function(){showToast(statut==='confirm\u00e9e'?'Confirmation envoyee !':'Refus enregistre'); renderAdmReservations();})
    .catch(function(err){showToast('Erreur: '+err.message);});
}
window.openReservationModal=openReservationModal;
window.closeReservationModal=closeReservationModal;
window.envoyerReservation=envoyerReservation;
window.repondreReservation=repondreReservation;
window.renderAdmReservations=renderAdmReservations;

// ══════════════════════════════════════════════════════════════
// ══  SERVICES & EXTRAS ORDERING SYSTEM                       ══
// ══════════════════════════════════════════════════════════════

var _SERVICES_CATALOG = [
  { id:'bouteille',  icon:'🍾', name:'Bouteille Premium',   price:25000,  desc:'Champagne, whisky ou vin sélection VIP' },
  { id:'table_vip',  icon:'🛋️', name:'Table VIP Réservée',  price:15000,  desc:'Table privée avec décoration incluse' },
  { id:'anniversaire',icon:'🎂',name:'Pack Anniversaire',   price:20000,  desc:'Gâteau, bougies, service dédié' },
  { id:'cocktails',  icon:'🍹', name:'Pack Cocktails ×4',   price:18000,  desc:'4 cocktails signature de la maison' },
  { id:'menu_vip',   icon:'🍽️', name:'Menu Gastronomique',  price:35000,  desc:'Dîner 3 plats pour 2 personnes' },
  { id:'dj_dedicace',icon:'🎵', name:'Dédicace DJ',         price:10000,  desc:'Message ou chanson dédié en soirée' },
  { id:'photo_pack', icon:'📸', name:'Pack Photo Soirée',   price:12000,  desc:'Séance photo + retouches livrées' },
  { id:'transport',  icon:'🚖', name:'Navette VIP',         price:8000,   desc:'Transfert aller-retour (zone Libreville)' }
];

var _selectedServices = {};

function _renderServicesGrid() {
  var grid = document.getElementById('servicesGrid');
  if (!grid) return;
  var html = '';
  _SERVICES_CATALOG.forEach(function(svc) {
    var sel = !!_selectedServices[svc.id];
    html += '<div class="svc-card' + (sel ? ' selected' : '') + '" onclick="toggleService(\'' + svc.id + '\')">'
      + '<div class="svc-check">✓</div>'
      + '<div class="svc-icon">' + svc.icon + '</div>'
      + '<div class="svc-name">' + svc.name + '</div>'
      + '<div class="svc-price">' + svc.price.toLocaleString('fr-FR') + ' XAF</div>'
      + '<div class="svc-desc">' + svc.desc + '</div>'
      + '</div>';
  });
  grid.innerHTML = html;
  _updateServicesSummary();
}

function toggleService(svcId) {
  if (_selectedServices[svcId]) {
    delete _selectedServices[svcId];
  } else {
    var svc = _SERVICES_CATALOG.find(function(s) { return s.id === svcId; });
    if (svc) _selectedServices[svcId] = svc;
  }
  _renderServicesGrid();
}

function _updateServicesSummary() {
  var keys = Object.keys(_selectedServices);
  var summary = document.getElementById('servicesSummary');
  var listEl  = document.getElementById('servicesSumList');
  var totalEl = document.getElementById('servicesSumTotal');
  if (!summary) return;

  if (!keys.length) {
    summary.classList.remove('show');
    return;
  }
  summary.classList.add('show');

  var total = 0;
  var html = '';
  keys.forEach(function(k) {
    var s = _selectedServices[k];
    html += s.icon + ' ' + s.name + ' <span>' + s.price.toLocaleString('fr-FR') + ' XAF</span><br>';
    total += s.price;
  });
  listEl.innerHTML = html;
  totalEl.textContent = total.toLocaleString('fr-FR') + ' XAF';
}

function getSelectedServicesText() {
  var keys = Object.keys(_selectedServices);
  if (!keys.length) return '';
  return 'Services demandés: ' + keys.map(function(k) {
    return _selectedServices[k].name + ' (' + _selectedServices[k].price.toLocaleString('fr-FR') + ' XAF)';
  }).join(', ');
}

// Patch openReservationModal to also reset and render services
var _origOpenReservationModal = openReservationModal;
openReservationModal = function(etabId, etabNom, affluence) {
  _selectedServices = {};
  _origOpenReservationModal(etabId, etabNom, affluence);
  _renderServicesGrid();
};
window.openReservationModal = openReservationModal;

// Patch envoyerReservation to include selected services in the message
var _origEnvoyerReservation = envoyerReservation;
envoyerReservation = function() {
  var svcText = getSelectedServicesText();
  if (svcText) {
    var msgEl = document.getElementById('reservMsg');
    if (msgEl) {
      var existing = msgEl.value.trim();
      msgEl.value = existing ? existing + '\n' + svcText : svcText;
    }
  }
  _origEnvoyerReservation();
};
window.envoyerReservation = envoyerReservation;

window.toggleService = toggleService;
// -----------------------------------------------------------------

// ══════════════════════════════════════════════════════════════════
// ══  PREFERENCES CLIENT & DEVIS REALTIME                          ══
// ══════════════════════════════════════════════════════════════════

var _selectedGateuColor = null;

window.selectGateau = function(color, btn) {
  _selectedGateuColor = color;
  document.querySelectorAll(".gateau-btn").forEach(function(b){ b.style.borderColor="rgba(255,255,255,0.3)"; b.style.boxShadow="none"; });
  if(btn) { btn.style.borderColor="var(--amber)"; btn.style.boxShadow="0 0 8px rgba(255,215,0,0.5)"; }
  updateDevis();
};

function updateDevis() {
  // Collecter les services sélectionnés
  var services = Object.keys(_selectedServices || {}).map(function(k){ return _selectedServices[k]; });
  var totalServices = services.reduce(function(sum, s){ return sum + (s.price||0); }, 0);

  // Construire le devis détaillé
  var details = '';
  if(services.length > 0) {
    details += services.map(function(s){ 
      return '<div style="display:flex;justify-content:space-between;"><span>' + escHtml(s.name) + '</span><span style="color:var(--amber);">' + (s.price||0).toLocaleString('fr-FR') + ' XAF</span></div>'; 
    }).join('');
  }

  // Affichage devis
  var devisEl = document.getElementById('devisDetails');
  if(devisEl) {
    devisEl.innerHTML = (details ? details : '<div style="display:flex;justify-content:space-between;"><span>Base de la reservation</span><span style="color:var(--muted);">—</span></div>');
  }

  var totalEl = document.getElementById('devisTotal');
  if(totalEl) {
    totalEl.textContent = totalServices.toLocaleString('fr-FR') + ' XAF';
  }
}

// Mettre à jour devis quand on change les services
var _origToggleService = window.toggleService || function(){};
window.toggleService = function(svcId) {
  _origToggleService(svcId);
  updateDevis();
  // Afficher/masquer la section couleur gateau si anniversaire sélectionné
  var hasAnniv = _selectedServices && _selectedServices['anniversaire'];
  var gateauSec = document.getElementById('reservGateauColors');
  if(gateauSec) gateauSec.style.display = hasAnniv ? 'block' : 'none';
};

// ══════════════════════════════════════════════════════════════════
// ══  CALENDRIER DE DISPONIBILITÉ                                  ══
// ══════════════════════════════════════════════════════════════════

var _calendarState = {}; // { etabId: { date: boolean } }

// Charger calendar depuis Firebase 
function loadCalendar(etabId, callback) {
  if(!window.db || !window.fbDoc || !window.fbGetDoc) return;
  window.fbGetDoc(window.fbDoc(window.db, "etablissements_calendar", String(etabId)))
    .then(function(snap) {
      if(snap.exists()) {
        _calendarState[etabId] = snap.data().dates || {};
      }
      if(callback) callback();
    }).catch(function() { if(callback) callback(); });
}

// Sauver calendar 
function saveCalendar(etabId) {
  if(!window.db || !window.fbSetDoc || !window.fbDoc) return;
  window.fbSetDoc(window.fbDoc(window.db, "etablissements_calendar", String(etabId)), {
    dates: _calendarState[etabId] || {},
    etabId: String(etabId),
    updatedAt: Date.now()
  }, { merge: true }).catch(function() {});
}

// Toggler dispo pour une date (pour gérant dans le panneau Pro)
window.toggleDateDispo = function(etabId, dateStr, el) {
  if(!_calendarState[etabId]) _calendarState[etabId] = {};
  _calendarState[etabId][dateStr] = !_calendarState[etabId][dateStr];
  saveCalendar(etabId);
  if(el) {
    el.style.backgroundColor = _calendarState[etabId][dateStr] ? 'rgba(0,255,170,0.25)' : 'rgba(255,255,255,0.03)';
    el.style.borderColor = _calendarState[etabId][dateStr] ? 'var(--green)' : 'rgba(255,255,255,0.1)';
  }
};

// Afficher calendrier mini (pour client dans modal resa)
function buildCalendarWidget(etabId) {
  var html = '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:0.7rem;margin-top:0.6rem;">';
  html += '<div style="font-size:0.65rem;color:var(--muted);font-weight:700;margin-bottom:0.4rem;">Prochains 7 jours disponibles</div>';
  html += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.3rem;">';
  
  for(var i=0; i<7; i++) {
    var d = new Date();
    d.setDate(d.getDate() + i);
    var ds = d.toISOString().split('T')[0];
    var avail = _calendarState[etabId] && _calendarState[etabId][ds];
    var dow = ['D','L','M','M','J','V','S'][d.getDay()];
    var dom = d.getDate();
    
    html += '<button style="'
      + 'background:' + (avail ? 'rgba(0,255,170,0.15)' : 'rgba(255,68,102,0.1)') + ';'
      + 'border:1px solid ' + (avail ? 'rgba(0,255,170,0.4)' : 'rgba(255,68,102,0.25)') + ';'
      + 'border-radius:8px;'
      + 'padding:0.4rem;'
      + 'font-size:0.65rem;'
      + 'color:' + (avail ? 'var(--green)' : 'var(--red)') + ';'
      + 'font-weight:700;'
      + 'cursor:default;'
      + '">'
      + dow + ' ' + dom
      + '</button>';
  }
  
  html += '</div></div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// ══  FONCTIONS COMPLÉMENTAIRES : Assignation d'établissements & Successeur
// ══════════════════════════════════════════════════════════════════

// ── Désigner un établissement pour un utilisateur (via l'admin) ───
function assignEtablissementToUser(etabId, userEmail, userName){
  if(!isAdmin){ showToast('Accès admin requis'); return; }
  var etab = etablissements.find(function(e){ return e.id === etabId; });
  if(!etab){ showToast('Établissement introuvable'); return; }
  if(!confirm('Assigner "'+etab.nom+'" à '+userName+' ('+userEmail+') ?\n\nCet utilisateur pourra gérer les photos et le statut de cet établissement.')){ return; }

  updateField(etabId, { email: userEmail });

  if(window.db && window.fbSetDoc && window.fbDoc){
    window.fbSetDoc(window.fbDoc(window.db, 'users', currentUserUID||'system'), {}, {merge:true}).catch(function(){});
    if(window.fbAddDoc && window.fbCollection){
      window.fbAddDoc(window.fbCollection(window.db, 'user_notifications'), {
        targetEmail: userEmail,
        icon: '🏠',
        title: 'Établissement assigné !',
        msg: 'Vous gérez maintenant "'+etab.nom+'" sur AMBI241.',
        ts: Date.now(),
        unread: true
      }).catch(function(){});
    }
  }
  showToast('✅ '+etab.nom+' assigné à '+userName);
  if(typeof renderAdmUsers === 'function') setTimeout(renderAdmUsers, 800);
}

// ── Désigner un successeur potentiel (en cas de vente / cession) ─
function designateSuccessor(uid, email, pseudo){
  if(!isSuperAdminUser()){ showToast('⛔ Réservé au Propriétaire'); return; }
  if(!confirm(
    '👑 Désigner "'+pseudo+'" ('+email+') comme successeur ?\n\n' +
    'En cas de vente ou de cession de l\'application,\n' +
    'il sera proposé comme nouveau propriétaire.\n\n' +
    'Vous restez propriétaire jusqu\'à la cession effective.'
  )){ return; }

  var data = { uid: uid, email: email, pseudo: pseudo, designatedAt: new Date().toISOString(), designatedBy: currentUserEmail || '' };

  if(window.db && window.fbSetDoc && window.fbDoc){
    window.fbSetDoc(window.fbDoc(window.db, 'config', 'successor'), data)
      .then(function(){
        lsSetJSON('ambi241_successor', data);
        showToast('✅ Successeur désigné : '+pseudo);
        if(typeof renderAdmUsers === 'function') renderAdmUsers();
      })
      .catch(function(err){ showToast('Erreur: '+err.message); });
  } else {
    lsSetJSON('ambi241_successor', data);
    showToast('✅ Successeur désigné : '+pseudo+' (hors-ligne)');
  }
}

window.assignEtablissementToUser = assignEtablissementToUser;
window.designateSuccessor        = designateSuccessor;

// ── Fiche publique membre (bottom-sheet moderne) ──────────────────
function openUserProfile(userData){
  if(typeof userData === "string"){ try{ userData=JSON.parse(userData); }catch(e){ return; } }
  var uid      = userData.uid      || "";
  var email    = userData.email    || "";
  var pseudo   = userData.pseudo   || "Inconnu";
  var tel      = userData.tel      || "";
  var dob      = userData.dob      || "";
  var created  = userData.createdAt|| "";
  var isAdm    = userData.isAdmin  || false;
  var etabNom  = userData.etabNom  || "";
  var initiale = (pseudo[0]||"?").toUpperCase();
  var dateStr  = created ? new Date(created).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"}) : "—";
  var dobStr   = dob ? new Date(dob).toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"}) : "—";
  var iAmSuper = isAdmin && isSuperAdminUser();
  window._editingMember = { uid:uid, email:email, pseudo:pseudo, tel:tel, dob:dob, isAdmin:isAdm, etabNom:etabNom };

  var avatarGrad = isAdm
    ? "linear-gradient(135deg,var(--amber),var(--cyan))"
    : "linear-gradient(135deg,var(--pink),var(--purple))";

  /* ── AVATAR HTML ── */
  var avatarHtml =
    '<div style="position:relative;display:inline-block;">'
    +'<div id="_vpAvatarInit" style="width:76px;height:76px;border-radius:50%;background:'+avatarGrad+';display:flex;align-items:center;justify-content:center;font-family:Syne,sans-serif;font-weight:800;font-size:2rem;color:#fff;overflow:hidden;box-shadow:0 0 24px rgba(255,45,155,0.45),0 0 0 3px rgba(255,255,255,0.08);">'+escHtml(initiale)+'</div>'
    +(isAdm?'<div style="position:absolute;bottom:0;right:0;width:22px;height:22px;border-radius:50%;background:var(--amber);border:2px solid var(--surface);display:flex;align-items:center;justify-content:center;font-size:0.75rem;">🔑</div>':'<div style="position:absolute;bottom:2px;right:2px;width:14px;height:14px;border-radius:50%;background:var(--green);border:2px solid var(--surface);box-shadow:0 0 6px rgba(0,255,170,0.6);"></div>')
    +'</div>';

  /* ── BADGES ROW ── */
  var badgesHtml = '<div style="display:flex;gap:0.3rem;justify-content:center;flex-wrap:wrap;margin:0.45rem 0;">';
  if(isAdm) badgesHtml += '<span style="font-size:0.6rem;font-weight:700;background:rgba(255,215,0,0.15);color:var(--amber);padding:0.15rem 0.5rem;border-radius:20px;border:1px solid rgba(255,215,0,0.35);">🔑 Admin</span>';
  else badgesHtml += '<span style="font-size:0.6rem;font-weight:700;background:rgba(0,229,255,0.1);color:var(--cyan);padding:0.15rem 0.5rem;border-radius:20px;border:1px solid rgba(0,229,255,0.25);">👤 Membre</span>';
  if(etabNom) badgesHtml += '<span style="font-size:0.6rem;font-weight:700;background:rgba(255,45,155,0.12);color:var(--pink);padding:0.15rem 0.5rem;border-radius:20px;border:1px solid rgba(255,45,155,0.28);">🏠 Gérant</span>';
  if(created && Date.now()-created>86400000*30) badgesHtml += '<span style="font-size:0.6rem;font-weight:700;background:rgba(204,68,255,0.1);color:var(--purple);padding:0.15rem 0.5rem;border-radius:20px;border:1px solid rgba(204,68,255,0.25);">⭐ Fidèle</span>';
  badgesHtml += '</div>';

  /* ── TABS ── */
  var tabsHtml =
    '<div style="display:flex;gap:0.2rem;background:rgba(255,255,255,0.04);border-radius:11px;padding:0.2rem;margin-bottom:1rem;">'
    +'<button id="_vpTab_infos" onclick="_vpSwitchTab(\'infos\')" style="flex:1;padding:0.38rem;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;border:none;background:var(--pink);color:#000;font-family:DM Sans,sans-serif;transition:all 0.2s;">👤 Infos</button>'
    +'<button id="_vpTab_notifs" onclick="_vpSwitchTab(\'notifs\')" style="flex:1;padding:0.38rem;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;border:none;background:transparent;color:var(--muted);font-family:DM Sans,sans-serif;transition:all 0.2s;">🔔 Notifs</button>'
    +'<button id="_vpTab_actions" onclick="_vpSwitchTab(\'actions\')" style="flex:1;padding:0.38rem;border-radius:8px;font-size:0.72rem;font-weight:700;cursor:pointer;border:none;background:transparent;color:var(--muted);font-family:DM Sans,sans-serif;transition:all 0.2s;">⚡ Actions</button>'
    +'</div>';

  /* ── PANE INFOS ── */
  var infoFields = '<div id="_vpPane_infos">';
  if(iAmSuper){
    // Champs éditables pour super admin
    infoFields += '<div style="font-family:Syne,sans-serif;font-size:0.65rem;font-weight:800;color:var(--pink);text-transform:uppercase;letter-spacing:0.09em;margin-bottom:0.6rem;display:flex;align-items:center;gap:0.4rem;">Modifier le profil<div style="flex:1;height:1px;background:rgba(255,45,155,0.15);"></div></div>';
    infoFields += '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-bottom:1rem;">';
    infoFields += _vpEditField("✉️","Email","_vpEditEmail","email",email,"text","email@exemple.com");
    infoFields += _vpEditField("👤","Pseudo","_vpEditPseudo","text",pseudo,"text","Nom d'affichage");
    infoFields += _vpEditField("📞","Téléphone","_vpEditTel","tel",tel,"tel","+241 XXXXXXXX");
    infoFields += _vpEditField("🎂","Date de naissance","_vpEditDob","date",dob,"date","");
    infoFields += '</div>';
    infoFields += '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:0.75rem;margin-bottom:0.85rem;">';
    infoFields += _profileRow("📅","Membre depuis", dateStr);
    if(etabNom) infoFields += _profileRow("🏠","Établissement", etabNom);
    infoFields += _profileRow("🆔","UID", uid ? uid.substring(0,14)+"…" : "—");
    if(isAdm) infoFields += _profileRow("🔑","Rôle", "Admin secondaire");
    infoFields += '</div>';
    infoFields += '<button onclick="_vpSaveMemberEdits()" style="width:100%;padding:0.65rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--purple));color:#fff;font-family:Syne,sans-serif;font-weight:800;font-size:0.85rem;cursor:pointer;letter-spacing:0.02em;box-shadow:0 4px 16px rgba(255,45,155,0.3);">💾 Sauvegarder</button>';
  } else {
    infoFields += '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:1rem;margin-bottom:1rem;">';
    infoFields += _profileRow("📅","Membre depuis", dateStr);
    if(etabNom) infoFields += _profileRow("🏠","Établissement", etabNom);
    infoFields += '</div>';
  }
  infoFields += '</div>';

  /* ── PANE NOTIFS ── */
  var notifsPane = '<div id="_vpPane_notifs" style="display:none;">';
  notifsPane += '<div style="background:rgba(255,45,155,0.05);border:1px solid rgba(255,45,155,0.18);border-radius:14px;padding:0.9rem;margin-bottom:0.9rem;">';
  notifsPane += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:0.78rem;margin-bottom:0.6rem;">📨 Notification à '+escHtml(pseudo)+'</div>';
  notifsPane += '<div style="margin-bottom:0.45rem;"><div style="display:flex;gap:0.25rem;flex-wrap:wrap;margin-bottom:0.45rem;" id="_vpNotifIconRow">';
  ["📢","🔔","⚡","🎉","⚠️","✅","💳","🏆","📸","🎵"].forEach(function(ic,i){
    notifsPane += '<button onclick="document.querySelectorAll(\'#_vpNotifIconRow button\').forEach(function(b){b.style.background=\'rgba(255,255,255,0.04)\';b.style.borderColor=\'rgba(255,255,255,0.1)\'});this.style.background=\'rgba(255,45,155,0.18)\';this.style.borderColor=\'var(--pink)\';document.getElementById(\'_vpNotifIconVal\').value=this.textContent;" style="font-size:1.05rem;padding:0.22rem 0.38rem;border-radius:7px;cursor:pointer;border:1px solid rgba(255,255,255,0.1);background:'+(i===0?'rgba(255,45,155,0.18)':'rgba(255,255,255,0.04)')+';transition:all 0.15s;">'+ic+'</button>';
  });
  notifsPane += '</div><input type="hidden" id="_vpNotifIconVal" value="📢"></div>';
  notifsPane += '<div style="margin-bottom:0.4rem;"><input id="_vpNotifTitle" type="text" maxlength="60" placeholder="Titre *" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:9px;color:var(--text);padding:0.5rem 0.7rem;font-size:0.82rem;font-family:DM Sans,sans-serif;outline:none;box-sizing:border-box;"></div>';
  notifsPane += '<div style="margin-bottom:0.65rem;"><textarea id="_vpNotifMsg" maxlength="200" rows="2" placeholder="Message (optionnel)..." style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:9px;color:var(--text);padding:0.5rem 0.7rem;font-size:0.8rem;font-family:DM Sans,sans-serif;outline:none;resize:none;box-sizing:border-box;"></textarea></div>';
  notifsPane += '<button onclick="_vpSendPersonalNotif()" style="width:100%;padding:0.6rem;border-radius:10px;border:none;background:linear-gradient(135deg,var(--pink),var(--cyan));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;cursor:pointer;">📤 Envoyer</button>';
  notifsPane += '</div>';
  notifsPane += '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--cyan);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:0.45rem;">📋 Historique</div>';
  notifsPane += '<div id="_vpNotifHistory" style="font-size:0.73rem;color:var(--muted);text-align:center;padding:0.8rem;">⏳ Chargement…</div>';
  notifsPane += '</div>';

  /* ── PANE ACTIONS ── */
  var actionsPane = '<div id="_vpPane_actions" style="display:none;">';
  if(iAmSuper && email){
    actionsPane += '<div style="display:flex;flex-direction:column;gap:0.4rem;">';
    if(!isAdm){
      actionsPane += _vpActionBtn('🔑','Promouvoir Admin','Accès complet au tableau de bord','var(--amber)','rgba(255,215,0,0.35)','rgba(255,215,0,0.08)',"closeUserProfile();promoteToAdmin('"+escHtml(uid)+"','"+escHtml(email)+"','"+escHtml(pseudo)+"')");
      actionsPane += _vpActionBtn('🔮','Désigner Successeur','Héritier de la propriété','var(--cyan)','rgba(0,229,255,0.25)','rgba(0,229,255,0.06)',"closeUserProfile();designateSuccessor('"+escHtml(uid)+"','"+escHtml(email)+"','"+escHtml(pseudo)+"')");
    } else {
      actionsPane += _vpActionBtn('✕','Révoquer Admin','Retirer les droits admin','var(--red)','rgba(255,68,102,0.35)','rgba(255,68,102,0.08)',"closeUserProfile();revokeAdmin('"+escHtml(uid)+"','"+escHtml(email)+"','"+escHtml(pseudo)+"')");
      actionsPane += _vpActionBtn('👑','Céder la Propriété','Transférer le compte SuperAdmin','var(--amber)','rgba(255,215,0,0.25)','rgba(255,215,0,0.05)',"closeUserProfile();transferOwnership('"+escHtml(uid)+"','"+escHtml(email)+"','"+escHtml(pseudo)+"')");
    }
    if(!etabNom) actionsPane += _vpActionBtn('🏠','Assigner Établissement','Lier un établissement à ce membre','var(--pink)','rgba(255,45,155,0.3)','rgba(255,45,155,0.06)',"closeUserProfile();openAssignEtabModal('"+escHtml(uid)+"','"+escHtml(email)+"','"+escHtml(pseudo)+"')");
    actionsPane += _vpActionBtn('🔑','Réinitialiser MDP','Générer un nouveau mot de passe','var(--amber)','rgba(255,215,0,0.25)','rgba(255,215,0,0.06)',"_vpResetMemberPwd()");
    actionsPane += '<div style="height:1px;background:rgba(255,68,102,0.15);margin:0.2rem 0;"></div>';
    actionsPane += _vpActionBtn('🗑️','Supprimer le Membre','Action irréversible','var(--red)','rgba(255,68,102,0.4)','rgba(255,68,102,0.07)',"closeUserProfile();deleteMember('"+escHtml(uid)+"','"+escHtml(email)+"','"+escHtml(pseudo)+"')");
    actionsPane += '</div>';
  } else {
    actionsPane += '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;">⛔ Accès SuperAdmin requis</div>';
  }
  actionsPane += '</div>';

  /* ── STRUCTURE BOTTOM-SHEET ── */
  var html =
    '<div id="_userProfileOverlay" style="position:fixed;inset:0;z-index:500;background:rgba(0,0,0,0.82);backdrop-filter:blur(10px);display:flex;align-items:flex-end;justify-content:center;" onclick="if(event.target===this)closeUserProfile()">'
    +'<div style="background:var(--surface);border:1.5px solid rgba(255,45,155,0.22);border-radius:26px 26px 0 0;width:min(480px,100%);max-height:90vh;overflow-y:auto;animation:slideUp 0.32s cubic-bezier(0.34,1.1,0.64,1);position:relative;">'
    // Drag handle
    +'<div style="width:40px;height:4px;border-radius:2px;background:rgba(255,255,255,0.15);margin:0.65rem auto 0;"></div>'
    // Bouton fermer
    +'<button onclick="closeUserProfile()" style="position:absolute;top:0.85rem;right:1rem;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:var(--muted);width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:0.9rem;display:flex;align-items:center;justify-content:center;">✕</button>'
    // Hero banner
    +'<div style="position:relative;height:70px;margin:0.5rem 0;background:linear-gradient(135deg,rgba(255,45,155,0.28),rgba(204,68,255,0.18));overflow:hidden;margin:0.3rem 0.8rem;border-radius:18px;">'
    +'<div style="position:absolute;inset:0;background:repeating-linear-gradient(45deg,transparent,transparent 8px,rgba(255,255,255,0.02) 8px,rgba(255,255,255,0.02) 16px);"></div>'
    +'</div>'
    // Avatar + identité
    +'<div style="display:flex;align-items:flex-end;gap:0.8rem;padding:0 1.2rem;margin-top:-36px;margin-bottom:0.75rem;">'
    +avatarHtml
    +'<div style="flex:1;min-width:0;padding-bottom:0.15rem;">'
    +'<div style="font-family:Syne,sans-serif;font-weight:800;font-size:1.05rem;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(pseudo)+'</div>'
    +'<div style="font-size:0.65rem;color:var(--muted);margin-top:0.05rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+(iAmSuper?escHtml(email||"—"):'Membre AMBI241')+'</div>'
    +badgesHtml
    +'</div>'
    +'</div>'
    // Tabs + panes
    +'<div style="padding:0 1.1rem 2rem;">'
    +tabsHtml+infoFields+notifsPane+actionsPane
    +'</div>'
    +'</div></div>';

  var wrap = document.createElement("div");
  wrap.id = "_userProfileWrap";
  wrap.innerHTML = html;
  document.body.appendChild(wrap);

  // Charger l'avatar réel en asynchrone
  if(uid){
    loadUserAvatar(uid, function(url){
      var initEl = document.getElementById("_vpAvatarInit");
      if(!initEl) return;
      if(url){
        initEl.innerHTML = '';
        initEl.style.background = 'none';
        var imgEl = document.createElement("img");
        imgEl.src = url;
        imgEl.style.cssText = "width:72px;height:72px;border-radius:50%;object-fit:cover;display:block;";
        initEl.appendChild(imgEl);
      }
    });
  }

  // Charger l'historique des notifications du membre
  _vpLoadNotifHistory(uid, email);
}

// ── Bouton action dans le profil membre (helper) ───────────────
function _vpActionBtn(icon, title, sub, color, border, bg, onclick){
  return '<button onclick="'+onclick+'" style="display:flex;align-items:center;gap:0.65rem;padding:0.7rem 0.9rem;border-radius:13px;border:1px solid '+border+';background:'+bg+';color:'+color+';font-family:Syne,sans-serif;font-weight:700;font-size:0.8rem;cursor:pointer;text-align:left;width:100%;transition:opacity 0.2s;"><span style="font-size:1.1rem;flex-shrink:0;">'+icon+'</span><span><span style="display:block;">'+title+'</span><span style="font-size:0.65rem;font-weight:400;opacity:0.7;">'+sub+'</span></span></button>';
}
window._vpActionBtn = _vpActionBtn;

// ── Champ éditable pour le profil membre ──────────────────────
function _vpEditField(icon, label, id, type, value, inputType, placeholder){
  return '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:0.5rem 0.65rem;transition:border-color 0.2s;" onfocusin="this.style.borderColor=\'rgba(255,45,155,0.4)\'" onfocusout="this.style.borderColor=\'rgba(255,255,255,0.08)\'">'
    + '<div style="display:flex;align-items:center;gap:0.5rem;">'
    + '<span style="font-size:0.9rem;flex-shrink:0;">'+icon+'</span>'
    + '<div style="flex:1;">'
    + '<div style="font-size:0.58rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.1rem;">'+label+'</div>'
    + '<input id="'+id+'" type="'+inputType+'" value="'+escHtml(value)+'" placeholder="'+placeholder+'" style="background:none;border:none;outline:none;color:var(--text);font-size:0.83rem;font-family:DM Sans,sans-serif;width:100%;padding:0;">'
    + '</div>'
    + '<span style="font-size:0.65rem;color:var(--muted);">✏️</span>'
    + '</div></div>';
}

// ── Sauvegarder les modifications admin sur un membre ──────────
function _vpSaveMemberEdits(){
  var m = window._editingMember;
  if(!m || !m.uid) { showToast("❌ Aucun membre sélectionné"); return; }
  if(!window.db || !window.fbDoc || !window.fbUpdateDoc){ showToast("Firebase requis"); return; }
  var newPseudo = (document.getElementById("_vpEditPseudo")||{}).value || m.pseudo;
  var newEmail  = (document.getElementById("_vpEditEmail")||{}).value  || m.email;
  var newTel    = (document.getElementById("_vpEditTel")||{}).value    || m.tel;
  var newDob    = (document.getElementById("_vpEditDob")||{}).value    || m.dob;
  var docRef = window.fbDoc(window.db, "users", m.uid);
  window.fbUpdateDoc(docRef, { pseudo:newPseudo, email:newEmail, tel:newTel, dob:newDob, updatedAt:new Date().toISOString(), updatedByAdmin:true })
    .then(function(){
      showToast("✅ Profil de "+newPseudo+" mis à jour !");
      // Mettre à jour aussi les établissements liés si l'email a changé
      if(newEmail !== m.email){
        var etab = etablissements.find(function(e){ return (e.email||"").toLowerCase()===m.email.toLowerCase(); });
        if(etab) updateField(etab.id, { email: newEmail });
      }
      // Enregistrer la notif dans le log admin
      if(typeof saveToAdminLog === "function"){
        saveToAdminLog({ icon:"✏️", title:"Profil modifié — "+newPseudo, msg:"Pseudo/email/tel/dob mis à jour par l'admin.", targetRole:"admin", channel:"push", ts:Date.now(), fromAdmin:true });
      }
      closeUserProfile();
      setTimeout(renderAdmUsers, 500);
    })
    .catch(function(err){ showToast("❌ Erreur : "+err.message); });
}
window._vpSaveMemberEdits = _vpSaveMemberEdits;

// ── Envoyer une notification personnelle à un membre ──────────
function _vpSendPersonalNotif(){
  var m = window._editingMember;
  if(!m) return;
  var icon  = (document.getElementById("_vpNotifIconVal")||{}).value || "📢";
  var title = ((document.getElementById("_vpNotifTitle")||{}).value||"").trim();
  var msg   = ((document.getElementById("_vpNotifMsg")||{}).value||"").trim();
  if(!title){ showToast("⚠️ Titre requis"); return; }
  // Stocker la notif dans Firebase sous la clé de l'utilisateur cible
  if(window.db && window.fbDoc && window.fbSetDoc && m.uid){
    var notifDoc = window.fbDoc(window.db, "user_notifications", m.uid);
    window.fbGetDoc && window.fbGetDoc(notifDoc).then(function(snap){
      var existing = snap.exists() ? (snap.data().items || []) : [];
      var newItem = { id:Date.now()+"_adm", icon:icon, title:title, msg:msg, ts:Date.now(), unread:true, fromAdmin:true };
      existing.push(newItem);
      return window.fbSetDoc(notifDoc, { items: existing.slice(-60), uid:m.uid, email:m.email });
    }).then(function(){
      showToast("✅ Notification envoyée à "+m.pseudo+" !");
      if(typeof saveToAdminLog==="function") saveToAdminLog({ icon:icon, title:"[Perso → "+m.pseudo+"] "+title, msg:msg, targetRole:"membre", channel:"push", ts:Date.now(), fromAdmin:true });
      document.getElementById("_vpNotifTitle").value="";
      document.getElementById("_vpNotifMsg").value="";
      _vpLoadNotifHistory(m.uid, m.email);
    }).catch(function(err){ showToast("❌ "+err.message); });
  } else {
    // Fallback : log admin seulement
    if(typeof saveToAdminLog==="function") saveToAdminLog({ icon:icon, title:title, msg:msg, targetRole:"membre", channel:"push", ts:Date.now(), fromAdmin:true });
    showToast("✅ Notification journalisée (Firebase non dispo)");
  }
}
window._vpSendPersonalNotif = _vpSendPersonalNotif;

// ── Charger l'historique notifs d'un membre depuis Firebase ───
function _vpLoadNotifHistory(uid, email){
  var container = document.getElementById("_vpNotifHistory");
  if(!container) return;
  if(!window.db || !window.fbDoc || !window.fbGetDoc || !uid){
    container.innerHTML = '<div style="text-align:center;padding:0.7rem;color:var(--muted);font-size:0.73rem;">Connectez Firebase pour voir l\'historique</div>';
    return;
  }
  var docRef = window.fbDoc(window.db, "user_notifications", uid);
  window.fbGetDoc(docRef).then(function(snap){
    if(!snap.exists() || !(snap.data().items||[]).length){
      container.innerHTML = '<div style="text-align:center;padding:0.7rem;color:var(--muted);font-size:0.73rem;">📭 Aucune notification</div>';
      return;
    }
    var items = (snap.data().items||[]).slice().reverse().slice(0,10);
    var h = '';
    items.forEach(function(n){
      var ago = typeof timeAgo==="function" ? timeAgo(n.ts) : new Date(n.ts).toLocaleString("fr-FR");
      h += '<div style="display:flex;align-items:flex-start;gap:0.5rem;padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.04);">'
        + '<span style="font-size:1rem;flex-shrink:0;">'+n.icon+'</span>'
        + '<div style="flex:1;min-width:0;">'
        + '<div style="font-size:0.75rem;font-weight:700;color:'+(n.unread?'var(--text)':'var(--muted)')+';white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escHtml(n.title)+'</div>'
        + (n.msg ? '<div style="font-size:0.65rem;color:var(--muted);">'+escHtml(n.msg)+'</div>' : '')
        + '<div style="font-size:0.58rem;color:rgba(255,255,255,0.28);margin-top:0.1rem;">'+ago+(n.fromAdmin?' · <span style="color:var(--amber);">Admin</span>':'')+'</div>'
        + '</div>'
        + (n.unread ? '<div style="width:6px;height:6px;border-radius:50%;background:var(--pink);flex-shrink:0;margin-top:0.2rem;"></div>' : '')
        + '</div>';
    });
    container.innerHTML = h;
  }).catch(function(){
    container.innerHTML = '<div style="text-align:center;padding:0.7rem;color:var(--muted);font-size:0.73rem;">Impossible de charger</div>';
  });
}

// ── Reset MDP depuis le profil ─────────────────────────────────
function _vpResetMemberPwd(){
  var m = window._editingMember;
  if(!m) return;
  resetMemberPassword(m.uid, m.email, m.pseudo, null);
}
window._vpResetMemberPwd = _vpResetMemberPwd;

// ── Switcher d'onglets du profil ──────────────────────────────
function _vpSwitchTab(tab){
  ["infos","notifs","actions"].forEach(function(t){
    var pane = document.getElementById("_vpPane_"+t);
    var btn  = document.getElementById("_vpTab_"+t);
    if(pane){ pane.style.display = (t===tab?"block":"none"); }
    if(btn){
      btn.style.background = (t===tab?"var(--pink)":"transparent");
      btn.style.color = (t===tab?"#000":"var(--muted)");
    }
  });
}
window._vpSwitchTab = _vpSwitchTab;



function _profileRow(icon, label, value){
  return '<div style="display:flex;align-items:center;gap:0.7rem;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">' +
    '<span style="font-size:0.95rem;width:22px;text-align:center;flex-shrink:0;">'+icon+'</span>' +
    '<div style="flex:1;">' +
    '<div style="font-size:0.62rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.05em;">'+label+'</div>' +
    '<div style="font-size:0.82rem;color:var(--text);font-weight:500;margin-top:0.08rem;">'+escHtml(String(value))+'</div>' +
    '</div></div>';
}

function closeUserProfile(){
  var el = document.getElementById("_userProfileWrap");
  if(el) el.remove();
}

window.openUserProfile  = openUserProfile;
window.closeUserProfile = closeUserProfile;

// ── Modal pour assigner un établissement à un utilisateur ─────────
function openAssignEtabModal(uid, email, pseudo){
  if(!isAdmin){ showToast('Accès admin requis'); return; }
  // Établissements sans propriétaire assigné (ou pas d'email)
  var available = etablissements.filter(function(e){ return !(e.email && e.email.trim()); });
  if(!available.length){
    showToast('Tous les établissements ont déjà un propriétaire');
    return;
  }
  var opts = available.map(function(e){ return '<option value="'+e.id+'">'+e.nom+' ('+e.quartier+')</option>'; }).join('');
  var html =
    '<div style="position:fixed;inset:0;z-index:400;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:1rem;" id="assignEtabOverlay" onclick="if(event.target===this)closeAssignEtabModal()">' +
    '<div style="background:var(--surface);border:1px solid rgba(255,45,155,0.3);border-radius:20px;padding:1.5rem;width:min(360px,100%);position:relative;">' +
    '<div style="font-family:Syne,sans-serif;font-weight:800;color:var(--pink);font-size:1rem;margin-bottom:0.3rem;">🏠 Assigner un établissement</div>' +
    '<div style="font-size:0.75rem;color:var(--muted);margin-bottom:1rem;">À : <strong style="color:var(--text);">'+escHtml(pseudo)+' ('+escHtml(email)+')</strong></div>' +
    '<div class="field"><label>Choisir l\'établissement</label>' +
    '<select id="assignEtabSelect" style="width:100%;background:var(--surface2);border:1px solid rgba(255,45,155,0.2);border-radius:10px;color:var(--text);padding:0.65rem 0.9rem;font-family:DM Sans,sans-serif;font-size:0.88rem;">'+opts+'</select></div>' +
    '<button onclick="doAssignEtab(\''+escHtml(uid)+'\',\''+escHtml(email)+'\',\''+escHtml(pseudo)+'\')" style="width:100%;padding:0.75rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--pink),var(--cyan));color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;cursor:pointer;margin-top:0.5rem;">✅ Confirmer l\'assignation</button>' +
    '<button onclick="closeAssignEtabModal()" style="width:100%;padding:0.55rem;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--muted);font-family:DM Sans,sans-serif;font-size:0.82rem;cursor:pointer;margin-top:0.4rem;">Annuler</button>' +
    '</div></div>';
  var el = document.createElement('div');
  el.id = '_assignEtabWrap';
  el.innerHTML = html;
  document.body.appendChild(el);
}

function closeAssignEtabModal(){
  var el = document.getElementById('_assignEtabWrap');
  if(el) el.remove();
}

function doAssignEtab(uid, email, pseudo){
  var sel = document.getElementById('assignEtabSelect');
  if(!sel) return;
  var etabId = parseInt(sel.value);
  closeAssignEtabModal();
  assignEtablissementToUser(etabId, email, pseudo);
}

window.openAssignEtabModal = openAssignEtabModal;
window.closeAssignEtabModal = closeAssignEtabModal;
window.doAssignEtab = doAssignEtab;

// ══════════════════════════════════════════════════════════════════
