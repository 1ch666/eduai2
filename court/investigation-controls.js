// Presentation only: server descriptors authorize each operation. No case facts,
// contradiction rules or answers belong in this module.
export const isInvestigationControlAction=id=>/^investigate\.(discover|hint|(question|present|followUp)\.[A-Za-z0-9_-]+)$/.test(id);
export function createInvestigationControls({document,onAction}){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('section');root.className='investigation-controls';root.setAttribute('aria-label','證物與角色調查');
 const title=make('h3','證物與角色調查'),discover=make('div'),evidence=make('div');
 const label=make('label','向誰詢問或出示？'),select=make('select'),actions=make('div'),notice=make('p'),hints=make('div');
 const progress=make('div');progress.setAttribute('aria-label','角色調查進度');
 label.append(select);notice.setAttribute('role','status');
 root.append(title,discover,evidence,label,progress,actions,notice,hints);
 let snapshot=null,locked=true,identity='',selected='',difficulty='normal',board=null,generation=0;
 const available=()=>snapshot?.state.allowedActions||[];
 const relevant=()=>available().filter(a=>isInvestigationControlAction(a.actionId));
 function button(action,parent){
  const binding=identity,version=snapshot.stateVersion,npc=action.actionId.split('.')[2];
  const b=make('button',action.label);b.type='button';b.disabled=locked||!action.enabled||action.requiredTarget!=='none';
  b.onclick=()=>{
   const current=available().find(a=>a.actionId===action.actionId);
   if(locked||binding!==identity||version!==snapshot?.stateVersion||snapshot?.state.completed||!current?.enabled||current.requiredTarget!=='none'||(difficulty==='challenge'&&current.actionId==='investigate.hint'))return;
   if(npc&&(selected!==npc||!snapshot.state.npcs.some(n=>n.npcId===npc&&n.visible&&n.interactable&&n.requestState!=='pending')))return;
   // Only send an identifier from the current server snapshot. The owning
   // transport adds version/idempotency and rechecks before issuing a request.
   onAction(current.actionId);
  };
  parent.append(b);if(!action.enabled&&action.reasonDisabled)parent.append(make('p',action.reasonDisabled));
 }
 function render(){
  const revision=++generation;
  const items=relevant();root.hidden=!items.length||!!snapshot?.state.completed;
  discover.replaceChildren();evidence.replaceChildren();actions.replaceChildren();hints.replaceChildren();progress.replaceChildren();select.replaceChildren();notice.textContent='';
  if(root.hidden)return;
  for(const a of items.filter(a=>a.actionId==='investigate.discover'))button(a,discover);
  const visible=snapshot.state.evidence||[];
  for(const e of visible)evidence.append(make('p',e.title+'：'+e.text));
  if(!visible.length)evidence.append(make('p','尚未取得證物；取得後才能出示。'));
  const npcs=(snapshot.state.npcs||[]).filter(n=>n.visible&&n.interactable&&n.requestState!=='pending'&&items.some(a=>a.actionId.endsWith('.'+n.npcId)));
  if(!npcs.some(n=>n.npcId===selected))selected=npcs[0]?.npcId||'';
  const heard=id=>board?.questionedNpcIds.includes(id)===true;
  for(const n of npcs){const o=make('option',n.displayName+(board?(heard(n.npcId)?' · 已聽取原始陳述':' · 尚未聽取原始陳述'):''));o.value=n.npcId;select.append(o);}
  select.value=selected;select.disabled=locked||!npcs.length;
  if(board&&selected){
   progress.append(make('p',heard(selected)?'此角色的原始陳述已由伺服器記錄。':'尚未聽取此角色的原始陳述；自由提問不等於完成此調查目標。'));
   // Only echo already-heard statements in this same-version public board.
   // Do not import the authored case, infer testimony or show hidden NPCs.
   for(const statement of board.statements.filter(s=>heard(selected)&&s.npcId===selected))progress.append(make('blockquote',statement.text));
   const remaining=npcs.filter(n=>!heard(n.npcId)&&items.some(a=>a.actionId==='investigate.question.'+n.npcId&&a.enabled&&a.requiredTarget==='none'));
   const next=remaining.find(n=>n.npcId!==selected);
   if(next&&difficulty!=='challenge'){
    const b=make('button','切換尚未詢問角色：'+next.displayName);b.type='button';b.disabled=locked;
    b.onclick=()=>{
     if(locked||revision!==generation||snapshot?.state.completed)return;
     selected=next.npcId;render();select.focus();
    };
    progress.append(b);
   }
  }
  for(const a of items.filter(a=>selected&&a.actionId.endsWith('.'+selected)))button(a,actions);
  if(!npcs.length)notice.textContent='目前沒有可調查的角色。';
  else if(locked)notice.textContent='正在同步或等待操作結果，請先完成恢復。';
  else notice.textContent=difficulty==='challenge'?'依據已取得資料自行調查。':difficulty==='tutorial'?'先選擇角色聽取原始陳述，再調查現場紀錄。比較時間與內容，向相關角色出示證物；伺服器確認矛盾後才會解鎖追問。發現矛盾不等於證明犯罪。':'先聽取陳述，再出示已取得的證物；可追問時會顯示追問按鈕。';
  if(difficulty!=='challenge')for(const a of items.filter(a=>a.actionId==='investigate.hint'))button(a,hints);
 }
 select.onchange=()=>{selected=select.value;render();};
 return {element:root,setSnapshot(next,blocked=false,mode='normal',publicView=null){
  const key=next?next.sessionId+':'+next.caseId:'';
  if(key!==identity){selected='';identity=key;}
  snapshot=next;locked=blocked;difficulty=mode;
  const current=next&&publicView?.id===next.sessionId&&publicView.config?.caseId===next.caseId&&publicView.version===next.stateVersion?publicView.investigation:null;
  board=current&&Array.isArray(current.questionedNpcIds)&&Array.isArray(current.statements)?current:null;
  render();
 }};
}
