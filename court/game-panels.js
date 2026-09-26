// Reuse the live, server-authorised controls. Opening a box never submits an action.
export function installGamePanels({window, document, getView, getAccount, onClose}) {
  let active = null;
  const close = () => { if (active) active.close(); };
  const listener = async event => {
    const frame = document.getElementById('scene');
    if (event.origin !== window.location.origin || event.source !== frame?.contentWindow ||
        event.data?.type !== 'court-panel' || !['evidence','actions'].includes(event.data.panel)) return;
    const view = getView(), account = getAccount();
    if (!view || !account || active) return;
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch { return; }
    if (getView()?.id !== view.id || getAccount()?.id !== account.id || active) return;
    const dialog = document.createElement('dialog');
    dialog.className = 'game-panel';
    const title = document.createElement('h2');
    title.id = 'game-panel-title';
    title.textContent = event.data.panel === 'evidence' ? '本案證物' : '本案程序';
    dialog.setAttribute('aria-labelledby', title.id);
    const back = document.createElement('button'); back.type = 'button';
    back.textContent = '返回 3D 場景'; back.onclick = () => dialog.close();
    dialog.append(title, back);
    const ids = event.data.panel === 'evidence' ? ['evidence'] : ['turn-title','turn-help','actions','speech-form','observer','feedback','assessment'];
    const moved = [];
    for (const id of ids) {
      const element = document.getElementById(id);
      if (!element) continue;
      const marker = document.createComment('game-panel-return');
      element.before(marker); dialog.append(element); moved.push({element,marker});
    }
    // Server render() keeps updating the same elements and their original listeners.
    dialog.addEventListener('close', () => {
      for (const {element,marker} of moved) marker.replaceWith(element);
      dialog.remove(); active = null; onClose?.(); frame.focus();
    }, {once:true});
    document.body.append(dialog); active = dialog; dialog.showModal(); back.focus();
  };
  window.addEventListener('message', listener);
  window.addEventListener('pagehide', close);
  document.getElementById('logout')?.addEventListener('click', close, {capture:true});
  document.getElementById('back')?.addEventListener('click', close, {capture:true});
  return {close};
}
