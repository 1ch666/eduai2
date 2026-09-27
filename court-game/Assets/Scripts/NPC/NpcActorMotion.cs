using UnityEngine;

namespace EduAI.Court
{
    // Imported CC0 animation clips; these gestures do not change game state.
    public sealed class NpcActorMotion : MonoBehaviour
    {
        private Animation motion;
        private float until;
        private bool serverControlled;
        private bool initialized;
        private Vector3 standingLocalPosition;
        private Transform[] seatedLegs;
        private Quaternion[] seatedLegRotations;
        public bool HasPublicState { get; private set; }
        public NpcMotionPlan PublicPlan { get; private set; }
        public string ActiveClip { get; private set; }
        private void Awake() { Initialize(); }
        private void Initialize()
        {
            if(initialized) return;
            initialized=true;motion=GetComponentInChildren<Animation>();standingLocalPosition=transform.localPosition;
            foreach(var skin in GetComponentsInChildren<SkinnedMeshRenderer>(true))
            {
                if(skin.name!="body-mesh" || !skin.sharedMesh)continue;
                var bones=skin.bones;var bind=skin.sharedMesh.bindposes;
                int left=System.Array.FindIndex(bones,b=>b&&b.name=="leg-left");
                int right=System.Array.FindIndex(bones,b=>b&&b.name=="leg-right");
                if(left<0||right<0||bind.Length!=bones.Length)break;
                int lp=System.Array.IndexOf(bones,bones[left].parent),rp=System.Array.IndexOf(bones,bones[right].parent);
                if(lp<0||rp<0)break;
                seatedLegs=new[]{bones[left],bones[right]};
                seatedLegRotations=new[]{(bind[lp]*bind[left].inverse).rotation,(bind[rp]*bind[right].inverse).rotation};
                break;
            }
        }
        private void Start() { if (!serverControlled) Play("idle", true); }
        public void ApplyPublicState(string pose, string emotion, string speaking, string request, bool visible)
        {
            Initialize();
            serverControlled=true; until=0;
            if (!visible || !NpcMotionPlan.TryCreate(pose,emotion,speaking,request,out var plan))
            {
                HasPublicState=false; PublicPlan=default; ActiveClip=null;
                transform.localPosition=standingLocalPosition;
                if (motion) motion.Stop();
                return;
            }
            HasPublicState=true; PublicPlan=plan;
            // The imported clip is floor-sitting: compensate its .15 model-unit
            // rig drop, then seat it .65 world units above the standing floor.
            // Audited in the authored court (desks 1.1 / 1.3 high), not only an
            // isolated model preview. Never move the interaction/collision root.
            var lift=plan.Clip=="sit"?Vector3.up*.15f:Vector3.zero;
            var chairLift=plan.Clip=="sit"?Vector3.up*.65f:Vector3.zero;
            if(transform.parent) chairLift=transform.parent.InverseTransformVector(chairLift);
            transform.localPosition=standingLocalPosition+transform.localRotation*Vector3.Scale(transform.localScale,lift)+chairLift;
            Play(plan.Clip,plan.Loop);
        }
        // Guest dialogue only. Hosted animation is driven solely by validated
        // snapshots; history retrieval / text delivery cannot override that state.
        public void Speak()
        {
            if (serverControlled || CourtPresentation.IsHosted) return;
            until=Time.unscaledTime+2; Play("emote-yes",false);
        }
        private void Update() { if (until > 0 && Time.unscaledTime >= until) { until = 0; Play("idle",true); } }
        private void LateUpdate() { ApplyPoseAdjustments(); }
        public void ApplyPoseAdjustments()
        {
            // This miniature rig has one bone per leg, not articulated knees.
            // The licensed floor-sit clips point both soles at the audience.
            // Keep the legs hanging below the desk using the rig's bind pose;
            // apply after animation, never as an accumulating rotation.
            if(!HasPublicState||ActiveClip!="sit"||seatedLegs==null)return;
            for(int i=0;i<seatedLegs.Length;i++)
                if(seatedLegs[i])seatedLegs[i].localRotation=seatedLegRotations[i];
        }
        private void Play(string name, bool loop)
        {
            if (!motion || !motion[name]) return;
            // Duplicate or unrelated snapshots do not restart an active gesture.
            motion[name].wrapMode = loop ? WrapMode.Loop : WrapMode.ClampForever;
            if (ActiveClip==name && motion.IsPlaying(name)) return;
            motion.CrossFade(name, .2f);
            ActiveClip=name;
        }
    }
}
