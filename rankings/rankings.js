import '../auth-sync.js';
const $=id=>document.getElementById(id);
const onPages=location.hostname.endsWith('github.io');
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const base=onPages?WORKER:'';
let account=null,csrf='';

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

function tierBadge(tier){
  return `<span class="tier-badge tier-${tier}">${tier}</span>`;
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
    const p=await api('/api/rankings/top');
    const rows=p.leaderboard;
    if(!rows.length){
      $('rankings-body').innerHTML='<tr><td colspan="6" style="color:#888">尚無排行資料，完成練習後即出現。</td></tr>';
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
    $('my-stats').hidden=false;
    $('my-score').textContent=p.score;
    $('my-rank').textContent=p.rank!=null?`#${p.rank}`:'—';
    $('my-correct').textContent=p.correct;
    $('my-attempts').textContent=p.attempts;
    $('my-tier-badge').innerHTML=tierBadge(p.tier);

    // Progress bar to next tier
    const idx=TIERS.findIndex(t=>t.name===p.tier);
    const next=TIERS[idx+1];
    if(next){
      const cur=TIERS[idx].minScore;
      const pct=Math.min(100,Math.round((p.score-cur)/(next.minScore-cur)*100));
      $('tier-bar').style.width=pct+'%';
      $('tier-next-hint').textContent=`距下一段位「${next.name}」還需 ${Math.max(0,next.minScore-p.score)} 分`;
    }else{
      $('tier-bar').style.width='100%';
      $('tier-next-hint').textContent='已達最高段位';
    }
  }catch{/* not logged in or no data */}
}

function escHtml(s){
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function init(){
  try{
    const p=await window.EduAuth.session();
    account=p.user;csrf=p.csrfToken||'';
    $('account-toggle').textContent=account?account.displayName:'登入';
    if(account) await loadMyStats();
  }catch{/* session check failed */}
  renderTierTable();
  await loadRankings();
}

$('account-toggle').onclick=()=>location.href='../court/';
await init();
