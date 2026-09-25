using System;
using System.Linq;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

namespace EduAI.Court.Editor
{
    public static class NpcUpgrade
    {
        [MenuItem("EduAI/Upgrade NPC Models and Dialogue")]
        public static void Apply()
        {
            const string folder="Assets/Art/KenneyMini/";
            var names=new[]{"character-male-a","character-male-b","character-female-a"};
            foreach(var name in names)
            {
                var importer=AssetImporter.GetAtPath(folder+name+".fbx") as ModelImporter;
                if(!importer)throw new Exception("Missing licensed model: "+name);
                importer.animationType=ModelImporterAnimationType.Legacy;
                importer.importAnimation=true; importer.importCameras=false; importer.importLights=false;
                importer.materialImportMode=ModelImporterMaterialImportMode.None;
                var clips=importer.defaultClipAnimations.Where(c=>c.name=="idle"||c.name=="emote-yes"||c.name=="sit").ToArray();
                if(clips.Length==0)throw new Exception("Expected idle/gesture clips missing");
                foreach(var clip in clips)clip.loopTime=clip.name=="idle"||clip.name=="sit";
                importer.clipAnimations=clips; importer.SaveAndReimport();
                Debug.Log("NPC_CLIPS: "+string.Join(",",clips.Select(c=>c.name)));
            }
            var texturePath=folder+"Textures/colormap.png";
            var ti=(TextureImporter)AssetImporter.GetAtPath(texturePath);
            ti.maxTextureSize=512; ti.mipmapEnabled=true; ti.SaveAndReimport();
            var mat=AssetDatabase.LoadAssetAtPath<Material>(folder+"Character.mat");
            if(!mat){mat=new Material(Shader.Find("Standard"));AssetDatabase.CreateAsset(mat,folder+"Character.mat");}
            mat.mainTexture=AssetDatabase.LoadAssetAtPath<Texture2D>(texturePath);mat.SetFloat("_Glossiness",.15f);
            EditorSceneManager.OpenScene("Assets/Scenes/Courtroom.unity");
            var npcs=UnityEngine.Object.FindObjectsByType<NPCInteractable>(FindObjectsSortMode.None);
            foreach(var npc in npcs)
            {
                if(npc.transform.Find("CharacterModel"))continue; // idempotent; preserve manually edited models
                int index=npc.name=="Witness"?2:npc.name=="Defendant"?1:0;
                var source=AssetDatabase.LoadAssetAtPath<GameObject>(folder+names[index]+".fbx");
                var model=(GameObject)PrefabUtility.InstantiatePrefab(source,npc.transform);
                model.name="CharacterModel";model.transform.localPosition=Vector3.zero;
                model.transform.localRotation=Quaternion.Euler(0,180,0);
                var renderers=model.GetComponentsInChildren<Renderer>();
                if(renderers.Length==0)throw new Exception("Model has no renderers");
                var bounds=renderers[0].bounds;foreach(var r in renderers){bounds.Encapsulate(r.bounds);r.sharedMaterial=mat;}
                model.transform.localScale*=1.8f/Mathf.Max(.01f,bounds.size.y);
                bounds=renderers[0].bounds;foreach(var r in renderers)bounds.Encapsulate(r.bounds);
                model.transform.position+=Vector3.down*bounds.min.y;
                var old=npc.GetComponent<Renderer>();if(old)old.enabled=false;
                model.AddComponent<NpcActorMotion>();
                // Retain the existing NPC capsule for nearest-hit / 3m / obstruction rules.
            }
            var dialogue=UnityEngine.Object.FindFirstObjectByType<NpcDialogueUI>();
            if(!dialogue)dialogue=new GameObject("NpcDialogue").AddComponent<NpcDialogueUI>();
            var font=AssetDatabase.LoadAssetAtPath<Font>("Assets/UI/NpcDialogueFont.otf");
            if(!font)throw new Exception("Missing dynamic Chinese dialogue font");
            dialogue.Configure(font);
            EditorSceneManager.MarkSceneDirty(EditorSceneManager.GetActiveScene());
            EditorSceneManager.SaveScene(EditorSceneManager.GetActiveScene());AssetDatabase.SaveAssets();
            CourtProjectBuilder.ValidateScene();
            Debug.Log("NPC_UPGRADE_PASSED");
        }
    }
}
