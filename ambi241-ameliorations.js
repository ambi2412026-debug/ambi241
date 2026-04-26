// ══════════════════════════════════════════
//  AMBI241 — Améliorations v2
//  1. Admin connecté sans PIN (session mémorisée)
//  2. Mot de passe oublié (email ou SMS)
//  3. Nom du membre affiché au-dessus de l'icône
// ══════════════════════════════════════════

const SUPABASE_URL = 'https://zrlxswzhmzeyuzqnjacs.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpybHhzd3pobXpleXV6cW5qYWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2MDY5MzUsImV4cCI6MjA5MjE4MjkzNX0.080TrjbUTYTtFaOuWjCCo1AoYgIVvZcFHclaN3EuDE8';

const { createClient } = supabase;
const dbAmbi = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ══════════════════════════════════════════
//  STYLES INJECTÉS
// ══════════════════════════════════════════
const styles = document.createElement('style');
styles.textContent = `
  /* Nom membre au-dessus icône connexion */
  #ambi-user-display {
    position: fixed;
    top: 8px;
    right: 60px;
    z-index: 9999;
    display: none;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  #ambi-user-name {
    font-size: 10px;
    font-weight: 700;
    color: var(--pink, #e91e8c);
    white-space: nowrap;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }
  #ambi-user-badge {
    font-size: 9px;
    color: #888;
  }

  /* Modal mot de passe oublié */
  #mdpOubliModal {
    display: none;
    position: fixed;
    inset: 0;
    z-index: 10000;
    background: rgba(0,0,0,0.8);
    backdrop-filter: blur(10px);
    align-items: center;
    justify-content: center;
  }
  #mdpOubliModal.open { display: flex; }
  #mdpOubliBox {
    background: #0f0f1e;
    border: 1px solid rgba(233,30,140,0.3);
    border-radius: 20px;
    padding: 28px 24px;
    width: 90%;
    max-width: 360px;
    animation: fadeUp 0.3s ease;
  }
  @keyframes fadeUp {
    from { opacity:0; transform:translateY(16px); }
    to   { opacity:1; transform:translateY(0); }
  }
  #mdpOubliBox h3 {
    font-size: 18px;
    font-weight: 700;
    color: #fff;
    margin-bottom: 6px;
  }
  #mdpOubliBox p {
    font-size: 13px;
    color: #888;
    margin-bottom: 20px;
    line-height: 1.5;
  }
  .mdp-tabs {
    display: flex;
    gap: 6px;
    margin-bottom: 16px;
  }
  .mdp-tab {
    flex: 1;
    padding: 8px;
    border-radius: 8px;
    border: 1px solid rgba(233,30,140,0.3);
    background: transparent;
    color: #888;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.2s;
  }
  .mdp-tab.active {
    background: #e91e8c;
    color: #fff;
    border-color: #e91e8c;
  }
  .mdp-input {
    width: 100%;
    padding: 12px 14px;
    background: #16162a;
    border: 1px solid rgba(233,30,140,0.2);
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    margin-bottom: 14px;
    outline: none;
    transition: border-color 0.2s;
  }
  .mdp-input:focus { border-color: #e91e8c; }
  .mdp-input::placeholder { color: #555; }
  .mdp-btns {
    display: flex;
    gap: 10px;
    margin-top: 4px;
  }
  .mdp-cancel {
    flex: 1;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.1);
    background: transparent;
    color: #888;
    cursor: pointer;
    font-size: 14px;
  }
  .mdp-ok {
    flex: 2;
    padding: 12px;
    border-radius: 10px;
    border: none;
    background: #e91e8c;
    color: #fff;
    font-weight: 700;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s;
  }
  .mdp-ok:hover { background: #ff4db8; }
  .mdp-msg {
    font-size: 12px;
    text-align: center;
    margin-top: 10px;
    min-height: 18px;
  }
  .mdp-msg.ok  { color: #00e5a0; }
  .mdp-msg.err { color: #ff4444; }

  /* Lien mot de passe oublié dans le modal login */
  #lienMdpOubli {
    display: block;
    text-align: center;
    font-size: 12px;
    color: #e91e8c;
    cursor: pointer;
    margin-top: 8px;
    text-decoration: underline;
  }

  /* Toast améliorations */
  #ambi-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(60px);
    background: #0f0f1e;
    border: 1px solid rgba(233,30,140,0.3);
    border-radius: 12px;
    padding: 12px 20px;
    font-size: 13px;
    color: #fff;
    z-index: 99999;
    transition: transform 0.3s ease;
    white-space: nowrap;
    pointer-events: none;
  }
  #ambi-toast.show { transform: translateX(-50%) translateY(0); }
  #ambi-toast.ok  { border-color: #00e5a0; color: #00e5a0; }
  #ambi-toast.err { border-color: #ff4444; color: #ff4444; }
`;
document.head.appendChild(styles);

// ══════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════
function ambiToast(msg, type = 'ok') {
  let t = document.getElementById('ambi-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'ambi-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className = `show ${type}`;
  setTimeout(() => t.className = '', 3000);
}

// ══════════════════════════════════════════
//  AFFICHAGE NOM UTILISATEUR
// ══════════════════════════════════════════
function creerAffichageNom() {
  if (document.getElementById('ambi-user-display')) return;
  const el = document.createElement('div');
  el.id = 'ambi-user-display';
  el.innerHTML = `
    <div id="ambi-user-name"></div>
    <div id="ambi-user-badge"></div>
  `;
  document.body.appendChild(el);
}

function afficherNomUtilisateur(profil, email) {
  creerAffichageNom();
  const el = document.getElementById('ambi-user-display');
  const nom = document.getElementById('ambi-user-name');
  const badge = document.getElementById('ambi-user-badge');

  const affichage = profil?.pseudo
    || profil?.nom_etablissement
    || profil?.prenom
    || email?.split('@')[0]
    || 'Membre';

  const role = profil?.role === 'admin' ? '👑 Admin' : '👤 Membre';

  nom.textContent = affichage;
  badge.textContent = role;
  el.style.display = 'flex';
}

function cacherNomUtilisateur() {
  const el = document.getElementById('ambi-user-display');
  if (el) el.style.display = 'none';
}

// ══════════════════════════════════════════
//  MODAL MOT DE PASSE OUBLIÉ
// ══════════════════════════════════════════
function creerModalMdpOubli() {
  if (document.getElementById('mdpOubliModal')) return;

  const modal = document.createElement('div');
  modal.id = 'mdpOubliModal';
  modal.innerHTML = `
    <div id="mdpOubliBox">
      <h3>🔑 Récupération</h3>
      <p>Choisis comment récupérer ton accès.</p>

      <div class="mdp-tabs">
        <button class="mdp-tab active" id="tabEmail" onclick="switchMdpTab('email')">
          ✉️ Email
        </button>
        <button class="mdp-tab" id="tabSms" onclick="switchMdpTab('sms')">
          📱 SMS
        </button>
      </div>

      <!-- EMAIL -->
      <div id="panelEmail">
        <input class="mdp-input" type="email" id="mdpEmail" placeholder="Ton email AMBI241"/>
      </div>

      <!-- SMS -->
      <div id="panelSms" style="display:none">
        <input class="mdp-input" type="tel" id="mdpTel" placeholder="+241 XX XX XX XX"/>
        <p style="font-size:11px;color:#666;margin-top:-8px;margin-bottom:8px;">
          ⚠️ Le numéro doit être lié à ton compte
        </p>
      </div>

      <div class="mdp-btns">
        <button class="mdp-cancel" onclick="fermerMdpOubli()">Annuler</button>
        <button class="mdp-ok" onclick="envoyerRecuperation()">Envoyer 📨</button>
      </div>
      <div class="mdp-msg" id="mdpMsg"></div>
    </div>
  `;
  document.body.appendChild(modal);

  // Fermer en cliquant dehors
  modal.addEventListener('click', (e) => {
    if (e.target === modal) fermerMdpOubli();
  });
}

window.switchMdpTab = function(tab) {
  document.getElementById('tabEmail').classList.toggle('active', tab === 'email');
  document.getElementById('tabSms').classList.toggle('active', tab === 'sms');
  document.getElementById('panelEmail').style.display = tab === 'email' ? 'block' : 'none';
  document.getElementById('panelSms').style.display   = tab === 'sms'   ? 'block' : 'none';
};

window.ouvrirMdpOubli = function() {
  creerModalMdpOubli();
  document.getElementById('mdpOubliModal').classList.add('open');
  document.getElementById('mdpMsg').textContent = '';
};

window.fermerMdpOubli = function() {
  const m = document.getElementById('mdpOubliModal');
  if (m) m.classList.remove('open');
};

window.envoyerRecuperation = async function() {
  const tabActif = document.getElementById('tabEmail').classList.contains('active') ? 'email' : 'sms';
  const msgEl = document.getElementById('mdpMsg');
  msgEl.textContent = 'Envoi en cours…';
  msgEl.className = 'mdp-msg';

  if (tabActif === 'email') {
    const email = document.getElementById('mdpEmail').value.trim();
    if (!email) { msgEl.textContent = '⚠️ Entre ton email'; msgEl.className = 'mdp-msg err'; return; }

    const { error } = await dbAmbi.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://ambi2412026-debug.github.io/ambi241/'
    });

    if (error) {
      msgEl.textContent = '❌ Email introuvable';
      msgEl.className = 'mdp-msg err';
    } else {
      msgEl.textContent = '✅ Email envoyé ! Vérifie ta boîte.';
      msgEl.className = 'mdp-msg ok';
      setTimeout(fermerMdpOubli, 3000);
    }

  } else {
    const tel = document.getElementById('mdpTel').value.trim();
    if (!tel) { msgEl.textContent = '⚠️ Entre ton numéro'; msgEl.className = 'mdp-msg err'; return; }

    const { error } = await dbAmbi.auth.signInWithOtp({
      phone: tel
    });

    if (error) {
      msgEl.textContent = '❌ Numéro introuvable ou erreur';
      msgEl.className = 'mdp-msg err';
    } else {
      msgEl.textContent = '✅ SMS envoyé ! Vérifie tes messages.';
      msgEl.className = 'mdp-msg ok';
      setTimeout(fermerMdpOubli, 3000);
    }
  }
};

// ══════════════════════════════════════════
//  LIEN "MOT DE PASSE OUBLIÉ" dans le modal login
// ══════════════════════════════════════════
function ajouterLienMdpOubli() {
  // Cherche le bouton de connexion existant
  const loginBtn = document.getElementById('loginBtn');
  if (!loginBtn) return;
  if (document.getElementById('lienMdpOubli')) return;

  const lien = document.createElement('span');
  lien.id = 'lienMdpOubli';
  lien.textContent = '🔑 Mot de passe oublié ?';
  lien.onclick = ouvrirMdpOubli;
  loginBtn.parentNode.insertBefore(lien, loginBtn.nextSibling);
}

// ══════════════════════════════════════════
//  GESTION SESSION — Admin sans PIN
// ══════════════════════════════════════════
async function verifierSessionAmbi() {
  const { data: { session } } = await dbAmbi.auth.getSession();

  if (session) {
    const { data: profil } = await dbAmbi
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    afficherNomUtilisateur(profil, session.user.email);

    // Si admin → bypass PIN automatiquement
    if (profil?.role === 'admin') {
      bypassPinAdmin();
      ambiToast('👑 Bienvenue Admin — session active', 'ok');
    }
  } else {
    cacherNomUtilisateur();
  }
}

function bypassPinAdmin() {
  // Cache le bouton PIN si présent
  const pinBtns = document.querySelectorAll('[onclick*="pin"], [onclick*="Pin"], [onclick*="PIN"]');
  pinBtns.forEach(btn => {
    if (btn.textContent.includes('Admin') || btn.textContent.includes('admin')) {
      btn.style.display = 'none';
    }
  });

  // Montre directement le contenu admin si existant
  const adminContent = document.getElementById('admin-content')
    || document.getElementById('adminContent')
    || document.getElementById('contenu-admin');
  if (adminContent) adminContent.style.display = 'block';

  // Cache le PIN overlay si existant
  const pinOverlay = document.getElementById('pinOverlay');
  if (pinOverlay) pinOverlay.style.display = 'none';
}

// Écoute les changements d'auth
dbAmbi.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    const { data: profil } = await dbAmbi
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    afficherNomUtilisateur(profil, session.user.email);

    if (profil?.role === 'admin') {
      bypassPinAdmin();
    }
  } else {
    cacherNomUtilisateur();
  }
});

// ══════════════════════════════════════════
//  DÉMARRAGE
// ══════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  verifierSessionAmbi();
  setTimeout(ajouterLienMdpOubli, 1000);
});
