# Unity NPC 共用傳輸與恢復提示發布

- 日期：2026-09-27。
- 來源：`54e4cd94abf278026c850ede0e81b9f706c2ef57`。
- 網站：https://civic-law-lab-212.yichengc869.workers.dev/court/
- Worker version：`d5023659-5885-419f-be86-a99c749af09a`。
- 前版：`1bc7b347-0e1c-40c3-b42f-10188edee6f1`。

## 變更與邊界

Unity 既有 NPC 提問改由網頁共用 v1 transport 送出，與程序面板共用 pending 與恢復識別碼；場次頁增加「操作恢復」提示。保留 Unity 中文輸入、Pointer Lock fallback、手機操作與既有 WebGL 成品；本次沒有 C# 或 WebGL 重編。

Wrangler 4.136.3 乾跑通過，正式 `deploy --keep-vars` 成功，上傳五個新增／修改資產。未更動後端程式、資料庫 schema、migration、Secrets、權限、帳號或付費方案。既有觸發排程保持不變。README 的獨立未提交修改不屬本次來源，也不在 Worker 靜態資產清單中。

## 驗證

- 48 項 Node 回歸測試通過（與 Docker workflow 的測試命令相同）。
- TypeScript `--noEmit`、前端檢查、資產整理及部署乾跑通過。
- 先前本機真實 WebGL 中文 NPC 提問、AI 停用提示、關閉與重開歷史已驗證；三種回覆遺失的本機 workerd 整合測試亦通過，詳見 `UNITY-NPC-V1-INTEGRATION.md`。
- 正式站以下資產 HTTP 200，與本機 bytes 完全相同：

| 路徑 | bytes | SHA-256 |
| --- | ---: | --- |
| court/action-panel.js | 9045 | 1e199b196f046972b80e87f75091b70804d01740893516cf860010c00ee27c77 |
| court/npc-action.js | 1621 | d7bdeb081535656bc39824b34f43447cd968d5c4e76498ae314e4347ecab66a3 |
| court/recovery-notice.js | 1141 | 32b48120786b378a5cd6238427ea7024009b72246534c18f9b1d91146cf1f763 |
| court/court.js | 25005 | ab5aa43239e44464a2bf315dc7b6a771b8ad0fb03e39c221317d75ccad2e55c4 |
| court/court.css | 6586 | 8c2edb15b23d05e4199d9ff05bb68e0f49f5afeb7a2ba3c127de12e4b6cc88a5 |

未登入存取 v1 場次 API 回覆 401。上述正式檢查只有唯讀公開檔案及授權邊界，未建立正式場次、不呼叫正式 AI，不代表登入後的完整正式 E2E。

## Docker

同一來源的交接工作：https://github.com/1ch666/eduai2/actions/runs/36324833573 ，於 2026-09-27 14:09:10 UTC 成功完成。確認倉庫為 PUBLIC，使用既有 ubuntu-latest 標準 runner。

實際執行測試、Docker build、Nginx 設定檢查、非 root／唯讀容器启动、遊戲與 court 模組 HTTP 位元組比對、缺少後端時 API 501 與防權限提升檢查。artifact `eduai-court-docker`（ID `10934010631`）上傳成功，下載包 46,556,270 bytes。這是容器交接包大小，不是 WebGL 首次下載量。

本機副本：工作區外層 `outputs/docker-unity-npc-54e4cd9/`。`sha256sum -c SHA256SUMS` 六項均 OK，`SOURCE_COMMIT.txt` 確認為本次來源。映像封裝 `eduai-court-preview.tar.gz` SHA-256：`c7f8ca381f374abc63abb2afeb936ea71a40cede424b6a007e2292aa2c99c318`。GitHub artifact 只保留一天，交接可用本機副本；不提交大型映像至 Git。

容器僅提供靜態遊戲與頁面，`/api/` 預期 501；不包含正式 Worker、資料庫、Session 或 AI 金鑰，不能將容器成功當作後端整合完成。

## 未完成與回滾

真實 AI 供應商回覆、遊戲內斷線恢復 UI、手機真機、Chrome／Edge 全流程、完整鏡頭恢復不變量仍待驗證。完整 NPC presenter、角色資料隔離、動態證物與研究功能仍屬整體目標，不以此發布代替。

如需回滾，先查核未確認請求是否已完成或取得終止回執，不清除玩家 pending marker 或資料表。回滾到前一版會恢复舊 NPC 提問接線，必須先停止新提問並確認舊／新路徑無同時送出；不要盲目重送未知結果。
