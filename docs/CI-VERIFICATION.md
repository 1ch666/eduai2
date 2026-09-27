# 快速回歸檢查

執行：`node scripts/ci-fast.mjs`（先 `npm ci`，Node 24.14.0）。

`.github/workflows/fast-checks.yml` 在 main push、PR 及手動執行時運作；僅公開倉庫的標準 Ubuntu runner，contents 唯讀，不使用 Cloudflare／AI／Unity secrets，不執行部署。舊工作取消避免重複耗用。Action 固定 commit，依 lockfile 安裝。

## 實際覆蓋

1. 複製網站靜態資產，重新由 Wrangler 產生環境型別，TypeScript noEmit。
2. 主頁腳本語法、metadata、schema、重複 ID、必要靜態檔案檢查。
3. scripts/test-*.mjs（排除字典完整 corpus 掃描）、auth-sync 檢查及 court-game/tools/test-*.mjs。包含公開協定解析、跨帳號進度隔離、NPC 模型替身、程序轉移、重播、請求復原、UI controller 與 WebGL template。
4. 已提交 WebGL 的壓縮完整性、內容 revision、SHA256、下載量 budget。

本機 2026-09-28 實測 171 tests 通過，型別與前端檢查通過，WebGL 21,328,937 bytes 通過既有 budget。GitHub 首次 run 36335039738（c42665c）亦成功；新增 local-api-target 測試後預期 172 tests，須以新 run 結果為準。

## 隔離本機 API job

`local-api` 使用無 Secrets 的全新 CI checkout，啟動 `wrangler dev --local`，綁定 127.0.0.1:8797、資料存入該 runner 暫存目錄；明確停用 COURT_AI_ENABLED 並將 OLLAMA_API_KEY 設空。依 capabilities 輪詢 readiness，而非假設 sleep 後一定啟動。45 秒未就緒就失敗，不繼續建立帳號。

依序執行 check-api（登入／登出、session、CSRF、進度、留言）、check-court-v1-api（擁有者隔離、版本、重送、重播、刪除）、check-npc-recovery-api（伺服器實際 commit 後模擬遺失回覆／格式損壞／逾時，以 GET 恢復，確認只 POST 一次）。新 local-api-target 共用 guard 拒絕非 loopback HTTP、帳密 URL、路徑、query、fragment，請求不跟隨重新導向。

這些都是 disposable 測試資料，沒有正式 migration、正式資料刪除或 AI 模型請求。保留既有正式 PBKDF2 設定，不為了加速降低密碼保護。程序由 EXIT trap 關閉；不輸出或上傳本機 Worker 全部 log／SQLite，避免將測試 session 等不必要資訊作為公開 artifact。

## 不涵蓋／不可冒稱完成

- 本機 API job 僅覆蓋上述既有斷言，不代表完整 auth/recovery race、migration／backup／restore、所有 DO 交易或平台全部端點安全驗收。不可指向正式站跑會建立帳號的測試。
- 部分舊 practice／planner 測試複製邏輯而非執行正式實作，屬有限證據，後續須移除此落差。
- 格式／lint gate、provider interface 全套、備份復原、完整 property/fuzz gate 尚未完成。
- Unity Editor 編譯／PlayMode／新 WebGL build 不在 Node job 執行；此 job 只驗既有 artifact，不驗新 C# 已重新編譯。
- 真機、真實瀏覽器完整 E2E、效能量測不由單元測試代替。
- Docker 真正 build/run 仍由既有 Court Docker handoff 手動 workflow，非本 job 的通過項目。
- 完整字典 corpus 可另跑 `node --test scripts/test-dictionary.mjs`。模型 benchmark／大型 research evaluation 未新增，不能稱已完成 heavy evaluation。

## Windows 沙箱注意

若 esbuild 無法讀取專案祖先目錄，Wrangler types 可能只產生沒有 RPC 泛型的 namespace，接著出現大量 TS2339。先確認產生器可正常執行，再重新產生型別；不要以 any、忽略 tsc、修改正式 DO binding 或手寫假型別掩蓋。
此輪重新以可讀取的執行環境驗證後通過；src/env.ts 沒有內容變更，沒有正式後端資料／設定變更。
