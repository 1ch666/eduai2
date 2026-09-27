# NPC 公開狀態與動畫接線（2026-09-27）

## 此批已實作

`NpcMotionPlan` 把協定允許的 pose / emotion / speakingState / requestState 轉為固定動畫選擇，不接受模型傳入 clip 名稱、Animator 參數、骨架路徑或程式。`NPCInteractable` 只在既有 CourtRuntimeState 驗證、版本控制及合法座位映射之後更新 `NpcActorMotion`；不保存原始 DTO、案件真相、提示詞或角色私有資料。

| 公開姿態 | 實際 clip | 播放方式 |
| --- | --- | --- |
| idle / standing | idle | 循環 |
| sitting | sit | 循環，不因收到文字站起來 |
| speaking | emote-yes | 循環；pending / failed 時改 idle |
| objecting | emote-no | 一次後停末幀 |
| presentingEvidence | interact-right | 一次後停末幀 |
| listening / thinking / turnHeadToSpeaker | idle | 暫時中性姿態；專用表現尚未完成 |

idle / standing 的 speakingState=speaking 且 requestState=idle 時使用 emote-yes。座位姿態及明確手勢不被此輔助狀態覆蓋。emotion 四種合法值予以保存，但尚未有專用情緒動畫，不將此欄位接線說成 nervous / confident / surprised 已完成。

重複快照不重播當前手勢。隱藏、未知映射、同步失敗或清除場次會停止動畫並清除公開表現資料。雲端文字與歷史恢復不再呼叫舊 Speak；guest 固定練習仍保留原本的短點頭及返回待機能力。

模型使用既有 Kenney CC0 資產，未下載新模型或付費素材。官方 Editor 確認三款 FBX 均有 idle、sit、emote-yes、emote-no、interact-right；只增加後兩個必要 clip 的匯入，沒有全量匯入行走／攻擊等無關動畫。`NpcUpgrade.ConfigureMotionClips` 僅調整模型匯入，不重建 authored scene。

## 實際證據

- 官方 Unity 6000.6.2f1：模型清單稽核 exit 0（outputs/npc-motion-audit.log）、匯入與 C# 編譯 exit 0（outputs/npc-motion-import.log）。
- 真實 Scene / Play 測試 exit 0（outputs/npc-motion-play.log）：九種姿態乘四種 emotion 的固定選擇、實際 Animation clip 存在、重複投影不重設時間、坐姿不被 Speak 覆蓋、pending 不冒充回覆、非法詞彙拒絕、失同步／撤銷停止等斷言通過。原碰撞／互動／鏡頭／手機點擊測試同次執行。
- Editor 仍有既知 SearchDatabase ArgumentOutOfRangeException，與遊戲斷言區分；不宣稱零 Editor 例外。
- 尚未完成本批 WebGL、瀏覽器外觀、手機、正式发布及 Docker 更新；現有線上遊戲保持前版。

## 後續必要工作（不能以這批接線取代完整規格）

1. 場景坐姿高度、座椅、角色佔位與鏡頭遮擋須實際檢視；不得只以 clip 名稱正確宣稱美術完成。
2. 完成 listening、thinking、情緒姿態、轉頭目標及坐姿上半身說話混合。不能自行從問題或 AI 文字推測權威角色狀態。
3. 目前 server publicCourtCast 主要輸出 sitting / neutral / silent / idle；各程序事件的合法表現狀態轉移仍待後端接線。不代表正式網站已會自動播放異議／展示手勢。
4. 目前是確定性的「狀態→動畫選擇」，不是事件時間驅動的逐幀重播；重播 seek / pause 動畫相位仍需完成。
5. 建置並比較下載量、實際 browser 及手機驗收後才發布，再更新 Docker。未完成全部 12 類表現，不標 10/10。
