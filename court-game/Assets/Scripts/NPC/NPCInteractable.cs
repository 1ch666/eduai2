using UnityEngine;

namespace EduAI.Court
{
    public sealed class NPCInteractable : MonoBehaviour, IInteractable
    {
        [SerializeField] private string displayName = "法官";
        [SerializeField] private bool isJudge;
        [SerializeField] private InteractionUI ui;
        [SerializeField] private CourtSession session;
        public void Configure(string npcName, bool judge, InteractionUI hud, CourtSession court)
        { displayName = npcName; isJudge = judge; ui = hud; session = court; }
        public string GetInteractionText() => "與" + displayName + "交談";
        public string DisplayName => displayName;
        public void Interact()
        {
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
