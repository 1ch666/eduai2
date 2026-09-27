using System;
using UnityEditor;
using UnityEngine;
using EduAI.Court.Core;
using EduAI.Court.Protocol;
using EduAI.Court.Networking;

namespace EduAI.Court.Editor
{
    public static class CourtProtocolTests
    {
        [Serializable] private sealed class Edit { public string name, find, replace; }
        [Serializable] private sealed class Edits { public Edit[] edits; }
        private static CourtSnapshot Fixture(long version=0) => new CourtSnapshot {
            apiVersion=1,requestId=Guid.NewGuid().ToString(),sessionId="10000000-0000-4000-8000-000000000000",caseId="sale",stateVersion=version,eventSequence=version,eventId=Guid.NewGuid().ToString(),timestamp="2026-09-26T00:00:00.000Z",
            state=new CourtViewDto{title="虛構測試",procedure="civil",roleId="judge",stageId="opening",stageLabel="開庭",feedback="",allowedActions=new[]{new ActionDto{actionId="acknowledge",label="確認",category="procedure",enabled=true,reasonDisabled="",requiredTarget="none"}},npcs=Array.Empty<NpcDto>(),evidence=Array.Empty<EvidenceDto>()}
        };
        private static void Require(bool ok,string label){if(!ok)throw new InvalidOperationException("Protocol: "+label);}
        public static void Run()
        {
            string raw=System.IO.File.ReadAllText("Assets/Editor/Fixtures/court-v1.json");
            var shared=CourtWire.Snapshot(raw);
            var edits=JsonUtility.FromJson<Edits>(System.IO.File.ReadAllText("Assets/Editor/Fixtures/wire-invalid.json"));
            foreach(var edit in edits.edits){Require(raw.Contains(edit.find),"fixture edit exists: "+edit.name);Require(CourtWire.Snapshot(raw.Replace(edit.find,edit.replace))==null,"wire: "+edit.name);}
            Require(CourtWire.Snapshot(raw+"{}")==null,"trailing data");
            Require(CourtWire.Snapshot(new string('[',10000))==null,"nested invalid data");
            Require(CourtWire.Snapshot(raw.Replace("虛構契約測試","\\ud83d\\udcd6"))!=null,"Unicode surrogate pair");
            Require(CourtWire.Snapshot(new string('中',100000))==null,"UTF8 limit");
            Require(CourtProjectionValidator.Valid(shared),"shared JS/C# fixture");
            Require(shared.state.evidence[0].metadata[0].value=="測試資料","Chinese nested DTO serialization");
            var store=new CourtClientState();var a=Fixture();long g=store.Bind(a.sessionId,a.caseId);
            Require(CourtProjectionValidator.Valid(a),"valid fixture");
            Require(store.AcceptSnapshot(a,g)==ApplyResult.Accepted,"initial snapshot");
            Require(store.AcceptSnapshotJson(JsonUtility.ToJson(a),g)==ApplyResult.Duplicate,"raw store entry");
            Require(store.AcceptSnapshotJson("{}",g)==ApplyResult.Malformed,"raw rejection");
            Require(store.Snapshot.stateVersion==0,"raw rejection keeps state");
            a.state.title="external mutation";Require(store.Snapshot.state.title=="虛構測試","input clone");
            var copy=store.Snapshot;copy.state.title="external read";Require(store.Snapshot.state.title=="虛構測試","output clone");
            var same=store.Snapshot;same.requestId=Guid.NewGuid().ToString();Require(store.AcceptSnapshot(same,g)==ApplyResult.Duplicate,"duplicate read");
            Require(store.AcceptSnapshot(Fixture(),g)==ApplyResult.Conflict,"same-version conflicting event");
            Require(store.AcceptSnapshot(Fixture(2),g)==ApplyResult.Accepted,"recovery may skip snapshots");
            Require(store.AcceptSnapshot(Fixture(1),g)==ApplyResult.Stale,"late reply");
            var wrong=Fixture(3);wrong.caseId="theft";Require(store.AcceptSnapshot(wrong,g)==ApplyResult.WrongSession,"wrong case");
            var invalid=Fixture(3);invalid.state.allowedActions[0].enabled=false;Require(!CourtProjectionValidator.Valid(invalid),"disabled reason required");
            invalid=Fixture(3);invalid.stateVersion=9007199254740992;Require(!CourtProjectionValidator.Valid(invalid),"JS safe integer parity");
            invalid=Fixture(3);invalid.state.procedure="juvenile";invalid.state.roleId="observer";Require(!CourtProjectionValidator.Valid(invalid),"juvenile observer");
            invalid=Fixture(3);invalid.state.allowedActions=new[]{invalid.state.allowedActions[0],invalid.state.allowedActions[0]};Require(!CourtProjectionValidator.Valid(invalid),"duplicate action");
            var s=Fixture(4);var e=new CourtEvent{apiVersion=s.apiVersion,requestId=s.requestId,caseId=s.caseId,sessionId=s.sessionId,stateVersion=s.stateVersion,eventSequence=s.eventSequence,eventId=s.eventId,timestamp=s.timestamp,kind="stage_changed",speaker="法官",roleId="judge",stageId=s.state.stageId,text="確認",evidenceIds=Array.Empty<string>(),citationIds=Array.Empty<string>(),snapshot=s};
            Require(store.AcceptEvent(e,g)==ApplyResult.Gap,"event gap does not alter state");
            Require(store.Snapshot.stateVersion==2,"gap preserves state");
            e.stateVersion=s.stateVersion=3;e.eventSequence=s.eventSequence=3;
            Require(store.AcceptEvent(e,g)==ApplyResult.Accepted,"contiguous event");
            Require(CourtWire.Event(JsonUtility.ToJson(e))!=null,"wire event");
            var mutation=new CourtMutation{apiVersion=1,requestId=Guid.NewGuid().ToString(),idempotencyKey=Guid.NewGuid().ToString(),sessionId=s.sessionId,caseId=s.caseId,expectedStateVersion=3,actionId="acknowledge",targetId="",text="確認"};
            Require(CourtWire.Mutation(JsonUtility.ToJson(mutation))!=null,"wire mutation");
            Require(store.AcceptEvent(e,g)==ApplyResult.Duplicate,"duplicate event");
            e.evidenceIds=new[]{"hidden"};Require(!CourtProjectionValidator.Valid(e),"unknown evidence link");
            store.Clear();Require(store.Snapshot==null,"logout clears");store.Bind(a.sessionId,a.caseId);
            Require(store.AcceptSnapshot(Fixture(5),g)==ApplyResult.ObsoleteContext,"old generation rejected");
            var roundtrip=JsonUtility.FromJson<CourtSnapshot>(JsonUtility.ToJson(Fixture()));Require(CourtProjectionValidator.Valid(roundtrip),"Unity JSON roundtrip");
            Debug.Log("COURT_PROTOCOL_TESTS_PASSED");
        }
    }
}
