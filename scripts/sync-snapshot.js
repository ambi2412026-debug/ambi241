/**
 * AMBI241 — Sync du snapshot public (remplace les Cloud Functions,
 * exécuté gratuitement par GitHub Actions toutes les 10 minutes).
 *
 * Ce script :
 *  1. Se connecte à Firestore avec le SDK Admin (via un compte de
 *     service, aucune restriction de règles de sécurité — c'est normal,
 *     l'Admin SDK est justement fait pour ça côté serveur).
 *  2. Lit toute la collection "etablissements".
 *  3. Recalcule meta/typeCounts (comme le faisait onEtablissementWrite).
 *  4. Génère data/etablissements-snapshot.json avec UNIQUEMENT les
 *     champs publics (whitelist PUBLIC_FIELDS) — jamais de téléphone,
 *     email, ownerUID, réseaux sociaux ou données d'abonnement/boost.
 *  5. Le fichier est ensuite commité dans le repo par le workflow
 *     GitHub Actions, et servi par GitHub Pages au même titre que
 *     index.html — donc pas de CORS à configurer.
 */

const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

const TRACKED_KEYS = ["Hotel", "Bar", "Bar Terrasse", "Snack", "Restaurant", "Discotheque"];

const PUBLIC_FIELDS = [
  "nom", "name", "type", "categorie", "statut",
  "adresse", "address", "quartier", "lat", "lng", "maps_url", "place_id",
  "photos", "photo_exterieur", "photo_interieur", "_gphoto_urls", "_photo_profile_approved",
  "note", "avis", "affluence", "ambiance", "age_clientele", "dress_code",
  "entree", "prix_entree", "prix_moyen", "paiement", "options", "parking",
  "horaires", "happy_hour", "event_flash", "genres_musicaux", "nb_chambres",
  "etoiles", "description", "bio",
];

/**
 * getCategory — copie EXACTE de la logique de classement utilisée dans
 * index.html. Si vous modifiez le classement côté client, répercutez
 * le changement ici aussi.
 */
function getCategory(type) {
  if (!type) return "Bar";
  const t = String(type).toLowerCase().trim();

  const exact = {
    "hotel": "Hotel", "hôtel": "Hotel", "motel": "Hotel",
    "discotheque": "Discotheque", "discothèque": "Discotheque", "nightclub": "Discotheque", "night club": "Discotheque",
    "snack": "Snack", "snack-bar": "Snack",
    "bar terrasse": "Bar Terrasse", "bar-terrasse": "Bar Terrasse", "rooftop": "Bar Terrasse", "rooftop bar": "Bar Terrasse",
    "restaurant": "Restaurant", "café": "Restaurant", "cafe": "Restaurant", "brasserie": "Restaurant", "pizzeria": "Restaurant",
    "bar": "Bar", "lounge": "Bar", "bar lounge": "Bar", "pub": "Bar", "taverne": "Bar",
    "salle": "Salle", "salle de spectacle": "Salle", "salle de cérémonie": "Salle", "salle de ceremonie": "Salle", "salle polyvalente": "Salle", "centre culturel": "Salle", "théâtre": "Salle", "cinema": "Salle", "cinéma": "Salle", "auditorium": "Salle",
    "stade": "Stade", "stade de football": "Stade", "stade football": "Stade", "terrain football": "Stade", "complexe sportif": "Stade",
    "tourisme": "Tourisme", "site touristique": "Tourisme", "parc national": "Tourisme", "parc naturel": "Tourisme", "réserve": "Tourisme", "reserve": "Tourisme", "musée": "Tourisme", "musee": "Tourisme", "monument": "Tourisme", "plage": "Tourisme", "cascade": "Tourisme"
  };
  if (exact[t]) return exact[t];

  if (/h[oô]tel\s*\d|\d\s*[eé]toile|palace hotel|h[oô]tel\s*(suites|resort|lodge|inn|plaza)/.test(t)) return "Hotel";
  if (t.indexOf("hôtel") !== -1 || t.indexOf("hotel") !== -1 || t.indexOf("motel") !== -1 || t.indexOf("résidence") !== -1 || t.indexOf("residence") !== -1 || t.indexOf("resort") !== -1 || t.indexOf("lodge") !== -1) return "Hotel";

  if (t.indexOf("disco") !== -1 || t.indexOf("nightclub") !== -1 || t.indexOf("night club") !== -1) return "Discotheque";
  if (t.indexOf("club") !== -1 && t.indexOf("bar") === -1 && t.indexOf("snack") === -1) return "Discotheque";

  if (t.indexOf("terrasse") !== -1 || t.indexOf("rooftop") !== -1 || t.indexOf("bar terrasse") !== -1 || t.indexOf("bar-terrasse") !== -1) return "Bar Terrasse";

  if (t.indexOf("snack") !== -1) return "Snack";

  if (t.indexOf("restaurant") !== -1 || t.indexOf("resto") !== -1 || t.indexOf("pâtisserie") !== -1 || t.indexOf("patisserie") !== -1 || t.indexOf("brasserie") !== -1 || t.indexOf("pizzeria") !== -1 || t.indexOf("bistro") !== -1 || t.indexOf("café") !== -1 || t.indexOf("cafe") !== -1 || t.indexOf("maquis") !== -1) return "Restaurant";

  if (t.indexOf("bar") !== -1 || t.indexOf("lounge") !== -1 || t.indexOf("pub") !== -1 || t.indexOf("taverne") !== -1) return "Bar";

  if (t.indexOf("salle") !== -1 || t.indexOf("spectacle") !== -1 || t.indexOf("cérémonie") !== -1 || t.indexOf("ceremonie") !== -1 || t.indexOf("théâtre") !== -1 || t.indexOf("cinéma") !== -1 || t.indexOf("auditorium") !== -1 || t.indexOf("culturel") !== -1) return "Salle";

  if (t.indexOf("stade") !== -1 || t.indexOf("terrain") !== -1 || t.indexOf("complexe sportif") !== -1 || t.indexOf("foot") !== -1) return "Stade";

  if (t.indexOf("touristique") !== -1 || t.indexOf("parc") !== -1 || t.indexOf("réserve") !== -1 || t.indexOf("reserve") !== -1 || t.indexOf("musée") !== -1 || t.indexOf("monument") !== -1 || t.indexOf("plage") !== -1 || t.indexOf("cascade") !== -1) return "Tourisme";

  return "Bar";
}

function toPublicDoc(docId, data) {
  const out = { _docId: docId };
  PUBLIC_FIELDS.forEach((f) => {
    if (data[f] !== undefined) out[f] = data[f];
  });
  return out;
}

async function main() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    throw new Error("Secret FIREBASE_SERVICE_ACCOUNT manquant. Ajoute-le dans les secrets GitHub du repo.");
  }
  const serviceAccount = JSON.parse(raw);

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  const db = admin.firestore();

  const snap = await db.collection("etablissements").get();

  const counts = {};
  TRACKED_KEYS.forEach((k) => { counts[k] = 0; });

  const list = [];
  snap.forEach((doc) => {
    const data = doc.data();
    const cat = getCategory(data.type);
    if (TRACKED_KEYS.includes(cat)) counts[cat] += 1;
    list.push(toPublicDoc(doc.id, data));
  });

  /* ── A. meta/typeCounts dans Firestore (lu directement par le client) ── */
  await db.doc("meta/typeCounts").set(
    {
      counts,
      total: snap.size,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      recomputedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  /* ── B. Snapshot public écrit dans le repo (servi par GitHub Pages) ── */
  const payload = {
    generatedAt: new Date().toISOString(),
    total: list.length,
    etablissements: list,
  };

  const outDir = path.join(__dirname, "..", "data");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "etablissements-snapshot.json"),
    JSON.stringify(payload)
  );

  console.log(`OK — ${list.length} établissements synchronisés, meta/typeCounts mis à jour.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
