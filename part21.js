
// ── Photos par défaut Admin dans onglet Config App ──
(function(){
  var _orig = window.switchAdmTab;
  window.switchAdmTab = function(tab){
    if(typeof _orig === 'function') _orig(tab);
    if(tab === 'appconfig'){
      var el = document.getElementById('adminDefaultPhotosSection');
      if(el && typeof renderAdminDefaultPhotosSection === 'function'){
        if(typeof loadAdminDefaultPhotos === 'function'){
          loadAdminDefaultPhotos(function(){ el.innerHTML = renderAdminDefaultPhotosSection(); });
        } else {
          el.innerHTML = renderAdminDefaultPhotosSection();
        }
      }
    }
  };
})();
