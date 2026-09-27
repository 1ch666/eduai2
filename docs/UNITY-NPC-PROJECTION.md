# Unity 公開 NPC 投影接線（2026-09-27）

## 最新發布（優先於下方當時建置紀錄）

來源 `b795d7b29088d64cc06635846ed323ce6ada1e9e` 已推送 main 並發布既有 Worker：`fb5f45a5-c47b-44b9-b0d4-b9f9de590772`。網址 https://civic-law-lab-212.yichengc869.workers.dev 。相較前一批 `54e4cd9` 無 src 或 wrangler.jsonc 差異；使用 keep-vars 與 strict，未改 Secret、權限、付費方案或新增 migration。前批可回復版本為 `d5023659-5885-419f-be86-a99c749af09a`，本輪中間版本 `9c1d8676-d938-447d-be0c-850ce410911e` 已被修正版取代，不建議使用。

發布後發現初次同步只替換 data/wasm，loader 中 wasmFileSize 仍是舊值 18,600,979。修正版同步完整四個建置檔，逐位元組等於隔離副本輸出；新 loader 宣告 18,604,392，與解壓 WASM 完全相符。framework 解壓後內容與舊版相同，壓縮封裝位元組不同。`check-build.mjs` 新增大小配對斷言：舊 loader 實際失敗，完整同步後通過；另 11 項模板與觸控測試通過。此檢查只能捕捉大小不符，不可取代完整檔案雜湊校驗。

正式 Worker 的 HTML、data、wasm 已 HTTP 200 且與本機完全一致；最終 loader/framework 亦 HTTP 200、雜湊完全一致。新 loader SHA-256 `482505d6e2e918cf8421003c4f99c3ce9678bb8deffb2547e200804f68e0e0f2`，framework `4743624f37fb6b990982bb7cb9e77f6820093dedb4e7facb5706835e03864863`。這是唯讀成品檢查，不代表正式登入、AI 或手機完整驗收。

GitHub Pages 的 `5610c62` 發布工作 `36325998369` 已成功；其四項 Build 資源與當時提交相符，HTML 只差 CRLF/LF（正規化後一致）。loader 修正版 Pages `36326307030` 及 Docker `36326330321` 均已 success，來源同為 `b795d7b`。Docker 執行實際 build/run、48 項測試、成品格式／loader 大小驗證、HTTP 位元組比對、非 root／唯讀與 API 501 檢查。容器只提供靜態遊戲，沒有正式帳號、資料庫或 AI。Docker `36326152464` 雖成功但來源仍是初次同步，不能當作修正版。

## 原始碼實作範圍

修正版 Pages 的 loader/framework 已額外取得 HTTP 200 並與本機逐位元組一致。Docker 產物已下載至工作區外層 `outputs/docker-npc-projection-b795d7b/`；`sha256sum -c SHA256SUMS` 六項通過，SOURCE_COMMIT 為 b795d7b29088d64cc06635846ed323ce6ada1e9e。映像封裝 SHA-256：`e1544f6a61e6824b1fd9a0dde751bcb4a1a5346ab62562aa9539d5dfefd7e5a0`。GitHub artifact 保留一天，本機副本可供接手。

`CourtRuntimeState` 在嚴格快照解析及 reducer 接受後，將最新公開 NPC 投影套到名稱對應的既有角色。舊快照只保留目前 store，不以舊 visible 值重啟角色；未同步、清除場次或同步失效時停止 NPC 互動。

`NPCInteractable` 只保存顯示名稱、互動旗標與原 Renderer enabled 狀態，不另存案件 facts、私有資訊或可修改的快照。角色不在公開名單或 visible=false 時隱藏 Renderer；可見且 interactable 且 requestState 非 pending 時才允許互動。原本停用的 primitive Renderer 不因恢復而被重新啟用。保留物理 Collider 的遮擋，不讓隱藏角色變成穿透互動入口。

桌面射線與手機點擊共用 `PlayerInteractor.AllowedInCurrentMode`；直接呼叫 NPC.Interact 或對話 Open 也檢查同一旗標。已開啟的角色若被撤銷互動資格，`CloseFor` 關閉其對話；其他角色／證物面板不被任意關閉。既有關閉邏輯取消 UI ticket、恢復輸入與鏡頭；未在此處加入 HTTP、CSRF、金鑰或程序判定。

首次進入 hosted 視角先關閉場景預設 NPC，等待真實公開快照；guest 固定練習原有角色、對話與調查繼續保留。

## 實際驗證

官方 Unity 6000.6.2f1、既有隔離副本 `outputs/npc-unity62-check`，真實編譯與 Play 測試結束碼 0。日誌 `outputs/npc-public-projection-play.log` 同時包含 `COURT_SCENE_VALIDATION_PASSED` 及 `COURT_PLAY_TESTS_PASSED`。

新增 `CourtPlayTests.TestPublicActors` 覆蓋：未同步拒絕、公開角色啟用、未列角色停用、可見 NPC 開啟對話、撤銷關閉對話／隱藏所有 Renderer、舊快照不能恢復角色、新快照恢復模型與名稱、同步失效停止互動、同一有效快照恢復可用、清除場次停用。原有 guest、碰撞、觸控、證物、鏡頭與法庭盒測試同次執行通過。

日誌仍有既知 `UnityEditor.Search.SearchDatabase` 的 ArgumentOutOfRangeException；不是本批測試斷言失敗，也不能稱 Editor 零例外。

## 建置與待完成

Release WebGL 已在同一隔離副本成功建置，日誌 `outputs/npc-public-projection-build.log` 顯示 PlayerBuildInfo success=true、批次 return code 0。成品已同步 `play/Build/`；本批尚未確認正式 Worker／Pages 發布，Docker 也尚未重建，勿沿用前批發布紀錄宣稱完成。

實際 `check-build.mjs` 通過 Gzip 解壓、Unity data header 與 WASM magic 檢查。下載 bytes：data 15,289,841、wasm 5,848,923、framework 83,191、loader 48,540；四項合計 21,270,495，另 touch 5,172，總計 21,275,667。比前一版同口徑 21,274,242 增加 1,425 bytes。這不是首載時間測量，不能宣稱加速。

SHA-256：data `6ac65e1429568112525140510d965322f037a497aa80d0531c2dfb9623f8eb42`；wasm `23246adca56ed71f8db23e69f206c4cd45bfd2717c9fc0d03739619db61996ca`。模板 index.html 與上一版雜湊一致。

本機真實瀏覽器（Codex 內嵌 Chromium，127.0.0.1:8792）恢復既有民事法官測試場次：自動初始化到 100%、開始遊戲、座位切走動、Pointer Lock fallback、W 前進、E 開啟原告 NPC、恢復上次對話、中文輸入及送出均實測。玩家法官未重複顯示 NPC；原告標題使用伺服器公開名稱。請求走 v1 actions，workerd 記錄一次 POST 200，場次由版本 3 變 4，對話保持開啟並重新可輸入。測試明確關閉 AI，上畫面顯示 AI_DISABLED／未新增角色證詞，不代表真實模型成功。截圖保存於工作區外層 `outputs/npc-public-projection-webgl.png`。

同批重跑模板、觸控、法庭面板、protocol、transport、NPC action、pending recovery 及 recovery UI 共 48 項 Node 測試，48/48 通過。瀏覽器驗證未涵蓋實際網路中斷時角色隱藏／恢復、所有角色、手機或 Chrome／Edge 獨立瀏覽器。

這不是完整 NPC presenter 完成：seatId 的實體座位綁定、姿態／情緒動畫、speakingState 表現、完整角色私有資料隔離仍待後續。只支援現有場景的固定 NPC ID，未知伺服器角色不會自動生成模型；不得用這批顯示閘門代替伺服器資訊隔離。手機真機、WebGL 斷線時角色隱藏／恢復、全角色流程仍未驗收。
