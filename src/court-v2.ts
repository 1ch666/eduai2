import {handleCourt} from './court';
import {responseHeaders,type Responder} from './http';
import type {AppEnv} from './env';
import type {TraceContext} from './trace-context';

/** Additive transport version, not a second court engine. Raw POST bytes are
 * forwarded unchanged to the v1 parser (duplicate-key/Unicode/size guards).
 * POST bodies retain court-v1-command; data retains court-v1 public DTOs.
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
    // Do not alias unversioned creation/deletion until their mutation/recovery
    // contracts are complete. Unknown v2 routes still receive a v2 error.
    if(!/^\/api\/v2\/court\/sessions\/[0-9a-f-]{36}(?:\/(?:actions|requests\/[0-9a-f-]{36}))?$/i.test(url.pathname))return respond(null,404);
    if(request.method==='OPTIONS')return trustedOrigin?
      new Response(null,{status:204,headers:responseHeaders(trustedOrigin)}):respond(null,403);
    url.pathname=url.pathname.replace('/api/v2/court/','/api/court/v1/');
    return await handleCourt(new Request(url,request),env,respond,trustedOrigin,trace);
  }catch{
    // Never include runtime exceptions or partial results. The caller must
    // reconcile its original command ID, not retry with a fresh key.
    return respond(null,500);
  }
}
