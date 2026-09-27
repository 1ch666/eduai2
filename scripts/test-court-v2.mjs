import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {courtV2Response} from './court-schema-check.mjs';
const bundle=await build({entryPoints:['src/court-v2.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{
 name:'court-handler-fixture',setup(b){b.onResolve({filter:/^\.\/court$/},()=>({path:'court',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const handleCourt=(...args)=>args[1].handler(...args);'}));}
}]});
const {handleCourtV2}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const origin='https://test.example',id=crypto.randomUUID(),path=origin+'/api/v2/court/sessions/'+id;
const trace={schemaVersion:1,requestId:crypto.randomUUID(),traceId:crypto.randomUUID().replaceAll('-','')};
const send=(body,status=200,cookies=[])=>new Response(JSON.stringify(body),{status,headers:{'Cache-Control':'no-store','Set-Cookie':cookies.join(',')}});
const receipt={apiVersion:1,requestId:crypto.randomUUID(),sessionId:id,caseId:'sale',outcome:'not-applied',reason:'expired'};

test('v2 aliases only approved routes, keeps raw commands, cookies, origin, signal and trace',async()=>{
 let calls=0;const raw='{"duplicate":1,"duplicate":2}';
 const request=new Request(path+'/actions',{method:'POST',headers:{Cookie:'PRIVATE','X-CSRF-Token':'PRIVATE','Content-Type':'application/json'},body:raw});
 const response=await handleCourtV2(request,{handler:async(r,_env,respond,trusted,t)=>{
  calls++;assert.equal(new URL(r.url).pathname,'/api/court/v1/sessions/'+id+'/actions');
  assert.equal(await r.text(),raw,'must not JSON.parse/stringify away duplicate keys');
  assert.equal(r.headers.get('Cookie'),'PRIVATE');assert.equal(r.headers.get('X-CSRF-Token'),'PRIVATE');assert.equal(trusted,origin);assert.equal(t,trace);
  return respond(receipt,200,['example=value; HttpOnly']);
 }},send,trace,origin);
 const envelope=await response.json();assert.equal(calls,1);assert.equal(envelope.apiVersion,2);assert.equal(envelope.requestId,trace.requestId);
 assert.equal(envelope.data.requestId,receipt.requestId);assert.deepEqual(envelope.data,receipt);assert.equal(envelope.stateVersion,null);
 assert.equal(courtV2Response(envelope),true,JSON.stringify(courtV2Response.errors));
 assert.equal(response.headers.get('Set-Cookie'),'example=value; HttpOnly');assert.equal(response.headers.get('Cache-Control'),'no-store');
});

test('v2 errors and exceptions use uniform safe metadata without private partial data',async()=>{
 for(const status of [400,401,403,404,405,409,429,500]){
  const r=await handleCourtV2(new Request(path),{handler:async(_r,_e,respond)=>respond({error:'PRIVATE',owner:'PRIVATE',stateVersion:8},status)},send,trace,origin);
  const b=await r.json();assert.equal(r.status,status);assert.equal(b.ok,false);assert.equal(b.data,null);assert.equal(b.stateVersion,null);
  assert.equal(b.errorCode,status===500?'INTERNAL_ERROR':`HTTP_${status}`);assert.equal(courtV2Response(b),true);assert.equal(JSON.stringify(b).includes('PRIVATE'),false);
 }
 let calls=0;const r=await handleCourtV2(new Request(path),{handler:async()=>{calls++;throw Error('PRIVATE');}},send,trace,origin);
 assert.equal(r.status,500);assert.equal(calls,1);assert.equal(courtV2Response(await r.json()),true);
});

test('v2 unknown routes cannot fall through to creation/deletion and preflight does not call the domain',async()=>{
 const env={handler:()=>{throw Error('must not be called');}};
 for(const suffix of ['/delete','/dialogue','/unexpected']){
  const r=await handleCourtV2(new Request(path+suffix),env,send,trace,origin);assert.equal(r.status,404);assert.equal(courtV2Response(await r.json()),true);
 }
 const preflight=await handleCourtV2(new Request(path,{method:'OPTIONS'}),env,send,trace,origin);
 assert.equal(preflight.status,204);assert.equal(await preflight.text(),'');assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 const denied=await handleCourtV2(new Request(path,{method:'OPTIONS'}),env,send,trace);
 assert.equal(denied.status,403);assert.equal(courtV2Response(await denied.json()),true);
});
