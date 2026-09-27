using System;
using System.Globalization;
using System.Linq;
using System.Text.RegularExpressions;

namespace EduAI.Court.Protocol
{
    // Public wire projections only. Never serialize server state into these DTOs.
    [Serializable] public sealed class ActionDto
    {
        public string actionId, label, category, reasonDisabled, requiredTarget;
        public bool enabled;
    }
    [Serializable] public sealed class NpcDto
    {
        public string npcId, roleId, displayName, seatId, pose, emotion, speakingState, requestState;
        public bool visible, interactable;
    }
    [Serializable] public sealed class MetadataDto { public string name, value; }
    [Serializable] public sealed class EvidenceDto
    {
        public string evidenceId, title, type, text, sourceRole, admittedStatus, presentationState, assetId;
        public MetadataDto[] metadata;
        public string[] factReferences;
    }
    [Serializable] public sealed class CourtViewDto
    {
        public string title, procedure, roleId, stageId, stageLabel, feedback;
        public bool completed;
        public ActionDto[] allowedActions;
        public NpcDto[] npcs;
        public EvidenceDto[] evidence;
    }
    [Serializable] public sealed class CourtSnapshot
    {
        public int apiVersion;
        public string requestId, caseId, sessionId, eventId, timestamp;
        public long stateVersion, eventSequence;
        public CourtViewDto state;
    }
    [Serializable] public sealed class CourtEvent
    {
        public int apiVersion;
        public string requestId, caseId, sessionId, eventId, timestamp;
        public long stateVersion, eventSequence;
        public string kind, speaker, roleId, stageId, text;
        public string[] evidenceIds, citationIds;
        public CourtSnapshot snapshot;
    }
    [Serializable] public sealed class CourtMutation
    {
        public int apiVersion;
        public string requestId, idempotencyKey, sessionId, caseId, actionId, targetId, text;
        public long expectedStateVersion;
    }

    public static class CourtProjectionValidator
    {
        public const long MaxSafeInteger = 9007199254740991;
        public static bool Id(string s) => s != null && Regex.IsMatch(s, @"\A[A-Za-z0-9][A-Za-z0-9_.:-]{0,79}\z");
        public static bool Uuid(string s) => s != null && Regex.IsMatch(s, @"\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z", RegexOptions.IgnoreCase);
        private static bool Text(string s, int max, int min = 0) => s != null && s.Length >= min && s.Length <= max;
        private static bool Choice(string s, params string[] values) => values.Contains(s);
        private static bool Count<T>(T[] values, int max) => values != null && values.Length <= max;
        private static bool Number(long n) => n >= 0 && n <= MaxSafeInteger;
        private static bool Timestamp(string s) => DateTime.TryParseExact(s, "yyyy-MM-dd'T'HH:mm:ss.fff'Z'", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
        public static bool Valid(CourtSnapshot s)
        {
            if (s == null || s.apiVersion != 1 || !Uuid(s.requestId) || !Uuid(s.sessionId) || !Uuid(s.eventId) || !Id(s.caseId) || !Number(s.stateVersion) || !Number(s.eventSequence) || !Timestamp(s.timestamp)) return false;
            var v = s.state;
            if (v == null || !Text(v.title,160,1) || !Choice(v.procedure,"civil","criminal","juvenile") || !Id(v.roleId) || !Id(v.stageId) || !Text(v.stageLabel,160,1) || !Text(v.feedback,5000) || (v.procedure=="juvenile" && v.roleId=="observer")) return false;
            if (!Count(v.allowedActions,40) || !Count(v.npcs,30) || !Count(v.evidence,40)) return false;
            if (!v.allowedActions.All(a => a != null && Id(a.actionId) && Text(a.label,160,1) && Choice(a.category,"procedure","statement","evidence","objection","assessment","navigation") && Text(a.reasonDisabled,300) && (a.enabled || !string.IsNullOrWhiteSpace(a.reasonDisabled)) && Choice(a.requiredTarget,"none","evidence","npc"))) return false;
            if (!v.npcs.All(n => n != null && Id(n.npcId) && Id(n.roleId) && Text(n.displayName,80,1) && Id(n.seatId) && Choice(n.pose,"idle","speaking","listening","thinking","objecting","presentingEvidence","sitting","standing","turnHeadToSpeaker") && Choice(n.emotion,"neutral","nervous","confident","surprised") && Choice(n.speakingState,"silent","speaking") && Choice(n.requestState,"idle","pending","failed") && (n.visible || !n.interactable))) return false;
            if (!v.evidence.All(e => e != null && Id(e.evidenceId) && Text(e.title,160,1) && Choice(e.type,"image","document","chat","timeline","audioTranscript","objectPhoto","mapDiagram","syntheticRecord","cctvStill") && Text(e.text,12000) && Id(e.sourceRole) && Choice(e.admittedStatus,"notConsidered","admitted","excluded") && Choice(e.presentationState,"available","presented") && (e.assetId=="" || Id(e.assetId)) && Count(e.factReferences,30) && e.factReferences.All(Id) && Count(e.metadata,20) && e.metadata.All(m=>m!=null&&Text(m.name,80,1)&&Text(m.value,500)))) return false;
            return v.allowedActions.Select(a=>a.actionId).Distinct().Count()==v.allowedActions.Length && v.npcs.Select(n=>n.npcId).Distinct().Count()==v.npcs.Length && v.evidence.Select(e=>e.evidenceId).Distinct().Count()==v.evidence.Length;
        }
        public static bool Valid(CourtMutation m) => m != null && m.apiVersion==1 && Uuid(m.requestId) && Uuid(m.idempotencyKey) && Uuid(m.sessionId) && Id(m.caseId) && Number(m.expectedStateVersion) && Id(m.actionId) && (m.targetId=="" || Id(m.targetId)) && Text(m.text,600);
        public static bool Valid(CourtEvent e)
        {
            if(e==null || !Valid(e.snapshot)) return false;
            var s=e.snapshot;
            return e.apiVersion==s.apiVersion && e.requestId==s.requestId && e.caseId==s.caseId && e.sessionId==s.sessionId && e.stateVersion==s.stateVersion && e.eventId==s.eventId && e.eventSequence==s.eventSequence && e.timestamp==s.timestamp && e.stageId==s.state.stageId &&
                Choice(e.kind,"session_started","statement","npc_utterance","evidence_presented","objection","ruling","stage_changed","session_completed","checkpoint") && Text(e.speaker,80) && Id(e.roleId) && Text(e.text,12000) && Count(e.citationIds,30) && e.citationIds.All(Id) && Count(e.evidenceIds,40) && e.evidenceIds.All(id=>Id(id)&&s.state.evidence.Any(x=>x.evidenceId==id)) && e.evidenceIds.Distinct().Count()==e.evidenceIds.Length;
        }
    }
}
