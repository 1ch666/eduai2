# eduai2 遷移紀錄

正式倉庫：https://github.com/1ch666/eduai2

網站：https://1ch666.github.io/eduai2/

遊戲：https://1ch666.github.io/eduai2/play/

來源為 eduai 的 `45c3230`，保留全部 main 歷史及已提交檔案。舊工作目錄未提交內容不在本次範圍。新的 clone 工作目錄是 eduai2，後續只推 origin（eduai2）；source remote 僅供追溯，不推送。

已同步網站 canonical、Open Graph、結構化資料、sitemap、robots、遊戲返回學堂連結、Unity 模板、Docker 來源標記及接手指引。Unity 二進位檔未改動；這次只更新網頁包裝與部署網址，不需重建場景。STATUS.md 舊紀錄中的舊倉庫 run URL 是歷史證據，不是目前部署入口。

## 後端與資料

沿用 `civic-law-lab-212.yichengc869.workers.dev`，沒有重建 Worker、資料庫或金鑰。兩個 Pages 入口的 Origin 都是 `https://1ch666.github.io`；已確認留言 GET 200、AI OPTIONS 204 並回傳正確 CORS Origin。這些是連線檢查，不代表已驗證 Ollama 回答。

重要：BACKEND.md 記載的新帳號／session／法庭 AI 後端原本就尚未部署。線上仍是舊 Worker；本次倉庫遷移不會順便部署尚未驗收的新後端，也不保證新登入功能可用。後續由後端人員部署並驗收，保留現有 Worker 名称與 migration，勿刪資料庫。

Docker 仍是靜態遊戲容器，API 501；新映像從 eduai2 的 Court Docker handoff 取得。下載包只保留一天，應自行保存。

## 刪除舊倉庫前

先確認新 Pages／Docker workflow 成功並自行確認手機遊玩。Git 複製不包含 Issues、PR、GitHub 權限、Actions 歷史或舊 artifact；需要者請先保存或在新倉庫重新設定協作者。未自動刪除舊倉庫。刪除後舊網址會失效，不會自動轉址，請更新書籤及分享連結。Cloudflare 獨立服務應保留。
