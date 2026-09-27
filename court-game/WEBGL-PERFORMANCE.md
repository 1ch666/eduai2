# WebGL 發布效能與下載門檻

## 目前實際門檻

`webgl-budget.json` 以已發布 `b795d7b29088d64cc06635846ed323ce6ada1e9e` 的五項資源為基準：21,275,667 bytes。`tools/check-build.mjs` 檢查 HTML 資源引用、Gzip、WASM magic、loader 宣告解壓 WASM 大小及下載門檻，並輸出各檔 SHA-256。

- 總量增加超過 10% 失敗（上限 23,403,233 bytes）。
- 單一資源增加超過 20% 失敗，避免小檔異常被大檔掩蓋。
- 不自動逐版提高基準。若必要新增素材超過門檻，必須先記錄原因、測量實際影響，再經明確檢視修改基準；不得只為 CI 變綠而調大。
- 這是工程發布預算，不是已達成的速度或記憶體目標。

倉庫根目錄執行：

```sh
node --test court-game/tools/test-build-budget.mjs
node court-game/tools/check-build.mjs play
```

既有手動 `Court Docker handoff` 工作加入五項門檻測試，並沿用成品檢查。這不是每次 push 自動執行完整 Unity CI；沒有宣稱 GitHub runner 已跑 Unity 編譯或 Play。

## 最近量測

| 檔案 | 已發布 b795d7b | 座位映射本機候選 e1f3dab |
| --- | ---: | ---: |
| data | 15,289,841 | 15,291,203 |
| wasm | 5,848,923 | 5,849,935 |
| framework | 83,191 | 83,191 |
| loader | 48,540 | 48,540 |
| touch | 5,172 | 5,172 |
| 合計 bytes | 21,275,667 | 21,278,041 |

候選增加 2,374 bytes，約 0.011%。來源為官方 Unity 6000.6.2f1 Release 實際輸出，不含 HTML、HTTP/TLS header 或 CDN 二次壓縮；不將大小百分比換算成啟動時間。候選位於隔離 `outputs/npc-unity62-check/Builds/WebGL`，尚未發布。新 loader 的 wasmFileSize 18,611,392 與實際解壓長度一致。

## 尚未完成的效能證據

冷快取與熱快取載入秒數、遊玩 FPS／低分位幀時間、WASM／瀏覽器記憶體與峰值、iPhone Safari／Android Chrome 成功率尚未建立足夠的實測紀錄。先前瀏覽器看到 100% 只能證明該次載入成功，不能冒充上述指標。

接續量測須记录來源 commit、正式成品 hash、裝置／OS／瀏覽器版本、网络條件、快取狀態、重複次數、載入起訖定義與異常。分開報告桌機與手機；用真實人機輸入執行同一案件路徑。瀏覽器不提供可靠 memory 指標時標示 unavailable，不填 0。FPS 與記憶體數值只作診斷，不含帳號／對話／token，不啟用額外遠端分析服务。

資產優化仍需兼顧完整中文與動態內容。不得以移除必要字型、互動、案件資訊或手機操作換取較小成品；新動畫／模型須重跑本門檻並比較實際載入與操作。
