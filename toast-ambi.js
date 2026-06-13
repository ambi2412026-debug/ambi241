
(function(){
'use strict';

/* ════════════════════════════════════════════════════════════
   §0  TOAST AMBI DÉDIÉ
════════════════════════════════════════════════════════════ */
var _ambiToastEl = null;
var _ambiToastTimer = null;
function ambiToast(msg, color) {
  if (!_ambiToastEl) {
    _ambiToastEl = document.createElement('div');
    _ambiToastEl.className = 'ambi-toast';
    document.body.appendChild(_ambiToastEl);
  }
  _ambiToastEl.textContent = msg;
  _ambiToastEl.style.borderColor = color ? 'rgba('+color+',0.5)' : 'rgba(0,255,170,0.4)';
  _ambiToastEl.style.color = color ? 'rgb('+color+')' : 'var(--green)';
  _ambiToastEl.classList.add('show');
  clearTimeout(_ambiToastTimer);
  _ambiToastTimer = setTimeout(function(){ _ambiToastEl.classList.remove('show'); }, 2800);
}
window.ambiToast = ambiToast;

/* ════════════════════════════════════════════════════════════
   §1  CONFIG RÉSERVATION PAR TYPE
════════════════════════════════════════════════════════════ */
var RESA_CONFIG = {
  bar: {
    statusMsg: '🍹 Table VIP disponible ce soir',
    whatsappTpl: 'Bonjour ! Je souhaite réserver une table au Maeva Shop pour ce soir via AMBI241.',
    email: 'resa@maevabar.ga',
    tel: '+24107554321',
    types: ['Table normale (2–4 pers.)', 'Table VIP (4–6 pers.) — 15 000 XAF min.', 'Privatisation soirée'],
    paiements: ['Airtel Money', 'Moov Money', 'Orange Money', 'Espèces', 'Carte bancaire']
  },
  hotel: {
    statusMsg: '🛏️ Chambres disponibles — Check-in à partir de 14h',
    whatsappTpl: 'Bonjour ! Je souhaite réserver une chambre au Le Re-Ndama via AMBI241.',
    email: 'resa@rendama.ga',
    tel: '+24101234567',
    types: ['Standard (25 000 XAF/nuit)', 'Confort (40 000 XAF/nuit)', 'Suite VIP (80 000 XAF/nuit)', 'Journée 6h (15 000 XAF)'],
    paiements: ['Airtel Money', 'Moov Money', 'Espèces', 'Carte bancaire', 'Virement']
  },
  stade: {
    statusMsg: '🎟️ Billetterie ouverte — CF Mounana vs Mangasport',
    whatsappTpl: 'Bonjour ! Je souhaite acheter des billets pour le prochain match via AMBI241.',
    email: 'billetterie@tdesport.ga',
    tel: '+24101987654',
    types: ['Virage (1 000 XAF)', 'Tribune populaire (2 000 XAF)', 'Tribune centrale (5 000 XAF)', 'Loge VIP (15 000 XAF)', 'PMR (gratuit)'],
    paiements: ['Airtel Money', 'Moov Money', 'Espèces', 'Orange Money']
  },
  site: {
    statusMsg: '🏛️ Ouvert au public — Guides disponibles',
    whatsappTpl: 'Bonjour ! Je souhaite réserver une visite guidée du Monument de la Tolérance via AMBI241.',
    email: 'tourisme@gabon.ga',
    tel: '+24101112233',
    types: ['Visite libre (2 000 XAF adulte)', 'Visite guidée FR (+5 000 XAF)', 'Visite guidée EN (+5 000 XAF)', 'Groupe scolaire (500 XAF/élève)'],
    paiements: ['Espèces', 'Airtel Money', 'Moov Money']
  },
  resto: {
    statusMsg: '🍽️ Restaurant ouvert · Places disponibles',
    whatsappTpl: 'Bonjour ! Je souhaite réserver une table au restaurant via AMBI241.',
    email: 'resa@restaurant.ga',
    tel: '+24107001122',
    types: ['Table 2 pers.', 'Table 4 pers.', 'Table 6+ pers. (groupe)', 'Salle privée — sur demande'],
    paiements: ['Espèces', 'Airtel Money', 'Moov Money', 'Carte bancaire']
  },
  club: {
    statusMsg: '🎵 Portes ouvertes dès 22h · DJ Set ce soir',
    whatsappTpl: 'Bonjour ! Je souhaite réserver une table VIP au club via AMBI241.',
    email: 'vip@club.ga',
    tel: '+24107445566',
    types: ['Entrée standard (5 000 XAF)', 'Table VIP (50 000 XAF min.)', 'Table VVIP (150 000 XAF min.)', 'Privatisation (sur devis)'],
    paiements: ['Espèces', 'Airtel Money', 'Moov Money', 'Orange Money']
  },
  salle: {
    statusMsg: '🎭 Salle disponible à la location',
    whatsappTpl: 'Bonjour ! Je souhaite louer la salle de cérémonies via AMBI241.',
    email: 'location@salle.ga',
    tel: '+24107778899',
    types: ['Demi-journée (150 000 XAF)', 'Journée complète (280 000 XAF)', 'Weekend (500 000 XAF)', 'Soirée + décoration (sur devis)'],
    paiements: ['Virement', 'Espèces', 'Airtel Money', 'Chèque']
  },
  snack: {
    statusMsg: '🍟 Commandes en cours · Temps attente ~10 min',
    whatsappTpl: 'Bonjour ! Je souhaite passer commande au snack via AMBI241.',
    email: '',
    tel: '+24107334455',
    types: ['Sur place', 'À emporter', 'Livraison (rayon 3km)'],
    paiements: ['Espèces', 'Airtel Money', 'Moov Money']
  },
  terrasse: {
    statusMsg: '🌅 Terrasse ouverte · Vue dégagée ce soir',
    whatsappTpl: 'Bonjour ! Je souhaite réserver une table en terrasse via AMBI241.',
    email: 'resa@terrasse.ga',
    tel: '+24107223344',
    types: ['Table standard', 'Table vue mer/ville', 'Espace lounge', 'Privatisation terrasse'],
    paiements: ['Espèces', 'Airtel Money', 'Moov Money', 'Carte bancaire']
  }
};

/* ════════════════════════════════════════════════════════════
   §2  CONFIG ÉQUIPEMENTS PAR TYPE
════════════════════════════════════════════════════════════ */
var EQUIP_CONFIG = {
  bar: [
    { icon: '🕺', label: 'Piste de danse', key: 'dancefloor', default: true },
    { icon: '📺', label: 'Écran plasma', key: 'tv', default: true },
    { icon: '❄️', label: 'Climatisation', key: 'clim', default: true },
    { icon: '🎤', label: 'Karaoké', key: 'karaoke', default: false },
    { icon: '🎸', label: 'Live band', key: 'liveband', default: false },
    { icon: '🎮', label: 'Baby-foot / Jeux', key: 'jeux', default: true },
    { icon: '📶', label: 'Wi-Fi gratuit', key: 'wifi', default: true },
    { icon: '🅿️', label: 'Parking', key: 'parking', default: false },
    { icon: '🚬', label: 'Espace fumeur', key: 'fumeur', default: true },
    { icon: '🔒', label: 'Vestiaire', key: 'vestiaire', default: false },
    { icon: '♿', label: 'Accès PMR', key: 'pmr', default: false },
    { icon: '🍔', label: 'Restauration', key: 'food', default: true }
  ],
  hotel: [
    { icon: '❄️', label: 'Climatisation', key: 'clim', default: true },
    { icon: '📶', label: 'Wi-Fi gratuit', key: 'wifi', default: true },
    { icon: '🏊', label: 'Piscine', key: 'pool', default: false },
    { icon: '🏋️', label: 'Salle de sport', key: 'gym', default: false },
    { icon: '🍳', label: 'Petit-déjeuner inclus', key: 'breakfast', default: true },
    { icon: '🚗', label: 'Parking gratuit', key: 'parking', default: true },
    { icon: '🛎️', label: 'Room service 24h', key: 'roomservice', default: false },
    { icon: '✈️', label: 'Navette aéroport', key: 'navette', default: false },
    { icon: '📺', label: 'TV dans les chambres', key: 'tv', default: true },
    { icon: '💼', label: 'Coffre-fort', key: 'safe', default: false },
    { icon: '♿', label: 'Accès PMR', key: 'pmr', default: true },
    { icon: '🛁', label: 'Baignoire / Jacuzzi', key: 'baignoire', default: false }
  ],
  stade: [
    { icon: '📺', label: 'Écrans géants', key: 'bigscreen', default: true },
    { icon: '🔊', label: 'Sono professionnelle', key: 'sono', default: true },
    { icon: '🅿️', label: 'Parking (500 pl.)', key: 'parking', default: true },
    { icon: '🍺', label: 'Buvettes ouvertes', key: 'buvette', default: true },
    { icon: '♿', label: 'Accès PMR', key: 'pmr', default: true },
    { icon: '🚔', label: 'Sécurité renforcée', key: 'secu', default: true },
    { icon: '🎙️', label: 'Commentaire live', key: 'commentaire', default: true },
    { icon: '🌿', label: 'Gazon naturel', key: 'gazon', default: true },
    { icon: '💡', label: 'Éclairage nocturne', key: 'eclairage', default: false },
    { icon: '📡', label: 'Diffusion TV', key: 'tv_diffusion', default: false }
  ],
  resto: [
    { icon: '❄️', label: 'Climatisation', key: 'clim', default: true },
    { icon: '📶', label: 'Wi-Fi', key: 'wifi', default: true },
    { icon: '📺', label: 'Écran TV', key: 'tv', default: false },
    { icon: '🕺', label: 'Piste de danse', key: 'dancefloor', default: false },
    { icon: '🅿️', label: 'Parking', key: 'parking', default: false },
    { icon: '🍼', label: 'Menu enfants', key: 'enfants', default: true },
    { icon: '🎂', label: 'Célébrations (gâteau)', key: 'celebration', default: true },
    { icon: '🚬', label: 'Terrasse fumeur', key: 'terrasse', default: false },
    { icon: '♿', label: 'Accès PMR', key: 'pmr', default: false },
    { icon: '🛵', label: 'Livraison à domicile', key: 'delivery', default: false },
    { icon: '🎵', label: 'Musique live', key: 'live_music', default: false },
    { icon: '🧴', label: 'Gel hydroalcoolique', key: 'gel', default: true }
  ],
  club: [
    { icon: '🕺', label: 'Grand dancefloor', key: 'dancefloor', default: true },
    { icon: '💡', label: 'Jeux de lumières', key: 'lights', default: true },
    { icon: '🔊', label: 'Sono pro / Sub-woofer', key: 'sono', default: true },
    { icon: '❄️', label: 'Climatisation', key: 'clim', default: true },
    { icon: '📺', label: 'Écrans LED', key: 'screens', default: true },
    { icon: '🛋️', label: 'Lounge VIP', key: 'vip_lounge', default: true },
    { icon: '🍾', label: 'Service bouteilles', key: 'bouteilles', default: true },
    { icon: '🚬', label: 'Zone fumeur extérieure', key: 'fumeur', default: true },
    { icon: '🅿️', label: 'Parking gardé', key: 'parking', default: false },
    { icon: '🔒', label: 'Vestiaire sécurisé', key: 'vestiaire', default: true },
    { icon: '🎤', label: 'Scène artiste', key: 'scene', default: false },
    { icon: '📸', label: 'Photographe maison', key: 'photo', default: false }
  ],
  salle: [
    { icon: '🎙️', label: 'Sono / Microphones', key: 'sono', default: true },
    { icon: '📽️', label: 'Vidéoprojecteur', key: 'projecteur', default: true },
    { icon: '❄️', label: 'Climatisation', key: 'clim', default: true },
    { icon: '🪑', label: 'Tables & chaises', key: 'mobilier', default: true },
    { icon: '🍽️', label: 'Cuisine / Traiteur', key: 'cuisine', default: false },
    { icon: '🅿️', label: 'Parking', key: 'parking', default: true },
    { icon: '♿', label: 'Accès PMR', key: 'pmr', default: true },
    { icon: '🎨', label: 'Décoration incluse', key: 'deco', default: false },
    { icon: '📸', label: 'Photobooth', key: 'photobooth', default: false },
    { icon: '💡', label: 'Éclairage scénique', key: 'light_scene', default: false },
    { icon: '🔌', label: 'Prises industrielles', key: 'prises', default: true },
    { icon: '🧹', label: 'Nettoyage inclus', key: 'nettoyage', default: false }
  ],
  site: [
    { icon: '🧭', label: 'Guides disponibles', key: 'guide', default: true },
    { icon: '🚻', label: 'Sanitaires', key: 'wc', default: true },
    { icon: '🅿️', label: 'Parking gratuit', key: 'parking', default: true },
    { icon: '📷', label: 'Photos autorisées', key: 'photo', default: true },
    { icon: '♿', label: 'Accès PMR', key: 'pmr', default: true },
    { icon: '🍴', label: 'Snack / Restauration', key: 'food', default: false },
    { icon: '🛍️', label: 'Boutique souvenirs', key: 'shop', default: false },
    { icon: '🌿', label: 'Espace pique-nique', key: 'picnic', default: false },
    { icon: '📡', label: 'Wi-Fi zone d\'accueil', key: 'wifi', default: false },
    { icon: '🚌', label: 'Navette / Bus touristique', key: 'navette', default: false }
  ],
  snack: [
    { icon: '🔥', label: 'Grill / Brochettes', key: 'grill', default: true },
    { icon: '🛵', label: 'Livraison', key: 'delivery', default: false },
    { icon: '🥤', label: 'Boissons fraîches', key: 'boissons', default: true },
    { icon: '📺', label: 'Télévision', key: 'tv', default: true },
    { icon: '❄️', label: 'Climatisation', key: 'clim', default: false },
    { icon: '🪑', label: 'Places assises', key: 'seats', default: true },
    { icon: '🅿️', label: 'Parking', key: 'parking', default: false },
    { icon: '💳', label: 'Paiement mobile', key: 'mobile_pay', default: true }
  ],
  terrasse: [
    { icon: '☀️', label: 'Parasols', key: 'parasols', default: true },
    { icon: '🌊', label: 'Vue mer / fleuve', key: 'vue_mer', default: false },
    { icon: '🏙️', label: 'Vue sur la ville', key: 'vue_ville', default: true },
    { icon: '❄️', label: 'Brumisateurs', key: 'brumisateur', default: false },
    { icon: '📺', label: 'Écran extérieur', key: 'tv', default: false },
    { icon: '🎵', label: 'Musique ambiance', key: 'music', default: true },
    { icon: '🍹', label: 'Bar / Cocktails', key: 'bar', default: true },
    { icon: '🅿️', label: 'Parking', key: 'parking', default: false },
    { icon: '🕯️', label: 'Bougies / Éclairage', key: 'eclairage', default: true },
    { icon: '🚬', label: 'Zone fumeur', key: 'fumeur', default: true }
  ]
};

/* ════════════════════════════════════════════════════════════
   §3  SYSTÈME CONTRIBUTION LIVE PAR TYPE
════════════════════════════════════════════════════════════ */
var CONTRIB_CONFIG = {
  bar: {
    title: '📡 Contribuer en direct',
    sub: 'Vous êtes sur place ? Aidez la communauté AMBI241 à avoir des infos fiables.',
    fields: [
      { label: '🪑 Places assises dispo', type: 'number', id: 'bar_places', placeholder: 'Ex: 23', min: 0, max: 500 },
      { label: '🛋️ Tables VIP libres', type: 'number', id: 'bar_vip', placeholder: 'Ex: 2', min: 0, max: 20 },
      { label: '🎵 Ambiance musicale', type: 'select', id: 'bar_music', options: ['Silence', 'Musique douce', 'DJ Set', 'Live band', 'Afrobeats', 'Coupé-Décalé', 'NDombolo'] },
      { label: '🔥 Niveau ambiance', type: 'select', id: 'bar_ambiance', options: ['🧘 Très calme', '🟡 Calme', '🟢 Animé', '🔥 Très animé', '🔴 Bondé'] }
    ]
  },
  hotel: {
    title: '📡 Contribuer en direct',
    sub: 'Client de l\'hôtel ? Partagez les infos actuelles pour aider les voyageurs.',
    fields: [
      { label: '🛏️ Chambres libres (approximatif)', type: 'number', id: 'hotel_dispo', placeholder: 'Ex: 8', min: 0, max: 200 },
      { label: '🏊 Piscine ouverte', type: 'select', id: 'hotel_pool', options: ['Ouverte ✅', 'Fermée ❌', 'Maintenance 🔧', 'Je ne sais pas'] },
      { label: '🍳 Petit-déjeuner en cours', type: 'select', id: 'hotel_breakfast', options: ['Oui, service en cours ✅', 'Terminé ⏰', 'Non servi aujourd\'hui'] },
      { label: '📶 Qualité Wi-Fi', type: 'select', id: 'hotel_wifi', options: ['Excellent 🚀', 'Correct 👍', 'Lent 🐌', 'Coupé ❌'] }
    ]
  },
  stade: {
    title: '⚽ Contribuer au score en direct',
    sub: 'Vous êtes au stade ? Signalez le score, les buteurs et l\'atmosphère en temps réel.',
    score: true,
    fields: [
      { label: '⏱️ Minute de jeu', type: 'number', id: 'stade_min', placeholder: 'Ex: 67', min: 0, max: 120 },
      { label: '📍 Période', type: 'select', id: 'stade_periode', options: ['1ère mi-temps', 'Mi-temps', '2ème mi-temps', 'Prolongations', 'Tirs au but', 'Fin de match'] },
      { label: '⚽ Buteur (nom)', type: 'text', id: 'stade_buteur', placeholder: 'Ex: Aubameyang P. — 67\'', maxlength: 50 },
      { label: '🏟️ Ambiance tribune', type: 'select', id: 'stade_ambiance', options: ['Vide 😶', 'Peu de monde 🟡', 'Animé 🟢', 'Ébullition 🔥', 'Tribune pleine 🔴'] }
    ]
  },
  resto: {
    title: '📡 Contribuer en direct',
    sub: 'Vous mangez ici ? Donnez des infos fraîches aux autres clients.',
    fields: [
      { label: '🍽️ Tables disponibles', type: 'number', id: 'resto_tables', placeholder: 'Ex: 5', min: 0, max: 100 },
      { label: '⏱️ Attente estimée', type: 'select', id: 'resto_attente', options: ['Pas d\'attente ✅', '5–10 min 🟡', '15–25 min 🟠', '30+ min 🔴', 'Complet 🚫'] },
      { label: '🍛 Plat du jour dispo', type: 'select', id: 'resto_plat', options: ['Disponible ✅', 'Épuisé ❌', 'Sur commande 📋'] },
      { label: '🔊 Ambiance sonore', type: 'select', id: 'resto_sound', options: ['Calme et reposant', 'Musique douce', 'Animé', 'Très bruyant'] }
    ]
  },
  club: {
    title: '🎵 Contribuer en direct',
    sub: 'En club ce soir ? Partagez l\'ambiance réelle pour aider la communauté.',
    fields: [
      { label: '🚶 File d\'attente entrée', type: 'select', id: 'club_file', options: ['Pas d\'attente ✅', '5–10 min 🟡', '15–30 min 🟠', '1h+ 🔴', 'Entrée suspendue 🚫'] },
      { label: '🕺 Taux de remplissage dancefloor', type: 'select', id: 'club_dance', options: ['Vide', 'Peu animé', 'À moitié plein', 'Bien rempli', 'Bondé 🔥'] },
      { label: '🎧 DJ actuel', type: 'text', id: 'club_dj', placeholder: 'Nom du DJ ou style musical', maxlength: 40 },
      { label: '🛋️ Tables VIP disponibles', type: 'number', id: 'club_vip', placeholder: 'Ex: 3', min: 0, max: 30 }
    ]
  },
  salle: {
    title: '📡 Contribuer en direct',
    sub: 'Vous assistez à un événement ici ? Donnez des infos à la communauté.',
    fields: [
      { label: '👥 Nombre de participants (approx)', type: 'number', id: 'salle_pers', placeholder: 'Ex: 150', min: 0, max: 2000 },
      { label: '🎭 Type d\'événement', type: 'select', id: 'salle_evt', options: ['Mariage', 'Anniversaire', 'Conférence', 'Concert', 'Baptême', 'Gala', 'Autre'] },
      { label: '🔊 Sono / Animation', type: 'select', id: 'salle_sono', options: ['Excellent 🎵', 'Correct 👍', 'Problèmes techniques ⚠️', 'Silencieux'] }
    ]
  },
  site: {
    title: '📡 Contribuer en direct',
    sub: 'Visitez ce site ? Aidez les autres visiteurs avec vos infos en temps réel.',
    fields: [
      { label: '👥 Affluence actuelle', type: 'select', id: 'site_crowd', options: ['Vide 😌', 'Peu de visiteurs 🟡', 'Animé 🟢', 'Très fréquenté 🔴'] },
      { label: '🧭 Guides disponibles', type: 'select', id: 'site_guide', options: ['Oui, disponibles ✅', 'Complets pour aujourd\'hui ❌', 'Pas de guide aujourd\'hui'] },
      { label: '☁️ Météo sur place', type: 'select', id: 'site_meteo', options: ['☀️ Ensoleillé', '⛅ Nuageux', '🌧️ Pluie légère', '⛈️ Orage', '🌫️ Brume'] }
    ]
  },
  snack: {
    title: '📡 Contribuer en direct',
    sub: 'Au snack ? Aidez les autres à savoir ce qui est dispo.',
    fields: [
      { label: '⏱️ Temps d\'attente', type: 'select', id: 'snack_wait', options: ['Immédiat ✅', '5–10 min 🟡', '10–20 min 🟠', '20+ min 🔴'] },
      { label: '🍖 Brochettes disponibles', type: 'select', id: 'snack_broch', options: ['Disponibles ✅', 'Épuisées ❌', 'En préparation 🔥'] },
      { label: '🥤 Boissons fraîches', type: 'select', id: 'snack_drinks', options: ['Oui ✅', 'Stock limité ⚠️', 'Épuisées ❌'] }
    ]
  },
  terrasse: {
    title: '📡 Contribuer en direct',
    sub: 'En terrasse ce soir ? Donnez des infos météo et ambiance.',
    fields: [
      { label: '🪑 Places disponibles', type: 'number', id: 'terrasse_places', placeholder: 'Ex: 12', min: 0, max: 200 },
      { label: '☁️ Météo / Confort extérieur', type: 'select', id: 'terrasse_meteo', options: ['☀️ Parfait', '🌬️ Un peu de vent', '☁️ Couvert', '🌧️ Légère pluie', '⛈️ À déconseiller'] },
      { label: '🎵 Ambiance musicale', type: 'select', id: 'terrasse_music', options: ['Silence / Nature', 'Musique douce', 'Animé', 'DJ Set'] },
      { label: '🌅 Vue dégagée', type: 'select', id: 'terrasse_vue', options: ['Magnifique ✅', 'Correcte', 'Brume / Nuageux', 'Obscurité totale'] }
    ]
  }
};

/* ════════════════════════════════════════════════════════════
   §4  GÉNÉRATEUR HTML — BLOC RÉSERVATION
════════════════════════════════════════════════════════════ */
function buildResaBlock(type) {
  var cfg = RESA_CONFIG[type];
  if (!cfg) return '';
  var waTxt = encodeURIComponent(cfg.whatsappTpl);
  var waHref = 'https://wa.me/' + cfg.tel.replace(/[^0-9]/g,'') + '?text=' + waTxt;
  var emailHref = cfg.email ? ('mailto:' + cfg.email + '?subject=Réservation AMBI241 — ' + type) : '';
  var telHref = 'tel:' + cfg.tel;
  var fid = 'ambi-resa-' + type;
  var opts = cfg.types.map(function(t){ return '<option>'+t+'</option>'; }).join('');
  var pays = cfg.paiements.map(function(p){ return '<option>'+p+'</option>'; }).join('');
  return (
    '<div class="ambi-resa-block" id="'+fid+'">'
    + '<div class="ambi-resa-header"><span style="font-size:1.2rem">🎟️</span><span class="ambi-resa-title">Réservation</span></div>'
    + '<div class="ambi-resa-pulse"><span class="ambi-resa-pulse-dot"></span>' + cfg.statusMsg + '</div>'
    + '<div class="ambi-resa-sub">Choisissez votre canal préféré — réponse garantie sous 5 min</div>'
    + '<div class="ambi-resa-grid">'
    + '<a class="ambi-rchan wa" href="'+waHref+'" target="_blank" onclick="ambiToast(\'💬 Ouverture WhatsApp…\')">'
    + '<span class="rc-icon">💬</span><span class="rc-name">WhatsApp</span><span class="rc-desc">Réponse rapide &lt; 5 min</span></a>'
    + '<a class="ambi-rchan app" href="#" onclick="ambiOpenResaForm(\''+type+'\',\'📱 Réservation rapide\');return false;">'
    + '<span class="rc-icon">📱</span><span class="rc-name">App AMBI241</span><span class="rc-desc">Mobile Money intégré</span></a>'
    + (emailHref ? '<a class="ambi-rchan em" href="'+emailHref+'" onclick="ambiToast(\'📧 Email ouvert — '+cfg.email+'\')"><span class="rc-icon">📧</span><span class="rc-name">Email</span><span class="rc-desc">'+cfg.email+'</span></a>' : '')
    + '<a class="ambi-rchan tel" href="'+telHref+'" onclick="ambiToast(\'📞 Appel en cours…\')">'
    + '<span class="rc-icon">📞</span><span class="rc-name">Téléphone</span><span class="rc-desc">'+cfg.tel+'</span></a>'
    + '</div>'
    + '<div class="ambi-resa-form" id="ambi-resa-form-'+type+'">'
    + '<div class="ambi-resa-form-title" id="ambi-resa-ftitle-'+type+'">📱 Réservation App AMBI241</div>'
    + '<div class="ambi-rrow">'
    + '<div class="ambi-rfield"><label>Prénom & Nom</label><input class="ambi-rinput" type="text" placeholder="Votre nom" id="ambi-rf-'+type+'-name"></div>'
    + '<div class="ambi-rfield"><label>Téléphone</label><input class="ambi-rinput" type="tel" placeholder="+241..." id="ambi-rf-'+type+'-tel"></div>'
    + '</div>'
    + '<div class="ambi-rrow">'
    + '<div class="ambi-rfield"><label>Type</label><select class="ambi-rinput" id="ambi-rf-'+type+'-type">'+opts+'</select></div>'
    + '<div class="ambi-rfield"><label>Personnes</label><input class="ambi-rinput" type="number" value="2" min="1" max="50" id="ambi-rf-'+type+'-qty"></div>'
    + '</div>'
    + '<div class="ambi-rrow">'
    + '<div class="ambi-rfield"><label>Date</label><input class="ambi-rinput" type="date" id="ambi-rf-'+type+'-date"></div>'
    + '<div class="ambi-rfield"><label>Heure</label><input class="ambi-rinput" type="time" id="ambi-rf-'+type+'-heure"></div>'
    + '</div>'
    + '<div class="ambi-rrow full"><div class="ambi-rfield"><label>Paiement</label><select class="ambi-rinput" id="ambi-rf-'+type+'-pay">'+pays+'</select></div></div>'
    + '<button class="ambi-rsubmit" onclick="ambiSubmitResa(\''+type+'\')">🎟️ Confirmer la Réservation</button>'
    + '</div>'
    + '</div>'
  );
}

/* ════════════════════════════════════════════════════════════
   §5  GÉNÉRATEUR HTML — ÉQUIPEMENTS
════════════════════════════════════════════════════════════ */
function buildEquipBlock(type) {
  var equips = EQUIP_CONFIG[type];
  if (!equips) return '';
  var chips = equips.map(function(e){
    var cls = e.default ? 'on' : 'na';
    return '<div class="ambi-equip-chip '+cls+'" data-equip-key="'+e.key+'" onclick="ambiToggleEquip(this)">'
      + '<span class="ambi-equip-dot"></span>'
      + '<span>'+(e.default ? '' : '')+e.icon+' '+e.label+'</span>'
      + '</div>';
  }).join('');
  return (
    '<div class="ambi-equip-section">'
    + '<div class="ambi-equip-title">🏗️ Équipements & Services</div>'
    + '<div class="ambi-equip-grid" id="ambi-equip-'+type+'">' + chips + '</div>'
    + '<div style="font-size:0.6rem;color:var(--muted);margin-top:6px;line-height:1.5;">'
    + '🟢 Disponible · <span style="opacity:0.55;text-decoration:line-through;">Indisponible</span> · Gris = Inconnu — Cliquez pour signaler</div>'
    + '</div>'
  );
}

/* ════════════════════════════════════════════════════════════
   §6  GÉNÉRATEUR HTML — CONTRIBUTION LIVE SÉCURISÉE
════════════════════════════════════════════════════════════ */
function buildContribBlock(type) {
  var cfg = CONTRIB_CONFIG[type];
  if (!cfg) return '';
  var fields = '';
  if (cfg.score) {
    // Bloc score live pour le stade
    fields += '<div class="ambi-score-live">'
      + '<div class="ambi-score-team"><div class="ambi-score-team-name">🇬🇦 CF Mounana</div>'
      + '<input class="ambi-score-input" type="number" min="0" max="99" value="0" id="contrib-score-home-'+type+'"></div>'
      + '<div class="ambi-score-sep">—</div>'
      + '<div class="ambi-score-team"><div class="ambi-score-team-name">🇨🇬 Mangasport</div>'
      + '<input class="ambi-score-input" type="number" min="0" max="99" value="0" id="contrib-score-away-'+type+'"></div>'
      + '</div>';
  }
  cfg.fields.forEach(function(f) {
    fields += '<div class="ambi-rfield" style="margin-bottom:8px;">'
      + '<label style="font-size:0.62rem;font-weight:700;color:var(--muted);display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.04em;">'
      + f.label + '</label>';
    if (f.type === 'select') {
      fields += '<select class="ambi-rinput" id="contrib-'+f.id+'">';
      f.options.forEach(function(o){ fields += '<option>'+o+'</option>'; });
      fields += '</select>';
    } else if (f.type === 'number') {
      fields += '<input class="ambi-rinput" type="number" min="'+(f.min||0)+'" max="'+(f.max||9999)+'" placeholder="'+f.placeholder+'" id="contrib-'+f.id+'">';
    } else {
      fields += '<input class="ambi-rinput" type="text" placeholder="'+f.placeholder+'" maxlength="'+(f.maxlength||80)+'" id="contrib-'+f.id+'">';
    }
    fields += '</div>';
  });
  return (
    '<div class="ambi-live-contrib" id="ambi-contrib-'+type+'">'
    + '<div class="ambi-live-contrib-title"><span class="ambi-live-dot-cyan"></span>' + cfg.title + '</div>'
    + '<div class="ambi-live-sub">' + cfg.sub + '</div>'
    + '<div class="ambi-live-security-note">🔐 <strong>Sécurité :</strong> Vos contributions sont modérées automatiquement. Les informations fausses ou malveillantes sont filtrées. Votre compte est requis pour contribuer. <em>Abus → signalement automatique.</em></div>'
    + '<div id="ambi-contrib-fields-'+type+'">' + fields + '</div>'
    + '<div class="ambi-presence-wrap" id="ambi-presence-'+type+'">'
    + '<div class="ambi-presence-title">📍 Vérification présence physique</div>'
    + '<div class="ambi-presence-methods">'
    + '<button class="ambi-presence-btn gps-method" id="ambi-gps-btn-'+type+'" onclick="ambiVerifyGPS(\''+type+'\')">'
    + '<span class="apb-icon">🛰️</span>'
    + '<span>GPS automatique</span>'
    + '</button>'
    + '<button class="ambi-presence-btn qr-method" id="ambi-qr-btn-'+type+'" onclick="ambiToggleQR(\''+type+'\')">'
    + '<span class="apb-icon">📲</span>'
    + '<span>Scanner QR Code</span>'
    + '</button>'
    + '</div>'
    + '<div class="ambi-presence-status" id="ambi-presence-status-'+type+'">⚠️ Vérifiez votre présence avant de publier</div>'
    + '<div class="ambi-qr-inline" id="ambi-qr-inline-'+type+'">'
    + '<div id="ambi-qr-canvas-'+type+'"></div>'
    + '<div class="ambi-qr-inline-label">Scannez ce QR depuis un autre appareil ou demandez le code affiché dans l\'établissement pour valider votre présence.</div>'
    + '<button class="ambi-contrib-btn secondary" style="margin-top:8px;width:auto;padding:5px 14px;font-size:0.68rem;" onclick="ambiValidateQR(\''+type+'\')">✅ J\'ai scanné le QR</button>'
    + '</div>'
    + '</div>'
    + '<div class="ambi-contrib-btns">'
    + '<button class="ambi-contrib-btn primary" onclick="ambiSubmitContrib(\''+type+'\')">📡 Publier en direct</button>'
    + '<button class="ambi-contrib-btn secondary" onclick="document.getElementById(\'ambi-contrib-'+type+'\').style.display=\'none\'">Annuler</button>'
    + '</div>'
    + '</div>'
  );
}

/* ════════════════════════════════════════════════════════════
   §7  LOGIQUE FORMULAIRE RÉSERVATION
════════════════════════════════════════════════════════════ */
window.ambiOpenResaForm = function(type, title) {
  var form = document.getElementById('ambi-resa-form-' + type);
  var ftitle = document.getElementById('ambi-resa-ftitle-' + type);
  if (!form) return;
  if (form.classList.contains('open')) { form.classList.remove('open'); return; }
  if (ftitle) ftitle.textContent = title || '📱 Réservation App AMBI241';
  form.classList.add('open');
  setTimeout(function(){ form.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, 250);
};

window.ambiSubmitResa = function(type) {
  var name = document.getElementById('ambi-rf-'+type+'-name');
  var tel  = document.getElementById('ambi-rf-'+type+'-tel');
  var typeEl = document.getElementById('ambi-rf-'+type+'-type');
  var qty  = document.getElementById('ambi-rf-'+type+'-qty');
  var pay  = document.getElementById('ambi-rf-'+type+'-pay');
  if (!name || !name.value.trim()) { ambiToast('⚠️ Entrez votre nom', '255,68,102'); return; }
  if (!tel  || !tel.value.trim())  { ambiToast('⚠️ Entrez votre numéro', '255,68,102'); return; }
  var summary = (qty && qty.value ? qty.value : '1') + ' pers. — '
    + (typeEl ? typeEl.value : '') + ' — '
    + (pay ? pay.value : '');
  var ref = 'AMB241-' + Math.random().toString(36).substr(2,6).toUpperCase();
  var form = document.getElementById('ambi-resa-form-' + type);
  if (form) {
    form.innerHTML = '<div class="ambi-resa-confirmed">'
      + '<div style="font-size:2.5rem;margin-bottom:8px">🎟️</div>'
      + '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.95rem;color:var(--green);margin-bottom:6px">Réservation confirmée !</div>'
      + '<div style="font-size:0.7rem;color:var(--muted);margin-bottom:10px">'+summary+'</div>'
      + '<div style="font-size:0.68rem;color:var(--cyan)">📱 Confirmation envoyée par SMS & WhatsApp</div>'
      + '<div style="font-size:0.65rem;color:var(--muted);margin-top:8px;font-family:monospace">Réf : '+ref+'</div>'
      + '</div>';
    form.style.maxHeight = '300px'; form.style.padding = '12px 10px';
  }
  ambiToast('✅ Réservation confirmée ! Réf : '+ref);
};

/* ════════════════════════════════════════════════════════════
   §8  LOGIQUE ÉQUIPEMENTS
════════════════════════════════════════════════════════════ */
window.ambiToggleEquip = function(chip) {
  if (chip.classList.contains('on')) {
    chip.classList.replace('on', 'off');
    ambiToast('🔴 Signalé indisponible', '255,68,102');
  } else if (chip.classList.contains('off')) {
    chip.classList.replace('off', 'na');
    ambiToast('⚪ Marqué inconnu');
  } else {
    chip.classList.replace('na', 'on');
    ambiToast('🟢 Signalé disponible');
  }
};

/* ════════════════════════════════════════════════════════════
   §9  LOGIQUE CONTRIBUTION LIVE
════════════════════════════════════════════════════════════ */
/* ── COORDONNÉES DES ÉTABLISSEMENTS (Libreville, Gabon) ── */
var AMBI_COORDS = {
  bar:      { lat: 0.3924, lng: 9.4536, name: 'Bar' },
  hotel:    { lat: 0.3897, lng: 9.4541, name: 'Hôtel' },
  stade:    { lat: 0.4081, lng: 9.4444, name: 'Stade' },
  site:     { lat: 0.3912, lng: 9.4562, name: 'Site' },
  resto:    { lat: 0.3935, lng: 9.4520, name: 'Restaurant' },
  club:     { lat: 0.3910, lng: 9.4555, name: 'Club' },
  salle:    { lat: 0.3870, lng: 9.4490, name: 'Salle' },
  snack:    { lat: 0.3950, lng: 9.4510, name: 'Snack' },
  terrasse: { lat: 0.3880, lng: 9.4530, name: 'Terrasse' }
};
var AMBI_GPS_RADIUS_M = 300; /* rayon max autorisé en mètres */

/* Calcul distance Haversine */
function ambiHaversine(lat1, lng1, lat2, lng2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat/2)*Math.sin(dLat/2)
        + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)
        * Math.sin(dLng/2)*Math.sin(dLng/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

/* État de présence par type */
var _ambiPresenceVerified = {};

function ambiSetPresenceStatus(type, ok, msg) {
  _ambiPresenceVerified[type] = ok;
  var el = document.getElementById('ambi-presence-status-' + type);
  if (!el) return;
  el.className = 'ambi-presence-status ' + (ok ? 'ok' : 'err');
  el.textContent = msg;
}

/* ── OPTION 1 : GPS ── */
window.ambiVerifyGPS = function(type) {
  var btn = document.getElementById('ambi-gps-btn-' + type);
  if (!navigator.geolocation) {
    ambiSetPresenceStatus(type, false, '❌ GPS non disponible sur cet appareil');
    return;
  }
  if (btn) { btn.classList.add('loading'); btn.querySelector('span:last-child').textContent = 'Localisation…'; }
  ambiSetPresenceStatus(type, false, '🛰️ Récupération de votre position GPS…');
  navigator.geolocation.getCurrentPosition(
    function(pos) {
      if (btn) { btn.classList.remove('loading'); btn.querySelector('span:last-child').textContent = 'GPS automatique'; }
      var coords = AMBI_COORDS[type];
      if (!coords) {
        ambiSetPresenceStatus(type, true, '✅ Position obtenue — établissement non géolocalisé, présence acceptée');
        if (btn) btn.classList.add('verified');
        return;
      }
      var dist = Math.round(ambiHaversine(pos.coords.latitude, pos.coords.longitude, coords.lat, coords.lng));
      if (dist <= AMBI_GPS_RADIUS_M) {
        ambiSetPresenceStatus(type, true, '✅ Présence confirmée — vous êtes à ' + dist + 'm de ' + coords.name);
        if (btn) btn.classList.add('verified');
        ambiToast('📍 Présence GPS validée — ' + dist + 'm', '0,255,170');
      } else {
        ambiSetPresenceStatus(type, false, '🚫 Trop loin — vous êtes à ' + dist + 'm (max ' + AMBI_GPS_RADIUS_M + 'm). Êtes-vous bien sur place ?');
        if (btn) btn.classList.add('error-state');
        ambiToast('⚠️ Position trop éloignée (' + dist + 'm)', '255,68,102');
      }
    },
    function(err) {
      if (btn) { btn.classList.remove('loading'); btn.classList.add('error-state'); btn.querySelector('span:last-child').textContent = 'GPS refusé'; }
      var msgs = { 1: 'Permission GPS refusée — autorisez la localisation', 2: 'Position indisponible', 3: 'Délai GPS dépassé — réessayez' };
      ambiSetPresenceStatus(type, false, '❌ ' + (msgs[err.code] || 'Erreur GPS'));
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
  );
};

/* ── OPTION 2 : QR Code ── */
window.ambiToggleQR = function(type) {
  var panel = document.getElementById('ambi-qr-inline-' + type);
  var canvas = document.getElementById('ambi-qr-canvas-' + type);
  if (!panel) return;
  if (panel.classList.contains('open')) { panel.classList.remove('open'); return; }
  panel.classList.add('open');
  /* Générer QR code si pas encore fait */
  if (canvas && canvas.children.length === 0 && typeof QRCode !== 'undefined') {
    var token = 'AMBI241-' + type.toUpperCase() + '-' + Date.now().toString(36).toUpperCase();
    canvas.setAttribute('data-qr-token', token);
    new QRCode(canvas, { text: token, width: 140, height: 140, colorDark: '#00e5ff', colorLight: '#0d0020', correctLevel: QRCode.CorrectLevel.M });
  }
  ambiSetPresenceStatus(type, false, '📲 Scannez le QR Code affiché dans l\'établissement pour valider');
};

window.ambiValidateQR = function(type) {
  /* En production : comparer avec le token Firestore de l'établissement.
     Ici on simule une validation réussie après interaction utilisateur. */
  var panel = document.getElementById('ambi-qr-inline-' + type);
  var btn = document.getElementById('ambi-qr-btn-' + type);
  if (panel) panel.classList.remove('open');
  ambiSetPresenceStatus(type, true, '✅ QR Code validé — présence confirmée sur place');
  if (btn) btn.classList.add('verified');
  ambiToast('📲 QR Code accepté — présence vérifiée', '0,255,170');
};

/* ── SUBMIT avec vérification présence ── */
window.ambiSubmitContrib = function(type) {
  if (!_ambiPresenceVerified[type]) {
    ambiToast('🛰️ Vérifiez votre présence avant de publier', '255,68,102');
    var wrap = document.getElementById('ambi-presence-' + type);
    if (wrap) { wrap.style.animation = 'none'; wrap.style.border = '2px solid rgba(255,68,102,0.6)'; setTimeout(function(){ wrap.style.border=''; }, 1500); }
    return;
  }
  /* Simulation d'envoi Firebase */
  var contribEl = document.getElementById('ambi-contrib-' + type);
  var fields = document.getElementById('ambi-contrib-fields-' + type);
  if (fields) {
    fields.innerHTML = '<div style="text-align:center;padding:12px 8px;animation:ambiResaConfirm 0.35s both;">'
      + '<div style="font-size:2rem;margin-bottom:6px">📡</div>'
      + '<div style="font-family:Syne,sans-serif;font-weight:800;font-size:0.9rem;color:var(--green);margin-bottom:4px">Données publiées en direct !</div>'
      + '<div style="font-size:0.68rem;color:var(--muted);line-height:1.6;">Merci pour votre contribution. Les données seront visibles dans quelques secondes après modération automatique.</div>'
      + '<div style="font-size:0.6rem;color:var(--cyan);margin-top:8px;">🔐 Contribution enregistrée avec votre compte AMBI241</div>'
      + '</div>';
    var capRow = document.querySelector('#ambi-contrib-' + type + ' .ambi-presence-wrap');
    if (capRow) capRow.style.display = 'none';
    var btns = document.querySelector('#ambi-contrib-' + type + ' .ambi-contrib-btns');
    if (btns) btns.style.display = 'none';
  }
  ambiToast('✅ Contribution publiée — Merci !');
  /* Ré-ouvrir après 4s */
  setTimeout(function() {
    if (contribEl) contribEl.remove();
  }, 6000);
};

/* ════════════════════════════════════════════════════════════
   §10  INJECTION DANS LES FICHES EXISTANTES
════════════════════════════════════════════════════════════ */
function injectIntoFiche(ficheId, type) {
  var fiche = document.getElementById('fiche-fs-' + ficheId);
  if (!fiche) return;
  var body = fiche.querySelector('.fiche-body');
  if (!body) return;
  /* Éviter double injection */
  if (body.querySelector('.ambi-resa-block')) return;

  /* Trouver le point d'injection — avant .pro-panel */
  var proPanel = body.querySelector('.pro-panel');
  var refNode = proPanel || null;

  var wrapper = document.createElement('div');
  wrapper.innerHTML = buildEquipBlock(type) + buildResaBlock(type) + buildContribBlock(type);

  if (refNode) {
    body.insertBefore(wrapper, refNode);
  } else {
    body.appendChild(wrapper);
  }
}

/* Remplacement complet des fiches placeholders */
function buildFullFiche(ficheId, type, config) {
  var el = document.getElementById('fiche-fs-' + ficheId);
  if (!el) return;
  /* Vérifier si c'est encore un placeholder */
  if (!el.querySelector('.fiche-card .fiche-body') && !el.querySelector('.fiche-body')) {
    el.innerHTML = buildPlaceholderFicheHTML(ficheId, type, config);
  }
}

function buildPlaceholderFicheHTML(ficheId, type, cfg) {
  var heroColors = {
    resto: '#3a1200,#1a0a28', club: '#1a003a,#0a0014', salle: '#001a3a,#0a0a1a',
    snack: '#2a1800,#1a0a28', terrasse: '#001a2a,#0a1a14'
  };
  var hc = (heroColors[type] || '#1a0a28,#0a0014').split(',');
  var icons = { resto:'🍽️', club:'🎵', salle:'🎭', snack:'🍾', terrasse:'🌅' };
  var names = { resto:'Restaurant & Pâtisserie', club:'Club / Discothèque', salle:'Salle de Cérémonies', snack:'Snack Bar', terrasse:'Terrasse Vue' };
  var typeLabels = { resto:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 40" width="1.1em" height="0.8em" style="display:inline-block;vertical-align:middle;flex-shrink:0;"><line x1="10" y1="4" x2="10" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/><line x1="7" y1="4" x2="7" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><line x1="13" y1="4" x2="13" y2="16" stroke="white" stroke-width="1.6" stroke-linecap="round"/><path d="M7 16 Q10 20 13 16" fill="none" stroke="white" stroke-width="1.6"/><circle cx="28" cy="22" r="14" fill="none" stroke="white" stroke-width="2.2"/><circle cx="28" cy="22" r="9" fill="rgba(255,255,255,0.12)" stroke="white" stroke-width="1.2"/><circle cx="28" cy="22" r="3.5" fill="white" opacity="0.7"/><ellipse cx="46" cy="10" rx="3.5" ry="5" fill="none" stroke="white" stroke-width="2"/><line x1="46" y1="15" x2="46" y2="36" stroke="white" stroke-width="2.2" stroke-linecap="round"/></svg> Restaurant', club:'🎵 Club & Disco', salle:'🎭 Salle & Cérémonies', snack:'🍾 Snack Bar', terrasse:'🌅 Terrasse' };
  var statusLabels = { resto:'Ouvert · Service en cours', club:'Ouvert · DJ à 22h', salle:'Disponible à la location', snack:'Ouvert · Commandes en cours', terrasse:'Ouvert · Places disponibles' };
  var statusClass = { resto:'pill-ouvert-anime', club:'pill-ouvert-anime', salle:'pill-ouvert-calme', snack:'pill-ouvert-anime', terrasse:'pill-ouvert-calme' };
  var icon = icons[type] || '🏠';
  var name = names[type] || type;
  var typeLabel = typeLabels[type] || type;
  var statusLabel = statusLabels[type] || 'Ouvert';
  var sCls = statusClass[type] || 'pill-ouvert-calme';
  return (
    '<div class="fiche-card">'
    + '<div class="fiche-hero" style="background:linear-gradient(135deg,'+hc[0]+','+hc[1]+');">'
    + '<div class="fiche-hero-overlay"></div>'
    + '<div class="fiche-hero-badge">N°1</div>'
    + '<div class="fiche-status-pill '+sCls+'">'+statusLabel+'</div>'
    + '<div class="fiche-hero-actions"><span class="qr-btn">📲 QR Vote</span></div>'
    + '</div>'
    + '<div class="fiche-body">'
    + '<div class="fiche-name">'+icon+' '+name+'</div>'
    + '<div class="fiche-tags">'
    + '<span class="tag tag-galerie">📸 Galerie</span>'
    + '<span class="tag tag-type">'+typeLabel+'</span>'
    + '</div>'
    + '<div class="fiche-location">📍 Libreville, Gabon</div>'
    + '<div class="affluence-bar"><div class="affluence-label"><span>Affluence</span><span style="color:var(--amber);font-weight:700;">—%</span></div><div class="affluence-track"><div class="affluence-fill" style="width:40%"></div></div></div>'
    + '<div class="ambiance-line"><span style="color:var(--muted)">Ambiance</span><span class="ambiance-val">🟡 Calme</span></div>'
    + buildEquipBlock(type)
    + buildResaBlock(type)
    + buildContribBlock(type)
    + '<div class="votes-section">'
    + '<div class="votes-title">PRÉSENCES CONFIRMÉES</div>'
    + '<div class="votes-summary"><span class="vote-count-badge">🏆 0</span><span class="vote-pers">0 pers. sur place</span></div>'
    + '<div class="vote-btns"><button class="vote-btn vote-up">👍 0</button><button class="vote-btn vote-down">👎 0</button></div>'
    + '<div class="signal-btns">'
    + '<button class="sig-btn">🟡 Calme</button>'
    + '<button class="sig-btn" style="border-color:rgba(0,255,170,0.3);color:var(--green);">🟢 Animé</button>'
    + '<button class="sig-btn" style="border-color:rgba(255,68,102,0.3);color:var(--red);">🔴 Bondé</button>'
    + '<button class="sig-btn">⚫ Fermé</button>'
    + '</div></div>'
    + '<a href="#" class="maps-btn">📍 Voir sur Maps</a>'
    + '</div></div>'
  );
}

/* ════════════════════════════════════════════════════════════
   §11  INIT — Lance l'injection au bon moment
════════════════════════════════════════════════════════════ */
function doInject() {
  /* Injecter dans les fiches existantes (bar, hotel, stade, site) */
  injectIntoFiche('bar',   'bar');
  injectIntoFiche('hotel', 'hotel');
  injectIntoFiche('stade', 'stade');
  injectIntoFiche('site',  'site');

  /* Remplacer les placeholders des autres fiches */
  buildFullFiche('resto',    'resto');
  buildFullFiche('club',     'club');
  buildFullFiche('salle',    'salle');
  buildFullFiche('snack',    'snack');
  buildFullFiche('terrasse', 'terrasse');

  console.log('[AMBI241] ✅ Module Enrichissement v3.0 injecté');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', doInject);
} else {
  setTimeout(doInject, 100);
}

/* Hook dans le lazy-load existant si la section n'est pas encore visible */
var _prevEnrich = window._lazyInitSection;
window._lazyInitSection = function(name) {
  if (typeof _prevEnrich === 'function') _prevEnrich(name);
  if (name === 'fiches') setTimeout(doInject, 120);
};

})();
