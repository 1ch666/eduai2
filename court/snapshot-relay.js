import {CourtTransport} from './transport.js';

// Read-only public projection; cookies and CSRF never enter the frame.
export function installSnapshotRelay({window,getFrame,getView,getAccount}){
 const transport=new CourtTransport({origin:window.location.origin,csrf:()=>''});
 let context=null,peer=null,channel='',generation=0,running=false,queued=false,lastVersion=-1;
 const send=(type,payload)=>peer?.postMessage({type,apiVersion:1,channel,...(payload===undefined?{}:{payload})},window.location.origin);
 function clear(){
  if(peer)send('court-hud-clear');
  generation++;context=null;peer=null;channel='';running=false;queued=false;lastVersion=-1;transport.clear();
 }
 const valid=()=>context&&getView()?.id===context.session&&getAccount()?.id===context.owner&&getFrame()?.contentWindow===peer;
 async function sync(){
  if(!peer)return;if(!valid()){clear();return;}
  if(running){queued=true;return;}
  if(getView().version===lastVersion)return;
  running=true;const started=generation;
  try{
   const result=await transport.refresh();if(started!==generation)return;if(!valid()){clear();return;}
   const snapshot=transport.snapshot;
   if(['accepted','duplicate','stale'].includes(result)&&snapshot&&snapshot.stateVersion>=getView().version){
    lastVersion=snapshot.stateVersion;send('court-hud-snapshot',JSON.stringify(snapshot));
   }else send('court-hud-unavailable');
  }catch{if(started===generation)send('court-hud-unavailable');}
  finally{if(started===generation){running=false;if(queued){queued=false;void sync();}}}
 }
 function receive(event){
  if(event.origin!==window.location.origin||event.source!==getFrame()?.contentWindow)return;
  const m=event.data;
  if(!m||m.type!=='court-hud-ready'||m.apiVersion!==1||Object.keys(m).length!==2)return;
  const v=getView(),account=getAccount();if(!v||!account)return;
  clear();context={session:v.id,owner:account.id};peer=event.source;channel=crypto.randomUUID();
  transport.bind(v.id,v.config.caseId);send('court-hud-bind');void sync();
 }
 window.addEventListener('message',receive);window.addEventListener('pagehide',clear);
 return {sync,clear};
}
