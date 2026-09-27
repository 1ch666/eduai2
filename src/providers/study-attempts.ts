// Compact, per-owner tombstones for the legacy UUID-only study endpoints.
// Never delete a tombstone or give an existing request permission to start.
// No prompts, history, responses, photos, credentials or raw IPs are stored.
export type StudyKind = 'tutor' | 'photo';
export type StudyReservation = {code:'RESERVED';issuedAt:number} |
  {code:'EXISTING'|'CONFLICT'|'CAPACITY'|'INVALID'};
type Store = Pick<DurableObjectStorage,'sql'|'transactionSync'>;
const MAX_ATTEMPTS=4096;

export function reserveStudyAttempt(storage:Store,kind:StudyKind,id:string,fingerprint:string,now:number):StudyReservation {
  if(!['tutor','photo'].includes(kind)||typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id)||
    typeof fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(fingerprint)||
    !Number.isSafeInteger(now)||now<0||now>8e15)return {code:'INVALID'};
  return storage.transactionSync(()=>{
    const tables=storage.sql.exec<{name:string}>("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('study_ai_meta','study_ai_attempts')").toArray();
    if(tables.length===0){
      storage.sql.exec(`CREATE TABLE study_ai_meta(id INTEGER PRIMARY KEY CHECK(id=1),version INTEGER NOT NULL);
        CREATE TABLE study_ai_attempts(kind TEXT NOT NULL,id TEXT NOT NULL,fingerprint TEXT NOT NULL,issued_at INTEGER NOT NULL,PRIMARY KEY(kind,id));
        INSERT INTO study_ai_meta VALUES(1,1);`);
    }else if(tables.length!==2)throw Error('Incomplete study AI schema');
    const meta=storage.sql.exec<{id:number;version:number}>('SELECT id,version FROM study_ai_meta').toArray();
    if(meta.length!==1||meta[0].id!==1||meta[0].version!==1)throw Error('Unsupported study AI schema');
    const previous=storage.sql.exec<{fingerprint:string;issued_at:number}>('SELECT fingerprint,issued_at FROM study_ai_attempts WHERE kind=? AND id=?',kind,id).toArray()[0];
    if(previous)return {code:previous.fingerprint===fingerprint?'EXISTING':'CONFLICT'};
    if(storage.sql.exec<{n:number}>('SELECT count(*) AS n FROM study_ai_attempts').one().n>=MAX_ATTEMPTS)return {code:'CAPACITY'};
    storage.sql.exec('INSERT INTO study_ai_attempts VALUES(?,?,?,?)',kind,id,fingerprint,now);
    return {code:'RESERVED',issuedAt:now};
  });
}
