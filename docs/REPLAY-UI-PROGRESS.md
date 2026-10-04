# 庭審重播介面進度

## 回顧失效邊界追補（2026-10-04）

回顧 API 回 401／403／404 時，清除事件、證物、完成場次問答、搜尋值與
播放計時，並停止以外側頁面暫留的帳號／view 重新填回私人內容。視窗保留
可讀錯誤提示，重新登入並從場次入口開啟後才重新讀取；不無限重試。
證物「查看關聯紀錄」使用畫面世代識別，倒帶、換選項、換場次或清除後的
舊控制器不能重新帶出舊證物 ID。未變更後端或伺服器權限規則。
22 項集中回歸通過（HTTP 失效模擬、問答、重播／loader／panel、證物），
前端語法與資源檢查通過。這是模擬 DOM／HTTP 證據，不冒充瀏覽器斷線、
正式 Session 失效或手机實測。發布結果接續記錄。

版面追補 `2060ac4a1d5c63e3ba2c2d35a8dfcdd8ad8cc4e8`：只有第一個關閉
按鈕 sticky，清除篩選不再覆蓋內容。瀏覽器 computed style 實測分別
sticky／static；新增 CSS 回歸後問答與面板 5 項通過。Worker 最新版
`7da3dbb7-193f-4b97-afb1-bf618c6ec98a`，回滾至下方 4a6d49a9 版本。
CI 37192673476、Pages 37192672898、Docker 37192681569 皆 success；
Worker／Pages CSS 200 與來源一致。Docker 最新包以 2060ac4 為準；
先前 39bf599 包已下載 outputs/docker-39bf599、來源與七項校驗值通過，
但不能當成最新版 CSS 交接包。沒有 Unity 二進位修改。

本批正式發布來源 `39bf599cfd135ba5ce06303432eb9883cdb7acf1`，Worker
`4a6d49a9-19be-4677-abd8-0c5d4bf66bf2`。CI 37192462465、Pages
37192462245、Docker 37192486767 均 success。Worker 和 Pages 的
question-review.js／replay-panel.js 皆 HTTP 200 且正規化換行後與提交
來源相同。從獨立 git archive 發布，未包含工作樹原有修改；types、TS、
dry-run 通過，保留既有變數／Secret／binding／正式資料。回滾版本為
`e89d31b1-982d-461a-9e8b-cee036b9fc8f`。Unity 成品 unchanged。
Docker 已實際 build/run 及 HTTP 校驗；仍是靜態預覽，不含正式登入／AI。

## 2026-10-04 問答回顧與導航（優先於以下歷史紀錄）

新增第一筆／已讀最後一筆、目前位置與已讀數量、事件類型中文篩選。
選單只採播放位置之前的已驗證事件，倒回時清除未來選项；沒有載入的
後續紀錄仍需讀取下一頁，不將「已讀最後一筆」冒充整場最後一筆。

已完成場次另有「我的提問與角色回覆」，使用同源擁有者授權的既有
view.npcHistory，不重呼叫模型。與事件時間軸分開，因舊問題紀錄沒有
時間／階段，不把問題附會到某個歷史瞬間。顯示 AI、辭典或非 AI 預寫
模式，可搜尋及依角色篩選；每批 20 筆，最多最近 200 筆。不是完整逐字稿。
不顯示 knowledgeIds、prompt、secret 或內部欄位；不向 Unity 傳這些歷史。
案件未完成時隱藏，關閉／登出／換場次清除；帳號切換後的舊控制器也
拒絕重新呈現先前文字。所有內容 textContent，沒有 HTML 注入。

集中測試 20 項通過（問答投影／界面、replay／loader／panel、恢復及
Demo），前端檢查通過。本機 Chromium 的既有合成版本 13 完成場次：
讀取 14 筆、首尾跳轉、角色發言篩選、展開真實保存的追問／预寫回應、
搜尋 20:17 成功，版本維持 13，無捕捉到 console error/warn。
截圖 outputs/question-review-20261004.png。未新增正式研究紀錄；不是
live AI、手機真機或 Unity 3D 動作重播驗收。此批沒有改 C#／Unity Build、
後端程式、資料庫、API 或權限；發布狀態另記。

`court/replay-panel.js` 已由 court.js 匯入，新增「回看庭審紀錄」按鈕。
同源登入後透過 GET-only loader 讀取伺服器事件；模態視窗隔離即時操作，
開啟時暫停原旁觀播放及語音。提供逐步、播放／暫停、時間軸、文字／角色／
階段／證物 ID 篩選，以及當時可见的證物。全部使用 textContent，沒有 HTML 插入。
關閉、登出、pagehide 清空資料；切換場次或帳號後拒收舊回覆。

限制：這是網頁歷史紀錄，不是 Unity 3D 動作重播。NPC 問題、舊版 dialogue
引導等尚非完整事件來源；不可宣稱完整庭審逐字稿。舊場次從 checkpoint 開始。
已顯示紀錄時間、常見角色及事件的中文名稱、關聯證物及法源 ID；可點選紀錄
跳至對應歷史事件。未知角色保留伺服器 ID，不猜測其法律身分。搜尋無結果時有提示。
法源 ID 不是已核實的官方網址；尚需友善角色選單、證物／法源連結、真實瀏覽器及手機驗收。

驗證：replay/replay-loader 共 9 項資料層測試；replay-panel 1 項模擬 DOM
生命週期測試；JS 語法檢查通過。模擬 DOM 不等於 Chrome/Edge 或手機證據。
這批 UI 尚未部署 Cloudflare；正式版仍以 SESSION-MANAGEMENT-RELEASE.md 為準。
