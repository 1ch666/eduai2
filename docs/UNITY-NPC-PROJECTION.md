# Unity 公開 NPC 投影接線（2026-09-27）

## 原始碼實作範圍

`CourtRuntimeState` 在嚴格快照解析及 reducer 接受後，將最新公開 NPC 投影套到名稱對應的既有角色。舊快照只保留目前 store，不以舊 visible 值重啟角色；未同步、清除場次或同步失效時停止 NPC 互動。

`NPCInteractable` 只保存顯示名稱、互動旗標與原 Renderer enabled 狀態，不另存案件 facts、私有資訊或可修改的快照。角色不在公開名單或 visible=false 時隱藏 Renderer；可見且 interactable 且 requestState 非 pending 時才允許互動。原本停用的 primitive Renderer 不因恢復而被重新啟用。保留物理 Collider 的遮擋，不讓隱藏角色變成穿透互動入口。

桌面射線與手機點擊共用 `PlayerInteractor.AllowedInCurrentMode`；直接呼叫 NPC.Interact 或對話 Open 也檢查同一旗標。已開啟的角色若被撤銷互動資格，`CloseFor` 關閉其對話；其他角色／證物面板不被任意關閉。既有關閉邏輯取消 UI ticket、恢復輸入與鏡頭；未在此處加入 HTTP、CSRF、金鑰或程序判定。

首次進入 hosted 視角先關閉場景預設 NPC，等待真實公開快照；guest 固定練習原有角色、對話與調查繼續保留。

## 實際驗證

官方 Unity 6000.6.2f1、既有隔離副本 `outputs/npc-unity62-check`，真實編譯與 Play 測試結束碼 0。日誌 `outputs/npc-public-projection-play.log` 同時包含 `COURT_SCENE_VALIDATION_PASSED` 及 `COURT_PLAY_TESTS_PASSED`。

新增 `CourtPlayTests.TestPublicActors` 覆蓋：未同步拒絕、公開角色啟用、未列角色停用、可見 NPC 開啟對話、撤銷關閉對話／隱藏所有 Renderer、舊快照不能恢復角色、新快照恢復模型與名稱、同步失效停止互動、同一有效快照恢復可用、清除場次停用。原有 guest、碰撞、觸控、證物、鏡頭與法庭盒測試同次執行通過。

日誌仍有既知 `UnityEditor.Search.SearchDatabase` 的 ArgumentOutOfRangeException；不是本批測試斷言失敗，也不能稱 Editor 零例外。

## 建置與待完成

Release WebGL 已在同一隔離副本開始建置，日誌 `outputs/npc-public-projection-build.log`；目前尚未確認成功、未替換 `play/`、未部署、未重建本批 Docker。必須先取得 exit 0、核對成品、實際瀏覽器驗證再發布。

這不是完整 NPC presenter 完成：seatId 的實體座位綁定、姿態／情緒動畫、speakingState 表現、完整角色私有資料隔離仍待後續。只支援現有場景的固定 NPC ID，未知伺服器角色不會自動生成模型；不得用這批顯示閘門代替伺服器資訊隔離。手機真機、WebGL 斷線時角色隱藏／恢復、全角色流程仍未驗收。
