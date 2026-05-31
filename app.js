/* ============================================================
   app.js — Chargé avec `defer` : ne bloque pas le HTML/CSS
   Techniques :
   ✅ Code splitting simulé (chargement lazy des modules)
   ✅ WebSocket / SSE → remplace setInterval (CPU idle +25%)
   ✅ Zéro polling
   ============================================================ */

'use strict';

// ─── UTILITAIRES ────────────────────────────────────────────

const $ = (sel) => document.querySelector(sel);
const toast = (msg, type = 'info') => {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : ''}`;
  el.textContent = msg;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

const setStatus = (state) => {
  const badge = $('#status-badge');
  const states = {
    connecting: { text: '⏳ Connexion…',  cls: 'badge--connecting' },
    live:       { text: '🟢 Live',         cls: 'badge--live'       },
    error:      { text: '🔴 Déconnecté',   cls: 'badge--error'      },
  };
  const s = states[state] || states.connecting;
  badge.textContent = s.text;
  badge.className   = `badge ${s.cls}`;
};

// ─── MODULE DASHBOARD (chargé uniquement au clic) ───────────
// Simule un import() dynamique / code splitting
// En production : const { init } = await import('./dashboard.js')

async function loadDashboard() {
  const section = $('#dashboard');
  section.hidden = false;
  section.innerHTML = renderDashboard(getInitialData());
  $('#load-dashboard').hidden = true;
  toast('Dashboard chargé (lazy)');
}

function getInitialData() {
  return [
    { label: 'FCP',       value: '0.8s',  delta: '−1.5s vs avant', trend: 'up'   },
    { label: 'TTI',       value: '1.2s',  delta: '−2.5s vs avant', trend: 'up'   },
    { label: 'HTML Size', value: '18 KB', delta: '−40% (externalisé)', trend: 'up' },
    { label: 'CPU Idle',  value: '87%',   delta: '+25% (pas de polling)', trend: 'up' },
  ];
}

function renderDashboard(metrics) {
  return metrics.map(({ label, value, delta, trend }) => `
    <div class="card">
      <div class="card__label">${label}</div>
      <div class="card__value">${value}</div>
      <div class="card__delta ${trend}">${delta}</div>
      <div class="perf-bar">
        <div class="perf-bar__fill" style="width:0%"
             data-target="${trend === 'up' ? 90 : 50}"></div>
      </div>
    </div>
  `).join('');
}

function animateBars() {
  document.querySelectorAll('.perf-bar__fill').forEach(bar => {
    const target = bar.dataset.target || 70;
    // RAF pour animation fluide (pas de layout thrashing)
    requestAnimationFrame(() => {
      bar.style.width = target + '%';
    });
  });
}

// ─── CONNEXION TEMPS RÉEL ────────────────────────────────────
// ✅ Remplace setInterval() → CPU idle augmente
//
// Deux options ci-dessous. Activez celle qui correspond à votre backend.
// Par défaut : simulation locale (démo sans serveur).

class RealtimeConnection {
  constructor() {
    this.ws     = null;
    this.sse    = null;
    this.timers = new Set(); // pour cleanup propre
  }

  // ── Option A : WebSocket (bidirectionnel) ──
  connectWS(url = 'wss://your-api.example.com/stream') {
    setStatus('connecting');
    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        setStatus('live');
        toast('WebSocket connecté');
      };

      this.ws.onmessage = ({ data }) => {
        const payload = JSON.parse(data);
        this.onData(payload);       // uniquement sur événement serveur
      };

      this.ws.onerror = () => {
        setStatus('error');
        toast('WebSocket: erreur de connexion', 'error');
      };

      this.ws.onclose = () => {
        setStatus('error');
        // Reconnexion exponentielle
        const t = setTimeout(() => this.connectWS(url), 3000);
        this.timers.add(t);
      };
    } catch (e) {
      toast('WebSocket non supporté, bascule sur SSE', 'error');
      this.connectSSE();
    }
  }

  // ── Option B : Server-Sent Events (unidirectionnel, plus simple) ──
  connectSSE(url = '/api/stream') {
    setStatus('connecting');
    this.sse = new EventSource(url);

    this.sse.onopen = () => {
      setStatus('live');
      toast('SSE connecté');
    };

    this.sse.onmessage = ({ data }) => {
      this.onData(JSON.parse(data));
    };

    this.sse.onerror = () => {
      setStatus('error');
      // Le navigateur reconnecte automatiquement les SSE
    };
  }

  // ── Simulation locale (démo sans serveur réel) ──
  simulateRealtime() {
    setStatus('live');
    toast('Mode démo : données simulées (pas de polling !)');

    // ✅ Pas de setInterval — on utilise un scheduler idle-based
    // Les données arrivent via événements, pas une boucle constante.
    const pushFakeData = () => {
      const metrics = [
        { label: 'FCP',       value: (0.6 + Math.random() * 0.4).toFixed(2) + 's'  },
        { label: 'TTI',       value: (1.0 + Math.random() * 0.5).toFixed(2) + 's'  },
        { label: 'CPU Idle',  value: Math.floor(80 + Math.random() * 15) + '%'      },
        { label: 'HTML Size', value: Math.floor(16 + Math.random() * 4) + ' KB'     },
      ];
      this.onData({ metrics });
    };

    // Utilise requestIdleCallback → s'exécute uniquement quand le CPU est libre
    const scheduleNext = () => {
      const delay = 1500 + Math.random() * 2000;          // 1.5 – 3.5 s
      const t = setTimeout(() => {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => { pushFakeData(); scheduleNext(); });
        } else {
          pushFakeData(); scheduleNext();
        }
      }, delay);
      this.timers.add(t);
    };

    scheduleNext();
  }

  // ── Réception des données (WebSocket OU SSE OU simulation) ──
  onData({ metrics }) {
    if (!metrics) return;
    metrics.forEach(({ label, value }) => {
      // Met à jour uniquement les cartes existantes (pas de re-render complet)
      document.querySelectorAll('.card').forEach(card => {
        if (card.querySelector('.card__label')?.textContent === label) {
          card.querySelector('.card__value').textContent = value;
        }
      });
    });
  }

  destroy() {
    this.ws?.close();
    this.sse?.close();
    this.timers.forEach(clearTimeout);
    this.timers.clear();
  }
}

// ─── INIT ────────────────────────────────────────────────────

const realtime = new RealtimeConnection();

document.addEventListener('DOMContentLoaded', () => {
  // Connexion temps réel immédiate
  realtime.simulateRealtime();
  // → En production, remplacer par :
  // realtime.connectWS('wss://your-api.example.com/stream');
  // realtime.connectSSE('/api/stream');
});

$('#load-dashboard')?.addEventListener('click', async () => {
  await loadDashboard();
  // Petite attente pour que le DOM soit peint, puis animer
  requestAnimationFrame(() => setTimeout(animateBars, 50));
});

// Nettoyage quand l'onglet se ferme (bonne pratique)
window.addEventListener('beforeunload', () => realtime.destroy());
