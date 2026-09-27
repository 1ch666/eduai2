/** Server-created correlation only, not an identity, capability or idempotency key.
 * Pass explicitly across RPC. Never populate this from HTTP headers or JSON.
 */
export interface TraceContext {schemaVersion:1;requestId:string;traceId:string}
export function copyTrace(value:unknown):TraceContext|undefined {
  if(!value||typeof value!=='object'||Array.isArray(value))return undefined;
  const fields=Object.getOwnPropertyDescriptors(value);
  if(Object.keys(fields).sort().join(',')!=='requestId,schemaVersion,traceId'||
    Object.values(fields).some(field=>!('value' in field)))return undefined;
  const version=fields.schemaVersion.value,requestId=fields.requestId.value,traceId=fields.traceId.value;
  if(version!==1||typeof requestId!=='string'||typeof traceId!=='string'||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(requestId)||
    !/^[0-9a-f]{32}$/.test(traceId)||/^0+$/.test(traceId))return undefined;
  return {schemaVersion:1,requestId,traceId};
}
