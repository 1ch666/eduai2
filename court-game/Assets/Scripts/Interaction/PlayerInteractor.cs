using UnityEngine;

namespace EduAI.Court
{
    public sealed class PlayerInteractor : MonoBehaviour
    {
        [SerializeField] private Camera viewCamera;
        [SerializeField] private InteractionUI ui;
        [SerializeField] private ChoiceSystem choices;
        [SerializeField] private float distance = 3f;
        [SerializeField] private LayerMask layers = ~0;
        private IInteractable target;
        private MonoBehaviour targetComponent;
        public void Configure(Camera camera, InteractionUI hud, ChoiceSystem choiceSystem)
        { viewCamera = camera; ui = hud; choices = choiceSystem; }
        public void TouchInteract(string payload)
        {
            if (!FirstPersonController.TouchEnabled || !FirstPersonController.InputActive ||
                !viewCamera || (choices && choices.IsOpen) ||
                !FirstPersonController.TryTouchVector(payload, out var position) ||
                position.x < 0 || position.x > 1 || position.y < 0 || position.y > 1) return;
            // Same nearest-hit / 3m rule as desktop; taps never go through walls.
            var ray = viewCamera.ViewportPointToRay(new Vector3(position.x, position.y, 0));
            if (Physics.Raycast(ray, out var hit, distance, layers, QueryTriggerInteraction.Ignore))
                foreach (var candidate in hit.collider.GetComponentsInParent<MonoBehaviour>())
                    if (candidate is IInteractable item && candidate.isActiveAndEnabled && (!CourtPresentation.IsHosted||candidate is NPCInteractable))
                    { item.Interact(); return; }
            if (ui) ui.ShowMessage("再靠近角色或物件，然後輕點它。", 3);
        }
        private void Update()
        {
            if (FirstPersonController.TouchEnabled) { ClearTarget(); return; }
            // 最近命中的 collider 若不是 IInteractable，互動就停止：避免隔牆使用物件。
            // 選項開啟或滑鼠解鎖時暫停射線互動，但不隱藏中央準星。
            if (!viewCamera || !ui) return;
            IInteractable next = null;
            MonoBehaviour component = null;
            if (FirstPersonController.InputActive && (!choices || !choices.IsOpen))
            {
                Ray ray = viewCamera.ViewportPointToRay(new Vector3(.5f, .5f, 0));
                if (Physics.Raycast(ray, out RaycastHit hit, distance, layers, QueryTriggerInteraction.Ignore))
                {
                    foreach (MonoBehaviour candidate in hit.collider.GetComponentsInParent<MonoBehaviour>())
                        if (candidate is IInteractable interactable && candidate.isActiveAndEnabled && (!CourtPresentation.IsHosted||candidate is NPCInteractable))
                        { next = interactable; component = candidate; break; }
                }
            }
            if (!ReferenceEquals(next, target))
            {
                ClearTarget(); target = next; targetComponent = component;
                if (target is IFocusFeedback focus) focus.SetFocused(true);
            }
            ui.SetPrompt(targetComponent ? "[E] " + target.GetInteractionText() : "");
            if (targetComponent && Input.GetKeyDown(KeyCode.E)) target.Interact();
        }
        private void ClearTarget()
        {
            if (targetComponent && target is IFocusFeedback focus) focus.SetFocused(false);
            target = null; targetComponent = null;
            if (ui) ui.SetPrompt("");
        }
        private void OnDisable() { ClearTarget(); }
    }
}
