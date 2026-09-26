# 教育部辭典詞條檢索

資料：中華民國教育部（Ministry of Education, R.O.C.）。《重編國語辭典修訂本》（版本編號：2015_20260625）。https://dict.revised.moe.edu.tw/

授權：CC BY-ND 3.0 TW。完整官方使用說明保留在 `moe-revised/official-usage.pdf`，請與資料一起保留、散布。下載來源及原始 ZIP SHA256 見 manifest.json。未下載字圖包；字圖代碼與異體字等原始欄位照原文保留，不猜字、不轉簡體。

## 結構

一個精確詞目一筆 JSON，不依字數切塊。同詞多音合於 readings，保留每列的注音、拼音、完整釋義、Excel 列號與全部原始欄位 raw。詞性只擷取原文 [名] 等標籤；官方沒有獨立例句欄，examples 留空，例句仍在原文 definitions 內。不用 AI 分拆、改寫或補造釋義。

256 個 gzip 檔只是儲存分區，**不是檢索 chunk**；每行 JSON 才是一個完整詞目。SHA256(UTF-8 詞目) 的第一個 byte 定位分區，查詢不下載或掃描整本。原始資料 163,920 列，161,194 個不同詞目。manifest 包含所有分區校驗值。

`src/dictionary.ts` 支援「民主是什麼」「什麼是民主」「民主的意思」「查詞：民主」等明確問法，優先精確詞目，不以釋義中碰巧出現查詢字詞判定命中。沒有命中繼續原對話，不捏造字典來源。

`dictionaryEmbeddingText` 按詞目、各音讀、詞性、原文釋義與例句建立完整單詞條文字。**本批未產生向量、沒有 embedding 模型／向量資料庫、沒有語意近似搜尋**。長詞條不得任意截斷；未來向量模型容不下時，應明確跳過向量處理，仍保留精確查詢。不得自動啟用付費服務。

目前 `/api/ai/ask` 對明確詞義題直接回傳命中條目的完整原文與來源，不讓 LLM 改寫後冒稱教育部原文。不把字典當法律條文、法官判決或證人見聞。RAG 的向量重排及與生成回答整合仍待後續驗證，不宣稱此資料包就能修好自由 NPC 對話。

## 重建及驗證

官方下載：https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/download/dict_revised_2015_20260625.zip

`python scripts/import-moe-dictionary.py /path/to/official.zip`

使用 Python 標準庫讀 XLSX，不改原檔、不安裝套件。欄位格式改變時停止，不默默猜測。`node --test scripts/test-dictionary.mjs` 核對全部分區校驗、詞條唯一性、原始欄位、詞義查詢及 embedding 單位。

`npm run build:assets` 將 rag 複製到 Worker 靜態資產。部署仍由使用者執行；不改正式資料庫、Secret、權限或付費方案。遊戲 Docker 不含 Worker API，因此不代表 Docker 有字典問答服務。
