
/* ── Photo Viewer — fonctions manquantes ── */
function openPhotoViewer(eid, type, idx) {
  var viewer = document.getElementById('photoViewer');
  if (!viewer) return;
  var photos = [];
  try {
    var key = 'ambi241_photos_' + eid + '_' + (type || 'interieur');
    var stored = JSON.parse(localStorage.getItem(key) || '[]');
    photos = stored;
  } catch(e) {}
  var img = viewer.querySelector('img');
  if (img && photos[idx || 0]) {
    img.src = photos[idx || 0];
    img.alt = 'Photo établissement';
  }
  viewer.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closePhotoViewer() {
  var viewer = document.getElementById('photoViewer');
  if (viewer) viewer.style.display = 'none';
  document.body.style.overflow = '';
}
window.openPhotoViewer = openPhotoViewer;
window.closePhotoViewer = closePhotoViewer;
