# EduAI2 遊戲端重構：盤點與遷移提案

盤點日期：2026-09-26。基準：main `79feb8c505e47c630ea2e239823cd2d7374163c8`。
狀態：架構提案，尚未實作新架構或更換遊戲。不得將本文件當成 10/10 驗收。
目標：使用者提供的「EduAI2 10/10 競賽級重構規格」第 0–31 節全部成立；不是只完成建置。

## 1. 盤點來源與目前架構

已閱讀 PLATFORM-STATUS.md、朋友AI續作_完整需求規格.md、SECURITY-REVIEW-2026-09-26.md、court-game/AGENTS.md、STATUS.md、HANDOFF.md，以及 Assets/Scripts 所有 C#、Assets/Editor 所有 C#、兩個 jslib、WebGL template、touch-controls、Packages、ProjectSettings。根目錄 AGENTS.md、court-game/Tests 目前不存在；不可假設它們有測試。現有測試在 Assets/Editor 與 tools。舊狀態文件有多段互相矛盾的歷史，以下以程式為準。

|責任|實際位置與現況|
|---|---|
|程序權威|src/court-rules.ts 的 transition、allowedActions；src/court.ts 的 CourtRoom 每場 SQLite、owner、版本、冪等檢查|
|HTTP／登入邊界|court/court.js 呼叫同源 API，持有 CSRF；瀏覽器管理 HttpOnly cookie。Unity 不取得憑證|
|雲端場次資料|網頁 view；Unity 目前只收到視角、NPC文字等局部資料，沒有單一 CourtClientState|
|Unity 場景|Assets/Scenes/Courtroom.unity；CourtProjectBuilder 建立桌席、5位NPC、證物A、開庭盒、觀眾席與碰撞|
|角色素材|NpcUpgrade 接入 Kenney CC0 三款人物；NpcActorMotion 只有 idle／emote-yes，並非完整情緒／姿勢系統|
|操作|FirstPersonController 同時包含桌機、拖曳fallback、手機、移動及座位；PlayerInteractor 最近命中3m、遮擋、E／觸控|
|NPC UI|NpcDialogueUI 同時負責畫面、IME、對話歷史、雲端ticket、20秒逾時、鏡頭與輸入鎖定|
|橋接|CourtPresentation、Plugins/NpcDialogue.jslib、TouchControls.jslib、template；父頁驗證同源及iframe視窗|
|證物／程序盒|hosted 開 court/game-panels.js 的既有網頁面板，並非 Unity 動態證物模型|
|本機原型|CourtSession、ScriptedNpcDialogue、ChoiceSystem 在 client 判定固定平板案流程／答案；?local=1 保留，不計正式成績|
|舊API adapter|WorkerDialogueProvider 直接 UnityWebRequest /api/ai/ask，未接場景，且 payload 缺目前必要 history；不可作新權威介面|
|測試|CourtSmokeTests／CourtPlayTests 是自訂 Editor 執行測試，不是完整 NUnit EditMode／PlayMode suite；tools 有橋接／觸控／模板測試|
|發布|play/ 為已建置 WebGL；Unity 6000.6.2f1，Release build method 強制 Gzip fallback、Medium stripping、Strip Engine Code。Docker 靜態預覽 API 回501|

本次讀取的成品大小：data 15,282,002；wasm 5,835,099；framework 83,190；loader 48,540 bytes，四項21,248,831；touch-controls 5,172，合計21,254,003。這不是首載／快取／記憶體效能測量。

## 2. 問題與安全差距

1. Hosted 與 local 原型共用場景與腳本；本機判分目前仍打包進遊戲。最終必須將教育練習能力移至伺服器管理的遊客練習，不以「不計排名」合理化 Unity 自己判分。遷移完成前保留舊能力，明示原型，不稱零權威邏輯。
2. courtView 回傳全套既有公開 facts／evidence，沒有逐角色動態可見證物投影；未來不能在前端收到 hidden data 後只隱藏 UI。
3. API 只有 version/requestId 等局部欄位，沒有統一 apiVersion/eventId 與事件序列。requests 是去重結果快取，不是完整歷史：不能假造缺失的初始snapshot、時間或NPC事件來宣稱重播。
4. parent view=p.view 無集中過期回覆拒絕；Unity NPC ticket 校驗不能取代整場快照版本檢查。登出／換帳號／換場次需同時取消請求與清空client副本。
5. 程序 actions 目前為字串；畫面與互動需升級成伺服器提供的 action descriptor。現行有限流程沒有完整合法異議、訊問等動作，須後端增量擴充，不能只加按鈕。
6. seat 座標與角色在 CourtPresentation 寫死，沒有 seat anchors／server mapping；沒有書記官等完整程序位置。
7. NPC 有資料範圍提示与格式檢查，不等於形式化資訊隔離或語意安全。案件生成／NPC／程序對話為不同模型路徑；不得以單一路徑測試代替全部。
8. 特寫只恢復旋轉／FOV與重置輸入，不是完整位置、cursor、movement、selection快照。視窗及手機鍵盤路徑仍需真機。
9. 無正式 replay、全文檢索 transcript、研究 telemetry、server experiment assignment 或競賽demo。載入失敗只有通用訊息，沒有細分記憶體／離線／WebGL或可操作重試。
10. 沒有完整 Chrome／Edge E2E、iOS／Android真機證據、首次／快取時間、FPS與記憶體基準。現有 Docker成功不涵蓋這些。

## 3. 保留與淘汰政策

保留所有既有玩法、入口、中文輸入、碰撞、搖桿、鍵鼠、座位、存檔、AI降級、來源提示、預載入、Docker與授權；不得覆蓋已存在場景或批量刪素材。

預定替換（現在不刪）：CourtSession 本機權威 → server guest practice；WorkerDialogueProvider → 統一 BrowserBridge transport；NpcDialogueUI 混合責任 → presenter/controller/input service；CourtPresentation 硬編座位 → SeatRegistry；散落 view 指派 → 單一版本化 store。保留 serialized GUID 與過渡adapter，直到舊功能對應測試與新成品均通過。

## 4. 新架構（目標，未實作）

Server projection/event → Web shell authenticated transport → validated BrowserBridge → CourtClientState → presenters → Unity world/UI。
玩家操作 → ActionRequest → shell → server validation/transaction/event → snapshot。不可 optimistic 推進程序、證物有效性、分數或判決。

- Core：GameBootstrap、ServiceRegistry、AppState、CourtClientState。只有store reducer可接受伺服器快照；UI不保存可修改權威副本。
- Networking：CourtApiClient、NpcApiClient、ReplayApiClient、TelemetryClient、版本化DTO／validator。WebGL transport由父頁發請求，Unity不讀Cookie/CSRF/secret。不引入新付費服務。
- Court：SessionController／Stage、AllowedAction、Role presenters，訂閱store；網路恢復先讀snapshot，409不自行重算。
- NPC：Entity／Presenter／Dialogue／Emotion／Animation；姿態情緒採白名單映射。不得接收任意Animator參數、prompt、思考或hidden facts。
- Evidence：可見projection DTO，world binder/viewer；支援 image、document、chat、timeline、audio transcript、object/photo、map/diagram、synthetic record、CCTV still。資源固定可信白名單，不允許任意外部URL或HTML。
- Interaction／Player：共享raycast規則；DesktopInput、MobileInput、Motor、SeatController、CameraController。鏡頭存還原包含position/rotation/FOV/cursor/movement/selectedTarget。
- UI：CourtHUD、Transcript、Evidence、Role、Action、Result、Debug。短文案、字幕、字級、對比、reduce motion；web shell可全鍵盤操作。
- Replay：獨立唯讀store與transport，只讀server事件，不呼叫mutation；時間軸jump重新套用記錄快照，不重跑LLM。
- Accessibility：設定只影響顯示與輸入，不影響程序權限。研究overlay與experiment variant均須server能力授權，不能用URL偷開少年旁觀。

## 5. Feature Preservation Matrix

「未遷移」不代表舊能力不存在；所有列均須新系統驗收後才能移除舊實作。

|舊功能|新系統對應|測試方式|是否完成|
|---|---|---|---|
|WASD／跳躍／碰撞|DesktopInput + Motor|Play碰撞、Chrome/Edge鍵鼠|未遷移|
|滑鼠／Pointer Lock／拖曳fallback／ESC|Camera + Input service|真瀏覽器允許／拒絕、重新捕捉|未遷移|
|E與3m遮擋／高亮|InteractionSystem|近遠距、牆、停用物件|未遷移|
|1–4四選項及防重按|AllowedActionPresenter快捷鍵|server派題、一次提交、錯答／重玩|未遷移|
|手機搖桿／滑動／直接點|MobileInput adapter|雙指、cancel、旋轉、背景、實機|未遷移|
|中文IME、400字、對話阻止移動|DialoguePresenter + DOM input|組字、鍵盤縮放、取消、XSS|未遷移|
|NPC雲端對話／歷史／錯誤提示|NpcApiClient + Transcript|關閉後晚回、換角色、同場次恢復|未遷移|
|固定平板遊客練習／重玩|server guest practice +同模板|無帳號完整流程；斷線可查看但不本機判分|未遷移；必要後端能力|
|法官盒／被告證物盒|ActionPanel／EvidenceWorldBinder|hosted開本案而非平板案|未遷移|
|證物／人物近景與關閉|EvidenceViewer + Camera snapshot|所有鏡頭及input欄位一致恢復|未遷移|
|座位／全景／走動|Procedure／Immersive view|不改server stage、少年限制|未遷移|
|六案／年齡／援助／多角色／旁觀|保留server rules、擴充contract|全範本角色、非法組合server拒絕|未遷移|
|陳述／審閱／法官准駁／答題／回饋|動態actions及results|現有合法動作全覆盖、非法409|未遷移|
|登入／CSRF／owner／存檔|同源shell、isolatedstore|跨帳號、登出、reload、斷線|未遷移，不重做帳號|
|AI不可用仍完成、限流|server預寫回覆與程序|401/429/500/逾時/畸形JSON|未遷移|
|語音確認／文字fallback／朗讀|沿用shell語音服務|拒絕、取消、不存音訊|未遷移|
|法律來源／教育聲明／辭典|CitationPresenter|文字、版本、官方來源；不當法律意見|未遷移|
|自動預載0–100%、保留封面|LoadingController|只初始化一次、ready才開始、retry|未遷移|
|全螢幕／返回學堂／Pages路徑|保留shell入口|eduai2/basepath、嵌入、iOSfallback|未遷移|
|壓縮成品／Docker／素材授權|原build +新budgetgate|gzip/wasm/HTTP、Docker實build/run、授權清單|未遷移|

## 6. 遷移計畫與優先級

每批獨立小commit，未就緒的程式不得接管預設入口。

1. P0a：本架構提案與盤點（本批）。
2. P0b：docs/API-CONTRACT-UNITY.md、shared schema／fixtures。明確目前v0和目標v1，不用adapter捏造event。定義snapshot、event、action、NPC、evidence、seat、capabilities、replay與錯誤。
3. P0c：版本化DTO＋CourtClientState＋central transport skeleton；測試舊版、同版矛盾、out-of-order、換場次、duplicate、payload限制。先旁路驗證，不取代現有畫面。
4. P0d：後端可见projection、原子event append、cursor replay、兼容v0；只有新增table/欄位，不reset。部署前另審正式增量資料變動。能力未就緒就禁用新功能，不假裝重播舊歷史。
5. P1a：hosted接上store、動態action／transcript、角色與證物projection；保留舊入口直到矩陣通過。補guest練習API後移除client判分，不丟掉遊客玩法。
6. P1b：場景程序座位、兩種模式、9種證物、12種姿態與鏡頭恢復、聲音/字幕/可及性。
7. P1c：真event replay、research overlay、匿名telemetry opt-in、server A/B、真後端demo及7條端到端測試。
8. P2：Chrome/Edge、iPhone Safari、Android Chrome真機、性能、壓縮及材質/mesh/light/shadow/drawcall預算；不能以桌面觸控模擬代替真機。
9. P3：完整文件、CI、發布與Docker來源／校驗一致，逐條完成稽核。不因有部分green tests就標10/10。

## 7. Rollback

目前恢復基準是79feb8c，舊play/資源維持不變。各批保存來源commit、成品hash、migration前後相容性與API版本。
新client只在server宣告相容能力時啟用；撤回新client可恢復舊入口。後端保留v0 endpoints；新資料表保留，不以drop/reset回滾。不可回到不能讀目前資料的Worker版本。瀏覽器快取採版本資源，不跨build混用loader/data/wasm。
新場景旁路建置，不能在未完成preservation gates時覆寫原Courtroom。移除旧client权威前必须先完成guest替代路径；不让本地旧分数上传作正式成绩。

## 8. 測試與發布策略

- EditMode：DTO/serialization、reducer、API error、stale、evidence/action model；用真正Unity，不用C#stub冒充。
- PlayMode：碰撞、range、occlusion、座位、NPC、特寫還原、觸控、dialogue鎖、stale/duplicate、角色、dynamic actions、transcript、replay。
- Bridge：origin/source/request/session/version、payload大小、惡意欄位、換帳號、晚回覆、iframe reload。
- Chaos：500ms/2s/10s delay、timeout、401/409/429/500、fallback、壞JSON與斷線。重送同id與內容，不建立新id造成雙動作；重試次數有上限，LLM不自動重付費呼叫。
- E2E：Chrome和Edge真WebGL，含login→case→movement→NPC→evidence→stage→result→reload→replay。iOS/Android記錄機型/版本/日期/來源commit/錄影或截圖，不虛填。
- CI：C#compile、EditMode、PlayMode、scene、WebGL、artifact、JS、大小、安全边界分开。沒license顯示未執行，不偽造PASS；允許附真實local evidence。
- 建議初始budget：四項壓縮總量相對基準+5%警告、+10%拒絕（先建立測試再啟用）；首次／cache／FPS／memory／peak／mobile success須量測才定硬門檻，不捏造數字。檢查image、mesh、未用素材、光照與drawcalls，不能犧牲中文字集。

## 9. 完整需求追蹤（所有項目仍須證據）

|原規格節|交付與完成門檻|目前狀態|
|---|---|---|
|0–2|競賽級目標、零client權威、盤點與矩陣|提案；client原型仍有權威邏輯|
|3–4|分層、CourtClientState、正式versioned contract及失敗處理|待實作|
|5–7|完整程序空間、seat anchors、兩模式、桌機/手機全操作|部分原型，待升級/真機|
|8–9|role-bounded entity、NPC欄位與12種deterministic表現|部分NPC，待完整mapping|
|10–11|9類dynamic evidence、可見projection、比較/時間軸/特寫恢復|待實作|
|12–13|server transcript及4類搜尋、descriptor actions|待實作|
|14–15|唯讀replay、research overlay、少年限制|待實作|
|16|字級/字幕/對比/鍵盤/reduce motion/中文/voice optional|部分中文輸入，待完整驗收|
|17–18|10類build/runtime指標、budget及正式loading UX|只有現成壓縮/進度，待其餘|
|19–21|四瀏覽器證據、完整Unity測試、11類chaos|部分測試，未達gate|
|22–24|匿名事件、server分組A/B、12步真demo|待實作|
|25|一致美術與可靠性/UX/可讀性優先|待render/實機驗收|
|26|ARCHITECTURE、API-INTEGRATION、TESTING、MOBILE-TEST、WEBGL-PERFORMANCE、REPLAY、SECURITY-BOUNDARY七份實況文件|待建立|
|27–28|每重要PR九類CI、六類10/10有實測證據|未達標|
|29 T1|成人刑事辯護人→Unity→問證人→證物→合法異議→結束→回饋→Replay|未完成|
|29 T2|錯誤stage提證物被拒且state不變|需新Unity整合E2E|
|29 T3|hidden fact誘導不外洩|需後端隔離與整合測試|
|29 T4|AI unavailable仍全場完成|需完整新流程證據|
|29 T5|iPhone Safari完整核心案件|待真機|
|29 T6|斷線恢复、不重複action|待新transport E2E|
|29 T7|Replay一致事件且不修改正式場次|待實作|
|30–31|按階段小commit、所有舊能力保留、可部署研究用法庭|進行中，不能宣告完成|

### P0b／P0c進度（2026-09-26）

docs/API-CONTRACT-UNITY.md 已建立v1契約；court/protocol.js 已提供嚴格JSON projection／mutation／event驗證，court/client-state.js 提供單一snapshot參考store。5項Node測試通過，涵蓋過期／重複／同版衝突、換場次／登出、畸形欄位、事件缺口與回放store隔離。初次測試發現事件fixture多帶state，已修正；不能放寬validator掩蓋。
這些模組尚未接管court.js或Unity，沒有新增後端v1端點、事件儲存、正式資料表或新WebGL。C# DTO、Unity reducer、transport request correlation／retry、C# parity fixtures仍待完成。矩陣保留未遷移標記，不以JS單元測試當完整重播或遊戲驗收。
下一批：實作Unity DTO／state測試與共享fixtures，再後端事件與可見投影；伺服器尚未發布v1前不開新client能力。
