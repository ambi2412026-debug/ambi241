const i18n = {
  defaultLang: 'fr',
  storageKey: 'ambi241_lang',
  langs: {
    fr: { name: 'Français', flag: '🇬🇦' },
    en: { name: 'English', flag: '🇬🇧' },
    es: { name: 'Español', flag: '🇪🇸' }
  },

  /* ─── Dictionnaire complet ─── */
  dict: {
    fr: {
      /* Hero */
      hero_title:        "L'Ambiance de <span>Libreville</span><br>en Temps réel",
      hero_sub:          "Bars · Discos · Restaurants · Bar Terrasses",
      hero_explore:      "🔍 Explorer les lieux",
      hero_inscrire:     "+ Inscrire mon etablissement",
      hero_nearby:       "📍 Près de moi",
      top_ce_soir:       "🔥 Top ce soir",
      top_ce_soir_sub:   "— 3 meilleurs lieux",
      /* Nav bas */
      nav_accueil:       "Accueil",
      nav_lieux:         "Lieux",
      nav_posts:         "Discussions",
      nav_tarifs:        "Profil",
      nav_contact:       "Paiements",
      /* Sync bar */
      sync_live:         "Données en direct",
      sync_ing:          "Synchronisation...",
      visitors_today:    "Visiteurs aujourd'hui",
      /* Inscrire banner */
      inscrire_text:     "<strong>Votre etablissement sur AMBI241 ?</strong> Rejoignez l'annuaire des meilleures sorties de Libreville.",
      inscrire_btn:      "+ Inscrire mon etablissement — 5 000 XAF",
      /* GPS */
      gps_nearby:        "Près de chez vous",
      gps_find:          "Trouver les lieux proches de votre position",
      gps_panel_title:   "📍 Près de chez vous",
      gps_radius_title:  "Rayon de recherche",
      gps_sort_title:    "Trier par",
      gps_sort_dist:     "📍 Distance",
      gps_sort_aff:      "🔥 Affluence",
      gps_sort_note:     "⭐ Note",
      /* Recherche & filtres */
      search_placeholder:"Rechercher nom, type, quartier...",
      filter_all:        "✨ Tous",
      filter_bar:        "🍺 Bars",
      filter_disco:      "🎵 Boîtes de Nuit",
      filter_resto:      "🍽 Restos & Pâtisseries",
      "filter_bar-terrasse":    "🌴 Bar Terrasses",
      filter_snack:      "🍾 Snacks",
      filter_hotel:      "🏨 Hôtels & Motels",
      status_all:        "Tous",
      status_packed:     "🔴 Bondé",
      status_lively:     "🟢 Animé",
      status_quiet:      "🟡 Calme",
      /* Tri */
      sort_by:           "Trier par",
      sort_affluence:    "Affluence",
      sort_note:         "Note",
      sort_quartier:     "Quartier",
      view_list:         "≡",
      view_group:        "⊞",
      view_map:          "📍",
      /* Résultats */
      no_results:        "Aucun établissement visible",
      loading:           "Chargement...",
      /* Publications */
      pub_title:         "📝 Publi<span>cations</span>",
      pub_compose:       "+ Publier",
      pub_tab_all:       "🌐 Tous",
      pub_tab_annonce:   "📣 Annonces",
      pub_tab_soiree:    "🎉 Soirées",
      pub_tab_avis:      "⭐ Avis",
      pub_load_more:     "Voir plus de publications",
      /* Contacts */
      contact_title:     "Contact",
      contact_sub:       "Libreville, Gabon — contact@ambi241.ga",
      contact_email:     "✉ Email",
      contact_airtel:    "Airtel Money",
      contact_moov:      "Moov Money",
      contact_address_label: "Adresse",
      contact_address_value: "Libreville, Gabon",
      contact_whatsapp:  "💬 WhatsApp",
      contact_call:      "📞 Appeler",
      btn_register_venue:"+ Inscrire mon établissement",
      footer_about:      "🏠 À propos",
      footer_links_title:"🔗 Liens utiles",
      footer_legal_title:"🔒 Mentions légales",
      footer_confidentialite:"Confidentialité",
      footer_cgu:        "CGU",
      footer_copyright:  "© 2026 AMBI241 — Libreville, Gabon",
      /* Toast */
      toast_refresh:     "Actualisation...",
      toast_lang_changed:"Langue changée ✓",
      /* Boutons communs */
      btn_close:         "Fermer",
      btn_send:          "Envoyer",
      btn_cancel:        "Annuler",
      btn_save:          "Enregistrer",
    },
    en: {
      hero_title:        "The Vibe of <span>Libreville</span><br>in Real Time",
      hero_sub:          "Bars · Clubs · Restaurants · Bar Terrasses",
      hero_explore:      "🔍 Explore venues",
      hero_inscrire:     "+ Register my venue",
      hero_nearby:       "📍 Near me",
      top_ce_soir:       "🔥 Top tonight",
      top_ce_soir_sub:   "— 3 best spots",
      nav_accueil:       "Home",
      nav_lieux:         "Places",
      nav_posts:         "Discussions",
      nav_tarifs:        "Profile",
      nav_contact:       "Paiements",
      sync_live:         "Live data",
      sync_ing:          "Syncing...",
      visitors_today:    "Visitors today",
      inscrire_text:     "<strong>Your venue on AMBI241?</strong> Join Libreville's best nightlife directory.",
      inscrire_btn:      "+ Register my venue — 5,000 XAF",
      gps_nearby:        "Near you",
      gps_find:          "Find places near your location",
      gps_panel_title:   "📍 Near you",
      gps_radius_title:  "Search radius",
      gps_sort_title:    "Sort by",
      gps_sort_dist:     "📍 Distance",
      gps_sort_aff:      "🔥 Crowd",
      gps_sort_note:     "⭐ Rating",
      search_placeholder:"Search name, type, area...",
      filter_all:        "✨ All",
      filter_bar:        "🍺 Bars",
      filter_disco:      "🎵 Boîtes de Nuit",
      filter_resto:      "🍽 Restos & Pâtisseries",
      "filter_bar-terrasse":    "🌴 Bar Terrasses",
      filter_snack:      "🍾 Snacks",
      filter_hotel:      "🏨 Hotels & Motels",
      status_all:        "All",
      status_packed:     "🔴 Packed",
      status_lively:     "🟢 Lively",
      status_quiet:      "🟡 Quiet",
      sort_by:           "Sort by",
      sort_affluence:    "Crowd",
      sort_note:         "Rating",
      sort_quartier:     "Area",
      view_list:         "≡",
      view_group:        "⊞",
      view_map:          "📍",
      no_results:        "No venues visible",
      loading:           "Loading...",
      pub_title:         "📝 Publi<span>cations</span>",
      pub_compose:       "+ Post",
      pub_tab_all:       "🌐 All",
      pub_tab_annonce:   "📣 News",
      pub_tab_soiree:    "🎉 Events",
      pub_tab_avis:      "⭐ Reviews",
      pub_load_more:     "Load more posts",
      contact_title:     "Contact",
      contact_sub:       "Libreville, Gabon — contact@ambi241.ga",
      contact_email:     "✉ Email",
      contact_airtel:    "Airtel Money",
      contact_moov:      "Moov Money",
      contact_address_label: "Address",
      contact_address_value: "Libreville, Gabon",
      contact_whatsapp:  "💬 WhatsApp",
      contact_call:      "📞 Call",
      btn_register_venue:"+ Register my venue",
      footer_about:      "🏠 About",
      footer_links_title:"🔗 Useful links",
      footer_legal_title:"🔒 Legal",
      footer_confidentialite:"Privacy",
      footer_cgu:        "Terms",
      footer_copyright:  "© 2026 AMBI241 — Libreville, Gabon",
      toast_refresh:     "Refreshing...",
      toast_lang_changed:"Language changed ✓",
      btn_close:         "Close",
      btn_send:          "Send",
      btn_cancel:        "Cancel",
      btn_save:          "Save",
    },
    es: {
      hero_title:        "El Ambiente de <span>Libreville</span><br>en Tiempo Real",
      hero_sub:          "Bares · Discotecas · Restaurantes · Bar Terrasses",
      hero_explore:      "🔍 Explorar lugares",
      hero_inscrire:     "+ Registrar mi local",
      hero_nearby:       "📍 Cerca de mí",
      top_ce_soir:       "🔥 Top esta noche",
      top_ce_soir_sub:   "— 3 mejores lugares",
      nav_accueil:       "Inicio",
      nav_lieux:         "Lugares",
      nav_posts:         "Discussions",
      nav_tarifs:        "Perfil",
      nav_contact:       "Paiements",
      sync_live:         "Datos en directo",
      sync_ing:          "Sincronizando...",
      visitors_today:    "Visitantes hoy",
      inscrire_text:     "<strong>¿Tu local en AMBI241?</strong> Únete al directorio nocturno de Libreville.",
      inscrire_btn:      "+ Registrar mi local — 5.000 XAF",
      gps_nearby:        "Cerca de ti",
      gps_find:          "Encontrar lugares cerca de tu posición",
      gps_panel_title:   "📍 Cerca de ti",
      gps_radius_title:  "Radio de búsqueda",
      gps_sort_title:    "Ordenar por",
      gps_sort_dist:     "📍 Distancia",
      gps_sort_aff:      "🔥 Afluencia",
      gps_sort_note:     "⭐ Puntuación",
      search_placeholder:"Buscar nombre, tipo, área...",
      filter_all:        "✨ Todos",
      filter_bar:        "🍺 Bars",
      filter_disco:      "🎵 Boîtes de Nuit",
      filter_resto:      "🍽 Restos & Pâtisseries",
      "filter_bar-terrasse":    "🌴 Bar Terrasses",
      filter_snack:      "🍾 Snacks",
      filter_hotel:      "🏨 Hoteles",
      status_all:        "Todos",
      status_packed:     "🔴 Lleno",
      status_lively:     "🟢 Animado",
      status_quiet:      "🟡 Tranquilo",
      sort_by:           "Ordenar por",
      sort_affluence:    "Afluencia",
      sort_note:         "Puntuación",
      sort_quartier:     "Zona",
      view_list:         "≡",
      view_group:        "⊞",
      view_map:          "📍",
      no_results:        "Sin establecimientos visibles",
      loading:           "Cargando...",
      pub_title:         "📝 Publi<span>caciones</span>",
      pub_compose:       "+ Publicar",
      pub_tab_all:       "🌐 Todos",
      pub_tab_annonce:   "📣 Anuncios",
      pub_tab_soiree:    "🎉 Eventos",
      pub_tab_avis:      "⭐ Reseñas",
      pub_load_more:     "Ver más publicaciones",
      contact_title:     "Contacto",
      contact_sub:       "Libreville, Gabón — contact@ambi241.ga",
      contact_email:     "✉ Email",
      contact_airtel:    "Airtel Money",
      contact_moov:      "Moov Money",
      contact_address_label: "Dirección",
      contact_address_value: "Libreville, Gabón",
      contact_whatsapp:  "💬 WhatsApp",
      contact_call:      "📞 Llamar",
      btn_register_venue:"+ Registrar mi establecimiento",
      footer_about:      "🏠 Sobre nosotros",
      footer_links_title:"🔗 Enlaces útiles",
      footer_legal_title:"🔒 Legal",
      footer_confidentialite:"Privacidad",
      footer_cgu:        "Términos",
      footer_copyright:  "© 2026 AMBI241 — Libreville, Gabón",
      toast_refresh:     "Actualizando...",
      toast_lang_changed:"Idioma cambiado ✓",
      btn_close:         "Cerrar",
      btn_send:          "Enviar",
      btn_cancel:        "Cancelar",
      btn_save:          "Guardar",
    }
  },

  get current() {
    return localStorage.getItem(this.storageKey) || this.defaultLang;
  },

  t(key) {
    const lang = this.current;
    return this.dict[lang]?.[key] ?? this.dict[this.defaultLang][key] ?? key;
  },

  /* ─── Applique toutes les traductions au DOM ─── */
  applyTranslations() {
    const L = this.current;
    const d = this.dict[L] || this.dict[this.defaultLang];

    /* Titre page */
    document.documentElement.lang = L;

    /* --- Hero section --- */
    const heroTitle = document.querySelector('.hero-title');
    if (heroTitle) heroTitle.innerHTML = d.hero_title;
    const heroSub = document.querySelector('.hero-sub');
    if (heroSub) heroSub.textContent = d.hero_sub;

    /* Hero buttons */
    const heroExploreBtn = document.getElementById('heroExploreBtn');
    if (heroExploreBtn) heroExploreBtn.innerHTML = d.hero_explore;
    const heroBtns = document.querySelectorAll('.hero-actions .hero-btn');
    if (heroBtns[0]) heroBtns[0].innerHTML = d.hero_nearby;

    /* Top ce soir label */
    const topLabel = document.querySelector('#sec-accueil > div[style*="Top ce soir"], #sec-accueil > div[style*="top_ce_soir"]');
    if (topLabel) {
      topLabel.innerHTML = `${d.top_ce_soir} <span style="font-size:0.62rem;color:var(--muted);font-weight:400;text-transform:none;letter-spacing:0;">${d.top_ce_soir_sub}</span>`;
    }

    /* --- Navigation bas --- */
    const navItems = document.querySelectorAll('.nav-item');
    const navKeys = ['nav_accueil','nav_lieux','nav_tarifs','nav_contact'];
    navItems.forEach((btn, i) => {
      if (navKeys[i] && d[navKeys[i]]) {
        const icon = btn.querySelector('.nav-icon');
        const iconHTML = icon ? icon.outerHTML : '';
        btn.innerHTML = iconHTML + d[navKeys[i]];
      }
    });

    /* --- Sync bar --- */
    const syncStatus = document.getElementById('syncStatus');
    if (syncStatus && !syncStatus.dataset.syncing) syncStatus.textContent = d.sync_live;

    /* Visiteurs aujourd'hui */
    const tbLeft = document.querySelector('#trafficBadge .tb-left');
    if (tbLeft) tbLeft.innerHTML = '📊 ' + d.visitors_today;

    /* --- Inscrire banner --- */
    const ibText = document.querySelector('.inscrire-banner .ib-text');
    if (ibText) ibText.innerHTML = d.inscrire_text;
    const inscrireBtn = document.querySelector('.inscrire-big-btn');
    if (inscrireBtn) inscrireBtn.textContent = d.inscrire_btn;

    /* --- GPS nearby button --- */
    const gnbText = document.querySelector('.gnb-text');
    if (gnbText) {
      const gnbSub = document.getElementById('gpsNearbySubtxt');
      const subText = gnbSub ? gnbSub.outerHTML.replace(gnbSub.textContent, d.gps_find) : '';
      gnbText.innerHTML = d.gps_nearby + `<span class="gnb-sub" id="gpsNearbySubtxt">${d.gps_find}</span>`;
    }

    /* GPS panel title */
    const gpsPanelTitle = document.querySelector('.gps-panel-title');
    if (gpsPanelTitle) gpsPanelTitle.innerHTML = d.gps_panel_title;

    /* GPS radius title */
    const gpsRadiusTitle = document.querySelector('#gpsPanel > div[style*="Rayon"], #gpsPanel > div[style*="radius"]');
    document.querySelectorAll('#gpsPanel > div').forEach(div => {
      if (div.textContent.trim() === 'Rayon de recherche' || div.textContent.trim() === 'Search radius' || div.textContent.trim() === 'Radio de búsqueda') {
        div.textContent = d.gps_radius_title;
      }
      if (div.textContent.trim() === 'Trier par' || div.textContent.trim() === 'Sort by' || div.textContent.trim() === 'Ordenar por') {
        div.textContent = d.gps_sort_title;
      }
    });

    /* GPS sort buttons */
    const gpsSortBtns = document.querySelectorAll('.gps-sort-btn');
    const gpsSortKeys = ['gps_sort_dist','gps_sort_aff','gps_sort_note'];
    gpsSortBtns.forEach((btn, i) => { if (gpsSortKeys[i]) btn.textContent = d[gpsSortKeys[i]]; });

    /* --- Barre de recherche --- */
    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.placeholder = d.search_placeholder;

    /* --- Filtres type --- */
    const typeChips = document.querySelectorAll('#typeChips .fchip');
    const typeKeys  = ['filter_all','filter_hotel','filter_bar','filter_bar-terrasse','filter_snack','filter_resto','filter_disco'];
    typeChips.forEach((c, i) => { if (typeKeys[i] && d[typeKeys[i]]) c.textContent = d[typeKeys[i]]; });

    /* --- Filtres statut --- */
    const statusChips = document.querySelectorAll('.schip-all, .schip-bonde, .schip-anime, .schip-calme');
    const statusMap = { 'schip-all':'status_all','schip-bonde':'status_packed','schip-anime':'status_lively','schip-calme':'status_quiet' };
    statusChips.forEach(c => {
      for (const cls in statusMap) {
        if (c.classList.contains(cls)) c.textContent = d[statusMap[cls]];
      }
    });

    /* --- Boutons de tri --- */
    const sortBtns = document.querySelectorAll('.sort-btn');
    const sortMap = { 'affluence':'sort_affluence', 'note':'sort_note', 'quartier':'sort_quartier' };
    sortBtns.forEach(b => {
      const k = sortMap[b.dataset.sort];
      if (k) b.textContent = d[k];
    });

    /* --- Publications section --- */
    const pubHeaderTitle = document.querySelector('.pub-header-title');
    if (pubHeaderTitle) pubHeaderTitle.innerHTML = d.pub_title;
    const pubComposeBtn = document.querySelector('.pub-compose-btn');
    if (pubComposeBtn) pubComposeBtn.textContent = d.pub_compose;

    const pubTabs = document.querySelectorAll('.pub-tab');
    const pubTabKeys = ['pub_tab_all','pub_tab_annonce','pub_tab_soiree','pub_tab_avis'];
    pubTabs.forEach((t, i) => { if (pubTabKeys[i]) t.innerHTML = d[pubTabKeys[i]]; });

    const pubLoadMore = document.getElementById('pubLoadMore');
    if (pubLoadMore) pubLoadMore.textContent = d.pub_load_more;

    /* --- Contact section --- */
    try {
      const contactSub = document.querySelector('#sec-contacts .cp-sub');
      if (contactSub) contactSub.textContent = d.contact_sub || contactSub.textContent;

      const addressLabel = document.querySelector('#sec-contacts .cp-row-label[data-i18n="contact_address_label"]');
      if (addressLabel) addressLabel.textContent = d.contact_address_label;
      const addressValue = document.querySelector('#sec-contacts .cp-row-value[data-i18n="contact_address_value"]');
      if (addressValue) addressValue.textContent = d.contact_address_value;

      const contactEmail = document.querySelector('.cp-action[data-i18n="contact_email"]');
      if (contactEmail) contactEmail.textContent = d.contact_email;
      const contactWA = document.querySelector('.cp-action[data-i18n="contact_whatsapp"]');
      if (contactWA) contactWA.textContent = d.contact_whatsapp;
      const contactCall = document.querySelector('.cp-action[data-i18n="contact_call"]');
      if (contactCall) contactCall.textContent = d.contact_call;

      const registerBtn = document.querySelector('[data-i18n="btn_register_venue"]');
      if (registerBtn) registerBtn.textContent = d.btn_register_venue;
    } catch(e) { console.warn('i18n contact error', e); }

    /* --- Footer --- */
    try {
      document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (d[key] !== undefined) {
          // Don't overwrite innerHTML-dependent elements already handled above
          if (!['hero_title','pub_title','pub_tab_all','pub_tab_annonce','pub_tab_soiree','pub_tab_avis'].includes(key)) {
            el.textContent = d[key];
          }
        }
      });
    } catch(e) { console.warn('i18n data-i18n sweep error', e); }

    /* --- Bouton lang actif dans dropdown --- */
    const dropdown = document.getElementById('lang-dropdown-inner');
    if (dropdown) {
      dropdown.querySelectorAll('[data-langcode]').forEach(opt => {
        const isActive = opt.dataset.langcode === L;
        opt.style.background   = isActive ? 'rgba(255,45,155,0.15)' : 'transparent';
        opt.style.color        = isActive ? 'var(--pink)' : 'var(--text)';
        opt.style.fontWeight   = isActive ? '700' : '400';
      });
    }

    /* Bouton globe — affiche le drapeau de la langue active */
    const globeBtn = document.getElementById('lang-globe-btn');
    if (globeBtn) globeBtn.innerHTML = this.langs[L].flag;
  },

  /* ─── Construit le sélecteur dans le header ─── */
  init() {
    const headerRight = document.querySelector('.header-right');
    if (!headerRight || document.getElementById('lang-selector')) return;

    const langSelector = document.createElement('div');
    langSelector.id = 'lang-selector';
    langSelector.style.cssText = 'position:relative;display:inline-flex;align-items:center;';

    const btnMain = document.createElement('button');
    btnMain.id = 'lang-globe-btn';
    btnMain.innerHTML = this.langs[this.current].flag;
    btnMain.title = 'Changer la langue';
    btnMain.style.cssText = [
      'background:rgba(255,45,155,0.1)',
      'border:1px solid rgba(255,45,155,0.25)',
      'width:34px','height:34px','border-radius:50%',
      'cursor:pointer','display:flex','align-items:center',
      'justify-content:center','font-size:1.1rem',
      'transition:all 0.2s','flex-shrink:0'
    ].join(';');

    const dropdown = document.createElement('div');
    dropdown.id = 'lang-dropdown-inner';
    dropdown.style.cssText = [
      'position:absolute','top:42px','right:0',
      'background:var(--surface)',
      'border:1px solid rgba(255,45,155,0.3)',
      'border-radius:14px','display:none',
      'min-width:165px',
      'box-shadow:0 6px 28px rgba(0,0,0,0.7)',
      'z-index:1000','overflow:hidden',
      'animation:popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)'
    ].join(';');

    Object.keys(this.langs).forEach((code, idx) => {
      const info = this.langs[code];
      const opt  = document.createElement('button');
      opt.dataset.langcode = code;
      opt.innerHTML = `${info.flag} ${info.name}`;
      const isActive = code === this.current;
      opt.style.cssText = [
        'width:100%','padding:0.85rem 1rem',
        'border:none',
        `border-bottom:${idx < Object.keys(this.langs).length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none'}`,
        `background:${isActive ? 'rgba(255,45,155,0.15)' : 'transparent'}`,
        `color:${isActive ? 'var(--pink)' : 'var(--text)'}`,
        `font-weight:${isActive ? '700' : '400'}`,
        "font-size:0.88rem","cursor:pointer","text-align:left",
        "font-family:'DM Sans',sans-serif","transition:background 0.15s",
        'display:flex','align-items:center','gap:0.5rem'
      ].join(';');
      opt.onmouseover = () => { if (code !== i18n.current) opt.style.background = 'rgba(255,255,255,0.05)'; };
      opt.onmouseout  = () => { if (code !== i18n.current) opt.style.background = 'transparent'; };
      opt.onclick = (e) => { e.stopPropagation(); i18n.changeLang(code); };
      dropdown.appendChild(opt);
    });

    btnMain.onclick = (e) => {
      e.stopPropagation();
      const open = dropdown.style.display === 'block';
      dropdown.style.display = open ? 'none' : 'block';
      btnMain.style.background    = open ? 'rgba(255,45,155,0.1)' : 'rgba(255,45,155,0.22)';
      btnMain.style.borderColor   = open ? 'rgba(255,45,155,0.25)' : 'var(--pink)';
    };

    document.addEventListener('click', (e) => {
      if (!langSelector.contains(e.target)) {
        dropdown.style.display = 'none';
        btnMain.style.background  = 'rgba(255,45,155,0.1)';
        btnMain.style.borderColor = 'rgba(255,45,155,0.25)';
      }
    });

    langSelector.appendChild(btnMain);
    langSelector.appendChild(dropdown);
    headerRight.insertBefore(langSelector, headerRight.firstChild);

    /* Appliquer la langue sauvegardée au démarrage */
    this.applyTranslations();
  },

  /* ─── Change la langue ET traduit immédiatement ─── */
  changeLang(code) {
    if (!this.langs[code]) return;
    localStorage.setItem(this.storageKey, code);

    /* Ferme le dropdown */
    const dd = document.getElementById('lang-dropdown-inner');
    if (dd) dd.style.display = 'none';
    const gb = document.getElementById('lang-globe-btn');
    if (gb) { gb.style.background = 'rgba(255,45,155,0.1)'; gb.style.borderColor = 'rgba(255,45,155,0.25)'; }

    /* Applique immédiatement */
    this.applyTranslations();

    /* Toast de confirmation */
    if (typeof showToast === 'function') showToast(this.t('toast_lang_changed'));

    /* Si renderAll existe, re-render pour les textes dynamiques */
    setTimeout(() => {
      if (typeof renderAll  === 'function') renderAll();
      if (typeof renderHome === 'function') renderHome();
    }, 80);
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
  i18n.init();
}