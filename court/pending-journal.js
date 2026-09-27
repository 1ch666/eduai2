// Court session IDs identify records, NOT authentication sessions. Store only
// opaque request IDs for GET outcome recovery; no text, tokens or snapshots.
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export function createPendingJournal({getStorage,getOwner}){
 return ({sessionId,caseId})=>{
  const owner=getOwner();
  if(typeof owner!=='string'||!owner||owner.length>128||!uuid(sessionId)||!(/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}$/).test(caseId))throw new Error('Invalid journal scope');
  const key='eduai-court-pending-v1:'+encodeURIComponent(owner)+':'+sessionId+':'+caseId;
  return {
   read(){const value=getStorage().getItem(key);if(value===null)return null;if(!uuid(value))throw new Error('Invalid pending marker');return value;},
   save(requestId){if(!uuid(requestId))throw new Error('Invalid request');getStorage().setItem(key,requestId);if(getStorage().getItem(key)!==requestId)throw new Error('Storage unavailable');},
   remove(requestId){const storage=getStorage(),current=storage.getItem(key);if(current===null)return;if(current!==requestId)throw new Error('Pending marker changed');storage.removeItem(key);if(storage.getItem(key)!==null)throw new Error('Storage unavailable');}
  };
 };
}
