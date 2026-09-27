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
- 已完成下列本機 Unity WebGL 角色提問／AI 停用／重開歷史流程；尚未完成斷線恢復與真實供應商回覆的遊戲內驗收。本批不是新版 C# presenter、姿態動畫或座位映射完成。
- 舊事件快照可能沒有 npc.ask；不能為啟用新按鈕重寫歷史。可先做合法程序動作取得新快照，或開新場次。不要靜默退回不共用 pending 的舊 POST。
- 正式 Worker 現行發布仍是 `RELEASE-NPC-V1-2026-09-27.md` 所記來源，不含此批。

## 本機真實 WebGL 驗證（2026-09-27）

來源：b6b7f34；本機 Worker `http://127.0.0.1:8792`，持續運行的本機狀態庫，`COURT_AI_ENABLED=false`。使用本機測試帳號，未改正式帳號、Secrets 或資料。瀏覽器是 Codex 內建 Chromium，不能代替 Chrome、Edge 或手機真機驗收。

1. 從已登入介面恢復「沒有寄出的相機」，民事法官角色、陳述與爭點階段、版本 2。
2. 透過「載入 3D 場景」取得 WebGL，進度到 100%，按「開始遊戲」後實際場景呈現。這次 Build 回應為 304，屬快取載入，沒有量測首次載入時間。
3. 切自由走動，畫面顯示 Pointer Lock 相容模式。使用 W 前進、滑鼠拖曳轉向，在原告角色前按 E，開啟 Unity NPC 對話。
4. 在遊戲的 DOM 中文輸入框填入「你親眼看見什麼？」並點送出。這證明中文字串傳遞與呈現，不等於已驗證作業系統注音組字流程。
5. 畫面顯示場次版本 3，系統明示 `[AI_DISABLED] 未新增角色證詞`，並保留玩家問題與系統提示；不冒充角色新證詞。等待結束後輸入框恢復可用。
6. 關閉對話後回到場內視角；再次對準同一角色按 E，讀回同一筆問題與提示，場次仍為版本 3。未重新送出問題。鏡頭有返回可操作視角，但未量測 position／rotation／FOV 等完整恢復不變量。
7. 本機 Worker 實際輸出包含一次 `POST /api/court/v1/sessions/{id}/actions 200`，前後為快照與擁有者場次 GET；這段操作沒有舊版 NPC messages POST。重開對話只有場次 GET。

本機截圖：工作區外層 `outputs/unity-npc-v1-local.png`（不含正式資料，未打包進部署資產）。

本輪重新執行 `node --test scripts/test-npc-action.mjs scripts/test-npc-bridge.mjs scripts/test-pending-recovery.mjs`：13 項通過。自動化結果不能代替上述尚未驗證的供應商、斷線、手機、完整程序與鏡頭不變量。

## 真實本機 API 的回覆遺失整合測試

新增 `scripts/check-npc-recovery-api.mjs`，執行方式：

```sh
node scripts/check-npc-recovery-api.mjs http://127.0.0.1:8792
```

前提：本機 Worker 已啟動，並明確設定 `COURT_AI_ENABLED=false`。腳本拒絕非 loopback HTTP origin，且在建立測試帳號前核對 NPC AI capability 關閉。只建立一次性本機帳號與三個場次；資料保留供檢查，不操作正式資料、不輸出 Cookie／CSRF，不呼叫模型。

2026-09-27 實際執行通過三種情境：網路錯誤、損壞 JSON、逾時。每種情境都使用真正的 `CourtTransport`、`askNpcThroughTransport`、pending journal 與本機 workerd API，在伺服器成功寫入 NPC 事件後才注入回覆錯誤。重新建立 transport 模擬頁面重載，再模擬一次查詢斷線、恢復連線後以 GET 查回伺服器的原結果。

驗證：未確認期間新提問被阻擋；重建後不能 POST retry；查詢失敗保持 pending；恢復後清除 request marker 並解鎖；每個場次實際只送一次 POST，版本只增加一次，事件與 NPC history 各只有一筆相同 requestId。marker 儲存只有 opaque requestId，沒有保存問題文字或認證資料。

限制：錯誤由 Node fetch adapter 注入，pending storage 使用記憶體 Map；不代表真正瀏覽器 reload、作業系統斷網、Unity 逾時 UI、手機背景恢復或供應商成功回答已完成驗收。測試未修改後端與正式設定。

下一步：在遊戲內驗證中斷並從程序面板恢復 → 驗證真實 AI 供應商回覆 → 部署同源前端 → Docker 重建。遊客固定案件路徑不修改。正式部署仍未包含此批接線。
