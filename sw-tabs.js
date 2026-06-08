/* ══════════════════════════════════════════════════════════════
   ══ DOUBLONS ÉTABLISSEMENTS — Détection & Suppression Admin  ══
   ══════════════════════════════════════════════════════════════ */
(function(){

  var _dblSelected = {}; // { firebaseId: true }

  /* ── Utilitaires DOM ── */
  function $id(id){ return document.getElementById(id); }
  function show(id){ var e=$id(id); if(e) e.style.display='block'; }
  function hide(id){ var e=$id(id); if(e) e.style.display='none'; }
  function setText(id,v){ var e=$id(id); if(e) e.textContent=v; }

  /* ── Normalise un nom pour comparaison ── */
  function normName(n){
    if(!n) return '';
    return n.trim().toLowerCase()
      .replace(/\s+/g,' ')
      .replace(/[''`]/g,"'");
  }

  /* ── Mise à jour du compteur sélectionnés ── */
  function updateSelectedCount(){
    var count = Object.keys(_dblSelected).length;
    setText('dblSelectedCount', count);
    var btn = $id('dblBtnDeleteSelected');
    if(btn){
      btn.style.opacity = count > 0 ? '1' : '0.45';
      btn.style.cursor  = count > 0 ? 'pointer' : 'not-allowed';
    }
  }

  /* ── Render un groupe de doublons ── */
  function renderGroup(groupName, items){
    var div = document.createElement('div');
    div.style.cssText='background:rgba(255,68,102,0.05);border:1.5px solid rgba(255,68,102,0.25);border-radius:14px;padding:0.9rem;margin-bottom:0.8rem;';

    /* En-tête du groupe */
    var header = document.createElement('div');
    header.style.cssText='display:flex;align-items:center;justify-content:space-between;margin-bottom:0.7rem;flex-wrap:wrap;gap:0.4rem;';
    header.innerHTML =
      '<div style="display:flex;align-items:center;gap:0.5rem;">' +
        '<span style="font-size:1rem;">🔁</span>' +
        '<span style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:0.88rem;color:#ff4466;">' + _esc(groupName) + '</span>' +
        '<span style="background:rgba(255,68,102,0.2);color:#ff4466;border:1px solid rgba(255,68,102,0.4);border-radius:100px;padding:0.05rem 0.5rem;font-size:0.65rem;font-weight:800;">' + items.length + ' entrées</span>' +
      '</div>' +
      '<button onclick="dblDeleteGroup(\'' + _escAttr(groupName) + '\')" ' +
        'style="padding:0.35rem 0.7rem;border-radius:8px;border:1px solid rgba(255,68,102,0.5);background:rgba(255,68,102,0.12);color:#ff4466;font-size:0.68rem;font-weight:800;cursor:pointer;font-family:\'DM Sans\',sans-serif;">' +
        '🗑️ Supprimer tout le groupe</button>';
    div.appendChild(header);

    /* Lignes par item */
    items.forEach(function(item, idx){
      var row = document.createElement('div');
      var isFirst = idx === 0;
      row.style.cssText = 'display:flex;align-items:center;gap:0.5rem;padding:0.5rem 0.55rem;border-radius:9px;margin-bottom:0.3rem;background:' +
        (isFirst ? 'rgba(0,255,170,0.06)' : 'rgba(255,255,255,0.03)') + ';border:1px solid ' +
        (isFirst ? 'rgba(0,255,170,0.2)' : 'rgba(255,255,255,0.06)') + ';';

      var cb = document.createElement('input');
      cb.type='checkbox';
      cb.id='dbl_cb_'+item.id;
      cb.style.cssText='accent-color:#ff4466;width:16px;height:16px;flex-shrink:0;cursor:pointer;';
      if(isFirst){
        // L'ORIGINAL ne doit jamais être sélectionné ni supprimé en masse
        cb.disabled = true;
        cb.checked = false;
        cb.style.cssText='width:16px;height:16px;flex-shrink:0;cursor:not-allowed;opacity:0.3;';
        cb.title = 'L\'original ne peut pas être supprimé en masse';
      } else {
        cb.checked = !!_dblSelected[item.id];
      }
      cb.onchange = function(){
        if(isFirst){ this.checked = false; return; } // sécurité supplémentaire
        if(this.checked) _dblSelected[item.id]=true;
        else delete _dblSelected[item.id];
        updateSelectedCount();
      };

      var info = document.createElement('div');
      info.style.cssText='flex:1;min-width:0;';
      info.innerHTML =
        '<div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">' +
          '<span style="font-size:0.78rem;font-weight:700;color:' + (isFirst ? 'var(--green)' : 'var(--text)') + ';">' + _esc(item.nom||'(sans nom)') + '</span>' +
          (isFirst ? '<span style="font-size:0.55rem;background:rgba(0,255,170,0.15);color:var(--green);border-radius:4px;padding:0.05rem 0.3rem;font-weight:800;">ORIGINAL</span>' : '<span style="font-size:0.55rem;background:rgba(255,68,102,0.15);color:#ff4466;border-radius:4px;padding:0.05rem 0.3rem;font-weight:800;">DOUBLON</span>') +
        '</div>' +
        '<div style="font-size:0.62rem;color:var(--muted);margin-top:0.15rem;display:flex;gap:0.5rem;flex-wrap:wrap;">' +
          '<span>🆔 <code style="color:var(--cyan);font-size:0.6rem;user-select:all;">' + _esc(item.id) + '</code></span>' +
          (item.quartier ? '<span>📍 '+_esc(item.quartier)+'</span>' : '') +
          (item.type ? '<span>🏷️ '+_esc(item.type)+'</span>' : '') +
        '</div>';

      var delBtn = document.createElement('button');
      delBtn.title='Supprimer cet établissement';
      delBtn.style.cssText='padding:0.3rem 0.5rem;border-radius:7px;border:1px solid rgba(255,68,102,0.4);background:rgba(255,68,102,0.1);color:#ff4466;font-size:0.68rem;cursor:pointer;flex-shrink:0;transition:all 0.15s;';
      delBtn.textContent='🗑';
      delBtn.onclick=(function(docId, rowEl){
        return function(){
          if(!confirm('Supprimer l\'établissement Firebase ID:\n'+docId+' ?')) return;
          deleteOneEtabl(docId, function(err){
            if(err){ alert('Erreur: '+err); return; }
            rowEl.style.opacity='0';
            rowEl.style.transition='opacity 0.3s';
            setTimeout(function(){ rowEl.remove(); }, 320);
            delete _dblSelected[docId];
            updateSelectedCount();
          });
        };
      })(item.id, row);

      row.appendChild(cb);
      row.appendChild(info);
      row.appendChild(delBtn);
      div.appendChild(row);
    });

    return div;
  }

  /* ── Escape HTML ── */
  function _esc(s){
    return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function _escAttr(s){
    return String(s||'').replace(/'/g,"\\'");
  }

  /* ── Supprimer un seul établissement Firebase ── */
  function deleteOneEtabl(docId, cb){
    if(!window.db || !window.fbDoc || !window.fbDeleteDoc){cb('Firebase non disponible');return;}
    window.fbDeleteDoc(window.fbDoc(window.db,'etablissements',docId))
      .then(function(){ cb(null); })
      .catch(function(e){ cb(e.message||'Erreur inconnue'); });
  }

  /* ════════════════════════════════════════════════════════
     FONCTION PRINCIPALE : Détecter les doublons
  ════════════════════════════════════════════════════════ */
  window.detectDoublonsEtabl = function(){
    // Sécurité : uniquement accessible aux admins
    if(!window.isAdmin){ console.warn('[AMBI241] detectDoublonsEtabl: accès refusé (non-admin)'); return; }
    /* Le panel est maintenant dans le modal doublons */
    var panel = document.getElementById('doublonsModalBody') || document.getElementById('admpanel-doublons');
    if(!panel) return;

    if(!window.db || !window.fbCollection || !window.fbGetDocs){
      $id('dblGroupsList').innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--red);font-size:0.82rem;">⚠️ Firebase non disponible. Reconnectez-vous.</div>';
      return;
    }

    _dblSelected = {};
    updateSelectedCount();
    hide('dblEmpty');
    $id('dblGroupsList').innerHTML='';
    show('dblLoader');
    setText('dblKpiTotal','…');
    setText('dblKpiGroups','…');
    setText('dblKpiCount','…');

    window.fbGetDocs(window.fbCollection(window.db,'etablissements')).then(function(snap){
      hide('dblLoader');

      var allDocs = [];
      snap.forEach(function(doc){
        var d = doc.data();
        allDocs.push({ id: doc.id, nom: d.nom||d.name||'', quartier: d.quartier||d.neighborhood||'', type: d.type||d.categorie||'', createdAt: d.createdAt||null });
      });

      setText('dblKpiTotal', allDocs.length);

      /* Regrouper par nom normalisé */
      var groups = {};
      allDocs.forEach(function(item){
        var key = normName(item.nom);
        if(!key) return;
        if(!groups[key]) groups[key]=[];
        groups[key].push(item);
      });

      /* Garder uniquement les groupes avec doublons */
      var dupGroups = {};
      Object.keys(groups).forEach(function(k){
        if(groups[k].length > 1) dupGroups[k] = groups[k];
      });

      var groupKeys = Object.keys(dupGroups);
      var totalDups = groupKeys.reduce(function(acc,k){ return acc + dupGroups[k].length - 1; }, 0);

      setText('dblKpiGroups', groupKeys.length);
      setText('dblKpiCount', totalDups);

      /* Mettre à jour le badge onglet */
      var badge = $id('admDoublonsBadge');
      if(badge){
        if(totalDups > 0){
          badge.style.display='flex';
          badge.textContent = totalDups > 9 ? '9+' : totalDups;
        } else {
          badge.style.display='none';
        }
      }

      if(groupKeys.length === 0){
        show('dblEmpty');
        return;
      }

      var container = $id('dblGroupsList');
      groupKeys.sort().forEach(function(key){
        var items = dupGroups[key];
        /* Trier : garder le plus ancien en premier (comme "original") */
        items.sort(function(a,b){
          var ta = a.createdAt ? (a.createdAt.seconds||0) : 0;
          var tb = b.createdAt ? (b.createdAt.seconds||0) : 0;
          return ta - tb;
        });
        container.appendChild(renderGroup(items[0].nom || key, items));
      });

    }).catch(function(err){
      hide('dblLoader');
      $id('dblGroupsList').innerHTML = '<div style="background:rgba(255,68,102,0.1);border:1px solid rgba(255,68,102,0.3);border-radius:12px;padding:1rem;color:#ff4466;font-size:0.78rem;">❌ Erreur lors du chargement : ' + _esc(err.message||err) + '</div>';
    });
  };

  /* ── Sélectionner tous les doublons (pas les originaux) ── */
  window.dblSelectAllDuplicates = function(){
    var checkboxes = document.querySelectorAll('#dblGroupsList input[type=checkbox]');
    checkboxes.forEach(function(cb){
      if(cb.disabled) return; // Ne pas sélectionner les originaux
      cb.checked = true;
      var id = cb.id.replace('dbl_cb_','');
      _dblSelected[id] = true;
    });
    updateSelectedCount();
  };

  /* ── Supprimer tous les sélectionnés ── */
  window.dblDeleteSelected = function(){
    var ids = Object.keys(_dblSelected);
    if(ids.length === 0){ alert('Aucun établissement sélectionné.'); return; }
    if(!confirm('⚠️ Supprimer définitivement ' + ids.length + ' établissement(s) ?\n\nCette action est irréversible.')) return;

    var deleted = 0, errors = 0;
    var total = ids.length;

    function next(){
      if(ids.length === 0){
        alert('✅ ' + deleted + ' supprimé(s)' + (errors>0 ? ', ' + errors + ' erreur(s)' : '') + '.');
        _dblSelected = {};
        detectDoublonsEtabl();
        return;
      }
      var id = ids.shift();
      deleteOneEtabl(id, function(err){
        if(err) errors++;
        else { deleted++; delete _dblSelected[id]; }
        next();
      });
    }
    next();
  };

  /* ── Supprimer tout un groupe (sauf le 1er — l'original) ── */
  window.dblDeleteGroup = function(groupName){
    /* Trouver le groupe par son nom dans l'en-tête */
    var allGroupDivs = document.querySelectorAll('#dblGroupsList > div');
    var groupDiv = null;
    allGroupDivs.forEach(function(d){
      var titleEl = d.querySelector('span[style*="color:#ff4466"]');
      if(titleEl && titleEl.textContent.trim() === groupName) groupDiv = d;
    });

    var groupIds = [];
    if(groupDiv){
      groupDiv.querySelectorAll('input[type=checkbox]').forEach(function(cb){
        if(!cb.disabled){ // disabled = original, on ne le supprime pas
          groupIds.push(cb.id.replace('dbl_cb_',''));
        }
      });
    }

    if(groupIds.length === 0){
      alert('Aucun doublon à supprimer dans ce groupe (seul l\'original reste).');
      return;
    }
    if(!confirm('⚠️ Supprimer ' + groupIds.length + ' doublon(s) pour "' + groupName + '" ?\n\nL\'original (1ère entrée) sera conservé.')) return;

    var deleted=0, errors=0;
    function next(){
      if(groupIds.length===0){
        alert('✅ ' + deleted + ' doublon(s) supprimé(s)' + (errors>0?' — '+errors+' erreur(s)':'') + '.');
        detectDoublonsEtabl();
        return;
      }
      var id=groupIds.shift();
      deleteOneEtabl(id,function(err){
        if(err)errors++; else deleted++;
        next();
      });
    }
    next();
  };

  console.log('[AMBI241] ✅ Module Doublons Établissements chargé');
})();