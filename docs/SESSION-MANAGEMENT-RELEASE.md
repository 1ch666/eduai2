# 場次管理發布 — 2026-09-27

使用者已授權由本代理部署既有 Cloudflare Worker。免費優先；未調整付款、金鑰、成員權限或既有 bindings。

## 本次功能

- `/court/`「繼續上次的場次」旁新增「新增場次」，移到既有案件設定，使用者確認設定後才建立，不會直接消耗 AI 額度。
- 每列提供刪除按鈕及含案件名稱的確認提示。
- `POST /api/court/sessions/{id}/delete` 要求登入、可信 origin、CSRF、限流及 `{confirm:true}`；CourtRoom 再驗證 owner。
- 採軟刪除：新增 `court_deleted` 標記表，所有透過 read 的場次/NPC/事件/動作接口停止存取；init 不得重新建立已刪 ID。原始 state、對話及事件保留，不是個資永久清除功能。
- 先保存刪除標記，再移除 Learner 清單索引。跨 DO 不宣稱原子交易；索引更新失敗可重試，已標記場次仍不可開啟。
- 未提供使用者還原按鈕；管理者恢復需另行授權，核對 owner、標記及索引，不可任意清空資料。

## 證據

- TypeScript noEmit、court.js 語法檢查通過。
- `scripts/test-court-journal.mjs` 10 項 Node SQLite 測試通過。
- `scripts/check-court-v1-api.mjs http://127.0.0.1:8792` 真實本機 workerd 通過：登入、越權、CSRF、版本衝突、冪等、重播讀取不修改場次、軟刪除與重試；只用本機測試帳號。
- `wrangler deploy --dry-run --keep-vars` 通過，正式 `wrangler deploy --keep-vars` 成功。
- 新版本 `8186a911-fd50-4878-8cd9-c0741391a37a`，原版本 `310c5b88-276b-47ba-ae54-8f8039651e9b`。
- 線上 `/court/` HTTP 200，HTML 含新增按鈕與軟刪除說明；AI status 回 available=true（不等於模型每次都可用）。未以正式使用者資料執行刪除。
- 尚未真機操作驗收；v1 Unity/replay 新模組已隨靜態資產上傳但未啟用，非新 Unity build。

## 回滾注意

舊版 Worker 不認識 court_deleted。**不可盲目回滾成不檢查刪除標記的版本**，否則已刪場次可能重新可讀。需要回滾 UI 時保留本次後端 read/init 刪除檢查；不 reset migration、不刪資料表。部署沒有修改既有 wrangler migration tags。
