
/* ══════════════════════════════════════════════════════════════
   ══ PROTECTION FERMETURE / NAVIGATION ACCIDENTELLE         ══
   ══════════════════════════════════════════════════════════════
   Affiche la boîte de confirmation native du navigateur
   si l'utilisateur est connecté et tente de :
     • fermer l'onglet / la fenêtre
     • rafraîchir la page (F5, Ctrl+R)
     • naviguer vers une URL externe
   Le message affiché dépend du navigateur (non personnalisable
   pour des raisons de sécurité) mais la boîte apparaît bien.
   Le logout volontaire (bouton "Quitter") désactive la garde.
*/
(function(){
  var _guardActive = false;

  // Active la garde dès qu'un utilisateur est connecté
  function _enableGuard(){
    if(_guardActive) return;
    _guardActive = true;
    window.addEventListener('beforeunload', _onBeforeUnload);
  }

  // Désactive la garde (appelé avant signOut volontaire)
  function _disableGuard(){
    _guardActive = false;
    window.removeEventListener('beforeunload', _onBeforeUnload);
  }

  function _onBeforeUnload(e){
    if(!_guardActive) return;
    // currentUserUID est exposé par le bloc Firebase module
    if(!window.currentUserUID) return;
    e.preventDefault();
    e.returnValue = ''; // requis par Chrome / Edge
    return '';          // requis par Firefox / Safari
  }

  // Surveille la connexion dès que window.currentUserUID change
  var _guardPoll = setInterval(function(){
    if(window.currentUserUID){
      _enableGuard();
    } else {
      _disableGuard();
    }
  }, 1000);

  // Désactiver la garde avant un logout volontaire
  // On enveloppe logoutUser pour couper la garde avant signOut
  document.addEventListener('DOMContentLoaded', function(){
    var _interval = setInterval(function(){
      if(typeof window.logoutUser === 'function'){
        clearInterval(_interval);
        var _origLogout = window.logoutUser;
        window.logoutUser = function(){
          _disableGuard();
          _origLogout.apply(this, arguments);
        };
      }
    }, 500);
  });

  window._enableBeforeUnloadGuard  = _enableGuard;
  window._disableBeforeUnloadGuard = _disableGuard;
})();
