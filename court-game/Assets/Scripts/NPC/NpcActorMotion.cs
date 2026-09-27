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
        public bool HasPublicState { get; private set; }
        public NpcMotionPlan PublicPlan { get; private set; }
        public string ActiveClip { get; private set; }
        private void Awake() { Initialize(); }
        private void Initialize()
        {
            if(initialized) return;
            initialized=true;motion=GetComponentInChildren<Animation>();standingLocalPosition=transform.localPosition;
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
            // All three audited Kenney sit clips lower the rig root by .15
            // model units. Seat anchors describe an elevated chair position,
            // not floor sitting. Move only the visual model, never the NPC
            // interaction/collision root or the authoritative role mapping.
            var lift=plan.Clip=="sit"?Vector3.up*.15f:Vector3.zero;
            transform.localPosition=standingLocalPosition+transform.localRotation*Vector3.Scale(transform.localScale,lift);
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
