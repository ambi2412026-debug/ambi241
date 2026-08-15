/* ═══════════════════════════════════════════════════════════════
   AMBI241 — Admin Configuration (admin.html uniquement)
   ═══════════════════════════════════════════════════════════════
   ⚠️  CE FICHIER EST CHARGÉ UNIQUEMENT PAR admin.html
   Ne pas inclure dans index.html (app publique)
   ═══════════════════════════════════════════════════════════════ */

// ══ CONFIGURATION FIREBASE ══════════════════════════════════════
// La Firebase API Key est PUBLIQUE par design (sécurité = Firestore Rules)
// Voir : https://firebase.google.com/docs/projects/api-keys
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCx3hD28Lb9EtUrawHbTnM-6vmXdgO1ABw",
  authDomain: "ambi241.firebaseapp.com",
  projectId: "ambi241",
  storageBucket: "ambi241.firebasestorage.app",
  messagingSenderId: "422590051382",
  appId: "1:422590051382:web:fe05eaf701a6f704c2d497"
};

// ══ COLLECTIONS FIRESTORE ══════════════════════════════════════
const FIRESTORE_COLLECTIONS = {
  establishments: "etablissements",
  happenings: "happenings",
  users: "utilisateurs",
  analytics: "analytics",
  settings: "settings",
  adminLogs: "admin_logs",
  moderation: "moderation"
};

// ══ CONSTANTES ADMIN ═══════════════════════════════════════════
const ADMIN_CONFIG = {
  // PIN haché SHA-256 — REMPLACER par votre vrai hash en production
  // Pour générer : https://emn178.github.io/online-tools/sha256.html
PIN_HASH: "2c624232cdd221771294dfbb310acbc8b223c8b8d50e8595fe7a7a2c77e2b993",

  // Tentatives max avant blocage temporaire
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION_MS: 5 * 60 * 1000, // 5 minutes

  // Types d'établissements
  TYPES: [
    { id: 'restaurant', label: 'Restaurant', icon: '🍽️', color: '#ff9500' },
    { id: 'bar', label: 'Bar', icon: '🍸', color: '#ff1493' },
    { id: 'nightclub', label: 'Boîte de nuit', icon: '🎉', color: '#cc44ff' },
    { id: 'cafe', label: 'Café', icon: '☕', color: '#00ffaa' },
    { id: 'hotel', label: 'Hôtel', icon: '🏨', color: '#00d9ff' },
    { id: 'disco', label: 'Discothèque', icon: '💿', color: '#ff006e' },
    { id: 'pub', label: 'Pub', icon: '🍺', color: '#ffaa00' },
    { id: 'lounge', label: 'Lounge', icon: '🛋️', color: '#ff45b8' },
    { id: 'poker', label: 'Poker Club', icon: '♠️', color: '#ff4466' }
  ],

  // Quartiers de Libreville
  NEIGHBORHOODS: [
    'Centre-ville', 'Ancienne Gare', 'Quartier Chinois', 'Vieux Port',
    'Batéké', 'Akébé', 'Nkembo', 'Gisele-Eba', 'Olem', 'Dégrad', 'Autre'
  ],

  // Niveaux d'ambiance
  AMBIANCE_LEVELS: [
    { value: 1, label: 'Très Calme', icon: '😴', color: '#b088c0' },
    { value: 2, label: 'Calme', icon: '😊', color: '#00ffaa' },
    { value: 3, label: 'Modéré', icon: '😌', color: '#ffd700' },
    { value: 4, label: 'Animé', icon: '😄', color: '#ff9500' },
    { value: 5, label: 'Très Animé', icon: '🔥', color: '#ff2d9b' }
  ],

  MODERATION_RULES: {
    maxPendingTime: 24 * 60 * 60 * 1000,
    autoRejectEmpty: true,
    requireImageForEstablishment: false
  },

  LIMITS: {
    maxEstablishmentsPerUser: 5,
    maxHappeningsPerDay: 10,
    maxPhotoSize: 5 * 1024 * 1024
  }
};

// ══ ÉTATS ══════════════════════════════════════════════════════
const ESTABLISHMENT_STATUS = {
  ACTIVE: 'active', INACTIVE: 'inactive',
  FLAGGED: 'flagged', UNDER_REVIEW: 'under_review', BANNED: 'banned'
};

const HAPPENING_STATUS = {
  SCHEDULED: 'scheduled', LIVE: 'live', ENDED: 'ended', CANCELLED: 'cancelled'
};

const MODERATION_STATUS = {
  PENDING: 'pending', APPROVED: 'approved', REJECTED: 'rejected', FLAGGED: 'flagged'
};

const ADMIN_PERMISSIONS = {
  EDIT_ESTABLISHMENTS: 'edit_establishments',
  DELETE_ESTABLISHMENTS: 'delete_establishments',
  MANAGE_HAPPENINGS: 'manage_happenings',
  MODERATE_CONTENT: 'moderate_content',
  VIEW_ANALYTICS: 'view_analytics',
  MANAGE_USERS: 'manage_users',
  SYSTEM_CONFIG: 'system_config',
  VIEW_LOGS: 'view_logs',
  EXPORT_DATA: 'export_data'
};

const SYNC_EVENTS = {
  ESTABLISHMENT_UPDATED: 'establishment:updated',
  ESTABLISHMENT_DELETED: 'establishment:deleted',
  ESTABLISHMENT_CREATED: 'establishment:created',
  HAPPENING_CREATED: 'happening:created',
  HAPPENING_UPDATED: 'happening:updated',
  SETTINGS_CHANGED: 'settings:changed',
  APP_DISABLED: 'app:disabled',
  APP_MAINTENANCE: 'app:maintenance'
};

// ══ GESTION TENTATIVES LOGIN (anti-brute force côté client) ════
const _loginState = {
  attempts: 0,
  lockedUntil: 0
};

function isLoginLocked() {
  if (_loginState.lockedUntil > Date.now()) {
    const remainingMs = _loginState.lockedUntil - Date.now();
    const remainingMin = Math.ceil(remainingMs / 60000);
    return { locked: true, remainingMin };
  }
  return { locked: false };
}

function recordFailedAttempt() {
  _loginState.attempts++;
  if (_loginState.attempts >= ADMIN_CONFIG.MAX_LOGIN_ATTEMPTS) {
    _loginState.lockedUntil = Date.now() + ADMIN_CONFIG.LOCKOUT_DURATION_MS;
    _loginState.attempts = 0;
  }
}

function resetLoginAttempts() {
  _loginState.attempts = 0;
  _loginState.lockedUntil = 0;
}

// ══ FONCTIONS UTILITAIRES ══════════════════════════════════════

/** Hash SHA-256 via Web Crypto API (natif, pas de dépendance) */
async function hashSHA256(str) {
  try {
    const msgBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch (e) {
    console.error('Hash error:', e);
    return '';
  }
}

/** Vérifie le PIN avec protection brute-force */
async function verifyAdminPIN(pin) {
  const lockStatus = isLoginLocked();
  if (lockStatus.locked) {
    throw new Error(`Trop de tentatives. Réessayez dans ${lockStatus.remainingMin} min.`);
  }

  const input = String(pin).trim();
  const hash = await hashSHA256(input);
  const isValid = hash === ADMIN_CONFIG.PIN_HASH;

  if (!isValid) {
    recordFailedAttempt();
  } else {
    resetLoginAttempts();
  }

  return isValid;
}

/** Format timestamp pour affichage */
function formatTimestamp(timestamp) {
  if (!timestamp) return '-';
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleString('fr-FR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  });
}

/** Génère un UUID v4 */
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/** Normalise le nom pour détection doublons */
function normalizeEstablishmentName(name) {
  return (name || '').toLowerCase().trim()
    .replace(/[^\w\s]/g, '').replace(/\s+/g, ' ');
}

/** Échappe HTML (protection XSS) */
function escapeHTML(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text || '').replace(/[&<>"']/g, m => map[m]);
}

/** Log une action admin */
async function logAdminAction(db, action, details, adminId) {
  try {
    await db.collection(FIRESTORE_COLLECTIONS.adminLogs).add({
      action, details,
      adminId: adminId || 'anonymous',
      timestamp: new Date(),
      userAgent: navigator.userAgent
    });
  } catch (e) {
    console.error('Log action error:', e);
  }
}

/** Export de données */
async function exportData(db, format = 'json') {
  const data = {};
  try {
    const [estSnap, hapSnap, anaSnap] = await Promise.all([
      db.collection(FIRESTORE_COLLECTIONS.establishments).get(),
      db.collection(FIRESTORE_COLLECTIONS.happenings).get(),
      db.collection(FIRESTORE_COLLECTIONS.analytics).get()
    ]);

    data.establishments = estSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.happenings = hapSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    data.analytics = anaSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (format === 'csv') return convertToCSV(data.establishments);
    return JSON.stringify(data, null, 2);
  } catch (e) {
    console.error('Export error:', e);
    throw e;
  }
}

/** Convertit en CSV */
function convertToCSV(data) {
  if (!data || data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(item =>
    headers.map(h => {
      const v = item[h];
      if (typeof v === 'object') return JSON.stringify(v);
      if (typeof v === 'string' && v.includes(',')) return `"${v}"`;
      return v;
    }).join(',')
  );
  return [headers.join(','), ...rows].join('\n');
}

/** Récupère un paramètre URL */
function getURLParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

// ══ EXPORTER SUR window ════════════════════════════════════════
if (typeof window !== 'undefined') {
  Object.assign(window, {
    FIREBASE_CONFIG, ADMIN_CONFIG, FIRESTORE_COLLECTIONS,
    ESTABLISHMENT_STATUS, HAPPENING_STATUS, MODERATION_STATUS,
    ADMIN_PERMISSIONS, SYNC_EVENTS,
    verifyAdminPIN, formatTimestamp, generateUUID,
    normalizeEstablishmentName, escapeHTML,
    logAdminAction, exportData, getURLParam, hashSHA256
  });
}
