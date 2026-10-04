import {copyTrace,type TraceContext} from './trace-context';
export interface CourtActionTrace extends TraceContext {
  event:'court.action.completed';spanId:string;interface:'legacy'|'versioned';
  timestamp:string;latencyMs:number;status:number;
}
/** Synchronous by design: never introduce await between validation and commit.
 * Trace only the status, not the request/result, session ID or exception text.
 * A successful cached read is 200 too; this is not a unique-mutation counter.
 */
export function observeCourtAction<T>(context:TraceContext|undefined,api:'legacy'|'versioned',
  operation:()=>T,emit:(record:CourtActionTrace)=>void=r=>console.log(JSON.stringify(r))):T{
  const trace=copyTrace(context);if(!trace)return operation();
  const started=performance.now();
  const record:CourtActionTrace={...trace,event:'court.action.completed',
    spanId:crypto.randomUUID().replaceAll('-','').slice(0,16),interface:api,
    timestamp:new Date().toISOString(),latencyMs:0,status:500};
  try{
    const result=operation();
    const status=result&&typeof result==='object'?Object.getOwnPropertyDescriptor(result,'status')?.value:undefined;
    record.status=status===undefined?200:Number.isInteger(status)&&status>=400&&status<=599?status:500;
    return result;
  }finally{
    const elapsed=performance.now()-started;
    record.latencyMs=Number.isFinite(elapsed)?Math.max(0,Math.round(elapsed)):0;
    try{emit(record);}catch{/* Logging must never trigger a replay of committed work. */}
  }
}
