import {parseCaseGraph,type CaseGraph} from './case-graph';
import {LEGAL_SOURCES,CASES,type CourtState} from './court-rules';
import {publicCourtCast} from './court-cast';

// Trusted template binding, after config and reachability validation. This
// checks referential identity, not whether a witness statement is true.
export function parseBoundCourtGraph(value:unknown,state:CourtState):CaseGraph|null{
  const template=state.generatedCase||CASES.find(t=>t.id===state.config.caseId);
  if(!template)return null;
  const graph=parseCaseGraph(value,LEGAL_SOURCES.filter(s=>s.applies===template.procedure).map(s=>s.id));
  if(!graph)return null;
  const sameIds=(actual:readonly {id:string}[],expected:readonly string[])=>
    actual.length===expected.length&&new Set(expected).size===expected.length&&
    actual.every(item=>expected.includes(item.id));
  if(!sameIds(graph.facts,template.facts.map((_,i)=>`fact-${i}`))||
    !sameIds(graph.evidence,template.evidence.map(e=>e.id)))return null;
  const witnesses=new Set(publicCourtCast(state).filter(n=>n.roleId==='witness').map(n=>String(n.npcId)));
  if(graph.witnesses.some(w=>!witnesses.has(w.id)))return null;
  return graph;
}
