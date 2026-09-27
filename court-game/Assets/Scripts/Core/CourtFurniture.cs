using UnityEngine;

namespace EduAI.Court.Core
{
    // Presentation-only fitting for the existing miniature character rigs.
    // Kept out of saved scene data: legacy guest practice remains unchanged.
    public static class CourtFurniture
    {
        public const float DeskHeight = .68f;
        public const float SeatHeight = .36f;
        public static void Ensure()
        {
            if (GameObject.Find("HostedFurniture")) return;
            var desk = GameObject.Find("JudgeDesk");
            if (!desk) return;
            var material = desk.GetComponent<Renderer>().sharedMaterial;
            var root = new GameObject("HostedFurniture").transform;
            FitDesk("JudgeDesk", "CourtStartButton");
            FitDesk("DefenseDesk", "EvidenceA");
            FitDesk("ProsecutorDesk", null);
            FitDesk("WitnessStand", null);
            // Replace the old solid chair block, not the player's floor/collider.
            var oldChair = GameObject.Find("JudgeChair");
            if (oldChair) oldChair.SetActive(false);
            var layout = CourtSeatLayout.Ensure();
            foreach (var pair in new[] {
                new[]{"judge-seat","judge"}, new[]{"prosecutor-seat","prosecutor"},
                new[]{"counsel-seat","counsel"}, new[]{"respondent-seat","respondent"},
                new[]{"witness-seat","witness"}})
            {
                if (!layout.TryResolve(pair[0], pair[1], out var seat)) continue;
                var center = seat.AnimationAnchor.position; center.y = 0;
                var chair = new GameObject(pair[0] + "-chair").transform;
                chair.SetParent(root, false); chair.position = center;
                Block(chair,"Seat",new Vector3(0,SeatHeight-.05f,.12f),new Vector3(1,.1f,.7f),material);
                Block(chair,"Back",new Vector3(0,.73f,.43f),new Vector3(1,.74f,.1f),material);
                foreach (float x in new[]{-.42f,.42f}) foreach(float z in new[]{-.16f,.4f})
                    Block(chair,"Leg",new Vector3(x,(SeatHeight-.1f)/2,z),new Vector3(.08f,SeatHeight-.1f,.08f),material);
            }
            Physics.SyncTransforms();
        }
        private static void FitDesk(string name, string itemName)
        {
            var desk = GameObject.Find(name); if (!desk) return;
            float oldTop = desk.transform.position.y + desk.transform.localScale.y/2;
            var scale = desk.transform.localScale; scale.y = DeskHeight; desk.transform.localScale = scale;
            var position = desk.transform.position; position.y = DeskHeight/2; desk.transform.position = position;
            var item = itemName == null ? null : GameObject.Find(itemName);
            if (item) item.transform.position += Vector3.up * (DeskHeight-oldTop);
        }
        private static void Block(Transform parent,string name,Vector3 position,Vector3 size,Material material)
        {
            var block = GameObject.CreatePrimitive(PrimitiveType.Cube); block.name=name;
            block.transform.SetParent(parent,false); block.transform.localPosition=position; block.transform.localScale=size;
            block.GetComponent<Renderer>().sharedMaterial=material;
        }
    }
}
