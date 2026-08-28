
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
   * Injecte une balise <style> avec les variables CSS de couleur par type.
   * Chaque fiche reçoit --etm-color et --etm-rgb calculés à la volée.
   */
  function injectTypeStyles() {
    var id = 'etm-dynamic-styles';
    if (document.getElementById(id)) return; /* éviter les doublons */

    var css = '';

    Object.values(TYPE_REGISTRY).forEach(function (cfg) {
      css += '.card[data-etm-type="' + cfg.key + '"] { --etm-color: ' + cfg.color + '; --etm-rgb: ' + cfg.colorRgb + '; }\n';
    });

    /* Badge catégorie améliorés */
    css += `
/* ── ETM Badge overrides ── */
.cb-bar           { background: rgba(255,20,147,0.12)  !important; color: #ff1493  !important; border-color: rgba(255,20,147,0.3)  !important; }
.cb-resto         { background: rgba(255,149,0,0.12)   !important; color: #ff9500  !important; border-color: rgba(255,149,0,0.3)   !important; }
.cb-club          { background: rgba(204,68,255,0.12)  !important; color: #cc44ff  !important; border-color: rgba(204,68,255,0.3)  !important; }
.cb-salle         { background: rgba(255,0,110,0.12)   !important; color: #ff006e  !important; border-color: rgba(255,0,110,0.3)   !important; }
.cb-stade         { background: rgba(0,255,170,0.12)   !important; color: #00ffaa  !important; border-color: rgba(0,255,170,0.3)   !important; }
.cb-tourisme      { background: rgba(255,215,0,0.12)   !important; color: #ffd700  !important; border-color: rgba(255,215,0,0.3)   !important; }
.cb-roof          { background: rgba(255,69,184,0.12)  !important; color: #ff45b8  !important; border-color: rgba(255,69,184,0.3)  !important; }


/* ── Section spécifique de type ── */
.etm-specific-section {
  transition: opacity 0.3s ease;
  animation: fadeIn 0.35s ease both;
}

/* ── Champs formulaire type ── */
.etm-field-row input:focus,
.etm-field-row textarea:focus,
.etm-field-row select:focus {
  outline: none !important;
  box-shadow: 0 0 0 2px rgba(255,45,155,0.3) !important;
  border-color: rgba(255,45,155,0.5) !important;
}
`;

    var style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ══════════════════════════════════════════════════════════════
     §8  HOOK AUTOMATIQUE SUR renderAll / renderCard
  ══════════════════════════════════════════════════════════════════ */

  /**
   * Patche window.renderAll pour appeler injectAllTypesSections après le rendu.
   * Attendre que renderAll soit défini (peut l'être après ce script).
   */
  function _hookRenderAll() {
    if (typeof window.renderAll !== 'function') {
      /* Reporter jusqu'à ce que renderAll existe */
      setTimeout(_hookRenderAll, 150);
      return;
    }
    var _originalRenderAll = window.renderAll;
    window.renderAll = function () {
      _originalRenderAll.apply(this, arguments);
      setTimeout(function () {
        if (window.etablissements) {
          injectAllTypesSections(window.etablissements);
        }
      }, 50);
    };
    console.log('[ETM] ✅ Hook renderAll installé');
  }

  /**
   * Patche buildEtabProfilePanel pour injecter les champs pro du type.
   */
  function _hookBuildProfilePanel() {
    if (typeof window.buildEtabProfilePanel !== 'function') {
      setTimeout(_hookBuildProfilePanel, 150);
      return;
    }
    var _originalBuild = window.buildEtabProfilePanel;
    window.buildEtabProfilePanel = function (e) {
      var result = _originalBuild.apply(this, arguments);
      /* Après rendu on injecte le form dans le DOM directement */
      setTimeout(function () { injectTypeForm(e.id, e); }, 80);
      return result;
    };
    console.log('[ETM] ✅ Hook buildEtabProfilePanel installé');
  }

  /* ══════════════════════════════════════════════════════════════
     §9  EXPOSITION PUBLIQUE
  ══════════════════════════════════════════════════════════════════ */

  window.AMBI241_ETM = {
    /* Registre */
    TYPE_REGISTRY,

    /* Helpers */
    resolveType,
    getTypeColor,
    getTypeLabel,
    getTypeIcon,
    getTypeSections,
    getTypeFields,

    /* Rendu HTML */
    buildTypeSpecificSection,
    buildTypeSpecificForm,

    /* Injection DOM */
    injectTypeSection,
    injectTypeForm,
    injectAllTypesSections,
    injectTypeStyles,

    /* Sauvegarde */
    etmSaveField,
    etmToggleBool
  };

  /* Exposer aussi au niveau global pour les onclick="" inline */
  window.etmSaveField   = etmSaveField;
  window.etmToggleBool  = etmToggleBool;

  /* ══════════════════════════════════════════════════════════════
     §10  INITIALISATION AUTOMATIQUE
  ══════════════════════════════════════════════════════════════════ */
  function _init() {
    injectTypeStyles();
    _hookRenderAll();
    _hookBuildProfilePanel();
    console.log('%c[AMBI241] 🏷️ Module Types Établissements v2.0 chargé', 'color:#cc44ff;font-size:13px;font-weight:bold;');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})(window);

  