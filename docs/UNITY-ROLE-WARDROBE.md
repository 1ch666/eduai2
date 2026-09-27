# 角色法袍、襯衫領口與領帶（2026-09-27）

## 已實作的原始碼

使用者要求角色穿對應建模服裝，追加領帶。新增 `Assets/Scripts/NPC/NpcWardrobe.cs`：原創低多邊形衣身、寬袖、袖口、前襟、襯衫／領口、領結位置的領帶結及長領帶幾何。不是只換角色名稱、整件套色或貼一張 UI 圖。沿用已授權的 Kenney 三款人物骨架，SkinnedMeshRenderer 隨 torso / arm / leg 動畫變形。黑袍、角色鑲邊、白襯衫分三個材質區域；無外部模型下载或付費素材。

配色参考：[臺灣高等檢察署「不同的法袍顏色代表什麼職務？」](https://www.tph.moj.gov.tw/4421/4475/4489/25479/)。黑袍，法官藍邊、檢察官紫邊、律師白邊；不是整件紫色。領带為使用者要求的簡化教學造型，未宣稱是制服規則要求的精確裁製規格。

## 身分邊界

- hosted 僅依驗證後的公開 roleId 更新：judge / prosecutor / counsel / claimantCounsel / respondentCounsel。
- 原告、被告、證人、少年、調查官及未明示律師資格的 assistant 不強行穿律師袍。不能把司法協助方式當成公設辯護人資格，也不自行指定綠邊。
- guest 固定練習沿用 Judge / Prosecutor / Lawyer 明確角色對應。进入 hosted 後即由公開投影替換，不因 GameObject 名稱 Prosecutor 而讓民事原告穿檢察官袍。
- 清除／不同步／未知座位時隱藏法袍、清除服裝身分。服裝無 Collider，不更改原有 3m／遮擋／最近物件互動規則。
- 沒有改動程序、資料庫、Secret、權限或 AI 提示詞。顏色不是身分的唯一訊息；現有 NPC 名稱／對話標題仍保留。

## 驗證與尚未完成

官方 Unity 6000.6.2f1 已讀取三款模型實際骨架及 mesh 尺寸，產生並檢視四轮渲染，修正早期上衣及袖口露出。最新離線預覽見隔離專案 `Logs/wardrobe-preview.png`，來源 `CourtWardrobePreview.Render`，不保存／覆蓋 Courtroom 場景。圖中從左至右為法官、檢察官、律師；頭型是素材示例，不規定職業性別或年齡。

未加領帶版本的真實 Scene／Play exit 0（outputs/npc-wardrobe-play.log）。最新領帶版 Scene／Play 亦 exit 0（outputs/npc-wardrobe-tie-play.log），包含服裝初始化、三材質蒙皮模型綁定、合法身分／一般人物不穿袍、公開證人換律師換裝、未知映射撤裝、不新增 collider 與既有遊戲回歸。Editor 既知 SearchDatabase 例外仍存在。

尚未宣稱正式發布、WebGL 服裝渲染、手機、全部坐姿／手勢穿模及完整美術驗收。模型是大頭比例的教育示意，不是寫實法院制服。領口可能被長鬍鬚遮住，屬模型造型；完整動作與場景配合仍需後續檢視。網格是簡化骨架蒙皮，不是布料物理模擬。

下一步：最新 Play 結果 → Release WebGL → 比較大小 → 真實 browser 檢查法庭中的法袍／坐姿／對話與互動 → 發布既有平台 → 重建 Docker。不得把單張離線渲染當成手機／線上驗收。

## WebGL 實測發現與修正（尚未發布）

第一份含法袍的 Release WebGL 建置 exit 0，五項資源共 21,325,583 bytes，下載門檻通過；53 項 Node 測試通過。本機 Worker 8792 已透過真實瀏覽器建立成人刑事／法官測試場次、恢復、載入、開始、切全景／走動，當次讀取的 error / warn 為空。服裝確實進入 WebGL，不是只在 Editor 出現。

但瀏覽器觀察到坐姿使角色過低，桌面遮住大部分法袍，法官幾乎看不到，因此沒有發布該候選。截圖 outputs/wardrobe-seated-height-defect.png。官方 Unity 再量測三款模型：以 scale=2.7，sit 令 head y 由 .9268 變 .5218，落差 .405，即 .15 模型單位。

NpcActorMotion 現在對 sit 補償此已量測的根骨架下降，只移動視覺模型，保留 NPC root / collider / 伺服器 seat mapping。離開坐姿或失同步恢復精確基準；重複快照不累加。新增真實 Play 斷言已通過（outputs/npc-seated-height-play.log，Scene / Play exit 0）。高度修正版仍需新的 WebGL 與瀏覽器驗證，前一份成品不能算已包含修正。
