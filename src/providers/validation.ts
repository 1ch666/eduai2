import type {EmbeddingOutput, RerankOutput, TokenUsage} from './contracts';

// Validators consume normalized JSON-shaped data, never provider text/code.
// Fixed iteration caps prevent a malformed shape from requesting unbounded work.
function object(value: unknown, keys: readonly string[]): value is Record<string,unknown> {
  if (!value || typeof value!=='object' || Array.isArray(value)) return false;
  const prototype=Object.getPrototypeOf(value);
  if (prototype!==Object.prototype && prototype!==null) return false;
  const actual=Object.keys(value);
  return actual.length===keys.length && keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));
}
function integer(value: unknown, min: number, max: number): value is number {
  return typeof value==='number' && Number.isSafeInteger(value) && value>=min && value<=max;
}
function usage(value: unknown): TokenUsage | null {
  if (!object(value,['inputTokens','outputTokens'])) return null;
  const {inputTokens,outputTokens}=value;
  if (inputTokens!==null && !integer(inputTokens,0,Number.MAX_SAFE_INTEGER)) return null;
  if (outputTokens!==null && !integer(outputTokens,0,Number.MAX_SAFE_INTEGER)) return null;
  return {inputTokens,outputTokens};
}

export function parseEmbeddingOutput(value: unknown, count: number, dimensions: number): EmbeddingOutput | null {
  if (!integer(count,1,32) || !integer(dimensions,1,4096) || count*dimensions>65536 ||
    !object(value,['vectors','usage']) || !Array.isArray(value.vectors) || value.vectors.length!==count) return null;
  const tokenUsage=usage(value.usage);
  if (!tokenUsage) return null;
  const vectors:number[][]=[];
  for (const row of value.vectors) {
    if (!Array.isArray(row) || row.length!==dimensions) return null;
    const vector:number[]=[];
    for (const coordinate of row) {
      if (typeof coordinate!=='number' || !Number.isFinite(coordinate)) return null;
      vector.push(coordinate);
    }
    vectors.push(vector);
  }
  return {vectors,usage:tokenUsage};
}

export function parseRerankOutput(value: unknown, candidateIds: readonly string[], topK: number): RerankOutput | null {
  if (!Array.isArray(candidateIds) || !integer(candidateIds.length,1,100) || !integer(topK,1,candidateIds.length)) return null;
  const allowed=new Set<string>();
  for (const id of candidateIds) {
    if (typeof id!=='string' || !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/.test(id) || allowed.has(id)) return null;
    allowed.add(id);
  }
  if (!object(value,['items','usage']) || !Array.isArray(value.items) || value.items.length!==topK) return null;
  const tokenUsage=usage(value.usage);
  if (!tokenUsage) return null;
  const seen=new Set<string>();
  const items:Array<{id:string;score:number}>=[];
  let previous=Infinity;
  for (const item of value.items) {
    if (!object(item,['id','score']) || typeof item.id!=='string' || !allowed.has(item.id) || seen.has(item.id) ||
      typeof item.score!=='number' || !Number.isFinite(item.score) || item.score>previous) return null;
    seen.add(item.id);previous=item.score;items.push({id:item.id,score:item.score});
  }
  return {items,usage:tokenUsage};
}
