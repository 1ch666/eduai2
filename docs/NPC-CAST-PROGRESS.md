# NPC 公開角色清單接線

2026-09-27。`src/court-cast.ts` 提供既有五個教學 NPC 的固定識別碼、程序對應角色名稱、座位識別與公開呈現狀態。`court-journal.ts` 新產生的快照不再回傳空的 NPC 清單；`court-npc.ts` 使用同一名稱來源，避免角色名稱分歧。

本批是資料接線，不是完整法庭角色／座位系統：五個模型沿用既有教學角色；律師模型存在不代表已確認某一方依法委任律師。seatId 是公開穩定識別，目前尚未全部對應 Unity anchor。pose=sitting、emotion=neutral、silent／idle 是已提交快照的基準呈現，不是 AI 推測心情，也不代表即時請求進度。

## 邊界

- 不輸出角色私有知識、prompt、正解、擁有者或 token。
- 完成場次、旁觀者及階段超出既有交談範圍時，公開 interactable=false；舊 NPC RPC 使用同一伺服器條件再次拒絕。欄位只供呈現，不能取代授權。
- RPC 邊界新增角色白名單、提問格式檢查，異常輸入不寫入對話預留。
- 不修改已保存事件。同版本仍回傳原事件快照；舊快照可能維持空清單，下一次正常操作產生的新版本才帶新清單。重播不偽造過去資料。
- 不新增資料表或 Cloudflare migration，不刪正式資料，不修改金鑰、權限與付費方案。

## 驗證與後續

TypeScript 通過。`scripts/test-court-journal.mjs` 16 項通過，其中新增四項覆蓋三種程序的名稱與嚴格 DTO、禁止交談條件、RPC 輸入拒絕、舊事件不變。測試使用記憶體 SQLite／mock DO lifecycle，不代表 workerd、Unity 或手機全流程。

尚未發布本批後端。下一步必須實作 v1 NPC 動作的請求預留、冪等結果與逾時恢復，再接程序面板與 Unity presenter；不能只因公開名單存在就宣稱新版 NPC 對話已可操作。舊 v0 NPC 對話仍保留。角色私有證物可見性、完整動畫、座位映射及全流程實機驗收仍待完成。
