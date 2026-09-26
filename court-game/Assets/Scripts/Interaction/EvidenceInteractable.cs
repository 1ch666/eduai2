using UnityEngine;

namespace EduAI.Court
{
    public sealed class EvidenceInteractable : MonoBehaviour, IInteractable
    {
        [SerializeField] private CourtSession session;
        public void Configure(CourtSession court) { session = court; }
        public string GetInteractionText() => "查看證物";
        public void Interact()
        {
            if(CourtPresentation.IsHosted){CourtPresentation.OpenPanel("evidence");return;}
            if (session) session.ReviewEvidence();
            FindFirstObjectByType<NpcDialogueUI>()?.OpenEvidence(this);
        }
    }
}
