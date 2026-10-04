// Owner-authenticated completed view only. This is not a replay event source:
// legacy question records have no timestamp/stage, so never infer either.
export function completedQuestions(view){
 if(view?.completed!==true||!Number.isSafeInteger(view.version)||!Array.isArray(view.npcHistory))return [];
 const names=new Map((Array.isArray(view.npcs)?view.npcs:[]).filter(n=>typeof n?.id==='string'&&typeof n.name==='string'&&n.name.length<=80).map(n=>[n.id,n.name]));
 const seen=new Set(),rows=[];
 for(const row of view.npcHistory.slice(-200)){
  if(!row||typeof row.requestId!=='string'||!/^[-a-zA-Z0-9]{1,80}$/.test(row.requestId)||seen.has(row.requestId)||
   !names.has(row.npcId)||!Number.isSafeInteger(row.version)||row.version<0||row.version>view.version||
   typeof row.question!=='string'||!row.question.trim()||row.question.length>400||
   typeof row.text!=='string'||!row.text.trim()||row.text.length>12000||!['ai','scripted'].includes(row.mode))continue;
  seen.add(row.requestId);
  rows.push({question:row.question,text:row.text,npcId:row.npcId,name:names.get(row.npcId),mode:row.mode,
   dictionary:row.mode==='scripted'&&row.errorCode==='DICTIONARY'});
 }
 return rows;
}

export function createQuestionReview(document,canView=()=>true){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('details');root.className='question-review';root.hidden=true;
 const heading=make('summary','我的提問與角色回覆'),description=make('p','已完成場次的問答回顧，獨立於上方事件時間軸。舊紀錄沒有提問時間或程序階段，不推算或補造；不是完整逐字稿。'),notice=make('p');notice.setAttribute('role','status');
 const filters=make('div');filters.className='grid';
 const searchLabel=make('label','搜尋問答'),search=make('input');search.type='search';search.maxLength=400;searchLabel.append(search);
 const roleLabel=make('label','問答角色'),role=make('select');roleLabel.append(role);filters.append(searchLabel,roleLabel);
 const list=make('ol');list.className='replay-transcript';list.setAttribute('aria-label','已完成場次問答');
 const more=make('button','顯示更多問答');more.type='button';
 root.append(heading,description,filters,notice,list,more);
 let rows=[],limit=20,identity='',truncated=false;
 function render(){
  if(!canView()){clear();return;}
  const q=search.value.trim().slice(0,400).toLocaleLowerCase('zh-TW');
  const filtered=rows.filter(r=>(!role.value||r.npcId===role.value)&&(!q||(r.question+' '+r.text).toLocaleLowerCase('zh-TW').includes(q)));
  list.replaceChildren();
  for(const row of filtered.slice(0,limit)){
   const li=make('li');li.append(make('p','你：'+row.question),make('p',row.name+' · '+(row.mode==='ai'?'AI 回覆（可能有誤）':row.dictionary?'辭典參考（非 AI 回覆）':'預寫／服務降級回覆（非 AI 回覆）')),make('p',row.text));list.append(li);
  }
  notice.textContent=rows.length?`顯示 ${Math.min(limit,filtered.length)} / ${filtered.length} 筆問答。${truncated?' 本頁最多回顧最近 200 筆。':''}`:'沒有可顯示的問答紀錄；固定原始陳述或舊紀錄未必包含玩家提問。';
  if(rows.length&&!filtered.length)notice.textContent='沒有符合篩選的問答。';
  more.hidden=filtered.length<=limit;
 }
 search.addEventListener('input',()=>{limit=20;render();});role.addEventListener('change',()=>{limit=20;render();});more.addEventListener('click',()=>{limit+=20;render();});
 function clear(){identity='';rows=[];truncated=false;limit=20;search.value='';role.replaceChildren();role.value='';root.hidden=true;root.open=false;list.replaceChildren();notice.textContent='';more.hidden=true;}
 return {element:root,clear,setView(view){
  if(view?.completed!==true){clear();return;}
  const nextIdentity=view.id+':'+view.version;
  if(nextIdentity===identity)return;
  clear();identity=nextIdentity;rows=completedQuestions(view);truncated=Array.isArray(view.npcHistory)&&view.npcHistory.length>200;
  const all=make('option','全部角色');all.value='';role.append(all);
  for(const [id,name] of new Map(rows.map(r=>[r.npcId,r.name]))){const option=make('option',name);option.value=id;role.append(option);}
  role.value='';root.hidden=false;render();
 }};
}
