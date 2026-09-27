using System;
using System.IO;
using UnityEditor;
using UnityEditor.Events;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEngine;
using UnityEngine.UI;

namespace EduAI.Court.Editor
{
    // Explicit menu/batch command: never overwrite a user's scene on domain reload.
    public static class CourtProjectBuilder
    {
        private const string ScenePath = "Assets/Scenes/Courtroom.unity";
        private static Font font;
        [MenuItem("EduAI/Create Courtroom Prototype")]
        public static void CreateScene()
        {
            if (File.Exists(ScenePath))
                throw new InvalidOperationException("Courtroom already exists. Preserve it; use ValidateScene or move it before rebuilding.");
            foreach (string path in new[] { "Assets/Scenes", "Assets/Materials", "Assets/Prefabs", "Assets/UI" })
                Directory.CreateDirectory(path);
            AssetDatabase.Refresh();
            font = AssetDatabase.LoadAssetAtPath<Font>("Assets/UI/NotoSansCJKtc-Regular.otf");
            if (!font) throw new InvalidOperationException("Missing bundled Traditional Chinese font in Assets/UI.");
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
            var root = new GameObject("Courtroom").transform;
            Material stone = Material("Stone", new Color(.72f,.74f,.72f));
            Material wood = Material("Wood", new Color(.32f,.25f,.19f));
            Material accent = Material("Accent", new Color(.3f,.42f,.43f));
            Block(root,"Floor",new Vector3(0,-.15f,0),new Vector3(18,.3f,24),stone);
            var walls = new GameObject("Walls").transform; walls.SetParent(root);
            Block(walls,"North",new Vector3(0,2.5f,12),new Vector3(18,5,.3f),stone);
            Block(walls,"South",new Vector3(0,2.5f,-12),new Vector3(18,5,.3f),stone);
            Block(walls,"West",new Vector3(-9,2.5f,0),new Vector3(.3f,5,24),stone);
            Block(walls,"East",new Vector3(9,2.5f,0),new Vector3(.3f,5,24),stone);
            Block(root,"JudgeDesk",new Vector3(0,.65f,8),new Vector3(5,1.3f,1.2f),wood);
            Block(root,"JudgeChair",new Vector3(0,.4f,9.5f),new Vector3(1,.8f,1),wood);
            Block(root,"DefenseDesk",new Vector3(-3,.55f,2),new Vector3(3,1.1f,1.2f),wood);
            Block(root,"ProsecutorDesk",new Vector3(3,.55f,2),new Vector3(3,1.1f,1.2f),wood);
            Block(root,"WitnessStand",new Vector3(5,.5f,6),new Vector3(2,1,1.2f),wood);
            var audience = new GameObject("AudienceArea").transform; audience.SetParent(root);
            for (int row=0;row<3;row++)
                foreach (float x in new[] {-4f,4f})
                    Block(audience,"Bench",new Vector3(x,.4f,-4-row*2),new Vector3(4,.8f,.9f),wood);

            var lightObject = new GameObject("Daylight");
            var light = lightObject.AddComponent<Light>(); light.type = LightType.Directional;
            light.intensity = 1.1f; lightObject.transform.rotation = Quaternion.Euler(50,-30,0);
            RenderSettings.ambientLight = new Color(.6f,.62f,.65f);
            var canvasObject = new GameObject("Canvas",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler));
            var canvas = canvasObject.GetComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasObject.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280,720); scaler.matchWidthOrHeight = .5f;
            Text crosshair = TextNode(canvas.transform,"Crosshair","+",30);
            Rect(crosshair.rectTransform,new Vector2(.5f,.5f),new Vector2(64,64),Vector2.zero);
            crosshair.verticalOverflow = VerticalWrapMode.Overflow;
            Text prompt = TextNode(canvas.transform,"InteractionPrompt","",23);
            Rect(prompt.rectTransform,new Vector2(.5f,.43f),new Vector2(650,44),Vector2.zero);
            Text message = TextNode(canvas.transform,"Message","",22);
            Rect(message.rectTransform,new Vector2(.5f,.85f),new Vector2(850,135),Vector2.zero);
            message.color = Color.white;
            var panel = new GameObject("ChoicePanel",typeof(RectTransform),typeof(Image));
            panel.transform.SetParent(canvas.transform,false);
            Rect((RectTransform)panel.transform,new Vector2(.5f,0),new Vector2(640,180),new Vector2(0,110));
            panel.GetComponent<Image>().color = new Color(.08f,.1f,.12f,.94f);
            Text options = TextNode(panel.transform,"Choices","",24);
            options.alignment = TextAnchor.MiddleLeft;
            Rect(options.rectTransform,new Vector2(.5f,.5f),new Vector2(590,160),Vector2.zero);
            Text controls = TextNode(canvas.transform,"Controls","WASD 移動  |  滑鼠轉向  |  Space 跳躍  |  E 互動  |  1–4 選擇  |  Esc / 點擊恢復滑鼠",16);
            Rect(controls.rectTransform,new Vector2(.5f,0),new Vector2(1180,30),new Vector2(0,20));
            var ui = canvasObject.AddComponent<InteractionUI>(); ui.Configure(prompt,message);
            var choices = canvasObject.AddComponent<ChoiceSystem>(); choices.Configure(panel,options);
            var session = new GameObject("CourtSession").AddComponent<CourtSession>(); session.Configure(ui,choices);
            var player = new GameObject("Player"); player.transform.SetParent(root);
            player.transform.position = new Vector3(0,.1f,-1);
            var controller = player.AddComponent<CharacterController>();
            controller.height = 1.8f; controller.radius = .3f; controller.center = new Vector3(0,.9f,0);
            var cameraObject = new GameObject("Camera"); cameraObject.transform.SetParent(player.transform,false);
            cameraObject.transform.localPosition = new Vector3(0,1.65f,0); cameraObject.tag = "MainCamera";
            var camera = cameraObject.AddComponent<Camera>(); camera.nearClipPlane = .05f; camera.farClipPlane = 80;
            camera.backgroundColor = new Color(.68f,.72f,.76f); camera.clearFlags = CameraClearFlags.SolidColor;
            cameraObject.AddComponent<AudioListener>();
            player.AddComponent<FirstPersonController>().Configure(camera);
            player.AddComponent<PlayerInteractor>().Configure(camera,ui,choices);
            var button = Block(root,"CourtStartButton",new Vector3(0,1.42f,7.55f),new Vector3(.7f,.24f,.5f),accent);
            var courtButton = button.AddComponent<CourtButton>();
            courtButton.Configure(button.GetComponent<Renderer>());
            UnityEventTools.AddPersistentListener(courtButton.OnPressed,session.BeginHearing);
            WorldLabel(button.transform,"開庭",new Vector3(0,.6f,0));
            Npc(root,"Judge","法官",new Vector3(0,1,9.1f),true,accent,ui,session);
            Npc(root,"Prosecutor","檢察官",new Vector3(3,1,3.5f),false,accent,ui,session);
            Npc(root,"Lawyer","辯護律師",new Vector3(-3,1,3.5f),false,accent,ui,session);
            Npc(root,"Defendant","被告",new Vector3(-5,1,4.8f),false,accent,ui,session);
            Npc(root,"Witness","證人",new Vector3(5,1,7.2f),false,accent,ui,session);
            var evidence = Block(root,"EvidenceA",new Vector3(-3,1.23f,1.7f),new Vector3(.4f,.25f,.4f),accent);
            evidence.AddComponent<EvidenceInteractable>().Configure(session);
            WorldLabel(evidence.transform,"證物 A",new Vector3(0,.7f,0));
            PlayerSettings.companyName = "EduAI"; PlayerSettings.productName = "EduAI Court";
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
            PlayerSettings.WebGL.template = "PROJECT:Court";
            // Legacy Input Manager uses built-in mouse axes; no paid controller package.
            var settings = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);
            var input = settings.FindProperty("activeInputHandler");
            if (input != null) { input.intValue = 0; settings.ApplyModifiedPropertiesWithoutUndo(); }
            EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene(),ScenePath);
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath,true) };
            AssetDatabase.SaveAssets(); ValidateScene();
        }
        private static Material Material(string name,Color color)
        {
            string path = "Assets/Materials/"+name+".mat";
            var material = AssetDatabase.LoadAssetAtPath<Material>(path);
            if (material) return material;
            material = new Material(Shader.Find("Standard")) { color = color };
            AssetDatabase.CreateAsset(material,path); return material;
        }
        private static GameObject Block(Transform parent,string name,Vector3 position,Vector3 scale,Material material)
        {
            var item = GameObject.CreatePrimitive(PrimitiveType.Cube); item.name = name;
            item.transform.SetParent(parent); item.transform.position = position; item.transform.localScale = scale;
            item.GetComponent<Renderer>().sharedMaterial = material; return item;
        }
        private static Text TextNode(Transform parent,string name,string content,int size)
        {
            var item = new GameObject(name,typeof(RectTransform),typeof(Text)); item.transform.SetParent(parent,false);
            var text = item.GetComponent<Text>(); text.font = font; text.text = content; text.fontSize = size;
            text.color = Color.white; text.alignment = TextAnchor.MiddleCenter; text.raycastTarget = false;
            var outline = item.AddComponent<Outline>(); outline.effectColor = new Color(0,0,0,.85f);
            return text;
        }
        private static void Rect(RectTransform rect,Vector2 anchor,Vector2 size,Vector2 position)
        { rect.anchorMin = rect.anchorMax = anchor; rect.pivot = new Vector2(.5f,.5f); rect.sizeDelta = size; rect.anchoredPosition = position; }
        private static void WorldLabel(Transform parent,string text,Vector3 offset)
        {
            var obj = new GameObject("World Space Canvas",typeof(RectTransform),typeof(Canvas));
            obj.transform.SetParent(parent,false); obj.GetComponent<Canvas>().renderMode = RenderMode.WorldSpace;
            obj.transform.position = parent.position + offset;
            // Cancel primitive scale so labels retain readable world size.
            obj.transform.localScale = new Vector3(.006f/parent.lossyScale.x,.006f/parent.lossyScale.y,.006f/parent.lossyScale.z);
            ((RectTransform)obj.transform).sizeDelta = new Vector2(240,55);
            var label = TextNode(obj.transform,"Text",text,30);
            Rect(label.rectTransform,new Vector2(.5f,.5f),new Vector2(240,55),Vector2.zero);
            obj.AddComponent<BillboardLabel>();
        }
        private static void Npc(Transform root,string name,string label,Vector3 position,bool judge,Material material,InteractionUI ui,CourtSession session)
        {
            var npc = GameObject.CreatePrimitive(PrimitiveType.Capsule); npc.name = name;
            npc.transform.SetParent(root); npc.transform.position = position;
            npc.GetComponent<Renderer>().sharedMaterial = material;
            npc.AddComponent<NPCInteractable>().Configure(label,judge,ui,session);
            WorldLabel(npc.transform,label,new Vector3(0,1.35f,0));
        }
        [MenuItem("EduAI/Validate Courtroom")]
        public static void ValidateScene()
        {
            EditorSceneManager.OpenScene(ScenePath);
            foreach (var root in EditorSceneManager.GetActiveScene().GetRootGameObjects())
            foreach (var transform in root.GetComponentsInChildren<Transform>(true))
            {
                if (GameObjectUtility.GetMonoBehavioursWithMissingScriptCount(transform.gameObject)>0)
                    throw new InvalidOperationException("Missing script: "+transform.name);
                foreach (var behaviour in transform.GetComponents<MonoBehaviour>())
                {
                    // Unity UI 的材質等欄位允許留空；只檢查本專案直接序列化的引用。
                    // UnityEvent 內的可選參數也不是必要的場景引用。
                    if (!behaviour || behaviour.GetType().Namespace != "EduAI.Court") continue;
                    var iterator = new SerializedObject(behaviour).GetIterator();
                    bool enterChildren = true;
                    while (iterator.NextVisible(enterChildren))
                    {
                        enterChildren = false;
                        if (iterator.propertyType == SerializedPropertyType.ObjectReference && iterator.name != "m_Script" && iterator.objectReferenceValue == null)
                            throw new InvalidOperationException("Unassigned reference: "+transform.name+"."+iterator.name);
                    }
                }
            }
            if (!UnityEngine.Object.FindFirstObjectByType<FirstPersonController>() ||
                !UnityEngine.Object.FindFirstObjectByType<PlayerInteractor>() ||
                UnityEngine.Object.FindObjectsByType<NPCInteractable>(FindObjectsSortMode.None).Length != 5)
                throw new InvalidOperationException("Required gameplay components are missing.");
            Debug.Log("COURT_SCENE_VALIDATION_PASSED");
        }
        public static void BuildWebGL()
        {
            // 部署優先：必須先成功輸出 Builds/WebGL，再測瀏覽器及 Docker。
            // 不要將 Unity Assets 當成網站成品；API key 不得進入這個建置。
            ValidateScene();
            EditorUserBuildSettings.development = false;
            EditorUserBuildSettings.allowDebugging = false;
            EditorUserBuildSettings.connectProfiler = false;
            EditorUserBuildSettings.buildWithDeepProfilingSupport = false;
            PlayerSettings.stripEngineCode = true;
            PlayerSettings.SetManagedStrippingLevel(UnityEditor.Build.NamedBuildTarget.WebGL, ManagedStrippingLevel.Medium);
            // GitHub Pages cannot be configured with per-file Content-Encoding.
            // Fallback loads .unityweb without custom server headers (also Docker/local).
            PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Gzip;
            PlayerSettings.WebGL.decompressionFallback = true;
            PlayerSettings.WebGL.debugSymbolMode = WebGLDebugSymbolMode.Off;
            PlayerSettings.WebGL.dataCaching = true;
            StripUnusedAlwaysIncludedShaders();
            AssetDatabase.SaveAssets();
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions { scenes = new[] {ScenePath},
                locationPathName = "Builds/WebGL", target = BuildTarget.WebGL, options = BuildOptions.None });
            if (report.summary.result != BuildResult.Succeeded) throw new Exception("WebGL build failed.");
            StampWebGL();
        }
        public static void StampWebGL()
        {
            // Content-derived URLs keep the four files of a release together,
            // including Unity's persistent IndexedDB data cache.
            string[] files={"WebGL.data.unityweb","WebGL.framework.js.unityweb","WebGL.loader.js","WebGL.wasm.unityweb"};
            string inventory="";
            using(var hash=System.Security.Cryptography.SHA256.Create())
            {
                foreach(var file in files)
                    inventory+=file+":"+BitConverter.ToString(hash.ComputeHash(File.ReadAllBytes("Builds/WebGL/Build/"+file))).Replace("-","").ToLowerInvariant()+"\n";
                string revision=BitConverter.ToString(hash.ComputeHash(System.Text.Encoding.UTF8.GetBytes(inventory))).Replace("-","").ToLowerInvariant().Substring(0,16);
                string path="Builds/WebGL/index.html",html=File.ReadAllText(path);
                foreach(var file in files)
                    html=System.Text.RegularExpressions.Regex.Replace(html,"Build/"+System.Text.RegularExpressions.Regex.Escape(file)+"(?:\\?v=[0-9a-f]{16})?", "Build/"+file+"?v="+revision);
                File.WriteAllText(path,html,new System.Text.UTF8Encoding(false));
                Debug.Log("COURT_BUILD_REVISION "+revision);
            }
        }
        private static void StripUnusedAlwaysIncludedShaders()
        {
            // This scene uses MeshRenderer + legacy UI Text only. Do not touch
            // Standard/UI/font shaders, or shaders explicitly used by a material.
            // If sprites/video are added later, restore their default shaders.
            var used = new System.Collections.Generic.HashSet<string>();
            foreach (string guid in AssetDatabase.FindAssets("t:Material", new[] { "Assets" }))
            {
                var material = AssetDatabase.LoadAssetAtPath<Material>(AssetDatabase.GUIDToAssetPath(guid));
                if (material && material.shader) used.Add(material.shader.name);
            }
            bool hasSprites = UnityEngine.Object.FindObjectsByType<SpriteRenderer>(FindObjectsSortMode.None).Length > 0;
            var settings = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/GraphicsSettings.asset")[0]);
            var shaders = settings.FindProperty("m_AlwaysIncludedShaders");
            for (int i = shaders.arraySize - 1; i >= 0; i--)
            {
                var shader = shaders.GetArrayElementAtIndex(i).objectReferenceValue as Shader;
                if (!shader || used.Contains(shader.name)) continue;
                bool unusedSprite = !hasSprites && (shader.name == "Sprites/Default" || shader.name == "Sprites/Mask");
                if (!unusedSprite) continue;
                Debug.Log("COURT_REMOVED_UNUSED_SHADER: " + shader.name);
                shaders.GetArrayElementAtIndex(i).objectReferenceValue = null;
                shaders.DeleteArrayElementAtIndex(i);
            }
            settings.ApplyModifiedPropertiesWithoutUndo();
        }
        [MenuItem("EduAI/Apply Crosshair Layout Fix")]
        public static void ApplyCrosshairLayoutFix()
        {
            // 有針對性的場景修正，不重建或刪除朋友修改過的場景物件。
            EditorSceneManager.OpenScene(ScenePath);
            var crosshair = GameObject.Find("Canvas/Crosshair").GetComponent<Text>();
            Rect(crosshair.rectTransform, new Vector2(.5f, .5f), new Vector2(64, 64), Vector2.zero);
            crosshair.verticalOverflow = VerticalWrapMode.Overflow;
            EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene());
            CourtPreview.Capture();
        }
    }
}
