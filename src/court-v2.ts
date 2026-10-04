import {handleCourt} from './court';
import {responseHeaders,readTextWithLimit,type Responder} from './http';
import type {AppEnv} from './env';
import type {TraceContext} from './trace-context';
import {resolveSession,csrfTokenMatches} from './session';
import {parseDeletion} from './court-deletion';
import {parseCreation} from './court-creation';
import {CASES} from './court-rules';

/** Additive transport version, not a second court engine. Raw action POST bytes
 * reach the v1 parser unchanged; creation has a separate strict v2 contract.
 * Action bodies retain court-v1-command; court data retains v1 public DTOs.
 * No retries: clients recover unknown mutation outcomes via requests/:id.
 */
export async function handleCourtV2(request:Request,env:AppEnv,send:Responder,
  trace:TraceContext,trustedOrigin?:string):Promise<Response>{
  const respond:Responder=(data,status=200,cookies=[])=>{
    const ok=status>=200&&status<300;
    const version=data&&typeof data==='object'&&'stateVersion' in data?data.stateVersion:null;
    return send({ok,apiVersion:2,requestId:trace.requestId,traceId:trace.traceId,timestamp:new Date().toISOString(),
      errorCode:ok?null:status===500?'INTERNAL_ERROR':`HTTP_${status}`,
      stateVersion:ok&&typeof version==='number'&&Number.isSafeInteger(version)&&version>=0?version:null,
      data:ok?data:null},status,cookies);
  };
  try{
    const url=new URL(request.url);
    const creation=url.pathname==='/api/v2/court/sessions';
    if(!creation&&!/^\/api\/v2\/court\/sessions\/[0-9a-f-]{36}(?:\/(?:actions|events|requests\/[0-9a-f-]{36}))?$/i.test(url.pathname))return respond(null,404);
    if(request.method==='OPTIONS')return trustedOrigin?
      new Response(null,{status:204,headers:responseHeaders(trustedOrigin)}):respond(null,403);
    if(creation){
      if(request.method!=='POST')return respond(null,405);
      const session=await resolveSession(request,env);if(!session)return respond(null,401);
      if(!trustedOrigin||!csrfTokenMatches(request,session))return respond(null,403);
      const learner=env.LEARNER.getByName(session.user.id);
      if(!await learner.allow('create',6))return respond(null,429);
      if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return respond(null,415);
      const raw=await readTextWithLimit(request.body,4096);if(raw.tooLarge)return respond(null,413);
      const c=raw.invalidEncoding?null:parseCreation(raw.text);if(!c)return respond(null,400);
      // Reserve index capacity before room creation; identical retries reuse it.
      // An ambiguous RPC failure leaves the reservation for exact-command recovery.
      if(!await learner.addCourt(c.sessionId,CASES.find(t=>t.id===c.config.caseId)!.title))return respond(null,409);
      const result=await env.COURT_ROOM.getByName(c.sessionId).initV2(session.user.id,c);
      if('status' in result){
        if(result.status===404)await learner.removeCourt(c.sessionId);
        return respond(null,result.status);
      }
      return respond(result,201);
    }
    if(request.method==='DELETE'&&/^\/api\/v2\/court\/sessions\/[0-9a-f-]{36}$/i.test(url.pathname)){
      const session=await resolveSession(request,env);if(!session)return respond(null,401);
      if(!trustedOrigin||!csrfTokenMatches(request,session))return respond(null,403);
      const learner=env.LEARNER.getByName(session.user.id);
      if(!await learner.allow('court',40))return respond(null,429);
      if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return respond(null,415);
      const raw=await readTextWithLimit(request.body,8192);
      if(raw.tooLarge)return respond(null,413);
      const m=raw.invalidEncoding?null:parseDeletion(raw.text);
      if(!m||m.sessionId!==url.pathname.split('/').at(-1))return respond(null,400);
      const result=await env.COURT_ROOM.getByName(m.sessionId).removeV2(session.user.id,{...m});
      if('status' in result)return respond(null,result.status);
      // Room receipt survives this second-DO cleanup failing. Exact DELETE retry
      // recovers the same receipt and retries index cleanup, not a new deletion.
      await learner.removeCourt(m.sessionId);
      return respond(result);
    }
    const outcome=url.pathname.match(/^\/api\/v2\/court\/sessions\/([0-9a-f-]{36})\/requests\/([0-9a-f-]{36})$/i);
    if(outcome){
      if(request.method!=='GET')return respond(null,405);
      const session=await resolveSession(request,env);if(!session)return respond(null,401);
      const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if(!uuid.test(outcome[1])||!uuid.test(outcome[2]))return respond(null,400);
      const result=await env.COURT_ROOM.getByName(outcome[1]).outcomeV2(session.user.id,outcome[1],outcome[2]);
      return respond(result,'status' in result?result.status:200);
    }
    if(url.pathname.endsWith('/events')){
      if(request.method!=='GET')return respond(null,405);
      const session=await resolveSession(request,env);if(!session)return respond(null,401);
      const cursor=url.searchParams.get('after')??'-1';
      if(!/^(?:-1|0|[1-9][0-9]{0,15})$/.test(cursor)||!Number.isSafeInteger(Number(cursor)))return respond(null,400);
      const id=url.pathname.split('/').at(-2)!;
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id))return respond(null,400);
      const result=await env.COURT_ROOM.getByName(id).eventsV2(session.user.id,Number(cursor));
      return respond(result,'status' in result?result.status:200);
    }
    url.pathname=url.pathname.replace('/api/v2/court/','/api/court/v1/');
    return await handleCourt(new Request(url,request),env,respond,trustedOrigin,trace);
  }catch{
    // Never include runtime exceptions or partial results. The caller must
    // reconcile its original command ID, not retry with a fresh key.
    return respond(null,500);
  }
}
