using System;
using UnityEditor;
using UnityEngine;

namespace EduAI.Court.Editor
{
    // 真正進入 Play 後測試物理與 UnityEvent；不假稱已測鍵盤／瀏覽器手勢。
    [InitializeOnLoad]
    public static class CourtPlayTests
    {
        private const string RunningKey = "EduAI.Court.PlayTestsRunning";
        private static double readyAt;
        static CourtPlayTests() { EditorApplication.playModeStateChanged += OnModeChanged; }
        public static void Run()
        {
            CourtProjectBuilder.ValidateScene();
            SessionState.SetBool(RunningKey, true);
            EditorApplication.EnterPlaymode();
        }
        private static void OnModeChanged(PlayModeStateChange state)
        {
            if (!SessionState.GetBool(RunningKey, false)) return;
            if (state == PlayModeStateChange.EnteredPlayMode)
            {
                readyAt = EditorApplication.timeSinceStartup + 1;
                EditorApplication.update += TestWhenReady;
            }
        }
        private static void TestWhenReady()
        {
            if (EditorApplication.timeSinceStartup < readyAt) return;
            EditorApplication.update -= TestWhenReady;
            int exitCode = 0;
            try { Test(); Debug.Log("COURT_PLAY_TESTS_PASSED"); }
            catch (Exception exception) { Debug.LogException(exception); exitCode = 1; }
            finally
            {
                SessionState.SetBool(RunningKey, false);
                EditorApplication.Exit(exitCode);
            }
        }
        private static void Test()
        {
            var player = UnityEngine.Object.FindFirstObjectByType<FirstPersonController>();
            var controller = player.GetComponent<CharacterController>();
            Require(!player.TouchMode, "Desktop remains the default");
            Require(!FirstPersonController.TryTouchVector("NaN,1", out _), "Reject invalid touch input");
            Require(FirstPersonController.TryTouchVector("0.5,0.25", out var normalized) && normalized.x == .5f, "Parse normalized touch");
            player.EnableTouchControls();
            var mobileChoices = UnityEngine.Object.FindFirstObjectByType<ChoiceSystem>();
            player.GetComponent<PlayerInteractor>().TouchInteract("0.5,0.5");
            Require(!mobileChoices.IsOpen, "Distant taps cannot interact");
            Teleport(controller, new Vector3(0, .05f, 6.8f));
            player.GetComponent<PlayerInteractor>().TouchInteract("0.5,0.5");
            var dialogue = UnityEngine.Object.FindFirstObjectByType<NpcDialogueUI>();
            if (dialogue)
            {
                Require(NpcDialogueUI.IsOpen, "Near NPC tap opens native dialogue");
                Require(!FirstPersonController.InputActive, "Dialogue blocks movement, E and choices");
                foreach(var text in dialogue.GetComponentsInChildren<UnityEngine.UI.Text>(true))
                    Require(!text.supportRichText, "Dialogue is plain text");
                var field=dialogue.GetComponentInChildren<UnityEngine.UI.InputField>(true);
                Require(field && field.characterLimit==400,"Dialogue input is bounded");
                field.text="<b>你親眼看見什麼？</b>";
                dialogue.Submit();dialogue.Close();
                Require(!NpcDialogueUI.IsOpen,"Close cancels pending dialogue");
                var judge=GameObject.Find("Judge").GetComponent<NPCInteractable>();
                Require(judge.transform.Find("CharacterModel"),"Imported model attached to NPC");
                dialogue.Open(judge);dialogue.ContinueInvestigation();
            }
            Require(mobileChoices.IsOpen, "Near NPC can continue into original choices");
            mobileChoices.ChooseFromTouch(3);
            Require(!mobileChoices.IsOpen, "Touch answer closes choices");
            if(dialogue)
            {
                var camera=Camera.main;var rotation=camera.transform.localRotation;float fov=camera.fieldOfView;
                var evidence=UnityEngine.Object.FindFirstObjectByType<EvidenceInteractable>();
                evidence.Interact();
                Require(NpcDialogueUI.IsOpen&&!FirstPersonController.InputActive,"Evidence closeup blocks movement");
                Require(Mathf.Abs(camera.fieldOfView-32)<.01f,"Evidence uses closeup lens");
                dialogue.Submit();dialogue.Close();
                Require(Quaternion.Angle(camera.transform.localRotation,rotation)<.01f&&Mathf.Abs(camera.fieldOfView-fov)<.01f,"Close restores original view");
                var flags=System.Reflection.BindingFlags.Instance|System.Reflection.BindingFlags.NonPublic;
                var storedPitch=(float)typeof(FirstPersonController).GetField("pitch",flags).GetValue(player);
                Require(Mathf.Abs(Mathf.DeltaAngle(storedPitch,camera.transform.localEulerAngles.x))<.01f,"Restored camera pitch matches movement controller");
                Require(!(bool)typeof(FirstPersonController).GetField("wasDragging",flags).GetValue(player),"Closing dialogue clears stale drag origin");
                dialogue.ResetHistory();
            }
            var hosted = UnityEngine.Object.FindFirstObjectByType<CourtPresentation>();
            Require(hosted && !CourtPresentation.IsHosted, "Classic mode remains default");
            hosted.SetView("{\"mode\":\"seat\",\"role\":\"observer\",\"procedure\":\"juvenile\"}");
            Require(!CourtPresentation.IsHosted, "Juvenile spectator camera refused");
            hosted.SetView("{\"mode\":\"seat\",\"role\":\"judge\",\"procedure\":\"civil\"}");
            Require(CourtPresentation.IsHosted && !FirstPersonController.InputActive, "Judge seat pauses movement");
            Require(Mathf.Abs(player.transform.position.z - 8.8f) < .01f, "Judge seat position");
            hosted.SetView("{\"mode\":\"walk\",\"role\":\"judge\",\"procedure\":\"civil\"}");
            Require(FirstPersonController.InputActive, "Hosted walking restores movement");
            TestPublicActors(dialogue);
            player.enabled = false;
            player.GetComponent<PlayerInteractor>().enabled = false;
            Teleport(controller, new Vector3(0, 2, 0));
            for (int i = 0; i < 100; i++) controller.Move(Vector3.down * .05f);
            Require(controller.isGrounded && player.transform.position.y > -.1f, "Floor collision");
            for (int i = 0; i < 200; i++) controller.Move(Vector3.right * .1f);
            Require(player.transform.position.x < 8.7f, "East wall collision");
            Teleport(controller, new Vector3(-3, .05f, 0));
            for (int i = 0; i < 40; i++) controller.Move(Vector3.forward * .1f);
            Require(player.transform.position.z < 1.2f, "Defense desk collision");
            // 將玩家移開測試射線，避免撞到自己的 CharacterController。
            Teleport(controller, new Vector3(0, .05f, -1));
            Require(Physics.Raycast(new Vector3(-3, 1.23f, -.5f), Vector3.forward, out RaycastHit evidenceHit, 3), "Evidence ray hit");
            Require(evidenceHit.collider.GetComponent<EvidenceInteractable>(), "Evidence target within 3m");
            Require(Physics.Raycast(new Vector3(10, 1.5f, 0), Vector3.left, out RaycastHit wallHit, 3), "Wall ray hit");
            Require(wallHit.collider.name == "East", "Wall blocks nearest-hit interaction ray");
            var button = UnityEngine.Object.FindFirstObjectByType<CourtButton>();
            button.SetFocused(true);
            Require(button.GetComponent<Renderer>().HasPropertyBlock(), "Button highlight");
            button.SetFocused(false);
            Require(!button.GetComponent<Renderer>().HasPropertyBlock(), "Highlight cleared");
            button.Interact();
            var choices = UnityEngine.Object.FindFirstObjectByType<ChoiceSystem>();
            Require(!choices.IsOpen && CourtPresentation.LastPanelRequest == "actions", "Hosted court button requests server panel, never local tablet choices");
            var cloudEvidence = UnityEngine.Object.FindFirstObjectByType<EvidenceInteractable>();
            Require(PlayerInteractor.AllowedInCurrentMode(cloudEvidence) && PlayerInteractor.AllowedInCurrentMode(button), "Hosted ray and touch allow both boxes");
            cloudEvidence.Interact();
            Require(CourtPresentation.LastPanelRequest == "evidence" && !NpcDialogueUI.IsOpen, "Hosted evidence uses current case panel, not legacy tablet evidence");
        }
        private static void TestPublicActors(NpcDialogueUI dialogue)
        {
            var runtime = Core.CourtRuntimeState.Active;
            var witness = GameObject.Find("Witness").GetComponent<NPCInteractable>();
            Require(runtime && !witness.CanInteract, "Hosted actor fails closed before snapshot");
            Require(!PlayerInteractor.AllowedInCurrentMode(witness), "Ray and touch reject unsynchronized NPC");
            var snapshot = Networking.CourtWire.Snapshot(System.IO.File.ReadAllText("Assets/Editor/Fixtures/court-v1.json"));
            runtime.ApplySnapshot(JsonUtility.ToJson(snapshot));
            Require(witness.CanInteract && witness.DisplayName == "證人", "Public NPC projection enables matching actor");
            var motion=witness.GetComponentInChildren<NpcActorMotion>();
            Require(motion && motion.HasPublicState && motion.PublicPlan.Pose==snapshot.state.npcs[0].pose, "Validated snapshot drives public motion state");
            TestMotionPlans(motion);
            var layout = Core.CourtSeatLayout.Active;
            Require(layout && layout.TryResolve("witness-seat", "witness", out _), "Public seat resolves by explicit server role and seat");
            Require(!layout.TryResolve("judge-seat", "witness", out _) && !layout.TryResolve("unknown-seat", "witness", out _), "No guessed or unsupported seat mapping");
            layout.TryResolve("witness-seat", "witness", out var witnessSeat);
            Require(witnessSeat.CameraAnchor && witnessSeat.StandAnchor && witnessSeat.InteractionAnchor && witnessSeat.AccessibilityAnchor && witnessSeat.AnimationAnchor, "Every mapped seat has five spatial anchors");
            Require(Vector3.Distance(witness.transform.position, witnessSeat.AnimationAnchor.position) < .001f, "Actor uses server-selected seat position");
            Require(!GameObject.Find("Judge").GetComponent<NPCInteractable>().CanInteract, "Unlisted NPC stays disabled");
            dialogue.Open(witness); Require(NpcDialogueUI.IsOpen, "Visible NPC can open dialogue");
            snapshot.stateVersion++; snapshot.eventSequence++; snapshot.eventId = Guid.NewGuid().ToString();
            snapshot.state.npcs[0].visible = false; snapshot.state.npcs[0].interactable = false;
            runtime.ApplySnapshot(JsonUtility.ToJson(snapshot));
            Require(!witness.CanInteract && !NpcDialogueUI.IsOpen, "Revoked NPC closes dialogue and blocks interaction");
            Require(!motion.HasPublicState && motion.ActiveClip==null, "Revoked visibility clears motion and stale public state");
            foreach (var renderer in witness.GetComponentsInChildren<Renderer>(true)) Require(!renderer.enabled, "Invisible NPC renderers hidden");
            runtime.ApplySnapshot(System.IO.File.ReadAllText("Assets/Editor/Fixtures/court-v1.json"));
            Require(!witness.CanInteract, "Stale visible snapshot cannot restore revoked actor");
            snapshot.stateVersion++; snapshot.eventSequence++; snapshot.eventId = Guid.NewGuid().ToString();
            snapshot.state.npcs[0].visible = snapshot.state.npcs[0].interactable = true;
            snapshot.state.npcs[0].displayName = "本案證人";
            runtime.ApplySnapshot(JsonUtility.ToJson(snapshot));
            Require(witness.CanInteract && witness.DisplayName == "本案證人", "New projection restores actor with server label");
            bool rendered = false; foreach (var renderer in witness.GetComponentsInChildren<Renderer>(true)) rendered |= renderer.enabled;
            Require(rendered, "Model renderers restored after temporary hiding");
            runtime.MarkUnavailable(); Require(!witness.CanInteract && !motion.HasPublicState, "Unavailable sync blocks NPC and stops motion");
            runtime.ApplySnapshot(JsonUtility.ToJson(snapshot)); Require(witness.CanInteract, "Same validated snapshot restores availability");
            dialogue.Open(witness);
            snapshot.stateVersion++; snapshot.eventSequence++; snapshot.eventId = Guid.NewGuid().ToString();
            snapshot.state.npcs[0].seatId = "counsel-seat"; snapshot.state.npcs[0].roleId = "counsel";
            runtime.ApplySnapshot(JsonUtility.ToJson(snapshot));
            Require(witness.CanInteract && !NpcDialogueUI.IsOpen && witness.transform.position.x == -3, "Changed public role mapping moves actor and safely closes old closeup");
            var mappedPosition = witness.transform.position;
            snapshot.stateVersion++; snapshot.eventSequence++; snapshot.eventId = Guid.NewGuid().ToString();
            snapshot.state.npcs[0].seatId = "unknown-seat";
            runtime.ApplySnapshot(JsonUtility.ToJson(snapshot));
            Require(!witness.CanInteract && witness.transform.position == mappedPosition, "Unknown seat disables actor without relocating to origin");
            runtime.ClearState(); Require(!witness.CanInteract, "Clearing session disables old actor");
        }
        private static void TestMotionPlans(NpcActorMotion motion)
        {
            string[] poses={"idle","speaking","listening","thinking","objecting","presentingEvidence","sitting","standing","turnHeadToSpeaker"};
            string[] clips={"idle","emote-yes","idle","idle","emote-no","interact-right","sit","idle","idle"};
            var animation=motion.GetComponentInChildren<Animation>();
            for(int i=0;i<poses.Length;i++)
                foreach(var emotion in new[]{"neutral","nervous","confident","surprised"})
                {
                    Require(NpcMotionPlan.TryCreate(poses[i],emotion,"silent","idle",out var plan) && plan.Clip==clips[i], "Finite deterministic pose mapping: "+poses[i]);
                    Require(animation[plan.Clip]!=null, "Mapped clip actually imported: "+plan.Clip);
                    motion.ApplyPublicState(poses[i],emotion,"silent","idle",true);
                    Require(motion.HasPublicState && motion.ActiveClip==clips[i] && motion.PublicPlan.Emotion==emotion, "Runtime consumes public visual state");
                }
            motion.ApplyPublicState("objecting","neutral","silent","idle",true);
            animation["emote-no"].time=.25f;
            motion.ApplyPublicState("objecting","neutral","silent","idle",true);
            Require(Mathf.Abs(animation["emote-no"].time-.25f)<.001f, "Duplicate projection does not restart motion");
            motion.ApplyPublicState("sitting","nervous","speaking","idle",true);
            motion.Speak();
            Require(motion.ActiveClip=="sit", "Dialogue receipt cannot stand a hosted actor up");
            motion.ApplyPublicState("speaking","neutral","speaking","pending",true);
            Require(motion.ActiveClip=="idle", "Pending response does not simulate delivered speech");
            Require(!NpcMotionPlan.TryCreate("run-script","neutral","silent","idle",out _) &&
                !NpcMotionPlan.TryCreate("idle","arbitrary","silent","idle",out _) &&
                !NpcMotionPlan.TryCreate("idle","neutral","unknown","idle",out _) &&
                !NpcMotionPlan.TryCreate("idle","neutral","silent","unknown",out _), "Reject arbitrary animation vocabulary");
            motion.ApplyPublicState("unknown","neutral","silent","idle",true);
            Require(!motion.HasPublicState && motion.ActiveClip==null && !animation.isPlaying, "Unknown motion clears prior animation");
            // Restore through the authoritative store, not a test-owned NPC copy.
            Core.CourtRuntimeState.Active.ApplySnapshot(JsonUtility.ToJson(Core.CourtRuntimeState.Active.Snapshot));
        }
        private static void Teleport(CharacterController controller, Vector3 position)
        {
            controller.enabled = false;
            controller.transform.position = position;
            controller.enabled = true;
            Physics.SyncTransforms();
        }
        private static void Require(bool condition, string label)
        { if (!condition) throw new InvalidOperationException("Play test failed: " + label); }
    }
}
