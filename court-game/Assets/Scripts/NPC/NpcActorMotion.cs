using UnityEngine;

namespace EduAI.Court
{
    public enum NpcDialogueActivity { None, Listening, Waiting, Speaking }
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
        private Transform torso;
        private Quaternion torsoBefore,torsoAfter;
        private bool torsoAdjusted;
        private NpcDialogueActivity dialogueActivity;
        private float dialogueActivityUntil;
        public NpcDialogueActivity DialogueActivity => dialogueActivity;
        public bool ReducedMotion { get; private set; }
        public void SetReducedMotion(bool enabled)
        {
            Initialize();RestoreTorso();ReducedMotion=enabled;
            if(HasPublicState)Play(enabled?(PublicPlan.Pose=="sitting"?"sit":"idle"):PublicPlan.Clip,enabled||PublicPlan.Loop);
            else if(enabled&&!serverControlled){until=0;Play("idle",true);}
        }
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
                torso=System.Array.Find(bones,b=>b&&b.name=="torso");
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
            RestoreTorso();
            serverControlled=true; until=0;
            if (!visible || !NpcMotionPlan.TryCreate(pose,emotion,speaking,request,out var plan))
            {
                SetDialogueActivity(NpcDialogueActivity.None);
                HasPublicState=false; PublicPlan=default; ActiveClip=null;
                transform.localPosition=standingLocalPosition;
                if (motion) motion.Stop();
                return;
            }
            HasPublicState=true; PublicPlan=plan;
            // Compensate the clip's .15 model-unit rig drop only. Furniture is
            // fitted to these miniature rigs; never raise the entire body to
            // clear a desk, which leaves the soles floating above the floor.
            var lift=plan.Clip=="sit"?Vector3.up*.15f:Vector3.zero;
            transform.localPosition=standingLocalPosition+transform.localRotation*Vector3.Scale(transform.localScale,lift);
            Play(ReducedMotion?(plan.Pose=="sitting"?"sit":"idle"):plan.Clip,ReducedMotion||plan.Loop);
        }
        // Guest dialogue only. Hosted animation is driven solely by validated
        // snapshots; history retrieval / text delivery cannot override that state.
        public void Speak()
        {
            if (serverControlled || CourtPresentation.IsHosted || ReducedMotion) return;
            until=Time.unscaledTime+2; Play("emote-yes",false);
        }
        // Local dialogue UX only: never changes PublicPlan, availability, court
        // version or a server emotion. Only the correlated dialogue UI calls it.
        public void SetDialogueActivity(NpcDialogueActivity activity)
        {
            RestoreTorso();
            if(!HasPublicState||!isActiveAndEnabled)activity=NpcDialogueActivity.None;
            dialogueActivity=activity;
            dialogueActivityUntil=activity==NpcDialogueActivity.Waiting?Time.unscaledTime+25:
                activity==NpcDialogueActivity.Speaking?Time.unscaledTime+3:0;
        }
        private void Update()
        {
            RestoreTorso();
            if(dialogueActivityUntil>0&&Time.unscaledTime>=dialogueActivityUntil)
                SetDialogueActivity(NpcDialogueActivity.Listening);
            if(until>0&&Time.unscaledTime>=until){until=0;Play("idle",true);}
        }
        private void OnDisable() { SetDialogueActivity(NpcDialogueActivity.None);RestoreTorso(); }
        private void RestoreTorso()
        {
            // Undo only our own last output. If Animation has already sampled
            // the bone this frame, its fresh value is the new baseline.
            if(torsoAdjusted&&torso&&Quaternion.Angle(torso.localRotation,torsoAfter)<.001f)
                torso.localRotation=torsoBefore;
            torsoAdjusted=false;
        }
        private void LateUpdate() { ApplyPoseAdjustments(); }
        public void ApplyPoseAdjustments()
        {
            RestoreTorso();
            if(HasPublicState&&torso&&!ReducedMotion)
            {
                torsoBefore=torso.localRotation;
                var offset=PublicPlan.TorsoOffset(Time.unscaledTime);
                // Preserve explicit server emotions / gestures. Waiting is a
                // UI request indicator, not a claim that a model is running.
                if(PublicPlan.Emotion=="neutral"&&PublicPlan.Pose=="sitting"&&PublicPlan.RequestState=="idle")
                {
                    if(dialogueActivity==NpcDialogueActivity.Waiting)offset=new Vector3(4,0,3);
                    else if(dialogueActivity==NpcDialogueActivity.Speaking)offset=new Vector3(Mathf.Sin(Time.unscaledTime*2)*2,0,0);
                    else if(dialogueActivity==NpcDialogueActivity.Listening)offset=new Vector3(3,0,0);
                }
                torsoAfter=torsoBefore*Quaternion.Euler(offset);
                torso.localRotation=torsoAfter;torsoAdjusted=true;
            }
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
