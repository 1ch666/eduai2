# 最新 NPC 續作 — 2026-09-25（原始碼批次，未發布）

基準 main c1dfe49；新需求文件 01／04／05。已下載並準備 Kenney CC0 三款 FBX、共用貼圖與授權，新增 `NpcUpgrade.Apply` 增量接線工具、Unity 原生 `NpcDialogueUI`、角色固定 fallback、輸入隔離、說話動畫及手機鍵盤視窗橋接。完整範圍及管理者待辦見 `NPC-IMPLEMENTATION.md`、`ASSET-LICENSES.md`。

**Unity 實際執行失敗（exit 1）**：6000.3.24f1 在 ScriptCompilationBuildProgram 載入 `Editor/Data/Tools/BuildPipeline/NiceIO.dll` 時，被 Windows 應用程式控制政策封鎖，0x800711C7。尚未完成 C# 編譯、NpcUpgrade 接線、Scene/Play 測試或 WebGL build。沒有停用／繞過安全政策。需要電腦管理者確認官方 Unity 安裝是否被政策誤擋；完成核准或修復後才能再跑建置。

因此模型檔已入 repo、場景接線程式已寫，但 **Courtroom.unity 尚未接入新模型／UI**。現有 `play/Build/*` 與線上遊戲維持原成品。原下載量 data 1,296,767 / wasm 4,982,411 / framework 86,014 / loader 47,867 bytes，四項合計 6,413,059；新版本尚無成品，無法提供有效前後比較。

本批沒有 AI 呼叫、新案件生成、伺服器存檔或正式 Worker 部署。對話明示「備用對話模式」，只存本次遊玩記憶體，刷新會清除；不能稱完整 AI 法庭。Docker 白名單補入既有 auth-sync.js，避免 court.js 匯入缺檔；未重建映像，不宣稱已完成新版容器。

已執行的獨立測試：`node --test court-game/tools/test-template.mjs court-game/tools/test-touch.mjs court-game/tools/test-npc-bridge.mjs`，15/15 通過（含4項新對話觸控層／鍵盤橋接測試）。`git diff --check` 通過。這些 JS 測試不代表 C# 編譯、Unity UI 或手機真機通過。

後續：解除官方 Editor 的政策阻擋 → NpcUpgrade.Apply → Scene/Smoke/Play → WebGL → 桌機/手機瀏覽器 → 比較大小 → 再決定發布與 Docker 重建。正式後端 API 需管理者另外确认。

---

# 進度檢查點 — 2026-09-22

## 最新：遷移到 eduai2

現行倉庫與網站改為 `1ch666/eduai2`、https://1ch666.github.io/eduai2/play/ 。詳見根目錄 MIGRATION.md；下方舊倉庫網址僅供歷史追溯。遊戲二進位與操作不變，HTML 返回連結及 Docker 来源已更新；需使用新倉庫的 Docker 產物。

## 最新：後端第一版（帳號、session、資料庫、法庭 AI 端點）

網站後端新增帳號註冊／登入、HttpOnly session cookie、CSRF 驗證、學習進度雲端同步，以及 `/api/ai/ask` 的 `mode: "court"` 法庭角色提示詞。資料放在既有的 Cloudflare Durable Objects SQLite，新增 `ACCOUNT_STORE`（migration v2），沒有新增付費服務。完整說明、設定步驟與限制見倉庫根目錄 `BACKEND.md`。

已驗證：`tsc --noEmit`、`wrangler deploy --dry-run`、`check-frontend.mjs`，以及本機 `wrangler dev` 搭配新的 `scripts/check-api.mjs` 13 項 API 測試全部通過。

尚未完成：**還沒部署到正式環境**，線上 Worker 仍是舊版；沒有 `OLLAMA_API_KEY` 因此法庭模式沒有向 Ollama 實際送出過；沒有真機瀏覽器測試。

Unity 端只新增 `Assets/Scripts/NPC/WorkerDialogueProvider.cs`（`ICourtDialogueProvider` 的 UnityWebRequest 實作）。**它沒有接進 Courtroom.unity，沒有用 Unity Editor 編譯過，也沒有重新 build WebGL**；`play/` 與 Docker 映像的位元組未更動，仍是下方記錄的手機版成品。

---

## Docker 交接補齊

新版已成功：來源 `700ed22`，https://github.com/1ch666/eduai/actions/runs/35742715223 。實際容器 build/run、兩種入口與所有遊戲資源比對、非 root／唯讀／安全標頭、revision label 及兩份 Compose 語法檢查通過。artifact `eduai-court-docker` 包含映像、獨立 Compose、README、來源版本與校驗檔；保留 1 天。這不代表手機實機遊玩已驗收。本次純文件後續提交不改動此映像內容。

手機版來源 `a2d0ec3` 的 Docker run 35713693604 已成功。此次不修改遊戲或操作，補上映像來源 commit label、下載包內的版本／遊戲雜湊、獨立啟動 compose 及新手 README；新包需另跑 workflow，以成功結果為準。實機遊玩由使用者測試。載入優化維持現有壓縮及自動預載；本輪沒有可用的 Chrome DevTools 效能量測工具，不宣稱新增加速成果。

---

## 手機專用操作（電腦保持原樣）

新增手機／平板左下圓形移動搖桿、滑動轉向、直接輕點角色／物件、DOM 答案按鈕。手機隱藏準星，不要求 Pointer Lock；仍限制 3m 與最近 collider，不可隔牆互動。電腦不會自動顯示這套介面，保留 WASD、滑鼠、準星、E、1–4 及原本 fallback。

10 項網頁測試通過，包含桌面不啟用觸控、搖桿歸零、雙指分工、tap／drag 分離、答案文字安全。真 Unity 場景／流程／Play 測試通過，新增近距離點 NPC、遠距離拒絕與觸控答案回呼。手機 390×844 預覽已實際操作搖桿移動、非中央點角色、點選答案、滑動畫面；這是桌面瀏覽器觸控模式預覽，不是 iPhone／Android 實機。

手機 844×390 橫向也已操作搖桿、直接點 NPC、點選答案，提示已改為「直接輕點」。最後修正答案面板背後重複提示後，Unity 再建置成功（exit 0）。使用者要求減少測試、優先推送，因此不追加真機或完整桌面手動回歸；桌面預設與 Pointer Lock 路徑的單元測試已通過。發布與 Docker 重建將使用同份 WebGL；先不要把上一版映像當成手機版。模型、session、AI 未變更。

---

以下為上一版載入優化的已完成紀錄：

## 最新：WebGL 載入優化（以下歷史紀錄不可當作現況）

前一版真正 WebGL 已在 `bdcdf7f` 部署，不是空白頁。此次改成進頁即背景初始化、0–100% 進度、就緒後直接開始，保留原封面及 Pointer Lock fallback。

最新 Release 建置／場景／案件流程／真 Play 測試均結束碼 0；模板 5 項測試通過。Gzip fallback、Medium stripping、去除未用依賴／Sprite shader、中文字型子集已完成。實際資源 35,322,701 → 6,227,600 bytes（-82.37%），完整表格與 Brotli header 證據見 LOAD-PERFORMANCE.md。

最終成品已在本機瀏覽器重測：不點按鈕自動載入到 100%、保留封面、按「開始遊戲」進入法庭、中文顯示、W 前進到法官桌、E 交談、1／2／3／4 各選項均生效、Pointer Lock 拒絕後改為拖曳視角、重新拖曳不再跳動。瀏覽器錯誤／警告紀錄為空。真實鎖定滑鼠的正常 Chrome 路徑尚未實測（此內嵌瀏覽器拒絕鎖定；模板單元測試涵蓋成功路徑）。

**正式部署完成**：遊戲來源 commit `a4bcbe19bf8d7affd185615fbdc19bcb2b5f3517`。GitHub Pages run https://github.com/1ch666/eduai/actions/runs/35687156750 成功。2026-09-22 公開 https://1ch666.github.io/eduai/play/ 已實測從 0% 自動到 100%、按開始直接進入，中文與 fallback 正常，瀏覽器無 error／warn。HTML、loader、data、wasm、framework 五個線上檔皆 HTTP 200，與本機成品逐位元組一致。

**新版 Docker 已成功重建及驗證**：https://github.com/1ch666/eduai/actions/runs/35687157482 ，與遊戲同一來源 commit `a4bcbe1`。本輪補上 /play/ 與 / 兩種入口、Build 缺檔及 Gzip 完整性檢查、CI 容器逐檔比對。/healthz、API 501、未知路徑404、非 root、唯讀檔案系統及 nosniff 都通過。這是在 GitHub 免費標準 Ubuntu runner 實際 build/run，非本機 Docker 測試；本機尚無 Docker。

交付 artifact `eduai-court-docker`：Linux amd64 映像 `eduai-court:preview`，檔案 `eduai-court-preview.tar.gz` **31,458,086 bytes**。SHA256：`82857623d45147d7842d5128aaf1bf92159df689a35696855f0db2f3fcf650e8`。已下載本機並核對相符，位於工作區 `outputs/court-docker-35687157482/`；GitHub artifact 保留 1 天，過期可用手動 workflow 重建。勿使用 run 35595034481 的舊映像。後續純文件 commit 不更動已驗證遊戲或映像的位元組。

使用者同意奶蛙模型稍後提供；本輪專注載入優化。尚未新增角色、手機觸控、session 或 AI。

---

# 歷史紀錄（2026-09-21；保留供追溯）

## 最新驗證結果（優先於下方歷史紀錄）

### 額度保護檢查點：使用者要求剩 4% 時先推送

第一份 WebGL 已真正建置成功（build.ps1 結束碼 0），HTML／WASM HTTP 200 且 MIME 正確，本機瀏覽器成功顯示法庭、中文、準星。但 Codex 內嵌瀏覽器拒絕 Pointer Lock，出現 Chromium UnknownError，因此沒有發布此有操作問題的第一份成品。

已修正：Web 模板只攔截 requestPointerLock 的拒絕，改呼叫 Player.EnableDragLook；相容模式保留 WASD／E／1234，按住左鍵拖曳轉向、Esc 暫停。正常支援 Pointer Lock 的瀏覽器仍維持原操作。新增 tools/test-template.mjs，成功／拒絕／API 不存在三種測試皆通過。Unity 場景、流程、Play 測試也再次通過。

第二份 WebGL 已完成：`tools/build.ps1` 顯示「Unity 場景與流程測試、WebGL 建置完成」，程序結束碼 0。`tools/serve.mjs` 本機預覽在 127.0.0.1:8088；重新整理瀏覽器後仍需重測相容模式、走動、互動與作答。模板測試只是 JS 單元測試，不取代完整瀏覽器驗收。

下一步：驗證相容版 → 將 Builds/WebGL 成品部署到 play/ → 推 1ch666/eduai → 線上驗證 → 更新 Docker 工作流程／映像並測試 → 更新本文件與新手交接。**線上和 Docker 目前仍是舊空白入口。** 請勿重新下載 Unity 或重做免費授權，這兩項已完成。

- Unity 6000.3.24f1 Editor 與官方 Web Build Support 均安裝成功，安裝結束碼 0；使用者已啟用 Unity Personal，實際 Editor 可解析授權。
- 移除不存在的 inputlegacy／textrendering 套件宣告後，C# 已在真正 Editor 編譯。場景 `Assets/Scenes/Courtroom.unity` 已生成，`COURT_SCENE_VALIDATION_PASSED`，Editor 結束碼 0。
- `CourtSmokeTests` 通過（選項邊界、回呼一次、答錯／完成／重玩），結束碼 0。
- `CourtPlayTests` 已進入真實 Play 並通過（地板／牆／桌碰撞、證物射線、牆壁遮擋、按鈕高亮和持久事件），結束碼 0。這不是手動鍵鼠／瀏覽器操作驗收。
- Play 啟動另有 UnityEditor.Search.SearchDatabase 的內部 ArgumentOutOfRangeException，重跑仍出現；測試斷言通過，但不可宣稱 Editor 完全零例外。未修改 Unity 安裝檔或忽略遊戲腳本錯誤。
- 真實圖形渲染截圖 `Logs/court-preview.png` 已檢視，中文正常；發現並修正準星文字框裁切，重拍後準星正常。截圖與日誌不進 Git。
- WebGL 首次建置進行中；尚未產出並驗證成品。線上入口與 Docker 仍是舊空白頁。建置成功後必須瀏覽器實测、部署、更新 Docker 與交接文件。
- 新增 `tools/serve.mjs`：Node.js 本機靜態預覽，僅綁 127.0.0.1:8088，僅服務 Builds/WebGL，拒絕路徑逃逸與非 GET/HEAD。`tools/build.ps1` 已改為只等待 Editor 程序，避免 Windows 等待常駐授權子程序。

## 先前進度與環境紀錄

最新範圍：使用者要求繼續完成 3D 遊戲，真正遊戲部署後更新 Docker，並提供無經驗朋友可使用的 AI 接手文件。session 與 AI 仍留給後端。成功建置、實測後才替換 /play/ 空白入口。

## 本輪進度（原始碼已寫，Unity 尚未編譯）

- 虛構「消失的平板」：開庭、查看證物 A、詢問證人、回法官處作答、答錯提示、完成及重玩。
- 修正場景驗證誤報 UI 可選欄位；補齊 InputLegacy／TextRendering 模組；WebGL 點擊鎖定滑鼠，Esc 只解鎖。
- 加入 CourtSmokeTests：選項邊界、回呼一次、答錯／完成／重玩；尚未在 Unity 執行。
- WebGL 中文載入模板：進度、錯誤、返回學堂、鍵鼠限制。尚未部署。
- tools/build.ps1：建立缺少場景、流程測試、WebGL build；不覆寫已有場景。
- START-HERE.md 與「給朋友的AI.txt」：新手操作、檔案用途、部署後 Docker 更新、安全邊界。

已通過：模板 JavaScript 語法、manifest.json 解析、build.ps1 PowerShell 語法、git diff --check。這不等於 Unity 編譯或遊玩驗證。

## 最新環境更新：Editor 已安裝，需啟用 Unity 帳號授權

使用者回覆「允許」後，直接啟動已驗證的官方安裝檔，經正常 Windows UAC 安裝成功，結束碼 0。Unity CLI editors -i 已列出 6000.3.24f1，路徑為 `C:\Users\user\Documents\Codex\2026-09-01\new-chat\tools\UnityEditors\6000.3.24f1\Editor\Unity.exe`。

首次實際 batch 啟動專案結束碼 **198**，`Logs/create-scene.log` 明確顯示 `No valid Unity Editor license found. Please activate your license.` 尚未進入 C# 編譯，Courtroom.unity 未生成。需要使用者在 Unity Hub 登入自己的帳號、確認免費資格並啟用 Personal 授權；不要選付費方案或把帳密交給 AI。

Unity CLI 的模組清單為空，故改從官方版本頁提供的 Windows Web Build Support 下載連結下載相同版本模組；約 886.7 MiB，尚未下載／安裝完成。目標檔案在工作區 `tools/UnitySetup-WebGL-Support-for-Editor-6000.3.24f1.exe`。接手前先確認下載是否完成及數位簽章有效，不能執行不完整安裝檔。Editor 安裝成功不代表 WebGL 支援已就緒。

線上 /play/ 與 Docker 仍是原空白入口。啟用授權及裝好模組後才可繼續 build.ps1、實測、部署和重建 Docker。

## 先前安裝問題（已由直接執行官方安裝檔解決）

UnitySetup64-6000.3.24f1.exe 已下載（4,127,507,400 bytes）；數位簽章 Valid，Unity Technologies SF。首次 Program Files 安裝失敗；官方 --no-elevate 模式回 ELEVATION_REQUIRED。改用可寫入目錄仍回報：`The Windows elevation prompt was cancelled or timed out.` 未繞過授權或改安全設定。

下載檔：`C:\Users\user\AppData\Local\Packages\UnityTechnologies.UnityCLI_2vrhnee42bhxm\LocalCache\Roaming\UnityHub\downloads\UnitySetup64-6000.3.24f1.exe`。Unity CLI 安裝目錄已設為 `C:\Users\user\Documents\Codex\2026-09-01\new-chat\tools\UnityEditors`，此工具目錄不提交 Git。

需要使用者允許官方安裝程式的 Windows 管理員提示，安裝 Editor 6000.3.24f1 與 Web Build Support，在 Hub 登入並確認資格、啟用免費授權。license status 為 LICENSING_CLIENT_UNAVAILABLE，editors -i 仍無 Editor。

Courtroom.unity 尚未生成，無新 WebGL 成品、無新遊戲上線、無新版遊戲 Docker。安裝後繼續：build.ps1 → HANDOFF 實測 → 發布 play/ → 線上驗證 → 重建並測 Docker → 更新本檔。

## 先前已完成：空白入口與其容器

本次優先保留並推送簡單版原始碼，避免進度遺失。這不是已完成遊戲。

已建立：分檔 C# 第一人稱控制、Raycast／E 互動、提示 UI、NPC、證物、開庭按鈕與高亮、1–4 選項，以及 Editor 場景產生器；Dockerfile、Compose、Nginx 設定與後端 session 交接說明。

已查證：Git 和 winget 可用；Visual Studio 2022 Build Tools 已有；Unity Hub 3.21.3 已由 winget 安裝為 MSIX。未找到 Unity Editor、.NET SDK、Docker CLI。

已部署：https://1ch666.github.io/eduai/play/ 。主網站模擬法庭的「開始遊玩」已透過瀏覽器實際點擊，能開啟此空白入口，並明示「3D 場景製作中」。

Docker 已建置並測試成功：GitHub Actions https://github.com/1ch666/eduai/actions/runs/35588646331 ，來源 commit 09d6d65。驗證包含 Nginx 設定、HTTP 200／healthz、HTML 與 play/index.html 一致、/api/ 回 501、未知路徑 404、非 root 與唯讀檔案系統。輸出 artifact `eduai-court-docker` 內含 `eduai-court-preview.tar.gz` 及 SHA256SUMS；保存 1 天，可重新執行手動工作流程。這是空白入口的 Linux amd64 映像，不是 Unity 遊戲。

交由朋友後續完成／尚未驗證：Unity 編譯、Courtroom.unity 實際產生、Editor Play、WebGL build 與遊戲操作。不能直接拿 C# 啟動遊戲。

字型：已補入下載完成的 Assets/UI/NotoSansCJKtc-Regular.otf（16,435,884 bytes）與 Noto-LICENSE.txt。SHA256：dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4。來源為 notofonts/noto-cjk；尚需 Unity 匯入驗證。

接手：閱讀 AGENTS.md；CONTINUE.md 有可直接貼給 AI 的指令。後續以倉庫 court-game 為主要工作目錄，不要回頭拿外部 EduAI-Court 副本覆蓋較新的註解。

朋友接手下一步：安裝 Unity 6000.3.24f1 及 Web／Windows 支援，登入啟用符合資格的免費授權，開啟專案後執行 EduAI/Create Courtroom Prototype。完成 HANDOFF.md 遊戲驗收後，以真實 WebGL 取代空白入口並重建遊戲版 Docker image。Session、AI 串接留給後端人員。

無前端金鑰，無新付費服務；網站僅加入遊玩入口，未改動既有 API。使用者表示 GitHub 權限已自行交接，本次未新增其他平台共享權限。
