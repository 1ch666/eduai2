# 法律 RAG、串流與防刷（2026-10-04）

> 2026-10-05 比賽模型來源調整：本頁以下 BGE、1024 維及舊部署驗收是歷史紀錄，
> 不代表目前比賽版使用的模型。新設定、管理腳本與驗收以
> `docs/COMPETITION-MODELS-20261005.md` 為準；不要依本頁舊命令重新啟用 BGE。

## 狀態與範圍

本輪使用者新指示授權這三項必要後端工作；不恢復整份 Backend Audit，也不新增資料庫 migration。
程式已接入公民助教 `/api/ai/ask`，保留原 JSON 用法；`stream:true` 且 civics 模式才回 NDJSON。
Unity／NPC 結構化對話不串流，不修改角色 Knowledge Projection。
Cloudflare 管理台已確認 Workers Free / Current plan；沒有升級或購買額度。
使用既有 Wrangler 登入與本機 binding proxy，完成真實 bge-m3 embedding 與 Vectorize 匯入。
索引 `eduai2-law-bge-m3`（1024維、cosine）已確認 vectorCount=3635；
processedUpToMutation=02560940-cc76-4153-867a-3af7ab09f853。
三個中文問題分別以第一名命中民法第12條、勞基法第30條、刑法第320條。
這是冒煙檢索檢查，不是完整召回率評測。匯入尚在非同步處理時曾看到部分結果及500，
確認完整筆數後三題檢查通過，故驗收腳本現在要求完整索引才開始查詢。
正式 Worker 已啟用 `LEGAL_RAG_ENABLED=true` 及上述版本，真實助教回答與來源已驗收。
新環境部署前須建立並匯入同名索引；未匯入的環境必須設false，不要直接照搬true。

## 法規資料

`node scripts/prepare-legal-rag.mjs` 只讀現有 law-data 快照，輸出 outputs/legal-rag。
包含憲法、民法、刑法、刑事訴訟法、民事訴訟法、少年事件處理法、消費者保護法、勞動基準法。
排除快照標示已廢止的法律與純刪除條文；一條文一筆，超過 1,800 字優先按段落分段，
極長單段才切片，保留法規、條號及 part。片段不代表完整條文，不跨條合併。
保留官方 law.moj.gov.tw 連結、原文、快照時間、原資料修正日；修正日不是施行日。
尚未逐條核對施行日期與沿革，不宣稱全部為現行適用法，不能用於個案法律意見。

目前離線結果：3,635 筆 × 1,024 維 = 3,722,240 stored dimensions；
版本 `law-34ca5304c03c655b`，來源快照 2026-09-01。不是全臺法規的完整向量庫。
語料與向量不提交 Git；可從已追蹤快照及腳本重建，管理者應保存核准發布版本。
教育部辭典維持精確詞目查詢，沒有偷偷轉成法律權威或大量塞入同一索引。

## 管理者重建流程（本次匯入已完成，不要重複執行）

1. 在 Cloudflare 確認為 Workers Free 且有足夠剩餘額度，包括帳號其他索引／AI 工作。
   不升級方案。Vectorize Free 現列每月 30M queried dimensions、5M stored dimensions；
   Workers AI 另有額度，不可把向量容量當作 embedding 免費保證。
2. 執行離線整理並審核 outputs/legal-rag/manifest.json。法規更新需產生新 corpus namespace。
3. 新帳號／新環境才需使用既有授權 Wrangler 建立（本帳號已完成此步）：

   ```bash
   npx wrangler vectorize create eduai2-law-bge-m3 --dimensions=1024 --metric=cosine
   ```

4. 優先沿用既有 Wrangler 登入，使用隔離的本機管理 binding proxy，沒有公開匯入接口，
   不綁定帳號／場次資料庫。`scripts/wrangler.legal-admin.jsonc` 僅供本機工具，禁止部署。
   或以安全環境變數提供 CLOUDFLARE_ACCOUNT_ID／CLOUDFLARE_API_TOKEN；不得貼在聊天、
   命令參數、版本庫或截圖。限管理者在本機執行：

   ```bash
   node scripts/embed-legal-rag.mjs --confirm-free-plan --wrangler --batch=0
   # 檢查成功及免費方案後，可明確指定範圍，每次最多16批：
   node scripts/embed-legal-rag.mjs --confirm-free-plan --wrangler --batch=1 --through=16
   # 全部批次完成後，先驗證ID、metadata與維度才批次upsert：
   node scripts/import-legal-rag.mjs --confirm-free-plan
   node scripts/check-legal-rag-live.mjs --confirm-free-plan
   ```

   每批最多32筆，一次呼叫，不自動重試；單次命令可指定最多16批，失敗即停。
   共114批（0–113）。既有批次輸出拒絕覆寫，但遠端成功、本機寫檔前中斷仍可能
   造成重跑重複計費；遇不明結果先查帳號用量，不盲目重試。
5. 等索引非同步匯入完成，核對維度、全部筆數、namespace與多組中文檢索結果。
   尚未做正式召回率評測；0.45分數門檻是初始值，不是法律正確率。
6. 將 LEGAL_CORPUS_VERSION 設為核准語料版本，確認額度後才設 LEGAL_RAG_ENABLED=true。
   同步部署 Worker 與首頁。不要變更帳號／DO／Secret 所有權。
7. 正式驗收：法規問答有來源、無命中明示、索引故障不假裝查證、串流取消／中斷、
   重送去重、429，以及中文模型檢索與回答是否一致。停用可把旗標改回false，
   不必刪資料或重設 migration。旧namespace佔容量，清除需另外確認，不能自動永久刪除。

## Runtime 與安全界線

- 身分／來源與既有 MessageRoom 限流先執行，再作 study request reservation，然後才 embedding。
  同 requestId 不會重新 embedding 或推論。現有 AI admission 仍包住文字模型。
- 檢索僅 topK=4、固定模型 bge-m3／1024維、固定版本namespace；不能由用戶選index或URL。
  只接受官方法規URL及有界 metadata；法規上下文當資料，不當系統指令。
- RAG 逾時8秒後明示無檢索依据；binding呼叫可能仍在遠端完成，逾時不等於退款。
  不自動重試。索引未啟用、無命中、故障分別標記，引用由伺服器回傳，不信任模型自造連結。
- 僅公開法規進索引。問題送至 Workers AI 做 embedding，送出前前端需告知服務用途；
  不保存問題到向量庫。私人案件事實、最終答案、帳號與NPC對話不進索引。
- NDJSON事件為 meta、delta、done、error；delta只是暫時文字，只有done才算完整回答。
  不向前端傳出thinking或provider原始錯誤。前端用文字渲染，失敗回答不放入後續history。
- 串流有回壓、取消、50秒provider時限、262144 bytes上游封包上限、5000字答案上限。
  普通JSON保留原64KiB上限。已取得的部分回覆不會在串流失敗後自動重試付出第二次額度。
- 原限流：每分钟client4次、network12次、登入user8次，任一桶滿回429及Retry-After:60。
  clientId不是可信身分；network與登入桶仍限制換ID。共用網路可能共同受限。
  尚不是WAF/DDoS方案；禁止把目前限流說成絕對防刷或付費帳號零超支保證。

## 本機驗證與未完成驗收

已通過：TypeScript、前端檢查、4項RAG合成測試、3項串流解碼測試、7項provider測試、
12項既有admission測試、7項助教HTTP整合測試（含串流／429）、5項tracing測試；
Wrangler deploy --dry-run 通過。語料 metadata 最大3333 bytes，未超過10KiB。
上述單元測試使用mock；另已完成3,635筆真實embedding／匯入及三題中文檢索檢查。
乾淨發布副本完整 `scripts/ci-fast.mjs`：565 tests / 565 pass / 0 fail，
另包含型別、前端與既有WebGL大小預算檢查；沒有重新編譯或修改Unity。
待完成：正式站手動中斷串流驗收、更廣泛檢索品質評測；不以mock取代這兩項。

## 正式發布與驗收紀錄（2026-10-04）

- Runtime source commit：7903b73（含1a35f14）。只從此提交的乾淨副本建置，
  原工作區的groups改動、provider手動註解、README其他段落均未混入提交／部署。
  `redirect:'manual'` 已在基底提交內，發布版本保留，沒有回退連線修正。
- Worker version：40ca3214-a825-4dc4-af49-1d3b9f2ddc72。
  正式網址：https://civic-law-lab-212.yichengc869.workers.dev/
- 使用 `wrangler deploy --keep-vars`；既有Secret、DO與排程保留，沒有新增migration，
  沒有更換owner/account或付費方案。只有index.html靜態資源需重新上傳。
- 已登入瀏覽器實測工時提問：Ollama完成回答，顯示勞基法30、30-1、32、36條來源，
  附官方連結與2026-09-01快照。證據圖保留於本機outputs/rag-live-20261004.jpg。
- 另以無登入憑證的正式HTTP測試提出成年年齡問題，回200 application/x-ndjson；
  觀察60個delta事件、60個網路讀取封包，首個delta約1,863ms、完成約2,621ms。
  這是單次測量，不是效能承諾。終端done帶matched與民法第12條來源。
- 同一測試client接續三次辭典查詢均200／MOE dictionary（無模型推論），
  第五次總請求回429、RATE_LIMITED、Retry-After:60。沒有用大量壓測刷額度。
- RAG不是法律正確性保證；模型生活例子仍可能過度簡化。未命中／索引故障時會明示，
  不把向量相似度當法律判斷；法條施行日期與修法沿革仍須由官方來源核對。
- 回滾：可回到部署前Worker版本686c5083-fd35-4d17-a4dd-fa86f6c2c555，或停用RAG旗標。
  不需刪索引、帳號、場次或reset migration；操作前由管理者核對最新部署。

官方參考（2026-10-04查核）：
- https://developers.cloudflare.com/vectorize/platform/pricing/
- https://developers.cloudflare.com/vectorize/reference/client-api/
- https://developers.cloudflare.com/workers-ai/models/bge-m3/
- https://docs.ollama.com/api/streaming
