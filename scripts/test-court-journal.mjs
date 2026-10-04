// Actual Node SQLite transactions; mocked DO lifecycle, NOT workerd integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {parseEvent,parseSnapshot,canonical} from '../court/protocol.js';
import {CourtTransport} from '../court/transport.js';
import {CASES,LEGAL_SOURCES} from '../src/court-rules.ts';
import {courtV2Events,courtV2Deletion} from './court-schema-check.mjs';
import {readFile} from 'node:fs/promises';
import Ajv from 'ajv';
const privateRowsSchema=new Ajv({strict:true}).compile(JSON.parse(await readFile('contracts/court-private-journal-v1.schema.json','utf8')));
const bundle=await build({entryPoints:['src/court.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'do-lifecycle',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
const {CourtRoom,Learner}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const privateBundle=await build({entryPoints:['src/court-private-journal.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {reconstructPrivateState}=await import('data:text/javascript;base64,'+Buffer.from(privateBundle.outputFiles[0].text).toString('base64'));
const backupBundle=await build({entryPoints:['src/backup-envelope.ts'],bundle:true,platform:'node',format:'esm',write:false});
const {sealBackup,openBackup}=await import('data:text/javascript;base64,'+Buffer.from(backupBundle.outputFiles[0].text).toString('base64'));
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
const stageEnv={COURT_AI_ENABLED:'true',OLLAMA_API_KEY:'synthetic-test-key',AI_ADMISSION:{getByName(name){
 assert.equal(name,'ollama-account-v1');return {
  async admit(){return {code:'ACCEPTED',phase:'running',start:true,deadline:Date.now()+60000};},
  async cancel(){return {code:'SETTLED',start:false};},async finish(){return {code:'SETTLED',start:false};}
 };
}}};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const stageResponse=()=>Response.json({message:{content:JSON.stringify({text:'測試公開程序台詞'})}});
const stageFallback=room=>({...room.get('owner').view.turn,aiOutcome:{schemaVersion:1,scope:'response',feature:'stage-dialogue',source:'scripted',mode:'SCRIPTED_AI_FALLBACK',modelUsed:false}});

test('isolated encrypted SQLite drill preserves court history, receipts and deletion guards',async()=>{
 // Test-only, fixed table inventory. No file paths, network or production RPC.
 // This is NOT a general importer: only this harness's synthetic rows are used.
 const tables=['state','court_deleted','requests','dialogue','court_dialogue_attempts','npc_requests',
  'court_events','court_v1_requests','court_v1_npc_pending','court_replay_meta','court_replay_context','court_replay_state','court_v2_deletion'];
 const source=setup(),target=setup(config,{},false);
 const rows=db=>Object.fromEntries(tables.map(t=>[t,db.prepare(`SELECT * FROM ${t} ORDER BY 1`).all()]));
 try{
  const command=mutation(source.id),accepted=source.room.actionV1('owner',command);
  assert.ok(parseEvent(JSON.stringify(accepted)));
  const npc={...mutation(source.id,1,'npc.ask'),targetId:'Witness',text:'你好'};
  const spoken=await source.room.npcV1('owner',npc,false);
  assert.ok(parseEvent(JSON.stringify(spoken)));
  const snapshot=source.ctx.storage.transactionSync(()=>rows(source.db));
  assert.deepEqual(source.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name),[...tables].sort());
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  const manifest={schemaVersion:1,archiveId:crypto.randomUUID(),kind:'court',createdAt:'2026-09-28T00:00:00.000Z',sourceCommit:'a'.repeat(40),keyId:'synthetic-drill'};
  const archive=await sealBackup(new TextEncoder().encode(canonical(snapshot)),key,manifest);
  const restored=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await openBackup(archive,key,manifest)));
  const baseline=canonical(rows(target.db));
  const importSynthetic=injectFailure=>target.ctx.storage.transactionSync(()=>{
   // Target must be a fresh fixture, including no deletion tombstone. Never merge.
   assert.equal(canonical(rows(target.db)),baseline);
   for(const table of tables){
    const columns=target.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
    for(const row of restored[table]){
     assert.deepEqual(Object.keys(row).sort(),[...columns].sort());
     if(table==='court_replay_meta'){
      assert.equal(canonical(row),canonical(target.db.prepare('SELECT * FROM court_replay_meta').get()));continue;
     }
     target.db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(()=>'?').join(',')})`).run(...columns.map(c=>row[c]));
    }
   }
   for(let v=0;v<=2;v++)assert.ok(reconstructPrivateState(target.ctx.storage.sql,v,{sessionId:source.id,owner:'owner'}));
   if(injectFailure)throw Error('synthetic restore interruption');
  });
  assert.throws(()=>importSynthetic(true),/restore interruption/);
  assert.equal(canonical(rows(target.db)),baseline);
  importSynthetic(false);
  assert.equal(canonical(rows(target.db)),canonical(snapshot));
  const recovered=new CourtRoom(target.ctx,{});
  assert.deepEqual(recovered.get('owner'),source.room.get('owner'));
  assert.deepEqual(recovered.eventsV2('owner',-1),source.room.eventsV2('owner',-1));
  assert.equal(recovered.get('other').status,404);
  assert.deepEqual(recovered.actionV1('owner',command),accepted);
  assert.deepEqual(await recovered.npcV1('owner',npc,false),spoken);
  assert.equal(canonical(rows(target.db)),canonical(snapshot));
  assert.equal(recovered.actionV1('owner',mutation(source.id,0)).status,409);
  recovered.remove('owner');
  assert.equal(target.db.prepare('SELECT count(*) AS n FROM court_deleted').get().n,1);
  assert.equal(target.db.prepare('SELECT count(*) AS n FROM court_replay_state').get().n,0);
  assert.equal(new CourtRoom(target.ctx,{}).init(source.id,'owner',config).status,404);
  assert.equal(canonical(rows(source.db)),canonical(snapshot));
 }finally{source.db.close();target.db.close();}
});

test('private journal reconstructs exact server state, deduplicates context and never enters public events',async()=>{
 const {room,db,ctx,id}=setup();
 try{
  const initial=JSON.parse(db.prepare('SELECT body FROM state').get().body);
  assert.deepEqual(reconstructPrivateState(ctx.storage.sql,0,{sessionId:id,owner:'owner'}),initial);
  room.actionV1('owner',mutation(id));
  await room.npcV1('owner',{...mutation(id,1,'npc.ask'),targetId:'Witness',text:'你好'},false);
  const latest=JSON.parse(db.prepare('SELECT body FROM state').get().body);
  const before=db.prepare('SELECT total_changes() AS n').get().n;
  assert.deepEqual(reconstructPrivateState(ctx.storage.sql,2,{sessionId:id,owner:'owner'}),latest);
  assert.deepEqual(reconstructPrivateState(ctx.storage.sql,0,{sessionId:id,owner:'owner'}),initial);
  assert.equal(reconstructPrivateState(ctx.storage.sql,99,{sessionId:id,owner:'owner'}),null);
  assert.throws(()=>reconstructPrivateState(ctx.storage.sql,0,{sessionId:id,owner:'other'}),/integrity/);
  assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_replay_context').get().n,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_replay_state').get().n,3);
  assert.equal(privateRowsSchema({schemaVersion:1,contexts:db.prepare('SELECT * FROM court_replay_context').all(),states:db.prepare('SELECT * FROM court_replay_state').all()}),true);
  assert.ok(!JSON.stringify(room.eventsV2('owner',-1)).includes('"owner"'));
  room.remove('owner');
  for(const table of ['court_replay_context','court_replay_state'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
 }finally{db.close();}
});

test('private journal insert failure rolls back live state, public event and command receipt',()=>{
 const {room,db,ctx,id}=setup();
 try{
  const original=ctx.storage.sql.exec,before=db.prepare('SELECT body FROM state').get().body;
  ctx.storage.sql.exec=(query,...args)=>{if(query.startsWith('INSERT INTO court_replay_state'))throw Error('private write failed');return original(query,...args);};
  assert.throws(()=>room.actionV1('owner',mutation(id)),/private write failed/);
  assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_v1_requests').get().n,0);
 }finally{db.close();}
});

test('private reconstruction preserves generated answer keys and private graph without exposing them',()=>{
 const {room,db,ctx,id}=setup(config,{},false);
 try{
  const template=structuredClone(CASES.find(c=>c.id==='sale')),graph=graphFor(template);
  assert.ok(room.init(id,'owner',config,template,graph).view);
  const recorded=reconstructPrivateState(ctx.storage.sql,0,{sessionId:id,owner:'owner'});
  assert.deepEqual(recorded,JSON.parse(db.prepare('SELECT body FROM state').get().body));
  assert.equal(recorded.generatedCase.correct,template.correct);
  assert.deepEqual(recorded.privateGraph,graph);
  recorded.generatedCase.correct=99;
  assert.equal(reconstructPrivateState(ctx.storage.sql,0,{sessionId:id,owner:'owner'}).generatedCase.correct,template.correct);
  const publicData=JSON.stringify(room.eventsV2('owner',-1));
  for(const hidden of ['PRIVATE_TIMELINE_CANARY','generatedCase','privateGraph','"owner"'])assert.ok(!publicData.includes(hidden));
 }finally{db.close();}
});

test('private journal upgrade preserves old data without invented history and rejects broken links',()=>{
 const {room,db,ctx,id}=setup();
 try{
  db.exec('DROP TRIGGER court_replay_erase_on_state_delete_v1; DROP TABLE court_replay_state; DROP TABLE court_replay_context; DROP TABLE court_replay_meta');
  const before=db.prepare('SELECT body FROM state').get().body;
  const restarted=new CourtRoom(ctx,{});
  assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.equal(reconstructPrivateState(ctx.storage.sql,0,{sessionId:id,owner:'owner'}),null);
  restarted.actionV1('owner',mutation(id));
  assert.deepEqual(reconstructPrivateState(ctx.storage.sql,1,{sessionId:id,owner:'owner'}),JSON.parse(db.prepare('SELECT body FROM state').get().body));
  db.prepare('UPDATE court_replay_state SET event_id=?').run(crypto.randomUUID());
  assert.throws(()=>reconstructPrivateState(ctx.storage.sql,1,{sessionId:id,owner:'owner'}),/integrity/);
 }finally{db.close();}
});

test('persisted private cleanup survives legacy delete and rolls back if old transaction fails',()=>{
 const {room,db,ctx}=setup();
 try{
  const before=db.prepare('SELECT body FROM state').get().body;
  const legacyDelete=()=>{
   // Pre-feature a68df68 remove() table list: no knowledge of private tables.
   for(const table of ['state','requests','dialogue','court_dialogue_attempts','npc_requests','court_events','court_v1_requests','court_v1_npc_pending'])ctx.storage.sql.exec(`DELETE FROM ${table}`);
  };
  assert.throws(()=>ctx.storage.transactionSync(()=>{legacyDelete();throw Error('old delete failed');}),/old delete failed/);
  assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_replay_state').get().n,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_replay_context').get().n,1);
  ctx.storage.transactionSync(legacyDelete);
  for(const table of ['state','court_events','court_replay_state','court_replay_context'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
 }finally{db.close();}
});

test('v2 event audit verifies persisted command identity and is strictly read-only',()=>{
 const {room,db,id}=setup();
 try{
  const command={apiVersion:1,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,caseId:'sale',expectedStateVersion:0,actionId:'acknowledge',targetId:'',text:''};
  const event=room.actionV1('owner',command);assert.equal(event.stateVersion,1);
  const before=db.prepare('SELECT total_changes() AS n').get().n;
  const page=room.eventsV2('owner',-1);assert.equal(courtV2Events(page),true,JSON.stringify(courtV2Events.errors));
  assert.equal(page.events.length,2);assert.equal(page.events[0].provenance,'unattributed');
  assert.equal(page.events[0].previousVersion,null);assert.equal(page.events[0].idempotencyKey,null);
  assert.deepEqual(page.events[1],{eventVersion:2,eventId:event.eventId,eventType:event.kind,sessionId:id,actorRole:'judge',payload:event,previousVersion:0,newVersion:1,timestamp:event.timestamp,idempotencyKey:command.idempotencyKey,provenance:'verified-command-v1'});
  assert.deepEqual(room.eventsV2('owner',-1),page);
  assert.deepEqual(room.eventsV2('owner',1),{events:[],nextAfter:1,stateVersion:1});
  assert.equal(room.eventsV2('other',-1).status,404);
  for(const invalid of [-2,NaN,Infinity,'0',.5,Number.MAX_SAFE_INTEGER+1])assert.equal(room.eventsV2('owner',invalid).status,400);
  assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before,'audit must perform no writes');
  db.prepare('UPDATE court_v1_requests SET payload=?').run(JSON.stringify({...command,expectedStateVersion:5}));
  assert.equal(room.eventsV2('owner',0).events[0].provenance,'unattributed','do not guess a previous version');
  db.prepare('UPDATE court_v1_requests SET payload=?,event=?').run(JSON.stringify(command),JSON.stringify({...event,text:'PRIVATE_MISMATCH'}));
  const mismatched=room.eventsV2('owner',0);assert.equal(mismatched.events[0].idempotencyKey,null);
  assert.ok(!JSON.stringify(mismatched).includes('PRIVATE_MISMATCH'));
 }finally{db.close();}
});

test('v2 replay reports a legacy history gap without writing a checkpoint or leaking corrupt records',()=>{
 const {room,db}=setup();
 try{
  const stored=db.prepare('SELECT version,event_id,body FROM court_events').get();
  db.prepare('DELETE FROM court_events').run();
  const before=db.prepare('SELECT total_changes() AS n').get().n;
  const empty=room.eventsV2('owner',-1);assert.deepEqual(empty,{events:[],nextAfter:-1,stateVersion:0});
  assert.equal(courtV2Events(empty),true);assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before);
  db.prepare('INSERT INTO court_events VALUES(?,?,?)').run(stored.version,stored.event_id,JSON.stringify({...JSON.parse(stored.body),privateTruth:'PRIVATE'}));
  assert.throws(()=>room.eventsV2('owner',-1),/Invalid persisted public event/);
 }finally{db.close();}
});

test('v2 audit rejects mismatched persisted session and row identity without repairing data',()=>{
 const {room,db}=setup();
 try{
  const stored=db.prepare('SELECT body FROM court_events').get().body,original=JSON.parse(stored);
  for(const patch of [{sessionId:crypto.randomUUID()},{caseId:'another-case'},{stateVersion:1},{eventId:crypto.randomUUID()}]){
   db.prepare('UPDATE court_events SET body=?').run(JSON.stringify({...original,...patch}));
   const before=db.prepare('SELECT total_changes() AS n').get().n;
   assert.throws(()=>room.eventsV2('owner',-1),/Invalid persisted public event/);
   assert.equal(db.prepare('SELECT total_changes() AS n').get().n,before);
  }
 }finally{db.close();}
});

test('CourtRoom propagates a copied trace but never persists it or emits new provider spans for cached replies',async()=>{
 const {room,db}=setup(config,stageEnv),original=globalThis.fetch,log=console.log,records=[];
 const trace={schemaVersion:1,requestId:crypto.randomUUID(),traceId:crypto.randomUUID().replaceAll('-','')},expected={...trace};
 console.log=value=>records.push(JSON.parse(value));globalThis.fetch=async()=>stageResponse();
 try{
  const pending=room.stageDialogue('owner',0,true,trace);trace.traceId='PRIVATE_MUTATED';
  const result=await pending;assert.equal(result.cached.mode,'ai-dialogue');
  assert.equal(records.length,3);
  for(const r of records){assert.equal(r.traceId,expected.traceId);assert.equal(r.requestId,expected.requestId);assert.equal(r.feature,'stage-dialogue');}
  assert.equal(records[2].event,'ai.pipeline.completed');assert.equal(records[2].step,'validator');assert.equal(records[2].outcome,'accepted');
  assert.deepEqual(await room.stageDialogue('owner',0,true,expected),result);assert.equal(records.length,3);
  assert.equal(JSON.stringify(result).includes(expected.traceId),false);
  assert.equal(JSON.stringify(db.prepare('SELECT body FROM state').all()).includes(expected.traceId),false);
  assert.equal(JSON.stringify(records).includes('synthetic-test-key'),false);
 }finally{globalThis.fetch=original;console.log=log;db.close();}
});
test('stage dialogue concurrent tabs and lost response share one durable provider attempt',async()=>{
 const {room,db,ctx}=setup(config,stageEnv);const original=globalThis.fetch;let calls=0,release;const entered=gate();
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{release=resolve;entered.resolve();});};
 try{
  const before=db.prepare('SELECT body FROM state').get().body;
  const first=room.stageDialogue('owner',0,true);
  await entered.promise;
  assert.equal(calls,1);
  assert.equal((await room.stageDialogue('owner',0,true)).status,409);
  const restarted=new CourtRoom(ctx,stageEnv);
  assert.equal((await restarted.stageDialogue('owner',0,true)).status,409);
  release(stageResponse());const result=await first;
  assert.equal(result.cached.mode,'ai-dialogue');assert.equal(result.cached.aiOutcome.mode,'FULL');
  assert.equal(result.cached.aiOutcome.feature,'stage-dialogue');
  assert.deepEqual(await restarted.stageDialogue('owner',0,true),result);
  assert.equal(calls,1);assert.equal(db.prepare('SELECT count(*) AS n FROM court_dialogue_attempts').get().n,1);
  assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.equal(room.events('owner',-1).events.length,1);
 }finally{globalThis.fetch=original;db.close();}
});
test('stage dialogue expired reservation seals fallback across restart and fences late response',async()=>{
 const {room,db,ctx}=setup(config,stageEnv);const original=globalThis.fetch;let calls=0,release;const entered=gate();
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{release=resolve;entered.resolve();});};
 try{
  const fallback=stageFallback(room);
  const first=room.stageDialogue('owner',0,true);
  await entered.promise;
  db.prepare('UPDATE court_dialogue_attempts SET created=?').run(Date.now()-21000);
  const restarted=new CourtRoom(ctx,stageEnv);
  const recovered=await restarted.stageDialogue('owner',0,true);
  assert.deepEqual(recovered,{cached:fallback});
  release(stageResponse());assert.deepEqual(await first,recovered);
  assert.deepEqual(await restarted.stageDialogue('owner',0,true),recovered);assert.equal(calls,1);
 }finally{globalThis.fetch=original;db.close();}
});
test('stage dialogue late provider without recovery cannot win after its deadline',async()=>{
 const {room,db}=setup(config,stageEnv);const original=globalThis.fetch,clock=Date.now;
 const start=clock();let release;Date.now=()=>start;const entered=gate();
 globalThis.fetch=()=>new Promise(resolve=>{release=resolve;entered.resolve();});
 try{
  const fallback=stageFallback(room),first=room.stageDialogue('owner',0,true);
  await entered.promise;
  Date.now=()=>start+21000;release(stageResponse());assert.deepEqual(await first,{cached:fallback});
 }finally{Date.now=clock;globalThis.fetch=original;db.close();}
});
test('stage dialogue revalidates version and deletion after provider I/O',async()=>{
 for(const remove of [false,true]){
  const {room,db,id}=setup(config,stageEnv);const original=globalThis.fetch;let release;const entered=gate();
  globalThis.fetch=()=>new Promise(resolve=>{release=resolve;entered.resolve();});
  try{
   const first=room.stageDialogue('owner',0,true);
   await entered.promise;
   if(remove)room.remove('owner');else assert.ok(room.actionV1('owner',mutation(id)).eventId);
   release(stageResponse());assert.equal((await first).status,remove?404:409);
   assert.equal(db.prepare('SELECT count(*) AS n FROM dialogue').get().n,0);
   assert.equal(db.prepare('SELECT count(*) AS n FROM court_dialogue_attempts').get().n,remove?0:1);
  }finally{globalThis.fetch=original;db.close();}
 }
});
test('stage dialogue rejects unauthorized and malformed calls before provider or reservation',async()=>{
 const {room,db}=setup(config,stageEnv);const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return stageResponse();};
 try{
  assert.equal((await room.stageDialogue('other',0,true)).status,404);
  for(const value of [-1,NaN,Infinity,.5,'0',null])assert.equal((await room.stageDialogue('owner',value,true)).status,400);
  assert.equal((await room.stageDialogue('owner',0,'true')).status,400);
  assert.equal((await room.stageDialogue('owner',1,true)).status,409);
  assert.equal(calls,0);assert.equal(db.prepare('SELECT count(*) AS n FROM court_dialogue_attempts').get().n,0);
 }finally{globalThis.fetch=original;db.close();}
});
test('stage dialogue disabled, no key, admission denied and provider failure cache truthful fallback',async()=>{
 for(const [env,allowed,expectedCalls] of [[{},true,0],[{COURT_AI_ENABLED:'true'},true,0],[{...stageEnv,COURT_AI_ENABLED:'false'},true,0],[stageEnv,false,0],[stageEnv,true,1]]){
  const {room,db}=setup(config,env);const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response('quota',{status:429});};
  try{
   const expected={cached:stageFallback(room)};
   assert.deepEqual(await room.stageDialogue('owner',0,allowed),expected);
   assert.deepEqual(await room.stageDialogue('owner',0,allowed),expected);
   assert.equal(calls,expectedCalls);assert.equal(db.prepare('SELECT count(*) AS n FROM court_dialogue_attempts').get().n,expectedCalls);
  }finally{globalThis.fetch=original;db.close();}
 }
});
test('stage dialogue additive schema preserves old state, journal and cached replies',async()=>{
 const {room,db,ctx}=setup(config,stageEnv);const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return stageResponse();};
 try{
  const old={text:'舊版已保存台詞',mode:'ai-dialogue',speaker:'法官',version:0};room.dialogue('owner',0,old);
  const before=db.prepare('SELECT body FROM state').get().body,journal=room.events('owner',-1);
  // Isolated in-memory fixture emulates the pre-migration database, never production.
  db.exec('DROP TABLE court_dialogue_attempts');
  const migrated=new CourtRoom(ctx,stageEnv);
  assert.deepEqual(await migrated.stageDialogue('owner',0,true),{cached:old});
  assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.deepEqual(migrated.events('owner',-1),journal);assert.equal(calls,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_dialogue_attempts').get().n,0);
 }finally{globalThis.fetch=original;db.close();}
});

test('stage admission failure cannot bypass to raw provider; fallback remains durably cached',async()=>{
 for(const behavior of ['missing','throw','BUDGET','DISABLED','CIRCUIT_OPEN','EXISTING']){
  let admits=0;const env={...stageEnv,AI_ADMISSION:behavior==='missing'?undefined:{getByName(){return {
   async admit(){admits++;if(behavior==='throw')throw Error('private admission failure');return {code:behavior,start:false};}
  };}}};
  const {room,db,ctx}=setup(config,env),original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('must not call provider');};
  try{
   const expected={cached:stageFallback(room)};
   assert.deepEqual(await room.stageDialogue('owner',0,true),expected);
   assert.deepEqual(await new CourtRoom(ctx,env).stageDialogue('owner',0,true),expected);
   assert.equal(calls,0);assert.equal(admits,behavior==='missing'?0:1);
   assert.equal(db.prepare('SELECT count(*) AS n FROM court_dialogue_attempts').get().n,1);
  }finally{globalThis.fetch=original;db.close();}
 }
});

test('stage admission identity is bound to persisted timestamp before async I/O',async()=>{
 const clock=Date.now,start=86400000*20000+86399999;Date.now=()=>start;
 let captured;const env={...stageEnv,AI_ADMISSION:{getByName(){return {async admit(request){
  captured=request;return {code:'BUDGET',start:false};
 }};}}};
 const {room,db}=setup(config,env);
 try{
  const pending=room.stageDialogue('owner',0,true);
  assert.equal(db.prepare('SELECT created FROM court_dialogue_attempts').get().created,start);
  Date.now=()=>start+2;await pending;
  assert.match(captured.id,/^20000:[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(captured).includes('owner'),false);
 }finally{Date.now=clock;db.close();}
});

test('both NPC routes persist truthful admission fallback once without inference or duplicate scoring',async()=>{
 for(const legacy of [false,true])for(const code of ['BUDGET','DISABLED','EXISTING']){
  let admits=0;const env={...stageEnv,AI_ADMISSION:{getByName(){return {async admit(){admits++;return {code,start:false};}};}}};
  const {room,db,id,ctx}=setup(config,env),original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;throw Error('raw inference forbidden');};
  try{
   const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'};
   const invoke=r=>legacy?r.npc('owner','Witness',{requestId:m.requestId,version:0,text:m.text},true):r.npcV1('owner',m,true);
   const first=await invoke(room),next=await invoke(new CourtRoom(ctx,env));assert.deepEqual(next,first);
   const reply=room.get('owner').view.npcHistory[0];
   assert.equal(reply.mode,'scripted');assert.equal(reply.errorCode,'ADMISSION_DENIED');
   assert.equal(calls,0);assert.equal(admits,1);assert.equal(room.get('owner').view.version,1);
   assert.equal(room.events('owner',-1).events.length,2);
  }finally{globalThis.fetch=original;db.close();}
 }
});

test('stage and NPC share user/session budget keys but not attempt identity',async()=>{
 const requests=[];const port=stageEnv.AI_ADMISSION.getByName('ollama-account-v1');
 const env={...stageEnv,AI_ADMISSION:{getByName(){return {...port,async admit(r){requests.push(r);return port.admit(r);}};}}};
 const {room,db,id}=setup(config,env),original=globalThis.fetch;
 globalThis.fetch=async(_url,options)=>Response.json({message:{content:JSON.stringify(JSON.parse(options.body).options.num_predict===250?
  {text:'請依序說明。'}:{reply:'你好，可以一起核對資料。',factIds:[],uncertain:true})}});
 try{
  assert.equal((await room.stageDialogue('owner',0,true)).cached.mode,'ai-dialogue');
  await room.npcV1('owner',{...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'},true);
  assert.equal(requests.length,2);assert.equal(requests[0].userKey,requests[1].userKey);
  assert.equal(requests[0].sessionKey,requests[1].sessionKey);assert.notEqual(requests[0].id,requests[1].id);
  assert.equal(JSON.stringify(requests).includes('owner'),false);
 }finally{globalThis.fetch=original;db.close();}
});

test('generation rejection preserves randomized library, request recovery and quota reservation',async()=>{
 const {db,ctx}=setup();let admits=0,calls=0;const original=globalThis.fetch;
 const env={...stageEnv,AI_ADMISSION:{getByName(){return {async admit(){admits++;return {code:'BUDGET',start:false};}};}}};
 globalThis.fetch=async()=>{calls++;throw Error('raw inference forbidden');};
 try{
  const learner=new Learner(ctx,env),requestId=crypto.randomUUID();
  const first=await learner.generate(requestId,config,'owner');
  assert.ok(first.template.title.startsWith('[題庫]'));assert.equal(first.template.procedure,'civil');
  assert.deepEqual(await new Learner(ctx,env).generate(requestId,config,'owner'),first);
  assert.equal(db.prepare('SELECT count(*) AS n FROM generation_attempts').get().n,1);
  assert.equal(admits,1);assert.equal(calls,0);
  learner.removeCourt(first.id);
  assert.equal((await learner.generate(requestId,config,'owner')).status,409);assert.equal(admits,1);
 }finally{globalThis.fetch=original;db.close();}
});

test('generation admits once after durable reservation and fences concurrent/restarted duplicate',async()=>{
 const {db,ctx}=setup(),entered=gate(),release=gate(),requests=[];
 const port=stageEnv.AI_ADMISSION.getByName('ollama-account-v1');
 const env={...stageEnv,AI_ADMISSION:{getByName(){return {...port,async admit(r){
  assert.equal(db.prepare('SELECT count(*) AS n FROM generation_attempts').get().n,1);
  requests.push(r);entered.resolve();await release.promise;return port.admit(r);
 }};}}};
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return new Response('quota',{status:429});};
 try{
  const learner=new Learner(ctx,env),id=crypto.randomUUID(),first=learner.generate(id,config,'owner');
  await entered.promise;
  assert.equal((await new Learner(ctx,env).generate(id,config,'owner')).status,409);assert.equal(calls,0);
  release.resolve();const result=await first;assert.ok(result.template.title.startsWith('[題庫]'));
  assert.deepEqual(await learner.generate(id,config,'owner'),result);assert.equal(calls,1);assert.equal(requests.length,1);
 }finally{release.resolve();globalThis.fetch=original;db.close();}
});
test('future private state and nested metadata never escape legacy view or v1 journal',()=>{
 const {room,db}=setup();
 try{
  const state=JSON.parse(db.prepare('SELECT body FROM state').get().body);
  state.privateGraph={facts:[{id:'PRIVATE_GRAPH_CANARY'}]};
  state.config.internalPolicy='PRIVATE_CONFIG_CANARY';
  state.generatedCase={id:'synthetic',title:'測試案件',procedure:'civil',summary:'測試摘要',
   facts:['公開事實'],evidence:[{id:'e1',title:'證物',text:'公開內容',privateFactIds:['PRIVATE_EVIDENCE_CANARY']}],
   question:'測試問題',answers:['甲','乙'],correct:1,explanation:'測試解析',mandatory:false,aidApproved:false,
   privateGraph:'PRIVATE_TEMPLATE_CANARY'};
  state.version++;
  db.prepare('UPDATE state SET body=?').run(JSON.stringify(state));
  const outputs=[room.get('owner'),room.snapshotV1('owner',crypto.randomUUID()),room.events('owner',-1)];
  for(const output of outputs)assert.ok(!JSON.stringify(output).includes('PRIVATE_'),'private metadata escaped public projection');
  assert.deepEqual(room.get('owner').view.evidence,[{id:'e1',title:'證物',text:'公開內容'}]);
  assert.equal(room.get('other').status,404);
  // Projection must not erase the private server record just to hide it.
  assert.ok(db.prepare('SELECT body FROM state').get().body.includes('PRIVATE_GRAPH_CANARY'));
 }finally{db.close();}
});
function setup(selectedConfig=config,env={},initialize=true){
 const db=new DatabaseSync(':memory:');let fail=false;
 const sql={exec(query,...args){
  if(fail&&query.startsWith('INSERT INTO court_events'))throw Error('injected journal write failure');
  let rows;if(query.trim().startsWith('CREATE')){db.exec(query);rows=[];}else rows=db.prepare(query).all(...args);
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};
 }};
 const ctx={storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}},blockConcurrencyWhile:fn=>fn()};
 const room=new CourtRoom(ctx,env),id=crypto.randomUUID();if(initialize)room.init(id,'owner',selectedConfig);
 return {room,db,ctx,id,setFail:value=>fail=value};
}

test('v2 creation commits once, recovers after restart and refuses altered keys, owners or deleted IDs',()=>{
 const {room,db,ctx,id}=setup(config,{},false);try{
  const c={apiVersion:2,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,expectedStateVersion:0,config};
  const event=room.initV2('owner',c);assert.ok(parseEvent(JSON.stringify(event)));assert.equal(event.kind,'session_started');
  assert.equal(event.requestId,c.requestId);assert.equal(event.stateVersion,0);
  const restarted=new CourtRoom(ctx,{});assert.deepEqual(restarted.initV2('owner',c),event);
  assert.deepEqual(restarted.outcomeV2('owner',id,c.requestId),event);
  for(const change of [{requestId:crypto.randomUUID()},{idempotencyKey:crypto.randomUUID()},{config:{...config,claimantAge:19}}])
   assert.equal(restarted.initV2('owner',{...c,...change}).status,409);
  assert.equal(restarted.initV2('other',c).status,404);
  assert.ok(restarted.actionV1('owner',mutation(id)).snapshot);
  assert.deepEqual(restarted.initV2('owner',c),event,'creation retry must not regress current state');
  assert.equal(restarted.get('owner').view.version,1);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,2);
  restarted.remove('owner');assert.equal(restarted.initV2('owner',c).status,404);
  assert.equal(restarted.outcomeV2('owner',id,c.requestId).status,404);
 }finally{db.close();}
});
test('v2 creation audit verifies genesis command and role without mutating state or guessing legacy metadata',()=>{
 const {room,db,ctx,id}=setup(config,{},false);try{
  const c={apiVersion:2,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,expectedStateVersion:0,config};
  const event=room.initV2('owner',c),exec=ctx.storage.sql.exec;
  ctx.storage.sql.exec=(query,...args)=>{assert.match(query,/^SELECT /);return exec(query,...args);};
  const page=room.eventsV2('owner',-1);assert.equal(courtV2Events(page),true,JSON.stringify(courtV2Events.errors));
  assert.deepEqual(page.events[0],{eventVersion:2,eventId:event.eventId,eventType:'session_started',sessionId:id,
   actorRole:'judge',payload:event,previousVersion:null,newVersion:0,timestamp:event.timestamp,
   idempotencyKey:c.idempotencyKey,provenance:'verified-creation-v2'});
  assert.equal(courtV2Events({...page,events:[{...page.events[0],previousVersion:0}]}),false);
  assert.equal(courtV2Events({...page,events:[{...page.events[0],newVersion:1}]}),false);
  for(const change of [{sessionId:crypto.randomUUID()},{requestId:crypto.randomUUID()},
   {config:{...config,role:'observer'}},{config:{...config,caseId:'damage'}}]){
   db.prepare('UPDATE court_v1_requests SET payload=?').run(canonical({...c,...change}));
   assert.equal(room.eventsV2('owner',-1).events[0].provenance,'unattributed');
  }
  db.prepare('UPDATE court_v1_requests SET payload=?,event=?').run(canonical(c),JSON.stringify({...event,text:'changed receipt'}));
  assert.equal(room.eventsV2('owner',-1).events[0].provenance,'unattributed');
  assert.equal(room.eventsV2('other',-1).status,404);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,1);
 }finally{db.close();}
});
test('v2 creation receipt failure rolls back state and both journals, legacy room is not overwritten',()=>{
 const {room,db,ctx,id}=setup(config,{},false);try{
  const c={apiVersion:2,requestId:crypto.randomUUID(),idempotencyKey:crypto.randomUUID(),sessionId:id,expectedStateVersion:0,config};
  const exec=ctx.storage.sql.exec;
  ctx.storage.sql.exec=(query,...args)=>{if(query.startsWith('INSERT INTO court_v1_requests'))throw Error('receipt write failed');return exec(query,...args);};
  assert.throws(()=>room.initV2('owner',c),/receipt write failed/);
  for(const table of ['state','court_events','court_replay_state','court_v1_requests'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
  ctx.storage.sql.exec=exec;room.init(id,'owner',config);assert.equal(room.initV2('owner',c).status,409);
 }finally{db.close();}
});
test('learner index duplicate reservation succeeds at capacity without evicting another room',()=>{
 const {db,ctx}=setup();try{
  const learner=new Learner(ctx,{}),id=crypto.randomUUID();assert.equal(learner.addCourt(id,'keep'),true);
  for(let i=1;i<100;i++)assert.equal(learner.addCourt(crypto.randomUUID(),'other'),true);
  assert.equal(learner.addCourt(id,'changed'),true);
  assert.equal(learner.addCourt(crypto.randomUUID(),'overflow'),false);
  assert.equal(db.prepare('SELECT title FROM courts WHERE id=?').get(id).title,'keep');
 }finally{db.close();}
});
test('v2 deletion erases content, preserves a stable retry receipt and never revives the scene',()=>{
 const {room,db,ctx,id}=setup();try{
  const command={...mutation(id),actionId:'session.delete'};
  assert.equal(room.removeV2('other',command).status,404);
  assert.equal(room.removeV2('owner',{...command,expectedStateVersion:1}).status,409);
  assert.equal(room.removeV2('owner',{...command,text:'unexpected'}).status,400);
  const result=room.removeV2('owner',command);
  assert.equal(courtV2Deletion(result),true,JSON.stringify(courtV2Deletion.errors));
  assert.equal(result.stateVersion,result.previousVersion+1);
  for(const table of ['state','requests','dialogue','court_dialogue_attempts','npc_requests','court_events','court_v1_requests','court_v1_npc_pending','court_replay_state','court_replay_context'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0,table);
  const restarted=new CourtRoom(ctx,{});
  assert.deepEqual(restarted.removeV2('owner',command),result);
  assert.equal(restarted.removeV2('other',command).status,404);
  assert.equal(restarted.removeV2('owner',{...command,idempotencyKey:crypto.randomUUID()}).status,409);
  assert.equal(restarted.init(id,'owner',config).status,404);
  restarted.remove('owner');assert.deepEqual(restarted.removeV2('owner',command),result,'legacy retry preserves v2 guard');
 }finally{db.close();}
});
test('v2 outcome recovers deletion read-only after restart, not private content or other owners',()=>{
 const {room,db,ctx,id}=setup();try{
  const action=mutation(id),event=room.actionV1('owner',action);
  assert.deepEqual(room.outcomeV2('owner',id,action.requestId),event);
  const command={...mutation(id,1),actionId:'session.delete'},result=room.removeV2('owner',command);
  const restarted=new CourtRoom(ctx,{}),exec=ctx.storage.sql.exec;
  ctx.storage.sql.exec=(query,...args)=>{assert.match(query,/^SELECT /,'recovery must not write');return exec(query,...args);};
  assert.deepEqual(restarted.outcomeV2('owner',id,command.requestId),result);
  assert.equal(restarted.outcomeV2('other',id,command.requestId).status,404);
  assert.equal(restarted.outcomeV2('owner',crypto.randomUUID(),command.requestId).status,404);
  assert.equal(restarted.outcomeV2('owner',id,action.requestId).status,404);
  assert.equal(restarted.outcomeV2('owner',id,'invalid').status,400);
  assert.equal(db.prepare('SELECT count(*) AS n FROM state').get().n,0);
 }finally{db.close();}
});
test('v2 deletion recovery rejects corrupt persisted receipts and never invents legacy results',()=>{
 for(const change of ["schema_version=2","event_id='invalid'","deleted_at='invalid'","payload='{}'"]){
  const {room,db,id}=setup();try{
   const command={...mutation(id),actionId:'session.delete'};room.removeV2('owner',command);
   db.exec(`UPDATE court_v2_deletion SET ${change}`);
   assert.equal(room.outcomeV2('other',id,command.requestId).status,404);
   assert.throws(()=>room.outcomeV2('owner',id,command.requestId),/Invalid deletion receipt/);
  }finally{db.close();}
 }
 const {room,db,id}=setup();try{
  room.remove('owner');assert.equal(room.outcomeV2('owner',id,crypto.randomUUID()).status,404);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_v2_deletion').get().n,0);
 }finally{db.close();}
});
test('v2 deletion rollback preserves content and rejects reused action identities',()=>{
 const {room,db,ctx,id}=setup();try{
  const action=mutation(id);room.actionV1('owner',action);
  const command={...mutation(id,1),actionId:'session.delete'};
  assert.equal(room.removeV2('owner',{...command,requestId:action.requestId}).status,409);
  assert.equal(room.removeV2('owner',{...command,idempotencyKey:action.idempotencyKey}).status,409);
  const before=db.prepare('SELECT body FROM state').get().body,exec=ctx.storage.sql.exec;
  ctx.storage.sql.exec=(sql,...args)=>{if(sql.startsWith('INSERT INTO court_v2_deletion'))throw Error('injected deletion failure');return exec(sql,...args);};
  assert.throws(()=>room.removeV2('owner',command),/injected deletion/);
  assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_deleted').get().n,0);
  ctx.storage.sql.exec=exec;room.remove('owner');
  assert.equal(room.removeV2('owner',command).status,409,'legacy delete does not invent a receipt');
 }finally{db.close();}
});

function graphFor(template){
 return {schemaVersion:1,facts:template.facts.map((_,i)=>({id:`fact-${i}`})),
  evidence:template.evidence.map(e=>({id:e.id,factIds:['fact-0']})),
  witnesses:[{id:'Witness',factIds:['fact-0'],evidenceIds:[template.evidence[0].id]}],
  timeline:[{id:'PRIVATE_TIMELINE_CANARY',order:0,factIds:['fact-0'],afterIds:[]}],
  legalSourceIds:LEGAL_SOURCES.filter(s=>s.applies===template.procedure).map(s=>s.id)};
}
test('init rejects malformed or mismatched graphs before any state/event write',()=>{
 const template=CASES.find(c=>c.id==='sale');
 const invalid=[null,{}, {...graphFor(template),schemaVersion:2}];
 for(const mutate of [g=>g.facts.pop(),g=>g.facts.push({id:'invented'}),
  g=>g.evidence.pop(),g=>g.evidence[0].id='invented',g=>g.witnesses[0].id='Judge',
  g=>g.evidence[0].factIds=['unknown'],g=>g.legalSourceIds=['defense'],
  g=>g.timeline[0].afterIds=['PRIVATE_TIMELINE_CANARY']]){
  const g=graphFor(template);mutate(g);invalid.push(g);
 }
 for(const graph of invalid){
  const {room,db,id}=setup(config,{},false);try{
   assert.equal(room.init(id,'owner',config,undefined,graph).status,400);
   assert.equal(db.prepare('SELECT count(*) AS n FROM state').get().n,0);
   assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,0);
  }finally{db.close();}
 }
});
test('init validates template policy and role/age/assistance before graph storage',()=>{
 const template=CASES.find(c=>c.id==='sale');
 for(const [c,t] of [[{...config,respondentAge:100},undefined],
  [{...config,caseId:'youth-property',role:'observer'},undefined],
  [config,{...template,mandatory:true}],[config,{...template,correct:99}],
  [config,{...template,evidence:[]}],
  [{...config,role:'respondentCounsel',respondentAid:'none'},undefined]]){
  const {room,db,id}=setup(config,{},false);try{
   assert.equal(room.init(id,'owner',c,t,graphFor(template)).status,400);
   assert.equal(db.prepare('SELECT count(*) AS n FROM state').get().n,0);
   assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,0);
  }finally{db.close();}
 }
});
test('private graph persists through recreation/actions but not public outputs; deletion removes it',async()=>{
 const template=CASES.find(c=>c.id==='sale'),graph=graphFor(template),expected=structuredClone(graph);
 const {room,db,ctx,id}=setup(config,{},false);try{
  const first=room.init(id,'owner',config,undefined,graph);
  assert.ok(first.view);graph.timeline[0].id='mutated';
  const restored=new CourtRoom(ctx,{});
  const outputs=[first,restored.get('owner'),restored.snapshotV1('owner',crypto.randomUUID()),
   restored.action('owner',{requestId:crypto.randomUUID(),version:0,type:'acknowledge'}),
   await restored.npc('owner','Witness',{requestId:crypto.randomUUID(),version:1,text:'你好'},false),
   restored.events('owner',-1)];
  for(const output of outputs){
   const text=JSON.stringify(output);assert.ok(!text.includes('privateGraph'));assert.ok(!text.includes('PRIVATE_TIMELINE_CANARY'));
  }
  assert.deepEqual(JSON.parse(db.prepare('SELECT body FROM state').get().body).privateGraph,expected);
  const before=db.prepare('SELECT body FROM state').get().body;
  assert.ok(restored.init(id,'owner',config,undefined,{}).view,'init retry returns saved state, never replaces graph');
  assert.equal(restored.init(id,'other',config,undefined,expected).status,404);
  assert.equal(restored.get('other').status,404);assert.equal(db.prepare('SELECT body FROM state').get().body,before);
  assert.ok(restored.remove('owner').ok);assert.equal(db.prepare('SELECT count(*) AS n FROM state').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,0);
  assert.equal(restored.init(id,'owner',config,undefined,expected).status,404);
 }finally{db.close();}
});
test('graph creation and initial journal are one transaction and retry succeeds after rollback',()=>{
 const {room,db,id,setFail}=setup(config,{},false),graph=graphFor(CASES.find(c=>c.id==='sale'));
 try{
  setFail(true);assert.throws(()=>room.init(id,'owner',config,undefined,graph),/injected journal/);
  for(const table of ['state','court_events'])assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n,0);
  setFail(false);assert.ok(room.init(id,'owner',config,undefined,graph).view);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_events').get().n,1);
 }finally{db.close();}
});
test('all six templates bind graphs to the actual generated evidence IDs',()=>{
 for(const base of CASES){
  const c={...config,caseId:base.id,respondentAge:base.procedure==='juvenile'?15:20,
   respondentHearingAge:base.procedure==='juvenile'?15:20,respondentAid:base.mandatory?'appointed':'none'};
  const template={...structuredClone(base),id:'generated-test',evidence:base.evidence.map((e,i)=>({...e,id:`generated-${i}`}))};
  const {room,db,id}=setup(c,{},false);try{
   assert.equal(room.init(id,'owner',c,template,graphFor(base)).status,400);
   assert.ok(room.init(id,'owner',c,template,graphFor(template)).view);
   assert.deepEqual(JSON.parse(db.prepare('SELECT body FROM state').get().body).privateGraph,graphFor(template));
  }finally{db.close();}
 }
});
test('private graph is omitted from AI request context and v1 action results',async()=>{
 const {room,db,id}=setup(config,stageEnv,false);
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(_url,options)=>{
  calls++;assert.ok(!options.body.includes('PRIVATE_TIMELINE_CANARY'));assert.ok(!options.body.includes('privateGraph'));
  return Response.json({message:{content:JSON.stringify({reply:'你好，可以一起核對本案資料。',factIds:[],uncertain:true})}});
 };
 try{
  room.init(id,'owner',config,undefined,graphFor(CASES.find(c=>c.id==='sale')));
  const event=room.actionV1('owner',mutation(id));assert.ok(parseEvent(JSON.stringify(event)));
  const m={...mutation(id,1,'npc.ask'),targetId:'Witness',text:'你好'};
  const reply=await room.npcV1('owner',m,true);assert.equal(calls,1);assert.ok(parseEvent(JSON.stringify(reply)));
  for(const output of [event,reply,room.outcomeV1('owner',m.requestId)]){
   assert.ok(!JSON.stringify(output).includes('privateGraph'));assert.ok(!JSON.stringify(output).includes('PRIVATE_TIMELINE_CANARY'));
  }
 }finally{globalThis.fetch=original;db.close();}
});
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

test('public NPC roster matches procedure without exposing role knowledge',()=>{
 for(const [caseId,roles] of [['sale',['judge','claimant','counsel','respondent','witness']],['tablet',['judge','prosecutor','counsel','respondent','witness']],['youth-property',['judge','investigator','assistant','juvenile','witness']]]){
  const {room,db}=setup({...config,caseId,respondentAge:caseId.startsWith('youth')?15:20,respondentHearingAge:caseId.startsWith('youth')?15:20});
  try{
   const snapshot=room.snapshotV1('owner',crypto.randomUUID());assert.ok(parseSnapshot(JSON.stringify(snapshot)));
   assert.deepEqual(snapshot.state.npcs.map(n=>n.roleId),roles);
   assert.equal(new Set(snapshot.state.npcs.map(n=>n.npcId)).size,5);
   assert.equal(new Set(snapshot.state.npcs.map(n=>n.seatId)).size,5);
   for(const n of snapshot.state.npcs){
    assert.deepEqual(Object.keys(n).sort(),['npcId','roleId','displayName','seatId','pose','emotion','speakingState','visible','interactable','requestState'].sort());
    assert.equal(n.interactable,true);assert.equal(n.visible,true);
   }
   assert.deepEqual(snapshot.state.npcs.map(n=>n.displayName),room.get('owner').view.npcs.map(n=>n.name));
  }finally{db.close();}
 }
});

test('observer and completed/late stages forbid conversation in both projection and RPC',async()=>{
 for(const change of [{role:'observer'},{stage:4},{completed:true}]){
  const {room,db}=setup(change.role?{...config,role:change.role}:config);
  try{
   if(!change.role){const state=JSON.parse(db.prepare('SELECT body FROM state').get().body);Object.assign(state,change);state.version++;db.prepare('UPDATE state SET body=?').run(JSON.stringify(state));}
   const snapshot=room.snapshotV1('owner',crypto.randomUUID());
   assert.ok(snapshot.state.npcs.every(n=>!n.interactable));
   assert.equal((await room.npc('owner','Witness',{requestId:crypto.randomUUID(),version:snapshot.stateVersion,text:'你好'},false)).status,409);
   assert.equal(db.prepare('SELECT count(*) AS n FROM npc_requests').get().n,0);
  }finally{db.close();}
 }
});

test('RPC rejects unknown NPC and malformed questions before storing reservations',async()=>{
 const {room,db}=setup();try{
  const input={requestId:crypto.randomUUID(),version:0,text:'你好'};
  assert.equal((await room.npc('owner','Unknown',input,false)).status,400);
  assert.equal((await room.npc('owner','Witness',{...input,text:''},false)).status,400);
  assert.equal(db.prepare('SELECT count(*) AS n FROM npc_requests').get().n,0);
 }finally{db.close();}
});

test('legacy empty cast resumes through one checkpoint without rewriting history or procedure',()=>{
 const {room,db}=setup();try{
  const event=room.events('owner',-1).events[0];event.snapshot.state.npcs=[];
  db.prepare('UPDATE court_events SET body=? WHERE version=0').run(JSON.stringify(event));
  assert.equal(room.snapshotV1('other',crypto.randomUUID()).status,404);
  assert.equal(room.get('owner').view.version,0);
  const before=JSON.parse(db.prepare('SELECT body FROM state').get().body);
  const repaired=room.snapshotV1('owner',crypto.randomUUID());
  assert.equal(repaired.state.npcs.length,5);assert.equal(repaired.stateVersion,1);
  assert.ok(parseSnapshot(JSON.stringify(repaired)));
  const after=JSON.parse(db.prepare('SELECT body FROM state').get().body);
  assert.deepEqual({...after,version:before.version,updatedAt:before.updatedAt},before);
  assert.equal(room.snapshotV1('owner',crypto.randomUUID()).eventId,repaired.eventId);
  assert.equal(room.action('owner',{requestId:crypto.randomUUID(),version:0,type:'acknowledge'}).status,409);
  const events=room.events('owner',-1).events;
  assert.equal(events.length,2);assert.deepEqual(events[0],event);assert.equal(events[1].kind,'checkpoint');assert.equal(events[1].snapshot.state.npcs.length,5);
  assert.ok(room.action('owner',{requestId:crypto.randomUUID(),version:1,type:'acknowledge'}).view);
 }finally{db.close();}
});
test('legacy cast repair rolls back on write failure and survives object recreation',()=>{
 const {room,db,ctx,setFail}=setup();try{
  const event=room.events('owner',-1).events[0];event.snapshot.state.npcs=[];
  db.prepare('UPDATE court_events SET body=? WHERE version=0').run(JSON.stringify(event));
  setFail(true);assert.throws(()=>room.snapshotV1('owner',crypto.randomUUID()),/injected journal/);setFail(false);
  assert.equal(room.get('owner').view.version,0);assert.deepEqual(room.events('owner',-1).events,[event]);
  const fixed=room.snapshotV1('owner',crypto.randomUUID());
  const restored=new CourtRoom(ctx,{});
  assert.equal(restored.snapshotV1('owner',crypto.randomUUID()).eventId,fixed.eventId);
  assert.equal(restored.events('owner',-1).events.length,2);
 }finally{db.close();}
});
test('legacy cast refresh does not fence an in-flight NPC reply',async()=>{
 const {room,db,id}=setup();try{
  const event=room.events('owner',-1).events[0];event.snapshot.state.npcs=[];
  db.prepare('UPDATE court_events SET body=? WHERE version=0').run(JSON.stringify(event));
  assert.equal(room.snapshotV1('owner','invalid').status,400);
  const pending=room.npcV1('owner',{...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'},false);
  assert.equal(room.snapshotV1('owner',crypto.randomUUID()).stateVersion,0);
  const result=await pending;assert.equal(result.kind,'npc_utterance');
  assert.equal(room.snapshotV1('owner',crypto.randomUUID()).state.npcs.length,5);
  assert.equal(room.events('owner',-1).events.length,2);
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

test('v1 NPC action commits one event, shares legacy history and returns identical retries',async()=>{
 const {room,db,id}=setup();try{
  const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你看到什麼？'};
  assert.ok(room.snapshotV1('owner',crypto.randomUUID()).state.allowedActions.some(a=>a.actionId==='npc.ask'&&a.requiredTarget==='npc'));
  const first=room.npcV1('owner',m,false);
  assert.equal((await room.npcV1('owner',m,false)).status,202);
  assert.equal((await room.npcV1('owner',{...m,text:'changed'},false)).status,409);
  const event=await first;assert.ok(parseEvent(JSON.stringify(event)));assert.equal(event.kind,'npc_utterance');
  assert.deepEqual(await room.npcV1('owner',m,false),event);assert.deepEqual(room.outcomeV1('owner',m.requestId),event);
  assert.equal(room.get('owner').view.npcHistory.length,1);assert.equal(room.events('owner',-1).events.length,2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM court_v1_npc_pending').get().n,0);
 }finally{db.close();}
});
test('v1 NPC expiry survives recreation and fences late provider completion',async()=>{
 const {room,db,ctx,id}=setup();try{
  const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'};
  const first=room.npcV1('owner',m,false);
  db.prepare('UPDATE court_v1_npc_pending SET created=?').run(Date.now()-26000);
  const restored=new CourtRoom(ctx,{}),cancelled=restored.outcomeV1('owner',m.requestId);
  assert.equal(cancelled.outcome,'not-applied');assert.equal(cancelled.reason,'expired');
  assert.deepEqual(await first,cancelled);assert.deepEqual(await restored.npcV1('owner',m,true),cancelled);
  assert.equal(room.get('owner').view.version,0);assert.equal(room.get('owner').view.npcHistory.length,0);
  assert.equal(room.events('owner',-1).events.length,1);
 }finally{db.close();}
});
test('state change or deletion while NPC awaits never applies an obsolete reply',async()=>{
 for(const remove of [false,true]){
  const {room,db,id}=setup();try{
   const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'};
   const first=room.npcV1('owner',m,false);
   if(remove)room.remove('owner');else room.actionV1('owner',mutation(id));
   const result=await first;
   if(remove){assert.equal(result.status,404);assert.equal(db.prepare('SELECT count(*) AS n FROM court_v1_npc_pending').get().n,0);}
   else {assert.equal(result.reason,'state-changed');assert.equal(room.get('owner').view.version,1);assert.equal(room.events('owner',-1).events.length,2);}
  }finally{db.close();}
 }
});
test('request IDs cannot be repurposed across legacy/v1 action and NPC namespaces',async()=>{
 const kinds=['legacy-action','v1-action','legacy-npc','v1-npc'];
 for(const firstKind of kinds)for(const secondKind of kinds.filter(k=>k!==firstKind)){
  const {room,db,id}=setup();try{
   const requestId=crypto.randomUUID(),key=crypto.randomUUID();
   const invoke=(kind,version,stage)=>{
    const action=stage===0?'acknowledge':'speak',text=stage===0?'':'請核對本案證據';
    if(kind==='legacy-action')return room.action('owner',{requestId,version,type:action,...(text?{text}:{})});
    if(kind==='v1-action')return room.actionV1('owner',{...mutation(id,version,action),requestId,idempotencyKey:key,text});
    if(kind==='legacy-npc')return room.npc('owner','Witness',{requestId,version,text:'你好'},false);
    return room.npcV1('owner',{...mutation(id,version,'npc.ask'),requestId,idempotencyKey:key,targetId:'Witness',text:'你好'},false);
   };
   const first=await invoke(firstKind,0,0);assert.equal(first.status,undefined);
   const before=room.get('owner').view.version,events=room.events('owner',-1).events.length;
   const reused=await invoke(secondKind,before,firstKind.endsWith('action')?1:0);
   assert.equal(reused.status,409,`${firstKind} -> ${secondKind}`);
   assert.equal(room.get('owner').view.version,before);assert.equal(room.events('owner',-1).events.length,events);
   assert.deepEqual(await invoke(firstKind,0,0),first,'original route retry remains recoverable');
  }finally{db.close();}
 }
});
test('pending NPC IDs fence legacy actions before provider completion',async()=>{
 for(const versioned of [false,true]){
  const {room,db,id}=setup();try{
   const requestId=crypto.randomUUID();
   const pending=versioned?room.npcV1('owner',{...mutation(id,0,'npc.ask'),requestId,targetId:'Witness',text:'你好'},false):
    room.npc('owner','Witness',{requestId,version:0,text:'你好'},false);
   const action=room.action('owner',{requestId,version:0,type:'acknowledge'});
   const result=await pending;
   assert.equal(action.status,409);assert.equal(result.status,undefined);assert.equal(room.get('owner').view.version,1);
  }finally{db.close();}
 }
});
test('v1 NPC has owner, input, ID collision and legacy bypass guards',async()=>{
 const {room,db,id}=setup();try{
  const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'};
  assert.equal((await room.npcV1('other',m,false)).status,404);
  assert.equal((await room.npcV1('owner',{...m,targetId:'Fake'},false)).status,400);
  const first=room.npcV1('owner',m,false);
  assert.equal(room.actionV1('owner',{...m,actionId:'acknowledge',targetId:'',text:''}).status,409);
  assert.equal((await room.npc('owner','Witness',{requestId:m.requestId,version:0,text:'你好'},false)).status,409);
  assert.equal(room.outcomeV1('other',m.requestId).status,404);
  await first;
 }finally{db.close();}
});
test('v1 NPC transactional failure preserves reservation but no partial state or reply',async()=>{
 const {room,db,id,setFail}=setup();try{
  const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'};setFail(true);
  await assert.rejects(room.npcV1('owner',m,false),/journal write failure/);setFail(false);
  assert.equal(room.get('owner').view.version,0);assert.equal(room.get('owner').view.npcHistory.length,0);
  assert.equal(room.events('owner',-1).events.length,1);
  assert.equal((await room.npcV1('owner',m,false)).status,202);
  db.prepare('UPDATE court_v1_npc_pending SET created=?').run(Date.now()-26000);
  assert.equal(room.outcomeV1('owner',m.requestId).outcome,'not-applied');
 }finally{db.close();}
});
test('v1 concurrent retries and outcome reads call configured provider once',async()=>{
 const {room,db,id}=setup(config,stageEnv);
 const original=globalThis.fetch;let calls=0,resolveProvider;const entered=gate();
 globalThis.fetch=()=>{calls++;return new Promise(resolve=>{resolveProvider=resolve;entered.resolve();});};
 try{
  const m={...mutation(id,0,'npc.ask'),targetId:'Witness',text:'你好'};
  const first=room.npcV1('owner',m,true);await entered.promise;
  assert.equal(calls,1);assert.equal((await room.npcV1('owner',m,true)).status,202);assert.equal(room.outcomeV1('owner',m.requestId).status,202);
  resolveProvider(Response.json({message:{content:JSON.stringify({reply:'你好，可以一起核對本案資料。',factIds:[],uncertain:true})}}));
  const event=await first;assert.ok(parseEvent(JSON.stringify(event)));assert.match(event.text,/你好/);
  assert.deepEqual(await room.npcV1('owner',m,true),event);assert.equal(calls,1);
 }finally{globalThis.fetch=original;db.close();}
});
test('transport recovers committed NPC text after lost response, without another model request',async()=>{
 const {room,db,id}=setup();let posts=0;
 try{
  const transport=new CourtTransport({origin:'https://court.test',csrf:()=> 'test',fetchImpl:async(url,o)=>{
   const u=new URL(url);let result;
   if(o.method==='POST'){posts++;await room.npcV1('owner',JSON.parse(o.body),false);throw Error('lost response');}
   result=u.pathname.includes('/requests/')?room.outcomeV1('owner',u.pathname.split('/').at(-1)):room.snapshotV1('owner',u.searchParams.get('requestId'));
   return Response.json(result,{status:result.status||200});
  }});
  transport.bind(id,'sale');await transport.refresh();assert.equal(await transport.act('npc.ask',{targetId:'Witness',text:'你好'}),'network');
  assert.equal(await transport.recoverPending(),'accepted');assert.equal(posts,1);assert.equal(transport.lastDialogue.speaker,'證人');
  assert.equal(transport.pending,null);transport.clear();assert.equal(transport.lastDialogue,null);
 }finally{db.close();}
});
