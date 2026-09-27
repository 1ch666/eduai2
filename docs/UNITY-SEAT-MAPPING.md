# 公開 NPC 座位映射（2026-09-27）

## 已實作

`court-game/Assets/Scripts/Core/CourtSeatLayout.cs` 建立七個明確 seatId：judge-seat、claimant-seat、prosecutor-seat、investigator-seat、counsel-seat、respondent-seat、witness-seat。這是現有五位 NPC 在不同程序下所用的空間資料，不是法律出席資格規則。三種起訴／調查方位置沿用同一側桌位，法律角色仍由伺服器指定。

每個座位具備支持角色檢查及 CameraAnchor、StandAnchor、InteractionAnchor、AccessibilityAnchor、AnimationAnchor。位置沿用既有場景，不下載素材、不儲存案件資訊、不新增 API。這些錨點是空間整合基礎，目前只有 AnimationAnchor 接入 NPC 定位，其餘尚未全部接入玩家／無障礙／互動控制，不算整個程序空間完成。

`NPCInteractable.ApplyPublicProjection` 在已有嚴格快照驗證後，以服務端公開的 roleId 和 seatId 查表。未知座位或不支持角色隱藏人物並拒絕互動，保持原位置，不猜測身分、不移到世界原點。合法換位前關閉該人物的既有特寫，再移动整個 NPC 與 collider，更新 Physics transform；名稱、可見與互動仍遵循公開投影。guest 模式不建立或套用此表，保留舊練習能力。

## 實際驗證

官方 Unity 6000.6.2f1，在既有隔離專案 `outputs/npc-unity62-check` 真實編譯、場景驗證及 Play exit 0。日誌 `outputs/npc-seat-map-play.log` 包含 COURT_SCENE_VALIDATION_PASSED、COURT_PLAY_TESTS_PASSED。新增 Play 斷言：role/seat 查表、拒絕未知／不相容映射、五種錨點存在、人物對齊公開座位、合法換位關閉原特寫、未知座位停止互動且不亂移動；既有 guest／碰撞／手機點擊／對話／證物盒測試同次通過。既知 Editor SearchDatabase 例外仍須區別於遊戲斷言。

## 未完成

## 本機 WebGL 追加驗證

座位映射候選已在本機內嵌 Chromium（127.0.0.1:8792）實測：從已登入的民事法官場次恢復，WebGL 自動至 100%，開始、座位切換走動、Pointer Lock fallback、W 移動、E 接近原告、恢復對話及中文提問均可用；新問題使場次版本 4→5。本機 AI 明確停用，畫面如實顯示 AI_DISABLED，不視為模型回覆成功。

再返回法官座位、切回走動、接近法官桌，瞄準盒子按 E 確實開啟「本案程序」面板，返回 3D 後外側陳述表單恢復；沒有提交程序動作，場次仍 v5。最初瞄準較高時開到法官 NPC，調整向下視角才命中盒子，這是實際最近碰撞體互動，不冒充自動目標選擇。截圖 `outputs/npc-seat-map-procedure-box.png`。

完整四項 Build 已同步倉庫 play；check-build 的 Gzip、loader 配對及大小門檻通過，53 項 Node 測試全部通過。未驗收手機、所有程序／角色、實際重疊衝突、完整證物盒路徑或真實 AI。正式 Worker／Docker 尚待本批發布。

注意：玩家扮演法官時，走到法官桌仍看得到法官 NPC，伺服器目前公開角色表包含該角色。早期座位視角沒看到人物不能證明已排除玩家重複角色；角色佔位／玩家身分一致性仍需後續完成。

- 本批 Release WebGL 已完成（官方 Unity 6000.6.2f1、exit 0，outputs/npc-seat-map-build.log），五項總計 21,278,041 bytes；正式 Worker／Docker 尚待發布。
- 玩家座位鏡頭仍採 CourtPresentation 舊橋接，不是完整伺服器角色→座位映射。
- 缺書記官、獨立原告代理席、完整旁聽／出入口／公告／證物展示區整合；不可把七個邏輯 ID 說成完整法庭。
- 多角色同一物理位置衝突處理、未知角色模型生成、完整 pose/emotion 動畫及角色私有資訊隔離尚待開發。
- 實際模型坐姿、鏡頭遮擋、手機及全角色流程仍待驗證。

下一步：Release WebGL → 真實瀏覽器確認人物與碰撞位置 → 後續完善公開角色與玩家座位契約、程序模式及場景，再逐步替換舊控制。不刪除未有對應驗證的舊能力。
