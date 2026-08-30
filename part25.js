
/* ══════════════════════════════════════════════════════════
   FIX ONGLET CONTENU — Script autonome (hors IIFE)
   Définit renderAdmContent comme fonction globale directe,
   indépendante de tout bloc IIFE potentiellement défaillant.
   ══════════════════════════════════════════════════════════ */
window.renderAdmContent = function() {
  var panel = document.getElementById('adminContentPanel');
  if (!panel) return;
  var CK = 'ambi241_content_v1';
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(CK) || '{}'); } catch(e) {}
  function g(k, def) { return saved[k] !== undefined ? saved[k] : def; }
  function field(label, id, val, type) {
    var safe = String(val || '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    var inp = type === 'textarea'
      ? '<textarea id="cc_' + id + '" rows="2" style="width:100%;background:#2c1040;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff0f8;padding:0.45rem;font-size:0.78rem;font-family:DM Sans,sans-serif;resize:vertical;">' + safe + '</textarea>'
      : '<input id="cc_' + id + '" type="text" value="' + safe + '" style="width:100%;background:#2c1040;border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff0f8;padding:0.42rem 0.6rem;font-size:0.78rem;">';
    return '<div style="margin-bottom:0.55rem;"><div style="font-size:0.62rem;color:#b088c0;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:0.2rem;">' + label + '</div>' + inp + '</div>';
  }
  function tog(label, id, val) {
    var on = val ? 'checked' : '';
    var bg = val ? 'background:#00ffaa;' : '';
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:0.35rem 0;border-bottom:1px solid rgba(255,255,255,0.04);margin-bottom:0.3rem;">'
      + '<span style="font-size:0.78rem;color:#fff0f8;">' + label + '</span>'
      + '<label class="notif-toggle"><input type="checkbox" id="cc_' + id + '" ' + on + '>'
      + '<span class="notif-toggle-slider" style="' + bg + '"></span></label></div>';
  }
  function section(title, color, body) {
    return '<div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:0.9rem;margin-bottom:0.9rem;">'
      + '<div style="font-family:Syne,sans-serif;font-weight:800;color:' + color + ';font-size:0.82rem;margin-bottom:0.7rem;">' + title + '</div>'
      + body + '</div>';
  }
  var h = '';
  h += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">'
     + '<div style="font-family:Syne,sans-serif;font-weight:800;color:#ff2d9b;font-size:0.95rem;">&#128203; Gestion du Contenu</div>'
     + '<button onclick="window._admContentSave()" style="padding:0.42rem 0.9rem;border-radius:10px;border:none;background:linear-gradient(135deg,#00ffaa,#00e5ff);color:#000;font-family:Syne,sans-serif;font-weight:800;font-size:0.78rem;cursor:pointer;">&#128190; Sauver</button>'
     + '</div>';
  h += section('&#127968; Page d\'accueil', '#ff2d9b',
    field('Titre principal',   'hero_title',    g('hero_title',    'Trouvez l\'ambiance à Libreville'), 'text') +
    field('Sous-titre',        'hero_subtitle', g('hero_subtitle', 'Bars, Restaurants, Clubs — en temps réel'), 'text') +
    field('Bouton CTA',        'hero_cta',      g('hero_cta',      'Explorer maintenant'), 'text') +
    field('Message bienvenue', 'welcome_msg',   g('welcome_msg',   ''), 'textarea')
  );
  h += section('&#128226; Bannière Flash', '#ffd700',
    tog('Bannière active', 'banner_active', g('banner_active', false)) +
    field('Texte bannière', 'banner_text', g('banner_text', ''), 'text')
  );
  h += section('&#128227; Annonce Admin', '#00e5ff',
    tog('Annonce visible', 'annonce_active', g('annonce_active', false)) +
    field('Titre annonce',      'annonce_titre', g('annonce_titre', ''), 'text') +
    field('Corps du message',   'annonce_texte', g('annonce_texte', ''), 'textarea')
  );
  h += section('&#127912; Identité App', '#cc44ff',
    field('Nom de l\'app',  'appname',     g('appname',     'AMBI241'), 'text') +
    field('Pied de page',   'footer_text', g('footer_text', '© 2026 AMBI241'), 'text')
  );
  h += section('&#128222; Contact &amp; Réseaux', '#00ffaa',
    field('Email',     'contact_email',     g('contact_email',     'ambi2412026@gmail.com'), 'text') +
    field('WhatsApp',  'contact_whatsapp',  g('contact_whatsapp',  ''), 'text') +
    field('Instagram', 'reseaux_instagram', g('reseaux_instagram', ''), 'text') +
    field('Facebook',  'reseaux_facebook',  g('reseaux_facebook',  ''), 'text') +
    field('TikTok',    'reseaux_tiktok',    g('reseaux_tiktok',    ''), 'text')
  );
  h += '<div style="background:rgba(204,68,255,0.05);border:1px solid rgba(204,68,255,0.25);border-radius:14px;padding:0.9rem;margin-bottom:0.9rem;">'
     + '<div style="font-family:Syne,sans-serif;font-weight:800;color:#cc44ff;font-size:0.82rem;margin-bottom:0.6rem;">&#128221; Publications membres</div>'
     + '<div id="admPubSub" style="font-size:0.75rem;color:#b088c0;margin-bottom:0.5rem;">Cliquez pour charger</div>'
     + '<button onclick="window._loadAdmPubs&&window._loadAdmPubs()" style="width:100%;padding:0.4rem;border-radius:8px;border:1px solid rgba(204,68,255,0.3);background:rgba(204,68,255,0.06);color:#cc44ff;font-size:0.75rem;cursor:pointer;font-family:DM Sans,sans-serif;">↻ Charger les publications</button>'
     + '</div>';
  panel.innerHTML = h;
};

/* Assurer aussi la fonction save si l'IIFE a échoué */
if (typeof window._admContentSave !== 'function') {
  window._admContentSave = function() {
    var CK = 'ambi241_content_v1';
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem(CK) || '{}'); } catch(e) {}
    ['hero_title','hero_subtitle','hero_cta','welcome_msg',
     'banner_active','banner_text','annonce_active','annonce_titre','annonce_texte',
     'appname','footer_text','contact_email','contact_whatsapp',
     'reseaux_instagram','reseaux_facebook','reseaux_tiktok'].forEach(function(k) {
      var el = document.getElementById('cc_' + k);
      if (!el) return;
      saved[k] = el.type === 'checkbox' ? el.checked : el.value;
    });
    try { localStorage.setItem(CK, JSON.stringify(saved)); } catch(e) {}
    if (typeof showToast === 'function') showToast('\u2705 Contenu sauvegard\u00e9 !');
  };
}

/* Pré-rendu immédiat dès que le script s'exécute */
(function() {
  var p = document.getElementById('adminContentPanel');
  if (p) window.renderAdmContent();
})();

/* Patch switchAdmTab pour garantir le rendu à chaque clic */
(function() {
  var _prev = window.switchAdmTab;
  window.switchAdmTab = function(tab) {
    if (typeof _prev === 'function') _prev(tab);
    if (tab === 'content') {
      setTimeout(function() { window.renderAdmContent(); }, 50);
    }
  };
})();
