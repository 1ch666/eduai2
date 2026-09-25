mergeInto(LibraryManager.library, {
  CourtInputHide: function() {
    if(window.courtInput){window.courtInput.element.remove();window.courtInput=null;}
  },
  CourtInputRect: function(x,y,w,h,value,enabled) {
    var text=UTF8ToString(value), canvas=document.querySelector('canvas');
    if(!canvas)return;
    var state=window.courtInput;
    if(!state){
      var el=document.createElement('textarea');
      el.setAttribute('aria-label','向 NPC 提問');el.placeholder='輸入問題（最多 400 字）';
      el.maxLength=400;el.autocomplete='off';el.spellcheck=false;
      el.style.cssText='position:fixed;z-index:50;box-sizing:border-box;resize:none;border:1px solid #758780;border-radius:0;background:white;color:#1f2b2e;font:18px/1.4 sans-serif;padding:8px;touch-action:auto;';
      state=window.courtInput={element:el,composing:false,last:text};
      var sync=function(){if(state.composing)return;state.last=el.value.slice(0,400);el.value=state.last;Module.SendMessage('NpcDialogue','SetBrowserText',state.last);};
      el.addEventListener('compositionstart',function(){state.composing=true;Module.SendMessage('NpcDialogue','SetComposition','1');});
      el.addEventListener('compositionend',function(){state.composing=false;sync();Module.SendMessage('NpcDialogue','SetComposition','0');});
      el.addEventListener('input',sync);
      ['keydown','keyup','pointerdown','pointermove','pointerup'].forEach(function(name){el.addEventListener(name,function(e){e.stopPropagation();});});
      document.body.appendChild(el);el.value=text;
    }
    var r=canvas.getBoundingClientRect();
    state.element.style.left=(r.left+x*r.width)+'px';state.element.style.top=(r.top+(1-y-h)*r.height)+'px';
    state.element.style.width=(w*r.width)+'px';state.element.style.height=(h*r.height)+'px';
    state.element.disabled=!enabled;
    if(!state.composing&&text!==state.last){state.element.value=text;state.last=text;}
  },
  CourtNpcRequest: function(operation,npcId,requestId,text) {
    if(window.parent===window)return;
    window.parent.postMessage({type:'court-npc-request',operation:UTF8ToString(operation),npcId:UTF8ToString(npcId),requestId:UTF8ToString(requestId),text:UTF8ToString(text)},location.origin);
  },
  CourtDialogueModal: function(open) {
    var controls = document.getElementById('touch-ui');
    if (open) {
      window.courtDialogueTouchWasVisible = controls && !controls.hidden;
      if (controls) controls.hidden = true;
      if (document.pointerLockElement) document.exitPointerLock();
      window.courtDialogueResize = function() {
        var vv = window.visualViewport;
        var canvas = document.querySelector('canvas');
        if (!vv || !canvas) return;
        var r = canvas.getBoundingClientRect();
        var inset = Math.max(0, Math.min(.65, (r.bottom - vv.height - vv.offsetTop) / r.height));
        Module.SendMessage('NpcDialogue', 'SetKeyboardInset', String(inset));
      };
      if (window.visualViewport) window.visualViewport.addEventListener('resize', window.courtDialogueResize);
    } else {
      if (controls && window.courtDialogueTouchWasVisible) controls.hidden = false;
      if (window.visualViewport && window.courtDialogueResize) window.visualViewport.removeEventListener('resize', window.courtDialogueResize);
      window.courtDialogueResize = null;
    }
  }
});
