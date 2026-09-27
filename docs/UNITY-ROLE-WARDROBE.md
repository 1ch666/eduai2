# 角色法袍、襯衫領口與領帶（2026-09-27）

## 2026-09-28 追加修復：人物懸空（優先於下列歷史高度方案）

5c95a37 已推送且發布 Worker e745e7fa-9564-4dbd-b9d4-a7d8cef50913；Pages 36332389492、Docker 36332434720 成功，兩個線上來源四檔均逐位元組一致，Docker 六項 SHA256 檢查通過。但使用者回報人物懸空，不能把這份發布當成完整美術驗收。

根因：為越過原本 1.1／1.3m 桌面加入的 .65m 整體上移，同時把腳底抬高 .65m。僅檢查頭高／正面畫面漏掉腳底。SkinnedMeshRenderer.BakeMesh 結果再套用有縮放的 Transform 會在此骨架重複縮放，因此新的接觸測試直接使用原頂點、boneWeights、bindposes 及骨頭世界矩陣計算實際蒙皮位置，而不是誤用 BakeMesh bounds。

修正原始碼：移除 .65m 整體上移；保留已測量的 sit 根骨架 .15 模型單位補償與垂腿姿勢。新增 Core/CourtFurniture.cs，只在 hosted 將桌面配合縮小模型調整為 .68m，新增五把 .36m 座面、有椅背及落地椅腳的簡化木椅。兩個互動盒隨桌面位移，保留原碰撞與互動 component；不改案件、座位權威或資料。套用一次後不累加；舊 guest 場景未被保存／覆寫。

官方 Unity 6000.6.2f1 Scene／Play exit 0（npc-grounded-seat-play.log），新增所有角色三個 sit 時間取樣的腳底距地面小於 .025m、桌面可視、五椅存在、原 actor root 不動與盒子射線測試。量測腳底為約 0～.003m。Release 建置與瀏覽器側面驗證接續，不把離線渲染當成正式遊戲證據。

補充驗收：增加椅腳 collider 下緣接地、座面高度斷言後再次 Play exit 0（npc-grounded-seat-contact-play.log）。Release exit 0，data 15,322,609、wasm 5,869,417、framework 83,199、loader 48,540，含 touch 合計 21,328,937 bytes。新本機來源 localhost:8792 真實瀏覽器完成恢復／載入／走動／側面椅腳觀察／E 開檢察官；error/warn 讀取為空。截圖 outputs/grounded-chair-browser-0928.png；手機真機仍待驗收。

同時發現原本 127.0.0.1 頁面普通 reload 仍讀到舊 Unity 資源，不能把該次畫面算新成品。BuildWebGL 現在完成後 StampWebGL，以四檔內容 SHA256 產生同一個 16 位 revision query；check-build 強制檢查四檔版本與實際雜湊相符，防止缺失、混版及過時標記。這批 revision 為 8f0b2c59f3368fdd。不清空使用者的帳號或瀏覽器資料；HTML 本身的快取傳播仍需注意。

## 2026-09-28 修正版候選（歷史方案，後被上方接地修復取代）

先前只有 .15 模型單位補償仍不足：在真正 Courtroom 場景量測，頭部仍低於 1.1／1.3m 桌面。因此再加入 .65 世界單位椅面補償，僅移動 CharacterModel，不移動互動 root／collider。沿用模型每腿只有一根骨頭，sit 動畫原本把腳底朝前；現在於 LateUpdate 使用 mesh bind pose 恢復垂腿方向，不累積旋轉。離開 sit 由正常動畫控制。

同批修復 CourtPresentation 切入 hosted 時將所有 Text 關閉而連桌機準星一起隱藏的問題；只保留 InteractionUI 下 Crosshair／Controls／InteractionPrompt，沒有重新啟用手機已隱藏的準星。

官方 Unity 6000.6.2f1 Scene／Play exit 0（npc-chair-crosshair-play.log，COURT_PLAY_TESTS_PASSED），包含真實場景各模型 sit 取樣高度、root 不動、重複投影不累加、桌機 HUD 分類與手機 hosted 不重開準星。Editor SearchDatabase 既知例外仍存在，不宣稱零例外。

Release WebGL exit 0（npc-chair-crosshair-build.log）；data 15,323,624、wasm 5,869,160、framework 83,199、loader 48,540，另 touch 5,172 bytes，合計 21,329,695。比已發布 d937c25 的 21,278,041 增加 51,654 bytes（約 0.24%），下載門檻通過。四檔必須一起發布；僅本機候選建置成功不代表線上已更新。實際瀏覽器、推送、部署及 Docker 驗證接續記錄。

本機 Chromium 真實 WebGL 已驗證：恢復成人刑事場次、載入／開始、走動、滑鼠拖曳 fallback、中央準星、三職業服裝、E 開檢察官、中文輸入／送出、版本 1→2 與關閉恢復。AI 明確關閉的本機環境回傳 AI_DISABLED，不冒充正式供應商驗證。此次讀取 browser error/warn 為空。截圖 outputs/wardrobe-crosshair-browser-0928.png。手機真機、所有案件及完整重構仍未驗收。

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
