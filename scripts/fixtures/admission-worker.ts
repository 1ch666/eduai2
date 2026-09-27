// LOCAL TEST HARNESS ONLY. Never deploy this unauthenticated test dispatcher.
export {AIAdmission} from '../../src/providers/admission-coordinator';
export {Learner} from '../../src/court';
import type {Learner} from '../../src/court';
import type {AIAdmission} from '../../src/providers/admission-coordinator';
import {createAdmittedProvider} from '../../src/providers/admitted';
export default {async fetch(request:Request,env:{ADMISSION:DurableObjectNamespace<AIAdmission>;LEARNER:DurableObjectNamespace<Learner>}){
  if(request.method==='GET')return Response.json({fixture:'admission-local-only'});
  const body=await request.json() as {room:string;op:string;request:Parameters<AIAdmission['admit']>[0]};
  const room=env.ADMISSION.getByName(body.room);
  if(body.op==='study-reserve')return Response.json(await env.LEARNER.getByName(body.room)
    .reserveStudyAi('tutor',body.request.id,body.request.fingerprint));
  if(body.op==='generate'||body.op==='generate-quota'){
    let calls=0;
    const provider=createAdmittedProvider({contractVersion:1,id:'fixture',model:'no-network',async generate(){
      calls++;
      return body.op==='generate-quota'?{ok:false,code:'QUOTA'}:
        {ok:true,value:{text:'synthetic',usage:{inputTokens:1,outputTokens:1}}};
    }},room,body.request);
    const result=await provider.generate({messages:[{role:'user',content:'synthetic'}],maxOutputTokens:16,temperature:0,output:'text'},{timeoutMs:2000});
    return Response.json({result,calls});
  }
  if(body.op==='admit')return Response.json(await room.admit(body.request));
  if(body.op==='poll')return Response.json(await room.poll(body.request));
  if(body.op==='cancel')return Response.json(await room.cancel(body.request));
  if(body.op==='finish')return Response.json(await room.finish(body.request,'success',{inputTokens:null,outputTokens:1}));
  return new Response(null,{status:400});
}};
