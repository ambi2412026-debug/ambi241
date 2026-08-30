
/**
 * ══════════════════════════════════════════════════════════════════
 * AMBI241 — SYSTÈME MODULAIRE DES TYPES D'ÉTABLISSEMENTS
 * Version 2.0 — Fiches adaptatives par catégorie
 * ══════════════════════════════════════════════════════════════════
 *
 * Ce module centralise toute la logique des types d'établissements :
 *   1. REGISTRE — configuration complète par type
 *   2. HELPERS  — fonctions utilitaires d'accès au registre
 *   3. TEMPLATES — sections HTML spécifiques par type
 *   4. RENDERER  — moteur d'injection dans les fiches existantes
 *   5. CSS INJECT — styles dynamiques par type
 *
 * Intégration dans index.html :
 *   Appelé automatiquement après renderCard() via l'event hook.
 * ══════════════════════════════════════════════════════════════════
 */

(function (window) {
  'use strict';

  /* ══════════════════════════════════════════════════════════════
     §1  REGISTRE DES TYPES D'ÉTABLISSEMENTS
     Chaque type déclare :
       key        → identifiant interne (correspond à e.type OSM/Firebase)
       aliases    → variantes acceptées (insensible à la casse)
       label      → libellé affiché
       icon       → emoji principal
       color      → couleur accent (CSS hex)
       colorRgb   → composantes RGB pour les rgba() dynamiques
       badge      → classe CSS du badge catégorie existant
       sections   → liste ordonnée des sections à afficher sur la fiche
       fields     → champs supplémentaires propres à ce type
  ══════════════════════════════════════════════════════════════════ */

  var TYPE_REGISTRY = {

    /* ── BAR ────────────────────────────────────────────────── */
    Bar: {
      key:      'Bar',
      aliases:  ['bar', 'bar lounge', 'bar terrasse', 'pub', 'taverne', 'buvette'],
      label:    'Bar',
      icon:     '🍺',
      color:    '#ff1493',
      colorRgb: '255,20,147',
      badge:    'cb-bar',
      sections: ['ambiance','affluence','musique','happy_hour','terrasse','contacts','galerie','presences','votes','commentaires'],
      fields: {
        happy_hour:    { label: 'Happy Hour',        emoji: '🕐', type: 'text',   placeholder: 'Ex: 17h–20h tous les jours' },
        musique_genre: { label: 'Musique ce soir',   emoji: '🎵', type: 'text',   placeholder: 'Ex: Afrobeat, Zouk, Hip-hop' },
        terrasse:      { label: 'Terrasse',           emoji: '🌿', type: 'bool'   },
        billet_entree: { label: 'Entrée (XAF)',       emoji: '🎟️', type: 'number', placeholder: 'Laisser vide si gratuit' },
        age_minimum:   { label: 'Âge minimum',        emoji: '🔞', type: 'select', options: ['Aucun', '18+', '21+'] }
      }
    },

    /* ── RESTAURANT ─────────────────────────────────────────── */
    Restaurant: {
      key:      'Restaurant',
      aliases:  ['restaurant', 'restau', 'snack', 'snack-bar', 'maquis', 'pâtisserie', 'patisserie', 'boulangerie', 'fast food', 'fast-food'],
      label:    'Restaurant',
      icon:     '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 40" width="1.1em" height="0.8em" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><line x1="10" y1="4" x2="10" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/><line x1="7" y1="4" x2="7" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="4" x2="13" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M7 16 Q10 20 13 16" fill="none" stroke="white" stroke-width="1.6"/><circle cx="28" cy="22" r="14" fill="none" stroke="white" stroke-width="2.2"/><circle cx="28" cy="22" r="9" fill="rgba(255,255,255,0.12)" stroke="white" stroke-width="1.2"/><circle cx="28" cy="22" r="3.5" fill="white" opacity="0.7"/><ellipse cx="46" cy="10" rx="3.5" ry="5" fill="none" stroke="white" stroke-width="2"/><line x1="46" y1="15" x2="46" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg>',
      color:    '#ff9500',
      colorRgb: '255,149,0',
      badge:    'cb-resto',
      sections: ['ambiance','affluence','menu_jour','cuisine_type','horaires','livraison','terrasse','contacts','galerie','presences','votes','commentaires'],
      fields: {
        cuisine_type:  { label: 'Cuisine',           emoji: '🌍', type: 'text',   placeholder: 'Ex: Gabonaise, Libanaise, Chinoise' },
        menu_jour:     { label: 'Menu du jour',      emoji: '📋', type: 'textarea',placeholder: 'Entrée + Plat + Dessert' },
        prix_moyen:    { label: 'Prix moyen (XAF)',  emoji: '💰', type: 'number', placeholder: 'Ex: 5000' },
        livraison:     { label: 'Livraison',         emoji: '🛵', type: 'bool'   },
        reservation:   { label: 'Réservation',       emoji: '📞', type: 'bool'   },
        capacite:      { label: 'Capacité (couverts)',emoji: '🪑', type: 'number', placeholder: 'Nombre de places assises' }
      }
    },

    /* ── DISCOTHÈQUE / BOÎTE DE NUIT ────────────────────────── */
    Discotheque: {
      key:      'Discotheque',
      aliases:  ['discotheque', 'discothèque', 'boite', 'boîte', 'nightclub', 'club', 'night-club', 'soirée', 'soiree'],
      label:    'Discothèque',
      icon:     '🎧',
      color:    '#cc44ff',
      colorRgb: '204,68,255',
      badge:    'cb-club',
      sections: ['ambiance','affluence','soiree_ce_soir','dj','dress_code','billet','musique','contacts','galerie','presences','votes','commentaires'],
      fields: {
        dj_ce_soir:    { label: 'DJ ce soir',        emoji: '🎤', type: 'text',   placeholder: 'Nom du DJ ou "Playlist"' },
        theme_soiree:  { label: 'Thème soirée',      emoji: '🎭', type: 'text',   placeholder: 'Ex: Afro Night, Latino, Années 90' },
        billet_entree: { label: 'Entrée (XAF)',       emoji: '🎟️', type: 'number', placeholder: 'Laisser vide si gratuit' },
        dress_code:    { label: 'Dress code',         emoji: '👔', type: 'text',   placeholder: 'Ex: Smart casual, Tenue de soirée' },
        ouverture_nuit:{ label: 'Ouvert jusqu\'à',   emoji: '🌙', type: 'text',   placeholder: 'Ex: 5h du matin' },
        vip_table:     { label: 'Tables VIP',         emoji: '⭐', type: 'bool'   }
      }
    },

    /* ── SALLE DE FÊTE / CÉRÉMONIE ──────────────────────────── */
    Salle: {
      key:      'Salle',
      aliases:  ['salle', 'salle de fête', 'salle des fêtes', 'salle de cérémonie', 'salle ceremonie', 'réception', 'reception', 'centre culturel'],
      label:    'Salle & Événements',
      icon:     '🎪',
      color:    '#ff006e',
      colorRgb: '255,0,110',
      badge:    'cb-salle',
      sections: ['ambiance','affluence','evenement_en_cours','disponibilite','capacite','tarif','traiteur','contacts','galerie','presences','votes','commentaires'],
      fields: {
        evenement:     { label: 'Événement en cours', emoji: '🎉', type: 'text',   placeholder: 'Ex: Mariage, Conférence, Gala' },
        capacite_max:  { label: 'Capacité max',       emoji: '🪑', type: 'number', placeholder: 'Nombre de personnes' },
        tarif_location:{ label: 'Tarif location (XAF)',emoji: '💰', type: 'number', placeholder: 'À partir de' },
        traiteur:      { label: 'Traiteur inclus',    emoji: '🍱', type: 'bool'   },
        sono_incluse:  { label: 'Sono incluse',       emoji: '🔊', type: 'bool'   },
        climatisation: { label: 'Climatisation',      emoji: '❄️', type: 'bool'   }
      }
    },

    /* ── STADE ──────────────────────────────────────────────── */
    Stade: {
      key:      'Stade',
      aliases:  ['stade', 'stade de football', 'terrain', 'complexe sportif', 'gymnase', 'arena'],
      label:    'Stade de Football',
      icon:     '⚽',
      color:    '#00ffaa',
      colorRgb: '0,255,170',
      badge:    'cb-stade',
      sections: ['ambiance','affluence','match_en_cours','prochain_match','places_dispo','contacts','galerie','presences','votes','commentaires'],
      fields: {
        match_en_cours:{ label: 'Match en cours',    emoji: '⚽', type: 'text',   placeholder: 'Ex: Panthères vs Léopards' },
        prochain_match:{ label: 'Prochain match',    emoji: '📅', type: 'text',   placeholder: 'Date et heure' },
        score_actuel:  { label: 'Score actuel',      emoji: '🏆', type: 'text',   placeholder: 'Ex: 2 - 1' },
        tarif_tribune: { label: 'Tarif tribune (XAF)',emoji: '🎟️', type: 'number', placeholder: 'Prix du billet' },
        retransmission:{ label: 'Retransmission TV', emoji: '📺', type: 'bool'   }
      }
    },

    /* ── SITE TOURISTIQUE ───────────────────────────────────── */
    Tourisme: {
      key:      'Tourisme',
      aliases:  ['tourisme', 'site touristique', 'monument', 'musée', 'musee', 'parc', 'plage', 'reserve', 'réserve', 'cascade'],
      label:    'Site Touristique',
      icon:     '🏛️',
      color:    '#ffd700',
      colorRgb: '255,215,0',
      badge:    'cb-tourisme',
      sections: ['description','affluence','horaires','tarif','langue_guide','accessibilite','contacts','galerie','presences','votes','commentaires'],
      fields: {
        horaires_ouverture:{ label: 'Horaires',      emoji: '🕐', type: 'text',   placeholder: 'Ex: 8h–18h (fermé lundi)' },
        tarif_entree:  { label: 'Entrée (XAF)',       emoji: '🎟️', type: 'number', placeholder: 'Laisser vide si gratuit' },
        guide_dispo:   { label: 'Guide disponible',  emoji: '👤', type: 'bool'   },
        parking:       { label: 'Parking',            emoji: '🅿️', type: 'bool'   },
        handicap:      { label: 'Accès PMR',          emoji: '♿', type: 'bool'   }
      }
    },

    /* ── LOUNGE / SPA ───────────────────────────────────────── */
    Lounge: {
      key:      'Lounge',
      aliases:  ['lounge', 'spa', 'salon', 'lounge bar', 'rooftop', 'terrasse lounge'],
      label:    'Lounge & Spa',
      icon:     '🛋️',
      color:    '#ff45b8',
      colorRgb: '255,69,184',
      badge:    'cb-bar',
      sections: ['ambiance','affluence','musique','reservation','contacts','galerie','presences','votes','commentaires'],
      fields: {
        type_ambiance: { label: 'Ambiance souhaitée',emoji: '✨', type: 'select', options: ['Relaxante', 'Festive', 'Business', 'Romantique'] },
        reservation:   { label: 'Réservation requise',emoji: '📞', type: 'bool'  },
        code_vestim:   { label: 'Code vestimentaire', emoji: '👗', type: 'text',  placeholder: 'Ex: Tenue chic' }
      }
    },

    /* ── POKER CLUB ─────────────────────────────────────────── */
    Poker: {
      key:      'Poker',
      aliases:  ['poker', 'poker club', 'casino', 'jeux', 'salle de jeux'],
      label:    'Poker Club',
      icon:     '🃏',
      color:    '#ff4466',
      colorRgb: '255,68,102',
      badge:    'cb-club',
      sections: ['ambiance','affluence','tournoi_en_cours','mise_min','contacts','galerie','presences','votes','commentaires'],
      fields: {
        tournoi:       { label: 'Tournoi en cours',  emoji: '🏆', type: 'text',  placeholder: 'Nom et heure du tournoi' },
        mise_minimum:  { label: 'Mise min. (XAF)',   emoji: '💵', type: 'number',placeholder: 'Montant minimum' },
        membres_seuls: { label: 'Membres uniquement',emoji: '🔐', type: 'bool'  }
      }
    }
  };

  /* ══════════════════════════════════════════════════════════════
     §2  HELPERS — ACCÈS AU REGISTRE
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Résout le type d'un établissement depuis e.type (string brut)
   * Retourne la config du registre ou le type "Bar" par défaut.
   * @param {string} rawType
   * @returns {Object} config du type
   */
  function resolveType(rawType) {
    if (!rawType) return TYPE_REGISTRY.Bar;
    var lower = rawType.toLowerCase().trim();
    var found = null;
    Object.values(TYPE_REGISTRY).forEach(function (cfg) {
      if (!found) {
        cfg.aliases.forEach(function (alias) {
          if (!found && (lower === alias || lower.indexOf(alias) !== -1 || alias.indexOf(lower) !== -1)) {
            found = cfg;
          }
        });
      }
    });
    return found || TYPE_REGISTRY.Bar;
  }

  /**
   * Retourne la couleur accent hex pour un type brut.
   * @param {string} rawType
   * @returns {string} hex color
   */
  function getTypeColor(rawType) {
    return resolveType(rawType).color;
  }

  /**
   * Retourne le label affiché pour un type brut.
   * @param {string} rawType
   * @returns {string}
   */
  function getTypeLabel(rawType) {
    return resolveType(rawType).label;
  }

  /**
   * Retourne l'icône emoji pour un type brut.
   * @param {string} rawType
   * @returns {string}
   */
  function getTypeIcon(rawType) {
    return resolveType(rawType).icon;
  }

  /**
   * Retourne les sections à afficher pour un type brut.
   * @param {string} rawType
   * @returns {string[]}
   */
  function getTypeSections(rawType) {
    return resolveType(rawType).sections;
  }

  /**
   * Retourne les champs spécifiques d'un type brut.
   * @param {string} rawType
   * @returns {Object}
   */
  function getTypeFields(rawType) {
    return resolveType(rawType).fields;
  }

  /* ══════════════════════════════════════════════════════════════
     §3  TEMPLATES HTML — SECTIONS SPÉCIFIQUES PAR TYPE
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Échappe le HTML pour prévenir les injections.
   * @param {string} str
   * @returns {string}
   */
  function _esc(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Génère le bloc HTML "Informations spécifiques" selon le type.
   * Rendu différent selon le type :
   *   - Bar       → happy hour, genre musical, terrasse
   *   - Restaurant→ type cuisine, menu du jour, livraison
   *   - Disco     → DJ, thème, dress code
   *   - Hôtel     → étoiles, chambres, services
   *   - Salle     → événement, capacité, équipements
   *   - Stade     → match, score, prochain match
   *   - Tourisme  → horaires, tarif, guide
   *   - Lounge    → ambiance, réservation
   *   - Poker     → tournoi, mise
   * @param {Object} e - données établissement
   * @returns {string} HTML string
   */
  function buildTypeSpecificSection(e) {
    var cfg = resolveType(e.type || '');
    var pd  = e.pro_data || {};
    var rgb = cfg.colorRgb;

    var html = '<div class="etm-specific-section" data-etm-type="' + _esc(cfg.key) + '" '
      + 'style="border-left: 3px solid rgba(' + rgb + ',0.8); background: rgba(' + rgb + ',0.04); '
      + 'border-radius: 0 12px 12px 0; margin: 0.55rem 0; padding: 0.65rem 0.75rem;">';

    html += '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.55rem;">'
      + '<span style="font-size:1.1rem;">' + cfg.icon + '</span>'
      + '<span style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:0.72rem;'
      + 'text-transform:uppercase;letter-spacing:0.1em;color:rgba(' + rgb + ',0.9);">'
      + _esc(cfg.label) + '</span>'
      + '</div>';

    /* Rendu conditionnel par clé */
    switch (cfg.key) {

      /* ── BAR ── */
      case 'Bar':
        if (pd.happy_hour || e.happy_hour) {
          html += _infoRow('🕐', 'Happy Hour', pd.happy_hour || e.happy_hour, rgb);
        }
        if (pd.musique_genre || e.musique_soir) {
          html += _infoRow('🎵', 'Musique', pd.musique_genre || e.musique_soir, rgb);
        }
        if (e.terrasse) {
          html += _boolBadge('🌿', 'Terrasse disponible', rgb);
        }
        if (pd.billet_entree || e.billet_entree) {
          html += _infoRow('🎟️', 'Entrée', _fmt_xaf(pd.billet_entree || e.billet_entree), rgb);
        }
        if (pd.age_minimum || e.age_minimum) {
          html += _infoRow('🔞', 'Âge min.', pd.age_minimum || e.age_minimum, rgb);
        }
        html += _defaultAmbiance(e, rgb);
        break;

      /* ── RESTAURANT ── */
      case 'Restaurant':
        if (pd.cuisine_type || e.cuisine_type) {
          html += _infoRow('🌍', 'Cuisine', pd.cuisine_type || e.cuisine_type, rgb);
        }
        if (pd.menu_jour || e.menu_jour) {
          html += _menuSection(pd.menu_jour || e.menu_jour, rgb);
        }
        if (pd.prix_moyen || e.prix_moyen) {
          html += _infoRow('💰', 'Prix moyen', _fmt_xaf(pd.prix_moyen || e.prix_moyen), rgb);
        }
        if (pd.livraison || e.livraison) {
          html += _boolBadge('🛵', 'Livraison disponible', rgb);
        }
        if (pd.reservation || e.reservation) {
          html += _boolBadge('📞', 'Réservation possible', rgb);
        }
        break;

      /* ── DISCOTHEQUE ── */
      case 'Discotheque':
        if (pd.dj_ce_soir || e.dj_ce_soir) {
          html += _highlightRow('🎤', 'DJ ce soir', pd.dj_ce_soir || e.dj_ce_soir, rgb);
        }
        if (pd.theme_soiree || e.theme_soiree) {
          html += _highlightRow('🎭', 'Thème', pd.theme_soiree || e.theme_soiree, rgb);
        }
        if (pd.dress_code || e.dress_code) {
          html += _infoRow('👔', 'Dress code', pd.dress_code || e.dress_code, rgb);
        }
        if (pd.billet_entree || e.billet_entree) {
          html += _infoRow('🎟️', 'Entrée', _fmt_xaf(pd.billet_entree || e.billet_entree), rgb);
        }
        if (pd.ouverture_nuit || e.ouverture_nuit) {
          html += _infoRow('🌙', 'Ferme à', pd.ouverture_nuit || e.ouverture_nuit, rgb);
        }
        if (pd.vip_table || e.vip_table) {
          html += _boolBadge('⭐', 'Tables VIP disponibles', rgb);
        }
        break;

      /* ── SALLE ── */
      case 'Salle':
        if (pd.evenement || e.evenement_flash && e.evenement_flash.texte) {
          html += _highlightRow('🎉', 'Événement', pd.evenement || e.evenement_flash.texte, rgb);
        }
        if (pd.capacite_max || e.capacite_totale) {
          html += _infoRow('🪑', 'Capacité', (pd.capacite_max || e.capacite_totale) + ' personnes', rgb);
        }
        if (pd.tarif_location) {
          html += _infoRow('💰', 'Location dès', _fmt_xaf(pd.tarif_location), rgb);
        }
        html += _servicePills([
          pd.traiteur     && { icon: '🍱', label: 'Traiteur inclus' },
          pd.sono_incluse && { icon: '🔊', label: 'Sono incluse' },
          pd.climatisation && { icon: '❄️', label: 'Climatisation' }
        ], rgb);
        break;

      /* ── STADE ── */
      case 'Stade':
        if (pd.match_en_cours || e.match_en_cours) {
          html += _liveMatch(pd.match_en_cours || e.match_en_cours, pd.score_actuel || e.score_actuel, rgb);
        }
        if (pd.prochain_match || e.prochain_match) {
          html += _infoRow('📅', 'Prochain match', pd.prochain_match || e.prochain_match, rgb);
        }
        if (pd.tarif_tribune || e.tarif_tribune) {
          html += _infoRow('🎟️', 'Tribune dès', _fmt_xaf(pd.tarif_tribune || e.tarif_tribune), rgb);
        }
        if (pd.retransmission || e.retransmission) {
          html += _boolBadge('📺', 'Retransmission TV disponible', rgb);
        }
        break;

      /* ── TOURISME ── */
      case 'Tourisme':
        if (pd.horaires_ouverture || e.horaires) {
          html += _infoRow('🕐', 'Horaires', pd.horaires_ouverture || e.horaires, rgb);
        }
        if (pd.tarif_entree != null) {
          html += _infoRow('🎟️', 'Entrée', pd.tarif_entree > 0 ? _fmt_xaf(pd.tarif_entree) : 'Gratuit', rgb);
        }
        html += _servicePills([
          pd.guide_dispo  && { icon: '👤', label: 'Guide disponible' },
          pd.parking      && { icon: '🅿️', label: 'Parking' },
          pd.handicap     && { icon: '♿', label: 'Accès PMR' }
        ], rgb);
        if (e.description) {
          html += '<p style="font-size:0.68rem;color:rgba(255,240,248,0.6);line-height:1.55;margin-top:0.4rem;">'
            + _esc(e.description) + '</p>';
        }
        break;

      /* ── LOUNGE ── */
      case 'Lounge':
        if (pd.type_ambiance || e.ambiance) {
          html += _infoRow('✨', 'Ambiance', pd.type_ambiance || e.ambiance, rgb);
        }
        if (pd.code_vestim || e.dress_code) {
          html += _infoRow('👗', 'Code vestimentaire', pd.code_vestim || e.dress_code, rgb);
        }
        if (pd.reservation) {
          html += _boolBadge('📞', 'Réservation recommandée', rgb);
        }
        break;

      /* ── POKER ── */
      case 'Poker':
        if (pd.tournoi || e.tournoi) {
          html += _highlightRow('🏆', 'Tournoi', pd.tournoi || e.tournoi, rgb);
        }
        if (pd.mise_minimum || e.mise_minimum) {
          html += _infoRow('💵', 'Mise min.', _fmt_xaf(pd.mise_minimum || e.mise_minimum), rgb);
        }
        if (pd.membres_seuls) {
          html += _boolBadge('🔐', 'Membres uniquement', rgb);
        }
        break;

      default:
        html += _defaultAmbiance(e, rgb);
        break;
    }

    html += '</div>';
    return html;
  }

  /* ── HELPERS DE RENDU INTERNES ─────────────────────────────── */

  function _infoRow(icon, label, val, rgb) {
    if (!val) return '';
    return '<div style="display:flex;align-items:center;gap:0.4rem;margin-bottom:0.3rem;">'
      + '<span style="font-size:0.82rem;flex-shrink:0;">' + icon + '</span>'
      + '<span style="font-size:0.65rem;color:rgba(255,240,248,0.5);min-width:70px;">' + _esc(label) + '</span>'
      + '<span style="font-size:0.7rem;font-weight:700;color:rgba(255,240,248,0.9);">' + _esc(String(val)) + '</span>'
      + '</div>';
  }

  function _highlightRow(icon, label, val, rgb) {
    if (!val) return '';
    return '<div style="display:flex;align-items:center;gap:0.45rem;margin-bottom:0.35rem;'
      + 'background:rgba(' + rgb + ',0.08);border-radius:8px;padding:0.35rem 0.55rem;">'
      + '<span style="font-size:0.9rem;">' + icon + '</span>'
      + '<div>'
      + '<div style="font-size:0.58rem;color:rgba(' + rgb + ',0.8);text-transform:uppercase;letter-spacing:0.08em;font-weight:700;">' + _esc(label) + '</div>'
      + '<div style="font-size:0.78rem;font-weight:800;color:#fff0f8;font-family:\'Syne\',sans-serif;">' + _esc(String(val)) + '</div>'
      + '</div></div>';
  }

  function _boolBadge(icon, label, rgb) {
    return '<span style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.63rem;font-weight:700;'
      + 'background:rgba(' + rgb + ',0.1);border:1px solid rgba(' + rgb + ',0.3);border-radius:20px;'
      + 'padding:0.18rem 0.5rem;margin:0.12rem 0.12rem 0.12rem 0;color:rgba(' + rgb + ',0.95);">'
      + icon + ' ' + _esc(label) + '</span>';
  }

  function _servicePills(services, rgb) {
    var items = (services || []).filter(Boolean);
    if (!items.length) return '';
    var html = '<div style="display:flex;flex-wrap:wrap;gap:0.22rem;margin-top:0.35rem;">';
    items.forEach(function (s) {
      html += _boolBadge(s.icon, s.label, rgb);
    });
    html += '</div>';
    return html;
  }

  function _menuSection(menu, rgb) {
    if (!menu) return '';
    return '<div style="margin:0.4rem 0;padding:0.5rem 0.65rem;background:rgba(' + rgb + ',0.07);'
      + 'border-radius:10px;border:1px solid rgba(' + rgb + ',0.2);">'
      + '<div style="font-size:0.6rem;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;'
      + 'color:rgba(' + rgb + ',0.9);margin-bottom:0.3rem;">📋 Menu du jour</div>'
      + '<div style="font-size:0.7rem;color:rgba(255,240,248,0.8);line-height:1.6;white-space:pre-line;">'
      + _esc(menu) + '</div></div>';
  }

  function _starRating(val, rgb) {
    var n = parseInt(val) || 0;
    var stars = '';
    for (var i = 1; i <= 5; i++) {
      stars += '<span style="color:' + (i <= n ? '#ffd700' : 'rgba(255,255,255,0.2)') + ';font-size:0.9rem;">★</span>';
    }
    return '<div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.3rem;">'
      + '<span style="font-size:0.8rem;">⭐</span>'
      + '<span style="font-size:0.62rem;color:rgba(255,240,248,0.5);min-width:70px;">Classement</span>'
      + stars
      + '</div>';
  }

  function _availBadge(count, unit, rgb) {
    if (count == null) return '';
    var col = count > 5 ? rgb : count > 0 ? '255,165,0' : '255,68,102';
    var lbl = count > 0 ? count + ' ' + unit + (count > 1 ? 's' : '') + ' disponible' + (count > 1 ? 's' : '') : 'Complet';
    return '<div style="display:inline-flex;align-items:center;gap:0.35rem;padding:0.28rem 0.6rem;'
      + 'background:rgba(' + col + ',0.12);border:1px solid rgba(' + col + ',0.4);border-radius:20px;'
      + 'margin-bottom:0.35rem;">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:rgb(' + col + ');flex-shrink:0;"></span>'
      + '<span style="font-size:0.68rem;font-weight:700;color:rgb(' + col + ');">' + _esc(lbl) + '</span>'
      + '</div>';
  }

  function _liveMatch(match, score, rgb) {
    if (!match) return '';
    var html = '<div style="background:rgba(' + rgb + ',0.08);border-radius:10px;padding:0.5rem 0.65rem;margin-bottom:0.35rem;">';
    html += '<div style="display:flex;align-items:center;gap:0.3rem;margin-bottom:0.2rem;">'
      + '<span style="width:7px;height:7px;border-radius:50%;background:#ff4466;box-shadow:0 0 6px rgba(255,68,102,0.8);animation:pulse 1.2s infinite;flex-shrink:0;"></span>'
      + '<span style="font-size:0.58rem;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#ff4466;">En cours</span>'
      + '</div>';
    html += '<div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:0.8rem;color:#fff0f8;">'
      + _esc(match) + '</div>';
    if (score) {
      html += '<div style="font-size:1.1rem;font-weight:800;font-family:\'Syne\',sans-serif;color:#ffd700;text-align:center;margin-top:0.25rem;">'
        + _esc(score) + '</div>';
    }
    html += '</div>';
    return html;
  }

  function _defaultAmbiance(e, rgb) {
    return e.ambiance
      ? _infoRow('✨', 'Ambiance', e.ambiance, rgb)
      : '';
  }

  function _fmt_xaf(val) {
    if (!val) return '';
    return Number(val).toLocaleString('fr-FR') + ' XAF';
  }

  /* ══════════════════════════════════════════════════════════════
     §4  TEMPLATE FORMULAIRE GÉRANT (champs dynamiques par type)
     Injecté dans le panneau PRO d'édition de la fiche.
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Génère le formulaire de saisie des données spécifiques par type.
   * Rendu dans le panneau pro de gestion de la fiche (onglet "Infos").
   * @param {Object} e - données établissement
   * @param {boolean} isAdmin
   * @returns {string} HTML form string
   */
  function buildTypeSpecificForm(e, isAdmin) {
    var cfg    = resolveType(e.type || '');
    var pd     = e.pro_data || {};
    var rgb    = cfg.colorRgb;
    var eid    = e.id;

    var html = '<div class="etm-pro-form" data-etm-form="' + _esc(cfg.key) + '">';
    html += '<div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:0.78rem;'
      + 'color:rgba(' + rgb + ',0.95);margin-bottom:0.65rem;display:flex;align-items:center;gap:0.4rem;">'
      + cfg.icon + ' Données spécifiques — ' + _esc(cfg.label) + '</div>';

    Object.entries(cfg.fields).forEach(function (entry) {
      var fieldKey = entry[0];
      var field    = entry[1];
      var currentVal = pd[fieldKey] != null ? pd[fieldKey] : (e[fieldKey] != null ? e[fieldKey] : '');
      var inputId  = 'etm-field-' + eid + '-' + fieldKey;
      var saveCall = 'etmSaveField(' + eid + ',\'' + fieldKey + '\',\'' + _esc(field.type) + '\')';

      html += '<div class="etm-field-row" style="margin-bottom:0.55rem;">';
      html += '<label style="font-size:0.65rem;font-weight:700;color:rgba(255,240,248,0.55);'
        + 'display:flex;align-items:center;gap:0.3rem;margin-bottom:0.2rem;">'
        + field.emoji + ' ' + _esc(field.label) + '</label>';

      switch (field.type) {

        case 'bool':
          html += '<div style="display:flex;gap:0.5rem;">'
            + _btnToggle(inputId, 'Oui', currentVal === true || currentVal === 'true' || currentVal === 1, '#00ffaa', saveCall)
            + _btnToggle(inputId + '-no', 'Non', currentVal === false || currentVal === 'false' || currentVal === 0 || currentVal === '', '#ff4466', saveCall)
            + '</div>';
          break;

        case 'select':
          html += '<select id="' + inputId + '" onchange="' + saveCall + '" '
            + 'style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(' + rgb + ',0.25);'
            + 'border-radius:9px;color:#fff0f8;font-family:\'DM Sans\',sans-serif;font-size:0.82rem;'
            + 'padding:0.5rem 0.75rem;outline:none;">';
          (field.options || []).forEach(function (opt) {
            html += '<option value="' + _esc(opt) + '"' + (currentVal == opt ? ' selected' : '') + '>'
              + _esc(opt) + '</option>';
          });
          html += '</select>';
          break;

        case 'textarea':
          html += '<textarea id="' + inputId + '" rows="3" placeholder="' + _esc(field.placeholder || '') + '" '
            + 'style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(' + rgb + ',0.25);'
            + 'border-radius:9px;color:#fff0f8;font-family:\'DM Sans\',sans-serif;font-size:0.82rem;'
            + 'padding:0.5rem 0.75rem;outline:none;resize:vertical;box-sizing:border-box;">'
            + _esc(String(currentVal)) + '</textarea>';
          html += _saveBtn(saveCall, rgb);
          break;

        case 'number':
          html += '<input type="number" id="' + inputId + '" value="' + _esc(String(currentVal)) + '" '
            + 'placeholder="' + _esc(field.placeholder || '') + '" '
            + 'style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(' + rgb + ',0.25);'
            + 'border-radius:9px;color:#fff0f8;font-family:\'DM Sans\',sans-serif;font-size:0.82rem;'
            + 'padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;" '
            + 'onblur="' + saveCall + '">';
          break;

        default: /* text */
          html += '<input type="text" id="' + inputId + '" value="' + _esc(String(currentVal)) + '" '
            + 'placeholder="' + _esc(field.placeholder || '') + '" '
            + 'style="width:100%;background:rgba(255,255,255,0.04);border:1px solid rgba(' + rgb + ',0.25);'
            + 'border-radius:9px;color:#fff0f8;font-family:\'DM Sans\',sans-serif;font-size:0.82rem;'
            + 'padding:0.5rem 0.75rem;outline:none;box-sizing:border-box;" '
            + 'onblur="' + saveCall + '">';
          break;
      }

      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  function _saveBtn(call, rgb) {
    return '<button onclick="' + call + '" '
      + 'style="margin-top:0.3rem;padding:0.32rem 0.75rem;border-radius:7px;border:none;'
      + 'background:rgba(' + rgb + ',0.15);color:rgba(' + rgb + ',0.95);'
      + 'font-family:\'DM Sans\',sans-serif;font-weight:700;font-size:0.68rem;cursor:pointer;">'
      + '💾 Enregistrer</button>';
  }

  function _btnToggle(id, label, active, color, call) {
    return '<button id="' + id + '" onclick="etmToggleBool(\'' + id + '\',' + (label === 'Oui') + ');' + call + '" '
      + 'style="padding:0.3rem 0.8rem;border-radius:7px;border:1px solid ' + color + '40;cursor:pointer;'
      + 'font-family:\'DM Sans\',sans-serif;font-size:0.72rem;font-weight:700;'
      + 'background:' + (active ? color + '22' : 'rgba(255,255,255,0.03)') + ';'
      + 'color:' + (active ? color : 'rgba(255,240,248,0.4)') + ';">'
      + label + '</button>';
  }

  /* ══════════════════════════════════════════════════════════════
     §5  RENDERER — INJECTION DANS LES FICHES EXISTANTES
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Injecte la section spécifique dans une fiche déjà rendue.
   * Appeler après que renderCard() a produit le DOM.
   * @param {number|string} etabId
   * @param {Object} e - données établissement
   */
  function injectTypeSection(etabId, e) {
    var cardEl = document.getElementById('card-etab-' + etabId);
    if (!cardEl) return;

    /* Supprimer toute section précédente */
    var existing = cardEl.querySelector('.etm-specific-section');
    if (existing) existing.remove();

    /* Trouver le point d'insertion : avant .card-ambiance */
    var ambEl = cardEl.querySelector('.card-ambiance');
    if (!ambEl) return;

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildTypeSpecificSection(e);
    var section = wrapper.firstChild;

    ambEl.parentNode.insertBefore(section, ambEl);
  }

  /**
   * Injecte le formulaire pro dans le panneau de gestion.
   * @param {number|string} etabId
   * @param {Object} e
   */
  function injectTypeForm(etabId, e) {
    /* Cibler l'onglet "infos" du panneau pro */
    var paneInfos = document.getElementById('proPane-' + etabId + '-statut');
    if (!paneInfos) return;

    var existing = paneInfos.querySelector('.etm-pro-form');
    if (existing) existing.remove();

    var wrapper = document.createElement('div');
    wrapper.innerHTML = buildTypeSpecificForm(e, window.isAdmin || false);
    paneInfos.insertBefore(wrapper.firstChild, paneInfos.firstChild);
  }

  /**
   * Injecte les sections dans TOUTES les fiches visibles.
   * À appeler après renderAll().
   * @param {Array} etablissements - tableau global des établissements
   */
  function injectAllTypesSections(etablissements) {
    if (!Array.isArray(etablissements)) return;
    etablissements.forEach(function (e) {
      injectTypeSection(e.id, e);
    });
  }

  /* ══════════════════════════════════════════════════════════════
     §6  SAUVEGARDE DES CHAMPS SPÉCIFIQUES
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Sauvegarde un champ spécifique dans pro_data de l'établissement.
   * Appelé depuis les formulaires de type par onblur/onchange.
   * @param {number} eid
   * @param {string} fieldKey
   * @param {string} fieldType
   */
  function etmSaveField(eid, fieldKey, fieldType) {
    var inputId = 'etm-field-' + eid + '-' + fieldKey;
    var el = document.getElementById(inputId);
    if (!el) return;

    var val;
    if (fieldType === 'bool') {
      val = el.textContent === 'Oui' || el.getAttribute('data-active') === 'true';
    } else if (fieldType === 'number') {
      val = parseFloat(el.value) || 0;
    } else {
      val = el.value.trim();
    }

    /* Mise à jour locale */
    var etab = (window.etablissements || []).find(function (x) { return x.id === eid; });
    if (etab) {
      if (!etab.pro_data) etab.pro_data = {};
      etab.pro_data[fieldKey] = val;
      /* Re-injecter la section de présentation */
      injectTypeSection(eid, etab);
    }

    /* Persistance Firebase */
    if (window.db && window.fbDoc && window.fbUpdateDoc) {
      var update = {};
      update['pro_data.' + fieldKey] = val;
      window.fbUpdateDoc(window.fbDoc(window.db, 'etablissements', String(eid)), update)
        .then(function () {
          if (typeof window.showToast === 'function') window.showToast('✅ ' + fieldKey + ' mis à jour');
        })
        .catch(function (err) {
          if (typeof window.showToast === 'function') window.showToast('❌ Erreur: ' + err.message);
        });
    } else {
      if (typeof window.showToast === 'function') window.showToast('✅ Sauvegardé localement');
    }
  }

  /**
   * Bascule visuellement un bouton booléen dans le formulaire.
   * @param {string} btnId
   * @param {boolean} isYes
   */
  function etmToggleBool(btnId, isYes) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    btn.setAttribute('data-active', isYes ? 'true' : 'false');
  }

  /* ══════════════════════════════════════════════════════════════
     §7  CSS DYNAMIQUE — injection des styles par type
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Injecte une balise <link rel="stylesheet" href="css/style10.css">

<!-- ── BOUTON FAB ADMIN (visible uniquement admin) ── -->
<button id="adminQuickAddBtn" onclick="openAqaModal()" style="display:none;" title="Ajout rapide établissement">
  <span class="aqab-icon">🏢</span>
  <span>Ajout rapide</span>
</button>

<!-- ── MODAL AJOUT RAPIDE ADMIN ── -->
<div id="aqaOverlay" onclick="if(event.target===this)closeAqaModal()">
  <div id="aqaModal">

    <!-- HEADER -->
    <div class="aqa-header">
      <button class="aqa-close" onclick="closeAqaModal()">✕</button>
      <div class="aqa-header-title">🏢 Ajout rapide — Établissement</div>
      <div class="aqa-header-sub">Mode Admin · Enregistrement direct Firebase</div>
    </div>

    <!-- STEPPER -->
    <div class="aqa-stepper" id="aqaStepper">
      <div class="aqa-step active" data-step="0" onclick="aqaGoStep(0)">
        <div class="aqa-step-num">1</div>
        <div class="aqa-step-lbl">GPS</div>
      </div>
      <div class="aqa-step" data-step="1" onclick="aqaGoStep(1)">
        <div class="aqa-step-num">2</div>
        <div class="aqa-step-lbl">Infos</div>
      </div>
      <div class="aqa-step" data-step="2" onclick="aqaGoStep(2)">
        <div class="aqa-step-num">3</div>
        <div class="aqa-step-lbl">Type</div>
      </div>
      <div class="aqa-step" data-step="3" onclick="aqaGoStep(3)">
        <div class="aqa-step-num">4</div>
        <div class="aqa-step-lbl">Photos</div>
      </div>
      <div class="aqa-step" data-step="4" onclick="aqaGoStep(4)">
        <div class="aqa-step-num">5</div>
        <div class="aqa-step-lbl">Profil</div>
      </div>
      <div class="aqa-step" data-step="5" onclick="aqaGoStep(5)">
        <div class="aqa-step-num">6</div>
        <div class="aqa-step-lbl">Envoi</div>
      </div>
    </div>

    <!-- BODY -->
    <div class="aqa-body">

      <!-- ── ÉTAPE 1 : GPS ── -->
      <div class="aqa-section active" id="aqaStep0">
        <div class="aqa-gps-card">
          <div class="aqa-gps-icon">📍</div>
          <div class="aqa-gps-info">
            <div class="aqa-gps-title">Localisation définitive</div>
            <div class="aqa-gps-coords" id="aqaGpsCoords">Appuyez sur le bouton →</div>
            <div id="aqaGpsBadge"></div>
          </div>
          <button class="aqa-gps-btn" onclick="aqaGetGPS()">📡 Localiser</button>
        </div>
        <div class="aqa-field">
          <label>Adresse / Quartier <span class="req">*</span></label>
          <input type="text" id="aqaQuartier" class="aqa-input" placeholder="Ex: Akébé, Montagne Sainte, Batavéa…" maxlength="80">
        </div>
        <div style="font-size:0.68rem;color:var(--muted);line-height:1.6;background:rgba(0,229,255,0.05);border:1px solid rgba(0,229,255,0.15);border-radius:10px;padding:0.65rem 0.8rem;">
          📌 Les coordonnées GPS sont <strong style="color:var(--cyan)">définitives</strong> — elles fixent la position du marqueur sur la carte publique. Placez-vous au bon endroit avant de localiser.
        </div>
      </div>

      <!-- ── ÉTAPE 2 : INFOS ── -->
      <div class="aqa-section" id="aqaStep1">
        <div class="aqa-field">
          <label>Nom de l'établissement <span class="req">*</span></label>
          <input type="text" id="aqaNom" class="aqa-input" placeholder="Ex: Miami Club, Chez Tonton…" maxlength="60">
        </div>
        <div class="aqa-field">
          <label>Nom du gérant</label>
          <input type="text" id="aqaGerant" class="aqa-input" placeholder="Prénom Nom du gérant" maxlength="60">
        </div>
        <div class="aqa-row">
          <div class="aqa-field">
            <label>Téléphone</label>
            <input type="tel" id="aqaTel" class="aqa-input" placeholder="+241 XX XXX XXX">
          </div>
          <div class="aqa-field">
            <label>Email</label>
            <input type="email" id="aqaEmail" class="aqa-input" placeholder="contact@…">
          </div>
        </div>
        <div class="aqa-row">
          <div class="aqa-field">
            <label>Ouverture</label>
            <input type="text" id="aqaOuv" class="aqa-input" placeholder="18h00">
          </div>
          <div class="aqa-field">
            <label>Fermeture</label>
            <input type="text" id="aqaFerm" class="aqa-input" placeholder="02h00">
          </div>
        </div>
        <div class="aqa-field">
          <label>Description courte</label>
          <textarea id="aqaDesc" class="aqa-input" placeholder="Ambiance, spécialités, ce qui le rend unique…" maxlength="250"></textarea>
        </div>
        <div class="aqa-field" style="margin-top:0.5rem;">
          <label>🔑 Mot de passe gérant <span class="req">*</span></label>
          <div style="position:relative;">
            <input type="password" id="aqaMdp" class="aqa-input" placeholder="Min. 6 caractères" minlength="6" maxlength="40" autocomplete="new-password" style="padding-right:2.6rem;">
            <button type="button" onclick="(function(){var i=document.getElementById('aqaMdp');i.type=i.type==='password'?'text':'password';})()" style="position:absolute;right:0.6rem;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;color:rgba(255,255,255,0.5);">👁</button>
          </div>
          <div style="font-size:0.67rem;color:rgba(255,255,255,0.4);margin-top:0.3rem;">Ce mot de passe permettra au gérant de se connecter à son espace.</div>
        </div>
      </div>

      <!-- ── ÉTAPE 3 : TYPE / CATÉGORIE ── -->
      <div class="aqa-section" id="aqaStep2">
        <div class="aqa-field">
          <label>Catégorie principale <span class="req">*</span></label>
          <div class="aqa-cat-grid">
            <input type="radio" name="aqaCat" id="aqaCat1" value="Bar Lounge" class="aqa-cat-item">
            <label for="aqaCat1" class="aqa-cat-label"><span class="aqa-cat-emoji">🥃</span><span class="aqa-cat-name">Bar Lounge</span></label>

            <input type="radio" name="aqaCat" id="aqaCat2" value="Discotheque" class="aqa-cat-item">
            <label for="aqaCat2" class="aqa-cat-label"><span class="aqa-cat-emoji">🪩</span><span class="aqa-cat-name">Discothèque</span></label>

            <input type="radio" name="aqaCat" id="aqaCat3" value="Bar Terrasse" class="aqa-cat-item">
            <label for="aqaCat3" class="aqa-cat-label"><span class="aqa-cat-emoji">🌴</span><span class="aqa-cat-name">Bar Terrasse</span></label>

            <input type="radio" name="aqaCat" id="aqaCat4" value="Restaurant" class="aqa-cat-item">
            <label for="aqaCat4" class="aqa-cat-label"><span class="aqa-cat-emoji"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 40" width="1.1em" height="0.8em" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><line x1="10" y1="4" x2="10" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/><line x1="7" y1="4" x2="7" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="4" x2="13" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M7 16 Q10 20 13 16" fill="none" stroke="white" stroke-width="1.6"/><circle cx="28" cy="22" r="14" fill="none" stroke="white" stroke-width="2.2"/><circle cx="28" cy="22" r="9" fill="rgba(255,255,255,0.12)" stroke="white" stroke-width="1.2"/><circle cx="28" cy="22" r="3.5" fill="white" opacity="0.7"/><ellipse cx="46" cy="10" rx="3.5" ry="5" fill="none" stroke="white" stroke-width="2"/><line x1="46" y1="15" x2="46" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg></span><span class="aqa-cat-name">Restaurant</span></label>

            <input type="radio" name="aqaCat" id="aqaCat5" value="Cafe / Restaurant" class="aqa-cat-item">
            <label for="aqaCat5" class="aqa-cat-label"><span class="aqa-cat-emoji">☕</span><span class="aqa-cat-name">Café / Resto</span></label>

            <input type="radio" name="aqaCat" id="aqaCat6" value="Snack-Bar" class="aqa-cat-item">
            <label for="aqaCat6" class="aqa-cat-label"><span class="aqa-cat-emoji">🍢</span><span class="aqa-cat-name">Snack-Bar</span></label>

            <input type="radio" name="aqaCat" id="aqaCat7" value="Maquis" class="aqa-cat-item">
            <label for="aqaCat7" class="aqa-cat-label"><span class="aqa-cat-emoji">🔥</span><span class="aqa-cat-name">Maquis</span></label>

            <input type="radio" name="aqaCat" id="aqaCat8" value="Patisserie" class="aqa-cat-item">
            <label for="aqaCat8" class="aqa-cat-label"><span class="aqa-cat-emoji">🥐</span><span class="aqa-cat-name">Pâtisserie</span></label>

            <input type="radio" name="aqaCat" id="aqaCat10" value="Salle &amp; Cérémonie" class="aqa-cat-item">
            <label for="aqaCat10" class="aqa-cat-label"><span class="aqa-cat-emoji">🎪</span><span class="aqa-cat-name">Salles & Cérémonies</span></label>

            <input type="radio" name="aqaCat" id="aqaCat11" value="Stade de Football" class="aqa-cat-item">
            <label for="aqaCat11" class="aqa-cat-label"><span class="aqa-cat-emoji">⚽</span><span class="aqa-cat-name">Stade Football</span></label>

            <input type="radio" name="aqaCat" id="aqaCat12" value="Site Touristique" class="aqa-cat-item">
            <label for="aqaCat12" class="aqa-cat-label"><span class="aqa-cat-emoji">🏛️</span><span class="aqa-cat-name">Site Touristique</span></label>

            <input type="radio" name="aqaCat" id="aqaCat9" value="Autre" class="aqa-cat-item">
            <label for="aqaCat9" class="aqa-cat-label"><span class="aqa-cat-emoji">✨</span><span class="aqa-cat-name">Autre</span></label>
          </div>
        </div>
        <div class="aqa-field">
          <label>Statut à l'ouverture</label>
          <select id="aqaStatut" class="aqa-input">
            <option value="Ouvert - Anime">Ouvert — Animé</option>
            <option value="Ouvert - Calme">Ouvert — Calme</option>
            <option value="Ouvert - Bonde">Ouvert — Bondé</option>
            <option value="Ferme">Fermé (en cours d'installation)</option>
          </select>
        </div>
      </div>

      <!-- ── ÉTAPE 4 : PHOTOS ── -->
      <div class="aqa-section" id="aqaStep3">
        <div class="aqa-section-sep">Photo Extérieur</div>
        <div class="aqa-photo-zone" id="aqaZoneExt">
          <label for="aqaPhotoExt" class="aqa-photo-label-btn">
            📸 Ajouter photo extérieure
          </label>
          <input type="file" id="aqaPhotoExt" accept="image/*" style="display:none" onchange="aqaPreviewPhoto(this,'aqaPreviewExt','aqaNameExt')">
          <img id="aqaPreviewExt" class="aqa-photo-preview" alt="Extérieur">
          <span id="aqaNameExt" class="aqa-photo-name">Aucune photo</span>
        </div>

        <div class="aqa-section-sep">Photo Intérieur (si disponible)</div>
        <div class="aqa-photo-zone" id="aqaZoneInt">
          <label for="aqaPhotoInt" class="aqa-photo-label-btn" style="background:rgba(0,229,255,0.08);color:var(--cyan);">
            🏠 Ajouter photo intérieure
          </label>
          <input type="file" id="aqaPhotoInt" accept="image/*" style="display:none" onchange="aqaPreviewPhoto(this,'aqaPreviewInt','aqaNameInt')">
          <img id="aqaPreviewInt" class="aqa-photo-preview" alt="Intérieur">
          <span id="aqaNameInt" class="aqa-photo-name">Aucune photo (optionnel)</span>
        </div>
      </div>

      <!-- ── ÉTAPE 5 : PROFIL ORIGINALITÉ ── -->
      <div class="aqa-section" id="aqaStep4">

        <div class="aqa-section-sep">Capacité d'accueil</div>
        <div class="aqa-cap-chips" id="aqaCapChips">
          <div class="aqa-cap-chip" onclick="aqaSelCap(this,'<20')">Moins de 20</div>
          <div class="aqa-cap-chip" onclick="aqaSelCap(this,'20-50')">20 à 50</div>
          <div class="aqa-cap-chip" onclick="aqaSelCap(this,'50-100')">50 à 100</div>
          <div class="aqa-cap-chip" onclick="aqaSelCap(this,'100-200')">100 à 200</div>
          <div class="aqa-cap-chip" onclick="aqaSelCap(this,'200-500')">200 à 500</div>
          <div class="aqa-cap-chip" onclick="aqaSelCap(this,'>500')">500+</div>
        </div>
        <div class="aqa-row">
          <div class="aqa-field">
            <label>Places exactes (si connu)</label>
            <input type="number" id="aqaCapExact" class="aqa-input" placeholder="Ex: 120" min="0">
          </div>
          <div class="aqa-field">
            <label>Espaces VIP</label>
            <input type="number" id="aqaNbVip" class="aqa-input" placeholder="Ex: 5" min="0">
          </div>
        </div>

        <div class="aqa-section-sep">Originalité</div>
        <div class="aqa-slider-group">
          <div class="aqa-slider-header">
            <span class="aqa-slider-lbl">🌅 Vue / Panorama</span>
            <span class="aqa-slider-val" id="aqaVueVal">5</span>
          </div>
          <input type="range" class="aqa-slider" id="aqaVue" min="0" max="10" value="5" oninput="document.getElementById('aqaVueVal').textContent=this.value">
        </div>

        <div class="aqa-section-sep">Situation géographique</div>
        <div class="aqa-geo-grid">
          <input type="radio" name="aqaEspace" id="aqaEsp1" value="Espace ouvert" class="aqa-geo-item">
          <label for="aqaEsp1" class="aqa-geo-label">🌿 Espace ouvert</label>

          <input type="radio" name="aqaEspace" id="aqaEsp2" value="Espace fermé" class="aqa-geo-item">
          <label for="aqaEsp2" class="aqa-geo-label">🏛️ Espace fermé</label>

          <input type="radio" name="aqaEspace" id="aqaEsp3" value="En bordure de route" class="aqa-geo-item">
          <label for="aqaEsp3" class="aqa-geo-label">🛣️ Bord de route</label>

          <input type="radio" name="aqaEspace" id="aqaEsp4" value="Caché / Discret" class="aqa-geo-item">
          <label for="aqaEsp4" class="aqa-geo-label">🌑 Caché / Discret</label>

          <input type="radio" name="aqaEspace" id="aqaEsp5" value="Vue sur mer / fleuve" class="aqa-geo-item">
          <label for="aqaEsp5" class="aqa-geo-label">🌊 Vue mer / fleuve</label>

          <input type="radio" name="aqaEspace" id="aqaEsp6" value="En hauteur / Rooftop" class="aqa-geo-item">
          <label for="aqaEsp6" class="aqa-geo-label">🏙️ Rooftop</label>
        </div>

        <div class="aqa-section-sep">Ambiance sonore</div>
        <div class="aqa-ambiance-grid">
          <input type="checkbox" id="aqaSon1" value="Musique live" class="aqa-amb-item">
          <label for="aqaSon1" class="aqa-amb-label">🎸 Musique live</label>

          <input type="checkbox" id="aqaSon2" value="DJ" class="aqa-amb-item">
          <label for="aqaSon2" class="aqa-amb-label">🎧 DJ</label>

          <input type="checkbox" id="aqaSon3" value="Sono forte" class="aqa-amb-item">
          <label for="aqaSon3" class="aqa-amb-label">🔊 Sono forte</label>

          <input type="checkbox" id="aqaSon4" value="Ambiance douce" class="aqa-amb-item">
          <label for="aqaSon4" class="aqa-amb-label">🎶 Ambiance douce</label>

          <input type="checkbox" id="aqaSon5" value="Karaoké" class="aqa-amb-item">
          <label for="aqaSon5" class="aqa-amb-label">🎤 Karaoké</label>

          <input type="checkbox" id="aqaSon6" value="Calme / Cosy" class="aqa-amb-item">
          <label for="aqaSon6" class="aqa-amb-label">🌙 Calme / Cosy</label>

          <input type="checkbox" id="aqaSon7" value="Écrans sports" class="aqa-amb-item">
          <label for="aqaSon7" class="aqa-amb-label">⚽ Écrans sports</label>

          <input type="checkbox" id="aqaSon8" value="Scène événements" class="aqa-amb-item">
          <label for="aqaSon8" class="aqa-amb-label">🎭 Scène événements</label>
        </div>
      </div>

      <!-- ── ÉTAPE 6 : RÉCAP + ENVOI ── -->
      <div class="aqa-section" id="aqaStep5">
        <div id="aqaRecap" style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:1rem;font-size:0.78rem;line-height:1.9;"></div>

        <!-- ── Connexion Firebase requise (mode Admin PIN sans compte Firebase) ── -->
        <div id="aqaAuthBox" style="display:none;margin-top:0.9rem;background:rgba(255,100,0,0.07);border:1.5px solid rgba(255,150,0,0.35);border-radius:14px;padding:1rem;">
          <div style="font-size:0.75rem;font-weight:800;color:#ffaa00;margin-bottom:0.6rem;">🔐 Connexion Firebase requise</div>
          <div style="font-size:0.68rem;color:var(--muted);margin-bottom:0.75rem;line-height:1.5;">Vous êtes en mode Admin PIN mais pas connecté à Firebase. Entrez vos identifiants administrateur pour enregistrer l'établissement.</div>
          <input type="email" id="aqaAuthEmail" placeholder="Email administrateur" autocomplete="email"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,150,0,0.3);border-radius:9px;padding:0.55rem 0.75rem;color:#fff;font-size:0.78rem;font-family:'DM Sans',sans-serif;margin-bottom:0.45rem;outline:none;">
          <input type="password" id="aqaAuthPwd" placeholder="Mot de passe" autocomplete="current-password"
            style="width:100%;background:rgba(255,255,255,0.06);border:1px solid rgba(255,150,0,0.3);border-radius:9px;padding:0.55rem 0.75rem;color:#fff;font-size:0.78rem;font-family:'DM Sans',sans-serif;margin-bottom:0.6rem;outline:none;">
          <div id="aqaAuthMsg" style="font-size:0.68rem;color:var(--red);min-height:1rem;margin-bottom:0.4rem;"></div>
          <button onclick="aqaDoSignIn()" id="aqaAuthBtn"
            style="width:100%;padding:0.6rem;border-radius:9px;background:linear-gradient(135deg,#ff9500,#ffaa00);border:none;color:#1a0a28;font-weight:800;font-size:0.82rem;font-family:'DM Sans',sans-serif;cursor:pointer;">
            🔑 Se connecter et créer l'établissement
          </button>
        </div>

        <div class="aqa-status-msg" id="aqaStatusMsg"></div>
        <!-- Debug panel Android -->
        <div id="aqaDebugBox" style="display:none;margin-top:0.8rem;background:rgba(0,0,0,0.5);border:1px solid rgba(0,229,255,0.25);border-radius:10px;padding:0.7rem;max-height:180px;overflow-y:auto;">
          <div style="font-size:0.6rem;font-weight:800;color:#00e5ff;margin-bottom:0.35rem;">&#128295; LOG DEBUG</div>
          <div id="aqaDebugLog" style="font-size:0.62rem;font-family:monospace;line-height:1.8;color:#aaddff;"></div>
        </div>
      </div>

    </div><!-- /aqa-body -->

    <!-- NAV -->
    <div class="aqa-nav">
      <button class="aqa-btn aqa-btn-prev" id="aqaPrevBtn" onclick="aqaNav(-1)" style="display:none;">← Retour</button>
      <button class="aqa-btn aqa-btn-next" id="aqaNextBtn" onclick="aqaNav(1)">Suivant →</button>
      <button class="aqa-btn aqa-btn-submit" id="aqaSubmitBtn" onclick="aqaSubmit()" style="display:none;">⚡ Créer l'établissement</button>
    </div>

  </div>
</div>

<!-- ── SCRIPT ── -->
<script>
(function() {
'use strict';

/* ── État ── */
var _step = 0;

/* ── Log debug Android ── */
function aqaLog(msg, color) {
  var box = document.getElementById('aqaDebugBox');
  var log = document.getElementById('aqaDebugLog');
  if (!box || !log) return;
  box.style.display = 'block';
  var line = document.createElement('div');
  line.style.color = color || '#aaddff';
  var ts = new Date().toTimeString().slice(0,8);
  line.textContent = '[' + ts + '] ' + msg;
  log.appendChild(line);
  box.scrollTop = box.scrollHeight;
}
var _totalSteps = 6;
var _gpsLat = null;
var _gpsLng = null;
var _capVal = '';

/* ── Ouverture / fermeture ── */
window.openAqaModal = function() {
  if (typeof window.isAdmin === 'undefined' ? false : !window.isAdmin) {
    if (typeof window.showToast === 'function') window.showToast('Accès admin requis');
    return;
  }
  _step = 0;
  _gpsLat = null; _gpsLng = null; _capVal = '';
  aqaReset();
  aqaRenderStep();
  document.getElementById('aqaOverlay').classList.add('show');
};

window.closeAqaModal = function() {
  document.getElementById('aqaOverlay').classList.remove('show');
};

/* ── Reset champs ── */
function aqaReset() {
  ['aqaQuartier','aqaNom','aqaGerant','aqaTel','aqaEmail','aqaOuv','aqaFerm','aqaDesc','aqaMdp','aqaCapExact','aqaNbVip'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('aqaGpsCoords').textContent = 'Appuyez sur le bouton →';
  document.getElementById('aqaGpsBadge').innerHTML = '';
  // radios
  ['aqaCat1','aqaCat2','aqaCat3','aqaCat4','aqaCat5','aqaCat6','aqaCat7','aqaCat8','aqaCat9','aqaCat10','aqaCat11','aqaCat12',
   'aqaEsp1','aqaEsp2','aqaEsp3','aqaEsp4','aqaEsp5','aqaEsp6'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.checked = false;
  });
  // checkboxes son
  ['aqaSon1','aqaSon2','aqaSon3','aqaSon4','aqaSon5','aqaSon6','aqaSon7','aqaSon8'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.checked = false;
  });
  // photos
  ['aqaPhotoExt','aqaPhotoInt'].forEach(function(id) { var el = document.getElementById(id); if (el) el.value = ''; });
  ['aqaPreviewExt','aqaPreviewInt'].forEach(function(id) { var el = document.getElementById(id); if (el) { el.src=''; el.style.display='none'; }});
  ['aqaNameExt','aqaNameInt'].forEach(function(id) { var el = document.getElementById(id); if (el) el.textContent = id==='aqaNameExt'?'Aucune photo':'Aucune photo (optionnel)'; });
  // sliders
  var sl = document.getElementById('aqaVue'); if (sl) { sl.value = 5; document.getElementById('aqaVueVal').textContent = '5'; }
  // caps
  document.querySelectorAll('.aqa-cap-chip').forEach(function(c) { c.classList.remove('sel'); });
  _capVal = '';
  // status
  var msg = document.getElementById('aqaStatusMsg'); if (msg) { msg.className = 'aqa-status-msg'; msg.textContent = ''; }
  // statut select default
  var stat = document.getElementById('aqaStatut'); if (stat) stat.value = 'Ouvert - Anime';
}

/* ── Rendu du step courant ── */
function aqaRenderStep() {
  // Sections
  for (var i = 0; i < _totalSteps; i++) {
    var sec = document.getElementById('aqaStep' + i);
    if (sec) sec.classList.toggle('active', i === _step);
  }
  // Stepper
  document.querySelectorAll('.aqa-step').forEach(function(el, idx) {
    el.classList.remove('active','done');
    if (idx === _step) el.classList.add('active');
    else if (idx < _step) el.classList.add('done');
  });
  // Boutons nav
  var prevBtn = document.getElementById('aqaPrevBtn');
  var nextBtn = document.getElementById('aqaNextBtn');
  var subBtn  = document.getElementById('aqaSubmitBtn');
  prevBtn.style.display = _step > 0 ? '' : 'none';
  nextBtn.style.display = _step < _totalSteps - 1 ? '' : 'none';
  subBtn.style.display  = _step === _totalSteps - 1 ? '' : 'none';
  // Récap si dernière étape
  if (_step === _totalSteps - 1) aqaBuildRecap();
}

window.aqaGoStep = function(s) {
  if (s > _step) return; // ne peut avancer qu'avec le bouton Suivant
  _step = s;
  aqaRenderStep();
};

window.aqaNav = function(dir) {
  if (dir > 0) {
    if (!aqaValidateStep()) return;
  }
  _step = Math.max(0, Math.min(_totalSteps - 1, _step + dir));
  aqaRenderStep();
};

/* ── Validation par étape ── */
function aqaValidateStep() {
  if (_step === 0) {
    var q = (document.getElementById('aqaQuartier').value || '').trim();
    if (!q) { aqaShake('aqaQuartier'); showMsg('Veuillez indiquer le quartier / adresse.','err'); return false; }
    return true;
  }
  if (_step === 1) {
    var n = (document.getElementById('aqaNom').value || '').trim();
    if (!n) { aqaShake('aqaNom'); showMsg('Le nom est obligatoire.','err'); return false; }
    if (_step === 1) {
      var mdp = (document.getElementById('aqaMdp').value || '').trim();
      if (!mdp || mdp.length < 6) { aqaShake('aqaMdp'); showMsg('Le mot de passe est obligatoire (6 caractères min.).','err'); return false; }
    }
    return true;
  }
  if (_step === 2) {
    var cat = document.querySelector('input[name="aqaCat"]:checked');
    if (!cat) { showMsg('Veuillez sélectionner une catégorie.','err'); return false; }
    return true;
  }
  return true;
}

function aqaShake(id) {
  var el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--red)';
  el.focus();
  setTimeout(function() { el.style.borderColor = ''; }, 1500);
}

function showMsg(txt, type) {
  // Toast rapide
  if (typeof window.showToast === 'function') window.showToast(txt);
}

/* ── GPS ── */
window.aqaGetGPS = function() {
  var coordEl = document.getElementById('aqaGpsCoords');
  var badgeEl = document.getElementById('aqaGpsBadge');
  coordEl.textContent = '⏳ Localisation en cours…';
  badgeEl.innerHTML = '';
  if (!navigator.geolocation) {
    coordEl.textContent = 'Géolocalisation non disponible';
    badgeEl.innerHTML = '<span class="aqa-gps-badge err">❌ Non supporté</span>';
    return;
  }
  navigator.geolocation.getCurrentPosition(function(pos) {
    _gpsLat = Math.round(pos.coords.latitude  * 1e6) / 1e6;
    _gpsLng = Math.round(pos.coords.longitude * 1e6) / 1e6;
    var acc = Math.round(pos.coords.accuracy);
    coordEl.textContent = _gpsLat + ', ' + _gpsLng;
    badgeEl.innerHTML = '<span class="aqa-gps-badge ok">✅ Précision ±' + acc + 'm</span>';
  }, function(err) {
    coordEl.textContent = 'Erreur : ' + err.message;
    badgeEl.innerHTML = '<span class="aqa-gps-badge err">❌ ' + err.message + '</span>';
  }, { enableHighAccuracy: true, timeout: 10000 });
};

/* ── Preview photo ── */
window.aqaPreviewPhoto = function(input, previewId, nameId) {
  var file = input.files && input.files[0];
  var prev = document.getElementById(previewId);
  var name = document.getElementById(nameId);
  if (!file) { if (prev) { prev.src=''; prev.style.display='none'; } if (name) name.textContent='Aucune photo'; return; }
  if (name) name.textContent = file.name.length > 30 ? file.name.substr(0,27)+'…' : file.name;
  var reader = new FileReader();
  reader.onload = function(e) { if (prev) { prev.src = e.target.result; prev.style.display = 'block'; } };
  reader.readAsDataURL(file);
};

/* ── Capacité chips ── */
window.aqaSelCap = function(el, val) {
  document.querySelectorAll('.aqa-cap-chip').forEach(function(c) { c.classList.remove('sel'); });
  el.classList.add('sel');
  _capVal = val;
};

/* ── Récapitulatif ── */
function aqaBuildRecap() {
  var cat = document.querySelector('input[name="aqaCat"]:checked');
  var esp = document.querySelector('input[name="aqaEspace"]:checked');
  var sons = Array.from(document.querySelectorAll('.aqa-amb-item:checked')).map(function(c) { return c.value; });
  var vue = document.getElementById('aqaVue') ? document.getElementById('aqaVue').value : '—';
  var extHas = document.getElementById('aqaPhotoExt') && document.getElementById('aqaPhotoExt').files && document.getElementById('aqaPhotoExt').files[0];
  var intHas = document.getElementById('aqaPhotoInt') && document.getElementById('aqaPhotoInt').files && document.getElementById('aqaPhotoInt').files[0];

  function row(icon, label, val) {
    if (!val) return '';
    return '<div style="display:flex;gap:0.5rem;align-items:baseline;border-bottom:1px solid rgba(255,255,255,0.04);padding:0.2rem 0;">'
      + '<span style="font-size:0.9rem;">' + icon + '</span>'
      + '<span style="color:var(--muted);font-size:0.7rem;min-width:90px;">' + label + '</span>'
      + '<span style="color:var(--text);font-weight:700;font-size:0.78rem;">' + val + '</span>'
      + '</div>';
  }
  var html = '';
  html += row('🏢', 'Nom', (document.getElementById('aqaNom')||{}).value);
  html += row('👤', 'Gérant', (document.getElementById('aqaGerant')||{}).value);
  html += row('📞', 'Téléphone', (document.getElementById('aqaTel')||{}).value);
  html += row('📧', 'Email', (document.getElementById('aqaEmail')||{}).value);
  html += row('🔑', 'Mot de passe', (document.getElementById('aqaMdp')||{}).value ? '••••••' : '—');
  html += row('📍', 'Quartier', (document.getElementById('aqaQuartier')||{}).value);
  html += row('🌐', 'GPS', _gpsLat ? _gpsLat + ', ' + _gpsLng : '<em style="color:var(--red)">Non capturé</em>');
  html += row('🏷️', 'Type', cat ? cat.value : '—');
  html += row('🕐', 'Horaires', ((document.getElementById('aqaOuv')||{}).value||'—') + ' → ' + ((document.getElementById('aqaFerm')||{}).value||'—'));
  html += row('👥', 'Capacité', _capVal || ((document.getElementById('aqaCapExact')||{}).value ? (document.getElementById('aqaCapExact').value + ' places') : '—'));
  html += row('🌅', 'Vue / Score', vue + ' / 10');
  html += row('🗺️', 'Situation', esp ? esp.value : '—');
  html += row('🔊', 'Ambiance sonore', sons.length ? sons.join(', ') : '—');
  html += row('📸', 'Photo extérieure', extHas ? '✅ ' + document.getElementById('aqaPhotoExt').files[0].name : '❌ Aucune');
  html += row('🏠', 'Photo intérieure', intHas ? '✅ ' + document.getElementById('aqaPhotoInt').files[0].name : '— optionnel');
  document.getElementById('aqaRecap').innerHTML = html;
}

/* ── Upload photo helper ── */
function aqaUploadPhoto(inputId, path) {
  return new Promise(function(resolve) {
    var inp = document.getElementById(inputId);
    var file = inp && inp.files && inp.files[0];
    if (!file) { resolve(''); return; }
    if (!window.fbRef || !window.fbStorage || !window.fbUploadBytes || !window.fbGetDownloadURL) {
      console.warn('[AQA] Firebase Storage non disponible pour', inputId);
      resolve(''); return;
    }
    // ⏱️ Timeout de sécurité : 30s max par photo pour éviter le blocage infini
    var _done = false;
    var _timeout = setTimeout(function() {
      if (!_done) { _done = true; console.warn('[AQA] Timeout upload photo:', inputId); aqaLog('⏱️ TIMEOUT upload ' + inputId, '#ff4466'); resolve(''); }
    }, 30000);
    function done(val) { if (!_done) { _done = true; clearTimeout(_timeout); resolve(val); } }

    var reader = new FileReader();
    reader.onload = function(ev) {
      var img = new Image();
      img.onload = function() {
        var maxDim = 900; var w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) { var r = Math.min(maxDim/w, maxDim/h); w=Math.round(w*r); h=Math.round(h*r); }
        var canvas = document.createElement('canvas'); canvas.width=w; canvas.height=h;
        canvas.getContext('2d').drawImage(img,0,0,w,h);
        canvas.toBlob(function(blob) {
          // 🛡️ Guard : blob null possible si canvas tainté ou mémoire insuffisante
          if (!blob) { console.warn('[AQA] canvas.toBlob() a retourné null pour', inputId); done(''); return; }
          var ref = window.fbRef(window.fbStorage, path);
          window.fbUploadBytes(ref, blob)
            .then(function() { return window.fbGetDownloadURL(ref); })
            .then(function(url) { done(url); })
            .catch(function(err) { console.warn('[AQA] Erreur upload Storage:', err.message || err); aqaLog('❌ Storage err: ' + (err.message || err.code || err), '#ff4466'); done(''); });
        }, 'image/jpeg', 0.88);
      };
      img.onerror = function() { done(''); };
      img.src = ev.target.result;
    };
    reader.onerror = function() { done(''); };
    reader.readAsDataURL(file);
  });
}

/* ── Connexion Firebase depuis le modal AQA ── */
window.aqaDoSignIn = function() {
  var email = (document.getElementById('aqaAuthEmail').value || '').trim();
  var pwd   = (document.getElementById('aqaAuthPwd').value  || '');
  var msgEl = document.getElementById('aqaAuthMsg');
  var btn   = document.getElementById('aqaAuthBtn');

  if (!email || !pwd) {
    msgEl.textContent = '⚠️ Remplissez email et mot de passe.'; return;
  }
  if (!window.fbSignIn || !window.auth) {
    msgEl.textContent = '❌ Firebase Auth non disponible. Rechargez la page.'; return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Connexion…';
  msgEl.style.color = 'var(--muted)';
  msgEl.textContent = 'Connexion en cours…';

  window.fbSignIn(window.auth, email, pwd).then(function() {
    msgEl.style.color = 'var(--green)';
    msgEl.textContent = '✅ Connecté ! Envoi en cours…';
    btn.textContent = '✅ Connecté';
    document.getElementById('aqaAuthBox').style.display = 'none';
    // Relancer la soumission maintenant que l'auth est OK
    setTimeout(function() { window.aqaSubmit(); }, 400);
  }).catch(function(err) {
    btn.disabled = false;
    btn.textContent = '🔑 Se connecter et créer l\'établissement';
    msgEl.style.color = 'var(--red)';
    if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msgEl.textContent = '❌ Email ou mot de passe incorrect.';
    } else if (err.code === 'auth/too-many-requests') {
      msgEl.textContent = '🚫 Trop de tentatives. Réessayez dans quelques minutes.';
    } else {
      msgEl.textContent = '❌ Erreur : ' + (err.message || err.code);
    }
  });
};

/* ── Soumission Firebase ── */
window.aqaSubmit = function() {
  var nom = (document.getElementById('aqaNom').value || '').trim();
  var quartier = (document.getElementById('aqaQuartier').value || '').trim();
  var cat = document.querySelector('input[name="aqaCat"]:checked');

  if (!nom || !quartier || !cat) {
    var msgEl = document.getElementById('aqaStatusMsg');
    msgEl.className = 'aqa-status-msg err';
    msgEl.textContent = '❌ Données incomplètes — vérifiez nom, quartier et catégorie.';
    return;
  }

  if (!window.fbDoc || !window.db || !window.fbSetDoc) {
    var msgEl2 = document.getElementById('aqaStatusMsg');
    msgEl2.className = 'aqa-status-msg err';
    msgEl2.textContent = '❌ Firebase non disponible. Vérifiez votre connexion.';
    return;
  }

  // ── Vérification Firebase Auth ──
  // Le mode Admin PIN est local. Firestore/Storage exigent un utilisateur authentifié.
  if (!window.auth || !window.auth.currentUser) {
    var msgElAuth = document.getElementById('aqaStatusMsg');
    msgElAuth.className = 'aqa-status-msg err';
    msgElAuth.textContent = '⚠️ Connexion Firebase requise (mode Admin PIN détecté sans session Firebase).';
    var authBox = document.getElementById('aqaAuthBox');
    if (authBox) {
      authBox.style.display = 'block';
      var authMsgEl = document.getElementById('aqaAuthMsg');
      if (authMsgEl) { authMsgEl.style.color = 'var(--muted)'; authMsgEl.textContent = ''; }
    }
    aqaLog('⚠️ Non authentifié Firebase — formulaire de connexion affiché', '#ffaa00');
    return;
  }

  var subBtn = document.getElementById('aqaSubmitBtn');
  var prevBtn = document.getElementById('aqaPrevBtn');
  subBtn.disabled = true; prevBtn.disabled = true;
  subBtn.textContent = '⏳ Envoi en cours…';

  var msgEl3 = document.getElementById('aqaStatusMsg');
  msgEl3.className = 'aqa-status-msg loading';
  msgEl3.textContent = '⏳ Upload des photos et enregistrement…';

  // Reset debug log
  var dbgLog = document.getElementById('aqaDebugLog');
  if (dbgLog) dbgLog.innerHTML = '';
  aqaLog('Démarrage envoi…', '#00e5ff');
  aqaLog('Firebase db: ' + (window.db ? '✅' : '❌'), window.db ? '#00ffaa' : '#ff4466');
  aqaLog('Firebase storage: ' + (window.fbStorage ? '✅' : '❌'), window.fbStorage ? '#00ffaa' : '#ff4466');

  // Générer ID
  var maxId = (window.etablissements || []).reduce(function(m, e) { return Math.max(m, e.id || 0); }, 0);
  var newId = maxId + 1;
  var docId = 'etab_' + String(newId).padStart(3, '0');
  aqaLog('ID généré: ' + docId, '#ffd700');

  // Collect data
  var esp  = document.querySelector('input[name="aqaEspace"]:checked');
  var sons = Array.from(document.querySelectorAll('.aqa-amb-item:checked')).map(function(c) { return c.value; });
  var vue  = parseInt((document.getElementById('aqaVue') || {}).value) || 5;
  var capExact = parseInt((document.getElementById('aqaCapExact') || {}).value) || 0;
  var nbVip = parseInt((document.getElementById('aqaNbVip') || {}).value) || 0;

  aqaLog('Upload photos en cours…', '#00e5ff');
  var _extHas = document.getElementById('aqaPhotoExt') && document.getElementById('aqaPhotoExt').files && document.getElementById('aqaPhotoExt').files[0];
  var _intHas = document.getElementById('aqaPhotoInt') && document.getElementById('aqaPhotoInt').files && document.getElementById('aqaPhotoInt').files[0];
  aqaLog('Photo ext: ' + (_extHas ? '📷 ' + document.getElementById('aqaPhotoExt').files[0].name : 'aucune'));
  aqaLog('Photo int: ' + (_intHas ? '📷 ' + document.getElementById('aqaPhotoInt').files[0].name : 'aucune'));

  Promise.all([
    aqaUploadPhoto('aqaPhotoExt', 'etablissements/' + docId + '/photo_exterieur.jpg'),
    aqaUploadPhoto('aqaPhotoInt', 'etablissements/' + docId + '/photo_interieur.jpg')
  ]).then(function(urls) {
    aqaLog('Photos OK → ext:' + (urls[0] ? '✅' : '⚠️ vide') + ' int:' + (urls[1] ? '✅' : '⚠️ vide'), '#00ffaa');
    aqaLog('Écriture Firestore…', '#00e5ff');

    var now = new Date().toISOString();
    var data = {
      id: newId,
      nom: nom,
      type: cat.value,
      quartier: quartier,
      gerant: (document.getElementById('aqaGerant').value || '').trim(),
      contact: (document.getElementById('aqaTel').value || '').trim(),
      email: (document.getElementById('aqaEmail').value || '').trim(),
      ouverture: (document.getElementById('aqaOuv').value || '').trim() || '18h00',
      fermeture: (document.getElementById('aqaFerm').value || '').trim() || '02h00',
      description: (document.getElementById('aqaDesc').value || '').trim(),
      statut: (document.getElementById('aqaStatut').value) || 'Ouvert - Anime',
      affluence: 50,
      note: 0,
      avis: 0,
      paiement: 'Actif (Admin)',
      ambiance: 'Festif',
      // Géolocalisation
      lat: _gpsLat,
      lng: _gpsLng,
      geolocalisé: !!_gpsLat,
      // Photos
      photo_exterieur: urls[0] || '',
      photo_interieur: urls[1] || '',
      // Capacité
      capacite_tranche: _capVal || '',
      capacite_totale: capExact,
      nb_vip: nbVip,
      // Originalité
      score_vue: vue,
      situation_geo: esp ? esp.value : '',
      ambiance_sonore: sons,
      // Méta
      created_at: now,
      created_by: 'admin_quick_add',
      password: (document.getElementById('aqaMdp') ? (document.getElementById('aqaMdp').value || '').trim() : ''),
      maps_url: _gpsLat ? 'https://maps.google.com/?q=' + _gpsLat + ',' + _gpsLng : '',
      affluence_tendance: 'Stable',
      places_dispo: 0
    };

    var docRef = window.fbDoc(window.db, 'etablissements', docId);
    return window.fbSetDoc(docRef, data);

  }).then(function() {
    aqaLog('✅ Firestore écrit avec succès !', '#00ffaa');
    msgEl3.className = 'aqa-status-msg ok';
    msgEl3.textContent = '✅ Établissement créé avec succès dans Firebase !';
    subBtn.textContent = '✅ Créé !';
    if (typeof window.loadData === 'function') window.loadData();
    setTimeout(function() { window.closeAqaModal(); }, 2200);

  }).catch(function(err) {
    console.error('[AQA] Erreur aqaSubmit:', err);
    aqaLog('❌ ERREUR: ' + (err && (err.message || err.code) ? (err.message || err.code) : JSON.stringify(err)), '#ff4466');
    msgEl3.className = 'aqa-status-msg err';
    msgEl3.textContent = '❌ Erreur : ' + (err && (err.message || err.code) ? (err.message || err.code) : JSON.stringify(err));
    subBtn.disabled = false; prevBtn.disabled = false;
    subBtn.textContent = '⚡ Créer l\'établissement';
  });
};

/* ── Afficher le bouton FAB uniquement quand admin connecté ── */
function aqaCheckAdminBtn() {
  var btn = document.getElementById('adminQuickAddBtn');
  if (!btn) return;
  // Visible uniquement sur l'onglet home (nav index 0) ET si isAdmin
  var isAdm = typeof window.isAdmin !== 'undefined' ? window.isAdmin : false;
  btn.style.display = isAdm ? 'flex' : 'none';
}

// PERF: _aqaInterval corrigé — s'arrête dès Firebase prêt, max 30s au lieu de 60s
var _aqaInterval = setInterval(function() {
  aqaCheckAdminBtn();
  if (typeof window.currentUserUID !== 'undefined' && window.currentUserUID) {
    clearInterval(_aqaInterval); // arrêt immédiat dès que Firebase est prêt
  }
}, 1200);
// Sécurité : arrêt forcé après 30s quoi qu'il arrive
setTimeout(function() { clearInterval(_aqaInterval); }, 30000);

// Exposer globalement pour appel depuis les handlers PIN/toggleAdmin
window.aqaCheckAdminBtn = aqaCheckAdminBtn;

// Vérification initiale
document.addEventListener('DOMContentLoaded', function() {
  setTimeout(aqaCheckAdminBtn, 2000);
});

// Permettre au bouton existant dans adminTabs de pointer vers le nouveau modal
window.openAdminAddModal = window.openAqaModal;
})();
