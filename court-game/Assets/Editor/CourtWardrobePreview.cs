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
            var target=new RenderTexture(1440,900,24);camera.targetTexture=target;camera.Render();
            var prior=RenderTexture.active;RenderTexture.active=target;
            var image=new Texture2D(1440,900,TextureFormat.RGB24,false);image.ReadPixels(new Rect(0,0,1440,900),0,0);image.Apply();
            Directory.CreateDirectory("Logs");File.WriteAllBytes("Logs/wardrobe-"+pose+".png",image.EncodeToPNG());
            RenderTexture.active=prior;camera.targetTexture=null;Object.DestroyImmediate(target);Object.DestroyImmediate(image);
            Debug.Log("COURT_WARDROBE_PREVIEW_RENDERED");
        }
    }
}
