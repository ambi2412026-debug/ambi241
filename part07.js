
(function(){
  function openSiteNav(){
    document.getElementById('siteNavOverlay').classList.add('open');
    document.getElementById('siteNavPanel').classList.add('open');
    var btn=document.getElementById('hamburgerBtn');
    if(btn) btn.classList.add('open');
    document.body.style.overflow='hidden';
  }
  function closeSiteNav(){
    document.getElementById('siteNavOverlay').classList.remove('open');
    document.getElementById('siteNavPanel').classList.remove('open');
    var btn=document.getElementById('hamburgerBtn');
    if(btn) btn.classList.remove('open');
    document.body.style.overflow='';
  }
  function toggleSiteNav(){
    var p=document.getElementById('siteNavPanel');
    if(p && p.classList.contains('open')) closeSiteNav();
    else openSiteNav();
  }
  function siteNavToggleSetting(key, val){
    try{ localStorage.setItem('ambi_setting_'+key, val); }catch(e){}
    if(key==='notif' && val && typeof Notification!=='undefined'){
      Notification.requestPermission();
    }
    if(typeof window.showToast==='function'){
      window.showToast('✅ Paramètre enregistré');
    }
  }
  // Expose globally
  window.openSiteNav=openSiteNav;
  window.closeSiteNav=closeSiteNav;
  window.toggleSiteNav=toggleSiteNav;
  window.siteNavToggleSetting=siteNavToggleSetting;

  // Restore saved settings on load
  document.addEventListener('DOMContentLoaded', function(){
    try{
      var notif=localStorage.getItem('ambi_setting_notif');
      var el=document.getElementById('settingNotif');
      if(el && notif==='true') el.checked=true;
    }catch(e){}
  });
  // Close on Escape key
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape') closeSiteNav();
  });
})();
