# Feature Preservation Matrix — 2026-09-28

此表以当前 main 原始碼及已記錄測試為依據。存在程式碼不等於完整驗收；「保留」不表示規格全部完成。任何替換須先補等價測試、相容與回滾方案，禁止清空正式資料。前端／Unity 新能力以原 API 漸進接入，未啟用不相容替代。

| 能力 | 現行主要實作 | 替代／遷移狀態 | 已有測試證據 | 相容性與正式狀態／缺口 |
| --- | --- | --- | --- | --- |
| 帳號 | src/accounts.ts、src/auth.ts、court/index.html | 保留 AccountStore，不更換 owner/database | check-api 註冊、登入、登出、一次性復原競爭、登入與復原競爭、舊 session 撤銷及進度保存 | 86d2cec 的 CI 36339421823 通過；並行 HTTP 不等於所有時序或實機驗證 |
| 驗證／session | src/session.ts、auth-sync.js、src/http.ts | 保留 cookie／CSRF 與同源模式 | check-api、check-auth-sync | 不向 Unity 傳 session；跨裝置實機仍待驗收 |
| 題目練習 | src/practice.ts、src/practice-data.ts、practice/ | 保留伺服器判分、一次性 token；升級確認式 UI | test-practice、test-practice-ui；本機瀏覽器 | 8bd1617 前端已發布；無判分回執重取 API，斷線不盲目重送 |
| 弱點 | Practice.weakness、reinforce 端點 | 保留最近 20 次／至少 5 題與補強入口 | 舊 threshold 測試部分複製邏輯，證據有限 | 不因題數少冒稱成熟分析；需真實 DO 整合測試 |
| 排程／專注 | src/planner.ts、planner/ | 保留 CRUD、focus 與 ICS 前端 | test-planner 部分複製驗證邏輯 | 不等於完整跨日／時區／多裝置防刷驗收 |
| 群組 | src/groups.ts、groups/ | 保留建立、加入、退出、邀請與成員權限 | 尚無全面整合 CI | 正式路由存在；退出後隔離／撤銷碼仍須補實際測試 |
| 排行榜 | src/rankings.ts、rankings/ | 保留既有積分榜，不冒稱新階梯規格已完成 | Practice 初次答題呼叫 rankings；缺完整 CI | 時間榜、百分位段位等新規格不可由現有積分榜替代 |
| 進度匯入／匯出 | src/auth.ts、src/accounts.ts、index.html | 保留來源隔離與 selfReported | test-progress-import、test-progress-isolation、check-api | 匯入不得刷排名；首頁雲端 round-trip 已有本機證據 |
| 法庭 | src/court-rules.ts、src/court.ts、court/、court-game/ | v1 漸進接入，既有 v0 路由保留 | test-court、journal、protocol、check-court-v1-api | 正式 WebGL 存在；完整角色／程序空間／真機仍未完成 |
| NPC | src/court-npc.ts、src/court-cast.ts、court/npc-action.js、Unity NPC/ | 保留角色投影、單次請求與明示 fallback | test-npc、npc-action、check-npc-recovery-api | 真實 AI 品質、語義洩漏不是 mocked provider 測試能證明 |
| Replay | src/court-journal.ts、court/replay*.js、Unity Replay/ | append-only public event + snapshot；舊場次 checkpoint | test-court-replay*、check-court-v1-api | 不改正式案件；舊場次無完整早期事件就明示不完整 |
| AI fallback | src/ai.ts、src/court-npc.ts、src/court-generation.ts | 保留無 AI 固定內容與案例庫 | test-tutor、test-generation、npc-recovery | 四級 availability/provider/budget 統一基礎尚未完成 |
| 照片／筆記／留言 | src/photo.ts、src/messages.ts、photo/、index.html | 保留現有能力與資料 | check-api 留言 round-trip | 照片不應宣稱已有真正 OCR/Vision；首頁筆記／留言不因重構移除 |
| 通知／音樂 | src/push.ts、sw.js、music-player.js | 保留現行入口，不以重構刪除 | 尚無全面真實 delivery／播放驗收 | Push subscription 不等於已完成 server delivery；需逐項現況查核 |

## 證據與發布邊界

- 快速 CI c42665c/run 36335039738 成功；新增隔離本機 API 的 f923753/run 36335235336 成功，172 項快速測試及三組本機 HTTP 檢查。
- 正式 Worker 最近已驗證版：06bcf6ac-af81-432e-9336-9867c97537ad（來源 e28f5ff，案件流程可達性 gate）；公開 capabilities/cases 200、匿名 sessions 401。遊戲 artifact 仍為 494dddb，不是 CI 每次都重建 Unity。
- 新增純草稿 validator、所有支援角色的完成路徑 gate、並行動作測試及復原競爭測試；詳細範圍見 docs/COURT-DRAFT-VALIDATION.md、COURT-REACHABILITY.md、COURT-CONCURRENCY-TESTS.md、AUTH-RECOVERY-CONCURRENCY.md。
- provider 已有三種介面與 tutor/NPC adapter；研究 metadata 已有 schema/關係檢查，但仍無真正 benchmark/持久化研究紀錄。完整 validator、統一 API 錯誤格式、全管線 provider 解耦、預算治理、可實際復原的備份仍未完成。
- 完整後端驗收追蹤見 docs/BACKEND-GOAL-AUDIT.md；安全風險與證據見 SECURITY-THREAT-MODEL.md。不要由局部 CI 綠燈宣稱整體 10/10。
- 回滾原則：前端／遊戲使用相符版本的原始碼與 artifact；後端資料變更須 additive + dry run + restore 證據後才發布。不能為了回滾刪表或 reset migration。
