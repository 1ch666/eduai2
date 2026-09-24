// Pure rules shared by tests and the authoritative court service.
// This is a bounded teaching simulation, NOT a jurisdiction/eligibility calculator.
export const RULE_VERSION = 'tw-teaching-2026-09-23';
export const LEGAL_SOURCES = [
  { id: 'adult', title: '民法第12條：成年', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=12', checked: '2026-09-23', applies: 'civil', effective: '2023-01-01（成年年齡18歲）' },
  // 民法第13條、第77條及民事訴訟法第45條均於2021年修正、2023-01-01施行，
  // 配合民法第12條成年年齡由20歲下修為18歲。沿革已依法務部法規沿革欄核對。
  { id: 'capacity', title: '民法第13條：行為能力', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=13', checked: '2026-09-23', applies: 'civil', effective: '2023-01-01（配合成年年齡修正施行；沿革待向司法院法規查詢系統逐條核對）' },
  { id: 'consent', title: '民法第77條：法定代理人同意及例外', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0000001&flno=77', checked: '2026-09-23', applies: 'civil', effective: '2023-01-01（同第13條修正批次；沿革待逐條核對）' },
  { id: 'litigation-capacity', title: '民事訴訟法第45條：訴訟能力', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=B0010001&flno=45', checked: '2026-09-23', applies: 'civil', effective: '2023-01-01（配合民法成年年齡修正連動修正；沿革待逐條核對）' },
  // 以下刑事訴訟法、少年事件處理法條文之精確修正日期尚未完成逐條查核，
  // 維持「以官方現行條文為準」標示；發布前須至司法院法學資料檢索系統核對沿革。
  { id: 'defense', title: '刑事訴訟法第31條：指定辯護', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=C0010001&flno=31', checked: '2026-09-23', applies: 'criminal', effective: '以官方現行條文為準；僅模擬本範本條件；精確修正日期待查核' },
  { id: 'claimant-agent', title: '刑事訴訟法第236條之1：告訴得委任代理人', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=C0010001&flno=236-1', checked: '2026-09-23', applies: 'criminal', effective: '以官方現行條文為準；精確增訂日期待查核' },
  { id: 'claimant-agent-trial', title: '刑事訴訟法第271條之1：告訴人於審判中委任代理人', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=C0010001&flno=271-1', checked: '2026-09-23', applies: 'criminal', effective: '以官方現行條文為準；非律師代理人於審判中不得檢閱卷證；精確增訂日期待查核' },
  { id: 'juvenile', title: '少年事件處理法第2條：少年定義', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=C0010011&flno=2', checked: '2026-09-23', applies: 'juvenile', effective: '以官方現行條文為準；不處理跨法規版本案件；修正日期待查核' },
  { id: 'assistant', title: '少年事件處理法第31條：輔佐人', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=C0010011&flno=31', checked: '2026-09-23', applies: 'juvenile', effective: '以官方現行條文為準；指定必要性由範本設定；修正日期待查核' },
  { id: 'privacy', title: '少年事件處理法第34條：不公開程序', url: 'https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=C0010011&flno=34', checked: '2026-09-23', applies: 'juvenile', effective: '以官方現行條文為準；遊戲額外全面禁旁觀；修正日期待查核' }
] as const;
export type Procedure = 'civil' | 'criminal' | 'juvenile';
export type Role = 'judge' | 'claimant' | 'respondent' | 'claimantCounsel' | 'respondentCounsel' | 'observer' | 'juvenile' | 'assistant';
export type Aid = 'none' | 'private' | 'legalAid' | 'appointed';
export type CourtConfig = { caseId: string; role: Role; claimantAge: number; claimantHearingAge: number; respondentAge: number; respondentHearingAge: number; claimantAid: Aid; respondentAid: Aid };
export type CaseTemplate = { id: string; title: string; procedure: Procedure; summary: string; facts: string[]; evidence: { id: string; title: string; text: string }[]; question: string; answers: string[]; correct: number; explanation: string; mandatory: boolean; aidApproved: boolean };
export const CASES: CaseTemplate[] = [
  { id: 'sale', title: '沒有寄出的相機', procedure: 'civil', summary: '買方要求返還已付款項；賣方主張已交寄。', facts: ['雙方約定交易一台二手相機。', '買方已支付款項。', '目前沒有可核對的交寄證明。'], evidence: [{ id:'payment',title:'匯款紀錄',text:'時間與金額符合雙方約定，只能證明已付款。' },{id:'chat',title:'交易對話',text:'賣方說已寄件，但未提供可核對的物流編號。'}], question:'應如何處理目前的事實爭點？',answers:['付款即證明賣方詐欺','要求雙方釐清履約與交寄證據','不聽賣方說明直接判決','賣方說寄出就一定寄出'],correct:1,explanation:'付款和寄件是不同待證事實；應聽取双方陳述並調查證據，民事爭議不等於已成立刑事犯罪。',mandatory:false,aidApproved:false },
  { id:'damage',title:'球場旁的破窗',procedure:'civil',summary:'屋主請求賠償，球員爭執破窗是否由自己的球造成。',facts:['窗戶在球賽期間破裂。','現場有不只一組人在打球。','球員承認曾將球打出界外。'],evidence:[{id:'photo',title:'現場照片',text:'顯示破窗與球場位置，無法單獨證明是哪一顆球造成。'},{id:'witness',title:'目擊者紀錄',text:'目擊者看見球飛出，但沒看見擊中窗戶的瞬間。'}],question:'哪項仍需釐清？',answers:['球員的穿著','屋主的職業','行為、損害與因果關係','附近所有球員都必須賠'],correct:2,explanation:'應釐清損害、行為及因果關係，不能因人在場就要求負擔責任。',mandatory:false,aidApproved:true },
  { id:'tablet',title:'消失的平板',procedure:'criminal',summary:'檢察官就疑似竊盜起訴，被告否認取走教室平板。',facts:['教室的平板一度找不到。','被告曾進入教室。','沒有人親眼看到被告取走平板。'],evidence:[{id:'camera',title:'走廊影像摘要',text:'只顯示被告進入教室，沒有拍到教室內部。'},{id:'witness',title:'證人陳述',text:'我只看見他進教室；拿平板的事是聽別人說的。'}],question:'如何評價現有證據？',answers:['在場就代表有罪','被告不說話就是承認','外表可以判斷可信度','進入教室不等於取走平板，仍須查證'],correct:3,explanation:'區分事實、推論與傳聞；不得把在場或行使緘默權直接當成有罪。',mandatory:false,aidApproved:false },
  { id:'injury',title:'月台上的推擠',procedure:'criminal',summary:'檢察官主張故意傷害；被告爭執動作與受傷原因。',facts:['月台人潮擁擠。','雙方發生身體接觸後一人跌倒。','本範本法院認有指定辯護的必要。'],evidence:[{id:'video',title:'影像摘要',text:'可見接觸與跌倒，但畫面有遮擋，無法完整判斷動作。'},{id:'medical',title:'就醫摘要',text:'證明有擦傷，不能單獨證明何人故意造成。'}],question:'就醫資料可直接證明什麼？',answers:['有受傷紀錄，故意及因果仍需其他證據','被告一定有故意','必然要判最高刑','全部目擊者都在說謊'],correct:0,explanation:'受傷紀錄、行為人、因果關係與主觀故意要分別檢驗。',mandatory:true,aidApproved:true },
  { id:'youth-property',title:'借走的遊戲機',procedure:'juvenile',summary:'少年保護事件：了解取走物品的經過與支持需求。',facts:['少年未事先告知便取走同學的遊戲機。','物品隔日已歸還。','是否得同意、行為原因與照顧支持仍待釐清。'],evidence:[{id:'chat',title:'對話摘要',text:'對話對借用是否獲得同意有歧異，不能只擷取一句話。'},{id:'support',title:'生活調查摘要',text:'學校願提供輔導，照顧者願共同討論支持措施。'}],question:'適當的程序重點是？',answers:['公開姓名供大家討論','未查明先責備少年','釐清事實並聽取少年與支持系統的意見','歸還後任何事都不用調查'],correct:2,explanation:'保護事件兼顧程序權利、事實釐清與健全成長，不是把成人刑事程序縮小。',mandatory:false,aidApproved:false },
  { id:'youth-conflict',title:'放學後的衝突',procedure:'juvenile',summary:'少年保護事件：調查衝突經過，討論適當支持。',facts:['兩名少年放學後發生衝突。','各自對衝突起因有不同說法。','本範本法院認為少年有輔佐人的必要。'],evidence:[{id:'accounts',title:'雙方紀錄',text:'雙方說法不一致，須分別聽取且避免誘導。'},{id:'school',title:'學校支持計畫',text:'可提供關係修復與持續輔導，但不是認定行為的證據。'}],question:'支持計畫與事實調查的關係？',answers:['有輔導就表示已認罪','支持需求與事件事實都要分別了解','只看誰說話大聲','交給旁觀群眾投票'],correct:1,explanation:'支持措施不等於認罪；少年有表達與程序保障，應釐清事實並討論需要的支持。',mandatory:true,aidApproved:true }
];
export const ROLE_LABELS: Record<Role,string> = { judge:'法官',claimant:'原告／告訴人',respondent:'被告',claimantCounsel:'原告代理人',respondentCounsel:'被告律師',observer:'旁觀者',juvenile:'少年',assistant:'少年輔佐人' };
export function rolesFor(p: Procedure): Role[] {
  return p === 'civil' ? ['judge','claimant','respondent','claimantCounsel','respondentCounsel','observer'] : p === 'criminal' ? ['judge','claimant','respondent','claimantCounsel','respondentCounsel','observer'] : ['judge','juvenile','assistant'];
}
// One source of truth for the modelled ages: validateConfig rejects, and the
// setup page shows the same limits before the player submits a configuration.
export const TEMPLATE_AGE_MIN = 7, TEMPLATE_AGE_MAX = 90;
export const AGE_LIMITS: Record<Procedure,{actMin:number;actMax:number;message:string;note:string}> = {
  civil: { actMin: TEMPLATE_AGE_MIN, actMax: TEMPLATE_AGE_MAX, message: '', note: '民事範本開放 7 至 90 歲。未成年當事人沒有訴訟能力，由法定代理人代為或協助進行，不是讓未成年人自己訴訟。' },
  criminal: { actMin: 18, actMax: TEMPLATE_AGE_MAX, message: '成人刑事範本僅支援行為時雙方皆成年；未成年案件請選少年範本', note: '成人刑事範本要求雙方行為時皆滿 18 歲；未滿 18 歲請改選少年保護範本，本版未建模跨齡移送。' },
  juvenile: { actMin: 12, actMax: 17, message: '此少年保護範本僅支援行為及審理時12至未滿18歲；跨齡移送情況尚未開放', note: '少年保護範本開放行為時及審理時 12 歲以上未滿 18 歲。本遊戲一律不開放旁觀，這是產品限制，不表示真實程序絕無例外。' }
};
export function validateConfig(c: CourtConfig): string | null {
  const t = CASES.find(t => t.id === c.caseId);
  if (!t) return '案件不存在';
  if (!rolesFor(t.procedure).includes(c.role)) return '此程序不開放該角色；少年案件禁止旁觀（遊戲限制）';
  const limits = AGE_LIMITS[t.procedure];
  for (const [act, hearing] of [[c.claimantAge,c.claimantHearingAge],[c.respondentAge,c.respondentHearingAge]]) {
    if (!Number.isInteger(act) || !Number.isInteger(hearing) || act < TEMPLATE_AGE_MIN || hearing > TEMPLATE_AGE_MAX || hearing < act) return '範本年齡限7–90歲，審理年齡不可小於行為年齡';
  }
  if (t.procedure === 'criminal' && (c.respondentAge < limits.actMin || c.claimantAge < limits.actMin)) return limits.message;
  if (t.procedure === 'juvenile' && (c.respondentAge < limits.actMin || c.respondentAge > limits.actMax || c.respondentHearingAge > limits.actMax)) return limits.message;
  const aids: Aid[] = ['none','private','legalAid','appointed'];
  if (!aids.includes(c.claimantAid) || !aids.includes(c.respondentAid)) return '法律協助設定錯誤';
  if (c.claimantAid === 'appointed' || (t.procedure === 'civil' && c.respondentAid === 'appointed')) return '本範本不提供民事／告訴人的指定辯護';
  if ((c.claimantAid === 'legalAid' || c.respondentAid === 'legalAid') && !t.aidApproved) return '本案件未設定已獲法律扶助審查核准';
  if (t.procedure === 'juvenile' && c.claimantAid !== 'none') return '本少年保護範本不設原告方律師';
  if (t.mandatory && c.respondentAid === 'none') return '本案件法院已認有必要，須有辯護人／輔佐人才能進行';
  if (c.respondentAid === 'appointed' && !t.mandatory) return '此案件未設定指定必要性，請選自行選任或無律師';
  if (c.role === 'claimantCounsel' && c.claimantAid === 'none') return '選代理人視角須有原告方律師';
  if (['respondentCounsel','assistant'].includes(c.role) && c.respondentAid === 'none') return '選律師／輔佐人視角須設定法律協助';
  return null;
}
export const STAGES = ['確認程序權利','陳述與爭點','調查證據','意見與回應','庭後判讀','完成'] as const;
// The server chooses the speaker and the permitted source text; the model never
// chooses a procedure, advances a stage, or writes into the immutable template.
export function scriptedTurn(s:CourtState) {
  const t = CASES.find(t=>t.id===s.config.caseId)!;
  const claimantSide = s.config.role==='claimant'||s.config.role==='claimantCounsel';
  // 刑事由檢察官實行公訴；站在告訴人這一側時，對造發言的是被告或辯護人。
  const opponent = t.procedure==='juvenile'?'少年調查官':t.procedure==='criminal'?(claimantSide?'被告':'檢察官'):claimantSide?'被告':'原告';
  const speaker = s.stage===1?opponent:s.stage===2?'證據說明':s.stage===3?(t.procedure==='juvenile'?'少年輔佐人':'程序引導員'):s.config.role==='judge'?'書記官':'法官';
  const text = s.stage===0?'本案是虛構程序練習。請確認角色與法律協助，並尊重各方陳述的機會。':s.stage===1?t.summary:s.stage===2?t.evidence.map(e=>`${e.title}：${e.text}`).join('\n'):s.stage===3?'請指出已知事實、證据的限制及尚待釐清之處；不要用臆測補足空白。':s.stage===4?t.question:t.explanation;
  return {speaker,text,mode:'scripted' as const,version:s.version};
}
export const PROCEDURAL_REQUESTS = [
  {id:'heard',text:'讓各方有機會說明證據的內容與限制。',correct:'allow',reason:'應給予各方陳述及回應的機會。'},
  {id:'shortcut',text:'不再核對資料，直接把單一片段或一方主張當作已證明的爭議事實。',correct:'deny',reason:'這些範本都仍有待釐清的爭點，不能跳過查證。'}
] as const;
export type CourtAction = { requestId: string; version: number; type: string; text?: string; evidenceId?: string; answer?: number; rulingId?:string; decision?:string };
export type CourtState = { id:string; owner:string; config:CourtConfig; stage:number; version:number; reviewed:string[]; rulings?:string[]; statements:string[]; attempts:number; completed:boolean; feedback:string; createdAt:string; updatedAt:string; ruleVersion:string };
export function newCourt(id:string, owner:string, config:CourtConfig): CourtState {
  const error = validateConfig(config); if (error) throw new Error(error);
  return { id,owner,config,stage:0,version:0,reviewed:[],statements:[],attempts:0,completed:false,feedback:'',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),ruleVersion:RULE_VERSION };
}
export function allowedActions(s:CourtState): string[] {
  if(s.completed) return [];
  if(s.config.role === 'observer') return ['step'];
  return s.stage === 0 ? ['acknowledge'] : s.stage === 1 || s.stage === 3 ? ['speak'] : s.stage === 2 ? ['review',...(s.config.role==='judge'?['rule']:[]),'closeEvidence'] : ['answer'];
}
export function transition(s:CourtState, a:CourtAction): CourtState {
  if(a.version !== s.version) throw new Error('版本已變更，請重新讀取場次');
  if(!allowedActions(s).includes(a.type)) throw new Error('目前階段不允許此動作');
  const n = structuredClone(s), t = CASES.find(t=>t.id===s.config.caseId)!;
  if(a.type === 'step') { n.stage++; if(n.stage===5){n.completed=true;n.feedback=t.explanation;} }
  if(a.type === 'acknowledge') n.stage++;
  if(a.type === 'speak') {
    if(typeof a.text!=='string' || a.text.trim().length<2 || a.text.length>600) throw new Error('陳述需為2至600字');
    n.statements.push(a.text.trim());n.stage++;
  }
  if(a.type === 'review') {
    if(!t.evidence.some(e=>e.id===a.evidenceId)) throw new Error('證物不存在');
    if(!n.reviewed.includes(a.evidenceId!)) n.reviewed.push(a.evidenceId!);
  }
  if(a.type === 'closeEvidence') {
    if(n.reviewed.length!==t.evidence.length) throw new Error('請先查看每份證據再結束調查');
    if(n.config.role==='judge' && n.rulings?.length!==PROCEDURAL_REQUESTS.length) throw new Error('請先完成法官的兩項程序准駁練習');
    n.stage++;
  }
  if(a.type === 'rule') {
    const ruling=PROCEDURAL_REQUESTS.find(r=>r.id===a.rulingId);
    if(!ruling || !['allow','deny'].includes(a.decision||'')) throw new Error('程序決定格式錯誤');
    if(a.decision===ruling.correct){n.rulings=[...new Set([...(n.rulings||[]),ruling.id])];n.feedback='程序決定合理：'+ruling.reason;}
    else n.feedback='請重新考慮：'+ruling.reason;
  }
  if(a.type === 'answer') {
    if(!Number.isInteger(a.answer) || a.answer!<0 || a.answer!>=t.answers.length) throw new Error('答案格式錯誤');
    n.attempts++; n.feedback=t.explanation;
    if(a.answer===t.correct){n.stage=5;n.completed=true;} else n.feedback='再想一想。'+t.explanation;
  }
  n.version++;n.updatedAt=new Date().toISOString();return n;
}
export function courtView(s:CourtState) {
  const t = CASES.find(t=>t.id===s.config.caseId)!;
  const { owner, ...state } = s;
  return { ...state, title:t.title,procedure:t.procedure,summary:t.summary,facts:t.facts,evidence:t.evidence,
    question:t.question,answers:t.answers,actions:allowedActions(s),stageLabel:STAGES[s.stage],turn:scriptedTurn(s),
    proceduralRequests:s.config.role==='judge'?PROCEDURAL_REQUESTS.map(({id,text})=>({id,text,done:s.rulings?.includes(id)||false})):[],
    sources:LEGAL_SOURCES.filter(r=>r.applies===t.procedure),
    notices:[...(t.procedure==='civil' && (s.config.claimantHearingAge<18 || s.config.respondentHearingAge<18)?['未成年當事人的程序由法定代理人協助；不是讓未成年人獨自進行訴訟。']:[]),
      ...(t.procedure==='criminal' && (s.config.role==='claimantCounsel'||s.config.role==='claimant')?['刑事公訴由檢察官實行；告訴人得委任代理人到場陳述意見，非律師的代理人在審判中不得檢閱、抄錄或攝影卷證。']:[]),
      '虛構範本，非真實判決或法律意見；本版只開放已建模的年齡與程序組合。'],
    assessment:s.completed?{procedure:'完成程序練習',evidence:s.config.role==='observer'?'旁觀不評分':`已查看 ${s.reviewed.length}/${t.evidence.length} 份證據`,argument:'陳述供自我檢視，不以關鍵字冒充法律論證分數',ranked:false}:null };
}
