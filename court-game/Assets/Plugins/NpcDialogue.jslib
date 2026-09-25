mergeInto(LibraryManager.library, {
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
