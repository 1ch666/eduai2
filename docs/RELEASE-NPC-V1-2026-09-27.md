# NPC v1 發布紀錄 — 2026-09-27

## 已發布

- 發布來源：`a835ad03c5b0a386ca8716fcb4eb60529f763f91`（功能提交 `c8ef64c`）。
- Worker：`civic-law-lab-212`。
- URL：https://civic-law-lab-212.yichengc869.workers.dev/court/
- Worker version：`1bc7b347-0e1c-40c3-b42f-10188edee6f1`。
- 前一版本：`0031d3b1-200e-42e9-a8fe-4df3bd1a62ca`。
- Wrangler 4.136.3 乾跑通過；以 `deploy --keep-vars` 發布，成功更新四個靜態資產。未更動 Secret、帳號權限、binding、Wrangler migration 或付費方案。
- CourtRoom 新增 `court_v1_npc_pending` 表，在初始化時增量建立；沒有清空正式場次。這是資料表增加，不是「資料庫完全沒有改動」。
- Unity WebGL 成品沿用前版，沒有重編、增加模型或變更遊戲下載檔。

## 證據與範圍

前置：60 項相關 Node 測試、TypeScript、前端靜態檢查、本機 workerd API 與內建瀏覽器驗證。細節見 `NPC-CAST-PROGRESS.md`。

正式站唯讀檢查：`/court/` HTTP 200；未登入存取 v1 snapshot HTTP 401。以下公開檔案 HTTP 200，下載 bytes 與本機逐位元相同：

| 檔案 | bytes | SHA-256 |
| --- | ---: | --- |
| court/action-panel.js | 8071 | ea9cb75de7595db4cb3ad9e5054946b0d65c59f84413725d22b077d329c35551 |
| court/transport.js | 9855 | 444321f8fad299baf40ee46362243c47806920302087bc01bca353cf02342eaa |
| court/protocol.js | 6751 | 4c4d7e385c2d5a7dcb0eb8a6b131aef423c16869869a925559759ef7a992ab2e |

未使用正式帳號建立或刪除場次；未驗證正式 Ollama 額度、真實模型成功回覆或手機。這些公開讀取不能證明完整登入後 E2E。既存事件快照不重寫，舊場次需下一次正常操作產生新版本才可能取得 `npc.ask`。

## Docker

同一來源的交接工作：https://github.com/1ch666/eduai2/actions/runs/36323284099

第一次嘗試：32 項測試全過；Docker Hub `auth.docker.io/token` 回傳 502，Nginx 基底映像尚未下載，未產生交接成品。重跑同一工作一次成功，於 2026-09-27 13:43:00 UTC 完成。

成功工作包含實際 Docker build、nginx 設定檢查、容器啟動、WebGL 及頁面位元組比對、非 root／唯讀檔案系統、防權限提升設定與 HTTP 檢查；交接 artifact `eduai-court-docker` 上傳成功。內含來源 commit、WebGL 校驗值、映像 tar.gz 與新手 README。這仍是靜態容器，`/api/` 預期回覆 501，不包含正式登入／AI 後端。

已下載至開發工作區 `outputs/docker-npc-v1-a835ad0/`；`sha256sum -c SHA256SUMS` 六項全數 OK，來源 commit 與上述發布來源一致。映像封裝 SHA-256：`44d92212463679e316f237acf603a6b4de287b48bac6dd66b880f3ddf75c8468`。GitHub artifact 保留一天，本機副本不受該到期時間影響；不要將大型映像提交 Git。

## 回滾與後續

若需回滾，先停新提問並確認已送出的預留完成或到期；不要 DROP 新表或 reset migration。舊程式不理解新預留狀態，不能在仍有待處理提問時盲目回滾。

仍待 Unity NPC presenter／動畫與座位映射、角色私有證物完整隔離、正式模型與手機全流程驗證。此發布不代表完整競賽級目標完成。
