
// On injecte dynamiquement le div sec-profil dans le conteneur principal
(function(){
  var container = document.getElementById('sec-contacts');
  if(!container) return;
  var div = document.createElement('div');
  div.id = 'sec-profil';
  div.className = 'section-hidden';
  div.innerHTML = `
<!-- HIDDEN FILE INPUTS PROFIL -->
<input type="file" id="pFileAvatar"  accept="image/*" onchange="pHandleAvatarUpload(this)" style="display:none">
<input type="file" id="pFileCover"   accept="image/*" onchange="pHandleCoverUpload(this)"  style="display:none">
<input type="file" id="pFileGallery" accept="image/*" multiple onchange="pHandleGalleryUpload(this)" style="display:none">

<!-- ÉCRAN VISITEUR — 3 cartes d'inscription -->
<div id="profil-visitor-screen">
  <div class="pvs-title">Créez votre profil</div>
  <div class="pvs-sub">Choisissez votre type de compte pour rejoindre la communauté AMBI241</div>
  <div class="pvs-cards">

    <div class="pvs-card c-membre" onclick="openRegistrationForRole('membre')">
      <div class="pvs-card-icon">👤</div>
      <div class="pvs-card-body">
        <div class="pvs-card-title">Simple Membre</div>
        <div class="pvs-card-desc">Découvrez les lieux, suivez l'ambiance en direct, commentez et notez les établissements.</div>
      </div>
      <span class="pvs-card-arrow">›</span>
    </div>

    <div class="pvs-card c-chauffeur" onclick="openRegistrationForRole('chauffeur')">
      <div class="pvs-card-icon">🚕</div>
      <div class="pvs-card-body">
        <div class="pvs-card-title">Chauffeur</div>
        <div class="pvs-card-desc">Enregistrez-vous comme chauffeur partenaire, gérez vos courses et recevez des clients.</div>
      </div>
      <span class="pvs-card-arrow">›</span>
    </div>

    <div class="pvs-card c-gerant" onclick="openRegistrationForRole('gerant')">
      <div class="pvs-card-icon">🏛️</div>
      <div class="pvs-card-body">
        <div class="pvs-card-title">Gérant d'Établissement</div>
        <div class="pvs-card-desc">Référencez votre bar, restaurant ou club, gérez votre profil et suivez vos statistiques.</div>
      </div>
      <span class="pvs-card-arrow">›</span>
    </div>

  </div>
  <div class="pvs-login-link">
    Déjà inscrit ?
    <button onclick="openLoginFromProfil()">Se connecter</button>
  </div>
</div>

<!-- SÉLECTEUR DE RÔLE -->
<div class="demo-nav-profil">
  <button class="demo-tab-profil active" data-role="membre"   onclick="pSwitchRole('membre')">👤 Membre</button>
  <button class="demo-tab-profil"        data-role="chauffeur" onclick="pSwitchRole('chauffeur')">🚕 Chauffeur</button>
  <button class="demo-tab-profil"        data-role="etab"      onclick="pSwitchRole('etab')">🏛️ Établissement</button>
</div>

<div class="profil-views">

<!-- VUE MEMBRE -->
<div id="pv-membre" class="profil-view active">
  <div class="profile-shell">
    <div class="cover" id="pcov-membre">
      <div style="width:100%;height:100%;background:linear-gradient(135deg,#1a0a28 0%,#2c1040 40%,#0d1a3a 100%);display:flex;align-items:center;justify-content:center;font-size:4rem;opacity:.3;">🌃</div>
      <div class="cover-overlay"></div>
      <label class="cover-edit-btn" for="pFileCover" style="cursor:pointer;">📷 Modifier</label>
    </div>
    <div class="avatar-zone">
      <div class="avatar-wrap">
        <div class="p-avatar" id="pav-membre" onclick="pOpenEditModal('membre')" style="background:linear-gradient(135deg,#230d35,#1a0a28);color:#00e5ff;">
          <span id="pav-membre-initials">?</span>
          <label class="avatar-upload-btn" for="pFileAvatar" style="cursor:pointer;" onclick="event.stopPropagation()">📷</label>
          <div class="avatar-status-dot"></div>
        </div>
      </div>
      <div class="avatar-meta">
        <span class="p-role-badge rb-membre"><span class="rb-dot"></span>Membre Premium</span>
      </div>
    </div>
    <div class="profile-header">
      <div class="profile-name" id="pv-membre-name">— <span class="verified-icon vi-cyan" title="Compte vérifié">✓</span></div>
      <div class="profile-handle" id="pv-membre-handle"><span>@—</span><span class="handle-sep">·</span><span>Libreville, Gabon</span></div>
      <p class="profile-bio" style="font-style:italic;opacity:0.5;">✏️ Complétez votre bio dans Mon Profil</p>
      <div class="profile-tags" id="pv-membre-tags"></div>
    </div>
    <div class="profile-actions">
      <button class="btn-p-primary btn-p-edit" onclick="pOpenEditModal('membre')">✏️ Modifier le profil</button>
      <button class="btn-p-outline">🔗 Partager</button>
      <button class="btn-p-outline">⋯</button>
    </div>
    <div class="stats-row stats-row-4">
      <div class="stat-cell"><div class="stat-val">142</div><div class="stat-lbl">Sorties</div></div>
      <div class="stat-cell"><div class="stat-val">38</div><div class="stat-lbl">Avis</div></div>
      <div class="stat-cell"><div class="stat-val">2.1k</div><div class="stat-lbl">Abonnés</div></div>
      <div class="stat-cell"><div class="stat-val">87</div><div class="stat-lbl">Favoris</div></div>
    </div>
    <!-- ONGLETS COMPTE COMPLET -->
    <div style="margin-top:1rem;">
      <div class="section-tabs-p" style="overflow-x:auto;scrollbar-width:none;display:flex;gap:0.3rem;padding:0 1rem;">
        <button class="stab-p active" onclick="pMembreTab(this,'profil')" style="white-space:nowrap;">📋 Profil</button>
        <button class="stab-p" onclick="pMembreTab(this,'photos')" style="white-space:nowrap;">📸 Photos</button>
        <button class="stab-p" onclick="pMembreTab(this,'amis')" style="white-space:nowrap;">👥 Amis <span id="pm-count-amis" style="background:rgba(0,229,255,0.18);color:#00e5ff;font-size:0.6rem;padding:0.08rem 0.35rem;border-radius:10px;margin-left:0.2rem;">0</span></button>
        <button class="stab-p" onclick="pMembreTab(this,'demandes')" style="white-space:nowrap;">🔔 Demandes <span id="pm-count-demandes" style="display:none;background:rgba(255,45,155,0.2);color:var(--pink);font-size:0.6rem;padding:0.08rem 0.35rem;border-radius:10px;margin-left:0.2rem;" id="pm-badge-demandes">0</span></button>
        <button class="stab-p" onclick="pMembreTab(this,'infos')" style="white-space:nowrap;">ℹ️ Infos</button>
        <button class="stab-p" onclick="pMembreTab(this,'activite')" style="white-space:nowrap;">⚡ Activité</button>
        <button class="stab-p" onclick="pMembreTab(this,'prefs')" style="white-space:nowrap;">⚙️ Préférences</button>
      </div>
    </div>

    <!-- TAB: PROFIL -->
    <div id="pm-tab-profil">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">🔥 Spots favoris</span><button class="section-action">Voir tout</button></div>
        <div class="fav-scroll" id="pv-membre-favs">
          <div style="text-align:center;padding:1.2rem;color:var(--muted);font-size:0.78rem;font-style:italic;min-width:200px;">Aucun favori enregistré.</div>
        </div>
      </div>
    </div>

    <!-- TAB: PHOTOS -->
    <div id="pm-tab-photos" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">📸 Ma galerie</span><label class="section-action" for="pFileGallery" style="cursor:pointer;">+ Ajouter</label></div>
        <div class="gallery-grid" id="pgallery-membre">
          <label class="gallery-add" for="pFileGallery" style="cursor:pointer;">＋</label>
        </div>
      </div>
    </div>

    <!-- TAB: AMIS -->
    <div id="pm-tab-amis" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">👥 Mes amis</span></div>
        <div id="pm-amis-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
          <!-- Chargé dynamiquement depuis _friends -->
          <div style="text-align:center;padding:2rem 1rem;color:var(--muted);font-size:0.8rem;" id="pm-amis-empty">
            <span style="font-size:2rem;display:block;margin-bottom:0.5rem;">👥</span>
            Aucun ami pour l'instant.<br>Rejoignez la communauté !
          </div>
        </div>
      </div>
      <div class="p-section-block" style="margin-top:1rem;">
        <div class="section-head"><span class="section-title">🔍 Trouver des amis</span></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.6rem;">
          <input id="pm-friend-search" type="text" placeholder="Pseudo ou email…" oninput="pmSearchFriend(this.value)"
            style="flex:1;padding:0.55rem 0.75rem;border-radius:10px;border:1px solid rgba(0,229,255,0.25);background:rgba(0,229,255,0.04);color:var(--text);font-family:'DM Sans',sans-serif;font-size:0.8rem;outline:none;">
          <button onclick="pmSendFriendRequest()" style="padding:0.55rem 0.9rem;border-radius:10px;background:rgba(0,229,255,0.12);border:1.5px solid rgba(0,229,255,0.35);color:#00e5ff;font-weight:800;font-size:0.78rem;cursor:pointer;font-family:'DM Sans',sans-serif;">Ajouter</button>
        </div>
        <div id="pm-friend-results" style="margin-top:0.5rem;"></div>
      </div>
    </div>

    <!-- TAB: DEMANDES -->
    <div id="pm-tab-demandes" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">📨 Demandes reçues</span></div>
        <div id="pm-demandes-in-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
          <div style="text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:0.8rem;" id="pm-demandes-empty">
            <span style="font-size:1.8rem;display:block;margin-bottom:0.4rem;">📭</span>
            Aucune demande en attente
          </div>
        </div>
      </div>
      <div class="p-section-block" style="margin-top:1rem;">
        <div class="section-head"><span class="section-title">📤 Demandes envoyées</span></div>
        <div id="pm-demandes-out-list" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;">
          <div style="text-align:center;padding:1.5rem 1rem;color:var(--muted);font-size:0.8rem;">Aucune demande envoyée</div>
        </div>
      </div>
    </div>

    <!-- TAB: INFOS -->
    <div id="pm-tab-infos" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">ℹ️ Informations du compte</span><button class="section-action" onclick="pOpenEditModal('membre')">Modifier</button></div>
        <div style="display:flex;flex-direction:column;gap:0.55rem;margin-top:0.6rem;">
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;">
            <span style="font-size:1.1rem;flex-shrink:0;">👤</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;">Pseudo</div>
              <div id="pm-info-pseudo" style="font-size:0.82rem;font-weight:700;color:var(--text);">—</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;">
            <span style="font-size:1.1rem;flex-shrink:0;">📧</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;">Email</div>
              <div id="pm-info-email" style="font-size:0.82rem;font-weight:700;color:var(--text);">—</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;">
            <span style="font-size:1.1rem;flex-shrink:0;">📍</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;">Ville</div>
              <div style="font-size:0.82rem;font-weight:700;color:var(--text);">Libreville, Gabon</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;">
            <span style="font-size:1.1rem;flex-shrink:0;">🗓️</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;">Membre depuis</div>
              <div id="pm-info-since" style="font-size:0.82rem;font-weight:700;color:var(--text);">—</div>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;padding:0.6rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;">
            <span style="font-size:1.1rem;flex-shrink:0;">🏷️</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;">Rôle</div>
              <div id="pm-info-role" style="font-size:0.82rem;font-weight:700;color:#00e5ff;">Membre</div>
            </div>
          </div>
          <div id="pm-info-bio-block" style="display:flex;align-items:flex-start;gap:0.75rem;padding:0.6rem 0.75rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:11px;">
            <span style="font-size:1.1rem;flex-shrink:0;margin-top:0.1rem;">✏️</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:0.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.1rem;">Bio</div>
              <div id="pm-info-bio" style="font-size:0.8rem;color:var(--text);line-height:1.5;font-style:italic;opacity:0.6;">Non renseignée</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB: ACTIVITE -->
    <div id="pm-tab-activite" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">⚡ Activité récente</span></div>
        <div class="activity-list" id="pv-membre-activite-list">
          <div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;font-style:italic;">Aucune activité récente.</div>
        </div>
      </div>
    </div>

    <!-- TAB: PRÉFÉRENCES -->
    <div id="pm-tab-prefs" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">🔔 Préférences de notifications</span></div>
        <div class="notif-prefs-p">
          <div class="np-row"><div class="np-left"><div class="np-label">Spots favoris en live</div><div class="np-sub">Alerte quand un favori est très animé</div></div><label class="toggle-sm"><input type="checkbox" checked><span class="tsl"></span></label></div>
          <div class="np-row"><div class="np-left"><div class="np-label">Nouveaux événements</div><div class="np-sub">Soirées et événements proches</div></div><label class="toggle-sm"><input type="checkbox" checked><span class="tsl"></span></label></div>
          <div class="np-row"><div class="np-left"><div class="np-label">Promos exclusives</div><div class="np-sub">Offres réservées aux membres</div></div><label class="toggle-sm"><input type="checkbox" checked><span class="tsl"></span></label></div>
          <div class="np-row"><div class="np-left"><div class="np-label">Mode silencieux</div><div class="np-sub">Pas de notif entre 2h et 9h</div></div><label class="toggle-sm"><input type="checkbox" checked><span class="tsl"></span></label></div>
        </div>
      </div>
      <div class="p-section-block" style="margin-top:1rem;">
        <div class="section-head"><span class="section-title">🔒 Confidentialité</span></div>
        <div class="notif-prefs-p">
          <div class="np-row"><div class="np-left"><div class="np-label">Profil public</div><div class="np-sub">Visible par tous les membres</div></div><label class="toggle-sm"><input type="checkbox" checked><span class="tsl"></span></label></div>
          <div class="np-row"><div class="np-left"><div class="np-label">Activité visible</div><div class="np-sub">Mes sorties apparaissent dans le feed</div></div><label class="toggle-sm"><input type="checkbox"><span class="tsl"></span></label></div>
          <div class="np-row"><div class="np-left"><div class="np-label">Localisation</div><div class="np-sub">Partager ma position pour les reco</div></div><label class="toggle-sm"><input type="checkbox" checked><span class="tsl"></span></label></div>
        </div>
      </div>
    </div>

  </div>
</div>

<!-- VUE CHAUFFEUR -->
<div id="pv-chauffeur" class="profil-view">
  <div class="profile-shell">
    <div class="cover" id="pcov-chauffeur">
      <div style="width:100%;height:100%;background:linear-gradient(135deg,#1a1200 0%,#2a1e00 50%,#1a0a28 100%);display:flex;align-items:center;justify-content:center;font-size:5rem;opacity:.25;">🚕</div>
      <div class="cover-overlay"></div>
      <label class="cover-edit-btn" for="pFileCover" style="cursor:pointer;">📷 Modifier</label>
    </div>
    <div class="avatar-zone">
      <div class="avatar-wrap">
        <div class="p-avatar" id="pav-chauffeur" onclick="pOpenEditModal('chauffeur')" style="background:linear-gradient(135deg,#2a1e00,#1a0a28);color:#ffd700;">
          <span id="pav-chauffeur-initials">?</span>
          <label class="avatar-upload-btn" for="pFileAvatar" style="background:#ffd700;cursor:pointer;" onclick="event.stopPropagation()">📷</label>
          <div class="avatar-status-dot"></div>
        </div>
      </div>
      <div class="avatar-meta"><span class="p-role-badge rb-chauffeur"><span class="rb-dot"></span>Chauffeur Certifié</span></div>
    </div>
    <div class="profile-header">
      <div class="profile-name" id="pv-chauffeur-name">— <span class="verified-icon vi-gold" title="Chauffeur certifié AMBI241">✓</span></div>
      <div class="profile-handle" id="pv-chauffeur-handle"><span>Chauffeur AMBI241</span><span class="handle-sep">·</span><span>Libreville</span></div>
      <p class="profile-bio" id="pv-chauffeur-bio">Chauffeur professionnel disponible 7j/7. Confort garanti, ponctualité assurée.</p>
      <div class="profile-tags"><span class="ptag-item">🌙 Nuits</span><span class="ptag-item">✈️ Aéroport</span><span class="ptag-item">💼 Business</span><span class="ptag-item">🇬🇦 Libreville</span></div>
    </div>
    <div class="profile-actions">
      <button class="btn-p-primary" style="background:linear-gradient(135deg,#ffd700,#cc9900);color:#000;box-shadow:0 4px 20px rgba(255,215,0,.35);flex:2;" onclick="pOpenEditModal('chauffeur')">✏️ Modifier le profil</button>
      <button class="btn-p-outline">🔗 Partager</button>
    </div>
    <div class="dispo-toggle-wrap">
      <div class="dispo-left">
        <div class="dispo-title"><span class="p-dispo-dot" id="p-dispo-dot"></span><span id="p-dispo-text">Disponible</span></div>
        <div class="dispo-sub" id="p-dispo-sub">Vous recevez des demandes de course</div>
      </div>
      <label class="big-toggle"><input type="checkbox" checked id="p-dispo-toggle" onchange="pToggleDispo(this)"><span class="big-toggle-slider"></span></label>
    </div>
    <div class="stats-row stats-row-4">
      <div class="stat-cell"><div class="stat-val" id="pv-chauffeur-nb-courses">—</div><div class="stat-lbl">Courses</div></div>
      <div class="stat-cell"><div class="stat-val" id="pv-chauffeur-note">—</div><div class="stat-lbl">Note ★</div></div>
      <div class="stat-cell"><div class="stat-val" id="pv-chauffeur-acceptees">—</div><div class="stat-lbl">Acceptées</div></div>
      <div class="stat-cell"><div class="stat-val" id="pv-chauffeur-experience">—</div><div class="stat-lbl">Expérience</div></div>
    </div>
    <div class="rating-showcase" id="pv-chauffeur-rating-showcase" style="margin-top:1rem;display:none;">
      <!-- Chargé depuis Firebase -->
    </div>
    <div class="vehicle-card" id="pv-chauffeur-vehicle-card">
      <div class="vehicle-icon">🚗</div>
      <div class="vehicle-info">
        <div class="vehicle-name" id="pv-chauffeur-vehicule">—</div>
        <div class="vehicle-plate" id="pv-chauffeur-immat">—</div>
        <div class="vehicle-details" id="pv-chauffeur-couleur-details"><span id="pv-chauffeur-couleur">—</span></div>
      </div>
    </div>
    <div class="verify-banner"><span class="vb-icon">🛡️</span><div class="vb-body"><div class="vb-title">Certifié &amp; Assuré AMBI241</div><div class="vb-sub">Permis · Assurance · Antécédents vérifiés</div></div><button class="vb-btn">Voir</button></div>
    <div style="margin-top:1rem;">
      <div class="section-tabs-p">
        <button class="stab-p active" onclick="pSetStab(this,'chauffeur','trips')">Courses</button>
        <button class="stab-p" onclick="pSetStab(this,'chauffeur','avis')">Avis</button>
        <button class="stab-p" onclick="pSetStab(this,'chauffeur','compte')">Compte</button>
      </div>
    </div>
    <div id="pc-tab-trips">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">🚕 Courses récentes</span><button class="section-action" style="color:var(--amber)">Historique</button></div>
        <div class="trips-list" id="pv-chauffeur-trips-list">
          <div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;font-style:italic;">Aucune course enregistrée pour le moment.</div>
        </div>
      </div>
    </div>
    <div id="pc-tab-avis" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">💬 Avis clients</span></div>
        <div class="activity-list" id="pv-chauffeur-avis-list">
          <div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;font-style:italic;">Chargement des avis…</div>
        </div>
      </div>
    </div>
    <div id="pc-tab-compte" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">⚙️ Mon compte</span></div>
        <div class="info-list">
          <div class="info-row"><div class="info-icon">📞</div><div class="info-text"><div class="info-label">Téléphone</div><div class="info-value" id="pv-chauffeur-phone">—</div></div></div>
          <div class="info-row"><div class="info-icon">✉️</div><div class="info-text"><div class="info-label">Email</div><div class="info-value" id="pv-chauffeur-email">—</div></div></div>
          <div class="info-row"><div class="info-icon">🏦</div><div class="info-text"><div class="info-label">Paiement des gains</div><div class="info-value">Mobile Money</div></div></div>
          <div class="info-row"><div class="info-icon">📋</div><div class="info-text"><div class="info-label">Permis de conduire</div><div class="info-value" id="pv-chauffeur-permis">—</div></div></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- VUE ÉTABLISSEMENT -->
<div id="pv-etab" class="profil-view">
  <div class="profile-shell">
    <div class="cover" id="pcov-etab">
      <div style="width:100%;height:100%;background:linear-gradient(135deg,#200819 0%,#2c1040 40%,#0d1a2a 100%);display:flex;align-items:center;justify-content:center;font-size:5rem;opacity:.3;">🎷</div>
      <div class="cover-overlay"></div>
      <label class="cover-edit-btn" for="pFileCover" style="cursor:pointer;">📷 Modifier</label>
    </div>
    <div class="avatar-zone">
      <div class="avatar-wrap">
        <div class="p-avatar" id="pav-etab" onclick="pOpenEditModal('etab')" style="background:linear-gradient(135deg,#200819,#0d1a2a);color:var(--pink);border-radius:22px;">
          <span id="pav-etab-initials">—</span>
          <label class="avatar-upload-btn" for="pFileAvatar" style="cursor:pointer;" onclick="event.stopPropagation()">📷</label>
          <div class="avatar-status-dot"></div>
        </div>
      </div>
      <div class="avatar-meta"><span class="p-role-badge rb-etab"><span class="rb-dot"></span>Établissement Partenaire</span></div>
    </div>
    <div class="profile-header">
      <div class="profile-name" id="pv-etab-name">— <span class="verified-icon vi-pink" title="Établissement vérifié">✓</span></div>
      <div class="profile-handle" id="pv-etab-handle"><span>@—</span><span class="handle-sep">·</span><span>📍 Libreville</span><span class="handle-sep">·</span><span id="pv-etab-type">Établissement</span></div>
      <p class="profile-bio" id="pv-etab-bio" style="font-style:italic;opacity:0.5;">Description de l'établissement…</p>
      <div class="profile-tags" id="pv-etab-tags"><span class="ptag-item">🎷 Jazz Live</span><span class="ptag-item">🍸 Cocktails</span><span class="ptag-item">🌊 Vue Mer</span><span class="ptag-item">🅿️ Parking</span><span class="ptag-item">🎤 Scène</span></div>
    </div>
    <div class="ambiance-live">
      <div class="al-pulse">🔥</div>
      <div class="al-body"><div class="al-title">Ambiance en direct — CHAUD 🔥</div><div class="al-sub">87% de remplissage · DJ set en cours · Mise à jour il y a 12 min</div></div>
      <button class="al-btn" onclick="pShowToast('Ambiance mise à jour !')">Mettre à jour</button>
    </div>
    <div class="profile-actions">
      <button class="btn-p-primary btn-p-edit" onclick="pOpenEditModal('etab')">✏️ Modifier</button>
      <button class="btn-p-outline">📊 Stats</button>
      <button class="btn-p-outline">🔗 Partager</button>
    </div>
    <div class="stats-row stats-row-4">
      <div class="stat-cell"><div class="stat-val">4.8★</div><div class="stat-lbl">Note</div></div>
      <div class="stat-cell"><div class="stat-val">2 140</div><div class="stat-lbl">Avis</div></div>
      <div class="stat-cell"><div class="stat-val">18.3k</div><div class="stat-lbl">Vues</div></div>
      <div class="stat-cell"><div class="stat-val">876</div><div class="stat-lbl">Favoris</div></div>
    </div>
    <div class="p-section-block" style="margin-top:1rem;">
      <div class="section-head"><span class="section-title">📊 Jauges d'ambiance</span><button class="section-action">Éditer</button></div>
      <div class="ambiance-meters">
        <div class="amb-row"><div class="amb-top"><span class="amb-label">🌡️ Température</span><span class="amb-val">Chaud</span></div><div class="amb-track"><div class="amb-fill" style="width:82%;background:linear-gradient(90deg,var(--amber),var(--pink));"></div></div></div>
        <div class="amb-row"><div class="amb-top"><span class="amb-label">👥 Remplissage</span><span class="amb-val">87%</span></div><div class="amb-track"><div class="amb-fill" style="width:87%;background:linear-gradient(90deg,var(--cyan),var(--purple));"></div></div></div>
        <div class="amb-row"><div class="amb-top"><span class="amb-label">🎵 Musique</span><span class="amb-val">DJ Set Live</span></div><div class="amb-track"><div class="amb-fill" style="width:95%;background:linear-gradient(90deg,var(--pink),var(--purple));"></div></div></div>
        <div class="amb-row"><div class="amb-top"><span class="amb-label">💰 Prix</span><span class="amb-val">Moyen</span></div><div class="amb-track"><div class="amb-fill" style="width:55%;background:linear-gradient(90deg,var(--green),var(--cyan));"></div></div></div>
      </div>
    </div>
    <div style="margin-top:1rem;">
      <div class="section-tabs-p">
        <button class="stab-p active" onclick="pSetStab(this,'etab','infos')">Infos</button>
        <button class="stab-p" onclick="pSetStab(this,'etab','photos')">Photos</button>
        <button class="stab-p" onclick="pSetStab(this,'etab','avis')">Avis</button>
        <button class="stab-p" id="pe-fiches-tab-btn" onclick="pSetStab(this,'etab','fiches')" style="display:none;">📋 Fiche Pro</button>
      </div>
    </div>
    <div id="pe-tab-infos">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">⏰ Horaires d'ouverture</span><button class="section-action">Modifier</button></div>
        <div class="schedule-list">
          <div class="sch-row"><span class="sch-day">Lundi</span><span class="sch-time sch-closed">Fermé</span></div>
          <div class="sch-row"><span class="sch-day">Mardi</span><span class="sch-time">19h00 – 02h00</span></div>
          <div class="sch-row"><span class="sch-day">Mercredi</span><span class="sch-time">19h00 – 02h00</span></div>
          <div class="sch-row today"><span class="sch-day today-label">Aujourd'hui ↗</span><span class="sch-time">18h00 – 04h00 <span class="sch-open-badge">OUVERT</span></span></div>
          <div class="sch-row"><span class="sch-day">Vendredi</span><span class="sch-time">18h00 – 05h00</span></div>
          <div class="sch-row"><span class="sch-day">Samedi</span><span class="sch-time">18h00 – 05h00</span></div>
          <div class="sch-row"><span class="sch-day">Dimanche</span><span class="sch-time">18h00 – 02h00</span></div>
        </div>
      </div>
      <div class="p-section-block" style="margin-top:1rem;">
        <div class="section-head"><span class="section-title">📋 Informations</span><button class="section-action" onclick="pOpenEditModal('etab')">Modifier</button></div>
        <div class="info-list">
          <div class="info-row"><div class="info-icon">📍</div><div class="info-text"><div class="info-label">Adresse</div><div class="info-value" id="pv-etab-address">—</div></div></div>
          <div class="info-row"><div class="info-icon">📞</div><div class="info-text"><div class="info-label">Téléphone</div><div class="info-value" id="pv-etab-phone">—</div></div></div>
          <div class="info-row"><div class="info-icon">🌐</div><div class="info-text"><div class="info-label">Réseaux sociaux</div><div class="info-value" id="pv-etab-social">—</div></div></div>
          <div class="info-row"><div class="info-icon">💵</div><div class="info-text"><div class="info-label">Entrée</div><div class="info-value" id="pv-etab-entree">—</div></div></div>
          <div class="info-row"><div class="info-icon">🅿️</div><div class="info-text"><div class="info-label">Parking</div><div class="info-value" id="pv-etab-parking">—</div></div></div>
        </div>
      </div>
    </div>
    <div id="pe-tab-photos" style="display:none;">
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">📸 Galerie de l'établissement</span><label class="section-action" for="pFileGallery" style="cursor:pointer;">+ Ajouter</label></div>
        <div class="gallery-grid" id="pgallery-etab">
          <div class="gallery-item" style="background:linear-gradient(135deg,rgba(255,45,155,.35),rgba(204,68,255,.25));display:flex;align-items:center;justify-content:center;font-size:2.2rem;">🎷</div>
          <div class="gallery-item" style="background:linear-gradient(135deg,rgba(0,229,255,.25),rgba(0,255,170,.2));display:flex;align-items:center;justify-content:center;font-size:2.2rem;">🌊</div>
          <div class="gallery-item" style="background:linear-gradient(135deg,rgba(255,215,0,.2),rgba(255,45,155,.2));display:flex;align-items:center;justify-content:center;font-size:2.2rem;">🍸</div>
          <div class="gallery-item" style="background:linear-gradient(135deg,rgba(204,68,255,.3),rgba(0,229,255,.15));display:flex;align-items:center;justify-content:center;font-size:2.2rem;">🎤</div>
          <div class="gallery-item" style="background:linear-gradient(135deg,rgba(0,255,170,.2),rgba(255,215,0,.15));display:flex;align-items:center;justify-content:center;font-size:2.2rem;">🌙</div>
          <label class="gallery-add" for="pFileGallery" style="cursor:pointer;">＋</label>
        </div>
      </div>
    </div>
    <div id="pe-tab-avis" style="display:none;">
      <div class="rating-showcase" style="margin:0 1.2rem 1rem;">
        <div class="rating-top"><div class="rating-big">4.8</div><div class="rating-right"><div class="rating-stars">★★★★★</div><div class="rating-count">2 140 avis vérifiés</div><div style="font-size:.72rem;color:var(--pink);margin-top:.2rem;">🏆 Meilleur bar jazz 2024</div></div></div>
        <div class="rating-bars" id="pv-etab-rating-bars">
          <div style="text-align:center;padding:1rem;color:var(--muted);font-size:0.75rem;font-style:italic;">Statistiques chargées depuis Firebase</div>
        </div>
      </div>
      <div class="p-section-block">
        <div class="section-head"><span class="section-title">💬 Avis récents</span><button class="section-action">Tous les avis</button></div>
        <div class="activity-list" id="pv-etab-avis-list">
          <div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.8rem;font-style:italic;">Chargement des avis…</div>
        </div>
      </div>
    </div>
    <div id="pe-tab-fiches" style="display:none;">
      <!-- ═══════════════════════════════════════════════════
           FICHES SECTORIELLES — accessible depuis le Profil
           Visible uniquement Propriétaire / Admin
           ═══════════════════════════════════════════════════ -->
      <div class="p-section-block" style="margin-top:1rem;">
        <div class="section-head">
          <span class="section-title">📋 Fiches sectorielles</span>
          <button class="section-action" onclick="switchSection('fiches',null);window.scrollTo(0,0);">Plein écran →</button>
        </div>
        <div style="padding:0.6rem 1rem 0.4rem;font-size:0.72rem;color:var(--muted);line-height:1.5;">
          🔒 Espace réservé au propriétaire et à l'administration. Gérez le statut, les disponibilités, les tarifs et les services de votre établissement en temps réel.
        </div>
        <div style="padding:0.4rem 1rem 1rem;display:flex;flex-wrap:wrap;gap:0.5rem;">
          <button onclick="switchSection('fiches',null);window.scrollTo(0,0);" style="background:linear-gradient(135deg,rgba(255,45,155,0.18),rgba(204,68,255,0.14));border:1.5px solid rgba(255,45,155,0.38);color:var(--pink);font-family:Syne,sans-serif;font-weight:800;font-size:0.82rem;padding:0.75rem 1.2rem;border-radius:14px;cursor:pointer;width:100%;text-align:left;display:flex;align-items:center;gap:0.6rem;">
            ⚡ Statut en direct &amp; Affluence
          </button>
          <button onclick="switchSection('fiches',null);fShowSector('bar');window.scrollTo(0,0);" style="background:rgba(255,45,155,0.07);border:1px solid rgba(255,45,155,0.2);color:var(--text);font-size:0.75rem;padding:0.55rem 0.9rem;border-radius:10px;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;">🍺 Bar &amp; Lounge</button>
          <button onclick="switchSection('fiches',null);fShowSector('hotel');window.scrollTo(0,0);" style="background:rgba(0,229,255,0.07);border:1px solid rgba(0,229,255,0.2);color:var(--text);font-size:0.75rem;padding:0.55rem 0.9rem;border-radius:10px;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;">🏨 Hôtel</button>
          <button onclick="switchSection('fiches',null);fShowSector('resto');window.scrollTo(0,0);" style="background:rgba(255,215,0,0.07);border:1px solid rgba(255,215,0,0.2);color:var(--text);font-size:0.75rem;padding:0.55rem 0.9rem;border-radius:10px;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 40" width="1.1em" height="0.8em" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><line x1="10" y1="4" x2="10" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/><line x1="7" y1="4" x2="7" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="4" x2="13" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M7 16 Q10 20 13 16" fill="none" stroke="white" stroke-width="1.6"/><circle cx="28" cy="22" r="14" fill="none" stroke="white" stroke-width="2.2"/><circle cx="28" cy="22" r="9" fill="rgba(255,255,255,0.12)" stroke="white" stroke-width="1.2"/><circle cx="28" cy="22" r="3.5" fill="white" opacity="0.7"/><ellipse cx="46" cy="10" rx="3.5" ry="5" fill="none" stroke="white" stroke-width="2"/><line x1="46" y1="15" x2="46" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg> Restaurant</button>
          <button onclick="switchSection('fiches',null);fShowSector('club');window.scrollTo(0,0);" style="background:rgba(204,68,255,0.07);border:1px solid rgba(204,68,255,0.2);color:var(--text);font-size:0.75rem;padding:0.55rem 0.9rem;border-radius:10px;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;">🎵 Club</button>
          <button onclick="switchSection('fiches',null);fShowSector('salle');window.scrollTo(0,0);" style="background:rgba(255,149,0,0.07);border:1px solid rgba(255,149,0,0.2);color:var(--text);font-size:0.75rem;padding:0.55rem 0.9rem;border-radius:10px;cursor:pointer;font-family:DM Sans,sans-serif;font-weight:600;">🎭 Salle</button>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- MODALS ÉDITION -->
<!-- Modal Membre -->
<div class="profil-modal-overlay" id="pmodal-membre">
  <div class="profil-modal-sheet">
    <div class="profil-modal-handle"></div>
    <div class="profil-modal-head"><span class="profil-modal-title">✏️ Modifier mon profil</span><button class="profil-modal-close" onclick="pCloseModal('membre')">✕</button></div>
    <div class="profil-avatar-editor">
      <div class="profil-avatar-edit-preview" id="pmodal-av-membre" style="background:linear-gradient(135deg,#230d35,#1a0a28);color:#00e5ff;"><span id="pmodal-av-membre-init">?</span><div class="p-overlay">📷</div></div>
      <div class="profil-avatar-actions"><label class="profil-btn-upload" style="cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;">📷 Changer la photo<input type="file" accept="image/*" style="display:none;" onchange="pHandleAvatarUpload(this)"></label><button class="profil-btn-remove">🗑️ Supprimer</button></div>
    </div>
    <div class="profil-form-body">
      <div class="profil-form-group"><label class="profil-form-label">Photo de couverture</label><label class="profil-upload-zone" style="cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;"><span style="font-size:2rem;">🌅</span><span style="font-size:.82rem;color:var(--muted);">Cliquer pour changer la couverture</span><span style="font-size:.7rem;color:var(--muted);">JPG, PNG · Max 5 Mo</span><input type="file" accept="image/*" style="display:none;" onchange="pHandleCoverUpload(this)"></label></div>
      <div class="profil-form-row">
        <div class="profil-form-group"><label class="profil-form-label">Prénom</label><input class="profil-form-input" id="pmodal-membre-prenom" type="text" value="" placeholder="Votre prénom"></div>
        <div class="profil-form-group"><label class="profil-form-label">Nom</label><input class="profil-form-input" id="pmodal-membre-nom" type="text" value="" placeholder="Votre nom"></div>
      </div>
      <div class="profil-form-group"><label class="profil-form-label">Nom d'utilisateur</label><input class="profil-form-input" id="pmodal-membre-pseudo" type="text" value="" placeholder="@votre_pseudo"></div>
      <div class="profil-form-group"><label class="profil-form-label">Bio</label><textarea class="profil-form-textarea" placeholder="Décrivez-vous en quelques mots…"></textarea></div>
      <div class="profil-form-group"><label class="profil-form-label">Téléphone</label><input class="profil-form-input" type="tel" value="" placeholder="+241 xx xx xx xx"></div>
      <div class="profil-form-group"><label class="profil-form-label">Centres d'intérêt</label><div class="profil-chips-row"><span class="profil-chip selected">🎷 Jazz</span><span class="profil-chip selected">🍹 Cocktails</span><span class="profil-chip selected">📸 Photos</span><span class="profil-chip">🎤 Concerts</span><span class="profil-chip">🌙 Nightlife</span><span class="profil-chip">🍽️ Gastronomie</span></div></div>
      <button class="profil-form-save" onclick="pSaveProfile('membre')">💾 Enregistrer les modifications</button>
    </div>
  </div>
</div>
<!-- Modal Chauffeur -->
<div class="profil-modal-overlay" id="pmodal-chauffeur">
  <div class="profil-modal-sheet">
    <div class="profil-modal-handle"></div>
    <div class="profil-modal-head"><span class="profil-modal-title">✏️ Mon profil chauffeur</span><button class="profil-modal-close" onclick="pCloseModal('chauffeur')">✕</button></div>
    <div class="profil-avatar-editor">
      <div class="profil-avatar-edit-preview" id="pmodal-av-chauffeur" style="background:linear-gradient(135deg,#2a1e00,#1a0a28);color:#ffd700;"><span id="pmodal-av-chauffeur-init">?</span><div class="p-overlay">📷</div></div>
      <div class="profil-avatar-actions"><label class="profil-btn-upload" style="color:#ffd700;border-color:rgba(255,215,0,.4);background:rgba(255,215,0,.1);cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;">📷 Changer la photo<input type="file" accept="image/*" style="display:none;" onchange="pHandleAvatarUpload(this)"></label><button class="profil-btn-remove">🗑️ Supprimer</button></div>
    </div>
    <div class="profil-form-body">
      <div class="profil-form-row">
        <div class="profil-form-group"><label class="profil-form-label">Prénom</label><input class="profil-form-input" id="pmodal-chauffeur-prenom" type="text" value="" placeholder="Prénom"></div>
        <div class="profil-form-group"><label class="profil-form-label">Nom</label><input class="profil-form-input" id="pmodal-chauffeur-nom" type="text" value="" placeholder="Nom"></div>
      </div>
      <div class="profil-form-group"><label class="profil-form-label">Bio courte</label><textarea class="profil-form-textarea" id="pmodal-chauffeur-bio" placeholder="Décrivez votre service…"></textarea></div>
      <div class="profil-form-group"><label class="profil-form-label">Marque du véhicule</label><input class="profil-form-input" id="pmodal-chauffeur-vehicule" type="text" value="" placeholder="Ex: Hyundai Elantra 2020"></div>
      <div class="profil-form-row">
        <div class="profil-form-group"><label class="profil-form-label">Immatriculation</label><input class="profil-form-input" id="pmodal-chauffeur-immat" type="text" value="" placeholder="Plaque"></div>
        <div class="profil-form-group"><label class="profil-form-label">Couleur</label><input class="profil-form-input" id="pmodal-chauffeur-couleur" type="text" value="" placeholder="Couleur"></div>
      </div>
      <div class="profil-form-group"><label class="profil-form-label">Services proposés</label><div class="profil-chips-row"><span class="profil-chip selected">🌙 Sorties nocturnes</span><span class="profil-chip selected">✈️ Aéroport</span><span class="profil-chip selected">💼 Business</span><span class="profil-chip">👪 Famille</span></div></div>
      <button class="profil-form-save" style="background:linear-gradient(135deg,#ffd700,#cc9900);color:#000;box-shadow:0 4px 20px rgba(255,215,0,.35);" onclick="pSaveProfile('chauffeur')">💾 Enregistrer les modifications</button>
    </div>
  </div>
</div>
<!-- Modal Établissement -->
<div class="profil-modal-overlay" id="pmodal-etab">
  <div class="profil-modal-sheet">
    <div class="profil-modal-handle"></div>
    <div class="profil-modal-head"><span class="profil-modal-title">✏️ Mon établissement</span><button class="profil-modal-close" onclick="pCloseModal('etab')">✕</button></div>
    <div class="profil-avatar-editor">
      <div class="profil-avatar-edit-preview" id="pmodal-av-etab" style="background:linear-gradient(135deg,#200819,#0d1a2a);color:var(--pink);border-radius:22px;"><span id="pmodal-av-etab-init">—</span><div class="p-overlay">📷</div></div>
      <div class="profil-avatar-actions"><label class="profil-btn-upload" style="cursor:pointer;display:inline-flex;align-items:center;gap:.35rem;">📷 Changer le logo<input type="file" accept="image/*" style="display:none;" onchange="pHandleAvatarUpload(this)"></label><button class="profil-btn-remove">🗑️ Supprimer</button></div>
    </div>
    <div class="profil-form-body">
      <div class="profil-form-group"><label class="profil-form-label">Nom de l'établissement</label><input class="profil-form-input" id="pmodal-etab-nom" type="text" value="" placeholder="Nom officiel"></div>
      <div class="profil-form-group"><label class="profil-form-label">Type d'établissement</label><select class="profil-form-select" id="pmodal-etab-type"><option selected>Bar / Live Music</option><option>Restaurant</option><option>Discothèque / Club</option><option>Rooftop Bar</option><option>Lounge</option></select></div>
      <div class="profil-form-group"><label class="profil-form-label">Description</label><textarea class="profil-form-textarea" id="pmodal-etab-desc" placeholder="Décrivez votre établissement…"></textarea></div>
      <div class="profil-form-group"><label class="profil-form-label">Adresse complète</label><input class="profil-form-input" id="pmodal-etab-adresse" type="text" value="" placeholder="Adresse"></div>
      <div class="profil-form-row">
        <div class="profil-form-group"><label class="profil-form-label">Téléphone</label><input class="profil-form-input" id="pmodal-etab-tel" type="tel" value="" placeholder="+241 xx xx xx xx"></div>
        <div class="profil-form-group"><label class="profil-form-label">Entrée / Prix</label><input class="profil-form-input" id="pmodal-etab-prix" type="text" value="" placeholder="Ex: 5 000 F"></div>
      </div>
      <div class="profil-form-group"><label class="profil-form-label">Ambiances &amp; Services</label><div class="profil-chips-row"><span class="profil-chip selected">🎷 Jazz Live</span><span class="profil-chip selected">🍸 Cocktails</span><span class="profil-chip selected">🌊 Vue Mer</span><span class="profil-chip selected">🅿️ Parking</span><span class="profil-chip">🍽️ Restaurant</span><span class="profil-chip">💃 Dancefloor</span></div></div>
      <button class="profil-form-save" onclick="pSaveProfile('etab')">💾 Enregistrer les modifications</button>
    </div>
  </div>
</div>
`;
  container.parentNode.insertBefore(div, container.nextSibling);

  // ── Onglets compte membre (injecté après insertion DOM) ──
  /* ── Switcher onglets compte membre ── */
      var _pmTabList = ['profil','photos','amis','demandes','infos','activite','prefs'];
      window.pMembreTab = function(btn, tab){
        _pmTabList.forEach(function(t){
          var el = document.getElementById('pm-tab-'+t);
          if(el) el.style.display = (t===tab) ? 'block' : 'none';
        });
        var btns = document.querySelectorAll('#pv-membre .stab-p');
        btns.forEach(function(b){ b.classList.remove('active'); });
        if(btn) btn.classList.add('active');
        if(tab === 'amis')     _pmRenderAmis();
        if(tab === 'demandes') _pmRenderDemandes();
        if(tab === 'infos')    _pmRenderInfos();
      };
  
      /* ── Remplir onglet Amis depuis _friends ── */
      function _pmRenderAmis(){
        var list = window._friends || [];
        var el = document.getElementById('pm-amis-list');
        var badge = document.getElementById('pm-count-amis');
        if(badge) badge.textContent = list.length;
        if(!el) return;
        if(!list.length){
          el.innerHTML = '<div style="text-align:center;padding:2rem 1rem;color:var(--muted);font-size:0.8rem;"><span style="font-size:2rem;display:block;margin-bottom:0.5rem;">👥</span>Aucun ami pour l\'instant.</div>';
          return;
        }
        el.innerHTML = list.map(function(f){
          return '<div style="display:flex;align-items:center;gap:0.65rem;padding:0.55rem 0.6rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;">'
            +'<div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,rgba(0,229,255,0.2),rgba(204,68,255,0.15));display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;">'+f.avatar+'</div>'
            +'<div style="flex:1;min-width:0;"><div style="font-size:0.82rem;font-weight:700;color:var(--text);">'+f.name+'</div>'
            +(f.etab?'<div style="font-size:0.65rem;color:var(--muted);">'+f.etab+'</div>':'')+'</div>'
            +'<div style="display:flex;gap:0.3rem;">'
            +'<button onclick="if(window.switchSection&&window.openSocialProfileModal)openSocialProfileModal(\''+f.uid+'\')" style="padding:0.25rem 0.55rem;border-radius:8px;background:rgba(0,229,255,0.08);border:1px solid rgba(0,229,255,0.25);color:#00e5ff;font-size:0.62rem;font-weight:700;cursor:pointer;font-family:\'DM Sans\',sans-serif;">Voir</button>'
            +'</div></div>';
        }).join('');
      }
  
      /* ── Remplir onglet Demandes ── */
      function _pmRenderDemandes(){
        var inList  = window._requestsIn  || [];
        var outList = window._requestsOut || [];
        var badge   = document.getElementById('pm-count-demandes');
        if(badge){ badge.textContent = inList.length; badge.style.display = inList.length ? 'inline' : 'none'; }
        var elIn  = document.getElementById('pm-demandes-in-list');
        var elOut = document.getElementById('pm-demandes-out-list');
        if(elIn){
          if(!inList.length){
            elIn.innerHTML = '<div style="text-align:center;padding:1.2rem;color:var(--muted);font-size:0.8rem;"><span style="font-size:1.8rem;display:block;margin-bottom:0.35rem;">📭</span>Aucune demande reçue</div>';
          } else {
            elIn.innerHTML = inList.map(function(r){
              return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.55rem;background:rgba(255,45,155,0.05);border:1px solid rgba(255,45,155,0.15);border-radius:12px;">'
                +'<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,rgba(255,45,155,0.2),rgba(204,68,255,0.15));display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0;">'+r.avatar+'</div>'
                +'<div style="flex:1;min-width:0;"><div style="font-size:0.8rem;font-weight:700;color:var(--text);">'+r.name+'</div>'
                +'<div style="font-size:0.62rem;color:var(--muted);">'+r.sentAt+'</div></div>'
                +'<div style="display:flex;gap:0.3rem;">'
                +'<button onclick="if(window.acceptFriend)window.acceptFriend(\''+r.uid+'\');_pmRenderDemandes();_pmRenderAmis();" style="padding:0.25rem 0.55rem;border-radius:8px;background:rgba(0,255,170,0.1);border:1px solid rgba(0,255,170,0.3);color:var(--green);font-size:0.62rem;font-weight:800;cursor:pointer;font-family:\'DM Sans\',sans-serif;">✓</button>'
                +'<button onclick="if(window.declineFriend)window.declineFriend(\''+r.uid+'\');_pmRenderDemandes();" style="padding:0.25rem 0.55rem;border-radius:8px;background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.25);color:var(--red);font-size:0.62rem;font-weight:800;cursor:pointer;font-family:\'DM Sans\',sans-serif;">✕</button>'
                +'</div></div>';
            }).join('');
          }
        }
        if(elOut){
          if(!outList.length){
            elOut.innerHTML = '<div style="text-align:center;padding:1.2rem;color:var(--muted);font-size:0.8rem;">Aucune demande envoyée</div>';
          } else {
            elOut.innerHTML = outList.map(function(r){
              return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.5rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);border-radius:12px;">'
                +'<div style="width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0;">'+r.avatar+'</div>'
                +'<div style="flex:1;min-width:0;"><div style="font-size:0.78rem;font-weight:700;color:var(--text);">'+r.name+'</div>'
                +'<div style="font-size:0.6rem;color:var(--muted);">Envoyée · '+r.sentAt+'</div></div>'
                +'<span style="font-size:0.62rem;color:var(--amber);background:rgba(255,215,0,0.1);padding:0.18rem 0.45rem;border-radius:6px;border:1px solid rgba(255,215,0,0.2);">En attente</span>'
                +'</div>';
            }).join('');
          }
        }
      }
  
      /* ── Remplir onglet Infos ── */
      function _pmRenderInfos(){
        var pseudo = window.currentUserPseudo || window.currentUserEmail || '—';
        var email  = window.currentUserEmail  || '—';
        var uid    = window.currentUserUID;
        var role   = (typeof getUserRole==='function') ? getUserRole() : 'membre';
        var roleLabel = {admin:'⭐ Admin',super_admin:'🔑 Super Admin',establishment:'🏛️ Établissement',chauffeur:'🚕 Chauffeur',membre:'● Membre Premium',user:'● Membre'}[role] || '● Membre';
        var setPseudo = document.getElementById('pm-info-pseudo');
        var setEmail  = document.getElementById('pm-info-email');
        var setRole   = document.getElementById('pm-info-role');
        if(setPseudo) setPseudo.textContent = pseudo;
        if(setEmail)  setEmail.textContent  = email;
        if(setRole)   setRole.textContent   = roleLabel;
        // Charger depuis Firestore si dispo
        if(uid && window.db && window.fbGetDoc && window.fbDoc){
          window.fbGetDoc(window.fbDoc(window.db,'users',uid)).then(function(snap){
            var d = snap.exists() ? snap.data() : {};
            var bioEl   = document.getElementById('pm-info-bio');
            var sinceEl = document.getElementById('pm-info-since');
            if(bioEl && d.bio){ bioEl.textContent = d.bio; bioEl.style.fontStyle='normal'; bioEl.style.opacity='1'; }
            if(sinceEl && d.createdAt){
              try{
                var dt = new Date(d.createdAt);
                var m  = ['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
                sinceEl.textContent = m[dt.getMonth()]+' '+dt.getFullYear();
              }catch(e){}
            }
          }).catch(function(){});
        }
      }
  
      /* ── Recherche amis (proxy vers searchUsers) ── */
      window.pmSearchFriend = function(val){
        var el = document.getElementById('pm-friend-results');
        if(!el) return;
        if(!val){ el.innerHTML=''; return; }
        // Recherche dans Firebase — résultats réels uniquement
        el.innerHTML='<div style="font-size:0.75rem;color:var(--muted);text-align:center;padding:0.5rem;">🔍 Recherche en cours…</div>';
        if(window.db && window.fbCollection && window.fbGetDocs){
          var q = window.fbCollection(window.db,'users');
          window.fbGetDocs(q).then(function(snap){
            var results = [];
            snap.forEach(function(d){
              var data = d.data();
              var name = data.pseudo || data.displayName || (data.email ? data.email.split('@')[0] : '');
              if(name && name.toLowerCase().includes(val.toLowerCase()) && d.id !== window.currentUserUID){
                results.push({uid:d.id, name:name, avatar:data.avatarEmoji||'👤', etab:data.establishment||'Libreville'});
              }
            });
            if(!results.length){ el.innerHTML='<div style="font-size:0.75rem;color:var(--muted);text-align:center;padding:0.5rem;">Aucun résultat</div>'; return; }
            el.innerHTML = results.slice(0,5).map(function(u){
              return '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.45rem 0.5rem;background:rgba(255,255,255,0.03);border-radius:10px;margin-bottom:0.3rem;">'
                +'<div style="width:34px;height:34px;border-radius:50%;background:rgba(0,229,255,0.1);display:flex;align-items:center;justify-content:center;font-size:1rem;">'+u.avatar+'</div>'
                +'<div style="flex:1;min-width:0;"><div style="font-size:0.8rem;font-weight:700;color:var(--text);">'+u.name+'</div>'
                +'<div style="font-size:0.65rem;color:var(--muted);">'+u.etab+'</div></div>'
                +'<button onclick="if(window.quickAddFriend)window.quickAddFriend(\''+u.uid+'\',\''+u.name+'\');document.getElementById(\'pm-friend-search\').value=\'\';document.getElementById(\'pm-friend-results\').innerHTML=\'\';" style="padding:0.25rem 0.6rem;border-radius:8px;background:rgba(255,45,155,0.12);border:1px solid rgba(255,45,155,0.35);color:var(--pink);font-size:0.65rem;font-weight:800;cursor:pointer;font-family:\'DM Sans\',sans-serif;">+ Ajouter</button>'
                +'</div>';
            }).join('');
          }).catch(function(){ el.innerHTML='<div style="font-size:0.75rem;color:var(--muted);text-align:center;padding:0.5rem;">Erreur de connexion</div>'; });
        } else {
          el.innerHTML='<div style="font-size:0.75rem;color:var(--muted);text-align:center;padding:0.5rem;">Connexion Firebase requise</div>';
        }
      };
  
      window.pmSendFriendRequest = function(){
        var val = (document.getElementById('pm-friend-search')||{}).value||'';
        if(!val.trim()){ return; }
        if(window._requestsOut) window._requestsOut.push({uid:'pm'+Date.now(),name:val.trim(),avatar:'👤',sentAt:'À l\'instant'});
        document.getElementById('pm-friend-search').value='';
        document.getElementById('pm-friend-results').innerHTML='';
        if(window.socToast) window.socToast('📨 Demande envoyée à '+val.trim()+' !');
      };
  
      /* ── Sync données infos au chargement profil (hook) ── */
      var _origPatchAll = window._syncProfilSection;
      window._syncProfilSection = function(){
        if(typeof _origPatchAll === 'function') _origPatchAll.apply(this, arguments);
        // Mettre à jour le badge demandes
        setTimeout(function(){
          var inList = window._requestsIn || [];
          var badge  = document.getElementById('pm-count-demandes');
          if(badge){ badge.textContent = inList.length; badge.style.display = inList.length ? 'inline' : 'none'; }
          var cntAmis = document.getElementById('pm-count-amis');
          if(cntAmis) cntAmis.textContent = (window._friends||[]).length;
        }, 300);
      };

  // Chips toggle
  div.querySelectorAll('.profil-chip').forEach(function(c){ c.addEventListener('click',function(){ c.classList.toggle('selected'); }); });
  // Fermer modal en cliquant overlay
  div.querySelectorAll('.profil-modal-overlay').forEach(function(o){ o.addEventListener('click',function(e){ if(e.target===this){ this.classList.remove('open'); document.body.style.overflow=''; } }); });
})();
