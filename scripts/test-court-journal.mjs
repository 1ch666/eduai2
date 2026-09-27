// Actual Node SQLite transactions; mocked DO lifecycle, NOT workerd integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {parseEvent,parseSnapshot} from '../court/protocol.js';
import {CourtTransport} from '../court/transport.js';
const bundle=await build({entryPoints:['src/court.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'do-lifecycle',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
const {CourtRoom,Learner}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
function setup(){
 const db=new DatabaseSync(':memory:');let fail=false;
 const sql={exec(query,...args){
  if(fail&&query.startsWith('INSERT INTO court_events'))throw Error('injected journal write failure');
  let rows;if(query.trim().startsWith('CREATE')){db.exec(query);rows=[];}else rows=db.prepare(query).all(...args);
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const ctx={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},blockConcurrencyWhile:fn=>fn()};
 const room=new CourtRoom(ctx,{}),id=crypto.randomUUID();room.init(id,'owner',config);
 return {room,db,ctx,id,setFail:value=>fail=value};
}
test('journal stores real ordered versions and duplicate actions produce no event',()=>{
 const {room,db}=setup();try{
  const initial=room.events('owner',-1);assert.equal(initial.events.length,1);assert.equal(initial.events[0].kind,'session_started');
  const a={requestId:crypto.randomUUID(),version:0,type:'acknowledge'};
  assert.ok(room.action('owner',a).view);assert.ok(room.action('owner',a).view);
  const events=room.events('owner',-1).events;assert.equal(events.length,2);assert.deepEqual(events.map(e=>e.eventSequence),[0,1]);
  for(const e of events){assert.ok(parseEvent(JSON.stringify(e)));assert.ok(!JSON.stringify(e).includes('"owner"'));assert.ok(!JSON.stringify(e).includes('"correct"'));assert.ok(!JSON.stringify(e).includes('generatedCase'));}
  assert.equal(room.action('owner',{...a,type:'speak',text:'changed'}).status,409);
  assert.equal(room.events('other',-1).status,404);assert.equal(room.events('owner',-2).status,400);
  assert.equal(room.events('owner',0).events.length,1);assert.equal(room.events('owner',1).events.length,0);
 }finally{db.close();}
});
test('permanent content deletion is owner-only, idempotent and blocks resurrection',async()=>{
 const {room,db,id}=setup();try{
  assert.equal(room.remove('other').status,404);assert.ok(room.get('owner').view);
  assert.equal(room.remove('owner').ok,true);assert.equal(room.remove('owner').ok,true);
  assert.equal(room.get('owner').status,404);assert.equal(room.events('owner',-1).status,404);
  assert.equal(room.snapshotV1('owner',crypto.randomUUID()).status,404);
  assert.equal(room.outcomeV1('owner',crypto.randomUUID()).status,404);
  assert.equal(room.action('owner',{requestId:crypto.randomUUID(),version:0,type:'acknowledge'}).status,404);
  assert.equal((await room.npc('owner','Witness',{requestId:crypto.randomUUID(),version:0,text:'你好'},false)).status,404);
  assert.equal(room.dialogue('owner',0).status,404);assert.equal(room.init(id,'owner',config).status,404);
  for(const table of ['state','requests','dialogue','npc_requests','court_events','court_v1_requests'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_deleted').get().n,1);
 }finally{db.close();}
});
test('failed event insertion rolls back BOTH state and request result',()=>{
 const {room,db,setFail}=setup();try{
  const a={requestId:crypto.randomUUID(),version:0,type:'acknowledge'};setFail(true);
  assert.equal(room.action('owner',a).status,409);setFail(false);
  assert.equal(room.get('owner').view.version,0);assert.equal(room.events('owner',-1).events.length,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM requests').get().n,0);
  assert.equal(room.action('owner',a).view.version,1);assert.equal(room.events('owner',-1).events.length,2);
 }finally{db.close();}
});
test('old sessions start at an honest checkpoint; new object reads persisted history',()=>{
 const {room,db,ctx}=setup();try{
  // Simulate a pre-journal local database, never a production cleanup.
  db.exec('DELETE FROM court_events');const state=JSON.parse(db.prepare('SELECT body FROM state').get().body);state.version=7;
  db.prepare('UPDATE state SET body=?').run(JSON.stringify(state));
  const events=room.events('owner',-1).events;assert.equal(events.length,1);assert.equal(events[0].kind,'checkpoint');assert.equal(events[0].stateVersion,7);
  const restored=new CourtRoom(ctx,{});assert.deepEqual(restored.events('owner',-1).events,events);
 }finally{db.close();}
});
test('NPC fallback and result commit once, with no private knowledge in event',async()=>{
 const {room,db}=setup();try{
  const input={requestId:crypto.randomUUID(),version:0,text:'你看到什麼？'};
  const result=await room.npc('owner','Witness',input,false);assert.ok(result.reply);
  assert.deepEqual(await room.npc('owner','Witness',input,false),result);
  const events=room.events('owner',-1).events;assert.equal(events.length,2);assert.equal(events[1].kind,'npc_utterance');assert.ok(parseEvent(JSON.stringify(events[1])));
  assert.match(events[1].text,/案件參考資料/);assert.equal(events[1].snapshot.stateVersion,1);assert.ok(!JSON.stringify(events).includes('knowledgeIds'));
 }finally{db.close();}
});
test('bounded pagination and illegal stage do not invent or mutate history',()=>{
 const {room,db}=setup();try{
  assert.equal(room.action('owner',{requestId:crypto.randomUUID(),version:0,type:'review',evidenceId:'payment'}).status,409);
  assert.equal(room.events('owner',-1).events.length,1);
  room.action('owner',{requestId:crypto.randomUUID(),version:0,type:'acknowledge'});
  room.action('owner',{requestId:crypto.randomUUID(),version:1,type:'speak',text:'請核對證據'});
  for(let version=2;version<25;version++)assert.ok(room.action('owner',{requestId:crypto.randomUUID(),version,type:'review',evidenceId:'payment'}).view);
  const a=room.events('owner',-1),b=room.events('owner',a.nextAfter);assert.equal(a.events.length,20);assert.equal(b.events.length,6);
  assert.deepEqual([...a.events,...b.events].map(e=>e.eventSequence),Array.from({length:26},(_,i)=>i));
  assert.equal(room.get('owner').view.version,25);
 }finally{db.close();}
});
const mutation=(id,version=0,actionId='acknowledge')=>({apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'sale',expectedStateVersion:version,actionId,targetId:'',text:''});
test('deletion clears generated case copies but preserves quota and unrelated rooms',()=>{
 const {db,ctx,id}=setup();try{
  const learner=new Learner(ctx,{}),requestId=crypto.randomUUID(),other=crypto.randomUUID();
  learner.addCourt(id,'erase');learner.addCourt(other,'keep');
  db.prepare('INSERT INTO generation_attempts VALUES(?,?,?,NULL)').run(requestId,JSON.stringify(config),1234);
  db.prepare('INSERT INTO generated_requests VALUES(?,?,?,?)').run(requestId,JSON.stringify(config),id,'{"facts":["erase me"]}');
  learner.removeCourt(id);learner.removeCourt(id);
  assert.equal(db.prepare('SELECT count(*) AS n FROM generated_requests WHERE room=?').get(id).n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM courts WHERE id=?').get(id).n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM courts WHERE id=?').get(other).n,1);
  const attempt=db.prepare('SELECT * FROM generation_attempts WHERE id=?').get(requestId);
  assert.equal(attempt.payload,'{}');assert.equal(attempt.created,1234);assert.equal(attempt.error,null);
 }finally{db.close();}
});
test('deletion transaction failure restores all case data and does not leave a guard',()=>{
 const {room,db,ctx}=setup();try{
  const original=ctx.storage.sql.exec;ctx.storage.sql.exec=(query,...args)=>{if(query==='DELETE FROM court_events')throw Error('injected erase failure');return original(query,...args);};
  assert.throws(()=>room.remove('owner'),/erase failure/);
  assert.equal(db.prepare('SELECT count(*) AS n FROM state').get().n,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_deleted').get().n,0);
  assert.ok(room.get('owner').view);
 }finally{db.close();}
});
test('v1 snapshot correlation, owner checks and stable idempotent outcomes',()=>{
 const {room,db,id}=setup();try{
  const requestId=crypto.randomUUID(),s=room.snapshotV1('owner',requestId);assert.ok(parseSnapshot(JSON.stringify(s)));assert.equal(s.requestId,requestId);
  const again=room.snapshotV1('owner',crypto.randomUUID());assert.equal(again.eventId,s.eventId);assert.equal(again.timestamp,s.timestamp);
  const m=mutation(id),e=room.actionV1('owner',m);assert.ok(parseEvent(JSON.stringify(e)));
  assert.deepEqual(room.actionV1('owner',m),e);assert.deepEqual(room.outcomeV1('owner',m.requestId),e);
  assert.equal(room.actionV1('owner',{...m,text:'changed'}).status,409);
  assert.equal(room.actionV1('owner',{...m,requestId:crypto.randomUUID()}).status,409);
  assert.equal(room.actionV1('owner',{...m,idempotencyKey:crypto.randomUUID()}).status,409);
  assert.equal(room.actionV1('other',m).status,404);assert.equal(room.outcomeV1('other',m.requestId).status,404);assert.equal(room.snapshotV1('other',requestId).status,404);
  assert.equal(room.actionV1('owner',mutation(id,0)).status,409);assert.equal(room.actionV1('owner',{...mutation(id,1),score:100}).status,400);
  assert.equal(room.events('owner',-1).events.length,2);
 }finally{db.close();}
});
test('v1 result write failure cannot commit state or event',()=>{
 const {room,db,ctx,id}=setup();try{
  const original=ctx.storage.sql.exec;ctx.storage.sql.exec=(query,...args)=>{if(query.startsWith('INSERT INTO court_v1_requests'))throw Error('injected outcome failure');return original(query,...args);};
  const m=mutation(id);assert.throws(()=>room.actionV1('owner',m),/outcome failure/);
  assert.equal(room.get('owner').view.version,0);assert.equal(room.events('owner',-1).events.length,1);assert.equal(room.outcomeV1('owner',m.requestId).status,404);
  ctx.storage.sql.exec=original;assert.ok(parseEvent(JSON.stringify(room.actionV1('owner',m))));
 }finally{db.close();}
});
test('real server rules complete a v1 civil judge flow using descriptors',()=>{
 const {room,db,id}=setup();try{
  let version=0;
  function act(actionId,options={}){const r=room.actionV1('owner',{...mutation(id,version,actionId),...options});assert.ok(parseEvent(JSON.stringify(r)),JSON.stringify(r));version++;return r;}
  act('acknowledge');act('speak',{text:'請核對双方證據'});
  act('review',{targetId:'payment'});act('review',{targetId:'chat'});act('rule.heard.allow');act('rule.shortcut.deny');act('closeEvidence');act('speak',{text:'付款不能單獨證明寄件或詐欺'});
  const result=act('answer.1');assert.equal(result.snapshot.state.completed,true);assert.equal(result.kind,'session_completed');assert.deepEqual(result.snapshot.state.allowedActions,[]);
 }finally{db.close();}
});
test('shell transport recovers an actual committed SQLite outcome after response loss',async()=>{
 const {room,db,id}=setup();let posts=0;try{
  const transport=new CourtTransport({origin:'https://court.test',csrf:()=> 'test',fetchImpl:async(url,o)=>{
   const u=new URL(url);let result;
   if(o.method==='POST'){posts++;result=room.actionV1('owner',JSON.parse(o.body));throw new TypeError('response lost AFTER commit');}
   if(u.pathname.includes('/requests/'))result=room.outcomeV1('owner',u.pathname.split('/').at(-1));else result=room.snapshotV1('owner',u.searchParams.get('requestId'));
   return Response.json(result,{status:result.status||200});
  }});
  transport.bind(id,'sale');assert.equal(await transport.refresh(),'accepted');assert.equal(await transport.act('acknowledge'),'network');assert.equal(transport.canAct,false);
  assert.equal(await transport.recoverPending(),'accepted');assert.equal(transport.snapshot.stateVersion,1);assert.equal(posts,1);assert.equal(room.events('owner',-1).events.length,2);
 }finally{db.close();}
});
