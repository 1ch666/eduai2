# Unity 公開狀態接線（實作中，未發布成品）

## 實際寫入

- court/snapshot-relay.js：父頁使用 CourtTransport 的 GET 快照路徑，驗證目前帳號／場次／iframe；每個 iframe 握手建立新 channel，換場次拒收舊回覆。render 後同步新版狀態，並行刷新合併。
- court/unity-hud.js：新模板啟動後才載入，檢查同源父視窗、精確訊息欄位、channel、嚴格快照格式與版本，再送至固定 CourtRuntimeState GameObject；沒有 API 呼叫或動態函數名稱。
- CourtRuntimeState.cs：使用 CourtClientState + CourtWire，呈現案件標題、階段、可用動作數、同步失敗提示。字型沿用場景現有字型，不增加素材。UI 不攔截既有操作；不本機判分或推進階段。
- 新模板與 court.js 已接線，但 play/ 仍是上一份成品，未手動讓舊二進位呼叫不存在的方法。

## 邊界與剩餘工作

這是雲端 Unity 的唯讀狀態接線，不是整個遷移完成：NPC、動態按鈕、證物視覺與座位 mapping 尚需透過統一 store/presenter 接管。舊遊客平板原型仍存在，不能宣稱已完全移除 client 權威。

新 WebGL 尚未建置／部署，未更新 Docker。整批完成後再執行使用者指定的集中驗收，包含重新載入、斷線、過期回覆、換帳號、手機 HUD 排版及原鍵鼠／觸控功能保留。

本批不修改後端、Secrets、資料庫或權限。

## 必要編譯檢查

2026-09-27，官方 Unity 6000.6.2f1 在獨立暖快取專案啟動 batch 編譯，退出碼 198。
日誌為 access token unavailable、0 matching free entitlements、com.unity.editor.headless not found，尚未進入 C# 編譯。
未繞過授權或安全設定；需使用者在 Unity Hub 恢復有效免費授權後再編譯。不能用之前版本的成功紀錄證明本批通過。
JS 語法與 diff 檢查通過，不等於 Unity 或完整遊戲驗收。
