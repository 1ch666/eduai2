# EduAI2｜公民法律研究室

以生活情境、3D 模擬法庭與互動練習，協助學習者理解公民、法律及經濟概念。

本專案結合網頁學習介面、Unity WebGL 法庭、Cloudflare 後端與 Ollama 雲端模型。使用者可以閱讀重點、練習題目、查看概念弱點，也可以在虛構案件中選擇角色、檢視證物及向 NPC 提問。設計重點不是讓 AI 代替法官下判決，而是練習區分事實與推測、理解程序及說明自己的理由。

目前是持續開發中的教育平台，已有可操作的網站與 3D 遊戲；完整多角色程序模擬、手機全流程驗收及部分學習功能仍在完善。以下依 **2026-09-27 倉庫程式與發布紀錄**整理，不將設計目標等同已完成成果。

- 完整平台：[Cloudflare Worker 網站](https://civic-law-lab-212.yichengc869.workers.dev/)
- 法庭入口：[建立或繼續場次](https://civic-law-lab-212.yichengc869.workers.dev/court/)
- 公開入口：[GitHub Pages](https://1ch666.github.io/eduai2/)
- 原始碼：[1ch666/eduai2](https://github.com/1ch666/eduai2)

## 一、專案目的與學習流程

法條與公民概念容易流於背誦，因此我們把學習拆成「理解概念 → 情境練習 → 程序體驗 → 回饋與複習」：

1. 在公民小學堂與筆記精華閱讀概念、比較容易混淆的觀念。
2. 透過弱點練習作答，由伺服器判分並累積概念紀錄。
3. 進入模擬法庭，閱讀案件、檢視證物、提出陳述或與 NPC 對話。
4. 查看庭後回饋與事件紀錄，再將需要補強的主題安排到週排程。

案件是教育用虛構情境，法律資料與 AI 回答均不能代替專業法律意見。本平台不是法院系統，也不是經過效度驗證的正式能力測驗。

## 二、目前功能與實作範圍

| 模組 | 已有實作 | 目前限制 |
| --- | --- | --- |
| 登入與學習紀錄 | 註冊、登入、登出、Session、一次性復原碼、個人紀錄同步及匯出／匯入 | 主要使用 Worker 同源入口；跨來源與各瀏覽器登入仍需持續驗收，匯入紀錄不當成競賽成績 |
| 公民小學堂與筆記精華 | 靜態章節資料、練習、來源連結、結構化重點及比較整理 | 筆記預覽主要由既有章節模板產生，不是 AI 自動讀完整教材後摘要 |
| 模擬法庭 | 六類原創案件範本、角色／年齡／法律協助設定、雲端場次、程序操作、證物、回饋及事件重播介面 | 法律規則是有限教學模型；完整訊問、異議及多角色全流程尚未完成 |
| Unity 3D 法庭 | WebGL 場景、低多邊形人物、桌機移動／互動、手機搖桿與點擊、座位／走動視角及載入進度 | 新版公開狀態 HUD 已接線；其他舊互動逐步遷移，尚未完成所有手機與瀏覽器驗收 |
| AI 助教與 NPC | Ollama 問答、角色相關資料與近期對話上下文、回覆格式檢查、逾時與錯誤處理 | 有金鑰不代表上游一定可用；模型可能出錯，尚不能宣稱完整資訊隔離或零幻覺 |
| 案件生成 | AI 產生虛構案情與證物；伺服器檢查格式並比較歷史相似度；另有無 AI 的隨機題庫路徑 | 題庫變體有限，不能保證永久不重複；AI 不決定法律資格、正解或判決 |
| 弱點練習 | 伺服器派題、選項洗牌、一次性答題憑證、判分、首次作答統計與補強說明 | 目前 **145 題、29 個概念**：法律 65 題、公民 40 題、經濟 40 題；仍需擴充與教學驗證 |
| 週排程 | 週曆、時段新增／修改／刪除、重疊檢查、專注計時與心跳、ICS 行事曆匯出 | 尚非完整 AI 自動排程；專注時間與競賽榜的完整串接仍待完成 |
| 排行榜與群組 | 自願加入／退出、首次作答計分、週統計、段位條件、私人群組與邀請碼 | 完整競賽派題、防刷榜及獨立時間榜仍須完善，不作正式成績認證 |
| 照片題目講解 | 本機圖片預覽、壓縮與重新編碼；使用者確認／輸入文字後送 AI 講解，可存本機筆記 | **目前不是 OCR／Vision 圖片辨識**；後端接收的是文字，不是照片內容 |
| 提醒與音樂 | Push 訂閱端點、Service Worker、音樂播放器介面與曲目清單 | 尚未串成排程通知的伺服器發送流程；倉庫未含播放器所需音樂檔，不保證可播放或收到提醒 |
| 留言 | 雲端留言與離線待同步機制 | 離線暫存只在當下裝置，成功上傳後才可跨裝置讀取 |

## 三、系統架構

本專案不是純前端網站。網頁負責互動呈現，Worker 負責 API 與驗證，Durable Objects 負責狀態和資料保存，Unity 負責 3D 呈現與操作。

```text
使用者：電腦／手機瀏覽器
  │
  ├─ GitHub Pages：公開靜態入口、相容遊戲入口
  │                     └─ 需帳號的功能導向 Worker 網站
  │
  └─ Cloudflare Worker 同源網站
       ├─ 靜態頁面：首頁、court、practice、planner、rankings、photo、groups
       ├─ Unity WebGL（/play/）：3D 場景、輸入、人物及證物互動
       │    └─ 網頁橋接：傳遞允許的資料，金鑰不交給 Unity
       │
       └─ /api/*：TypeScript 後端
            ├─ 帳號／Session／CSRF／來源與輸入檢查
            ├─ 法庭規則、場次版本、重送處理、事件紀錄
            ├─ 練習判分、排程、排名及群組
            ├─ Durable Objects SQLite：持久化資料
            ├─ Ollama 雲端 API：文字問答、NPC、案件生成
            └─ 靜態資料：法規 JSON、教材、教育部辭典詞條
```

### 資料儲存方式

目前使用 **Cloudflare Durable Objects 內建 SQLite，不是 D1**。實際綁定見 [wrangler.jsonc](wrangler.jsonc)。不同用途拆成不同物件：

| Durable Object | 儲存用途與劃分 |
| --- | --- |
| AccountStore | 共用帳號儲存：密碼摘要、Session 摘要、復原碼及個人進度 |
| MessageRoom | 共用留言及相關限流資料 |
| CourtRoom | 每場次一個物件，保存案件狀態、操作、NPC 對話與事件紀錄 |
| Learner | 每使用者一個物件，保存場次索引、生成紀錄與限流資料 |
| Practice | 每使用者的答題憑證、作答及弱點統計 |
| Planner | 每使用者的排程與專注紀錄 |
| PushStore | 推播訂閱資料，目前未構成完整通知發送服務 |
| Rankings／Groups | 共用排行資料、群組及成員／邀請碼 |

### AI 與資料如何配合

使用者提問後，由網頁呼叫 Worker；後端依功能進行驗證、限流及資料整理，再呼叫 Ollama 雲端 API。目前設定的預設文字模型是 `gpt-oss:20b`，可以由伺服器設定調整，並非在使用者手機中執行模型。

法庭 NPC 會取得後端依角色整理的案件資料及有限近期對話，回傳內容經格式與引用識別檢查後呈現。這些檢查不等於保證每句話正確；若服務不可用，必須呈現失敗或受限制的替代內容，不把錯誤訊息冒充新證詞。

教育部辭典採「一個完整詞目一筆」儲存，現有清單記錄 **161,194 個詞目**。目前是精確詞目查詢，命中時附原文與來源；**沒有部署 embedding 模型或向量資料庫，不能稱為完整向量 RAG**。資料與使用說明見 [rag/README.md](rag/README.md)。

法律資料放在 `law-data/`，由公開資料整理為分片 JSON，來源與版本記錄於 [law-data/manifest.json](law-data/manifest.json)。這是匯入時的資料快照，不是即時更新的法律服務；法規效力、沿革與程序適用仍需查核官方資料。法規資料筆數也不等於弱點練習題數。

### 伺服器權威與遊戲端的界線

雲端法庭由伺服器驗證擁有者、程序階段、場次版本及請求識別。新橋接把公開快照傳給 Unity，Unity 不應自行改判分、法律資格或程序結果。事件紀錄支援唯讀重播；早期未留完整事件的場次只能從實際檢查點開始，不補造歷史。

目前這項架構遷移尚未全部完成：舊遊客原型及部分既有互動仍保留，新版 NPC、動態證物、程序按鈕與座位呈現尚待統一整合。因此不宣稱目前整個 Unity 客戶端都已完成伺服器權威重構。

## 四、使用技術與主要檔案

| 技術／層次 | 用途 | 主要位置 |
| --- | --- | --- |
| HTML、CSS、JavaScript ES Modules | 原生網頁介面，未使用 React／Vue | `index.html`、`styles.css`、各功能目錄 |
| TypeScript、Cloudflare Workers | API、輸入驗證、法庭與學習業務邏輯 | `src/index.ts`、`src/*.ts` |
| Durable Objects SQLite | 持久化帳號、場次及學習資料 | `src/accounts.ts`、`src/court.ts` 等、`wrangler.jsonc` |
| Unity 6000.6.2f1、C#、WebGL | 3D 法庭、角色與桌機／手機操作 | `court-game/Assets/`、`court-game/ProjectSettings/` |
| JavaScript 網頁橋接與快照狀態管理 | 網頁與 Unity 整合、版本檢查、操作與重播 UI | `court/`、`docs/API-CONTRACT-UNITY.md` |
| Ollama 雲端 API | 助教問答、角色對話及虛構案件生成 | `src/ai.ts`、`src/court-npc.ts`、`src/court-generation.ts` |
| 靜態資料與詞條檢索 | 法規、教材、辭典 | `law-data/`、`civics-data.js`、`rag/`、`src/dictionary.ts` |
| Wrangler、GitHub Actions、Docker／Nginx | 開發、Worker 發布與遊戲容器交接 | `scripts/`、`.github/workflows/`、`court-game/Dockerfile` |

```text
eduai2/
├─ index.html、styles.css、civics-data.js  首頁、公民教材與筆記
├─ auth-sync.js                          共用登入狀態生命週期
├─ court/                                雲端法庭設定、操作、橋接、重播
├─ court-game/                           Unity 原始專案、測試、Docker
├─ play/                                 已建置的 Unity WebGL 成品
├─ practice/、planner/、rankings/         弱點練習、排程、排行介面
├─ photo/、groups/                       題目文字講解、群組介面
├─ src/                                  Worker API 與資料物件
├─ law-data/、rag/                       法規快照與辭典資料
├─ scripts/                              資產整理、資料匯入與測試
├─ docs/                                 API 合約、開發與發布紀錄
├─ public/                               build:assets 產生的 Worker 靜態資產
└─ wrangler.jsonc                        Worker 資產、綁定與遷移設定
```

## 五、安全與研究限制

- 密碼使用 PBKDF2 加鹽摘要；Session 以 HttpOnly Cookie 傳遞，資料庫保存 token 摘要，不將 API key 放入 Unity 或前端。
- 後端有來源檢查、CSRF、擁有者驗證、輸入長度／格式限制及部分端點限流。防護存在不代表已通過完整資安稽核。
- 模型輸出不是法律權威，提示詞與格式驗證不能保證阻止所有幻覺或提示詞注入。
- 確認刪除雲端場次會清除該場次內容及相關副本；保留最小防重建／限流紀錄，不宣稱供應商備份即刻清除或儲存空間永不耗盡。
- 尚未完成全部角色端到端測試、iPhone Safari／Android Chrome 真機驗收、匿名研究遙測與 A/B 實驗整合，不宣稱競賽級或研究驗證已完成。
- 免費優先，不自動購買模型額度或升級方案；實際可用性仍受外部服務設定及配額影響。

## 六、建置與部署

主要平台由 Worker 同源提供網頁與 API，GitHub Pages 保留公開靜態入口。Unity 原始專案建置為 `play/`，再由資產複製流程納入 Worker 發布。

```sh
npm ci
npm run dev                   # 整理靜態資產並啟動本機 Worker
```

預設本機入口是 `http://127.0.0.1:8787`。本機 AI 要另外由管理者設定所需秘密，不可把秘密寫入 Git。

```sh
npm run check                 # 資產整理、型別產生、TypeScript 檢查、部署乾跑
node scripts/check-frontend.mjs
node scripts/check-api.mjs    # 先啟動本機 Worker；測試會建立本機測試資料
```

上述檢查不是完整驗收，也不會代替 Unity 編譯、PlayMode、手機與瀏覽器測試。

`npm run deploy` 是正式 Worker 發布命令，**不是一般閱讀或驗收必跑的步驟**；只由獲授權的部署者確認帳號、綁定、遷移與免費額度後執行。

Docker 目前包裝靜態 WebGL 與法庭頁面，不包含正式 Worker／資料庫。未另接後端時 `/api/` 刻意回覆 501，不能把容器啟動成功當成登入、AI 與存檔已可使用。

## 七、驗證證據與後續閱讀

最新中文字型修正版的 Unity Release WebGL 已建置並部署；四項 Build 檔案共 **21,269,070 bytes**，這是檔案大小，不是首載時間。Docker 建置／容器檢查亦有實際成功紀錄。詳細版本、測試範圍與限制見 [2026-09-27 發布紀錄](docs/RELEASE-2026-09-27.md)。

- [Unity 架構重構與功能保留計畫](court-game/ARCHITECTURE-REDESIGN.md)
- [Unity API 合約](docs/API-CONTRACT-UNITY.md)
- [Unity 新手入口](court-game/START-HERE.md)、[Unity 狀態紀錄](court-game/STATUS.md)
- [完整需求規格](朋友AI續作_完整需求規格.md)、[AI 接手說明](給朋友的AI接手說明.txt)
- [安全檢視紀錄](SECURITY-REVIEW-2026-09-26.md)、[SEO 設定](SEO.md)
- [後端早期實作紀錄](BACKEND.md)、[平台分期紀錄](PLATFORM-STATUS.md)

部分歷史文件保留當時的未部署／固定案件等描述；閱讀時應核對日期、實際程式及較新的發布紀錄，不能將舊狀態當成目前版本。
