import '../auth-sync.js';
const $=id=>document.getElementById(id);
const onPages=location.hostname.endsWith('github.io');
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const base=onPages?WORKER:'';
let account=null,csrf='',busy=false,currentToken=null;
const subjectLabels={law:'法律',civics:'公民',economics:'經濟'};
const statusLabels={insufficient:'資料不足',reinforce:'優先補強',review:'複習',consolidate:'鞏固'};

function status(t){$('status').textContent=t;}
async function api(path,body){
  const r=await fetch(base+path,{method:body?'POST':'GET',credentials:'include',
    headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},
    body:body?JSON.stringify(body):undefined});
  const p=await r.json();
  if(r.status===501)throw Error('此容器尚未設定後端，請使用線上版。');
  if(!r.ok)throw Error(p.error||'服務暫時無法使用');
  return p;
}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message);}finally{busy=false;}}

async function loadSession(){
  const p=await window.EduAuth.session();
  account=p.user;csrf=p.csrfToken||'';
  $('account-toggle').textContent=account?account.displayName:'登入';
  if(!account){$('account').hidden=false;$('practice-area').hidden=true;}
  else{$('account').hidden=true;$('practice-area').hidden=false;}
}

async function fetchQuestion(concept=null){
  const subject=$('subject-filter').value;
  let path='/api/practice/questions';
  const params=new URLSearchParams();
  if(subject)params.set('subject',subject);
  if(concept)params.set('concept',concept);
  if([...params].length)path+='?'+params;
  const p=await api(path);
  currentToken=p.questionToken;
  showQuestion(p.question);
}

function showQuestion(q){
  $('question-section').hidden=false;
  $('result-section').hidden=true;
  $('weakness-section').hidden=true;
  $('question-meta').textContent=`${subjectLabels[q.subject]||q.subject} · ${q.concept} · 難度 ${'★'.repeat(q.difficulty)}`;
  $('question-text').textContent=q.text;
  $('choices').replaceChildren(...q.answers.map((a,i)=>{
    const b=document.createElement('button');
    b.type='button';b.textContent=`${i+1}. ${a}`;
    b.addEventListener('click',()=>run(()=>submitAnswer(i)));
    return b;
  }));
  status('');
}

async function submitAnswer(answer){
  if(!currentToken)return;
  const p=await api('/api/practice/answer',{questionToken:currentToken,answer});
  currentToken=null;
  $('question-section').hidden=true;
  $('result-section').hidden=false;
  $('result-verdict').textContent=p.correct?'✓ 正確！':'✗ 答錯了（正解為選項 '+(p.correctIndex+1)+'）';
  $('result-verdict').className=p.correct?'correct':'wrong';
  $('result-explanation').textContent='解析：'+p.explanation;
  $('result-source').textContent='來源：'+p.source;
  if(!p.correct&&p.weakness&&p.weakness.status==='reinforce'){
    await loadReinforceGuide(p.weakness.concept);
  } else {
    $('reinforce-guide').hidden=true;
  }
  if(!p.firstAttempt)status('（此題已作答過，不計入弱點統計）');
}

async function loadReinforceGuide(concept){
  try{
    const p=await api('/api/practice/reinforce?concept='+encodeURIComponent(concept));
    if(!p.guide){$('reinforce-guide').hidden=true;return;}
    $('guide-title').textContent=p.guide.title;
    $('guide-summary').textContent=p.guide.summary;
    $('guide-errors').replaceChildren(
      Object.assign(document.createElement('p'),{textContent:'常見錯誤：'}),
      ...p.guide.commonErrors.map(e=>{const li=document.createElement('p');li.textContent='・'+e;return li;})
    );
    $('guide-points').replaceChildren(
      Object.assign(document.createElement('p'),{textContent:'記住這些：'}),
      ...p.guide.keyPoints.map(k=>{const li=document.createElement('p');li.textContent='✓ '+k;return li;})
    );
    // Store the next question token for "繼續補題"
    if(p.questionToken){
      $('next-reinforce').hidden=false;
      $('next-reinforce').onclick=()=>run(()=>{
        currentToken=p.questionToken;showQuestion(p.question);
      });
    } else {
      $('next-reinforce').hidden=true;
    }
    $('reinforce-guide').hidden=false;
  }catch{$('reinforce-guide').hidden=true;}
}

async function loadWeakness(){
  const p=await api('/api/practice/weakness');
  $('weakness-section').hidden=false;
  $('question-section').hidden=true;
  $('result-section').hidden=true;
  if(!p.weakness.length){$('weakness-list').textContent='尚無練習紀錄。';return;}
  $('weakness-list').replaceChildren(...p.weakness.map(s=>{
    const row=document.createElement('div');
    row.className='weakness-row';
    const label=statusLabels[s.status]||s.status;
    const pct=s.attempts?Math.round(s.rate*100)+'%':'—';
    row.textContent=`${s.concept}　${pct}（${s.attempts} 題）　${label}`;
    if(s.status==='reinforce'||s.status==='review'){
      const btn=document.createElement('button');
      btn.textContent='補強';
      btn.addEventListener('click',()=>run(()=>fetchQuestion(s.concept)));
      row.append(' ',btn);

      const planBtn=document.createElement('button');
      planBtn.textContent='安排複習';
      planBtn.title='在排程頁新增一筆複習時段';
      planBtn.addEventListener('click',()=>{
        const params=new URLSearchParams({
          title:'複習：'+s.concept,
          subject:s.subject||'other',
          concept:s.concept
        });
        location.href='../planner/?'+params;
      });
      row.append(' ',planBtn);
    }
    return row;
  }));
}

$('get-question').onclick=()=>run(()=>fetchQuestion());
$('next-question').onclick=()=>run(()=>fetchQuestion());
$('show-weakness').onclick=()=>run(loadWeakness);
$('close-weakness').onclick=()=>{$('weakness-section').hidden=true;};
$('account-toggle').onclick=()=>{$('account').hidden=!$('account').hidden;};

await run(loadSession);
