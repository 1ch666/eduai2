【2026-09-26 WebGL 建置完成；優先於下方歷史狀態】
Unity 已一致性升級至官方 6000.6.2f1；6000.3 的政策封鎖未繞過。NpcUpgrade、Scene validation、CourtSmokeTests、CourtPlayTests 均通過，Release WebGL build exit 0。15 項 JS 測試通過，check-build 實際 Gzip／WASM 檢查通過。
本次提交新版 Courtroom 場景、人物／材質／匯入設定、packages／ProjectSettings 與 play/Build 成品。Edge headless 實際載入到「開始遊戲」並進入法庭，截圖可見人物；console 有一筆未定位 404，未出現 Unity 崩潰。不將此啟動檢查等同完整瀏覽器或手機真機驗收。
下載 bytes：data 15,280,568；wasm 5,836,179；framework 82,319；loader 48,540；四項合計 21,247,606（另 touch 5,172）。前版四項 6,413,059；此次增加 14,834,547 bytes，主要為完整中文動態字型與角色素材。不可宣稱首載變快。
遊戲仍是固定平板案與 scripted 備用 NPC 對話，不是真正 AI／案件生成。P0 的編譯／場景接線／成品已完成；P0 瀏覽器全流程與手機驗收、P1 美術/UI 細節及後端 AI、P2/P3 仍照下方待辦。模型是大頭低多邊形風格，座位／穿模／鏡頭待後續精修。
Cloudflare 由使用者手動部署，本次不部署 Worker、不改正式資料／Secret／權限。部署前確認使用最新 main 的 play 成品；不要拿舊 public 複製目錄當最新檔案。正式後端及 migration 仍由管理者核對。
Docker 需以本次 commit 重建，完成狀態看 GitHub Actions「Court Docker handoff」，不能以 Dockerfile 存在視為重建完成。

# NPC 續作：2026-09-25

## 本批範圍

依使用者提供的 01／04／05 需求文件，先完成最早可獨立驗證的 Unity 前端批次。
基準 main `c1dfe49`，已保留朋友的群組、排行與登入同步變更。沒有修改 src/、Wrangler、Secrets、權限或正式資料。

### 程式已實作，驗證結果見 STATUS.md 最新段落

- 原 Courtroom 場景增量加入三款 Kenney Mini Characters FBX，供五位現有角色共用；保留既有 NPC CapsuleCollider、位置及 3m 最近射線限制，不重建房間。
- `Assets/Editor/NpcUpgrade.cs`：可重跑的匯入與接線指令；已存在 CharacterModel 時不覆蓋。只取 idle／sit／emote-yes 動畫、共用低解析色盤，動畫是示意點頭，不是嘴形同步。
- `NpcActorMotion.cs`：待機與說話時點頭。
- `NpcDialogueUI.cs`：真正 Unity Canvas/InputField 對話介面，人物/玩家角色、問題、捲動紀錄、建議問題、送出、狀態、關閉及回原調查流程。
- `ScriptedNpcDialogue.cs`：固定平板案、依角色的預寫回覆。**這不是 AI、不是新案件生成，也不會根據聊天自動新增證物。**
- 對話期間停用 WASD、滑鼠視角、E／數字選項；關閉清除移動殘留，桌機需再點畫面捕捉滑鼠。保留最近 20 則每 NPC 本次對話，關閉不清除、刷新即失去；不寫 localStorage、PlayerPrefs 或正式資料庫。
- 對話關閉會取消待回覆 coroutine，以角色與 generation 阻擋過期回覆。純文字 UI 禁用 Rich Text。
- `NpcDialogue.jslib` 只管理手機觸控層／鍵盤視窗；不接網路，不傳憑證。
- 動態文字採完整 Noto TC 字型：原靜態字集不保證任意使用者輸入。新增下載成本必須由實際 build 大小呈現，不宣稱這次改善首載。

### 尚未完成

- 正式 AI NPC 對話、案件生成與相似度去重。
- 案件／NPC 的知識白名單及持久對話摘要、雲端保存／恢復。
- 聊天解鎖線索的權威伺服器判定。
- 全民事、刑事、少年角色模型配置、坐姿接線、口型、證物特寫。
- Hosted `/court/` 仍由外部面板操作，其人物可使用匯入模型；不把固定平板案對話混進另一個案件。
- 手機實機軟鍵盤、橫直向、背景恢復及全瀏覽器回歸。

## 需要後端管理者確認的接口提案（未實作、未部署）

現有 `/api/court/sessions/:id/dialogue` 依目前程序 speaker 回固定/AI 台詞，沒有任意 NPC 問題與角色知識模型；不能直接拿通用 `/api/ai/ask` 冒充新功能。

建議增量端點 `POST /api/court/sessions/:id/npcs/:npcId/messages`：

請求：`{version, requestId, text}`，text 1–400 字。
回應：`{requestId, npcId, version, text, mode, errorCode?}`；mode 為 ai 或 scripted。
場次ID與NPC ID是非秘密識別，不是登入 session token。

改動候選：src/court.ts、src/court-rules.ts、src/env.ts（必要時）。
需要在 CourtRoom 每場次資料中增加 NPC 知識／已詢問／對話摘要及冪等請求結果，是否新增 SQL 表與 migration 由管理者依現況確認；本批沒有新增任何 migration。

必要檢查：擁有者、登入、Origin、CSRF、NPC 是否屬於案件、角色、階段、長度、每人限流、每場成本上限、版本、請求ID與內容一致性。AI 等待期間若場次已變，不可把舊回覆寫回新狀態。權限/場次衝突不得偽装AI成功。

Unity只傳問題及非秘密識別給同源網頁橋接；網頁讀現有 auth session 的 CSRF，伺服器讀 HttpOnly cookie。session token／CSRF／API key 都不回送 Unity，也不持久化到前端。

`POST /api/court/cases/generate` 另行設計：需核准範本、JSON驗證、角色知識切片、事實一致性、法律 source/rule version、有限重試、近期去重及驗證後原子保存。不要先接按鈕再讓它呼叫不存在的端點。

正式AI開關及免費額度由管理者查核；維持未啟用。不變更 owner、account、binding、Secret、付款方案，不清空既有資料。

## 驗收操作

1. Unity 6000.3.24f1 開啟 court-game，執行 EduAI/Upgrade NPC Models and Dialogue（已接線時不需重做）。
2. Play：走近NPC按E；手機沿用3m最近射線點擊。確認文字框、固定模式提示、捲動、送出及關閉。
3. 輸入 WASD／1234／`<b>文字</b>`：不移動、不作答、不執行標籤。
4. 送出後立刻關閉再找另一NPC，舊回覆不可跨人物出現。
5. 關閉再開同NPC保留本次紀錄；按繼續回原案件流程。
6. 完成證物、證人、法官選項與重玩；確認原流程仍可完成。
7. Hosted court視角、少年旁觀拒絕、桌機Pointer Lock fallback及手機搖桿回歸。
8. 本機測試不等於正式AI連線或手機真機驗收。

素材詳見 ASSET-LICENSES.md。正式後端工作需管理者批准，本批不執行 Worker 部署。
