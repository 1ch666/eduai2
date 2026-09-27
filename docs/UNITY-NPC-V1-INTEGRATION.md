# Unity NPC → v1 提問接線（2026-09-27，尚未部署）

## 此批實作

Unity 現有 NpcDialogueUI／原生中文輸入／鏡頭／桌機與手機操作保持不變。`court/court.js` 的同源 NPC 訊息入口不再自行呼叫 v0 messages POST，改由 `actionPanel.askNpc()` 使用同一個 CourtTransport。網頁程序面板與 3D NPC 不再各自維護尚未確認的提問。

`court/npc-action.js` 先刷新伺服器快照，再確認 npc.ask 與公開可互動目標；真正的合法性仍由伺服器驗證。Unity 的 requestId 僅作回覆 UI ticket，正式 requestId、idempotencyKey 與 expectedStateVersion 由 shell transport 管理。有限的記憶體 ticket 清單防止同一場次相同訊息重複產生新 POST；不同內容重用 ticket 拒絕，最多 40 筆，不任意淘汰後重送。登入者／場次改變會隔離清單；登出和 pagehide 清除。問題文字只在當前記憶體比對，不新增本機持久儲存。

逾時／不明結果仍保留 sessionStorage 的 opaque request marker，新的提問被阻擋；Unity 回覆提示到「伺服器程序操作」查詢上次結果。重新開啟 NPC 不會自動重送。成功後沿用既有 owner-checked GET 讀取最多五筆角色歷史，保留 AI／系統提示／辭典的原標示。

此路徑不呼叫程序面板的 onUpdated 座位鏡頭回呼，避免提問完成時改動正在開啟的對話鏡頭。render 仍會請 HUD relay 同步公開狀態。

## 驗證與限制

- 新增六項 `scripts/test-npc-action.mjs`：快照先行、输入／預留拒絕、目標可見性、context 變更、錯誤不退回舊 POST、UI ticket 去重／容量／帳號隔離。
- 與 transport、reload recovery 合跑 25 項通過；與既有 NPC／IME 橋接合跑 12 項通過（兩組重複含六項新測試，不能相加當成不同測試數）。前端語法／資產檢查通過。
- Docker 工作流程加入新測試與新模組 HTTP 比對，尚未以此批來源執行；不能以先前映像代替。
- 尚未實際在 Unity WebGL 角色對話 UI 走完整流程；本批不是新版 C# presenter、姿態動畫或座位映射完成。
- 舊事件快照可能沒有 npc.ask；不能為啟用新按鈕重寫歷史。可先做合法程序動作取得新快照，或開新場次。不要靜默退回不共用 pending 的舊 POST。
- 正式 Worker 現行發布仍是 `RELEASE-NPC-V1-2026-09-27.md` 所記來源，不含此批。

下一步：更新本機資產 → 在真正 Unity WebGL 開啟角色／輸入中文／回覆／重開历史 → 模擬中斷並從程序面板恢復 → 核對無重複動作與鏡頭移動 → 部署同源前端 → Docker 重建。遊客固定案件路徑不修改。
