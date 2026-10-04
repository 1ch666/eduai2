using UnityEngine;
using UnityEngine.UI;
using UnityEngine.Scripting;
using EduAI.Court.Networking;
using EduAI.Court.Protocol;

namespace EduAI.Court.Core
{
    // Read-only hosted store. Presenters receive cloned snapshots, never the reducer.
    [Preserve]
    public sealed class CourtRuntimeState : MonoBehaviour
    {
        private readonly CourtClientState state = new CourtClientState();
        private string sessionId;
        private GameObject canvasObject;
        private Text caption;
        public static CourtRuntimeState Active { get; private set; }
        public CourtSnapshot Snapshot => state.Snapshot;
        // Local accessibility preference, never persisted as court state.
        [Preserve]
        public void SetReducedMotion(string value)
        {
            if(value!="0"&&value!="1")return;
            foreach(var actor in FindObjectsByType<NpcActorMotion>(FindObjectsInactive.Include,FindObjectsSortMode.None))
                actor.SetReducedMotion(value=="1");
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Install()
        {
            if (Active) return;
            Active = new GameObject("CourtRuntimeState").AddComponent<CourtRuntimeState>();
        }
        [Preserve]
        public void ApplySnapshot(string raw)
        {
            if (!CourtPresentation.IsHosted) return;
            var incoming = CourtWire.Snapshot(raw);
            if (incoming == null) { MarkUnavailable(); return; }
            if (sessionId == null) { state.Bind(incoming.sessionId, incoming.caseId); sessionId = incoming.sessionId; }
            var result = state.AcceptSnapshotJson(raw, state.Generation);
            if (result != ApplyResult.Accepted && result != ApplyResult.Duplicate && result != ApplyResult.Stale)
            { MarkUnavailable(); return; }
            BuildHud();
            var snapshot = state.Snapshot;
            SynchronizeActors(snapshot);
            if (!caption || snapshot == null) return;
            int enabledActions = 0;
            foreach (var action in snapshot.state.allowedActions) if (action.enabled) enabledActions++;
            caption.text = snapshot.state.title + "\n" + snapshot.state.stageLabel +
                (snapshot.state.completed ? " · 庭審已完成" : " · 可用操作 " + enabledActions) +
                "\n程序與證物請使用法庭互動盒或網頁操作面板。";
            canvasObject.SetActive(true);
        }
        [Preserve]
        public void MarkUnavailable()
        {
            if (!CourtPresentation.IsHosted) return;
            SynchronizeActors(null);
            BuildHud();
            if (caption) caption.text = "場次狀態暫時無法同步\n請回到網頁更新狀態；不在遊戲內推測下一階段。";
            if (canvasObject) canvasObject.SetActive(true);
        }
        [Preserve]
        public void ClearState()
        {
            state.Clear(); sessionId = null;
            SynchronizeActors(null);
            if (caption) caption.text = "";
            if (canvasObject) canvasObject.SetActive(false);
        }
        private static void SynchronizeActors(CourtSnapshot snapshot)
        {
            if (!CourtPresentation.IsHosted) return;
            foreach (var actor in FindObjectsByType<NPCInteractable>(FindObjectsInactive.Include, FindObjectsSortMode.None))
            {
                NpcDto projection = null;
                if (snapshot != null)
                    foreach (var candidate in snapshot.state.npcs)
                        if (candidate.npcId == actor.name) { projection = candidate; break; }
                actor.ApplyPublicProjection(projection, snapshot != null);
            }
        }
        private void BuildHud()
        {
            if (canvasObject) return;
            // Use the serialized full Chinese font, not an arbitrary legacy Text
            // whose subset font silently omits dynamic labels and case titles.
            var dialogue = FindFirstObjectByType<NpcDialogueUI>(FindObjectsInactive.Include);
            Font font = dialogue ? dialogue.DisplayFont : null;
            if (!font) return;
            canvasObject = new GameObject("ServerCourtHUD", typeof(RectTransform), typeof(Canvas), typeof(CanvasScaler));
            canvasObject.transform.SetParent(transform, false);
            var canvas = canvasObject.GetComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 20;
            var scaler = canvasObject.GetComponent<CanvasScaler>(); scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280,720); scaler.matchWidthOrHeight = .5f;
            var box = new GameObject("Status", typeof(RectTransform), typeof(Image)); box.transform.SetParent(canvasObject.transform,false);
            var rect = (RectTransform)box.transform; rect.anchorMin = new Vector2(.52f,.75f); rect.anchorMax = new Vector2(.98f,.97f); rect.offsetMin = rect.offsetMax = Vector2.zero;
            box.GetComponent<Image>().color = new Color(.96f,.97f,.96f,1f); box.GetComponent<Image>().raycastTarget = false;
            var label = new GameObject("Caption", typeof(RectTransform), typeof(Text)); label.transform.SetParent(box.transform,false);
            caption = label.GetComponent<Text>(); caption.font = font; caption.fontSize = 20; caption.supportRichText = false; caption.raycastTarget = false;
            caption.color = new Color(.12f,.16f,.17f); caption.alignment = TextAnchor.UpperLeft;
            var r = caption.rectTransform; r.anchorMin = Vector2.zero; r.anchorMax = Vector2.one; r.offsetMin = new Vector2(12,8); r.offsetMax = new Vector2(-12,-8);
        }
        private void OnDestroy() { if (Active == this) Active = null; }
    }
}
