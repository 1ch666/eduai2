using UnityEngine;
using UnityEngine.Scripting;

namespace EduAI.Court
{
    // No credentials, scores, case facts or legal decisions enter this bridge.
    // The same scene remains the classic game until the trusted host selects a view.
    [Preserve]
    public sealed class CourtPresentation : MonoBehaviour
    {
        public static bool IsHosted { get; private set; }
        [System.Serializable] private class ViewRequest { public string mode; public string role; public string procedure; }
        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void Install()
        {
            IsHosted = false;
            new GameObject("CourtPresentation").AddComponent<CourtPresentation>();
        }
        [Preserve]
        public void SetView(string json)
        {
            if (string.IsNullOrEmpty(json) || json.Length > 240 || !FirstPersonController.Active) return;
            ViewRequest request;
            try { request = JsonUtility.FromJson<ViewRequest>(json); } catch { return; }
            if (request == null || (request.mode != "seat" && request.mode != "overview" && request.mode != "walk")) return;
            if (request.procedure != "civil" && request.procedure != "criminal" && request.procedure != "juvenile") return;
            Vector3 seat;
            switch (request.role)
            {
                case "judge": seat = new Vector3(0, .1f, 8.8f); break;
                case "claimant": case "claimantCounsel": seat = new Vector3(3, .1f, 3.2f); break;
                case "respondent": case "respondentCounsel": case "juvenile": case "assistant": seat = new Vector3(-3, .1f, 3.2f); break;
                case "observer": if (request.procedure == "juvenile") return; seat = new Vector3(0, .1f, -3); break;
                default: return;
            }
            if (!IsHosted)
            {
                IsHosted = true;
                // Hide legacy tablet case labels/UI, not the court geometry.
                foreach (var text in FindObjectsByType<UnityEngine.UI.Text>(FindObjectsSortMode.None)) text.gameObject.SetActive(false);
                var choices = FindFirstObjectByType<ChoiceSystem>(); if (choices) choices.enabled = false;
                BuildCharacters();
            }
            Vector3 target = request.role == "judge" ? new Vector3(0, 1.3f, 2) : new Vector3(0, 1.6f, 8);
            if (request.mode == "overview") { seat = new Vector3(7, 4, -7); target = new Vector3(0, 1, 4); }
            if (request.mode == "walk") { seat = new Vector3(0, .1f, -1); target = new Vector3(0, 1.6f, 8); }
            FirstPersonController.Active.SetSeat(seat, target, request.mode != "walk");
        }
        private static void BuildCharacters()
        {
            // Original primitive-based low-poly figures: no external asset download.
            foreach (var npc in FindObjectsByType<NPCInteractable>(FindObjectsSortMode.None))
            {
                var old = npc.GetComponent<Renderer>();
                if (!old) continue;
                var material = old.sharedMaterial;
                old.enabled = false;
                Part(npc.transform, "Torso", PrimitiveType.Cube, new Vector3(0, -.05f, 0), new Vector3(.58f, .75f, .3f), material);
                Part(npc.transform, "Head", PrimitiveType.Sphere, new Vector3(0, .58f, 0), new Vector3(.34f, .4f, .34f), material);
                for (int side = -1; side <= 1; side += 2)
                {
                    Part(npc.transform, "Arm", PrimitiveType.Cube, new Vector3(side * .37f, -.05f, 0), new Vector3(.16f, .7f, .18f), material);
                    Part(npc.transform, "Leg", PrimitiveType.Cube, new Vector3(side * .17f, -.66f, 0), new Vector3(.22f, .55f, .24f), material);
                }
            }
        }
        private static void Part(Transform parent, string name, PrimitiveType type, Vector3 position, Vector3 scale, Material material)
        {
            var part = GameObject.CreatePrimitive(type); part.name = name;
            part.transform.SetParent(parent, false); part.transform.localPosition = position; part.transform.localScale = scale;
            Destroy(part.GetComponent<Collider>()); part.GetComponent<Renderer>().sharedMaterial = material;
        }
    }
}
