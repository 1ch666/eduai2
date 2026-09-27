# 練習作答流程重構：2026-09-28

## 實際完成

- `practice/index.html`、`practice/practice.js`：點選答案只改選擇，確認後才送原有 `/api/practice/answer`。同一次送出期間阻擋連點與改選。
- 伺服器判分後保留原題、所有選項，深綠標正解、深紅標選錯答案，另加文字與符號，非只靠顏色。
- 選項採原生按鈕與 aria-pressed；題目／結果可程式聚焦，讀題與結果焦點不留在已消失的送出按鈕。
- 查看弱點再關閉，恢復正在作答或已判分的題目；下一題清除舊選擇。
- 舊後端是消耗一次性 questionToken，不具結果重取 API。未知送出結果時不自動重送、不顯示假分數，提示可能已記錄並可另取題目。
- `styles.css` 僅新增 practice 選項樣式，不重寫其他頁面版型。

## 保留對照

| 原能力 | 現在對應 | 驗證 |
| --- | --- | --- |
| 登入／CSRF | 原 EduAuth.session、X-CSRF-Token | 本機已登入帳號正常取題判分 |
| 科目／概念取題 | 原 fetchQuestion 與 API | 未更改參數與補強取題路徑 |
| 伺服器判分 | 原 answer API | 真實本機 Worker 回傳錯答與正解 |
| 解析／來源 | 原結果區，新增保留題目 | 本機瀏覽器呈現 |
| 弱點、補題、安排複習 | 原端點與排程連結保留 | 弱點關閉恢復有自動測試；補題完整回歸待做 |

## 測試證據

- `node --test scripts/test-practice-ui.mjs`：2 個測試通過；直接執行實際 controller，DOM 替身只驗證行為，不能當作排版／真機驗收。
- `node --check practice/practice.js` 通過。
- 真實瀏覽器 `http://localhost:8792/practice/`：本機測試帳號取題 → 選擇不立即送出 → 確認 → 原題及正誤選项與解析保留。
- 截圖：工作區 `outputs/practice-confirm-0928.png`。本機測試紀錄不是正式使用者資料。

## 尚未完成／下一步

這批不是整站產品化完成，亦未宣稱正式 Worker 已更新。
需接著做：完整 UX audit／資訊架構、共用 design tokens/components、真資料 Dashboard、十題練習進度、timeout 與各 HTTP 狀態 UI、伺服器可恢復答題結果、手機與鍵盤完整驗收。
目前未建立可重取判分結果的 API，不可為了「重試按鈕」盲目重送已消耗的 token。
題庫內容、題數、法律正確性不屬於此 UI 測試的驗證範圍。
未更動資料庫、權限、登入邏輯、Unity Build。README.md 原有修改未混入。

## 發布／回滾

靜態資產由既有 `node scripts/copy-assets.mjs` 複製至 public；須完成既有 Worker 發布才能更新主要學習頁面。GitHub Pages 的學習入口仍按 auth-sync 導向同源 Worker。
回滾本批三個前端檔即可；不涉及 schema 或正式資料回滾。
