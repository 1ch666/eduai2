using System.Collections.Generic;
using UnityEngine;

namespace EduAI.Court
{
    // Original low-poly garment, skinned to the existing licensed Kenney rig.
    // Role is a public presentation identity, never inferred from dialogue text.
    public sealed class NpcWardrobe : MonoBehaviour
    {
        private SkinnedMeshRenderer garment;
        private Mesh mesh;
        private Material cloth, edging, shirt;
        public string Role { get; private set; }
        public bool RobeVisible => garment && garment.gameObject.activeSelf;
        public Color TrimColor => edging ? edging.color : Color.clear;

        public static NpcWardrobe Ensure(Transform actor)
        {
            var model=actor.Find("CharacterModel");
            if (!model) return null;
            return model.GetComponent<NpcWardrobe>() ?? model.gameObject.AddComponent<NpcWardrobe>();
        }
        public static bool TryTrim(string role, out Color color)
        {
            switch(role)
            {
                case "judge": color=new Color(.12f,.36f,.72f); return true;
                case "prosecutor": color=new Color(.48f,.20f,.62f); return true;
                case "counsel": case "claimantCounsel": case "respondentCounsel":
                    color=new Color(.91f,.92f,.91f); return true;
                default: color=Color.clear; return false;
            }
        }
        public void Present(string role, bool visible)
        {
            Role=visible?role:null;
            bool robed=visible && TryTrim(role,out _);
            if (!garment) Build();
            if (!garment) return;
            garment.gameObject.SetActive(robed);
            if (robed) { TryTrim(role,out var color); edging.color=color; }
        }
        private void Awake() { Build(); }
        private void Build()
        {
            if (garment) return;
            SkinnedMeshRenderer source=null;
            foreach(var candidate in GetComponentsInChildren<SkinnedMeshRenderer>(true))
                if(candidate.name=="body-mesh") { source=candidate; break; }
            if (!source || !source.sharedMesh) return;
            int Bone(string name) => System.Array.FindIndex(source.bones,b=>b && b.name==name);
            int torso=Bone("torso"), leftLeg=Bone("leg-left"), rightLeg=Bone("leg-right"), leftArm=Bone("arm-left"), rightArm=Bone("arm-right");
            if(torso<0||leftLeg<0||rightLeg<0||leftArm<0||rightArm<0) return;

            var vertices=new List<Vector3>(); var weights=new List<BoneWeight>();
            var black=new List<int>(); var trim=new List<int>(); var white=new List<int>();
            BoneWeight BodyWeight(Vector3 p)
            {
                // The hem bends with the legs; the shoulders stay with torso.
                // Rest coordinates are shared by the three checked Kenney rigs.
                float leg=Mathf.Clamp01((.19f-p.y)/.13f);
                return new BoneWeight {boneIndex0=torso,weight0=1-leg,boneIndex1=p.x<0?leftLeg:rightLeg,weight1=leg};
            }
            void Quad(Vector3 a,Vector3 b,Vector3 c,Vector3 d,Vector3 outward,bool colored,int bone=-1,bool whiteShirt=false)
            {
                int start=vertices.Count;
                foreach(var p in new[]{a,b,c,d})
                {
                    vertices.Add(p);
                    weights.Add(bone<0?BodyWeight(p):new BoneWeight{boneIndex0=bone,weight0=1});
                }
                var indices=whiteShirt?white:colored?trim:black;
                if(Vector3.Dot(Vector3.Cross(b-a,c-a),outward)>=0)
                    indices.AddRange(new[]{start,start+1,start+2,start,start+2,start+3});
                else indices.AddRange(new[]{start,start+2,start+1,start,start+3,start+2});
            }
            Vector3[] Ring(float y,float width,float depth)
            {
                return new[]{new Vector3(-width*.75f,y,depth-.03f),new Vector3(width*.75f,y,depth-.03f),
                    new Vector3(width,y,depth*.65f-.03f),new Vector3(width,y,-depth*.65f-.03f),
                    new Vector3(width*.75f,y,-depth-.03f),new Vector3(-width*.75f,y,-depth-.03f),
                    new Vector3(-width,y,-depth*.65f-.03f),new Vector3(-width,y,depth*.65f-.03f)};
            }
            var rings=new[]{Ring(.35f,.19f,.19f),Ring(.18f,.18f,.17f),Ring(.045f,.19f,.17f)};
            for(int row=0;row<rings.Length-1;row++) for(int i=0;i<8;i++)
            {
                int next=(i+1)%8;
                var normal=(rings[row][i]+rings[row][next])*.5f-new Vector3(0,rings[row][i].y,-.03f);
                Quad(rings[row][i],rings[row][next],rings[row+1][next],rings[row+1][i],normal,false);
            }
            // Two raised front facings are real geometry, not a recolored torso.
            for(int side=-1;side<=1;side+=2) for(int row=0;row<2;row++)
            {
                var upper=rings[row][0]; var lower=rings[row+1][0];
                float x0=side*.045f,x1=side*.079f;
                Quad(new Vector3(x0,upper.y,upper.z+.003f),new Vector3(x1,upper.y,upper.z+.003f),
                    new Vector3(x1,lower.y,lower.z+.003f),new Vector3(x0,lower.y,lower.z+.003f),Vector3.forward,true);
            }
            // White shirt and folded collar, plus a raised black knot / tie.
            // They share torso weights, not a screen-space icon or texture label.
            Vector3 ShirtPoint(float x,float y,float lift=0) => new Vector3(x,y,.14f+(y-.18f)*(.02f/.17f)+.007f+lift);
            Quad(ShirtPoint(-.043f,.35f),ShirtPoint(.043f,.35f),ShirtPoint(.035f,.245f),ShirtPoint(-.035f,.245f),Vector3.forward,false,torso,true);
            for(int side=-1;side<=1;side+=2)
                Quad(ShirtPoint(side*.043f,.35f,.003f),ShirtPoint(side*.003f,.344f,.003f),
                    ShirtPoint(side*.018f,.315f,.007f),ShirtPoint(side*.047f,.332f,.003f),Vector3.forward,false,torso,true);
            Quad(ShirtPoint(0,.341f,.009f),ShirtPoint(.013f,.33f,.009f),ShirtPoint(0,.315f,.009f),ShirtPoint(-.013f,.33f,.009f),Vector3.forward,false,torso);
            Quad(ShirtPoint(-.007f,.318f,.009f),ShirtPoint(.007f,.318f,.009f),ShirtPoint(.016f,.259f,.009f),ShirtPoint(-.016f,.259f,.009f),Vector3.forward,false,torso);
            Quad(ShirtPoint(-.016f,.259f,.009f),ShirtPoint(.016f,.259f,.009f),ShirtPoint(0,.241f,.009f),ShirtPoint(0,.241f,.009f),Vector3.forward,false,torso);
            // Broad sleeves with a separate colored cuff ring, following arms.
            for(int side=-1;side<=1;side+=2)
            {
                int bone=side<0?leftArm:rightArm;
                float cuffEnd=source.sharedMesh.bounds.extents.x*.88f;
                for(int segment=0;segment<2;segment++) for(int i=0;i<8;i++)
                {
                    float a=i*Mathf.PI/4,b=(i+1)*Mathf.PI/4;
                    float begin=segment==0?.10f:cuffEnd-.035f,end=segment==0?cuffEnd-.035f:cuffEnd;
                    Vector3 At(float x,float angle) => new Vector3(side*x,.285f+Mathf.Cos(angle)*.13f,-.015f+Mathf.Sin(angle)*.17f);
                    var outward=new Vector3(0,Mathf.Cos((a+b)*.5f),Mathf.Sin((a+b)*.5f));
                    Quad(At(begin,a),At(end,a),At(end,b),At(begin,b),outward,segment==1,bone);
                }
            }
            var part=new GameObject("RoleRobe"); part.transform.SetParent(source.transform.parent,false);
            part.transform.localPosition=source.transform.localPosition;
            part.transform.localRotation=source.transform.localRotation;
            part.transform.localScale=source.transform.localScale;
            garment=part.AddComponent<SkinnedMeshRenderer>();
            mesh=new Mesh {name="OriginalCourtRobe"};
            mesh.SetVertices(vertices); mesh.boneWeights=weights.ToArray(); mesh.bindposes=source.sharedMesh.bindposes;
            mesh.subMeshCount=3; mesh.SetTriangles(black,0);mesh.SetTriangles(trim,1);mesh.SetTriangles(white,2);mesh.RecalculateNormals();mesh.RecalculateBounds();
            garment.sharedMesh=mesh;garment.bones=source.bones;garment.rootBone=source.rootBone;
            garment.localBounds=new Bounds(new Vector3(0,.2f,0),new Vector3(1.3f,1.2f,1.3f));
            // Reuse an already included shader; no runtime shader lookup dependency.
            cloth=new Material(source.sharedMaterial) {name="CourtRobeBlack",mainTexture=null,color=new Color(.055f,.065f,.075f)};
            edging=new Material(cloth) {name="CourtRobeRoleEdging"};
            shirt=new Material(cloth) {name="CourtShirtWhite",color=new Color(.96f,.96f,.93f)};
            cloth.SetFloat("_Glossiness",.08f);edging.SetFloat("_Glossiness",.08f);
            garment.sharedMaterials=new[]{cloth,edging,shirt};
            part.SetActive(false);
        }
        private void OnDestroy()
        {
            if(mesh) Destroy(mesh);
            if(cloth) Destroy(cloth);
            if(edging) Destroy(edging);
            if(shirt) Destroy(shirt);
        }
    }
}
