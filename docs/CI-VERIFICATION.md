# 快速回歸檢查

執行：`node scripts/ci-fast.mjs`（先 `npm ci`，Node 24.14.0）。

`.github/workflows/fast-checks.yml` 在 main push、PR 及手動執行時運作；僅公開倉庫的標準 Ubuntu runner，contents 唯讀，不使用 Cloudflare／AI／Unity secrets，不執行部署。舊工作取消避免重複耗用。Action 固定 commit，依 lockfile 安裝。

## 實際覆蓋

1. 複製網站靜態資產，重新由 Wrangler 產生環境型別，TypeScript noEmit。
2. 主頁腳本語法、metadata、schema、重複 ID、必要靜態檔案檢查。
3. scripts/test-*.mjs（排除字典完整 corpus 掃描）、auth-sync 檢查及 court-game/tools/test-*.mjs。包含公開協定解析、跨帳號進度隔離、NPC 模型替身、程序轉移、重播、請求復原、UI controller 與 WebGL template。
4. 已提交 WebGL 的壓縮完整性、內容 revision、SHA256、下載量 budget。

本機 2026-09-28 實測 171 tests 通過，型別與前端檢查通過，WebGL 21,328,937 bytes 通過既有 budget。GitHub 首次結果另由 workflow run 確認，不能只以本機綠燈宣稱遠端通過。

## 不涵蓋／不可冒稱完成

- 真實 workerd 上的登入、CSRF、DO 交易／migration／跨帳號全套整合：現有 check-api／check-court-v1-api 等尚待加入隔離本機 API job；不可指向正式站跑會建立帳號的測試。
- 部分舊 practice／planner 測試複製邏輯而非執行正式實作，屬有限證據，後續須移除此落差。
- 格式／lint gate、provider interface 全套、備份復原、完整 property/fuzz gate 尚未完成。
- Unity Editor 編譯／PlayMode／新 WebGL build 不在 Node job 執行；此 job 只驗既有 artifact，不驗新 C# 已重新編譯。
- 真機、真實瀏覽器完整 E2E、效能量測不由單元測試代替。
- Docker 真正 build/run 仍由既有 Court Docker handoff 手動 workflow，非本 job 的通過項目。
- 完整字典 corpus 可另跑 `node --test scripts/test-dictionary.mjs`。模型 benchmark／大型 research evaluation 未新增，不能稱已完成 heavy evaluation。

## Windows 沙箱注意

若 esbuild 無法讀取專案祖先目錄，Wrangler types 可能只產生沒有 RPC 泛型的 namespace，接著出現大量 TS2339。先確認產生器可正常執行，再重新產生型別；不要以 any、忽略 tsc、修改正式 DO binding 或手寫假型別掩蓋。
此輪重新以可讀取的執行環境驗證後通過；src/env.ts 沒有內容變更，沒有正式後端資料／設定變更。
