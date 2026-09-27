import {parseSnapshot} from './protocol.js';

// Only the new build template imports this adapter. No network or credentials.
export function installUnityHud({window,getInstance}){
 let channel='',session='',caseId='',version=-1;
 const send=(method,value='')=>getInstance()?.SendMessage('CourtRuntimeState',method,value);
 const clear=()=>{session=caseId='';version=-1;send('ClearState');};
 window.addEventListener('message',event=>{
  if(event.origin!==window.location.origin||event.source!==window.parent)return;
  const m=event.data;if(!m||m.apiVersion!==1||typeof m.channel!=='string'||!/^[0-9a-f-]{36}$/.test(m.channel))return;
  const keys=Object.keys(m).sort().join(',');
  if(m.type==='court-hud-bind'&&keys==='apiVersion,channel,type'){
   if(m.channel!==channel){clear();channel=m.channel;}return;
  }
  if(!channel||channel!==m.channel)return;
  if(m.type==='court-hud-clear'&&keys==='apiVersion,channel,type'){clear();channel='';return;}
  if(m.type==='court-hud-unavailable'&&keys==='apiVersion,channel,type'){send('MarkUnavailable');return;}
  if(m.type!=='court-hud-snapshot'||keys!=='apiVersion,channel,payload,type')return;
  const snapshot=parseSnapshot(m.payload);if(!snapshot)return;
  if(session&&(session!==snapshot.sessionId||caseId!==snapshot.caseId))return;
  if(snapshot.stateVersion<version)return;
  // C# reducer is also required to check same-version identity conflicts.
  session=snapshot.sessionId;caseId=snapshot.caseId;version=snapshot.stateVersion;
  send('ApplySnapshot',m.payload);
 });
 window.addEventListener('pagehide',()=>{clear();channel='';});
 window.parent.postMessage({type:'court-hud-ready',apiVersion:1},window.location.origin);
}
