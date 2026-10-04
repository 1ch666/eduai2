// Presentation only: server descriptors authorize each operation. No case facts,
// contradiction rules or answers belong in this module.
export const isInvestigationControlAction=id=>/^investigate\.(discover|hint|(question|present|followUp)\.[A-Za-z0-9_-]+)$/.test(id);
export function createInvestigationControls({document,onAction}){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('section');root.className='investigation-controls';root.setAttribute('aria-label','證物與角色調查');
 const title=make('h3','證物與角色調查'),discover=make('div'),evidence=make('div');
 const label=make('label','向誰詢問或出示？'),select=make('select'),actions=make('div'),notice=make('p'),hints=make('div');
 label.append(select);notice.setAttribute('role','status');
 root.append(title,discover,evidence,label,actions,notice,hints);
 let snapshot=null,locked=true,identity='',selected='';
 const available=()=>snapshot?.state.allowedActions||[];
 const relevant=()=>available().filter(a=>isInvestigationControlAction(a.actionId));
 function button(action,parent){
  const binding=identity,version=snapshot.stateVersion,npc=action.actionId.split('.')[2];
  const b=make('button',action.label);b.type='button';b.disabled=locked||!action.enabled||action.requiredTarget!=='none';
  b.onclick=()=>{
   const current=available().find(a=>a.actionId===action.actionId);
   if(locked||binding!==identity||version!==snapshot?.stateVersion||snapshot?.state.completed||!current?.enabled||current.requiredTarget!=='none')return;
   if(npc&&(selected!==npc||!snapshot.state.npcs.some(n=>n.npcId===npc&&n.visible&&n.interactable&&n.requestState!=='pending')))return;
   // Only send an identifier from the current server snapshot. The owning
   // transport adds version/idempotency and rechecks before issuing a request.
   onAction(current.actionId);
  };
  parent.append(b);if(!action.enabled&&action.reasonDisabled)parent.append(make('p',action.reasonDisabled));
 }
 function render(){
  const items=relevant();root.hidden=!items.length||!!snapshot?.state.completed;
  discover.replaceChildren();evidence.replaceChildren();actions.replaceChildren();hints.replaceChildren();select.replaceChildren();notice.textContent='';
  if(root.hidden)return;
  for(const a of items.filter(a=>a.actionId==='investigate.discover'))button(a,discover);
  const visible=snapshot.state.evidence||[];
  for(const e of visible)evidence.append(make('p',e.title+'：'+e.text));
  if(!visible.length)evidence.append(make('p','尚未取得證物；取得後才能出示。'));
  const npcs=(snapshot.state.npcs||[]).filter(n=>n.visible&&n.interactable&&n.requestState!=='pending'&&items.some(a=>a.actionId.endsWith('.'+n.npcId)));
  if(!npcs.some(n=>n.npcId===selected))selected=npcs[0]?.npcId||'';
  for(const n of npcs){const o=make('option',n.displayName);o.value=n.npcId;select.append(o);}
  select.value=selected;select.disabled=locked||!npcs.length;
  for(const a of items.filter(a=>selected&&a.actionId.endsWith('.'+selected)))button(a,actions);
  if(!npcs.length)notice.textContent='目前沒有可調查的角色。';
  else if(locked)notice.textContent='正在同步或等待操作結果，請先完成恢復。';
  else notice.textContent='先聽取陳述，再出示已取得的證物；可追問時會顯示追問按鈕。';
  for(const a of items.filter(a=>a.actionId==='investigate.hint'))button(a,hints);
 }
 select.onchange=()=>{selected=select.value;render();};
 return {element:root,setSnapshot(next,blocked=false){
  const key=next?next.sessionId+':'+next.caseId:'';
  if(key!==identity){selected='';identity=key;}
  snapshot=next;locked=blocked;render();
 }};
}
