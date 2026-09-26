mergeInto(LibraryManager.library, {
  CourtHostPanel: function(pointer) {
    var panel = UTF8ToString(pointer);
    if ((panel !== 'evidence' && panel !== 'actions') || window.parent === window) return;
    var send = function() { window.parent.postMessage({type:'court-panel',panel:panel},location.origin); };
    if (document.fullscreenElement && document.exitFullscreen) {
      Promise.resolve(document.exitFullscreen()).then(send,send);
    } else send();
  },
  CourtTouchChoices: function(a, b, c, d) {
    if (window.courtTouchChoices) window.courtTouchChoices([UTF8ToString(a), UTF8ToString(b), UTF8ToString(c), UTF8ToString(d)]);
  },
  CourtTouchClose: function() {
    if (window.courtTouchChoices) window.courtTouchChoices([]);
  },
  CourtTouchMessage: function(text, seconds) {
    if (window.courtTouchMessage) window.courtTouchMessage(UTF8ToString(text), seconds);
  }
});
