
    function _mpSwitchTab(tab){
      ['infos','docs','support'].forEach(function(t){
        var p=document.getElementById('_mpPane_'+t);
        var b=document.getElementById('_mpTab_'+t);
        if(p) p.style.display=(t===tab?'block':'none');
        if(b){ b.style.background=(t===tab?'var(--pink)':'transparent'); b.style.color=(t===tab?'#000':'var(--muted)'); }
      });
    }
    window._mpSwitchTab=_mpSwitchTab;
    