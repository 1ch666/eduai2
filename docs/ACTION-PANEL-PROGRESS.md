# 伺服器動態程序操作（待整批驗收）

新增 court/action-panel.js，透過既有 CourtTransport 與嚴格 v1 DTO 操作；court.js 已接入同源網站入口。GitHub Pages 不提供此新入口，避免跨站 Cookie 路徑。

- 從伺服器 allowedActions 建立按鈕，顯示停用原因；支援 none/evidence/npc 目標，未知類型停用，不猜程序。
- NPC 選單只呈現快照中 visible、interactable 且不在 pending 的角色；送出前重新核對目前快照，不使用手寫 NPC ID。沒有目標時停用並顯示原因。這只是 UX 篩選，後端仍需授權。
- 陳述與證物 ID 從目前表單送出，預期版本、requestId、idempotencyKey 由 transport 產生；後端再判定合法性。
- 提供更新快照、查詢上次結果、明確重送同一筆。關閉再開啟不清掉未確認請求；禁止舊操作或 NPC 同時提交。
- v1 成功後刷新相容的 v0 展示，核對場次、帳號與版本後才呈現；不直接修改 stage/score。
- 暫留原控制及遊客功能，新 panel 不是 Unity HUD，也不是正式完成單一權威 store 遷移。

## 尚待完成

集中實作後統一驗收：表單/快捷鍵/所有角色、重試與409/401、換場次/帳號、重新載入時 pending 復原、完整 Unity receiver 接管。
目前新增分頁 sessionStorage 請求識別碼復原；重整後只查詢伺服器結果，不保存或重送原陳述。詳見 PENDING-RECOVERY.md。此功能尚待整批驗收，不能宣稱斷線恢復的完整驗收已通過。
未改後端、資料庫、Secrets；尚未部署 Cloudflare。

NPC 目標選擇已接入 shell，但目前正式 v1 projection 的 NPC 清單仍待後端接通，不代表完整 AI NPC 或訊問程序已上線。`scripts/test-action-targets.mjs` 已編寫，待最後統一執行；本次僅語法與 diff 檢查。
