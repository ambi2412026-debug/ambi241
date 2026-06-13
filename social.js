/* ═══════════════════════════════════════════════════════════════════
   AMBI241 — social.js
   Module Interactions Sociales
   • Likes, follows, partages
   • Expose window.likePost(), window.followUser()
═══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  async function likePost(postId, collection = 'posts') {
    if (!window.auth?.currentUser || !window.db) return;
    const uid = window.auth.currentUser.uid;

    try {
      const ref  = window.fbDoc(window.db, collection, postId);
      const snap = await window.fbGetDoc(ref);
      if (!snap.exists()) return;

      const likes    = snap.data().likes || [];
      const hasLiked = likes.includes(uid);

      await window.fbUpdateDoc(ref, {
        likes:     hasLiked
          ? likes.filter(id => id !== uid)
          : [...likes, uid],
        likesCount: window.fbIncrement(hasLiked ? -1 : 1)
      });

      return !hasLiked; // true = liked, false = unliked
    } catch (err) {
      console.warn('[Social] Erreur like :', err);
    }
  }

  async function followUser(targetUid) {
    const uid = window.auth?.currentUser?.uid;
    if (!uid || !targetUid || uid === targetUid || !window.db) return;

    try {
      const followRef = window.fbDoc(window.db, 'follows', `${uid}_${targetUid}`);
      const snap      = await window.fbGetDoc(followRef);

      if (snap.exists()) {
        await window.fbDeleteDoc(followRef);
        console.log('[Social] Unfollow :', targetUid);
        return false;
      } else {
        await window.fbSetDoc(followRef, {
          follower:  uid,
          following: targetUid,
          createdAt: window.fbServerTimestamp()
        });
        console.log('[Social] Follow :', targetUid);
        return true;
      }
    } catch (err) {
      console.warn('[Social] Erreur follow :', err);
    }
  }

  function initSocial() {
    // Délégation d'événements sur les boutons like
    document.addEventListener('click', async (e) => {
      const likeBtn = e.target.closest('[data-like-post]');
      if (likeBtn) {
        e.stopPropagation();
        const postId = likeBtn.dataset.likePost;
        if (postId) await likePost(postId);
      }

      const followBtn = e.target.closest('[data-follow-user]');
      if (followBtn) {
        e.stopPropagation();
        const targetUid = followBtn.dataset.followUser;
        if (targetUid) await followUser(targetUid);
      }
    });

    console.log('[AMBI241] ✅ Module Social initialisé');
  }

  window.likePost   = likePost;
  window.followUser = followUser;
  window.initSocial = initSocial;

  window.addEventListener('ambi241Ready', initSocial);

  console.log('[AMBI241] ✅ Module Social chargé');
})();
