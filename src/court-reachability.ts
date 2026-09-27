import {CASES, PROCEDURAL_REQUESTS, allowedActions, newCourt, rolesFor, transition,
  type CaseTemplate, type CourtAction, type CourtConfig} from './court-rules';

export type ReachabilityResult = {ok: true; checkedRoles: number} |
  {ok: false; code: 'TEMPLATE_POLICY' | 'EVIDENCE_IDS' | 'ANSWER_KEY' | 'UNREACHABLE'};

// Internal typed-template gate, after narrative schema parsing. This proves a
// bounded legal completion path, not semantic truth or every possible action path.
// It never writes a session, invokes a model or exposes the server answer key.
export function checkCaseReachability(template: CaseTemplate, baseId: string): ReachabilityResult {
  const base = CASES.find(c => c.id === baseId);
  if (!base || template.procedure !== base.procedure || template.mandatory !== base.mandatory ||
      template.aidApproved !== base.aidApproved) return {ok: false, code: 'TEMPLATE_POLICY'};
  if (!Array.isArray(template.evidence) || template.evidence.length < 1 || template.evidence.length > 16)
    return {ok: false, code: 'EVIDENCE_IDS'};
  const ids = new Set<string>();
  for (const evidence of template.evidence) {
    if (!evidence || typeof evidence.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(evidence.id) || ids.has(evidence.id))
      return {ok: false, code: 'EVIDENCE_IDS'};
    ids.add(evidence.id);
  }
  if (!Array.isArray(template.answers) || template.answers.length < 2 || template.answers.length > 8 ||
      !Number.isInteger(template.correct) || template.correct < 0 || template.correct >= template.answers.length ||
      Array.from(template.answers).some(a => typeof a !== 'string' || !a.trim()))
    return {ok: false, code: 'ANSWER_KEY'};
  const roles = rolesFor(base.procedure);
  try {
    for (const role of roles) {
      const age = base.procedure === 'juvenile' ? 15 : 20;
      const config: CourtConfig = {caseId: baseId, role, claimantAge:20, claimantHearingAge:20,
        respondentAge:age, respondentHearingAge:age,
        claimantAid:role === 'claimantCounsel' ? 'private' : 'none',
        respondentAid:['respondentCounsel','assistant'].includes(role) ? 'private' : base.mandatory ? 'appointed' : 'none'};
      let state = newCourt('validation-only', 'validation-only', config);
      state.generatedCase = template;
      let count = 0;
      const act = (type: string, extra: Partial<CourtAction> = {}) => {
        if (++count > 32) throw Error('bound');
        state = transition(state, {...extra, type, version:state.version, requestId:'validation-'+count});
      };
      if (role === 'observer') {
        for (let i = 0; i < 5; i++) act('step');
      } else {
        act('acknowledge'); act('speak', {text:'確認資料與爭點'});
        for (const evidence of template.evidence) act('review', {evidenceId:evidence.id});
        if (role === 'judge') for (const ruling of PROCEDURAL_REQUESTS)
          act('rule', {rulingId:ruling.id, decision:ruling.correct});
        act('closeEvidence'); act('speak', {text:'區分事實與推論'});
        act('answer', {answer:template.correct});
        if (state.reviewed.length !== ids.size || state.attempts !== 1) throw Error('incomplete');
      }
      if (!state.completed || state.stage !== 5 || allowedActions(state).length || state.version !== count)
        return {ok:false, code:'UNREACHABLE'};
    }
  } catch { return {ok:false, code:'UNREACHABLE'}; }
  return {ok:true, checkedRoles:roles.length};
}
