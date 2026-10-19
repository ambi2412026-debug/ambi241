(function () {
  "use strict";
  var URL_SITE = "https://ambi2412026-debug.github.io/ambi241/";
  var NOM = "AMBI 241";
  var DESC = "Scannez pour ouvrir l'application AMBI 241.";
  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  var pageAdmin = /admin|securite/.test(page);
  var q = null;

  function charger(cb) {
    if (window.qrcode) return cb();
    var s = document.createElement("script");
    s.src = "qrcode-gen.js?v=1";
    s.onload = cb;
    s.onerror = function () { alert("Générateur de QR introuvable (qrcode-gen.js)."); };
    document.head.appendChild(s);
  }
  function matrice() {
    if (!q) { q = window.qrcode(0, "H"); q.addData(URL_SITE); q.make(); }
    return q;
  }
  function dessiner(cv, taille) {
    var m = matrice(), n = m.getModuleCount(), ms = Math.floor(taille / (n + 8)), t = ms * (n + 8);
    cv.width = t; cv.height = t;
    var c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, t, t);
    c.fillStyle = "#000";
    for (var r = 0; r < n; r++) for (var k = 0; k < n; k++) if (m.isDark(r, k)) c.fillRect((k + 4) * ms, (r + 4) * ms, ms, ms);
    return cv;
  }
  function poster() {
    var W = 2400, H = 3200, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    var c = cv.getContext("2d");
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    c.fillStyle = "#0d0020"; c.fillRect(0, 0, W, 380);
    c.fillStyle = "#fff"; c.textAlign = "center"; c.textBaseline = "middle";
    c.font = "bold 150px Arial, sans-serif"; c.fillText(NOM, W / 2, 150);
    c.font = "70px Arial, sans-serif"; c.fillText("Application AMBI 241", W / 2, 290);
    var qc = dessiner(document.createElement("canvas"), 1500);
    c.drawImage(qc, (W - qc.width) / 2, 520);
    var y = 520 + qc.height + 120;
    c.fillStyle = "#282828"; c.font = "72px Arial, sans-serif"; c.fillText(DESC, W / 2, y);
    c.fillStyle = "#d4177f"; c.font = "bold 58px Arial, sans-serif"; c.fillText(URL_SITE, W / 2, y + 140);
    c.fillStyle = "#0d0020"; c.fillRect(0, H - 120, W, 120);
    return cv;
  }
  function telecharger() {
    poster().toBlob(function (b) {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(b); a.download = "QR-AMBI241.png";
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    }, "image/png");
  }
  function imprimer() {
    var img = dessiner(document.createElement("canvas"), 1400).toDataURL("image/png");
    var f = document.createElement("iframe");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open();
    d.write("<!doctype html><html><head><meta charset=\"utf-8\"><title>QR " + NOM + "</title><style>@page{size:A4;margin:15mm}body{font-family:Arial,sans-serif;text-align:center;margin:0}h1{font-size:34pt;margin:10mm 0 2mm}p{font-size:14pt;margin:3mm 0}img{width:150mm;height:150mm;margin:8mm auto;display:block}.u{font-weight:bold;font-size:13pt;word-break:break-all}</style></head><body><h1>" + NOM + "</h1><p>" + DESC + "</p><img src=\"" + img + "\"><p class=\"u\">" + URL_SITE + "</p></body></html>");
    d.close();
    setTimeout(function () { f.contentWindow.focus(); f.contentWindow.print(); }, 500);
    setTimeout(function () { f.remove(); }, 60000);
  }
  function bouton(txt, bg, fn) {
    var b = document.createElement("button");
    b.type = "button"; b.textContent = txt; b.onclick = fn;
    b.style.cssText = "border:0;border-radius:10px;padding:10px 14px;margin:4px;font-size:14px;font-weight:700;color:#fff;cursor:pointer;background:" + bg;
    return b;
  }
  function ouvrir() {
    charger(function () {
      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2147483001;display:flex;align-items:center;justify-content:center";
      var card = document.createElement("div");
      card.style.cssText = "background:#fff;color:#111;border-radius:16px;padding:18px;width:340px;max-width:92vw;text-align:center;font-family:Arial,sans-serif";
      function fermer() { ov.remove(); document.removeEventListener("keydown", esc); }
      function esc(e) { if (e.key === "Escape") fermer(); }
      var h = document.createElement("h3"); h.textContent = "🔳 QR " + NOM; h.style.margin = "0 0 8px";
      var cv = dessiner(document.createElement("canvas"), 1000);
      cv.style.cssText = "width:260px;height:260px;max-width:100%";
      var p = document.createElement("p"); p.textContent = URL_SITE; p.style.cssText = "font-size:12px;word-break:break-all;margin:8px 0";
      var row = document.createElement("div");
      row.append(
        bouton("🖨️ Imprimer", "#0d0020", imprimer),
        bouton("⬇️ Télécharger", "#d4177f", telecharger),
        bouton("📋 Copier le lien", "#444", function () {
          try { navigator.clipboard.writeText(URL_SITE); this.textContent = "✅ Copié"; } catch (e) { prompt("Lien :", URL_SITE); }
        }),
        bouton("Fermer", "#888", fermer)
      );
      card.append(h, cv, p, row);
      ov.appendChild(card);
      ov.addEventListener("click", function (e) { if (e.target === ov) fermer(); });
      document.addEventListener("keydown", esc);
      document.body.appendChild(ov);
    });
  }
  function estAdmin() { try { if (window.isAdmin) return true; var n = document.getElementById("navAdminSettings"); return !!(n && getComputedStyle(n).display !== "none"); } catch (e) { return false; } }
  function init() {
    if (document.getElementById("ambiQrBtn")) return;
    var b = document.createElement("button");
    b.id = "ambiQrBtn"; b.type = "button"; b.title = "Code QR AMBI 241"; b.setAttribute("aria-label", "Code QR AMBI 241");
    b.textContent = "🔳"; b.onclick = ouvrir;
    b.style.cssText = "position:fixed;left:14px;bottom:14px;width:46px;height:46px;border-radius:50%;border:2px solid #ff2d9b;background:#0d0020;color:#fff;font-size:22px;line-height:1;padding:0;cursor:pointer;z-index:2147483000;box-shadow:0 2px 8px rgba(0,0,0,.4)";
    if (!pageAdmin) {
      b.style.display = "none";
      setInterval(function () { b.style.display = estAdmin() ? "block" : "none"; }, 1500);
    }
    var nv = document.querySelector(".bottom-nav"); b.style.bottom = ((nv && nv.offsetHeight) ? nv.offsetHeight + 12 : 14) + "px";
    document.body.appendChild(b);
  }
  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init);
})();
