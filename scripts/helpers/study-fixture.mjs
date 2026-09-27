// Actual SQLite; DO/RPC lifecycle and admission receipt are test doubles.
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const b=await build({entryPoints:['src/providers/study-attempts.ts'],bundle:true,platform:'node',format:'esm',write:false});
export const {reserveStudyAttempt}=await import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].text).toString('base64'));
export function studyFixture(){
 const db=new DatabaseSync(':memory:');let fail=false;
 const storage={sql:{exec(query,...args){
  if(fail&&query.startsWith('INSERT INTO study_ai_attempts'))throw Error('synthetic disk failure');
  let rows;if(query.startsWith('CREATE')){db.exec(query);rows=[];}else rows=db.prepare(query).all(...args);
  return {toArray:()=>rows,one:()=>{if(rows.length!==1)throw Error('Expected one row');return rows[0];}};
 }},transactionSync(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
 return {db,storage,setFail(value){fail=value;},reserveStudyAi(kind,id,fingerprint){return reserveStudyAttempt(storage,kind,id,fingerprint,Date.now());}};
}
export function grantedAdmission(){return {getByName(){return {
 async admit(){return {code:'ACCEPTED',phase:'running',start:true,deadline:Date.now()+60000};},
 async cancel(){return {code:'SETTLED',start:false};},async finish(){return {code:'SETTLED',start:false};}
 };}};}
