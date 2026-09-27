// LOCAL TEST HARNESS ONLY. Never deploy this unauthenticated test dispatcher.
export {AIAdmission} from '../../src/providers/admission-coordinator';
import type {AIAdmission} from '../../src/providers/admission-coordinator';
export default {async fetch(request:Request,env:{ADMISSION:DurableObjectNamespace<AIAdmission>}){
  if(request.method==='GET')return Response.json({fixture:'admission-local-only'});
  const body=await request.json() as {room:string;op:string;request:Parameters<AIAdmission['admit']>[0]};
  const room=env.ADMISSION.getByName(body.room);
  if(body.op==='admit')return Response.json(await room.admit(body.request));
  if(body.op==='poll')return Response.json(await room.poll(body.request));
  if(body.op==='cancel')return Response.json(await room.cancel(body.request));
  if(body.op==='finish')return Response.json(await room.finish(body.request,'success',{inputTokens:null,outputTokens:1}));
  return new Response(null,{status:400});
}};
