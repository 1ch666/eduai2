using UnityEngine;

namespace EduAI.Court
{
    public sealed class CourtSession : MonoBehaviour
    {
        // 接手入口：这里只管理法庭流程；移動、射線、UI 與未來後端請維持分層。
        // TODO(後端)：案件進度由伺服器驗證，不能把前端選項索引當成可信結果。
        [SerializeField] private InteractionUI ui;
        [SerializeField] private ChoiceSystem choices;
        private bool started;
        private bool evidenceReviewed;
        private bool witnessHeard;
        private bool completed;
        public void Configure(InteractionUI hud, ChoiceSystem choiceSystem)
        { ui = hud; choices = choiceSystem; }
        public void BeginHearing()
        {
            if (!ui || !choices) return;
            if (completed)
            {
                ui.ShowMessage("本輪完成。可以重新開始，或繼續探索法庭。", 12);
                choices.ShowChoices("重新開始", "重看學習重點", "查看案件", "繼續探索", HandleComplete);
                return;
            }
            started = true;
            if (evidenceReviewed && witnessHeard)
            {
                ui.ShowMessage("法官：僅依目前資料，哪個結論最合理？\n這是證據判讀練習，不是真實判決。", 30);
                choices.ShowChoices("出現在現場，就能認定拿走物品", "傳聞足以代替調查",
                    "資訊不足，應再查明物品去向", "由外表判斷誰說實話", HandleConclusion);
                return;
            }
            ShowCase();
            choices.ShowChoices(evidenceReviewed ? "證物 A：已查看" : "查看證物 A 的位置",
                witnessHeard ? "證人：已詢問" : "尋找證人", "重看案件", "開始調查", HandleChoice);
        }
        private void HandleChoice(int index)
        {
            if (index == 2) { ShowCase(); return; }
            string[] results = { "走近左側辯護桌上的證物 A，對準後按 E。", "走近右前方的證人，對準後按 E。",
                "", "調查完成後，回來與法官交談或按開庭按鈕。" };
            ui.ShowMessage(results[index], 12);
        }
        public void ReviewEvidence()
        {
            evidenceReviewed = true;
            ui.ShowMessage("證物 A｜虛構監視器截圖\n畫面只顯示小明進入教室，沒有拍到取走物品。\n取得時間：2026/09/21。" + NextStep(), 18);
        }
        public void HearWitness()
        {
            witnessHeard = true;
            ui.ShowMessage("證人：我看見小明進教室，但沒有看到他拿平板。\n有人說他拿走了，那不是我親眼所見。" + NextStep(), 18);
        }
        private string NextStep()
        {
            if (evidenceReviewed && witnessHeard) return "\n調查完成：回法官處作答。";
            return evidenceReviewed ? "\n下一步：詢問右前方的證人。" : "\n下一步：查看左側辯護桌的證物 A。";
        }
        public void ShowCase()
        {
            ui.ShowMessage("虛構教學案件｜消失的平板\n教室平板不見了，有人指稱小明拿走。\n請查看證物 A、詢問證人，再回法官處判讀資料。", 20);
        }
        private void HandleConclusion(int index)
        {
            if (index != 2)
            {
                ui.ShowMessage("再想一想：在場不等於取走物品，傳聞也不等於親眼所見。\n回法官處可重新作答。", 18);
                return;
            }
            completed = true;
            ui.ShowMessage("本輪完成｜你區分了事實、推測與傳聞。\n目前資料不足以認定誰取走平板，仍需調查。\n教學簡化情境，不是法律意見。再次開庭可重玩。", 25);
        }
        private void HandleComplete(int index)
        {
            if (index == 0)
            {
                started = evidenceReviewed = witnessHeard = completed = false;
                FindFirstObjectByType<NpcDialogueUI>()?.ResetHistory();
                BeginHearing();
            }
            else if (index == 1) ui.ShowMessage("學習重點：區分親眼所見與傳聞；不要用猜測補上缺少的證據。", 18);
            else if (index == 2) ShowCase();
        }
        private void Start()
        {
            if (!started && ui) ui.ShowMessage("點擊畫面開始操作。\n走到前方法官桌，對準「開庭」按 E。", 15);
        }
    }
}
