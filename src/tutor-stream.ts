import type {LLMProvider, ChatInput} from './providers/contracts';

/** Backpressure reaches the provider. Cancelling the response aborts inference.
 * No retries: a lost stream remains a charged attempt under existing admission. */
export function tutorStream(provider:LLMProvider,input:ChatInput,request:Request,headers:Headers,
  metadata:Record<string,unknown>):Response {
  const abort=new AbortController();
  const signal=AbortSignal.any([request.signal,abort.signal]);
  const encoder=new TextEncoder();
  const channel=new TransformStream<Uint8Array,Uint8Array>();
  const writer=channel.writable.getWriter();
  void writer.closed.catch(()=>abort.abort());
  const send=(type:string,data:unknown)=>writer.write(encoder.encode(JSON.stringify({type,...(data as object)})+'\n'));
  // The readable response owns this pipeline; every rejection is observed.
  const run=async()=>{
    try{
      const {aiOutcome: _pendingOutcome,...pendingMetadata}=metadata;
      await send('meta',pendingMetadata);
      const result=await provider.generate(input,{timeoutMs:50000,signal,onText:text=>send('delta',{text})});
      if(result.ok)await send('done',{answer:result.value.text,...metadata});
      else await send('error',{code:result.code,error:'回答未完成，請勿將部分文字視為完整答案。'});
      await writer.close();
    }catch{abort.abort();try{await writer.abort();}catch{/* disconnected */}}
    finally{abort.abort();}
  };
  void run().catch(()=>abort.abort());
  headers.set('Content-Type','application/x-ndjson; charset=utf-8');
  headers.set('Cache-Control','no-store, no-transform');
  return new Response(channel.readable,{headers});
}
