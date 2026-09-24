// Practice question bank for civics, law and economics.
// Every question records concept, difficulty, version, correct answer, explanation and source.
// The correct index is NEVER sent to the client before answering.
export const QUESTION_VERSION = 'tw-curriculum-2026-09-23';
export type Subject = 'civics' | 'law' | 'economics';
export type PracticeQuestion = {
  id: string; subject: Subject; concept: string;
  difficulty: 1 | 2 | 3; version: string;
  text: string; answers: string[]; correct: number;
  explanation: string; source: string;
};

export const QUESTIONS: PracticeQuestion[] = [
  // ── 法律 ──────────────────────────────────────────────────
  { id:'law-burden-1', subject:'law', concept:'civil-burden-of-proof', difficulty:2, version:QUESTION_VERSION,
    text:'民事訴訟中，主張對方違約的原告，原則上須做什麼？',
    answers:['由被告自行證明沒有違約','由原告提出支持主張的事實與證據','由法官主動蒐集所有證據','不需任何人舉證'],
    correct:1,
    explanation:'民事訴訟採「主張者舉證」原則（民事訴訟法第277條）：原告主張被告違約，須提出支持該主張的事實與證據，而非由被告自證清白。',
    source:'高中公民與社會教材；民事訴訟法第277條' },
  { id:'law-hearsay-1', subject:'law', concept:'evidence-types', difficulty:2, version:QUESTION_VERSION,
    text:'「我聽別人說他昨天偷了東西」，這句話在法庭上屬於哪種性質？',
    answers:['直接證據，可直接證明犯罪','傳聞證據，需查證原始來源','物證，法院必須採信','書面證據，效力最高'],
    correct:1,
    explanation:'轉述他人說法而非親眼見聞，屬傳聞（間接）證據，不能直接認定事實，須查證陳述的原始來源。',
    source:'高中公民與社會教材；刑事訴訟法傳聞法則相關條文' },
  { id:'law-innocence-1', subject:'law', concept:'presumption-of-innocence', difficulty:1, version:QUESTION_VERSION,
    text:'刑事訴訟中，「無罪推定原則」的意思是？',
    answers:['被告須自行證明無罪','被告在有罪確定前推定為無罪','有人指控即視為有罪','法官可依經驗直接認定'],
    correct:1,
    explanation:'無罪推定（刑事訴訟法第154條）：被告未經合法程序審判確定有罪前應被視為無罪，舉證責任在檢察官。',
    source:'中華民國憲法第8條；刑事訴訟法第154條；高中公民與社會教材' },
  { id:'law-juvenile-1', subject:'law', concept:'juvenile-protection', difficulty:2, version:QUESTION_VERSION,
    text:'少年事件處理法的主要目的是什麼？',
    answers:['盡快關押觸法少年以保護社會','以健全少年身心發展與保障其健全成長為優先','程序與成人刑事完全相同','由家長代替少年受罰'],
    correct:1,
    explanation:'少年事件處理法第1條：以保護處分優先，兼顧程序權利，目的在健全少年身心，而非單純懲罰。',
    source:'少年事件處理法第1條；高中公民與社會教材' },
  { id:'law-civil-criminal-1', subject:'law', concept:'civil-criminal-distinction', difficulty:2, version:QUESTION_VERSION,
    text:'下列何者最能區分民事訴訟與刑事訴訟？',
    answers:['民事由法院處理，刑事由警察處理','民事解決私人間權利義務爭議，刑事由國家追究犯罪責任','民事判決一定比刑事嚴重','民事必需律師，刑事不需要'],
    correct:1,
    explanation:'民事訴訟解決私人間財產、侵權等爭議；刑事訴訟是國家代表社會追究犯罪行為，兩者目的、程序與法律效果均不同。',
    source:'高中公民與社會教材；民事訴訟法與刑事訴訟法立法目的' },
  { id:'law-legalaid-1', subject:'law', concept:'legal-aid', difficulty:3, version:QUESTION_VERSION,
    text:'關於法律扶助制度，下列何者正確？',
    answers:['任何人都能免費取得律師協助，不需審查','資力不足且符合條件者可申請核准後獲律師協助','法律扶助只限刑事案件','律師可自行決定是否提供，不需申請'],
    correct:1,
    explanation:'法律扶助針對資力不足的當事人，須向法律扶助基金會申請並審查核准，適用於民事、刑事、行政等多種案件。',
    source:'法律扶助法；高中公民與社會教材' },
  { id:'law-causation-1', subject:'law', concept:'causation', difficulty:3, version:QUESTION_VERSION,
    text:'民事損害賠償成立，通常需要具備哪三個要素？',
    answers:['行為人的職業、受害人的年齡、損害金額','加害行為、損害結果、兩者間的因果關係','只需有損害結果即可','只要被告在場就可主張賠償'],
    correct:1,
    explanation:'民事侵權損害賠償須具備：加害行為（作為或不作為）、損害結果（實際損害）、兩者之間的相當因果關係，缺一不可。',
    source:'民法第184條；高中公民與社會教材' },
  { id:'law-contract-1', subject:'law', concept:'contract-formation', difficulty:2, version:QUESTION_VERSION,
    text:'依民法規定，契約成立的基本要件是？',
    answers:['一方提出要約，對方在有效期間內作出承諾','只需書面簽名即可','須經公證人認證才生效','必須有律師在場見證'],
    correct:0,
    explanation:'契約由要約（一方表示願意受拘束的意思）和承諾（他方同意）兩個意思表示合致而成立（民法第153條）。書面或公證並非一般契約成立的必要條件。',
    source:'民法第153條；高中公民與社會教材' },
  { id:'law-copyright-1', subject:'law', concept:'intellectual-property', difficulty:2, version:QUESTION_VERSION,
    text:'著作權在著作完成時即自動發生，不需要：',
    answers:['向主管機關申請登記','讓他人知道','公開發表','有書面記錄'],
    correct:0,
    explanation:'依著作權法第10條，著作人於著作完成時即享有著作權，不須向任何機關申請或登記，此稱「創作保護主義」。',
    source:'著作權法第10條；高中公民與社會教材' },
  { id:'law-consumer-1', subject:'law', concept:'consumer-protection', difficulty:2, version:QUESTION_VERSION,
    text:'消費者依消費者保護法，對企業經營者提出的商品瑕疵損害賠償，採取何種舉證原則？',
    answers:['消費者須自行舉證商品有瑕疵且因果關係成立','企業經營者須舉證商品無瑕疵（舉證責任倒置）','由法院職權調查，雙方均不需舉證','由主管機關先行認定'],
    correct:1,
    explanation:'消費者保護法採「舉證責任倒置」：消費者只需證明受有損害，舉證產品安全的責任在企業經營者，以平衡雙方資訊不對等。',
    source:'消費者保護法第7條；高中公民與社會教材' },
  { id:'law-agency-1', subject:'law', concept:'legal-representation', difficulty:3, version:QUESTION_VERSION,
    text:'未成年人（7歲以上）獨自簽訂的買賣契約，在法律上的效力為何？',
    answers:['完全無效，須重新簽訂','效力未定，須經法定代理人承認後才生效','完全有效，與成年人相同','依契約金額決定是否有效'],
    correct:1,
    explanation:'依民法第77條，限制行為能力人（7歲以上未成年）所為之法律行為，須經法定代理人之允許或事後承認；未允許或未承認時，效力未定。',
    source:'民法第77條；高中公民與社會教材' },
  { id:'law-tort-1', subject:'law', concept:'tort-liability', difficulty:2, version:QUESTION_VERSION,
    text:'甲故意毀損乙的財物，乙可依下列哪個法律請求損害賠償？',
    answers:['刑法——提起刑事告訴要求賠償','民法侵權行為——向甲請求賠償損失','行政訴訟——向法院提起行政訴訟','消費者保護法——向主管機關申訴'],
    correct:1,
    explanation:'民法第184條規定：因故意或過失不法侵害他人之權利者，負損害賠償責任。乙應提民事侵權訴訟請求賠償。刑事程序追究刑責，但不直接賠償被害人財損（須另附帶民事）。',
    source:'民法第184條；高中公民與社會教材' },
  { id:'law-appeal-1', subject:'law', concept:'judicial-remedy', difficulty:2, version:QUESTION_VERSION,
    text:'對第一審法院判決不服時，當事人可向哪個法院提出救濟？',
    answers:['向同一法院重新審判','向上級法院提起上訴','向行政院申訴','向監察院陳情'],
    correct:1,
    explanation:'我國採三級三審制：對第一審（地方法院）判決不服，可向第二審（高等法院）提起上訴；對第二審判決不服，再向第三審（最高法院）上訴。',
    source:'刑事訴訟法第344條；民事訴訟法第437條；高中公民與社會教材' },
  // ── 公民 ──────────────────────────────────────────────────
  { id:'civics-rights-1', subject:'civics', concept:'fundamental-rights', difficulty:1, version:QUESTION_VERSION,
    text:'依中華民國憲法，下列哪項是人身自由保障的核心內容？',
    answers:['人民可隨時拒繳任何稅款','人民非依法定程序不得逮捕、拘禁、審問、處罰','人民享有無限制的言論自由','政府機關不需授權即可搜查'],
    correct:1,
    explanation:'憲法第8條保障人身自由：人民非依法定程序不得逮捕、拘禁、審問或處罰，確保國家公權力有明確程序限制。',
    source:'中華民國憲法第8條；高中公民與社會教材' },
  { id:'civics-due-process-1', subject:'civics', concept:'due-process', difficulty:2, version:QUESTION_VERSION,
    text:'「正當法律程序」在法治國家的核心意義是？',
    answers:['多數人同意即可任意限制人民權利','國家限制人民自由須符合法定程序且有正當理由','程序只是形式，結果正確即可','只有法院需遵守程序'],
    correct:1,
    explanation:'正當法律程序要求國家行使公權力時須依合法程序、公平聽證與比例原則，保障人民不受任意對待，是法治國家的核心。',
    source:'中華民國憲法；司法院大法官解釋；高中公民與社會教材' },
  { id:'civics-separation-1', subject:'civics', concept:'separation-of-powers', difficulty:2, version:QUESTION_VERSION,
    text:'三權分立的主要目的是？',
    answers:['讓三機關互相競爭看效率','透過立法、行政、司法三權制衡，防止權力集中與濫用','確保所有政策由法院最終決定','讓行政統一指揮所有部門'],
    correct:1,
    explanation:'三權分立將國家權力分散於立法、行政、司法三機關並設計互相制衡機制，目的是防止任一機關濫用權力，保障人民自由與權利。',
    source:'中華民國憲法；高中公民與社會教材' },
  { id:'civics-election-1', subject:'civics', concept:'election-system', difficulty:2, version:QUESTION_VERSION,
    text:'台灣立法委員選舉採用的制度是？',
    answers:['單一選區制，每區選出多名','單一選區兩票制（區域＋不分區）','完全比例代表制','多數決複數選區制'],
    correct:1,
    explanation:'立法委員選舉採「單一選區兩票制」：一票投區域候選人（單一選區，相對多數當選），一票投政黨（依得票比例分配不分區席次），兼顧區域代表與比例原則。',
    source:'公職人員選舉罷免法；高中公民與社會教材' },
  { id:'civics-local-1', subject:'civics', concept:'local-autonomy', difficulty:2, version:QUESTION_VERSION,
    text:'地方自治的核心意義是？',
    answers:['地方政府可以不遵守中央法規','地方居民透過選舉自行管理地方公共事務','地方可以獨立對外締結國際條約','中央政府完全不干預地方'],
    correct:1,
    explanation:'地方自治指地方居民透過選舉產生代表，依法自行處理地方公共事務，是民主政治的重要基礎；但地方仍須遵守憲法與中央法令。',
    source:'地方制度法；中華民國憲法；高中公民與社會教材' },
  { id:'civics-remedy-1', subject:'civics', concept:'administrative-remedy', difficulty:3, version:QUESTION_VERSION,
    text:'人民對行政機關的處分不服，正確的行政救濟順序通常是？',
    answers:['直接到法院提行政訴訟','先提訴願，對訴願結果不服再提行政訴訟','向立法院陳情，由立委協調','向總統府申訴，請求特赦'],
    correct:1,
    explanation:'依訴願法與行政訴訟法，行政救濟通常先提訴願（向上級機關或原機關）；對訴願決定不服，再向行政法院提起行政訴訟，是目前主要的二階段救濟途徑。',
    source:'訴願法第1條；行政訴訟法；高中公民與社會教材' },
  { id:'civics-media-1', subject:'civics', concept:'media-literacy', difficulty:2, version:QUESTION_VERSION,
    text:'媒體素養的核心能力之一是？',
    answers:['相信所有媒體報導都完全客觀','能辨識資訊來源、分析報導立場並查核事實','只閱讀政府官方媒體','拒絕使用任何社群媒體'],
    correct:1,
    explanation:'媒體素養強調主動思辨：辨識媒體背後的立場與利益、比對多方來源、查核事實（fact-checking），避免被假新聞或片面報導影響判斷。',
    source:'高中公民與社會教材；媒體素養教育課程綱要' },
  { id:'civics-ngo-1', subject:'civics', concept:'civil-society', difficulty:2, version:QUESTION_VERSION,
    text:'公民社會（civil society）中，NGO（非政府組織）的主要特徵是？',
    answers:['由政府直接設立並控管','獨立於政府和企業之外，以公共利益為目的','以營利為主要目的','成員必須是政府官員'],
    correct:1,
    explanation:'NGO 是非政府、非營利的組織，獨立運作，通常以倡議公共議題、提供服務或推動社會變革為目的，是公民社會參與公共事務的重要形式。',
    source:'高中公民與社會教材；聯合國相關文件' },
  // ── 經濟 ──────────────────────────────────────────────────
  { id:'econ-supply-demand-1', subject:'economics', concept:'supply-demand', difficulty:1, version:QUESTION_VERSION,
    text:'當某商品市場需求增加而供給不變時，通常會發生什麼？',
    answers:['價格下降，數量減少','價格上升，均衡數量增加','價格不變，只有數量變化','供給自動減少以維持價格'],
    correct:1,
    explanation:'需求增加（需求曲線右移）在供給不變下，均衡價格上升、均衡數量增加，是市場價格機能的基本原理。',
    source:'高中經濟學教材；供給需求均衡分析' },
  { id:'econ-opportunity-cost-1', subject:'economics', concept:'opportunity-cost', difficulty:2, version:QUESTION_VERSION,
    text:'小明用2小時打工賺300元，但放棄了念書準備考試。這2小時打工的機會成本是？',
    answers:['零，因為賺到錢了','打工賺到的300元','放棄念書所損失的潛在利益（例如考試提分帶來的長遠收益）','交通費'],
    correct:2,
    explanation:'機會成本是做一選擇所放棄的次佳選擇之價值。選擇打工就放棄念書，機會成本是念書帶來的潛在收益，而非賺到的金額本身。',
    source:'高中經濟學教材；機會成本與選擇' },
  { id:'econ-externality-1', subject:'economics', concept:'market-failure', difficulty:3, version:QUESTION_VERSION,
    text:'工廠排放廢水污染河川卻不需付出代價，在經濟學上稱為？',
    answers:['完全競爭市場','外部性（負外部成本）','規模經濟','壟斷利潤'],
    correct:1,
    explanation:'外部性是市場失靈的一種：生產或消費行為對未參與交易的第三者造成影響，卻未反映在市場價格中。污染河川是典型的負外部成本。',
    source:'高中經濟學教材；市場失靈與政府干預' },
  { id:'econ-gdp-1', subject:'economics', concept:'gdp-growth', difficulty:2, version:QUESTION_VERSION,
    text:'GDP（國內生產毛額）衡量的是什麼？',
    answers:['一國所有居民的海外所得總和','一定期間內一個國家境內生產的所有最終商品與服務的市場價值','政府的稅收總額','一國所有企業的利潤加總'],
    correct:1,
    explanation:'GDP 是衡量一個國家（地區）在特定期間內，境內（不論生產者國籍）所生產的所有最終商品與服務的市場總價值，是衡量經濟規模與成長的主要指標。',
    source:'高中經濟學教材；行政院主計總處統計說明' },
  { id:'econ-inflation-1', subject:'economics', concept:'inflation-deflation', difficulty:2, version:QUESTION_VERSION,
    text:'通貨膨脹（inflation）對持有現金的人的影響是？',
    answers:['現金實質購買力上升，對持現金者有利','現金實質購買力下降，因為物價上漲了','沒有任何影響','現金面額會自動調整'],
    correct:1,
    explanation:'通貨膨脹代表物價普遍上漲，同樣金額的現金能買到的東西變少，即實質購買力下降。通膨對債務人較有利（還款負擔輕），對持現金或固定收益者不利。',
    source:'高中經濟學教材；中央銀行貨幣政策說明' },
  { id:'econ-monetary-1', subject:'economics', concept:'monetary-policy', difficulty:3, version:QUESTION_VERSION,
    text:'中央銀行提高利率，通常會產生什麼效果？',
    answers:['刺激消費與投資，促進經濟成長','抑制借貸與消費，有助降低通膨但可能減緩成長','直接增加政府稅收','讓股市立即上漲'],
    correct:1,
    explanation:'升息使借貸成本上升，抑制企業投資和消費者借款，進而降低總需求、抑制通膨；但也可能減緩經濟成長。這是緊縮性貨幣政策的典型工具。',
    source:'高中經濟學教材；中央銀行政策說明' },
  { id:'econ-fiscal-1', subject:'economics', concept:'fiscal-policy', difficulty:3, version:QUESTION_VERSION,
    text:'政府在景氣衰退時增加公共支出（如基礎建設），屬於哪種財政政策？',
    answers:['緊縮性財政政策','擴張性財政政策','中性財政政策','貨幣政策'],
    correct:1,
    explanation:'擴張性財政政策：政府增加支出或減稅，以刺激總需求、提振景氣。景氣衰退時採擴張政策，景氣過熱時採緊縮（減支出或加稅），這是「自動穩定機制」之外的主動干預。',
    source:'高中經濟學教材；財政部政策說明' },
  { id:'econ-trade-1', subject:'economics', concept:'international-trade', difficulty:2, version:QUESTION_VERSION,
    text:'「比較利益法則」說明國際貿易的基礎是？',
    answers:['只有絕對生產效率最高的國家才能出口','各國專注生產機會成本相對較低的商品再互相交換，雙方都能受益','貿易一定造成一國受益另一國受損','政府應完全禁止進口保護本國產業'],
    correct:1,
    explanation:'比較利益（comparative advantage）：即使一國在所有商品生產上都佔絕對優勢，只要各自專注生產機會成本較低的商品再交換，雙方都能消費到更多，這是自由貿易的理論基礎。',
    source:'高中經濟學教材；大衛・李嘉圖比較利益理論' }
];

export const CONCEPTS = [...new Set(QUESTIONS.map(q => q.concept))];

// ── Concept reinforcement guides ─────────────────────────────────────────────
// Pre-written short explanations for each concept; no AI needed.
// Used by GET /api/practice/reinforce to guide students after wrong answers.
export type ConceptGuide = {
  concept: string; title: string; subject: Subject;
  summary: string;         // 2-3 sentences
  commonErrors: string[];  // typical mistakes
  keyPoints: string[];     // things to remember
};

export const CONCEPT_GUIDES: Record<string, ConceptGuide> = {
  'civil-burden-of-proof': {
    concept:'civil-burden-of-proof', title:'民事舉證責任', subject:'law',
    summary:'民事訴訟中，主張某事實的人通常要負責提出證據（民事訴訟法第277條）。法院不會主動為當事人蒐集有利證據。',
    commonErrors:['以為只要提告就會贏','誤認為被告要先自證清白','混淆民事與刑事的舉證標準'],
    keyPoints:['主張者舉證：你主張什麼事實，就要提出支持的證據','對方主張不實，也應由主張方舉證，而非要求你「證明自己沒做」','舉證不足時，主張無法成立']
  },
  'evidence-types': {
    concept:'evidence-types', title:'直接證據與傳聞證據', subject:'law',
    summary:'直接證據是當事人親眼見聞的事實；傳聞證據是轉述他人說法，效力較弱，需查證原始來源才能使用。',
    commonErrors:['把「聽說」等同於「親眼看到」','認為傳聞不能當作任何參考','混淆物證與證人陳述'],
    keyPoints:['直接證據：自己親眼、親耳感知的事實','傳聞：轉述別人說的話，不能直接認定事實','一份證據能證明什麼、不能證明什麼，都要分別釐清']
  },
  'presumption-of-innocence': {
    concept:'presumption-of-innocence', title:'無罪推定原則', subject:'law',
    summary:'刑事訴訟中，被告在有罪判決確定前，法律上視為無罪（刑事訴訟法第154條）。舉證責任在國家（檢察官），不在被告。',
    commonErrors:['認為被逮捕或起訴就等於有罪','認為被告保持沉默就表示心虛','認為社會輿論可以取代法院判決'],
    keyPoints:['法院宣判有罪確定前：法律上是無罪的','行使緘默權是被告的合法選擇，不得因此不利認定','檢察官要拿出足夠證據，而非被告自清']
  },
  'juvenile-protection': {
    concept:'juvenile-protection', title:'少年事件處理法精神', subject:'law',
    summary:'少年事件以保護、教育為優先，而非懲罰（少年事件處理法第1條）。程序強調釐清事實、了解背景，並討論適當支持措施。',
    commonErrors:['認為少年程序就是縮小版的成人刑事程序','誤以為歸還物品或道歉後就不需調查','以為有輔導方案就代表已認罪'],
    keyPoints:['保護事件重在健全成長，非懲罰','事實釐清與支持措施是分開的兩件事','少年有陳述與程序保障的權利']
  },
  'civil-criminal-distinction': {
    concept:'civil-criminal-distinction', title:'民事與刑事的區別', subject:'law',
    summary:'民事訴訟解決私人間的財產或侵權爭議；刑事訴訟是國家代表社會追究犯罪行為。兩者可以並行，但目的、程序和效果都不同。',
    commonErrors:['以為民事輸了就等同於刑事有罪','認為刑事判無罪就代表民事也不用賠','誤以為同一件事只能選一種訴訟'],
    keyPoints:['民事：私人 vs 私人，解決賠償或履約問題','刑事：國家 vs 被告，追究刑事責任','同一事件可以同時有民事索賠和刑事告訴']
  },
  'legal-aid': {
    concept:'legal-aid', title:'法律扶助制度', subject:'law',
    summary:'法律扶助基金會針對資力不足且有需求的當事人提供律師協助，適用於民事、刑事、行政等多種案件，須申請審查核准。',
    commonErrors:['以為法律扶助適用所有人且不需審查','混淆法律扶助與指定辯護（僅限刑事被告特定情形）','以為只有刑事案件才能申請'],
    keyPoints:['申請→審查→核准：有一套程序，不是自動取得','民事、刑事、行政都可能適用，依個案而定','法院指定辯護（刑事）≠ 法律扶助，兩者制度不同']
  },
  'causation': {
    concept:'causation', title:'侵權行為的因果關係', subject:'law',
    summary:'民事損害賠償需要三個要素同時成立：加害行為、損害結果、兩者之間的相當因果關係。缺少任一要素就無法成立。',
    commonErrors:['以為有損害就一定有人要賠','認為「在場」等於「造成損害」','忽略行為與損害之間的因果連結'],
    keyPoints:['要同時有：行為＋損害＋因果關係，三者缺一不可','「相當因果關係」：依一般經驗判斷，該行為通常會造成該損害','損害金額再大，若無因果關係，也無法主張賠償']
  },
  'fundamental-rights': {
    concept:'fundamental-rights', title:'憲法基本人身自由', subject:'civics',
    summary:'憲法第8條保障人身自由：人民非依法定程序，不得逮捕、拘禁、審問或處罰。這是防止國家任意剝奪人身自由的根本保障。',
    commonErrors:['以為警察可以無限期拘留任何人','認為被帶走問話就等於被拘禁','誤以為政府想怎樣就能怎樣'],
    keyPoints:['人身自由是受憲法直接保障的基本權利','限制需有法律依據並符合正當程序','非法拘禁是違憲行為，當事人有救濟管道']
  },
  'due-process': {
    concept:'due-process', title:'正當法律程序', subject:'civics',
    summary:'正當法律程序要求國家限制人民權利時，須有法律授權、符合程序正義（公平聽證、告知理由等），且手段與目的要符合比例原則。',
    commonErrors:['以為結果正確就不必在乎程序','認為緊急情況下可以完全不遵守程序','誤以為程序是阻礙效率的形式主義'],
    keyPoints:['程序正義本身就是重要的價值，不只是手段','聽證、告知理由、給予陳述機會，都是程序的核心','違反正當程序，即使結果正確，仍可能違憲或違法']
  },
  'separation-of-powers': {
    concept:'separation-of-powers', title:'三權分立與制衡', subject:'civics',
    summary:'立法、行政、司法三權各有職掌，且互相制衡。立法院制定法律、監督行政；行政院執行政策；司法院解釋憲法、審理案件。',
    commonErrors:['以為三權是完全獨立毫不往來','認為行政院可以直接命令法院','誤以為多數決就能無限擴張行政權力'],
    keyPoints:['分立：三個機關各有專屬職權','制衡：一個機關能對另一個機關踩剎車','目的：防止任何一方濫用權力，保障人民自由']
  },
  'supply-demand': {
    concept:'supply-demand', title:'供給與需求', subject:'economics',
    summary:'市場價格由供給與需求的均衡決定。需求增加或供給減少，價格通常上升；反之則下降。這是市場資源配置的核心機制。',
    commonErrors:['混淆「需求量變動」和「需求本身移動」','以為價格上升一定是供給商操縱','誤以為均衡一定對社會最有利'],
    keyPoints:['需求曲線右移（需求增加）→ 均衡價格上升、數量增加','供給曲線左移（供給減少）→ 均衡價格上升、數量減少','市場均衡是供給方和需求方都願意交易的點']
  },
  'opportunity-cost': {
    concept:'opportunity-cost', title:'機會成本', subject:'economics',
    summary:'做出任何選擇都意味著放棄其他選項。機會成本是你放棄的「次佳選擇的價值」，不是貨幣成本，也不是所有放棄選項的總和。',
    commonErrors:['把機會成本和金錢成本混淆','以為機會成本是所有放棄選項的總和','忽略時間、精力等非金錢的機會成本'],
    keyPoints:['機會成本 = 次佳選擇的價值（只有一個，不是加總）','選擇A的機會成本是放棄的B，不是放棄的B+C+D','即使某件事「免費」，時間也有機會成本']
  },
  'market-failure': {
    concept:'market-failure', title:'市場失靈與外部性', subject:'economics',
    summary:'市場有時無法有效分配資源，例如外部性（污染）、公共財、資訊不對稱等，這時政府可能需要介入。外部性是行為對第三者的影響未被市場價格反映。',
    commonErrors:['認為市場永遠是最有效率的，不需政府介入','把負外部性和稅收混淆','以為只有環境污染才算外部性'],
    keyPoints:['負外部性：行為產生社會成本但不由行為者承擔（如污染）','正外部性：行為產生社會利益但行為者得不到全部回報（如教育）','政府工具：課稅、補貼、法規等，目的是讓外部成本/效益內部化']
  },
  'contract-formation': {
    concept:'contract-formation', title:'契約成立要件', subject:'law',
    summary:'契約由「要約」與「承諾」兩個意思表示合致而成立（民法第153條）。要約是拘束性的邀請，承諾必須在有效期間內完全同意要約內容。',
    commonErrors:['以為一定要書面才算契約','以為口頭契約無效','誤以為契約要公證才生效'],
    keyPoints:['要約＋承諾＝契約成立，不需書面（但書面有利於證明）','承諾內容若與要約不同，視為新要約','口頭契約原則上有效，只是舉證困難']
  },
  'intellectual-property': {
    concept:'intellectual-property', title:'著作權保護', subject:'law',
    summary:'著作完成時即自動享有著作權，不需申請登記（著作權法第10條）。著作財產權有期限（一般為著作人終身加50年），著作人格權則永久存在。',
    commonErrors:['以為要向政府申請才有著作權','認為加了©符號才受保護','以為免費使用就不侵權'],
    keyPoints:['創作完成即享有著作權，無需登記','合理使用（fair use）有條件允許部分使用，但非無限制','轉載或引用仍須標示來源，不能去除著作人姓名']
  },
  'consumer-protection': {
    concept:'consumer-protection', title:'消費者保護', subject:'law',
    summary:'消費者保護法對企業經營者採嚴格責任，舉證責任倒置：企業須證明商品安全，而非消費者自證商品有瑕疵，以彌補雙方資訊不對等。',
    commonErrors:['以為消費者必須自己證明一切','認為只要退貨就等於解決問題','誤以為保固期等於消費者保護法的保障期限'],
    keyPoints:['企業對商品安全負嚴格責任','消費者只需舉證受有損害即可主張','7天鑑賞期（網購）是特別保障，非所有商品均適用']
  },
  'legal-representation': {
    concept:'legal-representation', title:'限制行為能力與代理', subject:'law',
    summary:'7歲以上未成年人為限制行為能力人，獨自進行的法律行為效力未定，須法定代理人（通常是父母）允許或事後承認（民法第77條）。',
    commonErrors:['以為未成年人完全不能簽任何契約','認為只要成年就不需任何同意','誤以為輕微日常行為也需要父母同意'],
    keyPoints:['未滿7歲：無行為能力，由法定代理人代為','7歲以上未成年：限制行為能力，需法代允許或承認','純獲法律利益或日常生活必需行為：例外有效']
  },
  'tort-liability': {
    concept:'tort-liability', title:'民事侵權責任', subject:'law',
    summary:'民法第184條規定：故意或過失不法侵害他人權利，須負損害賠償責任。侵權行為可同時構成刑事犯罪，但兩者程序與目的不同。',
    commonErrors:['以為刑事無罪就不用民事賠償','認為只有故意才要賠，過失不用','混淆精神慰撫金與財產損害賠償'],
    keyPoints:['民事侵權不需要達到刑事犯罪標準','過失（不小心）也可能構成侵權','刑事和民事可以同時進行，互不影響']
  },
  'judicial-remedy': {
    concept:'judicial-remedy', title:'司法救濟途徑', subject:'law',
    summary:'我國採三級三審：地方法院→高等法院→最高法院。對判決不服，在法定期間內向上級法院提起上訴；行政事件另有行政訴訟體系。',
    commonErrors:['以為任何案件都能上訴三次','認為向總統或立委陳情等於正式救濟','混淆民事、刑事、行政三種訴訟體系'],
    keyPoints:['三級三審：每一審都有期限，超過就確定','第三審（最高法院）通常只審法律問題，不重新審事實','行政處分：訴願→行政訴訟，與普通法院體系不同']
  },
  'election-system': {
    concept:'election-system', title:'選舉制度', subject:'civics',
    summary:'立法院採單一選區兩票制：一票選區域立委（相對多數），一票選政黨（比例分配不分區席次）。不同選舉制度影響政黨生態與代表性。',
    commonErrors:['混淆區域票和政黨票的功能','以為得票最多者一定能分配更多不分區','認為選舉制度和結果無關'],
    keyPoints:['兩票：一票給候選人（區域），一票給政黨（不分區）','不分區依政黨得票比例分配，須通過5%門檻','不同制度（比例代表、多數決）各有代表性與穩定性的取捨']
  },
  'local-autonomy': {
    concept:'local-autonomy', title:'地方自治', subject:'civics',
    summary:'地方自治讓地方居民依法自行選舉代表、管理地方事務，是民主政治的延伸。地方政府有自治立法權，但仍受憲法與中央法令拘束。',
    commonErrors:['以為地方可以完全不受中央管轄','認為自治就是分裂','誤以為地方條例可以牴觸中央法律'],
    keyPoints:['地方自治是憲法保障的制度（憲法第10章）','地方法規不得牴觸上位規範（中央法律）','直轄市、縣（市）、鄉（鎮、市）層級各有不同自治範圍']
  },
  'administrative-remedy': {
    concept:'administrative-remedy', title:'行政救濟', subject:'civics',
    summary:'人民對行政機關處分不服，可先提訴願（向上級機關），對訴願結果不服再提行政訴訟（向行政法院）。這是保障人民對抗行政權的重要機制。',
    commonErrors:['直接跳過訴願提行政訴訟（通常不合法）','以為向民代陳情等於正式救濟','誤認為行政訴訟和普通法院一樣'],
    keyPoints:['訴願先行原則：多數情形須先訴願','訴願→行政訴訟：二階段救濟','行政法院專門審理行政事件，與民事、刑事法院分開']
  },
  'media-literacy': {
    concept:'media-literacy', title:'媒體素養', subject:'civics',
    summary:'媒體素養是分析、評估媒體內容的能力，包括辨識資訊來源、查核事實、分析報導立場，以及理解媒體如何建構現實。',
    commonErrors:['以為主流媒體就一定客觀','認為網路上的資訊都是真的','誤以為只看一個來源就足夠'],
    keyPoints:['交叉查核（cross-check）：比對多個可信來源','分辨新聞（事實）vs 評論（意見）','留意標題黨與斷章取義，閱讀全文再判斷']
  },
  'civil-society': {
    concept:'civil-society', title:'公民社會與NGO', subject:'civics',
    summary:'公民社會由獨立於政府和市場之外的組織與個人組成，NGO（非政府組織）是其重要成員，以倡議公共利益、提供社會服務或監督公權力為目的。',
    commonErrors:['以為NGO一定反對政府','認為只有大型組織才算NGO','誤以為公民社會和政府必然對立'],
    keyPoints:['NGO：非政府、非營利、有組織的公民團體','功能：倡議、服務、監督、國際合作','公民參與不只是選舉，包括結社、集會、請願等']
  },
  'gdp-growth': {
    concept:'gdp-growth', title:'GDP 與經濟成長', subject:'economics',
    summary:'GDP 衡量一定期間內境內生產的最終商品與服務市場總值。GDP 成長代表經濟擴張，但無法反映分配是否公平或環境成本。',
    commonErrors:['混淆GDP和GNP（國民生產毛額）','以為GDP高就代表人民生活水準一定高','忽略GDP不計算非市場活動如家務勞動'],
    keyPoints:['GDP：境內生產（不論國籍）；GNP：本國人生產（不論地點）','人均GDP更能反映生活水準，但仍忽略分配','GDP成長不等於所有人都變富裕']
  },
  'inflation-deflation': {
    concept:'inflation-deflation', title:'通膨與通縮', subject:'economics',
    summary:'通膨是物價普遍持續上漲，導致貨幣購買力下降。通縮是物價普遍持續下跌，看似有利但可能引發消費遞延與經濟衰退的惡性循環。',
    commonErrors:['以為物價上漲一定是壞事','認為通縮（物價下跌）一定有利','誤以為通膨只有壞處，沒有任何好處'],
    keyPoints:['溫和通膨（約2%）通常被視為健康的經濟信號','惡性通膨讓貨幣嚴重貶值，打亂資源配置','通縮可能讓消費者等待更低價格，形成需求萎縮的惡性循環']
  },
  'monetary-policy': {
    concept:'monetary-policy', title:'貨幣政策', subject:'economics',
    summary:'中央銀行透過調整利率、存款準備率或公開市場操作，影響貨幣供給與借貸成本，進而管理通膨與穩定經濟。',
    commonErrors:['混淆貨幣政策（央行）和財政政策（政府）','以為升息一定對股市不好','認為央行可以同時控制通膨和促進成長（兩難困境）'],
    keyPoints:['升息：抑制借貸與消費，降通膨但可能減緩成長','降息：刺激借貸與投資，促成長但可能推升通膨','貨幣政策效果有時間落差，不是立竿見影']
  },
  'fiscal-policy': {
    concept:'fiscal-policy', title:'財政政策', subject:'economics',
    summary:'財政政策由政府透過調整稅收和支出影響總需求。景氣衰退時擴張（增支出／減稅），景氣過熱時緊縮（減支出／加稅）。',
    commonErrors:['混淆財政政策和貨幣政策的執行者','認為政府赤字一定是壞事','以為減稅一定能刺激成長'],
    keyPoints:['擴張財政：增加政府支出或減稅→刺激需求','緊縮財政：減少支出或加稅→冷卻過熱經濟','財政政策立法程序較長，時效性不如貨幣政策靈活']
  },
  'international-trade': {
    concept:'international-trade', title:'比較利益與國際貿易', subject:'economics',
    summary:'比較利益原則說明：即使一國在所有商品上都效率較高，各國仍能透過專業分工與貿易互利。關鍵是機會成本的比較，而非絕對效率。',
    commonErrors:['混淆比較利益和絕對利益','認為貿易一定有贏家和輸家','以為保護主義一定能使本國更繁榮'],
    keyPoints:['比較利益：看機會成本，而非絕對生產量','自由貿易理論上使雙方消費可能性擴大','實際上貿易有分配問題：有些人得益，有些人受損']
  }
};
