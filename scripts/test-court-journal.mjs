// Actual Node SQLite transactions; mocked DO lifecycle, NOT workerd integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {parseEvent,parseSnapshot} from '../court/protocol.js';
import {CourtTransport} from '../court/transport.js';
import {CASES,LEGAL_SOURCES} from '../src/court-rules.ts';
const bundle=await build({entryPoints:['src/court.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'do-lifecycle',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
const {CourtRoom,Learner}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const config={caseId:'sale',role:'judge',claimantAge:20,claimantHearingAge:20,respondentAge:20,respondentHearingAge:20,claimantAid:'none',respondentAid:'none'};
const stageEnv={COURT_AI_ENABLED:'true',OLLAMA_API_KEY:'synthetic-test-key',AI_ADMISSION:{getByName(name){
 assert.equal(name,'ollama-account-v1');return {
  async admit(){return {code:'ACCEPTED',phase:'running',start:true,deadline:Date.now()+60000};},
  async cancel(){return {code:'SETTLED',start:false};},async finish(){return {code:'SETTLED',start:false};}
 };
}}};
const gate=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const stageResponse=()=>Response.json({message:{content:JSON.stringify({text:'測試公開程序台詞'})}});
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
  assert.equal(result.cached.mode,'ai-dialogue');
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
  const fallback=room.get('owner').view.turn;
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
  const fallback=room.get('owner').view.turn,first=room.stageDialogue('owner',0,true);
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
   const expected={cached:room.get('owner').view.turn};
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
   const expected={cached:room.get('owner').view.turn};
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
