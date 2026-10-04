# NPC 公開狀態與動畫接線（2026-09-27）

## 2026-10-04 上半身表現續作（尚未發布）

新增固定的 torso 旋轉層：傾聽微前傾、思考／pending 側傾、
緊張小幅擺動、自信挺身、驚訝後傾，以及坐姿說話的輕微點動。
只使用已驗證公開狀態，不從台詞猜情緒，不修改案件或模型根位置。
異議／出示證物保留原 clip；failed 不產生說話表現。
每次套用前撤銷自身上一個旋轉，狀態變更、隱藏、停用時恢復，
避免逐幀累積扭曲；既有坐姿垂腿與高度補償保留。

CourtPlayTests 新增實際 torso 存在、四情緒、重复套用不累積、
座位根位置不變、切回中性恢復、傾聽與思考有別與非法時間值拒絕。
官方 Unity 6000.6.2f1 真實編譯、Scene 驗證與 Play 測試已 exit 0，
日誌 `outputs/npc-expression-play-20261004.log` 含
`COURT_SCENE_VALIDATION_PASSED` 和 `COURT_PLAY_TESTS_PASSED`。
既有 Editor SearchDatabase 例外仍出現，不能宣稱零 Editor 例外。
尚未建置／發布新 WebGL，亦未完成本批動態畫面的視覺驗收。
後端 publicCourtCast 仍主要輸出 sitting / neutral；事件表現接線、
轉頭目標、降低動態效果、實際外觀及手機驗收尚未完成。

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
- 本批純動畫接線的 Release WebGL 已 exit 0（outputs/npc-motion-build.log），Gzip／loader 配對及下載門檻通過；五項資源 21,307,033 bytes。尚未發布，後續新增法袍／領帶須重新建置，不把這份成品當作包含新衣物。瀏覽器外觀、手機、正式发布及 Docker 更新仍待完成；現有線上遊戲保持前版。

## 後續必要工作（不能以這批接線取代完整規格）

1. 場景坐姿高度、座椅、角色佔位與鏡頭遮擋須實際檢視；不得只以 clip 名稱正確宣稱美術完成。
2. 完成 listening、thinking、情緒姿態、轉頭目標及坐姿上半身說話混合。不能自行從問題或 AI 文字推測權威角色狀態。
3. 目前 server publicCourtCast 主要輸出 sitting / neutral / silent / idle；各程序事件的合法表現狀態轉移仍待後端接線。不代表正式網站已會自動播放異議／展示手勢。
4. 目前是確定性的「狀態→動畫選擇」，不是事件時間驅動的逐幀重播；重播 seek / pause 動畫相位仍需完成。
5. 建置並比較下載量、實際 browser 及手機驗收後才發布，再更新 Docker。未完成全部 12 類表現，不標 10/10。
