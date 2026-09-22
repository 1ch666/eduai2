# 給接手 AI 的工作指引

使用者說「幫我繼續完成」時，先完整閱讀本目錄 STATUS.md、HANDOFF.md 和本檔，並檢查實際檔案及 Git 狀態。文件中的完成狀態可能落後；以編譯、測試與部署結果為準。

## 範圍與優先順序

1. 最新使用者決定（2026-09-22）：手機加入左下搖桿、滑動轉向、直接點畫面互動／作答，不用準星；**電腦維持原樣**。保留自動預載入＋Gzip fallback，更新 Docker；奶蛙模型稍後提供。session 與 AI 仍留給後端。
2. 網站模擬法庭「開始遊玩」維持 `/eduai2/play/`；目前已嵌入真正 Unity WebGL，實際驗證與版本以 STATUS.md 為準。保持 WASD／E／1–4／Pointer Lock fallback。
3. 保留 Dockerfile／compose 給後端人員；只有 Docker build/run 成功才能稱已完成容器打包。
4. AI、登入與 session 由後端人員接續。不得把 API key、授權檔、cookie 或憑證放進 Assets、WebGL 或 Git。

## 不可破壞

- 只推到 `https://github.com/1ch666/eduai2.git`，不要推舊倉庫。
- Unity 專案在 court-game；勿搬移或覆寫原網站。原網站可能有其他進行中的修改，不得一併提交、還原或清除。
- 不新增付費服務、付費 Asset 或訂閱。需要使用者登入、授權或無法自動核准的步驟時，如實交接。
- 不為了容易部署就換掉 Unity 或取消 WASD／準星／E／1234 操作，除非使用者同意。

## 從哪裡繼續

- `Assets/Editor/CourtProjectBuilder.cs`：生成真實 Courtroom.unity、接上引用、驗證、WebGL build；不會自動覆寫已存在場景。
- `Assets/Scripts/Player/FirstPersonController.cs`：移動／跳躍／指標鎖定；WebGL 必須在瀏覽器驗證使用者手勢。
- `Assets/Scripts/Interaction/PlayerInteractor.cs`：中央射線、3m、遮擋、高亮与提示；所有互動共用 IInteractable。
- `CourtSession.cs`：原型流程及選項回呼，不要把案件邏輯塞入移動控制器。
- `NPC/ICourtDialogueProvider.cs`：未來後端回覆的介面，目前沒有實作 API 呼叫。
- `docker/nginx.conf`：`/api/` 現在刻意回 501；不代表已完成 session 或 AI。

先查 Unity Editor／Web 模組是否真的安裝及授權可用。不得以缺少 Editor 為由偽稱 C# 已通過。可用時執行 CreateScene、ValidateScene、Play 與 BuildWebGL，修正實際錯誤，再測 HTTP 和 Docker。

## 完成證據

請記錄 Editor 版本、建置 exit code、場景驗證結果、實際遊玩測試、遊戲 URL、Docker 驗證結果及 commit。新增 source 或 Dockerfile 不等於可玩遊戲；不能只靠 grep 或自訂假 Unity stubs 宣稱 Unity 編譯通過。
