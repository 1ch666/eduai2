// Local presentation preference only. Progress and available operations are read
// from the authenticated, same-version server view. Never submits an action.
export function demoNextStep(snapshot,board){
 const actions=snapshot.state.allowedActions.filter(a=>a.enabled);
 const has=id=>actions.some(a=>a.actionId===id),prefix=id=>actions.some(a=>a.actionId.startsWith(id));
 const done=id=>board.objectives.find(o=>o.id===id)?.done===true;
 const step=(text,target)=>({text,target});
 if(snapshot.state.completed)return step('展示場次已完成。可查看庭後分析，再關閉面板回看庭審紀錄。','review');
 if(has('step'))return step('旁觀模式：使用「下一步」推進伺服器流程；不替玩家累計調查成果。','procedure');
 if(has('acknowledge'))return step('先閱讀角色與程序，再按「確認程序」。','procedure');
 if(has('speak'))return step('根據目前案件資料，在陳述欄輸入你的意見，再送出陳述。','statement');
 if(prefix('investigate.')){
  if(!done('question-roles')&&prefix('investigate.question.'))return step('在「向誰詢問或出示？」依序選擇角色，聽取原始陳述。','investigation');
  if(!done('key-evidence')&&has('investigate.discover'))return step('按「調查現場紀錄」取得證物。','investigation');
  if(!done('reasoning')&&prefix('investigate.present.'))return step('核對已取得證物與角色陳述，選擇相關角色出示證物。','investigation');
  if(!done('follow-up')&&prefix('investigate.followUp.'))return step('選擇出現矛盾的角色，按伺服器解鎖的追問按鈕。','investigation');
  if(['question-roles','key-evidence','reasoning','follow-up'].some(id=>!done(id)))return step('調查目標尚未完成；請核對目前可用操作。若所需操作未出現，先更新狀態，不直接跳過調查。','investigation');
 }
 if(prefix('rule.'))return step('閱讀程序選項並自行決定准駁，再結束調查。導覽不提供裁定答案。','procedure');
 if(has('closeEvidence'))return step('已可操作結束調查；送出後仍由伺服器檢查是否符合程序條件。','procedure');
 if(prefix('answer.'))return step('根據已取得資料自行選擇最終判讀；導覽不代選答案。','procedure');
 return step('目前沒有可引導的操作。請閱讀伺服器狀態，必要時更新；導覽不會自行推進程序。',null);
}

function playerIntroduction(state){
 const labels={judge:'法官',claimant:state.procedure==='criminal'?'告訴／被害人':'原告',respondent:'被告',claimantCounsel:state.procedure==='criminal'?'告訴代理人':'原告代理人',respondentCounsel:state.procedure==='criminal'?'辯護人':'被告代理人',observer:'旁觀者'};
 const name=Object.hasOwn(labels,state.roleId)?labels[state.roleId]:'目前角色';
 const purpose=state.roleId==='judge'?'主持程序、檢查證物並作程序決定。':state.roleId==='observer'?'觀看伺服器推進的流程，不提交當事人的作答。':'代表所選一方陳述與調查，不代替法官作程序裁定。';
 return `你的角色：${name}。${purpose}`;
}

export function createDemoGuide(document,onNavigate=null){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('section');root.setAttribute('aria-label','比賽展示導覽');root.hidden=true;
 const label=make('label','展示導覽'),toggle=make('input');toggle.type='checkbox';label.append(toggle);
 const content=make('div'),status=make('p');status.setAttribute('role','status');
 root.append(label,content);let identity='',snapshot=null,board=null,blocked=true,generation=0;
 function shortcut(target,label,revision){
  if(typeof onNavigate!=='function')return;
  const button=make('button',label);button.type='button';
  button.onclick=()=>{
   if(revision!==generation||blocked||!snapshot||!board||!toggle.checked)return;
   onNavigate(target);
  };
  content.append(button);
 }
 function render(){
  const revision=++generation;
  root.hidden=!snapshot||!board;content.replaceChildren();content.hidden=!toggle.checked;
  if(root.hidden||content.hidden)return;
  content.append(make('p','真實場次操作，不自動作答。預寫回應會保留標示；本導覽不代表研究或 AI 驗收結果。'));
  content.append(make('p',playerIntroduction(snapshot.state)));
  const roles=snapshot.state.npcs.filter(n=>n.visible).map(n=>n.displayName);
  content.append(make('p','場上角色：'+roles.join('、')));
  const list=make('ol');
  for(const goal of board.objectives)list.append(make('li',(goal.done?'✓ ':'□ ')+goal.label));
  content.append(list,status);
  if(blocked){status.textContent='等待伺服器確認；請先完成同步或查詢上次操作。';return;}
  const next=demoNextStep(snapshot,board);status.textContent=next.text;
  const labels={review:'查看庭後分析',procedure:'前往程序操作',investigation:'前往調查操作',statement:'前往陳述欄'};
  if(next.target)shortcut(next.target,labels[next.target],revision);
 }
 toggle.onchange=render;
 return {element:root,setState(next,nextBoard,isBlocked){
  const key=next?next.sessionId+':'+next.caseId:'';
  if(key!==identity){identity=key;toggle.checked=false;}
  snapshot=next;board=nextBoard;blocked=isBlocked;render();
 }};
}
