const $=id=>document.getElementById(id);
const onPages=location.hostname.endsWith('github.io');
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const base=onPages?WORKER:'';
let account=null,csrf='',currentGroupId=null,lbWeekly=false,busy=false;

function status(t,err=false){const el=$('status');el.textContent=t;el.style.color=err?'#b00020':'';}
function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
function escHtml(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

async function api(path,method='GET',body){
  const r=await fetch(base+path,{method,credentials:'include',headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const p=await r.json();
  if(!r.ok)throw Error(p.error||'服務暫時無法使用');
  return p;
}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message,true);}finally{busy=false;}}

// ── Group list ────────────────────────────────────────────────────────────────

async function loadGroups(){
  const p=await api('/api/groups');
  const list=$('group-list');
  if(!p.groups.length){
    list.innerHTML='<p style="color:#888;font-size:.9rem">尚無群組。建立或加入一個開始吧。</p>';
    return;
  }
  list.replaceChildren(...p.groups.map(g=>{
    const card=node('div','','group-card');
    const h=node('h3',g.name);
    const meta=node('p','','meta');
    meta.textContent=`建立於 ${new Date(g.created_at).toLocaleDateString('zh-TW')}`;
    const btn=node('button','進入群組');
    btn.type='button';
    btn.addEventListener('click',()=>run(()=>openGroup(g.id,g.name)));
    card.append(h,meta,btn);
    return card;
  }));
}

// ── Group detail ──────────────────────────────────────────────────────────────

async function openGroup(id,name){
  currentGroupId=id;
  const p=await api(`/api/groups/${id}`);
  $('group-list-section').hidden=true;
  $('group-detail').style.display='';
  $('group-name').textContent=name||p.group.name;
  $('group-owner-badge').hidden=!p.group.isOwner;
  $('member-count').textContent=`共 ${p.group.memberCount} 人`;

  // Members
  $('member-list').replaceChildren(...p.members.map(m=>{
    const row=node('div','','member-row');
    const nameEl=node('span',m.displayName);
    row.append(nameEl);
    if(m.isOwner)row.append(node('span','群主','owner-badge'));
    if(p.group.isOwner&&!m.isOwner){
      const kickBtn=node('button','移除');
      kickBtn.type='button';kickBtn.style.cssText='margin-left:auto;font-size:.78rem;padding:.15rem .45rem';
      kickBtn.addEventListener('click',()=>run(async()=>{
        if(!confirm(`確認移除成員「${m.displayName}」？`))return;
        await api(`/api/groups/${id}/members/${m.userId}`,'DELETE');
        status(`已移除 ${m.displayName}`);
        await openGroup(id,name);
      }));
      row.append(kickBtn);
    }
    return row;
  }));

  // Invite codes (owner only)
  $('invite-section').hidden=!p.group.isOwner;
  if(p.group.isOwner)renderInvites(id,p.invites||[]);

  // Leaderboard
  await loadLeaderboard(id);
}

function renderInvites(groupId,invites){
  const list=$('invite-list');
  if(!invites.length){list.textContent='尚無邀請碼。';return;}
  list.replaceChildren(...invites.map(inv=>{
    const row=node('div','','invite-row');
    const code=node('span',inv.code,'code-text');
    const revokeBtn=node('button','撤銷');
    revokeBtn.type='button';revokeBtn.style.cssText='font-size:.78rem;padding:.15rem .45rem';
    revokeBtn.addEventListener('click',()=>run(async()=>{
      await api(`/api/groups/${groupId}/invite/${inv.code}`,'DELETE');
      const p=await api(`/api/groups/${groupId}`);
      renderInvites(groupId,p.invites||[]);
      status('邀請碼已撤銷');
    }));
    row.append(code,revokeBtn);
    return row;
  }));
}

async function loadLeaderboard(id){
  const p=await api(`/api/groups/${id}/leaderboard?weekly=${lbWeekly?1:0}`);
  const rows=p.leaderboard;
  if(!rows.length){
    $('leaderboard-body').innerHTML='<tr><td colspan="5" style="color:#888">尚無資料。成員完成練習後即顯示。</td></tr>';
    return;
  }
  $('leaderboard-body').innerHTML=rows.map(r=>`
    <tr${r.rank<=3?' style="font-weight:600"':''}>
      <td>${r.rank<=3?['🥇','🥈','🥉'][r.rank-1]:r.rank}</td>
      <td>${escHtml(r.displayName)}${r.isOwner?' <span class="owner-badge">群主</span>':''}</td>
      <td>${r.score}</td>
      <td>${r.correct}</td>
      <td>${r.attempts}</td>
    </tr>`).join('');
}

// ── Event bindings ────────────────────────────────────────────────────────────

$('back-btn').addEventListener('click',()=>{
  $('group-detail').style.display='none';
  $('group-list-section').hidden=false;
  currentGroupId=null;
  run(loadGroups);
});

$('create-form').addEventListener('submit',e=>{
  e.preventDefault();
  run(async()=>{
    const name=new FormData(e.target).get('name').trim();
    await api('/api/groups','POST',{name});
    e.target.reset();
    e.target.closest('details').open=false;
    status(`群組「${name}」已建立`);
    await loadGroups();
  });
});

$('join-form').addEventListener('submit',e=>{
  e.preventDefault();
  run(async()=>{
    const code=new FormData(e.target).get('code').trim().toUpperCase();
    const p=await api('/api/groups/join','POST',{code});
    e.target.reset();
    e.target.closest('details').open=false;
    status('已加入群組！');
    await loadGroups();
    await openGroup(p.groupId,'');
  });
});

$('leave-btn').addEventListener('click',()=>{
  if(!currentGroupId)return;
  const isOwner=$('group-owner-badge').hidden===false;
  const msg=isOwner?'你是群主，退出將解散整個群組並刪除所有資料。確定繼續？':'確認退出此群組？退出後立即失去群組資料的讀取權限。';
  if(!confirm(msg))return;
  run(async()=>{
    await api(`/api/groups/${currentGroupId}/leave`,'DELETE');
    $('group-detail').style.display='none';
    $('group-list-section').hidden=false;
    currentGroupId=null;
    status(isOwner?'群組已解散':'已退出群組');
    await loadGroups();
  });
});

$('gen-invite-btn').addEventListener('click',()=>{
  if(!currentGroupId)return;
  run(async()=>{
    const p=await api(`/api/groups/${currentGroupId}/invite`,'POST');
    status(`邀請碼：${p.code}（已加入上方列表）`);
    const detail=await api(`/api/groups/${currentGroupId}`);
    renderInvites(currentGroupId,detail.invites||[]);
  });
});

$('lb-tab-all').addEventListener('click',()=>{
  lbWeekly=false;
  $('lb-tab-all').className='tab-btn active';$('lb-tab-week').className='tab-btn';
  if(currentGroupId)run(()=>loadLeaderboard(currentGroupId));
});
$('lb-tab-week').addEventListener('click',()=>{
  lbWeekly=true;
  $('lb-tab-all').className='tab-btn';$('lb-tab-week').className='tab-btn active';
  if(currentGroupId)run(()=>loadLeaderboard(currentGroupId));
});

$('account-toggle').onclick=()=>location.href='../court/';

// ── Init ──────────────────────────────────────────────────────────────────────

async function init(){
  try{
    const p=await api('/api/auth/session');
    account=p.user;csrf=p.csrfToken||'';
    $('account-toggle').textContent=account?account.displayName:'登入';
    if(!account){$('login-notice').hidden=false;return;}
    $('groups-area').hidden=false;
    await loadGroups();
  }catch(e){status(e.message,true);}
}

await init();
