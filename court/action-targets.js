// Presentation filtering only. The server must independently authorize targets.
export function actionTargets(snapshot,kind){
 if(kind==='evidence')return (snapshot?.state.evidence||[]).map(e=>({id:e.evidenceId,label:e.title}));
 if(kind==='npc')return (snapshot?.state.npcs||[]).filter(n=>n.visible&&n.interactable&&n.requestState!=='pending').map(n=>({id:n.npcId,label:n.displayName}));
 return [];
}
export function actionTargetStatus(snapshot,action,selected=''){
 if(!['none','evidence','npc'].includes(action.requiredTarget))return {enabled:false,reason:'此操作的目標類型尚未支援。',targetId:''};
 if(!action.enabled)return {enabled:false,reason:action.reasonDisabled||'目前不可使用。',targetId:''};
 if(action.requiredTarget==='none')return {enabled:true,reason:'',targetId:''};
 if(!actionTargets(snapshot,action.requiredTarget).some(t=>t.id===selected))return {enabled:false,reason:action.requiredTarget==='npc'?'目前沒有可選的互動角色，請更新狀態。':'請選擇目前可見的證物。',targetId:''};
 return {enabled:true,reason:'',targetId:selected};
}
