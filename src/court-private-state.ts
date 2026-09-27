import {CASES,RULE_VERSION,PROCEDURAL_REQUESTS,validateConfig,type CourtConfig,type CourtState,type CaseTemplate} from './court-rules';
import {checkCaseReachability} from './court-reachability';
import {parseBoundCourtGraph} from './court-graph';

const id=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
const text=(v:unknown,max=12000,min=1):v is string=>typeof v==='string'&&v.length>=min&&v.length<=max;
const integer=(v:unknown,max=Number.MAX_SAFE_INTEGER):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=max;
const time=(v:unknown):v is string=>text(v,24,24)&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
function record(v:unknown,required:string[],optional:string[]=[]):v is Record<string,unknown>{
 return !!v&&typeof v==='object'&&!Array.isArray(v)&&required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>required.includes(k)||optional.includes(k));
}
function list<T>(v:unknown,max:number,check:(x:unknown)=>x is T,min=0):v is T[]{return Array.isArray(v)&&v.length>=min&&v.length<=max&&v.every(check);}
function config(v:unknown):v is CourtConfig{
 return record(v,['caseId','role','claimantAge','claimantHearingAge','respondentAge','respondentHearingAge','claimantAid','respondentAid'])&&id(v.caseId)&&
 ['judge','claimant','respondent','claimantCounsel','respondentCounsel','observer','juvenile','assistant'].includes(String(v.role))&&
 ['claimantAge','claimantHearingAge','respondentAge','respondentHearingAge'].every(k=>integer(v[k],90)&&Number(v[k])>=7)&&
 ['claimantAid','respondentAid'].every(k=>['none','private','legalAid','appointed'].includes(String(v[k])));
}
function template(v:unknown):v is CaseTemplate{
 return record(v,['id','title','procedure','summary','facts','evidence','question','answers','correct','explanation','mandatory','aidApproved'])&&
 id(v.id)&&text(v.title,160)&&['civil','criminal','juvenile'].includes(String(v.procedure))&&text(v.summary)&&text(v.question)&&text(v.explanation)&&
 list(v.facts,64,(x):x is string=>text(x),1)&&list(v.answers,8,(x):x is string=>text(x),2)&&integer(v.correct,7)&&
 typeof v.mandatory==='boolean'&&typeof v.aidApproved==='boolean'&&list(v.evidence,16,(x):x is CaseTemplate['evidence'][number]=>
 record(x,['id','title','text'])&&id(x.id)&&text(x.title,160)&&text(x.text),1);
}
// Detach only bounded JSON data. Never invoke a toJSON hook or property getter.
function copyData(value:unknown):unknown{
 let nodes=0,bytes=0;
 const copy=(v:unknown,depth:number):unknown=>{
  if(++nodes>10000||depth>12)throw Error('bounds');
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isSafeInteger(v))throw Error('number');return v;}
  if(typeof v==='string'){
   if(v.length>12000||(bytes+=new TextEncoder().encode(v).length)>1048576)throw Error('bounds');
   for(let i=0;i<v.length;i++){const n=v.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const low=v.charCodeAt(++i);if(!(low>=0xdc00&&low<=0xdfff))throw Error('unicode');}else if(n>=0xdc00&&n<=0xdfff)throw Error('unicode');}
   return v;
  }
  if(!v||typeof v!=='object')throw Error('type');
  const array=Array.isArray(v),prototype=Object.getPrototypeOf(v);
  if(array?prototype!==Array.prototype:prototype!==Object.prototype&&prototype!==null)throw Error('prototype');
  const keys=Reflect.ownKeys(v);if(keys.length>(array?101:33))throw Error('bounds');
  const result:Record<string,unknown>|unknown[]=array?[]:Object.create(null);
  for(const key of keys){
   if(array&&key==='length')continue;
   if(typeof key!=='string'||key.length>80||['__proto__','prototype','constructor'].includes(key))throw Error('key');
   const d=Object.getOwnPropertyDescriptor(v,key);if(!d||!('value' in d)||!d.enumerable)throw Error('accessor');
   if(array){if(key!==String((result as unknown[]).length))throw Error('array');(result as unknown[]).push(copy(d.value,depth+1));}
   else (result as Record<string,unknown>)[key]=copy(d.value,depth+1);
  }
  if(array&&(result as unknown[]).length!==v.length)throw Error('sparse');
  return result;
 };
 return copy(value,0);
}

/** Validate a private snapshot, never authorize a restore. The expected owner
 * and session must come from a trusted archive/target, not the uploaded body.
 * Unknown rules require a separate version-specific migration; no best guess.
 */
export function parsePrivateCourtState(input:unknown,expected:{sessionId:string;owner:string}):CourtState|null{
 try{
  const v=copyData(input);
  if(!record(v,['id','owner','config','stage','version','reviewed','statements','attempts','completed','feedback','createdAt','updatedAt','ruleVersion'],['rulings','generatedCase','generationVersion','privateGraph'])||
   !text(v.id,36,36)||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.id)||
   !text(v.owner,160)||!/^[A-Za-z0-9_.:-]+$/.test(v.owner)||v.id!==expected.sessionId||v.owner!==expected.owner||
   !config(v.config)||validateConfig(v.config)!==null||!integer(v.stage,5)||!integer(v.version)||!integer(v.attempts)||
   !list(v.reviewed,16,id)||new Set(v.reviewed).size!==v.reviewed.length||
   !list(v.statements,100,(x):x is string=>text(x,600,2)&&x.trim().length>=2)||
   typeof v.completed!=='boolean'||!text(v.feedback,5000,0)||!time(v.createdAt)||!time(v.updatedAt)||v.updatedAt<v.createdAt||v.ruleVersion!==RULE_VERSION)return null;
  if(Object.hasOwn(v,'rulings')&&(!list(v.rulings,2,id)||new Set(v.rulings).size!==v.rulings.length))return null;
  if(Object.hasOwn(v,'generationVersion')&&!text(v.generationVersion,80))return null;
  if(Object.hasOwn(v,'generatedCase')&&(!template(v.generatedCase)||!checkCaseReachability(v.generatedCase,v.config.caseId).ok))return null;
  if(Object.hasOwn(v,'generationVersion')&&!Object.hasOwn(v,'generatedCase'))return null;
  const s:CourtState={id:v.id,owner:v.owner,config:v.config,stage:v.stage,version:v.version,
   reviewed:v.reviewed,statements:v.statements,attempts:v.attempts,completed:v.completed,
   feedback:v.feedback,createdAt:v.createdAt,updatedAt:v.updatedAt,ruleVersion:v.ruleVersion};
  if(Object.hasOwn(v,'rulings'))s.rulings=v.rulings as string[]; // validated above
  if(Object.hasOwn(v,'generatedCase'))s.generatedCase=v.generatedCase as CaseTemplate;
  if(Object.hasOwn(v,'generationVersion'))s.generationVersion=v.generationVersion as string;
  const t=s.generatedCase||CASES.find(c=>c.id===s.config.caseId)!;
  if(s.completed!==(s.stage===5)||s.version<s.stage||s.attempts>s.version||s.reviewed.some(ref=>!t.evidence.some(e=>e.id===ref))||
    (s.rulings||[]).some(ref=>!PROCEDURAL_REQUESTS.some(r=>r.id===ref)))return null;
  if(s.config.role==='observer'){
   if(s.statements.length||s.reviewed.length||(s.rulings||[]).length||s.attempts)return null;
  }else{
   const minimumVersion=s.stage+s.reviewed.length+(s.rulings||[]).length+s.attempts-(s.completed?1:0);
   if(s.version<minimumVersion)return null;
   const statements=s.stage>=4?2:s.stage>=2?1:0;
   if(s.statements.length!==statements||s.stage<2&&(s.reviewed.length||(s.rulings||[]).length)||
    s.stage<4&&s.attempts||s.stage===5&&s.attempts===0||s.config.role!=='judge'&&(s.rulings||[]).length||
    s.stage>=3&&(s.reviewed.length!==t.evidence.length||s.config.role==='judge'&&(s.rulings||[]).length!==PROCEDURAL_REQUESTS.length))return null;
  }
  if(Object.hasOwn(v,'privateGraph')){const graph=parseBoundCourtGraph(v.privateGraph,s);if(!graph)return null;s.privateGraph=graph;}
  // Return ordinary detached JSON objects, suitable for internal RPC tooling.
  return JSON.parse(JSON.stringify(s)) as CourtState;
 }catch{return null;}
}
