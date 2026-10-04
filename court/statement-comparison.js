// Read-only comparison of public discoveries, never a contradiction detector.
// No network, hidden case definitions, scoring or automatic actions here.
export function createStatementComparison(document){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('section');root.setAttribute('aria-label','陳述與證物對照');
 const columns=make('div');columns.className='evidence-comparison';
 const choices=[],cards=[];
 for(const title of ['已聽取的陳述','已取得的證物']){
  const card=make('article');card.className='evidence-card';
  const label=make('label',title),select=make('select'),body=make('p');
  label.append(select);card.append(label,body);columns.append(card);choices.push(select);cards.push(body);
 }
 const notice=make('p');notice.setAttribute('role','status');
 root.append(make('h3','陳述與證物對照'),columns,notice);
 let rows=[[],[]],generation=0;
 function draw(){
  for(let i=0;i<2;i++)cards[i].textContent=rows[i][Number(choices[i].value)]?.text||'尚無可對照資料。';
 }
 return {element:root,setBoard(board){
  const revision=++generation;
  // Copy only the public text needed by this view. Replacing/clearing the board
  // also invalidates callbacks associated with the previous court session.
  const names={Witness:'證人',Prosecutor:'檢察官',Lawyer:'辯護人'};
  rows=[(board?.statements||[]).map(s=>({label:names[s.npcId]||s.npcId,text:s.text})),
   (board?.evidence||[]).map(e=>({label:e.title,text:e.text}))];
  root.hidden=!board;
  for(let i=0;i<2;i++){
   const select=choices[i];select.replaceChildren();
   rows[i].forEach((row,index)=>{const o=make('option',row.label);o.value=String(index);select.append(o);});
   select.value=rows[i].length?'0':'';select.disabled=!rows[i].length;
   select.onchange=()=>{if(revision===generation)draw();};
  }
  notice.textContent=!board?'':board.completed?
   '庭後唯讀對照：僅顯示本場次已取得資料，切換選項不會修改結果或重新判定矛盾。':rows.every(r=>r.length)?
   '比較兩邊的時間、來源與敘述。此處不判定矛盾；出示證物後，以伺服器回覆為準。':
   '先聽取角色陳述並取得證物，這裡才會出現可對照的內容。';
  draw();
 }};
}
