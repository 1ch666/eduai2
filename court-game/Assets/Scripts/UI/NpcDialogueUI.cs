using System.Collections;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace EduAI.Court
{
    // Phase 1: in-engine UI + explicitly labelled local fallback, no network/storage.
    // Later plug in the approved session/NPC bridge; do NOT call the old generic AI endpoint.
    public sealed class NpcDialogueUI : MonoBehaviour
    {
        [SerializeField] private Font dialogueFont;
        public static bool IsOpen { get; private set; }
        private readonly Dictionary<string, List<string>> histories = new Dictionary<string, List<string>>();
        private NPCInteractable npc;
        private GameObject panel;
        private RectTransform panelRect;
        private Text heading, history, state;
        private InputField input;
        private Button send;
        private ScrollRect scroll;
        private Coroutine pending;
        private int generation;
        private Camera viewCamera;
        private Quaternion savedCamera;
        private float keyboardInset;
        private RectTransform inputRect, sendRect;
        private GameObject viewportObject, suggestObject, continueObject;
        private RectTransform closeRect;
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] private static extern void CourtDialogueModal(int open);
#endif
        public void Configure(Font font) { dialogueFont = font; }
        private void Awake() { IsOpen = false; }
        private void Start() { BuildUI(); }
        private Text Label(Transform parent, string name, string value, int size = 20)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Text));
            go.transform.SetParent(parent, false);
            var text = go.GetComponent<Text>(); text.font = dialogueFont; text.fontSize = size;
            text.text = value; text.supportRichText = false; text.color = new Color(.12f,.17f,.18f);
            text.raycastTarget = false; text.alignment = TextAnchor.UpperLeft;
            return text;
        }
        private static void Place(RectTransform r, Vector2 min, Vector2 max, Vector2 lo, Vector2 hi)
        { r.anchorMin = min; r.anchorMax = max; r.offsetMin = lo; r.offsetMax = hi; }
        private Button ButtonAt(string name, string title, float left, float right, float bottom, System.Action action)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(panel.transform, false);
            Place((RectTransform)go.transform, new Vector2(left,0),new Vector2(right,0),new Vector2(8,bottom),new Vector2(-8,bottom+46));
            go.GetComponent<Image>().color = new Color(.79f,.84f,.82f);
            var text = Label(go.transform,"Label",title,18); text.alignment = TextAnchor.MiddleCenter;
            Place(text.rectTransform,Vector2.zero,Vector2.one,Vector2.zero,Vector2.zero);
            var b = go.GetComponent<Button>(); b.onClick.AddListener(()=>action()); return b;
        }
        private void BuildUI()
        {
            if (panel) return;
            if (!FindFirstObjectByType<EventSystem>()) new GameObject("DialogueEvents",typeof(EventSystem),typeof(StandaloneInputModule));
            var root = new GameObject("NpcDialogueCanvas",typeof(RectTransform),typeof(Canvas),typeof(CanvasScaler),typeof(GraphicRaycaster));
            root.transform.SetParent(transform,false);
            var canvas = root.GetComponent<Canvas>(); canvas.renderMode = RenderMode.ScreenSpaceOverlay; canvas.sortingOrder = 100;
            root.GetComponent<CanvasScaler>().uiScaleMode = CanvasScaler.ScaleMode.ConstantPixelSize;
            panel = new GameObject("DialoguePanel",typeof(RectTransform),typeof(Image)); panel.transform.SetParent(root.transform,false);
            panel.GetComponent<Image>().color = new Color(.96f,.97f,.96f,.99f); panelRect = (RectTransform)panel.transform;
            heading = Label(panel.transform,"Heading","",22);
            Place(heading.rectTransform,new Vector2(0,1),Vector2.one,new Vector2(16,-66),new Vector2(-16,-12));
            state = Label(panel.transform,"Mode","備用對話模式｜未連接 AI；紀錄只保留本次遊玩。",16);
            Place(state.rectTransform,new Vector2(0,1),Vector2.one,new Vector2(16,-120),new Vector2(-16,-68));
            var viewport = new GameObject("HistoryViewport",typeof(RectTransform),typeof(Image),typeof(RectMask2D),typeof(ScrollRect));
            viewport.transform.SetParent(panel.transform,false); viewport.GetComponent<Image>().color = Color.white;
            viewportObject=viewport;
            var vr = (RectTransform)viewport.transform;
            Place(vr,Vector2.zero,Vector2.one,new Vector2(16,226),new Vector2(-16,-124));
            history = Label(viewport.transform,"History","");
            history.rectTransform.anchorMin = new Vector2(0,1); history.rectTransform.anchorMax = Vector2.one;
            history.rectTransform.pivot = new Vector2(.5f,1); history.rectTransform.sizeDelta = Vector2.zero;
            var fit = history.gameObject.AddComponent<ContentSizeFitter>(); fit.verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            history.raycastTarget = true;
            scroll = viewport.GetComponent<ScrollRect>(); scroll.viewport = vr; scroll.content = history.rectTransform;
            scroll.horizontal = false; scroll.movementType = ScrollRect.MovementType.Clamped;
            var entry = new GameObject("Question",typeof(RectTransform),typeof(Image),typeof(InputField));
            entry.transform.SetParent(panel.transform,false); entry.GetComponent<Image>().color = Color.white;
            Place((RectTransform)entry.transform,Vector2.zero,new Vector2(1,0),new Vector2(16,136),new Vector2(-16,214));
            var entered = Label(entry.transform,"Text","");
            Place(entered.rectTransform,Vector2.zero,Vector2.one,new Vector2(8,8),new Vector2(-8,-8));
            var placeholder = Label(entry.transform,"Placeholder","輸入問題（最多 400 字）",18);
            placeholder.color = Color.gray; Place(placeholder.rectTransform,Vector2.zero,Vector2.one,new Vector2(8,8),new Vector2(-8,-8));
            input = entry.GetComponent<InputField>(); input.textComponent = entered; input.placeholder = placeholder;
            inputRect=(RectTransform)entry.transform;
            input.characterLimit = 400; input.lineType = InputField.LineType.MultiLineNewline;
            input.shouldHideMobileInput = false;
            suggestObject=ButtonAt("Suggest","你親眼看見什麼？",0,.68f,80,()=>{input.text="你親眼看見什麼？";}).gameObject;
            send = ButtonAt("Send","送出",.68f,1,80,Submit);
            sendRect=(RectTransform)send.transform;
            continueObject=ButtonAt("Continue","繼續調查／程序",0,.68f,20,ContinueInvestigation).gameObject;
            closeRect=(RectTransform)ButtonAt("Close","關閉",.68f,1,20,Close).transform;
            panel.SetActive(false);
        }
        public void Open(NPCInteractable target)
        {
            if (!target || CourtPresentation.IsHosted) return;
            BuildUI(); if (IsOpen) Close(); npc = target; generation++;
            IsOpen = true;
            FirstPersonController.Active?.ResetTouchInput(); FirstPersonController.Active?.Capture(false);
            FindFirstObjectByType<ChoiceSystem>()?.Close();
            heading.text = target.DisplayName + " · 固定平板案件\n玩家：調查練習者";
            if (!histories.ContainsKey(target.name)) histories[target.name] = new List<string>();
            input.text = ""; send.interactable = true; panel.SetActive(true); RenderHistory();
            viewCamera = Camera.main;
            if (viewCamera) { savedCamera = viewCamera.transform.localRotation; viewCamera.transform.LookAt(target.transform.position + Vector3.up * .5f); }
#if UNITY_WEBGL && !UNITY_EDITOR
            CourtDialogueModal(1);
#endif
        }
        public void Submit()
        {
            if (!IsOpen || pending != null) return;
            var question = input.text.Trim();
            if (question.Length == 0 || question.Length > 400) { state.text="請輸入 1～400 字。備用對話模式，非 AI。"; return; }
            var owner = npc; int ticket = generation;
            Add(owner.name,"你：" + question); input.text=""; send.interactable=false;
            state.text="正在取得固定台詞…（非 AI）";
            pending = StartCoroutine(Reply(owner,question,ticket));
        }
        private IEnumerator Reply(NPCInteractable owner, string question, int ticket)
        {
            yield return new WaitForSecondsRealtime(.25f);
            if (!IsOpen || generation != ticket || npc != owner) yield break;
            Add(owner.name,owner.DisplayName + "：" + ScriptedNpcDialogue.Reply(owner.DisplayName,question));
            owner.GetComponentInChildren<NpcActorMotion>()?.Speak();
            state.text="備用對話模式｜固定台詞，未連接 AI；不會自動新增證據。";
            send.interactable=true; pending=null;
        }
        private void Add(string key,string line)
        {
            var list=histories[key]; list.Add(line); while(list.Count>20) list.RemoveAt(0); RenderHistory();
        }
        private void RenderHistory()
        {
            history.text=string.Join("\n\n",histories[npc.name]);
            if (history.text.Length==0) history.text="可詢問這位角色已知的情況。\n\n目前是本機固定案件練習，重新整理會清除對話。";
            Canvas.ForceUpdateCanvases(); scroll.verticalNormalizedPosition=0;
        }
        public void ContinueInvestigation() { var target=npc; Close(); if(target)target.ContinueInvestigation(); }
        public void Close()
        {
            if (!IsOpen) return;
            generation++; if(pending!=null)StopCoroutine(pending); pending=null;
            input.DeactivateInputField(); EventSystem.current?.SetSelectedGameObject(null);
            IsOpen=false; panel.SetActive(false); keyboardInset=0;
            if(viewCamera)viewCamera.transform.localRotation=savedCamera;
            FirstPersonController.Active?.ResetTouchInput(); FirstPersonController.Active?.Capture(false);
#if UNITY_WEBGL && !UNITY_EDITOR
            CourtDialogueModal(0);
#endif
        }
        public void SetKeyboardInset(string value)
        { if(float.TryParse(value,System.Globalization.NumberStyles.Float,System.Globalization.CultureInfo.InvariantCulture,out var n)&&!float.IsNaN(n))keyboardInset=Mathf.Clamp(n,0,.65f); }
        private void Update()
        {
            if (!IsOpen) return;
            bool portrait=Screen.height>Screen.width;
            Place(panelRect,new Vector2(portrait?.02f:.48f,keyboardInset+.02f),new Vector2(.98f,.98f),Vector2.zero,Vector2.zero);
            // Landscape keyboard can leave very little vertical room. Keep input,
            // send and close visible; restore history/labels after keyboard closes.
            bool compact=panelRect.rect.height<390;
            viewportObject.SetActive(!compact);heading.gameObject.SetActive(!compact);
            state.gameObject.SetActive(!compact);suggestObject.SetActive(!compact);continueObject.SetActive(!compact);
            Place(inputRect,Vector2.zero,compact?Vector2.one:new Vector2(1,0),new Vector2(16,compact?66:136),new Vector2(-16,compact?-8:214));
            Place(sendRect,new Vector2(compact?0:.68f,0),new Vector2(compact?.5f:1,0),new Vector2(8,compact?12:80),new Vector2(-8,compact?58:126));
            Place(closeRect,new Vector2(compact?.5f:.68f,0),new Vector2(1,0),new Vector2(8,compact?12:20),new Vector2(-8,compact?58:66));
            if(Input.GetKeyDown(KeyCode.Escape))Close();
        }
        private void OnDisable(){Close();}
    }
}
