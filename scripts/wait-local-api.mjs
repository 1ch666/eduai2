import {setTimeout} from 'node:timers/promises';
import {localApiTarget} from './local-api-target.mjs';
const base=localApiTarget(process.argv[2]);
const deadline=Date.now()+45_000;
let ready=false;
while(Date.now()<deadline){
  try{
    const r=await fetch(base+'/api/capabilities',{redirect:'error',signal:AbortSignal.timeout(1500)});
    if(r.ok){
      const p=await r.json();
      if(p.npcAi!==false)throw new Error('AI must be disabled in the disposable test Worker');
      ready=true;break;
    }
  }catch(e){
    if(e.message==='AI must be disabled in the disposable test Worker')throw e;
  }
  await setTimeout(500);
}
if(!ready)throw new Error('Local API did not become ready within 45 seconds');
console.log('Disposable local Worker ready; NPC AI disabled.');
