using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace EduAI.Court.Editor
{
    // Offline visual QA only; does not save or replace the authored court scene.
    public static class CourtWardrobePreview
    {
        public static void Render()
        { RenderPose("idle"); }
        public static void RenderSeated()
        { RenderPose("sit"); }
        public static void RenderCourtSeated()
        { RenderCourtPose("sit"); }
        public static void InspectChairClip()
        {
            // Inspect the licensed seated alternative before adopting it. This
            // changes only the isolated QA project's import settings, not scene.
            foreach(var name in new[]{"character-male-a","character-male-b","character-female-a"})
            {
                var importer=(ModelImporter)AssetImporter.GetAtPath("Assets/Art/KenneyMini/"+name+".fbx");
                var clips=new System.Collections.Generic.List<ModelImporterClipAnimation>(importer.clipAnimations);
                var chair=System.Array.Find(importer.defaultClipAnimations,c=>c.name=="wheelchair-sit");
                if(chair==null) throw new System.Exception("Missing seated source clip");
                if(!clips.Exists(c=>c.name==chair.name)) { chair.loopTime=true;clips.Add(chair);importer.clipAnimations=clips.ToArray();importer.SaveAndReimport(); }
            }
            RenderCourtPose("wheelchair-sit");
        }
        private static void RenderCourtPose(string pose)
        {
            EditorSceneManager.OpenScene("Assets/Scenes/Courtroom.unity");
            foreach(var actor in Object.FindObjectsByType<NPCInteractable>(FindObjectsSortMode.None))
            {
                var model=actor.transform.Find("CharacterModel");
                string role=actor.name=="Judge"?"judge":actor.name=="Prosecutor"?"prosecutor":actor.name=="Lawyer"?"counsel":null;
                NpcWardrobe.Ensure(actor.transform)?.Present(role,true);
                var motion=model.GetComponent<NpcActorMotion>();
                var animation=model.GetComponentInChildren<Animation>();
                motion.ApplyPublicState("sitting","neutral","silent","idle",true);
                animation[pose].clip.SampleAnimation(model.gameObject,.4f);
                motion.ApplyPoseAdjustments();
                var head=System.Array.Find(model.GetComponentsInChildren<Transform>(),t=>t.name=="head");
                Debug.Log("COURT_SEATED "+actor.name+" model="+model.position.ToString("F4")+" head="+head.position.ToString("F4"));
            }
            var camera=Camera.main;
            camera.transform.position=new Vector3(0,1.65f,-1);
            camera.transform.rotation=Quaternion.identity;camera.fieldOfView=60;
            Capture(camera,"Logs/wardrobe-court-"+pose+".png");
        }
        private static void RenderPose(string pose)
        {
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
            RenderSettings.ambientLight=new Color(.7f,.7f,.7f);
            var light=new GameObject("PreviewLight").AddComponent<Light>();
            light.type=LightType.Directional;light.intensity=1.2f;light.transform.rotation=Quaternion.Euler(35,-25,0);
            var names=new[]{"judge","prosecutor","counsel"};
            var models=new[]{"character-male-a","character-male-b","character-female-a"};
            for(int i=0;i<3;i++)
            {
                var root=new GameObject(names[i]);root.transform.position=new Vector3((1-i)*1.8f,0,0);
                var source=AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Art/KenneyMini/"+models[i]+".fbx");
                var model=(GameObject)PrefabUtility.InstantiatePrefab(source,root.transform);
                model.name="CharacterModel";model.transform.localScale=Vector3.one*2.7f;
                var material=AssetDatabase.LoadAssetAtPath<Material>("Assets/Art/KenneyMini/Character.mat");
                foreach(var renderer in model.GetComponentsInChildren<Renderer>()) renderer.sharedMaterial=material;
                var wardrobe=NpcWardrobe.Ensure(root.transform);wardrobe.Present(names[i],true);
                var animation=model.GetComponentInChildren<Animation>();
                var head=System.Array.Find(model.GetComponentsInChildren<Transform>(),t=>t.name=="head");
                var before=head.position;
                animation[pose].clip.SampleAnimation(model,.4f);
                if(pose=="sit")
                {
                    var motion=model.AddComponent<NpcActorMotion>();
                    motion.ApplyPublicState("sitting","neutral","silent","idle",true);
                }
                Debug.Log("ROBE_POSE "+models[i]+" "+pose+" headBefore="+before.ToString("F4")+" after="+head.position.ToString("F4"));
            }
            var camera=new GameObject("PreviewCamera").AddComponent<Camera>();
            camera.transform.position=new Vector3(0,1.2f,7);camera.transform.LookAt(new Vector3(0,.9f,0));
            camera.fieldOfView=32;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=new Color(.85f,.88f,.9f);
            Capture(camera,"Logs/wardrobe-"+pose+".png");
        }
        private static void Capture(Camera camera,string path)
        {
            var target=new RenderTexture(1440,900,24);camera.targetTexture=target;camera.Render();
            var prior=RenderTexture.active;RenderTexture.active=target;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();
            Directory.CreateDirectory("Logs");File.WriteAllBytes(path,image.EncodeToPNG());
            RenderTexture.active=prior;camera.targetTexture=null;Object.DestroyImmediate(target);Object.DestroyImmediate(image);
            Debug.Log("COURT_WARDROBE_PREVIEW_RENDERED");
        }
    }
}
