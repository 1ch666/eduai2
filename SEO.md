# 搜尋與分享設定

正式網址： https://1ch666.github.io/eduai2/

- HTML 原始碼提供繁體中文標題、description、canonical、Open Graph、Twitter 摘要和 WebApplication JSON-LD，無需執行 JavaScript 才能讀取。
- sitemap.xml 只列真實首頁；互動模式不是獨立網頁，不虛構大量可索引頁面。
- Cloudflare 與其他部署的相同 HTML 指向上述 canonical，避免分散主要網址訊號。
- robots.txt 在 Cloudflare 根目錄生效；GitHub Pages 專案路徑 `/eduai/robots.txt` 不能控制網域根目錄的爬蟲規則。可在 Search Console 驗證網站後提交 `https://1ch666.github.io/eduai2/sitemap.xml`。本次未自動驗證 Search Console 或申請索引。
- 搜尋引擎自行決定收錄時間、排名與摘要；這些設定不是排名保證。
- 不新增追蹤器、外部字型、付費服務或 AI 產圖。法規分片與共用留言延至開啟對應功能後才載入。

驗證：`npm run build:assets`、`node scripts/check-frontend.mjs`、`npm run check`。
