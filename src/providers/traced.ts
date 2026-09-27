import type {LLMProvider,ProviderErrorCode} from './contracts';
import {copyTrace,type TraceContext} from '../trace-context';
import type {AiFeature} from '../ai-outcome';

const codes:readonly ProviderErrorCode[]=['NOT_CONFIGURED','INVALID_INPUT','CANCELLED','TIMEOUT','NETWORK','QUOTA',
  'PROVIDER_AUTH','MODEL_NOT_FOUND','UPSTREAM','RESPONSE_TOO_LARGE','INVALID_ENCODING','RESPONSE_FORMAT',
  'OUTPUT_TRUNCATED','EMPTY_CONTENT','ADMISSION_DENIED','ADMISSION_UNAVAILABLE'];
const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:null;
const label=(value:string)=>/^[A-Za-z0-9_.:/-]{1,96}$/.test(value)?value:'unidentified';
export interface ProviderTraceRecord extends TraceContext {
  event:'ai.provider.completed';
  spanId:string;
  feature:AiFeature;
  phase:'governed-request'|'provider-call';
  provider:string;
  model:string;
  timestamp:string;
  latencyMs:number;
  outcome:'success'|'failure'|'exception';
  errorCode:ProviderErrorCode|'INTERNAL_ERROR'|null;
  inputTokens:number|null;
  outputTokens:number|null;
  costEstimate:null;
}
/** No serialization of input, output text, errors or caller-owned identifiers.
 * This observes transport proposals, not domain validation or legal correctness.
 * A sink outage must not alter a result or replay a possibly charged request.
 */
export function traceProvider(provider:LLMProvider,feature:AiFeature,phase:ProviderTraceRecord['phase'],
  context?:TraceContext,emit:(record:ProviderTraceRecord)=>void=r=>console.log(JSON.stringify(r))):LLMProvider {
  const trace=copyTrace(context);
  if(!trace)return provider;
  return {contractVersion:provider.contractVersion,id:provider.id,model:provider.model,
    async generate(input,options){
      const start=performance.now();
      const record:ProviderTraceRecord={...trace,event:'ai.provider.completed',spanId:crypto.randomUUID().replaceAll('-','').slice(0,16),
        feature,phase,provider:label(provider.id),model:label(provider.model),timestamp:new Date().toISOString(),latencyMs:0,
        outcome:'exception',errorCode:'INTERNAL_ERROR',inputTokens:null,outputTokens:null,costEstimate:null};
      try{
        const result=await provider.generate(input,options);
        record.outcome=result.ok?'success':'failure';
        record.errorCode=result.ok?null:codes.includes(result.code)?result.code:'INTERNAL_ERROR';
        // Only the inner adapter reports usage, never double-count queue spans.
        if(result.ok&&phase==='provider-call'){record.inputTokens=count(result.value.usage?.inputTokens);record.outputTokens=count(result.value.usage?.outputTokens);}
        return result;
      }finally{
        const elapsed=performance.now()-start;
        record.latencyMs=Number.isFinite(elapsed)?Math.max(0,Math.round(elapsed)):0;
        try{emit(record);}catch{/* Observability must not change inference semantics. */}
      }
    }};
}
