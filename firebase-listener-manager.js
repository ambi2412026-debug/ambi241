// ════════════════════════════════════════════════════════════════════════════════════
// Firebase Listener Lifecycle Management
// ════════════════════════════════════════════════════════════════════════════════════
// Purpose: Prevent memory leaks from accumulated Firestore onSnapshot listeners
// 
// Problem Solved:
//   - Before: Each page nav = +5-10 new listeners, cumulative → memory leak
//   - After: Listeners cleaned up on page switch → stable memory
//
// Usage:
//   window.__firebaseListenerManager.subscribe(eid)
//   window.__firebaseListenerManager.replaceSubscriptions([eid1, eid2, ...])
//   window.__firebaseListenerManager.cleanup()
// ════════════════════════════════════════════════════════════════════════════════════

window.__FirebaseListenerManager = (function() {
  'use strict';

  const state = {
    presenceListeners: {},    // { eid: unsubscribeFn }
    voteListeners: {},         // { eid: unsubscribeFn }
    ratingListeners: {},       // { eid: unsubscribeFn }
    activeEids: new Set(),     // Currently subscribed eids
  };

  return {
    /**
     * Subscribe to a single establishment's Firestore streams
     * Prevents duplicate subscriptions
     * @param {number|string} eid - Establishment ID
     */
    subscribe: function(eid) {
      const eidStr = String(eid);

      // Avoid double-subscription
      if (state.activeEids.has(eidStr)) {
        return;
      }

      state.activeEids.add(eidStr);

      // Subscribe to presence updates
      this._subscribePresence(eid);

      // Subscribe to vote updates
      this._subscribeVotes(eid);

      // Subscribe to rating updates
      this._subscribeRatings(eid);
    },

    /**
     * Unsubscribe from a single establishment
     * Cleans up all 3 listener types and caches
     * @param {number|string} eid - Establishment ID
     */
    unsubscribe: function(eid) {
      const eidStr = String(eid);

      // Call unsubscribe functions
      if (state.presenceListeners[eidStr]) {
        state.presenceListeners[eidStr]();
        delete state.presenceListeners[eidStr];
      }

      if (state.voteListeners[eidStr]) {
        state.voteListeners[eidStr]();
        delete state.voteListeners[eidStr];
      }

      if (state.ratingListeners[eidStr]) {
        state.ratingListeners[eidStr]();
        delete state.ratingListeners[eidStr];
      }

      state.activeEids.delete(eidStr);

      // Clean up caches
      if (window._livePresences) delete window._livePresences[eidStr];
      if (window._liveVotes) delete window._liveVotes[eidStr];
      if (window._liveRatings) delete window._liveRatings[eidStr];
    },

    /**
     * Replace current subscriptions with new ones
     * Useful when user switches pages/filters (e.g., different category, search, map view)
     * @param {number[]|string[]} newEids - Array of establishment IDs to subscribe to
     */
    replaceSubscriptions: function(newEids) {
      const newSet = new Set(newEids.map(String));

      // Unsubscribe from removed establishments
      state.activeEids.forEach((eidStr) => {
        if (!newSet.has(eidStr)) {
          this.unsubscribe(eidStr);
        }
      });

      // Subscribe to new establishments
      newSet.forEach((eidStr) => {
        this.subscribe(parseInt(eidStr));
      });
    },

    /**
     * Cleanup ALL listeners (on page unload, logout, or critical error)
     */
    cleanup: function() {
      // Call all unsubscribe functions
      Object.values(state.presenceListeners).forEach(fn => fn && fn());
      Object.values(state.voteListeners).forEach(fn => fn && fn());
      Object.values(state.ratingListeners).forEach(fn => fn && fn());

      // Clear all state
      state.presenceListeners = {};
      state.voteListeners = {};
      state.ratingListeners = {};
      state.activeEids.clear();

      // Clear global caches
      window._livePresences = {};
      window._liveVotes = {};
      window._liveRatings = {};
    },

    /**
     * Get active subscription count (for debugging/monitoring)
     * @returns {number}
     */
    getActiveCount: function() {
      return state.activeEids.size;
    },

    /**
     * Get diagnostic info (for debugging)
     * @returns {object}
     */
    getDiagnostics: function() {
      return {
        activeEids: Array.from(state.activeEids),
        presenceListeners: Object.keys(state.presenceListeners).length,
        voteListeners: Object.keys(state.voteListeners).length,
        ratingListeners: Object.keys(state.ratingListeners).length,
        totalListeners: 
          Object.keys(state.presenceListeners).length +
          Object.keys(state.voteListeners).length +
          Object.keys(state.ratingListeners).length,
      };
    },

    // ──────────────────────────────────────────────────────────────
    // Private helper methods
    // ──────────────────────────────────────────────────────────────

    _subscribePresence: function(eid) {
      if (!window.db || !window.fbOnSnapshot || !window.fbCollection) return;

      const eidStr = String(eid);
      if (state.presenceListeners[eidStr]) return; // Already subscribed

      try {
        const presCol = window.fbCollection(window.db, 'estabelissements', eidStr, 'presences');
        const unsubscribe = window.fbOnSnapshot(presCol, (snap) => {
          const now = Date.now();
          const TTL = 3 * 3600 * 1000; // 3 hours
          const users = [];

          snap.forEach((d) => {
            const data = d.data();
            if (data.ts && (now - data.ts) < TTL) {
              users.push({
                uid: d.id,
                pseudo: data.pseudo || 'Visiteur',
                ts: data.ts,
              });
            }
          });

          window._livePresences[eidStr] = {
            count: users.length,
            users: users,
          };

          // Patch card display
          if (window._patchCardPresence) {
            window._patchCardPresence(eid);
          }

          // Update rankings
          if (window._updateRankScoreLive) {
            window._updateRankScoreLive();
          }
        },
        (err) => {
          console.warn(`[Firebase] Presence listener error for ${eidStr}:`, err);
        });

        state.presenceListeners[eidStr] = unsubscribe;
      } catch (e) {
        console.warn(`[Firebase] Presence subscription failed for ${eidStr}:`, e);
      }
    },

    _subscribeVotes: function(eid) {
      if (!window.db || !window.fbOnSnapshot || !window.fbCollection) return;

      const eidStr = String(eid);
      if (state.voteListeners[eidStr]) return; // Already subscribed

      try {
        const voteCol = window.fbCollection(window.db, 'estabelissements', eidStr, 'votes');
        const unsubscribe = window.fbOnSnapshot(voteCol, (snap) => {
          let pos = 0, neg = 0;
          const myUid = window.currentUserUID || null;
          let myVote = null;

          snap.forEach((d) => {
            const v = d.data().vote;
            if (v === 'pos') pos++;
            if (v === 'neg') neg++;
            if (myUid && d.id === myUid) myVote = v || null;
          });

          window._liveVotes[eidStr] = {
            pos: pos,
            neg: neg,
            myVote: myVote,
          };

          // Patch card display
          if (window._patchCardVotes) {
            window._patchCardVotes(eid);
          }

          // Update rankings
          if (window._updateRankScoreLive) {
            window._updateRankScoreLive();
          }
        },
        (err) => {
          console.warn(`[Firebase] Vote listener error for ${eidStr}:`, err);
        });

        state.voteListeners[eidStr] = unsubscribe;
      } catch (e) {
        console.warn(`[Firebase] Vote subscription failed for ${eidStr}:`, e);
      }
    },

    _subscribeRatings: function(eid) {
      if (!window.db || !window.fbOnSnapshot || !window.fbCollection) return;

      const eidStr = String(eid);
      if (state.ratingListeners[eidStr]) return; // Already subscribed

      try {
        const rateCol = window.fbCollection(window.db, 'estabelissements', eidStr, 'ratings');
        const unsubscribe = window.fbOnSnapshot(rateCol, (snap) => {
          let total = 0, count = 0;

          snap.forEach((d) => {
            const r = d.data().rating;
            if (r >= 1 && r <= 5) {
              total += r;
              count++;
            }
          });

          const avgNote = count > 0 ? Math.round((total / count) * 10) / 10 : 0;

          window._liveRatings[eidStr] = {
            note: avgNote,
            avis: count,
          };

          // Update establishment data
          if (typeof estabelissements !== 'undefined') {
            const etab = estabelissements.find((x) => x.id === eid);
            if (etab && count > 0) {
              etab.note = avgNote;
              etab.avis = count;
            }
          }

          // Patch card display
          if (window._patchCardRating) {
            window._patchCardRating(eid);
          }

          // Update rankings
          if (window._updateRankScoreLive) {
            window._updateRankScoreLive();
          }
        },
        (err) => {
          console.warn(`[Firebase] Rating listener error for ${eidStr}:`, err);
        });

        state.ratingListeners[eidStr] = unsubscribe;
      } catch (e) {
        console.warn(`[Firebase] Rating subscription failed for ${eidStr}:`, e);
      }
    },
  };
})();

// Expose globally for easy access
window.__firebaseListenerManager = window.__FirebaseListenerManager;

// Log initialization
if (window.console && window.console.log) {
  console.log('[Init] Firebase Listener Manager initialized');
}
