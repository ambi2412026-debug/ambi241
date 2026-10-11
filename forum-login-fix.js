// AMBI241 — Forum : active la zone de commentaire une fois connecte
(function () {
  'use strict';
  function logged() {
    var u = window.currentUserUID;
    return !!(u && String(u).indexOf('anon_') !== 0);
  }
  function fix() {
    if (!logged()) return;
    var secs = document.querySelectorAll('.forum-comments-section');
    for (var i = 0; i < secs.length; i++) {
      var sec = secs[i];
      if (sec.querySelector('textarea')) continue;
      var id = String(sec.id || '').replace(/^fcmts_/, '');
      if (!id) continue;
      var kids = sec.children, prompt = null;
      for (var k = 0; k < kids.length; k++) {
        if (kids[k].children.length === 0 && (kids[k].textContent || '').indexOf('Connectez-vous pour commenter') !== -1) { prompt = kids[k]; break; }
      }
      if (!prompt) continue;
      var row = document.createElement('div');
      row.className = 'forum-comment-input-row';
      var av = document.createElement('div');
      av.className = 'forum-card-avatar';
      av.style.cssText = 'width:28px;height:28px;font-size:0.65rem;';
      av.textContent = String(window.currentUserPseudo || window.currentUserEmail || '?').charAt(0).toUpperCase();
      var ta = document.createElement('textarea');
      ta.className = 'forum-comment-input';
      ta.id = 'fcmt_inp_' + id;
      ta.placeholder = 'Votre commentaire… 😊';
      ta.rows = 1;
      ta.addEventListener('input', function () { this.style.height = 'auto'; this.style.height = this.scrollHeight + 'px'; });
      var bt = document.createElement('button');
      bt.className = 'forum-comment-send';
      bt.textContent = '➤';
      bt.addEventListener('click', (function (pid) {
        return function () { if (typeof window.forumSendComment === 'function') window.forumSendComment(pid); };
      })(id));
      row.appendChild(av); row.appendChild(ta); row.appendChild(bt);
      sec.replaceChild(row, prompt);
    }
  }
  setInterval(fix, 1500);
})();
