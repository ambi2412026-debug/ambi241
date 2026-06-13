/**
 * AMBI241 - Firebase Data Synchronization Module
 * Synchronisation intelligente avec cache local et reconnexion automatique
 */

class FirebaseDataSync {
  constructor() {
    this.isConnected = false;
    this.isSyncing = false;
    this.syncQueue = [];
    this.lastSyncTime = {};
    this.cacheExpiry = 5 * 60 * 1000;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 2000;
    this.syncInProgress = new Set();
    this.listeners = {
      onConnect: [],
      onDisconnect: [],
      onDataUpdate: [],
      onError: []
    };
    this.init();
  }

  async init() {
    let timeout = 0;
    const maxWait = 10000;
    while (!window.db && timeout < maxWait) {
      await new Promise(r => setTimeout(r, 500));
      timeout += 500;
    }
    if (!window.db) {
      this.notifyError('Firebase non initialisé après 10s');
      return;
    }
    this.setupConnectionMonitoring();
    this.loadLocalCache();
    this.startAutoSync();
  }

  setupConnectionMonitoring() {
    window.addEventListener('online', () => {
      console.log('🟢 Connexion internet rétablie');
      this.isConnected = true;
      this.retryCount = 0;
      this.notifyConnect();
      this.syncAll();
    });
    window.addEventListener('offline', () => {
      console.warn('🔴 Connexion internet perdue');
      this.isConnected = false;
      this.notifyDisconnect();
    });
    this.isConnected = navigator.onLine;
    if (this.isConnected) {
      this.notifyConnect();
      this.syncAll();
    }
  }

  async syncAll() {
    if (this.isSyncing) {
      console.log('⏳ Synchronisation déjà en cours...');
      return;
    }
    this.isSyncing = true;
    try {
      const [etablissements, stats] = await Promise.all([
        this.syncEtablissements(),
        this.syncStatistiques()
      ]);
      this.cacheData('etablissements', etablissements);
      this.cacheData('statistiques', stats);
      this.notifyDataUpdate('all', { etablissements, stats });
      console.log('✅ Synchronisation complète réussie', {
        etablissements: etablissements.length,
        stats: Object.keys(stats).length
      });
      this.retryCount = 0;
    } catch (error) {
      console.error('❌ Erreur sync complète:', error);
      this.handleSyncError(error);
    } finally {
      this.isSyncing = false;
    }
  }

  async syncEtablissements() {
    const cacheKey = 'etablissements';
    const cached = this.getLocalCache(cacheKey);
    if (cached && this.isCacheValid(cacheKey)) {
      console.log('📦 Établissements depuis cache');
      return cached;
    }
    try {
      const q = window.fbCollection(window.db, 'etablissements');
      const snapshot = await window.fbGetDocs(q);
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        _loadedAt: new Date().toISOString()
      }));
      this.cacheData(cacheKey, data);
      return data;
    } catch (error) {
      console.error('❌ Erreur sync établissements:', error);
      if (cached) {
        console.warn('⚠️ Utilisation du cache expiré (fallback)');
        return cached;
      }
      throw error;
    }
  }

  async syncStatistiques() {
    const cacheKey = 'statistiques';
    const cached = this.getLocalCache(cacheKey);
    if (cached && this.isCacheValid(cacheKey)) {
      return cached;
    }
    try {
      const etabs = await this.syncEtablissements();
      const stats = {
        total: etabs.length,
        byType: {},
        affluenceAvg: 0,
        lastUpdate: new Date().toISOString()
      };
      let totalAffluence = 0;
      etabs.forEach(e => {
        const type = e.type || 'autre';
        stats.byType[type] = (stats.byType[type] || 0) + 1;
        totalAffluence += (e.affluence || 0);
      });
      stats.affluenceAvg = etabs.length ? (totalAffluence / etabs.length).toFixed(1) : 0;
      this.cacheData(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('❌ Erreur sync statistiques:', error);
      if (cached) return cached;
      throw error;
    }
  }

  subscribeToEtablissement(etablissementId, callback) {
    if (!window.db) {
      console.warn('Firebase non prêt');
      return () => {};
    }
    try {
      const docRef = window.fbDoc(window.db, 'etablissements', etablissementId);
      const cached = this.getLocalCache(`etab_${etablissementId}`);
      if (cached) {
        callback(cached);
      }
      const unsubscribe = window.fbOnSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = { id: docSnap.id, ...docSnap.data() };
          this.cacheData(`etab_${etablissementId}`, data);
          callback(data);
          this.notifyDataUpdate(`etab_${etablissementId}`, data);
        }
      }, (error) => {
        console.error(`❌ Erreur listener ${etablissementId}:`, error);
        if (cached) {
          console.warn('⚠️ Utilisation du cache après erreur');
          callback(cached);
        }
      });
      return unsubscribe;
    } catch (error) {
      console.error('Erreur subscription:', error);
      return () => {};
    }
  }

  startAutoSync() {
    setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        console.log('🔄 Auto-sync...');
        this.syncAll().catch(err => console.error('Auto-sync échoué:', err));
      }
    }, 3 * 60 * 1000);
    setInterval(() => {
      this.checkConnectivity();
    }, 30 * 1000);
  }

  async checkConnectivity() {
    try {
      const q = window.fbQuery(
        window.fbCollection(window.db, 'etablissements'),
        window.fbLimit(1)
      );
      await window.fbGetDocs(q);
      if (!this.isConnected) {
        this.isConnected = true;
        this.retryCount = 0;
        this.notifyConnect();
      }
    } catch (error) {
      if (this.isConnected) {
        this.isConnected = false;
        this.notifyDisconnect();
      }
    }
  }

  handleSyncError(error) {
    console.error('Erreur sync:', error);
    this.retryCount++;
    if (this.retryCount <= this.maxRetries) {
      const delay = this.retryDelay * Math.pow(2, this.retryCount - 1);
      console.log(`⏳ Retry ${this.retryCount}/${this.maxRetries} dans ${delay}ms`);
      setTimeout(() => {
        if (navigator.onLine) {
          this.syncAll();
        }
      }, delay);
    }
    this.notifyError(error);
  }

  cacheData(key, data) {
    try {
      const cacheEntry = {
        data,
        timestamp: Date.now()
      };
      localStorage.setItem(`ambi_cache_${key}`, JSON.stringify(cacheEntry));
    } catch (error) {
      console.warn('⚠️ Cache write failed:', error);
    }
  }

  getLocalCache(key) {
    try {
      const item = localStorage.getItem(`ambi_cache_${key}`);
      if (!item) return null;
      const { data } = JSON.parse(item);
      return data;
    } catch (error) {
      return null;
    }
  }

  isCacheValid(key) {
    try {
      const item = localStorage.getItem(`ambi_cache_${key}`);
      if (!item) return false;
      const { timestamp } = JSON.parse(item);
      return Date.now() - timestamp < this.cacheExpiry;
    } catch {
      return false;
    }
  }

  loadLocalCache() {
    try {
      const keys = Object.keys(localStorage);
      const cacheKeys = keys.filter(k => k.startsWith('ambi_cache_'));
      console.log(`📦 ${cacheKeys.length} entrées cache chargées`);
    } catch (error) {
      console.warn('Erreur loading cache:', error);
    }
  }

  on(event, callback) {
    if (this.listeners[event]) {
      this.listeners[event].push(callback);
    }
  }

  notifyConnect() {
    this.listeners.onConnect.forEach(cb => cb());
  }

  notifyDisconnect() {
    this.listeners.onDisconnect.forEach(cb => cb());
  }

  notifyDataUpdate(key, data) {
    this.listeners.onDataUpdate.forEach(cb => cb(key, data));
  }

  notifyError(error) {
    this.listeners.onError.forEach(cb => cb(error));
  }

  async getEtablissements() {
    const cached = this.getLocalCache('etablissements');
    if (cached) return cached;
    return await this.syncEtablissements();
  }

  async getEtablissement(id) {
    const cached = this.getLocalCache(`etab_${id}`);
    if (cached) return cached;
    try {
      const docRef = window.fbDoc(window.db, 'etablissements', id);
      const docSnap = await window.fbGetDoc(docRef);
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() };
        this.cacheData(`etab_${id}`, data);
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Erreur getEtablissement(${id}):`, error);
      return cached || null;
    }
  }

  getStatus() {
    return {
      isConnected: this.isConnected,
      isSyncing: this.isSyncing,
      retryCount: this.retryCount,
      lastSync: this.lastSyncTime
    };
  }

  clearCache() {
    const keys = Object.keys(localStorage);
    keys.filter(k => k.startsWith('ambi_cache_')).forEach(k => {
      localStorage.removeItem(k);
    });
    console.log('🗑️ Cache vidé');
  }
}

window.firebaseSync = new FirebaseDataSync();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FirebaseDataSync;
}
