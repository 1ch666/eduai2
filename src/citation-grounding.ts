// Server-side grounding check for model answers. The model may only point at
// IDs the server retrieved or projected; it never writes a citation itself.
// Passing this check proves referential grounding, not that the prose is correct.

export type Uncertainty='low'|'medium'|'high';
export type GroundedAnswer={answer:string;citationIds:string[];factIds:string[];uncertainty:Uncertainty;fallbackUsed:boolean};
export type GroundingContext={
 retrieved:readonly {chunkId:string;article:string}[]; // this request's retrieval result only
 allowedFactIds:readonly string[];                     // this role's projection only
};
export type GroundingCode='SCHEMA'|'MARKUP'|'UNKNOWN_CITATION'|'UNKNOWN_FACT'|'UNGROUNDED'|'UNSUPPORTED_ARTICLE';
export type GroundingResult={ok:true;value:GroundedAnswer}|{ok:false;code:GroundingCode};

const DIGITS:Record<string,number>={零:0,〇:0,一:1,二:2,兩:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};
const UNITS:Record<string,number>={十:10,百:100,千:1000};
export function chineseNumber(text:string):number|null{
 if(/^\d+$/.test(text))return Number(text);
 let total=0,digit=0;
 for(const ch of text){
  if(ch in DIGITS)digit=DIGITS[ch];
  else if(ch in UNITS){total+=(digit||1)*UNITS[ch];digit=0;}
  else return null;
 }
 return total+digit;
}
const NUM='[0-9零〇一二兩三四五六七八九十百千]+';
// 「第236條之1」「第 236-1 條」「第二百三十六條之一」 -> "236-1"
const ARTICLE=new RegExp(`第\\s*(${NUM})(?:\\s*-\\s*(${NUM}))?\\s*條(?:之(${NUM}))?`,'g');
export function mentionedArticles(text:string):string[]{
 return [...text.matchAll(ARTICLE)].map(m=>{
  const main=chineseNumber(m[1]),sub=m[2]??m[3];
  return main===null?'?':sub===undefined?String(main):`${main}-${chineseNumber(sub)??'?'}`;
 });
}
const articleNo=(label:string)=>mentionedArticles(label)[0]??null;

const plainObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
 [Object.prototype,null].includes(Object.getPrototypeOf(v));
const ids=(v:unknown):v is string[]=>Array.isArray(v)&&v.length<=5&&v.every(x=>typeof x==='string'&&x.length<=80)&&new Set(v).size===v.length;

export function validateGroundedAnswer(value:unknown,ctx:GroundingContext):GroundingResult{
 // The model cannot claim fallbackUsed or add fields such as verdict/stage.
 if(!plainObject(value)||Object.keys(value).sort().join()!=='answer,citationIds,factIds,uncertainty')return {ok:false,code:'SCHEMA'};
 const {answer,citationIds,factIds,uncertainty}=value;
 if(typeof answer!=='string'||!answer.trim()||answer.length>800||!ids(citationIds)||!ids(factIds)||
  !['low','medium','high'].includes(uncertainty as string))return {ok:false,code:'SCHEMA'};
 if(/[<>]|https?:|javascript:/i.test(answer))return {ok:false,code:'MARKUP'};
 const retrieved=new Map(ctx.retrieved.map(c=>[c.chunkId,c]));
 if(citationIds.some(id=>!retrieved.has(id)))return {ok:false,code:'UNKNOWN_CITATION'};
 if(factIds.some(id=>!ctx.allowedFactIds.includes(id)))return {ok:false,code:'UNKNOWN_FACT'};
 if(uncertainty!=='high'&&!citationIds.length&&!factIds.length)return {ok:false,code:'UNGROUNDED'};
 // Any article number in the prose must be one of the cited chunks.
 const cited=new Set(citationIds.map(id=>articleNo(retrieved.get(id)!.article)));
 if(mentionedArticles(answer).some(a=>!cited.has(a)))return {ok:false,code:'UNSUPPORTED_ARTICLE'};
 return {ok:true,value:{answer:answer.trim(),citationIds:[...citationIds],factIds:[...factIds],uncertainty:uncertainty as Uncertainty,fallbackUsed:false}};
}

export function groundedFallback():GroundedAnswer{
 return {answer:'目前找不到可以引用的法條或案件資料，無法可靠回答。請改問更具體的問題，或查閱官方法規資料庫。',citationIds:[],factIds:[],uncertainty:'high',fallbackUsed:true};
}
