namespace EduAI.Court
{
    // Fixed presentation vocabulary, not an Animator parameter supplied by AI.
    // This value contains no case facts, prompts, transcript or legal state.
    public readonly struct NpcMotionPlan
    {
        public readonly string Pose, Emotion, SpeakingState, RequestState, Clip;
        public readonly bool Loop;
        public NpcMotionPlan(string pose, string emotion, string speaking, string request, string clip, bool loop)
        { Pose=pose; Emotion=emotion; SpeakingState=speaking; RequestState=request; Clip=clip; Loop=loop; }

        public static bool TryCreate(string pose, string emotion, string speaking, string request, out NpcMotionPlan plan)
        {
            plan=default;
            if (emotion!="neutral" && emotion!="nervous" && emotion!="confident" && emotion!="surprised") return false;
            if (speaking!="silent" && speaking!="speaking") return false;
            if (request!="idle" && request!="pending" && request!="failed") return false;
            string clip; bool loop=true;
            switch(pose)
            {
                case "sitting": clip="sit"; break;
                case "speaking": clip="emote-yes"; break;
                case "objecting": clip="emote-no"; loop=false; break;
                case "presentingEvidence": clip="interact-right"; loop=false; break;
                case "idle": case "standing": case "listening": case "thinking": case "turnHeadToSpeaker":
                    // These states retain a neutral body until dedicated poses /
                    // public speaking-target tracking exist; do not invent a target.
                    clip="idle"; break;
                default: return false;
            }
            // Speaking must not silently stand a seated character up, cancel a
            // specific gesture, or animate while the request has failed/is pending.
            if (request=="idle" && speaking=="speaking" && (pose=="idle" || pose=="standing")) clip="emote-yes";
            if (request!="idle" && pose=="speaking") clip="idle";
            plan=new NpcMotionPlan(pose,emotion,speaking,request,clip,loop);
            return true;
        }
    }
}
