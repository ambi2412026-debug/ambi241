/* ══════════════════════════════════════════════════════════════════
   SYSTÈME ABONNEMENT PREMIUM — COMPTE À REBOURS + ACTIVATION ADMIN
   ══════════════════════════════════════════════════════════════════ */
(function(){

/* ── State modal activation ── */
var _activatePayIdx = null;   // index dans paiements[]
var _activatePlan   = "mensuel";

/* ────────────────────────────────────────────────────────────────
   1. OUVRIR LE MODAL DE CONFIRMATION ADMIN
   Appelé par le bouton "Confirmer paiement" dans la liste admin
──────────────────────────────────────────────────────────────── */
window.ambiOpenActivateModal = function(payIdx){
  if(!isAdmin){ showToast("Accès admin requis"); return; }
  var p = paiements[payIdx];
  if(!p){ showToast("Paiement introuvable"); return; }

  _activatePayIdx = payIdx;

  // Pré-détecter le plan depuis le paiement ou l'étab
  var etab = etablissements.find(function(e){
    return e.nom && p.nom && e.nom.toLowerCase().indexOf(p.nom.toLowerCase().slice(0,8)) !== -1;
  });
  _activatePlan = p.abonnement_type || (etab && etab.abonnement_type) || "mensuel";

  // Mettre à jour le sous-titre
  var subEl = document.getElementById("ambiActivateSub");
  if(subEl) subEl.textContent = "Établissement : " + p.nom + " · " + (p.montant||0).toLocaleString("fr-FR") + " XAF";

  // Rendre les boutons de plan
  var planRow = document.getElementById("ambiActivatePlanRow");
  if(planRow){
    planRow.innerHTML = Object.keys(SUBSCRIPTION_PLANS).map(function(k){
      var pl = SUBSCRIPTION_PLANS[k];
      return "<div class='ambi-activate-plan-btn"+(k===_activatePlan?" sel":"")+"' onclick='ambiSelectPlan(\""+k+"\")'>"
        +"<div class='ap-icon'>"+pl.icon+"</div>"
        +"<div class='ap-name'>"+pl.label+"</div>"
        +"<div class='ap-price'>"+pl.dureeLabel+"</div>"
        +"</div>";
    }).join("");
  }

  document.getElementById("ambiActivateModal").classList.add("open");
};
window.ambiSelectPlan = function(plan){
  _activatePlan = plan;
  document.querySelectorAll(".ambi-activate-plan-btn").forEach(function(b){
    b.classList.toggle("sel", b.querySelector(".ap-name") && b.querySelector(".ap-name").textContent === (SUBSCRIPTION_PLANS[plan]||{}).label);
  });
};

/* ────────────────────────────────────────────────────────────────
   2. EXÉCUTER L'ACTIVATION (clic "Confirmer & Démarrer le chrono")
──────────────────────────────────────────────────────────────── */
window.ambiDoActivate = function(){
  var idx = _activatePayIdx;
  if(idx === null || !paiements[idx]) return;

  var p = paiements[idx];
  var planKey = _activatePlan;
  var planData = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS["mensuel"];
  var now = Date.now();
  var echeance = computeEcheance(planKey, now);

  // Fermer le modal
  document.getElementById("ambiActivateModal").classList.remove("open");

  // Trouver l'étab lié
  var etab = etablissements.find(function(e){
    return e.nom && p.nom && e.nom.toLowerCase().indexOf(p.nom.toLowerCase().slice(0,8)) !== -1;
  });

  var updateSubData = {
    abonnement_type: planKey,
    abonnement_activated_at: now,
    abonnement_echeance: echeance.toISOString(),
    paiement: "Actif — " + planData.label
  };

  // Btn loading
  var btn = document.getElementById("ambiActivateConfirmBtn");
  if(btn){ btn.textContent = "⏳ Activation…"; btn.disabled = true; }

  // Mettre à jour Firebase paiement
  var doAfterPay = function(){
    paiements[idx].statut = "Confirme";
    if(etab){
      etab.abonnement_type = planKey;
      etab.abonnement_activated_at = now;
      etab.abonnement_echeance = echeance.toISOString();
      etab.paiement = updateSubData.paiement;
    }
    if(btn){ btn.textContent = "✅ Confirmer & Démarrer le chrono"; btn.disabled = false; }
    renderPayments();
    renderAll();
    renderHome();
    if(typeof renderAdmEtabl === "function") setTimeout(renderAdmEtabl, 300);
    if(typeof renderAdmOverview === "function") setTimeout(renderAdmOverview, 350);
    showToast("🟢 Abonnement activé — chrono démarré !");
    // Ré-init countdowns
    setTimeout(function(){
      _initCountdownElements();
      _ambiInitBlockClocks();
    }, 500);
  };

  // Firebase paiement
  if(window.db && window.fbDoc && window.fbUpdateDoc){
    window.fbUpdateDoc(window.fbDoc(window.db,"paiements",p.id), {statut:"Confirme"})
      .catch(function(){});
  }
  // Firebase établissement
  if(etab && etab.id && window.db && window.fbDoc && window.fbUpdateDoc){
    window.fbUpdateDoc(window.fbDoc(window.db,"etablissements",String(etab.id)), updateSubData)
      .then(doAfterPay).catch(doAfterPay);
  } else {
    doAfterPay();
  }
};

/* ────────────────────────────────────────────────────────────────
   3. BLOCKCLOCK — Grande horloge numérique segment par segment
   Utilisée dans l'onglet Paiements du membre
──────────────────────────────────────────────────────────────── */
var _blockClocks = {}; // id → { echeanceTs, totalMs, interval }

window._ambiInitBlockClocks = function(){
  document.querySelectorAll("[data-blockclock]").forEach(function(container){
    var ts = parseInt(container.getAttribute("data-blockclock"), 10);
    var totalMs = parseInt(container.getAttribute("data-totalms") || "0", 10);
    var id = container.id;
    if(!id || !ts) return;
    if(_blockClocks[id]) return; // déjà lancé
    _startBlockClock(id, ts, totalMs);
  });
};

function _startBlockClock(containerId, echeanceTs, totalMs){
  var prev = { d:"", hh:"", mm:"", ss:"" };

  function _tick(){
    var container = document.getElementById(containerId);
    if(!container){ delete _blockClocks[containerId]; return; }

    var diff = echeanceTs - Date.now();
    var expired = diff <= 0;

    // Couleur selon urgence
    var colorClass = "cyan";
    if(expired || diff <= 259200000) colorClass = "red";
    else if(diff <= 604800000) colorClass = "amber";

    if(expired){
      // Afficher EXPIRÉ
      container.innerHTML = "<div style='text-align:center;padding:0.8rem;'>"
        +"<div style='font-family:Syne,sans-serif;font-weight:900;font-size:1.1rem;color:var(--red);letter-spacing:0.06em;'>🔴 ABONNEMENT EXPIRÉ</div>"
        +"<div style='font-size:0.65rem;color:var(--muted);margin-top:0.3rem;'>Renouvelez pour rétablir la visibilité</div>"
        +"</div>";
      delete _blockClocks[containerId];
      return;
    }

    var dVal = Math.floor(diff / 86400000);
    var hVal = Math.floor((diff % 86400000) / 3600000);
    var mVal = Math.floor((diff % 3600000) / 60000);
    var sVal = Math.floor((diff % 60000) / 1000);

    var dStr  = String(dVal);
    var hhStr = String(hVal).padStart(2,"0");
    var mmStr = String(mVal).padStart(2,"0");
    var ssStr = String(sVal).padStart(2,"0");

    // Barre de progression
    var prgEl = document.getElementById(containerId+"_prg");
    if(prgEl && totalMs > 0){
      var pct = Math.max(0, Math.min(100, (diff / totalMs) * 100));
      var fillColor = colorClass === "red" ? "var(--red)" : colorClass === "amber" ? "var(--amber)" : "linear-gradient(90deg,var(--green),var(--cyan))";
      prgEl.style.width = pct + "%";
      prgEl.style.background = fillColor;
    }

    // Mettre à jour les chiffres avec flip animation
    function _setDigits(segId, valStr, changed){
      var chars = valStr.split("");
      chars.forEach(function(c, ci){
        var el = document.getElementById(segId+"_"+ci);
        if(!el) return;
        if(el.textContent !== c){
          el.textContent = c;
          el.className = "ambi-bc-digit " + colorClass;
          el.classList.add("flip");
          setTimeout(function(){ el.classList.remove("flip"); }, 200);
        } else {
          el.className = "ambi-bc-digit " + colorClass;
        }
      });
    }

    if(dStr !== prev.d){
      var dEl = document.getElementById(containerId+"_days");
      if(dEl) dEl.textContent = dStr;
      prev.d = dStr;
    }
    if(hhStr !== prev.hh){ _setDigits(containerId+"_h", hhStr, true); prev.hh = hhStr; }
    else { _setDigits(containerId+"_h", hhStr, false); }
    if(mmStr !== prev.mm){ _setDigits(containerId+"_m", mmStr, true); prev.mm = mmStr; }
    else { _setDigits(containerId+"_m", mmStr, false); }
    if(ssStr !== prev.ss){ _setDigits(containerId+"_s", ssStr, true); prev.ss = ssStr; }
    else { _setDigits(containerId+"_s", ssStr, false); }

    _blockClocks[containerId] = setTimeout(_tick, 1000);
  }

  _blockClocks[containerId] = setTimeout(_tick, 0);
}

/* ── Génère le HTML de la blockclock ── */
window.ambiBlockClockHTML = function(containerId, echeanceTs, totalMs){
  var diff = echeanceTs - Date.now();
  var dVal = Math.max(0, Math.floor(diff / 86400000));
  var hVal = Math.floor((diff % 86400000) / 3600000);
  var mVal = Math.floor((diff % 3600000) / 60000);
  var sVal = Math.floor((diff % 60000) / 1000);
  var colorClass = diff <= 0 ? "red" : diff <= 259200000 ? "red" : diff <= 604800000 ? "amber" : "";

  function seg(segId, valStr, lbl){
    var chars = valStr.split("");
    return "<div class='ambi-bc-seg'>"
      +"<div class='ambi-bc-digits'>"
      + chars.map(function(c,ci){
          return "<div class='ambi-bc-digit "+colorClass+"' id='"+segId+"_"+ci+"'>"+c+"</div>";
        }).join("")
      +"</div>"
      +"<div class='ambi-bc-label'>"+lbl+"</div>"
      +"</div>";
  }

  var sep = "<div class='ambi-bc-sep'>:</div>";
  var pct = totalMs > 0 ? Math.max(0,Math.min(100,(diff/totalMs)*100)) : 100;
  var fillColor = colorClass === "red" ? "var(--red)" : colorClass === "amber" ? "var(--amber)" : "linear-gradient(90deg,var(--green),var(--cyan))";

  return "<div id='"+containerId+"' data-blockclock='"+echeanceTs+"' data-totalms='"+totalMs+"'>"
    +"<div class='ambi-blockclock'>"
    +"<div class='ambi-bc-seg'><div id='"+containerId+"_days' style='font-family:Syne,sans-serif;font-weight:800;font-size:1.8rem;color:var(--cyan);line-height:1;'>"+dVal+"</div><div class='ambi-bc-label'>Jours</div></div>"
    + sep
    + seg(containerId+"_h", String(hVal).padStart(2,"0"), "Hrs")
    + sep
    + seg(containerId+"_m", String(mVal).padStart(2,"0"), "Min")
    + sep
    + seg(containerId+"_s", String(sVal).padStart(2,"0"), "Sec")
    +"</div>"
    +"<div class='ambi-sub-progress-wrap'><div class='ambi-sub-progress-fill' id='"+containerId+"_prg' style='width:"+pct+"%;background:"+fillColor+";'></div></div>"
    +"</div>";
};

/* ────────────────────────────────────────────────────────────────
   4. RENDRE LA CARTE ABONNEMENT DANS L'ONGLET PAIEMENTS MEMBRE
   Remplace le bloc "Échéance + horloge" existant
──────────────────────────────────────────────────────────────── */
window.ambiRenderSubCard = function(myEtab){
  if(!myEtab) return "";

  var isActif = myEtab.paiement && myEtab.paiement.indexOf("Actif") !== -1;
  var planKey = myEtab.abonnement_type || "mensuel";
  var plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS["mensuel"];
  var activatedAt = myEtab.abonnement_activated_at;

  if(!isActif || !activatedAt){
    // Pas encore activé
    return "<div class='ambi-sub-card'>"
      +"<div class='ambi-sub-card-header'>"
      +"<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--text);'>⏱️ Abonnement</div>"
      +"<span class='ambi-sub-badge grey'>⏳ En attente</span>"
      +"</div>"
      +"<div class='ambi-sub-card-body'>"
      +"<div style='text-align:center;padding:1.2rem 0.5rem;'>"
      +"<div style='font-size:2rem;margin-bottom:0.4rem;'>⏳</div>"
      +"<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--amber);margin-bottom:0.3rem;'>En attente de confirmation</div>"
      +"<div style='font-size:0.72rem;color:var(--muted);line-height:1.5;'>L'administrateur AMBI241 confirmera votre paiement.<br>Le compte à rebours démarrera automatiquement.</div>"
      +"</div>"
      +"</div></div>";
  }

  var echeance = computeEcheance(planKey, activatedAt);
  var diff = echeance.getTime() - Date.now();
  var totalMs = plan.dureeJours * 86400000;
  var daysLeft = Math.ceil(diff / 86400000);

  var status = diff <= 0 ? "red" : diff <= 259200000 ? "red" : diff <= 604800000 ? "amber" : "green";
  var statusLabel = diff <= 0 ? "Expiré" : daysLeft <= 3 ? "Critique — "+daysLeft+"j" : daysLeft <= 7 ? "Alerte — "+daysLeft+"j" : "Actif";
  var statusDot = diff <= 0 ? "🔴" : daysLeft <= 3 ? "🚨" : daysLeft <= 7 ? "⚠️" : "🟢";
  var echeanceStr = echeance.toLocaleDateString("fr-FR",{day:"2-digit",month:"long",year:"numeric"});
  var activatedStr = new Date(activatedAt).toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});

  var cdId = "ambiMemberClock_"+myEtab.id;

  var html = "<div class='ambi-sub-card" + (status !== "grey" ? " just-activated" : "") + "' style='border-color:"
    +(status==="red"?"rgba(255,68,102,0.4)":status==="amber"?"rgba(255,215,0,0.3)":"rgba(0,229,255,0.18)")+";'>";

  // Header
  html += "<div class='ambi-sub-card-header'>";
  html += "<div>"
    +"<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--text);'>⏱️ Abonnement "+plan.icon+" "+plan.label+"</div>"
    +"<div style='font-size:0.62rem;color:var(--muted);margin-top:0.12rem;'>Activé le "+activatedStr+"</div>"
    +"</div>";
  html += "<span class='ambi-sub-badge "+status+"'>"+statusDot+" "+statusLabel+"</span>";
  html += "</div>";

  // Corps : blockclock
  html += "<div class='ambi-sub-card-body'>";

  if(diff <= 0){
    html += "<div style='text-align:center;padding:0.8rem;'>"
      +"<div style='font-family:Syne,sans-serif;font-weight:900;font-size:1.1rem;color:var(--red);'>🔴 ABONNEMENT EXPIRÉ</div>"
      +"<div style='font-size:0.7rem;color:var(--muted);margin-top:0.3rem;'>Renouvelez pour maintenir votre visibilité</div>"
      +"</div>";
  } else {
    html += "<div style='font-size:0.6rem;color:var(--muted);text-align:center;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.2rem;padding-top:0.3rem;'>Temps restant</div>";
    html += ambiBlockClockHTML(cdId, echeance.getTime(), totalMs);
  }

  // Infos bas
  html += "<div style='display:grid;grid-template-columns:1fr 1fr;gap:0.4rem;margin-top:0.7rem;'>";
  html += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.55rem 0.65rem;text-align:center;'>"
    +"<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.88rem;color:var(--cyan);'>"+daysLeft+"j</div>"
    +"<div style='font-size:0.58rem;color:var(--muted);'>Jours restants</div>"
    +"</div>";
  html += "<div style='background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.55rem 0.65rem;text-align:center;'>"
    +"<div style='font-family:Syne,sans-serif;font-weight:800;font-size:0.7rem;color:var(--text);'>"+echeanceStr+"</div>"
    +"<div style='font-size:0.58rem;color:var(--muted);'>Échéance</div>"
    +"</div>";
  html += "</div>";
  html += "</div></div>";

  return html;
};

/* ────────────────────────────────────────────────────────────────
   5. MINI-HORLOGE dans la liste paiements admin
──────────────────────────────────────────────────────────────── */
window.ambiPayClockHTML = function(etab){
  if(!etab || !etab.abonnement_activated_at) return "<span class='ambi-pay-clock grey'>⏳ Non activé</span>";
  var ech = computeEcheance(etab.abonnement_type||"mensuel", etab.abonnement_activated_at);
  if(!ech) return "<span class='ambi-pay-clock grey'>—</span>";
  var diff = ech.getTime() - Date.now();
  if(diff <= 0) return "<span class='ambi-pay-clock red'>🔴 EXPIRÉ</span>";
  var daysLeft = Math.ceil(diff/86400000);
  var colorCls = diff <= 259200000 ? "red" : diff <= 604800000 ? "amber" : "green";
  var cdId = "ambiPayClock_"+etab.id;
  return "<span id='"+cdId+"' class='ambi-countdown ambi-pay-clock "+colorCls+"' data-ts='"+ech.getTime()+"'>"
    +(daysLeft > 1 ? daysLeft+"j " : "")+"--:--:--"
    +"</span>";
};

/* ────────────────────────────────────────────────────────────────
   6. INIT automatique au chargement + après chaque renderPayments
──────────────────────────────────────────────────────────────── */
function _ambiBootClocks(){
  _initCountdownElements();
  _ambiInitBlockClocks();
}
if(document.readyState === "loading"){
  document.addEventListener("DOMContentLoaded", function(){ setTimeout(_ambiBootClocks, 800); });
} else {
  setTimeout(_ambiBootClocks, 800);
}
setTimeout(_ambiBootClocks, 1500);
setTimeout(_ambiBootClocks, 3000);

console.log("[AMBI241] ✅ Système abonnement premium — compte à rebours chargé");
})();