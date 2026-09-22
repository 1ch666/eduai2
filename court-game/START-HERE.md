# 朋友接手：先看這份

這個資料夾是 Unity 3D 法庭遊戲，不是原本學堂網站的後端。你不必先懂全部程式；先確認能開啟，再一次改一項。

**目前哪些真的通過測試，以 STATUS.md 為準。** 看到程式碼、網址或 Dockerfile，不代表遊戲已成功編譯。線上網址固定是 https://1ch666.github.io/eduai2/play/ 。

## 1. 先拿到專案

安裝 Git，開終端機，在你想放專案的位置執行：

```sh
git clone https://github.com/1ch666/eduai2.git
cd eduai2
git status
```

已經有副本就不要重做 `git init`。更新前先 `git status`；若有未提交內容，先備份或提交自己的修改，不要讓 AI 執行 `git reset --hard`。沒有修改時可用 `git pull --ff-only`。

## 2. 用 Unity 開啟

1. 安裝免費 Unity Hub，用自己的帳號登入。由你確認符合免費 Personal 授權資格並完成授權；不要把帳密交給 AI。
2. 安裝 Unity **6000.3.24f1**，勾選 **Web Build Support**。不同版本先不要擅自升級。
3. Hub 選「Add／加入磁碟中的專案」，選倉庫裡的 **court-game** 資料夾，不是整個 eduai。
4. 等待匯入完成。如果 Console 有紅色錯誤，把第一個錯誤連同上下文貼給 AI；不要只關掉錯誤視窗。
5. 若尚無 `Assets/Scenes/Courtroom.unity`，用上方選單 `EduAI > Create Courtroom Prototype` 建立。已有場景時直接打開；建立器刻意不覆寫它。
6. 按 Play。WASD 移動、滑鼠轉向、Space 跳躍、E 互動、1–4 選擇、Esc 釋放滑鼠。網頁版需點擊遊戲畫面。

電腦操作不變。手機／平板另有左下搖桿、滑動視角、走近後直接點 NPC／物件，以及點選答案；手機不顯示準星。故事為虛構證據判讀練習，不是真正法院程序或法律意見。

## 3. 程式在哪裡

| 想改的內容 | 檔案／資料夾（相對 court-game） |
| --- | --- |
| 移動、跳躍、滑鼠 | `Assets/Scripts/Player/FirstPersonController.cs` |
| 對準物件、距離、E 互動 | `Assets/Scripts/Interaction/PlayerInteractor.cs` |
| 開庭、調查、作答、重玩 | `Assets/Scripts/CourtSession.cs` |
| NPC 對話 | `Assets/Scripts/NPC/NPCInteractable.cs` |
| 題目與提示介面 | `Assets/Scripts/UI/` |
| 初始法庭配置 | `Assets/Editor/CourtProjectBuilder.cs` |
| 實際場景 | `Assets/Scenes/Courtroom.unity`（產生後才存在） |
| 網頁載入画面 | `Assets/WebGLTemplates/Court/index.html` |
| 自動流程檢查 | `Assets/Editor/CourtSmokeTests.cs` |
| 容器與服務設定 | `Dockerfile`、`compose.yaml`、`docker/nginx.conf` |

場景一旦已生成，改建立器不會自動更新已有場景。請在 Unity 編輯場景，或先另存備份，再由 AI 明確說明如何重新產生；不要直接刪掉場景。

## 4. 測試與打包

先用選單 `EduAI > Run Court Smoke Tests` 跑基本流程測試，Console 應出現 `COURT_SMOKE_TESTS_PASSED`。再按 HANDOFF.md 的清單實際遊玩；自動測試不等於滑鼠、碰撞、中文和瀏覽器都通過。

Windows 也可在倉庫根目錄執行（把路徑換成你的 Unity Editor）：

```powershell
python -m venv .court-tools
./.court-tools/Scripts/python.exe -m pip install fonttools==4.60.1
./.court-tools/Scripts/python.exe court-game/tools/subset-font.py
powershell -File .\court-game\tools\build.ps1 -Editor "C:\Program Files\Unity\Hub\Editor\6000.3.24f1\Editor\Unity.exe"
node court-game/tools/check-build.mjs court-game/Builds/WebGL
```

前兩行只需第一次安裝免費字型工具時執行。每次新增文字後重跑 `subset-font.py`；build.ps1 會檢查缺字。也可用 `-Python` 指定已安裝 fonttools 的 Python。不要把整份原始字型再放回 Assets，否則下載量會回升；未來加入任意 AI 文字時則需重新設計完整字型載入，詳見 tools/fonts/README.md。

這會建立缺少的場景、測試並輸出 `court-game/Builds/WebGL/`。失敗看 `court-game/Logs/`；不要將授權檔或完整含敏感資料的紀錄推上 Git。

**不要雙擊生成的 HTML 當作遊戲測試。** WebGL 必須透過 HTTP 伺服器開啟。有 Node.js 的人可在倉庫根目錄執行 `node court-game/tools/serve.mjs`，再開 `http://127.0.0.1:8088/`；Ctrl+C 停止。它只提供 WebGL 成品、只綁本機，不會把整個倉庫公開。先成功建置才會有成品可提供。

## 5. Docker 與部署

若只拿到 Actions 的映像下載包，不需 clone 或 Unity：先讀包內 README.md，再用 compose.image.yaml 啟動。包內 SOURCE_COMMIT.txt 和映像 revision label 可核對版本；更新映像後要重新建立容器。完整說明也在 docker/README.md。

Docker 是運行網站的容器，不是 Unity 編輯器。現有 Docker 預設提供倉庫 `play/` 的壓縮 WebGL；缺少遊戲檔案時建置會失敗。實際測試與映像版本以 STATUS.md 為準。

有 Docker 且符合其使用條款時，在倉庫根目錄：

```sh
docker compose -f court-game/compose.yaml up --build -d
```

瀏覽器開 `http://localhost:8080/play/`（`/` 也支援）。停止（不刪原始碼）：

```sh
docker compose -f court-game/compose.yaml down
```

只測剛建置的 Unity 成品：

```sh
docker build -f court-game/Dockerfile --build-arg WEB_ROOT=court-game/Builds/WebGL -t eduai-court:local .
docker run --rm --read-only --tmpfs /tmp:size=32m,mode=1777 --cap-drop ALL --security-opt no-new-privileges:true -p 127.0.0.1:8080:8080 eduai-court:local
```

发布順序：Unity build 成功 → 本機 HTTP 實測 → 將成品更新到 `play/` → 只提交相關變更並推 `1ch666/eduai2` → 確認線上遊戲 → 重新執行 Actions 的 `Court Docker handoff` → 下載新映像和 SHA256SUMS → 更新 STATUS.md 的來源 commit、測試結果與下載位置。**舊的空白頁 Docker 映像不會自動变成新遊戲。**

GitHub Pages 只放靜態網站，不會運行 Docker、session 或 AI 後端。不要為了部署而開通付費主機。

## 6. 交給 AI 時

把同資料夾的 **給朋友的AI.txt** 全部貼給你的 AI，並告訴它你本機專案資料夾的位置。不要貼 API key、GitHub token、Cookie、Unity 授權檔或密碼。

Session、登入與 AI 目前留給後端人員。`/api/` 回 501 是尚未接線，不是已實作；安全邊界詳見 HANDOFF.md。
