// Actual Node SQLite transactions; mocked DO lifecycle, NOT workerd integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {parseEvent} from '../court/protocol.js';
const bundle=await build({entryPoints:['src/court.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'do-lifecycle',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
const {CourtRoom}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
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
