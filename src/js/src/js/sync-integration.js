/**
 * AMBI241 - Sync Integration
 * Intègre firebase-data-sync.js à l'interface utilisateur
 */

let _syncReady = false;
const _syncReadyPromise = new Promise((resolve) => {
  const checkSync = setInterval(() => {
    if (window.firebaseSync) {
      clearInterval(checkSync);
      _syncReady = true;
      resolve();
    }
  }, 100);
  
  setTimeout(() => {
    clearInterval(checkSync);
    resolve();
  }, 15000);
});

/**
 * UI — INDICATEUR DE CONNEXION
 */
function initSyncIndicator() {
  if (!window.firebaseSync) return;
  
  if (!document.getElementById('syncIndicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'syncIndicator';
    indicator.innerHTML = `
      <style>
        #syncIndicator {
          position: fixed;
          top: 12px;
          right: 12px;
          z-index: 9999;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 6px 10px;
          border-radius: 20px;
          background: rgba(0, 255, 170, 0.15);
          border: 1px solid rgba(0, 255, 170, 0.3);
          color: #00ffaa;
          display: flex;
          align-items: center;
          gap: 6px;
          backdrop-filter: blur(10px);
          transition: all 0.3s;
        }
        
        #syncIndicator.syncing {
          background: rgba(255, 215, 0, 0.15);
          border-color: rgba(255, 215, 0, 0.3);
          color: #ffd700;
        }
        
        #syncIndicator.error {
          background: rgba(255, 68, 102, 0.15);
          border-color: rgba(255, 68, 102, 0.3);
          color: #ff4466;
        }
        
        #syncIndicator .sync-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
          display: inline-block;
        }
        
        #syncIndicator.syncing .sync-dot {
          animation: pulse 1.5s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.8); }
        }
      </style>
      <span class="sync-dot"></span>
      <span id="syncText">Connexion...</span>
    `;
    
    document.body.appendChild(indicator);
  }
  
  updateSyncIndicator();
}

function updateSyncIndicator() {
  if (!window.firebaseSync) return;
  
  const indicator = document.getElementById('syncIndicator');
  if (!indicator) return;
  
  const status = window.firebaseSync.getStatus();
  const text = document.getElementById('syncText');
  
  indicator.classList.remove('syncing', 'error');
  
  if (status.isSyncing) {
    indicator.classList.add('syncing');
    text.textContent = 'Synchronisation...';
  } else if (!status.isConnected) {
    indicator.classList.add('error');
    text.textContent = 'Erreur connexion';
  } else {
    text.textContent = 'Connecté';
  }
}

/**
 * AMBI SYNC PUBLIC API
 */
const ambiSync = {
  async loadEtablissements() {
    await _syncReadyPromise;
    if (!window.firebaseSync) throw new Error('Sync not ready');
    return await window.firebaseSync.getEtablissements();
  },
  
  async loadEtablissement(id) {
    await _syncReadyPromise;
    if (!window.firebaseSync) throw new Error('Sync not ready');
    return await window.firebaseSync.getEtablissement(id);
  },
  
  subscribe(collection, callback) {
    if (!window.firebaseSync) {
      console.warn('Sync not ready yet');
      return () => {};
    }
    
    window.firebaseSync.on('onDataUpdate', (key, data) => {
      if (key === collection || key === 'all') {
        callback(data);
      }
    });
    
    return () => {};
  },
  
  getStatus() {
    if (!window.firebaseSync) {
      return {
        isConnected: false,
        isSyncing: false,
        retryCount: 0
      };
    }
    return window.firebaseSync.getStatus();
  },
  
  clearCache() {
    if (window.firebaseSync) {
      window.firebaseSync.clearCache();
    }
  }
};

window.ambiSync = ambiSync;

/**
 * INITIALISATION
 */
document.addEventListener('DOMContentLoaded', () => {
  _syncReadyPromise.then(() => {
    initSyncIndicator();
    
    if (window.firebaseSync) {
      window.firebaseSync.on('onConnect', () => {
        console.log('✅ Connecté à Firebase');
        updateSyncIndicator();
      });
      
      window.firebaseSync.on('onDisconnect', () => {
        console.warn('⚠️ Déconnecté de Firebase');
        updateSyncIndicator();
      });
      
      window.firebaseSync.on('onDataUpdate', () => {
        updateSyncIndicator();
      });
      
      window.firebaseSync.on('onError', (error) => {
        console.error('❌ Erreur sync:', error);
        updateSyncIndicator();
      });
    }
  });
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ambiSync };
    }
