const $=id=>document.getElementById(id);
const onPages=location.hostname.endsWith('github.io');
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const base=onPages?WORKER:'';
const TZ='Asia/Taipei';
let account=null,csrf='',busy=false;
let weekOffset=0; // 0=current week
let slots=[];
let focusId=null,focusTimer=null,focusStart=0,focusPaused=0;
let editingSlotId=null;
const DAY_MS=86400000,HOUR_MS=3600000;

// ── Helpers ──────────────────────────────────────────────────────────────────
function status(t){$('status').textContent=t;}
async function api(path,method='GET',body=null){
  const r=await fetch(base+path,{method,credentials:'include',
    headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},
    body:body?JSON.stringify(body):undefined});
  const p=await r.json();
  if(!r.ok)throw Error(p.error||'服務暫時無法使用');
  return p;
}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message);}finally{busy=false;}}

// Monday of the Nth week offset from current ISO week
function weekStart(offset=0){
  const now=new Date();
  const day=now.getDay()||7; // 1=Mon..7=Sun
  const mon=new Date(now);
  mon.setHours(0,0,0,0);
  mon.setDate(mon.getDate()-day+1+offset*7);
  return mon;
}
function fmtDate(d){return d.toLocaleDateString('zh-TW',{timeZone:TZ,month:'short',day:'numeric'});}
function fmtWeekday(d){return d.toLocaleDateString('zh-TW',{timeZone:TZ,weekday:'short'});}
function toLocalDT(iso){
  // Convert ISO UTC to local datetime-local input value (YYYY-MM-DDTHH:mm)
  const d=new Date(iso);
  const pad=n=>String(n).padStart(2,'0');
  const loc=new Date(d.toLocaleString('en-US',{timeZone:TZ}));
  return `${loc.getFullYear()}-${pad(loc.getMonth()+1)}-${pad(loc.getDate())}T${pad(loc.getHours())}:${pad(loc.getMinutes())}`;
}
function localDTtoISO(localDT){
  // Interpret localDT as Asia/Taipei and convert to UTC ISO
  // Use Intl to get offset
  const d=new Date(localDT);
  const tzOffset=new Date(d.toLocaleString('en-US',{timeZone:TZ})).getTime()-new Date(d.toLocaleString('en-US',{timeZone:'UTC'})).getTime();
  return new Date(d.getTime()-tzOffset).toISOString();
}
function pad(n){return String(n).padStart(2,'0');}
function fmtElapsed(s){return `${pad(Math.floor(s/3600))}:${pad(Math.floor(s%3600/60))}:${pad(s%60)}`;}

// ── Auth ─────────────────────────────────────────────────────────────────────
async function loadSession(){
  const p=await api('/api/auth/session');
  account=p.user;csrf=p.csrfToken||'';
  $('account-toggle').textContent=account?account.displayName:'登入';
  if(!account){$('login-notice').hidden=false;$('planner-area').hidden=true;}
  else{$('login-notice').hidden=true;$('planner-area').hidden=false;renderWeek();await loadSlots();prefillFromParams();}
}

// Pre-fill the add-slot form when arriving from the practice weakness page.
// Expected params: title, subject, concept (concept is informational only).
function prefillFromParams(){
  const sp=new URLSearchParams(location.search);
  const title=sp.get('title');
  const subject=sp.get('subject');
  if(!title)return;
  const form=$('slot-form');
  form.elements.title.value=title.slice(0,80);
  const validSubjects=['law','civics','economics','other'];
  if(subject&&validSubjects.includes(subject))form.elements.subject.value=subject;
  $('add-slot-details').open=true;
  $('add-slot-details').scrollIntoView({behavior:'smooth',block:'start'});
  // Clean up URL so refresh doesn't re-open the form
  history.replaceState(null,'',location.pathname);
}
$('account-toggle').onclick=()=>location.href='../court/';

// ── Week rendering ────────────────────────────────────────────────────────────
const HOURS=Array.from({length:17},(_,i)=>i+6); // 06:00-22:00

function renderWeek(){
  const mon=weekStart(weekOffset);
  const days=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(d.getDate()+i);return d;});
  const todayStr=new Date().toDateString();
  $('week-label').textContent=`${fmtDate(days[0])} – ${fmtDate(days[6])}`;

  const grid=$('week-grid');
  grid.innerHTML='';
  // Header row
  const cornerH=document.createElement('div');cornerH.className='wg-header';cornerH.textContent='';grid.append(cornerH);
  days.forEach(d=>{const h=document.createElement('div');h.className='wg-header';h.textContent=`${fmtWeekday(d)} ${fmtDate(d)}`;grid.append(h);});

  // Hour rows
  HOURS.forEach(hr=>{
    const timeCell=document.createElement('div');timeCell.className='wg-time';timeCell.textContent=`${pad(hr)}:00`;grid.append(timeCell);
    days.forEach((d,di)=>{
      const cell=document.createElement('div');cell.className='wg-cell';
      if(d.toDateString()===todayStr)cell.classList.add('today');
      cell.dataset.day=di;cell.dataset.hour=hr;
      cell.addEventListener('click',()=>prefillSlotForm(d,hr));
      grid.append(cell);
    });
  });

  // Render slots
  const mon0=mon.getTime();
  const colWidth=100/7;
  slots.filter(s=>{
    const start=new Date(s.start_iso).getTime();
    const end=mon0+7*DAY_MS;
    return start>=mon0&&start<end;
  }).forEach(s=>{
    const start=new Date(s.start_iso);
    const end=new Date(s.end_iso);
    const diffDays=Math.floor((start.getTime()-mon0)/DAY_MS);
    const startHr=start.getHours()+start.getMinutes()/60;
    const endHr=end.getHours()+end.getMinutes()/60;
    if(diffDays<0||diffDays>6)return;
    const minHour=HOURS[0],maxHour=HOURS[HOURS.length-1]+1;
    const topPct=((Math.max(startHr,minHour)-minHour)/(maxHour-minHour))*100;
    const heightPct=((Math.min(endHr,maxHour)-Math.max(startHr,minHour))/(maxHour-minHour))*100;
    if(heightPct<=0)return;
    // Find the cell in column diffDays+1, spanning relevant rows
    const block=document.createElement('div');
    block.className=`slot-block ${s.subject||'other'}`;
    block.textContent=s.title;
    block.title=`${s.title}\n${start.toLocaleTimeString('zh-TW',{timeZone:TZ,hour:'2-digit',minute:'2-digit'})}–${end.toLocaleTimeString('zh-TW',{timeZone:TZ,hour:'2-digit',minute:'2-digit'})}`;
    block.style.left=`calc(${(diffDays/7)*100}% + 1px)`;
    block.style.width=`calc(${colWidth}% - 2px)`;
    block.style.top=`${topPct}%`;
    block.style.height=`${heightPct}%`;
    block.style.position='absolute';
    block.addEventListener('click',e=>{e.stopPropagation();prefillEditForm(s);});
    // Place in the overlay div
    let overlay=grid.querySelector('.slot-overlay');
    if(!overlay){overlay=document.createElement('div');overlay.className='slot-overlay';overlay.style.cssText='position:absolute;top:0;left:3rem;right:0;bottom:0;pointer-events:none;';grid.style.position='relative';grid.append(overlay);}
    overlay.style.pointerEvents='none';
    block.style.pointerEvents='auto';
    overlay.append(block);
  });
}

// ── Slots ─────────────────────────────────────────────────────────────────────
async function loadSlots(){
  const mon=weekStart(weekOffset);
  const from=mon.toISOString();
  const to=new Date(mon.getTime()+7*DAY_MS).toISOString();
  const p=await api(`/api/planner/slots?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  slots=p.slots||[];
  renderWeek();
  refreshFocusSelect();
}

function prefillSlotForm(day,hr){
  const s=new Date(day);s.setHours(hr,0,0,0);
  const e=new Date(s.getTime()+HOUR_MS);
  const form=$('slot-form');
  form.elements.title.value='';
  form.elements.startLocal.value=toLocalDT(s.toISOString());
  form.elements.endLocal.value=toLocalDT(e.toISOString());
  form.elements.recurrence.value='none';
  form.elements.examDate.value='';
  form.elements.note.value='';
  $('edit-slot-id').value='';
  editingSlotId=null;
  $('slot-cancel').hidden=true;
  $('slot-submit').textContent='儲存';
  $('add-slot-details').open=true;
}
function prefillEditForm(s){
  const form=$('slot-form');
  form.elements.title.value=s.title;
  form.elements.startLocal.value=toLocalDT(s.start_iso);
  form.elements.endLocal.value=toLocalDT(s.end_iso);
  form.elements.subject.value=s.subject||'other';
  form.elements.recurrence.value=s.recurrence||'none';
  form.elements.examDate.value=s.exam_date?s.exam_date.slice(0,10):'';
  form.elements.note.value=s.note||'';
  $('edit-slot-id').value=s.id;
  editingSlotId=s.id;
  $('slot-cancel').hidden=false;
  $('slot-submit').textContent='更新';
  $('add-slot-details').open=true;
}

$('slot-form').onsubmit=e=>{e.preventDefault();void run(async()=>{
  const f=new FormData(e.target);
  const body={
    title:f.get('title'),subject:f.get('subject'),
    startIso:localDTtoISO(f.get('startLocal')),
    endIso:localDTtoISO(f.get('endLocal')),
    recurrence:f.get('recurrence'),
    examDate:f.get('examDate')||null,
    note:f.get('note')||null
  };
  if(editingSlotId){
    await api(`/api/planner/slots/${editingSlotId}`,'PUT',body);
    status('排程已更新。');
  }else{
    await api('/api/planner/slots','POST',body);
    status('排程已新增。');
  }
  editingSlotId=null;$('edit-slot-id').value='';$('slot-cancel').hidden=true;
  $('add-slot-details').open=false;
  await loadSlots();
});};

$('slot-cancel').onclick=()=>{editingSlotId=null;$('edit-slot-id').value='';$('slot-cancel').hidden=true;$('slot-form').reset();};
$('prev-week').onclick=()=>{weekOffset--;void run(loadSlots);};
$('next-week').onclick=()=>{weekOffset++;void run(loadSlots);};
$('today-btn').onclick=()=>{weekOffset=0;void run(loadSlots);};

// ── Focus timer ───────────────────────────────────────────────────────────────
function refreshFocusSelect(){
  const sel=$('focus-slot-select');
  const val=sel.value;
  sel.replaceChildren(Object.assign(document.createElement('option'),{value:'',textContent:'不綁定排程'}));
  slots.forEach(s=>{sel.append(Object.assign(document.createElement('option'),{value:s.id,textContent:s.title}));});
  sel.value=val;
}
function updateFocusDisplay(){
  if(!focusId)return;
  const elapsed=Math.floor((Date.now()-focusStart)/1000)-focusPaused;
  $('focus-elapsed').textContent=fmtElapsed(Math.max(0,elapsed));
}
$('focus-start').onclick=()=>run(async()=>{
  if(focusId)return;
  const slotId=$('focus-slot-select').value||null;
  const p=await api('/api/planner/focus/start','POST',{slotId,tz:TZ});
  focusId=p.focusId;focusStart=Date.now();focusPaused=0;
  $('focus-start').hidden=true;$('focus-end').hidden=false;
  focusTimer=setInterval(async()=>{
    updateFocusDisplay();
    try{const r=await api('/api/planner/focus/beat','POST',{focusId});focusPaused=0;void r;}catch{}
  },30000);
  updateFocusDisplay();
});
$('focus-end').onclick=()=>run(async()=>{
  if(!focusId)return;
  clearInterval(focusTimer);focusTimer=null;
  const p=await api('/api/planner/focus/end','POST',{focusId});
  focusId=null;$('focus-start').hidden=false;$('focus-end').hidden=true;
  $('focus-elapsed').textContent='00:00:00';
  status(`專注結束，有效時間 ${fmtElapsed(p.elapsed||0)}`);
});

// ── ICS export ────────────────────────────────────────────────────────────────
$('export-ics').onclick=()=>run(async()=>{
  const all=await api('/api/planner/slots');
  const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//EduAI2//Planner//ZH'];
  (all.slots||[]).forEach(s=>{
    const uid=s.id+'@eduai2';
    const dtstart=s.start_iso.replace(/[-:]/g,'').replace('.000','');
    const dtend=s.end_iso.replace(/[-:]/g,'').replace('.000','');
    lines.push('BEGIN:VEVENT',`UID:${uid}`,`DTSTART:${dtstart}`,`DTEND:${dtend}`,
      `SUMMARY:${s.title.replace(/[,;\\]/g,' ')}`,
      s.recurrence==='weekly'?'RRULE:FREQ=WEEKLY':'',
      s.exam_date?`X-EXAM-DATE:${s.exam_date}`:'',
      'END:VEVENT');
  });
  lines.push('END:VCALENDAR');
  const blob=new Blob([lines.filter(Boolean).join('\r\n')],{type:'text/calendar'});
  const a=Object.assign(document.createElement('a'),{href:URL.createObjectURL(blob),download:'eduai-schedule.ics'});
  a.click();URL.revokeObjectURL(a.href);
});

// ── Web Push ──────────────────────────────────────────────────────────────────
$('push-toggle').onclick=()=>{$('push-panel').hidden=!$('push-panel').hidden;void run(initPushPanel);};
$('close-push').onclick=()=>{$('push-panel').hidden=true;};

async function initPushPanel(){
  if(!('serviceWorker' in navigator)||!('PushManager' in window)){
    $('push-status-text').textContent='此瀏覽器不支援 Web Push 通知。可使用「匯出 ICS」加入系統行事曆。';
    $('push-subscribe').hidden=true;return;
  }
  const perm=Notification.permission;
  if(perm==='denied'){$('push-status-text').textContent='通知已被拒絕。請到瀏覽器設定解除封鎖，或使用 ICS 匯出。';$('push-subscribe').hidden=true;return;}
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if(sub){
    $('push-status-text').textContent='通知已啟用。';
    $('push-subscribe').hidden=true;$('push-unsubscribe').hidden=false;
  }else{
    $('push-status-text').textContent='尚未授權通知。授權後，排程開始前約 1 分鐘會收到提醒（需瀏覽器在背景運行）。';
    $('push-subscribe').hidden=false;$('push-unsubscribe').hidden=true;
  }
}

$('push-subscribe').onclick=()=>run(async()=>{
  const reg=await navigator.serviceWorker.ready;
  const vapidKey=await api('/api/push/vapid-key');
  if(!vapidKey.publicKey){$('push-status-text').textContent='通知服務尚未設定，請稍後再試。';return;}
  const sub=await reg.pushManager.subscribe({
    userVisibleOnly:true,
    applicationServerKey:urlBase64ToUint8Array(vapidKey.publicKey)
  });
  await api('/api/push/subscribe','POST',sub.toJSON());
  $('push-status-text').textContent='通知已啟用！';
  $('push-subscribe').hidden=true;$('push-unsubscribe').hidden=false;
  status('通知授權成功。');
});
$('push-unsubscribe').onclick=()=>run(async()=>{
  const reg=await navigator.serviceWorker.ready;
  const sub=await reg.pushManager.getSubscription();
  if(sub){await sub.unsubscribe();await api('/api/push/unsubscribe','POST',{endpoint:sub.endpoint});}
  $('push-status-text').textContent='通知已關閉。';
  $('push-subscribe').hidden=false;$('push-unsubscribe').hidden=true;
});

function urlBase64ToUint8Array(base64String){
  const padding='='.repeat((4-base64String.length%4)%4);
  const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');
  const rawData=atob(base64);
  return Uint8Array.from([...rawData],c=>c.charCodeAt(0));
}

// ── Service worker registration ───────────────────────────────────────────────
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('../sw.js').catch(()=>{});
}

// ── Background music player ───────────────────────────────────────────────────
import('../music-player.js').then(m => m.initMusicPlayer()).catch(() => {});

// ── Init ─────────────────────────────────────────────────────────────────────
await run(loadSession);
