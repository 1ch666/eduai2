# 本次有限範圍資安檢查

範圍：NPC API、登入 session、網頁橋接及顯示。不是滲透測試或完整安全認證，未讀取正式密碼、金鑰或私人對話，未更動正式權限。

已從程式確認：
- `src/session.ts`：HTTPS Cookie 使用 __Host- 名稱、Secure、HttpOnly；session token 不交給 Unity。SameSite=None 是既有跨站登入設計，不是 Lax；寫入依賴 Origin 與 CSRF 檢查。
- `src/auth.ts`、`src/court.ts`：登入驗證、CSRF、owner、長度、限流與請求識別；NPC 回覆保存前重新驗證版本。
- `court/court.js`、WebGL template：postMessage 檢查同源及指定視窗；Unity 回覆驗證 requestId/NPC。文字使用 textContent／關閉 rich text。
- `src/court-npc.ts`：模型只選允許的事實 ID；API key 僅後端使用。錯誤 UI 不顯示上游回覆／金鑰。

尚待改善或驗證：
- `_headers` 及 Worker CSP 允許 unsafe-inline。應規劃外部腳本或 nonce/hash，不能宣稱 CSP 已完全防 XSS。
- 模型產生案件的格式與正則驗證不是語意／法律正確性保證，仍需一致性評測；提示詞注入不能只靠提示詞保護。
- 帳號100場次與請求限流不等同全站供應商預算控制，仍須營運監控免費額度，不可自動付費。
- 既有 first-recovery 契約問題仍待修正；未修改登入資料庫。
- 本輪重新跑本機 API 整合測試時 localhost:7202 已停止（ECONNREFUSED），故沒有新的整合通過證據。前輪通過紀錄不能當作正式環境驗收。
- 尚未做正式跨帳號測試、完整 XSS／CSRF 測試集或手機全螢幕真機測試。

NPC 的 QUOTA 表示供應商 HTTP 429，只能推論額度或頻率限制，不能確定額度耗盡；RATE_LIMIT 是本網站頻率／場次預算。其他配置、停用、上游與逾時／格式錯誤現在分開顯示。
