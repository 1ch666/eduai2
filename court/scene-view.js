// Camera placement is presentation, not a side effect of each server revision.
// The independent snapshot relay still sends every authoritative state update.
export function createSceneView({getFrame,getView,origin}){
 let previous=null;
 return {send(mode,focus=false){
  const frame=getFrame(),view=getView(),target=frame?.contentWindow;
  if(!frame||frame.hidden||!target||!view?.id||!view.config)return false;
  const {role}=view.config,procedure=view.procedure;
  if(!['seat','overview','walk'].includes(mode))return false;
  const same=previous?.target===target&&previous.session===view.id&&
   previous.mode===mode&&previous.role===role&&previous.procedure===procedure;
  if(same&&!focus)return false;
  target.postMessage({type:'court-view',mode,role,procedure,focus:focus===true},origin);
  previous={target,session:view.id,mode,role,procedure};return true;
 },clear(){previous=null;}};
}
