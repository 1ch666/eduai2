import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
import {observeApiRequest,telemetryEndpoint} from '../src/telemetry.ts';

const validate=new Ajv({strict:true}).compile(JSON.parse(await readFile(new URL('../contracts/http-trace-v1.schema.json',import.meta.url),'utf8')));

const origin='https://study.example';
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const failure=()=>Response.json({error:'unavailable'},{status:500});

test('telemetry preserves response bytes, cookies, status, CORS and cache policy',async()=>{
  const records=[];
  const headers=new Headers({'Content-Type':'application/json','Cache-Control':'no-store',
    'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Expose-Headers':'Existing'});
  headers.append('Set-Cookie','first=secret; HttpOnly; Secure');
  headers.append('Set-Cookie','second=other; Expires=Wed, 01 Jan 2031 00:00:00 GMT; HttpOnly');
  const raw='{"requestId":"domain-command-id","stateVersion":2}';
  const response=await observeApiRequest(new Request(origin+'/api/auth/login'),async()=>new Response(raw,{status:201,headers}),failure,r=>records.push(r));
  assert.equal(await response.text(),raw);
  assert.equal(response.status,201);
  assert.deepEqual(response.headers.getSetCookie(),headers.getSetCookie());
  for(const key of ['Content-Type','Cache-Control','Access-Control-Allow-Origin','Access-Control-Allow-Credentials'])assert.equal(response.headers.get(key),headers.get(key));
  assert.equal(response.headers.get('Access-Control-Expose-Headers'),'Existing, X-Request-ID, X-Trace-ID');
  assert.equal(records.length,1);
  assert.match(records[0].requestId,uuid);
  assert.match(records[0].traceId,/^[0-9a-f]{32}$/);
  assert.equal(response.headers.get('X-Request-ID'),records[0].requestId);
  assert.equal(response.headers.get('X-Trace-ID'),records[0].traceId);
  assert.equal(records[0].errorCode,null);
  assert.ok(records[0].latencyMs>=0);
  assert.equal(validate(records[0]),true,JSON.stringify(validate.errors));
  assert.equal(validate({...records[0],password:'forbidden'}),false);
});

test('attacker paths, queries, credentials, inputs and exception text never enter telemetry',async()=>{
  const secret='DO_NOT_LOG_PRIVATE_DATA';const records=[];
  const request=new Request(`${origin}/api/auth/${secret}?token=${secret}`,{method:'POST',headers:{
    Cookie:`session=${secret}`,Authorization:`Bearer ${secret}`,'X-Request-ID':secret,traceparent:secret},body:secret});
  const response=await observeApiRequest(request,async()=>{throw new Error(secret);},failure,r=>records.push(r));
  assert.equal(response.status,500);
  assert.equal(records[0].endpoint,'/api/:unmatched');
  assert.equal(records[0].errorCode,'INTERNAL_ERROR');
  assert.equal(records[0].safeSessionId,null);
  assert.equal(validate(records[0]),true,JSON.stringify(validate.errors));
  assert.equal(JSON.stringify(records).includes(secret),false);
  assert.equal(response.headers.has('Access-Control-Expose-Headers'),false);
  assert.deepEqual(Object.keys(records[0]).sort(),['schemaVersion','event','requestId','traceId','timestamp','safeSessionId','endpoint','method','latencyMs','status','errorCode'].sort());
});

test('all private route segments become templates; malformed and future paths are not logged',()=>{
  const id=crypto.randomUUID();
  for(const [path,expected] of [
    [`/api/court/v1/sessions/${id}`,'/api/court/v1/sessions/:sessionId'],
    [`/api/court/v1/sessions/${id}/requests/${id}`,'/api/court/v1/sessions/:sessionId/requests/:requestId'],
    [`/api/court/sessions/${id}/npcs/witness/messages`,'/api/court/sessions/:sessionId/npcs/:npcId/messages'],
    [`/api/groups/${id}/invite/ABC12345`,'/api/groups/:groupId/invite/:code'],
    [`/api/groups/${id}/members/${id}`,'/api/groups/:groupId/members/:userId'],
    [`/api/planner/slots/${id}`,'/api/planner/slots/:slotId'],
    ['/api/auth/login','/api/auth/login'],
    ['/api/future/private-data','/api/:unmatched'],
    [`/api/court/sessions/${id}/events/secret`,'/api/:unmatched'],
    ['/api/auth/%0Asecret','/api/:unmatched']
  ])assert.equal(telemetryEndpoint(path),expected);
});

test('concurrent requests have isolated server IDs even with the same claimed trace',async()=>{
  const records=[];let release;const gate=new Promise(r=>release=r);
  const a=observeApiRequest(new Request(origin+'/api/practice/answer',{headers:{'X-Request-ID':'spoof'}}),async()=>{await gate;return new Response(null,{status:409});},failure,r=>records.push(r));
  const b=await observeApiRequest(new Request(origin+'/api/auth/session',{headers:{'X-Request-ID':'spoof'}}),async()=>new Response(null,{status:204}),failure,r=>records.push(r));
  release();const ar=await a;
  assert.notEqual(ar.headers.get('X-Request-ID'),b.headers.get('X-Request-ID'));
  assert.notEqual(records[0].traceId,records[1].traceId);
  assert.equal(records[0].endpoint,'/api/auth/session');assert.equal(records[0].status,204);
  assert.equal(records[1].endpoint,'/api/practice/answer');assert.equal(records[1].errorCode,'HTTP_409');
});

test('telemetry failure cannot change a committed success or consume streaming response',async()=>{
  let operations=0;
  const response=await observeApiRequest(new Request(origin+'/api/court/sessions'),async()=>{
    operations++;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('committed'));c.close();}}),{status:201});
  },failure,()=>{throw new Error('sink unavailable');});
  assert.equal(response.status,201);assert.equal(await response.text(),'committed');assert.equal(operations,1);
});
