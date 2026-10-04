import {readTextWithLimit} from '../http';
import {readOllamaStream} from './ollama-stream';
import type {ChatInput, LLMProvider, ProviderContext, ProviderErrorCode, ProviderResult, TokenUsage} from './contracts';

type Answer = {text: string; usage: TokenUsage};
const fail = (code: ProviderErrorCode): ProviderResult<Answer> => ({ok:false,code});
const record = (value: unknown): value is Record<string,unknown> => Boolean(value) && typeof value==='object' && !Array.isArray(value);
const count = (value: unknown): number | null => typeof value==='number' && Number.isSafeInteger(value) && value>=0 ? value : null;
function validInput(input: ChatInput, context: ProviderContext): boolean {
  if (!input || !context || !Number.isInteger(context.timeoutMs) || context.timeoutMs<1 || context.timeoutMs>60000 ||
    !Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens<1 || input.maxOutputTokens>8192 ||
    !Number.isFinite(input.temperature) || input.temperature<0 || input.temperature>2 ||
    !['text','json'].includes(input.output) || !Array.isArray(input.messages) || !input.messages.length || input.messages.length>32) return false;
  if (context.maxResponseBytes!==undefined && (!Number.isInteger(context.maxResponseBytes) || context.maxResponseBytes<1 || context.maxResponseBytes>65536)) return false;
  let total=0;
  for (const m of input.messages) {
    if (!m || !['system','user','assistant'].includes(m.role) || typeof m.content!=='string') return false;
    total+=m.content.length;
    if (total>32768) return false;
  }
  return true;
}

/** Existing server-side provider, isolated from domain logic. The closure keeps
 * its credential out of serializable metadata. No retry, redirect or fallback
 * to a second vendor/model is permitted here. Fetch is injectable for tests.
 */
export function createOllamaProvider(
  config: {apiKey?: string; model: string; thinking?: false | 'low'},
  transport: typeof fetch = fetch
): LLMProvider {
  const apiKey=config.apiKey, model=config.model, thinking=config.thinking ?? (model.startsWith('gpt-oss')?'low':false);
  return {
    contractVersion:1, id:'ollama', model,
    async generate(input: ChatInput, context: ProviderContext): Promise<ProviderResult<Answer>> {
      if (!apiKey) return fail('NOT_CONFIGURED');
      if (!validInput(input,context)) return fail('INVALID_INPUT');
      if (context.signal?.aborted) return fail('CANCELLED');
      const deadline=AbortSignal.timeout(context.timeoutMs);
      const maxBytes=context.maxResponseBytes ?? (context.onText&&input.output==='text'?262144:65536);
      const signal=context.signal ? AbortSignal.any([context.signal,deadline]) : deadline;
      const interrupted=(error:unknown): ProviderErrorCode | null => {
        if (context.signal?.aborted) return 'CANCELLED';
        if (deadline.aborted || error instanceof Error && ['TimeoutError','AbortError'].includes(error.name)) return 'TIMEOUT';
        return null;
      };
      let upstream:Response;
      try {
        upstream=await transport('https://ollama.com/api/chat',{
          method:'POST',redirect:'manual',signal,
          headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json',Accept:'application/json'},
          body:JSON.stringify({model,stream:!!context.onText&&input.output==='text',think:thinking,
            messages:input.messages.map(({role,content})=>({role,content})),
            ...(input.output==='json'?{format:'json'}:{}),
            options:{temperature:input.temperature,num_predict:input.maxOutputTokens}})
        });
      } catch(error) { return fail(interrupted(error) ?? 'NETWORK'); }
      // A rejected HTTP body is neither useful nor safe to expose to a learner.
      if (!upstream.ok) {
        try { await upstream.body?.cancel(); } catch { /* no payload logging */ }
        return fail(upstream.status===429?'QUOTA':[401,403].includes(upstream.status)?'PROVIDER_AUTH':upstream.status===404?'MODEL_NOT_FOUND':'UPSTREAM');
      }
      if (Number(upstream.headers.get('content-length') || 0)>maxBytes) {
        try { await upstream.body?.cancel(); } catch { /* no payload logging */ }
        return fail('RESPONSE_TOO_LARGE');
      }
      let result:unknown;
      if(context.onText&&input.output==='text'){
        const streamed=await readOllamaStream(upstream.body,{...context,signal});
        return signal.aborted?fail(interrupted(null)??'TIMEOUT'):streamed;
      }
      try {
        const raw=await readTextWithLimit(upstream.body,maxBytes);
        if (signal.aborted) return fail(interrupted(null) ?? 'TIMEOUT');
        if (raw.tooLarge) return fail('RESPONSE_TOO_LARGE');
        if (raw.invalidEncoding) return fail('INVALID_ENCODING');
        result=JSON.parse(raw.text);
      } catch(error) { return fail(interrupted(error) ?? 'RESPONSE_FORMAT'); }
      if (!record(result)) return fail('RESPONSE_FORMAT');
      if (result.done_reason==='length') return fail('OUTPUT_TRUNCATED');
      const answer=record(result.message)?result.message.content:undefined;
      // Never include thinking/tool_calls/raw upstream data in the public result.
      if (typeof answer!=='string' || !answer.trim()) return fail('EMPTY_CONTENT');
      return {ok:true,value:{text:answer.trim(),usage:{inputTokens:count(result.prompt_eval_count),outputTokens:count(result.eval_count)}}};
    }
  };
}
