# 庭審重播介面進度

`court/replay-panel.js` 已由 court.js 匯入，新增「回看庭審紀錄」按鈕。
同源登入後透過 GET-only loader 讀取伺服器事件；模態視窗隔離即時操作，
開啟時暫停原旁觀播放及語音。提供逐步、播放／暫停、時間軸、文字／角色／
階段／證物 ID 篩選，以及當時可见的證物。全部使用 textContent，沒有 HTML 插入。
關閉、登出、pagehide 清空資料；切換場次或帳號後拒收舊回覆。

限制：這是網頁歷史紀錄，不是 Unity 3D 動作重播。NPC 問題、舊版 dialogue
引導等尚非完整事件來源；不可宣稱完整庭審逐字稿。舊場次從 checkpoint 開始。
尚需友善角色選單、中文事件類型名稱、證物／法源連結、真實瀏覽器及手機驗收。

驗證：replay/replay-loader 共 9 項資料層測試；replay-panel 1 項模擬 DOM
生命週期測試；JS 語法檢查通過。模擬 DOM 不等於 Chrome/Edge 或手機證據。
這批 UI 尚未部署 Cloudflare；正式版仍以 SESSION-MANAGEMENT-RELEASE.md 為準。
