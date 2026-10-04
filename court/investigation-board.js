// Render server discoveries only; never compute contradictions or scores here.
export function createInvestigationBoard(document){
 const root=document.createElement('section');root.setAttribute('aria-label','案件筆記');root.hidden=true;
 const make=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 const section=(title,lines)=>{
  root.append(make('h3',title));
  if(!lines.length){root.append(make('p','尚無紀錄'));return;}
  const list=document.createElement('ul');for(const line of lines)list.append(make('li',line));root.append(list);
 };
 return {element:root,render(board,difficulty='normal'){
  root.replaceChildren();root.hidden=!board;if(!board)return;
  root.append(make('h2',board.completed?'庭後回顧 · 唯讀':'案件筆記'));
  section('案件目標',board.objectives.filter(o=>difficulty!=='challenge'||!['reasoning','follow-up'].includes(o.id)).map(o=>(o.done?'✓ ':'□ ')+o.label));
  const names={Witness:'證人',Prosecutor:'檢察官',Lawyer:'辯護人'};
  section('已詢問角色',board.questionedNpcIds.map(id=>names[id]||id));
  section('已發現證物',board.evidence.map(e=>e.title+'：'+e.text));
  section('重要陳述',board.statements.map(s=>(names[s.npcId]||s.npcId)+'：'+s.text));
  section('已發現矛盾',board.contradictions.map(c=>c.explanation+(c.followed?'（已追問）':'（尚未追問）')));
  const d=board.debrief;if(!d)return;
  section('學習分析',[`證物查看率 ${d.evidenceCoverage}%`,`角色原始陳述詢問率 ${d.npcCoverage}%`,
   ...(difficulty==='challenge'?[]:[`發現矛盾 ${d.contradictionsFound} 項`]),`程序完成度 ${d.procedureCompletion}%`,`提示 ${d.hintsUsed} 次`,
   '最終判讀：'+d.finalJudgment]);
  section('法律概念',d.concepts);section('需要加強',d.improvements.length?d.improvements:['本次已記錄的調查目標皆完成；不代表法律能力已通過評鑑。']);
  section('推理回顧',d.reasoning);root.append(make('p',d.limitation));
  const link=make('a','前往弱點練習');link.href='../practice/';root.append(link);
 }};
}
