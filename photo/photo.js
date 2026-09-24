const $=id=>document.getElementById(id);
const onPages=location.hostname.endsWith('github.io');
const WORKER='https://civic-law-lab-212.yichengc869.workers.dev';
const base=onPages?WORKER:'';
let account=null,csrf='',busy=false;
const MAX_BYTES=2*1024*1024;
const MAX_DIM=1920;

function status(t,err=false){const el=$('status');el.textContent=t;el.style.color=err?'#b00020':'';}
async function api(path,body,isText=false){
  const r=await fetch(base+path,{method:body?'POST':'GET',credentials:'include',
    headers:{Accept:'application/json',...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},
    body:body?JSON.stringify(body):undefined});
  const p=await r.json();
  if(!r.ok)throw Error(p.error||'服務暫時無法使用');
  return p;
}
async function run(fn){if(busy)return;busy=true;try{await fn();}catch(e){status(e.message,true);}finally{busy=false;}}

async function loadSession(){
  try{
    const p=await api('/api/auth/session');
    account=p.user;csrf=p.csrfToken||'';
    $('account-toggle').textContent=account?account.displayName:'登入';
    if(!account){$('login-required').hidden=false;$('photo-area').hidden=true;return;}
    $('login-required').hidden=true;$('photo-area').hidden=false;
    checkCapabilities();
  }catch(e){status(e.message,true);}
}

async function checkCapabilities(){
  try{
    const p=await api('/api/capabilities');
    if(!p.photo){
      $('cap-notice').textContent='AI 講解服務目前未啟用，請稍後再試。';
      $('cap-notice').hidden=false;
      $('explain-btn').disabled=true;
    }
  }catch{/* non-fatal */}
}

// ── Image processing ──────────────────────────────────────────────────────────

// Compress and strip EXIF by re-drawing through a canvas.
// Returns a Blob (image/jpeg) guaranteed ≤ MAX_BYTES.
async function processImage(file){
  return new Promise((resolve,reject)=>{
    const img=new Image();
    img.onload=()=>{
      URL.revokeObjectURL(img.src);
      let w=img.naturalWidth,h=img.naturalHeight;
      if(w>MAX_DIM||h>MAX_DIM){
        const scale=Math.min(MAX_DIM/w,MAX_DIM/h);
        w=Math.round(w*scale);h=Math.round(h*scale);
      }
      const canvas=document.createElement('canvas');
      canvas.width=w;canvas.height=h;
      canvas.getContext('2d').drawImage(img,0,0,w,h);
      // Try quality 0.85 first; if still too large, lower quality
      const tryQuality=q=>{
        canvas.toBlob(blob=>{
          if(!blob){reject(new Error('圖片轉換失敗'));return;}
          if(blob.size<=MAX_BYTES||q<=0.4){resolve(blob);}
          else{tryQuality(q-0.15);}
        },'image/jpeg',q);
      };
      tryQuality(0.85);
    };
    img.onerror=()=>{URL.revokeObjectURL(img.src);reject(new Error('圖片讀取失敗'));};
    img.src=URL.createObjectURL(file);
  });
}

$('image-input').addEventListener('change',async e=>{
  const file=e.target.files[0];
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){
    status('請選擇 JPEG、PNG 或 WebP 格式的圖片',true);return;
  }
  run(async()=>{
    status('正在壓縮與處理圖片…');
    const blob=await processImage(file);
    const url=URL.createObjectURL(blob);
    $('preview-img').src=url;
    $('preview-img').hidden=false;
    $('size-info').textContent=`處理後大小：${(blob.size/1024).toFixed(0)} KB（EXIF 已移除）`;
    $('step-extract').hidden=false;
    $('question-input').value='';
    $('char-count').textContent='0 / 1000';
    $('result-area').hidden=true;
    status('圖片準備完成。請在下方輸入或貼上題目文字後取得講解。');
  });
});

$('question-input').addEventListener('input',()=>{
  const len=$('question-input').value.length;
  $('char-count').textContent=`${len} / 1000`;
  $('char-count').style.color=len>950?'#b00020':'';
});

$('explain-btn').addEventListener('click',()=>run(async()=>{
  const text=$('question-input').value.trim();
  if(!text){status('請先輸入題目文字',true);return;}
  if(text.length>1000){status('題目文字不可超過 1000 字',true);return;}
  if(!account){status('請先登入',true);return;}
  status('AI 講解中，請稍候…');
  $('explain-btn').disabled=true;
  try{
    const requestId=crypto.randomUUID();
    const p=await api('/api/photo/explain',{text,requestId});
    $('explanation-text').textContent=p.explanation;
    $('result-area').hidden=false;
    $('save-note-btn').dataset.text=p.explanation;
    $('save-note-btn').dataset.question=text;
    status('講解完成。');
    $('result-area').scrollIntoView({behavior:'smooth',block:'start'});
  }finally{$('explain-btn').disabled=false;}
}));

$('save-note-btn').addEventListener('click',()=>{
  const explanation=$('save-note-btn').dataset.text||'';
  const question=$('save-note-btn').dataset.question||'';
  if(!explanation)return;
  const notes=JSON.parse(localStorage.getItem('photo_notes')||'[]');
  notes.unshift({question,explanation,savedAt:new Date().toISOString()});
  if(notes.length>50)notes.length=50;
  localStorage.setItem('photo_notes',JSON.stringify(notes));
  $('save-note-btn').textContent='已儲存';
  setTimeout(()=>{$('save-note-btn').textContent='儲存為筆記';},2000);
  renderNotes();
  $('notes-section').hidden=false;
});

$('show-notes-btn').addEventListener('click',()=>{
  renderNotes();
  $('notes-section').hidden=!$('notes-section').hidden;
  $('show-notes-btn').textContent=$('notes-section').hidden?'查看已儲存筆記':'收起筆記';
});

$('clear-notes-btn').addEventListener('click',()=>{
  if(!confirm('確認刪除全部已儲存的照片講解筆記？'))return;
  localStorage.removeItem('photo_notes');
  renderNotes();
});

function renderNotes(){
  const notes=JSON.parse(localStorage.getItem('photo_notes')||'[]');
  $('notes-count').textContent=notes.length?`共 ${notes.length} 則`:'尚無筆記';
  const list=$('notes-list');
  if(!notes.length){list.textContent='';return;}
  list.replaceChildren(...notes.map((n,i)=>{
    const div=document.createElement('div');div.className='note-item';
    const q=document.createElement('p');q.className='note-q';
    q.textContent='題目：'+n.question.slice(0,80)+(n.question.length>80?'…':'');
    const e=document.createElement('p');e.className='note-e';e.textContent=n.explanation;
    const meta=document.createElement('small');meta.textContent=new Date(n.savedAt).toLocaleString('zh-TW');
    const del=document.createElement('button');del.textContent='刪除';del.className='del-btn';
    del.addEventListener('click',()=>{
      const all=JSON.parse(localStorage.getItem('photo_notes')||'[]');
      all.splice(i,1);localStorage.setItem('photo_notes',JSON.stringify(all));
      renderNotes();
    });
    div.append(q,e,meta,del);return div;
  }));
}

$('account-toggle').addEventListener('click',()=>{
  location.href=base+'/court/#account';
});

loadSession();
