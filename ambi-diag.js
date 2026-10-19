(function () {
  "use strict";
  var buf = [], zone = null, panel = null;
  function hms() { var d = new Date(), p = function (n) { return ("0" + n).slice(-2); }; return p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds()); }
  function desc(el) {
    if (!el || !el.tagName) return "?";
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    var c = typeof el.className === "string" ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".") : "";
    if (c) s += "." + c;
    return s;
  }
  function maj() { if (zone) zone.textContent = buf.slice(-14).join("\n"); }
  function log(m) { buf.push(hms() + " " + m); if (buf.length > 80) buf.shift(); maj(); }
  window.__ambiLog = log;
  window.addEventListener("error", function (e) { log("ERREUR " + (e.message || "?") + " @ " + String(e.filename || "").split("/").pop() + ":" + (e.lineno || "?")); });
  window.addEventListener("unhandledrejection", function (e) { var r = e.reason; log("PROMESSE " + ((r && (r.message || r.code)) || r)); });
  var actif = false;
  try {
    var m = /[?&]diag=([01])/.exec(location.search);
    if (m) { if (m[1] === "1") localStorage.setItem("ambi_diag", "1"); else localStorage.removeItem("ambi_diag"); }
    actif = localStorage.getItem("ambi_diag") === "1";
  } catch (e) {}
  if (!actif) return;
  function copier() {
    var t = buf.join("\n");
    function fb() { try { var a = document.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); log("(copie OK)"); } catch (e2) { log("(copie impossible)"); } }
    try { navigator.clipboard.writeText(t).then(function () { log("(copie OK)"); }, fb); } catch (e) { fb(); }
  }
  function btn(txt, fn) { var b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.onclick = fn; b.style.cssText = "pointer-events:auto;border:0;border-radius:8px;padding:6px 10px;margin:0 4px;font-size:12px;font-weight:700;background:#ff2d9b;color:#fff"; return b; }
  function init() {
    if (panel) return;
    panel = document.createElement("div");
    panel.style.cssText = "position:fixed;left:0;right:0;bottom:78px;z-index:2147483647;pointer-events:none;font:11px/1.35 monospace;color:#0f0";
    var bar = document.createElement("div");
    bar.style.cssText = "text-align:right;padding:2px 6px";
    bar.append(btn("Copier", copier), btn("Vider", function () { buf = []; maj(); }), btn("Off", function () { try { localStorage.removeItem("ambi_diag"); } catch (e) {} panel.remove(); }));
    zone = document.createElement("div");
    zone.style.cssText = "background:rgba(0,0,0,.82);padding:4px 6px;white-space:pre-wrap;word-break:break-all;max-height:24vh;overflow:hidden";
    panel.append(bar, zone);
    document.body.appendChild(panel);
    log("DIAG actif : touchez un element pour voir ce qui est dessus");
  }
  document.addEventListener("pointerdown", function (e) {
    if (panel && panel.contains(e.target)) return;
    var st = document.elementsFromPoint(e.clientX, e.clientY).slice(0, 5).map(function (el) { var cs = getComputedStyle(el); return desc(el) + "[z" + cs.zIndex + "," + cs.position + "]"; }).join(" < ");
    log("TAP(" + Math.round(e.clientX) + "," + Math.round(e.clientY) + ") " + st + (document.body.style.overflow === "hidden" ? " | body:overflow=hidden" : ""));
  }, true);
  if (document.body) init(); else document.addEventListener("DOMContentLoaded", init);
})();
