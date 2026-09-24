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
    source:'高中經濟學教材；市場失靈與政府干預' }
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
  }
};
