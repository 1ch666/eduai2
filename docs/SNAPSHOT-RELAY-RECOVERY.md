# Unity 公開快照同步：斷線與權限恢復

2026-09-27，本批修改 `court/snapshot-relay.js` 與對應測試，不修改 Unity 二進位、後端、資料庫或部署設定。

## 已修正

- 瀏覽器發出 offline 事件時，HUD 標示無法同步；尚在途中的回覆不會覆蓋這項狀態。
- online 事件強制讀取伺服器快照，不因網頁暫存版本未變而略過。若已有請求，合併為一次後續重新讀取。
- 強制讀取失敗時撤銷本機的「已送達版本」快取，後續一般同步可重試。此快取僅為傳送最佳化，不是案件權威。
- 同時核對帳號、場次、案件類型與 iframe。切換任何一項後，不把舊回覆送入新情境。
- 401／403 清除 HUD 綁定與場次資料，需重新授權／建立握手，不繼續呈現受保護資訊。

## 證據

`node --test scripts/test-snapshot-relay.mjs scripts/test-unity-hud.mjs scripts/test-court-transport.mjs`

共 22 項通過，其中 relay 新增 8 項。使用真實 CourtTransport 搭配受控 fetch 回覆，涵蓋來源／視窗白名單、精確握手欄位、唯讀 GET、換帳號／案件、重新握手取消、斷線及恢復、在途合併、401／403、500 後重試、異常格式與離頁取消。

這是自動化 JavaScript 測試，不代表手機真機、完整瀏覽器或全部遊戲功能驗收。online 事件不保證網路已能使用，仍以實際 API 結果為準。未新增背景輪詢，事件未觸發的斷線由下一次同步偵測。

## 發布證據

來源 `fc17f77ae09c69e67b8c8d6b9243f24935d5b6c9`，TypeScript 檢查與 Wrangler 4.136.3 部署乾跑通過。2026-09-27 使用 `deploy --keep-vars` 完成既有 Worker 發布，版本 `0031d3b1-200e-42e9-a8fe-4df3bd1a62ca`，只有 `/court/snapshot-relay.js` 是新增／變更的靜態資產。沒有更改綁定、Secret、權限或資料庫設定。

正式 Worker 的 `/court/snapshot-relay.js` 回傳 HTTP 200、2,923 bytes，SHA-256 `32f89d61774342fab2174e72798ff1e22b20b1ebec39bbc241f5e9dd44ae6ece` 與本機相同。

[Docker run 36321865074](https://github.com/1ch666/eduai2/actions/runs/36321865074) 已完成且結論 success，來源同上。沿用既有靜態容器測試；容器不包含正式後端。Unity 二進位未改，不將此記錄稱為重新編譯或真機測試。

完整 NPC／程序引擎遷移、角色資訊隔離、3D 重播、研究模式與真機全流程仍未完成。
