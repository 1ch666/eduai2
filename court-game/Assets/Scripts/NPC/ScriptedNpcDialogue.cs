namespace EduAI.Court
{
    // Deliberately deterministic, local-only fallback. NOT an AI implementation.
    // Unknown questions never create facts, evidence, legal citations or scores.
    public static class ScriptedNpcDialogue
    {
        public static string Reply(string role, string question)
        {
            if (question.Contains("法條") || question.Contains("幾條") || question.Contains("判刑"))
                return "這個固定練習沒有提供可核對的法條或刑度，我不能補造。請回到案件資料確認；這不是法律意見。";
            if (role == "證人")
                return "我只看見小明進入教室，沒有看見他拿平板。拿走平板的說法是聽別人說的，不是我親眼所見。";
            if (role == "被告")
                return "我有進教室，但我不知道平板後來去了哪裡。請不要把進入教室直接當作取走物品。";
            if (role == "檢察官")
                return "目前影像只顯示進入教室，沒有拍到取走平板。指控仍需要證據支持，不能用猜測補足。";
            if (role == "辯護律師")
                return "我可以提醒你區分親眼看見、推測及傳聞。請核對影像範圍與證人到底看到了什麼。";
            if (role == "法官")
                return "先查看證物 A，再詢問證人。按下「繼續調查／程序」可回到本案的固定教學流程。";
            return "這個案件沒有提供這項資訊，我不知道，不能自行補充。";
        }
    }
}
