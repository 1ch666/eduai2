using UnityEngine;
using UnityEngine.Events;

namespace EduAI.Court
{
    public sealed class CourtButton : MonoBehaviour, IInteractable, IFocusFeedback
    {
        [SerializeField] private Renderer buttonRenderer;
        [SerializeField] private UnityEvent onPressed = new UnityEvent();
        private MaterialPropertyBlock highlight;
        public UnityEvent OnPressed => onPressed;
        public void Configure(Renderer targetRenderer) { buttonRenderer = targetRenderer; }
        public string GetInteractionText() => CourtPresentation.IsHosted ? "開啟本案程序" : "開庭";
        public void Interact() { if (CourtPresentation.IsHosted) { CourtPresentation.OpenPanel("actions"); return; } onPressed.Invoke(); }
        private void Awake() { if (!buttonRenderer) buttonRenderer = GetComponentInChildren<Renderer>(); }
        public void SetFocused(bool focused)
        {
            if (!buttonRenderer) return;
            if (!focused) { buttonRenderer.SetPropertyBlock(null); return; }
            if (highlight == null) highlight = new MaterialPropertyBlock();
            highlight.SetColor("_Color", new Color(.8f, .9f, .65f));
            buttonRenderer.SetPropertyBlock(highlight);
        }
        private void OnDisable() { SetFocused(false); }
    }
}
