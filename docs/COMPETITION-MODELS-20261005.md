# 比賽版模型來源與 Live AI 驗收 — 2026-10-05

## 來源界線

使用者通知比賽不得使用中國模型。正式規則原文尚待提供，不能自行宣稱主辦方已認可。
本次按模型發布者篩選，包含隱藏於 RAG 的 embedding；不是只看代管公司的所在地。

- 文字生成／NPC／案件：OpenAI `gpt-oss:20b`，經現有 Ollama 服務。未改 Secret 或模型帳號。
- 法律向量：Google `@cf/google/embeddinggemma-300m`，Cloudflare Workers AI。
- 舊 BAAI/BGE 與 Qwen 離線測試不再執行；歷史研究結果保留，不能冒充新模型測試結果。
- 辭典是教育部資料的精確詞目檢索，不是另一個生成模型。
- 照片功能目前沒有真正的 Vision/OCR 模型；語音使用瀏覽器服務，不宣稱已查核其內部模型來源。
- 如果比賽還要求訓練資料來源、第三方語音服務、衍生模型等條件，需另依正式規則核對。

官方來源：
- https://developers.openai.com/api/docs/models/gpt-oss-20b
- https://developers.cloudflare.com/workers-ai/models/embeddinggemma-300m/
- https://ai.google.dev/gemma/docs/embeddinggemma/model_card
- https://ai.google.dev/gemma/docs/embeddinggemma/inference-embeddinggemma-with-sentence-transformers

## 索引與重建

新索引 `eduai2-law-google-mrl256`，cosine，256 維。
Google 原始輸出 768 維，依官方 MRL 方法取前 256 維後 L2 正規化。
查詢與資料匯入共用 `src/legal-embedding.ts`，不同的 query/document 前綴不可混用。
舊 BGE 向量不能搬入新索引；本次全部重新生成，不以換名字假裝模型已替換。

語料版本 `law-0b85a6d187c7b6dc`（雜湊包含 embedding 版本）。
仍是八部法規、3,635 筆條文／長條文片段，來源快照 2026-09-01，非全部現行法。
新向量 930,560 維；舊索引 3,722,240 維，合計 4,652,800 維。
保留舊索引但正式程式不綁定、不查詢；沒有永久刪除使用者資料。
Free 配額按全帳號合計；未升級、不得超額後自動購買。

重建順序：
1. 確認 Workers Free 與帳號所有索引／AI 用量。
2. `node scripts/prepare-legal-rag.mjs` → `outputs/legal-rag-google/`。
3. 新環境才建立 `eduai2-law-google-mrl256`，256 維 cosine。
4. `node scripts/embed-legal-rag.mjs --confirm-free-plan --wrangler --batch=0 --through=15`。
   其後依序 16–31、32–47、48–63、64–79、80–95、96–111、112–113；失敗即停，不自動重試。
5. `node scripts/import-legal-rag.mjs --confirm-free-plan`。
6. 等全部筆數完成後跑 `node scripts/check-legal-rag-live.mjs --confirm-free-plan`。
7. 只從乾淨提交建置、部署 Worker；新環境匯入未完成不得啟用 RAG。

`scripts/wrangler.legal-admin.jsonc` 是本機行政代理，不可部署成公開匯入 API。
任何回滾不能重新啟用不符合本次要求的 BGE：必要時停用 RAG，保留 gpt-oss 文字服務。
0.45 門檻與三題檢查只是冒煙測試，不是召回率或法律正確率保證。
256 維與長文截斷對檢索品質的影響仍需擴充測試。

## 驗收紀錄

本機完整回歸：578 tests，578 pass，0 fail；包括現有工作區協作者的測試。
乾淨發布副本 `753c6cc`：571 tests，571 pass，0 fail；型別、前端檢查、WebGL 建置完整性與 Wrangler dry-run 通過。不同測試數量來自未納入發布的協作者修改，不是漏報失敗。

正式部署：2026-10-05，Worker version `1d65f3d9-e4b9-497a-9a2b-6825164a8baf`。
正式網址：https://civic-law-lab-212.yichengc869.workers.dev/
新索引實際 describe：256 維、3,635 筆，全部處理完成。
三題真實 Google embedding / Vectorize 檢索均取得預期第一筆：
- 成年年齡 → 民法第12條，score 0.6140031。
- 正常工時 → 勞動基準法第30條，score 0.6932189。
- 竊盜構成 → 中華民國刑法第320條，score 0.68255454。

## 正式 Live AI 流程（非 mock）

2026-10-05 08:55–08:59 臺北時間，在既有已登入帳號測試；未重新測試密碼登入或手機真機。
案件：固定教學範本「平板失蹤：十七分鐘的落差」，法官視角。
流程：建立雲端場次 → Unity 3D 載入100%並開始 → 自由詢問證人 → 確認程序 → 陳述 → 取得走廊影像 → 聽取三角色原始陳述 → 出示影像給證人 → 伺服器解鎖時間矛盾 → AI追問 → 准駁程序 → 最終判讀 → 結案 → 唯讀庭後分析。
最終版本14；六項目標全部完成，證物查看率100%、角色原始陳述詢問率100%、矛盾1項、程序完成度100%、提示0次。
這些數字只是本次代理操作的功能驗收結果，絕非教育成效或正式使用者研究。

正式 Worker tail 的 `ai.provider.completed`：
- 08:55:56，自由提問：provider ollama、model gpt-oss:20b、outcome success、provider latency 1336ms；trace `0d493c800de44caf960971b449a65549`。
- 08:57:21，矛盾追問：同模型、success、1641ms；trace `172cacb8e0694a79aea49409c08e8b3b`。
- 08:58:55，首頁助教詢問成年年齡：同模型、success、1920ms；trace `4f765e4ca8b84834818bc845cf8de53f`；畫面顯示18歲、民法第12條與檢索來源。
上述 latency 是模型呼叫時間，不是整個頁面的載入時間。原始陳述及矛盾解釋是預先建模資料，不冒充 AI 生成。

## 未通過與後續事項

1. **全新 AI 案件生成這次未通過驗收**。08:51:32的嘗試改成題庫；以 Cloudflare Data Studio 唯讀查詢確認 `generation_attempts.error = SKIP:BUDGET`。
   `src/court.ts` 的生成另有「每帳號滾動24小時10次非SKIP嘗試」限制；它不同於 `AIAdmission` 的全站/使用者額度。查詢當時正好10次，下一個自然可用名額約為2026-10-05 16:49:45臺北時間（若無其他使用者操作；不保證上游額度）。
   沒有清空紀錄、改帳號繞過、放寬限額或假造AI案件。本次證明的是固定案件搭配真AI NPC完整流程，不是全新AI案件完整流程。
2. NPC自由提問及追問雖成功，部分語句仍生硬：原始陳述尚未解鎖前無法回答離場時間，追問也採保守語句，不能把「模型HTTP成功」等同內容品質滿分。
3. 首頁助教的參考法規段落重複出現（模型與伺服器各附一次），不影響本次檢索成功；後續可改善顯示去重。
4. README 有協作者未提交修改，本次未覆盖或一併提交；其中舊BGE說明應由協作者合併時改成此文件所述Google模型。
5. 比賽規則原文、瀏覽器語音服務模型來源仍待確認。此次按公開模型發布者替換，不宣稱全部第三方服務或訓練資料已獲主辦認證。

沒有修改帳號、Session、Secrets、付款方案、資料庫schema或刪除正式資料。新增兩個測試場次（題庫降級一個、完整教學一個）留在帳號中供查看，未永久刪除。
