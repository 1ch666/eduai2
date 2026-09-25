const $=id=>document.getElementById(id);
const onPages=location.hostname.endsWith('github.io');
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const base=onPages?WORKER:'';
let account=null,csrf='',weekly=false;

const TIERS=[
  {name:'見習生',minScore:0},
  {name:'初學者',minScore:50},
  {name:'進階者',minScore:150},
  {name:'熟練者',minScore:300},
  {name:'專家',  minScore:500},
];

function status(t){$('status').textContent=t;}

async function api(path){
  const r=await fetch(base+path,{credentials:'include',headers:{Accept:'application/json'}});
  const p=await r.json();
  if(!r.ok)throw Error(p.error||'服務暫時無法使用');
  return p;
}

async function apiPost(path){
  const r=await fetch(base+path,{method:'POST',credentials:'include',
    headers:{Accept:'application/json','X-CSRF-Token':csrf}});
  const p=await r.json();
  if(!r.ok)throw Error(p.error||'服務暫時無法使用');
  return p;
}

function escHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function tierBadge(tier){
  if(!tier)return '<span style="color:#aaa">—</span>';
  return `<span class="tier-badge tier-${escHtml(tier)}">${escHtml(tier)}</span>`;
}

function renderTierTable(){
  $('tier-table').innerHTML=TIERS.map(t=>`
    <tr>
      <td style="padding:.3rem .7rem;border-bottom:1px solid #eee">${tierBadge(t.name)}</td>
      <td style="padding:.3rem .7rem;border-bottom:1px solid #eee">${t.minScore} 分以上</td>
    </tr>`).join('');
}

async function loadRankings(){
  try{
    const p=await api('/api/rankings/top?weekly='+(weekly?'1':'0'));
    const rows=p.leaderboard;
    if(p.tiersAvailable===false){
      $('tier-notice').textContent=`目前排行榜有 ${p.totalParticipants||0} 位參與者，需達 20 人才開始顯示段位。`;
    }else{
      $('tier-notice').textContent='';
    }
    if(!rows.length){
      $('rankings-body').innerHTML='<tr><td colspan="6" style="color:#888">尚無排行資料，加入排行榜並完成練習後即出現。</td></tr>';
      return;
    }
    $('rankings-body').innerHTML=rows.map(r=>`
      <tr${r.rank<=3?' style="font-weight:600"':''}>
        <td>${r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:r.rank}</td>
        <td>${escHtml(r.displayName)}</td>
        <td>${tierBadge(r.tier)}</td>
        <td>${r.score}</td>
        <td>${r.correct}</td>
        <td>${r.attempts}</td>
      </tr>`).join('');
  }catch(e){status(e.message);}
}

async function loadMyStats(){
  try{
    const p=await api('/api/rankings/me');
    // Show opt-in section for logged-in users
    $('optin-section').hidden=false;
    if(!p.optedIn){
      $('join-btn').hidden=false;
      $('leave-btn').hidden=true;
      $('optin-status').textContent='目前未加入排行榜。';
      $('my-stats').hidden=true;
      return;
    }
    $('join-btn').hidden=true;
    $('leave-btn').hidden=false;
    $('optin-status').textContent='已加入排行榜。';
    // Show my stats
    $('my-stats').hidden=false;
    const score=weekly?p.weekScore:p.score;
    const correct=weekly?p.weekCorrect:p.correct;
    const attempts=weekly?p.weekAttempts:p.attempts;
    const rank=weekly?p.weekRank:p.rank;
    const tier=weekly?p.weekTier:p.tier;
    $('my-score').textContent=score;
    $('my-rank').textContent=rank!=null?`#${rank}`:'—';
    $('my-correct').textContent=correct;
    $('my-attempts').textContent=attempts;
    $('my-tier-badge').innerHTML=tierBadge(tier);
    // Progress bar to next tier
    if(tier){
      const idx=TIERS.findIndex(t=>t.name===tier);
      const next=TIERS[idx+1];
      if(next){
        const cur=TIERS[idx].minScore;
        const pct=Math.min(100,Math.round((score-cur)/(next.minScore-cur)*100));
        $('tier-bar').style.width=pct+'%';
        $('tier-next-hint').textContent=`距下一段位「${next.name}」還需 ${Math.max(0,next.minScore-score)} 分`;
      }else{
        $('tier-bar').style.width='100%';
        $('tier-next-hint').textContent='已達最高段位';
      }
    }else{
      $('tier-bar').style.width='0%';
      $('tier-next-hint').textContent='需排行榜達 20 人以上才顯示段位';
    }
  }catch{/* not logged in or no data */}
}

$('join-btn').addEventListener('click',async()=>{
  try{
    await apiPost('/api/rankings/join');
    $('join-btn').hidden=true;
    $('leave-btn').hidden=false;
    $('optin-status').textContent='已加入排行榜。';
    status('已加入排行榜。完成練習後積分將自動計入。');
    await loadRankings();
  }catch(e){status(e.message);}
});

$('leave-btn').addEventListener('click',async()=>{
  if(!confirm('確認退出排行榜？退出後你的積分仍保留，但不再公開顯示排名。'))return;
  try{
    await apiPost('/api/rankings/leave');
    $('join-btn').hidden=false;
    $('leave-btn').hidden=true;
    $('optin-status').textContent='已退出排行榜。';
    $('my-stats').hidden=true;
    status('已退出排行榜。');
    await loadRankings();
  }catch(e){status(e.message);}
});

$('tab-all').addEventListener('click',()=>{
  weekly=false;
  $('tab-all').className='tab-btn active';
  $('tab-week').className='tab-btn';
  loadRankings();
  if(account)loadMyStats();
});

$('tab-week').addEventListener('click',()=>{
  weekly=true;
  $('tab-all').className='tab-btn';
  $('tab-week').className='tab-btn active';
  loadRankings();
  if(account)loadMyStats();
});

$('account-toggle').onclick=()=>location.href='../court/';

async function init(){
  try{
    const p=await api('/api/auth/session');
    account=p.user;csrf=p.csrfToken||'';
    $('account-toggle').textContent=account?account.displayName:'登入';
    if(account)await loadMyStats();
  }catch{/* session check failed */}
  renderTierTable();
  await loadRankings();
}

await init();
