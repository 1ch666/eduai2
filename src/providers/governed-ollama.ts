import type {AppEnv} from '../env';
import type {LLMProvider} from './contracts';
import {createOllamaProvider} from './ollama';
import {createAdmittedProvider} from './admitted';
import {admissionScope,type PersistedAiAttempt} from './admission-scope';
import type {TraceContext} from '../trace-context';
import {traceProvider} from './traced';

// Coordination atom = this provider account's bounded inference budget, NOT all
// platform traffic or user data. Do not shard by user/route: it defeats the cap.
export const ADMISSION_ACCOUNT='ollama-account-v1';
export async function createGovernedOllamaProvider(env:AppEnv,attempt:PersistedAiAttempt,
  thinking?:false|'low',trace?:TraceContext):Promise<LLMProvider>{
  const base=traceProvider(createOllamaProvider({apiKey:env.OLLAMA_API_KEY,model:env.OLLAMA_MODEL||'gpt-oss:20b',thinking}),attempt.kind,'provider-call',trace);
  if(!env.OLLAMA_API_KEY)return base; // Always NOT_CONFIGURED, no inference.
  if(!env.AI_ADMISSION)return traceProvider({...base,async generate(){return {ok:false,code:'ADMISSION_UNAVAILABLE'};}},attempt.kind,'governed-request',trace);
  const scope=await admissionScope(attempt);
  return traceProvider(createAdmittedProvider(base,env.AI_ADMISSION.getByName(ADMISSION_ACCOUNT),scope),attempt.kind,'governed-request',trace);
}
