// Presentation preferences only. Never store account, court or authentication data.
const KEY='eduai-court-display-v1';
export function normalizeDisplay(value){
 return {scale:[100,125,150].includes(value?.scale)?value.scale:100,
  contrast:value?.contrast===true,motion:['system','reduce'].includes(value?.motion)?value.motion:'system'};
}
export function installAccessibility({document,window}){
 const root=document.documentElement;
 const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const panel=make('details');panel.className='display-settings';
 panel.append(make('summary','閱讀設定'));
 const controls=make('div');controls.className='grid';
 const select=(title,options)=>{
  const wrapper=make('label',title),input=make('select');
  for(const [value,text] of options){const option=make('option',text);option.value=value;input.append(option);}
  wrapper.append(input);controls.append(wrapper);return input;
 };
 const scale=select('網頁字級',[['100','標準'],['125','放大 125%'],['150','放大 150%']]);
 const contrast=select('對比',[['normal','標準'],['high','黑白高對比']]);
 const motion=select('網頁動態效果',[['system','跟隨裝置設定'],['reduce','減少動態效果']]);
 const reset=make('button','恢復預設');reset.type='button';
 const note=make('p','僅儲存在這台裝置，不改變案件或評分。此設定目前適用網頁介面，3D 場景內設定尚待整合。');
 const status=make('p');status.setAttribute('role','status');
 panel.append(controls,note,reset,status);document.querySelector('main').prepend(panel);
 let preferences=normalizeDisplay(null);
 try{preferences=normalizeDisplay(JSON.parse(window.localStorage.getItem(KEY)));}catch{/* Storage is optional. */}
 function apply(){
  root.dataset.courtScale=String(preferences.scale);root.dataset.courtContrast=preferences.contrast?'high':'normal';root.dataset.courtMotion=preferences.motion;
  scale.value=String(preferences.scale);contrast.value=preferences.contrast?'high':'normal';motion.value=preferences.motion;
 }
 function save(){
  apply();
  try{window.localStorage.setItem(KEY,JSON.stringify(preferences));status.textContent='閱讀設定已儲存於此裝置。';}
  catch{status.textContent='設定已套用；瀏覽器不允許儲存，重新開啟後可能恢復預設。';}
 }
 for(const input of [scale,contrast,motion])input.addEventListener('change',()=>{
  preferences=normalizeDisplay({scale:Number(scale.value),contrast:contrast.value==='high',motion:motion.value});save();
 });
 reset.addEventListener('click',()=>{preferences=normalizeDisplay(null);save();});
 window.addEventListener('storage',event=>{
  if(event.key!==KEY&&event.key!==null)return;
  try{preferences=normalizeDisplay(event.key===null?null:JSON.parse(event.newValue));apply();}catch{/* Ignore malformed cross-tab preferences. */}
 });
 apply();
}
