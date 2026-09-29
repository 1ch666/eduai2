// Server-drawn random case: legal config generator, AI/library fallback through
// the real Learner.generate path (Node SQLite, mocked DO lifecycle and Ollama).
import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
import {CASES,AGE_LIMITS,rolesFor,validateConfig} from '../src/court-rules.ts';
const load=async entry=>{const b=await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'do-lifecycle',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'do',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export class DurableObject { constructor(ctx,env){this.ctx=ctx;this.env=env;} }'}));}}]});
 return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));};
const {randomCourtConfig,pickBaseTemplate,parseRandomCaseRequest,randomIndex,MAX_RANDOM_CONFIG_ATTEMPTS,RandomConfigError}=await load('src/court-random.ts');
const {CourtRoom,Learner}=await load('src/court.ts');

function storage(){
 const db=new DatabaseSync(':memory:');
 const sql={exec(query,...args){let rows;if(query.trim().startsWith('CREATE')){db.exec(query);rows=[];}else rows=db.prepare(query).all(...args);
  return {toArray:()=>rows,one:()=>{assert.equal(rows.length,1);return rows[0];}};}};
 return {db,ctx:{storage:{sql,transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}},blockConcurrencyWhile:fn=>fn()}};
}
const aiEnv={COURT_AI_ENABLED:'true',OLLAMA_API_KEY:'synthetic-test-key',AI_ADMISSION:{getByName(){return {
 async admit(){return {code:'ACCEPTED',phase:'running',start:true,deadline:Date.now()+60000};},
 async cancel(){return {code:'SETTLED',start:false};},async finish(){return {code:'SETTLED',start:false};}};}}};
const themes=['雨天停車場的刮痕','社團器材的借用登記','網購包裹的簽收','共用冰箱的食物','補習班的遺失外套','租屋處的漏水天花板'];
const draft=(i=0)=>({title:'虛構'+themes[i%themes.length]+'爭議',summary:`甲方與乙方對${themes[i%themes.length]}的經過有不同說法，仍有事實待查。`,
 facts:[`甲方表示${themes[i%themes.length]}發生於第${i+3}週的傍晚。`,`乙方表示當天只經過${['走廊','大門','樓梯','側門','車道','後院'][i%6]}附近。`,'雙方都沒有提出完整的原始紀錄，原因仍待查明。'],
 evidence:[{title:`${['手機','監視器','紙本','群組','筆記','便條'][i%6]}紀錄摘要`,text:`只能確認${['時間','地點','人數','物品','天氣','聲音'][i%6]}的片段內容，不能確認是誰造成結果。`},{title:'第三人轉述',text:`第三人${['聽鄰居','看群組','聽同學','看公告','聽家人','看留言'][i%6]}說過此事，並未親眼看見關鍵經過。`}]});
function mockOllama(reply){
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,init)=>{calls++;return reply(calls,url,init);};
 return {get calls(){return calls;},restore(){globalThis.fetch=original;}};
}
const ollamaJson=value=>Response.json({message:{content:JSON.stringify(value)},done:true,done_reason:'stop'});
const uuid=()=>crypto.randomUUID();
function learner(env=aiEnv){const s=storage();return {...s,learner:new Learner(s.ctx,env)};}
const isAi=t=>t.id.startsWith('ai-')&&t.title.startsWith('[AI虛構] ');
const isLibrary=t=>!t.id.startsWith('ai-')&&t.title.startsWith('[題庫] ');

test('1000 server-drawn configs all pass validateConfig and respect template rules',()=>{
 const seenProcedures=new Set(),seenCases=new Map(),history=[];
 for(let i=0;i<1000;i++){
  const c=randomCourtConfig(history.slice(-30));history.push(c.caseId);
  assert.equal(validateConfig(c),null,JSON.stringify(c));
  const t=CASES.find(t=>t.id===c.caseId),limits=AGE_LIMITS[t.procedure];
  seenProcedures.add(t.procedure);seenCases.set(t.id,(seenCases.get(t.id)||0)+1);
  assert.ok(rolesFor(t.procedure).includes(c.role));
  assert.ok(c.claimantHearingAge>=c.claimantAge&&c.respondentHearingAge>=c.respondentAge);
  for(const age of [c.claimantAge,c.claimantHearingAge,c.respondentAge,c.respondentHearingAge])assert.ok(age>=limits.actMin&&age<=limits.actMax);
  if(t.mandatory)assert.notEqual(c.respondentAid,'none');
  if(!t.aidApproved)assert.ok(c.claimantAid!=='legalAid'&&c.respondentAid!=='legalAid');
  if(t.procedure==='juvenile'){assert.notEqual(c.role,'observer');assert.equal(c.claimantAid,'none');}
  if(c.role==='claimantCounsel')assert.notEqual(c.claimantAid,'none');
  if(c.role==='respondentCounsel'||c.role==='assistant')assert.notEqual(c.respondentAid,'none');
  assert.deepEqual(Object.keys(c).sort(),['caseId','claimantAge','claimantAid','claimantHearingAge','respondentAge','respondentAid','respondentHearingAge','role']);
 }
 for(const p of new Set(CASES.map(t=>t.procedure)))assert.ok(seenProcedures.has(p),p);
 // Balanced draw: every template appears; no template dominates the others.
 assert.equal(seenCases.size,CASES.length);
 for(const n of seenCases.values())assert.ok(Math.abs(n-1000/CASES.length)<=10,JSON.stringify([...seenCases]));
});
test('template draw prefers least-used templates and avoids an immediate repeat',()=>{
 const others=CASES.slice(1).map(t=>t.id);
 for(let i=0;i<50;i++)assert.equal(pickBaseTemplate([...others,...others]).id,CASES[0].id);
 for(let i=0;i<50;i++)assert.notEqual(pickBaseTemplate(CASES.map(t=>t.id)).id,CASES.at(-1).id);
 const counts=new Array(3).fill(0);for(let i=0;i<3000;i++)counts[randomIndex(3)]++;
 for(const n of counts)assert.ok(n>850&&n<1150,String(counts));
});
test('generator never skips validation and stops after the attempt limit',()=>{
 let calls=0;
 assert.throws(()=>randomCourtConfig([],()=>{calls++;return 'rejected';}),e=>e instanceof RandomConfigError&&e.code==='INTERNAL_CONFIG_ERROR');
 assert.equal(MAX_RANDOM_CONFIG_ATTEMPTS,20);
 // Bounded: at most 20 draws of (roles x aid pairs) candidates, no infinite loop.
 assert.ok(calls>0&&calls<=20*6*16,String(calls));
 // Whatever the validator accepts is exactly what gets returned, after a final check.
 const seen=[];const c=randomCourtConfig([],x=>{seen.push(x);return validateConfig(x);});
 assert.equal(seen.at(-1),c);
});
test('random endpoint input accepts only requestId and preferAi',()=>{
 const id=uuid();
 assert.deepEqual(parseRandomCaseRequest({requestId:id}),{requestId:id,preferAi:true});
 assert.deepEqual(parseRandomCaseRequest({requestId:id,preferAi:false}),{requestId:id,preferAi:false});
 for(const extra of [{caseId:'injury'},{procedure:'criminal'},{role:'judge'},{claimantAge:30},{respondentAid:'none'},{owner:'x'},{stage:5}])
  assert.ok('error' in parseRandomCaseRequest({requestId:id,...extra}),JSON.stringify(extra));
 assert.ok('error' in parseRandomCaseRequest({}));assert.ok('error' in parseRandomCaseRequest({requestId:id,preferAi:'yes'}));
});

test('AI success saves an [AI虛構] case on a server-drawn legal config',async()=>{
 const ai=mockOllama(()=>ollamaJson(draft(1)));
 try{
  const {learner:l}=learner();const r=await l.generateRandom(uuid(),true,'owner');
  assert.ok(!('error' in r),JSON.stringify(r));assert.equal(ai.calls,1);
  assert.ok(isAi(r.template));assert.equal(validateConfig(r.config),null);
  const base=CASES.find(t=>t.id===r.config.caseId);
  // Model output cannot change the server-owned structure.
  for(const k of ['procedure','mandatory','aidApproved'])assert.equal(r.template[k],base[k]);
  assert.equal(r.template.answers[r.template.correct],'先釐清資料來源與限制，再比較雙方說法');
 }finally{ai.restore();}
});
for(const [name,reply] of [
 ['provider failure',()=>new Response('upstream broke',{status:500})],
 ['timeout',()=>{throw new DOMException('timed out','TimeoutError');}],
 ['quota',()=>new Response('{}',{status:429})],
 ['invalid JSON from model',()=>ollamaJson({correct:0,verdict:'有罪'})]
])test(`${name} falls back to a [題庫] case of the same drawn template`,async()=>{
 const ai=mockOllama(reply);
 try{
  const {learner:l,db}=learner();const r=await l.generateRandom(uuid(),true,'owner');
  assert.ok(!('error' in r),JSON.stringify(r));assert.ok(isLibrary(r.template),r.template.title);
  assert.equal(r.template.procedure,CASES.find(t=>t.id===r.config.caseId).procedure);
  assert.ok(r.template.id.startsWith(r.config.caseId+'-'));
  // The model really was tried once; the failure is recorded, never retried.
  assert.equal(ai.calls,1);assert.ok(!['SKIP',null].includes(db.prepare('SELECT error FROM generation_attempts').get().error));
 }finally{ai.restore();}
});
test('AI not configured or preferAi=false uses the library without calling a model',async()=>{
 const ai=mockOllama(()=>ollamaJson(draft()));
 try{
  for(const [env,preferAi] of [[{COURT_AI_ENABLED:'false'},true],[{},true],[aiEnv,false]]){
   const {learner:l,db}=learner(env);const r=await l.generateRandom(uuid(),preferAi,'owner');
   assert.ok(isLibrary(r.template));assert.equal(db.prepare('SELECT error FROM generation_attempts').get().error,'SKIP');
  }
  assert.equal(ai.calls,0);
 }finally{ai.restore();}
});
test('duplicate requestId replays the same case without another model call',async()=>{
 const ai=mockOllama(()=>ollamaJson(draft(2)));
 try{
  const {learner:l,db}=learner(),id=uuid();
  const first=await l.generateRandom(id,true,'owner'),again=await l.generateRandom(id,true,'owner');
  assert.equal(ai.calls,1);assert.deepEqual(again,first);
  assert.equal(db.prepare('SELECT count(*) AS n FROM courts').get().n,1);
  assert.equal((await l.generateRandom(id,false,'owner')).status,409);
  // A requestId already used by the template-specific endpoint is not reusable here.
  const other=uuid();await l.generate(other,randomCourtConfig(),'owner');
  assert.equal((await l.generateRandom(other,true,'owner')).status,409);
 }finally{ai.restore();}
});
test('concurrent duplicates never produce two different cases or two model calls',async()=>{
 let release;const gate=new Promise(r=>release=r);
 const ai=mockOllama(async()=>{await gate;return ollamaJson(draft(3));});
 try{
  const {learner:l,db}=learner(),id=uuid();
  const first=l.generateRandom(id,true,'owner'),second=l.generateRandom(id,true,'owner');
  const early=await second;assert.equal(early.status,409);assert.ok(!('id' in early));
  release();const done=await first;assert.ok(isAi(done.template));
  assert.deepEqual(await l.generateRandom(id,true,'owner'),done);
  assert.equal(ai.calls,1);assert.equal(db.prepare('SELECT count(*) AS n FROM generated_requests').get().n,1);
 }finally{ai.restore();}
});
test('a model case too similar to history is not saved as AI',async()=>{
 const ai=mockOllama(()=>ollamaJson(draft(4)));
 try{
  const {learner:l}=learner();
  const first=await l.generateRandom(uuid(),true,'owner');assert.ok(isAi(first.template));
  const second=await l.generateRandom(uuid(),true,'owner');
  assert.equal(ai.calls,2);assert.ok(isLibrary(second.template),second.template.title);
 }finally{ai.restore();}
});
test('deleting a random session keeps its quota reservation and blocks requestId reuse',async()=>{
 const ai=mockOllama(()=>ollamaJson(draft(5)));
 try{
  const {learner:l,db}=learner(),id=uuid();const r=await l.generateRandom(id,true,'owner');
  l.removeCourt(r.id);
  assert.equal(db.prepare('SELECT count(*) AS n FROM random_requests').get().n,0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM generation_attempts').get().n,1);
  assert.equal((await l.generateRandom(id,true,'owner')).status,409);assert.equal(ai.calls,1);
 }finally{ai.restore();}
});

test('random cases (AI and library) run end to end in a CourtRoom',async()=>{
 let n=10;const ai=mockOllama(()=>ollamaJson(draft(n++)));
 try{
  const {learner:l}=learner({COURT_AI_ENABLED:'true',OLLAMA_API_KEY:'k',AI_ADMISSION:aiEnv.AI_ADMISSION});
  const {learner:offline}=learner({COURT_AI_ENABLED:'false'});
  const roles=new Set();let npcAnswered=0;
  for(let i=0;i<24;i++){
   const r=await (i%2?offline:l).generateRandom(uuid(),true,'owner');
   assert.ok(!('error' in r),JSON.stringify(r));roles.add(r.config.role);
   const room=new CourtRoom(storage().ctx,{});
   const created=room.init(r.id,'owner',r.config,r.template);assert.ok(created.view,JSON.stringify(created));
   assert.equal(created.view.title,r.template.title);assert.equal(room.get('someone-else').status,404);
   let view=room.get('owner').view;assert.equal(view.version,0);
   const npc=await room.npc('owner','Witness',{requestId:uuid(),version:view.version,text:'你看到了什麼？'},false);
   if(!npc.error){npcAnswered++;assert.equal(npc.reply.mode,'scripted');view=room.get('owner').view;}
   const act=(type,data={})=>{const p=room.action('owner',{requestId:uuid(),version:view.version,type,...data});assert.ok(p.view,`${type}: ${JSON.stringify(p)}`);view=p.view;};
   for(let guard=0;!view.completed&&guard<40;guard++){
    const [a]=view.actions;
    if(a==='step')act('step');
    else if(a==='acknowledge')act('acknowledge');
    else if(a==='speak')act('speak',{text:'依現有證據說明，仍有待查之處。'});
    else if(a==='answer')act('answer',{answer:r.template.correct});
    else{
     for(const e of view.evidence)if(!view.reviewed.includes(e.id))act('review',{evidenceId:e.id});
     for(const q of view.proceduralRequests.filter(q=>!q.done))act('rule',{rulingId:q.id,decision:q.id==='heard'?'allow':'deny'});
     act('closeEvidence');
    }
   }
   assert.equal(view.completed,true,JSON.stringify(r.config));
   assert.equal(view.reviewed.length,view.config.role==='observer'?0:r.template.evidence.length);
  }
  assert.ok(roles.size>2);assert.ok(npcAnswered>0);
 }finally{ai.restore();}
});
