// Local presentation preference only. Progress and available operations are read
// from the authenticated, same-version server view. Never submits an action.
export function createDemoGuide(document){
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const root=make('section');root.setAttribute('aria-label','比賽展示導覽');root.hidden=true;
 const label=make('label','展示導覽'),toggle=make('input');toggle.type='checkbox';label.append(toggle);
 const content=make('div'),status=make('p');status.setAttribute('role','status');
 root.append(label,content);let identity='',snapshot=null,board=null,blocked=true;
 function render(){
  root.hidden=!snapshot||!board;content.replaceChildren();content.hidden=!toggle.checked;
  if(root.hidden||content.hidden)return;
  content.append(make('p','真實場次操作，不自動作答。預寫回應會保留標示；本導覽不代表研究或 AI 驗收結果。'));
  const roles=snapshot.state.npcs.filter(n=>n.visible).map(n=>n.displayName);
  content.append(make('p','場上角色：'+roles.join('、')));
  const list=make('ol');
  for(const goal of board.objectives)list.append(make('li',(goal.done?'✓ ':'□ ')+goal.label));
  content.append(list,status);
  if(blocked){status.textContent='等待伺服器確認；請先完成同步或查詢上次操作。';return;}
  if(snapshot.state.completed){status.textContent='展示場次已完成。請向下閱讀庭後分析，或關閉面板後回看庭審紀錄。';return;}
  const actions=snapshot.state.allowedActions.filter(a=>a.enabled);
  const done=id=>board.objectives.find(o=>o.id===id)?.done===true;
  if(actions.some(a=>a.actionId==='acknowledge'))status.textContent='先閱讀角色與程序，再按「確認程序」。';
  else if(actions.some(a=>a.actionId.startsWith('investigate.'))){
   status.textContent=!done('question-roles')?'在「向誰詢問或出示？」依序選擇角色，聽取原始陳述。':
    !done('key-evidence')?'按「調查現場紀錄」取得證物。':
    !done('reasoning')?'核對已取得證物與角色陳述，選擇相關角色出示證物。':
    !done('follow-up')?'選擇出現矛盾的角色，按伺服器解鎖的追問按鈕。':
    '調查已完成。閱讀程序選項並自行決定准駁，再結束調查。';
  }else if(actions.some(a=>a.actionId.startsWith('answer.')))status.textContent='根據已取得資料自行選擇最終判讀；導覽不代選答案。';
  else status.textContent='閱讀本階段要求，在下方陳述欄輸入你的意見，使用伺服器允許的操作繼續。';
 }
 toggle.onchange=render;
 return {element:root,setState(next,nextBoard,isBlocked){
  const key=next?next.sessionId+':'+next.caseId:'';
  if(key!==identity){identity=key;toggle.checked=false;}
  snapshot=next;board=nextBoard;blocked=isBlocked;render();
 }};
}
