import {copyTrace,type TraceContext} from './trace-context';
import type {AiFeature} from './ai-outcome';

export type PipelineStep='retrieval'|'reranker'|'validator';
export interface PipelineTraceRecord extends TraceContext {
  event:'ai.pipeline.completed';spanId:string;feature:AiFeature;step:PipelineStep;
  timestamp:string;latencyMs:number;
  outcome:'accepted'|'rejected'|'exception'|'unclassified';
}

/** Server-only hook. Never accept step/feature/classifier from request JSON.
 * No result, exception, document ID, citation, prompt or arbitrary attributes
 * are serialized. Classification is observational and never authorizes commit.
 * Missing context preserves old callers; instrumentation never retries work.
 */
export async function observePipelineStep<T>(context:TraceContext|undefined,feature:AiFeature,step:PipelineStep,
  operation:()=>T|Promise<T>,classify:(result:T)=>'accepted'|'rejected',
  emit:(record:PipelineTraceRecord)=>void=r=>console.log(JSON.stringify(r))):Promise<T>{
  const trace=copyTrace(context);
  if(!trace)return operation();
  const start=performance.now();
  const record:PipelineTraceRecord={...trace,event:'ai.pipeline.completed',
    spanId:crypto.randomUUID().replaceAll('-','').slice(0,16),feature,step,
    timestamp:new Date().toISOString(),latencyMs:0,outcome:'exception'};
  try{
    const result=await operation();
    // A failing or unexpected classifier must not change the domain result,
    // nor print private exception text into the structured outcome.
    record.outcome='unclassified';
    try{const outcome=classify(result);if(outcome==='accepted'||outcome==='rejected')record.outcome=outcome;}catch{/* keep unclassified */}
    return result;
  }finally{
    const elapsed=performance.now()-start;
    record.latencyMs=Number.isFinite(elapsed)?Math.max(0,Math.round(elapsed)):0;
    try{emit(record);}catch{/* Do not turn a committed result into a retry. */}
  }
}
