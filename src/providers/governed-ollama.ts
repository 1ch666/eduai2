import type {AppEnv} from '../env';
import type {LLMProvider} from './contracts';
import {createOllamaProvider} from './ollama';
import {createAdmittedProvider} from './admitted';
import {admissionScope,type PersistedAiAttempt} from './admission-scope';

// Coordination atom = this provider account's bounded inference budget, NOT all
// platform traffic or user data. Do not shard by user/route: it defeats the cap.
export const ADMISSION_ACCOUNT='ollama-account-v1';
export async function createGovernedOllamaProvider(env:AppEnv,attempt:PersistedAiAttempt,
  thinking?:false|'low'):Promise<LLMProvider>{
  const base=createOllamaProvider({apiKey:env.OLLAMA_API_KEY,model:env.OLLAMA_MODEL||'gpt-oss:20b',thinking});
  if(!env.OLLAMA_API_KEY)return base; // Always NOT_CONFIGURED, no inference.
  if(!env.AI_ADMISSION)return {...base,async generate(){return {ok:false,code:'ADMISSION_UNAVAILABLE'};}};
  const scope=await admissionScope(attempt);
  return createAdmittedProvider(base,env.AI_ADMISSION.getByName(ADMISSION_ACCOUNT),scope);
}
