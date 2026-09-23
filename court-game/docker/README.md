# Docker 遊戲下載包

若 SOURCE_COMMIT 來自 feature/learning-platform，此包是新法庭開發預覽，不是正式網站版本。額外提供 `/court/` 靜態介面，但容器未帶 Cloudflare Durable Objects；登入、場次及 AI 端點仍回 501。請閱讀同包 PLATFORM-STATUS.md，不要把預覽當作完整平台。

此包是 Linux amd64 的 Unity WebGL 靜態遊戲，包含手機搖桿。不是 Unity 編輯器，也沒有登入、session 或 AI 後端；`/api/` 回 501 是預留狀態。需要已安裝可執行 Linux 容器的 Docker。請依自身情況確認 Docker 免費使用資格，不需開通雲端付費主機。

解壓 GitHub artifact，進入含有本檔的資料夾後：

```sh
docker load -i eduai-court-preview.tar.gz
docker compose -f compose.image.yaml up -d --force-recreate
```

開啟 http://localhost:8080/play/ 。這是本機入口，不是手機可連的公開網址；手機請使用 https://1ch666.github.io/eduai2/play/ 。不要直接雙擊 HTML。

停止容器：`docker compose -f compose.image.yaml down`。更新時下載新包、重新 load，再執行上面的 up --force-recreate，避免舊容器繼續執行舊映像。8080 被占用時先停止舊容器；不要刪除不認識的容器。

`SOURCE_COMMIT.txt` 記錄來源版本；下列指令應顯示相同 commit：

```sh
docker image inspect eduai-court:preview --format '{{index .Config.Labels "org.opencontainers.image.revision"}}'
```

`SHA256SUMS` 是下载包各檔案校驗值，Linux 可用 `sha256sum -c SHA256SUMS`；Windows 可用 `Get-FileHash .\eduai-court-preview.tar.gz -Algorithm SHA256` 比對。`WEBGL-SHA256SUMS` 則是映像內遊戲檔案相對根目錄的校驗值，不是在此包目錄執行。

映像只綁本機、非 root、唯讀並移除 capabilities。若後端接手加入 API／session 或對外開放，需另外處理 HTTPS、驗證與限流；不要在前端或映像加入金鑰。GitHub Pages 不會執行 Docker。

下載包保留 1 天；過期可從倉庫 Actions → Court Docker handoff → Run workflow 免費重新打包（公開倉庫標準 runner）。遊戲原始碼和完整交接文件位於倉庫 court-game/。
