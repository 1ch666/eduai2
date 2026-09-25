using UnityEngine;

namespace EduAI.Court
{
    // Imported CC0 animation clips; these gestures do not change game state.
    public sealed class NpcActorMotion : MonoBehaviour
    {
        private Animation motion;
        private float until;
        private void Start() { motion = GetComponentInChildren<Animation>(); Play("idle"); }
        public void Speak() { until = Time.unscaledTime + 2; Play("emote-yes"); }
        private void Update() { if (until > 0 && Time.unscaledTime >= until) { until = 0; Play("idle"); } }
        private void Play(string name)
        {
            if (!motion || !motion[name]) return;
            motion[name].wrapMode = name == "idle" ? WrapMode.Loop : WrapMode.Once;
            motion.CrossFade(name, .2f);
        }
    }
}
