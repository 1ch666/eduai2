import {CourtReplayLoader} from './replay-loader.js';
import {createEvidenceViewer} from './evidence-viewer.js';

const eventLabels={session_started:'建立場次',session_completed:'庭審完成',statement:'陳述',ruling:'程序裁定',stage_changed:'程序推進',checkpoint:'保存點',npc_utterance:'角色發言',evidence_presented:'出示證物'};
const roleLabels={judge:'法官',plaintiff:'原告',defendant:'被告',prosecutor:'檢察官',defense:'辯護人',lawyer:'律師',witness:'證人',observer:'旁觀者'};
const label=(labels,value)=>Object.hasOwn(labels,value)?labels[value]:value;

export function installReplayPanel({document,window,getView,getAccount,beforeOpen}){
 const loader=new CourtReplayLoader({origin:window.location.origin});
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const dialog=make('dialog');dialog.className='game-panel replay-panel';dialog.setAttribute('aria-label','庭審紀錄重播');
 const title=make('h2','庭審紀錄 · 唯讀'),notice=make('p'),description=make('p','只回看伺服器已記錄的事件，不改變場次。舊場次可能沒有完整紀錄；目前不重播 3D 動作。');notice.setAttribute('role','status');
 const bar=make('div');bar.className='bar';
 const button=(text,fn)=>{const b=make('button',text);b.type='button';b.addEventListener('click',fn);return b;};
 const close=button('關閉',()=>dialog.close());
 const back=button('上一筆',()=>{loader.replay.step(-1);render();});
 const forward=button('下一筆',()=>{loader.replay.step();render();});
 const play=button('播放',()=>{loader.replay.playing?loader.replay.pause():loader.replay.play();render();});
 const more=button('讀取紀錄',()=>void load());bar.append(back,play,forward,more);
 const slider=make('input');slider.type='range';slider.min='0';slider.step='1';slider.setAttribute('aria-label','重播事件位置');slider.addEventListener('input',()=>{loader.replay.seek(Number(slider.value));render();});
 const filters=make('div');filters.className='grid';
 const fields={};for(const [key,label] of [['query','搜尋發言'],['roleId','發言角色'],['stageId','程序階段'],['evidenceId','關聯證物']]){
  const wrapper=make('label',label),input=make(key==='query'?'input':'select');input.maxLength=400;input.addEventListener(key==='query'?'input':'change',render);wrapper.append(input);filters.append(wrapper);fields[key]=input;
 }
 const current=make('section'),transcript=make('ol');transcript.className='replay-transcript';transcript.tabIndex=-1;transcript.setAttribute('aria-label','符合篩選的庭審紀錄');
 const clearFilters=button('清除篩選',()=>{for(const field of Object.values(fields))field.value='';render();});
 const evidenceViewer=createEvidenceViewer({document,onTranscript:id=>{
  for(const field of Object.values(fields))field.value='';fields.evidenceId.value=id;
  render();transcript.focus();
 }});
 dialog.append(close,title,description,notice,bar,slider,current,evidenceViewer.element,filters,clearFilters,transcript);document.body.append(dialog);
 let context=null,loading=false,generation=0,lastTime=0,raf=0;
 function valid(){return context&&getAccount()?.id===context.owner&&getView()?.id===context.id;}
 function render(){
  const replay=loader.replay,event=replay.current;
  evidenceViewer.setSnapshot(event?.snapshot);
  slider.max=String(Math.max(0,replay.length-1));slider.value=String(Math.max(0,replay.index));slider.disabled=!event;
  back.disabled=replay.index<=0;forward.disabled=replay.index>=replay.length-1;play.disabled=!event||replay.index>=replay.length-1;play.textContent=replay.playing?'暫停':'播放';more.disabled=loading;
  more.textContent=loader.caughtUp?'檢查新紀錄':'讀取下一頁';current.replaceChildren();transcript.replaceChildren();
  // Selectors use the unfiltered, already-played prefix only, never future
  // records or hidden case data. Reset options when rewinding or logging out.
  const prefix=replay.transcript(),choices={roleId:new Map(),stageId:new Map(),evidenceId:new Map()};
  for(const row of prefix){
   choices.roleId.set(row.roleId,label(roleLabels,row.roleId));
   choices.stageId.set(row.stageId,row.stageLabel);
   for(const id of row.evidenceIds)choices.evidenceId.set(id,id);
  }
  if(event){
   if(choices.stageId.has(event.stageId))choices.stageId.set(event.stageId,event.snapshot.state.stageLabel);
   for(const e of event.snapshot.state.evidence)if(choices.evidenceId.has(e.evidenceId))choices.evidenceId.set(e.evidenceId,e.title);
  }
  for(const [key,options] of Object.entries(choices)){
   const input=fields[key],selected=input.value;input.replaceChildren();
   const all=make('option','全部');all.value='';input.append(all);
   for(const [id,name] of options){const o=make('option',name);o.value=id;input.append(o);}
   input.value=options.has(selected)?selected:'';input.disabled=!options.size;
  }
  if(!event)return;
  current.append(make('h3',`${event.snapshot.state.stageLabel} · 版本 ${event.stateVersion}`),make('p',`${event.speaker} · ${event.timestamp}`),make('p',prefix.at(-1)?.displayText??event.text));
  const rows=replay.transcript(Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value])));
  if(!rows.length)transcript.append(make('li','目前播放位置之前，沒有符合篩選的紀錄。'));
  for(const row of rows){
   const li=make('li');li.append(make('p',`${row.speaker} · ${label(roleLabels,row.roleId)} · ${row.stageLabel} · ${label(eventLabels,row.kind)}`),make('p',row.timestamp),make('p',row.displayText));
   if(row.evidenceIds.length)li.append(make('p',`關聯證物：${row.evidenceIds.join('、')}`));
   if(row.citationIds.length)li.append(make('p',`法源標記：${row.citationIds.join('、')}（以場次法律來源為準）`));
   li.append(button(`回看第 ${row.eventSequence+1} 筆`,()=>{replay.jump(row.eventId);render();}));transcript.append(li);
  }
 }
 async function load(){
  if(loading||!valid())return;const started=generation;loading=true;notice.textContent='讀取中…';render();
  try{
   const result=await loader.next();if(started!==generation)return;if(!valid()){reset();return;}
   notice.textContent=result==='caught-up'?'已讀取目前全部紀錄。':result==='more'?'已載入一頁，可繼續讀取。':result==='login-required'?'登入已失效，請重新登入。':`紀錄暫時無法讀取（${result}），可手動重試。`;
   if(loader.replay.incompletePrefix)notice.textContent+=' 此場次較早的紀錄缺漏，從首筆保存點開始。';
  }catch{if(started===generation)notice.textContent='讀取失敗，可手動重試。';}
  finally{if(started===generation){loading=false;render();}}
 }
 function reset(){generation++;context=null;loading=false;loader.clear();window.cancelAnimationFrame(raf);raf=0;for(const f of Object.values(fields))f.value='';notice.textContent='';render();if(dialog.open)dialog.close();}
 function frame(now){if(!dialog.open)return;if(!valid()){reset();return;}if(loader.replay.tick(lastTime?now-lastTime:0))render();lastTime=now;raf=window.requestAnimationFrame(frame);}
 dialog.addEventListener('close',()=>{if(!dialog.open)reset();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){loader.replay.pause();render();}});
 window.addEventListener('pagehide',reset);
 return {clear:reset,open(){
  const v=getView(),account=getAccount();if(!v||!account)return;
  reset();beforeOpen();context={id:v.id,owner:account.id};loader.bind(v.id,v.config.caseId);dialog.showModal();lastTime=0;raf=window.requestAnimationFrame(frame);void load();
 }};
}
