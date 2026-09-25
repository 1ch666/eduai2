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
            Require(choices.IsOpen, "Persistent button event opens choices in Play");
            choices.Choose(3);
            Require(!choices.IsOpen, "Choice closes in Play");
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
