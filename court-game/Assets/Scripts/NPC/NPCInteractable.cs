using UnityEngine;
using EduAI.Court.Protocol;

namespace EduAI.Court
{
    public sealed class NPCInteractable : MonoBehaviour, IInteractable
    {
        [SerializeField] private string displayName = "法官";
        [SerializeField] private bool isJudge;
        [SerializeField] private InteractionUI ui;
        [SerializeField] private CourtSession session;
        private bool publicInteractionAllowed;
        private string publicDisplayName;
        private Renderer[] publicRenderers;
        private bool[] originalRendererEnabled;
        public bool CanInteract => !CourtPresentation.IsHosted || publicInteractionAllowed;
        // Presentation flags only; never retains the snapshot, facts or legal rules.
        public void ApplyPublicProjection(NpcDto projection, bool synchronized)
        {
            if (!CourtPresentation.IsHosted) return;
            bool visible = synchronized && projection != null && projection.npcId == name && projection.visible;
            Core.CourtSeatLayout.Seat seat = null;
            // Unsupported spatial mappings fail closed; never guess a role
            // from the scene object's legacy name or move to world origin.
            if (visible) visible = Core.CourtSeatLayout.Ensure().TryResolve(projection.seatId, projection.roleId, out seat);
            if (visible && (Vector3.Distance(transform.position, seat.AnimationAnchor.position) > .001f ||
                Quaternion.Angle(transform.rotation, seat.AnimationAnchor.rotation) > .01f))
            {
                // Closeups retain camera state relative to the player. Finish
                // that interaction before moving the target to another seat.
                FindFirstObjectByType<NpcDialogueUI>()?.CloseFor(this);
                transform.SetPositionAndRotation(seat.AnimationAnchor.position, seat.AnimationAnchor.rotation);
                Physics.SyncTransforms();
            }
            publicInteractionAllowed = visible && projection.interactable && projection.requestState != "pending";
            publicDisplayName = visible ? projection.displayName : null;
            if (publicRenderers == null)
            {
                publicRenderers = GetComponentsInChildren<Renderer>(true);
                originalRendererEnabled = new bool[publicRenderers.Length];
                for (int i = 0; i < publicRenderers.Length; i++) originalRendererEnabled[i] = publicRenderers[i].enabled;
            }
            for (int i = 0; i < publicRenderers.Length; i++)
                if (publicRenderers[i]) publicRenderers[i].enabled = visible && originalRendererEnabled[i];
            // Keep physical colliders as occluders: a hidden actor must not let
            // a ray interact through a desk/wall or another occupied position.
            if (!publicInteractionAllowed)
                FindFirstObjectByType<NpcDialogueUI>()?.CloseFor(this);
        }
        public void Configure(string npcName, bool judge, InteractionUI hud, CourtSession court)
        { displayName = npcName; isJudge = judge; ui = hud; session = court; }
        public string GetInteractionText() => CanInteract ? "與" + DisplayName + "交談" : "";
        public string DisplayName => CourtPresentation.IsHosted ? publicDisplayName ?? "角色" : displayName;
        public void Interact()
        {
            if (!CanInteract) return;
            var dialogue = FindFirstObjectByType<NpcDialogueUI>();
            if (dialogue) dialogue.Open(this);
            else ContinueInvestigation();
        }
        public void ContinueInvestigation()
        {
            if (isJudge && session) session.BeginHearing();
            else if (displayName == "證人" && session) session.HearWitness();
            else if (ui)
            {
                string line = displayName == "檢察官" ? "指控也需要證據支持，請確認畫面實際拍到了什麼。"
                    : displayName == "辯護律師" ? "請分清楚親眼看見的事實，與其他人的推測。"
                    : "我有進教室，但這不能說明平板去了哪裡。";
                ui.ShowMessage(displayName + "：" + line, 12);
            }
        }
    }
}
