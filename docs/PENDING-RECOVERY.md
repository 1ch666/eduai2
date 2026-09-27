# 程序操作重整復原（實作中，未發布）

## 實際範圍

- `court/pending-journal.js` 以帳號 ID、法庭場次 UUID、案件 ID 分區，sessionStorage 值只存 requestId。法庭場次 UUID 不是登入 session token。
- `court/transport.js` 在 POST 前保存識別碼，成功取得且驗證相符的事件後才移除；移除後再讀取確認。儲存失敗時禁止新操作。
- 同一分頁重整、重新開啟相同場次時，action-panel 復原 pending 並僅允許 GET 查詢原結果。未保存原始 body，因此不能在重整後重新 POST。
- 在有效快照套用後若清除失敗，保留 pending；再次成功查詢並清除時解除阻擋。
- 第一筆請求的明確拒絕可以清除；先前已有不確定結果時，後續重試遭拒不代表前次未成功，仍保留 pending。
- 帳號登出清除記憶體中的私有展示，不刪除分頁內的原帳號識別碼；其他帳號不能拿這個 marker 呼叫恢復。伺服器仍須檢查擁有者。

## 安全與尚未完成

不保存 CSRF、Cookie、密碼、陳述文字、原始 POST、完整快照或私有事實。不自動重送、不自動購買服務、不修改正式資料。

sessionStorage 在關閉分頁後可能消失，不保證跨分頁／跨裝置恢復。此機制只接入新的伺服器程序面板，尚未涵蓋全部舊 v0／NPC 操作，不是完整集中狀態遷移。

GET outcome 的 404 不證明原請求沒有執行。若儲存 marker 後、POST 前即關閉或重整，可能永遠查不到結果；此時保留安全阻擋，不提供直接清除再送。後續需伺服器原子封存／取消未執行 request 的正式契約，避免取消與原 POST 競爭。不得把本機刪 marker 當成安全恢復。

惡意同源腳本可破壞 sessionStorage，marker 不是可信權限來源。客戶端格式驗證與 server owner/CSRF/idempotency 檢查仍必須保留。

## 待統一驗收

2026-09-27 使用者改為邊開發邊測試。`scripts/test-pending-recovery.mjs` 6 項通過：識別碼分區、無敏感資料、儲存錯誤、重整後只 GET、清除失敗再恢復、先不確定後拒絕及未知結果阻擋（部分條件合併於同一測試）。另 transport 10 項通過。這是 Node 測試，不等於真實瀏覽器重整／手機恢復已驗收。

仍需真實瀏覽器驗收：重整、登出／登入、Cookie 過期、sessionStorage 禁用、401、404 長期不確定、場次切換、返回前頁及手機背景恢復。未部署 Cloudflare，未更新 Unity binary。
