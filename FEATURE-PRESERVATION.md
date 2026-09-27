# Feature Preservation Matrix — 2026-09-28

最新發布：50efc03 / Worker 6aff28bc-e363-4649-abe3-f09943dc62c4，325 項快速測試及 CI 36351960047 通過。新增 /api/v2/court 場次快照、動作、結果恢復的統一 HTTP 外層，內層沿用明確 v1 DTO 與命令；實際 workerd 驗證 v1/v2 並行同一請求只產生一次動作及事件。舊網頁／Unity／API 不變、無 DB 遷移。正式匿名 v2 401、未知 404、舊 cases 200，追蹤標頭相符；登入後正式場次尚未驗收。詳見 docs/COURT-API-V2.md。

最新發布：57bb10e / Worker 202fca8f-8a8c-4597-b87d-c06f6826a7e4；完整快速 CI、53 項聚焦測試與遠端 CI 36351501427 通過。新增檢索／重排／驗證追蹤介面，實際接線僅程序對話格式驗證；不改接受條件、案件權威、快取或逾時防護。正式 capabilities/cases 200、匿名 sessions 401，不代表模型或 RAG 已驗收。無資料庫／Secrets／Unity 變更；詳见 docs/PROVIDER-TRACING.md。下方為歷史紀錄。

最新發布：bb9ffb9 / Worker e45edfca-e4e4-4817-a789-5878d79e12c8；318 項本機快速測試及 CI 36351089548 通過。HTTP 識別明確傳給助教、照片文字講解、CourtRoom／Learner 與模型封裝；不改公開回覆、狀態權威、重送保護或資料庫。日誌失敗不重試推論，模型用量只記內層一次；不記提問、答案、帳號或 Secret。無前端／Unity／正式遷移變更，詳見 docs/PROVIDER-TRACING.md。下方為歷史紀錄；完整 pipeline tracing 仍未完成。

最新發布：1273f5c / Worker a289aebd-00e1-4c91-9e8f-d20c5970f3bc。程序對話保存來源契約，舊資料不回填；並行、逾時、重啟、刪除與晚到回覆測試保留。311 項快速測試與 CI 36350179869（含實際 HTTP／workerd）通過。正式公開狀態 200、匿名場次與程序對話 401；未實測正式模型回答。無正式遷移／Secrets／Unity 變更。下方為歷史發布，詳細證據見 docs/AI-OUTCOME.md。

本輪發布：78cd1e2 / Worker 545772b3-e72f-41e6-afe2-a19526e59693，CI 36349627787 通過。助教／照片文字講解／新 legacy NPC 回覆新增 aiOutcome v1，保留原 answer、explanation、mode、錯誤碼與 HTTP 狀態。舊 NPC JSON 不回填、不清除；v1 NPC 公開投影尚待接入。辭典是 NO_AI/dictionary，不假稱 RAG。310 項快速測試及乾跑通過；正式 tutor 無效請求 400、匿名 photo 401 均附 NO_AI，三個狀態 GET 200。不代表真實模型或登入 NPC 已驗收。詳見 docs/AI-OUTCOME.md；不修改 Unity、前端或既有帳號資料。下方版本為歷史發布。

目前最新發布：9353127 / Worker 0a3e5819-3c92-4358-b2d3-642353321633；CI 36348872114 通過，本機 307 項測試通過。三個 AI 狀態端點改讀實際共用額度管控，維持既有欄位並附版本化 availability，不因只有金鑰就認定可用；READY 僅為帳戶層允許嘗試，providerHealth 明示 not-probed。正式三端點 200、匿名場次 401，未呼叫模型。無新遷移／靜態資源／Secrets；詳見 docs/AI-AVAILABILITY.md。下方為歷史發布。

目前發布：0e7ad2c / Worker d4bd7403-7914-469c-91d2-3c14a9955098；CI 36348143950 的 checks/local-api 通過，298 項本機快速測試、真實 workerd 預約 RPC、部署乾跑皆通過。公民助教與照片文字講解加入共同模型額度管控、每使用者持久化去重；保留原成功格式、字典、登入／CSRF／限流，不保存完整問答。重送現在明示 409，不會再次消耗模型；舊 UUID 紀錄上限 4,096，達限回 503，仍須新版可過期 ticket 才能安全清理。詳見 docs/STUDY-AI-ADMISSION.md。公開狀態 200、匿名私人端點 401 不等於正式 AI 已實測。未改 Unity／靜態資源／Secrets／README。下列較早版本為歷史記錄，不是最新部署。

最新發布：8945286 程序對話持久化去重已部署為 e37d0a79-a856-4378-a40c-bb1ac466e2d4；CI 36343636660 fast/local-api 通過。保留既有台詞格式、登入／CSRF／限流與備援；新增相容資料表，不搬移舊資料。42 項聚焦、243 項快速測試通過；正式公開端點 200、匿名場次與對話 401，未呼叫正式模型。詳見 docs/STAGE-DIALOGUE-DEDUP.md。沒有修改 Unity 或使用者既有 README。以下為歷史發布紀錄。

最新發布：72097b6 照片文字講解介面已部署為 84455261-9668-49a6-a963-331457defd3f，CI 36342849873 成功。維持文字講解（不是 OCR/Vision）、登入與限流，統一受限回應讀取及取消。photo/status 200 且 ocrAvailable:false，匿名 photo/explain 401；未呼叫正式模型。無資料遷移或靜態遊戲變動。以下發布記錄是歷史證據。

最新發布：29e94c0 程序對話供應商介面已部署為 83550073-3205-4cbd-9f57-c2327a313278，CI 36342509102 成功。保留原台詞備援與版本檢查，沒有靜態遊戲成品變更。公開 capabilities/cases 200、匿名 sessions 401；未呼叫正式模型。照片講解仍有直接 vendor 呼叫，供應商解耦尚未全部完成；詳見 docs/PROVIDER-CONTRACT.md。

最新發布：950f04e 案件生成供應商介面已部署為 9084a8ca-bd34-4e07-a115-ff5ea7c36031；CI 36342149022 fast/local-api 通過。保留提示詞、參數、案件驗證、題庫備援與資料格式；capabilities/cases 200、匿名 sessions 401。無正式模型呼叫、資料變更或 Unity 重建；詳見 docs/PROVIDER-CONTRACT.md。下方版本號為歷史證據。

最新發布：d529d07 確定性法庭核心已部署為 8681a49b-afb9-4234-8aaa-a68ee1f622db；CI 36341479597 成功。保留原 API，核心明確接收伺服器時間，隨機序列測試比對完整狀態；詳見 docs/COURT-DETERMINISM.md。未修改前端／Unity／正式資料；以下舊版發布記錄為歷史證據。

最新後端增量：ab035b7 已部署為 984670ba-6025-4df7-9734-45dcffc46f0e；CI 36341128195 fast/local-api 通過。CourtRoom 可選私有引用圖在寫入前綁定範本並驗證，與事件原子儲存；舊場次／公開 API 不變，未啟用模型產生引用圖。詳見 docs/CASE-GRAPH-CONTRACT.md。以下較早版本號為歷史證據，不能取代本段部署現況。

此表以当前 main 原始碼及已記錄測試為依據。存在程式碼不等於完整驗收；「保留」不表示規格全部完成。任何替換須先補等價測試、相容與回滾方案，禁止清空正式資料。前端／Unity 新能力以原 API 漸進接入，未啟用不相容替代。

| 能力 | 現行主要實作 | 替代／遷移狀態 | 已有測試證據 | 相容性與正式狀態／缺口 |
| --- | --- | --- | --- | --- |
| 帳號 | src/accounts.ts、src/auth.ts、court/index.html | 保留 AccountStore，不更換 owner/database | check-api 註冊、登入、登出、一次性復原競爭、登入與復原競爭、舊 session 撤銷及進度保存 | 86d2cec 的 CI 36339421823 通過；並行 HTTP 不等於所有時序或實機驗證 |
| 驗證／session | src/session.ts、auth-sync.js、src/http.ts | 保留 cookie／CSRF 與同源模式 | check-api、check-auth-sync | 不向 Unity 傳 session；跨裝置實機仍待驗收 |
| 題目練習 | src/practice.ts、src/practice-data.ts、practice/ | 保留伺服器判分、一次性 token；升級確認式 UI | test-practice、test-practice-ui；本機瀏覽器 | 8bd1617 前端已發布；無判分回執重取 API，斷線不盲目重送 |
| 弱點 | Practice.weakness、reinforce 端點 | 保留最近 20 次／至少 5 題與補強入口 | 舊 threshold 測試部分複製邏輯，證據有限 | 不因題數少冒稱成熟分析；需真實 DO 整合測試 |
| 排程／專注 | src/planner.ts、planner/ | 保留 CRUD、focus 與 ICS 前端 | test-planner 部分複製驗證邏輯 | 不等於完整跨日／時區／多裝置防刷驗收 |
| 群組 | src/groups.ts、groups/ | 保留建立、加入、退出、邀請與成員權限 | 尚無全面整合 CI | 正式路由存在；退出後隔離／撤銷碼仍須補實際測試 |
| 排行榜 | src/rankings.ts、rankings/ | 保留既有積分榜，不冒稱新階梯規格已完成 | Practice 初次答題呼叫 rankings；缺完整 CI | 時間榜、百分位段位等新規格不可由現有積分榜替代 |
| 進度匯入／匯出 | src/auth.ts、src/accounts.ts、index.html | 保留來源隔離與 selfReported | test-progress-import、test-progress-isolation、check-api | 匯入不得刷排名；首頁雲端 round-trip 已有本機證據 |
| 法庭 | src/court-rules.ts、src/court.ts、court/、court-game/ | v1 漸進接入，既有 v0 路由保留 | test-court、journal、protocol、check-court-v1-api | 正式 WebGL 存在；完整角色／程序空間／真機仍未完成 |
| NPC | src/court-npc.ts、src/court-cast.ts、court/npc-action.js、Unity NPC/ | 保留角色投影、單次請求與明示 fallback | test-npc、npc-action、check-npc-recovery-api | 真實 AI 品質、語義洩漏不是 mocked provider 測試能證明 |
| Replay | src/court-journal.ts、court/replay*.js、Unity Replay/ | append-only public event + snapshot；舊場次 checkpoint | test-court-replay*、check-court-v1-api | 不改正式案件；舊場次無完整早期事件就明示不完整 |
| AI fallback | src/ai.ts、src/court-npc.ts、src/court-generation.ts、src/providers/ | 保留無 AI 固定內容與案例庫；全部正式 Ollama 入口納入共同預算 | test-tutor、test-generation、npc-recovery、study-attempts、check-admission-runtime | 四級 availability、完整成本記錄與可過期 study ticket 尚未完成；不把模型錯誤偽装成功 |
| 照片／筆記／留言 | src/photo.ts、src/messages.ts、photo/、index.html | 保留現有能力與資料 | check-api 留言 round-trip | 照片不應宣稱已有真正 OCR/Vision；首頁筆記／留言不因重構移除 |
| 通知／音樂 | src/push.ts、sw.js、music-player.js | 保留現行入口，不以重構刪除 | 尚無全面真實 delivery／播放驗收 | Push subscription 不等於已完成 server delivery；需逐項現況查核 |

## 證據與發布邊界

- 快速 CI c42665c/run 36335039738 成功；新增隔離本機 API 的 f923753/run 36335235336 成功，172 項快速測試及三組本機 HTTP 檢查。
- 正式 Worker 最近已驗證版：06bcf6ac-af81-432e-9336-9867c97537ad（來源 e28f5ff，案件流程可達性 gate）；公開 capabilities/cases 200、匿名 sessions 401。遊戲 artifact 仍為 494dddb，不是 CI 每次都重建 Unity。
- 新增純草稿 validator、所有支援角色的完成路徑 gate、並行動作測試及復原競爭測試；詳細範圍見 docs/COURT-DRAFT-VALIDATION.md、COURT-REACHABILITY.md、COURT-CONCURRENCY-TESTS.md、AUTH-RECOVERY-CONCURRENCY.md。
- provider 已有三種介面與 tutor/NPC adapter；研究 metadata 已有 schema/關係檢查，但仍無真正 benchmark/持久化研究紀錄。完整 validator、統一 API 錯誤格式、全管線 provider 解耦、預算治理、可實際復原的備份仍未完成。
- 完整後端驗收追蹤見 docs/BACKEND-GOAL-AUDIT.md；安全風險與證據見 SECURITY-THREAT-MODEL.md。不要由局部 CI 綠燈宣稱整體 10/10。
- 回滾原則：前端／遊戲使用相符版本的原始碼與 artifact；後端資料變更須 additive + dry run + restore 證據後才發布。不能為了回滾刪表或 reset migration。
