
function closeGuide(){
  document.getElementById('guideOverlay').classList.remove('show');
}
function switchGuideTab(tab){
  document.querySelectorAll('.guide-tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.guide-panel').forEach(function(p){p.classList.remove('active');});
  var idx = {how:0, roles:1, tools:2, lexique:3, superadmin:4}[tab];
  document.querySelectorAll('.guide-tab')[idx].classList.add('active');
  document.getElementById('guide-'+tab).classList.add('active');
}
function switchSaPanel(panel){
  document.querySelectorAll('.sa-sub-btn').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.sa-panel').forEach(function(p){p.classList.remove('active');});
  var panelMap={matin:0,users:1,contenu:2,paiements:3,securite:4,hebdo:5,mensuel:6,urgences:7,checklist:8};
  document.querySelectorAll('#saSubNav .sa-sub-btn')[panelMap[panel]].classList.add('active');
  var el=document.getElementById('sa-'+panel);
  if(el) el.classList.add('active');
}
function toggleSaCheck(item){
  item.classList.toggle('done');
  var box=item.querySelector('.sa-check-box');
  box.textContent=item.classList.contains('done')?'☑':'☐';
  updateSaProgress();
}
function updateSaProgress(){
  var items=document.querySelectorAll('#saChecklist .sa-check-item');
  var done=document.querySelectorAll('#saChecklist .sa-check-item.done').length;
  var prog=document.getElementById('saCheckProgress');
  if(prog) prog.textContent=done+' / '+items.length+' tâches complétées';
}
function resetSaChecklist(){
  document.querySelectorAll('#saChecklist .sa-check-item').forEach(function(item){
    item.classList.remove('done');
    item.querySelector('.sa-check-box').textContent='☐';
  });
  updateSaProgress();
}
function syncSaGuideTab(){
  var tab=document.getElementById('guide-tab-superadmin');
  if(!tab) return;
  tab.style.display=(typeof isSuperAdmin!=='undefined'&&isSuperAdmin)?'':'none';
}
(function(){
  var attempts=0;
  var timer=setInterval(function(){
    syncSaGuideTab();
    attempts++;
    if(attempts>20) clearInterval(timer);
  },500);
})();
document.addEventListener('keydown',function(e){
  if(e.key==='Escape') closeGuide();
});
