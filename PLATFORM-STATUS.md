# EduAI2 平台實作檢查點 — 2026-09-23

本文件優先於舊版 STATUS 的範圍說明。最新使用者已授權開發登入、法庭、學習與排行榜後端；只推送 1ch666/eduai2，禁止付費服務與自動升級。**整份計畫尚未完成；本分支為開發預覽，不代表正式發布。**

第一次接手請先讀根目錄 `給朋友的AI接手說明.txt` 與 `朋友AI續作_完整需求規格.md`；前者說明現況與啟動方式，後者列出三階段產品需求、驗收與 AI 續作指令。

## 第一批已寫入、已驗證的功能

- 增量新增 CourtRoom／Learner SQLite Durable Objects；每場次／每使用者拆分。保留 MessageRoom 與 AccountStore 的名称及既有資料表。
- 一次性復原碼只儲存摘要；復原後輪替並撤銷所有舊 session。登入與復原並發時，發 session 前再次核對密碼版本。
- `/api/court/cases`、`/sessions`、`/sessions/:id`、`/actions`、`/dialogue`。場次擁有者、CSRF、階段、版本、重送識別及操作上限均由伺服器檢查。
- 六個原創範本；法官、當事人、代理／辯護／輔佐人與旁觀角色依程序限制。法官另有准駁練習。少年旁觀禁止是產品限制，不能描述成法律絕無例外。
- 成人刑事範本新增「告訴代理人」視角（原告方律師），對應刑事訴訟法第236條之1、第271條之1；已加入法律來源清單並標示非律師代理人於審判中不得檢閱卷證。指定辯護仍限刑事被告方，少年保護範本仍不設原告方律師、不開放旁觀。
- 年齡上下限改由 `AGE_LIMITS` 單一來源提供：`validateConfig` 依它拒絕，`/api/court/cases` 也回傳同一組限制，`/court/` 設定畫面在送出前就顯示適用程序、年齡與法律協助限制、對應法條連結，並在年齡不符範本時提供切換到對應範本的按鈕。伺服器仍是唯一權威，前端只呈現同一組限制。
- `/court/` 設定、存檔恢復、證物、陳述、程序／證據／自我論證回饋；語音按住辨識、確認文字送出、取消、文字 fallback、選擇性朗讀。
- 主網站帳號面板提供練習紀錄 JSON 匯出／預覽／確認匯入，限制100KB與每類500題；只合併明確允許的欄位，永遠是自行回報、不計排名。登入不自動搬移遊客進度，換帳號不混合雲端紀錄，雲端尚未讀取成功時不覆寫。
- 預寫對話可離開 AI 完成。AI 引導有逾時／格式檢查、每使用者限流及每版本快取；`COURT_AI_ENABLED=true` 且有 key 才可能呼叫。未查證免費額度前不得開啟。**AI 對話已改為依當前說話角色（scriptedTurn.speaker）生成台詞，並以固定台詞作為參考；fallback 仍為預寫模式。前端顯示改為「AI 對話（角色名）」。仍需 COURT_AI_ENABLED=true 與 key。**
- `POST /api/auth/first-recovery`：已實作。登入帳號可在確認目前密碼後，為尚無復原碼的既有帳號產生首次復原碼（僅顯示一次）。已有復原碼的帳號回 409。`/api/auth/session` 現在回傳 `hasRecoveryCode` 布林值；`/court/` 帳號面板在 `hasRecoveryCode=false` 時顯示首次取碼區塊。
- 真 Unity WebGL 已重新建置；修正原有未編譯 WorkerDialogueProvider 缺少 jsonserialize/unitywebrequest 內建模組。原遊戲預設不變；`?court=1` 同源 iframe 才啟用座位／全景／走動鏡頭與原創積木式人物。
- Unity橋接只接白名單的視角資料，不接 session、金鑰、案件裁判。網頁是同源 API 唯一登入邊界。

## 實際測試證據

- TypeScript 檢查、原 API 整合檢查通過。
- `node --test scripts/test-court.mjs scripts/test-api-fetch.mjs` 通過；六案的全部支援角色（含刑事告訴代理人）、年齡、法律協助、非法階段與法官准駁，另檢查 `AGE_LIMITS` 與 `validateConfig` 的界限一致。
- 2026-09-23 追加：`npx wrangler types`、`npx tsc --noEmit`、`node --test scripts/test-court.mjs scripts/test-api-fetch.mjs scripts/test-progress-import.mjs scripts/test-progress-isolation.mjs`、`node scripts/check-frontend.mjs`，以及對本機 `wrangler dev`（127.0.0.1:8790，persist-to .wrangler/court-test）的 `node scripts/check-api.mjs`、`node scripts/check-court-api.mjs` 全部通過。`/court/` 設定畫面另以本機 jsdom 腳本檢查角色選單、年齡警告、範本切換與法律協助提示；該腳本不在倉庫內，未新增相依套件。未做實機瀏覽器與手機回歸。
- `node scripts/check-court-api.mjs http://127.0.0.1:8790` 通過；僅允許 localhost，驗證跨帳號越權、CSRF、重送、跳階段、恢復、預寫降級、復原碼輪替與舊 session 撤銷。
- 模板與觸控 11 項測試通過；新增同源父頁白名單橋接測試。
- Unity 6000.3.24f1：Scene／Smoke／Play／WebGL 建置 exit 0。Play 加入少年旁觀拒絕、法官座位停止移動及回到走動模式。
- 本機瀏覽器已確認登入、建立民事法官場次、陳述保存、證物階段與 Unity 初始化／人物顯示。未完成全角色瀏覽器回歸，未測實體手機語音；不得宣稱真機驗收。
- npm audit 更新後 0 vulnerabilities。Wrangler 4.136.3。
- 額外4項匯入驗證及帳號隔離測試通過：`node --test scripts/test-progress-import.mjs scripts/test-progress-isolation.mjs`。

WebGL 壓縮後下載比較（bytes，不包含 HTTP header／HTML／快取效果）：

|檔案|原部署版本|本分支|
|---|---:|---:|
|data|1,255,708|1,296,767|
|wasm|4,844,017|4,982,411|
|framework|84,602|86,014|
|loader|47,867|47,867|
|touch-controls|5,172|5,172|
|合計|6,237,366|6,418,231|

增加180,865 bytes（約2.9%）；保持 Release、Gzip fallback、Medium stripping 與 Strip Engine Code。這是檔案大小，不是實機首載時間測量。

## 尚未通過第一階段發布門檻

1. 法律來源已有官方連結和查核日期，但部分逐條生效／沿革日期待查核；年齡跨越、法定代理等只做有限範本模型，不能作真實案件資格判斷。須補官方司法院程序來源、核對各角色及案件後才能正式開放。
2. 完整多角色 AI 對話、法庭人物動作與發言／證物特寫仍需完成。現有引導不可稱完整 AI 審判。
3. 完整平台尚未遷至正式 Worker；Pages 導流、同源入口待完成。已提供練習紀錄匯出／匯入，但未包含 IndexedDB 待同步留言；不得自動搬移其他來源 localStorage 或把匯入留言直接公開。
4. 尚未部署本分支 Worker／Pages。不要僅因本機測試通過就開正式開關；先備份部署版本、確認 v2/v3 增量遷移，再後端後前端。
5. 完整語音取消／背景恢復與各角色實機驗收待補。

## 第二階段：部分已實作

- **伺服器客觀題派發與判分（2026-09-24）**：`GET /api/practice/questions` 依弱點概念挑題、發出一次性 questionToken（正解不下傳）；`POST /api/practice/answer` 伺服器判分、記錄首次作答標記；`GET /api/practice/weakness` 依最近 20 次首次作答計算概念強弱（< 5 題顯示 insufficient，< 60% 為 reinforce，60–79% 為 review，≥ 80% 為 consolidate）。題庫含 13 題覆蓋法律、公民、經濟。Practice DO（v4 migration）按帳號拆分，重做不計首次統計。需部署前確認 v4 migration。
- **弱點補強流程（2026-09-24）**：`GET /api/practice/reinforce` 返回概念短講解（常見錯誤＋重點）＋同概念補題 token；13 個概念均有預寫指南。`practice/index.html`+`practice.js` 提供完整練習 UI。
- **弱點→排程串接（2026-09-24）**：weakness API 回傳加入 `subject` 欄位；弱點頁對 reinforce/review 概念顯示「安排複習」按鈕，點按帶 `title`/`subject` params 跳轉 `/planner/`；排程頁 `prefillFromParams()` 讀取 params 自動填入表單並展開，URL 隨即用 `history.replaceState` 清除。
- **每週排程後端與 UI（2026-09-24）**：`GET/POST /api/planner/slots`、`GET/PUT/DELETE /api/planner/slots/:id`（衝突檢查、CSRF、速率限制）；`POST /api/planner/focus/start|beat|end`（伺服器 heartbeat，離線 > 5 分鐘不計）。Planner DO v5 migration。`planner/index.html`+`planner.js`+`planner.css` 週曆 UI、ICS 匯出已完成。弱點→排程串接（自動安排複習時段）尚未實作。
- **Web Push 訂閱儲存（2026-09-24）**：`GET /api/push/vapid-key`（公鑰）、`POST /api/push/subscribe|unsubscribe`（CSRF 保護）；PushStore DO v6 migration；`public/sw.js` 服務工人處理 push 事件；`public/manifest.json` PWA 宣告。實際推送（伺服器送出通知）需 VAPID 私鑰 + cron trigger，Cloudflare 付費方案才有 cron，目前尚未啟用（capability `push: true` 指訂閱端已就緒）。
- **背景音樂播放器（2026-09-24）**：`public/music-data.js` 授權清單（5 首 CC BY 4.0 及公共領域）；`public/music-player.js` 浮動播放器 widget（播放／暫停／切歌／音量／靜音、顯示授權）；排程頁動態載入。音樂檔案（`.mp3`）需自行下載至 `public/music/`，未隨原始碼提交。
- 照片裁切／壓縮／EXIF 去除、裝置 OCR、確認文字後講解；沒有已確認免費的視覺模型，不可直接啟用或謊稱支援圖片。
- 伺服器 cron + VAPID 私鑰實際推送通知（需付費方案）。
- 伺服器 cron + VAPID 私鑰實際推送通知（需付費方案）。
- 首次作答競賽題組、每週排行／段位、私人群組權限及可撤銷邀請（第三階段）。

上述 capability 回 false，不可用只有外觀的按钮冒充完成。

## 接手與本機重現

```
npm ci
npm run build:assets
npx wrangler types
npx tsc --noEmit
npx wrangler dev --ip 127.0.0.1 --port 8790 --inspector-port 0 --persist-to .wrangler/court-test --local
node scripts/check-api.mjs http://127.0.0.1:8790
node scripts/check-court-api.mjs http://127.0.0.1:8790
```

若 Windows runtime 啟動失敗，先停止自己的 dev 程序，指定獨立本機 persist-to 與 inspector-port 0；不要刪正式 DO 或整個工作目錄。

Docker 維持靜態遊戲，另包含 `/court/` 預覽檔；`/api/` 明確回501，**沒有設定後端就沒有登入／存檔／AI**。每次遊戲發布後須重跑免費公開仓库 Court Docker handoff，記錄來源 commit 與 artifact SHA256；未成功完成不能稱已打包。不得把 Cookie 或 key 加入映像。

2026-09-23 預覽 Docker run **35847457427** 成功，來源 **590c5bb**。第一次 run 35847315749 因 build-context 白名單漏 court/ 失敗，已修正。成功驗證 build/run、遊戲与 court/ 逐檔比對、API501、非 root／唯讀與 revision label；不是正式網站部署。之後只修改根目錄主網站與測試／文件，不改此映像遊戲或 court/ 位元組。

映像已下載並核對 SHA256：`9a246aefc2414d6d0a05a9da80226cca6f579d3abcaf84d1786ff229cd644330`（eduai-court-preview.tar.gz）。本機保存於工作區 `outputs/eduai2-platform-docker-35847457427/`。GitHub artifact 1天後過期；本機副本可繼續交接。完整來源 commit 為 `590c5bb84e99013ad130fd608a4e3b2605888143`。

新人物由 Unity 基本幾何原創組合，無下載角色模型。字型沿用 Noto SIL OFL 1.1（來源和授權見 court-game/tools/fonts）。奶蛙仍非前置依賴。
