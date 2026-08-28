/* ════════════════════════════════════════════════════════════════
   AMBI241 — categories-v2.js
   Charger EN DERNIER avant </body> dans index.html :
     <script src="js/categories-v2.js"></script>
   Réécrit CATEGORIES, getCategory, getCatInfo, CAT_META, CAT_ORDER
   ainsi que les maps locales du Top-6 et les chips de filtre.
   ════════════════════════════════════════════════════════════════ */

/* ────────────────────────────────────────────────────────────────
   1. TABLEAU GLOBAL DES CATÉGORIES
   ──────────────────────────────────────────────────────────────── */
var CATEGORIES = [
  /* ── existantes ── */
  { key:"Bar",           label:"Bar et Lounge",               icon:"🍺",  badge:"cb-bar"      },
  { key:"Discotheque",   label:"Discotheque et Club",          icon:"🎵",  badge:"cb-club"     },
  { key:"Restaurant",    label:"Restaurant, Café et Maquis",   icon:"🍽️", badge:"cb-resto"    },
  { key:"Bar Terrasse",  label:"Bar Terrasse et Rooftop",      icon:"🏖️", badge:"cb-roof"     },
  { key:"Snack",         label:"Snack & Fast-Food",            icon:"🍟",  badge:"cb-snack"    },
  { key:"Stade",         label:"Stade de Football",            icon:"⚽",  badge:"cb-stade"    },
  /* ── nouvelles / séparées V2 ── */
  { key:"Patisserie",      label:"Pâtisseries & Boulangeries",   icon:"🎂", badge:"cb-patiss"    },
  { key:"Salle Ceremonie", label:"Salles de Cérémonies",          icon:"💍", badge:"cb-salle-cer" },
  { key:"Salle Spectacle", label:"Salles de Spectacle",           icon:"🎭", badge:"cb-salle-sp"  },
  { key:"Site Naturel",    label:"Sites Naturels & Parcs Nationaux", icon:"🌳", badge:"cb-nature" },
  { key:"Monument",        label:"Monuments Historiques",          icon:"🏛️", badge:"cb-monument" }
];

/* ────────────────────────────────────────────────────────────────
   2. FONCTION getCategory — résolution type → clé catégorie
   ──────────────────────────────────────────────────────────────── */
function getCategory(type) {
  if (!type) return "Bar";
  var t = type.toLowerCase().trim();

  /* Correspondances exactes (priorité absolue) */
  var exact = {
    /* Discos */
    "discotheque":"Discotheque","discothèque":"Discotheque",
    "nightclub":"Discotheque","night club":"Discotheque",
    /* Snack */
    "snack":"Snack","snack-bar":"Snack",
    /* Bar Terrasse */
    "bar terrasse":"Bar Terrasse","bar-terrasse":"Bar Terrasse",
    "rooftop":"Bar Terrasse","rooftop bar":"Bar Terrasse",
    /* Restaurants */
    "restaurant":"Restaurant","café":"Restaurant","cafe":"Restaurant",
    "brasserie":"Restaurant","pizzeria":"Restaurant","maquis":"Restaurant",
    "bistro":"Restaurant","bistrot":"Restaurant",
    /* Bars */
    "bar":"Bar","lounge":"Bar","bar lounge":"Bar","pub":"Bar","taverne":"Bar",
    /* Pâtisseries — NOUVEAU */
    "pâtisserie":"Patisserie","patisserie":"Patisserie",
    "boulangerie":"Patisserie","salon de thé":"Patisserie","tea room":"Patisserie",
    /* Salles cérémonies — SÉPARÉ */
    "salle de cérémonie":"Salle Ceremonie","salle de ceremonie":"Salle Ceremonie",
    "salle cérémonie":"Salle Ceremonie","salle ceremonie":"Salle Ceremonie",
    "salle de mariage":"Salle Ceremonie","salle polyvalente":"Salle Ceremonie",
    /* Salles spectacle — SÉPARÉ */
    "salle de spectacle":"Salle Spectacle","salle spectacle":"Salle Spectacle",
    "théâtre":"Salle Spectacle","theatre":"Salle Spectacle",
    "cinema":"Salle Spectacle","cinéma":"Salle Spectacle",
    "auditorium":"Salle Spectacle","centre culturel":"Salle Spectacle",
    "salle":"Salle Spectacle",          /* fallback générique */
    /* Stades */
    "stade":"Stade","stade de football":"Stade","stade football":"Stade",
    "terrain football":"Stade","complexe sportif":"Stade",
    /* Sites naturels — SÉPARÉ */
    "parc national":"Site Naturel","parc naturel":"Site Naturel",
    "réserve":"Site Naturel","reserve":"Site Naturel",
    "plage":"Site Naturel","cascade":"Site Naturel","forêt":"Site Naturel",
    "site naturel":"Site Naturel",
    /* Monuments — NOUVEAU */
    "monument":"Monument","monument historique":"Monument",
    "musée":"Monument","musee":"Monument",
    "site historique":"Monument","patrimoine":"Monument",
    /* Rétrocompat anciens types fusionnés */
    "tourisme":"Site Naturel","site touristique":"Site Naturel"
  };
  if (exact[t]) return exact[t];

  /* Règles par mots-clés (ordre décroissant de spécificité) */
  if (/disco|nightclub|night club/.test(t)) return "Discotheque";
  if (/club/.test(t) && !/bar|snack/.test(t)) return "Discotheque";
  if (/terrasse|rooftop/.test(t)) return "Bar Terrasse";
  if (/snack/.test(t)) return "Snack";
  if (/p[aâ]tiss|boulang|salon de th/.test(t)) return "Patisserie";
  if (/restaurant|resto|brasserie|pizz|bistro|caf[eé]|maquis/.test(t)) return "Restaurant";
  if (/bar|lounge|pub|taverne/.test(t)) return "Bar";
  if (/c[eé]r[eé]monie|mariage|baptême|communion|r[eé]ception priv/.test(t)) return "Salle Ceremonie";
  if (/spectacle|th[eé][aâ]tre|cin[eé]|concert|auditorium|culturel/.test(t)) return "Salle Spectacle";
  if (/salle/.test(t)) return "Salle Spectacle";
  if (/stade|terrain|complexe sportif|foot/.test(t)) return "Stade";
  if (/parc|r[eé]serve|plage|cascade|for[eê]t|nature/.test(t)) return "Site Naturel";
  if (/monument|mus[eé]|historique|patrimoine/.test(t)) return "Monument";
  if (/touristique|tourisme/.test(t)) return "Site Naturel";

  return "Bar"; /* fallback */
}
window.getCategory = getCategory;

/* ────────────────────────────────────────────────────────────────
   3. getCatInfo — retrouve l'objet catégorie par clé
   ──────────────────────────────────────────────────────────────── */
function getCatInfo(key) {
  for (var i = 0; i < CATEGORIES.length; i++) {
    if (CATEGORIES[i].key === key) return CATEGORIES[i];
  }
  return CATEGORIES[0];
}
window.getCatInfo = getCatInfo;

/* ────────────────────────────────────────────────────────────────
   4. CAT_META & CAT_ORDER — utilisés par le rendu BPP / liste
   ──────────────────────────────────────────────────────────────── */
if (typeof window !== "undefined") {
  /* Sera disponible dès que bppRender() s'exécute */
  window._CAT_META_V2 = {
    'Bar':             { icon:'🍺', color:'#ff1493', label:'Bars & Lounges'                 },
    'Bar Terrasse':    { icon:'🏖️',color:'#4fc3f7', label:'Bar Terrasses & Rooftops'       },
    'Snack':           { icon:'🍟', color:'#ffca28', label:'Snacks & Fast-food'              },
    'Restaurant':      { icon:'🍽️',color:'#ff9500', label:'Restos & Cafés & Maquis'        },
    'Discotheque':     { icon:'🎵', color:'#cc44ff', label:'Clubs & Discothèques'           },
    /* V2 */
    'Patisserie':      { icon:'🎂', color:'#ff6b9d', label:'Pâtisseries & Boulangeries'     },
    'Salle Ceremonie': { icon:'💍', color:'#e91e63', label:'Salles de Cérémonies'           },
    'Salle Spectacle': { icon:'🎭', color:'#ff6b35', label:'Salles de Spectacle'            },
    'Stade':           { icon:'⚽', color:'#00c853', label:'Stades & Complexes sportifs'    },
    'Site Naturel':    { icon:'🌳', color:'#69f0ae', label:'Sites Naturels & Parcs Nationaux'},
    'Monument':        { icon:'🏛️',color:'#d4a853', label:'Monuments Historiques'          }
  };
  window._CAT_ORDER_V2 = [
    'Bar','Bar Terrasse','Snack','Restaurant','Discotheque',
    'Patisserie','Salle Ceremonie','Salle Spectacle','Stade','Site Naturel','Monument'
  ];
}

/* ────────────────────────────────────────────────────────────────
   5. PATCH TOP-6 : maps locales categoryClasses / Labels / Icons
      Ces maps sont déclarées en var local dans la fonction Top-6 ;
      on ne peut pas les surcharger directement, mais on expose
      des objets globaux que la fonction peut utiliser en fallback.
   ──────────────────────────────────────────────────────────────── */
window.CATEGORY_CLASSES_V2 = {
  "Bar":"bar","Discotheque":"club","Restaurant":"restaurant",
  "Bar Terrasse":"terrasse","Snack":"snack",
  "Stade":"stade",
  /* V2 */
  "Patisserie":"patisserie","Salle Ceremonie":"salle-cer",
  "Salle Spectacle":"salle-sp","Site Naturel":"nature","Monument":"monument"
};
window.CATEGORY_LABELS_V2 = {
  "Bar":"BAR","Discotheque":"CLUBS","Restaurant":"RESTOS & CAFÉS",
  "Bar Terrasse":"TERRASSE","Snack":"SNACKS",
  "Stade":"STADES FOOT",
  /* V2 */
  "Patisserie":"PÂTISSERIES","Salle Ceremonie":"SALLES CÉRÉM.",
  "Salle Spectacle":"SALLES SPECTACLE","Site Naturel":"SITES NATURELS","Monument":"MONUMENTS"
};
window.CATEGORY_ICONS_V2 = {
  "Bar":"🍺","Discotheque":"🎵","Restaurant":"🍽️",
  "Bar Terrasse":"🏖️","Snack":"🍟",
  "Stade":"⚽",
  /* V2 */
  "Patisserie":"🎂","Salle Ceremonie":"💍",
  "Salle Spectacle":"🎭","Site Naturel":"🌳","Monument":"🏛️"
};

/* ────────────────────────────────────────────────────────────────
   6. PATCH CHIPS DE FILTRE — injecte les nouveaux chips dans #typeChips
      Remplace les chips "Salle" et "Tourisme" par les 5 types V2
      + ajoute "Pâtisseries".
   ──────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", function () {
  var container = document.getElementById("typeChips");
  if (!container) return;

  /* Supprimer les anciens chips fusionnés */
  ["Salle", "Tourisme"].forEach(function (oldType) {
    var old = container.querySelector('[data-type="' + oldType + '"]');
    if (old) old.remove();
  });

  /* Nouveaux chips à injecter (dans l'ordre souhaité) */
  var newChips = [
    { type:"Patisserie",      icon:"🎂", label:"Pâtisseries"      },
    { type:"Salle Ceremonie", icon:"💍", label:"Salles Cérém."    },
    { type:"Salle Spectacle", icon:"🎭", label:"Salles Spectacle" },
    { type:"Site Naturel",    icon:"🌳", label:"Sites Naturels"   },
    { type:"Monument",        icon:"🏛️",label:"Monuments"        }
  ];

  newChips.forEach(function (c) {
    var div = document.createElement("div");
    div.className = "fchip";
    div.setAttribute("data-type", c.type);
    div.setAttribute("onclick", "setTypeFilter('" + c.type + "',this)");
    div.textContent = c.icon + " " + c.label;
    container.appendChild(div);
  });

  /* Injecter aussi le chip Pâtisserie juste après "Restaurant" */
  var restoChip = container.querySelector('[data-type="Restaurant"]');
  var patissChip = container.querySelector('[data-type="Patisserie"]');
  if (restoChip && patissChip) {
    restoChip.after(patissChip);
  }
});
