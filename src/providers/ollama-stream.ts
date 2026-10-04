import type {ProviderContext, ProviderResult, TokenUsage} from './contracts';

/** Incremental NDJSON decoding; thinking/tool calls never cross this boundary. */
export async function readOllamaStream(body:ReadableStream<Uint8Array>|null, context:ProviderContext):
Promise<ProviderResult<{text:string;usage:TokenUsage}>> {
  if(!body)return {ok:false,code:'EMPTY_CONTENT'};
  const reader=body.getReader(), decoder=new TextDecoder('utf-8',{fatal:true});
  let buffer='', text='', bytes=0, ended=false;
  let usage:TokenUsage={inputTokens:null,outputTokens:null};
  const count=(n:unknown)=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=0?n:null;
  const line=async(raw:string)=>{
    if(!raw.trim())return;
    if(ended)throw Error('RESPONSE_FORMAT');
    const item=JSON.parse(raw);
    if(!item||typeof item!=='object'||typeof item.done!=='boolean')throw Error('RESPONSE_FORMAT');
    if(item.error)throw Error('UPSTREAM');
    if(item.done_reason==='length')throw Error('OUTPUT_TRUNCATED');
    const delta=item.message?.content;
    if(delta!==undefined&&typeof delta!=='string')throw Error('RESPONSE_FORMAT');
    if(delta){
      text+=delta;
      if(text.length>5000)throw Error('RESPONSE_TOO_LARGE');
      if(context.signal?.aborted)throw Error('CANCELLED');
      await context.onText?.(delta);
    }
    if(item.done){ended=true;usage={inputTokens:count(item.prompt_eval_count),outputTokens:count(item.eval_count)};}
  };
  try{
    while(true){
      if(context.signal?.aborted)throw Error('CANCELLED');
      const part=await reader.read();
      if(part.done){buffer+=decoder.decode();break;}
      bytes+=part.value.byteLength;
      if(bytes>(context.maxResponseBytes??262144))throw Error('RESPONSE_TOO_LARGE');
      buffer+=decoder.decode(part.value,{stream:true});
      let end:number;
      while((end=buffer.indexOf('\n'))>=0){const raw=buffer.slice(0,end);buffer=buffer.slice(end+1);await line(raw);}
    }
    await line(buffer);
    if(!ended)return {ok:false,code:'RESPONSE_FORMAT'};
    return text.trim()?{ok:true,value:{text:text.trim(),usage}}:{ok:false,code:'EMPTY_CONTENT'};
  }catch(error){
    const code=error instanceof Error?error.message:'';
    if(code==='RESPONSE_TOO_LARGE'||code==='OUTPUT_TRUNCATED'||code==='CANCELLED'||code==='UPSTREAM')return {ok:false,code};
    return {ok:false,code:'RESPONSE_FORMAT'};
  }finally{try{await reader.cancel();}catch{/* Do not expose upstream errors. */}reader.releaseLock();}
}
