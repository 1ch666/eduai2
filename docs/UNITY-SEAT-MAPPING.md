# 公開 NPC 座位映射（2026-09-27）

## 已實作

`court-game/Assets/Scripts/Core/CourtSeatLayout.cs` 建立七個明確 seatId：judge-seat、claimant-seat、prosecutor-seat、investigator-seat、counsel-seat、respondent-seat、witness-seat。這是現有五位 NPC 在不同程序下所用的空間資料，不是法律出席資格規則。三種起訴／調查方位置沿用同一側桌位，法律角色仍由伺服器指定。

每個座位具備支持角色檢查及 CameraAnchor、StandAnchor、InteractionAnchor、AccessibilityAnchor、AnimationAnchor。位置沿用既有場景，不下載素材、不儲存案件資訊、不新增 API。這些錨點是空間整合基礎，目前只有 AnimationAnchor 接入 NPC 定位，其餘尚未全部接入玩家／無障礙／互動控制，不算整個程序空間完成。

`NPCInteractable.ApplyPublicProjection` 在已有嚴格快照驗證後，以服務端公開的 roleId 和 seatId 查表。未知座位或不支持角色隱藏人物並拒絕互動，保持原位置，不猜測身分、不移到世界原點。合法換位前關閉該人物的既有特寫，再移动整個 NPC 與 collider，更新 Physics transform；名稱、可見與互動仍遵循公開投影。guest 模式不建立或套用此表，保留舊練習能力。

## 實際驗證

官方 Unity 6000.6.2f1，在既有隔離專案 `outputs/npc-unity62-check` 真實編譯、場景驗證及 Play exit 0。日誌 `outputs/npc-seat-map-play.log` 包含 COURT_SCENE_VALIDATION_PASSED、COURT_PLAY_TESTS_PASSED。新增 Play 斷言：role/seat 查表、拒絕未知／不相容映射、五種錨點存在、人物對齊公開座位、合法換位關閉原特寫、未知座位停止互動且不亂移動；既有 guest／碰撞／手機點擊／對話／證物盒測試同次通過。既知 Editor SearchDatabase 例外仍須區別於遊戲斷言。

## 未完成

- 本批尚無新版 WebGL／瀏覽器證據／正式發布或 Docker；線上仍為 b795d7b 的 NPC 可見性版本。
- 玩家座位鏡頭仍採 CourtPresentation 舊橋接，不是完整伺服器角色→座位映射。
- 缺書記官、獨立原告代理席、完整旁聽／出入口／公告／證物展示區整合；不可把七個邏輯 ID 說成完整法庭。
- 多角色同一物理位置衝突處理、未知角色模型生成、完整 pose/emotion 動畫及角色私有資訊隔離尚待開發。
- 實際模型坐姿、鏡頭遮擋、手機及全角色流程仍待驗證。

下一步：Release WebGL → 真實瀏覽器確認人物與碰撞位置 → 後續完善公開角色與玩家座位契約、程序模式及場景，再逐步替換舊控制。不刪除未有對應驗證的舊能力。
