const $=id=>document.getElementById(id);
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const onPages=location.hostname.endsWith('github.io');
const base=onPages?WORKER:'';
let account=null,csrf='',cases=[],view=null,busy=false,playTimer=null,recognition=null,cancelVoice=false;
let sceneMode='seat';
const procedureNames={civil:'民事程序',criminal:'成人刑事程序',juvenile:'少年保護程序'};
const labels={judge:'法官',claimant:'原告',respondent:'被告',claimantCounsel:'原告代理人',respondentCounsel:'被告律師',observer:'旁觀者',juvenile:'少年',assistant:'少年輔佐人'};
function status(text){$('status').textContent=text;}
function node(tag,text){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;}
function button(text,fn){const b=node('button',text);b.type='button';b.addEventListener('click',()=>run(fn));return b;}
async function api(path,body){const r=await fetch(base+path,{method:body?'POST':'GET',credentials:'include',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});const p=await r.json();if(r.status===501)throw Error('此容器尚未設定後端，登入、雲端場次與 AI 無法使用；固定遊戲仍可遊玩。');if(!r.ok)throw Error(p.error||'服務暫時無法使用');return p;}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message);pause();}finally{busy=false;}}
async function session(){const p=await api('/api/auth/session');account=p.user;csrf=p.csrfToken||'';$('account-toggle').textContent=account?account.displayName:'登入';$('logout').hidden=!account;$('create').textContent=account?'建立雲端場次':'登入後建立場次';if(account)await sessions();}
async function sessions(){const p=await api('/api/court/sessions');$('sessions').replaceChildren(...p.sessions.map(s=>button(`${s.title} · ${new Date(s.createdAt).toLocaleDateString('zh-TW')}`,async()=>{const p=await api('/api/court/sessions/'+s.id);open(p.view);})));}
function choices(select,items){select.replaceChildren(...items.map(([value,label])=>{const o=node('option',label);o.value=value;return o;}));}
function setup(){const t=cases.find(c=>c.id===$('case').value);if(!t)return;$('procedure').value=procedureNames[t.procedure];$('case-summary').textContent=t.summary;
choices($('role'),t.roles.map(r=>[r,r==='claimant'&&t.procedure==='criminal'?'告訴／被害人':r==='respondentCounsel'&&t.procedure==='criminal'?'辯護人':labels[r]]));
const f=$('setup-form').elements;f.respondentAge.value=f.respondentHearingAge.value=t.procedure==='juvenile'?15:20;f.respondentAid.value=t.mandatory?'appointed':'none';f.claimantAid.value='none';f.claimantAid.disabled=t.procedure==='juvenile';
$('respondent-label').textContent=t.procedure==='juvenile'?'少年（虛構角色）':'被告（虛構角色）';$('claimant-label').textContent=t.procedure==='juvenile'?'受影響的一方（虛構角色）':t.procedure==='criminal'?'告訴／被害人（虛構角色）':'原告（虛構角色）';
$('setup-notice').textContent=[t.mandatory?'本範本已設定法院認有必要，須有指定或選任的法律協助。':'本範本未設定指定法律協助必要性。',t.aidApproved?'本範本設定法律扶助已獲核准。':'本範本未設定法律扶助核准。'].join(' ');}
function scene(mode=sceneMode){sceneMode=mode;const iframe=$('scene');if(!iframe.hidden)iframe.contentWindow?.postMessage({type:'court-view',mode,role:view.config.role,procedure:view.procedure},location.origin);}
window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==$('scene').contentWindow)return;if(e.data?.type==='court-ready')scene();if(e.data?.type==='court-interact')$('actions').scrollIntoView({block:'center',behavior:'smooth'});});
function open(next){view=next;$('setup').hidden=true;$('hearing').hidden=false;render();scene();status('場次已保存。');}
function render(){const v=view;$('hearing-title').textContent=v.title;$('stage').textContent=`${procedureNames[v.procedure]} · ${v.stageLabel} · ${labels[v.config.role]} · 版本 ${v.version}`;$('notice').textContent=v.notices.join(' ');$('facts').replaceChildren(...v.facts.map(x=>node('li',x)));
$('evidence').replaceChildren(...v.evidence.map(e=>{const box=node('div');box.className='evidence';box.append(node('strong',e.title),node('p',e.text));if(v.actions.includes('review'))box.append(button(v.reviewed.includes(e.id)?'已查看':'記錄：已查看這份證據',()=>act('review',{evidenceId:e.id})));return box;}));
$('actions').replaceChildren();$('speech-form').hidden=!v.actions.includes('speak');$('observer').hidden=!v.actions.includes('step');$('turn-title').textContent=v.config.role==='judge'?'主持程序':v.config.role==='observer'?'觀察程序':'代表你的角色發言';
$('turn-help').textContent=v.stage===0?'先確認身分、程序與表達權利。':v.stage===1?'依固定事實說明爭點；法官請整理雙方爭點。':v.stage===2?'逐一核對證據能證明什麼，不能證明什麼。':v.stage===3?'回應證據與不同觀點；法官請整理尚待釐清事項。':v.stage===4?v.question:'本輪結束，可回到案件設定。';
if(v.actions.includes('acknowledge'))$('actions').append(button('確認程序權利，開始陳述',()=>act('acknowledge')));
if(v.actions.includes('closeEvidence'))$('actions').append(button(v.config.role==='judge'?'結束證據調查':'完成證據檢視，繼續',()=>act('closeEvidence')));
if(v.actions.includes('rule'))for(const r of v.proceduralRequests){const row=node('section');row.append(node('p',r.text));if(r.done)row.append(node('p','已完成准駁'));else row.append(button('准許',()=>act('rule',{rulingId:r.id,decision:'allow'})),button('不准許',()=>act('rule',{rulingId:r.id,decision:'deny'})));$('actions').prepend(row);}
if(v.actions.includes('answer'))v.answers.forEach((a,i)=>$('actions').append(button(`${i+1}. ${a}`,()=>act('answer',{answer:i}))));
$('feedback').textContent=v.feedback;$('assessment').replaceChildren();if(v.assessment)Object.entries(v.assessment).filter(([k])=>k!=='ranked').forEach(([,value])=>$('assessment').append(node('p',value)));
if(v.completed)pause();$('guidance').textContent=`${v.turn.speaker}（預寫教學對話）：${v.turn.text}`;}
async function act(type,data={}){if(!view)return;const requestId=crypto.randomUUID();try{const p=await api(`/api/court/sessions/${view.id}/actions`,{type,version:view.version,requestId,...data});view=p.view;render();scene();status('已保存');}catch(e){const p=await api('/api/court/sessions/'+view.id);view=p.view;render();throw e;}}
function pause(){clearTimeout(playTimer);playTimer=null;$('autoplay').textContent='播放';}
async function autoStep(){if(!view||view.completed||document.hidden){pause();return;}await run(()=>act('step'));if(!view.completed&&$('autoplay').textContent==='暫停')playTimer=setTimeout(autoStep,4500);}
$('autoplay').onclick=()=>{if($('autoplay').textContent==='暫停'){pause();return;}$('autoplay').textContent='暫停';void autoStep();};$('step').onclick=()=>run(()=>act('step'));
$('case').onchange=setup;$('account-toggle').onclick=()=>{$('account').hidden=!$('account').hidden;};
$('auth-form').onsubmit=e=>{e.preventDefault();void run(async()=>{if(onPages){location.href=WORKER+'/court/';return;}const f=new FormData(e.target);const p=await api('/api/auth/'+f.get('mode'),Object.fromEntries(f));e.target.elements.password.value='';e.target.elements.recoveryCode.value='';$('recovery').hidden=!p.recoveryCode;$('recovery').textContent=p.recoveryCode?`請保存新的復原碼（僅顯示一次）：\n${p.recoveryCode}`:'';await session();status('登入成功。');});};
$('logout').onclick=()=>run(async()=>{await api('/api/auth/logout',{});account=null;csrf='';pause();$('scene').removeAttribute('src');$('scene').hidden=true;$('hearing').hidden=true;$('setup').hidden=false;$('sessions').replaceChildren();$('recovery').textContent='';$('recovery').hidden=true;await session();});
$('setup-form').onsubmit=e=>{e.preventDefault();void run(async()=>{if(!account){$('account').hidden=false;status('請先登入；遊客仍可使用固定練習。');return;}const b=Object.fromEntries(new FormData(e.target));b.claimantAid ||= 'none';for(const k of ['claimantAge','claimantHearingAge','respondentAge','respondentHearingAge'])b[k]=Number(b[k]);const p=await api('/api/court/sessions',b);open(p.view);});};
$('speech-form').onsubmit=e=>{e.preventDefault();void run(async()=>{await act('speak',{text:$('statement').value});$('statement').value='';});};
$('back').onclick=()=>{pause();stopVoice(true);$('hearing').hidden=true;$('setup').hidden=false;$('scene').removeAttribute('src');$('scene').hidden=true;void run(sessions);};
$('show-scene').onclick=()=>{$('scene').hidden=false;if(!$('scene').getAttribute('src'))$('scene').src='../play/?court=1';};
$('seat').onclick=()=>scene('seat');$('overview').onclick=()=>scene('overview');$('walk').onclick=()=>scene('walk');
$('ask-guide').onclick=()=>run(async()=>{const id=view.id,version=view.version;$('guidance').textContent='正在取得引導…';const p=await api(`/api/court/sessions/${id}/dialogue`,{});if(view.id===id&&view.version===version)$('guidance').textContent=`${p.mode==='scripted'?'固定引導（AI 暫不可用）':'AI 參考引導'}：${p.text}`;});
$('read-guide').onclick=()=>{if(!('speechSynthesis'in window)){status('此瀏覽器不支援朗讀。');return;}stopVoice(true);speechSynthesis.cancel();const u=new SpeechSynthesisUtterance($('guidance').textContent);u.lang='zh-TW';speechSynthesis.speak(u);};
function stopVoice(cancel=false){cancelVoice=cancel;if(recognition){cancel?recognition.abort():recognition.stop();} }
// Cancel before navigation or a submitted action, including multi-touch input.
$('speech-form').addEventListener('submit',()=>stopVoice(true),{capture:true});
$('logout').addEventListener('click',()=>{stopVoice(true);window.speechSynthesis?.cancel();},{capture:true});
window.addEventListener('pagehide',()=>{stopVoice(true);pause();window.speechSynthesis?.cancel();});
const Speech=window.SpeechRecognition||window.webkitSpeechRecognition;
if(!Speech){$('microphone').disabled=true;$('voice-status').textContent='此瀏覽器不支援語音辨識，請直接輸入文字。';}
else{
 $('microphone').addEventListener('pointerdown',e=>{if(recognition)return;e.preventDefault();$('microphone').setPointerCapture(e.pointerId);window.speechSynthesis?.cancel();cancelVoice=false;recognition=new Speech();recognition.lang='zh-TW';recognition.interimResults=false;recognition.continuous=false;recognition.onresult=e=>{if(!cancelVoice)$('statement').value=($('statement').value+' '+e.results[0][0].transcript).trim().slice(0,600);};recognition.onerror=()=>{$('voice-status').textContent='辨識未完成，可重新錄音或直接打字。';};recognition.onend=()=>{recognition=null;$('microphone').textContent='按住說話';};try{recognition.start();$('microphone').textContent='正在聆聽，鬆開停止';}catch{recognition=null;}});
 $('microphone').addEventListener('pointerup',()=>stopVoice());$('microphone').addEventListener('pointercancel',()=>stopVoice(true));
}
$('cancel-voice').onclick=()=>stopVoice(true);document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();stopVoice(true);window.speechSynthesis?.cancel();}});
await run(async()=>{if(onPages){status('雲端功能請使用同源平台，以確保手機登入正常。');const a=node('a','前往完整平台');a.href=WORKER+'/court/';$('status').append(' ',a);return;}const p=await api('/api/court/cases');cases=p.cases;choices($('case'),cases.map(t=>[t.id,t.title]));setup();$('sources').replaceChildren(...p.sources.map(s=>{const p=node('p');const a=node('a',s.title);a.href=s.url;a.target='_blank';a.rel='noopener';p.append(a,` · 查核 ${s.checked} · ${s.effective}`);return p;}));await session();});
