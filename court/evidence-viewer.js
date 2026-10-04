import {parseSnapshot} from './protocol.js';

const types={image:'圖片',document:'文件',chat:'對話紀錄',timeline:'時間線',audioTranscript:'錄音逐字稿',objectPhoto:'物品／照片',mapDiagram:'地圖／示意圖',syntheticRecord:'虛構紀錄文件',cctvStill:'虛構監視器畫面'};
const admission={notConsidered:'尚未審酌',admitted:'已採納',excluded:'已排除'};
// All rendering is text-only. Asset IDs are NOT URLs and are never fetched here.
// Only this snapshot's visible evidence is selectable, including during replay.
export function createEvidenceViewer({document,onTranscript}){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('details');root.className='evidence-viewer';root.append(make('summary','檢視／比較證物'));
 const notice=make('p'),controls=make('div'),columns=make('div');controls.className=columns.className='evidence-comparison';
 const selectors=[];const cards=[];
 for(const label of ['左側證物','右側證物']){
  const wrapper=make('label',label),select=make('select');wrapper.append(select);controls.append(wrapper);selectors.push(select);
  const article=make('article');article.className='evidence-card';article.setAttribute('aria-label',label);columns.append(article);cards.push(article);
  select.addEventListener('change',render);
 }
 const searchLabel=make('label','標示關鍵字'),search=make('input');search.type='search';search.maxLength=80;searchLabel.append(search);search.addEventListener('input',render);
 root.append(notice,controls,searchLabel,columns);
 let snapshot=null,identity='',renderGeneration=0;
 function highlighted(value){
  const p=make('p');p.className='evidence-text';
  const needle=search.value.trim();if(!needle){p.textContent=value;return p;}
  // Literal matching only, never interpret input as regex or HTML.
  let offset=0,index=value.indexOf(needle);while(index!==-1){
   p.append(document.createTextNode(value.slice(offset,index)),make('mark',value.slice(index,index+needle.length)));
   offset=index+needle.length;index=value.indexOf(needle,offset);
  }
  p.append(document.createTextNode(value.slice(offset)));return p;
 }
 function render(){
  const generation=++renderGeneration;
  for(let i=0;i<cards.length;i++){
   const card=cards[i];card.replaceChildren();
   const e=snapshot?.state.evidence.find(item=>item.evidenceId===selectors[i].value);
   if(!e){card.append(make('p','沒有可比較的證物。'));continue;}
   card.append(make('h3',e.title),make('p',`${types[e.type]} · ${admission[e.admittedStatus]} · ${e.presentationState==='presented'?'已提出':'可檢視'}`),highlighted(e.text));
   const metadata=make('dl');
   for(const [name,value] of [['證物編號',e.evidenceId],['資料來源角色',e.sourceRole],...e.metadata.map(m=>[m.name,m.value])])metadata.append(make('dt',name),make('dd',value));
   card.append(metadata);
   if(e.factReferences.length)card.append(make('p',`關聯事實：${e.factReferences.join('、')}`));
   if(e.assetId)card.append(make('p','此證物另有視覺素材；目前顯示文字說明，未載入圖片。'));
   if(onTranscript){const button=make('button','查看關聯紀錄');button.type='button';button.addEventListener('click',()=>{
    // Detached controls must not reintroduce evidence from a future playhead,
    // another session, a superseded selection or a cleared account context.
    if(generation===renderGeneration&&snapshot?.state.evidence.some(item=>item.evidenceId===e.evidenceId))onTranscript(e.evidenceId);
   });card.append(button);}
  }
 }
 function clear(){snapshot=null;identity='';search.value='';for(const select of selectors)select.replaceChildren();notice.textContent='尚無可見證物。';root.open=false;render();}
 return {element:root,clear,setSnapshot(value){
  let next=null;try{next=value?parseSnapshot(JSON.stringify(value)):null;}catch{/* Invalid input clears old data. */}
  if(!next){clear();return;}
  const key=JSON.stringify([next.sessionId,next.caseId,next.stateVersion,next.eventId,next.state.evidence]);
  if(key===identity)return;
  const sameSession=snapshot?.sessionId===next.sessionId;
  if(!sameSession){search.value='';root.open=false;}
  const previous=selectors.map(s=>sameSession?s.value:'');snapshot=next;identity=key;
  notice.textContent=`${next.state.stageLabel} · 版本 ${next.stateVersion}。僅顯示此時可見資料；檢視與比較不等於提出或採納證物。`;
  for(let i=0;i<selectors.length;i++){
   const select=selectors[i];select.replaceChildren();
   for(const e of next.state.evidence){const option=make('option',e.title);option.value=e.evidenceId;select.append(option);}
   select.value=next.state.evidence.some(e=>e.evidenceId===previous[i])?previous[i]:(next.state.evidence[i]||next.state.evidence[0])?.evidenceId||'';
   select.disabled=next.state.evidence.length===0;
  }
  render();
 }};
}
