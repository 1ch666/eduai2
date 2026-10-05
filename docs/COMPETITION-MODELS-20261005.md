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
正式發布副本與 Live AI 結果完成後另記；目前不可將本機 mock 當成正式模型成功。
