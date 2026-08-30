
(function(){
  // ── Coordonnées de secours pour les lieux sans lat/lng (quartiers Libreville) ──
  var QUARTIER_COORDS = {
    "Centre-ville":  [0.4302, 9.4203],
    "Louis":         [0.4113, 9.4322],
    "Glass":         [0.3750, 9.4565],
    "Akanda":        [0.5070, 9.3990],
    "Awendje":       [0.3870, 9.4750],
    "Montagne Sainte":[0.4020, 9.4380],
    "Batterie IV":   [0.4490, 9.4410],
    "Akebe":         [0.3960, 9.4530],
    "PK5":           [0.4210, 9.4620],
    "Nombakele":     [0.4580, 9.4180],
    "Sotega":        [0.3920, 9.4690]
  };
  var DEFAULT_CENTER = [0.4162, 9.4330]; // Libreville centre

  var _map = null;
  var _markers = [];
  var _userMarker = null;

  // ── Couleur selon statut ──
  function getColor(etab){
    var s = (etab.statut||"").toLowerCase();
    if(s.indexOf("bonde")>-1) return "#ff4466";
    if(s.indexOf("anime")>-1 || s.indexOf("animé")>-1) return "#00ffaa";
    if(s.indexOf("calme")>-1) return "#ffd700";
    return "#b088c0";
  }

  // ── Icône SVG personnalisée ──
  function makeIcon(color, size){
    size = size || 32;
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="'+size+'" height="'+(size*1.3)+'">'
      + '<filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      + '<ellipse cx="20" cy="48" rx="8" ry="3" fill="rgba(0,0,0,0.3)"/>'
      + '<path d="M20 2 C10 2 3 9 3 18 C3 30 20 50 20 50 C20 50 37 30 37 18 C37 9 30 2 20 2Z" fill="'+color+'" filter="url(#glow)" stroke="rgba(255,255,255,0.4)" stroke-width="1.5"/>'
      + '<circle cx="20" cy="18" r="8" fill="rgba(0,0,0,0.35)"/>'
      + '<text x="20" y="22" text-anchor="middle" font-size="10" fill="white" font-family="sans-serif">🎵</text>'
      + '</svg>';
    return L.divIcon({
      className: "",
      html: svg,
      iconSize: [size, size*1.3],
      iconAnchor: [size/2, size*1.3],
      popupAnchor: [0, -(size*1.3)-4]
    });
  }

  // ── Popup HTML pour un établissement ──
  function makePopup(e){
    var color = getColor(e);
    var statut = (e.statut||"Inconnu").replace("Ouvert - ","");
    var bar = "";
    if(e.affluence){
      var pct = Math.min(100, e.affluence);
      bar = '<div style="margin:6px 0 2px;background:rgba(255,255,255,0.1);border-radius:4px;height:5px;overflow:hidden;">'
          + '<div style="width:'+pct+'%;height:100%;background:'+color+';border-radius:4px;transition:width 0.4s;"></div></div>'
          + '<div style="font-size:10px;color:#b088c0;">Affluence : '+pct+'%</div>';
    }
    var stars = "";
    if(e.note){ for(var i=0;i<5;i++) stars += i < Math.round(e.note) ? "★" : "☆"; }
    var mapsBtn = e.maps_url
      ? '<a href="'+e.maps_url+'" target="_blank" style="display:inline-block;margin-top:8px;padding:5px 12px;border-radius:20px;background:'+color+';color:#000;font-size:11px;font-weight:800;text-decoration:none;font-family:Syne,sans-serif;">📍 Ouvrir Maps</a>'
      : "";
    return '<div style="min-width:180px;font-family:DM Sans,sans-serif;">'
      + '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:14px;color:'+color+';margin-bottom:3px;">'+e.nom+'</div>'
      + '<div style="font-size:11px;color:#b088c0;margin-bottom:4px;">'+e.type+' · '+e.quartier+'</div>'
      + '<div style="display:inline-block;padding:2px 8px;border-radius:10px;background:'+color+'22;color:'+color+';font-size:11px;font-weight:700;border:1px solid '+color+'55;">'+statut+'</div>'
      + (stars ? '<div style="color:'+color+';font-size:13px;margin-top:4px;">'+stars+' <span style="color:#b088c0;font-size:10px;">('+e.avis+' avis)</span></div>' : '')
      + bar
      + mapsBtn
      + '</div>';
  }

  // ── Initialiser la carte ──
  function initMap(){
    if(_map) return;
    _map = L.map("ambi241Map", {
      center: DEFAULT_CENTER,
      zoom: 13,
      zoomControl: true,
      attributionControl: false
    });

    // Tuiles dark OpenStreetMap via CartoDB Positron Dark
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
      subdomains: "abcd"
    }).addTo(_map);

    // Attribution discrète
    L.control.attribution({position:"bottomright"}).addTo(_map);
    _map.attributionControl.addAttribution('© <a href="https://www.openstreetmap.org/copyright" style="color:#b088c0">OpenStreetMap</a>');
  }

  // ── Placer les marqueurs ──
  function renderMapMarkers(liste){
    if(!_map) return;
    // Supprimer anciens marqueurs
    _markers.forEach(function(m){ _map.removeLayer(m); });
    _markers = [];

    var bounds = [];
    liste.forEach(function(e){
      var lat = e.lat;
      var lng = e.lng;
      // Fallback quartier si pas de coords
      if(!lat || !lng){
        var qc = QUARTIER_COORDS[e.quartier];
        if(qc){
          // Léger décalage aléatoire pour éviter la superposition
          lat = qc[0] + (Math.random()-0.5)*0.008;
          lng = qc[1] + (Math.random()-0.5)*0.008;
        } else {
          lat = DEFAULT_CENTER[0] + (Math.random()-0.5)*0.02;
          lng = DEFAULT_CENTER[1] + (Math.random()-0.5)*0.02;
        }
      }
      var color = getColor(e);
      var marker = L.marker([lat, lng], { icon: makeIcon(color, 30) })
        .addTo(_map)
        .bindPopup(makePopup(e), {
          maxWidth: 240,
          className: "ambi-popup"
        });
      _markers.push(marker);
      bounds.push([lat, lng]);
    });

    if(bounds.length > 0){
      try{ _map.fitBounds(bounds, {padding:[32,32], maxZoom:15}); }catch(e){}
    }
    // Forcer le recalcul de la taille (fix affichage incomplet)
    setTimeout(function(){ if(_map) _map.invalidateSize(); }, 120);
  }

  // ── Position utilisateur ──
  function showUserOnMap(){
    if(!navigator.geolocation || !_map) return;
    navigator.geolocation.getCurrentPosition(function(pos){
      var lat = pos.coords.latitude, lng = pos.coords.longitude;
      var userIcon = L.divIcon({
        className:"",
        html:'<div style="width:18px;height:18px;border-radius:50%;background:#00e5ff;border:3px solid #fff;box-shadow:0 0 14px rgba(0,229,255,0.8);"></div>',
        iconSize:[18,18], iconAnchor:[9,9]
      });
      if(_userMarker) _map.removeLayer(_userMarker);
      _userMarker = L.marker([lat, lng], {icon: userIcon})
        .addTo(_map)
        .bindPopup('<div style="font-family:DM Sans,sans-serif;font-size:12px;color:#00e5ff;font-weight:700;">📍 Vous êtes ici</div>');
    }, null, {timeout:6000});
  }

  // ── Ouvrir la carte depuis le toggle de vue ──
  window.openAmbiMap = function(){
    var container = document.getElementById("mapContainer");
    var list = document.getElementById("mainList");
    if(!container || !list) return;
    container.style.display = "block";
    list.style.display = "none";
    if(typeof L === "undefined"){
      var tries = 0;
      var waitL = setInterval(function(){
        tries++;
        if(typeof L !== "undefined"){ clearInterval(waitL); _doOpenMap(); }
        else if(tries > 20){ clearInterval(waitL); container.innerHTML = '<div style="color:#b088c0;text-align:center;padding:2rem;font-family:DM Sans,sans-serif;">⚠️ Impossible de charger la carte.<br><small>Vérifiez votre connexion.</small></div>'; }
      }, 150);
    } else {
      _doOpenMap();
    }
  };

  function _doOpenMap(){
    initMap();
    window._ambiMapReady = true;
    var data = (typeof filterData === "function") ? filterData() : (window.etablissements || []);
    renderMapMarkers(data);
    showUserOnMap();
    setTimeout(function(){ if(_map){ _map.invalidateSize(); } }, 200);
    setTimeout(function(){ if(_map){ _map.invalidateSize(); } }, 600);
  }
  window._renderMapMarkers = renderMapMarkers;

  window.closeAmbiMap = function(){
    var container = document.getElementById("mapContainer");
    var list = document.getElementById("mainList");
    if(container) container.style.display = "none";
    if(list) list.style.display = "block";
  };

  // ── Styles popup Leaflet dark ──
  var style = document.createElement("style");
  style.textContent = [
    ".leaflet-popup-content-wrapper{background:rgba(19,0,32,0.97)!important;border:1px solid rgba(255,45,155,0.35)!important;border-radius:16px!important;box-shadow:0 8px 32px rgba(0,0,0,0.7),0 0 20px rgba(255,45,155,0.15)!important;color:#fff0f8!important;}",
    ".leaflet-popup-tip{background:rgba(19,0,32,0.97)!important;}",
    ".leaflet-popup-close-button{color:#b088c0!important;font-size:18px!important;top:8px!important;right:10px!important;}",
    ".leaflet-popup-close-button:hover{color:#ff2d9b!important;}",
    ".leaflet-control-zoom a{background:rgba(19,0,32,0.95)!important;border:1px solid rgba(255,45,155,0.3)!important;color:#ff2d9b!important;}",
    ".leaflet-control-zoom a:hover{background:rgba(255,45,155,0.15)!important;}",
    ".leaflet-bar{border:none!important;box-shadow:0 4px 16px rgba(0,0,0,0.5)!important;}",
    ".leaflet-tile-pane{filter:brightness(0.92) saturate(0.8);}",
    "#ambi241Map .leaflet-control-attribution{background:rgba(13,0,20,0.85)!important;color:#b088c0!important;font-size:9px!important;}"
  ].join("");
  document.head.appendChild(style);

})();

// ── Intercepter le changement de vue pour déclencher la carte ──
(function(){
  document.addEventListener("click", function(e){
    var vb = e.target.closest("[data-view]");
    if(vb && vb.getAttribute("data-view") === "carte"){
      setTimeout(function(){ if(_map) _map.invalidateSize(); }, 350);
    }
  });
})();
