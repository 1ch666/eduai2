import type {AppEnv} from './env';
import type {Responder} from './http';
import {readTextWithLimit} from './http';
import {resolveSession,csrfTokenMatches} from './session';

/** Called only by the v2 router after route matching and preflight handling.
 * The owner is always resolved from the session; the body cannot override it.
 * GET/DELETE stay available after collection is disabled (access/withdrawal).
 */
export async function handleCourtEducation(request:Request,env:AppEnv,respond:Responder,id:string,trustedOrigin?:string){
 if(!['GET','POST','DELETE'].includes(request.method))return respond(null,405);
 const session=await resolveSession(request,env);if(!session)return respond(null,401);
 if(request.method!=='GET'&&(!trustedOrigin||!csrfTokenMatches(request,session)))return respond(null,403);
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))return respond(null,400);
 if(!await env.LEARNER.getByName(session.user.id).allow('court',40))return respond(null,429);
 let body='';
 if(request.method==='POST'){
  if(request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase()!=='application/json')return respond(null,415);
  const raw=await readTextWithLimit(request.body,4096);
  if(raw.tooLarge)return respond(null,413);if(raw.invalidEncoding)return respond(null,400);body=raw.text;
 }else{
  // workerd may expose an empty stream for a bodyless DELETE. Reject bytes,
  // not the existence of a stream, without buffering an unbounded body.
  const raw=await readTextWithLimit(request.body,0);
  if(raw.tooLarge||raw.invalidEncoding)return respond(null,400);
 }
 const operation=request.method==='GET'?'view':request.method==='DELETE'?'withdraw':'apply';
 const result=await env.COURT_ROOM.getByName(id).education(session.user.id,operation,body);
 if('status' in result)return respond(null,result.status);
 if('code' in result){
  if(result.code==='INVALID')return respond(null,400);
  if(result.code==='CONFLICT')return respond(null,409);
  if(result.code==='WITHDRAWN'&&operation==='apply')return respond(null,410);
 }
 return respond(result);
}
