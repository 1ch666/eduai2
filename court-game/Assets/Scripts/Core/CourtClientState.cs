using System;
using UnityEngine;
using EduAI.Court.Protocol;

namespace EduAI.Court.Core
{
    public enum ApplyResult { Accepted, ObsoleteContext, Malformed, WrongSession, Stale, Duplicate, Conflict, NeedsSnapshot, Gap }
    // No stage transition rules, network or mutable state exposed to presenters.
    // Input DTOs must come through the strict wire validator, not bare JsonUtility.
    public sealed class CourtClientState
    {
        private string sessionId, caseId;
        private CourtSnapshot current;
        public long Generation { get; private set; }
        public CourtSnapshot Snapshot => Clone(current);
        public long Bind(string session, string selectedCase)
        {
            if(!CourtProjectionValidator.Uuid(session)||!CourtProjectionValidator.Id(selectedCase)) throw new ArgumentException("Invalid court context");
            Clear(); sessionId=session; caseId=selectedCase; return Generation;
        }
        public void Clear() { sessionId=caseId=null; current=null; Generation++; }
        private static CourtSnapshot Clone(CourtSnapshot s) => s==null?null:JsonUtility.FromJson<CourtSnapshot>(JsonUtility.ToJson(s));
        private static string Identity(CourtSnapshot s) { var copy=Clone(s);copy.requestId="";return JsonUtility.ToJson(copy); }
        private ApplyResult Check(CourtSnapshot s,long generation)
        {
            if(generation!=Generation||sessionId==null)return ApplyResult.ObsoleteContext;
            if(!CourtProjectionValidator.Valid(s))return ApplyResult.Malformed;
            if(s.sessionId!=sessionId||s.caseId!=caseId)return ApplyResult.WrongSession;
            if(current==null)return ApplyResult.Accepted;
            if(s.stateVersion<current.stateVersion||s.eventSequence<current.eventSequence)return ApplyResult.Stale;
            if(s.stateVersion==current.stateVersion)return Identity(s)==Identity(current)?ApplyResult.Duplicate:ApplyResult.Conflict;
            if(s.eventSequence<=current.eventSequence||s.eventId==current.eventId)return ApplyResult.Conflict;
            return ApplyResult.Accepted;
        }
        public ApplyResult AcceptSnapshot(CourtSnapshot s,long generation)
        {
            var result=Check(s,generation);if(result==ApplyResult.Accepted)current=Clone(s);return result;
        }
        public ApplyResult AcceptEvent(CourtEvent e,long generation)
        {
            var result=Check(CourtProjectionValidator.Valid(e)?e.snapshot:null,generation);
            if(result!=ApplyResult.Accepted)return result;
            if(current==null)return ApplyResult.NeedsSnapshot;
            if(e.stateVersion!=current.stateVersion+1||e.eventSequence!=current.eventSequence+1)return ApplyResult.Gap;
            current=Clone(e.snapshot);return ApplyResult.Accepted;
        }
    }
}
